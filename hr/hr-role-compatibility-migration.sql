-- Draft only: enable HR role in the two profile tables.
-- Review existing RLS policies before applying; this does not grant HR access to OMS data.

alter table public.oms_profiles drop constraint if exists oms_profiles_role_check;
alter table public.oms_profiles add constraint oms_profiles_role_check
  check (role = any (array['admin'::text,'hr'::text,'fe'::text]));

alter table public.vvhr_user_profiles drop constraint if exists vvhr_user_profiles_role_check;
alter table public.vvhr_user_profiles add constraint vvhr_user_profiles_role_check
  check (role = any (array['admin'::text,'hr'::text,'employee'::text]));

-- HR must be separately assigned to vvhr_user_profiles and oms_profiles.
-- This draft does not automatically grant HR access or create any HR user.
