#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = process.env.PROJECT_DIR;
const AGENT = 'pm';

// ── Territory (single source of truth for write enforcement) ──────────
//
// These are the ONLY paths PM can Edit or Write. The territoryCheck hook
// (wired in settings.json PreToolUse Edit|Write) hard-blocks writes to
// any path outside this list.
//
const TERRITORY = [
  'cowmoo/specs',
  'cowmoo/agent-files/pm',
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

function fileStatus(filePath) {
  if (!fs.existsSync(filePath)) return 'not found';
  const content = fs.readFileSync(filePath, 'utf8').trim();
  return content.length === 0 ? 'exists (empty)' : 'exists (has content)';
}

function workingNotesParse() {
  if (!PROJECT_DIR) return { state: 'not found', ready: 0, open: 0, future: 0 };
  const p = path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'pm', 'WORKING-NOTES.md');
  if (!fs.existsSync(p)) return { state: 'not found', ready: 0, open: 0, future: 0 };
  let notes;
  try { notes = fs.readFileSync(p, 'utf8'); } catch { return { state: 'not found', ready: 0, open: 0, future: 0 }; }
  if (notes.trim().length === 0) return { state: 'exists (empty)', ready: 0, open: 0, future: 0 };
  // Per-item [ready]/[future] tags are canonical; section-level tag on a `##` header
  // acts as a fallback cascade for hand-authored notes.
  let ready = 0, future = 0, open = 0, sectionTag = null;
  for (const line of notes.split('\n')) {
    if (line.startsWith('## ')) {
      if (line.includes('[ready]')) sectionTag = 'ready';
      else if (line.includes('[future]')) sectionTag = 'future';
      else sectionTag = null;
    } else if (/^- /.test(line)) {
      if (line.includes('[ready]') || sectionTag === 'ready') ready++;
      else if (line.includes('[future]') || sectionTag === 'future') future++;
      else open++;
    }
  }
  return { state: 'exists (has content)', ready, open, future };
}

// --- Check Files ---

function checkFiles() {
  if (!PROJECT_DIR) { console.log('check-files: PROJECT_DIR not set'); return; }
  const wn = workingNotesParse();
  if (wn.state === 'exists (has content)') {
    console.log(`working-notes: exists (has content) — ${wn.ready} ready, ${wn.open} open, ${wn.future} future`);
  } else {
    console.log(`working-notes: ${wn.state}`);
  }
  const fp = (rel) => path.join(PROJECT_DIR, rel);
  console.log(`backlog: ${fileStatus(fp('cowmoo/agent-files/pm/BACKLOG.md'))}`);
  console.log(`product: ${fileStatus(fp('cowmoo/specs/PRODUCT.md'))}`);
  const domainsDir = fp('cowmoo/specs/domains');
  let domainCount = 0;
  if (dirExists(domainsDir)) {
    try { domainCount = fs.readdirSync(domainsDir).filter(f => f.endsWith('.md')).length; } catch {}
  }
  console.log(`domain-specs: ${domainCount}`);
}

// --- Health Check ---

function healthCheck() {
  const issues = [];

  if (!PROJECT_DIR) issues.push('PROJECT_DIR not set. Launch via: moo pm');
  else {
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo', 'specs'))) issues.push(`cowmoo/specs/ not found in ${PROJECT_DIR}`);
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'pm'))) issues.push(`cowmoo/agent-files/pm/ not found in ${PROJECT_DIR}`);
  }

  if (!run('command -v gh')) issues.push('gh CLI not found. Install: https://cli.github.com');
  if (!run('command -v jq')) issues.push('jq not found. Install: brew install jq');

  if (issues.length > 0) {
    console.log('Health check:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
}

// --- Session Start ---

function hookSessionStart() {
  healthCheck();

  if (!PROJECT_DIR) return;

  // Check for messages (for-pm issues)
  const result = run('gh issue list --label "for-pm" --state open --json number,title --limit 10');
  if (result) {
    try {
      const issues = JSON.parse(result);
      if (issues.length > 0) {
        console.log(`\nInbox: ${issues.length} issue(s) need your attention`);
        issues.forEach(i => console.log(`  #${i.number} ${i.title}`));
        console.log('\nRun /catchup to process them.');
      }
    } catch {}
  }

  // Show working notes status
  const wn = workingNotesParse();
  const items = wn.ready + wn.open + wn.future;
  if (items > 0) {
    const parts = [];
    if (wn.ready > 0) parts.push(`${wn.ready} ready`);
    if (wn.open > 0) parts.push(`${wn.open} open`);
    if (wn.future > 0) parts.push(`${wn.future} future`);
    console.log(`\nWorking notes: ${parts.join(', ')}`);
    if (wn.ready > 0) console.log('Ready items found — consider /digest when appropriate.');
  }
}

// --- Workflow Step Tracking ---

const SEQUENCE = ['start', 'draft', 'digest', 'review', 'publish', 'notify'];
const UNTRACKED = new Set(['status', 'propose', 'copywrite', 'ideate', 'import', 'import-design', 'migrate', 'catchup', 'tidy', 'recon-chrome', 'recon-playwright', 'compare', 'playwright-cli']);
const ANYTIME = new Set([]);

function workflowPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'pm', '.workflow-step') : null;
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

// --- Inbox Context Tracking ---

function inboxPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'pm', '.inbox-context') : null;
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

// --- Design Fetch (Claude Designer bundle download → transient /tmp dir) ---
//
// Used by @pm-bundle-ops to extract a share URL into a temp directory for
// PM's /import-design skill to read. No project artifacts, no git — the
// bundle is transient, owned by the OS, and discarded when the skill ends.
// UXUI's bundle-fetch is the canonical persistent capture; this is the
// read-only spec-extraction path.
//
function designFetch() {
  const url = process.argv[3];

  if (!url) {
    console.log('Usage: design-fetch <url>');
    process.exit(1);
  }

  const tmpDir = `/tmp/pm-import-${Date.now()}`;
  try {
    fs.mkdirSync(tmpDir, { recursive: true });
  } catch (err) {
    console.log(`FAIL extraction-failed — could not create temp dir: ${err.message}`);
    process.exit(3);
  }

  // Cleanup helper for pre-success failures.
  const cleanup = () => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {} };

  // Step 1: download. Inlined (not via run()) to distinguish curl exit 28
  // (timeout) from other failures — same rationale as UXUI's bundle-fetch.
  const tmpFile = `/tmp/pm-import-${Date.now()}.tar.gz`;
  let dlExitCode = 0;
  try {
    execSync(`curl -sfL --max-time 60 -o ${JSON.stringify(tmpFile)} ${JSON.stringify(url)}`, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 75000,
    });
  } catch (e) {
    dlExitCode = (typeof e.status === 'number') ? e.status : -1;
  }
  if (dlExitCode === 28) {
    cleanup();
    console.log('FAIL url-timeout — download exceeded 60s (slow network or large bundle)');
    process.exit(7);
  }
  if (dlExitCode !== 0) {
    cleanup();
    console.log('FAIL url-unreachable — share URL may have expired or network failed');
    process.exit(2);
  }

  // Step 2: extract (--strip-components=1 to drop the bundle's root wrapper).
  const ex = run(`tar -xzf ${JSON.stringify(tmpFile)} --strip-components=1 -C ${JSON.stringify(tmpDir)}`);
  try { fs.unlinkSync(tmpFile); } catch {}
  if (ex === null) {
    cleanup();
    console.log('FAIL extraction-failed — tar could not extract');
    process.exit(3);
  }

  const files = fs.readdirSync(tmpDir);
  if (files.length === 0) {
    cleanup();
    console.log('FAIL extraction-empty — tarball had no contents');
    process.exit(3);
  }

  console.log(`OK path=${tmpDir} files=${files.length}`);
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
  case 'design-fetch':
    designFetch();
    break;
  default:
    console.log('Usage: node tools/dev-tools.cjs <hook|git-check|territory-check|check-files|inbox|workflow-check|next-step|design-fetch>');
}
