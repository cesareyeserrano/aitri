import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeFeatureName } from "../lib.js";

/**
 * aitri execute — presents the implementation context to the agent.
 *
 * Aitri is a skill used BY an agent (Claude Code, Cursor, etc.).
 * The agent is the AI. execute does NOT call any external AI.
 * It reads the brief and presents it structured so the agent knows exactly
 * what to implement and what tests must pass.
 *
 * Flow:
 *   aitri execute --story US-1  → agent reads context + implements
 *   aitri verify                → confirms tests pass
 *   aitri execute --story US-2  → next story
 */

function extractTCs(testsContent, storyId) {
  // Extract TCs mapped to this story (or all if no story filter)
  const tcs = [];
  const blocks = testsContent.split(/(?=^###\s+TC-)/m);
  for (const block of blocks) {
    const idMatch = block.match(/^###\s+(TC-\d+)/m);
    if (!idMatch) continue;
    const tcId = idMatch[1];
    if (!storyId || block.includes(storyId)) {
      tcs.push({ id: tcId, content: block.trim() });
    }
  }
  return tcs;
}

function printBrief({ feature, story, specContent, planContent, briefContent, tcs, allStories }) {
  const separator = "─".repeat(60);

  console.log(`\n${separator}`);
  console.log(`AITRI EXECUTE — Implement ${story} for feature '${feature}'`);
  console.log(`${separator}\n`);

  if (allStories.length > 1) {
    console.log(`Implementation order: ${allStories.join(" → ")}`);
    console.log(`Current: ${story}\n`);
  }

  console.log("## BRIEF\n");
  console.log(briefContent.trim());

  if (tcs.length > 0) {
    console.log(`\n## TEST CASES TO PASS (${tcs.length})\n`);
    tcs.forEach(tc => console.log(`- ${tc.id}`));
  }

  console.log(`\n${separator}`);
  console.log("Implement the files described in the brief above.");
  console.log("When done, run: aitri verify --feature " + feature);
  console.log(`${separator}\n`);
}

function runTests(cwd) {
  const result = spawnSync("npm", ["test"], {
    cwd,
    encoding: "utf8",
    timeout: 120000
  });
  return {
    passed: result.status === 0,
    exitCode: result.status || 0,
    output: (result.stdout || "") + (result.stderr || "")
  };
}

function writeEvidence({ project, feature, story, tcs, testResult }) {
  const executionDir = project.paths.docsExecutionDir;
  fs.mkdirSync(executionDir, { recursive: true });
  const evidenceFile = project.paths.executionFile(feature, story);
  const evidence = {
    schemaVersion: 1,
    feature,
    story,
    executedAt: new Date().toISOString(),
    implementedBy: "agent",
    tcsCovered: tcs.map(tc => tc.id),
    testResult
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2), "utf8");
  return evidenceFile;
}

async function executeStory({ feature, story, options, project, exitCodes, allStories }) {
  const { OK, ERROR } = exitCodes;
  const cwd = process.cwd();

  const goFile = project.paths.goMarkerFile(feature);
  if (!fs.existsSync(goFile)) {
    console.log(`Gate failed: go.json not found. Run \`aitri go --feature ${feature}\` first.`);
    return ERROR;
  }

  const briefFile = path.join(project.paths.implementationFeatureDir(feature), `${story}.md`);
  if (!fs.existsSync(briefFile)) {
    console.log(`Brief not found: ${path.relative(cwd, briefFile)}`);
    console.log(`Run \`aitri implement --feature ${feature}\` to generate briefs.`);
    return ERROR;
  }

  const briefContent = fs.readFileSync(briefFile, "utf8");
  const specContent = fs.existsSync(project.paths.approvedSpecFile(feature))
    ? fs.readFileSync(project.paths.approvedSpecFile(feature), "utf8") : "";
  const planContent = fs.existsSync(project.paths.planFile(feature))
    ? fs.readFileSync(project.paths.planFile(feature), "utf8") : "";
  const testsContent = fs.existsSync(project.paths.testsFile(feature))
    ? fs.readFileSync(project.paths.testsFile(feature), "utf8") : "";

  const tcs = extractTCs(testsContent, story);

  if (options.json) {
    console.log(JSON.stringify({
      ok: true, feature, story,
      brief: briefContent,
      spec: specContent,
      plan: planContent,
      tcs: tcs.map(tc => tc.id),
      verifyCommand: `aitri verify --feature ${feature}`
    }, null, 2));
    return OK;
  }

  printBrief({ feature, story, specContent, planContent, briefContent, tcs, allStories });

  if (options.noTest) return OK;

  // Run verify after presenting brief (agent should have implemented by now in interactive use)
  if (options.verify) {
    console.log("Running test suite...");
    const testResult = runTests(cwd);
    console.log(testResult.passed ? "Tests passed ✅" : `Tests failed ❌ (exit code ${testResult.exitCode})`);
    if (!testResult.passed) console.log(testResult.output.slice(0, 1000));

    const evidenceFile = writeEvidence({ project, feature, story, tcs, testResult });
    console.log(`Evidence: ${path.relative(cwd, evidenceFile)}`);

    return testResult.passed ? OK : ERROR;
  }

  return OK;
}

export async function runExecuteCommand({
  options,
  getProjectContextOrExit,
  exitCodes
}) {
  const { OK, ERROR } = exitCodes;

  const rawFeatureInput = String(options.feature || options.positional[0] || "").trim();
  const feature = normalizeFeatureName(rawFeatureInput);

  if (!feature) {
    console.log("Feature name is required. Use --feature <name>.");
    return ERROR;
  }

  const project = getProjectContextOrExit();

  // Load story order
  const orderFile = project.paths.implementationOrderFile(feature);
  let allStories = [];
  if (fs.existsSync(orderFile)) {
    const orderContent = fs.readFileSync(orderFile, "utf8");
    allStories = [...new Set([...orderContent.matchAll(/\b(US-\d+)\b/g)].map(m => m[1]))];
  }

  if (options.all) {
    if (allStories.length === 0) {
      console.log(`No stories found. Run \`aitri implement --feature ${feature}\` first.`);
      return ERROR;
    }
    console.log(`Stories to implement: ${allStories.join(", ")}`);
    for (const story of allStories) {
      const code = await executeStory({ feature, story, options, project, exitCodes, allStories });
      if (code !== OK && !options.continueOnFail) return code;
    }
    return OK;
  }

  const story = options.story || options.positional[1];
  if (!story) {
    console.log("Specify a story: --story US-N, or use --all for all stories.");
    if (allStories.length > 0) console.log(`Available: ${allStories.join(", ")}`);
    return ERROR;
  }

  return executeStory({ feature, story, options, project, exitCodes, allStories });
}
