# Build Audit: Identification Tags — two authored definitions, two parked taggings

**Book:** `engineering-team/audits/identification-tags-authorship/book.md`
**Date:** 2026-09-22
**Branch / commit range:** `a95bb51b..5afd2158` on `feat/identification-tags-authorship`, off `origin/staging` at `7381c459`.
- **Commits.** 11 of the book's own, no merges: 1 intake, 2 story, 2 adr, 3 test, 1 impl, 1 review, 1 ledger. The
  shared line was re-checked before Implementation and before Review (0 behind, clean trial merge each time).
- **Merged** to staging as `3f08cc49` (PR #752, 2026-09-22T22:23:59Z, two seconds after a safe verdict); deploy run
  35792165321 (1m32s); smoke clean (§5).
- **Promoted to main** the same evening by a sibling session, as PR #754 (merged 2026-09-22T22:38:59Z, bundled with the
  top-bar pill hotfix #753); deploy run 35793493687; production verified (§5). The owner had ordered the promotion at
  this close; it was done before the close landed, so the close artifacts ride the next promotion.

**Provenance:** Acceptance-frame. There is no PRD. The owner's ask of 2026-09-22 is quoted verbatim in `book.md`; the
four product decisions were taken at the story gate the same day (the two authors as found on the relays; the parked
taggings do not count; a parked row says "Not offered yet"; the fourth tagging keeps the name "My Human").
**Confidence:** **high.**
- One story, tracing to every frame bullet; reviewed PASS in one round by an independent Reviewer who re-ran every
  gate and re-proved every universal claim by command.
- Seen on `staging.brainstorm.world` after the deploy: the rendered page carries the two parked rows greyed (opacity
  0.55), their boxes disabled and unchecked, "Not offered yet"; the attention route and the refusal answer as
  specified; the bundle carries both author keys.
- Not yet seen: a signed-in viewer on staging or production (no signer in the browser pane; the mocked browser
  suites and a signed-in probe on the local stack cover it), so Nous' own hub reading Done on production is inferred
  from the relay data (both offered taggings exist there by name), not observed.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **Each offered definition has its own author.** The shared list names "My Tapestry Assistant" by the tag Nous
  published (`39999:15f7dafc…:my-tapestry-assistant`) and "My Tapestry Owner" by the tag Nous' Tapestry Assistant
  published (`39999:a73a2980…:my-tapestry-owner`); the single canonical author of the previous book (the owner's
  key, which authored nothing) is gone from the code —
  `stories/done/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md`
- **Two taggings are parked.** "My Agent" and "My Human" stay on their cards with a greyed row, a disabled unchecked
  box and the words "Not offered yet"; nothing reads, counts, publishes or accepts them — story 1.
- **The answer counts what can be issued.** `GET /api/assistant/attention` looks up the two offered taggings and
  their definitions (each at its author's address) and carries two rows; `done`, `pending` and so the hub's card,
  its count line and the Assistant Alert consider the offered two only — story 1.
- **Both publishers point at the right definitions.** The first card's tagging carries `a`/`e` of Nous' definition;
  the Assistant's route looks its definition up under `a73a2980…` and refuses a parked key 400 before any key is
  read — story 1.
- **The documents say so:** BIBLE §11 (both routes) and §14, and the OpenAPI descriptions — story 1.

## 2. Epics & stories rolled up

### Epic: `identification-tags-authorship` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 two-authored-tags-and-two-parked-taggings | Per-entry definition authors, the parked pair, the two-row answer, both publishers re-pointed, the documents | Done | `reviews/done/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md`: PASS, round 1 |

## 3. As-built inventory

Derived from the diff (`git diff --stat 7381c459..3f08cc49 -- src ui test tests BIBLE.md`: 14 files,
+598 −373) and checked against the story, ADR, plan and review; the Reviewer confirmed the implementation commit
touches only the eight files the ADR names.

- **User-facing.**
  - `/assistant/identification-tags`: each card shows its offered row (Present · Missing · Checking… · Tag not
    found · Could not check, as before) and its parked row (`.bs-idtags-row.is-parked`: opacity 0.55, a
    `cursor: not-allowed` label, a disabled unchecked checkbox, "Not offered yet"). A card whose offered row is
    present reads Done beside its parked row.
  - The hub's card, count line and the Assistant pill read a two-row answer; nothing else changed for them.
- **Domain.**
  - `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant` — "My Tapestry
    Assistant", by Nous 🧠 (`npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm`); created 2026-09-22
    through tapestry.brainstorm.world; on its relay, staging's, tags', nos.lol, primal, dcosl.
  - `39999:a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528:my-tapestry-owner` — "My Tapestry
    Owner", by Nous 🧠's Tapestry Assistant (`npub15uaznqrgf946yhva0u6c88jk3r9kp64cn4dt5z24yrtcxk5lj55q2fvc99`);
    same day, same reach. Both carry production's TA as their local z (they were made on production).
  - No concept definition changed; no firmware reinstall. The ADR-0015 legacy z literal and the runtime local z are
    untouched (the Reviewer diffed the four legacy-literal files: zero lines).
- **Data & contracts.**
  - `src/lib/identification-tags/index.js`: entries `{ key, name, slug, signer, target, offered, author, address }`;
    `OFFERED_TAGGINGS`; `definitionAddress(entry)` (`39999:<author>:<slug>` or `null`); `CANONICAL_TAG_AUTHOR` and
    `canonicalTagAddress` removed (`grep -rn … src ui/src` prints nothing).
  - `src/api/assistant/attention.js`: the plan over `OFFERED_TAGGINGS`; definitions grouped by author, one
    `lookupByAddresses` per author in the same `Promise.all` as the two signer lookups (up to four outside reads per
    relay on a local miss, was three); the answer's `taggings` has two rows; the row's `definition.address` is the
    entry's.
  - `src/api/assistant/identificationTaggings.js`: `ASSISTANT_ENTRIES` from the offered set, so `my-human` fails
    the body check (400 `not-an-assistant-tagging`, before `getAssistantKeys`); the definition looked up per author;
    the tagging's `a`/`e` from it. The wire format of a tagging is unchanged.
  - BIBLE §11 both rows and §14's bullet; OpenAPI: both descriptions and the `keys` description; "Last updated".
- **Tests.** Fixtures rewritten (`AUTHORS`, `OFFERED`, `PARKED`, `definitionAddress`, two-row canned answers, the
  parked words); `assistant-attention` 39 tests (L2/L3, U18, S5 new), `assistant-identification-tags-page` 16 (C8 new),
  `assistant-taggings-publish` 20 (E12 new); browser specs rewritten: page 14 cases (B13 new), publish 7 (B6 new).

## 4. Deviations from intent

Harvested from the ADR's § Consequences, the plan's after-implementation record (this story kept no § Deviations
log; its judgment calls were recorded there and in the ADR), and the review's non-blocking findings.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: parked rows "greyed out and not editable" | Opacity 0.55 on the row plus a `cursor: not-allowed` on the label; the ADR named the opacity only | interpretation | review non-blocking 3 (serves "uneditable"; changes nothing else) | None | — |
| 2 | Frame bullet 3: the hub, count line and Alert "consider only the two offered taggings" | Also the page's own card state: a parked row never marks a card and never counts against Done; a card of parked rows only would read unknown | intentional-change | ADR 0001 sub-decision 3 (`cardState` leaves parked rows out); C4 pins it | A card with its offered tagging present reads Done beside a greyed row | — |
| 3 | Frame bullet 1: "the app names each by that author's address" | Two definition authors mean two definition lookups; on a local miss the check reads each tag-federation relay up to four times per page load, not three | constraint-discovered | ADR 0001 § Consequences; review § Things tests can't catch (acceptable: opt-in relays, parallel, budgeted) | None visible | §6 #5 |
| 4 | Frame bullet 2: unparking is "a small change" | `definitionAddress` and the route's grouping assume an offered entry has an author; a half-unpark (`offered: true`, `author: null`) would scan `authors: [null]` and read "Tag not found", though L2/L3 fail first on such a list | interpretation | review non-blocking 2 | None today | §6 #3 |
| 5 | ADR § Implementation notes: the proving command "must print nothing" over `src ui/src test tests` | It prints the two test guards that assert the names are gone; the command over `src ui/src` is the one that proves the claim | interpretation (docs) | review non-blocking 1 | None | §6 #4 |
| 6 | Plan S5: BIBLE and OpenAPI carry no "two identification taggings" | S5 reads the BIBLE body only: the "Last updated" changelog line keeps that phrase in a "prior:" clause describing a past state | intentional-change | Tester-lane correction `c61c3794`; the Reviewer found nothing else hidden (`sed '8d' BIBLE.md \| grep …` prints nothing) | None | — |
| 7 | Plan: every test change has a plan line | Three test-only tweaks without one: B12 strips query strings from logged paths, publish B4 dropped a redundant route, U8 gives a second other-author tagging a distinct `createdAt` | added-beyond-scope (tests) | review non-blocking 4 (each right on its merits) | None | — |
| 8 | ADR: the list "keeps its name" | `REQUIRED_TAGGINGS` now covers parked entries too; kept for the previous book's callers and the S-class suites | intentional-change | ADR 0001 § Consequences (a rename is a later tidy) | None | — |

**Undocumented work** — none. The tests/plan commit and the implementation commit touch only the files the ADR and
the plan name; no dependency file moved (review § The rest).

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind
  (`+dirty` is this close, uncommitted; the code is staging's `3f08cc49`):
  `20260922T224003Z-62975-78f5 [book-close-identification-tags-authorship] started 2026-09-22T22:40:03.722Z on 3f08cc49+dirty — FAIL, exit 1, 3744 passed, 50 failed, 130 skipped, 226/226 suites; failed: tag-detail, capture-a-goal-and-see-it, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, not-yet-shared-filter, concept-count-canonical, summaries-element-count`
  (Node 22.23.2; the stack up.)
  - **The failing set is this host's known one, unchanged:** the same fourteen live suites as the previous book's close
    gate (`20260922T130828Z-49331-2d67`), compared over all 226: 223 suites unchanged, and the only three that moved
    are this story's, each by its new cases (37/0 → 39/0, 15/0 → 16/0, 19/0 → 20/0).
  - **Staging moved while the gate ran:** the top-bar pill hotfix (PR #753, `b2937ca5`) merged after this close
    branched from `3f08cc49`; the close commit was rebased onto it (no file overlaps).
- **The book's gate** (the plan's recipe, 53 suites, Node 22.23.2), twice on committed trees:
  - the Tester's `20260922T220123Z-58022-a4f8 [identification-tags-authorship-1-after]` on `1ea0e9cc` — PASS,
    794 passed, 0 failed, 114 skipped, 53/53;
  - the Reviewer's `20260922T221011Z-96836-9de7 [identification-tags-authorship-1-review]` on `7d8581da` — PASS,
    794 / 0 / 114, 53/53, identical suite by suite.
  - **Against the baseline** (the previous book's close gate `20260922T130828Z-49331-2d67`, compared over the 53):
    50 suites unchanged; only the story's three moved, each by its new cases (`assistant-attention` 37/0 → 39/0,
    `assistant-identification-tags-page` 15/0 → 16/0, `assistant-taggings-publish` 19/0 → 20/0).
- **Browser class,** against the rebuilt UI on `localhost:7778` (`index-r3Y8NShy.js`), the six classes together,
  run by the Tester and again by the Reviewer: 64 passed, 1 skipped by design (the hub spec's identification-tags
  placeholder case), exit 0, 3.1 min.
- **A signed-in probe of the route on the local stack** (the local owner's key from the Keychain signed the challenge
  in-process): anonymous POST → 401; `my-human` → 400 with the approved words; `my-tapestry-owner` → 200 with one
  `tag-not-found` row (no definition by `a73a2980…` reachable locally); nothing written.
- **Production** (PR #754 by a sibling session, deploy run 35793493687), smoke tiers 1–5 clean after the 502 window:
  bundle `index-DUEUUBue.js` → `index-ChSbP99o.js` (the hotfix rides in it), carrying "Not offered yet" and both
  author keys; the attention route 200 `signedIn:false`; the anonymous parked-key POST 401; the three `/assistant`
  pages 200; search 372 hits; the rendered DOM shows four rows, two `is-parked` at opacity 0.55 with disabled
  unchecked boxes; no console errors.
- **Staging** (PR #752, deploy run 35792165321, 1m32s), smoke tiers 1–5 clean: bundle `index-DUEUUBue.js` →
  `index-r3Y8NShy.js`, the same hash the local build produced; the attention route 200 `signedIn:false`; the
  anonymous parked-key POST 401 from the middleware; the three `/assistant` pages 200; the rendered DOM shows four
  rows of which two are `is-parked` at opacity 0.55 with disabled unchecked boxes and "Not offered yet"; no console
  errors on the page or the hub. Two bundle-string checks in the smoke script read wrong and were traced: the class
  name is built from a template, so its literal never appears in a bundle (the DOM is the proof), and the retired
  key still occurs twice in the bundle because two untouched files use it for other purposes (a config constant and
  the user-search placeholder).
- `bash scripts/harness-lint.sh`: clean at close.
- **Known open issues:** the previous book's carry-forward register (`audits/assistant-identification-tags/audit.md`
  §6) apart from its item 1, which this book supersedes; ledger `2026-09-22-strict-lookup-third-copy` (now four reads
  per relay on a miss); OPEN.md row 269 (pre-existing).
- **Debt from the ADR's Consequences:** the list is the only home of the authors (a republished definition means
  editing it); `REQUIRED_TAGGINGS` misnamed; the outside reads' batching still deferred.

## 6. Carry-forward register

- [ ] **1. The decision on "My Agent" and "My Human".** The owner's team will play with the feature and decide.
      Unparking one is `offered: true` plus its definition's author in `src/lib/identification-tags/index.js`, with
      the definition published; dropping one is removing its entry. (frame bullet 2; ADR § Enables)
- [x] **2. Promotion to main** — done before the close landed, by a sibling session (PR #754, 2026-09-22T22:38:59Z);
      production verified signed out (§5). Still to see: Nous' own hub reading Done on production, which needs a
      signed-in look. (audit header)
- [ ] **3. A guard for a half-unpark:** an offered entry with no author should fail loudly (a library assert, or
      L2/L3's failure is the guard today). (§4 #4; review non-blocking 2)
- [ ] **4. Docs tidy when next touched:** the ADR's proving command scoped to `src ui/src`; the `cursor: not-allowed`
      rule named beside the opacity. (§4 #1, #5; review non-blocking 1, 3)
- [ ] **5. Batching the outside reads** — four per relay per page load on a miss now. (ledger
      `2026-09-22-strict-lookup-third-copy`; §4 #3)
- [ ] **6. The `protocols/` convention note on well-known tags,** now with two authors instead of one key; still
      unwritten, docs-lane, the owner approves. (previous book's register #6)
- [ ] **7. The previous book's register items 2–14** stay as they are, apart from #1 (superseded by this book) and #2
      (shipped): `audits/assistant-identification-tags/audit.md` §6.

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-09-22, and the session-start digest):
- 243 reviews parsed: 241 final PASS, 2 final CHANGES_REQUESTED; 47 with kick-back history; re-review churn 3.
- Books: 66 closed with this one; 5 still open.
- The digest counts 155 open harness lessons, the oldest 82 days old. This book files **no new row**: its two
  lessons are sentences on rows the previous book opened.
- **What held:** the shared line re-checked twice (no drift); the ADR written with its proving command; the gate
  compared suite by suite against a baseline already on record; the close after the merge, in the workflow's normal
  order (the previous book's close-before-merge question did not recur).

| Finding | Source | Terminal state |
|---|---|---|
| **The ADR's proving command was written but not run before Review,** and its scope included the tests that assert the absence. Ports to Direction mode: yes | review, harness friction 1 | OPEN.md row `2026-09-22-universal-claim-without-proving-command`, second-sighting paragraph (commit `5afd2158`) |
| **The strict-lookup row counted three reads per relay; it is four now,** by the two definition authors | review, harness friction 2 | OPEN.md row `2026-09-22-strict-lookup-third-copy`, dated paragraph (commit `5afd2158`) |
| **The story's Linked-artifacts "Review:" line was left for the main session to fill** | review, harness friction 3 | OPEN.md row `2026-09-22-linked-artifacts-not-written-at-gates` (already open; nothing new) |
| **CLAUDE.md's "local-dev value (`82b75e47…` on this machine)" is not this machine's TA** | review, harness friction 4 | OPEN.md rows 44, 127, 168, 223 (already open; nothing new) |
| **S5 was over-scoped to the whole BIBLE,** including the "Last updated" changelog line whose "prior:" clause quotes the old wording | Implementation; plan § After implementation | declined: a one-off, corrected in its own `test:` commit with the reason in the plan; the Reviewer confirmed the narrowing hides nothing |
| **Two bundle-string checks in the staging smoke script were wrong** — a class name built from a template at runtime, and a key the UI legitimately uses elsewhere — and read as failures until traced | the ship (session) | declined: caught before the report, verified by the DOM and the source; the lesson (check runtime-built class names in the DOM, and trace a key's other uses before calling it retired) is a session note, not a harness rule |
| **The story carried no § Deviations log;** the Implementer's judgment calls sit in the plan's after-implementation record and the ADR, where this audit harvested them | this close (§4) | declined: the record exists and was found; the template's § Deviations is the better home, and the next story of this size should use it |
