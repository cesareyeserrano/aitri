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

// Phase M: hooks

test("hooks install creates pre-commit and pre-push hook files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-hooks-install-"));
  setupAitriProject(tempDir);

  const result = runNode(
    ["hooks", "install", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);

  const preCommitPath = path.join(tempDir, ".git", "hooks", "pre-commit");
  const prePushPath = path.join(tempDir, ".git", "hooks", "pre-push");

  assert.ok(fs.existsSync(preCommitPath), "pre-commit hook should exist");
  assert.ok(fs.existsSync(prePushPath), "pre-push hook should exist");

  const preCommitContent = fs.readFileSync(preCommitPath, "utf8");
  const prePushContent = fs.readFileSync(prePushPath, "utf8");

  assert.ok(preCommitContent.includes("Aitri"), "pre-commit should contain Aitri marker");
  assert.ok(prePushContent.includes("Aitri"), "pre-push should contain Aitri marker");
});

test("hooks status detects installed hooks", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-hooks-status-"));
  setupAitriProject(tempDir);

  const before = runNode(["hooks", "status", "--non-interactive"], { cwd: tempDir });
  assert.equal(before.status, 0);
  assert.match(before.stdout, /not installed/);

  runNodeOk(["hooks", "install", "--non-interactive", "--yes"], { cwd: tempDir });

  const after = runNode(["hooks", "status", "--non-interactive"], { cwd: tempDir });
  assert.equal(after.status, 0);
  assert.match(after.stdout, /installed \(aitri\)/);
});

test("hooks remove deletes hook files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-hooks-remove-"));
  setupAitriProject(tempDir);

  runNodeOk(["hooks", "install", "--non-interactive", "--yes"], { cwd: tempDir });

  const preCommitPath = path.join(tempDir, ".git", "hooks", "pre-commit");
  const prePushPath = path.join(tempDir, ".git", "hooks", "pre-push");

  assert.ok(fs.existsSync(preCommitPath), "pre-commit should exist before removal");

  const result = runNode(["hooks", "remove", "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);

  assert.ok(!fs.existsSync(preCommitPath), "pre-commit should be removed");
  assert.ok(!fs.existsSync(prePushPath), "pre-push should be removed");
});

// Phase M: ci

test("ci init generates github actions workflow file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-ci-init-"));
  setupAitriProject(tempDir);

  const result = runNode(
    ["ci", "init", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);

  const workflowFile = path.join(tempDir, ".github", "workflows", "aitri.yml");
  assert.ok(fs.existsSync(workflowFile), "aitri.yml should exist");

  const content = fs.readFileSync(workflowFile, "utf8");
  assert.ok(content.includes("Aitri SDLC Gates"), "workflow should contain Aitri marker");
  assert.ok(content.includes("actions/checkout"), "workflow should reference checkout action");
  assert.ok(content.includes("aitri doctor"), "workflow should run doctor");
});
