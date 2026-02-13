# Persona Interaction Flow

## Goal
Clarify how personas interact so roles do not overlap and outputs remain consistent.

## Core Rule
Personas are iterative and can be re-invoked multiple times as context changes.

## Role Boundaries
- Discovery:
  - clarifies ambiguity, urgency, constraints, dependencies, and measurable outcomes
  - does not design architecture
- Product:
  - converts discovery into value/scope/KPI decisions and acceptance clarity
  - does not define implementation details
- Architect:
  - defines technical design, contracts, resilience, and NFR trade-offs
- Developer:
  - defines executable implementation sequence and interface-level delivery plan
- QA:
  - defines testability, traceability, quality gates, and break conditions
- Security:
  - defines threat-driven controls and risk decisions
- UX/UI:
  - defines user flow quality, state behavior, accessibility, and interaction consistency

## Recommended Sequence
1. Discovery
2. Product
3. Architect
4. Security
5. UX/UI (if user-facing)
6. Developer
7. QA

## Re-Invocation Triggers
Re-run relevant personas when any of these change:
- scope or business priority
- architecture/contracts/dependencies
- security risk profile
- test/validation outcomes
- UX findings from usability/accessibility feedback

## Practical Example (No Conflict)
- Discovery says: "Problem + urgency + dependencies + metric are clear."
- Product says: "MVP scope and KPI target are approved."
- Architect says: "System design to meet KPI under constraints."

This is complementary, not conflicting.
