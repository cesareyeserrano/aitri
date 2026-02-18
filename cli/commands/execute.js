import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { normalizeFeatureName } from "../lib.js";
import { callAI } from "../ai-client.js";

const SYSTEM_PROMPT = `You are implementing a specific user story for a software project.
Return ONLY code files in this exact format — nothing else:

### FILE: path/to/file.js
\`\`\`javascript
// code here
\`\`\`

### FILE: path/to/another.js
\`\`\`javascript
// more code
\`\`\`

Rules:
- Use relative paths from the project root (e.g., src/controllers/order.js)
- Include ALL necessary code — no placeholder comments
- Follow the spec and test cases exactly
- Only output FILE blocks, no explanations outside them`;

function parseAIFiles(content) {
  const files = [];
  const parts = content.split(/^### FILE:\s*/m);
  for (const part of parts) {
    if (!part.trim()) continue;
    const lines = part.split("\n");
    const filePath = (lines[0] || "").trim();
    if (!filePath) continue;

    const rest = lines.slice(1).join("\n");
    // Extract code from fenced block
    const codeMatch = rest.match(/^```[^\n]*\n([\s\S]*?)```/m);
    const code = codeMatch ? codeMatch[1] : rest.replace(/^```[^\n]*\n?/, "").replace(/```\s*$/, "");

    if (filePath && code.trim()) {
      files.push({ path: filePath, code });
    }
  }
  return files;
}

function extractTCs(testsContent) {
  const tcs = [];
  const matches = testsContent.matchAll(/###\s+(TC-\d+)/g);
  for (const m of matches) tcs.push(m[1]);
  return tcs;
}

function runTests(cwd) {
  const pkgPath = path.join(cwd, "package.json");
  let testCmd = "test";

  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.scripts && pkg.scripts.test) {
        testCmd = "test";
      }
    } catch {
      // use default
    }
  }

  const result = spawnSync("npm", [testCmd, "--", "--passWithNoTests"], {
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

async function executeStory({ feature, story, options, project, confirmProceed, exitCodes }) {
  const { OK, ERROR, ABORTED } = exitCodes;
  const cwd = process.cwd();

  const goFile = project.paths.goMarkerFile(feature);
  if (!fs.existsSync(goFile)) {
    console.log(`Gate failed: go.json not found. Run \`aitri go --feature ${feature}\` first.`);
    return ERROR;
  }

  const aiConfig = project.config.ai || {};
  if (!aiConfig.provider) {
    console.log("AI is not configured. Add an `ai` section to .aitri.json to use `aitri execute`.");
    console.log('  "ai": { "provider": "claude", "model": "claude-opus-4-6", "apiKeyEnv": "ANTHROPIC_API_KEY" }');
    return ERROR;
  }

  // Read context files
  const approvedSpec = project.paths.approvedSpecFile(feature);
  const specContent = fs.existsSync(approvedSpec) ? fs.readFileSync(approvedSpec, "utf8") : "";

  const planFile = project.paths.planFile(feature);
  const planContent = fs.existsSync(planFile) ? fs.readFileSync(planFile, "utf8") : "";

  const implDir = project.paths.implementationFeatureDir(feature);
  const briefFile = path.join(implDir, `${story}.md`);
  const briefContent = fs.existsSync(briefFile) ? fs.readFileSync(briefFile, "utf8") : "";

  if (!briefContent) {
    console.log(`Brief not found: ${path.relative(cwd, briefFile)}`);
    console.log(`Run \`aitri build --story ${story} --feature ${feature}\` to generate it.`);
    return ERROR;
  }

  const testsFile = project.paths.testsFile(feature);
  const testsContent = fs.existsSync(testsFile) ? fs.readFileSync(testsFile, "utf8") : "";
  const tcs = extractTCs(testsContent);

  const prompt = [
    `## Feature Specification`,
    specContent,
    `## Implementation Plan`,
    planContent,
    `## Story Brief: ${story}`,
    briefContent,
    `## Test Cases to Pass`,
    tcs.length > 0 ? tcs.map(tc => `- ${tc}`).join("\n") : "(no test cases listed)",
    "",
    `Implement the ${story} story. Return only FILE blocks as instructed.`
  ].join("\n\n");

  if (!options.nonInteractive) {
    console.log(`\nCalling AI to implement ${story} for feature '${feature}'...`);
  }

  const aiResult = await callAI({ prompt, systemPrompt: SYSTEM_PROMPT, config: aiConfig });

  if (!aiResult.ok) {
    console.log(`AI error: ${aiResult.error}`);
    return ERROR;
  }

  const generatedFiles = parseAIFiles(aiResult.content);

  if (generatedFiles.length === 0) {
    console.log("AI returned no FILE blocks. Cannot proceed.");
    console.log("Raw AI response:");
    console.log(aiResult.content.slice(0, 500));
    return ERROR;
  }

  if (options.dryRun) {
    console.log(`\nDRY RUN — would generate ${generatedFiles.length} file(s):`);
    generatedFiles.forEach(f => console.log(`  ${f.path} (${f.code.split("\n").length} lines)`));
    return OK;
  }

  // Show plan and confirm
  console.log(`\nAI generated ${generatedFiles.length} file(s) for ${story}:`);
  generatedFiles.forEach(f => console.log(`  ${f.path}`));

  const proceed = await confirmProceed(options);
  if (proceed === null) {
    console.log("Non-interactive mode requires --yes for commands that write files.");
    return ERROR;
  }
  if (!proceed) {
    console.log("Aborted.");
    return ABORTED;
  }

  // Write files
  for (const f of generatedFiles) {
    const absPath = path.join(cwd, f.path);
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, f.code, "utf8");
    console.log(`Written: ${f.path}`);
  }

  // Run tests
  let testResult = { passed: null, exitCode: null, output: "" };
  if (!options.noTest) {
    console.log("\nRunning test suite...");
    testResult = runTests(cwd);
    console.log(testResult.passed ? "Tests passed." : `Tests failed (exit code ${testResult.exitCode}).`);
    if (!testResult.passed && testResult.output) {
      console.log(testResult.output.slice(0, 1000));
    }
  }

  // Write execution evidence
  const executionDir = project.paths.docsExecutionDir;
  fs.mkdirSync(executionDir, { recursive: true });
  const evidenceFile = project.paths.executionFile(feature, story);
  const evidence = {
    schemaVersion: 1,
    feature,
    story,
    executedAt: new Date().toISOString(),
    aiProvider: aiConfig.provider,
    filesGenerated: generatedFiles.map(f => f.path),
    testResult,
    tcsCovered: tcs
  };
  fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2), "utf8");
  console.log(`Execution evidence: ${path.relative(cwd, evidenceFile)}`);

  return testResult.passed === false ? ERROR : OK;
}

export async function runExecuteCommand({
  options,
  getProjectContextOrExit,
  confirmProceed,
  runAutoCheckpoint,
  printCheckpointSummary,
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

  if (options.all) {
    // Process all stories in order
    const orderFile = project.paths.implementationOrderFile(feature);
    if (!fs.existsSync(orderFile)) {
      console.log(`IMPLEMENTATION_ORDER.md not found. Run \`aitri build --feature ${feature}\` first.`);
      return ERROR;
    }
    const orderContent = fs.readFileSync(orderFile, "utf8");
    const storyMatches = [...orderContent.matchAll(/\b(US-\d+)\b/g)];
    const stories = [...new Set(storyMatches.map(m => m[1]))];

    if (stories.length === 0) {
      console.log("No stories found in IMPLEMENTATION_ORDER.md.");
      return ERROR;
    }

    console.log(`Executing ${stories.length} stories in order: ${stories.join(", ")}`);

    for (const story of stories) {
      console.log(`\n--- ${story} ---`);
      const code = await executeStory({ feature, story, options, project, confirmProceed, exitCodes });
      if (code !== OK) {
        console.log(`Stopped after ${story} failure. Fix issues and retry.`);
        return code;
      }
    }
    return OK;
  }

  const story = options.story || options.positional[1];
  if (!story) {
    console.log("Specify a story with --story US-N or use --all to run all stories.");
    return ERROR;
  }

  return executeStory({ feature, story, options, project, confirmProceed, exitCodes });
}
