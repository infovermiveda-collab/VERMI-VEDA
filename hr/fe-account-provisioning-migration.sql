-- Draft migration: HR onboarding -> OMS FE account provisioning
-- REVIEW ONLY. Do not apply to production until frontend forced-password flow is merged and tested.

alter table public.oms_profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.vvhr_employees
  add column if not exists oms_provisioning_status text not null default 'not_started'
    check (oms_provisioning_status in ('not_started','pending','success','failed')),
  add column if not exists oms_provisioning_error text,
  add column if not exists oms_provisioning_attempts integer not null default 0,
  add column if not exists oms_provisioned_at timestamptz;

-- Onboarding approval should create the employee master record first.
-- FE account provisioning runs as a separate Edge Function so failures can be retried
-- without losing the approved joining record.

-- First-login password change completion. The caller can only clear their own flag.
create or replace function public.oms_complete_password_change()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  update public.oms_profiles
     set must_change_password = false
   where user_id = auth.uid();
  if not found then
    raise exception 'OMS profile not found';
  end if;
end;
$$;
revoke all on function public.oms_complete_password_change() from public;
grant execute on function public.oms_complete_password_change() to authenticated;
