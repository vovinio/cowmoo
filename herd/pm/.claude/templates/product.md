# Product Specification

Structure for defining the product overview in PRODUCT.md. Follow this exactly.

---

## Template

```markdown
# [Product Name]

## Problem Statement

[What problem does this product solve? Why does it need to exist? One paragraph.]

## Target Users

### Primary User: [Role Name]

**Who they are:** [Description]

**Their pain points:**
- [Pain point 1]
- [Pain point 2]

**What success looks like:** [How their life improves]

### [Additional users as needed]

## Overview

[What this product is — one paragraph, plain language, no buzzwords]

## Glossary

- **[Term]** — [Definition]

## Roles

**[Role Name]**
- [What they can do]

## Product Areas

- **[Area Name]** — [What it covers]

## How It Works

[The core loop — how the pieces connect, what the main flow is]

## Key Behaviors

- [Product-wide rule or behavior]

## Key Constraints

- [Product-level non-functional requirement]
```

---

## Field Definitions

### Problem Statement

One paragraph explaining the pain point. Answer:
- What problem exists today?
- Why is it worth solving?

### Target Users

For each user type:
- **Who they are:** Role and context
- **Pain points:** What frustrates them today
- **Success:** How the product improves their life

### Overview

One paragraph describing what the product IS. Plain language. No enterprise buzzwords.

### Glossary

Domain-specific terms the user mentioned. Use their exact words.

### Roles

Each role that can use the system and what permissions/capabilities they have.

### Product Areas

Major sections or modules of the product. High-level grouping.

### How It Works

The core user journey. How do the pieces connect? What's the main loop?

### Key Behaviors

Product-wide rules that apply everywhere:
- Authentication requirements
- Data visibility rules
- Cross-cutting constraints

### Key Constraints

Product-level non-functional requirements — not features, but expectations the product must meet:
- Performance ("search returns within 2 seconds")
- Scale ("must support 10,000 concurrent users")
- Data retention ("data older than 90 days is archived")

Only include constraints the user has explicitly stated. Exclude technical choices (database, hosting, framework).

---

## Checklist

Before finalizing:
- [ ] Problem statement explains why this needs to exist
- [ ] Target users have specific pain points (not generic)
- [ ] Glossary uses user's exact terminology
- [ ] Roles match what's referenced in features
- [ ] Key behaviors are specific, not vague
- [ ] Key constraints are user-stated, not generic assumptions
