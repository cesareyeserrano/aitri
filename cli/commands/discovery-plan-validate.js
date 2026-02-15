import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectPersonaValidationIssues } from "./persona-validation.js";
import {
  buildSpecSnapshot,
  collectDiscoveryInterview,
  detectRetrievalModeFromDiscovery,
  getDiscoveryRigorProfile,
  normalizeDiscoveryDepth,
  normalizeRetrievalMode,
  readDiscoveryField
} from "./discovery-plan-helpers.js";

function normalizeFeatureName(value) {
  return (value || "").replace(/\s+/g, "-").trim();
}

function wantsJson(options, positional = []) {
  if (options.json) return true;
  if ((options.format || "").toLowerCase() === "json") return true;
  return positional.some((p) => p.toLowerCase() === "json");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceSection(content, heading, newBody) {
  const pattern = new RegExp(`${escapeRegExp(heading)}([\\s\\S]*?)(?=\\n##\\s+\\d+\\.|$)`, "i");
  return String(content).replace(pattern, `${heading}\n${newBody.trim()}\n`);
}

export async function runDiscoverCommand({
  options,
  ask,
  getProjectContextOrExit,
  confirmProceed,
  printCheckpointSummary,
  runAutoCheckpoint,
  exitCodes
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const project = getProjectContextOrExit();
  let feature = normalizeFeatureName(options.feature || options.positional[0]);
  if (!feature && !options.nonInteractive) {
    feature = normalizeFeatureName(await ask("Feature name (kebab-case, e.g. user-login): "));
  }

  if (!feature) {
    console.log("Feature name is required. Use --feature <name> in non-interactive mode.");
    return ERROR;
  }

  const requestedRetrievalMode = normalizeRetrievalMode(options.retrievalMode);
  if (options.retrievalMode && !requestedRetrievalMode) {
    console.log("Invalid --retrieval-mode value. Use section or semantic.");
    return ERROR;
  }
  const retrievalMode = requestedRetrievalMode || "section-level";

  const approvedFile = project.paths.approvedSpecFile(feature);
  if (!fs.existsSync(approvedFile)) {
    console.log(`Approved spec not found: ${path.relative(process.cwd(), approvedFile)}`);
    console.log("Approve the spec first: aitri approve");
    return ERROR;
  }

  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(cliDir, "..", "..", "core", "templates", "discovery", "discovery_template.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Discovery template not found at: ${templatePath}`);
    return ERROR;
  }

  const outDir = project.paths.docsDiscoveryDir;
  const backlogFile = project.paths.backlogFile(feature);
  const testsFile = project.paths.testsFile(feature);
  const backlogDir = path.dirname(backlogFile);
  const testsDir = path.dirname(testsFile);
  const outFile = project.paths.discoveryFile(feature);

  console.log("PLAN:");
  console.log("- Read: " + path.relative(process.cwd(), approvedFile));
  console.log("- Create: " + path.relative(process.cwd(), outDir));
  console.log("- Create: " + path.relative(process.cwd(), outFile));
  console.log("- Create: " + path.relative(process.cwd(), backlogDir));
  console.log("- Create: " + path.relative(process.cwd(), backlogFile));
  console.log("- Create: " + path.relative(process.cwd(), testsDir));
  console.log("- Create: " + path.relative(process.cwd(), testsFile));

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    return ERROR;
  }
  if (!proceed) {
    console.log("Aborted.");
    return ABORTED;
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(backlogDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });

  const approvedSpec = fs.readFileSync(approvedFile, "utf8");
  const specSnapshot = buildSpecSnapshot(approvedSpec, retrievalMode);
  let discoveryInterview;
  try {
    discoveryInterview = await collectDiscoveryInterview(options, ask);
  } catch (error) {
    console.log(error instanceof Error ? error.message : "Discovery interview failed.");
    return ERROR;
  }
  const confidence = (() => {
    if (
      [discoveryInterview.primaryUsers, discoveryInterview.currentPain, discoveryInterview.successMetrics]
        .some((v) => /TBD|Not specified|pending/i.test(v))
    ) {
      return {
        level: "Low",
        reason: "Critical discovery inputs are missing or too generic.",
        handoff: "Blocked for Clarification"
      };
    }
    if (
      [discoveryInterview.jtbd, discoveryInterview.constraints, discoveryInterview.dependencies, discoveryInterview.assumptions]
        .some((v) => /TBD|Not specified|pending/i.test(v))
    ) {
      return {
        level: "Medium",
        reason: "Discovery is usable but still has notable evidence gaps.",
        handoff: "Ready for Product/Architecture"
      };
    }
    return {
      level: "High",
      reason: "Discovery inputs are specific and decision-ready.",
      handoff: "Ready for Product/Architecture"
    };
  })();
  if (discoveryInterview.interviewMode === "quick" && confidence.level !== "Low") {
    confidence.reason = `${confidence.reason} Interview used quick mode; expand to standard/deep if uncertainty remains.`;
  }
  let discovery = fs.readFileSync(templatePath, "utf8");

  discovery = discovery.replace("# Discovery: <feature>", `# Discovery: ${feature}`);
  discovery = discovery.replace(
    "## 1. Problem Statement\n- What problem are we solving?\n- Why now?",
    `## 1. Problem Statement
Derived from approved spec retrieval snapshot:
- Retrieval mode: ${specSnapshot.mode}
- Retrieved sections: ${specSnapshot.retrievalEvidence.length > 0 ? specSnapshot.retrievalEvidence.join(", ") : "none"}

### Context snapshot
${specSnapshot.context}

### Actors snapshot
${specSnapshot.actors}

### Functional rules snapshot
${specSnapshot.functionalRules}

### Security snapshot
${specSnapshot.security}

### Out-of-scope snapshot
${specSnapshot.outOfScope}

Refined problem framing:
- What problem are we solving? ${discoveryInterview.currentPain}
- Why now? ${discoveryInterview.successMetrics}`
  );
  discovery = discovery.replace(
    "## 2. Discovery Interview Summary (Discovery Persona)\n- Primary users:\n-\n- Jobs to be done:\n-\n- Current pain:\n-\n- Constraints (business/technical/compliance):\n-\n- Dependencies:\n-\n- Success metrics:\n-\n- Assumptions:\n-",
    `## 2. Discovery Interview Summary (Discovery Persona)\n- Primary users:\n- ${discoveryInterview.primaryUsers}\n\n- Jobs to be done:\n- ${discoveryInterview.jtbd}\n\n- Current pain:\n- ${discoveryInterview.currentPain}\n\n- Constraints (business/technical/compliance):\n- ${discoveryInterview.constraints}\n\n- Dependencies:\n- ${discoveryInterview.dependencies}\n\n- Success metrics:\n- ${discoveryInterview.successMetrics}\n\n- Assumptions:\n- ${discoveryInterview.assumptions}\n\n- Interview mode:\n- ${discoveryInterview.interviewMode}`
  );
  discovery = discovery.replace(
    "## 3. Scope\n### In scope\n-\n\n### Out of scope\n-",
    `## 3. Scope\n### In scope\n- ${discoveryInterview.inScope}\n\n### Out of scope\n- ${discoveryInterview.outOfScope}`
  );
  discovery = discovery.replace(
    "## 4. Actors & User Journeys\nActors:\n-\n\nPrimary journey:\n-",
    `## 4. Actors & User Journeys\nActors:\n- ${discoveryInterview.primaryUsers}\n\nPrimary journey:\n- ${discoveryInterview.journey}`
  );
  discovery = discovery.replace(
    "## 9. Discovery Confidence\n- Confidence:\n-\n- Reason:\n-\n- Evidence gaps:\n-\n- Handoff decision:\n-",
    `## 9. Discovery Confidence\n- Confidence:\n- ${confidence.level}\n\n- Reason:\n- ${confidence.reason}\n\n- Evidence gaps:\n- ${discoveryInterview.assumptions}\n\n- Handoff decision:\n- ${confidence.handoff}`
  );

  fs.writeFileSync(outFile, discovery, "utf8");
  const backlog = `# Backlog: ${feature}

## Epic
- <one epic statement>

## User Stories
1. As a <actor>, I want <capability>, so that <benefit>.
2. As a <actor>, I want <capability>, so that <benefit>.
3. As a <actor>, I want <capability>, so that <benefit>.
`;

  const tests = `# Test Cases: ${feature}

## Functional
1. Given <context>, when <action>, then <expected>.

## Security
1. Input validation: reject invalid/unsafe inputs.
2. Abuse prevention: rate limit critical endpoints (if any).

## Edge Cases
1. <edge case> -> <expected behavior>
`;

  fs.writeFileSync(backlogFile, backlog, "utf8");
  fs.writeFileSync(testsFile, tests, "utf8");

  console.log("Discovery created: " + path.relative(process.cwd(), outFile));
  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "discover",
    feature
  }));
  return OK;
}

export async function runPlanCommand({
  options,
  ask,
  getProjectContextOrExit,
  confirmProceed,
  printCheckpointSummary,
  runAutoCheckpoint,
  exitCodes
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const project = getProjectContextOrExit();
  let feature = normalizeFeatureName(options.feature || options.positional[0]);
  if (!feature && !options.nonInteractive) {
    feature = normalizeFeatureName(await ask("Feature name (kebab-case, e.g. user-login): "));
  }

  if (!feature) {
    console.log("Feature name is required. Use --feature <name> in non-interactive mode.");
    return ERROR;
  }

  const requestedRetrievalMode = normalizeRetrievalMode(options.retrievalMode);
  if (options.retrievalMode && !requestedRetrievalMode) {
    console.log("Invalid --retrieval-mode value. Use section or semantic.");
    return ERROR;
  }

  const approvedFile = project.paths.approvedSpecFile(feature);
  const discoveryFile = project.paths.discoveryFile(feature);
  if (!fs.existsSync(approvedFile)) {
    console.log(`Approved spec not found: ${path.relative(process.cwd(), approvedFile)}`);
    console.log("Approve the spec first: aitri approve");
    return ERROR;
  }
  if (!fs.existsSync(discoveryFile)) {
    console.log(`Discovery artifact not found: ${path.relative(process.cwd(), discoveryFile)}`);
    console.log("Run discovery first: aitri discover --feature <name>");
    return ERROR;
  }
  const discoveryContent = fs.readFileSync(discoveryFile, "utf8");
  const requiredDiscoverySections = [
    "## 2. Discovery Interview Summary (Discovery Persona)",
    "## 3. Scope",
    "## 9. Discovery Confidence"
  ];
  const missingDiscoverySections = requiredDiscoverySections.filter((section) => !discoveryContent.includes(section));
  if (missingDiscoverySections.length > 0) {
    console.log("PLAN BLOCKED: Discovery artifact is missing required sections.");
    missingDiscoverySections.forEach((section) => console.log(`- Missing: ${section}`));
    console.log("Re-run discovery with the latest template before planning.");
    return ERROR;
  }
  const lowConfidence = /- Confidence:\s*\n-\s*Low\b/i.test(discoveryContent);
  if (lowConfidence) {
    console.log("PLAN BLOCKED: Discovery confidence is Low.");
    console.log("Address discovery evidence gaps and re-run `aitri discover --guided` before planning.");
    return ERROR;
  }

  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(cliDir, "..", "..", "core", "templates", "plan", "plan_template.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Plan template not found at: ${templatePath}`);
    return ERROR;
  }

  const architectPersona = path.resolve(cliDir, "..", "..", "core", "personas", "architect.md");
  const securityPersona = path.resolve(cliDir, "..", "..", "core", "personas", "security.md");
  const productPersona = path.resolve(cliDir, "..", "..", "core", "personas", "product.md");
  const developerPersona = path.resolve(cliDir, "..", "..", "core", "personas", "developer.md");
  const uxUiPersona = path.resolve(cliDir, "..", "..", "core", "personas", "ux-ui.md");
  const qaPersona = path.resolve(cliDir, "..", "..", "core", "personas", "qa.md");

  const outPlanDir = project.paths.docsPlanDir;
  const outPlanFile = project.paths.planFile(feature);
  const backlogFile = project.paths.backlogFile(feature);
  const testsFile = project.paths.testsFile(feature);

  console.log("PLAN:");
  console.log("- Read: " + path.relative(process.cwd(), approvedFile));
  console.log("- Read: " + path.relative(process.cwd(), templatePath));
  console.log("- Read: " + (fs.existsSync(productPersona) ? productPersona : "core/personas/product.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(architectPersona) ? architectPersona : "core/personas/architect.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(developerPersona) ? developerPersona : "core/personas/developer.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(uxUiPersona) ? uxUiPersona : "core/personas/ux-ui.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(securityPersona) ? securityPersona : "core/personas/security.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(qaPersona) ? qaPersona : "core/personas/qa.md (missing in repo)"));
  console.log("- Create: " + path.relative(process.cwd(), outPlanDir));
  console.log("- Write: " + path.relative(process.cwd(), outPlanFile));
  console.log("- Write: " + path.relative(process.cwd(), backlogFile));
  console.log("- Write: " + path.relative(process.cwd(), testsFile));

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    return ERROR;
  }
  if (!proceed) {
    console.log("Aborted.");
    return ABORTED;
  }

  fs.mkdirSync(outPlanDir, { recursive: true });
  fs.mkdirSync(path.dirname(backlogFile), { recursive: true });
  fs.mkdirSync(path.dirname(testsFile), { recursive: true });

  const approvedSpec = fs.readFileSync(approvedFile, "utf8");
  const discoveryDoc = fs.readFileSync(discoveryFile, "utf8");
  const inheritedRetrievalMode = detectRetrievalModeFromDiscovery(discoveryDoc);
  const retrievalMode = requestedRetrievalMode || inheritedRetrievalMode || "section-level";
  const specSnapshot = buildSpecSnapshot(approvedSpec, retrievalMode);
  let planDoc = fs.readFileSync(templatePath, "utf8");

  planDoc = planDoc.replace("# Plan: <feature>", `# Plan: ${feature}`);
  planDoc = planDoc.replace(
    "## 1. Intent (from approved spec)",
    `## 1. Intent (from approved spec)
- Retrieval mode: section-level

### Context snapshot
${specSnapshot.context}

### Actors snapshot
${specSnapshot.actors}

### Functional rules snapshot
${specSnapshot.functionalRules}

### Acceptance criteria snapshot
${specSnapshot.acceptanceCriteria}

### Security snapshot
${specSnapshot.security}

### Out-of-scope snapshot
${specSnapshot.outOfScope}

### Retrieval metadata
- Retrieval mode: ${specSnapshot.mode}
- Retrieved sections: ${specSnapshot.retrievalEvidence.length > 0 ? specSnapshot.retrievalEvidence.join(", ") : "none"}`
  );

  const frList = [...approvedSpec.matchAll(/- FR-\d+:\s*(.+)/g)].map((m) => m[1].trim());
  const coreRule = frList[0] || "Deliver the approved feature scope with traceability.";
  const supportingRule = frList[1] || coreRule;
  const discoveryPain = readDiscoveryField(discoveryDoc, "Current pain") || "Pain evidence must be validated in discovery refinement.";
  const discoveryMetric = readDiscoveryField(discoveryDoc, "Success metrics") || "Define baseline and target KPI before implementation.";
  const discoveryAssumptions = readDiscoveryField(discoveryDoc, "Assumptions") || "Explicit assumptions pending validation with product and architecture.";
  const discoveryDependencies = readDiscoveryField(discoveryDoc, "Dependencies") || "External dependencies to be confirmed.";
  const discoveryConstraints = readDiscoveryField(discoveryDoc, "Constraints (business/technical/compliance)") || "Constraints to be confirmed.";
  const discoveryInterviewMode = normalizeDiscoveryDepth(readDiscoveryField(discoveryDoc, "Interview mode")) || "quick";
  const rigor = getDiscoveryRigorProfile(discoveryInterviewMode);

  planDoc = replaceSection(
    planDoc,
    "## 2. Discovery Review (Discovery Persona)",
    `### Problem framing
- ${discoveryPain}
- Core rule to preserve: ${coreRule}

### Constraints and dependencies
- Constraints: ${discoveryConstraints}
- Dependencies: ${discoveryDependencies}

### Success metrics
- ${discoveryMetric}

### Key assumptions
- ${discoveryAssumptions}

### Discovery rigor profile
- Discovery interview mode: ${rigor.mode}
- Planning policy: ${rigor.planningPolicy}
- Follow-up gate: ${rigor.followUpGate}`
  );

  planDoc = replaceSection(
    planDoc,
    "## 4. Product Review (Product Persona)",
    `### Business value
- Address user pain by enforcing: ${coreRule}
- Secondary value from supporting rule: ${supportingRule}

### Success metric
- Primary KPI: ${discoveryMetric}
- Ship only if metric has baseline and target.

### Assumptions to validate
- ${discoveryAssumptions}
- Validate dependency and constraint impact before implementation start.
- Discovery rigor policy: ${rigor.followUpGate}`
  );

  planDoc = replaceSection(
    planDoc,
    "## 5. Architecture (Architect Persona)",
    `### Components
- Client or entry interface for ${feature}.
- Application service implementing FR traceability.
- Persistence/integration boundary for state and external dependencies.

### Data flow
- Request enters through interface layer.
- Application service validates input, enforces rules, and coordinates dependencies.
- Results are persisted and returned with deterministic error handling.

### Key decisions
- Preserve spec traceability from FR/AC to backlog/tests.
- Keep interfaces explicit to reduce hidden coupling.
- Prefer observable failure modes over silent degradation.

### Risks & mitigations
- Dependency instability risk: add timeouts/retries and fallback behavior.
- Constraint mismatch risk: validate assumptions before rollout.
- Scope drift risk: block changes outside approved spec.

### Observability (logs/metrics/tracing)
- Logs: authentication and error events with correlation IDs.
- Metrics: success rate, latency, and failure-rate by endpoint/use case.
- Tracing: end-to-end request trace across internal and external calls.`
  );

  fs.writeFileSync(outPlanFile, planDoc, "utf8");

  const backlog = `# Backlog: ${feature}

> Generated by \`aitri plan\`.
> Spec-driven rule: every story MUST reference one or more Functional Rules (FR-*) and, when applicable, Acceptance Criteria (AC-*).
> Discovery rigor profile: ${rigor.mode}.
> Planning rule: ${rigor.backlogPolicy}

## Epics
- EP-1: <epic outcome>
  - Notes:
  - Trace: FR-?, FR-?
- EP-2: <epic outcome>
  - Notes:
  - Trace: FR-?, FR-?

## User Stories

### US-1
- As a <actor>, I want <capability>, so that <benefit>.
- Trace: FR-?, AC-?
- Acceptance Criteria:
  - Given ..., when ..., then ...
  - Given ..., when ..., then ...

### US-2
- As a <actor>, I want <capability>, so that <benefit>.
- Trace: FR-?, AC-?
- Acceptance Criteria:
  - Given ..., when ..., then ...

(repeat as needed)
`;
  const tests = `# Test Cases: ${feature}

> Generated by \`aitri plan\`.
> Spec-driven rule: every test MUST trace to a User Story (US-*) and one or more Functional Rules (FR-*). Include AC-* when applicable.
> Discovery rigor profile: ${rigor.mode}.
> QA rule: ${rigor.qaPolicy}

## Functional

### TC-1
- Title: <what is being validated>
- Trace: US-?, FR-?, AC-?
- Steps:
  1) Given <context>
  2) When <action>
  3) Then <expected>

## Negative / Abuse

### TC-2
- Title: <invalid input or abuse scenario>
- Trace: US-?, FR-?
- Steps:
  1) Given <invalid context>
  2) When <action>
  3) Then <rejected with clear error>

## Security

### TC-3
- Title: <security control validation>
- Trace: US-?, FR-?
- Steps:
  1) Given <threat scenario>
  2) When <attempt>
  3) Then <blocked/logged/limited>

## Edge Cases

### TC-4
- Title: <edge case>
- Trace: US-?, FR-?
- Steps:
  1) Given <edge context>
  2) When <action>
  3) Then <expected>
`;

  fs.writeFileSync(backlogFile, backlog, "utf8");
  fs.writeFileSync(testsFile, tests, "utf8");

  console.log("Plan created: " + path.relative(process.cwd(), outPlanFile));
  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "plan",
    feature
  }));
  return OK;
}

export async function runValidateCommand({
  options,
  ask,
  getProjectContextOrExit,
  exitCodes
}) {
  const { OK, ERROR } = exitCodes;
  const project = getProjectContextOrExit();
  const validatePositional = [...options.positional];
  const jsonOutput = wantsJson(options, validatePositional);
  if (validatePositional.length > 0 && validatePositional[validatePositional.length - 1].toLowerCase() === "json") {
    validatePositional.pop();
  }

  let feature = normalizeFeatureName(options.feature || validatePositional[0]);
  if (!feature && !options.nonInteractive) {
    feature = normalizeFeatureName(await ask("Feature name (kebab-case, e.g. user-login): "));
  }

  if (!feature) {
    const msg = "Feature name is required. Use --feature <name> in non-interactive mode.";
    if (jsonOutput) {
      console.log(JSON.stringify({
        ok: false,
        feature: null,
        issues: [msg],
        gaps: {
          usage: [msg]
        }
      }, null, 2));
    } else {
      console.log(msg);
    }
    return ERROR;
  }

  const approvedFile = project.paths.approvedSpecFile(feature);
  const backlogFile = project.paths.backlogFile(feature);
  const testsFile = project.paths.testsFile(feature);
  const discoveryFile = project.paths.discoveryFile(feature);
  const planFile = project.paths.planFile(feature);

  const issues = [];
  const gapTypes = {
    missing_artifact: [],
    structure: [],
    placeholder: [],
    persona: [],
    coverage_fr_us: [],
    coverage_fr_tc: [],
    coverage_us_tc: []
  };
  const addIssue = (type, message) => {
    issues.push(message);
    if (gapTypes[type]) gapTypes[type].push(message);
  };
  const result = {
    ok: false,
    feature,
    files: {
      spec: path.relative(process.cwd(), approvedFile),
      backlog: path.relative(process.cwd(), backlogFile),
      tests: path.relative(process.cwd(), testsFile),
      discovery: path.relative(process.cwd(), discoveryFile),
      plan: path.relative(process.cwd(), planFile)
    },
    coverage: {
      specFr: 0,
      backlogFr: 0,
      testsFr: 0,
      backlogUs: 0,
      testsUs: 0
    },
    gaps: gapTypes,
    gapSummary: {},
    issues
  };

  if (!fs.existsSync(approvedFile)) {
    addIssue("missing_artifact", `Missing approved spec: ${path.relative(process.cwd(), approvedFile)}`);
  }
  if (!fs.existsSync(backlogFile)) {
    addIssue("missing_artifact", `Missing backlog: ${path.relative(process.cwd(), backlogFile)}`);
  }
  if (!fs.existsSync(testsFile)) {
    addIssue("missing_artifact", `Missing tests: ${path.relative(process.cwd(), testsFile)}`);
  }

  result.gapSummary = Object.fromEntries(Object.entries(gapTypes).map(([k, v]) => [k, v.length]));

  if (issues.length > 0) {
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("VALIDATION FAILED:");
      issues.forEach(i => console.log("- " + i));
    }
    return ERROR;
  }

  const spec = fs.readFileSync(approvedFile, "utf8");
  const backlog = fs.readFileSync(backlogFile, "utf8");
  const tests = fs.readFileSync(testsFile, "utf8");

  if (!/###\s+US-\d+/m.test(backlog)) {
    addIssue("structure", "Backlog must include at least one user story with an ID like `### US-1`.");
  }
  if (backlog.includes("FR-?")) {
    addIssue("placeholder", "Backlog contains placeholder `FR-?`. Replace with real Functional Rule IDs (FR-1, FR-2...).");
  }
  if (backlog.includes("AC-?")) {
    addIssue("placeholder", "Backlog contains placeholder `AC-?`. Replace with real Acceptance Criteria IDs (AC-1, AC-2...).");
  }

  if (!/###\s+TC-\d+/m.test(tests)) {
    addIssue("structure", "Tests must include at least one test case with an ID like `### TC-1`.");
  }
  if (tests.includes("US-?")) {
    addIssue("placeholder", "Tests contain placeholder `US-?`. Replace with real User Story IDs (US-1, US-2...).");
  }
  if (tests.includes("FR-?")) {
    addIssue("placeholder", "Tests contain placeholder `FR-?`. Replace with real Functional Rule IDs (FR-1, FR-2...).");
  }
  if (tests.includes("AC-?")) {
    addIssue("placeholder", "Tests contain placeholder `AC-?`. Replace with real Acceptance Criteria IDs (AC-1, AC-2...).");
  }

  result.gapSummary = Object.fromEntries(Object.entries(gapTypes).map(([k, v]) => [k, v.length]));

  if (issues.length > 0) {
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("VALIDATION FAILED:");
      issues.forEach(i => console.log("- " + i));
    }
    return ERROR;
  }

  const specFRs = [...spec.matchAll(/\bFR-\d+\b/g)].map(m => m[0]);
  const backlogFRs = new Set([...backlog.matchAll(/\bFR-\d+\b/g)].map(m => m[0]));

  const missingFRCoverage = [...new Set(specFRs)].filter(fr => !backlogFRs.has(fr));
  missingFRCoverage.forEach(fr =>
    addIssue("coverage_fr_us", `Coverage: ${fr} is defined in spec but not referenced in backlog user stories.`)
  );

  const testsFRs = new Set([...tests.matchAll(/\bFR-\d+\b/g)].map(m => m[0]));
  const missingFRTestsCoverage = [...new Set(specFRs)].filter(fr => !testsFRs.has(fr));
  missingFRTestsCoverage.forEach(fr =>
    addIssue("coverage_fr_tc", `Coverage: ${fr} is defined in spec but not referenced in tests.`)
  );

  const backlogUS = [...backlog.matchAll(/\bUS-\d+\b/g)].map(m => m[0]);
  const testsUS = new Set([...tests.matchAll(/\bUS-\d+\b/g)].map(m => m[0]));

  const missingUSCoverage = [...new Set(backlogUS)].filter(us => !testsUS.has(us));
  missingUSCoverage.forEach(us =>
    addIssue("coverage_us_tc", `Coverage: ${us} exists in backlog but is not referenced in tests.`)
  );

  result.coverage.specFr = new Set(specFRs).size;
  result.coverage.backlogFr = backlogFRs.size;
  result.coverage.testsFr = testsFRs.size;
  result.coverage.backlogUs = new Set(backlogUS).size;
  result.coverage.testsUs = testsUS.size;

  if (fs.existsSync(discoveryFile) && fs.existsSync(planFile)) {
    const discoveryContent = fs.readFileSync(discoveryFile, "utf8");
    const planContent = fs.readFileSync(planFile, "utf8");
    const personaIssues = collectPersonaValidationIssues({ discoveryContent, planContent });
    personaIssues.forEach((issue) => addIssue("persona", issue));
  }

  result.gapSummary = Object.fromEntries(Object.entries(gapTypes).map(([k, v]) => [k, v.length]));

  if (issues.length > 0) {
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("VALIDATION FAILED:");
      issues.forEach((i) => console.log("- " + i));
    }
    return ERROR;
  }

  result.ok = true;
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log("VALIDATION PASSED ✅");
    console.log("- Spec: " + path.relative(process.cwd(), approvedFile));
    console.log("- Backlog: " + path.relative(process.cwd(), backlogFile));
    console.log("- Tests: " + path.relative(process.cwd(), testsFile));
  }
  return OK;
}
