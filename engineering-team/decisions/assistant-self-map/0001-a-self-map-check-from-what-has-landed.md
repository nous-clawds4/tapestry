# ADR 0001: A self-Map check beside the others, with "live" read from what has landed at the Assistant's relay

**Status:** Accepted (by the owner, 2026-10-12, with open questions 1–4 answered as recommended)
**Date:** 2026-10-12
**Story:** `engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md`

## Context

Story 1 replaces the hub's Your Assistant's Treasure Map placeholder (assistant-duty-cards #1) with a real check and a
read-only page. The acceptance criteria, in short:

- **AC-1.** One answer about the session's own Assistant, with four parts: the duties, what the self-Map should say,
  the self-Map found, and whether the two match.
- **AC-2.** The duties come from the viewer's own Map, from entries naming that Assistant, one item per part:
  - each part is offered or not by the Duty Menu check's own offer;
  - a part a more specific entry gives to another key shows as given elsewhere;
  - a part is **live** when it is published at the offer's relay, its first full set has landed there, and its
    upkeep is current. One missed scheduled run is a brief gap; two in a row is a stop (open question 1). Concepts are
    live once what was curated has landed;
  - every offered part that isn't live has a reason.
- **AC-3.** What the self-Map should say: self-entries built only from live parts, conforming to `treasure-maps.md`
  § 9.2, with keys, relays and exclusions as listed there. Nothing live means nothing claimed.
- **AC-4.** The self-Map found is looked up per § 9.2 "Finding a self-Map", with this instance's relay asked too, and
  the latest version counts. Only self-entries are part of it. "Finished" and its two reasons follow the Duty Menu's.
- **AC-5.** True = same self-entries by key and relay, in any order; both empty is true. Done = finished and true.
  Pending is the confident reading. The count line reads **Nothing needs attention** at zero.
- **AC-6.** The page: duties, should-say and published panels, one status line, links to the other two pages, the
  Owner's line about the instance's own entries, and the public line.
- **AC-7.** Read-only, in the hub's one request, with no polling and no button.

**Concept Graph.** The stack is absent in this container (session-start digest), so orientation used the AGENTS.md
§ 2 fallback. The story changes no concepts. Its handles (`39998:<TA>:nostr-user`, `39998:<TA>:nostr-relay`) are
cited as the hub's other stories cite them. **Re-verify them against a live graph.**

**The hub today.**
- `GET /api/assistant/attention` (`src/api/assistant/attention.js:301-353`) runs five checks side by side under
  `Promise.allSettled`. A check that throws becomes its own `check-failed` answer.
- The answer has no `treasure-map` key. The UI marks and counts the card unconditionally because it is in neither
  `CHECKED_ACTIONS` nor `COMING_SOON_ACTIONS` (`ui/src/pages/assistant/actions.js:287,295,331-334`).
- An action becomes checked by joining `CHECKED_ACTIONS`. Its page joins `ACTION_PAGES` (`ui/src/App.jsx:151-156`)
  and reads the shared answer through `useAssistantAttention()`, as `DutyMenu.jsx` does.

**What this instance offers, and what it really publishes**, per Assistant:
- **The offer** is the Duty Menu check's, built by `resolveOfferInputs` + `buildOffer`
  (`src/api/assistant/dutyMenu.js:101-125`, `src/lib/duty-menu/index.js:132-147`): bare-kind `duty` rows only, all
  at `instanceRelayUrl()`. Concepts fall back to the first public DList relay when there is no public address.
- **Scores (`30382`).**
  - For the Owner, signed by the TA; for each active customer, by their Assistant.
  - Each run re-signs **every** qualifying event with `created_at` = now, with no diff
    (`src/algos/nip85/publish_kind30382.js:145`, `src/algos/customers/nip85/publish_kind30382.js:150`).
  - Each run writes one `strfry import` into this instance's strfry, which **is** the relay at `instanceRelayUrl()`
    (`outsideOnly` treats that host as this instance's own, `src/api/setup/status.js:214-235`).
  - Both publishers write exactly the eleven metric tags of `TRUST_ASSERTION_METRICS`
    (`src/lib/treasureMapMerge.js:15-27`).
- **Lists (`30392`–`30394`).**
  - Signed by the TA only.
  - Their `d` tags are this instance's own forms: `tl-pin-…`, `tl-pin-notes-…` and `tag-applicability-…`
    (`refreshPinnedTags.js:272-277,409`, read from staging's relay at intake).
  - Treasure Maps § 5.1 says "A List's `d` tag is its exact key without the kind". So no Treasure Maps key reaches
    these Lists: a reader that builds the filter from the Map finds nothing.
- **Concepts (`39998`/`39999`).**
  - Signed by the person's own Assistant when they curate (`dlist-curation/index.js:239-306`, `newConcept.js:64-73`).
    The headers are kind `39998`; items and copies are kind `39999`. The TA also signs firmware headers.
  - No path here signs a header declared as a kind-`39999` item.
  - The Assistant's Duty Menu is an Assistant-signed `39999` too (`d` = `duty-menu`).

**What evidence of "kept up to date" exists** (surveyed for this ADR):
- **Schedules.**
  - Docker deployments run no scheduler for the Score pipelines. `processAllTasks` runs from a systemd timer only on
    bare metal (`systemd/processAllTasks.timer`, `BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL`, default `12hours`).
  - Elsewhere, upkeep runs only from the BullMQ entries in `/var/lib/brainstorm/scheduled-tasks.json`
    (`src/api/scheduled-tasks/index.js:32-33`). Each entry has `taskId`, `args`, `enabled`, and
    `intervalDays/Hours/Minutes` or `cron`.
  - `readConfig()` is exported and never writes.
  - Kill switches: `TASK_QUEUE_ENABLED`, and `/etc/brainstorm-task-queue.json` `{ "scheduler": false }`
    (`src/manage/taskQueue/queue/scheduler.js:30-45`).
  - The fresh-install seeds include no Score task, and seed both List refreshes disabled (`index.js:41-86`).
- **Run records are not reliable evidence.**
  - `getRecentRuns` reads `failure` at the top level while scripts nest it, so failed runs read as success (ledger
    `2026-10-09-task-history-misses-script-failures`).
  - A `strfry import` error is only logged, and the run still exits 0.
  - The Owner's TASK_END targets the Owner's main key, not the TA.
  - Rotation keeps the last 5000 lines.
- **Events at the relay are.** Because Scores and the pinned-tag Lists are re-signed in full on every run, the newest
  Assistant-signed event of the kind at its relay is when the last full set landed.

**Facts found at intake** (book § Facts found at intake):
- On staging, no TA-signed `30382` has landed since 2026-06-07, and the task timeline shows no runs in 30 days.
- The Owner's Map gives the TA `3038x`, carves `30382:rank` and `30382:followers` out to another key, and gives the
  TA `39998` and `39999`.
- Across the 483 Maps on staging's relay, the key shapes are:
  - `<score kind>:<metric>` (about 1,400 entries);
  - bare kinds and `3038x`;
  - `39998:<d>`;
  - a few malformed keys.

  None uses a `tag`, `pin` or `dlist` scope. 47 Maps name `30382:verifiedFollowersCount`, a metric this instance does
  not publish (it publishes `verifiedFollowerCount`).

**The spec.**
- `treasure-maps.md`: § 6 (precedence), § 8 (supported sets), § 9 (duties, self-entries), all of § 9.2, § 5.1–§ 5.2
  (identifiers).
- `duty-menus.md` § 6.2 step 1: covering, and the provisional Concept order. A bare `39998` covers every Concept key;
  a `39999` kind slot beats a bare `39998`.
- § 9.2 is unchanged since `92eb023a`. Story 4 of `duty-menus-and-self-maps` (drafted, `912681b2`) may settle the
  Concept kinds' order first.

**Constraints.**
- JS-without-build.
- Invariants 1–3: the answer is about the session's Assistant only, and it filters nothing at write time.
- Invariant 4: this story writes nothing, so it can't break it. Story 2's writer must merge.
- Reading relays named inside events from the server is an SSRF surface, guarded by `isPublicRelayHostWithin`
  (`src/utils/relayHostGuard.js`) with the 50-relay cap.
- Tests must use the deployments' real config values: on Docker, `BRAINSTORM_RELAY_URL` is `ws://localhost:7777`, and
  the public relay is `wss://<domain>/relay` (ledger `2026-10-12-test-configs-not-from-deployments`).

## Options considered

There are three decisions: where the answer is computed, what counts as evidence that a duty is live, and how much of
the key grammar the check reasons over.

### Where the answer is computed

**Option A: a sixth check in the hub's one answer**, `checkSelfMap`, beside `checkDutyMenu` and isolated the same way.
- *Pros:*
  - AC-7's one request;
  - the card, count line, Alert and page share one answer;
  - the server holds every input: the offer, the schedules, local strfry.
- *Cons:* more work per hub load: a handful of local scans, and outside reads only on a local miss (sub-decision 5).

**Option B: a separate endpoint the page calls.** The hub's mark still needs the answer on every page, so the work
would run twice and could disagree. **Rejected.**

### What counts as evidence that a duty is live

**Option E1: what has landed at the Assistant's relay, scaled by the schedule.**
- **The heartbeat.** It is the newest Assistant-signed event of the family's re-signed kinds in this instance's own
  strfry, the offer's relay.
- **The allowance.** It is two of the shortest enabled schedule interval among the tasks whose runs re-sign that
  family for that Assistant.
- **Exact insights.** An exact key needs its own insight there: a Score metric the publisher writes, or a Concept
  header with that `d`.
- *Pros:*
  - "landed at its relay" is read at the relay itself;
  - a run that failed to import shows as stale, not fresh;
  - local, cheap, and needs no new records.
- *Cons:*
  - a family whose publisher skips unchanged events has no heartbeat (the applicability Lists; moot while Lists aren't
    claimable, sub-decision 3);
  - a partial import inside one run can't be told from a full one.

**Option E2: the run records** (`events.jsonl`, `publishNip85.log`, `getRecentRuns`). Failures read as success, an
import error still exits 0, the Owner's records target the wrong key, and rotation drops lines. A self-Map built on
them would claim stopped upkeep as live. **Rejected.**

**Option E3: new upkeep stamps written by the publishers.** This changes the pipelines and stores state, which AC-7
rules out for this story. It is the candidate for story 3 if E1 proves too coarse. **Deferred.**

### How much of the key grammar the check reasons over

**Option K1: a bounded engine.** It reasons over:
- kind slots (exact, `3038x`/`3039x`, bare `*`);
- Score metric keys (`<kind>:<metric>`);
- Concept keys (`39998`, `39999`, `39998:<d>`, `39999:<d>`).

Any other key shape is **unchecked**. Its part is never claimed, and as an Assistant duty it blocks any broader
self-entry that would win it.
- *Pros:*
  - covers every key shape found on staging;
  - small enough to test exhaustively;
  - says less, never more, where it stops.
- *Cons:* a person who uses `tag`, `pin` or `dlist` keys sees those parts unchecked until a later story extends it.

**Option K2: the whole Treasure Maps grammar.** Systems, categories, canonical naddrs and § 6.2 step 4's meets. It is
large and partly unsettled (story 4), and no Map here uses it. **Deferred.**

## Decision

**Option A, with E1 and K1.**
- **A,** because the mark needs the answer everywhere.
- **E1,** because a self-entry says the insights are at its relay and kept up to date. The relay itself is the only
  record that can't claim a run that never landed.
- **K1,** because every Map here uses its shapes, and the rest is said less of, never wrongly.

### Sub-decisions

1. **One pure module for the self-Map's rules**, `src/lib/self-map/index.js` (CommonJS, no I/O; story 2's writer
   reuses it).
   - **Keys.** `parseKey(key)` returns `{ norm, slot, kinds, scope }`:
     - `norm` is `normalizeMenuKey` (`src/lib/duty-menu`);
     - `kinds` are the kinds the slot covers, under the Concept reading in sub-decision 4;
     - `scope` is one of `{ type: 'all' }`, `{ type: 'metric', metric }`, `{ type: 'd', d }` or
       `{ type: 'unchecked' }`.
     - A Score key whose one segment is not `tag`, `pin`, `dlist` or `contexts` is a metric key. Any other scoped
       Score or List key, and any `*:<scope>`, is unchecked.
     - `39998:` and `39999:` are unchecked.
     - Keys whose slot doesn't parse are dropped, as `readMenuRows` drops them.
   - **Precedence.** `compareKeys(a, b)` follows § 6:
     - the kind slot first: exact kind, then family, then `*`, with a `39999` slot above a bare `39998`;
     - then each later segment, where a value beats empty or omitted.
   - **Matching.** `matches(key, probe)` follows covering in `duty-menus.md` § 6.2 step 1, for the bounded shapes.
   - **Probes.** The check reasons over a finite set of **probe insights**, `buildProbes(map, selfEntries)`. A probe
     stands for one region of insights that every key either matches whole or not at all:
     - for `30382`: one probe per metric in `TRUST_ASSERTION_METRICS` ∪ the metrics named by any key covering `30382`,
       plus one "other metric" probe;
     - for each other Score kind and each List kind: one probe for the whole kind;
     - for `39998` and `39999`: one probe per `d` named by a key, plus one "other" probe each;
     - one probe per unchecked key, for each kind its slot covers.
   - **Duties.** `dutiesOf(map, assistant)`: for each probe, the winning key in the viewer's Map by § 6 over every
     entry with a valid delegate. The probe is the Assistant's duty when that key's entries name it, as Preferred or
     Alternate (§ 9).
     - Under an **exact** key, every probe it matches is a duty (§ 8: an exact key doesn't depend on supported sets).
     - Under a **scope** key, a probe is a duty only when it can hold an insight in the observer's supported sets (§ 8,
       § 9.2 What a self-entry speaks for). This instance reads that from its own record, and stays conservative where
       it has none:
       - **`30382` "other metric":** never a duty. The supported Scores are the eleven metrics, which have their own
         probes (sub-decision 3).
       - **`39998` "other":** a duty when the Assistant has at least one `39998` header (the Concepts it curates).
       - **`39999` "other":** never a duty. No header declared as a `39999` item is curated here (sub-decision 3).
       - **A List kind, or a kind the offer lacks:** always a duty. There is no record, so it counts as non-empty, as
         § 9.2's `30385` example has it.
   - **Should-say.** `buildShouldSay({ duties, offer, live })`, sub-decision 2.
   - **Reading a found self-Map.** `readSelfEntries(event, author)` returns:
     - its entries whose element 2 equals the author (lower-cased), as `{ key: norm, relay }` with the relay in its one
       spelling (`normalizeRelayUrl`), dropping `39998:`/`39999:` keys;
     - `otherEntries`, the count of entries naming any other valid key.
   - **Comparing.** `sameSelfEntries(a, b)` compares sets of key and relay, in any order.
   - **Metrics.** `PUBLISHED_SCORE_METRICS` re-exports `TRUST_ASSERTION_METRICS`, the publishers' metric tags.

2. **Building what the self-Map should say (AC-3).** It is deterministic and greedy, most specific first:
   - **Candidates.** Take the viewer's keys that name the Assistant, deduplicated by `norm` and sorted by
     `compareKeys`, most specific first. For each key K:
     1. Try K itself, verbatim ("Its key").
     2. If K is invalid, try K's **meets** with each offered kind its slot covers. A meet is K with its slot narrowed
        to that kind, such as `3038x` → `30382`, or `*` → `30382`, `39998`.
     3. If a `30382` meet is invalid, try one `30382:<metric>` per published metric that is a duty under it.
   - **Valid candidate.** A candidate S at relay R is valid when both hold, judged against the self-entries already
     chosen (more specific ones are chosen first and keep what they win):
     - every probe that is the Assistant's duty and that S would win among them is live at R;
     - S wins at least one live duty probe.
   - **Its relay.** R is the offer's relay for S's kinds; all of them must share it ("Its relay"). A candidate whose
     kinds the offer doesn't cover, or gives different relays, is invalid.
   - **The result.** Chosen self-entries `{ key, relay }`, in the order they were chosen.

   Worked through for staging's Owner (Scores live, for the example):
   - `30382:rank` and `30382:followers` name another key, so they are not candidates.
   - `3038x` is invalid: its `30383`–`30389` probes are duties and not offered.
   - Its meet `30382` is valid. It wins the rank and followers probes too, but those aren't the TA's duties, so it
     speaks for nothing there (§ 9.2, What a self-entry speaks for).
   - Then `39999`, which is more specific than `39998`, is invalid. It wins only `39999` probes, and none is a duty, so it
     speaks for nothing (sub-decision 1).
   - Then `39998` is valid at the staging relay. It also wins the `39999` probes, since no `39999` self-entry was chosen,
     but they aren't duties. An exact `39999:<d>` naming the TA would be a duty, not live, and would make `39998`
     invalid.

   Result: `[["30382", TA, R], ["39998", TA, R]]`. With Scores not live, as on staging today, the result is
   `[["39998", TA, R]]`.

3. **Live, per probe (AC-2).** `evaluateLive({ assistantIsTa, offer, upkeep, presence })` in the pure module. The first
   reason that applies wins.
   - **Not offered.** The probe's kind has no offer row.
   - **Scores (`30382`).**
     - A metric outside `PUBLISHED_SCORE_METRICS` → `not-published-here`.
     - No enabled schedule covers this Assistant's Score upkeep (sub-decision 6) → `not-scheduled`.
     - No Assistant-signed `30382` at the relay → `not-landed`.
     - The newest is older than the allowance → `upkeep-stopped`, with `lastLandedAt`.
     - Otherwise **live**.
     - **Supported Scores.** On this instance, the observer's supported Scores are read as the eleven metrics this
       instance computes, as its Duty Menu offer reads them (ADR assistant-duty-menu/0001 K1). So under a scope key
       the "other metric" probe is no duty, and a `30382` self-entry speaks for those eleven (open question 1).
   - **Lists, every kind.** `older-form` for the TA, whose Lists use this instance's own `d` tags, which no Treasure
     Maps key reaches (§ 5.1). `not-published-here` for every other Assistant (`_intake.md` 2026-10-11). No List is
     ever live on this instance yet (open question 2).
   - **Concepts.**
     - `39998` "other" → **live** when at least one Assistant-signed `39998` is at the relay, else
       `nothing-to-publish`.
     - `39998:<d>` → **live** when an Assistant-signed `39998` with that `d` is there, else `not-landed`.
     - Every `39999` probe → `not-published-here`, since this instance signs no header declared as a `39999` item.
     - **There is no upkeep test.** Concepts are republished on every edit, and there is no stop to detect.
   - **Unchecked** probes → `unchecked`.

4. **The Concept kinds, provisionally.** The engine reads `duty-menus.md` § 6.2 step 1's provisional order (ADR
   `duty-menus-and-self-maps/0002` A1-8):
   - a bare `39998` covers every Concept key;
   - a bare `39999` covers the `39999:<d>` keys;
   - a `39999` slot beats a bare `39998`.

   Every `39999` probe is not live here (sub-decision 3), so a bare `39999` self-entry is never chosen. The Ties
   question in § 9.2 therefore never arises on this instance's own self-Maps today.

   One function, `conceptReading`, holds the reading. If story 4 settles it otherwise before Implementation, that
   function changes. The Tester pins the reading in one test, so the change is visible.

5. **Which self-Map is found (AC-4).** `lookupSelfMap({ assistantPubkey, mapEvent, offer }, d)` in
   `src/api/assistant/selfMap.js`, after `lookupPublishedMenu`'s shape:
   - **Local first.** Scan this instance's relay strictly: `{ kinds: [10040], authors: [A] }`. When it holds any
     version, the newest there counts and nothing else is read. A reader may ask fewer relays (§ 9.2).
   - **Otherwise, one outside round.** It asks:
     - the viewer's Map's element-3 relays for entries naming A, and A's kind-10002 write relays
       (`assistantWriteRelays`, exported by `dutyMenu.js`). These are event-named: at most `MAX_RELAYS`, each read only
       when `isPublicRelayHostWithin` accepts its host;
     - the offer's relays (configured).

     Every read goes through `readWithinBudget`, and the newest counts. § 9.2's third place, the relays the self-entries
     name, is skipped. The local scan already covers this instance's own relay, and every self-entry here names it.
   - **Finished** when the local scan succeeded or at least one outside relay answered. Otherwise the reason is
     `no-relay-answered`.
   - **`latest`** is the newest version, kept for story 2's merge. `published` is `readSelfEntries(latest)` plus
     `createdAt`, `source` and `eventId`, or null when there is no version.

6. **The upkeep inputs (sub-decision 3)**, read per request by `readUpkeep({ viewer, assistantPubkey, isOwner }, d)`:
   - **Schedule entries.** These are `readConfig().entries` from `src/api/scheduled-tasks`, kept when `enabled`, when
     `TASK_QUEUE_ENABLED` isn't `false`, and when the scheduler kill switch is on. That switch moves into
     `src/manage/taskQueue/queue/schedulerSwitch.js` (pure `fs`); `scheduler.js` imports it, so its behaviour is
     unchanged. The tasks that re-sign the Assistant's Scores:
     - **For the Owner:** `processAllTasks`, `updateAllScoresForOwner`, `exportOwnerKind30382`.
     - **For a customer C:** `processAllTasks` and `processAllActiveCustomers`; and `processCustomer`,
       `updateAllScoresForSingleCustomer` or `exportCustomerKind30382` with `args.customer` equal to C's main pubkey.
   - **The interval.**
     - A `cron` entry's interval is the gap between its next two fire times, from `cron-parser`.
     - Otherwise it is `intervalDays/Hours/Minutes`.
     - When no BullMQ entry matches and `/etc/systemd/system/processAllTasks.timer` exists, the interval comes from
       `BRAINSTORM_PROCESS_ALL_TASKS_INTERVAL`. That is a systemd time span: `<n>` plus `min|minutes|h|hours|d|days`;
       unparseable reads as 12 h.
     - The shortest interval wins, and the allowance is twice it (open question 1 of the story).
   - **The heartbeat.** One strict local scan, `{ kinds: [30382], authors: [A], limit: 1 }`, read through `newest`.
   - **Concept presence.**
     - `{ kinds: [39998], authors: [A], limit: 1 }`;
     - and, when the Map names exact `39998:<d>` keys, `{ kinds: [39998], authors: [A], '#d': [...] }`, at most 50
       `d`s.

     When the offer's Concept relay is not this instance's own (`outsideOnly` keeps it), the same two filters go to that
     relay through `readWithinBudget`. If it doesn't answer, the check is unfinished with `no-relay-answered`, so a
     timeout is never read as "not live".
   - **A failed local scan** leaves the check unfinished with `instance-unanswered`.

7. **The answer**, under `actions['treasure-map']`, from a pure
   `evaluateSelfMap({ mapLookup, offer, upkeep, found, assistantPubkey, isOwner, now })`:

   ```
   { finished, done, pending, reason,           // reason: null | 'no-relay-answered' | 'instance-unanswered' | 'check-failed'
     mapFound,                                   // the viewer's Map was found
     duties: [ { key, lines: [ { key, category, relay, status, reason, lastLandedAt, falseClaim } ] } ],
     shouldSay: [ { key, relay } ],
     published: null | { selfEntries: [ { key, relay } ], otherEntries, createdAt, source, eventId },
     current,                                    // AC-5's "true"; null when unfinished
     instanceMap }                               // the Assistant is this instance's TA: the Owner's line
   ```

   - **`duties`.** One item per viewer key naming the Assistant, in Map order. Its `lines` are:
     - one per offered kind its slot covers, keyed by the meet, with `status`:
       - `active`: live, and the found self-entries that win its duty probes are exactly the should-say ones for it,
         at its relay;
       - `offered`: with `reason` `live-unclaimed` or one of sub-decision 3's;
     - one `not-offered` line for the kinds it covers that aren't offered, when any of them holds a duty probe;
     - one `elsewhere` line per more specific key naming only other keys that wins some of its probes, such as
       `30382:rank`.

     `falseClaim` is true when a found self-entry wins one of the line's duty probes that isn't live at that
     self-entry's relay.
   - **`current`** is `sameSelfEntries(shouldSay, published ? published.selfEntries : [])`. Both empty is true.
   - **`done`** is `finished && current`, and **`pending`** is `finished && !current`.
   - **The Map's own reasons.** A Map lookup that didn't finish maps to `no-relay-answered`, or to
     `instance-unanswered` for `local-unreadable`. A missing Map is finished, with no duties.
   - **On a throw,** `SELF_MAP_CHECK_FAILED`: unfinished with `check-failed`, as the Duty Menu's.

8. **`attention.js`.**
   - A sixth entry in the `Promise.allSettled`: `d.checkSelfMap({ viewer, assistantPubkey }, d)`.
   - The key is `TREASURE_MAP = 'treasure-map'`, logged and replaced by `SELF_MAP_CHECK_FAILED` when it rejects.
   - `isOwner` is the viewer equal to `BRAINSTORM_OWNER_PUBKEY`, as `resolveOfferInputs` reads it.
   - The check computes the offer with `resolveOfferInputs` + `buildOffer`, so the two pages never disagree. The second
     `getCustomer` read is accepted, as for the Duty Menu.

9. **The UI.**
   - **`actions.js`.**
     - `'treasure-map'` joins `CHECKED_ACTIONS`, after `'duty-menu'` (ASSISTANT_ACTIONS order).
     - The card's `alertCriteria` becomes story § Copy's criteria line, and `planningNotes` becomes null.
     - `attentionCountText(0)` returns **Nothing needs attention**. The top-bar pill renders only above zero
       (`TopBarAlert.jsx`), so it is unaffected.
   - **The page**, `ui/src/pages/assistant/AssistantTreasureMap.jsx`, with its words in `assistantTreasureMapCopy.js`.
     It is built as `DutyMenu.jsx` is: the same states, panels, mark and status line, after story AC-6 and § Copy.
     - The status line shows only when the check finished (ADR assistant-duty-menu/0001 Amendment 1 item 1).
     - The Owner's line shows when `instanceMap` is true and `published` exists.
     - Dates are shown as the page's other dates are.
   - **`App.jsx`.** `'treasure-map': <AssistantTreasureMapPage />` joins `ACTION_PAGES`.

10. **No new route.** The answer rides `GET /api/assistant/attention`, already `PUBLIC_READ` in
    `src/middleware/routeAccess.js:85` and session-gated inside. `routeAccess.js` doesn't change. Nothing in this story
    signs.

## Story deviations this ADR asks the owner to approve

- **Three reasons beyond AC-2's list**, with copy for story § Copy:
  - `older-form`: "This instance publishes these in an older form that Treasure Map readers can't find yet." (the
    TA's Lists, § 5.1);
  - `not-scheduled`: "Not kept up to date: no upkeep is scheduled on this instance." (staging's Scores today);
  - `unchecked`: "This instance can't check this key yet, so it isn't claimed." (K1's limit).
- **Lists are never claimed on this instance** until its Lists take Treasure Maps `d` tags (sub-decision 3). The Duty
  Menu's offer of Lists has the same gap. Ledger row `2026-10-12-list-d-tags-not-treasure-maps` records it for that
  book's owner; this ADR doesn't change the Duty Menu.

## Consequences

- **What this enables.**
  - A true "should say" that story 2 publishes as is, and story 3 recomputes on every change.
  - The hub's last placeholder becomes a real check, so a fully set-up viewer reads **Nothing needs attention**.
- **Says less, by design, in four places:**
  - unchecked key shapes;
  - Lists (older form);
  - `39999` Concepts;
  - a family whose evidence is missing or stale.

  Each shows its reason on the page.
- **Read-time cost.**
  - Up to five strict local scans per hub load, run in parallel: the viewer's Map, the Assistant's 10040, the Score
    heartbeat, and Concept presence twice.
  - Plus one small file read for the schedules.
  - Outside reads happen only when the Assistant's 10040 isn't held here, or when Concepts publish to an outside
    relay.
  - The viewer's Map is now read by three checks in one request. Sharing one read is a follow-up, as for the Duty Menu
    (story 1 NB14).
- **A partial import within one run** is read as landed. The publishers log an import error and exit 0. Story 3, or a
  publisher fix, can tighten this.
- **Supported Scores read as the eleven computed metrics.** If a real supported-Scores set ships (Pins, Spawning),
  `evaluateLive` reads it instead.
- **A new direct dependency:** `cron-parser` `4.9.0`, the version BullMQ already pins. Nothing new is installed, and
  the lockfile records it as direct (open question 3).
- **Firmware reinstall required?** No. No concept changes.

## Implementation notes

1. **`src/lib/self-map/index.js`** (new, pure CommonJS). It exports:
   - `parseKey`, `compareKeys`, `matches`, `conceptReading`;
   - `buildProbes`, `dutiesOf`, `evaluateLive`, `buildShouldSay`;
   - `readSelfEntries`, `sameSelfEntries`, `evaluateSelfMap`;
   - `PUBLISHED_SCORE_METRICS`, `SELF_MAP_KIND = 10040`.

   It requires `../duty-menu` (`normalizeMenuKey`), `../relay-list` (`normalizeRelayUrl`) and `../treasureMapMerge`
   (`TRUST_ASSERTION_METRICS`) only.
2. **`src/api/assistant/selfMap.js`** (new). It holds:
   - `checkSelfMap`, `lookupSelfMap`, `readUpkeep`, `scheduleIntervals`;
   - `SELF_MAP_CHECK_FAILED`;
   - `defaultDeps()` in `dutyMenu.js`'s lazy-require style.

   It reuses:
   - `scanLocalStrict`, `lookupNewest`, `treasureMapRelays` and `outsideOnly` (`src/api/setup/status.js`);
   - `readWithinBudget` and `newest` (`attention.js`, required lazily);
   - `resolveOfferInputs` and `assistantWriteRelays` (`dutyMenu.js`);
   - `buildOffer` (`src/lib/duty-menu`);
   - `isPublicRelayHostWithin`.

   The deps add `readScheduleEntries` (`require('../scheduled-tasks').readConfig().entries`), `schedulerEnabled`,
   `timerExists` (`fs.existsSync` of the timer path) and `now`.
3. **`src/manage/taskQueue/queue/schedulerSwitch.js`** (new) holds `schedulerEnabled()`, moved from `scheduler.js`.
   `scheduler.js` re-exports it.
4. **`package.json`**: add `"cron-parser": "4.9.0"` to `dependencies`, with `npm install cron-parser@4.9.0
   --save-exact` so the lockfile follows. Use it as `require('cron-parser').parseExpression(pattern).next()`, twice.
5. **`src/api/assistant/attention.js`**:
   - the sixth check, the `TREASURE_MAP` export and `defaultDeps().checkSelfMap`;
   - the header gains a `treasure-map` paragraph, and its "Read-only" line stays true.
6. **UI**: `actions.js`, `App.jsx`, `AssistantTreasureMap.jsx` and `assistantTreasureMapCopy.js`, as sub-decision 9
   says. Copy is story § Copy plus the three reasons approved with this ADR.
7. **Docs**:
   - `openapi.yaml`: the attention response's `treasure-map` schema;
   - BIBLE §11: the hub's checks table gains the row;
   - `docs/` nothing new.
8. **For the Tester** (Phase 3 owns every test edit):
   - **Fixtures use the deployments' real config.** On Docker: `BRAINSTORM_RELAY_URL=ws://localhost:7777`,
     `STRFRY_DOMAIN=staging.brainstorm.world`, and an `instanceRelayUrl()` of `wss://staging.brainstorm.world/relay`.
     Add one bare-metal case with a public `BRAINSTORM_RELAY_URL`.
   - **Staging's Owner Map, verbatim** (book § Facts), as the worked example in sub-decision 2:
     - with Scores live, `["30382", TA, R]` and `["39998", TA, R]`;
     - with no schedule, Concepts only, with Scores `not-scheduled`.
   - **The metric trap.** A Map naming `30382:verifiedFollowersCount` for the Assistant means no `30382` self-entry, and
     per-metric ones instead.
   - **A customer.** Lists are `not-published-here`. Scores are live only when the customer is active and a matching
     schedule exists.
   - **The existing suites** that pin "the Treasure Map card is always marked" re-aim:
     `assistant-duty-menu-check` L-tests, `assistant-management-page`, `assistant-alert` and the attention specs. So
     do the count-line texts.
   - **One test pins `conceptReading`** (sub-decision 4).
9. **Shared lines.** Before Implementation and again before Review:
   - run `git fetch origin staging` and `git merge-tree --write-tree HEAD origin/staging` (book § Shared lines);
   - re-read § 9.2 and § 6, and story 4's status;
   - record what changed in the book.

## Out of scope

- **Later stories in this book:**
  - publishing, turning the self-Map on and off, and the merge (story 2);
  - automatic upkeep and the stop points (story 3);
  - the counting rule and `categoryAssistants` (story 4);
  - `/treasure-map`'s badges (story 5).
- **Extending the key engine (K2):** `tag`, `pin` and `dlist` keys, categories and naddr canonicalization.
- **Giving this instance's Lists Treasure Maps `d` tags**, and correcting the Duty Menu's List rows: a ledger row.
- **Why staging's Scores stopped** (ledger `2026-10-12-ta-scores-stopped-landing`), and run-record fixes (ledger
  `2026-10-09-task-history-misses-script-failures`).
- **Sharing one read of the viewer's Map** across the hub's checks.

## Open questions for the owner

**Answered by the owner, 2026-10-12, at this ADR's gate:** 1 (a), 2 (a), 3 (a), 4 approved as written.

1. **Supported Scores.** Under a scope key such as `3038x` or `30382`, what does a `30382` self-entry speak for?
   - (a) The eleven metrics this instance computes, as its Duty Menu offer reads them. The self-entry is `30382`.
   - (b) Nothing assumed. The self-Map always lists one `30382:<metric>` self-entry per metric.

   **Recommended: (a).** It matches the menu and the spec's own example under § 9.2, and (b) is always available if a
   Map names a metric this instance doesn't compute. *Owner: (a).*
2. **Lists.**
   - (a) Never claimed here until this instance's Lists take Treasure Maps `d` tags (`older-form` for the TA).
   - (b) Claimed as the Duty Menu offers them.

   **Recommended: (a).** A reader that follows § 5.1 can't find them, so a claim would be false for every reader.
   *Owner: (a).*
3. **`cron-parser` as a direct dependency** (`4.9.0`, already installed through BullMQ).
   - (a) Yes.
   - (b) No: treat a `cron` entry's interval as one day.

   **Recommended: (a).** (b) misreads an hourly or weekly cron. *Owner: (a).*
4. **The three new reasons and their copy** (§ Story deviations). Approve as written, or reword. *Owner: approved as
   written.*

## Amendment 1: clarifications from Test Design (2026-10-12)

**Status of A1:** proposed by the Architect at Test Design, for the owner's approval at the Test Design gate. Each item
settles a detail this ADR left open and the test plan pins
(`stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md` § Points the ADR leaves open). None
changes a decision above.

1. **`lastLandedAt`** is the newest event's `created_at`, in seconds, as NIP-01 dates it.
2. **`readSelfEntries(event, author)`** returns `{ selfEntries: [{ key, relay }], otherEntries }`.
3. **`compareKeys(a, b)`** is a sort comparator that puts the more specific key first: negative when `a` is more
   specific. Sub-decision 2's "sorted by `compareKeys`, most specific first" is `keys.sort(compareKeys)`.
4. **Which kinds get a line.** A duties item has a line only for the offered kinds where the viewer's key still wins
   some insight in the viewer's Map. On staging the Owner's Map names both `39998` and `39999` for the TA, so the
   `39998` item has no `39999` line: that kind belongs to the `39999` item.
5. **Lines' relays.** An `offered` or `active` line carries the offer's relay for its kind. A `not-offered` or
   `elsewhere` line carries `null`.
6. **`SELF_MAP_CHECK_FAILED`** has all ten answer fields:
   `{ finished: false, done: false, pending: false, reason: 'check-failed', mapFound: false, duties: [], shouldSay: [],
   published: null, current: null, instanceMap: false }`.
7. **The copy module's helpers.** `assistantTreasureMapCopy.js` exports `statusLine(answer)` and `reasonLine(line)` beside
   the words, as `dutyMenuCopy.js` exports `statusLine`:
   - `statusLine` gives no line for an unfinished, check-failed or missing answer. Otherwise it gives the up-to-date line
     when `current`; the not-published line when nothing is claimed (`published` is null or has no self-entries); and
     the out-of-date line otherwise.
   - `reasonLine` gives a line's reason sentence, with `upkeep-stopped`'s date shown as the page's other dates are. An
     active line has none.
8. **The could-not-check lines.**
   - `no-relay-answered` shows "No relay answered, so your Assistant's self-Map could not be checked."
   - `instance-unanswered`, `check-failed` and a failed request show "Could not check: this instance did not answer."
9. **The `not-offered` line's key** is the item's own key. The tests don't pin it.
