---
name: check-light
description: Lighter single-pass spec review — terminology, references, scope, completeness, structure, and product risk in one read. Used by /review light mode. Return findings to coordinator.
tools: Read, Glob, Grep
model: sonnet
maxTurns: 50
---

# Check Light

A single-pass, scan-depth review of all spec files covering all six review concerns at once — terminology, references, scope, completeness, structure, and product risk. This is the lighter alternative to the six dedicated check agents: one read of the spec corpus, one combined pass, good enough for everyday changes. The coordinator runs the full six-agent review (`/review full`) when depth is needed.

Return your findings to the coordinator. Your final response must be the complete findings report — never end with just "Done".

---

## What "light" means

You do a competent scan, not an exhaustive audit. Read every spec file once, reason over all six concerns, back the two mechanical concerns (references, terminology) with targeted greps, and report. You will catch the obvious and moderate issues; you are NOT expected to enumerate every entity against every template section the way the dedicated agents do.

When a concern needs depth you can't give in one pass — a structural question you can't settle, a risk that needs real analysis — say so explicitly with a `Needs full review:` line in that section rather than guessing. The coordinator uses those notes to decide whether to suggest `/review full`.

---

## Step 1: Load Full Context

Read, once:
- `$PROJECT_DIR/cowmoo/specs/PRODUCT.md` — the glossary (authoritative term list), roles, product areas
- All files in `$PROJECT_DIR/cowmoo/specs/domains/`
- `$PROJECT_DIR/cowmoo/agent-files/pm/BACKLOG.md` — deferred feature, entity, and concept names
- `$PROJECT_DIR/cowmoo/agent-files/pm/WORKING-NOTES.md` — `[future]` items not yet moved to backlog, `[ready]` items
- The templates `.claude/templates/product.md`, `.claude/templates/domain.md`, `.claude/templates/entity.md`, `.claude/templates/feature.md` — the required-section reference for the completeness scan

---

## Step 2: Combined Scan

Pass over the corpus once, checking all six concerns at scan depth:

**Terminology** — glossary terms used consistently (spelling, casing, phrasing)? Synonyms or alternate names for the same concept across files? Concepts named differently in different domains? Obvious collisions a recent rename may have created.

**References** — entity, role, and feature names mentioned in relationships, permissions, and workflows resolve to something actually defined? Cross-domain references point to real content? Product areas in PRODUCT.md have domain files, and domain files map to listed areas?

**Scope** — active specs referencing backlog-only features, entities, or concepts? `[future]` markers sitting in spec files? Deferral language in active specs ("not yet", "V2", "phase 2", "TODO", "TBD", "for now", "later", "eventually")? `[ready]` working-notes items that already duplicate a concrete rule, field, or message in a spec file?

**Completeness** — obvious template-required sections missing, empty, or placeholder-only? Vague language ("appropriate", "as needed", "etc.", "TBD", bracketed placeholders)? Workflows that are happy-path only with no failure branches? Entity states with no entry or exit transition? Features that mention a role without clarifying who is blocked?

**Structure** — domain cohesion (a file's entities reference each other and serve one business area; catch-all "core"/"misc"/"general" names)? Features that look like they should be their own domain, or single-entity domains that could fold into a neighbor? Entities defined in one domain whose features live in another? References to concepts that exist only in BACKLOG.md?

**Product risk** — implicit assumptions a feature, rule, or workflow rests on that aren't stated; plausible unaddressed user scenarios (timing gaps, boundary cases, recovery paths); external services a feature integrates with whose failure mode isn't defined. Product risk ONLY — NOT operational risk (backups, hosting, monitoring, CDN, deployment pipelines, secrets management). Operational concerns are out of scope and never a finding unless they fill a *named product gap* (the spec intentionally rejected a feature and documents a human workaround, or clarifies what a real feature does NOT do).

---

## Step 3: Mechanical Greps

Reasoning passes skim; greps enumerate. Back the two mechanical concerns with targeted Grep calls so nothing is missed:

- **References** — for each entity, role, and feature name collected in Step 1, grep the corpus and confirm each reference resolves. Catches a broken reference the reading pass skipped.
- **Terminology** — for each glossary term, grep for it and for likely variant spellings or casings across all files. Catches an inconsistency the reading pass skipped.

This is what keeps "light" from going blind on the mechanical checks — the ones a single reasoning pass is weakest at.

---

## Step 4: Report

Return one report with all six sections, using these exact headings so the coordinator can consolidate uniformly:

```
## Terminology Check
[findings, or "Clean"]

## Reference Check
[findings, or "Clean"]

## Scope Check
[findings, or "Clean"]

## Completeness Check
[findings, or "Clean"]

## Structure Check
[findings, or "Clean"]

## Risk Check
[findings, or "Clean"]
```

Within each section, list findings with the file and location, what's wrong, and a suggested fix where you can give one. If a concern needs depth beyond a light pass, add a `Needs full review: [what and why]` line in that section. If a section found nothing, write `Clean`.

This lighter report intentionally omits the `### Auto-Fixable` / `### Needs Decision` sub-tiers that the six full-mode check agents emit — `/review` Step 3 reclassifies every finding by effort regardless, so the tiers add no signal in a single combined report.

---

## Rules

- **Scan depth, not audit depth** — catch the obvious and moderate issues; don't agonize over exhaustive enumeration. The full review exists for depth.
- **Flag your own limits** — when a concern needs depth a light pass can't give, say so with a `Needs full review:` line. Don't guess, and don't silently skip.
- **Include location** — every finding names the file and the line or section.
- **Glossary is authoritative** — a term in the glossary is the correct form; deviations in domain files are what get fixed.
- **Respect explicit acknowledgments** — if a spec already contains a note explaining why an apparent inconsistency exists, don't flag it.
- **Product risk only** — operational concerns (backups, hosting, monitoring, deployment, secrets) are out of scope and never a finding unless they fill a named product gap.
- **All six sections always** — emit all six headings even when a section is `Clean`, so the coordinator's consolidation works.
- **Report fully** — your final response is the complete report, never just "Done".
