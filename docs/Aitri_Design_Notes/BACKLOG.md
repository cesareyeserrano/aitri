# Aitri — Backlog

> Open items only. Closed items are in CHANGELOG.md.
> Priority: P1 (critical) / P2 (important) / P3 (nice to have)

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

> Ecosystem items (Hub, Graph, future subproducts) live in their own repos' backlogs.
> Core only tracks items that require changes to Aitri Core itself.

### Core — Reporting accuracy

- [ ] P3 — **`aitri tc verify` recomputes `fr_coverage` alongside `summary`** — `tc.js:64-77` recomputes `summary` after flipping a manual TC's status but does not recompute `fr_coverage`. The two fields drift: after `tc verify TC-XXX --result pass` on a manual TC, `summary.passed` goes up but `fr_coverage[entry].tests_manual` still counts that TC as manual and `tests_passing` stays too low.

  Problem: Today the gate logic uses `fr_coverage[].status === 'covered'` which is boolean (any passing test = covered), so the stale counts don't block deploy. But the artifact's own internal consistency is violated — any consumer reading both `summary` and `fr_coverage` sees contradiction. Hub currently ignores per-FR counts; future consumers or an auditor command reading this would be misled. No known break case today; latent risk.

  Files:
  - `lib/commands/tc.js` — after updating the entry + recomputing `summary`, rebuild `fr_coverage` by calling `buildFRCoverage()` (exported from `verify.js`) with current `results`, Phase 3 `test_cases`, and Phase 1 FR ids. Write the rebuilt array back to the artifact.
  - `test/commands/tc.test.js` — add a case: start with manual TC counted in `fr_coverage.tests_manual`, run `aitri tc verify --result pass`, assert `tests_manual` decreases by 1 and `tests_passing` increases by 1 in the affected FR row.

  Behavior:
  - `aitri tc verify TC-XXX --result pass` → `fr_coverage[tc→fr].tests_manual` decreases, `tests_passing` increases by 1.
  - `aitri tc verify TC-XXX --result fail` → `tests_manual` decreases, `tests_failing` increases by 1.
  - `status` of the FR row (covered / partial / uncovered) recomputed — only matters if the flip was the last remaining passing test for an FR.
  - Re-run idempotent.

  Decisions:
  - Rebuild the whole `fr_coverage` array rather than surgically updating one row. Simpler; aligned with how `verify-run` already builds it from scratch. Avoids a second code path that can drift.
  - No version bump on its own — ship bundled with any other tc-related change. Current behavior is latent-only, not actively breaking.

  Acceptance:
  - Test above passes.
  - `status` + `validate` output unchanged in projects that never ran `tc verify` (additive fix).
  - No change to `.aitri` schema or artifact schema (only corrects values that should already have been correct).

### Core — API cleanup

- [ ] P3 — **Phase 3: enforce canonical TC ID format** — `03_TEST_CASES.json` accepts any `id` string; only presence of trailing `h` / `f` on MUST-FR coverage is checked. A project can ship non-canonical IDs like `TC-E01` (namespace letter glued to digits, no suffix) and everything downstream — conftest helpers, verify parsers, fr_coverage — silently mismatches.

  Problem: Convention is documented in `docs/integrations/ARTIFACTS.md:148` and `templates/phases/tests.md:27-30` (suffix `h`/`f`/`e`, canonical shape `TC(-<NS>)*-<digits><letter>`), but not mechanically enforced. Consumer projects discover the drift as "verify shows TCs as skipped despite pytest passing" — days of debugging to trace back to a naming typo. Real case surfaced in Cesar 2026-04-22: `TC-E01`/`TC-E02` smoke tests silently dropped to `skipped_no_marker`; root cause was ID format, not the parser.

  Files:
  - `lib/phases/phase3.js` — add format validation against `/^TC(-[A-Z][A-Za-z0-9]*)*-\d+[a-z]?$/` (or similar — calibrate against existing valid IDs in internal tests + Hub). Throw with actionable message: the offending `id`, the pattern it must match, and a canonical rewrite suggestion (`TC-E01` → `TC-E-01e`).
  - `test/phases/phase3.test.js` — add coverage for accept-canonical / reject-noncanonical cases.
  - `docs/integrations/ARTIFACTS.md` — formalize the regex next to the existing convention paragraph.

  Behavior:
  - Phase 3 complete throws on any non-canonical `id`. Migration path for existing projects: either rename IDs (surfaces the real cost of the deviation) or we ship with a one-version grace period (warn, then throw).

  Decisions:
  - Do **not** ship reactively (single case = Cesar). Wait for a second real case before scheduling, unless an architectural review finds this a systemic gap.
  - If scheduled: coordinate with the checkpoint-rename cycle — breaking/strict changes are easier to batch in one minor.

  Acceptance:
  - Running Phase 3 validation against a fixture with `TC-E01` throws with the exact regex + rewrite suggestion.
  - Existing valid IDs (`TC-001h`, `TC-FE-001h`, `TC-API-USER-010f`) continue to pass.
  - ARTIFACTS.md has the regex documented alongside the h/f/e convention.

  Related:
  - v0.1.85 fixed the parser side (multi-segment IDs) — the format-validation gate is the missing preventive counterpart.
  - This would catch silent drift earlier (Phase 3 complete) instead of days later (verify-run showing unexplained skips).

- [ ] P3 — **Rename `checkpoint` to `note` (or simplify)** — The `checkpoint` command's original "save session state" role was absorbed by auto-`writeLastSession` in v0.1.70. Today it only adds manual annotation (`--context`) and named markdown snapshots (`--name`) on top of what `resume` already surfaces.

  Problem: The name `checkpoint` suggests "save state so I can restore later" — but every `complete` / `approve` / `verify-run` / `verify-complete` / `feature init` / `normalize` already writes `lastSession` automatically. Running `aitri resume` surfaces pipeline state + last-session metadata + next action without ever invoking `checkpoint`. Users who designed the command for "long project retaken days later" or "multi-user handoff" cases don't reach for it because `resume` already covers those cases. The command is mostly dormant — the name over-promises.

  Files:
  - `lib/commands/checkpoint.js` — rename and/or simplify (bare mode is redundant — `writeLastSession` with no `--context` and no `--name` duplicates auto-checkpoint)
  - `bin/aitri.js` — dispatch table + deprecation alias if renaming
  - `lib/commands/help.js` — update command help; clarify that `lastSession` is auto-written by structural commands
  - `test/commands/checkpoint.test.js` — rename or update
  - `docs/integrations/CHANGELOG.md` — breaking API change entry if renamed
  - `README.md` — command list

  Behavior (one of two paths — pick at implementation time):
  - **Path A (rename):** `aitri note "text"` replaces `aitri checkpoint --context "text"`. `--name` snapshot mode becomes `aitri snapshot --name "..."` or folds into `aitri note --snapshot`. Bare `aitri checkpoint` is dropped (redundant with auto). Keep `checkpoint` as a deprecated alias for one minor version.
  - **Path B (keep, simplify):** drop bare mode only — running `aitri checkpoint` with neither `--context` nor `--name` prints a short message pointing to `aitri resume`. `--context` and `--name` continue working. No rename, no deprecation.

  Decisions:
  - **Do not touch now (2026-04-21):** not broken, covers real edge cases (`--context` for free-text annotation, `--name` for pre-refactor snapshots). Revisit only if (a) a real user complains about the command's purpose being unclear, or (b) we're already doing a wider command-surface cleanup.
  - Deprecation-with-alias is mandatory if renaming — `checkpoint` has been in the public API since v0.1.70.
  - Path B is strictly safer than Path A; Path A is only justified if we see evidence the name confuses users.

  Acceptance:
  - If Path A: `aitri checkpoint --context "x"` prints a deprecation notice and still works; `aitri note "x"` writes `lastSession.context = "x"`; smoke + unit tests pass.
  - If Path B: `aitri checkpoint` with no flags prints a hint; `--context` and `--name` continue working unchanged; unit tests updated.
  - In both cases: `aitri resume` output under "Last Session" is unchanged.

### Core — Breaking changes for v0.2.0

- [ ] P3 — **`IDEA.md` and `ADOPTION_SCAN.md` at the root of the user's project** — Both files land at the root after `adopt scan`, polluting the user's directory and exposing them to accidental deletion.

  Problem: The user's project root is not the right place for Aitri-generated files. The user can delete them by mistake or confuse them with their own files. Also, `spec/` already exists as the artifacts folder — semantically `IDEA.md` belongs there.

  Files:
  - `lib/commands/adopt.js` — change write paths from `path.join(dir, 'IDEA.md')` and `ADOPTION_SCAN.md` to `path.join(dir, 'spec', ...)`; create `spec/` in `adoptScan` instead of only in `adoptApply`
  - `lib/commands/run-phase.js` — line 68: change `adir = ''` to `adir = artifactsDir` for `IDEA.md`
  - `templates/adopt/scan.md` — update output paths (`{{PROJECT_DIR}}/spec/IDEA.md`, `{{PROJECT_DIR}}/spec/ADOPTION_SCAN.md`)
  - `test/smoke.js` — update smoke tests that check for `IDEA.md` at the root

  Behavior:
  - `adopt scan` creates `spec/` if missing, writes `spec/IDEA.md` and `spec/ADOPTION_SCAN.md`
  - `run-phase 1/2/discovery` looks up `IDEA.md` in `spec/` (via `artifactsDir`)
  - `adopt apply` assumes `spec/IDEA.md`

  Decisions:
  - **Defer to v0.2.0 as an explicit breaking change** (decided 2026-03-17): no dual-path fallback — it would add permanent debt in run-phase.js. In v0.2.0: the user moves IDEA.md manually, or Aitri detects the file at root and aborts with a clear instruction.
  - `ADOPTION_SCAN.md` moves too — same semantic group, low individual risk (only written by agent, never read by code)

  Acceptance:
  - `adopt scan` in a new project: `IDEA.md` and `ADOPTION_SCAN.md` land in `spec/`, not at root
  - `run-phase 1` in a project with `spec/IDEA.md`: works without warning
  - Legacy project with `IDEA.md` at root: Aitri aborts with explicit migration instruction
  - Smoke tests pass with 0 failures

---

## Design Studies

> Not implementation items. Open questions that inform future architectural decisions.

### Command-surface audit

Aitri exposes 20 top-level commands today (`lib/commands/*.js`). Over successive minor versions, several commands have developed functional overlap — not broken, but potentially redundant. Before v0.2.0, run a single audit to map the surface and decide whether to collapse, rename, or keep.

**Suspected overlaps (starting list — to be confirmed by the audit):**

| Pair / Group | Suspected overlap |
| :--- | :--- |
| `checkpoint` vs auto-`writeLastSession` + `resume` | Already captured — see P3 entry above |
| `resume` vs `status` vs `status --json` vs `validate` vs `validate --explain` | Four commands project the same `buildProjectSnapshot()` with different verbosity / framing |
| `audit` vs `review` | Both are evaluative read-only passes with personas (auditor, reviewer). Different scope (audit = whole project, review = per-phase) but same shape |
| `feature verify-run` vs `verify-run` | Same logic, scoped to a feature sub-pipeline. Candidate for `verify-run --feature <name>` |
| `tc verify` vs `verify-run` | Manual TC recording vs automated runner — correct split today, but worth confirming against use |
| `wizard` vs `init` + `adopt scan` | Wizard predates the `init`/`adopt` surface maturing. Does it still add value? |

**Open question:** For each suspected overlap, is the split reinforcing a real distinction (different user intent, different invariant), or is it incidental history (command added before the collapsing path existed)?

**Why it is a Design Study and not a set of tickets:**
- Each command has test coverage and real users. A "cleanup" without evidence of confusion is churn.
- Renaming or collapsing is a breaking API change — must be batched for v0.2.0, not done piecemeal.
- The audit's *output* is the tickets (0, 1, or N of them), not the audit itself.

**Criterion to mature into tickets:**
- A concrete case of user or agent confusion about which command to use.
- A maintenance cost surfaced during unrelated work (e.g. snapshot schema change had to be propagated to 4 commands that project it).
- A release that is already touching the command surface (v0.2.0 breaking batch).

**Scope when executed:**
1. One-page table: command → unique responsibility → overlaps with → evidence for or against keeping split.
2. Per overlap: decide `keep` / `alias` / `collapse` / `rename` with trade-off written down.
3. Output: entries in the `Core — Breaking changes for v0.2.0` section, or none if the audit finds no real overlap.

**What NOT to do in the audit:**
- Don't collapse commands just because their code is similar. Intent and user model matter more than LOC.
- Don't rename for aesthetics. Every rename costs one deprecation cycle.

---

### NFR traceability in system design (Phase 2)

Phase 2 (`02_SYSTEM_DESIGN.md`) today validates section presence and minimum length, but does not verify that the NFRs declared in Phase 1 are *addressed* by the design. A design can have every required section and still completely ignore the performance/security/availability NFRs.

**Open question:** Is it worth attempting prose↔NFR matching in Phase 2?

**Why it is a Design Study and not a ticket:**
- NFR→design matching requires lightweight NLP over Markdown — high risk of false positives.
- An NFR like "p95 latency <200ms" could be addressed in the "Performance & Scalability" section without mentioning the exact number, but with a valid architectural decision (cache layer, CDN).
- An overly strict validator would reject good designs.

**Criterion to mature into a ticket:**
- A real case where an approved design ignored a critical NFR and broke production.
- Without that case, the hypothesis (agents ignore NFRs) is not verified.

**Cheaper alternative if the case emerges:**
- No automatic validator. Extend `aitri review` with a check that lists Phase 1 NFRs and asks the agent/human "is each one addressed in the design? Answer yes/no per NFR." Honor-system, but visible.

**Resolved partially (2026-04-20):** the Design Study's original question ("how far should Aitri go in validating semantics?") was answered de facto by the validation model (2026-03-14) + existing semantic gates (BROAD_VAGUE in Phase 1, placeholder detection in Phase 3, FR-MUST coverage in Phase 3/5). The concrete cases of title vagueness and duplicate ACs were closed in v0.1.82. Only the NFR traceability question remains open.

---

## Discarded

Items analyzed and explicitly rejected.

| Item | Decision | Reason |
| :--- | :--- | :--- |
| Mutation testing | Discarded indefinitely | Violates zero-dep principle. `verify-run --assertion-density` covers 60% of the same problem at zero cost. Option B (globally-installed stryker) introduces implicit env dependency — worse than explicit dep. ROI does not justify. |
| Aitri CI (GitHub Actions step) | Discarded 2026-04-17 | No active user demand. Contract not stable enough to publish a separate Action. If needed later, lives outside Core. |
| Aitri IDE (VSCode extension) | Discarded 2026-04-17 | Separate product with its own release cycle. Not incremental over the CLI; will be reconsidered if the CLI stabilizes across multiple external teams. |
| Aitri Report (PDF/HTML compliance report) | Discarded 2026-04-17 | User declined the surface. Compliance evidence already lives in `05_PROOF_OF_COMPLIANCE.json` + git history; rendering is a separate concern. |
| Aitri Audit (ecosystem-level cross-project aggregator) | Discarded 2026-04-17 | Functionally duplicates Hub's dashboard. Aitri Core does not maintain a global registry — adding one to support an aggregator violates the passive-producer model. Name also collides with the per-project `aitri audit` command (v0.1.71). |
