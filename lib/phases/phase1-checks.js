/**
 * Module: Phase 1 semantic checks — shared constants and helpers.
 *
 * Single source of truth for the vagueness / duplicate-AC rules introduced in
 * v0.1.82. Consumed by:
 *   - lib/phases/phase1.js::validate()             — throws on first violation
 *   - lib/upgrade/migrations/from-0.1.65.js        — reports VALIDATOR-GAP findings
 *
 * Both consumers must agree on the exact regex set. Before v2.0.0 these
 * constants were duplicated in from-0.1.65.js with a `MIRROR` comment as the
 * only coupling mechanism — a drift-prone design. This module removes the
 * duplication; `from-0.1.65.js` and `phase1.js` both import the same values.
 *
 * When changing a rule:
 *   1. Edit the constant here.
 *   2. Run `npm run test:all` — phase1 tests + upgrade VALIDATOR-GAP tests
 *      both exercise the rules; one failing set tells you which consumer
 *      broke.
 *   3. Consider whether the change is retroactive: existing projects might
 *      fail the new rule. If yes, the upgrade protocol's VALIDATOR-GAP
 *      finding will report it on next `adopt --upgrade` — no code change
 *      needed on the upgrade side because it already consumes from here.
 */

/**
 * Qualitative vagueness regex — domain-specific qualifiers that MUST FRs with
 * type `ux` / `visual` / `audio` must offset with an observable metric.
 * Narrower than BROAD_VAGUE because qualitative domains legitimately use some
 * abstract words ("smooth animation") but still need a measurable anchor.
 */
export const VAGUE = /\b(good|nice|beautiful|pretty|clean|fast|smooth|responsive|immersive|modern|intuitive|elegant|polished)\b/i;

/**
 * Broad vagueness regex — fires for ALL MUST FR types, both English and
 * Spanish (Aitri supports bilingual projects). Catches "correctly",
 * "efficiently", "seguramente", etc. — words that assert quality without
 * naming a concrete behavior.
 */
export const BROAD_VAGUE = /\b(good|nice|beautiful|pretty|clean|fast|smooth|properly|correctly|efficiently|reliably|appropriately|securely|safely|effectively|adequately|seamlessly|correctamente|adecuadamente|apropiadamente|eficientemente|confiablemente|seguramente|efectivamente|debidamente|bonito|suave|limpio)\b/i;

/**
 * Observable-metric regex — counts as "specific" any AC that contains a
 * number, a unit, or a threshold keyword.
 */
export const HAS_METRIC = /\d|px|ms|%|fps|kb|mb|ratio|:\d|viewport|breakpoint/i;

/**
 * Title-stopword regex — tokens stripped from an FR title before counting
 * "substantive" words. Bilingual (EN + ES) to match BROAD_VAGUE's coverage.
 */
export const TITLE_STOP = /^(the|a|an|la|el|los|las|un|una|de|del|must|should|be|to|is|are|y|o|and|or|in|on|it|this|that|all|debe|se|que|por|para|con|sin|es|app|sistema|system|makes|make|can|will|that|for|of)$/i;

/**
 * Normalize an acceptance_criterion for Jaccard-similarity comparison:
 * lowercase, punctuation stripped (preserving Spanish accented letters),
 * whitespace collapsed.
 */
export const normalizeAC = ac =>
  String(ac).toLowerCase().replace(/[^\w\sáéíóúñ]/gi, ' ').replace(/\s+/g, ' ').trim();
