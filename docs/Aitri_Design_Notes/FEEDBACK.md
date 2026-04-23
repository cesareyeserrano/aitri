# Aitri — Testing Feedback

> **Purpose:** capture observations from testing sessions (manual or E2E with Claude).
> This is not a changelog or an implementation log — those go in CHANGELOG.md and BACKLOG.md.

> **Entry lifecycle:**
> observation → document here → analyze → move to BACKLOG.md (or discard) → **delete entry**
> If an entry stays here for more than one session without action, delete it anyway.

-------

## 2026-04-22 — E2E on Ultron (v0.1.65 → v0.1.89 adopted, brownfield)

**Session:** Claude Opus 4.7 acting as end-user operator. Mission: take Ultron-AP from a "descuadrado" (drifted, un-stabilized) state to fully stable + ready-for-next-feature, while recording friction. Ultron was adopted at v0.1.65 and untouched in the pipeline for ~5 weeks; CLI had advanced 24 minor versions.

**Final state reached on Ultron:** `deployable: true`, 8/8 phases approved, 20/20 tests, audit on record (0d stale), 0 active bugs (3 filed + fixed in code + closed through lifecycle), 6 backlog items tracked (P2×3, P3×3).

**Headline signal:** the pipeline is **brittle around schema evolution between versions** — a class of bug that only surfaces on real brownfield adopters, not on Aitri's own test fixtures. Three separate artifact-vs-reader mismatches in a single session. None caught by `test/release-sync.test.js`.

---

### A1 — `lib/snapshot.js` NFR renderer reads wrong schema (SEV: MED)

`snapshot.js:237-244` reads NFRs as `{id, category, requirement}`. Ultron's v0.1.65-era `01_REQUIREMENTS.json` uses `{id, title, constraint}`. Result: `aitri resume` prints `NFR-001 (undefined): undefined ×4`. Same class of bug for FRs (renderer reads `fr.type` not present in older schema → `(must-have, undefined)`).

**Fix options (ranked):**
1. Cosmetic: renderer tolerates both schemas (`nfr.category ?? nfr.title`, `nfr.requirement ?? nfr.constraint`). Cheapest, zero risk.
2. Correct: `adopt --upgrade` runs a field rename migration, logs it.
3. Structural: version artifact schemas, per-version reader.

### A2 — `verify-run` silently corrupts `04_TEST_RESULTS.json` on schema drift (SEV: HIGH)

Nastiest finding. Ultron's v0.1.65-era `03_TEST_CASES.json` uses `requirement` (string, sometimes comma-separated for multi-FR TCs). Current `verify.js:187` reads `tc.requirement_id`. Consequence chain:
1. `tcToFR[tc.id] = undefined` for every TC.
2. `fr_coverage` computed with all zeros (`tests_passing: 0`).
3. `04_TEST_RESULTS.json` **overwritten** with broken coverage.
4. `verify-complete` blocks with "Requirement coverage failure — these FRs have zero passing tests: FR-001..FR-015" even though the runner reported all 20 TCs passing and the file on disk had correct coverage seconds earlier.

The previous (correct) coverage is **silently destroyed**. Only because `04_TEST_RESULTS.json` was git-tracked could the state be recovered via `git checkout`. A user on a fresh clone or without committed results loses it with no warning.

Silent data destruction + breaks the invariant "tests passed → verify-complete accepts it". Not cosmetic, correctness-level.

**Fix:**
- `verify-run` refuses to write fr_coverage if the TC→FR mapping is empty when any TCs exist (clear signal of schema mismatch, not a legit "nothing covered" case).
- Precondition check in verify-run: read `03_TEST_CASES.json`, if neither `requirement_id` nor `frs` appears on any entry, error out with a migration hint.
- `adopt --upgrade` migrates `tc.requirement` → `tc.requirement_id` and logs the rename.

### A3 — `adopt --upgrade` is version-only, message claims to reconcile artifacts (SEV: MED — UX/trust)

Resume text before upgrade says: *"This is non-destructive: it reconciles your artifacts with the current state, updates the version, and preserves all approvals and completed phases."*

In practice `adopt --upgrade` rewrites `aitriVersion` in `.aitri/config.json` and does nothing else. Does not "reconcile your artifacts". After upgrade, both the NFR rendering bug (A1) and the TC field-name mismatch (A2) remain — exactly the "artifacts vs current state" discrepancies the message promises to reconcile.

**Fix:** either deliver the reconciliation the message promises, or rewrite the message: *"Bumps the version; artifacts are not migrated. Run `aitri normalize` and re-verify to surface drift."*

### A4 — `normalize` has no escape hatch for legacy projects (SEV: MED)

Ultron's Phase 4 was approved before `normalizeState` existed (v0.1.80). `aitri normalize` now refuses: *"No normalize baseline found. A baseline is recorded automatically when you approve build (phase 4). Complete the pipeline to Phase 4 first."* — but Phase 4 **is** approved. Message is technically correct, operationally false.

Meanwhile Ultron has real post-P4 code changes (commit `776e105` 2026-04-15, setFormBusy checkbox fix) that should have been classified via normalize but can't be. Those changes are invisible to the pipeline.

**Fix options:**
1. `aitri normalize --init` / `--baseline HEAD` to stamp a baseline without re-running Phase 4.
2. `adopt --upgrade` auto-stamps `normalizeState.baseRef = HEAD` when Phase 4 is approved and no state exists.

### A5 — `validate` flags Dockerfile/docker-compose even when Phase 5 explicitly rejected Docker (SEV: LOW)

Ultron's rejection history includes: *"Primary deployment target is Raspberry Pi via systemd — not Docker. Remove Dockerfile and docker-compose.yml."* Phase 5 was re-approved without those files. Yet `aitri validate` still prints:
```
⚠️  Dockerfile — not found (check Phase 5 output)
⚠️  docker-compose.yml — not found (check Phase 5 output)
```

Deploy-target-agnostic hardcoded expectations. For Pi/systemd/embedded/lambda/etc. they'll always warn. Harmless — but user-hostile: after an explicit Phase 5 decision, the CLI is still second-guessing it.

**Fix:** read Phase 5 output to determine expected deployment artifacts, or skip Docker warnings unless a `docker` deployment mode is declared.

### A6 — `init`/`adopt` records project path with inconsistent capitalization (SEV: LOW)

Hub registry and `aitri status --json` carry `location: "/Users/cesareyeserrano/Documents/PROJECTS/Ultron"` (capital U). Disk is `/ultron` (lowercase). macOS case-insensitive FS masks the issue locally. On Linux/CI/the Raspberry Pi deploy target, `cd /opt/Ultron` vs `/opt/ultron` will fail to match. Source is probably the project name field, not `process.cwd()`.

**Fix:** record the path as on disk, not derived from project name.

### F1 — `aitri resume` headline reads like success while `health.deployable` is false

Session opened, resume printed every phase ✅, tests 20/20, verify ✅. A casual reader would close the terminal thinking "done." The version-mismatch warning was earlier in the output — helps, but Pipeline State section reads like a success banner. Consider surfacing `health.deployable = false` next to the phase table, not only in the bottom Health section.

### F2 — `validate` and `status` disagree on ship-readiness after bug filing

- `status`: "→ Next: aitri bug list — 1 critical/high bug(s) open — resolve before proceeding"
- `validate`: "✅ Pipeline complete. Deployment artifacts are ready — run your deploy commands to ship."

Both are technically right (validate = artifacts/gates; status = priority ladder including bugs), but the contradiction reads as Aitri contradicting itself.

**Fix:** `validate` reads the same priority ladder as `status`/`resume` and defers to it. "Pipeline artifacts are ready, but 1 open blocking bug — resolve before deploy" rather than "ready to ship".

### F3 — Audit quality is agent-dependent; no mechanical check

`aitri audit` produces a prompt → agent reads code → agent writes AUDIT_REPORT.md → agent runs `aitri audit plan` → agent files bug/backlog. Aitri does not verify audit was honest, complete, or well-calibrated. A lazy agent could write "No issues found" and Aitri would mark `auditLastAt` and call it done.

Format does enforce specificity (file:line references required). Severity calibration is entirely agent-side. This is consistent with Aitri's "generates prompts, does not enforce content" design, but worth flagging: weaker models produce shallow audits that look complete. For tier-1 mission ("produced software quality"), audit quality is a real lever.

### F4 — Output shape inconsistency across commands

`aitri bug add` prints `✅ BG-001 created — status: open`. `aitri backlog add` prints `✅ Added BL-001: <title>`. Different tense, different info layout. Small but noticeable in a single session that exercises both.

### F5 — `aitri audit` and `aitri audit plan` could be fused

Two separate briefings for what is effectively one decision flow (find findings → triage them). `audit plan` re-reads AUDIT_REPORT.md from disk to present it back. Could be a single pass.

### F6 — `aitri bug fix / verify / close` lifecycle is honor-system (SEV: MED — integrity gap)

After filing BG-001 (high-sev), I edited `internal/database/secrets.go`, ran `go test ./...` (pass), then walked `aitri bug fix` → `verify` → `close`. Each transition printed ✅ with no check. I could have skipped the code edit entirely and the same three commands would close the bug. The `bug verify` output itself says "after confirming the fix manually" — Aitri openly acknowledges no mechanism to confirm.

For a pipeline whose selling point is "gates prevent agents from lying", this is a structural gap.

**Options:**
- `aitri bug verify BG-NNN --verified-by <TC-ID|manual-note>` required; close cannot follow without verify that has evidence.
- On `bug close`, require a commit SHA. Still honor-system (agent picks the SHA), but leaves an artifact trail pointing at a diff.
- Integrate bug close with re-verify: cannot close a bug tagged to an FR unless the last verify-run for that FR is post-fix timestamp.

### F7 — Aitri's own "descuadrado" detection is weaker than user's tacit signal

The user's diagnosis was "Ultron está descuadrado". Aitri's diagnosis of the same project at session start: "Phase 1-5 ✅ approved; tests 20/20; Verify ✅" — the only visible concern was version-mismatch. If the user had trusted Aitri's surface signals, nothing would have looked wrong.

Real underlying state was: (a) schema drift artifacts↔CLI readers [A1, A2], (b) post-P4 code changes unclassified [A4 via normalize gap], (c) audit never on record despite commit `44cd192` citing AF-* findings. Aitri surfaces (c) explicitly (priority-9 action), blind to (a) and (b).

Version-mismatch is not just "rebadge config.json" — it's an active signal the project may need re-verification under current schemas. Making Aitri detect its own legacy drift would be tier-1 leverage.

### What worked well

- Hash-based drift detection: solid, zero false positives in session.
- `aitri bug add` / `aitri backlog add` CLIs: clean fields (severity, fr, tc, priority, problem).
- Enforce-at-gate model (Phase 5 requires FR coverage, verify-complete requires pass count) — the right abstraction when it works (no schema drift).
- `health.deployable` + `deployableReasons[]` + `nextActions[]` priority ladder — well-designed for tooling consumption.
- Audit briefing itself: 5 dimensions + "specificity rule" + required output format guide an auditing agent toward a real report.
- No permission prompts, no data exfil, everything local.

### Priority ranking (by CLAUDE.md evaluation criterion)

Tier 1 (consumer software quality), Tier 2 (Aitri usability), Tier 3 (internal coherence):

1. **[Tier 1] A2** — verify-run silent coverage destruction. Preserves verify state for consumer projects. Highest leverage.
2. **[Tier 1] A4** — normalize escape hatch. Brownfield projects with post-P4 changes are currently orphaned from drift classification.
3. **[Tier 2] F6** — bug lifecycle integrity. Closing the honor-system gap strengthens every `aitri bug` operation going forward.
4. **[Tier 2] A1** — NFR renderer. Cosmetic today, undermines trust in less-visible enforcement.
5. **[Tier 2] A3** — `adopt --upgrade` honest messaging. Either deliver or rewrite.
6. **[Tier 2] A5** — Docker warnings in validate. Small fix, eliminates a recurring annoyance.
7. **[Tier 2] F2** — `validate` vs `status` disagreement. Unify the message.
8. **[Tier 3] A6** — path capitalization. Cross-platform hygiene, no current failure.

### Evidence base note

Per CLAUDE.md: *"tier-1 signal is speculative for any external project."* This session is one data point. Three of the Aitri findings (A2, A4, A5) would not have surfaced without a real adopted project predating the current schema — exactly the brownfield-evolution bug class that is *only* discoverable via sessions like this. Worth running periodically on other real adopters, not just Ultron.

---

## Second-pass observations (post-commit `aitri status` + `aitri resume`)

After committing the stabilization changes to Ultron and re-running `aitri status` / `aitri resume`, a few new items surfaced.

### F8 — `aitri resume` dumps 220 lines for a stable project; useful signal is ~15 (SEV: MED)

Full `aitri resume` output on Ultron, post-commit, fully green: **220 lines**. Of those, ~10 is Pipeline State, ~5 is Last Session, ~5 is Next Action, ~10 is Test Coverage summary. The rest — ~190 lines — is verbatim dump of `02_SYSTEM_DESIGN.md` (sections 1-8: architecture, C4 diagram, module map, data flows, ADRs, non-functional targets, etc.) plus every FR-001..FR-015 with every single AC enumerated, plus every NFR.

For the common case ("what do I do next?"), 95% is noise. The architecture dump is useful on re-entry after long absence, not on every resume. Current output is near-impossible to scan in a terminal.

**Fix options:**
- Default to brief output (pipeline state + last session + next action + bug/backlog counts). Full dump behind `aitri resume --full`.
- Or adaptively truncate: if all phases are approved + no drift + no blocking issues, skip architecture + requirements dump; surface them only when state is incomplete.
- Or include a "## What I was doing" summary from `lastSession` context (the text you stored with `aitri checkpoint --context "..."`) and make that the default, not the full artifact re-paste.

### F9 — Schema-drift cosmetic output (A1) persists post-commit, confirming diagnosis

After the commit, `aitri resume` still prints `FR-013 (nice-to-have, undefined):` and `NFR-001..004 (undefined): undefined`. Confirms A1 is a reader-side issue, not data corruption on my side. Nothing I did touched the requirements JSON.

### F10 — "Last Session" block is useful, but drifts from git reality

New addition I hadn't noticed:
```
## Last Session
- **When:** 4/22/2026, 8:14:10 PM
- **Event:** verify-run
- **Files touched:** .aitri/config.json, spec/04_TEST_RESULTS.json
```

Good feature — helps with "what was I doing." BUT: the referenced event is the `verify-run` I triggered that corrupted `04_TEST_RESULTS.json`. I reverted the file via `git checkout spec/04_TEST_RESULTS.json` and moved on, so the *event* in Aitri's log happened, but its on-disk effect was undone.

`lastSession` is pulled from the events array in `.aitri/config.json`, which is append-only and doesn't know about external reversions. So Aitri's self-reported "what I last did" is diverged from git truth.

**This is a second-order symptom of A2.** A2 causes the bad write; the event log bakes it in permanently even after recovery. Worth noting but probably folds into the A2 fix (if verify-run refuses to write on schema mismatch, no bad event is logged in the first place).

### F11 — Persistent `→ Next:` recommendation for a stabilized project

On a project where every gate is green and nothing needs doing:
- `status`: `→ Next: aitri validate`
- `resume`: `1. aitri validate — All artifacts approved, verify passed — confirm deployment readiness`

Priority-7 `aitri validate` is suggested every time, even though validate just passed 30 seconds ago. The priority ladder has no "terminal" state — it always surfaces *something*.

For a stable project ready for next feature, the right headline is closer to: **"Stable. No action required. Start a new feature with `aitri feature init <name>`."** Today's output implies there's still work pending, creating low-grade anxiety that something is unfinished.

**Fix:** add a terminal priority ("project stable, ready for next feature") that outranks priority-7 validate when: all phases approved + no drift + no blocking bugs + audit fresh + verify fresh. In that case `nextActions` should be empty (or a single explicit "ready" marker), not a reflexive suggestion to re-validate.

### F12 — Source-code drift after bug fix is invisible to Aitri

I edited three files under `internal/**` to fix BG-001/002/003. `04_IMPLEMENTATION_MANIFEST.json` lists implementation files — yet Aitri shows no drift. Why? Because `artifactHashes` hashes the artifact JSON, not the source files it references. Aitri tracks "did the spec change" not "did the code the spec describes change."

This is consistent with the design (Phase 4 approval + post-P4 normalize), but in combination with A4 (normalize is inaccessible on this project) it means three real behavior-changing code edits are **completely invisible** to Aitri's drift surface. The bug-close commands updated `BUGS.json` but the link between "BG-001 closed" and "these specific source files changed" is nowhere — no SHA, no file list.

**Fix:** closing a bug should capture `git rev-parse HEAD` (or at least `git diff --name-only` since bug fix started) into `BUGS.json`. Costs nothing, makes the audit trail real. Ties into F6 (honor-system lifecycle).

### F13 — `git add .codex/` adds `.codex/instructions.md` but no `.gitignore` guidance

`aitri adopt --upgrade` generates `CLAUDE.md`, `GEMINI.md`, and `.codex/instructions.md` in the project root. Standard practice would be either (a) all committed (multi-agent onboarding artifact) or (b) all in `.gitignore` (per-user local config). Aitri picks (a) by writing them, but gives no guidance. A user might:
- Commit all three and regret it later if their team doesn't use Codex or Gemini.
- Commit only CLAUDE.md and gitignore the others, creating inconsistency.
- Gitignore all three, then hit "files overwritten on next upgrade" confusion.

**Fix:** `adopt --upgrade` should print a one-liner about the generated files and the recommended treatment. Or output them into a `.aitri/agents/` directory which is clearly project-state rather than user-local.

### F14 — Commit didn't touch Aitri's version or state; `aitri status` looks identical pre/post-commit

A subtle design choice I want to flag. I committed a substantive change (three code fixes + audit + bug closures + 398-line diff). After commit, `aitri status` output is **identical** to before commit. No "Last commit: 9a9d4cf" line. No "N files changed since last verify-run." Nothing that tells Aitri "the project moved."

From Aitri's perspective, the commit never happened. The only on-disk signal is a new entry in git history, which Aitri doesn't consult.

**Is this a bug?** Not exactly — Aitri operates on artifacts, not git. But when a user works in a flow of "code → commit → status," the invisibility of the commit is strange. A commit is by far the most common action between `aitri ...` invocations. Suggest: `status` header includes `Git: <branch> @ <short-sha>` and, if verify is older than last commit to `internal/**`, flag that as a soft signal ("code committed since last verify").

---

## Meta-observation

The second pass found **as many issues as the first** (F8–F14 vs the full original set). This is because the first pass was "do the thing", the second was "look at what it shows me." Running `aitri status` and `aitri resume` with eyes tuned to output quality revealed UX debt that "mission mode" had power-read past.

Practical implication: feedback sessions should explicitly include a "walk the tool" pass where the tester just runs the main user-facing commands and critiques what they see, separate from the "execute a pipeline" pass.
