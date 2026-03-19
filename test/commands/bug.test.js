import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openBugCount, autoVerifyBugs, getBlockingBugs, fixedBugsWithoutTC, cmdBug } from '../../lib/commands/bug.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-bug-'));
}

function baseConfig(dir) {
  return { artifactsDir: 'spec', approvedPhases: [], completedPhases: [] };
}

function writeBugs(dir, bugs) {
  const specDir = path.join(dir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'BUGS.json'), JSON.stringify({ bugs }, null, 2));
}

function writeReqs(dir, frs) {
  const specDir = path.join(dir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(
    path.join(specDir, '01_REQUIREMENTS.json'),
    JSON.stringify({ functional_requirements: frs }, null, 2)
  );
}

function readBugs(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'spec', 'BUGS.json'), 'utf8'));
}

function err(msg) { throw new Error(msg); }

// ── openBugCount ──────────────────────────────────────────────────────────────

describe('openBugCount()', () => {
  it('returns null when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.equal(openBugCount(dir, baseConfig(dir)), null);
  });

  it('returns 0 when all bugs are closed', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'closed' }]);
    assert.equal(openBugCount(dir, baseConfig(dir)), 0);
  });

  it('counts open and in_progress bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'open' },
      { id: 'BG-002', status: 'in_progress' },
      { id: 'BG-003', status: 'fixed' },
      { id: 'BG-004', status: 'closed' },
    ]);
    assert.equal(openBugCount(dir, baseConfig(dir)), 2);
  });
});

// ── autoVerifyBugs ────────────────────────────────────────────────────────────

describe('autoVerifyBugs()', () => {
  it('transitions fixed → verified when linked TC passes', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(dir), [{ tc_id: 'TC-021', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'verified');
  });

  it('does not transition when linked TC fails', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(dir), [{ tc_id: 'TC-021', status: 'fail' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('does not transition when TC is not in results', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(dir), [{ tc_id: 'TC-001', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('does not affect bugs with no tc_reference', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: null }]);
    autoVerifyBugs(dir, baseConfig(dir), [{ tc_id: 'TC-021', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('is a no-op when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.doesNotThrow(() => autoVerifyBugs(dir, baseConfig(dir), [{ tc_id: 'TC-001', status: 'pass' }]));
  });
});

// ── getBlockingBugs ───────────────────────────────────────────────────────────

describe('getBlockingBugs()', () => {
  it('returns empty array when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.deepEqual(getBlockingBugs(dir, baseConfig(dir)), []);
  });

  it('returns open bugs linked to MUST FRs', () => {
    const dir = tmpDir();
    writeReqs(dir, [{ id: 'FR-001', priority: 'MUST', title: 'Login' }]);
    writeBugs(dir, [{ id: 'BG-001', status: 'open', fr: 'FR-001' }]);
    const blocking = getBlockingBugs(dir, baseConfig(dir));
    assert.equal(blocking.length, 1);
    assert.equal(blocking[0].id, 'BG-001');
  });

  it('does not block on open bugs linked to SHOULD FRs', () => {
    const dir = tmpDir();
    writeReqs(dir, [{ id: 'FR-002', priority: 'SHOULD', title: 'Dark mode' }]);
    writeBugs(dir, [{ id: 'BG-001', status: 'open', fr: 'FR-002' }]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig(dir)), []);
  });

  it('does not block on fixed or verified bugs', () => {
    const dir = tmpDir();
    writeReqs(dir, [{ id: 'FR-001', priority: 'MUST', title: 'Login' }]);
    writeBugs(dir, [
      { id: 'BG-001', status: 'fixed',    fr: 'FR-001' },
      { id: 'BG-002', status: 'verified', fr: 'FR-001' },
    ]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig(dir)), []);
  });

  it('does not block on open bugs with no FR link', () => {
    const dir = tmpDir();
    writeReqs(dir, [{ id: 'FR-001', priority: 'MUST', title: 'Login' }]);
    writeBugs(dir, [{ id: 'BG-001', status: 'open', fr: null }]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig(dir)), []);
  });
});

// ── fixedBugsWithoutTC ────────────────────────────────────────────────────────

describe('fixedBugsWithoutTC()', () => {
  it('returns empty array when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.deepEqual(fixedBugsWithoutTC(dir, baseConfig(dir)), []);
  });

  it('returns fixed bugs with null tc_reference', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'fixed', tc_reference: null },
      { id: 'BG-002', status: 'fixed', tc_reference: 'TC-001' },
      { id: 'BG-003', status: 'open',  tc_reference: null },
    ]);
    const result = fixedBugsWithoutTC(dir, baseConfig(dir));
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'BG-001');
  });
});

// ── cmdBug — add ──────────────────────────────────────────────────────────────

describe('cmdBug add', () => {
  it('creates BUGS.json with BG-001 on first add', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'Login fails on empty password', '--fr', 'FR-001', '--severity', 'high'], err });
    const data = readBugs(dir);
    assert.equal(data.bugs.length, 1);
    assert.equal(data.bugs[0].id, 'BG-001');
    assert.equal(data.bugs[0].status, 'open');
    assert.equal(data.bugs[0].fr, 'FR-001');
    assert.equal(data.bugs[0].severity, 'high');
  });

  it('auto-increments ID', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    writeBugs(dir, [{ id: 'BG-001', status: 'open' }]);
    cmdBug({ dir, args: ['add', '--title', 'Second bug'], err });
    const data = readBugs(dir);
    assert.equal(data.bugs[1].id, 'BG-002');
  });

  it('throws when --title is missing', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    assert.throws(() => cmdBug({ dir, args: ['add', '--fr', 'FR-001'], err }), /--title is required/);
  });
});

// ── cmdBug — fix / verify / close lifecycle ───────────────────────────────────

describe('cmdBug lifecycle', () => {
  function setup() {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    writeBugs(dir, [{ id: 'BG-001', title: 'Test bug', status: 'open', fr: 'FR-001', tc_reference: null }]);
    return dir;
  }

  it('fix transitions to in_progress', () => {
    const dir = setup();
    cmdBug({ dir, args: ['fix', 'BG-001'], err });
    assert.equal(readBugs(dir).bugs[0].status, 'in_progress');
  });

  it('verify requires --tc flag', () => {
    const dir = setup();
    assert.throws(() => cmdBug({ dir, args: ['verify', 'BG-001'], err }), /--tc is required/);
  });

  it('verify sets fixed and records tc_reference', () => {
    const dir = setup();
    cmdBug({ dir, args: ['verify', 'BG-001', '--tc', 'TC-021'], err });
    const bug = readBugs(dir).bugs[0];
    assert.equal(bug.status, 'fixed');
    assert.equal(bug.tc_reference, 'TC-021');
  });

  it('close sets status to closed', () => {
    const dir = setup();
    cmdBug({ dir, args: ['close', 'BG-001'], err });
    assert.equal(readBugs(dir).bugs[0].status, 'closed');
  });

  it('errors when bug id not found', () => {
    const dir = setup();
    assert.throws(() => cmdBug({ dir, args: ['fix', 'BG-999'], err }), /BG-999 not found/);
  });
});

// ── cmdBug — list ─────────────────────────────────────────────────────────────

describe('cmdBug list', () => {
  it('runs without error when BUGS.json has items', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    writeBugs(dir, [{ id: 'BG-001', title: 'Test', status: 'open', severity: 'medium', fr: null, tc_reference: null }]);
    assert.doesNotThrow(() => cmdBug({ dir, args: ['list'], err }));
  });
});
