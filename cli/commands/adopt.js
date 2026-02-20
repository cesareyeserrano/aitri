import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// EVO-008: aitri adopt — Phase 1 (Scan, deterministic, no AI required)
// Invariants:
//   - NEVER modifies src/, tests, or existing source files
//   - Output is always DRAFT (adoption-manifest.json + proposed aitri.config.json)
//   - Idempotent: re-running diffs/updates the manifest, never overwrites approved content
// ---------------------------------------------------------------------------

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---------------------------------------------------------------------------
// Stack detection
// ---------------------------------------------------------------------------

function detectStack(root) {
  const stacks = [];
  const pkg = readJsonSafe(path.join(root, "package.json"));
  if (pkg) {
    stacks.push({
      name: "node",
      version: pkg.engines?.node || null,
      packageManager: fs.existsSync(path.join(root, "pnpm-lock.yaml")) ? "pnpm"
        : fs.existsSync(path.join(root, "yarn.lock")) ? "yarn"
        : "npm",
      hasTypeScript: fs.existsSync(path.join(root, "tsconfig.json")),
      mainEntry: pkg.main || pkg.exports || null,
      scripts: Object.keys(pkg.scripts || {})
    });
  }
  if (fs.existsSync(path.join(root, "pyproject.toml")) || fs.existsSync(path.join(root, "setup.py")) || fs.existsSync(path.join(root, "requirements.txt"))) {
    stacks.push({ name: "python" });
  }
  if (fs.existsSync(path.join(root, "go.mod"))) {
    const mod = fs.readFileSync(path.join(root, "go.mod"), "utf8");
    const moduleLine = mod.split("\n").find((l) => l.startsWith("module "));
    stacks.push({ name: "go", module: moduleLine ? moduleLine.slice(7).trim() : null });
  }
  if (fs.existsSync(path.join(root, "Cargo.toml"))) {
    stacks.push({ name: "rust" });
  }
  if (fs.existsSync(path.join(root, "pom.xml")) || fs.existsSync(path.join(root, "build.gradle"))) {
    stacks.push({ name: "java" });
  }
  return stacks;
}

// ---------------------------------------------------------------------------
// Folder convention detection
// Returns candidates for src, tests, docs mapped to Aitri standard paths
// ---------------------------------------------------------------------------

const STANDARD_PATHS = { specs: "specs", backlog: "backlog", tests: "tests", docs: "docs" };

function detectFolderConventions(root) {
  const conventions = {};
  const srcCandidates = ["src", "lib", "app", "packages"];
  for (const c of srcCandidates) {
    if (fs.existsSync(path.join(root, c))) {
      conventions.sourcePath = c;
      break;
    }
  }
  const testCandidates = ["tests", "test", "__tests__", "spec", "specs"];
  for (const c of testCandidates) {
    if (fs.existsSync(path.join(root, c))) {
      conventions.existingTestPath = c;
      break;
    }
  }
  const docCandidates = ["docs", "documentation", "wiki", "doc"];
  for (const c of docCandidates) {
    if (fs.existsSync(path.join(root, c))) {
      conventions.existingDocPath = c;
      break;
    }
  }
  return conventions;
}

// ---------------------------------------------------------------------------
// Proposed aitri.config.json (only when paths conflict with Aitri standard)
// ---------------------------------------------------------------------------

function buildProposedConfig(conventions, existingAitriConfig) {
  if (existingAitriConfig) return null; // already configured
  const pathOverrides = {};
  // If existing test folder clashes with Aitri's "tests" default, propose aitri/tests
  if (conventions.existingTestPath && conventions.existingTestPath !== STANDARD_PATHS.tests) {
    pathOverrides.tests = `aitri/${STANDARD_PATHS.tests}`;
  }
  // If existing doc folder clashes with Aitri's "docs" default, propose aitri/docs
  if (conventions.existingDocPath && conventions.existingDocPath !== STANDARD_PATHS.docs) {
    pathOverrides.docs = `aitri/${STANDARD_PATHS.docs}`;
  }
  if (Object.keys(pathOverrides).length === 0) return null;
  return { paths: pathOverrides };
}

// ---------------------------------------------------------------------------
// Entry point scan
// ---------------------------------------------------------------------------

function detectEntryPoints(root, stack) {
  const entries = [];
  if (stack === "node") {
    const pkg = readJsonSafe(path.join(root, "package.json"));
    if (pkg?.main && fs.existsSync(path.join(root, pkg.main))) entries.push(pkg.main);
    if (pkg?.bin) {
      const bins = typeof pkg.bin === "string" ? [pkg.bin] : Object.values(pkg.bin);
      bins.forEach((b) => { if (fs.existsSync(path.join(root, b))) entries.push(b); });
    }
    // CLI pattern
    if (fs.existsSync(path.join(root, "cli", "index.js"))) entries.push("cli/index.js");
    if (fs.existsSync(path.join(root, "index.js"))) entries.push("index.js");
    if (fs.existsSync(path.join(root, "src", "index.js"))) entries.push("src/index.js");
    if (fs.existsSync(path.join(root, "src", "index.ts"))) entries.push("src/index.ts");
  } else if (stack === "python") {
    const mains = ["main.py", "app.py", "__main__.py", "src/main.py", "src/app.py"];
    mains.forEach((f) => { if (fs.existsSync(path.join(root, f))) entries.push(f); });
  } else if (stack === "go") {
    const mains = ["main.go", "cmd/main.go", "cmd/app/main.go"];
    mains.forEach((f) => { if (fs.existsSync(path.join(root, f))) entries.push(f); });
  }
  return [...new Set(entries)];
}

// ---------------------------------------------------------------------------
// Test file inventory (bounded — count only, don't read)
// ---------------------------------------------------------------------------

function countTestFiles(root, testPath) {
  if (!testPath || !fs.existsSync(path.join(root, testPath))) return 0;
  let count = 0;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.isDirectory()) walk(path.join(dir, e.name));
      else if (/\.(test|spec)\.(js|ts|mjs|py|go)$|_test\.go$|test_.*\.py$/.test(e.name)) count++;
    }
  }
  walk(path.join(root, testPath));
  return count;
}

// ---------------------------------------------------------------------------
// README detection
// ---------------------------------------------------------------------------

function detectReadme(root) {
  const candidates = ["README.md", "README.MD", "readme.md", "README", "README.txt"];
  for (const c of candidates) {
    if (fs.existsSync(path.join(root, c))) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Aitri structure gap analysis
// ---------------------------------------------------------------------------

function analyzeAitriGaps(root, paths) {
  const gaps = [];
  if (!fs.existsSync(paths.specsApprovedDir)) gaps.push("No approved specs — run aitri adopt then aitri approve");
  if (!fs.existsSync(paths.specsDraftsDir)) gaps.push("No draft specs — run aitri adopt to generate DRAFT specs (Phase 2 requires ai config)");
  if (!fs.existsSync(path.join(paths.docsRoot, "project.json"))) gaps.push("No docs/project.json — run aitri init or aitri upgrade");
  return gaps;
}

// ---------------------------------------------------------------------------
// Check whether Aitri structure already exists
// ---------------------------------------------------------------------------

function detectExistingAitriStructure(root, paths) {
  return {
    hasSpecsDrafts: fs.existsSync(paths.specsDraftsDir),
    hasSpecsApproved: fs.existsSync(paths.specsApprovedDir),
    hasBacklog: fs.existsSync(paths.backlogRoot),
    hasTests: fs.existsSync(paths.testsRoot),
    hasDocs: fs.existsSync(paths.docsRoot),
    hasProjectJson: fs.existsSync(path.join(paths.docsRoot, "project.json")),
    hasAitriConfig: fs.existsSync(path.join(root, "aitri.config.json")) || fs.existsSync(path.join(root, ".aitri.json"))
  };
}

// ---------------------------------------------------------------------------
// Public export
// ---------------------------------------------------------------------------

export async function runAdoptCommand({
  options,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
  exitCodes
}) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const project = getProjectContextOrExit();
  const root = process.cwd();
  const { paths } = project;
  const isDryRun = options.dryRun;

  console.log("Aitri Adopt — Project Onboarding (Phase 1: Scan)");
  console.log("");

  // -- Scan ------------------------------------------------------------------

  const stacks = detectStack(root);
  const conventions = detectFolderConventions(root);
  const readme = detectReadme(root);
  const aitriStructure = detectExistingAitriStructure(root, paths);
  const gaps = analyzeAitriGaps(root, paths);

  const existingAitriConfigFile = fs.existsSync(path.join(root, "aitri.config.json"))
    ? "aitri.config.json"
    : fs.existsSync(path.join(root, ".aitri.json")) ? ".aitri.json" : null;

  const proposedConfig = buildProposedConfig(conventions, existingAitriConfigFile);

  const entryPoints = stacks.flatMap((s) => detectEntryPoints(root, s.name));
  const testFileCount = countTestFiles(root, conventions.existingTestPath);

  // -- Report ----------------------------------------------------------------

  if (stacks.length === 0) {
    console.log("No recognized tech stack detected (package.json, pyproject.toml, go.mod, Cargo.toml).");
    console.log("Aitri can still initialize its folder structure, but stack-specific hints will be missing.");
    console.log("");
  } else {
    console.log("Detected stack:");
    for (const s of stacks) {
      const extra = s.hasTypeScript ? " + TypeScript" : "";
      const pm = s.packageManager ? ` (${s.packageManager})` : "";
      console.log(`  ${s.name}${extra}${pm}`);
    }
    console.log("");
  }

  if (readme) {
    console.log(`README:          ${readme}`);
  }
  if (conventions.sourcePath) {
    console.log(`Source path:     ${conventions.sourcePath}/`);
  }
  if (conventions.existingTestPath) {
    console.log(`Existing tests:  ${conventions.existingTestPath}/ (${testFileCount} test files detected)`);
  }
  if (entryPoints.length > 0) {
    console.log(`Entry points:    ${entryPoints.join(", ")}`);
  }
  console.log("");

  // Aitri structure status
  const structureEntries = [
    ["specs/drafts", aitriStructure.hasSpecsDrafts],
    ["specs/approved", aitriStructure.hasSpecsApproved],
    ["backlog", aitriStructure.hasBacklog],
    ["tests (aitri)", aitriStructure.hasTests],
    ["docs", aitriStructure.hasDocs],
    ["docs/project.json", aitriStructure.hasProjectJson]
  ];
  const alreadyInitialized = structureEntries.every(([, exists]) => exists);

  if (alreadyInitialized) {
    console.log("Aitri structure: already initialized");
  } else {
    console.log("Aitri structure gaps:");
    structureEntries
      .filter(([, exists]) => !exists)
      .forEach(([name]) => console.log(`  - ${name} (will be created)`));
  }
  console.log("");

  if (gaps.length > 0) {
    console.log("Gaps vs Aitri standard:");
    gaps.forEach((g) => console.log(`  - ${g}`));
    console.log("");
  }

  if (proposedConfig) {
    console.log("Proposed aitri.config.json (path conflict resolution):");
    console.log(JSON.stringify(proposedConfig, null, 2));
    console.log("");
  }

  // Phase 2 hint
  const aiConfigPath = path.join(root, "aitri.config.json");
  const hasAiConfig = (() => {
    const cfg = readJsonSafe(aiConfigPath) || readJsonSafe(path.join(root, ".aitri.json"));
    return !!(cfg?.ai?.provider);
  })();

  if (!hasAiConfig) {
    console.log("Phase 2 (LLM inference — DRAFT spec generation) requires an ai config in aitri.config.json.");
    console.log("Add: { \"ai\": { \"provider\": \"claude\", \"model\": \"claude-opus-4-6\", \"apiKeyEnv\": \"ANTHROPIC_API_KEY\" } }");
    console.log("Then run: aitri adopt --depth standard");
    console.log("");
  }

  if (isDryRun) {
    console.log("[dry-run] No files written. Remove --dry-run to initialize Aitri structure.");
    return OK;
  }

  // -- Plan ------------------------------------------------------------------

  const dirsToCreate = [
    !aitriStructure.hasSpecsDrafts && paths.specsDraftsDir,
    !aitriStructure.hasSpecsApproved && paths.specsApprovedDir,
    !aitriStructure.hasBacklog && paths.backlogRoot,
    !aitriStructure.hasTests && paths.testsRoot,
    !aitriStructure.hasDocs && paths.docsRoot
  ].filter(Boolean);

  const manifestFile = path.join(paths.docsRoot, "adoption-manifest.json");
  const configFile = path.join(root, "aitri.config.json");

  const planLines = [];
  dirsToCreate.forEach((d) => planLines.push(`- Create: ${path.relative(root, d)}`));
  planLines.push(`- Write:  ${path.relative(root, manifestFile)}`);
  if (proposedConfig && !existingAitriConfigFile) {
    planLines.push(`- Write:  aitri.config.json (proposed path overrides)`);
  }

  if (planLines.length === 0 && alreadyInitialized && fs.existsSync(manifestFile)) {
    console.log("Project already adopted. Manifest up to date.");
    return OK;
  }

  console.log("PLAN:");
  planLines.forEach((l) => console.log(l));
  console.log("");

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that modify files.");
    return ERROR;
  }
  if (!proceed) {
    console.log("Aborted.");
    return ABORTED;
  }

  // -- Execute ---------------------------------------------------------------

  dirsToCreate.forEach((d) => fs.mkdirSync(d, { recursive: true }));

  const manifest = {
    adoptedAt: new Date().toISOString(),
    projectRoot: path.basename(root),
    stacks,
    readme,
    conventions,
    entryPoints,
    existingTestFiles: testFileCount,
    existingAitriStructure: aitriStructure,
    gaps,
    phase2Ready: hasAiConfig,
    phase2Command: "aitri adopt --depth standard"
  };

  writeJsonFile(manifestFile, manifest);
  console.log(`  [OK] docs/adoption-manifest.json`);

  if (proposedConfig && !existingAitriConfigFile) {
    writeJsonFile(configFile, proposedConfig);
    console.log(`  [OK] aitri.config.json (proposed — review before committing)`);
  }

  console.log("");
  console.log("Project onboarding complete (Phase 1).");
  console.log(`Next steps:`);
  console.log(`  1. Review docs/adoption-manifest.json`);
  if (proposedConfig && !existingAitriConfigFile) {
    console.log(`  2. Review aitri.config.json — adjust paths as needed`);
  }
  if (!hasAiConfig) {
    console.log(`  ${proposedConfig ? "3" : "2"}. Add ai config to aitri.config.json, then run: aitri adopt --depth standard`);
  } else {
    console.log(`  ${proposedConfig ? "3" : "2"}. Run: aitri adopt --depth standard  (Phase 2: LLM DRAFT spec generation)`);
  }

  printCheckpointSummary(runAutoCheckpoint({
    enabled: options.autoCheckpoint,
    phase: "adopt",
    feature: "project"
  }));

  return OK;
}
