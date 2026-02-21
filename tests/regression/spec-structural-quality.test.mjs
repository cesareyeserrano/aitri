import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

function setupProject(tempDir) {
  spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
}

function writeDraft(tempDir, feature, overrides = {}) {
  const defaults = {
    actors: "- Developer\n- Admin",
    frs: "- FR-1: The system must validate input.\n- FR-2: The system must persist results.",
    acs: "- AC-1: Given valid input, when submitted, then results are saved.\n- AC-2: Given invalid input, when submitted, then an error is shown.",
    edge: "- Network timeout during submission.",
    security: "- All inputs must be sanitized.",
    extra: ""
  };
  const spec = Object.assign({}, defaults, overrides);

  fs.mkdirSync(path.join(tempDir, "specs", "drafts"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "specs", "drafts", `${feature}.md`),
    `# AF-SPEC: ${feature}

STATUS: DRAFT

## 1. Context
Core feature for the system.

## 2. Actors
${spec.actors}

## 3. Functional Rules (traceable)
${spec.frs}

## 4. Edge Cases
${spec.edge}

## 7. Security Considerations
${spec.security}

## 9. Acceptance Criteria
${spec.acs}
${spec.extra}

## 10. Requirement Source Statement
- Requirements provided by user.
`,
    "utf8"
  );
}

test("approve passes a structurally clean spec (baseline)", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-clean-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-a");

  const result = runNode(
    ["approve", "--feature", "feature-a", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 0, `stdout: ${result.stdout}\nstderr: ${result.stderr}`);
  assert.ok(fs.existsSync(path.join(tempDir, "specs", "approved", "feature-a.md")));
});

test("approve blocks spec with duplicate FR IDs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-dup-fr-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-b", {
    frs: "- FR-1: The system must validate input.\n- FR-1: The system must also log errors."
  });

  const result = runNode(
    ["approve", "--feature", "feature-b", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Duplicate Functional Rule IDs.*FR-1/);
});

test("approve blocks spec with duplicate AC IDs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-dup-ac-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-c", {
    acs: "- AC-1: Given valid input, when submitted, then results are saved.\n- AC-1: Given a retry, when submitted again, then it succeeds."
  });

  const result = runNode(
    ["approve", "--feature", "feature-c", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Duplicate Acceptance Criteria IDs.*AC-1/);
});

test("approve blocks spec where FR count exceeds AC count", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-fr-ac-gap-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-d", {
    frs: "- FR-1: Validate input.\n- FR-2: Persist results.\n- FR-3: Send notification.",
    acs: "- AC-1: Given valid input, when submitted, then results are saved."
  });

  const result = runNode(
    ["approve", "--feature", "feature-d", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Coverage gap/);
  assert.match(result.stdout, /3 Functional Rule/);
});

test("approve blocks spec with TODO placeholders", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-todo-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-e", {
    extra: "\n## 11. Notes\n- TODO: define rate limiting strategy"
  });

  const result = runNode(
    ["approve", "--feature", "feature-e", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unresolved placeholder/i);
  assert.match(result.stdout, /TODO/);
});

test("approve blocks spec with TBD placeholders", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-spec-tbd-"));
  setupProject(tempDir);
  writeDraft(tempDir, "feature-f", {
    security: "- TBD"
  });

  const result = runNode(
    ["approve", "--feature", "feature-f", "--non-interactive", "--yes"],
    { cwd: tempDir }
  );
  assert.equal(result.status, 1);
  assert.match(result.stdout, /unresolved placeholder/i);
  assert.match(result.stdout, /TBD/);
});
