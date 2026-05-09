# Feature Specification

Structure for defining features in domain files. Follow this exactly.

---

## Feature Template

```markdown
### [Feature Name]

**User story:** As a [role], I can [action] so that [benefit]

**Workflow:**
1. User [action]
2. System [response]
3. ...

**Validations:**
- [Field/condition]: [Rule] → Error: "[exact message]"

**Edge cases:**
- [Scenario]? → [What user sees/experiences]

**Permissions:** [Who can do this]

**Acceptance criteria:**
- Given [state], When [action], Then [result]
```

---

## Field Definitions

### User Story

**Format:** `As a [role], I can [action] so that [benefit]`

- **Role:** Actual role name from PRODUCT.md — never generic "user"
- **Action:** Specific verb + object describing what they do
- **Benefit:** The real outcome for the user, not a restatement of the action

### Workflow

Step-by-step sequence alternating between user and system:

- **User steps:** What the user does (clicks, enters, selects)
- **System steps:** What the user sees in response (feedback, navigation, updates)

Every workflow must include:
- What triggers it (first user action)
- What feedback the user sees at each step
- Where the user ends up when complete

### Validations

Every input constraint with its exact error message.

**Format:** `[What]: [Rule] → Error: "[message]"`

- **What:** Field name or condition being validated
- **Rule:** The specific constraint (required, format, range, uniqueness, business rule)
- **Message:** Exact text shown to user — specific and helpful, not generic

### Edge Cases

Unusual situations the user might encounter. Focus on user experience:

**Empty/missing data:** What if there's nothing to show? What if related data doesn't exist?

**Invalid input:** What does the user see when they enter wrong data? How do they recover?

**Permissions:** What does the user see if they can't do this action? What if they try to access someone else's data?

**Abandoned actions:** What if the user stops midway? What if they come back later?

**Business rule violations:** What if the action isn't allowed in current state? What message explains why?

**Format:** `[Scenario]? → [What user sees/experiences]`

Every edge case must describe the user's experience — what they see and how they can proceed.

### Permissions

Who can perform this action. Reference roles from PRODUCT.md.

If different roles have different access:
- [Role]: [What they can do]

If not all roles have access, state who is excluded and what they experience when they try (error message, hidden UI, redirect).

### Acceptance Criteria

Testable statements covering success and failure scenarios.

**Format:** `Given [state], When [action], Then [result]`

- **Given:** Starting state or precondition
- **When:** The action taken
- **Then:** What the user sees or experiences

**Must cover:**
1. Happy path (normal success)
2. Key validation rules — especially those with non-obvious behavior (confirmations, side effects, cascading changes)
3. Permission denied (what user sees when not allowed)
4. Key edge cases (what user experiences in unusual situations)

**Convention:** Standard validation errors (required field, format, range) are covered by the Validations section and don't need individual AC lines. Only validations with non-obvious behavior need explicit AC.

**Cross-Domain References:** (omit if none)
- [Entity/Feature] in [domain] — [one-line context]

---

## Checklist

Before finalizing:
- [ ] User story has specific role, action, and benefit
- [ ] Workflow shows user actions and system feedback
- [ ] Every validation has exact error message
- [ ] Edge cases describe user experience, not technical behavior
- [ ] Permissions reference roles from PRODUCT.md
- [ ] Acceptance criteria cover: success, validation errors, permission denied
- [ ] Cross-domain connections documented (or section omitted if none)
