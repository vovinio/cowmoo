# Working-Notes Refactor — Mirror to UXUI and Planner

**Status:** Planned. PM changes shipped 2026-05-12; UXUI and planner siblings deferred to a separate session.

**Owner of the decision:** Curator (you).

**One-line summary:** PM's `/start`, `/status`, `/review`, `/digest` were refactored to enforce a clean "WORKING-NOTES.md is staging, not history" contract and to read the working file directly instead of via a summarizing sub-agent. UXUI and planner have parallel skills with the same failure modes that would benefit from the same refactor — but the PM session was scoped to PM only and the user explicitly deferred the sibling work.

---

## 1. The trigger — what made us start

A live PM session showed the agent reporting **two contradictory counts** of WORKING-NOTES.md items in consecutive tool outputs:

- `check-files` (the `dev-tools.cjs` script): reported `0 ready, 134 open, 0 future`
- `@notes-health` (the sub-agent): reported `5 open`

The agent rendered "5 open" in the user-facing summary without bridging the 129-bullet gap. The user asked "what's wrong with that?" — and what surfaced was a much larger design issue than the count mismatch.

Three root causes were uncovered:

1. **Two readers of the same file disagreed.** `workingNotesParse()` in `dev-tools.cjs` did a syntactic count (every `- ` line is an item). `@notes-health` did a semantic count (only bullets representing genuinely open decisions). Both were "correct" for their definition; neither bridged.

2. **The working-notes file had accumulated 134 bullets across 18 sections** — most of which were history (digest log entries, "Resolved Review Items (Archive)" section, "Cross-cutting structural decisions [applied]" notes, old `/review #1` / `#3` / `#4` sections never cleaned up). Per PM CLAUDE.md Rule 1, working-notes is supposed to be staging that "trends toward empty after digests." Practice had stretched it into staging + audit log + decision history + manual archive — three roles fighting each other inside one file.

3. **`@notes-health` sub-agent was doing PM's job for PM.** PM's whole purpose is to think deeply about product content. Loading a sub-agent's summary of working-notes instead of the file itself meant the main agent worked with a lossy distillation. The "fresh context isolation" benefit of sub-agents made sense for narrow tasks like inbox-fetching but was actively harmful for "what's currently open and what should we work on next" — that's PM's primary thinking task.

---

## 2. What we changed in PM (and why)

### Change A — Delete `@notes-health` sub-agent; main agent reads working-notes directly

**Deleted:** `herd/pm/.claude/agents/notes-health.md`.

**Rationale:** PM's job IS thinking about working-notes content. Reading the file directly at `/start` (and at `/status` initially, since revised — see Change B) gives the main agent full ground truth, eliminates the count-mismatch failure mode, and removes the round-trip cost of "sub-agent reads file → summarizes → main agent reads summary." No information loss in summarization.

**Coupled edits:**
- `herd/pm/CLAUDE.md` — removed `@notes-health` from "Available Agents".
- `herd/pm/README.md` — removed agent row from table.
- `herd/pm/tools/dev-tools.cjs` — removed `workingNotesState()` (the regex counter); `checkFiles()` uses uniform `fileStatus()`; `hookSessionStart()` no longer reports working-notes status.

**Tradeoff:** Working-notes is now loaded into main-agent context at every `/start`. For PM's typical use, this is the right cost — PM thinks about notes content all session, so loading them once at start is cheaper than the summary-distillation round-trip.

### Change B — `/start` reads only what's needed to PROPOSE a focus; loads picked domain after focus is chosen

**Initially I had `/start` Read every file in `cowmoo/specs/domains/`** at session start. The user pushed back: this overloads context (10 domains × ~500 lines = ~50k tokens) when the session typically touches only one domain (PM Rule 3: "One domain at a time"). The OLD `/start` loaded domain files only after focus pick — that was actually right.

**Final shape:**

- Step 2 — load **fully**: `WORKING-NOTES.md`, `BACKLOG.md`, `PRODUCT.md`. Glob domain names only (no read).
- Step 4 — propose focus using picker rule (per CLAUDE.md picker discipline).
- Step 5 — after focus picked, Read the relevant domain file(s) **fully**. Typically one per Rule 3.

**Rationale:** matches "one domain at a time" Rule. Cheap at start, complete after focus picked.

### Change C — `/status` is a lightweight snapshot, not a deep dive

**Rewrote `/status`:**
- Used to do full reads like `/start` (heavy).
- Now: grep-based count of `[ready]` / `[future]` tags only (unambiguous regardless of section). Glob for domains. Single-line grep for product name and most-recent session header. No full file reads.
- If raw `- ` line count is much higher than tagged count, surface "Run /start for a full assessment" — punt semantic counting to `/start`.

**Rationale:** `/status` is meant to be a quick read-only snapshot. Full reads belong in `/start`. The two skills should not duplicate each other's depth.

**Mirrors:** `statusline.sh`'s counter (which we also fixed earlier this session — `statusline.sh` now counts only tagged items, dropping the unreliable "N open" claim). `/status` and statusline use the same grep approach intentionally.

### Change D — `/review` Step 6 reconciliation: auto-clean only inline-resolved-this-session, not cross-run

**Initially:** `/review` Step 6 auto-removed any prior-run routing that this run didn't flag again. The user pushed back: LLM-driven check agents have variance, so a finding disappearing from this run doesn't prove it was resolved — could be under-detection. Silent removal = data loss.

**Final shape:**
- **Auto-clean only** the routings the user resolved INLINE during Step 4–5 fix path (safe — user explicitly resolved this session).
- **Surface as confirm list** the prior-run routings this run didn't flag. User confirms per item or batch before removal.

**Rationale:** Preserve human-in-the-loop for ambiguous cleanup. Auto-cleanup is appropriate only when the user explicitly took an action that resolves the routing.

### Change E — `/digest` reasoning-preservation quality gate

The most important change. PM CLAUDE.md Rule 1 says working-notes is staging → things move OUT during `/digest`. But working-notes entries often contain **reasoning** ("we considered X but chose Y because Z," "this threshold of 5/hour came from…", "rejected option A because it would have caused B"). If `/digest` writes only the WHAT into the spec and drops the WHY, that reasoning is gone — git history doesn't preserve it inside the spec file where it'd actually help future readers.

**Added to `/digest`:**

- **Step 3a "extraction table":** before writing, scan source working-notes items for trade-off rationale / rejected alternatives / threshold justifications / cause-and-effect history. Decide where each kind lands in the spec:
  - Trade-off explaining a Key Behavior → inline `**Rationale:**` note under that Key Behavior in PRODUCT.md
  - Reason for a specific threshold/limit → inline next to the field with `(why: …)`
  - Why an alternative was rejected → `**Considered alternative:**` line in the relevant entity/feature
  - Cross-cutting decision rationale → a `### Design notes` sub-section at the end of the spec file
- If no good home exists in the existing template, **add one rather than dropping the reasoning.**
- **Step 3d "reasoning gate":** before deleting any working-notes item, verify its embedded reasoning has landed in the spec. If not, stop and patch the spec.
- New Rule: **"Reasoning travels with the decision."** Deletion is acceptable ONLY after reasoning is preserved.

**Rationale:** without this gate, the new "staging only" contract silently destroys decision context that the OLD "kept for traceability" pattern preserved (sloppily, but preserved). Specs should be self-contained — including the WHY, not just the WHAT.

---

## 3. The principle underneath all four changes

> **The working file is staging for thinking. The spec is the durable record of decisions and their reasoning. The main agent thinks directly about the staging content. Sub-agents handle narrow, isolated tasks. Skills that report status should not duplicate skills that load context.**

This principle is universal across formalization-style agents (PM, UXUI, planner). It just hasn't been applied to UXUI and planner yet.

---

## 4. Sibling work — UXUI

Sister-implementation sweep (run 2026-05-12) found these UXUI parallels. All are CONCEPT-ECHO — independent issues, not coupled to PM's changes, but identical failure modes.

### UXUI Sibling A — `/define` reasoning-preservation gate (strongest case)

**File:** `herd/uxui/.claude/skills/define/SKILL.md`, Step 3 (around lines 53–139).

**Why it echoes PM Change E:** `/define`'s own description says "Like PM's `/digest` but for UI." It is the explicit sister formalization skill. It writes from `WORKING-NOTES.md` into `cowmoo/design/*` files (OVERVIEW intent, journeys, roles, screen-index, domain files), then cleans processed items from working notes in Step 3f. Missing:
- Equivalent of Step 3a "reasoning extraction table"
- Equivalent of Step 3d "reasoning gate"
- "Reasoning travels with the decision" Rule

UXUI working-notes generate the same kinds of reasoning content PM's do: state-handling strategy tradeoffs (error inline vs banner vs blocking modal), layout variant rationale (single-column vs two-column grouped vs stepped), role-naming "considered alternative" history. Without the gate, this reasoning is dropped during `/define`.

**Natural homes for the reasoning in UXUI's file structure:**
- Cross-cutting design rationale → OVERVIEW.md Design Intent prose
- Rejected role names with reasoning → `**Considered alternative:**` lines in `roles.md`
- Non-obvious state-handling choice rationale → inline `**Why:**` notes in the relevant screen definition in the domain file
- Layout variant trade-offs that informed the choice → inline notes near the screen's layout description

**Concrete edit plan when picked up:** Mirror PM `/digest` Step 3a and 3d exactly, adapting the extraction table's "where it lands" column to UXUI file shapes (above). Add the same Rule to `/define`'s Rules section. Update the Completion Checklist with the gate item.

### UXUI Sibling B — `/start` over-loading

**File:** `herd/uxui/.claude/skills/start/SKILL.md`, Step 1 (lines ~24–37).

**Why it echoes PM Change B:** Reads ALL files in `cowmoo/specs/domains/` AND `cowmoo/design/domains/` up front, before any focus is picked. Per Pattern 19 / UXUI Rule "One domain at a time," sessions typically touch one domain. Loading all upfront bloats context with files the session won't use.

**Edit plan:** Read OVERVIEW.md, journeys.md, roles.md, screen-index.md, WORKING-NOTES.md fully at start (these are session-level context, needed to propose focus). Glob `specs/domains/*.md` and `design/domains/*.md` by name only. Load specific domain files fully in Step 3 after the user picks a focus.

### UXUI Sibling C — `/status` doing `/start`'s work

**File:** `herd/uxui/.claude/skills/status/SKILL.md`, lines ~24–34, ~63–67.

**Why it echoes PM Change C:** Reads OVERVIEW.md, journeys.md, roles.md, screen-index.md, WORKING-NOTES.md in full and reports "[N] tagged [ready] / [future] / untagged items." Same shape as PM's old heavy `/status`. Should be a lightweight snapshot.

**Edit plan:** Mirror PM's new `/status`. Grep-based tagged-only count. Glob for domain names. No full reads. Punt semantic counting to `/start`.

### UXUI Sibling D — `/review` no cross-run-staleness handling

**File:** `herd/uxui/.claude/skills/review/SKILL.md`, Step 5 (lines ~94–100).

**Why it echoes PM Change D:** Routes structural items to working-notes but never reconciles them on later runs. Doesn't have PM's bad-auto-remove behavior, but also doesn't have PM's defensive surface-as-confirm-list pattern. If UXUI accumulates `/review` routings the way PM did (and it will, given the same shape), it'll hit the same bloat-over-time failure mode.

**Edit plan:** Add Step 6 (or new sub-step in Step 5) mirroring PM's reconciliation: auto-clean inline-resolved-this-session; surface cross-run staleness as confirm list. Apply the "single section, current state only" rule (no dated `#N` sections).

---

## 5. Sibling work — Planner

### Planner Sibling A — `/start` over-loading

**File:** `herd/planner/.claude/skills/start/SKILL.md`, Step 1 (lines ~47–60).

**Why it echoes PM Change B:** Reads `cowmoo/specs/PRODUCT.md` + "All files in `cowmoo/specs/domains/`" + a fixed set of `cowmoo/design/*.md` files always. Notably, planner ALREADY HAS the lazy-load pattern for `cowmoo/design/domains/*.md` (line ~59: "read the file for each domain in the candidate story… Skip domains you're not actively considering") — but that pattern isn't applied to `specs/domains/`. Applying the same lazy-load pattern to `specs/domains/` would internally harmonize.

**Edit plan:** Mirror the existing `design/domains/` lazy-load pattern onto `specs/domains/`. Read PRODUCT.md fully at start; Glob specs/domains/ by name; load specific spec domain files fully when planning work that touches them.

### Planner Sibling B — `/draft` + `/publish` reasoning preservation (weaker analog)

**Files:** `herd/planner/.claude/skills/draft/SKILL.md` line ~51 + `herd/planner/.claude/skills/publish/SKILL.md` Step 3.

**Why it weakly echoes PM Change E:** Planner has a partial rule already (`/draft` Step 2 line 51 says "knowledge.md additions — product constraints and cross-domain facts that affect PRD writing. **Planning rationale belongs here only if it constrains future decisions (not as a record of discussion).**"). This is a *what-to-include* rule, not a *don't-lose-it-before-deletion* gate. `/publish` Step 3 appends to `knowledge.md` from `draft.md`'s Updates section, then `clear-draft` deletes `draft.md` (Step 4). If a planner conversation produced "we considered story-order A but chose B because Z" reasoning and the planner didn't capture it in draft.md's Updates section, it's lost when the conversation ends and draft.md is deleted.

**Edit plan:** Add a `/draft` Step 4 (or Step 2.5) that scans the conversation for planning rationale (trade-offs around story ordering, scope-keep-vs-split, dependency-revisions-because-of-X) and ensures any decision-constraining reasoning lands in `draft.md`'s "Updates" section. Add a `/publish` reasoning gate before `clear-draft`: verify the conversation's planning rationale has landed in `knowledge.md` (via the Updates section) before deleting `draft.md`.

**Weaker because:** Planner's draft.md is single-session-scoped (rewritten by each `/draft` run, not an accumulating staging file). The loss surface is the conversation-to-`knowledge.md` transition, not a staging-to-permanent transition like PM. Still worth the gate, but the principle applies in a slightly different shape.

---

## 6. What deliberately stays out

- **Builder is different.** Builder doesn't have a digest-family skill. `BUILD-NOTES.md` is updated incrementally during `/publish` and PERSISTS across tasks — it's the durable record itself, not a staging file. No mirror needed for any of the four PM changes.
- **Planner's `/status` and `/review`.** Planner's `/status` is a thin wrapper around `@plan-check` (sub-agent does the work). Planner's `/review` works on `draft.md` (single-session artifact, regenerated each `/draft` run) — no cross-run staleness risk. Both correctly stay as-is.
- **UXUI's `/design-publish` "auto-clear draft".** False-positive on the cross-run sweep. `design-draft.md` is single-run scratch, regenerated by `/design-draft`, auto-cleared after a fully-successful `/design-publish` — appropriate auto-clean, not analogous to PM's reconciliation risk.

---

## 7. Open questions for the future session

1. **UXUI Sibling A reasoning extraction table — adapt vs duplicate?** The PM Step 3a table has four kinds of reasoning and four landing locations. UXUI's file structure is different (no PRODUCT.md, no per-domain "Key Behaviors"). Decide whether to write a UXUI-specific table or describe the principle and let the agent figure landing sites. Lean: explicit table, adapted to UXUI shapes (specifics provided in section 4 above).
2. **Planner Sibling B — gate location.** Two natural places: (a) at the END of `/draft` (before reporting "draft written"), (b) at the START of `/publish` (before `clear-draft` runs). (b) is more defensive (catches reasoning loss right before the deletion). (a) is earlier and shorter-feedback-loop. Lean: (b), to mirror PM's "right before delete, verify landed."
3. **Do all four UXUI changes ship together or staged?** They're independent. Strongest case is `/define` reasoning gate (Sibling A). Could ship that alone, then come back for B/C/D. Or do all four UXUI in one session for consistency. Lean: all four together because they share rationale and a coordinated commit is cleaner.
4. **Update PM CLAUDE.md Rule 1's "staging-only" wording to apply across agents?** Currently the rule is PM-specific. If UXUI and planner both adopt the same contract, the principle deserves a shared home — maybe a cross-cutting note in `docs/ARCHITECTURE.md` rather than triplicated in each agent's CLAUDE.md.
5. **Mirror the sister-implementation Agent rule we just added to curator CLAUDE.md** — was triggered BY this PM session. After the UXUI/planner siblings land, audit whether the sister-impl rule itself caught what it was meant to catch.

---

## 8. References

- **Session conversation:** May 10–12, 2026. Curator session that started with PM `/start` 134-vs-5 output, refactored PM, then added the sister-implementation discovery procedure to curator CLAUDE.md.
- **Commits to find PM changes:**
  - `b785024` — model promotions + PM /start picker discipline
  - (later commits this session, not yet committed at time of writing) — the four PM refactors + curator CLAUDE.md/ARCHITECTURE.md additions
- **Sister-implementation sweep:** Run by curator at end of PM session against the four PM changes. 0 DUPLICATE-LOGIC findings (PM changes broke nothing). 6 CONCEPT-ECHO findings — the six siblings above. Full classification in conversation transcript.
- **Relevant patterns / docs:**
  - PM CLAUDE.md Rule 1 (staging only, never history)
  - PM CLAUDE.md Rule 3 (one domain at a time)
  - curator CLAUDE.md "Verification Is Part of the Change" — behavioral-changes branch, sister-implementation discovery procedure
  - docs/PATTERN-CATALOG.md Pattern 12 (Inbox Tracker — analogous "tracker has a complete populator → reader → remover lifecycle" principle; staging-not-history rhymes with this)

---

## 9. Picking this up later — TL;DR

If you're a future curator session looking at this idea file with no other context:

1. Read PM's current state: `herd/pm/.claude/skills/start/SKILL.md`, `status/SKILL.md`, `review/SKILL.md`, `digest/SKILL.md`, `herd/pm/CLAUDE.md` Rule 1.
2. Read sections 2 and 3 above to understand the PM design.
3. Pick a sibling from section 4 or 5 (strongest case: UXUI Sibling A — `/define` reasoning gate).
4. Apply the analog refactor, following the edit plan in that sibling's section.
5. Run the curator `/check → /patterns → /contracts → /coherence` pipeline.
6. Commit.

The PM session and this idea file together carry the full reasoning. You shouldn't need to re-derive the design.
