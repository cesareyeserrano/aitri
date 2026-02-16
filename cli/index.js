#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { getStatusReport, runStatus } from "./commands/status.js";
import {
  runDiscoverCommand,
  runPlanCommand,
  runValidateCommand
} from "./commands/discovery-plan-validate.js";
import { runDeliverCommand } from "./commands/deliver.js";
import { runImplementCommand } from "./commands/implement.js";
import { runCompletionGuide } from "./commands/post-delivery.js";
import {
  runGoCommand,
  runHandoffCommand,
  runPolicyCommand,
  runResumeCommand,
  runVerifyCommand
} from "./commands/runtime-flow.js";
import { runScaffoldCommand } from "./commands/scaffold.js";
import { CONFIG_FILE, loadAitriConfig, resolveProjectPaths } from "./config.js";
import { normalizeFeatureName } from "./lib.js";

function showBanner() {
  const iron = "\x1b[38;5;24m";      // dark iron gray
  const fire = "\x1b[38;5;208m";     // forge orange
  const ember = "\x1b[38;5;196m";    // deep red
  const reset = "\x1b[0m";

  console.log(`
${iron}   █████╗ ██╗████████╗██████╗ ██╗${reset}
${iron}  ██╔══██╗██║╚══██╔══╝██╔══██╗██║${reset}
${fire}  ███████║██║   ██║   ██████╔╝██║${reset}
${ember}  ██╔══██║██║   ██║   ██╔══██╗██║${reset}
${fire}  ██║  ██║██║   ██║   ██║  ██║██║${reset}
${iron}  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝${reset}

${fire}⚒ Spec-Driven Development Engine.${reset}
${iron}Aitri designed by César Augusto Reyes${reset}
`);
}

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

function parseArgs(argv) {
  const parsed = {
    json: false,
    ui: false,
    openUi: true,
    format: null,
    autoCheckpoint: true,
    autoAdvance: true,
    nonInteractive: false,
    strictPolicy: false,
    guided: false,
    yes: false,
    idea: null,
    feature: null,
    verifyCmd: null,
    discoveryDepth: null,
    retrievalMode: null,
    positional: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json" || arg === "-j") {
      parsed.json = true;
    } else if (arg === "--ui") {
      parsed.ui = true;
    } else if (arg === "--no-open") {
      parsed.openUi = false;
    } else if (arg === "--no-auto-advance") {
      parsed.autoAdvance = false;
    } else if (arg === "--no-checkpoint") {
      parsed.autoCheckpoint = false;
    } else if (arg === "--format") {
      parsed.format = (argv[i + 1] || "").trim().toLowerCase();
      i += 1;
    } else if (arg.startsWith("--format=")) {
      parsed.format = arg.slice("--format=".length).trim().toLowerCase();
    } else if (arg === "--non-interactive") {
      parsed.nonInteractive = true;
    } else if (arg === "--strict-policy") {
      parsed.strictPolicy = true;
    } else if (arg === "--guided") {
      parsed.guided = true;
    } else if (arg === "--yes" || arg === "-y") {
      parsed.yes = true;
    } else if (arg === "--idea") {
      parsed.idea = (argv[i + 1] || "").trim();
      i += 1;
    } else if (arg.startsWith("--idea=")) {
      parsed.idea = arg.slice("--idea=".length).trim();
    } else if (arg === "--feature" || arg === "-f") {
      parsed.feature = (argv[i + 1] || "").trim();
      i += 1;
    } else if (arg.startsWith("--feature=")) {
      parsed.feature = arg.slice("--feature=".length).trim();
    } else if (arg === "--verify-cmd") {
      parsed.verifyCmd = (argv[i + 1] || "").trim();
      i += 1;
    } else if (arg.startsWith("--verify-cmd=")) {
      parsed.verifyCmd = arg.slice("--verify-cmd=".length).trim();
    } else if (arg === "--discovery-depth") {
      parsed.discoveryDepth = (argv[i + 1] || "").trim().toLowerCase();
      i += 1;
    } else if (arg.startsWith("--discovery-depth=")) {
      parsed.discoveryDepth = arg.slice("--discovery-depth=".length).trim().toLowerCase();
    } else if (arg === "--retrieval-mode") {
      parsed.retrievalMode = (argv[i + 1] || "").trim().toLowerCase();
      i += 1;
    } else if (arg.startsWith("--retrieval-mode=")) {
      parsed.retrievalMode = arg.slice("--retrieval-mode=".length).trim().toLowerCase();
    } else {
      parsed.positional.push(arg);
    }
  }

  return parsed;
}

function wantsJson(options, positional = []) {
  if (options.json) return true;
  if ((options.format || "").toLowerCase() === "json") return true;
  return positional.some((p) => p.toLowerCase() === "json");
}

function wantsUi(options, positional = []) {
  if (options.ui) return true;
  if ((options.format || "").toLowerCase() === "ui") return true;
  return positional.some((p) => p.toLowerCase() === "ui");
}

function toRecommendedCommand(nextStep) {
  if (!nextStep) return null;
  if (nextStep === "ready_for_human_approval") return "aitri handoff";
  return nextStep;
}

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_ABORTED = 2;
const AUTO_CHECKPOINT_MAX = 10;

function getProjectContextOrExit() {
  try {
    const config = loadAitriConfig(process.cwd());
    const paths = resolveProjectPaths(process.cwd(), config.paths);
    return { config, paths };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${CONFIG_FILE}`;
    console.log(message);
    process.exit(EXIT_ERROR);
  }
}

function getStatusReportOrExit() {
  try {
    return getStatusReport({ root: process.cwd() });
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${CONFIG_FILE}`;
    console.log(message);
    process.exit(EXIT_ERROR);
  }
}

function shellEscapeSingle(value) {
  return String(value).replace(/'/g, "'\\''");
}

function runGit(cmd, cwd) {
  try {
    const out = execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }).trim();
    return { ok: true, out };
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : "";
    return { ok: false, out: "", err: stderr || "git command failed" };
  }
}

function runGitRaw(cmd, cwd) {
  try {
    const out = execSync(cmd, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, out };
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr).trim() : "";
    return { ok: false, out: "", err: stderr || "git command failed" };
  }
}

function sanitizeTagPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function runAutoCheckpoint({ enabled, phase, feature }) {
  if (!enabled) return { performed: false, reason: "disabled" };
  const cwd = process.cwd();

  const inside = runGit("git rev-parse --is-inside-work-tree", cwd);
  if (!inside.ok || inside.out !== "true") {
    return { performed: false, reason: "not_git_repo" };
  }

  const project = getProjectContextOrExit();
  const managed = Object.values(project.config.paths).map((p) => shellEscapeSingle(p));
  const addPaths = managed.join(" ");
  const add = runGit(`git add -- ${addPaths}`, cwd);
  if (!add.ok) return { performed: false, reason: "git_add_failed", detail: add.err };

  const hasChanges = runGit("git diff --cached --name-only", cwd);
  if (!hasChanges.ok) return { performed: false, reason: "git_diff_failed", detail: hasChanges.err };
  if (!hasChanges.out) return { performed: false, reason: "no_changes" };

  const label = feature || "project";
  const message = `checkpoint: ${label} ${phase}`;
  const commit = runGit(`git commit -m '${shellEscapeSingle(message)}'`, cwd);
  if (!commit.ok) return { performed: false, reason: "git_commit_failed", detail: commit.err };

  const head = runGit("git rev-parse --short HEAD", cwd);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const tagName = `aitri-checkpoint/${sanitizeTagPart(label)}-${sanitizeTagPart(phase)}-${ts}`;
  const tag = runGit(`git tag '${shellEscapeSingle(tagName)}' HEAD`, cwd);

  const tags = runGit("git tag --list 'aitri-checkpoint/*' --sort=-creatordate", cwd);
  if (tags.ok) {
    const list = tags.out.split("\n").map((t) => t.trim()).filter(Boolean);
    list.slice(AUTO_CHECKPOINT_MAX).forEach((oldTag) => {
      runGit(`git tag -d '${shellEscapeSingle(oldTag)}'`, cwd);
    });
  }

  return {
    performed: true,
    commit: head.ok ? head.out : null,
    tag: tag.ok ? tagName : null,
    max: AUTO_CHECKPOINT_MAX
  };
}

function printCheckpointSummary(result) {
  if (result.performed) {
    console.log(`Auto-checkpoint saved${result.commit ? `: ${result.commit}` : ""}`);
    console.log(`Checkpoint retention: last ${result.max}`);
    return;
  }
  if (result.reason === "disabled") {
    console.log("Auto-checkpoint disabled for this run.");
    return;
  }
  if (result.reason === "not_git_repo") {
    console.log("Auto-checkpoint skipped: not a git repository.");
    console.log("Tip: initialize git to enable checkpoints (`git init && git add -A && git commit -m \"baseline\"`).");
    return;
  }
  if (result.reason !== "no_changes") {
    console.log(`Auto-checkpoint skipped: ${result.reason}${result.detail ? ` (${result.detail})` : ""}`);
  }
}

async function confirmProceed(opts) {
  if (opts.yes) return true;
  if (opts.nonInteractive) return null;
  while (true) {
    const answer = (await ask("Proceed with this plan? Type 'y' to continue or 'n' to cancel: ")).toLowerCase();
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    console.log("Invalid input. Please type 'y' or 'n'.");
  }
}

async function confirmResume(opts) {
  if (opts.yes) return true;
  if (opts.nonInteractive) return null;
  while (true) {
    const answer = (await ask("Checkpoint found. Continue from checkpoint? Type 'y' to continue or 'n' to stop: ")).toLowerCase();
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    console.log("Invalid input. Please type 'y' or 'n'.");
  }
}

async function confirmYesNo(question, defaultYes = true) {
  while (true) {
    const answer = (await ask(question)).trim().toLowerCase();
    if (!answer) return defaultYes;
    if (answer === "y" || answer === "yes") return true;
    if (answer === "n" || answer === "no") return false;
    console.log("Invalid input. Please type 'y' or 'n'.");
  }
}

function parseRecommendedCommandTokens(recommendedCommand) {
  const raw = String(recommendedCommand || "").trim();
  if (!raw || /<[^>]+>/.test(raw)) return null;
  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;
  if (tokens[0] === "aitri") {
    tokens.shift();
  }
  if (tokens.length === 0) return null;
  return tokens;
}

function shouldOfferAutoAdvance({ code, command, options }) {
  if (code !== EXIT_OK) return false;
  if (!options || options.autoAdvance === false) return false;
  if (options.nonInteractive || options.yes) return false;
  if (wantsJson(options, options.positional) || wantsUi(options, options.positional)) return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  if (command === "help") return false;
  return true;
}

async function maybePromptAndAdvance({ code, command, options, feature = null }) {
  if (!shouldOfferAutoAdvance({ code, command, options })) {
    return code;
  }

  let report;
  try {
    report = getStatusReport({
      root: process.cwd(),
      feature: feature || options.feature || null
    });
  } catch {
    return code;
  }

  let recommended = report.recommendedCommand || toRecommendedCommand(report.nextStep);
  if (command === "handoff" && report.nextStep === "ready_for_human_approval") {
    // handoff already confirmed readiness; next operational step is explicit go/no-go.
    recommended = "aitri go";
  }
  if (!recommended) return code;

  const nextTokens = parseRecommendedCommandTokens(recommended);
  const isSameCommand = Boolean(nextTokens && nextTokens[0] === command);

  console.log("\nAitri guide:");
  console.log(`- Current state: ${report.nextStep || "unknown"}`);
  console.log(`- Recommended next step: ${recommended}`);
  if (report.nextStepMessage) {
    console.log(`- Why: ${report.nextStepMessage}`);
  }

  if (report.nextStep === "delivery_complete") {
    return runCompletionGuide({
      report,
      root: process.cwd(),
      cliPath: fileURLToPath(import.meta.url),
      confirmYesNo,
      baseCode: code
    });
  }

  if (!nextTokens) {
    console.log(`- Continue manually with: ${recommended}`);
    return code;
  }

  if (isSameCommand) {
    console.log(`- Continue manually with: ${recommended}`);
    return code;
  }

  // After implement, the agent/human must write actual code before verify can pass.
  // Do NOT auto-advance past this point — the test stubs fail by design.
  if (command === "implement") {
    console.log("\n⚒ IMPLEMENTATION REQUIRED:");
    console.log("- Aitri generated implementation briefs. Now YOU (or your AI agent) must write the actual code.");
    console.log("- Read: docs/implementation/<feature>/IMPLEMENTATION_ORDER.md");
    console.log("- For each US-* brief, implement the code that satisfies the acceptance criteria.");
    console.log("- Test stubs are in tests/<feature>/generated/ — they FAIL until you write real logic.");
    console.log("- After implementing each story, run: aitri verify");
    return code;
  }

  const proceed = await confirmYesNo("Run this next step now? (Y/n): ", true);
  if (!proceed) {
    console.log(`Stopped. Continue later with: ${recommended}`);
    return code;
  }

  const cliPath = fileURLToPath(import.meta.url);
  const printable = `aitri ${nextTokens.join(" ")}`;
  console.log(`Running next step: ${printable}`);

  const run = spawnSync(process.execPath, [cliPath, ...nextTokens], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: { ...process.env }
  });

  if (typeof run.status === "number") {
    return run.status;
  }

  if (run.error instanceof Error) {
    console.log(`Auto-advance failed: ${run.error.message}`);
  } else {
    console.log("Auto-advance failed.");
  }
  return EXIT_ERROR;
}

async function exitWithFlow({ code, command, options, feature = null }) {
  const finalCode = await maybePromptAndAdvance({ code, command, options, feature });
  process.exit(finalCode);
}

function printGuidedDraftWizard() {
  console.log("\nGuided Draft Wizard (English prompts)");
  console.log("Answer briefly. Aitri will transform your answers into the draft context.");
  console.log("Aitri will ask for technology preferences and can suggest a baseline stack.");
  console.log("Example feature name: user-login\n");
}

function detectTechInText(text) {
  const value = (text || "").toLowerCase();
  const known = [
    "react", "next.js", "nextjs", "vue", "angular", "svelte",
    "node", "node.js", "express", "nestjs", "fastify",
    "python", "fastapi", "django", "flask",
    "java", "spring", "spring boot",
    "go", "golang", "rust", "php", "laravel",
    "postgres", "postgresql", "mysql", "mongodb", "sqlite",
    "redis", "graphql"
  ];

  const found = known.filter((k) => value.includes(k));
  if (found.length === 0) return null;
  return [...new Set(found)].join(", ");
}

function suggestStackFromSummary(text) {
  const value = (text || "").toLowerCase();
  if (/\b(cli|terminal|command line)\b/.test(value)) {
    return "Node.js CLI";
  }
  if (/\b(mobile|ios|android|app)\b/.test(value)) {
    return "React Native + Node.js API + PostgreSQL";
  }
  if (/\b(ai|llm|rag|assistant|chatbot)\b/.test(value)) {
    return "Python (FastAPI) + PostgreSQL + Redis";
  }
  if (/\b(api|backend|service)\b/.test(value)) {
    return "Node.js (Express) + PostgreSQL";
  }
  if (/\b(web|dashboard|portal|frontend|ui)\b/.test(value)) {
    return "React + Node.js API + PostgreSQL";
  }
  return "Node.js (Express) + PostgreSQL";
}

const cmd = process.argv[2];
const options = parseArgs(process.argv.slice(3));

if (cmd === "--version" || cmd === "-v") {
  const pkgPath = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  console.log(`aitri v${pkg.version}`);
  process.exit(EXIT_OK);
}

if (!cmd || cmd === "help") {
  showBanner();
  console.log(`
Aitri ⚒️

Commands:
  init       Initialize project structure
  draft      Create a draft spec from an idea (use --guided for guided input)
  approve    Approve a draft spec (runs gates and moves draft into approved specs)
  discover   Generate discovery + artifact scaffolding from an approved spec (use --guided for discovery interview)
  plan       Generate plan doc + traceable backlog/tests from an approved spec
  scaffold   Generate post-go project skeleton, executable TC stubs, and FR interfaces
  implement  Generate ordered implementation briefs per US-* after scaffold
  deliver    Run final delivery gate (FR coverage + TC pass + confidence threshold)
  verify     Execute runtime verification suite and persist machine-readable evidence
  policy     Run managed-go policy checks (dependency drift, forbidden imports/paths)
  validate   Validate traceability placeholders are resolved (FR/AC/US/TC)
  status     Show project state and next recommended step
  handoff    Summarize validated SDLC artifacts and require explicit go/no-go decision
  go         Explicitly enter implementation mode after handoff readiness
  resume     Resume deterministically from checkpoint state and nextStep

Options:
  --yes, -y              Auto-approve plan prompts where supported
  --feature, -f <name>   Feature name for non-interactive runs
  --idea <text>          Idea text for non-interactive draft
  --verify-cmd <cmd>     Explicit runtime verification command (used by \`aitri verify\`)
  --discovery-depth <d>  Guided discovery depth: quick | standard | deep
  --retrieval-mode <m>   Retrieval mode for discover/plan: section | semantic
  --ui                   Generate static status insight page (status command)
  --no-open              Do not auto-open generated status UI page
  --no-auto-advance      Disable guided yes/no auto-advance to the next step
  --strict-policy        Require full git-based managed-go policy checks (blocks go outside git)
  --non-interactive      Do not prompt; fail if required args are missing
  --json, -j             Output machine-readable JSON (status, validate)
  --format <type>        Output format (json supported)
  --no-checkpoint        Disable auto-checkpoint for this command

Exit codes:
  0 success
  1 error (validation/usage/runtime)
  2 aborted by user
`);
  process.exit(EXIT_OK);
}

if (cmd === "init") {
  const project = getProjectContextOrExit();
  showBanner();
  const initDirs = [
    project.paths.specsDraftsDir,
    project.paths.specsApprovedDir,
    project.paths.backlogRoot,
    project.paths.testsRoot,
    project.paths.docsRoot
  ];

  console.log("PLAN:");
  initDirs.forEach((dir) => console.log("- Create: " + path.relative(process.cwd(), dir)));
  if (project.config.loaded) {
    console.log(`- Config: ${project.config.file}`);
  }

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    process.exit(EXIT_ERROR);
  }
  if (!proceed) {
    console.log("Aborted.");
    process.exit(EXIT_ABORTED);
  }

  initDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  console.log("Project initialized by Aitri ⚒️");
  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "init",
    feature: "project"
  }));
  await exitWithFlow({ code: EXIT_OK, command: cmd, options });
}
 
if (cmd === "draft") {
  const project = getProjectContextOrExit();
  // We expect to run this from a project repo, not from the Aitri repo
  const rawFeatureInput = String(options.feature || options.positional[0] || "").trim();
  let feature = normalizeFeatureName(rawFeatureInput);
  if (rawFeatureInput && !feature) {
    console.log("Invalid feature name. Use kebab-case (example: user-login).");
    process.exit(EXIT_ERROR);
  }
  if (!feature && !options.nonInteractive) {
    const prompted = await ask("Feature name in kebab-case (example: user-login): ");
    feature = normalizeFeatureName(prompted);
    if (!feature && String(prompted || "").trim()) {
      console.log("Invalid feature name. Use kebab-case (example: user-login).");
      process.exit(EXIT_ERROR);
    }
  }
  if (!feature) {
    console.log("Feature name is required. Use kebab-case (example: user-login).");
    process.exit(EXIT_ERROR);
  }

  let idea = options.idea || "";
  if (options.guided) {
    if (options.nonInteractive && !idea) {
      console.log("In guided + non-interactive mode, provide --idea \"<summary>\".");
      process.exit(EXIT_ERROR);
    }

    if (!options.nonInteractive) {
      printGuidedDraftWizard();
      const summary = idea || await ask("1) What capability do you want to build? (1-2 lines): ");
      const actor = await ask("2) Primary actor (example: customer, admin): ");
      const outcome = await ask("3) Expected outcome (what should happen): ");
      const inScope = await ask("4) In scope (main things to include): ");
      const outOfScope = await ask("5) Out of scope (optional): ");
      const detectedTech = detectTechInText(summary);
      const suggestedStack = suggestStackFromSummary(summary);
      const techPrompt = detectedTech
        ? `6) Requirement mentions: ${detectedTech}. Press Enter to confirm, or type replacement: `
        : `6) Preferred language/stack (optional). Suggested: ${suggestedStack}. Press Enter to accept or type replacement: `;
      const technology = await ask(techPrompt);
      idea = [
        `Summary: ${summary || "TBD"}`,
        `Primary actor: ${actor || "TBD"}`,
        `Expected outcome: ${outcome || "TBD"}`,
        `In scope: ${inScope || "TBD"}`,
        `Out of scope: ${outOfScope || "Not specified"}`,
        `Technology preference: ${technology || detectedTech || suggestedStack}`,
        `Technology source: ${detectedTech ? "Requirement-defined (confirmed)" : "Aitri suggestion (accepted/replaced)"}`
      ].join("\n");
    } else {
      const detectedTech = detectTechInText(idea);
      const suggestedStack = suggestStackFromSummary(idea);
      idea = [
        `Summary: ${idea}`,
        "Primary actor: TBD",
        "Expected outcome: TBD",
        "In scope: TBD",
        "Out of scope: Not specified",
        `Technology preference: ${detectedTech || suggestedStack}`,
        `Technology source: ${detectedTech ? "Requirement-defined (auto-detected)" : "Aitri suggestion (auto-applied)"}`
      ].join("\n");
    }
  } else if (!idea && !options.nonInteractive) {
    idea = await ask("Describe the idea in 1-3 lines: ");
  }
  if (!idea) {
    console.log("Idea is required. Provide --idea in non-interactive mode.");
    process.exit(EXIT_ERROR);
  }

  // Locate Aitri core template relative to where this CLI package lives
  const cliDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = path.resolve(cliDir, "..", "core", "templates", "af_spec.md");

  if (!fs.existsSync(templatePath)) {
    console.log(`Template not found at: ${templatePath}`);
    console.log("Make sure Aitri repo has core/templates/af_spec.md");
    process.exit(EXIT_ERROR);
  }

  const template = fs.readFileSync(templatePath, "utf8");

  const outDir = project.paths.specsDraftsDir;
  const outFile = project.paths.draftSpecFile(feature);

  const plan = [
    `Create: ${path.relative(process.cwd(), outDir)}`,
    `Create: ${path.relative(process.cwd(), outFile)}`
  ];

  console.log("PLAN:");
  plan.forEach((p) => console.log("- " + p));

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    process.exit(EXIT_ERROR);
  }
  if (!proceed) {
    console.log("Aborted.");
    process.exit(EXIT_ABORTED);
  }

  fs.mkdirSync(outDir, { recursive: true });

  // Insert idea into Context section (simple but effective for v0.1)
  const enriched = template.replace(
    "## 1. Context\nDescribe the problem context.",
    `## 1. Context\n${idea}\n\n---\n\n(Assumptions and details will be refined during review.)`
  );

  fs.writeFileSync(outFile, enriched, "utf8");

  console.log(`Draft spec created: ${path.relative(process.cwd(), outFile)}`);
  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "draft",
    feature
  }));
  console.log(`Next recommended command: aitri approve --feature ${feature}`);
  await exitWithFlow({ code: EXIT_OK, command: cmd, options, feature });
}

if (cmd === "approve") {
  const project = getProjectContextOrExit();
  const rawFeatureInput = String(options.feature || options.positional[0] || "").trim();
  let feature = normalizeFeatureName(rawFeatureInput);
  if (rawFeatureInput && !feature) {
    console.log("Invalid feature name. Use kebab-case (example: user-login).");
    process.exit(EXIT_ERROR);
  }
  if (!feature && !options.nonInteractive) {
    const prompted = await ask("Feature name to approve (kebab-case): ");
    feature = normalizeFeatureName(prompted);
    if (!feature && String(prompted || "").trim()) {
      console.log("Invalid feature name. Use kebab-case (example: user-login).");
      process.exit(EXIT_ERROR);
    }
  }
  if (!feature) {
    console.log("Feature name is required. Use --feature <name> in non-interactive mode.");
    process.exit(EXIT_ERROR);
  }

  const draftsFile = project.paths.draftSpecFile(feature);
  const approvedDir = project.paths.specsApprovedDir;
  const approvedFile = project.paths.approvedSpecFile(feature);

  if (!fs.existsSync(draftsFile)) {
    console.log(`Draft spec not found: ${path.relative(process.cwd(), draftsFile)}`);
    process.exit(EXIT_ERROR);
  }

  const content = fs.readFileSync(draftsFile, "utf8");
  const issues = [];

  // Must contain STATUS: DRAFT
  if (!/^STATUS:\s*DRAFT\s*$/m.test(content)) {
    issues.push("Spec must contain `STATUS: DRAFT`.");
  }

  // Functional Rules check (supports FR-* traceable format and legacy numbered rules)
  const rulesMatch =
    content.match(/## 3\. Functional Rules \(traceable\)([\s\S]*?)(\n##\s|\s*$)/) ||
    content.match(/## 3\. Functional Rules([\s\S]*?)(\n##\s|\s*$)/);

  if (!rulesMatch) {
    issues.push("Missing section: `## 3. Functional Rules`.");
  } else {
    const body = rulesMatch[1] || "";
    const lines = body.split("\n").map(l => l.trim()).filter(Boolean);

    const hasFR = lines.some(l => /^[-*]\s*FR-\d+\s*:\s*\S+/i.test(l));
    const hasLegacyNumbered = lines.some(l => /^\d+\.\s+\S+/.test(l));

    const meaningful = lines.some(l => {
      const cleaned = l
        .replace(/^[-*]\s*/, "")
        .replace(/^FR-\d+\s*:\s*/i, "")
        .replace(/^\d+\.\s+/, "")
        .trim();
      if (cleaned.length < 8) return false;
      if (/^<.*>$/.test(cleaned)) return false;
      if (/<verifiable rule>/i.test(cleaned)) return false;
      if (/<[a-z\s]+>/i.test(cleaned) && cleaned.replace(/<[^>]+>/g, "").trim().length < 8) return false;
      return true;
    });

    if (!(hasFR || hasLegacyNumbered) || !meaningful) {
      issues.push("Functional Rules must include at least one meaningful rule using `- FR-1: ...` (preferred) or legacy `1. ...` format. Replace all <placeholder> tokens with real content.");
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
    const acLines = acMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const acMeaningful = acLines.some(l => {
      const cleaned = l
        .replace(/^[-*]\s*/, "")
        .replace(/^AC-\d+\s*:\s*/i, "")
        .trim();
      if (cleaned.length < 8) return false;
      if (/^<.*>$/.test(cleaned)) return false;
      if (/<context>/i.test(cleaned) || /<action>/i.test(cleaned) || /<expected>/i.test(cleaned)) return false;
      if (/<[a-z\s]+>/i.test(cleaned) && cleaned.replace(/<[^>]+>/g, "").trim().length < 8) return false;
      return true;
    });
    if (!acMeaningful) {
      issues.push("Acceptance Criteria must include at least one meaningful criterion. Replace all <placeholder> tokens (e.g. <context>, <action>, <expected>) with real content.");
    }
  }

  // Actors check (section 2)
  const actorsMatch = content.match(/## 2\. Actors([\s\S]*?)(\n##\s|\s*$)/);
  if (!actorsMatch) {
    issues.push("Missing section: `## 2. Actors`.");
  } else {
    const actorLines = actorsMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const actorMeaningful = actorLines.some(l => {
      const cleaned = l.replace(/^[-*]\s*/, "").trim();
      if (cleaned.length < 3) return false;
      if (/^<.*>$/.test(cleaned)) return false;
      if (/<actor>/i.test(cleaned) || /<role>/i.test(cleaned)) return false;
      return true;
    });
    if (!actorMeaningful) {
      issues.push("Actors section must list at least one real actor/role. Replace all <placeholder> tokens with real content.");
    }
  }

  // Edge Cases check (section 4)
  const edgeMatch = content.match(/## 4\. Edge Cases([\s\S]*?)(\n##\s|\s*$)/);
  if (!edgeMatch) {
    issues.push("Missing section: `## 4. Edge Cases`.");
  } else {
    const edgeLines = edgeMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
    const edgeMeaningful = edgeLines.some(l => {
      const cleaned = l.replace(/^[-*]\s*/, "").trim();
      if (cleaned.length < 8) return false;
      if (/^<.*>$/.test(cleaned)) return false;
      if (/<[a-z\s]+>/i.test(cleaned) && cleaned.replace(/<[^>]+>/g, "").trim().length < 8) return false;
      return true;
    });
    if (!edgeMeaningful) {
      issues.push("Edge Cases must include at least one meaningful scenario. Replace all <placeholder> tokens with real content.");
    }
  }

  // Asset strategy check for visual/game/web domains
  const contextMatch = content.match(/## 1\. Context([\s\S]*?)(\n##\s|\s*$)/);
  const contextText = contextMatch ? contextMatch[1].toLowerCase() : "";
  const fullLower = content.toLowerCase();
  const isVisualDomain = /\b(game|juego|sprite|canvas|webgl|three\.?js|phaser|godot|unity|animation|visual|graphic|ui\s*design|web\s*app|frontend|pixel|tilemap|asset|artwork|render)\b/.test(contextText) ||
    /\b(game|juego|sprite|canvas|webgl|three\.?js|phaser)\b/.test(fullLower);

  if (isVisualDomain) {
    const hasAssetSection = /##\s*\d*\.?\s*(Assets|Asset Strategy|Visual Assets|Art Direction|Resource Requirements)/i.test(content);
    const hasAssetMention = /\b(sprite|texture|image|sound|audio|music|font|tileset|asset|artwork|art\s*style|resolution|pixel\s*art|3d\s*model)\b/i.test(content);
    if (!hasAssetSection && !hasAssetMention) {
      issues.push("This spec describes a visual/game project but has no asset strategy. Add a section describing required assets (sprites, sounds, art style, etc.) or reference them in Functional Rules.");
    }
  }

  if (issues.length > 0) {
    console.log("GATE FAILED:");
    issues.forEach(i => console.log("- " + i));
    console.log("\nNext recommended step:");
    console.log(`- Fix: ${path.relative(process.cwd(), draftsFile)}`);
    if (issues.some((issue) => issue.includes("Security Considerations"))) {
      console.log("- Tip: add at least one concrete bullet under `## 7. Security Considerations`.");
    }
    console.log(`- Run: aitri approve --feature ${feature}`);
    process.exit(EXIT_ERROR);
  }

  const plan = [
    `Move: ${path.relative(process.cwd(), draftsFile)} → ${path.relative(process.cwd(), approvedFile)}`
  ];

  console.log("PLAN:");
  plan.forEach(p => console.log("- " + p));

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    process.exit(EXIT_ERROR);
  }
  if (!proceed) {
    console.log("Aborted.");
    process.exit(EXIT_ABORTED);
  }

  fs.mkdirSync(approvedDir, { recursive: true });

  const updated = content.replace(/^STATUS:\s*DRAFT\s*$/m, "STATUS: APPROVED");
  fs.writeFileSync(approvedFile, updated, "utf8");
  fs.unlinkSync(draftsFile);

  console.log("Spec approved successfully.");
  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "approve",
    feature
  }));
  await exitWithFlow({ code: EXIT_OK, command: cmd, options, feature });
}

if (cmd === "discover") {
  const code = await runDiscoverCommand({
    options,
    ask,
    getProjectContextOrExit,
    confirmProceed,
    printCheckpointSummary,
    runAutoCheckpoint,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "plan") {
  const code = await runPlanCommand({
    options,
    ask,
    getProjectContextOrExit,
    confirmProceed,
    printCheckpointSummary,
    runAutoCheckpoint,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "verify") {
  const code = await runVerifyCommand({
    options,
    getProjectContextOrExit,
    ask,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "scaffold") {
  const code = await runScaffoldCommand({
    options,
    getProjectContextOrExit,
    getStatusReportOrExit,
    confirmProceed,
    printCheckpointSummary,
    runAutoCheckpoint,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "implement") {
  const code = await runImplementCommand({
    options,
    getProjectContextOrExit,
    getStatusReportOrExit,
    confirmProceed,
    printCheckpointSummary,
    runAutoCheckpoint,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "deliver") {
  const code = await runDeliverCommand({
    options,
    getProjectContextOrExit,
    getStatusReportOrExit,
    confirmProceed,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "policy") {
  const code = runPolicyCommand({
    options,
    getProjectContextOrExit,
    getStatusReportOrExit,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "validate") {
  const code = await runValidateCommand({
    options,
    ask,
    getProjectContextOrExit,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "status") {
  try {
    const ok = runStatus({
      json: wantsJson(options, options.positional),
      ui: wantsUi(options, options.positional),
      openUi: options.openUi,
      root: process.cwd(),
      feature: options.feature
    });
    if (!ok) process.exit(EXIT_ERROR);
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${CONFIG_FILE}`;
    console.log(message);
    process.exit(EXIT_ERROR);
  }
  await exitWithFlow({ code: EXIT_OK, command: cmd, options });
}

if (cmd === "resume") {
  const code = await runResumeCommand({
    options,
    getStatusReportOrExit,
    toRecommendedCommand,
    confirmResume,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "handoff") {
  const code = runHandoffCommand({
    options,
    getStatusReportOrExit,
    toRecommendedCommand,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR }
  });
  await exitWithFlow({ code, command: cmd, options });
}

if (cmd === "go") {
  const code = await runGoCommand({
    options,
    getStatusReportOrExit,
    toRecommendedCommand,
    getProjectContextOrExit,
    confirmProceed,
    exitCodes: { OK: EXIT_OK, ERROR: EXIT_ERROR, ABORTED: EXIT_ABORTED }
  });
  await exitWithFlow({ code, command: cmd, options });
}

console.log("Unknown command.");
process.exit(EXIT_ERROR);
