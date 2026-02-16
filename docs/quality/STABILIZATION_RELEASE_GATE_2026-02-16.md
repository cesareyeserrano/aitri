# Stabilization Release Gate - 2026-02-16

## Purpose
Single source of truth for closure status, ownership, target dates, and release gating decisions.

## Current Gate Status
- Critical Gate: CLOSED (2026-02-16)
- Feature Freeze: LIFTED for H-series remediation scope
- Next Review Date: 2026-02-24

## Critical Stabilization (Blocker)
| ID | Owner | Fecha objetivo | Estado | Evidencia requerida |
| --- | --- | --- | --- | --- |
| H-001 | Aitri Core Team (CLI Security) | 2026-02-19 | Verificado (2026-02-16) | Traversal negativo bloqueado + smoke regression |
| H-002 | Aitri Core Team (Validation) | 2026-02-20 | Verificado (2026-02-16) | `validate` falla sin discovery/plan + regression test |
| H-003 | Aitri Core Team (Runtime/Policy) | 2026-02-23 | Verificado (2026-02-16) | `go` bloquea en non-git (o override controlado) + regression test |

Critical Gate close condition:
- H-001, H-002, H-003 en estado Verificado.
- `npm run test:smoke` verde.
- `npm run demo:5min` verde.

## Non-Critical Stabilization
| ID | Owner | Fecha objetivo | Estado | Evidencia requerida |
| --- | --- | --- | --- | --- |
| H-004 | Aitri Core Team (Status/Handoff) | 2026-02-25 | Verificado (2026-02-16) | `status --feature` deterministico en multi-feature |
| H-005 | Aitri Core Team (Runtime) | 2026-02-27 | Verificado (2026-02-16) | `verify` hardened (timeout/control) + regression tests |
| H-006 | Aitri Core Team (Plan/Docs Consistency) | 2026-02-27 | Verificado (2026-02-16) | retrieval mode consistente en plan generado |

## Production Quality Hardening (Post-Stabilization)
| ID | Owner | Fecha objetivo | Estado | Dependencia |
| --- | --- | --- | --- | --- |
| Q-001 | Aitri Core Team (Architecture) | 2026-03-05 | Baseline entregada (2026-02-16) | Critical Gate CLOSED |
| Q-002 | Aitri Core Team (UX/Frontend Quality) | 2026-03-09 | Baseline entregada (2026-02-16) | Critical Gate CLOSED |
| Q-003 | Aitri Core Team (Product + Validation) | 2026-03-12 | Baseline entregada (2026-02-16) | Critical Gate CLOSED |
| Q-004 | Aitri Core Team (Runtime) | 2026-03-16 | Verificado (2026-02-16) | Critical Gate CLOSED |
| Q-005 | Aitri Core Team (Adoption) | 2026-03-20 | Diferido (2026-02-16) | Critical Gate CLOSED |

## CI Critical Findings Gate
- CI current state:
  - Smoke + file-growth checks are enforced.
  - Critical findings blocker (AC-33) is active in CI via `scripts/check-critical-gate.mjs`.
- Owner: Aitri Core Team (CI/Infra)
- Fecha objetivo: 2026-02-21
- Target behavior:
  - CI blocks when Critical Gate is OPEN and a PR attempts scope outside remediation work.
  - CI accepts remediation PRs that move gate evidence forward.
- Tracking backlog item:
  - `backlog/aitri-core/backlog.md` -> US-33 / AC-33.

## Decision Log
- 2026-02-16: Gate opened after E2E audit publication.
- 2026-02-16: Gate closed after implementing H-001..H-006 with regression coverage (`npm run test:smoke` 43/43, `npm run demo:5min` OK).
- 2026-02-16: AC-33 implemented in CI (`Critical findings gate` step enabled in workflow).
