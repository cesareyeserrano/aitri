import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

function setupAitriProject(tempDir) {
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
}

function setupPlanReadyProject(tempDir, feature) {
  setupAitriProject(tempDir);
  // Write a complete approved spec directly (bypass draft/approve for speed)
  const approvedDir = path.join(tempDir, "specs", "approved");
  fs.mkdirSync(approvedDir, { recursive: true });
  fs.writeFileSync(
    path.join(approvedDir, `${feature}.md`),
    [
      `# AF-SPEC: ${feature}`,
      "STATUS: APPROVED",
      "",
      "## 1. Context",
      "Authenticate users via email and password.",
      "",
      "## 2. Actors",
      "- User",
      "",
      "## 3. Functional Rules (traceable)",
      "- FR-1: The system must validate user credentials before granting access.",
      "- FR-2: The system must reject invalid login attempts with a clear error.",
      "",
      "## 4. Edge Cases",
      "- User enters wrong password 3 times in a row.",
      "",
      "## 7. Security Considerations",
      "- Sanitize all login inputs to prevent SQL injection.",
      "",
      "## 9. Acceptance Criteria",
      "- AC-1: Given valid credentials, when submitted, then access is granted.",
      "- AC-2: Given invalid credentials, when submitted, then an error message is shown.",
      ""
    ].join("\n"),
    "utf8"
  );
  // Write a minimal discovery file so plan can proceed
  const discoveryDir = path.join(tempDir, "docs", "discovery");
  fs.mkdirSync(discoveryDir, { recursive: true });
  fs.writeFileSync(
    path.join(discoveryDir, `${feature}.md`),
    [
      `# Discovery: ${feature}`,
      "",
      "## 2. Discovery Interview Summary (Discovery Persona)",
      "- Summary: User authentication flow.",
      "",
      "## 3. Scope",
      "- In scope: login form, validation.",
      "",
      "## 4. Current pain",
      "- Users cannot authenticate.",
      "",
      "## 5. Success metrics",
      "- Login success rate > 99%.",
      "",
      "## 6. Assumptions",
      "- Email/password auth only.",
      "",
      "## 7. Dependencies",
      "- None.",
      "",
      "## 8. Constraints (business/technical/compliance)",
      "- None.",
      "",
      "## 9. Discovery Confidence",
      "- Confidence: high",
      "- Interview mode: quick",
      ""
    ].join("\n"),
    "utf8"
  );
}

// Phase W: EVO-001 Phase 2 — aitri plan --ai-backlog / --ai-tests (Auditor Mode)

test("plan --ai-backlog accepts agent-generated backlog when traceability is valid", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-plan-ai-override-pass-"));
  const feature = "user-auth";
  setupPlanReadyProject(tempDir, feature);

  // Write agent-generated backlog and tests
  const agentBacklog = [
    `# Backlog: ${feature}`,
    "",
    "## User Stories",
    "",
    "### US-1",
    "- As a User, I want to log in with email, so that I can access the system.",
    "- Trace: FR-1, AC-1",
    "",
    "### US-2",
    "- As a User, I want invalid logins rejected, so that my account is secure.",
    "- Trace: FR-2, AC-2"
  ].join("\n");

  const agentTests = [
    `# Test Cases: ${feature}`,
    "",
    "### TC-1",
    "- Trace: US-1, FR-1",
    "",
    "### TC-2",
    "- Trace: US-2, FR-2"
  ].join("\n");

  const backlogFile = path.join(tempDir, "agent-backlog.md");
  const testsFile = path.join(tempDir, "agent-tests.md");
  fs.writeFileSync(backlogFile, agentBacklog, "utf8");
  fs.writeFileSync(testsFile, agentTests, "utf8");

  const result = runNodeOk(
    ["plan", "--feature", feature, "--non-interactive", "--yes",
     "--ai-backlog", "agent-backlog.md",
     "--ai-tests", "agent-tests.md"],
    { cwd: tempDir }
  );

  assert.ok(
    result.stdout.includes("Audit passed") || result.stdout.includes("Plan created"),
    `expected audit pass + plan created, got: ${result.stdout}`
  );

  // Verify agent's content was written (not the generated one)
  const writtenBacklog = fs.readFileSync(
    path.join(tempDir, "backlog", feature, "backlog.md"), "utf8"
  );
  assert.ok(
    writtenBacklog.includes("I want to log in with email"),
    "agent backlog content should be written as-is"
  );
});

test("plan --ai-backlog fails audit when US references non-existent FR", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-plan-ai-override-fail-"));
  const feature = "user-auth";
  setupPlanReadyProject(tempDir, feature);

  // Agent backlog with bad FR reference
  const badBacklog = [
    `# Backlog: ${feature}`,
    "",
    "## User Stories",
    "",
    "### US-1",
    "- As a User, I want to log in, so that I can access the system.",
    "- Trace: FR-99, AC-1"   // FR-99 does not exist in spec
  ].join("\n");

  const agentTests = [
    `# Test Cases: ${feature}`,
    "",
    "### TC-1",
    "- Trace: US-1, FR-1"
  ].join("\n");

  fs.writeFileSync(path.join(tempDir, "bad-backlog.md"), badBacklog, "utf8");
  fs.writeFileSync(path.join(tempDir, "agent-tests.md"), agentTests, "utf8");

  const result = runNode(
    ["plan", "--feature", feature, "--non-interactive", "--yes",
     "--ai-backlog", "bad-backlog.md",
     "--ai-tests", "agent-tests.md"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 1, "should fail audit");
  assert.ok(
    result.stdout.includes("AUDIT FAILED") || result.stdout.includes("FR-99"),
    `expected audit failure mentioning FR-99, got: ${result.stdout}`
  );

  // Verify backlog was NOT written (no partial writes on audit failure)
  assert.equal(
    fs.existsSync(path.join(tempDir, "backlog", feature, "backlog.md")),
    false,
    "backlog should not be written when audit fails"
  );
});

// Phase X: EVO-003 — aitri diff (Backlog Delta)

test("diff requires --feature flag", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-diff-no-feature-"));
  setupAitriProject(tempDir);

  const result = runNode(["diff", "--non-interactive"], { cwd: tempDir });

  assert.equal(result.status, 1, "should fail without --feature");
  assert.ok(
    result.stdout.includes("Feature name is required"),
    `expected feature-required message, got: ${result.stdout}`
  );
});

test("diff requires --proposed flag", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-diff-no-proposed-"));
  setupAitriProject(tempDir);

  const result = runNode(["diff", "--feature", "user-auth", "--non-interactive"], { cwd: tempDir });

  assert.equal(result.status, 1, "should fail without --proposed");
  assert.ok(
    result.stdout.includes("Proposed backlog file is required"),
    `expected proposed-required message, got: ${result.stdout}`
  );
});

test("diff detects added, modified, and removed stories between backlog versions", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-diff-delta-"));
  const feature = "user-auth";
  setupPlanReadyProject(tempDir, feature);

  // Write current backlog (as if plan was run)
  const backlogDir = path.join(tempDir, "backlog", feature);
  fs.mkdirSync(backlogDir, { recursive: true });
  const currentBacklog = [
    `# Backlog: ${feature}`,
    "",
    "## User Stories",
    "",
    "### US-1",
    "- As a User, I want to log in with email, so that I can access the system.",
    "- Trace: FR-1, AC-1",
    "",
    "### US-2",
    "- As a User, I want invalid logins rejected, so that my account is secure.",
    "- Trace: FR-2, AC-2"
  ].join("\n");
  fs.writeFileSync(path.join(backlogDir, "backlog.md"), currentBacklog, "utf8");

  // Proposed backlog: US-1 modified (new trace), US-2 removed, US-3 added
  const proposedBacklog = [
    `# Backlog: ${feature}`,
    "",
    "## User Stories",
    "",
    "### US-1",
    "- As a User, I want to log in with email, so that I can access the system.",
    "- Trace: FR-1, FR-2, AC-1",   // modified: added FR-2
    "",
    "### US-3",
    "- As a User, I want to reset my password, so that I can recover my account.",
    "- Trace: FR-1, AC-2"
  ].join("\n");
  const proposedFile = path.join(tempDir, "proposed-backlog.md");
  fs.writeFileSync(proposedFile, proposedBacklog, "utf8");

  const result = runNode(
    ["diff", "--feature", feature, "--proposed", "proposed-backlog.md", "--json", "--non-interactive"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0, `diff failed: ${result.stdout}\n${result.stderr}`);

  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.hasChanges, true);
  assert.equal(parsed.summary.added, 1, "should detect 1 added story");
  assert.equal(parsed.summary.modified, 1, "should detect 1 modified story");
  assert.equal(parsed.summary.removed, 1, "should detect 1 removed story");
  assert.equal(parsed.summary.unchanged, 0, "should have 0 unchanged stories");
  assert.equal(parsed.delta.added[0].id, "US-3", "added story should be US-3");
  assert.equal(parsed.delta.modified[0].id, "US-1", "modified story should be US-1");
  assert.equal(parsed.delta.removed[0].id, "US-2", "removed story should be US-2");
});

test("diff reports no changes when backlogs are identical", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-diff-unchanged-"));
  const feature = "user-auth";
  setupPlanReadyProject(tempDir, feature);

  const backlogDir = path.join(tempDir, "backlog", feature);
  fs.mkdirSync(backlogDir, { recursive: true });
  const backlogContent = [
    `# Backlog: ${feature}`,
    "",
    "## User Stories",
    "",
    "### US-1",
    "- As a User, I want to log in with email, so that I can access the system.",
    "- Trace: FR-1, AC-1"
  ].join("\n");
  fs.writeFileSync(path.join(backlogDir, "backlog.md"), backlogContent, "utf8");
  fs.writeFileSync(path.join(tempDir, "same-backlog.md"), backlogContent, "utf8");

  const result = runNode(
    ["diff", "--feature", feature, "--proposed", "same-backlog.md", "--json", "--non-interactive"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0, `diff failed: ${result.stdout}`);
  const parsed = JSON.parse(result.stdout.trim());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.hasChanges, false, "should report no changes");
  assert.equal(parsed.summary.unchanged, 1, "US-1 should be unchanged");
});
