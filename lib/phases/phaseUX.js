/**
 * Module: Phase UX — UX/UI Specification
 * Purpose: UX/UI Designer persona. Defines screens, flows, component states and Nielsen compliance.
 * Artifact: 01_UX_SPEC.md
 * Optional: run before Phase 2. Phase 2 reads it if present.
 */

import { ROLE, CONSTRAINTS, REASONING } from '../personas/ux.js';

export default {
  num: 'ux',
  name: 'UX/UI Specification',
  persona: 'UX/UI Designer',
  artifact: '01_UX_SPEC.md',
  inputs: ['IDEA.md', '01_REQUIREMENTS.json'],

  extractContext: (content) => content,

  validate(content) {
    const required = ['## User Flows', '## Component Inventory', '## Nielsen Compliance'];
    const missing = required.filter(s => !content.includes(s));
    if (missing.length)
      throw new Error(`01_UX_SPEC.md missing required sections:\n  ${missing.join('\n  ')}`);
    if (content.split('\n').length < 30)
      throw new Error('01_UX_SPEC.md too short — min 30 lines expected for a complete UX spec');
  },

  buildBriefing({ dir, inputs, feedback }) {
    let reqs = {};
    try { reqs = JSON.parse(inputs['01_REQUIREMENTS.json']); } catch {}
    const personas = reqs.user_personas?.length
      ? reqs.user_personas.map(p => `  - ${p.role} (tech: ${p.tech_level}) — goal: ${p.goal}, pain: ${p.pain_point}`).join('\n')
      : `  - User personas not defined in requirements — infer from IDEA.md`;
    const uxFRs = (reqs.functional_requirements || [])
      .filter(fr => ['ux','visual','audio'].includes(fr.type?.toLowerCase()))
      .map(fr => `  - ${fr.id}: ${fr.title} — ${fr.acceptance_criteria?.join(', ')}`)
      .join('\n') || '  - No UX/visual/audio FRs found';

    return [
      `# Phase UX — UX/UI Specification`,
      `${ROLE}`,
      `\n## Constraints\n${CONSTRAINTS}`,
      `\n## How to reason\n${REASONING}`,
      ...(feedback ? [`\n## Feedback to apply\n${feedback}`] : []),
      `\n## User Personas (from Phase 1)\n${personas}`,
      `\n## UX/Visual/Audio Requirements\n${uxFRs}`,
      `\n## Full Requirements\n\`\`\`json\n${inputs['01_REQUIREMENTS.json']}\n\`\`\``,
      `\n## Output: \`${dir}/01_UX_SPEC.md\``,
      `Required sections (in order):`,
      `1. ## User Flows — per screen, per user persona. For each flow: entry point, steps, exit point, error path`,
      `2. ## Component Inventory — table per screen: component | states (default/loading/error/empty/disabled) | behavior | Nielsen heuristics applied`,
      `3. ## Nielsen Compliance — per screen: list each relevant heuristic, how the design satisfies it, and any trade-off made`,
      `\n## Rules`,
      `- Every UX/visual FR must have a corresponding screen or component in the spec`,
      `- Every component must define all 5 states — no state is optional`,
      `- Every error state must describe what the user sees AND what action they can take`,
      `- Mobile (375px) behavior must be explicit for every screen`,
      `\n## Instructions`,
      `1. Generate complete 01_UX_SPEC.md`,
      `2. Save to: ${dir}/01_UX_SPEC.md`,
      `3. Run: aitri complete ux`,
    ].join('\n');
  },
};
