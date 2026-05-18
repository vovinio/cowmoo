# Builder Deliberate Asymmetries

## FORBIDDEN deny-list instead of TERRITORY allow-list

**Pattern.** Pattern 2 — dev-tools.cjs Shape.

**Divergence.** Builder's `dev-tools.cjs` declares a `FORBIDDEN` constant (paths the agent cannot write into) instead of the `TERRITORY` constant (paths it can write into) used by PM, UXUI, and planner.

**Why.** PM, UXUI, and planner each have a narrow, enumerable write surface (one shared directory plus the agent's own `cowmoo/agent-files/<agent>/`). An allow-list captures that cleanly.

Builder's territory is "everything outside `cowmoo/` plus `cowmoo/agent-files/builder/` plus `cowmoo/codebase/`" — i.e., defined by what it is NOT. Project code layouts vary across languages and frameworks (`src/`, `app/`, `packages/*/`, `tests/` at root, etc.). An allow-list would either over-narrow (breaking on non-default layouts) or devolve into "everything except these specific paths" — which is a deny-list in allow-list clothing.

**Curator implication.** When verifying Pattern 2 (territory enforcement) on builder:
- Expect a `FORBIDDEN` constant rather than `TERRITORY`.
- `territoryCheck()` must block writes into any path matching `FORBIDDEN`, and allow all other writes within `$PROJECT_DIR`.
- `FORBIDDEN` must include every other agent's `cowmoo/agent-files/<other>/`, plus `cowmoo/specs/`, `cowmoo/stack/`, `cowmoo/design/`, plus `cowmoo/config.json`.

**Revisit if.** The builder's territory becomes enumerable (e.g., the project structure standardizes across all supported languages to a single `src/` convention), at which point an allow-list would match the pattern.

---

## No inbox tracker

**Pattern.** Pattern 12 — Inbox Tracker.

**Divergence.** Builder does not have a persistent `.inbox-context` file, does not have an `inbox` subcommand in `dev-tools.cjs`, and does not track incoming messages across sessions.

**Why.** Builder's cross-agent communication happens through task issue comments, not labeled issues. When planner sends something to builder, it's a comment on an active task or a relabel to `todo`; builder reads these during `/start` on the active task, not through a general-purpose inbox.

An inbox tracker would duplicate the task-comment channel without adding value — there's no multi-session "pending work to resolve" state outside the task itself.

**Curator implication.** When verifying Pattern 12:
- Builder is excluded from inbox-tracker round-trip checks (no populator, no reader, no remover expected).
- Do not flag builder's absence of `.inbox-context` or `inbox` subcommand as a violation.
- Verify instead that builder's `/start` reads the active task's comments end-to-end (which is the substitute mechanism).

**Revisit if.** Builder gains a cross-agent channel outside task comments (e.g., a broader `for-builder` label surface), at which point a tracker would become useful.

---

## Full check-agent-with-verifier pattern used here exclusively

**Pattern.** Pattern 9 — Check Agent with Verifier.

**Divergence.** Builder is the only agent running the full check-agent-with-verifier pattern at scale. It spawns four parallel check sub-agents (`@check-criteria`, `@check-patterns`, `@check-edge-cases`, `@check-security`) plus optional `@check-design`, then a dedicated verifier (`@check-verify`) consolidates their findings.

Other agents have check sub-agents (PM has `@check-*` agents for `/review`; planner has `@check-*` agents for PRD review), but neither agent runs a separate Opus-powered verifier sub-agent to filter false positives.

**Why.** Builder's check agents audit code — a domain with high false-positive rates for pattern-matching approaches. A fast Sonnet check pass followed by an Opus verification pass produces trustworthy findings at lower total cost than a single Opus pass would.

PM's and planner's check agents audit prose (specs, PRDs), where findings are less prone to false positives and the user can eyeball them directly. A verifier would add latency without meaningfully raising signal-to-noise.

**Curator implication.** When verifying Pattern 9:
- Only builder is required to have `@check-verify` (or equivalent). The absence of a verifier in PM/UXUI/planner is not a violation.
- When builder adds a new `@check-*` sub-agent, it must feed into `@check-verify` to stay consistent with builder's own convention.
- If PM or planner later adds enough code-adjacent check work to warrant a verifier, Pattern 9 absorbs that — it's not an asymmetry at that point.

**Revisit if.** PM or planner adopts a verifier, collapsing this to "everyone runs the full pattern." Or if builder retires its verifier (unlikely — but the divergence would disappear).

---

## board-drags read as a selection hint, not a label re-sync

**Pattern.** Pattern 14 — GitHub GraphQL Patterns (the read direction).

**Divergence.** Pattern 14's read direction says a skill using the `board-drags` subcommand detects a human card-drag and re-syncs the issue label via a `RELABEL` op (delegated to `issue-transition`). Builder's `/start` runs `board-drags "In Progress" in-progress` but does NOT build a `RELABEL` op — it uses the result only as a soft task-selection hint ("if it prints exactly one, prefer that issue as the task to load"). The label flip `todo → in-progress` happens later, in `/start`'s Step 6 CLAIM op, and only after the user confirms the task.

**Why.** PM, planner, and UXUI process a board-drag in `/catchup` as an inbox event — the drag means "this issue now belongs to my queue," so re-syncing the label immediately is correct. Builder's `/start` is not an inbox: a card dragged into "In Progress" is a *suggestion* of what to build next, and builder must not claim a task until the user has seen the proposed approach and agreed. An eager RELABEL would flip `todo → in-progress` before the user confirms — claiming the task on the human's behalf. Builder defers the label change to the user-gated CLAIM, so the drag stays a hint and the CLAIM is the single, confirmed re-sync.

**Curator implication.** When verifying Pattern 14's read direction on builder:
- Expect `/start` to invoke `board-drags` but NOT build a `RELABEL` op from its output.
- The board→label re-sync for builder happens via the CLAIM op in `/start` Step 6, gated on user confirmation — that is builder's substitute for the immediate RELABEL.
- Do not flag the absence of a RELABEL-on-detection in builder `/start` as a Pattern 14 violation.
- The ordering invariant (re-sync before any label→board write) does not apply — builder `/start` performs no board→label re-sync to order.

**Revisit if.** Builder gains an inbox-style entry point where a board-drag means "this is now mine" rather than "consider building this" — at which point an immediate RELABEL would match Pattern 14's read direction.
