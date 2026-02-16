# Auditoria E2E Aitri - 2026-02-16

## Estado de esta auditoria
- Fecha de auditoria: 2026-02-16
- Tipo: E2E (lectura + ejecucion de pruebas y demo)
- Alcance: CLI, runtime gates, policy, status, validacion, smoke suite, CI basico
- Restriccion operativa acordada: no introducir features nuevas hasta cerrar hallazgos criticos
- Cambios de codigo: ninguno
- Addendum de cierre: 2026-02-16 (remediacion H-001..H-006 implementada y verificada)
- Cambios de codigo (addendum): aplicados en CLI/runtime/status/validate + regresiones smoke.

## Resumen ejecutivo
- Salud funcional actual: alta (smoke suite y demo E2E en verde).
- Salud de control operativo: media-baja (existen brechas de seguridad/gobernanza en rutas criticas).
- Decision recomendada: congelar nuevas features y priorizar remediacion de P0/P1.

## Evidencia ejecutada
- `npm run test:smoke` -> 35/35 passing.
- `npm run check:file-growth` -> OK.
- `npm run check:file-growth:strict` -> OK.
- `npm run demo:5min` -> OK (flujo completo `draft -> approve -> discover -> plan -> validate -> verify -> policy -> handoff`).
- Post-remediacion (addendum 2026-02-16):
  - `npm run test:smoke` -> 43/43 passing.
  - `npm run demo:5min` -> OK.

## Matriz de hallazgos (Impacto, Severidad, Valor, Riesgo)

| ID | Hallazgo | Impacto | Severidad | Valor | Riesgo | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| H-001 | Path traversal por `--feature` permite escritura fuera del proyecto | Alto | P0 | Alto | Alto | Verificado (2026-02-16) |
| H-002 | `validate` puede pasar sin `discovery` ni `plan` | Alto | P1 | Alto | Alto | Verificado (2026-02-16) |
| H-003 | `go` permite GO fuera de git aunque policy no valida drift real | Alto | P1 | Alto | Medio-Alto | Verificado (2026-02-16) |
| H-004 | `status` ignora `--feature` y toma contexto implicito en multi-feature | Medio-Alto | P2 | Alto | Medio | Verificado (2026-02-16) |
| H-005 | `verify` ejecuta comando con `shell: true` sin timeout/contencion | Medio-Alto | P2 | Medio-Alto | Medio-Alto | Verificado (2026-02-16) |
| H-006 | Inconsistencia documental en `plan` para retrieval mode | Medio | P3 | Medio | Bajo | Verificado (2026-02-16) |

## Ownership y fechas objetivo (H-series)

| ID | Owner | Fecha objetivo | Estado |
| --- | --- | --- | --- |
| H-001 | Aitri Core Team (CLI Security) | 2026-02-19 | Verificado (2026-02-16) |
| H-002 | Aitri Core Team (Validation) | 2026-02-20 | Verificado (2026-02-16) |
| H-003 | Aitri Core Team (Runtime/Policy) | 2026-02-23 | Verificado (2026-02-16) |
| H-004 | Aitri Core Team (Status/Handoff) | 2026-02-25 | Verificado (2026-02-16) |
| H-005 | Aitri Core Team (Runtime) | 2026-02-27 | Verificado (2026-02-16) |
| H-006 | Aitri Core Team (Plan/Docs Consistency) | 2026-02-27 | Verificado (2026-02-16) |

Tracking source:
- `docs/quality/STABILIZATION_RELEASE_GATE_2026-02-16.md`

## Detalle de hallazgos

### H-001 - Path traversal por `--feature`
- Impacto: Alto
- Severidad: P0
- Valor: Alto
- Riesgo: Alto
- Evidencia:
  - `draft --feature "../../../../tmp/aitri-escape-poc"` escribio archivo fuera del workspace (`/tmp/aitri-escape-poc.md`).
  - `verify --feature "../../../../tmp/verify-escape-poc"` escribio evidencia fuera del workspace (`/tmp/verify-escape-poc.json`).
  - `policy --feature "../../../../tmp/policy-escape-poc"` escribio evidencia fuera del workspace (`/tmp/policy-escape-poc.json`).
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:138`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:505`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:533`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime-flow.js:62`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime.js:368`
- Criterio de verificacion posterior:
  - Rechazar `--feature` con `/`, `..`, espacios no normalizados y caracteres no permitidos.
  - Confirmar que toda escritura queda contenida en rutas del proyecto.
  - Agregar smoke tests negativos para traversal en `draft`, `verify`, `policy`.

### H-002 - `validate` pasa sin discovery/plan
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Alto
- Evidencia:
  - En un workspace minimo con solo `specs/approved`, `backlog` y `tests`, `validate --json` devolvio `ok: true`.
  - Esto contradice el contrato de guardrails sobre enforcement de persona gates.
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/discovery-plan-validate.js:624`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/discovery-plan-validate.js:713`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/docs/EXECUTION_GUARDRAILS.md:93`
- Criterio de verificacion posterior:
  - `validate` debe fallar cuando faltan `docs/discovery/<feature>.md` o `docs/plan/<feature>.md`.
  - Debe existir modo legacy solo si es explicito (opt-in documentado).

### H-003 - `go` permite avance sin git con policy limitada
- Impacto: Alto
- Severidad: P1
- Valor: Alto
- Riesgo: Medio-Alto
- Evidencia:
  - En workspace no-git con artefactos completos, `go --non-interactive --yes` devuelve GO.
  - `policy` ya advierte limitacion fuera de git, pero no bloquea GO.
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime.js:327`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime-flow.js:265`
- Criterio de verificacion posterior:
  - `go` debe bloquear cuando `changed.git === false` o requerir override explicito con justificacion.
  - Test de regresion para escenario no-git.

### H-004 - `status` ignora `--feature` en contexto multi-feature
- Impacto: Medio-Alto
- Severidad: P2
- Valor: Alto
- Riesgo: Medio
- Evidencia:
  - En repo con `alpha` y `zeta`, `status --feature zeta --json` reporta `feature: "alpha"` (seleccion implicita).
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:98`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:726`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/status.js:579`
- Criterio de verificacion posterior:
  - Soportar `status --feature <name>` como fuente prioritaria.
  - Si hay multiples specs aprobados y no se pasa `--feature`, devolver error deterministico.

### H-005 - Superficie de ejecucion en `verify` (shell + sin timeout)
- Impacto: Medio-Alto
- Severidad: P2
- Valor: Medio-Alto
- Riesgo: Medio-Alto
- Evidencia:
  - `runVerification` usa `spawnSync(command, { shell: true })`.
  - No hay timeout ni limite de ejecucion para comando de verificacion.
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime.js:281`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/runtime.js:284`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/index.js:103`
- Criterio de verificacion posterior:
  - Timeout configurable y fallback controlado.
  - Ruta por defecto sin `shell`.
  - `--verify-cmd` con controles explicitos y telemetria de riesgo.

### H-006 - Inconsistencia de retrieval mode en plan
- Impacto: Medio
- Severidad: P3
- Valor: Medio
- Riesgo: Bajo
- Evidencia:
  - Plan generado incluye linea fija `Retrieval mode: section-level` y luego metadata dinamica `Retrieval mode: semantic-lite`.
- Referencias:
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/discovery-plan-validate.js:347`
  - `/Users/cesareyeserrano/Documents/PROJECTS/aitri/cli/commands/discovery-plan-validate.js:368`
- Criterio de verificacion posterior:
  - Una sola fuente de verdad para retrieval mode en el plan.
  - Test de regresion para evitar doble declaracion inconsistente.

## Politica de ejecucion hasta cierre
- No introducir features nuevas.
- Priorizar orden de remediacion:
  1. H-001
  2. H-002
  3. H-003
  4. H-004
  5. H-005
  6. H-006

## Gate de salida para retomar roadmap de features
- Gate A: H-001/H-002/H-003 en estado Verificado.
- Gate B: smoke suite + demo E2E en verde despues de remediaciones.
- Gate C: evidencia de regresion agregada para cada fix critico.

## Estado de cierre (2026-02-16)
- Gate A: cumplido.
- Gate B: cumplido (`npm run test:smoke` 43/43, `npm run demo:5min` OK).
- Gate C: cumplido (regresiones nuevas para traversal, validate artifacts, go non-git, status multi-feature, verify timeout, plan retrieval consistency).

## Checklist de verificacion posterior (para la siguiente ronda)
- [x] Repro negativa de traversal bloqueada en `draft`, `verify`, `policy`.
- [x] `validate` falla cuando falta `discovery` o `plan`.
- [x] `go` bloquea fuera de git o requiere override explicito documentado.
- [x] `status --feature` respeta feature objetivo.
- [x] `verify` aplica timeout y controles de ejecucion.
- [x] Plan reporta retrieval mode consistente.
- [x] `npm run test:smoke` verde.
- [x] `npm run demo:5min` verde.
