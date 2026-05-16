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

// --- Commit (canonical pathspec-restricted commit for @task-ops) ---
//
// One tested implementation of the canonical commit procedure: merge-state
// guard, pathspec-restricted commit, index-lock retry, hash-pinned
// content-verify. The ops agent invokes `node "$AGENT_DIR/tools/dev-tools.cjs" commit
// <code|working> "<message>"` and relays the printed report verbatim.
//
// Output markers (the ops agent and /publish skill match on these):
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
  case 'board-add':
    boardAddOp(process.argv[3]);
    break;
  default:
    console.log('Usage: node "$AGENT_DIR/tools/dev-tools.cjs" <hook|git-check|territory-check|workflow-check|next-step|detect-dev-servers|commit|push|board-add>');
}
