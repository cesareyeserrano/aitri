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
| 1 | `status` / `validate` inconsistency + Artifact drift detection | 43 | Active trust-breaking bug — merged with Rank 9 (same fix: hash at approve, check at status/validate) |
| ~~2~~ | ~~Structured IDEA.md template~~ | 40 | ✅ **Done v0.1.29** |
| ~~3~~ | ~~Three Amigos gate (ac_id validation)~~ | 38 | ✅ **Done v0.1.30** |
| ~~4~~ | ~~Requirement Source Integrity (PM persona)~~ | 37 | ✅ **Done (pre-existing)** |
| ~~5~~ | ~~verify-run Vitest / parser fragility~~ | 35 | ✅ **Done (pre-existing)** |

### Tier 2 — Short-term (quality + adoption)
High value, contained implementations. No item here blocks another.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| 6 | `aitri feature` sub-pipeline | 33 | High value, high risk — ship after file locking is in place |
| 7 | Best practice docs injected into briefings | 31 | Cheapest quality multiplier — template injection only, no validators |
| 8 | `aitri resume` session handoff | 29 | Read-only, reuses extractContext() — prerequisite for checkpoint |
| 9 | ~~Artifact drift detection~~ | — | **Merged into Rank 1** |
| 10 | Artifacts folder (`spec/`) | 28 | **Promoted from Tier 4** — move before new commands land; blast radius grows with every new feature |

### Tier 3 — Planned (enforce + improve)
Valid, implementable, not urgent. No item blocks the core pipeline.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| 11 | TC h/f naming convention | 25 | validate() tightening — schedule with Three Amigos (same phase) |
| 12 | README restructure | 23 | No code change — do at a release milestone |
| 13 | Pipeline close-out clarity | 20 | ✅ **Partially done in v0.1.26** — message fixed; deploy-confirm command deferred |
| 14 | `aitri adopt` diagnostic | 20 | Read-only — safe anytime after Tier 2 |
| 15 | Discovery Confidence gate | 20 | Gate on optional phase — low blast radius |
| 16 | `aitri wizard` | 20 | Ship together with guided interview |
| 17 | Discovery guided interview (`--guided`) | 20 | Ship together with wizard |
| 18 | UX/UI precision — archetype detection | 20 | Persona file only — self-contained |

### Tier 4 — Deferred
High blast radius or dependency conflicts. Do not schedule until Tiers 1–2 are shipped.

| Rank | Item | Score | Blocker |
| ---: | :--- | :---: | :--- |
| 19 | `aitri checkpoint` | 13 | Depends on `aitri resume` (item 8) |

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

## Engineering Integrity (new findings — 2026-03-12)

> Source: deep technical audit of v0.1.25.
> Items not in prior backlog. All confirmed bugs or API inconsistencies found in code review.

- [x] P1 — **Atomic write cross-device failure** — `saveConfig()` uses `os.tmpdir()` for the temp file; on systems where `/tmp` is a separate filesystem (tmpfs), `fs.renameSync()` throws `EXDEV: cross-device link not permitted`. The atomic write silently fails — state is not saved.
  Problem: Atomic write relies on `rename()` being same-filesystem, but `os.tmpdir()` may be on a different mount.
  Files: `lib/state.js`
  Behavior: Change temp file path from `os.tmpdir()` to `path.join(dir, '.aitri-<pid>.tmp')` — always same filesystem as destination.
  Decisions: Per-pid naming (`.aitri-<pid>.tmp`) retains uniqueness for concurrent processes. Removes `os` import dependency.
  Acceptance: `saveConfig()` succeeds on systems with tmpfs `/tmp`. Temp file created in project dir, cleaned up after rename.
  **Status: ✅ Fixed in v0.1.26**

- [x] P1 — **`approve.js` UX detection silent fallback** — when `01_REQUIREMENTS.json` fails to parse, the catch block silently skips UX gate enforcement. Projects with UX/visual FRs proceed to Phase 2 without the required UX phase.
  Problem: `try { ... } catch { /* non-fatal */ }` means a malformed requirements JSON skips the UX gate entirely.
  Files: `lib/commands/approve.js`
  Behavior: Catch block must warn on stderr — "Could not read 01_REQUIREMENTS.json to check for UX/visual FRs. If your project has UX requirements, run: aitri run-phase ux manually."
  Decisions: Still non-blocking (warn not exit) — malformed JSON at this point is an edge case; blocking would be worse UX.
  Acceptance: Corrupted `01_REQUIREMENTS.json` after Phase 1 → `aitri approve 1` prints UX warning on stderr instead of silently skipping.
  **Status: ✅ Fixed in v0.1.26**

- [x] P2 — **`phaseReview.js` missing `extractContext`** — all other phases implement `extractContext(content)`; phaseReview does not. If `run-phase.js` line 49 tries to call `producer.extractContext(raw)` on review-phase artifacts used as inputs, it throws `TypeError: p.extractContext is not a function`.
  Problem: Inconsistent phase API — phaseReview breaks the contract implemented by all other 7 phases.
  Files: `lib/phases/phaseReview.js`
  Behavior: Add `extractContext: (content) => head(content, 80)` to phase definition. Import `head` from `./context.js`.
  Decisions: 80 lines is consistent with phase4 (manifest) extraction ceiling; review doc is unlikely to exceed this in practice.
  Acceptance: `phaseReview` exports `extractContext`. `run-phase.js` line 49 does not throw when review artifact is an input.
  **Status: ✅ Fixed in v0.1.26**

- [ ] P1 — **No file locking on `.aitri` state file** — concurrent writes (e.g., two `aitri feature` sub-pipelines running in parallel) use last-write-wins. Atomic rename prevents partial writes but not race conditions between two writers.
  Problem: `aitri feature` (Tier 2) will allow multiple feature sub-pipelines. If two features share root state (they don't — feature state is in `.aitri-feature`), or if user accidentally invokes two Aitri commands simultaneously, state can be silently overwritten.
  Files: `lib/state.js` (new `lockConfig()` / `unlockConfig()` wrapping `saveConfig`)
  Behavior:
  - Write a `.aitri.lock` file using `fs.openSync(lockPath, 'wx')` (exclusive create — atomic on POSIX).
  - If lock file exists and is stale (>5s old), warn and remove.
  - Release lock in `finally` block.
  - `saveConfig()` always acquires lock before write, releases after.
  Decisions: POSIX `O_EXCL` is atomic. `wx` flag in Node.js maps to this. No external dep. 5s stale threshold covers normal operation (no Aitri command takes >5s). Feature sub-pipeline state (`.aitri-feature`) is separate file — no cross-contamination.
  Acceptance: Two concurrent `saveConfig()` calls on the same dir never produce a corrupt `.aitri` file.

---

## Spec-Driven Foundation (from deprecated Aitri analysis)

> Source: deep review of aitri-Deprecated — discovery, personas, wizard, artifact schemas.
> Core problem: current Discovery phase is agent-invented. No mechanism to enforce that FRs, actors,
> and success metrics trace to explicit user input.

- [x] P1 — **Structured IDEA.md template** — `aitri init` produces free-text IDEA.md; agent invents what the user didn't say.
  **Status: ✅ Done in v0.1.29**
  Problem: PM persona has no structure to reference — infers actors, FRs, and success metrics from vague prose. Agent-invented requirements flow into every downstream phase undetected.
  Files: `templates/IDEA.md` (rewrite), `lib/commands/init.js` (copy new template), `lib/phases/phase1.js` (warn on empty sections in `extractContext`)
  Behavior:
  - New `templates/IDEA.md` has 7 sections with instructional comments:
    ```
    ## Problem          ← what problem, why now (min 2 sentences)
    ## Target Users     ← who uses it, their role, concrete example
    ## Current Pain / Baseline  ← how solved today, current metric value
    ## Business Rules   ← each line → one FR, must start with "The system must…"
    ## Success Criteria ← each line → one AC, Given/When/Then format
    ## Hard Constraints ← budget, legal, legacy systems, required tech, deadlines
    ## Out of Scope     ← explicit exclusions for this version
    ## Tech Stack       ← optional; leave blank = PM/Architect decides
    ```
  - `aitri run-phase 1`: warns (stderr, non-blocking) if any required section is empty or still contains placeholder comment text. Does NOT block — PM is allowed to flag gaps as `[ASSUMPTION]`.
  - `extractContext()` in `phase1.js`: passes sections individually by header name, not as a blob, so PM briefing can reference "Business Rules" and "Success Criteria" by name.
  Decisions: Non-blocking warn (not hard block) preserves usability for projects where some sections are intentionally open.
  Acceptance: `aitri init` in a temp dir produces the new 8-section IDEA.md. Running `aitri run-phase 1` with an empty section prints a visible warning but does not exit 1.

- [x] P1 — **Requirement Source Integrity in PM persona** — PM silently invents FRs and actors not mentioned by the user.
  **Status: ✅ Pre-existing — pm.js CONSTRAINTS + phase1.js validate() [ASSUMPTION] warning**
  Problem: No mechanism distinguishes user-stated requirements from agent-inferred ones. Downstream phases build on invented requirements without knowing they are assumptions.
  Files: `lib/personas/pm.js` (add constraint), `lib/phases/phase1.js` (add assumption warning in `validate()`)
  Behavior:
  - Add to `CONSTRAINTS` array in `pm.js`: *"Every FR and actor must trace to an explicit statement in the user's IDEA.md. If IDEA.md does not provide evidence for a requirement, include it with marker [ASSUMPTION: needs user confirmation] — never invent requirements silently."*
  - `validate()` in `phase1.js`: scan parsed `01_REQUIREMENTS.json` for any FR `title` or actor name containing `[ASSUMPTION]`. If found, print a warning block listing all flagged items — warn only, exit 0. Format to match existing PIPELINE INSTRUCTION style.
  Decisions: Warn (not block) so pipeline is not broken when PM makes reasonable inferences; human reviewer sees them explicitly during `aitri approve 1`.
  Acceptance: Generate Phase 1 with a sparse IDEA.md → at least one FR is marked `[ASSUMPTION]` → `aitri complete 1` prints a warning listing those FRs.

- [ ] P2 — **Discovery Confidence gate** — Discovery phase has no quality gate; agent can output low-confidence discovery and Phase 1 proceeds anyway.
  Problem: Agent runs discovery on a vague idea and declares it complete. No signal to the human that critical information is missing before investing in Phase 1.
  Files: `lib/phases/phaseDiscovery.js` (`validate()` update), `templates/phases/phaseDiscovery.md` (add required section)
  Behavior:
  - `00_DISCOVERY.md` must end with exactly:
    ```
    ## Discovery Confidence
    Confidence: low | medium | high
    Evidence gaps: <bullet list or "none">
    Handoff decision: ready | blocked — <one-line reason>
    ```
  - `validate()` parses `## Discovery Confidence` header (case-insensitive). Rejects if section absent.
  - `Confidence: low` → exit 1, print evidence gaps, instruct user to clarify before re-running.
  - `Confidence: medium` → warn on stderr, print evidence gaps as advisory, allow progression.
  - `Confidence: high` → pass silently.
  - `Handoff decision: blocked` → exit 1 regardless of confidence level.
  - Parsing: find `## Discovery Confidence` header, read next 3 lines, regex each for value. Case-insensitive.
  Decisions: `medium` allows progression (warn only) to avoid blocking teams that have some uncertainty; `low` is a hard stop because the foundation is too weak.
  Acceptance: `aitri complete discovery` on a doc with `Confidence: low` exits 1 and prints gaps. With `Confidence: high` exits 0 silently.

- [ ] P2 — **TC happy/failure naming convention (TC-XXXh / TC-XXXf)** — Phase 3 currently has no requirement that each FR has both a positive and negative test case.
  Problem: FRs can be covered by only happy-path TCs. Failure scenarios (invalid input, edge cases, error states) go untested. Verify passes but the implementation is not robustly tested.
  Files: `lib/phases/phase3.js` (`validate()` update), `templates/phases/phase3.md` (add naming rule + examples)
  Behavior:
  - Naming: suffix TC IDs with lowercase `h` (happy) or `f` (failure) — e.g., `TC-001h`, `TC-001f`.
    **Decision already made: lowercase suffix without extra dash** — compatible with existing regex `TC-[A-Za-z0-9]+` in `parseRunnerOutput`, `parsePlaywrightOutput`, `scanTestContent`. No parser changes needed. Option with dash (`TC-001-H`) was rejected because it breaks all three parsers and existing tests.
  - `validate()` in `phase3.js`: parse `03_TEST_CASES.json`, group TCs by `requirement_id`. For each FR: require at least one `tc.id` ending in `h` AND at least one ending in `f`. Reject with list of non-compliant FRs if missing.
  - `templates/phases/phase3.md`: add naming rule with example: `TC-001h: user logs in with valid credentials` / `TC-001f: login rejected when password is wrong`.
  Decisions: Lowercase `h`/`f` (not uppercase) to avoid confusion with hex color codes and to match the alphanumeric pattern already established by `TC-020b`, `TC-020c`.
  Acceptance: `aitri complete 3` on a `03_TEST_CASES.json` where FR-001 has only `TC-001h` and no `TC-001f` exits 1 naming FR-001 as non-compliant.

- [ ] P3 — **Discovery interview wizard (`aitri wizard`)** — `aitri init` drops an empty IDEA.md; users don't know what to write; agent fills the gaps.
  Problem: Most users write 2-3 sentences in IDEA.md. The structured template helps but doesn't guide the thinking. A wizard captures requirements interactively before any agent runs.
  Files: `bin/aitri.js` (add `wizard` case), `lib/commands/wizard.js` (new file), `templates/IDEA.md` (used as output target)
  Behavior:
  - Command: `aitri wizard [--depth quick|standard|deep]` (default: prompt user to choose)
  - If IDEA.md already exists: prompt "IDEA.md already exists. Overwrite? (y/N)" — default N, exit 0.
  - Uses Node.js `readline` — no external deps, no agent involvement.
  - Writes a filled IDEA.md with user answers replacing placeholder comments.
  - Multi-line questions (Business Rules, Success Criteria): accept lines until blank line submitted.
  - Question → section mapping:
    ```
    Quick (6 q):
      Q1 "What problem? Why now?"              → ## Problem
      Q2 "Who are the users? Their role?"      → ## Target Users
      Q3 "How solved today? Baseline metric?"  → ## Current Pain / Baseline
      Q4 "Required behaviors (multi-line):"    → ## Business Rules
      Q5 "Success criteria (GWT, multi-line):" → ## Success Criteria
      Q6 "What is out of scope?"               → ## Out of Scope
    Standard adds (4 more):
      Q7  "Key assumptions to validate:"       → ## Problem (### Assumptions subsection)
      Q8  "Hard constraints (budget/legal/tech):" → ## Hard Constraints
      Q9  "Dependencies on teams/systems:"     → ## Hard Constraints (### Dependencies)
      Q10 "Preferred tech stack? (blank=open):" → ## Tech Stack
    Deep adds (3 more):
      Q11 "Why must this ship now vs later?"   → ## Problem (urgency trigger)
      Q12 "What must the system NEVER do?"     → ## Out of Scope (no-go zone)
      Q13 "Top 2-3 risks that could kill this:" → ## Risk Notes (new section)
    ```
  Decisions: Interactive prompts are allowed here (ADR-DISCARDED says no interactive prompts for *commands*, but wizard is explicitly a human input tool — it IS the interaction). Needs ADR to document this exception.
  Acceptance: `aitri wizard --depth quick` in a fresh dir produces a filled IDEA.md with all 6 required sections populated from user answers. Blank answer on optional question produces empty section (not placeholder comment).

---

## Pipeline Reliability (from E2E evaluation feedback)

> Source: external evaluation of Aitri v0.1.25 as a deterministic SDLC pipeline with mandatory human approvals.
> Verdict: pipeline model is correct; weaknesses are in state consistency, verify ergonomics, and close-out communication.
> Items marked NOT-VALID were explicitly discarded after analysis.

- [x] P1 — **`aitri status` / `aitri validate` state inconsistency + Artifact drift detection** — the two commands showed contradictory pipeline state during evaluation. Root cause: no drift detection between approved state and current artifact content.
  Problem: `status` reads `.aitri` config; `validate` reads both config and filesystem. They diverge if artifacts were modified or deleted after approval. Merged with drift detection (Rank 9) — same fix.
  Files: `lib/state.js` (add `hashArtifact()`), `lib/commands/approve.js` (store hash), `lib/commands/status.js` (check hash), `lib/commands/validate.js` (check hash)
  Behavior:
  - `aitri approve N`: compute SHA-256 of artifact, store in `.aitri` as `artifactHashes[phase]`.
  - `aitri status` + `aitri validate`: recompute hash, compare with stored. Mismatch → `⚠️ DRIFT: artifact modified after approval — re-run complete + approve`.
  - Warn only (do not auto-revoke).
  Decisions: SHA-256 via `node:crypto` (built-in). String key for phase (String(phase)) to handle both numeric and string phases uniformly.
  **Status: ✅ Fixed in v0.1.26**

- [ ] P2 — **Phase 4 manifest required fields not documented in briefing** — `aitri complete 4` rejected a valid-looking manifest twice because `setup_commands` and `test_runner` fields were missing. Neither field appears in the Phase 4 template instructions or the Output section.
  Problem: Agent writes manifest without `setup_commands` / `test_runner`, `aitri complete 4` rejects, agent iterates twice to discover the required fields. Two unnecessary round-trips per project.
  Files: `templates/phases/phase4.md` (add explicit manifest schema example), `lib/phases/phase4.js` (`validate()` — confirm both fields are indeed required)
  Behavior: Add a concrete manifest schema snippet to the Phase 4 template `## Output` section:
    ```json
    {
      "files_created": ["server.js", "..."],
      "test_runner": "npm test",
      "setup_commands": ["node server.js"],
      "environment_variables": [...]
    }
    ```
  Decisions: Do not remove the validator — the field is legitimately required. Fix is documentation only: show the required schema in the briefing so the agent produces a compliant manifest on the first attempt. No behavior change to `validate()`.
  Acceptance: `aitri run-phase 4` output shows a concrete manifest skeleton with all required fields. Agent following the briefing produces a manifest that passes `aitri complete 4` on the first attempt.

- [x] P1 — **verify-run parser fragility / Vitest support** — agent had to rewrite tests to match Aitri's expected output format. Aitri should adapt to common runners, not the other way around.
  **Status: ✅ Pre-existing — parseVitestOutput() + auto-detect by test_runner field**
  Problem: `parseRunnerOutput` only handles `node --test` checkmark format (✔/✖). Teams using Vitest, Jest, or other common runners get 0 TCs detected unless they manually adapt output. This is ergonomic friction and reduces adoption.
  Files: `lib/commands/verify.js` (`parseRunnerOutput`, possibly new `parseVitestOutput`), `templates/phases/phase4.md` (update runner guidance)
  Behavior:
  - Detect Vitest output format: `✓ TC-001: description` (different symbol and structure than node:test).
  - Detect Jest output format: `✓ TC-001: description` (PASS/FAIL prefix lines).
  - Auto-detect runner type from `test_runner` field in `04_IMPLEMENTATION_MANIFEST.json` and apply the correct parser.
  - Fallback: if runner unknown, try all parsers and merge results.
  Decisions: Do not require agents to change test output format — Aitri must be the adapter. Runner detection via `test_runner` field already exists in the manifest.
  Acceptance: `verify-run` on a Vitest project with TC-tagged tests detects and counts TCs correctly without any format adaptation by the agent.

- [x] P2 — **Pipeline close-out clarity: "complete" ≠ "deployed"** — fixed in v0.1.26. Message now reads: "Deployment artifacts are ready — run your deploy commands to ship."
  **Status: ✅ Fixed in v0.1.26**

- [x] P2 — **Artifact drift detection** — merged into Rank 1 above.
  **Status: ✅ Fixed in v0.1.26**

---

## Next Features

> Source: user proposals analyzed against deprecated Aitri and current codebase.
> Design constraint: all items must extend Aitri without breaking existing pipeline or adding complexity for projects that don't use the feature.

- [ ] P2 — **`aitri feature` — sub-pipeline for iterating on existing projects** — Aitri today is one-shot: one idea → one pipeline. There is no way to add features or do maintenance on a project that already completed the pipeline.
  Problem: After Phase 5, the project is "done" in Aitri's view. Any new functionality has to be tracked externally. This limits Aitri to greenfield projects and breaks the SDLC loop.
  Files: `bin/aitri.js` (new `feature` command namespace), `lib/commands/feature.js` (new — handles init/status/list), `lib/phases/index.js` (no change — reuse same PHASE_DEFS), `templates/FEATURE_IDEA.md` (new template)
  Behavior:
  - `aitri feature init <name>` — creates `features/<name>/` directory + `FEATURE_IDEA.md` template + `.aitri-feature` state file
  - `aitri feature run-phase <name> <N>` — same as `run-phase N` but: (1) `dir` points to `features/<name>/`, (2) injects "existing system context" from parent project artifacts into the briefing
  - `aitri feature complete/approve/reject/verify-run/verify-complete <name> <N>` — same commands scoped to feature dir
  - `aitri feature status <name>` — shows feature sub-pipeline state
  - `aitri feature list` — lists all features in `features/` dir
  Context injection (critical — this is what makes feature briefings produce deltas, not rewrites):
    - Phase 1 feature: injects existing FRs from root `01_REQUIREMENTS.json` as "EXISTING REQUIREMENTS — do not duplicate, only add new FRs"
    - Phase 2 feature: injects `head(sdd, 60)` from root `02_SYSTEM_DESIGN.md` as "EXISTING ARCHITECTURE — produce a delta design"
    - Phase 4 feature: injects `test_runner` + `tech_stack` from root `04_IMPLEMENTATION_MANIFEST.json`
  Decisions: Feature state is in `features/<name>/.aitri-feature` (separate from root `.aitri` — no interference). Feature artifacts live in `features/<name>/` — no root contamination. Existing pipeline commands are unchanged. File locking (see Engineering Integrity items) must be in place before this ships. Deprecated reference: `draft.js --feature` + context injection from `.aitri/ux-design.md` — same concept, simpler implementation.
  Acceptance: `aitri feature init add-export` creates `features/add-export/FEATURE_IDEA.md`. `aitri feature run-phase add-export 1` prints briefing that includes existing FRs as context. `aitri feature status add-export` shows sub-pipeline state independently of main pipeline.

- [ ] P2 — **Discovery guided interview (`run-phase discovery --guided`)** — `run-phase discovery` sends a vague IDEA.md to the agent with no structure; agent invents discovery instead of synthesizing user-provided answers.
  Problem: When `aitri run-phase discovery` is called, the only input is IDEA.md (free text). The Discovery persona fills gaps by inference. A guided interview before the briefing ensures the agent synthesizes explicit user answers, not invented context.
  Files: `lib/commands/run-phase.js` (detect `--guided` flag for discovery), `lib/phases/phaseDiscovery.js` (add `collectInterview()` function), `templates/phases/phaseDiscovery.md` (add `{{#IF_INTERVIEW}}` block)
  Behavior:
  - `aitri run-phase discovery --guided` — before generating the briefing, runs an interactive TTY interview (Node.js `readline`) with 6-10 questions, then injects answers as structured context into the discovery briefing
  - Questions (quick, 6):
    1. "What problem are you solving? Why now?"
    2. "Who are the primary users and their role?"
    3. "How is this solved today? What is the current metric?"
    4. "What are the hard constraints? (budget, legal, tech)"
    5. "What is explicitly out of scope?"
    6. "What does success look like? (metric + target)"
  - Interview answers are injected into briefing as `{{INTERVIEW_CONTEXT}}` block — the discovery agent reads them and synthesizes, never invents
  - Without `--guided`: existing behavior unchanged (backward compatible)
  - This is complementary to `aitri wizard` (which writes IDEA.md) — interview feeds the agent directly
  Decisions: `--guided` is an explicit opt-in flag, so CI/CD pipelines are not affected (ADR exception: wizard/interview are human-only commands). Deprecated reference: `collectDiscoveryInterview()` in `discovery-plan-helpers.js` — same concept adapted.
  Acceptance: `aitri run-phase discovery --guided` prompts 6 questions, then prints discovery briefing that includes a `## Interview Context` section with user answers. Without flag: no change to existing behavior.

- [ ] P2 — **UX/UI precision — archetype detection + component states** — UX phase produces generic tokens; no archetype-based defaults; no component state specs (hover/loading/error); no responsive AC references.
  Problem: Agent UX designer invents aesthetic style because no archetype is declared. Component states are mentioned but not specified per token. ACs don't reference responsive breakpoints. Result: developer gets vague UX spec and makes arbitrary choices.
  Files: `lib/personas/ux.js` (add archetype detection as Step 0, update CONSTRAINTS), `templates/phases/phaseUX.md` (add archetype section, component state format, responsive ACs)
  Behavior:
  - Add to UX persona as first mandatory action: **Archetype detection** — classify the project into one of 4:
    - `[CLINICAL/TRUST]` — medical, fintech, legal → light-only, muted palette, high contrast, no animations
    - `[PRO-TECH/DASHBOARD]` — devtools, analytics, ops → dark-first, high-density, monospace
    - `[CONSUMER/LIFESTYLE]` — social, e-commerce, entertainment → adaptive, brand-centric, playful
    - `[ENTERPRISE/INTERNAL]` — B2B SaaS, admin panels → light-only, workflow-optimized, no visual flair
  - Per-archetype token defaults: primary/surface/text color roles, font stack, border-radius, spacing unit
  - Screen definitions must include component states: Default / Hover / Loading / Error / Disabled — with token + animation spec per state
  - ACs must reference breakpoints: @375px (mobile), @768px (tablet), @1440px (desktop)
  - IDEA.md `## Visual Style` section (from Structured IDEA.md template item) feeds archetype selection
  Decisions: Do not invent archetypes beyond these 4 — deprecation showed this is sufficient and keeping it to 4 prevents over-engineering. Archetype drives defaults only; user's Visual Style declaration overrides. No new artifact — all output stays in `01_UX_SPEC.md`. Not breaking — only improves agent output quality.
  Acceptance: `aitri run-phase ux` on a fintech project → UX spec declares `[CLINICAL/TRUST]`, uses light palette, includes hover/loading/error states per component, ACs reference @375px and @768px breakpoints.

- [ ] P2 — **`aitri resume` — session handoff briefing** — after a break or team change, there is no way to brief a new agent (or session) on project state without reading all artifacts manually.
  Problem: `aitri status` shows phase state but gives no context about decisions, debt, coverage, or what's in progress. A new agent or new team member has no onboarding point. They must read all artifacts independently.
  Files: `bin/aitri.js` (add `resume` case), `lib/commands/resume.js` (new — orchestrates extractContext from all phases)
  Behavior:
  - `aitri resume` → prints a structured markdown briefing to stdout covering:
    ```
    # AITRI SESSION RESUME — <project> (<date>)

    ## Pipeline State
    [which phases are approved, what's next]

    ## Architecture & Stack Decisions
    [extractContext from 02_SYSTEM_DESIGN.md — tech stack + ADRs summary]

    ## Open Requirements
    [FRs from 01_REQUIREMENTS.json — id + title + type + acceptance_criteria]

    ## Test Coverage
    [fr_coverage from 04_TEST_RESULTS.json if exists]

    ## Technical Debt
    [technical_debt[] from 04_IMPLEMENTATION_MANIFEST.json if exists]

    ## Rejection History
    [rejections from .aitri config]

    ## Next Action
    [same logic as aitri status next-step]
    ```
  - Output is designed to be pasted as context for a new agent session
  - No new state written. No artifacts created. Read-only. Pure stdout.
  - Gracefully skips sections if artifacts don't exist yet
  Decisions: Stdout only (not a file) — the user decides where to send it (pipe, copy, redirect). Reuses existing `extractContext()` functions from each phase — no new parsing logic. Deprecated reference: `runResumeCommand` in `runtime-flow.js` — same intent, simpler implementation.
  Acceptance: `aitri resume` in a project with phases 1-3 approved prints a briefing with stack decisions, open FRs, and rejection history. Missing artifacts produce graceful "not yet available" notes. Output can be piped: `aitri resume > handoff.md`.

- [ ] P2 — **`aitri adopt` — onboard existing projects (diagnostic mode)** — no way to bring a project with older Aitri artifacts or partial pipeline state into the current Aitri version.
  Problem: Projects started with older Aitri versions may have artifacts that don't pass current `validate()`. There's also no way to start an Aitri pipeline for a project that already has some artifacts (e.g., started manually, or mid-pipeline from another tool).
  Files: `bin/aitri.js` (add `adopt` case), `lib/commands/adopt.js` (new)
  Behavior — Phase 1: diagnostic only (read-only, no state written):
  - `aitri adopt [path]` — scans the target directory for Aitri artifacts and `.aitri` config
  - For each artifact found: runs `p.validate(content)` from current phase definitions
  - Prints a compatibility report:
    ```
    AITRI ADOPT REPORT — <path>
    ══════════════════════════════
    ✅ 01_REQUIREMENTS.json — passes current validator
    ⚠️  02_SYSTEM_DESIGN.md — MISSING required section: ## Security Design
    ❌ 03_TEST_CASES.json — not found
    ❌ .aitri — not found (project not initialized with Aitri)

    → Recommendation: run `aitri init` then re-run phases: 2, 3, 4, 5
    ```
  - Does NOT modify anything. Does NOT create `.aitri`. Exit 0 always.
  - Phase 2 (future, separate item): `aitri adopt --init` that initializes `.aitri` and records which phases pass validation as "completed"
  Decisions: Diagnostic-only for Phase 1 — prevents accidental corruption of existing projects. `--from-code` (reverse-engineer from codebase without any artifacts) is deferred — too risky without proper scoping. Only supports local directory adoption (no URL, no zip).
  Acceptance: `aitri adopt /path/to/existing-project` prints validation report for each artifact found. No files created or modified in target directory. `aitri adopt` on a directory with no artifacts prints "no Aitri artifacts found" and exits 0.

- [ ] P2 — **Artifacts folder (`spec/`) — organized artifact storage** — all Aitri artifacts land in project root mixed with application code; hard to find and visually noisy.
  Problem: `01_REQUIREMENTS.json`, `02_SYSTEM_DESIGN.md`, `Dockerfile`, `DEPLOYMENT.md` all in root alongside `src/`, `package.json`, `README.md`. For humans reviewing pipeline artifacts, there's no clean separation.
  Files: `lib/state.js` (`readArtifact()` — accept `artifactsDir` param), `lib/commands/init.js` (write `artifactsDir` to `.aitri`), `lib/phases/index.js` (no change — artifact names unchanged), ALL commands that use `path.join(dir, p.artifact)` → `path.join(dir, artifactsDir, p.artifact)`
  Behavior:
  - `aitri init` creates `.aitri` with `"artifactsDir": "spec"` → artifacts go into `spec/` → also creates `spec/` directory
  - All commands read `config.artifactsDir` (default: `''` for backward compat) and prefix all artifact paths with it
  - Existing projects: `artifactsDir` absent from `.aitri` → defaults to `''` → artifacts in root → zero behavior change
  - New projects: `spec/` folder is created at `init` time; all phases write to `spec/<artifact>`
  - `aitri status` and `aitri validate` look in `spec/` for new projects, root for old ones
  Decisions: Folder name `spec/` (not `client_requirements/` — artifacts include system design, test cases, compliance; not just client reqs). Configurable via `.aitri` `artifactsDir` field for teams that prefer different names. This is backward compatible — not a breaking change. Requires touching all commands that build artifact paths (mechanical change). `test/smoke.js` will need path updates. Deprecated reference: two-folder approach (`.aitri/` hidden + `specs/` visible) — we simplify to one visible folder.
  Acceptance: `aitri init` in new dir creates `spec/` folder and `.aitri` with `artifactsDir: "spec"`. `aitri run-phase 1` briefing instructs agent to write to `spec/01_REQUIREMENTS.json`. `aitri complete 1` reads from `spec/`. Old project (no `artifactsDir` in `.aitri`) → artifacts still read from root.

- [ ] P3 — **`aitri checkpoint` — named state snapshot** — no way to mark a specific point in the pipeline as a reference for later recovery or handoff.
  Problem: `aitri resume` generates a briefing from current state, but if the current state is mid-phase-4 and broken, the briefing reflects the broken state. A checkpoint captures a known-good state explicitly.
  Files: `bin/aitri.js` (add `checkpoint` case), `lib/commands/checkpoint.js` (new — thin wrapper on resume output)
  Behavior:
  - `aitri checkpoint [--name <label>]` — runs the same logic as `aitri resume` and writes output to `checkpoints/<timestamp>[-<label>].md`
  - Creates `checkpoints/` directory if it doesn't exist
  - `aitri checkpoint --list` — lists all checkpoints with date and label
  - Checkpoints are read-only reference files — never modified by other Aitri commands
  Decisions: Checkpoints are plain markdown (same format as `aitri resume`) — no binary state, no `.gitignore` required, human-readable, committable to version control. Implements after `aitri resume` is done — shares the same output logic.
  Acceptance: `aitri checkpoint --name before-phase4-refactor` creates `checkpoints/2026-03-11-before-phase4-refactor.md`. File contains same content as `aitri resume`. `aitri checkpoint --list` prints all checkpoint files with dates.

---

## Engineering Quality (Best Practices + Three Amigos)

> Source: SDLC Studio best-practices pattern + BDD Three Amigos methodology.
> Goal: Aitri-generated projects must comply with engineering quality standards, not just pipeline documentation standards.

- [ ] P2 — **Best practice documents injected into phase briefings** — Phase 2 (Architect) and Phase 4 (Developer) receive no architectural or coding standards; agent makes arbitrary quality decisions.
  Problem: Agent may produce architecturally sound artifacts that pass Aitri validators but violate basic engineering practices (no error handling, hardcoded secrets, no observability, SOLID violations). Aitri validates schema compliance, not engineering quality.
  Files: `templates/best-practices/architecture.md` (new), `templates/best-practices/development.md` (new), `templates/best-practices/testing.md` (new), `templates/phases/phase2.md` (add `{{BEST_PRACTICES_ARCH}}`), `templates/phases/phase4.md` (add `{{BEST_PRACTICES_DEV}}`), `templates/phases/phase3.md` (add `{{BEST_PRACTICES_TESTING}}`), `lib/commands/run-phase.js` (read and inject best-practices files)
  Behavior:
  - `templates/best-practices/architecture.md` — injected into Phase 2 briefing. Contents:
    - Separation of concerns: each module has one responsibility
    - 12-factor: config via env vars, stateless processes, explicit dependencies
    - Observability: structured logging, health check endpoint, error codes consistent
    - No single point of failure: document fallback for each critical component
    - Every significant tech decision must have an ADR with ≥2 options evaluated
  - `templates/best-practices/development.md` — injected into Phase 4 briefing. Contents:
    - No hardcoded secrets or environment-specific values in source
    - All errors handled explicitly — no silent catch blocks
    - No magic numbers — extract to named constants
    - Input validation at system boundaries (HTTP endpoints, file reads, user input)
    - No commented-out code in deliverables
    - Every function that can fail must return an error or throw — never return null silently
  - `templates/best-practices/testing.md` — injected into Phase 3 briefing. Contents:
    - Given/When/Then must use concrete values — no "valid input" or "some user"
    - Each TC must test one behavior — not multiple assertions on unrelated things
    - Negative tests must assert the exact error (status code, message, or exception type)
    - No test that always passes regardless of implementation
  - `run-phase.js` reads the relevant best-practices file for the phase and injects it as a new `{{BEST_PRACTICES}}` block in the template. Files that don't exist: skipped silently (backward compat).
  - Best-practices files are plain markdown — teams can customize them per project by copying to project `best-practices/` dir (project-level overrides global).
  Decisions: Best practices are injected as context to the agent — they are guidelines, not validated by `complete`. This avoids adding brittle string-matching validators for quality concepts. Reference: SDLC Studio uses same injection pattern for 15 domain-specific files. Content is opinionated but grounded in established engineering principles (12-factor, SOLID fundamentals).
  Acceptance: `aitri run-phase 2` output includes a `## Engineering Standards` section sourced from `templates/best-practices/architecture.md`. `aitri run-phase 4` includes a `## Coding Standards` section. Removing the best-practices file → section absent → no error (graceful).

- [x] P1 — **Three Amigos gate — Phase 3 TCs must trace to Phase 1 ACs, not just FRs**
  **Status: ✅ Done in v0.1.30** — Phase 3 test cases reference `requirement_id` (FR level) but not the specific acceptance criterion (`ac_id`) that the test validates.
  Problem: A TC can claim to cover FR-001 but test a different behavior than what AC-001 defines. There is no cross-phase check that the QA engineer's test aligns with the PM's exact acceptance criterion. This breaks the "three amigos" principle: Business (PM), QA, and Dev must agree on the same observable outcome.
  Files: `lib/phases/phase3.js` (`validate()` update), `templates/phases/phase3.md` (update instructions), `lib/phases/phase1.js` (`extractContext()` — ensure AC ids are passed to Phase 3)
  Behavior:
  - `validate()` in `phase3.js`: for each TC, check that `ac_id` field is present and non-empty. If absent → reject with list of non-compliant TCs.
  - Cross-phase check: parse `01_REQUIREMENTS.json` from project dir; for each TC's `ac_id`, verify the AC exists in the corresponding FR's `acceptance_criteria`. If `ac_id` references a non-existent AC → reject with specific message.
  - `extractContext()` in `phase1.js` for Phase 3: ensure `acceptance_criteria` with their `id` fields are passed (already partially done — verify `id` field is present in each AC object in the schema).
  - Phase 3 briefing template: update instructions to require `ac_id` per TC and explain the Three Amigos principle: "Every TC must trace to a specific PM-defined acceptance criterion. This ensures QA and PM agree on the same observable outcome before implementation begins."
  Decisions: `ac_id` field already exists in the `03_TEST_CASES.json` schema but is not currently required by `validate()`. This is a validate() tightening, not a schema change. Cross-phase file read in `validate()` is acceptable — already done by `verify-complete` for FR coverage. Warn (not block) if `01_REQUIREMENTS.json` is not found (project may not yet have Phase 1 artifact when validate is called in isolation).
  Acceptance: `aitri complete 3` on a `03_TEST_CASES.json` where TC-001 has no `ac_id` → exits 1 listing TC-001. TC-001 with `ac_id: "AC-999"` that doesn't exist in Phase 1 → exits 1 with "AC-999 not found in FR-001". All TCs with valid `ac_id` references → exits 0.

---

## Documentation & UX

> Items that improve how Aitri presents itself to users and developers — without changing behavior.

- [ ] P2 — **README restructure — professional branding, progressive disclosure** — current README (354 lines) exposes full JSON schemas, all validation rules, and all flags at the same level; no visual identity; no progressive disclosure.
  Problem: Users opening the README face a wall of JSON schemas before understanding what Aitri does. There is no visual branding. Secondary content (schemas, validation rules, advanced flags) has equal weight as primary content (what it is, how to install, how to start). This hurts adoption and first impressions.
  Files: `README.md` (full rewrite)
  Behavior — new structure:
  ```
  1. ASCII art header (from deprecated Aitri cli/index.js lines 80-85)
     █████╗ ██╗████████╗██████╗ ██╗
    ██╔══██╗██║╚══██╔══╝██╔══██╗██║  ...etc
  2. Tagline: "Spec-Driven SDLC engine. Agent-agnostic."
  3. Badges: npm version | Node 18+ | Apache 2.0 | tested
  4. One-line install: npm install -g aitri
  5. What it does (3 sentences max)
  6. Pipeline diagram (current diagram, tightened)
  7. Quick Start (5 steps: init → fill IDEA.md → run-phase 1 → complete → approve)
  8. Core commands table (2 columns: command | what it does) — essential only, no flags
  9. Compatible agents table (Claude Code, Codex, Gemini Code, Opencode, any bash agent)
  10. Design principles (4-line table: Stateless | Zero deps | stdout protocol | Human gates)
  11. "Full reference: aitri help" — note that schemas, validators, advanced flags are in help output
  12. License
  ```
  Content moved OUT of README (into `aitri help` or `docs/`):
  - Full JSON schemas for all 5 artifacts
  - Validation rules per artifact
  - Context drift mitigation table
  - Feedback loop section (→ covered by Quick Start)
  - Test quality gates detail (→ `aitri help verify`)
  Decisions:
  - ASCII art: use deprecated Aitri's AITRI block letters (lines 80-85 of `cli/index.js`) — clean and matches brand identity
  - No emojis — Aitri's tone is technical and deterministic, not consumer-friendly
  - No `aitri help --advanced` command needed — schemas and detail move to `docs/REFERENCE.md` (new file, linked from README)
  - Badges use shields.io with npm/github sources — static URLs, no external dep on Aitri side
  - spec-kit (github/spec-kit) is reference for structure and progressive disclosure, not for emoji style
  Acceptance: README fits in one screen scroll for the first impression (install + what + quick start). Full JSON schemas are no longer in README. ASCII art renders correctly in GitHub and npmjs.com README display.
