## WORK ORDER: WO-004

**Title:** Restore frontend CSS and JS behavior after WO-003 fallback  
**Created:** 2026-03-31  
**Priority:** Critical  
**Estimated Complexity:** Moderate

---

### OBJECTIVE

Fix the frontend regression introduced after WO-003 so that the app is not only reachable, but also fully usable with:

1. styles correctly applied
2. client-side JavaScript working
3. React UI rendering and interactions functioning normally

---

### CONTEXT

**Repository:** `openwebui-adi-importer`  
**App Root:** `adi-webapp/`

**Current known state after WO-003:**
- local dev runtime is reachable again
- `http://localhost:5173` opens
- but the user reports the page lost styling and JS behavior

**Likely change surface from prior fix:**
- custom frontend fallback scripts replaced the previous Vite workflow
- this likely affected asset bundling/serving, HTML entry wiring, CSS loading, or JS bootstrapping

**Important constraint:**
- The goal is **not** a broad frontend migration
- The frontend already uses React
- This is a **bugfix/regression-fix** task on top of WO-003

---

### ACCEPTANCE CRITERIA

#### A. Visual restoration
- [ ] frontend styles are applied again
- [ ] the page is no longer raw/unstyled HTML
- [ ] layout, spacing, chips, forms, tables, and buttons visually match the intended web app presentation

#### B. JS / React restoration
- [ ] frontend JavaScript loads successfully
- [ ] React app bootstraps correctly
- [ ] navigation works
- [ ] page-level interactions work again
- [ ] no blocking browser console errors remain on initial load

#### C. Functional smoke checks
- [ ] Dashboard loads with styled UI
- [ ] Settings page loads and Save interaction is functional
- [ ] Import Wizard loads, advances steps, and interactive controls respond
- [ ] Job History page renders correctly

#### D. Runtime preservation
- [ ] `cd adi-webapp && npm run dev` still works
- [ ] `http://localhost:5173` remains reachable
- [ ] backend remains reachable at `http://localhost:8787/api/health`

#### E. Build safety
- [ ] `npm run build` still passes
- [ ] `npm run test` still passes, or any remaining failure is explicitly isolated as unrelated/environment-limited

---

### CONSTRAINTS

**MUST NOT:**
- modify `openwebui-importer/`
- perform unrelated frontend refactors
- replace the React app architecture wholesale
- regress WO-003 runtime recovery

**MUST:**
- treat this as a regression bugfix
- identify the exact failure mode before fixing
- fix minimally
- preserve current local developer workflow

**SHOULD:**
- prefer restoring correct asset loading/serving over swapping frameworks
- only replace the fallback implementation if it is clearly insufficient for a functional React webapp
- keep any tooling change as small as possible

---

### REQUIRED DIAGNOSIS

The implementation report must explicitly answer:

1. What exactly is missing on load:
   - CSS only
   - JS only
   - both CSS and JS
   - HTML references wrong assets
   - assets build but are not served
   - React bootstraps but CSS pipeline is broken
2. Which file(s) caused the regression?
3. Is the current fallback dev server correctly serving:
   - HTML
   - JS bundle
   - CSS bundle
   - SPA routes/assets
4. What exact minimal change restored normal frontend behavior?

---

### DELIVERABLES

- [ ] frontend regression fixed
- [ ] implementation report with root cause
- [ ] files changed list
- [ ] evidence that CSS and JS both load correctly
- [ ] docs updates only if commands/tooling changed materially

---

### VALIDATION PROTOCOL

Validation will verify:

```bash
cd adi-webapp
npm run dev
```

Then confirm in browser:
- `http://localhost:5173`
- app is styled
- app is interactive

And confirm backend:
- `http://localhost:8787/api/health`

Then run:

```bash
npm run build
npm run test
```

---

### IMPLEMENTATION GUIDANCE

**Recommended order:**

1. Reproduce the regression in browser
2. Inspect HTML entry, JS entry, CSS imports, and custom fallback scripts
3. Determine whether the issue is:
   - broken asset references
   - missing CSS bundling
   - JS bundle not loaded
   - incorrect dev server static serving
   - insufficient fallback tooling for the current React app
4. Apply the smallest fix that restores a normal React webapp experience
5. Re-run dev/build/test

If the custom fallback introduced in WO-003 cannot correctly support the React app with acceptable effort, you may replace that fallback with a smaller, more suitable React-compatible solution — but only if the change is minimal, documented, and preserves the current runtime unblock.

---

**Issued by:** `[ops-orchestration]`  
**Transmission:** user-managed  
**Status:** Ready to transmit
