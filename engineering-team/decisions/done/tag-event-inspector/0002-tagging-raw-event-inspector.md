# ADR 0002: Tagging raw-event inspector — ship the assertions with the counts, gate the affordance on a prop

**Status:** Accepted
**Date:** 2026-07-16
**Story:** `engineering-team/stories/tag-event-inspector/2-tagging-raw-event-inspector.md`
**Book:** `engineering-team/audits/profile-tagging-inspector/book.md` (Open)
**Builds on:** tag-event-inspector ADR 0001 (the raw-event panel this parallels — and, on D1, **the precedent this ADR declines to follow blindly and then re-adopts on different evidence**), ADR 0010 (`aggregateProfilesTagged`, the helper this extends), ADR-0004 (the viewer-union whose semantics D2 must preserve exactly), ADR 0014/0016 (the row reshape + `⋯` overflow menu this extends), profile-tag-hardening ADR 0001 (the `#a`/`#e` read-union whose output D1 serializes).

**Citation hygiene:** ADR ids are epic-scoped — cite as **tag-event-inspector ADR 0002**. This ADR introduces **no pubkey literal of any kind** and needs no TA: a tagging's author is arbitrary runtime data read off the event. See "Architecture invariants".

## Context

Story #2 puts the signed assertions behind a profile row's `+N −M` on the tag detail page, reachable from that row's `⋯` at every viewport width. Four decisions arrive settled (story §"Product decisions"): show **all** the events behind the counts; make the `⋯` reachable at every width; tag page **only**; the menu **closes** on select. This ADR answers the story's four open questions and decides structure.

### The measurement that decides D1 — and refutes the PO's own warning

The story's open question (c) warns: *"Story 1 shipped rawEvent inside the existing response… THAT TRADE DOES NOT TRANSFER… the lazy-on-open option Story 1 rejected is likely right this time."* That warning rests on an arithmetic sketch — "N+M events × R rows, and `aos-2026-participant` has 99 rows" — which implies a multiplier of roughly 99×N. **Measured, it is not true.** I measured rather than inherited the anxiety:

| Fact | Measured value | How |
|---|---|---|
| A tagging event, 7 canonical fields, compact JSON | **868 B** mean / 872 median / **875 max** (n=400) | `docker exec tapestry strfry scan '{"kinds":[39999],"#z":["…nostr-user-tag"],"limit":400}'`, projected to the 7 fields and measured. Heavier than ADR 0001's 641 B tag definition: it carries `d`/`e`/`p`/`polarity`/`z` tags + ~180 B content. |
| Mean assertions **per row**, across all 49 staging tags | **1.10** — not 4 | Sum of `applications+disputes` ÷ sum of rows, live. |
| Worst tag on staging (`aos-2026-participant`) | 99 rows, **108** assertions total | Live `profiles-tagged`. |
| Eager cost at that worst case, **raw** | 38,632 B → **134,007 B** (3.5×) | Built the augmented body from 108 real events, measured. |
| Eager cost at that worst case, **gzipped — the wire** | 14,889 B → **36,570 B** (2.5×, **+21 KB**) | `gzip.compress(level=6)` on both bodies. |

So the real eager cost is **+21 KB gzipped on the single worst tag on staging**, and single-digit KB on a typical one — because the mean is 1.10 events per row, not 4. The story's "×99" framing conflated *rows* with *events per row*. **Recorded plainly because it inverts the story's stated recommendation, and a reviewer will otherwise read D1 as the Architect ignoring the PO.** It is not: it is the Architect measuring the thing the PO flagged for measurement, which is exactly what open question (c) asked for ("re-derive from scratch").

### Other facts verified in code and against the running stack (2026-07-16)

| Fact | Evidence |
|---|---|
| The endpoint's **only** UI caller is the tag page. | `grep` across `ui/src`: sole hit `ui/src/hooks/useTagDetail.js:85`. No other client pays for anything added here. |
| `aggregateProfilesTagged` scans **per tag, not per target** — one pass covers every row. | `src/api/profile-tags/index.js:642-653`: two `federatedScan` filters (`#e` legacy + `#a` versions) then `dedupeReplaceable`. This single fact rules out Option B in D1. |
| The events are already in memory at mount and then thrown away. | `:669-685` — the loop reads `deduped`, buckets, and keeps only integer counters in `byTarget`. |
| The helper's contract already says response-shaping is the **caller's** job. | `:629-631` verbatim: *"No response-shape enrichment (no displayName/picture, no sort, no viewer-union) — that's the caller's job."* D2's seam follows this rather than fighting it. |
| The helper is **shared** with the TL path — and adding a field to `byTarget` entries **cannot** leak into a published event. | `src/api/trustedList/refreshPinnedTags.js:156` destructures `{ byTarget }` only; `applyDisputesFunction` (`:104-119`) **whitelists** `{pubkey, endorsements, disputes}` into `members` rather than spreading the entry. Checked precisely because a leak here would bloat a signed kind-30392 TL. |
| No test pins an exact key set on `profiles-tagged` rows ⇒ an additive field is safe. | `test/tag-detail.test.js:234-252` and `tag-detail-curated-view-and-pin-polish.test.js:230-248` use presence checks (`'nip05' in firstRow`). The only `assertSetEqual(Object.keys(…))` in the suite is `tag-detail.test.js:135`, and it targets **`tag.rawEvent`** (ADR 0001's field on `by-id`), not these rows. |
| Polarity lives **in the event**, and defaults to apply when absent. | `readPolarity` `:141-146` (a `polarity` tag; **`return 1` when missing**), `bucketize` `:148-152` (`>=0.5` apply, `<=-0.5` dispute, else **neutral**). Neutral events are scanned, deduped, and counted in **neither** bucket (`:675 continue`). |
| **`TagSomeoneModal` passes the `profiles-tagged` row object by reference.** | `ui/src/components/TagSomeoneModal.jsx:196`: `const row = existingRow || {…}`, where `existingRow = rowsByPubkey?.get?.(pubkey)`. **A data-presence gate would leak the affordance into the modal**, violating story decision 3. See D5. |
| `.bs-tag-row-overflow` is shared by both surfaces. | `ui/src/styles.css:5024-5035`. **Deleting the wide `display:none` would sprout a `⋯` on the modal's rows too.** See D5. |
| The reveal group. | `styles.css:4978-4995` — `:hover`, `.is-expanded-mode`, `:focus-within`. `:focus-within` is what keeps a trigger visible while its own menu is open. |
| The full-width-child precedent inside the row. | `.bs-tag-row` is `display:flex; flex-wrap:wrap`; `.bs-tag-row-error` uses `flex-basis:100%` to wrap onto its own line below the row content. |
| The row menu already closes on a successful action. | `TagPageRow.jsx:339` renders `renderActionsMarkup(true)` → `closeAfter:true` → `handleClick` `:106` calls `closeOverflow()`. Story decision 4 follows this local convention, not the header menu's. |

### Concept orientation (three-call pattern, AGENTS.md §3)

- `39998:<TA>:nostr-user-tag` — **nostr user tag**. The graph's normative definition is the story's premise: *"an assertion that a specific nostr user (pubkey) belongs to a tag category. **Each element** links a target pubkey to a tag event ID (kind 39999 in the tag concept), with optional polarity."* Many elements per (tag, target).
- `39998:<TA>:nostr-event` — **nostr event**. Seven fields, the normative list D1 serializes (quoted in full in ADR 0001's D1).
- `39998:<TA>:tag` — **tag**. Context only; its definition event is ADR 0001's subject.

The local graph answers `<TA>` = `e00ed090…9df36` while CLAUDE.md documents `82b75e47…973833` (that staleness is **OPEN.md #44**; `82b75e47…` is in fact the ADR-0015 *legacy z-tag literal*, a different role). The divergence is live proof of the no-hardcode rule. **No concept definitions change ⇒ no firmware reinstall.**

## Options considered

### D1 — Where the assertions come from

#### Option A — add `assertions` to each row of `profiles-tagged` *(chosen)*
The events are at `:669` already; projection and grouping are the only new work.
**Pros.** Zero extra round-trips, **zero extra scans**. No loading/error/race states — the panel renders from data the page already has, so AC-5's "nothing throws" collapses to a null check and its "still being retrieved" clause is served by the existing `rowsLoading` → *"Loading profiles…"*. **AC-4's count-back invariant holds by construction**: counts and assertions come from one aggregation in one response, so they cannot drift. Testable by the **existing node HTTP-contract suite** (`test/tag-detail*.test.js`) — which matters disproportionately, since the node harness cannot transpile JSX and this is the only mechanically-cheap half of the story. Additive and backward-compatible (ADR-0009 set that precedent; the key-set check above confirms it's safe here). **Composes with pagination**: `assertions` hangs off each row, so if row pagination lands (a known follow-up), the assertions paginate with it for free.
**Cons.** Every tag-page view carries assertions for panels most viewers never open: **+21 KB gzipped at staging's worst tag**, single-digit KB typically. Grows linearly with a tag's popularity, unbounded (story put capping out of scope).

#### Option B — a lazy per-row endpoint (`?tagEventId=…&targetPubkey=…`)
**Pros.** Smallest possible payload per open (~1–4 events).
**Cons.** **Architecturally wrong, and this is decisive.** The scan is *per tag* (`:642-653`), not per target — so serving one row's events means re-scanning the **whole tag**: two `federatedScan`s (one shelling out to a `strfry scan` subprocess, one hitting remote relays via `SimplePool`) plus a `meiliFetchProfilesByPubkey` over every author. Open four panels → four whole-tag scans. It trades a cheap resource (gzipped bytes) for the most expensive one on the path, and multiplies it by user curiosity. Rejected.

#### Option C — lazy whole-tag refetch (`?includeRawEvents=1`, client-cached)
Mount stays lean; the first panel open re-fetches the same URL with a flag; one response serves every row's panel.
**Pros.** Zero cost on views that never open a panel — the honest version of "don't pay for what nobody opens". No new route.
**Cons.** Pays **one full duplicate whole-tag scan** (the same expensive triple as B, once) to re-obtain events the mount already held in memory. Introduces loading/error/race states into an inspector whose entire value proposition is fidelity — precisely where AC-5's degradation matrix multiplies. Splits the counts and the assertions across two responses, so AC-4's count-back invariant becomes a *timing* property rather than a structural one (an assertion published between the two requests desynchronizes them). Moves the only mechanically-testable half of the story out of the node harness and into Playwright.

**Decision: Option A**, with a **whitelisted projection** and a **`{polarity, counted, event}` envelope** (below).

The "+21 KB on views that never open a panel" objection is the honest cost and deserves a straight answer, not a dismissal. It loses on four counts. **(i) Wrong marginal byte.** The same response drives **99 `<img>` avatars** on that same worst-case page — hundreds of KB to megabytes of images. 21 KB of gzipped JSON is not what makes this page heavy, and Option C spends an expensive scan to save it. **(ii) The expensive resource is the scan, not the bytes.** A/B/C differ by ~21 KB of gzip and by *zero vs one vs N* whole-tag federated scans. Optimizing the cheap axis by inflating the expensive one is backwards. **(iii) Correctness is structural under A.** AC-4 says a reader must count the blocks and get the row's numbers; under A both sides are computed by one call to one function in one request. Under C they are two requests that can disagree. Buying byte-efficiency with a correctness *timing* hazard, in a feature about trustworthiness, is the wrong trade — the same shape of argument ADR 0001 made, now on measured rather than assumed numbers. **(iv) It degrades with the page, not against it.** A's cost scales with the row count; the row list is already unbounded and already heavier per row than its assertions. The panel is never the binding constraint, and the fix for the row list (pagination) fixes both at once — see Consequences.

**What is serialized — the same 7-field whitelist as ADR 0001, and for the same reasons, only more so.** `toRawEvent(ev)` already exists in `src/api/profile-tags/index.js` from ADR 0001 D1 (projecting `id, pubkey, created_at, kind, tags, content, sig` in canonical order, never a spread). Reuse it verbatim. The reasoning ADR 0001 gave carries and strengthens: these events come off the **same `federatedScan`** whose remote leg (nostr-tools `SimplePool`) attaches `verifiedSymbol` — a `Symbol`, dropped by `JSON.stringify` today, but resting on a third-party implementation detail. Here we serialize **N events per row across every row** instead of one per page, so a leak would be N× wider. One whitelist, already written, already tested at `tag-detail.test.js:135`.

**The envelope: `{ polarity, counted, event }`, not a bare event.**

- **`polarity`** (`'apply' | 'dispute'`) — AC-4 requires each block be identifiable *"without parsing JSON by eye"*. The polarity is derivable from the event (a `polarity` tag, defaulting to 1), but deriving it **client-side would duplicate `bucketize`'s ±0.5 thresholds and its absent-tag default across the wire**. A future server-side threshold change would then silently mis-caption blocks — a block labelled "applied" that the server counted as a dispute, which is exactly the count-back invariant failing invisibly. The server already computed the bucket at `:673-674`; emit it.
- **`counted`** (boolean) — **this is the one place I sharpen AC-4 rather than merely implement it, so flagging it explicitly for the PO.** AC-4 promises "count the blocks, get the row's numbers", and separately requires the viewer-union (an `onlyViewerVisible` row reading `+0 −0` must still show the viewer's own event). Those two requirements **collide** in a case AC-4 doesn't name: a viewer whose own assertion fails the POV's WoT filter, on a row that *also* has trusted assertions. Then `onlyViewerVisible` is **false** (counts aren't zero, so no badge renders), the counts read `+2 −0`, and the union puts **three** blocks in the panel. The reader counts 3 against a `+2` and has no way to tell which block the number doesn't account for. `counted:false` marks exactly the blocks that don't contribute, making the promise precise and mechanically testable: **count the blocks with `counted:true` and you get the row's numbers — always, for every row, including that one.** It generalizes cleanly (the only way to be uncounted *is* the viewer-union) and costs one boolean.
- **`event`** — the untouched 7-field projection. `JSON.stringify(entry.event, null, 2)` stays byte-faithful; the envelope carries the server's classification *beside* the bytes, never inside them.

**Field name: `row.assertions`.** The graph's own word for the object (*"a nostr-user-tag is an **assertion**"*). Noted and accepted: it sits near the response's existing top-level `viewerAssertions` map, a different shape for a different job — the `row.` prefix and the array-vs-map distinction carry it, and inventing `rawAssertions` to dodge a collision that the prefix already resolves would be worse.

### D2 — Where the assertions get built: the helper, or its caller?

#### Option A — return `authorAllowed` from the helper; the **handler** builds `row.assertions` *(chosen)*
`aggregateProfilesTagged` returns `{ byTarget, deduped, wotFiltering, authorAllowed }`; `handleProfilesTagged` composes the union and the shape.
**Pros.** Honors the helper's **own documented contract** verbatim (`:629-631`: *"No response-shape enrichment … that's the caller's job"*) — response shape stays in the handler, aggregation stays in the helper. The viewer-union already lives in the handler (`:928-949`), which is the only place `viewerPubkey` exists, so the union logic stays in one file. **Zero cost to the TL path**: `refreshPinnedTags` destructures `{ byTarget }` and never asks for assertions, so it builds no projections. `authorAllowed` is a closure over Meili docs the helper **already fetched** (`:657-665`) — returning it lets the handler reuse the WoT verdict without a second Meili round-trip.
**Cons.** Returning a function from a data helper is mildly unusual. Mitigated: it is a pure predicate, already computed, and the alternative is strictly worse (below).

#### Option B — a `collectAssertions: true` flag on the helper
**Cons.** Puts response-shaping *inside* the helper, contradicting its stated contract; needs `viewerPubkey` threaded in (a param the TL path must then pass as `undefined`, where the union would be wrong anyway); and grows the helper's return by a shape only one of its two callers wants.

#### Option C — rebuild the WoT predicate in the handler from `deduped`
**Cons.** A **second** `meiliFetchProfilesByPubkey` over every author, per request — duplicating the helper's most expensive non-scan step to recompute a verdict it just computed. Two sources of truth for "is this author trusted", which is the one question the counts turn on.

**Decision: Option A.**

### D3 — Component structure, and whether the shared-`<ActionsMenu>` trigger has fired

ADR 0001 D2 recorded in `_intake.md`: *"Extract a shared `<ActionsMenu>` shell… **Do it when a third `⋯` menu appears** — two call sites under-determine the abstraction, three reveal it."* A reviewer will ask whether this story is that third. **It is not, and the reasoning matters:**

The recorded trigger counts **`bsp-note-menu` dropdowns** — the click-to-toggle / click-outside-close / transient-flash / stays-open shell that `NoteActionsMenu` and `TagActionsMenu` share, class-for-class. `TagPageRow`'s overflow is **not one of them**: different classes (`bs-tag-row-overflow-*`), different anatomy (scores + help text + action buttons, not a list of `role="menuitem"` copy actions), different form factor (a `position:fixed` bottom sheet with a backdrop under 769px), and an **opposite** close convention (`closeAfter:true`, `TagPageRow.jsx:339`). It was never the shell the note said to extract. Story #2 adds **no new menu at all** — it adds one item to a menu that has existed since ADR 0016. **The count of `bsp-note-menu` dropdowns after this story is still two.** The trigger has not fired; `_intake.md`'s entry stands unchanged. The `prd-seed`'s warning about "three divergent one-offs" is about *raw-event inspection surfaces*, which this ADR addresses in Consequences, not about menu shells.

**Decision: extend `TagPageRow` in place; extract one small presentational component for the panel** (`ui/src/components/TagRowRawEvents.jsx`) so the row doesn't grow ~30 lines of block-rendering. `TagPageRow` keeps the toggle state and the menu item.

**State lives in `TagPageRow` — and here the contrast with ADR 0001 D4 is instructive.** In story #1 the menu and the panel were siblings whose only common ancestor was `Tag.jsx`, so state was forced upward. Here **both live inside the same `<li>`**, so per-instance `useState(false)` in `TagPageRow` is the natural home — and AC-3's *"several rows may have panels open at once; opening one does not close another"* falls out **for free** from per-instance state. No lifting, no props from `Tag.jsx`, no coordination.

### D4 — The close-on-select, and how the width split is expressed

Story decision 4 (menu closes at both widths) is settled; the mechanism is not. **Reuse the existing `closeAfter` path**: `handleClick`'s `opts.closeAfter` (`:100-112`) already calls `closeOverflow()`. The raw item is not a publish, so it calls `closeOverflow()` directly rather than routing through `handleClick`.

**The width split (AC-2: wide menu carries only the raw item) is CSS-only, not JS.** The component renders the full menu at every width; `@media (min-width:769px)` hides the scores, the help line, and the in-menu actions with **`display:none`** (not `visibility`) so they leave the accessibility tree too, satisfying AC-2's "contains only" for screen readers as well as eyes. Rejected: `window.matchMedia`, which `TagPageRow.jsx:165` already uses for `handleLinkClick`. It is evaluated at *click* time and does not react to a window resize — a viewer who resizes with the menu open would see a stale menu, and a resize listener is machinery CSS gives us free and correct.

### D5 — Keeping the modal untouched: two leaks a naive implementation would ship

Story decision 3 says the "Tag someone" modal is untouched. Both mechanisms that would break it are shared, and neither is obvious:

1. **Data-presence gating leaks.** `TagSomeoneModal.jsx:196` does `const row = existingRow || {…}` where `existingRow` comes from `rowsByPubkey` — **the actual `profiles-tagged` row object, by reference**. Any hit already in the tagged list therefore arrives at `TagPageRow` carrying `row.assertions`. Gating the item on `row.assertions?.length` would render it in the modal for exactly those rows. **⇒ gate on an explicit prop**, `showRawEvent` (default `false`), passed only from `Tag.jsx`. Matches the file's existing `showActions` / `scoresAlwaysVisible` prop idiom.
2. **The wide-visibility CSS leaks.** `.bs-tag-row-overflow`'s `display:none` above 769px (`styles.css:5033-5035`) is shared. Deleting it puts a `⋯` on the modal's rows at desktop width. **⇒ scope the override positively**: `TagPageRow` adds a class (`is-raw-enabled`) to the `<li>` when `showRawEvent` is true, and only `.bs-tag-row.is-raw-enabled .bs-tag-row-overflow` overrides the wide `display:none`. The base rule is untouched, so the modal stays byte-identical at every width and AC-6's "modal untouched" holds **structurally** rather than by test.

**Decision: prop gate + positively-scoped CSS override.** One prop drives both.

### D6 — Styling

**Wide-viewport reveal uses `visibility`, not `display`.** Inside the scoped override the trigger takes `display:inline-flex; visibility:hidden`, joining the existing reveal group (`:hover`, `.is-expanded-mode`, `:focus-within`). `visibility` — not `display:none` — because the row's established **reserved-width no-jiggle invariant** (`.bs-tag-row-actions { min-width:9.5rem; visibility:hidden }`, `styles.css` `:4967-4983`) means slots hold their width permanently and only toggle visibility. A `display` toggle would reflow the row on hover, which is the exact defect that invariant exists to prevent. `:focus-within` is load-bearing twice over: it keeps the trigger visible while its own menu is open (the menu lives inside `.bs-tag-row-overflow`, inside the row), which a `:hover`-only rule would break the instant the pointer entered the dropdown.

**The panel reuses ADR 0001's `<pre>` styling.** `.bs-tag-raw-pre` (`white-space:pre-wrap; word-break:break-all; max-height:60vh; overflow-y:auto`) already solves this exact problem and is already on the page. Reusing it is how "the two raw-event panels look like one feature" gets enforced in CSS rather than hoped for — the same argument ADR 0001 D6 made for reusing `bsp-note-menu*`. It also closes the 1280px horizontal-overflow path for free: 64-char ids and 128-char sigs have no break opportunities, and `break-all` + `pre-wrap` mean the `<pre>` never scrolls horizontally. New wrapper classes take the row's `bs-tag-row-raw-*` convention. **Do not modify `.bs-tag-raw-pre`** — `Tag.jsx:275` shares it (AC-6).

**The panel wraps below its row** via `flex-basis:100%`, the in-file precedent set by `.bs-tag-row-error`. It renders **after** the error line so a transient publish error stays adjacent to the row content rather than being pushed below a JSON blob.

**The float-right** (AC-2) wraps `renderActionsMarkup(true)` and the raw button in a flex row with `margin-left:auto` on the button — the same mechanism `.bsp-note-menu` uses (`styles.css:7551`). **The button must NOT go inside `renderActionsMarkup`**: that helper is shared with the inline row (`:294`), where it would become hover-only *and* break the reserved-width invariant.

## Decision

| # | Decision |
|---|---|
| **D1** | **Option A** — `profiles-tagged` rows carry `assertions: [{ polarity, counted, event }]`, `event` being ADR 0001's existing 7-field `toRawEvent` whitelist. Chosen on **measured** numbers (+21 KB gzipped worst case), which refute the story's own ×99 sketch. `counted` sharpens AC-4's count-back promise into an exact, testable invariant. |
| **D2** | **Option A** — `aggregateProfilesTagged` additionally returns `authorAllowed`; `handleProfilesTagged` builds `row.assertions`. Honors the helper's documented "shaping is the caller's job" contract; zero cost to the TL path; no second Meili fetch. |
| **D3** | Extend `TagPageRow` in place + a presentational `TagRowRawEvents.jsx`. **The shared-`<ActionsMenu>` trigger has NOT fired** — this adds no `bsp-note-menu` dropdown; the count stays at two. Toggle state is per-row `useState`, which gives AC-3's multi-open for free. |
| **D4** | Close on select via the existing `closeOverflow()`. The width split is **CSS-only** (`display:none` above 769px on the menu's scores/help/actions), never `matchMedia`. |
| **D5** | **Prop gate `showRawEvent` (default false) + positively-scoped CSS (`.is-raw-enabled`)** — the two leaks that would otherwise put this in the "Tag someone" modal, one via `TagSomeoneModal.jsx:196`'s by-reference row, one via shared CSS. |
| **D6** | Wide reveal via **`visibility`** (the no-jiggle invariant), joining `:hover`/`.is-expanded-mode`/`:focus-within`. Panel reuses `.bs-tag-raw-pre`; wraps via `flex-basis:100%`; float-right via `margin-left:auto` **outside** `renderActionsMarkup`. |

## Architecture invariants (CLAUDE.md) — explicit findings

**POV (invariant #1) — this ADR lands on the opposite side of the line from ADR 0001, deliberately.** Per the epic guardrail **as amended at the #2 reopen** (the original wording, written for story #1, would read as forbidding this story):

- **The bytes: POV-invariant, and enforced.** Each `event` is the 7-field projection of the signed bytes. It is not POV-namespaced, not POV-annotated, not altered per POV. Two viewers with different POVs who both see a given block see **identical** bytes. Reviewer check: no `povSuffix` / `wotPov` / `viewerPubkey` appears *inside* `toRawEvent`'s output.
- **The set: per-POV by construction, and that is correct.** Which assertions appear is `authorAllowed` — i.e. `wot_rank_<povSuffix> >= minRank` — unioned with the viewer's own. That is not a violation of POV-first; it is an expression of it. The panel's contract is *"the events behind **this POV's** `+N −M`"*, and that number is per-POV, so its evidence must be. Applying ADR 0001's "no POV filter" finding here would be the category error in the other direction: it would show a reader events that their own counts do not include.
- **Computed at read time, never stored** (invariant #3). `assertions` is a projection of a per-request scan. Nothing is denormalized, no per-POV column is provisioned, nothing is cached. Switching POV re-derives on the next request, exactly as the counts do.
- The `counted` flag is the seam made explicit: it is precisely "did this event pass *this POV's* filter", carried beside bytes that never move.

**Decentralized-first (invariant #2).** A tagging's author is **arbitrary** — reflex-check #3 ("could anyone else publish their own version of this?") answers yes, and the live proof is that these events' authors are ordinary users, not any TA. So: no authorship gate at display; `TagRowRawEvents` performs **no** check on who authored a block. No auth gate either — AC-2 requires the item signed out, and the trigger's existing render condition (`hasAssertions || verificationScore != null || showActions`, `:302`) is already satisfied signed-out on any tag-page row that has counts. The WoT filter that *does* apply is a **read-time trust filter, not a write-time permission** — which is the distinction invariant #2 draws.

**No TA literal.** This feature needs no TA at all: authors, polarity, and bytes are runtime data read off the events. `TagRowRawEvents.jsx` and `TagPageRow.jsx` **must not** import `LEGACY_TA_PUBKEY` / `LEGACY_Z_TAG_PUBKEY`, call `useConfig().taPubkey`, or contain a 64-hex constant. ADR-0015's named exception governs `z`-tag concept-handle composition — the server's existing `NOSTR_USER_TAG_Z_TAG` scan filter (`:60`), which this ADR **reads through and never rewrites**. A reviewer seeing `LEGACY_*` removed in this diff must reject.

**Firmware reinstall required? No.** No concept definitions change; `nostr-user-tag` / `nostr-event` / `tag` are read-only context.

## Consequences

**What this enables.**
- The page's central claim about a profile — its `+N −M` — becomes auditable in-product, at every viewport width, signed in or out. A reader can count the `counted:true` blocks and reproduce the number.
- It answers the `prd-seed`'s carry-forward question (*"a page feature or a product pattern?"*) with **pattern**, and does so on a second object type with a second cardinality (one → many), which is the harder half of the generalization.
- `row.assertions` is a general per-row evidence channel. A future "copy this assertion's id", a per-block author link, or an applicability trace all have data in hand.

**What this constrains.**
- **`profiles-tagged` responses grow ~2.5× gzipped** (14.9 → 36.6 KB at staging's worst tag). Anything later added to that endpoint inherits a fatter baseline.
- The response now carries **signed events**, so any future field added to `row` must not accidentally spread `ev` — the whitelist is the contract, and `tag-detail.test.js:135`'s set-equality style is how it stays one.
- `aggregateProfilesTagged`'s return signature gains `authorAllowed`. Its other caller (`refreshPinnedTags.js:156`) ignores it, but a third caller now has one more thing to understand.
- The `⋯` occupies ~2rem of reserved width on wide tag-page rows even when invisible (the no-jiggle invariant's price).

**New debt / follow-ups.**
1. **Unbounded panel and unbounded eager payload — one trigger, one fix.** Neither the row list nor `assertions` is paginated or capped (story put capping out of scope). At staging's worst (108 assertions) this is +21 KB gzipped; at **~1,000 assertions it is ~870 KB raw / ~200 KB gzipped on every view**. **Concrete trigger to revisit: any tag exceeding ~1,000 total assertions.** The right fix is *row* pagination, not an `assertions` cap — the row list blows up first and harder (it already ships an avatar per row), and `assertions` hanging off each row means paginating rows paginates assertions for free. Deliberately **not** pre-solved: a cap today would need a threshold nobody can justify, and would have to report "unavailable" for a panel that is merely large — a lie AC-5's degradation path shouldn't be taught to tell.
2. **AC-4's count-back promise needs the `counted` flag to be literally true** — see D1. The PO may want to reflect this back into AC-4's wording; the ADR does not change the requirement, it makes it keepable.
3. **Third raw-event surface = extract.** This is inspection instance **two** (tag definition, taggings). The `prd-seed` warns generalizing gets *"expensive after three divergent one-offs"*. Note the two instances have **already diverged structurally** — one event vs many, POV-invariant vs POV-scoped, page-level panel vs per-row panel — so a premature common abstraction would have been wrong. **The third instance (Note rows are the likely next) is where a shared `<RawEventPanel>` should be extracted**, and by then there will be three real shapes to generalize over instead of two. To record in `_intake.md`, priority Low.
4. **The shared-`<ActionsMenu>` note in `_intake.md` stands unchanged** — this story adds no `bsp-note-menu` dropdown (D3). Left explicitly untouched so the next Architect's count is still right.
5. **`window.matchMedia` at `TagPageRow.jsx:165` remains resize-blind** for `handleLinkClick` — pre-existing, untouched, and now sitting beside a CSS-driven width split that is resize-correct. The inconsistency is real but out of scope; worth a note if that path is ever revisited.

**Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

Concrete, in dependency order. The Implementer should not need to re-derive anything above.

- **`src/api/profile-tags/index.js`**
  - `aggregateProfilesTagged` (declared `:633`): return `authorAllowed` alongside the existing three — `return { byTarget, deduped, wotFiltering, authorAllowed }` (`:687`). **Do not otherwise change the function**: the `#e`/`#a` scan union (`:642-653`) and `federatedScan` are asserted by `test/profile-tag-consume-by-a-coordinate.test.js:118-126` and `test/tag-read-union.test.js:151-155`. Update its docblock (`:619-632`) — the "Returns:" list is normative and now has a fourth entry.
  - `handleProfilesTagged` (declared `:890`): after the viewer-union block (`:945-949`) and before the Meili enrichment loop (`:955`), build assertions from `deduped` in **one pass**, honoring the same rules the counts use:
    ```js
    // tag-event-inspector #2 / ADR 0002 D1-D2. The evidence behind each row's
    // +N/-M. Same predicate as the counts (authorAllowed) unioned with the
    // viewer's own — the row-union rule at :945-949, one level down. `counted`
    // marks the blocks the numbers DO account for, so "count the counted
    // blocks, get the row's numbers" holds even when the viewer's own
    // assertion fails this POV's filter (AC-4).
    const assertionsByTarget = new Map();
    for (const ev of deduped) {
      const pTag = (ev.tags || []).find((t) => t[0] === 'p');
      if (!pTag?.[1]) continue;
      const polarity = bucketize(readPolarity(ev));
      if (polarity === 'neutral') continue;          // excluded, per story decision #5
      const counted = authorAllowed(ev.pubkey);
      if (!counted && ev.pubkey !== viewerPubkey) continue;   // neither trusted nor the viewer's
      const list = assertionsByTarget.get(pTag[1]) || [];
      list.push({ polarity, counted, event: toRawEvent(ev) });
      assertionsByTarget.set(pTag[1], list);
    }
    ```
    Then inside the existing enrichment loop (`:955-972`), attach with a deterministic order (AC-4: applications before disputes):
    ```js
    entry.assertions = (assertionsByTarget.get(entry.pubkey) || []).sort((a, b) =>
      (a.polarity === b.polarity ? 0 : a.polarity === 'apply' ? -1 : 1)
      || (b.event.created_at - a.event.created_at)
      || a.event.id.localeCompare(b.event.id));   // total order — stable across requests
    ```
    Always assign (`|| []`), so the client can read unconditionally — the same "always present" convention `onlyViewerVisible` follows (`:970`).
  - `toRawEvent` already exists from ADR 0001 D1 — **reuse verbatim, do not re-declare**.
  - Do **not** touch `by-id`, `available-tags`, `aggregateTagPins`, or the `viewerPin` scan.
- **`ui/src/hooks/useTagDetail.js`** — **no change.** `setRows(data.rows || [])` (`:90`) carries `assertions` through, exactly as ADR 0001's `rawEvent` rode `setTag(data.tag)`.
- **`ui/src/components/TagRowRawEvents.jsx`** — **new**, presentational, no state. Props: `{ assertions }`. Renders one block per entry: a caption carrying `polarity` ("Applied by" / "Disputed by"), the author pubkey (`entry.event.pubkey` — **the pubkey is the bar, per story open question (a); a display name must never replace it**), and, when `entry.counted === false`, a marker that this assertion is not counted under the active POV (reuse the row badge's language: *"not counted under this POV"*). Then `<pre className="bs-tag-raw-pre">{JSON.stringify(entry.event, null, 2)}</pre>`. `if (!assertions?.length) return null;`
- **`ui/src/components/TagPageRow.jsx`**
  - New prop `showRawEvent = false` (D5). Document it in the props docblock (`:30-62`) alongside `showActions`.
  - `const [rawOpen, setRawOpen] = useState(false);` beside `overflowOpen` (`:92`).
  - `rowClasses` (`:153-157`): add `showRawEvent ? 'is-raw-enabled' : ''` — this class is what scopes the wide-viewport CSS to this surface (D5).
  - In the overflow menu (`:330-350`), wrap the actions + the new button so the button can float right (D6) — **outside** `renderActionsMarkup`:
    ```jsx
    {(showActions || showRawEvent) && (
      <div className="bs-tag-row-overflow-actions">
        {showActions && renderActionsMarkup(true)}
        {showRawEvent && (
          <button
            type="button"
            className="bs-tag-row-raw-btn"
            aria-expanded={rawOpen}
            onClick={() => {
              if (!row.assertions?.length) { setRawNotice('Raw Event unavailable'); closeOverflow(); return; }
              setRawOpen((o) => !o);
              closeOverflow();          // D4 — the sheet would otherwise cover the panel
            }}
          >
            {rawOpen ? 'Hide Raw Event' : 'Show Raw Event'}
          </button>
        )}
      </div>
    )}
    ```
  - Render the panel as the **last** child of the `<li>`, after the `publishError` line (`:356-358`):
    ```jsx
    {rawNotice && <p className="bs-tag-row-error" role="alert">⚠️ {rawNotice}</p>}
    {rawOpen && row.assertions?.length > 0 && (
      <section className="bs-tag-row-raw" aria-label={`Raw tagging events for ${displayLabel}`}>
        <TagRowRawEvents assertions={row.assertions} />
      </section>
    )}
    ```
  - `rawNotice`: a small `useState(null)`, cleared when the menu reopens. AC-5's "still being retrieved" clause needs **no** new state — under D1 the assertions arrive with the rows, so the existing `rowsLoading` → *"Loading profiles…"* (`Tag.jsx:360-362`) is the loading indication.
- **`ui/src/pages/Tag.jsx`** — pass `showRawEvent` on the `<TagPageRow>` at `:383-391`. **Do not** pass it in `TagSomeoneModal` (D5). No other change; `rawOpen` does **not** live here (D3).
- **`ui/src/components/TagSomeoneModal.jsx`** — **no change.** Named explicitly: its `<TagPageRow>` (`:208-220`) must not gain `showRawEvent`.
- **`ui/src/styles.css`**
  - Replace the bare wide-viewport hide (`:5033-5035`) with the **scoped** override — base rule stays so the modal is unaffected:
    ```css
    @media (min-width: 769px) {
      .bs-tag-row-overflow { display: none; }              /* unchanged — modal keeps this */
      /* tag-event-inspector #2 / ADR 0002 D5-D6. Only the surface that offers
         raw-event inspection gets a wide-viewport kebab. `visibility`, not
         `display`, so the slot holds its width — the row's no-jiggle
         invariant (see .bs-tag-row-actions :4967). :focus-within keeps the
         trigger visible while its own dropdown is open. */
      .bs-tag-row.is-raw-enabled .bs-tag-row-overflow { display: inline-flex; visibility: hidden; }
      .bs-tag-row.is-raw-enabled:hover .bs-tag-row-overflow,
      .bs-tag-row.is-raw-enabled.is-expanded-mode .bs-tag-row-overflow,
      .bs-tag-row.is-raw-enabled:focus-within .bs-tag-row-overflow { visibility: visible; }
      /* AC-2: above 769px the menu carries ONLY the raw item — scores and
         actions are already inline on the row. display:none, not visibility,
         so they leave the a11y tree too. */
      .bs-tag-row-overflow-menu .bs-tag-row-scores,
      .bs-tag-row-overflow-menu .bs-tag-row-actions,
      .bs-tag-row-overflow-help { display: none; }
    }
    .bs-tag-row-overflow-actions { display: flex; align-items: center; gap: 0.4rem; }
    .bs-tag-row-raw-btn { margin-left: auto; }   /* AC-2 float-right; mirrors .bsp-note-menu :7551 */
    .bs-tag-row-raw { flex-basis: 100%; }        /* wraps below the row — the .bs-tag-row-error precedent */
    ```
  - Add `.bs-tag-row-raw*` block/caption styling. **Reuse `.bs-tag-raw-pre`** for each `<pre>` (D6) and **do not modify it** — `Tag.jsx:275` shares it (AC-6). Do not modify any `.bsp-note-menu*` rule.
- **`engineering-team/stories/_intake.md`** — add the Consequences #3 entry (extract a shared `<RawEventPanel>` at the third inspection surface). **Leave the ADR 0001 D2 `<ActionsMenu>` entry untouched** (D3).

## Out of scope

- **Capping / paginating the panel or the eager payload** — Consequences #1 records the trigger (~1,000 assertions/tag) and the fix (row pagination, which solves both).
- **Extracting a shared `<RawEventPanel>`** — deferred to the third inspection surface (Consequences #3). **Extracting `<ActionsMenu>`** — trigger has not fired (D3).
- **Copy Note ID / Copy Note Addr per block**, raw-event inspection on Note rows / the tag index / the Pinned tab / profile pages, syntax highlighting, JSON trees, copy-the-blob, signature verification, a close affordance on the panel, showing assertions from authors outside the POV's WoT, and the "Note" vs "Event" vocabulary question — all per the story.
- **Scrolling the panel into view on open**, and any change to `handleLinkClick`'s resize-blind `matchMedia` (Consequences #5).
- **Any change to the Pin path, `by-id`, `available-tags`, or the TL/`refreshPinnedTags` computation** beyond the additive `authorAllowed` return.
