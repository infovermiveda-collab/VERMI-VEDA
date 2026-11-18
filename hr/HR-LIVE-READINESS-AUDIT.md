# HR Module — Live Readiness Audit (Read-only checks)

Date: 2026-11-18
Branch: feature/hr-module
Supabase project: ezozfdekhjdklioelgno

## Confirmed live database observations
- Employee codes: no duplicates found in the read-only check.
- Employee codes: no blank/null values found in the read-only check.
- Employee-code trigger: not present in live DB at the time of check.
- Existing RLS policies for `vvhr_employees` and `vvhr_employee_documents` currently include Admin-only management policies and employee self-read policies.
- No live onboarding request table/policies were confirmed in this check.
- HR/Admin policy expansion exists in draft migration only; it is not applied.

## Release blockers
1. Apply/review onboarding migration and employee-code trigger only after approval.
2. Confirm HR profiles/roles and policy expansion. Do not assume HR role is active in live DB.
3. Confirm private document bucket and storage policies after migration.
4. Test approval, employee creation, provisioning, recovery, and forced password-change end-to-end in a safe environment.
5. Confirm no production deployment until test evidence and rollback plan are available.

## Safe scope
This audit used read-only SQL checks. No database writes, migration application, or deployment were performed.

## Additional storage check (read-only)
- Confirmed no `vvhr-employee-documents` bucket exists in live Storage.
- No matching `vvhr` Storage object policies were returned.
- This is a release blocker for onboarding document upload/preview. The migration draft creates the private bucket and policies; these remain unapplied.

## Additional onboarding privacy review
- Registration UI collects Aadhaar, PAN, and bank-account data; these fields are stored in onboarding request records by the current draft flow.
- Treat this data as highly sensitive. Restrict table access to authorized HR/Admin, minimize retention, and review encryption/access logging before enabling the workflow.
- No live activation recommended until private Storage bucket, policies, role/RLS checks, and privacy controls are reviewed.
