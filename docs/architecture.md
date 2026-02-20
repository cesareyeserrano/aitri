# Aitri: Architecture and Operating Model

## What Aitri Is

Aitri is a **spec enforcement CLI** for AI-assisted software delivery.

It enforces one rule: no artifact (backlog, test stub, implementation brief, scaffold) can exist without a human-approved specification that precedes it.

It operates as a **skill consumed by AI agents** (Claude, Codex, OpenCode) as their system of record, and is also available for direct terminal use.

**What Aitri does:**
- Validates that agent-generated content (backlogs, test cases) traces back to approved spec sections (FR-*, AC-*)
- Blocks writes when traceability is missing
- Generates structured artifacts (test stubs, implementation briefs) from approved specs
- Tracks delivery gates: spec → backlog → tests → scaffold → verify → deliver
- Supports existing projects via `aitri adopt` (scan + LLM infer + test map)

**What Aitri does not do:**
- Execute code or run tests directly
- Generate requirements — requirements must come from the user
- Guarantee correctness of agent-generated content, only structural traceability
- Replace human judgment at approval gates

---

## Roles

| Role | Responsibility |
|------|----------------|
| **Human** | Provides intent, approves specs, authorizes delivery |
| **AI agent** | Authors backlog, tests, and code under Aitri's format contracts |
| **Aitri** | Validates traceability, enforces gates, generates structured scaffolding |

---

## Non-Negotiable Principles

1. **Spec first.** No downstream artifact without `specs/approved/<feature>.md`.
2. **Explicit gates.** Write operations require confirmation. Automation requires `--yes`.
3. **Traceability required.** Spec → Backlog → Tests → Implementation. Every item has a traceable ID.
4. **Human authority.** Final decisions always remain with the human owner.
5. **Requirement source integrity.** Requirements come from explicit user input. Aitri does not invent them.
6. **Idempotent writes.** Running any command twice must not corrupt state.

---

## Command Flow

### Pre-Go (Governance)
1. `aitri init` — initialize project structure
2. `aitri draft` — create draft spec from idea
3. `aitri spec-improve` — AI quality review of spec (identifies ambiguous FRs, missing edge cases)
4. `aitri approve` — validate and lock spec
5. `aitri discover` — structured discovery interview artifact
6. `aitri plan` — generate plan, backlog, and tests from spec
   - Default: Aitri infers from spec
   - Auditor Mode: `--ai-backlog <file> --ai-tests <file>` — validate agent-authored content before writing
7. `aitri verify-intent` — semantic validation: US satisfies FR intent (LLM)
8. `aitri diff --proposed <file>` — compare current backlog against proposed update
9. `aitri validate` — traceability gate
10. `aitri verify` — runtime test execution
11. `aitri go` — unlock implementation mode

### Post-Go (Factory)
12. `aitri scaffold` — executable test stubs with contract imports, interface stubs
13. `aitri implement` — ordered implementation briefs for AI agents
14. `aitri deliver` — final gate: all FRs covered, all TCs passing

### Session Continuity
- `aitri checkpoint [message]` — save state to `.aitri/DEV_STATE.md`
- `aitri checkpoint show` — read saved state
- `aitri resume` — recommend next action

### Brownfield Onboarding
- `aitri adopt` — Phase 1: scan stack, conventions, entry points, write `adoption-manifest.json`
- `aitri adopt --depth standard` — Phase 2: LLM infers DRAFT specs + discovery docs
- `aitri adopt --depth deep` — Phase 3: map existing tests → TC-* stubs
- `aitri upgrade` — apply version-aware migrations to projects built with older Aitri versions

---

## Auditor Mode

The preferred agent flow. The agent authors content; Aitri audits before writing.

```bash
aitri plan --feature <name> --ai-backlog agent-backlog.md --ai-tests agent-tests.md
```

Aitri validates:
- Every US has a `Trace:` line
- Every FR-* referenced exists in the approved spec
- Every AC-* referenced exists in the approved spec
- Every TC has a `Trace:` line referencing valid US-* and FR-*

If validation fails, nothing is written. Fix the reported issues and retry.

---

## Artifact Topology

```
specs/
  drafts/<feature>.md       # DRAFT — not enforced
  approved/<feature>.md     # APPROVED — enforcement starts here

docs/
  discovery/<feature>.md
  plan/<feature>.md
  implementation/<feature>/US-N.md
  implementation/<feature>/IMPLEMENTATION_ORDER.md
  verification/<feature>.json
  delivery/<feature>.json
  adoption-manifest.json    # written by aitri adopt
  project.json              # aitriVersion + migrationsApplied

backlog/<feature>/backlog.md
tests/<feature>/tests.md
tests/<feature>/generated/  # test stubs from aitri scaffold

src/                        # scaffolded structure (contracts, stubs)
.aitri/DEV_STATE.md         # current session checkpoint
```

---

## Agent Integration Contract

**Session start:**
```bash
aitri checkpoint show
aitri resume json   # read recommendedCommand
```

**Pre-go (Auditor Mode):**
```bash
aitri draft --feature <name> --idea "<intent>"
aitri approve --feature <name>
# agent generates agent-backlog.md + agent-tests.md
aitri diff --feature <name> --proposed agent-backlog.md
aitri plan --feature <name> --ai-backlog agent-backlog.md --ai-tests agent-tests.md
aitri verify-intent --feature <name>
aitri validate --feature <name>
aitri go --feature <name> --yes
```

**Post-go:**
```bash
aitri scaffold --feature <name> --yes
aitri implement --feature <name>
# agent implements each US-* brief in order
aitri verify --feature <name>   # after each story
aitri deliver --feature <name>
```

**Session end:**
```bash
aitri checkpoint "<what was done — next: <what to do>"
```

---

## AI Configuration (for LLM-powered commands)

Add to `aitri.config.json`:
```json
{
  "ai": {
    "provider": "claude",
    "model": "claude-opus-4-6",
    "apiKeyEnv": "ANTHROPIC_API_KEY"
  }
}
```

Required by: `spec-improve`, `verify-intent`, `aitri adopt --depth standard`.

---

## Stabilization State (2026-02-20)

- Version: 0.4.0 (pre-release 0.5.0 scope delivered on main)
- EVO backlog: EVO-001 through EVO-009 — all complete
- Auditor Mode: ACTIVE
- Commands delivered: `verify-intent`, `diff`, `spec-improve`, `checkpoint`, `adopt` (3 phases), `upgrade` (v2)
- Tests: 158/158 green

## Governance

Documentation changes that affect workflow or scope must update:
1. `docs/architecture.md` (this file)
2. `adapters/*/SKILL.md` (agent-facing contract)

Do not create new `docs/` files without deleting an equivalent-weight existing file. See `docs/DOC_POLICY.md`.
