-- Vermi Veda HRMS Leave Management
create table if not exists public.vvhr_leave_requests (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.vvhr_employees(id) on delete cascade,
 leave_type text not null check (leave_type in ('casual','sick','earned','unpaid','other')),
 start_date date not null,
 end_date date not null,
 requested_days numeric(6,2) not null default 0 check (requested_days > 0),
 reason text not null,
 status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
 requested_by uuid not null references auth.users(id),
 reviewed_by uuid references auth.users(id),
 reviewed_at timestamptz,
 reviewer_remarks text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint vvhr_leave_dates_valid check (end_date >= start_date),
 constraint vvhr_leave_single_year check (extract(year from start_date) = extract(year from end_date))
);
create table if not exists public.vvhr_leave_balances (
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.vvhr_employees(id) on delete cascade,
 leave_year integer not null,
 leave_type text not null check (leave_type in ('casual','sick','earned','unpaid','other')),
 annual_quota numeric(6,2) not null default 0 check (annual_quota >= 0),
 carry_forward numeric(6,2) not null default 0 check (carry_forward >= 0),
 adjustment_days numeric(6,2) not null default 0,
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint vvhr_leave_balance_unique unique (employee_id, leave_year, leave_type)
);
create index if not exists vvhr_leave_requests_employee_dates_idx on public.vvhr_leave_requests(employee_id, start_date, end_date);
create index if not exists vvhr_leave_requests_status_idx on public.vvhr_leave_requests(status, start_date);
create index if not exists vvhr_leave_balances_employee_year_idx on public.vvhr_leave_balances(employee_id, leave_year);
create or replace function public.vvhr_prepare_leave_request()
returns trigger language plpgsql set search_path = public as $$
declare overlap_count integer;
begin
 if new.end_date < new.start_date then raise exception 'End date cannot be earlier than start date'; end if;
 if extract(year from new.start_date) <> extract(year from new.end_date) then raise exception 'A leave request must be within one calendar year'; end if;
 select count(*) into new.requested_days from generate_series(new.start_date::timestamp,new.end_date::timestamp,interval '1 day') as days(day) where extract(dow from day) <> 0;
 if new.requested_days <= 0 then raise exception 'Selected dates contain no working days (Sunday is weekly off)'; end if;
 if new.status in ('pending','approved') then
  select count(*) into overlap_count from public.vvhr_leave_requests r where r.employee_id=new.employee_id and r.id is distinct from new.id and r.status in ('pending','approved') and daterange(r.start_date,r.end_date,'[]') && daterange(new.start_date,new.end_date,'[]');
  if overlap_count > 0 then raise exception 'This employee already has a pending or approved leave in the selected date range'; end if;
 end if;
 new.updated_at:=now(); return new;
end;
$$;
drop trigger if exists vvhr_leave_requests_prepare on public.vvhr_leave_requests;
create trigger vvhr_leave_requests_prepare before insert or update of employee_id,start_date,end_date,status on public.vvhr_leave_requests for each row execute function public.vvhr_prepare_leave_request();
create or replace function public.vvhr_touch_leave_balance()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at:=now(); return new; end;
$$;
drop trigger if exists vvhr_leave_balances_touch on public.vvhr_leave_balances;
create trigger vvhr_leave_balances_touch before update on public.vvhr_leave_balances for each row execute function public.vvhr_touch_leave_balance();
alter table public.vvhr_leave_requests enable row level security;
alter table public.vvhr_leave_balances enable row level security;
drop policy if exists "vvhr leave requests admin all" on public.vvhr_leave_requests;
create policy "vvhr leave requests admin all" on public.vvhr_leave_requests for all to authenticated using (exists(select 1 from public.vvhr_user_profiles p where p.user_id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.vvhr_user_profiles p where p.user_id=auth.uid() and p.role='admin'));
drop policy if exists "vvhr leave requests read self" on public.vvhr_leave_requests;
create policy "vvhr leave requests read self" on public.vvhr_leave_requests for select to authenticated using (exists(select 1 from public.vvhr_employees e where e.id=employee_id and e.auth_user_id=auth.uid()));
drop policy if exists "vvhr leave requests insert self" on public.vvhr_leave_requests;
create policy "vvhr leave requests insert self" on public.vvhr_leave_requests for insert to authenticated with check (status='pending' and requested_by=auth.uid() and exists(select 1 from public.vvhr_employees e where e.id=employee_id and e.auth_user_id=auth.uid()));
drop policy if exists "vvhr leave balances admin all" on public.vvhr_leave_balances;
create policy "vvhr leave balances admin all" on public.vvhr_leave_balances for all to authenticated using (exists(select 1 from public.vvhr_user_profiles p where p.user_id=auth.uid() and p.role='admin')) with check (exists(select 1 from public.vvhr_user_profiles p where p.user_id=auth.uid() and p.role='admin'));
drop policy if exists "vvhr leave balances read self" on public.vvhr_leave_balances;
create policy "vvhr leave balances read self" on public.vvhr_leave_balances for select to authenticated using (exists(select 1 from public.vvhr_employees e where e.id=employee_id and e.auth_user_id=auth.uid()));
grant select,insert,update,delete on public.vvhr_leave_requests to authenticated;
grant select,insert,update,delete on public.vvhr_leave_balances to authenticated;
