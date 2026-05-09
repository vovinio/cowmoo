#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = process.env.PROJECT_DIR;
const AGENT = 'builder';

// ── Territory — inverse list (builder writes everywhere EXCEPT these) ──
//
// Builder's territory is project code at repo root (anywhere outside cowmoo/)
// PLUS cowmoo/codebase/ and cowmoo/agent-files/builder/. The territoryCheck
// hook blocks Edit/Write to paths owned by other agents, shared public
// outputs of other agents, and the project config (set once at project initialization).
//
const FORBIDDEN = [
  'cowmoo/specs',
  'cowmoo/stack',
  'cowmoo/design',
  'cowmoo/agent-files/pm',
  'cowmoo/agent-files/planner',
  'cowmoo/agent-files/uxui',
  'cowmoo/config.json',
];
// ──────────────────────────────────────────────────────────────────────

// --- Utilities ---

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000, ...opts }).trim();
  } catch {
    return null;
  }
}

// --- Health Check ---

function healthCheck() {
  const issues = [];
  const notes = [];

  if (!PROJECT_DIR) issues.push('PROJECT_DIR not set. Launch via: moo builder');
  else {
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo/stack'))) issues.push('cowmoo/stack/ not found — tech decisions not available');
    // codebase.md is optional — only note if missing
    if (!fs.existsSync(path.join(PROJECT_DIR, 'cowmoo/codebase/codebase.md'))) {
      notes.push('codebase.md not yet mapped — run /map-codebase once the project has enough code worth documenting.');
    }
  }

  if (!run('command -v gh')) issues.push('gh CLI not found. Install: https://cli.github.com');

  if (issues.length > 0) {
    console.log('Health check:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
  if (notes.length > 0) {
    notes.forEach(n => console.log(`  note: ${n}`));
  }
}

// --- Session Start ---

function hookSessionStart() {
  healthCheck();

  if (!PROJECT_DIR) return;

  // In-progress task
  const inProgress = run('gh issue list --label "in-progress" --state open --json number,title --limit 5');
  if (inProgress) {
    try {
      const tasks = JSON.parse(inProgress);
      if (tasks.length > 0) {
        console.log(`\nIn progress: #${tasks[0].number} ${tasks[0].title}`);
        console.log('Resume with /start.');
        return;
      }
    } catch {}
  }

  // Todo and for-planner counts
  const todoCount = parseInt(run('gh issue list --label "todo" --state open --json number --jq "length"') || '0', 10);
  const forPlannerCount = parseInt(run('gh issue list --label "for-planner" --state open --json number --jq "length"') || '0', 10);

  if (todoCount > 0) {
    console.log(`\n${todoCount} task(s) ready. Run /start.`);
  } else {
    console.log('\nNo tasks ready.');
  }

  if (forPlannerCount > 0) {
    console.log(`${forPlannerCount} task(s) with planner.`);
  }
}

// --- Workflow Step Tracking ---

const SEQUENCE = ['start', 'build', 'review', 'publish'];
const UNTRACKED = new Set(['status', 'propose', 'playwright-cli', 'map-codebase']);
const ANYTIME = new Set(['return']);

function workflowPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo/agent-files/builder', '.workflow-step') : null;
}

function markStep(skill) {
  const p = workflowPath();
  if (!p) return;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${skill}:${new Date().toISOString()}`);
}

function readStep() {
  const p = workflowPath();
  if (!p || !fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p, 'utf8').trim();
  const sep = raw.indexOf(':');
  if (sep < 0) return null;
  const skill = raw.slice(0, sep);
  if (!skill) return null;
  return { skill };
}

function getNextSkill(lastSkill) {
  if (!lastSkill) return SEQUENCE[0];
  const idx = SEQUENCE.indexOf(lastSkill);
  if (idx < 0 || idx >= SEQUENCE.length - 1) return 'start';
  return SEQUENCE[idx + 1];
}

function workflowCheck(skill) {
  if (!PROJECT_DIR || !skill || UNTRACKED.has(skill)) return;
  if (ANYTIME.has(skill)) return;
  markStep(skill);
}

function nextStep() {
  if (!PROJECT_DIR) return;
  const last = readStep();
  const lastSkill = last ? last.skill : '';
  const next = getNextSkill(lastSkill || null);
  console.log(`last:${lastSkill}|next:${next}|flow:ongoing`);
}

// --- Git Check (PreToolUse hook) ---

function gitCheck() {
  const input = process.env.TOOL_INPUT;
  if (!input) return;
  let cmd;
  try { cmd = JSON.parse(input).command || ''; } catch { return; }

  const block = () => {
    console.log(JSON.stringify({ decision: 'block', reason: 'Use: git -C "$PROJECT_DIR" <command>' }));
  };

  const parts = cmd.split(/[;&|\n]+/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('git ') && !trimmed.startsWith('git -C')) {
      block(); return;
    }
  }

  if (/(?:\$\(|`)\s*git\s(?!-C)/.test(cmd)) {
    block(); return;
  }
}

// --- Territory Check (PreToolUse hook) ---

function territoryCheck() {
  const input = process.env.TOOL_INPUT;
  if (!input) return;
  let filePath;
  try { filePath = JSON.parse(input).file_path || ''; } catch { return; }
  if (!filePath) return;

  if (!PROJECT_DIR) return;
  if (!filePath.startsWith(PROJECT_DIR + '/')) return;

  const rel = filePath.slice(PROJECT_DIR.length + 1);
  const forbidden = FORBIDDEN.some(f => rel === f || rel.startsWith(f + '/'));

  if (forbidden) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `builder cannot Edit/Write into ${FORBIDDEN.find(f => rel === f || rel.startsWith(f + '/'))}/ — that path belongs to another agent. Builder writes code at repo root and cowmoo/{codebase,agent-files/builder}/.`,
    }));
  }
}

// --- Dev Server Detection ---

function detectDevServers() {
  const ports = [3000, 3001, 4000, 4200, 4321, 5000, 5173, 5174, 8000, 8080, 8888];
  const found = [];
  for (const port of ports) {
    const status = run(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port}/ 2>/dev/null`, { timeout: 3000 });
    if (status && status !== '000' && status !== '') {
      found.push({ port, url: `http://localhost:${port}`, status });
    }
  }
  if (found.length === 0) {
    console.log('No dev server detected on ports: ' + ports.join(', '));
  } else {
    found.forEach(s => console.log(`Dev server: ${s.url} (HTTP ${s.status})`));
  }
}

// --- Main ---

const [,, command, subcommand] = process.argv;

switch (command) {
  case 'hook':
    switch (subcommand) {
      case 'session-start': hookSessionStart(); break;
      default: console.log(`Unknown hook: ${subcommand}`);
    }
    break;
  case 'git-check':
    gitCheck();
    break;
  case 'territory-check':
    territoryCheck();
    break;
  case 'workflow-check':
    workflowCheck(subcommand);
    break;
  case 'next-step':
    nextStep();
    break;
  case 'detect-dev-servers':
    detectDevServers();
    break;
  default:
    console.log('Usage: node tools/dev-tools.cjs <hook|git-check|territory-check|workflow-check|next-step|detect-dev-servers>');
}
