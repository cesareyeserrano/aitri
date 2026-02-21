# Aitri Evolution Backlog

## 🟢 Ready for Implementation

- **[EVO-010] Command: `aitri doctor` — Doc Policy Enforcement Gate**
  - **Source:** Critique session 2026-02-20. Promised in `docs/DOC_POLICY.md` but not implemented.
  - **Priority:** High
  - **Context:** `DOC_POLICY.md` defines a hard file budget for `docs/`. `aitri doctor` should scan `docs/` and warn (or fail with `--strict`) when unlisted files are present. Also usable as a CI gate.
  - **Scope:**
    - Read permitted file list from `docs/DOC_POLICY.md` (or a machine-readable sidecar)
    - Walk `docs/` recursively
    - Report files not in the permitted list
    - Exit `0` (warnings only) or `1` (with `--strict`)
    - JSON output with `--json`
  - **Out of scope:** Auto-deleting files.

- **[EVO-011] Enhancement: Structural Spec Quality Gate (non-LLM)**
  - **Source:** Critique session 2026-02-20. `aitri spec-improve` is LLM-only — no structural check exists.
  - **Priority:** Medium
  - **Context:** A spec can be formally approved even if it has empty sections, FRs without ACs, or duplicate IDs. These are structural defects that don't require an LLM to detect.
  - **Scope:**
    - Add a `--structural` flag to `aitri spec-improve` (or integrate into `aitri approve`)
    - Checks: every FR has at least one AC, no empty FR/AC body, no duplicate FR-*/AC-* IDs, no placeholder text (`TODO`, `TBD`, `...`)
    - Fails `aitri approve` when structural defects are found (unless `--force`)
    - No LLM call required
  - **Out of scope:** Semantic quality (that remains LLM territory).

- **[EVO-012] Enhancement: `aitri verify-coverage` — Contract Import Check**
  - **Source:** Critique session 2026-02-20. Once in Post-Go, Aitri has no enforcement that implementation actually references the contracts it generated.
  - **Priority:** Medium
  - **Context:** `aitri scaffold` generates contract files in `src/contracts/`. The agent can implement briefs without ever importing them. `aitri verify-coverage` closes this gap by checking that each contract file is imported in at least one test stub.
  - **Scope:**
    - Walk `src/contracts/<feature>/`
    - For each contract file, check if it is imported/required in any file under `tests/<feature>/generated/`
    - Report uncovered contracts
    - Exit `0` (all covered) or `1` (gaps found)
    - Integrate as an optional gate in `aitri deliver` pre-flight
  - **Out of scope:** Runtime test execution (that remains `aitri verify`).

## 🟡 In Progress

_(none)_

## 🔴 Done

- **[EVO-009] Enhancement: Version-Aware Project Migration (`aitri upgrade` v2)**
    - **Status:** DONE. `semverLt()`, `readProjectVersion()`, `readAppliedMigrations()`, `stampProjectVersion()` added to `upgrade.js`. `sinceVersion` field on migrations. `NOTIFY-NEW-COMMANDS-0.5.0` (atomic, writes `docs/UPGRADE-NOTES-v0.5.0.md`). Idempotent via `migrationsApplied` in `project.json`. 142/142 green.

- **[EVO-008] Feature: Project Adoption (`aitri adopt`) — All Phases DONE**
    - **Status:** DONE.
    - Phase 1 (`quick`): stack detection (node/python/go/rust/java), folder conventions, entry points, test file count, README, gap analysis, `docs/adoption-manifest.json`, proposed `aitri.config.json`. `--dry-run` supported. NEVER modifies source files.
    - Phase 2 (`standard`): LLM infers top 1–3 features → `specs/drafts/<feature>.md` (DRAFT) + `docs/discovery/<feature>.md`. Bounded context (README + entry point). Never overwrites approved specs. Graceful errors.
    - Phase 3 (`deep`): Scans existing test files; extracts test names (node/python/go patterns); builds `tests/<feature>/tests.md` with TC-* stubs and Trace placeholders; writes verified `aitri.config.json` if path overrides needed. Requires at least one approved spec.
    - Exports: `writeDraftSpec`, `writeDiscoveryDoc`, `extractTestNames`, `buildTestsMapping`, `writeTestsMapping`, `buildVerifiedConfig`.
    - 16 regression tests (5 Phase 1 + 4 Phase 2 + 7 Phase 3). 158/158 green.

- **[EVO-004] Doc: Vision Alignment Update**
    - **Status:** DONE. `docs/architecture.md` reframed for agent-centric workflow. `GETTING_STARTED.md` updated with Auditor Mode section. `docs/guides/AGENT_INTEGRATION_GUIDE.md` created.

- **[EVO-006] Scaffold: Automated Contract-Test Linkage**
    - **Status:** DONE. `parseTestCases` extracts FR-* refs; `buildContractImports` generates per-stack import statements. Templates updated with `{{CONTRACT_IMPORT}}`. 5 unit tests. 142/142 green.

- **[EVO-003] Architecture: State-Aware Context Engine**
    - **Status:** DONE. `aitri diff --feature <name> --proposed <file>` implemented. 4 regression tests. 137/137 green.

- **[EVO-001] Refactor: Auditor Mode for Content Generator**
    - **Phase 1 DONE:** `auditBacklog()`, `auditTests()`, `auditAgentContent()` exported. 8 unit tests.
    - **Phase 2 DONE:** `--ai-backlog` + `--ai-tests` flags in `aitri plan`. 2 regression tests. 133/133 green.
    - **Phase 3 DONE:** `inferBenefit`, `inferCapability`, `normalizeActor`, `toGherkin`, `fallbackActor` marked `@deprecated`. Legacy path documented in `generatePlanArtifacts`. 133/133 green.

- **[EVO-002] Feature: Semantic Validation Gate**
    - **Source:** docs/feedback/ARCHITECTURAL_FEEDBACK.md#1.2
    - **Status:** DONE. `aitri verify-intent` implemented. 4 regression tests. 123/123 green.

- **[EVO-007] Parser: Flexible Spec Heading Numbering**
    - **Source:** docs/feedback/TEST_DRIVE_FEEDBACK.md#1.2
    - **Status:** DONE. approve.js matches sections by name, number prefix optional. 119/119 green.

- **[EVO-005] Scanner Robustness: Relax TC Marker Regex**
    - **Source:** docs/feedback/TEST_DRIVE_FEEDBACK.md#1.3
    - **Priority:** High
    - **Context:** Allow `// TC-1` without mandatory colon.
    - **Status:** DONE. Verified with smoke tests.

- **[EVO-META] Self-Evolution System: Relay Protocol**
    - **Source:** User Feedback (Session 2026-02-18)
    - **Priority:** Critical
    - **Context:** Implement Checkpoint & Backlog for zero context-loss between agent sessions.
    - **Status:** DONE. `aitri checkpoint` command implemented. 119/119 tests green.
