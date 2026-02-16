# File Growth Policy

## Purpose
Control source and test file growth before maintainability debt becomes expensive.

## Budget Source of Truth
- Budget file: `docs/quality/file-size-budgets.json`
- Check script: `scripts/check-file-growth.mjs`

## Policy Levels
- `ok`: file line count is at or below the soft threshold.
- `warn`: file line count is above soft threshold but at or below hard threshold.
- `block`: file line count is above hard threshold, file is missing, or budget entry is invalid.

## Local Contributor Workflow
1. Run warning report:
   - `npm run check:file-growth`
2. Run strict blocking check:
   - `npm run check:file-growth:strict`
3. Optional machine-readable report:
   - `npm run check:file-growth -- --json`

## CI Warning and Block Policy (Defined)
Use two check modes in CI:
1. Warning job (non-blocking):
   - Run `npm run check:file-growth`
   - Publish report in job logs/artifacts for reviewer visibility.
2. Blocking gate (required):
   - Run `npm run check:file-growth:strict`
   - Fail when any file crosses hard threshold or budget definitions are invalid.

Soft-threshold overruns are allowed only with an explicit maintainability rationale in PR/commit notes and a follow-up modularization plan.

## Updating Budgets
Adjust `docs/quality/file-size-budgets.json` only when:
- a split has already happened, or
- growth is intentional and documented with a bounded follow-up to reduce size.

Do not increase hard thresholds as a first response to growth.
