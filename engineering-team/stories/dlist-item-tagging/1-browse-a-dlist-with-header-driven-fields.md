# Story 1: Browse a DList with header-driven item fields

**Status:** Approved
**Created:** 2026-09-09
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-09-09 —
user-facing surface (not the operator browser); vote publishing out of the book; the
`github-account` firmware concept queued after story 2; Design note, not ADR; page size 50.
Scoped gate:
`node -e "require('./test/dlist-browse.test.js').run().then(r=>process.exit(r.fail?1:0))"`
plus the guard suite
`node -e "require('./test/strfry-write-assertion-bracket.test.js').run().then(r=>process.exit(r.fail?1:0))"`;
the new suite is also registered in `test/test.js` for the full-suite gate.)*

## Background
The book (`audits/dlist-item-tagging/book.md`) tags the items of Decentralized Lists, starting
with `39998:b83a28b7…:github-accounts`. Before an item can be tagged it has to be *found and
read* in the app. Today the only DList surface is the operator-side raw browser under
`/tapestry/lists`: it lists every header on local strfry, shows items in a fixed column set, and
never consults the header's field declarations — while the item *authoring* form does (it builds
its inputs from the header's `required` / `optional` / `recommended` tags). The read side has to
catch up: a list header is self-describing, and the app should render items from that
description so any list — not just the one we care about this month — reads correctly.

Live facts about the target list (relay probes, 2026-09-09): the header declares
`["required","github-username"]` and `["field-type","github-username","text"]`; its 7 items carry
their fields as top-level tags (`["github-username","vcavallo"]`, `["description","…"]`) with
empty content, authored by 4 different pubkeys. Membership is by `z` tag (`#z` = the header's
coordinate). Any pubkey may add an item — which is why item authorship must be visible.

## User-facing description
As a signed-in user, I want to open a Decentralized List in the app — from a list of lists or by
pasting its coordinate — and read its items rendered by the fields the list itself declares, so
that I can see what is on the list (and who put it there) before deciding what to tag.

## Acceptance criteria
- [ ] AC-1: Given a DList header coordinate `39998:<pubkey>:<d>` present on local strfry, when
      the user navigates to that list in the app, then the page shows the header's singular and
      plural names, its description, and its author.
- [ ] AC-2: Given the same list, the page shows its items — every kind-39999 event whose `z` tag
      equals the header's coordinate — one row per item, each row showing the item's author
      (avatar / name where a profile is known) and age.
- [ ] AC-3: Given a header that declares fields (`required`, `optional`, `recommended` tags),
      when items are rendered, then there is one column per declared field, in header order,
      required fields visibly distinguished from optional/recommended ones, and an item missing a
      required field shows an explicit "missing" mark rather than a blank.
- [ ] AC-4: Given a header that declares a field whose `field-type` is unknown or absent, the
      field still renders as text; a field named `github-username` (or whose `field-type` is a
      GitHub-username type) renders as a link to `https://github.com/<value>`.
- [ ] AC-5: Given a list with more items than one page shows, the page shows a bounded first
      page with a "showing N of M" count and a way to reach the next page; the total is stated as
      unknown (not zero) when the relay scan was bounded.
- [ ] AC-6: Given the app's list index, when the user opens it, then the `github-accounts` list
      (and every other 39998 header on local strfry) is reachable from it, with its name and item
      count.
- [ ] AC-7: Given a coordinate whose header is not on local strfry, the page says so plainly and
      does not crash.
- [ ] AC-8: Existing up/down (kind-7) counts on items remain visible where they were.

## Concepts touched
*(Handles composed from the runtime TA pubkey — never hardcoded.)*
- `39998:<TA>:nostr-kind` — element `kind-39999` (DList Item); `kind-39998` (DList header).
- `39998:<TA>:nostr-relay` — set `dlist-relays` (where lists live; local strfry first).
- Spec: `protocols/nips/decentralized-lists.md` (header field declarations, `z` membership),
  `protocols/drafts/decentralized-lists-compat.md` (`item-kind`, additive declarations).

## Out of scope
- Tagging an item (story 2), the tag page's Items view (story 3), pins/TLs (story 4).
- Publishing votes (book-level Gate-A decision).
- Creating or editing lists/items (the existing `/tapestry/lists/new` forms stay as they are).
- Fetching lists from external relays; local strfry is the source (the `dcosl` router stream
  already mirrors list events in).
- Neo4j import of list events.

## Open questions *(resolved at Gate A, 2026-09-09)*
1. **Where does this live?** Two candidates: (a) grow the operator-side `/tapestry/lists` browser
   in place; (b) a new user-facing Lists surface next to `/tags` and `/pins` (the Brainstorm app
   side, where the tagging affordances already are). **Decided: (b)** — the tagging UX
   in stories 2–4 lives on that side, and the `/tapestry/lists` browser is an operator tool with
   Neo4j import buttons the ordinary user shouldn't meet. Reuse its fetch pattern; don't fork
   its pages.
2. **Votes.** curate-psi's votes are plain NIP-25 kind-7 `+`/`-` reactions; this app reads them
   but has no reaction publish path. **Decided: out of this book** (votes are orthogonal) — the tagging stance
   (apply/dispute polarity) is the app's endorse/dispute primitive, and a kind-7 publish path is
   a separate small story once the tagging loop is proven.
3. **Page size** — 50.
4. **Two field conventions.** DCoSL headers declare fields as `required`/`optional`/`recommended`
   tags and items carry them as flat top-level tags (the `github-accounts` shape). Tapestry
   firmware concepts instead carry a JSON schema and items carry a word-wrapper `json` payload.
   **Decided:** v1 renders from the DCoSL header tags (the target list's shape); the JSON
   schema path joins when/if the `github-account` firmware concept (epic candidate 6) lands.

## Design note *(Light profile — written after Gate A, ratified at Gate B)*
- **Chosen approach: a pure header/item util + a reusable items table + two thin user-facing
  pages.** New `ui/src/utils/dlistFields.js` (no React, dynamically importable by the test
  suite) exporting: `parseListRef(param)` → `{ kind, pubkey, d, coord }` for `39998:<pk>:<d>` /
  `9998:<pk>:<d>` (and `naddr1…` via `nip19.decode`) or `{ id }` for a 64-hex event id, else
  `null`; `headerCoord(header)`; `headerNames(header)` → `{ singular, plural, description }`
  from the `names` tag (plural falls back to singular; no `names` → `name` → `d`);
  `parseFieldDecls(header)` → ordered `[{ name, requirement:'required'|'recommended'|'optional',
  type, description }]` — order is required → recommended → optional, each group in header
  order (mirrors `NewDListItem.jsx:36-42`; `allowed` counts as optional per the DCoSL spec),
  `type` read from `["field-type", <name>, <type>]` and defaulting to `'text'`; a `field-type`
  for an undeclared name adds no column; `fieldCellModel(item, decl)` → `{ value, extra,
  missing, href }` where `value` is the first top-level tag `[<name>, v]`, `extra` counts
  further same-name tags, `missing = requirement==='required' && value==null`, and `href` is
  `githubProfileUrl(value)` when `decl.name === 'github-username'` or `decl.type` is one of
  `github-username|github-user|github` — `githubProfileUrl` returns
  `https://github.com/<value>` only for values matching `^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$`
  (optional leading `@` stripped), else `null` so the cell degrades to text; and
  `reactionPolarity(content)` → `+1|-1|0` (same `+`/`-`/emoji rules as `DListItems.jsx:32-40`,
  duplicated rather than exported from the operator page so that page stays untouched).
  New `ui/src/components/dlist/DListItemsTable.jsx` — props `{ items, fieldDecls, profiles,
  voteCounts, renderExtra }` — renders `<thead>` from `fieldDecls` (required headers carry
  class `is-required` and a `*`), then one `DListItemRow` per item (same folder): author
  (`components/Avatar` + display name from `useProfiles`, linked to `/user/<pubkey>`), age,
  one `<td>` per decl (missing → `<span class="bs-dlist-missing">missing</span>`, href → `<a
  target=_blank rel=noreferrer>`, `extra` → "+N more"), a read-only up/down cell, and a
  trailing `renderExtra(item)` slot — story 2 mounts its tagging affordance there and story 3
  mounts the whole table on the tag page with its own item set, so nothing here knows about
  routes or fetching. Pages: `ui/src/pages/Lists.jsx` at `/lists` (TopBar + `bsp-page`
  layout like `Tags.jsx`): `queryRelay({ kinds: [9998, 39998] })` + `/api/dlists/item-counts`
  (`counts[headerRef]`, `—` when absent), one row per header (names, author, count) linking to
  `/list/<encodeURIComponent(coord|id)>`, plus a paste box that runs `parseListRef` and
  navigates. `ui/src/pages/List.jsx` at `/list/:ref`: resolves the header with
  `queryRelay({ kinds:[kind], authors:[pubkey], '#d':[d] })` or `{ ids:[id] }` (the
  `DListDetail.jsx:32-42` pattern; empty result → the AC-7 "not on this relay" state),
  fetches the page with `queryRelayBounded({ kinds:[9999,39999], '#z':[coord], limit: 50 })`
  (kind-9998 headers use `'#e':[id]`), renders the "showing N of M" line from
  `{count,total,truncated}` with `total === null` printed as "unknown", and pages with
  `until = oldest created_at on the page` + client-side id de-dupe; vote counts come from one
  batched `queryRelay({ kinds:[7], '#e': pageItemIds })` per page folded through
  `reactionPolarity`. Two routes added to `ui/src/App.jsx` next to `/tags` and `/pins`;
  `bs-dlist-*` classes appended to `ui/src/styles.css`. No server change, no new dependency.
- **Rejected alternative: promote the operator browser.** Mount `pages/lists/DListItems.jsx`
  under a user-facing route and teach its fixed column set to read the header's declarations.
  Rejected because (a) Gate A placed the surface on the Brainstorm side and that page is
  wired to the operator `Layout`/`Breadcrumbs`/`useOutletContext` chain, Neo4j import actions
  and a per-item `queryRelay({kinds:[7],'#e':[id]})` fan-out (`DListItems.jsx:154`, one scan per
  item — 50 scans per page), and (b) stories 2–3 need the row rendering as a standalone
  component with an affordance slot, which a page-bound table cannot offer without the split
  anyway. The operator page is left byte-identical (AC-8 sentinel).
- **Second rejected alternative: a server endpoint `/api/dlists/:coord/items` that joins
  header, items, profiles and votes.** Rejected: it would be a fourth reader of the same
  strfry filters with its own bounding/total semantics, when `queryRelayBounded` already
  returns `{events,count,total,truncated,limit}` with `total` null-when-unknown — exactly the
  AC-5 contract — and the story's source is local strfry only.
- **Blast radius.** Modified: `ui/src/App.jsx` (two route entries + two imports),
  `ui/src/styles.css` (append-only), `test/test.js` (register `dlist-browse`). New:
  `ui/src/utils/dlistFields.js`, `ui/src/components/dlist/DListItemsTable.jsx`,
  `ui/src/components/dlist/DListItemRow.jsx`, `ui/src/pages/Lists.jsx`,
  `ui/src/pages/List.jsx`, `test/dlist-browse.test.js`. Consumers reused unchanged:
  `ui/src/api/relay.js` (`queryRelay`, `queryRelayBounded`), `ui/src/hooks/useProfiles.js`,
  `ui/src/components/Avatar.jsx`, `ui/src/components/TopBar.jsx`, `src/api/dlists/itemCounts.js`,
  `src/api/strfry/queries/scan.js`. Grep-verified non-consumers left untouched:
  `ui/src/pages/lists/DListItems.jsx`, `DListDetail.jsx`, `Index.jsx`, `NewDListItem.jsx`
  (keeps its own `required/optional/recommended` reader — not refactored onto the util this
  story), and — `grep -rn "field-type" ui/src src protocols` returns no code hits (only protocols/worksheet.md W17, logged for this story) — no existing code
  or spec reads the `field-type` tag, so the util is its first and only consumer.
- **Invariants / spec note.** Rendering is POV-agnostic by design: every kind-39999 with a
  matching `z` tag is shown with its author visible (principle 2); trust filtering of items is
  story 2+'s concern at read time. No TA-pubkey literal anywhere (`useConfig().taPubkey` is
  Avatar's own concern). The `field-type` header tag is a `github-accounts` convention that
  `protocols/nips/decentralized-lists.md` does not define — this story only *reads* it (not an
  irreversibility trigger); the PO should log it in `protocols/worksheet.md` so the convention
  gets a home before anything in this repo *writes* it. Origin-drift preflight: the branch is 2
  commits behind `origin/staging` (both harness/OPEN.md housekeeping, no `ui/` files) — safe.

## Edge cases & not-covered
- **E1** *(not derivable from any AC)*: a `["field-type", "avatar", "url"]` whose name is not
  declared `required`/`optional`/`recommended`/`allowed` → no column appears; the type
  declaration is ignored rather than inventing a field.
- **E2** *(not derivable)*: a name declared twice with different requirement levels
  (`required` and `optional`) → one column, `required` wins; no duplicate column.
- **E3** *(not derivable)*: an item carrying two `["github-username", …]` tags → the first
  value is the cell, with "+1 more"; the row is not duplicated.
- E4: a `github-username` value that is not a valid handle (`vcavallo/repo`,
  `https://github.com/x`, empty string) → plain text, no link; a leading `@` is stripped
  before linking.
- E5: `names` tag with only a singular element → plural = singular; no `names` at all →
  `name`, then the `d` tag, never "(unnamed)" for a list that has any of them.
- E6: next page uses `until = oldest created_at seen`; items sharing that timestamp arrive
  again and are de-duped by id, so no item is skipped or shown twice; the "showing N of M"
  line counts the accumulated distinct items.
- E7: `:ref` is a kind-9998 event id, an `naddr1…`, or a malformed coordinate (`39998:abc`)
  → the first two resolve; the third and any zero-result lookup render the AC-7 message —
  `parseListRef` returns `null` and the page never throws.
- E8: `/api/dlists/item-counts` fails or lacks a header → count cell shows `—`, not `0`; the
  index still lists the header.
- E9: the batched kind-7 scan fails → vote cells show `—`; the item rows still render.
- **Not covered:** visual layout and link-click behavior (browser verification at Gate B);
  profile-fetch failure and picture fallback (`useProfiles` / Avatar's own tested behavior);
  `/api/dlists/item-counts` freshness after a fresh import (its own validator cache);
  `naddr` relay hints (ignored — local strfry only); items imported from external relays
  (out of scope); the operator browser's own column set (sentinel only: file unchanged).

## AC→handle lines
—

## Linked artifacts
- ADR: none expected (no irreversibility trigger; a Design note suffices)
- Test suite: `test/dlist-browse.test.js` (the story's scoped gate — proposed)
- Review: `engineering-team/reviews/dlist-item-tagging/1-browse-a-dlist-with-header-driven-fields.md`

Link by path only — never record verdicts or round history in this file.
