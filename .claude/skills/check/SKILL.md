---
name: check
description: Mechanical integrity checks — syntax, cross-references, frontmatter completeness, architectural invariants. Fast first-line validation; always runs first in the curator pipeline. Model-invokable after curator edits (propose, then run on user approval).
user-invocable: true
disable-model-invocation: false
---

# Check

Pure mechanical validation. Everything this skill flags is something grep, JSON.parse, or a syntax tool can decide without understanding patterns or semantics.

Run after any herd change, and always before `/patterns`, `/contracts`, or `/coherence` — those skills assume mechanical integrity holds.

This skill does not read `docs/PATTERN-CATALOG.md`. Pattern-level checks live in `/patterns`. The split is deliberate: mechanical checks never need to reason about intent, so they stay fast, cheap, and mechanical.

---

## Process

### Step 1 — Syntax

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# JavaScript
for f in herd/*/tools/*.cjs tools/*.cjs; do
  [ -f "$f" ] && (node -c "$f" && echo "  OK: $f" || echo "  FAIL: $f")
done

# JSON (settings.json, settings.local.json, .mcp.json)
for f in .claude/settings.json .claude/settings.local.json herd/*/.claude/settings.json herd/*/.claude/settings.local.json; do
  [ -f "$f" ] && (python3 -m json.tool < "$f" > /dev/null && echo "  OK: $f" || echo "  FAIL: $f")
done

# Shell
find herd/*/tools tools -name '*.sh' 2>/dev/null -exec bash -n {} \; -print
```

Any FAIL stops the skill immediately — broken syntax cascades into everything else.

### Step 2 — Regex portability (POSIX ERE)

Hook commands run on macOS with BSD/POSIX tools. PCRE shorthand doesn't work.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
for f in herd/*/.claude/settings.json .claude/settings.json; do
  [ -f "$f" ] && grep -q '\\s\|\\d\|\\w' "$f" 2>/dev/null && echo "  WARN: $f uses non-POSIX regex (\\s, \\d, or \\w). Use [[:space:]], [[:digit:]], [[:alnum:]_]."
done
```

### Step 3 — Frontmatter completeness

For every SKILL.md and sub-agent file, verify required frontmatter keys are present:

- **SKILL.md** — `name`, `description`, `user-invocable`, `disable-model-invocation` (authored skills). Installed third-party skills (detection marker per Pattern 16: `allowed-tools:` present AND both `user-invocable:` and `disable-model-invocation:` absent) are exempt — their upstream frontmatter convention is different and patching in place would be overwritten on the next installer run.
- **Sub-agents** — `name`, `description`, `tools`.

Any missing key on an authored skill is a CRITICAL finding. This is the same invariant `tools/pattern-check.cjs` enforces at write time, but we check it here too because the hook only fires on Edit/Write.

Detection: for every SKILL.md, parse frontmatter keys. If `allowed-tools` is present AND `user-invocable` is absent AND `disable-model-invocation` is absent, classify as installed-third-party and skip completeness checks. Otherwise enforce the four required keys.

### Step 4 — Cross-references

Every reference from any herd file to a named component must resolve to something that actually exists. Every existing component must be registered in its agent's CLAUDE.md.

A broken reference is a broken reference regardless of how it got there — rename, deletion, typo, or never-written target. State is the source of truth; git is not consulted. User-initiated rename propagation is handled separately by `/rename-sweep`, which takes an explicit old → new list.

**4a — Disk ↔ CLAUDE.md (bidirectional registration).**

A real slash-command is one preceded by start-of-line, whitespace, or a backtick AND not followed by `/` or another name character (which would make it a path fragment like `/tmp/foo`). Path segments like `cowmoo/specs/`, `.claude/settings.json`, or `$PROJECT_DIR/agent-files/` are NOT slash-commands. The trailing `(?![a-z0-9/-])` lookahead is what distinguishes them — without the full character class, the greedy `*` backtracks one char at a time and produces nonsense partial matches (e.g., `/tmp/foo` would match as `/tm`).

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
for agent in pm uxui planner builder; do
  # Forward: each /<skill> mentioned in CLAUDE.md must resolve to a skill
  # directory — in THIS agent, or (legitimate cross-agent workflow
  # reference) in another herd agent. Herd agents reference each other's
  # skills by design: planner names builder's /map-codebase, planner tells
  # the user to "ask PM to run /digest", builder's /return points at
  # planner's /catchup. Only a /<skill> that exists in NO herd agent is a
  # broken reference. (Curator skills like /check live outside herd/ and
  # are caught by Step 7, not here.)
  # --pcre2 is required for lookbehind; without it rg silently errors out
  # and the check reports a false PASS. The trailing (?![a-z0-9/-]) rejects
  # path fragments like `/tmp/foo`. The full character class is required:
  # `(?!/)` alone lets the greedy `*` backtrack one char at a time and
  # match `/tm` instead of failing — needs the name-class chars excluded too.
  rg -N --pcre2 -o '(?:^|(?<=[\s`]))/[a-z][a-z0-9-]*(?![a-z0-9/-])' "herd/$agent/CLAUDE.md" 2>/dev/null \
    | sed 's|^/||' | sort -u | while read name; do
    [ "$name" = "propose" ] && continue
    [ -d "herd/$agent/.claude/skills/$name" ] && continue
    # Not this agent's skill — legitimate if another herd agent owns it.
    in_herd=""
    for other in pm uxui planner builder; do
      [ -d "herd/$other/.claude/skills/$name" ] && in_herd=1
    done
    [ -n "$in_herd" ] && continue
    echo "  FAIL: herd/$agent/CLAUDE.md mentions /$name but no herd agent has a skills/$name/ directory"
  done

  # Reverse: each disk skill is referenced
  for d in herd/$agent/.claude/skills/*/; do
    [ -d "$d" ] || continue
    name=$(basename "$d")
    grep -qw "$name" "herd/$agent/CLAUDE.md" || echo "  FAIL: herd/$agent/.claude/skills/$name/ exists but is not referenced in CLAUDE.md"
  done

  # Reverse: each sub-agent file is referenced
  for f in herd/$agent/.claude/agents/*.md; do
    [ -f "$f" ] || continue
    name=$(basename "$f" .md)
    grep -q "@${name}\b" "herd/$agent/CLAUDE.md" || echo "  WARN: herd/$agent/.claude/agents/$name.md exists but \`@$name\` is not referenced in CLAUDE.md"
  done
done
```

**4b — Body-level references (all herd files, not just CLAUDE.md).**

Every `@<name>` and `rules/<name>.md` reference inside a skill body, sub-agent body, or rule body must resolve to a target in the same herd agent.

Two rg flags are required here: `--hidden` so rg descends into `.claude/` (a hidden directory, skipped by default even when passed explicitly in some rg builds), and `-I` / `--no-filename` so rg emits only the matched token without a `file:` prefix when multiple paths are given (otherwise downstream `sed` can't strip the name cleanly).

Installed third-party skills (Pattern 16 carveout — detected by `allowed-tools:` present AND both `user-invocable:` and `disable-model-invocation:` absent) often contain `@token` references that aren't sub-agent invocations (NPM package names like `@playwright`, dist-tag refs like `@latest`). Their dirs are excluded from the `@<name>` scan via `--glob`. If a new installed third-party skill is added, extend the exclude list.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
# Build --glob excludes for installed third-party skill dirs.
# Detection per Pattern 16: allowed-tools present AND neither of the two required keys.
mk_excludes() {
  local d fm
  for d in herd/*/.claude/skills/*/SKILL.md; do
    [ -f "$d" ] || continue
    fm=$(awk '/^---$/{c++;next} c==1{print}' "$d")
    echo "$fm" | grep -q "^allowed-tools:" || continue
    echo "$fm" | grep -qE "^(user-invocable|disable-model-invocation):" && continue
    printf -- "--glob !%s/** " "$(dirname "$d")"
  done
}
EXCLUDES=$(mk_excludes)

for agent in pm uxui planner builder; do
  base="herd/$agent"

  # @<name> references — must resolve to a sub-agent in the same agent.
  rg -INo --hidden $EXCLUDES "@[a-z][a-z0-9-]+" \
       "$base/CLAUDE.md" "$base/.claude/skills/" "$base/.claude/agents/" "$base/.claude/rules/" 2>/dev/null \
    | sed 's/^@//' | sort -u | while read name; do
    [ -f "$base/.claude/agents/$name.md" ] \
      || echo "  FAIL: $agent references @$name but herd/$agent/.claude/agents/$name.md doesn't exist"
  done

  # rules/<name>.md references in skill and sub-agent bodies.
  rg -INo --hidden "\.claude/rules/([a-z-]+)\.md" "$base/.claude/skills/" "$base/.claude/agents/" 2>/dev/null \
    | sed 's|.*/rules/||; s|\.md||' | sort -u | while read rule; do
    [ -f "$base/.claude/rules/$rule.md" ] \
      || echo "  FAIL: $agent references rules/$rule.md but herd/$agent/.claude/rules/$rule.md doesn't exist"
  done

  # templates/<name>.md references anywhere in the agent.
  rg -INo --hidden "\.claude/templates/([a-z-]+)\.md" "$base/" 2>/dev/null \
    | sed 's|.*/templates/||; s|\.md||' | sort -u | while read tpl; do
    [ -f "$base/.claude/templates/$tpl.md" ] \
      || echo "  FAIL: $agent references templates/$tpl.md but the template doesn't exist"
  done
done
```

Both sub-steps run independently. Missing `@<name>` → CRITICAL; missing `rules/<name>.md` → CRITICAL.

> **No body-level `/<skill>` check.** A herd skill/agent body referencing a `/<skill>` that doesn't exist is *not* mechanically decidable — herd bodies legitimately contain slash-prefixed example content (URL routes like `/login`, paths like `/path`), and a regex cannot tell an example route from a real skill reference. That distinction needs comprehension, which violates this skill's "mechanical only" rule. The real cases are covered elsewhere: stale herd-skill references are caught by `/rename-sweep` (on rename) and `/patterns` / `/audit-agent` (body-reading passes); curator-skill references in herd files are a hard FAIL in Step 7's de-curation check.

### Step 5 — Skill → dev-tools subcommand existence

Every git / GitHub write is a `dev-tools.cjs` subcommand a skill invokes directly (Pattern 6 — Delegated Write Operation). For every `node "$AGENT_DIR/tools/dev-tools.cjs" <subcommand>` invocation in a skill or sub-agent body, `<subcommand>` must be a real dispatcher `case` in that agent's `dev-tools.cjs`.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
for agent in pm uxui planner builder; do
  dt="herd/$agent/tools/dev-tools.cjs"
  [ -f "$dt" ] || continue
  # Every dispatcher case label (top-level and nested-inner alike).
  cases=$(grep -oE "case '[a-z-]+':" "$dt" | sed "s/case '//; s/'://" | sort -u)
  # First token after the anchored `dev-tools.cjs"` path in any invocation. The
  # closing `"` of "$AGENT_DIR/tools/dev-tools.cjs" then whitespace then the
  # subcommand — prose `` `dev-tools.cjs` `` (backtick, not `"`) does not match.
  rg -No --hidden 'dev-tools\.cjs"[[:space:]]+[a-z][a-z-]+' \
       "herd/$agent/.claude/skills/" "herd/$agent/.claude/agents/" 2>/dev/null \
    | sed -E 's|.*dev-tools\.cjs"[[:space:]]+||' | sort -u | while read sub; do
    [ -z "$sub" ] && continue
    echo "$cases" | grep -qx "$sub" \
      || echo "  FAIL: $agent invokes dev-tools.cjs '$sub' but no matching case in $dt"
  done
done
```

A skill invoking a subcommand its agent's `dev-tools.cjs` does not define = CRITICAL. The reverse direction — every `case` has a caller — is Step 6.

### Step 6 — Dev-tools subcommand round-trip

Every `case '<x>':` in an agent's `dev-tools.cjs` — whether at the top level or inside a nested dispatch (e.g. `case 'inbox':` containing an inner switch with `case 'add':`, `case 'list':`, …) — must be called from at least one of: a SKILL.md, a sub-agent file, the agent's settings.json hooks, or the agent's statusline.sh.

**Nested-dispatch aware.** `grep` on `dev-tools.cjs <sub>` alone misses nested calls like `dev-tools.cjs inbox add`. The regex below matches `dev-tools.cjs` followed by any number of intermediate tokens, then the subcommand, then a non-word boundary. This treats both top-level and nested-inner case labels as "called" when any invocation chain ends in that name.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
for agent in pm uxui planner builder; do
  dt="herd/$agent/tools/dev-tools.cjs"
  [ -f "$dt" ] || continue
  # Extract all case labels (top-level and nested alike)
  grep -oE "case '[a-z-]+':" "$dt" | sed "s/case '//; s/'://" | sort -u | while read sub; do
    [ "$sub" = "default" ] && continue
    # Match `dev-tools.cjs" [outer [inner …]] <sub>` — `[^ ]*` skips the
    # closing quote of the anchored `"$AGENT_DIR/tools/dev-tools.cjs"` path
    # (plain `"` in skills/agents, `\"` in settings.json). $sub is followed
    # by a non-word (space, quote, eol) so `inbox` does NOT match
    # `inbox-foo` and `clear` does NOT match `clearSession`.
    if ! grep -qE "dev-tools\.cjs[^ ]*( [a-zA-Z0-9_-]+)* $sub([^a-zA-Z0-9_-]|\$)" \
         "herd/$agent/.claude/settings.json" \
         "herd/$agent/tools/statusline.sh" \
         herd/$agent/.claude/skills/*/SKILL.md \
         herd/$agent/.claude/agents/*.md 2>/dev/null; then
      echo "  WARN: $dt case '$sub' has no external caller"
    fi
  done
done
```

Orphan subcommands are dead code. Note: this heuristic does not distinguish which outer case an inner label belongs to — if two agents define `case 'clear':` in different outer switches (e.g. `inbox clear` and `design-draft clear`) and only one is wired, the check passes. That's acceptable imprecision for a mechanical pass; `/audit-agent` can drill into specific dispatch trees.

### Step 7 — Architectural invariants

These are structural rules the architecture depends on. A failure here is architectural regression, not implementation drift.

**No `paths:` in herd rules:**
```bash
rg --hidden "^paths:" herd/ && echo "  FAIL: herd/ rule files must not use paths: frontmatter (Pattern 17)"
```

**Herd files don't reference curator skills or docs:**
```bash
rg --hidden "docs/(COMMUNICATION|ARCHITECTURE|PATTERN-CATALOG)\.md" herd/ && echo "  FAIL: herd references curator docs"
rg --hidden "/(check|patterns|contracts|coherence|rename-sweep|scaffold-subagent|audit-agent|audit-hygiene|curate|pressure-test|validate|align|contract-check|coherence-check|symmetry-check|audit-0[1-6])\b" herd/ && echo "  FAIL: herd references a curator skill (current or historical)"
rg --hidden "\.claude/asymmetries/" herd/ && echo "  FAIL: herd references curator-only asymmetries/"
rg --hidden "\.claude/audit-decisions/" herd/ && echo "  FAIL: herd references curator-only audit-decisions/"
rg --hidden "\bideas/" herd/ && echo "  FAIL: herd references curator planning docs"
rg --hidden "\bprojects\.md\b" herd/ && echo "  FAIL: herd references curator-only projects.md registry"
rg --hidden "rules/agent-files\.md" herd/ && echo "  FAIL: herd references curator-only rules/agent-files.md"
rg --hidden "herd/(pm|uxui|planner|builder)/" herd/ && echo "  FAIL: herd/ directory-prefix leakage inside a herd file"
```

**Note on the `cowmoo` / `curator` string check:** the CLAUDE.md de-curation rule lists "the strings 'cowmoo', 'curator'" as forbidden, but herd files legitimately reference `cowmoo/specs/`, `cowmoo/design/`, etc. — these are project paths the agent works with. A blanket `\bcowmoo\b` grep floods with false positives. This skill does NOT enforce that rule as a grep; if you want stricter de-curation, use `/audit-agent` which can read context.

### Step 8 — Sub-agent Prerequisite placement (Pattern 7)

For every sub-agent that references a rule file, the Read must live inside a `## Prerequisite` section. This is the same invariant `tools/pattern-check.cjs` enforces at write time; checking here too catches cases where files existed before the hook was wired.

```bash
setopt NULL_GLOB 2>/dev/null || shopt -s nullglob 2>/dev/null || true  # zsh: unmatched globs → empty, not fatal
for f in herd/*/.claude/agents/*.md; do
  rules=$(rg -oN "\.claude/rules/([a-z-]+)\.md" "$f" 2>/dev/null | sed 's|.*/rules/||; s|\.md||' | sort -u)
  [ -z "$rules" ] && continue
  prereq=$(awk '/^## Prerequisite/{flag=1; next} flag && /^## /{exit} flag{print}' "$f")
  if [ -z "$prereq" ]; then
    echo "  FAIL: $f references rule file(s) but has no ## Prerequisite section"
    continue
  fi
  while IFS= read -r rule; do
    [ -z "$rule" ] && continue
    if ! echo "$prereq" | grep -q "rules/${rule}\.md"; then
      echo "  FAIL: $f reads $rule.md but the Read is outside ## Prerequisite"
    fi
  done <<< "$rules"
done
```

---

## Finding Format

Every actionable finding uses the canonical four-part shape — see `.claude/templates/finding-format.md`.

---

## Verification phase

Run the canonical verification phase. Read `.claude/templates/verification-phase.md` and follow its procedure with:

- **Source skill name:** `/check`
- **Severity ordering hint:** critical = syntax failures, broken cross-references, missing required frontmatter, architectural regressions; advisory = orphan subcommands, regex portability warnings.

---

## Report

```
## Check Results

### Syntax: [PASS / FAIL]
### Regex Portability: [PASS / N warnings]
### Frontmatter: [PASS / N missing]
### Cross-references: [PASS / N broken]
### Skill → dev-tools subcommand: [PASS / N missing]
### Dev-tools round-trip: [PASS / N orphans]
### Architectural invariants: [PASS / N regressions]
### Sub-agent Prerequisite placement: [PASS / N violations]

### Verification
- Findings raised: N
- Verified this session (capped at 10): M
- Confirmed — fix good: X
- Confirmed — fix needs revision: Y
- Dismissed: Z

### Confirmed Findings (ready for fix)
### Dismissed Findings (logged for transparency)
```

**Next:** If clean, continue with `/patterns` (next skill in the pipeline). If findings need fixing, fix them and re-run `/check` before continuing.

---

## Rules

- **Mechanical only.** If deciding whether something is a violation requires reading the catalog or understanding patterns, the check belongs in `/patterns`, not here.
- **Both directions for cross-references.** Disk → CLAUDE.md catches orphans; CLAUDE.md → disk catches dangling references. Both are mandatory.
- **Stop on syntax failure.** Syntax breaks cascade; don't run the rest of the skill if Step 1 fails.
