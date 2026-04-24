/**
 * Module: lib/upgrade/diagnose.js — DIAGNOSE composer
 *
 * Walks registered per-version migration modules and composes their findings
 * into the five-category catalog defined by ADR-027.
 *
 * Registering a new module:
 *   1. Add file under lib/upgrade/migrations/from-<version>.js.
 *   2. Module exports { FROM_VERSION, diagnose, migrate }.
 *   3. Import and push into MODULES below.
 *
 * Order inside MODULES is the migration order (oldest first). For now only one
 * module exists; when the list grows, walking from config.aitriVersion →
 * CLI VERSION will filter which modules apply.
 */

import * as from065 from './migrations/from-0.1.65.js';

const MODULES = [from065];

/**
 * Catalog every drift finding across all modules, grouped by category.
 *
 * @param {string} dir
 * @param {object} config
 * @returns {{ blocking: object[], stateMissing: object[], validatorGap: object[], capabilityNew: object[], structure: object[] }}
 */
export function diagnose(dir, config) {
  const catalog = {
    blocking:      [],
    stateMissing:  [],
    validatorGap:  [],
    capabilityNew: [],
    structure:     [],
  };
  for (const mod of MODULES) {
    const findings = mod.diagnose(dir, config) || [];
    for (const f of findings) {
      const bucket = catalog[f.category];
      if (bucket) bucket.push({ ...f, module: mod.FROM_VERSION });
    }
  }
  return catalog;
}

/**
 * Apply auto-migratable findings across all modules. Pure orchestration —
 * each module is responsible for its own reads, writes, and event logging.
 *
 * @param {string} dir
 * @param {object} config        Mutated in place via appendEvent; caller persists with saveConfig.
 * @param {string} targetVersion Current CLI VERSION.
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false] If true, derive preview findings from
 *   each module's `diagnose()` and return them as migrated/flagged without
 *   invoking `apply()`, writing artifacts, or appending events.
 * @returns {{ migrated: object[], flagged: object[] }}
 */
export function migrateAll(dir, config, targetVersion, { dryRun = false } = {}) {
  const migrated = [];
  const flagged  = [];
  for (const mod of MODULES) {
    if (dryRun) {
      const findings = mod.diagnose(dir, config) || [];
      for (const f of findings) {
        if (f.autoMigratable) migrated.push({ ...f, module: mod.FROM_VERSION });
        else                  flagged.push({ ...f,  module: mod.FROM_VERSION });
      }
      continue;
    }
    const result = mod.migrate(dir, config, targetVersion);
    for (const f of result.migrated) migrated.push({ ...f, module: mod.FROM_VERSION });
    for (const f of result.flagged)  flagged.push({ ...f,  module: mod.FROM_VERSION });
  }
  return { migrated, flagged };
}
