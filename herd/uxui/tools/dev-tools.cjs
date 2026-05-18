#!/usr/bin/env node
'use strict';

const { execSync, execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PROJECT_DIR = process.env.PROJECT_DIR;
const AGENT = 'uxui';

// ── Territory (single source of truth for write enforcement) ──────────
//
// These are the ONLY paths UXUI can Edit or Write. The territoryCheck
// hook (wired in settings.json PreToolUse Edit|Write) hard-blocks writes
// to any path outside this list.
//
const TERRITORY = [
  'cowmoo/design',
  'cowmoo/agent-files/uxui',
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
  const p = path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', 'WORKING-NOTES.md');
  if (!fs.existsSync(p)) return { state: 'not found', ready: 0, open: 0, future: 0 };
  let notes;
  try { notes = fs.readFileSync(p, 'utf8'); } catch { return { state: 'not found', ready: 0, open: 0, future: 0 }; }
  if (notes.trim().length === 0) return { state: 'exists (empty)', ready: 0, open: 0, future: 0 };
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

function countMdFiles(dir) {
  if (!dirExists(dir)) return 0;
  try { return fs.readdirSync(dir).filter(f => f.endsWith('.md')).length; } catch { return 0; }
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
  console.log(`design-draft: ${fileStatus(fp('cowmoo/agent-files/uxui/design-draft.json'))}`);
  console.log(`overview: ${fileStatus(fp('cowmoo/design/OVERVIEW.md'))}`);
  console.log(`journeys: ${fileStatus(fp('cowmoo/design/journeys.md'))}`);
  console.log(`roles: ${fileStatus(fp('cowmoo/design/roles.md'))}`);
  console.log(`screen-index: ${fileStatus(fp('cowmoo/design/screen-index.md'))}`);
  console.log(`design-domains: ${countMdFiles(fp('cowmoo/design/domains'))}`);
  console.log(`spec-domains: ${countMdFiles(fp('cowmoo/specs/domains'))}`);
}

// --- Health Check ---

function healthCheck() {
  const issues = [];

  if (!PROJECT_DIR) issues.push('PROJECT_DIR not set. Launch via: moo uxui');
  else {
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo', 'specs'))) issues.push(`cowmoo/specs/ not found in ${PROJECT_DIR}`);
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo', 'design'))) issues.push(`cowmoo/design/ not found in ${PROJECT_DIR}`);
    if (!dirExists(path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui'))) issues.push(`cowmoo/agent-files/uxui/ not found in ${PROJECT_DIR}`);
  }

  if (!run('command -v gh')) {
    issues.push('gh CLI not found. Install: https://cli.github.com');
  } else if (run('gh auth status') === null) {
    issues.push('gh installed but not authenticated. Run: gh auth login');
  }
  if (!run('command -v jq')) issues.push('jq not found. Install: brew install jq');
  if (!run('command -v curl')) issues.push('curl not found — required for bundle-fetch.');
  if (!run('command -v tar')) issues.push('tar not found — required for bundle-fetch.');

  if (issues.length > 0) {
    console.log('Health check:');
    issues.forEach(i => console.log(`  - ${i}`));
  }
}

// --- Session Start ---

function hookSessionStart() {
  healthCheck();

  if (!PROJECT_DIR) return;

  // Orientation hint: Phase A writes UI defs; Phase B hands screens to a designer.
  const domainsDir = path.join(PROJECT_DIR, 'cowmoo', 'design', 'domains');
  const hasDomains = dirExists(domainsDir) && fs.readdirSync(domainsDir).some(f => f.endsWith('.md'));
  if (hasDomains) {
    console.log('\nPhase B ready (UI defs exist). Run /design-start to draft designer tasks, or /start to extend UI defs.');
  } else {
    console.log('\nPhase A. Run /start to load specs and begin defining UI.');
  }

  // Check for messages (for-uxui issues) and designer submissions (uxui:review)
  const forUxuiResult = run('gh issue list --label "for-uxui" --state open --json number,title --limit 10');
  const reviewResult = run('gh issue list --label "uxui:review" --state open --json number,title --limit 10');
  let forUxui = [], review = [];
  try { if (forUxuiResult) forUxui = JSON.parse(forUxuiResult); } catch {}
  try { if (reviewResult) review = JSON.parse(reviewResult); } catch {}

  if (forUxui.length > 0 || review.length > 0) {
    console.log(`\nInbox: ${forUxui.length} for-uxui, ${review.length} uxui:review`);
    review.forEach(i => console.log(`  #${i.number} ${i.title} → /catchup`));
    forUxui.forEach(i => console.log(`  #${i.number} ${i.title}`));
    console.log('\nRun /catchup to process them.');
  }

  // Show outstanding design task counts (uxui:todo waiting for designer; uxui:done is approved-and-shipped count)
  const todoResult = run('gh issue list --label "uxui:todo" --state open --json number --limit 50');
  const doneResult = run('gh issue list --label "uxui:done" --state closed --json number --limit 100');
  let todo = 0, done = 0;
  try { if (todoResult) todo = JSON.parse(todoResult).length; } catch {}
  try { if (doneResult) done = JSON.parse(doneResult).length; } catch {}
  if (todo > 0 || done > 0) {
    const parts = [];
    if (todo > 0) parts.push(`${todo} uxui:todo (waiting for designer)`);
    if (done > 0) parts.push(`${done} uxui:done (approved)`);
    console.log(`\nDesign tasks: ${parts.join(', ')}`);
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
    if (wn.ready > 0) console.log('Ready items found — consider /define when appropriate.');
  }
}

// --- Workflow Step Tracking ---

const SEQUENCE = ['start', 'draft', 'define', 'review', 'publish'];
const UNTRACKED = new Set(['status', 'propose', 'catchup', 'process-inbox', 'process-message', 'ask', 'notify', 'dispatch-corrections', 'design-start', 'design-draft', 'design-publish', 'review-bundle', 'approve-design', 'resolve-review']);
const ANYTIME = new Set([]);

function workflowPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', '.workflow-step') : null;
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

// --- Inbox Context Tracking ---

function inboxPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', '.inbox-context') : null;
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

// --- Design Draft (Phase B scratch lifecycle) ---

function designDraftPath() {
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', 'design-draft.json') : null;
}

function designDraftClear() {
  const p = designDraftPath();
  if (p && fs.existsSync(p)) fs.unlinkSync(p);
  // One-time migration safety: also remove a legacy markdown draft left from
  // before design-draft.json existed. Harmless once no .md drafts remain.
  if (PROJECT_DIR) {
    const legacy = path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', 'design-draft.md');
    if (fs.existsSync(legacy)) fs.unlinkSync(legacy);
  }
}

// --- Bundle Fetch (Claude Design export download + extract + commit) ---

function bundleFetch() {
  const ticket = process.argv[3];
  const domain = process.argv[4];
  const screen = process.argv[5];
  const designer = process.argv[6];
  const url = process.argv[7];

  if (!ticket || !domain || !screen || !url) {
    // designer is optional — pass `-` if unknown. url is required and positional last.
    console.log('Usage: bundle-fetch <ticket> <domain> <screen> <designer|-> <url>');
    process.exit(1);
  }
  if (!PROJECT_DIR) {
    console.log('FAIL no-project-dir — PROJECT_DIR not set');
    process.exit(1);
  }
  // ticket builds a filesystem path that is recursively deleted below — reject
  // anything that is not a plain issue number so a `..`-laden value cannot
  // escape the bundles/ directory. Mirrors the /^[0-9]+$/ guard on every other
  // ticket/issue argument in this file (journalUpdate, issueTransition, ...).
  if (!/^[0-9]+$/.test(String(ticket))) {
    console.log('FAIL bad-ticket — ticket must be a positive integer');
    process.exit(1);
  }

  const bundleDir = path.join(PROJECT_DIR, 'cowmoo', 'design', 'bundles', String(ticket));

  // Clear any prior contents before extraction. Re-fetch must overwrite,
  // not merge — a resubmitted bundle may drop or rename files, and stale
  // orphans would leave a Frankenstein bundle on disk.
  try { fs.rmSync(bundleDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(bundleDir, { recursive: true });

  // Cleanup helper — removes the bundle directory recursively. Used on
  // any pre-git failure so a re-run starts from a clean state.
  const cleanup = () => { try { fs.rmSync(bundleDir, { recursive: true, force: true }); } catch {} };

  // Step 1: download
  // Inlined (not via run()) so we can distinguish curl exit 28 (timeout) from
  // other failures. The shared run() helper collapses every non-zero exit to
  // null, which would prevent "URL expired or unreachable" from being told
  // apart from "download exceeded 60s on slow network / large bundle" —
  // resulting in a "please re-share" comment that loops the designer when
  // the real cause is the bundle size.
  const tmpFile = `/tmp/bundle-${ticket}-${Date.now()}.tar.gz`;
  let dlExitCode = 0;
  try {
    // execFileSync (argv array, no shell) — `url` is externally supplied, so a
    // shell-string curl would let $(...)/backticks in the URL execute.
    execFileSync('curl', ['-sfL', '--max-time', '60', '-o', tmpFile, url], {
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

  // Step 2: extract (--strip-components=1 to drop the bundle's root wrapper folder)
  const ex = run(`tar -xzf ${JSON.stringify(tmpFile)} --strip-components=1 -C ${JSON.stringify(bundleDir)}`);
  try { fs.unlinkSync(tmpFile); } catch {}
  if (ex === null) {
    cleanup();
    console.log('FAIL extraction-failed — tar could not extract');
    process.exit(3);
  }

  const files = fs.readdirSync(bundleDir);
  if (files.length === 0) {
    cleanup();
    console.log('FAIL extraction-empty — tarball had no contents');
    process.exit(3);
  }

  // Step 3: write meta.json. Wrap in try/catch — a disk-full or permission-denied
  // failure at this point should emit a structured FAIL for the agent to parse,
  // not crash the Node process (which would bypass the agent's error reporting).
  const meta = {
    ticket: Number(ticket),
    domain,
    screen,
    url,
    fetched_at: new Date().toISOString(),
    designer: (designer && designer !== '-') ? designer : null,
  };
  try {
    fs.writeFileSync(path.join(bundleDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  } catch (err) {
    cleanup();
    console.log(`FAIL meta-write — could not write meta.json: ${err.message}`);
    process.exit(6);
  }

  // Step 4: git add + commit (use git -C "$PROJECT_DIR" convention).
  // Note: if git add / commit fails after successful extraction + meta
  // write, the bundle directory is intentionally LEFT IN PLACE (no
  // cleanup). The files are valid on-disk artifacts; the user can inspect
  // them or commit manually. Auto-cleanup on git failure would destroy
  // usable data over a transient git issue (e.g., pre-commit hook,
  // signing config, lock file). The cleanup() helper is reserved for
  // pre-git failures (extraction, empty tarball, meta-write).
  // 60s per-call timeout (the git() helper defaults to 20s) — project pre-commit
  // hooks (linters, type-checkers, signing) commonly exceed that on real repos.
  // Routed through the shell-free git() helper: `domain` flows into commitMsg
  // below and is externally supplied, so a shell-string git would be injectable.
  const relDir = path.relative(PROJECT_DIR, bundleDir);
  const addResult = git(['add', relDir], { timeout: 60000 });
  if (!addResult.ok) {
    console.log('FAIL git-add — could not stage bundle directory (files left in place for inspection)');
    process.exit(4);
  }

  const commitMsg = `design(${domain}): capture bundle for ticket #${ticket}`;
  // Pathspec-restricted to the bundle directory. A bare `git commit` would
  // commit the whole index, sweeping any pre-existing staged content into the
  // bundle-capture commit; `commit -- <relDir>` confines it to what was just
  // staged. relDir was recreated above, so the pathspec cannot hit a no-match.
  const commitResult = git(['commit', '-m', commitMsg, '--', relDir], { timeout: 60000 });
  if (!commitResult.ok) {
    console.log('FAIL git-commit — git commit failed (files left in place; check hook / signing / lock)');
    process.exit(5);
  }

  const shortHash = git(['rev-parse', '--short', 'HEAD']).out || '?';

  // Re-list files to include meta.json in count
  const finalFiles = fs.readdirSync(bundleDir);
  console.log(`OK ticket=${ticket} files=${finalFiles.length} commit=${shortHash} path=${relDir}`);
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

// --- Commit (canonical pathspec-restricted commit) ---
//
// One tested implementation of the canonical commit procedure: merge-state
// guard, pathspec-restricted commit, index-lock retry, hash-pinned
// content-verify. The /publish, /approve-design, and /resolve-review skills invoke one of:
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit general "<message>"
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit roles "<message>"
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit attach-design <domain> "<message>"
// and read the printed report.
//
// Output markers (the calling skill matches on these — the
// <OP> token is COMMIT / COMMIT_ROLES / ATTACH_DESIGN):
//   <OP>: ✓ <hash> <subject>...   — success            (exit 0)
//   <OP>: Nothing to commit.      — no territory change (exit 0)
//   <OP>: ✗ <reason>              — refused or failed   (exit 1)
//
// UXUI has three commit modes:
//   general — design defs + working notes + proposals (cowmoo/design/ +
//             cowmoo/agent-files/uxui/). Inclusion-form.
//   roles   — scoped commit of cowmoo/design/roles.md ONLY (strict — rejects
//             even other UXUI-territory files). Inclusion-form.
//   attach-design — a domain file (cowmoo/design/domains/<domain>.md) plus
//             cowmoo/design/VISUAL-JOURNAL.md. Inclusion-form.

// git(args) — run `git -C $PROJECT_DIR <args...>` with no shell (execFileSync
// takes an args array, so pathspecs and messages need no quoting). Returns
// { ok, out, err, code }. Unlike run(), this surfaces stderr + exit code so
// the caller can distinguish index-lock contention from other failures.
function git(args, opts = {}) {
  try {
    // -c core.quotePath=false → --name-only emits raw UTF-8 paths, not
    // octal-escaped ones, so non-ASCII territory paths round-trip into the
    // commit pathspec correctly.
    const out = execFileSync('git', ['-c', 'core.quotePath=false', '-C', PROJECT_DIR, ...args], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 20000, ...opts,
    });
    return { ok: true, out: (out || '').trim(), err: '', code: 0 };
  } catch (e) {
    return {
      ok: false,
      out: (e.stdout ? e.stdout.toString() : '').trim(),
      err: ((e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')).trim(),
      code: typeof e.status === 'number' ? e.status : -1,
    };
  }
}

// gh(args, opts) — run `gh <args...>` with no shell (execFileSync takes an
// args array, so titles/labels/bodies need no quoting). Returns
// { ok, out, err, code }. Mirrors git(); accepts { input } to feed stdin —
// used to pass an issue body via `gh issue create --body-file -`, so the
// body never transits a shell. 30s timeout — issue creation hits the network.
function gh(args, opts = {}) {
  try {
    const out = execFileSync('gh', args, {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000, ...opts,
    });
    return { ok: true, out: (out || '').trim(), err: '', code: 0 };
  } catch (e) {
    return {
      ok: false,
      out: (e.stdout ? e.stdout.toString() : '').trim(),
      err: ((e.stderr ? e.stderr.toString() : '') + (e.stdout ? e.stdout.toString() : '')).trim(),
      code: typeof e.status === 'number' ? e.status : -1,
    };
  }
}

function splitLines(s) {
  return (s || '').split('\n').map((x) => x.trim()).filter(Boolean);
}

function sleepMs(ms) {
  try { execSync(`sleep ${Math.ceil(ms / 1000)}`); } catch {}
}

// inMergeState — git rejects partial commits (commit -- <paths>) mid-merge,
// mid-rebase, mid-cherry-pick, or mid-revert. Detect so we can surface a
// clean message instead of git's raw error.
function inMergeState() {
  for (const h of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) {
    if (git(['rev-parse', '--verify', '-q', h]).ok) return true;
  }
  const gd = git(['rev-parse', '--git-dir']);
  if (gd.ok) {
    const dir = path.isAbsolute(gd.out) ? gd.out : path.join(PROJECT_DIR, gd.out);
    if (dirExists(path.join(dir, 'rebase-merge')) || dirExists(path.join(dir, 'rebase-apply'))) return true;
  }
  return false;
}

// indexMutate — run an index-mutating git command (add / commit), retrying on
// `.git/index.lock` contention (a concurrent agent committing at the same
// moment). Retries up to 3 times with a 2s backoff. On unrecoverable failure
// prints a report line and exits 1; on success returns the result.
function indexMutate(op, label, args, opts = {}) {
  let attempt = 0;
  while (true) {
    const r = git(args, opts);
    if (r.ok) return r;
    attempt++;
    const locked = /index\.lock/.test(r.err);
    if (locked && attempt < 3) { sleepMs(2000); continue; }
    if (locked) {
      console.log(`${op}: ✗ git index is locked after 3 attempts — another agent may be mid-commit, or a previous git process left a stale index.lock. If no agent is currently committing, remove the .git/index.lock file in the project and re-run.`);
    } else {
      console.log(`${op}: ✗ git ${label} failed: ${r.err}`);
    }
    process.exit(1);
  }
}

// commitOp — the shared commit procedure. `profile` is data:
//   { op, form, pathspec[], inTerritory(path) }
// form 'inclusion' → pathspec is a list of territory roots/files. Staging
//   skips roots absent on disk and untracked (git add errors on those); the
//   commit then names the explicit list of staged in-territory files, so
//   `git commit --` can never hit a no-match pathspec.
// form 'exclusion' → pathspec is ['.', ':(exclude)...']; '.' always matches,
//   and the bounded exclude pathspec is reused verbatim for the commit.
function commitOp(profile, message) {
  const op = profile.op;
  if (!PROJECT_DIR) { console.log(`${op}: ✗ PROJECT_DIR not set.`); process.exit(1); }
  if (!message || !message.trim()) { console.log(`${op}: ✗ no commit message provided.`); process.exit(1); }

  // Pre-check 1 — repo state.
  if (inMergeState()) {
    console.log(`${op}: ✗ repo is mid-merge/rebase/cherry-pick — finish that operation first (commit the merge / continue the rebase), then re-run.`);
    process.exit(1);
  }

  // Pre-check 2 — territory has changes. git status tolerates a pathspec that
  // matches nothing, so the raw profile pathspec is safe here.
  const status = git(['status', '--porcelain', '--', ...profile.pathspec]);
  if (!status.ok) { console.log(`${op}: ✗ git status failed: ${status.err}`); process.exit(1); }
  if (!status.out) { console.log(`${op}: Nothing to commit.`); process.exit(0); }

  // Pre-check 3 — capture pre-existing foreign staged content for the report.
  const preForeign = splitLines(git(['diff', '--cached', '--name-only']).out)
    .filter((p) => !profile.inTerritory(p));

  // Stage, and decide the commit pathspec. Both `git add` and `git commit`
  // mutate the index and can lose a race for `.git/index.lock` against a
  // concurrent agent — indexMutate() retries both on lock contention.
  let commitPathspec;
  if (profile.form === 'exclusion') {
    indexMutate(op, 'add', ['add', ...profile.pathspec]);
    commitPathspec = profile.pathspec;
  } else {
    // Stage only roots git add can act on — a root absent on disk AND untracked
    // would make git add error. (An existing-but-empty root is a harmless no-op.)
    const addable = profile.pathspec.filter((r) =>
      fs.existsSync(path.join(PROJECT_DIR, r)) || git(['ls-files', '--', r]).out);
    if (addable.length) indexMutate(op, 'add', ['add', ...addable]);
    // Commit the explicit list of staged in-territory files. Every entry is a
    // real staged path, so `git commit --` cannot hit a no-match error, and a
    // concurrent agent's staging (its own territory) is filtered out here.
    commitPathspec = splitLines(git(['diff', '--cached', '--name-only']).out)
      .filter((p) => profile.inTerritory(p));
    if (commitPathspec.length === 0) { console.log(`${op}: Nothing to commit.`); process.exit(0); }
  }

  // Commit.
  indexMutate(op, 'commit', ['commit', '-F', '-', '--', ...commitPathspec], { input: message });

  // Hash-pin: capture our commit. All verification uses this hash, never HEAD —
  // a concurrent agent committing right after us would move HEAD.
  const hash = git(['rev-parse', 'HEAD']).out;

  // Verify — only territory paths landed in our commit.
  const foreign = splitLines(git(['show', '--name-only', '--format=', hash]).out)
    .filter((p) => !profile.inTerritory(p));
  if (foreign.length) {
    console.log(`${op}: ✗ commit contains paths outside territory:`);
    foreign.forEach((p) => console.log(`  ${p}`));
    console.log(`Investigate — the commit was created locally; do NOT push without review. To undo: git -C "$PROJECT_DIR" reset --soft ${hash}^`);
    process.exit(1);
  }

  // Report.
  console.log(`${op}: ✓ ${hash.slice(0, 9)} ${message.split('\n')[0]}. Working tree clean for territory.`);
  if (preForeign.length) {
    console.log('Note: pre-existing staged paths outside territory remained in the index and were NOT included in this commit (commits are pathspec-restricted):');
    preForeign.forEach((p) => console.log(`  ${p}`));
  }
  process.exit(0);
}

// UXUI commit profiles.
//
// general — inclusion-form over the two UXUI territory roots.
const UXUI_TERRITORY_ROOTS = ['cowmoo/design', 'cowmoo/agent-files/uxui'];
const UXUI_GENERAL_PROFILE = {
  op: 'COMMIT',
  form: 'inclusion',
  pathspec: UXUI_TERRITORY_ROOTS,
  inTerritory: (p) => UXUI_TERRITORY_ROOTS.some((r) => p === r || p.startsWith(r + '/')),
};
// roles — strict: cowmoo/design/roles.md ONLY. Rejects even other UXUI files.
const UXUI_ROLES_PROFILE = {
  op: 'COMMIT_ROLES',
  form: 'inclusion',
  pathspec: ['cowmoo/design/roles.md'],
  inTerritory: (p) => p === 'cowmoo/design/roles.md',
};
// attach-design — a domain file plus VISUAL-JOURNAL.md. The domain is a runtime
// argument; the territory test accepts any domains/*.md plus the journal.
function uxuiAttachProfile(domain) {
  return {
    op: 'ATTACH_DESIGN',
    form: 'inclusion',
    pathspec: [`cowmoo/design/domains/${domain}.md`, 'cowmoo/design/VISUAL-JOURNAL.md'],
    inTerritory: (p) => /^cowmoo\/design\/domains\/.+\.md$/.test(p) || p === 'cowmoo/design/VISUAL-JOURNAL.md',
  };
}

// --- Push (canonical remote-sync) ---
//
// The canonical remote push. Agent-independent —
// push targets origin/HEAD regardless of which agent committed, so this takes
// no profile and is a verbatim copy across all four dev-tools.cjs files.
//
// Output markers (the /publish skills match on the PUSH: prefix):
//   PUSH: ✓ to origin/<branch>                          — success    (exit 0)
//   PUSH: skipped — no git remote 'origin' configured.  — no remote  (exit 0)
//   PUSH: ✗ <reason>                                    — failed     (exit 1)
//
// A push failure NEVER rolls back the commit — the local commit is correct.
function pushOp() {
  if (!PROJECT_DIR) { console.log('PUSH: ✗ PROJECT_DIR not set.'); process.exit(1); }

  // Pre-check — `remote get-url` exits non-zero when origin is absent.
  if (!git(['remote', 'get-url', 'origin']).ok) {
    console.log("PUSH: skipped — no git remote 'origin' configured.");
    process.exit(0);
  }

  // Execute. `-u origin HEAD` is idempotent. Network I/O can exceed git()'s
  // 20s default, so the timeout is raised to 120s for this call only.
  const pushed = git(['push', '-u', 'origin', 'HEAD'], { timeout: 120000 });
  if (!pushed.ok) {
    // git push diagnostics span multiple stderr lines; surface the first
    // fatal/error/rejected line — the informative one — not the last.
    const errLines = splitLines(pushed.err);
    const reason = errLines.find((l) => /fatal:|error:|rejected/i.test(l)) || errLines[0] || `git push exited ${pushed.code}`;
    console.log(`PUSH: ✗ ${reason}`);
    process.exit(1);
  }

  // Verify — the branch line of `status -sb` must no longer show [ahead N].
  const sb = git(['status', '-sb']);
  const branchLine = splitLines(sb.out)[0] || '';
  const m = branchLine.match(/^##\s+([^.\s]+)/);
  const branch = m ? m[1] : 'HEAD';
  if (/\[ahead /.test(branchLine)) {
    console.log(`PUSH: ✗ push reported success but branch still shows ${branchLine.trim()} — re-run after checking the remote.`);
    process.exit(1);
  }

  console.log(`PUSH: ✓ to origin/${branch}`);
  process.exit(0);
}

// --- Project board (canonical label↔Status sync) ---
//
// Agent-independent — verbatim copy across all four dev-tools.cjs files.
//
// The board mirrors issue labels: labels are the source of truth, the board's
// Status field is kept in sync. LABEL_TO_COLUMN is the single definition of the
// mapping. boardSyncCore ensures the issue is a board item and sets its Status
// column; the issue-create / issue-transition subcommands call it directly.
// NON-BLOCKING: a board miss never fails the calling operation.

// LABEL_TO_COLUMN — canonical label/event → board-column mapping. The `closed`
// key is the issue-closed event and overrides any label.
const LABEL_TO_COLUMN = {
  story: 'Stories',
  todo: 'Todo',
  'in-progress': 'In Progress',
  'for-planner': 'Planner',
  'for-pm': 'PM',
  'for-uxui': 'UXUI',
  'uxui:todo': 'UX: Todo',
  'uxui:in-progress': 'UX: In Progress',
  'uxui:review': 'UX: Review',
  'uxui:done': 'Done',
  closed: 'Done',
};

// resolveProjectId — $GH_PROJECT_ID override, else the repo's first linked
// projectsV2. Returns the project node id, or null when there is no board.
function resolveProjectId() {
  const override = process.env.GH_PROJECT_ID && process.env.GH_PROJECT_ID.trim();
  if (override) return override;
  const repo = process.env.GH_REPO || '';
  const slash = repo.indexOf('/');
  if (slash < 1 || slash === repo.length - 1) return null;
  const owner = repo.slice(0, slash);
  const name = repo.slice(slash + 1);
  const q = `{ repository(owner:"${owner}",name:"${name}") { projectsV2(first:1) { nodes { id } } } }`;
  const id = run(`gh api graphql -f query=${JSON.stringify(q)} --jq '.data.repository.projectsV2.nodes[0].id'`);
  return (id && id !== 'null') ? id : null;
}

// boardSyncCore — ensure the issue is a board item and set its Status column.
// Returns exactly one line; no console output and no process.exit, so callers
// (issueCreate / issueTransition) can splice the result into their
// own report:
//   'Board: <column>'             — Status set
//   'Board: no board'             — no linked ProjectV2 / $GH_REPO unset
//   'Board: no such column "<x>"' — the board has no column with that name
//   'Board: failed'               — a board exists but the sync did not complete
function boardSyncCore(issueNumber, columnName) {
  if (!issueNumber || !/^[0-9]+$/.test(String(issueNumber))) return 'Board: failed';
  if (!columnName) return 'Board: failed';

  const projectId = resolveProjectId();
  if (!projectId) return 'Board: no board';

  // Issue node id.
  const issueId = run(`gh issue view ${issueNumber} --json id --jq .id`);
  if (!issueId || issueId === 'null') return 'Board: failed';

  // Add to the board — addProjectV2ItemById is idempotent: it returns the item
  // id whether the issue was just added or was already on the board.
  const addMut = `mutation { addProjectV2ItemById(input: {projectId: "${projectId}", contentId: "${issueId}"}) { item { id } } }`;
  const itemId = run(`gh api graphql -f query=${JSON.stringify(addMut)} --jq '.data.addProjectV2ItemById.item.id'`);
  if (!itemId || itemId === 'null') return 'Board: failed';

  // Look up the Status single-select field — its id and option ids by name.
  const fieldQ = `query { node(id: "${projectId}") { ... on ProjectV2 { field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } } } }`;
  const fieldRaw = run(`gh api graphql -f query=${JSON.stringify(fieldQ)}`);
  if (!fieldRaw) return 'Board: failed';
  let field;
  try { field = JSON.parse(fieldRaw).data.node.field; } catch { return 'Board: failed'; }
  if (!field || !field.id || !Array.isArray(field.options)) return 'Board: failed';
  const option = field.options.find((o) => o.name === columnName);
  if (!option) return `Board: no such column "${columnName}"`;

  // Set the Status, retrying once on transient failure.
  const setMut = `mutation { updateProjectV2ItemFieldValue(input: {projectId: "${projectId}", itemId: "${itemId}", fieldId: "${field.id}", value: {singleSelectOptionId: "${option.id}"}}) { projectV2Item { id } } }`;
  let set = run(`gh api graphql -f query=${JSON.stringify(setMut)}`);
  if (set === null) { sleepMs(2000); set = run(`gh api graphql -f query=${JSON.stringify(setMut)}`); }
  return set === null ? 'Board: failed' : `Board: ${columnName}`;
}

// boardDragsCore — find board cards a human dragged into <columnName>: cards
// whose Status is <columnName> but whose labels do NOT include <expectedLabel>.
// The board query fetches each card's labels too, so both the mismatch filter
// AND the caller's relabel input are produced in one GraphQL call — read-sync
// skills never pull a per-issue `gh issue view`. Returns an array of
// `{ number, labels }`, or null when there is no board. items(first:100).
function boardDragsCore(columnName, expectedLabel) {
  const projectId = resolveProjectId();
  if (!projectId) return null;
  const q = `query { node(id: "${projectId}") { ... on ProjectV2 { items(first: 100) { nodes { content { ... on Issue { number labels(first: 20) { nodes { name } } } } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }`;
  const raw = run(`gh api graphql -f query=${JSON.stringify(q)}`);
  if (!raw) return null;
  let nodes;
  try { nodes = JSON.parse(raw).data.node.items.nodes; } catch { return null; }
  if (!Array.isArray(nodes)) return null;
  return nodes
    .filter((n) => n && n.content && typeof n.content.number === 'number'
      && n.fieldValueByName && n.fieldValueByName.name === columnName)
    .map((n) => ({
      number: n.content.number,
      labels: ((n.content.labels && n.content.labels.nodes) || []).map((l) => l.name),
    }))
    .filter((d) => !d.labels.includes(expectedLabel));
}

// boardDragsOp — `board-drags <column> <expected-label>` subcommand: print one
// `<number>\t<comma-separated labels>` line per card a human dragged into
// <column> — nothing when there are none. Prints `Board: no board` when there
// is no project board. Always exits 0. The label list lets the caller relabel
// without a per-issue `gh issue view`.
function boardDragsOp(columnName, expectedLabel) {
  if (!columnName || !expectedLabel) { console.log('Board: usage: board-drags <column> <expected-label>'); process.exit(0); }
  const drags = boardDragsCore(columnName, expectedLabel);
  if (drags === null) { console.log('Board: no board'); process.exit(0); }
  drags.forEach((d) => console.log(`${d.number}\t${d.labels.join(',')}`));
  process.exit(0);
}

// --- Issue operations (delegated GitHub issue create / edit / transition) ---
//
// Two subcommands replace the inline `gh issue create / comment / edit /
// close` heredocs (formerly hand-rolled):
//
//   issue-create     --from <handoff.json> --index <i>
//   issue-transition --from <handoff.json> --index <i>
//
// The handoff file is a JSON array of op objects, authored by the calling
// skill's Write tool at cowmoo/agent-files/<agent>/.op-handoff.json (one reused
// path, overwritten per use); --index selects one entry. A single-op call is a
// one-element array with --index 0. issue-create also accepts an object with a
// `.tasks` array (UXUI's design-draft.json) for the CREATE_DESIGN_TASK path.
//
// Every body (issue text, comment, PRD) travels file → JSON.parse → gh stdin
// (`--body-file -`) and never transits a shell — backticks / $() / quotes / a
// literal EOF line in a body are inert text. Each subcommand prints exactly
// ONE report line `<op>: ✓ …` / `<op>: ✗ …` and sets a meaningful exit code.
// Each create / relabel / close calls boardSyncCore internally and folds the
// `Board: …` segment into its report (non-blocking — a board miss never
// changes the exit code). This block is agent-independent and verbatim-
// identical across all four dev-tools.cjs files.

// loadHandoffEntry — parse --from/--index, load + validate the handoff JSON,
// return { entry, op }. On any failure prints `<subcmd>: ✗ <reason>` exit 1.
function loadHandoffEntry(subcmd, defaultOp) {
  const fail = (msg) => { console.log(`${subcmd}: ✗ ${msg}`); process.exit(1); };
  if (!PROJECT_DIR) fail('PROJECT_DIR not set.');

  const argv = process.argv.slice(3);
  let from = null, indexRaw = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--from') from = argv[++i];
    else if (argv[i] === '--index') indexRaw = argv[++i];
    else fail(`unknown argument "${argv[i]}" — usage: ${subcmd} --from <path> --index <i>`);
  }
  if (from == null) fail(`usage: ${subcmd} --from <path> --index <i>`);
  if (indexRaw == null) indexRaw = '0';
  if (!/^[0-9]+$/.test(String(indexRaw))) fail(`--index must be a non-negative integer (got "${indexRaw}").`);
  const index = Number(indexRaw);

  const handoffPath = path.isAbsolute(from) ? from : path.join(PROJECT_DIR, from);
  if (!fs.existsSync(handoffPath)) fail(`handoff file not found at ${handoffPath}.`);
  let raw;
  try { raw = fs.readFileSync(handoffPath, 'utf8'); } catch { fail('handoff file is unreadable.'); }
  if (!raw || !raw.trim()) fail('handoff file is empty.');
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { fail(`handoff file is not valid JSON: ${e.message}.`); }

  let entries;
  if (Array.isArray(parsed)) entries = parsed;
  else if (parsed && Array.isArray(parsed.tasks)) entries = parsed.tasks;
  else fail('handoff JSON must be an array of op objects (or an object with a "tasks" array).');
  if (entries.length === 0) fail('handoff JSON is empty.');
  if (index >= entries.length) fail(`--index ${index} out of range (handoff has ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}).`);

  const entry = entries[index];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) fail(`entry[${index}] is malformed (not an object).`);
  const op = (typeof entry.op === 'string' && entry.op.trim()) ? entry.op.trim() : defaultOp;
  if (!op) fail(`entry[${index}] is missing the "op" field.`);
  return { entry, op };
}

// ghReason — map a failed gh() result to a short human-readable reason.
function ghReason(res) {
  const e = (res.err || '').toLowerCase();
  if (/gh auth|not logged|authentication/.test(e)) return 'not authenticated (run: gh auth login)';
  if (/could not resolve host|network|timeout|timed out/.test(e)) return 'network error reaching GitHub';
  return splitLines(res.err)[0] || `gh exited ${res.code}`;
}

// issueCreate — create ONE issue from a handoff entry { op, title, label, body,
// parent? }, verify title+label, optionally link it as a sub-issue of `parent`
// (a story issue #, Pattern 14), sync the board. Title is used verbatim — the
// caller supplies its own `[Agent]` identity prefix.
function issueCreate() {
  const { entry, op } = loadHandoffEntry('issue-create', 'CREATE_DESIGN_TASK');
  const fail = (msg) => { console.log(`${op}: ✗ ${msg}`); process.exit(1); };

  const title = (typeof entry.title === 'string') ? entry.title.trim() : '';
  const label = (typeof entry.label === 'string') ? entry.label.trim() : '';
  const body = (typeof entry.body === 'string') ? entry.body : '';
  if (!title) fail('entry is missing "title".');
  if (!label) fail('entry is missing "label".');
  if (!body.trim()) fail('entry is missing "body".');
  const parent = (entry.parent != null) ? String(entry.parent) : null;
  if (parent !== null && !/^[0-9]+$/.test(parent)) fail(`"parent" must be an issue number (got "${entry.parent}").`);

  // Create — body via stdin, never a shell.
  const created = gh(['issue', 'create', '--title', title, '--label', label, '--body-file', '-'], { input: body });
  if (!created.ok) {
    const e = (created.err || '').toLowerCase();
    const reason = /label/.test(e)
      ? `could not create issue (check the "${label}" label exists in the repo)`
      : ghReason(created);
    fail(`gh issue create failed: ${reason}`);
  }

  // Issue number — last path segment of the URL gh prints.
  const num = (splitLines(created.out).pop() || '').split('/').pop();
  if (!num || !/^[0-9]+$/.test(num)) fail(`issue created but could not parse its number from "${created.out}".`);

  // Verify title + label, one retry for GitHub eventual-consistency lag.
  const verifyOnce = () => {
    const v = gh(['issue', 'view', num, '--json', 'title,labels', '--jq', '{title:.title,labels:[.labels[].name]}']);
    if (!v.ok) return false;
    try {
      const got = JSON.parse(v.out);
      return got.title === title && Array.isArray(got.labels) && got.labels.includes(label);
    } catch { return false; }
  };
  if (!verifyOnce()) { sleepMs(2000); if (!verifyOnce()) fail(`#${num} created but verification failed (title/label mismatch or gh view error). The issue exists — investigate before retrying.`); }

  // Sub-issue link (Pattern 14) — only when a parent story is given.
  let linkNote = '';
  if (parent !== null) {
    const storyId = gh(['issue', 'view', parent, '--json', 'id', '--jq', '.id']);
    const taskId = gh(['issue', 'view', num, '--json', 'id', '--jq', '.id']);
    if (!storyId.ok || !storyId.out || !taskId.ok || !taskId.out) {
      fail(`#${num} created but sub-issue link failed (could not resolve node ids). The issue exists — link it to story #${parent} manually.`);
    }
    const mutation = `mutation { addSubIssue(input: {issueId: "${storyId.out}", subIssueId: "${taskId.out}"}) { subIssue { number } } }`;
    const linked = gh(['api', 'graphql', '-f', `query=${mutation}`]);
    if (!linked.ok) fail(`#${num} created but sub-issue link to story #${parent} failed: ${ghReason(linked)}. The issue exists — link it manually.`);
    linkNote = ` Linked to story #${parent}.`;
  }

  // Board sync — non-blocking.
  const column = LABEL_TO_COLUMN[label];
  const board = column ? boardSyncCore(num, column) : `Board: no mapping for "${label}"`;

  console.log(`${op}: ✓ #${num} — ${title}. Label: ${label}.${linkNote} ${board}.`);
  process.exit(0);
}

// issueTransition — comment and/or relabel and/or close an issue from a handoff
// entry { op, issue, comment?, removeLabel?, addLabel?, close? }. Steps run in
// order (comment → relabel → close), each verified with one retry; a failure
// stops and reports what already succeeded. `removeLabel` may be a string or an
// array — each label present is removed, an absent one is skipped (so COMPLETE
// can drop in-progress best-effort and RETURN can drop whichever of
// in-progress/todo is set). Covers POST_COMMENT, RELABEL, CLAIM, CLOSE_ISSUE,
// RESOLVE_ISSUE, COMPLETE, RETURN, APPROVE_DESIGN, REJECT_DESIGN, and the
// comment step of UPDATE_JOURNAL.
function issueTransition() {
  const { entry, op } = loadHandoffEntry('issue-transition', null);
  const issue = (entry.issue != null) ? String(entry.issue) : '';
  const done = [];
  const fail = (msg) => {
    const sofar = done.length ? ` (already done: ${done.join('; ')})` : '';
    console.log(`${op}${/^[0-9]+$/.test(issue) ? ` #${issue}` : ''}: ✗ ${msg}${sofar}`);
    process.exit(1);
  };
  if (!/^[0-9]+$/.test(issue)) fail(`entry "issue" must be an issue number (got "${entry.issue}").`);

  const comment = (typeof entry.comment === 'string' && entry.comment.trim()) ? entry.comment : null;
  const addLabel = (typeof entry.addLabel === 'string' && entry.addLabel.trim()) ? entry.addLabel.trim() : null;
  let removeLabels = [];
  if (Array.isArray(entry.removeLabel)) {
    removeLabels = entry.removeLabel.filter((l) => typeof l === 'string' && l.trim()).map((l) => l.trim());
  } else if (typeof entry.removeLabel === 'string' && entry.removeLabel.trim()) {
    removeLabels = [entry.removeLabel.trim()];
  }
  const wantClose = entry.close === true;
  if (!comment && !addLabel && removeLabels.length === 0 && !wantClose) {
    fail('entry has nothing to do (no comment, removeLabel, addLabel, or close).');
  }

  // Step 1 — comment.
  if (comment) {
    const posted = gh(['issue', 'comment', issue, '--body-file', '-'], { input: comment });
    if (!posted.ok) fail(`comment post failed: ${ghReason(posted)}`);
    const norm = (s) => (s || '').replace(/\r\n/g, '\n').trim();
    const verifyOnce = () => {
      const v = gh(['issue', 'view', issue, '--json', 'comments', '--jq', '.comments[-1].body']);
      return v.ok && norm(v.out) === norm(comment);
    };
    if (!verifyOnce()) { sleepMs(2000); if (!verifyOnce()) fail('comment posted but verification failed (could not confirm the latest comment). Investigate before retrying — re-running would double-post.'); }
    done.push('commented');
  }

  // Step 2 — relabel. Read current labels first so an absent removeLabel is
  // skipped (gh issue edit --remove-label errors on a label not on the issue).
  if (addLabel || removeLabels.length) {
    const readLabels = () => {
      const v = gh(['issue', 'view', issue, '--json', 'labels', '--jq', '[.labels[].name]']);
      if (!v.ok) return null;
      try { return JSON.parse(v.out); } catch { return null; }
    };
    const cur = readLabels();
    if (cur === null) fail('could not read current labels.');
    const toRemove = removeLabels.filter((l) => cur.includes(l));
    const needAdd = addLabel && !cur.includes(addLabel);
    if (toRemove.length || needAdd) {
      const args = ['issue', 'edit', issue];
      toRemove.forEach((l) => { args.push('--remove-label', l); });
      if (needAdd) args.push('--add-label', addLabel);
      const r = gh(args);
      if (!r.ok) fail(`relabel failed: ${ghReason(r)}`);
      const verifyOnce = () => {
        const after = readLabels();
        if (after === null) return false;
        return (!addLabel || after.includes(addLabel)) && toRemove.every((l) => !after.includes(l));
      };
      if (!verifyOnce()) { sleepMs(2000); if (!verifyOnce()) fail('relabel sent but verification failed (label state mismatch).'); }
    }
    const parts = [];
    if (toRemove.length) parts.push(`removed ${toRemove.join(', ')}`);
    if (needAdd) parts.push(`added ${addLabel}`);
    done.push(parts.length ? `relabeled (${parts.join('; ')})` : 'labels already correct');
  }

  // Step 3 — close.
  if (wantClose) {
    const st = gh(['issue', 'view', issue, '--json', 'state', '--jq', '.state']);
    if (!st.ok || st.out !== 'CLOSED') {
      const c = gh(['issue', 'close', issue]);
      if (!c.ok) fail(`close failed: ${ghReason(c)}`);
    }
    const verifyOnce = () => {
      const v = gh(['issue', 'view', issue, '--json', 'state', '--jq', '.state']);
      return v.ok && v.out === 'CLOSED';
    };
    if (!verifyOnce()) { sleepMs(2000); if (!verifyOnce()) fail('close sent but the issue is not CLOSED.'); }
    done.push('closed');
  }

  // Board sync — non-blocking. A close wins; otherwise the newly-added label.
  let board = '';
  const column = wantClose ? LABEL_TO_COLUMN.closed : (addLabel ? LABEL_TO_COLUMN[addLabel] : null);
  if (column) board = ` ${boardSyncCore(issue, column)}.`;
  else if (addLabel) board = ` Board: no mapping for "${addLabel}".`;

  console.log(`${op} #${issue}: ✓ ${done.join(', ')}. Verified.${board}`);
  process.exit(0);
}

// --- Visual journal (delegated VISUAL-JOURNAL.md entry merge) ---
//
// journalUpdate — replace-or-append one ticket's entry in
// cowmoo/design/VISUAL-JOURNAL.md from a handoff entry
// { op, ticket, domain, screen, date, summary }. The journal keeps the LATEST
// summary per ticket — a re-approval replaces the prior entry in place. The
// file is parsed by entry heading (`## #<n> `), so the merge is deterministic
// (no text splicing). Prints exactly one report line and sets the exit code.
// UXUI-specific — only UXUI maintains a visual journal.
function journalUpdate() {
  const { entry, op } = loadHandoffEntry('journal-update', 'UPDATE_JOURNAL');
  const fail = (msg) => { console.log(`${op}: ✗ ${msg}`); process.exit(1); };

  const ticket = (entry.ticket != null) ? String(entry.ticket) : '';
  const domain = (typeof entry.domain === 'string') ? entry.domain.trim() : '';
  const screen = (typeof entry.screen === 'string') ? entry.screen.trim() : '';
  const date = (typeof entry.date === 'string') ? entry.date.trim() : '';
  const summary = (typeof entry.summary === 'string') ? entry.summary.trim() : '';
  if (!/^[0-9]+$/.test(ticket)) fail(`entry "ticket" must be an issue number (got "${entry.ticket}").`);
  if (!domain) fail('entry is missing "domain".');
  if (!screen) fail('entry is missing "screen".');
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(date)) fail(`entry "date" must be YYYY-MM-DD (got "${entry.date}").`);
  if (!summary) fail('entry is missing "summary".');
  // The journal is parsed by splitting on `## #<n> ` entry headings (see the
  // raw.split below), so a summary containing such a line would be split off as
  // a phantom entry on the next journal-update run. Reject it — this regex
  // matches the parser's heading shape exactly.
  if (/^## #[0-9]+ /m.test(summary)) fail('entry "summary" must not contain a line shaped like a journal entry heading ("## #<n> ...") — rephrase it.');

  const journalPath = path.join(PROJECT_DIR, 'cowmoo', 'design', 'VISUAL-JOURNAL.md');
  const PREAMBLE = '# Visual Journal\n\n'
    + 'Running record of approved design bundles. Each entry is the LATEST summary for '
    + 'that ticket — on re-approval, the prior entry is replaced in place.\n\n'
    + 'Consumers: `/design-start` reads this file to synthesize visual direction for new '
    + 'batches. Builder and planner may read it for context on approved design character.\n\n'
    + '---\n';
  const block = `## #${ticket} — ${domain}/${screen} (approved ${date})\n\n`
    + `${summary}\n\n`
    + `**Bundle:** \`cowmoo/design/bundles/${ticket}/\`\n`;

  // Load existing entries — parse by entry heading, so the merge is
  // format-agnostic and deterministic.
  let preamble = PREAMBLE;
  let entries = []; // [{ ticket, text }]
  if (fs.existsSync(journalPath)) {
    let raw;
    try { raw = fs.readFileSync(journalPath, 'utf8'); } catch { fail('VISUAL-JOURNAL.md exists but is unreadable.'); }
    const parts = raw.split(/(?=^## #[0-9]+ )/m);
    if (parts.length && !/^## #[0-9]+ /.test(parts[0])) {
      const p = parts.shift().replace(/\s+$/, '');
      if (p) preamble = p + '\n';
    }
    entries = parts.map((t) => {
      const m = t.match(/^## #([0-9]+) /);
      // Strip trailing whitespace and any legacy `---` divider between entries.
      const text = t.replace(/\s+$/, '').replace(/\n+---\s*$/, '').replace(/\s+$/, '');
      return { ticket: m[1], text };
    });
  }

  // Replace-or-append the entry for this ticket.
  const idx = entries.findIndex((e) => e.ticket === ticket);
  const action = idx >= 0 ? 'replaced' : 'appended';
  if (idx >= 0) entries[idx] = { ticket, text: block.replace(/\s+$/, '') };
  else entries.push({ ticket, text: block.replace(/\s+$/, '') });

  // Reassemble: preamble, then entries separated by a blank line.
  const out = preamble.replace(/\s+$/, '') + '\n\n'
    + entries.map((e) => e.text).join('\n\n') + '\n';
  try { fs.writeFileSync(journalPath, out); } catch (e) { fail(`could not write VISUAL-JOURNAL.md: ${e.message}.`); }

  // Self-verify the write.
  let back;
  try { back = fs.readFileSync(journalPath, 'utf8'); } catch { fail('wrote VISUAL-JOURNAL.md but could not re-read it.'); }
  const count = (back.match(new RegExp(`^## #${ticket} `, 'mg')) || []).length;
  if (count !== 1) fail(`write verification failed — expected exactly 1 entry for #${ticket}, found ${count}.`);
  if (!back.includes(summary)) fail('write verification failed — summary text not present after write.');
  if (!back.startsWith('# Visual Journal')) fail('write verification failed — the "# Visual Journal" header was lost.');

  console.log(`${op} #${ticket}: ✓ journal entry ${action} in VISUAL-JOURNAL.md.`);
  process.exit(0);
}

// --- Review scan + resume state (classification + partial-run detection) ---
//
// UXUI-specific, like bundle-fetch / journal-update. Two read-only helpers
// that move mechanical work out of the review skills:
//
//   review-scan                       — facts /catchup classifies from
//   review-resume-state <issue> <dom>  — partial-run detection for /approve-design

// SHARE_URL_RE — a Claude Design share URL (api.anthropic.com export host or
// the claude.ai/design viewer). Global so `.match` returns every hit.
const SHARE_URL_RE = /https:\/\/(?:api\.anthropic\.com\/v1\/design\/h\/|claude\.ai\/design\/)[^\s)\]]+/g;

// reviewScan — one GraphQL call returning every OPEN `uxui:review` issue with
// the facts /catchup needs to classify it: title, labels, whether a Claude
// Design share URL is present anywhere in the comments (and the most recent
// such URL), and the full comment thread. Comments are read in full (`last:100`
// — effectively the whole thread for a review card) so URL detection never
// misses a URL posted in an older comment, and so the agent sees the task's
// full context. Saves /catchup from N per-issue `gh issue view` reads. Prints
// a JSON array (`[]` when none / no repo). Always exits 0.
function reviewScan() {
  const repo = process.env.GH_REPO || '';
  const slash = repo.indexOf('/');
  if (slash < 1 || slash === repo.length - 1) { console.log('[]'); process.exit(0); }
  const owner = repo.slice(0, slash);
  const name = repo.slice(slash + 1);
  const q = `query { repository(owner:"${owner}",name:"${name}") { issues(first:50, states:OPEN, labels:["uxui:review"]) { nodes { number title labels(first:20){nodes{name}} comments(last:100){nodes{author{login} body}} } } } }`;
  const raw = run(`gh api graphql -f query=${JSON.stringify(q)}`);
  if (!raw) { console.log('[]'); process.exit(0); }
  let nodes;
  try { nodes = JSON.parse(raw).data.repository.issues.nodes; } catch { console.log('[]'); process.exit(0); }
  if (!Array.isArray(nodes)) { console.log('[]'); process.exit(0); }
  const out = nodes.map((n) => {
    const comments = ((n.comments && n.comments.nodes) || []).map((c) => ({
      author: (c && c.author && c.author.login) || '-',
      body: (c && c.body) || '',
    }));
    let shareUrl = null;
    for (let i = comments.length - 1; i >= 0 && shareUrl === null; i--) {
      const m = comments[i].body.match(SHARE_URL_RE);
      if (m && m.length) shareUrl = m[m.length - 1];
    }
    return {
      number: n.number,
      title: n.title || '',
      labels: ((n.labels && n.labels.nodes) || []).map((l) => l.name),
      hasShareUrl: shareUrl !== null,
      shareUrl,
      comments,
    };
  });
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

// reviewResumeState — given an issue number and domain, report whether a prior
// /approve-design run already attached a `**Bundle:**` line for this ticket,
// the `### ` screen heading that line sits under, and whether the domain file
// has uncommitted changes. Replaces the grep+porcelain detection the approval
// skill used to carry inline. The caller compares `heading` to the target
// screen to tell uncommitted / committed / misattributed apart. Prints exactly
// one line; always exits 0.
//   RESUME: none
//   RESUME: found line=<n> heading="<heading>" porcelain=<clean|dirty>
//   RESUME: error — <reason>
function reviewResumeState(issue, domain) {
  if (!issue || !/^[0-9]+$/.test(String(issue)) || !domain) {
    console.log('RESUME: error — usage: review-resume-state <issue> <domain>');
    process.exit(0);
  }
  if (!PROJECT_DIR) { console.log('RESUME: error — PROJECT_DIR unset.'); process.exit(0); }
  const domainPath = path.join(PROJECT_DIR, 'cowmoo', 'design', 'domains', `${domain}.md`);
  if (!fs.existsSync(domainPath)) { console.log(`RESUME: error — domain file not found: ${domain}.md`); process.exit(0); }
  let lines;
  try { lines = fs.readFileSync(domainPath, 'utf8').split('\n'); } catch (e) { console.log(`RESUME: error — ${e.message}`); process.exit(0); }
  const marker = '`cowmoo/design/bundles/' + issue + '/`';
  let hitLine = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(marker)) { hitLine = i; break; }
  }
  if (hitLine < 0) { console.log('RESUME: none'); process.exit(0); }
  let heading = '(none)';
  for (let i = hitLine; i >= 0; i--) {
    if (/^###\s+/.test(lines[i])) { heading = lines[i].replace(/^###\s+/, '').trim(); break; }
  }
  const porc = run(`git -C ${JSON.stringify(PROJECT_DIR)} status --porcelain -- cowmoo/design/domains/${domain}.md`);
  const state = (porc && porc.trim()) ? 'dirty' : 'clean';
  console.log(`RESUME: found line=${hitLine + 1} heading=${JSON.stringify(heading)} porcelain=${state}`);
  process.exit(0);
}

// --- Board reconcile (mechanical label↔column alignment) ---
//
// The project board's Status column is the human's intent; the issue label
// follows it. boardReconcile aligns every OPEN card in a UXUI status column
// (UX: Todo / UX: In Progress / UX: Review) to the matching `uxui:*` label,
// and FLAGS — without changing — the two cases a blind align would corrupt:
//   - a `uxui:*` card dragged into "Done": `uxui:done` means the bundle is
//     attached + the journal written (only /approve-design produces those);
//     a mechanical relabel would fake-approve it.
//   - a cross-domain drag: a `uxui:*` card in a non-UXUI column, or a foreign
//     card in a UXUI column — almost always a mistake.
// Closed issues are skipped. UXUI-specific, like bundle-fetch / review-scan.

const UX_COLUMN_TO_LABEL = {
  'UX: Todo': 'uxui:todo',
  'UX: In Progress': 'uxui:in-progress',
  'UX: Review': 'uxui:review',
};
const UXUI_LABELS = ['uxui:todo', 'uxui:in-progress', 'uxui:review', 'uxui:done'];

// boardReconcile — align labels to board columns; flag what cannot be aligned
// mechanically. Prints one line per action (`RECONCILE: aligned …` /
// `RECONCILE: flag …`), `RECONCILE: ok` when nothing drifted, or
// `RECONCILE: no board`. Always exits 0 — a reconcile miss never blocks /catchup.
function boardReconcile() {
  const projectId = resolveProjectId();
  if (!projectId) { console.log('RECONCILE: no board'); process.exit(0); }
  const q = `query { node(id: "${projectId}") { ... on ProjectV2 { items(first: 100) { nodes { content { ... on Issue { number state labels(first: 20) { nodes { name } } } } fieldValueByName(name: "Status") { ... on ProjectV2ItemFieldSingleSelectValue { name } } } } } } }`;
  const raw = run(`gh api graphql -f query=${JSON.stringify(q)}`);
  if (!raw) { console.log('RECONCILE: no board'); process.exit(0); }
  let nodes;
  try { nodes = JSON.parse(raw).data.node.items.nodes; } catch { console.log('RECONCILE: no board'); process.exit(0); }
  if (!Array.isArray(nodes)) { console.log('RECONCILE: no board'); process.exit(0); }

  let actions = 0;
  for (const n of nodes) {
    if (!n || !n.content || typeof n.content.number !== 'number') continue;
    if (n.content.state === 'CLOSED') continue;
    const column = n.fieldValueByName && n.fieldValueByName.name;
    if (!column) continue;
    const num = n.content.number;
    const labels = ((n.content.labels && n.content.labels.nodes) || []).map((l) => l.name);
    const uxuiLabels = labels.filter((l) => UXUI_LABELS.includes(l));

    if (uxuiLabels.length > 1) {
      console.log(`RECONCILE: flag #${num} carries ${uxuiLabels.join(' + ')} — multiple UXUI labels; left as-is`);
      actions++;
      continue;
    }
    const cur = uxuiLabels[0] || null;
    const target = UX_COLUMN_TO_LABEL[column];

    if (target) {
      if (!cur) {
        console.log(`RECONCILE: flag #${num} (no uxui label) in "${column}" — foreign card in a UXUI column; left as-is`);
        actions++;
      } else if (cur !== target) {
        const r = run(`gh issue edit ${num} --remove-label ${JSON.stringify(cur)} --add-label ${JSON.stringify(target)}`);
        if (r === null) console.log(`RECONCILE: flag #${num} — relabel ${cur} → ${target} failed; left as-is`);
        else console.log(`RECONCILE: aligned #${num} ${cur} → ${target} ("${column}")`);
        actions++;
      }
    } else if (column === 'Done') {
      if (cur && cur !== 'uxui:done') {
        console.log(`RECONCILE: flag #${num} ${cur} in "Done" — dragged to Done; run /review-bundle to approve it (a mechanical relabel would skip the bundle attachment); left as-is`);
        actions++;
      }
    } else if (cur) {
      console.log(`RECONCILE: flag #${num} ${cur} in "${column}" — cross-domain drag (UXUI card outside the UXUI columns); left as-is`);
      actions++;
    }
  }
  if (actions === 0) console.log('RECONCILE: ok — board matches labels');
  process.exit(0);
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
  case 'design-draft':
    switch (subcommand) {
      case 'clear': designDraftClear(); break;
      default: console.log('Usage: design-draft <clear>');
    }
    break;
  case 'workflow-check':
    workflowCheck(subcommand);
    break;
  case 'next-step':
    nextStep();
    break;
  case 'bundle-fetch':
    bundleFetch();
    break;
  case 'commit':
    if (subcommand === 'general') {
      commitOp(UXUI_GENERAL_PROFILE, process.argv[4] || '');
    } else if (subcommand === 'roles') {
      commitOp(UXUI_ROLES_PROFILE, process.argv[4] || '');
    } else if (subcommand === 'attach-design') {
      const domain = process.argv[4];
      if (!domain) { console.log('ATTACH_DESIGN: ✗ usage: commit attach-design <domain> "<message>"'); process.exit(1); }
      commitOp(uxuiAttachProfile(domain), process.argv[5] || '');
    } else {
      console.log('COMMIT: ✗ usage: commit <general|roles|attach-design> [<domain>] "<message>"');
      process.exit(1);
    }
    break;
  case 'push':
    pushOp();
    break;
  case 'board-drags':
    boardDragsOp(process.argv[3], process.argv[4]);
    break;
  case 'board-reconcile':
    boardReconcile();
    break;
  case 'review-scan':
    reviewScan();
    break;
  case 'review-resume-state':
    reviewResumeState(process.argv[3], process.argv[4]);
    break;
  case 'issue-create':
    issueCreate();
    break;
  case 'issue-transition':
    issueTransition();
    break;
  case 'journal-update':
    journalUpdate();
    break;
  default:
    console.log('Usage: node "$AGENT_DIR/tools/dev-tools.cjs" <hook|git-check|territory-check|check-files|inbox|design-draft|workflow-check|next-step|bundle-fetch|commit|push|board-drags|board-reconcile|review-scan|review-resume-state|issue-create|issue-transition|journal-update>');
}
