# Aitri Self-Evolution Workflow (The "Relay" Protocol)

## Purpose
This document defines the workflow for Agents (AI) and Developers contributing to the Aitri codebase. The goal is to ensure **zero context loss** between sessions, allowing any entity to pick up development exactly where the previous one left off.

## 1. The Components

### 1.1. The Evolution Backlog (`backlog/aitri-core/evolution.md`)
This file is the **Long-Term Memory** of the project's roadmap. It tracks architectural improvements, refactors, and features derived from feedback.

**Rule:** No code is written unless it maps to an item in this backlog.

### 1.2. The Development Checkpoint (`.aitri/DEV_STATE.md`)
This file is the **Short-Term Memory (RAM)** of the current active session. It is the "Save Game" slot.

**Rule:**
1.  **Read First:** Upon activation, an Agent MUST read this file to understand the current state.
2.  **Write Last:** Before ending a turn or session, an Agent MUST update this file with the latest status, specifically the "Next Immediate Action".

## 2. The Workflow

### Step 1: Ingest Feedback
When `aitri feedback` or manual review generates new insights (e.g., in `docs/feedback/`), these are parsed and added to `backlog/aitri-core/evolution.md` as new items with a status of `TODO`.

### Step 2: Pick & Check-in
The Agent selects an item from `evolution.md`.
It updates `.aitri/DEV_STATE.md`:
- **Current Objective:** [EVO-XXX] Title
- **Status:** Starting...

### Step 3: Iterate & Checkpoint
During the coding cycle (Plan -> Act -> Verify):
- If a test fails, update `DEV_STATE.md` with the error context.
- If a file is created, log it in `DEV_STATE.md` under "Working Memory".

### Step 4: Completion & Sync
When the task is done and verified:
1.  Mark item as `DONE` in `backlog/aitri-core/evolution.md`.
2.  Clear/Reset `.aitri/DEV_STATE.md` for the next task.
3.  (Optional) Commit changes with the reference to the EVO item.

## 3. Checkpoint Schema

```markdown
# Aitri Development Checkpoint
> LAST UPDATE: [ISO Date]
> LAST AGENT: [Name/ID]

## 🎯 Current Objective
[Link to EVO-ID or brief description of the active task]

## 🧠 Working Memory (Context)
[List of modified files, key variable names, or architectural decisions made in this session]

## 🚧 Active State
- [ ] Code implemented
- [ ] Tests passing
- [ ] Docs updated

## 🛑 Blockers / Errors
[Paste critical error logs or logical blockers here]

## ⏭️ Next Immediate Action
[Precise instruction for the next agent: "Run npm test", "Fix line 40", etc.]
```

## 4. Recovery
If a session disconnects abruptly:
1.  The new Agent reads `.aitri/DEV_STATE.md`.
2.  It sees "Next Immediate Action".
3.  It validates the state (runs `git status`).
4.  It resumes execution immediately.
