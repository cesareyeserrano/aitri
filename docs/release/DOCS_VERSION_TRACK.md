# Aitri Documentation Version Track

## Purpose
Track what changed in Aitri documentation on each version/release, with clear auditability and rollback context.

## Usage Rules
- Add one entry per released version.
- Use semantic version from `package.json` (example: `0.2.22`).
- Keep entries immutable after release; if a correction is required, add a follow-up note.
- Link major documentation artifacts introduced or changed.

## Entry Template
```md
## vX.Y.Z - YYYY-MM-DD
- Scope:
  - <short release intent>
- Documentation changes:
  - Added: <file/path>
  - Updated: <file/path>
  - Deprecated/Removed: <file/path>
- Operational impact:
  - <what changes for contributors/operators>
- Verification:
  - <commands or checks used to validate docs alignment>
```

---

## v0.2.22 - 2026-02-16
- Scope:
  - Stabilization governance and production-quality hardening planning.
- Documentation changes:
  - Added:
    - `docs/feedback/AUDITORIA_E2E_2026-02-16.md`
    - `docs/feedback/PRODUCTION_QUALITY_FEEDBACK_ASSESSMENT_2026-02-16.md`
    - `docs/quality/STABILIZATION_RELEASE_GATE_2026-02-16.md`
    - `docs/release/DOCS_VERSION_TRACK.md`
  - Updated:
    - `docs/README.md`
    - `docs/STRATEGY_EXECUTION.md`
    - `docs/PROGRESS_CHECKLIST.md`
    - `docs/EXECUTION_GUARDRAILS.md`
    - `docs/architecture.md`
    - `docs/feedback/STRATEGIC_FEEDBACK_2026-02.md`
    - `backlog/aitri-core/backlog.md`
    - `.github/workflows/aitri.yml`
  - Deprecated/Removed:
    - None.
- Operational impact:
  - Feature freeze and critical stabilization gate are now explicitly tracked in docs.
  - Ownership, target dates, and closure evidence are centralized in a single gate file.
  - CI now publishes stabilization-gate visibility (non-blocking) while blocker enforcement remains tracked as backlog work (`AC-33`).
- Verification:
  - `npm run test:smoke`
  - `npm run demo:5min`
  - Cross-reference checks across docs index, strategy, checklist, backlog, and feedback reports.

### Follow-up note - 2026-02-16 (post-remediation)
- Scope:
  - Closure evidence documented after implementing H-001..H-006.
- Documentation changes:
  - Updated:
    - `docs/quality/STABILIZATION_RELEASE_GATE_2026-02-16.md`
    - `docs/PROGRESS_CHECKLIST.md`
    - `docs/feedback/AUDITORIA_E2E_2026-02-16.md`
- Operational impact:
  - Stabilization gate moved from OPEN to CLOSED with explicit verification evidence.
  - Runtime/policy/status hardening completion is now reflected in official tracking docs.
- Verification:
  - `npm run test:smoke` (43/43 passing)
  - `npm run demo:5min` (OK)

### Follow-up note - 2026-02-16 (phase-g baseline + CI gate)
- Scope:
  - Start Phase G baseline and activate AC-33 critical-gate CI blocker.
- Documentation changes:
  - Updated:
    - `docs/STRATEGY_EXECUTION.md`
    - `docs/PROGRESS_CHECKLIST.md`
    - `docs/quality/STABILIZATION_RELEASE_GATE_2026-02-16.md`
    - `docs/feedback/PRODUCTION_QUALITY_FEEDBACK_ASSESSMENT_2026-02-16.md`
    - `backlog/aitri-core/backlog.md`
- Operational impact:
  - `aitri plan` now injects domain quality profile + asset strategy defaults.
  - `aitri validate` now enforces story contract checks for plan-generated backlog artifacts.
  - CI now runs `scripts/check-critical-gate.mjs` to block non-remediation scope when critical gate is OPEN.
  - Q-005 (brownfield extension scope) was explicitly deferred for this cycle to keep anti-bloat discipline.
- Verification:
  - `npm run test:smoke` (45/45 passing)
  - `npm run check:file-growth:strict` (no blocking overruns)
  - `npm run demo:5min` (OK)
