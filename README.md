```
   █████╗ ██╗████████╗██████╗ ██╗
  ██╔══██╗██║╚══██╔══╝██╔══██╗██║
  ███████║██║   ██║   ██████╔╝██║
  ██╔══██║██║   ██║   ██╔══██╗██║
  ██║  ██║██║   ██║   ██║  ██║██║
  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝
```

**Spec-driven SDLC engine for AI-assisted development.**

![npm](https://img.shields.io/npm/v/aitri) ![node](https://img.shields.io/node/v/aitri) ![license](https://img.shields.io/npm/l/aitri)

```
npm install -g aitri
```

---

Aitri structures AI-assisted development into a five-phase pipeline — requirements, architecture, test design, implementation, and deployment. Each phase produces a versioned artifact. You review and approve before the next phase begins.

Works with any agent that reads stdout: Claude Code, Codex, Gemini Code, Opencode, or any shell-based workflow.

---

## Pipeline

```
IDEA.md
    ↓
[optional] Discovery — Facilitator           → 00_DISCOVERY.md
    ↓
Phase 1   — Product Manager                  → 01_REQUIREMENTS.json
    ↓
[optional] UX — UX/UI Designer               → 01_UX_SPEC.md
    ↓
Phase 2   — Software Architect               → 02_SYSTEM_DESIGN.md
    ↓
Phase 3   — QA Engineer                      → 03_TEST_CASES.json
    ↓
Phase 4   — Full-Stack Developer             → 04_IMPLEMENTATION_MANIFEST.json
    ↓
          ✦ Verify                           → 04_TEST_RESULTS.json
    ↓
[optional] Code Review — Reviewer            → 04_CODE_REVIEW.md
    ↓
Phase 5   — DevOps Engineer                  → 05_PROOF_OF_COMPLIANCE.json
```

---

## Quick Start

```bash
mkdir my-app && cd my-app
aitri init

# Edit IDEA.md — or run aitri wizard for a guided interview

aitri run-phase 1
aitri complete 1
aitri approve 1

# Repeat for phases 2, 3, 4

aitri verify-run
aitri verify-complete

aitri run-phase 5
aitri complete 5 && aitri approve 5
```

---

## Commands

### Core loop

| Command | What it does |
| :--- | :--- |
| `aitri init` | Initialize project — creates IDEA.md and `.aitri` state file |
| `aitri wizard` | Interactive interview to build IDEA.md (quick / standard / deep) |
| `aitri run-phase <phase>` | Print phase briefing to stdout — your agent reads and acts on it |
| `aitri complete <phase>` | Validate artifact schema and record the phase as done |
| `aitri approve <phase>` | Approve with a human review checklist — unlocks the next phase |
| `aitri reject <phase> --feedback "..."` | Send feedback — next briefing incorporates it |

### Test gate

| Command | What it does |
| :--- | :--- |
| `aitri verify-run` | Execute the test suite, parse TC results, write `04_TEST_RESULTS.json` |
| `aitri verify-complete` | Confirm all TCs pass and all FRs are covered — unlocks Phase 5 |

### Status

| Command | What it does |
| :--- | :--- |
| `aitri status` | Show pipeline state |

Phases: `1–5`, `discovery`, `ux`, `review`

For the full command reference: `aitri help`

---

## Adopting an Existing Project

```bash
cd existing-project

# Guided path — agent produces the adoption plan
aitri adopt scan
# agent writes ADOPTION_SCAN.md (diagnostic) and IDEA.md (stabilization plan)
aitri adopt apply
# then run the pipeline from Phase 1 as usual

# Direct entry — skip the scan
aitri adopt apply --from 4    # has code, no formal specs
aitri adopt apply --from 1    # start from requirements on an existing codebase

# Upgrade an existing Aitri project
aitri adopt --upgrade
```

---

## Compatible Agents

| Agent | Notes |
| :--- | :--- |
| Claude Code | Run `aitri run-phase N` in your session — Claude reads stdout |
| Codex CLI | Same |
| Gemini Code | Same |
| Opencode | Same |
| Any shell agent | Aitri writes to stdout; the agent writes files |

---

## Requirements

- Node.js 18+
- No external dependencies

## License

Apache 2.0 — © César Augusto Reyes Serrano
