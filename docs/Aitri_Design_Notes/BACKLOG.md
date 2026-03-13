# Aitri — Backlog

> Open items only. Closed items are in CHANGELOG.md.
> Priority: P1 (critical) / P2 (important) / P3 (nice to have)

---

## Implementation Strategy

> Scoring: Value × 4 + Severity × 3 + Impact × 2 − Risk. Value is the primary driver.
> Last prioritized: 2026-03-12.

### Tier 1 — Immediate (correctness + foundational input)
Fix active bugs and secure the pipeline's input quality before adding features.

| Rank | Item | Score | Why first |
| ---: | :--- | :---: | :--- |
| ~~1~~ | ~~`status` / `validate` inconsistency + Artifact drift detection~~ | 43 | ✅ **Done v0.1.26** |
| ~~2~~ | ~~Structured IDEA.md template~~ | 40 | ✅ **Done v0.1.29** |
| ~~3~~ | ~~Three Amigos gate (ac_id validation)~~ | 38 | ✅ **Done v0.1.30** |
| ~~4~~ | ~~Requirement Source Integrity (PM persona)~~ | 37 | ✅ **Done (pre-existing)** |
| ~~5~~ | ~~verify-run Vitest / parser fragility~~ | 35 | ✅ **Done (pre-existing)** |

### Tier 2 — Short-term (quality + adoption)
High value, contained implementations. No item here blocks another.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| ~~6~~ | ~~`aitri feature` sub-pipeline~~ | 33 | ✅ **Done v0.1.31** |
| ~~7~~ | ~~Best practice docs injected into briefings~~ | 31 | ✅ **Done v0.1.28** — templates + injection in run-phase.js |
| ~~8~~ | ~~`aitri resume` session handoff~~ | 29 | ✅ **Done (pre-existing)** |
| ~~9~~ | ~~Artifact drift detection~~ | — | ✅ **Merged into Rank 1** |
| ~~10~~ | ~~Artifacts folder (`spec/`)~~ | 28 | ✅ **Done v0.1.26** |

### Tier 3 — Planned (enforce + improve)
Valid, implementable, not urgent. No item blocks the core pipeline.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| ~~11~~ | ~~TC h/f naming convention~~ | 25 | ✅ **Done v0.1.30** — validate() enforces TC id ending in h/f per FR |
| ~~12~~ | ~~README restructure~~ | 23 | ✅ **Done v0.1.35** — progressive disclosure, schemas moved out |
| ~~13~~ | ~~Pipeline close-out clarity~~ | 20 | ✅ **Partially done in v0.1.26** |
| ~~14~~ | ~~`aitri adopt` diagnostic~~ | 20 | ✅ **Done v0.1.34/v0.1.35** — scan + apply + --upgrade |
| ~~15~~ | ~~Discovery Confidence gate~~ | 20 | ✅ **Done v0.1.33** |
| 16 | `aitri wizard` | 20 | Ship together with guided interview (17) |
| 17 | Discovery guided interview (`--guided`) | 20 | Ship together with wizard (16) |
| ~~18~~ | ~~UX/UI precision — archetype detection~~ | 20 | ✅ **Done v0.1.33** |

### Tier 4 — Deferred
High blast radius or dependency conflicts. Do not schedule until Tiers 1–2 are shipped.

| Rank | Item | Score | Blocker |
| ---: | :--- | :---: | :--- |
| ~~19~~ | ~~`aitri checkpoint`~~ | 13 | ✅ **Done (pre-existing)** |

### Discarded
Items analyzed and explicitly rejected.

| Item | Decision | Reason |
| :--- | :--- | :--- |
| Mutation testing | Discarded indefinitely | Violates zero-dep principle. `verify-run --assertion-density` covers 60% of the same problem at zero cost. Option B (globally-installed stryker) introduces implicit env dependency — worse than explicit dep. ROI does not justify. |

### P-level corrections (vs original backlog labels)
| Item | Was | Now | Reason |
| :--- | :--- | :--- | :--- |
| Three Amigos gate | P2 | P1 | In schema, unenforced, low risk — should ship with other Tier 1 validate() work |
| `aitri feature` | P1 | P2 | High value but high risk — not a correctness bug, requires stable foundation + file locking first |
| verify-run Vitest | P2 | P1 | Adoption blocker confirmed by E2E evaluation — 0 TCs detected on Vitest projects |
| Artifact drift detection | P2 | P1 | Merged with status/validate inconsistency — same root fix |
| Artifacts folder (`spec/`) | Tier 4 | Tier 2 | Blast radius grows linearly with each new command — do before feature/adopt/resume land |

---

## Entry Standard

Every backlog entry must be self-contained — implementable in a future session with zero memory of the original conversation. Before adding an item, verify it answers all of these:

| Question | Why it matters |
| :--- | :--- |
| **What is the user-visible problem?** | Prevents implementing a solution looking for a problem |
| **Which files are affected?** | Implementer knows where to start without exploring |
| **What is the exact behavior change?** | Removes ambiguity about what "done" looks like |
| **Are there technical decisions pre-resolved?** | Captures trade-offs decided during analysis, not during implementation |
| **What does `validate()` or the test need to verify?** | Defines the acceptance criterion at the code level |
| **Are there known conflicts or risks with existing code?** | Prevents regressions on parsers, schemas, or commands |

**Minimum entry format:**
```
- [ ] P? — **Title** — one-line description of the user-visible problem.
  Problem: <why this matters, what breaks without it>
  Files: <lib/..., templates/..., test/...>
  Behavior: <what changes — inputs, outputs, validation rules>
  Decisions: <any trade-offs already resolved>
  Acceptance: <how to verify it works — test or manual check>
```

Entries without `Files` and `Behavior` are considered incomplete and must be expanded before scheduling.

---

## Open

---

### Next Features

- [ ] P3 — **`aitri wizard` + `discovery --guided`** — interactive interview before any agent runs.
  Problem: Users write 2-3 sentences in IDEA.md. Agent fills the gaps with invented requirements. A wizard captures requirements interactively before the briefing is generated.
  Files: `bin/aitri.js` (add `wizard` case), `lib/commands/wizard.js` (new), `lib/commands/run-phase.js` (detect `--guided` for discovery), `lib/phases/phaseDiscovery.js` (add `collectInterview()`), `templates/phases/phaseDiscovery.md` (add `{{#IF_INTERVIEW}}`)
  Behavior:
  - `aitri wizard [--depth quick|standard|deep]` — interactive TTY interview via Node.js `readline`. Writes filled IDEA.md from user answers. Prompts: Problem, Target Users, Current Pain, Business Rules (multi-line), Success Criteria (multi-line), Out of Scope, Hard Constraints, Tech Stack (optional).
  - `aitri run-phase discovery --guided` — same interview flow but injects answers into discovery briefing as `{{INTERVIEW_CONTEXT}}` block instead of writing IDEA.md. Backward compatible — without flag, no change.
  - Both: `readline` only, zero new deps. `--guided` is opt-in so CI/CD is unaffected.
  Decisions: Interactive prompts are allowed here as an explicit exception (ADR needed). Wizard writes IDEA.md; guided feeds the agent directly — complementary, not redundant. Deprecated reference: `collectDiscoveryInterview()` in `discovery-plan-helpers.js`.
  Acceptance: `aitri wizard --depth quick` produces filled IDEA.md with all sections from user answers. `aitri run-phase discovery --guided` prints briefing with `## Interview Context` section. Without `--guided` flag: zero behavior change.

---

## Engineering Integrity (fixed findings — 2026-03-12)

> Source: deep technical audit of v0.1.25. All confirmed fixed.

- ✅ **Atomic write cross-device failure** — Fixed v0.1.26: temp file now in project dir.
- ✅ **`approve.js` UX detection silent fallback** — Fixed v0.1.26: stderr warn on malformed JSON.
- ✅ **`phaseReview.js` missing `extractContext`** — Fixed v0.1.26.
- ✅ **No file locking on `.aitri` state file** — Fixed v0.1.32: O_EXCL lock + stale detection.

---

## Spec-Driven Foundation (all done)

- ✅ **Structured IDEA.md template** — Done v0.1.29
- ✅ **Requirement Source Integrity in PM persona** — Done (pre-existing)
- ✅ **Discovery Confidence gate** — Done v0.1.33
- ✅ **TC happy/failure naming convention (h/f suffix)** — Done v0.1.30
- ✅ **Discovery interview wizard** — Deferred → open item above (P3)

---

## Pipeline Reliability (all done)

- ✅ **`aitri status` / `aitri validate` inconsistency + drift detection** — Done v0.1.26
- ✅ **Phase 4 manifest required fields documented in briefing** — Done (template updated)
- ✅ **verify-run Vitest support** — Done (pre-existing)
- ✅ **Pipeline close-out clarity** — Done v0.1.26

---

## Next Features (all done)

- ✅ **`aitri feature` sub-pipeline** — Done v0.1.31
- ✅ **`aitri resume` session handoff** — Done (pre-existing)
- ✅ **`aitri adopt` — scan + apply + --upgrade** — Done v0.1.34/v0.1.35
- ✅ **Artifacts folder (`spec/`)** — Done v0.1.26
- ✅ **`aitri checkpoint`** — Done (pre-existing)

---

## Engineering Quality (all done)

- ✅ **Best practice docs injected into phase briefings** — Done v0.1.28
- ✅ **Three Amigos gate — Phase 3 TCs must trace to Phase 1 ACs** — Done v0.1.30

---

## Documentation & UX

- ✅ **README restructure** — Done v0.1.35: progressive disclosure, schemas moved to `aitri help`, ASCII art header, commands table with adopt/feature/resume.
