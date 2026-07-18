# Build Audit: Inspect the nostr events behind a profile's tagging

**Book:** `engineering-team/audits/profile-tagging-inspector/book.md`
**Date:** 2026-07-17
**Branch / commit range:** `1a36935e..2831b1e0` (code); harness artifacts across `a03daaa2..3cb83699`. Shipped to `staging` (PR #375, merge `46f4bb41`), `feat/tags` / tags.brainstorm.world (back-merge `b6a7875f`), and `main` / tapestry.brainstorm.world (PR #377, merge `eae19280`).
**Provenance:** Acceptance-frame (no PRD)
**Confidence:** **high** on the frame; **one sub-behavior (`counted:false`) proven analytically, not empirically** — see §4 #1 and §5.

> The Build Audit is the as-built record — what the product *is* now, factual and source-linked. It does not propose changes; that is the seed's job.

## 1. What shipped

One capability, on one surface: **the signed assertions behind a profile row's `+N −M` on the tag detail page are now directly inspectable.**

- A **Show Raw Event / Hide Raw Event** item on each profile row's `⋯` menu toggles a per-row panel that renders **every** WoT-trusted assertion behind that row's score (plus the viewer's own), each as the complete signed nostr event — `stories/tag-event-inspector/2-tagging-raw-event-inspector.md`.
- The row `⋯` menu, previously reachable only below 769px, is now reachable at **every** viewport width on the tag page (raw-event-only above 769px) — same story.

This answers the carry-forward question the *previous* book (`tag-event-inspector`) left open in its `prd-seed.md` §7 — *"Is 'inspect the event behind this thing' a page feature or a product pattern?"* — with **pattern**. This is inspection instance two (tag definition → taggings).

## 2. Epics & stories rolled up

### Epic: `tag-event-inspector` (Active — spans two books; NOT retired at this close)

| Story | Delivered | Status | Review |
|---|---|---|---|
| #2 tagging-raw-event-inspector | Per-row raw-event panel over a profile row's assertions; `⋯` reachable at every width | Done | `reviews/tag-event-inspector/2-tagging-raw-event-inspector.md` — PASS |

*(Story #1, the tag-**definition** inspector, belongs to the closed `tag-event-inspector` book. The epic deliberately outlives book 1; see §6 and OPEN.md #47.)*

## 3. As-built inventory

Derived from the diff, not the docs.

**User-facing:**
- `ui/src/components/TagRowRawEvents.jsx` (new, 60 lines) — presentational, stateless. One `<div class="bs-tag-row-raw-block">` per assertion: a caption (`Applied by` / `Disputed by` + the **author pubkey**, never a display name in its place; an `not counted under this POV` pill when `counted === false`) over `<pre class="bs-tag-raw-pre">{JSON.stringify(event, null, 2)}</pre>` (reuses Story 1's panel `<pre>` class).
- `ui/src/components/TagPageRow.jsx` (+79/−0 net additive) — new prop `showRawEvent = false` (`:94`); per-row `rawOpen` / `rawNotice` state (`:105`); `is-raw-enabled` class on the `<li>` (`:180`) that scopes the wide-viewport kebab; the `.bs-tag-row-raw-btn` in a flex wrapper *outside* `renderActionsMarkup` (`:374`, label flips `:396`); the panel as the `<li>`'s last child (`:429`). The `⋯` render condition gained `|| showRawEvent` (`:302`).
- `ui/src/pages/Tag.jsx` (+5) — passes `showRawEvent` to the tag-page `<TagPageRow>` only. **`TagSomeoneModal.jsx` unchanged (0 diff lines)** — the "Tag someone" modal deliberately does not opt in.
- `ui/src/styles.css` (+110) — scoped `@media (min-width:769px)` override so only `.bs-tag-row.is-raw-enabled` gets a wide kebab (`visibility`, not `display`, to preserve the reserved-width no-jiggle invariant); base `.bs-tag-row-overflow { display:none }` **retained** (this is what spares the modal); menu scores/actions/help `display:none` above 769px (AC-2 "only the raw item", out of the a11y tree); `.bs-tag-row-raw{flex-basis:100%}` (wraps below the row); `.bs-tag-row-raw-btn{margin-left:auto}` (floats right).

**Data & contracts:**
- `GET /api/profile-tags/profiles-tagged` — each row object gains `assertions: [{ polarity: 'apply'|'dispute', counted: boolean, event: {…7 canonical NIP-01 fields} }]`. Always present (`|| []`), same convention as `onlyViewerVisible`. Built in `handleProfilesTagged` from the **same `deduped` scan the counts already use** (`index.js:970-985`), sorted total-order (polarity → `created_at` desc → `id`, `:1013`). `event` is Story 1's existing `toRawEvent` 7-field whitelist, **reused, not re-declared**.
- `aggregateProfilesTagged` now returns a 4th field, `authorAllowed` (`index.js:694`) — the POV trust predicate, handed to the caller so the handler needn't re-fetch Meili. Its other caller (`refreshPinnedTags.js:156`) ignores it.

**Domain:** No concept definitions changed. Concepts *read and displayed*: `39998:<TA>:nostr-user-tag` (the assertions), `39998:<TA>:nostr-event` (the 7-field shape). **No firmware reinstall.** No new event kinds, no new routes, no new dependencies, no stored-shape changes.

## 4. Deviations from intent

| # | Specified (frame) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: *"a reader can count the blocks and get back the row's numbers … each block identifiable by polarity and author"* | Met, **and sharpened**: a `counted` boolean marks blocks present via the viewer-union but below the POV threshold, so "count the **counted** blocks" holds even on a mixed row. **But the `counted:false` path is proven only by code-read, never by any runtime.** | interpretation + constraint-discovered | Story `## Deviations`; review "Assessment of the disclosed verification gap"; ADR 0002 D1. The `false` branch (`index.js:981`) needs a signed-in viewer whose own assertion is below `minRank` on a row that *also* has trusted assertions — unreachable on local (no POV threshold ⇒ `authorAllowed` is `() => true`), and unreachable on staging/tags/prod (their POVs filter such authors out of the readable set; the seeded runtime test skips because `/var/lib/brainstorm` is a Docker named volume + the container lacks `nak` + host `nak` is arm64). | None for the common path (verified at scale, §5). The uncounted **marker** is the only unexercised surface. | **§6 top item.** Verify on any instance once a below-threshold viewer with a mixed row exists, or via a seeded test where settings are writable + `nak` runs. The Reviewer found the predicate provably identical to the counts loop, so risk is low — but it is not empirically confirmed. |
| 2 | The ask's literal words: *"the event that applies the Tag to a specific Profile"* (singular) | A panel of **N+M** events (many authors) | interpretation (corrected at intake) | book.md "The ask's one wrong premise, corrected"; a tagging is publishable by anyone (`nostr-user-tag`), so a row is N+M events. Operator shown the evidence (10/49 staging tags multi-event; `verified-human` `+0 −3`) and chose "all events". | The feature is *more* than asked, correctly. | — |
| 3 | (unspecified) menu close-on-select | The row menu **closes** on select at both widths | interpretation | Story Product-decision #1; epic "emulate, don't diverge" guardrail **amended** at the #2 reopen. Under 769px the menu is a fixed bottom sheet with a full-viewport backdrop — staying open would cover the panel. Diverges from the header menu's stays-open convention; follows *this* component's own (Apply/Dispute already close). | Consistent with the row's existing behavior; "Hide" needs reopening the menu. | — |
| 4 | (unspecified) tooltip mechanism | `TagRowRawEvents.jsx:49` uses a native `title=` | interpretation | Review non-blocking #1. ADR 0016 ratified `data-bs-tooltip=`; all 5 sibling tooltips in `TagPageRow` use it. | Cosmetic (tooltip onset only; the pill's visible text carries the meaning regardless). | §6 — migrate to `data-bs-tooltip=` + `aria-label`. |

**Undocumented work:** none. Every changed line traces to the story/ADR. The two OPEN.md rows opened during the book (#47 Planning, #48 staging smoke) and Story 1's book-close ride the same staging branch but are doc/ledger, not this feature's code.

## 5. Quality state at close

- **Test gate:** the CI-binding stack-free suite `test/tagging-raw-event-inspector-ui.test.js` — **25 passed, 0 failed** (re-run at close). Full `npm test` is `Overall:FAIL` for environmental reasons (`OPEN.md` #27, near-empty local Neo4j) — not this change; the differential vs the pre-impl baseline showed no new failures, and CI `stack-free` was green on PRs #375 and #377.
- **Live verification, three deployments, each on its own data:** invariant (counted blocks reconcile to `+N −M`) held with **zero violations** — staging 344 blocks, tags.brainstorm.world 336, prod 348. Multi-block panels confirmed by driving on all three (Avi Burra `+4 −0` → 4 blocks; NY Times NewsBot `+0 −3` → 3 dispute blocks, zero applies; AJ `+3 −0` → 3 distinct authors). No 1280px overflow; two panels open at once; header menu (Story 1) unchanged; modal untouched.
- **Cross-deployment TA safety:** the feature works untouched across **four distinct TA pubkeys** (local `e00ed090…`, staging, tags `a68dbf56…`, prod `919ba08a…`) — the no-hardcode design (test sentinel `R1`) confirmed empirically, not just asserted.
- **Known open, non-blocking:** the `counted:false` runtime gap (§4 #1); the four review non-blocking findings (`data-bs-tooltip`, unscoped `.bs-tag-row-overflow-help`, `rawNotice` non-transience, ADR D2 wording).
- **Debt logged by the ADR (`Consequences`), rolled up:** unbounded eager payload (revisit at ~1,000 assertions/tag — and see §6, the real wire cost is worse than D1 modeled); the shared-`<RawEventPanel>` extraction deferred to the third surface; `matchMedia` at `TagPageRow.jsx` remains resize-blind (pre-existing, untouched).

## 6. Carry-forward register

- [ ] **Empirically verify `counted:false`** (from §4 #1) — the top item. Either wait for a real below-threshold viewer with a mixed row on a live instance, or build a seeded test where `settings.json` is writable and `nak` runs (the Docker-named-volume + arm64-`nak` environment blocked it this book).
- [ ] **Enable gzip for `application/json`** (`OPEN.md` #48) — the profile-tags API ships uncompressed on-deployment, so ADR 0002 D1's gzipped payload estimate is inapplicable; the real wire cost is ~4.7× the argued figure and the ~1,000-assertion revisit trigger is **~870 KB on the wire**. D1's decision stands (scan cost was decisive), but the payload math needs re-deriving and gzip is a cheap broad win.
- [ ] **Fix harness-lint L2** to model an epic spanning two books (`OPEN.md` #47) — waived meanwhile; retire the waiver with the fix.
- [ ] **Migrate `TagRowRawEvents.jsx:49`** from `title=` to `data-bs-tooltip=` + `aria-label` (§4 #4 / review non-blocking #1).
- [ ] **Extract a shared `<RawEventPanel>`** at the *third* inspection surface (ADR 0002 Consequences #3; recorded in `_intake.md`). The two existing instances have already diverged structurally (1 event vs N; POV-invariant vs POV-scoped; page-level vs per-row), so the third is where the genuinely-common seam becomes visible.
- [ ] **The generalization question, now answered "pattern," has obvious next surfaces** — Note rows, the tag index, the Pinned tab, profile pages — all deliberately out of scope this book. The prd-seed's "expensive after three divergent one-offs" warning is live: the third one-off is where the abstraction must land.

## 7. Process findings (harness)

`scripts/harness-stats.sh` at retro: `tag-event-inspector` book **closed 0d open→close**; this book (`profile-tagging-inspector`) opened 2026-07-16 and closed 2026-07-17. Phase-commit coverage for the epic: 8 (matches book 1) + this book's full story→review chain.

| Finding | Source | Terminal state |
|---|---|---|
| harness-lint L2 cannot model an epic that legitimately spans two books (Closed book + Open book) | Planning (this book) | **OPEN.md #47** (waived with citation; rule-fix candidate recorded) |
| An empty `overallOk` gate-chain term is severed by a stray `;`; a merging/registering author can silently land a suite in the dead block | Test Design + the `feat/tags` back-merge (both navigated it correctly here) | **OPEN.md #43** (pre-existing; folds into the meta-sweep harness story) |
| The ADR's "testable by the node HTTP-contract suite" argument is weaker than it reads — those suites skip wholesale in CI, so the stack-free source suite is the only automatic gate | Test Design (test plan "What actually gates") | **Declined** as a standalone change — it is correct-as-designed (OPEN.md #13 ratified Playwright's CI deferral); recorded in the test plan so future stories don't over-credit live-HTTP coverage. No harness change warranted. |
| An Implementer `## Deviations` entry was **fabricated** (claimed a pre-existing bug fix that never happened) and self-retracted the same phase | Implementation → the docs commit `29b48bc8` | **Declined** as a harness change — the existing role check (Reviewer re-derives claims rather than trusting them) caught it and is the correct control; the retraction is the process working. Noted here as evidence the "don't trust the Implementer's word" reviewer rule earns its keep. |
| `counted:false` unverifiable in-environment (Docker named volume hides `settings.json`; container lacks `nak`; host `nak` is arm64) — a class of runtime tests that cannot run locally at all | Implementation + Review | **OPEN.md #27 family** (known environmental gate limitation); the specific gap is carried in §6 and the story `## Deviations`. No new row — it is an instance of the documented local-stack limitation. |

Retro portability check (Direction ↔ human-gated): all findings are flow-neutral — none depends on who answered the phase gates. The fabricated-deviation catch is worth porting into any Direction-mode retro as a concrete case where blinded verification matters.

**Gate at close:** `test/tagging-raw-event-inspector-ui.test.js` 25/25; CI `stack-free` green on the promotion PRs. Recorded in §5.
