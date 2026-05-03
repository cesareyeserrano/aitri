/**
 * Tests: phase inputs[] contract (alpha.26+)
 *
 * Purpose: structural guard preventing regression of the alpha.17 → alpha.22 →
 *          alpha.24 → alpha.25 → alpha.26 hotfix arc. Once a destructive
 *          on-disk operation removes a file, no phase that runs AFTER the
 *          destructive op may declare that file as a required input — the
 *          run-phase.js gate (lib/commands/run-phase.js:75-83) hard-fails
 *          on missing required inputs, even when buildBriefing does not
 *          consume them.
 *
 * The specific case codified here: `aitri approve 1` archives IDEA.md into
 * 01_REQUIREMENTS.json#original_brief and unlinks the file (since v0.1.89).
 * Therefore any phase that runs once Phase 1 is approved (phases 2-5, ux,
 * review) must NOT declare 'IDEA.md' as a required input. The brief is
 * available via 01_REQUIREMENTS.json#original_brief.
 *
 * `discovery` is the only phase that legitimately reads IDEA.md as input —
 * it runs BEFORE Phase 1 by design, when IDEA.md is on disk as the seed
 * brief.
 *
 * See ADR-031 § post-destructive on-disk audit protocol.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_DEFS } from '../../lib/phases/index.js';

describe('phase inputs[] contract — IDEA.md absorbed-brief invariant (alpha.26+)', () => {
  it('no post-Phase-1 phase declares IDEA.md as a required input', () => {
    const allowedToReadIdea = new Set(['discovery']);  // pre-Phase-1 phase only

    const offenders = [];
    for (const [key, def] of Object.entries(PHASE_DEFS)) {
      if (allowedToReadIdea.has(key)) continue;
      const inputs = def.inputs || [];
      if (inputs.includes('IDEA.md')) {
        offenders.push(`${key} (artifact: ${def.artifact}) declares IDEA.md as required`);
      }
    }

    assert.deepEqual(offenders, [],
      'IDEA.md must not appear in inputs[] for any phase except discovery — ' +
      'the file is unlinked by approve.js once Phase 1 is approved (v0.1.89+) ' +
      'and the brief lives in 01_REQUIREMENTS.json#original_brief. Any phase ' +
      'that runs post-approval must read the brief from that field, not from ' +
      'IDEA.md on disk. Offenders found: ' + offenders.join('; '));
  });

  it('discovery is the only phase that may read IDEA.md (sanity check)', () => {
    const discovery = PHASE_DEFS.discovery;
    assert.ok(discovery, 'discovery phase must exist');
    assert.ok((discovery.inputs || []).includes('IDEA.md'),
      'discovery is expected to declare IDEA.md — it runs BEFORE Phase 1 when the file is on disk');
  });
});
