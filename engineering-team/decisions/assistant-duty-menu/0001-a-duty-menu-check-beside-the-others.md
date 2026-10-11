# ADR 0001: A Duty Menu check beside the others, with an offer built from what this instance publishes

**Status:** Accepted (by the owner, 2026-10-11, choosing R1 and K1)
**Date:** 2026-10-11
**Story:** `engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md`

## Context

Story 1 replaces the hub's Duty Menu placeholder (assistant-duty-cards #1) with a real check and a read-only page.
The acceptance criteria, in short:

- **AC-1.** One answer about the session's own Assistant, with three parts: the **offer**, the **published menu**
  (or none, with "finished" and a reason), and **current or not**.
- **AC-2.** The offer is honest. It lists today's duties for that Assistant (Concepts included), plus Lists for every
  Assistant (the owner's commitment), at a relay where others can find them. The keys are valid. Public relays only,
  one relay per row by one stated rule, and the settings drive it, with no code change.
- **AC-3.** The published menu is found by `duty-menus.md` § 8.1's reader rule, plus this instance's relay. The
  latest version counts, and if that version is not a menu by § 6.1, the Assistant has none. "Finished" means at
  least one relay answered.
- **AC-4.** "Current" means the same rows after § 5.3 normalization. Done = finished, found and current. Pending is
  the confident reading. The count line and the Assistant Alert follow, and the Treasure Map card stays a
  placeholder.
- **AC-5.** The page has the sign-in and no-Assistant states, the offer panel, the published panel with the mark,
  one status line and the public line.
- **AC-6.** Read-only, in the hub's one request, with no polling.

**Concept Graph.** The stack is absent in this container (session-start digest), so orientation used the AGENTS.md
§ 2 fallback. The story changes no concepts. Its handles (`39998:<TA>:nostr-user`, `39998:<TA>:nostr-relay`) are
cited as the hub's other stories cite them. **Re-verify them against a live graph.** The Duty Menu header,
`39998:<Nous>:duty-menu`, is not in this instance's graph (it is unpublished, and D10 means no firmware copy), so it
is only a string in a menu's `z`.

**The hub today.**
- `GET /api/assistant/attention` (`src/api/assistant/attention.js:296-341`) runs four checks side by side with
  `Promise.allSettled`. A check that throws becomes its own `check-failed` answer (outbox, profile, trusted content).
- Each answer carries `finished`/`done`/`pending`. The UI reads them in two ways
  (`ui/src/pages/assistant/actions.js:273-309`, ADR assistant-identification-tags/0001 sub-decision 6):
  - the page's reading: marked unless `done`;
  - the pill's reading: counted when `pending`.
- An action becomes checked by joining `CHECKED_ACTIONS` (`actions.js:285`).
- A built page joins `ACTION_PAGES` (`ui/src/App.jsx:150-154`). It reads the shared answer through
  `useAssistantAttention()` (`ui/src/context/AssistantAttentionContext.jsx`), as `OutboxRelays.jsx` does.

**What this instance publishes, per Assistant** (traced at intake and confirmed here):

| Duty | Kinds built | Signed by | Where it lands |
|---|---|---|---|
| Scores | `30382` only (`src/algos/customers/nip85/publish_kind30382.js`, `src/algos/nip85/publish_kind30382.js`) | the Owner's TA; each **active** customer's own Assistant (`processAllActiveCustomers.sh:73`, `status == "active"`) | this instance's strfry only (`strfry import`) |
| Lists | `30392`, `30393`, `30394` (`refreshPinnedTags.js:209,364`, `refreshApplicabilityLists.js:24`); `30395` nowhere | the TA only (`src/api/trustedList/index.js:16,45-53`) | this instance's strfry only (`:157`) |
| Concepts | `39998`, `39999`, on request (`dlist-curation/index.js:245-247`, `update.js:287-303`, `adoption/*`) | the person's own Assistant | this instance's strfry, then `aDListRelays` unless local-only |

- **The instance relay is readable from outside.** It is the instance's strfry, at `BRAINSTORM_RELAY_URL`. Nginx's
  `/relay` passes reads through (`docker/nginx.conf:51-58`).
- **Outside copies of Scores and Lists exist only through relay-router presets**
  (`setup/router-presets.json`: `trustedAssertions` uploads every `30382` to `wss://nip85.brainstorm.world`;
  `trustedLists` syncs `30392`–`30395`). Both are `defaultEnabled: false`, and their state lives in the router's own
  state file (`src/api/strfry/routerConfig.js:282-297`).
- **The deployments name a relay that may not hold the Scores.** `BRAINSTORM_NIP85_HOME_RELAY`, the relay the
  10040 template writes into a person's `30382:*` rows (`create-unsigned-kind10040.js:45,79`), is
  `wss://nip85.brainstorm.world` on every Docker deployment (`config/brainstorm.conf.template:49`) and in
  `bin/install.js:536`. With the preset off, no `30382` reaches it. This is the "reconcile first" in the handoff's
  § 8, engineering step 2.
- **Active customers.** `CustomerManager#getCustomer(pubkey)` with `status === 'active'` is the same rule the Scores
  pipeline uses (`src/api/auth/getUserClassification.js:52-60`).

**The spec.** `protocols/drafts/duty-menus.md`:
- the item: `d` = `duty-menu`, one `p` = author, Nous' `z` (§ 4);
- rows and their reading rules (§§ 5.1–5.3);
- validity (§ 6.1);
- the reader's lookup in three places, where the latest version counts (§ 8.1).

Book `duty-menus-and-self-maps` stories 3–4 still edit § 6.1's completeness, § 6.2 and § 5.1/§ 5.3's corner cases
(findings 16 and 17). Nothing below depends on how those land, beyond the provisional choices named in
sub-decision 5.

**Constraints.**
- JS-without-build.
- Invariants 1–3: the answer is about the session's Assistant only, and nothing is gated at write time.
- Nous' pubkey is a community constant, not the TA's (CLAUDE.md's hardcoding rule doesn't apply, but define it once).
- Reading relays named inside events (a person's Map, a relay list) from the server is an SSRF surface. The relay
  list publish already guards it (`isPublicRelayHostWithin`, `src/api/assistant/relayListPublish.js:118`, ADR
  assistant-outbox-relays/0003 Amendment 2).

## Options considered

There are three decisions: where the answer is computed, which relay a row names, and which keys the rows use.

### Where the answer is computed

**Option A: a fifth server-side check in the hub's one answer.** `checkDutyMenu` runs beside the other four in
`attention.js` and is isolated the same way.
- *Pros:* AC-6's one request; the hub card, the count line, the Alert and the page share one answer (AC-4). The
  server already holds the facts the offer needs: the instance's relay, customer status, and Relay Settings.
- *Cons:* the hub's answer can take longer: worst case two relay rounds (sub-decision 3).

**Option B: the page computes it in the browser.**
- *Cons:* the hub's mark and the Alert need the same answer on every page, and customer status isn't exposed to the
  browser. **Rejected.**

### Which relay a row names (AC-2's "one rule")

**Option R1: this instance's own relay at its public address, for every row.**
- **The rule.** Every duty this instance performs lands in its own strfry first, so the instance relay always holds
  it.
- **No public address** (a local or private `BRAINSTORM_RELAY_URL`): Scores and Lists get no row, and Concepts take
  the first public relay in Relay Settings' DList list, unless publishing is local-only.
- *Pros:* always true, and needs one setting; no reading of the router's state.
- *Cons:* outside readers depend on the instance relay being up. Turning a router copy on doesn't move a row to the
  community relay.

**Option R2: prefer the outside copy.**
- **The rule.** Scores go to the `trustedAssertions` stream's relay when that stream is enabled, Lists to the
  `trustedLists` stream's, and Concepts to the first DList relay. The instance relay is the fallback.
- *Pros:* names the community relays where NIP-85 clients already look; matches AC-2's example of an outside copy
  turned on or off.
- *Cons:*
  - the copy is best-effort (the router may lag or fail), so the menu could name a relay that doesn't hold the
    insight yet;
  - streams can be renamed, edited or added, so "the stream that uploads 30382" means parsing filters and directions
    out of the router's state;
  - the menu would couple to the router's internals.

**Option R3: follow `BRAINSTORM_NIP85_HOME_RELAY` for Scores**, as the 10040 template does.
- *Pros:* the menu and the person's Map would agree.
- *Cons:* on every Docker deployment that names `wss://nip85.brainstorm.world` while the copy is off by default, so
  the menu would say something false. **Rejected.**

### Which keys the rows use

**Option K1: the kinds actually built.** Scores `30382`; Lists `30392`, `30393`, `30394`; Concepts `39998` and
`39999` (§ 5.3: the bare kinds, never `39998:`/`39999:`).
- *How a whole-category entry reads against it.* A Map entry `3038x` or `3039x` naming this Assistant (what
  `/treasure-map` writes for a whole category, `editTreasureMap.js:23`) resolves as "not offered as a whole".
  Because all the offering rows share one relay, the insisted-key entry gets that relay (§ 6.2 step 5).
- *Pros:* claims nothing unbuilt.
- *Cons:* a later `/treasure-map` that reads menus would warn "not offered as a whole" for a whole-category pick.

**Option K2: the families.** `3038x` and `3039x`, matching `/treasure-map`'s whole-category entries.
- *Cons:* claims kinds built nowhere (`30383`–`30385`, `30395`–`30397`), which AC-2's "nothing else" forbids.
  **Rejected.** At the gate the owner read their Lists commitment as the kinds built today (K1).

## Decision

**Option A, with R1 and K1.** The answer goes in the hub's one request, because the mark needs it everywhere. **R1**
because a menu is a claim that readers act on, and the instance relay is the only place that holds every offered
insight by construction. R2's best-effort copy and its coupling to the router's state cost more than its reach buys.
**K1** because it is the honest offer. The spec already resolves a whole-family Map entry against it to the right
relay.

**Story amendment R1 needs.** AC-2's last bullet gives "turning an outside copy on or off" as an example of a setting
that changes the offer. Under R1 the router's copies never change it. What does: the instance's relay address, a
viewer's customer status, and the DList relays (only when there is no public address). The rest of the bullet holds:
no code change. The owner accepted R1 at this ADR's gate (2026-10-11), and the story's Deviations record the
amendment.

### Sub-decisions

1. **One pure module for the menu's wire facts**, `src/lib/duty-menu/index.js` (CommonJS, no I/O; story 2 reuses it):
   - **Constants.** `DUTY_MENU_D = 'duty-menu'`, `DUTY_MENU_KIND = 39999`, and
     `DUTY_MENU_HEADER = '39998:<NOUS_PUBKEY>:duty-menu'`. `NOUS_PUBKEY` comes from a new one-line
     `src/lib/nous.js`, the one definition of Nous' key. `src/lib/identification-tags/index.js:39` keeps its literal
     for now (out of scope; a follow-up may point it here).
   - **`isDutyMenu(event, author)`**: § 6.1, the four conditions. Kind `39999`; `d` is `duty-menu`; exactly one `p`,
     equal to the author (lowercased); a `z` tag whose value is `DUTY_MENU_HEADER` exactly.
   - **`readMenuRows(event)`**: the rows a reader keeps, in order, as `{ tag: 'duty'|'not-offered', key, relay }`.
     The § 5 rules:
     - a `duty` row with a missing or empty relay is dropped;
     - a key whose kind slot is not five digits, `3038x`, `3039x` or `*` is dropped (the slot test
       `/treasure-map` uses, `editTreasureMap.js:31`; full § 4.7 parsing is not needed, see sub-decision 5);
     - a key `39998:` or `39999:` is dropped;
     - otherwise the key is normalized as `entryOf` does (`src/lib/treasureMapCategories.mjs:30-47`: trailing empty
       segments dropped except in Concept keys, `39998:dlist-header` read as `39998`). The module re-implements
       that small rule in CommonJS rather than importing the ES module, and a Phase-3 test pins the two to agree;
     - after the drops, the first row per normalized key wins;
     - relays are normalized with `normalizeRelayUrl` (`src/lib/relay-list`).
   - **`sameRows(a, b)`**: equal as sets of `tag|key|relay`, so order doesn't count (AC-4).
   - **`buildOffer({ ownRelay, dlistRelay, scores })`**: the K1 rows. `30382` when `scores`, at `ownRelay`; the three
     List kinds at `ownRelay`; `39998` and `39999` at `ownRelay`, else `dlistRelay`. A row whose relay is null is
     left out. The order is Scores, Lists, Concepts. There are no `not-offered` rows (K1 needs no exceptions).
2. **The offer's inputs**, resolved in `src/api/assistant/dutyMenu.js` per request:
   - **`ownRelay`** is `normalizeRelayUrl(BRAINSTORM_RELAY_URL)`, when `isPublicHost` (`profileDefaults.js:53`)
     accepts its host. That is the rule `outboxSuggestions` uses (`outboxRelays.js:93-94`).
   - **`dlistRelay`** is the first `aDListRelays` entry (through `readConfiguredRelays`) that is not plainly private
     (`ssrfGuard`'s synchronous rule, as `outboxRelays.js:73-76`). It is null when
     `BRAINSTORM_PUBLISH_LOCAL_ONLY` is set.
   - **`scores`** is true when the viewer is the Owner (`BRAINSTORM_OWNER_PUBKEY`), or `CustomerManager#getCustomer`
     finds them with `status === 'active'`. A customer lookup that throws makes `scores` false and logs it. The offer
     still answers.
   - The offer is computed before, and independently of, the lookup. An unfinished lookup still carries it, as the
     outbox answer carries its suggestions.
3. **The lookup (AC-3, § 8.1), in two rounds.** Both rounds use `attention.js`'s `readWithinBudget` and the
   `RELAY_BUDGET_MS` of 8 s.
   - **Round 1, the hints, side by side:**
     - the viewer's newest Treasure Map, by `/setup`'s `lookupNewest` and `treasureMapRelays`, as
       `trustedContent.js` reads it. Its hints are element 3 of every entry whose element 2 is the Assistant;
     - the Assistant's newest kind 10002 (`lookupNewestReplaceable` over the profile publish relays, as the outbox
       check does). Its write relays are its `r` entries with no marker or `write`;
     - Nous' newest kind 10002, the same way. Remember a *found* Nous list in-process for 1 hour (§ 8.1: it can be
       cached), and never remember a miss.

     A failed hint lookup only shrinks round 2.
   - **Round 2, the menu.** The filter is `{ kinds: [39999], authors: [A], '#d': ['duty-menu'] }`:
     - one strict local scan (`scanLocalStrict`);
     - in parallel, every relay in the hints plus the offer's relays, through `outsideOnly`, which drops this
       instance's own relay because the scan covers it, and de-duplicates.
   - **The SSRF guard.** Relays taken from events (the Map hints and both 10002s) are read only when
     `isPublicRelayHostWithin` (`relayListPublish.js:118`, 3 s lookup budget, fails closed) accepts the host. A
     refused relay is skipped like an unreachable one. Configured relays (`aDListRelays`) are read as every other
     check reads them.
   - **The latest version counts.** Of everything the local scan and the answering relays return, the events by `A`
     at kind `39999`, `d` = `duty-menu`, the newest by `newest()` (NIP-01's rule) counts. If it fails `isDutyMenu`,
     the Assistant has no menu. That holds even when an older version passes.
   - **Finished** when the local scan succeeded or at least one relay answered `ok`. Otherwise the reason is
     `no-relay-answered`.
   - **Worst case.** About 2 × 8 s plus the 3 s lookups, in the rare case where nothing is held locally and
     outside relays hang. The other checks already allow one 8 s round, and the cached Nous list usually saves a
     round-1 read.
4. **The answer** under `actions['duty-menu']`, from a pure `evaluateDutyMenu({ offer, lookup })`:

   ```
   { finished, done, pending, reason,        // reason: null | 'no-relay-answered' | 'check-failed'
     offer:     [{ tag, key, relay }],
     published: null | { rows: [{ tag, key, relay }], createdAt, source: 'local'|'relay', eventId },
     current:   null | boolean }             // null when not finished
   ```

   - `current = sameRows(offer, published.rows)`; a missing menu is not current. With an empty offer, an empty
     published menu is current (the owner's answer 3(b)).
   - `done = finished && published !== null && current`; `pending = finished && !done`.
   - A throw becomes `DUTY_MENU_CHECK_FAILED = { finished: false, done: false, pending: false, reason: 'check-failed',
     offer: [], published: null, current: null }`. It is logged and does not affect the other actions, as
     `OUTBOX_CHECK_FAILED` does.
   - Categories for the page are derived in the UI (sub-decision 6), so the answer stays wire-shaped.
5. **Provisional reading rules** (pending book `duty-menus-and-self-maps` story 4, finding 17).
   - **Dropped rows.** Ignored rows don't take part in the duplicate check. Their keys can never equal an offer key,
     so the choice only affects a malformed menu, never ours.
   - **naddr/nevent keys** are compared as written, not re-encoded. The offer has none, so any such row makes a menu
     not current either way.
   - **If story 4 changes § 5.3,** `readMenuRows` follows. The book's shared-lines step re-reads the spec before
     Implementation and Review.
6. **The UI.**
   - **`actions.js`.** `'duty-menu'` joins `CHECKED_ACTIONS` after `'outbox-relays'`, in `ASSISTANT_ACTIONS` order.
     The entry keeps its title, path and description. Its `alertCriteria` becomes "If your Assistant has not
     published a Duty Menu, or the one it published differs from what this instance offers for it now.", and its
     `planningNotes` becomes `null` (the placeholder page no longer renders them). The Treasure Map entry is
     unchanged.
   - **`App.jsx`.** `ACTION_PAGES['duty-menu'] = <DutyMenuPage />`.
   - **New `ui/src/pages/assistant/DutyMenu.jsx`**, shaped like `OutboxRelays.jsx`'s read-only parts:
     - `TopBar`, the back link, the title and the description (`ActionText`);
     - the signed-out and no-Assistant states;
     - the two panels and their lines (story § Copy);
     - the mark from `assistantAttention(user, attention)`;
     - **Checking…** while `phase === 'checking'`;
     - "Could not check: this instance did not answer." when `phase === 'failed'`.
   - **New `ui/src/pages/assistant/dutyMenuCopy.js`**: the story's words, and two pure helpers.
     - `categoryOf(key)` maps a row's kind slot to Scores, Lists or Concepts: `3038x` or `30380`–`30389` to Scores,
       `3039x` or `30390`–`30399` to Lists, `39998` or `39999` to Concepts, and a bare `*` to all three, joined. It
       mirrors `appliesTo`'s ranges (`treasureMapCategories.mjs:54-64`), and a test pins the agreement.
     - `statusLine(answer)` gives the up-to-date, not-published or out-of-date line.
   - **No new fetch.** The page reads `useAssistantAttention()` and never calls `refresh()`. Story 2's publish will.
7. **`attention.js`.** A fifth entry in the `Promise.allSettled`, `checkDutyMenu({ viewer, assistantPubkey }, d)`,
   behind a `defaultDeps` seam (`checkDutyMenu`), the failure isolated as in sub-decision 4. The module's header
   comment gains a paragraph.

## Consequences

- **What this enables.**
  - The card becomes a real, current-or-not check, and the page tells a person what their Assistant offers.
  - Story 2 publishes `buildOffer`'s rows through the same module, and `sameRows` tells it whether a publish is
    needed.
  - `isDutyMenu` and `readMenuRows` are the reader pieces the later `/treasure-map` relay fill (handoff § 6) will
    want.
- **What it constrains.**
  - The hub's answer may wait up to about two relay rounds when nothing is held locally.
  - A menu found only on an outside relay costs those reads on every hub load. Story 2 writes to this instance's
    relay first, so in steady state round 2's local scan finds it.
- **Shown, not changed: the Map and the menu can disagree on a relay.**
  - A person's own Map, from the 10040 template, can name `wss://nip85.brainstorm.world` for `30382:*` while their
    menu names the instance relay. The menu is the true one.
  - Reconciling `BRAINSTORM_NIP85_HOME_RELAY` with the router presets is pre-existing debt (handoff § 8, engineering
    step 2).
  - **Follow-up:** OPEN.md row `2026-10-11-nip85-home-relay-without-copy`, added with this ADR's commit, so it doesn't
    stay buried in a handoff.
- **Lists are offered before they are built.** That is the owner's commitment, tracked in `_intake.md` (2026-10-11).
  A reader that follows a customer's Lists row today finds nothing signed by that Assistant.
- **The hub's counts drop by one for a viewer whose menu is current.** The Duty Menu card stops being an
  always-marked placeholder. Tests that pin literal hub counts need re-aiming (Phase 3).
- **ADR assistant-duty-cards/0001** made both cards placeholders "until built". This ADR builds one, which is
  consistent with that ADR and supersedes nothing.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

- **New `src/lib/nous.js`:** `module.exports = { NOUS_PUBKEY: '15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270' };`
- **New `src/lib/duty-menu/index.js`** (pure, CommonJS): `DUTY_MENU_KIND`, `DUTY_MENU_D`, `DUTY_MENU_HEADER`,
  `isDutyMenu(event, author)`, `readMenuRows(event)`, `normalizeMenuKey(key)`, `sameRows(a, b)` and
  `buildOffer({ ownRelay, dlistRelay, scores })`. It also needs to be importable from the UI if a later story wants
  it there. Today the UI needs only `categoryOf`, which lives in `dutyMenuCopy.js`.
- **New `src/api/assistant/dutyMenu.js`:**
  - `checkDutyMenu({ viewer, assistantPubkey }, deps)`, `resolveOfferInputs(viewer, deps)`,
    `lookupPublishedMenu({ assistantPubkey, viewer, offer }, deps)` and `evaluateDutyMenu({ offer, lookup })`, plus
    `DUTY_MENU_CHECK_FAILED`.
  - The seams, `defaultDeps()` style and required lazily:
    - `scanLocal`, `readRelay`, `getConfigFromFile`, `readConfiguredRelays` and `getConfiguredPublishRelays`;
    - `isPublicHost`, `isPublicRelayHostWithin`, `outsideOnly`, `lookupNewest` and `treasureMapRelays`;
    - `lookupNewestReplaceable`, `getCustomer` and `now` (for the Nous cache).

    Tests replace them, as the outbox and trusted-content tests do.
  - The Nous cache is a module-level `{ at, relays }`, with an exported reset for tests.
- **`src/api/assistant/attention.js`:** import nothing new at the top; add the `checkDutyMenu` seam, the fifth
  `allSettled` entry, `DUTY_MENU` (`'duty-menu'`) beside the other key constants, the failure constant and its log
  line.
- **`ui/src/pages/assistant/actions.js`:** `CHECKED_ACTIONS` gains `'duty-menu'`, plus the entry's `alertCriteria`
  and `planningNotes` (sub-decision 6). Update the file's header comment.
- **`ui/src/App.jsx`:** import `DutyMenuPage` and add it to `ACTION_PAGES`, extending the comment above it.
- **New `ui/src/pages/assistant/DutyMenu.jsx` and `ui/src/pages/assistant/dutyMenuCopy.js`:** reuse the hub's
  `ASSISTANT_COPY` for the shared words, and its `.assistant-*` classes in `ui/src/styles.css`. Add classes only for
  the row lines, if needed.
- **OPEN.md:** row `2026-10-11-nip85-home-relay-without-copy` (already added at Architecture) tracks the
  `BRAINSTORM_NIP85_HOME_RELAY` versus router-preset mismatch. Nothing to do in Phase 4.
- **Phase 3 (the Tester) re-aims, never Phase 4:**
  - the specs that pin the hub's literal counts and the duty-menu placeholder copy (`test/assistant-management-page.test.js`,
    `tests/brainstorm/*assistant*` specs);
  - registering the new suites in `test/registry.js`.
- **Branches:** `staging` only. This is not a security fix, and no sandbox branch serves `/assistant`.

## Out of scope

- Publishing (story 2), including which of `name`, `description`, the per-duty details and `storefront` it writes.
- Changing where this instance publishes anything: the router presets, `BRAINSTORM_NIP85_HOME_RELAY`, and customers'
  List publishing (`_intake.md`, 2026-10-11).
- Reading other Assistants' menus, § 8.2's query, and the directory.
- Your Assistant's Treasure Map, `/treasure-map`'s relay fill, and the empty-relay fix.
- Pointing `src/lib/identification-tags` at `NOUS_PUBKEY`.
