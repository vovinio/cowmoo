## Frontend Gotchas

- Match design density to use case. Admin panels need tight spacing and data density. Marketing pages need whitespace. Don't apply same patterns everywhere.
- Every data-fetching component must handle 5 states: loading, error, empty, success, partial. `{data && <List />}` without handling loading/error/empty is always a bug.
- Every interactive element needs visible focus styles. `outline: none` without replacement breaks keyboard navigation.
- Use semantic HTML: `<button>` not `<div onclick>`, `<form>` not `<div class="form">`. Fixes accessibility, keyboard nav, and screen readers in one move.
- Every user action needs feedback: loading indicator on submit, success confirmation, specific error messages. Bare `<button>Save</button>` with no loading/success state is incomplete.
- Forms: labels on every input, inline validation near the field, Enter key submits, disabled submit while processing.
- Clickable elements need `cursor: pointer`. Cards, list rows, or custom-styled tiles that respond to click must show the pointer — a default arrow on a hoverable element reads as broken.
- Hover states must not shift layout. Use color, opacity, shadow, or border transitions — not `scale()` or size transforms on elements that share a row or grid with others. Layout jitter on hover is a common polish bug.
- Transparent/glass surfaces need higher opacity in light mode than dark. `bg-white/10` is invisible on a light page — use `bg-white/80` or higher and check contrast in both themes before shipping.
- Floating/fixed navbars need edge spacing, not flush-to-edge. `top-4 left-4 right-4` (or equivalent) makes the bar visually float; `top-0 left-0 right-0` looks like an unfinished modal.
