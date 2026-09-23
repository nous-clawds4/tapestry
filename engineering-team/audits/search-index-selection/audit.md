# Build Audit: Search-index selection

**Book:** `engineering-team/audits/search-index-selection/book.md`
**Date:** 2026-09-23
**Branch / commit range:** `feat/search-index-selection` — book code range `191dee3c..bc12e7f1`
(the five stories); close range `c3b40b01..0c428f8f` (includes the absorbed `origin/feat/tags`
merge `99b66150`, which carries unrelated upstream work — llms-txt, `siteTrust`, the
pagerank_deprecating removal — and is **not** this book's).
**Provenance:** Acceptance-frame (no PRD) — the frame in `book.md`, settled at the 2026-09-18
design debate and captured in `docs/SEARCH_INDEX_DLIST_SELECTION.md` (rev 3).
**Confidence:** medium-high on the as-built record — every frame bullet has source-linked evidence
and each story was reviewed with a live browser drive against a running stack. Two named gaps: frame
bullet 4's *end-to-end* was never demonstrated (§4 #1), and the full `npm test` book-close gate
could not complete on this host (§5, §7 (j)), so this audit quotes no full-gate verdict.

> The Build Audit is the as-built record. It does not propose changes — that is the seed's job
> (`prd-seed.md`).

---

## 1. What shipped

- **Tag a Decentralized List header from the app.** `/list/:ref` offers a tag affordance on the
  header block for a kind-39998 list; the assertion targets the header's **coordinate**, and a
  tagged header now resolves for display (name + description) wherever tagged targets are listed,
  in a dedicated "Lists" group rather than the orphan bucket —
  `stories/search-index-selection/1-tag-a-list-header.md`.
- **"Only me" curation.** A pin can count only the viewer's own taggings (`authorConstraint:
  "observer"`), surfaced in the curation dialog as a two-option **Trust scope**. The published
  Trusted List discloses it with `['author-constraint','observer']` —
  `2-only-me-curation.md`, ADR 0001.
- **Per-pin membership method.** A pin carries its own `membershipMethod`
  (`count` | `input` | `certainty`); absent means the instance-wide dial. Every published kind-30392
  now carries `['membership-method', <fold-that-ran>]`, naming the **post-downgrade** fold —
  `3-per-pin-membership-method.md`, ADR 0002.
- **A confirm step before the first pin.** The curation dialog opens *before* anything is signed,
  pre-filled with today's defaults and editable; cancelling publishes nothing; the community-pin
  path routes through the same interstitial with the chosen context shown and fixed —
  `4-confirm-step-on-first-pin.md` (Design note, no ADR).
- **Explicit pin variants ("recipes").** A viewer can hold several pins of one tag distinguished by
  a name they choose (`['variant','<slug>']`, address suffix `-v-<slug>`) instead of by claiming a
  community (`-in-<ctx>`, unchanged). Uniqueness is refused client-side before signing; the runner
  skips a pin whose author ≠ observer (C3) and freezes both claimants on a residual own-pin
  collision. The Pinned tab gains a `＋ New curation` door and a "Your curations" band —
  `5-explicit-pin-variant-key.md`, ADR 0003.

## 2. Epics & stories rolled up

### Epic: `search-index-selection` — **Done** (merged to `feat/tags` 2026-09-22; deployed to tags.brainstorm.world)

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 tag-a-list-header | header tag affordance (39998-gated) + kind-derived item resolution + "Lists" group | Done | `reviews/search-index-selection/1-tag-a-list-header.md` (2 rounds) |
| #2 only-me-curation | `authorConstraint` predicate + 1.0 self-weight carve-out + list disclosure | Done | `.../2-only-me-curation.md` (1 round) |
| #3 per-pin-membership-method | per-pin fold + `membership-method` disclosure restored + one client vocabulary module | Done | `.../3-per-pin-membership-method.md` (2 rounds) |
| #4 confirm-step-on-first-pin | create-mode interstitial + pure `buildCuration` extraction | Done | `.../4-confirm-step-on-first-pin.md` (3 rounds) |
| #5 explicit-pin-variant-key | `variant` tag, `-v-` address form, C3 author rule, collision freeze, recipe UX | Done | `.../5-explicit-pin-variant-key.md` (2 rounds) |

Artifact mass: 30 phase commits attributed to the epic (`scripts/harness-stats.sh`, run
2026-09-23); 5 stories, 3 ADRs, 5 test plans, 5 review files, 8 rounds of review across the five.
Three ADRs were Accepted through the Light J1 gate (0003 took five rounds — each one found one more
address composer, which is why its readers table is exhaustive).

## 3. As-built inventory

**Code diff (book only, `191dee3c..bc12e7f1`, `src ui/src test firmware`):** 37 files,
+5,040 / −236.

**User-facing**
- `/list/:ref` — tag affordance on the header block, gated to `kind === 39998`
  (`ui/src/pages/List.jsx`).
- Tag page → Pinned tab — the pin switcher's three bands (`📌 Personal` → places → `Your curations`
  divider → `🧪 recipes`), a `＋ New curation` door, and an Items leaf that groups tagged headers
  under "Lists" (`ui/src/pages/Tag.jsx`, `ui/src/components/PinnedListPanel.jsx`,
  `ui/src/components/TagItemsView.jsx`, `ui/src/utils/dlistHeaders.js`).
- Curation dialog — create mode re-lit as an interstitial, plus three new controls: **Trust scope**
  ("My web of trust" / "Only me"), **Membership method** (with an "Instance default" option), and
  **Save as a separate curation** (name → slug, live preview)
  (`ui/src/components/CurationMethodDialog.jsx`, `ui/src/utils/curationDialogBuild.js` — a pure,
  node-testable build module extracted from the JSX).
- Pin detail — "Curation scope" and "Membership method" rows read off the published list
  (`ui/src/hooks/useTLDetail.js`).
- Trust Determination page — the instance dial now describes itself as the *default for pins that
  don't choose*, and its "published TLs record the active method" claim is true again
  (`ui/src/pages/grapevine/TrustDetermination.jsx`, `ui/src/config/tlMembershipMethods.js`).
- `/pins` — recipe rendering beside contexts (`ui/src/pages/Pins.jsx`).

**Domain / concepts** (handles all `kind:pubkey:slug`; runtime-TA composition preserved; ADR-0015
`LEGACY_*` constants untouched and none removed)
- `39998:<TA>:tag-pinning` — `json-schema.json` `curationMethod` description gains
  `authorConstraint` and `membershipMethod` (and the previously-omitted `targetTypes` / `noteMethod`);
  `concept-header.json` gains the "a user may hold SEVERAL coexisting pins of one tag" sentence, plus
  a `variant` property. **Firmware reinstalled** locally (verified through
  `GET /api/concept-graph/node/…`, not by reading the JSON) and on the droplet at the 2026-09-22
  deploy. Residual ledger row: OPEN 309.
- `39998:<TA>:trusted-list` — the 30392/30393/30394 family; no shape change beyond the new tags.
- `39998:<runtimeTA>:<contextSlug>` — community contexts become *one populator* of the variant
  rather than the only one.
- `39998:b83a28b7…:github-accounts` — the day-one target header (story 1 made it taggable).

**Data & contracts — the wire artifacts now live on tags.brainstorm.world**

| Artifact | Where | Rule |
|---|---|---|
| `['author-constraint','observer']` | 30392 / 30393 / 30394, after `min-rank` (profile) / after `['p', observer]` (note, item) | emitted **only** for a *known* constraint; absent on every pin published to date (`refreshPinnedTags.js:51`) |
| `['membership-method', <fold>]` | every 30392, after `min-rank`/`author-constraint`, before `rigor` | unconditional; names the **post-downgrade** fold (`refreshPinnedTags.js:451`). The one deliberate non-additive break of byte-identity, ruled at Gate A; it *reverses* the Story-4 strip |
| `['variant','<slug>']` | kind-39999 pin, and recipe Trusted Lists only | recipes only; a community pin is byte-identical to before (`refreshPinnedTags.js:155`) |
| address suffix `-v-<slug>` / `-in-<ctx>` | all five `d`-tag schemes (pin, 30392, 30393, 30394, 30003 export) | one composer, `pinVariantKey({contextSlug, variantSlug})`, variant wins (`src/lib/event-tagging/pins.js:52-54, 77-87`); `VARIANT_SLUG_MAX = 40`, canonical `slug()` |
| **C3 policy** | all three runners, immediately after the observer bail | a pin whose **author ≠ observer** is skipped, publishes nothing and claims no address; logged once per pin id |
| **Retraction consequence of C3** | `retractStaleTLs` | because a skipped pin contributes no `d` to the cycle roster, any list it previously published is **republished as `['status','retracted']` with empty membership** — at the permanent subscription address, with a visible status. Intended (ADR 0003 Consequences; J1 corrected the draft, which claimed the opposite). If the observer holds their own pin, that pin is the sole claimant and nothing at the address changes |
| Residual own-pin collision | `refreshAllPinnedTags` pre-pass | both claimants frozen (`status:'collision'`), all `d`s kept on the roster, `pin-variant-collision` logged, nothing published — never a silent stomp |

**Server API** — `src/api/trustedList/refreshPinnedTags.js` (+268), `src/lib/event-tagging/pins.js`
(+195), `src/api/profile-tags/index.js` (+80), `src/api/event-tags/index.js` (+81),
`src/api/trustedList/{index,membershipMethods}.js`. New SDK exports: `AUTHOR_CONSTRAINTS`,
`isKnownAuthorConstraint`, `authorPredicateFor`, `authorWeightFor`, `variantOfPin`,
`variantKeyArgs`, `VARIANT_SLUG_MAX`, `validateVariantSlug`. No new dependency; `package.json`
untouched; no new lint/typecheck/build tooling.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 4: "Pinning `worth-indexing-for-search` … on a curator who has tagged the `github-accounts` header yields a TA-signed kind-30394 whose sole `a` member is that header's coordinate" | Every **mechanism** shipped and is live; the **specific list has not been demonstrably published**. Every story put the tag's authoring and the tagging itself out of scope ("no code" — design-doc build-progression step 3), and the 2026-09-23 Gate-B walkthrough exercised the five mechanisms, not this end-to-end | deferred | story 1/2 `Out of scope`; design doc "Build progression" step 3 + "Naming, because this becomes a de facto standard" | The search backend still has no address to subscribe to until a curator publishes the tag and tags the header | **Yes — the single highest-value next act.** Blocked only on the naming decision (`worth-indexing-for-search` vs `worth-indexing`) and on whose pubkey owns the namespace |
| 2 | Frame: "the membership method and the new constraint live on the pin" (one bullet) | Split at Gate A into story 3 (Part A, scoring) and story 5 (Part B, identity), with story 4 inserted between them by operator request | intentional-change | book decision log 2026-09-18 (Gate A ruling 8); new story 4 (operator) | None — the capability is whole | — |
| 3 | AC-3/AC-2 byte-identity of already-published lists | Held everywhere **except** one deliberate exception: every 30392 gains `['membership-method', …]` | intentional-change | ADR 0002 Consequences; Gate A ruling 3 | A downstream reader that deep-equals a 30392's tag array sees one new entry. Nothing in this repo does | `membership-method` is now a permanent wire contract — removing it again owes a superseding ADR |
| 4 | Story 2 AC-7 "all three methods compose, none special-cased" | Composition is untouched, but a constrained observer's own weight is pinned at **1.0** | interpretation (ruled) | operator ruling 2026-09-18, ADR 0001 Consequences — without it, an observer with no `wot_rank` doc publishes an empty list under the very method the guard exists to run | The "Only me" × `certainty` combination — the day-one shape — produces a populated, fully-scored list. Verified live: 17 members, every score 50 | — |
| 5 | Story 1 AC-1 "a tag affordance on the header block" | Gated to `kind === 39998`; a legacy kind-9998 header (32 in the local corpus) shows **no** affordance | constraint-discovered | review #1 round 1 — `headerCoord` returns the *event id* for a 9998, and the write path does no coordinate validation, so the affordance could mint a permanently unresolvable `['a', <64-hex>]` | A legacy list cannot be nominated for indexing at all | **OPEN 308** — is a 9998 taggable by `{ id }`, or simply not a candidate? Not this book's call |
| 6 | Story 5 AC-6 "the minimum switcher UX" | Shipped as one divider + one glyph + a fixed neutral→places→recipes order, hard-coded in two places; the full places-vs-recipes IA round is **not** spent | deferred | design doc `:220-225` treated as binding, not as a to-do; ADR 0003 Consequences "New debt" | Recipes are legible but the IA is provisional | **Yes** — the deliberate design round (`Tag.jsx`, `Pins.jsx`, `PinnedListPanel.jsx`) |
| 7 | Story 5 §5 "creation lives in the curation dialog" | Round 1 shipped exactly that — and the dialog was **unreachable** for a viewer holding an ordinary neutral pin, i.e. the story's primary user | constraint-discovered (fixed) | review #5 round 1 blocking #1, live-verified on the rebuilt bundle; fixed by `e54e99f9` (a `＋ New curation` door gated `hasAnyPin && user`, with an empty-name refusal so the new door can never stomp the neutral pin) | None at close — reachable and live-verified | The reachability handle is still a source regex (S22); a render-level handle is owed |
| 8 | ADR 0003 blast radius | Two files outside it were touched: `ExportModal.jsx` (2 lines, forwards `noteExport.variant` — without it ADR §4's export row does nothing) and `PinnedListPanel.jsx` `handleEditSubmit` (re-pins *with* the recipe variant; without it a curation edit would stomp the viewer's neutral pin) | added-beyond-scope (justified) | story 5 `## Deviations` 1–2; ratified at review | None — both close hazards the ADR's own rules imply | — |
| 9 | ADR 0002 Implementation notes §1 (hoisted `resolveDial` alias) and §3 (a comment in `defaultCurationMethod`) | Alias inlined; comment omitted | interpretation | story 3 `## Deviations` — the alias form would fail an untouched guard (`pin-stack-composition:473-475`) that requires the literal `resolveMembershipMethod(`; semantics identical | None | — |
| 10 | Light profile: "the full `npm test` … remains the book-close and promotion gate" | Correct by the rules, but **five** per-story reviews in a row carry "full gate not run", so the book inherits the whole full-gate debt at once | constraint-discovered | review #2 harness friction 2; every review says so explicitly | None at close — §5 discharges it | Named in §7 (b) |

**Undocumented work** — the book-only diff (`191dee3c..bc12e7f1`) contains **no file without story
or ADR provenance**. Every path maps to a story's Design note or an ADR blast radius, including the
two deviations at #8. Three caveats on the *close* range rather than the book range:

- `99b66150` merged `origin/feat/tags` into the epic branch mid-book, absorbing unrelated upstream
  work (llms-txt story 1, `siteTrust`, auth middleware, the `pagerank_deprecating` removal,
  `trusted-list-raw-view` / `usePinnedItems` / `TrustedListDetail` from the earlier
  `dlist-item-tagging` tail). None of it is this book's; it is excluded from §3's counts.
- Story 1's `## Deviations` prose went stale after `04d2bb95`/`f12c62bc` resolved two of its items
  (review #1 non-blocking 5). Documentation drift, since corrected; recorded because the class
  matters more than the instance.
- `ui/src/hooks/useTagMemberSets.js` changed under story 5 to close **OPEN 298**, which is an
  ADR-0003 Consequence rather than an AC — correctly declared, worth naming because it is the one
  place the book fixed a pre-existing bug rather than adding a capability.

## 5. Quality state at close
- **Test gate — attempted twice at close, and it does not complete on this host.** Both runs stall
  on the same live suite. The `npm run gate:status` lines, verbatim:
  - `20260923T170144Z-2353287-4c50 [book-close-search-index-selection] started 2026-09-23T17:01:44.980Z on 0c428f8f+dirty — INTERRUPTED by SIGTERM, exit 143, no totals (interrupted), 17/216 suites; failed: profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write, tag-detail-write-publish, tag-index, tag-index-publish, authored-tagging, profile-tag-polish, pin-a-tag, pin-a-tag-publish · tmp/gate-runs/20260923T170144Z-2353287-4c50.json`
  - `20260923T170711Z-2397240-5f82 [book-close-sis-2] started 2026-09-23T17:07:11.089Z on 0c428f8f+dirty — RUNNING — 17/216 suites, current pin-a-tag-publish · tmp/gate-runs/20260923T170711Z-2397240-5f82.json`
  Both stop advancing at **suite 18/216, `tl-publication-from-pins`** — a live suite whose setup
  waits on a full `refresh-all`, i.e. exactly OPEN 315's ~30-minute cycle. So **no full-gate verdict
  exists for this close, and this audit does not claim one.** That is a finding, not a formality:
  the Light profile makes the full gate the book-close gate (`light-profile.md:21`), five
  consecutive reviews deferred to it, and it turns out the gate has not been runnable end-to-end on
  this corpus since the cycle time grew. OPEN 315 is therefore larger in scope than its row states —
  it does not merely block three TL suites, it blocks the book-close gate itself. **What is owed:**
  a full `npm test` on a host or fixture corpus where `refresh-all` is not ~30 minutes (or after
  OPEN 315's "point the live legs at `refresh-pinned-tag`" fix), quoted into this section.
  *(State at close: the second run was left detached — pid 2397240, label `book-close-sis-2` — still
  stalled at suite 18 while a sibling book-close gate started on the same checkout. Re-read it with
  `npm run gate:status -- --label book-close-sis-2`; stopping it is reasonable, since two gates on
  one stack demonstrably contaminate each other.)*
- **What *is* certified.** Every suite this book wrote or touched was run green by the Reviewer in
  the foreground, per suite, exit code captured by brace-redirect, and recorded in the five review
  files: `tag-a-list-header` 28/0/0 · `only-me-curation` 35/0/0 · `per-pin-membership-method`
  31/0/0 · `confirm-step-on-first-pin` 27/0/0 · `explicit-pin-variant-key` 51/0/0, with the guard
  suites `pin-stack-composition` 20/0, `context-scoped-pins` 32/0, `item-trusted-list` 51/0,
  `note-trusted-list` 15/0, `generalized-tag-pinning` 12/0, `dlist-tagged-items` 34/0,
  `dlist-browse` 25/0, `trusted-list-raw-view` 25/0, `dlist-item-tagging` 21/0 green and unmodified.
  The honest reading: *the hermetic tier is clean and independently re-run by the Reviewer; the live
  tier cannot self-certify on this host* — root causes OPEN 315 (cycle length) and OPEN 314 (no
  `nak` in the container).
- **Run-to-run non-determinism observed during this close, worth its own row.** A sibling session's
  gate (`20260923T170037Z-2336600-9ae2`) was running against the same checkout and the same live
  stack. `pin-a-tag-publish` **passed 7/0 in the first run and failed at suite setup**
  (`publish failed: status=200 body={}`) in the second, six minutes later, at the identical commit
  with an identical tree. Two gates on one stack do not produce independent answers.
- **How the book was actually verified** — four independent tiers, because no single one was
  sufficient:
  1. **Hermetic suites** (dependency-injected runners): every wire claim has a handle — `H8` pins the
     `membership-method` tag's presence *and* position; `H1–H3` pin the recipe addresses and the
     absent context `z`; `H5–H7` pin C3 and the retraction; `H8`(#5) pins the collision freeze.
  2. **Live browser drives at every Gate B** (headless Chromium against the panel, stubbed auth, a
     recording `window.nostr`, publish intercepted — nothing ever signed by a real signer or sent to
     a relay). This tier caught **both** defects that source-regex sentinels passed green: story 4's
     React-child crash that replaced the whole Tag route with an error boundary, and story 5's
     unreachable create dialog.
  3. **Live server runs against the real corpus** (2,567 pins, real strfry + Meili, publish stubbed):
     the 1→0 and 4→0 membership swings under the constraint, the 17-member positive case, the
     `certainty` × self-weight case scoring 50, the fail-open byte-identity of an unknown value, and
     the relay scan showing `['cutoff'],['min-rank'],['membership-method','count']` in order on the
     six most recent 30392s.
  4. **Deploy day + operator walkthrough (2026-09-22/23).** Fast-forward of `feat/tags` after
     absorbing two unrelated upstream commits; deploy green; firmware reinstalled on the droplet;
     a full refresh cycle republished **all 2,437 profile lists** with the new tags — **0 collisions,
     0 author mismatches** — over a ~32-minute window; the wire claims were then read off *every*
     live list. The operator's five-step UI walkthrough on tags.b.w (method recorded · per-pin
     override · weighted-sum fallback · "Only me" × certainty · settings gate) returned "all seem
     to pass."
- **The three live TL suites could not run, and that was accepted.** `tl-weighted-sum-method`,
  `tl-certainty-method` and `tl-membership-method-selector` each carry a re-aimed
  `membership-method` assertion that **has never been executed by anyone** — not in either round of
  the story-3 review, not at the deploy. They hang on the dev host (their live leg triggers
  `refresh-all` and *waits*; that cycle is now ~30 min — OPEN 315) and skip on the droplet (no `nak`
  on PATH — OPEN 314). Accepted because the claim they would prove is covered three other ways:
  hermetic `H8` pins the tag and its position; the relay scan read it off real 30392s; and the
  deploy read it off all 2,437 live lists. It is a **known, named gap in the suites' own proof**,
  not in the claim. `tl-membership-method-selector` L3 also reddens in a full run — from server
  saturation during L1/L2's `refresh-all`, not from the auth gate (401 verified on an idle server;
  OPEN 315's closing note).
- **Known open issues / accepted:** OPEN 308 (legacy 9998 headers untaggable), 310 (the TL
  membership-method vocabulary is mirrored by hand), 311 (a context pin omits the personal
  `39998:<localTA>:tag-pinning` z stamp — pre-existing, from the contextual-pins era), 312
  (10040-designated assistants not yet honoured by C3), 313, 314, 315, 316. Closed by this book:
  **OPEN 298** (DONE) and **OPEN 306** (DONE). **OPEN 307 is satisfied by story 3 and should be
  flipped to DONE** — its row still reads OPEN.
- **Debt logged by the ADRs** (rolled up from `Consequences`): fail-open on an unknown value means a
  future-rung pin silently degrades on an un-upgraded runner (0001, 0002 — accepted, and the
  disclosure stays honest so a list never over-claims); `membership-method` and `['variant',…]` and
  `-v-<slug>` are now permanent wire contracts (0002, 0003); two permanent address-ambiguity
  surfaces (a tag slug containing `-in-`/`-v-`) are deliberately unfixed, caught by the §3 detector;
  a kind-30003 exported from a contextual pin *before* this book stays orphaned at the neutral
  address; the places-vs-recipes IA round is owed.
- **Four unbounded module-level warn `Set`s** now exist (`warnUnknownAuthorConstraint` in two
  modules, `warnedPinMembershipMethods`, `warnedAuthorObserverMismatch`), each keyed on a value that
  a third party can influence by publishing a pin. Flagged as non-blocking in three separate reviews
  and never given a home — §6 carries it.

## 6. Carry-forward register

- [ ] **Publish the tag and tag the header** — the one act between "the mechanism is live" and "the
      search backend has something to subscribe to" (§4 #1). Blocked on the naming decision: the
      design doc argues `worth-indexing` may age better than `worth-indexing-for-search`, and that
      whoever authors the tag owns the namespace every participant's taggings land in — so it should
      be authored under a well-known pubkey if the convention is meant to be shared.
- [ ] **Rung 2** — `author ∈ <list>` as a *value* on the field rung 1 introduced, plus the
      filter-list picker UX. A value change, not a mechanism change (ADR 0001 Consequences).
- [ ] **Rung 3** — self-attested curator sets scored by GrapeRank; needs generic presentation *and*
      per-list/per-curator budgets (the design doc's accepted resource-bound risk).
- [ ] **The places-vs-recipes IA round** — `Tag.jsx:556-575`, `Pins.jsx:49`, `PinnedListPanel.jsx:135`;
      the sequence is currently hard-coded in two places (§4 #6, ADR 0003 "New debt").
- [ ] **Part 2 of the design doc** — extrinsic per-list config joined by a `b` tag (waits on a second
      engine).
- [ ] **Part 3 of the design doc** — field types as a DList with url-templates (waits on W17/W18).
- [ ] **Part 1b** — read the tab label and schema off the target header (marked "Now" in the design
      doc's summary table and not built here; it is what unlocks relaxing the guard).
- [ ] OPEN **307** → flip to DONE (delivered by story 3).
- [ ] OPEN **308** — should a legacy kind-9998 header be taggable by `{ id }`, or is a
      non-addressable list simply not an index candidate?
- [ ] OPEN **310** — source `METHOD_IDS` once from the SDK instead of the hand-kept client mirror.
- [ ] OPEN **311** — a context pin's missing personal `tag-pinning` z stamp (pre-existing).
- [ ] OPEN **312** — honour a pin signed by the observer's 10040-designated assistant (C3's natural
      widening).
- [ ] OPEN **313** — Reviewer briefs must point at a precondition, never paraphrase one.
- [ ] OPEN **314 / 315** — make the live TL tier runnable: `nak` in the image (a dependency
      decision — ADR) or fixtures through `publishToStrfry`; point the live legs at
      `refresh-pinned-tag` instead of `refresh-all`; raise/drop the nightly 300 s cap and return a
      job id; memoize the per-cycle tag lookups (~4×2.6k scans → ~2.1k).
- [ ] OPEN **316** — the cross-instance context-stamp hazard: a mirrored contextual pin degrades to
      neutral on the mirroring instance and now **collides with and freezes** that observer's real
      neutral list. Newly visible *because* story 5 made the freeze explicit; before #5 the two
      silently overwrote each other every cycle.
- [ ] **Render-level handles** for the two reachability contracts currently pinned by source regex
      (story 4's S13, story 5's S22) — the class of assertion that went green against a crashing
      page and against an unreachable one.
- [ ] **Cap or truncate the four unbounded warn `Set`s** (§5).

## 7. Process findings (harness)

Sources: the "Harness friction" sections of all five reviews, the Implementers' `## Deviations`
entries that are process- rather than product-shaped, and the book's `meta` rows.
Measurement at retro time (`scripts/harness-stats.sh`, 2026-09-23): 228 reviews parsed,
final PASS 226 / final CHANGES_REQUESTED 2 (kick-back **rate** ~1%), but **45 reviews carry
kick-back history (~20%)** — this book contributed 4 of them (stories 1, 3, 4, 5), i.e. **four of
five stories were kicked back at least once**, all four on defects a live drive or a live gate run
found and no hermetic handle did. Per the Light trial protocol, the comparable line is the
kick-back *history* figure, not the headline rate; findings-per-review here was well above the
corpus median of 3.

| Finding | Source | Terminal state |
|---|---|---|
| **(a) Stale SOURCE sentinels pinning a symbol name or file location a later story legitimately moved — six times in one book,** each resolved by a separate `test:`/review re-aim commit and never by the Implementer: `f12c62bc` (`dlist-item-tagging` S4, story 1), `d01e34e1` + `aff0b0bd` (two S2 conditional-spread sentinels → `curationDialogBuild.js`, story 4), `71121919` (three S1 vocabulary contracts → `ui/src/config/tlMembershipMethods.js`, story 3 review blocker), `253858c1` (`item-trusted-list` S6 → the same build module, story-4 collateral found by the story-3 reviewer), `b78dac5a` (three identity-symbol sentinels → `variantOfPin`, story 5). In every case the rule was right and its *address* was stale. Cousin: OPEN 303 / 300 ("the harness lies to itself" family). The discipline held — no Implementer edited a guard — but the ADR re-aim tables were treated as complete and enumerated only *behavioural* assertions | reviews #1 friction 1, #3 round 1 blocking + friction 1, #4/#5 `## Deviations`; commits above | **Operator-ratified harness commit — proposed, NOT made.** `engineering-team/templates/adr.md:37`, append to the existing sentence: *"When the decision moves or renames a file, symbol, or constant, derive the re-aim list by `grep -rn '<old path\|old symbol>' test/` rather than from memory — an ADR that lists only behavioural assertions will miss the source-location ones (search-index-selection audit §7 (a): six re-aim commits in one book)."* |
| **(b) Gate-A scoped gates under-selected the guard set.** Story 1's named gate did not include `test/dlist-item-tagging.test.js` — yet that was the suite the story broke and then had to re-aim. Same class at story 3, whose gate could not see the three live suites its own ADR was about to invalidate. Related: five consecutive reviews carrying "full `npm test` not run", so the entire full-gate debt landed at book close at once (§4 #10) | reviews #1 friction 1, #2 friction 2, #3 round 1 blocking | **Operator-ratified harness commit — proposed, NOT made.** `engineering-team/workflows/light-profile.md:21`, append to the scoped-gate sentence: *"— and derive the guard set mechanically, not from memory: every suite that reads a file the story will change belongs in it (`grep -rln '<file>' test/`), including suites the judge's tool cap cannot run, which are named as operator-run at Gate B."* |
| **(c) A Gate-A ruling narrowed an AC past its purpose — the OPEN 304 lesson recurring in spirit.** Story 5's AC-1 ("a viewer can create a second pin … coexisting with the neutral pin") and AC-6 were satisfiable on the wire and, for the very user the story names ("beside my ordinary lists"), **unreachable through the UI**: the create dialog opened only for a viewer with *no* neutral pin. Gate A's ruling 3 and ADR §5 were both honoured to the letter; open question 6's explicitly-rejected alternative ("no switcher entry … then AC-1 is not verifiable through the UI") is what shipped for the common case. Only the review's live drive caught it | review #5 round 1 blocking #1; OPEN 304 (DONE — the lesson is the durable part) | **Operator-ratified harness commit — proposed, NOT made.** `engineering-team/templates/user-story.md:14`, append: *"A ruling that narrows a criterion must state, in user terms, what the named user can still see or do afterwards — a narrowed AC that no longer lets that user reach the thing the story built is under-specified, not merely scoped (OPEN 304; recurred as search-index-selection #5 AC-1/AC-6)."* |
| **(d) Source-regex sentinels went green against a crashing page and against an unreachable one.** Story 4 round 2: S13 matched `/context=\{pinDialog\.context\}/` — it pinned the *typo*, and passed while the entire Tag route was replaced by React error #31. Story 5 round 1: S13/S14/S17/S18 all green while the create dialog could not be opened at all in the primary state. Both were found only by a human driving a browser; the replacement handles (S13 rewritten, S22 added) are **still source regexes**, ratified as adequate-because-live-verified, with render-level follow-ups recorded | reviews #4 round 2 blocking #2 + round 3 judgement, #5 round 1 blocking #2 + round 2 non-blocking 6 | **Operator-ratified harness commit — proposed, NOT made.** Insert one rubric line after `engineering-team/workflows/light-profile.md:42` (J2, as item 5, renumbering the carve-out to 6): *"5. An AC whose subject is a rendered surface has at least one handle that is not a source regex — or the plan states explicitly that Gate B's live drive is its only proof. A regex over JSX can pass against a page that crashes on mount or is never reachable (search-index-selection #4 round 2, #5 round 1)."* |
| **(e) A Reviewer brief paraphrased a precondition contrary to the ADR.** The story-5 re-review brief asked for the recipe name field to be verified "on an unpinned tag"; ADR 0003 §5 gates it on the viewer *already holding* a pin. The Reviewer followed the ADR — and that is precisely what surfaced (c)'s blocker. Had the brief been followed, the defect would have been masked | review #5 round 1 friction 1, round 2 "Brief vs ADR" | **OPEN.md row 313** (filed 2026-09-18, type `meta`). Related follow-up filed as OPEN 312 |
| **(f) The review template's "On PASS" heading trips the last-verdict-token rule.** `scripts/lib/review-verdict.awk` takes the last `PASS`/`CHANGES_REQUESTED` token appearing on a heading or bold line; `engineering-team/templates/review-checklist.md:64` is the heading `## On PASS (same commit)`, which sits **below** `## Verdict`. A CHANGES_REQUESTED review that keeps the template's trailing section therefore reads as PASS-final to harness-lint L1/L4 and to `harness-stats.sh`. No review in this book was affected (all five put the verdict last), which is exactly why it is worth fixing now rather than after it bites | template read at retro; `scripts/lib/review-verdict.awk` known-edge note | **Operator-ratified harness commit — proposed, NOT made.** `engineering-team/templates/review-checklist.md:64`, replace the heading with: `## On a passing verdict (same commit)` — removing the bare token; no other line changes |
| **(g) J1/J2 labels were swapped once in a judge spawn.** The judge audited the rubric its body named rather than the label, so the artifact record is correct; the mislabel survives only in a commit subject and a story annotation | story 4 Design-note annotations ("amended at J2"/"at J3"); spawn history | **Declined.** Single occurrence, self-correcting, zero artifact damage: the spawn prompt carries the rubric text itself (`light-profile.md:27`), so the label is decoration. A guard would cost more than the defect. Recorded here so a second occurrence escalates rather than starting from zero |
| **(h) The live TL tier is structurally unrunnable at corpus scale.** Each of the three suites' live legs triggers a full `refresh-all` and waits; that cycle is now ~30 min on a mirrored corpus, so they time out under any cap — and on the droplet they skip for want of `nak`. Consequence: three re-aimed assertions have never executed anywhere, across two review rounds and a deploy. The nightly `refreshPinnedTagTLs` has also been reporting a false failure for two months (63 consecutive runs at its 300 s curl cap) with nobody noticing, because no alert reads TASK_END | reviews #2 friction 1, #3 round 1 non-blocking 3 + "Carried to Gate B"; deploy-day verification | **OPEN.md rows 314 (`meta`) and 315 (`bug`)** — both filed 2026-09-22 with root cause and fix shapes |
| **(i) A Tester agent was cut off mid-task by a spend limit and the phase was recovered from the working tree.** The recovery worked because the partial suite was on disk and the next agent could read it — but nothing in the harness *says* that is the procedure, so the recovery was improvised. A phase agent that dies mid-write leaves a tree that looks like a completed phase | session record, story-5 Phase 3 | **OPEN.md row — proposed, type `meta`** (text in the close report; the parent adds it serially). *Fix shape: one paragraph in `engineering-team/README.md` or `workflows/3-test-design.md` — an interrupted phase resumes by diffing the working tree against the phase's own commit convention and re-running the phase's verification step (for Phase 3: "confirm the tests fail for the right reason"), never by assuming the artifact is complete.* |
| **(j) The book-close gate itself could not run — found at this close.** `npm test` was attempted twice over the final tree and both runs stopped advancing at suite **18/216** (`tl-publication-from-pins`), whose setup waits on the same ~30-minute `refresh-all` as (h)'s TL suites. So the Light profile's designated book-close gate (`light-profile.md:21`) — the gate five consecutive reviews deferred to — is not currently runnable end to end on this corpus. Compounding it: a sibling session's gate was running on the same checkout and the same live stack at the same moment, and `pin-a-tag-publish` passed 7/0 in one run and failed at suite setup in the other, six minutes apart, at an identical commit and tree | this close (§5); run records `…170144Z-2353287-4c50`, `…170711Z-2397240-5f82`, sibling `…170037Z-2336600-9ae2` | **OPEN.md rows — proposed, two of them** (texts in the close report; the parent adds them serially): one `bug` escalating OPEN 315's scope to "blocks the book-close gate, not just three TL suites", and one `meta` for concurrent gate runs on a shared checkout/stack not producing independent answers |

**Does any of this port to the other flow (Direction ↔ human-gated)?** (a), (b), (d) and (f) are
flow-agnostic — they live in the ADR template, the Light gate rubrics, the story template and the
review template, all of which both flows read. (c) and (e) are about *briefs and rulings*, which
Direction mode produces mechanically from the story file, so the fixes land in the same artifacts
and need no Direction-specific twin. (h) and (i) are environmental and apply identically.

**Light-profile trial note** (required by `light-profile.md:64`): the profile's own rules were
**followed, not bent** — Gate A ruled scope + classification + scoped gate for all five stories;
ADRs were written exactly where an irreversibility trigger fired (three did, two did not) and the
Reviewer ratified each classification at Gate B; no Implementer edited a guard suite (story 5
correctly *stopped* and kicked back rather than touch three stale sentinels); the judged interior
kicked back where it should (ADR 0003 took five J1 rounds, each finding one more address composer).
The one rule bent by circumstance rather than by choice is the full gate: correct per line 21, but
five consecutive deferrals concentrated all of it here — see (b).
