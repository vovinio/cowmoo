# Entity Specification

Structure for defining entities in domain files. Uses business language only — no SQL or technical types.

---

## Entity Template

```markdown
### [Entity Name]

**What it is:** [One sentence description]

**Relationships:**
- Belongs to: [Parent] ([required/optional], [delete behavior])
- Has many: [Children] ([delete behavior])
- Has one: [Related] ([required/optional])

**Fields:**
- [Name] — [required/optional], [type], [constraints]

**Rules:**
- [Business rule]

**States:** (omit entirely if entity is truly stateless)

If explicit status field:
- [state] → [state]: [trigger], [requirements]

If derived from other fields:
- [state name]: [how it's determined]
```

---

## Field Definitions

### What It Is

One sentence defining this entity in business terms.

- What it represents in the real world
- Not what it contains or does

### Relationships

How this entity connects to others:

**Belongs to:** This entity is owned by another
- Format: `Belongs to: [Parent] ([required/optional], [what happens when parent deleted])`
- Required means entity cannot exist without parent
- Delete behavior: "deleted with parent" or "blocked if has children" or "nullified"

**Has many:** This entity contains multiple of another
- Format: `Has many: [Children] ([what happens when this entity deleted])`
- Usually "deleted with parent" for owned children

**Has one:** This entity has exactly one of another
- Format: `Has one: [Related] ([required/optional])`
- Optional means can exist without the related entity

**Many to many:** Both sides have many
- Note both directions of the relationship

Every relationship must specify:
1. Required or optional
2. What happens on delete

### Fields

Every piece of data on this entity:

**Format:** `[Name] — [required/optional], [type], [constraints]`

**Types** (plain language only):
- `text` / `text, [min]-[max] characters`
- `number` / `positive number` / `decimal (N places)`
- `yes/no`
- `date` / `time` / `date and time`
- `one of: [option1], [option2], [option3]`
- `list of [things]`
- `file` / `image`

**Constraints:**
- `unique` — no duplicates system-wide
- `unique per [parent]` — no duplicates within parent
- `default: [value]` — initial value
- `automatic` — system-generated, not user-editable
- `[min]-[max]` — range for numbers or length for text
- `valid [format]` — email, URL, phone, etc.
- `future date` / `past date` — temporal constraints

Never use: VARCHAR, INTEGER, BOOLEAN, TIMESTAMP, ENUM, BLOB, or any SQL types.

### Rules

Business logic beyond field validation:

- Uniqueness scopes ("unique within user's campaigns")
- Edit restrictions ("cannot edit while status is sending")
- Delete restrictions ("cannot delete while has active children")
- Computed values ("recipient count calculated from recipients")
- Cascade behaviors ("duplicating copies content but resets stats")
- Cross-field rules ("end date must be after start date")

Each rule should be one clear statement about behavior.

### States

Three cases:

**1. Explicit status field with transitions:**

```
[from state] → [to state]
  Trigger: [What causes this transition]
  Requires: [Conditions that must be true]
```

Document all valid transitions, triggers, requirements, invalid transitions, and final states.

**2. State derived from other fields:**

The entity has no status field, but goes through meaningful stages determined by other data. Explain how each state is determined — these aren't transitions, they're computed from current data.

Format: `[state name]: [how it's determined from fields]`

**3. Truly stateless:**

Omit the States section entirely. Don't write "N/A" — just leave it out.

### Cross-Domain References (omit if none)

- [Entity/Feature] in [domain] — [one-line context of the connection]

---

## Checklist

Before finalizing:
- [ ] "What it is" defines the business concept in one sentence
- [ ] All relationships specify required/optional and delete behavior
- [ ] All fields have: name, required/optional, type, constraints
- [ ] No SQL or technical types used
- [ ] Rules cover: uniqueness, edit restrictions, delete restrictions, computed values
- [ ] States: explicit transitions documented, OR derived states explained, OR section omitted if truly stateless
- [ ] Cross-domain connections documented (or section omitted if none)
