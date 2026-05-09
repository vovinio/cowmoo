# Domain File Specification

Structure for domain files in `cowmoo/specs/domains/`. Each file groups related entities and features for one business area.

---

## Domain Template

```markdown
# [Domain Name] Domain

[Brief description of what business area this domain covers (1-3 sentences)]

---

## Entities

### [Entity Name]
(follows entity template)

---

## Features

### [Feature Name]
(follows feature template)

---

## Reference Data (omit if not applicable)

### [Reference Name]
[Structured reference content that entities or features in this domain depend on]
```

---

## Field Definitions

### Domain Name

Named after the business area, not technical components.
- **Good:** "User Management", "Billing", "Order Fulfillment"
- **Bad:** "Database", "API", "Auth Service"

### File Naming

Kebab-case: `user-management.md`, `billing.md`, `order-fulfillment.md`.

### Section Order

Entities → Features → Reference Data (if applicable). Features reference entities, so entities must be defined first.

Within each section, order by dependency: parents before children, core operations before complex workflows.

### Reference Data

Structured reference material that entities or features in this domain depend on, but that isn't itself an entity or a feature. Include only if the domain has it — most won't.

Reference Data goes after Features. No fixed internal format — structure it however makes the content clearest.

### Where Things Belong

- An **entity** belongs where it is primarily created and managed
- A **feature** belongs in the domain of its primary entity
- **Cross-domain references** use the entity name as defined in the source domain — don't redefine it

---

## Checklist

Before finalizing:
- [ ] Domain name reflects a business area, not a technical component
- [ ] Description explains the scope concisely (1-3 sentences)
- [ ] All entities appear before all features
- [ ] Entities ordered by dependency (parents before children)
- [ ] Every entity follows the entity template
- [ ] Every feature follows the feature template
- [ ] Cross-domain references use exact names from their source domain
- [ ] No entity is defined in multiple domain files
