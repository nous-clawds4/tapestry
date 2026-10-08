# ADR 0005: Save is one pure sequence with its effects injected, and the page shows what it signed

**Status:** Accepted
**Date:** 2026-10-08
**Story:** `engineering-team/stories/treasure-map-edit/5-save-the-edited-map.md`
**Approved:** by the owner, 2026-10-08, verbatim: "Ready for test design"
**Builds on:** ADR 0003 (the edit model, `useMapEdit`, the page) and ADR 0004 (`planEdit`, the switches). It changes
ADR 0004's `setOverrideAll` (book decision 18).

## Context

Edit mode builds the Map Save would sign: `planEdit({ event, viewer, pending, relayFor }).draft`, shown in "View the
raw Treasure Map — edited". Story 5 signs and publishes it.

**What the story asks (book decisions 17–18):**
- **AC-1:** Save is on only when the draft differs from the published Map.
- **AC-2:** the person's own signer signs exactly the draft, with a newer `created_at`, and only when the signer's
  account is the signed-in person and the viewer is still the one whose Map was read.
- **AC-3:** it publishes to this instance's relay and the instance's outside relays, under its publish policy.
- **AC-4:** "Saving…", and nothing changes during the save.
- **AC-5:** just before signing, a newer Map stops the save.
- **AC-6:** three outcomes:
  - clean: "Treasure Map updated";
  - partial: the publish report, and Edit ends;
  - nowhere: the report, and Edit stays.
- **AC-7:** refusals: no signer, another account, declined.
- **AC-8:** no Map: a new one.
- **AC-9:** two changes to story 4's switches.
- **AC-10:** focus, announcements, 375 px.

**What exists:**
- **The signer check.** `ui/src/utils/signerGuard.js:55` `getActiveSignerOrThrow(expected)` throws "No NIP-07
  extension detected." without `window.nostr`. It throws `SignerMismatchError` (`code: 'SIGNER_MISMATCH'`, the house
  words naming both accounts) when the active account isn't `expected`.
- **Publishing.** `ui/src/utils/nostrPublish.js:222` `publishEverywhere(signed, relays = PUBLISH_RELAYS)` writes to
  local strfry and the outside relays in parallel and returns `{ local: { success, error? }, external: { successes,
  failures, details?, skippedByGate? } }`. `skippedByGate` is the instance's local-only publish policy.
  `PUBLISH_RELAYS` (`:42`) is the list every other browser-signed publish uses by default (story 5 default 1).
- **The publish report.** `ui/src/utils/taggingPublishReport.js` is pure with no imports, so Node can load it.
  - `describeTaggingPublish({ name, local, external, relays })` gives `{ ok, outcome, message, rows }`, in the house
    sentences.
  - Its subject is `"${name}"`, in quotes, and the story wants "Your Treasure Map", unquoted.
  - `publishTone` calls a result "success" when every tried relay accepted, even if the local write failed. AC-6's
    "accepted everywhere" also needs this instance's relay.
- **The Map read.** `ui/src/hooks/useTreasureMap.js` reads local strfry first (`limit: 1`). Only after a miss does it
  read the general-purpose relays through `/api/relay/external` (newest wins). It exposes `event`, `relays` and
  `refresh`. A refresh after a save would read local first, which shows the old Map whenever the local write failed
  but a relay took the new one.
- **The stamp.** `ui/src/utils/treasureMap.js:171` `restamp` is `max(now, old.created_at + 1)`, and is private.
- **The existing manual-edit flow** (`TreasureMapManualEdit.jsx:38–55`): `getActiveSignerOrThrow`, then
  `window.nostr.signEvent`, then `publishOrThrow`. It has no change check and no report.

No concept definitions change. The stack wasn't running; no handles are cited.

## Options considered

### Option A — a pure save sequence with its effects injected, a small save hook, and the page showing the signed Map (chosen)

`saveTreasureMap.js` holds the whole decision sequence as one async function. Every effect is a function passed in:
reading the latest Map, the signer check, signing, publishing and the clock. Node tests drive every branch with fakes.

`useMapSave` wires in the real effects and holds:
- the save's state;
- the outcome;
- the toast;
- the Map just signed.

After a save that reached anywhere, the page shows the signed event itself rather than re-reading.
- **Pros:**
  - Every rule is unit-tested: the order of checks, which refusal is which, the stamp, the newer-Map rule, and what
    counts as clean.
  - The edit model stays pure (story 3's S1).
  - The page shows exactly what was signed, even when only an outside relay took it.
- **Cons:**
  - A fourth module.
  - The page holds a "just saved" event beside the read hook's, until the next read or a viewer change.

### Option B — sign and publish inline in the page, as the manual-edit flow does

- **Pros:** the least code.
- **Cons:**
  - The branches (changed, three refusals, three outcomes) would only be testable in the browser.
  - The refresh-after-save gap stays.
  - The rules sit in JSX.

### Option C — move Save into `useTreasureMap`, as a write path beside its read

- **Pros:** one place knows the Map.
- **Cons:**
  - The hook is shared with the My Assistants pages, and widening it puts signing into every reader.
  - Its effect-driven read isn't an imperative "read now and compare".

## Decision

We chose **Option A**, because it keeps each rule where a Node test can reach it, as ADRs 0003 and 0004 did, and lets
the page show what it signed.

1. **`ui/src/pages/treasure-map/saveTreasureMap.js`** (new). It is pure apart from what it's given, and imports only
   `.js`-suffixed modules: `manageTreasureMap.js` for `COPY`, and `../../utils/taggingPublishReport.js`.
   - **`isNewer(latest, base)`:** true when `latest` is a Map and either:
     - there is no `base`; or
     - `latest.id !== base.id` and `latest.created_at >= base.created_at`. An equal time with a different id counts
       as newer, to be safe.

     An older Map is never "newer".
   - **`stampFor(base, now)`:** `Math.max(now, (base?.created_at || 0) + 1)`.
   - **`cleanSave(result)`:** the local write succeeded, `skippedByGate` isn't set, at least one outside relay was
     tried, and every tried relay accepted.
   - **`saveTreasureMap({ viewer, base, draft, relays, deps })`**, with
     `deps = { readLatest, activeSigner, sign, publish, now }`. In order, it returns the first that applies:
     1. **Wrong Map:** no `viewer`, no `draft`, `draft.pubkey !== viewer`, or a `base` whose `pubkey !== viewer` →
        `{ outcome: 'not-sent', reason: 'viewer' }`, with no message. This only happens for the one render after a
        viewer change, and the edit state resets then anyway.
     2. **The signer check:** `await deps.activeSigner(viewer)`.
        - An error with `code === 'SIGNER_MISMATCH'` → `{ outcome: 'not-sent', reason: 'mismatch', message:
          err.message }`. Those are the house words.
        - Any other error → `{ outcome: 'not-sent', reason: 'no-signer', message: COPY.edit.noSigner }`.
     3. **The newer-Map check:** `latest = await deps.readLatest()`. If it throws, the result is `null`: a check that
        can read nothing doesn't block, and the publish will say what happened. If `isNewer(latest, base)` →
        `{ outcome: 'not-sent', reason: 'changed', message: COPY.edit.changedSince }`.
     4. **Sign** `{ kind: 10040, pubkey: viewer, created_at: stampFor(base, deps.now()), content: draft.content, tags:
        draft.tags }`.
        - An error with `code === 'SIGNER_MISMATCH'` → `'mismatch'`, as above. `deps.sign` checks the signed event's
          pubkey.
        - Any other error → `{ outcome: 'not-sent', reason: 'declined', message: COPY.edit.declined }`.
     5. **Publish:** `result = await deps.publish(signed)`. If it throws, the result is
        `{ local: { success: false, error: message }, external: {} }`. Then:
        - `report = describeTaggingPublish({ name: '', subject: COPY.edit.reportSubject, local, external, relays })`;
        - `outcome = cleanSave(result) ? 'saved' : report.ok ? 'partial' : 'failed'`;
        - the return value is `{ outcome, signed, report }`.
2. **`ui/src/utils/taggingPublishReport.js`:** `describeTaggingPublish` takes an optional `subject`, used as written.
   Without it, the subject is `"${name}"` as now, so every existing caller is unchanged.
3. **`ui/src/pages/treasure-map/useMapSave.js`** (new). It is the only module here that signs or publishes. It wires
   in the real effects:
   - **`readLatest`:** the newest of `queryRelay({ kinds: [10040], authors: [viewer], limit: 1 })` and
     `/api/relay/external` (non-strict) over the page's general-purpose `relays` (`useTreasureMap().relays`). Either
     source failing is skipped.
   - **`activeSigner`:** `getActiveSignerOrThrow`.
   - **`sign`:** `window.nostr.signEvent`, then `assertSignerMatches(signed.pubkey, viewer)`.
   - **`publish`:** `publishEverywhere(signed)`, which uses the default `PUBLISH_RELAYS`. `relays` for the report is
     `PUBLISH_RELAYS`.
   - **`now`:** `Math.floor(Date.now() / 1000)`.

   It holds `{ busy, outcome, message, report, toast, saved }`:
   - `saved` is the signed event after a `'saved'` or `'partial'` outcome.
   - `toast` is true for about 4 s after a `'saved'` outcome.

   It exposes `save({ base, draft })` and `clear()`. A newer `save` or a new viewer makes an older answer stale (a
   `latest` ref, as in `useMapEdit`). Everything resets when the viewer changes.
4. **The edit model** (`editTreasureMap.js`):
   - **`planEdit` returns `changed` too:** with a published Map, the draft's content or tags differ from it; with
     none, the draft has a tag (AC-1).
   - **`setOverrideAll(pending, on, duties)`** (book decision 18, superseding ADR 0004's form). On, it sets only the
     categories whose `duties[category]` has a duty. Off, it clears all three. ADR 0004's other steps are unchanged.
5. **The hook** (`useMapEdit.js`):
   - `setOverrideAll(on, duties)` passes the page's `plan.duties`.
   - New `finish()`: Edit off, pending cleared, any list closed, without loading anything. The page calls it after a
     `'saved'` or `'partial'` outcome.
6. **The page** (`Index.jsx`):
   - **The Map shown.**
     - **What it is:** with `save.saved` for this viewer, and newer than or equal to `map.event` by `created_at`,
       the page shows `{ ...map, status: 'found', event: save.saved }`.
     - **Where it reaches:** the cards, the raw viewer, the edit base and `phase`. So after a save on a
       person with no Map, the phase is `found` and the no-Map warning is gone (AC-8).
     - **How long:** a later read with a newer Map wins, and a viewer change drops it.
   - **The save bar** (in Edit mode, under the cards):
     - the note, `saveNote(plan.changed ? plan.pending : {}, nameOf)`, so an unchanged draft reads "No changes yet"
       (AC-1);
     - **Save changes**, disabled unless `plan.changed` and not `busy`, reading **Saving…** while `busy`;
     - under them, the refusal or failure line, `role="alert"`: the outcome's `message`, or the report's message and
       relay lines for `'failed'`.
   - **While `busy`** (AC-4): every Edit control is disabled. That means the pickers' buttons, rows, Undos, switches,
     **Assign to all**, the Edit button and **Save changes**. Any open list closes when the save starts.
   - **After `'saved'` or `'partial'`:** `edit.finish()`.
     - `'saved'` shows the toast: "Treasure Map updated", `role="status"`, fixed at the bottom centre, about 4 s.
     - `'partial'` shows the report (summary and relay lines, `role="status"`) at the top of the Assistants by
       category section, until Edit turns on again (`save.clear()` in the Edit toggle) or the page is left.
   - **Focus (AC-10):** an effect keyed to each outcome moves focus after the render. It goes to the **Edit** button
     when Edit mode ended, and stays on (returns to) **Save changes** otherwise.
   - **Card switches (book decision 18):** `Switch` takes an optional `describedBy` prefix. A card's switch is
     described by `titleId(key)` and then its note. The All duties and backup switches are unchanged.
7. **`COPY.edit` gains:**
   - `save`: "Save changes";
   - `saving`: "Saving…";
   - `saved`: "Treasure Map updated";
   - `reportSubject`: "Your Treasure Map";
   - `changedSince`: "Couldn’t save: your Treasure Map changed since this page read it. Reload the page to see the new
     one; these changes will be lost.";
   - `noSigner`: "Couldn’t save: no Nostr signer was found in this browser.";
   - `declined`: "Couldn’t save: the signature was declined."

   The apostrophes are curly, as elsewhere in `COPY`.
8. **Styles** (`.bsd-tm-edit-*`):
   - **The save bar:** a right-aligned flex row that wraps, with the note and the button.
   - **The button:** the blueprint's 40 px pill, 14 px/600, accent with white text when enabled, and `#e8eae7` with
     `#9aa1ac` text and `not-allowed` when disabled.
   - **The alert and report lines:** the page's `.bsd-ma-status` tones.
   - **The toast:** fixed, bottom centre, `var(--text)` background, white 14 px/600 text, radius 999, padding 10/18,
     with a shadow. It sits inside the screen at 375 px. It doesn't animate under `prefers-reduced-motion`.

## Consequences

- **Every branch of Save is a Node test.** The browser specs only need to show the wiring, the words and focus.
- **Where the Map is published.**
  - It goes to `PUBLISH_RELAYS` and local strfry. The page reads from local strfry and the general-purpose relays. The
    two lists can differ, but the next read finds the Map locally whenever the local write succeeded.
  - A save that only an outside relay took is shown from the signed event until the person reloads. After a reload,
    the read finds whichever Map those sources hold.
  - Aligning the two relay lists is out of scope; this is the app's existing publish target.
- **The newer-Map check is best-effort.**
  - It reads the sources the page reads. A source that can't answer is skipped, and if none answers the save goes
    ahead.
  - It stops the common overwrite: a Map published since the page loaded, by an Assistant, another app or another
    tab.
  - It can't see a newer Map held only by a relay that's down.
- **Decision 18 departs from the blueprint** for the All duties switch, as the owner chose.
- **Re-aims for Test Design** (Phase 3, the Tester's lane):
  - Story 4's T1 (`setOverrideAll` sets all three) and V1 (a card switch's description is the note alone).
  - Story 3's E15 and story 4's V12 assert there is no **Save changes** button. They keep "nothing signs during an
    edit session" and drop the button check.
  - `test/manage-treasure-map-page.test.js` D5 (no Save changes in the page).
  - A grep for any neighbour asserting the page imports no signer or publish helper. The page doesn't import any:
    `useMapSave` does.
- **Story 4's housekeeping** rides here:
  - `editedTags`' JSDoc (Implementer);
  - V10's title and E9's coverage (Tester).
- **Firmware reinstall required?** No.

## Implementation notes

- **New:**
  - `ui/src/pages/treasure-map/saveTreasureMap.js`: `isNewer`, `stampFor`, `cleanSave` and `saveTreasureMap`.
  - `ui/src/pages/treasure-map/useMapSave.js`.
- **Changed:**
  - `editTreasureMap.js`: `planEdit().changed`, `setOverrideAll(pending, on, duties)`, and `editedTags`' JSDoc.
  - `useMapEdit.js`: `setOverrideAll(on, duties)` and `finish()`.
  - `manageTreasureMap.js`: the `COPY.edit` words.
  - `taggingPublishReport.js`: the optional `subject`.
  - `Index.jsx`:
    - the Map shown;
    - the save bar, `busy` and the outcomes;
    - the toast and the report;
    - focus;
    - the card switches' `describedBy`.
  - `styles.css`.
- **Tests (Tester's choice):**
  - `saveTreasureMap` with fakes, checking:
    - the order of checks, by recording which fakes were called;
    - that no `sign` or `publish` happens on any `not-sent`;
    - the stamp against an old and a future `created_at`;
    - `isNewer`'s three cases;
    - each `cleanSave` / partial / failed split, including local-only, local failed with relays accepting, and
      no relays tried.
  - **The browser specs:**
    - mock `window.nostr` (`signEvent` recording the unsigned event and returning a signed one; `getPublicKey`
      switchable to another account; a decline that throws);
    - stub the publish through the routes `publishEverywhere` uses: `/api/strfry/publish` or the equivalent local
      write, plus a WebSocket stub or `allowExternalPublish: false` for the outside relays;
    - stage a newer Map on the second read of `/api/strfry/scan`.

    The Tester picks the least brittle seam and records it in the plan.

## Out of scope

- **Rebuilding an edit on a newer Map** (the alternative book decision 17 set aside).
- **Changing `PUBLISH_RELAYS`,** or the relays the read uses.
- **The legacy generators rewriting `30382:*` rows** (ledger `2026-10-08-legacy-generators-overwrite-edited-scores`).
- **Any change to `useTreasureMap`.**
