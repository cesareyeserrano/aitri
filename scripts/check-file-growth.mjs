#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const budgetFile = path.join(repoRoot, "docs", "quality", "file-size-budgets.json");

function parseArgs(argv) {
  return {
    strict: argv.includes("--strict"),
    json: argv.includes("--json")
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(`Failed to read JSON: ${file} (${detail})`);
    process.exit(1);
  }
}

function countLines(content) {
  if (content.length === 0) return 0;
  const newlineCount = (content.match(/\n/g) || []).length;
  return content.endsWith("\n") ? newlineCount : newlineCount + 1;
}

function classify(lines, soft, hard) {
  if (lines > hard) return "block";
  if (lines > soft) return "warn";
  return "ok";
}

function formatRow(result) {
  const tag = result.status.toUpperCase().padEnd(5, " ");
  return `${tag} ${String(result.lines).padStart(4, " ")} lines | soft ${String(result.soft).padStart(4, " ")} | hard ${String(result.hard).padStart(4, " ")} | ${result.path}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const budgets = readJson(budgetFile);
  const defaults = budgets.defaults || {};
  const targets = Array.isArray(budgets.files) ? budgets.files : [];

  const results = targets.map((entry) => {
    const rel = String(entry.path || "").trim();
    const abs = path.join(repoRoot, rel);
    const soft = Number(entry.soft ?? defaults.soft ?? 900);
    const hard = Number(entry.hard ?? defaults.hard ?? 1200);

    if (!rel || !Number.isFinite(soft) || !Number.isFinite(hard) || soft <= 0 || hard <= 0 || soft >= hard) {
      return {
        path: rel || "(missing path)",
        lines: 0,
        soft,
        hard,
        status: "block",
        reason: "invalid_budget_entry"
      };
    }

    if (!fs.existsSync(abs)) {
      return {
        path: rel,
        lines: 0,
        soft,
        hard,
        status: "block",
        reason: "file_missing"
      };
    }

    const lines = countLines(fs.readFileSync(abs, "utf8"));
    return {
      path: rel,
      lines,
      soft,
      hard,
      status: classify(lines, soft, hard),
      reason: "measured"
    };
  });

  const summary = {
    total: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    warn: results.filter((r) => r.status === "warn").length,
    block: results.filter((r) => r.status === "block").length
  };

  const payload = {
    ok: summary.block === 0,
    mode: options.strict ? "strict" : "warn-only",
    source: path.relative(repoRoot, budgetFile),
    summary,
    results
  };

  if (options.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log("Aitri file-growth budget report");
    console.log(`Mode: ${payload.mode}`);
    console.log(`Source: ${payload.source}`);
    console.log("");
    results.forEach((result) => console.log(formatRow(result)));
    console.log("");
    console.log(`Summary: ok=${summary.ok}, warn=${summary.warn}, block=${summary.block}, total=${summary.total}`);
    if (summary.warn > 0) {
      console.log("Policy: soft-budget warnings require explicit note in PR/commit rationale.");
    }
    if (summary.block > 0) {
      console.log("Policy: hard-budget or invalid entries are blocking in strict mode.");
    }
  }

  if (options.strict && summary.block > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main();
