#!/usr/bin/env node
'use strict';

const { execSync, execFileSync } = require('child_process');
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

// --- Commit (canonical pathspec-restricted commit for @plan-ops) ---
//
// One tested implementation of the canonical commit procedure: merge-state
// guard, pathspec-restricted commit, index-lock retry, hash-pinned
// content-verify. The ops agent invokes `node tools/dev-tools.cjs commit
// "<message>"` and relays the printed report verbatim.
//
// Output markers (the ops agent and /publish skill match on these):
//   COMMIT: ✓ <hash> <subject>...   — success            (exit 0)
//   COMMIT: Nothing to commit.      — no territory change (exit 0)
//   COMMIT: ✗ <reason>              — refused or failed   (exit 1)
//
// Planner territory: cowmoo/agent-files/planner/ and cowmoo/stack/.

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

// Planner commit profile — inclusion-form over the two planner territory roots.
const PLANNER_TERRITORY_ROOTS = ['cowmoo/agent-files/planner', 'cowmoo/stack'];
const PLANNER_COMMIT_PROFILE = {
  op: 'COMMIT',
  form: 'inclusion',
  pathspec: PLANNER_TERRITORY_ROOTS,
  inTerritory: (p) => PLANNER_TERRITORY_ROOTS.some((r) => p === r || p.startsWith(r + '/')),
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
  case 'commit':
    commitOp(PLANNER_COMMIT_PROFILE, process.argv[3] || '');
    break;
  case 'push':
    pushOp();
    break;
  case 'board-add':
    boardAddOp(process.argv[3]);
    break;
  default:
    console.log('Usage: node tools/dev-tools.cjs <hook|git-check|territory-check|check-files|inbox|workflow-check|next-step|clear-draft|clear-techstack-notes|commit|push|board-add>');
}
