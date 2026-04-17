/**
 * Tests: aitri approve — mark phase as approved (non-TTY path)
 * Covers: state recording, not-completed gate, missing artifact, lastSession, alias support
 * Note: TTY-interactive paths (checklist, drift confirmation) cannot be tested in unit tests.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  cmdApprove,
  buildApprovalSummary,
  summarizeRequirements,
  summarizeTestCases,
  summarizeManifest,
  summarizeCompliance,
  summarizeMarkdownSections,
} from '../../lib/commands/approve.js';
import { loadConfig, hashArtifact } from '../../lib/state.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'aitri-approve-'));
}

function writeFile(dir, relPath, content) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function captureAll(fn) {
  let out = '';
  const origLog = console.log.bind(console);
  console.log = (...a) => { out += a.join(' ') + '\n'; };
  try { fn(); } finally { console.log = origLog; }
  return out;
}

const noopErr = (msg) => { throw new Error(msg); };

const minimalConfig = (overrides = {}) => JSON.stringify({
  projectName: 'TestProject',
  artifactsDir: 'spec',
  approvedPhases: [],
  completedPhases: [],
  ...overrides,
});

const ARTIFACT_CONTENT = '{"project_name":"T","functional_requirements":[]}';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cmdApprove() — successful approval (non-TTY)', () => {
  let dir;
  let output;

  before(() => {
    dir = tmpDir();
    writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
    writeFile(dir, '.aitri', minimalConfig({
      completedPhases: [1],
    }));
    output = captureAll(() =>
      cmdApprove({ dir, args: ['requirements'], err: noopErr })
    );
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('adds phase to approvedPhases', () => {
    const config = loadConfig(dir);
    assert.ok(config.approvedPhases.includes(1));
  });

  it('stores artifact hash', () => {
    const config = loadConfig(dir);
    const expected = hashArtifact(ARTIFACT_CONTENT);
    assert.equal(config.artifactHashes['1'], expected);
  });

  it('appends approved event', () => {
    const config = loadConfig(dir);
    const last = config.events[config.events.length - 1];
    assert.equal(last.event, 'approved');
    assert.equal(last.phase, 1);
  });

  it('writes lastSession', () => {
    const config = loadConfig(dir);
    assert.ok(config.lastSession, 'lastSession must exist');
    assert.equal(config.lastSession.event, 'approve requirements');
  });

  it('prints success message', () => {
    assert.ok(output.includes('APPROVED'), 'should include APPROVED');
    assert.ok(output.includes('requirements'), 'should include alias');
  });
});

describe('cmdApprove() — accepts numeric phase', () => {
  let dir;

  before(() => {
    dir = tmpDir();
    writeFile(dir, 'spec/02_SYSTEM_DESIGN.md', '## Executive Summary\nDesign.\n');
    writeFile(dir, '.aitri', minimalConfig({
      completedPhases: [2],
    }));
    captureAll(() =>
      cmdApprove({ dir, args: ['2'], err: noopErr })
    );
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('approves phase 2', () => {
    const config = loadConfig(dir);
    assert.ok(config.approvedPhases.includes(2));
  });
});

describe('cmdApprove() — not-completed gate', () => {
  it('throws if phase not completed first', () => {
    const dir = tmpDir();
    writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
    writeFile(dir, '.aitri', minimalConfig({ completedPhases: [] }));
    try {
      assert.throws(
        () => cmdApprove({ dir, args: ['requirements'], err: noopErr }),
        /not been validated/
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('cmdApprove() — missing artifact', () => {
  it('throws if artifact file is missing', () => {
    const dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig({ completedPhases: [1] }));
    // No artifact file written
    try {
      assert.throws(
        () => cmdApprove({ dir, args: ['requirements'], err: noopErr }),
        /Artifact missing/
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('cmdApprove() — unknown phase', () => {
  it('throws usage error', () => {
    const dir = tmpDir();
    writeFile(dir, '.aitri', minimalConfig());
    try {
      assert.throws(
        () => cmdApprove({ dir, args: ['nonexistent'], err: noopErr }),
        /Usage/
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

// NOTE: drift approval requires TTY interaction (confirmation prompt).
// In non-TTY mode, cmdApprove calls process.exit(1) on drift — cannot be unit-tested.
// Drift clearing is covered by the approve.js logic path that runs after TTY confirmation.

// ── Cascade invalidation ──────────────────────────────────────────────────────

describe('cmdApprove() — cascade invalidation on re-approval', () => {
  it('does not cascade on first approval (nothing downstream was approved)', () => {
    const dir = tmpDir();
    try {
      writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
      writeFile(dir, '.aitri', minimalConfig({
        completedPhases: [1],
        approvedPhases:  [],   // first approval
      }));
      captureAll(() => cmdApprove({ dir, args: ['requirements'], err: noopErr }));
      const config = loadConfig(dir);
      // No downstream to cascade — approvedPhases should only contain phase 1
      assert.deepEqual(config.approvedPhases.map(String), ['1']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('cascades downstream phases on re-approval of requirements', () => {
    const dir = tmpDir();
    try {
      writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
      writeFile(dir, '.aitri', minimalConfig({
        completedPhases: [1, 2, 3],
        approvedPhases:  [1, 2, 3],  // re-approval of phase 1
        artifactHashes:  { '2': 'oldhash', '3': 'oldhash' },
      }));
      captureAll(() => cmdApprove({ dir, args: ['requirements'], err: noopErr }));
      const config = loadConfig(dir);
      assert.ok(config.approvedPhases.map(String).includes('1'), 'phase 1 must stay approved');
      assert.ok(!config.approvedPhases.map(String).includes('2'), 'phase 2 must be cascaded out');
      assert.ok(!config.approvedPhases.map(String).includes('3'), 'phase 3 must be cascaded out');
      assert.ok(!config.completedPhases.map(String).includes('2'), 'phase 2 must be cascaded from completed');
      assert.ok(!config.artifactHashes['2'], 'phase 2 hash must be cleared');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('resets verifyPassed when cascade reaches build', () => {
    const dir = tmpDir();
    try {
      writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
      writeFile(dir, '.aitri', minimalConfig({
        completedPhases: [1, 2, 3, 4],
        approvedPhases:  [1, 2, 3, 4],
        verifyPassed:    true,
      }));
      captureAll(() => cmdApprove({ dir, args: ['requirements'], err: noopErr }));
      const config = loadConfig(dir);
      assert.equal(config.verifyPassed, false, 'verifyPassed must be reset');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('prints cascade warning when downstream phases are reset', () => {
    const dir = tmpDir();
    try {
      writeFile(dir, 'spec/01_REQUIREMENTS.json', ARTIFACT_CONTENT);
      writeFile(dir, '.aitri', minimalConfig({
        completedPhases: [1, 2, 3],
        approvedPhases:  [1, 2, 3],
      }));
      const out = captureAll(() => cmdApprove({ dir, args: ['requirements'], err: noopErr }));
      assert.ok(out.includes('Cascade'), `expected cascade warning, got: ${out}`);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  it('cascade from architecture leaves requirements intact', () => {
    const dir = tmpDir();
    try {
      writeFile(dir, 'spec/02_SYSTEM_DESIGN.md', '## Executive Summary\nDesign.\n');
      writeFile(dir, '.aitri', minimalConfig({
        completedPhases: [1, 2, 3, 4],
        approvedPhases:  [1, 2, 3, 4],
      }));
      captureAll(() => cmdApprove({ dir, args: ['architecture'], err: noopErr }));
      const config = loadConfig(dir);
      assert.ok(config.approvedPhases.map(String).includes('1'), 'requirements must remain approved');
      assert.ok(!config.approvedPhases.map(String).includes('3'), 'tests must be cascaded');
      assert.ok(!config.approvedPhases.map(String).includes('4'), 'build must be cascaded');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('cmdApprove() — phase 4 shows verify-run hint', () => {
  let dir;
  let output;

  before(() => {
    dir = tmpDir();
    writeFile(dir, 'spec/04_IMPLEMENTATION_MANIFEST.json', '{"files_created":[],"setup_commands":[]}');
    writeFile(dir, '.aitri', minimalConfig({
      completedPhases: [4],
    }));
    output = captureAll(() =>
      cmdApprove({ dir, args: ['build'], err: noopErr })
    );
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('mentions verify-run as next step', () => {
    assert.ok(output.includes('verify-run'), 'should point to verify-run after phase 4');
  });
});

// ── Approval summary builders ────────────────────────────────────────────────

describe('summarizeRequirements()', () => {
  it('counts FRs by priority and type, plus NFRs and ACs', () => {
    const raw = JSON.stringify({
      functional_requirements: [
        { id: 'FR-1', priority: 'MUST',   type: 'business', acceptance_criteria: ['a','b'] },
        { id: 'FR-2', priority: 'MUST',   type: 'ux',       acceptance_criteria: ['c'] },
        { id: 'FR-3', priority: 'SHOULD', type: 'business', acceptance_criteria: [] },
      ],
      non_functional_requirements: [{ id: 'NFR-1' }, { id: 'NFR-2' }],
    });
    const lines = summarizeRequirements(raw);
    assert.ok(lines.some(l => l.includes('Functional requirements: 3')));
    assert.ok(lines.some(l => l.includes('2 MUST')));
    assert.ok(lines.some(l => l.includes('1 SHOULD')));
    assert.ok(lines.some(l => l.includes('2 business')));
    assert.ok(lines.some(l => l.includes('Non-functional requirements: 2')));
    assert.ok(lines.some(l => l.includes('Acceptance criteria: 3 total')));
  });

  it('returns null on malformed JSON', () => {
    assert.equal(summarizeRequirements('{ not json'), null);
  });
});

describe('summarizeTestCases()', () => {
  it('counts TCs by type, scenario and linked FRs', () => {
    const raw = JSON.stringify({
      test_cases: [
        { id: 'TC-1', type: 'unit',        scenario: 'happy_path', requirement_id: 'FR-1' },
        { id: 'TC-2', type: 'unit',        scenario: 'edge_case',  requirement_id: 'FR-1' },
        { id: 'TC-3', type: 'integration', scenario: 'happy_path', requirement_id: 'FR-2' },
      ],
    });
    const lines = summarizeTestCases(raw);
    assert.ok(lines.some(l => l.includes('Test cases: 3')));
    assert.ok(lines.some(l => l.includes('linked FRs: 2')));
    assert.ok(lines.some(l => l.includes('2 unit')));
    assert.ok(lines.some(l => l.includes('1 integration')));
    assert.ok(lines.some(l => l.includes('happy_path')));
  });
});

describe('summarizeManifest()', () => {
  it('reports created/modified counts and zero-debt case', () => {
    const raw = JSON.stringify({
      files_created:  ['a.js', 'b.js'],
      files_modified: ['c.js'],
      technical_debt: [],
    });
    const lines = summarizeManifest(raw);
    assert.ok(lines.some(l => l.includes('Files created:  2')));
    assert.ok(lines.some(l => l.includes('Files modified: 1')));
    assert.ok(lines.some(l => l.includes('Technical debt: none')));
  });

  it('lists fr_ids when technical_debt entries exist', () => {
    const raw = JSON.stringify({
      files_created: ['a.js'],
      technical_debt: [
        { fr_id: 'FR-1', substitution: 'mocked' },
        { fr_id: 'FR-3', substitution: 'stub'   },
      ],
    });
    const lines = summarizeManifest(raw);
    assert.ok(lines.some(l => l.includes('2 substitutions')));
    assert.ok(lines.some(l => l.includes('FR-1, FR-3')));
  });
});

describe('summarizeCompliance()', () => {
  it('breaks compliance entries down by level', () => {
    const raw = JSON.stringify({
      overall_status: 'production',
      phases_completed: [1, 2, 3, 4, 5],
      requirement_compliance: [
        { id: 'FR-1', level: 'production' },
        { id: 'FR-2', level: 'production' },
        { id: 'FR-3', level: 'mock'       },
      ],
    });
    const lines = summarizeCompliance(raw);
    assert.ok(lines.some(l => l.includes('Overall status: production')));
    assert.ok(lines.some(l => l.includes('3 entries')));
    assert.ok(lines.some(l => l.includes('2 production')));
    assert.ok(lines.some(l => l.includes('1 mock')));
    assert.ok(lines.some(l => l.includes('Phases completed: 5')));
  });
});

describe('summarizeMarkdownSections()', () => {
  it('lists H2 sections and truncates beyond 8', () => {
    const md = Array.from({ length: 10 }, (_, i) => `## Section ${i + 1}`).join('\n');
    const lines = summarizeMarkdownSections(md);
    assert.ok(lines[0].includes('Sections (10)'));
    assert.equal(lines.filter(l => l.includes('•')).length, 8);
    assert.ok(lines.some(l => l.includes('and 2 more')));
  });

  it('uses custom label when provided', () => {
    const lines = summarizeMarkdownSections('## A\n## B', 'Review sections');
    assert.ok(lines[0].includes('Review sections (2)'));
  });

  it('returns null on null input', () => {
    assert.equal(summarizeMarkdownSections(null), null);
  });
});

describe('buildApprovalSummary() — dispatcher', () => {
  it('routes phase 1 to summarizeRequirements', () => {
    const lines = buildApprovalSummary(1, '{"functional_requirements":[],"non_functional_requirements":[]}');
    assert.ok(lines.some(l => l.includes('Functional requirements: 0')));
  });
  it('routes phase 2 to markdown sections', () => {
    const lines = buildApprovalSummary(2, '## Overview\n## Components');
    assert.ok(lines[0].includes('Sections (2)'));
  });
  it('routes phase 3 to summarizeTestCases', () => {
    const lines = buildApprovalSummary(3, '{"test_cases":[]}');
    assert.ok(lines.some(l => l.includes('Test cases: 0')));
  });
  it('routes phase 4 to summarizeManifest', () => {
    const lines = buildApprovalSummary(4, '{"files_created":[],"technical_debt":[]}');
    assert.ok(lines.some(l => l.includes('Files created:  0')));
  });
  it('routes phase 5 to summarizeCompliance', () => {
    const lines = buildApprovalSummary(5, '{"requirement_compliance":[],"phases_completed":[]}');
    assert.ok(lines.some(l => l.includes('Requirement compliance: 0 entries')));
  });
  it('routes ux/discovery/review to markdown sections', () => {
    assert.ok(buildApprovalSummary('ux', '## Screen 1')[0].includes('Sections (1)'));
    assert.ok(buildApprovalSummary('discovery', '## Stakeholders')[0].includes('Sections (1)'));
    assert.ok(buildApprovalSummary('review', '## Findings')[0].includes('Review sections (1)'));
  });
  it('returns null on missing artifact content', () => {
    assert.equal(buildApprovalSummary(1, null), null);
  });
});

describe('cmdApprove() — phase 5 shows completion message', () => {
  let dir;
  let output;

  before(() => {
    dir = tmpDir();
    writeFile(dir, 'spec/05_PROOF_OF_COMPLIANCE.json', '{"requirement_compliance":[]}');
    writeFile(dir, '.aitri', minimalConfig({
      approvedPhases: [1, 2, 3, 4],
      completedPhases: [1, 2, 3, 4, 5],
      verifyPassed: true,
    }));
    output = captureAll(() =>
      cmdApprove({ dir, args: ['deploy'], err: noopErr })
    );
  });

  after(() => fs.rmSync(dir, { recursive: true, force: true }));

  it('shows all phases complete message', () => {
    assert.ok(output.includes('All 5 phases'), 'should celebrate completion');
  });
});
