# Validation Plan — WO-004

## Scope

Validate that the frontend is again styled and interactive after the WO-004 regression fix.

---

## Required sync inputs

- implementation report
- files changed
- dev/build/test outputs

---

## Validation steps

### 1. Start dev workflow

```bash
cd adi-webapp
npm run dev
```

Expected:
- web workspace stays alive
- server workspace stays alive

### 2. Validate frontend in browser

Open:
- `http://localhost:5173`

Expected:
- page is styled
- React UI renders correctly
- no raw unstyled fallback page

### 3. Validate main UI areas

Check:
- Dashboard
- Import Wizard
- Job History
- Settings

Expected:
- navigation works
- buttons/inputs respond
- visible styling is present

### 4. Validate backend

Open:
- `http://localhost:8787/api/health`

Expected:
- health payload returned successfully

### 5. Regression checks

```bash
npm run build
npm run test
```

Expected:
- build passes
- tests pass, or any remaining failure is explicitly documented as environment-limited and unrelated to the new fix

---

## Verdict rules

### APPROVED
- frontend is styled and interactive
- runtime remains unblocked
- no major regressions introduced

### APPROVED WITH NOTES
- core styling/JS restored, with minor non-blocking issues remaining

### REJECTED
- frontend still appears unstyled
- JS still broken
- runtime recovery regresses
- build/test regress critically because of the fix
