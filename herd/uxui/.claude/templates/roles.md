# Role Vocabulary Template

Structure for `cowmoo/design/roles.md`. The abstract vocabulary that every domain file references when describing screens. Names only, with short descriptions of meaning and usage — no token values, no hex codes, no pixel numbers.

Companion to `cowmoo/design/OVERVIEW.md` (design intent) and `cowmoo/design/domains/*.md` (screens that reference these roles). Concrete token values live in `src/` (after builder implements) or `cowmoo/agent-files/builder/BUILD-NOTES.md` (builder's accumulated token rules) — never here.

---

## Why role vocabulary, not token values

UXUI describes screens in terms of *roles* — "primary action button", "muted secondary text", "tight spacing". The same role name stays stable across every domain file regardless of what specific color or pixel value it resolves to. When builder implements, framework defaults or established `src/` patterns supply the concrete values.

This lets UXUI do its structural work (what screens need, how they're organized) without making speculative aesthetic decisions that belong to real rendered UI.

---

## Template

```markdown
# Role Vocabulary

Abstract role names that `cowmoo/design/domains/*.md` files reference. Names + meanings, no values.

Concrete values are resolved by:
- `src/` (after builder implements) — code source of truth
- `cowmoo/agent-files/builder/BUILD-NOTES.md` — builder's accumulated token rules across tasks

When a domain file introduces a new role, add it to this file first, then reference it from the domain file.

---

## Interaction Roles

| Role | Meaning | Typical usage |
|------|---------|---------------|
| `primary-action` | The most important action on a screen | Save, Submit, Continue, main CTAs |
| `secondary-action` | Supporting actions alongside primary | Cancel, Back, Skip, Settings |
| `destructive-action` | Actions that remove, delete, or cannot be undone | Delete, Remove, Discard, Cancel subscription |
| `tertiary-action` | Low-emphasis supporting actions | Help, More options, Close side panel |

Add new interaction roles only when domain files genuinely need them. Don't pre-populate speculative roles.

---

## Text Roles

| Role | Meaning | Typical usage |
|------|---------|---------------|
| `text-body` | Main reading text | Paragraphs, descriptions, form field values |
| `text-heading` | Section or screen titles | Page titles, section headers |
| `text-muted` | Secondary copy, supporting context | Timestamps, helper text, field labels, metadata |
| `text-emphasis` | Inline highlighted text | Bolded keywords, status indicators |
| `text-error` | Error messages and validation feedback | Form field errors, inline warnings |

---

## Spacing Roles

| Role | Meaning | Typical usage |
|------|---------|---------------|
| `space-tight` | Minimal gap between related elements | List item padding, form field internals |
| `space-default` | Standard gap between adjacent components | Card padding, form field gaps |
| `space-loose` | Generous gap between distinct sections | Section dividers, page regions |

---

## Surface Roles

| Role | Meaning | Typical usage |
|------|---------|---------------|
| `surface-base` | Default page background | App canvas |
| `surface-raised` | Elevated card or panel | Cards, sidebars, modals |
| `surface-overlay` | Full-screen temporary surface | Modals, drawers, sheets |

---

## Status Roles

| Role | Meaning | Typical usage |
|------|---------|---------------|
| `status-success` | Positive state feedback | Success toasts, completion indicators |
| `status-warning` | Cautionary state feedback | Warning banners, pending states |
| `status-error` | Error or destructive state | Error messages, failed states |
| `status-info` | Neutral informational state | Informational banners, tooltips |

---

## Product-Specific Roles

[Any roles unique to this product that don't fit the standard categories above. Example: a dashboard product may define `metric-positive` and `metric-negative` for trend indicators, or an editor may define `canvas-primary` vs `canvas-secondary` for workspace surfaces.]

Add with reasoning — what makes this role unique to the product, why it doesn't fit an existing role.
```

---

## Rules

- **Names only, no values.** This file never contains hex codes, pixel values, or font sizes. Those are resolved downstream by builder.
- **Stable names across domains.** If `domains/orders.md` uses `primary-action` and `domains/billing.md` also needs a primary action, they use the same role name. Consistency from shared vocabulary.
- **Add roles when domain files need them, not speculatively.** Starting with a tight set of roles and growing as needed beats pre-populating every possible role. Unused roles are cruft.
- **Unused roles are pruned through `/review`, not `/define`.** `/define` is additive-only — it preserves existing roles. `/review` surfaces unused roles as a warning; the user approves deletion as a quick-fix during that flow. Don't delete roles inline while writing domain content.
- **Descriptions are concrete.** "Typical usage" should name real UI elements (Save button, timestamp text, card padding), not abstract categories ("emphasis", "decoration").
- **Reference this file from domain files.** Domain files use role names like `primary-action`, `text-muted`, `space-tight`; they never invent new token vocabulary inline.
- **When in doubt, don't add.** If you're unsure whether a new role is needed, see if an existing role can cover it first. The vocabulary stays tight on purpose.
