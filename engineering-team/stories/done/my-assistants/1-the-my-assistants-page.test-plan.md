# Test Plan: Story 1 — The My Assistants page, its menu link, and the list of your Assistants

**Story:** `engineering-team/stories/done/my-assistants/1-the-my-assistants-page.md`
**ADR:** `engineering-team/decisions/done/my-assistants/0001-one-session-read-lists-your-assistants.md`
**Date:** 2026-09-30

Two files:

- **`test/my-assistants-page.test.js`** (Node runner, registered in `test/registry.js`). It covers
  the rule, the handler, the shared tag list, the view-model, the menu list, and source sentinels.
- **`tests/brainstorm/my-assistants.spec.js`** (Playwright, network-mocked). It covers what a
  viewer sees: words, order, states, layout, the menu.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** the menu link | M1 (`MY_ASSISTANTS_PATH` is `/assistants`) · M2 (for owner, admin, customer with and without an Assistant, and guest, on both profile bases: the item after My Treasure Map is My Assistants → `/assistants`, and only one item opens it) | Node | unit |
| | A8a (on `/dictionary`'s top bar and on the search landing page: the menu lists My Assistants right after My Treasure Map, `href="/assistants"`, and clicking it opens the page) · A8b (signed out, no link named My Assistants on `/` or `/assistants`) | Playwright | browser |
| **AC-2** the page | A1 (the frame: "Brainstorm home" link, "My Assistants" kicker, h1 "Your Assistants.", the introduction, the Treasure Map link → `/tapestry/grapevine/treasure-map`) · A10 (Figtree type, a 1040 px column) · A11 (a reload renders the page, never "Page not found") · A9 (375 px: no sideways scroll, nothing cut off) | Playwright | browser |
| | D1 (App.jsx routes `MY_ASSISTANTS_PATH` to `<MyAssistantsPage>` from `pages/assistants/Index`) · D2 (the Treasure Map and tag-prompt targets are read from their owners, never re-typed) | Node | source |
| | R0-2 (live: `/assistants` is served the app shell, so a direct load reaches the router) | Node | live |
| **AC-3** whose list, which taggings | **Rule (pure):** R1 (apply under Tapestry) · R2 (any definition author counts) · R3 (Brainstorm) · R4 (both tags → one row, Brainstorm first) · R5 (other tags don't count) · R6 (d fallback) · R7 (the d fallback needs the exact slug and the viewer's segment) · R8 (`a` first; a malformed `a` falls back to d) · R9 (newest stance decides) · R10 (neutral doesn't count, absent polarity is apply) · R11 (newest per (tag, profile) across addresses) · R12 (tie → lowest id) · R13 (retracted by `e`; someone else's kind 5 doesn't retract) · R14 (retracted by `a`, at or after only) · R15 (retracting an old version doesn't hide a newer apply) · R16 (non-hex `p` dropped) · R20 (rows carry tag names) | Node | unit |
| | **Handler:** U3 (reads `{kinds:[39999], authors:[viewer], '#z':[canonical z]}`, the tag pages' relay set) · U4 (the viewer is the session's, lowercased; query parameters are ignored) · U5 (another signer's tagging is dropped even when a relay returns it) · U6 (the viewer's kind 5s are read and honoured; no candidates → no deletion read) · T1–T4 (the two tags, their order, the Tapestry slug read from identification-tags, the list module is pure) | Node | unit |
| **AC-4** each row | C2 (name: display_name → name → shortened npub, also for null or failed profiles) · C3 (npub1…, first 12 + … + last 6) · C4 (URL / NIP-05 trimmed; missing, empty or blank → —) · C5 (the avatar letter) · C7 (tags kept in order) | Node | unit |
| | A2 (each row's name, npub, URL, NIP-05 and chips, in the browser) · A6 (profiles fail → every row still listed, npub as name, — twice) | Playwright | browser |
| **AC-5** Local, order, count | R17 (tagged Local) · R18 (untagged Local listed, `tags: []`) · R19 (no Assistant → no Local row) · U2 (the answer's shape and Local) · U7 (a lookup answering nothing usable → `local: null`) · C1 (Local first, then alphabetical ignoring case and accents, pubkey breaking a tie) · C6 (untagged flag) · C8 (the count's words) | Node | unit |
| | A2 (Local first with its tooltip; no other row has the badge; "4 Assistants") · A3 (untagged Local: first, Local, "Not tagged" with its tooltip, the prompt, its link → `/assistant/identification-tags`, no chip; "2 Assistants") | Playwright | browser |
| **AC-6** the other states | U1 (no, or no real, session → `{success:true, signedIn:false}` and nothing read) · U8 (the local read fails → 500 `{success:false, error:'Could not load your Assistants'}`) · S2 (no hardcoded key, no query parameter, no write call) · S1 (the route is registered) | Node | unit / source |
| | A1 (signed out: the sign-in line and button; no list, count or empty line) · A4 (no rows: the empty line and "0 Assistants") · A5 (500, then a dropped connection: the error line and Try again, never the empty line or a count; Try again reads again) · A7a/A7b/A7c (held sign-in, held read, held profiles: the loading line in every 100 ms sample, and never the sign-in line, the empty line, a count or a row) · A11 (every `/api` request the page makes is a GET) | Playwright | browser |
| | H1 (live: an anonymous GET answers `{success:true, signedIn:false}`) | Node | live |

## Edge cases

Beyond the literal ACs, each implied by one:

- [x] A slug that merely starts with ours (`my-tapestry-assistant-v2`): R7, T3.
- [x] A d with another signer's segment: R7.
- [x] An `a` naming another tag while the d names ours: R8.
- [x] Two addresses for one (tag, profile): R11.
- [x] A `created_at` tie: R12.
- [x] A retraction of an older version: R15.
- [x] An address deletion older than the re-tag: R14.
- [x] A relay answering outside its filter (another signer's tagging): U5.
- [x] Session shapes that aren't a real sign-in (unset, `'true'`, non-hex): U1.
- [x] An uppercase session key: U4.
- [x] `getAssistantPubkeyFor` answering `null`, `undefined`, `''`, a non-key, or 62-hex: U7.
- [x] A same-base-letter tie (`bob` / `Bob`) and an accented name (`Émile`): C1.
- [x] An empty `display_name` falling through to `name`: C2.
- [x] Whitespace-only URL or NIP-05: C4.
- [x] Long unbreakable values at 375 px: A9.
- [x] A dropped connection, not just a 500: A5.
- [x] The profile lookup failing as a whole: A6.
- [x] `/dictionary` unchanged by the frame move: A10 (its column stays 720 px). The existing suites, `test/dictionary-concepts.test.js` and `tests/brainstorm/dictionary-concepts.spec.js`, must pass unchanged.

## Test infrastructure

- **Frameworks:** the Node gate (`npm test`, `test/registry.js`; the suite exports `run()`) and
  Playwright (`chromium`).
- **No live graph or firmware state needed.** The Node suite is stack-free except the H-class, which
  skips when nothing answers at `BRAINSTORM_BASE_URL` (default `http://localhost:7778`).
  - **This machine's `tapestry` container has no bind mount.** H1 fails until the implementation is
    deployed into it (`/cycle-local`). That's expected.
  - **AC-2's "on staging" half** is H1 and R0-2 run with `BRAINSTORM_BASE_URL=https://staging.brainstorm.world`
    after the staging deploy, plus `/cycle-staging`'s smoke. It can't be proven before deploy.
- **Fixtures** are inline: fixture keys (`'a1'.repeat(32)` …), a tagging builder in the publisher's
  shape, NIP-09 deletions, and a relay-like fake scan that applies NIP-01 filters (or doesn't, on
  request).
  - The canonical `z` comes from `src/api/profile-tags` (`NOSTR_USER_TAG_Z_TAG`) and is never
    re-typed.
  - Expected npubs come from `nostr-tools`.
- **The markup contract the browser tests rely on.** The ADR leaves markup open; these are the few
  things the spec locates by, all accessible or visible:
  - The rows are a **list** (`<ul>`/`<ol>`, or `role="list"`) whose accessible name contains **"Your
    Assistants"**, with one **listitem** per row as its direct child.
  - A row's **name is its own element** whose whole text is the name. The Local badge sits beside
    it, not inside it.
  - The Local badge's tooltip, and the Not tagged mark's, are `title` attributes inside the row.
  - The tag prompt and its link are inside the Local row's listitem.
  - Apostrophes may be straight or curly (story § Copy: "as the rest of the app"). The tests accept
    both.
- **The ADR has one error, corrected here.** It says `src/api/profile-tags/index.js` "must export
  `NOSTR_USER_TAG_Z_TAG`". It already does, at line 1865, so the Implementer has nothing to add
  there. A dated correction note is on the ADR.

## How to run

```
node -e "const m=require('./test/my-assistants-page.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
npm test
npx playwright test tests/brainstorm/my-assistants.spec.js --project=chromium
```

The Playwright spec takes `BRAINSTORM_BASE_URL`. Point it at a `vite preview` of a build, or at
`:7778` after `/cycle-local`.

## Verification

### The new tests fail with the current code

Confirmed 2026-09-30 at `b4f45bf1`, plus these tests.

**Node suite:** `48 failed, 2 passed`. Each test names what is missing:
- `src/lib/my-assistant-tags/index.js does not exist`;
- `src/api/assistant/myAssistants.js does not exist`;
- `ui/src/pages/assistants/myAssistants.js does not exist`;
- `MY_ASSISTANTS_PATH should be '/assistants', got undefined`;
- `…the item after My Treasure Map should be My Assistants → /assistants; got {"key":"my-trusted-agents",…}`;
- `http://localhost:7778: got 404 null` (H1).

The two passes are the regressions: R0-1 (the canonical `z` export) and R0-2 (`/assistants`
already gets the app shell).

**Playwright,** against a build of `b4f45bf1` served at :4174: `13 failed, 1 passed`.
- A1–A7 and A9–A11 fail at `getByRole('heading', { name: 'Your Assistants.' })` or the list: the
  route doesn't exist, so the app shows its not-found page.
- A8a fails with `/dictionary: the item after My Treasure Map`.
- A8b (signed-out menus offer no My Assistants) passes before and after, as a guard.

### The tests can pass

The oracle is a throwaway implementation of the ADR, built outside the repo in the session
scratchpad and never committed. On it:

- the Node suite gives `48 passed, 0 failed, 2 skipped` (H-class, no stack pointed at);
- the Playwright spec gives `14 passed`, and `42 passed` under `--repeat-each=3`;
- `test/dictionary-concepts.test.js` gives `25 passed`;
- `tests/brainstorm/dictionary-concepts.spec.js` gives `9 passed`, the same as on the baseline
  build. So the frame move leaves `/dictionary` as it was;
- `test/stack-free-npm-test.test.js` G1–G7 still pass with the new registry entry.

One oracle bug was found by the tests and fixed in the oracle, not in the tests. It had nested the
Local badge inside the name element (A2).

### The tests bite

Mutants were applied to the oracle one at a time. Each fails exactly the tests that guard its rule.

| Mutant | Fails |
|---|---|
| retractions ignored | R13, R14, U6 |
| any polarity counts | R9, R10, R11, R12 |
| d fallback ignores the signer segment | R7 |
| newest per address, not per (tag, profile) | R11, R12 |
| other signers accepted | U5 |
| a tie keeps the highest id | R12 |
| the untagged Local row not added | R18, U2 |
| an address deletion ignores time | R14 |
| a non-hex Local answer kept | U7 |
| the empty line kept while loading | A7a, A7b, A7c |
| rows shown before profiles settle | A7c |
| a failed read reads as empty | A5 |
| no wide column | A10 |
| long values don't wrap (clipped, not scrolled) | A9 |
| Local not first | A2, A3, A7c |
| the menu item at the end | A8a |
| the untagged Local row has no prompt | A3 |
| the sign-in line while sign-in resolves | A7a |

A9 at first let the "don't wrap" mutant through: the list clips overflow, so the page never
scrolled. It now also checks that no element in the list is wider than its box, and it catches the
mutant.

## Amendment after review 1 (2026-09-30)

The review (`engineering-team/reviews/done/my-assistants/1-the-my-assistants-page.md`, blocking finding 1) found a gap the
suites above missed. A kind 0 is arbitrary JSON, so a name field can be a number, an array, an object, a boolean or
blank. The view-model took any truthy `display_name` as the name. Then `name.slice` threw, and one such profile
turned the whole page into the error line. That breaks AC-4 (the profile should still be listed, with the fallbacks)
and AC-6 (the error line is only for a failed read).

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-4, AC-6 | C10 (`display_name` of `42`, `['x']`, `true` or blank, and `name` as an object, are all skipped: the next field or the shortened npub is used; surrounding blanks are trimmed; nothing throws) | Node | unit |
| AC-4 | C11 (the avatar letter is a whole character: 🦊, not half of it; review non-blocking finding 1) | Node | unit |
| AC-4, AC-6 | A12 (with one profile's `display_name: 42, name: ['x']`, all four rows are listed, that one named by its npub; no error line) | Playwright | browser |

**Fails on the reviewed implementation (`a63b3ae9`), for the right reasons:**
- **C10:** `buildRows threw on a malformed profile: name.slice is not a function`.
- **C11:** `initial should be the whole emoji 🦊, got "\ud83e"`.
- **A12,** against `:7778`, which is running `a63b3ae9`'s build: `Expected: 4, Received: 0`. The page showed the error line.

The Node suite now reports `50 passed, 2 failed`.
