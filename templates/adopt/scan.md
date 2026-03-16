# Aitri Adopt Scan — Project Analysis

{{ROLE}}

## Constraints
{{CONSTRAINTS}}

## How to reason
{{REASONING}}

## Project: `{{PROJECT_DIR}}`

### File Structure
```
{{FILE_TREE}}
```

{{#IF_PKG_JSON}}
### package.json
```json
{{PKG_JSON}}
```
{{/IF_PKG_JSON}}

{{#IF_README}}
### README
{{README}}
{{/IF_README}}

{{#IF_TEST_SUMMARY}}
### Test Files Found
{{TEST_SUMMARY}}
{{/IF_TEST_SUMMARY}}

---

## Technical Health Signals (pre-scanned)

### Code Quality Markers (TODO/FIXME/HACK)
{{CODE_QUALITY}}

### .gitignore Coverage
{{GITIGNORE}}

### Environment & Secrets
{{ENV_FILES}}

### Hardcoded Credential Signals
{{SECRET_SIGNALS}}

### Infrastructure Readiness
{{INFRA}}

### Test Health
{{TEST_HEALTH}}

---

## Your task

Read the project files listed above and produce two files.

---

### File 1: `{{PROJECT_DIR}}/ADOPTION_SCAN.md`

Complete technical audit. The human will read this before running `aitri adopt apply`.

Required sections:

#### Stack
Single line: language · framework · test runner (e.g. "Node.js · Express · Jest")

#### Priority Actions
List in priority order. Rate each: CRITICAL / HIGH / MEDIUM / LOW.
Be specific — name files, patterns, exact gaps.
Example: "CRITICAL: .env committed — add to .gitignore immediately and rotate credentials"
This section comes first so the human sees the most important issues immediately.

#### Technical Health Report

**Code Quality**
- TODO/FIXME/HACK count and what they imply about code maturity
- Rushed code, workarounds, or unresolved design decisions
- Dead code, commented-out blocks, placeholder logic

**Test Health**
- What is tested vs what is not
- Test quality: meaningful assertions or trivial/always-pass?
- Empty or skip-heavy test files and what they imply
- Missing test scenarios for critical paths

**Documentation**
- README completeness: setup, usage, architecture, deployment
- Missing docs: API reference, CONTRIBUTING.md, architecture diagrams
- .env.example: present and complete, partial, or missing
- Inline code documentation: are public APIs documented?

**Security Posture**
- .env files committed to repository (credential exposure risk)
- Hardcoded credential patterns found
- .gitignore gaps that expose sensitive data
- Auth/authorization quality, input validation, rate limiting — present or absent?

**Infrastructure & Operational Readiness**
- Dockerfile quality: multi-stage build? non-root user? HEALTHCHECK?
- CI/CD coverage: what exists, what's missing (lint, test, deploy)?
- Dependency management: lockfile present? deps pinned?
- Health check endpoints, observability, logging

---

### File 2: `{{PROJECT_DIR}}/IDEA.md`

This is the input to Phase 1 (Requirements). The PM agent will read this and produce
`01_REQUIREMENTS.json` defining exactly what stabilization work needs to happen.

Write it as a concrete, specific brief — not a summary of problems, but a description
of the work to be done:

```
# [Project Name] — Adoption Stabilization

## Problem
[What needs to be fixed/stabilized and why it matters. Ground this in the scan
findings — critical gaps, security issues, missing infrastructure. 2-4 sentences.
Not a list of all problems — a coherent statement of what this stabilization solves.]

## Target Users
[Who maintains and deploys this project. e.g.: "The development team maintaining
and deploying [project name]. Primarily developers contributing to the codebase
and operators running it in production."]

## Business Rules
[Constraints that bound the stabilization work. Derive from scan findings.
Examples:
  - Must not break existing functionality or passing tests
  - No new product features — stabilization only
  - Env vars must use [pattern found in project] — no hardcoded values
  - [Any specific constraint from the project's deployment or security model]]

## Success Criteria
[Specific, verifiable outcomes. Based on Priority Actions from ADOPTION_SCAN.md.
Be specific — name files and patterns:
  GOOD: "All Priority Actions marked HIGH in ADOPTION_SCAN.md are resolved:
         .env.example exists with all 5 required vars; go vet runs in CI"
  BAD:  "Project is stable"

  GOOD: "src/auth.js and src/payment.js have unit tests covering critical paths"
  BAD:  "Test coverage improved"

Only include criteria that are directly verifiable from the scan findings.]
```

---

## Rules
- ADOPTION_SCAN.md: based on actual signals and code you read — no generic boilerplate
- IDEA.md: stabilization goals must be specific and backed by scan findings
- Save ADOPTION_SCAN.md to: `{{PROJECT_DIR}}/ADOPTION_SCAN.md`
- Save IDEA.md to: `{{PROJECT_DIR}}/IDEA.md`
- Do NOT create any other files

## Instructions
1. Read the key files in the File Structure above (entry points, routes, models, tests, config)
2. Analyze the pre-scanned Technical Health Signals
3. Produce ADOPTION_SCAN.md (complete diagnostic with Priority Actions first)
4. Produce IDEA.md (specific stabilization brief for Phase 1)
5. Tell the user: "Scan complete. Review ADOPTION_SCAN.md — when ready: aitri adopt apply"
