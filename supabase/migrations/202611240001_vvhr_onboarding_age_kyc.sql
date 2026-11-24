-- HR onboarding KYC fields and server-side age validation.
-- Additive HR-only schema change; does not touch OMS tables.
alter table public.vvhr_onboarding_requests
  add column if not exists aadhaar_number text,
  add column if not exists pan_number text;

alter table public.vvhr_employees
  add column if not exists aadhaar_number text;

create or replace function public.vvhr_validate_onboarding_age()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.date_of_birth is null or new.joining_date is null then
    raise exception 'Date of Birth and Date of Joining are required';
  end if;
  if new.date_of_birth > (new.joining_date - interval '18 years')::date then
    raise exception 'Employee must be at least 18 years old on the Date of Joining';
  end if;
  if new.aadhaar_number is null or new.aadhaar_number !~ '^[0-9]{12}$' then
    raise exception 'A valid 12-digit Aadhaar number is required';
  end if;
  if new.pan_number is null or upper(new.pan_number) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then
    raise exception 'A valid PAN number is required';
  end if;
  return new;
end;
$$;

drop trigger if exists vvhr_onboarding_age_kyc_guard on public.vvhr_onboarding_requests;
create trigger vvhr_onboarding_age_kyc_guard
before insert or update of date_of_birth, joining_date, aadhaar_number, pan_number
on public.vvhr_onboarding_requests
for each row execute function public.vvhr_validate_onboarding_age();


-- Keep approval authorization aligned with the integrated OMS Admin/HR roles.
-- Aadhaar/PAN values are transferred to the employee master only after HR verification.
create or replace function public.vvhr_approve_onboarding(
  p_request_id uuid,
  p_hr_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_req public.vvhr_onboarding_requests%rowtype;
  v_employee_id uuid;
  v_employee_code text;
  v_doc_key text;
  v_doc jsonb;
  v_required text[] := array['aadhaar_front','aadhaar_back','pan_card','bank_proof','resume','joining_form'];
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.vvhr_can_manage_hr() then raise exception 'Admin or HR access required to approve onboarding'; end if;

  select * into v_req from public.vvhr_onboarding_requests where id=p_request_id for update;
  if not found then raise exception 'Onboarding request not found'; end if;
  if v_req.status='rejected' then raise exception 'Rejected onboarding request cannot be approved'; end if;
  if v_req.employee_id is not null then return v_req.employee_id; end if;
  if v_req.status='approved' then raise exception 'Request is marked approved but has no linked employee; contact administrator'; end if;

  if v_req.date_of_birth is null or v_req.joining_date is null
     or v_req.date_of_birth > (v_req.joining_date - interval '18 years')::date then
    raise exception 'Employee must be at least 18 years old on the Date of Joining';
  end if;
  if v_req.aadhaar_number !~ '^[0-9]{12}$' then raise exception 'Valid Aadhaar number is required'; end if;
  if upper(v_req.pan_number) !~ '^[A-Z]{5}[0-9]{4}[A-Z]$' then raise exception 'Valid PAN number is required'; end if;

  foreach v_doc_key in array v_required loop
    v_doc := coalesce(v_req.document_metadata->v_doc_key,'{}'::jsonb);
    if v_doc->>'verification_status' is distinct from 'verified'
       or nullif(v_doc->>'storage_path','') is null then
      raise exception 'Required document % is not verified or has no uploaded file',v_doc_key;
    end if;
  end loop;
  if coalesce(v_req.bank_account_name,'')='' or v_req.bank_account_number !~ '^[0-9]{6,20}$'
     or v_req.bank_ifsc !~ '^[A-Z]{4}0[A-Z0-9]{6}$' then
    raise exception 'Valid bank account holder name, account number and IFSC are required before approval';
  end if;

  v_employee_code := 'VV-EMP-'||floor(extract(epoch from clock_timestamp())*1000)::bigint::text;
  insert into public.vvhr_employees(
    employee_code,full_name,mobile,email,date_of_birth,gender,address,designation,department,joining_date,
    employment_status,monthly_fixed_salary,bank_account_name,bank_account_number,bank_ifsc,pan_number,aadhaar_number,
    emergency_contact_name,emergency_contact_relationship,emergency_contact_mobile,emergency_contact_alt_mobile,notes
  ) values (
    v_employee_code,v_req.full_name,v_req.mobile,v_req.email,v_req.date_of_birth,v_req.gender,v_req.address,
    v_req.designation,v_req.department,v_req.joining_date,'active',v_req.monthly_fixed_salary,
    v_req.bank_account_name,v_req.bank_account_number,v_req.bank_ifsc,upper(v_req.pan_number),v_req.aadhaar_number,
    v_req.emergency_contact_name,v_req.emergency_contact_relationship,v_req.emergency_contact_mobile,
    v_req.emergency_contact_alt_mobile,nullif(concat_ws(E'\\n',nullif(v_req.hr_remarks,''),nullif(v_req.review_notes,'')),'')
  ) returning id into v_employee_id;

  for v_doc_key,v_doc in select key,value from jsonb_each(coalesce(v_req.document_metadata,'{}'::jsonb)) loop
    if nullif(v_doc->>'storage_path','') is not null then
      insert into public.vvhr_employee_documents(employee_id,document_type,file_name,storage_path)
      values(v_employee_id,v_doc_key,coalesce(nullif(v_doc->>'file_name',''),v_doc_key),v_doc->>'storage_path');
    end if;
  end loop;

  update public.vvhr_onboarding_requests
  set status='approved',employee_id=v_employee_id,reviewed_by=v_uid,reviewed_at=now(),
      hr_remarks=coalesce(p_hr_remarks,hr_remarks),updated_at=now()
  where id=p_request_id;
  return v_employee_id;
end;
$function$;
