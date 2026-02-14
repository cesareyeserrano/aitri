import path from "node:path";
import fs from "node:fs";

export const CONFIG_FILE = "aitri.config.json";
export const DEFAULT_PATHS = Object.freeze({
  specs: "specs",
  backlog: "backlog",
  tests: "tests",
  docs: "docs"
});

function normalizePathLike(value) {
  return String(value || "").replace(/\\/g, "/").replace(/\/+$/g, "").trim();
}

function validateMappedPath(key, value) {
  if (typeof value !== "string" || value.trim() === "") {
    return `paths.${key} must be a non-empty string.`;
  }
  const normalized = normalizePathLike(value);
  if (!normalized || normalized === ".") {
    return `paths.${key} must not be "." or empty.`;
  }
  if (path.isAbsolute(normalized)) {
    return `paths.${key} must be relative, not absolute.`;
  }
  if (normalized.split("/").includes("..")) {
    return `paths.${key} must not contain "..".`;
  }
  return null;
}

function validateConfig(raw) {
  const issues = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    issues.push("Config root must be a JSON object.");
    return issues;
  }

  if (raw.paths !== undefined) {
    if (raw.paths === null || typeof raw.paths !== "object" || Array.isArray(raw.paths)) {
      issues.push("`paths` must be an object when provided.");
    } else {
      const allowed = new Set(["specs", "backlog", "tests", "docs"]);
      Object.keys(raw.paths).forEach((key) => {
        if (!allowed.has(key)) {
          issues.push(`Unsupported key in paths: ${key}. Allowed keys: specs, backlog, tests, docs.`);
          return;
        }
        const issue = validateMappedPath(key, raw.paths[key]);
        if (issue) issues.push(issue);
      });
    }
  }

  return issues;
}

export function loadAitriConfig(root = process.cwd()) {
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) {
    return {
      loaded: false,
      file: CONFIG_FILE,
      paths: { ...DEFAULT_PATHS }
    };
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON";
    throw new Error(`Invalid ${CONFIG_FILE}: ${message}`);
  }

  const issues = validateConfig(raw);
  if (issues.length > 0) {
    throw new Error(`Invalid ${CONFIG_FILE}:\n- ${issues.join("\n- ")}`);
  }

  const mapped = {
    ...DEFAULT_PATHS,
    ...(raw.paths || {})
  };

  return {
    loaded: true,
    file: CONFIG_FILE,
    paths: mapped
  };
}

export function resolveProjectPaths(root, mappedPaths) {
  const paths = mappedPaths || DEFAULT_PATHS;
  const specsRoot = path.join(root, paths.specs);
  const backlogRoot = path.join(root, paths.backlog);
  const testsRoot = path.join(root, paths.tests);
  const docsRoot = path.join(root, paths.docs);

  return {
    root,
    mapped: { ...paths },
    specsRoot,
    backlogRoot,
    testsRoot,
    docsRoot,
    specsDraftsDir: path.join(specsRoot, "drafts"),
    specsApprovedDir: path.join(specsRoot, "approved"),
    docsDiscoveryDir: path.join(docsRoot, "discovery"),
    docsPlanDir: path.join(docsRoot, "plan"),
    docsVerificationDir: path.join(docsRoot, "verification"),
    draftSpecFile(feature) {
      return path.join(specsRoot, "drafts", `${feature}.md`);
    },
    approvedSpecFile(feature) {
      return path.join(specsRoot, "approved", `${feature}.md`);
    },
    discoveryFile(feature) {
      return path.join(docsRoot, "discovery", `${feature}.md`);
    },
    planFile(feature) {
      return path.join(docsRoot, "plan", `${feature}.md`);
    },
    backlogFile(feature) {
      return path.join(backlogRoot, feature, "backlog.md");
    },
    testsFile(feature) {
      return path.join(testsRoot, feature, "tests.md");
    },
    verificationFile(feature) {
      return path.join(docsRoot, "verification", `${feature}.json`);
    }
  };
}
