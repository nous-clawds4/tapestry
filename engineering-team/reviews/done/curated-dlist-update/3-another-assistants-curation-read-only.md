# Review: Story 3 — Another assistant's curation opens read-only, with an offer to curate it here

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-12
**Diff:** `git diff ff2d8641 85dc9d01` (commit `85dc9d01`, 10 files). Context, read and not under review: `c2198034`
story, `8c48e83f` ADR 0003, `ff2d8641` failing tests. `git diff --stat ff2d8641 85dc9d01 -- test/` is empty: the
implementation commit touches no test.

- Story: `engineering-team/stories/done/curated-dlist-update/3-another-assistants-curation-read-only.md`
- ADR: `engineering-team/decisions/done/curated-dlist-update/0003-read-only-curation-and-curate-here.md`
- Test plan: `engineering-team/stories/done/curated-dlist-update/3-another-assistants-curation-read-only.test-plan.md`
- Upstream contract: `curated-dlist-update` ADR 0001 Decision §8 (`decisions/done/curated-dlist-update/0001-curation-copy-convention.md:43–46`);
  `protocols/drafts/assistant-designation.md` § "Across instances" (`:80`) and § "Per-DList curation entries",
  element 3 (`:62`); `engineering-team/epics/curated-dlist-update.md`.

> **At a glance.** No blocking items. Two findings to decide on before this book merges:
> - **Non-blocking 1: a latent bug in ADR 0003 itself.** The offer checks the list's kind, but not the kind or d-tag
>   of the shared header it targets. A curating header that breaks the spec's "same d-tag" rule makes the offer have
>   the user sign a Map entry pointing at a header that does not exist. That breaks the spec's MUST at
>   `assistant-designation.md:74`. The code does exactly what ADR §5 says, so this is not drift. The fix is a
>   two-condition guard via a small ADR amendment, best done in story 5's Option C consolidation.
> - **Non-blocking 2: docs.** `my-curated-dlists` ADR 0002 still says the detail page performs one write (`:107`,
>   `:142`). The offer adds two more. ADR 0003 §8 did not list this ADR, so it needs one more "Superseded in part"
>   note.

## Quality gates (run by reviewer, not trusted)

- [x] **The six story suites**, each through its exported `run()` (node v24.18.0; OPEN.md row 310's method): **101
      passed, 0 failed**:
      - `curated-dlist-update-read-only-curation` 13/0
      - `my-curated-dlists-page` 19/0
      - `my-curated-dlists-headers` 16/0
      - `my-curated-dlists-items` 23/0
      - `dlist-curation-panel` 18/0
      - `curated-dlist-update-pointer-switch` 12/0
- [x] **The seven neighbouring suites the Implementer named**, through `run()`: **130 passed, 0 failed**:
      - `dlist-curation-map-entries` 14/0
      - `dlist-curation-tl-panel` 19/0
      - `dlist-curation-merge-preserve` 16/0
      - `tl-treasure-map-panel` 18/0
      - `treasure-map-panel-summary` 18/0
      - `tl-treasure-map-optin-publish` 23/0
      - `treasure-map-relay-sync` 22/0

      Together that is 231/0, matching the Implementer's count.
- [x] **The tests fail without the change.** I ran the six story suites against a read-only `git archive` snapshot of
      `ff2d8641` in the scratchpad (the tests commit, before the implementation). Results:
      - the new suite 2/11: U1–U4, S1–S6 and D1 fail; R1 and R2 pass;
      - page 16/3;
      - headers 15/1;
      - items 23/0;
      - panel 18/0;
      - pointer-switch 12/0.

      This is exactly the test plan's § Verification. My first snapshot left out `BIBLE.md`, which made
      pointer-switch D2 fail for a reason that has nothing to do with the code (Harness friction 4).
- [x] **Full `npm test`**, 17:38–18:26 (48 minutes), with output to a scratchpad file. `BRAINSTORM_PUBLISH_LOCAL_ONLY`
      was unset, and the publish posture was not changed.
      - **Suites:** 174 suite lines: 167 PASS, 4 SKIP, 3 FAIL.
        - SKIP (preconditions not met): `tag-detail-publish`, `tag-index-publish`, `authored-tagging-publish`,
          `profile-tag-polish-publish`.
        - FAIL: `tl-membership-method-selector`, `tl-weighted-sum-method`, `tl-certainty-method`.
      - **Failing tests:** exactly four — the three L0 GUARD refusals and the refused LP prune. These are OPEN.md row
        191's four.
      - **Row 261:** both LB matrices skipped (Meili indexing did not settle in budget); they did not fail.
      - **This story's area:** all 16 treasure-map, dlist-curation, my-curated-dlists and curated-dlist-update suites
        PASS, including the new suite (13/0).
      - **Overall:** `FAIL`, exit 1, from those known reds only.

      Story 2's review counted 173 suite lines and 166 PASS; the new suite is the 174th. The Implementer's "169
      green" presumably counts another way, but the reds are the same. As in the Implementer's run, the live
      publish-flow suites exercised the stack's publish paths under the operator's external-publish posture.
- [x] **`bash scripts/harness-lint.sh`** at `85dc9d01` → `harness-lint: clean (0 violations)`. The rest of the output
      is the standing WAIVED/INFO lines. Once this review is saved, rule L1 is expected to report the story until its
      Status reads `Done` (§ On PASS).
- [x] **`npm run test:playwright`**: not applicable, because the test plan has no Playwright half. A headless
      read-only render stood in for it (§ Live checks).
- [x] **Hygiene.**
      - `git diff --check ff2d8641 85dc9d01` is clean.
      - No added line carries a 64-hex literal or a known pubkey prefix (`82b75e47`, `11f23fe4`, `253d40c4`,
        `8e901369`, `0f6c8526`).
      - No `console.log`, `debugger`, `TODO` or commented-out code was added.
      - No `dangerouslySetInnerHTML` appears in the six JSX files.
      - No dependency, lockfile or `src/` file changed.
- [x] _Lint / typecheck / build not configured — skipped._ No new tooling.

## Live checks (read-only)

1. **Served bundle.** `:7778` serves `index-DoGZ9xj1.js`. It contains all 13 new strings I checked, among them:
   "Curate it here instead", "Opens read-only here.", "…view these lists here but not curate them", "only its own
   assistant can upgrade it", "Update list runs only on the instance where this list", "Map update: replaces",
   "Continuing has your assistant here write its own header", "with a different link; it was not changed." and "this
   instance curates only kind-39998 lists". It contains none of the four retired strings: "Only lists your own
   assistant curates open here", "none of these lists open here", "so no curated DList opens here" and "is empowered
   for another pubkey". `docker inspect tapestry` shows only the four named volumes, with no bind mount, as the
   story's Deviations say.
2. **Headless render.** I used playwright 1.56.1 with `executablePath` pointed at the cached chromium-1228 (OPEN.md
   row 232's workaround). The scripts live in the scratchpad.
   - **Stubbed:**
     - `/api/auth/status` and `/api/auth/user-classification`: staging's customer `0f6c8526…`, with three values for
       `assistantPubkey`:
       - none;
       - a synthetic 64-hex key;
       - the curating assistant's own key, read at runtime from the Map.
     - In scenario D only: the TA page's kind-10040 local scan, which served the real Map (row 260).
     - The header endpoint, in armed steps only.
   - **Real:**
     - The customer's Map (`7060f7ae…`, 4 tags), found on a general-purpose relay. It names `253d40c4…6ec0` @
       `wss://dcosl.brainstorm.world` for `39998:dog-breed`.
     - The curating header (`adcc9abc…`, in local strfry). It links with `inherit-items` to
       `39998:11f23fe4…3767:dog-breed`.
     - The items and the shared header.
   - **Safety:**
     - A context-wide route guard aborted every non-GET request except read-only cypher (write keywords were refused)
       and the header endpoint in armed steps. Nothing was aborted.
     - There was no `window.nostr`, and Sign & publish was never pressed.
     - Exactly one request reached the real header endpoint. It carried no session cookie, and the server refused it
       with "Authentication required for this action".
     - No page errors occurred.
   - **Results:** 58/58 checks. The first run passed 51; its one failure was my own locator for the panel toggle. A
     D-only rerun with the aria-label locator passed its 7.
     - **B — no assistant here.**
       - List page: the page line, exact; every row a link; no per-row note; the badge "another pubkey ·
         253d40c4…6ec0".
       - Detail page:
         - "39998:dog-breed · curated by another assistant · 253d40c4…6ec0";
         - the no-assistant read-only line, exact;
         - the reason "You can't curate it here: you don't have a Tapestry Assistant on this instance.", and no
           offer;
         - "Its assistant's DList header" · "Authored by the curating assistant · 253d40c4…6ec0" · "(older link)" ·
           "It uses the older link type; only its own assistant can upgrade it.";
         - the method line, and no method panel;
         - Update disabled, with its read-only line and no offer sentence;
         - no "Update list will upgrade it".
     - **A — another key as my assistant here.**
       - List page: "Opens read-only here." on the row.
       - Detail page: the read-only line, exact; the offer button; Update's line ends "You can curate it here
         instead."
       - No header request before any click.
       - The words: all three sentences, exact. Still nothing sent; Cancel at the words sends nothing.
       - Continue sends exactly one POST, `{"target":"39998:11f23fe4…:dog-breed"}`, which is the curating header's
         pointer. The real 401 is shown, and the flow returns to the button.
       - A stubbed 409 shows the sentence and the existing `b`, and stops.
       - A stubbed 200 shows the review: "Header authored for dog-breed by your assistant." and "Map update: replaces
         253d40c4…6ec0's entry for 39998:dog-breed with your assistant @ wss://dcosl.brainstorm.world."
       - The preview: kind 10040, content kept, `created_at` bumped, the entry replaced in place as
         `["39998:dog-breed", <my assistant here>, <hint>]`, and the other three tags verbatim and in order.
       - Cancel at the review clears the flow. The `existing: true` stub reads "Header already existed…".
       - Header requests: exactly the four Continue clicks.
     - **C — the curating assistant's own key.** The list opens as mine with story 2's words: "curated by your
       assistant", "Your assistant's DList header" and "Authored by your assistant". The method panel is there, with
       "Update list isn't built yet." and my older-link note. There is no read-only line and no offer.
     - **D — the DList Curation panel (§7).**
       - Replace on `dog-breed` → "Map update: replaces 253d40c4…6ec0's entry for 39998:dog-breed with your assistant
         @ wss://dcosl.brainstorm.world.", followed by the two sentences, exact. There is no "adds" line, and the
         offer's third sentence does not appear.
       - A plain Add on `cat-breed` → "Map update: adds 39998:cat-breed → your assistant @ …", without the sentences.
   - **Not exercised:**
     - A real replacement. It needs a NIP-07 signer, and it signs and publishes, so it is the operator's.
     - AC-4's "after the Map is published, the list opens here as mine". By reading: `onPublished` is `map.refresh`
       (`CuratedDListDetail.jsx:95`); `useTreasureMap` re-reads the Map, whose first `39998:dog-breed` entry then names
       the viewer's assistant; `curatedDListAccess` returns `ok` (`treasureMap.js:353`). Scenario C renders that
       state.
     - `listRelay` against the default (Non-blocking 5).

## Spec adherence

| AC | Tests (all passing) | Code | Live | Result |
|---|---|---|---|---|
| AC-1 every empowered list opens | new U1, S1; page U6, S3 | `treasureMap.js:343–353`; `MyCuratedDLists.jsx:67`, `:71`, `:104`, `:111`, `:122` | B, A | Met |
| AC-2 the read-only page shows the curation | new U1, U4, S2, S3, S4; page U6, S4; headers R1 | `CuratedDListDetail.jsx:48–59`, `:77`, `:84–93`, `:97–121`; `CuratedDListHeaders.jsx:147–183`, `:186–200`; `CuratedDListItems.jsx:26–46`, `:102–118`, `:155–158`, `:184`; `treasureMap.js:646–652` | B, A | Met |
| AC-3 nothing on the page acts | new S2, S3, S4; headers S4 (the import unchanged) | `CuratedDListDetail.jsx:109–111`; `CuratedDListItems.jsx:73–82`; `CuratedDListHeaders.jsx:43–47`; import untouched (`:75–132`) | B, A | Met |
| AC-4 the offer | new U2, U3, S5, S2, S6 | `treasureMap.js:617–625`, `:632–638`; `CurateHereOffer.jsx:17–150`; `CuratedDListDetail.jsx:76`, `:94–96` | A | Met — with Non-blocking 1, an edge the ADR does not cover |
| AC-5 nothing else moves | new R1, R2, S6, D1; every other test in the re-aimed suites, and the items, panel and story-2 suites, unchanged and passing | no server file changed. On own lists `curatorPubkey` is the viewer's assistant (`CuratedDListDetail.jsx:52`) and `listRelay` is `COMMUNITY_RELAY` (`:77`) | C, D | Met |

The front door's other cases are unchanged. U1 sweeps 300 input combinations and never sees `no-assistant` or
`other-pubkey`, and live B/A/C confirm them.

## ADR adherence

| Note | As specified? | Where |
|---|---|---|
| 1 util | Yes | `curatedDListAccess` `treasureMap.js:343–353`: the `no-assistant` early return is gone, and the last line is `row.mine ? 'ok' : 'read-only'`. Precedence is unchanged. The JSDoc (`:331–339`) matches the code; the old JSDoc listed `checking` before `map-error`/`no-map`, which the code never did. `curateHereOffer` is at `:617–625` and `replacementSentences` at `:632–638`; both are pure and never throw (U2, U3). `itemsEmptySentence` takes `curator` (`:646–652`). |
| 2 list page | Yes | Every row is a `Link` (`MyCuratedDLists.jsx:104`). The badge is kept (`:111`). "Opens read-only here." shows only when the viewer has an assistant (`:71`, `:122`). The no-assistant line (`:67`). |
| 3 detail page | Yes | `SENTENCES` has lost both statuses (`:22–29`). Both lookups run for both open states, ahead of the early return (`:48–59`, `:62`). The rules of hooks hold: every hook precedes `if (!open)`, and `curateHereOffer` is a plain call after it. `describeCurationHeader(lookup.event, curatorPubkey)` (`:57`), where `curatorPubkey = access.row.pubkey` is the ADR's `row.pubkey`. Subtitle and the two lines (`:84–93`). `curator` on the three sections (`:97`, `:105`, `:118`). The method line in place of the panel (`:109–111`). `ItemsSection` gets `row.pubkey`, `listRelay` (the ws/wss hint only when read-only, `:77`) and `canCurateHere` (`:120`). The offer renders only when read-only (`:94–96`), with `mapEvent={map.event}` and `onPublished={map.refresh}`. |
| 4 headers | Yes | Title (`CuratedDListHeaders.jsx:179`); authorship and its ⚠️ variant (`:157–161`); `NOTE_SENTENCES['older-link']` keyed by `curator`, with my text unchanged (`:43–47`); the can't-tell sentences (`:187`, `:193`, `:199`). The import is unchanged (gate decision 1). |
| 5 items | Yes | `FROM_LABEL_OTHER` (`:28`); `UNAVAILABLE_REASON_OTHER` (`:40–46`); `UpdateListButton({ curator, canCurateHere })` (`:73–82`). The curated list is read at `listRelay` (`:108`), the candidates at `communityRelay` (`:109`). Notes and markers name the relay each read used (`:124`, `:128`, `:155`). Author and From cells (`:157–158`); the empty sentence (`:137`). |
| 6 the offer | Yes | Imports per the note (`CurateHereOffer.jsx:1–5`). The reason tails, all six exact (`:17–24`). All hooks come before the early returns (`:34–47` before `:49–52`). No `useEffect`; the only fetch is inside `handleContinue` (`:57–82`), which is bound to Continue (`:112`). `target = offer.target` (`:63`), the pointer's coordinate. The 409 sentence plus `b` (`:67`, `:145`); other failures show their message (`:72`, `:79`). The review (`:118–140`). `upsertDListEntry(mapEvent, 39998, row.d, assistantPubkey, relayHint)` (`:44`), with `relayHint` read as the panel reads it (`:34–35`). `getActiveSignerOrThrow` → `window.nostr.signEvent` → `publishOrThrow` → `reset` → `onPublished` (`:89–93`). A failure goes back to the review with its message (`:94–97`). Cancel (`:113`, `:138`). |
| 7 panel | Yes | `replaces` is set only when `byD.get(d)` names another pubkey (`DListCurationPanel.jsx:175–178`). The replace line plus `replacementSentences` (`:286–290`). A plain Add still says "adds" (`:292`). Nothing else moved: the import list (`:9`) and the `pending` comment (`:98`) are the only other edits. |
| 8 annotations | Yes (but see Non-blocking 2) | `done/my-curated-dlists/0001-…:3`, `:7`; `done/dlist-curation/0005-…:3`, `:7`. Each is in the house form: a Status parenthetical, plus "> **Superseded in part (2026-09-12):** … — `curated-dlist-update` ADR 0003", by short name and not by path (D1). Both are accurate against the code. |
| 9 local check | Yes (logged) | I repeated it independently (§ Live checks). |

**Details the ADR leaves open, judged.**
- **"Cancel at any step" (§5.6).** Cancel is offered at the two steps that wait for the user: the words and the
  review. While the request is in flight there is none, and while signing it is disabled (`:135–138`). That is the
  panel's own behaviour (`DListCurationPanel.jsx:312–315`). Accepted: a Cancel mid-request could not honour "changes
  nothing" in any case (Context, tension 1).
- **Tension 1, as implemented.** The third sentence says Continue writes a header and that the Map changes only on
  signing (`:110`). A header written at Continue stays after a Cancel, as the panel's Add does.
- **After publishing.** `reset()` runs before `onPublished()` (`:92–93`). The refresh sends the page through
  `checking`, which unmounts the offer, so no stale step survives.

**Logged deviations, judged.**
1. **Starting point: the Tester's sketch, copied unchanged.** Accepted. It does mean the tests and the code share one
   author, so I checked the code against the ADR and the spec line by line rather than leaning on the suite. That is
   how Non-blocking 1 surfaced (Harness friction 1). The sketch's worktree is gone, so "unchanged" cannot be checked;
   the only remaining worktree, `.claude/worktrees/pensive-euclid-ad798d`, is unrelated. That is immaterial, because
   the committed code is what I reviewed.
2. **`explainClosed` renamed `explainReadOnly`.** Accepted: it is a private prop, and its meaning changed.
3. **Nothing rendered while `checking`.** Accepted. §5 gives `checking` no sentence, and `canCurateHere` agrees: the
   Update line adds its offer sentence only once the offer is available.
4. **The headers module's opening comment.** Accepted; it is accurate (`CuratedDListHeaders.jsx:9–11`).
5. **The local check and the regression.** Reproduced (§ Quality gates, § Live checks).

**Unlogged, harmless.** `curatedDListAccess`'s JSDoc now states the precedence the code has always had.
`ItemsSection`'s `listRelay` defaults to `communityRelay`. The detail page's JSDoc names the offer's two writes. No
action.

**Layering.** Every rule is a pure util function. No new dependency, no new endpoint, and no server file changed.
Option C (a shared hook) was not taken, and ADR Consequences records that as debt.

## Concept-graph integrity
- [x] No concept, schema or property change. The orientation handles (`39998:<TA>:list`, `…:tapestry-assistant`,
      `…:shared-concept`) keep `kind:pubkey:slug` form.
- [x] Firmware reinstall is not required (ADR Consequences).
- [x] `/summaries`: not applicable (no concept code).

## Things tests can't catch
- [x] No secrets, no debug logging, no commented-out code.
- [x] **Error paths.** Every endpoint answer other than 200 stops the flow and shows its message: 401, 400, 404 and
      500 as text, and 409 as the ADR's sentence plus the `b` tags. This was exercised live for 401 and 409. A failed
      sign or publish leaves the Map untouched and returns to the review.
- [x] **Concurrency.** Continue disappears on click, and Sign & publish is disabled while signing. The Map update is
      recomputed from the Map on screen whenever it changes (`CurateHereOffer.jsx:42–47`). Non-blocking 3 covers
      *which* Map that is.
- [x] **Rendering safety.** Relay-derived strings (server errors, `b` tags, relay hints) reach the page only as React
      text.
- [x] **Security.**
      - No new endpoint (R2; no `src/` change).
      - The page can reach three writes, each on an explicit click:
        - the existing import;
        - the endpoint POST, on Continue;
        - the Map publish, on Sign & publish.

        Verified live: no request goes out before Continue, and the real endpoint refused a session-less call (401).
      - The endpoint signs with the caller's own assistant (`src/api/dlist-curation/index.js:243–249`) and takes
        kind-39998 targets only (`:256–258`).
      - The Map is signed by the viewer's extension, after `getActiveSignerOrThrow` has refused a drifted account
        (`ui/src/utils/signerGuard.js:55–60`).
      - Read hints are ws/wss-filtered on the client (`CuratedDListDetail.jsx:17`, `:77`; `treasureMap.js:398`,
        `:508`) and on the server (`src/api/relay/fetchEvents.js:39`).

## House rules check
- [x] Concept Graph API authority respected (no concept claims).
- [x] No new lint, typecheck or build tooling.
- [x] No hardcoded TA pubkey. No 64-hex literal was added, and `taPubkey` is not used. None of ADR 0015's `LEGACY_*`
      constants was touched. `CurateHereOffer` imports `publishOrThrow` from `publishProfileTag.js`, whose legacy
      literal predates this story and is not on this path.
- [x] **The four invariants:**
      1. POV: nothing is scored, and nothing is stored.
      2. Accept all signed events; filter at read time. The read-only view reads the curating assistant's header and
         items ungated. The only thing that chooses which assistant is shown is the viewer's own Map (first entry
         wins). The offer composes only the viewer's own Map (`upsertDListEntry` on `map.event`), signed by the
         viewer's extension. The other assistant's header and copies are untouched.
      3. Nothing is denormalized.
      4. No graph write: no cypher write. The header (via the endpoint) and the Map (via the extension) are letters.

## Product-guide adherence *(when the story traces to a PRD)*
Not applicable: this book has no PRD (acceptance frame). The copy is ADR 0003's, verbatim; the S-class pins it, and it
rendered that way live.

## Findings

### Blocking
None.

### Non-blocking
1. **Latent bug at the ADR level: the offer never checks that the shared header it targets can be curated under the
   same list.**
   - **What the code checks.** `curateHereOffer` (`ui/src/utils/treasureMap.js:617–625`) checks the list's kind
     (`row.kind`) and that the curating header names *some* pointer. `communityPointerOf` (`:260–266`) accepts any
     `<kind>:<hex64>:<d>`.
   - **What the offer then does.**
     - It POSTs `target = info.pointer.coord` (`CurateHereOffer.jsx:63`), and the endpoint authors the viewer's
       assistant's header with the *target's* d-tag (`src/api/dlist-curation/index.js:107–109`).
     - It writes the Map entry under the *entry's* d-tag, `row.d` (`CurateHereOffer.jsx:44`).
     - It says "Header authored for `<row.d>`" (`:120`).
   - **Demonstrated with the shipped functions** (pure calls, in the scratchpad):
     - **A conforming header** (its pointer's d-tag equals its own): the offer is available; the endpoint's header is
       d `dog-breed`; the Map entry `39998:dog-breed` names mine. Correct.
     - **A `dog-breed` header pointing at `39998:<author>:dogs`:** the offer is available. The endpoint would author
       `39998:<mine>:dogs`, but the Map update re-points `39998:dog-breed` at `39998:<mine>:dog-breed`, which does not
       exist. That breaks "A writer MUST publish the header before the Map entry that addresses it"
       (`protocols/drafts/assistant-designation.md:74`). The user would sign a Map that drops the other assistant's
       curation of the list and points at nothing, after a review line that names the wrong d-tag.
     - **A pointer at a `39999:` header:** the offer is available, then the endpoint answers 400 ("only kind-39998
       community headers are supported", `index.js:256–258`). That is a dead end after the words. Gate decision 3
       says that case should be told why nothing is offered.
   - **Why it is not blocking.**
     - The trigger needs a curating header that breaks the spec's "`d` equal to the d-tag of the community header it
       curates" (`:70`). Every Tapestry-authored header conforms (the endpoint takes `d` from the community header),
       and so does the live `dog-breed` header. Still, "accept all signed events" means a third-party header can
       arrive here.
     - The preview shows the whole event, and the user must sign.
     - The code is exactly ADR 0003 §5 (`:241–248`, `:269`), so this is not drift.
   - **Ask (the Architect, as an ADR 0003 amendment).** `curateHereOffer` returns `unavailable` unless
     `info.pointer.kind === 39998 && info.pointer.d === row.d`, with one more reason sentence in the house form ("You
     can't curate it here: …") and a U2 case for each half. The natural home is story 5, which consolidates this
     sequence (Option C), before this book merges. Candidate ledger row below.
2. **Docs: `my-curated-dlists` ADR 0002 still says the page performs one write, and ADR 0003 §8 did not list it.**
   - **Now false for the detail page:**
     - `engineering-team/decisions/done/my-curated-dlists/0002-the-two-headers.md:107` — "keeps the page's single write
       in one pinned place";
     - `:142` — "The page now performs one write, only on an explicit click, only into local strfry."

     The offer adds the endpoint's header write (to local strfry and the DList relays) and the Map publish, each on
     an explicit click. The ADR's existing note (`:9`) is story 2's.
   - **Ask:** a one-line "Superseded in part (2026-09-12)" note and a Status parenthetical, citing
     `curated-dlist-update` ADR 0003 by short name, in the follow-up docs commit (as story 2's review notes landed in
     `294a2afc`).
   - **Also:** ADR 0003's own Security bullet (`decisions/done/curated-dlist-update/0003-read-only-curation-and-curate-here.md:312`,
     "the read-only page writes nothing except the existing import") contradicts §5, which puts the offer on that very
     page. Presumably it means "apart from the offer". Optional reword in the same commit.
   - The closed book's audit (`audits/my-curated-dlists/audit.md:52`, `:109`) is that book's as-built record and
     stays as it is.
3. **Pre-existing, shared with the panel: the Map update is composed from the Map on screen, and that is the local
   copy whenever local strfry holds one.**
   - `useTreasureMap` stops at a local hit (`ui/src/hooks/useTreasureMap.js:50–68`). The offer, like the panel,
     composes from that event (`CurateHereOffer.jsx:42–47`; ADR 0003 §5, "composed from the Map on screen").
   - This story exists for a Map edited on another instance. If this instance's strfry holds an older copy, signing
     republishes the older Map with the entry replaced, and drops the newer edits. The preview shows the whole event.
   - It is ADR-sanctioned and unchanged by this story. Worth folding into row 249's migration, which already cites
     `useTreasureMap`'s stop rule. No new row.
4. **Duplicate entries: the panel's `byD` keeps the last entry; readers take the first.**
   - `DListCurationPanel.jsx:118–122` keeps the last entry per d-tag. §7's `replaces` reads it (`:176–177`), as the
     button logic already does (`:232–233`).
   - Take a Map whose first entry names another assistant and a later duplicate names mine. The panel says "In your
     Map", while the detail page opens the list read-only. The reverse order says "replaces" for a list that is
     effectively mine.
   - It is pre-existing, and duplicates are abnormal: every writer drops them (`treasureMap.js:179–193`). The offer
     uses the first-wins row.
   - Optional, with Option C: build `byD` first-wins.
5. **The live check could not tell `listRelay` from the default.** The real entry's hint is
   `wss://dcosl.brainstorm.world`, which is also the community relay, so reading B's items at dcosl proves nothing
   about `listRelay`. The branch is covered by S2 and S4 and by reading (`CuratedDListDetail.jsx:77`,
   `CuratedDListItems.jsx:108`). No action.

### Candidate ledger rows (not written; this book's rows are renumbered at the next staging merge)
- **Type `bug`, latent (close before this book merges):** Non-blocking 1. The curate-here offer is available for a
  curating header whose pointer is not a kind-39998 header with the entry's own d-tag. For a d-tag mismatch, the user
  would sign a Map entry that addresses a header that does not exist (`assistant-designation.md:74`). Owner: story 5's
  Architect (the Option C consolidation). Pointer: this review, Non-blocking 1.
- **Type `docs`:** Non-blocking 2, if it is not fixed in the follow-up docs commit.
- **Type `meta`:** Harness friction 1 and 2.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*
1. **A sketch copied into Implementation leaves the tests and the code with one author.**
   - Row 264 proposes the Tester's satisfiability sketch. This is the first story where the Implementer adopted the
     sketch unchanged (story § Deviations).
   - As a result, the Implementation phase adds no independent reading of the ADR. The suite, fitted to the same text
     as the sketch, cannot catch what both missed: Non-blocking 1 passes every test.
   - Candidate: when row 264 is adopted, say whether Implementation may copy the sketch. If it may, require one
     independent pass: either the Implementer re-derives the edge cases from the ADR and the spec, or the review brief
     flags the tests as co-authored. Pointer: row 264.
2. **The Reviewer wiring and this run's brief disagree about the commit and the status flip.**
   - `.claude/agents/reviewer.md:30` and `:38`, and `.claude/commands/review-changes.md:32` and `:35`, tell the
     Reviewer to flip the story to `Done` and commit. This run's brief forbids both, because the orchestrating agent
     commits. I followed the brief.
   - Candidate: the wiring says "unless the caller reserves the commit and the status flip".
   - This also corroborates row 80(a): the candidate rows above live only in this file until someone writes them into
     OPEN.md.
3. **Corroborations, no new row:**
   - **Row 232:** Playwright needed `executablePath` → chromium-1228.
   - **Row 260:** the TA page's own Map search was bypassed by serving the Map to its local scan, as the brief advised.
   - **Row 276:** every suite was run through `run()`.
   - **Row 191:** exactly its four failures.
   - **Row 261:** both LB matrices skipped.
   - **Rows 198 and 226:** the container is not bind-mounted.
4. **Informational:**
   - A `git archive` snapshot for the tests-fail-first check must include the root docs. Without `BIBLE.md`,
     pointer-switch D2 fails on the pre-change snapshot for a reason unrelated to the code, which is easy to misread.
   - The shell here has no `timeout` command; a bounded perl poll stood in.
   - The full run took 48 minutes.

## Verdict
**PASS** — AC-1 through AC-5 are met. Each has passing tests, and each was also checked on the rendered pages.
- The tests fail on the pre-change code exactly as the test plan records.
- The implementation matches ADR 0003's Decision and Implementation notes line by line, including the Replace wording
  (§7) and both annotations (§8). All five logged deviations are accepted.
- Nothing is sent before Continue. The only writes are the endpoint's (on Continue) and the Map's (on Sign & publish),
  behind the verified-session guard and the drift-guarded signer.
- harness-lint is clean, and the full `npm test` is red only on row 191's four known failures.

Non-blocking 1 is the finding to settle before this book merges.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and its "Review:" link line filled — by the orchestrating agent,
      in the review commit (this run's brief reserved the story edit and the commit for it; Harness friction 2).
- [x] Completion detection performed; the result is reported in the chat, not in this file.

## Round 2 — ADR 0003 Amendment 1 (Non-blocking 1 and 2)

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-12
**Diff:** `git diff ec8e90c0 07d8dbdf` (commit `07d8dbdf`, 4 files). Context, read and not under review: `6c67e50b`
(Amendment 1, `engineering-team/decisions/done/curated-dlist-update/0003-read-only-curation-and-curate-here.md:401–451`, with
the header's "Supersedes in part" and "Amended by" lines, `:6–10`) and `ec8e90c0` (the failing tests, and the test plan's
Amendment 1 section). `git diff --stat ec8e90c0 07d8dbdf -- test/` is empty: the implementation commit touches no test.

> **At a glance.** No blocking items. The diff is Amendment 1 exactly, and it closes both of round 1's findings as they
> were asked. Two leftovers remain, one of each finding's kind. The diff introduces neither. They are for the operator to
> settle before this book merges, as round 1's were:
> - **R2-1 (docs, Non-blocking 2's kind).** `my-curated-dlists` ADR 0003 still says the page keeps its single write
>   (`:24`, `:96`), and nothing annotates it.
> - **R2-2 (a dead end, Non-blocking 1's kind).** The offer is still made when the curating header points at a list that
>   the viewer's own assistant here authored. Continue then meets the endpoint's "cannot curate your own header"
>   (`src/api/dlist-curation/index.js:259–261`). This is plausible for any instance owner: the owner's assistant is the
>   TA, and TAs author shared lists. This machine's TA authored the live shared `dog-breed` list.

### Quality gates (run by reviewer, not trusted)

- [x] **The six story suites, only through `run()`** (node v24.18.0, at `07d8dbdf`). The brief's command gave
      `TOTAL_FAIL=0`, exit 0. Run one by one for a clean listing: **101 passed, 0 failed**.
      - `curated-dlist-update-read-only-curation` 13/0
      - `my-curated-dlists-page` 19/0
      - `my-curated-dlists-headers` 16/0
      - `my-curated-dlists-items` 23/0
      - `dlist-curation-panel` 18/0
      - `curated-dlist-update-pointer-switch` 12/0
- [x] **The seven neighbouring suites, through `run()`.** A grep first found no fetch, socket or child-process call in
      them. Result: **130 passed, 0 failed**.
      - map-entries 14
      - TL panel 19
      - merge-preserve 16
      - TL Treasure Map panel 18
      - panel summary 18
      - opt-in publish 23
      - relay sync 22

      Together with the six, that is 231/0, the Implementer's count.
- [x] **The tests fail without the change.** I made a read-only `git archive` snapshot of `ec8e90c0`: 3144 files,
      including `BIBLE.md` and the other root docs (round 1's Harness friction 4). Each suite ran through `run()`.
      - **The new suite, 10/3:**
        - U2: "a pointer at another kind of header is not offered";
        - S5: the `target` tail is missing;
        - D1: ADR 0002's Status still ends "…ADR 0002)".
      - **The other five:** unchanged (19/0, 16/0, 23/0, 18/0, 12/0).

      This matches the test plan's record (`:136–139`), which was taken at `6c67e50b`, whose code is the same as
      `ec8e90c0`'s. At `07d8dbdf` all 13 tests pass.
- [x] **`bash scripts/harness-lint.sh`** at `07d8dbdf`, before this section was appended: `harness-lint: clean
      (0 violations)`. The rest of the output is the standing WAIVED lines.
- [x] **Hygiene.**
      - `git diff --check ec8e90c0 07d8dbdf` is clean.
      - No added line carries a 64-hex literal, `console.log`, `debugger`, `TODO` or `FIXME`.
      - No `src/`, dependency or lockfile change.
- [ ] **Full `npm test`: not re-run.**
      - **Why not.** The brief makes it optional. Its live publish-flow suites also sign and publish under the operator's
        external posture, which this brief rules out for me.
      - **The diff's reach is narrow.** `curateHereOffer` and `REASON_TAILS` have a single consumer,
        `CuratedDListDetail.jsx:76` (through `:95` and `:120`). Only the new suite and `my-curated-dlists-headers` name
        ADR 0002's file. All of those ran above.
      - **Corroborated, not verified, from the Implementer's own log** (scratchpad `npm-test-4.log`, 20:54):
        - 167 suite lines passing, one of which carries two results (Harness friction 3);
        - the four publish suites skipped (preconditions not met);
        - three suites red: `tl-membership-method-selector` 1, `tl-weighted-sum-method` 1 and `tl-certainty-method` 2.
          These are row 191's four failures (`:4909–4911`);
        - every suite in this story's area green, the new one 13/0 (`:4936`);
        - `Overall: FAIL`, exit 1.
- [x] `npm run test:playwright`: not applicable, because the test plan has no Playwright half. A read-only headless render
      stood in for it (§ Live checks).
- [x] _Lint / typecheck / build not configured — skipped._ No new tooling.

### Live checks (read-only)

1. **Served bundle.** `:7778` serves `index-_DAPvrty.js`. It carries the new sentence once and the six older tails. It
   also carries the new check itself, minified:
   `l!==39998||u!==r.d?{status:"unavailable",reason:"target"}:{status:"available",target:s.pointer.coord}`.
2. **Pure calls of the shipped functions** (scratchpad `r2-demo.mjs`). Each case runs a header through
   `describeCurationHeader` and then `curateHereOffer`. The endpoint's handler also runs, with every side effect injected
   as a stub that returns nothing or throws, so no relay, strfry, publish or sign call is reachable. The results are in
   the edge table below and in R2-2.
3. **Headless render** (scratchpad `r2-live-check.cjs`): playwright 1.56.1, with `executablePath` pointed at
   chromium-1228 (row 232).
   - **Stubbed:**
     - `/api/auth/status` and `/api/auth/user-classification`, as staging's customer `0f6c8526…`, with
       `assistantPubkey` set per scenario;
     - the curating header's local scan, in T-d and T-k only.
   - **Real:** the customer's Map, the live curating header `adcc9abc…`, the items, and the shared-header reads.
   - **Safety:**
     - The header endpoint was never armed: any request to it would have been aborted, and none was made.
     - Every other non-GET was aborted except read-only cypher. Four read-only cypher POSTs went through; none was
       refused.
     - There was no `window.nostr` and no session cookie, and the offer button was never clicked.
   - **Results: 17/17 checks**, and no page errors.
     - **A2 — the real, conforming header, with a synthetic key as my assistant here.**
       - The offer is shown.
       - Update's line ends "You can curate it here instead."
       - No `target` reason.
       - The page read `adcc9abc…`, whose `b` is `39998:11f23fe4…3767:dog-breed` (`inherit-items`).
     - **T-d — a synthetic curating header whose `b` is `39998:<author>:dogs`.**
       - "You can't curate it here: its assistant's header doesn't point at a kind-39998 list with the same d-tag.",
         exact.
       - No offer button.
       - Update's line has no offer sentence.
       - The header section shows "Points to 39998:cccccccc…cccc:dogs".
     - **T-k — `b` is `39999:<author>:dog-breed`.** The same four results.
     - **O — the real header, with this instance's TA (resolved at runtime) as my assistant here.** The offer is shown,
       and Update's line mentions it (R2-2).

### Spec adherence (Amendment 1's seams)

| Seam (ADR 0003 `:444–451`) | Test (passing) | Code | Live | Result |
|---|---|---|---|---|
| a pointer of another kind → `target` | U2 `:151–152` | `treasureMap.js:627–628` | T-k | Met |
| a kind-39998 pointer with another d-tag → `target` | U2 `:153–154` | `:627–628` | T-d | Met |
| a header state outranks `target` | U2 `:155–156` | `:621–623`, before `:627–628` | — | Met |
| a conforming pointer is still offered | U2 `:157–158`, and round 1's `:134` | `:629` | A2 | Met |
| the `target` sentence | S5 `:290` | `CurateHereOffer.jsx:25`, rendered by the existing path at `:53` | T-d, T-k | Met |
| `my-curated-dlists` ADR 0002's note, citing ADR 0003 by short name | D1 `:308` | `done/my-curated-dlists/0002-the-two-headers.md:3`, `:11` | — | Met |

- **AC-4.** The requirement that the page say why it offers nothing (`:79–80`) now covers a non-conforming header. The
  trigger (`:67–69`, "a kind-39998 list whose curating assistant's header names a shared header") is now narrower than
  its words, and rightly so. For a mismatched d-tag, "what the panel's Replace does for that shared list" (`:74–76`)
  would write another list's entry, and the spec's MUST (`assistant-designation.md:74`) settles the question. The
  story's § Deviations records the follow-up, so no story edit is needed.
- **AC-5.** The four files are the whole diff. The offer is computed only on read-only pages
  (`CuratedDListDetail.jsx:76`). So own lists, the panel, the endpoint (R2 passes) and every neighbouring suite are
  unchanged, and the conforming live curation still offers (A2).

### ADR adherence (Amendment 1's implementation notes, `:435–442`)

- **The target check.** At `treasureMap.js:627–628` it reads `const { kind, d } = info.pointer; if (kind !== 39998 ||
  d !== row.d) return { status: 'unavailable', reason: 'target' };`.
  - That is the exact negation of the Amendment's `info.pointer.kind === 39998 && info.pointer.d === row.d`.
  - It runs after the header's own states (`:621–623`).
  - The precedence is therefore `no-assistant` → `kind` → the header's states → `target` → `available`, as Change 1
    (`:421–426`) states.
- **The JSDoc** (`:608–616`) states the available condition, and gives the precedence ending "→ `target`", the order
  the code runs in.
- **`REASON_TAILS.target`** (`CurateHereOffer.jsx:24–25`) renders as the Amendment's sentence (Change 2, `:427–428`),
  exact. It is shown through the existing reason path (`:53`), with no new rendering code.
- **`my-curated-dlists` ADR 0002.**
  - The Status parenthetical is exactly the Amendment's text (`:3`).
  - The note (`:11`) is in the house form: one line, `> **Superseded in part (2026-09-12):** … — \`curated-dlist-update\`
    ADR 0003.` It has the same shape as story 2's note (`:9`) and cites ADR 0003 by short name.
  - The Status parenthetical lists both supersessions in order, separated by a semicolon, as `my-curated-dlists`
    ADR 0001 `:3` and `dlist-curation` ADR 0005 `:3` do.
  - The note is accurate. The offer renders only on read-only lists (`CuratedDListDetail.jsx:94–96`), and each of its
    two writes is on an explicit click: Continue (`CurateHereOffer.jsx:63–66`) and Sign & publish (`:86–95`).
- **The story's § Deviations** (`:154–168`) records the follow-up, and its numbers match mine: 231/0, lint clean, and
  the live check.

**Details, judged.**
- **U2's fixture change** (`:131–132`) was necessary. Round 1's fixture pointer, `{ coord, type }`, lacked the parsed
  parts that `describeCurationHeader` always adds (`treasureMap.js:451`), and the new check (correctly) fails closed on
  it. Every round-1 assertion is kept verbatim and passes (`:134–148`, `:159–163`). Nothing is weakened, and the
  fixture now has the shape the page actually passes.
- **Only `missing` is tested as outranking `target`.** The other states follow from the structure:
  `sharedListUnavailable` returns first, and `deferred` and `no-pointer` both mean there is no pointer.
- **"Written independently of the sketch"** cannot be checked from the artifacts, and it makes no difference here. The
  implementation and the sketch (`sketch-amend1.js:20`) are the same expression, because the Amendment fixes it
  (Harness friction 1).

**Does any path remain where the offer targets a header its Map entry cannot address?** I checked with the shipped
functions (`r2-demo.mjs`):

| Case | Offer | Why that is right |
|---|---|---|
| `parseCoordinate` fails (kind and d undefined). Unreachable through `describeCurationHeader`, whose pointer rule and `parseCoordinate` share `A_TAG_FORM` (`:221`, `:262`, `:423`). Tried with synthetic `info`: a garbage coordinate, a pointer without parts, `true`, a string, a number | `target`, never a throw | it fails closed |
| a d-tag containing a colon: entry `39998:breeds:dog`, `b` → `39998:<author>:breeds:dog` | available | `row.d`, the endpoint's `parseATag` d (`index.js:51–58`) and the Map key's reconstruction all read `breeds:dog`; the first-colon split (`treasureMap.js:157–161`) and the second-colon split (`:424–426`) agree |
| case: `b` → `…:Dog-Breed` | `target` | d-tags are exact strings; the header the endpoint wrote would be `…:Dog-Breed` |
| a trailing space, in the pointer or in the Map entry | `target` | the same: exact strings, and any normalization would address a header that does not exist |
| `b` → a header by the viewer's own assistant here, or by the viewer's own key | available | R2-2: the endpoint refuses it at `index.js:259–261`, so no Map is ever composed |

So no path remains on which the user can sign a Map entry addressing a header that does not exist. The one exception is
a pre-existing endpoint edge that the client cannot close (R2-4).

### Amendment 1's own text (ADR 0003 `:401–451`)

- **Accurate.**
  - Its cites hold:
    - the endpoint writes the header's `d` from the fetched shared header, falling back to the pointer's d-tag
      (`index.js:107–108`). That is "under the pointer's d-tag" for any shared header that matches the `#d` filter; R2-4
      is the exception;
    - the spec's `:70` and `:74`;
    - the kind check at `index.js:256–258`.
  - One nit (R2-3): its cites into ADR 0002, `:107` and `:142` (at `:417` and `:429–430`), were right when written. The
    note it asked for has since moved those lines to `:109` and `:144`.
- **Consistent with the rest of ADR 0003.**
  - It is appended at the end, the house pattern (compare `curated-dlist-update` ADR 0001 `:367` and `my-curated-dlists`
    ADR 0003 `:206`).
  - §5 is not rewritten; the header's "Amended by" line (`:9–10`) points to the amendment.
  - "Supersedes in part" (`:6–8`) adds ADR 0002, and Change 3 adds it to §8's list (`:292–296`).
  - The Security bullet (`:314`) is now read as "…writes only on explicit clicks: the existing import, and the offer's
    two writes (§5)", which agrees with §5.
- **It resolves round 1's findings as they were asked.**
  - Non-blocking 1 (`:306–309`) asked for the two-condition guard, a reason sentence in the house form, and a U2 case for
    each half. All three are present, plus the precedence and conforming cases.
  - Non-blocking 2 (`:318–323`) asked for the note and the Status parenthetical, plus the optional reword of the
    Security bullet. All are present.
  - Each finding's intent has one more instance that nobody listed: R2-1 and R2-2.
- **Earlier decisions.**
  - One is still contradicted and unannotated: `my-curated-dlists` ADR 0003 (R2-1).
  - The other hits of a write-count sweep over `decisions/` are either ADR 0002's own (`:31`, `:87`, `:109`, `:144`,
    `:185`), which its new note covers, or statements about one story or one file that are still true: "this story
    writes nothing", and the "write-free" hooks and files. For example, `my-curated-dlists` ADR 0003 `:75` is about
    `CuratedDListDetail.jsx`, which still writes nothing (`:36–37`).

### Concept-graph integrity
- [x] No concept, schema or property change. No firmware reinstall is needed; `/summaries` is not applicable.

### Things tests can't catch
- [x] No secrets, debug output or commented-out code (§ Quality gates, hygiene).
- [x] **Error paths.** The new branch is an early return inside a pure function, and it cannot throw: `info.pointer` is
      truthy at that point, and destructuring any truthy value is safe (`r2-demo.mjs` case 7).
- [x] **Security.** The check only narrows when the page offers its two writes. No endpoint, signer or publish path
      changed. Live: no request reached the header endpoint, and the guard had nothing to stop.
- [x] **Concurrency.** Nothing new: the offer is recomputed on every render from the same lookups.

### House rules check
- [x] Concept Graph API authority respected (no concept claims). No new lint, typecheck or build tooling.
- [x] No TA literal was added, and my scripts resolved the TA at runtime (`/api/assistant/pubkey`). No `LEGACY_*`
      constant was touched.
- [x] **The four invariants.**
      - The check reads the curating assistant's own signed header, ungated. It decides only what this viewer's page
        offers to write into the viewer's own Map; nobody's publication is gated (2).
      - It is computed per viewer, on every render (1, 3).
      - Nothing touches the graph (4).

### Product-guide adherence
Not applicable: this book has no PRD. The sentence is Amendment 1's, verbatim (S5; live T-d and T-k).

### Findings

#### Blocking
None.

#### Non-blocking
1. **R2-1 — `my-curated-dlists` ADR 0003 still counts one write, and nothing annotates it.**
   - **Where.** `engineering-team/decisions/done/my-curated-dlists/0003-items-method-and-update.md`:
     - `:24`, its AC-6: "story 2's import stays the page's only write";
     - `:96`, its Decision: "the page keeps its single write".
   - **Why it is stale.** The offer adds two writes to that page, as the new ADR 0002 note says. This ADR's Status
     (`:3`) and note (`:8`) carry only `curated-dlist-update` ADR 0002's supersession.
   - **Why it was missed.** Neither ADR 0003 §8 nor Amendment 1's Change 3 lists this ADR, and round 1's Non-blocking 2
     missed it too.
   - **Ask.** Give it the same treatment as ADR 0002:
     - a Status parenthetical ("…; the page's single write by `curated-dlist-update` ADR 0003");
     - a one-line "Superseded in part (2026-09-12)" note, citing `curated-dlist-update` ADR 0003 by short name;
     - a mention in Amendment 1's Change 3 and in the header's "Supersedes in part" line. D1's list can take it too.

     This can go through the harness, as this round did, or land as a follow-up docs commit (story 2's `294a2afc`
     precedent). That is the operator's call. It should land before this book merges if Non-blocking 2's intent is to
     hold.
2. **R2-2 — the offer is still made for a pointer at a header by the viewer's own assistant (or own key), and it
   dead-ends at the endpoint.**
   - **What happens.**
     - Such a pointer is kind 39998 and carries the entry's d-tag, so it passes the new check.
     - Continue then meets "cannot curate your own header (or one your assistant authored)"
       (`src/api/dlist-curation/index.js:259–261`), after the words.
     - No Map is composed. The flow stops and shows the endpoint's message (§5 step 3, `:262–264`;
       `CurateHereOffer.jsx:73–76`).
   - **Why it belongs with Amendment 1.**
     - It is the same failure Amendment 1 closed for the kind: "offered, then refused … after the words" (ADR 0003
       `:413–414`).
     - Like the kind, it can be decided from the pointer alone (`info.pointer.pubkey`). The endpoint's other refusals
       (404 and not self-declared, `index.js:268–274`) need the shared header fetched, and §5's error path covers them
       by design.
     - Gate decision 3 limits the offer to "what the DList Curation panel's Add and Replace already support" (story
       `:113–114`). The panel leaves out headers by the viewer or by the viewer's assistant (`DListCurationPanel.jsx:106`;
       `dlist-curation` ADR 0005 AC-3, `:13–14`). So by AC-4 (`:79–80`) the page should say why it offers nothing.
   - **Not hypothetical for instance owners.**
     - The owner's assistant here is the TA (`src/utils/assistantKeys.js:20–24`), and TAs author shared lists. On this
       machine the TA authored the live shared `dog-breed` (`c1fc1a32…`, self-declared), which the live curating header
       `adcc9abc…` points at.
     - Shown with the shipped functions (`r2-demo.mjs` case 8): the offer is available, with target
       `39998:<this TA>:dog-breed`, and the endpoint's handler, with stubbed dependencies, answers 400 with that
       sentence.
     - Shown rendered (live scenario O): the offer appears.
     - So any owner whose Map names another instance's assistant for a list their own TA authored will meet it. This
       instance's owner is not staging's customer, so it is not live here today.
     - The own-key half needs a third-party header: every instance's endpoint refuses such a target for the same user.
   - **Why it is not blocking.** The diff does not introduce it, nothing can be signed, and the endpoint's words are
     shown.
   - **Ask (the Architect; the operator decides when).**
     - Either add a third condition, "`info.pointer.pubkey` is neither the viewer's assistant here nor the viewer's own
       key" (the own key needs a new input), with its own reason in the house form;
     - or record the dead end as accepted.

     Natural homes: an Amendment 2 before this book merges, or story 5's Option C consolidation. Under it lies a product
     question. When my assistant here authored the shared list, "curate it here" could be just a Map entry naming it:
     its self-declared header arguably meets the letter of the spec's header contract (`assistant-designation.md:70–71`).
     The endpoint refuses that today.
3. **R2-3 — nits in the new text** (optional; they could go with R2-1).
   - **Stale cites.** Amendment 1's cites into ADR 0002 (`:107` and `:142`, at ADR 0003 `:417` and `:429–430`) now
     point at `:109` and `:144`.
   - **Destinations.** The ADR 0002 note does not say that the offer's writes leave local strfry, while `:144` still
     says "only into local strfry". In fact:
     - the endpoint publishes the header to the DList relays unless the policy is local-only (`index.js:299–305`);
     - the Map goes out through `publishOrThrow` → `publishEverywhere` (`ui/src/utils/publishProfileTag.js:24–25`).
4. **R2-4 — informational: a pre-existing edge on the endpoint side.**
   - **The edge.** Even when the target and the entry agree, the endpoint writes the new header's `d` from the fetched
     shared header's first `d` tag (`index.js:107–108`). It fetches that header by `#d` (`:264–267`), without checking
     the fetched event's own address against the target. A shared header that carries two `d` tags, and is the newest
     match, could give the header a `d` that differs from the Map entry's.
   - **Why it is only informational.** It is contrived (the shared list's author must publish a malformed header). It is
     not reachable from the client. And it is outside this story, which rules out any endpoint change.
   - **Candidate for the endpoint's next change:** compose `d` from the parsed target, or keep only events whose first
     `d` is the target's.

#### Harness friction
1. **An independent implementation adds nothing when the ADR spells out the predicate.**
   - The implementation (`treasureMap.js:627–628`) and the Tester's sketch (`sketch-amend1.js:20`, kept for comparison)
     are the same expression, as they must be, because the Amendment fixes it.
   - The independent reading that round 1's Harness friction 1 asked for would have mattered one step earlier. The
     endpoint's refusals on the offer's path (`index.js:247–288`) are the checklist for what the offer can decide in
     advance, and no phase walked them. Round 1 missed R2-2 as well.
   - Candidate (`meta`, with row 264): when a page pre-checks a server call, the Architect or the Tester lists that
     call's refusals, and says for each whether the page decides it or leaves it to the error path.
2. **Corroborations, no new row.**
   - This brief again reserved the story edit and the commit, against the Reviewer wiring (round 1's Harness friction
     2). This subagent's own instructions also repeat the wiring's "commit" and "flip the status".
   - Row 232 (chromium-1228), row 310 (`run()` only) and row 191 (the four reds, in the Implementer's log).
3. **Informational: the full run's summary prints two suites on one line.**
   - `test/test.js:1065–1066` put `tag-actions-menu-ui` and `tagging-raw-event-inspector-ui` on one output line
     (`npm-test-4.log:4861`). A per-line count therefore reads 167 where 168 suites passed.
   - This is one source of the count gaps both rounds saw (the Implementer's "169 green").
   - Candidate `cleanup` row.

#### Candidate ledger rows (not written; this book's rows are renumbered at the next staging merge)
- **Type `docs`:** R2-1, unless it is fixed before the merge.
- **Type `bug`, latent (a dead end; nothing is signed):** R2-2. Owner: the Architect (an Amendment 2, or story 5's
  Option C). Pointer: this review, round 2, R2-2.
- **Type `meta`:** Harness friction 1, with row 264.
- **Type `cleanup`:** Harness friction 3.

### Story status and completion
- [x] The story already reads `**Status:** Done`, from round 1's review commit `6902b62b`, so there is nothing to flip.
      This brief reserves the story, OPEN.md and the commit for the orchestrating agent, so this section is uncommitted.
- [x] Completion detection performed; the result is reported in the chat, not in this file.

### Verdict (round 2)
- The target check is the Amendment's predicate, in the Amendment's place, and the JSDoc agrees. The sentence is exact
  and renders through the existing path. ADR 0002's note is in the house form and accurate.
- The new tests fail on `ec8e90c0` for the right reasons and succeed on `07d8dbdf`, and the implementation commit
  touches no test. The six story suites (101/0) and the seven neighbours (130/0) are green, and harness-lint is clean.
- Rendered live, the conforming curation still offers, and a non-conforming header gets the new reason and no offer.
- No remaining path lets the user sign a Map entry that addresses a header that does not exist, short of R2-4's
  pre-existing endpoint edge.
- R2-1 and R2-2 are leftovers of the same two kinds the operator chose to close before the merge. Neither is introduced
  here, and neither blocks.

**PASS** — the diff is ADR 0003 Amendment 1, line for line, and it closes round 1's Non-blocking 1 and 2 as they were asked; R2-1 and R2-2 are the operator's to settle before this book merges.
