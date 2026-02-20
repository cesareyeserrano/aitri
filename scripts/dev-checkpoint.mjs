import fs from "node:fs";
import path from "node:path";

const CHECKPOINT_FILE = ".aitri/DEV_STATE.md";
const EVOLUTION_BACKLOG = "backlog/aitri-core/evolution.md";

async function updateCheckpoint() {
  const message = process.argv.slice(2).join(" ") || "No message provided.";
  const timestamp = new Date().toISOString();
  
  if (!fs.existsSync(".aitri")) {
    fs.mkdirSync(".aitri");
  }

  let content = "";
  if (fs.existsSync(CHECKPOINT_FILE)) {
    content = fs.readFileSync(CHECKPOINT_FILE, "utf8");
  }

  // Simple update logic: replace or append to "Active State" or "Working Memory"
  const newContent = content.replace(
    /> LAST UPDATE: .*/,
    `> LAST UPDATE: ${timestamp}`
  ).replace(
    /## 🧠 Working Memory \(Context\)\n([\s\S]*?)(?=\n##|$)/g,
    `## 🧠 Working Memory (Context)\n- ${message}\n`
  );

  fs.writeFileSync(CHECKPOINT_FILE, newContent || generateInitialCheckpoint(message, timestamp), "utf8");
  console.log(`Checkpoint updated: ${timestamp}`);
}

function generateInitialCheckpoint(message, timestamp) {
  return `# Aitri Development Checkpoint
> LAST UPDATE: ${timestamp}
> AGENT: Developer/Agent

## 🎯 Current Objective
[EVO-META] Self-Evolution System Implementation.

## 🧠 Working Memory (Context)
- ${message}

## 🚧 Active State
- [x] Test drive journey completed.
- [x] Feedback documented in docs/feedback/TEST_DRIVE_FEEDBACK.md.
- [x] Evolution backlog updated with EVO-005 to EVO-007.

## 🛑 Blockers / Errors
None.

## ⏭️ Next Immediate Action
Review evolution backlog for technical implementation of EVO-005.
`;
}

updateCheckpoint().catch(console.error);
