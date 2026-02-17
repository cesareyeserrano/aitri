import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseApprovedSpec } from "../../cli/commands/spec-parser.js";
import { generateTestsContent } from "../../cli/commands/content-generator.js";
import { runNode, runNodeOk } from "./helpers/cli-test-helpers.mjs";

const SPEC_WITHOUT_UI = `# AF-SPEC: no-ui-feature

STATUS: APPROVED

## 1. Context
A backend service with no visual components.

## 2. Actors
- API consumer

## 3. Functional Rules (traceable)
- FR-1: The system must validate input payloads.

## 4. Edge Cases
- Empty payload submitted.

## 6. Non-Functional Requirements
- Response time under 200ms.

## 7. Security Considerations
- Reject unauthenticated requests.

## 8. Out of Scope
- Admin dashboard.

## 9. Acceptance Criteria (Given/When/Then)
- AC-1: Given a valid payload, when submitted, then a 200 response is returned.
`;

const SPEC_WITH_UI = `# AF-SPEC: ui-feature

STATUS: APPROVED

## 1. Context
A web app with login and dashboard screens.

## 2. Actors
- End user

## 3. Functional Rules (traceable)
- FR-1: The system must authenticate users via login form.
- FR-2: The system must display user metrics on the dashboard.

## 4. Edge Cases
- Invalid credentials submitted.

## 6. UI Structure

Screen: Login
┌─────────────────────┐
│ [input: username]           │
│ [input: password]           │
│ [button: submit]            │
└─────────────────────┘

Screen: Dashboard
┌─────────────────────┐
│ [chart: metrics]            │
│ [table: recent-activity]    │
└─────────────────────┘

Flow: Login → Dashboard
Flow: Dashboard → Settings

### References
- UI-REF-1: mockups/login.png → AC-1, AC-2
- UI-REF-2: mockups/dashboard.png → AC-3

## 7. Security Considerations
- Enforce rate limiting on login attempts.

## 8. Out of Scope
- Password recovery flow.

## 9. Acceptance Criteria (Given/When/Then)
- AC-1: Given valid credentials, when login form is submitted, then user sees the dashboard.
- AC-2: Given invalid credentials, when login form is submitted, then an error is shown.
- AC-3: Given an authenticated user, when dashboard loads, then metrics are displayed.
`;

// Test 1: parseApprovedSpec returns hasUiSection: false for spec without UI section
test("parseApprovedSpec returns hasUiSection false for spec without UI Structure section", () => {
  const parsed = parseApprovedSpec(SPEC_WITHOUT_UI, { feature: "no-ui-feature" });
  assert.equal(parsed.uiStructure.hasUiSection, false);
  assert.deepEqual(parsed.uiStructure.screens, []);
  assert.deepEqual(parsed.uiStructure.flows, []);
  assert.deepEqual(parsed.uiStructure.refs, []);
});

// Test 2: parseApprovedSpec extracts screens, components, flows from UI Structure
test("parseApprovedSpec extracts screens components and flows from UI Structure", () => {
  const parsed = parseApprovedSpec(SPEC_WITH_UI, { feature: "ui-feature" });
  assert.equal(parsed.uiStructure.hasUiSection, true);

  // Screens
  assert.equal(parsed.uiStructure.screens.length, 2);
  assert.equal(parsed.uiStructure.screens[0].name, "Login");
  assert.ok(parsed.uiStructure.screens[0].components.includes("input: username"));
  assert.ok(parsed.uiStructure.screens[0].components.includes("button: submit"));
  assert.equal(parsed.uiStructure.screens[1].name, "Dashboard");
  assert.ok(parsed.uiStructure.screens[1].components.includes("chart: metrics"));

  // Flows
  assert.equal(parsed.uiStructure.flows.length, 2);
  assert.deepEqual(parsed.uiStructure.flows[0], { from: "Login", to: "Dashboard" });
  assert.deepEqual(parsed.uiStructure.flows[1], { from: "Dashboard", to: "Settings" });
});

// Test 3: parseApprovedSpec extracts UI-REF items with path and AC links
test("parseApprovedSpec extracts UI-REF items with path and AC links", () => {
  const parsed = parseApprovedSpec(SPEC_WITH_UI, { feature: "ui-feature" });
  assert.equal(parsed.uiStructure.refs.length, 2);

  assert.equal(parsed.uiStructure.refs[0].id, "UI-REF-1");
  assert.equal(parsed.uiStructure.refs[0].path, "mockups/login.png");
  assert.deepEqual(parsed.uiStructure.refs[0].acIds, ["AC-1", "AC-2"]);

  assert.equal(parsed.uiStructure.refs[1].id, "UI-REF-2");
  assert.equal(parsed.uiStructure.refs[1].path, "mockups/dashboard.png");
  assert.deepEqual(parsed.uiStructure.refs[1].acIds, ["AC-3"]);
});

// Test 4: deliver blocks when UI-REF references missing file
test("deliver blocks when UI-REF references a missing file", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-smoke-ui-ref-missing-"));
  const feature = "ui-ref-missing";

  // Setup project
  setupGit(tempDir);
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["draft", "--feature", feature, "--idea", "UI traceability test", "--non-interactive", "--yes"], { cwd: tempDir });

  // Write spec with UI-REF pointing to nonexistent file
  const specWithRef = `# AF-SPEC: ${feature}

STATUS: DRAFT

## 1. Context
A feature with UI references.

## 2. Actors
- End user

## 3. Functional Rules (traceable)
- FR-1: The system must display a login form.

## 4. Edge Cases
- Missing credentials.

## 6. UI Structure

Screen: Login
┌──────────┐
│ [button: submit] │
└──────────┘

### References
- UI-REF-1: mockups/nonexistent.png → AC-1

## 7. Security Considerations
- Rate limit login attempts.

## 9. Acceptance Criteria (Given/When/Then)
- AC-1: Given the login page, when credentials are entered, then user is authenticated.
`;
  fs.writeFileSync(
    path.join(tempDir, "specs", "drafts", `${feature}.md`),
    specWithRef,
    "utf8"
  );

  runNodeOk(["approve", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["discover", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["plan", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });

  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    `{"name":"aitri-ui-smoke","private":true,"scripts":{"test:aitri":"node -e \\"process.exit(0)\\""}}`,
    "utf8"
  );

  runNodeOk(["verify", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  spawnSync("git", ["add", "-A"], { cwd: tempDir, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "ready"], { cwd: tempDir, encoding: "utf8" });
  runNodeOk(["go", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["scaffold", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["implement", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });

  // Make test stubs pass
  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  if (fs.existsSync(generatedDir)) {
    fs.readdirSync(generatedDir).filter((n) => n.endsWith(".test.mjs")).forEach((file) => {
      const abs = path.join(generatedDir, file);
      const content = fs.readFileSync(abs, "utf8");
      fs.writeFileSync(abs, content.replace(/assert\.fail\([^)]+\);/g, 'assert.ok(true, "implemented");'), "utf8");
    });
  }

  runNodeOk(["verify", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  const deliver = runNode(["deliver", "--feature", feature, "--non-interactive", "--yes", "--json"], { cwd: tempDir });
  const payload = JSON.parse(deliver.stdout);
  assert.ok(payload.blockers.some((b) => /UI-REF.*missing file/.test(b)), "Should have UI-REF blocker");
});

// Test 5: deliver passes when UI-REF file exists
test("deliver passes UI-REF validation when referenced file exists", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aitri-smoke-ui-ref-exists-"));
  const feature = "ui-ref-exists";

  setupGit(tempDir);
  runNodeOk(["init", "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["draft", "--feature", feature, "--idea", "UI traceability test", "--non-interactive", "--yes"], { cwd: tempDir });

  const specWithRef = `# AF-SPEC: ${feature}

STATUS: DRAFT

## 1. Context
A feature with UI references.

## 2. Actors
- End user

## 3. Functional Rules (traceable)
- FR-1: The system must display a login form.

## 4. Edge Cases
- Missing credentials.

## 6. UI Structure

Screen: Login
┌──────────┐
│ [button: submit] │
└──────────┘

### References
- UI-REF-1: mockups/login.png → AC-1

## 7. Security Considerations
- Rate limit login attempts.

## 9. Acceptance Criteria (Given/When/Then)
- AC-1: Given the login page, when credentials are entered, then user is authenticated.
`;
  fs.writeFileSync(
    path.join(tempDir, "specs", "drafts", `${feature}.md`),
    specWithRef,
    "utf8"
  );

  // Create the mockup file so UI-REF validation passes
  fs.mkdirSync(path.join(tempDir, "mockups"), { recursive: true });
  fs.writeFileSync(path.join(tempDir, "mockups", "login.png"), "fake-png-data", "utf8");

  runNodeOk(["approve", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["discover", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["plan", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });

  fs.writeFileSync(
    path.join(tempDir, "package.json"),
    `{"name":"aitri-ui-smoke","private":true,"scripts":{"test:aitri":"node -e \\"process.exit(0)\\""}}`,
    "utf8"
  );

  runNodeOk(["verify", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  spawnSync("git", ["add", "-A"], { cwd: tempDir, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "ready"], { cwd: tempDir, encoding: "utf8" });
  runNodeOk(["go", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["scaffold", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });
  runNodeOk(["implement", "--feature", feature, "--non-interactive", "--yes"], { cwd: tempDir });

  const generatedDir = path.join(tempDir, "tests", feature, "generated");
  if (fs.existsSync(generatedDir)) {
    fs.readdirSync(generatedDir).filter((n) => n.endsWith(".test.mjs")).forEach((file) => {
      const abs = path.join(generatedDir, file);
      const content = fs.readFileSync(abs, "utf8");
      fs.writeFileSync(abs, content.replace(/assert\.fail\([^)]+\);/g, 'assert.ok(true, "implemented");'), "utf8");
    });
  }

  runNodeOk(["verify", "--feature", feature, "--non-interactive", "--json"], { cwd: tempDir });
  const deliver = runNode(["deliver", "--feature", feature, "--non-interactive", "--yes", "--json"], { cwd: tempDir });
  const payload = JSON.parse(deliver.stdout);
  assert.ok(!payload.blockers.some((b) => /UI-REF/.test(b)), "Should have no UI-REF blockers");
  assert.ok(Array.isArray(payload.uiRefValidation));
  assert.equal(payload.uiRefValidation[0].fileExists, true);
});

// Test 6: generateTestsContent includes UI Flows section when hasUiSection is true
test("generateTestsContent includes UI Flows section when uiStructure has flows", () => {
  const parsed = parseApprovedSpec(SPEC_WITH_UI, { feature: "ui-feature" });
  const stories = [
    {
      id: "US-1",
      actor: "End user",
      capability: "authenticate via login form",
      benefit: "users can access the right capabilities safely",
      frIds: ["FR-1"],
      acIds: ["AC-1"],
      acceptance: [{ given: "valid credentials", when: "login form is submitted", then: "user sees the dashboard" }]
    }
  ];

  const result = generateTestsContent({
    feature: "ui-feature",
    parsedSpec: parsed,
    rigor: { mode: "standard", qaPolicy: "Every TC traces to FR and US." },
    qualityProfile: { id: "web", label: "Web Application" },
    stories
  });

  assert.match(result, /## UI Flows/);
  assert.match(result, /Login to Dashboard/);
  assert.match(result, /Dashboard to Settings/);
  assert.match(result, /Given user is on the Login screen/);
  assert.match(result, /Then user is navigated to the Dashboard screen/);
});

// Helper
function setupGit(tempDir) {
  spawnSync("git", ["init"], { cwd: tempDir, encoding: "utf8" });
  spawnSync("git", ["config", "user.name", "Aitri Test"], { cwd: tempDir, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "aitri@example.com"], { cwd: tempDir, encoding: "utf8" });
  fs.writeFileSync(path.join(tempDir, ".gitkeep"), "seed\n", "utf8");
  spawnSync("git", ["add", ".gitkeep"], { cwd: tempDir, encoding: "utf8" });
  spawnSync("git", ["commit", "-m", "baseline"], { cwd: tempDir, encoding: "utf8" });
}
