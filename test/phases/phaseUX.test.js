import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE_DEFS } from '../../lib/phases/index.js';

const validUX = () => `# UX/UI Specification

## User Flows

### Screen: Login
- Entry: user opens app
- Steps: enter email → enter password → tap Login
- Exit: redirected to Dashboard
- Error path: invalid credentials → inline error message with retry option

### Screen: Dashboard
- Entry: successful login
- Steps: view metrics → navigate to detail
- Exit: logout or navigate to settings
- Error path: data load failure → skeleton with retry button

## Component Inventory

| Component | Default | Loading | Error | Empty | Disabled |
|-----------|---------|---------|-------|-------|----------|
| LoginButton | Active label | Spinner | N/A | N/A | Opacity 0.5, no click |
| MetricsCard | Shows data | Skeleton pulse | Error message + retry | "No data yet" | N/A |
| NavBar | All items active | N/A | N/A | N/A | Item grayed if unauthorized |

## Nielsen Compliance

### Login Screen
- H1 Visibility: submit button shows loading spinner during authentication (≤1s feedback)
- H5 Error prevention: email format validated before submission
- H9 Error recovery: error message states "Invalid email or password" with "Try again" action
- H8 Minimalist design: only email, password, and login button visible on first render

### Dashboard Screen
- H1 Visibility: data cards show loading skeleton while fetching
- H6 Recognition: metric labels always visible, no tooltip-only labels
- H3 User control: logout accessible from nav, no hidden paths
`;

describe('Phase UX — validate()', () => {

  it('passes with valid artifact', () => {
    assert.doesNotThrow(() => PHASE_DEFS['ux'].validate(validUX()));
  });

  it('throws when ## User Flows section is missing', () => {
    const d = validUX().replace('## User Flows', '## Screens');
    assert.throws(() => PHASE_DEFS['ux'].validate(d), /User Flows/);
  });

  it('throws when ## Component Inventory section is missing', () => {
    const d = validUX().replace('## Component Inventory', '## Components');
    assert.throws(() => PHASE_DEFS['ux'].validate(d), /Component Inventory/);
  });

  it('throws when ## Nielsen Compliance section is missing', () => {
    const d = validUX().replace('## Nielsen Compliance', '## Heuristics');
    assert.throws(() => PHASE_DEFS['ux'].validate(d), /Nielsen Compliance/);
  });

  it('throws when artifact is too short', () => {
    const d = '## User Flows\n## Component Inventory\n## Nielsen Compliance\n';
    assert.throws(() => PHASE_DEFS['ux'].validate(d), /too short/);
  });

  it('phaseUX is accessible via PHASE_DEFS["ux"]', () => {
    assert.equal(PHASE_DEFS['ux'].num, 'ux');
    assert.equal(PHASE_DEFS['ux'].artifact, '01_UX_SPEC.md');
  });
});
