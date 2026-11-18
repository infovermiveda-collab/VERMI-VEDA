# Phase 1 — Employee Management (HR)

This is a separate HR module draft for the existing Vermi Veda OMS. It does not alter OMS orders, inventory, deliveries, payments, or profiles.

## Files
- `hr/employee-module.js`: Employee CRUD UI and CSV export; expects an existing Supabase client `sb` and a mount root.
- `hr/employee-module.css`: styles for the module.
- `hr/schema-phase1.sql`: proposed database schema and employee code trigger.

## Status
This is a development-only module on `feature/hr-module`. It is not integrated into the main OMS navigation and is not deployed.

## Integration
Example:
```js
import { renderEmployeeModule } from './hr/employee-module.js';
renderEmployeeModule(document.querySelector('#content'), sb, { canManage: true });
```
Do not integrate until authentication role checks and Supabase Row Level Security (RLS) policies are reviewed. The current draft deliberately excludes Aadhaar, PAN, and bank account storage.

## Employee fields
Employee ID (VV0001 style), name, mobile, joining date, department, designation, monthly salary, status, address and notes.
