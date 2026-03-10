/**
 * Module: Command — help
 * Purpose: Print usage, commands, phases, and workflow to stdout.
 */

export function cmdHelp({ VERSION }) {
  const steel = '\x1b[38;5;75m';
  const fire  = '\x1b[38;5;208m';
  const ember = '\x1b[38;5;166m';
  const dim   = '\x1b[2m';
  const reset = '\x1b[0m';

  console.log(`
${steel}   █████╗ ██╗████████╗██████╗ ██╗${reset}
${steel}  ██╔══██╗██║╚══██╔══╝██╔══██╗██║${reset}
${fire}  ███████║██║   ██║   ██████╔╝██║${reset}
${ember}  ██╔══██║██║   ██║   ██╔══██╗██║${reset}
${fire}  ██║  ██║██║   ██║   ██║  ██║██║${reset}
${steel}  ╚═╝  ╚═╝╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝${reset}

${fire}  ⚒  Spec-Driven Development Engine  v${VERSION}${reset}
${dim}  Idea → Spec → Tests → Code → Deploy${reset}
${steel}  Designed by César Augusto Reyes${reset}
`);

  console.log(`COMMANDS:
  aitri init                                    Initialize project (creates IDEA.md)
  aitri run-phase <1-5|ux|discovery>            Output phase briefing to stdout
  aitri run-phase <1-5|ux|discovery> --feedback Re-run with feedback
  aitri complete <1-5|ux|discovery>             Record artifact saved + validate
  aitri approve <1-5>                           Approve phase output
  aitri reject <1-5> --feedback ""              Reject with feedback
  aitri verify                                  Output test execution briefing
  aitri verify-complete                         Gate: all TCs pass + FR coverage → unlocks Phase 5
  aitri status                                  Show pipeline status
  aitri validate                                Validate all artifacts

PHASES:
  Optional — run before Phase 1:
  ◦ discovery  Problem Definition   → 00_DISCOVERY.md
  ◦ ux         UX/UI Specification  → 01_UX_SPEC.md

  Core pipeline:
  1. PM Analysis          → 01_REQUIREMENTS.json
  2. System Architecture  → 02_SYSTEM_DESIGN.md
  3. QA Test Design       → 03_TEST_CASES.json
  4. Implementation       → src/ + tests/ + 04_IMPLEMENTATION_MANIFEST.json
  ✦  VERIFY              → 04_TEST_RESULTS.json  (required gate before Phase 5)
  5. Deployment           → Dockerfile + docker-compose + 05_PROOF_OF_COMPLIANCE.json

WORKFLOW:
  1. aitri init                         (creates IDEA.md — fill it in)
  [optional] aitri run-phase discovery  (define problem, users, success criteria)
  [optional] aitri run-phase ux         (design screens before architecture)
  2. aitri run-phase 1                  (agent generates requirements)
  3. aitri complete 1                   (validates artifact + records)
  4. aitri approve 1                    (or: aitri reject 1 --feedback "...")
  5. Repeat 2-4 for phases 2-4
  6. aitri verify                       (agent runs tests → saves 04_TEST_RESULTS.json)
  7. aitri verify-complete              (gate: all tests pass + FR coverage confirmed)
  8. aitri run-phase 5                  (deployment — unlocked after verify)

AGENTS:
  Claude Code, Codex, Gemini Code, Opencode — any bash-capable agent
`);
}
