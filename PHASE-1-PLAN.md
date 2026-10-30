# Vermi Veda OMS — Phase 1 Plan
Date: 2026-10-30
Base: phase-0/baseline-2026-10-30
Working branch: phase-1/ui-refresh-2026-10-30

## Objective
Deliver a consistent, responsive Admin and Field Executive experience without changing business rules, database schema, authentication, existing records, or production configuration.

## Baseline findings
- The OMS is currently a single-page application in index.html.
- The file already contains a modern green/white visual refresh CSS layer, responsive breakpoints, dashboard cards, table styling, and modal styling.
- Existing tested workflows to preserve: Admin login, FE account creation, order creation, product/inventory addition, FE login, delivery status update, CSV export, Admin order editing, invoice generation, and WhatsApp sharing.
- The Preview build is configured to use the isolated test Supabase project. Production Supabase credentials and production domain must not be changed.

## Phase 1 workstreams
1. Audit existing page/module markup and CSS before editing; identify duplicated/overridden styles.
2. Standardize Admin navigation, page headers, spacing, cards, forms, tables, modal/dialogs, buttons, and status chips.
3. Improve responsive navigation and layouts for mobile/tablet, especially FE delivery and payment workflows.
4. Standardize search/filter controls and table empty/loading/error states where safely possible.
5. Improve accessibility basics: visible focus, labels, button semantics, contrast, and touch target sizing.
6. Preserve all existing Supabase queries, table names, RPCs, Edge Function calls, invoice markup, WhatsApp sharing, and order/payment calculations.

## Out of scope for Phase 1
- No database migrations or schema changes.
- No changes to Auth, RLS, Edge Functions, payment rules, inventory calculations, or order lifecycle.
- No production deployment, domain change, or merge to main.
- No destructive changes or deletion of existing modules/data.

## Acceptance checks
- Admin and FE login still work on Preview.
- Admin can create/edit orders and products; FE can view assigned work and update delivery.
- Invoice and WhatsApp sharing remain functional.
- CSV export works.
- Existing payment values and order totals remain unchanged by the UI refresh.
- Desktop, tablet, and mobile layouts are usable; no horizontal page overflow (table containers may scroll horizontally).
- Console has no new runtime errors.

## Release gate
Phase 1 is complete only after the above regression checks pass on Preview and the user approves the Preview result. Production remains untouched until a separate explicit rollout approval.
