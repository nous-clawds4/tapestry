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

## Close-out on a pass

- [ ] Story Status flipped to Done (the orchestrator does it in the review commit)
- [ ] Completion detection (the orchestrator)
