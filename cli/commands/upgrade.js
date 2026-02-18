import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
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

const MIGRATIONS = [
  {
    id: "ADD-REQ-SOURCE-STATEMENT",
    description: "Add Requirement Source Statement section to approved specs",
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
    applies(ctx) {
      const file = path.join(ctx.paths.docsRoot, "project.json");
      if (!fs.existsSync(file)) return ["(create)"];
      const data = readJsonSafe(file);
      if (!data?.aitriVersion) return [file];
      return [];
    },
    apply(_, ctx) {
      const aitriVersion = readCurrentVersion();
      const file = path.join(ctx.paths.docsRoot, "project.json");
      if (fs.existsSync(file)) {
        const data = readJsonSafe(file) || {};
        if (data.aitriVersion) return false;
        data.aitriVersion = aitriVersion;
        fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
        return true;
      }
      fs.mkdirSync(ctx.paths.docsRoot, { recursive: true });
      const data = {
        name: path.basename(ctx.root) || "aitri-project",
        initializedAt: new Date().toISOString(),
        root: path.basename(ctx.root),
        aitriVersion
      };
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
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

  // Gather applicable migrations and their targets
  const plan = [];
  for (const migration of MIGRATIONS) {
    const targets = migration.applies(ctx);
    for (const target of targets) {
      const relTarget = target === "(create)"
        ? path.relative(root, path.join(project.paths.docsRoot, "project.json"))
        : path.relative(root, target);
      plan.push({ migration, target, relTarget });
    }
  }

  if (plan.length === 0) {
    console.log(`Aitri Upgrade — Retroactive Migration`);
    console.log(`Aitri version: ${aitriVersion || "(unknown)"}`);
    console.log("");
    console.log("0 migrations needed. Project is already up-to-date.");
    return OK;
  }

  console.log(`Aitri Upgrade — Retroactive Migration`);
  console.log(`Aitri version: ${aitriVersion || "(unknown)"}`);
  console.log("");
  console.log("PLAN:");
  plan.forEach(({ migration, relTarget }) => {
    console.log(`- ${migration.description.split(" ").slice(0, 4).join(" ")}: ${relTarget}`);
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

  let applied = 0;
  for (const { migration, target, relTarget } of plan) {
    const changed = migration.apply(target === "(create)" ? null : target, ctx);
    if (changed !== false) {
      console.log(`  [OK] ${migration.id} → ${relTarget}`);
      applied++;
    }
  }

  console.log("");
  console.log(`Applied ${applied} migration${applied !== 1 ? "s" : ""}.`);

  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "upgrade",
    feature: "project"
  }));

  return OK;
}
