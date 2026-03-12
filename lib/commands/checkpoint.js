/**
 * Module: Command — checkpoint
 * Purpose: Write a named state snapshot to checkpoints/<timestamp>[-<label>].md
 *          or list existing checkpoints. Thin wrapper on resume output logic.
 *          Checkpoints are plain markdown — human-readable, committable.
 */

import fs from 'fs';
import path from 'path';
import { loadConfig } from '../state.js';
import { cmdResume } from './resume.js';

export function cmdCheckpoint({ dir, args, flagValue, err }) {
  const config = loadConfig(dir);
  const projectName = config.projectName || path.basename(dir);

  // --list: print all checkpoints with dates
  if (args.includes('--list')) {
    const cpDir = path.join(dir, 'checkpoints');
    if (!fs.existsSync(cpDir)) {
      console.log('No checkpoints found.');
      return;
    }
    const files = fs.readdirSync(cpDir)
      .filter(f => f.endsWith('.md'))
      .sort()
      .reverse(); // newest first
    if (!files.length) {
      console.log('No checkpoints found.');
      return;
    }
    console.log(`\nCheckpoints for ${projectName}:\n`);
    for (const f of files) {
      const stat = fs.statSync(path.join(cpDir, f));
      const size = `${Math.ceil(stat.size / 1024)}KB`;
      console.log(`  ${f}  (${size})`);
    }
    console.log('');
    return;
  }

  // Capture resume output
  let content = '';
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk) => { content += chunk; return true; };
  try {
    cmdResume({ dir });
  } finally {
    process.stdout.write = orig;
  }

  // Build filename: YYYY-MM-DD[-label].md
  const date  = new Date().toISOString().slice(0, 10);
  const label = flagValue('--name');
  const slug  = label ? `-${label.replace(/[^a-zA-Z0-9_-]/g, '-')}` : '';
  const fname = `${date}${slug}.md`;

  const cpDir = path.join(dir, 'checkpoints');
  fs.mkdirSync(cpDir, { recursive: true });

  const dest = path.join(cpDir, fname);
  fs.writeFileSync(dest, content, 'utf8');

  process.stderr.write(`Checkpoint saved: checkpoints/${fname}\n`);
}
