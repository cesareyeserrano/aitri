# Aitri — Checkpoint de Desarrollo

Última actualización: 2026-02-19
Versión actual: **0.4.0** (npm + GitHub release)

---

## Estado del proyecto

Aitri es un CLI de orquestación para desarrollo de software con agentes de IA.
Genera specs, planes, backlogs, tests y briefs. El agente (Claude Code u otro) lee los briefs e implementa.
Aitri no escribe código — orquesta y verifica.

---

## Pipeline actual (7 comandos)

```
init → draft → approve → plan → go → build → deliver
```

| Comando | Qué hace |
|---|---|
| `init` | Inicializa estructura del proyecto |
| `draft` | Crea spec borrador (smart extraction desde --idea) |
| `approve` | Quality gate del spec |
| `plan` | Discovery inline + plan + backlog + tests |
| `go` | Validación + policy + aprobación humana |
| `build` | Por story: scaffold + brief + verify [--story US-N] |
| `deliver` | Git tag + build artifact + reporte final |

Comandos auxiliares: `preview`, `status`, `resume`
Deprecados (siguen funcionando con aviso): `discover`, `validate`, `handoff`, `scaffold`, `implement`, `verify`, `policy`

---

## Lo que está implementado

### Core pipeline
- [x] Pipeline 14→7 comandos
- [x] `plan` absorbe `discover` (discovery inline si no existe)
- [x] `go` absorbe `validate` (corre `collectValidationIssues` internamente)
- [x] `build` autónomo: scaffold + brief por story, sin pasos previos
- [x] `deliver` produce artefactos reales: git tag + build command
- [x] `preview` detecta y lanza el proyecto (npm/python/go/make)
- [x] `serve` eliminado

### Smart draft
- [x] `smartExtractSpec(idea)` en `cli/lib.js`
- [x] Extrae FRs desde HTTP patterns y verbos de acción
- [x] Extrae NFRs, actores, hints de seguridad
- [x] Deja `[CLARIFY:]` solo en lo genuinamente desconocido
- [x] Fix: defaults de auto-discovery no contienen "pending" (bug de confidence)

### Personas (7 activas)
- [x] Discovery — genera y valida `## 2` y `## 9` en discovery
- [x] Product — genera y valida `## 4` en plan
- [x] Architect — genera y valida `## 5` en plan
- [x] Security — genera `## 6` en plan (Threats + Required controls), validado
- [x] UX/UI — genera `## 7` en plan, validación condicional (si spec menciona UI)
- [x] QA — validación indirecta vía TC coverage
- [x] Developer — briefs en `build`

### Calidad y tests
- [x] 76 smoke tests, 43 regression tests = 119 total, 0 fallas
- [x] `schemaVersion: 1` en todos los JSON artifacts
- [x] File size budgets en CI (`docs/quality/file-size-budgets.json`)
- [x] Deprecation notices en todos los comandos deprecados

### Phases completadas
- [x] Phase H — Software Factory (spec-parser, scaffold, implement, verify con TC coverage, deliver gate)
- [x] Phase I — Product loop (feedback, amend, features, next)
- [x] Phase J — Brownfield (doctor, config mapping)
- [x] Phase K — Upgrade
- [x] Phase L — Incremental loop (triage, roadmap, changelog)
- [x] Phase M — Enforcement (hooks, CI)
- [x] Phase O — Semantic quality layer
- [x] Phase N — AI execution engine (execute como context presenter)
- [x] Phase P — Visibility

---

## Pendientes

### Próximas mejoras (en orden de valor)

- [ ] **`approve` con preguntas dirigidas para `[CLARIFY:]`**
  Cuando `aitri approve` encuentra marcadores `[CLARIFY: ...]` sin resolver,
  debe hacer preguntas específicas solo para esas secciones.
  Archivo: `cli/commands/approve.js`

- [ ] **Ciclo feedback → amend → re-deliver validado end-to-end**
  Los comandos existen pero nunca se probó el loop completo en un proyecto real.
  Probar en `notes-api` o proyecto nuevo.

- [ ] **Brief más prescriptivo en `build`**
  Hoy el brief presenta contexto pero no dice exactamente qué archivos crear.
  Agregar: lista de archivos a crear con estructura sugerida.
  Archivo: `cli/commands/build.js`

---

## Cómo continuar en una nueva sesión

1. Lee este archivo
2. Corre `npm run test:smoke && npm run test:regression` — deben pasar los 119
3. Revisa los pendientes de arriba en orden
4. Antes de implementar cualquier cambio, corre `npm run check:file-growth` para verificar presupuestos
5. Actualiza este archivo al terminar la sesión

---

## Archivos clave

| Archivo | Descripción |
|---|---|
| `cli/index.js` | Router principal, ~998 líneas |
| `cli/commands/build.js` | Comando build autónomo |
| `cli/commands/discovery-plan-validate.js` | plan, discover, validate |
| `cli/commands/runtime-flow.js` | go, handoff |
| `cli/commands/status.js` | State machine, ~1076 líneas |
| `cli/lib.js` | Utilidades: smartExtractSpec, normalizeFeatureName, etc. |
| `cli/commands/persona-validation.js` | Gates de personas |
| `docs/quality/file-size-budgets.json` | Presupuestos de tamaño de archivos |
| `backlog/aitri-core/backlog.md` | Backlog histórico de Aitri |
