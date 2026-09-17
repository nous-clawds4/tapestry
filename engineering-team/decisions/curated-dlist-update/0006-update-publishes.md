# ADR 0006: Update list publishes — the browser re-checks, one endpoint re-reads, signs and reads back

**Status:** Accepted
**Amended by:** Amendment 1 (2026-09-13): deletes and refreshes target only my assistant's copies; each server read
carries a limit of 500.
Amendment 2 (2026-09-13): each call answers within 45 seconds; an unknown outcome is never reported as "nothing"; the
server reads only the deletion requests for each call's copies.
Amendment 3 (2026-09-13): any 4xx is a refusal made before anything is signed, whatever its body.
**Date:** 2026-09-13
**Story:** `engineering-team/stories/curated-dlist-update/6-update-list-publishes.md`
**Supersedes in part:** these ADRs in `curated-dlist-update`:
- ADR 0002 (its Consequences: which headers the upgrade takes);
- ADR 0003 (Option C's follow-up; §5's availability);
- ADR 0005 (§7's entries; §8's closing line).

See Decision §11.

## Context
**The story** (Approved `2ec394c2`) makes Update list act.
- **One approval** publishes the whole preview (Planning decision 1): the copies, refreshes, deletion requests and the
  header upgrade.
- **Only my own assistant signs** (AC-7).
- **Everything is re-checked first** (AC-2), and results are reported per item and per place (AC-8).
- **Unhonored deletions** are shown (AC-9).
- **Planning decision 2:** a header whose older link sits beside the "deliberately unaffiliated" marker becomes a plain
  pointer and loses the marker, and the preview says so first.
- **Decision 3:** no dead-end curate-here offer (R2-2).
- **Decision 4:** report, and never retry on its own.

**The plan is the list of writes** (ADR 0005 § Consequences).
- `updatePlan` (`ui/src/utils/treasureMap.js:897`) answers
  `{ state, reasons, copy, refresh, delete, keepFlagged, unchanged, upgrade, skipped, upToDate }`.
- Its entries name the original (`routeId`), the copy (`copyRouteId`), a name and a score. They carry no event ids.
- Its verdicts come from this browser's method, point of view and cutoff (ADR 0004; "these apply in this browser").

**What a write is** (ADR 0001 Decision §1–§6):
- **A copy** is kind 39999 by my assistant. Its tags are exactly:
  - its `d`: `copy-`, then the SHA-256 of "<my header's address>\n<the original's reference>";
  - one `z`: my header's address;
  - its `q`s: the address, for a 39999 original; and, for every copy, the version id with a relay and the author;
  - the original's `name`, `title`, `slug`, `description`, `comments` and item tags (`p`, `e`, `t`, `a`), verbatim.

  It also carries the original's `content`.
- **A refresh** is the same address, re-copied, with a new version `q`.
- **A removal** is kind 5 by my assistant: `["a", "39999:<assistant>:<copy d>"]`, `["e", "<copy id>"]`,
  `["k", "39999"]`, and no reason.
- **The upgrade** republishes my header with `["b", <the same target>, "pointer"]`, shown to me before my assistant signs.

**The one endpoint that signs as the caller's assistant today** is `POST /api/dlist-curation/header`
(`src/api/dlist-curation/index.js`).
- **Session:** it calls `requireAuth` in the handler (`:243–244`; `src/api/trustedList/index.js:186–198`), because the
  middleware lets every signed-in session through (`src/middleware/auth.js:466`).
- **Key:** `getAssistantKeys(sessionPubkey)` (`:246`; `src/utils/assistantKeys.js:20–26`) gives the owner the TA and
  anyone else their own key. No key → 400.
- **One event per call.** It signs one kind-39998 event with `finalizeEvent` and imports it into local strfry
  (`publishToStrfry`, `strfry import --no-verify`; `src/api/trustedList/index.js:73–106`). It then publishes to
  `aDListRelays` (by default, the community relay) through its own `publishToRelays` (`:188–208`), honoring
  `isLocalOnly()` (`:211–217`).
- **Its limits:**
  - its never-clobber read is local-only (`:277`);
  - it loads nostr-tools from the container path only (`:37–46`);
  - its relay classification reads only the settled status. That is honest only while nostr-tools stays at 2.10.4,
    where a failed connection rejects; 2.23 fulfills it with "connection failure: …" (ADR `honest-publish-reporting`
    0001).

No code signs a kind 5 as an assistant. The house's deletions (`unpinTag`, `revoke`) are user-signed and carry only `e`.

**Security constraints** (the 2026-09-11 audit and staging's OPEN.md row 276; pointer-level only):
- Check the session in the route, and choose the key only with `getAssistantKeys`.
  - Never use `isOwner`: it admits admins (row 269).
  - Never trust a user named in the body.
- Never sign an event body the browser sent (the forgery class). Build every event on the server from its own fresh reads.
- Cap the batch, and limit deletions to my assistant's own copies. There is no rate limiting anywhere.
- Confirm by reading back: `strfry import` exits 0 even when it rejects an event.
- Load nostr-tools and `ws` with the fallback (`src/api/strfry/commands/publishEvent.js:16–23`; row 271).
- Keep the publisher under `src/api/dlist-curation/`, which is test RE1's one exclusion
  (`test/publish-export-a-concept.test.js:113–135`).
- Choose a route that no owner-only substring rule catches (`src/middleware/auth.js:388–445`).
- **Origins.** The control panel reflects any origin with credentials, and its session cookie sets no `sameSite`
  (`bin/control-panel.js:114–119`, `:195–204`). That is a separate hardening task; this endpoint checks `Origin` itself.
- **Shell quoting.** Three strfry scan helpers quote their filters for a shell incorrectly. That is a separate task;
  this endpoint scans only with `spawn` and an argument list, as `src/api/strfry/queries/scan.js:86` does.

**Deletion support:** see §10.

**Live data.**
- Two `dog-breed` headers on the community relay use the older link: staging's TA `8e901369…`, and the customer
  assistant `253d40c4…`.
- The shared list's two items are only in this Mac Studio's local strfry.

## Options considered

### Option A — The browser re-checks; one endpoint takes references, re-reads, builds, signs and reads back (chosen)
- **The browser.** Pressing Publish re-reads everything (AC-2) and compares the fresh plan with the one I approved. It
  sends the endpoint only references, with version pins. It never sends an event.
- **The server.**
  - It checks the session and chooses my assistant's key.
  - It re-reads the header, my list and the shared list, and checks every reference against those reads before signing
    anything.
  - It builds each event from what it read, following ADR 0001 exactly.
  - It signs, publishes, reads each place back, and reports.
- **Pros.**
  - The assistant key signs only the convention's events, built from events the server read. The key's blast radius is
    this list.
  - The verdicts stay where the method lives: the browser's settings, and the scoring module the preview already runs.
  - The honest per-place results are the server's own.
- **Cons.**
  - Two re-checks, one in each half. The server can't re-judge verdicts: which originals qualify is this browser's call.
  - A large plan is split into batches (§6).

### Option B — A "sign this for my assistant" endpoint for events the browser builds
- **Pros.** It is the smallest server.
- **Cons.** It signs client-sent bodies. Any script running as the page could have my assistant sign anything. Rejected.

### Option C — The server computes the plan
- **Cons.**
  - The verdicts depend on this browser's method, point of view and cutoff, and on the UI's scoring module (ADR 0004).
  - The server would duplicate both, and the preview and the publish could disagree.

  Rejected.

### Option D — Extend `POST /api/dlist-curation/header` to take a batch
- **Cons.** Its contract (one header, never-clobber, 409) is pinned by its suite. Items and deletions would muddy both.
  Rejected.

### ADR 0003's Option C: one hook for the panel's add-then-sign sequence
- **Not needed.** Update doesn't change the Treasure Map, and all its events are signed by the assistant on the server.
  So it isn't a third caller of the panel's sequence. The recorded follow-up is closed (§11).

## Decision
We chose **Option A**.

1. **The endpoint: `POST /api/dlist-curation/update`.**
   - It lives in `src/api/dlist-curation/`, beside the header endpoint and inside RE1's exclusion. Its path contains no
     owner-only substring.
   - **Guards, in order:**
     1. **Origin.** A request whose `Origin` names a host other than the request's `Host` gets 403. A browser always
        sends `Origin` on a cross-site POST; a request with none (curl, in-container) goes on to the session check.
     2. **Session.** `requireAuth` → 401. The session's pubkey is the only identity.
     3. **Key.** `getAssistantKeys(sessionPubkey)`. A missing private key → 400 "no Tapestry Assistant is provisioned for
        this account". `getCustomerRelayKeys` answers an object of nulls, not `null`, so check the private key itself.
     4. **Body.**
        - Each of `list` (a kind-39998 coordinate), `ids` and `pubkeys` (64-hex) and the intents (below) is validated.
          A d-tag is a string of 1–256 characters with no control characters.
        - `list`'s pubkey must be my assistant's (`keys.pubkey`) → otherwise 403.
        - At most 50 intents per call (§6) → otherwise 413.
   - **The intents are references, never events:**
     - `copy: [{ original, version }]`: the original's route id (a 39999 address or a 9999 id), and the version id the
       preview judged;
     - `refresh: [{ copy, original, version }]`: the copy's route id, and the original's route id and new version id;
     - `delete: [{ copy, id }]`: the copy's route id, and the copy's current event id;
     - `upgrade: { dropsMarker }` or `null`.
2. **Re-read, then check every intent before signing anything.**
   - **Reads.** Every read is strict and uses two places, exactly as the preview does:
     - this instance's strfry, through the `spawn` scan;
     - the list's relay (`aDListRelays[0]`), through `readRelayEvents` (ADR 0005 §1).
   - **What is read:**
     - **My header:** my assistant's kind 39998 at `list`, the newest of the two places. It must name the shared header
       as its one real link, by the house rule (a real `b` beats the sentinel; `src/lib/bValueForms.js`). This reads
       strictly the header the upgrade will republish (story 5's review, Non-blocking 4).
     - **The shared list:** the items filed under the shared header (`#z`, kinds 9999 and 39999), from both places.
     - **My list:** my assistant's kind-39999 items filed under my header, from both places.
     - **My assistant's deletion requests** for its copies (`{ kinds: [5], authors: [assistant], "#k": ["39999"] }`),
       from both places. §3's timing and §7's flag use them. *(Amendment 2: the server reads only the requests that
       name this call's copies; §7's read is unchanged.)*
   - **Checks, per intent:**
     - A copy's or refresh's original must be on the shared list at `original`. For a 39999 original, the newest
       version at that address must be `version`; for a 9999, it must be the event with that id.
     - A refresh's copy, and a delete's copy, must be my assistant's item at `copy`. A delete's `id` must be that copy's
       current id.
     - A copy's derived address must not already hold a copy of that version.
     - The upgrade needs my header's real link to be the shared header, typed `inherit-items`.
   - **Refusals** (nothing signed in either case):
     - A read that failed or came back capped → 503 `{ couldntCheck: [...] }`. The words follow the preview's
       `listReadGaps`.
     - An intent that no longer matches → 409 `{ stale: [...] }`. The browser then shows the fresh preview.
   - **What the server does not do:** it doesn't re-judge verdicts. Which originals qualify is this browser's call, and
     §7's re-check owns it.
3. **Build each event from what the server read** (ADR 0001, exactly).
   - **Copy or refresh.**
     - Kind 39999, by my assistant.
     - Tags: `["d", copyD(myHeaderAddress, originalRef)]`, then `["z", myHeaderAddress]`, then the `q`s, then the
       carried tags in the original's order. `content` is the original's.
     - For a 39999 original: `["q", "39999:<author>:<d>", "<relay>"]`. For every copy:
       `["q", "<version id>", "<relay>", "<author>"]`. `<relay>` is the list's relay.
     - `created_at` is now. For a refresh it is `max(now, the copy's + 1)`. The refresh's recomputed `d` must equal the
       copy's.
     - `created_at` is also later than my assistant's newest deletion request for that address. The local relay refuses
       a version at a deleted address that isn't newer than the deletion (§10).
   - **Delete.** Kind 5, by my assistant, with:
     - `["a", "39999:<assistant>:<copy d>"]`;
     - an `["e", "<id>"]` for every version of the copy the server read, in either place, not only the newest;
     - `["k", "39999"]`.

     `content` is `""`, and `created_at` is now. No `a` ever names anyone else's address: the local relay rejects a whole
     deletion that does (§10). The extra `e`s are older versions of the same copy, so the deletion stays within ADR 0001
     §6.
   - **Upgrade.** My header's tags, with its real `b` replaced by `["b", <same target>, "pointer"]`.
     - When the header also carries `b-tag-deferred`, the upgrade drops it (Planning decision 2).
     - The request's `dropsMarker` must agree with what the server read, or the request gets 409.
     - `created_at` is `max(now, old + 1)`.
4. **Sign, publish, read back.**
   - **Signing.** `finalizeEvent`, with nostr-tools and `ws` loaded through the fallback.
   - **Order.** Copies and refreshes, then deletions, then the upgrade. My list's items are in place before its header
     changes what the list means.
   - **Where.**
     - **Local:** `publishToStrfry`. `--no-verify` is acceptable here only because the server signed the event.
     - **Then** each of `aDListRelays`, at most 4 in flight per relay.
     - With `isLocalOnly()`, every relay row is `skipped`.
   - **Relay classification** reads the settled value as well as the status. A fulfilled "connection failure: …" is
     `failed`, so a newer nostr-tools can't make it lie.
   - **Read-back.** Each place is re-read by id (the `spawn` scan; `readRelayEvents`).
     - An event that is there: `published`.
     - A publish that failed: `failed`, with the reason.
     - A publish that succeeded but the event isn't there: `not-stored`.
     - A local-only relay row: `skipped`.
     - For a deletion, after its request is stored, the copy is also re-read: `gone` or `still-there` (AC-9).
5. **The response:**
   `200 { success: true, results: [{ action, ref, name, places: { local: {...}, "<relay>": {...} } }] }`.
   - Each place is `{ status, error? }`, and a deletion's place adds `copy: 'gone' | 'still-there'`.
   - Nothing is retried (Planning decision 4).
6. **Batches.** The browser sends the approved intents in calls of at most 50, in §4's order, with the upgrade alone in
   the last call.
   - Each call re-reads and re-checks (§2), so a later call is judged against what the earlier ones wrote.
   - The first refused call stops the run. What was already published is reported, and the browser re-reads.
   - A call stays well inside nginx's default 60-second proxy timeout. `docker/nginx.conf` gives 600 seconds only to
     three long routes (`:9–36`), and this route isn't one of them. *(Replaced by Amendment 2: the steps' own timeouts
     don't bound a call; a 45-second deadline does.)*
7. **The browser** (`ui/src`).
   - **`updatePlan`'s entries gain their pins** (ADR 0005 §7):
     - copy and refresh entries carry `version`, the original's current id;
     - delete entries carry `copyId`;
     - `upgrade` carries `dropsMarker` from `header.marker`.

     `planIntents(plan)` gives the canonical intents: sorted, with no names or scores. They are compared, and they are
     the request body.
   - **`describeCurationHeader`** gains `marker`: `b-tag-deferred` present beside a real link. The detail page passes it
     in `headerState`.
   - **`UpdatePreview`.**
     - When the plan is `ready` and not up to date, it shows **"Publish these changes"**. It shows nothing to press
       otherwise: checking, blocked and up to date already say why.
     - The upgrade line adds ", and remove its “deliberately unaffiliated” marker" when `dropsMarker` is set.
     - Story 5's closing line, "Nothing is signed: publishing isn't built yet.", goes.
   - **Pressing Publish:**
     1. It bumps an `epoch` shared by the section's reads. `useListItems`, `useItemVotes` and `useTrustWeights` take it
        into their keys, and the header lookup is re-read through `useCurationHeaders`' `refresh()`.
     2. When the fresh plan settles:
        - blocked: its reasons are shown;
        - different intents: "The list changed since you pressed Publish; here is the new preview." Nothing is sent;
        - the same intents: §6's calls.
     3. The results are shown per item and per place:
        - "published";
        - "failed: <reason>";
        - "sent, but <place> didn't keep it";
        - "not sent: this instance publishes locally only";
        - for a deletion, "<place> still shows it".

        *(Amendment 2 adds the unknown outcome: an answer that isn't the endpoint's own never reads as "Nothing was
        published.")*
     4. It bumps the `epoch` again, so the next preview proposes only what is still missing (AC-8).
   - **Deletions that aren't honored (AC-9).** The items section also reads my assistant's deletion requests
     (`{ kinds: [5], authors: [assistant], "#k": ["39999"] }`, both places, strict). A copy on my list that one of them
     names, by its address or its id, is flagged "⚠️ deletion requested — still shown by <place>". While such a copy's
     original doesn't qualify, the preview proposes deleting it again, noting "(asked before)".
8. **R2-2.**
   - `curateHereOffer` takes `viewerPubkey`. After `target`, it answers `{ status: 'unavailable', reason: 'own' }` when
     `info.pointer.pubkey` is the viewer's pubkey or my assistant's. This mirrors the endpoint's refusal (`index.js:259–261`)
     and the panel's exclusion (`DListCurationPanel.jsx:105–108`).
   - The sentence: "You can't curate it here: the shared list it curates is yours, or your assistant's."
   - The detail page passes the session pubkey.
9. **The panel's 409 sentence** (`DListCurationPanel.jsx:261–265`) becomes the offer's: "Your assistant already has a
   header for this list with a different link; it was not changed." The `b` tags still print beneath it.
10. **Deletion support (AC-9), before the story is done.** A read-only survey, 2026-09-13; nothing was published:
    - **This instance's strfry** is 1.1.0, with no write-policy plugin.
      - It stores kind 5, and honors both forms for the same author: `e` deletes the named event, and `a` deletes every
        version at the address up to the deletion's `created_at`.
      - It refuses a later re-send of what it deleted.
      - It rejects a whole deletion whose `a` names another author.
    - **The community relay** is strfry 1.0.4, per its NIP-11. It advertises no NIPs; that is an operator setting, and the
      deletion code runs regardless.
      - It stores kind 5: it holds 55, and none of their `e` targets remains.
      - It honors only `e`, for the same author. The address form arrived in strfry 1.1.0, so a deletion there removes
        only the versions it names, and only exact ids are refused later.
    - **Neither travels by router.** Kind 5 isn't streamed at all, and a copy's `z` matches none of the router's
      filters. So both go to the community relay directly, as §4 does.
    - **Hence:**
      - a deletion names every version the server read (§3), so a refresh that reached one place but not the other is
        still covered;
      - a re-copy is timed after the deletion (§3);
      - the read-back reports `gone` or `still-there` per place, and the page flags the rest (§7).
    - **No separate public test write.** The first real Update's read-back is the live check: a deletion reported
      `still-there` is flagged rather than trusted. A live throwaway test on the community relay would be a public write,
      so it happens only with the operator's OK.
    - **Remaining:** an older version replayed to the community relay is accepted again. The fix is that relay's upgrade
      to strfry 1.1.0 or later, for its operator (a new OPEN.md row).
    - **Optionally, during Implementation,** the local `a` form, which is read from source but not yet observed, is
      checked on a scratch stack.
11. **Superseded in part.** Each ADR below gets a Status parenthetical and a one-line note citing `curated-dlist-update`
    ADR 0006 by short name:
    - **ADR 0002:** its Consequences' "upgrades exactly the headers `classifyExisting` and `describeCurationHeader` mark
      as `older`". The house rule gates the upgrade now, and the sentinel is dropped.
    - **ADR 0003:** Option C's recorded follow-up is closed, and §5's availability gains `own`.
    - **ADR 0005:** §7's entries gain their pins, and §8's closing line goes.

## Consequences
- **Enables:** Update list acts. This is the first batch signer, and the first kind-5 composer, for an assistant.
- **Constrains:**
  - A large plan publishes in batches, and a refused batch stops the run with what was already published reported.
  - The browser holds the verdicts; the server holds the convention and the ownership.
- **Debt, recorded:**
  - **Inactive customers.** `getCustomerRelayKeys` never checks that a customer is active. A deactivated customer's
    assistant can still sign here, as it can through the header endpoint. The two are fixed together (a new OPEN.md row).
  - **The header endpoint** keeps its local-only never-clobber read and its status-only relay classification (a new
    OPEN.md row, tied to the nostr-tools range).
  - **The community relay honors only `e` deletions** (strfry 1.0.4), so a replayed older version of a deleted copy is
    accepted there again. The fix is its upgrade (a new OPEN.md row, §10).
  - **No rate limiting.**
  - **Browser settings.** The method, point of view and cutoff remain per browser, so two browsers can publish different
    plans (the book's constraint).
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes
1. **`src/api/dlist-curation/updateEvents.js`** (new, pure, no nostr-tools):
   - `copyD(headerAddress, originalRef)` (`crypto.createHash('sha256')`);
   - `composeCopy({ original, headerAddress, assistant, relay, now, existing })`;
   - `composeDeletion({ copy, assistant, now })`;
   - `composeUpgrade({ header, now })`;
   - `validateUpdateBody(body)`.
2. **`src/api/dlist-curation/update.js`** (new).
   - `createUpdateHandler(deps)` takes injected `scan`, `readRelay`, `publishLocal`, `publishRelay`, `getKeys`,
     `requireAuth`, `sign`, `now`, `localOnly` and `relays`.
   - The real `scan` is a `spawn('strfry', ['scan', JSON.stringify(filter)])` helper.
   - It is registered from `src/api/dlist-curation/index.js`.
3. **`ui/src/utils/treasureMap.js`:**
   - `updatePlan`'s pins and `dropsMarker`;
   - `planIntents`;
   - `describeCurationHeader`'s `marker`;
   - `curateHereOffer`'s `viewerPubkey` and `own`.
4. **UI pages and hooks:**
   - `ui/src/pages/grapevine/UpdatePreview.jsx`: the button, the states, the results, and the marker clause;
   - `CuratedDListItems.jsx`: the `epoch`, the publish run, the deletion-request read and its flag;
   - `CuratedDListDetail.jsx`: `marker`, the header `refresh()`, and `viewerPubkey`;
   - `CurateHereOffer.jsx`: `REASON_TAILS.own`;
   - `DListCurationPanel.jsx`: the 409 sentence;
   - `ui/src/hooks/useListItems.js`, `useItemVotes.js`, `useTrustWeights.js`: the `epoch`.
5. **Docs:** §11's notes, and the three OPEN.md rows in § Consequences: inactive customers; the header endpoint's
   limits; the community relay's strfry version.
6. **Local check (cycle-local).** The server changes, so restart `brainstorm` after warning the other local sessions.
   - **Through the fetch stub:**
     - the button shows only on a ready plan that isn't up to date;
     - have the stub answer the update endpoint with canned results to check the results and the re-read. It can't sign
       as a customer here;
     - a refusing stub answer shows 409 as "the list changed" and 503 as "couldn't check".
   - **Handler tests** cover the real signing path.
   - **A live publish** writes public events, so it needs the operator's OK (§10).

**Testable seams (the Tester's call).**
- **Pure:** `copyD` against ADR 0001 §4's formula; `composeCopy`'s exact tags and content, with nothing else carried;
  `composeDeletion`'s `a`, `e` and `k`; `composeUpgrade` with and without the sentinel; `validateUpdateBody`'s refusals.
- **The handler, through its dependencies:**
  - a foreign `Origin` → 403; no session → 401; no key → 400;
  - an admin gets their own key; another user's list → 403;
  - over 50 intents → 413;
  - an unreadable place → 503, and a stale intent → 409, with nothing signed in either case;
  - a delete of a copy that isn't my assistant's → refused;
  - the order;
  - local-only → `skipped`;
  - a fulfilled "connection failure" → `failed`;
  - read-back → `not-stored` and `still-there`;
  - no request body is ever signed.
- **The UI:** `planIntents`; the pins; `marker`; `curateHereOffer`'s `own`.
- **Structural:** the button and the result words; the `epoch`; the 409 sentence; `REASON_TAILS.own`; story 5's closing
  line gone.
- **Docs:** §11's notes.

## Out of scope
- Choosing items one by one; a schedule; undo.
- The control panel's CORS and cookie hardening, and the strfry scan quoting: separate tasks.
- The Trusted List's author gap (a separate task).
- Rate limiting, and the inactive-customer check (both recorded).
- The endpoint's other non-strict callers (row 280), and the presence probe's EOSE gap (row 292).

## Amendment 1 (2026-09-13, from Test Design, approved at its gate)

Found while writing story 6's tests. §2 contradicts the Security constraints in one place, and leaves one value unset.
- §2's check says a refresh's or a delete's copy "must be my assistant's item at `copy`". That admits my assistant's own
  items that aren't copies, such as an item added by hand, which carries no `q`. The Security constraints say deletions
  are limited to "my assistant's own copies".
- A read can only be seen to come back capped if it carries a limit, and §2 names none.

The corrections:
1. **A delete's or a refresh's target is one of my assistant's copies:** its kind-39999 item filed under my header that
   carries a `q` (ADR 0001 §5), the same rule by which `updatePlan` finds copies.
   - An intent that names anything else no longer matches a copy. That includes another author's item, and my
     assistant's own item with no `q`.
   - Such an intent gets §2's 409, listed under `stale`, and nothing is signed.
   - Update never deletes or refreshes an item that was added by hand.
   - As in the preview, the newest version at the target's address decides. If that version carries no `q`, it isn't a
     copy.
2. **Each server read carries a limit of 500,** the preview's `LIST_ITEMS_LIMIT` (ADR 0005 §4). That covers the shared
   list, my list and my assistant's deletion requests, in both places.
   - An answer of 500 events or more counts as capped, and gets §2's 503. A relay that ignores the limit and answers
     more is capped too.
   - An answer below 500 is complete.

Nothing else in §2 changes.

## Amendment 2 (2026-09-13, from Review round 1, approved at its Architecture gate)

Story 6's first review found that a call can outlast the proxy's timeout, and that the page then misreports it (its
Blocking 1). It also found a read that only grows (its Non-blocking 1).
- **§6 claims a bound the code doesn't have.** It says a call "stays well inside nginx's default 60-second proxy
  timeout". But each step is bounded only by its own timeouts:
  - my header, my list and the deletion requests are read together, in up to 15 seconds: a relay read is two 5-second
    connection attempts and a 5-second query. The shared list's read then takes up to 15 more;
  - this instance's imports run one after another, at up to 5 seconds each;
  - a relay gets one connection, allowed 5 seconds, and at most 4 sends at once, each allowed 5 seconds;
  - the read-back takes up to 30 seconds per place.

  So a 50-intent call runs for about two minutes when the community relay is slow, or when a second DList relay accepts
  connections and never answers.
- **The page then says the opposite of what happened.** nginx answers 504 while the server goes on publishing.
  `publishIntents` reads any answer it doesn't expect as a refusal, so the page shows "Nothing was published." AC-8
  says a partial failure is shown, never hidden.
- **§2's deletion-request read only grows.** It reads every deletion request my assistant ever sent for a kind-39999
  item, on any list. None is removed, and each Update deletion adds one. From 500, Amendment 1's limit makes every call
  a 503, for good. The server uses these requests only for §3's timing, which needs only those that name this call's
  copies.

The changes:
1. **Each call answers within 45 seconds of the handler's start.** This replaces §6's last point. nginx's default is 60
   seconds. Neither the container's nginx nor the droplets' host nginx, as OPERATIONS.md sets it up, gives this route a
   longer one; the rest is margin for the trip.
   - **The reads are unchanged.** Their own timeouts bound them at about 30 seconds, and a failed read still gets §2's
     503.
   - **A send starts only while there is time for it.** A send is an import into this instance or a publish to a relay.
     One starts only in the first 25 seconds: the deadline, less 10 seconds kept for the read-back and 10 for one send's
     worst case (a connection, then a publish).
   - **What wasn't sent is reported per place:** `failed`, "not sent: out of time". A place that took the event keeps
     its own status.
   - **The read-back gets the time that is left.** A place not read back by the deadline is `failed`, "sent, but
     couldn't read it back: out of time", the words story 6's Deviation 6 gives any failed read-back.
   - **Nothing new in the answer.** The statuses are §4's and the answer is §5's 200. The next Update proposes again
     whatever wasn't sent (Planning decision 4).
   - **The run is unchanged.** A call that ran out of time isn't a refusal, so the browser goes on to the next call,
     which re-reads first (§6).
   - **The clock.** The handler reads the time through a new injected `nowMs` (milliseconds; `Date.now` by default), so
     tests can move it. `now` stays the `created_at` clock.
2. **An unknown outcome is never reported as "nothing"** (§7, step 3). The browser sorts each call's answer:
   - **a 200 with the endpoint's body** (`success: true` and `results`): its results;
   - **one of the endpoint's own refusals,** all made before anything is signed: a 400, 401, 403, 409, 413 or 503 with
     the endpoint's body (`success: false`). The call published nothing, and the run stops with today's words
     *(Amendment 3: any 4xx is a refusal, whatever its body)*;
   - **anything else is unknown:** no answer, a dropped connection, a 500, a 502 or 504, or a body that isn't the
     endpoint's. The run stops, and the page says: "⚠️ Publishing stopped without an answer (<reason>); some changes
     may have been published. Your list has been read again, so the preview above proposes only what is still to do."
     `<reason>` is "the server answered <status>", "the answer couldn't be read", or "no answer arrived".
   - **"Nothing was published."** shows only when no call's outcome is unknown.
   - **The sorting is pure:** `updateAnswer(status, data)` in `ui/src/utils/treasureMap.js`, beside `planIntents`. A
     failed fetch is `updateAnswer(null, null)`.
   - With the deadline, the server has finished before nginx would answer 504, so the re-read after a 504 shows what
     landed.
3. **The server reads only the deletion requests for this call's copies** (§2's fourth read). The filter becomes
   `{ kinds: [5], authors: [assistant], "#a": [...], limit: 500 }`, over this call's copy addresses: each copy intent's
   derived address (§3's `d`) and each refresh's `copy`. That is at most 50 addresses.
   - A call with no copies or refreshes skips the read.
   - Amendment 1's limit and its 503 still apply, but the count no longer grows with every Update.
   - §3's timing is unchanged, and so is §7's read, for the page's flag (below).

**Consequences.**
- **Debt, recorded:**
  - §7's read, for the page's flag, still reads every deletion request. From 500 it names a gap, and its flags may be
    incomplete; it never stops Update. It can't be narrowed the same way: a list's copies can number 500, too many
    addresses for one GET (OPEN.md row 299).
  - The server takes the list's relay from settings (`aDListRelays[0]`), and the page from a constant
    (`COMMUNITY_RELAYS[0]`). Both are the community relay by default. An operator who changes the setting makes Publish
    come back 409, which fails safe (OPEN.md row 300).
- **Story 6's Deviation 5 is corrected:** one connection per relay doesn't by itself keep a call inside 60 seconds.

**Implementation notes.**
1. `src/api/dlist-curation/update.js`: the deadline and the send cutoff; `nowMs` among the injected dependencies; the
   cutoff checked before each import and each relay send; the read-back bounded by the time left; the narrowed read.
2. `ui/src/utils/treasureMap.js`: `updateAnswer`.
3. `CuratedDListItems.jsx`: `publishIntents` sorts each answer with `updateAnswer`.
4. `UpdatePreview.jsx`: the unknown sentence, and "Nothing was published." only when no outcome is unknown.
5. **Local check:** the fetch stub also answers 504, and fails a fetch once. The page shows the unknown sentence, not
   "Nothing was published." Handler tests cover the deadline itself.

**Testable seams (the Tester's call).**
- **The handler:**
  - with a `nowMs` that sends move forward, no send starts after the cutoff, and each item not sent is `failed`, "not
    sent: out of time", at that place;
  - with a read-back that doesn't answer and no time left: "sent, but couldn't read it back: out of time";
  - the handler answers in both cases;
  - the deletion-request filter is `#a` over exactly this call's copy and refresh addresses, and a call with neither
    makes no such read;
  - a re-copy is still timed after a request the narrowed read finds.
- **The UI:** `updateAnswer` for a 200, each own refusal, a refusal status without the endpoint's body, a 500, a 502, a
  504 and a failed fetch. Structurally: the unknown sentence, and when "Nothing was published." shows.
- **Docs:** the pointers in §2, §6 and §7; Deviation 5's correction; OPEN.md rows 299 and 300.

Nothing else changes.

## Amendment 3 (2026-09-13, from Test Design round 2, approved at its gate)

Found while writing round 2's tests. Amendment 2 counts a 400, 401, 403 or 413 as a refusal only with the endpoint's
body. But the auth middleware answers a session that has expired with `401 { error }`, with no `success: false`
(`src/middleware/auth.js:482`, `:496`), before the handler runs. Under Amendment 2 the page would then say "some
changes may have been published" when nothing was.

Every 4xx is answered before anything is signed: by the endpoint's guards, the auth middleware, the body parser or
nginx. The endpoint signs only after all of its refusals, and once it has signed it answers only 200, or 500 from its
catch.

The change, to Amendment 2's change 2:
- **Any 4xx is a refusal, whatever its body.** The call published nothing. The page says "⚠️ Publishing stopped:
  <message>". `<message>` is the body's `error` when it has one, else "the server answered <status>".
- **A 409 or a 503 with the endpoint's body** keeps its own words: the list changed (409), or couldn't check, with its
  `couldntCheck` (503).
- **Everything else is unknown,** as Amendment 2 says:
  - a 5xx other than the endpoint's 503, including a 500 with `success: false`;
  - a 2xx or 3xx that isn't the endpoint's 200;
  - no answer.
- **The endpoint keeps this true:** it answers every 4xx before it signs anything. §2's refusals already do. A later
  change that refuses after signing must answer with a 5xx, or change this rule.

**Testable seams (the Tester's call).**
- `updateAnswer` for 4xx answers without the endpoint's body: the middleware's `401 { error }`, a bare 403, 404 and 413,
  and a 409 without its body. Each is a refusal with its message.
- 5xx answers without the endpoint's body stay unknown, as do a 204 and a 3xx.
- A docs check for this amendment.

Nothing else changes.
