# Backlog: aitri-core-next

## Epic 1: Enforce Persona Outputs in Engine
- Objective:
  - Reduce dependence on agent discipline by enforcing persona contracts through CLI behavior.

### US-1 [DONE]
- As a maintainer, I want persona-required sections validated in generated artifacts, so that outputs are consistent without manual policing.
- Trace: FR-1, AC-1

### US-2 [DONE]
- As a maintainer, I want missing critical persona outputs to block progression to next command, so that weak artifacts do not pass silently.
- Trace: FR-1, AC-2

## Epic 2: Stronger Discovery and Planning Signal
- Objective:
  - Increase depth and quality of generated discovery/plan artifacts.

### US-3 [DONE]
- As a user, I want discovery interviews to collect deeper contextual evidence, so that plan quality improves from first pass.
- Trace: FR-2, AC-3

### US-4
- As a user, I want plan outputs to minimize generic scaffold text, so that artifacts are immediately actionable.
- Trace: FR-2, AC-4

## Epic 3: Clear Handoff to Implementation
- Objective:
  - Remove ambiguity after `ready_for_human_approval`.

### US-5
- As a user, I want a short explicit command-level handoff mode, so that transition to implementation is unambiguous.
- Trace: FR-3, AC-5

### US-6
- As a user, I want a short resume mode for new sessions, so that continuation starts from the correct checkpoint with minimal prompt text.
- Trace: FR-3, AC-6

## Epic 4: Product Proof and Adoption
- Objective:
  - Improve perceived professionalism and practical trust quickly.

### US-7 [DONE]
- As a new adopter, I want a 5-minute reproducible demo that shows value end-to-end, so that I can evaluate Aitri fast.
- Trace: FR-4, AC-7

### US-8
- As a team lead, I want a default path vs advanced path docs split, so that onboarding is short while advanced depth remains available.
- Trace: FR-4, AC-8

## Epic 5: Runtime Verification Loop
- Objective:
  - Close the gap between documented traceability and executable behavior.

### US-9 [DONE]
- As a maintainer, I want `aitri verify` to execute project tests with deterministic output, so that runtime evidence becomes part of quality gates.
- Trace: FR-5, AC-9

### US-10 [DONE]
- As a reviewer, I want handoff/go to require successful verification evidence, so that implementation cannot progress on unverified runtime behavior.
- Trace: FR-5, AC-10

## Epic 6: Brownfield Adoption via Semantic Mapping
- Objective:
  - Make Aitri usable in existing repositories without forced folder migration.

### US-11 [DONE]
- As a team using an existing codebase, I want configurable path mapping (`aitri.config.json`), so that Aitri can bind to current project structures.
- Trace: FR-6, AC-11

### US-12 [DONE]
- As a maintainer, I want config validation and fallback defaults, so that mapping errors are explicit and safe.
- Trace: FR-6, AC-12

## Epic 7: Managed Implementation Mode
- Objective:
  - Reduce implementation drift after `go` with lightweight deterministic controls.

### US-13 [DONE]
- As a maintainer, I want a managed-go mode with policy checks, so that forbidden architectural/dependency drift is caught before commit/handoff.
- Trace: FR-7, AC-13

### US-14 [DONE]
- As a reviewer, I want dependency drift and policy violations surfaced in machine-readable output, so that CI and humans can block unsafe progression.
- Trace: FR-7, AC-14

## Epic 8: Insight Dashboard and Confidence Score
- Objective:
  - Provide business + technical visibility without abandoning CLI-first principles.

### US-15 [DONE]
- As a stakeholder, I want `aitri status --ui` static output, so that project health is visible without manual parsing.
- Trace: FR-8, AC-15

### US-16 [DONE]
- As a maintainer, I want a weighted confidence score (spec integrity + runtime verification), so that release readiness is objectively measurable.
- Trace: FR-8, AC-16

## Epic 9: Scalable Context Retrieval (Staged)
- Objective:
  - Improve artifact quality in large projects while controlling complexity.

### US-17 [DONE]
- As an agent operator, I want section-level retrieval before full-file loading, so that planning and refinement stay coherent in large scopes.
- Trace: FR-9, AC-17

### US-18 [DONE]
- As a maintainer, I want optional local semantic retrieval in advanced mode (semantic-lite heuristic), so that retrieval quality scales without mandatory cloud services.
- Trace: FR-9, AC-18

## Epic 10: Maintainability and Growth Control
- Objective:
  - Keep core CLI internals maintainable by controlling monolith growth and enforcing size guardrails.

### US-19
- As a maintainer, I want `cli/index.js` split into command modules, so that command evolution remains low-risk and reviewable.
- Trace: FR-10, AC-19

### US-20
- As a maintainer, I want smoke tests split by domain (status, verify, policy, workflow), so that failures are easier to isolate and test files stay maintainable.
- Trace: FR-10, AC-20

### US-21
- As a maintainer, I want file growth budgets checked in CI, so that uncontrolled file expansion is detected before merge.
- Trace: FR-10, AC-21

## Epic 11: Audit-Driven Stabilization (No New Features)
- Objective:
  - Close E2E audit findings before introducing any new capabilities.

### US-22 [P0]
- As a maintainer, I want strict feature-name validation and path containment, so that no command can write outside project boundaries.
- Trace: FR-11, AC-22
- Impacto: Alto
- Severidad: P0
- Valor: Alto
- Riesgo: Alto

### US-23 [P1]
- As a reviewer, I want `validate` to fail when `discovery` or `plan` artifacts are missing, so that persona gates cannot be bypassed.
- Trace: FR-11, AC-23
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Alto

### US-24 [P1]
- As a maintainer, I want `go` to block when policy drift checks are limited (non-git) unless explicitly overridden, so that implementation handoff remains controlled.
- Trace: FR-11, AC-24
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio-Alto

### US-25 [P2]
- As a user, I want deterministic feature targeting in `status`, so that multi-feature repositories do not produce ambiguous next-step guidance.
- Trace: FR-11, AC-25
- Impacto: Medio-Alto
- Severidad: P2
- Valor: Alto
- Riesgo: Medio

### US-26 [P2]
- As a maintainer, I want `verify` command execution hardened with timeout and safer command handling, so that runtime verification cannot hang or expand shell risk.
- Trace: FR-11, AC-26
- Impacto: Medio-Alto
- Severidad: P2
- Valor: Medio-Alto
- Riesgo: Medio-Alto

### US-27 [P3]
- As a maintainer, I want retrieval mode reporting to remain consistent in generated plan documents, so that audit output and user guidance never conflict.
- Trace: FR-11, AC-27
- Impacto: Medio
- Severidad: P3
- Valor: Medio
- Riesgo: Bajo

### US-33 [P1]
- As a maintainer, I want CI to enforce the critical findings gate, so that merges are blocked while H-001/H-002/H-003 remain open.
- Trace: FR-11, AC-33
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio

## Epic 12: Production Quality Hardening (Post-Stabilization)
- Objective:
  - Raise default output quality from "traceable prototype" to "production-grade baseline" without adding PM-layer bloat.
- Dependency:
  - Do not start until Epic 11 critical closure gate is complete (H-001/H-002/H-003 verified).

### US-28 [P1][DEFERRED]
- As a maintainer, I want domain-aware quality profiles (web/game/cli), so that generated constraints avoid low-fidelity implementation defaults.
- Trace: FR-12, AC-28
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio

### US-29 [P2][DEFERRED]
- As a user, I want explicit asset strategy defaults for visual/interactive domains, so that prototypes use credible placeholder pipelines instead of primitive rendering.
- Trace: FR-12, AC-29
- Impacto: Alto
- Severidad: P2
- Valor: Alto
- Riesgo: Medio

### US-30 [P1][DEFERRED]
- As a reviewer, I want higher-fidelity story contracts (specific actor + Given/When/Then AC), so that implementation ambiguity and toy-output risk are reduced.
- Trace: FR-12, AC-30
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio

### US-31 [P2][DEFERRED]
- As a maintainer, I want runtime verification hardening (timeout + controlled command execution), so that `verify` is reliable and safe in automation.
- Trace: FR-12, AC-31
- Impacto: Medio-Alto
- Severidad: P2
- Valor: Alto
- Riesgo: Medio-Alto

### US-32 [P3][DEFERRED]
- As a team operating brownfield repositories, I want optional config extensions only where adoption value is proven, so that complexity remains bounded.
- Trace: FR-12, AC-32
- Impacto: Medio
- Severidad: P3
- Valor: Medio
- Riesgo: Bajo

## Epic 13: Real Content Generation (Phase H.1)
- Objective:
  - Eliminate placeholder templates in generated backlogs and tests. Generate concrete content derived from approved spec and discovery data.
- Dependency: None (foundational for factory transformation)

### US-34 [P0]
- As a maintainer, I want a spec parser module that extracts structured data (actors, FRs, ACs, edge cases, tech stack) from approved specs, so that downstream generators have concrete inputs instead of raw markdown.
- Trace: FR-13, AC-34
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio (spec format variations)

### US-35 [P0]
- As a user, I want `aitri plan` to generate backlog stories with real actors from the spec and real FR traces, so that stories are immediately actionable without manual placeholder replacement.
- Trace: FR-13, FR-14, AC-35
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio

### US-36 [P0]
- As a user, I want `aitri plan` to generate test cases with concrete Given/When/Then derived from spec ACs, edge cases, and security notes, so that test documentation is actionable from first generation.
- Trace: FR-13, FR-15, AC-36
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio

### US-37 [P1]
- As a user, I want the plan architecture section to reference the detected tech stack and real components from FRs, so that architecture is specific to the feature instead of generic boilerplate.
- Trace: FR-13, FR-16, AC-37
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Bajo

## Epic 14: Scaffold Post-Go (Phase H.2)
- Objective:
  - Generate executable project skeleton after human-approved `go`, including test stubs traced to TC-*, interface contracts from FRs, and stack-appropriate config.
- Dependency: Epic 13 (spec-parser.js)

### US-38 [P0]
- As a user, I want `aitri scaffold` to generate project directory structure based on the plan architecture and detected tech stack, so that implementation has a structured starting point.
- Trace: FR-17, AC-38
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio (stack detection accuracy)

### US-39 [P0]
- As a user, I want `aitri scaffold` to generate executable test stubs for each TC-* with the appropriate test framework (node:test, pytest, go test), so that verification can run against real test files.
- Trace: FR-17, FR-18, AC-39
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio

### US-40 [P1]
- As a user, I want `aitri scaffold` to generate interface/contract stubs from FRs with function signatures and traceability comments, so that AI agents have explicit contracts to implement against.
- Trace: FR-17, FR-19, AC-40
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Bajo

### US-41 [P2]
- As a user, I want `aitri scaffold` to generate base config files (package.json, .gitignore, test runner config) matching the detected tech stack, so that the project is immediately runnable.
- Trace: FR-17, AC-41
- Impacto: Medio
- Severidad: P2
- Valor: Medio
- Riesgo: Bajo

## Epic 15: Implementation Orchestration (Phase H.3)
- Objective:
  - Generate structured implementation briefs for AI agents, ordered by dependency, with complete context per user story.
- Dependency: Epic 13, Epic 14

### US-42 [P0]
- As an AI agent operator, I want `aitri implement` to generate one implementation brief per US-* containing spec context, scaffold references, TC references, and quality constraints, so that agents have complete instructions without guessing.
- Trace: FR-20, AC-42
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio

### US-43 [P1]
- As an AI agent operator, I want `aitri implement` to produce an IMPLEMENTATION_ORDER.md with stories in dependency order, so that agents implement in the correct sequence.
- Trace: FR-20, FR-21, AC-43
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio (dependency graph heuristic)

### US-44 [P1]
- As a maintainer, I want adapter SKILL.md files to document the complete post-go factory workflow, so that agents can execute the full cycle without ambiguity.
- Trace: FR-22, AC-44
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Bajo

## Epic 16: Closed-Loop Verification (Phase H.4)
- Objective:
  - Close the gap between declared TC-* and executable tests. Map verification results to specifications.
- Dependency: Epic 14 (scaffold generates TC-tagged test files)

### US-45 [P0]
- As a maintainer, I want a TC scanner module that maps TC-* markers in generated test files to declared TCs in tests.md, so that coverage can be objectively measured.
- Trace: FR-23, AC-45
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio (convention-dependent)

### US-46 [P0]
- As a user, I want enhanced `aitri verify` to report TC coverage (declared vs executable vs passing vs failing vs missing), FR coverage, and US coverage, so that verification is traceable to specifications.
- Trace: FR-23, FR-24, AC-46
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Medio

### US-47 [P2]
- As a user, I want the confidence score to incorporate TC coverage data from enhanced verification, so that release readiness reflects actual test coverage.
- Trace: FR-24, AC-47
- Impacto: Medio
- Severidad: P2
- Valor: Alto
- Riesgo: Bajo

## Epic 17: Delivery Gate (Phase H.5)
- Objective:
  - Final gate that certifies software delivery: all FRs covered, all TCs passing, confidence threshold met.
- Dependency: Epic 16

### US-48 [P0]
- As a user, I want `aitri deliver` to block delivery when any FR is uncovered by a passing TC or when confidence is below threshold, so that incomplete software cannot be shipped.
- Trace: FR-25, AC-48
- Impacto: Alto
- Severidad: P0
- Valor: Muy Alto
- Riesgo: Bajo

### US-49 [P1]
- As a user, I want `aitri deliver` to generate a delivery report (JSON + markdown) with FR coverage matrix, TC summary, confidence score, and timeline, so that delivery decisions are documented and auditable.
- Trace: FR-25, FR-26, AC-49
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Bajo

### US-50 [P1]
- As a user, I want the status command to report post-go states (scaffold_pending, implement_pending, verify_pending, deliver_pending), so that agents and humans know the current factory phase.
- Trace: FR-27, AC-50
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio (state machine complexity)

## Acceptance Criteria (Next Improvement Scope)
- AC-1: Persona-required fields are machine-checked for at least Discovery/Product/Architect outputs. [DONE]
- AC-2: `plan` blocks when critical discovery confidence is Low or required sections are missing. [DONE]
- AC-3: Guided discovery captures users, JTBD, constraints, dependencies, success metrics, assumptions, and confidence in all flows. [DONE]
- AC-4: Generated plan/backlog/tests contain fewer unresolved placeholders and stronger traceable defaults.
- AC-5: Explicit handoff command(s) exist (`aitri handoff` and/or `aitri go`) with clear no-go/go behavior.
- AC-6: Resume shortcut exists and maps to checkpoint decision + next step deterministically.
- AC-7: Demo script runs end-to-end in a clean repo in <= 5 minutes. [DONE]
- AC-8: README and docs separate "default quick path" from "advanced operations path".
- AC-9: `aitri verify` executes runtime checks and returns machine-readable verification evidence. [DONE]
- AC-10: `handoff`/`go` can be blocked when runtime verification is missing or failing. [DONE]
- AC-11: `aitri.config.json` path mapping supports specs/backlog/tests/docs for brownfield projects. [DONE]
- AC-12: Invalid mapping configuration fails fast with explicit diagnostics and safe defaults. [DONE]
- AC-13: Managed-go mode enforces deterministic policy checks before progression. [DONE]
- AC-14: Dependency/policy drift output is machine-readable for CI gating. [DONE]
- AC-15: `aitri status --ui` generates static visibility output for non-technical stakeholders. [DONE]
- AC-16: Confidence score model is documented and includes runtime + spec inputs. [DONE]
- AC-17: Section-level retrieval is used before raw full-document loading in large workflows. [DONE]
- AC-18: Optional local semantic retrieval is available in advanced mode (semantic-lite heuristic). [DONE]
- AC-19: CLI command routing and handlers are split into bounded modules with no single file above agreed hard thresholds.
- AC-20: Smoke tests are partitioned by capability with deterministic naming and equivalent coverage.
- AC-21: CI emits growth warnings using file-size/line-count budgets and blocks when configured hard thresholds are exceeded.
- AC-22: All write paths (`draft`, `verify`, `policy`) reject traversal patterns and keep writes within configured project roots. [DONE]
- AC-23: `validate` fails when required persona artifacts (`discovery`, `plan`) are missing. [DONE]
- AC-24: `go` blocks when policy drift checks are limited, or requires explicit override evidence. [DONE]
- AC-25: `status` uses explicit feature targeting and fails deterministically on ambiguous multi-feature contexts. [DONE]
- AC-26: `verify` enforces execution timeout and controlled command execution semantics. [DONE]
- AC-27: generated plan output reports a single consistent retrieval mode. [DONE]
- AC-28: domain-aware quality profiles are available with explicit override rules and deterministic defaults. [DONE]
- AC-29: visual/interactive planning outputs include an asset placeholder strategy and avoid primitive-only defaults. [DONE]
- AC-30: generated stories/AC enforce actor specificity and Given/When/Then behavior contracts for critical flows. [DONE]
- AC-31: `verify` runtime execution includes timeout and safer command-handling controls with deterministic failure reasons. [DONE]
- AC-32: brownfield configuration extensions are explicitly scoped, documented, and covered by regression tests before adoption.
- AC-33: CI blocks when critical stabilization gate is OPEN, with deterministic exceptions only for remediation-tracking updates. [DONE]

## Functional Rules (Phase H: Software Factory)
- FR-13: Spec parser extracts structured data (actors, FRs, ACs, edge cases, tech stack) from approved spec markdown.
- FR-14: Generated backlogs use real actors from spec and real FR/AC traces instead of placeholders.
- FR-15: Generated test cases derive Given/When/Then from spec ACs, edge cases, and security notes.
- FR-16: Generated architecture section references detected tech stack and real components from FRs.
- FR-17: `aitri scaffold` generates project directory structure, executable test stubs, and base config after `go`.
- FR-18: Scaffold test stubs are traced to TC-* with standardized comment headers for scanner detection.
- FR-19: Scaffold interface stubs include function signatures derived from FRs with traceability comments.
- FR-20: `aitri implement` generates per-story implementation briefs with complete context (spec, scaffold, TCs, constraints).
- FR-21: Implementation briefs are ordered by dependency (topological sort from plan + heuristic).
- FR-22: Adapter SKILL.md files document the complete post-go factory workflow for AI agents.
- FR-23: TC scanner maps TC-* markers in generated test files to declared TCs in tests.md.
- FR-24: Enhanced `aitri verify` reports TC/FR/US coverage with declared vs executable vs passing breakdown.
- FR-25: `aitri deliver` blocks when any FR lacks a passing TC or confidence is below threshold.
- FR-26: Delivery report includes FR coverage matrix, TC pass/fail summary, confidence score, and timeline.
- FR-27: Status command reports post-go states (scaffold_pending, implement_pending, verify_pending, deliver_pending).

## Acceptance Criteria (Phase H: Software Factory)
- AC-34: Spec parser returns structured objects for actors, FRs, ACs, edge cases, security notes, and tech stack from any valid approved spec.
- AC-35: `aitri plan` backlog output contains zero instances of `FR-?`, `AC-?`, or `<actor>` when spec has defined FRs and actors.
- AC-36: Generated TCs have concrete Given/When/Then text derived from spec ACs, not template placeholders.
- AC-37: Architecture section names components based on detected tech stack and domain quality profile.
- AC-38: `aitri scaffold` creates project directory structure matching plan architecture components.
- AC-39: For each TC-* in tests.md, scaffold generates an executable test file with correct test framework and TC-* header comment.
- AC-40: For each FR-*, scaffold generates an interface stub with exported function signature and FR traceability.
- AC-41: Scaffold generates stack-appropriate config files (package.json for Node, pyproject.toml for Python, go.mod for Go).
- AC-42: Each implementation brief contains: feature context, US text with ACs, scaffold file references, TC references, dependency notes, quality constraints.
- AC-43: IMPLEMENTATION_ORDER.md lists stories in valid dependency order (models before services, services before UI).
- AC-44: All three adapter SKILL.md files document scaffold, implement, verify (enhanced), and deliver commands with workflow.
- AC-45: TC scanner returns map of TC-ID to {file, found} for all declared TCs.
- AC-46: Enhanced verify output includes tcCoverage (declared/executable/passing/failing/missing), frCoverage, and usCoverage objects.
- AC-47: Confidence score calculation incorporates TC coverage ratio when scaffold verification data is available.
- AC-48: `aitri deliver` exits with error code 1 when any FR has zero passing TCs or confidence is below configurable threshold.
- AC-49: Delivery report (JSON + markdown) includes FR matrix, TC summary, confidence score, checkpoint timeline, and SHIP/BLOCKED decision.
- AC-50: `aitri status` reports correct nextStep for post-go phases based on artifact presence detection.
