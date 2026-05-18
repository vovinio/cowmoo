---
name: review
description: Verify UI definitions cover all specs. Classify findings, discuss, fix.
user-invocable: true
disable-model-invocation: false
allowed-tools: Agent, Read, Write, Edit, Glob, Grep, AskUserQuestion
---

# Review

Verify that UI definitions cover all product specifications.

---

## Step 1: Load Context

The per-domain coverage agents (Step 2) read each paired domain's spec + design files themselves — you do not need every spec domain in context. Load what the global pass (Step 3a) needs:

- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/journeys.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/roles.md` (if exists)
- `$PROJECT_DIR/cowmoo/design/screen-index.md` (if exists)
- All files in `$PROJECT_DIR/cowmoo/design/domains/`
- Any file in `$PROJECT_DIR/cowmoo/specs/domains/` that has NO matching `design/domains/` file of the same basename (a data-only or not-yet-designed domain — Step 3a checks these directly)

---

## Step 2: Run Coverage Checks (per domain)

A single whole-product `@check-coverage` pass does not scale — on a large product it exceeds the sub-agent's context budget and is truncated before it can emit its report. Fan the check out per domain instead, so each agent holds only its own slice.

1. Glob `$PROJECT_DIR/cowmoo/specs/domains/*.md` and `$PROJECT_DIR/cowmoo/design/domains/*.md`. A spec domain is **paired** when a design file of the same basename exists (e.g. `specs/domains/rsvp.md` ↔ `design/domains/rsvp.md`).
2. For every **paired** domain, spawn one `@check-coverage` — all in parallel, in a single message with N `Agent` calls. Pass each invocation its domain name (e.g. `rsvp`). Each agent reads only that domain's spec + design file plus `roles.md` and `screen-index.md` — bounded, well under budget.
3. Unpaired files are NOT given a per-domain agent — they are handled by the global pass in Step 3a:
   - A spec domain with no matching design file — a data-only domain (e.g. an entity with no UI of its own, consumed by other domains' screens) or one not yet designed.
   - A design file with no matching spec domain — a cross-cutting file (e.g. an app-shell / navigation-chrome definition).

Each per-domain agent returns a structured report for its domain: covered / partial / missing, state gaps, role-reference integrity, screen-index sync, raw values, and any unresolved cross-domain references.

---

## Step 3: Global Pass and Aggregation

### 3a. Global pass (you do this directly)

The per-domain agents are each scoped to one domain, so the product-wide checks are yours. Using the files you loaded in Step 1:

- **OVERVIEW coverage** — does `OVERVIEW.md` exist; is Design Intent populated with concrete prose (not placeholder text); is Navigation Structure populated; are the sibling pointers present?
- **Cross-domain coverage** — reconcile every "unresolved cross-domain reference" the per-domain agents flagged against the referenced domain's design file. A reference with no reflection in the target's UI is a gap.
- **Journeys** — if `journeys.md` exists, verify each cross-domain journey's screens and decision points exist in the domain files.
- **Unused roles** — a role defined in `roles.md` but referenced by no domain file is a warning (intentional reserve, or cruft to prune).
- **Screen-index orphans** — an entry in `screen-index.md` that points to no screen in any domain file is a finding.
- **Global raw-value scan** — grep `OVERVIEW.md`, `journeys.md`, `roles.md`, `screen-index.md` for raw hex / px / `rgb()` / `font-weight` values.
- **Unpaired design files** (cross-cutting, e.g. an app-shell file) — check role-reference integrity and screen-index sync, scan for raw values, and classify each screen as cross-cutting (a screen that maps to no single spec domain is valid, not an orphan error).
- **Unpaired spec domains** (data-only, e.g. a singleton-entity domain with no UI) — its entities and fields surface in *other* domains' screens. Verify that coverage against the design files rather than reporting the domain "Not Covered." A genuine gap — a field that surfaces nowhere — is still a finding.

### 3b. Aggregate and classify

Collect the N per-domain reports plus your global-pass findings. Deduplicate. Before classifying any per-domain **"Not Covered"** item as a real gap, re-check it against the sibling design files you loaded in Step 1 — a feature can be designed in a cross-cutting file or another domain's design file (e.g. a banner owned by one domain that renders in another's screen). A per-domain agent, scoped to one design file, cannot see that; you can. An item covered elsewhere is not a gap. Then classify:

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

**Render the per-finding fix-path choice via `AskUserQuestion`** (single-select), not as a prose `(a)/(b)/(c)` list, per CLAUDE.md item 3's picker rule. Each option's `description` carries the tradeoff in design terms ("add all 5 states per ui-vocabulary" vs "add loading + error only — empty not applicable here"; "rewrite to use existing `destructive-action` role" vs "add new role `destructive-quiet` to roles.md first"). Include a "leave as-is" or "specify other" escape option when the finding admits one.

---

## Step 5: Handle Findings

**Auto-fixes:** Render a confirmation picker via `AskUserQuestion` before applying the batch: `Apply the N auto-fixes` `(Recommended)` (description: lists what gets fixed — e.g. "add 2 missing screens to index, swap 1 role reference") / `Skip auto-fixes` (description: leave them unfixed this run). Apply on the recommended pick.

**Quick fixes:** Discuss with user, apply agreed fixes. Self-verify each edit.

**Structural items:** Write to working notes for a future /define session.

**Spec gaps:** Note them — user will run `/ask pm`.

---

## Step 6: Outcome

State the outcome in prose — which case holds:

- **All clean:** "Review passed."
- **Fixes applied:** "Fixed N issues."
- **Spec gaps found:** "Found N spec gaps."

Then close with an `AskUserQuestion` hand-off picker — never end on a prose "Run …" suggestion. Build the options from which outcome holds: when spec gaps were found, `Run /ask pm` `(Recommended)` (description: send the N spec gaps to PM) leads, with `Run /publish` (description: commit the fixes applied this run) and `Done for now` after; when the review is clean or fixes were applied with no spec gaps, `Run /publish` `(Recommended)` (description: commit and push the cowmoo/design/ changes) leads, then `Done for now`. Add `Address structural items` (description: route to working notes for a future /define) when structural findings exist. Omit options that don't apply this run.

---

## Completion Checklist

Before finishing, confirm:

- [ ] @check-coverage ran for every paired domain (parallel fan-out); global pass (Step 3a) done; all findings collected
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
