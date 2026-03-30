# Operation Contract: openwebui-adi-importer

**Version:** 1.1  
**Last Updated:** 2026-03-30  
**Status:** Active

---

## Contract Parties

### Primary: Ops Orchestration Agent (This Session)
**Role:** `[ops-orchestration]`  
**Capabilities:**
- Strategic planning and requirements analysis
- Work order specification and decomposition
- Validation protocol design
- Testing orchestration via Playwright and context tools
- Quality assurance and acceptance criteria definition
- Progress tracking and iteration management

**Responsibilities:**
- Define work orders with clear acceptance criteria
- Specify validation requirements
- Orchestrate testing when implementation completes
- Approve or reject deliverables
- Request clarifications or iterations
- Maintain this operation contract

**Access Boundary:**
- `[ops-orchestration]` does **not** transmit work orders directly to the cloud agent.
- `[ops-orchestration]` prepares work orders, validation protocols, and review artifacts only.
- The **user** is solely responsible for transmitting work orders and follow-up instructions to `[implementation-ops]` unless explicit access is granted later.

### Secondary: Cloud Implementation Agent
**Role:** `[implementation-ops]`  
**Platform:** Codex  
**Capabilities:**
- Full-stack implementation (Node.js/TypeScript backend, React frontend)
- Python subprocess orchestration
- Database schema design and migrations
- API endpoint implementation
- State machine logic implementation
- Docker containerization

**Responsibilities:**
- Execute work orders as specified
- Implement according to AGENTS.md V1 spec
- Report completion status
- Document implementation decisions
- Maintain code quality and test coverage
- Request clarification when work order is ambiguous

**Activation Rule:**
- `[implementation-ops]` acts only after the **user** forwards the relevant work order or instruction.
- `[ops-orchestration]` prepares the material but does not contact the cloud agent directly under the current operating model.

### Tertiary: Ops Orchestration Agent (This Session - Post-Implementation)
**Role:** `[test-evaluation/validation]`  
**Capabilities:**
- End-to-end testing via Playwright
- API contract validation
- Database integrity verification
- Integration testing orchestration
- Performance validation
- Security audit
- User acceptance testing simulation

**Responsibilities:**
- Design comprehensive test scenarios
- Execute validation protocols
- Report defects with reproduction steps
- Verify fixes and re-test
- Issue final acceptance or rejection
- Document known limitations

---

## Communication Protocol

### Work Order Structure

All work orders prepared by `[ops-orchestration]` for user transmission to `[implementation-ops]` MUST include:

```markdown
## WORK ORDER: [Unique ID]

### OBJECTIVE
[Single, atomic goal statement]

### CONTEXT
- Repository: openwebui-adi-importer
- Branch: [target branch]
- Related Files: [list]
- Dependencies: [list or "none"]

### ACCEPTANCE CRITERIA
1. [Testable criterion 1]
2. [Testable criterion 2]
...

### CONSTRAINTS
- MUST NOT: [forbidden actions]
- MUST: [required actions]
- SHOULD: [preferred approaches]

### DELIVERABLES
- [ ] [Artifact 1]
- [ ] [Artifact 2]
- [ ] Test coverage report
- [ ] Migration scripts (if applicable)

### VALIDATION PROTOCOL
[How ops-orchestration will verify completion]

### PRIORITY
[Critical | High | Medium | Low]

### ESTIMATED COMPLEXITY
[Trivial | Simple | Moderate | Complex | Very Complex]
```

### Implementation Response Structure

All responses from `[implementation-ops]` MUST include:

```markdown
## IMPLEMENTATION REPORT: [Work Order ID]

### STATUS
[Completed | Blocked | Needs Clarification | Failed]

### SUMMARY
[Brief description of what was implemented]

### FILES CHANGED
- Added: [list]
- Modified: [list]
- Deleted: [list]

### IMPLEMENTATION NOTES
[Key decisions, trade-offs, or deviations from spec]

### TESTING PERFORMED
- Unit tests: [count passing/total]
- Integration tests: [count passing/total]
- Manual testing: [description]

### BLOCKERS (if any)
[Issues preventing completion]

### QUESTIONS (if any)
[Clarifications needed]

### READY FOR VALIDATION
[Yes | No - pending X]
```

### Validation Report Structure

All validation reports from `[test-evaluation/validation]` MUST include:

```markdown
## VALIDATION REPORT: [Work Order ID]

### VERDICT
[APPROVED | REJECTED | APPROVED WITH NOTES]

### TEST RESULTS
- API Contract: [Pass/Fail]
- Integration Tests: [Pass/Fail]
- E2E Scenarios: [Pass/Fail]
- Security Checks: [Pass/Fail]

### DEFECTS FOUND
1. [Severity: Critical/High/Medium/Low] - [Description]
   - Reproduction: [steps]
   - Expected: [behavior]
   - Actual: [behavior]

### NOTES
[Additional observations or suggestions]

### NEXT ACTION
[Accept | Request fixes for defects | Request iteration]
```

---

## Scope of Work

### In Scope for [implementation-ops]

**V1 Development (per AGENTS.md):**
- Backend API implementation (Fastify + TypeScript)
- Frontend implementation (React + Vite + TypeScript)
- Database schema and migrations
- Python subprocess orchestration
- Job state machine logic
- File upload handling
- OpenWebUI discovery service
- Pre-check validation service
- Conversion orchestration
- SQL generation orchestration
- Direct DB import with backup logic
- SSE log streaming
- API endpoint implementation per contract
- Unit and integration tests
- Docker containerization
- Documentation (README, getting-started, operations, troubleshooting)

**Ongoing Maintenance:**
- Bug fixes for approved implementations
- Performance optimizations
- Dependency updates
- Security patches

### In Scope for [ops-orchestration]

**Planning & Specification:**
- Feature requirement analysis
- Work order decomposition
- Acceptance criteria definition
- Priority assignment

**Validation & Testing:**
- E2E test scenario design
- Playwright automation
- API contract validation
- Database integrity checks
- Security audits
- Load testing orchestration
- User acceptance testing simulation

**Quality Assurance:**
- Code review coordination
- Test coverage analysis
- Performance benchmarking
- Documentation review

**Process Management:**
- Iteration planning
- Progress tracking
- Blocker resolution
- Contract updates

**Explicitly Not In Scope Under Current Access Model:**
- Sending work orders to the cloud agent
- Triggering the cloud agent directly
- Assuming direct visibility into the cloud execution environment without user-provided sync

### Out of Scope (Both Parties)

- Modification of `openwebui-importer/` Python core
- Authentication layer (V1 runs locally/behind proxy)
- Cloud storage backends (V1 uses local filesystem)
- Multi-node deployment (V1 is single-node)
- OpenWebUI plugin development (future enhancement)

---

## Workflow

### Standard Development Cycle

```
1. [ops-orchestration] Prepares Work Order
   ↓
2. User transmits Work Order to [implementation-ops]
   ↓
3. [implementation-ops] Acknowledges or Requests Clarification
   ↓ (if acknowledged)
4. [implementation-ops] Implements Feature
   ↓
5. User syncs implementation status/results back to [ops-orchestration]
   ↓
6. [ops-orchestration] Reviews Report / sync details
   ↓
7. [test-evaluation/validation] Executes Validation Protocol
   ↓
8. [test-evaluation/validation] Issues Validation Report
   ↓
   ├─→ APPROVED: Close Work Order
   ├─→ APPROVED WITH NOTES: Close Work Order + Create Follow-up
   └─→ REJECTED: Create Fix Work Order → Return to Step 1
```

### Sync Points

**After each major milestone:**
1. Implementation completes
2. User syncs implementation outcome back into this session
3. [ops-orchestration] confirms next steps
4. All parties align on current state through the user relay

**Required syncs:**
- After Phase 1-10 of AGENTS.md Execution Order
- Before major architectural changes
- When blockers are encountered
- When scope clarification is needed

---

## Quality Standards

### Code Quality (enforced by [implementation-ops])

- TypeScript strict mode enabled
- No `any` types without justification
- Zod validation for all API inputs
- Error handling on all subprocess calls
- Path traversal protection on all file operations
- Transaction safety for all DB writes
- Timeout handling for all async operations
- Logging at appropriate levels (debug, info, warn, error)

### Test Coverage (enforced by [implementation-ops])

- Unit tests: ≥80% coverage for services
- Integration tests for all API endpoints
- E2E tests for critical workflows (SQL mode, Direct DB mode)
- State machine transition tests

### Documentation (enforced by [ops-orchestration])

- All public APIs documented
- All configuration options explained
- Troubleshooting guide maintained
- README accurate and complete

### Validation Coverage (enforced by [test-evaluation/validation])

- All acceptance criteria verified
- Happy path tested
- Error paths tested
- Edge cases covered
- Security checks passed
- Performance baseline met

---

## Defect Management

### Severity Levels

- **Critical**: Blocks core functionality, data loss, security vulnerability
- **High**: Major feature broken, poor UX, significant performance degradation
- **Medium**: Minor feature broken, cosmetic issue, workaround exists
- **Low**: Nice-to-have, future enhancement

### Resolution SLA

- **Critical**: Immediate fix, re-validation within same session
- **High**: Fix in next work order, re-validation within 24h
- **Medium**: Fix in current iteration
- **Low**: Backlog for future iteration

---

## Iteration Strategy

### V1 Delivery Phases (per AGENTS.md Section 14)

1. ✅ **Phase 1-2**: App structure + config + health endpoint
2. ✅ **Phase 3**: Python adapter + pre-check service
3. ✅ **Phase 4**: Job persistence + state machine + logging
4. ✅ **Phase 5**: Conversion + SQL orchestration
5. ✅ **Phase 6**: Direct DB mode + backup + safe execution
6. ✅ **Phase 7**: Frontend pages (dashboard, wizard, history, job detail, settings)
7. ✅ **Phase 8**: SSE logs + retry flow
8. ✅ **Phase 9**: Tests
9. ✅ **Phase 10**: Docs + Docker

**Current Phase:** V1 Complete - Maintenance Mode

### Post-V1 Enhancement Cycle

For each enhancement:
1. [ops-orchestration] proposes feature
2. Both parties agree on scope
3. Work order issued
4. Standard development cycle
5. Integration with existing V1

---

## Success Metrics

### V1 Acceptance Criteria (per AGENTS.md Section 13)

- [ ] `openwebui-importer/` unchanged
- [ ] SQL mode works end-to-end
- [ ] Direct DB mode works with backup + confirmation
- [ ] Pre-check, preview, history, smart tags, batch mode implemented
- [ ] Core tests pass
- [ ] English docs complete and runnable
- [ ] File tree + run commands + test results documented
- [ ] Known limitations documented

### Ongoing Quality Metrics

- Zero critical defects in production
- ≥80% test coverage maintained
- API response time <500ms (p95)
- Job completion time <2min for <100 files
- Zero data loss incidents
- Documentation accuracy ≥95%

---

## Escalation Protocol

### When [implementation-ops] is Blocked

1. Submit Implementation Report with `STATUS: Blocked`
2. Describe blocker clearly
3. Propose alternatives (if any)
4. [ops-orchestration] responds within same session

### When [ops-orchestration] Finds Critical Defect

1. Issue `VALIDATION REPORT: REJECTED` with severity: Critical
2. [implementation-ops] acknowledges immediately
3. Fix prioritized above all other work
4. Re-validation executed

### When Scope Ambiguity Arises

1. Either party raises question
2. [ops-orchestration] provides clarification
3. Work order updated if needed
4. Both parties confirm understanding

---

## Tools & Technologies

### [implementation-ops] Stack

- **Backend**: Node.js 20+, TypeScript 5.8+, Fastify, Zod, Better-SQLite3
- **Frontend**: React 18+, Vite 6+, TypeScript 5.8+
- **Python Orchestration**: subprocess with argument arrays
- **Testing**: Vitest, React Testing Library
- **Container**: Docker, Docker Compose

### [ops-orchestration] / [test-evaluation/validation] Stack

- **E2E Testing**: Playwright (via skill: playwright, dev-browser)
- **API Testing**: Direct HTTP calls or specialized tools
- **Database Validation**: SQLite CLI, Better-SQLite3
- **Performance Testing**: Load testing tools as needed
- **Documentation Validation**: Manual review + link checking

---

## Amendment Process

This contract may be amended when:
- V1 scope changes significantly
- New technical constraints emerge
- Process improvements are identified
- Both parties agree

**Amendment Procedure:**
1. Proposed change documented
2. Both parties review
3. Agreement reached
4. Contract updated
5. Version incremented

### Current Access Model

- Cloud-agent transmission: **User-managed only**
- Validation execution: `[test-evaluation/validation]` within this session after user sync
- Future change to direct transmission requires an explicit contract amendment

---

## Contract Termination

This contract remains active until:
- V1 project completion accepted by [ops-orchestration]
- Project scope fundamentally changes
- Either party requests termination

**Termination requires:**
- Handoff documentation completed
- All open work orders resolved or transferred
- Final status report issued

---

## Appendix: Quick Reference

### Work Order Template Location
[To be created in `.sisyphus/templates/WORK-ORDER-TEMPLATE.md`]

### Implementation Report Template Location
[To be created in `.sisyphus/templates/IMPLEMENTATION-REPORT-TEMPLATE.md`]

### Validation Report Template Location
[To be created in `.sisyphus/templates/VALIDATION-REPORT-TEMPLATE.md`]

### Current Work Orders
[To be tracked in `.sisyphus/work-orders/`]

### Validation Reports
[To be tracked in `.sisyphus/validation-reports/`]

---

**Signatures:**

**[ops-orchestration]:** Acknowledged - 2026-03-30  
**[implementation-ops]:** Pending acknowledgment  

---

*This contract establishes the operational framework for collaborative development of openwebui-adi-importer. All parties are expected to adhere to these protocols for successful delivery.*
