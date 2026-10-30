# Vermi Veda OMS — Phase 1 Preview Test Report
Date: 2026-10-30
Branch: phase-1/ui-refresh-2026-10-30
Environment: Vercel Preview + isolated Supabase test project (gymgagajnoaerllwxyki)

## Result
User confirmed Phase 1 Preview testing passed for the modules listed below.

## Verified modules
- Admin dashboard: six KPI cards and quick actions.
- Orders: search, delivery and payment filters, payment collection and outstanding balance display.
- Field Executive: login, assigned order visibility and mobile delivery worklist.
- Inventory: stock deduction on delivery, stock movement logging, and duplicate-deduction protection.
- Invoices: generation.
- WhatsApp: sharing.
- Reports: order, delivery, sales, collection, outstanding, estimated net, FE performance and payment status summaries.
- CSV report download: user confirmed successful.

## Inventory reconciliation performed in test database
Two previously delivered test orders were found with stock_deducted=false. Both were reconciled once:
- VV-78624034: -1 unit
- VV-80847585: -1 unit
Test product stock changed from 100 to 98; both orders now have stock_deducted=true and two stock log entries exist.

## Important limitations / release conditions
- This is a Preview test result, not production sign-off.
- Production domain, production Supabase project and main branch were not changed as part of Phase 1.
- No verified production backup/restore test is recorded here.
- Do not merge or deploy to production until a separate release plan, verified production backup, environment-variable review, migration review, and explicit user approval are completed.
- Estimated net profit is indicative only; it uses current product cost and recorded expenses and excludes taxes/unrecorded costs. Verify unit costs and expense completeness before business decisions.
- Historical delivered orders in production must not be bulk-adjusted without a separately reviewed reconciliation.

## Recommendation
Phase 1 Preview acceptance: PASS (user-confirmed).
Next milestone: prepare a controlled production rollout checklist and backup/restore validation. Keep production untouched until explicit approval.
