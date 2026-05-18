# PM Audit Decisions

Findings that prior audits raised, the curator evaluated, and decided were NOT bugs. `/audit-agent` reads this first and skips these during future scans. Each entry: title, verdict, one-line why (≤3 lines).

---

## Byte-identical project-init block duplicated in /import and /import-design

**Verdict:** Not a bug — the explicit "must be byte-identical between them" warning is accepted as sufficient mitigation.
**Why:** User decided the 28 lines of rarely-edited placeholder text don't justify extracting a shared source; the in-skill warning stands as the drift guard.
