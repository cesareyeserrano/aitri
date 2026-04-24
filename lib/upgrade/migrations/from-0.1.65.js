/**
 * Migration module: from v0.1.65 (Ultron baseline) toward current.
 *
 * BLOCKING (artifact shape — FEEDBACK A1/A2/F7):
 *   - test_cases[].requirement → test_cases[].requirement_id
 *     phase3.js:81 throws on missing requirement_id. Strongest grounding
 *     for the upgrade protocol.
 *   - non_functional_requirements[].{title, constraint}
 *     → {category, requirement}
 *     snapshot.js tolerates both shapes via fallback (v0.1.90 defensive
 *     layer); migration removes the underlying drift.
 *
 * STATE-MISSING (.aitri field backfills — fields introduced after v0.1.65):
 *   - updatedAt       v0.1.63+
 *   - lastSession     v0.1.70+
 *   - verifyRanAt     v0.1.79+
 *   - auditLastAt     v0.1.79+
 *   - normalizeState  v0.1.80+
 *
 * VALIDATOR-GAP (report-only — fails current phase1.validate(), no auto-fix):
 *   - v0.1.82 title vagueness:       MUST FR whose title matches BROAD_VAGUE
 *                                    and has <2 substantive tokens left.
 *   - v0.1.82 all-vague ACs:         MUST FR whose every AC is vague with no
 *                                    observable metric.
 *   - v0.1.82 duplicate ACs:         FR pairs with ≥3 ACs each and Jaccard
 *                                    similarity ≥0.9.
 *   Aitri cannot auto-rewrite these — re-authoring is content work owned by
 *   the agent. Findings surface in the upgrade report as ⚠️ items.
 *
 * ADR-027 Addendum §2 (shape-only transforms):
 *   - TC.requirement → requirement_id: mechanical rename WHEN value matches
 *     /^FR-\d+$/. Comma-separated or non-canonical values are FLAGGED for
 *     agent review — splitting a multi-FR TC requires semantic choices
 *     (test naming, AC allocation) that belong to the agent.
 *   - NFR.constraint → NFR.requirement: mechanical rename.
 *   - NFR.title → NFR.category: mechanical rename ONLY when title value is a
 *     case-insensitive match of a known category
 *     (Performance|Security|Reliability|Scalability|Usability). Free-text
 *     titles are FLAGGED.
 *   - State backfills only write when the field is missing AND a deterministic
 *     source exists (an event, a file mtime, a git HEAD). No field is set from
 *     content inference.
 *
 * Idempotence: every finding in diagnose() is gated by field/shape presence.
 * Re-running migrate() on a migrated project is a no-op.
 */

import fs from 'fs';
import { execSync } from 'child_process';
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
    ...diagnoseUpdatedAt(dir, config),
    ...diagnoseLastSession(dir, config),
    ...diagnoseVerifyRanAt(dir, config),
    ...diagnoseAuditLastAt(dir, config),
    ...diagnoseNormalizeState(dir, config),
    ...diagnosePhase1Vagueness(dir, config),
    ...diagnosePhase1DuplicateACs(dir, config),
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
      f.apply(config);
      appendEvent(config, 'upgrade_migration', 'upgrade', {
        from_version: FROM_VERSION,
        to_version:   targetVersion,
        category:     f.category,
        target:       f.target,
        transform:    f.transform,
        // Artifact writes carry content hashes; state backfills don't.
        ...(f.beforeHash ? { before_hash: f.beforeHash, after_hash: f.afterHash } : {}),
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

// ── STATE-MISSING: .aitri field backfills ────────────────────────────────────
//
// Each backfill is idempotent by field-presence: if the field already exists,
// diagnose returns nothing. No hashes are recorded because there is no
// artifact write — only a config field is stamped, persisted by saveConfig at
// the end of runUpgrade (ADR-027 Addendum §1: aitriVersion last).

function diagnoseUpdatedAt(_dir, config) {
  if (config.updatedAt) return [];
  return [{
    category:       'stateMissing',
    target:         '.aitri#updatedAt',
    transform:      'backfill updatedAt to current time',
    autoMigratable: true,
    apply: (c) => { c.updatedAt = new Date().toISOString(); },
  }];
}

function diagnoseLastSession(_dir, config) {
  if (config.lastSession) return [];
  const events = Array.isArray(config.events) ? config.events : [];
  const source = [...events].reverse().find(e =>
    ['complete', 'approve', 'approved', 'verify', 'verify-run', 'verify-complete'].includes(e.event)
  );
  if (!source) return [];  // nothing to derive from

  return [{
    category:       'stateMissing',
    target:         '.aitri#lastSession',
    transform:      `backfill lastSession from most recent ${source.event} event`,
    autoMigratable: true,
    apply: (c) => {
      c.lastSession = {
        at:    source.at,
        agent: 'unknown',
        event: source.event,
      };
    },
  }];
}

function diagnoseVerifyRanAt(dir, config) {
  if (config.verifyRanAt) return [];
  if (!config.verifyPassed) return [];  // nothing to backfill against

  const full = artifactPath(dir, config, '04_TEST_RESULTS.json');
  if (!fs.existsSync(full)) return [];

  let mtime;
  try { mtime = fs.statSync(full).mtime.toISOString(); }
  catch { return []; }

  return [{
    category:       'stateMissing',
    target:         '.aitri#verifyRanAt',
    transform:      'backfill verifyRanAt from 04_TEST_RESULTS.json mtime',
    autoMigratable: true,
    apply: (c) => { c.verifyRanAt = mtime; },
  }];
}

function diagnoseAuditLastAt(dir, config) {
  if (config.auditLastAt) return [];

  const full = artifactPath(dir, config, 'AUDIT_REPORT.md');
  if (!fs.existsSync(full)) return [];

  let mtime;
  try { mtime = fs.statSync(full).mtime.toISOString(); }
  catch { return []; }

  return [{
    category:       'stateMissing',
    target:         '.aitri#auditLastAt',
    transform:      'backfill auditLastAt from AUDIT_REPORT.md mtime',
    autoMigratable: true,
    apply: (c) => { c.auditLastAt = mtime; },
  }];
}

function diagnoseNormalizeState(dir, config) {
  if (config.normalizeState) return [];

  const approved = new Set((config.approvedPhases || []).map(String));
  if (!approved.has('4') && !approved.has('build')) return [];  // only stamp after Phase 4 approval

  // Prefer git HEAD for baseRef; fall back to an ISO timestamp when git is
  // unavailable (per lib/commands/normalize.js:127 — keep semantics aligned).
  let baseRef;
  let method = 'initial';
  try {
    baseRef = execSync('git rev-parse HEAD', { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim();
    method = 'git';
  } catch {
    baseRef = new Date().toISOString();
    method  = 'initial';
  }

  return [{
    category:       'stateMissing',
    target:         '.aitri#normalizeState',
    transform:      `stamp normalizeState baseline (method=${method}) — Phase 4 was approved without one`,
    autoMigratable: true,
    apply: (c) => {
      c.normalizeState = {
        baseRef,
        method,
        status:  'resolved',
        lastRun: new Date().toISOString(),
      };
    },
  }];
}

// ── VALIDATOR-GAP: Phase 1 checks introduced in v0.1.82 ──────────────────────
//
// MIRROR: these rules are duplicated from lib/phases/phase1.js (v0.1.82). If
// the phase1 rule changes, this block must be updated in the same commit. The
// `test/upgrade.test.js` duplicate-detection tests are intentionally coupled
// to the same inputs phase1 tests use, so drift is detected.

const P1_BROAD_VAGUE = /\b(good|nice|beautiful|pretty|clean|fast|smooth|properly|correctly|efficiently|reliably|appropriately|securely|safely|effectively|adequately|seamlessly|correctamente|adecuadamente|apropiadamente|eficientemente|confiablemente|seguramente|efectivamente|debidamente|bonito|suave|limpio)\b/i;
const P1_HAS_METRIC = /\d|px|ms|%|fps|kb|mb|ratio|:\d|viewport|breakpoint/i;
const P1_TITLE_STOP = /^(the|a|an|la|el|los|las|un|una|de|del|must|should|be|to|is|are|y|o|and|or|in|on|it|this|that|all|debe|se|que|por|para|con|sin|es|app|sistema|system|makes|make|can|will|that|for|of)$/i;
const P1_NORMALIZE_AC = ac => String(ac).toLowerCase().replace(/[^\w\sáéíóúñ]/gi, ' ').replace(/\s+/g, ' ').trim();

function readRequirements(dir, config) {
  const full = artifactPath(dir, config, '01_REQUIREMENTS.json');
  if (!fs.existsSync(full)) return null;
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch { return null; }
}

function diagnosePhase1Vagueness(dir, config) {
  const data = readRequirements(dir, config);
  if (!data) return [];

  const frs = Array.isArray(data.functional_requirements) ? data.functional_requirements : [];
  const mustFRs = frs.filter(fr => fr.priority === 'MUST');

  const offenders = [];

  for (const fr of mustFRs) {
    // Title vagueness.
    const title = fr.title || '';
    if (P1_BROAD_VAGUE.test(title)) {
      const substantive = title
        .replace(/\[ASSUMPTION[^\]]*\]/gi, ' ')
        .replace(/[^\w\sáéíóúñüÁÉÍÓÚÑÜ]/gi, ' ')
        .split(/\s+/)
        .filter(t => t.length >= 3 && !P1_TITLE_STOP.test(t) && !P1_BROAD_VAGUE.test(t));
      if (substantive.length < 2) {
        offenders.push({ id: fr.id, kind: 'title', sample: title });
        continue;  // don't double-flag the same FR
      }
    }
    // All-vague ACs.
    const acs = fr.acceptance_criteria || [];
    if (acs.length > 0 && acs.every(c => P1_BROAD_VAGUE.test(c) && !P1_HAS_METRIC.test(c))) {
      offenders.push({ id: fr.id, kind: 'acs', sample: acs[0] });
    }
  }

  if (offenders.length === 0) return [];

  const summary = offenders.map(o => `${o.id} (${o.kind})`).join(', ');
  return [{
    category:       'validatorGap',
    target:         '01_REQUIREMENTS.json',
    transform:      `MUST FRs failing v0.1.82 vagueness check (${offenders.length}): ${summary}`,
    autoMigratable: false,
    reason:         'Title or acceptance_criteria match BROAD_VAGUE without a concrete behavior or metric. Rewriting vague requirements is content work — agent must re-author the listed FRs against the current Phase 1 briefing.',
  }];
}

function diagnosePhase1DuplicateACs(dir, config) {
  const data = readRequirements(dir, config);
  if (!data) return [];

  const frs = Array.isArray(data.functional_requirements) ? data.functional_requirements : [];
  const richFRs = frs.filter(fr => (fr.acceptance_criteria || []).length >= 3);
  const pairs = [];

  for (let i = 0; i < richFRs.length; i++) {
    const a = new Set((richFRs[i].acceptance_criteria || []).map(P1_NORMALIZE_AC).filter(Boolean));
    for (let j = i + 1; j < richFRs.length; j++) {
      const b = new Set((richFRs[j].acceptance_criteria || []).map(P1_NORMALIZE_AC).filter(Boolean));
      if (a.size === 0 || b.size === 0) continue;
      const intersection = [...a].filter(x => b.has(x));
      const unionSize = new Set([...a, ...b]).size;
      const jaccard = intersection.length / unionSize;
      if (jaccard >= 0.9) {
        pairs.push({ a: richFRs[i].id, b: richFRs[j].id, pct: Math.round(jaccard * 100) });
      }
    }
  }

  if (pairs.length === 0) return [];

  const summary = pairs.map(p => `${p.a}↔${p.b} (${p.pct}%)`).join(', ');
  return [{
    category:       'validatorGap',
    target:         '01_REQUIREMENTS.json',
    transform:      `FR pairs with duplicate acceptance_criteria (${pairs.length}): ${summary}`,
    autoMigratable: false,
    reason:         'v0.1.82 requires FRs with ≥3 ACs to differ (Jaccard similarity <0.9). Copy-pasted ACs indicate the FRs are not semantically differentiated — merge them or rewrite ACs to capture distinct behavior.',
  }];
}
