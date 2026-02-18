export function normalizeFeatureName(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw) ? raw : "";
}

export function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractSection(content, heading) {
  const pattern = new RegExp(`${escapeRegExp(heading)}([\\s\\S]*?)(?=\\n##\\s+\\d+\\.|$)`, "i");
  const match = String(content || "").match(pattern);
  return match ? match[1] : "";
}

export function extractSubsection(content, heading) {
  const pattern = new RegExp(`${escapeRegExp(heading)}([\\s\\S]*?)(?=\\n###\\s+|$)`, "i");
  const match = String(content || "").match(pattern);
  return match ? match[1] : "";
}

export function normalizeLine(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveFeature(options, getStatusReportOrExit) {
  const rawFeature = String(options.feature || options.positional[0] || "").trim();
  const fromArgs = normalizeFeatureName(rawFeature);
  if (rawFeature && !fromArgs) {
    throw new Error("Invalid feature name. Use kebab-case (example: user-login).");
  }
  if (fromArgs) return fromArgs;
  const report = getStatusReportOrExit();
  if (report.selection?.issue) {
    throw new Error(report.selection.message || "Feature context is required.");
  }
  if (report.approvedSpec?.feature) return report.approvedSpec.feature;
  throw new Error("Feature name is required. Use --feature <name> or ensure an approved spec exists.");
}
