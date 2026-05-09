---
name: start
description: Initialize new project or resume existing project
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Read, Glob, Agent, Bash
---

# Start

Initialize or resume the product specification project.

## Step 1: Check Project State

Run `node tools/dev-tools.cjs check-files` and read all four lines (`working-notes:`, `backlog:`, `product:`, `domain-specs:`).

- `working-notes: not found` → go to **NOT INITIALIZED** below
- `working-notes:` reports `0 ready, 0 open, 0 future` **AND** `domain-specs: 0` → go to **GREENFIELD** below (fresh project with no content yet)
- anything else → go to **EXISTING PROJECT** below

---

## If File Exists → EXISTING PROJECT

### Assess Notes

Spawn `@notes-health` agent to assess the working notes condition. This returns item counts, session count, organization quality, and a recommendation.

### Read Product Context

Read `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` for product overview context.

### Propose Session Focus

Combine the @notes-health assessment with the product context to present:

```
Project loaded.

**Notes:** [N] ready, [N] future, [N] open — across [N] sessions
**Condition:** <assessment from @notes-health>

<If @notes-health recommends /tidy:>
**Heads up:** Notes need reorganization — [specific reason from @notes-health]. Consider running /tidy before your next /digest.

<If @notes-health recommends /digest:>
**Heads up:** [N] items ready for formalization. Consider running /digest in a dedicated session.

**Suggested focus:**
- [Most important open area and why]

What would you like to work on?
```

Don't ask "what would you like to do?" generically — propose something specific based on what you see.

### Load Domain Files

Once the user picks a focus (or brings their own topic):
- Read the relevant domain file(s) from `$PROJECT_DIR/cowmoo/specs/domains/`
- Only load adjacent domains if the work clearly requires it
- Read RESEARCH.md only if the topic involves competitive or market context

### Scan for Related Content

After loading the relevant domain file(s), scan them for references to the session topic. Flag any existing spec content that might be affected by the upcoming discussion — entity fields, feature rules, glossary entries, etc. Present these as a brief hint:

```
**Related spec content:**
- [domain.md] — [entity/feature] references [topic] at line [N]
- [PRODUCT.md] — glossary entry for [term] may need attention
```

This gives the user (and you) a head start — no mid-conversation surprises when you discover existing spec content that contradicts or needs updating.

---

## If Empty → GREENFIELD

The project is initialized but no product content exists yet — no working-notes items and no domain specs. `@notes-health` has nothing to assess, so skip it.

Present this greeting:

```
Fresh project detected — ready to start capturing product thinking.

To begin, just describe your product idea. I'll ask questions, flag edge cases, and capture decisions as we go. When you're ready to save what we've covered, run /draft.

Alternatives:
- **Existing docs?** Run `/import <folder>` to walk through them together.
- **No clear idea yet?** Describe the problem you're solving and who has it — we'll work forward from there.
```

Wait for the user. Do not spawn `@notes-health`, do not proceed to domain loading, and do not scan for related content — there is none.

---

## If File Missing → NOT INITIALIZED

Tell the user: "Project not initialized — required PM files are missing (e.g., `cowmoo/specs/PRODUCT.md`, `cowmoo/agent-files/pm/WORKING-NOTES.md`). Initialize the project before continuing."

Stop.

---

## Completion Checklist

Before finishing, confirm:

- [ ] Project state checked (existing, greenfield, or not initialized)
- [ ] For existing: @notes-health assessment loaded, product context read, session focus proposed
- [ ] For greenfield: greeting shown with /draft and /import options; @notes-health NOT spawned
- [ ] For not initialized: user told which required files are missing
- [ ] User has context to start working
