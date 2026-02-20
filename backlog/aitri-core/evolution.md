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

- **[EVO-009] Enhancement: Version-Aware Project Migration (`aitri upgrade` v2)**
    - **Source:** User Feedback (Session 2026-02-20)
    - **Priority:** Medium
    - **Context:** `aitri upgrade` already exists (v0.4.0) with a `MIGRATIONS` array pattern. It currently has 2 migrations and no version-gating. When a new Aitri version is released, existing projects cannot automatically adopt new features or have their artifacts updated.
    - **Problem:** User installs Aitri v0.5.0 on a project built with v0.4.0. The project has old test stubs without `{{CONTRACT_IMPORT}}`, no `ai` config hint, and no awareness of new commands (`diff`, `verify-intent`, `checkpoint`). `aitri upgrade` should bridge this gap.
    - **What already works:** The `MIGRATIONS[]` runner in `upgrade.js` is solid — `applies()` detects need, `apply()` executes, confirmation gate before writes.
    - **What needs adding:**
        1. **Version comparison:** Read `docs/project.json`.`aitriVersion`, compare to current. Only run migrations for versions newer than the project's last upgrade.
        2. **`migrationsApplied` tracking:** Add `migrationsApplied: []` to `docs/project.json` after each run. Idempotent by design.
        3. **v0.5.0 migrations (new):**
            - `NOTIFY-AUDITOR-MODE`: if project has specs/approved but no `ai` config, print notice about Auditor Mode and add commented example to `.aitri.json`
            - `NOTIFY-NEW-COMMANDS`: print summary of new commands available since last upgrade (diff, verify-intent, spec-improve, checkpoint)
            - `UPDATE-PROJECT-VERSION`: stamp `docs/project.json` with new `aitriVersion` after all migrations run
        4. **Migration API:** Add `targetFromVersion` and `targetToVersion` fields per migration entry for precise version gating
    - **Acceptance:** `aitri upgrade` on a v0.4.0 project detects version gap, shows migration plan, applies applicable migrations, and updates `aitriVersion` in `docs/project.json`. Running `aitri upgrade` again is a no-op.

## 🟡 In Progress

_(none)_

## 🔴 Done

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
