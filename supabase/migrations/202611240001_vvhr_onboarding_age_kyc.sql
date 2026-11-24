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
