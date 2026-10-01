# Test Plan: Story 4 — Is each Assistant's NIP-05 genuine, and a way into each Assistant's profile

**Story:** `engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.md`
**ADR:** `engineering-team/decisions/my-assistants/0004-nip05-status-from-the-verify-endpoint-and-plain-profile-links.md`
**Date:** 2026-10-01

Two new files and one addition to the earlier specs:

- **`test/my-assistants-nip05.test.js`** (Node, registered after `my-assistants-map` in `test/registry.js`). It covers:
  - the server's lookup and the endpoint's `status`, against a stubbed `global.fetch`;
  - the view-model;
  - two sentinels.
- **`tests/brainstorm/my-assistants-nip05.spec.js`** (Playwright). It covers what a viewer sees, with
  `/api/nip05/verify` mocked per NIP-05.
- **The three earlier specs each mock `/api/nip05/verify`** as "unchecked". Without that, their rows would ask the
  real endpoint through the preview's proxy, once the feature exists. Nothing they assert changes.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** three honest states | L1 (21 cases: malformed ×3, a refused host, 301, 302, 404, 500, a network error, the abort, non-JSON, `names` missing / an array / a string / null, the name absent, a non-hex value, a different key, the same key, the lowercase-name fallback, the bare-domain `_` name) · L2 (same URL, once, `redirect: 'manual'`, the abort signal) · V1 (sub-decision 2's table for every case; `verified === (status === 'verified')`) · V2 (an uppercase pubkey parameter verifies; another key is invalid) · V3 (a missing or bad pubkey parameter is unchecked and asks nothing) · V4 (`no-store`, 200) · V5 (`verifyNip05Identifier`'s contract, every case) · M1 (`nip05StatusOf`: a failure, a missing status or an unknown one is never invalid) | Node | unit |
| | N1 (the three states in the list, each explained) · N2 (held: "Checking…" and no verdict, sampled, in the list **and** the section) · N3 (a 500, a network abort and an answer with no `status` read Couldn't check, never Not valid, in the list **and** the section) | Playwright | browser |
| **AC-2** where it shows | M3 (`nip05Id` apart from the "—" placeholder; a non-text NIP-05 is none) | Node | unit |
| | N1 (every list row, the Local row included; a row without a NIP-05 shows "—" and no status; one check per NIP-05, for that row's pubkey) · N4 (the section, one check per item's pubkey) · N5 (no status and no check for search results) · N6 (no definite answer is asked twice, across a refresh after a press or a tab round trip) | Playwright | browser |
| **AC-3** says what it means | M4 (§ Copy's words, curly apostrophes) | Node | unit |
| | N1 and N4 (each status has its explanation as its title; the status is read with its NIP-05; the states differ by text, not colour) | Playwright | browser |
| **AC-4** a link to each profile | M2 (`profilePath` is `/user/<pubkey>`) · S1 (the two new files exist, no 64-hex literal) | Node | unit |
| | P1 (an open row's link, the untagged Local row's too) · P2 (each section item) · P3 (an open duty: Preferred and every Alternate) | Playwright | browser |
| **AC-5** a new tab, named | M4 (`viewProfileLabel`: "View profile of {name} (opens in a new tab)", ADR 0004 sub-decision 5) | Node | unit |
| | P1–P3 (`target="_blank"`, `rel` with `noopener`, the accessible name per Assistant) · P1 (the link opens `/user/<pubkey>` in a new tab) | Playwright | browser |
| **AC-6** nothing else changes | the earlier three specs, all passing with the added mock | Playwright | browser |
| | P1 (no link inside a toggle; pressing it leaves the row open) · P3 (no link inside a duty's toggle) · P4 (375 px: no sideways scroll, nothing cut off) | Playwright | browser |
| **Docs** | S2 (`openapi.yaml` documents `/api/nip05/verify` with `verified`, `status`, `invalid`, `unchecked`) | Node | source |

Regressions that must pass unchanged:
- `test/nip05-ssrf-guard.test.js` (21), which pins the guard, redirects and the endpoint's `verified: false` for a refused
  host;
- `test/nip05-checkmark-verification.test.js` (4), the profile pages' own mark;
- stories 1–3's suites and specs.

## Edge cases

- [x] A NIP-05 that isn't an identifier at all is Not valid; it never reaches the network (L1, V1).
- [x] A host the guard refuses is Couldn't check, with no request made (L1, V1).
- [x] A domain behind a redirect is Couldn't check (L1, V1: 301 and 302; ledger row
      `2026-09-20-nip05-verification-no-longer-follows-redirects`).
- [x] A 404 is Couldn't check, not Not valid, as the owner accepted at the ADR gate (L1, V1).
- [x] An older server's answer with no `status` reads Couldn't check (M1, N3).
- [x] The NIP-05 name in another case is found through the lowercase fallback (L1, V5).
- [x] A profile whose NIP-05 isn't text has none (M3).
- [x] The Local row checks and links like any other (N1, P1).
- **Not covered, by choice:**
  - **The real 5-second timeout.** It's stubbed as an AbortError (L1), and waiting five real seconds per run would
    add nothing.
  - **The profile page's own content.** It's out of the story's scope; the link's target is a stub page in P1.

## Test infrastructure

- **Runners:** the Node gate (`test/registry.js`; the suite exports `run()`) and Playwright, chromium.
- **Hermetic, both halves:**
  - **Node:** `global.fetch` is replaced per call and restored. Every domain is the public IP literal
    `93.184.216.34`, so the guard classifies it with no DNS. A refused host (`10.0.0.5`) never reaches fetch.
  - **Browser:** every test mocks `/api/publish-policy` as local-only and `/api/strfry/publish`, and gives
    `window.nostr` fake signatures. WebSockets are blocked and counted at the **browser-context** level, so a tab a
    profile link opens is covered too; the count must end at 0. A path starting `/user/` is served a stub page.
  - **Never run the full `npm test` on the Mac Studio.**
- **Seams the tests define,** beyond the ADR's names:
  - `lookupNip05(x)` returns `{ outcome: 'malformed' | 'unreachable' | 'answered', pubkey: string | null }`;
  - `COPY` keys `nip05Verified`, `nip05Invalid`, `nip05Unchecked`, `nip05Checking`, `nip05VerifiedTitle`,
    `nip05InvalidTitle`, `nip05UncheckedTitle`, `viewProfile`, and `viewProfileLabel(name)`.
- **The markup contract the browser tests add** (stories 1–3's still holds):
  - a status is one element whose whole text is its word ("Verified", with an optional leading "✓"), with § Copy's
    explanation as its `title`. While checking, it's an element whose text is "Checking…";
  - the status sits after its NIP-05 value, in the list row's NIP-05 field and in the section's "URL · NIP-05" line;
  - a profile link is an `<a>` with `href="/user/<pubkey>"`, `target="_blank"`, `rel` containing `noopener`, and the
    accessible name "View profile of {name} (opens in a new tab)". It is never inside an element with
    `aria-expanded`.

## How to run

```
node -e "const m=require('./test/my-assistants-nip05.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
node -e "const m=require('./test/nip05-ssrf-guard.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
npx playwright test tests/brainstorm/my-assistants-nip05.spec.js tests/brainstorm/my-assistants-map.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-actions.spec.js --project=chromium
```

The Playwright run takes `BRAINSTORM_BASE_URL`, pointing at a `vite preview` of a build. Everything is mocked.

## Verification

### The new tests fail on the current code

Confirmed 2026-10-01 at `c864253b`.

- **Node `my-assistants-nip05`:** 11 failed, 2 passed. Each failure names what's missing:
  - `src/api/nip05.js does not export lookupNip05()`;
  - `status should be invalid, got undefined`, and the same for every case;
  - `does not export nip05StatusOf()` and `profilePath()`;
  - `a NIP-05 is shown and kept; got ["has@ex.example",null]`;
  - `COPY.nip05Verified should be "Verified", got undefined`;
  - `Nip05Status.jsx does not exist`;
  - `openapi.yaml should document /api/nip05/verify`.

  The two passes, V4 (`no-store`, 200) and V5 (`verifyNip05Identifier`'s contract), pin what must not change.
- **Playwright,** the four specs against a `vite preview` of `c864253b`'s build: **9 failed, 51 passed**.
  - N1–N4 and N6 fail at the first missing status, and P1–P4 at the first missing link or status.
  - N5 passes before and after, because it checks that nothing shows.
  - The 50 earlier tests pass with the added mock.
- **Regressions:**
  - `nip05-ssrf-guard`: 21/21;
  - `nip05-checkmark-verification`: 4/4;
  - `my-assistants-page`, `-actions`, `-map`: 52, 29, 14, all passing.

### The tests can pass

The oracle is a throwaway implementation of ADR 0004 in a scratchpad mirror of `c864253b`, never committed. On it:
- **Node:** `my-assistants-nip05` 13/13, and `nip05-ssrf-guard` 21/21.
- **Playwright:** the four specs passed 60/60, and **180/180** under `--repeat-each=3`.

### The tests bite

Each mutant was applied to the oracle alone. Each fails the tests named; the control edits fail nothing.

| Mutant | Fails |
|---|---|
| **Server:** unreachable reads invalid | V1 |
| **Server:** a non-`ok` response counts as answered | L1, V1 |
| **Server:** `names` that isn't an object counts as answered | L1, V1 |
| **Server:** a bad pubkey parameter reads invalid | V3 |
| **Server:** no lowercase-name fallback | L1, V1, V5 |
| **Server:** `verified` true for anything but invalid | V1, V3 (and `nip05-ssrf-guard` C3) |
| **View-model:** a raw, untrimmed NIP-05 as `nip05Id` | M3 |
| **The shared status:** a failed request reads invalid | N3 |
| **View-model:** `nip05StatusOf` turns an unknown answer into invalid | N3 (and M1) |
| **The shared status:** no "Checking…" while held | N2 |
| **The shared status:** a verdict shown beside "Checking…" | N2 |
| **The list:** a row always also claims "Couldn't check" | N1, N2, N3, P4 |
| **The section:** an item always also claims "Couldn't check" | N2, N3 |
| **The section:** an item always also claims "Not valid" | N3, N4 |
| **The section:** no status | N2, N3, N4, N6 |
| **The list:** no status | N1, N2, N3, N6, P4 |
| **Search:** a status in the search results | N5 |
| **The shared status:** no answer cache | N6 (after its tab round trip was added) |
| **The link:** no `target` | P1, P2, P3 |
| **The link:** no `rel` | P1, P2 |
| **The link:** the story's original accessible name | P1, P2, P3 |
| **The list:** the link inside the row's toggle | N1, P1 |
| **Duties:** only the Preferred gets a link | P3 |

Two of my own test faults surfaced and were fixed:
- **N6 didn't catch "no answer cache"** at first. A refresh keeps the rows mounted, so nothing was asked again either
  way. N6 now leaves the tab and comes back, which redraws every row and the section.
- **N2 didn't catch "a section item also claims Couldn't check"** at first. Its verdict pattern needed whitespace
  around the word, and two adjacent inline elements render as "Checking…Couldn’t check". The pattern now matches the
  word anywhere.

One mutant can't be told apart from the oracle: `verifyNip05Identifier` returning `found.pubkey || null` instead of
checking the outcome. A pubkey is only ever set when the domain answered, so the two are the same.

## Amendment after review 1 (2026-10-01)

The review passed, with three non-blocking findings. The owner chose to fix them before shipping (ADR 0004
Amendment 1).

**What changed in the tests:**
- **NB1, new N7: a NIP-05 that changes under a drawn row.** After Tag: Tapestry on Dee in the section, the profiles
  re-read with changes: Ava's NIP-05 changes, Bea's goes, and Eve's (still in the section) changes. Both new
  identifiers' checks are held.
  - A MutationObserver records every state of the page's rows and section items while the refresh lands.
  - N7 fails on any recorded state with Ava's or Eve's new NIP-05 beside a verdict, or a verdict beside "—".
  - Once released, Ava reads Verified and Eve Not valid, and Bea (no NIP-05 now) shows no status.
  - This pins the honest-state rule on a third axis: a transition on a drawn surface, in the list and in the section
    (ledger row `2026-10-01-honest-states-pinned-per-state`, update). Sampling can't see a one-render flash; the
    change log does.
- **NB2, N6 extended: the retry.** `bea@down.example` (Couldn't check) is asked twice: once on load, not on the
  refresh after the press (the row stays drawn), and once more after the tab round trip.
- **The setup:** `setup()` gains `profilesAfterPress`, profiles that answer differently once something has been posted.

**Verified 2026-10-01** against the build of `d9185db9`, the code before the fix:
- **N7 fails in 3 runs of 3:** "Ava's new NIP-05 beside a verdict before it was checked; seen: …".
- **The other 10 pass,** N6's retry pin included, since that's how the code already behaves.
- **The tests bite:**

  | Mutant | Fails |
  |---|---|
  | cache every answer, Couldn't check included (review 1's U-D) | N6: `bea@down.example` asked 1 time, expected 2 |
  | the code before the fix (a status kept apart from its key) | N7, 3 of 3 |
