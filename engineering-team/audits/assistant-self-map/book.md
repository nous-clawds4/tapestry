# Book of Work: Your Assistant's Treasure Map — the hub's self-Map page, built and kept true

**Slug:** assistant-self-map
**Status:** Open
**Opened:** 2026-10-12
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-10-12) and settled through four questions
there. Completion is *judged* against the bullets below.

The ask, verbatim (its opening and "What the page is for", copied from the session transcript, not retyped):

> I want to build the real "Your Assistant's Treasure Map" page on the Assistant Management hub:
> https://staging.brainstorm.world/assistant/treasure-map (route /assistant/treasure-map). Today it's a placeholder card
> and page from book `assistant-duty-cards`, always marked Needs attention. Work it through the harness as CLAUDE.md
> describes: start with intake, pick the lane, and open a book.
>
> ## What the page is for
> My Assistant publishes its own Treasure Map (kind 10040), a "self-Map", naming itself for the duties it is actively
> publishing right now. The Duty Menu (built last session, /assistant/duty-menu) says what my Assistant OFFERS; the
> self-Map says what is ACTIVE. Together they let anyone switching a duty between Assistants see whether the new one is
> already live, so the switch is instant instead of waiting for a first computation.

The rest of the message pointed at the spec sections (below, § Shared lines), the facts that shape the design (below,
§ Facts found at intake and § Design notes), three product questions (settled below), what to reuse from the Duty Menu
books, and last session's lessons (§ Design notes).

### Decisions taken at intake (2026-10-12)

1. **On once, then automatic.** The page shows what the viewer's Assistant's self-Map says beside what it should say.
   One button turns the self-Map on (the Assistant signs and publishes it); another turns it off. While it is on, the
   instance keeps it true by itself: it adds a duty once its first full set has landed, and narrows or removes a
   self-entry before upkeep stops. *(Chosen from: on once, then automatic / the button adds and the instance removes /
   button only, the Duty Menu model / fully automatic with no button.)* Why: `treasure-maps.md` § 9.2's "remove or
   narrow before it stops" can't rest on a press the person may never make.
2. **Done means on and true.** The hub card is **Done** when a self-Map is found that says exactly what this instance
   can truly claim for the Assistant now (the Duty Menu's "published and current" rule). Duties it can't claim
   (unoffered parts of a key, customers' Lists, Scores that aren't landing) don't hold the card back; the page lists them
   as given but not active, with the reason. A Map that gives the Assistant nothing reads as Done, with nothing to
   claim. *(Chosen from: on and true / every offered duty active / published at all.)* This replaces
   `assistant-duty-cards` prd-seed § 7's suggestion ("the self-Map lists every duty the person's own Map gives this
   Assistant"), which § 9.2 rules out wherever the menu leaves part of a key unoffered.
3. **Three pages, cross-linked.** The Duty Menu says what is offered, Your Assistant's Treasure Map says what is
   active, and `/treasure-map` is what the person asked for. The new page lists each duty the person's Map gives their
   Assistant as Active, Offered but not active, or Not offered, links to the other two, and never edits the person's
   Map. For the Owner it says that the same event also carries the instance's own Map entries, kept unchanged.
   *(Chosen from: three pages, cross-linked / merge with the Duty Menu page / separate, no links.)*
4. **Scope: all four extras.** *(Multi-select.)*
   - every Assistant this instance runs, customers' included;
   - § 9.2's Counting Maps rule in this instance's own counters;
   - the hub's self-entry reading (ledger row `2026-10-11-self-entry-reads-as-another-assistant`);
   - Active and Standby-ready badges on `/treasure-map`'s cards.
5. **Path: Standard, all five phases, Engineering lane.** Stated at intake and not objected to. Not the Light profile:
   this book adds the first server code that signs a kind 10040 with an Assistant's key, and a new signing route.
   Not the Product Team flow: § 9.2 already says what a self-Map may claim, and the open product questions were bounded
   choices the owner listed for intake (the `assistant-duty-menu` book's precedent).

### Acceptance frame

*Proposed from the intake decisions, 2026-10-12; confirmed by the owner, unchanged, at story 1's approval the same
day.*

- [ ] **A real page.** `/assistant/treasure-map` stops being a placeholder. For the viewer's Assistant it shows:
  - each duty the viewer's Map gives that Assistant, marked **Active**, **Offered but not active** (with the reason)
    or **Not offered**;
  - the self-Map found now, beside what it should say;
  - links to the Duty Menu (offered) and to `/treasure-map` (what you asked for).

  It never edits the person's Map. For the Owner it says that the event also holds the instance's own Map entries,
  kept unchanged.
- [ ] **On once, then kept true.** A button has the viewer's own Assistant sign and publish its self-Map, and another
      turns it off. While it is on, the instance keeps it true by itself, conforming to `treasure-maps.md` § 9.2:
  - a self-entry is added only after the first full set it speaks for has landed at its relay;
  - it is narrowed or removed before upkeep stops, whatever the reason;
  - keys follow "Its key", "More than one relay" and "A part A does not publish";
  - relays follow "Its relay" (the relay the Assistant's Duty Menu gives the key);
  - each version's `created_at` is later than the last, and versions go to "Finding a self-Map"'s relays.
- [ ] **Honest content.** A self-entry claims only (duties the person's Map gives this Assistant) ∩ (what this
      instance actually publishes for it, at the relay its Duty Menu names) ∩ (evidence that it has landed and is kept
      up to date). Customers' Lists are not claimed until they are built (`_intake.md`, 2026-10-11). Scores are not
      claimed while they aren't landing.
- [ ] **Nothing else is lost.** Every entry in the Assistant's kind 10040 that the self-Map doesn't own is kept
      byte-for-byte, in order (the TA's 10040 is also the instance's own Map; CLAUDE.md principle 4; the merge-preserve
      rule of `src/lib/treasureMapMerge.js` and `dlist-curation` #7). Nothing regenerates a 10040 blind.
- [ ] **Every Assistant here.** The Owner's TA and each customer's Assistant.
- [ ] **A real mark.** The hub card, its count line and the Assistant Alert show **Done** when a self-Map is found
      that is on and says exactly what this instance can truly claim now (Decision 2), and **Needs attention**
      otherwise.
- [ ] **Counting.** This instance's own counters count a Map only when at least one of its public entries names a key
      other than its author (§ 9.2, Counting Maps): `get-nip85-participation-data.js`,
      `get-all-10040-authors-locally.js` and `public/pages/about-trusted-assertions.html`.
- [ ] **The hub reads self-entries.** A Map entry that names the Map's own author is a self-entry, not "another
      Assistant", for `/treasure-map`'s cards and the hub's Scores, Lists and Concepts check together. Ledger row
      `2026-10-11-self-entry-reads-as-another-assistant` closes.
- [ ] **Active badges on `/treasure-map`.** Each card shows **Active**, or **Standby ready** for a confirmed
      Alternate, from each named Assistant's self-Map (§ 9.2, Confirmed duties). Read-only.
- [ ] **On staging**, verified by the owner signed in on staging.brainstorm.world, with the published self-Map read
      back from the relays.

**Not in this book:**
- `/treasure-map`'s element-3 fill from self-entries and menus, and the "Make preferred" swap (the umbrella intake
  entry's step 3, its remaining parts);
- the readers' § 3 fallback (step 4's first half) and the relay reconciliation (ledger row
  `2026-10-11-nip85-home-relay-without-copy`);
- customers' Lists (`_intake.md`, 2026-10-11);
- why the Owner's Scores stopped landing on staging and production (ledger row
  `2026-10-12-ta-scores-stopped-landing`);
- NosFabrica adoption (handoff Q6);
- any edit to `protocols/`. This book reads the specs.

## Facts found at intake (2026-10-12)

Read from the relays and the public API, not from config:

| | Staging | Production |
|---|---|---|
| TA (`/api/assistant/pubkey`) | `8e901369…5fb1` | `919ba08a…e2ff` |
| TA's kind 10040 (own relay, nip85, dcosl) | none | none |
| Newest TA-signed `30382` at its own relay | 2026-06-07 | 2026-05-25 |
| Task timeline, last 30 days (`/api/neo4j-health/task-timeline?hours=720`) | 0 executions | not read |

- **The Owner's Map on staging (`e5272de9…`):**
  - It gives the TA `3038x`, `39998` and `39999`.
  - It gives `30382:rank` and `30382:followers` to `600f4551…`, and `30392`, `30393` and `30394` too.
- **The TA's Duty Menu on staging** (`6b5a73ca`, 2026-10-12): `30382`, `30392`–`30394`, `39998` and `39999`, all at
  `wss://staging.brainstorm.world/relay`.
- **What the self-Map could truly say for the Owner on staging today:**
  - Concepts, at the staging relay;
  - not `3038x`: the menu offers only `30382` under it, so the key narrows to `30382`;
  - not Scores at all while none land;
  - none of the TA's Lists, which the Owner's Map gives to another key.
- **TA-signed newest by kind at the staging relay:** `30392`/`30393` 2026-09-03, `30394` 2026-10-10, `39998`
  2026-10-03.

## Design notes for Planning and Architecture

From the owner's ask and the facts above; the Architect decides.

- **The core problem is "landed and kept up to date", per family.** Run records exist:
  - `events.jsonl`, read by `getRecentRuns` and `getTaskTimeline`;
  - the per-customer `publishNip85.log`;
  - `checkKind30382Status`.

  So do relay probes (`probeRelayForEvent`, `/api/relay/presence`). Staging shows that a Score set can sit at the
  relay for months unrefreshed. § 9.2 counts it as maintained "whatever its age", so evidence must cover upkeep, not
  just presence.
- **What the instance publishes, per Assistant:**
  - Scores (`30382`), for the Owner and active customers, from the scheduled pipelines, to local strfry only;
  - Lists (`30392`–`30394`), signed by the TA only;
  - Concepts (`39998`/`39999`), when the person curates, signed with the caller's Assistant key, to local strfry and
    the DList relays.

  All are at `instanceRelayUrl()` (`src/api/assistant/profileDefaults.js`). On Docker, `BRAINSTORM_RELAY_URL` is the
  container-internal `ws://localhost:7777`: tests must use the deployments' real values (ledger
  `2026-10-12-test-configs-not-from-deployments`).
- **No server code signs a kind 10040 today.** `treasureMapMerge.js` owns only `30382:*` rows in the person's
  template. The self-Map writer owns only self-entries (element 2 = the author) and keeps every other tag.
- **Stop points the automation must hear before upkeep stops:**
  - a customer leaving `active`;
  - Relay Settings or the menu's relay moving;
  - a family's Scores not landing;
  - a person turning it off;
  - the person's Map dropping or re-giving a key.

  § 9.2 also asks a stopped List to be retracted (SHOULD): the Architect places that.
- **Carry-forwards this book answers** (each annotated in its audit):
  - `assistant-duty-cards` §6: the real page and check, and where the page links;
  - `assistant-duty-menu` §6: the Your Assistant's Treasure Map page;
  - `assistant-shared-categories` §6 #3: self-entries;
  - `assistant-coming-soon` §6 #3: the count line at zero. Once this card has a real check, a fully set-up viewer's
    hub reads "0 actions need attention", and the hub's line has no zero state yet. Decide it in this book's page
    story.

  `assistant-duty-cards` §6's FAQ item, which mentions the self-Map, stays with that audit.
- **Provisional key grammar:** a bare `39998` and a `39999` self-entry tie under § 9.2 Ties (ledger
  `2026-10-12-self-maps-spec-fold-forwards` item 3). Story 4 of `duty-menus-and-self-maps` settles it. Until then
  the Concepts self-entries follow the text at Implementation time.
- **Reuse:**
  - `src/lib/duty-menu/` and `src/lib/nous.js`;
  - `dutyMenu.js`: a check inside the hub's one attention answer, with a local-first read, the SSRF guard and the
    50-relay cap;
  - `dutyMenuPublish.js`: one narrow, session-bound signing route;
  - `relayHostGuard.js`;
  - the UI's `DutyMenu.jsx`, `actions.js` (`CHECKED_ACTIONS`) and `App.jsx` (`ACTION_PAGES`).
- **Lessons applied:**
  - every new route gets its `src/middleware/routeAccess.js` entry (ledger `2026-10-11-adr-template-misses-route-table`);
  - the ADR names it;
  - tests read the deployments' real config values;
  - promote to production from a pinned `promote/*` branch (ledger `2026-10-07-staging-sessions-push-red-tests`).
- **Show and Tell** (`design-philosophies/show-and-tell.md`), checked at intake: a self-entry is the key's own report,
  never a choice of provider. § 9.2's Counting Maps rule already keeps it out of counts, and this book applies that
  rule (Decision 4). Nothing here counts what a person does for themselves as a signal for others.
- **Environment:** `npm ci` in the root and in `ui/`; there's no Docker daemon, so browser specs run against a Vite build
  with Chromium at `/opt/pw-browsers`. The only real end-to-end check is the owner on staging. Verify by reading
  published events back from the relays.

## Epics in this book

- `assistant-self-map`: the self-Map page, its publisher and upkeep, its readers (stories to be planned; story 1 first).

## Path

**Standard, all five phases** (Decision 5).

**Branch** (the owner, 2026-10-12, at story 1's Test Design gate):
- This book develops on `feat/assistant-self-map`.
- Each story reaches `staging` by a PR after its Review passes, through `/cycle-staging`.
- So the failing tests of Test Design and unreviewed code stay off the shared line. That is fix shape (a) of ledger
  row `2026-10-07-staging-sessions-push-red-tests`.
- Intake and Planning documents for story 1 were pushed to `staging` before this choice.
- The branch is restarted from `origin/staging` for each later story. The merged branch is deleted on merge, and the
  same name is reused.

**Shipped:**
- **Story 1, the self-Map page and its check (Done; review PASS in round 3).**
  - **Staging:** PR #855, merge `f51fe70d`, deploy run 38311549058, 2026-10-12. Smoke test Tiers 1–5 clean; Tier 4
    used headless Chromium, signed out.
  - **The owner's check on staging:** signed in as straycat, the expected view.
  - **Production:** PR #856, pinned at `f51fe70d` through `promote/assistant-self-map-1`, merge `ef04e503`, deploy
    run 38313469618, 2026-10-12. Smoke test Tiers 1–5 clean; Tier 4 used headless Chromium, signed out.
  - The frame's "On staging" bullet stays open until the book's later stories are verified the same way.

**Planned:**
- **Story 2, turning the self-Map on and off (approved 2026-10-12).** The owner chose at planning that it reaches
  `staging` by a PR after its Review, as above, and reaches production only together with story 3. Until story 3
  keeps a self-Map true by itself, an "on" self-Map changes only when its person presses.
  - **The cost, accepted:** another book's promotion pinned after story 2's staging merge carries story 2 to
    production too. No outside client reads self-Maps yet.

## Shared lines

- **Book `duty-menus-and-self-maps` is open, docs only.** At intake (2026-10-12, `origin/staging` at `8c5973ab`):
  - story 3 (Self-Maps) passed review in round 2 (`8c5973ab`) and is Done, after round 1's CHANGES_REQUESTED, its
    round-2 fixes (`fe163bc0`) and ADR 0003 Amendment A2 (`11cc0008`). `protocols/` is unchanged from `92eb023a`,
    where this intake read § 9.2;
  - story 4 (the Treasure Maps key grammar) has no story file yet. It still edits both specs, and ledger rows
    `2026-10-12-self-maps-spec-fold-forwards` and `2026-10-12-self-maps-record-loose-ends` feed it.

  This book reads `treasure-maps.md` § 3, § 9 and all of § 9.2, and `duty-menus.md` § 6.2 and § 10. It does not edit
  `protocols/`. Re-read § 9.2 before Implementation and before Review, and record what changed here.
- **The hub's lines:** `ui/src/pages/assistant/`, `src/api/assistant/` (`attention.js`, the checks),
  `src/middleware/routeAccess.js`, `openapi.yaml` and BIBLE §11. `assistant-coming-soon`, the last book editing them,
  closed at `92eb023a`.
- **`/treasure-map`'s cards** (`ui/src/pages/treasure-map/`) and `src/lib/treasureMapCategories.mjs`, for the badges
  and the self-entry reading.
- **Recheck at Test Design (2026-10-12, `origin/staging` at `00341d7e`).**
  - `protocols/` is unchanged since this book's intake read.
  - Story 4 of `duty-menus-and-self-maps` drafted its ADR 0004 (proposed, revision 2). Its 1(a) agrees with ADR
    `assistant-self-map/0001` sub-decision 4 word for word: a bare `39998` covers every Concept key, and `39999` beats
    `39998`. So test U19 stands.
  - One item to watch: ADR 0004 would have readers MUST ignore a Map entry keyed `39998:` or `39999:`, as if absent.
    ADR 0001 shows such an entry as an `unchecked` line. No test pins that case. If 0004 is accepted, the Implementer
    drops those entries from the duties, and the Reviewer checks it.
- **Recheck at Implementation (2026-10-12, `origin/staging` still at `00341d7e`).** `git merge-tree` is clean;
  `protocols/` is unchanged; ADR 0004 is still Proposed (revision 2), so `39998:`/`39999:` entries stay `unchecked`
  lines as ADR 0001 says, and the watch item above carries to Review.
- **Recheck at Review round 2 (2026-10-12, `origin/staging` at `7ab2c955`).**
  - `git merge-tree` is clean, and staging changed no code.
  - `duty-menus-and-self-maps` #4 is done and **ADR 0004 is Accepted**. `treasure-maps.md` §§ 4.4–4.6, 6 and 9.2 changed:
    - `39998:`/`39999:` are not keys, and readers MUST ignore such entries;
    - `39999:dlist-header` names no Concept;
    - `39999` beats `39998`, confirming ADR 0001's Concept reading;
    - § 9.2 Ties now says none arise.
  - **The watch item above fired.** Story 1's round-2 review requires the drop (R2-B1).
  - That book's story 5 (the rules that keep a self-Map true, docs) is approved. It bears on this book's stories 2 and 3
    (turning the self-Map off, and keeping it true): reread it before they are planned.
- **At story 1's ship (2026-10-12, `origin/staging` at `85434cb6`):** two shared lines for stories 2 and 3.
  - **`duty-menus-and-self-maps` #5** (the rules that keep a self-Map true, docs) has draft ADR 0005, **Proposed**.
    Its sub-decision 2 says a self-entry removed or narrowed while the key keeps publishing is "no stop". So this
    book's "off" button retracts nothing, and readers only stop treating those insights as confirmed. Reread it, and
    check its status, when planning stories 2 and 3.
  - **Book `assistant-duties-settings`** (story 1 approved; ADR 0001 **Proposed**) moves the offered duties into the
    instance settings, editable on a new Assistant Duties tab:
    - any Treasure Map key may be offered, Scores to every Assistant, each duty with its own relay;
    - its sub-decision 6 edits this book's `src/api/assistant/selfMap.js` (`readUpkeep`): Scores whose relay isn't
      this instance's own read `not-published-here`, and nothing is scanned;
    - it leaves `src/lib/self-map` unchanged, and adds a one-line note to ADR `assistant-self-map/0001`.

    That matches this book's honesty rule. But any story here that edits `selfMap.js` must merge carefully with it,
    in whichever order they land.
- **Recheck at story 2's planning (2026-10-12, `origin/staging` at `d6dcda0b`, merged into the branch as `19b6dd1`).**
  - `git merge-tree` is clean, and `protocols/` is unchanged.
  - **`assistant-duties-settings` ADR 0001 is now Accepted.** Story 2's Background names what it means here: a change
    on the Assistant Duties tab changes what the self-Map should say.
  - **Draft ADR `duty-menus-and-self-maps/0005` is still Proposed.** Story 2's "off" follows its sub-decision 2 and
    retracts nothing.
- **Recheck at story 2's Architecture and Test Design (2026-10-12).**
  - **At Architecture,** `origin/staging` was at `9a7735a`, and the branch merged it as `7b32926`.
    `assistant-duties-settings` #1 had landed its implementation, including the `readUpkeep` guard in `selfMap.js`. ADR
    `assistant-self-map/0002` is designed on that code.
  - **At Test Design,** `origin/staging` was at `72dba9e`, merged as `66e2382`. That story's review asks its Architect
    to amend how the self-Map reads offer rows that aren't bare kinds. That will change `evaluateSelfMap`'s offer map
    and `readUpkeep`, which story 2 only calls.
    - Story 2's tests use the shipped list and pin nothing about compound keys.
    - W4 puts both Concept kinds at one typed relay, and may need re-aiming if that rule changes (test plan § Shared
      line).
  - `protocols/` is unchanged. Draft ADR `duty-menus-and-self-maps/0005` is still Proposed.
- **Before Implementation and again before Review:** run `git fetch origin staging`, then
  `git merge-tree --write-tree HEAD origin/staging` (ledger `2026-09-22-parallel-books-no-shared-line-recheck`).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-self-map/audit.md`
- Product feedback: `engineering-team/audits/assistant-self-map/prd-seed.md`
