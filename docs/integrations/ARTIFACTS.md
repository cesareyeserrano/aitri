# Aitri — Artifact Schema Reference

**Aitri version:** v0.1.66+
**Maintenance rule:** Update this file in the same commit as any artifact schema change.

All artifacts live in `<project>/<artifactsDir>/`. For new projects `artifactsDir = "spec"`.
Check `artifactsDir` in `.aitri` before constructing paths. See [SCHEMA.md](./SCHEMA.md).

---

## 01_REQUIREMENTS.json

Written by Phase 1 (PM persona). Source of truth for Epics, Features, and User Stories.

```json
{
  "project_name": "string",
  "epics": [
    {
      "id": "EP-001",
      "title": "string",
      "description": "string",
      "features": [
        {
          "id": "FR-001",
          "title": "string",
          "priority": "MUST | SHOULD | COULD | WONT",
          "type": "functional | non-functional | constraint",
          "description": "string",
          "acceptance_criteria": [
            {
              "id": "AC-001",
              "description": "string"
            }
          ],
          "user_stories": [
            {
              "id": "US-001",
              "title": "string",
              "as_a": "string",
              "i_want": "string",
              "so_that": "string",
              "ac_id": "AC-001"
            }
          ]
        }
      ]
    }
  ]
}
```

**Phase gate:** Approved when `"1"` is in `approvedPhases[]`.

---

## 02_SYSTEM_DESIGN.md

Written by Phase 2 (Architect persona). Markdown document — no fixed JSON schema.
Typically includes: architecture decisions, component breakdown, NFR mapping, data flow.

**Phase gate:** Approved when `"2"` is in `approvedPhases[]`.

---

## 03_TEST_CASES.json

Written by Phase 3 (QA persona). Test case definitions keyed to FRs and ACs.

```json
{
  "test_cases": [
    {
      "id": "TC-001",
      "title": "string",
      "fr_id": "FR-001",
      "ac_id": "AC-001",
      "type": "happy | edge | failure",
      "steps": ["string"],
      "expected_result": "string"
    }
  ]
}
```

**Phase gate:** Approved when `"3"` is in `approvedPhases[]`.

---

## 04_IMPLEMENTATION_MANIFEST.json

Written by Phase 4 (Developer persona). Implementation tracking per FR.

```json
{
  "implementation": [
    {
      "fr_id": "FR-001",
      "status": "pending | in_progress | complete",
      "files": ["string"],
      "notes": "string"
    }
  ]
}
```

**Phase gate:** Approved when `"4"` is in `approvedPhases[]`.

---

## 04_TEST_RESULTS.json

Written by `aitri verify-run`. Actual test execution output.

```json
{
  "runner": "vitest | jest | pytest | playwright | mocha",
  "passed": 0,
  "failed": 0,
  "skipped": 0,
  "total": 0,
  "test_cases": [
    {
      "id": "TC-001",
      "status": "pass | fail | skip",
      "notes": "string"
    }
  ]
}
```

Presence implies `verifyPassed` in `.aitri` reflects the last run result.

---

## 05_PROOF_OF_COMPLIANCE.json

Written by Phase 5 (DevOps persona). FR coverage proof linking requirements to test results.

```json
{
  "compliance": [
    {
      "fr_id": "FR-001",
      "requirement_compliance": "compliant | partial | non-compliant",
      "evidence": "string",
      "tc_ids": ["TC-001"]
    }
  ]
}
```

**Phase gate:** Approved when `"5"` is in `approvedPhases[]`. Requires `verifyPassed: true`.

---

## BUGS.json

**Written by:** `aitri bug add` (manual) or `aitri verify-run` (auto-prompt on test failure).
**Location:** `<artifactsDir>/BUGS.json` — same directory as other artifacts.
**Optional:** absent until the first bug is registered.

First-class QA artifact. Follows standard bug report format: reproduction steps, expected/actual results, environment, evidence. Integrates with the verify pipeline: `verify-run` auto-promotes `fixed → verified` when the linked TC passes. Critical/high open bugs block `verify-complete`.

```json
{
  "bugs": [
    {
      "id": "BG-001",
      "title": "string — action + result",
      "description": "string",
      "steps_to_reproduce": ["string"],
      "expected_result": "string",
      "actual_result": "string",
      "environment": "string (e.g. 'local / chromium / Phase 4')",
      "severity": "critical | high | medium | low",
      "status": "open | fixed | verified | closed",
      "fr": "FR-XXX | null",
      "tc_reference": "TC-XXX | null",
      "phase_detected": "number | null",
      "detected_by": "manual | verify-run | playwright | review",
      "evidence": "relative path to screenshot/video/log | null",
      "reported_by": "string | null",
      "created_at": "ISO8601",
      "updated_at": "ISO8601",
      "resolution": "string | null"
    }
  ]
}
```

**Lifecycle:** `open → fixed → verified → closed`
- `fixed`: developer marks resolved (`aitri bug fix`) — optionally links a TC
- `verified`: auto-set by `verify-run` when linked TC passes, or manually via `aitri bug verify`
- `closed`: archived

**Blocking rule:** bugs with `status: "open"` and `severity: "critical"` or `"high"` block `verify-complete`.
**Playwright integration:** when Playwright runs in `verify-run` and a TC fails, `evidence` is auto-populated from `test-results/<folder>/screenshot.png` if the folder exists.

---

## Optional artifacts

| File | Written by | Condition |
|---|---|---|
| `00_DISCOVERY.md` | `aitri run-phase discovery` | Optional phase; present if discovery was run |
| `01_UX_SPEC.md` | `aitri run-phase ux` | Optional phase; present if UX phase was run |
| `04_CODE_REVIEW.md` | Phase 4 review sub-phase | Present if code review was run |
| `BUGS.json` | `aitri bug add` / `aitri verify-run` | Present if any bug has been registered |

Check `approvedPhases[]` and `completedPhases[]` in `.aitri` to determine which optional artifacts exist before attempting to read them.

---

## 06_EXTERNAL_SIGNALS.json

**Written by:** external tools (ESLint, npm audit, GitLeaks, Snyk, custom scripts — anything). **Not** written by Aitri Core.
**Read by:** Hub (surfaces signals as alerts). Other subproducts may ignore this file.
**Optional:** if absent or malformed, no signals are generated — no crash.

This file is the integration point for tools that Hub cannot run directly (static analysis, dependency auditing, security scanning, etc.). Each tool writes its findings here; Hub reads them as-is.

```json
{
  "generatedAt": "2026-03-18T14:00:00Z",
  "signals": [
    {
      "tool":     "eslint",
      "type":     "code-quality",
      "severity": "warning",
      "message":  "15 lint errors found in src/",
      "command":  "npm run lint"
    },
    {
      "tool":     "npm-audit",
      "type":     "dependency",
      "severity": "blocking",
      "message":  "2 critical vulnerabilities in dependencies",
      "command":  "npm audit fix"
    },
    {
      "tool":     "gitleaks",
      "type":     "security",
      "severity": "blocking",
      "message":  "Possible secret detected in src/config.js:42",
      "command":  "gitleaks detect"
    }
  ]
}
```

### Field reference

| Field | Type | Required | Notes |
|---|---|---|---|
| `generatedAt` | ISO8601 string | No | When the tool ran — for freshness display |
| `signals` | array | Yes | Empty array = no signals |
| `signals[].tool` | string | Yes | Tool name shown in Hub alert (e.g. `"eslint"`) |
| `signals[].type` | string | Yes | Category label (e.g. `"code-quality"`, `"security"`, `"dependency"`) |
| `signals[].severity` | string | Yes | `"blocking"` \| `"warning"` \| `"info"` — invalid values coerced to `"warning"` |
| `signals[].message` | string | Yes | Human-readable description — shown as alert message |
| `signals[].command` | string | No | Command to resolve the issue — shown as inline code badge in Hub |

### How Hub renders signals

Each signal becomes one alert in Hub's health report:
- `severity: "blocking"` → appears in BLOCKING section, blocks triage
- `severity: "warning"` → appears in WARNING section
- `severity: "info"` → appears in INFO section
- Message is prefixed with `[tool]` — e.g. `[eslint] 15 lint errors found in src/`
- `command` shown as a copyable badge if present

### Integration examples

**npm audit (package.json script):**
```json
"scripts": {
  "hub:signals": "node scripts/generate-signals.js"
}
```

**Minimal shell script:**
```bash
#!/bin/bash
RESULT=$(npm audit --json 2>/dev/null)
CRITICAL=$(echo "$RESULT" | jq '.metadata.vulnerabilities.critical // 0')
cat > spec/06_EXTERNAL_SIGNALS.json << EOF
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "signals": [
    {
      "tool": "npm-audit",
      "type": "dependency",
      "severity": $([ "$CRITICAL" -gt 0 ] && echo '"blocking"' || echo '"warning"'),
      "message": "$CRITICAL critical vulnerabilities",
      "command": "npm audit fix"
    }
  ]
}
EOF
```

Run this script in CI or as a pre-commit hook. Hub picks it up on the next poll cycle.

---

## Node hierarchy for graph consumers

Aitri artifacts form a natural hierarchy for visualization:

```
Epic (EP-xxx)
  └── Feature / FR (FR-xxx)  [priority, type]
        ├── Acceptance Criteria (AC-xxx)
        ├── User Story (US-xxx) → links to AC via ac_id
        └── Test Case (TC-xxx) → links to FR via fr_id, AC via ac_id
```

State of each node is derived from `.aitri`:
- Phase 1 approved → Requirements nodes are `approved`
- Phase 1 in drift → Requirements nodes are `drift`
- Phase 3 approved → Test Case nodes are `approved`
- Current phase matches → node is `in_progress`
- Otherwise → `pending`
