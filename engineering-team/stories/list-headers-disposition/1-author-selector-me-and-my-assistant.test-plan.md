# Test Plan: Story 1 — Me and My Local Tapestry Assistant in the List Headers Author selector

**Story:** `engineering-team/stories/list-headers-disposition/1-author-selector-me-and-my-assistant.md`
**ADR:** `engineering-team/decisions/list-headers-disposition/0001-me-and-my-assistant-from-the-signed-in-user.md`
**Date:** 2026-10-01

Two files:

- **`test/list-headers-author-options.test.js`** (Node runner, registered in `test/registry.js`). P1–P9 cover
  the pure rules in `ui/src/utils/viewerAuthorScope.js`, loaded by dynamic `import()`. The suite is stack-free:
  it makes no network calls and publishes nothing.
- **`tests/brainstorm/list-headers-author-options.spec.js`** (Playwright, network-mocked). L1–L9 and R1 cover
  what a viewer sees on `/tapestry/lists`.

## Coverage map

| Criterion | Test | File | Level |
|---|---|---|---|
| AC 1: order is All authors, Me, My Local Tapestry Assistant, then today's entries | P3, P8; **L1** (the tail equals the signed-out selector over the same rows) | both | unit + browser |
| AC 2: Me lists only the account's headers, both kinds, "<shown> of <total> lists" | P5; **L2** | both | unit + browser |
| AC 3: My Local Tapestry Assistant lists only the person's own Assistant; a non-Owner never sees the Owner's Assistant's headers | P5, P6; **L3** | both | unit + browser |
| AC 4: entries stay when nothing matches; today's empty message | **L5** | spec | browser |
| AC 5: signed out, neither entry and today's selector unchanged | P2; **L6** | both | unit + browser |
| AC 5: no Assistant here, Me choosable, the other greyed out and labelled as none | P4, P6; **L7** | both | unit + browser |
| AC 6: two people, two sessions, each sees only their own | P9; **L8** (two browser contexts, same rows) | both | unit + browser |
| Story § Out of scope: for the Owner, Me and 👑 Owner pick the same rows (ADR 0001: they never share a value) | P1, P5; **L4** | both | unit + browser |
| ADR 0001: a stale Me/My Assistant resets to All authors | P7; **L9** | both | unit + browser |
| Today's literal entries still filter (guard) | P8; **R1** | both | unit + browser |

L6 and R1 pass today and must keep passing. They guard what the story must not change.

## Edge cases

- [x] Signed in, with an Assistant, and neither has written a header (L5).
- [x] `assistantPubkey` is `null`, `undefined`, `''` or malformed (P4, P6). Every form greys out the entry and
      resolves to nothing.
- [x] A malformed session pubkey counts as signed out (P2).
- [x] A stray third argument to the resolver, the way a fallback would arrive, changes nothing (P6).
- [x] Sign out and sign back in on the same page (L9).
- [x] Today's pinned entries (👑 Owner, 🤖 Assistant) keep their order and labels. The scan waits until the
      instance config has answered, so the pins are deterministic.
- [ ] Not covered: remembering the choice across visits (out of scope), and the Kind and Author selectors
      combined (unchanged code path).

## Test infrastructure

- Node runner for P1–P9. To run one suite by itself, call its exported `run()` (see How to run). On this
  machine, never run the full `npm test` without asking: the live tag suites publish fixtures to public relays.
- Playwright for L/R. Every `/api` call is mocked: a catch-all, registered first, answers anything a test
  doesn't name. So a `vite preview` that proxies `/api` to `:7778` never reaches the live stack.
  - Sign-in comes from `/api/auth/status` and `/api/auth/user-classification`. Its `assistantPubkey` is the
    one input the ADR reads.
  - The rows come from `GET /api/strfry/scan` for kinds 9998/39998.
  - L9 signs back in on the page through a stub NIP-07 signer (`addInitScript`) and mocked `verify-user` /
    `login-user`.
- Markup contracts the spec relies on, all existing today:
  - the Author selector is the `<select>` that has an **All authors** option;
  - rows are `table.data-table tbody tr`, with the name in the first cell;
  - the empty state is `td.empty-row`;
  - the count line matches `^\d+ (of \d+ )?lists$`;
  - the user menu is `.header-user .user-button` with a **Sign Out** button, and signed out there's a
    **Sign in with Nostr** button.
- Concept Graph API: not used. Firmware state: none.
- Fixtures: eight headers by seven authors: the Owner, the Owner's Assistant, two customers and their
  Assistants, and a stranger. The second customer has headers of both kinds. They're listed in a scrambled
  order, so "today's order" comes from the page's rule and not from the fixture.

## How to run

```
node -e "const m=require('./test/list-headers-author-options.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
BRAINSTORM_BASE_URL=<a vite preview of a build, or :7778 after /cycle-local> npx playwright test tests/brainstorm/list-headers-author-options.spec.js --project=chromium
```

## Verification

### The new tests fail with the current code

Confirmed 2026-10-01 at `66d8678e`, plus these tests.

**Node suite:** `0 passed, 9 failed`. Every test fails with
`ADR 0001 §Implementation: ui/src/utils/viewerAuthorScope.js must exist as a pure ESM module (no React, no fetch)`.

**Playwright**, on a build of `66d8678e` served by `vite preview`: `8 failed, 2 passed`.

- Passed: L6 (the signed-out selector is today's) and R1 (literal entries still filter). Both are guards.
- Failed: L1–L5 and L7–L9, every one because the entries aren't there. The messages read:
  - `story AC 1: the two new entries sit right under All authors…`;
  - `the Author selector offers "Me"` / `"My Local Tapestry Assistant"`;
  - `story AC 4: the entries are never hidden…`;
  - `story AC 5: Me appears`.

### The tests can pass, and they catch the defects they're meant to catch

A throwaway build that does exactly what ADR 0001 describes was made outside the repo: the new module plus
the four page edits. It isn't committed.

- **Node:** 9 of 9 pass.
- **Playwright:** 10 of 10 pass, and 50 of 50 with `--repeat-each=5`.

Each mutant below changes one rule of that build. Every mutant fails at least one test:

| Mutant | Fails |
|---|---|
| m1: a person with no Assistant falls back to the Owner's Assistant | L7 (`it can't be chosen`) |
| m2: the entries carry literal pubkeys, not reserved values | L4 (the selector shows Me after 👑 Owner was chosen), L9 |
| m3: no reset after sign-out | L9 (`a choice made before signing out does not come back on the next sign-in`) |
| m4: the entries are hidden when nothing matches | L5, L7 |
| m5: Me means the account *and* its Assistant (the "Mine" rule from Active b-tags) | L2, L4, L8, L9 |
| n1: the resolver accepts a fallback argument | P6 |
| n2: My Local Tapestry Assistant is never disabled | P4 |
| n3: Me resolves without checking that the pubkey is valid | P7 |

m3 first survived a version of L9 that only signed out. At sign-out the browser already shows the first entry
(**All authors**) and lists every row, whether or not the page resets its state. The reset's only visible
effect is at the next sign-in on the same page: without it, the old choice comes back by itself. L9 now signs
back in, and ADR 0001's Amendment 1 corrects the reason it gives for the reset.
