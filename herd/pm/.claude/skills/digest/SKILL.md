---
name: digest
description: Dedicated session — formalize working notes into specs, move deferred items to backlog
user-invocable: true
disable-model-invocation: false
allowed-tools: Write, Edit, Read, Glob, Bash, AskUserQuestion
---

# Digest

Formalize confirmed working notes into spec files. Move deferred items to backlog. Clean up notes. This is a dedicated session — not something run at the end of a discussion.

After digest completes, run `/review` to verify, then `/publish` to ship.

---

## Steps

### 0. Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

---

### 1. Read Current State

Read all files to understand what exists:
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`

---

### 2. Detect Stale Checkpoint

Scan the top of WORKING-NOTES.md for a `## In-progress: <domain>` block. This block is the transient checkpoint Step 4e writes during a long digest; if it exists at the start of a new run, the prior `/digest` crashed before reaching Step 4e cleanup.

- **If no block found** — proceed to Step 3.
- **If block found** — read its contents (it names the domain, what was written to spec, what was pending), then surface to the user via `AskUserQuestion` (2-option fork with tradeoffs — per the picker rule in CLAUDE.md):
  - **Resume from checkpoint** (Recommended if the prior crash was recent) — verify the "written to spec" items are present in `cowmoo/specs/domains/<domain>.md`; if so, clean them from WORKING-NOTES.md (Step 4d for those items only), then proceed to Step 3 with the remaining items.
  - **Discard checkpoint** (Recommended if the checkpoint looks unfamiliar or out-of-date) — delete the `## In-progress` block from WORKING-NOTES.md, then proceed to Step 3 normally. Any duplicate work is caught by Step 4b's read-target-spec-and-compare safety net.

After the user picks, apply the chosen path before moving to Step 3.

---

### 3. Identify What's Ready

From working notes, separate items into categories:

**Ready for specs** — Confirmed decisions, fully understood features or entities, answered questions that complete a spec section.

**Ready for backlog** — Items explicitly tagged `[future]` or discussed as deferred / not current scope. These move to BACKLOG.md with their full context.

**Not ready** — Open questions, partially discussed ideas, items needing more conversation. These stay in working notes.

**If nothing is ready for specs and nothing is tagged `[future]`** — report "Nothing ready to digest. Continue discussion or run /tidy to tag items." and stop.

---

### 4. Process Per Domain

**One domain at a time.** Pick the domain with the most ready items (or let the user specify). Process that domain fully — transform, write, clean — before starting the next. If changes in that domain require updates to other files (e.g., glossary in PRODUCT.md, ripple to another domain), make those cross-domain changes too. But don't process unrelated ready items from other domains in the same run — they wait for the next digest.

If ready items span multiple domains with no clear primary, render the domain choice as an `AskUserQuestion` picker — one option per domain with ready items, the domain with the most ready items first with `(Recommended)`, each option's `description` naming its ready-item count. The user's pick is this run's focus.

**Ordering within the run:** Process PRODUCT.md updates first (if needed), then the primary domain. Within the domain, process entities before features so features can reference entities.

A `[ready]` item is a PRODUCT.md update if it touches any section the `product.md` template owns: Problem Statement, Target Users, Overview, Glossary, Roles, Product Areas, How It Works, Key Behaviors, or Key Constraints. These are the "Product" item type in the Step 4a table below. Cross-domain ripples into PRODUCT.md (e.g., a domain item that adds a glossary term) also count.

For each domain with ready items:

#### 4a. Transform Items to Spec Format

For each item ready for specs in this domain:

**Read the template:**

| Item type | Read this file |
|-----------|---------------|
| Domain | `.claude/templates/domain.md` |
| Entity | `.claude/templates/entity.md` |
| Feature | `.claude/templates/feature.md` |
| Product | `.claude/templates/product.md` |

**Structure content to match template:**

- Include ALL template sections
- Use exact formats from template (user story format, Given/When/Then, etc.)
- Section doesn't apply? → Write "N/A — [reason]"
- Add beyond template if something important isn't covered

**Extract decision reasoning (the why, not just the what):**

This is the digest quality gate. Working-notes entries often contain the **reasoning** behind a decision — "we considered X but chose Y because Z," "this option was rejected because…", trade-off explanations, alternative-paths-considered, scenarios that prompted the rule. **This reasoning must land somewhere durable in the spec before the working-notes entry is deleted.**

For each working-notes item you're about to digest, scan it for:
- "considered X but chose Y" / "rejected X in favor of Y" patterns
- "because Z" / "rationale:" / "trade-off:" explanations
- "we tried X first, it didn't work because Y" history
- explicit "this rule exists to prevent…" cause statements
- numeric thresholds with the reasoning for that specific number (e.g., "5 attempts/hour because…")

If you find reasoning, find a home for it in the spec:

| Reasoning shape | Where it lands in the spec |
|---|---|
| Trade-off explaining a Key Behavior or Constraint | Inline note under that Key Behavior in PRODUCT.md (e.g., "**Rationale:** considered X; chose Y because Z") |
| Reason for a specific threshold/limit | Inline next to the field where the limit appears, prefixed with `→` or `(why: ...)` |
| Why a rejected alternative was rejected | A short "**Considered alternative:**" line in the relevant entity / feature section |
| Cross-cutting decision rationale that doesn't fit one spec section | A short `### Design notes` sub-section at the end of the relevant spec file |

If no good home exists in the existing template, **add one rather than dropping the reasoning.** The spec can grow new sections; the reasoning cannot be reconstructed from a deleted note.

**Propose completions for gaps:**

If template requires something not in working notes, propose it:

| Gap | Propose |
|-----|---------|
| Missing error message | "I suggest: '[specific message]'" |
| Missing edge case | "I suggest: [scenario] → [handling]" |
| Missing acceptance criteria | "I suggest: Given [X], When [Y], Then [Z]" |

Show user a structured stamp — deltas only, not the whole drafted item. The full draft is in the spec file (one click away); chat shows what PM *proposed* (the parts the user didn't explicitly say) plus a pointer to where reasoning landed:

```
Drafted: <Item Name> → cowmoo/specs/domains/<domain>.md

Proposed (your call):
  • <what PM proposed — e.g., error wording for `terms_invalid`>
  • <what PM proposed — e.g., default = "Net 30">

Reasoning preserved: <N> trade-offs / threshold rationale → <where in spec, e.g., "Design notes §" or "inline at field">
```

After the stamp, render an `AskUserQuestion` confirmation gate — the user selects, never types "yes". Three options: `Confirm` (Recommended) — *accepts the proposals and proceeds to write the spec*; `Open file` — *the user reviews the drafted spec before confirming; re-present this gate after*; `Adjust a proposal` — *the user names what to change; revise the proposal and re-present this gate*.

If nothing was proposed (the working-notes item was complete), drop both the "Proposed" section and the `Adjust a proposal` option. If no reasoning was preserved (none was present in the source item), drop that line. Never echo the full drafted spec content back into chat — the spec file IS the long version.

**Never present a gap without a proposal.** If the template requires something and working notes don't have it, always propose a specific completion. If multiple approaches exist, present 2-4 options with trade-offs and a recommendation, rendered as an `AskUserQuestion` picker per CLAUDE.md item 3's picker rule. The user should never have to invent an answer from scratch.

**Verify before writing:**

Check:
- [ ] All template sections addressed (filled or N/A with reason)?
- [ ] Formats match template?
- [ ] No vague language ("appropriate", "relevant", "etc.")?
- [ ] No references to deferred/backlog concepts? Specs must be self-contained.
- [ ] User confirmed proposals?
- [ ] **Every "we considered X / chose Y because Z" / trade-off / rejected-alternative from the source working-notes items has a durable home in the spec** (per the extraction table above). If reasoning is being dropped, stop and add it.

All checks pass → proceed to write.

#### 4b. Write to Spec File (with self-verification)

Batch all confirmed items for this domain into a single write:

1. **Read** the target spec file (or note it doesn't exist yet)
2. **Plan** all changes as explicit deltas:
   - List every field, rule, edge case, and acceptance criterion being **added**
   - List every item being **removed** (with the working notes decision that justifies it)
   - List every item being **modified** (old → new, with justification)
   - Everything not on these lists is **preserved unchanged** — this is the implicit carry-forward list
   - Place entities before features so features can reference them
3. **Write** the complete updated file with all items included
4. **Re-read** the file immediately after writing
5. **Verify** by comparing against the original:
   - For each entity/feature that existed before: compare every field, rule, state, edge case, validation, and acceptance criterion in the original against the new version
   - Any item not on the explicit removal list from step 2 must be present
   - Did every new item land in the correct section?
   - Do modified items reflect the intended change and nothing else?
6. **Fix** if anything is wrong, then re-verify

Target files:
- Product content → `$PROJECT_DIR/cowmoo/specs/PRODUCT.md`
- Entity/Feature content → `$PROJECT_DIR/cowmoo/specs/domains/[domain].md`

#### 4c. Move Deferred Items to Backlog

For any `[future]` items encountered in this domain:

1. Read `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md`
2. Append each deferred item with its **full context**:
   - What the item is
   - Why it was deferred
   - What it relates to in current scope
   - Any discussion context or edge cases already explored
3. Verify the item was written correctly to BACKLOG.md

Preserve everything — deferred items could be blunt ideas or fully detailed features. Move them as-is.

#### 4d. Clean Processed Items from Working Notes

Before removing anything, **re-verify the reasoning gate:** for each item you're about to delete from WORKING-NOTES.md, confirm that any "we considered X / chose Y because Z," trade-off rationale, or rejected-alternative explanation it contained has landed in the spec per Step 4a's extraction table. If you skipped this for any item, stop and patch the spec — don't delete first and try to remember later.

Once the reasoning gate is clear:

Remove from `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`:
- Items successfully written to spec files (verified in 4b)
- Items successfully moved to BACKLOG.md (verified in 4c)

Keep in working notes:
- Untagged items (still in discussion)
- Anything not ready for specs

Remove session headers (`## Session — [topic]`) that have no remaining items beneath them.

#### 4e. Within-Run Checkpoint (transient only)

If you need to remember mid-run state (e.g., partial-failure recovery during a long digest of one domain), write a transient `## In-progress: <domain>` block at the top of WORKING-NOTES.md naming what's been written and what's left.

**Delete this checkpoint before reporting digest complete.** It is a within-run safety net, NOT a record of what was digested.

Do NOT write a permanent "Digest progress" section into WORKING-NOTES.md. The durable record of what was digested lives in git history — `/publish` commits the spec changes with a conventional message (`spec(<domain>): <description>`), and `git log` is the audit trail. Keeping a digest log inside WORKING-NOTES.md is the failure mode that turns the staging file into a permanent history file; never do it.

**Do not process additional domains in this run — move to Step 5.** One domain per digest run. The user will run `/digest` again for the next domain.

---

### 5. Remaining Deferred Items

If any `[future]` items remain in working notes that weren't associated with a processed domain:

1. Append each to `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md` with full context (what it is, why deferred, what it relates to)
2. Verify written correctly
3. Remove from `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md`

---

### 6. Report

```
## Digest Complete

### Spec Files Updated
- [File]: [What was added/changed]
  Before: [brief snippet of previous state or "new section"]
  After: [brief snippet of new state]

### Moved to Backlog
- [Item]: [Why deferred]

### Remaining in Working Notes
- [N] untagged items (still in discussion)
- [N] ready items in domain(s) not processed this run — re-run /digest to handle them

### Proposed & Confirmed
- [What you proposed that user confirmed]
```

Include the "ready items in domain(s) not processed" line only when Step 4 processed one of multiple domains that had `[ready]` items, leaving at least one domain's ready items behind; omit it otherwise (single-domain runs leave no ready items behind).

**Hand-off.** After the report, render an `AskUserQuestion` picker of concrete next actions — never close on a prose "Next:" line. Build the options from context: `/review` first with `(Recommended)` — *verifies spec integrity before shipping*; other live continuations (e.g. `/digest` again when ready items remain in unprocessed domains, or `/publish` directly if the user wants to ship without a review pass); and `Done for now` last. Each option's `description` names what it leads to.

**Heavy-digest companion (HTML).** When this digest wrote **substantial** content — multiple items or sections across one or more spec files, or a new entity or feature — also deliver the report as an HTML companion the user can review before shipping:

1. Assemble a "Digest Delta" as a single **self-contained** HTML file (inline `<style>`, no external assets, no build step). Per spec file changed: the before/after of each item, what PM *proposed* vs. what the user confirmed, and where decision reasoning landed. Include the Moved-to-Backlog list.
2. Write it to `/tmp/pm-digest-<timestamp>.html` and open it with `open /tmp/pm-digest-<timestamp>.html`.
3. In the terminal, show a compressed stamp instead of the per-file Before/After block — the Before/After detail lives in the HTML, not in both places:

   `Digest: <N> files updated · <N> → backlog · <N> still in notes → /tmp/pm-digest-<timestamp>.html`

   This HTML is the artifact the user reviews before `/review` → `/publish`.

When the digest was **trivial** (a single small change), keep the terminal report as written above — no HTML. If the HTML write or `open` fails, fall back to the terminal report; never block the skill on the companion.

---

## Completion Checklist

Before finishing, confirm:

- [ ] All `[ready]` items for the target domain transformed to spec format
- [ ] User confirmed all proposed completions
- [ ] **Reasoning preservation gate cleared** — every "we considered X / chose Y because Z," trade-off, threshold rationale, and rejected-alternative from the source items has a durable home in the spec (per Step 4a's extraction table)
- [ ] Spec files written and self-verified (write → re-read → verify)
- [ ] `[future]` items moved to BACKLOG.md with full context
- [ ] Processed items cleaned from working notes (after reasoning gate cleared, not before)
- [ ] If a stale checkpoint was found at Step 2, it was either resumed from or discarded — not silently ignored
- [ ] Within-run transient checkpoint (if used) deleted before reporting complete — no "Digest progress" / "Digest runs to date" log left in WORKING-NOTES.md
- [ ] Report presented with next steps (/review → /publish)
- [ ] Substantial digest delivered as an HTML companion in `/tmp/` and opened; trivial digest reported inline

---

## Rules

- **Self-verify every edit** — the write → re-read → verify loop catches silent data loss (dropped fields, mangled formatting, missing sections) that would otherwise go unnoticed until the next `/review` run.
- **Full context in backlog** — never strip reasoning or detail when moving to backlog. Deferred items may be picked up months later by a different person; without context they become opaque line items that nobody acts on.
- **Don't digest uncertain items** — if something isn't confirmed, it stays in notes. Putting unconfirmed content into specs creates false confidence — readers assume specs are settled decisions.
- **One domain at a time** — complete the full cycle (transform → write → clean) for each domain before starting the next. Focused work produces better output. A half-processed domain is recoverable via the transient checkpoint (deleted at completion); two half-processed domains are a mess.
- **WORKING-NOTES.md is staging, not history.** Every item this skill processes is either written into a spec (Step 4b) or moved to BACKLOG.md (Step 4c) — and then removed from WORKING-NOTES.md (Step 4d). No "kept for traceability," no "Digest progress" log, no exceptions. Git history (committed by `/publish`) is the durable audit trail.
- **Reasoning travels with the decision.** Deleting a working-notes item is acceptable ONLY after its embedded reasoning (trade-offs, rejected alternatives, threshold rationale, cause-and-effect history) has been preserved in the spec. The spec is the durable record of "what AND why." If reasoning gets dropped during digest, future readers (planner, builder, future-PM) re-litigate settled decisions because the "why" is missing. The Step 4a extraction table is non-negotiable.
- **One file per write** — batch all items for a target file into a single write, then verify the whole file. This minimizes read-verify cycles and reduces the risk of partial writes leaving a file in an inconsistent state.
- **Specs can move back to backlog** — if the user decides a fully specified feature should be deferred, move it from the domain file to BACKLOG.md preserving the complete spec. Note which domain file it came from so it can be restored later.

---

## Partial-failure recovery

`/digest` mutates several files in sequence (4b spec write, 4c/Step 5 BACKLOG.md append, 4d/Step 5 notes removal). A crash partway leaves mixed state — **don't blindly re-run.** Three mechanisms already in the skill make recovery safe: the Step 4e `## In-progress` checkpoint, the Step 2 stale-detector that offers Resume/Discard on the next run, and Step 4b's read-and-compare that prevents duplicate spec content.

- **Crash at or after Step 4b, notes not yet cleaned** — the spec is fully old or fully new (whole-file write + self-verify). Re-running is safe: 4b's read-and-compare skips already-written items, 4d then cleans notes. Verify nothing landed in the spec twice.
- **Crash between a BACKLOG.md append (4c/Step 5) and the matching notes removal (4d/Step 5)** — the `[future]` item sits in BOTH files, and the append is NOT idempotent. Before re-running, hand-remove the item from WORKING-NOTES.md so the re-run skips it (or re-run, then delete the duplicate backlog entry).
- **A `## In-progress` checkpoint is on disk** — don't touch anything; re-run `/digest` and let Step 2 walk Resume/Discard.

Nothing commits until `/publish`, so `git -C "$PROJECT_DIR" restore <file>` reverts any bad spec or BACKLOG.md write.
