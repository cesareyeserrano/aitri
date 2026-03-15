# Aitri ↔ Aitri Hub — Integration Contract

**Versión Aitri:** v0.1.51+
**Responsable:** Este documento es la fuente de verdad del schema que Aitri Hub debe leer.
**Regla de mantenimiento:** Cada vez que se modifique el schema de `.aitri` en Aitri, este documento debe actualizarse en el mismo commit. Hub debe consultar este documento antes de cambiar cualquier reader o alert rule que dependa de datos de Aitri.

---

## Qué puede leer Hub

Hub es **read-only**. Solo lee; nunca escribe en directorios de proyectos ni en `.aitri`.

Hub puede leer estas fuentes en cada proyecto registrado:

| Fuente | Ruta | Lector |
|---|---|---|
| Estado del pipeline | `<project>/.aitri` | `aitri-reader.js` |
| Config Hub | `<project>/.aitri` (si es directorio: `<project>/.aitri/config.json`) | `aitri-reader.js` |
| Artifacts del pipeline | `<project>/spec/` o `<project>/` (depende de `artifactsDir`) | readers individuales |
| Estado de tests | `<project>/spec/04_TEST_RESULTS.json` | `test-reader.js` |
| Compliance | `<project>/spec/05_PROOF_OF_COMPLIANCE.json` | `compliance-reader.js` |
| Historial git | `.git/` del proyecto | `git-reader.js` |

---

## Schema de `.aitri`

`.aitri` es un archivo JSON plano. En proyectos nuevos (Aitri ≥ v0.1.20), puede existir como directorio `.aitri/` con el config en `.aitri/config.json`. Hub debe detectar ambos:

```js
// Pseudo-código Hub reader
const p = path.join(projectDir, '.aitri');
const configPath = fs.statSync(p).isDirectory()
  ? path.join(p, 'config.json')
  : p;
```

### Campos garantizados (todos los proyectos Aitri)

| Campo | Tipo | Default si ausente | Descripción |
|---|---|---|---|
| `currentPhase` | `number` | `0` | Fase activa actualmente (0 = sin iniciar) |
| `approvedPhases` | `array<number\|string>` | `[]` | Fases aprobadas por humano (pueden incluir `"discovery"`, `"ux"`) |
| `completedPhases` | `array<number\|string>` | `[]` | Fases completadas (agente terminó; pendiente aprobación) |
| `updatedAt` | `string` (ISO 8601) | `null` | Timestamp del último `saveConfig` |

### Campos presentes en proyectos inicializados con `aitri init`

| Campo | Tipo | Default si ausente | Descripción |
|---|---|---|---|
| `projectName` | `string` | `path.basename(dir)` | Nombre del proyecto |
| `createdAt` | `string` (ISO 8601) | `null` | Timestamp de `aitri init` |
| `aitriVersion` | `string` | `null` | Versión de Aitri usada al inicializar o hacer upgrade |
| `artifactsDir` | `string` | `""` | Subdirectorio donde viven los artifacts (`"spec"` para proyectos nuevos; `""` para proyectos adoptados o pre-v0.1.20) |

### Campos opcionales (presentes según actividad del pipeline)

| Campo | Tipo | Default si ausente | Descripción |
|---|---|---|---|
| `artifactHashes` | `object<string, string>` | `{}` | Mapa `{ "1": "<sha256>", "2": "<sha256>", ... }` — hash sha256 del artifact al momento de aprobación |
| `events` | `array<Event>` | `[]` | Log de actividad del pipeline (máx. 20 eventos, más reciente al final) |

#### Schema de `Event`

```json
{
  "at": "2025-11-01T14:23:00.000Z",
  "event": "completed",
  "phase": 1,
  "feedback": "optional — only on rejected events"
}
```

Valores válidos de `event.event`: `"completed"`, `"approved"`, `"rejected"`

---

## Cómo detectar drift (cambios post-aprobación)

Drift ocurre cuando un artifact aprobado fue modificado después de la aprobación.
**Hub debe calcular drift dinámicamente** — no hay campo `hasDrift` en `.aitri`.

```js
// Pseudo-código: detectar drift para una fase
function hasDrift(projectDir, config, phaseKey) {
  const stored = (config.artifactHashes || {})[String(phaseKey)];
  if (!stored) return false;             // fase sin hash = nunca aprobada = no hay drift
  const artifactFile = ARTIFACT_MAP[phaseKey];  // e.g. "01_REQUIREMENTS.json"
  const base = config.artifactsDir || '';
  const full = base ? path.join(projectDir, base, artifactFile) : path.join(projectDir, artifactFile);
  try {
    const content = fs.readFileSync(full, 'utf8');
    return sha256(content) !== stored;
  } catch { return false; }
}
```

Mapa de phases → artifacts (`ARTIFACT_MAP`):

```json
{
  "discovery": "00_DISCOVERY.md",
  "ux":        "01_UX_SPEC.md",
  "1":         "01_REQUIREMENTS.json",
  "2":         "02_SYSTEM_DESIGN.md",
  "3":         "03_TEST_CASES.json",
  "4":         "04_IMPLEMENTATION_MANIFEST.json",
  "4r":        "04_CODE_REVIEW.md",
  "5":         "05_PROOF_OF_COMPLIANCE.json"
}
```

---

## Backward compatibility

Hub **debe ser defensivo** con todos los campos — un proyecto viejo puede no tener todos los campos.
Usar el valor default de la tabla anterior cuando un campo está ausente.
`loadConfig` de Aitri aplica esta misma lógica internamente con `{ ...DEFAULTS, ...raw }`.

Los proyectos que corran `aitri adopt --upgrade` recibirán los campos faltantes escritos al disco automáticamente. Aitri también re-registrará el proyecto en Hub si Hub está instalado pero el proyecto no estaba registrado.

---

## Registro en Hub (`~/.aitri-hub/projects.json`)

`aitri init` y `aitri adopt --upgrade` registran automáticamente el proyecto en Hub si Hub está instalado.
Schema de cada entrada en `projects.json`:

```json
{
  "id": "<8 chars hex>",
  "name": "<projectName, max 40 chars>",
  "location": "/absolute/path/to/project",
  "type": "local",
  "addedAt": "2025-11-01T14:00:00.000Z"
}
```

Hub no debe asumir que todos los proyectos en `projects.json` tienen `.aitri` — el proyecto puede haber sido borrado o movido. Manejar gracefully con un error de "proyecto no encontrado".

---

## Qué NO hace Aitri por Hub

- Aitri no arranca Hub ni ejecuta comandos de Hub
- Aitri no depende de Hub para funcionar
- Aitri no escribe en `~/.aitri-hub/dashboard.json` ni en ningún otro archivo de Hub
- Aitri no envía eventos a Hub — Hub hace polling de los archivos de proyecto directamente

---

## Historial de cambios al contrato

| Versión Aitri | Cambio |
|---|---|
| v0.1.51 | Documento inicial. Campos `artifactHashes`, `events`, `artifactsDir` formalizados. Comportamiento de drift documentado. |
| v0.1.46 | `aitri init` auto-registra proyectos en Hub si Hub está instalado |
| v0.1.45 | Campo `events` añadido al schema (pipeline activity log) |
