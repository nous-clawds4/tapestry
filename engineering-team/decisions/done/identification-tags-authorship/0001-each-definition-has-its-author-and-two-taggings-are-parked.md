# ADR 0001: Each definition has its author, and two taggings are parked

**Status:** Accepted (approved 2026-09-22)
**Date:** 2026-09-22
**Story:** `engineering-team/stories/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md`
**Epic:** `identification-tags-authorship`

## Context

The previous book (`assistant-identification-tags`, ADR 0001 sub-decision 2) named all four canonical tag
definitions by one key, the owner's: `CANONICAL_TAG_AUTHOR` in `src/lib/identification-tags/index.js`,
`canonicalTagAddress(slug)`, and every entry's `address` derived from it. Three modules read that constant — the
attention check (`src/api/assistant/attention.js:187`, one definitions lookup for all four slugs), the
Assistant's publish route (`src/api/assistant/identificationTaggings.js:140,163`) and the page
(`ui/src/pages/assistant/IdentificationTags.jsx:193`, the `a` and `authorPubkey` of the first card's tagging) —
and the fixtures and six suites pin it.

The owner has now settled authorship differently (story § Background, verified on the relays 2026-09-22):
"My Tapestry Assistant" is `39999:15f7dafc…:my-tapestry-assistant` (Nous), "My Tapestry Owner" is
`39999:a73a2980…:my-tapestry-owner` (Nous' Tapestry Assistant), and "My Agent" and "My Human" are parked:
shown, greyed out, unchecked, uneditable, never issued, and not counted (story gate, all four decisions).

The reflex checks. *Who is this true for?* The two authors are constants of the list, true on every instance;
"present" stays per signer and target, read by name. *Where does the trust come from?* Nowhere new: the definition's
author matters only for what the new tagging points at (`a`, `e`); no author filters a read. *Could anyone else
publish their own version?* Yes, as before: a same-named tag by anyone still counts for "present"; only the page's
publish is bound to these two definitions. *What changes when the POV changes?* Nothing: the list is the same for
every viewer; the answer is about the viewer's own Assistant.

## Options considered

**A. One list, each entry carrying its definition's author and whether it is offered.** Every entry gains
`author` (a hex pubkey, or `null` when parked) and `offered` (boolean); `address` becomes
`39999:<author>:<slug>` or `null`. The single constant and `canonicalTagAddress` go away. The check, the route and
the page read the entry. Parked entries stay in the list so the page renders them from the one source, and
unparking one later is filling in its author.

**B. Keep the single canonical author and add an override map** (`{ 'my-tapestry-assistant': '15f7…', … }`)
plus a parked set. Rejected: two sources of truth for one fact per entry, and the "canonical author" would name a
key that authors nothing.

**C. Drop the parked entries from the list and let the page hardcode two greyed rows.** Rejected: the page would
carry list knowledge the server lacks, the order of the four would live in two places, and unparking would be two
edits in two files instead of one field.

## Decision

**Option A.** In detail:

1. **The list** (`src/lib/identification-tags/index.js`). `REQUIRED_TAGGINGS` keeps its name and its four entries
   in order (the previous book's callers and the S-class suites pin the name; it now reads "the taggings the page
   lists, offered or parked"). Each entry: `{ key, name, slug, signer, target, offered, author, address }`:
   - `my-tapestry-assistant`: `offered: true`, `author: '15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270'`;
   - `my-tapestry-owner`: `offered: true`, `author: 'a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528'`;
   - `my-agent`, `my-human`: `offered: false`, `author: null`, `address: null`.
   New exports: `OFFERED_TAGGINGS` (the frozen filter, in order) and `definitionAddress(entry)` (`39999:<author>:<slug>`
   or `null`). Removed: `CANONICAL_TAG_AUTHOR`, `canonicalTagAddress`. The two authors are constants of the list
   in the sense the epic's guardrail gives: literal keys, the same on every instance, never the runtime TA.
2. **The check** (`attention.js`). The plan runs over `OFFERED_TAGGINGS`. Definitions are looked up per author:
   group the offered entries by `author`, one `lookupByAddresses({ kind: 39999, author, ds: [slugs…], relays })`
   per author, in the same `Promise.all` as the signer lookups (today two authors, one slug each). `entries` and
   `evaluateIdentificationTags` are fed the offered entries only, so the answer's `taggings` carries one row per
   offered tagging, the row's `definition.address` is the entry's, and `finished`, `done` and `pending` are over the
   offered taggings. No row for a parked tagging. The hub, the pill and the provider change nothing: they read
   `done` and `pending`.
3. **The page** (`IdentificationTags.jsx`, `identificationTagsCopy.js`, `styles.css`). `rowState(entry, …)` answers
   `{ state: 'parked', reason: null, definitionKnown: false }` first whenever `entry.offered === false`, before it
   looks at the phase or the answer. `rowText` gives `COPY.states.parked`, the words "Not offered yet". A parked row
   renders its checkbox unchecked and disabled (never in `checked`, which is rebuilt from `state === 'missing' &&
   definitionKnown` as today), under the class `is-parked`, which greys the whole row (`opacity: .55`, the name
   included). `cardState(rows)` considers non-parked rows only: a card whose one offered row is present reads
   `done`; a card whose non-parked rows are all `unknown` reads `unknown`. The first card's publish passes
   `authorPubkey: entry.author` (the answer row's `definition.eventId` as today); the publish sets already exclude
   parked rows because they are never `missing`.
4. **The route** (`identificationTaggings.js`). `ASSISTANT_ENTRIES = OFFERED_TAGGINGS.filter(signer === 'assistant')`,
   so a parked key fails the existing key check and the request is refused 400 `not-an-assistant-tagging` with the
   existing words, before any key is read (story AC-5; nothing new to write for it). Definitions are looked up per
   entry at `entry.author`; `buildAssistantTagging` gets `authorPubkey: entry.author`.
5. **The documents.** BIBLE §11's two rows and the §14 bullet say what is true: the check covers the offered
   taggings (today "My Tapestry Assistant" and "My Tapestry Owner"; "My Agent" and "My Human" are listed but
   parked), and the Assistant signs its offered identification tagging(s) of the person (today "My Tapestry Owner"),
   each against the definition its author published, not "two" and not "the canonical definitions" of one key. The
   OpenAPI descriptions of both routes and the `keys` description likewise. "Last updated" moves.
6. **Nothing else.** The tagging wire format, the browser publisher, the two z stamps (the ADR-0015 legacy literal
   and the runtime local z), the tag-federation relays and the reading of "present" are untouched.

## Implementation notes

- The removal in sub-decision 1 is a universal claim; its proving command, to run after the change:
  `grep -rn "CANONICAL_TAG_AUTHOR\|canonicalTagAddress" src ui/src test tests` must print nothing.
- Grouping by author in sub-decision 2 keeps `lookupByAddresses`'s one-author signature; with two offered entries
  by two authors that is two definition lookups plus the two signer lookups, all in one `Promise.all`. On a local
  miss each reads every tag-federation relay once, so the worst case is four reads per relay per page load (the
  previous book's three). Ledger `2026-09-22-strict-lookup-third-copy` already carries the batching cleanup.
- The page never needs the author of a parked entry; `definitionAddress` is for the server and the tests.
- Local verification without staging: the two definition events are public and signed; importing them into the
  local strfry (the relay's ordinary intake, not a publish on anyone's behalf) makes the offered rows read "Missing"
  with enabled boxes on this stack. Optional; every suite mocks the answer.

## Notes for Test Design

- **Re-aims for the Tester** (the previous book's suites pin the single author and the four-row answer):
  - `test/helpers/identificationTagsFixtures.js`: `REQUIRED` entries gain `offered`, `author`, `address`;
    `CANONICAL_TAG_AUTHOR`/`_NPUB`/`canonicalTagAddress` become the two authors and `definitionAddress`; the canned
    answers (`DONE`, `PENDING`, `UNFINISHED`, `MISSING_ALL`, `TAG_NOT_FOUND`) carry the two offered rows only, with
    "My Tapestry Owner" as the missing one in `PENDING` and "My Tapestry Assistant" as the not-found one in
    `TAG_NOT_FOUND`.
  - `test/assistant-attention.test.js`: L2 (authors and addresses per entry), L3 (the list with the new fields),
    the U-cases that use `my-agent`/`my-human` as their sample tagging (they become offered slugs), the "four
    rows" assertions (two), U11's read bound (four lookups), and the definitions-lookup assertions (per author).
  - `test/assistant-identification-tags-page.test.js`: the C-cases sampling `my-agent` rows; a new C-case for the
    parked state (any phase, any answer); S1's allowed-imports list (`CANONICAL_TAG_AUTHOR` → none; the page reads
    `entry.author`); S5 gains `.is-parked`.
  - `test/assistant-taggings-publish.test.js`: every `my-human` request becomes `my-tapestry-owner`; a new E-case
    pins that `my-human` (alone, and beside `my-tapestry-owner`) is refused 400 before `getAssistantKeys` is called
    and nothing is published for either; the definitions-scan assertion looks for `entry.author`.
  - The three browser specs: mocked answers with two rows; the row and checkbox counts (four rows, two boxes enabled
    at most, two parked boxes disabled and unchecked, greyed); the publish cases naming `my-human`; the hub specs'
    `PENDING` mock (content only).
- **New behaviour to pin:** the parked row's state, words, class and disabled unchecked box in every phase; the
  card's `done` with a present offered row beside a parked one; the first card's tagging `a`/`e` against Nous'
  definition; the route's tagging `a`/`e` against the Assistant-authored definition; the answer's `taggings` length
  and keys; the BIBLE/OpenAPI wording (an S-class grep for "two identification taggings" printing nothing).
- **Live H-class:** the anonymous POST stays 401; a signed-in POST naming `my-human` answers 400.

## Consequences

- **Enables:** the two-way handshake works on production for Nous today (both taggings already exist by name);
  unparking "My Agent" or "My Human" later is filling in `offered: true` and an author (and its definition
  existing), no server or page change.
- **Constrains:** the list is the only home of the authors; a definition republished under a new key means editing
  the list. The name `REQUIRED_TAGGINGS` now covers parked entries too (kept for the callers and the suites; a
  rename is a later tidy).
- **Latency:** unchanged when everything is local; on a miss, up to four outside reads per relay instead of three.
- **Firmware reinstall required?** No.
- **Debt this ADR notices and does not fix:** the previous book's carry-forward #1 (the owner publishes the
  definitions) is half done and half parked; the `protocols/` note is still unwritten; the batching of outside
  reads (ledger `2026-09-22-strict-lookup-third-copy`).

## Out of scope

- Deciding or authoring "My Agent" and "My Human".
- Reading or showing a parked tagging's state.
- Renaming `REQUIRED_TAGGINGS`; the `protocols/` note; anything else in the previous book's register.
