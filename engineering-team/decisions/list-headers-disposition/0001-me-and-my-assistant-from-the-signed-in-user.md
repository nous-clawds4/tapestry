# ADR 0001: Me and My Local Tapestry Assistant resolve from the signed-in user, through two reserved selector values

**Status:** Accepted
**Date:** 2026-10-01
**Story:** `engineering-team/stories/list-headers-disposition/1-author-selector-me-and-my-assistant.md`

## Context

Story 1 adds two entries to the List Headers Author selector: **Me** (headers the signed-in account
signed) and **My Local Tapestry Assistant** (headers the Assistant this instance holds for that
account signed). It is read-only. Nothing is signed or published.

**The page today** (`ui/src/pages/lists/Index.jsx`):

- Rows come from one browser-side relay read, `queryRelay({ kinds: [9998, 39998] })` (`:68`). That
  is `GET /api/strfry/scan` (`ui/src/api/relay.js:12-22`). Filtering happens in the browser.
- The selector's value is a literal author pubkey, or `''` for **All authors** (`:279-286`). The
  entries come from the `authorOptions` memo (`:135-145`). It pins the Owner, Dave, and the Owner's
  Assistant (`useConfig().taPubkey`), then lists every other author found in the rows.
- `filteredRows` matches `r.author === authorFilter` (`:166-168`).

**Where "who is signed in, and their Assistant" already lives in the UI.** There are two sources.
Both get the Assistant from the same server function, `getAssistantPubkeyFor(sessionPubkey)`
(`src/utils/assistantKeys.js:99`). That function is the instance's single account-to-Assistant
mapping (author-scoped-inspection, ADR 0001).

1. **`useAuth().user`** (`ui/src/context/AuthContext.jsx:66-71`): `{ pubkey, classification,
   assistantPubkey, profile }`, or `null` when signed out. It is filled from
   `GET /api/auth/user-classification` (`src/api/auth/getUserClassification.js`), which returns
   `assistantPubkey: null` when there's no session. Ten surfaces read `user.assistantPubkey`
   today, including `DListCurationPanel.jsx`, the one place that already acts through the person's
   own Assistant.
2. **`useAssistantRoster().viewer`** (`ui/src/context/AssistantRosterContext.jsx`): `{
   accountPubkey, assistantPubkey }`, from `GET /api/assistant/roster`
   (`src/api/assistant/roster.js`). It was built to scope *views* by person ("Mine" on Active b-tags
   and the Concepts dictionary, through `scopeRosterFor` in `ui/src/utils/authorScope.js`).

Both sources tie identity to a verified login. `session.pubkey` is set only in
`finalizeAuthenticatedSession` (`src/middleware/auth.js:49-57`), after the signed challenge
verifies. So "signed in" can't mean a half-finished login.

**The constraint that matters most is the one this book exists for.** A non-Owner's **My Local
Tapestry Assistant** must never resolve to the Owner's Assistant (story AC 3). The page already
holds the Owner's Assistant pubkey as `TA_PUBKEY`. Writing `user.assistantPubkey || TA_PUBKEY` would
look like a harmless default and would reproduce exactly the flaw recorded in OPEN.md rows
`2026-10-01-concept-headers-disposition-owner-signer` and `2026-10-01-new-dlist-assistant-signer`.

**Concepts.** Only `39998:<TA>:list` is involved ("A list header with associated list items"; in
this machine's graph, `39998:11f23fe4…:list`). It is read, not changed. Its graph neighbours (the
concept-header and firmware-concept supersets) aren't touched. No concept, schema, or firmware
change is needed.

## Options considered

### Option A — `useAuth().user`, two reserved selector values, one pure resolver

- The two entries use **reserved values** that can't be pubkeys: `@me` and `@my-assistant`. They
  are never the pubkey itself.
- A pure module turns the signed-in user into the two entries, and turns the selected value into
  the pubkey to match. It returns nothing to match when the value can't be resolved.
- The page reads `useAuth()`. It leaves `authorOptions` and `authorDisplayName` alone and adds the
  two entries between **All authors** and them.

*Pros:*
- Uses the identity source that the acting surfaces already read. Stories 3 and 4 will show
  Disposition actions only on the signed-in person's own rows. Story 4 must also check that the
  browser signer's pubkey is the session's. Both checks then read the same `user` this story
  reads, so one identity source carries the whole epic.
- Reserved values never collide with the literal entries. For the Owner, **Me** and **👑 Owner** pick
  the same rows. With literal values they would be two `<option>`s with one value, and the
  selector would show whichever comes first, whatever the person picked.
- The resolver is pure, so the rule "no fallback to the Owner's Assistant" can be tested directly,
  and a mutant that adds the fallback fails.

*Cons:*
- A second "mine" source on the page, next to the roster that Active b-tags uses. They can't
  disagree on the answer (same server function), only on timing. Each loads independently.

### Option B — `useAssistantRoster().viewer`, same reserved values

Same shape, but `{ accountPubkey, assistantPubkey }` comes from the roster's `viewer`.

*Pros:* the same source as the existing "Mine" scopes. The provider is already mounted app-wide
(`App.jsx:551`).

*Cons:* the roster answers "whose events am I looking at", a *view* question. The rest of this epic
asks "whose signer may act", an *identity* question, which `useAuth` already answers for the
curation panel and the setup surfaces. With B, stories 3 and 4 would read signing eligibility from
a view helper, or this page would read two sources. The roster's "Mine" also merges account and
Assistant into one person (`personPubkeys`). This story keeps them apart on purpose: that's the
whole point of having two entries.

### Option C — literal pubkeys as the entries' values

The two entries carry `user.pubkey` and `user.assistantPubkey` as their `value`s, so
`filteredRows` stays as it is.

*Cons:* duplicate values for the Owner (above), so the selector can show the wrong label. And after
sign-out, a stale literal keeps filtering by the previous person's pubkey while showing a label
that no longer exists. Rejected.

## Decision

We chose **Option A**. The story is the first of four, and the later three are about who may act.
The identity source those three need is `useAuth().user`. Starting the epic on it means one source
of "me" from the selector through to the signer check. Reserved values are what make **Me** a
*relative* entry next to the absolute **👑 Owner** entry, as the story's out-of-scope note intends.

This extends author-scoped-inspection ADR 0002 and doesn't contradict it. That ADR's "Mine" merges
a person's account and Assistant. These two entries are the split it calls "the authorType axis
separates them on demand", offered here as two separate choices. `authorScope.js` is not changed.

## Consequences

- **Enables** stories 3 and 4. "Is this row mine, or my Assistant's?" becomes the same resolver,
  applied to a row's author instead of the selector's value. Story 3's ADR should add that
  predicate to this module, not write a second one.
- **Constrains** the page. **My Local Tapestry Assistant** resolves only to `user.assistantPubkey`.
  When that's `null`, the entry is disabled and resolves to nothing. It never falls back to
  `useConfig().taPubkey` or to any roster row. That holds even for the Owner: the Owner's
  `user.assistantPubkey` already *is* the Owner's Assistant, from the same server mapping, so no
  special case is needed and none may be added.
- **Loading.** Until `useAuth()` settles, the page treats the visitor as signed out: neither entry
  appears, and they appear when `user` arrives. This is the same thing that happens after an
  in-page sign-in.
- **Sign-out with an entry selected.** If the person signs out (or their Assistant goes away) while
  `@me` or `@my-assistant` is selected, the selection resets to **All authors**. The story doesn't
  require this, but without it the selector would show a blank label over an unfiltered table.
- **Unchanged:** `authorOptions` (including its existing memo dependencies), `authorDisplayName`,
  the Kind selector, the count line, and the empty message. AC 1 requires "today's entries, in
  today's order".
- **Debt.** None new. The page still pins the Owner's Assistant via `useConfig().taPubkey` as an
  *absolute* entry. That's correct for an absolute entry and isn't touched.
- **Firmware reinstall required?** No.

## Implementation notes

- **New file `ui/src/utils/viewerAuthorScope.js`.** Pure ESM, with no React, no fetch, and no
  module state, like `authorScope.js`, so the Node suite can `import()` it.
  - `export const ME = '@me'` and `export const MY_ASSISTANT = '@my-assistant'`.
  - `viewerAuthorOptions(user)` returns `[]` when `user` is falsy or `user.pubkey` isn't 64-hex.
    Otherwise it returns two entries:

    ```js
    [ { value: ME, label: 'Me', disabled: false },
      { value: MY_ASSISTANT,
        label: hasAssistant ? 'My Local Tapestry Assistant'
                            : 'My Local Tapestry Assistant (none on this instance)',
        disabled: !hasAssistant } ]
    ```

    Here `hasAssistant` means `user.assistantPubkey` is 64-hex.
  - `resolveAuthorFilter(value, user)` returns the pubkey to match, or `''` for "no author filter":
    - `ME` gives `user.pubkey`, or `''` when there's no valid one.
    - `MY_ASSISTANT` gives `user.assistantPubkey`, or `''` when there's no valid one.
    - `''` gives `''`.
    - Any other value is passed through unchanged: a literal pubkey from today's entries.

    The resolver **takes no Owner's-Assistant argument**. That makes the forbidden fallback
    impossible to write in it rather than merely unwritten.
- **`ui/src/pages/lists/Index.jsx`:**
  - `import { useAuth } from '../../context/AuthContext'` and the three exports above, then
    `const { user } = useAuth()`.
  - Author `<select>`: after `<option value="">All authors</option>`, render
    `viewerAuthorOptions(user)` as `<option key value disabled>`. Then render `authorOptions`
    exactly as now.
  - `filteredRows`: replace the `authorFilter` branch with
    `const authorPk = resolveAuthorFilter(authorFilter, user); if (authorPk) result = result.filter(r => r.author === authorPk);`
    and add `user` to the memo's dependencies.
  - One `useEffect` on `[authorFilter, user]`: when `authorFilter` is `ME` or `MY_ASSISTANT` and
    `resolveAuthorFilter` returns `''`, call `setAuthorFilter('')`.
  - No other edits to the page.
- **Seams for the Tester** (Phase 3 decides the suites):
  - In the browser, three endpoints decide everything: `GET /api/auth/status` and
    `GET /api/auth/user-classification` (the signed-in user, `assistantPubkey` included) and
    `GET /api/strfry/scan` (the rows). `/api/dlists/item-counts`, `/api/neo4j/event-uuids` and
    `/api/profiles` are incidental.
  - AC 6 (two people, two sessions) is two browser contexts with different classification
    answers over the same rows.
  - The no-fallback rule is a pure-module case: a non-Owner user with `assistantPubkey: null` and
    rows by the Owner's Assistant resolve to `''`, and the disabled entry can't be chosen.

## Out of scope

- The "is this row mine?" predicate for Disposition actions (story 3's ADR adds it to the new
  module).
- Any server change. Both endpoints this relies on exist and are unchanged.
- Reconciling `useAuth().user` and the roster's `viewer` into one source app-wide.
- Remembering the selection across visits (story 1, out of scope).

## Amendment 1 (2026-10-01, found in Test Design)

The reset after sign-out stays as decided. Its stated reason in § Consequences ("Sign-out with an entry
selected") was wrong. At sign-out, the browser already shows the first entry, **All authors**, over an
unfiltered table, because the resolver turns a reserved value with no user into `''`. A page without the reset
looks the same at that moment. The reset matters at the **next sign-in on the same page**. Without it, the stale
`@me` or `@my-assistant` value comes back with the entries and filters the table again, though nobody chose it.

Found when a no-reset mutant passed a sign-out-only check. The test plan's L9 now signs back in, and that
mutant fails it.
