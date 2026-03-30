# Launch Prompt — WO-004

You are the `[implementation-ops]` agent for `openwebui-adi-importer`.

Read first:

- `.sisyphus/OPERATION-CONTRACT.md`
- `.sisyphus/work-orders/WO-004-restore-frontend-assets-and-interactivity.md`

## Mission

Fix the frontend regression introduced after WO-003.

Current state:
- frontend URL opens
- but the user sees missing styling and broken JS behavior

Your task is to restore a **properly styled, interactive React app** while preserving the dev runtime recovery.

## Rules

1. This is a **regression bugfix**.
2. Diagnose before changing code.
3. Fix minimally.
4. Do not refactor unrelated code.
5. Do not modify `openwebui-importer/`.
6. Do not perform a broad stack migration.

## Required investigation

Determine whether the regression comes from:

- missing CSS bundle generation
- CSS generated but not linked/served
- JS bundle not loaded
- HTML entry pointing at the wrong assets
- custom fallback dev server serving HTML only
- insufficient SPA/static asset behavior in the fallback tooling

## Required final state

- `cd adi-webapp && npm run dev` works
- `http://localhost:5173` is reachable
- frontend is styled
- frontend interactions work
- backend still works at `http://localhost:8787/api/health`
- `npm run build` passes
- `npm run test` passes or any remaining failure is clearly isolated

## Required final report

Return an **Implementation Report** with:

### STATUS
- Completed / Blocked / Needs Clarification / Failed

### ROOT CAUSE
- exact regression cause

### SUMMARY
- minimal fix applied

### FILES CHANGED
- Added / Modified / Deleted

### TESTING PERFORMED
- commands run
- browser/runtime checks
- build/test result

### READY FOR VALIDATION
- Yes / No
