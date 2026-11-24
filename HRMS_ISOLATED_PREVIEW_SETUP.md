# Vermi Veda HRMS — Isolated Preview

## Safety boundary
- Branch: `hr-module-dev`
- Entry page: `/hr-preview.html`
- Database: `vermi-veda-hrms-test` (Mumbai)
- Project ref: `eljfrkvwhggxeaudmvsw`
- HR tables are prefixed `vvhr_`; no OMS tables are created or queried by this preview entrypoint.
- Never deploy this preview to Production or merge its database migrations into the OMS project without explicit approval.

## Database
The isolated test project contains the HR schema, RLS policies, private employee-document bucket, onboarding approval RPC, employee account provisioning, access control, and offer-letter functions.

## Employee onboarding rules
- Date of birth is mandatory and must show age 18 or above on joining date.
- Aadhaar front/back, PAN, bank proof, resume, and joining form must be uploaded and individually verified by HR.
- Employee photo is optional.
- Direct employee-master inserts are blocked. HR approval creates the employee record and issues the next `VV001`-style ECode.
- Use dummy data and dummy documents only in Preview.

## First HR Admin account
1. Create the first user in Supabase Dashboard → Authentication → Users → Add user.
2. Copy that Auth user's UUID.
3. In SQL Editor for this isolated project only, run:
   `insert into public.vvhr_user_profiles(user_id,full_name,role,active) values ('AUTH-USER-UUID','HR Admin','admin',true);`
4. Sign in at the HR Preview page with that email/password.

Do not use a service-role key in browser code. The browser uses only the publishable key. Edge Functions use the project's server-side service role environment variable.
