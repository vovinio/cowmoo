---
name: tidy
description: Verify and clean up techstack.md and knowledge.md — remove stale entries, fix inaccuracies, organize. codebase.md is builder-owned; @notes-health reports its status but planner does not tidy it.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Grep
---

# Tidy

Verify that planner files are accurate and well-organized. Run between stories when things feel stale.

---

## Step 1: Assess

Spawn `@notes-health` to assess the condition of:
- `$PROJECT_DIR/cowmoo/stack/techstack.md`
- `$PROJECT_DIR/cowmoo/codebase/codebase.md` (if exists — builder-owned, optional)
- `$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md`

Review the assessment and present to user:
"Here's the state of your planner files: [summary]. [Recommendation]."

If all files are clean — "Files are in good shape. Nothing to tidy." Stop.

---

## Step 2: Tidy techstack.md

Read `$PROJECT_DIR/cowmoo/stack/techstack.md` and verify tech decisions:

- Are all listed technologies still in use?
- Any version changes or replacements?
- Any decisions that were reversed during building?

Present findings, wait for confirmation, self-verify after writing.

---

## Step 3: Tidy knowledge.md

Read `$PROJECT_DIR/cowmoo/agent-files/planner/knowledge.md` and verify against current specs and code:

**Check facts against specs:**
- Read current spec files
- Are all facts still true? (specs may have changed)
- Any facts contradicted by recent spec updates?

**Check for quality:**
- Duplicate entries?
- Contradicting entries?
- Entries that belong in specs (not planner knowledge)?
- Entries that are about code patterns, not product facts? (those belong in codebase.md)

Misplaced entries can't be relocated by the planner (no write access to specs or codebase.md). For spec-worthy entries, propose a follow-up `/ask pm` to escalate the content. For code-pattern entries, leave them if they affect PRD writing; remove only if redundant noise.

**Organize:**
- Group by domain
- Remove stale entries
- Merge duplicates

Present findings, wait for confirmation, self-verify.

---

## Step 4: Suggest Commit

If changes were made: "Files updated. Run `/publish` to commit."

---

## Completion Checklist

- [ ] @notes-health assessment loaded
- [ ] techstack.md verified (tech decisions)
- [ ] knowledge.md verified (product facts)
- [ ] Changes presented to user and confirmed
- [ ] Files updated and self-verified
- [ ] User directed to /publish for commit
