-- Vermi Veda HR Attendance — Phase 2
-- Apply in Supabase SQL Editor after the HR employee table exists.
create table if not exists public.vvhr_attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.vvhr_employees(id) on delete restrict,
  attendance_date date not null,
  status text not null check (status in ('present','absent','half_day','leave','holiday','week_off')),
  check_in time,
  check_out time,
  late_minutes integer not null default 0 check (late_minutes >= 0),
  overtime_minutes integer not null default 0 check (overtime_minutes >= 0),
  remarks text,
  marked_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vvhr_attendance_employee_date_unique unique (employee_id, attendance_date),
  constraint vvhr_attendance_time_order check (check_in is null or check_out is null or check_out >= check_in)
);

create index if not exists vvhr_attendance_date_idx on public.vvhr_attendance(attendance_date);
create index if not exists vvhr_attendance_employee_date_idx on public.vvhr_attendance(employee_id, attendance_date);

create or replace function public.vvhr_attendance_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vvhr_attendance_updated_at on public.vvhr_attendance;
create trigger vvhr_attendance_updated_at before update on public.vvhr_attendance
for each row execute function public.vvhr_attendance_set_updated_at();

alter table public.vvhr_attendance enable row level security;

drop policy if exists "HR admins can read attendance" on public.vvhr_attendance;
create policy "HR admins can read attendance" on public.vvhr_attendance
for select to authenticated
using (exists (select 1 from public.oms_profiles p where p.user_id = auth.uid() and p.active = true and p.role in ('admin','hr')));

drop policy if exists "HR admins can insert attendance" on public.vvhr_attendance;
create policy "HR admins can insert attendance" on public.vvhr_attendance
for insert to authenticated
with check (exists (select 1 from public.oms_profiles p where p.user_id = auth.uid() and p.active = true and p.role in ('admin','hr')));

drop policy if exists "HR admins can update attendance" on public.vvhr_attendance;
create policy "HR admins can update attendance" on public.vvhr_attendance
for update to authenticated
using (exists (select 1 from public.oms_profiles p where p.user_id = auth.uid() and p.active = true and p.role in ('admin','hr')))
with check (exists (select 1 from public.oms_profiles p where p.user_id = auth.uid() and p.active = true and p.role in ('admin','hr')));

drop policy if exists "HR admins can delete attendance" on public.vvhr_attendance;
create policy "HR admins can delete attendance" on public.vvhr_attendance
for delete to authenticated
using (exists (select 1 from public.oms_profiles p where p.user_id = auth.uid() and p.active = true and p.role in ('admin','hr')));
