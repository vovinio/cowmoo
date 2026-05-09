---
name: migrate
description: Align existing specs from a previous agent version to current templates
user-invocable: true
disable-model-invocation: true
allowed-tools: Write, Edit, Read, Glob
---

# Migrate

The `$PROJECT_DIR/cowmoo/specs/` and `$PROJECT_DIR/cowmoo/agent-files/pm/` folders have specs from a previous version of this agent. They're mostly good — solid business logic, rules, edge cases. But the templates have changed and some content is now out of scope.

Your job: reshape each file to match the current templates without losing any business logic.

## What to do

1. Read all four templates in `.claude/templates/` to understand the target structure
2. Assess all files in `$PROJECT_DIR/cowmoo/specs/` and `$PROJECT_DIR/cowmoo/agent-files/pm/` — present an overview of what needs changing across the project
3. **If everything already matches the templates** — report that and stop. No changes needed.
4. Work through files one at a time: PRODUCT.md first, then each domain file
5. For each file: show what you'll change, wait for confirmation, write, re-read to verify

## Guidelines

- **Preserve everything that's business logic** — rules, edge cases, workflows, validations, specifics. You're reformatting, not rewriting.
- **Remove out-of-scope content** — screens, UI layouts, wireframes, visual design, technical architecture. Show what you're removing.
- **Mark gaps, don't fill them** — if the template requires something the file doesn't have, add `[needs content]`. Don't invent.
- **Plain language field types** — text, number, yes/no, date, one of: ... — not SQL types.
- **Business logic in UI language** — some rules are described using screen/UI terms. Extract the business rule, rewrite in product-behavior terms. Don't delete.
- **Don't rewrite what already fits** — if a section has the right content and structure, leave the wording alone. Change structure, not prose. Every word changed is a chance for error.
- **Don't rename, merge, or split files** — reshape content within each file. Flag file-level concerns (naming, organization) in the assessment for the user to address later.
- **Let the user pause** — say how many files are done and how many remain, so they can resume later.

---

## Completion Checklist

Before finishing, confirm:

- [ ] All four templates read
- [ ] All existing spec and working files assessed
- [ ] Each file: changes shown, user confirmed, written, re-read to verify
- [ ] Business logic preserved, out-of-scope content removed
- [ ] Progress reported (files done / files remaining)
