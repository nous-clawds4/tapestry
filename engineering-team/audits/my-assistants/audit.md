# Build Audit: My Assistants — `/assistants`, built to the Claude Design blueprint

**Book:** `engineering-team/audits/my-assistants/book.md`
**Date:** 2026-10-01
**Branch / commit range:** `58abd891..<close commit>` on `feat/my-assistants`. The first book commit is `1f5a2caf`
(story 1), the base is staging at story 1's start, and the branch's first-parent line excludes the two merges of
staging (`167c043e`, `16d19d14`), which carried other books' work. The book's work shipped to staging in two PRs:
#795 (stories 1–3, merge `5e20d462`) and #797 (story 4, merge `d211bb96`). It is not in production.
**Provenance:** Acceptance-frame
**Confidence:** high. The frame was confirmed by the owner with story 1. Every frame bullet maps to Done stories with
PASS reviews, and the shipping checks ran on the live instances.

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. The product team
> reads it to scope the next phase; a future engineer reads it to understand what shipped. It does **not** propose
> changes; that's the seed's job (`prd-seed.md`).

## 1. What shipped

- **A My Assistants page at `/assistants`, and its avatar-menu link,** in the Brainstorm design, following the
  owner's Claude Design blueprint. It lists every profile the signed-in person has tagged **My Brainstorm Assistant**
  or **My Tapestry Assistant**, whoever authored the tag's definition. Their own Assistant on this instance is
  always listed and marked **Local**; when untagged it's marked **Not tagged**, with a link to Identification Tags.
  `stories/done/my-assistants/1-the-my-assistants-page.md`
- **Find, tag, change and remove, from the page.**
  - Search runs in the viewer's POV, and a pasted npub or hex key is looked up exactly.
  - **Tag** signs a tagging in the viewer's own browser extension. **Change** applies the other tag, then withdraws
    the old one. **Remove** withdraws the tagging (NIP-09) instead of disputing it.
  - Each press reports what every relay did.
  - Withdrawals also go to the community relay, so they reach the other instances.

  `stories/done/my-assistants/2-tag-and-untag-from-the-page.md`
- **What each Assistant does, from the viewer's own Treasure Map** (kind 10040), read strictly. Each row shows **On
  / Not on Treasure Map**, with an "M on your Treasure Map" count, and opens to its duties grouped as Scores, Lists
  and Concepts, with **Manage on Treasure Map**.
  - **"On your Treasure Map, but not tagged"** lists the Assistants the map uses that the viewer hasn't claimed,
    with Tag buttons.
  - **A read-only Duties tab** lists every duty, most generic first, with Preferred and Alternates, a plain-English
    sentence and the raw entries.
  - **The honest states:** nothing is claimed while the map loads or after a failed read.

  `stories/done/my-assistants/3-the-treasure-map-on-the-page.md`
- **Is each Assistant's NIP-05 genuine, and a way into its profile.**
  - Each NIP-05 in the list and the section shows **Verified**, **Not valid** or **Couldn't check**; a failed check
    is never called invalid.
  - Every Assistant links to its Brainstorm profile page, which opens in a new tab, so the tags on it can be checked.

  `stories/done/my-assistants/4-nip05-validity-and-profile-links.md` (added by book decision 14)
- **Operational, in the book's § Before shipping:**
  - The **My Brainstorm Assistant** tag definition is published by Nous (event `779f3a88…`) and present on all four
    instances and both dcosl relays.
  - A **`tagDeletions` router stream** is on for staging, tags, production and the Mac Studio.
  - A withdrawal from staging was **shown to travel**: this machine's router log records it deleting the tagging on
    arrival.

## 2. Epics & stories rolled up

### Epic: `my-assistants`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-my-assistants-page | The menu link, the page, and the list read (`GET /api/assistant/my-assistants`) | Done | `reviews/done/my-assistants/1-the-my-assistants-page.md`: PASS after round 2 |
| #2 tag-and-untag-from-the-page | Search, Tag, Change, Remove, per-relay reports; withdrawals that travel (Amendment 1) | Done | `reviews/done/my-assistants/2-tag-and-untag-from-the-page.md`: PASS after round 2 |
| #3 the-treasure-map-on-the-page | Row status and duties, the not-tagged section, the Duties tab, the strict Treasure Map read; the withdrawal-send test | Done | `reviews/done/my-assistants/3-the-treasure-map-on-the-page.md`: PASS after round 2 |
| #4 nip05-validity-and-profile-links | Three-state NIP-05 status (server `status` field), View profile links | Done | `reviews/done/my-assistants/4-nip05-validity-and-profile-links.md`: PASS after round 2 |

**ADRs** (`decisions/done/my-assistants/`):
- `0001` one-session-read-lists-your-assistants;
- `0002` tag-and-withdraw-from-the-browser, plus Amendment 1 (withdrawals travel);
- `0003` the page's Treasure Map is the shared hook, read strictly, plus Amendment 1 (no relay to ask means
  unreadable);
- `0004` NIP-05 status from the verify endpoint, plain profile links, plus Amendment 1 (a status belongs to the
  NIP-05 it was checked for).

## 3. As-built inventory

Derived from the first-parent diff, not only the docs. Every code file below traces to a story.

- **User-facing:**
  - **The page:** `/assistants` (`ui/src/App.jsx`), and a **My Assistants** entry in the avatar menus after My
    Treasure Map (`ui/src/config/avatarMenuLinks.js`).
  - **The page's files** (`ui/src/pages/assistants/`):
    - `Index.jsx`: the phases, tabs, result area and presses;
    - `AssistantRow.jsx`, `AssistantSearch.jsx`, `MapOnlySection.jsx`, `DutiesTab.jsx`;
    - `Nip05Status.jsx` and `ProfileLink.jsx`;
    - the pure view-model `myAssistants.js` and the orchestration `assistantActions.js`.
  - **The shared frame:** the Brainstorm design shell was lifted out of the Dictionary page into
    `ui/src/components/BrainstormDesignShell.jsx`; `DictionaryShell.jsx` re-exports it.
  - **Styles:** the `.bsd-ma-*` styles in `ui/src/styles.css`.
- **API:**
  - **New: `GET /api/assistant/my-assistants`** (`src/api/assistant/myAssistants.js`, `src/api/index.js`). It's
    session-scoped and read-only, and answers `{ success, signedIn, local, rows: [{ pubkey, local, tags, retract }],
    definitions }`.
  - **Changed: `GET /api/nip05/verify`** (`src/api/nip05.js`) adds `status: verified | invalid | unchecked` beside an
    unchanged `verified`. `lookupNip05` is new, and `verifyNip05Identifier`'s contract is unchanged.
  - Both are in `src/api/openapi.yaml`; the verify endpoint is documented there for the first time.
- **Shared client code:**
  - `useTreasureMap(pubkey, { strict })` gains an opt-in strict relay read (`ui/src/hooks/useTreasureMap.js`); only
    `/assistants` passes it;
  - `publishTaggingWithdrawalWithReport` is added (`ui/src/utils/publishProfileTag.js`).
- **Domain:**
  - **No concept definitions changed, and no firmware reinstall.**
  - **Concepts used:** `39998:<TA>:nostr-user-tag`, through the named LEGACY `z` (ADR 0015 of `event-tagging`), and
    `39998:<TA>:tapestry-assistant`.
  - **Tag definitions read by address:** `39999:15f7dafc…:my-tapestry-assistant` (2026-09-22) and
    `39999:15f7dafc…:my-brainstorm-assistant`, published 2026-10-01 for this book (`src/lib/my-assistant-tags/`).
- **Data & contracts:**
  - **Taggings:** kind 39999, with `d = profile-tag-<slug>-<target8>-<signer8>`, `p`, `a`, `e` (the definition's id),
    the canonical `z`, and `polarity`.
  - **Withdrawals:** NIP-09 kind 5, with an `e` per id, an `a` per address, and `k` = 39999.
  - **The router stream** `tagDeletions` (`both`, `{"kinds":[5],"#k":["39999"],"limit":5}`) on all four instances
    (`docs/TAG_FEDERATION_OPS.md` § "Tag deletions travel too").
  - **Treasure Maps:** kind 10040 read local-first, then from the general-purpose relays with `&strict=1`.

**Undocumented work:** none found. Every code file in the first-parent diff traces to a story and its ADR.
`docs/TAG_FEDERATION_OPS.md` comes from story 2's Amendment 1. The `OPEN.md` and `ledger/` edits are the book's
records.

## 4. Deviations from intent

Harvested from the book's decisions, the ADRs' Consequences and amendments, the stories' Out of scope and
§ Deviations, and the reviews; reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: the untagged Local one listed "with a prompt to tag it" | The prompt is a link to Identification Tags, with no Tag button on the row | interpretation | Book decision 9: that page does both halves of the handshake | One click away, not one press | — |
| 2 | Frame: "remove the tag" | Remove withdraws the tagging (NIP-09 kind 5); it doesn't dispute it | interpretation | Book decision 7 | Removed means "as if never tagged"; nobody sees a "not mine" stance | — |
| 3 | Frame: tag, switch, remove (implicitly, everywhere) | Withdrawals reach other instances only through a new `tagDeletions` router stream, and only while both routers are connected | constraint-discovered | Story 2 review 1 blocking 1; ADR 0002 Amendment 1; decision 10. A kind 5 has no `z`, so the `#z` tag streams don't carry it. dcosl (strfry 1.0.4) honours `e` but not `a` | A withdrawal made while a router restarts never arrives elsewhere | §6: catch-up for missed deletions (row `2026-09-27-revokes-do-not-travel`) |
| 4 | Frame: "the duties on the person's Treasure Map … the entry types the app understands today" | Read-only; catch-all, wildcards, adopted providers and the Fallback group are left out, as are entries the app can't place | deferred | Book decision 2; story 3 Out of scope | Editing duties stays on the Treasure Map page | §6: editing duties here; the draft grammar |
| 5 | Blueprint: a Curated DList's name | Shown as its `d` tag (e.g. `dog-breed`) | interpretation | ADR 0003 sub-decision 3: the header name needs a lookup per list | A list reads by its slug | §6: header-name lookup |
| 6 | Blueprint: several Assistants on a duty | Preferred, then Alternates, numbered when there are several | interpretation | Book decision 11 (the design's and the draft protocol's words); the app itself uses only the first | — | — |
| 7 | (Not in the frame) | The Treasure Map is read strictly. An unreachable relay, or no relay to ask, reads as unreadable, never "none" | constraint-discovered | ADR 0003 and its Amendment 1; decision 13; OPEN row 314 | Honest error with Try again, not a false "you haven't published one" | §6: row 314 for the hook's other callers; Try again can't re-read a failed relay list |
| 8 | Story 1 Out of scope: "Not in this book: verifying NIP-05s" | Three-state NIP-05 status and View profile links (story 4) | added-beyond-scope | Book decision 14: the owner's request during the shipping checks | Owner can tell genuine Assistants from look-alikes and check their tags | §6: NIP-05 status elsewhere (profile pages, search) |
| 9 | Story 4 § Copy: "View {name}’s profile (opens in a new tab)" | "View profile of {name} (opens in a new tab)" | interpretation | ADR 0004 sub-decision 5, accepted at the ADR gate: an accessible name contains the visible words | — | — |
| 10 | Story 4 AC-1: Not valid = "the domain answered and doesn't list it" | A 404, other non-listing answers, and redirects read Couldn't check | interpretation | ADR 0004 gate; ledger row `2026-09-20-nip05-verification-no-longer-follows-redirects` | A domain behind a redirect shows Couldn't check, not a checkmark | §6: the redirect row |
| 11 | Decision 4: My Brainstorm Assistant means "held by a Brainstorm service" | The published definition's description is a word-for-word copy of My Tapestry Assistant's | interpretation | The owner chose to keep it (2026-10-01, book § Before shipping) | Readers of the two definitions can't tell them apart | §6: product decision on the descriptions |
| 12 | Blueprint: the section's buttons "Tag: Brainstorm / Tag: Tapestry" | As the blueprint; the search card says "Tag: My Brainstorm Assistant" | interpretation | Story 3 § Copy; raised at its Test Design gate | Two wordings for one action on the page | §6: the product decides one wording |
| 13 | Blueprint: Change as a text link; a coloured dot per duty kind | Change keeps story 2's outlined button; the dots are left out | interpretation | Story 3 § Deviations | Visual only | — |
| 14 | Runbook: `tagDeletions` uses the instance's `nostrUserTag` URLs | The Mac Studio's stream has both dcosl URLs; its `nostrUserTag` has one | interpretation | The owner's choice (book § Before shipping) | Dev stack only | — |
| 15 | Frame: "Production only on the owner's explicit go" | On staging; not promoted at close | deferred (by design) | The frame | Not yet on tapestry.brainstorm.world | §6: promotion |

**Undocumented work:** none (§3).

## 5. Quality state at close

- **Test gate,** network-isolated (the recipe in ledger row `2026-09-30-npm-test-step-leaks-fixtures`; never the full
  `npm test` on the Mac Studio), over the tree this close leaves behind, after the flip and the epic close-out. See
  §5.1.
- **The reviews' isolated gates:** each story's final review ran the same recipe. All PASS: `20261001T120204Z-21-dc76`
  and `20261001T135438Z-21-ba1c` (story 3), `20261001T194333Z-20-c964` and `20261001T201614Z-20-2e0f` (story 4).
  Stories 1 and 2 ran theirs the day before.
- **On staging:** the four My Assistants browser specs passed 61/61 against the deployed bundle, and the live checks
  passed (story 1's H-class, `GET /api/nip05/verify` on real domains).
- **Known open issues** (ledger):
  - `2026-10-01-treasure-map-retry-skips-relay-list` (bug): Try again can't recover from a failed relay-list read;
  - `2026-10-01-nip05-transition-test-misses-kept-claim` (cleanup): N7's test strength;
  - `2026-09-27-revokes-do-not-travel`: catch-up for withdrawals missed while a router restarts; UI revokes without
    `k`;
  - OPEN row 314: the hook's other callers and the endpoint's non-strict default;
  - `2026-09-30-dictionary-d6-reads-before-request` (a flake found during this book);
  - `2026-09-27-test-fixture-taggings-on-prod-relays`: the six fixtures this book's first implementation leaked to
    dcosl. Retracting the five signed with the dev key is still the owner's call.
- **Debt from the ADRs' Consequences:**
  - a tagging without the canonical `z` isn't listed (0001);
  - a failed federation leg reads as "nothing out there" (0001);
  - a Change needs two signatures (0002);
  - the external-publish gate fails open, so tests must mock it (0002);
  - no live publish smoke on the Mac Studio (0002);
  - row 314 narrowed by one caller only (0003);
  - one NIP-05 lookup per distinct pair per page load, with no server-side cache and no rate limiting anywhere
    (0004; ledger row `2026-09-20-public-endpoints-have-no-rate-limiting`);
  - the Meili and admin copies of the NIP-05 check still answer a boolean (0004).

### 5.1 The gate over the final tree

> `20261001T204451Z-20-cdaa [my-assistants-close] started 2026-10-01T20:44:51.599Z on 7ac8ddb1 — PASS, exit 0, 4467 passed, 0 failed, 591 skipped, 254/254 suites`

- **What `7ac8ddb1` is:** a scratch clone's commit of this close's tree: HEAD `16d19d14` plus this close's diff and its
  two new files. It isn't the close commit itself, because the close isn't committed until the owner has checked it.
  The only difference from the close commit is this §5.1, written after the run.
- **How it ran:** `npm ci` in `node:22-bookworm` with network, then `npm test` with `--network none` and `CI=true`, in
  a Docker named volume that was removed afterwards.
- **Inside it:** `harness-lint` passed 76/0, and so did the five My Assistants and NIP-05 suites. The live suites
  skipped, having no network.

## 6. Carry-forward register

- [ ] **Promote to production** on the owner's go (`/cycle-prod`): the page, the server's `status`, and the
      `tagDeletions` stream already on production (§4 #15).
- [ ] **Catch up on withdrawals missed while a router restarts,** and make UI revokes carry `k` (§4 #3; rows
      `2026-09-27-revokes-do-not-travel`, `2026-09-27-ui-revoke-names-id-only`).
      *2026-10-10: the catch-up half has its tools (book `relay-stream-gaps`, closed 2026-10-10, on staging): stream
      changes no longer restart the router; a stream's Limit is now refetched on every connect, so `tagDeletions`
      at 500 refills a deploy's hole; and a scheduled negentropy preset such as `{"kinds":[5],"#k":["39999"]}` can
      cover larger gaps. Still open: production (it has the router changes since PR #829, but its `tagDeletions` is
      saved at limit 5 and the presets are not promoted), no instance runs a kind-5 preset yet, and UI revokes without
      `k` ride neither.*
- [ ] **Try again re-reads the relay list,** and the hook's other callers read strictly (§4 #7; rows
      `2026-10-01-treasure-map-retry-skips-relay-list`, 314).
- [ ] **Editing duties on this page,** and the draft Treasure Map grammar (§4 #4; story 3 Out of scope).
- [ ] **A Curated DList's header name** instead of its `d` tag (§4 #5).
- [ ] **NIP-05 status beyond this page:** the profile pages' mark, search results, and the Meili and admin copies of
      the check (§4 #8, #10; story 4 Out of scope).
- [ ] **Following NIP-05 redirects safely** (§4 #10; row `2026-09-20-nip05-verification-no-longer-follows-redirects`).
- [ ] **Distinct descriptions** for My Brainstorm Assistant and My Tapestry Assistant (§4 #11). That's the owner's
      decision, and a republish would replace the definition at its address.
- [ ] **One wording for the Tag buttons** across the search card and the not-tagged section (§4 #12).
- [ ] **Retract the leaked dev-key fixtures** on dcosl, on the owner's call (row
      `2026-09-27-test-fixture-taggings-on-prod-relays`).
- [ ] **Tighten N7** (row `2026-10-01-nip05-transition-test-misses-kept-claim`).
- [ ] **The design's other screens** and other people's Assistants (story 1 Out of scope, "not in this book").

## 7. Process findings (harness)

Inputs: the four reviews' "Harness friction" sections, the book's `meta` rows, and process-shaped deviations.
`scripts/harness-stats.sh` at close: 251 reviews decided, kick-back rate 0% (CR-final ÷ decided); 54 reviews carry
kick-back history, three of them this book's (stories 1–3 each needed a round 2); 66 books closed and 7 open; median
story cycle time 0 days. This book ran four stories in two days, and every story's review needed a second round
(story 4's round 2 was an owner-chosen fix pass on a PASS). The session-start digest also shows a standing meta
escalation, 165 open harness lessons, which this retro adds to and doesn't resolve.

| Finding | Source | Terminal state |
|---|---|---|
| "Run `npm test`" in workflows 4 and 5 and the Reviewer role conflicts, on the Mac Studio, with live suites that the router uploads to dcosl. This book's first implementation leaked six fixtures that way | Review 1, harness friction 1; story 1 implementation | OPEN.md row `2026-09-30-npm-test-step-leaks-fixtures` (meta). It carries the working isolated-gate recipe, which every later review used |
| The isolated gate's output must go outside the copied tree, or the run reads `dirty` | Review 2, harness friction 2 | OPEN.md row `2026-09-30-npm-test-step-leaks-fixtures`; the recipe now says so |
| The Architecture phase missed an open ledger row about the very mechanism it chose (kind 5 doesn't ride `#z` streams) | Review 2, harness friction 1 | OPEN.md row `2026-09-30-adr-misses-open-ledger-rows` (meta). ADRs 0003 and 0004 applied it by hand and cited their rows |
| Honest states were pinned once per state, not on every surface that can render the claim | Review 3, harness friction 1 | OPEN.md row `2026-10-01-honest-states-pinned-per-state` (meta) |
| …nor per transition, where a drawn surface's input changes (one-render flashes need a change log, not sampling) | Review 4, harness friction 1 | OPEN.md row `2026-10-01-honest-states-pinned-per-state`, update |
| The keeps-X mutant that row asks for wasn't applied to the test written for it (N7) | Review 4 round 2, harness friction 1 | OPEN.md row `2026-10-01-nip05-transition-test-misses-kept-claim` |
| The Reviewer role says commit and flip the status; the orchestrator's brief said neither, so harness-lint showed L1 red until the caller's commit | Reviews 3 and 4 | OPEN.md row 316 (existing) |
| `tagging-edges-realtime-wrapper` RW15 failed once, on base, while two gate containers ran at once | Review 1, harness friction 2 | Declined: one observation under doubled load. Every later isolated gate of this book passed with no failed suite (§5), so there is nothing reproducible to file |
| The Dictionary's D6 flakes (about 1 in 3) | Review 1 | OPEN.md row `2026-09-30-dictionary-d6-reads-before-request` (bug) |
| Story 2's amendment tests were committed before the Test Design gate was asked | Process slip (disclosed in the session) | Declined: the rule exists ("Honor the gates") and was followed for stories 3 and 4. No harness change would have prevented a one-off slip |
| Moving an epic's folders under `done/` breaks inbound path references | This close, step 9 | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (existing). This close rewrote its own references, as the precedent `fb5b220c` did |

**Does it port to the other flow (Direction ↔ human-gated)?**
- **The honest-states row:** yes. It's a Test Design rule, and a Direction-mode gate judge reading the test plan would
  check it the same way.
- **The npm-test row:** yes. Any flow that runs the gate on this machine has the hazard.
- **The ADR-search row:** yes. Both flows write ADRs from the same template.
