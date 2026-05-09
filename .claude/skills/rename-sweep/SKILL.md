---
name: rename-sweep
description: User-initiated utility. Takes an explicit list of renames (old → new), greps the repo for old names, shows where each one appears. No git dependency.
user-invocable: true
disable-model-invocation: true
argument-hint: [old->new ...]
---

# Rename Sweep

Help propagate a rename the user just performed. The user provides the renames explicitly; this skill finds every surviving reference to an old name and shows it with enough context for the user to apply the change.

This skill does NOT detect renames from git. The user knows what they renamed; relying on commit boundaries or working-tree inference is unnecessary indirection. If you want "find broken references generally" — that's `/check`, which catches any reference to a target that no longer exists, rename or not.

Use this skill when:
- You just renamed something and want to update every prose mention.
- You're considering a rename and want to see the blast radius first.
- You need a sed-ready list of edits, not just a broken-ref report.

---

## Step 1 — Gather renames

If the user passed renames as arguments (`/rename-sweep @researcher->@research /draft->/compose`), parse them. Each argument is `old->new`.

Otherwise, ask the user:

```
Enter renames, one per line (format: old → new). Blank line to finish:
```

Accept free-form input:
- `@researcher → @research` (sub-agent rename)
- `/draft → /compose` (skill rename)
- `RESOLVE_ISSUE → CLOSE_FOR_PM` (op rename)
- `researcher.md → research.md` (file rename)
- `uxui:review → design:review` (label rename)

For each entry, record the old string (the search target) and the new string (the proposed replacement).

If no renames are provided, stop: "Nothing to sweep."

---

## Step 2 — Grep for each old name

For each rename, run an exact-string grep against the repo:

```bash
rg --hidden -n "<old-string>" \
  --glob '!.git/' \
  --glob '!node_modules/' \
  --glob '!AUDIT-*.md' \
  --glob '!ideas/'
```

Exclude `ideas/` (user planning docs that legitimately preserve old names), `.git/` / `node_modules/` (mechanical), and `AUDIT-*.md` (historical findings).

Collect every match as `{file, line, matched_text, 2-line-context}`.

---

## Step 3 — Classify matches

For each match, classify as one of:

- **Stale reference** — the match looks like it's using the old name as if it still exists. The rename should propagate here. DEFAULT assumption unless Classification says otherwise.
- **Historical** — inside a changelog entry, proposal, or commit-style context that legitimately preserves the old name. Skip.
- **Coincidental** — the old name happens to also be a common word (e.g., "draft" as a verb in prose, "research" as a concept). Requires human judgment.

The skill does not auto-classify — it presents each match with context and lets the user decide. The default action is "rename here"; the user marks individual matches as skip.

---

## Step 4 — Present and confirm

For each rename, show a grouped report:

```
━━━ Rename 1/N: @researcher → @research ━━━

Matches found: 7

1. herd/pm/CLAUDE.md:68
   - `@researcher` — Research external topics, industry standards...
   Classification: Stale reference (propagate)

2. herd/pm/.claude/skills/start/SKILL.md:42
   Kick off @researcher for the first discovery pass.
   Classification: Stale reference (propagate)

3. ideas/old-design.md:14
   (in ideas/ — excluded from sweep)

...

→ Apply all | Apply some | Show sed commands | Skip rename | Next
```

For "Apply all": run the replacements file-by-file via Edit.
For "Apply some": use `AskUserQuestion` with the match list (multiSelect: true) to let the user mark which ones to apply.
For "Show sed commands": output a list of portable sed invocations the user can run outside the skill.
For "Skip rename": move to next rename.

---

## Step 5 — Report

After processing all renames:

```
## Rename Sweep Results

### Renames processed: N

#### Rename 1: <old> → <new>
- Matches found: X
- Applied: Y
- Skipped: Z

#### Rename 2: ...

### Next steps
- Re-run /check to verify no stale references remain.
- If renames touched settings.json or frontmatter keys, validate syntax.
```

---

## Rules

- **No git dependency.** The user provides renames explicitly; this skill never reads git log, diff, or status.
- **User-initiated only.** This skill is not part of the detection pipeline. It's a utility for a task you're doing on purpose.
- **Detection-general renames belong in /check.** If your goal is "find broken references in general", run `/check` — it catches any reference to a nonexistent target regardless of whether the cause was a rename, a deletion, or a typo.
- **Excluded dirs are excluded.** `ideas/` contains user planning content that legitimately preserves old names. Never propose changes there.
- **Literal string matching.** This skill does exact-string matches, not semantic renames. A function rename inside source code (where the same name is used as a variable, a type, and a function) needs a structured tool, not this one.
