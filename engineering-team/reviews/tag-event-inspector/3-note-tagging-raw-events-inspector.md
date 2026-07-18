# Review: Story 3 — Raw tagging-events inspector for a note's tag chips

**Reviewer:** Claude (acting as Reviewer, fresh context)
**Date:** 2026-07-18
**Diff:** `git diff 89c3964f...f1702f81` (branch `feat/note-tagging-inspector`; implementation diff `b221139e..f1702f81` is the primary audit surface; test contract at `b221139e`)
**Story:** `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md`
**ADR:** `engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md`
**Test plan:** `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test` — run by me, full suite, this session.** `Overall: FAIL` for the documented environmental reason only. **Differential clean:** the failing set is exactly the recorded 11-suite environmental baseline (OPEN.md #27 family), with per-suite **failed counts identical** to the baseline recorded in `reviews/nip-reorg/4-index-crossref-sweep.md` gate 1: `profile-tags` 3f, `profile-tags-publish` 1f, `tag-detail-publish` 2f, `tag-index-publish` 1f, `profile-tag-polish` 4f, `pin-a-tag-publish` 6f, `tl-publication-from-pins` 1f, `tl-publication-from-pins-publish` 5f, `customize-pin-curation-publish` 3f, `most-pinned-tag-index-publish` 7f, `tag-detail-curated-view-and-pin-polish-publish` 1f. Total skipped 25 (matches baseline). **No new failing suite.**
- [x] **Story suites in MY run — all green:**
  - `note-tagging-raw-events-inspector-ui`: **32 passed, 0 failed** (the CI gate)
  - `note-tagging-raw-events-inspector-http`: **9 passed, 0 failed, 0 skipped** — ran live against the local stack; the unfiltered house POV means L5–L7's counted-channel asserts executed rather than skipping
  - `tagging-raw-event-inspector-ui` (re-aimed Story-2 sibling): **25 passed, 0 failed**
  - `tag-actions-menu-ui`: **30 passed, 0 failed**
- [x] **Live process serves the current source** — verified first-hand, not taken from the Gate-4 journal: `GET /api/event-tags/for-event?eventId=<untagged 64-hex>` on `:7778` returns `"rawEvents": {}` (the D2 "always assign" convention live).
- [x] `vite build` from HEAD succeeds (smoke check on the new JSX; bundle served for the drive below).
- [x] `npm run test:playwright` — no Playwright suites exist for this story (ratified deferral, OPEN.md #13). I drove the UI ad-hoc with Playwright instead — see "Verify-by-driving" below.
- [x] _Lint / typecheck / build not configured — skipped per project settings._ (`harness-lint` suite PASS 29/0 inside my npm test run.)

## Spec adherence — AC by AC

- [x] **AC-1 (the button, in the popover).** `ui/src/components/TagChip.jsx:197-208` — button after `.ptc-popover-actions`, label `rawOpen ? 'Hide Raw Tagging Events' : 'Show Raw Tagging Events'`, `aria-expanded={!!rawOpen}`, **no `disabled`, no `viewerPubkey` condition** (U6–U8). Driven: signed-out browser (no NIP-07) → raw button enabled while Apply/Dispute (`TagChip.jsx:182,190`) stay disabled; after open + re-hover the label reads "Hide Raw Tagging Events" with `aria-expanded=true` — the label is prop-driven truth, not popover-local state.
- [x] **AC-2 (placement, per-chip toggle, stacking).** Panels render between `<PovStatusNotice/>` and `.bsp-note-tags-row` (`NoteTags.jsx:161-184`; U11); state is a per-instance `Set` keyed by tag coordinate (`NoteTags.jsx:38`; U10); panels map `displayedTags.filter(t => openRaw.has(...))` so stacking order is the chips' display order by construction (`NoteTags.jsx:169`; U12); caption carries `{t.name}` (`NoteTags.jsx:178`; U13). No new `setOpen(false)` — TagChip keeps exactly 4 close sites (R6). Driven: fresh load has zero panels; Show opens only that chip's panel; two panels stack alpha-before-beta; Hide closes only alpha's; a panel on note A never appears on note B and vice versa. The popover closing after a successful Show was observed and is the **documented layout-shift + cursor-leave composition** (ADR 0003 D4), not close-on-select — the click handler adds no close call.
- [x] **AC-3 (every event behind the counts, faithfully).** Server: `handleForEvent` builds `rawEvents` from `tags[].applications ∪ disputes ∪ mine`, projecting `candidates` through the shared `toRawEvent` (`src/api/event-tags/index.js:191-197`); every referenced id is in `candidates` by construction (`classify.js:76,113,121` — entries carry `eventId: c.id`). Client: `rawBlocksFor` composes from the same arrays the popover's numbers are the lengths of; `counted` = channel membership; viewer joins via `mineEventId` (the rename trap, handled — `useEventTags.js:95`, `NoteTags.jsx:59`), deduped by event id; Story-2 total order apply-first → `created_at` desc → id (`NoteTags.jsx:64-67`; U15/U16). Live: L2 exactness both directions, L3 7-field key set + order, L4 byte-round-trip, L5 dedupe, L6/L7 dispute paths — all pass in my run. Driven: 2-block panel counts back to "Applied by 1 / Disputed by 1" with full author pubkeys (alice/bob) and byte-verified `<pre>` JSON (id + sig + exact 7-key order checked in-DOM); 11-block hot panel counts back to "Applied by 10" + 1 dispute, applications first.
- [x] **AC-4 (honest degradation).** Loading is structural under eager D1 (no chip exists before the read lands — no reachable panel-shaped loading state); unavailability is all-or-nothing per chip (`NoteTags.jsx:63` `some((b) => !b.event)` withhold; U17) with the visible `'Raw tagging events unavailable'` notice via the `.ptc-hint` idiom (`NoteTags.jsx:77`, `TagChip.jsx:209`; U9); per-chip/per-note isolation by per-coordinate state — driven both directions. The unavailable branch is **runtime-unreachable by construction** (map and channels come from one response), so it is source-pinned rather than driven — exactly as the test plan pre-declared.
- [x] **AC-5 (uniform across note surfaces).** Structural: `NoteCard` renders `NoteTags` once; every note surface inherits (R8, incl. recursive TagChip importer census = exactly {NoteTags, ProfileTagsSection}). Behavioral, driven on **two surfaces** per the story's bar: the tag page's **Notes tab** and the **profile page's tagged-notes** (AuthoredTaggingSection → NoteCard) — identical button, slot, and blocks on both. The feed and `/event` page could not be driven with local-only fixtures — their read paths resolve notes from the external relay set (`/api/event` returned `NOT_FOUND` for the locally published fixture note; verified live), which no local seeding can satisfy; they are covered by the structural guarantee. The story's own verification bar ("at least the tag page's Notes tab plus one other surface") is met.
- [x] **AC-6 (non-regression and invariants).** Apply/Dispute keep their gate (R7, exactly 2 gated buttons; driven disabled signed-out); popover close conventions untouched (R6); score trio and add-tag flow untouched in the diff; Story-1 surface untouched; Story-2 surface touched only by the D5 two-line re-aim (`TagPageRow.jsx:4,431`); **profile chips gain nothing** — `ProfileTagsSection` passes none of the three props (R5, the epic's highest-value sentinel, green); **no TA literal introduced** (R1; R2 pins event-tags to exactly ONE 64-hex — `CANONICAL_AUTHORITY`, verbatim, untouched); POV — see invariants below.

No criterion silently dropped; no behavior beyond the story (see scope sweep).

## ADR adherence (D1–D6)

- [x] **D1 eager:** `for-event` always carries `rawEvents` (possibly `{}`); no lazy refetch, no scan-route dependency. Verified live: untagged id → `{}` (0 B increment where the feed-multiplier fear lived).
- [x] **D2 side-table:** top-level `{[eventId]: 7-field projection}` built in the handler from `candidates`; core `classify.js` untouched; `toRawEvent` **exported** from profile-tags (`index.js:1836`) and **required** by event-tags (`index.js:32`) — one definition of "as signed"; no cycle (precedent `:541`). `handleForTag`/`aggregateNotesTagged`/`handleTagIndex`/`handleNotesByAuthor` untouched (R3; R-http-1 live).
- [x] **D3 client composition:** in `NoteTags`, `counted` = channel membership (never re-derived from bytes), `mineEventId` join, dedupe, Story-2 total order — all as specified.
- [x] **D4 gated props:** `rawOpen`/`onToggleRaw`/`rawNotice` optional on `TagChip`, button renders only when `onToggleRaw` passed (the absent-prop gate); `NoteTags` owns `openRaw`; no `disabled`, no close call; layout-shift consequence observed in the drive and matches the ADR's documented composition.
- [x] **D5 extraction:** `TagRowRawEvents.jsx` → `RawTaggingEvents.jsx` is a git rename (57% similarity = docblock + function name only; **rendered markup and class names byte-identical** — verified in the diff hunks, which never touch the JSX return). Old file gone; zero stale references in source (grep — remaining mentions are prose/test names only); `TagPageRow` re-aimed; Story-2 suite re-aimed with **assert conditions byte-identical** (diff shows path strings + message prose only); `_intake.md` `<RawEventPanel>` entry flipped DONE with ADR-0003 pointer and the Story-1 exclusion explained (U23); the `<ActionsMenu>` entry untouched.
- [x] **D6 degradation + CSS:** new classes only — `.ptc-btn-raw`, `.bsp-note-tags-raw`, `.bsp-note-tags-raw-caption` (`styles.css:4076-4083,7919-7933`); the diff is purely additive in CSS; `.bs-tag-raw-pre`, `.bs-tag-row-raw-*`, and all `.ptc-*` rules unmodified (R9).
- [x] **No new dependencies** — `package.json` absent from the whole diff range; no new tooling.

## Concept-graph integrity

- [x] Handles referenced (story/ADR) are `39998:<TA>:nostr-event-tag` / `nostr-event` / `tag` — `kind:pubkey:slug` form, pubkey runtime-resolved.
- [x] **No concept definitions changed ⇒ no firmware reinstall required** (ADR states it; the diff confirms — nothing under firmware/graph paths).
- [x] Orientation was done via the concept graph at ADR time; the new code re-derives nothing from BIBLE.md.

## Things tests can't catch

- [x] **No secrets** — fixture keys in both live suites are generated per run via `nak key generate`; nothing committed.
- [x] **No debug leftovers** — swept the implementation diff for `console.*`/`debugger`/TODO/FIXME: clean. No commented-out code.
- [x] **Security:** the response now ships signed events — but only kind-39999 taggings already publicly readable on the relay, and only through the `toRawEvent` **whitelist** (never a spread), so scan-leg fields cannot leak (L3's set-equality is the standing guard). The `referenced` set derives solely from classifier output; no user input reaches the side-table keys except through classification. Client renders via `JSON.stringify` into a React `<pre>` (auto-escaped; no `dangerouslySetInnerHTML`).
- [x] **Races:** the hook's `cancelled` guard covers stale responses; `tags`/`mine`/`rawEvents` are replaced wholesale from one response, so count-back holds within every snapshot (the timing hazard eager D1 exists to avoid). One inherent-in-design edge: if a panel is open and a later snapshot made its blocks unproducible (deploy skew only), the render map withholds the panel without a notice until the next toggle — this is the ADR's own specified structure (`if (!blocks) return null` appears verbatim in the ADR's implementation notes), unreachable in practice, and withholding-not-misrendering is AC-4's requirement. Not a finding.
- [x] **POV correctness (invariant #1/#3):** bytes POV-invariant — `toRawEvent` output carries no POV field (7 fields exactly; L4 proves tags round-trip unannotated); the **set** is per-POV by construction (counted channels are the trust predicate's output) and computed per request; nothing precomputed, denormalized, or stored per POV — `useEventTags` re-fires on `povParams` deps (`useEventTags.js:112`) and re-derives the whole snapshot. No `povSuffix`/`wotPov`/`viewerPubkey` inside the composed `event` objects.
- [x] **Decentralized-first (invariant #2):** no authorship gate, no auth gate; the panel works signed out; fixture authors are arbitrary throwaway keys — accepted and rendered.

## House rules check

- [x] Concept Graph API authority respected; no re-derivation from BIBLE.
- [x] No new lint/typecheck/build tooling.
- [x] **TA-pubkey hygiene:** no literal introduced anywhere in the diff (R1/R2). The pre-existing `CANONICAL_AUTHORITY` (`src/api/event-tags/index.js:39`) and the ADR-0015 `LEGACY_*` constants (`src/api/profile-tags/index.js:49`) appear **only as unmodified context** — nothing added, removed, or rewritten. (A diff removing `LEGACY_*` would be an auto-reject; this diff does not.)

## Scope-creep sweep

Changed-file set = exactly the ADR's implementation-notes touch list + harness artifacts (story/ADR/test-plan/book/journal/epic-index/_intake) + the two new suites + registration + the scheduled sibling re-aim. Explicitly confirmed untouched: profile pages' chips (`ProfileTagsSection` — zero diff), `for-tag` and the note-TL path (R3/R-http-1), `TagANoteModal` (R4), `NoteActionsMenu`, `Tag.jsx`, `AddTagDialog`, Story-1 panel, Story-2 panel behavior (the re-aim renders identically — same component, same props, same classes).

## Verify-by-driving (the test plan's named gaps — my own evidence)

Fixture: honored-namespace events seeded on the **local** relay with throwaway `nak` keys (2 kind-1 notes, 2 tag elements, 2 headers, 14 assertions incl. a 10-apply hot note), z-tags under the deployment's default honored authority — permissionless publication, mirroring the publish suites' accepted local practice. Server cross-check before driving: default-namespace `for-event` returned exactness `keys(rawEvents) ≡ referenced` and 7-field projections on both notes.

Driven headless-Chromium (Playwright ad-hoc; scripts + screenshots in the session scratchpad: `drive-story3.js`, `drive-1-notes-tab-stacked.png`, `drive-2-large-panel.png`, `drive-3-event-page.png`): **34/34 checks green.**

1. **Gap #1 (AC-5 two surfaces): CLOSED.** Tag page Notes tab + profile page's tagged-notes section — panel below note body, above chips row, on both (DOM-order asserted via `compareDocumentPosition`). Note: the Notes tab's pre-existing Curated threshold hides a net-0 note (+1 −1) until "View options" is expanded — pre-existing Story-8/15 behavior, not this story's; noted for future drivers.
2. **Gap #2 (AC-1/AC-2 interaction sequence): CLOSED.** Hover → click Show → panel opens; the popover then closed via the **documented** layout-shift + cursor-leave composition (recorded as INFO, matching ADR 0003 D4 — not a defect); re-hover reads "Hide Raw Tagging Events" with `aria-expanded=true`. Signed-out click-through included (headless browser has no NIP-07): raw button enabled, Apply/Dispute disabled.
3. **Gap #3 (stacking + isolation): CLOSED.** Two panels stacked on one note in chips' display order; per-chip Hide leaves the sibling panel open; opening on note A never affects note B, and vice versa.
4. **Gap #4 (uncounted marker on a real mine-only block): DEFERRED, with reasons.** Requires a WoT-filtering POV plus a signed-in viewer whose own assertion falls below threshold. The local house POV resolves `unfiltered` (`minRank: null`, verified live) so the state is unproducible here; staging holds zero event-taggings (book's measured reality) and seeding staging requires signing keys and staging mutation — outside this run's ceiling (book.md "Staging mutations: none beyond the deploy") and against the passive-verification norm. The marker markup is byte-identical to Story 2's shipped-and-reviewed component (D5 rename; U4 pins the verbatim string) and the `counted:false` composition path is source-pinned (U15). Same gap class as OPEN.md **#49** (profile surface) — if the operator wants the note-surface instance tracked, extend that row rather than opening a duplicate.
5. **Gap #5 (large panel): CLOSED.** 11-block panel renders fully; long z-tag lines wrap inside `.bs-tag-raw-pre` (no horizontal overflow, no clipping); applications-first order held at volume; screenshot on file.

Also verified while driving: the feed and `/event` page **cannot** render local-only fixture notes (their read paths resolve from the external relay set — `/api/event` → `NOT_FOUND` for the fixture id), so those two surfaces rest on the structural AC-5 guarantee (R8), consistent with the story's "Notes tab plus one other" bar.

## Weighing the three recorded Deviations

1. **`aria-controls` omitted** — acceptable. The ADR's Implementation notes (the normative work plan) give the button JSX without it and specify no panel `id`; the state is exposed via `aria-expanded` and the panel via `aria-label`. A cross-component id contract would be a new design decision, not a transcription. Non-blocking; a future a11y pass could add it.
2. **Two-line TagPageRow re-aim** — acceptable and verified: import + the one JSX usage (`TagPageRow.jsx:4,431`); U3 pins zero remaining `TagRowRawEvents` references; rendered output identical.
3. **`t =>` arrow param** — acceptable: forced by U12's pinned regex; syntax-only.

None changes an ADR decision. All three are recorded in the story's `## Deviations` — the documentation bar is met.

## Product-guide adherence

N/A — acceptance-frame book, no PRD; label and caption wording were operator-settled at Planning and match verbatim in the code (driven).

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/components/NoteTags.jsx:74-91`** — `toggleRaw` on an already-open panel whose blocks became unproducible sets the notice but leaves the coordinate in `openRaw` (label would read "Hide" with no panel until a second toggle). Reachable only via deploy skew (the same unreachable premise as the withhold itself); the ADR's own toggle spec has the same shape. Optional hardening: also delete the coordinate when `rawBlocksFor` returns null.
2. **Gap #4 deferral** (above): the note-surface `counted:false` rendering joins OPEN.md #49's class of states no runtime has exercised. Recommend extending #49 rather than a new row.
3. The drive script's Surface-2 check labels say "/event" (stale wording from an earlier draft); the surface driven is the profile page, per the run header. Scratchpad-only; recorded here so the evidence reads correctly.

### Harness friction

1. None. (Orientation docs, ports, and the container restart note in my brief were all accurate; the Notes-tab Curated threshold cost one debug cycle but is designed product behavior, not a doc defect.)

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place; `Linked artifacts → Review` filled.
- [x] Completion detection run: book `audits/note-tagging-inspector/book.md` (Direction-mode, armed) — frame bullets 1–4 are now evidenced by this review; **bullet 5 (live on staging + five-tier smoke) is not yet satisfiable — the deploy chain is downstream of this review.** The book does **not** yet look complete; no `/close-book` offer. The Director's run continues to the deploy stage per the pre-registration.
