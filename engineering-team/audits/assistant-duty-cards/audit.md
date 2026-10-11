# Build Audit: Duty Menu and Your Assistant's Treasure Map — two placeholder cards on the hub

**Book:** `engineering-team/audits/assistant-duty-cards/book.md`
**Date:** 2026-10-11
**Branch / commit range:** `3cb5d909^..3236e066` on `staging` (the shared line), plus this close's commit.
- **Commits.** Nine of the book's own, all pushed straight to `staging`, no PR and no merge:
  - story ×2: draft, approved;
  - adr ×2: proposed, accepted;
  - test ×3: the failing tests, then two re-aims at Implementation;
  - impl ×1;
  - review ×1.
- **Interleaved.** Three commits of the parallel docs-only book `duty-menus-and-self-maps` sit between them
  (`a26fc4e7`, `ab8f2f2b`, `5d362f8f`). They touch only that book's files.
- **Staging: deployed.** staging.brainstorm.world runs it (deploy run 607, commit `e3e436e6`, success).
- **Production: not shipped.** `main` does not have it (§6 #1).

**Provenance:** Acceptance-frame. There is no PRD and no Discovery conversation (book Decision 3). The owner's ask is
quoted verbatim in `book.md`. Three decisions were settled at intake, and the owner confirmed the frame with them on
2026-10-11.

**Confidence: high.** This is a data-only change to a page whose behaviour was already built and tested, and every
frame bullet traces to the one story.
- **What ran.**
  - The Node gate, three times: at Test Design, at Implementation and at Review.
  - The browser classes against a local build: 176 passed, 3 skipped.
  - The key hub specs against live staging: 5 passed.
- **What was checked on staging.** All three addresses answer 200, and the served bundle carries the new words.
- **What the record cannot show.** A signed-in person seeing the marks on staging. The browser specs mock sign-in and
  the attention answer, and no browser session with a nostr signer was available. The marks themselves are unchanged
  code (`assistantAttention()`), exercised by the Node and browser suites.

> The Build Audit is the as-built record. It does not propose changes; that is `prd-seed.md`'s job.

## 1. What shipped

- **Two more persona cards on `/assistant`**, after Outbox Relays: **Duty Menu**, then **Your Assistant's Treasure
  Map**, each with the owner-approved description. The hub now lists thirteen actions; the other eleven are unchanged —
  `stories/done/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md` (AC-1).
- **Two placeholder pages**, `/assistant/duty-menu` and `/assistant/treasure-map`, through the hub's shared placeholder
  page. Each shows:
  - the heading, "Placeholder page." and the description;
  - "Alert criteria: Not yet defined.";
  - planning notes in the owner's words: the Duty Menu as an item on the DList of Duty Menus, and the self-Map as the
    Assistant acting as its own Assistant;
  - the way back.

  Both addresses load when typed in or refreshed (AC-2).
- **Marked like every other placeholder.** For a signed-in viewer with an Assistant, both cards are always marked
  **Needs attention** and never **Done**. The hub's count line and the Assistant Alert each read two higher. Visitors
  and viewers with no Assistant see no change (AC-3).
- **Nothing else changed.** No publishing, signing, checking or storing. The FAQ, the other actions, the server's
  attention answer and the person's own `/treasure-map` are as they were (AC-4).

## 2. Epics & stories rolled up

### Epic: `assistant-duty-cards` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 duty-menu-and-treasure-map-placeholder-cards | The two hub entries, their placeholder pages and their marks | Done | `reviews/done/assistant-duty-cards/1-duty-menu-and-treasure-map-placeholder-cards.md`: PASS, round 1 |

**Epic close-out at this close.** The one story is Done and on the shared line (`staging`). Step 9 applies: the epic
reads Done, and its story, ADR and review folders move under `done/`. Production is not a condition of step 9; it is
recorded as pending (§6 #1).

## 3. As-built inventory

Derived from the book's own commits.
- **Production code:** 3 files, +28 −6, in `ui/`.
- **Tests:** 11 files, +388 −27, in `test/` and `tests/`.
- Every file is accounted for by the story, ADR 0001 or the test plan.

- **User-facing.**
  - `ui/src/pages/assistant/actions.js:87-106`: the two `ASSISTANT_ACTIONS` entries, keys `duty-menu` and
    `treasure-map`, section `persona`, paths under `ASSISTANT_MANAGEMENT_PATH`, `alertCriteria: null`, the approved
    `planningNotes`, no `editLink`.
  - The cards, the routes, the placeholder pages and the marks all follow from these two entries, through code that is
    unchanged: `Index.jsx`, `App.jsx`'s generated routes, `ActionPage.jsx` and `assistantAttention()`.
  - Comment-only edits: the `actions.js` header, `ActionPage.jsx:12-13` and `App.jsx:335`.
- **Domain.** No concept touched or defined, and no firmware reinstall (ADR 0001 § Consequences). The Duty Menu header
  `39998:<Nous>:duty-menu` is neither read nor published.
- **Data & contracts.**
  - No event kind, API route or stored shape is added or changed.
  - `CHECKED_ACTIONS` is unchanged, so `GET /api/assistant/attention` neither answers the two keys nor is asked to.
  - BIBLE, OpenAPI and `protocols/` are untouched.
- **Tests.**
  - New: `test/assistant-duty-cards.test.js`, 12 tests, registered in `test/registry.js`, and the words fixture
    `test/helpers/dutyCardsFixtures.js`.
  - The shared hub fixture `test/helpers/assistantManagementFixtures.js` lists both cards, so every hub suite and
    spec covers them.
  - Re-aimed literal pins in four Node suites and four browser specs (test plan, § Test infrastructure).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | The ask: "one for … My Assistant's Treasure Map" | The card is titled **Your Assistant's Treasure Map** | interpretation | Matches the hub's second-person voice ("Your Tapestry Assistant's Profile", "Your Assistant's Public Persona"); proposed at intake and chosen by the owner (book Decision 1) | The avatar menu says "My Treasure Map" and "My Assistant's Profile", while the hub says "Your …" | — |
| 2 | The ask: "we can make them placeholder pages" | Placeholders that are always marked **Needs attention** and counted, so the hub's count and the Assistant Alert each rise by two for every viewer with an Assistant | interpretation | The hub's rule for every unbuilt action (ADR assistant-management/0001); chosen over an unmarked "coming soon" state (book Decision 2; ADR 0001 Option B rejected) | Everyone with an Assistant sees two more marks they cannot act on yet | §6 #2 |
| 3 | The ask names only the two cards | Each placeholder page carries planning notes, paraphrasing the owner's description of the protocol from the ask | added-beyond-scope (approved) | So the session that builds the real page inherits the owner's intent, as the other placeholders do; approved with the story's § Copy | Visible on both placeholder pages | — |
| 4 | The ask names no link | The Assistant's Treasure Map placeholder does **not** link to `/treasure-map` | interpretation | That page is the person's own Map, not the Assistant's (story § Out of scope; ADR 0001 sub-decision 4) | None now; the later book decides where the real page links | §6 #3 |

**Undocumented work:** none. Every file in the book's diff is named by the story, ADR 0001, the test plan, or the test
plan's § Verification amendment (the two Implementation-time re-aims).

## 5. Quality state at close

- **Test gate after the flip and the epic close-out:**
  `20261011T165006Z-8152-28c3 [book-close] started 2026-10-11T16:50:06.345Z on 3236e066+dirty — PASS, exit 0, 5599 passed, 0 failed, 582 skipped, 299/299 suites`.
  - The run is on the close's working tree (`+dirty`: the book flipped to Closed, the epic moved under `done/`, these
    artifacts written), whose HEAD is the review commit.
  - Nothing was listening on `:7778` (see §7 #2).
- **Earlier runs:**
  - Review gate: `20261011T163902Z-12910-0236`, PASS, 5599 / 0 / 582.
  - Test-Design baseline: `20261011T153551Z-6371-269c`, PASS, 5587 / 0 / 582.
- **Browser:**
  - against a local build: 176 passed, 3 skipped across eleven hub-related specs;
  - against staging: 5 of 5 key hub specs passed.
- **harness-lint:** clean.
- **Known open issues:** none in the shipped code.
- **Debt from the ADR and the review:**
  - The hub's count and the Alert now carry two placeholders nobody can act on (ADR 0001 § Consequences).
  - `tests/brainstorm/assistant-attention.spec.js` still pins the hub's counts as literals, so every new card must
    re-aim it (review non-blocking finding 1).

## 6. Carry-forward register

- [ ] **Promote to production.** The book is on `staging` only (`e3e436e6`). It goes to `main` with the owner's next
      `staging` → `main` promotion (`/cycle-prod`).
- [ ] **Build the real pages, and a real check, for both cards.**
  - The later code book named in book `duty-menus-and-self-maps` § "Not in this book" publishes menus and self-Maps.
  - It replaces each placeholder: a page in `ACTION_PAGES`, the key in `CHECKED_ACTIONS`, and an answer from
    `GET /api/assistant/attention`.
  - It decides what **Done** means for each card, which also takes the two marks off everyone's count (§4 #2).
- [ ] **Where the Assistant's Treasure Map page links.** Today there is no link. The real page may want to show the
      person's own Map beside the Assistant's self-Map; that is for the later book (§4 #4).
- [ ] **The FAQ.** "What tasks can my Tapestry Assistant perform on my behalf?" does not yet mention the Duty Menu or the
      self-Map. Out of this book's scope (story § Out of scope); for the owner once the protocol settles.
- [ ] **Literal counts in the attention spec.** Derive `tests/brainstorm/assistant-attention.spec.js` B1–B5's counts
      from the hub fixture, as `assistant-profile-check.spec.js:40` does, before the next card is added. Tracked as an
      occurrence on OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts`.

## 7. Process findings (harness)

**Measured with `bash scripts/harness-stats.sh` at retro time:**
- 286 reviews decided, kick-back rate 0%, churn 3;
- books: 9 open (this one included), 77 closed;
- cycle-time median 0d (same day).

This book matches that profile: one story, five gates, story to PASS on the same day, no review round 2.

| Finding | Source | Ports to the other flow? | Terminal state |
|---|---|---|---|
| 1. Test Design's re-aim search covered `test/` and the fixture's names, and missed two browser specs that pin the hub by value: `assistant-outbox-relays` B1 (3 persona cards) and `assistant-attention` B1–B5 (literal counts). The first green browser run caught both, and each went back to Test Design as its own `test:` commit. | review "Harness friction" 1; test plan § Verification amendment | Yes. A Direction-mode Gate 4 pins an empty `test/` diff after Gate 3, so the miss would halt that flow outright. | OPEN.md row `2026-09-21-adr-reaim-list-misses-outcome-asserts` (occurrence appended; already OPEN) |
| 2. Any HTTP responder on `:7778` makes the live tiers run. A throwaway UI server for the browser specs turned a green tree into 15 failures across 8 unrelated suites (`20261011T160755Z-22581-fad5`). Moving it to `:7799` fixed it. | review "Harness friction" 2 | Yes. Any flow that serves a build for the browser classes without the stack. | OPEN.md row `2026-09-20-live-tier-fails-on-stale-stack` (variant appended; already OPEN) |
| 3. Told to develop on `staging`, a session must either push Phase-3 red tests to the shared line or hold commits against the stop hook. This session held them, and the hook asked three times. The implementation then reached `staging` (and its deploy) before Review, not after as agreed at intake. | review non-blocking finding 2 and "Harness friction" 3 | Yes. Direction mode supervises the same staging chain. | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (occurrence appended; already OPEN) |
| 4. In the shallow cloud clone, the workflows' origin-drift preflight (`git fetch` and then `git status`) read "ahead 586, behind 51" with no merge base. The truth, after `--unshallow`, was 290 behind and 0 ahead. | this close (session start) | Yes. Direction's Stage-0 runs the same check. | OPEN.md row `2026-10-11-shallow-clone-skews-drift-preflight` (new) |
| 5. The cloud container started with no `node_modules`. The first suite runs failed to load `nostr-tools` until `npm ci`. | this close | Yes, equally. | **Declined:** one `npm ci` (about a minute) fixed it. The failure named the missing module plainly, so it cost no misdiagnosis. Installing dependencies is the environment's setup script, which the owner configures, not the repo harness. |
| 6. Five human gates for a two-entry data change. | this close | Not applicable. Direction mode answers its gates with judges. | **Declined:** the owner chose Standard's full path at intake (book Decision 3), knowing the size. The Light profile trial (`workflows/light-profile.md`) already exists for books that want fewer gates. |
| 7. `pkill -f spa-server.js` matched its own shell and killed it (exit 144) while stopping the test server. | this close | — | **Declined:** an operator slip with no harness surface. Stopping by PID (`pgrep -f "^node .*spa-server.js"`) avoided it the second time. |
