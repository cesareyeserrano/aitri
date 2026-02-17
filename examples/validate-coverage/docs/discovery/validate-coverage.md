# Discovery: validate-coverage

STATUS: DRAFT

## 1. Problem Statement
Derived from approved spec:

---

# AF-SPEC: validate-coverage

STATUS: APPROVED
## 1. Context
Aitri currently validates structural traceability (presence of IDs like FR-*, US-*, TC-*), but it does not enforce coverage consistency between spec, backlog, and tests.

We need stronger coverage validation to prevent partially implemented or untested Functional Rules from reaching implementation phase.

---

## 2. Actors
- Product Owner
- Developer
- QA Engineer
- AI Agent (Codex / Claude using Aitri)

## 3. Functional Rules (traceable)

- FR-1: The `aitri validate` command MUST verify that every Functional Rule (FR-*) defined in the approved spec is referenced by at least one User Story (US-*).
- FR-2: The `aitri validate` command MUST verify that every Functional Rule (FR-*) defined in the approved spec is referenced by at least one Test Case (TC-*).
- FR-3: The command MUST fail validation if any Functional Rule in the approved spec is not referenced in backlog or tests.
- FR-4: The validation output MUST clearly list missing coverage items.

## 4. Edge Cases
- Spec contains no FR-* entries.
- Backlog contains FR references not present in the spec.
- Tests reference non-existent FR IDs.

## 5. Failure Conditions
- Approved spec file is missing.
- Backlog file is missing.
- Tests file is missing.
- Parsing errors when scanning IDs.

## 6. Non-Functional Requirements
- Validation must complete in under 1 second for small/medium projects.
- Output must be human-readable and concise.
- No file modifications should occur during validation.

## 7. Security Considerations
- Validation must not execute arbitrary file content.
- File reads must be restricted to project-local artifacts.
- No external network calls are permitted.

## 8. Out of Scope
- Automatic fixing of missing references.
- Refactoring backlog or tests content automatically.

## 9. Acceptance Criteria (Given/When/Then)

- AC-1: Given an approved spec with FR-1 and FR-2, when only FR-1 is referenced in backlog and tests, then validation fails and reports FR-2 as uncovered.
- AC-2: Given all FR-* entries are referenced in both backlog and tests, when validation runs, then validation passes.
- AC-3: Given missing artifacts (spec/backlog/tests), when validation runs, then validation fails with a clear error message.

---

Now refine: what problem are we solving and why now?

## 2. Discovery Interview Summary (Discovery Persona)
- Primary users:
- Product Owner, Developer, QA Engineer, AI Agent
- Jobs to be done:
- Validate coverage consistency between spec, backlog, and tests
- Current pain:
- Partially implemented or untested FRs reach implementation undetected
- Constraints (business/technical/compliance):
- Must complete in under 1 second; no file modifications
- Dependencies:
- Approved spec, backlog, tests artifacts must exist
- Success metrics:
- 100% FR coverage detected before implementation
- Assumptions:
- All artifacts follow Aitri naming conventions

## 3. Scope
### In scope
-

### Out of scope
-

## 3. Actors & User Journeys
Actors:
-

Primary journey:
-

## 5. Architecture (Architect Persona)
- Components:
- validate command module, spec-parser, coverage checker
- Data flow:
- spec → parse FR IDs → scan backlog/tests for references → report gaps
- Key decisions:
- Regex-based ID extraction; fail-fast on missing artifacts
- Risks:
- Malformed IDs could escape regex matching

## 6. Security (Security Persona)
- Threats:
- Path traversal via feature name
- Controls required:
- Restrict file reads to project-local artifacts
- Validation rules:
- No external network calls; no arbitrary code execution

## 7. Backlog Outline
Epic:
- Coverage validation engine

User stories:
1. As a developer, I want validate to check FR coverage so I catch gaps early.
2. As a QA, I want missing coverage listed so I know what to test.
3. As an AI agent, I want clear exit codes so I can gate the pipeline.

## 8. Test Strategy
- Smoke tests:
- Run validate on complete example → passes
- Functional tests:
- Remove FR from backlog → validate fails listing the gap
- Security tests:
- Feature name with path traversal → rejected
- Edge cases:
- Spec with no FR entries → passes vacuously

## 9. Discovery Confidence
- Confidence:
- High
- Reason:
- Problem is well-scoped; all artifacts are defined and parseable
- Evidence gaps:
- None identified
- Handoff decision:
- Proceed to planning