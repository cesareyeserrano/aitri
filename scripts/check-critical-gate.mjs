import fs from "node:fs";
import { spawnSync } from "node:child_process";

const GATE_FILE = "docs/quality/STABILIZATION_RELEASE_GATE_2026-02-16.md";
const REMEDIATION_ALLOWLIST = [
  /^docs\/quality\/STABILIZATION_RELEASE_GATE_2026-02-16\.md$/,
  /^docs\/feedback\/AUDITORIA_E2E_2026-02-16\.md$/,
  /^docs\/PROGRESS_CHECKLIST\.md$/,
  /^docs\/STRATEGY_EXECUTION\.md$/,
  /^backlog\/aitri-core\/backlog\.md$/
];

function runGit(args) {
  const run = spawnSync("git", args, {
    encoding: "utf8"
  });
  return {
    ok: run.status === 0,
    stdout: String(run.stdout || "").trim(),
    stderr: String(run.stderr || "").trim()
  };
}

function parseGateStatus(content) {
  const match = String(content).match(/^\s*-\s*Critical Gate:\s*([^\n]+)$/m);
  if (!match) return { found: false, raw: null, open: false };
  const raw = match[1].trim();
  return {
    found: true,
    raw,
    open: /\bopen\b/i.test(raw)
  };
}

function listChangedFiles() {
  const event = String(process.env.GITHUB_EVENT_NAME || "").trim();
  const baseRef = String(process.env.GITHUB_BASE_REF || "").trim();

  if (event === "pull_request" && baseRef) {
    runGit(["fetch", "--no-tags", "--depth=1", "origin", baseRef]);
    const diff = runGit(["diff", "--name-only", `origin/${baseRef}...HEAD`]);
    if (diff.ok) {
      return diff.stdout
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    }
  }

  const pushDiff = runGit(["diff", "--name-only", "HEAD~1..HEAD"]);
  if (pushDiff.ok) {
    return pushDiff.stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

if (!fs.existsSync(GATE_FILE)) {
  console.log(`Critical gate check: skip (missing ${GATE_FILE}).`);
  process.exit(0);
}

const gate = parseGateStatus(fs.readFileSync(GATE_FILE, "utf8"));
if (!gate.found) {
  console.log("Critical gate check: skip (no 'Critical Gate' status found).");
  process.exit(0);
}

if (!gate.open) {
  console.log(`Critical gate check: PASS (${gate.raw}).`);
  process.exit(0);
}

const changed = listChangedFiles();
if (changed.length === 0) {
  console.log("Critical gate is OPEN and no changed files were detected; failing safe.");
  process.exit(1);
}

const outsideAllowlist = changed.filter((file) => (
  !REMEDIATION_ALLOWLIST.some((rule) => rule.test(file))
));

if (outsideAllowlist.length > 0) {
  console.log("Critical gate is OPEN. Only remediation-tracking changes are allowed.");
  console.log("Disallowed changed files:");
  outsideAllowlist.forEach((file) => console.log(`- ${file}`));
  process.exit(1);
}

console.log("Critical gate is OPEN, but all changes are remediation-tracking files. PASS.");
