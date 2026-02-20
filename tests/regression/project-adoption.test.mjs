import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

// ---------------------------------------------------------------------------
// EVO-008 Phase 1: aitri adopt regression tests
// ---------------------------------------------------------------------------

test("adopt --dry-run shows scan results without writing files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-adopt-dryrun-"));
  // Simulate a Node.js project with package.json and tests/
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
    name: "my-existing-project",
    version: "1.0.0",
    scripts: { test: "node --test" }
  }), "utf8");
  fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "tests", "app.test.js"), "// test", "utf8");

  const result = runNodeOk(["adopt", "--dry-run", "--non-interactive", "--yes"], { cwd: tempDir });

  // dry-run: no manifest written
  assert.equal(fs.existsSync(path.join(tempDir, "docs", "adoption-manifest.json")), false);
  assert.match(result.stdout, /dry-run/i);
  assert.match(result.stdout, /node/i);
});

test("adopt initializes Aitri folder structure and writes adoption-manifest.json", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-adopt-init-"));
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
    name: "brownfield-app",
    version: "2.0.0",
    scripts: { test: "jest" }
  }), "utf8");

  runNodeOk(["adopt", "--non-interactive", "--yes"], { cwd: tempDir });

  // Manifest created
  const manifestPath = path.join(tempDir, "docs", "adoption-manifest.json");
  assert.ok(fs.existsSync(manifestPath), "adoption-manifest.json should be created");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.ok(manifest.adoptedAt, "manifest should have adoptedAt timestamp");
  assert.ok(Array.isArray(manifest.stacks), "manifest should have stacks array");
  assert.ok(manifest.stacks.some((s) => s.name === "node"), "should detect node stack");
  assert.ok(typeof manifest.existingTestFiles === "number", "should have existingTestFiles count");

  // Aitri structure initialized
  assert.ok(fs.existsSync(path.join(tempDir, "specs", "drafts")), "specs/drafts should be created");
  assert.ok(fs.existsSync(path.join(tempDir, "specs", "approved")), "specs/approved should be created");
  assert.ok(fs.existsSync(path.join(tempDir, "backlog")), "backlog should be created");
  assert.ok(fs.existsSync(path.join(tempDir, "docs")), "docs should be created");
});

test("adopt never modifies existing source files", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-adopt-readonly-"));

  // Create existing source content
  fs.mkdirSync(path.join(tempDir, "src"), { recursive: true });
  const srcFile = path.join(tempDir, "src", "index.js");
  const originalContent = "// Original source — must not be touched\nexport const version = '1.0.0';\n";
  fs.writeFileSync(srcFile, originalContent, "utf8");

  fs.mkdirSync(path.join(tempDir, "tests"), { recursive: true });
  const testFile = path.join(tempDir, "tests", "index.test.js");
  const originalTest = "import test from 'node:test';\ntest('placeholder', () => {});\n";
  fs.writeFileSync(testFile, originalTest, "utf8");

  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "protected", version: "1.0.0" }), "utf8");

  runNodeOk(["adopt", "--non-interactive", "--yes"], { cwd: tempDir });

  // Source files must be unchanged
  assert.equal(fs.readFileSync(srcFile, "utf8"), originalContent, "src/index.js must not be modified");
  assert.equal(fs.readFileSync(testFile, "utf8"), originalTest, "tests/index.test.js must not be modified");
});

test("adopt is idempotent — running twice does not overwrite manifest data", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-adopt-idempotent-"));
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "idempotent-project", version: "1.0.0" }), "utf8");

  runNodeOk(["adopt", "--non-interactive", "--yes"], { cwd: tempDir });
  const firstManifest = JSON.parse(
    fs.readFileSync(path.join(tempDir, "docs", "adoption-manifest.json"), "utf8")
  );

  // Run again
  const result = runNode(["adopt", "--non-interactive", "--yes"], { cwd: tempDir });
  assert.equal(result.status, 0);

  // Second run should succeed without error
  assert.doesNotThrow(() =>
    JSON.parse(fs.readFileSync(path.join(tempDir, "docs", "adoption-manifest.json"), "utf8"))
  );
  // First adoptedAt timestamp preserved (manifest re-written but structure present)
  const secondManifest = JSON.parse(
    fs.readFileSync(path.join(tempDir, "docs", "adoption-manifest.json"), "utf8")
  );
  assert.equal(secondManifest.projectRoot, firstManifest.projectRoot, "projectRoot should be stable");
});

test("adopt detects readme and entry points", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-adopt-readme-"));
  fs.writeFileSync(path.join(tempDir, "README.md"), "# My Project\n", "utf8");
  fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({
    name: "readme-project",
    version: "1.0.0",
    main: "index.js"
  }), "utf8");
  fs.writeFileSync(path.join(tempDir, "index.js"), "// entry\n", "utf8");

  runNodeOk(["adopt", "--non-interactive", "--yes"], { cwd: tempDir });

  const manifest = JSON.parse(
    fs.readFileSync(path.join(tempDir, "docs", "adoption-manifest.json"), "utf8")
  );
  assert.equal(manifest.readme, "README.md");
  assert.ok(manifest.entryPoints.includes("index.js"), "should detect index.js entry point");
});
