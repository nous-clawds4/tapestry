# Review: Story 3 — Another assistant's curation opens read-only, with an offer to curate it here

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-12
**Diff:** `git diff ff2d8641 85dc9d01` (commit `85dc9d01`, 10 files). Context, read and not under review: `c2198034`
story, `8c48e83f` ADR 0003, `ff2d8641` failing tests. `git diff --stat ff2d8641 85dc9d01 -- test/` is empty: the
implementation commit touches no test.

- Story: `engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.md`
- ADR: `engineering-team/decisions/curated-dlist-update/0003-read-only-curation-and-curate-here.md`
- Test plan: `engineering-team/stories/curated-dlist-update/3-another-assistants-curation-read-only.test-plan.md`
- Upstream contract: `curated-dlist-update` ADR 0001 Decision §8 (`decisions/curated-dlist-update/0001-curation-copy-convention.md:43–46`);
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

- [x] **The six story suites**, each through its exported `run()` (node v24.18.0; OPEN.md row 276's method): **101
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
   - **Also:** ADR 0003's own Security bullet (`decisions/curated-dlist-update/0003-read-only-curation-and-curate-here.md:312`,
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
