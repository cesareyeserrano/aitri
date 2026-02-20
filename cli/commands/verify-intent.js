import fs from "node:fs";
import path from "node:path";
import { normalizeFeatureName } from "../lib.js";
import { callAI } from "../ai-client.js";

const SYSTEM_PROMPT = `You are a senior QA architect performing semantic traceability validation.
Given a set of Functional Requirements (FRs) from a spec and a User Story (US) with its trace IDs,
determine if the User Story semantically satisfies the intent of the FRs it traces to.

Return ONLY a JSON object with this exact shape (no markdown, no explanation outside the object):
{
  "verdict": "pass" | "fail" | "partial",
  "confidence": "high" | "medium" | "low",
  "reason": "<one concise sentence explaining the verdict>"
}

Verdict guidance:
- "pass": The US clearly covers the FR intent — behavior, actor, and outcome align.
- "partial": The US covers part of the FR intent but misses edge cases or constraints.
- "fail": The US does not satisfy the FR intent or traces to a FR that does not exist.`;

/**
 * Extract Functional Rules from spec content.
 * Returns a map: { "FR-1": "The system must ...", ... }
 */
function extractFRs(specContent) {
  const sectionMatch = specContent.match(
    /## (?:\d+\.?\s*)?Functional Rules(?:\s*\(traceable\))?([\s\S]*?)(\n##\s|\s*$)/
  );
  if (!sectionMatch) return {};

  const frs = {};
  const lines = sectionMatch[1].split("\n").map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^[-*]\s*(FR-\d+)\s*:\s*(.+)/i);
    if (m) frs[m[1].toUpperCase()] = m[2].trim();
  }
  return frs;
}

/**
 * Extract User Stories from backlog content.
 * Returns an array: [{ id: "US-1", text: "...", traces: ["FR-1", "AC-1"] }, ...]
 */
function extractUserStories(backlogContent) {
  const stories = [];
  // Split on ### US-N headings
  const chunks = backlogContent.split(/(?=###\s+US-\d+)/);
  for (const chunk of chunks) {
    const idMatch = chunk.match(/###\s+(US-\d+)/i);
    if (!idMatch) continue;
    const id = idMatch[1].toUpperCase();

    // Story text: the "As a..." line
    const textLines = chunk.split("\n")
      .map(l => l.trim())
      .filter(l => l.startsWith("-") && !/^-\s*Trace:/i.test(l))
      .map(l => l.replace(/^-\s*/, "").trim())
      .filter(Boolean);

    // Trace IDs
    const traceMatch = chunk.match(/Trace:\s*([^\n]+)/i);
    const traces = traceMatch
      ? traceMatch[1].split(",").map(t => t.trim().toUpperCase()).filter(Boolean)
      : [];

    stories.push({ id, text: textLines.join(" "), traces });
  }
  return stories;
}

/**
 * aitri verify-intent --feature <name> [--story US-N] [--json]
 *
 * Checks if User Stories in the backlog semantically satisfy the FR intent in the spec.
 * Calls ai-client with spec context per US.
 */
export async function runVerifyIntentCommand({ options, getProjectContextOrExit, exitCodes }) {
  const { OK, ERROR } = exitCodes;

  const rawFeatureInput = String(options.feature || options.positional[0] || "").trim();
  const feature = normalizeFeatureName(rawFeatureInput);

  if (!feature) {
    const msg = "Feature name is required. Use --feature <name>.";
    if (options.json || options.format === "json" || options.nonInteractive) {
      console.log(JSON.stringify({ ok: false, error: msg }));
    } else {
      console.log(msg);
    }
    return ERROR;
  }

  const project = getProjectContextOrExit();
  const aiConfig = project.config.ai || {};

  // Require approved spec
  const specFile = project.paths.approvedSpecFile(feature);
  if (!fs.existsSync(specFile)) {
    const msg = `Approved spec not found for '${feature}'. Run \`aitri approve --feature ${feature}\` first.`;
    if (options.json || options.format === "json" || options.nonInteractive) {
      console.log(JSON.stringify({ ok: false, feature, error: msg }));
    } else {
      console.log(msg);
    }
    return ERROR;
  }

  // Require backlog
  const backlogFile = project.paths.backlogFile(feature);
  if (!fs.existsSync(backlogFile)) {
    const msg = `Backlog not found for '${feature}'. Run \`aitri plan --feature ${feature}\` first.`;
    if (options.json || options.format === "json" || options.nonInteractive) {
      console.log(JSON.stringify({ ok: false, feature, error: msg }));
    } else {
      console.log(msg);
    }
    return ERROR;
  }

  const specContent = fs.readFileSync(specFile, "utf8");
  const backlogContent = fs.readFileSync(backlogFile, "utf8");

  const frs = extractFRs(specContent);
  let stories = extractUserStories(backlogContent);

  // Filter to single story if --story provided
  const storyFilter = options.story ? options.story.trim().toUpperCase() : null;
  if (storyFilter) {
    stories = stories.filter(s => s.id === storyFilter);
    if (stories.length === 0) {
      const msg = `Story '${storyFilter}' not found in backlog for '${feature}'.`;
      if (options.json || options.format === "json" || options.nonInteractive) {
        console.log(JSON.stringify({ ok: false, feature, error: msg }));
      } else {
        console.log(msg);
      }
      return ERROR;
    }
  }

  if (stories.length === 0) {
    const msg = "No User Stories found in backlog. Run `aitri plan` to generate them.";
    if (options.json || options.format === "json" || options.nonInteractive) {
      console.log(JSON.stringify({ ok: false, feature, error: msg }));
    } else {
      console.log(msg);
    }
    return ERROR;
  }

  // Graceful degradation when AI is not configured
  if (!aiConfig.provider) {
    const hint = [
      "AI is not configured. To use verify-intent, add an `ai` section to .aitri.json:",
      "",
      '  "ai": {',
      '    "provider": "claude",',
      '    "model": "claude-opus-4-6",',
      '    "apiKeyEnv": "ANTHROPIC_API_KEY"',
      "  }"
    ].join("\n");

    if (options.json || options.format === "json" || options.nonInteractive) {
      console.log(JSON.stringify({
        ok: false,
        feature,
        status: "intent-unavailable",
        error: "AI not configured",
        hint: "Add an `ai` section to .aitri.json with provider, model, and apiKeyEnv."
      }));
    } else {
      console.log(hint);
    }
    return ERROR;
  }

  if (!options.nonInteractive) {
    console.log(`Verifying intent for '${feature}' (${stories.length} story/stories)...`);
  }

  const frSummary = Object.entries(frs)
    .map(([id, text]) => `${id}: ${text}`)
    .join("\n") || "(no FRs found in spec)";

  const results = [];
  let allPass = true;

  for (const story of stories) {
    // Build traced FRs for this US
    const tracedFRs = story.traces
      .filter(t => t.startsWith("FR-"))
      .map(id => frs[id] ? `${id}: ${frs[id]}` : `${id}: (not found in spec)`)
      .join("\n") || "(no FR traces — check backlog Trace: line)";

    const prompt = [
      `Feature: ${feature}`,
      "",
      "All Functional Requirements in spec:",
      frSummary,
      "",
      `User Story ${story.id}:`,
      story.text || "(no story text found)",
      "",
      `Traced FRs for this story: ${story.traces.filter(t => t.startsWith("FR-")).join(", ") || "none"}`,
      tracedFRs,
      "",
      "Does this User Story semantically satisfy the intent of its traced FRs?"
    ].join("\n");

    const aiResult = await callAI({ prompt, systemPrompt: SYSTEM_PROMPT, config: aiConfig });

    if (!aiResult.ok) {
      results.push({ us: story.id, traces: story.traces, verdict: "error", reason: aiResult.error });
      allPass = false;
      continue;
    }

    let parsed = { verdict: "fail", confidence: "low", reason: aiResult.content.trim() };
    try {
      const jsonMatch = aiResult.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // keep defaults above
    }

    if (parsed.verdict !== "pass") allPass = false;
    results.push({ us: story.id, traces: story.traces, ...parsed });
  }

  const output = { ok: allPass, feature, results };

  if (options.json || options.format === "json" || options.nonInteractive) {
    console.log(JSON.stringify(output, null, 2));
  } else {
    const icons = { pass: "✓", partial: "~", fail: "✗", error: "!" };
    console.log(`\nIntent verification — ${feature}\n`);
    for (const r of results) {
      const icon = icons[r.verdict] || "?";
      const traces = r.traces.filter(t => t.startsWith("FR-")).join(", ") || "no FR traces";
      console.log(`  ${icon} ${r.us} [${traces}] — ${r.verdict.toUpperCase()}`);
      if (r.reason) console.log(`    ${r.reason}`);
    }
    const passCount = results.filter(r => r.verdict === "pass").length;
    console.log(`\n${passCount}/${results.length} stories pass intent check.`);
    if (!allPass) {
      console.log(`Review flagged stories in: ${path.relative(process.cwd(), backlogFile)}`);
    }
  }

  return allPass ? OK : ERROR;
}
