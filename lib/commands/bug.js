/**
 * Module: Command — bug
 * Purpose: Formal bug lifecycle with FR traceability.
 *          Owns spec/BUGS.json read/write — does NOT go through state.js.
 *
 * Lifecycle: open → in_progress → fixed → verified → closed
 *   verified is auto-set by verify-run when the linked TC passes.
 *
 * Pipeline integration:
 *   verify-run:      auto-transitions fixed → verified when linked TC passes
 *   verify-complete: blocks if any open bug is linked to a MUST FR
 *   validate:        warns on fixed bugs with no tc_reference
 *   status:          shows count of open + in_progress bugs
 */

import fs from 'fs';
import path from 'path';
import { loadConfig, readArtifact } from '../state.js';

const BUGS_FILE = 'BUGS.json';

// ── Internal helpers ──────────────────────────────────────────────────────────

function bugsFilePath(dir, config) {
  const artifactsDir = config.artifactsDir || '';
  return artifactsDir
    ? path.join(dir, artifactsDir, BUGS_FILE)
    : path.join(dir, BUGS_FILE);
}

function loadBugsFile(filePath) {
  if (!fs.existsSync(filePath)) return { bugs: [] };
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return { bugs: [] }; }
}

function saveBugsFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function nextId(bugs) {
  const nums = (bugs || []).map(b => {
    const m = b.id?.match(/^BG-(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  return `BG-${String((nums.length > 0 ? Math.max(...nums) : 0) + 1).padStart(3, '0')}`;
}

function flagVal(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
}

// ── Exported helpers (used by verify.js, validate.js, status.js) ──────────────

/**
 * Count of open + in_progress bugs. Returns null if BUGS.json doesn't exist.
 */
export function openBugCount(dir, config) {
  const p = bugsFilePath(dir, config);
  if (!fs.existsSync(p)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (data.bugs || []).filter(b => b.status === 'open' || b.status === 'in_progress').length;
  } catch { return null; }
}

/**
 * Auto-transition fixed → verified when the linked TC passed in verify-run.
 * Called at end of cmdVerifyRun after writing 04_TEST_RESULTS.json.
 * @param {string} dir
 * @param {object} config
 * @param {Array<{tc_id: string, status: string}>} results - parsed TC results
 */
export function autoVerifyBugs(dir, config, results) {
  const p = bugsFilePath(dir, config);
  if (!fs.existsSync(p)) return;
  try {
    const data = loadBugsFile(p);
    let changed = false;
    for (const bug of (data.bugs || [])) {
      if (bug.status !== 'fixed' || !bug.tc_reference) continue;
      const result = results.find(r => r.tc_id === bug.tc_reference);
      if (result && result.status === 'pass') {
        bug.status = 'verified';
        bug.updated_at = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) saveBugsFile(p, data);
  } catch { /* non-fatal — bug state is not pipeline-critical */ }
}

/**
 * Return bugs that block verify-complete: open bugs linked to MUST FRs.
 * @returns {Array} blocking bugs (may be empty)
 */
export function getBlockingBugs(dir, config) {
  const p = bugsFilePath(dir, config);
  if (!fs.existsSync(p)) return [];
  try {
    const data = loadBugsFile(p);
    const openLinked = (data.bugs || []).filter(b => b.status === 'open' && b.fr);
    if (openLinked.length === 0) return [];
    const reqRaw = readArtifact(dir, '01_REQUIREMENTS.json', config.artifactsDir || '');
    if (!reqRaw) return openLinked; // can't determine priority → block conservatively
    const reqs = JSON.parse(reqRaw);
    const mustIds = new Set(
      (reqs.functional_requirements || []).filter(fr => fr.priority === 'MUST').map(fr => fr.id)
    );
    return openLinked.filter(b => mustIds.has(b.fr));
  } catch { return []; }
}

/**
 * Return fixed bugs with no tc_reference (for validate warnings).
 */
export function fixedBugsWithoutTC(dir, config) {
  const p = bugsFilePath(dir, config);
  if (!fs.existsSync(p)) return [];
  try {
    const data = loadBugsFile(p);
    return (data.bugs || []).filter(b => b.status === 'fixed' && !b.tc_reference);
  } catch { return []; }
}

// ── Command ───────────────────────────────────────────────────────────────────

export function cmdBug({ dir, args = [], err }) {
  const sub = args[0];
  const config = loadConfig(dir);
  const fp = bugsFilePath(dir, config);

  if (!sub || sub === 'help') {
    console.log([
      'Usage: aitri bug <subcommand>',
      '',
      'Subcommands:',
      '  add     --title "..." [--fr FR-XXX] [--severity critical|high|medium|low] [--phase N]',
      '  list    [--status open|in_progress|fixed|verified|closed] [--fr FR-XXX] [--severity ...]',
      '  fix     <BG-NNN>',
      '  verify  <BG-NNN> --tc TC-NNN',
      '  close   <BG-NNN>',
    ].join('\n'));
    return;
  }

  // ── add ────────────────────────────────────────────────────────────────────
  if (sub === 'add') {
    const title = flagVal(args, '--title');
    if (!title) err('--title is required\n  Usage: aitri bug add --title "description" [--fr FR-XXX] [--severity medium] [--phase N]');

    const fr           = flagVal(args, '--fr');
    const severity     = flagVal(args, '--severity') || 'medium';
    const phaseRaw     = flagVal(args, '--phase');
    const phaseNum     = phaseRaw ? parseInt(phaseRaw, 10) : null;
    const validSev     = ['critical', 'high', 'medium', 'low'];
    if (!validSev.includes(severity)) err(`--severity must be one of: ${validSev.join(', ')}`);

    const data = loadBugsFile(fp);
    const id   = nextId(data.bugs);
    const now  = new Date().toISOString();

    data.bugs.push({
      id,
      title,
      description:    '',
      severity,
      status:         'open',
      fr:             fr || null,
      phase_detected: phaseNum,
      tc_reference:   null,
      created_at:     now,
      updated_at:     now,
      resolution:     null,
    });

    saveBugsFile(fp, data);
    console.log(`✅ ${id} created — status: open`);
    if (!fr) console.log(`  ⚠  No FR linked — use --fr FR-XXX to link to a requirement`);
    return;
  }

  // ── list ───────────────────────────────────────────────────────────────────
  if (sub === 'list') {
    const data        = loadBugsFile(fp);
    const statusFilter   = flagVal(args, '--status');
    const frFilter    = flagVal(args, '--fr');
    const sevFilter   = flagVal(args, '--severity');

    let bugs = data.bugs || [];
    if (statusFilter) bugs = bugs.filter(b => b.status === statusFilter);
    else              bugs = bugs.filter(b => b.status === 'open' || b.status === 'in_progress');
    if (frFilter)     bugs = bugs.filter(b => b.fr === frFilter);
    if (sevFilter)    bugs = bugs.filter(b => b.severity === sevFilter);

    if (bugs.length === 0) { console.log('No bugs match the filter.'); return; }

    for (const b of bugs) {
      const fr  = b.fr ? ` (${b.fr})` : '';
      const tc  = b.tc_reference ? ` → ${b.tc_reference}` : '';
      console.log(`  ${b.id}  [${b.severity.padEnd(8)}]  [${b.status.padEnd(11)}]  ${b.title}${fr}${tc}`);
    }
    return;
  }

  // ── fix ────────────────────────────────────────────────────────────────────
  if (sub === 'fix') {
    const id   = args[1];
    if (!id) err('Usage: aitri bug fix <BG-NNN>');
    const data = loadBugsFile(fp);
    const bug  = (data.bugs || []).find(b => b.id === id);
    if (!bug) err(`Bug ${id} not found`);
    bug.status     = 'in_progress';
    bug.updated_at = new Date().toISOString();
    saveBugsFile(fp, data);
    console.log(`🔧 ${id} → in_progress`);
    if (bug.fr) {
      // Print FR context to help the implementer
      try {
        const reqRaw = readArtifact(dir, '01_REQUIREMENTS.json', config.artifactsDir || '');
        if (reqRaw) {
          const reqs = JSON.parse(reqRaw);
          const fr = (reqs.functional_requirements || []).find(f => f.id === bug.fr);
          if (fr) console.log(`   FR: ${fr.id} — ${fr.title}`);
        }
      } catch { /* non-fatal */ }
    }
    return;
  }

  // ── verify ─────────────────────────────────────────────────────────────────
  if (sub === 'verify') {
    const id = args[1];
    const tc = flagVal(args, '--tc');
    if (!id) err('Usage: aitri bug verify <BG-NNN> --tc TC-NNN');
    if (!tc) err('--tc is required\n  Use: aitri bug verify ' + (id || '<BG-NNN>') + ' --tc TC-NNN\n  To close without a TC (not recommended): aitri bug close ' + (id || '<BG-NNN>'));
    const data = loadBugsFile(fp);
    const bug  = (data.bugs || []).find(b => b.id === id);
    if (!bug) err(`Bug ${id} not found`);
    bug.status       = 'fixed';
    bug.tc_reference = tc;
    bug.updated_at   = new Date().toISOString();
    saveBugsFile(fp, data);
    console.log(`✅ ${id} → fixed  (TC: ${tc})`);
    console.log(`   Run verify-run — if ${tc} passes, ${id} will auto-transition to verified.`);
    return;
  }

  // ── close ──────────────────────────────────────────────────────────────────
  if (sub === 'close') {
    const id   = args[1];
    if (!id) err('Usage: aitri bug close <BG-NNN>');
    const data = loadBugsFile(fp);
    const bug  = (data.bugs || []).find(b => b.id === id);
    if (!bug) err(`Bug ${id} not found`);
    if (!bug.tc_reference) {
      process.stderr.write(`  ⚠  Closing ${id} without a TC reference — no test covers this fix.\n`);
      process.stderr.write(`     validate will warn on this bug until a TC is linked.\n`);
    }
    bug.status     = 'closed';
    bug.updated_at = new Date().toISOString();
    saveBugsFile(fp, data);
    console.log(`🔒 ${id} → closed`);
    return;
  }

  err(`Unknown subcommand: ${sub}\nRun: aitri bug help`);
}
