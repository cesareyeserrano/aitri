#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise((resolve) =>
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

const cmd = process.argv[2];

if (!cmd || cmd === "help") {
  console.log(`
Aitri ⚒️

Commands:
  init       Initialize project structure
  draft      Create a draft spec from an idea
  approve    Approve a draft spec (move to specs/approved)
`);
  process.exit(0);
}

if (cmd === "init") {
  const plan = [
    "Create: specs/drafts",
    "Create: specs/approved",
    "Create: backlog",
    "Create: tests",
    "Create: docs"
  ];

  console.log("PLAN:");
  plan.forEach((p) => console.log("- " + p));

  const answer = await ask("Proceed? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  ["specs/drafts", "specs/approved", "backlog", "tests", "docs"].forEach((p) =>
    fs.mkdirSync(path.join(process.cwd(), p), { recursive: true })
  );

  console.log("Project initialized by Aitri ⚒️");
  process.exit(0);
}
 
if (cmd === "draft") {
  // We expect to run this from a project repo, not from the Aitri repo
  const feature = (await ask("Feature name (kebab-case, e.g. user-login): ")).replace(/\s+/g, "-").trim();
  if (!feature) {
    console.log("Feature name is required.");
    process.exit(1);
  }

  const idea = await ask("Describe the idea (1-3 lines): ");
  if (!idea) {
    console.log("Idea is required.");
    process.exit(1);
  }

  // Locate Aitri core template relative to where this CLI package lives
  const cliDir = path.dirname(new URL(import.meta.url).pathname);
  const templatePath = path.resolve(cliDir, "..", "core", "templates", "af_spec.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Template not found at: ${templatePath}`);
    console.log("Make sure Aitri repo has core/templates/af_spec.md");
    process.exit(1);
  }

  const template = fs.readFileSync(templatePath, "utf8");

  const outDir = path.join(process.cwd(), "specs", "drafts");
  const outFile = path.join(outDir, `${feature}.md`);

  const plan = [
    `Create: ${path.relative(process.cwd(), outDir)}`,
    `Create: ${path.relative(process.cwd(), outFile)}`
  ];

  console.log("PLAN:");
  plan.forEach((p) => console.log("- " + p));

  const answer = await ask("Proceed? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Insert idea into Context section (simple but effective for v0.1)
  const enriched = template.replace(
    "## 1. Context\nDescribe the problem context.",
    `## 1. Context\n${idea}\n\n---\n\n(Assumptions and details will be refined during review.)`
  );

  fs.writeFileSync(outFile, enriched, "utf8");

  console.log(`Draft spec created: ${path.relative(process.cwd(), outFile)}`);
  process.exit(0);
}

if (cmd === "approve") {
  const feature = (await ask("Feature name to approve (kebab-case): "))
    .replace(/\s+/g, "-")
    .trim();

  const draftsFile = path.join(process.cwd(), "specs", "drafts", `${feature}.md`);
  const approvedDir = path.join(process.cwd(), "specs", "approved");
  const approvedFile = path.join(approvedDir, `${feature}.md`);

  if (!fs.existsSync(draftsFile)) {
    console.log(`Draft spec not found: ${path.relative(process.cwd(), draftsFile)}`);
    process.exit(1);
  }

  const content = fs.readFileSync(draftsFile, "utf8");
  const issues = [];

  // Must contain STATUS: DRAFT
  if (!/^STATUS:\s*DRAFT\s*$/m.test(content)) {
    issues.push("Spec must contain `STATUS: DRAFT`.");
  }

  // Functional Rules check
  const rulesMatch = content.match(/## 3\. Functional Rules([\s\S]*?)(\n##\s|\s*$)/);
  if (!rulesMatch) {
    issues.push("Missing section: `## 3. Functional Rules`.");
  } else {
    const lines = rulesMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const meaningful = lines.some(l => {
      if (!/^\d+\./.test(l)) return false;
      const rest = l.replace(/^\d+\.\s*/, "").trim();
      return rest.length >= 8 && !/^<.*>$/.test(rest);
    });
    if (!meaningful) {
      issues.push("Functional Rules must include at least one meaningful numbered rule.");
    }
  }

  // Security check
  const secMatch = content.match(/## 7\. Security Considerations([\s\S]*?)(\n##\s|\s*$)/);
  if (!secMatch) {
    issues.push("Missing section: `## 7. Security Considerations`.");
  } else {
    const lines = secMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const meaningful = lines.some(l => {
  const cleaned = l.replace(/^[-*]\s*/, "").trim();
  if (cleaned.length < 5) return false;
  if (cleaned.includes("<") && cleaned.includes(">")) return false;
  return true;
});
    if (!meaningful) {
      issues.push("Security Considerations must include at least one meaningful bullet.");
    }
  }

  // Acceptance Criteria check
  const acMatch = content.match(/## 9\. Acceptance Criteria([\s\S]*?)(\n##\s|\s*$)/);
  if (!acMatch) {
    issues.push("Missing section: `## 9. Acceptance Criteria`.");
  } else {
    const lines = acMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const meaningful = lines.some(l =>
      l !== "-" && !/^<.*>$/.test(l) && l.replace(/^[-*]\s*/, "").trim().length >= 8
    );
    if (!meaningful) {
      issues.push("Acceptance Criteria must include at least one meaningful bullet.");
    }
  }

  if (issues.length > 0) {
    console.log("GATE FAILED:");
    issues.forEach(i => console.log("- " + i));
    process.exit(1);
  }

  const plan = [
    `Move: specs/drafts/${feature}.md → specs/approved/${feature}.md`
  ];

  console.log("PLAN:");
  plan.forEach(p => console.log("- " + p));

  const answer = await ask("Proceed? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  fs.mkdirSync(approvedDir, { recursive: true });

  const updated = content.replace(/^STATUS:\s*DRAFT\s*$/m, "STATUS: APPROVED");
  fs.writeFileSync(approvedFile, updated, "utf8");
  fs.unlinkSync(draftsFile);

  console.log("Spec approved successfully.");
  process.exit(0);
}

if (cmd === "discover") {
  const feature = (await ask("Feature name (kebab-case, e.g. user-login): "))
    .replace(/\s+/g, "-")
    .trim();

  if (!feature) {
    console.log("Feature name is required.");
    process.exit(1);
  }

  const approvedFile = path.join(process.cwd(), "specs", "approved", `${feature}.md`);
  if (!fs.existsSync(approvedFile)) {
    console.log(`Approved spec not found: ${path.relative(process.cwd(), approvedFile)}`);
    console.log("Approve the spec first: aitri approve");
    process.exit(1);
  }

  const cliDir = path.dirname(new URL(import.meta.url).pathname);
  const templatePath = path.resolve(cliDir, "..", "core", "templates", "discovery", "discovery_template.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Discovery template not found at: ${templatePath}`);
    process.exit(1);
  }

  const outDir = path.join(process.cwd(), "docs", "discovery");
  const backlogDir = path.join(process.cwd(), "backlog", feature);
  const testsDir = path.join(process.cwd(), "tests", feature);

  const backlogFile = path.join(backlogDir, "backlog.md");
  const testsFile = path.join(testsDir, "tests.md");
  const outFile = path.join(outDir, `${feature}.md`);

  console.log("PLAN:");
  console.log("- Read: " + path.relative(process.cwd(), approvedFile));
  console.log("- Create: " + path.relative(process.cwd(), outDir));
  console.log("- Create: " + path.relative(process.cwd(), outFile));
  console.log("- Create: " + path.relative(process.cwd(), backlogDir));
  console.log("- Create: " + path.relative(process.cwd(), backlogFile));
  console.log("- Create: " + path.relative(process.cwd(), testsDir));
  console.log("- Create: " + path.relative(process.cwd(), testsFile));

  const answer = await ask("Proceed? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(backlogDir, { recursive: true });
  fs.mkdirSync(testsDir, { recursive: true });

  const approvedSpec = fs.readFileSync(approvedFile, "utf8");
  let discovery = fs.readFileSync(templatePath, "utf8");

  // Basic injection
  discovery = discovery.replace("# Discovery: <feature>", `# Discovery: ${feature}`);
  discovery = discovery.replace("## 1. Problem Statement\n- What problem are we solving?\n- Why now?",
    `## 1. Problem Statement\nDerived from approved spec:\n\n---\n\n${approvedSpec}\n\n---\n\nNow refine: what problem are we solving and why now?`
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
  process.exit(0);
}

if (cmd === "plan") {
  const feature = (await ask("Feature name (kebab-case, e.g. user-login): "))
    .replace(/\s+/g, "-")
    .trim();

  if (!feature) {
    console.log("Feature name is required.");
    process.exit(1);
  }

  const approvedFile = path.join(process.cwd(), "specs", "approved", `${feature}.md`);
  if (!fs.existsSync(approvedFile)) {
    console.log(`Approved spec not found: ${path.relative(process.cwd(), approvedFile)}`);
    console.log("Approve the spec first: aitri approve");
    process.exit(1);
  }

  const cliDir = path.dirname(new URL(import.meta.url).pathname);
  const templatePath = path.resolve(cliDir, "..", "core", "templates", "plan", "plan_template.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Plan template not found at: ${templatePath}`);
    process.exit(1);
  }

  const architectPersona = path.resolve(cliDir, "..", "core", "personas", "architect.md");
  const securityPersona = path.resolve(cliDir, "..", "core", "personas", "security.md");
  const qaPersona = path.resolve(cliDir, "..", "core", "personas", "qa.md");

  const outPlanDir = path.join(process.cwd(), "docs", "plan");
  const outPlanFile = path.join(outPlanDir, `${feature}.md`);

  const backlogFile = path.join(process.cwd(), "backlog", feature, "backlog.md");
  const testsFile = path.join(process.cwd(), "tests", feature, "tests.md");

  console.log("PLAN:");
  console.log("- Read: " + path.relative(process.cwd(), approvedFile));
  console.log("- Read: " + path.relative(process.cwd(), templatePath));
  console.log("- Read: " + (fs.existsSync(architectPersona) ? architectPersona : "core/personas/architect.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(securityPersona) ? securityPersona : "core/personas/security.md (missing in repo)"));
  console.log("- Read: " + (fs.existsSync(qaPersona) ? qaPersona : "core/personas/qa.md (missing in repo)"));
  console.log("- Create: " + path.relative(process.cwd(), outPlanDir));
  console.log("- Write: " + path.relative(process.cwd(), outPlanFile));
  console.log("- Write: " + path.relative(process.cwd(), backlogFile));
  console.log("- Write: " + path.relative(process.cwd(), testsFile));

  const answer = await ask("Proceed? (y/n): ");
  if (answer.toLowerCase() !== "y") {
    console.log("Aborted.");
    process.exit(0);
  }

  fs.mkdirSync(outPlanDir, { recursive: true });
  fs.mkdirSync(path.dirname(backlogFile), { recursive: true });
  fs.mkdirSync(path.dirname(testsFile), { recursive: true });

  const approvedSpec = fs.readFileSync(approvedFile, "utf8");
  let planDoc = fs.readFileSync(templatePath, "utf8");

  // Inject feature name and include approved spec for traceability
  planDoc = planDoc.replace("# Plan: <feature>", `# Plan: ${feature}`);
  planDoc = planDoc.replace(
    "## 1. Intent (from approved spec)",
    `## 1. Intent (from approved spec)\n\n---\n\n${approvedSpec}\n\n---\n`
  );

  fs.writeFileSync(outPlanFile, planDoc, "utf8");

  // Overwrite backlog/tests with a structured starting point (content will be refined by agents)
  const backlog = `# Backlog: ${feature}

> Generated by \`aitri plan\`. Expand into as many epics/stories as needed.

## Epics
- Epic 1: <outcome>
- Epic 2: <outcome>

## User Stories
- As a <actor>, I want <capability>, so that <benefit>.
  - Acceptance Criteria:
    - Given ..., when ..., then ...
    - Given ..., when ..., then ...

(repeat as needed)
`;

  const tests = `# Test Cases: ${feature}

> Generated by \`aitri plan\`. Expand into as many test cases as needed.

## Functional
1. Given <context>, when <action>, then <expected>.

## Negative / Abuse
1. Given <invalid input>, when <submitted>, then <rejected with clear error>.

## Security
1. Input validation rejects unsafe/invalid inputs.
2. Access control: unauthorized actor cannot perform restricted actions.

## Edge Cases
1. <edge case> -> <expected behavior>
`;

  fs.writeFileSync(backlogFile, backlog, "utf8");
  fs.writeFileSync(testsFile, tests, "utf8");

  console.log("Plan created: " + path.relative(process.cwd(), outPlanFile));
  process.exit(0);
}

console.log("Unknown command.");
process.exit(1);
