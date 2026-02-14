import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { loadAitriConfig, resolveProjectPaths } from "../config.js";

function exists(p) {
  return fs.existsSync(p);
}

function listMd(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
}

function firstOrNull(arr) {
  return arr.length > 0 ? arr[0] : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSection(content, heading) {
  const pattern = new RegExp(`${escapeRegExp(heading)}([\\s\\S]*?)(?=\\n##\\s+\\d+\\.|$)`, "i");
  const match = content.match(pattern);
  return match ? match[1] : "";
}

function getSubsection(content, heading) {
  const pattern = new RegExp(`${escapeRegExp(heading)}([\\s\\S]*?)(?=\\n###\\s+|$)`, "i");
  const match = content.match(pattern);
  return match ? match[1] : "";
}

function hasMeaningfulContent(content) {
  const lines = String(content)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.some((line) => {
    if (/^###\s+/.test(line)) return false;
    const cleaned = line
      .replace(/^[-*]\s*/, "")
      .replace(/^\d+\)\s*/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();
    if (!cleaned || cleaned === "-") return false;
    if (cleaned.length < 6) return false;
    if (/^<.*>$/.test(cleaned)) return false;
    if (/\b(TBD|Not specified|pending|to be refined|to be confirmed)\b/i.test(cleaned)) return false;
    return true;
  });
}

function collectPersonaIssues(discovery, plan) {
  const issues = [];

  if (discovery) {
    const discoveryInterview = getSection(discovery, "## 2. Discovery Interview Summary (Discovery Persona)");
    if (!discoveryInterview) {
      issues.push("Persona gate: Discovery section is missing `## 2. Discovery Interview Summary (Discovery Persona)`.");
    } else if (!hasMeaningfulContent(discoveryInterview)) {
      issues.push("Persona gate: Discovery interview summary is unresolved.");
    }

    const discoveryConfidence = getSection(discovery, "## 9. Discovery Confidence");
    if (!discoveryConfidence) {
      issues.push("Persona gate: Discovery section is missing `## 9. Discovery Confidence`.");
    } else if (/- Confidence:\s*\n-\s*Low\b/i.test(discoveryConfidence)) {
      issues.push("Persona gate: Discovery confidence is Low. Resolve evidence gaps before handoff.");
    }
  }

  if (plan) {
    const product = getSection(plan, "## 4. Product Review (Product Persona)");
    if (!product) {
      issues.push("Persona gate: Plan is missing `## 4. Product Review (Product Persona)`.");
    } else {
      const businessValue = getSubsection(product, "### Business value");
      const successMetric = getSubsection(product, "### Success metric");
      const assumptions = getSubsection(product, "### Assumptions to validate");
      if (!hasMeaningfulContent(businessValue)) issues.push("Persona gate: Product `Business value` is unresolved.");
      if (!hasMeaningfulContent(successMetric)) issues.push("Persona gate: Product `Success metric` is unresolved.");
      if (!hasMeaningfulContent(assumptions)) issues.push("Persona gate: Product `Assumptions to validate` is unresolved.");
    }

    const architecture = getSection(plan, "## 5. Architecture (Architect Persona)");
    if (!architecture) {
      issues.push("Persona gate: Plan is missing `## 5. Architecture (Architect Persona)`.");
    } else {
      const components = getSubsection(architecture, "### Components");
      const dataFlow = getSubsection(architecture, "### Data flow");
      const keyDecisions = getSubsection(architecture, "### Key decisions");
      const risks = getSubsection(architecture, "### Risks & mitigations");
      const observability = getSubsection(architecture, "### Observability (logs/metrics/tracing)");
      if (!hasMeaningfulContent(components)) issues.push("Persona gate: Architect `Components` is unresolved.");
      if (!hasMeaningfulContent(dataFlow)) issues.push("Persona gate: Architect `Data flow` is unresolved.");
      if (!hasMeaningfulContent(keyDecisions)) issues.push("Persona gate: Architect `Key decisions` is unresolved.");
      if (!hasMeaningfulContent(risks)) issues.push("Persona gate: Architect `Risks & mitigations` is unresolved.");
      if (!hasMeaningfulContent(observability)) issues.push("Persona gate: Architect `Observability` is unresolved.");
    }
  }

  return issues;
}

function collectValidationIssues(spec, backlog, tests, discovery = "", plan = "") {
  const issues = [];

  if (!/###\s+US-\d+/m.test(backlog)) {
    issues.push("Backlog must include at least one user story with an ID like `### US-1`.");
  }
  if (backlog.includes("FR-?")) {
    issues.push("Backlog contains placeholder `FR-?`.");
  }
  if (backlog.includes("AC-?")) {
    issues.push("Backlog contains placeholder `AC-?`.");
  }

  if (!/###\s+TC-\d+/m.test(tests)) {
    issues.push("Tests must include at least one test case with an ID like `### TC-1`.");
  }
  if (tests.includes("US-?")) {
    issues.push("Tests contain placeholder `US-?`.");
  }
  if (tests.includes("FR-?")) {
    issues.push("Tests contain placeholder `FR-?`.");
  }
  if (tests.includes("AC-?")) {
    issues.push("Tests contain placeholder `AC-?`.");
  }

  const specFRs = [...new Set([...spec.matchAll(/\bFR-\d+\b/g)].map((m) => m[0]))];
  const backlogFRs = new Set([...backlog.matchAll(/\bFR-\d+\b/g)].map((m) => m[0]));
  const testsFRs = new Set([...tests.matchAll(/\bFR-\d+\b/g)].map((m) => m[0]));

  const backlogUS = [...new Set([...backlog.matchAll(/\bUS-\d+\b/g)].map((m) => m[0]))];
  const testsUS = new Set([...tests.matchAll(/\bUS-\d+\b/g)].map((m) => m[0]));

  for (const fr of specFRs) {
    if (!backlogFRs.has(fr)) {
      issues.push(`Coverage: ${fr} is defined in spec but not referenced in backlog user stories.`);
    }
    if (!testsFRs.has(fr)) {
      issues.push(`Coverage: ${fr} is defined in spec but not referenced in tests.`);
    }
  }

  for (const us of backlogUS) {
    if (!testsUS.has(us)) {
      issues.push(`Coverage: ${us} exists in backlog but is not referenced in tests.`);
    }
  }

  if (discovery || plan) {
    collectPersonaIssues(discovery, plan).forEach((issue) => issues.push(issue));
  }

  return issues;
}

function computeNextStep({ missingDirs, approvedSpecFound, discoveryExists, planExists, validateOk, verifyOk }) {
  if (missingDirs.length > 0) return "aitri init";
  if (!approvedSpecFound) return "aitri draft";
  if (!discoveryExists) return "aitri discover";
  if (!planExists) return "aitri plan";
  if (!validateOk) return "aitri validate";
  if (!verifyOk) return "aitri verify";
  return "ready_for_human_approval";
}

function toRecommendedCommand(nextStep) {
  if (!nextStep) return null;
  if (nextStep === "ready_for_human_approval") return "aitri handoff";
  return nextStep;
}

function nextStepMessage(nextStep) {
  if (!nextStep) return "No next step detected.";
  if (nextStep === "ready_for_human_approval") {
    return "SDLC artifacts are complete. Human go/no-go approval is required.";
  }
  return `Continue SDLC flow with ${nextStep}.`;
}

function readGit(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function detectCheckpointState(root) {
  const insideWorkTree = readGit("git rev-parse --is-inside-work-tree", root) === "true";
  if (!insideWorkTree) {
    return {
      git: false,
      detected: false,
      latestCommit: null,
      latestStash: null,
      resumeDecision: "no_checkpoint_detected",
      prompt: "No checkpoint was detected."
    };
  }

  const latestCommitRaw = readGit("git log --grep='^checkpoint:' --pretty=format:'%h|%cI|%s' -n 1", root);
  const latestCommit = latestCommitRaw
    ? (() => {
      const [hash, timestamp, message] = latestCommitRaw.split("|");
      return { hash, timestamp, message };
    })()
    : null;

  const stashLines = readGit("git stash list --format='%gd|%gs'", root)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /\|checkpoint:/i.test(line));
  const latestStash = stashLines[0]
    ? (() => {
      const [ref, message] = stashLines[0].split("|");
      return { ref, message };
    })()
    : null;

  const detected = !!latestCommit || !!latestStash;
  const managedTagsRaw = readGit("git tag --list 'aitri-checkpoint/*' --sort=-creatordate", root);
  const managedTags = managedTagsRaw
    ? managedTagsRaw.split("\n").map((line) => line.trim()).filter(Boolean)
    : [];
  return {
    git: true,
    detected,
    mode: "git_commit+tag",
    maxRetained: 10,
    managedCount: managedTags.length,
    latestManaged: managedTags.slice(0, 3),
    latestCommit,
    latestStash,
    resumeDecision: detected ? "ask_user_resume_from_checkpoint" : "no_checkpoint_detected",
    prompt: detected
      ? "Checkpoint detected. Ask user whether to continue from this checkpoint before any write action."
      : "No checkpoint was detected."
  };
}

function safeStatMs(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

function detectVerificationState(root, paths, feature) {
  const verificationFile = paths.verificationFile(feature);
  if (!exists(verificationFile)) {
    return {
      required: true,
      found: false,
      ok: false,
      stale: false,
      status: "missing",
      file: path.relative(root, verificationFile),
      reason: "no_verification_evidence"
    };
  }

  let payload;
  try {
    payload = JSON.parse(fs.readFileSync(verificationFile, "utf8"));
  } catch {
    return {
      required: true,
      found: true,
      ok: false,
      stale: false,
      status: "invalid",
      file: path.relative(root, verificationFile),
      reason: "invalid_verification_evidence"
    };
  }

  const inputs = [
    paths.approvedSpecFile(feature),
    paths.discoveryFile(feature),
    paths.planFile(feature),
    paths.backlogFile(feature),
    paths.testsFile(feature)
  ];
  const latestInputMs = Math.max(0, ...inputs.map((file) => safeStatMs(file)));
  const verifiedAtMs = Number.isFinite(Date.parse(payload.finishedAt || ""))
    ? Date.parse(payload.finishedAt)
    : safeStatMs(verificationFile);
  const stale = latestInputMs > verifiedAtMs;
  const ok = payload.ok === true && !stale;

  return {
    required: true,
    found: true,
    ok,
    stale,
    status: stale ? "stale" : (payload.ok ? "passed" : "failed"),
    file: path.relative(root, verificationFile),
    command: payload.command || null,
    exitCode: typeof payload.exitCode === "number" ? payload.exitCode : null,
    finishedAt: payload.finishedAt || null,
    reason: stale ? "verification_stale" : (payload.reason || null)
  };
}

export function getStatusReport(options = {}) {
  const { root = process.cwd() } = options;
  const config = loadAitriConfig(root);
  const paths = resolveProjectPaths(root, config.paths);

  const requiredDirs = [
    { key: "specs", rel: config.paths.specs, abs: paths.specsRoot },
    { key: "backlog", rel: config.paths.backlog, abs: paths.backlogRoot },
    { key: "tests", rel: config.paths.tests, abs: paths.testsRoot },
    { key: "docs", rel: config.paths.docs, abs: paths.docsRoot }
  ];
  const missingDirs = requiredDirs.filter((d) => !exists(d.abs)).map((d) => d.rel);

  const approvedDir = paths.specsApprovedDir;
  const approvedSpecs = listMd(approvedDir);
  const approvedSpecFile = firstOrNull(approvedSpecs);

  const report = {
    root,
    config: {
      loaded: config.loaded,
      file: config.file,
      paths: { ...config.paths }
    },
    structure: {
      ok: missingDirs.length === 0,
      missingDirs
    },
    approvedSpec: {
      found: !!approvedSpecFile,
      feature: approvedSpecFile ? approvedSpecFile.replace(".md", "") : null,
      file: approvedSpecFile ? path.relative(root, path.join(approvedDir, approvedSpecFile)) : null
    },
    artifacts: {
      discovery: false,
      plan: false,
      backlog: false,
      tests: false
    },
    validation: {
      ok: false,
      issues: []
    },
    verification: {
      required: true,
      found: false,
      ok: false,
      stale: false,
      status: "missing",
      file: null,
      reason: "no_feature_context"
    },
    checkpoint: {
      recommended: true,
      command: "git add -A && git commit -m \"checkpoint: <feature-or-stage>\"",
      fallback: "git stash push -m \"checkpoint: <feature-or-stage>\"",
      state: detectCheckpointState(root)
    },
    resume: {
      command: "aitri resume",
      rule: "Run resume first, then follow recommendedCommand (or nextStep in JSON mode)."
    },
    handoff: {
      required: false,
      state: "in_progress",
      message: "Continue with nextStep.",
      nextActions: []
    },
    nextStep: null,
    recommendedCommand: null,
    nextStepMessage: null
  };

  if (approvedSpecFile) {
    const feature = report.approvedSpec.feature;
    const discoveryFile = paths.discoveryFile(feature);
    const planFile = paths.planFile(feature);
    const backlogFile = paths.backlogFile(feature);
    const testsFile = paths.testsFile(feature);
    const specFile = paths.approvedSpecFile(feature);

    report.artifacts.discovery = exists(discoveryFile);
    report.artifacts.plan = exists(planFile);
    report.artifacts.backlog = exists(backlogFile);
    report.artifacts.tests = exists(testsFile);

    if (exists(specFile) && exists(backlogFile) && exists(testsFile)) {
      const spec = fs.readFileSync(specFile, "utf8");
      const backlog = fs.readFileSync(backlogFile, "utf8");
      const tests = fs.readFileSync(testsFile, "utf8");
      const discovery = exists(discoveryFile) ? fs.readFileSync(discoveryFile, "utf8") : "";
      const plan = exists(planFile) ? fs.readFileSync(planFile, "utf8") : "";

      report.validation.issues = collectValidationIssues(spec, backlog, tests, discovery, plan);
      report.validation.ok = report.validation.issues.length === 0;
    } else {
      if (!exists(specFile)) report.validation.issues.push(`Missing approved spec: ${path.relative(root, specFile)}`);
      if (!exists(backlogFile)) report.validation.issues.push(`Missing backlog: ${path.relative(root, backlogFile)}`);
      if (!exists(testsFile)) report.validation.issues.push(`Missing tests: ${path.relative(root, testsFile)}`);
      report.validation.ok = false;
    }

    report.verification = detectVerificationState(root, paths, feature);

    report.nextStep = computeNextStep({
      missingDirs,
      approvedSpecFound: true,
      discoveryExists: report.artifacts.discovery,
      planExists: report.artifacts.plan,
      validateOk: report.validation.ok,
      verifyOk: report.verification.ok
    });
  } else {
    report.nextStep = computeNextStep({
      missingDirs,
      approvedSpecFound: false,
      discoveryExists: false,
      planExists: false,
      validateOk: false,
      verifyOk: false
    });
  }

  if (report.nextStep === "ready_for_human_approval") {
    report.handoff = {
      required: true,
      state: "awaiting_human_approval",
      message: "SDLC artifact flow is complete. Human approval is required before implementation.",
      nextActions: [
        "Review approved spec, discovery, plan, backlog, and tests.",
        "Decide go/no-go for implementation.",
        "Create a checkpoint commit before starting implementation."
      ]
    };
  } else {
    report.handoff = {
      required: false,
      state: "in_progress",
      message: "Continue with nextStep.",
      nextActions: [report.nextStep]
    };
  }

  report.recommendedCommand = toRecommendedCommand(report.nextStep);
  report.nextStepMessage = nextStepMessage(report.nextStep);

  return report;
}

export function runStatus(options = {}) {
  const { json = false, root = process.cwd() } = options;
  const report = getStatusReport({ root });

  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log("Aitri Project Status ⚒️\n");
  if (report.config.loaded) {
    console.log(`✔ Config loaded: ${report.config.file}`);
    console.log(
      `  paths specs=${report.config.paths.specs} backlog=${report.config.paths.backlog} tests=${report.config.paths.tests} docs=${report.config.paths.docs}`
    );
  }

  if (report.structure.ok) {
    console.log("✔ Structure initialized");
  } else {
    console.log("✖ Missing structure:", report.structure.missingDirs.join(", "));
  }

  if (!report.approvedSpec.found) {
    console.log("✖ No approved specs found");
    console.log("\nNext recommended step:");
    console.log(`- State: ${report.nextStep}`);
    console.log(`- Run: ${report.recommendedCommand}`);
    console.log(`- Why: ${report.nextStepMessage}`);
    return;
  }

  console.log(`✔ Approved spec found: ${report.approvedSpec.feature}`);
  console.log(report.artifacts.discovery ? "✔ Discovery exists" : "✖ Discovery not generated");
  console.log(report.artifacts.plan ? "✔ Plan exists" : "✖ Plan not generated");

  if (report.validation.ok) {
    console.log("✔ Validation likely passed");
  } else {
    console.log("✖ Validation not passed");
  }

  if (report.verification.ok) {
    console.log("✔ Runtime verification passed");
  } else if (report.verification.status === "stale") {
    console.log("✖ Runtime verification is stale");
  } else if (report.verification.status === "failed") {
    console.log("✖ Runtime verification failed");
  } else {
    console.log("✖ Runtime verification missing");
  }

  console.log("\nNext recommended step:");
  if (report.nextStep === "ready_for_human_approval") {
    console.log("✅ Ready for human approval");
    console.log(`- Run: ${report.recommendedCommand}`);
    console.log("- Why: SDLC artifact flow is complete and waiting for explicit human decision.");
  } else {
    console.log(`- State: ${report.nextStep}`);
    console.log(`- Run: ${report.recommendedCommand}`);
    console.log(`- Why: ${report.nextStepMessage}`);
  }

  console.log("\nCheckpoint recommendation:");
  console.log(`- Commit: ${report.checkpoint.command}`);
  console.log(`- Fallback: ${report.checkpoint.fallback}`);
  if (report.checkpoint.state.git) {
    if (report.checkpoint.state.detected) {
      console.log("- Checkpoint detected:");
      if (report.checkpoint.state.latestCommit) {
        console.log(
          `  commit ${report.checkpoint.state.latestCommit.hash} ${report.checkpoint.state.latestCommit.message}`
        );
      }
      if (report.checkpoint.state.latestStash) {
        console.log(
          `  stash ${report.checkpoint.state.latestStash.ref} ${report.checkpoint.state.latestStash.message}`
        );
      }
      console.log("- Resume decision required: ask user to continue from checkpoint (yes/no).");
    } else {
      console.log("- No existing checkpoint detected in git history/stash.");
    }
  }
}
