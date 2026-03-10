import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_DEFS } from '../../lib/phases/index.js';

const makeTC = (id, reqId, type) => ({
  id, requirement_id: reqId, title: `Test ${id}`, type,
  priority: 'high', preconditions: [], steps: ['step'], expected_result: 'ok', test_data: {},
});

const validP3 = () => JSON.stringify({
  test_plan: { strategy: 'unit + e2e', coverage_goal: '80%', test_types: ['unit', 'e2e'] },
  test_cases: [
    makeTC('TC-001', 'FR-001', 'unit'),
    makeTC('TC-002', 'FR-001', 'integration'),
    makeTC('TC-003', 'FR-001', 'e2e'),
    makeTC('TC-004', 'FR-002', 'unit'),
    makeTC('TC-005', 'FR-002', 'integration'),
    makeTC('TC-006', 'FR-002', 'e2e'),
  ],
});

describe('Phase 3 — validate()', () => {

  it('passes with valid artifact', () => {
    assert.doesNotThrow(() => PHASE_DEFS[3].validate(validP3()));
  });

  it('throws when test_cases is empty', () => {
    const d = { test_plan: {}, test_cases: [] };
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /test_cases array is required/);
  });

  it('throws when a requirement has fewer than 3 test cases', () => {
    const d = JSON.parse(validP3());
    d.test_cases = d.test_cases.filter(tc => !(tc.requirement_id === 'FR-001' && tc.id === 'TC-003'));
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /FR-001 has 2 test case.*min 3/);
  });

  it('throws when fewer than 2 e2e tests', () => {
    const d = JSON.parse(validP3());
    d.test_cases = d.test_cases.map(tc => ({ ...tc, type: 'unit' }));
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /0 e2e test.*min 2/);
  });

  it('throws when exactly 1 e2e test', () => {
    const d = JSON.parse(validP3());
    d.test_cases = d.test_cases.map(tc =>
      tc.id === 'TC-006' ? { ...tc, type: 'integration' } : tc
    );
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /1 e2e test.*min 2/);
  });

  it('passes when exactly 2 e2e tests', () => {
    assert.doesNotThrow(() => PHASE_DEFS[3].validate(validP3()));
  });

  it('throws when requirement_id is comma-separated', () => {
    const d = JSON.parse(validP3());
    // Agent mistake: combining multiple FRs in one requirement_id
    d.test_cases[0].requirement_id = 'FR-001,FR-002';
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /requirement_id must be a single FR id/);
  });

  it('throws when type is used for scenario instead of execution type', () => {
    const d = JSON.parse(validP3());
    // Agent mistake: using type for scenario classification instead of unit|integration|e2e
    d.test_cases = d.test_cases.map(tc => ({ ...tc, type: 'happy_path' }));
    assert.throws(() => PHASE_DEFS[3].validate(JSON.stringify(d)), /0 e2e test.*min 2/);
  });
});

describe('Phase 3 — buildBriefing() (BL-003)', () => {
  const briefing = PHASE_DEFS[3].buildBriefing({ dir: '/tmp/test', inputs: { '01_REQUIREMENTS.json': '{}', '02_SYSTEM_DESIGN.md': '' }, feedback: null });

  it('briefing contains Given/When/Then instruction', () => {
    assert.ok(briefing.includes('Given') && briefing.includes('When') && briefing.includes('Then'),
      'briefing must mention Given/When/Then format');
  });

  it('briefing contains SPEC-SEALED rule', () => {
    assert.ok(briefing.includes('SPEC-SEALED'), 'briefing must mention SPEC-SEALED rule');
  });

  it('briefing contains Type Coverage Matrix instruction', () => {
    assert.ok(briefing.includes('Type Coverage Matrix') || briefing.includes('coverage matrix'),
      'briefing must mention Type Coverage Matrix');
  });

  it('briefing contains concrete value example (negative)', () => {
    assert.ok(briefing.includes('valid data') || briefing.includes('abstract'),
      'briefing must show abstract vs concrete example');
  });
});
