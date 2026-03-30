# Validation Plan — WO-003

## Scope

Validate that the local monorepo dev runtime is fully restored.

---

## Required sync inputs

- implementation report
- files changed
- command outputs for dev/build/test

---

## Validation steps

### 1. Install

```bash
cd adi-webapp
npm install
```

Expected:
- dependencies install cleanly enough to run local workflow

### 2. Root runtime

```bash
npm run dev
```

Expected:
- server workspace stays alive
- web workspace stays alive
- no immediate crash on either side

### 3. Frontend reachability

Open:
- `http://localhost:5173`

Expected:
- browser connects successfully
- app shell renders

### 4. Backend reachability

Open:
- `http://localhost:8787/api/health`

Expected:
- `ok: true`
- health payload returned

### 5. Workspace isolation checks

```bash
npm run dev --workspace=web
npm run dev --workspace=server
```

Expected:
- each workspace can start on its own

### 6. Regression checks

```bash
npm run build
npm run test
```

Expected:
- pass, or any unrelated failures explicitly identified as pre-existing

---

## Verdict rules

### APPROVED
- root dev workflow works
- frontend and backend are both reachable
- no new regressions introduced

### APPROVED WITH NOTES
- workflow works, but docs or non-blocking cleanup remain

### REJECTED
- either workspace still crashes
- frontend still inaccessible
- backend health still unavailable
- regression introduced in build/test workflow
