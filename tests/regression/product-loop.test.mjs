import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

function writeSpec(tempDir, dir, feature) {
  fs.mkdirSync(path.join(tempDir, "specs", dir), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "specs", dir, `${feature}.md`),
    `# AF-SPEC: ${feature}\nSTATUS: APPROVED\n\n## 3. Functional Rules (traceable)\n- FR-1: Core rule.\n\n## 10. Requirement Source Statement\n- User provided.\n`,
    "utf8"
  );
}

function writeFeedback(tempDir, feature, entries) {
  fs.mkdirSync(path.join(tempDir, "docs", "feedback"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "feedback", `${feature}.json`),
    JSON.stringify({ feature, entries }, null, 2),
    "utf8"
  );
}

function writeDelivery(tempDir, feature) {
  fs.mkdirSync(path.join(tempDir, "docs", "delivery"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "docs", "delivery", `${feature}.json`),
    JSON.stringify({ feature, decision: "SHIP", deliveredAt: new Date().toISOString() }, null, 2),
    "utf8"
  );
}

// ── L.1: Enhanced feedback ────────────────────────────────────────────────────

test("feedback --source and --ref are stored in entry", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-feedback-source-"));
  const feature = "src-feature";
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", feature);

  const result = runNodeOk([
    "feedback", "--feature", feature,
    "--note", "Users cannot find the export button",
    "--source", "user-testing",
    "--ref", "FR-1",
    "--non-interactive", "--yes"
  ], { cwd: tempDir });
  assert.match(result.stdout, /Feedback recorded: FB-1/);

  const fbFile = path.join(tempDir, "docs", "feedback", `${feature}.json`);
  const data = JSON.parse(fs.readFileSync(fbFile, "utf8"));
  assert.equal(data.entries[0].source, "user-testing");
  assert.equal(data.entries[0].linkedRef, "FR-1");
});

test("feedback defaults source to internal when --source not provided", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-feedback-default-src-"));
  const feature = "default-src";
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", feature);

  runNodeOk([
    "feedback", "--feature", feature, "--note", "Minor improvement",
    "--non-interactive", "--yes"
  ], { cwd: tempDir });

  const data = JSON.parse(fs.readFileSync(
    path.join(tempDir, "docs", "feedback", `${feature}.json`), "utf8"
  ));
  assert.equal(data.entries[0].source, "internal");
  assert.equal(data.entries[0].linkedRef, null);
});

// ── L.2: Triage ───────────────────────────────────────────────────────────────

test("triage non-interactive json lists open feedback entries", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-triage-list-"));
  const feature = "triage-feature";
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", feature);

  writeFeedback(tempDir, feature, [
    { id: "FB-1", source: "user-testing", linkedRef: "FR-1", category: "bug", severity: "high", description: "Export fails", resolution: null, resolvedAt: null },
    { id: "FB-2", source: "support", linkedRef: null, category: "ux", severity: "medium", description: "Button hard to find", resolution: null, resolvedAt: null }
  ]);

  const result = runNode(["triage", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.equal(payload.pending.length, 2);
  assert.equal(payload.pending[0].id, "FB-1");
  assert.equal(payload.pending[0].source, "user-testing");
  assert.equal(payload.pending[0].linkedRef, "FR-1");
});

test("triage fails when no feedback file exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-triage-missing-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const result = runNode(["triage", "--feature", "ghost-feature", "--non-interactive", "--json"], { cwd: tempDir });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /No feedback file found/);
});

test("triage non-interactive shows empty message when all entries resolved", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-triage-empty-"));
  const feature = "all-resolved";
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", feature);

  writeFeedback(tempDir, feature, [
    { id: "FB-1", source: "internal", linkedRef: null, category: "bug", severity: "low", description: "Fixed", resolution: "wont-fix", resolvedAt: new Date().toISOString() }
  ]);

  const result = runNode(["triage", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.match(payload.message, /No open feedback/);
});

// ── L.3: Roadmap ──────────────────────────────────────────────────────────────

test("roadmap json lists all features with openFeedback and specVersion", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-roadmap-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", "payment-api");
  writeSpec(tempDir, "approved", "user-auth");
  writeDelivery(tempDir, "user-auth");
  writeFeedback(tempDir, "payment-api", [
    { id: "FB-1", source: "user-testing", linkedRef: null, category: "bug", severity: "high", description: "Crash on submit", resolution: null, resolvedAt: null }
  ]);

  const result = runNode(["roadmap", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(payload.features.length >= 2);

  const pmtApi = payload.features.find((f) => f.name === "payment-api");
  assert.ok(pmtApi, "payment-api should be in roadmap");
  assert.equal(pmtApi.openFeedback, 1);
  assert.equal(pmtApi.specVersion, "v1");

  const userAuth = payload.features.find((f) => f.name === "user-auth");
  assert.ok(userAuth, "user-auth should be in roadmap");
  assert.equal(userAuth.state, "delivered");
  assert.equal(userAuth.openFeedback, 0);
});

test("roadmap writes docs/roadmap.json snapshot", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-roadmap-snapshot-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", "api-feature");

  runNode(["roadmap", "--non-interactive"], { cwd: tempDir });

  const snapshotFile = path.join(tempDir, "docs", "roadmap.json");
  assert.ok(fs.existsSync(snapshotFile), "roadmap.json should be written");
  const data = JSON.parse(fs.readFileSync(snapshotFile, "utf8"));
  assert.ok(data.updatedAt);
  assert.ok(data.summary.total >= 1);
});

// ── L.4: Changelog ────────────────────────────────────────────────────────────

test("changelog generates CHANGELOG.md for delivered feature", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-changelog-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", "billing-api");
  writeDelivery(tempDir, "billing-api");

  const result = runNode(["changelog", "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 0);

  const changelogFile = path.join(tempDir, "CHANGELOG.md");
  assert.ok(fs.existsSync(changelogFile), "CHANGELOG.md should exist");
  const content = fs.readFileSync(changelogFile, "utf8");
  assert.match(content, /# Changelog/);
  assert.match(content, /billing-api/);
  assert.match(content, /## Added/);
});

test("changelog json output includes currentVersion and entries", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-changelog-json-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  writeSpec(tempDir, "approved", "search-api");
  writeDelivery(tempDir, "search-api");

  const result = runNode(["changelog", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);
  assert.ok(payload.currentVersion);
  assert.ok(payload.entries.length >= 1);
  assert.equal(payload.entries[0].feature, "search-api");
  assert.ok(payload.entries[0].version);
});

test("changelog includes resolved feedback as fixed entries", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-changelog-fixes-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "notifications";
  writeSpec(tempDir, "approved", feature);
  writeDelivery(tempDir, feature);
  writeFeedback(tempDir, feature, [
    { id: "FB-1", source: "user-testing", linkedRef: "FR-1", category: "bug", severity: "high", description: "Notifications not sent", resolution: "fixed", resolvedAt: new Date().toISOString() }
  ]);

  const result = runNode(["changelog", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);
  const payload = JSON.parse(result.stdout);
  const entry = payload.entries.find((e) => e.feature === feature);
  assert.ok(entry, "notifications entry should exist");
  assert.ok(entry.fixed.length >= 1, "should have fixed entries from feedback");
  assert.match(entry.fixed[0], /FB-1/);
});
