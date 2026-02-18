# Phase MNOP — Aitri as Real Software Factory

## Context

Phases I/J/K (v0.3.0) completed the incremental product loop:
feedback → triage → amend → re-deliver. What remained was the core gap:
Aitri produced disciplined documentation but not software. Phases M/O/N/P
close that gap.

**Target state after MNOP:**
```
describe what you want → Aitri produces verified, traceable software
```

---

## Phase M: Enforcement Layer

**Problem:** Aitri is voluntary. No hooks = no guardrail.

### Commands

**`aitri hooks install`** — writes git hooks to `.git/hooks/`
- `pre-commit`: warns if staged files have no traceable spec context
- `pre-push`: runs `aitri validate` for the current branch feature
- `--hook pre-commit|pre-push|all` (default: all)
- Idempotent: safe to run multiple times

**`aitri hooks status`** — detects installed hooks and their version

**`aitri hooks remove`** — removes aitri-managed hooks

**`aitri ci init`** — generates CI pipeline file
- `--provider github|gitlab|bitbucket` (default: github)
- Generates `.github/workflows/aitri.yml` with: doctor + validate + test gates
- Idempotent

### Config schema (`.aitri.json`)
```json
{
  "hooks": {
    "preCommit": true,
    "prePush": true
  }
}
```

### Artifacts
- `.git/hooks/pre-commit` (contains `# Aitri pre-commit hook` marker)
- `.git/hooks/pre-push` (contains `# Aitri pre-push hook` marker)
- `.github/workflows/aitri.yml`

### Backward compatibility
Pure addition. No existing commands affected.

---

## Phase O: Semantic Quality Layer

**Problem:** gates verify section presence, not content quality.
A spec with `- FR-1: The system shall work` passes all gates.

### Commands

**`aitri validate --depth semantic`** — adds LLM-based quality scoring
- Evaluates each FR for testability (is there an implicit pass/fail criterion?)
- Evaluates persona sections for substance vs. placeholder text
- Adds `semanticScore` (0–100) and `semanticIssues[]` to JSON output
- If score < `minSemanticScore` (config, default 60): adds to persona gaps
- Degrades gracefully: if AI not configured, prints warning but does not fail

**`aitri spec-improve --feature <name>`** — LLM suggestions for spec quality
- Reads draft or approved spec
- Returns: list of concrete improvement suggestions per section
- NEVER modifies the spec — read-only, suggest-only
- `--non-interactive --json`: `{ ok, feature, suggestions: ["..."] }`
- If AI not configured: `{ ok: false, error: "AI not configured", hint: "..." }`

### `cli/ai-client.js`

Thin provider-agnostic client. Uses native `fetch` (Node 18+).
No SDK dependencies.

Supported providers:
- `claude`: `POST https://api.anthropic.com/v1/messages`
- `openai`: `POST https://api.openai.com/v1/chat/completions`
- `gemini`: `POST https://generativelanguage.googleapis.com/v1beta/models/...`

API key read from environment variable specified in config (`apiKeyEnv`).

```js
// Usage:
const result = await callAI({ prompt, systemPrompt, config });
// result: { ok: true, content: "..." } | { ok: false, error: "..." }
```

### Config schema (`.aitri.json`)
```json
{
  "ai": {
    "provider": "claude",
    "model": "claude-opus-4-6",
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "minSemanticScore": 60
  }
}
```

### Backward compatibility
- `validate` without `--depth semantic` behaves exactly as before.
- `spec-improve` is additive (new command).

---

## Phase N: AI Execution Engine

**Problem:** `build` generates briefs. A human/agent reads them and writes code.
Aitri cannot verify the output is correct.

**This is the core value unlock.** Phase N makes Aitri a software factory.

### Command

**`aitri execute --story US-N`** — AI-driven story implementation

Flow:
1. Gate: `go.json` must exist (same as build)
2. Read: spec + plan + brief (`docs/implementation/<feature>/US-N.md`) + TC list
3. Build context-optimized prompt for AI
4. Call AI provider (from config)
5. Parse response: extract `### FILE: path/to/file` blocks
6. Show generated file plan, ask for confirmation
7. Write files to project root
8. Run test suite (`npm test` or detected test command)
9. Map test results to TC-N IDs
10. Write execution evidence to `docs/execution/<feature>-US-N.json`

**`aitri execute --all`** — process all stories in `IMPLEMENTATION_ORDER.md`
- Sequential: each story waits for previous to complete
- Stops on first failure (unless `--continue-on-fail`)

Flags:
- `--story US-N`: target specific story
- `--all`: all stories in order
- `--dry-run`: show prompt + file plan without writing
- `--no-test`: skip test run after generation
- `--continue-on-fail`: don't stop on story failure (used with --all)

### AI response format

System prompt instructs the AI to return ONLY structured file blocks:
```
### FILE: src/controllers/order.js
```javascript
// implementation code
```

### FILE: src/models/order.js
```javascript
// model code
```
```

Parser: splits on `### FILE: ` lines, extracts path and code block.

### Execution evidence (`docs/execution/<feature>-US-N.json`)
```json
{
  "schemaVersion": 1,
  "feature": "payment-api",
  "story": "US-1",
  "executedAt": "2026-02-18T...",
  "aiProvider": "claude",
  "filesGenerated": ["src/controllers/order.js"],
  "testResult": { "passed": true, "exitCode": 0, "output": "..." },
  "tcsCovered": ["TC-1", "TC-2"]
}
```

### Failure modes
- AI not configured → helpful error, suggest configuring `.aitri.json`
- AI returns no FILE blocks → error, show raw AI response for debugging
- Tests fail → report which TCs failed, suggest `aitri execute --story US-N` to retry
- No brief found → error, suggest `aitri build --story US-N` first

### Version N.2 (future)
- Automatic retry loop (max N iterations) when tests fail
- Each retry includes the failing test output as context to the AI
- Convergence detection (avoid trivial hardcoded solutions)

### Backward compatibility
`execute` is additive. `build` still works and generates briefs.
`execute` consumes those briefs. The two are complementary.

---

## Phase P: Visibility Layer

**Problem:** Aitri is CLI-only. Product managers and stakeholders cannot
see project state without terminal access.

### Command

**`aitri serve`** — local project dashboard

- Uses `node:http` — zero external dependencies
- Default port: 4173 (or `--port`)
- Reads data from: `docs/roadmap.json` (if exists) or live via `scanAllFeatures`
- Shows: feature table, state indicators, open feedback count, last delivery
- Auto-opens browser (darwin: `open`, linux: `xdg-open`, windows: `start`)
- `--no-open`: skip browser open
- Keeps running until Ctrl+C

Dashboard sections:
1. **Summary** — total / delivered / in progress / draft / open feedback
2. **Feature Table** — name, state, version, feedback, nextStep
3. **Recent Deliveries** — last 5 SHIP decisions with dates

HTML: single inline page, no framework, minimal CSS, dark mode.

### Backward compatibility
Pure addition. No existing commands affected.

---

## Dependency order

```
M (enforcement — no AI needed)
  └─ O (semantic quality — needs AI client)
       └─ N (execution — needs AI client + O quality guarantee)
            └─ P (visibility — shows N results)
```

M can be used independently of O/N/P.
O can be used without N (just improves spec quality).
N requires O-quality specs to produce good results.
P shows the full picture including N execution results.

---

## Config reference (complete `.aitri.json` schema after MNOP)

```json
{
  "paths": { "specs": "specs", "backlog": "backlog", "tests": "tests", "docs": "docs" },
  "policy": {
    "allowDependencyChanges": false,
    "goRequireGit": false,
    "blockedImports": [],
    "blockedPaths": []
  },
  "delivery": {
    "confidenceThreshold": 0.85
  },
  "ai": {
    "provider": "claude",
    "model": "claude-opus-4-6",
    "apiKeyEnv": "ANTHROPIC_API_KEY",
    "minSemanticScore": 60,
    "maxIterations": 3
  },
  "hooks": {
    "preCommit": true,
    "prePush": true
  },
  "webhooks": [
    { "event": "deliver.ship", "url": "https://hooks.slack.com/..." }
  ]
}
```

---

## What "software factory" means after MNOP

```bash
# 1. Define what you want
aitri draft --feature checkout-flow --idea "users complete purchases"
aitri approve --feature checkout-flow
aitri plan --depth semantic --feature checkout-flow  # O: quality TCs

# 2. Gates
aitri go --feature checkout-flow  # M: hooks enforce this on every push

# 3. Factory execution
aitri execute --all --feature checkout-flow  # N: AI writes + tests code

# 4. Delivery
aitri deliver --feature checkout-flow
# → SHIP · 12 TCs passing · tag: aitri-release/checkout-flow-v1

# 5. Visibility
aitri serve  # P: PM opens browser, sees project state
aitri roadmap  # one-line status
aitri changelog  # CHANGELOG.md generated from delivery history
```

That is what a software factory looks like.
