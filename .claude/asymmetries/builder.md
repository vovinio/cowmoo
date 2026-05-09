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
