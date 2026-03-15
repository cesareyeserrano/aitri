# Aitri — Backlog

> Open items only. Closed items are in CHANGELOG.md.
> Priority: P1 (critical) / P2 (important) / P3 (nice to have)

---

## Implementation Strategy

> Scoring: Value × 4 + Severity × 3 + Impact × 2 − Risk. Value is the primary driver.
> Last prioritized: 2026-03-12.

### Tier 1 — Immediate (correctness + foundational input)
Fix active bugs and secure the pipeline's input quality before adding features.

| Rank | Item | Score | Why first |
| ---: | :--- | :---: | :--- |
| ~~1~~ | ~~`status` / `validate` inconsistency + Artifact drift detection~~ | 43 | ✅ **Done v0.1.26** |
| ~~2~~ | ~~Structured IDEA.md template~~ | 40 | ✅ **Done v0.1.29** |
| ~~3~~ | ~~Three Amigos gate (ac_id validation)~~ | 38 | ✅ **Done v0.1.30** |
| ~~4~~ | ~~Requirement Source Integrity (PM persona)~~ | 37 | ✅ **Done (pre-existing)** |
| ~~5~~ | ~~verify-run Vitest / parser fragility~~ | 35 | ✅ **Done (pre-existing)** |

### Tier 2 — Short-term (quality + adoption)
High value, contained implementations. No item here blocks another.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| ~~6~~ | ~~`aitri feature` sub-pipeline~~ | 33 | ✅ **Done v0.1.31** |
| ~~7~~ | ~~Best practice docs injected into briefings~~ | 31 | ✅ **Done v0.1.28** — templates + injection in run-phase.js |
| ~~8~~ | ~~`aitri resume` session handoff~~ | 29 | ✅ **Done (pre-existing)** |
| ~~9~~ | ~~Artifact drift detection~~ | — | ✅ **Merged into Rank 1** |
| ~~10~~ | ~~Artifacts folder (`spec/`)~~ | 28 | ✅ **Done v0.1.26** |

### Tier 3 — Planned (enforce + improve)
Valid, implementable, not urgent. No item blocks the core pipeline.

| Rank | Item | Score | Note |
| ---: | :--- | :---: | :--- |
| ~~11~~ | ~~TC h/f naming convention~~ | 25 | ✅ **Done v0.1.30** — validate() enforces TC id ending in h/f per FR |
| ~~12~~ | ~~README restructure~~ | 23 | ✅ **Done v0.1.35** — progressive disclosure, schemas moved out |
| ~~13~~ | ~~Pipeline close-out clarity~~ | 20 | ✅ **Partially done in v0.1.26** |
| ~~14~~ | ~~`aitri adopt` diagnostic~~ | 20 | ✅ **Done v0.1.34/v0.1.35** — scan + apply + --upgrade |
| ~~15~~ | ~~Discovery Confidence gate~~ | 20 | ✅ **Done v0.1.33** |
| ~~16~~ | ~~`aitri wizard`~~ | 20 | ✅ **Done v0.1.36** — TTY interview, depths quick/standard/deep, writes IDEA.md |
| ~~17~~ | ~~Discovery guided interview (`--guided`)~~ | 20 | ✅ **Done v0.1.36** — injects interview context into discovery briefing |
| ~~18~~ | ~~UX/UI precision — archetype detection~~ | 20 | ✅ **Done v0.1.33** |

### Tier 4 — Deferred
High blast radius or dependency conflicts. Do not schedule until Tiers 1–2 are shipped.

| Rank | Item | Score | Blocker |
| ---: | :--- | :---: | :--- |
| ~~19~~ | ~~`aitri checkpoint`~~ | 13 | ✅ **Done (pre-existing)** |

### Discarded
Items analyzed and explicitly rejected.

| Item | Decision | Reason |
| :--- | :--- | :--- |
| Mutation testing | Discarded indefinitely | Violates zero-dep principle. `verify-run --assertion-density` covers 60% of the same problem at zero cost. Option B (globally-installed stryker) introduces implicit env dependency — worse than explicit dep. ROI does not justify. |

### P-level corrections (vs original backlog labels)
| Item | Was | Now | Reason |
| :--- | :--- | :--- | :--- |
| Three Amigos gate | P2 | P1 | In schema, unenforced, low risk — should ship with other Tier 1 validate() work |
| `aitri feature` | P1 | P2 | High value but high risk — not a correctness bug, requires stable foundation + file locking first |
| verify-run Vitest | P2 | P1 | Adoption blocker confirmed by E2E evaluation — 0 TCs detected on Vitest projects |
| Artifact drift detection | P2 | P1 | Merged with status/validate inconsistency — same root fix |
| Artifacts folder (`spec/`) | Tier 4 | Tier 2 | Blast radius grows linearly with each new command — do before feature/adopt/resume land |

---

## Entry Standard

Every backlog entry must be self-contained — implementable in a future session with zero memory of the original conversation. Before adding an item, verify it answers all of these:

| Question | Why it matters |
| :--- | :--- |
| **What is the user-visible problem?** | Prevents implementing a solution looking for a problem |
| **Which files are affected?** | Implementer knows where to start without exploring |
| **What is the exact behavior change?** | Removes ambiguity about what "done" looks like |
| **Are there technical decisions pre-resolved?** | Captures trade-offs decided during analysis, not during implementation |
| **What does `validate()` or the test need to verify?** | Defines the acceptance criterion at the code level |
| **Are there known conflicts or risks with existing code?** | Prevents regressions on parsers, schemas, or commands |

**Minimum entry format:**
```
- [ ] P? — **Title** — one-line description of the user-visible problem.
  Problem: <why this matters, what breaks without it>
  Files: <lib/..., templates/..., test/...>
  Behavior: <what changes — inputs, outputs, validation rules>
  Decisions: <any trade-offs already resolved>
  Acceptance: <how to verify it works — test or manual check>
```

Entries without `Files` and `Behavior` are considered incomplete and must be expanded before scheduling.

---

## Open

---

### P1 — Aitri Adopt: revisión profunda para adopción de proyectos reales

> **Prioridad:** P1. El usuario quiere traer proyectos de terceros a Aitri, incluyendo uno de tamaño considerable. El flujo actual de adopt tiene friction suficiente para fallar en la práctica.

**Contexto del problema:** La sesión de 2026-03-14 identificó que `aitri adopt` funciona en proyectos simples/controlados, pero en proyectos de terceros con código preexistente, deuda técnica, y sin specs formales, el flujo tiene múltiples puntos de falla:

1. **`adopt scan` produce un briefing denso** — el agente recibe un árbol de archivos + signals pre-escaneadas y tiene que generar `ADOPTION_PLAN.md`. En proyectos grandes (>200 archivos) el tree puede exceder el contexto del agente o resultar en un plan de baja calidad.

2. **`adopt apply` depende de parsear `ADOPTION_PLAN.md`** — `parsePlan()` tiene 3 estrategias de fallback para detectar `completedPhases`. Si el agente escribe el plan en un formato ligeramente diferente, infiere 0 fases. `--from N` mitiga esto (v0.1.50) pero no todos los usuarios saben usarlo.

3. **No hay validación de que el estado adoptado sea coherente** — después de `adopt apply`, el `.aitri` puede tener `completedPhases: [1, 2, 3]` pero sin los artifacts correspondientes en `spec/`. El pipeline acepta ese estado y puede entrar a Phase 4 sin requirements reales.

4. **`scan` no distingue entre "el proyecto tiene specs" y "el proyecto tiene documentación"** — un `README.md` rico puede hacer que el agente marque Phase 1 como completada cuando en realidad no hay `01_REQUIREMENTS.json` en el formato de Aitri.

5. **El output de `adopt scan` (briefing) es evaluativo, no accionable** — produce `ADOPTION_PLAN.md` que el usuario tiene que leer y convertir en comandos. El ideal sería que `adopt apply` pueda ejecutarse directamente sin un plan intermedio en muchos casos.

**Archivos afectados:**
- `lib/commands/adopt.js` — `adoptScan`, `adoptApply`, `adoptApplyFrom`, `adoptUpgrade`, `parsePlan`, `inferFromArtifacts`
- `templates/adopt/scan.md` — briefing template para el agente
- `lib/personas/adopter.js` — persona del arquitecto adoptador
- `test/commands/adopt.test.js` — tests actuales de adopt

**Área de trabajo a explorar (sin pre-decidir solución):**

- [ ] **Limitar el file tree en scan** — proyectos grandes necesitan un tree truncado o filtrado por relevancia (solo entry points, routes, models, tests, config). El scan actual incluye todo.
- [ ] **Validar coherencia post-adopt** — después de `adopt apply` o `adoptApplyFrom`, verificar que cada phase marcada como completada tenga su artifact correspondiente en disco o en `spec/`. Warn si hay desajuste.
- [ ] **`adopt apply --from` como path primario** — documentar `--from` más prominentemente. Para proyectos con código existente pero sin specs, `--from 1` es casi siempre la respuesta correcta: se retroalimentan las specs desde el código existente.
- [ ] **Mejora del briefing de scan** — el template `scan.md` puede ser más accionable: incluir en el output la recomendación de `--from N` directamente ejecutable, no solo como texto para el usuario a interpretar.
- [ ] **Revisar `parsePlan`** — el parser de `ADOPTION_PLAN.md` es frágil. Evaluar si debe mantenerse o si `--from` lo reemplaza completamente como path principal.

**Señal de éxito:** Un proyecto de terceros con 50-200 archivos puede ser adoptado en Aitri en <5 minutos con un estado coherente y listo para continuar el pipeline desde la fase correcta.

**Decisión de arquitectura pendiente:** ¿`adopt scan` → `ADOPTION_PLAN.md` → `adopt apply` sigue siendo el flujo principal, o `adopt apply --from N` se convierte en el flujo principal y `scan` queda como herramienta auxiliar de diagnóstico?

---

### Auditoría 2026-03-14 — Hallazgos pendientes de implementación

> Fuente: revisión profunda de todo el codebase (v0.1.46). Ordenados por severidad.

- ✅ **`checkpoint.js` — stdout restore sin `try/finally`** — Ya tenía try/finally. Confirmado en auditoría v0.1.47 — no requirió cambio.

- ✅ **`adopt apply` — inferencia de fases completadas es frágil** — Done v0.1.47. Emite `[aitri] Warning` en stderr cuando `completedPhases.length === 0`, con instrucción de usar `aitri adopt --upgrade` como alternativa.

- ✅ **`feature run-phase` — FEATURE_IDEA.md sin guardrail** — Done v0.1.47. `err()` explícito con path exacto si FEATURE_IDEA.md no existe antes de generar briefing.

- ✅ **`manifest.test_files` declarados pero no verificados en disco** — Done v0.1.47. `phase4.validate()` acepta `{ dir }` como segundo arg (ya pasado por `complete.js`). Emite advertencia en stderr por cada test_file no encontrado. No bloquea.

- ✅ **`phaseReview` — approve no tiene routing específico** — Done v0.1.47. Routing explícito para `review` en `approve.js`: si verify passed → `run-phase 5`, si Phase 4 aprobada → `verify-run`, si no → `run-phase 4`. No bloqueante para Phase 5.

- ✅ **`run-phase` no emite evento "started"** — Done v0.1.47. `appendEvent(config, 'started', phase)` antes de `saveConfig` en `run-phase.js`. Solo emite si el briefing llega a completarse sin errores de prerequisito.

- ✅ **`adopt scan` — scanners individuales sin tests unitarios** — Done v0.1.47. `scanCodeQuality`, `scanSecretSignals`, `scanInfrastructure`, `scanTestHealth` exportados como named exports. 13 tests unitarios añadidos en `test/commands/adopt.test.js`.

---

### Estudio futuro — Adoption path (proyectos existentes)

> No es un bug. Es un gap de producto que determina si Aitri puede adoptarse fuera de proyectos nuevos.

**Contexto:** `aitri adopt` es el camino para traer proyectos existentes al pipeline. El flujo actual:
1. Usuario corre `aitri adopt scan` — detecta código, tests, infra existente
2. Usuario escribe `ADOPTION_PLAN.md` describiendo qué phases están "completas"
3. Usuario corre `aitri adopt apply` — materializa el estado en `.aitri`
4. Pipeline continúa desde donde el proyecto está

**El problema real:** El flujo asume que el usuario puede mapear un proyecto existente al modelo de fases de Aitri con precisión. En la práctica:

- **Inferencia de phases es frágil.** `aitri adopt apply` intenta inferir `completedPhases` de `ADOPTION_PLAN.md` — si el usuario no incluye la sección correcta (JSON array o bullet list), infiere 0 phases y el pipeline empieza desde cero. La warning que añadimos en v0.1.47 mitiga pero no resuelve.
- **ADOPTION_PLAN.md es difícil de escribir.** El usuario necesita entender el modelo de fases de Aitri suficientemente para saber si su proyecto "completó Phase 1 (requirements)" o no. Muchos proyectos existentes nunca tuvieron requirements formales — ¿eso es Phase 1 no completada, o Phase 1 con debt?
- **La scan es informativa, no accionable.** `aitri adopt scan` detecta patrones pero el usuario tiene que interpretar los resultados y traducirlos a ADOPTION_PLAN.md manualmente. No hay bridge automático entre scan output y estado de Aitri.
- **Sin definición de "adopción exitosa".** No hay un criterio claro de cuándo un proyecto está "completamente adoptado" vs "parcialmente adoptado". El usuario puede terminar con un `.aitri` config incompleto y no saberlo.
- **Friction suficiente para no hacerlo.** El proceso requiere 4+ pasos manuales, lectura de documentación, y conocimiento del modelo de phases. La mayoría de equipos con proyectos existentes no lo van a ejecutar correctamente.

**Opciones a estudiar:**

1. **Auto-adopt desde artifacts existentes** — si `01_REQUIREMENTS.json`, `02_SYSTEM_DESIGN.md`, etc. existen en el directorio, inferir phases completadas automáticamente sin ADOPTION_PLAN.md. Sin ambigüedad, sin escritura manual.

2. **Wizard de adopción guiado** — `aitri adopt --wizard` hace preguntas específicas ("¿tiene requirements documentados? ¿dónde?", "¿tiene tests? ¿qué porcentaje pasa?") y genera el estado de Aitri sin que el usuario entienda el modelo de fases internamente.

3. **"Adopt lite" — adopción parcial declarada** — en vez de mapear al modelo de fases, el usuario declara un "punto de entrada": `aitri adopt --from 4` inicia el pipeline desde Phase 4 (el agente escribe las fases anteriores como documento retroactivo). Útil para proyectos que ya tienen código pero no specs.

4. **Reposicionar Aitri como "start of project" tool** — documentar explícitamente que Aitri está diseñado para proyectos nuevos. Para proyectos existentes, la recomendación es extraer el conocimiento del código en un IDEA.md y correr el pipeline completo. `aitri adopt` quedaría como herramienta avanzada, no como path primario.

**Criterio de decisión:**
- Si la mayoría de usuarios target son proyectos nuevos: Opción 4 (reposicionar)
- Si hay demanda real de adopción de proyectos existentes: Opción 1 o 2
- Opción 3 es una solución de compromiso pragmática con riesgo de artifacts de calidad baja

**Señal a observar:** ¿Cuántos usuarios de Aitri intentan `adopt`? ¿Cuántos lo completan sin soporte? Si la mayoría lo abandona, el problema es de diseño, no de documentación.

---

### Estudio futuro — Calidad semántica de artifacts

> No es un bug ni un item de implementación. Es una pregunta de diseño para explorar.

**Tema:** Aitri valida la *estructura* de los artifacts (schema, campos requeridos, conteos mínimos) pero no su *calidad semántica*. Un agente puede producir `01_REQUIREMENTS.json` con 5 FRs técnicamente válidos pero conceptualmente triviales, genéricos, o desconectados del problema real descrito en IDEA.md.

**Pregunta abierta:** ¿Hasta dónde debe llegar Aitri en validar calidad semántica?

Ejemplos de lo que no se valida hoy:
- FR.title de "La app debe funcionar correctamente" pasa validación
- Acceptance criteria copiados entre FRs sin diferenciación
- System design que ignora los NFRs de Phase 1
- Test cases que no ejercen los acceptance criteria (Three Amigos gate cubre ac_id cross-reference, pero no la relevancia del test)

**Opciones a estudiar:**
1. Heurísticas de calidad en `validate()` (longitud mínima de títulos, diversidad de acceptance criteria, detección de duplicados)
2. Phase de revisión cruzada entre artifacts (ej: validar que el system design menciona cada NFR)
3. Dejar la calidad 100% al humano que aprueba — las gates solo verifican estructura

**Criterio de decisión:** No introducir complejidad que genere falsos positivos. Un validator que rechaza artifacts buenos es peor que uno que acepta artifacts mediocres.

---

### Stabilization

- ✅ **Aitri Stabilization (v0.1.37–v0.1.44)** — Done v0.1.44. Full real-world adopt test (Ultron), wizard agent-mode, idea/ folder, Delivery Summary in all 8 templates, dead code audit, 3 real bugs fixed (resume.js fr_coverage array mismatch, adopt.js buf.slice deprecation, adopt.js process.exit(0) on abort). 443/443 tests passing. No known open bugs.

---

## AitriHub Integration Backlog

> Gestionado desde Aitri hasta que Hub tenga su propio pipeline Aitri activo.
> Reference: `docs/Aitri_Design_Notes/INTEGRATION_CONTRACT.md`
> Hub repo: `/Users/cesareyeserrano/Documents/PROJECTS/AITRI-HUB`

### Bugs (Hub side — correctness)

- ✅ **[Hub] `fr_id` field name** — Not a bug. `test-reader.js` already reads `entry.fr_id` correctly and exposes it as `frId` internally. Confirmed by reading source + tests (2026-03-13).

- ✅ **[Hub] respect `artifactsDir` from `.aitri` config** — Done v0.1.1. `aitri-reader` exposes `artifactsDir` (defaults to `"spec"`). `test-reader` accepts it as param. `collector/index` passes `aitriState?.artifactsDir`. 6 new tests.

- ✅ **[Hub] handle `.aitri` as directory** — Done v0.1.1. `aitri-reader` detects EISDIR and reads `.aitri/config.json` instead. 3 new tests.


### Features (Hub side — new data)

- ✅ **[Hub] read `05_PROOF_OF_COMPLIANCE.json` → compliance badge** — Done Hub v0.1.4. `compliance-reader.js`, Rule 6 in alerts engine, badge on ProjectCard (✓ COMPLIANT / ⚠ PARTIAL / · DRAFT). 13 new tests.

- ~~[ ] P2 — **[Hub] read `05_PROOF_OF_COMPLIANCE.json` → compliance badge**~~ — Hub shows "verify passed ✅" but not the final compliance verdict. `05_PROOF_OF_COMPLIANCE.json` has `overall_compliance` per project.
  Problem: A project can pass all tests but still have `development_only` compliance. Hub currently shows it as healthy. This is misleading for production readiness decisions.
  Files: `AITRI-HUB/lib/collector/` (new `compliance-reader.js`), `AITRI-HUB/lib/alerts/engine.js` (new alert: compliance-blocked), web components (ProjectCard, header badge)
  Behavior: New `complianceSummary: {overall, production_ready: n, partial: n, blocked: n}` in ProjectData. New alert `compliance-blocked` (severity: error) when overall is not `production_ready`. Show badge in project card: `✅ production_ready` / `⚠️ staging_ready` / `❌ blocked`.
  Decisions: Only read if Phase 5 is in `approvedPhases` — don't show stale compliance from previous runs.
  Acceptance: Project card shows compliance level. Alert fires when `overall_compliance !== 'production_ready'`.

- ✅ **[Hub] read `01_REQUIREMENTS.json` → requirements context** — Done Hub v0.1.5. `requirements-reader.js`, FR count + priority breakdown on ProjectCard header. 11 new tests.

- ✅ **[Hub] detect feature sub-pipelines** — Done Hub v0.1.6. `aitri-reader` scans `features/` subdirs for `.aitri` files, exposes `features[]` (max 10, sorted by name). ProjectCard shows "N active" badge with name preview. Refactored `readStateFile()` shared helper. 9 new tests. Note: actual structure is `features/<name>/.aitri`, not `.aitri-feature-*` files — backlog description was incorrect.

### Features (Aitri side — better data for Hub)

- ✅ **[Aitri] event log in `.aitri`** — Done Aitri v0.1.45. `appendEvent()` in `state.js`, called by `approve.js`, `complete.js`, `reject.js`. Cap 20 entries. Hub reads `events[]` via `aitri-reader`, ActivityTab renders timeline. Hub v0.1.3.

- ✅ **[Aitri] `aitri init` auto-registers in Hub if installed** — Done Aitri v0.1.46. Silent, non-blocking. Reads `~/.aitri-hub/projects.json`, appends entry if not already registered. Prints `  Registered in Aitri Hub`.

- ✅ **[Aitri] `aitri status` mentions Hub if project is monitored** — Done Aitri v0.1.46. Silent check of `~/.aitri-hub/projects.json`; prints `  Monitored by Aitri Hub — run: aitri-hub monitor` if project is registered.

---

## Known Technical Debt (design trade-offs — v0.1.44)

> These are not bugs. They are intentional trade-offs that have known failure modes. Documented so they are not rediscovered in future sessions.

- ✅ **`JSON.parse()` in phase validators produces cryptic errors on malformed agent output** — Done v0.1.47. `phase1/3/4/5.validate()` now wraps `JSON.parse` in try/catch and throws a user-actionable message including the artifact name. Test updated in `phase1.test.js`.

- ✅ **`verify.js` coverage is empty if agent omits `@aitri-tc` markers** — Done v0.1.47. Warning emitted in stderr when all `fr_coverage` entries show `tests_passing === 0` but `summary.passed > 0`. Non-blocking.

- ✅ **`scanTestHealth` reads full test files with `fs.readFileSync` (no byte limit)** — Done v0.1.47. Replaced with `openSync/readSync/closeSync` + `MAX_FILE_READ_BYTES`. Consistent with `scanCodeQuality` and `scanSecretSignals`.

---

## Engineering Integrity (fixed findings — 2026-03-12)

> Source: deep technical audit of v0.1.25. All confirmed fixed.

- ✅ **Atomic write cross-device failure** — Fixed v0.1.26: temp file now in project dir.
- ✅ **`approve.js` UX detection silent fallback** — Fixed v0.1.26: stderr warn on malformed JSON.
- ✅ **`phaseReview.js` missing `extractContext`** — Fixed v0.1.26.
- ✅ **No file locking on `.aitri` state file** — Fixed v0.1.32: O_EXCL lock + stale detection.

---

## Spec-Driven Foundation (all done)

- ✅ **Structured IDEA.md template** — Done v0.1.29
- ✅ **Requirement Source Integrity in PM persona** — Done (pre-existing)
- ✅ **Discovery Confidence gate** — Done v0.1.33
- ✅ **TC happy/failure naming convention (h/f suffix)** — Done v0.1.30
- ✅ **Discovery interview wizard** — Deferred → open item above (P3)

---

## Pipeline Reliability (all done)

- ✅ **`aitri status` / `aitri validate` inconsistency + drift detection** — Done v0.1.26
- ✅ **Phase 4 manifest required fields documented in briefing** — Done (template updated)
- ✅ **verify-run Vitest support** — Done (pre-existing)
- ✅ **Pipeline close-out clarity** — Done v0.1.26

---

## Next Features (all done)

- ✅ **`aitri feature` sub-pipeline** — Done v0.1.31
- ✅ **`aitri resume` session handoff** — Done (pre-existing)
- ✅ **`aitri adopt` — scan + apply + --upgrade** — Done v0.1.34/v0.1.35
- ✅ **Artifacts folder (`spec/`)** — Done v0.1.26
- ✅ **`aitri checkpoint`** — Done (pre-existing)

---

## Engineering Quality (all done)

- ✅ **Best practice docs injected into phase briefings** — Done v0.1.28
- ✅ **Three Amigos gate — Phase 3 TCs must trace to Phase 1 ACs** — Done v0.1.30

---

## Documentation & UX

- ✅ **README restructure** — Done v0.1.35: progressive disclosure, schemas moved to `aitri help`, ASCII art header, commands table with adopt/feature/resume.
