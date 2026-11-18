-- Vermi Veda HR onboarding workflow (draft migration; review before applying)
-- Employee code is generated only when HR approves onboarding.
-- KYC/bank documents are stored in a private Storage bucket.

create table if not exists public.vvhr_onboarding_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null,
  email text,
  date_of_birth date,
  gender text,
  address text,
  joining_date date not null,
  department text,
  designation text,
  monthly_fixed_salary numeric(12,2) not null default 0 check (monthly_fixed_salary >= 0),
  emergency_contact_name text not null,
  emergency_contact_relationship text,
  emergency_contact_mobile text not null,
  emergency_contact_alt_mobile text,
  aadhaar_number text,
  pan_number text,
  bank_account_name text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  status text not null default 'under_verification'
    check (status in ('draft','documents_pending','under_verification','rejected','approved','active')),
  document_metadata jsonb not null default '{}'::jsonb,
  hr_remarks text,
  employee_id uuid references public.vvhr_employees(id),
  approved_by uuid,
  approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vvhr_onboarding_requests enable row level security;

drop policy if exists "vvhr onboarding admin access" on public.vvhr_onboarding_requests;
create policy "vvhr onboarding admin access"
on public.vvhr_onboarding_requests
for all to authenticated
using (
  exists (select 1 from public.vvhr_user_profiles p
          where p.user_id = auth.uid() and p.role = 'admin')
)
with check (
  exists (select 1 from public.vvhr_user_profiles p
          where p.user_id = auth.uid() and p.role = 'admin')
);

-- Private bucket: no public access.
insert into storage.buckets (id, name, public)
values ('vvhr-employee-documents', 'vvhr-employee-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "vvhr private docs admin access" on storage.objects;
create policy "vvhr private docs admin access"
on storage.objects
for all to authenticated
using (
  bucket_id = 'vvhr-employee-documents'
  and exists (select 1 from public.vvhr_user_profiles p
              where p.user_id = auth.uid() and p.role = 'admin')
)
with check (
  bucket_id = 'vvhr-employee-documents'
  and exists (select 1 from public.vvhr_user_profiles p
              where p.user_id = auth.uid() and p.role = 'admin')
);

create index if not exists vvhr_onboarding_status_idx
  on public.vvhr_onboarding_requests(status);
create index if not exists vvhr_onboarding_created_idx
  on public.vvhr_onboarding_requests(created_at desc);

-- Align the existing employee-code sequence to current VV codes.
-- This does not create a second trigger; Phase 1 already defines the code trigger.
do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(employee_code from 3)::bigint), 0)
    into v_max
    from public.vvhr_employees
    where employee_code ~ '^VV[0-9]+$';

  if v_max = 0 then
    perform setval('public.vvhr_employee_code_seq', 1, false);
  else
    perform setval('public.vvhr_employee_code_seq', v_max, true);
  end if;
end;
$$;

-- Admin-only approval: locks the request, verifies required docs, inserts employee,
-- copies private document metadata, and marks the request approved atomically.
create or replace function public.vvhr_approve_onboarding(
  p_request_id uuid,
  p_hr_remarks text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_request public.vvhr_onboarding_requests%rowtype;
  v_employee_id uuid;
  v_doc_key text;
  v_doc jsonb;
  v_required text[] := array['aadhaar_front','aadhaar_back','pan_card','bank_proof','employee_photo'];
  v_all_docs text[] := array['aadhaar_front','aadhaar_back','pan_card','bank_proof','employee_photo','resume'];
begin
  if not exists (
    select 1 from public.vvhr_user_profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'HR admin permission required';
  end if;

  select * into v_request
  from public.vvhr_onboarding_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Onboarding request not found'; end if;
  if v_request.status = 'approved' or v_request.employee_id is not null then
    raise exception 'This registration has already been approved';
  end if;
  if v_request.status = 'rejected' then
    raise exception 'Rejected registration cannot be approved';
  end if;

  foreach v_doc_key in array v_required loop
    v_doc := coalesce(v_request.document_metadata -> v_doc_key, '{}'::jsonb);
    if coalesce(v_doc->>'storage_path','') = ''
       or coalesce(v_doc->>'verification_status','') <> 'verified' then
      raise exception 'Required document % is missing or not verified', v_doc_key;
    end if;
  end loop;

  insert into public.vvhr_employees (
    full_name, mobile, email, date_of_birth, address, designation,
    department, joining_date, employment_status, monthly_fixed_salary,
    bank_account_name, bank_account_number, bank_ifsc, pan_number, notes
  ) values (
    v_request.full_name, v_request.mobile, v_request.email,
    v_request.date_of_birth, v_request.address, v_request.designation,
    v_request.department, v_request.joining_date, 'active',
    v_request.monthly_fixed_salary, v_request.bank_account_name,
    v_request.bank_account_number, v_request.bank_ifsc, v_request.pan_number,
    'Created from onboarding approval. ' || coalesce(v_request.hr_remarks, '')
  )
  returning id into v_employee_id;

  foreach v_doc_key in array v_all_docs loop
    v_doc := v_request.document_metadata -> v_doc_key;
    if v_doc is not null and coalesce(v_doc->>'storage_path','') <> '' then
      insert into public.vvhr_employee_documents (
        employee_id, document_type, file_name, storage_path, uploaded_at
      ) values (
        v_employee_id, v_doc_key, coalesce(v_doc->>'file_name', v_doc_key),
        v_doc->>'storage_path', coalesce((v_doc->>'uploaded_at')::timestamptz, now())
      );
    end if;
  end loop;

  update public.vvhr_onboarding_requests
  set status = 'approved',
      employee_id = v_employee_id,
      approved_by = auth.uid(),
      approved_at = now(),
      hr_remarks = coalesce(p_hr_remarks, hr_remarks),
      updated_at = now()
  where id = p_request_id;

  return v_employee_id;
end;
$$;

revoke all on function public.vvhr_approve_onboarding(uuid,text) from public;
grant execute on function public.vvhr_approve_onboarding(uuid,text) to authenticated;
