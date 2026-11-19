create or replace function public.vvhr_admin_link_employee_account(p_employee_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare
 existing_user_profile public.vvhr_user_profiles%rowtype;
 target_role text;
 target_active boolean;
 current_employee_user uuid;
 mapped_employee uuid;
begin
 if not exists(select 1 from public.vvhr_user_profiles p where p.user_id=auth.uid() and p.role='admin') then
  raise exception 'Only HRMS admin can link employee accounts';
 end if;
 select role,active into target_role,target_active from public.oms_profiles where user_id=p_user_id;
 if not found or target_role<>'fe' or target_active is distinct from true then
  raise exception 'Select an active Field Executive login account';
 end if;
 select auth_user_id into current_employee_user from public.vvhr_employees where id=p_employee_id and employment_status in ('active','probation');
 if not found then raise exception 'Employee record not found or is inactive'; end if;
 if current_employee_user is not null and current_employee_user<>p_user_id then raise exception 'This employee is already linked to another login'; end if;
 select employee_id into mapped_employee from public.vvhr_user_profiles where user_id=p_user_id;
 if mapped_employee is not null and mapped_employee<>p_employee_id then raise exception 'This login is already linked to another employee'; end if;
 select * into existing_user_profile from public.vvhr_user_profiles where user_id=p_user_id;
 if found and existing_user_profile.role<>'employee' then raise exception 'This login already has a non-employee HRMS role'; end if;
 update public.vvhr_employees set auth_user_id=p_user_id,updated_at=now() where id=p_employee_id;
 insert into public.vvhr_user_profiles(user_id,role,employee_id) values(p_user_id,'employee',p_employee_id)
 on conflict(user_id) do update set role='employee',employee_id=excluded.employee_id;
end;
$$;
revoke all on function public.vvhr_admin_link_employee_account(uuid,uuid) from public;
grant execute on function public.vvhr_admin_link_employee_account(uuid,uuid) to authenticated;
