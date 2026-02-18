import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runNode, runNodeOk } from "../smoke/helpers/cli-test-helpers.mjs";

function writeApprovedSpec(tempDir, feature, withReqSource = false) {
  fs.mkdirSync(path.join(tempDir, "specs", "approved"), { recursive: true });
  const reqSource = withReqSource
    ? "\n\n## 10. Requirement Source Statement\n- Requirements provided by user.\n"
    : "";
  fs.writeFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`),
    `# AF-SPEC: ${feature}\nSTATUS: APPROVED\n\n## 3. Functional Rules (traceable)\n- FR-1: Core rule.${reqSource}\n`,
    "utf8"
  );
}

test("doctor detects missing Requirement Source Statement", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-doctor-missing-req-source-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const feature = "auth-flow";
  writeApprovedSpec(tempDir, feature, false);

  const result = runNode(["doctor", "--json"], { cwd: tempDir });
  assert.equal(result.status, 1);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, false);

  const reqCheck = payload.checks.find((c) => c.id === "REQ-SOURCE-STATEMENT");
  assert.ok(reqCheck, "REQ-SOURCE-STATEMENT check should be present");
  assert.equal(reqCheck.ok, false);
  assert.ok(reqCheck.files.some((f) => f.includes(`${feature}.md`)));
});

test("doctor passes when project is up-to-date", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-doctor-all-pass-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const feature = "complete-feature";
  writeApprovedSpec(tempDir, feature, true);

  const result = runNode(["doctor", "--json"], { cwd: tempDir });
  assert.equal(result.status, 0);

  const payload = JSON.parse(result.stdout);
  assert.equal(payload.ok, true);

  const reqCheck = payload.checks.find((c) => c.id === "REQ-SOURCE-STATEMENT");
  assert.ok(reqCheck?.ok, "REQ-SOURCE-STATEMENT should pass");

  const profileCheck = payload.checks.find((c) => c.id === "PROJECT-PROFILE");
  assert.ok(profileCheck?.ok, "PROJECT-PROFILE should pass");

  const versionCheck = payload.checks.find((c) => c.id === "AITRI-VERSION-STAMP");
  assert.ok(versionCheck?.ok, "AITRI-VERSION-STAMP should pass");
});
