import fs from "node:fs";
import path from "node:path";

const AITRI_MARKER = "# Aitri";

const PRE_COMMIT_CONTENT = `#!/bin/sh
# Aitri pre-commit hook
BRANCH=$(git branch --show-current 2>/dev/null || echo "")
npx --yes aitri@latest doctor --non-interactive --json > /dev/null 2>&1 || true
exit 0
`;

const PRE_PUSH_CONTENT = `#!/bin/sh
# Aitri pre-push hook: validate before push
FEATURE=$(git branch --show-current 2>/dev/null | sed 's|.*/||' || echo "")
if [ -n "$FEATURE" ]; then
  npx --yes aitri validate --feature "$FEATURE" --non-interactive --format json > /dev/null 2>&1
  CODE=$?
  if [ $CODE -ne 0 ]; then
    echo "Aitri: validate failed for feature '$FEATURE'. Run: aitri validate --feature $FEATURE"
    exit 1
  fi
fi
exit 0
`;

function getGitDir(cwd) {
  const gitDir = path.join(cwd, ".git");
  if (fs.existsSync(gitDir)) return gitDir;
  return null;
}

function isAitriHook(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return content.includes(AITRI_MARKER);
  } catch {
    return false;
  }
}

function installHook(hooksDir, hookName, content) {
  const hookPath = path.join(hooksDir, hookName);
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(hookPath, content, { mode: 0o755 });
  return hookPath;
}

function removeHook(hooksDir, hookName) {
  const hookPath = path.join(hooksDir, hookName);
  if (isAitriHook(hookPath)) {
    fs.unlinkSync(hookPath);
    return true;
  }
  return false;
}

export async function runHooksCommand({ options, getProjectContextOrExit, confirmProceed, exitCodes }) {
  const { OK, ERROR } = exitCodes;
  const subcommand = options.positional[0] || options.action || "status";
  const hookFlag = options.hook || "all";

  const cwd = process.cwd();
  const gitDir = getGitDir(cwd);

  if (!gitDir) {
    console.log("No .git directory found. Run from the root of a git repository.");
    return ERROR;
  }

  const hooksDir = path.join(gitDir, "hooks");
  const preCommitPath = path.join(hooksDir, "pre-commit");
  const prePushPath = path.join(hooksDir, "pre-push");

  const wantsPreCommit = hookFlag === "all" || hookFlag === "pre-commit";
  const wantsPrePush = hookFlag === "all" || hookFlag === "pre-push";

  if (subcommand === "install") {
    const plan = [];
    if (wantsPreCommit) plan.push(`Write: .git/hooks/pre-commit`);
    if (wantsPrePush) plan.push(`Write: .git/hooks/pre-push`);

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

    const installed = { preCommit: false, prePush: false };

    if (wantsPreCommit) {
      installHook(hooksDir, "pre-commit", PRE_COMMIT_CONTENT);
      installed.preCommit = true;
      console.log("Installed: .git/hooks/pre-commit");
    }
    if (wantsPrePush) {
      installHook(hooksDir, "pre-push", PRE_PUSH_CONTENT);
      installed.prePush = true;
      console.log("Installed: .git/hooks/pre-push");
    }

    const result = { ok: true, installed };
    if (options.json || options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log("Hooks installed successfully.");
    }
    return OK;
  }

  if (subcommand === "status") {
    const preCommitInstalled = isAitriHook(preCommitPath);
    const prePushInstalled = isAitriHook(prePushPath);
    const result = {
      ok: true,
      installed: { preCommit: preCommitInstalled, prePush: prePushInstalled }
    };

    if (options.json || options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`pre-commit hook: ${preCommitInstalled ? "installed (aitri)" : "not installed"}`);
      console.log(`pre-push hook:   ${prePushInstalled ? "installed (aitri)" : "not installed"}`);
      if (!preCommitInstalled && !prePushInstalled) {
        console.log("\nRun `aitri hooks install` to set up git hooks.");
      }
    }
    return OK;
  }

  if (subcommand === "remove") {
    const removed = { preCommit: false, prePush: false };

    if (wantsPreCommit) {
      removed.preCommit = removeHook(hooksDir, "pre-commit");
      if (removed.preCommit) console.log("Removed: .git/hooks/pre-commit");
      else console.log("pre-commit: not an aitri hook, skipping.");
    }
    if (wantsPrePush) {
      removed.prePush = removeHook(hooksDir, "pre-push");
      if (removed.prePush) console.log("Removed: .git/hooks/pre-push");
      else console.log("pre-push: not an aitri hook, skipping.");
    }

    const result = { ok: true, removed };
    if (options.json || options.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    }
    return OK;
  }

  console.log(`Unknown hooks subcommand: ${subcommand}. Use: install | status | remove`);
  return ERROR;
}
