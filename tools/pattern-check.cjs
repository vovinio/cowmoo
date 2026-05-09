#!/usr/bin/env node
'use strict';

//
// Pattern Check — write-time feedback on herd/ files
//
// Runs as a PostToolUse hook on Edit|Write. Receives $TOOL_INPUT (JSON with
// file_path). If the edited file is under herd/ and touches one of the
// patterns in docs/PATTERN-CATALOG.md, print advisories to stdout so the
// LLM sees them immediately and can fix them in the same turn.
//
// This is a fast pattern sniff — not a full audit. It catches the structural
// shapes we can cheaply verify: frontmatter completeness, Prerequisite
// placement, paths: in herd rules, etc. Deeper checks live in /check,
// /patterns, /contracts, and /coherence.
//
// Never blocks. Prints advisories; always exits 0. The goal is loud early
// feedback, not a gate.
//

const fs = require('fs');
const path = require('path');

const input = process.env.TOOL_INPUT;
if (!input) process.exit(0);

let filePath;
try { filePath = JSON.parse(input).file_path || ''; } catch { process.exit(0); }
if (!filePath) process.exit(0);

// Only check herd/ files. Everything else is curator territory and out of scope.
const rel = path.isAbsolute(filePath)
  ? path.relative(process.cwd(), filePath)
  : filePath;
if (!rel.startsWith('herd/')) process.exit(0);

// Read the file. If it's gone or unreadable, nothing to check.
let content;
try { content = fs.readFileSync(filePath, 'utf8'); } catch { process.exit(0); }

const advisories = [];
const advise = (msg) => advisories.push(`PATTERN-CHECK: ${msg}`);

// ── Classify file by location ────────────────────────────────────────

const isSubagent = /^herd\/[^/]+\/\.claude\/agents\/[^/]+\.md$/.test(rel);
const isSkill    = /^herd\/[^/]+\/\.claude\/skills\/[^/]+\/SKILL\.md$/.test(rel);
const isRule     = /^herd\/[^/]+\/\.claude\/rules\/[^/]+\.md$/.test(rel);

// ── Helper: parse frontmatter ────────────────────────────────────────

function frontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const keys = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (kv) keys[kv[1]] = kv[2].trim();
  }
  return { block: m[0], keys };
}

// ── Sub-agent checks (Patterns 6 frontmatter, 7, 14) ─────────────────

if (isSubagent) {
  const fm = frontmatter(content);
  if (!fm) {
    advise(`${rel}: missing frontmatter block. Sub-agents require name/description/tools at minimum.`);
  } else {
    for (const key of ['name', 'description', 'tools']) {
      if (!fm.keys[key]) advise(`${rel}: frontmatter missing \`${key}:\` — required for sub-agents.`);
    }
    if (!fm.keys['model']) {
      advise(`${rel}: frontmatter has no \`model:\` — default will apply. Set explicitly (haiku/sonnet/opus) for predictability.`);
    }
  }

  // Pattern 7: if body references a rules/<file>.md, that Read must be
  // inside a ## Prerequisite section — not Process Step 1.
  const ruleReferences = [...content.matchAll(/rules\/([a-z-]+)\.md/g)].map(m => m[1]);
  const uniqueRules = [...new Set(ruleReferences)];
  if (uniqueRules.length > 0) {
    const prereqMatch = content.match(/^## Prerequisite([\s\S]*?)(?=^## |\Z)/m);
    if (!prereqMatch) {
      advise(`${rel}: references rule file(s) (${uniqueRules.join(', ')}) but has no \`## Prerequisite\` section. Pattern 7 (Sub-Agent Read) requires the Read to live in \`## Prerequisite\` before \`## Process\` / \`## Operations\`.`);
    } else {
      for (const rule of uniqueRules) {
        if (!prereqMatch[1].includes(`rules/${rule}.md`)) {
          advise(`${rel}: Reads \`rules/${rule}.md\` but the Read is outside \`## Prerequisite\`. Move it into the Prerequisite block.`);
        }
      }
    }
  }

  // Pattern 14 (GitHub GraphQL Patterns) — the old `gh project list` /
  // `gh project item-add` pattern is unambiguously wrong. No prose ambiguity.
  if (/\-ops\.md$/.test(rel)) {
    if (/\bgh project list\b|\bgh project item-add\b/.test(content)) {
      advise(`${rel}: uses the old \`gh project list\`/\`gh project item-add\` pattern. Use the \`addProjectV2ItemById\` GraphQL mutation instead (Pattern 14 — GitHub GraphQL Patterns).`);
    }
  }

  // Bare git / `git add .` / `git add -A` checks belong in the deeper audit.
  // A fast hook can't distinguish a prose example ("never use `git add .`") from
  // a real bare command. The /patterns skill handles this with context.
}

// ── Skill checks (Pattern 16) ────────────────────────────────────────
//
// Authored herd skills declare name/description/user-invocable/
// disable-model-invocation, and typically also allowed-tools for
// per-skill tool scoping (defense-in-depth).
//
// Installed third-party skills (e.g., playwright-cli from Microsoft's
// `playwright-cli install --skills claude`) use only name/description/
// allowed-tools — they omit user-invocable AND disable-model-invocation.
// Patching them in place would be overwritten on the next installer run,
// so Pattern 16 doesn't apply to them.
//
// Detection: the presence of `allowed-tools:` is NOT the marker (authored
// skills also use it). The marker is `allowed-tools:` WITHOUT either of
// the two authored-convention keys.

if (isSkill) {
  const fm = frontmatter(content);
  if (!fm) {
    advise(`${rel}: missing frontmatter block. Skills require name/description/user-invocable/disable-model-invocation.`);
  } else {
    const hasUserInvocable = 'user-invocable' in fm.keys;
    const hasDisableModelInvocation = 'disable-model-invocation' in fm.keys;
    const hasAllowedTools = 'allowed-tools' in fm.keys;

    // Third-party shape: only allowed-tools, no authored-convention keys.
    // If either authored key is present, treat as authored-here and enforce.
    // If neither authored key is present AND no allowed-tools either, treat
    // as a broken authored skill and surface the missing keys.
    const thirdPartyShape = hasAllowedTools && !hasUserInvocable && !hasDisableModelInvocation;

    if (!thirdPartyShape) {
      for (const key of ['name', 'description', 'user-invocable', 'disable-model-invocation']) {
        if (!(key in fm.keys)) {
          advise(`${rel}: frontmatter missing \`${key}:\` — always set explicitly (Pattern 16).`);
        }
      }
    }
  }
}

// ── Rule checks (Pattern 17) ─────────────────────────────────────────

if (isRule) {
  const fm = frontmatter(content);
  if (fm && 'paths' in fm.keys) {
    advise(`${rel}: has \`paths:\` frontmatter. Herd rules must be always-loaded — \`paths:\` fires only on Read and isn't inherited by sub-agents (Pattern 17).`);
  }
}

// ── De-curation checks (unambiguous only) ────────────────────────────

// Catch violations where the match is unambiguous: the specific curator
// doc filenames, curator-only paths, curator skill slash-commands.
//
// The broad string checks ("cowmoo", "curator" without context) are noisy
// because herd files legitimately reference `cowmoo/specs/`, `cowmoo/design/`,
// and `curator` may appear inside a code fence as part of a user-facing URL
// or example. Those belong in /patterns / /check where context is available.
const decurationPatterns = [
  { re: /docs\/(ARCHITECTURE|COMMUNICATION|PATTERNS|PATTERN-CATALOG)\.md/, msg: `references a curator doc. Herd files must not reference docs/ (de-curation).` },
  { re: /\.claude\/asymmetries\//, msg: `references .claude/asymmetries/ — that's curator-only.` },
  { re: /\.claude\/audit-decisions\//, msg: `references .claude/audit-decisions/ — that's curator-only.` },
  { re: /\bprojects\.md\b/, msg: `references projects.md — that's the curator-only project registry.` },
  { re: /rules\/agent-files\.md/, msg: `references rules/agent-files.md — that's the curator-only editing rule.` },
  { re: /(?:^|\s|`)\/(?:check|patterns|contracts|coherence|rename-sweep|scaffold-subagent|audit-agent|audit-hygiene|curate|pressure-test)(?:\b|`)/, msg: `references a curator slash-command. Herd files can't invoke curator skills (de-curation).` },
];
for (const { re, msg } of decurationPatterns) {
  if (re.test(content)) advise(`${rel}: ${msg}`);
}

// ── Emit ──────────────────────────────────────────────────────────────

if (advisories.length > 0) {
  console.log(advisories.join('\n'));
}
process.exit(0);
