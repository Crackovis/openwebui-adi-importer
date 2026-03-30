## WORK ORDER: WO-003

**Title:** Unblock local dev runtime (frontend inaccessible + backend import failure)  
**Created:** 2026-03-30  
**Priority:** Critical  
**Estimated Complexity:** Moderate

---

### OBJECTIVE

Restore a working local development workflow for `adi-webapp` by fixing both blocking runtime failures:

1. frontend dev server never becomes reachable at `http://localhost:5173`
2. backend dev server fails with `Cannot find module '../lib/api-response'`

---

### CONTEXT

**Repository:** `openwebui-adi-importer`  
**App Root:** `adi-webapp/`

**Blocked sync from previous attempt:**
- Frontend: Vite exits before binding because Rollup native package resolution fails with missing `@rollup/rollup-linux-x64-gnu`
- Backend: server startup also fails with a separate missing-module error referencing `../lib/api-response`

**Important correction:**
- This is **not** a request to migrate “to React”
- The project already uses **React** on the frontend
- Fix the runtime/tooling issues first

**Relevant files/modules:**
- `adi-webapp/package.json`
- `adi-webapp/web/package.json`
- `adi-webapp/web/vite.config.ts`
- `adi-webapp/web/src/**`
- `adi-webapp/server/package.json`
- `adi-webapp/server/src/routes/**`
- `adi-webapp/server/src/lib/api-response.ts`
- `adi-webapp/docs/troubleshooting.md`
- `adi-webapp/README.md`
- `adi-webapp/docs/getting-started.md`

---

### ACCEPTANCE CRITERIA

#### A. End-to-end dev workflow
- [ ] `cd adi-webapp && npm run dev` starts both workspaces successfully
- [ ] frontend is reachable at `http://localhost:5173`
- [ ] backend health endpoint is reachable at `http://localhost:8787/api/health`

#### B. Frontend unblock
- [ ] Root cause of the Rollup/Vite failure is fixed, not just documented
- [ ] If registry/package policy is the issue, the chosen fix is committed into project configuration and/or dependency setup where appropriate
- [ ] Web workspace command `npm run dev --workspace=web` stays alive and binds successfully

#### C. Backend unblock
- [ ] `npm run dev --workspace=server` starts without the `../lib/api-response` runtime failure
- [ ] Backend import/path issue is fixed minimally

#### D. Regression safety
- [ ] `npm run build` passes from `adi-webapp/`
- [ ] `npm run test` passes from `adi-webapp/`, or any unrelated pre-existing failures are reported explicitly
- [ ] Existing monorepo commands remain intact

#### E. Documentation
- [ ] Update docs only if commands, dependency recovery, or troubleshooting guidance materially changed

---

### CONSTRAINTS

**MUST NOT:**
- Modify `openwebui-importer/`
- Refactor unrelated application code
- Replace React frontend architecture wholesale
- Perform a broad frontend migration as a first response

**MUST:**
- Treat this as a **bugfix task**
- Fix minimally
- Diagnose both blockers before finalizing the patch
- Preserve Windows compatibility first
- Keep root workspace workflow usable

**SHOULD:**
- Prefer environment/package-manager/dependency fixes over bundler migration
- Only consider replacing Vite/Rollup as a **last resort** if registry policy makes the current toolchain fundamentally unusable in the target environment
- If a tooling swap becomes unavoidable, preserve the existing React app structure and keep the migration minimal and documented

---

### REQUIRED DIAGNOSIS

The implementation report must explicitly answer:

1. Why is `@rollup/rollup-linux-x64-gnu` missing?
2. Is the problem caused by:
   - lockfile / install state
   - optional dependency handling
   - registry policy
   - Rollup/Vite version choice
   - platform package resolution
3. What exact code/config change fixed the frontend issue?
4. Which file/import caused `Cannot find module '../lib/api-response'`?
5. What exact minimal backend fix restored startup?

---

### DELIVERABLES

- [ ] Working local dev runtime
- [ ] Implementation report with both root causes
- [ ] Files changed list
- [ ] Build result
- [ ] Test result
- [ ] Docs update if applicable

---

### VALIDATION PROTOCOL

Validation will verify:

```bash
cd adi-webapp
npm install
npm run dev
```

Then confirm:
- `http://localhost:5173` loads
- `http://localhost:8787/api/health` returns `{ ok: true, data: ... }`

Then run:

```bash
npm run build
npm run test
```

Expected:
- all pass, or unrelated pre-existing failures are clearly isolated

---

### IMPLEMENTATION GUIDANCE

**Recommended order:**

1. Reproduce frontend failure in root workflow and web workspace directly
2. Reproduce backend failure in server workspace directly
3. Fix backend import/path issue minimally
4. Fix frontend dependency/tooling issue minimally
5. Re-run root `npm run dev`
6. Re-run build/test

If frontend remains impossible under current registry policy, you may propose and implement a **minimal React-compatible tooling fallback** only if:
- you document why the current Vite/Rollup path is not viable in the target environment
- the replacement is smaller than continued environment fighting
- the existing React application structure is preserved

---

**Issued by:** `[ops-orchestration]`  
**Transmission:** user-managed  
**Status:** Ready to transmit
