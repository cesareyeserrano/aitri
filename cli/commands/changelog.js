import fs from "node:fs";
import path from "node:path";
import { scanAllFeatures } from "./features.js";

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function bumpVersion(current, type) {
  const [maj, min, pat] = String(current || "0.0.0").split(".").map(Number);
  if (type === "major") return `${maj + 1}.0.0`;
  if (type === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${(pat || 0) + 1}`;
}

function detectBumpType(feature, paths) {
  // major if spec was amended with FR changes (check changelog versions > 1 and delivery v2+)
  const changelog = readJsonSafe(paths.specChangelogFile(feature));
  if (changelog?.currentVersion > 2) return "major";
  const delivery = readJsonSafe(paths.deliveryJsonFile(feature));
  // patch if all feedback resolved are bug/ux fixes
  const fb = readJsonSafe(paths.feedbackFile(feature));
  const resolved = (fb?.entries || []).filter((e) => e.resolution && e.resolution !== "wont-fix");
  if (resolved.length > 0 && resolved.every((e) => ["bug", "ux"].includes(e.category))) return "patch";
  return "minor";
}

function formatDate(iso) {
  if (!iso) return "unknown";
  return iso.slice(0, 10);
}

function buildChangelogEntries(features, paths) {
  const entries = [];

  for (const f of features) {
    if (f.state !== "delivered") continue;
    const delivery = readJsonSafe(paths.deliveryJsonFile(f.name));
    if (!delivery || delivery.decision !== "SHIP") continue;

    const fb = readJsonSafe(paths.feedbackFile(f.name));
    const resolvedFeedback = (fb?.entries || []).filter(
      (e) => e.resolution && e.resolution !== "deferred" && e.resolution !== "wont-fix"
    );

    const changelog = readJsonSafe(paths.specChangelogFile(f.name));
    const specVer = changelog?.currentVersion || 1;

    entries.push({
      feature: f.name,
      deliveredAt: delivery.deliveredAt || null,
      specVersion: specVer,
      bumpType: detectBumpType(f.name, paths),
      added: [`${f.name}: delivered (spec v${specVer})`],
      fixed: resolvedFeedback.map((e) => `${f.name}: ${e.description} (${e.id})`),
      releaseTag: delivery.releaseTag || null
    });
  }

  // Sort by deliveredAt descending
  entries.sort((a, b) => {
    if (!a.deliveredAt) return 1;
    if (!b.deliveredAt) return -1;
    return b.deliveredAt.localeCompare(a.deliveredAt);
  });

  return entries;
}

export function runChangelogCommand({ options, getProjectContextOrExit, exitCodes }) {
  const { OK, ERROR } = exitCodes;
  const project = getProjectContextOrExit();
  const paths = project.paths;

  const features = scanAllFeatures(paths);
  const entries = buildChangelogEntries(features, paths);

  const jsonOutput = options.json || (options.format || "").toLowerCase() === "json"
    || options.positional.some((p) => p.toLowerCase() === "json");

  if (entries.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ ok: true, entries: [], message: "No delivered features found." }, null, 2));
    } else {
      console.log("No delivered features found. Run `aitri deliver` to complete a feature.");
    }
    return OK;
  }

  // Compute running semver
  let version = "0.0.0";
  const versioned = entries.map((e) => {
    version = bumpVersion(version, e.bumpType);
    return { ...e, version };
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, currentVersion: version, entries: versioned }, null, 2));
    return OK;
  }

  // Write CHANGELOG.md
  const changelogPath = path.join(paths.root || process.cwd(), "CHANGELOG.md");
  let md = "# Changelog\n\n";
  for (const e of versioned) {
    md += `## ${e.version} — ${formatDate(e.deliveredAt)}\n`;
    if (e.releaseTag) md += `_Tag: ${e.releaseTag}_\n`;
    if (e.added.length > 0) {
      md += "### Added\n";
      e.added.forEach((line) => { md += `- ${line}\n`; });
    }
    if (e.fixed.length > 0) {
      md += "### Fixed\n";
      e.fixed.forEach((line) => { md += `- ${line}\n`; });
    }
    md += "\n";
  }

  const write = options.write !== false;
  if (write) {
    try {
      fs.writeFileSync(changelogPath, md, "utf8");
      console.log(`CHANGELOG.md written → ${path.relative(process.cwd(), changelogPath)}`);
      console.log(`Current version: ${version}`);
    } catch (err) {
      console.log(`Error writing CHANGELOG.md: ${err.message}`);
      return ERROR;
    }
  } else {
    process.stdout.write(md);
  }

  return OK;
}
