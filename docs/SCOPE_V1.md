# Aitri: Scope Lock V1

## Product Goal
Deliver a stable, CLI-first, spec-driven SDLC workflow that can be executed by humans and AI agents under strict human supervision.

## In Scope (V1)
- Global terminal operation.
- Deterministic core commands:
  - `init`, `draft`, `approve`, `discover`, `plan`, `validate`, `status`.
- Enforced progression based on approved specs.
- Baseline traceability validation:
  - FR -> US
  - US -> TC
  - placeholder blocking (`FR-?`, `AC-?`, `US-?`).
- Standard artifact structure (discovery, plan, backlog, tests).
- Agent execution support via skills (Codex/Claude now, OpenCode path defined).
- Human approval gates before implementation and deployment assistance actions.

## Out of Scope (V1)
- Fully autonomous multi-agent orchestration.
- Dashboard/UI as the primary interface.
- Mandatory external integrations (Jira/Notion/Confluence/Slack).
- Opaque advanced semantic scoring of specs.
- Automatic production deployment without explicit human confirmation.

## Development/Deployment Clarification for V1
- Implementation and deployment assistance flows are documented.
- Full build/deploy automation is not required to close V1.
- Any real execution step still requires explicit human approval.

## Definition of Done (V1)
1. CLI runs end-to-end in a new repository and an existing repository.
2. `validate` fails with clear messages when artifacts are missing or traceability is incomplete.
3. `status` provides reliable next-step guidance.
4. `docs/` enables project continuity without depending on the original author.
5. Agent skills can execute the workflow without bypassing gates.

## Scope Guardrails
- Nothing enters V1 unless it strengthens discipline, traceability, or reliability.
- Any autonomy-increasing feature must include explicit human-control safeguards.
- Any scope change must update this document before implementation starts.
