# Aitri — Artifact Schema Reference

**Aitri version:** v0.1.64+
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

## Optional artifacts

| File | Written by | Condition |
|---|---|---|
| `00_DISCOVERY.md` | `aitri run-phase discovery` | Optional phase; present if discovery was run |
| `01_UX_SPEC.md` | `aitri run-phase ux` | Optional phase; present if UX phase was run |
| `04_CODE_REVIEW.md` | Phase 4 review sub-phase | Present if code review was run |

Check `approvedPhases[]` and `completedPhases[]` in `.aitri` to determine which optional artifacts exist before attempting to read them.

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
