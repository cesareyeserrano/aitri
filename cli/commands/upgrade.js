import fs from "node:fs";
import path from "node:path";

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function readCurrentVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(
      new URL("../../package.json", import.meta.url), "utf8"
    ));
    return pkg.version || null;
  } catch { return null; }
}

function globMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

/**
 * Simple semver comparison. Returns true if version `a` is strictly less than `b`.
 * Handles "0.4.0" < "0.5.0" format. Treats null/undefined as "0.0.0".
 */
function semverLt(a, b) {
  const parse = (v) => String(v || "0.0.0").split(".").map(Number);
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) return aMaj < bMaj;
  if (aMin !== bMin) return aMin < bMin;
  return aPatch < bPatch;
}

function readProjectProfile(docsRoot) {
  return readJsonSafe(path.join(docsRoot, "project.json")) || {};
}

function readProjectVersion(docsRoot) {
  return readProjectProfile(docsRoot).aitriVersion || null;
}

function readAppliedMigrations(docsRoot) {
  return readProjectProfile(docsRoot).migrationsApplied || [];
}

function stampProjectVersion(docsRoot, aitriVersion, newlyApplied) {
  const file = path.join(docsRoot, "project.json");
  const data = readJsonSafe(file) || {
    name: path.basename(path.dirname(docsRoot)),
    initializedAt: new Date().toISOString()
  };
  const previous = data.migrationsApplied || [];
  data.aitriVersion = aitriVersion;
  data.migrationsApplied = [...new Set([...previous, ...newlyApplied])];
  data.lastUpgradedAt = new Date().toISOString();
  writeJsonFile(file, data);
}

// ---------------------------------------------------------------------------
// MIGRATIONS
// Each entry:
//   id           — unique string identifier
//   description  — human-readable one-liner
//   sinceVersion — the Aitri version that introduced this migration
//                  Only runs on projects whose aitriVersion < sinceVersion
//   applies(ctx) — returns array of targets (strings); empty array = skip
//   apply(target, ctx) — executes the migration; returns false if no-op
// ---------------------------------------------------------------------------

const MIGRATIONS = [
  {
    id: "ADD-REQ-SOURCE-STATEMENT",
    description: "Add Requirement Source Statement section to approved specs",
    // No sinceVersion: runs based on content detection only, regardless of project version
    applies(ctx) {
      return globMd(ctx.paths.specsApprovedDir).filter((f) => {
        const content = fs.readFileSync(f, "utf8");
        return !content.includes("## 10. Requirement Source Statement");
      });
    },
    apply(file) {
      const content = fs.readFileSync(file, "utf8");
      if (content.includes("## 10. Requirement Source Statement")) return false;
      const updated = content.trimEnd() +
        "\n\n## 10. Requirement Source Statement\n" +
        "- Requirements in this spec were provided by the user.\n" +
        "- Retroactively added by aitri upgrade.\n";
      fs.writeFileSync(file, updated, "utf8");
      return true;
    }
  },
  {
    id: "CREATE-PROJECT-PROFILE",
    description: "Create or update docs/project.json with aitriVersion",
    // No sinceVersion: runs based on content detection only
    applies(ctx) {
      const file = path.join(ctx.paths.docsRoot, "project.json");
      if (!fs.existsSync(file)) return ["(create)"];
      const data = readJsonSafe(file);
      if (!data?.aitriVersion) return [file];
      return [];
    },
    apply(target, ctx) {
      const aitriVersion = readCurrentVersion();
      const file = path.join(ctx.paths.docsRoot, "project.json");
      if (target !== null && fs.existsSync(file)) {
        const data = readJsonSafe(file) || {};
        if (data.aitriVersion) return false;
        data.aitriVersion = aitriVersion;
        writeJsonFile(file, data);
        return true;
      }
      writeJsonFile(file, {
        name: path.basename(ctx.root) || "aitri-project",
        initializedAt: new Date().toISOString(),
        root: path.basename(ctx.root),
        aitriVersion
      });
      return true;
    }
  },
  {
    id: "NOTIFY-NEW-COMMANDS-0.5.0",
    description: "Document new v0.5.0 commands and aitri adopt preview in docs/UPGRADE-NOTES-v0.5.0.md",
    sinceVersion: "0.5.0",
    // Atomic: writes the complete notes file in one pass (no follow-on migration needed)
    applies(ctx) {
      const notesFile = path.join(ctx.paths.docsRoot, "UPGRADE-NOTES-v0.5.0.md");
      if (fs.existsSync(notesFile)) return [];
      return ["(create)"];
    },
    apply(_, ctx) {
      const notesFile = path.join(ctx.paths.docsRoot, "UPGRADE-NOTES-v0.5.0.md");
      if (fs.existsSync(notesFile)) return false;
      const content = [
        "# Aitri v0.5.0 Upgrade Notes",
        "",
        "This project was upgraded from an earlier version of Aitri.",
        "The following new features are now available:",
        "",
        "## New Commands",
        "",
        "### `aitri diff --feature <name> --proposed <file>`",
        "Compare your current backlog against a proposed update before accepting it.",
        "Shows added, modified, removed, and unchanged User Stories.",
        "",
        "### `aitri verify-intent --feature <name>`",
        "LLM-powered semantic validation: confirms each User Story satisfies the intent",
        "of its traced Functional Requirements. Requires `ai` config in `aitri.config.json`.",
        "",
        "### `aitri spec-improve --feature <name>`",
        "AI-powered spec quality review: identifies ambiguous FRs, missing edge cases,",
        "and non-testable Acceptance Criteria. Requires `ai` config.",
        "",
        "### `aitri checkpoint [message]`",
        "Save session state to `.aitri/DEV_STATE.md` for zero context-loss between",
        "agent sessions (Relay Protocol). Use `aitri checkpoint show` to read state.",
        "",
        "## Auditor Mode (aitri plan)",
        "",
        "```bash",
        "aitri plan --feature <name> --ai-backlog <file> --ai-tests <file>",
        "```",
        "",
        "Instead of Aitri inferring backlog/tests from heuristics, your AI agent generates",
        "them and Aitri validates traceability (FR/AC/US references) before writing.",
        "Requires both `--ai-backlog` and `--ai-tests` file paths.",
        "",
        "## Scaffold Improvement",
        "",
        "Test stubs generated by `aitri scaffold` now automatically include the import",
        "statement for the relevant contract file when the TC has FR-* in its Trace line.",
        "",
        "## To Enable AI Features",
        "",
        "Add an `ai` section to your `aitri.config.json`:",
        "",
        "```json",
        "{",
        '  "ai": {',
        '    "provider": "claude",',
        '    "model": "claude-opus-4-6",',
        '    "apiKeyEnv": "ANTHROPIC_API_KEY"',
        "  }",
        "}",
        "```",
        "",
        "See `docs/guides/AGENT_INTEGRATION_GUIDE.md` for the full agent workflow.",
        "",
        "## Coming Soon: `aitri adopt`",
        "",
        "Onboard any existing project (not created by Aitri) into the spec-driven workflow.",
        "Scans your project structure, detects tech stack, and generates DRAFT specs",
        "from your existing README and code. Source files are never modified.",
        "",
        "```bash",
        "aitri adopt --dry-run          # preview what would be found",
        "aitri adopt --depth standard   # scan + generate DRAFT specs (requires ai config)",
        "```",
        ""
      ].join("\n");
      fs.mkdirSync(path.dirname(notesFile), { recursive: true });
      fs.writeFileSync(notesFile, content, "utf8");
      return true;
    }
  }
];

export async function runUpgradeCommand({
  options,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const project = getProjectContextOrExit();
  const root = process.cwd();
  const aitriVersion = readCurrentVersion();
  const ctx = { paths: project.paths, root };

  const projectVersion = readProjectVersion(project.paths.docsRoot);
  const appliedMigrations = readAppliedMigrations(project.paths.docsRoot);

  // Gather applicable migrations:
  // - sinceVersion > projectVersion (new since last upgrade)
  // - not already applied (idempotent guard)
  const plan = [];
  for (const migration of MIGRATIONS) {
    // Skip if already applied
    if (appliedMigrations.includes(migration.id)) continue;
    // Skip if project is already at or above the migration's target version
    if (migration.sinceVersion && !semverLt(projectVersion, migration.sinceVersion)) continue;

    const targets = migration.applies(ctx);
    for (const target of targets) {
      const relTarget = target.startsWith("(")
        ? target
        : path.relative(root, target);
      plan.push({ migration, target, relTarget });
    }
  }

  const versionLine = projectVersion
    ? `Project version: ${projectVersion}  →  Aitri: ${aitriVersion || "(unknown)"}`
    : `Aitri version: ${aitriVersion || "(unknown)"}`;

  console.log(`Aitri Upgrade — Version-Aware Migration`);
  console.log(versionLine);
  console.log("");

  if (plan.length === 0) {
    console.log("0 migrations needed. Project is already up-to-date.");
    return OK;
  }

  console.log("PLAN:");
  plan.forEach(({ migration, relTarget }) => {
    const since = migration.sinceVersion ? ` [v${migration.sinceVersion}]` : "";
    console.log(`- ${migration.description}${since}: ${relTarget}`);
  });
  console.log("");

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    return ERROR;
  }
  if (!proceed) {
    console.log("Aborted.");
    return ABORTED;
  }

  const newlyApplied = [];
  for (const { migration, target } of plan) {
    const changed = migration.apply(target.startsWith("(") ? null : target, ctx);
    if (changed !== false) {
      console.log(`  [OK] ${migration.id}`);
      newlyApplied.push(migration.id);
    }
  }

  // Stamp the project with the current Aitri version and migration log
  if (newlyApplied.length > 0) {
    stampProjectVersion(project.paths.docsRoot, aitriVersion, newlyApplied);
  }

  console.log("");
  console.log(`Applied ${newlyApplied.length} migration${newlyApplied.length !== 1 ? "s" : ""}.`);
  if (aitriVersion) {
    console.log(`Project stamped as Aitri v${aitriVersion}.`);
  }

  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "upgrade",
    feature: "project"
  }));

  return OK;
}
