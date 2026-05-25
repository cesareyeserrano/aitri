/**
 * Module: Prompt Template Renderer
 * Purpose: Load and render .md templates from templates/ with data injection.
 * Dependencies: Node.js built-ins only (fs, url, path)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, '..', '..', 'templates');

/**
 * Render a prompt template with data injection.
 * Supports:
 *   {{KEY}}             — replaced with data[key] or ''
 *   {{#IF_KEY}}...{{/IF_KEY}} — block removed when data[key] is falsy
 *
 * @param {string} name - Template path relative to templates/ (without .md), e.g. 'phases/phase4'
 * @param {Record<string, string>} data - Placeholder values
 * @returns {string} Rendered prompt string
 */
export function render(name, data) {
  const template = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf8');

  // Process conditional blocks first (non-greedy, no nesting)
  let result = template.replace(
    /\{\{#IF_(\w+)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g,
    (_, key, content) => (data[key] ? content : ''),
  );

  // Replace simple placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) =>
    key in data ? String(data[key]) : '',
  );

  return result;
}

/**
 * Extract the "## Human Review" checklist block from a phase template, raw
 * (conditional blocks unwrapped, placeholders stripped). Single source: the
 * checklist lives in the template; `approve` prints it verbatim at approval
 * time so the human sees the real items without re-opening the briefing.
 *
 * @param {string} name - Template path relative to templates/ (without .md), e.g. 'phases/deploy'
 * @returns {string|null} The checklist block (header + items), or null if absent/unreadable
 */
export function extractHumanReview(name) {
  let template;
  try { template = readFileSync(join(TEMPLATES_DIR, `${name}.md`), 'utf8'); }
  catch { return null; }
  // From the "## ... Human Review ..." header up to the next top-level "## " section or EOF.
  const m = template.match(/##+\s*Human Review[\s\S]*?(?=\n##\s|$)/);
  if (!m) return null;
  return m[0]
    .replace(/\{\{#IF_(\w+)\}\}([\s\S]*?)\{\{\/IF_\1\}\}/g, '$2') // unwrap conditionals (keep body)
    .replace(/\{\{(\w+)\}\}/g, '')                                // drop remaining placeholders
    .trimEnd();
}
