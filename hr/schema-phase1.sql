-- Vermi Veda HR: Employee Management (Phase 1)
-- Review and apply in Supabase SQL Editor only after confirming the HR schema.
create table if not exists public.vvhr_employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text unique,
  full_name text not null,
  mobile text not null,
  joining_date date not null,
  department text,
  designation text,
  monthly_salary numeric(12,2) not null default 0 check (monthly_salary >= 0),
  status text not null default 'Active' check (status in ('Active','Inactive','Resigned')),
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create sequence if not exists public.vvhr_employee_code_seq start 1;
create or replace function public.vvhr_set_employee_code()
returns trigger language plpgsql as $$
begin
  if new.employee_code is null or new.employee_code = '' then
    new.employee_code := 'VV' || lpad(nextval('public.vvhr_employee_code_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists vvhr_employee_code_trigger on public.vvhr_employees;
create trigger vvhr_employee_code_trigger
before insert or update on public.vvhr_employees
for each row execute function public.vvhr_set_employee_code();

-- RLS is intentionally not enabled in this draft until HR/admin roles and policies are finalized.
-- Do not store Aadhaar/PAN/bank details in this initial employee table.
