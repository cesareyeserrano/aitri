# Plan: validate-coverage

STATUS: DRAFT

## 1. Intent (from approved spec)

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

- Summary:
-
- Success looks like:
-

## 2. Scope
### In scope
-

### Out of scope
-

## 3. Delivery Milestones
- M1: Coverage checker parses FR IDs from spec
- M2: Cross-reference backlog and tests
- M3: JSON output with gap report

## 4. Product Review (Product Persona)
### Business value
Prevents partially tested features from reaching implementation, reducing rework and late-stage defects.

### Success metric
100% of FR-* entries validated before scaffold phase with zero false negatives.

### Assumptions to validate
All specs follow FR-* naming convention consistently; backlog references FRs explicitly.

## 5. Architecture (Architect Persona)
### Components
- validate command, spec-parser, coverage-checker

### Data flow
- spec → extract FR IDs → scan backlog for US→FR refs → scan tests for TC→FR refs → produce gap report

### Key decisions
- Regex-based extraction; deterministic single-pass scan

### Risks & mitigations
- Malformed IDs → strict regex with warning on partial matches

### Observability (logs/metrics/tracing)
- JSON output includes specFr, backlogFr, testsFr counts

## 6. Security (Security Persona)
### Threats
- Path traversal via feature name

### Required controls
- Restrict file reads to project-local artifacts

### Validation rules
- No external network calls; no arbitrary code execution

### Abuse prevention / rate limiting (if applicable)
- N/A (local CLI tool)

## 7. Backlog
> Create as many epics/stories as needed. Do not impose artificial limits.

### Epics
- Epic 1:
  - Outcome:
  - Notes:
- Epic 2:
  - Outcome:
  - Notes:

### User Stories
For each story include clear Acceptance Criteria (Given/When/Then).

#### Story:
- As a <actor>, I want <capability>, so that <benefit>.
- Acceptance Criteria:
  - Given ..., when ..., then ...
  - Given ..., when ..., then ...

(repeat as needed)

## 8. Test Cases (QA Persona)
> Create as many test cases as needed. Include negative and edge cases.

### Functional
1.
2.

### Negative / Abuse
1.
2.

### Security
1.
2.

### Edge cases
1.
2.

## 9. Implementation Notes
- Suggested sequence:
-
- Dependencies:
-
- Rollout / fallback:
-
