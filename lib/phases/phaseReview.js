/**
 * Module: Phase review — Code Review
 * Purpose: Independent Code Reviewer persona. Reviews implementation against requirements and test specs.
 * Artifact: 04_CODE_REVIEW.md
 * Optional phase — run between Phase 4 approve and aitri verify.
 */

import { ROLE, CONSTRAINTS, REASONING } from '../personas/reviewer.js';
import { render } from '../prompts/render.js';
import { head } from './context.js';

/**
 * Extract the code-review verdict from 04_CODE_REVIEW.md.
 *
 * Reads the `## Verdict` section specifically (not the whole doc) so the verdict
 * word in prose or the Issues list does not false-match, and strips bracketed
 * placeholders like `[PASS | CONDITIONAL_PASS | FAIL]`. Precedence FAIL >
 * CONDITIONAL_PASS > PASS — the worst stated verdict wins.
 *
 * @param {string} content
 * @returns {'PASS'|'CONDITIONAL_PASS'|'FAIL'|null}
 */
export function extractReviewVerdict(content) {
  if (typeof content !== 'string') return null;
  let section = content;
  const heading = content.match(/^##\s+.*Verdict.*$/mi);
  if (heading) {
    const rest = content.slice(heading.index + heading[0].length);
    const next = rest.search(/^##\s+/m);
    section = next === -1 ? rest : rest.slice(0, next);
  }
  const cleaned = section.replace(/\[[^\]]*\]/g, ' '); // drop placeholder menus
  if (/\bFAIL\b/.test(cleaned)) return 'FAIL';
  if (/\bCONDITIONAL_PASS\b/.test(cleaned)) return 'CONDITIONAL_PASS';
  if (/\bPASS\b/.test(cleaned)) return 'PASS';
  return null;
}

export default {
  num: 'review',
  name: 'Code Review',
  persona: 'Code Reviewer',
  artifact: '04_CODE_REVIEW.md',
  inputs: ['01_REQUIREMENTS.json', '03_TEST_CASES.json', '04_IMPLEMENTATION_MANIFEST.json'],

  extractContext: (content) => head(content, 80),

  extractVerdict: extractReviewVerdict,

  validate(content) {
    if (content.split('\n').length < 20)
      throw new Error('04_CODE_REVIEW.md too short — a credible review requires at least 20 lines');
    const VERDICTS = ['PASS', 'CONDITIONAL_PASS', 'FAIL'];
    if (!VERDICTS.some(v => content.includes(v)))
      throw new Error(`04_CODE_REVIEW.md missing verdict — must include PASS, CONDITIONAL_PASS, or FAIL`);
    if (!/^##\s+.*Issue/mi.test(content))
      throw new Error('04_CODE_REVIEW.md missing ## Issues section');
    if (!/^##\s+.*Verdict/mi.test(content))
      throw new Error('04_CODE_REVIEW.md missing ## Verdict section');
  },

  buildBriefing({ dir, inputs, feedback, artifactsBase, scopeVerb = '', scopeArg = '' }) {
    let manifest = {};
    try { manifest = JSON.parse(inputs['04_IMPLEMENTATION_MANIFEST.json']); } catch {}

    const fileList = manifest.files_created?.map(f => `  - ${f}`).join('\n') || '  (no files listed in manifest)';
    const debtList = manifest.technical_debt?.length
      ? manifest.technical_debt.map(d => `  - ${d.fr_id}: ${d.substitution}`).join('\n')
      : '  (none declared)';

    return render('phases/phaseReview', {
      ROLE, CONSTRAINTS, REASONING,
      FEEDBACK: feedback || '',
      FILE_LIST: fileList,
      DEBT_LIST: debtList,
      REQUIREMENTS_JSON: inputs['01_REQUIREMENTS.json'],
      TEST_CASES_JSON: inputs['03_TEST_CASES.json'],
      DIR: dir,
      ARTIFACTS_BASE: artifactsBase || dir,
      SCOPE_VERB: scopeVerb,
      SCOPE_ARG:  scopeArg,
    });
  },
};
