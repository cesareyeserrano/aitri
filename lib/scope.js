/**
 * Module: Scope helpers
 * Purpose: Single source of truth for constructing scope-aware command strings
 *          and template variables. A "feature pipeline" is dispatched by
 *          `feature.js` with `featureRoot` set to the parent project dir and
 *          `scopeName` set to the feature directory name. Every command and
 *          briefing instruction printed during a feature run must include the
 *          `feature <scopeName> ` infix so an agent following the instruction
 *          literally targets the feature, not the parent.
 *
 * Why this exists (v2.0.0-alpha.6):
 *   Ultron canary 2026-04-27 surfaced a destructive bug: the post-`approve`
 *   PIPELINE INSTRUCTION emitted `aitri run-phase ux` while the user was in
 *   a feature pipeline. The literal command targets the parent project's
 *   already-approved UX spec (`/Ultron/spec/01_UX_SPEC.md`, 6 KB, approved
 *   27 Apr 09:02). Saving would have overwritten the parent artifact with
 *   feature-scope content. Same defect class affected complete/reject/verify
 *   and every instruction line in the 11 phase templates.
 *
 *   The fix threads `featureRoot` + `scopeName` through every command and
 *   briefing surface, then constructs commands via `commandPrefix()`. Tests
 *   assert that with `featureRoot` set, every emitted command carries the
 *   `feature <scopeName> ` infix, and with it absent, output is byte-for-byte
 *   identical to the v2.0.0-alpha.5 root-context behavior.
 */

import path from 'node:path';

/**
 * Construct the prefix for `aitri <verb> ...` command strings.
 *
 * Returns:
 *   - `''`                          → root context (no prefix)
 *   - `'feature <scopeName> '`      → feature context (trailing space included
 *                                     so callers can splice via
 *                                     `aitri ${prefix}<verb> ...` without
 *                                     conditional space logic)
 *
 * Callers MUST always pass through this helper rather than inlining a string
 * concatenation — that prevents drift if scope semantics change.
 *
 * @param {string|null|undefined} featureRoot - parent project dir (set by feature.js dispatch); null/undefined = root context
 * @param {string|null|undefined} scopeName   - feature directory name (set by feature.js); ignored when featureRoot is absent
 * @returns {string} prefix string with trailing space when non-empty
 */
export function commandPrefix(featureRoot, scopeName) {
  if (!featureRoot || !scopeName) return '';
  return `feature ${scopeName} `;
}

/**
 * Derive the scope name from a feature directory path. Used as a fallback when
 * `scopeName` was not threaded explicitly through the call chain.
 *
 * @param {string} dir - the working directory (feature dir when featureRoot is set)
 * @returns {string} basename of dir
 */
export function scopeNameFromDir(dir) {
  return path.basename(dir);
}
