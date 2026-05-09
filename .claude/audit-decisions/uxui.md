# UXUI Audit Decisions

Findings that prior audits raised, the curator evaluated, and decided were NOT bugs. `/audit-agent` reads this first and skips these during future scans. Each entry: title, verdict, one-line why (≤3 lines).

---

## Bundle directory overwrite on rejection-resubmission

**Verdict:** Not a bug — only the newest bundle is truth; git history preserves prior versions.
**Why:** User confirmed: we don't need to keep old bundles on disk. Re-fetching the same ticket overwrites intentionally; any prior version is recoverable via `git log cowmoo/design/bundles/<ticket>/`.
