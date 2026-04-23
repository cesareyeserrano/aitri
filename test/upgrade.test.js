/**
 * Tests: lib/upgrade/ — reconciliation protocol entry point (ADR-027)
 *
 * Architectural marker: exercises runUpgrade directly, not through cmdAdopt.
 * Guarantees the module is a public surface. End-to-end `adopt --upgrade`
 * behavior is covered in test/commands/adopt.test.js.
 *
 * Covers:
 *   - Absorbed legacy behaviors (Corte A):
 *       STRUCTURE       artifactsDir recovery
 *       STATE-MISSING   phase inference
 *       CAPABILITY-NEW  agent-files regeneration
 *   - Per-version migrations (Corte B):
 *       from-0.1.65.js  TC.requirement → TC.requirement_id
 *                       NFR {title, constraint} → {category, requirement}
 *       Flagging of semantic-content findings (§2 compliance)
 *       upgrade_migration events in config.events
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { runUpgrade } from '../lib/upgrade/index.js';
import { diagnose, migrateAll } from '../lib/upgrade/diagnose.js';
import * as from065 from '../lib/upgrade/migrations/from-0.1.65.js';
import { cmdInit }    from '../lib/commands/init.js';
import { loadConfig, saveConfig } from '../lib/state.js';

const ROOT_DIR = path.resolve(process.cwd());

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-upgrade-'));
}

function silence(fn) {
  const origLog = console.log;
  const origErr = process.stderr.write.bind(process.stderr);
  console.log = () => {};
  process.stderr.write = () => true;
  try { return fn(); }
  finally { console.log = origLog; process.stderr.write = origErr; }
}

describe('lib/upgrade — runUpgrade (Corte A: absorbed legacy behavior)', () => {
  it('writes aitriVersion last (commit point per ADR-027 Addendum §1)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));
      assert.equal(loadConfig(dir).aitriVersion, '0.1.99');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('STATE-MISSING: infers completedPhases from on-disk artifacts', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      const specDir = path.join(dir, 'spec');
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, '01_REQUIREMENTS.json'), '{}');
      fs.writeFileSync(path.join(specDir, '02_SYSTEM_DESIGN.md'), '# Design\n'.repeat(5));

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const c = loadConfig(dir);
      assert.ok(c.completedPhases.includes(1));
      assert.ok(c.completedPhases.includes(2));
      assert.ok(!c.completedPhases.includes(3));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('STATE-MISSING: does not re-mark phases that are already approved', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      const specDir = path.join(dir, 'spec');
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, '01_REQUIREMENTS.json'), '{}');

      // Simulate prior approval.
      const c0 = loadConfig(dir);
      c0.approvedPhases = [1];
      saveConfig(dir, c0);

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const c = loadConfig(dir);
      assert.ok(c.approvedPhases.includes(1));
      assert.ok(!c.completedPhases.includes(1), 'approved phase must not be duplicated in completedPhases');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('STRUCTURE: corrects artifactsDir to root when spec/ is empty but artifacts sit at root', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      fs.writeFileSync(path.join(dir, '01_REQUIREMENTS.json'), '{}');

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const c = loadConfig(dir);
      assert.equal(c.artifactsDir, '', 'artifactsDir must be corrected to root');
      assert.ok(c.completedPhases.includes(1), 'phase 1 must be inferred from root artifact');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('STRUCTURE: leaves artifactsDir untouched when artifacts are in the configured dir', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      const specDir = path.join(dir, 'spec');
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, '01_REQUIREMENTS.json'), '{}');

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      assert.equal(loadConfig(dir).artifactsDir, 'spec');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('CAPABILITY-NEW: regenerates agent instruction files when missing', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      for (const f of ['CLAUDE.md', 'GEMINI.md', '.codex/instructions.md']) {
        const p = path.join(dir, f);
        if (fs.existsSync(p)) fs.rmSync(p);
      }
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));
      assert.ok(fs.existsSync(path.join(dir, 'CLAUDE.md')));
      assert.ok(fs.existsSync(path.join(dir, 'GEMINI.md')));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('is tolerant of projects with no artifacts', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      assert.doesNotThrow(() =>
        silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }))
      );
      const c = loadConfig(dir);
      assert.equal(c.aitriVersion, '0.1.99');
      assert.deepEqual(c.completedPhases, []);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('lib/upgrade — diagnose composer', () => {
  it('returns an empty catalog when no drift is present', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      const cat = diagnose(dir, loadConfig(dir));
      assert.deepEqual(cat.blocking,      []);
      assert.deepEqual(cat.stateMissing,  []);
      assert.deepEqual(cat.validatorGap,  []);
      assert.deepEqual(cat.capabilityNew, []);
      assert.deepEqual(cat.structure,     []);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

// ── Corte B: from-0.1.65.js migration module ─────────────────────────────────

function writeTcs(dir, tcs) {
  const specDir = path.join(dir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, '03_TEST_CASES.json'),
    JSON.stringify({ test_cases: tcs }, null, 2)
  );
}

function writeReqs(dir, data) {
  const specDir = path.join(dir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, '01_REQUIREMENTS.json'),
    JSON.stringify(data, null, 2)
  );
}

function readTcs(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'spec', '03_TEST_CASES.json'), 'utf8')).test_cases;
}

function readNfrs(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'spec', '01_REQUIREMENTS.json'), 'utf8')).non_functional_requirements;
}

describe('lib/upgrade/migrations/from-0.1.65 — BLOCKING: TC.requirement → requirement_id', () => {
  it('renames single-FR requirement to requirement_id (mechanical)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [
        { id: 'TC-001', requirement: 'FR-001', title: 'Login ok' },
        { id: 'TC-002', requirement: 'FR-002', title: 'Logout ok' },
      ]);
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const tcs = readTcs(dir);
      assert.equal(tcs[0].requirement_id, 'FR-001');
      assert.equal(tcs[1].requirement_id, 'FR-002');
      assert.equal(tcs[0].requirement, undefined);
      assert.equal(tcs[1].requirement, undefined);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('FLAGS comma-separated multi-FR TCs — does not auto-split (§2)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [
        { id: 'TC-001', requirement: 'FR-001, FR-002', title: 'Combined' },
      ]);
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const tcs = readTcs(dir);
      assert.equal(tcs[0].requirement, 'FR-001, FR-002', 'original value must be preserved on flag');
      assert.equal(tcs[0].requirement_id, undefined, 'requirement_id must not be synthesized');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('is idempotent: re-running after migration is a no-op', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [{ id: 'TC-001', requirement: 'FR-001' }]);

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));
      const snapshot1 = fs.readFileSync(path.join(dir, 'spec', '03_TEST_CASES.json'), 'utf8');

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));
      const snapshot2 = fs.readFileSync(path.join(dir, 'spec', '03_TEST_CASES.json'), 'utf8');

      assert.equal(snapshot1, snapshot2);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('leaves TCs already on the new shape untouched', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [{ id: 'TC-001', requirement_id: 'FR-001', title: 'Already modern' }]);
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const tcs = readTcs(dir);
      assert.equal(tcs[0].requirement_id, 'FR-001');
      assert.equal(tcs[0].requirement, undefined);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('lib/upgrade/migrations/from-0.1.65 — BLOCKING: NFR shape rewrite', () => {
  it('renames constraint → requirement (mechanical)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeReqs(dir, {
        non_functional_requirements: [
          { id: 'NFR-001', category: 'Performance', constraint: '<100ms' },
        ],
      });
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const nfrs = readNfrs(dir);
      assert.equal(nfrs[0].requirement, '<100ms');
      assert.equal(nfrs[0].constraint, undefined);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('normalizes title → category when title is a valid category (case-insensitive lookup)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeReqs(dir, {
        non_functional_requirements: [
          { id: 'NFR-001', title: 'performance', requirement: '<100ms' },
          { id: 'NFR-002', title: 'Security',    requirement: 'TLS 1.3' },
        ],
      });
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const nfrs = readNfrs(dir);
      assert.equal(nfrs[0].category, 'Performance');
      assert.equal(nfrs[1].category, 'Security');
      assert.equal(nfrs[0].title, undefined);
      assert.equal(nfrs[1].title, undefined);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('FLAGS NFRs whose title is free-text — does not infer category (§2)', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeReqs(dir, {
        non_functional_requirements: [
          { id: 'NFR-001', title: 'Fast response time', constraint: '<100ms' },
        ],
      });
      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const nfrs = readNfrs(dir);
      assert.equal(nfrs[0].title, 'Fast response time', 'title must be preserved when no category match');
      assert.equal(nfrs[0].category, undefined);
      // constraint still gets the mechanical rename even though category is flagged.
      assert.equal(nfrs[0].requirement, '<100ms');
      assert.equal(nfrs[0].constraint, undefined);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('lib/upgrade/migrations/from-0.1.65 — event log', () => {
  it('appends upgrade_migration events with before/after hashes', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [{ id: 'TC-001', requirement: 'FR-001' }]);

      silence(() => runUpgrade({ dir, VERSION: '0.1.99', rootDir: ROOT_DIR }));

      const c = loadConfig(dir);
      const evs = (c.events || []).filter(e => e.event === 'upgrade_migration');
      assert.equal(evs.length, 1);
      assert.equal(evs[0].from_version, '0.1.65');
      assert.equal(evs[0].to_version,   '0.1.99');
      assert.equal(evs[0].category,     'blocking');
      assert.equal(evs[0].target,       '03_TEST_CASES.json');
      assert.ok(evs[0].before_hash && evs[0].after_hash);
      assert.notEqual(evs[0].before_hash, evs[0].after_hash);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('lib/upgrade — diagnose composer surfaces module findings', () => {
  it('routes per-module findings into catalog categories', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [
        { id: 'TC-001', requirement: 'FR-001' },           // mechanical
        { id: 'TC-002', requirement: 'FR-001, FR-002' },   // flag
      ]);
      const cat = diagnose(dir, loadConfig(dir));
      assert.equal(cat.blocking.length,     1, 'mechanical rename finding routed to blocking');
      assert.equal(cat.validatorGap.length, 1, 'multi-FR finding routed to validatorGap');
      assert.equal(cat.blocking[0].module,     from065.FROM_VERSION);
      assert.equal(cat.validatorGap[0].module, from065.FROM_VERSION);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('migrateAll returns migrated + flagged per module', () => {
    const dir = tmpDir();
    try {
      cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
      writeTcs(dir, [
        { id: 'TC-001', requirement: 'FR-001' },
        { id: 'TC-002', requirement: 'FR-001, FR-002' },
      ]);
      const config = loadConfig(dir);
      const r = migrateAll(dir, config, '0.1.99');
      assert.equal(r.migrated.length, 1);
      assert.equal(r.flagged.length,  1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
