/**
 * Test: lib/scope.js — commandPrefix helper
 *
 * Why: This is the single source of truth for the `feature <name> ` infix in
 * every command Aitri prints. A bug here would silently revert the alpha.6
 * destructive-risk fix back to the alpha.5 behavior. Pure-function tests are
 * the floor; integration tests in approve/complete/reject/verify exercise the
 * end-to-end path.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { commandPrefix, scopeNameFromDir } from '../lib/scope.js';

describe('commandPrefix()', () => {
  it('returns empty string when featureRoot is missing (root context)', () => {
    assert.equal(commandPrefix(null,      'foo'), '');
    assert.equal(commandPrefix(undefined, 'foo'), '');
    assert.equal(commandPrefix('',        'foo'), '');
  });

  it('returns empty string when scopeName is missing (defensive)', () => {
    assert.equal(commandPrefix('/parent', null),      '');
    assert.equal(commandPrefix('/parent', undefined), '');
    assert.equal(commandPrefix('/parent', ''),        '');
  });

  it('returns `feature <name> ` (with trailing space) for feature context', () => {
    assert.equal(commandPrefix('/parent', 'network-monitoring'), 'feature network-monitoring ');
  });

  it('preserves scopeName verbatim — no escaping, no munging', () => {
    // Whatever feature.js was given as `name` is what shows up. If a user
    // calls a feature `My Feature`, that lands in the prefix as-is. The
    // command surface is what it is — Aitri does not pre-quote arguments.
    assert.equal(commandPrefix('/p', 'My Feature'), 'feature My Feature ');
  });
});

describe('scopeNameFromDir()', () => {
  it('returns the basename of the path', () => {
    assert.equal(scopeNameFromDir('/parent/features/foo'), 'foo');
    assert.equal(scopeNameFromDir('foo'),                  'foo');
  });
});
