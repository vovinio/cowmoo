---
name: tech-stack
description: Analyze specs and decide tech stack through conversation. Use when starting a new project or when user says /tech-stack.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Agent, Glob, Grep, Bash, AskUserQuestion
---

# Tech Stack Selection

Guide the user through choosing the right technology stack for their project. This is a high-impact decision — take time to understand the product before proposing anything.

The skill's job is **leading a structured conversation**: read the specs, ask the right questions in the right order, propose concrete options with product-specific tradeoffs, capture decisions as they happen, and write a clean final file. Don't push defaults. Don't rank stacks by complexity. Pick from the spec.

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

Ask **one question at a time**. Lead with concrete options — name real choices, not abstract categories — and explain tradeoffs in terms of the product summary from Step 2. Use the `AskUserQuestion` picker when there are 2-4 genuine alternatives.

**Order matters.** Each upstream choice constrains the next — don't ask "what auth?" before settling "BaaS or DIY?", because BaaS often answers auth automatically. Walk the questions in this sequence:

1. **Runtime shape** — where will this run?
   Static hosting / edge runtime / serverless functions / long-running container / VPS / self-hosted.
   This is upstream of everything: edge runtimes constrain ORM and runtime APIs; static-only means no backend; long-running containers unlock things serverless can't do (WebSockets, background jobs, large file processing).

2. **Backend approach** — DIY or BaaS?
   - **DIY**: pick a framework + DB + auth separately and deploy your own service.
   - **BaaS** (e.g. Supabase, Convex, Firebase): one platform bundles auth + DB + storage + realtime. This often dominates the next 2-3 decisions.
   - **Headless CMS** for content-heavy products.
   Match to product needs — BaaS shortens time-to-ship at the cost of vendor coupling; DIY is more work but portable.

3. **Database** *(skip if BaaS owns it)*
   Relational vs document vs graph vs key-value — match the data model from the spec, not popularity.

4. **Auth** *(skip if BaaS or framework-bundled covers it)*
   Managed service / framework-bundled / self-managed.

5. **Frontend approach**
   Static-rendered / SSR or RSC / SPA / server-rendered from the backend.
   Drive the choice from interactivity requirements and SEO needs in the spec, not from "simpler is better."

6. **Supporting tools**
   Testing framework, styling, ORM (if DIY backend), validation library, deployment tooling.

For each decision, propose 2-3 specific options with product-specific tradeoffs (not generic pros/cons). Lead with your recommendation grounded in a spec requirement. Don't list options and wait — recommend, then accept or adjust based on the user's reaction.

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
| Fit | Does it match the actual requirements from the spec? Overkill or under-spec'd? |
| Ecosystem | Libraries available for what the product needs? |
| Longevity | Actively maintained? Community traction? |
| Coupling | If we pick this, what else does it lock us into? |

## Conversation Style

- Be direct. If a user's preference doesn't match the product requirements, say so with reasoning.
- Don't be sycophantic. "That's a great choice" is only appropriate when it genuinely is.
- Propose and recommend, don't just list options and wait.

## References

- `references/techstack-notes-template.md` — working notes structure
- `references/techstack-template.md` — final output structure
