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
for agent in pm uxui planner builder; do
  # Forward: each /<skill> mentioned in CLAUDE.md must exist on disk.
  # --pcre2 is required for lookbehind; without it rg silently errors out
  # and the check reports a false PASS. The trailing (?![a-z0-9/-]) rejects
  # path fragments like `/tmp/foo`. The full character class is required:
  # `(?!/)` alone lets the greedy `*` backtrack one char at a time and
  # match `/tm` instead of failing — needs the name-class chars excluded too.
  rg -N --pcre2 -o '(?:^|(?<=[\s`]))/[a-z][a-z0-9-]*(?![a-z0-9/-])' "herd/$agent/CLAUDE.md" 2>/dev/null \
    | sed 's|^/||' | sort -u | while read name; do
    [ "$name" = "propose" ] && continue
    [ -d "herd/$agent/.claude/skills/$name" ] \
      || echo "  FAIL: herd/$agent/CLAUDE.md mentions /$name but herd/$agent/.claude/skills/$name/ doesn't exist"
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

**4c — Within-agent slash-command references.**

Every `/<skill>` mentioned in a skill or sub-agent body must either (a) be a skill of the same agent, (b) be the universal `/propose`, or (c) be caught by Step 7's de-curation check (curator skills aren't allowed in herd files anyway).

```bash
for agent in pm uxui planner builder; do
  base="herd/$agent"
  # Same lookbehind-anchored regex as 4a, including the trailing
  # (?![a-z0-9/-]) lookahead to reject path fragments and prevent the
  # greedy `*` from producing partial-match noise. rg needs --pcre2 for
  # lookbehind/lookahead and --hidden to descend into .claude/.
  rg -N --pcre2 --hidden -o '(?:^|(?<=[\s`]))/[a-z][a-z0-9-]*(?![a-z0-9/-])' "$base/.claude/skills/" "$base/.claude/agents/" 2>/dev/null \
    | sed 's|^.*:||; s|^/||' | sort -u | while read name; do
    [ -z "$name" ] && continue
    [ "$name" = "propose" ] && continue
    [ -d "$base/.claude/skills/$name" ] \
      || echo "  WARN: $agent body references /$name but herd/$agent/.claude/skills/$name/ doesn't exist (may be a curator skill — caught by Step 7, or may be stale)"
  done
done
```

All three sub-steps run independently. Missing `@<name>` → CRITICAL; missing `rules/<name>.md` → CRITICAL; missing `/<skill>` → WARN (de-curation Step 7 makes the real decision).

### Step 5 — Ops operation existence

For every `@<agent>-ops OPERATION` spawn in a skill body, the operation must exist as a `### OPERATION` header in the referenced ops agent file.

**Matching only adjacent invocations.** The regex below deliberately requires the `OP` token to sit immediately after `@<agent>-ops` (only whitespace — or a single closing backtick — between). Prose like "spawn `@task-ops` with RETURN operation" is NOT matched, and that's intentional: a bare prose mention can't be mechanically distinguished from "`@uxui-gh-ops`. You do NOT do GitHub", where "NOT" is an English word. Skills should use the direct `@agent-ops OP` form (Pattern 2); anything that doesn't fit the direct form is out of scope for this mechanical check.

The trailing `(?!-)` rejects hyphenated words like `BUILD-NOTES` (a filename, not an op).

```bash
# Extract (agent, op) pairs from adjacent invocations only.
# -P enables PCRE2 (needed for the negative lookahead (?!-)).
rg -N -P -o '@[a-z-]+-ops`?[[:space:]]+[A-Z][A-Z_]{2,}\b(?!-)' \
   herd/*/.claude/skills/*/SKILL.md herd/*/.claude/agents/*.md 2>/dev/null \
  | sed -E 's|.*@([a-z-]+)-ops`?[[:space:]]+([A-Z][A-Z_]+).*|\1 \2|' \
  | sort -u | while read opsagent opname; do
  [ -z "$opsagent" ] && continue
  # Locate the ops sub-agent file
  found=""
  for ag in pm uxui planner builder; do
    [ -f "herd/$ag/.claude/agents/${opsagent}-ops.md" ] && { found="herd/$ag/.claude/agents/${opsagent}-ops.md"; break; }
  done
  if [ -z "$found" ]; then
    echo "  FAIL: @${opsagent}-ops referenced but no such sub-agent file found"
    continue
  fi
  grep -qE "^### +$opname\b" "$found" \
    || echo "  FAIL: @${opsagent}-ops $opname — no matching \"### $opname\" in $found"
done
```

Missing op = CRITICAL. Parameter matching lives in `/contracts` — this check only verifies existence.

### Step 6 — Dev-tools subcommand round-trip

Every `case '<x>':` in an agent's `dev-tools.cjs` — whether at the top level or inside a nested dispatch (e.g. `case 'inbox':` containing an inner switch with `case 'add':`, `case 'list':`, …) — must be called from at least one of: a SKILL.md, a sub-agent file, the agent's settings.json hooks, or the agent's statusline.sh.

**Nested-dispatch aware.** `grep` on `dev-tools.cjs <sub>` alone misses nested calls like `dev-tools.cjs inbox add`. The regex below matches `dev-tools.cjs` followed by any number of intermediate tokens, then the subcommand, then a non-word boundary. This treats both top-level and nested-inner case labels as "called" when any invocation chain ends in that name.

```bash
for agent in pm uxui planner builder; do
  dt="herd/$agent/tools/dev-tools.cjs"
  [ -f "$dt" ] || continue
  # Extract all case labels (top-level and nested alike)
  grep -oE "case '[a-z-]+':" "$dt" | sed "s/case '//; s/'://" | sort -u | while read sub; do
    [ "$sub" = "default" ] && continue
    # Match `dev-tools.cjs [outer [inner …]] <sub>` with $sub followed by
    # a non-word (space, quote, eol, etc.) so `inbox` does NOT spuriously
    # match `inbox-foo` and `clear` does NOT match `clearSession`.
    if ! grep -qE "dev-tools\.cjs( [a-zA-Z0-9_-]+)* $sub([^a-zA-Z0-9_-]|\$)" \
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
rg --hidden "docs/(COMMUNICATION|ARCHITECTURE|PATTERNS|PATTERN-CATALOG)\.md" herd/ && echo "  FAIL: herd references curator docs"
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
### Ops operation existence: [PASS / N missing]
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
