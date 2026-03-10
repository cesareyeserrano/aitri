# Project Specification Template

## Overview
[Describe your project in 2-3 sentences. What problem does it solve? Who is the user?]

## Functional Requirements

FR-001: [Requirement Title]
- [Detail about what the system must do]
- [Another detail]
- Acceptance: [How to test/verify this requirement]

FR-002: [Requirement Title]
- [Detail]
- Acceptance: [How to test]

FR-003: [Requirement Title]
- [Detail]
- Acceptance: [How to test]

FR-004: [Requirement Title]
- [Detail]
- Acceptance: [How to test]

FR-005: [Requirement Title]
- [Detail]
- Acceptance: [How to test]

[Add more FR-* as needed — minimum 5 for a real project]

## Non-Functional Requirements

NFR-001: Performance
- [e.g., API must respond in < 200ms for 95% of requests]
- Acceptance: [Load test with k6 showing p95 < 200ms]

NFR-002: Security
- [e.g., All endpoints must require authentication]
- Acceptance: [Unauthenticated requests return 401]

NFR-003: Reliability
- [e.g., System uptime must be ≥ 99.5%]
- Acceptance: [Monitoring dashboard showing uptime]

[Add more NFR-* as needed — minimum 3]

## Critical Constraints

<!-- Optional but highly recommended. Explicit constraints reduce scope ambiguity across all agents.
     Without this section, agents may infer a backend, authentication, or database you didn't want.
     Examples of useful constraints: -->

- NO backend — frontend-only, no server process
- NO authentication — no login, no sessions, no user accounts
- MUST use localStorage — never a database
- NO third-party API calls at runtime
- First delivery must run with a single command (e.g., npm run dev)

<!-- Remove examples and replace with your actual constraints, or delete this section if none apply. -->

## Constraints

- Timeline: [e.g., 4 weeks]
- Budget: [e.g., $0 / open source]
- Team size: [e.g., 1 developer]
- Technology preferences: [e.g., Node.js, PostgreSQL, Docker]

## Technology Stack

- Language: [Python / JavaScript / TypeScript / Go / etc.]
- Framework: [FastAPI / Express / Next.js / etc.]
- Database: [PostgreSQL / MongoDB / SQLite / etc.]
- Deployment: [Docker / Railway / Fly.io / AWS / etc.]
