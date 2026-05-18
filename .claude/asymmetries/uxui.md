# UXUI Deliberate Asymmetries

## `/catchup` is a lean gate; inbox handling is split across three skills

PM, planner, and builder keep inbox triage inside a single `/catchup`. UXUI's is three skills: `/catchup` (lean gate — reconcile the board, scan, report counts; stop if empty), `/process-inbox` (present the inbox + route each picked item), `/process-message` (handle one `for-uxui` agent message — the `### Spec update` / `### UI gap` / `### UI question` handlers).

**Why:** UXUI's `/catchup` had grown to ~220 lines serving two unrelated inboxes (designer `uxui:review` review tasks and `for-uxui` agent messages). The split lets an empty inbox check load only the lean gate, and gives each skill one job.

**Curator-implication:**
- Pattern 12 (Inbox Tracker) — the populator that calls `inbox add` is `/process-message`, not `/catchup`.
- Pattern 13 (Message Channel) — the receiver is not a single `/catchup`. A `for-uxui`→UXUI channel trace runs `/catchup` → `/process-inbox` → `/process-message`, where the category handler lives.
- `/contracts` Section 2 still correctly skips UXUI — UXUI's `/catchup` loads the inbox directly (`review-scan` + `gh issue list`, no reader sub-agent).

**Revisit-if:** the three collapse back into one `/catchup`, or another agent's `/catchup` is split the same way (then it is a shared pattern, not a UXUI asymmetry).

## A `uxui:review` task is resolved by three skills, not one

`/process-inbox` classifies each `uxui:review` card and dispatches: a bundle to `/review-bundle` (fetch + evaluate + triage + reject), which on approval invokes `/approve-design` (the approval transaction — re-invocable to resume a partial run); a no-bundle card to `/resolve-review` (resolve from the comments).

**Why:** a single review skill reached ~490 lines, and a `uxui:review` card has two genuinely different resolutions (a Claude Design bundle to evaluate vs. a no-bundle card resolved from its comments). The approval transaction is split out so a partial-failure resume re-invokes only `/approve-design`, skipping re-fetch and re-evaluation.

**Curator-implication:** the partial-failure-recovery pattern's reference implementation for the approval transaction is `/approve-design`. Pattern 13's Designer→UXUI declared exception dispatches to `/review-bundle` / `/resolve-review`.

**Revisit-if:** the three collapse back, or a fourth resolution path is added without a clear boundary.

## `/catchup` reconciles the board with `board-reconcile`, not `board-drags`

PM, planner, and builder detect human card-drags with `board-drags <column> <expected-label>` (one column per call) and relabel via a `RELABEL` op in the skill body. UXUI's `/catchup` instead calls `board-reconcile` — one command that aligns every UXUI status column ↔ label in a single pass and flags the drags it cannot align mechanically (Done-drags, cross-domain drags).

**Why:** UXUI has three status columns (UX: Todo / In Progress / Review); reconciling each via `board-drags` + a per-card relabel loop in the skill body was ~25 lines of mechanical procedure better owned by one deterministic command.

**Curator-implication:** Pattern 14 read-direction — UXUI's `/catchup` does not call `board-drags`. `board-drags` still exists in UXUI's `dev-tools.cjs` (the cross-agent verbatim primitive) but no UXUI skill invokes it.

**Revisit-if:** `board-reconcile` is generalized to the other three agents (then it is a shared pattern), or UXUI returns to per-column `board-drags`.
