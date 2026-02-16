import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

function detectRunner(pkg) {
  const raw = String(pkg?.packageManager || "").toLowerCase();
  if (raw.startsWith("pnpm@")) return "pnpm";
  if (raw.startsWith("yarn@")) return "yarn";
  if (raw.startsWith("bun@")) return "bun";
  return "npm";
}

function toScriptCommand(runner, scriptName) {
  if (runner === "yarn") return [runner, scriptName];
  return [runner, "run", scriptName];
}

function isWebScript(text) {
  return /\b(vite|next|react-scripts|webpack|astro|nuxt|svelte|parcel|storybook|serve|http-server|frontend|web)\b/i.test(
    String(text || "")
  );
}

function detectPreviewCandidate(root) {
  const packageFile = path.join(root, "package.json");
  if (fs.existsSync(packageFile)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageFile, "utf8"));
      const scripts = pkg && typeof pkg.scripts === "object" ? pkg.scripts : {};
      const runner = detectRunner(pkg);

      if (typeof scripts.preview === "string" && scripts.preview.trim()) {
        return {
          kind: "script",
          reason: "package.json script `preview`",
          commandArgs: toScriptCommand(runner, "preview")
        };
      }
      if (typeof scripts.dev === "string" && scripts.dev.trim() && isWebScript(scripts.dev)) {
        return {
          kind: "script",
          reason: "package.json script `dev` (web-like)",
          commandArgs: toScriptCommand(runner, "dev")
        };
      }
      if (typeof scripts.start === "string" && scripts.start.trim() && isWebScript(scripts.start)) {
        return {
          kind: "script",
          reason: "package.json script `start` (web-like)",
          commandArgs: toScriptCommand(runner, "start")
        };
      }
    } catch {
      // ignore invalid package.json here; dashboard flow should still continue
    }
  }

  const staticCandidates = [
    "web/index.html",
    "public/index.html",
    "dist/index.html"
  ];
  const found = staticCandidates.find((rel) => fs.existsSync(path.join(root, rel)));
  if (found) {
    const port = Number.parseInt(process.env.AITRI_PREVIEW_PORT || "", 10) || 4173;
    return {
      kind: "static",
      reason: `static entry \`${found}\``,
      port,
      file: found,
      url: `http://127.0.0.1:${port}/${found.replace(/\\/g, "/")}`
    };
  }

  return null;
}

function openUrl(url) {
  if (process.platform === "darwin") {
    return spawnSync("open", [url], { stdio: "ignore" }).status === 0;
  }
  if (process.platform === "win32") {
    return spawnSync("cmd", ["/c", "start", "", url], { stdio: "ignore", shell: true }).status === 0;
  }
  return spawnSync("xdg-open", [url], { stdio: "ignore" }).status === 0;
}

function commandString(commandArgs) {
  return commandArgs.map((part) => (/\s/.test(part) ? JSON.stringify(part) : part)).join(" ");
}

function hasRuntime(command) {
  const check = spawnSync(command, ["--version"], { stdio: "ignore" });
  return check.status === 0;
}

function startStaticPreview(candidate, root) {
  const runtime = hasRuntime("python3") ? "python3" : (hasRuntime("python") ? "python" : null);
  if (!runtime) {
    console.log("- Live preview launcher not available: python runtime not found.");
    console.log(`- Run manually if available: python3 -m http.server ${candidate.port}`);
    return;
  }

  const child = spawn(runtime, ["-m", "http.server", String(candidate.port), "--bind", "127.0.0.1"], {
    cwd: root,
    detached: true,
    stdio: "ignore"
  });
  child.unref();

  const opened = openUrl(candidate.url);
  console.log(`- Live preview running in background (pid: ${child.pid || "unknown"}).`);
  console.log(`- URL: ${candidate.url}`);
  if (!opened) {
    console.log("- Browser auto-open failed. Open the URL manually.");
  }
}

export async function runCompletionGuide({
  report,
  root,
  cliPath,
  confirmYesNo,
  baseCode
}) {
  console.log("- Workflow complete: delivery gate already reached SHIP.");
  if (report.factory?.deliveryReport) {
    console.log(`- Delivery report: ${report.factory.deliveryReport}`);
  }
  if (report.factory?.deliveryDecision) {
    console.log(`- Decision: ${report.factory.deliveryDecision}`);
  }

  // Always generate and auto-open dashboard on delivery completion.
  spawnSync(process.execPath, [cliPath, "status", "--ui"], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env }
  });

  const candidate = detectPreviewCandidate(root);
  if (!candidate) {
    console.log("- Live product preview: no local web preview detected for this project.");
    return baseCode;
  }

  console.log(`- Live product preview available via ${candidate.reason}.`);
  const launchNow = await confirmYesNo("Would you like to launch a live local preview now? (Y/n): ", true);
  if (!launchNow) {
    if (candidate.kind === "script") {
      console.log(`- Run later: ${commandString(candidate.commandArgs)}`);
    } else {
      console.log(`- Run later: python3 -m http.server ${candidate.port} (open ${candidate.url})`);
    }
    return baseCode;
  }

  if (candidate.kind === "script") {
    console.log(`Starting preview command: ${commandString(candidate.commandArgs)}`);
    console.log("Stop it with Ctrl+C when you finish reviewing.");
    const run = spawnSync(candidate.commandArgs[0], candidate.commandArgs.slice(1), {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env }
    });
    if (run.error instanceof Error) {
      console.log(`- Preview command failed to start: ${run.error.message}`);
    } else if (typeof run.status === "number" && run.status !== 0 && run.status !== 130) {
      console.log(`- Preview command exited with code ${run.status}.`);
    }
    return baseCode;
  }

  startStaticPreview(candidate, root);
  return baseCode;
}
