/**
 * Module: Phase Discovery — Problem Definition
 * Purpose: Discovery Facilitator persona. Defines problem, users, success criteria, and out-of-scope.
 * Artifact: 00_DISCOVERY.md
 * Optional: run before Phase 1. Phase 1 reads it if present.
 */

import { ROLE, CONSTRAINTS, REASONING } from '../personas/discovery.js';

export default {
  num: 'discovery',
  name: 'Problem Definition',
  persona: 'Discovery Facilitator',
  artifact: '00_DISCOVERY.md',
  inputs: ['IDEA.md'],

  extractContext: (content) => content,

  validate(content) {
    const required = ['## Problem', '## Users', '## Success Criteria', '## Out of Scope'];
    const missing = required.filter(s => !content.includes(s));
    if (missing.length)
      throw new Error(`00_DISCOVERY.md missing required sections:\n  ${missing.join('\n  ')}`);
    if (content.split('\n').length < 20)
      throw new Error('00_DISCOVERY.md too short — min 20 lines expected for a complete discovery');
  },

  buildBriefing({ dir, inputs, feedback }) {
    const idea = inputs['IDEA.md'];
    const wordCount = idea.trim().split(/\s+/).length;

    return [
      `# Phase Discovery — Problem Definition`,
      `${ROLE}`,
      `\n## Constraints\n${CONSTRAINTS}`,
      `\n## How to reason\n${REASONING}`,
      ...(feedback ? [`\n## Feedback to apply\n${feedback}`] : []),
      `\n## Source Idea (${wordCount} words)\n${idea}`,
      `\n## Output: \`${dir}/00_DISCOVERY.md\``,
      `Required sections (in order):`,
      `1. ## Problem — what situation forces users to act? What pain do they experience today?`,
      `2. ## Users — who are the actual people using this? Describe each type with their context and goal.`,
      `3. ## Success Criteria — what does success look like? Use observable, falsifiable metrics (not "it works").`,
      `4. ## Out of Scope — what will this explicitly NOT do? List at least 3 boundaries.`,
      `\n## Rules`,
      `- Do not mention technologies, architectures, or implementation details`,
      `- Every success criterion must be measurable — "users can do X in under Y seconds" not "feels fast"`,
      `- Out of scope items must be specific — "no admin panel" not "no extra features"`,
      `\n## Instructions`,
      `1. Generate complete 00_DISCOVERY.md`,
      `2. Save to: ${dir}/00_DISCOVERY.md`,
      `3. Run: aitri complete discovery`,
    ].join('\n');
  },
};
