# ADR 0002: The cards count with their own pure rule over the page's one Map read; names from the shared profile lookup

**Status:** Accepted
**Date:** 2026-10-07
**Story:** `engineering-team/stories/manage-treasure-map/2-the-assistants-by-category-cards.md`

## Context

Story 2 adds the **Assistants by category** cards to `/treasure-map` (built by story 1, ADR 0001) and three small
fixes from story 1's review. Its acceptance criteria, in short:

- **AC-1** — between the FAQ and the raw Treasure Map: the heading, three cards (Scores, Lists, Concepts) with their
  descriptions and who each is assigned to, and the "Mixed assignments…" line linking to `/treasure-map/advanced`. No
  edit controls. Hidden when signed out.
- **AC-2** — which Assistants a card counts: every Assistant the Map would ask for some insight in the category. The
  category's own entries (Score kinds 30380–30389; List kinds 30390–30399; Concept kinds 39998/39999, including bare
  `39998` and `39998:dlist-header`), its family-wide entries (`3038x…`, `3039x…`) and `*` (bare for all three; `*:…`
  for Scores and Lists only) all apply. A broad entry that a more specific entry covers completely doesn't count.
  Only the first-listed Assistant of each key counts. Valid 64-hex delegates only. The story's example table is the
  contract (book decision 9).
- **AC-3** — one Assistant: "Assigned to", avatar letter and name; several: up to three avatars, "Mixed · N
  Assistants"; none: "Not assigned yet". Names: display name, else name, else shortened npub. The viewer's own
  Assistant here has the purple avatar, others navy. Nothing wider than the column at 375 px.
- **AC-4** — loading line or error + Try again in place of the cards until the Map is read; never "Not assigned yet"
  before then. No Map at all: three "Not assigned yet".
- **AC-5** — the raw viewer starts closed for each viewer; hiding the FAQ closes its open answer; the raw JSON box is
  keyboard-focusable, named "Raw Treasure Map", and scrolls with the arrow keys.

**Concept Graph:** the stack wasn't running (AGENTS.md §2 fallback). The story reads kind 10040 and kind 0 events and
changes no concept. **Firmware reinstall: not required.**

Facts from the code this decision rests on:

- **The page already holds the Map.** `ui/src/pages/treasure-map/Index.jsx` (story 1) calls
  `useTreasureMap(viewer, { strict: true })` once and derives the panel's phase with `mapPanelPhase`
  (`ui/src/pages/treasure-map/manageTreasureMap.js`). The cards need the same event and the same phases.
- **The app's entry classifier can't express AC-2, by design.** `classifyEntry` (`ui/src/utils/treasureMap.js:31`)
  parses only `^\d{5}(:…)?$`, so `*`, `3038x` and `3039x` are `other`; and a **bare** `39998` is deliberately `other`
  ("a bare kind (no d-tag) stays `other`, as the story-2 pins require", dlist-curation ADR 0006). The TA Treasure Map
  page, the curation panels and `/assistants`' Duties tab (`treasureMapDuties`, `ui/src/pages/assistants/
  myAssistants.js:324`) all rely on that classification. The draft grammar (`protocols/drafts/treasure-maps.md` §4.2,
  §4.5, §6) is what gives `*`, the family wildcards, `*:<system>` and bare `39998` ("all of the observer's Concept
  headers") their meaning.
- **The Duties tab's conventions match AC-2 where they overlap:** an entry counts only with a 64-hex delegate
  (lowercased); a key's first valid delegate is Preferred, the rest Alternates.
- **Names and avatar letters already have one rule.** `cardFields(pubkey, found)` (`myAssistants.js:139`, not exported
  today) gives display name → name → `npubShort`, skipping non-text fields, and a whole-character `initial`
  (`Array.from`). It reads `fetchProfilesChunked`'s answer (`ui/src/utils/profileBatch.js:43`), which never throws: a
  failed batch marks its pubkeys `PROFILE_LOOKUP_FAILED`, which `cardFields` treats as "no profile".
- **The viewer's own Assistant here** is `useAuth().user.assistantPubkey` (`ui/src/context/AuthContext.jsx:69,167`),
  the same per-user value the treasure-map-user-assistant epic established (never the instance owner's `taPubkey`).
- **Story 1's state shape** (`Index.jsx`): `rawOpen` lives in `ManageTreasureMapPage`, so it survives sign-out and
  sign-in on the same page (review 1, non-blocking 1); the FAQ keeps its `open` index while hidden (non-blocking 2);
  the `<pre>` isn't focusable (non-blocking 4).
- **Blueprint measurements** (`blueprint/treasure-map-screen.html.txt`, the `tmbCats` cards; `treasure-map-logic.js
  .txt`, `av`): section column with 12 px gaps; heading 11 px, 700, `#8c929e`, uppercase, `.06em`; card radius 16,
  `1px solid #d6d9db`, white, `0 1px 3px rgba(0,0,0,.06)`, padding `16px 18px`; title 17 px 700; description 13 px
  `#6b7480`; "Assigned to" label as the heading; avatar 22 px circle, 11 px 700 white on `#7237ff` (local) or `#2b174f`,
  overlapping `-6px` with a `0 0 0 2px #fff` ring; name 14 px 600; "· N Assistants" 13 px `#6b7480`; the Mixed line
  13 px `#8c929e` with a 600 accent link.

## Options considered

### Option A — a pure category rule in the page's view-model, with its own key parser (chosen)

`manageTreasureMap.js` gains `categoryAssistants(event)`: it parses each tag's key by the draft grammar's kind slot
(exact kind / family wildcard / `*`), applies AC-2, and returns the Assistants per category. A second pure function
shapes the cards. The page feeds both from the Map it already holds.

- **Pros:** AC-2 lives in one Node-testable function whose cases are the story's example table. Nothing the TA page,
  curation or the Duties tab depends on changes. The Map is read once for the whole page.
- **Cons:** a second, narrow key parser beside `classifyEntry`. It's scoped to "which category does this key apply
  to", which `classifyEntry` doesn't answer.

### Option B — teach `classifyEntry` the wildcard grammar

Add `*`, `3038x`, `3039x` and bare-`39998` classes to `ui/src/utils/treasureMap.js`, then group as the Duties tab does.

- **Cons:** every caller's `other` bucket changes meaning: bare `39998` is pinned `other` by dlist-curation's tests, and
  the TA page lists `other` rows separately. The draft grammar isn't adopted (it's 📝 pre-NIP); widening the shared
  classifier makes the whole app speak it. Rejected for this story; it's the natural move when the draft is ratified.

### Option C — reuse `treasureMapDuties` (the Duties tab's duties)

- **Cons:** it drops exactly the entries AC-2 is about (wildcards, `*`, bare `39998`), and it has no notion of
  shadowing. Rejected.

### Name sub-options (AC-3)

- **N1 (chosen):** export `cardFields` from `myAssistants.js` as it is, and use its `name` and `initial`. One name rule
  for both design pages; no behaviour change on `/assistants`.
- **N2:** copy the three-line rule. Two copies of "display name, else name, else npub" can drift.

### When names show (AC-3, AC-4)

- **W1 (chosen):** the section stays on its loading line until the profile lookup for the counted Assistants has
  settled, as `/assistants` does for its rows, so cards appear once, already named. The lookup can't fail the section:
  a failed batch gives npub fallbacks.
- **W2:** show npubs first and swap in names as they land. Avoids one short wait, at the cost of every card's name
  changing in front of the reader.

## Decision

We chose **Option A, with N1 and W1**. It's the only option that implements AC-2's draft-grammar rule without
changing what the rest of the app means by a Treasure Map entry, and it keeps the rule where a Node suite can walk the
story's example table.

Sub-decisions:

1. **Key parsing** (in `manageTreasureMap.js`, module-private): a tag counts only if `tag[0]` is a string and `tag[1]`
   matches `/^[0-9a-f]{64}$/i` (lowercased, as the Duties tab does). Split `tag[0]` at the **first** colon into
   `slot` and `rest` (`rest` is `''` when there's no colon). `slot` is one of: a five-digit kind, `3038x`, `3039x`, or
   `*`. Anything else applies to no category.
2. **`categoryAssistants(event)` → `{ scores: string[], lists: string[], concepts: string[] }`** (pubkeys). For each
   category:
   - **applies:** Scores — kind 30380–30389, or slot `3038x`, or slot `*`. Lists — kind 30390–30399, or slot `3039x`,
     or slot `*`. Concepts — kind 39998 or 39999, or slot `*` with `rest === ''` (`*:…` never matches a Concept).
   - **shadowed (doesn't count):**
     - slot `*`, `rest === ''`: for Scores when a counted-valid key `3038x` (exactly) exists; for Lists when `3039x`
       exists; for Concepts when `39998` or `39998:dlist-header` exists;
     - slot `*`, `rest !== ''`: for Scores when `3038x` or `3038x:<rest>` exists; for Lists when `3039x` or
       `3039x:<rest>` exists.

     "Exists" means some tag with that exact key and a valid delegate.
   - **per key:** among the applicable, unshadowed tags, group by the full key `tag[0]`; each key contributes its
     **first** valid delegate, in Map order.
   - **result:** those delegates in the order the Map first names them, without repeats.

   No event, no tags, or garbage → three empty lists; never throws.
3. **`categoryCards({ assistants, profiles, localPubkey })` → three cards**, in the order Scores, Lists, Concepts:
   `{ key, title, description, state: 'single' | 'mixed' | 'none', people: [{ pubkey, name, initial, local }],
   count, avatars }`, where `people` is every counted Assistant via `cardFields(pubkey, profiles[pubkey])`, `local` is
   `pubkey === localPubkey` (and false when `localPubkey` is null), `avatars` is the first three of `people`, `count`
   is `people.length`, and `state` is `none` / `single` / `mixed` for 0 / 1 / ≥2. Titles and descriptions come from
   `COPY.categories`. Pure.
4. **`COPY` gains** (story § Copy): `categoriesHeading`, `categories` (three `{ title, description }`), `assignedTo`,
   `mixed` (`'Mixed'`), `mixedCount(n)` (`· N Assistants`), `notAssigned` (`'Not assigned yet'`), the Mixed line in
   three parts around its link (`mixedLineBefore`, `mixedLineLink`, `mixedLineAfter`, as story 1 split the placeholder
   line), and `rawBoxLabel` (`'Raw Treasure Map'`).
5. **The section** is a `CategoryCards` component in `ui/src/pages/treasure-map/Index.jsx`, rendered between `<Faq />`
   and the raw viewer, **only when the phase isn't `signed-out`**. It takes `phase`, `map`, `localPubkey`:
   - `loading` → the heading and the story 1 loading line (`role="status"`); `error` → the heading, the error line
     (`role="alert"`) and **Try again** calling `map.refresh`;
   - `found` or `none` → `categoryAssistants(map.event)` (`none` passes no event, so all three are empty); then, if any
     category has Assistants, one `fetchProfilesChunked` call on their union, with an `isCancelled` guard keyed on
     the event; while it's pending, the loading line (W1); then the three cards and the Mixed line;
   - each card: title and description on the left; on the right the "Assigned to" label with one avatar and the name,
     or the overlapping avatars, **Mixed** and `mixedCount(count)`; or, for `none`, **Not assigned yet** (no label, no
     avatar). The avatars are `aria-hidden`; the names are text. A mixed card lists every Assistant's name for screen
     readers (a visually-hidden list), since only initials show.
   - `localPubkey` is `user.assistantPubkey || null` from `useAuth()`. Never `taPubkey`, never a literal.
6. **Story 1's findings (AC-5):**
   - the raw viewer becomes a `RawViewer` component holding its own `open` state, keyed so it mounts closed for each
     viewer. *Amended twice: Amendment 1 keyed it on switches between two known people; Amendment 2 drops the key,
     since signing out (which unmounts it) is the only way the viewer can change on this page.*
   - `Faq`'s hide sets `open` back to `null`;
   - the `<pre>` gets `tabIndex={0}`, `role="region"` and `aria-label={COPY.rawBoxLabel}`, with a visible
     `:focus-visible` outline; the browser's own arrow-key scrolling of a focused scroll box does the rest.
7. **Styles:** a `.bsd-tm-cat*` block appended to story 1's `.bsd-tm-*` block in `ui/src/styles.css`, with the
   blueprint measurements above. The card's right side wraps under the left at narrow widths (`flex-wrap`, the left
   side `flex: 1 1 260px`); names use `overflow-wrap: anywhere` so a long name never widens the page.
8. **`myAssistants.js`:** `function cardFields` becomes `export function cardFields`. Nothing else in that file
   changes.

## Consequences

- **Enables:** the later Edit book can reuse `categoryAssistants` to show what an assignment would change, and the
  Advanced page can reuse the key parser.
- **Constrains:** two parsers now read 10040 keys. `classifyEntry` stays the app's classifier; the cards' parser
  answers only "which category does this key apply to". When the draft grammar is ratified, fold both into one (a
  follow-up, not this story).
- **The section waits for names** (W1): one `GET /api/profiles` round trip after the Map. It's bounded by the number of
  distinct Assistants, usually one to three.
- **`cardFields` is now a cross-page export** from `/assistants`' view-model. If a third page needs it, move it to a
  shared module.
- **Firmware reinstall required?** No.

## Implementation notes

- `ui/src/pages/treasure-map/manageTreasureMap.js` — sub-decisions 1–4. It may now import `cardFields` from
  `'../assistants/myAssistants.js'` (`.js`-suffixed, Node-loadable, as that module already is). It must stay free of
  React, `fetch`, signing and storage (story 1's V7).
- `ui/src/pages/treasure-map/Index.jsx` — sub-decisions 5–6. New imports: `fetchProfilesChunked` from
  `'../../utils/profileBatch'`, `useEffect`. The page still publishes, signs and stores nothing.
- `ui/src/pages/assistants/myAssistants.js:139` — sub-decision 8.
- `ui/src/styles.css` — sub-decision 7.
- **For the Tester (Phase 3):**
  - **Node, the rule:** `categoryAssistants` over every row of the story's example table, plus: invalid and uppercase
    delegates; a key whose first delegate is invalid and second valid (the valid one counts); `99999`, bare `30000`,
    `3040x`, `**`, empty keys; `*:tag` on Concepts; `*:tag` shadowed by `3038x:tag` but not by `3038x:dlist`; bare
    `39998` and `39999:<d>` counting for Concepts; one Assistant across several keys counted once; Map order kept;
    null / missing / malformed events.
  - **Node, the cards:** `categoryCards` states, `count`, three-avatar cap, `local` (including `localPubkey: null`),
    names via `cardFields` (display name, name, npub fallback, `PROFILE_LOOKUP_FAILED`), titles and descriptions;
    `COPY`'s new words exactly.
  - **Node, static:** `cardFields` is exported; the page imports `fetchProfilesChunked` and takes `localPubkey` from
    `user.assistantPubkey` (no `taPubkey`, no 64-hex literal); the `<pre>` has `tabIndex`, `role="region"` and the
    label.
  - **Playwright** (story 1's mocks, plus `/api/profiles` answering names): the section's place and heading; single,
    mixed (avatars, count, all names readable) and none cards from a Map fixture covering the example table's shapes;
    `none` Map → three "Not assigned yet"; loading held (Map, then names) → loading line, never "Not assigned yet";
    error → Try again → cards; signed out → no section; the local avatar purple and another navy (computed
    `background-color`); the Mixed line's link; 375 px with long names; AC-5 by driving `/api/auth/status` and the
    menu's Sign out (or switching the mocked session) and checking the raw viewer is closed, re-showing the FAQ with
    every answer closed, and focusing the raw box with Tab and scrolling it with the arrow keys.
  - **Must stay green:** all of `test/manage-treasure-map-page.test.js` and `tests/brainstorm/manage-treasure-map
    .spec.js` (story 1), and the `/assistants` suites (the `cardFields` export).

## Amendment 1 — the raw viewer resets on a switch between two known people, not on sign-in settling (2026-10-07; superseded by Amendment 2)

**Why.** Review 1 (blocking 1) found that `key={viewer}` closes the raw viewer when sign-in *settles*. While
`useAuth().loading` is true the page is in `loading` (story 1's `mapPanelPhase`), so the raw viewer is shown, and can be
opened, before the session's user exists; `viewer` is null then. When the user arrives, the key changes from the
placeholder to the pubkey, React remounts the viewer, and a viewer the person had opened snaps shut. That isn't a new
viewer, so it misreads AC-5, and it regressed story 1 (its viewer stayed open). It is also what made the browser runs
flaky under load.

**Decision.** The viewer resets in exactly two cases:

- **Sign-out.** No key is needed: signed out, the page renders the sign-in prompt in place of the raw viewer, so the
  component unmounts, and a later sign-in (as anyone) mounts it fresh, closed.
- **A switch from one known person to another** without passing through signed-out. The page keeps
  `{ viewer: <last known pubkey>, switches: <count> }` in state and, during render, when `viewer` is non-null and
  differs from the last known one, records it and adds one to `switches` **only if a previous known viewer existed**
  (React's "adjusting state while rendering" pattern, so no extra commit flashes the old viewer open). `RawViewer` is
  keyed on `switches`.

So `null → X` (sign-in settling, or a first sign-in) keeps the viewer as it is; `X → Y` remounts it closed; `X → null
→ X` unmounts and remounts it through the signed-out prompt.

**Tests (Phase 3).** A browser case holds `/api/auth/status`, opens the raw viewer while sign-in is settling, releases
it, and checks the viewer is still open once the session's user has arrived. It fails against the `key={viewer}` build.
C10 (sign out and back in → closed) stays as it is.

## Amendment 2 — the raw viewer resets only by unmounting on sign-out; no key (2026-10-07)

**Why.** Review 1's round 2 (blocking 1) found Amendment 1's mechanism contradicting its own rule. The last known viewer
was never forgotten on sign-out, so *X → signed out → Y* counted as a switch, and a raw viewer that Y opened while their
sign-in settled snapped shut. The round also found the case the counter exists for unreachable on this page:

- every way to sign in on `/treasure-map` (the page's own button, the top bar's) renders only while nobody is signed in;
- the session's user changes only when the page loads, after a sign-in, or on sign-out (`ui/src/context/AuthContext.jsx`:
  `checkStatus` on mount and after `runLogin`, `logout`). Nothing polls the session or follows other tabs, and
  `refreshUser` keeps the same pubkey.

So the viewer can't go from one known person to another without passing through signed-out.

**Decision.** `RawViewer` is rendered without a key. It resets in exactly one way: **signing out**, which replaces it with
the sign-in prompt and unmounts it; the next sign-in, as anyone, mounts it fresh and closed. Sign-in settling (`null →
X`, on page load or after a sign-in) keeps it as it is. The `{ viewer, switches }` state goes. **If a later change lets
the session switch people without a sign-out** (session polling, cross-tab sync, an account switcher), key the viewer on
the viewer then, and add a browser case for that switch.

**Tests (Phase 3).** A browser case signs in as one person, signs out, signs in as a second person with
`/api/auth/status` held, opens the raw viewer while that sign-in settles, releases it, and checks the viewer is still
open with the second person's Map. It fails against `84fad91`. C10 and C14 stay as they are.

## Out of scope

- Ratifying the draft grammar or changing `classifyEntry` (Option B), and folding the two parsers together.
- The Edit mode, the Advanced page's per-entry list, and the Try again relay-list bug
  (`ledger/2026-10-01-treasure-map-retry-skips-relay-list.md`).
- Marking which Assistants on a card are tagged as yours.
