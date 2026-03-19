# Aitri — Feedback de Pruebas

> **Propósito:** Capturar observaciones de sesiones de prueba (manuales o E2E con Claude).
> No es un changelog ni un registro de implementaciones — eso va en CHANGELOG.md y BACKLOG.md.

> **Ciclo de vida de una entrada:**
> observación → documentar aquí → analizar → pasar a BACKLOG.md (o descartar) → **borrar entrada**
> Si una entrada lleva aquí más de una sesión sin accionarse, se borra igual.

-------
# Aitri — Product Feedback & Feature Proposals
**Based on:** Ultron-AP project (Go · Raspberry Pi · v0.1.65)
**Author:** César Augusto Reyes
**Date:** 2026-03-18

---

## Context

This document captures product feedback and feature proposals for Aitri based on real-world usage of v0.1.65 on a complete project — from `aitri init` through Phase 5 approval, deployment, and post-deploy refactoring. The project (Ultron-AP) is a Go monitoring dashboard for Raspberry Pi, covering 15 functional requirements, 20 test cases, and 5 core pipeline phases.

The proposals were also informed by a deep study of SDLC-Studio, a competing skill that handles similar SDLC workflows. The goal is not to make Aitri more like SDLC-Studio — the philosophies are different and Aitri's is better in the areas that matter — but to close specific gaps that caused friction during this engagement.

**Core philosophy to preserve:**
- Spec-first, human-approved, compliance-provable
- Artifact hashes as contracts
- Human-in-the-loop as a first-class gate
- `verify-complete` as a hard gate before deployment

---

## Bug Report: Approve + Drift Inconsistency

Before the proposals, a critical bug encountered in this session.

### What happened

1. An agent ran `aitri approve 3` after artifacts had drifted — correctly blocked:
   ```
   ❌ An agent cannot re-approve after drift. Run 'aitri approve 3' manually.
   ```
2. The human ran `aitri approve 3` and `aitri approve 4` from the terminal.
3. Both commands completed without error.
4. `aitri validate` continued to report drift on phases 3 and 4.

### Root cause

Inspecting `.aitri/config.json` after the human approval:

```json
"driftPhases": [],          ← cleared correctly
"artifactHashes": {
  "3": "948ad4c...",         ← OLD hash, not updated
  "4": "bcca06d..."          ← OLD hash, not updated
},
"events": [...]              ← no approve event recorded for phases 3 or 4
```

`aitri approve` in drift-recovery mode clears `driftPhases` but does NOT update `artifactHashes`. These two writes should be atomic. Additionally, `aitri validate` uses only hash comparison — it does not consult `driftPhases` — creating two sources of truth that can diverge.

### Fix

```
aitri approve <phase>  should atomically:
  1. Clear phase from driftPhases                   (already does this)
  2. Update artifactHashes[phase] = sha256(current) (missing)
  3. Emit event { event: "approved", phase, by: "human", at: timestamp }
```

And in `aitri validate`:
```
if phase ∈ approvedPhases AND phase ∉ driftPhases → pass (skip hash check)
```

The hash check is redundant after a human approval. `approvedPhases` should be the authoritative source of truth; hashes are the evidence mechanism, not the gate.

---

## Proposal 1: Formal Bug Tracking — `aitri bug`

### The gap

Aitri has a flat backlog (`aitri backlog add/done`). There is no concept of a bug with its own lifecycle, no traceability back to the FR it breaks, and no enforcement that a bug must be covered by a test case before it can be closed.

During this project, two post-deploy bugs were tracked informally in a backlog markdown file. They were fixed and verified, but:
- No record of which FR was affected
- No verification that a TC was added or updated
- `aitri validate` never knew the bugs existed

### Proposed commands

```bash
aitri bug add --title "VPN peers summary resets on transient read error" \
              --fr FR-014 \
              --severity medium \
              --phase 4          # detected post-Phase 4 approval

aitri bug list                   # all open bugs
aitri bug list --severity critical
aitri bug list --fr FR-014

aitri bug fix BG-001             # marks In Progress, prints context
aitri bug verify BG-001          # prompts for TC reference, marks Fixed
aitri bug close BG-001           # archives
```

### Bug lifecycle

```
Open → In Progress → Fixed → Verified → Closed
                           ↘ Reopened ↗
```

### Integration with existing pipeline

- `aitri validate` warns if any bug is in state `Fixed` without a TC that covers it
- `aitri verify-complete` blocks if bugs in state `Open` or `Fixed` are linked to a must-have FR
- `aitri status` shows open bug count alongside phase status

### Why this matters

Today when something breaks post-deploy, the only options are `aitri backlog add` (untracked) or modifying spec artifacts manually (triggers drift). A first-class bug object solves this without violating the pipeline contract.

---

## Proposal 2: Generate Mode with Validation Gate

### The gap

`aitri adopt` does a solid job scanning an existing project and producing a plan. But the specs it generates — requirements, test cases, implementation manifest — are not validated against the actual code. They are accepted as true by declaration.

SDLC-Studio has a cleaner model here: **a generated spec is only valid if tests written from that spec pass against the existing implementation.** The spec is a hypothesis; tests are the experiment.

During this project, we ran `aitri adopt apply` on Ultron and produced `01_REQUIREMENTS.json` with 15 FRs. Some of those FRs had AC that was aspirational rather than descriptive — it described what the feature should do, not what the code actually does. There was no mechanism to detect this gap.

### Proposed flow

```
aitri adopt generate            → scans codebase, produces spec artifacts
aitri adopt verify-spec         → bridge step: writes test stubs from spec AC
                                  (one stub per AC, marks as "unverified")
aitri verify-run                → existing command, now also evaluates stubs
aitri verify-complete           → now requires stubs to pass OR be explicitly
                                  marked as "known gap" with justification
```

### What "verify-spec" produces

For each FR and its AC items, it emits a TC stub:

```json
{
  "id": "TC-021",
  "fr": "FR-001",
  "ac": "Dashboard shows CPU temperature in Celsius with color indicator",
  "status": "unverified",
  "stub": true,
  "test_hint": "Check SSE payload includes temp field; check color class assignment"
}
```

These stubs flow into `03_TEST_CASES.json` with `"stub": true`. `verify-run` attempts to find existing tests that match. If a match is found, the stub is promoted to verified. If not, the TC stays as a gap that must be acknowledged.

### Why this matters

Brownfield projects adopted into Aitri today carry implicit risk: the spec may not reflect reality. The generate-with-validation pattern makes this risk explicit and forces a decision on every gap — fix the spec, fix the code, or consciously accept the gap.

---

## Proposal 3: Cross-Document Consistency Check — `aitri review`

### The gap

Aitri validates each artifact individually (does `03_TEST_CASES.json` exist and parse correctly?) but does not check whether artifacts are consistent with each other.

In this project, we had:
- FR-008 in `01_REQUIREMENTS.json` as must-have
- FR-008 not covered in `03_TEST_CASES.json` (TC coverage gap)
- The gap was only discovered when `aitri verify-complete` blocked with a cryptic "every requirement must have ≥1 passing test"

The block was correct — but surfacing the gap earlier would have saved two full verify-run cycles and a manual patch of the test cases file.

### Proposed command

```bash
aitri review              # full cross-document analysis
aitri review --phase 3    # check only before approving phase 3
aitri review --fr FR-008  # check specific FR across all artifacts
```

### What it checks

**Requirements → Test Cases:**
- Every must-have FR has ≥1 TC → error if missing
- Every should-have FR has ≥1 TC → warning if missing
- TC references a FR that doesn't exist → error

**Requirements → System Design:**
- FR references a component (e.g., "Telegram notifications") that doesn't appear in the architecture → warning
- NFR defines a performance target that has no test coverage → warning

**Test Cases → Test Results:**
- TC in `03_TEST_CASES.json` has no entry in `04_TEST_RESULTS.json` → warning
- TC in results references an ID not in cases → error

**System Design → Implementation Manifest:**
- Module listed in `02_SYSTEM_DESIGN.md` has no corresponding package in manifest → warning

### Integration with pipeline

- `aitri complete 3` runs `aitri review --phase 3` automatically before writing the completion state
- Any error-level finding blocks `complete`
- Warning-level findings are printed but don't block (user must acknowledge)

### Why this matters

Right now Aitri validates structure. This proposal validates semantics. It catches the class of bugs that are invisible until verify-complete — the "you passed every individual check but the system is still broken" category.

---

## Proposal 4: TDD Recommendation in Phase 4 Briefing

### The gap

Phase 4 (Implementation) briefing tells the agent what to build but not how to approach testing. The agent decides independently whether to write tests before or after implementation. This works, but it misses an opportunity to make the recommendation explicit and traceable.

### What to add to Phase 4 briefing

A structured TDD recommendation section based on the FRs and their AC complexity:

```
## Testing Approach Recommendation

TDD recommended for:
  ✦ FR-007 Authentication — 6 ACs with stateful brute-force logic
  ✦ FR-012 CSRF protection — 3 ACs with precise token validation rules
  Reason: High AC count with explicit rules — test-first prevents
          implementation drift and clarifies edge cases upfront.

Test-After recommended for:
  ✦ FR-009 Dark mode UI — 4 ACs focused on rendering
  ✦ FR-013 Hardware integration — requires physical device
  Reason: Exploratory or hardware-dependent — hard to write
          meaningful tests before implementation exists.

Decision rule applied:
  TDD if: AC count > 4 AND at least one AC involves state,
          validation rules, or error conditions
  Test-After if: AC is primarily visual, environmental, or
                 requires side effects to test meaningfully
```

### Why this matters

Two reasons. First, traceability — the recommendation is part of the briefing artifact, so the choice is documented. Second, quality — on this project, the CSRF and auth tests were written test-after and had one regression (the `isSameOriginRequest` edge case on empty Origin header). A TDD briefing recommendation would likely have caught that during spec writing rather than at verify-run.

---

## What NOT to bring from SDLC-Studio

For completeness, three SDLC-Studio features that should not be adopted:

**Unconstrained agentic execution.** SDLC-Studio's `--agentic` flag can execute 15 stories without any human review. This directly contradicts Aitri's core value. Speed without correctness is not an improvement.

**Personas in the core pipeline.** Personas add significant overhead for solo developers and small teams. If added to Aitri, they should be strictly opt-in (`aitri run-phase 1 --with-personas`) and never block the pipeline.

**7 sub-phases per story.** SDLC-Studio operates at story granularity because it has no project-level compliance mechanism. Aitri's 5 phases are the right abstraction for a compliance-first tool. Going to story-level would require a complete redesign of the artifact model and would make `aitri validate` vastly more complex.

---

## Priority Summary

| Proposal | Impact | Effort | Priority |
|---|---|---|---|
| Bug: approve + drift hash | Correctness — users can't trust validate | Low | P0 — fix now |
| Bug tracking (`aitri bug`) | Closes the post-deploy lifecycle gap | Medium | P1 |
| Cross-doc consistency (`aitri review`) | Prevents verify-complete surprises | Medium | P1 |
| Generate mode + validation gate | Makes brownfield adoption trustworthy | High | P2 |
| TDD recommendation in Phase 4 | Nice-to-have, improves quality | Low | P3 |
