#!/usr/bin/env node
/**
 * `pnpm run dev:all` — starts every service's dev server in one terminal,
 * each line prefixed with its service name. `knowledge-store` and
 * `mcp-server` start first and the rest wait for both `/health` endpoints
 * to respond before starting — CLAUDE.md's "start knowledge-store and
 * mcp-server first" rule, enforced instead of just documented. Skipping
 * this order is exactly what produced the real ECONNREFUSED-at-startup
 * race found live this session (orchestrator connecting to mcp-server
 * before it was actually listening).
 *
 * Plain Node (`spawn` + `fetch`), no new dependency — this repo already
 * requires Node 18+.
 */
import { spawn, exec } from 'node:child_process';

const RESET = '\x1b[0m';
const COLORS = {
  'knowledge-store': '\x1b[34m', // blue
  'mcp-server': '\x1b[32m', // green
  orchestrator: '\x1b[33m', // yellow
  scheduler: '\x1b[35m', // magenta
  'telegram-bot': '\x1b[36m', // cyan
  frontend: '\x1b[37m', // white
  'voice-assistant': '\x1b[31m', // red
};

const FOUNDATION = [
  { name: 'knowledge-store', script: 'dev:knowledge-store', healthUrl: 'http://localhost:30025/health' },
  { name: 'mcp-server', script: 'dev:mcp-server', healthUrl: 'http://localhost:30020/health' },
];
const DEPENDENTS = [
  { name: 'orchestrator', script: 'dev:orchestrator' },
  { name: 'scheduler', script: 'dev:scheduler' },
  { name: 'telegram-bot', script: 'dev:telegram-bot' },
  { name: 'frontend', script: 'dev:frontend' },
  { name: 'voice-assistant', script: 'dev:voice-assistant' },
];

const children = [];
let shuttingDown = false;

function prefix(name) {
  const color = COLORS[name] ?? '';
  return `${color}[${name}]${RESET}`;
}

function pipeLines(stream, name) {
  let buffer = '';
  stream.on('data', (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      console.log(`${prefix(name)} ${line}`);
    }
  });
}

function spawnService({ name, script }) {
  const child = spawn('pnpm', ['run', script], { shell: true });
  child.__serviceName = name;
  children.push(child);

  pipeLines(child.stdout, name);
  pipeLines(child.stderr, name);

  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${prefix(name)} exited with code ${code}`);
    }
  });

  return child;
}

async function waitForHealth(url, { timeoutMs = 60_000, intervalMs = 1000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not up yet, keep polling
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  console.log('Starting foundation services (knowledge-store, mcp-server)...\n');
  for (const svc of FOUNDATION) {
    spawnService(svc);
  }

  for (const svc of FOUNDATION) {
    const ok = await waitForHealth(svc.healthUrl);
    console.log(
      ok
        ? `${prefix(svc.name)} is healthy.`
        : `${prefix(svc.name)} did not respond healthy within 60s — starting the rest anyway.`,
    );
  }

  console.log('\nStarting orchestrator, scheduler, telegram-bot, frontend, voice-assistant...\n');
  for (const svc of DEPENDENTS) {
    spawnService(svc);
  }
}

function killTree(child) {
  if (process.platform === 'win32') {
    // pnpm/node --watch spawn child processes with their own PIDs on
    // Windows — plain child.kill() leaves them orphaned (same class of
    // issue CLAUDE.md's frontend section documents for `next dev`).
    exec(`taskkill /pid ${child.pid} /t /f`, () => {});
  } else {
    child.kill('SIGTERM');
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nShutting down all services...');
  for (const child of children) {
    killTree(child);
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main();
