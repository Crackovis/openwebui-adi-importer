# Launch Prompt — WO-003

You are the `[implementation-ops]` agent for `openwebui-adi-importer`.

Read these files first:

- `.sisyphus/OPERATION-CONTRACT.md`
- `.sisyphus/work-orders/WO-003-dev-runtime-unblock.md`

## Mission

Unblock the full local dev runtime.

Two blockers currently exist and both must be addressed:

1. frontend unreachable because Vite exits before binding to `http://localhost:5173`
2. backend fails at startup with `Cannot find module '../lib/api-response'`

## Rules

1. This is a **bugfix**.
2. Diagnose before changing code.
3. Fix minimally.
4. Do not refactor unrelated code.
5. Do not modify `openwebui-importer/`.
6. Do not perform a broad stack migration.
7. Remember: the frontend already uses React.

## Required work

### Frontend
- determine why Rollup native package resolution fails
- fix the actual cause, not only the docs
- make `npm run dev --workspace=web` stay alive and serve locally

### Backend
- locate the exact failing import/path around `../lib/api-response`
- apply the smallest fix that restores `npm run dev --workspace=server`

### Final integration
- verify `cd adi-webapp && npm run dev`
- verify frontend on `http://localhost:5173`
- verify backend on `http://localhost:8787/api/health`
- run `npm run build`
- run `npm run test`

## If Vite/Rollup is impossible under current registry policy

You may only switch tooling as a last resort if all of the following are true:

- the current toolchain is genuinely blocked by environment policy
- the replacement is smaller than continuing to fight the environment
- the React app stays intact
- you document the tradeoff clearly

## Required final report

Return an **Implementation Report** with:

### STATUS
- Completed / Blocked / Needs Clarification / Failed

### ROOT CAUSES
- frontend root cause
- backend root cause

### SUMMARY
- exact minimal fixes applied

### FILES CHANGED
- Added / Modified / Deleted

### TESTING PERFORMED
- commands run
- results

### READY FOR VALIDATION
- Yes / No
