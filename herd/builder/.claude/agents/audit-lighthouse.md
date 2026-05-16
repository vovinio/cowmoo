---
name: audit-lighthouse
description: Run Lighthouse audit on dev server pages for accessibility, performance, and best practices. Use during /review for frontend tasks. Requires Chrome DevTools MCP enabled.
tools: mcp__chrome-devtools__lighthouse_audit, mcp__chrome-devtools__navigate_page, mcp__chrome-devtools__take_snapshot, mcp__chrome-devtools__take_screenshot, Read, Bash
model: sonnet
maxTurns: 10
---

# Lighthouse Audit

Run Lighthouse audits against the pages this task touches. Report accessibility, performance, and best practices scores.

## Environment

- `$PROJECT_DIR` — absolute path to the project root.

## Prerequisite: Chrome DevTools MCP Enabled

Lighthouse auditing requires Chrome DevTools MCP. It's opt-in at the project level because the 29 tools consume meaningful context when loaded.

**Check at start:** Try calling `lighthouse_audit`. If the tool is not available (error or not found):

Report:
```
## Lighthouse Audit

**Result:** SKIP — Chrome DevTools MCP is not enabled at the project level.
Ask the user to enable it via the project's setup tooling, then re-run /review.
```

Stop — do not attempt a fallback. The builder's `/review` will continue with other findings.

## Input

The builder provides:
- Dev server URL
- List of pages/routes affected by the task (from PRD acceptance criteria)

## Process

### 1. Detect Dev Server

If no URL was provided:
```bash
node "$AGENT_DIR/tools/dev-tools.cjs" detect-dev-servers
```

If no server detected → report SKIP.

### 2. Audit Each Page

For each affected route (max 3 to limit cost):

1. Navigate: `navigate_page` to the URL
2. Run: `lighthouse_audit` with mode `navigation`, device `desktop`
3. Record scores: accessibility, performance, best practices, SEO

### 3. Collect Findings

For each audit result, extract:
- **Accessibility issues** — contrast violations, missing labels, ARIA problems
- **Performance concerns** — LCP, CLS, FID above thresholds
- **Best practices** — console errors, deprecated APIs, insecure resources

## Output

```
## Lighthouse Audit

| Page | Accessibility | Performance | Best Practices | SEO |
|------|-------------|-------------|----------------|-----|
| /invoices | 92 | 78 | 100 | 90 |
| /invoices/new | 68 | 82 | 100 | 85 |

**Accessibility issues:**
- /invoices/new: Contrast ratio 2.9:1 on `.muted-label` (WCAG AA requires 4.5:1)
- /invoices/new: Form input missing associated label (#amount-field)

**Performance notes:**
- /invoices: LCP 4.2s (threshold: 2.5s)

**Result:** [N pages audited | SKIP — reason]
```

## Rules

- **Report observations only** — do NOT fix code, do NOT prescribe fixes. State what was found, not what to do about it.
- **SKIP for environment issues** — dev server not running, Chrome DevTools MCP not configured, slim mode active.
- **Max 3 pages per audit** — keep MCP token cost manageable.
- **Focus on accessibility** — most actionable for the builder. Performance and best practices are secondary.
- **Report partial results** — if one page times out, report the others.
