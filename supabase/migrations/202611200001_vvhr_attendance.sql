-- Vermi Veda HR Attendance — extend the existing Phase 1 attendance table.
-- Existing rows, employee/date unique key, and current RLS policies are preserved.
alter table public.vvhr_attendance
  add column if not exists check_in time,
  add column if not exists check_out time,
  add column if not exists late_minutes integer not null default 0,
  add column if not exists overtime_minutes integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname='vvhr_attendance_late_minutes_check' and conrelid='public.vvhr_attendance'::regclass) then
    alter table public.vvhr_attendance add constraint vvhr_attendance_late_minutes_check check (late_minutes >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname='vvhr_attendance_overtime_minutes_check' and conrelid='public.vvhr_attendance'::regclass) then
    alter table public.vvhr_attendance add constraint vvhr_attendance_overtime_minutes_check check (overtime_minutes >= 0);
  end if;
end $$;

-- Public schema tables are no longer automatically exposed through the Data API
-- on newer Supabase projects. RLS remains enabled; existing policies control rows.
grant select, insert, update on table public.vvhr_attendance to authenticated;
