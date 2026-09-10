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
*(Light profile — the test plan lives here. Suite: `test/dlist-browse.test.js`, CJS `run()` →
`{pass,fail,skipped}`, registered in `test/test.js` as `dlist-browse`. No stack dependency:
U* exercise `ui/src/utils/dlistFields.js` via dynamic ESM `import()` against inline fixture
events mirroring the live `github-accounts` header + items; S* are source-structure sentinels
on the new components/pages/routes/styles; R* are regression sentinels on files the Design
note promises not to touch.)*

**Legend.** U = behavioral unit test of the pure util (fails now: module missing → counted as
fail, not skip). S = structure sentinel on new UI source (fails now: file missing). R =
regression sentinel on untouched files (passes now and after; fails only on collateral damage).

- AC-1 → U1 (`parseListRef` coord/id/naddr), U3 (`headerNames` singular/plural/description),
  S3 (paste box → `parseListRef` → navigate), S4 (header resolved by `kind`+`authors`+`#d` /
  `ids`), S5 (`/list/:ref` route). Author display is the Avatar/useProfiles path (S4).
- AC-2 → U2 (`headerCoord` = the `#z` key), S1 (one `DListItemRow` per item; `profiles`/
  `voteCounts` are props), S2 (Avatar + `/user/<pubkey>` link + `created_at` age), S4 (`#z`
  scan of kinds 9999/39999, `useProfiles`, mounts `DListItemsTable`).
- AC-3 → U4 (one column per declared field, required→recommended→optional in header order,
  `allowed` = optional), U7 (`missing` only when required and absent; optional absent ≠
  missing), U12 (bare `["required"]` declares no nameless column), S1 (`is-required` + `*`
  headers from `fieldDecls`), S2 (`bs-dlist-missing` "missing" span), S6 (styles present).
- AC-4 → U4 (type from `field-type`, default `text`), U9 (`githubProfileUrl` link shape), U10
  (unknown/absent type → text, github-* type links by type under any name), U7 (href on the
  `github-username` cell), S2 (`target=_blank rel=noreferrer`).
- AC-5 → S4 (`queryRelayBounded`, `limit: 50`, "showing N of M" from `{count,total,truncated}`,
  `total === null` → "unknown", `until` paging), R4 (`relay.js` still returns `total` null-when-
  unknown — the contract AC-5 leans on).
- AC-6 → S3 (`queryRelay` over kinds 9998 + 39998, `/api/dlists/item-counts`, per-header link to
  `/list/<encodeURIComponent(ref)>`, `headerNames`), S5 (`/lists` route beside `/tags`,`/pins`).
- AC-7 → U1 (malformed / non-list refs → `null`, never throw), U12 (tagless/short-tag events
  never throw), S4 ("not on this relay" message + a catch around the header/items lookup).
- AC-8 → U11 (`reactionPolarity` mirrors `DListItems.jsx:32-40`), S2 (read-only vote cell, no
  publish path), S4 (one batched `kinds:[7]` + `#e` scan per page), R1 (operator page's own
  `isUpvote`/`isDownvote` and per-item fan-out untouched).
- E1 *(not derivable from any AC)* → U5 (+ U4, which forces `field-type` to be read at all).
- E2 *(not derivable)* → U6.
- E3 *(not derivable)* → U8, S2 ("+N more").
- E4 → U9, U7 (empty string → no href).
- E5 → U3.
- E6 → S4 (`until` = oldest `created_at`, id de-dupe). *Behavioral paging is not unit-testable
  without React; browser verification at Gate B.*
- E7 → U1, U2 (9998 header → `id`), S4 (`useParams` + `parseListRef`; empty result → AC-7 state).
- E8 → S3 (catch on item-counts; `—` not `0`; index still lists headers). R3 (operator index's
  own item-counts read unchanged).
- E9 → S4 (≥ 2 catch sites: header/items scan and the kind-7 scan; rows still render).
- Design-note structure → S1 (table knows no routes/fetching; `renderExtra` slot), S3/S4
  (`TopBar` + `bsp-page`, no operator `Layout` chain), S6 (no 64-hex literal in new files),
  R2 (`NewDListItem` keeps its own reader), R5 (`/tags`, `/pins` intact).

**External-dependency error paths** (J2 rule 2):
- `/api/strfry/scan` via `queryRelay` (header lookup, index scan, kind-7 batch) → covered: S4
  catch sites + AC-7 message; S3 catch. Empty result vs thrown error both land in the AC-7 state.
- `/api/strfry/scan` via `queryRelayBounded` (items page) → covered: S4 (`truncated`/`total`
  null handling + catch); R4 pins the contract.
- `/api/dlists/item-counts` → covered: S3 (E8).
- kind-7 scan → covered: S4 (E9).
- `/api/profiles` (through `useProfiles`) → **not covered**: the hook's own failure/fallback
  behavior is tested where it lives and the page only consumes its result (story file
  "Not covered").

**Guard-suite carve-out:** the story's scoped gate also runs
`test/strfry-write-assertion-bracket.test.js`; Phase 4 must not edit that suite.

**Pre-implementation run (2026-09-09):**
- `dlist-browse`: **5 pass / 18 fail / 0 skipped** — R1–R5 pass; U1–U12 fail on
  "`ui/src/utils/dlistFields.js` must exist and be importable as ESM"; S1–S4 fail on the
  component/page file missing; S5 fails on "Lists page imported"; S6 on ".bs-dlist-missing
  style exists". All failures are the intended reason (missing implementation), none are
  import/typo errors.
- Assertion spot-check against a naive scratch stub (header-order decls, no grouping, no
  github link, no `missing`, `(unnamed)` fallback): **11 of 12 U tests still fail** (U4 on
  ordering, U7 on href/missing, U3 on description/fallbacks, U1 on naddr, …); only U5 passes
  vacuously because the stub ignores `field-type` — U4 closes that gap.
- Guard suite `strfry-write-assertion-bracket`: **6 pass / 0 fail** with
  `BRAINSTORM_BASE_URL=http://localhost:8778` (its default is `:7778`; on this host the panel
  is `:8778`, so the scoped gate must set that env var — without it: 4 pass / 2 fail on
  "could not resolve the runtime TA pubkey via GET /api/assistant/pubkey").

## Linked artifacts
- ADR: none expected (no irreversibility trigger; a Design note suffices)
- Test suite: `test/dlist-browse.test.js` (the story's scoped gate — proposed)
- Review: `engineering-team/reviews/dlist-item-tagging/1-browse-a-dlist-with-header-driven-fields.md`

Link by path only — never record verdicts or round history in this file.

## Deviations *(Implementer, 2026-09-09 — small judgment calls; none breaks the Design note)*
- **No nav link added for `/lists`.** There is no shared user-facing nav list that carries
  `/tags` and `/pins` together: `TopBar`'s default nav is `About` only; `/tags` is reached from
  `Pins.jsx` ("Browse tags →") and `Tag.jsx`'s breadcrumb; `/pins` from `BrainstormUserMenu`'s
  footer and `BrainstormSettings`. Adding a link would mean editing a file outside the blast
  radius (`avatarMenuLinks.js` / `BrainstormUserMenu.jsx` / `TopBar.jsx`), so it is left for the
  reviewer to decide — `/lists` is reachable by URL and from every `/list/:ref` page's
  "← All lists" breadcrumb.
- **`parseFieldDecls` returns `{ name, requirement, type }`** — the Design note's `description`
  key is omitted because no header tag defines a per-field description; adding a `null` key
  would have been invention.
- **Page size is the literal `limit: 50`** in `List.jsx` (twice) rather than a named constant:
  sentinel S4 matches the literal.
- **"Showing N of M" appends "(scan was bounded)"** when `truncated && total === null`, so
  "unknown" is explained rather than bare. `hasMore` = `truncated || items.length < total`.
- **Vote cell** shows `▲up ▼down` counts (read-only); on a failed kind-7 scan every cell shows
  `—` (E9) — the table receives an empty `voteCounts` map in that case.
- **`headerCoord` for a malformed 39998 header** (no `d` tag) returns `39998:<pk>:` rather than
  `null`, so the U12 null/string contract holds and a page never throws on it.
- Build output goes to the repo-root `dist/` (Vite `outDir`), which is what
  `bin/control-panel.js` serves; `dist/` is not part of the diff.
