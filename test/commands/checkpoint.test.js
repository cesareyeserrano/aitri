/**
 * Tests: aitri checkpoint — named state snapshot
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { cmdCheckpoint } from '../../lib/commands/checkpoint.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-cp-'));
}

function writeFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function captureStderr(fn) {
  let out = '';
  const orig = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => { out += chunk; return true; };
  try { fn(); } finally { process.stderr.write = orig; }
  return out;
}

function captureStdout(fn) {
  let out = '';
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { out += chunk; return true; };
  try { fn(); } finally { process.stdout.write = orig; }
  return out;
}

const minimalConfig = (overrides = {}) => JSON.stringify({
  projectName: 'TestProject',
  artifactsDir: '',
  approvedPhases: [],
  completedPhases: [],
  ...overrides,
});

const noopErr = (msg) => { throw new Error(msg); };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cmdCheckpoint() — default (write)', () => {
  let dir;
  let stderr;

  before(() => {
    dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    stderr = captureStderr(() => {
      // suppress stdout (resume output) while capturing stderr
      captureStdout(() => cmdCheckpoint({ dir, args: [], flagValue: () => null, err: noopErr }));
    });
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('creates checkpoints/ directory', () => {
    assert.ok(fs.existsSync(path.join(dir, 'checkpoints')), 'checkpoints/ directory must be created');
  });

  it('writes a .md file in checkpoints/', () => {
    const files = fs.readdirSync(path.join(dir, 'checkpoints'));
    assert.equal(files.filter(f => f.endsWith('.md')).length, 1, 'exactly 1 .md file must exist');
  });

  it('checkpoint filename starts with today\'s date', () => {
    const date = new Date().toISOString().slice(0, 10);
    const files = fs.readdirSync(path.join(dir, 'checkpoints'));
    assert.ok(files[0].startsWith(date), `filename must start with ${date}`);
  });

  it('checkpoint file contains resume content', () => {
    const files = fs.readdirSync(path.join(dir, 'checkpoints'));
    const content = fs.readFileSync(path.join(dir, 'checkpoints', files[0]), 'utf8');
    assert.ok(content.includes('AITRI SESSION RESUME'), 'checkpoint file must contain resume header');
  });

  it('prints confirmation to stderr', () => {
    assert.ok(stderr.includes('Checkpoint saved'), 'confirmation must appear on stderr');
    assert.ok(stderr.includes('checkpoints/'), 'path must appear in confirmation');
  });
});

describe('cmdCheckpoint() — --name label', () => {
  let dir;
  let fname;

  before(() => {
    dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    captureStderr(() => {
      captureStdout(() => cmdCheckpoint({
        dir, args: ['--name', 'before-phase4-refactor'],
        flagValue: (f) => f === '--name' ? 'before-phase4-refactor' : null,
        err: noopErr,
      }));
    });
    const files = fs.readdirSync(path.join(dir, 'checkpoints'));
    fname = files[0];
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('filename includes the label', () => {
    assert.ok(fname.includes('before-phase4-refactor'), 'label must appear in filename');
  });

  it('filename follows date-label.md pattern', () => {
    const date = new Date().toISOString().slice(0, 10);
    assert.ok(fname === `${date}-before-phase4-refactor.md`, `expected ${date}-before-phase4-refactor.md, got ${fname}`);
  });
});

describe('cmdCheckpoint() — --list', () => {
  let dir;
  let output;

  before(() => {
    dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    // Create two checkpoints
    const cpDir = path.join(dir, 'checkpoints');
    fs.mkdirSync(cpDir);
    fs.writeFileSync(path.join(cpDir, '2026-03-01-alpha.md'), '# checkpoint alpha', 'utf8');
    fs.writeFileSync(path.join(cpDir, '2026-03-10-beta.md'),  '# checkpoint beta',  'utf8');
    output = captureStdout(() => cmdCheckpoint({
      dir, args: ['--list'],
      flagValue: () => null,
      err: noopErr,
    }));
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('lists checkpoint filenames', () => {
    assert.ok(output.includes('2026-03-01-alpha.md'), 'alpha checkpoint must appear');
    assert.ok(output.includes('2026-03-10-beta.md'),  'beta checkpoint must appear');
  });

  it('shows newest first', () => {
    const betaIdx  = output.indexOf('2026-03-10-beta.md');
    const alphaIdx = output.indexOf('2026-03-01-alpha.md');
    assert.ok(betaIdx < alphaIdx, 'newer checkpoint must appear before older one');
  });
});

describe('cmdCheckpoint() — --list with no checkpoints', () => {
  let dir;
  let output;

  before(() => {
    dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    output = captureStdout(() => cmdCheckpoint({
      dir, args: ['--list'],
      flagValue: () => null,
      err: noopErr,
    }));
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('prints "No checkpoints found" when directory does not exist', () => {
    assert.ok(output.includes('No checkpoints'), 'must report no checkpoints gracefully');
  });
});

describe('cmdCheckpoint() — label sanitization', () => {
  let dir;
  let fname;

  before(() => {
    dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    captureStderr(() => {
      captureStdout(() => cmdCheckpoint({
        dir, args: ['--name', 'my label with spaces & special!'],
        flagValue: (f) => f === '--name' ? 'my label with spaces & special!' : null,
        err: noopErr,
      }));
    });
    const files = fs.readdirSync(path.join(dir, 'checkpoints'));
    fname = files[0];
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('replaces unsafe characters with dashes in filename', () => {
    assert.ok(!fname.includes(' '), 'spaces must be replaced');
    assert.ok(!fname.includes('!'), 'special chars must be replaced');
    assert.ok(!fname.includes('&'), 'ampersand must be replaced');
  });
});
