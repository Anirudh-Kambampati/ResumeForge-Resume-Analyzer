// Runs the FastAPI backend and the Next.js frontend together.
// Usage (from the repo root): npm run dev:all
// Ctrl+C stops both. If either process exits, the other is stopped too.
//
// Before starting, checks that ports 8000 and 3000 are free. If something is
// listening on them, it lists the processes and asks before killing them.
// Pass --yes (npm run dev:all -- --yes) to kill them without asking.

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
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

// ------------------------------------------------------------
// Port check
// ------------------------------------------------------------

const PORTS = { backend: 8000, frontend: 3000 };
const autoYes = process.argv.includes("--yes") || process.argv.includes("-y");

/** PIDs listening on a TCP port. */
function listeningPids(port) {
  const pids = new Set();
  if (isWindows) {
    const out = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout ?? "";
    const v6 = spawnSync("netstat", ["-ano", "-p", "TCPv6"], { encoding: "utf8" }).stdout ?? "";
    for (const line of (out + "\n" + v6).split(/\r?\n/)) {
      // "  TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234"  (or [::]:3000)
      const m = line.match(/^\s*TCP\s+(?:\[[^\]]*\]|[\d.]+):(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && Number(m[1]) === port && m[2] !== "0") pids.add(Number(m[2]));
    }
  } else {
    const out = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], { encoding: "utf8" }).stdout ?? "";
    for (const pid of out.split(/\s+/).filter(Boolean)) pids.add(Number(pid));
  }
  return [...pids];
}

function processName(pid) {
  if (isWindows) {
    const out = spawnSync("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"], { encoding: "utf8" }).stdout ?? "";
    return out.match(/^"([^"]+)"/)?.[1] ?? "unknown";
  }
  return (spawnSync("ps", ["-p", String(pid), "-o", "comm="], { encoding: "utf8" }).stdout ?? "").trim() || "unknown";
}

function killPid(pid) {
  if (isWindows) {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Make sure both ports are free, asking before killing whatever holds them. */
async function freePorts() {
  const busy = Object.entries(PORTS)
    .map(([name, port]) => ({ name, port, pids: listeningPids(port) }))
    .filter((p) => p.pids.length > 0);
  if (busy.length === 0) return;

  console.log("These ports are already in use:");
  for (const { name, port, pids } of busy) {
    for (const pid of pids) console.log(`  ${port} (${name})  ←  ${processName(pid)}  pid ${pid}`);
  }

  let kill = autoYes;
  if (!kill) {
    if (!process.stdin.isTTY) {
      console.error("Stop them first, or run `npm run dev:all -- --yes` to kill them automatically.");
      process.exit(1);
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question("Kill these processes and continue? [y/N] ");
    rl.close();
    kill = /^y(es)?$/i.test(answer.trim());
  }
  if (!kill) {
    console.log("Not starting: ports are still in use.");
    process.exit(1);
  }

  for (const { pids } of busy) pids.forEach(killPid);

  // Give the OS a moment to release the sockets, then confirm
  for (let attempt = 0; attempt < 10; attempt++) {
    const still = busy.filter(({ port }) => listeningPids(port).length > 0);
    if (still.length === 0) {
      console.log("Ports freed.\n");
      return;
    }
    if (attempt === 5 && !isWindows) {
      still.forEach(({ port }) => listeningPids(port).forEach((pid) => {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // already gone
        }
      }));
    }
    await sleep(300);
  }
  const still = busy.filter(({ port }) => listeningPids(port).length > 0).map(({ port }) => port);
  console.error(`Couldn't free port(s) ${still.join(", ")}. They may belong to another user or need admin rights.`);
  process.exit(1);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

await freePorts();

run("backend", [findPython(), "-m", "uvicorn", "main:app", "--reload", "--port", String(PORTS.backend)], backendDir);
run("frontend", `npm run dev -- --port ${PORTS.frontend}`, frontendDir);
