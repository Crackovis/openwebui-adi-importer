# Validation Plan: WO-002

## Scope

Validate the fix for the inaccessible frontend dev server at `http://localhost:5173`.

---

## Required Evidence From Implementation Sync

- Root cause summary
- Files changed
- Dev command output
- Whether docs changed

---

## Validation Steps

### 1. Root workflow

From `adi-webapp/`:

```bash
npm run dev
```

Expected:
- root workflow starts
- server process starts
- web process starts
- no immediate web workspace exit

### 2. Frontend reachability

Open:
- `http://localhost:5173`

Expected:
- page responds
- no connection refusal / timeout
- app shell renders

### 3. Backend sanity check

Open:
- `http://localhost:8787/api/health`

Expected:
- `ok: true`
- health payload returned

### 4. Web-only fallback check

From `adi-webapp/`:

```bash
npm run dev --workspace=web
```

Expected:
- frontend reachable directly
- confirms whether root orchestration was involved

### 5. Regression checks

If files affecting scripts/config changed:

```bash
npm run build
npm run test
```

Expected:
- still pass or only pre-existing unrelated failures are reported clearly

---

## Verdict Rules

### APPROVED
- `http://localhost:5173` is reachable
- fix is minimal
- monorepo workflow still works

### APPROVED WITH NOTES
- app becomes reachable, but docs/logging/troubleshooting still need minor cleanup

### REJECTED
- frontend still inaccessible
- fix relies on undocumented workaround
- regression introduced in dev/build/test flow

---

## If Reproduction Still Fails

Ask the user for:
- full terminal output of `npm run dev`
- full terminal output of `npm run dev --workspace=web`
- `netstat -ano | findstr :5173`
- browser error screenshot
- browser console errors
