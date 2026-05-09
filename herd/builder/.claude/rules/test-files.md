You are editing a test file. The builder follows TDD — tests are written before the implementation, from the PRD's Test Requirements, not from the code.

## Writing Tests

- **One behavior per test** where practical — don't batch unrelated assertions
- **Test names describe behavior, not methods** — "rejects expired tokens" not "test_validate_token_3"
- **Assertions must be specific** — check actual values, not just existence (`expect(result.status).toBe('rejected')`, not `expect(result).toBeDefined()`)
- **Don't mock what you own** — mock external services and APIs, never mock your own modules you're about to write
- **Prefer integration tests over unit tests for API endpoints** — they catch wiring bugs unit tests miss
- **Arrange / Act / Assert structure** — clearly separate setup, the action under test, and the verification

## Tests Must Fail First (RED)

A test is only useful if it could fail. When writing tests for new code:
- Run the test before the implementation exists — it MUST fail
- If it passes, the test is testing nothing — rewrite it
- The failure must be "the behavior is not yet implemented", not "syntax error" or "module not found"

## Tests Must Assert Behavior, Not Implementation

Tests describe what the code DOES from an external perspective, not how it works internally:
- Bad: "calls `validateEmail` with the input" — couples the test to implementation details
- Good: "rejects input with no @ symbol" — describes the behavior

If you refactor the implementation and the tests break even though the behavior is unchanged, the tests were testing the wrong thing.

## Never Do These

- **Delete a failing test to make the suite pass** — fix the code, or fix the test if wrong (then verify it fails for the right reason before fixing the code)
- **Write circular tests** — deriving expected values by running the code under test. Expected values come from the PRD.
- **Use `.skip`, `.todo`, `xit`, or `@pytest.mark.skip` as a shortcut** — if a test can't be written now, explain why in a comment or flag it as a PRD issue
- **Assert only existence** (`toBeDefined`, `not.toBeNull`) without also checking the value — that's a weak test that passes on any non-null return
- **Test private methods directly** — test through the public API; if a private method needs its own test, it should probably be its own module
