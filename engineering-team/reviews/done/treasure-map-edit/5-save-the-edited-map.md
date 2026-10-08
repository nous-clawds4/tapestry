# Review: Story 5 — Edit mode: Save signs and publishes the edited Map

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-08
**Diff:** `git diff 2489239c..HEAD` (base `2489239c`, the approved story; head `8536ae26`; 4 commits, 19 files). Reviewed
on a clean tree at `8536ae26`.
- `94b944c7` and `2d438e05` are the ADR: 0005 drafted, then accepted, with ADR 0004's supersession note and the story's
  ADR link.
- `c852b926` is the Tester's: the two new suites, the registry line, the re-aims (T1, V1, V10's title, V12, E15, E9, D4's
  title, D5), the test plan and the story's test-plan link.
- `8536ae26` is the Implementer's: `ui/src/pages/treasure-map/{saveTreasureMap.js, useMapSave.js, editTreasureMap.js,
  manageTreasureMap.js, useMapEdit.js, Index.jsx}`, `ui/src/utils/taggingPublishReport.js` and `ui/src/styles.css`.

This is the first story in the book that signs and publishes, so I probed past the happy path: 13 scratch browser probes
(H1–H12, not committed) against the built page, and a Node probe of the model and the sequence.

## Quality gates (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme5-review npm test`, alone on the machine, read with
  `npm run -s gate:status -- --label tme5-review`:

  ```
  20261008T203408Z-5286-3833 [tme5-review] started 2026-10-08T20:34:08.756Z on 8536ae26 — PASS, exit 0, 5120 passed, 0 failed, 581 skipped, 276/276 suites
  ```

  - The 581 skips are the live-stack suites; there's no Docker stack here.
  - Per suite: `treasure-map-save` 23/23 (new), `treasure-map-switches` 34/34, `treasure-map-edit-mode` 47/47,
    `manage-treasure-map-page` 22 passed and 2 live skips. The report's other callers: `my-assistants-map` 14/14,
    `assistant-taggings-publish` 19 passed and 1 live skip, `assistant-identification-tags-page` 16/16.
  - The cited runs exist in `tmp/gate-runs/`:
    - Phase 3, `20261008T200321Z-11416-e3d7 [tme5-phase3]` on `2d438e05+dirty`: FAIL, 5095 passed, 25 failed, in
      `manage-treasure-map-page`, `treasure-map-switches` and `treasure-map-save`.
    - Phase 4, `20261008T201955Z-7917-5431 [tme5-phase4]` on `c852b926+dirty`: PASS, 5120 passed.
    - 5095 + 25 = 5120, and 5120 is story 4's 5097 plus the 23 new tests, so no other test moved.
- [x] **Build tied to the commit.** `cd ui && npm run build` from the clean tree at `8536ae26` gave the bundle
  `assets/index-pOBamNJw.js`, the one `dist/index.html` names and :7799 serves. The tree was still clean afterwards.
- [x] **Browser,** the seven specs, `--project=chromium`, against :7799, with no gate running:
  - one run: **104 passed (58.1s)**;
  - `--repeat-each=3`: **312 passed (3.0m)**.
- [x] **The report's other callers in the browser** (`describeTaggingPublish` gained `subject`):
  `my-assistants-actions.spec.js`, `assistant-identification-tags-page.spec.js` and `assistant-taggings-publish.spec.js`
  give **44 passed (54.9s)**. No other caller passes `subject` (grepped; `assistantActions.js:57` passes
  `name: subject`, which is unchanged).
- [x] **The Phase-3 browser claim reproduces.** I extracted `2d438e05`'s `ui/` and `src/` into the scratchpad and built
  them. The build gave the plan's bundle, `index-B6UEV-n6.js`, which I served on :7801. The new spec, story 4's and
  story 3's gave **15 failed, 32 passed**, as the plan says. SV1–SV9 and SV11 fail at "no **Save changes** button";
  SV10 and the re-aimed V1 fail on the description ("Kept as they are; …" without "Scores").
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this file existed.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped. The Vite build was only for the browser runs._

## Spec adherence

Every criterion has tests, and every test passes. Three of the criteria have a gap the tests don't reach (Blocking 1–3).

| AC | Tests | Hands-on | Holds? |
|---|---|---|---|
| AC-1 Save on only for a change | P1, P2, SV1 | `changed` compares the draft's content and tags with the Map's, byte for byte (`editTreasureMap.js:179–183`). With no Map, any added tag. The note gets `{}` when unchanged (`Index.jsx:591`). | Yes |
| AC-2 what is signed | M1, Q2, Q3, Q5, Q11, SV2 | Exactly the draft, kind 10040, the viewer's pubkey, stamped `max(now, base + 1)` (H8, H9, model probe). The signer check and the signed pubkey check both run. | No: signing out mid-save still signs and publishes (Blocking 3) |
| AC-3 where it goes | SV2, SV5 | This instance's relay once, then `PUBLISH_RELAYS`, under the publish policy. | Yes |
| AC-4 while saving | SV3 | Every button in the section is off while busy, the five switches included (H2b); any open list closes. | Yes |
| AC-5 a newer Map | K1, Q1, Q6, Q7, SV4 | Order and semantics are ADR 0005's. | No: a refusal a reload can't clear (Blocking 1) |
| AC-6 the outcomes | C1, Q1, Q9, Q10, R1, SV2, SV5–SV7 | Clean: toast for ~4 s (H11: gone at 5.0 s). Partial: Edit ends, the report stays (still there at 6 s, H11) until Edit turns on. Nowhere: Edit stays, alert, Save again. Local-only, relays-only and nowhere each read as the story says. | Yes |
| AC-7 refused before signing | Q4, Q5, Q8, SV8 ×3 | The three messages, nothing sent. | Yes (non-blocking 3 on the words for a refused permission prompt) |
| AC-8 no Map | Q11, SV9 | A Map with only the edit's entries; afterwards `phase` is `found` and the warning is gone. | Yes |
| AC-9 decision 18 | O1, T1 (re-aimed), V1 (re-aimed), SV10 | As the story says. | Yes |
| AC-10 keyboard, screen readers, 375 px | SV2, SV4, SV5, SV7, SV11 | Focus lands right after every outcome. 320 and 375 px: the failed report, the partial report and the toast lie inside the screen (H10; 320's 24 px is the known top-bar row). | No: "Saving…" is never announced (Blocking 2) |

- [ ] Every acceptance criterion has a passing test. (AC-10's "Saving…" has none; Blocking 2.)
- [ ] No criterion is silently dropped. (AC-10's "Saving…" announcement; Blocking 2.)
- [x] No behaviour added that isn't in the story. The names-ready change in `CategoryCards` serves AC-6 and AC-10
  (non-blocking 5).

## ADR adherence

- [x] **Files** match the implementation notes: the two new modules and the six changed files. Nothing else in
  `ui/src` changed. No new dependency.
- [x] **Sub-decision 1, `saveTreasureMap.js`.** Pure: no React, `window`, `fetch`, signer or publish module (S1, and
  read). Imports only `./manageTreasureMap.js` and `../../utils/taggingPublishReport.js`.
  - `isNewer`, `stampFor` and `cleanSave` are the ADR's rules (`:24–49`).
  - The sequence is the ADR's order: wrong Map, signer check, newer-Map read (a throw reads as `null`), sign, publish
    (a throw reads as a failed local write). It never throws (model probe: `readLatest` and `publish` both throwing
    give `failed` with "could not be saved … (boom)"; a publish that resolves `undefined` gives `failed`).
  - It adds `reportLines`, which the ADR doesn't list (non-blocking 5).
- [x] **Sub-decision 2, `subject`.** Used as written when given, otherwise the quoted name (R1). No existing caller
  changes.
- [x] **Sub-decision 3, `useMapSave`.** The real effects are the ADR's: both sources for `readLatest` (non-strict, a
  failing source skipped), `getActiveSignerOrThrow`, `window.nostr.signEvent` then `assertSignerMatches`,
  `publishEverywhere(signed)` with `PUBLISH_RELAYS` for the report. It holds `{ busy, outcome, message, report, toast,
  saved }` plus a `seq` the page's focus effect keys on. A viewer change resets it.
  - **It is the only signer or publisher.** `Index.jsx` and `useMapEdit.js` import no signer or publish module and call
    no `signEvent` or `publish*` (S2–S4, D4, grepped).
  - **A stale answer is dropped from the state but handed back to the page,** which acts on it (Blocking 3).
- [x] **Sub-decision 4, the model.** `planEdit().changed` and `setOverrideAll(pending, on, duties)` are the ADR's.
  `editedTags`' JSDoc now says tags can be removed.
- [x] **Sub-decision 5, the hook.** `setOverrideAll(on, duties)` and `finish()` (Edit off, pending cleared, list closed,
  nothing reloaded).
- [x] **Sub-decision 6, the page.**
  - **The Map shown** (`Index.jsx:669–672`): the signed event for this viewer, unless the read holds a strictly newer
    one, so `>=` by `created_at` as the ADR says. It reaches the cards, both raw viewers, the edit base and `phase`. A
    viewer change drops it (`saved.pubkey === viewer`, and the hook resets). H9: a second save is based on the first
    signed Map, isn't refused, and is stamped one second later.
  - **The save bar, `busy`, the outcomes, the toast, the report, focus and the card switches' `describedBy`** are as
    the ADR says.
  - **Not in the ADR:** the names-ready rule in `CategoryCards` (`:448–452`). I judge it sound (non-blocking 5).
- [x] **Sub-decision 7, the words,** exactly the story's § Copy (W1; and a script comparing `COPY.edit` with the story
  file's § Copy, wrap-normalised: all seven match).
- [x] **Sub-decision 8, styles** (`styles.css:10361–10385`): the 40 px pill, 14 px/600, accent and white, the disabled
  greys with `not-allowed`, the toast's colours, radius, padding, shadow and reduced-motion rule. The report's relay
  lines wrap anywhere, so long relay reasons stay inside the screen at 320 px (H10).

## The carve-out and the re-aims

- [x] **`c852b926` touches only** the two new suites, `test/registry.js` (one line, after `treasure-map-switches`), the
  four re-aimed suites, the test plan, and one link line in the story.
- [x] **`8536ae26` touches no test file.**
- [x] **Each re-aim keeps its intent:**
  - **T1** (`treasure-map-switches.test.js:328–334`): on now sets only the cards with duties, off still clears all
    three. Its input is stronger: the off case starts from all three on.
  - **V1** (`treasure-map-switches.spec.js:245–252`): only the expected description changes, to the card's title then
    the note, in both states. Every other line is byte-identical.
  - **V10's title** drops "or Try again"; the body is unchanged.
  - **V12 and E15** drop only the "no Save changes button" line, and their titles say the session never presses it.
    Every safety assertion stays (`safe()`: no socket, no write, no sign call).
  - **E9** (`treasure-map-edit.spec.js:429–435`) adds a pick of Cy on Scores before the row's Undo, so it now covers
    story 4 review non-blocking 4. The assertions only grow.
  - **D4** keeps its check byte for byte; only the title narrows to "the page file itself".
  - **D5** keeps "no Save changes literal" and adds "offers `COPY.edit.save`".
- [x] No other test was weakened. The neighbour suites are unchanged apart from those lines.

## Concept-graph integrity
- [x] No concept handles are touched. The Map's keys are kind/scope keys, not concept handles.
- [x] No concept definition changed, so no firmware reinstall is needed (ADR 0005 says the same).
- [x] Nothing re-derives domain concepts from BIBLE.md. The stack wasn't running (the story says so).

## Things tests can't catch
- [x] No secrets. No `console.*`, `debugger`, `TODO` or commented-out code in the source diff (grepped).
- [x] **The epic's guardrail and CLAUDE.md principle 4.** Everything the edit doesn't change keeps its bytes and its
  place in the signed Map.
  - **Model probe,** on a deep-frozen Map shaped as the legacy generator writes it: 11 `30382:<metric>` rows, plus a
    backup with extra elements, `alt`, `p`, `e` and `client` tags, a key this page doesn't read with three extras, a
    `*:tag` entry, an invalid delegate, an upper-case delegate, and non-array junk. For each of Scores, Lists,
    Concepts, All, a no-op pick, an override and the backup switch: only the category's own entries (or the dropped
    duties and backups) differ; every other tag is byte-identical in its relative order; the content is kept; and
    what the sequence signs is the draft exactly.
  - **End to end (H8):** the same kind of Map, served as the published one, Lists → Bea, saved. The signed Map
    differs from the published one only at index 13 (`30392` → Bea) and in the appended `3039x`. This instance's
    relay and all five outside relays got exactly the signed tags.
- [x] **Nothing signs without a click on Save.** `save()` is called only from `onSave`, which only Save's `onClick`
  calls. E15 and V12 still show a whole session signs and sends nothing.
- [x] **Double click (H1).** A real double click signs once: the first click's render disables the button before the
  second. Two `click()` calls in one script task sign and publish twice (non-blocking 2).
- [x] **An exception in `publish` or `readLatest`:** each reads as the ADR says (model probe above).
- [x] **A signer that alters the event** gets its version published and shown (non-blocking 4).
- [ ] **A save racing a viewer change** signs and publishes after sign-out (Blocking 3).
- [x] **A hung `getPublicKey` prompt** holds the edit, every control off, with no end (H7; non-blocking 1).
- [x] **`edit.finish()` after the await** can't meet a newer session for the same viewer, because Edit is off while
  busy. After a viewer change it can (Blocking 3).
- [x] **`stampFor` against a future Map:** one second after it, as the ADR says (M1). Non-blocking 7 on relays'
  future-time limit.
- [x] **The toast timer** is cleared on unmount (`useMapSave.js:52`) and on each new save (`:56`). A save that ends after
  the page is left starts a timer nothing clears; that's harmless (H12: no console errors) (non-blocking 8).
- [x] **Widths:** at 320 and 375 px the failed report, the partial report and the toast lie inside the screen; their
  relay lines wrap and nothing is clipped (H10, screenshots in the scratchpad).

## House rules check
- [x] Concept Graph API authority respected (no concept work).
- [x] No new lint, typecheck or build tooling.
- [x] **No `taPubkey` and no 64-hex literal** in the source diff (grepped; S2 also guards `useMapSave.js`).
- [x] **Only the viewer's own Map.** The viewer is the session's `user.pubkey`. The sequence refuses a draft or base
  of anyone else before asking the signer (Q3), and signs `pubkey: viewer`.
- [x] **The signer check is used:** `getActiveSignerOrThrow(viewer)` before reading, and `assertSignerMatches` on the
  signed event (Q5, SV8 "another account").
- [x] **The copy matches § Copy exactly** (above). The mismatch refusal shows the `SignerMismatchError`'s own words.

## Product-guide adherence *(when the story traces to a PRD)*
- [x] No PRD. The words are the blueprint's and the owner-approved § Copy. The save bar and toast follow the blueprint's
  `tmbSave` and toast.

## Findings

### Blocking

1. **The newer-Map check can refuse for good, and the reload it asks for can't clear it**
   (`ui/src/pages/treasure-map/useMapSave.js:27–40`, `ui/src/pages/treasure-map/saveTreasureMap.js:79–82`, against
   `ui/src/hooks/useTreasureMap.js:58–76`).
   - **The mismatch.** The page's read stops at this instance's relay whenever it holds any Map. The check reads that
     relay and the general-purpose relays together, and the newest wins. So the check can find a Map the page can
     never show. ADR 0005's Consequences say the check "reads the sources the page reads". It does, but not with the
     page's stop rule.
   - **H3:** this instance's relay holds the published Map, and an outside relay holds a newer one. Save is refused
     with "…changed since this page read it. Reload the page to see the new one…". After the reload, the page shows
     the same older Map, and Save is refused again. Nothing is ever signed, which is safe, but the page has no way
     forward.
   - **H4, the app's own outcome:** a relays-only save, which AC-6 allows (the local write fails, 5 of 5 relays take
     it). After a reload, with this instance's relay healthy again, the page shows the old Map, and the next save is
     refused the same way. The newer Map is the person's own save.
   - **Across instances:** a save on one instance goes to its relay and `PUBLISH_RELAYS`. Three of those (damus,
     primal, nos.lol) are in the firmware's general-purpose set. On another instance whose relay holds an older Map,
     Save is refused until that relay gets the newer one. The router preset that syncs kind 10040 with those relays is
     off by default (`setup/router-presets.json:79–91`).
   - **Against the story:** AC-5's words promise that a reload shows the new Map, and book decision 17 asks the
     person to reload. In these states neither holds, and Save can't succeed.
   - **No test reaches the relay half of the check.** SV4 stages the newer Map only on `/api/strfry/scan`, and the
     Node suite fakes `readLatest`. This is the gap ledger row `2026-09-29-test-plan-misses-injected-seams` describes.
   - **Asked change:** an ADR 0005 amendment by the Architect, with the owner's approval because it touches book
     decision 17. The check must never refuse in a state that the refusal's own remedy can't clear. Two shapes:
     - (a) `readLatest` follows the page's own rule (this instance's relay first, the relays only on a miss), so
       "newer" means newer than what a reload shows;
     - (b) keep the wide read, but when the newer Map is one the page's read wouldn't show, show it and base the edit
       on it rather than asking for a reload. This may need new words.

     Either way, add browser cases for H3's and H4's shapes that drive `readLatestMap`'s relay branch.
2. **"Saving…" is never announced** (`ui/src/pages/treasure-map/Index.jsx:592–600`; AC-10).
   - "Saving…" exists only as the label of the Save button, and the button is `disabled` while busy. When the focused
     button is disabled, Chromium moves focus to `<body>`. H2, by keyboard: `document.activeElement` is `BODY` while
     busy.
   - No live region changes either. The only one in the section is the save note (`:591`, `aria-live="polite"`),
     which still reads "1 unsaved change".
   - AC-10: "'Saving…', the outcome messages and the report are announced." The test plan's AC-10 row credits the roles
     of the toast, the report and the alerts. SV3 checks the visible text. Nothing pins the announcement.
   - **Asked change:** announce it, for example:
     - the polite save note reads "Saving…" while busy; or
     - an always-mounted, visually hidden `role="status"` does.

     Add a test (Tester's lane) that reads the live region while the local write is held. If the mechanism goes
     beyond ADR 0005 sub-decision 6, note it there. Non-blocking 6 could share the same region.
3. **Signing out during a save still signs and publishes the Map, and the stale answer still ends Edit**
   (`ui/src/pages/treasure-map/useMapSave.js:54–75`, `ui/src/pages/treasure-map/Index.jsx:692–693`; AC-2).
   - The sequence runs to the end with the `viewer` captured at the click. A viewer change (`:47–51`) only makes the
     answer stale. Both signer checks compare with that captured viewer, never with the session: `getActiveSignerOrThrow(viewer)`
     at `:65`, and `assertSignerMatches(signed.pubkey, viewer)` at `:68`.
   - **H5:** press Save, then Sign out from the top bar while the signer's `getPublicKey` answer is pending, then let
     the signer answer. The old viewer's Map was signed once, written to this instance's relay, and sent to all five
     outside relays, after sign-out. The page showed nothing: no toast and no report, because the cards are gone.
   - AC-2 says: "Nothing is signed … when the signed-in person has changed since the Map was read."
   - `:75` returns the stale answer to `onSave`, which calls `edit.finish()` on whatever Edit session is current then.
   - This is the pattern of ledger row `2026-10-01-me-disposition-inflight-signer-prompt`, which was non-blocking only
     because the server refused the write. Here the write goes through.
   - **Asked change:**
     - Just before `sign` and again before `publish`, refuse unless the save is still current: `mine === latest.current`
       and `getSessionPubkey() === viewer` (`signerGuard.js`). Refuse as `not-sent`/`viewer`, with nothing signed or
       sent. This adds a dep to the sequence, so it needs an ADR 0005 note.
     - `onSave` acts only on a current answer; for example, `save()` returns `null` when stale.
     - Add a browser case: hold the signer, sign out, release it, then count `signEvent` calls and writes.

### Non-blocking
1. **A signer prompt that never answers holds the edit with no end** (`ui/src/pages/treasure-map/useMapSave.js:54–90`;
   H7).
   - Save reads "Saving…" and every Edit control stays off for as long as the prompt goes unanswered: 8 s observed,
     with no timeout and no cancel. A held local write does the same.
   - The app's manual-edit flow behaves the same way.
   - Optional: a timeout on `activeSigner` and `sign` that ends as `not-sent` with words, or a ledger row.
2. **Two clicks in one script task sign and publish twice** (`ui/src/pages/treasure-map/Index.jsx:690`; H1).
   - Both calls read the same render's `save.busy`. The result was `getPublicKey` ×2, `signEvent` ×2 and two local
     writes.
   - A person can't do this: a real double click signs once.
   - A real signer gives both the same id (same content, same second), so the harm is a duplicate publish.
   - Optional: a ref guard at the top of `save()` (`useMapSave.js:54`).
3. **Refusing the signer's `getPublicKey` permission reads "no Nostr signer was found"**
   (`ui/src/pages/treasure-map/saveTreasureMap.js:76`, as ADR 0005 step 2 prescribes).
   - Only a missing `window.nostr` is "no signer". A refused prompt is closer to "declined".
   - For the owner if the words matter.
4. **The signer's answer is trusted beyond its pubkey** (`ui/src/pages/treasure-map/useMapSave.js:66–70`; model probe).
   - A signer that changes the tags, content or `created_at` gets its version published and shown as the Map.
   - Honest NIP-07 signers don't, and the key is the person's own.
   - Optional defence: before publishing, compare the signed event's kind, content, tags and `created_at` with the
     unsigned one, and refuse on a difference.
5. **Two deviations from ADR 0005 aren't logged.** `roles/implementer.md` step 9 asks for them, and the story has no
   `## Deviations` section. Both are sound.
   - **`reportLines`** (`ui/src/pages/treasure-map/saveTreasureMap.js:51–54`), an export the ADR doesn't list.
     - It's there so the page needn't import `taggingPublishReport`, which D4's `/publish\w*/i` import check
       (`test/manage-treasure-map-page.test.js:368`) would flag by its file name.
     - It's pure and built on `relayLine`. Only SV6 checks its output in the browser ("rejected" and the relay names).
   - **The names-ready rule in `CategoryCards`** (`ui/src/pages/treasure-map/Index.jsx:448–452`).
     - Why it's needed: without it, a saved Map naming an Assistant the last lookup didn't cover puts the section back
       to "Loading…", and the Edit button goes with it, so focus couldn't land on Edit.
     - It's sound. `names.key` is set only when a lookup finishes (`:440`), and the person's rows exist only after
       their profiles were read. So every pubkey it counts as known already has a name, or the npub fallback the
       lookup settled on.
     - Story 2's "once, already named" still holds after a viewer change. The first lookup still holds the cards
       back (`names.key !== null`), and a known pubkey already has its name.
     - One edge: if the post-save lookup fails, an Assistant that isn't one of the person's can change from its looked-up
       name to its npub when the empty result replaces `names.profiles`.
   - Asked in the rework: log both, one line each.
6. **The toast and the partial report mount with their text already in them** (`ui/src/pages/treasure-map/Index.jsx:717`,
   `:476–478`).
   - Some screen readers don't announce a `role="status"` region that appears already filled. The `role="alert"`
     lines are more reliably announced.
   - This is the page's existing pattern. Optional: one always-mounted status region, which Blocking 2's fix could
     also use.
7. **A Map stamped far in the future can't be replaced until its time comes** (`ui/src/pages/treasure-map/saveTreasureMap.js:31–33`).
   - The new Map is stamped one second after it, as ADR 0005 says. This instance's relay refuses events more than
     900 s ahead (`setup/strfry.conf.template:24`), and many relays do the same.
   - So the save reads "failed" or "partial". That's inherent to replaceable events. Recorded only.
8. **A save that ends after the page is left starts a toast timer that nothing clears** (`ui/src/pages/treasure-map/useMapSave.js:86–88`
   against `:52`).
   - It's harmless in React 18. H12 left the page mid-save, then let it finish: no console errors.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **A refusal's own remedy was never checked** (proposed new ledger row, `meta`).
   - Blocking 1 passed Architecture and Test Design because the ADR named the check's sources but never asked whether
     "Reload the page" can clear the refusal.
   - The test plan drove the refusal (SV4), not the remedy.
   - Fix shape: in the ADR template or workflow 2, a guard that refuses says how the person gets past it. The test plan
     drives that remedy once (refuse, do what the words say, then succeed).
   - This is close to `2026-09-22-rule-stories-need-bypass-probing`, but that row covers bypasses of a deny rule, not
     dead ends behind one.
2. **A coverage-map row credited a criterion with a clause no test pins** (Blocking 2).
   - AC-10's row lists tests for the roles, and nothing for "Saving…".
   - Existing row `2026-10-01-test-plan-credits-unpinned-behaviour` covers this. I'd add a "Seen again" line, since it
     names § Edge cases bullets and this one is a coverage-map row.
3. **Already covered, nothing new:**
   - The Implementer's build and gate again came from an uncommitted tree (`c852b926+dirty`). My clean rebuild matched
     the hash, so `2026-10-07-built-ui-records-no-commit` covers it.
   - The timing-flake row didn't trip, because every run here ran alone.
   - The final heading is "Close-out on a pass", so `2026-10-07-on-pass-heading-reads-as-verdict` didn't bite.

## Verdict

**CHANGES_REQUESTED**

Most of the diff is right, and well tested.
- The save sequence is pure and follows ADR 0005's order.
- `useMapSave` is the only signer and publisher.
- What is signed is exactly the edited Map: every tag the edit doesn't change keeps its bytes and its place, on a
  generator-shaped Map with unknown tags and extra elements.
- The three outcomes, the three refusals, the no-Map case, book decision 18, focus and 375 px all hold.
- The gate passes (5120 passed, 0 failed). The seven browser specs pass (104, and 312 over three repeats). The report's
  other callers are unchanged (44 passed).
- The carve-out is clean, and every re-aim keeps its intent.

Three things block a story that signs and publishes:
1. **The newer-Map check can leave Save refused for good.** That includes after the app's own relays-only save, and the
   reload it asks for can't clear it. This needs an ADR amendment and the owner's nod.
2. **AC-10's "Saving…" is never announced,** and no test asks for it.
3. **AC-2's "nothing is signed when the signed-in person has changed" doesn't hold mid-save.** Signing out during the
   signer prompt still signs and publishes, and the stale answer still ends Edit.

Each has a concrete fix and a test to pin it.

## Round 2 (2026-10-08)

**Diff:** `git diff 8e78767c..HEAD` (head `c41c171f`; 5 commits, 11 files), reviewed on a clean tree at `c41c171f`.
- `901132eb` is the book and the story:
  - book decision 19, with the owner's "Let’s do 1 A.";
  - the story's AC-2, AC-5, AC-10, § Copy and § Out of scope;
  - a superseded note on gate item 2.
- `1a5abeb4` is ADR 0005 Amendment 1.
- `5de101f6` is the Tester's Amendment 1, before code: Q6, Q12, W1 and S2 in the Node suite; SV4 re-aimed and SV12–SV16
  in the spec; the plan.
- `3dea23f9` is the Tester's two corrections to SV4, found in Phase 4, and the plan's note on them.
- `c41c171f` is the Implementer's fix: `saveTreasureMap.js`, `useMapSave.js`, `Index.jsx`, `manageTreasureMap.js` (the
  words), one rule in `styles.css`, and the story's § Deviations.

I reran round 1's probes against the fixed page and added probes for book decision 19's edges. I also made two mutation
builds. None of this is committed.

### Gate results (run by reviewer, not trusted)

- [x] `GATE_LABEL=tme5-review-r2 npm test`, alone on the machine, read with
  `npm run -s gate:status -- --label tme5-review-r2`:

  ```
  20261008T212125Z-5503-a3f6 [tme5-review-r2] started 2026-10-08T21:21:25.064Z on c41c171f — PASS, exit 0, 5121 passed, 0 failed, 581 skipped, 276/276 suites
  ```

  - 5121 is round 1's 5120 plus Q12.
  - Per suite:
    - `treasure-map-save` 24/24, `treasure-map-switches` 34/34, `treasure-map-edit-mode` 47/47;
    - `manage-treasure-map-page` 22 passed and 2 live skips;
    - `manage-treasure-map-cards` 31/31, `treasure-map-card-rule-edges` 29/29.
  - The report's other callers: `my-assistants-map` 14/14, `assistant-taggings-publish` 19 passed and 1 live skip,
    `assistant-identification-tags-page` 16/16.
  - The Implementer's cited run, `20261008T211515Z-8568-f755 [tme5-r2-p4]`, exists. It passed with 5121, but on
    `5de101f6+dirty`, before the corrections and the fix were committed. The run above is the one tied to the commit.
- [x] **Build tied to the commit.** `npm run build` in `ui/`, from the clean tree at `c41c171f`, gave `index-k4iWpdGU.js`.
  That's the bundle `dist/index.html` names and :7799 serves. The tree was still clean afterwards.
- [x] **Browser,** the seven specs, `--project=chromium`, against :7799, with nothing else running:
  - one run: **109 passed (1.1m)**, which is round 1's 104 plus SV12–SV16;
  - `--repeat-each=3`: **327 passed (3.1m)**.
- [x] **The report's other callers in the browser:** `my-assistants-actions`, `assistant-identification-tags-page` and
  `assistant-taggings-publish` give **44 passed (54.1s)**. `taggingPublishReport.js` is untouched this round.
- [x] **The Tester's recorded verification reproduces.** I built `8536ae26`'s `ui/` in a scratch tree. It gave round 1's
  bundle, `index-pOBamNJw.js`, which I served on :7801.
  - **The Node suite** at `HEAD`, against `8536ae26`'s source: 20 passed, 4 failed. Each failure is the plan's reason:
    - Q6: no `latest` on the answer;
    - Q12: `saved` where `stale` is due;
    - W1: the old words;
    - S2: no `getSessionPubkey`.
  - **The spec** at `HEAD`: 6 failed, 13 passed.
    - SV4, SV12 and SV13 get the old reload words.
    - SV14 signed 1, want 0. SV16 signed 2, want 1.
    - SV15 finds no region saying "Saving…".
    - The plan's run used `5de101f6`'s SV4. `3dea23f9`'s SV4 fails at the same line.
- [x] `bash scripts/harness-lint.sh` reported `harness-lint: clean (0 violations)` before this section was added.

### Carve-out and the Phase-4 corrections

- **The carve-out holds.**
  - `5de101f6` touches only `test/treasure-map-save.test.js`, `tests/brainstorm/treasure-map-save.spec.js` and the
    test plan.
  - `3dea23f9` touches only the spec and the plan.
  - `c41c171f` touches no test file.
- **Amendment 1 weakens nothing.**
  - The spec's removed lines are:
    - the old words;
    - setup lines that grew: the signer modes, the state, and the `getPublicKey` stub;
    - SV4's re-aimed lines.

    SV4's "Will be assigned to Bea" check is back with a message, and its focus check moved (below).
  - SV1–SV3 and SV5–SV11 are byte-identical.
  - In the Node suite, Q6 and S2 only gain checks, and W1 takes decision 19's words.
- **SV4's two corrections are genuine test faults.**
  - **`30385:new` is a Scores entry.**
    - `appliesTo` reads slot `30385` as a Scores kind, 30380–30389 (`manageTreasureMap.js:188`).
    - `roleOf` makes a key with one segment that isn't a system word `own` (`editTreasureMap.js:30–37`).
    - So the pending Scores → Bea moves it to Bea, and the first SV4 asserted the wrong behaviour.
    - `31234` is in no category's range, so `31234:new` has no role and must survive untouched. That keeps the test's
      intent. The signed-tags check still pins the order and Scores → Bea.
  - **The focus check had moved after the test's own clicks.**
    - `publishedTags` and `draftTags` click the viewers' toggles, which takes focus.
    - My first probe of a second "changed" made the same mistake and read focus on "Hide the raw Treasure Map".
    - Read before any viewer opens, focus is on Save changes (E4b below). Moving the check back to round 1's place
      weakens nothing.
  - Who ratifies them is ledger `2026-10-08-new-browser-spec-amendments-unratified` again (Harness friction 1).

### Round-1 findings, re-checked

Each was measured on `c41c171f`, with round 1's probes rerun and new ones added.

- **Blocking 1, fixed** (book decision 19; ADR 0005 Amendment 1, item 1).
  - **The fix:**
    - the `'changed'` answer carries the newer Map (`saveTreasureMap.js:86`);
    - `useMapSave` keeps it as `shown` (`useMapSave.js:98`);
    - the page shows `shown` and builds the edit on it (`Index.jsx:675–678`);
    - `onSave` doesn't finish the edit on `'changed'` (`:700`).
  - **H3, in round 1's shape.** An outside relay holds a newer Map that names Cy for Scores. This instance's relay holds
    the old one.
    - **The first Save** signs, writes and sends nothing.
      - The alert reads decision 19's words exactly.
      - Edit stays on, and focus is on Save changes.
    - **The newer Map is shown.**
      - The raw viewer shows it.
      - With Edit off, the cards show it too: Scores is Cy; Lists and Concepts are not assigned.
      - The edited Map is built on it: `30382:rank` → Bea, with `3038x` → Bea appended.
      - The Scores card still reads "Will be assigned to Bea", and Save is on.
    - **The second Save** signs once, stamped now, which is later than the newer Map. It goes to this instance's relay
      and all five outside relays.
    - **After a reload,** the page shows the signed Map, and a further edit saves straight away.
  - **H4, in round 1's shape.** A relays-only save, then a reload with this instance's relay healthy, an edit, and Save.
    - After the reload, the page shows the old Map.
    - Save shows the relays-only Map once, with Lists → Cy kept.
    - The next Save signs on top of it, later than it. It keeps Scores → Bea and adds Lists → Cy.
    - Without a reload, a second edit saves straight away (H4b).
  - **SV12 and SV13** drive `readLatestMap`'s relay branch, as round 1 asked.
- **Blocking 2, fixed** (Amendment 1, item 3).
  - **Before Save, the page has four `aria-live` regions,** none with a role:
    - the partial-report container (`Index.jsx:636`);
    - the save note;
    - the "Saving…" span (`:590`);
    - the toast container (`:725`).

    All are empty except the save note.
  - **Each existed before its words.** I tagged every region before pressing Save. Afterwards:
    - "Saving…" is in the tagged span;
    - "Treasure Map updated" is in the tagged toast container;
    - a partial report is in the tagged section container.
  - Focus still falls to `<body>` while busy, because the button is disabled. The span now announces "Saving…".
  - **No new roles.** Round 1's build and this one have the same counts of `status`, `alert`, `region`, `note` and
    `switch` in four states: loaded, editing, toast and partial.
    - Only the `aria-live` count grows: 0 → 2 when loaded, 1 → 4 while editing.
    - The neighbour suites pass.
- **Blocking 3, fixed** (Amendment 1, item 2).
  - **The check.** `isCurrent` is `mine === latest.current && getSessionPubkey() === viewer` (`useMapSave.js:63`). It is
    checked after the newer-Map read (`saveTreasureMap.js:87–88`) and again after signing (`:106`).
  - **The session mirror.** `getSessionPubkey` returns AuthContext's copy of `user.pubkey` (`AuthContext.jsx:39–41`).
    It's set in the same commit as the viewer change, so it is never null while someone is signed in.
  - **H5a:** sign out while `getPublicKey` is held, then release it.
    - `signEvent` is never called.
    - Nothing is written or sent, no toast shows, and the console has no errors.
  - **H5b:** sign out while `signEvent` is held (after the first check), then release it.
    - The signer signs, because its prompt was already open.
    - The page drops the signature: nothing is written or sent.
  - **H5c:** with the first prompt held, sign out and back in as the same person, then Edit, pick and Save. Then
    release the old prompt.
    - One Map is signed and written, with no alert, and Edit is unchanged.
    - The viewer change resets the `running` ref (`useMapSave.js:52`), so the old save doesn't block the new one.
  - **`onSave` acts only on `answer.current`** (`Index.jsx:700`).
- **Non-blocking 2 (the double call), fixed** (item 4). H1 tried a real double click, and three `click()` calls in one
  script task.
  - Each gives one `getPublicKey`, one `signEvent` and one write.
  - Edit is usable afterwards.
- **Non-blocking 5 (deviations), fixed.** The story's § Deviations (`:165–172`) records `reportLines` and the
  names-ready rule, accurately. ADR Amendment 1, item 5, accepts both.
- **Non-blocking 6 (live regions), fixed** with Blocking 2.
- **Non-blocking 1, 3, 4, 7 and 8:** not taken, as the ADR amendment says (ADR 0005 `:321–326`). Nothing carries them, though
  (non-blocking 3 below).

### Book decision 19's edges

- **The newer Map makes the change a no-op** (E1: it already gives Scores and its family to Bea).
  - Nothing is signed, and the alert reads decision 19's words.
  - Save is off, and the note says "No changes yet".
  - Focus is on `<body>` (non-blocking 1).
- **An override whose duties are gone in the newer Map** (E2).
  - The Scores switch disappears, and Save stays on for the assignment.
  - The signed Map is the newer one with Scores → Bea. Nothing else is removed.
- **An override, and the newer Map has more duties** (E2c).
  - The switch, still on, now reads "Override 3 individually assigned duties", and the save removes all three.
  - That's decision 19's "overrides … apply to the newer Map", and the new count shows before the second Save.
- **The backup switch, and no backups are left** (E2b): the switch disappears, and the edit becomes a no-op, as in E1.
- **The person's own relays-only save as the newer Map:** H4 above.
- **A second "changed" in a row** (E4, E4b).
  - The second newer Map is shown.
  - The alert is a new node each time, so it's announced again, and focus is on Save changes each time.
  - The third press saves, later than the second newer Map and keeping its own entry.
- **No Map found, and one appears at Save** (E7).
  - The page shows it, the no-Map warning goes, and the change is kept.
  - The next Save signs on top of it.
- **A newer 10040 by someone else on an outside relay** is ignored, and Save goes straight through (E9).
- **Two Maps at the same second** (E5): the sort is stable, so this instance's relay's Map comes first. That's the one
  the page shows, so Save goes straight through.
- **A newer Map that names an Assistant never looked up** (E6, E6b).
  - The section drops to the loading line while the names are looked up. That unmounts Save, and focus falls to
    `<body>` (non-blocking 1).
  - If the Assistant is one of the person's, focus is right (E6c).
- **Widths.** Decision 19's longer words fit. The alert spans 16…304 at 320 px and 16…359 at 375 px. The 24 px of
  sideways scroll at 320 px is ledger `2026-10-08-top-bar-scrolls-sideways-at-320`.
- **Signatures.**
  - The non-strict read of `/api/relay/external` uses nostr-tools 2.10.4's `SimplePool`, whose constructor always
    passes `verifyEvent`.
  - strfry checks signatures on write.
  - So a relay can't forge a "newer Map" for the page to adopt.

### Amendment 1, item by item

| Item | Code | Holds? |
|---|---|---|
| 1. `latest` on the `'changed'` answer | `saveTreasureMap.js:86` | Yes (Q6) |
| 1. `saved` becomes `shown` | `useMapSave.js:24`, `:98`; `Index.jsx:675–678` | Yes |
| 1. No `finish()` after `'changed'` | `Index.jsx:700` | Yes |
| 2. `isCurrent`, checked twice | `saveTreasureMap.js:87–88`, `:106` | Yes (H5a, H5b) |
| 2. `isCurrent`'s definition | `useMapSave.js:63` | Yes, word for word |
| 2. Only current answers act | `useMapSave.js:84–90`, `:104`; `Index.jsx:700` | Yes, with one unrecorded deviation (non-blocking 4) |
| 3. The "Saving…" span, always there in Edit mode | `Index.jsx:589–590` | Yes |
| 3. The toast container: page level, polite, atomic | `Index.jsx:724–727`, `styles.css:10378` | Yes. Its zero-height class isn't in the ADR, and it's harmless. |
| 3. The partial-report container, at the top of the section | `Index.jsx:635–640` | Yes |
| 3. The containers carry no role | — | Yes (role counts above) |
| 4. The busy ref | `useMapSave.js:47`, `:52`, `:59–61` | Yes. It's named `running`, and a viewer change also resets it, which H5c needs. |
| 5. The recorded deviations | story `:165–172` | Yes |

### House rules

- **No `taPubkey` and no 64-hex literal** in the source diff (grepped; S2 checks `useMapSave.js`).
- **Only the viewer's Map.** Step 1 of the sequence is unchanged, and `readLatestMap` keeps only the viewer's 10040s
  (E9).
- **Nothing signs without a click.** `'changed'` signs nothing, and the next Save takes a second click. E15 and V12
  still pass.
- **CLAUDE.md principle 4, now with the newer Map as the base** (E8).
  - **The setup:** an outside relay holds a newer Map in round 1's H8 shape. It has 24 tags:
    - eleven `30382:<metric>` rows;
    - a backup with extra elements;
    - `alt`, `p`, `e`, `client` and `emoji` tags;
    - an invalid delegate.

    It also has content. The edit is Lists → Bea, then Save, then Save.
  - **The signed Map** differs from the newer one only at index 13 (`30392` → Bea) and in the appended `3039x`. The
    content is kept.
  - This instance's relay and all five outside relays got exactly the signed tags.
- **The words** are book decision 19's and the story's § Copy, exactly. I checked them with a wrap-normalised script and
  against the alert's text in H3.
- No new dependency or tooling.

### Findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **After "changed", focus can fall to `<body>`** (`Index.jsx:406–414`, against `:461–462` and `:595`; AC-10).
   - The focus effect runs once, at the outcome's render, and focuses Save changes. Two of decision 19's states leave it
     nothing to focus:
     - **The newer Map makes the change a no-op** (E1, E2b). Save is off. The alert still says "check them and save
       again", beside "No changes yet".
     - **The newer Map names an Assistant that is neither in the old Map nor one of the person's** (E6).
       - The names-ready rule (`:450–452`) sends the section to the loading line, which unmounts Save.
       - When the cards return, the outcome has already been seen, so nothing moves focus.
       - One Tab then lands on Assign to all.
   - Either way the alert is announced, nothing is lost, and Save still works.
   - AC-10's "focus stays on Save changes" can't hold in the first state, and is missed in the second.
   - Optional fixes:
     - focus Edit, or the alert, when Save is off;
     - run the focus effect when Save next mounts.
   - Story 5 is the epic's last, so a ledger `bug` row is warranted.
2. **Three of the amendment's guarantees have no test that would catch their loss.** I checked each by hand above, so
   today's code is right.
   - **SV15 doesn't pin "there before the save"** (`treasure-map-save.spec.js:587–598`), though its title and the plan's
     row (`5-save-the-edited-map.test-plan.md:162`) say it does.
     - It counts regions whose text is exactly "Saving…", which is 0 before Save on any build.
     - I built a mutation that mounts the span only while busy (`{busy && <span aria-live="polite">…}`). SV15 and SV3
       both pass on it.
   - **Nothing tests the toast and partial-report containers.** Round 1's build has neither, and SV2, SV5 and SV6 pass
     on it.
   - **Q12 doesn't pin that the second `isCurrent` check comes after signing** (`test/treasure-map-save.test.js:325–340`).
     - With both checks moved before `sign`, the whole Node suite passes.
     - No browser case holds `signEvent`; SV14 holds `getPublicKey`.
   - Optional fixes:
     - SV15 tags the region before Save and checks that the same node says "Saving…". The toast and the partial report
       get the same check.
     - Q12 records the call order (`sign` before the second `isCurrent`), or a browser case holds `signEvent`, as H5b
       did.
3. **Four places where the docs say more than the code or the record.**
   - **The ADR says round 1's non-blocking 1, 3, 4, 7 and 8 are "carried in the epic for later"** (ADR 0005 `:321`).
     The epic wasn't touched this round, and story 5 is its last story. Round 1's findings record them, but no open
     surface does.
   - **The story's § Linked artifacts** lists book decisions 3, 9, 12, 14, 15, 17 and 18 (story `:175`), but not 19.
   - **AC-10 says every outcome message is "in a live region that is on the page before its words arrive"** (story `:97–98`).
     - The refusal alerts and the failed report mount with their words as `role="alert"` (`Index.jsx:602–607`). Screen
       readers announce those on insertion.
     - The amendment's item 3 lists only the three status regions.
     - The behaviour is sound; the sentence claims more than the design does.
   - **AC-2 says nothing is signed once the person has signed out mid-save** (story `:51–52`). A `signEvent` prompt that is
     already open can still be approved in the extension after sign-out. The page then drops the signature (H5b), as
     the amendment's item 2 designs.
   - **Asked in the close-out commit:**
     - carry the five items not taken, as ledger rows or in the epic;
     - add decision 19 to § Linked artifacts;
     - narrow the AC-10 and AC-2 sentences, or record them in § Deviations.
4. **One unrecorded deviation from the amendment's item 2** (`useMapSave.js:86–88`).
   - The ADR says `save` "changes its state only for a current answer".
   - The code also clears `busy` for a stale answer that is still the latest save. That happens only if the session
     pubkey changes without a viewer change.
   - It's sound, since otherwise Save would read "Saving…" for good. It's also practically unreachable, because
     AuthContext sets both in one commit.
   - One line in § Deviations would do.

#### Harness friction

1. **Phase-4 corrections to a spec were self-ratified again.**
   - `3dea23f9`'s two SV4 fixes were found against the fixed page, made in the Tester's role during Phase 4.
   - Both are genuine faults, and I ratify them by the audit above.
   - This is ledger `2026-10-08-new-browser-spec-amendments-unratified` again, now for an amendment's new cases rather
     than a new page. It warrants a "Seen again" line.
2. **A test's title and its plan row claim what its assertion doesn't pin** (non-blocking 2: SV15's "there before the
   save", and Q12's "after signing").
   - This is ledger `2026-10-01-test-plan-credits-unpinned-behaviour`, its third sighting, now in test titles.
   - It warrants a "Seen again" line. The fix shape's spot-check could cover an amendment's new tests too.
3. **Already covered, nothing new.**
   - The Implementer's gate ran on an uncommitted tree (`5de101f6+dirty`), and my clean rebuild matched. Existing row
     `2026-10-07-built-ui-records-no-commit` covers it.
   - The timing-flake row didn't trip, because everything ran alone.

### Verdict

All three round-1 blocking findings are fixed at their cause. I reproduced each the way round 1 found it.
- A newer Map held only by outside relays, or by the person's own relays-only save, is shown with the changes on top.
  The next Save succeeds, and no reload is needed.
- "Saving…", "Treasure Map updated" and the partial report each arrive in a live region that was already on the page,
  and no new roles appear.
- Signing out mid-save signs and publishes nothing from the `getPublicKey` prompt. From an open `signEvent` prompt,
  nothing is published. A stale answer never acts.

Book decision 19 behaves as the owner chose, through its edges. Principle 4 holds with the newer Map as the base. The
code follows the ADR amendment item by item, with one small unrecorded deviation. The carve-out holds, and SV4's two
corrections fix genuine test faults.

The committed tree passes the gate (5121 passed, 0 failed) and the seven browser specs (109 once, and 327 over three
repeats). What remains is non-blocking:
- focus in two edge states;
- three test gaps, behind behaviour I verified by hand;
- doc wording for the close-out commit.

**PASS** — the round-1 blocking findings are resolved, and no blocking issue remains.

## Close-out on a pass

- [x] Story Status flipped to Done, in round 2's review commit. Round 2's non-blocking findings are handled there:
  - 1 is ledger `2026-10-08-treasure-map-focus-after-newer-map`;
  - 2 is a "Seen again" on `2026-10-01-test-plan-credits-unpinned-behaviour`;
  - 3's wording is fixed in the story (AC-2, AC-10, linked decision 19) and the ADR (the carry now names ledger
    `2026-10-08-treasure-map-save-hardening`);
  - 4 is recorded here.

  Round 1's non-blocking 1, 3, 4, 7 and 8 are ledger `2026-10-08-treasure-map-save-hardening`. The Phase-4 SV4
  corrections are a "Seen again" on `2026-10-08-new-browser-spec-amendments-unratified`.
- [x] Completion detection: run. Every story in the book is Done (1–5), and every acceptance-frame item but one is
  met. "Shipped to staging" remains, so the book closes after the staging ship (`/cycle-staging`), on the owner's
  go.
