## WORK ORDER: WO-002

**Title:** Fix inaccessible web dev server at `http://localhost:5173`  
**Created:** 2026-03-30  
**Priority:** High  
**Estimated Complexity:** Moderate

---

### OBJECTIVE

Diagnose and fix the issue where the frontend remains inaccessible at `http://localhost:5173` after starting the development workflow.

---

### CONTEXT

**Repository:** `openwebui-adi-importer`  
**App Root:** `adi-webapp/`

**Relevant files already identified:**
- `adi-webapp/package.json`
- `adi-webapp/web/package.json`
- `adi-webapp/web/vite.config.ts`
- `adi-webapp/web/src/api/client.ts`
- `adi-webapp/README.md`
- `adi-webapp/docs/getting-started.md`
- `adi-webapp/docs/troubleshooting.md`

**Observed problem:**
- The dev workflow starts, but `http://localhost:5173` stays inaccessible.
- This must be fixed in the local developer experience.

**Current known configuration:**
- Root dev command uses `concurrently` to launch server + web.
- Web workspace dev command is `vite`.
- Vite config is currently set to host `0.0.0.0` and port `5173`.

---

### ACCEPTANCE CRITERIA

1. `cd adi-webapp && npm run dev` starts the frontend dev server successfully.
2. `http://localhost:5173` becomes reachable from the local machine.
3. The root cause is identified and documented in the implementation report.
4. If the issue is caused by script orchestration, root scripts are fixed.
5. If the issue is caused by Vite host/port/configuration, the fix is applied minimally.
6. If the issue is caused by startup failure in the web app itself, the frontend error is fixed minimally.
7. Server workflow at `http://localhost:8787` remains functional.
8. Existing monorepo workflow remains intact:
   - `npm install`
   - `npm run dev`
   - `npm run build`
   - `npm run test`
9. Documentation is updated only if commands or troubleshooting guidance changed.

---

### CONSTRAINTS

**MUST NOT:**
- Modify `openwebui-importer/`
- Refactor unrelated frontend/backend code
- Change ports unless strictly necessary and documented
- Break the root monorepo workflow introduced in WO-001

**MUST:**
- Diagnose before fixing
- Prefer the smallest fix that restores accessibility
- Preserve Windows compatibility first
- Report the exact failure mode:
  - Vite process never started
  - Vite started on a different host/port
  - Process exited immediately
  - Browser blocked because of app/runtime error
  - Proxy/network binding issue

**SHOULD:**
- Improve root `dev` logs if current output hides the failing workspace
- Add troubleshooting guidance if the failure mode is environment-sensitive

---

### DIAGNOSIS CHECKLIST

The implementation agent must explicitly check and report:

1. Does `npm run dev --workspace=web` start and stay alive?
2. Does it print the real listening URL(s)?
3. Does the root `npm run dev` launch both processes correctly?
4. Is port `5173` already occupied?
5. Does Vite bind to IPv4/IPv6 in a way that makes `localhost` fail on this machine?
6. Does the web app crash immediately after Vite starts?
7. Are there console/build/runtime errors in the web workspace?
8. If root orchestration is the problem, can logs be made clearer with minimal script changes?

---

### DELIVERABLES

- [ ] Minimal fix for inaccessible frontend dev server
- [ ] Implementation report with root cause
- [ ] Files changed list
- [ ] Evidence that `http://localhost:5173` is reachable
- [ ] Updated docs only if behavior/commands changed

---

### VALIDATION PROTOCOL

Validation will verify:

1. `cd adi-webapp && npm run dev`
2. Frontend is reachable at `http://localhost:5173`
3. Backend remains reachable at `http://localhost:8787/api/health`
4. If applicable, `cd adi-webapp && npm run build` still passes
5. If applicable, `cd adi-webapp && npm run test` still passes

---

### IMPLEMENTATION NOTES FOR [implementation-ops]

This is a **bugfix task**.

Apply the bugfix rule:
- Fix minimally
- Do not refactor while fixing

If you cannot reproduce reliably, request from the user:
- full root `npm run dev` output
- full `npm run dev --workspace=web` output
- result of port check on 5173
- browser console/network errors if the page shell loads but app does not

---

**Issued by:** `[ops-orchestration]`  
**Transmission:** user-managed  
**Status:** Ready to transmit
