# ADR 0002: The Assistant signs its Duty Menu through one narrow route, and the menu is read here first

**Status:** Accepted (by the owner, 2026-10-11)
**Date:** 2026-10-11
**Story:** `engineering-team/stories/assistant-duty-menu/2-your-assistant-publishes-its-duty-menu.md`

## Context

Story 2 adds publishing to the Duty Menu page that story 1 built. Its acceptance criteria:

- **AC-1: the button and its report.**
  - **When it's enabled.** The button is enabled only while the menu isn't current, and shows **Publishing…** during
    a publish.
  - **The report.** The Outbox Relays page's report: one summary line and one line per relay.
  - **After a write.** The answer is asked for again.
- **AC-2: whose key, and what is signed.**
  - The request names nothing, and the session decides whose Assistant signs.
  - Refusals come first: not signed in, then no Assistant here.
  - What is signed is a kind-`39999` Duty Menu and nothing else, built from the server's own offer.
  - No other route gains signing power, and nothing publishes automatically.
- **AC-3: the event.**
  - `d` = `duty-menu`, one `p` (the Assistant), Nous' `z`, and one `duty` row per offer row. Rows only (the owner's
    answer to open question 1).
  - It is valid by `duty-menus.md` § 6.1 (five conditions).
  - An empty offer still publishes an empty menu.
  - Its `created_at` is later than the newest version found.
- **AC-4: where it goes.**
  - This instance's relay first. If that write fails, it goes nowhere.
  - Then, each once:
    - the Assistant's outbox relays;
    - the relays the new rows name;
    - the relays the menu found at publish time named;
    - Nous' write relays.
  - Local-only mode keeps it local.
  - Relays that come from events are sent to only when their address is public, at most 50 of them.
  - A relay counts only when it accepted, and the report comes within a bounded time.
- **AC-5: this instance's relay first, when reading.** If it holds any version of the menu, the newest there counts
  and no outside relay is asked. "Finished" keeps its meaning.
- **AC-6: an empty menu says so.** A found menu with no rows says "Your Assistant's Duty Menu lists no duties."

**Concept Graph.** The stack is absent (AGENTS.md § 2 fallback). No concepts change. The handles the story cites are
re-verified against a live graph as in ADR 0001.

**The precedent: `src/api/assistant/relayListPublish.js`** (ADR assistant-outbox-relays/0003, Amendments 1 and 2).
Story 2 is the same act for a different event, and the precedent has every piece:
- a session-bound `POST` with refusals before any key is read (`:205-222`);
- `getAssistantKeys(viewer)`, which gives the TA for the Owner and the person's own key otherwise (`:154-157`);
- the newest version found, with `created_at` = max(now, newest + 1) (`:163-165`);
- `finalizeEvent` (`:167`);
- `importToLocalRelay` first, with no fan-out if it fails (`:173-185`);
- `outsideOnly` over the set;
- the configured ("owned") relays sent without a lookup, and every event-named relay checked by
  `isPublicRelayHostWithin` inside one 3 s budget (`:193-203`);
- `publishToRelays`, and `summarizePublish` with a subject (`:205-207`);
- the client helper `ui/src/utils/publishAssistantRelayList.js`, and the page's `onPublish` with `describeServerPublish`
  and `attention.refresh()` after a write (`ui/src/pages/assistant/OutboxRelays.jsx:106-129`).

**Story 1's pieces this story reuses** (`src/api/assistant/dutyMenu.js`, `src/lib/duty-menu`):
- `resolveOfferInputs` + `buildOffer` (the offer);
- `lookupPublishedMenu` (the § 8.1 read, with the 50-relay cap and the guard);
- the Assistant's and Nous' write relays (the first round's hint lookups and the one-hour Nous cache);
- `isDutyMenu` (§ 6.1, five conditions) and `readMenuRows`.

**Story 1 review items this story carries** (epic, story 2's carry-forwards):
- NB1 and NB2: hub latency, which becomes AC-5;
- NB5: `isDutyMenu` never compares `event.pubkey`;
- NB7: an empty found menu, which becomes AC-6;
- NB9 and NB12: doc touch-ups;
- NB10: the relay-list-publish S3 sentinel, which story 1 re-aimed with a carve-out because `dutyMenu.js` took the DNS
  guard from the publish module (ADR 0001 Amendment 1 item 8).

**The spec.** `duty-menus.md`:
- **What a publisher writes** (§§ 4–5), the § 8.1 publisher paragraph and § 11 are unchanged by
  `duty-menus-and-self-maps` #3's spec pass (`05225a6b`). That pass changed only reader and client rules (§§ 2,
  6.1, 6.2, 10, 14), and § 6.1's five conditions are already ours (ADR 0001 Amendment 2).
- **A version without Nous' `z` is not a menu**, and § 8.2's `#z` query never returns it. Every version this route
  writes carries it.

## Options considered

### Option A: a narrow route of its own, `POST /api/assistant/duty-menu/publish`, building the menu on the server

A new module, `src/api/assistant/dutyMenuPublish.js`, in `relayListPublish.js`'s shape.
- **The request** carries no body that matters. The server computes the offer with story 1's functions at publish
  time, builds the tags, signs with the session's Assistant, and sends.
- *Pros:*
  - AC-2's "nothing in the request can change a row" holds by construction;
  - the signing surface stays one route per event, as ADR assistant-outbox-relays/0003 chose;
  - every piece is reused.
- *Cons:* one more route to keep narrow, and sentinel tests to say so.

### Option B: generalize `relayListPublish.js` into an "Assistant publishes kind K" route

- *Cons:* it widens the one route that can sign as an Assistant to several kinds, the opposite of ADR
  assistant-outbox-relays/0003's narrowing. **Rejected.**

### Option C: the browser builds the template and the server only signs it

- *Cons:* the rows would come from the request, which AC-2 forbids, and the server would have to re-validate every
  tag. **Rejected.**

### For AC-5, the read

**R-A: this instance's relay first, and the hint round skipped when it holds a version.**
- A local scan for the Assistant's menu runs first. If it returns any version by the Assistant at `d` = `duty-menu`,
  the newest there counts. Neither round 1 (the Map and the two relay lists) nor round 2 runs.
- Otherwise, story 1's two rounds run unchanged.
- *Pros:* once a menu is published here, a hub load does one local scan for this action, with no outside I/O.

**R-B: local first for the menu only, keeping round 1.**
- *Cons:* it still costs the Map lookup and the two relay-list lookups on every hub load, which is most of NB1.
  **Rejected.**

## Decision

**Option A, with R-A.** One narrow route per signed kind is the house's rule. Building on the server is the only way
to make AC-2 hold by construction. R-A removes every outside read from the steady state.

### Sub-decisions

1. **The route and module.** `POST /api/assistant/duty-menu/publish` → `src/api/assistant/dutyMenuPublish.js`,
   registered in `src/api/index.js` beside the outbox route (`:603-604`), with a comment in that block's voice.
   - **Exports:**
     - `createPublishDutyMenuHandler(deps)` and `handlePublishDutyMenu`;
     - `publishDutyMenuFor({ viewer }, deps)`;
     - `DUTY_MENU_SUBJECT = "Your Assistant's Duty Menu"`;
     - `CODES` and `WORDS`.
   - **The handler, in order:**
     1. 401 `not-signed-in` without an authenticated session, as `relayListPublish.js:209-212`.
     2. `publishDutyMenuFor`, which reads the keys and answers 403 `no-assistant` when `getAssistantKeys` gives no
        private key, before anything else is read.
     3. 500 with `WORDS.failed` on a throw.
   - **The body is never read.**
   - **The words** are story § Copy's refusals. `WORDS.failed` is "Could not publish your Assistant's Duty Menu".
2. **The menu's tags come from one pure function**, `buildMenuTags({ assistantPubkey, offer })` in
   `src/lib/duty-menu`:
   - `["d", "duty-menu"]`, `["z", DUTY_MENU_HEADER]`, `["p", <assistant>]`;
   - then one `["duty", key, relay]` per `duty` row of the offer, in its order.

   There are no other tags (rows only), and `content` is `''`. The offer is the one the check computes:
   `buildOffer(await resolveOfferInputs(viewer, d))`, the same call at the same moment's settings.
3. **The author check (NB5).** After `finalizeEvent`, the route checks two things before anything is written:
   - the signed event's `pubkey` equals the Assistant's;
   - `isDutyMenu(signed, signed.pubkey)` holds.

   If either fails, it throws (500), which never happens with a sound key store. `isDutyMenu`'s doc comment gains one
   sentence: callers must have checked the event's `pubkey` themselves. The check already does (`mine()` filters by
   author before `isDutyMenu`).
4. **The newest version at publish time.**
   - **How it's read.** By the same read the check uses (sub-decision 7's local-first `lookupPublishedMenu`). The
     lookup's return gains the raw newest event, `latest` (any validity), beside `published`. The answer's shape is
     unchanged: `evaluateDutyMenu` ignores `latest`.
   - **`created_at`** = max(now, `latest.created_at` + 1) when there is one, as `relayListPublish.js:164`.
   - **The earlier version's relays** are `readMenuRows(latest)`'s `duty` relays, read even from an invalid `latest`,
     so a relay that holds a bad version is still sent the replacement.
5. **Where it goes (AC-4).** First `importToLocalRelay(signed)`. On failure the route answers
   `ok: false, stage: 'local'` with `localFailureMessage(DUTY_MENU_SUBJECT, reason)`, and nothing is sent. Then:
   - **Configured relays,** sent without a DNS lookup: the new rows' relays (this instance's own is removed by
     `outsideOnly`; the DList fallback is a Relay Settings entry).
   - **Event-named relays,** in § 8.1's publisher order:
     - the Assistant's write relays, from its newest kind 10002;
     - the earlier version's row relays;
     - Nous' write relays, through story 1's lookup and cache. Nothing is sent to Nous when its list isn't found.

     They are normalized, put through `outsideOnly`, de-duplicated against each other and the configured set, and
     capped at `MAX_RELAYS` (50). Each must pass `isPublicRelayHostWithin` within one 3 s budget, or its row reads
     `not-sent: not a public address`. Relays beyond the cap are not tried and get no row.
   - **Local-only mode:** every relay of the set reads `skipped: local-only publish mode`.
   - **The report** comes from `publishToRelays` and then `summarizePublish({ subject: DUTY_MENU_SUBJECT, rows,
     localOnly })`.
   - **The answer:** `{ success: true, result: { ok, outcome, message, localOnly, duties, relays: { total, success,
     results } } }`, where `duties` is the number of `duty` rows signed (0 → story § Copy's empty line).
6. **The DNS guard gets a shared home (NB10; ADR 0001 Amendment 1 item 8, done now).**
   - **The move.** `isPublicRelayHostWithin`, its `within` helper and `LOOKUP_BUDGET_MS` move unchanged into a new
     `src/utils/relayHostGuard.js`.
   - **Compatibility.** `relayListPublish.js` imports them from there and keeps re-exporting `isPublicRelayHostWithin`
     and `LOOKUP_BUDGET_MS`, so its own tests and callers are untouched.
   - **The new users.** `dutyMenu.js` and `dutyMenuPublish.js` require `src/utils/relayHostGuard`, never
     `relayListPublish.js`.
   - **The sentinel.** `assistant-relay-list-publish` S3 goes back to "only `src/api/index.js` names the module"
     (Phase 3).
7. **The read, local first (AC-5, R-A).** `lookupPublishedMenu` starts with the strict local scan for the menu.
   - **If it succeeds and holds any event by the Assistant at `d` = `duty-menu`,** the newest there is `latest`, the
     lookup is finished, and no hint lookup or relay read runs.
   - **Otherwise** (a scan with none, or a failed scan), story 1's two rounds run as they do today. A scan that
     succeeded with none still counts toward "finished", as before.
   - **The cost of this.** A newer menu that exists only on an outside relay, published with this key somewhere
     else, isn't seen while this instance's relay holds an older one. § 8.1 ("Fewer relays") allows that, and only
     this instance holds the key.
8. **The page (AC-1, AC-6).**
   - **New client helper** `ui/src/utils/publishAssistantDutyMenu.js`: one `POST`, no body, answering
     `{ status, ...json }` or throwing "This instance did not answer", as `publishAssistantRelayList.js`.
   - **`DutyMenu.jsx`** gains the button, the report and the notice in the Outbox Relays page's shape
     (`OutboxRelays.jsx:106-129` for `onPublish`, its report block for the lines):
     - **The button is enabled** unless a publish is under way, the answer is still on its way
       (`phase === 'checking'`), or the answer says `current === true`.
     - **After a written menu** (`result.ok === true`) → `attention.refresh()`. A refusal or a failed local write
       refreshes nothing.
     - **The empty line** ("now lists no duties") shows when `result.ok && result.duties === 0`.
   - **AC-6:** when `published.rows` is empty, the published panel shows "Your Assistant's Duty Menu lists no duties."
   - **New words** go in `dutyMenuCopy.js` under `DUTY_MENU_COPY.publish` (`button`, `publishing`, `subject`, `empty`,
     `requestFailed`) and `DUTY_MENU_COPY.emptyMenu`. The per-relay lines are `taggingPublishReport.js`'s `relayLine`.
9. **Docs.**
   - `src/api/openapi.yaml`: the new route, and in the attention entry a note that the read is local-first.
   - BIBLE §11: a row for the route, and on the attention row the DList fallback and the 50-relay cap (NB12).
   - `attention.js`'s header lines 10 and 48 (NB9): the check list and the answer shape name the duty-menu check.

## Consequences

- **What this enables.**
  - Every Assistant on this instance can publish an honest menu with one press, and its card becomes **Done**.
  - Once published, a hub load reads the menu from this instance's relay alone. That settles NB1 and NB2 in the
    steady state; the worst case before a first publish stays as story 1 left it.
- **What it constrains.**
  - A menu signed elsewhere with the same key and published only outside is shadowed by an older local one (R-A's
    cost). The Assistant's key lives only here, so this needs a key export no flow offers.
  - Republishing is manual: when Relay Settings or a customer's status changes the offer, the card goes back to
    **Needs attention** until the person presses again. Auto-publishing is out of scope (story § Out of scope).
- **The guard's move touches a shipped security module,** `relayListPublish.js`, but only by moving three
  declarations and importing them back. Behavior is unchanged, and its suite must stay green unedited (Phase 3 re-aims
  only S3, back to strict).
- **Nous' header is still unpublished.** Menus carry its `z` regardless, and § 8.1's by-author lookup finds them.
- **Firmware reinstall required?** No.

## Implementation notes

- **New `src/utils/relayHostGuard.js`:** `isPublicRelayHostWithin(host, { timeoutMs, Resolver })`, `within(promise,
  ms, fallback)` and `LOOKUP_BUDGET_MS = 3000`, moved verbatim from `relayListPublish.js:98-145`. It requires
  `net`, `dns` (lazily, as today) and `isPublicAddress`/`hasPrivateHostSuffix` from `./ssrfGuard`.
- **`src/api/assistant/relayListPublish.js`:** delete the moved code, require it from `../../utils/relayHostGuard`,
  and keep the same exports.
- **`src/lib/duty-menu/index.js`:** add `buildMenuTags({ assistantPubkey, offer })` (pure), plus the one sentence on
  `isDutyMenu`'s caller duty.
- **`src/api/assistant/dutyMenu.js`:**
  - `lookupPublishedMenu` gains the local-first step (sub-decision 7) and returns `latest`;
  - export the two write-relay helpers for the publisher, `assistantWriteRelays({ assistantPubkey }, d)` and
    `nousWriteRelays(relays, d)`, with the Nous cache shared, not duplicated;
  - the guard seam's default requires `../../utils/relayHostGuard`.
- **New `src/api/assistant/dutyMenuPublish.js`** (sub-decisions 1–5):
  - `defaultDeps()` as `relayListPublish.js` has it: `getAssistantKeys`, `privkeyBytesOf`, `getPublicKey`,
    `finalizeEvent`, `importEvent`, `isLocalOnly`, `publishToRelays`, `isPublicHostname` and `now`;
  - plus story 1's `resolveOfferInputs`, `lookupPublishedMenu`, `assistantWriteRelays`, `nousWriteRelays`,
    `outsideOnly` and `getConfiguredPublishRelays`.

  All of them are seams, so tests need no key store, strfry or relay.
- **`src/api/index.js`:** `app.post('/api/assistant/duty-menu/publish', require('./assistant/dutyMenuPublish').handlePublishDutyMenu);`
  beside the outbox route.
- **UI:**
  - new `ui/src/utils/publishAssistantDutyMenu.js`;
  - `ui/src/pages/assistant/DutyMenu.jsx` (button, report, notice, empty-menu line);
  - `ui/src/pages/assistant/dutyMenuCopy.js` (the new words);
  - CSS only if the report needs a class the outbox page's report doesn't already have.
- **Docs:** `src/api/openapi.yaml`, the BIBLE §11 rows, and `attention.js`'s header (sub-decision 9).
- **Phase 3 (the Tester), never Phase 4:**
  - a new suite for the route, in `test/assistant-relay-list-publish.test.js`'s shape (P- and A-series: refusals,
    the event, the order of writes, the guard, the cap, local-only, the budget);
  - additions to the story 1 suites: `buildMenuTags`, the local-first read and `latest`, the page's button, report
    and empty line;
  - re-aims of story 1 tests that assume outside reads while a local version exists (for example U15's "a newer
    menu outside beats an older one here");
  - S3 back to strict;
  - registry lines.
- **Branches:** `staging` only.

## Out of scope

- Automatic publishing (at creation, on offer change, on a schedule), retrying failed relays, and a NIP-09 deletion
  beside a withdrawal.
- `name`, `description`, per-duty details and `storefront` (rows only; story open question 1).
- Changing what this instance offers, and Self-Maps.

## Amendment 1: clarifications from Test Design (2026-10-11)

These come from the test plan's flagged points. The Architect settles them here, and none changes a decision above.

1. **One local scan per check.** The local-first step's scan (sub-decision 7) is the only local scan for the menu.
   When it holds no version, rounds 1 and 2 run, and round 2 reuses that scan's result rather than scanning again.
2. **The relay-list suite needs two re-aims, not one.** Besides S3, A10's "the lookup uses a `dns.promises`
   Resolver" check now reads the guard where the code lives, `src/utils/relayHostGuard.js`, and checks that the
   route requires it. The behavior is unchanged.
3. **The send's time limit.** As in the relay-list route, each relay's send is bounded by `publishToRelays`' own
   per-relay timeout. There is no extra budget around the whole fan-out. The DNS lookups keep their shared 3 s
   budget, and the newest-version read keeps the check's budgets.
4. **Exactly the four places of AC-4.** The menu is not sent to the profile publish relays (General Purpose, Profile,
   WoT) unless one of the four places names them. Only the hint lookups read those relays.

## Amendment 2: what Implementation surfaced (2026-10-11)

1. **The route table opens the route.** `src/middleware/routeAccess.js` is fail-closed (ADR security-auth-exposure/0005).
   It gains `'POST /api/assistant/duty-menu/publish': allow('signed-in', "Your Assistant signs its own Duty Menu,
   built from this instance's offer; bound to your session.")`, the same shape as the Outbox Relays and Identification
   Tags publish entries. Without it a customer is refused as owner-only, which breaks AC-2.
   - The `assistant-duty-menu-publish` S2 sentinel ("only `src/api/index.js` names the route") also allows
     `src/middleware/routeAccess.js` (Phase 3).
2. **The signing helper.** `dutyMenuPublish.js` takes `privkeyBytesOf` from `identificationTaggings.js`, as
   `relayListPublish.js` does.
   - The `assistant-taggings-publish` S2 sentinel ("only `index.js` and `relayListPublish.js` name it") adds
     `src/api/assistant/dutyMenuPublish.js` (Phase 3).
3. **Its own sentence when nothing goes outside.** On a fresh instance every row names this instance's own relay, and
   often no outbox list, earlier menu or Nous relay list is found. The send set is then empty, and the shared summary
   would say that "no general-purpose, profile or WoT relays are configured", which is wrong for a Duty Menu.
   - When the menu was saved here, publish mode is not local-only, and the set holds no relay at all (before the
     guard), the summary is: "Your Assistant's Duty Menu was saved on this instance's relay. There was no other relay
     to send it to."
   - Story § Copy is amended. Every other case keeps `summarizePublish`'s sentences.
