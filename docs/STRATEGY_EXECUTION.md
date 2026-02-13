# Aitri: Execution Strategy

## Strategic Direction
Aitri should become the practical SDLC operating layer for terminal-based AI coding workflows.

Priority order:
1. Discipline and reliability
2. Traceability and auditability
3. Agent portability
4. Supervised implementation/deployment assistance
5. Optional intelligence upgrades

## Execution Philosophy
- Governance before autonomy
- Determinism before complexity
- Reproducible CLI behavior before integrations
- Human supervision at every irreversible step

## Reference Alignment
Aitri is inspired by skill-based SDLC systems such as `sdlc-studio`, adapted to a stricter spec-driven CLI contract.

Reference:
- https://github.com/DarrenBenson/sdlc-studio

## Phased Plan

### Phase A: Harden the Core (now)
- Align documentation with actual CLI behavior.
- Define a clear command contract for humans, CI, and agents.
- Resolve help/docs/CI mismatches.
- Complete persona coverage (Product, Architect, Developer, QA, Security).

### Phase B: Validation Maturity
- Stronger coverage rules:
  - each FR covered in backlog
  - each FR covered in tests where required
  - each US covered by TC
- Structured outputs (human + machine-readable).
- Improve `status` with confidence signals and coverage summary.

### Phase C: Agent Runtime Stability
- Normalize execution contract for Codex/Claude/OpenCode.
- Add robust non-interactive mode for CI/agents where appropriate.
- Keep safety gates for write/destructive actions.

### Phase D: Supervised Build/Deploy Assistance
- Define build-phase workflow after artifact approval.
- Add local deployment runbook generation.
- Add production deployment assistance with mandatory human checkpoints.

## Operating Metrics
- Workflow completion rate (`draft -> validate`).
- Validation failure categories (missing files, placeholders, coverage).
- Rework rate caused by specification gaps.
- Number of workflow violations caught by gates.

## Current Risks
- Scope inflation without discipline improvements.
- Drift between documentation and real behavior.
- Over-automation that weakens human control.
- Fragmentation by agent/platform.

## Decision Rule
If a proposal does not directly improve one of these, defer it:
- traceability
- reliability
- auditability
- controlled execution speed

## Immediate Recommended Backlog
1. Complete and align all persona docs.
2. Align CLI behavior with documented flags/flows.
3. Add smoke tests for core commands.
4. Align CI with the real command interface.
5. Define non-interactive mode without breaking human control gates.
