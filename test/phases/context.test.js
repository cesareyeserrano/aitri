import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractRequirements, extractTestIndex, extractManifest, head } from '../../lib/phases/context.js';

const fullRequirements = () => JSON.stringify({
  project_name: 'Test Project',
  technology_preferences: ['Node.js'],
  constraints: ['no external APIs'],
  no_go_zone: ['No authentication', 'No database', 'No backend server'],
  user_personas: [
    { role: 'End User', tech_level: 'low', goal: 'track expenses', pain_point: 'forgetting to log' },
  ],
  functional_requirements: [
    { id: 'FR-001', title: 'Login', priority: 'MUST', type: 'security', acceptance_criteria: ['401 on invalid token'] },
    { id: 'FR-002', title: 'Dashboard', priority: 'MUST', type: 'UX', acceptance_criteria: ['renders at 375px'] },
  ],
  user_stories: [
    {
      id: 'US-001',
      requirement_id: 'FR-001',
      as_a: 'user', i_want: 'to login', so_that: 'I can access data',
      acceptance_criteria: [
        { id: 'AC-001', given: 'user exists with email=test@example.com', when: 'POST /auth/login', then: 'status 200, JWT returned' },
      ],
    },
  ],
  non_functional_requirements: [
    { id: 'NFR-001', category: 'Performance', requirement: 'p99 < 200ms', acceptance_criteria: 'measured under load' },
  ],
});

describe('extractRequirements()', () => {

  it('returns valid JSON', () => {
    assert.doesNotThrow(() => JSON.parse(extractRequirements(fullRequirements())));
  });

  it('includes project_name', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    assert.equal(out.project_name, 'Test Project');
  });

  it('includes no_go_zone', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    assert.ok(Array.isArray(out.no_go_zone), 'no_go_zone must be an array');
    assert.equal(out.no_go_zone.length, 3);
  });

  it('includes user_personas with role, tech_level, goal, pain_point', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    assert.ok(Array.isArray(out.user_personas), 'user_personas must be an array');
    const p = out.user_personas[0];
    assert.equal(p.role, 'End User');
    assert.equal(p.tech_level, 'low');
    assert.ok(p.goal);
    assert.ok(p.pain_point);
  });

  it('includes functional_requirements with id, title, priority, type, acceptance_criteria', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    assert.ok(Array.isArray(out.functional_requirements));
    const fr = out.functional_requirements[0];
    assert.equal(fr.id, 'FR-001');
    assert.equal(fr.type, 'security');
    assert.ok(Array.isArray(fr.acceptance_criteria));
  });

  it('includes user_stories with id and acceptance_criteria', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    assert.ok(Array.isArray(out.user_stories), 'user_stories must be an array');
    const us = out.user_stories[0];
    assert.equal(us.id, 'US-001');
    assert.equal(us.requirement_id, 'FR-001');
    assert.ok(Array.isArray(us.acceptance_criteria));
  });

  it('user_stories acceptance_criteria includes id, given, when, then', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    const ac = out.user_stories[0].acceptance_criteria[0];
    assert.equal(ac.id, 'AC-001');
    assert.ok(ac.given);
    assert.ok(ac.when);
    assert.ok(ac.then);
  });

  it('user_stories strips narrative fields (as_a, i_want, so_that)', () => {
    const out = JSON.parse(extractRequirements(fullRequirements()));
    const us = out.user_stories[0];
    assert.equal(us.as_a, undefined);
    assert.equal(us.i_want, undefined);
    assert.equal(us.so_that, undefined);
  });

  it('handles missing user_stories gracefully (no throw)', () => {
    const d = JSON.parse(fullRequirements());
    delete d.user_stories;
    assert.doesNotThrow(() => extractRequirements(JSON.stringify(d)));
    const out = JSON.parse(extractRequirements(JSON.stringify(d)));
    assert.equal(out.user_stories, undefined);
  });

  it('handles missing no_go_zone gracefully (no throw)', () => {
    const d = JSON.parse(fullRequirements());
    delete d.no_go_zone;
    assert.doesNotThrow(() => extractRequirements(JSON.stringify(d)));
  });

  it('handles missing user_personas gracefully (no throw)', () => {
    const d = JSON.parse(fullRequirements());
    delete d.user_personas;
    assert.doesNotThrow(() => extractRequirements(JSON.stringify(d)));
  });

  it('returns raw content on malformed JSON', () => {
    const raw = '{not valid json}';
    assert.equal(extractRequirements(raw), raw);
  });

  it('excludes description from functional_requirements', () => {
    const d = JSON.parse(fullRequirements());
    d.functional_requirements[0].description = 'some description';
    const out = JSON.parse(extractRequirements(JSON.stringify(d)));
    assert.equal(out.functional_requirements[0].description, undefined);
  });
});

describe('head()', () => {

  it('returns first N lines', () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = head(content, 10);
    assert.equal(result.split('\n').length, 10);
    assert.ok(result.includes('line 1'));
    assert.ok(!result.includes('line 11'));
  });

  it('returns full content when shorter than limit', () => {
    const content = 'line 1\nline 2\nline 3';
    const result = head(content, 100);
    assert.equal(result, content);
  });

  it('defaults to 160 lines', () => {
    const content = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const result = head(content);
    assert.equal(result.split('\n').length, 160);
  });
});
