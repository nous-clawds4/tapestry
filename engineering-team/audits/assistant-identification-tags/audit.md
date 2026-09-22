# Build Audit: The Identification Tags page — the first action with a real "needs attention" answer

**Book:** `engineering-team/audits/assistant-identification-tags/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `85e4e30d..a2923f9b` on `feat/assistant-identification-tags`.
- **Commits.** 35 of the book's own, no merges: 1 discovery, 1 intake, 3 story, 5 adr, 10 test, 7 impl, 5 review,
  3 ledger. The branch was rebased twice onto a moved `origin/staging` (book § Shared lines: fetch and trial merge
  before each Implementation and each Review) and sits at 0 behind it with a clean trial merge at close.
- **Not merged** to staging at this close. The owner chose to close the book first; shipping is a separate decision
  (`/cycle-staging`, after `scripts/check-safe-to-merge.sh staging`).

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask is quoted verbatim in `book.md`; a Discovery
conversation scoped to this one page settled nine decisions
(`product-team/discoveries/assistant-identification-tags.md`), and the frame was confirmed when the owner approved
the three stories on 2026-09-22.
**Confidence:** **high** for what the code does, **medium** for the frame as a user will meet it.
- Every frame bullet traces to a story; all three stories passed review (story 3 in round 3).
- Every bullet was observed on the local instance: the rebuilt bundle (`index-DUEUUBue.js`), the mocked browser
  classes, and a signed-in probe of the publish route with the local owner's key.
- Two things the record cannot show. Nothing has been seen on `staging.brainstorm.world`, because the branch is not
  deployed. And the four canonical tag definitions do not exist yet on any instance, because publishing them is the
  owner's act outside the code (book § Prerequisite): until then every row on every instance reads "Tag not found"
  and the page can publish nothing.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **A required list of four taggings, the same on every instance, shipped with the app.** You on your Assistant:
  "My Tapestry Assistant", "My Agent"; your Assistant on you: "My Tapestry Owner", "My Human". Each entry names
  the tag, its slug, its signer, its target and its canonical address under the owner's key
  (`src/lib/identification-tags/index.js`, pure CJS, reachable by the UI through a Vite alias) —
  `stories/done/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`
- **One real answer.** `GET /api/assistant/attention` says, for the signed-in viewer's own Assistant only, which of
  the four are present and which are missing: this instance's relay first, the tag-federation relays only on a
  miss, "finished" only when a relay proved reachable, the newest stance of the required signer deciding (a
  dispute or a retraction by the signer makes it missing; a third party's dispute changes nothing). Per row:
  present, finished, a reason when unfinished, and whether the canonical definition was found — story 1.
- **The hub tells the truth for this action.** The Identification Tags card, the hub's count line and the Assistant
  Alert read the real answer; the other nine actions still count as placeholders; the pill hides while the check
  runs, and everything refreshes on its own after a publish — story 1.
- **The page** at `/assistant/identification-tags`: the owner's description, the Treasure Map sentence, two cards by
  signer, each row's state (Present · Missing · Checking… · Tag not found · Could not check), a checkbox per
  missing tagging checked by default, and one button per card naming the signer. A tagging whose canonical
  definition cannot be found is said so and cannot be published —
  `stories/done/assistant-identification-tags/2-the-page-and-your-two-taggings.md`
- **Your two taggings** signed with your nostr extension on "Publish with your nostr extension", sent to this
  instance's relay and the outside relays, each relay's answer shown in the profile publish's words — story 2.
- **Your Assistant's two taggings** signed by this instance with your own Assistant's key on "Have your Assistant
  publish": `POST /api/assistant/identification-tags/publish`, session-bound, refusals before any key is read,
  written to this instance's relay first and then the four configured relay lists, each relay's answer shown.
  Nothing is published at Assistant creation —
  `stories/done/assistant-identification-tags/3-your-assistants-two-taggings.md`
- **The contracts are written down:** both routes in `src/api/openapi.yaml` and BIBLE §11; a §14 Assistant Keys
  bullet for what an Assistant's key now signs on the person's request — stories 1 and 3.

## 2. Epics & stories rolled up

### Epic: `assistant-identification-tags` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-one-answer-and-the-hubs-first-real-mark | The required list, the attention answer for the viewer's own Assistant, and the hub's card, count line and pill reading it | Done | `reviews/done/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md`: PASS, round 1 |
| #2 the-page-and-your-two-taggings | The page with its two cards, states and checkboxes; the person's publish through the extension with a per-relay report | Done | `reviews/done/assistant-identification-tags/2-the-page-and-your-two-taggings.md`: PASS, round 1 |
| #3 your-assistants-two-taggings | The narrow route through which the person's own Assistant signs its two taggings; the second card's button and its report | Done | `reviews/done/assistant-identification-tags/3-your-assistants-two-taggings.md`: CHANGES_REQUESTED in rounds 1 and 2 (the route's scope claim: a false exclusivity, then a false ordinal); PASS in round 3 |

**Epic close-out at this close, before the merge.** Step 9 of the close workflow conditions the epic close-out on
the branch having merged to the shared line and says to leave the epic Active otherwise; `harness-lint` L2 makes a
Closed book with an Active epic red. The owner accepted a close that includes "the book and epic flips" while
shipping stays separate, so the close-out ran on the branch: the epic reads Done and its three folders sit under
`done/`, and the merged tree will be exactly what steps 8–9 describe. §7 records the choice.

## 3. As-built inventory

Derived from the diff (`git diff --stat 85e4e30d..a2923f9b -- src ui test tests BIBLE.md`: 31 files,
+4118 −32) and checked file by file against the stories, ADRs, plans and reviews.

- **User-facing.**
  - `/assistant/identification-tags` replaces its placeholder (`ui/src/pages/assistant/IdentificationTags.jsx`,
    its copy and state rules in `identificationTagsCopy.js`, its styles as `.bs-idtags-*` in `styles.css`
    with a rule at 480 px). Two `Card`s, `is-marked` / `is-done`; a results region that is `aria-live`.
  - The hub's Identification Tags card and count line (`ui/src/pages/assistant/Index.jsx`,
    `actions.js`: `CHECKED_ACTIONS = ['identification-tags']`, `assistantAttention(user, attention)` →
    `{hasAssistant, needsAttention, count, alertCount}`); the Assistant pill's count and its hidden state while
    the check runs (`components/TopBarAlert.jsx`, `utils/topBarAlert.js`).
  - `GET /api/assistant/attention` and `POST /api/assistant/identification-tags/publish`
    (`src/api/assistant/attention.js`, `src/api/assistant/identificationTaggings.js`, registered in
    `src/api/index.js`).
- **Domain.**
  - Concepts touched: `39998:<TA>:nostr-user-tag` — the runtime local z on every tagging, beside the ADR-0015
    legacy z (`LEGACY` literal, untouched). No concept definition changed; no firmware reinstall.
  - The four canonical tag addresses, `39999:e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f:`
    `my-tapestry-assistant | my-agent | my-tapestry-owner | my-human` — a publishing convention under the owner's
    own key (BIBLE §20, wds4/straycat), never a read filter, never a signer, and not a Tapestry Assistant pubkey.
    The definitions themselves are not published yet (§4 #1).
- **Data & contracts.**
  - Taggings are ordinary `nostr-user-tag` assertions, wire format unchanged: kind 39999,
    `d = profile-tag-<slug>-<target[0:8]>-<signer[0:8]>`, `p` target, `a` = `39999:<author>:<slug>`, `e`, two
    `z`, `polarity` (≥ 0.5 apply, ≤ −0.5 dispute); a retraction is a kind 5 the relay honours, so the newest
    stance decides.
  - The attention answer: `{success, signedIn:false}` · `{…, hasAssistant:false, actions:{}}` ·
    `{…, actions:{'identification-tags':{finished, done, pending, taggings:[{key, name, signer, target, present,
    finished, reason?, definition}]}}}`; 500 "Could not check assistant attention". Rows name signer and target
    as `person` / `assistant`; no pubkey travels in the answer.
  - The publish route: `{keys:[…]}` in; 401 / 400 `not-an-assistant-tagging` / 403 before any key is read;
    200 `{success:true, results:[{key, name, ok, outcome, message, localOnly, relays}]}`, or a row with
    `stage:'local'` when the local write failed (nothing goes outward), or `code:'tag-not-found'`. The signed
    event is not returned.
  - The browser publisher (`ui/src/utils/publishProfileTag.js`) gained `publishProfileTagAssertionWithReport`
    and `assertPublished`; `publishProfileTagAssertion` is now its wrapper with the same signature, pinned by
    `dual-z-writer`. `taggingPublishReport.js` turns either report into the page's sentences.
- **Tests.** 71 unit tests in three suites (`assistant-attention` 37, `assistant-identification-tags-page` 15,
  `assistant-taggings-publish` 19; fixtures in `test/helpers/identificationTagsFixtures.js`; `test/registry.js`
  +3) and 26 browser cases in three specs (7, 13, 6). Re-aims: `assistant-alert.spec.js` and
  `assistant-management-page.spec.js` mock the attention route (B8 skips the identification-tags placeholder case);
  `test/assistant-management-page.test.js` W1 accepts the `ACTION_PAGES[a.key] ??` route mapping.

## 4. Deviations from intent

Harvested from the three stories' § Deviations, the ADRs' § Consequences and amendments, and the reviews'
non-blocking findings, then reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: the definitions are "canonical tags the owner publishes once with their own key" | The app knows the four by name and canonical address; the definitions themselves are published nowhere yet | constraint-discovered | The publish is the owner's act outside the code (book § Prerequisite). Story 3's signed-in probe of the route on this stack answered two `tag-not-found` rows and wrote nothing | Today every row reads "Tag not found" on every instance, and nothing can be published from the page | §6 #1 |
| 2 | Frame bullet 2: present "read from this instance's relay first and then the outside relays it reads tags from" | As specified, with the `/setup` rule for "finished": on a local miss the check finishes only when an outside tag relay answers. On a stack with no tag-federation relay (this dev stack) a missing tagging never finishes | interpretation | ADR 0001 § Consequences: "that is the `/setup` rule, and deliberate" | On such a stack the hub marks the card and the pill does not count it; the page says "Not found on this instance's relay, and no outside relay is configured to check." | §6 #4 |
| 3 | Frame bullet 2: "which of the four are present and which are missing" | Rows carry present / finished / reason / definition and name their signer and target as words, never pubkeys; the action carries three flags and no reason of its own; the provider fetches only for a viewer with an Assistant | interpretation | story 1 § Deviations 2–4 (the `/api/setup/status` precedent: no pubkey in the answer) | None; the page has both pubkeys from sign-in | — |
| 4 | Frame bullet 3: the card is marked and the count line and Alert count it "only while a required tagging is missing" | Two readings of one answer: the card and the page mark unless the check is *done* (an unfinished check marks); the pill counts only a *finished* missing check, and hides while the check runs. `idle` would fall through to the count if auth ever resolved synchronously | intentional-change | ADR 0001 (the hub may show doubt; the pill does not nag on doubt); review 1 non-blocking 3 | A viewer sees the mark before the pill's number moves; no pill during each page load's first request | §6 #9 |
| 5 | Frame bullet 2: "present" | Present through any author's same-named tag (permissionless), while publishability follows the canonical definition's own lookup. In the corner where the canonical definition is not found but the tagging is present through another author's tag, the hub is unmarked and the page marks the card | interpretation | review 2 non-blocking 3; ADR 0001 (present by name; the definition by canonical address) | A rare state reads differently on the hub and the page | §6 #5 |
| 6 | Frame bullet 4: "a checkbox per missing tagging" | A row the check could not settle has no checkbox, so on an instance with no tag relay and nothing local the page offers nothing to publish; a Present row has no checkbox either, so a tagging that never reached an outside relay cannot be re-sent from here | interpretation | story 2 § Deviations 3 and open question 1; ADR 0002 § Constrains | Nothing to press until the check settles; no republish | §6 #3, #4 |
| 7 | Frame bullet 4: the page's words (story 2 § Copy) | Three sentences the table did not have; the failed-local-write lines say what the relays did instead of "so it was not sent to any other relay"; tone marks (✅ ⚠️ ℹ️ ❌) beside each result; a done card keeps its button rendered and disabled | intentional-change | story 2 § Deviations 1, 2, 4; ADR 0002 sub-decision 5; story 2 AC-3 | Words only; the marks match the profile editor's | — |
| 8 | Frame bullet 5: your taggings "sent to this instance's relay and the outside relays" | The browser publisher sends to the local relay and the outside relays in parallel, not local-first; with local-only publish mode on, the outside sends are skipped by the gate and reported as skipped | interpretation | ADR 0002 sub-decision 3: reuse the deployed tagging publisher through a report-returning variant | The report shows each relay's answer either way | — |
| 9 | Frame bullet 6: the Assistant's taggings go "to this instance's relay first and then the configured relays" | Local-first, then the four configured lists (general-purpose, profile, WoT, tag-federation) under the shared 8 s deadline. The outside set does not exclude the instance's own relay URL, so an operator who lists it sends each tagging there twice, the second counted as accepted | interpretation | story 3 open question 1 (the Architect's call); ADR 0003 § Notes for Test Design; review 3 non-blocking 5 | None unless the own relay is listed | §6 #8 |
| 10 | Frame bullet 6: "nothing else gains the power to sign as an Assistant" | Held: one narrow, session-bound route, refusals before any key is read, the generic signer unchanged. The ADR's *description* of the landscape was wrong twice ("the only thing besides its profile", then "the second such route") and was corrected in five places | interpretation (docs) | ADR 0003 Amendment 1 and its round-2 correction; review 3 rounds 1–2 | None. The docs now say what is true, and name the generic signer's gate as it is, owner-or-admin (OPEN.md row 269) | §6 #11 |
| 11 | Frame bullet 6: "each relay's answer shown" | The route's per-tagging report omits the signed event and the Assistant's pubkey; a whole-request refusal shows the server's own words as the card's notice, so the report util's whole-request branch has no caller | intentional-change | story 3 § Deviations 4–5; ADR 0003 sub-decisions 6 and 8; review 3 non-blocking 1 | None | §6 #8 |
| 12 | Story 3 § Copy: "Sign in to have your Assistant publish its taggings." | Unreachable for a real anonymous caller: the auth middleware's default deny answers 401 with its own sentence first | constraint-discovered | review 3 non-blocking 6; plan 3 H1 | An anonymous caller reads the middleware's words | §6 #8 |
| 13 | ADR 0002 named the copy module `identificationTags.js` | `identificationTagsCopy.js` | constraint-discovered | ADR 0002 Amendment 1: the container builds the UI from the case-insensitive macOS bind mount, where a name differing from the page's only by case resolved to the wrong file | None | — |
| 14 | Frame bullet 7: "nothing else changes" | Held. Outside this book's own files: two hub specs and one hub suite re-aimed to the new answer; `publishProfileTag.js` gained a variant with its wrapper's contract unchanged; a Vite alias | — | ADR 0001 § re-aims; ADR 0002 sub-decision 3 | None | — |

**Undocumented work** — none. Every file in the diff is named by a story, an ADR, a plan or a review of this book
(checked at close: the least-cited file is named twice).

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind
  (`+dirty` is this close, uncommitted):
  `20260922T130828Z-49331-2d67 [book-close-assistant-identification-tags] started 2026-09-22T13:08:28.209Z on a2923f9b+dirty — FAIL, exit 1, 3740 passed, 50 failed, 130 skipped, 226/226 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, not-yet-shared-filter, concept-count-canonical, summaries-element-count`
  (Node 22.23.2 from a sibling session's scratchpad; the stack up.)
  - **Every failure is a live test against the host's stack, and the failing set is this host's known one.** The
    fourteen suites are exactly the fifteen of this host's last full run (the `assistant-management` close,
    `20260922T032735Z-80234-c9d6`) minus `llms-txt`, which passes now (27/0): the backend restarted at 12:12 UTC
    on this branch, which carries staging's route. The nine brain suites, `return-the-four-on-every-read-surface`,
    `not-yet-shared-filter`, `concept-count-canonical`, `summaries-element-count` and `tag-detail` read the local
    graph and were red before this book began (OPEN.md row 289).
  - **None is this book's.** `assistant-attention` 37/0, `assistant-identification-tags-page` 15/0,
    `assistant-taggings-publish` 19/0; the re-aimed `assistant-management-page` 24/0 and `assistant-alert` 15/0;
    `dual-z-writer` 14/0, `default-deny-mutations` 14/0, `assistant-publish-relays` 39/0; and the `harness-lint`
    suite 76/0 over the closed tree, with the epic Done and its folders under `done/` (L2 satisfied).
- **The book's gate, per story,** each a labelled baseline against a labelled after-run compared suite by suite
  (`tmp/gate-runs/*.json`; Node 22.23.2; the pattern widened per story and the registry's `excluded` suites
  dropped), read with `npm run gate:status -- --label …`:
  - story 1 (119 suites): baseline `20260922T053841Z-80977-caaf` on `918f1b99`, 2213 passed / 60 failed /
    59 skipped → after `20260922T054557Z-93203-1dd6` on `27d5c15d`, 2248 / 25 / 59. The only suite that
    moved: `assistant-attention`, 2/35 → 37/0.
  - story 2 (131 suites): baseline `20260922T111447Z-47997-3777` on `cbae0c77`, 2422 / 38 / 59 → after
    `20260922T112709Z-91579-0287` on `860ec615`, 2435 / 25 / 59. The only suite that moved:
    `assistant-identification-tags-page`, 2/13 → 15/0 (an intermediate run on `1089f04e` showed
    `dual-z-writer` 13/1, closed by the wrapper's signature fix).
  - story 3 (156 suites): baseline `20260922T120710Z-33381-7613` on `1d547a43`, 2622 / 62 / 121 → after
    `20260922T121159Z-49324-9844` on `86a032c1`, 2640 / 44 / 121. The only suite that moved:
    `assistant-taggings-publish`, 1/18 → 19/0.
  - **The failures left in every after-run are this host's known live-graph set** (the brain and hygiene suites,
    `concept-count-canonical`, `summaries-element-count`, plus `tag-detail` once the widened pattern reached it),
    red in each baseline too (memory `host-gate-at-ci-parity`; OPEN.md row 289).
- **Browser class,** against the rebuilt UI on `localhost:7778` (`index-DUEUUBue.js`; backend restarted 2026-09-22
  12:12:16 UTC), each class run whole: `assistant-taggings-publish` 6/6, `assistant-identification-tags-page`
  13/13, `assistant-management-page` 22/22 + 1 skipped by design, `assistant-attention` 7/7, `assistant-alert`
  10/10, `assistant-publish-result` 4/4 — 61 passed, 1 skipped. `tag-detail-write.spec.js` 2/11 on this host: the
  nine are the nine ledger `2026-09-22-staging-browser-class-83-red` lists for that spec, red on the shared line
  before this book.
- **A signed-in probe of the publish route** (a scratchpad script; the local owner's key from the Keychain signed
  the kind 22242 challenge; the key never left the process): anonymous POST → 401 from the middleware; a
  person-signed key → 400 with the approved words; the signed-in POST for both keys → 200 in 38 ms with two
  `tag-not-found` rows, and the local relay held no tagging of the viewer afterwards. Nothing was signed or written.
- `bash scripts/harness-lint.sh`: clean at close.
- **Staging:** not deployed. Nothing in this book has been seen on `staging.brainstorm.world`.
- **Known open issues:**
  - ledger `2026-09-22-strict-lookup-third-copy` (cleanup: three copies of the strict lookup, two polarity readers,
    two d-tag rules, and up to three outside reads per relay per page load on a miss);
  - the nine `tag-detail-write` cases above (pre-existing);
  - OPEN.md row 269, the generic signer's owner-or-admin gate (pre-existing; this route's docs now name it);
  - on a stack with no tag-federation relay, a missing tagging never finishes (§4 #2).
- **Debt from the ADRs' Consequences:**
  - one attention read per full page load for a signed-in viewer with an Assistant, plus one per own publish; no
    memo by principle 3 (ADR 0001);
  - the strict lookup's third copy and the two smaller duplicates (ADR 0001; the cleanup row above);
  - the page-local per-relay renderer, the outcome rule's small duplicate, and `PUBLISH_RELAYS` still a literal list
    in the browser (ADR 0002);
  - the mirrored tagging builder on the server, the z literal referenced from three modules, and the per-card
    publishing state that would want a shared helper at a third card (ADR 0003).

## 6. Carry-forward register

- [ ] **1. The owner publishes the four canonical tag definitions with their own key.** Story 2 § Copy carries the
      names, slugs and proposed descriptions (the owner edits). Until then every instance reads "Tag not found"
      and the page can publish nothing. (book § Prerequisite; §4 #1)
- [ ] **2. Ship it.** The branch is unmerged at close: `/cycle-staging` after `scripts/check-safe-to-merge.sh
      staging`, then see the frame on staging once the definitions exist. (audit header)
- [ ] **3. A "broadcast" reading of present, and re-sending a Present row.** Present means "on this instance's
      relay"; the purpose of the tags is broadcast, and a Present row cannot be re-sent from the page.
      (story 1 open question 2; story 2 open question 1; §4 #6)
- [ ] **4. Rows the check could not settle:** a "publish anyway" checkbox, or a hint to configure a tag-federation
      relay; and on a stack with none, a missing tagging that never finishes. (ADR 0002 § Constrains; §4 #2, #6)
- [ ] **5. The hub/page corner:** present through another author's same-named tag while the canonical definition is
      not found — hub unmarked, page marked. (review 2 non-blocking 3; §4 #5)
- [ ] **6. The convention note in `protocols/`**, "Well-known tags: Assistant identification" — a reading convention
      for outside clients, no wire change; docs-lane, for the owner to approve. (ADR 0001 § Consequences)
- [ ] **7. Publishing the Assistant's taggings at creation.** Discovery decision 3 said later; the exported
      `publishAssistantTaggingsFor` is the hook. (ADR 0003 § Enables; epic § Deferred)
- [ ] **8. Code debt noticed, not fixed:** ledger `2026-09-22-strict-lookup-third-copy`; the report util's callerless
      whole-request branch; `publishingCard` as one value (a double press is possible, idempotent on the relay by
      the deterministic `d`); the own-relay duplicate send; the per-request TA warning when nothing is signed; the
      unreachable "Sign in" sentence; the page-local per-relay renderer and the `PUBLISH_RELAYS` literal.
      (reviews 1–3 non-blocking; ADRs § Debt; §4 #9, #11, #12)
- [ ] **9. `idle` falls through to the pill's count** if auth ever resolves synchronously. (review 1 non-blocking 3;
      §4 #4)
- [ ] **10. BIBLE §11 tidy:** the two new rows sit inside the strfry block, and `/api/setup/status` has no row at all.
      (review 1 non-blocking 4; docs-lane)
- [ ] **11. OPEN.md row 269:** the generic publish endpoint lets admins mint as the instance TA though its docs said
      owner-only. Pre-existing; this route's docs name the gate as it is. (§4 #10)
- [ ] **12. The other nine actions' answers and pages, and the DMs** (intake 2026-09-21, still partly open); the
      kind-0 `p`-tag form of the handshake (intake 2026-08-09). (epic § Deferred)
- [ ] **13. Nine `tag-detail-write` browser cases red on this host** (ledger `2026-09-22-staging-browser-class-83-red`;
      pre-existing).
- [ ] **14. Two test-strength notes:** the hub-count assertion after a full reload proves the queue's last answer,
      not the in-place refresh (review 2 non-blocking 5); the publish suite's fakes document two assistant modes
      they do not implement (review 3 non-blocking 7).

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-09-22, and the session-start digest):
- 242 reviews parsed: 240 final PASS, 2 final CHANGES_REQUESTED; 47 reviews with kick-back history; re-review
  churn 3. The headline kick-back rate reads 0% because it counts final verdicts only, so story 3's two sent-back
  rounds are invisible there (OPEN.md row 309, already open).
- Books: 65 closed with this one; 5 still open.
- The digest counted 155 open harness lessons, the oldest 82 days old, above the escalation line. This book adds
  five `meta` rows and one `cleanup` row, all filed during its reviews.
- **What held:** the shared line was re-checked before each Implementation and each Review (`git fetch` and
  `git merge-tree --write-tree HEAD origin/staging`, ledger `2026-09-22-parallel-books-no-shared-line-recheck`);
  two rebases, no conflict, nothing built against a stale line. Every review found the work through the diff and
  the gate, not through the prose.

| Finding | Source | Terminal state |
|---|---|---|
| **No phase owns flipping an ADR from Proposed to Accepted.** ADR 0001 read Proposed after its gate until the review commit flipped it; ADRs 0002 and 0003 were flipped by hand at approval. Ports to Direction mode: yes, the same Architecture phase | review 1, harness friction 1 | OPEN.md row `2026-09-22-adr-status-flip-unowned` |
| **A story's Linked artifacts lines are not written at the gates that own them,** and the Review line conflicts with the Reviewer's write scope. Seen in all three stories. Ports: yes | review 1, harness friction 2; reviews 2 and 3, non-blocking 8/9 | OPEN.md row `2026-09-22-linked-artifacts-not-written-at-gates` |
| **The book-gate recipe is prose with relative requires,** the excluded-suites drop lives in no committed file, and by story 3 it was a three-hop reference chain; the Reviewer re-derived it three times in one book. Ports: yes | review 1, harness friction 3; review 2, harness friction 2; review 3, harness friction 2 | OPEN.md row `2026-09-22-gate-recipe-relative-require` (three gap paragraphs) |
| **A `test:` commit carried a source rename** (`d7611992`, staged by `git mv`), leaving a commit that does not build on Linux; the plan and the Reviewer's brief both placed the rename in the next commit. Ports: yes | review 2, harness friction 1 | OPEN.md row `2026-09-22-test-commit-carried-a-source-rename` |
| **A universal claim in an ADR reached BIBLE and the API document with no phase verifying it,** then a first rewording carried a false ordinal and an "owner-only" that is owner-or-admin. Ports: yes | review 3, harness friction 1; ADR 0003 Amendment 1 | OPEN.md row `2026-09-22-universal-claim-without-proving-command`; agent memory `verify-universal-and-ordering-claims` extended the same day (a session note, not a harness change) |
| **A dead Node 22 in a sibling session's scratchpad let the PATH fall through to Node 16 with no error,** so a suite's live H-class silently skipped once during story 1's implementation | session, story 1 Implementation | declined: host-specific to this Mac. The durable fix is agent memory `host-gate-at-ci-parity` (2026-09-22: use the other scratchpad's tarball, `hash -r`, check `node --version` before trusting a run); no harness file describes this host |
| **The case-insensitive bind mount resolved `identificationTags.js` for `IdentificationTags.jsx`** and the container's UI build failed | story 2 § Deviations 6; ADR 0002 Amendment 1 | declined: one sighting; the rule ("never name a pure module and a JSX page the same modulo case; Linux CI resolves them apart, a macOS checkout does not") is recorded in ADR 0002 Amendment 1. If it recurs, one line in AGENTS.md's environment notes is the fix, an operator-ratified edit |
| **A plan record carried a wrong denominator** (`tag-detail-write` "20/29"; the spec has 11 tests) | review 2, non-blocking 9 | declined: a records slip, corrected in this audit (§5 quotes 2/11); the memory note on measured fixture lists already covers it |
| **Tester-lane corrections after the first run against the implementation** in every story (U11 and S1; S2; browser B1), each its own `test:` commit | stories 1–3 § Deviations | declined: the cycle working as designed; each correction has its reason in the story and its own commit |
| **`harness-lint` L1 read story 3's review as CHANGES_REQUESTED after round 3's PASS,** because an "On PASS" heading from an earlier round was the file's last token | session, story 3 Review | declined: the shared last-token rule is the harness's own (`scripts/lib/review-verdict.awk`); the review now ends with its verdict token, and the Done flip was held until lint read PASS |
| **This close ran before the branch merged.** Step 9 of `6-book-close.md` conditions the epic close-out on the merge and says to leave the epic Active otherwise; L2 makes that red; the waiver file is the unnamed third way. Ports: yes | this close (§2 note) | declined for now: the owner's explicit choice at the close offer, one sighting; the close-out ran on the branch so the merged tree is the one steps 8–9 describe. If closing before the merge recurs, step 9 should name the choice (close-out on the branch, or a cited L2 waiver until the merge) |
