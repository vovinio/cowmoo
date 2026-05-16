---
name: copywrite
description: Review and improve all user-facing text — terminology, messages, labels, descriptions — informed by domain research
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob, Agent, Bash
---

# Copywrite

Review all user-facing text in the specs and improve it — informed by how this domain actually talks. Use @research throughout to ground proposals in real industry patterns, not opinion.

## Step 0: Check Project Exists

Run `node "$AGENT_DIR/tools/dev-tools.cjs" check-files` and read the `working-notes:` line.

- **If `working-notes: not found`** — tell the user: "No project initialized. Run /start to begin." and stop.

## What to do

1. Read `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` (glossary, roles, product areas) and `$PROJECT_DIR/cowmoo/agent-files/pm/RESEARCH.md` for existing domain context
2. If no domain terminology research exists yet, use @research: how does this industry name things? What terms do users expect? How do competitors communicate similar concepts?
3. Read all domain files in `$PROJECT_DIR/cowmoo/specs/domains/`
4. Work through one file at a time — audit all user-facing text, propose improvements, get confirmation before writing
5. Use @research anytime during the audit when a term, pattern, or messaging decision would benefit from real-world context — don't guess when you can look

## What to review

- **Glossary terms** — are definitions precise? Do they match industry conventions?
- **Error messages** — do they tell users what to do, not just what's wrong?
- **Status and state names** — are they what users in this domain expect?
- **Descriptions** — "What it is" on entities, user stories on features — clear to someone with zero context?
- **Edge case messages** — warnings, confirmations, info notes users see
- **Field labels and option names** — are they self-explanatory in this domain?

## Guidelines

- **Research-informed, not opinion-based** — when proposing a change, cite what the industry uses or explain why it's better for the user. No "I think this sounds better."
- **Flag UX impact** — distinguish between cosmetic changes (clearer phrasing, same meaning) and semantic changes (different term, different mental model). Semantic changes need explicit user approval.
- **User's glossary is authoritative** — if the user chose a term that differs from industry standard, flag it as a decision point. Don't auto-fix. They may have a reason.
- **Don't touch business logic** — you're improving how things are communicated, not what the rules are.
- **Consistency across files** — same tone, same message patterns, same level of helpfulness everywhere.
- **Self-verify every edit** — write, re-read, verify. Same as all other skills.
- **Let the user pause** — say how many files are done and how many remain, so they can resume later.

---

## Completion Checklist

Before finishing, confirm:

- [ ] PRODUCT.md and RESEARCH.md read for context
- [ ] Domain research completed via @research (if needed)
- [ ] Each file audited: user-facing text reviewed, improvements proposed
- [ ] User confirmed changes before writing
- [ ] Every edit self-verified (write → re-read → verify)
- [ ] Progress reported (files done / files remaining)
