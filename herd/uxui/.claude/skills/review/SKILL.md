---
name: review
description: Verify UI definitions cover all specs. Classify findings, discuss, fix.
user-invocable: true
disable-model-invocation: true
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Review

Verify that UI definitions cover all product specifications.

---

## Step 1: Load Context

Read all spec and uxui files:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md`
- `$PROJECT_DIR/cowmoo/design/journeys.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/roles.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/screen-index.md` (if exists)
- All files in `$PROJECT_DIR/cowmoo/design/domains/`

---

## Step 2: Run Coverage Check

Spawn `@check-coverage` to cross-reference specs against UI definitions.

The agent returns a structured report: what's covered, partially covered, missing, role reference integrity, screen-index sync, and any state gaps.

---

## Step 3: Classify Findings

Take the `@check-coverage` findings. Deduplicate. Classify:

| Classification | Definition | Action |
|---|---|---|
| **Auto-fix** | Trivial — missing screen in index, role reference fixable by swapping name, duplicate screen entries | Fix with confirmation |
| **Quick fix** | Missing state in a screen definition, thin flow description, missing role definition, raw value in domain file, unused role in roles.md (propose deletion) | Propose fix, discuss |
| **Structural** | Missing entire screen, feature has no UI definition, major gap, OVERVIEW missing Design Intent entirely | Route to working notes |
| **Spec gap** | Design or UI work reveals missing spec content | Route to `/ask pm` |

---

## Step 4: Present Findings

```
## Review Results

### Coverage
- Entities: [N]/[N] covered
- Features: [N]/[N] covered
- State completeness: [N]/[N] screens have all states

### OVERVIEW
- Design Intent: [filled / missing / thin]
- Navigation Structure: [filled / missing]

### Role Vocabulary
- roles.md: [exists / missing]
- Roles defined: [N]
- Role references in domain files: [N matched / N unmatched]
- Unmatched references: [list with file:location → role name]

### Screen Index
- screen-index.md: [exists / missing]
- Screens in domain files not in index: [N] — [list]
- Screens in index not in domain files: [N] — [list]

### Raw Values
- Raw hex/rgb/pixel values in cowmoo/design/ files: [N] — [list with file:location]

### Auto-fixes ([N])
[list]

### Quick Fixes ([N])
[Each with: what's wrong, options, recommendation]

### Structural ([N])
[Each with full context — routed to working notes]

### Spec Gaps ([N])
[Issues found in specs that need PM attention]
```

For each quick fix and structural item: present what the definition says, what's wrong, 2-3 options, and your recommendation.

**Render the per-finding fix-path choice via `AskUserQuestion`** (single-select), not as a prose `(a)/(b)/(c)` list. Recommended option first with `(Recommended)` suffix; each option's `description` carries the tradeoff in design terms ("add all 5 states per ui-vocabulary" vs "add loading + error only — empty not applicable here"; "rewrite to use existing `destructive` role" vs "add new role `destructive-quiet` to roles.md first"). Include a "leave as-is" or "specify other" escape option when the finding admits one. Per CLAUDE.md's picker rule (the `/review quick-fix options` example called out there). Yes/no confirmations and single-recommendation prompts stay in prose; only 2-4-option forks go through the picker.

---

## Step 5: Handle Findings

**Auto-fixes:** Apply with one confirmation.

**Quick fixes:** Discuss with user, apply agreed fixes. Self-verify each edit.

**Structural items:** Write to working notes for a future /define session.

**Spec gaps:** Note them — user will run `/ask pm`.

---

## Step 6: Outcome

**All clean:** "Review passed. Run /publish to commit and push."

**Fixes applied:** "Fixed N issues. Run /publish to commit and push."

**Spec gaps found:** "Found N spec gaps. Run `/ask pm`."

---

## Completion Checklist

Before finishing, confirm:

- [ ] @check-coverage ran and findings collected
- [ ] Findings classified (auto-fix / quick fix / structural / spec gap)
- [ ] Each finding expanded with context, options, recommendation
- [ ] Fixes applied and self-verified
- [ ] Structural items routed to working notes
- [ ] User directed to /publish (and `/ask pm` if spec gaps)

---

## Rules

- **Deduplicate** — duplicate findings from coverage check should appear once
- **Expand findings** — don't pass agent output verbatim. Add context and options.
- **Self-verify every edit** — write → re-read → verify
- **Spec gaps go to PM** — never invent spec content to fill a gap
- **Every screen declares its applicable states** — per `.claude/rules/ui-vocabulary.md`: data states for data-fetching screens, form states for forms. Screens that don't fetch data aren't required to declare data states.
- **Unmatched role references block publish** — if a domain file references a role that doesn't exist in `cowmoo/design/roles.md`, the fix is either: (a) add the role to roles.md, or (b) rewrite the domain file to use an existing role. Don't ship unmatched references.
- **screen-index drift is a finding** — every screen defined in a domain file must appear in screen-index.md, and every entry in screen-index.md must point to an existing domain file screen.
