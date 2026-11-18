-- Vermi Veda HR onboarding workflow (draft migration; review before applying)
-- Employee code is intentionally NOT created at registration.
-- Documents must be stored in a private Supabase Storage bucket.

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
  status text not null default 'documents_pending'
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

-- Restrict onboarding records to authenticated HR/admin profiles.
drop policy if exists "vvhr onboarding admin access" on public.vvhr_onboarding_requests;
create policy "vvhr onboarding admin access"
on public.vvhr_onboarding_requests
for all to authenticated
using (exists (
  select 1 from public.vvhr_user_profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
))
with check (exists (
  select 1 from public.vvhr_user_profiles p
  where p.user_id = auth.uid() and p.role = 'admin'
));

-- Private document bucket. No public access.
insert into storage.buckets (id, name, public)
values ('vvhr-employee-documents', 'vvhr-employee-documents', false)
on conflict (id) do update set public = false;

-- Only authenticated admin/HR profiles may access files in this bucket.
drop policy if exists "vvhr private docs admin access" on storage.objects;
create policy "vvhr private docs admin access"
on storage.objects
for all to authenticated
using (
  bucket_id = 'vvhr-employee-documents'
  and exists (
    select 1 from public.vvhr_user_profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  bucket_id = 'vvhr-employee-documents'
  and exists (
    select 1 from public.vvhr_user_profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  )
);

create index if not exists vvhr_onboarding_status_idx
  on public.vvhr_onboarding_requests(status);
create index if not exists vvhr_onboarding_created_idx
  on public.vvhr_onboarding_requests(created_at desc);
