```
   █████╗ ██╗████████╗██████╗ ██╗
  ██╔══██╗██║╚══██╔══╝██╔══██╗██║
  ███████║██║   ██║   ██████╔╝██║
  ██╔══██║██║   ██║   ██╔══██╗██║
  ██║  ██║██║   ██║   ██║  ██║██║
  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝
```

**Spec-Driven SDLC Engine. Agent-agnostic.**

![npm](https://img.shields.io/npm/v/aitri) ![node](https://img.shields.io/node/v/aitri) ![license](https://img.shields.io/npm/l/aitri)

```
npm install -g aitri
```

Aitri turns your idea into a production-ready app through a structured 5-phase pipeline. Each phase is handled by a specialized AI persona. You approve every artifact before the next phase begins — no phase auto-advances.

---

## Pipeline

```
YOUR IDEA (IDEA.md)
    ↓
[optional] Phase Discovery — Facilitator     → 00_DISCOVERY.md
    ↓
Phase 1 — Product Manager                    → 01_REQUIREMENTS.json
    ↓ (you approve)
[optional] Phase UX — UX/UI Designer         → 01_UX_SPEC.md
    ↓
Phase 2 — Software Architect                 → 02_SYSTEM_DESIGN.md
    ↓ (you approve)
Phase 3 — QA Engineer                        → 03_TEST_CASES.json
    ↓ (you approve)
Phase 4 — Full-Stack Developer               → src/ + 04_IMPLEMENTATION_MANIFEST.json
    ↓ (you approve)
[optional] Phase review — Code Reviewer      → 04_CODE_REVIEW.md
    ↓
    ✦ VERIFY                                 → 04_TEST_RESULTS.json (gate: all tests pass)
    ↓
Phase 5 — DevOps Engineer                    → Dockerfile + 05_PROOF_OF_COMPLIANCE.json
```

---

## Quick Start

```bash
mkdir my-app && cd my-app
aitri init                          # creates IDEA.md
# Edit IDEA.md — describe the problem, users, requirements, success criteria
# Or: aitri wizard  to fill IDEA.md interactively

aitri run-phase 1                   # agent reads briefing → saves 01_REQUIREMENTS.json
aitri complete 1                    # validate artifact
aitri approve 1                     # or: aitri reject 1 --feedback "..."

# Repeat run-phase / complete / approve for phases 2, 3, 4

aitri verify-run                    # runs real tests, writes 04_TEST_RESULTS.json
aitri verify-complete               # gate: all TCs pass + FR coverage confirmed

aitri run-phase 5
aitri complete 5 && aitri approve 5
```

---

## Commands

| Command | What it does |
| :--- | :--- |
| `aitri init` | Initialize project — creates IDEA.md and `.aitri` state |
| `aitri wizard` | Interactive TTY interview to build IDEA.md (depths: quick / standard / deep) |
| `aitri run-phase <phase>` | Print phase briefing to stdout — agent reads and acts |
| `aitri complete <phase>` | Validate artifact schema + record as done |
| `aitri approve <phase>` | Approve with interactive checklist — unlocks next phase |
| `aitri reject <phase> --feedback ""` | Reject with feedback — re-run briefing with it applied |
| `aitri verify-run` | Run real tests, parse TC results, write 04_TEST_RESULTS.json |
| `aitri verify-complete` | Gate: all TCs pass + all FRs covered → unlocks Phase 5 |
| `aitri status` | Show pipeline state (ASCII) |
| `aitri status --json` | Show pipeline state as machine-readable JSON (for scripts, CI, Hub) |
| `aitri validate` | Validate all artifacts against current schemas |
| `aitri validate --json` | Same, as machine-readable JSON |
| `aitri resume` | Print session handoff briefing for a new agent or team member |
| `aitri feature init <name>` | Start a feature sub-pipeline (new work on an existing project) |
| `aitri adopt scan` | Scan existing project → briefing for agent → `ADOPTION_PLAN.md` |
| `aitri adopt apply` | Apply adoption plan → initialize Aitri on an existing project |
| `aitri adopt apply --from <N>` | Initialize at phase N — no ADOPTION_PLAN.md needed (1=greenfield, 4=has code) |
| `aitri adopt --upgrade` | Update `.aitri` state from existing artifacts (non-destructive) |
| `aitri checkpoint` | Snapshot current pipeline state to `checkpoints/` |

Phases: `1-5`, `discovery`, `ux`, `review`

Full reference: `aitri help`

---

## Adopting an Existing Project

```bash
cd existing-project

# Option A: guided scan (agent produces ADOPTION_PLAN.md)
aitri adopt scan                    # scans codebase → briefing for your agent
# agent produces ADOPTION_PLAN.md
aitri adopt apply                   # initializes Aitri from the plan

# Option B: direct entry (skip ADOPTION_PLAN.md)
aitri adopt apply --from 4          # project has code but no formal specs → enter at Phase 4
aitri adopt apply --from 1          # start fresh from requirements on an existing codebase

# Option C: upgrade an existing Aitri project
aitri adopt --upgrade               # sync .aitri state with artifacts already on disk
```

---

## Compatible Agents

| Agent | How to use |
| :--- | :--- |
| Claude Code | Run `aitri run-phase N` — Claude Code reads stdout and acts |
| Codex CLI | Same — any agent reading stdout works |
| Gemini Code | Same |
| Opencode | Same |
| Any bash agent | Same — Aitri outputs to stdout, agent writes files |

---

## Design Principles

| Principle | What it means |
| :--- | :--- |
| Stateless | Every command reads/writes `.aitri`. Reproducible in CI/CD. |
| Zero dependencies | Node.js built-ins only. Works anywhere Node 18+ is installed. |
| stdout protocol | `run-phase` prints the briefing. Any agent reads it. No integration needed. |
| Human gates | Every phase requires explicit `aitri approve` with a checklist. No auto-advance. |
| Machine-readable | `status --json` and `validate --json` for scripts, CI, and monitoring tools. |

---

## Requirements

- Node.js 18+

## License

Apache 2.0 — © César Augusto Reyes Serrano
