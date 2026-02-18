import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function buildHtml(data) {
  const { features, stats, lastUpdated } = data;

  const rows = features.map(f => `
    <tr>
      <td>${escHtml(f.name)}</td>
      <td><span class="badge badge-${stateClass(f.state)}">${escHtml(f.state || "unknown")}</span></td>
      <td>${escHtml(f.version || "-")}</td>
      <td>${f.openFeedback > 0 ? `<span class="badge badge-warn">${f.openFeedback}</span>` : "0"}</td>
      <td>${escHtml(f.nextStep || "-")}</td>
    </tr>`).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Aitri — Project Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 2rem; }
    h1 { color: #ff7b00; font-size: 1.8rem; margin-bottom: 0.25rem; }
    .subtitle { color: #8b949e; font-size: 0.9rem; margin-bottom: 2rem; }
    .stats { display: flex; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .stat-card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 1rem 1.5rem; min-width: 140px; }
    .stat-card .val { font-size: 2rem; font-weight: bold; color: #ff7b00; }
    .stat-card .lbl { font-size: 0.8rem; color: #8b949e; margin-top: 0.25rem; }
    table { width: 100%; border-collapse: collapse; background: #161b22; border-radius: 8px; overflow: hidden; }
    th { background: #21262d; color: #8b949e; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.75rem 1rem; text-align: left; }
    td { padding: 0.75rem 1rem; border-top: 1px solid #21262d; font-size: 0.9rem; }
    tr:hover td { background: #1c2128; }
    .badge { display: inline-block; padding: 0.2em 0.6em; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .badge-approved { background: #1f6feb; color: #fff; }
    .badge-delivered { background: #238636; color: #fff; }
    .badge-draft { background: #30363d; color: #8b949e; }
    .badge-inprogress { background: #9e6a03; color: #fff; }
    .badge-warn { background: #da3633; color: #fff; }
    .badge-unknown { background: #30363d; color: #8b949e; }
    .footer { margin-top: 2rem; color: #484f58; font-size: 0.8rem; }
    h2 { color: #c9d1d9; font-size: 1.1rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>Aitri Project Dashboard</h1>
  <p class="subtitle">Last updated: ${escHtml(lastUpdated)}</p>

  <div class="stats">
    <div class="stat-card"><div class="val">${stats.total}</div><div class="lbl">Total Features</div></div>
    <div class="stat-card"><div class="val">${stats.delivered}</div><div class="lbl">Delivered</div></div>
    <div class="stat-card"><div class="val">${stats.inProgress}</div><div class="lbl">In Progress</div></div>
    <div class="stat-card"><div class="val">${stats.draft}</div><div class="lbl">Draft</div></div>
    <div class="stat-card"><div class="val">${stats.openFeedback}</div><div class="lbl">Open Feedback</div></div>
  </div>

  <h2>Features</h2>
  <table>
    <thead>
      <tr>
        <th>Feature</th>
        <th>State</th>
        <th>Version</th>
        <th>Feedback</th>
        <th>Next Step</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="text-align:center;color:#484f58">No features found. Run aitri draft to get started.</td></tr>'}
    </tbody>
  </table>

  <p class="footer">Aitri Dashboard — press Ctrl+C in the terminal to stop</p>
</body>
</html>`;
}

function escHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stateClass(state) {
  if (!state) return "unknown";
  const s = state.toLowerCase();
  if (s.includes("deliver") || s.includes("ship")) return "delivered";
  if (s.includes("approved")) return "approved";
  if (s.includes("draft")) return "draft";
  if (s.includes("progress") || s.includes("build") || s.includes("plan")) return "inprogress";
  return "unknown";
}

function loadDashboardData(project) {
  const cwd = process.cwd();

  // Try roadmap.json first
  const roadmapFile = path.join(project.paths.docsRoot, "roadmap.json");
  if (fs.existsSync(roadmapFile)) {
    try {
      const roadmap = JSON.parse(fs.readFileSync(roadmapFile, "utf8"));
      const features = Array.isArray(roadmap.features) ? roadmap.features : [];
      const stats = {
        total: features.length,
        delivered: features.filter(f => stateClass(f.state) === "delivered").length,
        inProgress: features.filter(f => stateClass(f.state) === "inprogress").length,
        draft: features.filter(f => stateClass(f.state) === "draft").length,
        openFeedback: features.reduce((sum, f) => sum + (f.openFeedback || 0), 0)
      };
      return { features, stats, lastUpdated: roadmap.generatedAt || new Date().toISOString() };
    } catch {
      // fall through to live scan
    }
  }

  // Live scan fallback
  const approvedDir = project.paths.specsApprovedDir;
  const draftDir = project.paths.specsDraftsDir;
  const features = [];

  function scanDir(dir, state) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
      if (f.endsWith(".md")) {
        const name = f.replace(/\.md$/, "");
        const feedbackFile = project.paths.feedbackFile(name);
        let openFeedback = 0;
        if (fs.existsSync(feedbackFile)) {
          try {
            const fb = JSON.parse(fs.readFileSync(feedbackFile, "utf8"));
            openFeedback = Array.isArray(fb.items)
              ? fb.items.filter(i => i.status === "open").length
              : 0;
          } catch { /* ignore */ }
        }
        features.push({ name, state, version: null, openFeedback, nextStep: null });
      }
    });
  }

  scanDir(approvedDir, "approved");
  scanDir(draftDir, "draft");

  const stats = {
    total: features.length,
    delivered: 0,
    inProgress: 0,
    draft: features.filter(f => f.state === "draft").length,
    openFeedback: features.reduce((sum, f) => sum + (f.openFeedback || 0), 0)
  };

  return { features, stats, lastUpdated: new Date().toISOString() };
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawnSync(cmd, [url], { detached: true, stdio: "ignore" });
}

export function runServeCommand({ options, getProjectContextOrExit, exitCodes }) {
  const { OK, ERROR } = exitCodes;
  const port = options.port || 4173;

  let project;
  try {
    project = getProjectContextOrExit();
  } catch {
    console.log("Failed to load project context.");
    return ERROR;
  }

  const server = http.createServer((req, res) => {
    const data = loadDashboardData(project);
    const html = buildHtml(data);
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache"
    });
    res.end(html);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.log(`Port ${port} is already in use. Use --port to specify a different port.`);
    } else {
      console.log(`Server error: ${err.message}`);
    }
    process.exit(ERROR);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://localhost:${port}`;
    console.log(`Aitri dashboard running at ${url} — press Ctrl+C to stop`);
    if (options.openUi !== false) {
      openBrowser(url);
    }
  });

  // Keep running — don't return until process exits
  process.on("SIGINT", () => {
    console.log("\nStopping dashboard server.");
    server.close(() => process.exit(OK));
  });

  // Return OK — exitWithFlow is called by index.js, but serve never reaches it normally
  return OK;
}
