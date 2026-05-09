---
name: tech-stack
description: Analyze specs and decide tech stack through conversation. Use when starting a new project or when user says /tech-stack.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Agent, Glob, Grep, Bash, AskUserQuestion
---

# Tech Stack Selection

Guide the user through choosing the right technology stack for their project. This is a high-impact decision — take time to understand the product before proposing anything.

## Avoid Defaults Bias

LLMs over-favor popular stacks (React, Next.js, Postgres, Firebase) because their training data is dominated by them. For each decision in this skill, consider simpler alternatives first and justify complexity against the product summary written in Step 2.

For the frontend choice specifically there is a concrete complexity hierarchy — when you reach Step 3's frontend discussion, Read `references/defaults-bias.md` for the ordered list and the reasoning.

## Session Detection

Before starting, run `node tools/dev-tools.cjs check-files` and read the `techstack.md:` and `techstack-notes.md:` lines. `cowmoo/stack/techstack.md` is only ever written by this skill itself (Step 7 finalization) — project initialization does not create it — so its existence signals real content.

Treat `exists (empty)` the same as `not found` in the matrix below — an empty file carries no resumable content.

| `techstack-notes.md` | `techstack.md` | Action |
|-----|-----|--------|
| `exists` | `not found` | Resume the conversation. Read the notes, summarize where we left off, continue from there. |
| `exists` | `exists` | Finalization was interrupted. Read `cowmoo/stack/techstack.md` — if it looks complete, confirm with user and delete `cowmoo/agent-files/planner/techstack-notes.md` via `node tools/dev-tools.cjs clear-techstack-notes` (plain `rm` is not in the Bash allow-list). If incomplete, resume from the notes. |
| `not found` | `exists` | Tech stack already decided. Show current decisions and ask if they want to amend. Amendments update the existing file — add/change specific decisions without restarting the whole process. |
| `not found` | `not found` | Fresh start. Begin at step 1. |

## Process (Fresh Start)

### 0. Verify specs exist — bail if not

Run `node tools/dev-tools.cjs check-files` and read the `domain-specs:` line. It reports how many `*.md` files exist in `$PROJECT_DIR/cowmoo/specs/domains/`. Project initialization creates `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` as a stub template, so its mere existence isn't evidence of real specs — domain files are. PM publishes at least one domain via `/digest` once there's enough to plan from.

**If `domain-specs: 0`:** stop immediately and tell the user:

```
Can't run /tech-stack yet — there are no domain specs to ground the decisions in.

Tech-stack choices depend on the product: database fit depends on the data model; auth approach depends on user types; deployment depends on scale and integrations. Without specs, any answer would be a guess.

Ask PM to publish at least one domain via `/digest`, then re-run /tech-stack.
```

Do NOT proceed to step 1. Do NOT write any file. Stop.

### 1. Read all specs

Read every spec file to understand the product:
- `cowmoo/specs/PRODUCT.md` (product overview, roles, glossary, how it works)
- All files in `cowmoo/specs/domains/` (entities, features, workflows, validations per business area)

### 2. Write product summary

Read `references/techstack-notes-template.md`, then create `cowmoo/agent-files/planner/techstack-notes.md` using its structure. Fill in the Product Technical Summary immediately — summarize specs through a technical lens:
- Scale needs (users, data volume, concurrent operations)
- Integration requirements (third-party APIs, payments, auth providers)
- Data complexity (relationships, real-time needs, search requirements)
- User types and their technical demands
- Interactivity requirements (forms, dashboards, real-time updates)

This summary grounds the conversation. Every decision should reference it.

### 3. Lead the conversation

Ask **one question at a time**, multiple choice when possible. Don't overwhelm with 10 questions upfront.

**Key areas to cover:**

**Deployment & constraints:**
- Where will this be deployed? (VPS, serverless, container, PaaS)
- Budget constraints? (Hosting costs, paid services)
- Team experience — what technologies does the team know well?

**Architecture decisions:**
- Backend framework (connect to product requirements, not popularity)
- Database (relational vs document vs graph — match data model complexity)
- Auth approach (session-based, JWT, OAuth provider, third-party like Clerk/Auth0)

**Frontend approach** — before proposing options, Read `references/defaults-bias.md` for the complexity hierarchy and the reasoning behind it. Then discuss:
- What's the actual interactivity requirement?
- Does this need a SPA or would server-rendered pages work?
- If SPA is justified, which framework fits the team and product?

**Supporting tools:**
- Testing framework
- Styling approach (Tailwind, CSS modules, styled-components)
- ORM / database client
- Deployment tooling

### 4. Capture decisions as they happen

Write each decision to `cowmoo/agent-files/planner/techstack-notes.md` as it's confirmed. Format: what was decided, why, what alternatives were considered, and "Revisit if" — the condition under which this decision should be reconsidered.

This makes the notes useful for session resume — someone reading the file gets the full picture. The "Revisit if" prevents circular re-litigation while keeping the door open when constraints actually change.

### 5. Research when needed

If the conversation raises questions about specific technologies (version compatibility, feature support, performance characteristics), use @research to investigate. Research findings go to `cowmoo/agent-files/planner/research/{topic}.md`.

### 6. Propose with honest trade-offs

When presenting options, include at least 2 alternatives with real tradeoffs. For each alternative, think through pros (specific to this product, not generic), cons (specific to this product), and "best if" conditions that make this alternative the right pick. Lead with your recommendation, grounded in a specific product requirement from the summary.

Don't present generic pros/cons. Connect every tradeoff to the actual product requirements from the summary.

### 7. Finalize

When all decisions are made:
1. Read `references/techstack-template.md`, then write `cowmoo/stack/techstack.md` using its structure — clean, structured, permanent
2. **Self-verify the write.** Re-read `cowmoo/stack/techstack.md` and confirm every decision from `cowmoo/agent-files/planner/techstack-notes.md` is present. If anything is missing or corrupted, re-write before proceeding — do NOT delete the notes yet.
3. After verification passes, delete `cowmoo/agent-files/planner/techstack-notes.md` via `node tools/dev-tools.cjs clear-techstack-notes` (allowed through the `Bash(node tools/*)` allow-list; plain `rm` is not permitted). This ensures session detection correctly hits "already decided" next time.
4. Suggest running `/publish` to commit, then `/start` to begin planning

## Technology Evaluation Criteria

Rate each option honestly against these:

| Criteria | Questions |
|----------|-----------|
| Simplicity | How much code? How many concepts? |
| Fit | Does it match actual requirements? Overkill? |
| LLM Efficiency | Less code = easier to read, understand, and modify correctly |
| Team Fit | Does the team know it? Can they maintain it? |
| Ecosystem | Libraries for what we need? |
| Longevity | Maintained? Active community? |

## Conversation Style

- Be direct. If a user's preference doesn't match the product requirements, say so with reasoning.
- Don't be sycophantic. "That's a great choice" is only appropriate when it genuinely is.
- If the user wants React for a CRUD admin panel, push back — explain why simpler options might serve them better. Accept their decision if they insist, but make the case.
- Propose and recommend, don't just list options and wait.

## References

- `references/defaults-bias.md` — frontend complexity hierarchy (read during Step 3 frontend discussion)
- `references/techstack-notes-template.md` — working notes structure
- `references/techstack-template.md` — final output structure
