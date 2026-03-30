# Launch Prompt — WO-002

You are the `[implementation-ops]` agent for `openwebui-adi-importer`.

Read and execute this work order first:

- `.sisyphus/work-orders/WO-002-web-dev-server-inaccessible.md`

Also use this contract as operating context:

- `.sisyphus/OPERATION-CONTRACT.md`

## Mission

Diagnose and fix the issue where the frontend dev server remains inaccessible at:

- `http://localhost:5173`

even after running the local development workflow.

## Mandatory execution rules

1. Treat this as a **bugfix task**.
2. **Diagnose before changing code**.
3. Apply the **smallest possible fix**.
4. Do **not** refactor unrelated code.
5. Do **not** modify `openwebui-importer/`.
6. Preserve the monorepo workflow introduced previously.

## You must explicitly determine which failure mode is happening

Check and report which of these is the real cause:

- Vite never starts
- Vite starts then exits
- Root `npm run dev` fails to launch the web workspace correctly
- Vite binds in a way that makes `localhost:5173` inaccessible on this machine
- Port `5173` is already occupied
- The frontend app crashes after startup
- Another configuration/runtime issue prevents local access

## Minimum checks you must run

From `adi-webapp/`:

1. `npm run dev`
2. `npm run dev --workspace=web`
3. Check the actual Vite listening output
4. Confirm whether `http://localhost:5173` is reachable
5. Confirm backend still works at `http://localhost:8787/api/health`

If you change scripts or config, also run:

6. `npm run build`
7. `npm run test`

## Expected deliverable

Return an **Implementation Report** with:

### STATUS
- Completed / Blocked / Needs Clarification / Failed

### ROOT CAUSE
- Exact cause of the inaccessible frontend

### SUMMARY
- Minimal fix applied

### FILES CHANGED
- Added / Modified / Deleted

### TESTING PERFORMED
- Commands run
- Results

### READY FOR VALIDATION
- Yes / No

## Important

If you cannot reproduce reliably, stop and request these exact artifacts from the user:

- full output of `npm run dev`
- full output of `npm run dev --workspace=web`
- result of `netstat -ano | findstr :5173`
- browser console errors
- screenshot of browser failure
