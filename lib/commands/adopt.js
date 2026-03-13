/**
 * Module: Command — adopt
 * Purpose: Integrate existing projects into Aitri.
 *   --upgrade  Aitri-aware project (old version): infer completedPhases from existing
 *              artifacts, update aitriVersion. Non-destructive — never removes state.
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig, artifactPath } from '../state.js';
import { PHASE_DEFS, OPTIONAL_PHASES } from '../phases/index.js';

const CORE_PHASES = [1, 2, 3, 4, 5];

export function cmdAdopt({ dir, args, VERSION, err }) {
  const sub = args[0];

  if (sub === '--upgrade') return adoptUpgrade({ dir, VERSION });

  err(
    'adopt: unknown subcommand.\n' +
    '  Usage:\n' +
    '    aitri adopt --upgrade    Sync state from existing Aitri artifacts (non-destructive)'
  );
}

function adoptUpgrade({ dir, VERSION }) {
  const config    = loadConfig(dir);
  const prevVer   = config.aitriVersion || '(unknown)';
  const completed = new Set(config.completedPhases || []);
  const approved  = new Set(config.approvedPhases  || []);

  const inferred  = [];
  const skipped   = [];

  const allPhaseKeys = [
    ...OPTIONAL_PHASES,
    ...CORE_PHASES,
  ];

  for (const key of allPhaseKeys) {
    const p       = PHASE_DEFS[key];
    const exists  = fs.existsSync(artifactPath(dir, config, p.artifact));
    const phaseId = p.num;

    if (!exists) continue;

    if (completed.has(phaseId) || approved.has(phaseId)) {
      skipped.push({ key, reason: approved.has(phaseId) ? 'already approved' : 'already completed' });
    } else {
      completed.add(phaseId);
      inferred.push(key);
    }
  }

  config.completedPhases = [...completed];
  config.aitriVersion    = VERSION;
  saveConfig(dir, config);

  console.log(`\n🔄 Aitri Adopt — Upgrade`);
  console.log('─'.repeat(50));
  console.log(`  Project:  ${config.projectName || path.basename(dir)}`);
  console.log(`  Version:  ${prevVer}  →  ${VERSION}`);

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
