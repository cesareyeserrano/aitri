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

### Core — v2.0.0 promotion gate

The `adopt --upgrade` reconciliation protocol (ADR-027 + addendum), the `.aitri` shared/per-machine state question (ADR-028), and the output-contract test discipline (ADR-029) all shipped across alpha.1 → rc.4 — see CHANGELOG.md for per-release detail. The technical case for v2.0.0-stable is clean: every quality finding surfaced by author-owned canaries (Hub, Ultron, Zombite, Cesar, Go-on-RPi) is closed.

**The one open gate is non-technical:** promotion to stable v2.0.0 requires **at least one third-party adopter validating end-to-end**. Author canaries are necessary but not sufficient — they share the author's mental model and biases, and alpha.6 was a regression internal tests did not catch. This is a CLAUDE.md Critical rule and extends to any future breaking major.

- [ ] **`.aitri/local.json` split** — tracked in ADR-028 as an open question. Separate shared pipeline state from per-machine state. One real signal (Hub) is insufficient; need a second consumer before taking the breaking-change hit.

### Core — seed-input elicitation D3 (deferred; D1+D2 shipped rc.4)

- [ ] P2 — **Just-in-time constraint confirmation before Phase 2 and UX.** D1+D2 (seed-input provenance) shipped in rc.4 per [ADR-032](DECISIONS.md#adr-032--2026-05-21--seed-input-elicitation-provenance-contract-over-honor-system-inference). D3 is the deferred efficiency layer.
  Problem: Tier-A inputs that bite *later* — hard constraints (compliance, data residency, deadline, mandated stack), deployment target, brand identity — are not elicited at the moment they matter. `phase2.js` Technical Risk Flags analysis is blind to constraints it was never given; UX invents brand tokens with no identity input. Asking all of these at seed time is premature bloat.
  Files: `templates/phases/architecture.md`, `templates/phases/phaseUX.md`; optionally `lib/phases/phase2.js` / `lib/phases/phaseUX.js` if backed by a gate.
  Behavior: each phase briefing opens with a short "inputs to confirm with the user before this phase" block scoped to that phase's Tier-A-late set. Soft (D1-style) unless paired with a provenance check on those phases (D2-style).
  Decisions: ship only after D1+D2 prove out on a real canary; per ADR-032 the tier-1 value is provisional until a non-author consumer validates that operators answer honestly. Do NOT add per-phase gates speculatively.
  Acceptance: architecture briefing on a constraint-bearing project surfaces the confirmation block; if gated, `complete 2` blocks on an unconfirmed compliance-relevant constraint.

- [ ] P2 — **`approve` human-review checklist no-ops in agent mode — DESIGN RESOLVED (B1+B2), see [ADR-034](DECISIONS.md).** `lib/commands/approve.js::printApprovalSummary` + `askChecklist` early-return on `!process.stdin.isTTY`, so when an agent runs `approve` there is no summary and no checklist — the content-judgment surface collapses exactly like the seed interview did.
  Problem: the human-judgment gate (is the design good? are the FRs right?) is structurally absent in the only real operating mode. Distinct from D2 (which gates the seed mechanically) — this is about content review on every phase.
  Files: `lib/commands/approve.js`; `lib/state.js` (config field); `templates/AGENTS.md`; `lib/commands/help.js` (E3 Interactive-vs-Agent section); `docs/integrations/SCHEMA.md`; tests in `test/commands/approve.test.js`.
  Behavior (resolved): **B1** — print the per-phase checklist content + summary on EVERY approve, TTY and non-TTY (today non-TTY prints nothing). **B2** — default stays print-and-proceed (autonomy for CI/agent runs); add opt-in `.aitri#humanApprovalGate` (boolean, additive) — when true, non-TTY `approve` BLOCKS so serious projects get a real review window. Agent instruction in AGENTS.md: treat `approve` as a checkpoint, do not auto-chain phases. **E3** — `help` gains an "Interactive vs Agent mode" section.
  Decisions: do NOT make TTY mandatory (breaks CI). The drift-re-approval isTTY block (approve.js:292) is unchanged. Comments handled by git/PR; modifications caught by existing drift detection — no new comment subsystem. Trade-off accepted (ADR-034): with the flag off a fully-autonomous run can approve all phases without a human; the window is opt-in.
  Acceptance: non-TTY `approve` prints the checklist; with `humanApprovalGate: true` non-TTY `approve` exits non-zero pointing to a human; TTY behavior unchanged; default (flag absent) behavior unchanged except the checklist now prints.

### Core — pre-2.0.0 audit (rc.9 spine shipped; R2–R6 queued)

> Full disposition incl. theater rejections + zero-dep correction: [ADR-034](DECISIONS.md). C1 (stack-agnostic coverage) + C2 (assertion-density gate) shipped rc.9 — see CHANGELOG. Items below are queued, ordered by impact on produced code.

- [ ] P2 — **A1/A2/A3 — stack-agnosticism: Docker + web-UI assumptions leak into non-web produced software.** `templates/phases/deploy.md:35-37` lists `Dockerfile` + `docker-compose.yml` as unconditional "Files to create" (invariant #4 violation — a Go binary / CLI / library is forced to invent containers); `lib/personas/devops.js:10,12,23` reinforces it; `lib/personas/ux.js:26,46` hardcodes web breakpoints (`375px/768px/1440px`) for *every screen* while its own archetype list (`ux.js:15`) includes CLI tools — internal contradiction.
  Files: `templates/phases/deploy.md`, `lib/personas/devops.js`, `lib/personas/ux.js`; Phase 2 (`templates/phases/architecture.md`) to force an explicit "containerized? Y/N" decision so the conditional has a flag to read; tests in `test/phases/`.
  Behavior: Docker files become conditional on System Design declaring containerized deployment; DevOps Docker constraints conditional on the same; UX breakpoints conditional on a web/screen medium. Consistent with the "Stack-aware project profile" study — local conditionals, NO `profile` axis.
  Acceptance: a non-containerized project's Phase 5 briefing does not mandate Dockerfile; a CLI-archetype UX spec is not forced into 375px breakpoints; existing web projects unchanged.

- [ ] P3 — **P2(persona) — architect persona lacks a ❌/✅ few-shot example.** `lib/personas/architect.js` is the only generative persona without a concrete bad/good pair, despite asking for something abstract (ADR with ≥2 options). Add a bad-ADR/good-ADR example. Files: `lib/personas/architect.js`; test in `test/phases/phase2.test.js`.

- [ ] P3 — **F1 — security is opt-in across the pipeline; Phase 1 should force the question.** Security is threaded as conditionals (Phase 2 Security Design, Phase 3 attack vectors, audit/reviewer personas) but only fires if the user declares a security NFR. Make Phase 1 force the agent to *answer* whether security applies (Y/N + why), like it already does for observability/CI/CD/healthcheck.
  Files: `templates/phases/requirements.md` (+ optional soft gate in `lib/phases/phase1.js`); test in `test/phases/phase1.test.js`.
  Behavior: Phase 1 briefing requires an explicit security-applicability answer; a "not applicable" must carry a reason. Do NOT add a dedicated security persona (F2 — deferred, speculative without a security-sensitive adopter).
  Acceptance: Phase 1 on a project with no security NFR surfaces the forced question; an explicit "not applicable + reason" satisfies it.

- [ ] P3 — **D1 — Phase 5 compliance level not checked against test evidence.** `lib/phases/phase5.js` validates FR-id presence in `requirement_compliance` but does not enforce `level ≥ complete ⇒ fr_coverage shows covered`. An FR with `uncovered`/`partial` coverage can be marked `production_ready`. Claim-vs-evidence consistency (not field presence — legitimate, mirrors Phase 3 coverage checks).
  Files: `lib/phases/phase5.js` (read `04_TEST_RESULTS.json#fr_coverage`); `docs/integrations/ARTIFACTS.md`; test in `test/phases/phase5.test.js`.
  Behavior: `complete 5` blocks when any FR's compliance level is `complete`/`production_ready` while its fr_coverage status is not `covered`. Narrow surface — `verify-complete` already requires ≥1 passing test per FR to reach Phase 5; this closes the `uncovered`/`partial`-claimed-ready residual.
  Acceptance: a compliance entry claiming `production_ready` on an `uncovered` FR blocks; a `covered` FR claiming `production_ready` passes.

- [ ] P3 — **D2 — AC-traceability legacy skip is silent.** `lib/phases/phase3.js` skips the `ac_id`→Phase-1 cross-check when Phase 1 uses the legacy (non-structured) AC schema, so TCs can reference ACs that do not exist. Convert the silent skip to an error when `ac_id` fields are present but Phase 1 cannot be validated. Files: `lib/phases/phase3.js`; test in `test/phases/phase3.test.js`. Narrow (legacy projects only).

- ~~E2 — document `--check`/`--full`/`--explain`/`--guided`/`--coverage-threshold` in `help`~~ — SHIPPED rc.14.
- **E1 — unify the next-action marker — REJECTED as non-defect (rc.14, [ADR-034](DECISIONS.md) / CHANGELOG).** Investigation found three deliberate channels, not an inconsistency: `PIPELINE INSTRUCTION` = agent's single authoritative action (approve/verify); branching hints = where the human chooses (complete/reject); `→ Next:` = human display (status). Unifying would conflate semantics + risk breaking agents keyed on the marker. Only the AGENTS.md "each command" wording was wrong (fixed rc.14). Re-open ONLY if a real consumer-confusion case surfaces — tracked under the Command-surface audit study below.

### Core — verify-run swallows runner exit-code/parse divergence (rc.4 Hub canary 2026-05-21)

- [ ] P3 — **`verify-run` ignores a non-zero runner exit code that the parsed TC results don't explain.** Surfaced on the rc.4 Hub canary: `npm test` exited 1, but Aitri parsed 27 passed / 0 failed / 5 skipped and accepted the run as passing. Correct in this case (the 5 skipped explain the exit 1), but the divergence is swallowed with no signal.
  Problem: `verify-run` decides pass/fail purely from parsed per-TC results, never from the runner exit code. Today that is the right architecture — npm/jest/pytest exit codes conflate "test failed" with "tests skipped", coverage thresholds, and post-test hooks, and Aitri already hard-distinguishes "runner missing" (ENOENT → `err()`) from a test outcome. But exit code 1 + parsed-clean is treated *identically* to exit code 0 + parsed-clean. The latent risk (not yet observed in any consumer): a runner that crashes/truncates output mid-run — the parser sees the passes it captured, misses the TCs that never ran, and exit code 1 is the only remaining signal, which is dropped. The agent noticed the mismatch manually in the Hub transcript; Aitri did not surface it.
  Files: `lib/commands/verify.js` (`cmdVerifyRun` — `exitCode` already captured at `:466`, persisted as `exit_code` at `:649`; Z1 pass/fail decision at `:682-683`); test in `test/commands/verify.test.js`.
  Behavior: emit a stderr warning (not a hard block) ONLY in the narrow case where the exit code is unexplained by the parse — `exit_code !== 0 && summary.failed === 0 && summary.skipped === 0`. With any skips or failures present, the exit code is explained — stay silent (otherwise it fires on most projects with skipped tests = noise). Wording: flag that the runner reported failure but no failing/skipped TC was detected, and suggest the operator confirm all tests actually ran (possible truncated/crashed run or missing `@aitri-tc` markers).
  Decisions: warning only — do NOT promote exit code to a pass/fail gate. The parsed-output authority is deliberate (ENOENT handling, skipped-test tolerance) and must not regress. No schema change (`exit_code` already stored). No version bump unless it ships as observable stderr output (then bump — visible CLI behavior change).
  Acceptance: a verify-run whose runner exits non-zero with 0 failed + 0 skipped parsed emits the warning; a run with exit 1 + ≥1 skipped (the Hub case) stays silent; a clean exit-0 run stays silent.
  Evidence base: speculative per CLAUDE.md narrow-evidence rule — the failure mode it guards has NOT been observed; only the benign divergence (exit 1 explained by skips) was seen on an author-owned canary. Do not implement until a real consumer hits a truncated/crashed-run false-pass, OR the warning is judged cheap enough to ship as pure prevention.

### Core — N1 venv migration detects only the binary, not the test target (rc.5 Cesar canary 2026-05-22)

- [ ] P2 — **`diagnoseLegacyVenvManifest` flags a root-relative runner *binary* but not a root-relative test *target* in the same `test_runner` string.** Surfaced on the Cesar canary 2026-05-22 (5 pytest features): the agent fixed the flagged binary (`.venv/bin/pytest` → portable runner), the finding cleared, `adopt --upgrade` reported "no findings" — but `verify-run` then failed because the test target (`tests/foo.py`) is *also* root-relative and breaks under the alpha.9 feature-dir cwd. The agent had to edit the manifest a second time, forcing a second drift → re-approval round across all 5 features.
  Problem: the alpha.9 cwd change (root → feature dir) breaks *every* root-relative path in `test_runner`, but the N1 regex `VENV_RELATIVE_RUNNER = /^\.?venv\/|^env\//` matches only the leading binary token. A finding clearing is a weak proxy for "fixed" — the operator reads "no findings" as success (as happened in the transcript) while the runner still cannot execute. This roughly doubles the drift re-approval churn on affected projects.
  Files: `lib/upgrade/migrations/from-0.1.65.js` (`diagnoseLegacyVenvManifest`, `VENV_RELATIVE_RUNNER`, `buildVenvFinding`); `test/upgrade.test.js`.
  Behavior: extend detection to flag a `test_runner` whose non-flag tokens after the binary include a path that does not exist when resolved from the feature directory. Emit one finding (or augment the existing one) naming the unreachable target so the operator fixes binary + target in a single edit → single re-approval round.
  Decisions pre-resolved (from rc.5 analysis): (1) rc.5 already fixed the *guidance* half — the reason now leads with bare `pytest` (auto-detected) and warns absolute paths are machine-specific, and the verify-run hint matches; this entry is only the *detection* half. (2) Do NOT auto-rewrite the target (ADR-027 §2 shape-transforms-only; semantic transform forbidden). (3) Tokenizing a shell command to distinguish flags from path arguments is fragile (quoted args, `=`-flags, globs) — keep the heuristic conservative: only flag a bare token that contains `/`, does not start with `-`, and fails `fs.existsSync` from the feature dir. False positives must stay near zero or this becomes noise.
  Acceptance: a feature manifest with `test_runner: "pytest tests/foo.py -v"` where `tests/foo.py` does not exist under the feature dir produces a finding naming the target; a manifest whose target resolves correctly produces none; a manifest with only flags after the binary (`pytest -v`) produces none.
  Evidence base: ONE pytest project (Cesar). Before committing the tokenizing complexity, the rc.5 plan is to run the next canary on a **different stack** (Go/Node with a root-relative target) with the rc.5 guidance fix already in place — this isolates whether the churn drops to one round (guidance was the dominant cause) or the target gap persists and generalizes beyond pytest (justifying stack-agnostic detection). Do not implement until that signal exists.

### Core — `aitri normalize` briefing proportionality (N2)

> Parent friction cycle (Ultron canary 2026-04-27) is closed: N1 (behavioral allowlist) shipped alpha.4, N3 (verify-complete snapshot SSoT) shipped alpha.19. Only N2 remains, reclassified P1 → P3 on 2026-05-12.

- [ ] P3 — **Briefing proportional to change scope.** `lib/commands/normalize.js:303-306` embeds full content of `01_REQUIREMENTS.json` + `03_TEST_CASES.json` + `04_IMPLEMENTATION_MANIFEST.json` into the briefing (template `templates/phases/normalize.md:27-40`). Measured 70KB on Ultron-sized projects.
  Why P3 (not P1): post-N1 the FREQUENCY of normalize firing dropped from "every documentation update" to "real behavioral drift only". When it legitimately fires today, the agent is classifying actual behavior changes that may touch multiple FRs/TCs — full spec context is reasonable. Zero "briefing too big" reports since N1 (≈ 6 weeks). The optimization is polish now, not urgent.
  Files: `lib/commands/normalize.js` (replace full-spec embedding with file list + `git diff baseRef -- <file>` per file + only the FRs/TCs whose `files_created` mentions a changed file); `templates/phases/normalize.md`; `test/commands/normalize.test.js`.
  Behavior: briefing for a 1-file change drops from ~70KB to <10KB; agent still has full context for what changed without re-reading the entire spec.
  Decisions: cross-ref by exact path match in `04_IMPLEMENTATION_MANIFEST.json::files_created[].path`; if no FR/TC references the file, include the full FR/TC list as today (degrade gracefully). Diff per file capped at 200 lines, truncate with `... (N more lines, see git diff)`.
  Acceptance: briefing for a one-file source change <10KB, includes the file's diff and only FRs/TCs that reference it.
  Re-promotion criterion: a canary measures a normalize briefing >50KB on a real legitimate (post-N1, post-rc.1) drift case AND reports it as friction → re-promote to P2.

### Core — Consumer project backlog richness (schema enrichment + CLI flags deferred)

- [ ] P2 — **Schema enrichment + CLI flags for `BACKLOG.json`.** The scaffold portion (`templates/BACKLOG.md` written by `aitri init` / `aitri adopt apply`) shipped alpha.21. The following remain deferred (dormant):
  - `spec/BACKLOG.json` new optional fields (`files: string[]`, `behavior: string`, `acceptance: string`, `notes: string`) — additive per integration contract.
  - `aitri backlog add --files / --behavior / --acceptance / --from-file <path>` rich-input flags.
  - `aitri backlog show <id>` detail renderer.
  - `lib/commands/backlog.js` list detail view rendering new fields when present.

  Per CLAUDE.md narrow-evidence rule: only Hub validates the rich format today. The scaffold alone covers the Tier-1 value (consumer projects start with the format guide visible). Adding schema/CLI surfaces without a second consumer asking is design-by-imagination.
  Re-open criterion: a second consumer asks for CLI-managed rich entries OR a concrete defect surfaces from the JSON-schema thinness (e.g. an agent picks up a 4-field entry and re-derives the wrong files to touch).

### Core — add GitHub Copilot to compatible agents

- [ ] P2 — **Generate a GitHub Copilot instruction file alongside the existing agent files.** Today `writeAgentFiles` emits `AGENTS.md`, `CLAUDE.md`, `.codex/instructions.md`, `GEMINI.md` — Copilot is absent, so a project driven by Copilot operates the Aitri pipeline with no AGENTS.md guidance (degrades produced software, tier-1 thread per "Purpose over process").
  Problem: Copilot reads repository-wide custom instructions from `.github/copilot-instructions.md`; Aitri never writes it, so Copilot agents miss the `aitri resume`-first / phase-gate / functional-change rules every other supported agent receives verbatim.
  Files: `lib/agent-files.js` (`AGENT_FILES` array — add `'.github/copilot-instructions.md'`; `mkdirSync(..., { recursive: true })` already handles the `.github/` dir). Detection half: `lib/state.js::detectAgent`. Tests: `test/commands/init.test.js` (all-agent-files-identical + non-overwrite), `test/commands/adopt.test.js` (--upgrade regenerates absent), `test/upgrade.test.js`.
  Behavior: `aitri init` and `aitri adopt apply` write `.github/copilot-instructions.md` (same template content, non-destructive skip-if-exists). Existing consumers pick it up on next `adopt --upgrade` since the regeneration path recreates absent agent files.
  Decisions pre-resolved: (1) Content is the shared `templates/AGENTS.md` verbatim — same as the other three, no Copilot-specific fork. (2) `.github/copilot-instructions.md` is the correct convention (repo-wide instructions), not per-path `.github/instructions/*.instructions.md` (that's for scoped overrides Aitri doesn't need). (3) **Open question — do NOT fake a detection branch:** `detectAgent()` keys off CLI env vars (`CLAUDE_CODE`, `CODEX_CLI`, `GEMINI_CLI`). Copilot is an editor/IDE extension, not a CLI session, and exposes no documented stable env signal equivalent to those. The file-write half is unambiguous and worth shipping; the `detectAgent` half should be added only if a real Copilot env marker is verified — otherwise `lastSession.agent` stays `unknown` for Copilot and that is honest. Ship the file generation; leave detection as a follow-up gated on a verified env var.
  Acceptance: `aitri init` creates `.github/copilot-instructions.md` with content md5-identical to `CLAUDE.md`; re-init does not overwrite a hand-edited copy; `adopt --upgrade` on a project missing the file regenerates it.
  Version/docs: bumps (new operator-visible artifact written by init/adopt). Update `templates/AGENTS.md` if it enumerates the supported-agent set, and the integrations docs only if the agent-file list is a documented surface — verify before claiming a CHANGELOG entry is required.

---

## Design Studies

> Not implementation items. Open questions that inform future architectural decisions.

### Stack-aware project profile

Aitri assumed "web app with browser UI" as the default project shape; the runner bias (Playwright hardcoded in 6 places) shipped its fixes across alpha.8 (Go parser), alpha.14 (e2e gate accepts manual + stack-aware advice), alpha.16 (neutral messaging), alpha.20 (runner-neutral templates), alpha.23 (`tc mark-manual`). The remaining open question: should `.aitri` carry a `profile` field (`web | cli | service | library | embedded`) that conditionally enables/disables phase rules, NFR templates, and runner expectations?

**Open because:** today the runner-dispatch + neutralized-prompts approach covers the known cases without introducing a profile axis. A profile is justified ONLY if a second dimension of variation appears that runner dispatch alone cannot express. Examples that would trigger promotion to an implementation ticket:

- A project where Phase 1 NFR templates are wrong by stack (e.g. embedded firmware has no "user" actor, needs "operator" or "host system" — language drift, not runner drift).
- A project where the artifact chain itself should differ (e.g. firmware needs a hardware test plan that does not fit `03_TEST_CASES.json` schema; library needs an "API surface" artifact that does not exist today).
- Phase 5 deploy-readiness criteria that diverge structurally between stacks (a Go binary release ≠ a web deploy ≠ an npm publish — currently squeezed into one template).
- A real project with two simultaneous runners (Playwright for UI + `go test` for backend) where a "first runner wins" rule is genuinely insufficient. This case alone might justify a `runner` field per TC instead of a project-wide profile — investigate which axis the evidence points to.

**Promotion criterion:** when ≥2 of the above appear in real projects, design the abstraction. Until then, runner dispatch is enough.

**Cost of premature implementation:**
- Profile becomes a leaky abstraction: profiles overlap (a CLI tool may ship a small web dashboard; a service has both API and admin UI), edge cases multiply, and `init`/`adopt` has to ask the operator a question they cannot answer reliably.
- Adding a `profile` field to `.aitri` schema is a contract change consumers (Hub, future subproducts) must absorb. Doing it twice (once now wrongly, once later correctly) is more expensive than waiting.
- The dimension we eventually need may not be `profile` at all — it could be `runner` (per-TC), `platform` (target environment), or composition of several. Picking too early locks the abstraction to whatever the first non-web project happened to look like.

**What NOT to do in this study:**
- Don't enumerate profiles speculatively (`web | cli | service | library | embedded | mobile | …`) and design templates per profile. That's catalog growth without evidence.

**Evidence / source:** raised during 2026-04-29 session diagnosing the Go-on-RaspberryPi web-bias case. User explicitly authorized revisiting the "evidence narrow" principle from CLAUDE.md: verifiable bugs in code can ship without external canaries; speculative abstractions still need them. This study is the speculative half.

### Command-surface audit

Aitri exposes ~21 top-level commands today (`lib/commands/*.js`). Over successive minor versions, several have developed functional overlap — not broken, but potentially redundant. Before v0.2.0, run a single audit to map the surface and decide whether to collapse, rename, or keep.

**Suspected overlaps (to be confirmed by the audit):**

| Pair / Group | Suspected overlap |
| :--- | :--- |
| `resume` vs `status` vs `status --json` vs `validate` vs `validate --explain` | Four commands project the same `buildProjectSnapshot()` with different verbosity / framing |
| `audit` vs `review` | Both are evaluative read-only passes with personas (auditor, reviewer). Different scope (audit = whole project, review = per-phase) but same shape |
| `feature verify-run` vs `verify-run` | Same logic, scoped to a feature sub-pipeline. Candidate for `verify-run --feature <name>` |
| `tc verify` vs `verify-run` | Manual TC recording vs automated runner — correct split today, but worth confirming against use |

**Already reviewed (excluded from future audits):**
- `wizard` vs `init` + `adopt scan` — reviewed 2026-04-22, **kept**. Distinct surfaces: `init` bootstraps `.aitri` config (no IDEA.md), `adopt scan` derives IDEA.md from existing code, `wizard` interactively builds IDEA.md for greenfield projects. Plus `wizard` exports `runDiscoveryInterview()` consumed by `run-phase discovery --guided` — load-bearing.
- `checkpoint` vs auto-`writeLastSession` + `resume` — reviewed 2026-04-22, **kept**. `--name` writes frozen resume snapshots to `checkpoints/`; `--context` adds free-text annotation to `lastSession`. Bare mode is the only redundant path (~5 lines of overhead). Not worth a breaking rename.

**Criterion to mature into tickets:**
- A concrete case of user or agent confusion about which command to use.
- A maintenance cost surfaced during unrelated work (e.g. snapshot schema change had to be propagated to 4 commands that project it).
- A release that is already touching the command surface (v0.2.0 breaking batch).

**Scope when executed:**
1. One-page table: command → unique responsibility → overlaps with → evidence for or against keeping split.
2. Per overlap: decide `keep` / `alias` / `collapse` / `rename` with trade-off written down.
3. Output: entries in a `Core — Breaking changes for v0.2.0` section, or none if the audit finds no real overlap.

---

## Discarded

Items analyzed and explicitly rejected. Re-open only if the stated criterion is met.

| Item | Decision | Reason |
| :--- | :--- | :--- |
| Mutation testing | Dropped on evidence, not policy (reason corrected in [ADR-034](DECISIONS.md)) | **Reason corrected 2026-05-25:** the original "violates zero-dep" basis was a category error — zero-dep constrains what Aitri *imports*, not what it *orchestrates*. Orchestrating a project-declared mutation tool (in the consumer's own deps, like Playwright) adds zero deps to Aitri. The valid basis stands: C2 (assertion-density, now an opt-in `verify-complete` gate as of rc.9) covers ~60% of the same problem at zero cost, and no adopter has asked. Re-open: a security/production-critical adopter needing rigor deeper than C2 — implemented as project-declared orchestration, never bundled or globally-installed. |
| Aitri CI (GitHub Actions step) | Discarded 2026-04-17 | No active user demand. Contract not stable enough to publish a separate Action. If needed later, lives outside Core. |
| Aitri IDE (VSCode extension) | Discarded 2026-04-17 | Separate product with its own release cycle. Not incremental over the CLI; reconsidered if the CLI stabilizes across multiple external teams. |
| Aitri Report (PDF/HTML compliance report) | Discarded 2026-04-17 | User declined the surface. Compliance evidence already lives in `05_PROOF_OF_COMPLIANCE.json` + git history. |
| Aitri Audit (ecosystem-level cross-project aggregator) | Discarded 2026-04-17 | Functionally duplicates Hub's dashboard. Aitri Core does not maintain a global registry — adding one violates the passive-producer model. Name also collides with the per-project `aitri audit` command. |
| `aitri tc verify` recomputes `fr_coverage` | Discarded 2026-04-22 | `verify-complete` blocks failures via `d.results[].status`, not `fr_coverage` counts. Internal field drift is real but has no observable effect. Re-open if a future consumer (audit, Hub) starts reading per-FR counts. |
| Rename `checkpoint` to `note` | Discarded 2026-04-22 | `--name` writes frozen snapshots to `checkpoints/` (unique surface); `--context` annotates `lastSession`. No user complaint in 18 versions. Breaking rename for cosmetic improvement not justified. |
| NFR traceability in Phase 2 (Design Study) | Discarded 2026-04-22 | Criterion was "real case where approved design ignored a critical NFR and broke production". No such case has emerged. NLP-over-Markdown matching is high false-positive. Re-open if a real case appears. |
| `IDEA.md` → `spec/` move | Dropped 2026-04-23 | Opportunistic colado in the breaking-version window without its own evidence. NOT closed by alpha.17 (which targets the post-approval file, not pre-approval location). Re-open with its own evidence — a real consumer asking for the relocation, or a concrete defect. |
| Phase 3 canonical TC id regex | Dropped 2026-04-23 | Still waiting for the second evidence case that was the original gate; forcing it through the v2 batch inverted the evidence-before-breakage logic. |
| Upgrade banner cached-briefings warning | Not implementing (2026-05-02) | Proposed for the alpha.6→alpha.7 grammar boundary; trigger window expired (11+ alphas past). Re-open only if a future grammar change creates a new boundary. |
| Strengthen `release-sync.test.js` to detect missing integrations CHANGELOG entries | Not implementing (2026-05-02) | Both opt-out designs shift the failure mode without preventing it — neither replaces the human judgment "does this bump affect subproduct readers?" 1 actual miss in 18 alphas, caught by manual audit. Re-open on a second **unintentional** miss. |
| A2 — cascading root → features upgrade | Deferred indefinitely (ADR-030) | Three canary reconfirmations (Zombite + Cesar shallow + Cesar deep) confirmed the asymmetry exists but produces no consumer harm — gates are field-presence based. Re-open: (1) third-party adopter requests cascading for a concrete workflow, OR (2) a future migration becomes load-bearing for feature-scope state. |
