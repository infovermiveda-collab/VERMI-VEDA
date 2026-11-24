-- Keep explicit exit date while retaining last_working_date for existing reports.
alter table public.vvhr_employees add column if not exists exit_date date;
