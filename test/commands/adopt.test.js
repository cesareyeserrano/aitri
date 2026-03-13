/**
 * Tests: aitri adopt --upgrade
 * Covers: infers completedPhases from artifacts, updates aitriVersion, non-destructive
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cmdAdopt } from '../../lib/commands/adopt.js';
import { cmdInit }  from '../../lib/commands/init.js';
import { loadConfig, saveConfig } from '../../lib/state.js';

const ROOT_DIR = path.resolve(process.cwd());

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-adopt-'));
}

function captureLog(fn) {
  const lines = [];
  const orig = console.log.bind(console);
  console.log = (...a) => lines.push(a.join(' '));
  try { fn(); } finally { console.log = orig; }
  return lines.join('\n');
}

function makeErr() {
  const thrown = [];
  return { fn: (msg) => { thrown.push(msg); throw new Error(msg); }, thrown };
}

function writeArtifact(dir, subdir, name, content = '{}') {
  const d = path.join(dir, subdir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, name), content, 'utf8');
}

describe('aitri adopt --upgrade', () => {
  it('updates aitriVersion when upgrading', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn });
    const config = loadConfig(dir);
    assert.equal(config.aitriVersion, '0.1.34');
  });

  it('infers completedPhases from existing artifacts', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    // Write Phase 1 and Phase 2 artifacts in spec/
    writeArtifact(dir, 'spec', '01_REQUIREMENTS.json', '{"functionalRequirements":[]}');
    writeArtifact(dir, 'spec', '02_SYSTEM_DESIGN.md', '# Design\n'.repeat(5));

    cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn });
    const config = loadConfig(dir);
    assert.ok(config.completedPhases.includes(1), 'phase 1 must be inferred');
    assert.ok(config.completedPhases.includes(2), 'phase 2 must be inferred');
    assert.ok(!config.completedPhases.includes(3), 'phase 3 must NOT be inferred (no artifact)');
  });

  it('does not overwrite already-approved phases', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    writeArtifact(dir, 'spec', '01_REQUIREMENTS.json', '{}');

    // Manually set phase 1 as approved
    const config = loadConfig(dir);
    config.approvedPhases = [1];
    saveConfig(dir, config);

    cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn });
    const updated = loadConfig(dir);
    // approved phases stay approved, not duplicated into completed
    assert.ok(updated.approvedPhases.includes(1));
    assert.ok(!updated.completedPhases.includes(1), 'must not duplicate into completedPhases');
  });

  it('does not overwrite already-completed phases', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    writeArtifact(dir, 'spec', '01_REQUIREMENTS.json', '{}');

    const config = loadConfig(dir);
    config.completedPhases = [1];
    saveConfig(dir, config);

    cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn });
    const updated = loadConfig(dir);
    // still just one entry
    assert.equal(updated.completedPhases.filter(p => p === 1).length, 1);
  });

  it('infers optional phase discovery when artifact exists', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    writeArtifact(dir, 'spec', '00_DISCOVERY.md', '# Discovery\n'.repeat(5));

    cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn });
    const config = loadConfig(dir);
    assert.ok(config.completedPhases.includes('discovery'), 'discovery must be inferred');
  });

  it('outputs summary mentioning inferred phases', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    writeArtifact(dir, 'spec', '01_REQUIREMENTS.json', '{}');

    const out = captureLog(() =>
      cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn })
    );
    assert.ok(out.includes('0.1.10'), 'must show old version');
    assert.ok(out.includes('0.1.34'), 'must show new version');
    assert.ok(out.includes('inferred') || out.includes('Inferred'), 'must mention inferred phases');
  });

  it('throws on unknown subcommand', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.34' });
    const e = makeErr();
    assert.throws(
      () => cmdAdopt({ dir, args: ['--unknown'], VERSION: '0.1.34', err: e.fn }),
      /adopt: unknown subcommand/
    );
  });

  it('handles no artifacts gracefully', () => {
    const dir = tmpDir();
    cmdInit({ dir, rootDir: ROOT_DIR, VERSION: '0.1.10' });
    assert.doesNotThrow(() =>
      cmdAdopt({ dir, args: ['--upgrade'], VERSION: '0.1.34', err: makeErr().fn })
    );
    const config = loadConfig(dir);
    assert.equal(config.aitriVersion, '0.1.34');
    assert.deepEqual(config.completedPhases, []);
  });
});
