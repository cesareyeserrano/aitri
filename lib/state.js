/**
 * Module: Aitri State Manager
 * Purpose: Load/save .aitri config and read project artifacts.
 *          Shared by CLI and MCP server.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CONFIG_FILE = '.aitri';

const DEFAULTS = { currentPhase: 0, approvedPhases: [], completedPhases: [] };

export function hashArtifact(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export function loadConfig(dir) {
  const p = path.join(dir, CONFIG_FILE);
  if (!fs.existsSync(p)) return { ...DEFAULTS };

  let raw;
  try {
    // Strip BOM if present (added by some text editors)
    raw = JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch {
    process.stderr.write(`[aitri] Warning: .aitri config is malformed — backing up to .aitri.bak and resetting.\n`);
    try { fs.copyFileSync(p, p + '.bak'); } catch {}
    return { ...DEFAULTS };
  }

  // Merge defaults so missing fields never cause undefined errors (backward compat)
  return { ...DEFAULTS, ...raw };
}

export function saveConfig(dir, config) {
  const dest    = path.join(dir, CONFIG_FILE);
  const content = JSON.stringify({ ...config, updatedAt: new Date().toISOString() }, null, 2);

  // Atomic write: temp file in same directory ensures same filesystem (avoids EXDEV on tmpfs)
  const tmp = path.join(dir, `.aitri-${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, content);
    fs.renameSync(tmp, dest);
  } finally {
    // Clean up temp file if rename failed
    try { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); } catch {}
  }
}

/**
 * Resolve the path to an Aitri pipeline artifact.
 * Respects config.artifactsDir ('spec' for new projects, '' for old projects).
 */
export function artifactPath(dir, config, name) {
  const d = config?.artifactsDir || '';
  return d ? path.join(dir, d, name) : path.join(dir, name);
}

export function readArtifact(dir, filename, artifactsDir = '') {
  const p = artifactsDir ? path.join(dir, artifactsDir, filename) : path.join(dir, filename);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
}
