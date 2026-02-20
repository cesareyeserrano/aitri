# Aitri Evolution Backlog

## 🟢 Ready for Implementation

- **[EVO-008] Feature: Project Adoption (`aitri adopt`) — Phase 2**
    - **Source:** User Feedback (Session 2026-02-20)
    - **Priority:** High
    - **Phase 1 Status:** DONE. `cli/commands/adopt.js` — stack detection, folder conventions, entry points, adoption-manifest.json, proposed aitri.config.json. 5 regression tests. 147/147 green.
    - **Remaining work (Phase 2 — LLM inference):**
        - `--depth standard` activates LLM path; reads manifest + README + bounded entry points
        - Generates: `specs/drafts/<feature>.md` per inferred feature (DRAFT only)
        - Generates: `docs/discovery/<feature>.md` retrograde discovery document
        - Generates: `tests/<feature>/tests.md` mapping existing test names to TC-*
        - Requires `ai` config in `aitri.config.json`
    - **Phase 3 (Map):** After `aitri approve`, map existing tests to TC-* in backlog. Generate verified `aitri.config.json`.

## 🟡 In Progress

_(none)_

## 🔴 Done

- **[EVO-009] Enhancement: Version-Aware Project Migration (`aitri upgrade` v2)**
    - **Status:** DONE. `semverLt()`, `readProjectVersion()`, `readAppliedMigrations()`, `stampProjectVersion()` added to `upgrade.js`. `sinceVersion` field on migrations. `NOTIFY-NEW-COMMANDS-0.5.0` (atomic, writes `docs/UPGRADE-NOTES-v0.5.0.md`). Idempotent via `migrationsApplied` in `project.json`. 142/142 green.

- **[EVO-008] Feature: Project Adoption (`aitri adopt`) — Phase 1**
    - **Status:** DONE. `cli/commands/adopt.js` — stack detection (node/python/go/rust/java), folder conventions, entry points, test file count, README detection, gap analysis, `docs/adoption-manifest.json`, proposed `aitri.config.json` for path conflicts. `--dry-run` supported. NEVER modifies source files. 5 regression tests. 147/147 green.

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
