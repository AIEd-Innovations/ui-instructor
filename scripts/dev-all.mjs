#!/usr/bin/env node
// Start the whole instructor stack locally with one command:
//   npm run dev:setup   one time: create a virtualenv in each agent repo and install its requirements
//   npm run dev:all     start the Curriculum Designer, the Assessment Agent and the UI together
//
// It expects the agent repos checked out next to this one:
//   seniorproject/ui-instructor  seniorproject/curriculum-designer  seniorproject/assessment_agent
// Override locations with CURRICULUM_DESIGNER_DIR / ASSESSMENT_AGENT_DIR, and the Python used with
// CURRICULUM_PYTHON / ASSESSMENT_PYTHON. Skip a service with --no-curriculum or --no-assessment.
//
// Everything runs offline: the Curriculum Designer in mock mode with the in-memory store, the Assessment
// Agent with its fake LLM provider and seed data. Any variable you already set in your shell wins.

import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const UI_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const IS_WINDOWS = process.platform === 'win32';
const args = process.argv.slice(2);

const CURRICULUM_PORT = Number(process.env.CURRICULUM_PORT ?? 8003);
const ASSESSMENT_PORT = Number(process.env.ASSESSMENT_PORT ?? 8000);

const services = {
  curriculum: {
    label: 'curriculum',
    dir: resolve(process.env.CURRICULUM_DESIGNER_DIR ?? join(UI_DIR, '..', 'curriculum-designer')),
    pythonOverride: process.env.CURRICULUM_PYTHON,
    port: CURRICULUM_PORT,
    app: 'main:app',
    skip: args.includes('--no-curriculum'),
    // Nothing imports aieic-shared and it is installed from a git URL, which fails on machines without
    // access to it; leave it out of the local install.
    dropFromRequirements: /aieic-shared/,
  },
  assessment: {
    label: 'assessment',
    dir: resolve(process.env.ASSESSMENT_AGENT_DIR ?? join(UI_DIR, '..', 'assessment_agent')),
    pythonOverride: process.env.ASSESSMENT_PYTHON,
    port: ASSESSMENT_PORT,
    app: 'run:app',
    skip: args.includes('--no-assessment'),
  },
};

const log = (label, message) => console.log(`[${label}] ${message}`);
const fail = message => {
  console.error(`\nERROR: ${message}\n`);
  process.exit(1);
};

function venvPython(dir) {
  return IS_WINDOWS ? join(dir, '.venv', 'Scripts', 'python.exe') : join(dir, '.venv', 'bin', 'python');
}

function pythonFor(service) {
  const python = service.pythonOverride ?? venvPython(service.dir);
  if (!existsSync(python)) {
    fail(
      `No Python found for the ${service.label} service (looked for ${python}).\n` +
        'Run `npm run dev:setup` once, or point CURRICULUM_PYTHON / ASSESSMENT_PYTHON at a Python that has the requirements installed.',
    );
  }
  return python;
}

function checkRepo(service) {
  if (!existsSync(service.dir)) {
    fail(
      `The ${service.label} repo was not found at ${service.dir}.\n` +
        'Clone it next to this repo, or set CURRICULUM_DESIGNER_DIR / ASSESSMENT_AGENT_DIR.',
    );
  }
}

// ── setup ───────────────────────────────────────────────────────────────────

function setup() {
  const systemPython = IS_WINDOWS ? 'python' : 'python3';
  for (const service of Object.values(services)) {
    if (service.skip) continue;
    checkRepo(service);
    const python = venvPython(service.dir);

    if (!existsSync(python)) {
      log(service.label, `creating a virtualenv in ${join(service.dir, '.venv')}`);
      const made = spawnSync(systemPython, ['-m', 'venv', '.venv'], { cwd: service.dir, stdio: 'inherit' });
      if (made.status !== 0) fail(`Could not create a virtualenv for ${service.label} (is ${systemPython} installed?).`);
    }

    let requirements = join(service.dir, 'requirements.txt');
    if (service.dropFromRequirements) {
      const kept = readFileSync(requirements, 'utf8')
        .split('\n')
        .filter(line => !service.dropFromRequirements.test(line));
      requirements = join(mkdtempSync(join(tmpdir(), 'dev-all-')), 'requirements.txt');
      writeFileSync(requirements, kept.join('\n'));
    }

    log(service.label, 'installing requirements (this can take a minute)');
    const installed = spawnSync(python, ['-m', 'pip', 'install', '-q', '-r', requirements], {
      cwd: service.dir,
      stdio: 'inherit',
    });
    if (installed.status !== 0) fail(`pip install failed for ${service.label}.`);
  }
  console.log('\nSetup done. Next: npm install (if you have not), then npm run dev:all');
}

if (args[0] === 'setup') {
  setup();
  process.exit(0);
}

// ── start ───────────────────────────────────────────────────────────────────

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\nStopping everything…');
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  // Anything still alive after a few seconds gets killed outright.
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill('SIGKILL');
    process.exit(code);
  }, 3000).unref();
  const timer = setInterval(() => {
    if (children.every(child => child.exitCode !== null)) {
      clearInterval(timer);
      process.exit(code);
    }
  }, 100);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function start(label, command, commandArgs, options) {
  const child = spawn(command, commandArgs, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  const forward = stream => {
    let pending = '';
    stream.on('data', chunk => {
      pending += chunk.toString();
      const lines = pending.split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) if (line.trim() !== '') log(label, line);
    });
  };
  forward(child.stdout);
  forward(child.stderr);
  child.on('exit', (exitCode, signal) => {
    if (shuttingDown) return;
    console.error(`\n[${label}] exited unexpectedly (${signal ?? `code ${exitCode}`}); stopping the rest.`);
    shutdown(1);
  });
  return child;
}

function portInUse(port) {
  return new Promise(resolveFn => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolveFn(true); });
    socket.once('error', () => resolveFn(false));
  });
}

async function waitForHealth(label, port, seconds = 90) {
  const deadline = Date.now() + seconds * 1000;
  while (Date.now() < deadline && !shuttingDown) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise(r => setTimeout(r, 500));
  }
  log(label, `did not become healthy within ${seconds}s`);
  return false;
}

const urls = {};

async function startService(service) {
  checkRepo(service);
  const python = pythonFor(service);
  if (await portInUse(service.port)) {
    fail(`Port ${service.port} is already in use, so the ${service.label} service cannot start. Stop whatever is using it, or set ${service.label === 'curriculum' ? 'CURRICULUM_PORT' : 'ASSESSMENT_PORT'}.`);
  }

  const env = { ...process.env };
  if (service.label === 'curriculum') {
    env.LLM_BACKEND ??= 'mock';
    env.STORAGE_BACKEND ??= 'memory';
  } else {
    const hasFake = existsSync(join(service.dir, 'assessment_agent', 'llm', 'fake.py'));
    if (!env.DEFAULT_LLM_PROVIDER) {
      if (hasFake) {
        env.DEFAULT_LLM_PROVIDER = 'fake';
      } else {
        log(
          service.label,
          'WARNING: this checkout has no offline "fake" LLM provider yet (assessment_agent PR #7), so the default provider ' +
            '(the claude CLI) is used and grading will not work offline. Set DEFAULT_LLM_PROVIDER yourself or use --no-assessment.',
        );
      }
    }
    env.CORS_ORIGINS ??= 'http://localhost:5173,http://127.0.0.1:5173';
    // Give the Student Submissions tab something to show, without touching real results.
    const results = join(service.dir, 'assessment_results.json');
    const seed = join(service.dir, 'demo', 'seed_results.json');
    if (!env.DATA_DIR && !existsSync(results) && existsSync(seed)) {
      copyFileSync(seed, results);
      log(service.label, 'copied demo/seed_results.json to assessment_results.json (sample students)');
    }
  }

  log(service.label, `starting on http://localhost:${service.port} (${service.dir})`);
  start(service.label, python, ['-m', 'uvicorn', service.app, '--host', '127.0.0.1', '--port', String(service.port)], {
    cwd: service.dir,
    env,
  });
  const healthy = await waitForHealth(service.label, service.port);
  if (!healthy) fail(`The ${service.label} service did not start. Check its output above.`);
  urls[service.label] = `http://localhost:${service.port}`;
}

async function main() {
  if (!existsSync(join(UI_DIR, 'node_modules'))) fail('Run `npm install` first.');

  for (const service of Object.values(services)) {
    if (!service.skip) await startService(service);
  }

  const env = { ...process.env };
  if (urls.curriculum) env.VITE_CURRICULUM_URL ??= urls.curriculum;
  if (urls.assessment) env.VITE_ASSESSMENT_URL ??= urls.assessment;

  log('ui', 'starting the Vite dev server');
  const vite = join(UI_DIR, 'node_modules', 'vite', 'bin', 'vite.js');
  start('ui', process.execPath, [vite], { cwd: UI_DIR, env });

  console.log('\n──────────────────────────────────────────────');
  console.log(' UI (look for the Local: line above):  http://localhost:5173');
  if (urls.curriculum) console.log(` Curriculum Designer:  ${urls.curriculum}  (API docs: ${urls.curriculum}/docs)`);
  if (urls.assessment) console.log(` Assessment Agent:     ${urls.assessment}  (API docs: ${urls.assessment}/docs)`);
  console.log(' Press Ctrl+C to stop everything.');
  console.log('──────────────────────────────────────────────\n');
}

main().catch(error => {
  console.error(error);
  shutdown(1);
});
