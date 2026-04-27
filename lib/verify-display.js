/**
 * Module: Verify count display formatter
 * Purpose: Render `04_TEST_RESULTS.json::summary` (or any equivalent counts shape
 *          carrying `{ passed, failed, skipped, manual, total }`) as a compact
 *          three-bucket breakdown for human terminal output.
 *
 * Why this exists:
 *   The previous display rendered `(passed/total)` next to a `verify ✅` badge.
 *   On projects with many skipped or manual TCs, the ratio looked like a low
 *   passing rate — e.g. `verify ✅ (2/51)` reads as 4% even though it means
 *   "2 passed, 0 failed, 49 deferred (skipped/manual)" and every MUST FR is
 *   covered. Confirmed across three canaries (Zombite 4%, Hub 70-84%,
 *   Cesar 66-100%) on v2.0.0-alpha.4.
 *
 *   The fix surfaces the three buckets explicitly so the numbers no longer
 *   contradict the badge:
 *     verify ✅ (2 ✓ 0 ✗ 49 ⊘)
 *
 * Symbols (chosen for visual contrast with the verdict badge):
 *   ✓  passed (status === 'pass')
 *   ✗  failed (status === 'fail')
 *   ⊘  deferred = skipped + manual (not executed by the runner)
 *
 *   The verdict badge (✅ / ❌ / ⬜) stays as the headline; these counts
 *   describe coverage breadth, not the gate verdict.
 *
 * Contract: any consumer that previously rendered `(passed/total)` should
 * call this helper. Single source of truth → status.js / resume.js / validate.js.
 */

/**
 * Format a verify summary as a compact three-bucket breakdown.
 *
 * @param {object|null|undefined} summary - shape: { passed, failed, skipped, manual, total }
 * @returns {string} `(P ✓ F ✗ D ⊘)` with leading space, or '' when summary absent / no total
 */
export function formatVerifyCounts(summary) {
  if (!summary || summary.total == null) return '';
  const passed   = summary.passed  ?? 0;
  const failed   = summary.failed  ?? 0;
  const skipped  = summary.skipped ?? 0;
  const manual   = summary.manual  ?? 0;
  const deferred = skipped + manual;
  return ` (${passed} ✓ ${failed} ✗ ${deferred} ⊘)`;
}
