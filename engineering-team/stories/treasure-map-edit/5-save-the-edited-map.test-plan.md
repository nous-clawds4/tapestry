# Test Plan: Story 5 — Edit mode: Save signs and publishes the edited Map

**Story:** `engineering-team/stories/treasure-map-edit/5-save-the-edited-map.md`
**ADR:** `engineering-team/decisions/treasure-map-edit/0005-save-is-one-pure-sequence-with-injected-effects.md`
**Date:** 2026-10-08

## Coverage map

Two new suites, plus re-aims in four existing ones (§ Re-aimed tests).

- **Node:** `test/treasure-map-save.test.js`, registered after `treasure-map-switches.test.js`. It drives the save
  sequence through every branch with fakes, and covers `planEdit().changed`, the new `setOverrideAll`, the report's
  subject, the words and the wiring.
- **Browser:** `tests/brainstorm/treasure-map-save.spec.js`. It reuses story 4's helpers and adds:
  - a signer stub that records what it signs, and can be missing, on another account, or decline;
  - this instance's relay (`POST /api/strfry/publish`): ok, failing, or held;
  - a mock relay on every WebSocket that answers `OK` true or false per relay (the precedent of
    `list-headers-my-assistant-disposition.spec.js`);
  - the publish policy;
  - a newer Map staged for the next read.

| Criterion | Tests | File | Level |
|---|---|---|---|
| AC-1 Save changes, on only for a real change | P1–P2 (`planEdit().changed`: nothing pending, a pick that leaves the Map byte-identical, a real change, the backup switch with and without backups, no Map); SV1 (beside the note; off, off for an unchanged pick, on; no Map) | Node, spec | unit, browser |
| AC-2 what is signed | M1 (`stampFor`: older Map, future-stamped Map, same second, no Map); Q2 (the viewer's 10040, the draft's content and tags exactly, the stamp; what is published is what was signed); Q3 (wrong Map: no viewer, no draft, someone else's draft or base; nothing asked of the signer); Q5 (a signer that signs as someone else never publishes); SV2 (signed once, tags = the edited raw viewer's, newer `created_at`) | Node, spec | unit, browser |
| AC-3 where it goes | SV2 (this instance's relay once; every outside relay); SV5 (the publish policy keeps it local); S2 (`publishEverywhere`) | spec, Node | browser, static |
| AC-4 while saving | SV3 ("Saving…"; Save, Edit, the pickers, Assign to all and Undo all off; ends when the write answers) | spec | browser |
| AC-5 a newer Map | K1 (`isNewer`: later, same time with another id, same Map, older, nothing, a Map where none was read); Q1 (the check comes after the signer check and before signing); Q6 (newer: `changed`, the words, nothing signed); Q7 (same, older, a failed read or nothing found never block); SV4 (nothing signed, published or sent; Edit and the changes stay; focus on Save) | Node, spec | unit, browser |
| AC-6 the outcomes | C1 (`cleanSave`: everywhere; one refused; local-only; only outside relays; nowhere; none tried; no result); Q1 (`saved`), Q9 (`partial` ×3, with "Your Treasure Map" sentences), Q10 (`failed`, and a publish that threw); R1 (`subject`); SV2 (clean: toast, Edit ends, the page shows the signed Map, no report), SV5 (local-only: report until Edit turns on again), SV6 (4 of 5, every relay listed, "rejected"), SV7 (nowhere: alert, Edit stays, Save again succeeds) | Node, spec | unit, browser |
| AC-7 refused before signing | Q4 (no signer: words; nothing read, signed or published), Q5 (another account: the app's own words), Q8 (declined: words; nothing published); SV8 ×3 | Node, spec | unit, browser |
| AC-8 no Map | Q11 (a new Map stamped now, only the edit's entries); SV9 (signed tags, the page shows it, no warning when Edit turns on again) | Node, spec | unit, browser |
| AC-9 story 4's switches (decision 18) | O1 (`setOverrideAll(pending, on, duties)`: on only the cards with duties; off clears all three); SV10 (a card switch described by its card's title then its note; the All switch leaves a card without duties off, so a later pick shows it off); story 4's T1 and V1 re-aimed | Node, spec | unit, browser |
| AC-10 keyboard, screen readers, 375 px | SV2, SV5 (focus on Edit after Edit ends), SV4, SV7 (focus on Save otherwise); the toast and the report as `role="status"`, the refusals and failures as `role="alert"` (every SV locator finds them by role); SV11 (375 and 430 px: Save changes, the alert and the confirmation inside the screen, no sideways scroll) | spec | browser |
| § Copy | W1 (`save`, `saving`, `saved`, `reportSubject`, `changedSince`, `noSigner`, `declined`, exactly, apostrophes curly) | Node | unit |
| Wiring (ADR 0005) | S1 (the sequence is pure: no React, window, fetch, signer or publish module; `.js` imports), S2 (`useMapSave` uses `getActiveSignerOrThrow`, `assertSignerMatches`, `window.nostr.signEvent`, `publishEverywhere`, the sequence; no `taPubkey` or literal key), S3 (the page imports `useMapSave`, never a signer or publish module, never signs itself, offers `COPY.edit.save`), S4 (`useMapEdit` can `finish` and still signs nothing) | Node | static |

**The API both suites name** is ADR 0005's:
- `isNewer`, `stampFor`, `cleanSave` and `saveTreasureMap({ viewer, base, draft, relays, deps })`, with
  `deps = { readLatest, activeSigner, sign, publish, now }`;
- its answers: `{ outcome: 'not-sent', reason, message }` or `{ outcome: 'saved'|'partial'|'failed', signed, report }`;
- `planEdit().changed`, `setOverrideAll(pending, on, duties)`, `useMapEdit().finish`, and `describeTaggingPublish`'s
  `subject`.

**Readings this plan pins** (the Implementer may challenge any; a change is an amendment here):
- **The order is: the Map is the viewer's, then the signer check, then the newer-Map read, then sign, then publish**
  (Q1). With no signer, nothing is read (Q4).
- **A newer Map at the same `created_at` with another id counts as newer,** to be safe (K1).
- **The save note keeps counting a no-op pick once the Map really changes:** "2 unsaved changes" for Concepts (no-op)
  plus Scores (SV1). The note says "No changes yet" only while nothing would change.
- **The publish report keeps the app's sentences,** straight apostrophe included ("instance's"). The tests accept
  either apostrophe there.
- **The seams** are the signer stub, `POST /api/strfry/publish`, the WebSocket relay mock and `/api/publish-policy`.
  They stand in for the real signer and relays, so they're the least brittle way to drive `publishEverywhere`
  unchanged.

## Re-aimed tests

Story 5 adds Save changes, changes `setOverrideAll` and how a card switch is described (book decision 18), and carries
story 4's housekeeping. Each re-aim keeps what the test still protects.

| Suite | Test | Was | Now |
|---|---|---|---|
| `test/treasure-map-switches.test.js` | T1 | `setOverrideAll(p, true)` sets all three | `setOverrideAll(p, true, duties)` sets only the cards with duties; off clears all three |
| `tests/brainstorm/treasure-map-switches.spec.js` | V1 | a card switch's description is its note | its card's title, then its note ("Scores Kept as they are; …") |
| same | V10 | title: "after a pick, an Undo or Try again" | "after a pick or an Undo" (story 4 review, non-blocking 4; Try again's focus is E17) |
| same | V12 | … "and offers no Save changes" | a session that never presses Save changes signs, publishes and opens nothing |
| `tests/brainstorm/treasure-map-edit.spec.js` | E15 | the same "no Save changes" | the same as V12 |
| same | E9 | the row's Undo from a fresh Assign to all | also after Scores → Cy following Assign to all (story 4 review, non-blocking 4); the assertions only grow |
| `test/manage-treasure-map-page.test.js` | D4 | title "neither page signs, publishes or stores anything" | "neither page file … itself"; the check is unchanged and still holds: Save signs through `useMapSave` |
| same | D5 | no "Save changes" literal in the page | still no literal, **and** the page offers `COPY.edit.save` |

**What the neighbour suites pin, checked before writing:**
- **The words:** T1 and C1 (`manage-treasure-map.spec.js`, `…-cards.spec.js`) assert no Save changes *before* Edit is
  pressed. That still holds, because Save lives in Edit mode, so they're unchanged.
- **Page-wide `role="status"`/`role="alert"` queries:** the save spec scopes them to the section, or to the toast by
  its words. Story 3 and 4's specs never save, so no toast or report appears there.
- **Signing and publishing:** story 3's S2 (the edit state signs nothing) still holds with `finish`. The page suite's
  V7 (the view-model is pure) still holds, because the words are plain strings.

## Edge cases

- [x] **A Map stamped in the future** (clock skew): the new one is stamped one second after it (M1).
- [x] **A read that fails during the newer-Map check** doesn't block (Q7).
- [x] **A publish that throws** reads as "failed" with the error in the report (Q10).
- [x] **A signer that signs as another account** (after the check) never publishes (Q5).
- [x] **The second press after a failure** signs and publishes again (SV7).
- [x] **The local write held:** the save waits, and every control stays off (SV3).
- [x] **Inputs are never changed** (`save()` checks base and draft; O1 checks its input).

## Test infrastructure

- **Node:** the built-in runner via `test/registry.js`. The sequence is loaded as ESM from
  `ui/src/pages/treasure-map/saveTreasureMap.js` and driven with fakes that record their calls in order.
- **Browser:** Playwright against the built UI on :7799, every `/api/*` mocked, as stories 3–4. The added Map
  `DUTIES_MAP` has Scores with a duty naming Cy, and Concepts' only duty naming Bea.
- **No stack, no concept graph, no firmware.**

## How to run

```
npm test
npm run -s gate:status
node -e "require('./test/treasure-map-save.test.js').run()"
```

Browser (built UI served on :7799):
```
BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/treasure-map-save.spec.js tests/brainstorm/treasure-map-switches.spec.js tests/brainstorm/treasure-map-edit.spec.js tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium
```

## Verification

The new tests fail with the current code: story 4's code, last changed at `778e0875`. Confirmed on 2026-10-08 at
commit `2d438e05` plus this phase's uncommitted test changes:

```
20261008T200321Z-11416-e3d7 [tme5-phase3] started 2026-10-08T20:03:21.376Z on 2d438e05+dirty — FAIL, exit 1, 5095 passed, 25 failed, 581 skipped, 276/276 suites; failed: manage-treasure-map-page, treasure-map-switches, treasure-map-save
```

- **The 25 failures:**
  - **All 23 of the new Node suite.** Each says what is missing:
    - "`saveTreasureMap.js` does not exist";
    - `planEdit().changed` is undefined;
    - `setOverrideAll` turns on all three;
    - `describeTaggingPublish` quotes its subject;
    - the seven words are undefined;
    - `useMapSave.js` doesn't exist;
    - the page doesn't import it or offer `COPY.edit.save`;
    - `useMapEdit` has no `finish`.
  - **The re-aimed D5:** the page doesn't offer `COPY.edit.save`.
  - **The re-aimed T1:** `setOverrideAll` sets Concepts too.
- **Everything else passes.** 5095 passed is the previous 5097, less D5 and T1, which now fail.

**Browser, against the build of story 4's code** (`index-B6UEV-n6.js`): the new spec, story 4's and story 3's give
**15 failed, 32 passed**.
- **The 15:**
  - **The 14 new runs** (SV1–SV11, with SV8 three times and SV11 at two widths). SV10 fails on the card switch's
    description; every other one fails at "no **Save changes** button".
  - **The re-aimed V1,** on the description.
- **The 32:**
  - story 3's E1–E19, including the re-aimed E9 and E15;
  - story 4's V2–V12, including the re-aimed V10 title and V12.

  The re-aimed tests among them pass now because they check behaviour that hasn't changed: the row's Undo still
  clears everything, and a session that never saves signs nothing.
