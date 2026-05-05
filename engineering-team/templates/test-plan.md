# Test Plan: Story <n> — <title>

**Story:** `engineering-team/stories/<n>-<slug>.md`
**ADR:** `engineering-team/decisions/<NNNN>-<slug>.md`
**Date:** <DATE>

## Coverage map
Map each acceptance criterion to a test.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 | `it("does X when Y")` | `test/foo.test.js` | integration |
| AC-2 | ... | ... | unit |

## Edge cases
Things not in the acceptance criteria but still worth covering.

- [ ] Empty input.
- [ ] Concurrent calls.
- [ ] Concept Graph API unavailable.
- [ ] Concept handle not found.

## Test infrastructure
- Test framework: Node built-in runner (`node test/test.js`) and/or Playwright.
- Concept Graph API: `localhost:8877` (must be running).
- Firmware state: <list any required `POST /api/firmware/install` precondition>.
- Fixtures: <list>

## How to run

```
npm test
```

For browser/e2e:
```
npm run test:playwright
```

## Verification
The new tests fail with the current code. Confirmed on <DATE> at commit <hash>:

```
<paste the failing test output here>
```
