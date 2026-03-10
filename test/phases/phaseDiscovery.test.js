import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_DEFS } from '../../lib/phases/index.js';

const validDiscovery = () => `# Problem Definition

## Problem

Users managing multiple freelance clients manually track invoices in spreadsheets.
When a payment is late they have no automated reminder — they must check and email manually.
This leads to late payments going unnoticed for weeks, causing cash flow disruption.

## Users

- Freelancer (solo): non-technical, manages 5-20 clients, goal is to get paid on time
- Small agency owner: manages a team of 2-5 freelancers, needs consolidated payment view

## Success Criteria

- User can create an invoice in under 2 minutes
- Overdue invoices trigger an automated reminder within 24 hours of due date
- Payment status visible at a glance — no navigation required
- All invoices for a client accessible from a single screen

## Out of Scope

- Payroll or employee payment processing
- Multi-currency conversion
- Accounting software integration (QuickBooks, Xero)
- Mobile native app (web only at launch)
`;

describe('Phase Discovery — validate()', () => {

  it('passes with valid artifact', () => {
    assert.doesNotThrow(() => PHASE_DEFS['discovery'].validate(validDiscovery()));
  });

  it('throws when ## Problem section is missing', () => {
    const d = validDiscovery().replace('## Problem', '## Background');
    assert.throws(() => PHASE_DEFS['discovery'].validate(d), /Problem/);
  });

  it('throws when ## Users section is missing', () => {
    const d = validDiscovery().replace('## Users', '## Personas');
    assert.throws(() => PHASE_DEFS['discovery'].validate(d), /Users/);
  });

  it('throws when ## Success Criteria section is missing', () => {
    const d = validDiscovery().replace('## Success Criteria', '## Goals');
    assert.throws(() => PHASE_DEFS['discovery'].validate(d), /Success Criteria/);
  });

  it('throws when ## Out of Scope section is missing', () => {
    const d = validDiscovery().replace('## Out of Scope', '## Exclusions');
    assert.throws(() => PHASE_DEFS['discovery'].validate(d), /Out of Scope/);
  });

  it('throws when artifact is too short', () => {
    const d = '## Problem\n## Users\n## Success Criteria\n## Out of Scope\n';
    assert.throws(() => PHASE_DEFS['discovery'].validate(d), /too short/);
  });

  it('phaseDiscovery is accessible via PHASE_DEFS["discovery"]', () => {
    assert.equal(PHASE_DEFS['discovery'].num, 'discovery');
    assert.equal(PHASE_DEFS['discovery'].artifact, '00_DISCOVERY.md');
  });
});
