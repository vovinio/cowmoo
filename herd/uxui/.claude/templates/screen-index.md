# Screen Index Template

Structure for `cowmoo/design/screen-index.md`. Master list of every screen in the product, organized by domain, with 1-line descriptions and cross-references to the domain file where each screen is fully defined.

This is a reference index — readers scan it to find where a screen lives. Full definitions (layout, components, states, interactions, flows) are in `cowmoo/design/domains/*.md`, not here.

Companion to `cowmoo/design/OVERVIEW.md` (design intent + navigation), `cowmoo/design/journeys.md` (cross-domain arcs), and `cowmoo/design/domains/*.md` (per-domain screen definitions).

---

## Template

```markdown
# Screen Index

Master list of all screens in the product, organized by domain. Full screen definitions live in `cowmoo/design/domains/*.md` — this file is just the index.

Companion to `cowmoo/design/OVERVIEW.md`, `cowmoo/design/journeys.md`, `cowmoo/design/roles.md`, and `cowmoo/design/domains/*.md`.

---

## [Domain Name — e.g. Orders]

See `cowmoo/design/domains/orders.md` for full screen definitions.

| Screen | Type | Purpose |
|--------|------|---------|
| `orders-list` | list | Browse all orders with filtering and sorting |
| `order-detail` | detail | View a single order's full information |
| `order-create` | form | Create a new order |
| `order-edit` | form | Modify an existing order |

---

## [Domain Name — e.g. Billing]

See `cowmoo/design/domains/billing.md` for full screen definitions.

| Screen | Type | Purpose |
|--------|------|---------|
| `invoices-list` | list | Browse invoices with status filtering |
| `invoice-detail` | detail | View invoice line items and payment status |
| `checkout` | form | Process payment for an invoice |

---

## Cross-Cutting Screens

Screens that don't belong to a single domain — dashboards, settings, onboarding flows. See their dedicated domain files for definitions.

See `cowmoo/design/domains/dashboard.md`, `cowmoo/design/domains/settings.md`, etc.

| Screen | Type | Purpose | File |
|--------|------|---------|------|
| `main-dashboard` | dashboard | Primary post-login landing surface | `cowmoo/design/domains/dashboard.md` |
| `account-settings` | settings | User account preferences and profile | `cowmoo/design/domains/settings.md` |
| `onboarding-welcome` | onboarding | First-time user entry experience | `cowmoo/design/domains/onboarding.md` |
```

---

## Rules

- **One entry per screen.** Every screen defined in any `cowmoo/design/domains/*.md` file appears here exactly once.
- **1-line description.** "Browse all orders with filtering and sorting" — not a full purpose statement, not a detailed layout. Just enough for a reader to know what the screen is.
- **Organized by domain.** Mirrors `cowmoo/design/domains/*.md` structure. Cross-cutting screens (dashboard, settings, onboarding) get their own section pointing to the appropriate domain file.
- **Screen type is required.** `list`, `detail`, `form`, `dashboard`, `settings`, `onboarding`, `modal`, `wizard` — pick the most accurate category. Helps readers scan.
- **Cross-reference only, never define.** Full screen definitions with layout, components, states, interactions, and flows live in the domain files. This file is an index.
- **Updated as screens are added.** Every new screen defined in a domain file gets an entry here. `/define` handles this when it writes or updates domain files.
- **Deleted when screens are removed.** If a screen is removed from a domain file, its entry here goes too. Drift between index and domains is a review finding.
- **Stays scannable.** Reader can find any screen in under 30 seconds by scanning domain sections. If this file grows so long it's slow to scan, the product may need finer domain boundaries — surface as discussion, don't split the index arbitrarily.
