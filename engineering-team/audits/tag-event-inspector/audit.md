# Build Audit: Inspect the nostr event behind a tag

**Book:** `engineering-team/audits/tag-event-inspector/book.md`
**Date:** 2026-07-16
**Branch / commit range:** `0bc77ee1..acbf5cca` (pre-book `staging` → the `staging→main` promotion merge)
**Provenance:** Acceptance-frame
**Confidence:** high

> Confidence is high, not by default: the book opened **eagerly at intake** with the operator's request captured verbatim, so the anchor is the ask itself rather than a reconstruction. All four frame bullets were verified by driving the running product on three deployments — not inferred from the diff.

## 1. What shipped

- **The signed nostr event that defines a tag is now readable on that tag's own page** — the full kind-39999 tag element (`id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig`) as formatted JSON, hidden until asked for. — `stories/done/tag-event-inspector/1-tag-actions-menu-and-raw-event.md`
- **The tag detail page's subject has an actions menu**, the affordance every Profile and Note row on it already had — a `⋯` kebab beside the tag name offering *Copy Note ID (event id)*, *Copy Note Addr*, and *Show / Hide Raw Event*. — same story
- **A tag's addressable identity is copyable as a bech32 `naddr`** (`39999:<author>:<slug>`), portable to any nostr client. — same story
- **The tag header API carries the definition event.** `GET /api/profile-tags/by-id` now returns `tag.rawEvent`. — same story

All four are available **signed out** — inspecting a public signed event is a read.

## 2. Epics & stories rolled up

### Epic: `tag-event-inspector`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 tag-actions-menu-and-raw-event | The `⋯` menu (3 items) + the raw-event panel + `tag.rawEvent` on `by-id` | Done | `reviews/done/tag-event-inspector/1-tag-actions-menu-and-raw-event.md` — **PASS**, no blocking findings |

One story, one epic. The epic is retired at this close.

## 3. As-built inventory

**User-facing**
- `/tag/:slug/:tagId` and `/tag/:tagId` — the header gains a `.bs-tag-name-row` flex row containing the existing `<h1>` plus a new `⋯` button (accessible name **"Tag actions"**). A `.bs-tag-raw` panel renders as a **page-level sibling** of the tab strip, below the POV status banner, above the Profiles|Notes switch. Default hidden.
- New component `ui/src/components/TagActionsMenu.jsx` (114 lines). Props `{tag, rawOpen, onToggleRaw}`. Renders nothing until the tag loads. No auth, authorship, POV, or trust check.
- New styles `.bs-tag-name-row`, `.bs-tag-raw*` in `ui/src/styles.css` (+42, purely additive; no existing selector redefined).

**Domain**
- **No concepts touched, no schema change, no firmware reinstall** (ADR §"Architecture invariants"; independently confirmed at review — no `concept`/`firmware`/`setup/`/`.cypher` file in the diff). The `tag` / `nostr-event` / `tag-pinning` concept handles are read-only context.
- Reads kind-39999 **tag elements**. Note the kind trap the ADR records: 39998 is the ConceptHeader (the class "tag"); 39999 is the element (the instance "stoicism"). 39998 appears here only *inside* the string value of a `z` tag.

**Data & contracts**
- `GET /api/profile-tags/by-id?tagEventId=<id>` → the `tag` object gains **`rawEvent`**: a **7-field NIP-01 whitelist in fixed canonical order** (`id, pubkey, created_at, kind, tags, content, sig`), built by `toRawEvent(ev)` in `src/api/profile-tags/index.js`. **Additive** — every existing field and the 400/404 branches are unchanged, so existing consumers are unaffected. Nested under `tag` specifically so `ui/src/hooks/useTagDetail.js` needed **no change** (and it is not in the diff).
- The event is sourced from the handler's **existing** `federatedScan` result (local strfry ∪ DList relay) — already in hand, no new I/O, no extra round-trip.
- **naddr coordinate:** `nip19.naddrEncode({kind: 39999, pubkey: tag.authorPubkey, identifier: tag.slug})` — the same coordinate `ui/src/utils/publishProfileTag.js` already treats as a tag's addressable identity (ADR-0022's `a` ref).

**Verified live on three deployments** (driven, not inferred): `staging` (run `29541263675`, 87s) · `feat/tags` → tags.brainstorm.world (run `29541549422`, 78s) · `main` → tapestry.brainstorm.world (run `29542404234`, 78s).

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 2: panel sits "**below the Pin button and above the Profiles\|Notes switch**" | A page-level region below the **header block** and the POV banner, above the Taggings\|Pinned strip — a sibling of the tab strip, not a child of the default tab's panel | interpretation | Story open question **(b)**; ADR **D3**. The named gap isn't a sibling gap: the POV banner and tab strip already sit between those two, and the Profiles\|Notes switch lives *inside* the panel carrying `hidden={activeTab !== 'default'}` | **Ordering is honored** in both signed-in and signed-out branches. The panel is *not strictly adjacent* to Pin — the one place the build departs from a literal reading. In exchange it survives a tab switch: placed literally, it would vanish on the Pinned tab while the menu still read "Hide Raw Event". Anchoring below the header (not below Pin) also degrades correctly signed out, where there is no Pin row | — |
| 2 | Ask: "Copy Note Addr **(if it is a replaceable event)**" | Always offered; the guard is on *data presence* (64-hex author + truthy slug), not on kind | constraint-discovered | ADR **D5**. Kind 39999 ∈ 30000–39999 ⇒ **unconditionally addressable**; the conditional can never be false on this surface | None. The item is always live, as the ask intended | — |
| 3 | Frame bullet 3: the new menu "**emulates**" the row `⋯` menu | A new sibling component reusing the emulated menu's CSS (`bsp-note-menu*`) and `copyText`, **not** a shared extracted shell | intentional-change | ADR **D2**. Extracting now would refactor a *shipped* surface (`NoteActionsMenu` renders on 8 surfaces with **zero** runtime test coverage) inside a story whose AC-7 is "the existing menu is unchanged" | None user-visible; the two menus are visually and behaviourally identical. ~20 lines of shell duplicated | `_intake.md` 2026-07-16 — extract `<ActionsMenu>` **when a third menu appears**; the AC-7 sentinel is then the thing to *update*, not delete |
| 4 | AC-1 requires "an accessible name"; ADR requires an `aria-label` without specifying text; the emulated component says "Note actions" | `aria-label="Tag actions"` | interpretation | Story `## Deviations`; endorsed at review | Screen-reader users hear the actual object. Emulating the *string* would announce a kind-39999 tag element as a note — the one place verbatim copying would be a lie rather than parity. Deliberately the **opposite** call from the item labels (§4 #7), which name a copyable identifier, not the object | — |
| 5 | ADR **D6** specifies the overflow rules; the test plan assigned D6 to verify-by-driving only | Three CSS regression sentinels added to `test/tag-actions-menu-ui.test.js` at review | added-beyond-scope | Review finding 3. Deleting `break-all` would silently reintroduce the 1280px overflow the closed `event-page` book enforced, and only a human at a browser would notice | None user-visible. Converts a once-observed property into permanent cover. Mutation-tested 4/4 incl. the vacuous-pass case | — |
| 6 | Book "Done looks like": ships to **`staging`**; "**prod and the tags branch are the operator's call, not this session's**" | Also promoted to `feat/tags` (PR #371) and to `main`/production (PR #373) | added-beyond-scope | The operator made both calls explicitly in-session ("Let's advance this feature from staging to main"). The reserved decision was exercised, not bypassed | Live on all three deployments | — |
| 7 | Story open question **(a)**: "Note" wording for an object that is not a kind-1 note | Kept the operator's exact labels | interpretation | **Settled by the operator at close, 2026-07-16:** *"The word 'note' means a nostr note, synonymous with nostr event."* | None — the labels are correct, not a concession. **This question is closed, not carried.** Recorded because the Product Owner, Architect *and* Reviewer each independently recommended renaming; all three were wrong for the same plausible reason | **Closed** (was: rename both surfaces together) |

**Undocumented work** — none. Every file in the book diff traces to the story or the ADR: `src/api/profile-tags/index.js` (D1), `ui/src/components/TagActionsMenu.jsx` (D2), `ui/src/pages/Tag.jsx` (D3/D4), `ui/src/styles.css` (D6), the two test files + `test/test.js` registration (test plan), and the `engineering-team/` artifacts. `OPEN.md` rows #43–#45 are ledger entries this book opened, each sourced below.

## 5. Quality state at close

- **Test gate (run at close, workflow step 8).** Full local `npm test` → **`Overall: FAIL`**, 25 skipped — for the documented **environmental** reasons (11 tag/pin/TL publish suites against a near-empty local Neo4j; OPEN.md #27). **This is not a green suite and this audit does not claim one.** The binding gate is the **differential**, measured end-to-end on both trees rather than inferred: baseline `origin/staging` (`0bc77ee1`) and the book branch both fail **the identical 11 suites with identical counts — zero new failures**. The close-time run reproduces that same 11-suite set **byte-for-byte**, which also confirms no drift from the two changes made after review (the D6 sentinels and the `git mv` of the epic folders under `done/`). The book's own suites are green at close: `tag-actions-menu-ui` **30/0** (28→30 with the D6 sentinels), `tag-detail` **8/0 → 18/0**.
- **CI.** `stack-free` **PASS** on every PR. The new suite is stack-free by construction and **verifiably gates**: it ran in CI (`tag-actions-menu-ui: 30 passed, 0 failed`, `Overall: PASS`) and its term is in the live `overallOk` chain (109 terms).
- **Adversarial verification.** The review tried to break the build on six axes and mutation-tested three of them: a TA literal injected → suite fails; `...ev` spread inserted → suite fails; the panel relocated inside the `hidden` tabpanel → suite fails. The naddr was decoded from the real clipboard on two instances and against two different tags; `pubkey === TA` is **false** in every case.
- **Known open issues (not this book's product code).** OPEN.md **#43** (`test/test.js` gate severed — 9 registered suites cannot fail the build, incl. CI's own guards; **pre-existing**, base and HEAD both show exactly 9), **#44** (CLAUDE.md:177 misidentifies this machine's TA), **#45** (the unified tag index under-reports vs the legacy index — surfaced by this book's smoke test, bears on the **open `unified-tagging-ui` book**). The operator has scheduled all three for a separate session.
- **Debt logged by ADRs.** **The ADR has no `## Consequences` section** (see §7) — its debt was harvested instead from the ADR's `Out of scope`, the story's `Out of scope` / `Open questions`, and `_intake.md`. Net new debt from this book: **~20 lines of duplicated menu shell**, deliberately incurred with a named trigger (§4 #3).

## 6. Carry-forward register

- [ ] **A copied Tag Addr does not round-trip through this instance's own `/event` page.** The `naddr` is valid and resolves in other nostr clients, but `/event` is **kind-1 only** (`src/api/event/eventReadPath.js:4-5`) and answers a kind-39999 naddr with "kind ‹N› not yet supported" — with **no fetch**. So the product hands you an identifier its own viewer refuses. (from story `Out of scope`; the `event-page` book is closed)
- [ ] **Extract a shared `<ActionsMenu>` shell when a third `⋯` menu appears.** Two call sites under-determine the abstraction; three reveal the seam. (from §4 #3 / `_intake.md` 2026-07-16)
- [ ] **Raw-event inspection on other surfaces** — Note rows, Profile rows, the tag index, the Pinned tab. This book was the tag *definition* event on the tag *detail* page, full stop. (from story `Out of scope`)
- [ ] **Escape-to-close across every `⋯` menu.** No existing menu handles Escape; adding it here alone would create divergence. Needs to be one story against all menus. (from story `Out of scope`; also the never-actioned NICE-TO-HAVE #2 of `reviews/live-feed/3-feed-note-actions-menu.md`)
- [ ] **A fourth "Copy Note Link" item**, for parity with the row menu. Not asked for; cheap to add. (from story open question (c) — recommended against for now)
- [ ] **OPEN.md #45 — the unified tag index under-reports** (staging 1 vs 39; tags.bw 10 vs 33). Not this book's code, but it **bears directly on the open `unified-tagging-ui` book**, whose frame is "the tag surfaces stop meaning profiles only" — a directory showing 10 of 33 tags would not meet it. Worth triaging before that book closes.

*Closed, not carried:* the "Note" vs "Event" vocabulary question (§4 #7) — settled by the operator.

## 7. Process findings (harness)

Sources harvested: the review's "Harness friction" section (**"None new this story"**), the review's three non-blocking findings, the story's `## Deviations`, this book's OPEN.md `meta` rows, and this close's own template-harvest step. `scripts/harness-stats.sh` at retro time: **116 reviews parsed, 114 final PASS, kick-back rate 1%, re-review churn 2**; books — 14 closed, **3 open** (`tag-event-inspector` 0d, `unified-tagging-ui` 16d, `task-timeline` 36d); this epic: 3 phase commits.

| Finding | Source (journal / review / deviation / meta row) | Terminal state |
|---|---|---|
| **`test/test.js`'s `overallOk` chain is severed by a stray semicolon — 9 registered suites have never been able to fail the build**, including CI's own `stackFreeNpmTest` / `ciTestJob` guards. Measured: 109 live terms vs 118 declared `*Result` vars. Found because this story's own four-touch registration landed *in the dead block* and had to be moved into the live chain to gate at all — the ritual looked complete while gating nothing. **Pre-existing** (base and HEAD both show exactly 9); this branch took the chain 108→109 and widened nothing. | Tester (test-design); count corrected + line-ref removed at review | **OPEN.md row #43.** Left unfixed deliberately: one character, but a **gate-semantics change for seven other stories' suites** — does not belong in an unrelated implementation commit, unratified. Operator has scheduled it. |
| **CLAUDE.md:177 misidentifies this machine's local-dev TA** (`82b75e47…`) — the stack answers `e00ed090…`; `82b75e47…` is in fact the ADR-0015 `LEGACY_Z_TAG_PUBKEY`, a **different role**. The section's own thesis is that these must not be confused, so the stale parenthetical undercuts the rule it states. | ADR §Context (:37) noticed the divergence and made it *evidence* for D5; filed this session | **OPEN.md row #44.** Operator has scheduled it. |
| **D6's overflow rules had no regression sentinel.** The test plan consciously assigned D6 to verify-by-driving, which proves the property *once*; deleting `word-break:break-all` would silently reintroduce 1280px overflow and only a human at a browser would catch it. | Review non-blocking finding 3 | **Commit `d05a35be`** — three region-scoped sentinels added (suite 28→30), mutation-tested 4/4 including the vacuous-pass case. Scoping proved *necessary, not ceremonial*: 9 other `break-all` occurrences remain in `styles.css`, so a file-global assert would have passed vacuously — OPEN.md #40's lesson, reproduced and applied. |
| **ADR 0001 omits the template's `## Consequences` section.** `templates/adr.md:26` requires it (enables / constrains / **new debt** / firmware reinstall); **7 of the 8 most recent epic ADRs carry it, this book's is the only miss**. The substance is not lost — firmware-reinstall is answered twice and follow-ups live in the ADR's `Out of scope` — but it is *scattered*, and `templates/build-audit.md:42` names "ADR `Consequences → new debt`" as the harvest source for §5. A close following the template literally finds nothing there and would under-report debt. `harness-lint` has **no ADR-section rule**, so nothing caught it. | This close, step 5 harvest | **OPEN.md row #46** (opened at this close, step 10) — proposes a `harness-lint` rule asserting template-required ADR sections. Folds into the meta-sweep harness story alongside #40/#43. |
| **The Reviewer drafted the differential table with *predicted* numbers before the baseline run finished** — the exact failure mode it was auditing for. It self-caught, held the verdict at *provisional*, and the committed artifact contains measured numbers; the lead session then re-measured the differential independently and confirmed identical. | Reviewer's own admission, mid-review | **Declined** — no amendment. `roles/reviewer.md` already carries the binding rule ("run the gates yourself; treat the report as a hypothesis"), which is *what caught it*; the failure was a drafting-order slip against an existing rule, not a gap in one. Recorded here rather than dropped, because the near-miss is the evidence that the rule earns its keep. |
| **Meta escalation is live and grew on this book's watch: 10 open `meta` rows** (#16, #21, #22, #28, #29, #38, #40, #41, #43, #44), oldest 14d — well past the "≥3 open" trigger that says *propose a harness story at triage*. This book added two (#43, #44) and this close adds a third (#46). | SessionStart digest; this book's rows | **OPEN.md rows #43/#44/#46 + operator-scheduled.** The operator explicitly took #43/#44/#45 to a separate session; naming the grouped harness story belongs there. Recorded so the escalation is a **deliberate deferral rather than drift** — #43 (CI's own guards cannot fail the build) is the strongest single reason to actually name that story. |
