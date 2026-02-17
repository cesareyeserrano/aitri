# Implementation Design: Phases I, J, K

> Precision blueprint for any agent to implement. Every file, function signature, artifact schema, test case, and integration point is specified.

Version: 1.0
Baseline: Aitri 0.2.26 (commit `a9870d7`, branch `main`)
Date: 2026-02-17

---

## Table of Contents

1. [Architectural Conventions (must-follow)](#1-architectural-conventions)
2. [Phase I: Iteration and Multi-Feature Lifecycle](#2-phase-i)
3. [Phase J: Brownfield Project Safety](#3-phase-j)
4. [Phase K: Retroactive Upgrade Protocol](#4-phase-k)
5. [Config and Path Extensions](#5-config-and-path-extensions)
6. [Status Integration Map](#6-status-integration-map)
7. [Test Specifications](#7-test-specifications)
8. [File Budget Allocations](#8-file-budget-allocations)
9. [Implementation Order and Dependencies](#9-implementation-order)
10. [Acceptance Criteria Matrix](#10-acceptance-criteria-matrix)

---

## 1. Architectural Conventions

Every new module MUST follow these patterns exactly. Non-compliance breaks the codebase.

### 1.1 Command Module Signature

```javascript
// cli/commands/<command>.js
import fs from "node:fs";
import path from "node:path";

export async function run<CommandName>Command({
  options,                          // Parsed CLI args (parseArgs output)
  ask,                              // (question: string) => Promise<string>
  getProjectContextOrExit,          // () => { config, paths }
  getStatusReportOrExit,            // (feature?) => StatusReport
  confirmProceed,                   // (options) => Promise<true|false|null>
  runAutoCheckpoint,                // ({ enabled, phase, feature }) => CheckpointResult
  printCheckpointSummary,           // (result) => void
  exitCodes                         // { OK: 0, ERROR: 1, ABORTED: 2 }
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  // ... implementation
  return OK; // or ERROR or ABORTED
}
```

### 1.2 Routing in cli/index.js

```javascript
import { run<CommandName>Command } from "./commands/<command>.js";

if (cmd === "<command>") {
  const code = await run<CommandName>Command({
    options,
    ask,
    getProjectContextOrExit,
    getStatusReportOrExit,
    confirmProceed,
    runAutoCheckpoint,
    printCheckpointSummary,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options, feature: options.feature });
}
```

### 1.3 Confirm Pattern (write commands only)

```javascript
const proceed = await confirmProceed(options);
if (proceed === null) {
  console.log("Non-interactive mode requires --yes for commands that modify files.");
  return ERROR;
}
if (!proceed) {
  console.log("Aborted.");
  return ABORTED;
}
```

### 1.4 JSON Output Pattern (read commands)

```javascript
const jsonOutput = options.json || (options.format || "").toLowerCase() === "json"
  || options.positional.some((p) => p.toLowerCase() === "json");

if (jsonOutput) {
  console.log(JSON.stringify(payload, null, 2));
  return payload.ok ? OK : ERROR;
}
// Human-readable output below
```

### 1.5 Path Resolver Addition (cli/config.js)

When adding a new file path, add it to `resolveProjectPaths()` return object:

```javascript
newFile(feature) {
  return path.join(docsRoot, "subdirectory", `${feature}.json`);
}
```

### 1.6 Test Pattern

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

test("<command> <behavior description>", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-<suite>-<test>-"));
  // setup...
  const result = runNode([...args], { cwd: tempDir });
  assert.equal(result.status, <expected>);
  assert.match(result.stdout, /<pattern>/);
});
```

---

## 2. Phase I: Iteration and Multi-Feature Lifecycle

### 2.1 Sub-Phase I.1: `aitri features` and `aitri next`

#### New file: `cli/commands/features.js` (~180 lines)

```javascript
export function runFeaturesCommand({
  options,
  getProjectContextOrExit,
  getStatusReportOrExit,
  exitCodes
}) {
  // Returns list of all features with their SDLC state
}

export async function runNextCommand({
  options,
  ask,
  getProjectContextOrExit,
  getStatusReportOrExit,
  confirmProceed,
  exitCodes
}) {
  // Suggests or starts next feature from queue
}
```

#### Feature Discovery Logic

Scan these directories to find all features:

```
specs/drafts/*.md        → state: "draft"
specs/approved/*.md      → state: "approved" (then check artifacts for sub-state)
docs/delivery/*.json     → if decision === "SHIP" → state: "delivered"
```

For each approved feature, determine sub-state by checking artifact existence:

```javascript
function resolveFeatureState(feature, paths) {
  const draft = fs.existsSync(paths.draftSpecFile(feature));
  const approved = fs.existsSync(paths.approvedSpecFile(feature));
  const delivery = readJsonSafe(paths.deliveryJsonFile(feature));

  if (delivery?.decision === "SHIP") return "delivered";
  if (delivery?.decision === "HOLD") return "blocked";
  if (fs.existsSync(paths.goMarkerFile(feature))) {
    // Post-go: check scaffold/implement/verify state
    if (fs.existsSync(path.join(paths.docsDeliveryDir, `${feature}.json`))) return "deliver_pending";
    return "implementation";
  }
  if (approved) return "approved";  // pre-discover through pre-go
  if (draft) return "draft";
  return "unknown";
}
```

#### `aitri features` Output

**Human-readable:**
```
Features in this project:

  Feature           State           Next Step
  ─────────────────────────────────────────────
  user-auth         delivered       (complete)
  payment-api       implementation  aitri verify --feature payment-api
  search-index      draft           aitri approve --feature search-index

Total: 3 features (1 delivered, 1 in progress, 1 draft)
```

**JSON (`--json`):**
```json
{
  "ok": true,
  "features": [
    {
      "name": "user-auth",
      "state": "delivered",
      "specFile": "specs/approved/user-auth.md",
      "deliveredAt": "2026-02-17T12:00:00.000Z",
      "nextStep": null
    },
    {
      "name": "payment-api",
      "state": "implementation",
      "specFile": "specs/approved/payment-api.md",
      "deliveredAt": null,
      "nextStep": "aitri verify --feature payment-api"
    }
  ],
  "summary": { "total": 3, "delivered": 1, "inProgress": 1, "draft": 1 }
}
```

#### `aitri next` Logic

1. Find all features not in "delivered" state
2. If a feature-queue file exists (`docs/project-queue.json`), use its priority order
3. If no queue file, sort by: draft first (newest), then approved (oldest)
4. Display the top candidate and offer to run its next command
5. In `--non-interactive`, just print the recommended command

#### New artifact: `docs/project-queue.json`

```json
{
  "version": 1,
  "updatedAt": "2026-02-17T12:00:00.000Z",
  "queue": [
    { "feature": "payment-api", "priority": 1, "addedAt": "2026-02-17T10:00:00.000Z" },
    { "feature": "search-index", "priority": 2, "addedAt": "2026-02-17T11:00:00.000Z" }
  ]
}
```

Queue is optional. If absent, `features` and `next` use filesystem discovery + default sort.

#### cli/index.js routing additions

```javascript
if (cmd === "features") {
  const code = runFeaturesCommand({ options, getProjectContextOrExit, getStatusReportOrExit, exitCodes: ... });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "next") {
  const code = await runNextCommand({ options, ask, getProjectContextOrExit, getStatusReportOrExit, confirmProceed, exitCodes: ... });
  await exitWithFlow({ code, command: cmd, options });
}
```

#### Help text addition (cli/index.js, help section)

```
Other:
  aitri status         Show current state and next step
  aitri resume         Resume from last checkpoint
  aitri features       List all features and their SDLC state
  aitri next           Start or continue the next prioritized feature
```

---

### 2.2 Sub-Phase I.2: `aitri amend`

#### New file: `cli/commands/amend.js` (~200 lines)

```javascript
export async function runAmendCommand({
  options,
  ask,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  // 1. Require --feature
  // 2. Verify feature has delivery with SHIP or approved spec
  // 3. Copy current approved spec to versioned archive
  // 4. Create new draft from approved spec for editing
  // 5. Mark downstream artifacts as stale
}
```

#### Versioning Model

When amending a delivered or approved feature:

```
specs/approved/payment-api.md              → active spec (will be replaced after re-approve)
specs/versions/payment-api/v1.md           → archived copy of previous version
specs/versions/payment-api/changelog.json  → version history
specs/drafts/payment-api.md                → new draft (copy of approved, user edits this)
```

#### Version Archive: `specs/versions/{feature}/changelog.json`

```json
{
  "feature": "payment-api",
  "versions": [
    {
      "version": 1,
      "approvedAt": "2026-02-10T08:00:00.000Z",
      "deliveredAt": "2026-02-15T16:00:00.000Z",
      "archiveFile": "specs/versions/payment-api/v1.md",
      "reason": null
    }
  ],
  "currentVersion": 2,
  "amendedAt": "2026-02-17T12:00:00.000Z",
  "amendReason": "Add pagination support based on user feedback"
}
```

#### Stale Marker Logic

When amend creates a new draft, write a stale marker:

```
docs/stale/{feature}.json
```

```json
{
  "feature": "payment-api",
  "staleSince": "2026-02-17T12:00:00.000Z",
  "reason": "Spec amended. Downstream artifacts (discovery, plan, backlog, tests) were generated from v1 and may not reflect v2 changes.",
  "staleArtifacts": [
    "docs/discovery/payment-api.md",
    "docs/plan/payment-api.md",
    "backlog/payment-api/backlog.md",
    "tests/payment-api/tests.md"
  ]
}
```

#### Integration with existing commands

- `aitri validate` MUST check for stale marker. If `docs/stale/{feature}.json` exists, add issue: `"Spec was amended. Re-run discover and plan to update downstream artifacts."`
- `aitri status` MUST report stale marker in JSON output: `"amendment": { "stale": true, "since": "...", "reason": "..." }`
- `aitri approve` of amended spec MUST delete stale marker after successful approval

#### Path additions (cli/config.js → resolveProjectPaths)

```javascript
specsVersionsDir: path.join(specsRoot, "versions"),
specVersionDir(feature) {
  return path.join(specsRoot, "versions", feature);
},
specChangelogFile(feature) {
  return path.join(specsRoot, "versions", feature, "changelog.json");
},
staleMarkerFile(feature) {
  return path.join(docsRoot, "stale", `${feature}.json`);
}
```

---

### 2.3 Sub-Phase I.3: `aitri feedback`

#### New file: `cli/commands/feedback.js` (~150 lines)

```javascript
export async function runFeedbackCommand({
  options,
  ask,
  askRequired,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  // 1. Require --feature (must be delivered or approved)
  // 2. Interactive: ask for feedback items (category, description, severity)
  // 3. Non-interactive: require --note "feedback text"
  // 4. Append to feedback artifact
  // 5. Suggest: "aitri amend" if feedback warrants spec change
}
```

#### New CLI option

```javascript
// In parseArgs:
} else if (arg === "--note") {
  parsed.note = (argv[i + 1] || "").trim();
  i += 1;
}
```

#### Feedback Artifact: `docs/feedback/{feature}.json`

```json
{
  "feature": "payment-api",
  "entries": [
    {
      "id": "FB-1",
      "addedAt": "2026-02-17T14:00:00.000Z",
      "category": "bug",
      "description": "Pagination returns duplicate items when page size changes between requests",
      "severity": "high",
      "resolution": null,
      "resolvedAt": null
    },
    {
      "id": "FB-2",
      "addedAt": "2026-02-17T15:00:00.000Z",
      "category": "improvement",
      "description": "Add cursor-based pagination as alternative to offset-based",
      "severity": "medium",
      "resolution": "amended",
      "resolvedAt": "2026-02-18T10:00:00.000Z"
    }
  ]
}
```

#### Interactive Flow (6 questions max)

```
Aitri Feedback Capture — payment-api

1) Category? (bug / improvement / requirement-gap / ux)
   > bug

2) Describe the feedback:
   > Pagination returns duplicate items when page size changes

3) Severity? (low / medium / high / critical)
   > high

Feedback recorded: FB-1
Stored: docs/feedback/payment-api.json

Suggestion: If this feedback requires spec changes, run:
  aitri amend --feature payment-api
```

#### Non-interactive Mode

```bash
aitri feedback --feature payment-api --note "Pagination duplicates on page size change" --non-interactive --yes
```

When `--note` is provided in non-interactive mode, category defaults to "improvement" and severity to "medium".

#### Path additions (cli/config.js → resolveProjectPaths)

```javascript
docsFeedbackDir: path.join(docsRoot, "feedback"),
feedbackFile(feature) {
  return path.join(docsRoot, "feedback", `${feature}.json`);
}
```

Note: `docs/feedback/` already exists in the current project for audit reports. The feature-specific feedback files use the same directory and do not collide (audit reports use descriptive names like `AUDITORIA_E2E_2026-02-16.md`, feature feedback uses `{feature}.json`).

#### Integration with post-delivery

In `cli/commands/post-delivery.js`, after SHIP completion, add:

```javascript
console.log("- Capture feedback: aitri feedback --feature " + feature);
```

In `cli/commands/session-control.js` → `maybePromptAndAdvance`, when `report.nextStep === "delivery_complete"`:

```javascript
// After dashboard, before live preview:
console.log("- Capture feedback: aitri feedback --feature " + (feature || report.approvedSpec?.feature));
```

---

## 3. Phase J: Brownfield Project Safety

### 3.1 Sub-Phase J.1: Init Conflict Detection

#### Modified file: `cli/commands/init.js` (~+80 lines)

Add a `detectConflicts()` function called before creating directories:

```javascript
function detectConflicts(initDirs, root) {
  const conflicts = [];
  for (const dir of initDirs) {
    if (!fs.existsSync(dir)) continue;
    // Check if dir has non-Aitri content
    const entries = fs.readdirSync(dir);
    const aitriMarkers = ["drafts", "approved", "discovery", "plan",
      "verification", "delivery", "implementation", "project.json",
      "insight", "stale", "feedback"];
    const foreignEntries = entries.filter((e) => !aitriMarkers.includes(e));
    if (foreignEntries.length > 0) {
      conflicts.push({
        dir: path.relative(root, dir),
        foreignEntries: foreignEntries.slice(0, 5),  // Show max 5
        total: foreignEntries.length
      });
    }
  }
  return conflicts;
}
```

#### Conflict Warning Flow

```javascript
const conflicts = detectConflicts(initDirs, process.cwd());
if (conflicts.length > 0) {
  console.log("WARNING: Existing directories detected with non-Aitri content:");
  conflicts.forEach((c) => {
    console.log(`  ${c.dir}/ (${c.total} existing files: ${c.foreignEntries.join(", ")}${c.total > 5 ? ", ..." : ""})`);
  });
  console.log("");
  console.log("Recommendation: Create aitri.config.json to map Aitri directories to a separate path:");
  console.log(JSON.stringify({
    paths: {
      specs: "aitri/specs",
      backlog: "aitri/backlog",
      tests: "aitri/tests",
      docs: "aitri/docs"
    }
  }, null, 2));
  console.log("");

  if (!options.nonInteractive) {
    const continueAnyway = await confirmYesNo({
      ask,
      question: "Continue with default paths anyway? (y/N): ",
      defaultYes: false  // Default NO — safer for brownfield
    });
    if (!continueAnyway) {
      console.log("Aborted. Create aitri.config.json first, then re-run aitri init.");
      return ABORTED;
    }
  } else {
    // Non-interactive: block unless --yes is explicit
    if (!options.yes) {
      console.log("Non-interactive mode: use aitri.config.json for custom paths or --yes to override.");
      return ERROR;
    }
    // --yes provided: proceed with warning
    console.log("Proceeding with default paths (--yes provided).");
  }
}
```

#### Project Type Detection

Add to init.js:

```javascript
function detectProjectType(root) {
  const signals = [];
  if (fs.existsSync(path.join(root, "package.json"))) signals.push("node");
  if (fs.existsSync(path.join(root, "pyproject.toml")) || fs.existsSync(path.join(root, "setup.py"))) signals.push("python");
  if (fs.existsSync(path.join(root, "go.mod"))) signals.push("go");
  if (fs.existsSync(path.join(root, "Cargo.toml"))) signals.push("rust");
  if (fs.existsSync(path.join(root, "pom.xml")) || fs.existsSync(path.join(root, "build.gradle"))) signals.push("java");
  return signals;
}
```

Store detected type in `docs/project.json`:

```json
{
  "name": "my-project",
  "initializedAt": "2026-02-17T12:00:00.000Z",
  "root": "my-project",
  "detectedStack": ["node"],
  "aitriVersion": "0.2.26"
}
```

#### Overwrite Protection for project.json

```javascript
const projectProfileFile = path.join(project.paths.docsRoot, "project.json");
if (fs.existsSync(projectProfileFile)) {
  const existing = readJsonSafe(projectProfileFile);
  if (existing && existing.name) {
    console.log(`Project profile already exists: ${path.relative(process.cwd(), projectProfileFile)} (${existing.name})`);
    if (!options.nonInteractive) {
      const overwrite = await confirmYesNo({
        ask,
        question: "Overwrite project profile? (y/N): ",
        defaultYes: false
      });
      if (!overwrite) {
        console.log("Kept existing project profile.");
        // Skip writing, continue with rest of init
      }
    }
  }
}
```

---

### 3.2 Sub-Phase J.2: Scaffold Coexistence

#### Modified file: `cli/commands/scaffold.js` (~+60 lines)

#### Dry-Run Mode

New CLI option:

```javascript
// In parseArgs (cli/index.js):
} else if (arg === "--dry-run") {
  parsed.dryRun = true;
}
```

In scaffold.js, before writing:

```javascript
if (options.dryRun) {
  console.log("DRY RUN — no files will be written:");
  plan.forEach((p) => {
    const exists = fs.existsSync(path.join(process.cwd(), p.relativePath));
    console.log(`  ${exists ? "[EXISTS]" : "[CREATE]"} ${p.relativePath}`);
  });
  return OK;
}
```

#### Existing Source Detection

Before creating `src/` subdirectories:

```javascript
function detectExistingSrcConflicts(srcRoot, plannedDirs) {
  if (!fs.existsSync(srcRoot)) return [];
  const conflicts = [];
  for (const dir of plannedDirs) {
    if (fs.existsSync(dir)) {
      const entries = fs.readdirSync(dir).filter((e) => !e.startsWith("."));
      if (entries.length > 0) {
        conflicts.push({
          dir: path.relative(process.cwd(), dir),
          existingFiles: entries.slice(0, 3),
          total: entries.length
        });
      }
    }
  }
  return conflicts;
}
```

If conflicts detected:

```
WARNING: Scaffold would write to existing directories with content:
  src/services/ (3 existing files: auth.js, db.js, utils.js)
  src/contracts/ (1 existing file: types.ts)

Aitri will only ADD new files. Existing files will NOT be overwritten.
```

#### Tech Stack Auto-Detection

When spec doesn't specify tech stack, read `docs/project.json`:

```javascript
function resolveStackFamily(parsedSpec, projectProfile) {
  // 1. Spec-defined (highest priority)
  const specStack = parsedSpec.techStack?.id;
  if (specStack) return specStack;

  // 2. Project profile detection (from init)
  if (projectProfile?.detectedStack?.length > 0) {
    const detected = projectProfile.detectedStack[0];
    console.log(`Tech stack auto-detected from project: ${detected}`);
    return detected;
  }

  // 3. Default
  return "node";
}
```

---

## 4. Phase K: Retroactive Upgrade Protocol

### 4.1 Sub-Phase K.1: `aitri doctor`

#### New file: `cli/commands/doctor.js` (~250 lines)

```javascript
export function runDoctorCommand({
  options,
  getProjectContextOrExit,
  exitCodes
}) {
  // Read-only scan. Never writes files.
}
```

#### Compatibility Checks Registry

```javascript
const CHECKS = [
  {
    id: "REQ-SOURCE-STATEMENT",
    since: "0.2.26",
    description: "Approved specs should include '## 10. Requirement Source Statement'",
    severity: "medium",
    check(ctx) {
      const specs = glob(ctx.paths.specsApprovedDir, "*.md");
      const missing = specs.filter((f) => {
        const content = fs.readFileSync(f, "utf8");
        return !content.includes("## 10. Requirement Source Statement");
      });
      return missing.length === 0
        ? { ok: true }
        : { ok: false, files: missing, fix: "aitri upgrade will add this section" };
    }
  },
  {
    id: "PROJECT-PROFILE",
    since: "0.2.25",
    description: "Project should have docs/project.json",
    severity: "low",
    check(ctx) {
      const file = path.join(ctx.paths.docsRoot, "project.json");
      return fs.existsSync(file)
        ? { ok: true }
        : { ok: false, fix: "aitri upgrade will create docs/project.json" };
    }
  },
  {
    id: "AITRI-VERSION-STAMP",
    since: "0.2.27",
    description: "Project profile should include aitriVersion field",
    severity: "low",
    check(ctx) {
      const file = path.join(ctx.paths.docsRoot, "project.json");
      if (!fs.existsSync(file)) return { ok: false, fix: "Run aitri upgrade" };
      const data = readJsonSafe(file);
      return data?.aitriVersion
        ? { ok: true }
        : { ok: false, fix: "aitri upgrade will add version stamp" };
    }
  },
  {
    id: "INFERRED-REQ-MARKERS",
    since: "0.2.26",
    description: "Specs should not contain 'Aitri suggestion (auto-applied)' markers",
    severity: "high",
    check(ctx) {
      const specs = [
        ...glob(ctx.paths.specsDraftsDir, "*.md"),
        ...glob(ctx.paths.specsApprovedDir, "*.md")
      ];
      const tainted = specs.filter((f) => {
        const content = fs.readFileSync(f, "utf8");
        return /Aitri suggestion \(auto-applied\)/i.test(content);
      });
      return tainted.length === 0
        ? { ok: true }
        : { ok: false, files: tainted, fix: "Replace inferred markers with explicit user requirements" };
    }
  },
  {
    id: "SHORT-IDEA-DRAFTS",
    since: "0.2.24",
    description: "Draft specs should not have been generated from ideas shorter than 15 characters",
    severity: "medium",
    check(ctx) {
      // Can't retroactively detect this, but can check for TBD-heavy drafts
      const drafts = glob(ctx.paths.specsDraftsDir, "*.md");
      const suspicious = drafts.filter((f) => {
        const content = fs.readFileSync(f, "utf8");
        const tbdCount = (content.match(/\bTBD\b/g) || []).length;
        return tbdCount > 5;  // More than 5 TBDs suggests auto-generated without real input
      });
      return suspicious.length === 0
        ? { ok: true }
        : { ok: false, files: suspicious, fix: "Review and complete these drafts with real user requirements" };
    }
  }
];
```

#### `aitri doctor` Output

**Human-readable:**
```
Aitri Doctor — Project Health Check
Aitri version: 0.2.27
Project: my-project

  Check                        Status    Severity    Fix
  ──────────────────────────────────────────────────────────
  REQ-SOURCE-STATEMENT         FAIL      medium      aitri upgrade
  PROJECT-PROFILE              PASS      -           -
  AITRI-VERSION-STAMP          FAIL      low         aitri upgrade
  INFERRED-REQ-MARKERS         PASS      -           -
  SHORT-IDEA-DRAFTS            PASS      -           -

Result: 2 gaps found (0 high, 1 medium, 1 low)
Run: aitri upgrade to fix auto-fixable gaps.
```

**JSON (`--json`):**
```json
{
  "ok": false,
  "aitriVersion": "0.2.27",
  "project": "my-project",
  "checks": [
    {
      "id": "REQ-SOURCE-STATEMENT",
      "ok": false,
      "severity": "medium",
      "description": "Approved specs should include '## 10. Requirement Source Statement'",
      "files": ["specs/approved/user-auth.md"],
      "fix": "aitri upgrade will add this section"
    }
  ],
  "summary": { "total": 5, "pass": 3, "fail": 2, "high": 0, "medium": 1, "low": 1 }
}
```

#### Exit codes

- `EXIT_OK` (0): All checks pass
- `EXIT_ERROR` (1): One or more checks fail

---

### 4.2 Sub-Phase K.2: `aitri upgrade`

#### New file: `cli/commands/upgrade.js` (~220 lines)

```javascript
export async function runUpgradeCommand({
  options,
  ask,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  // 1. Run doctor checks internally
  // 2. Show plan of auto-fixable changes
  // 3. Confirm proceed
  // 4. Apply fixes
  // 5. Auto-checkpoint
  // 6. Re-run doctor to confirm
}
```

#### Migration Registry

Each migration is idempotent and safe:

```javascript
const MIGRATIONS = [
  {
    id: "ADD-REQ-SOURCE-STATEMENT",
    appliesTo: "approved-specs",
    description: "Add Requirement Source Statement section to approved specs",
    apply(specFile) {
      const content = fs.readFileSync(specFile, "utf8");
      if (content.includes("## 10. Requirement Source Statement")) return { changed: false };
      // Find the last ## section and append after it
      const updated = content.trimEnd() + "\n\n## 10. Requirement Source Statement\n- Requirements in this spec were provided by the user.\n- Retroactively added by aitri upgrade.\n";
      fs.writeFileSync(specFile, updated, "utf8");
      return { changed: true };
    }
  },
  {
    id: "CREATE-PROJECT-PROFILE",
    appliesTo: "project",
    description: "Create docs/project.json if missing",
    apply(docsRoot, root, aitriVersion) {
      const file = path.join(docsRoot, "project.json");
      if (fs.existsSync(file)) {
        // Add aitriVersion if missing
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data.aitriVersion) return { changed: false };
        data.aitriVersion = aitriVersion;
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
        return { changed: true };
      }
      const data = {
        name: path.basename(root) || "aitri-project",
        initializedAt: new Date().toISOString(),
        root: path.basename(root),
        aitriVersion
      };
      fs.mkdirSync(docsRoot, { recursive: true });
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
      return { changed: true };
    }
  }
];
```

#### `aitri upgrade` Output

```
Aitri Upgrade — Retroactive Migration
Aitri version: 0.2.27

PLAN:
- Add Requirement Source Statement to: specs/approved/user-auth.md
- Add aitriVersion to: docs/project.json

Proceed? (Y/n): y

Applied 2 migrations:
  [OK] ADD-REQ-SOURCE-STATEMENT → specs/approved/user-auth.md
  [OK] CREATE-PROJECT-PROFILE → docs/project.json

Auto-checkpoint saved: abc1234
Checkpoint retention: last 10

Post-upgrade verification:
  aitri doctor → 0 gaps found. Project is up-to-date.
```

#### Critical Rule: Never Modify User Requirements

Migrations MUST ONLY:
- Add new structural sections (headers, metadata)
- Add missing config/metadata files
- Add version stamps

Migrations MUST NEVER:
- Change FR, AC, US, TC content
- Modify context, actors, edge cases, security sections
- Remove any existing content
- Alter traceability references

---

### 4.3 Sub-Phase K.3: Version Compatibility Matrix

#### New artifact: `core/compatibility.json`

Maintained in the Aitri repo (not in user projects):

```json
{
  "matrixVersion": 1,
  "entries": [
    {
      "version": "0.2.24",
      "changes": [
        {
          "id": "SHORT-IDEA-GATE",
          "type": "behavior",
          "description": "Draft rejects ideas shorter than 15 characters in non-interactive mode",
          "migration": null,
          "breaking": false
        }
      ]
    },
    {
      "version": "0.2.26",
      "changes": [
        {
          "id": "REQ-SOURCE-STATEMENT",
          "type": "artifact-structure",
          "description": "Specs should include ## 10. Requirement Source Statement",
          "migration": "ADD-REQ-SOURCE-STATEMENT",
          "breaking": false
        },
        {
          "id": "INFERRED-REQ-BLOCK",
          "type": "behavior",
          "description": "Approve gate blocks 'Aitri suggestion (auto-applied)' markers",
          "migration": null,
          "breaking": true
        }
      ]
    }
  ]
}
```

`aitri doctor` reads this file to determine which checks apply based on the project's last known Aitri version vs current version.

---

## 5. Config and Path Extensions

### Summary of all new paths to add to `cli/config.js` → `resolveProjectPaths()`

```javascript
// Phase I additions
specsVersionsDir: path.join(specsRoot, "versions"),
specVersionDir(feature) {
  return path.join(specsRoot, "versions", feature);
},
specChangelogFile(feature) {
  return path.join(specsRoot, "versions", feature, "changelog.json");
},
staleMarkerDir: path.join(docsRoot, "stale"),
staleMarkerFile(feature) {
  return path.join(docsRoot, "stale", `${feature}.json`);
},
docsFeedbackDir: path.join(docsRoot, "feedback"),
feedbackFile(feature) {
  return path.join(docsRoot, "feedback", `${feature}.json`);
},
projectQueueFile: path.join(docsRoot, "project-queue.json"),

// Phase J: no new paths (uses existing)
// Phase K: no new paths (uses existing + core/compatibility.json)
```

### Summary of new CLI options to add to `parseArgs()`

```javascript
// Phase I
} else if (arg === "--note") {
  parsed.note = (argv[i + 1] || "").trim();
  i += 1;

// Phase J
} else if (arg === "--dry-run") {
  parsed.dryRun = true;
}
```

---

## 6. Status Integration Map

### Changes to `cli/commands/status.js`

The status report JSON must include new fields. Add these to the return object of `getStatusReport()`:

```javascript
// Phase I: Multi-feature summary
features: {
  total: number,
  delivered: number,
  inProgress: number,
  draft: number,
  list: [{ name: string, state: string }]
},

// Phase I: Amendment/stale tracking
amendment: {
  stale: boolean,
  since: string | null,
  reason: string | null,
  staleArtifacts: string[]
},

// Phase I: Feedback summary
feedback: {
  total: number,
  open: number,         // entries without resolution
  resolved: number
},

// Phase K: Project version info
projectVersion: {
  aitriVersion: string | null,    // From docs/project.json
  currentVersion: string,          // Current CLI version
  upgradeAvailable: boolean        // currentVersion > aitriVersion
}
```

### Changes to `nextStep` recommendations

Add these to `toRecommendedCommand()`:

```javascript
case "delivery_complete":
  return "aitri feedback --feature " + feature;  // Suggest feedback after delivery

// When stale marker exists:
if (staleMarker) {
  return "aitri discover --feature " + feature;  // Re-run pipeline from discover
}
```

---

## 7. Test Specifications

### Phase I Tests: `tests/regression/iteration-lifecycle.test.mjs`

```
Test 1: "features lists all features with correct states"
  Setup: tempDir with 1 draft, 1 approved, 1 delivered feature
  Run: aitri features --json
  Assert: payload.features.length === 3, states match

Test 2: "next suggests highest-priority undone feature"
  Setup: tempDir with 2 approved features, project-queue.json with priority
  Run: aitri next --non-interactive
  Assert: stdout matches feature with priority 1

Test 3: "next works without project-queue.json (filesystem discovery)"
  Setup: tempDir with 1 draft feature, no queue file
  Run: aitri next --non-interactive
  Assert: stdout suggests the draft feature

Test 4: "amend creates versioned archive and new draft"
  Setup: tempDir with delivered feature
  Run: aitri amend --feature <name> --non-interactive --yes
  Assert: specs/versions/<feature>/v1.md exists, changelog.json exists,
          specs/drafts/<feature>.md exists, docs/stale/<feature>.json exists

Test 5: "validate detects stale artifacts after amend"
  Setup: tempDir with amended feature (stale marker present)
  Run: aitri validate --feature <name> --format json
  Assert: payload.ok === false, issues include "stale"

Test 6: "feedback captures entry and stores in artifact"
  Setup: tempDir with delivered feature
  Run: aitri feedback --feature <name> --note "Bug found" --non-interactive --yes
  Assert: docs/feedback/<feature>.json exists, entries.length === 1, entries[0].id === "FB-1"

Test 7: "feedback appends to existing entries"
  Setup: tempDir with existing feedback file (1 entry)
  Run: aitri feedback --feature <name> --note "Second issue" --non-interactive --yes
  Assert: entries.length === 2, entries[1].id === "FB-2"
```

### Phase J Tests: `tests/regression/brownfield-safety.test.mjs`

```
Test 1: "init warns when tests/ directory has existing content"
  Setup: tempDir with tests/app.test.js
  Run: aitri init --non-interactive (without --yes)
  Assert: exit 1, stdout matches /Existing directories detected/

Test 2: "init proceeds with --yes despite conflicts"
  Setup: tempDir with docs/README.md
  Run: aitri init --non-interactive --yes
  Assert: exit 0, specs/drafts created, docs/README.md still exists

Test 3: "init detects project type from package.json"
  Setup: tempDir with package.json
  Run: aitri init --non-interactive --yes
  Assert: docs/project.json contains detectedStack: ["node"]

Test 4: "init does not overwrite existing project.json in non-interactive"
  Setup: tempDir with docs/project.json (name: "original")
  Run: aitri init --non-interactive --yes
  Assert: docs/project.json still has name "original"
  Rationale: Even with --yes, overwriting metadata requires explicit intent.
             New behavior: if project.json exists, init skips writing it.

Test 5: "scaffold --dry-run shows plan without writing files"
  Setup: tempDir with full pipeline through go
  Run: aitri scaffold --feature <name> --dry-run --non-interactive --yes
  Assert: exit 0, stdout matches /DRY RUN/, no test stubs created

Test 6: "scaffold warns about existing src/ content"
  Setup: tempDir with full pipeline through go + src/services/existing.js
  Run: aitri scaffold --feature <name> --non-interactive --yes
  Assert: exit 0, stdout matches /existing directories/, src/services/existing.js still exists
```

### Phase K Tests: `tests/regression/retroactive-upgrade.test.mjs`

```
Test 1: "doctor detects missing Requirement Source Statement"
  Setup: tempDir with approved spec missing ## 10 section
  Run: aitri doctor --json
  Assert: payload.ok === false, checks find REQ-SOURCE-STATEMENT failure

Test 2: "doctor passes when project is up-to-date"
  Setup: tempDir with complete, current-format spec
  Run: aitri doctor --json
  Assert: payload.ok === true

Test 3: "upgrade adds missing Requirement Source Statement"
  Setup: tempDir with approved spec missing ## 10 section
  Run: aitri upgrade --non-interactive --yes
  Assert: spec now contains "## 10. Requirement Source Statement"
  Assert: original FR/AC content unchanged

Test 4: "upgrade creates project.json when missing"
  Setup: tempDir with init structure but no docs/project.json
  Run: aitri upgrade --non-interactive --yes
  Assert: docs/project.json exists with aitriVersion field

Test 5: "upgrade is idempotent"
  Setup: tempDir with already-upgraded project
  Run: aitri upgrade --non-interactive --yes (twice)
  Assert: second run reports "0 migrations applied"

Test 6: "upgrade never modifies user-provided requirement content"
  Setup: tempDir with approved spec with custom FR/AC content
  Run: aitri upgrade --non-interactive --yes
  Assert: all FR-*, AC-*, ## 3, ## 9 content is byte-identical before and after
```

---

## 8. File Budget Allocations

Add to `docs/quality/file-size-budgets.json`:

```json
{ "path": "cli/commands/features.js", "soft": 200, "hard": 300 },
{ "path": "cli/commands/amend.js", "soft": 250, "hard": 350 },
{ "path": "cli/commands/feedback.js", "soft": 200, "hard": 300 },
{ "path": "cli/commands/doctor.js", "soft": 300, "hard": 400 },
{ "path": "cli/commands/upgrade.js", "soft": 280, "hard": 380 },
{ "path": "tests/regression/iteration-lifecycle.test.mjs", "soft": 350, "hard": 500 },
{ "path": "tests/regression/brownfield-safety.test.mjs", "soft": 350, "hard": 500 },
{ "path": "tests/regression/retroactive-upgrade.test.mjs", "soft": 300, "hard": 450 }
```

---

## 9. Implementation Order

```
Phase J.1  (no dependencies — start here)
  cli/commands/init.js modifications
  tests/regression/brownfield-safety.test.mjs (tests 1-4)
    ↓
Phase J.2  (depends on J.1)
  cli/commands/scaffold.js modifications
  tests/regression/brownfield-safety.test.mjs (tests 5-6)
    ↓
Phase K.1  (no dependency on J, can parallel with J.2)
  core/compatibility.json
  cli/commands/doctor.js
  tests/regression/retroactive-upgrade.test.mjs (tests 1-2)
    ↓
Phase K.2  (depends on K.1)
  cli/commands/upgrade.js
  tests/regression/retroactive-upgrade.test.mjs (tests 3-6)
    ↓
Phase I.1  (depends on Phase H complete — features/next need full pipeline)
  cli/commands/features.js
  cli/index.js routing
  tests/regression/iteration-lifecycle.test.mjs (tests 1-3)
    ↓
Phase I.2  (depends on I.1)
  cli/commands/amend.js
  cli/config.js path additions (versions, stale)
  cli/commands/status.js amendments
  cli/commands/discovery-plan-validate.js stale check
  tests/regression/iteration-lifecycle.test.mjs (tests 4-5)
    ↓
Phase I.3  (depends on I.2)
  cli/commands/feedback.js
  cli/commands/post-delivery.js integration
  tests/regression/iteration-lifecycle.test.mjs (tests 6-7)
    ↓
Phase K.3  (depends on K.2 + at least one release cycle)
  Maintain core/compatibility.json per release
```

**Recommended execution batches:**

| Batch | Phases | New files | Modified files | Tests |
|---|---|---|---|---|
| 1 | J.1 + K.1 | doctor.js, compatibility.json | init.js, config.js | brownfield 1-4, upgrade 1-2 |
| 2 | J.2 + K.2 | upgrade.js | scaffold.js | brownfield 5-6, upgrade 3-6 |
| 3 | I.1 | features.js | index.js, status.js | iteration 1-3 |
| 4 | I.2 | amend.js | config.js, status.js, discovery-plan-validate.js | iteration 4-5 |
| 5 | I.3 | feedback.js | post-delivery.js, index.js | iteration 6-7 |

---

## 10. Acceptance Criteria Matrix

| ID | Phase | Criterion | Verification |
|---|---|---|---|
| AC-I1 | I.1 | `aitri features --json` returns all features with correct state | Test 1 |
| AC-I2 | I.1 | `aitri next` suggests correct feature based on queue or discovery | Tests 2-3 |
| AC-I3 | I.2 | `aitri amend` archives spec, creates draft, marks stale | Test 4 |
| AC-I4 | I.2 | `aitri validate` fails when stale marker exists | Test 5 |
| AC-I5 | I.3 | `aitri feedback` stores structured entries with auto-incrementing ID | Tests 6-7 |
| AC-J1 | J.1 | `aitri init` warns when target dirs contain non-Aitri content | Test J-1 |
| AC-J2 | J.1 | `aitri init` detects project type and stores in project.json | Test J-3 |
| AC-J3 | J.1 | `aitri init` does not overwrite existing project.json | Test J-4 |
| AC-J4 | J.2 | `aitri scaffold --dry-run` previews without writing | Test J-5 |
| AC-J5 | J.2 | `aitri scaffold` warns about existing src/ content | Test J-6 |
| AC-K1 | K.1 | `aitri doctor --json` identifies all version gaps | Tests K-1, K-2 |
| AC-K2 | K.2 | `aitri upgrade` adds missing structure without modifying requirements | Tests K-3, K-6 |
| AC-K3 | K.2 | `aitri upgrade` is idempotent | Test K-5 |
| AC-K4 | K.3 | `core/compatibility.json` maintained per release | Manual review |

---

## Appendix: New Commands Summary

| Command | Type | File | Modifies files? | Needs --yes? |
|---|---|---|---|---|
| `aitri features` | read | features.js | No | No |
| `aitri next` | read + optional advance | features.js | No (only suggests) | No |
| `aitri amend --feature <name>` | write | amend.js | Yes | Yes |
| `aitri feedback --feature <name>` | write | feedback.js | Yes | Yes |
| `aitri doctor` | read | doctor.js | No | No |
| `aitri upgrade` | write | upgrade.js | Yes | Yes |
| `aitri scaffold --dry-run` | read | scaffold.js | No | No |
