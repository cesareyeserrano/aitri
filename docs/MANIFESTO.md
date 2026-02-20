# Aitri Manifesto

## The Problem

AI agents write code fast. They also hallucinate requirements, skip tests, overwrite their own work, and lose context between sessions. The result is software that works once, in one context, and breaks everywhere else.

The problem is not that AI agents are incapable. The problem is that they have no contract to enforce discipline on themselves.

## What Aitri Is

Aitri is a **process contract enforcer** for AI-assisted software delivery.

It is a CLI tool that stands between an AI agent and the filesystem. Before the agent can write a backlog, Aitri checks there is an approved spec. Before the agent can scaffold tests, Aitri checks the backlog traces to the spec. Before delivery, Aitri checks that every Functional Requirement has a passing test.

The agent does the work. Aitri verifies the contract was followed.

## What Aitri Guarantees

When a feature passes all Aitri gates:

1. A human reviewed and approved the specification.
2. Every user story traces to a Functional Requirement in that spec.
3. Every test case traces to a user story and a Functional Requirement.
4. Every test passed at delivery time.
5. The source of requirements was explicit human input — not AI inference.

These are structural guarantees, not quality guarantees. Aitri cannot tell you if the spec is correct. It can tell you that the implementation follows whatever spec was approved.

## What Aitri Does Not Guarantee

- That the spec itself is correct or complete.
- That agent-generated content (backlog, tests) is semantically meaningful — only structurally valid.
- That tests cover all edge cases.
- That the delivered software works in production.

These gaps are intentional. Aitri fills the structural discipline gap. Human judgment fills the rest.

## The Design Choices

**Markdown-first.** All artifacts are plain text files. No database, no server, no account. Every artifact is readable, diffable, and committable.

**CLI-first.** Aitri runs in any terminal. It integrates with any agent that can execute shell commands. No SDK required.

**No external dependencies.** The CLI uses only Node.js built-ins. This keeps it installable anywhere and eliminates supply chain exposure.

**Explicit gates.** Every write operation shows a plan and asks for confirmation. Automation requires an explicit `--yes`. Nothing is silent.

**Idempotent by design.** Running any Aitri command twice must not corrupt state. This is not a convenience — it is a correctness requirement.

**Human approval is non-negotiable.** The spec gate (`aitri approve`) and the delivery gate (`aitri go`) require human confirmation. These cannot be bypassed by flags.

## The Audience

**For AI agents:** Aitri is your system of record. Before you write code, check for an approved spec. Before you write a backlog, validate traces. Use `aitri resume json` to orient at session start. Use `aitri checkpoint` before ending a session.

**For human developers:** Aitri is a process enforcer, not a process inventor. You define the intent. Aitri structures, validates, and certifies that the work follows what you approved.

**For teams adopting AI-assisted development:** Aitri makes the agent's work auditable. Every artifact traces back to a human decision. Every delivery has evidence.

## The Scope Boundary

Aitri is a delivery discipline tool. It is not:
- A code generator (it generates briefs and stubs, not implementation)
- A project management tool
- A CI/CD system (though it integrates with one via `aitri ci`)
- A replacement for code review

The moment Aitri tries to do everything, it does nothing well.

## On Brownfield Projects

`aitri adopt` brings existing projects under Aitri's contract without modifying their source. Phase 1 scans the project structure. Phase 2 uses an LLM to infer DRAFT specs from README and code. Phase 3 maps existing tests to TC-* stubs.

The output is always DRAFT. A human must review and approve each spec before Aitri enforces anything. The LLM inference is a starting point, not a conclusion.

## The Honest Limitation

Aitri enforces structure. Structure does not equal quality.

A spec can be approved with weak requirements. A backlog can have correct traces to a weak spec. Tests can pass against an implementation that misses the real user need. Aitri will report all gates passing. None of that is Aitri's failure — it is the nature of structural enforcement.

The discipline Aitri provides is necessary but not sufficient. It is one layer of a responsible AI-assisted development process, not the whole process.
