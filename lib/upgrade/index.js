/**
 * Module: lib/upgrade/ — reconciliation protocol entry point
 *
 * Implements `aitri adopt --upgrade` per ADR-027.
 *
 * Behaviors composed here, mapped to ADR-027 drift categories:
 *   - BLOCKING       artifactsDir recovery (without it, readers cannot locate
 *                    artifacts; classified BLOCKING per BACKLOG v2.0.0 catalog)
 *   - BLOCKING       per-version migrations via lib/upgrade/migrations/*
 *                    (e.g. TC requirement → requirement_id, NFR shape rewrite)
 *   - STATE-MISSING  phase inference from on-disk artifacts
 *   - CAPABILITY-NEW agent instruction files regeneration
 *   - VALIDATOR-GAP  reported via flagged findings; never auto-migrated
 *
 * ADR-027 Addendum invariants honored in this module:
 *   §1 Ordered writes + aitriVersion written LAST via a single saveConfig at
 *      the end of the run. No transactional atomicity promise. If any step
 *      throws, aitriVersion is not advanced and the user recovers via
 *      `git checkout -- spec/ .aitri/`.
 *   §2 Shape transforms only. Anything semantic (choosing an NFR category
 *      from free-text, splitting a multi-FR TC) is FLAGGED, never inferred.
 *   §3 Single entry point. lib/commands/adopt.js holds only a dispatcher.
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig, artifactPath } from '../state.js';
import { PHASE_DEFS, OPTIONAL_PHASES } from '../phases/index.js';
import { writeAgentFiles } from '../agent-files.js';
import { migrateAll } from './diagnose.js';

const CORE_PHASES = [1, 2, 3, 4, 5];

/**
 * Run the upgrade protocol end-to-end.
 *
 * @param {object} params
 * @param {string} params.dir      Project root.
 * @param {string} params.VERSION  Target Aitri CLI version (written to aitriVersion last).
 * @param {string} [params.rootDir] Aitri CLI root (for templates). If omitted, agent-files step is skipped.
 */
export function runUpgrade({ dir, VERSION, rootDir }) {
  const config   = loadConfig(dir);
  const prevVer  = config.aitriVersion || '(unknown)';
  const completed = new Set(config.completedPhases || []);
  const approved  = new Set(config.approvedPhases  || []);

  // BLOCKING — artifactsDir recovery. Runs first because every subsequent
  // artifact read depends on artifactPath(config) pointing at the right dir.
  recoverArtifactsDir(dir, config);

  // BLOCKING — per-version schema migrations. Each module is shape-only and
  // idempotent; flagged findings are surfaced in the report for agent action.
  const migrationResult = migrateAll(dir, config, VERSION);

  // STATE-MISSING — infer completedPhases from on-disk artifacts.
  // Approved or already-completed phases are not re-marked.
  const { inferred, skipped } = inferCompletedPhases(dir, config, completed, approved);

  // Commit point — aitriVersion is written LAST (ADR-027 Addendum §1).
  config.completedPhases = [...completed];
  config.aitriVersion    = VERSION;
  saveConfig(dir, config);

  // REPORT.
  printReport({ config, prevVer, VERSION, inferred, skipped, dir, migrationResult });

  // CAPABILITY-NEW — regenerate missing agent instruction files.
  // Runs after saveConfig because it does not affect the upgrade contract;
  // failure here should not prevent the version bump from persisting.
  if (rootDir) {
    const created = writeAgentFiles(dir, rootDir);
    if (created.length) printAgentFilesGuidance(created);
  }
}

// ── STRUCTURE ─────────────────────────────────────────────────────────────────

function recoverArtifactsDir(dir, config) {
  if (!config.artifactsDir) return;

  const hasAnyInDir = [...OPTIONAL_PHASES, ...CORE_PHASES].some(key =>
    fs.existsSync(artifactPath(dir, config, PHASE_DEFS[key].artifact))
  );
  if (hasAnyInDir) return;

  const hasAnyAtRoot = [...OPTIONAL_PHASES, ...CORE_PHASES].some(key =>
    fs.existsSync(path.join(dir, PHASE_DEFS[key].artifact))
  );
  if (!hasAnyAtRoot) return;

  process.stderr.write(
    `[aitri] Warning: config has artifactsDir='${config.artifactsDir}' but no artifacts found there.\n` +
    `  Artifacts detected at project root — correcting artifactsDir to '' (root).\n\n`
  );
  config.artifactsDir = '';
}

// ── STATE-MISSING ─────────────────────────────────────────────────────────────

function inferCompletedPhases(dir, config, completed, approved) {
  const inferred = [];
  const skipped  = [];

  for (const key of [...OPTIONAL_PHASES, ...CORE_PHASES]) {
    const p      = PHASE_DEFS[key];
    const exists = fs.existsSync(artifactPath(dir, config, p.artifact));
    if (!exists) continue;

    if (completed.has(p.num) || approved.has(p.num)) {
      skipped.push({ key, reason: approved.has(p.num) ? 'already approved' : 'already completed' });
    } else {
      completed.add(p.num);
      inferred.push(key);
    }
  }

  return { inferred, skipped };
}

// ── REPORT ────────────────────────────────────────────────────────────────────

function printReport({ config, prevVer, VERSION, inferred, skipped, dir, migrationResult }) {
  console.log(`\n🔄 Aitri Adopt — Upgrade`);
  console.log('─'.repeat(50));
  console.log(`  Project:  ${config.projectName || path.basename(dir)}`);
  console.log(`  Version:  ${prevVer}  →  ${VERSION}`);

  const migrated = migrationResult?.migrated || [];
  const flagged  = migrationResult?.flagged  || [];

  if (migrated.length) {
    console.log(`\n  Schema migrations applied:`);
    for (const f of migrated) {
      console.log(`    ✅ [${f.module}] ${f.target}`);
      console.log(`       ${f.transform}`);
    }
  }

  if (flagged.length) {
    console.log(`\n  Flagged for agent review (shape-only migrator cannot auto-fix):`);
    for (const f of flagged) {
      console.log(`    ⚠️  [${f.module}] ${f.target}`);
      console.log(`       ${f.transform}`);
      if (f.reason) console.log(`       Reason: ${f.reason}`);
    }
  }

  if (inferred.length) {
    console.log(`\n  Phases inferred from artifacts:`);
    for (const key of inferred) {
      const p = PHASE_DEFS[key];
      console.log(`    ✅ ${String(p.num).padEnd(12)} ${p.artifact}`);
    }
    console.log(`\n  These phases are now marked as completed (not approved).`);
    console.log(`  Run: aitri approve <phase>  to approve after reviewing the artifact.`);
  }

  if (skipped.length) {
    console.log(`\n  Already tracked (unchanged):`);
    for (const { key, reason } of skipped) {
      const p = PHASE_DEFS[key];
      console.log(`    ─  ${String(p.num).padEnd(12)} ${reason}`);
    }
  }

  if (!inferred.length && !skipped.length) {
    console.log(`\n  No artifacts found — nothing to infer.`);
    console.log(`  aitriVersion updated to v${VERSION}.`);
  }

  console.log(`\n  Run: aitri status  to see current state`);
  console.log('─'.repeat(50));
}

function printAgentFilesGuidance(created) {
  console.log(`\n  Agent instruction files written: ${created.join(', ')}`);
  console.log(`  These are meant to be committed — they bootstrap any agent (Claude, Gemini,`);
  console.log(`  Codex, …) operating on the project. If your team standardizes on one agent,`);
  console.log(`  it is safe to delete the others; Aitri will only regenerate missing files.`);
}
