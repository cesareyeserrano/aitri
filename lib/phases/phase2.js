/**
 * Module: Phase 2 — System Architecture
 * Purpose: Software Architect persona. Designs the complete system from requirements.
 * Artifact: 02_SYSTEM_DESIGN.md
 */

import { head } from './context.js';
import { ROLE, CONSTRAINTS, REASONING } from '../personas/architect.js';

export default {
  num: 2,
  name: 'System Architecture',
  persona: 'Software Architect',
  artifact: '02_SYSTEM_DESIGN.md',
  inputs: ['IDEA.md', '01_REQUIREMENTS.json'],
  optionalInputs: ['01_UX_SPEC.md'],

  extractContext: (content) => head(content, 160),

  validate(content) {
    const required = [
      'Executive Summary',
      'System Architecture',
      'Data Model',
      'API Design',
      'Security Design',
      'Performance & Scalability',
      'Deployment Architecture',
      'Risk Analysis',
    ];
    // Accept plain (## Name), integer (## 1. Name), and decimal (## 1.1 Name) headers
    const hasSection = name =>
      new RegExp(`^##\\s+(?:[\\d.]+\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm').test(content);
    const missing = required.filter(name => !hasSection(name)).map(name => `## ${name}`);
    if (missing.length)
      throw new Error(`02_SYSTEM_DESIGN.md missing required sections:\n  ${missing.join('\n  ')}`);
    if (content.split('\n').length < 40)
      throw new Error('02_SYSTEM_DESIGN.md too short — min 40 lines expected for a complete design');
  },

  buildBriefing({ dir, inputs, feedback }) {
    const uxSpec = inputs['01_UX_SPEC.md'];
    return [
      `# Phase 2 — System Architecture`,
      `${ROLE}`,
      `\n## Constraints\n${CONSTRAINTS}`,
      `\n## How to reason\n${REASONING}`,
      ...(feedback ? [`\n## Feedback to apply\n${feedback}`] : []),
      `\n## Requirements (01_REQUIREMENTS.json)\n\`\`\`json\n${inputs['01_REQUIREMENTS.json']}\n\`\`\``,
      ...(uxSpec ? [`\n## UX/UI Specification (01_UX_SPEC.md — read-only context)\n${uxSpec}`] : []),
      `\n## Output: \`${dir}/02_SYSTEM_DESIGN.md\``,
      `Required sections (in order):`,
      `1. Executive Summary — tech choices with justification`,
      `2. System Architecture — ASCII/Mermaid diagram + components`,
      `3. Data Model — ER diagram + schema with indexes`,
      `4. API Design — all endpoints (method, path, auth, request/response, errors)`,
      `5. Security Design — auth, encryption, input validation`,
      `6. Performance & Scalability — caching, query optimization, scaling`,
      `7. Deployment Architecture — environments, containers, CI/CD`,
      `8. Risk Analysis — top 3-5 risks + mitigation`,
      `\n## Architectural Decision Records (ADRs)`,
      `For every significant tech choice, write an ADR using this format:`,
      ``,
      `  ADR-XX: <title>`,
      `  Context: <why this decision is needed>`,
      `  Option A: <name> — <tradeoffs>`,
      `  Option B: <name> — <tradeoffs>`,
      `  Decision: <chosen option> — <reason>`,
      `  Consequences: <what this enables, what it constrains>`,
      ``,
      `Minimum ADRs required: database choice, frontend framework/approach, state management, deployment target.`,
      `Rule: each ADR must evaluate ≥2 options. An ADR with a single option is rejected.`,
      `\n## Failure Blast Radius`,
      `For each critical component (database, auth layer, external APIs, background jobs), document:`,
      `  - What breaks if this component fails`,
      `  - What the user sees (error message, blank screen, stale data, etc.)`,
      `  - Recovery path (retry, fallback, manual intervention)`,
      ``,
      `Format:`,
      `  Component: <name>`,
      `  Blast radius: <what stops working>`,
      `  User impact: <what user experiences>`,
      `  Recovery: <how system recovers>`,
      `\n## Traceability Checklist`,
      `Before completing this phase, verify:`,
      `  [ ] Every FR-* in requirements is addressed by at least one component`,
      `  [ ] Every NFR-* has a corresponding design decision (caching, rate limiting, TLS, etc.)`,
      `  [ ] Every ADR has ≥2 options`,
      `  [ ] no_go_zone items from Phase 1 are not present in the architecture`,
      `  [ ] Failure blast radius documented for ≥2 critical components`,
      `\n## Rules`,
      `- Every FR-* and NFR-* must be addressed`,
      `- All tech choices must be justified with specific versions`,
      `- Honor the no_go_zone from 01_REQUIREMENTS.json — do not introduce components that were declared out of scope`,
      `\n## Instructions`,
      `1. Write ADRs for all major tech decisions (≥2 options each)`,
      `2. Document failure blast radius for critical components`,
      `3. Verify traceability checklist before saving`,
      `4. Generate complete 02_SYSTEM_DESIGN.md`,
      `5. Save to: ${dir}/02_SYSTEM_DESIGN.md`,
      `6. Run: aitri complete 2`,
      `\n## Human Review — Before approving phase 2`,
      `  [ ] All 5 required sections are present and substantive (not one-liners or placeholders)`,
      `  [ ] Tech stack is compatible with constraints and technology_preferences from requirements`,
      `  [ ] Every significant decision has an ADR with ≥2 options evaluated`,
      `  [ ] Data model covers all persistence FRs`,
      `  [ ] API design covers all integration and logic FRs`,
      `  [ ] no_go_zone items from Phase 1 are NOT introduced in the architecture`,
      `  [ ] Failure blast radius documented for at least 2 critical components`,
    ].join('\n');
  },
};
