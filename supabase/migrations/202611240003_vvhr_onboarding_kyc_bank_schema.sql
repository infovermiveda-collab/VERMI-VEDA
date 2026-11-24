alter table public.vvhr_onboarding_requests add column if not exists aadhaar_number text, add column if not exists pan_number text, add column if not exists bank_name text;
alter table public.vvhr_employees add column if not exists aadhaar_number text, add column if not exists bank_name text;
notify pgrst, 'reload schema';