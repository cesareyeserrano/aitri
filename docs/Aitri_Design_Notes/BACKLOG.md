# Aitri — Backlog

> Open items only. Closed items are in CHANGELOG.md.
> Priority: P1 (critical) / P2 (important) / P3 (nice to have)

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

### Ecosystem — Aitri Hub

- [x] P2 — **Hub: migrate project discovery to self-managed registry** *(implemented v0.1.64)* — Hub currently reads `~/.aitri-hub/projects.json` which Aitri used to auto-populate. Since v0.1.64 Aitri no longer writes to it. Hub should clarify that `setup` is the canonical registration path and optionally scan `~/.aitri/` for projects with `.aitri` files.

  Problem: New projects won't be auto-registered in Hub after v0.1.64. Users need to know to run `aitri-hub setup` manually.

  Files (Hub repo):
  - `lib/commands/setup.js` — add optional auto-scan flow
  - `lib/commands/init.js` — update onboarding message to direct users to `setup`
  - `README.md` — update setup instructions (no longer mentions Aitri auto-registration)

  Behavior:
  - `aitri-hub setup` remains the canonical registration path (already works)
  - Optional: `aitri-hub scan <dir>` walks a directory tree finding `.aitri` files and offers to register each
  - No changes to Hub's reader — `aitri-reader.js` is already correct

  Decisions: Hub owns `~/.aitri-hub/projects.json` entirely. Aitri never touches it.

  Acceptance: `aitri init` on a new project does not add an entry to `~/.aitri-hub/projects.json`. Running `aitri-hub setup` registers the project correctly.

- [x] P3 — **Hub: standardize change detection for GitHub projects** *(implemented — github-poller.js, 60s interval, 5min backoff on 429)* — Hub monitors local projects via filesystem poll (5s). GitHub (remote) projects have no equivalent mechanism.

  Problem: Teams with separate machines using GitHub repos can't use Hub's live monitoring without a manual refresh mechanism.

  Files (Hub repo):
  - `lib/collector/aitri-reader.js` — add GitHub fetch path: fetch `.aitri` raw from GitHub, compare `updatedAt` or git SHA to detect changes
  - `lib/collector/git-reader.js` — add `getLastCommitSHA` function for remote repos
  - `lib/commands/monitor.js` — pass `updatedAt` from previous poll cycle for comparison

  Behavior:
  - Local projects: unchanged (filesystem poll on `updatedAt`)
  - Remote projects (`type: "remote"`): on each poll cycle, fetch `.aitri` raw from `raw.githubusercontent.com/<owner>/<repo>/main/.aitri`, compare `updatedAt` with cached value; if changed, re-fetch relevant artifacts
  - If GitHub rate-limits: back off and show warning; do not crash

  Decisions:
  - Use GitHub raw content (no OAuth, no API token) — same as Graph's approach
  - Only public repos supported in this version
  - Poll interval for remote projects can be longer than 5s (configurable via `AITRI_HUB_REMOTE_REFRESH_MS`, default 60s)

  Acceptance: Hub's monitor shows updated status for a GitHub project within 2 poll cycles of an `aitri approve` pushed to the repo.

---

### Ecosystem — Aitri Graph

- [x] P3 — **Graph: project registry from config file** *(implemented — ~/.aitri-graph/projects.json, GET/POST/DELETE /api/registry)* — Graph currently requires the user to add projects via the UI each session. There is no persistence between browser sessions beyond `localStorage`.

  Problem: Teams have to re-add projects every time. Multi-project use is friction-heavy.

  Files (Graph repo):
  - `server.js` — add `GET /api/registry` endpoint that reads `~/.aitri-graph/projects.json` (Graph-owned config)
  - `server.js` — add `POST /api/registry` to add a project (path or GitHub URL)
  - `js/sidebar.js` — on startup, call `/api/registry` and pre-populate sidebar
  - `js/app.js` — persist project list to server registry instead of only `localStorage`

  Behavior:
  - Server reads `~/.aitri-graph/projects.json` on startup; creates it if absent
  - UI on load fetches registry and renders all registered projects in sidebar
  - User can add a project (path or GitHub URL) via UI; server persists to registry
  - No changes to loader.js — local/GitHub loading already works

  Decisions:
  - Graph owns `~/.aitri-graph/` — no dependency on Aitri Core or Hub registries
  - `localStorage` can remain as fallback/cache for browser-only use without server

  Acceptance: Add a project in Graph UI → refresh browser → project still listed in sidebar.

- [x] P3 — **Graph: change detection polling for local projects** *(implemented — /api/project/status, 30s poll via sidebar.js, GitHub 60s poll)* — Graph loads artifacts on user request. It does not detect when a project's pipeline advances.

  Problem: A dev runs `aitri approve 1` and Graph still shows the old state until manually refreshed.

  Files (Graph repo):
  - `server.js` — add `GET /api/project/status?path=...` returning `{ updatedAt, currentPhase }` (lightweight poll endpoint)
  - `js/app.js` — poll `/api/project/status` every 30s for the active project; if `updatedAt` changed, reload artifacts and re-render graph
  - `js/graph.js` — support incremental re-render (update node states without full re-layout)

  Behavior:
  - Polling only for local projects (source `"local"`); GitHub projects continue on-demand
  - Poll interval: 30s default, configurable
  - If poll fails (server down): no error shown, polling continues silently

  Decisions:
  - Compare `updatedAt` from `.aitri` — same mechanism as Hub uses for local projects
  - Full artifact reload on change (not incremental artifact fetch) — simpler, acceptable latency

  Acceptance: Run `aitri approve 1` in terminal while Graph is open → within 30s the requirements nodes update to `approved` state without manual refresh.

---

### Core — Backlog management

- [ ] P3 — **`aitri backlog` command — project-level backlog management** — Aitri projects have no built-in way to track open work items. Today subproducts (Hub, Graph) each maintain their own `BACKLOG.md` manually with no tooling. A native `aitri backlog` command would give every Aitri project the same structured backlog experience.

  Problem: Teams using Aitri generate artifacts through the pipeline but have no canonical place to track "what's next" per project. Each team invents its own format. Subproducts that Aitri spawns (Hub, Graph, future) also have no backlog tooling at all.

  Proposed UX (to be designed before implementation):
  - `aitri backlog add` — interactively add an item (title, priority, problem, files, behavior, acceptance)
  - `aitri backlog list` — show open items (filterable by priority)
  - `aitri backlog done <id>` — mark item as closed (moves to CHANGELOG.md)
  - Storage: `spec/BACKLOG.json` (structured, readable by Hub/Graph/future tools) or `BACKLOG.md` (human-friendly, same format as Aitri's own backlog)

  Open design questions (decide before implementing):
  - JSON vs Markdown storage — JSON enables Hub alerts and Graph nodes; Markdown is human-editable without tooling
  - Scope: project-level only, or also feature-level (`features/<name>/BACKLOG.md`)?
  - Integration with artifact chain: does a backlog item trace to a FR/TC, or is it orthogonal?
  - Does `aitri status` surface open backlog items (count, top priority)?
  - Persona: does backlog management need a new persona or reuse PM?

  Decisions: None resolved. Needs design session before becoming an implementation item.

  Acceptance: TBD after design session.

---

### Ecosystem — Future Subproducts

> These are design seeds. Not implementation items. Expand to full entries before scheduling.

- [ ] P3 — **Aitri CI** — GitHub Actions integration that reads `.aitri` and fails the CI pipeline if any approved phase has drift (artifact modified after approval). Zero-dependency script that runs in a GitHub Actions step.

  Seed:
  - Single-file Node.js script (`aitri-ci-check.js`) — reads `.aitri`, runs `hasDrift()` logic, exits 1 if drift detected
  - GitHub Action step: `- run: node aitri-ci-check.js`
  - Optional: post a comment on the PR listing which phases have drift
  - No Aitri CLI required in CI — the script bundles its own `.aitri` reader

- [ ] P3 — **Aitri IDE (VSCode Extension)** — Shows current pipeline phase and drift alerts in the VSCode statusbar for any open project that has `.aitri`. Read-only. No execution of Aitri commands.

  Seed:
  - Extension watches `.aitri` via `fs.watch` and updates statusbar item
  - Shows: `Aitri: Phase 3 | Drift: 0` or `Aitri: Phase 2 ⚠ drift`
  - Click opens `aitri status` output in a new terminal
  - Published to VS Code Marketplace as `aitri-vscode`

- [ ] P3 — **Aitri Report** — Generates a PDF or HTML compliance report from `05_PROOF_OF_COMPLIANCE.json` + `01_REQUIREMENTS.json`. Targeted at delivering audit evidence to clients or stakeholders.

  Seed:
  - CLI tool: `aitri-report generate --project <path> --output report.html`
  - Template-based HTML (no headless browser) — printable via browser's native PDF export
  - Sections: Executive Summary, FR Coverage Table, Test Results, Rejections Log, Approval Timeline
  - Reads only from `spec/` and `.aitri` — no modifications to project

- [ ] P3 — **Aitri Audit** — Cross-project event aggregator. Reads `events[]` from N registered projects and produces a unified timeline of approvals, rejections, and drift events. Useful for teams managing multiple product pipelines.

  Seed:
  - CLI tool: `aitri-audit timeline --projects <dir>`
  - Scans all directories under `<dir>` for `.aitri` files
  - Merges and sorts `events[]` arrays chronologically
  - Output: terminal table or JSON export
  - No state — purely reads and aggregates existing data

- [ ] P3 — **`IDEA.md` y `ADOPTION_SCAN.md` en raíz del proyecto del usuario** — Ambos archivos quedan en la raíz tras `adopt scan`, contaminando el directorio del usuario y exponiéndolos a borrado accidental.

  Problem: La raíz del proyecto del usuario no es el lugar correcto para archivos generados por Aitri. El usuario los puede borrar por error o confundirlos con sus propios archivos. Además, `spec/` ya existe como carpeta de artefactos — semánticamente `IDEA.md` pertenece ahí.

  Files:
  - `lib/commands/adopt.js` — cambiar paths de escritura de `path.join(dir, 'IDEA.md')` y `ADOPTION_SCAN.md` a `path.join(dir, 'spec', ...)`; crear `spec/` en `adoptScan` en lugar de solo en `adoptApply`
  - `lib/commands/run-phase.js` — línea 68: cambiar `adir = ''` por `adir = artifactsDir` para `IDEA.md`
  - `templates/adopt/scan.md` — actualizar paths de output (`{{PROJECT_DIR}}/spec/IDEA.md`, `{{PROJECT_DIR}}/spec/ADOPTION_SCAN.md`)
  - `test/smoke.js` — actualizar smoke tests que verifican presencia de `IDEA.md` en raíz

  Behavior:
  - `adopt scan` crea `spec/` si no existe, escribe `spec/IDEA.md` y `spec/ADOPTION_SCAN.md`
  - `run-phase 1/2/discovery` busca `IDEA.md` en `spec/` (vía `artifactsDir`)
  - `adopt apply` asume `spec/IDEA.md`

  Decisions:
  - **Defer to v0.2.0 como breaking change explícito** (decidido 2026-03-17): sin dual-path fallback — añadiría deuda permanente en run-phase.js. En v0.2.0: el usuario mueve IDEA.md manualmente o Aitri detecta el archivo en raíz y aborta con instrucción clara.
  - `ADOPTION_SCAN.md` también se mueve — mismo grupo semántico, bajo riesgo individual (solo written by agent, never read by code)

  Acceptance:
  - `adopt scan` en proyecto nuevo: `IDEA.md` y `ADOPTION_SCAN.md` aparecen en `spec/`, no en raíz
  - `run-phase 1` en proyecto con `spec/IDEA.md`: funciona sin advertencia
  - Proyecto legacy con `IDEA.md` en raíz: Aitri aborta con instrucción de migración explícita
  - Smoke tests pasan con 0 failures

---

## Design Studies

> Not implementation items. Open questions that inform future architectural decisions.

### Calidad semántica de artifacts

Aitri valida la *estructura* de los artifacts (schema, campos requeridos, conteos mínimos) pero no su *calidad semántica*. Un agente puede producir `01_REQUIREMENTS.json` con 5 FRs técnicamente válidos pero conceptualmente triviales, genéricos, o desconectados del problema real descrito en IDEA.md.

**Pregunta abierta:** ¿Hasta dónde debe llegar Aitri en validar calidad semántica?

Ejemplos de lo que no se valida hoy:
- FR.title de "La app debe funcionar correctamente" pasa validación
- Acceptance criteria copiados entre FRs sin diferenciación
- System design que ignora los NFRs de Phase 1
- Test cases que no ejercen los acceptance criteria (Three Amigos gate cubre ac_id cross-reference, pero no la relevancia del test)

Opciones:
1. Heurísticas de calidad en `validate()` (longitud mínima de títulos, diversidad de ACs, detección de duplicados)
2. Phase de revisión cruzada entre artifacts
3. Dejar la calidad 100% al humano — gates solo verifican estructura

**Criterio de decisión:** No introducir complejidad que genere falsos positivos. Un validator que rechaza artifacts buenos es peor que uno que acepta artifacts mediocres.

---

## Discarded

Items analyzed and explicitly rejected.

| Item | Decision | Reason |
| :--- | :--- | :--- |
| Mutation testing | Discarded indefinitely | Violates zero-dep principle. `verify-run --assertion-density` covers 60% of the same problem at zero cost. Option B (globally-installed stryker) introduces implicit env dependency — worse than explicit dep. ROI does not justify. |
