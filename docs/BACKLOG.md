# Aitri — Backlog de Mejoras de Calidad de Fases

## Estado actual (baseline estable)

**Versión:** v0.1.10
**Tests:** 87/87 passing
**Pipeline:** funcional end-to-end, verificado con proyecto real (DayTrack)
**Principio:** no agregar features ni comandos — mejorar la calidad del output de las 5 fases existentes.

> ⚠️ Antes de implementar cualquier item: correr `npm run test:all` para confirmar baseline.
> Después de cada item: correr `npm run test:all` y verificar que sigue en 87/87 (o más si se agregan tests).

---

## Fuente del benchmark

Las mejoras vienen del análisis de `aitri-Deprecated/core/personas/` (v2.1-v2.3).
El deprecado fue descartado porque no producía código funcional, pero sus definiciones de personas eran significativamente más directivas y estructuradas que las actuales.
**Objetivo:** importar la directividad de los briefings sin tocar la estructura CLI, validators, ni state management.

---

## BL-001 — Phase 1: Agregar No-go zone y Product Analysis Vector al briefing

**Prioridad:** Alta
**Archivo:** `lib/phases/phase1.js` → solo `buildBriefing()`
**Problema:** El briefing actual pide FRs pero no fuerza al agente a declarar qué está **fuera de scope**. Esto genera FRs con scope ambiguo que se amplifican en fases posteriores. Claude puede inferir un backend cuando el usuario no lo quiere.
**Fuente:** deprecated `product.md` v2.1 — secciones "No-go zone" y "Product Analysis Vector"

**Cambios en briefing:**
- Agregar sección `## No-go zone (mandatory)` en output schema — el agente debe declarar ≥3 items fuera de scope antes de continuar
- Agregar campo `"no_go_zone": ["item1", "item2"]` al JSON schema
- Reformular intro de persona: añadir "scope protection: explicit no-go zone is mandatory before handoff"

**Cambios en validator:** ninguno (no queremos romper el schema actual)
**Cambios en tests:** ninguno (validator no cambia)
**Riesgo:** Bajo — solo texto del briefing

---

## BL-002 — Phase 2: Forzar ADRs con ≥2 opciones y failure blast radius

**Prioridad:** Alta
**Archivo:** `lib/phases/phase2.js` → solo `buildBriefing()`
**Problema:** El briefing pide "Risk Analysis" pero no exige que cada decisión técnica evalúe alternativas. Agentes diferentes eligen stacks sin justificación → divergencia entre Claude y Codex en arquitectura.
**Fuente:** deprecated `architect.md` v2.3 — secciones "ADRs", "Failure Blast Radius"

**Cambios en briefing:**
- Agregar formato obligatorio de ADR: `ADR-XX: título / Context / Option A / Option B / Decision / Consequences`
- Regla: cada ADR debe evaluar ≥2 opciones — un ADR con una sola opción es un log, no una decisión
- Agregar sección `## Failure Blast Radius` al output schema: por cada componente crítico, describir qué rompe, qué ve el usuario, cómo se recupera
- Añadir traceability checklist al final del briefing (como nota de auto-verificación para el agente)

**Cambios en validator:** ninguno
**Cambios en tests:** ninguno
**Riesgo:** Bajo — solo texto del briefing

---

## BL-003 — Phase 3: Añadir Type Coverage Matrix y formato Given/When/Then con valores concretos

**Prioridad:** Alta
**Archivo:** `lib/phases/phase3.js` → solo `buildBriefing()`
**Problema:** Los test cases actuales pueden ser abstractos ("steps: POST /login"). El agente puede cumplir el mínimo de 3 TCs por FR con tests triviales que no prueban comportamiento real. Claude y Codex generan test cases completamente diferentes para el mismo FR.
**Fuente:** deprecated `qa.md` v2.3 — "Type Coverage Matrix", "TC Format SPEC-SEALED", "Given/When/Then"

**Cambios en briefing:**
- Agregar Type Coverage Matrix al output schema: por cada FR, declarar si Unit/Integration/E2E es MUST/SHOULD/-
- Reformular TC format: añadir `given`, `when`, `then` como campos expected con valores concretos (no abstractos)
- Regla SPEC-SEALED: `given`/`when`/`then` deben ser valores concretos — "valid data" no es aceptable como valor
- Mantener los campos actuales (`steps`, `expected_result`) — agregar `given/when/then` como recomendación, no romper schema existente
- Ejemplo negativo/positivo explícito en el briefing para Given/When/Then

**Cambios en validator:** ninguno (no queremos romper el schema de test_cases)
**Cambios en tests:** ninguno
**Riesgo:** Bajo — solo texto del briefing

---

## BL-004 — Phase 4: Añadir Technical DoD y @aitri-trace headers

**Prioridad:** Media
**Archivo:** `lib/phases/phase4.js` → solo `buildBriefing()`
**Problema:** El agente declara deuda técnica en el manifest pero no hay un "Definition of Done" explícito que deba verificar antes de `aitri complete 4`. Los `@aitri-trace` headers ayudan a que cualquier agente pueda retomar el trabajo mid-stream.
**Fuente:** deprecated `developer.md` v2.2 — "Technical DoD", "Interface Contracts", "Traceability headers"

**Cambios en briefing:**
- Agregar sección `## Technical Definition of Done` con checklist explícito:
  - lint/type checks pasan
  - tests pasan (`npm test` o equivalente)
  - `technical_debt` en manifest está completo
  - todos los archivos listados en `files_created` existen físicamente
- Agregar instrucción de `@aitri-trace` headers en funciones clave:
  ```
  /** @aitri-trace FR-ID: FR-001, TC-ID: TC-001 */
  ```
- Reformular intro: separar las 3 fases de implementación (skeleton → persistence/integrations → edge cases/hardening)

**Cambios en validator:** ninguno
**Cambios en tests:** ninguno
**Riesgo:** Bajo — solo texto del briefing

---

## BL-005 — IDEA.md template: Añadir sección de Critical Constraints

**Prioridad:** Media
**Archivo:** `templates/IDEA.md`
**Problema:** El template actual es demasiado permisivo. El usuario puede escribir 41 palabras y el agente tiene demasiada libertad de interpretación → varianza alta entre Claude y Codex.
**Fuente:** análisis de budget-tracker: sin constraints explícitos, el agente puede inferir backend, auth, stack diferente.

**Cambios en template:**
- Añadir sección `## Critical Constraints` con ejemplos imperativo:
  ```
  - NO backend — frontend-only
  - MUST use localStorage — never database
  - NO authentication
  - First delivery must run with a single command
  ```
- La sección es opcional pero visible para educar al usuario sobre la importancia de constraints

**Cambios en validator:** ninguno
**Cambios en tests:** ninguno
**Riesgo:** Ninguno — solo template, no afecta código existente

---

## Plan de implementación

### Orden recomendado

```
BL-001 → BL-002 → BL-003 → BL-004 → BL-005
```

Cada item es independiente. Se puede implementar y hacer PR por separado.

### Por qué este orden

1. **BL-001 primero** — Phase 1 es el punto de mayor amplificación. Si el scope queda bien definido en Phase 1, Phases 2-5 heredan esa claridad.
2. **BL-002 segundo** — La arquitectura con ADRs reduce divergencia en tech stack entre agentes.
3. **BL-003 tercero** — Tests más concretos → Phase 4 tiene menos ambigüedad sobre qué implementar.
4. **BL-004 cuarto** — DoD y traceability headers: solo útiles cuando las fases anteriores ya son buenas.
5. **BL-005 último** — Template change: no afecta código, puede hacerse en cualquier momento.

---

## Protocolo de regresión post-implementación

### Antes de cada item

```bash
cd /path/to/aitri
npm run test:all
# Expected: 87/87 passing
```

### Después de cada item

```bash
npm run test:all
# Expected: ≥87/87 passing (nunca menos)
```

### Tests específicos a verificar tras cada item

| Item | Tests clave que NO deben romperse |
|---|---|
| BL-001 | `npm run test` (phase1.test.js) — todos los 13 tests |
| BL-002 | `npm run test` (phase2.test.js) — todos los 6 tests incluyendo numbered headers |
| BL-003 | `npm run test` (phase3.test.js) — todos los 8 tests |
| BL-004 | `npm run test` (phase4.test.js) — todos los 12 tests |
| BL-005 | smoke.js — `aitri init creates IDEA.md` (verifica template) |

### Tests nuevos a agregar con cada item

Cada item de backlog **puede** agregar tests si introduce comportamiento verificable:

| Item | Test nuevo posible |
|---|---|
| BL-001 | Verificar que el briefing de Phase 1 contiene la palabra "no-go" |
| BL-002 | Verificar que el briefing de Phase 2 contiene "ADR" y "≥2 options" |
| BL-003 | Verificar que el briefing de Phase 3 contiene "Given" y "When" |
| BL-004 | Verificar que el briefing de Phase 4 contiene "Definition of Done" |
| BL-005 | Verificar que `IDEA.md` template contiene "Critical Constraints" |

> Nota: estos son tests de briefing (verifican que el texto del prompt esté correcto), no tests de validator. Son útiles para evitar regresiones en el texto del briefing.

---

## Items explícitamente fuera de scope

Los siguientes items **NO están en este backlog** por decisión del producto:
- Nuevos comandos (`aitri review`, `aitri lint`, etc.)
- Nuevas fases (Phase 0, Phase 6, etc.)
- Integración con herramientas externas (GitHub, Slack, etc.)
- MCP server changes
- Ejecución automática de tests por Aitri (actualmente es el agente quien corre `npm test`)
- Auto-commit o auto-push de artefactos

---

*Última actualización: v0.1.10 — 2026-03-10*
