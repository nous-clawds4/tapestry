# ADR 0001: The offered duties live in the instance settings, edited from one tab

**Status:** Accepted (by the owner, 2026-10-12, "Ready for Test Design", with the three gate points as proposed: order counts in "current", sub-decision 5; the copy additions, sub-decision 7; the synchronous public-host rule for typed relays)
**Date:** 2026-10-12
**Story:** `engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md`
**Supersedes in part:** ADR `assistant-duty-menu/0001` sub-decision 1 (the K1 rows of `buildOffer`, and its Scores
condition) and sub-decision 4 (an order-blind "current"; see sub-decision 5 below).

## Context

The story, in short:

- **AC-1.** An **Assistant Duties** tab at `/tapestry/settings/assistant-duties`, used by the Owner and Admins only.
  The instance refuses changes from anyone else, however they are sent.
- **AC-2.** The tab lists the duties in order (key, category, relay). Defaults: `30382`, `30392`, `30393`, `30394`,
  `39998`, `39999`, each at **This instance's relay**. With them, the Owner's offer is unchanged.
- **AC-3.** Add any key readers would keep (`duty-menus.md` § 5.3), stored normalized, with this instance's relay or a
  typed one. Refusals: a bad key, a duplicate, a relay that is not `ws(s)://`, a relay others can't reach.
- **AC-4.** Remove (down to none), change a relay, reorder by dragging or from the keyboard, reset to the six. Each
  change saves at once; a refused one changes nothing.
- **AC-5.** No list in code. The defaults ship with the instance, changes live in the settings file on the persistent
  volume, a new shipped default never overwrites a changed list, and a change applies to the next check with no
  restart.
- **AC-6.** Every Assistant's offer is the list, in order, the same for everyone. Publishing publishes it. A menu that
  no longer matches is **Needs attention**. Your Assistant's Treasure Map never calls an unpublished duty live. Two
  Duty Menu sentences say "offers".

**Concept Graph.** Not reachable at design time (stack absent; AGENTS.md §2 fallback). No concept node or firmware
definition is involved. The one handle the story names, Nous' Duty Menu header
`39998:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:duty-menu`, is a wire constant
(`src/lib/nous.js:7`, `src/lib/duty-menu/index.js:23`) and is unchanged. Re-verify against a live graph if one is
at hand.

**What the code does today.**

- **The six.** `OFFER_KEYS` (`src/lib/duty-menu/index.js:35`) holds the six. `buildOffer({ ownRelay, dlistRelay, scores })`
  (`:132–140`) turns them into rows:
  - `30382` only when `scores` is true;
  - Scores and Lists at `ownRelay`;
  - Concepts at `ownRelay`, else `dlistRelay`;
  - a row with no relay is left out.
- **The offer's inputs.** `resolveOfferInputs(viewer)` (`src/api/assistant/dutyMenu.js:101–125`) supplies:
  - `ownRelay`, from `instanceRelayUrl`;
  - `dlistRelay`, the first DList relay that isn't plainly private;
  - `scores`, true for the Owner, else a `CustomerManager` lookup for an active customer.
- **Three callers build the offer the same way.**
  - The check: `checkDutyMenu`, `dutyMenu.js:254–258`.
  - The publish: `publishDutyMenuFor`, `src/api/assistant/dutyMenuPublish.js:108`.
  - The self-Map check: `checkSelfMap`, `src/api/assistant/selfMap.js:259–260`.
- **The self-Map takes relays from the offer** (`readUpkeep`, `selfMap.js:156–199`):
  - **Concepts.** `39998` headers are read *at the offer row's relay*, so a duty there is live only if it really landed
    there.
  - **Scores.** `30382` is read from this instance's strfry *whatever relay the row names*. With a typed relay, the
    self-Map would claim Scores live at a relay it never read.
  - **Lists and any other kind** are never live (`evaluateLive`, `src/lib/self-map/index.js:248–266`).
- **"Current" ignores order.** `sameRows` (`src/lib/duty-menu/index.js:117–125`) compares the offer and the published
  menu as sets: `assistant-duty-menu` #1 AC-4 said "in any order". Row order carries no wire meaning except that
  the first row per key wins (§ 5.3).
- **Settings, two layers** (`src/config/settings.js`).
  - **The files.** `defaults.json` ships with the code. The overrides live in `settings.json` on the volume
    (`TAPESTRY_SETTINGS_PATH`, else `$BRAINSTORM_BASE_DIR/settings.json`, else `/var/lib/brainstorm/settings.json`).
  - **Merging.** `deepMerge` replaces arrays rather than concatenating them (`:21–34`), so an overridden list is the
    whole list.
  - **Reading.** `getSettings()` re-reads both files on every call (`:76–78`).
  - **Resetting.** `resetOverride(keyPath)` deletes one key (`:105–118`).
  - **Editing by hand.** BIBLE §15 documents editing `settings.json` on a droplet.
- **The settings routes** (`src/api/index.js:340–344`).
  - **Who may use them.** All sit behind `requireOwner` (`src/api/settings/settingsApi.js:46–58`), which admits the
    Owner and Admins.
  - **What the generic PUT checks.** `PUT /api/settings` validates only `aRelays` and `nip05` (`:112–139`). Anything
    else it deep-merges unchecked.
  - **Route table.** `src/middleware/routeAccess.js:388–392`.
- **The public-host rule.** `isPublicHost` (`src/api/assistant/profileDefaults.js:53–58`) is "one notion of a stranger
  could reach this". It is composed from `src/utils/ssrfGuard.js`'s `isPublicAddress` and `hasPrivateHostSuffix`.
  `dutyMenu.js` re-derives the same rule as `isPlainlyPrivateRelay` (`:91–95`).
- **The Settings page.**
  - **Tabs.** Listed in `TABS` (`ui/src/pages/settings/Index.jsx:14–21`). The page already shows its Owner-only refusal
    to anyone who isn't the Owner or an Admin (`:120–132`).
  - **Routes.** `ui/src/App.jsx:573–584` gives each tab a child route. A trailing `*` child redirects any other
    segment to `relays`, so a tab with no child route is redirected away.
- **The Duty Menu page.** Its words and `categoryOf` live in `ui/src/pages/assistant/dutyMenuCopy.js` (`:19–21`,
  `:55–71`).

**Constraints.**
- JS without a build step, and no new dependencies (CLAUDE.md house rules).
- The architecture invariants hold:
  - The list is this instance's own configuration. It gates no one's events (principle 2) and is not graph state
    (principle 4).
  - No POV is involved: an offer is the same whoever reads it.

## Options considered

### Option A: a list under one settings key, with its own owner routes and one rule in the duty-menu library (chosen)

- **Where the list lives.** `assistantDuties`, an array in `defaults.json`, overridden whole in `settings.json`.
- **One rule.** A strict validator and a lenient reader live in `src/lib/duty-menu`, beside `readMenuRows`, so the
  saved key and the read key are one rule.
- **The tab's routes.** It reads and writes through `GET`/`PUT /api/settings/assistant-duties` and resets through
  `POST /api/settings/assistant-duties/reset`.
  - The GET answers the list *as the offer uses it*, so a hand-edited bad entry never shows as if it were offered.
  - A refusal carries a code the tab turns into the story's words.
- **No backdoor.** The generic `PUT /api/settings` runs the same validator when a patch carries `assistantDuties`.

Pros:
- One rule for writing and reading.
- The tab shows exactly what the offer uses.
- Refusals are precise.
- No backdoor.

Cons:
- Three new routes, with three route-table entries.

### Option B: the generic settings route only, with a validator hook (as `nip05` does)

The tab reads `settings.assistantDuties` from the props the Settings page already passes (`Index.jsx:54–69`, `:188–205`) and saves
with `PUT /api/settings`. `handleUpdateSettings` gains an `assistantDuties` branch.

Pros:
- No new routes.

Cons:
- The tab sees the raw merged value, not the list the offer uses. A hand-edited bad entry would show as offered, or the
  rule would need a second, client-side copy (the UI is ESM under Vite, the rule CommonJS).
- The page's shared save banner says "Settings saved", not the story's line, and its error is one joined string, not
  a code.

### Option C: hard-coded defaults kept as a fallback in the library

Keep `OFFER_KEYS` as the fallback when the setting is missing.

Rejected:
- AC-5 says the list is no longer fixed in code.
- Two copies of the six would drift.

### Sub-options

- **Which relays a save refuses.**
  - **Chosen:** the synchronous public-host rule, the same `isPublicHost` composition.
  - **Rejected:** resolving the name through the DNS guard (`relayHostGuard.isPublicRelayHostWithin`) on save. A typed
    relay is owner-set configuration, like Relay Settings' relays, which no check resolves. A DNS answer at save time
    also proves nothing later, and a slow resolver would make saving flaky.
- **Keeping the self-Map honest with a typed `30382` relay.**
  - **Chosen:** read Scores' upkeep only when the `30382` row names this instance's relay. Otherwise answer the
    existing reason "This instance doesn't publish these for your Assistant yet."
  - **Rejected:** dropping typed-relay rows from the self-Map's offer. The Duty Menu would then say "offered" while
    the self-Map said "not offered".
  - **Rejected:** leaving it as is. It would claim Scores live at a relay never read.

## Decision

We chose **Option A**, with the synchronous public-host rule and the Scores guard in the self-Map check.

### Sub-decisions

1. **Storage and shape.** `src/config/defaults.json` gains:

   ```json
   "assistantDuties": [
     { "key": "30382" }, { "key": "30392" }, { "key": "30393" },
     { "key": "30394" }, { "key": "39998" }, { "key": "39999" }
   ]
   ```

   Each entry has a `key` and an optional `relay`.
   - **No `relay`** means **This instance's relay**: the relay today's rule names for the key's category
     (sub-decision 3).
   - **A `relay`** is a typed relay, stored in `normalizeRelayUrl`'s one spelling.

   How the existing settings layers handle it:
   - **Saving.** A save writes the whole array to `settings.json` through `updateOverrides({ assistantDuties })`.
     Arrays are replaced whole, so the override *is* the list, and an empty array persists.
   - **New defaults.** A new shipped `defaults.json` changes only an instance whose list was never saved (AC-5).
   - **Reset.** `resetOverride('assistantDuties')` drops the override, so the shipped six apply again.
   - **Editing by hand.** The volume's `settings.json` stays hand-editable (BIBLE §15). A hand edit is read by the
     lenient reader (sub-decision 2).

2. **One rule, in `src/lib/duty-menu/index.js`** (still pure CommonJS, no I/O).

   **Keys.**
   - **`keptKey(raw)`**, factored out of `readMenuRows`' per-row checks (`:95–97`, `:103`):
     - a string;
     - not `39998:` or `39999:`;
     - a kind slot matching `KIND_SLOT`.

     It returns `normalizeMenuKey(raw)`, or null. `readMenuRows` then calls it, so a saved key and a read key cannot
     drift.
   - **`dutyKeyOf(input)`** trims the input, refuses one over 512 characters, then calls `keptKey`.

   **Relays.**
   - **`isPublicRelayUrl(url)`** is `isPublicHost`'s composition (`ssrfGuard`'s `isPublicAddress` for an IP literal,
     else not `hasPrivateHostSuffix`) applied to the URL's hostname.
   - `dutyMenu.js`' `isPlainlyPrivateRelay` becomes `!isPublicRelayUrl(url)`, one copy fewer.
   - `isPublicHost` itself stays where it is.

   **`validateDutyList(input)`, strict, for writes.** It answers `{ ok: true, duties }` (normalized: keys through
   `dutyKeyOf`, typed relays through `normalizeRelayUrl`), or `{ ok: false, code, index }`. The codes, checked in this
   order:
   - `bad-list`: not an array, or an entry that is not an object.
   - `too-many`: more than 200 entries.
   - `bad-key`: `dutyKeyOf` gives null.
   - `duplicate-key`: the same normalized key as an earlier entry.
   - `bad-relay`: a `relay` present, and not a string that `normalizeRelayUrl` accepts.
   - `private-relay`: a typed relay for which `isPublicRelayUrl` is false.

   Any other field on an entry is dropped.

   **`readDutyList(input)`, lenient, for reads.** It applies the same checks, but drops a bad entry instead of refusing,
   and the first entry per key wins. It answers the cleaned list and the count dropped. Not an array means an empty
   list. Callers log the drops once per call.

   **`OFFER_KEYS` is deleted.**

3. **The offer** (`buildOffer` and `resolveOfferInputs`).
   - **`instanceRelayFor(key, { ownRelay, dlistRelay })`.**
     - A key whose kind slot is `39998` or `39999` gives `ownRelay || dlistRelay`.
     - Any other key gives `ownRelay`.
     - Both are in their one spelling.

     This is today's R1 rule, extended to keys outside the six.
   - **`buildOffer({ ownRelay, dlistRelay, duties })`.** One `{ tag: 'duty', key, relay }` row per entry of `duties`,
     in list order.
     - `relay` is the entry's typed relay, else `instanceRelayFor(key)`.
     - An entry whose relay comes out null is left out, as today.
     - No `scores` input, and no `not-offered` rows.
   - **`resolveOfferInputs(viewer, deps)`** answers `{ ownRelay, dlistRelay, duties }`.
     - `duties` is `readDutyList(d.readAssistantDuties())`, where the new dep
       `readAssistantDuties: () => require('../../config/settings').getSettings().assistantDuties` re-reads the files
       at every check (AC-5).
     - The customer lookup and `scores` go (book Decision 6). `viewer` stays in the signature, unused, so the three
       callers don't change.
     - The `getCustomer` dep goes from `dutyMenu.js` if nothing else in that module uses it.
   - **The callers.** `checkDutyMenu`, `publishDutyMenuFor` and `checkSelfMap` pass `resolveOfferInputs`' answer
     straight to `buildOffer`, so all three follow the list with no further change.

4. **The routes**, in `src/api/settings/assistantDutiesApi.js`, registered beside the settings routes
   (`src/api/index.js:340–344`) behind `requireOwner`:

   | Route | Answer |
   |---|---|
   | `GET /api/settings/assistant-duties` | `{ success: true, duties }`: `readDutyList(getSettings().assistantDuties).duties`, the list the offer uses. |
   | `PUT /api/settings/assistant-duties` | Body `{ duties }`. `validateDutyList`. On `ok`, `updateOverrides({ assistantDuties: duties })` and answer `{ success: true, duties }`. On a refusal, `400 { success: false, code, index }` and nothing is written. |
   | `POST /api/settings/assistant-duties/reset` | `resetOverride('assistantDuties')`, then answer as the GET. |

   - **Route table.** `GET` is `OWNER_READ`; `PUT` and `POST …/reset` are `OWNER_ACTION`.
   - **Why reset is a POST.** A `DELETE /api/settings/assistant-duties` would also match the existing
     `DELETE /api/settings/*`, so which handler answered would depend on registration order.
   - **The generic routes.**
     - `handleUpdateSettings` runs `validateDutyList` when a patch has `assistantDuties`, answers its refusal the same
       way (`400` with `code` and `index`), and writes the normalized list.
     - The generic `DELETE /api/settings/assistantDuties` already resets, and is left as is.
   - **Cross-origin posture.** It is the settings routes' own (OPEN.md row 326). No new posture.

5. **"Current" counts order.** `sameRows` becomes an ordered comparison:
   - same length;
   - row *i* has the same tag, key and relay on both sides.

   Why:
   - The owner asked for the menu to list duties in the order they set (book Decision 7).
   - With order ignored, a reorder would change **What your Assistant offers** while the published panel kept the old
     order and still said "up to date".
   - With order counted, a reorder marks every Assistant **Needs attention** until it republishes, which is what the
     tab's Saved line says.

   `sameRows` has one caller (`evaluateDutyMenu`, `dutyMenu.js:246`). The self-Map's own comparison is untouched.
   *This changes `assistant-duty-menu` #1 AC-4 ("in any order"); the owner confirmed it at this ADR's acceptance.*

6. **The self-Map stays honest** (`src/api/assistant/selfMap.js`, `readUpkeep`). When the `30382` row's relay is not
   this instance's own (`isOwnRelay`, `:150`), `out.scores` is `{ status: 'not-published-here', lastLandedAt: null }`
   and nothing is scanned. `evaluateLive` already returns `no(s.status)` for a non-live Scores status, so the page shows
   the existing reason "This instance doesn't publish these for your Assistant yet."
   - **Concepts need nothing.** They are already read at the row's relay.
   - **Lists and other kinds need nothing.** They are never live.
   - **The library is unchanged.** No change to `src/lib/self-map`.

7. **The tab.**
   - **Words and helpers.** `ui/src/pages/settings/assistantDutiesCopy.js`: pure ESM with no imports, so Node suites
     can load it. Its name differs from the component's by more than case (ADR `assistant-identification-tags/0002`
     Amendment 1). It holds:
     - `ASSISTANT_DUTIES_COPY`: the story's § Copy, plus the additions below;
     - `refusalLine(code)`: each code to its words; any other failure to "Could not save: this instance did not
       answer.";
     - `moveDuty(list, from, to)`, `addDuty(list, entry)`, `removeDuty(list, index)` and `setRelay(list, index,
       relay)`: pure, each returning a new list.
   - **The component.** `ui/src/pages/settings/AssistantDuties.jsx` makes its own requests, not through the page's
     `handleSave`, so it shows its own lines.
     - **On mount.** It GETs the list.
     - **Each change.** It builds the next list with a helper, PUTs it, and disables every control while the request is
       in flight.
       - **On success** it shows the server's `duties` and the Saved line.
       - **On a refusal** it keeps the list it had and shows `refusalLine(code)`.
     - **Reset.** `window.confirm(copy.resetConfirm)`, then POSTs `…/reset`.
     - **Each row**, in list order, shows:
       - a drag handle (native HTML5 drag and drop: `draggable` on the row, `onDragStart`/`onDragOver`/`onDrop`
         calling `moveDuty`);
       - the key in `<code>`;
       - its category from `categoryOf` (imported from `../assistant/dutyMenuCopy`), so the tab names categories as
         the Duty Menu page does;
       - the relay, or **This instance's relay**;
       - **Move up** and **Move down** buttons, disabled at the ends. These are the keyboard and touch path, since
         HTML5 drag and drop does nothing on touch screens.
       - **Change relay**, which opens the relay choice in place with **Save** and **Cancel**;
       - **Remove**.
     - **The add form**, under the list: **Treasure Map key**, the relay choice (**This instance's relay** checked
       by default; **Another relay** with a `wss://` placeholder), and **Add duty**.
     - **The reset button**, last.
     - **Styling.** Existing settings classes; new classes prefixed `settings-duties-`.
   - **The page.** In `ui/src/pages/settings/Index.jsx`:
     - `TABS` gains `{ key: 'assistant-duties', path: 'assistant-duties', label: '📋 Assistant Duties' }` right
       after the `assistant` entry;
     - the content area renders `<AssistantDuties />` for it.
   - **The route.** `ui/src/App.jsx` gains `{ path: 'assistant-duties', handle: { crumb: 'Assistant Duties' } }` among
     the settings children, before `*`.

   **Copy additions** (not in the story; confirmed by the owner at this ADR's acceptance):
   - **Change relay**, **Save**, **Cancel**.
   - The drag handle's label, "Drag to reorder".
   - The `too-many` line, "The list can hold at most 200 duties."

8. **The Duty Menu page's words.** In `ui/src/pages/assistant/dutyMenuCopy.js`:
   - `offerExplainer` becomes "Duties this instance offers for your Assistant, and the relay where each is
     published."
   - `offerEmpty` becomes "This instance offers no duties for your Assistant."

   Update the file's header pointer to this story's § Copy.

9. **Records.**
   - **BIBLE §11.**
     - The `/api/assistant/attention` row's `duty-menu` offer text (`BIBLE.md:527`, "Scores for the Owner and active
       customers…") becomes the list from Assistant Duties settings, in order, each at its typed relay or this
       instance's relay by category.
     - Three new rows sit after the settings rows (`:564–566`).
   - **BIBLE §15.** One line: `assistantDuties` in `settings.json` can be edited there too, with sub-decision 1's
     shape.
   - **The prior ADRs.**
     - `assistant-duty-menu/0001` gets "Partly superseded by ADR `assistant-duties-settings/0001`" under its Status
       line.
     - `assistant-self-map/0001` gets a one-line note naming sub-decision 6.
   - **`protocols/drafts/duty-menus.md:5`.** The implementation line's "with rows naming the instance's own relay"
     becomes "with the rows its Owner lists in Assistant Duties settings".

## Consequences

- **What this enables.**
  - The Owner or an Admin changes every Assistant's offer from one tab, with no deploy.
  - The file stays editable by hand, and a hand edit can't put a bad row on a menu.
- **Honest rows, relaxed by choice.** A menu may now offer a duty this instance does not publish (book Decision 1).
  The Duty Menu shows such a duty without comment. The self-Map shows it as offered but not live, so it never claims
  what it hasn't read (sub-decision 6).
- **Admins.** An Admin who is not a customer now offers Scores (book Decision 6). The self-Map shows those Scores as not
  scheduled, because no upkeep runs for that Assistant.
- **Every change, a reorder included, marks every Assistant Needs attention.** It stays that way until each person
  republishes from their Duty Menu page. Nothing republishes on its own (story § Out of scope).
- **Last write wins.** Each save sends the whole list. Two Admins saving at once: the later save replaces the earlier
  one, and a tab that was open before another person's change overwrites it. The tab re-reads after each save, so the
  person sees the result. Accepted at this scale.
- **A pre-existing risk, not addressed.** `saveOverrides` writes `settings.json` in place, not atomically. A crash
  mid-write would lose every override, this list included. That is true of every setting today, so it is not widened
  into this story. **Follow-up:** a ledger row at implementation.
- **Cost.** Every hub load builds the offer twice (the Duty Menu check and the self-Map check), and each publish once
  more. Each build now reads two small JSON files through `getSettings()`. That is negligible beside the relay reads,
  and it drops one `CustomerManager.initialize()` per build for anyone but the Owner.
- **Tests to re-aim (Phase 3, the Tester's lane).** These suites pin K1, the Scores condition, the order-blind
  "current", or the two old sentences, and need re-aiming:
  - `test/assistant-duty-menu-check.test.js` (L9 and the Owner/customer/admin offer tests);
  - `test/helpers/dutyMenuFixtures.js` (`OFFER_KEYS`, `expectedOffer`);
  - `test/assistant-duty-menu-publish.test.js`;
  - `test/assistant-self-map-check.test.js`;
  - `test/assistant-duty-menu-page.test.js` (the copy);
  - the route-walk suite (`test/admin-action-sweep.test.js`), which must see the three new route-table entries.

  A suite that doesn't inject `readAssistantDuties` reads the real `getSettings()`. Suites should inject it, so a
  developer's own `settings.json` can never steer them.
- **Firmware reinstall required?** No. No concept definition changes.

## Implementation notes

- **`src/config/defaults.json`.** Add `assistantDuties` (sub-decision 1) after `trustedLists`.
- **`src/lib/duty-menu/index.js`.**
  - Delete `OFFER_KEYS`.
  - Add `keptKey`, `dutyKeyOf`, `isPublicRelayUrl`, `validateDutyList`, `readDutyList` and `instanceRelayFor`, plus
    the constants `MAX_DUTIES = 200` and `MAX_KEY_LENGTH = 512`.
  - `readMenuRows` uses `keptKey`.
  - `buildOffer` takes `{ ownRelay, dlistRelay, duties }`.
  - `sameRows` compares in order.
  - Export the new names. Update the header comment: the offer comes from settings, per this ADR.
- **`src/api/assistant/dutyMenu.js`.**
  - `resolveOfferInputs` per sub-decision 3, with the `readAssistantDuties` dep. Log `readDutyList`'s drops with
    `console.warn('[assistant/duty-menu] ignored N assistantDuties entries')`.
  - `isPlainlyPrivateRelay` becomes `!isPublicRelayUrl(url)`.
  - Update the header comment's paragraph on the offer.
- **`src/api/assistant/dutyMenuPublish.js`.** No logic change. Its header's "Relay Settings' relays, sent as owner-set"
  becomes "the relays its rows name (owner-set: Relay Settings or Assistant Duties)".
- **`src/api/assistant/selfMap.js`.** `readUpkeep` per sub-decision 6.
- **`src/api/settings/assistantDutiesApi.js` (new).** The three handlers, taking their settings functions as
  injectable deps (`{ getSettings, updateOverrides, resetOverride }`, defaulting to `../../config/settings`'s) so
  suites run stack-free.
- **`src/api/settings/settingsApi.js`.** Add the `assistantDuties` branch in `handleUpdateSettings`.
- **`src/api/index.js`.** Register the three routes with `requireOwner`, beside `:340–344`.
- **`src/middleware/routeAccess.js`.** Add the three entries beside `:388–392`.
- **`ui/src/pages/settings/assistantDutiesCopy.js` (new), `ui/src/pages/settings/AssistantDuties.jsx` (new),
  `ui/src/pages/settings/Index.jsx`, `ui/src/App.jsx`.** Sub-decision 7.
- **`ui/src/pages/assistant/dutyMenuCopy.js`.** Sub-decision 8.
- **Docs.** Sub-decision 9.
- **No other branch.** This is a feature for `staging`, then `main` through the normal promotion.
- **Test-file changes** (the suites above, and new suites for the library, the routes, the tab's pure module and the
  source sentinels) are Phase 3's.

## Out of scope

- Republishing any Assistant's menu after a change, on a timer or on save.
- `not-offered` rows, and names or descriptions on rows.
- A per-Assistant list.
- Making the instance compute or publish an added kind.
- A warning on duties this instance doesn't publish (book Decision 1).
- An atomic write for `settings.json` (see Consequences).
- The relay-reconciliation item of ledger row `2026-10-12-duty-menu-code-cross-book-notes` (`/treasure-map`'s relay
  fill), which belongs to the later Duty Menus code book.

## Amendment 1: whole kinds only, and three tab fixes (review round 1, 2026-10-12)

**Status:** Accepted (by the owner, 2026-10-12, "Ready for Test Design"; whole kinds is book Decision 8).

Story 1's review (`engineering-team/reviews/assistant-duties-settings/1-the-assistant-duties-tab.md`, Blocking 1)
found that the list accepted every key readers keep. But Your Assistant's Treasure Map builds its offer by kind:
- `evaluateSelfMap` takes only rows keyed `/^\d{5}$/` (`src/lib/self-map/index.js:451–454`);
- `readUpkeep` finds the Scores and Concepts rows by exact key (`src/api/assistant/selfMap.js:161`).

So a listed `30382:rank`, `3038x`, `*` or `39999:my-list` read as "not offered" there while the Duty Menu offered it.
With `30382:rank` in place of `30382`, a true Scores claim was also flagged false. The owner chose to narrow the list
rather than teach the self-Map narrower and broader keys (book Decision 8; story AC-3 amended). Sub-decision 6 stands
for typed relays. The self-Map library stays unchanged: whole kinds are what it already reads.

1. **A duty is a whole kind.**
   - **`dutyKeyOf(input)`.** It trims the input and answers it when it is five digits (`/^\d{5}$/`), else null. Every
     key it accepts is one readers keep, as itself (`keptKey(k) === k`), so the list stays inside the readers' rule.
     It is just narrower.
   - **`keptKey` and `readMenuRows` are unchanged.** Reading a published menu still keeps every key § 5.3 keeps.
   - **`MAX_KEY_LENGTH` is removed.** A five-digit kind needs no bound.
2. **The two list rules follow.**
   - **`validateDutyList`** refuses anything else with `bad-key`. The story's words stay: "That isn't a Treasure Map
     key."
   - **`readDutyList`** drops it. A hand-edited `settings.json` that still names a narrower or broader key therefore
     never puts it on a menu, and the drop is logged as before. Nothing is migrated: the shipped six are whole kinds.
   - **`instanceRelayFor`** needs no change. A Concept kind is `39998` or `39999`.
3. **The tab's open relay change belongs to its duty.** In `ui/src/pages/settings/AssistantDuties.jsx`:
   - `editing` holds the duty's `key`, not its index.
   - `saveRelay` finds the duty by key when it saves.
   - The panel closes when that duty is no longer on the list.
4. **An empty Another relay is refused, as when adding.**
   - `setRelay(list, index, relay)` (`assistantDutiesCopy.js`) puts back This instance's relay only for `null` or
     `undefined`. Any other value, `''` included, is set as the typed relay.
   - The tab sends `editing.relay` as it is when **Another relay** is chosen.
   - The server refuses `''` with `bad-relay`, and the tab shows "A relay must start with wss:// or ws://."
5. **The routes log drops too.** `src/api/settings/assistantDutiesApi.js` logs `readDutyList`'s `dropped` for GET and
   reset, with `console.warn('[settings/assistant-duties] ignored N assistantDuties entries')`, as ADR sub-decision 2
   asks of every caller.
6. **Docs.**
   - BIBLE §15's shape becomes `{ "key": "<kind>" }`, five digits.
   - BIBLE §11's PUT row says `bad-key` is anything but a five-digit kind.

**Tests (Phase 3, round 2, the Tester's).**
- **Re-aim** every case that lists a narrower, family, `*` or Concept-`d` key as accepted: L2, L3, L5, L7, L8, L9, R2,
  O2, O3, W14, and browser B3 and B11.
- **Add:**
  - such keys refused with `bad-key` (library, PUT and the generic PUT);
  - such a key in the settings dropped from GET, the offer and so the self-Map, and logged;
  - the panel following its duty across a remove or a move (browser);
  - an empty Another relay refused (browser, and `setRelay` in Node);
  - the routes' drop log.
- **Remove** `MAX_KEY_LENGTH` from L1.
