---
description: Structured debugging methodology — investigate root cause before fixing. Always loaded.
---

When something breaks during implementation, follow this sequence. Don't guess at fixes.

**1. Investigate first.** Read the full error message. Reproduce the failure. Trace backward through the call chain to find the original trigger — the bug is at the source, not the symptom. Check each component boundary for where the data goes wrong.

**2. Pattern check.** Is this a known issue? Check BUILD-NOTES.md for prior gotchas. Check recent git changes — did a sibling task change something you depend on? Check sibling Records for relevant context.

**3. Hypothesis & test.** Form an explicit theory: "I think X is happening because Y." Test it with a minimal, targeted change. Verify the fix addresses root cause — if the error moves but doesn't disappear, you fixed a symptom.

**4. Escalate.** Three failed fixes on the same bug means the approach is wrong, not the fix. Step back and question the architecture. If fundamental — discuss with user, `/return` if unresolvable.
