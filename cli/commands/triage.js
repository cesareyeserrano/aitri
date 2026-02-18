import fs from "node:fs";
import path from "node:path";

const TRIAGE_DECISIONS = ["amend", "new-feature", "skip", "wont-fix"];

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function writeJsonSafe(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function loadFeedback(feedbackFile) {
  const data = readJsonSafe(feedbackFile);
  return data?.entries || [];
}

function openEntries(entries) {
  return entries.filter((e) => e.resolution === null);
}

function applyDecision(entry, decision, reason) {
  const now = new Date().toISOString();
  if (decision === "wont-fix") {
    entry.resolution = "wont-fix";
    entry.resolvedAt = now;
    entry.resolutionNote = reason || null;
  } else if (decision === "skip") {
    entry.resolution = "deferred";
    entry.resolvedAt = now;
  } else {
    // amend / new-feature: mark triaged but keep open until resolved downstream
    entry.triaged = decision;
    entry.triagedAt = now;
  }
}

export async function runTriageCommand({
  options,
  ask,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const project = getProjectContextOrExit();

  const feature = options.feature;
  if (!feature) {
    console.log("Feature name is required. Use --feature <name>.");
    return ERROR;
  }

  const feedbackFile = project.paths.feedbackFile(feature);
  if (!fs.existsSync(feedbackFile)) {
    console.log(`No feedback file found for: ${feature}`);
    console.log("Run `aitri feedback --feature <name>` to capture feedback first.");
    return ERROR;
  }

  const allEntries = loadFeedback(feedbackFile);
  const pending = openEntries(allEntries).filter((e) => !e.triaged);

  const jsonOutput = options.json || (options.format || "").toLowerCase() === "json";

  if (pending.length === 0) {
    if (jsonOutput) {
      console.log(JSON.stringify({ ok: true, feature, message: "No open feedback to triage.", triaged: [], pending: [] }, null, 2));
    } else {
      console.log(`No open feedback entries to triage for: ${feature}`);
    }
    return OK;
  }

  const triageFile = project.paths.triageFile(feature);
  const existing = readJsonSafe(triageFile) || { feature, triaged: [] };
  const triageLog = existing.triaged || [];
  const newAmends = [];
  const newDrafts = [];

  if (options.nonInteractive) {
    // Non-interactive: report pending + already triaged
    const payload = {
      ok: true,
      feature,
      pending: pending.map((e) => ({ id: e.id, category: e.category, severity: e.severity, description: e.description, source: e.source || "internal", linkedRef: e.linkedRef || null })),
      triaged: triageLog
    };
    if (jsonOutput) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Open feedback for ${feature} (${pending.length} items):\n`);
      for (const e of pending) {
        console.log(`  ${e.id} [${e.category}/${e.severity}] "${e.description}"`);
        if (e.linkedRef) console.log(`       linked: ${e.linkedRef}`);
      }
      console.log(`\nRun \`aitri triage --feature ${feature}\` to process interactively.`);
    }
    return OK;
  }

  // Interactive triage loop
  console.log(`\nAitri Triage — ${feature}`);
  console.log(`${pending.length} open feedback item(s) to review.\n`);

  for (const entry of pending) {
    console.log(`─────────────────────────────────────────`);
    console.log(`${entry.id}  [${entry.category}/${entry.severity}]  source: ${entry.source || "internal"}`);
    if (entry.linkedRef) console.log(`Linked: ${entry.linkedRef}`);
    console.log(`"${entry.description}"`);
    console.log(`\nDecision: [a] amend  [n] new-feature  [s] skip  [w] wont-fix`);

    const raw = await ask("> ");
    const key = raw.trim().toLowerCase();
    const decision = key === "a" ? "amend"
      : key === "n" ? "new-feature"
      : key === "w" ? "wont-fix"
      : "skip";

    let reason = null;
    if (decision === "wont-fix") {
      reason = await ask("Reason (optional): ");
      reason = reason.trim() || null;
    }

    applyDecision(entry, decision, reason);
    triageLog.push({ fbId: entry.id, decision, at: new Date().toISOString(), linkedRef: entry.linkedRef || null });

    if (decision === "amend") {
      newAmends.push(feature);
      console.log(`→ Marked for amend. Run: aitri amend --feature ${feature}`);
    } else if (decision === "new-feature") {
      newDrafts.push({ from: entry.id, description: entry.description });
      console.log(`→ Marked as new feature. Run: aitri draft to create a spec.`);
    } else if (decision === "wont-fix") {
      console.log(`→ Closed as won't fix.`);
    } else {
      console.log(`→ Deferred.`);
    }
  }

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    return ERROR;
  }
  if (!proceed) { console.log("Aborted."); return ABORTED; }

  // Write updated feedback
  const updated = { feature, entries: allEntries };
  writeJsonSafe(feedbackFile, updated);

  // Write triage log
  writeJsonSafe(triageFile, { feature, updatedAt: new Date().toISOString(), triaged: triageLog });

  console.log(`\nTriage complete. ${triageLog.length} decision(s) recorded.`);
  if (newAmends.length > 0) console.log(`Next: aitri amend --feature ${feature}`);
  if (newDrafts.length > 0) console.log(`Next: aitri draft (for ${newDrafts.length} new feature idea(s))`);

  writeJsonSafe(project.paths.triageFile(feature), { feature, updatedAt: new Date().toISOString(), triaged: triageLog, pendingActions: { amend: newAmends.length > 0, newDrafts } });

  printCheckpointSummary(runAutoCheckpoint({ enabled: options.autoCheckpoint, phase: "triage", feature }));
  return OK;
}
