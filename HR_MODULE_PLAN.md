# HR & Payroll Module Plan

Branch: feature/hr-module
Scope: Add HR modules to Vermi Veda ERP without changing existing OMS functionality.

## Phase 1 — Employee Management
- Employee code auto-generation (VV0001, VV0002...)
- Personal/contact details, joining date, department, designation
- Employment status: Active, Inactive, Resigned
- Salary structure and bank details (access restricted)
- Document upload checklist (Aadhaar, PAN, resume, joining form)
- Search, filters, and CSV export

## Phase 2 — Attendance & Leave
- Daily attendance: Present, Absent, Half Day, Leave
- Leave types, requests, approval, balances
- Monthly attendance summary and export

## Phase 3 — Payroll
- Fixed salary, incentives, overtime, deductions, advances
- Formula: Net Pay = Earnings - Deductions
- Monthly payroll preview, HR verification, admin approval
- Lock approved payroll to prevent accidental edits

## Phase 4 — Payslip & MIS
- Individual payslip PDF
- Payroll summary and employee-wise MIS
- Month-wise reports and export

## Safety / implementation
- Develop on feature/hr-module branch only.
- Do not modify existing OMS orders, stock, delivery, or payment data.
- Restrict access to HR, payroll, and bank details.
- Validate calculations and test before merging/deploying.
- Database schema and migrations to be reviewed before applying to production.
