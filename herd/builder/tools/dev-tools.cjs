#!/usr/bin/env node
'use strict';

const { execSync, execFileSync } = require('child_process');
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

  if (!run('command -v gh')) {
    issues.push('gh CLI not found. Install: https://cli.github.com');
  } else if (run('gh auth status') === null) {
    issues.push('gh installed but not authenticated. Run: gh auth login');
  }

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

// --- Commit (canonical pathspec-restricted commit) ---
//
// One tested implementation of the canonical commit procedure: merge-state
// guard, pathspec-restricted commit, index-lock retry, hash-pinned
// content-verify. The /publish skill invokes `node "$AGENT_DIR/tools/dev-tools.cjs" commit
// <code|working> "<message>"` and reads the printed report.
//
// Output markers (the /publish skill matches on these):
//   COMMIT: ✓ <hash> <subject>...   — success            (exit 0)
//   COMMIT: Nothing to commit.      — no territory change (exit 0)
//   COMMIT: ✗ <reason>              — refused or failed   (exit 1)
//
// Builder has two commit scopes:
//   code    — the product tree, excluding other agents' territories (the
//             FORBIDDEN set) and ALL of cowmoo/agent-files. Exclusion-form.
//   working — builder's own scratch, cowmoo/agent-files/builder/. Inclusion-form.

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

// Builder commit profiles.
//
// code — exclusion-form: stage the whole product tree minus other agents'
//   territories and ALL of cowmoo/agent-files. Layout-agnostic (src/, app/,
//   tests/ at root, etc. all picked up).
const BUILDER_CODE_EXCLUDES = ['cowmoo/specs', 'cowmoo/stack', 'cowmoo/design', 'cowmoo/agent-files', 'cowmoo/config.json'];
const BUILDER_CODE_PROFILE = {
  op: 'COMMIT',
  form: 'exclusion',
  pathspec: ['.', ...BUILDER_CODE_EXCLUDES.map((e) => `:(exclude)${e}`)],
  inTerritory: (p) => !BUILDER_CODE_EXCLUDES.some((e) =>
    e.endsWith('.json') ? p === e : (p === e || p.startsWith(e + '/'))),
};
// working — inclusion-form: builder's own scratch + proposals.
const BUILDER_WORKING_ROOT = 'cowmoo/agent-files/builder';
const BUILDER_WORKING_PROFILE = {
  op: 'COMMIT',
  form: 'inclusion',
  pathspec: [BUILDER_WORKING_ROOT],
  inTerritory: (p) => p === BUILDER_WORKING_ROOT || p.startsWith(BUILDER_WORKING_ROOT + '/'),
};

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
  case 'commit': {
    const scope = subcommand;
    const message = process.argv[4] || '';
    if (scope === 'code') commitOp(BUILDER_CODE_PROFILE, message);
    else if (scope === 'working') commitOp(BUILDER_WORKING_PROFILE, message);
    else { console.log('COMMIT: ✗ usage: commit <code|working> "<message>"'); process.exit(1); }
    break;
  }
  case 'push':
    pushOp();
    break;
  case 'board-drags':
    boardDragsOp(process.argv[3], process.argv[4]);
    break;
  case 'issue-create':
    issueCreate();
    break;
  case 'issue-transition':
    issueTransition();
    break;
  default:
    console.log('Usage: node "$AGENT_DIR/tools/dev-tools.cjs" <hook|git-check|territory-check|workflow-check|next-step|detect-dev-servers|commit|push|board-drags|issue-create|issue-transition>');
}
