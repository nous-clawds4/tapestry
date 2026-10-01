# ADR 0001: One session-scoped read lists your Assistants; the page renders it in the design's frame

**Status:** Accepted
**Date:** 2026-09-30
**Story:** `engineering-team/stories/my-assistants/1-the-my-assistants-page.md`

## Context

Story 1 adds `/assistants`, a **My Assistants** avatar-menu item, and a list with one row per profile
the signed-in person has tagged **My Brainstorm Assistant** or **My Tapestry Assistant**. The
person's own Assistant on this instance comes first with a **Local** badge, and is listed even when
untagged. The story reads only; it publishes nothing. The acceptance criteria that shape the design:

- **AC-3** is POV-exact. Only the viewer's own taggings count; it's their *latest* stance per (tag,
  profile), and only an apply. A tag of that name counts whoever authored its definition. Disputed
  and retracted taggings don't count. A tagging made elsewhere counts once it's on "the relays this
  app reads".
- **AC-4 / AC-5.** Names, URL and NIP-05 come from the profiles' kind 0. Rows are ordered Local
  first, then alphabetically by the name shown. The untagged Local row is marked and links to
  Identification Tags.
- **AC-6.** The page never claims "empty" while loading or after a failed read. Signed out, it asks
  the visitor to sign in.
- **AC-2.** `/assistants` survives a direct load on staging, and doesn't scroll sideways at 375 px.

**What the codebase already has:**

- **A tagging's shape** (`ui/src/utils/publishProfileTag.js:64-110`). A kind 39999 carrying:
  - `d` = `profile-tag-<slug>-<target8>-<signer8>`;
  - `p` = target, `a` = `39999:<definition author>:<slug>`, `e` = definition version;
  - the canonical `z` `39998:<LEGACY>:nostr-user-tag` (ADR 0015's named exception), plus the local
    `z`;
  - `polarity` (`≥ 0.5` apply, `≤ −0.5` dispute).

  Retracting one is a NIP-09 kind 5 by its signer (`ui/src/hooks/useProfileTags.js:150-164`,
  `revoke`).
- **"The relays this app reads" for taggings** is `federatedScan` (`src/api/profile-tags/index.js:131`):
  - this instance's strfry, joined with the operator's opt-in tag-federation relays
    (`aRelays.aTagFederationRelays`, empty by default, ADR tag-federation/0001);
  - deduplicated per replaceable address;
  - a failed remote leg reads as nothing; a failed local leg throws.

  Every tag page reads through it. The authored-taggings read, `handleAuthoredBy` (`:1316`), uses it
  with `{kinds:[39999], '#z':[NOSTR_USER_TAG_Z_TAG], authors:[<pubkey>]}`, then **drops every target
  outside the house POV's WoT**.
- **"Same-named counts, whoever authored it"** is the settled rule (ADR
  identification-tags-authorship/0001; `src/lib/identification-tags/index.js`). "My Tapestry
  Assistant" is slug `my-tapestry-assistant`, and its definition is Nous'
  (`15f7dafc…c7270`). "My Brainstorm Assistant" has no definition yet. Book decision 4: Nous
  authors it, in story 2.
- **The viewer's Assistant on this instance** is `getAssistantPubkeyFor(viewer)`
  (`src/utils/assistantKeys.js`), the instance's one main→delegate mapping. `/api/assistant/attention`
  and `/api/auth/user-classification` both use it. `src/api/assistant/attention.js:207-225` is the
  session-scoped pattern:
  - the viewer comes from `req.session` only, and no parameter can change whose state is read;
  - `{signedIn:false}` without a session, a 500 on a throw;
  - dependencies are injected for tests.
- **Profiles:** `fetchProfilesChunked` (`ui/src/utils/profileBatch.js`) over `GET /api/profiles`.
  It's chunked at 50 and cached, and it tells *not found* (`null`) apart from *lookup failed*
  (`PROFILE_LOOKUP_FAILED`). It's pure, so Node can test it.
- **The design's frame already exists.** `ui/src/pages/dictionary/DictionaryShell.jsx` renders the
  wordmark bar, the app's own `BrainstormUserMenu` (which brings the Setup and Assistant alerts), and
  the `.bsd-*` skin (`ui/src/styles.css:9302-9554`). Its column is `.bsd-main`, 720 px. The
  blueprint's My Assistants column is 1040 px. Only `tests/brainstorm/dictionary-concepts.spec.js`
  touches the frame's classes; no Node suite imports `DictionaryShell`.
- **The menu** is one list, `personalLinks` (`ui/src/config/avatarMenuLinks.js`), which all three
  avatar menus render, and only for a signed-in user (`Header.jsx:92`, `BrainstormUserMenu.jsx:100`,
  `BrainstormSearch.jsx:509`).
- **Direct loads:** `bin/control-panel.js:369-374` serves `dist/index.html` for any non-API path.
  `isBlockedProbePath` (`src/utils/siteTrust.js:226`) doesn't block `/assistants`. A `GET
  /api/assistant/*` is public at the middleware (`src/middleware/auth.js:496-507`), and the handler
  reads the session itself.

**Concepts:** `nostr-user-tag`, `tag`, `tapestry-assistant` and `nostr-user`, all existing firmware
concepts (oriented via `/api/concept-graph/node/…/neighbors`). This story changes none of their
definitions.

## Options considered

### Option A — A session-scoped endpoint returns the rows; the page adds profiles and renders

A new `GET /api/assistant/my-assistants`:

- it reads the viewer's taggings through `federatedScan` and applies AC-3's rule in a pure
  function;
- it adds the Local Assistant;
- it returns `{ pubkey, local, tags }` rows.

The page fetches it, looks the pubkeys up with `fetchProfilesChunked`, and orders and words the rows
in a pure view-model.

- **Pros:**
  - The same relay set as every other tag read in the app, so AC-3's "relays this app reads" has one
    meaning.
  - POV-exact by construction: the viewer comes from the session, as in `attention.js`.
  - The rule is a pure function a Node suite can pin, deletion edge cases included.
  - Profiles go through the shared seam that already handles chunking and the not-found/failed
    distinction.
- **Cons:**
  - Two requests in sequence (the rows, then the profiles).
  - One more small server module.

### Option B — The page reads relays from the browser

The page queries the viewer's kind 39999 and kind 5 itself: through a browser relay pool, or
through the generic `/api/relay/external` proxy that `TrustedAssertions.jsx:80` uses for the
Treasure Map.

- **Pros:** no server change.
- **Cons:**
  - It would pick its own relays, not the operator's tag-federation list (a server setting), so "the
    relays this app reads" would mean something different here than on every tag page.
  - The rule of AC-3 would run in the browser, spread across several raw reads.
  - Its Local answer would come from `/api/auth/user-classification` anyway.
  - Browser relay code has no Node test seam (there's no jsdom here, ADR graph-curation-ui/0001), so
    AC-3's edge cases could only be proven in Playwright.

### Option C — Reuse `/api/profile-tags/authored-by?authorPubkey=<viewer>`

- **Pros:** the scan exists already.
- **Cons:**
  - It **drops targets outside the house POV's WoT**, which would silently hide a low-ranked
    Assistant. That violates AC-3, so it would need a new "no WoT filter" parameter on a shared
    endpoint.
  - Its rows are keyed by the definition's *version* (`e`), not its name, so a second call would be
    needed to learn which tag each row carries.
  - It takes the author as a parameter, not the session, and knows nothing of Local or deletions.

### Frame sub-options

- **F1 (chosen):** lift `DictionaryShell` and `Eyebrow` into a shared
  `ui/src/components/BrainstormDesignShell.jsx`, with a `wide` prop for the 1040 px column. Keep
  `pages/dictionary/DictionaryShell.jsx` as a one-line re-export so `/dictionary` doesn't change.
- **F2:** import `../dictionary/DictionaryShell` from the new page. That couples a second page to a
  file named for the first.
- **F3:** copy the frame. That makes two sticky bars that can drift apart, which is the defect
  `avatarMenuLinks.js` exists to prevent.

## Decision

We chose **Option A with F1**. It's the only option where "the relays this app reads" means the same
here as on every other tag surface. It keeps the viewer's POV exact by taking it from the session.
And it puts AC-3's rule where a Node suite can prove it. The two-request cost is small: a person's
Assistants fit in one profile chunk.

Sub-decisions:

1. **`GET /api/assistant/my-assistants`, session-shaped like `/api/assistant/attention`:**

   ```
   no session  → 200 { success: true, signedIn: false }
   signed in   → 200 { success: true, signedIn: true, local: <hex>|null,
                       rows: [{ pubkey, local: bool, tags: [{ key, name }] }] }   // rows in no promised order
   local leg throws → 500 { success: false, error: 'Could not load your Assistants' }
   ```

   The viewer is `req.session.pubkey` when `session.authenticated === true`, lowercased. It takes
   **no query parameters**. It never writes, signs or stores.

2. **Which taggings count** is a pure function, `myAssistantRows({ viewer, local, taggings,
   deletions })`, applied in this order:

   - **Candidates:** the viewer's kind 39999 events from `federatedScan({ kinds: [39999], authors:
     [viewer], '#z': [NOSTR_USER_TAG_Z_TAG] })`. The canonical `z` is how `handleAuthoredBy` lists
     authored taggings. The constant is imported from `profile-tags`, never re-typed.
   - **Which tag:**
     - First, the slug of the event's `a` when that is `39999:<any 64-hex>:<slug>`. Any author
       counts, as settled.
     - Otherwise, the slug in a `d` of the publisher's form: `profile-tag-<slug>-<8 hex>-<8 hex>`,
       whose last segment equals `viewer.slice(0, 8)`. The segment test stops a slug like
       `my-tapestry-assistant-v2` from matching `my-tapestry-assistant`.
     - Events whose slug isn't one of the two, or whose `p` isn't 64-hex, are dropped.
   - **Latest stance:** the newest per `(slug, p)`, on `created_at`, with the lowest `id` breaking a
     tie (NIP-01; `attention.js`'s `newest`). This holds even when two addresses carry the same pair.
   - **Retracted:** the latest is dropped when a kind 5 by the viewer has an `e` equal to its `id`,
     or an `a` equal to `39999:<viewer>:<its d>` and a `created_at` at or after it (NIP-09).
     Deletions come from two `federatedScan` reads, `{kinds:[5], authors:[viewer], '#e': ids}` and
     `{…, '#a': addrs}`, run in parallel, only when there are candidates. strfry already deletes on
     receipt; this read stops a federation relay that didn't from bringing a tagging back.
   - **Apply only:** the latest must bucket as `apply` (`readPolarity` / `polarityBucket` from
     `src/lib/identification-tags`). Disputed and neutral stances don't count.
   - **Rows:** one per `p`, with `tags` in the fixed order Brainstorm then Tapestry. The row whose
     pubkey equals `local` gets `local: true`. When `local` is set and not already a row, it's added
     with `tags: []`.

3. **The two tags live in one list,** a new pure CJS module `src/lib/my-assistant-tags/index.js`:

   ```js
   MY_ASSISTANT_TAGS = [
     { key: 'brainstorm', name: 'My Brainstorm Assistant', slug: 'my-brainstorm-assistant' },
     { key: 'tapestry',   name: 'My Tapestry Assistant',   slug: <REQUIRED_TAGGINGS my-tapestry-assistant slug> },
   ]
   ```

   The Tapestry slug is read from `identification-tags`, not restated. **The Brainstorm slug is fixed
   here, as `my-brainstorm-assistant`.** Story 2 must publish Nous' definition at that slug, or
   update this entry in the same change. There are no authors yet: story 2 adds the one a new
   tagging points at. The UI takes names from the response, so the server owns the list, and the UI
   owns only the chip colour per `key`.

4. **Local comes from the server,** as `getAssistantPubkeyFor(viewer)`: the TA for the Owner, the
   provisioned delegate otherwise, `null` for none. The page doesn't recompute it from `useAuth()`,
   so the endpoint's answer is the only one the page renders.

5. **The page** is `ui/src/pages/assistants/Index.jsx`, default export `MyAssistantsPage`, with a
   pure view-model `ui/src/pages/assistants/myAssistants.js`. The view-model has no React import;
   its only imports are `nostr-tools`' `nip19` and `.js`-suffixed siblings, so a Node suite loads it
   as it is.
   - **Phases:** `auth-loading → signed-out | loading → ready | error`.
     - While `useAuth().loading` is true, or the rows are being read, the page shows the loading
       line.
     - After the rows arrive it calls `fetchProfilesChunked` on every row's pubkey, and stays in
       `loading` until that settles. So rows appear once, already ordered, and never re-sort in
       front of the reader.
     - A non-`success` answer or a network error is `error`: the error line and **Try again**, which
       reruns both steps. It never shows the empty line.
     - `signedIn: false`, or no `user`, is `signed-out`: the sign-in line, and a button calling
       `useAuth().login` labelled `Sign in with nostr`.
   - **The view-model:** `buildRows({ rows, profiles })` returns display rows `{ pubkey, name,
     initial, npubShort, url, nip05, local, untagged, tags }`:
     - `name` is `display_name`, else `name`, else `npubShort`.
     - `npubShort` is `npub.slice(0, 12) + '…' + npub.slice(-6)`.
     - `url` is `website`, else `'—'`; `nip05` is `nip05`, else `'—'`. Both are trimmed, and empty
       counts as missing.
     - A profile that's `null` or `PROFILE_LOOKUP_FAILED` gets the fallbacks.
     - The Local row comes first, then the rest by `name.localeCompare(other, undefined,
       { sensitivity: 'base' })`, with pubkey breaking a tie.
     - `countText(n)` gives `1 Assistant` / `N Assistants`.
     - `COPY` holds every string in story § Copy.
   - **The tag prompt's link target** is the Identification Tags action's own `path`, from
     `ASSISTANT_ACTIONS` (`ui/src/pages/assistant/actions.js`). It's never a literal.

6. **The frame (F1).** `BrainstormDesignShell` is the current `DictionaryShell` with a `wide` prop,
   which adds `bsd-main-wide` (`max-width: 1040px`). `Eyebrow` moves with it. The page's own styles
   are a new `.bsd-ma-*` block in the `/dictionary` section of `styles.css`, using the blueprint's
   measurements and colours (rows, avatar circle, chips, Local highlight, amber Not tagged mark).
   Each row is a flex row that wraps, so it doesn't scroll sideways at 375 px. The rows don't open
   in this story: they're `<div>`s, not buttons. Story 2 adds the toggle.

7. **Route and menu.**
   - `avatarMenuLinks.js` gains `MY_ASSISTANTS_PATH = '/assistants'`, and `personalLinks` gains
     `{ key: 'my-assistants', icon: '👥', label: 'My Assistants', to: MY_ASSISTANTS_PATH }`,
     directly after `my-treasure-map`.
   - `App.jsx` adds `{ path: MY_ASSISTANTS_PATH, element: <MyAssistantsPage /> }` beside the
     `/dictionary` routes.
   - The API route is registered next to `/api/assistant/attention` in `src/api/index.js`.
   - No middleware or catch-all change.

## Consequences

- **What it enables.** Stories 2 and 3 add to the same endpoint and view-model:
  - story 2 adds the actions, and re-reads after each publish;
  - story 3 adds the Treasure Map fields per row.

  `myAssistantRows` is also the natural home for story 3's "on the map but not tagged" set.
- **What it constrains.**
  - A tagging published **without** the canonical `z` isn't listed. Every tagging this app
    publishes carries it, and the profile's Tagging Activity (`handleAuthoredBy`) has the same
    limit. The Identification Tags check, which looks up by exact address, would still see such a
    tagging. The difference is accepted and noted here; the Reviewer shouldn't flag it.
  - A failed federation leg reads as "nothing out there", as on every tag page. The page can't say
    "an outside relay didn't answer". Only a failed local leg is an error.
  - The Brainstorm slug is decided before its definition exists (sub-decision 3). Story 2 inherits
    that constraint.
- **Debt.** `profile-tags/index.js` must export `NOSTR_USER_TAG_Z_TAG`. That's a one-line
  addition to its exports, not a new literal anywhere.

  *Corrected 2026-09-30 in Test Design:* it already exports it (`src/api/profile-tags/index.js:1865`),
  so there's nothing to add. The same applies to the matching line in § Implementation notes.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- `src/lib/my-assistant-tags/index.js` (new; pure CJS, no requires except
  `../identification-tags`): exports `MY_ASSISTANT_TAGS` and `slugKey(slug)`, which returns
  `'brainstorm' | 'tapestry' | null`.
- `src/api/assistant/myAssistants.js` (new):
  - `defaultDeps()` requires things lazily, as `attention.js:46-54` does: `getAssistantPubkeyFor`,
    and `scan(filter)` → `require('../profile-tags').federatedScan(filter)`.
  - It exports `handleMyAssistants(req, res, deps = {})`, `myAssistantRows(input)` (pure,
    sub-decision 2), `slugOf(event, viewer)` (pure) and `isRetracted(event, deletions, viewer)`
    (pure).
  - The handler: session → viewer; `local = getAssistantPubkeyFor(viewer)` (a non-64-hex answer
    counts as `null`); candidates scan; deletion scans; rows. A throw is logged
    `[assistant/my-assistants]`, then the 500.
- `src/api/profile-tags/index.js`: add `NOSTR_USER_TAG_Z_TAG` to `module.exports`. That's the
  only change there.
- `src/api/index.js`: `app.get('/api/assistant/my-assistants', require('./assistant/myAssistants').handleMyAssistants);`
  next to line 578, with a comment in the neighbours' style.
- `ui/src/components/BrainstormDesignShell.jsx` (new): the current `DictionaryShell` body and
  `Eyebrow`, plus the `wide` prop. `ui/src/pages/dictionary/DictionaryShell.jsx` becomes
  `export { default, Eyebrow } from '../../components/BrainstormDesignShell';`.
- `ui/src/pages/assistants/myAssistants.js` (new, pure) and `ui/src/pages/assistants/Index.jsx`
  (new), per sub-decision 5. The heading is `Your <span class="bsd-title-accent">Assistants</span>.`
  The introduction's **Treasure Map** link is `/tapestry/grapevine/treasure-map`, the target of the
  `my-treasure-map` entry in `personalLinks`. Read it from that entry, never re-typed.
- `ui/src/styles.css`: `.bsd-main-wide` and a `.bsd-ma-*` block, per sub-decision 6.
- `ui/src/config/avatarMenuLinks.js` and `ui/src/App.jsx`, per sub-decision 7.
- **For the Tester (Phase 3):**
  - the server's rule is fully covered by `myAssistantRows` / `slugOf` / `isRetracted` with plain
    event fixtures;
  - the handler's session shapes and error path are covered through injected `deps`, as in
    `test/assistant-attention.test.js`;
  - the view-model's ordering, fallbacks and count are covered with plain objects;
  - the page's phases and 375 px layout are Playwright work, network-mocked, as in
    `tests/brainstorm/dictionary-concepts.spec.js`;
  - `test/dictionary-concepts.test.js` S7–S9 must still pass unchanged. That's the check that the
    frame move didn't change `/dictionary`.

## Out of scope

- Everything story 2 owns: search, the Tag / Change tag / Remove Tag actions, opening rows, the My
  Brainstorm Assistant definition and the author a new tagging points at.
- Everything story 3 owns: any read of the Treasure Map (kind 10040), "On Treasure Map", duties, the
  untagged-on-the-map section, the Duties tab.
- Taggings without the canonical `z`; showing which outside relay failed; verifying NIP-05s.
- Dark mode for the `.bsd-*` skin. It's light-only, as `/dictionary` is.
