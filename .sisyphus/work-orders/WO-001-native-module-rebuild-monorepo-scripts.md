## WORK ORDER: WO-001

**Title:** Fix Native Module Build Error & Improve Monorepo Developer Experience  
**Created:** 2026-03-30  
**Priority:** High  
**Estimated Complexity:** Moderate

---

### OBJECTIVE

Fix the `better-sqlite3` native module version mismatch error and implement monorepo-level scripts for streamlined installation, development, and cleanup operations.

---

### CONTEXT

**Repository:** openwebui-adi-importer  
**Branch:** main (or current working branch)  
**Related Files:**
- `adi-webapp/server/package.json`
- `adi-webapp/web/package.json`
- `adi-webapp/package.json` (to be created)
- `adi-webapp/server/node_modules/better-sqlite3/` (native module)

**Current Problem:**

1. **Native Module Version Mismatch:**
   ```
   Error: The module 'better_sqlite3.node' was compiled against a different Node.js version using NODE_MODULE_VERSION 141. This version of Node.js requires NODE_MODULE_VERSION 127.
   ```
   - Current Node.js version: v22.21.1 (requires MODULE_VERSION 127)
   - Compiled module expects: MODULE_VERSION 141
   - Error occurs when running `npm run dev` in server

2. **Poor Developer Experience:**
   - Must run `npm install` separately in `server/` and `web/`
   - No unified install command at monorepo root
   - No cleanup/uninstall script provided
   - Repetitive navigation between directories

**Root Cause Analysis:**
- `better-sqlite3` contains native bindings that must match Node.js version
- Package was likely installed/built with different Node version
- No rebuild step after Node version change

---

### ACCEPTANCE CRITERIA

1. **Native Module Fix:**
   - [ ] `npm run dev` in `server/` starts without module version errors
   - [ ] `better-sqlite3` builds successfully for Node.js v22.21.1
   - [ ] Database client initializes without errors
   - [ ] Server starts and responds to health check

2. **Monorepo Scripts Implementation:**
   - [ ] Root `package.json` created at `adi-webapp/package.json`
   - [ ] Single `npm install` command at root installs all dependencies (server + web)
   - [ ] Single `npm run dev` command at root starts both server and web concurrently
   - [ ] `npm run build` command builds both server and web
   - [ ] `npm run test` command runs tests for both workspaces
   - [ ] `npm run clean` command removes all `node_modules/` and build artifacts
   - [ ] `npm run rebuild` command cleans and reinstalls everything

3. **Documentation Update:**
   - [ ] `adi-webapp/README.md` updated with new simplified commands
   - [ ] `docs/getting-started.md` updated to reflect monorepo workflow
   - [ ] Old multi-step install instructions replaced with single-command approach

---

### CONSTRAINTS

**MUST NOT:**
- Modify `openwebui-importer/` (Python core remains untouched)
- Change Node.js version requirement (keep 20+)
- Break existing Docker Compose setup
- Remove existing individual server/web scripts

**MUST:**
- Preserve backward compatibility (server/web scripts still work independently)
- Use npm workspaces or equivalent monorepo pattern
- Include proper error handling in scripts
- Support both Windows and Linux/Mac environments
- Test rebuild process thoroughly

**SHOULD:**
- Use `concurrently` for running multiple dev servers
- Include clear console output for each script
- Add progress indicators for long-running operations
- Consider using `npm-run-all` for sequential tasks

---

### DELIVERABLES

- [ ] Fixed `better-sqlite3` module (rebuilt for current Node version)
- [ ] Root `adi-webapp/package.json` with workspace configuration
- [ ] Monorepo-level scripts (install, dev, build, test, clean, rebuild)
- [ ] Updated README.md with simplified quick start
- [ ] Updated getting-started.md with monorepo workflow
- [ ] Test report confirming all scripts work on Windows environment
- [ ] Migration guide for existing developers (if needed)

---

### VALIDATION PROTOCOL

**[test-evaluation/validation] will verify:**

1. **Native Module Build:**
   ```bash
   cd adi-webapp/server
   npm run dev
   # Expect: Server starts without module version errors
   # Expect: Health endpoint responds at http://localhost:8787/api/health
   ```

2. **Monorepo Install:**
   ```bash
   cd adi-webapp
   npm install
   # Expect: Both server and web node_modules populated
   # Expect: No errors during installation
   # Expect: better-sqlite3 builds successfully
   ```

3. **Monorepo Dev Mode:**
   ```bash
   cd adi-webapp
   npm run dev
   # Expect: Both server and web start concurrently
   # Expect: Server runs on http://localhost:8787
   # Expect: Web runs on http://localhost:5173
   # Expect: No module version errors
   ```

4. **Clean & Rebuild:**
   ```bash
   cd adi-webapp
   npm run clean
   # Expect: All node_modules removed
   npm run rebuild
   # Expect: Fresh install completes
   # Expect: better-sqlite3 rebuilds for current Node version
   npm run dev
   # Expect: Both services start without errors
   ```

5. **Build Process:**
   ```bash
   cd adi-webapp
   npm run build
   # Expect: Server TypeScript compiles to dist/
   # Expect: Web builds to dist/
   # Expect: No errors in either build
   ```

6. **Test Suite:**
   ```bash
   cd adi-webapp
   npm run test
   # Expect: Server tests run (23 passing)
   # Expect: Web tests run
   # Expect: Overall pass/fail summary displayed
   ```

---

### IMPLEMENTATION GUIDANCE

**Recommended Approach:**

1. **Fix Native Module First:**
   ```bash
   cd adi-webapp/server
   npm rebuild better-sqlite3
   # If that fails:
   rm -rf node_modules/better-sqlite3
   npm install better-sqlite3
   ```

2. **Create Root package.json:**
   ```json
   {
     "name": "adi-webapp",
     "version": "1.0.0",
     "private": true,
     "workspaces": ["server", "web"],
     "scripts": {
       "install:all": "npm install",
       "dev": "concurrently \"npm run dev --workspace=server\" \"npm run dev --workspace=web\"",
       "build": "npm run build --workspaces",
       "test": "npm run test --workspaces",
       "clean": "rimraf server/node_modules web/node_modules server/dist web/dist node_modules",
       "rebuild": "npm run clean && npm install"
     },
     "devDependencies": {
       "concurrently": "^8.2.2",
       "rimraf": "^5.0.5"
     }
   }
   ```

3. **Update Documentation:**
   - Replace old multi-step install with single `npm install` at root
   - Update dev workflow to use root-level `npm run dev`
   - Add troubleshooting section for native module issues

**Alternative Approach (if workspaces don't work):**
- Use custom scripts with `cd` commands
- Use `npm-run-all` for orchestration
- Ensure cross-platform compatibility (Windows/Linux)

---

### PRIORITY

**High** - Blocks local development workflow

---

### ESTIMATED COMPLEXITY

**Moderate** - Requires:
- Native module rebuild understanding
- npm workspaces or equivalent setup
- Cross-platform script compatibility
- Documentation updates
- Thorough testing on Windows

---

### BLOCKERS (if any)

None currently identified. If native rebuild fails repeatedly:
1. Check Node.js installation integrity
2. Verify build tools available (Python, C++ compiler)
3. Consider better-sqlite3 version compatibility
4. Escalate to [ops-orchestration] if unresolvable

---

### QUESTIONS (if any)

Please confirm:
1. Should Docker Compose workflow remain unchanged?
2. Are there other native modules beyond better-sqlite3?
3. Should we add pre-commit hooks for rebuild checks?

---

**Issued by:** [ops-orchestration]  
**Assigned to:** [implementation-ops] (Codex cloud agent)  
**Status:** Open - Awaiting Implementation
