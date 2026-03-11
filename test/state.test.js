import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { loadConfig, saveConfig, readArtifact } from '../lib/state.js';

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-state-test-'));
}

describe('loadConfig()', () => {

  it('returns defaults when .aitri does not exist', () => {
    const dir = tmpDir();
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.approvedPhases, []);
    assert.deepEqual(cfg.completedPhases, []);
    assert.equal(cfg.currentPhase, 0);
    fs.rmSync(dir, { recursive: true });
  });

  it('loads valid config from .aitri', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ approvedPhases: [1, 2], currentPhase: 2 }));
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.approvedPhases, [1, 2]);
    assert.equal(cfg.currentPhase, 2);
    fs.rmSync(dir, { recursive: true });
  });

  it('merges defaults for missing fields (backward compat)', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.aitri'), JSON.stringify({ approvedPhases: [1] }));
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.completedPhases, [], 'completedPhases default must be applied when missing');
    assert.equal(cfg.currentPhase, 0, 'currentPhase default must be applied when missing');
    fs.rmSync(dir, { recursive: true });
  });

  it('returns defaults on malformed JSON', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.aitri'), '{not valid json');
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.approvedPhases, []);
    assert.deepEqual(cfg.completedPhases, []);
    fs.rmSync(dir, { recursive: true });
  });

  it('creates .aitri.bak when config is malformed', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.aitri'), '{not valid json');
    loadConfig(dir);
    assert.ok(fs.existsSync(path.join(dir, '.aitri.bak')), '.aitri.bak must exist after malformed config');
    fs.rmSync(dir, { recursive: true });
  });

  it('handles BOM-prefixed config file', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '.aitri'), '\uFEFF' + JSON.stringify({ approvedPhases: [1, 2] }));
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.approvedPhases, [1, 2], 'BOM must be stripped before parsing');
    fs.rmSync(dir, { recursive: true });
  });
});

describe('saveConfig()', () => {

  it('writes config to .aitri as JSON', () => {
    const dir = tmpDir();
    saveConfig(dir, { approvedPhases: [1, 2], currentPhase: 2 });
    const raw = JSON.parse(fs.readFileSync(path.join(dir, '.aitri'), 'utf8'));
    assert.deepEqual(raw.approvedPhases, [1, 2]);
    assert.equal(raw.currentPhase, 2);
    fs.rmSync(dir, { recursive: true });
  });

  it('adds updatedAt timestamp to saved config', () => {
    const dir = tmpDir();
    saveConfig(dir, { approvedPhases: [] });
    const raw = JSON.parse(fs.readFileSync(path.join(dir, '.aitri'), 'utf8'));
    assert.ok(raw.updatedAt, 'updatedAt must be present');
    assert.doesNotThrow(() => new Date(raw.updatedAt), 'updatedAt must be a valid ISO date');
    fs.rmSync(dir, { recursive: true });
  });

  it('saved config is readable by loadConfig (round-trip)', () => {
    const dir = tmpDir();
    const original = { approvedPhases: [1, 2, 3], currentPhase: 3, completedPhases: [1, 2, 3] };
    saveConfig(dir, original);
    const loaded = loadConfig(dir);
    assert.deepEqual(loaded.approvedPhases, original.approvedPhases);
    assert.equal(loaded.currentPhase, original.currentPhase);
    assert.deepEqual(loaded.completedPhases, original.completedPhases);
    fs.rmSync(dir, { recursive: true });
  });

  it('overwrites existing config on repeated saves', () => {
    const dir = tmpDir();
    saveConfig(dir, { approvedPhases: [1] });
    saveConfig(dir, { approvedPhases: [1, 2] });
    const cfg = loadConfig(dir);
    assert.deepEqual(cfg.approvedPhases, [1, 2]);
    fs.rmSync(dir, { recursive: true });
  });
});

describe('readArtifact()', () => {

  it('returns file content when file exists', () => {
    const dir = tmpDir();
    fs.writeFileSync(path.join(dir, '01_REQUIREMENTS.json'), '{"ok":true}');
    const content = readArtifact(dir, '01_REQUIREMENTS.json');
    assert.equal(content, '{"ok":true}');
    fs.rmSync(dir, { recursive: true });
  });

  it('returns null when file does not exist', () => {
    const dir = tmpDir();
    const content = readArtifact(dir, 'nonexistent.json');
    assert.equal(content, null);
    fs.rmSync(dir, { recursive: true });
  });
});
