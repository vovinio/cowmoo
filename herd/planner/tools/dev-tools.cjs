#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = process.env.PROJECT_DIR;
const AGENT = 'planner';

// ── Territory (single source of truth for write enforcement) ──────────
//
// These are the ONLY paths planner can Edit or Write. The territoryCheck
// hook (wired in settings.json PreToolUse Edit|Write) hard-blocks writes
// to any path outside this list.
//
const TERRITORY = [
  'cowmoo/stack',
  'cowmoo/agent-files/planner',
];
// ──────────────────────────────────────────────────────────────────────

// --- Utilities ---

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000, ...opts }).trim();
  } catch { return null; }
}

// --- Check Files ---

function fileStatus(filePath) {
  if (!fs.existsSync(filePath)) return 'not found';
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length === 0 ? 'exists (empty)' : 'exists (has content)';
}

function checkFiles() {
  if (!PROJECT_DIR) { console.log('check-files: PROJECT_DIR not set'); return; }

  const fp = (rel) => path.join(PROJECT_DIR, rel);

  console.log(`techstack.md: ${fileStatus(fp('cowmoo/stack/techstack.md'))}`);
  console.log(`techstack-notes.md: ${fileStatus(fp('cowmoo/agent-files/planner/techstack-notes.md'))}`);
  // codebase.md is optional — owned by builder, may not exist on greenfield
  console.log(`codebase.md: ${fileStatus(fp('cowmoo/codebase/codebase.md'))} (optional — builder-owned)`);
  console.log(`knowledge.md: ${fileStatus(fp('cowmoo/agent-files/planner/knowledge.md'))}`);
  console.log(`draft.md: ${fileStatus(fp('cowmoo/agent-files/planner/draft.md'))}`);

  const domainsDir = fp('cowmoo/specs/domains');
  let domainCount = 0;
  try {
    if (fs.statSync(domainsDir).isDirectory()) {
      // Count only non-empty .md files — an empty file is as useless as no file
      // for the /start and /tech-stack Step 0 gates. Mirrors fileStatus() above.
      domainCount = fs.readdirSync(domainsDir)
        .filter(f => f.endsWith('.md'))
        .filter(f => fs.readFileSync(path.join(domainsDir, f), 'utf8').trim().length > 0)
        .length;
    }
  } catch {}
  console.log(`domain-specs: ${domainCount}`);
}

// --- Health Check ---

function healthCheck() {
  const issues = [];

  if (!PROJECT_DIR) issues.push('PROJECT_DIR not set. Launch via: moo planner');
  else {
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo/specs'))) issues.push(`cowmoo/specs/ not found in ${PROJECT_DIR}`);
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo/stack'))) issues.push(`cowmoo/stack/ not found in ${PROJECT_DIR}`);
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo/agent-files/planner'))) issues.push(`cowmoo/agent-files/planner/ not found in ${PROJECT_DIR}`);
  }

  if (!run('command -v gh')) issues.push('gh CLI not found. Install: https://cli.github.com');

  if (issues.length > 0) {
    console.log('Health check:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
}

// --- Session Start ---

function hookSessionStart() {
  healthCheck();

  if (!PROJECT_DIR) return;

  // Check for for-planner issues
  const result = run('gh issue list --label "for-planner" --state open --json number,title --limit 10');
  if (result) {
    try {
      const issues = JSON.parse(result);
      if (issues.length > 0) {
        console.log(`\nFor planner: ${issues.length} issue(s) need your attention`);
        issues.forEach(i => console.log(`  #${i.number} ${i.title}`));
        console.log('\nSuggested: /catchup');
      }
    } catch {}
  }

  // Task summary
  const todoResult = run('gh issue list --label "todo" --state open --json number --limit 100');
  const inProgressResult = run('gh issue list --label "in-progress" --state open --json number --limit 100');

  let todoCount = 0, inProgressCount = 0;
  try { todoCount = JSON.parse(todoResult || '[]').length; } catch {}
  try { inProgressCount = JSON.parse(inProgressResult || '[]').length; } catch {}

  if (todoCount > 0 || inProgressCount > 0) {
    console.log(`\nTasks: ${todoCount} todo, ${inProgressCount} in-progress`);
  }

  // Check for draft from previous session
  const draftPath = path.join(PROJECT_DIR, 'cowmoo/agent-files/planner', 'draft.md');
  if (fs.existsSync(draftPath) && fs.readFileSync(draftPath, 'utf8').trim().length > 0) {
    console.log('\nDraft: exists from previous session');
  }

  // Check tracked inbox issues from previous sessions
  const inboxContextPath = path.join(PROJECT_DIR, 'cowmoo/agent-files/planner', '.inbox-context');
  if (fs.existsSync(inboxContextPath)) {
    const raw = fs.readFileSync(inboxContextPath, 'utf8').trim();
    if (raw) {
      const lines = raw.split('\n').filter(Boolean);
      console.log(`\nInbox: ${lines.length} tracked issue(s) from a previous /catchup`);
      lines.forEach(l => {
        const [num, ...titleParts] = l.split('\t');
        console.log(`  #${num} ${titleParts.join(' ')}`);
      });
    }
  }

  // Check UI definitions
  const uxuiDir = path.join(PROJECT_DIR, 'cowmoo/design', 'domains');
  if (dirExists(uxuiDir)) {
    try {
      const uxuiFiles = fs.readdirSync(uxuiDir).filter(f => f.endsWith('.md'));
      if (uxuiFiles.length > 0) {
        console.log(`\nUI definitions: ${uxuiFiles.length} domain file(s) in cowmoo/design/`);
      }
    } catch {}
  }

  // Check codebase freshness
  // codebase.md is optional and owned by the builder — planner doesn't track its freshness.
  // Builder decides when to refresh its own codebase map.

  // Check for spec changes
  const specLog = run(`git -C "${PROJECT_DIR}" log --oneline -5 -- cowmoo/specs/`);
  if (specLog) {
    console.log(`\nRecent spec changes:`);
    console.log(specLog.split('\n').map(l => `  ${l}`).join('\n'));
  }
}

// --- Workflow Step Tracking ---

const SEQUENCES = {
  setup: ['tech-stack', 'start', 'draft', 'review', 'publish'],
  core:  ['start', 'draft', 'review', 'publish']
};
const UNTRACKED = new Set(['status', 'propose', 'tidy', 'catchup', 'ask']);
const ANYTIME = new Set([]);

function workflowPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo/agent-files/planner', '.workflow-step') : null;
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

function fileHasContent(rel) {
  const fp = path.join(PROJECT_DIR, rel);
  if (!fs.existsSync(fp)) return false;
  return fs.readFileSync(fp, 'utf8').trim().length > 0;
}

function detectFlow() {
  if (!PROJECT_DIR) return 'setup';
  if (!fileHasContent('cowmoo/stack/techstack.md')) return 'setup';

  // Check if any stories exist — indicates ongoing work
  const result = run('gh issue list --label "story" --state all --json number --limit 1');
  if (result) {
    try { if (JSON.parse(result).length > 0) return 'core'; } catch {}
  }

  // Techstack exists but no stories yet — still in setup (need /start first)
  return 'setup';
}

function getNextSkill(flow, lastSkill) {
  const seq = SEQUENCES[flow];
  if (!seq) return 'start';
  if (!lastSkill) return seq[0];
  const idx = seq.indexOf(lastSkill);
  // Wrap: core wraps back to 'start'
  if (idx < 0 || idx >= seq.length - 1) return seq[0];
  return seq[idx + 1];
}

function workflowCheck(skill) {
  if (!PROJECT_DIR || !skill || UNTRACKED.has(skill)) return;
  if (ANYTIME.has(skill)) return;
  markStep(skill);
}

function nextStep() {
  if (!PROJECT_DIR) return;
  const flow = detectFlow();
  const last = readStep();
  const lastSkill = last ? last.skill : '';
  const next = getNextSkill(flow, lastSkill || null);
  console.log(`last:${lastSkill}|next:${next}|flow:${flow}`);
}

// --- Inbox Context Tracking ---

function inboxPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'planner', '.inbox-context') : null;
}

function inboxAdd() {
  const p = inboxPath();
  if (!p) return;
  const num = process.argv[4];
  const title = process.argv.slice(5).join(' ');
  if (!num || !title) { console.log('Usage: inbox add <number> <title>'); return; }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (fs.existsSync(p) && fs.readFileSync(p, 'utf8').split('\n').some(l => l.startsWith(num + '\t'))) return;
  fs.appendFileSync(p, `${num}\t${title}\n`);
}

function inboxList() {
  const p = inboxPath();
  if (!p || !fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8').trim();
  if (content) console.log(content);
}

function inboxRemove() {
  const p = inboxPath();
  if (!p || !fs.existsSync(p)) return;
  const num = process.argv[4];
  if (!num) return;
  const lines = fs.readFileSync(p, 'utf8').trim().split('\n').filter(l => l && !l.startsWith(num + '\t'));
  if (lines.length === 0) fs.unlinkSync(p);
  else fs.writeFileSync(p, lines.join('\n') + '\n');
}

// --- Scratch-file Cleanup ---
//
// Planner owns a small set of untracked scratch files it needs to
// remove from disk at specific workflow moments (draft.md after
// /publish, techstack-notes.md after /tech-stack finalization).
// Plain `rm` isn't in the Bash allow-list; these subcommands run
// inside `Bash(node tools/*)`.
//
function clearDraft() {
  if (!PROJECT_DIR) return;
  const draftPath = path.join(PROJECT_DIR, 'cowmoo/agent-files/planner/draft.md');
  if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath);
}

function clearTechstackNotes() {
  if (!PROJECT_DIR) return;
  const notesPath = path.join(PROJECT_DIR, 'cowmoo/agent-files/planner/techstack-notes.md');
  if (fs.existsSync(notesPath)) fs.unlinkSync(notesPath);
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

  // Normalize: only enforce for paths inside the project. Anything outside
  // (e.g. /tmp/, the agent repo itself) is handled by Claude's own
  // access model, not us.
  if (!filePath.startsWith(PROJECT_DIR + '/')) return;

  const rel = filePath.slice(PROJECT_DIR.length + 1);
  const inTerritory = TERRITORY.some(t => rel === t || rel.startsWith(t + '/'));

  if (!inTerritory) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `${AGENT} can only Edit/Write within: ${TERRITORY.join(', ')}. Target: ${rel}`,
    }));
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
  case 'check-files':
    checkFiles();
    break;
  case 'inbox':
    switch (subcommand) {
      case 'add': inboxAdd(); break;
      case 'list': inboxList(); break;
      case 'remove': inboxRemove(); break;
      default: console.log('Usage: inbox <add|list|remove>');
    }
    break;
  case 'workflow-check':
    workflowCheck(subcommand);
    break;
  case 'next-step':
    nextStep();
    break;
  case 'clear-draft':
    clearDraft();
    break;
  case 'clear-techstack-notes':
    clearTechstackNotes();
    break;
  default:
    console.log('Usage: node tools/dev-tools.cjs <hook|git-check|territory-check|check-files|inbox|workflow-check|next-step|clear-draft|clear-techstack-notes>');
}
