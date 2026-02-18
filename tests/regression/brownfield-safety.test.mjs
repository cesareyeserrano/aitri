import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

test("init warns when tests/ directory has existing content", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-existing-content-"));
  fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "tests", "app.test.js"), "// existing test\n", "utf8");

  const result = runNode(["init", "--non-interactive"], { cwd: tempDir });

  assert.equal(result.status, 1);
  assert.match(result.stdout, /Existing directories detected/);
  assert.match(result.stdout, /tests\//);
});

test("init proceeds with --yes despite conflicts", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-yes-override-"));
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "docs", "README.md"), "# Existing docs\n", "utf8");

  const result = runNode(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  assert.equal(result.status, 0);
  assert.ok(fs.existsSync(path.join(tempDir, "specs", "drafts")), "specs/drafts should be created");
  assert.ok(fs.existsSync(path.join(tempDir, "docs", "README.md")), "docs/README.md should still exist");
});

test("init detects project type from package.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-detect-stack-"));
  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    JSON.stringify({ name: "test-project", version: "1.0.0" }, null, 2),
    "utf8"
  );

  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const profile = JSON.parse(fs.readFileSync(path.join(tempDir, "docs", "project.json"), "utf8"));
  assert.ok(Array.isArray(profile.detectedStack), "detectedStack should be an array");
  assert.ok(profile.detectedStack.includes("node"), "should detect node from package.json");
});

test("init does not overwrite existing project.json in non-interactive mode", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-no-overwrite-"));

  // First init creates project.json
  runNodeOk(["init", "--non-interactive", "--yes", "--project", "original"], { cwd: tempDir });

  const before = JSON.parse(fs.readFileSync(path.join(tempDir, "docs", "project.json"), "utf8"));
  assert.equal(before.name, "original");

  // Second init with --yes should skip writing project.json
  runNodeOk(["init", "--non-interactive", "--yes", "--project", "new-name"], { cwd: tempDir });

  const after = JSON.parse(fs.readFileSync(path.join(tempDir, "docs", "project.json"), "utf8"));
  assert.equal(after.name, "original", "project.json should not be overwritten");
});

function setupScaffoldReady(tempDir, feature) {
  const dirs = [
    path.join(tempDir, "specs", "approved"),
    path.join(tempDir, "backlog", feature),
    path.join(tempDir, "tests", feature),
    path.join(tempDir, "docs", "plan"),
    path.join(tempDir, "docs", "implementation", feature)
  ];
  dirs.forEach((d) => fs.mkdirSync(d, { recursive: true }));

  fs.writeFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`),
    `# AF-SPEC: ${feature}\nSTATUS: APPROVED\n\n## 3. Functional Rules (traceable)\n- FR-1: Process the request.\n\n## 10. Requirement Source Statement\n- User provided.\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempDir, "docs", "plan", `${feature}.md`),
    `# Plan: ${feature}\n\n## 5. Architecture (Architect Persona)\n### Components\n- Core service\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempDir, "tests", feature, "tests.md"),
    `# Test Cases: ${feature}\n### TC-1\n- Title: Validate core rule.\n- Trace: FR-1, US-1\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempDir, "docs", "implementation", feature, "go.json"),
    JSON.stringify({ feature, approvedAt: new Date().toISOString(), schemaVersion: 1 }, null, 2),
    "utf8"
  );
}

test("scaffold --dry-run shows plan without writing files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-dry-run-"));
  const feature = "dry-run-feature";
  setupScaffoldReady(tempDir, feature);

  const result = runNode(
    ["scaffold", "--feature", feature, "--dry-run", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /DRY RUN/);
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  assert.equal(fs.existsSync(generatedDir), false, "test stubs should NOT be created in dry-run");
});

test("scaffold warns about existing src/ content but does not overwrite", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-brownfield-src-conflict-"));
  const feature = "src-conflict-feature";
  setupScaffoldReady(tempDir, feature);

  fs.mkdirSync(path.join(tempDir, "src", "services"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "src", "services", "existing.js"), "// existing\n", "utf8");

  const result = runNode(
    ["scaffold", "--feature", feature, "--non-interactive", "--yes"],
    { cwd: tempDir }
  );

  assert.equal(result.status, 0);
  assert.match(result.stdout, /existing directories/);
  assert.ok(
    fs.existsSync(path.join(tempDir, "src", "services", "existing.js")),
    "existing.js should still exist"
  );
});
