import fs from "node:fs";
import path from "node:path";
import { scanAllFeatures } from "./features.js";

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function openFeedbackCount(feedbackFile) {
  const data = readJsonSafe(feedbackFile);
  if (!data?.entries) return 0;
  return data.entries.filter((e) => e.resolution === null).length;
}

function specVersion(changelogFile) {
  const data = readJsonSafe(changelogFile);
  return data?.currentVersion ? `v${data.currentVersion}` : "v1";
}

function lastDeliveredAt(deliveryFile) {
  const data = readJsonSafe(deliveryFile);
  return data?.decision === "SHIP" ? (data.deliveredAt || null) : null;
}

export function runRoadmapCommand({ options, getProjectContextOrExit, exitCodes }) {
  const { OK } = exitCodes;
  const project = getProjectContextOrExit();
  const paths = project.paths;

  const features = scanAllFeatures(paths);
  const jsonOutput = options.json || (options.format || "").toLowerCase() === "json"
    || options.positional.some((p) => p.toLowerCase() === "json");

  const enriched = features.map((f) => {
    const feedbackFile = paths.feedbackFile(f.name);
    const changelogFile = paths.specChangelogFile(f.name);
    const deliveryFile = paths.deliveryJsonFile(f.name);
    return {
      name: f.name,
      state: f.state,
      specVersion: specVersion(changelogFile),
      openFeedback: openFeedbackCount(feedbackFile),
      lastDeliveredAt: lastDeliveredAt(deliveryFile),
      nextStep: f.nextStep
    };
  });

  const summary = {
    total: enriched.length,
    delivered: enriched.filter((f) => f.state === "delivered").length,
    inProgress: enriched.filter((f) => !["delivered", "draft"].includes(f.state)).length,
    draft: enriched.filter((f) => f.state === "draft").length,
    openFeedback: enriched.reduce((sum, f) => sum + f.openFeedback, 0)
  };

  // Persist roadmap snapshot
  const roadmapFile = path.join(paths.docsRoot, "roadmap.json");
  try {
    fs.mkdirSync(paths.docsRoot, { recursive: true });
    fs.writeFileSync(roadmapFile, JSON.stringify({ updatedAt: new Date().toISOString(), summary, features: enriched }, null, 2) + "\n", "utf8");
  } catch { /* non-critical */ }

  if (jsonOutput) {
    console.log(JSON.stringify({ ok: true, summary, features: enriched }, null, 2));
    return OK;
  }

  if (enriched.length === 0) {
    console.log("No features found. Run `aitri draft` to start.");
    return OK;
  }

  const projectName = (() => {
    try { return readJsonSafe(path.join(paths.docsRoot, "project.json"))?.name || ""; } catch { return ""; }
  })();
  console.log(`\nProduct Roadmap${projectName ? ` — ${projectName}` : ""}`);

  const nameW = Math.max(20, ...enriched.map((f) => f.name.length + 2));
  const stateW = 16;
  const verW = 8;
  const fbW = 12;
  console.log("─".repeat(nameW + stateW + verW + fbW + 36));
  console.log(
    "  " + "Feature".padEnd(nameW) + "State".padEnd(stateW) +
    "Version".padEnd(verW) + "Feedback".padEnd(fbW) + "Next Step"
  );
  console.log("─".repeat(nameW + stateW + verW + fbW + 36));

  for (const f of enriched) {
    const fb = f.openFeedback > 0 ? `${f.openFeedback} open` : "—";
    const next = f.nextStep || "(complete)";
    console.log(
      "  " + f.name.padEnd(nameW) + f.state.padEnd(stateW) +
      f.specVersion.padEnd(verW) + fb.padEnd(fbW) + next
    );
  }
  console.log("─".repeat(nameW + stateW + verW + fbW + 36));

  const parts = [];
  if (summary.delivered > 0) parts.push(`${summary.delivered} delivered`);
  if (summary.inProgress > 0) parts.push(`${summary.inProgress} in progress`);
  if (summary.draft > 0) parts.push(`${summary.draft} draft`);
  if (summary.openFeedback > 0) parts.push(`${summary.openFeedback} open feedback`);
  console.log(`\nTotal: ${summary.total} feature(s) · ${parts.join(" · ")}`);
  if (summary.openFeedback > 0) console.log(`Tip: run \`aitri triage --feature <name>\` to process open feedback.`);
  console.log("");

  return OK;
}
