# Test Plan: Story 3 — Raw tagging-events inspector for a note's tag chips

**Story:** `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md`
**ADR:** `engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md`
**Date:** 2026-07-17

## What actually gates — the suite split, carried forward explicitly

ADR 0003 Consequences #4 instructs this plan to carry Story 2's split forward out loud. Same three layers, same asymmetry:

| Layer | File | Gates CI? | Why |
|---|---|---|---|
| **Stack-free source assertions** | `test/note-tagging-raw-events-inspector-ui.test.js` | **YES — the only automatic gate** | Runs with no stack, no network, no transpile. |
| Live HTTP contract | `test/note-tagging-raw-events-inspector-http.test.js` | **No** | **Skips wholesale** (`{pass:0, fail:0, skipped:9}`, exit 0 — verified below) when `nak` or the control panel is missing, which is exactly CI's stack-free job. Gates staging/local runs only. |
| Playwright | *(none written)* | **No** | The ratified deferral stands (OPEN.md #13: "first CI story is stack-free suites ONLY, e2e deferred"). Stories 1–2 set the precedent. |

**The correction Story 2's plan recorded applies here verbatim:** ADR 0003 D1 itself says its eager option is "testable by the node HTTP-contract suite (with the honesty note that suite gates staging/local runs, not stack-free CI)" — the ADR already carries the caveat, so nothing needs re-litigating; it is restated here so the Reviewer reads the live suite's green as *staging/local* evidence, not CI evidence.

## Coverage map

`U`/`L` = fails now, passes once built. `R` = regression sentinel, passes before **and** after; exists to fail on a *future* edit.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 (both labels, driven by `rawOpen`) | `U6` labels + `rawOpen ?` ternary in the popover region | `…-ui` | source |
| AC-1 (present only when `onToggleRaw` passed; a11y) | `U7` the `{onToggleRaw &&` gate + `aria-expanded` | `…-ui` | source |
| AC-1 (no login gate on inspection) | `U8` no `disabled`, no `viewerPubkey` in the button block; `R7` Apply/Dispute keep theirs (exactly 2 gated buttons) | `…-ui` | source |
| AC-2 (default hidden / per-chip toggle / per-note isolation) | `U10` per-coordinate `Set` (`openRaw`, keyed `${authorPubkey}:${slug}`) | `…-ui` | source |
| AC-2 (the mandated slot) | `U11` panels between `<PovStatusNotice/>` and `.bsp-note-tags-row` in JSX order | `…-ui` | source |
| AC-2 (stacking in display order) | `U12` `displayedTags.filter(… openRaw.has …)` — order by construction | `…-ui` | source |
| AC-2 (caption = tag name, attributable when stacked) | `U13` `.bsp-note-tags-raw-caption` + `{t.name}` | `…-ui` | source |
| AC-2 (popover open/close behavior unchanged; no close-on-select) | `R6` exactly 4 `setOpen(false)` sites + mouseleave/Escape/blur-outside survive | `…-ui` | source |
| AC-3 (composition: `counted` = channel membership; viewer joins via `mineEventId`, deduped) | `U15` | `…-ui` | source |
| AC-3 (stable total order: apply-first → `created_at` desc → id) | `U16` | `…-ui` | source |
| AC-3 (blocks: polarity caption + author pubkey + uncounted marker + byte-faithful `<pre>`) | `U4` (the shared component, verbatim Story-2 contract) + `U5` (NoteTags consumes it) | `…-ui` | source |
| AC-3 (server: side-table built with shared `toRawEvent`, in the response) | `U18` export, `U19` require, `U20` handler + `res.json`, `U21` hook carry-through | `…-ui` | source |
| AC-3 (**the exactness invariant**: keys(rawEvents) ≡ applications ∪ disputes ∪ mine, both directions) | `L2` | `…-http` | live HTTP |
| AC-3 (7-field projection, exact keys, canonical order) | `L3` | `…-http` | live HTTP |
| AC-3 (byte-faithful: id/pubkey/sig/created_at/kind/content/tags round-trip) | `L4` | `…-http` | live HTTP |
| AC-3 (viewer's counted event ships once — dedupe across channels) | `L5` | `…-http` | live HTTP |
| AC-3 (dispute bytes ship; polarity no gate) | `L6` | `…-http` | live HTTP |
| AC-3 (dispute-only chip: exactly its one event; count-back to "Disputed by 1") | `L7` | `…-http` | live HTTP |
| AC-4 (visible message instead of a panel; `.ptc-hint` idiom) | `U9` | `…-ui` | source |
| AC-4 (all-or-nothing on any missing id) | `U17` the `some(b => !b.event)` withhold | `…-ui` | source |
| AC-4 (untagged note → `rawEvents: {}`, "always assign") | `L1` | `…-http` | live HTTP |
| AC-4 (per-chip/per-note isolation) | structural via `U10`'s per-coordinate state; behavior → verify-by-driving (gap #3) | — | — |
| AC-5 (uniform across note surfaces — structural) | `R8` NoteCard renders NoteTags + TagChip importer census = exactly {NoteTags, ProfileTagsSection} | `…-ui` | source |
| AC-5 (verified on 2+ surfaces — behavioral) | verify-by-driving (gap #1) | — | — |
| AC-6 (profile chips gain nothing) | `R5` — **the highest-value sentinel** (see below) | `…-ui` | source |
| AC-6 (no TA literal introduced) | `R1` (chip/panel/composition/hook files) + `R2` (event-tags keeps exactly ONE 64-hex: `CANONICAL_AUTHORITY` verbatim) | `…-ui` | source |
| AC-6 (Story-1/2 surfaces + sibling handlers untouched) | `U3` (TagPageRow one-line re-aim, nothing else), `R3` (aggregateNotesTagged/forTag/tagIndex/notesByAuthor never mention rawEvents/toRawEvent), `R4` (TagANoteModal), `R-http-1` (for-tag envelope), `R-http-2` (for-event envelope additive) | both | source + live |
| AC-6 (CSS: new `bsp-note-tags-raw*` only; shared rules survive) | `U22` new rules exist; `R9` `.ptc-hint`/`.ptc-popover`/`.bs-tag-row-raw-*` survive (`.bs-tag-raw-pre` deferred to Story 2's R4, which owns it) | `…-ui` | source |
| AC-6 (POV: bytes invariant, set per-POV at read time) | `L4` (tags untouched, nothing annotated) + `U21` (hook re-derives on POV switch; nothing stored) | both | live + source |
| ADR D5 (extraction is a rename, not a copy) | `U1` new file, `U2` old file GONE, `U4` classes/marker byte-identical | `…-ui` | source |
| ADR D5 (intake discharge) | `U23` `**DONE**` + ADR-0003 pointer in the `_intake.md` entry | `…-ui` | source |
| ADR D4 (props threaded from NoteTags only) | `U14` + `R5` | `…-ui` | source |

**The highest-value sentinel: `R5`.** An implementation that renders the button whenever a chip *has* `applications`/`disputes` — gating on data presence instead of the `onToggleRaw` prop — passes every U test in the suite and fails only `R5`, because `ProfileTagsSection` passes those same arrays to the same `TagChip`. This is ADR 0002 D5's lesson (Story 2's `R7`), recurring one surface over: gate on the surface's intent, never on data presence.

**The two live tests that matter most:** `L2` (the exactness invariant — AC-3's count-back made structural: no referenced id missing, no unreferenced bytes shipped) and `L3` (the 7-field set-equality ADR 0003's Consequences names as the guard that keeps `toRawEvent` the single "as signed" contract).

## Edge cases

- [x] **Multi-assertion chip (N+M blocks)** — fixture is 1 apply + 1 dispute (N+M=2), covered by `L2`'s set equality + `U16`'s ordering. Larger N against real multi-author data → drive `tags.brainstorm.world` (`cool-web-of-trust`, the federation's only real note-taggings — 2 notes, each +1 −0).
- [x] **Dispute-only chip (zero applications)** — `L7`, explicit: exactly one key, count-back to "Disputed by 1", `mine` empty.
- [x] **Mine-only / viewer-uncounted** — source-level: `U15` (`counted: false` path + `mineEventId` join), `U4` (the verbatim "not counted under this POV" marker). **Not runtime-producible on the local box** (house POV resolves `unfiltered`, `minRank: null` — verified live 2026-07-17 — so every asserter counts and nothing can be mine-only). The trust-predicate mechanics are already covered by the classifier's own suites (`event-tagging-read-api`, `event-tagging-read-viewer-stance`); the rendered marker on a real uncounted block → drive staging (gap #4).
- [x] **Missing-id all-or-nothing** — `U17` pins the withhold + notice branch. Runtime-unreachable by construction (the map and the channels come from one response); reachable only via deploy skew or a regression, which is exactly why the guard is source-pinned rather than driven.
- [x] **Signed-out viewer** — `U8` (raw button carries no gate) + `R7` (Apply/Dispute keep theirs). Runtime click-through signed out → driving (gap #2).
- [x] **Untagged note** — `L1`: `rawEvents` present and `{}` (the 0 B eager increment the D1 measurements priced).
- [x] **Event referenced by two channels** — `L5`: ships once, keyed by id.
- [x] **Sovereignty parameter** — the whole live fixture rides `?authorities=<disposable key>`; `R-http-2` asserts it is honored and echoed. No runtime-TA lookup, no literal.

## Known coverage gaps — named, not implied

Verify-by-driving, per the epic's precedent (Stories 1–2). The Reviewer audits these by hand rather than trusting a green suite:

1. **AC-5 end-to-end on two surfaces** (tag page's Notes tab + one other): the panel actually appearing below the note body, above the chips.
2. **AC-1/AC-2 interaction sequence**: hover → click "Show" → popover survives the click (then usually closes via the *documented* layout-shift + cursor-leave composition, ADR 0003 D4 — **not a defect**; re-hover must read "Hide Raw Tagging Events").
3. **Two chips' panels stacking on one note; a panel open on note A not affecting note B.** Mechanism pinned by `U10`/`U12`; behavior unproven by source.
4. **The uncounted marker on a real mine-only block** — needs a WoT-filtering POV; drive staging.
5. **Large-panel rendering** (a hot note's ~10 blocks) — no capping is in scope; eyeball scroll/overflow while driving.

## Test infrastructure

- **Framework:** Node's built-in runner. No new infrastructure. Both suites export `{ run }` and are standalone-runnable (`node test/<file>`), sibling-style.
- **Registration in `test/test.js` — DONE in this phase (Director-authorized mid-phase; registration is test infrastructure).** The runner discovers suites by explicit `require`, not by glob, so both suites got the four touches: require at the top, `await <suite>.run()` in `main()` (right after the Story-2 suite), a summary line each (the http line is wholesale-skip aware: `SKIP (n tests; preconditions not met)` when `pass+fail === 0`, else `PASS/FAIL … , n skipped`), and the `overallOk` terms. **The OPEN.md #43 hazard was navigated, not fixed:** the chain is severed by a stray `;`, so both new terms **extend the terminal term of the LIVE chain** — verified mechanically post-edit: both terms inside the live expression, which now terminates at `noteTaggingRawEventsInspectorHttpResult.fail === 0;`, live term count 109→112 (matches #43's measured 109 + Story 2's + these 2). The dangling block below the `;` is untouched (re-attaching it is #43's own gate-semantics change, deliberately not slipped in here — same call Stories 1–2 made). `noteTaggingRawEventsInspectorHttpResult` also joined the `totalSkipped` list.
- **Story-2 suite re-aim — DONE in this phase (Director correction, Phase-3 addendum).** ADR 0003 D5's Implementation notes scheduled the `test/tagging-raw-event-inspector-ui.test.js` re-aim (file-path reads `TagRowRawEvents.jsx` → `RawTaggingEvents.jsx`) into implementation, but **Gate 4's mechanical check requires the `test/` diff from the Gate-3 commit onward to be empty** — so every test-file change, including this one, lands in Phase 3. Executed as path-strings-plus-their-prose-mentions only (the `R()` path, the U1 test name, and the five message/label strings naming the file); **every assert condition is byte-identical**; a provenance comment cites ADR 0003 D5. No TagPageRow expectation changed — the suite carries no import-path assertion on it (verified by grep). Consequence: the sibling suite is now part of the **intentional pre-implementation red set** — 22 passed / 3 failed (U1, U18, U19 — all "RawTaggingEvents.jsx must exist"), expected green the moment D5's rename lands.
- **Concept Graph API:** consulted for orientation only (`nostr-event-tag` / `nostr-event` / `tag` definitions); no test depends on graph state. **No firmware reinstall** — no concept definitions change (ADR 0003).
- **Live-suite prerequisites:** `nak` on PATH + a control panel at `BRAINSTORM_BASE_URL || http://localhost:7778` with the strfry publish path (`POST /api/strfry/publish`, `signAs: 'client'`). **Fixtures are fully self-seeded** — the local relay holds ZERO event-tagging events (ADR 0003 measurements; re-confirmed at design time), so the suite publishes its own header + 3 assertions under a **disposable honored authority** passed via `?authorities=` (the read API's own sovereignty parameter — hermetic, no shared namespace touched, no TA literal). Any missing precondition, including a failed seed, → wholesale SKIP, never FAIL.
- **POV note:** the local box's house POV resolves `unfiltered` (`minRank: null`, verified live), so `L5`–`L7`'s counted-channel asserts run here; on a WoT-filtering deployment they SKIP with a reason and `L2`'s set-equality remains binding (it is POV-robust by construction; `mine` is the trust-unfiltered non-vacuous anchor).
- **Fixture hygiene:** fixture events remain on the local relay (the publish-suite precedent's accepted cost); disposable keys + unique timestamped slugs make them inert to every other read.

## How to run

```
node test/note-tagging-raw-events-inspector-ui.test.js     # the CI gate — no stack needed
node test/note-tagging-raw-events-inspector-http.test.js   # live contract (nak + control panel; skips otherwise)
npm test                                                   # everything — see both notes below
```

**Both new suites run under `npm test`** (registered in this phase — see Test infrastructure). Per OPEN.md #27, a full local `npm test` reports **Overall: FAIL for environmental reasons** (the 11 tag/pin/TL suites fail on the stale local stack regardless of this change; per-suite recorded baseline: `reviews/nip-reorg/4-index-crossref-sweep.md` gate 1). The binding gates are (a) the differential — no failing suite beyond that recorded set plus this story's two intentionally-failing suites — and (b) CI's stack-free run, where the http suite self-skips and the ui suite is the gate.

## Verification

The new tests fail with the current code, for the right reasons — missing file, missing labels, missing export, missing response field — not import errors or typos. Confirmed 2026-07-17 at commit `5ad749ed` (branch `feat/note-tagging-inspector`, pre-implementation).

**Stack-free suite — every U fails, every R passes (a clean 23/9 split):**

```
$ node test/note-tagging-raw-events-inspector-ui.test.js
--- note-tagging raw-events inspector UI tests (epic tag-event-inspector, Story 3) ---
  FAIL  U1: RawTaggingEvents.jsx exists — the shared blocks renderer (D5)
  FAIL  U2: TagRowRawEvents.jsx is GONE — a rename, not a third copy (D5)
  FAIL  U3: TagPageRow re-aims its import at the shared component (D5)
  FAIL  U4: the shared component renders the Story-2 blocks verbatim — classes, marker, pubkey, byte-faithful <pre> (D5, AC-3)
  FAIL  U5: NoteTags consumes the shared component for its panels (D3/D5)
  FAIL  U6: the popover offers Show/Hide Raw Tagging Events, label driven by rawOpen (AC-1)
  FAIL  U7: the button renders ONLY when onToggleRaw is passed (D4 — the absent-prop gate)
  FAIL  U8: the raw button has NO login gate — enabled signed out (AC-1)
  FAIL  U9: a per-chip rawNotice renders via the ptc-hint idiom, inside the popover (AC-4)
  FAIL  U10: NoteTags owns a per-coordinate Set of open panels (AC-2, D4)
  FAIL  U11: panels render between PovStatusNotice and the chips row (AC-2 — the mandated slot)
  FAIL  U12: panels stack in the chips' display order — displayedTags filtered on openRaw (AC-2)
  FAIL  U13: each panel is captioned with the tag's name (AC-2 — attributable when stacked)
  FAIL  U14: NoteTags threads the three raw props to its chips — and only NoteTags (D4)
  FAIL  U15: counted = channel membership; the viewer joins via mineEventId, deduped (AC-3, D3)
  FAIL  U16: blocks sort apply-first, then created_at desc, then id — a total order (AC-3)
  FAIL  U17: a chip with ANY missing bytes gets no panel — all-or-nothing (AC-4, D6)
  FAIL  U18: toRawEvent is EXPORTED from profile-tags — one definition of "as signed" (D2)
  FAIL  U19: event-tags REQUIRES the shared projection from ../profile-tags (D2)
  FAIL  U20: handleForEvent serves a rawEvents side-table built with toRawEvent (D1/D2)
  FAIL  U21: useEventTags carries rawEvents through to consumers (D2→D3 seam)
  FAIL  U22: the panel's new classes exist in the note-tags namespace (D6)
  FAIL  U23: the _intake.md <RawEventPanel> entry is flipped to DONE, pointing at ADR 0003 (D5)
  PASS  R1–R9 (all 9 sentinels — correct: they must pass before AND after)

note-tagging-raw-events-inspector-ui: 9 passed, 23 failed
```

**Live suite against the running local stack — every L fails on the missing `rawEvents` field; both sentinels pass. The fixture itself classifies correctly** (L2's non-vacuous anchor — `mine` populated — passes before the failing assert; L7's classification asserts — 0 applications / 1 dispute, `mine` empty — pass before it too):

```
$ node test/note-tagging-raw-events-inspector-http.test.js
--- note-tagging raw-events inspector HTTP tests (epic tag-event-inspector, Story 3) ---
  FAIL  L1: rawEvents is on EVERY for-event response — {} for an untagged note (D2 "always assign")
  FAIL  L2: rawEvents holds EXACTLY the ids the channels reference — applications ∪ disputes ∪ mine (AC-3, D2)
  FAIL  L3: each rawEvents value is the as-signed 7-field projection — exact keys, canonical order (AC-3)
  FAIL  L4: the bytes are byte-faithful to the event as published (AC-3)
  FAIL  L5: the viewer's counted assertion ships ONCE — referenced by both applications and mine, one key (AC-3, D2)
  FAIL  L6: a DISPUTING asserter's event rides the side-table too — polarity is no gate (AC-3)
  FAIL  L7: a DISPUTE-ONLY chip (zero applications) yields exactly its dispute's bytes (AC-3 edge)
  PASS  R-http-1: SENTINEL — for-tag does NOT grow rawEvents (D2: sibling handlers untouched)
  PASS  R-http-2: SENTINEL — the pre-existing for-event envelope survives the additive change

note-tagging-raw-events-inspector-http: 2 passed, 7 failed, 0 skipped
```

**Stack-absent behavior (CI's environment), verified:**

```
$ BRAINSTORM_BASE_URL=http://localhost:59999 node test/note-tagging-raw-events-inspector-http.test.js
--- note-tagging raw-events inspector HTTP tests (epic tag-event-inspector, Story 3) ---
  SKIP  all: control panel not reachable at http://localhost:59999.
exit code: 0
```

**Sibling suites — state at the Gate-3 commit:**

Before the Phase-3 addendum both were green at `5ad749ed` (`tag-actions-menu-ui: 30 passed, 0 failed`; `tagging-raw-event-inspector-ui: 25 passed, 0 failed` — the pre-re-aim proof that this story's new tests broke nothing). After the Director-authorized re-aim (see Test infrastructure), the Story-2 suite joins the intentional red set:

```
tag-actions-menu-ui: 30 passed, 0 failed
tagging-raw-event-inspector-ui: 22 passed, 3 failed
  FAIL  U1: a RawTaggingEvents component exists to render the assertion blocks (D3)
        ui/src/components/RawTaggingEvents.jsx must exist (ADR 0002 D3, re-aimed per ADR 0003 D5) — …
  FAIL  U18: … ui/src/components/RawTaggingEvents.jsx must exist (see U1).
  FAIL  U19: … ui/src/components/RawTaggingEvents.jsx must exist (see U1).
```

All three failures are the missing-component class (the D5 rename hasn't happened); the other 22 pin shipped Story-2 behavior and stay green. **The intentional pre-implementation red set is therefore exactly three suites** — the two new ones plus the re-aimed sibling — and all three must be green, with no `test/` diff after the Gate-3 commit, before Review.

### One test was fixed while writing this — worth recording

`R-http-1` originally queried `for-tag` for the *fixture* tag and timed out: the fixture's target note id is fabricated (published nowhere), so `handleForTag`'s external-relay resolution stalled past the 8s client timeout — an environmental hang, not a finding. Re-pointed at a headerless slug (no relay leg; identical envelope) with the with-data guarantee held by the ui-suite's `R3`, which region-pins `handleForTag`/`aggregateNotesTagged` to never mention `rawEvents`/`toRawEvent`. The lesson mirrors Story 2's vacuous-pass log: a live test must not depend on infrastructure the assertion doesn't need.
