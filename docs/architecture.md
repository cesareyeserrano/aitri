# Aitri Architecture & Operating Model

## What Aitri is
Aitri is a **spec-driven SDLC CLI** that helps humans and AI agents collaborate safely to turn an idea into executable work **through approved artifacts**.

Aitri provides:
- A repeatable workflow (SDD)
- Templates and structure
- Quality gates
- Approval checkpoints (PLAN → Proceed? y/n)

Aitri does **not** replace human ownership. Humans must review, correct, direct, and approve.

## What Aitri is NOT
- Not a full autonomous builder
- Not a project manager that “decides” scope
- Not a code generator that bypasses specs or approvals

## Core Principles (Non-negotiable)
1. **Spec first**: no work starts without a written spec.
2. **Approved spec required**: no downstream artifacts without `specs/approved/<feature>.md`.
3. **Gated actions**: any file operations must be previewed in a PLAN and require explicit user approval.
4. Traceability enforced (Spec → Stories → Tests)
5. **Human in control**: the human approves every step and final content.

## Spec-Driven Development (SDD) Flow
Aitri formalizes this pipeline:

1) `aitri init`
   - Initializes project structure (`specs/`, `backlog/`, `tests/`, `docs/`)

2) `aitri draft`
   - Captures an idea into a draft spec (`specs/drafts/<feature>.md`)
   - Optionally: `aitri draft --guided` for minimal structured input

3) `aitri approve`
   - Runs gates to ensure spec completeness and quality
   - Moves draft → approved (`specs/approved/<feature>.md`)
   - Fails fast if missing key sections or meaningful content

4) `aitri discover`
   - Requires approved spec
   - Generates SDLC artifact structure:
     - `docs/discovery/<feature>.md`
     - `backlog/<feature>/backlog.md`
     - `tests/<feature>/tests.md`

5) `aitri plan`
   - Requires approved spec
   - Generates a planning package:
     - `docs/plan/<feature>.md` (master plan doc)
     - Overwrites `backlog/<feature>/backlog.md`
     - Overwrites `tests/<feature>/tests.md`
   - Content is a structured starting point; AI agents and humans refine it.

6) `aitri validate`
- Requires approved spec + generated artifacts
- Fails if backlog/tests contain placeholders like `FR-?`, `AC-?`, `US-?`
- Enforces minimum traceability discipline:
  - Backlog must contain `### US-<n>`
  - Tests must contain `### TC-<n>`

## Personas
Aitri uses persona checklists to improve quality and avoid blind spots:

- Architect (`core/personas/architect.md`)
  - boundaries, components, resilience, observability, risks

- Security (`core/personas/security.md`)
  - threat model, required controls, validation, abuse prevention

- QA (`core/personas/qa.md`)
  - test strategy, edge cases, acceptance criteria quality

## Agent Integration (Skills)
Aitri is designed to be used as a **tool** by AI agents:
- Codex: `adapters/codex/SKILL.md`
- Claude: `adapters/claude/SKILL.md`
- OpenCode (if used): `adapters/opencode/...`

Agents must:
- run commands one at a time
- respect PLAN → approval gates
- avoid implementation before approved artifacts

## Current Status
- Stable CLI commands: init, draft, approve, discover, plan, validate
- Templates: spec, discovery, plan
- Personas integrated (architect, security, QA)
- Basic traceability enforcement (FR / AC / US / TC placeholders blocked)
- Skills: Codex + Claude

## Roadmap (Next)

1) Coverage reporting:
   - Verify each FR has at least one US
   - Verify each US has at least one TC
   - Provide coverage report

2) CLI stability features:
   - `aitri --version`
   - Release tagging discipline

3) Optional AI API integration (after skill workflow maturity)

4) Controlled build phase support (post-artifact approval)

## V1 Scope – AI-Assisted SDLC Execution

### Definition of Done (V1)

Aitri V1 is considered complete when:

1. It can be installed globally via terminal.
2. It exposes a stable CLI (`aitri help`, `--version`, core commands).
3. It enforces Spec-Driven Development gates.
4. It integrates with AI agents (Codex, Claude, OpenCode) via skills.
5. Agents can:
   - Run Aitri commands
   - Generate backlog/tests content
   - Execute validation
   - Request human approval before implementation

V1 does NOT:
- Autonomously write production code without human approval.
- Replace human architectural decisions.
- Remove gate enforcement.

## AI Execution Model (V1)

Execution flow:

Human → Agent (Codex/Claude/OpenCode) → Aitri CLI → Filesystem → Validation → Human Approval

Aitri is deterministic.
AI is generative.
Human is authority.

Aitri enforces structure and traceability.
AI generates content within constraints.
Human approves before moving to build phase.

## Installation Model

V1 must support:

- Global CLI installation
- Invocation from any project directory
- Agent skill-based invocation
- Repeatable version detection (`aitri --version`)