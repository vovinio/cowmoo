#!/usr/bin/env node
'use strict';

const { execSync, execFileSync } = require('child_process');
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

// --- Check Files ---

function checkFiles() {
  if (!PROJECT_DIR) { console.log('check-files: PROJECT_DIR not set'); return; }
  const fp = (rel) => path.join(PROJECT_DIR, rel);
  // working-notes status is reported the same way as the other files —
  // just existence/empty/has-content. Counts (and the semantic question
  // of which bullets are real items) belong to /start, which Reads the
  // file directly and assesses inline.
  console.log(`working-notes: ${fileStatus(fp('cowmoo/agent-files/pm/WORKING-NOTES.md'))}`);
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

  if (!run('command -v gh')) {
    issues.push('gh CLI not found. Install: https://cli.github.com');
  } else if (run('gh auth status') === null) {
    issues.push('gh installed but not authenticated. Run: gh auth login');
  }
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

  // Working-notes status is not reported at session start. /start does a
  // full Read of the file and assesses inline; pre-empting that here with
  // a partial status line would just duplicate noise.
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

// --- Downstream engagement check ---
//
// Returns whether downstream agents (planner, UXUI) have actually been launched
// and run on this project — used by /publish to gate the "run /notify"
// suggestion. On greenfield projects nothing's been handed off yet, so
// suggesting /notify is noise.
//
// Signals (any one is sufficient — both are file artifacts only the downstream
// agent could have written, since PM's permissions.deny blocks Edit/Write to
// these paths):
//   1. cowmoo/stack/techstack.md has content (planner ran /tech-stack)
//   2. cowmoo/design/domains/ has at least one file (UXUI has written domains)
//
// Deliberately NOT used as signals: for-planner / for-uxui GitHub labels.
// Those labels can be created entirely by PM itself (via /notify planner,
// /notify uxui, or /catchup relabeling a transferred issue), so their
// presence is not proof that the downstream agent ever ran. Using them
// would defeat the purpose — every PM session that has used /notify once
// would forever after see "engaged" even if the UXUI/planner agent itself
// has never been launched.
//
// Exit codes: 0 = engaged, 1 = greenfield, 2 = environment error.
//
function downstreamEngaged() {
  if (!PROJECT_DIR) {
    console.error('PROJECT_DIR not set');
    process.exit(2);
  }

  const reasons = [];

  // Signal 1: planner artifact (techstack.md is the canonical /tech-stack output)
  const techstackPath = path.join(PROJECT_DIR, 'cowmoo/stack/techstack.md');
  if (fs.existsSync(techstackPath)) {
    try {
      if (fs.readFileSync(techstackPath, 'utf8').trim().length > 0) {
        reasons.push('cowmoo/stack/techstack.md has content (planner has run)');
      }
    } catch {}
  }

  // Signal 2: UXUI artifact (domain files are the canonical UXUI output)
  const designDomainsPath = path.join(PROJECT_DIR, 'cowmoo/design/domains');
  if (dirExists(designDomainsPath)) {
    try {
      const entries = fs.readdirSync(designDomainsPath).filter(f => !f.startsWith('.'));
      if (entries.length > 0) {
        reasons.push(`cowmoo/design/domains/ has ${entries.length} file(s) (UXUI has run)`);
      }
    } catch {}
  }

  if (reasons.length > 0) {
    console.log(`engaged: ${reasons.join('; ')}`);
    process.exit(0);
  } else {
    console.log('greenfield: neither cowmoo/stack/techstack.md nor cowmoo/design/domains/* has been written by a downstream agent');
    process.exit(1);
  }
}

// --- Commit (canonical pathspec-restricted commit for @pm-ops) ---
//
// Replaces inline bash in @pm-ops COMMIT with one tested implementation:
// merge-state guard, pathspec-restricted commit, index-lock retry, and a
// hash-pinned content-verify. The ops agent invokes:
//   node "$AGENT_DIR/tools/dev-tools.cjs" commit "<message>"
// and relays the printed report verbatim.
//
// Output markers (the ops agent and /publish skill match on these):
//   COMMIT: ✓ <hash> <subject>...   — success           (exit 0)
//   COMMIT: Nothing to commit.      — no territory change (exit 0)
//   COMMIT: ✗ <reason>              — refused or failed   (exit 1)
//
// PM territory: cowmoo/specs/ and cowmoo/agent-files/pm/.

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

// PM commit profile — inclusion-form over the two PM territory roots.
const PM_TERRITORY_ROOTS = ['cowmoo/specs', 'cowmoo/agent-files/pm'];
const PM_COMMIT_PROFILE = {
  op: 'COMMIT',
  form: 'inclusion',
  pathspec: PM_TERRITORY_ROOTS,
  inTerritory: (p) => PM_TERRITORY_ROOTS.some((r) => p === r || p.startsWith(r + '/')),
};

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

// --- Project board (canonical label↔Status sync for the ops agents) ---
//
// Agent-independent — verbatim copy across all four dev-tools.cjs files.
//
// The board mirrors issue labels: labels are the source of truth, the board's
// Status field is kept in sync. LABEL_TO_COLUMN is the single definition of the
// mapping. boardSyncCore ensures the issue is a board item and sets its Status
// column; boardStatusOp is the `board-status` subcommand wrapper. NON-BLOCKING:
// a board miss never fails the calling operation.

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
// (the board-status subcommand, issueCreate) can splice the result into their
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

// boardStatusOp — `board-status <issue#> <label|closed>` subcommand wrapper.
// Maps the label/event to a column via LABEL_TO_COLUMN, syncs the board, and
// prints one line. Always exits 0 — a board problem never fails the real op.
function boardStatusOp(issueNumber, labelOrEvent) {
  const column = LABEL_TO_COLUMN[labelOrEvent];
  if (!column) { console.log(`Board: no mapping for "${labelOrEvent}"`); process.exit(0); }
  console.log(boardSyncCore(issueNumber, column));
  process.exit(0);
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
  case 'downstream-engaged':
    downstreamEngaged();
    break;
  case 'commit':
    commitOp(PM_COMMIT_PROFILE, process.argv[3] || '');
    break;
  case 'push':
    pushOp();
    break;
  case 'board-status':
    boardStatusOp(process.argv[3], process.argv[4]);
    break;
  case 'board-drags':
    boardDragsOp(process.argv[3], process.argv[4]);
    break;
  default:
    console.log('Usage: node "$AGENT_DIR/tools/dev-tools.cjs" <hook|git-check|territory-check|check-files|inbox|workflow-check|next-step|design-fetch|downstream-engaged|commit|push|board-status|board-drags>');
}
