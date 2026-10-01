# Test Plan: Story 2 — Tag, re-tag and untag your Assistants from the My Assistants page

**Story:** `engineering-team/stories/my-assistants/2-tag-and-untag-from-the-page.md`
**ADR:** `engineering-team/decisions/my-assistants/0002-tag-and-withdraw-from-the-browser-the-read-carries-what-they-need.md`
**Date:** 2026-09-30

Two new files and one re-aim:

- **`test/my-assistants-actions.test.js`** (Node, registered after `my-assistants-page` in `test/registry.js`). It
  covers the read's two new fields, the pure planning, and the orchestration with **fake publishers**.
- **`tests/brainstorm/my-assistants-actions.spec.js`** (Playwright). It covers what a viewer does and sees, with a
  stubbed `window.nostr`.
- **A re-aim in `test/my-assistants-page.test.js`,** required by ADR 0002 sub-decision 1. Story 1's `taggingScans`
  now means "the kind 39999 scan carrying `#z`", because the read gains a second kind 39999 scan, for the
  definitions. U3 still demands exactly one taggings read with the same filter; nothing it asserts is weaker.

## Coverage map

| Criterion | Tests | File | Level |
|---|---|---|---|
| **AC-1** find a profile | V1 (`parseExactKey`: npub, hex in any case, padding; anything else null) · V2 (under 2 characters, nothing) · V3 (exact key first, hits after without duplicates, listed profiles and the untagged Local row left out, card fields) · V4 (an exact key with no profile is offered, named by its npub) | Node | unit |
| | C1 (no results or count under 2 characters, and **no search asked for**; matches with the count line; a listed profile left out; the no-match line) · C1b (signed out: no search box) · C2 (a pasted npub, and a hex key, find the exact profile even when search returns nothing) | Playwright | browser |
| **AC-2** tag a found profile | O1 (the apply: the profile, polarity 1, the definition's slug, author and event id; reported in the tag's name) · T1, T2 (authors are identification-tags' Nous; `definitionAddress`) · R4, U1 (the definitions: found, newest id, another author's same slug ignored; the handler's scan by author and `#d`) | Node | unit |
| | C3 (the signed tagging: kind 39999, `p`, `a` = the definition address, `e` = its event id, `polarity` 1, the publisher's `d`; posted once; the result line; the list refreshed to 2 rows and "2 Assistants"; the result leaves the search) | Playwright | browser |
| **AC-3** open a row | V6 (an untagged Local row has no actions) | Node | unit |
| | C4 (click, Enter and Space toggle `aria-expanded`; one row open at a time; closed rows show no actions; the untagged Local row has no toggle and keeps its link) | Playwright | browser |
| **AC-4** change the tag | V5 (Change to the other tag, its label, enabled by its definition) · V6 (a row with both tags offers no Change) · O2 (apply the other tag **first**, then withdraw the current tag's `retract`) | Node | unit |
| | C5 (the signed apply, then a kind 5 with `e` = `retract.tapestry.ids`, `a` = its addresses, `k` = `39999`; posted in that order; the row ends with only the other chip; a both-tags row shows no Change) | Playwright | browser |
| **AC-5** remove the tag | R1–R3 (`retract`: every event for the pair, applies and disputes, at every address; only for tags the row carries; the untagged Local row's is `{}`) · V8 (`buildRows` keeps `retract`; `withdrawalOf` gathers every id and address; the subject names the tags) · O5 (one withdrawal naming everything) | Node | unit |
| | C6 (one kind 5 naming every id and address of a both-tags row; the row leaves and "1 Assistant"; a tagged Local row removed stays, **Not tagged**) | Playwright | browser |
| **AC-6** Brainstorm unavailable | V7 (`tagAvailability`: a missing definition disables that tag with § Copy's reason; no `definitions` disables both; Change to it disabled with the reason) · O7 (a tag whose definition is missing is refused before any signature) · U2 (a failed definitions read fails the read: 500) | Node | unit |
| | C7 (Tag: My Brainstorm Assistant disabled with the reason, Tag: My Tapestry Assistant enabled; Change to My Brainstorm Assistant disabled with the reason; Remove enabled; nothing signed) | Playwright | browser |
| **AC-7** told, never lost | O3 (no withdrawal after a refused apply, or after an apply no relay took) · O4 (a half-done change reported as two reports, the second failed, subject "Withdrawal of …") · O6 (a refusal returned in its own words, no report) · S1–S3 (no 64-hex literal; no page file builds or signs an event; the withdrawal publisher exists; the orchestration doesn't import publishers at the top) | Node | unit |
| | C8 (while signing: the pressed button reads **Tagging…** and is disabled, every action button is disabled, one signature and one post) · C9 (no extension; the wrong key: nothing posted, the app's words shown) · C10 (no relay took it: the "could not be saved" line, the list unchanged, the button usable again) · C11 (a half-done change: both lines; the refreshed list shows both chips) · C12 (the refresh keeps rows on screen, with no loading line while the re-read is held) | Playwright | browser |

Story 1's suites are regressions here. They must pass unchanged, apart from the U3 re-aim above:
`test/my-assistants-page.test.js` and `tests/brainstorm/my-assistants.spec.js`.

## Edge cases

- [x] A tagging at another client's address for the same pair: R1. The withdrawal names both addresses.
- [x] A disputed other tag on the same profile gets no `retract` entry: R2.
- [x] Another author's same-slug "definition" doesn't count as found: R4.
- [x] An npub with padding, an uppercase hex key, an invalid npub, a 62-hex string: V1.
- [x] The search returning the exact key too (no duplicate), the viewer's own untagged Assistant (not offered): V3.
- [x] An apply that reached no relay: the change stops there (O3), and the page says so (C10).
- [x] No `definitions` in the answer at all, as from an older server: V7.
- [x] A double press while signing: C8 (one signature, one post).

## Test infrastructure

- **Runners:** the Node gate (`test/registry.js`; the suite exports `run()`) and Playwright, chromium.
- **SAFETY.** Nothing in these tests may reach a relay (ADR 0002 § Consequences; OPEN.md rows
  `2026-09-27-test-fixture-taggings-on-prod-relays` and `2026-09-30-npm-test-step-leaks-fixtures`).
  - **The Node suite imports no file that can publish.** The O-class passes fake `applyTagging` and
    `withdrawTaggings`.
  - **Every Playwright test:**
    - mocks `/api/publish-policy` as `{ allowExternalPublish: false }` (the gate fails open);
    - routes every WebSocket to a handler that closes it and counts it, and asserts the count ends at 0;
    - mocks `/api/strfry/publish`, recording each posted event.

    `window.nostr` is an `addInitScript` stub with fake signatures.
  - **Never run the full `npm test` on the Mac Studio.** Run single suites through `run()`, or the network-isolated
    CI reproduction in OPEN.md row `2026-09-30-npm-test-step-leaks-fixtures`.
- **Seams the tests define,** beyond the ADR's names:
  - `searchCandidates({ query, hits, exact, rows })`, where `exact` is `{ pubkey, profile }` or null, and `profile` is
    as `fetchProfilesChunked` answers. It returns cards `{ pubkey, name, initial, nip05, url }`.
  - `rowActions(row, definitions)` returns `null` for the untagged Local row, else
    `{ change: { toKey, label, enabled, reason } | null, remove: { label } }`.
  - `withdrawalOf(row)` returns `{ ids, addresses, subject }`.
  - `tagAvailability(definitions)` returns `{ brainstorm: { enabled, reason }, tapestry: { … } }`, with `reason` null
    when enabled.
  - The orchestration functions:
    - `tagProfile({ target, tagKey, definitions, deps })`;
    - `changeTag({ row, toKey, definitions, deps })`;
    - `removeTags({ row, deps })`.

    `deps` is `{ relays, applyTagging, withdrawTaggings }`, each publisher resolving `{ signed, result }` or throwing.
    Each function resolves `{ reports, refused? }`, with reports in `describeTaggingPublish`'s shape.
  - **`assistantActions.js` must load in Node.** The page passes the publishers in, and S3 checks that no
    top-level import reaches `publishProfileTag` or `nostrPublish`. `publishProfileTag.js`'s own imports have no
    `.js` extension, so Node can't load it. The withdrawal event's shape is therefore pinned in the browser (C5, C6).
- **The markup contract the browser tests add** (story 1's still holds):
  - the search input has placeholder `Search by name, NIP-05, URL or npub`;
  - the results are a list named **"Profiles you can tag"**, one listitem per profile, each with buttons named
    `Tag: My Brainstorm Assistant` and `Tag: My Tapestry Assistant`;
  - a row's toggle is the one element in the row with `aria-expanded`;
  - the panel buttons are named as in § Copy, and a busy button takes the § Copy busy word as its name.

## How to run

```
node -e "const m=require('./test/my-assistants-actions.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
node -e "const m=require('./test/my-assistants-page.test.js'); Promise.resolve(m.run()).then(r=>process.exit(r.fail?1:0))"
npx playwright test tests/brainstorm/my-assistants-actions.spec.js tests/brainstorm/my-assistants.spec.js --project=chromium
```

The Playwright run takes `BRAINSTORM_BASE_URL`, pointing at a `vite preview` of a build, or at `:7778` after
`/cycle-local`. Everything is mocked, so the server behind it doesn't matter.

## Verification

### The new tests fail on the current code

Confirmed 2026-09-30 at `1c1d7d20`.

**Node `my-assistants-actions`:** `26 failed, 1 passed`. Each failure names what is missing:
- `…authors should both be identification-tags' my-tapestry-assistant author; got [["brainstorm",null],…]`;
- `…does not export definitionAddress`;
- `…the row should carry retract.tapestry`;
- `…does not export definitionsFrom`;
- `expected a definitions scan with authors [Nous] and a #d filter`;
- `…does not export parseExactKey` (and the other view-model functions);
- `…assistantActions.js does not exist`;
- `…should export publishTaggingWithdrawalWithReport`.

The one pass is U3: signed out, the answer is unchanged.

**Playwright,** against `:7778` running story 1's build: `13 failed, 1 passed`.
- Every action test fails at the first thing that doesn't exist: the search box, a row toggle, or an action button.
- C1 and C3 first failed for a fault in the test itself (they expected one row too many). That was corrected before
  the oracle run.
- C1b (signed out: no search box) passes before and after.

### The tests can pass

The oracle is a throwaway implementation of ADR 0002 in a scratchpad mirror of `1c1d7d20`, never committed. On it:
- **Node:** `my-assistants-actions` 27/27; `my-assistants-page` 50 passed, 2 skipped (the H-class, with no stack
  pointed at).
- **Playwright:** both specs `29 passed`, and `87 passed` under `--repeat-each=3`.

### The tests bite

Each mutant was applied to the oracle alone, and each fails the tests named:

| Mutant | Fails |
|---|---|
| `retract` lists only the newest event | R1 |
| `definitionsFrom` accepts any author | R4 |
| no definitions read | U1, U2 |
| availability ignores `found` | V7, O7 |
| the withdrawal covers only the first tag | V8, O5 |
| search keeps listed profiles | V3 |
| a change withdraws even when its apply reached no relay | O3 |
| an apply skips the availability check | O7 |
| the refresh shows the loading line | C12 |
| the panel's actions aren't disabled while busy | C8 |
| a refusal isn't shown | C9 (both) |
| a failed report isn't shown | C10, C11 |
| a change withdraws before applying | C5 |
| a pasted key is ignored | C2 |
| search from 1 character | C1 (after the fix below) |
| no refresh after a press | C3, C5, C6, C8, C11, C12 |

"Search from 1 character" at first passed C1: the mock had no results for one letter, so nothing showed either way.
C1 now gives a 1-character fixture, and asserts that no search is asked for and no no-match line shows. It catches
that mutant, and the unmutated oracle still passes C1.

## Amendment after review 1 (2026-09-30), for ADR 0002 Amendment 1

Review 1 (`engineering-team/reviews/my-assistants/2-tag-and-untag-from-the-page.md`) found two blocking gaps:
- withdrawals don't travel between instances;
- no test covers the withdrawal's signer guard.

It also found several non-blocking ones. The owner chose to make deletions travel, and ADR 0002 Amendment 1 says how.
The tests below pin what this phase can see in the browser and in Node. The router stream (sub-decision 12) is ops,
and is proven on staging per the book's § Before shipping.

| Ask | Tests | File |
|---|---|---|
| Blocking 2: the withdrawal's signer guard | C9 now runs **Tag, Change and Remove** each with no extension and with the wrong key: nothing signed (`window.__signed` empty), nothing posted, the app's words shown, the row unchanged | spec |
| Sub-decision 11: withdrawals reach the community relay | C13 (after Tag, `wss://dcosl.brainstorm.world` is not in the result area; after Remove, it is listed once) | spec |
| Sub-decision 13: the failed re-read | C14 (re-read 500 after a press: rows kept, the press's report shown, the refresh note shown, no error line) | spec |
| Sub-decision 13: Searching…, no stale result | C15 (held search: **Searching…** shown, no results, no no-match line; a changed query never shows the previous results, sampled every 100 ms while the new search is held) | spec |
| Sub-decision 13: the result area | C16 (exactly one `role="status"` region in the ready page before any press; after a press it holds the report and has focus) | spec |
| Sub-decision 13: reasons tied to buttons | C7 (the disabled Tag and Change-to buttons have the reason as their accessible description) | spec |
| Sub-decision 13: open state | C17 (a row removed while open comes back closed when re-tagged) | spec |
| Sub-decision 13: slugs from the definition | O8 (the apply's slug and author come from the definition's address; no slug literal in `assistantActions.js`) | Node |
| Review tidiness | C1b asserts no sockets; C9 checks signatures as well as posts; S1 also scans `AssistantRow.jsx` and `AssistantSearch.jsx` | both |

The spec's mock gained a `searchHold` option, to hold a query's search answer.

**On `67563473`** (the reviewed implementation, served at `:7778`):
- **Node:** 27 passed, 1 failed. O8 fails: `got {"slug":"my-tapestry-assistant",…}`, the re-typed slug.
- **Playwright:** 18 passed, 5 failed.
  - C7: accessible description `""`.
  - C13: `the withdrawal lists the community relay`, expected 1, received 0.
  - C15: **Searching…** not found.
  - C16: status regions before a press, expected 1, received 0.
  - C17: `aria-expanded`, expected "false", received "true".
- **Already passing, as regression pins:**
  - C9 for Change and Remove: the guard exists today. Review 1's mutant M1, which removes it, now fails them.
  - C14: the refresh note exists today. Review 1's M2 now fails it.

**An oracle was not built for this amendment.** The changes are small and UI-local, and Phase 4 comes next in the
same session. The implementation's own run is the proof that the tests can pass. The next review re-runs mutants.
