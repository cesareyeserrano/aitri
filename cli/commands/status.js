import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function exists(p) {
  return fs.existsSync(p);
}

function listMd(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith(".md"));
}

function firstOrNull(arr) {
  return arr.length > 0 ? arr[0] : null;
}

export function runStatus() {
  const root = process.cwd();

  const requiredDirs = ["specs", "backlog", "tests", "docs"];
  const missingDirs = requiredDirs.filter(d => !exists(path.join(root, d)));

  console.log("Aitri Project Status ⚒️\n");

  // 1) Structure
  if (missingDirs.length === 0) {
    console.log("✔ Structure initialized");
  } else {
    console.log("✖ Missing structure:", missingDirs.join(", "));
  }

  // 2) Approved spec
  const approvedDir = path.join(root, "specs", "approved");
  const approvedSpecs = listMd(approvedDir);
  const approvedSpecFile = firstOrNull(approvedSpecs);

  if (approvedSpecFile) {
    const feature = approvedSpecFile.replace(".md", "");
    console.log(`✔ Approved spec found: ${feature}`);

    // 3) Discovery / Plan presence (by feature name)
    const discoveryFile = path.join(root, "docs", "discovery", `${feature}.md`);
    const planFile = path.join(root, "docs", "plan", `${feature}.md`);

    if (exists(discoveryFile)) console.log("✔ Discovery exists");
    else console.log("✖ Discovery not generated");

    if (exists(planFile)) console.log("✔ Plan exists");
    else console.log("✖ Plan not generated");

    // 4) Validate (best effort)
    let validateOk = false;
    try {
      execSync(`aitri validate`, { stdio: "pipe" }); // will prompt; we avoid prompting here
    } catch {
      // ignore: validate is interactive; we only run non-interactive check below
    }

    // Non-interactive validate check: if backlog/tests exist and no placeholders remain
    const backlogFile = path.join(root, "backlog", feature, "backlog.md");
    const testsFile = path.join(root, "tests", feature, "tests.md");

    if (exists(backlogFile) && exists(testsFile)) {
      const backlog = fs.readFileSync(backlogFile, "utf8");
      const tests = fs.readFileSync(testsFile, "utf8");

      const hasPlaceholders =
        backlog.includes("FR-?") ||
        backlog.includes("AC-?") ||
        tests.includes("US-?") ||
        tests.includes("FR-?") ||
        tests.includes("AC-?");

      const hasIds = /###\s+US-\d+/m.test(backlog) && /###\s+TC-\d+/m.test(tests);

      validateOk = hasIds && !hasPlaceholders;
    }

    if (validateOk) console.log("✔ Validation likely passed (no placeholders detected)");
    else console.log("✖ Validation not passed (or cannot be determined)");

    // 5) Next step
    console.log("\nNext recommended step:");
    if (missingDirs.length > 0) console.log("aitri init");
    else if (!approvedSpecFile) console.log("aitri draft");
    else if (!exists(discoveryFile)) console.log("aitri discover");
    else if (!exists(planFile)) console.log("aitri plan");
    else if (!validateOk) console.log("aitri validate");
    else console.log("✅ Ready for human approval → implementation phase");
    return;
  } else {
    console.log("✖ No approved specs found");
    console.log("\nNext recommended step:");
    if (missingDirs.length > 0) console.log("aitri init");
    else console.log("aitri draft");
  }
}