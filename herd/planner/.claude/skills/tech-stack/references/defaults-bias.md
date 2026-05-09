# Avoid Defaults Bias — Frontend Hierarchy

LLMs are biased toward popular frameworks (React, Next.js) due to training data. **This doesn't mean they're the right choice.** Actively consider simpler alternatives first.

## Frontend — Consider in this order

1. Server-rendered HTML (Django, Rails, Laravel, Go templates) — simplest, fastest
2. HTMX + server-rendered — interactivity without JS framework complexity
3. Alpine.js — lightweight JS for simple interactions
4. Vanilla JS — often enough for admin panels
5. Vue/Svelte — simpler than React, less boilerplate
6. React/Next.js — only when complexity is justified

## Why simpler is often better for LLM-built projects

- Less code = less to read, understand, and maintain
- Fewer abstractions = fewer places for bugs
- Server-rendered = state lives in one place
- HTMX = HTML attributes instead of JS code

## Ask yourself

- Does this NEED client-side state management?
- Does this NEED a SPA? Or would page refreshes be fine?
- Is the team more productive with [simpler option]?
- What's the actual interactivity requirement?
