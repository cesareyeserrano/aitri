/**
 * Migration module: from v0.1.65 (Ultron baseline) toward current.
 *
 * Addresses BLOCKING drift identified in the Ultron E2E session
 * (docs/Aitri_Design_Notes/FEEDBACK.md items A1, A2, F7).
 *
 * Pre-v0.1.65-era projects used:
 *   - test_cases[].requirement                        → test_cases[].requirement_id
 *   - non_functional_requirements[].{title, constraint} → {category, requirement}
 *
 * Without these migrations the artifacts fail current validators
 * (phase3.js:81 throws on missing requirement_id) or render incorrectly in
 * downstream projections (snapshot.js tolerates NFR via fallback — the
 * v0.1.90 defensive layer — but the underlying shape is still wrong).
 *
 * Compliance with ADR-027 Addendum §2 (shape-only transforms):
 *   - TC.requirement → requirement_id: mechanical rename WHEN the value is a
 *     single FR id (matches /^FR-\d+$/). Comma-separated or otherwise
 *     non-canonical values are FLAGGED for agent review — never auto-split,
 *     because splitting a multi-FR TC into N TCs requires semantic choices
 *     (test naming, AC allocation) that belong to the agent.
 *   - NFR.constraint → NFR.requirement: mechanical rename.
 *   - NFR.title  → NFR.category: mechanical rename ONLY when the title value
 *     is a case-insensitive match of a known category
 *     (Performance|Security|Reliability|Scalability|Usability). Otherwise
 *     FLAGGED — choosing a category from free-text is semantic.
 *
 * Idempotence: diagnose() returns no auto-migratable findings for artifacts
 * already on the new shape. Re-running migrate() on a migrated project is a
 * no-op.
 */

import fs from 'fs';
import { artifactPath, hashArtifact, appendEvent } from '../../state.js';

export const FROM_VERSION = '0.1.65';

const SINGLE_FR_REGEX = /^FR-\d+$/;

const VALID_NFR_CATEGORIES = ['Performance', 'Security', 'Reliability', 'Scalability', 'Usability'];
const CATEGORY_LOOKUP = new Map(VALID_NFR_CATEGORIES.map(c => [c.toLowerCase(), c]));

/**
 * Inspect the project and return drift findings.
 * Pure read — never mutates config or writes artifacts.
 *
 * @param {string} dir
 * @param {object} config
 * @returns {Array<object>} Findings. Each has: { category, target, transform, autoMigratable, reason?, apply? }
 */
export function diagnose(dir, config) {
  return [
    ...diagnoseTestCases(dir, config),
    ...diagnoseNonFunctionalRequirements(dir, config),
  ];
}

/**
 * Apply auto-migratable findings. Writes artifacts and appends
 * `upgrade_migration` events into config.events (persisted by caller).
 *
 * @param {string} dir
 * @param {object} config
 * @param {string} targetVersion CLI VERSION written into events.
 * @returns {{ migrated: object[], flagged: object[] }}
 */
export function migrate(dir, config, targetVersion) {
  const findings = diagnose(dir, config);
  const migrated = [];
  const flagged  = [];

  for (const f of findings) {
    if (f.autoMigratable) {
      f.apply();
      appendEvent(config, 'upgrade_migration', 'upgrade', {
        from_version: FROM_VERSION,
        to_version:   targetVersion,
        category:     f.category,
        target:       f.target,
        before_hash:  f.beforeHash,
        after_hash:   f.afterHash,
        transform:    f.transform,
      });
      migrated.push(f);
    } else {
      flagged.push(f);
    }
  }

  return { migrated, flagged };
}

// ── TC: requirement → requirement_id ─────────────────────────────────────────

function diagnoseTestCases(dir, config) {
  const rel  = '03_TEST_CASES.json';
  const full = artifactPath(dir, config, rel);
  if (!fs.existsSync(full)) return [];

  let raw, data;
  try {
    raw  = fs.readFileSync(full, 'utf8');
    data = JSON.parse(raw);
  } catch { return []; }

  const tcs = Array.isArray(data.test_cases) ? data.test_cases : [];
  const renamable = [];   // single-FR: mechanical
  const flagOnly  = [];   // multi-FR or non-canonical: flag

  for (let i = 0; i < tcs.length; i++) {
    const tc = tcs[i];
    if (tc.requirement_id) continue;                      // already on new shape
    if (typeof tc.requirement !== 'string') continue;
    const v = tc.requirement.trim();
    if (SINGLE_FR_REGEX.test(v)) renamable.push({ i, value: v });
    else                          flagOnly.push({ i, value: v });
  }

  const findings = [];

  if (renamable.length > 0) {
    const beforeHash = hashArtifact(raw);
    const newData    = JSON.parse(raw);
    for (const { i, value } of renamable) {
      newData.test_cases[i].requirement_id = value;
      delete newData.test_cases[i].requirement;
    }
    const afterContent = JSON.stringify(newData, null, 2);
    const afterHash    = hashArtifact(afterContent);

    findings.push({
      category:       'blocking',
      target:         rel,
      transform:      `rename test_cases[*].requirement → requirement_id (${renamable.length} TC${renamable.length === 1 ? '' : 's'})`,
      autoMigratable: true,
      beforeHash,
      afterHash,
      apply: () => fs.writeFileSync(full, afterContent, 'utf8'),
    });
  }

  if (flagOnly.length > 0) {
    findings.push({
      category:       'validatorGap',
      target:         rel,
      transform:      `TCs with non-canonical requirement (${flagOnly.length})`,
      autoMigratable: false,
      reason:         'Value is not a single FR id (e.g. comma-separated or malformed). Splitting a multi-FR TC requires semantic choices; agent must re-author these TCs against the current schema.',
    });
  }

  return findings;
}

// ── NFR: {title, constraint} → {category, requirement} ───────────────────────

function diagnoseNonFunctionalRequirements(dir, config) {
  const rel  = '01_REQUIREMENTS.json';
  const full = artifactPath(dir, config, rel);
  if (!fs.existsSync(full)) return [];

  let raw, data;
  try {
    raw  = fs.readFileSync(full, 'utf8');
    data = JSON.parse(raw);
  } catch { return []; }

  const nfrs = Array.isArray(data.non_functional_requirements) ? data.non_functional_requirements : [];

  const constraintIdx   = [];   // has constraint, no requirement   — mechanical
  const titleMatchIdx   = [];   // title matches valid category     — mechanical
  const titleMissingCat = [];   // has title, no category, not a match — flag

  for (let i = 0; i < nfrs.length; i++) {
    const nfr = nfrs[i];
    if (typeof nfr.constraint === 'string' && !nfr.requirement) {
      constraintIdx.push(i);
    }
    if (typeof nfr.title === 'string' && !nfr.category) {
      const canonical = CATEGORY_LOOKUP.get(nfr.title.trim().toLowerCase());
      if (canonical) titleMatchIdx.push({ i, canonical });
      else           titleMissingCat.push(i);
    }
  }

  const findings = [];
  const mechanicalCount = constraintIdx.length + titleMatchIdx.length;

  if (mechanicalCount > 0) {
    const beforeHash = hashArtifact(raw);
    const newData    = JSON.parse(raw);
    for (const i of constraintIdx) {
      newData.non_functional_requirements[i].requirement = newData.non_functional_requirements[i].constraint;
      delete newData.non_functional_requirements[i].constraint;
    }
    for (const { i, canonical } of titleMatchIdx) {
      newData.non_functional_requirements[i].category = canonical;
      delete newData.non_functional_requirements[i].title;
    }
    const afterContent = JSON.stringify(newData, null, 2);
    const afterHash    = hashArtifact(afterContent);

    const parts = [];
    if (constraintIdx.length) parts.push(`constraint → requirement (${constraintIdx.length})`);
    if (titleMatchIdx.length) parts.push(`title → category via lookup (${titleMatchIdx.length})`);

    findings.push({
      category:       'blocking',
      target:         rel,
      transform:      `rewrite non_functional_requirements[*]: ${parts.join(', ')}`,
      autoMigratable: true,
      beforeHash,
      afterHash,
      apply: () => fs.writeFileSync(full, afterContent, 'utf8'),
    });
  }

  if (titleMissingCat.length > 0) {
    findings.push({
      category:       'validatorGap',
      target:         rel,
      transform:      `NFRs with free-text title, no category (${titleMissingCat.length})`,
      autoMigratable: false,
      reason:         `Title value does not match a known category. Current schema requires category ∈ {${VALID_NFR_CATEGORIES.join(', ')}}. Choosing one is semantic — agent must assign per NFR.`,
    });
  }

  return findings;
}
