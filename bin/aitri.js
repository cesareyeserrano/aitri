#!/usr/bin/env node

/**
 * Aitri CLI — Agent-agnostic SDLC orchestrator
 *
 * Design principles:
 *   - Stateless commands: each invocation reads/writes .aitri config file
 *   - run-phase outputs briefing to stdout — any agent reads and acts on it
 *   - No interactive prompts — fully scriptable
 *   - Compatible with: Claude Code, Codex, Gemini Code, Opencode, CI/CD
 *
 * This file is a thin dispatcher. All command logic lives in lib/commands/.
 * To add a command: create lib/commands/<name>.js and add a case below.
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { cmdInit }           from '../lib/commands/init.js';
import { cmdRunPhase }       from '../lib/commands/run-phase.js';
import { cmdComplete }       from '../lib/commands/complete.js';
import { cmdApprove }        from '../lib/commands/approve.js';
import { cmdReject }         from '../lib/commands/reject.js';
import { cmdVerify, cmdVerifyComplete } from '../lib/commands/verify.js';
import { cmdStatus }         from '../lib/commands/status.js';
import { cmdValidate }       from '../lib/commands/validate.js';
import { cmdHelp }           from '../lib/commands/help.js';

const VERSION   = '0.1.9';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.dirname(__dirname);
const cwd       = process.cwd();
const [,, cmd, ...args] = process.argv;

/**
 * Find the project directory by searching upward for .aitri (like git finds .git).
 * This makes all commands work correctly regardless of which subdirectory the
 * agent or user is in when they invoke aitri — critical for agent workflows
 * where the shell cwd may reset between command invocations.
 */
function findProjectDir(startDir) {
  let current = startDir;
  while (true) {
    if (fs.existsSync(path.join(current, '.aitri'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return startDir; // filesystem root — fall back to cwd
    current = parent;
  }
}

// init always uses cwd (creating a new project here)
// all other commands search upward for the .aitri file
const dir = cmd === 'init' ? cwd : findProjectDir(cwd);

const flagValue = (flag) => {
  const i = args.indexOf(flag);
  if (i === -1 || i + 1 >= args.length) return null;
  return args[i + 1];
};

const err = (msg) => {
  console.error(`❌ ${msg}`);
  process.exit(1);
};

const ctx = { dir, args, flagValue, err, VERSION, rootDir };

switch (cmd) {
  case 'init':             cmdInit(ctx);            break;
  case 'run-phase':        cmdRunPhase(ctx);        break;
  case 'complete':         cmdComplete(ctx);        break;
  case 'approve':          cmdApprove(ctx);         break;
  case 'reject':           cmdReject(ctx);          break;
  case 'verify':           cmdVerify(ctx);          break;
  case 'verify-complete':  cmdVerifyComplete(ctx);  break;
  case 'status':           cmdStatus(ctx);          break;
  case 'validate':         cmdValidate(ctx);        break;
  case '--version':        console.log(`Aitri v${VERSION}`); break;
  default:                 cmdHelp(ctx);            break;
}
