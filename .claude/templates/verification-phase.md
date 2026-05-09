# Verification Phase (Canonical Procedure)

This is the shared verification phase used by every curator detection skill. Detection casts a wide net; verification filters out false positives and weak fix proposals so surviving findings are trustworthy. See Pattern 23 in `docs/PATTERN-CATALOG.md` for the design rationale.

The calling skill passes two pieces of context when invoking this procedure:

- **Source skill name** — the slash-invocation of the calling skill (e.g., `/check`, `/patterns`, `/contracts`, `/coherence`, `/audit-agent`).
- **Severity ordering hint** — what counts as "critical" versus "advisory" in this skill's domain. Used to prioritize when capping findings.

## When to skip the verification phase entirely

**If no actionable findings were extracted** (every section returned PASS or CLEAN, no actionable rows beyond informational ones), skip the verification phase entirely and proceed to the Report with zero findings. Do not spawn `@audit-verify`.

## Step 1 — Collect findings

Walk every section of the calling skill's detection output and extract each actionable finding. Skip PASS / CLEAN / informational rows.

For each finding, capture:

- Headline (verbatim, as written).
- Full body — problem description, impact, any reasoning — exactly as produced.
- Cited file paths and line numbers.
- Proposed fix, verbatim.
- The section that raised it.

## Step 2 — Prioritize and cap at 10

Order findings:

1. All **critical** findings first, using the calling skill's severity ordering hint.
2. Then **advisory** findings, in order of impact / coordination cost.

**Take the top 10.** If more findings exist, log the remainder as deferred — they will surface on the next run after the first batch is addressed.

Do not skip this cap. Small audit → verify → fix → re-audit batches produce trustworthy iteration; one large noisy dump does not.

## Step 3 — Spawn `@audit-verify` in parallel

In a **single message with N parallel `Agent` tool calls** (N = the capped count, ≤ 10), spawn `@audit-verify` once per finding. Each invocation receives exactly this shape:

```
Source skill: <source skill name from the calling skill>
Finding headline: <headline from Step 1>
Finding body: <full body from Step 1>
Cited files: <paths + line numbers>
Proposed fix: <verbatim fix from Step 1>
```

Do NOT batch findings into a single verifier invocation. Per-finding context isolation is the entire point — each verifier reads the cited files fresh, decides independently, and does not see the other findings' reasoning.

## Step 4 — Consolidate verdicts

Each verifier returns one of three verdicts:

- **CONFIRMED — fix good** → passes through to the Report as-is.
- **CONFIRMED — fix needs revision** → passes through with the verifier's revised fix replacing the original. Include a one-line note explaining what the verifier changed and why.
- **DISMISSED** → removed from the Report; logged separately with the verifier's concrete reason so the audit trail stays transparent.

Do NOT re-verify revised fixes. The verifier's output is final for this pass. If the user rejects a revision at triage, that is a normal course correction — do not chain another verification.

## Dismissals vs. audit-decisions

A dismissal from `@audit-verify` means "not real this cycle" — session-scoped. It does NOT populate `.claude/audit-decisions/<agent>.md`. Only explicit triage decisions by the curator (user confirms "this is intentional, don't re-raise") belong in `audit-decisions/`.

## Report verification status

Every detection skill's Report includes a Verification block with:

```
### Verification
- Findings raised: N
- Verified this session (capped at 10): M
- Confirmed — fix good: X
- Confirmed — fix needs revision: Y
- Dismissed: Z
- Deferred to next run: N - M (if > 0)
```

Followed by:

- **Confirmed Findings (ready for fix)** — list confirmed findings with any verifier-revised fixes inline.
- **Dismissed Findings (logged for transparency)** — list dismissed findings with the verifier's concrete reason.
