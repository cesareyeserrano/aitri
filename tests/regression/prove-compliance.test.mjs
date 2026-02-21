import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

function writeApprovedSpec(dir, feature, frLines = []) {
  const specDir = path.join(dir, "specs", "approved");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, `${feature}.md`),
    [
      `# AF-SPEC: ${feature}`,
      "STATUS: APPROVED",
      "",
      "## 1. Context",
      "Prove compliance test fixture.",
      "",
      "## 2. Actors",
      "- Developer",
      "",
      "## 3. Functional Rules (traceable)",
      ...frLines,
      "",
      "## 9. Acceptance Criteria",
      "- AC-1: Given input, when processed, then output is correct.",
      ""
    ].join("\n"),
    "utf8"
  );
}

function writeTestsMd(dir, feature, tcLines = []) {
  const testsDir = path.join(dir, "tests", feature);
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(
    path.join(testsDir, "tests.md"),
    ["# Tests: " + feature, "", ...tcLines, ""].join("\n"),
    "utf8"
  );
}

function writePassingStub(dir, tcId) {
  const content = [
    `// ${tcId}: stub`,
    `import test from "node:test";`,
    `import assert from "node:assert/strict";`,
    `test("${tcId} passes", () => { assert.ok(true); });`
  ].join("\n");
  fs.writeFileSync(path.join(dir, `${tcId.toLowerCase()}.test.mjs`), content, "utf8");
}

function writeFailingStub(dir, tcId) {
  const content = [
    `// ${tcId}: stub`,
    `import test from "node:test";`,
    `import assert from "node:assert/strict";`,
    `test("${tcId} fails", () => { assert.ok(false, "intentional failure"); });`
  ].join("\n");
  fs.writeFileSync(path.join(dir, `${tcId.toLowerCase()}.test.mjs`), content, "utf8");
}

test("prove fails fast when approved spec is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-no-spec-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const result = runNode(["prove", "--feature", "ghost-feature", "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Approved spec not found/);
});

test("prove fails fast when tests file is missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-no-tests-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "no-tests-feature";
  writeApprovedSpec(tempDir, feature, ["- FR-1: Rule one."]);

  const result = runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /Tests file not found/);
});

test("prove fails fast when no TC stubs exist", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-no-stubs-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "no-stubs";
  writeApprovedSpec(tempDir, feature, ["- FR-1: Rule one."]);
  writeTestsMd(tempDir, feature, [
    "### TC-1",
    "- Trace: US-1, FR-1, AC-1"
  ]);
  // No generated stubs directory

  const result = runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /No generated test stubs found/);
});

test("prove exits 0 when all FRs are proven by passing TC stubs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-all-pass-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "all-pass";
  writeApprovedSpec(tempDir, feature, [
    "- FR-1: Rule one.",
    "- FR-2: Rule two."
  ]);
  writeTestsMd(tempDir, feature, [
    "### TC-1",
    "- Trace: US-1, FR-1, AC-1",
    "",
    "### TC-2",
    "- Trace: US-1, FR-2, AC-1"
  ]);
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  writePassingStub(generatedDir, "TC-1");
  writePassingStub(generatedDir, "TC-2");

  const result = runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /FR-1: PROVEN/);
  assert.match(result.stdout, /FR-2: PROVEN/);
  assert.match(result.stdout, /All functional requirements proven/);

  const proofFile = path.join(tempDir, "docs", "implementation", feature, "proof-of-compliance.json");
  assert.ok(fs.existsSync(proofFile), "proof-of-compliance.json must be written");
  const proof = JSON.parse(fs.readFileSync(proofFile, "utf8"));
  assert.equal(proof.ok, true);
  assert.equal(proof.summary.proven, 2);
  assert.equal(proof.summary.total, 2);
  assert.equal(proof.frProof["FR-1"].proven, true);
  assert.equal(proof.frProof["FR-2"].proven, true);
});

test("prove exits 1 and reports unproven FRs when a TC stub fails", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-fail-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "partial-fail";
  writeApprovedSpec(tempDir, feature, [
    "- FR-1: Rule one.",
    "- FR-2: Rule two."
  ]);
  writeTestsMd(tempDir, feature, [
    "### TC-1",
    "- Trace: US-1, FR-1, AC-1",
    "",
    "### TC-2",
    "- Trace: US-1, FR-2, AC-1"
  ]);
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  writePassingStub(generatedDir, "TC-1");
  writeFailingStub(generatedDir, "TC-2");

  const result = runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FR-1: PROVEN/);
  assert.match(result.stdout, /FR-2: UNPROVEN/);
  assert.match(result.stdout, /UNPROVEN requirements: FR-2/);

  const proofFile = path.join(tempDir, "docs", "implementation", feature, "proof-of-compliance.json");
  const proof = JSON.parse(fs.readFileSync(proofFile, "utf8"));
  assert.equal(proof.ok, false);
  assert.equal(proof.summary.proven, 1);
  assert.equal(proof.summary.unproven, 1);
  assert.equal(proof.frProof["FR-1"].proven, true);
  assert.equal(proof.frProof["FR-2"].proven, false);
});

test("prove reports FR as unproven when its TC stub is missing (no file found)", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-missing-stub-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "missing-stub";
  writeApprovedSpec(tempDir, feature, [
    "- FR-1: Rule one.",
    "- FR-2: Rule two."
  ]);
  writeTestsMd(tempDir, feature, [
    "### TC-1",
    "- Trace: US-1, FR-1, AC-1",
    "",
    "### TC-2",
    "- Trace: US-1, FR-2, AC-1"
  ]);
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  writePassingStub(generatedDir, "TC-1");
  // TC-2 stub is intentionally absent

  const result = runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });
  // TC-2 missing → FR-2 unproven → exit 1
  assert.equal(result.status, 1);
  assert.match(result.stdout, /FR-1: PROVEN/);
  assert.match(result.stdout, /FR-2: UNPROVEN/);

  const proof = JSON.parse(
    fs.readFileSync(path.join(tempDir, "docs", "implementation", feature, "proof-of-compliance.json"), "utf8")
  );
  assert.equal(proof.frProof["FR-2"].proven, false);
  assert.deepEqual(proof.frProof["FR-2"].via, []);
});

test("prove proof record includes evidence file paths for proven FRs", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-prove-evidence-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  const feature = "evidence-check";
  writeApprovedSpec(tempDir, feature, ["- FR-1: Must do the thing."]);
  writeTestsMd(tempDir, feature, [
    "### TC-1",
    "- Trace: US-1, FR-1, AC-1"
  ]);
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  fs.mkdirSync(generatedDir, { recursive: true });
  writePassingStub(generatedDir, "TC-1");

  runNode(["prove", "--feature", feature, "--non-interactive"], { cwd: tempDir });

  const proof = JSON.parse(
    fs.readFileSync(path.join(tempDir, "docs", "implementation", feature, "proof-of-compliance.json"), "utf8")
  );
  assert.ok(proof.frProof["FR-1"].evidence.length > 0, "proven FR must have evidence paths");
  assert.match(proof.frProof["FR-1"].evidence[0], /tc-1/i);
});
