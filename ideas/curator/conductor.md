# Conductor — short explainer

## What it is

A driver Claude that operates the 4 herd agents (`moo pm|uxui|planner|builder`) running in their own tmux panes. The driver types prompts into each agent, reads their output, waits for them to finish, and decides what to do next — like a human operator using the terminal.

You stay in one terminal and only talk to the driver. You can jump into any herd pane manually when needed.

## Why this shape

- Herd agents are Claude Code TUIs → tmux is the only native way to drive them.
- Anthropic's Agent Teams doesn't fit — it spawns internal teammates, not external `moo <agent>` processes.
- Closest open-source match (AWS CAO, ~70%) is a generic supervisor; cowmoo has a fixed named-role handoff graph (PM → UXUI → planner → builder), which is the only novel part.
- Build cost is small (~500 lines), techniques are well-understood, and v0 ships in a day.

## Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│  tmux session: cowmoo-<project>                                     │
│                                                                     │
│  ┌──────────────────────────┐  ┌────────────────────────────────┐  │
│  │                          │  │  pane 1: moo pm                 │  │
│  │   pane 0:                │  ├────────────────────────────────┤  │
│  │   driver Claude          │  │  pane 2: moo uxui               │  │
│  │   (you talk here)        │  ├────────────────────────────────┤  │
│  │                          │  │  pane 3: moo planner            │  │
│  │   primitives:            │  ├────────────────────────────────┤  │
│  │     tell <agent> "..."   │  │  pane 4: moo builder            │  │
│  │     read <agent>         │  └────────────────────────────────┘  │
│  │     wait_idle <agent>    │              ▲                        │
│  │     status <agent>       │              │ tmux send-keys /       │
│  │     attach <agent>       │              │ capture-pane           │
│  │     handoff <a> → <b>    │  ────────────┘                        │
│  └──────────────────────────┘                                       │
└────────────────────────────────────────────────────────────────────┘

         human ──talks to──▶ driver
         human ──attach──▶ any herd pane (manual override)
         driver ──drives──▶ herd panes via tmux primitives

handoff graph (encoded in driver's CLAUDE.md):
    idea → PM (spec) → UXUI (design) → planner (plan) → builder (code, PR)
```

## Flow

1. `moo conduct <project>` creates the tmux session, launches herd in panes 1-4, driver in pane 0.
2. You tell the driver what you want to build.
3. Driver picks who goes first based on the handoff graph.
4. Driver `tell`s the agent and `wait_idle`s — polling the pane, not burning tokens.
5. Driver re-engages when: agent finishes, agent shows a permission prompt, or agent goes stuck (idle without expected artifact).
6. Driver summarizes the agent's output, asks you for decisions, then `handoff`s to the next agent.
7. Loop until the work is done; driver shuts down the session cleanly.

You attach to a herd pane (~2-4 times per session) only when something is genuinely tricky. Driver pauses while you're attached and resumes when you signal back.

## Repo layout

```
cowmoo/
├── moo                                  # +"conduct" subcommand
├── conductor/                           # NEW — curator-level orchestration
│   ├── CLAUDE.md                        # driver brain + handoff graph
│   ├── .claude/skills/conduct/SKILL.md  # primitive playbook
│   └── tools/conduct.cjs                # primitives (tmux glue)
└── herd/                                # UNCHANGED in v0
```

No herd changes in v0. The conductor scrapes panes (CAO-style: ANSI-strip + tail-N + match Claude Code's input-prompt glyph). Uninstalling the conductor leaves zero trace in the herd.

## Techniques to steal (from research)

1. **Tail-N idle detection** on ANSI-stripped pane output (CAO uses 5 lines, primeline 12).
2. **Force inline mode** — disable Claude Code's alt-screen so capture-pane reads scrollback.
3. **Queue-until-idle delivery** — don't fire prompts blindly; watch the receiver's pane until it goes idle, then deliver.
4. **`load-buffer` + `paste-buffer` for multi-line** — `send-keys` mangles newlines (Claude Code issue #43169).
5. **Hybrid stuck detection** — idle AND no expected artifact written within window (agtx pattern).
6. **Defensive `pane-base-index`** — read `tmux show -gv pane-base-index`, don't hardcode.

## UI ambition tiers

- **v0**: pure tmux, 5 panes, driver scrapes them. ~1 day.
- **v1**: status dashboard pane (node `blessed`). Adds visibility, no logic change. ~1 extra day.
- **v2**: web sidecar — local web server rendering driver transcript, diffs, message history. ~1 week.

Recommendation: ship v0, use it for real work, decide if v1/v2 earns its keep. Most custom UIs over tmux become decorative once the orchestrator works.

## What's actually novel

Not the primitives (CAO/agtx/primeline have them).
Not the tmux plumbing (well-understood).

The novelty is **the cowmoo handoff graph encoded in the driver's CLAUDE.md** — knowing PM → UXUI → planner → builder, knowing the vocabulary for each transition, knowing when each agent's output is "ready for handoff." That's the cowmoo-shaped IP; everything else is scaffolding.

## Caveat — design as throwable scaffolding

Anthropic's Agent Teams shipped Q1 2026 and is iterating fast. If it grows "attach to external `claude` session" support (plausible within 6 months), a bespoke conductor becomes vestigial. Keep the conductor cheap to throw away — don't bake conductor assumptions into the herd, don't add MCP requirements, don't grow it past what we actually use.

## Research sources

- [awslabs/cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator) — closest match, supervisor-as-LLM-in-pane, MCP-mediated primitives, per-provider idle detection.
- [fynnfluegge/agtx](https://github.com/fynnfluegge/agtx) — kanban-board TUI over tmux orchestrator; opt-in mode; stuck-detection via time + artifact.
- [primeline-ai/claude-tmux-orchestration](https://github.com/primeline-ai/claude-tmux-orchestration) — tiny pure-shell reference for the driver loop.
- [Anthropic Agent Teams](https://code.claude.com/docs/en/agent-teams) — official, but spawns internal teammates only.
- Different shape (catalogued, not adopted): Claude Squad, Jedward23/Tmux-Orchestrator, parruda/swarm, claude-flow, ccswarm, claude-code-agent-farm.
