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

test("upgrade adds missing Requirement Source Statement", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-upgrade-add-req-source-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const feature = "needs-upgrade";
  writeApprovedSpec(tempDir, feature, false);

  const originalContent = fs.readFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`), "utf8"
  );
  const originalFr = originalContent.match(/- FR-1:.+/)?.[0];

  runNodeOk(["upgrade", "--non-interactive", "--yes"], { cwd: tempDir });

  const updated = fs.readFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`), "utf8"
  );
  assert.ok(updated.includes("## 10. Requirement Source Statement"), "should add req source section");
  assert.ok(updated.includes(originalFr), "original FR content must be unchanged");
});

test("upgrade creates project.json when missing", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-upgrade-create-profile-"));
  fs.mkdirSync(path.join(tempDir, "specs", "approved"), { recursive: true });
  fs.mkdirSync(path.join(tempDir, "docs"), { recursive: true });

  assert.equal(fs.existsSync(path.join(tempDir, "docs", "project.json")), false);

  runNodeOk(["upgrade", "--non-interactive", "--yes"], { cwd: tempDir });

  const profile = JSON.parse(fs.readFileSync(path.join(tempDir, "docs", "project.json"), "utf8"));
  assert.ok(profile.aitriVersion, "project.json should have aitriVersion");
});

test("upgrade is idempotent", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-upgrade-idempotent-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const feature = "idempotent-feature";
  writeApprovedSpec(tempDir, feature, true);

  runNodeOk(["upgrade", "--non-interactive", "--yes"], { cwd: tempDir });

  const result = runNode(["upgrade", "--non-interactive", "--yes"], { cwd: tempDir });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /0 migrations needed/);
});

test("upgrade never modifies user-provided requirement content", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-upgrade-no-req-change-"));
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });

  const feature = "protected-reqs";
  const frContent = "- FR-1: User must authenticate with MFA before accessing dashboard.";
  const acContent = "- AC-1: Two-factor code expires after 30 seconds.";
  fs.mkdirSync(path.join(tempDir, "specs", "approved"), { recursive: true });
  fs.writeFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`),
    `# AF-SPEC: ${feature}\nSTATUS: APPROVED\n\n## 3. Functional Rules (traceable)\n${frContent}\n\n## 9. Acceptance Criteria\n${acContent}\n`,
    "utf8"
  );

  runNodeOk(["upgrade", "--non-interactive", "--yes"], { cwd: tempDir });

  const updated = fs.readFileSync(
    path.join(tempDir, "specs", "approved", `${feature}.md`), "utf8"
  );
  assert.ok(updated.includes(frContent), "FR content must be unchanged");
  assert.ok(updated.includes(acContent), "AC content must be unchanged");
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
