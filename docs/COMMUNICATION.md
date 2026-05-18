# Cross-Agent Communication Principle

How agents talk to each other when something goes wrong or needs attention.

## The Principle

> **Agents report what they observed to their immediate upstream. They don't diagnose across agent boundaries and they don't prescribe fixes for other agents.**

When an agent hits a problem it can't solve alone, it sends an **observation** upstream — a description of what happened, what was tried, and what the sender needs to proceed. The upstream agent receives the observation, decides the diagnosis, and chooses the remediation. That remediation may involve further escalation to a third agent, rewriting the task, or anything else — but the decision belongs to the recipient, not the sender.

This isn't arbitrary politeness. Each agent has a different context, different scope, and different authority. A builder has deep context on code and techstack but shallow context on why a task was planned a certain way. A planner has decomposition context but no direct authority over specs or UI definitions. Letting agents prescribe fixes across boundaries makes them act on assumptions about information they don't have.

## Immediate Upstream

Each agent's immediate upstream is the agent that gave it the work:

| Agent | Immediate upstream | Escalates via |
|-------|--------------------|-----------------|
| Builder | Planner (wrote the task PRD) | `/return` — posts observational RETURN comment, labels `for-planner` |
| Planner | PM (for spec issues), UXUI (for UI definition issues) | `/ask pm` — `for-pm` issue; `/ask uxui` — `for-uxui` issue |
| UXUI | PM (for spec issues), Planner (for task-scope responses) | `/ask pm` — `for-pm` issue; `/ask planner` — `for-planner` issue |
| PM | The user | Direct conversation |

The "immediate upstream" is whoever is best positioned to diagnose the observation. If that agent can't resolve it either, they escalate further along their own upstream — never reaching across boundaries to dictate changes to agents they don't coordinate with directly.

Planner and UXUI are peers — each is upstream of the other for its own domain. Planner asks UXUI about UI definitions; UXUI asks Planner about task scope. The table above reflects this: both appear in each other's upstream list.

## Good vs. Bad Phrasing

The difference is observational ("what I saw") vs. prescriptive ("what you should do").

| Bad (prescriptive) | Good (observational) |
|---|---|
| "UXUI needs to update `cowmoo/design/domains/billing.md` line 42" | "Screen 'Invoice List' in the task's referenced design file doesn't include a loading state, but the PRD acceptance criteria require one" |
| "Planner, rewrite this task to split checkout from webhook handling" | "Task scope covers two independent concerns (checkout, webhooks). Three attempts to implement both together produced conflicts." |
| "PM, add 'archived' status to the Order entity spec" | "Spec for Order lists 3 statuses (draft/active/closed). The task's referenced design file shows a 4th state labeled 'archived' which doesn't exist in the spec." |

The good version states a fact the upstream can verify. The bad version skips the diagnosis step and jumps straight to a prescribed fix — which may be wrong, impossible, or owned by a different agent entirely.

## Diagnosis Inside Your Own Scope Is Fine

The principle only forbids diagnosing **across** boundaries. Inside your own scope, diagnosing and fixing is exactly your job:

- **Builder** diagnoses code bugs, typos, missing imports, failing tests, and fixes them directly — no escalation needed
- **Planner** diagnoses task sizing ("this is too big, split it"), dependency ordering, story scoping — and rewrites PRDs accordingly
- **UXUI** diagnoses UI coverage gaps, missing states, inconsistent components — and updates `cowmoo/design/` files
- **PM** diagnoses spec contradictions, missing edge cases, unclear terminology — and rewrites specs

The prohibition is only on reaching over into a neighbor's scope and telling them what to do there.

## Communication Channels

Current state of message channels. Each channel has a sender skill and a recipient skill. Labels route messages; the body is natural language.

| From → To | Label | Sender | Recipient |
|---|---|---|---|
| Builder → Planner | (on task issue) | `/return` comment | Planner's `/catchup` Blocked task handler |
| Builder → Planner | (on task issue) | `/publish` RECORD comment | Planner's `/catchup` Deviation report handler |
| Planner → Builder | (on task issue) | `/catchup` comment + relabel | Builder's `/start` comment scan |
| Planner → PM | `for-pm` | `/ask pm` | PM's `/catchup` |
| PM → Planner | `for-planner` | `/notify planner` | Planner's `/catchup` |
| PM → Planner | `for-planner` (relabeled from `for-pm`) | PM's `/catchup` (transfer relabel) | Planner's `/catchup` (`other` category) |
| UXUI → PM | `for-pm` | `/ask pm` | PM's `/catchup` |
| PM → UXUI | `for-uxui` | `/notify uxui` | UXUI's `/catchup` |
| PM → UXUI | `for-uxui` (relabeled from `for-pm`) | PM's `/catchup` (transfer relabel) | UXUI's `/catchup` |
| Planner → UXUI | `for-uxui` | `/ask uxui` | UXUI's `/catchup` |
| UXUI → Planner | `for-planner` | `/notify planner` or `/ask planner` | Planner's `/catchup` |
| Designer → UXUI | `uxui:review` (designer drags the card to the "UX: Review" board column and posts a Claude Design share URL; UXUI's `/catchup` detects the card-move and sets the label — a direct `uxui:review` label-flip is still honored as a fallback) | Human designer (external — acts on the project board + the GitHub issue) | UXUI's `/catchup` dispatches to `/review-bundle` |

(UXUI's `/notify planner` announces changes to `cowmoo/design/` files that may affect active planner work.)

(The Designer → UXUI channel is the one external-human handoff. On approval, `/review-bundle` flips the issue to `uxui:done` and closes it. On rejection, it flips back to `uxui:todo` for the designer to iterate.)

Agents that never talk to each other directly:
- **Builder ↔ PM** — builder escalates through planner only
- **Builder ↔ UXUI** — builder escalates through planner only (the new planner → UXUI channel handles UI issues surfaced by builder returns)
- **UXUI ↔ Builder** — same, via planner
- **Curator ↔ any project agent** — curator operates on cowmoo meta-level, never touches project content

## Adding a New Channel

When the system needs a new direct communication path, the changes required are:

1. **Sender skill** — add or extend a `/notify` skill (for announcements) or `/ask` skill (for blocked requests) with the target. Include content guidelines for what the message should contain, and the `issue-create` invocation (compose the body, write the `.op-handoff.json` entry, run the subcommand).
2. **Handoff entry** — the sender skill's handoff entry carries `op: "CREATE_FOR_<TARGET>"` and `label: "for-<target>"`. The generic `issue-create` subcommand handles it — adding a channel needs no new `dev-tools.cjs` code, only the right label in the entry.
3. **Recipient handler** — update the recipient's `/catchup` skill to recognize the new message source and route to the appropriate handler.
4. **Rules updates** — update the `github-workflow.md` rule on both sender and recipient sides to reflect the new channel.
5. **Update this document** — add a row to the Communication Channels table.

Skipping any of these steps leaves the channel half-wired — either the sender can produce messages the recipient doesn't handle, or the recipient expects messages nobody sends.

## See Also

- `docs/ARCHITECTURE.md` — why the system uses GitHub Issues for coordination at all
- `docs/PATTERN-CATALOG.md` — Pattern 13 (Message Channel), Pattern 14 (GitHub GraphQL Patterns — board Status sync + sub-issue linkage), Pattern 15 (Identity Prefix) with canonical shapes
- Each agent's `.claude/rules/github-workflow.md` — label tables and per-agent identity conventions
