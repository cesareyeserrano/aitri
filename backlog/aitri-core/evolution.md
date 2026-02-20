# Aitri Evolution Backlog

## 🟢 Ready for Implementation

- **[EVO-008] Feature: Project Adoption (`aitri adopt`)**

    - **Source:** User Feedback (Session 2026-02-20)
    - **Priority:** High
    - **Context:** Aitri can only work on projects it created from scratch. There is no path for onboarding an existing project built by other agents, teams, or developers with different folder structures.
    - **Problem:** A mature Node/Python/Go project exists. It has code, tests, maybe a README. It has NO Aitri spec. The developer or agent wants to bring it under Aitri's spec-driven workflow without rewriting anything.
    - **Command:** `aitri adopt [--feature <name>] [--depth quick|standard|deep] [--dry-run]`
    - **Invariants (non-negotiable):**
        - Read-only on all source files — NEVER modifies `src/`, tests, or existing code
        - Output is always DRAFT — human must run `aitri approve` before anything is enforced
        - Idempotent — if Aitri structure already exists, `adopt` diffs instead of overwriting
        - Phase 1 works without AI config; Phase 2 requires `ai` config
    - **Phases:**
        - **Phase 1 (Scan — deterministic, no AI):**
            - Scan: `package.json`, `pyproject.toml`, `go.mod`, `README.md`, `.env.example`, test files, entry points, folder structure
            - Detect: tech stack, custom folder conventions (non-standard `src/`, `__tests__/`, etc.)
            - Produce: `docs/adoption-manifest.json` (inventory of what was found)
            - Propose: `aitri.config.json` if project uses non-standard paths
            - Initialize: Aitri folder structure without touching existing files
            - Output: summary of detected features, stack, and gaps vs Aitri standard
        - **Phase 2 (Infer — LLM, requires `ai` config):**
            - LLM reads manifest + README + key entry points (bounded, not full codebase)
            - Infers: candidate feature list, Functional Rules from code behavior, Actors, Acceptance Criteria from existing tests
            - Generates: `specs/drafts/<feature>.md` per inferred feature (DRAFT, never APPROVED)
            - Generates: `docs/discovery/<feature>.md` retrograde discovery document
            - Generates: `tests/<feature>/tests.md` mapping existing test names to TC-* format (where detectable)
        - **Phase 3 (Map — after human approval of drafted specs):**
            - After `aitri approve` runs on adopted specs, map existing tests to TC-* in backlog
            - Generate `aitri.config.json` with verified path mappings
    - **Acceptance (Phase 1):** `aitri adopt --dry-run` shows scan results and proposed config. `aitri adopt` initializes structure and writes `adoption-manifest.json`. No source files modified.
    - **Acceptance (Phase 2):** `aitri adopt --depth standard` with AI config produces at least one DRAFT spec from README/code inference. Human can run `aitri approve` on the result.

## 🟡 In Progress

_(none)_

## 🔴 Done

- **[EVO-009] Enhancement: Version-Aware Project Migration (`aitri upgrade` v2)**
    - **Status:** DONE. `semverLt()`, `readProjectVersion()`, `readAppliedMigrations()`, `stampProjectVersion()` added to `upgrade.js`. `sinceVersion` field on migrations. `NOTIFY-NEW-COMMANDS-0.5.0` (atomic, writes `docs/UPGRADE-NOTES-v0.5.0.md`). Idempotent via `migrationsApplied` in `project.json`. 142/142 green.

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
