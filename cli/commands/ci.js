import fs from "node:fs";
import path from "node:path";

const AITRI_CI_MARKER = "# Aitri SDLC Gates";

const GITHUB_WORKFLOW = `name: Aitri SDLC Gates
on: [push, pull_request]
jobs:
  aitri:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx aitri doctor --non-interactive --json
      - run: npx aitri validate --non-interactive --format json || true
      - run: npm test
`;

export async function runCiCommand({ options, getProjectContextOrExit, confirmProceed, exitCodes }) {
  const { OK, ERROR } = exitCodes;
  const subcommand = options.positional[0] || options.action || "status";
  const provider = options.provider || "github";

  if (provider !== "github") {
    console.log(`Provider '${provider}' is not yet supported. Only 'github' is supported in this version.`);
    return ERROR;
  }

  const cwd = process.cwd();
  const workflowDir = path.join(cwd, ".github", "workflows");
  const workflowFile = path.join(workflowDir, "aitri.yml");

  if (subcommand === "init") {
    const exists = fs.existsSync(workflowFile);
    const plan = [
      exists
        ? `Overwrite: .github/workflows/aitri.yml (already exists)`
        : `Create: .github/workflows/aitri.yml`
    ];

    console.log("PLAN:");
    plan.forEach(p => console.log("- " + p));

    const proceed = await confirmProceed(options);
    if (proceed === null) {
      console.log("Non-interactive mode requires --yes for commands that modify files.");
      return ERROR;
    }
    if (!proceed) {
      console.log("Aborted.");
      return exitCodes.ABORTED !== undefined ? exitCodes.ABORTED : ERROR;
    }

    fs.mkdirSync(workflowDir, { recursive: true });
    fs.writeFileSync(workflowFile, GITHUB_WORKFLOW, "utf8");

    const result = { ok: true, provider, file: ".github/workflows/aitri.yml" };
    if (options.json || options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`CI workflow created: .github/workflows/aitri.yml`);
      console.log("Commit this file to enable Aitri gates in GitHub Actions.");
    }
    return OK;
  }

  if (subcommand === "status") {
    const exists = fs.existsSync(workflowFile);
    let isAitri = false;
    if (exists) {
      try {
        const content = fs.readFileSync(workflowFile, "utf8");
        isAitri = content.includes(AITRI_CI_MARKER);
      } catch {
        isAitri = false;
      }
    }

    const result = { ok: true, provider, file: ".github/workflows/aitri.yml", exists, isAitriManaged: isAitri };
    if (options.json || options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      if (!exists) {
        console.log("CI workflow not found. Run `aitri ci init` to generate it.");
      } else if (!isAitri) {
        console.log(".github/workflows/aitri.yml exists but was not created by Aitri.");
      } else {
        console.log(".github/workflows/aitri.yml is installed and managed by Aitri.");
      }
    }
    return OK;
  }

  console.log(`Unknown ci subcommand: ${subcommand}. Use: init | status`);
  return ERROR;
}
