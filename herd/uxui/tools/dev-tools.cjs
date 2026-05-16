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
  console.log(`design-draft: ${fileStatus(fp('cowmoo/agent-files/uxui/design-draft.md'))}`);
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
    review.forEach(i => console.log(`  #${i.number} ${i.title} → /review-bundle`));
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
const UNTRACKED = new Set(['status', 'propose', 'catchup', 'ask', 'notify', 'design-start', 'design-draft', 'design-publish', 'review-bundle']);
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
  return PROJECT_DIR ? path.join(PROJECT_DIR, 'cowmoo', 'agent-files', 'uxui', 'design-draft.md') : null;
}

function designDraftClear() {
  const p = designDraftPath();
  if (p && fs.existsSync(p)) fs.unlinkSync(p);
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
  // 60s per-call timeout (run() default is 15s) — project pre-commit hooks
  // (linters, type-checkers, signing) commonly exceed 15s on real repos.
  const relDir = path.relative(PROJECT_DIR, bundleDir);
  const addResult = run(`git -C ${JSON.stringify(PROJECT_DIR)} add ${JSON.stringify(relDir)}`, { timeout: 60000 });
  if (addResult === null) {
    console.log('FAIL git-add — could not stage bundle directory (files left in place for inspection)');
    process.exit(4);
  }

  const commitMsg = `design(${domain}): capture bundle for ticket #${ticket}`;
  const commitResult = run(`git -C ${JSON.stringify(PROJECT_DIR)} commit -m ${JSON.stringify(commitMsg)}`, { timeout: 60000 });
  if (commitResult === null) {
    console.log('FAIL git-commit — git commit failed (files left in place; check hook / signing / lock)');
    process.exit(5);
  }

  const shortHash = run(`git -C ${JSON.stringify(PROJECT_DIR)} rev-parse --short HEAD`) || '?';

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

// --- Commit (canonical pathspec-restricted commit for @uxui-git-ops) ---
//
// One tested implementation of the canonical commit procedure: merge-state
// guard, pathspec-restricted commit, index-lock retry, hash-pinned
// content-verify. The ops agent invokes one of:
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit general "<message>"
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit roles "<message>"
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit attach-design <domain> "<message>"
// and relays the printed report verbatim.
//
// Output markers (the ops agent and its caller skills match on these — the
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

// --- Push (canonical remote-sync for the ops agents) ---
//
// Replaces inline bash in the ops-agent PUSH operation. Agent-independent —
// push targets origin/HEAD regardless of which agent committed, so this takes
// no profile and is a verbatim copy across all four dev-tools.cjs files.
//
// Output markers (ops agent + /publish skills match on the PUSH: prefix):
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

// --- Project board (canonical issue→board linkage for the ops agents) ---
//
// Replaces the inline `## Project Board` bash block. Agent-independent —
// verbatim copy across all four dev-tools.cjs files.
//
// NON-BLOCKING: final step of an issue-creation op. Always exits 0.
//   Project: added         — issue added to the board
//   Project: no board      — repo has no linked ProjectV2 (or $GH_REPO unset)
//   Project: add failed    — board exists but the add did not complete
function boardAddOp(issueNumber) {
  const out = (line) => { console.log(line); process.exit(0); };  // always exit 0

  if (!issueNumber || !/^[0-9]+$/.test(String(issueNumber))) {
    return out('Project: add failed');
  }

  const repo = process.env.GH_REPO || '';
  const slash = repo.indexOf('/');
  if (slash < 1 || slash === repo.length - 1) {
    return out('Project: no board');  // $GH_REPO unset/malformed
  }
  const owner = repo.slice(0, slash);
  const name = repo.slice(slash + 1);

  // $GH_PROJECT_ID override honored first; else query first linked ProjectV2.
  let projectId = process.env.GH_PROJECT_ID && process.env.GH_PROJECT_ID.trim();
  if (!projectId) {
    const q = `{ repository(owner:"${owner}",name:"${name}") { projectsV2(first:1) { nodes { id } } } }`;
    projectId = run(`gh api graphql -f query=${JSON.stringify(q)} --jq '.data.repository.projectsV2.nodes[0].id'`);
  }
  if (!projectId || projectId === 'null') return out('Project: no board');

  const issueId = run(`gh issue view ${issueNumber} --json id --jq .id`);
  if (!issueId || issueId === 'null') return out('Project: add failed');

  const mut = `mutation { addProjectV2ItemById(input: {projectId: "${projectId}", contentId: "${issueId}"}) { item { id } } }`;
  const added = run(`gh api graphql -f query=${JSON.stringify(mut)}`);
  return out(added === null ? 'Project: add failed' : 'Project: added');
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
  case 'board-add':
    boardAddOp(process.argv[3]);
    break;
  default:
    console.log('Usage: node "$AGENT_DIR/tools/dev-tools.cjs" <hook|git-check|territory-check|check-files|inbox|design-draft|workflow-check|next-step|bundle-fetch|commit|push|board-add>');
}
