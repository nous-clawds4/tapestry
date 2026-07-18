# ADR 0003: Note-tagging raw-events inspector — eager `rawEvents` side-table on `for-event`, client-composed envelope, shared blocks component extracted

**Status:** Proposed
**Date:** 2026-07-17
**Story:** `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md`
**Book:** `engineering-team/audits/note-tagging-inspector/book.md` (Open, armed)
**Builds on:** tag-event-inspector ADR 0001 (the 7-field `toRawEvent` whitelist and `.bs-tag-raw-pre`, both reused) and ADR 0002 (the `{polarity, counted, event}` envelope, the measure-first method, and the D5 prop-gate pattern — all reused; its D1 *argument* deliberately **not** inherited, see D1 here); event-tagging ADR 0004 (`for-event`, the endpoint extended), ADR 0006 (`NoteCard → NoteTags → TagChip`, the shared unit that makes AC-5 structural), ADR 0007 (the trust-unfiltered `mine` channel whose union rule D3 mirrors), ADR 0013 (the `showScores` prop-threading idiom D4 copies); ADR-0015/ADR-0022 (read-through only — see "Citation hygiene"); pov-selectable-tag-surfaces ADR 0001 (`povParams`, already in `useEventTags`' effect deps).

**Citation hygiene:** ADR ids are epic-scoped — cite as **tag-event-inspector ADR 0003**. This ADR introduces **no pubkey literal of any kind**. The one 64-hex literal already on the read path — `CANONICAL_AUTHORITY` in `src/api/event-tags/index.js:34`, an ADR-0004 *default honored authority* in ADR-0015's lineage — is **read through and never touched**; a diff adding, removing, or rewriting it must be rejected. Authors, ids, and bytes rendered by this feature are runtime data off the events.

## Context

Story #3 puts the signed events behind a **note's tag chips** in-product: a "Show/Hide Raw Tagging Events" button in the chip's hover popover (beside Apply/Dispute), toggling a per-(note, tag) panel between the note's body and the chips row, on every note surface, signed in or out. The product decisions arrive settled (all surfaces; pluralized label; popover does not close on select; per-chip stacking panels; neutral excluded; pubkey not display name; no login gate). The story leaves the Architect two things: **open question (a), the payload strategy — "re-derive from scratch, measuring, exactly as ADR 0002 did"** — and the **`<RawEventPanel>` extraction position** (the `_intake.md` 2026-07-16 trigger: "do it at the THIRD inspection surface" — this story *is* that surface).

### Acceptance criteria (quoted, compressed to their binding clauses)

- **AC-1:** button labelled **"Show Raw Tagging Events"** / **"Hide Raw Tagging Events"** in the chip popover, "alongside the existing Apply/Dispute actions … enabled whether or not the viewer is signed in … Whenever the popover is open, the label reflects the panel's actual current state."
- **AC-2:** default hidden, no layout shift on load; panel "inside that note's card, below the note's content and above the chips row, captioned with the tag's name"; toggle per (note, tag); multiple panels stack "in the chips' display order"; other notes unaffected; "the popover's own open/close behavior (hover, focus, Escape, cursor-leave) is unchanged — clicking the button does not close it."
- **AC-3:** the panel renders "**exactly the set of assertions those numbers are derived from** — the active POV's WoT-filtered, non-neutral assertions, unioned with the viewer's own assertion when present (the same union rule the chips row itself uses)"; applications before disputes, stable deterministic order; each block captioned with polarity + **author pubkey**; viewer-own-but-uncounted marked "not counted under this POV"; each block "the complete signed event as published — `id`, `pubkey`, `created_at`, `kind`, `tags`, `content`, `sig` — … byte-faithful"; "count the blocks and get back the popover's numbers."
- **AC-4:** cannot produce the events → "a visible message and … no panel that could be misread as 'nobody asserted this'"; still retrieving → visible indication; the rest of the popover keeps working; per-chip/per-note failure isolation.
- **AC-5:** identical on every note surface (feed, `/event`, tag-page Notes tab, profile notes).
- **AC-6:** chips/popover/Apply/Dispute/own-stance highlight/score trio/add-tag unchanged; Story-1 and Story-2 inspectors behavior-unchanged; **profile pages' own tag chips gain no affordance**; **no TA pubkey literal**; **POV:** bytes POV-invariant, the *set* per-POV by construction, computed at read time, never stored.

### The measurements that decide D1 (2026-07-17, live)

The story's warning: the read path "fires **once per note card on every note surface** — a feed multiplies it," so Story 2's eager answer "does not transfer — in either direction." Measured rather than assumed:

| Fact | Measured value | How |
|---|---|---|
| Real note-tagging events in the whole federation | **2**, both on `tags.brainstorm.world` (`cool-web-of-trust` → two kind-1 notes, each +1 −0) | `GET /api/event-tags/for-tag?tagAuthor=e5272de9…&slug=cool-web-of-trust` → `total: 2` |
| A real note-tagging event, 7-field projection, compact JSON | **792 B** (both events; tags `d,e,z,z,z,polarity`, empty content) | `GET /api/strfry/scan?filter={"ids":[…]}` on tags.bw (read-only), projected + measured |
| Sibling family (`nostr-user-tag`) event size | 868 B mean / 875 B max (n=400) | carried from ADR 0002's measurement — same band |
| `for-event` response for a tagged note, today | **833 B** | `curl -w %{size_download}`, both tagged notes |
| `for-event` response for an **untagged** note | `tags: []` → eager increment **0 B** | response shape — the increment attaches only where taggings exist |
| Eager increment per referenced event (id key + projection) | **~860 B** | 792 + 64-hex key + JSON overhead |
| Eager per-response cost on the real data | 833 B → **~1.7 KB** (2.05×) | arithmetic on measured |
| **The wire is uncompressed** — raw bytes ARE the wire cost | `Content-Length: 3262`, no `Content-Encoding`, on tags.bw; same finding on staging | header probe; **OPEN.md #48** |
| Note-count cap per surface | feed `FEED_CAP=50`; Notes tab `NOTES_CAP=50`; user notes 50; `/event` 1 | `src/api/feed/feedReadPath.js:48`, `src/api/event-tags/index.js:37`, `BrainstormUserNotes.jsx:16` |
| Worst *realistic* page (50-note Notes tab at the sibling-family mean 1.10 assertions/target) | **+~47 KB page-wide, spread over 50 separate ~1.7 KB responses** | arithmetic |
| Hypothetical hot note (10 assertions on one note) | +~8.6 KB on that one response | arithmetic |
| `for-event` round-trip (tags.bw, remote) | **0.41–0.52 s** (n=3) | `curl -w %{time_total}` — the visible spinner a lazy open would buy |
| staging + local event-taggings | **zero** (book's measured data reality re-confirmed; local `strfry scan` under both authority namespaces → 0 events) | local seeding at implementation time is the book's Tier-4 plan |

**The story's "×feed" fear resolves the same way Story 2's "×99" did — the multiplier is real but attaches to the wrong axis.** Feeds multiply the *request count*, which is unchanged under every option (the mount read already fires per card, ADR 0006 Option F). The eager *increment* attaches per **tagged** note only — and a feed today contains approximately zero tagged notes, while the one surface where every note is tagged by construction (the Notes tab) is capped at 50 and pays ~0.9 KB extra per response at the measured mean. Uncompressed (OPEN.md #48), page-wide worst ≈ 47 KB — under the weight of a handful of the avatars on the same page.

### Facts verified in code (2026-07-17)

| Fact | Evidence |
|---|---|
| The full signed events are already in memory per request, then projected away. | `src/api/event-tags/index.js:156` (`candidates`) → `classifyEventTaggings` keeps `{eventId, authorPubkey, createdAt, polarity}` per entry (`src/lib/event-tagging/classify.js:76,121`) and `{tag, stance, eventId, createdAt}` in `mine` (`:113`). |
| The scan is **per note** — the panel's own unit. | `core.filterTagsAppliedToEvent({target})` keys on `#e`/`#a` of ONE target (`index.js:156`). The Story-2 asymmetry (per-tag scan can't serve a per-row lazy read) **does not exist here** — lazy is not architecturally wrong this time, just wasteful (D1). |
| `for-event` is local-relay only — no remote leg. | ADR 0004 "Local relay only"; `strfryScan` (`index.js:60-70`) is the only event source. The `verifiedSymbol` hazard ADR 0001 documented can't occur here, but the whitelist is still the contract "as signed" (see D2). |
| The chips-side union rule lives **client-side** on this surface. | `NoteTags.jsx:42-55` (`displayedTags` = counted ∪ mine-only), `:34-38` (`myStanceByCoord`), `:84` in `TagChip` (own-stance detection). D3 composes the panel at the same seam. |
| `TagChip` is shared by exactly two importers. | `grep from './TagChip'` → `ProfileTagsSection.jsx:4`, `NoteTags.jsx:6`. An absent-prop gate keeps the profile surface byte-identical (AC-6). |
| The popover already closes on Escape and cursor-leave; **no handler calls `setOpen(false)` on item select**. | `TagChip.jsx:70-72` (Escape), `:104` (`onMouseLeave`), `:106-110` (blur-outside). The button adds no close call (AC-2). |
| The popover hangs below the chip and moves with it. | `.ptc { position:relative }` (`styles.css:3851`), `.ptc-popover { position:absolute; top:calc(100%+6px) }` (`:3923-3927`). Governs the layout-shift interaction documented in D4. |
| `mine` entries in the hook rename the assertion id. | `useEventTags.js:92` — `mineEventId: m.eventId` (`eventId` on an enriched mine entry is the **tag's** id from the `available-tags` join). D3's join must use `mineEventId`. |
| Story 2's blocks component consumes **exactly** the envelope this story needs. | `ui/src/components/TagRowRawEvents.jsx:29` — props `{ assertions: [{polarity, counted, event}] }`, captions "Applied by"/"Disputed by" + `<code>` pubkey + the verbatim "not counted under this POV" marker, `<pre className="bs-tag-raw-pre">`. This is what makes D5's extraction a rename, not an abstraction hunt. |
| `toRawEvent` exists, is un-exported, and no require cycle blocks sharing it. | `src/api/profile-tags/index.js:764-773`; absent from `module.exports` (`:1820`); profile-tags never requires event-tags (grep), and event-tags already requires `../profile-tags` (`index.js:541`). |
| No test pins an exact key set on the `for-event` response ⇒ an additive field is safe. | The only `Object.keys` set-equality in the event-tagging suites targets the **builders'** unsigned events (`test/event-tagging-core.test.js:75,104`), not the read response. |
| `TagANoteModal` also calls `for-event` — and reads only `j.tags`. | `TagANoteModal.jsx:92-94`. The additive field is invisible to it; it inherits the increment only for the one note it inspects. |
| Story 2's automatic gate is the stack-free source suite. | `test/tagging-raw-event-inspector-ui.test.js` (region-scoped source assertions; Playwright is a ratified deferral, OPEN.md #13). The re-aim in D5 is a file-path retarget of that suite. |

### Concept orientation (three-call pattern, AGENTS.md §3; local graph live at :7778)

- `39998:<TA>:nostr-event-tag` — **nostr event tagging**: *"an event that applies a specific Tag to a specific event (referenced by the e or a tag). The descriptor … via a z-tag … Optional polarity is expressed as an event-tag (1 = applied, −1 = disputed; absent = applied). Publishing is permissionless; whether a tagging counts is computed per point-of-view at read time."* The concept whose elements the panel displays; its last sentence is D1/D3's POV contract verbatim.
- `39998:<TA>:nostr-event` — **nostr event**: the seven-field definition is the normative list D2 serializes (quoted in full in ADR 0001 D1).
- `39998:<TA>:tag` — **tag**: context; its definition event is Story 1's subject, not this story's.

The local graph answers `<TA>` = `e00ed090…9df36` (confirmed live at `/api/assistant/pubkey`); CLAUDE.md documents `82b75e47…` for this machine — the divergence remains the live proof of the no-hardcode rule. **No concept definitions change ⇒ no firmware reinstall.**

## Options considered

### D1 — When the raw events travel: eager with the counts, or lazy on open

#### Option A — eager: `for-event` always carries the referenced events *(chosen)*
The bytes ride the same response the chips already mount from.
**Pros.** **Zero extra scans, zero extra round-trips** — the events are at `index.js:156` already and the projection is the only new work. **AC-3's count-back invariant is structural**: counts and bytes come from one classification of one scan in one response; they cannot drift. AC-4 collapses: "still being retrieved" is the pre-chips state (no chip exists to open before the read lands), "request fails" is the no-chips state (existing error banner) — no new async machinery, no per-panel race. The increment is **0 B for untagged notes** — i.e., for approximately every feed note today — and ~0.9–1.7 KB per *tagged* note at measured sizes. Testable by the node HTTP-contract suite (with the honesty note that suite gates staging/local runs, not stack-free CI — `tagging-raw-event-inspector-ui.test.js`'s preamble).
**Cons.** Every `for-event` for a tagged note carries bytes most viewers never open: ~2.05× per response (833 B → ~1.7 KB), ~+47 KB page-wide on a full 50-note Notes tab at the measured mean, uncompressed until OPEN.md #48 lands. Grows linearly with a note's tagging volume, unbounded (capping is story out-of-scope).

#### Option B — lazy: refetch `for-event?includeRawEvents=1` on first toggle, cached per note
**Pros.** Zero cost on views that never open a panel — and unlike Story 2's Option B, **not architecturally wrong here**: the scan is per note, the same unit the panel needs, so a lazy open re-runs one note's pipeline, not a whole tag's.
**Cons.** It re-runs the **entire** per-note pipeline (a `strfry scan` subprocess + one header scan per distinct descriptor + a Meili author fetch + POV resolution) to re-obtain ~1–9 KB the mount already held and discarded — the expensive resource spent to save the cheap one, multiplied by user curiosity. Measured round-trip ~0.41–0.52 s of visible spinner per open. Worst: it converts AC-3's count-back from a structural property into a **timing** property — two requests can straddle a new assertion, and the panel then honestly renders a set the popover's numbers don't match. Syncing the chips from the second response instead would mutate the popover under the viewer's cursor mid-hover. And it adds the loading/error/race states to the UI's only mechanically-ungated half.

#### Option C — lazy client scan: `GET /api/strfry/scan?filter={"ids":[…]}` on open
**Pros.** No endpoint change at all; the ids are already in the entries.
**Cons.** Everything wrong with B, plus: it bypasses the read API's classification (the panel's `counted`/polarity captions would ride one response, its bytes another **from a different contract**); the scan route is an unbounded generic admin surface a product feature shouldn't grow a dependency on; and a per-open subprocess exec for data the server had in RAM. Rejected.

**Decision: Option A.** Story 2's conclusion, re-derived on this path's own numbers rather than inherited: the axis the story feared (per-card fan-out) multiplies requests, which no option changes — the increment lands only on tagged notes, sub-2 KB each measured, while B and C spend a full pipeline re-run per open and a correctness hazard to save it. Also honestly recorded: the one argument that *decided* Story 2's D1 (the per-tag scan) is absent here — eager wins on the remaining three (marginal scan cost, structural count-back, degradation collapse), which are sufficient.

### D2 — Where the bytes hang in the response: side-table, per-tag arrays, or core change

#### Option A — top-level `rawEvents: { [eventId]: <7-field projection> }` side-table, built in the handler *(chosen)*
`handleForEvent` collects every `eventId` referenced by `tags[].applications ∪ tags[].disputes ∪ mine`, and serves those candidates' projections keyed by id. The classifier's output already names exactly the events behind the numbers — the handler just serves their bytes.
**Pros.** **The pure core stays untouched** (`classify.js` is dependency-free and shared; its other consumer, `groupTaggingsByTarget`, feeds the TA-signed note TL, which must never carry event bodies). **No duplication of the gating chain** (descriptor → header → honored authority → tag identity → polarity → trust) — the referenced-id set *is* the classifier's verdict. **Each event ships once**, even when referenced by both an `applications` entry and `mine` (the viewer's own trusted assertion). Additive and invisible to `TagANoteModal` and every existing test. The join key (`entry.eventId`) is already in every entry.
**Cons.** The client joins id → bytes (D3). A malformed join is a new client-side failure mode — closed by D6's all-or-nothing rule.

#### Option B — per-tag `assertions: [{polarity, counted, event}]` arrays, mirroring Story 2's `row.assertions`
**Pros.** The exact ADR 0002 shape; the client passes `tag.assertions` straight to the shared component.
**Cons.** The server can only build the viewer-union if it re-walks candidates against the classifier's gates **outside the core** (two sources of truth for legitimacy) or the core's return grows envelope shapes only one caller wants. A **mine-only chip has no `tags` entry at all** — its assertion would need either a synthetic `tags` entry (which flips `NoteTags.jsx:108`'s `tags.length > 0` POV-notice condition — a real AC-6 behavior change) or a second channel anyway. And it double-ships the viewer's own trusted event (once in the tag's array, once for `mine`'s needs). Story 2's server-side union was right *there* because `profiles-tagged` rows are server-assembled; this surface's union already lives client-side — mirroring the shape would fight the surface's own architecture.

#### Option C — embed the event per entry by changing `classifyEventTaggings`
**Cons.** Touches the shared pure core to carry ~800 B payloads through every consumer, including the note-TL refresh path that must stay lean; forces the projection (an API concern) into a dependency-free library or leaks unprojected events into entries. Rejected.

**Decision: Option A.** `toRawEvent` is **exported from `src/api/profile-tags/index.js` and required by `src/api/event-tags/index.js`** — one definition of "the event as signed" across both inspection APIs (no cycle; precedent at `index.js:541`). The whitelist argument transfers with one correction stated plainly: this path has no remote leg, so ADR 0001's `verifiedSymbol` hazard cannot occur here — the whitelist is kept because the panel's contract is *"the event as signed"*, not *"whatever strfry emits"*, and because one shared projection is how the two panels stay one feature.

### D3 — Where the envelope is composed: client-side, at the union rule's existing home

AC-3 defines the set as "the same union rule the chips row itself uses" — and that rule is client code (`displayedTags`, `myStanceByCoord`). The panel therefore composes **in `NoteTags`**, from the same arrays the popover's numbers are the lengths of:

- every `t.applications` entry → `{ polarity: 'apply', counted: true, event: rawEvents[entry.eventId] }`
- every `t.disputes` entry → `{ polarity: 'dispute', counted: true, event: rawEvents[entry.eventId] }`
- the viewer's own stance for that coordinate (`myStanceByCoord`), **when its `mineEventId` is not already among those entries** → `{ polarity: stance, counted: false, event: rawEvents[mineEventId] }`

**`counted` is derived from channel membership, not from event bytes** — membership in `applications`/`disputes` *is* the server's POV verdict, exactly as the chip's own counts already read it; `mine`-and-not-counted is the server's viewer-union verdict. Nothing re-implements `bucketize`'s thresholds or the trust predicate client-side (the hazard ADR 0002 D1 flagged): the client classifies nothing, it labels by which server channel an entry arrived on. The three AC-3 cases fall out: ordinary chip → N+M blocks all `counted:true` (+ the viewer's uncounted one when applicable, marked); mine-only chip → exactly one block, `counted:false`, marked; viewer-trusted → their event appears once, `counted:true`, deduped by event id.

**Ordering (AC-3 "stable deterministic order"):** Story 2's total order, reused verbatim — polarity group (applications first), then `event.created_at` descending, then `event.id` lexicographic. Applied client-side after composition, so the panel's order never depends on strfry's incidental output order.

**Alternative considered — compose server-side (a `panelBlocks` field):** rejected; it would relocate the viewer-union to the server for this one consumer while the chips row keeps computing it client-side — two homes for the one rule AC-3 says must be *the same*, and the drift between them would be exactly the invisible mis-caption bug the envelope exists to prevent.

### D4 — Affordance wiring: gated props on `TagChip`, state in `NoteTags`

#### Option A — `TagChip` gains optional `rawOpen` / `onToggleRaw` / `rawNotice` props; `NoteTags` owns a per-instance open-set *(chosen)*
The button renders **only when `onToggleRaw` is passed** — `ProfileTagsSection` passes nothing, so profile pages, and every other `TagChip` consumer present or future, are byte-identical by default (ADR 0002 D5's explicit-prop-gate lesson: gate on the surface's intent, never on data presence). This is also ADR 0013's exact threading idiom (`showScores`), on the same component.
- **Button:** in the popover, after `.ptc-popover-actions`, `type="button"`, label `rawOpen ? 'Hide Raw Tagging Events' : 'Show Raw Tagging Events'`, `aria-expanded={rawOpen}`, `aria-controls=<panel id>`, **no `disabled` gate on `viewerPubkey`** (AC-1: inspection has no login gate; Apply/Dispute keep theirs), `onClick` → `e.preventDefault(); onToggleRaw();` — **no `setOpen(false)` anywhere** (AC-2).
- **State:** `NoteTags` holds `openRaw` — a `Set` of tag coordinates (`${authorPubkey}:${slug}`, the stable identity; `t.eventId` can be a synthesized fallback). Per-instance state gives per-note isolation and multi-open stacking for free (ADR 0002 D3's argument, one level up). Coordinate in, coordinate out — toggling one chip cannot touch another.
- **Panels:** rendered by `NoteTags` **between `<PovStatusNotice/>` and `.bsp-note-tags-row`** — inside the note card, below the note's content, above the chips row (AC-2's mandated slot), by mapping `displayedTags` and filtering on `openRaw` — which *is* the chips' display order, so stacking order is by construction. Each panel: `<section>` captioned with the tag's **name** (AC-2 attributability; exact wording is Director-delegated minutiae — default `Raw tagging events — <name>`), containing the shared blocks component (D5).

#### Option B — state and panel inside `TagChip`
**Cons.** The panel's mandated home is outside the chip subtree (above the chips row); state inside the chip would need a portal or lifting anyway — ADR 0001 D4's dead end, re-derived. Rejected.

**A composition consequence, stated so no one reads it as a bug:** opening a panel inserts content above the chips row, which pushes the chip (and its popover, `position:absolute` within it) down while the cursor stays put — so the unchanged cursor-leave rule will usually close the popover after a successful "Show". **The click did not close it; the layout shift moved the chip out from under a stationary cursor**, which is the composition of two mandated behaviors (the panel's slot, operator decision 3; cursor-leave-closes, AC-2). The story prices this path itself: *"the popover button is the toggle (re-hover the chip to hide); cheaper here than in Story 2 since summoning a popover is a hover."* Re-hovering shows "Hide Raw Tagging Events" — AC-1's label truth is carried by the `rawOpen` prop, not by popover persistence. Suppressing cursor-leave, auto-scrolling, or repositioning panels to avoid the shift would each violate a settled decision; none is taken.

### D5 — The `<RawEventPanel>` intake trigger has fired: extract now, scoped to the blocks renderer

#### Option A — extract within this story: promote `TagRowRawEvents` to the shared component *(chosen)*
Move `ui/src/components/TagRowRawEvents.jsx` → **`ui/src/components/RawTaggingEvents.jsx`** — same default export shape, same props (`{ assertions }`), same rendered markup, **same CSS class names byte-for-byte** (`bs-tag-row-raw-*` + shared `.bs-tag-raw-pre`), a generalized docblock. `TagPageRow.jsx` re-aims its import; the new note panel is the second consumer; the old file is deleted.
**Pros.** The third instance did exactly what the intake entry predicted — **revealed which parts are genuinely common** — and the answer is: the assertion-blocks renderer, *entirely*. Story 3's per-block needs (polarity caption, pubkey `<code>`, "not counted under this POV" marker, byte-faithful `<pre>`) are Story 2's component **verbatim, zero changes** — the "extraction" is a rename plus an import, not an abstraction. Keeping the class names makes AC-6's behavior-unchanged bar checkable byte-for-byte on the Story-2 surface, and Story 3 gets a shipped, tested component instead of a knowing copy (the `prd-seed`'s "expensive after three divergent one-offs" warning, honored on the cheap side of the curve). The re-aim is bounded and known: `test/tagging-raw-event-inspector-ui.test.js` retargets its file-path reads to the new filename, assertions unchanged (the intake entry's own condition: suites re-aimed, not dropped).
**Cons.** This story's diff touches a shipped Story-2 file (`TagPageRow.jsx`, one import line) — accepted; that line is exactly what the region-scoped source suite pins, so a regression fails loudly. The `bs-tag-row-raw-*` class names now render on a non-row surface — **cosmetic naming debt, deliberately kept** (renaming classes would touch Story 2's CSS and any class-selecting checks for zero behavior gain; recorded in Consequences).

#### Option B — third one-off now, refactor immediately after as the queued story
**Pros.** This story's diff stays purely additive; the refactor gets its own review.
**Cons.** Ships a third copy *in the same commit series that proves it's a copy*; the deferred story then performs the identical rename plus **three** suites' re-aims instead of one; it sits outside this book's frame, so "immediately after" realistically means the Low-priority queue. When the extraction has measured out to a rename, deferral buys review isolation for work that no longer carries the risk review isolation is for.

#### Option C — unify all three surfaces, including Story 1's definition panel
**Cons.** Story 1's panel is the revealed **outlier**: one POV-invariant event, no envelope, no polarity, no caption semantics — forcing it through an assertions-shaped component means fabricating `{polarity: none, counted: n/a}` or forking the component's contract on day one. Its genuine commonality with the others — the byte-faithfulness contract and the `<pre>` presentation — is *already shared* where it lives, in `toRawEvent` (D2 exports it) and `.bs-tag-raw-pre`. Rejected; recorded so the intake entry can close with the exclusion explained rather than looking forgotten.

**Decision: Option A.** The `_intake.md` entry is **discharged**: the Implementer flips it to DONE with a pointer here, noting the deliberate Story-1 exclusion and that the shared parts of Story 1 are the projection helper and the CSS class, not the blocks renderer.

### D6 — Degradation (AC-4) under the eager shape

- **Loading:** structural. Chips render only after `useEventTags` resolves; before that there is no chip, no popover, no button — "still being retrieved" has no reachable panel-shaped state. On a **refetch** after Apply/Dispute, state is replaced wholesale on success; on failure the previous consistent snapshot persists (counts and bytes from the same response — count-back holds within the snapshot) plus the existing error banner.
- **Unavailable:** `NoteTags` composes a chip's blocks before rendering its panel. **All-or-nothing per chip:** if *any* referenced id is missing from `rawEvents` (reachable only via deploy skew or a regression — the map is built from the same response by construction), the whole panel is withheld and the toggle instead sets a visible notice for that chip — rendered inside the popover as a hint line (the `.ptc-hint` idiom), popover staying open. A *partial* panel would break AC-3's count-back **silently**; the notice breaks it **loudly**, which is the only honest option for an inspector. No panel region renders, so nothing can read as "nobody asserted this."
- **Isolation:** per-chip composition + per-coordinate state ⇒ one chip's notice or panel cannot affect another chip or note (AC-4's last clause, by construction).
- **Styling:** panel wrapper takes new `bsp-note-tags-raw` / `bsp-note-tags-raw-caption` classes in the note-tags namespace; blocks inside are the shared component's existing classes; **`.bs-tag-raw-pre` and all `.ptc-*` rules are not modified** (AC-6 — `Tag.jsx`, `TagPageRow`, and `ProfileTagsSection` share them).

## Decision

| # | Decision |
|---|---|
| **D1** | **Eager** — `for-event` always carries the referenced raw events. Re-derived on this path's own measurements (792 B/event, 833 B → ~1.7 KB per tagged note, **0 B for untagged notes**, +~47 KB worst realistic page, uncompressed per OPEN.md #48) versus lazy's duplicate per-note pipeline + ~0.5 s spinner + a count-back timing hazard. Story 2's decisive per-tag-scan argument honestly does not apply here; the remaining arguments suffice. |
| **D2** | **Top-level `rawEvents: { [eventId]: 7-field projection }` side-table** built in `handleForEvent` from `candidates`, keyed to exactly the ids referenced by `tags[].applications ∪ disputes ∪ mine`. Core classifier untouched. `toRawEvent` exported from profile-tags and required — one definition of "as signed". |
| **D3** | **Client-side composition in `NoteTags`** into the shared `{polarity, counted, event}` envelope — `counted` = channel membership, never re-derived from bytes; viewer's own joined via `mineEventId`, deduped by event id; Story 2's total order (apply-first, `created_at` desc, id). |
| **D4** | `TagChip` gains optional **`rawOpen` / `onToggleRaw` / `rawNotice`** (absent ⇒ no button ⇒ profile chips byte-identical, per ADR 0002 D5 / ADR 0013 idiom). `NoteTags` owns `openRaw` (Set of tag coordinates); panels render between `PovStatusNotice` and the chips row in `displayedTags` order. Button enabled signed-out; no `setOpen(false)`; the post-open layout shift closing the popover via cursor-leave is the documented composition of two mandated behaviors, not a defect. |
| **D5** | **Extract now, scoped to the blocks renderer:** `TagRowRawEvents.jsx` → `RawTaggingEvents.jsx` (rename; identical props, markup, class names), consumed by `TagPageRow` and the new panel; Story 1's definition panel deliberately excluded (revealed outlier). `_intake.md` trigger discharged; Story-2 source suite re-aimed, not dropped. |
| **D6** | Degradation: loading is structural (pre-chips); unavailability is **all-or-nothing per chip** with a visible popover notice and no panel; per-chip/per-note isolation by construction. New `bsp-note-tags-raw*` wrapper classes only; no shared class modified. |

## Architecture invariants (CLAUDE.md) — explicit findings

**POV (invariant #1) — same side of the amended epic guardrail as ADR 0002, restated for this surface.** *What is this panel a panel of?* The evidence behind a per-POV number — so the **set** is per-POV **by construction** (the counted channels are `wot_rank_<povSuffix> >= minRank` output; the union adds only the viewer's own), and the **bytes** are POV-invariant and enforced: `toRawEvent` output carries no POV field, is never filtered or annotated per POV, and two POVs that both include an event render identical bytes. `counted` is the seam made explicit — the POV's verdict carried *beside* the bytes, never inside them. **Computed at read time, never stored** (invariant #3): `rawEvents` is a projection of the per-request scan; POV switching re-fires the effect (`useEventTags.js:108` deps) and re-derives everything in one response; nothing is denormalized, cached per-POV, or persisted. Reviewer check: no `povSuffix`/`wotPov`/`viewerPubkey` inside `toRawEvent`'s output or the composed `event` objects.

**Decentralized-first (invariant #2).** A tagging's author is arbitrary (the two real events are authored by ordinary users — vinney and the operator, no TA). No authorship gate, no auth gate: the button and panel work signed out; the WoT filter that shapes the *counted* set is a read-time trust filter, not a write-time permission, and the viewer-union plus `unverifiable` channel (untouched) keep un-counted speech visible in its designed places.

**No TA literal.** This feature needs no TA at all. `NoteTags.jsx`, `TagChip.jsx`, `RawTaggingEvents.jsx`, and the handler diff must contain no 64-hex constant, no `LEGACY_*` import, no `useConfig().taPubkey`. The pre-existing `CANONICAL_AUTHORITY` (`event-tags/index.js:34`) and the ADR-0015 named-exception literals are read through and unmodified; a diff removing `LEGACY_*` constants must be rejected (CLAUDE.md).

**Firmware reinstall required? No.** No concept definitions change; `nostr-event-tag` / `nostr-event` / `tag` are read-only context.

## Consequences

**What this enables.**
- The chips row's central claim — "Applied by N / Disputed by M, from this POV" — becomes auditable in-product on every note surface, signed in or out. Count the `counted:true` blocks, get the numbers back.
- The epic's answer to "page feature or product pattern?" now spans all three tag-family object types, and the pattern's shared core is named and shipped (`toRawEvent` + `RawTaggingEvents` + `.bs-tag-raw-pre`).
- `rawEvents` is a general byte channel on `for-event`: per-block copy-id, a signature-verify affordance, or an `unverifiable`-bucket inspector would all have data in hand.

**What this constrains.**
- `for-event` responses for tagged notes grow ~2× (measured 833 B → ~1.7 KB at 1 assertion; ~+860 B per additional assertion), **uncompressed on today's deployments** — this ADR leans on OPEN.md #48's fix landing eventually; the gzip win (~4×) is broad and cheap and now has a second endpoint arguing for it.
- The response now carries signed events: any future field must never spread a raw `ev` — the exported `toRawEvent` is the contract, and a set-equality test on one `rawEvents` value is how it stays one.
- `TagChip` grows three optional props (now serving two features and two affordance generations); its prop changes must consider both importers.
- The shared blocks component's `bs-tag-row-raw-*` class names render on a non-row surface — cosmetic naming debt, deliberate (D5); rename only in a story that owns both surfaces' CSS.

**New debt / follow-ups.**
1. **Unbounded eager payload, one trigger.** Mirroring ADR 0002 Consequences #1 with this path's arithmetic: a note with ~100 assertions ⇒ ~+86 KB on that note's response (uncompressed). **Concrete trigger to revisit: any real note exceeding ~100 total assertions** — the right first fix is the OPEN.md #48 gzip (4×), then a `?rawEvents=0` opt-out for non-inspecting callers (`TagANoteModal` is the only one today), before any lazy re-architecture.
2. **`_intake.md`:** the `<RawEventPanel>` entry is discharged (D5); the `<ActionsMenu>` entry **stands unchanged** — this story adds a button to a popover, no third `bsp-note-menu` dropdown; that count is still two.
3. **The popover-closes-on-layout-shift interaction** (D4) is correct-by-composition but worth a UX pass if operators find it jarring — any fix (scroll compensation, panel-below-chips) changes settled decisions and needs its own story.
4. **Story 2's node HTTP-contract suite honesty note applies here too:** the `for-event` contract tests run against a live stack (staging/local), not stack-free CI; the stack-free gate is the source-assertion suite. The Tester should carry that split forward explicitly.

**Firmware reinstall required?** **No.**

## Implementation notes

Concrete, in dependency order. The Implementer should not need to re-derive anything above.

- **`src/api/profile-tags/index.js`** — add `toRawEvent` to `module.exports` (`:1820`). **No other change**; do not move or edit the function (`:764-773`).
- **`src/api/event-tags/index.js`**
  - Top: `const { toRawEvent } = require('../profile-tags');` (no cycle — verified; precedent `:541`).
  - `handleForEvent`, after the classify call (`:176-178`), before `res.json` (`:180`):
    ```js
    // tag-event-inspector #3 / ADR 0003 D1-D2. The byte source for the raw-
    // tagging-events panel: every event the response's channels reference,
    // exactly once, as the as-signed 7-field projection (shared toRawEvent —
    // whitelist, never a spread). Side-table keyed by id; the channels are
    // untouched and the client joins entry.eventId → bytes. Bytes are POV-
    // invariant; WHICH ids are referenced is this POV's verdict (epic guardrail).
    const referenced = new Set();
    for (const t of tags) for (const e of [...t.applications, ...t.disputes]) referenced.add(e.eventId);
    for (const m of mine) referenced.add(m.eventId);
    const rawEvents = {};
    for (const c of candidates) if (referenced.has(c.id)) rawEvents[c.id] = toRawEvent(c);
    ```
    and add `rawEvents` to the response object. Always present (possibly `{}`) — the "always assign" convention. **Do not touch** `handleForTag`, `aggregateNotesTagged`, `handleTagIndex`, `handleNotesByAuthor`, or `CANONICAL_AUTHORITY`.
- **`ui/src/hooks/useEventTags.js`** — carry the field: `const [rawEvents, setRawEvents] = useState({});` reset in the `!eventId` branch (`:52`), `setRawEvents(forEvent.rawEvents || {})` beside `setTags`/`setMine` (`:97-98`), and return it (`:110`). No other change; `povParams` deps already re-derive on POV switch.
- **`ui/src/components/RawTaggingEvents.jsx`** — **new file = `TagRowRawEvents.jsx` moved** (D5): identical default export, props `{ assertions }`, markup, and class names (`bs-tag-row-raw-list/block/caption/polarity/author/uncounted`, `bs-tag-raw-pre`). Generalize the docblock: consumed by the profile-row inspector (Story 2) and the note-chip inspector (Story 3); note the class-name debt deliberately. Delete `TagRowRawEvents.jsx`.
- **`ui/src/components/TagPageRow.jsx`** — re-aim the import to `./RawTaggingEvents`. **No other change.**
- **`ui/src/components/TagChip.jsx`** — new optional props `rawOpen`, `onToggleRaw`, `rawNotice` (document beside `myStance`/`showScores`). Inside `.ptc-popover`, **after** `.ptc-popover-actions` and before the `!viewerPubkey` hint:
  ```jsx
  {onToggleRaw && (
    <button
      type="button"
      className="ptc-btn ptc-btn-raw"
      aria-expanded={!!rawOpen}
      onClick={(e) => { e.preventDefault(); onToggleRaw(); }}
    >
      {rawOpen ? 'Hide Raw Tagging Events' : 'Show Raw Tagging Events'}
    </button>
  )}
  {rawNotice && <div className="ptc-hint" role="status">{rawNotice}</div>}
  ```
  **No `disabled={!viewerPubkey}`** on this button (AC-1); **no `setOpen(false)` anywhere new** (AC-2). No change to hover/focus/Escape/blur handlers, the score trio, or any existing markup.
- **`ui/src/components/NoteTags.jsx`**
  - State: `const [openRaw, setOpenRaw] = useState(() => new Set());` and `const [rawNotices, setRawNotices] = useState({});` (coordinate-keyed). Destructure `rawEvents` from `useEventTags`.
  - Composition (D3), near `myStanceByCoord`:
    ```js
    // tag-event-inspector #3 / ADR 0003 D3. The evidence blocks behind one chip,
    // composed from the SAME arrays the popover's numbers are the lengths of —
    // count-back is structural. `counted` = which server channel the entry rode
    // in on (applications/disputes = this POV's counted verdict; mine-and-not-
    // counted = the viewer-union), never re-derived from event bytes.
    const rawBlocksFor = (t) => {
      const entries = [
        ...t.applications.map((e) => ({ polarity: 'apply', counted: true, id: e.eventId })),
        ...t.disputes.map((e) => ({ polarity: 'dispute', counted: true, id: e.eventId })),
      ];
      const s = myStanceByCoord.get(`${t.authorPubkey}:${t.slug}`);
      if (s && !entries.some((b) => b.id === s.mineEventId)) {
        entries.push({ polarity: s.stance, counted: false, id: s.mineEventId });
      }
      const blocks = entries.map((b) => ({ polarity: b.polarity, counted: b.counted, event: rawEvents[b.id] }));
      if (!blocks.length || blocks.some((b) => !b.event)) return null; // AC-4: all-or-nothing per chip
      return blocks.sort((a, b) =>
        (a.polarity === b.polarity ? 0 : a.polarity === 'apply' ? -1 : 1)
        || (b.event.created_at - a.event.created_at)
        || a.event.id.localeCompare(b.event.id));
    };
    ```
    (`mine` entries must expose `stance` + `mineEventId` through `myStanceByCoord` — they already do via the hook's enrichment, `useEventTags.js:89-94`.)
  - Toggle handler per chip: if `rawBlocksFor(t)` is `null` → set that coordinate's notice to `'Raw tagging events unavailable'` (clear it on a later successful toggle); else toggle the coordinate in `openRaw`.
  - Pass to `TagChip` (only here — `ProfileTagsSection` is untouched): `rawOpen={openRaw.has(coord)}`, `onToggleRaw={() => toggleRaw(t)}`, `rawNotice={rawNotices[coord]}`.
  - Panels, **between `<PovStatusNotice/>` (`:108-110`) and `.bsp-note-tags-row` (`:112`)**:
    ```jsx
    {displayedTags.filter((t) => openRaw.has(`${t.authorPubkey}:${t.slug}`)).map((t) => {
      const blocks = rawBlocksFor(t);
      if (!blocks) return null;
      return (
        <section
          key={`raw-${t.authorPubkey}:${t.slug}`}
          className="bsp-note-tags-raw"
          aria-label={`Raw tagging events for ${t.name}`}
        >
          <p className="bsp-note-tags-raw-caption">Raw tagging events — {t.name}</p>
          <RawTaggingEvents assertions={blocks} />
        </section>
      );
    })}
    ```
    `displayedTags` order = the chips' display order (AC-2 stacking). Caption wording is Director-delegated minutiae.
- **`ui/src/styles.css`** — append `.bsp-note-tags-raw` (container: the `.bs-tag-row-raw` look — border-left/padding — is the visual family) and `.bsp-note-tags-raw-caption`; a `.ptc-btn-raw` rule if the shared `.ptc-btn` needs a variant. **Do not modify** `.bs-tag-raw-pre`, any `.bs-tag-row-raw-*`, or any existing `.ptc-*` rule.
- **`engineering-team/stories/_intake.md`** — flip the 2026-07-16 `<RawEventPanel>` entry to DONE per D5 (pointer to this ADR; Story-1 exclusion noted). Leave the `<ActionsMenu>` entry untouched.
- **`test/tagging-raw-event-inspector-ui.test.js`** — re-aim file-path reads from `TagRowRawEvents.jsx` to `RawTaggingEvents.jsx`; assertions unchanged (D5; the Tester owns the new story's suites).

## Out of scope

- **Profile pages' own tag chips**, per-block copy actions, a close affordance on the panel, pagination/capping/collapsing, syntax highlighting/JSON trees/copy-blob, client-side signature verification, showing non-viewer assertions outside the POV's WoT, the `unverifiable` bucket's UI, and the "Note vs Event" vocabulary question — all per the story.
- **Any change to `for-tag`, the note-TL path, `TagANoteModal`, `AddTagDialog`, `NoteActionsMenu`, `Tag.jsx`, or the Story-1/Story-2 panels' behavior** (Story 2's file is touched only by D5's one-line import re-aim).
- **A `?rawEvents=0` opt-out and the OPEN.md #48 gzip fix** — named as the first levers if the Consequences #1 trigger fires; not built here.
- **Renaming the `bs-tag-row-raw-*` classes** to a surface-neutral family — cosmetic; only in a story owning both surfaces' CSS.
- **Any mitigation of the post-open layout shift** (scroll compensation, panel repositioning) — would alter settled placement/popover decisions; needs its own story if wanted.
