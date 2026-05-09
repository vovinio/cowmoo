# Audit Decisions — builder

Findings raised by audits that were evaluated and found NOT to be bugs. Future audits should skip these — the reasoning below explains why they're intentional. Format per entry: title, verdict, one-line rationale. Keep entries ≤3 lines. Delete entries when the underlying decision changes.

---

## `/review` Prerequisites spawn sub-agents sequentially (not parallel)

**Verdict:** intentional.
**Why:** sequential spawning gives clearer failure handling and lets the main agent reason about each result before the next spawn. The ~5-10s latency saving from parallelization doesn't justify the loss of readability.

## `/publish` Step 5 deletes `active-task.md` and `deviations.md` before Step 6 commits

**Verdict:** intentional cleanup.
**Why:** works correctly in both states — tracked files get their deletion recorded by the commit; untracked files are just removed from disk. No reordering is needed.

## `/build` Step 2 returns early when no test framework is documented

**Verdict:** intentional.
**Why:** missing tech-stack decisions are a planner concern — `/return` is the correct response. Adding runtime framework discovery as a fallback would complicate the flow for minimal real benefit.

## First frontend task triggers `@check-design` "new icon package" finding

**Verdict:** intentional, one-time friction per project.
**Why:** `@check-design` is the real enforcement that prevents icon sprawl across a project's lifetime. On greenfield, the first icon-package import IS a real structural decision worth recording — logging it in `deviations.md` is the correct record. `@check-verify` dismisses cleanly. No exemption logic needed; the deviation-log escape valve is sufficient.

## Builder's `scope=code` uses exclusion-based `git add`

**Verdict:** intentional design.
**Why:** Under the territorial model, builder writes to code at repo root, `cowmoo/codebase/` (its public map), and `cowmoo/agent-files/builder/` (its scratch). Its `scope=code` stages everything at repo root via a precise exclude list — `:(exclude)cowmoo/specs :(exclude)cowmoo/stack :(exclude)cowmoo/design :(exclude)cowmoo/agent-files :(exclude)cowmoo/config.json`. This captures code + tests + `cowmoo/codebase/` regardless of project layout (Python `tests/` at root, Rust `tests/`, etc.), fixes the old TDD bug where `git add "$SOURCE_DIR/"` silently dropped tests outside the code subdir, and ensures `/map-codebase` updates ship with the next code commit. Builder's own scratch commits separately via `scope=working`.

## Builder uses FORBIDDEN list, other agents use TERRITORY list

**Verdict:** intentional asymmetry.
**Why:** Builder's territory is "everywhere EXCEPT other agents' dirs" — code at repo root spans any layout, so an allowlist can't enumerate it. PM/planner/UXUI each write two specific dirs and enumerate cleanly. The `territoryCheck` function in each `dev-tools.cjs` adapts to which shape its agent needs.
