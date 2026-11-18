-- Draft extension for stale provisioning recovery. Review before applying.
alter table public.vvhr_employees
  add column if not exists oms_provisioning_started_at timestamptz;
