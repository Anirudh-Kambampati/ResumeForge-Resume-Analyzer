// Runs the FastAPI backend and the Next.js frontend together.
// Usage (from the repo root): npm run dev:all
// Ctrl+C stops both. If either process exits, the other is stopped too.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const backendDir = path.join(root, "backend");
const frontendDir = path.join(root, "frontend");

// Prefer a backend virtualenv if one exists, else the Python on PATH.
function findPython() {
  const candidates = ["venv", ".venv"].map((dir) =>
    isWindows
      ? path.join(backendDir, dir, "Scripts", "python.exe")
      : path.join(backendDir, dir, "bin", "python"),
  );
  return candidates.find(existsSync) ?? (isWindows ? "python" : "python3");
}

const COLORS = { backend: "\x1b[36m", frontend: "\x1b[35m", reset: "\x1b[0m" };

const children = [];
let shuttingDown = false;

// `command` is an array (spawned directly) or a string (run through a shell,
// which Windows needs to resolve npm.cmd).
function run(name, command, cwd) {
  const [file, args, shell] = Array.isArray(command)
    ? [command[0], command.slice(1), false]
    : [command, [], true];
  const child = spawn(file, args, {
    cwd,
    shell,
    env: { ...process.env, FORCE_COLOR: "1", PYTHONUNBUFFERED: "1" },
  });
  const prefix = `${COLORS[name]}[${name}]${COLORS.reset} `;
  const pipe = (stream, out) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) out.write(prefix + line + "\n");
    });
    stream.on("end", () => buffer && out.write(prefix + buffer + "\n"));
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.log(`${prefix}exited (${signal ?? `code ${code}`}) — stopping the other process`);
      shutdown(code ?? 1);
    }
  });
  child.on("error", (err) => {
    console.error(`${prefix}failed to start: ${err.message}`);
    shutdown(1);
  });
  children.push(child);
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    if (isWindows) {
      // Kill the whole tree (shell → npm → next, python → uvicorn reloader)
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

run("backend", [findPython(), "-m", "uvicorn", "main:app", "--reload", "--port", "8000"], backendDir);
run("frontend", "npm run dev", frontendDir);
