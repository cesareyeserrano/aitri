import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openBugCount, autoVerifyBugs, getBlockingBugs, getOpenBugs, cmdBug } from '../../lib/commands/bug.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-bug-'));
}

function baseConfig() {
  return { artifactsDir: 'spec', approvedPhases: [], completedPhases: [] };
}

function writeBugs(dir, bugs) {
  const specDir = path.join(dir, 'spec');
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, 'BUGS.json'), JSON.stringify({ bugs }, null, 2));
}

function readBugs(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'spec', 'BUGS.json'), 'utf8'));
}

function err(msg) { throw new Error(msg); }

// ── openBugCount ──────────────────────────────────────────────────────────────

describe('openBugCount()', () => {
  it('returns null when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.equal(openBugCount(dir, baseConfig()), null);
  });

  it('returns 0 when all bugs are closed or verified', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'closed' },
      { id: 'BG-002', status: 'verified' },
    ]);
    assert.equal(openBugCount(dir, baseConfig()), 0);
  });

  it('counts open and fixed bugs (active bugs not yet resolved)', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'open' },
      { id: 'BG-002', status: 'fixed' },
      { id: 'BG-003', status: 'verified' },
      { id: 'BG-004', status: 'closed' },
    ]);
    assert.equal(openBugCount(dir, baseConfig()), 2);
  });
});

// ── getOpenBugs ───────────────────────────────────────────────────────────────

describe('getOpenBugs()', () => {
  it('returns empty array when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.deepEqual(getOpenBugs(dir, baseConfig()), []);
  });

  it('returns only open bugs sorted by severity', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'open',   severity: 'low' },
      { id: 'BG-002', status: 'open',   severity: 'critical' },
      { id: 'BG-003', status: 'fixed',  severity: 'high' },
      { id: 'BG-004', status: 'closed', severity: 'medium' },
    ]);
    const result = getOpenBugs(dir, baseConfig());
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'BG-002'); // critical first
    assert.equal(result[1].id, 'BG-001'); // low last
  });
});

// ── autoVerifyBugs ────────────────────────────────────────────────────────────

describe('autoVerifyBugs()', () => {
  it('transitions fixed → verified when linked TC passes', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(), [{ tc_id: 'TC-021', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'verified');
  });

  it('does not transition when linked TC fails', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(), [{ tc_id: 'TC-021', status: 'fail' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('does not transition when TC is not in results', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: 'TC-021' }]);
    autoVerifyBugs(dir, baseConfig(), [{ tc_id: 'TC-001', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('does not affect bugs with no tc_reference', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'fixed', tc_reference: null }]);
    autoVerifyBugs(dir, baseConfig(), [{ tc_id: 'TC-021', status: 'pass' }]);
    const data = readBugs(dir);
    assert.equal(data.bugs[0].status, 'fixed');
  });

  it('is a no-op when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.doesNotThrow(() => autoVerifyBugs(dir, baseConfig(), [{ tc_id: 'TC-001', status: 'pass' }]));
  });
});

// ── getBlockingBugs — severity-based ─────────────────────────────────────────

describe('getBlockingBugs()', () => {
  it('returns empty array when BUGS.json does not exist', () => {
    const dir = tmpDir();
    assert.deepEqual(getBlockingBugs(dir, baseConfig()), []);
  });

  it('blocks on open critical bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'open', severity: 'critical' }]);
    const blocking = getBlockingBugs(dir, baseConfig());
    assert.equal(blocking.length, 1);
    assert.equal(blocking[0].id, 'BG-001');
  });

  it('blocks on open high bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'open', severity: 'high' }]);
    const blocking = getBlockingBugs(dir, baseConfig());
    assert.equal(blocking.length, 1);
  });

  it('does not block on open medium bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'open', severity: 'medium' }]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig()), []);
  });

  it('does not block on open low bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [{ id: 'BG-001', status: 'open', severity: 'low' }]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig()), []);
  });

  it('does not block on fixed or verified critical bugs', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'fixed',    severity: 'critical' },
      { id: 'BG-002', status: 'verified', severity: 'high' },
    ]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig()), []);
  });

  it('does not block regardless of FR link (severity is the gate)', () => {
    const dir = tmpDir();
    writeBugs(dir, [
      { id: 'BG-001', status: 'open', severity: 'medium', fr: 'FR-001' },
    ]);
    assert.deepEqual(getBlockingBugs(dir, baseConfig()), []);
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

  it('captures steps_to_reproduce from --steps flags', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'Test bug', '--steps', 'Open /login', '--steps', 'Click submit'], err });
    const bug = readBugs(dir).bugs[0];
    assert.deepEqual(bug.steps_to_reproduce, ['Open /login', 'Click submit']);
  });

  it('captures expected_result and actual_result', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'T', '--expected', 'Should redirect', '--actual', 'HTTP 500'], err });
    const bug = readBugs(dir).bugs[0];
    assert.equal(bug.expected_result, 'Should redirect');
    assert.equal(bug.actual_result, 'HTTP 500');
  });

  it('captures environment and evidence', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'T', '--environment', 'local/Phase 4', '--evidence', 'test-results/TC-001/screenshot.png'], err });
    const bug = readBugs(dir).bugs[0];
    assert.equal(bug.environment, 'local/Phase 4');
    assert.equal(bug.evidence, 'test-results/TC-001/screenshot.png');
  });

  it('captures reported_by from --reported-by', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'T', '--reported-by', 'César'], err });
    const bug = readBugs(dir).bugs[0];
    assert.equal(bug.reported_by, 'César');
  });

  it('detected_by defaults to manual', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    cmdBug({ dir, args: ['add', '--title', 'T'], err });
    assert.equal(readBugs(dir).bugs[0].detected_by, 'manual');
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

// ── cmdBug — lifecycle ────────────────────────────────────────────────────────

describe('cmdBug lifecycle', () => {
  function setup() {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'spec'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ artifactsDir: 'spec' }));
    writeBugs(dir, [{ id: 'BG-001', title: 'Test bug', status: 'open', fr: 'FR-001', tc_reference: null }]);
    return dir;
  }

  it('fix transitions open → fixed', () => {
    const dir = setup();
    cmdBug({ dir, args: ['fix', 'BG-001'], err });
    assert.equal(readBugs(dir).bugs[0].status, 'fixed');
  });

  it('fix with --tc records tc_reference', () => {
    const dir = setup();
    cmdBug({ dir, args: ['fix', 'BG-001', '--tc', 'TC-021'], err });
    const bug = readBugs(dir).bugs[0];
    assert.equal(bug.status, 'fixed');
    assert.equal(bug.tc_reference, 'TC-021');
  });

  it('verify transitions fixed → verified without requiring --tc', () => {
    const dir = setup();
    cmdBug({ dir, args: ['fix', 'BG-001'], err });
    cmdBug({ dir, args: ['verify', 'BG-001'], err });
    assert.equal(readBugs(dir).bugs[0].status, 'verified');
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
