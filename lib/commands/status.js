/**
 * Module: Command — status
 * Purpose: Display pipeline status with ASCII UI + rejection history.
 */

import fs from 'fs';
import path from 'path';
import { PHASE_DEFS } from '../phases/index.js';
import { loadConfig } from '../state.js';

const OPTIONAL_PHASES = ['discovery', 'ux'];
const CORE_PHASES     = [1, 2, 3, 4, 5];

export function cmdStatus({ dir }) {
  const config   = loadConfig(dir);
  const approved = new Set(config.approvedPhases || []);

  console.log(`\n📊 Aitri — ${config.projectName || path.basename(dir)}`);
  console.log('─'.repeat(50));

  // Optional phases — only show if artifact exists
  for (const key of OPTIONAL_PHASES) {
    const p      = PHASE_DEFS[key];
    const exists = fs.existsSync(path.join(dir, p.artifact));
    if (!exists) continue;
    const isApproved = approved.has(p.num);
    const icon  = isApproved ? '✅' : '⏳';
    const label = isApproved ? 'Approved' : 'Awaiting approval';
    console.log(`  ${icon} ${String(p.num).padEnd(10)} ${p.name.padEnd(22)} ${label}`);
  }

  // Core phases
  for (const num of CORE_PHASES) {
    const p          = PHASE_DEFS[num];
    const exists     = fs.existsSync(path.join(dir, p.artifact));
    const isApproved = approved.has(p.num);
    const icon  = isApproved ? '✅' : exists ? '⏳' : '⬜';
    const label = isApproved ? 'Approved' : exists ? 'Awaiting approval' : 'Not started';
    console.log(`  ${icon} ${String(p.num).padEnd(10)} ${p.name.padEnd(22)} ${label}`);

    if (num === 4 && isApproved) {
      const vPassed = config.verifyPassed;
      const vIcon   = vPassed ? '✅' : '⬜';
      const vLabel  = vPassed
        ? `Passed (${config.verifySummary?.passed}/${config.verifySummary?.total})`
        : 'Not run — required before Phase 5';
      console.log(`  ${vIcon} ${'verify'.padEnd(10)} ${'Tests'.padEnd(22)} ${vLabel}`);
    }
  }

  const rejections = config.rejections || {};
  const rejectedPhases = Object.keys(rejections);
  if (rejectedPhases.length) {
    console.log('\n  Rejection history:');
    for (const n of rejectedPhases) {
      const r = rejections[n];
      const d = new Date(r.at).toLocaleDateString();
      console.log(`    Phase ${n} (${d}): "${r.feedback}"`);
    }
  }

  console.log('─'.repeat(50));

  // Determine next action based on core pipeline only
  const approvedCore    = CORE_PHASES.filter(n => approved.has(n));
  const allCoreApproved = approvedCore.length === CORE_PHASES.length;

  if (allCoreApproved) {
    console.log(`\n→ All phases complete! Run: aitri validate`);
  } else if (approvedCore.length === 4 && !config.verifyPassed) {
    console.log(`\n→ Next: aitri verify  (then aitri verify-complete)`);
  } else {
    const nextCore = CORE_PHASES.find(n => !approved.has(n)) || 1;
    console.log(`\n→ Next: aitri run-phase ${nextCore}`);
  }
}
