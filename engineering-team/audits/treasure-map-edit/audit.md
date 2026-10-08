# Build Audit: Treasure Map Edit mode — assign Assistants on `/treasure-map`, then Save

**Book:** `engineering-team/audits/treasure-map-edit/book.md`
**Date:** 2026-10-08
**Branch / commit range:** `feat/treasure-map-edit`, `547ff7df..1484d9f3` (52 commits), merged to `staging` as
`f0a4c59d` (PR #821), plus this close
**Provenance:** Acceptance-frame (the owner's ask, the handoff's four decisions, and fifteen more the owner made during
the book, each quoted verbatim in `book.md`)
**Confidence:** high. Every capability traces to an approved story, an ADR and a reviewed diff. The owner made each
choice the book depends on, and confirmed Save on staging.

## 1. What shipped

- **The cards count the draft grammar's edge cases right.** Keys are compared segment by segment:
  - a broad entry that more specific entries cover completely doesn't count;
  - a system word counts only for its own family;
  - two spellings of one key count once.

  Edit mode's preview and override switches use the same rule. —
  `stories/done/treasure-map-edit/1-the-card-rule-edge-cases.md`
- **An everything entry that goes beyond `*` is ignored** (book decision 11).
  - A `*:…` entry that names anything after the `*` counts for no category, and no edit removes or rewrites it.
  - `*:` and `*::` are still plain `*`.
  - The draft grammar records the open question (`protocols/drafts/treasure-maps.md` § 13, item 12).

  — `stories/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md`
- **Edit mode on `/treasure-map`.** A signed-in person whose Map has been read presses **Edit**.
  - **Picking:** they assign Scores, Lists or Concepts each to one Assistant, or **Assign to all** for every duty.
    - The pickers offer only the person's own Assistants, from the My Assistants list.
    - Each row shows the Assistant's name and website or NIP-05. The Assistant on this instance comes first, marked
      **Local**; the category's current Assistant is marked **Current**.
  - **Pending changes:** each one reads Unsaved, with Undo. The save note counts them.
  - **Preview:** the cards preview the edit, and "View the raw Treasure Map — edited" shows exactly the Map Save signs.
  - **No Map yet:** Edit works as usual, under the approved warning (decisions 9 and 14).
  - **Untouched entries:** every tag the edit doesn't change keeps its bytes and its place.

  — `stories/done/treasure-map-edit/3-edit-mode-assign-and-preview.md`
- **The override and backup switches.**
  - **A card's override switch** ("Override N individually assigned duties") removes, whole, the narrower entries of
    that category that name another Assistant.
  - **The All duties switch** sums them, and turns on only the cards that have duties (decision 18).
  - **The backup switch** ("Remove N backup Assistants") keeps only the first Assistant of every key in the whole Map,
    including keys the page doesn't show (decisions 8 and 13).
  - **A card's Undo after Assign to all** also cancels the everything change (decision 16).

  — `stories/done/treasure-map-edit/4-override-and-backup-switches.md`
- **Save changes signs and publishes the edited Map** (decisions 17–19).
  - **When Save is on:** only when the edited Map differs from the published one; otherwise the note says "No changes
    yet".
  - **Signing:** the person's own signer signs exactly the edited Map, with a `created_at` that replaces the published
    one. First, the app checks the signer is on the signed-in account.
  - **Where it goes:** this instance's relay and the outside relays the instance publishes to, under its publish policy.
  - **Accepted everywhere:** "Treasure Map updated" shows for a few seconds.
  - **Accepted only somewhere:** Edit mode ends and the app's publish report, subject "Your Treasure Map", says where
    the Map went.
  - **Accepted nowhere:** Edit mode stays, with every change.
  - **Refused before signing:** with no signer, a signer on another account, or a declined signature, nothing is signed
    and the message says why.
  - **A newer Map found at Save:** it's shown with the changes on top, to check and save again; no reload is needed.
  - **A save that stops being current:** if the person signed out or changed mid-save, it signs nothing more,
    publishes nothing and changes nothing.
  - **With no Map found:** Save publishes a new one.
  - **For screen readers:** "Saving…", the toast and the report are announced from live regions that are already on
    the page.

  — `stories/done/treasure-map-edit/5-save-the-edited-map.md`

## 2. Epics & stories rolled up

### Epic: `treasure-map-edit`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-card-rule-edge-cases | the cards' rule compares keys segment by segment (three edge cases) | Done | `reviews/done/treasure-map-edit/1-the-card-rule-edge-cases.md` (PASS, round 1) |
| #2 the-cards-ignore-scoped-star-entries | `*:…` beyond `*` counts nowhere; the draft grammar's open question | Done | `reviews/done/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.md` (PASS, round 1) |
| #3 edit-mode-assign-and-preview | Edit, the pickers, Assign to all, Undo, the save note, the preview, the no-Map warning | Done | `reviews/done/treasure-map-edit/3-edit-mode-assign-and-preview.md` (PASS at round 2) |
| #4 override-and-backup-switches | the card, All duties and backup switches; decision 16's Undo | Done | `reviews/done/treasure-map-edit/4-override-and-backup-switches.md` (PASS, round 1) |
| #5 save-the-edited-map | Save: sign, publish, outcomes, refusals, the newer Map, stale saves | Done | `reviews/done/treasure-map-edit/5-save-the-edited-map.md` (PASS at round 2) |

ADRs, under `decisions/done/treasure-map-edit/`:
- `0001-the-card-rule-compares-keys-segment-by-segment.md`;
- `0002-only-a-bare-star-counts.md`;
- `0003-a-pure-edit-model-beside-the-card-rule.md`;
- `0004-switches-are-part-of-the-one-pending-edit.md`;
- `0005-save-is-one-pure-sequence-with-injected-effects.md`, with Amendment 1.

Round 1 sent two stories back:
- **story 3:** on phones the All duties list hung off the left of the screen;
- **story 5:** the newer-Map check could refuse for good, "Saving…" was never announced, and a save stayed live after
  sign-out.

## 3. As-built inventory

- **User-facing:** `/treasure-map` gains Edit mode (`ui/src/pages/treasure-map/Index.jsx`). New modules:
  - `editTreasureMap.js`: the pure edit model. It holds the pending edit's steps, the duties and backups it finds, and
    `planEdit` (`{ duties, backups, pending, draft, changed }`).
  - `useMapEdit.js`: the edit's React state.
  - `saveTreasureMap.js`: Save as one pure sequence with injected effects (`isNewer`, `stampFor`, `cleanSave`,
    `reportLines`, `saveTreasureMap`).
  - `useMapSave.js`: the page's only signer and publisher. It reads the newest Map from local strfry and the outside
    relays, and holds the Map shown after a save or a newer-Map refusal.

  Changed:
  - `manageTreasureMap.js`: the card rule (`segments`, `norm`, `covers`); `entryOf` and `appliesTo` exported for the
    edit; `COPY.edit`, Edit mode's words;
  - `ui/src/utils/taggingPublishReport.js`: `describeTaggingPublish` takes an optional `subject` (other callers
    unchanged);
  - `ui/src/styles.css`: `.bsd-tm-edit-*`.
- **Domain:** no concept changed, no firmware reinstall. Reads the person's own kind 10040, the My Assistants list
  (`GET /api/assistant/my-assistants`) and kind 0 profiles.
- **Data & contracts:**
  - **What is signed:** the person's own kind 10040, published with `publishEverywhere` (local strfry plus
    `PUBLISH_RELAYS`, under the instance's publish policy) and signed through NIP-07 (`window.nostr.signEvent`) after
    `getActiveSignerOrThrow`. Before publishing, the signed event's pubkey is checked with `assertSignerMatches`.
  - **What an edit writes:** the draft grammar's family entries (`3038x`, `3039x`, `39998`, and `*` for Assign to all).
    The Assistant here gets its relay; other Assistants get `''` (ADR 0003).
  - **No new API route.** The newer-Map check uses the existing `/api/relay/external`.
  - **The draft grammar:** § 13 gains item 12 (`*:<scope>`, an open question).
- **Tests:**
  - **New Node suites, registered in `test/registry.js`:**
    - `test/treasure-map-card-rule-edges.test.js` (29);
    - `test/treasure-map-star-scopes-ignored.test.js` (17);
    - `test/treasure-map-edit-mode.test.js` (45);
    - `test/treasure-map-switches.test.js` (34);
    - `test/treasure-map-save.test.js` (24).
  - **New browser specs:** `tests/brainstorm/treasure-map-edit.spec.js` (19), `treasure-map-switches.spec.js` (12),
    `treasure-map-save.spec.js` (16).
  - **Re-aims recorded in the test plans:**
    - `test/manage-treasure-map-cards.test.js` and its spec, for decision 11's `*:…`;
    - `test/manage-treasure-map-page.test.js` and `manage-treasure-map.spec.js`, for Save's arrival.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "assigns Scores, Lists or Concepts … per the blueprint" | An assignment writes only the family entries (`3038x`, `3039x`, `39998`, `*`), with no NIP-85 or legacy-spelling entries | intentional-change | Owner, book decision 15 ("The Tapestry repo is designed for experimentation") | Readers that don't read the draft grammar won't see an assignment written only as a family entry: NIP-85-only apps, this app's setup check and its Trusted List readers | §6 |
| 2 | Frame: "Save … signs a new Treasure Map" | The older Tapestry-side generators rewrite the `30382:*` rows when they regenerate, undoing a Scores edit there | constraint-discovered | Book decision 12; ADR 0003 Consequences | A later regenerate from the legacy pages can hand Scores back to the Assistant here | §6, ledger `2026-10-08-legacy-generators-overwrite-edited-scores` |
| 3 | Manage-treasure-map story 2 AC-2: `*:<system>` counts for its family | A `*:…` entry that names anything after `*` counts nowhere, and no edit touches it | intentional-change | Owner, book decision 11; ADR 0002 | A Map using `*:<scope>` shows nothing for it; the person writes `3038x:` / `3039x:` instead | §6 (support may come later) |
| 4 | Blueprint: the toast "Treasure Map updated" on Save | Only for a publish accepted everywhere it was tried; a partial publish shows the app's publish report and ends Edit; none keeps Edit | intentional-change | Owner, book decision 17 | People learn where their Map really went | — |
| 5 | Decision 17: a newer Map at Save → "reload" | The newer Map is shown with the changes on top, to check and save again | constraint-discovered | Review 5 round 1, Blocking 1; owner, book decision 19 ("Let's do 1 A."); ADR 0005 Amendment 1 | No dead end when only an outside relay holds the newer Map | — |
| 6 | Blueprint: the All duties switch turns all three cards | It turns on only the cards that have duties | intentional-change | Owner, book decision 18 | A later pick never starts with its override already on | — |
| 7 | Story 4 AC-6: a card switch described by its note | Described by its card's title, then its note | intentional-change | Owner, book decision 18 | The three switches can be told apart by screen-reader users | — |
| 8 | Blueprint: the All duties actions at the start of a wrapped row | On phones they keep to the row's end, so the list stays on screen | constraint-discovered | Review 3 round 1, Blocking 1; story 3 § Deviations | The list is readable at 375 px | — |
| 9 | Blueprint: absolute pickers | An open list closes on Escape, a press outside, or focus leaving. `aria-controls` names it only while it's open, and focus returns after the render | interpretation | Story 3 § Deviations; review 3 round 1, non-blocking 1–3 and 7; story 4 (focus after render) | Keyboard and screen-reader use work; nothing hidden under a list is focused | — |
| 10 | ADR 0003: the edited box "named like the raw box" | "Raw Treasure Map — edited" | interpretation | Story 3 § Deviations | The two boxes can be told apart | — |
| 11 | Story 5 / ADR 0005: the report's lines from the publish-report module; cards that reappear "once, already named" | Relay lines come through `reportLines`; after a save, cards whose Assistants were already named don't flash the loading line | interpretation | Story 5 § Deviations; ADR 0005 Amendment 1, item 5 | — | — |
| 12 | Frame: Save, and "the edit isn't lost" | Five hardening points left out of story 5: a signer prompt that never answers has no timeout; refusing the account prompt reads as "no signer"; only the pubkey of a returned event is checked; a Map stamped >900 s ahead can't be replaced until then; a late toast timer | deferred | ADR 0005 Amendment 1, "Not taken this round"; review 5 round 1, non-blocking 1, 3, 4, 7, 8 | Rare cases; none loses a saved Map | §6, ledger `2026-10-08-treasure-map-save-hardening` |
| 13 | Story 5 AC-10: focus stays on Save changes after a refusal | When the newer Map already holds the change, or names an Assistant not yet looked up, focus falls to the page body | deferred | Review 5 round 2, non-blocking 1 | Keyboard users lose their place in two rare cases | §6, ledger `2026-10-08-treasure-map-focus-after-newer-map` |
| 14 | Frame: "Finer control of backups belongs to the Advanced page" | One switch; the Advanced page is still the placeholder | deferred | Owner, decision 2 | Per-entry backups are edited elsewhere for now | §6 |
| 15 | Story 5 § Out of scope | A newer Map is not merged entry by entry: only the pending choices go on top of it. Unsaved changes are not remembered across a reload | deferred | Story 5 § Out of scope; decision 19 | — | §6 |

**Undocumented work:** none. Every changed code file traces to a story:
- `taggingPublishReport.js`' `subject` is story 5 (ADR 0005);
- the draft grammar's line is story 2's AC-5;
- the handoff's status line was changed at intake.

Every test edit outside the book's own suites is a re-aim the test plans record.

## 5. Quality state at close

- **Test gate:** `npm test` over the closed tree (book flipped, epic moved under `done/`, references rewritten):
  `20261008T231939Z-9398-173b started 2026-10-08T23:19:39.590Z on f0a4c59d+dirty — PASS, exit 0, 5121 passed, 0 failed,
  581 skipped, 276/276 suites`. "dirty" is this close's uncommitted changes. The 581 skips are the live-stack suites,
  since no stack ran in this session. `harness-lint` is clean.
- **The reviewer's last runs, at `1484d9f3`'s code:**
  - the gate: `20261008T212125Z-5503-a3f6`, PASS, 5121 passed, 0 failed;
  - the seven Treasure Map browser specs: 109/109, and 327 over three repeats.

  They ran against the built UI with every API mocked, since no stack ran in this session.
- **Staging (2026-10-08):**
  - PR #821: CI "stack-free" passed, and the safe-to-merge check exited 0.
  - Merged as `f0a4c59d`; deploy run 37850176311 succeeded.
  - The five-tier smoke test was clean. Staging serves `index-k4iWpdGU.js`, the same bundle as the local build, and it
    carries Edit mode's words. Headless Chromium saw no console errors and no sideways scroll.
  - The owner then edited and saved their own Map there. Their words, verbatim: "I have edited my Treasure Map on
    stating and can confirm that it worked as intended. Ready to close the book."
- **Known open issues (accepted, non-blocking):**
  - Save's five hardening points (§4 #12) and focus after a newer Map (§4 #13);
  - at 320 px the Brainstorm top bar scrolls `/treasure-map` and `/assistants` sideways by 24 px while the Assistant
    pill shows (not this book's code; ledger `2026-10-08-top-bar-scrolls-sideways-at-320`);
  - from the previous book, still open: the top bar's sign-in while the session check runs
    (`2026-10-07-top-bar-sign-in-while-loading`), and Try again skipping the relay list
    (`2026-10-01-treasure-map-retry-skips-relay-list`);
  - a List's system slot is a closed vocabulary today. So `3039x:tag`, `:pin`, `:dlist` and `:contexts` together leave
    `*` no List insight, but the rule still counts `*` there. No Map has this, and no change was asked (review 1,
    non-blocking 5).
- **Debt from ADRs:**
  - two parsers still read 10040 keys (`classifyEntry`, and the card rule the edit shares) until the draft grammar is
    ratified; the card rule doesn't fold naddr or percent-encoded spellings (ADRs 0001–0002);
  - `entryOf` / `appliesTo` are shared by the cards and the edit, by design (ADR 0003);
  - the publish relays (`PUBLISH_RELAYS`) and the read relays differ. A save only an outside relay took is shown from
    the signed event until a reload (ADR 0005).
  - The newer-Map check is best-effort. It can't see a newer Map held only by a relay that's down (ADR 0005).

## 6. Carry-forward register

- [ ] **Production.** This book and manage-treasure-map go to `main` together, only on the owner's explicit go (book
  decision 4).
- [ ] **Save's hardening:** a timeout or Cancel for a signer that never answers; telling a declined account prompt from
  a missing signer; checking a returned event's whole content; a late toast timer (§4 #12; ledger
  `2026-10-08-treasure-map-save-hardening`).
- [ ] **Focus after Save finds a newer Map** (§4 #13; ledger `2026-10-08-treasure-map-focus-after-newer-map`).
- [ ] **Family entries and today's readers:** NIP-85-only apps, the setup check and the Trusted List readers don't read
  `3038x` / `3039x` / `39998` / `*`. Revisit if the standards change, or if people expect those apps to follow an edit
  (§4 #1; decision 15).
- [ ] **The legacy generators rewrite edited `30382:*` rows** (§4 #2; ledger
  `2026-10-08-legacy-generators-overwrite-edited-scores`).
- [ ] **`*:<scope>` support:** ignored for now; the draft grammar's § 13 item 12 holds the question (§4 #3).
- [ ] **The full Advanced page:** every entry, finer control of backups, and somewhere to show ignored entries (§4 #14;
  carried from manage-treasure-map §6).
- [ ] **Merging a newer Map entry by entry,** and remembering unsaved changes across a reload (§4 #15).
- [ ] **The 320 px top bar** (§5; ledger `2026-10-08-top-bar-scrolls-sideways-at-320`).
- [ ] **One 10040 key parser** when the draft grammar is ratified (ADRs 0001–0002; carried from manage-treasure-map
  §6).

## 7. Process findings (harness)

Inputs: the five reviews' "Harness friction" sections (rounds 1 and 2 where there were two), the ledger rows this book
opened, and the Phase-4 test corrections.

`scripts/harness-stats.sh` at close:
- 265 reviews decided; kick-back rate 0% (CR-final ÷ decided); 61 reviews with kick-back history; churn 3;
- 69 books closed and 8 open, this one included; this book ran 1 day open → close;
- all five stories 0 days story → review; 36 phase commits attributed to the epic.

Two of the five stories were sent back once (stories 3 and 5). The headline rate can't show it, because both rounds sit
inside one review file each. That is OPEN.md row 309, seen again.

The session-start digest shows a standing meta escalation (181 open harness lessons). This retro opens no new row. Every
finding below already has one, six of them opened during this book, and none is resolved here.

| Finding | Source | Terminal state |
|---|---|---|
| The review template's `## On PASS` heading reads as a verdict, so every brief had to ask for it renamed | Reviews 1–2, harness friction 1; reviews 4–5 renamed it "Close-out on a pass" | OPEN.md row `2026-10-07-on-pass-heading-reads-as-verdict` (existing, OPEN) |
| The Reviewer's wiring says flip-and-commit; every brief reserved both for the orchestrator | Reviews 1–2, harness friction 2 | OPEN.md row 316 (existing) |
| A built `dist/` records no commit, so a browser pass can't be tied to the reviewed code; the Implementer's builds kept coming from uncommitted trees | Review 2, harness friction 3; seen again in reviews 3, 4, 5 | OPEN.md row `2026-10-07-built-ui-records-no-commit` (opened in this book) |
| In a shallow clone, harness-lint L10 reads the boundary commit as a harness change, and the gate goes red | Story 1, Test Design | OPEN.md row `2026-10-07-shallow-clone-trips-lint-l10` (opened in this book) |
| A brand-new browser spec can't run before its page exists, and nothing says who ratifies its Phase-4 fixes (story 3's Amendment 1; story 5's `3dea23f9`) | Review 3, harness friction 1; review 5 round 2, harness friction 1 | OPEN.md row `2026-10-08-new-browser-spec-amendments-unratified` (opened in this book; "Seen again" added) |
| "No sideways scroll" was the whole 375 px check and can't see content pushed off the left edge | Review 3 round 1, harness friction 2 (Blocking 1's cause) | OPEN.md row `2026-10-08-narrow-width-check-misses-left-overflow` (opened in this book) |
| `tagging-edges-realtime-wrapper` fails timing checks when two gates share the machine | Review 3 round 1, harness friction 3 | OPEN.md row `2026-10-08-realtime-wrapper-timing-flake-under-load` (opened in this book). Every later run in this book ran alone, as its workaround says |
| A guard's refusal names a remedy, and nothing checked that the remedy clears it ("Reload the page") | Review 5 round 1, harness friction 1 (Blocking 1's cause) | OPEN.md row `2026-10-08-refusal-remedy-never-tested` (opened in this book) |
| A coverage-map row, and later two test titles, credited behaviour no assertion pins ("Saving…"; SV15, Q12) | Review 5 round 1, harness friction 2; round 2, harness friction 2 | OPEN.md row `2026-10-01-test-plan-credits-unpinned-behaviour` (existing; "Seen again" added, its third sighting) |
| A neighbour suite checked against old code only (story 3's S3) | Review 3, harness friction 1 | OPEN.md row `2026-10-07-neighbour-suite-duplicate-roles` (existing; "Seen again" added in story 3) |
| The retro's headline kick-back rate reads 0% though two stories needed a second round | This retro, harness-stats | OPEN.md row 309 (existing) |
| A feature branch kept every Phase-3 failing test off shared `staging` across five stories, and PR #821's CI was green on first run | Book decision 7 | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (existing; this close adds the evidence for fix shape (a)) |
| Moving the epic under `done/` breaks inbound path references | This close, step 9 | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (existing). This close rewrote its own references: the moved files, the ledger rows and the eight test headers |
| The stack-free browser server dies when the container restarts | This session | Declined: the handoff's recipe already says to start it again (`docs/TREASURE_MAP_EDIT_HANDOFF.md` § 6), and it's environment, not harness |

**Does it port to the other flow (Direction ↔ human-gated)?**
- **Unratified spec amendments, the refusal remedy, and unpinned credits:** yes. They are Test Design and Architecture
  rules, and a gate judge reading the plan would check them the same way.
- **The narrow-width check:** yes, for any story with a phone-width criterion.
- **The On-PASS heading, the Reviewer's wiring, the built-UI stamp and the timing flake:** yes. Both flows use the same
  template, reviewer and gate.
- **Feature branches:** Direction mode already works on one; this book is evidence that the human-gated flow should
  too.
