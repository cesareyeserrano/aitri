# Strategic Feedback Assessment (February 2026)

## Purpose
Evaluate external strategic feedback with engineering criteria and convert valid items into actionable roadmap work.

## Evaluation Criteria
- Impact on product reliability and trust
- Feasibility in a CLI-first architecture
- Incremental delivery value (can ship in slices)
- Risk of over-engineering vs adoption benefit

## Verdict Summary

### 1) Verification Gap: Static validation vs runtime reality
- Verdict: **Valid (Critical)**
- Rationale:
  - Current `validate` proves artifact integrity, not code behavior.
  - Spec-driven trust improves significantly with runtime evidence.
- Action:
  - Add `aitri verify` to orchestrate test execution.
  - Add handoff gate support: no GO when runtime verification fails.

### 2) Execution Vacuum after `aitri go`
- Verdict: **Partially Valid (High)**
- Rationale:
  - The risk is real (implementation drift after approval).
  - Hard interception of all file writes is not portable/reliable across agent runtimes.
- Action:
  - Implement a **managed-go mode** with policy checks before commit/handoff.
  - Enforce dependency drift checks and policy violations via deterministic scans.

### 3) Context Saturation and hallucination in large scopes
- Verdict: **Valid, but later-phase (Medium)**
- Rationale:
  - Large projects benefit from selective retrieval.
  - Full semantic RAG introduces operational complexity and should follow core reliability milestones.
- Action:
  - Track as staged roadmap:
    - Phase 1: indexed metadata + targeted section retrieval
    - Phase 2: optional local vector index

### 4) Rigid structure for brownfield projects
- Verdict: **Valid (High adoption impact)**
- Rationale:
  - Existing repositories need path mapping without restructuring.
- Action:
  - Add `aitri.config.json` semantic path mapping support.
  - Keep default convention when no config is present.

### 5) Insight dashboard and confidence score
- Verdict: **Valid (Medium)**
- Rationale:
  - A single confidence view improves stakeholder visibility.
  - Must avoid UI bloat and preserve CLI-first behavior.
- Action:
  - Add `aitri status --ui` static report output.
  - Add confidence score with documented formula and evidence sources.

## Scoring Model Proposal (Accepted for implementation)
- `ConfidenceScore = (SpecIntegrity * 0.4) + (RuntimeVerification * 0.6)`
- Guardrails:
  - Score must include transparent sub-metrics.
  - No score without runtime evidence (`verify` not run => explicit warning state).

## Non-goals (for this cycle)
- Full real-time sandbox-level write interception.
- Mandatory cloud services for retrieval/analytics.

## Roadmap Binding
Accepted items in this document are now tracked in:
- `backlog/aitri-core/backlog.md`
- `docs/STRATEGY_EXECUTION.md`
- `docs/PROGRESS_CHECKLIST.md`
