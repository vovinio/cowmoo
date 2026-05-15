---
name: design-start
description: Synthesize UI state and propose the next batch of design tasks (1-3 tasks). Phase B entry point. Conversational — nothing is written.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash
---

# Design Start

Survey what's been designed, what's pending, and what visual direction has emerged. Lead the user with a concrete proposal for the next batch of design tasks — typically 1-3 screens that hang together with deliberate reasoning.

This is the **thinking** phase. Nothing gets written. The output is a shared understanding of what to draft next, captured in conversation. Run `/design-draft` after to compose the actual task bodies.

---

## Step 0: Verify UI definitions exist — bail if not

Phase B can't propose design tasks without UI definitions to draw from. Run `node tools/dev-tools.cjs check-files` and read the `design-domains:` line — it reports the count of `*.md` files in `$PROJECT_DIR/cowmoo/design/domains/`.

**If `design-domains: 0`** — stop with:

```
No UI definitions found in cowmoo/design/domains/.

Phase B (design tasks) can only run after Phase A (UI definitions) has produced at least one domain. Run /start to begin Phase A discussion, then /draft → /define → /publish to write definitions, then come back here.
```

If `design-domains:` is 1 or more, proceed.

---

## Step 1: Read everything (synthesis pass)

Read in parallel where possible. Each of these sources contributes to "what's the right next batch":

**Source of truth — what we're building:**
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — product overview
- `$PROJECT_DIR/cowmoo/specs/domains/*.md` — per-domain business rules (every file)

**UI definitions — what the design surface covers:**
- `$PROJECT_DIR/cowmoo/design/OVERVIEW.md` — design intent, navigation
- `$PROJECT_DIR/cowmoo/design/journeys.md` — cross-domain user flows
- `$PROJECT_DIR/cowmoo/design/roles.md` — role vocabulary in use
- `$PROJECT_DIR/cowmoo/design/screen-index.md` — every screen, organized
- `$PROJECT_DIR/cowmoo/design/domains/*.md` — per-domain screen definitions

**What's been approved (the learning loop):**
- `$PROJECT_DIR/cowmoo/design/VISUAL-JOURNAL.md` (if exists) — one ~15-line entry per approved bundle: character, layout, state handling, roles established/used, patterns set up, deviations. This is the pre-digested source of "visual direction already established" — written at approval time by `@uxui-journal-ops`.
- Do NOT read `cowmoo/design/bundles/<ticket>/` contents here. Those are the full design artifacts (HTML, chats, READMEs) — intended for `@design-evaluator` at review time (and human-reference for designers). Reading N bundles here would blow the context budget as the project matures; the journal is the purpose-built summary.
- If `VISUAL-JOURNAL.md` doesn't exist yet (project has no approved bundles, or you're mid-migration), treat as "no prior visual direction established — first batch will set direction."
- **Escape hatch:** if synthesis needs richer context on a specific prior bundle (e.g. exact token names from an earlier approval the journal summarized tersely), you MAY read that one bundle's `chats/*.md` directly — targeted, one bundle, not bulk. This mirrors the pattern in `/design-draft` Step 2.

**Current GitHub state (what's in flight):**
```bash
gh issue list --label "uxui:todo" --state open --json number,title --limit 50
gh issue list --label "uxui:review" --state open --json number,title --limit 50
gh issue list --label "uxui:done" --state closed --json number,title --limit 50
```

---

## Step 2: Form a synthesis (internal — no chat output)

After the reads, build a concise mental model. **Don't echo this back as a verification step** — the user invoked `/design-start` to GET your proposal, not to verify your reading. The synthesis becomes evidence inside the Step 3 proposal ("Inherits", "Why these together", "Why now").

Hold in context:

- **What's defined:** N screens across M domains (+ K cross-domain flows from journeys.md)
- **What's been approved:** N screens (closed `uxui:done`); their bundles
- **What's pending:** screens with UI defs but no bundle attached yet
- **What's in flight:** open `uxui:todo` (designer queue), `uxui:review` (waiting for review)
- **Visual direction so far:** the character + patterns captured in `VISUAL-JOURNAL.md` (e.g., "warm earth tones, serif headers, dense layout, conversational voice; 8px default radius established; blur-validation UX"). For first session or when the journal is empty: "None yet — first design batch will set direction."

Step 3 surfaces the load-bearing parts of this synthesis as the proposal's evidence — no separate "present synthesis" chat step.

---

## Step 3: Propose the next batch (lead with reasoning)

Based on the synthesis, propose **ONE coherent batch of 1-3 design tasks** with explicit reasoning. The proposal must answer:

- **What:** which screens (typically 1-3 from the pending list)
- **Why these together:** coherence justification — shared journey, shared visual treatment, completing a flow, etc.
- **Why now:** why this is the right next batch (entry point, foundational, unblocks downstream, completes a journey, etc.)
- **Inherits:** specific visual decisions from prior approved bundles to respect (or "establishes initial direction" for first batch)
- **Sets up:** what this batch's outcome will inform for downstream work

Pattern:

```
Proposed next batch: <name — short noun phrase>

Tasks:
- <screen 1> — <one-line>
- <screen 2> — <one-line>
- <screen 3> — <one-line>

Why these together: <coherence>
Why now: <ordering rationale>
Inherits: <prior visual decisions, or "first batch — establishes direction">
Sets up: <what these screens establish for downstream work>

Sound right, or different angle?
```

When the synthesis admits 2-4 genuinely different starting points (different value/risk profiles, different parts of the product), use the `AskUserQuestion` tool to present the choice — `(Recommended)` first, descriptions stating what each batch gets you. Otherwise stay in prose with one recommendation.

---

## Step 4: Refine through conversation

User reacts: confirms, narrows, broadens, picks a different angle. Keep the conversation tight — agent reflects back the refined batch concisely after each adjustment.

When the batch is locked, summarize:

```
Locked next batch:
- Screens: [list]
- Why these together: [coherence]
- Inherits: [visual direction]

Run /design-draft to compose the task bodies.
```

---

## Step 5: Stop

Do NOT write any files. Do NOT touch GitHub. Do NOT compose task bodies. The user runs `/design-draft` next, and the locked batch carries forward in conversation.

---

## Completion Checklist

- [ ] All sources read (specs, design defs, VISUAL-JOURNAL.md, GH state) — no per-bundle reads by default
- [ ] Synthesis presented (concise — what's done, what's pending, visual direction)
- [ ] One batch proposed with explicit reasoning (what / why-together / why-now / inherits / sets-up)
- [ ] User confirmed or redirected; batch locked
- [ ] User informed `/design-draft` is the next step

---

## Rules

- **Synthesize first, propose second.** Reading is a substantial step — do it thoroughly. The proposal is only as good as the synthesis.
- **Lead, don't ask.** Propose ONE batch with reasoning. The user reacts. Don't open with "what should we work on?"
- **Small batches (1-3 tasks).** Bigger batches lose the iteration loop and dilute coherence. If the user wants more, they run `/design-start` again after the first batch ships.
- **Visual direction is specific, not vague.** Distill what `VISUAL-JOURNAL.md` records into concrete observations ("warm earth tones, serif headers, 8px base spacing"), not adjectives ("nice and warm").
- **Read the journal, not the bundles.** The journal is the purpose-built pre-digested summary of approved bundles. Reading bundle internals (`chats/*.md`, `project/*.html`, etc.) blows the context budget as the project matures and is bypassing the amortization the journal provides. Only read a specific bundle directly when the journal's summary is genuinely insufficient for a narrow question — and name why.
- **First batch is foundational.** When no prior bundles exist, say so explicitly. The first batch establishes patterns the rest of the product inherits — propose accordingly (entry-point screen, foundational flow).
- **Don't write anything.** This skill is purely conversational. The output is a locked batch in conversation context.
- **Don't propose work for screens without UI defs.** If a screen isn't in `cowmoo/design/domains/`, it can't be designed yet — Phase A needs to define it first. Recommend `/start` (Phase A) instead.
