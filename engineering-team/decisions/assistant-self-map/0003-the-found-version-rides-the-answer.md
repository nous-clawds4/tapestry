# ADR 0003: The found version rides the answer the page already reads, behind one toggle

**Status:** Proposed
**Date:** 2026-10-13
**Story:** `engineering-team/stories/assistant-self-map/4-show-your-assistants-raw-treasure-map.md`
**Extends:** ADR `assistant-self-map/0001` sub-decisions 5 and 7: `published` gains `event`. Nothing else in 0001 or
0002 changes.

## Context

Story 4 asks for a toggle on Your Assistant's Treasure Map page that opens the version of the Assistant's kind 10040
the page's check found, whole and as published (AC-1, AC-2), only when a version was found (AC-3), never a stale one
(AC-4), with nothing else changing (AC-5).

What the code does today:

- **The page reads one answer.** `AssistantTreasureMap.jsx` draws everything from `actions['treasure-map']` of
  `GET /api/assistant/attention`, through `useAssistantAttention()`. It never fetches the answer itself (story 1 AC-7);
  a press asks for it again with `attention.refresh()`. While that request is out, `phase` is `checking` and the
  answer is null (`ui/src/context/AssistantAttentionContext.jsx:66–67`).
- **The found version is already in hand on the server, then dropped.** `lookupSelfMap`
  (`src/api/assistant/selfMap.js:247`) finds the newest version: this instance's relay first, else one outside round
  over the Map's hints, the Assistant's write relays and the offer's relays. Its `found(latest, source)` helper
  (`selfMap.js:252–256`) keeps `latest` for the press. For the answer it keeps only `readSelfEntries(latest)`,
  `createdAt`, `source` and `eventId`, as `published`. `evaluateSelfMap` (`src/lib/self-map/index.js:512`) passes
  `published` through unchanged.
- **The found version can live outside.** When this instance's relay holds no version, `published.source` is `relay`.
  The browser can't then read it from local strfry by its `eventId`.
- **Outside reads are verified.** `readRelayEvents` checks each event's signature by default
  (`src/api/_shared/relaySource.js:241`). Local scans read this instance's own strfry, which verifies on write.
- **A raw viewer exists in the other design.** `/treasure-map` has `RawViewer`/`RawPanel`
  (`ui/src/pages/treasure-map/Index.jsx:133–175`) and `rawMapText` (`manageTreasureMap.js:143`). Its classes
  (`bsd-tm-raw-*`) take their font and colours from tokens scoped to `.bsd-page` (`styles.css:9584–9605`). The
  `/assistant` pages are `bsp-page` with `bs-*` classes on a dark card (`styles.css:8998`), outside that scope.
- **No concepts are touched.** The story reads one event; no graph concept, schema or firmware changes.

## Options considered

### Option A — Carry the found version in the answer (chosen)

`found()` adds `event: latest` to `published`. The page shows `answer.published.event` behind a toggle.

- **Pros:**
  - It is the same version the panel describes, by construction: one read, one object. AC-1's "this instance's relay
    or another relay" holds for free.
  - AC-4 is free too: the text is derived from the current answer, and a press already asks for a new one.
  - No new route, no `routeAccess.js` entry, and story 1 AC-7 ("the page never fetches it itself") still holds.
  - One line on the server.
- **Cons:**
  - Every attention answer for a viewer whose Assistant has a version carries one more event. That includes the
    hub's and the Assistant Alert's, which don't show it. A kind 10040 is a few hundred bytes per entry. The Owner's,
    which also holds this instance's own entries, is the largest, in the low kilobytes. Accepted: the answer already
    carries the duties, `shouldSay` and the Duty Menu's rows.

### Option B — The page reads the event from local strfry when the toggle opens

On open, `queryRelay({ ids: [published.eventId] })` against this instance's relay.

- **Pros:** the answer stays as it is, and the event loads only when someone asks.
- **Cons:**
  - It fails AC-1 whenever `source` is `relay`: the version isn't on this instance's relay. Covering that means a
    new server read of outside relays, i.e. Option C.
  - It breaks story 1 AC-7's one-request rule, and the toggle needs loading and failed states the story didn't ask
    for.

### Option C — A narrow route returns the found version on demand

`GET /api/assistant/self-map/event` runs `lookupSelfMap` for the session's Assistant and returns `latest`.

- **Pros:** the answer stays as it is, and the toggle works wherever the version is.
- **Cons:**
  - A new route with its `routeAccess.js` entry, `openapi.yaml` and BIBLE rows.
  - A second outside round, up to the relay budget, on every open.
  - Loading and failed states.
  - It can disagree with the panel: a newer version may land between the two reads, so the raw view and the panel
    would describe different events. That is AC-4's failure in a new form.

## Decision

We chose **Option A**. The page already holds the answer, and the server already holds the version that answer
describes. Sending it along is the only option that shows exactly what the panel summarises, wherever it was found,
with no new request. We trade a few kilobytes on the hub's one request for that.

### Sub-decisions

1. **`published.event` (server).** In `lookupSelfMap`'s `found(latest, source)` (`selfMap.js:252–256`), `published`
   becomes `{ ...readSelfEntries(latest, who), createdAt, source, eventId, event: latest }`.
   - `event` is the version exactly as it was read, never rebuilt or reshaped: the strfry scan's object, or the relay
     read's.
   - Every path that finds a version builds its answer through `found`: the local-first path, the outside round and
     the press's `strictOutsideRound`. So `event` is present whenever `published` isn't null, and
     `published.eventId === published.event.id` always.
   - `unfinished(...)` and `SELF_MAP_CHECK_FAILED` keep `published: null`.
   - `evaluateSelfMap` is unchanged: it passes `published` through.
   - The press is unchanged. It reads `lookup.latest`, and its response carries no `published`.
2. **Which event the page shows (pure).** `rawTreasureMap(answer)` in `assistantTreasureMapCopy.js` returns the found
   event, or null.
   - The event: when `answer.finished === true`, `answer.published` is an object, and `answer.published.event` is a
     non-null, non-array object.
   - Null in every other case: no answer (checking, failed), unfinished, `check-failed`, or finished with
     `published: null`. That is AC-3's "nothing to toggle".
   - It doesn't look at `selfEntries`, so a version that lists none of the Assistant's duties still shows (AC-1, owner
     choice 2).
3. **The text (pure).** `rawTreasureMapText(event)` returns `JSON.stringify(event, null, 2)`, or `''` for none. This is
   the same rule as `/treasure-map`'s `rawMapText`, restated so the copy module stays import-free (its header's promise,
   which lets the Node suite load it). React renders it as text inside a `<pre>`, never as HTML.
4. **The words.** `SELF_MAP_COPY.raw = { show, hide, closedMark, openMark, boxLabel }`:
   - `show`: "Show your Assistant's raw Treasure Map";
   - `hide`: "Hide your Assistant's raw Treasure Map";
   - `closedMark` `▸` and `openMark` `▾`, drawn before the words in an `aria-hidden` span. The visible label then reads
     as § Copy word for word, and a screen reader hears only the words, with `aria-expanded` giving the state;
   - `boxLabel`: "Your Assistant's raw Treasure Map". This is the open box's accessible name, which a sighted reader
     never sees. It follows `/treasure-map`'s `rawBoxLabel` (that page's review, non-blocking 4) and story 3's naming
     rule.
5. **The page.** In `AssistantTreasureMap.jsx`:
   - **State:** `const [rawOpen, setRawOpen] = useState(false)`. Closed on every mount (AC-4's "starts closed").
     Nothing is remembered between visits.
   - **Where:** in the published card, right after `{selfEntries.length > 0 && <Entries … />}` and before the state
     line. It renders only when `rawTreasureMap(answer)` returns an event:

     ```jsx
     <div className="bs-selfmap-raw">
       <button type="button" className="bs-selfmap-raw-toggle" aria-expanded={rawOpen ? 'true' : 'false'}
         aria-controls="bs-selfmap-raw-box" onClick={() => setRawOpen(!rawOpen)}>
         <span aria-hidden="true">{rawOpen ? raw.openMark : raw.closedMark}</span>{' '}{rawOpen ? raw.hide : raw.show}
       </button>
       {rawOpen && <pre id="bs-selfmap-raw-box" className="bs-selfmap-raw-pre" tabIndex={0} role="region"
         aria-label={raw.boxLabel}>{rawTreasureMapText(rawEvent)}</pre>}
     </div>
     ```

   - **A press:** while the new answer is on its way, the toggle and box go away, because `rawTreasureMap(null)` is
     null. `rawOpen` keeps its value, so when the answer returns with a version the box reopens on the new version.
     When no version comes back, nothing shows. The page keeps no copy of the event in state, so it can never show a
     stale one (AC-4).
   - **Untouched:** every other line, button, mark, press and refresh stays as it is (AC-5). The toggle is not a
     press: it doesn't touch `pressing`, `result` or `notice`, and it sends nothing.
6. **The styles.** Three rules in `ui/src/styles.css`, beside `.bs-selfmap-actions` (`:9057`), in the `bs-*`
   dark-card palette:
   - `.bs-selfmap-raw`: the block's top margin.
   - `.bs-selfmap-raw-toggle`: a text button. No border or background, `font: inherit`, the accent colour, a pointer
     cursor, and a `:focus-visible` outline.
   - `.bs-selfmap-raw-pre`: the monospace stack `code` uses (`styles.css:37`), about `0.75rem`, a dark inset background
     with the card's border colour, and a `:focus-visible` outline. It wraps: `white-space: pre-wrap;
     overflow-wrap: anywhere`, so no line is wider than the card and the page never scrolls sideways at phone width
     (AC-2). Its height is capped with `max-height: 28rem; overflow-y: auto`; it is focusable, so a keyboard can scroll
     it.

   It reuses no `bsd-tm-raw-*` class: those take their tokens from `.bsd-page`, which this page isn't in.

## Consequences

- **What this enables.** The person sees the event outside clients read, wherever it was found, beside the page's
  summary of it. That covers the Owner's other entries too, which the page only counts.
- **What it costs.**
  - The attention answer grows by one event, for viewers whose Assistant has a version. The hub and the Assistant
    Alert carry it and don't show it.
  - `published` now has two homes for the id (`eventId` and `event.id`); `eventId` stays for existing readers.
- **Trust.** The raw view shows what the check already trusts: local strfry, or an outside read whose signature
  `readRelayEvents` verified. It adds no read and no new source.
- **Privacy.** None new. The event is public on relays, and the answer is session-shaped, for the viewer's own
  Assistant only.
- **Follow-ups.** None required. A copy button, the relay it was found on, or older versions are the story's Out of
  scope.
- **Firmware reinstall required?** No. No concept definitions change.

## Implementation notes

1. **`src/api/assistant/selfMap.js`**: in `found` (`:252–256`), add `event: latest` to `published` (sub-decision 1).
   Extend the module header's "self-Map found" bullet by a clause: the found version itself rides as
   `published.event`.
2. **`ui/src/pages/assistant/assistantTreasureMapCopy.js`**:
   - add `SELF_MAP_COPY.raw` (sub-decision 4);
   - export `rawTreasureMap(answer)` and `rawTreasureMapText(event)` (sub-decisions 2–3);
   - extend the header's story list by one line naming story 4's § Copy.
3. **`ui/src/pages/assistant/AssistantTreasureMap.jsx`**:
   - the toggle and box as sub-decision 5;
   - import the two helpers;
   - add one paragraph to the header comment for story 4 (ADR 0003).
4. **`ui/src/styles.css`**: the three rules (sub-decision 6), with a one-line comment naming assistant-self-map #4.
5. **Docs**:
   - `src/api/openapi.yaml`: under the attention answer's `published.properties`, add `event: { type: object,
     nullable: false, description: 'treasure-map: the found version itself, as read (id, pubkey, created_at, kind,
     tags, content, sig)' }`. In the `treasure-map` paragraph's `published` list, add `event`.
   - `BIBLE.md` §11, the `/api/assistant/attention` row (`:527`): "the self-Map found (`published`, this instance's
     relay first)" becomes "… (`published`, this instance's relay first, with the event itself as `event`)".
   - ADR 0001: one line under sub-decision 7's shape: "`published.event`: the found version itself (ADR 0003)."
6. **For the Tester** (Phase 3 owns every test edit):
   - **Check suite** (`test/assistant-self-map-check.test.js`): pin that `published.event` is the found version on
     every path, local, outside and forWrite, and that `event.id === eventId`. Pin that it is absent where
     `published` is null.
   - **Page suite** (`test/assistant-self-map-page.test.js`):
     - P/Q-class tests for `SELF_MAP_COPY.raw` word for word;
     - `rawTreasureMap` over checking/null, unfinished, `check-failed`, finished-null, finished with a version that
       lists none, and a malformed `event`;
     - `rawTreasureMapText`;
     - D-class sentinels: the toggle's place in the published card, `aria-expanded`, closed by default, no fetch.
   - **Browser spec** (`tests/brainstorm/assistant-self-map.spec.js`):
     - opening and closing the box, with its JSON's `id` equal to the canned `eventId`;
     - no toggle while checking, unfinished or none found;
     - after a press's refresh, the new version shows;
     - no horizontal scroll at 375px.
   - **Fixtures:** `test/helpers/selfMapFixtures.js`'s canned answers gain `event` wherever `published` isn't null.
     Existing assertions read `published` field by field, so none should break; the Tester confirms.
7. **Shared lines.** Before Implementation, re-check `origin/staging` for edits to `selfMap.js`, `attention.js` and the
   page (book § Shared lines) and record the recheck in the book. Only `staging` carries this page, so there is no
   other branch to port to.

## Out of scope

- A raw view of the person's own Treasure Map (`/treasure-map` and `/tapestry/grapevine/treasure-map` have one), and of
  what the Map should list (computed, not signed).
- The Duty Menu's answer. It doesn't gain its event here.
- Trimming the attention answer per consumer, e.g. leaving `event` out for the hub. Not needed at this size; to be
  measured before it's attempted (CLAUDE.md principle 3's "measure" rule, applied to payload).
