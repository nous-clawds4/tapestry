# ADR 0007: Search-result parity — live popup ↔ Enter-results page

**Status:** Proposed
**Date:** 2026-05-18
**Story:** `engineering-team/stories/8-search-result-parity.md`

## Context

Story 7 (ADR-0006) added tag-elements as a first-class result type to both the autocomplete popup and the Enter-results page, plus a post-ship polish that applied a bucket-sort (`name match → tag match → description match`) to the popup's profile rows. Story 8 closes the remaining gap: the two surfaces should show the same results in the same order for the same query, and POV changes should propagate consistently to both.

### Concept-graph orientation

`/api/concept-graph/summaries` returns 38 concepts; the three relevant to this story (`tag`, `nostr-user-tag`, `nostr-user`) are unchanged. **No schema or concept-definition changes — no firmware reinstall.**

### What diverges today (file:line audit)

Both surfaces hit the same endpoint via `buildSearchUrl` (`ui/src/pages/BrainstormSearch.jsx:790`) and consume `data.hits` + `data.tagHits` from the same response. The divergences are entirely client-side:

| Aspect | Popup `fetchSuggestions` (line 886) | Results page `doSearch` (line 821) |
|---|---|---|
| `limit` (profile hits) | `SUGGEST_LIMIT = 6` (line 752) | `RESULTS_PER_PAGE = 40` (line 603) |
| `tagLimit` | omitted → server default 5 | `tagLimit=25` (line 841) |
| Sort | `sortPopupHits(filtered, trimmed)` (line 911) — name > tag > description | **None** — uses raw `data.hits` order |
| NIP-05 placement | Prepended inline in `suggestions` array (line 912) | Pinned card above profile list (`BrainstormSearch.jsx:1245-ish`) |
| POV-change refetch | **None** — popup goes stale until next keystroke | Auto re-runs `doSearch` via `prevPovRef` effect (line 933–940) |
| POV-selector loading state | **None** | **None** |

So three real parity gaps: **(1) sort order**, **(2) POV-change reactivity in popup**, **(3) missing POV-selector loading state**. The `limit`/`tagLimit` deltas are intentional (popup is a preview prefix of the full results) and not in scope for parity — that's pagination by another name.

NIP-05 placement (inline vs pinned card) is a per-surface UX choice — the popup is a single dropdown, the results page has a dedicated pinned-banner pattern. Different visual treatment, same underlying data. Not a parity gap.

### Constraints (CLAUDE.md)

- **POV-first.** Both surfaces must re-derive per the current POV; when POV changes, both must catch up without lagging.
- **Decentralized-first.** No change to write-time gating.
- **Filter at view time.** The bucket-sort is a view-time client-side ordering; no persistent per-POV pre-sort.

Project rules: no new lint/typecheck/build tooling, JS-without-build, hand-rolled Node test runner.

### Existing primitives we reuse

- `sortPopupHits` at `BrainstormSearch.jsx:629–648` — pure function, already exported in-module and applied to the popup. **The single source of truth for ranking** going forward.
- `buildSearchUrl` (line 790) — common URL builder, no changes needed.
- The `prevPovRef` POV-change effect (line 933–940) — extend the pattern to the popup.

### ADRs reviewed; none contradicted

ADRs 0001–0006 still hold. ADR-0006 specifically out-of-scoped "sort order coherence between popup and Enter-results page" and named Story 8 as the closer. This ADR does that close-out.

## Options considered

### Option A — Shared client-side sort helper applied to both surfaces; reactive POV-change refetch on popup; POV-selector loading state driven by a new `povSwitching` flag

**Sort coherence.** `sortPopupHits` becomes the canonical bucket-sort used by both surfaces. `doSearch` runs it on `data.hits` before storing in `results`. The popup's render order (tags → name-match profiles → tag-match profiles → description-match profiles) propagates verbatim to the Enter-results page. Within each bucket, Meili's text-relevance order is preserved.

Server contract: **unchanged**. The proxy keeps returning hits in Meili's order; the client decides the final order. This keeps the server contract stable and lets future ranking experiments live in one place (`sortPopupHits`).

Tag-results positioning: already aligned post-Story-7 — both surfaces render `tagHits` above profile rows. No change.

NIP-05 result placement: kept different by design. The popup's dropdown is a single list; inline-prepended NIP-05 makes sense. The results page has a pinned-banner pattern; that placement is preserved. Both surfaces surface the same NIP-05 result; only the visual treatment differs.

Bucket-sort details (already implemented in `sortPopupHits`):
- A hit goes into the first bucket it qualifies for: name > tag > description.
- "Name match" = `(name + ' ' + display_name).toLowerCase().includes(q)`.
- "Tag match" = `Array.isArray(hit._matchedTags) && hit._matchedTags.length > 0`.
- Within each bucket, input order preserved (Meili's text-relevance ranking remains the tiebreaker).
- Empty query → return hits as-is (function is a no-op).

**POV-change reactivity in popup.** Add a `useEffect` on `[pov]` that, when the popup is the active surface (`!hasResults` and the search input has focus / `query.length >= 2`), re-runs `fetchSuggestions(query)`. When the popup isn't visible (`hasResults` is true), the existing results-page effect handles it.

There's a subtle UX choice here: do we **clear** stale suggestions or **re-fetch** them on POV change?

- **Clear** is simpler but produces a flicker where the popup goes empty then re-fills.
- **Re-fetch** keeps the popup populated; the user sees a brief loading state then the new results.

Decision: **re-fetch**. The popup is meant to be live; clearing creates a worse UX than briefly stale-then-fresh.

**POV-selector loading state.** New state slot `povSwitching: boolean`. Set `true` when the user changes POV via the selector (`bs-personalization` area in `BrainstormSearch.jsx` ~line 1015). Set `false` when the search/suggestions response that reflects the new POV has come back.

Mechanism:
1. POV-change handler (the existing `setPov` call inside `UserMenu` or the `bs-personalization` area) wraps the existing call with `setPovSwitching(true)` immediately.
2. The popup's new POV-effect AND the existing results-page POV-effect both call their respective fetches. Each callsite, on successful response, calls `setPovSwitching(false)`. (Both surfaces clearing the flag is idempotent — last clear wins, which is fine.)
3. The selector renders a small `…` / spinner / "Updating…" label while `povSwitching === true`.

Edge case: when the user changes POV with an empty query (no popup, no results), neither effect fires a fetch. We resolve that by clearing `povSwitching` immediately after the user-prefs write succeeds (the existing effect at line 149–162). So the timing is:
- Query non-empty: cleared by fetch response.
- Query empty: cleared by user-prefs write callback.

Implementer detail; ADR just pins the state model.

**Logged-out parity.** Both surfaces resolve POV to `house` via `resolvePov`. Same sort applied. Same auto-refetch when "POV" changes (house POV doesn't really change mid-session, but if the house-pubkey backing config were swapped via admin, the same effect would catch it).

**Pros**

- Smallest possible change: one helper (`sortPopupHits`) already exists and works; we just call it from one more place.
- Server contract unchanged — no API revisions, no risk of breaking external consumers.
- POV-change reactivity uses the same effect pattern the results page already employs; symmetric, easy to reason about.
- `povSwitching` is one boolean. Minimal state. Loading indicator is a UI concern, isolated to the selector area.
- All four "real" parity gaps closed in one story; the intentional `limit`/`tagLimit` deltas are documented, not "fixed."

**Cons**

- Two callsites to remember to apply `sortPopupHits` (`fetchSuggestions` already does; `doSearch` newly does). If a third surface lands later, easy to forget. Mitigation: a small comment on `sortPopupHits` reminding callers it must be applied at every render-target.
- `povSwitching` clear-on-response means two effects race to flip the flag. Idempotent — last-wins — but the implementer must be aware to avoid double-clears creating timing weirdness in tests.
- The popup re-fetch on POV-change while in landing mode briefly shows old results before the new ones arrive. The `povSwitching` indicator mitigates by signaling "this is in flight."

### Option B — Server-side sort contract

Move the bucket-sort to the proxy. The server response includes a per-hit `_bucket: 'name' | 'tag' | 'description'` field and pre-sorts within the response. Client renders in given order.

**Pros**
- Single source of truth for ordering; clients can't diverge.
- Future ranking refinements live on the server, deployable independently of UI changes.

**Cons**
- Bigger change: the proxy currently passes Meili's order through unchanged; introducing client-query-aware sorting on the server requires the proxy to know the query string (it already does) AND to apply substring matching on `name`/`display_name`, duplicating logic that Meilisearch already attempted. Mostly redundant work.
- New response field needs documentation + tests. Heavier than needed for a coherence pass.
- Story 8's ACs don't require server-side ranking — they require "same order on both surfaces," which client-side enforcement satisfies.
- Risk of fighting Meilisearch's relevance ranking when our naive substring match disagrees with Meili's TF-IDF score.

### Option C — Unified `useSearch` hook

Extract a `useSearch` hook that owns query/results/suggestions/POV state. Both the popup-render and results-render components subscribe to it. Single source of state.

**Pros**
- Closest to "single source of truth" without server changes.
- Future surfaces (a hypothetical mobile sheet, a side-rail) plug in with one line.

**Cons**
- Big refactor. `BrainstormSearch.jsx` is 1200+ lines with deeply intertwined state (POV, filters, sort, WoT status, NIP-05). Extracting the search-specific subset is a story unto itself.
- Story 8 is scoped as "the omni-search consistency pass" — not "the search-component refactor."
- Risk of churn that costs us reviewable-diff cleanliness for marginal architectural gain.
- Can always do this later if a third surface lands.

## Decision

**Option A.** Apply `sortPopupHits` to `doSearch` too (one new line); add a POV-change `useEffect` to the popup that re-runs `fetchSuggestions` when `pov` changes (mirrors the existing results-page effect); introduce a `povSwitching` boolean for the selector loading indicator (cleared by fetch response, or by user-prefs write when the query is empty).

Why: it's the option that closes all three real parity gaps with the smallest possible change, honors the CLAUDE.md invariants (view-time filtering, POV-first per-surface), and avoids the server-contract refactor (Option B) and the component refactor (Option C) — both of which are valid future moves but bigger than Story 8 needs.

## Consequences

**Enables:**

- The popup and Enter-results page show the same order for the same query. A user who saw a profile near the top of the popup will see it near the top of the results page too.
- POV changes propagate to both surfaces consistently — no stale popup.
- The selector telegraphs "I'm updating" to the user, which closes the silent-wait UX gap (especially noticeable on slow networks or when the WoT-score recomputation lags).
- Future ranking experiments live in one function (`sortPopupHits`). Both surfaces inherit changes automatically.
- The story-8 close-out also unblocks the original Story-7 follow-up framing: "popup vs Enter-results page parity" is now a closed concern.

**Constrains / makes harder:**

- Two callsites to remember to apply `sortPopupHits`. If a third search surface lands (mobile sheet, etc.), the developer must remember to apply the same sort. The comment on `sortPopupHits` makes this discoverable.
- `povSwitching` is a transient flag with two potential clear-sources (fetch response or user-prefs write callback). The implementer needs the clear logic to handle both cases without double-clear surprises (idempotent flip-to-false is fine; the ADR pins the semantic).
- Bucket-sort applied client-side means a future server-side ranking algorithm change won't immediately reach the client without a client update. Acceptable trade-off for v1.

**Follow-ups / debt:**

- **Server-side ordering contract** (Option B) is a candidate for a future ADR if we want server-driven ranking experiments. Not blocking; defer until the need is concrete.
- **`useSearch` hook extraction** (Option C) — if a third search surface arrives, that's the trigger. File as a candidate, not a story yet.
- **Cross-page POV invalidation** (the dropped Story-7 avatar-menu AC) — Story 8 addresses POV-change reactivity *within* `BrainstormSearch.jsx` but does NOT solve the broader gap (other pages' hooks don't subscribe to a POV-change signal). Still tracked as the existing follow-up.

**Firmware reinstall required?** **No.** No concept-graph or schema changes.

## Implementation notes

### Client (`ui/src/pages/BrainstormSearch.jsx`)

**1. Apply `sortPopupHits` to `doSearch`.** Locate `doSearch` (line 821). After `const data = await resp.json();` (~line 843) and before the existing `setResults(data.hits || [])` call (~line 864), insert:

```js
const sortedHits = sortPopupHits(data.hits || [], trimmed);
```

Replace `setResults(data.hits || [])` with `setResults(sortedHits)`. The `offset === 0` branch and the `offset > 0` (pagination append) branch both need this. For pagination, the append slice should also be sorted:

```js
setResults(prev => [...(prev || []), ...sortPopupHits(data.hits || [], trimmed)]);
```

Note: sorting only within each page-slice means a page-boundary may put a low-rank name-match below a tag-match from the previous page. Acceptable for v1; the alternative (resort across the full accumulated list) introduces flicker on every load-more. Document the trade-off in a code comment.

**2. POV-change refetch on popup.** Add a new `useEffect` paired with the existing results-page `prevPovRef` effect (~line 933):

```js
// Mirror the results-page POV-change effect for the popup. When POV
// flips mid-typing, re-fetch suggestions so the popup doesn't lag.
const prevPovPopupRef = useRef(pov);
useEffect(() => {
  if (prevPovPopupRef.current !== pov && !hasResults && query.trim().length >= 2) {
    fetchSuggestions(query);
  }
  prevPovPopupRef.current = pov;
}, [pov]); // eslint-disable-line react-hooks/exhaustive-deps
```

Guard on `!hasResults` so the popup effect only fires when the popup is the active surface; the existing results-page effect handles the other case.

**3. `povSwitching` state + selector indicator.** New state at the top of `BrainstormSearch`:

```js
const [povSwitching, setPovSwitching] = useState(false);
```

The POV-change handler (wherever `setPov(newValue)` is called from a user-facing action — likely inside `UserMenu` or the `bs-personalization` click handler) wraps the call:

```js
setPovSwitching(true);
setPov(newValue);
```

Clear via two pathways:

- `fetchSuggestions` and `doSearch` both call `setPovSwitching(false)` on successful response (idempotent).
- The empty-query case: the existing user-prefs PUT (~line 158) gets a `.then(() => setPovSwitching(false))` chained onto it. (Or a more idiomatic effect-based clear — Implementer's choice.)

Selector render: in the `bs-personalization` area (~line 1015), conditionally render a small spinner / "Updating…" label when `povSwitching === true`. Visual treatment is the Implementer's call; the ADR pins only the state model.

**4. No other changes needed.** `buildSearchUrl`, the response parsing, the tagHits handling — all stay as they are.

### Server

**No server changes.** The proxy contract is stable.

### Tests (Tester writes; this is what the Implementer should expect)

Most of Story 8 is UI-state behavior, which is hard to assert in the project's existing Node-runner suite. Expected coverage:

- **Unit-ish test for `sortPopupHits`.** Extract to a tiny test file or inline assertions in a new `test/search-sort-parity.test.js`: given hits with various `name`/`display_name`/`_matchedTags`/description signals, the bucket order is correct; ties preserve input order; empty query returns input as-is.
- **Playwright (deterministic):** type a query, verify the popup renders rows in expected bucket order; press Enter, verify the results page renders the same first-N rows in the same order. The bucket-order assertion requires fixture data; the project's Playwright lacks fixture-publishing, so this likely runs against existing DB state with permissive assertions (e.g., "if a tag matches the query, it appears above a profile that matches only the description").
- **Playwright (POV-switch reactivity):** with a query in the popup, trigger a POV change via the selector; verify the popup re-fetches (a network call is made) and the `povSwitching` indicator briefly appears then resolves. Data-dependent assertions on result content; structural assertion on the indicator's existence.

The Tester will scope the assertions to what's tractable given the project's testing constraints. Server-contract tests aren't needed — no server change.

## Out of scope

- **Different `limit` and `tagLimit` between surfaces.** Intentional pagination model: popup is a preview prefix; results page is the full list. Not a parity gap.
- **NIP-05 result visual placement.** Inline-in-popup vs pinned-card-on-results is a per-surface UX choice. Story 8 doesn't unify the visual treatment.
- **Server-side ranking contract.** Future ADR if we want server-driven experiments; not needed now.
- **`useSearch` hook extraction.** Future refactor when a third surface arrives.
- **Cross-page POV invalidation** (the Story-7 dropped avatar-menu AC). This story addresses POV-change *within* `BrainstormSearch.jsx`; the broader gap (POV-change reactivity on `BrainstormProfile`, `Tag`, `Tags`, etc.) remains the existing follow-up.
- **Sort-control affordances on the search surfaces.** Story 8 locks the existing default sort (`sortPopupHits` bucket order); does not introduce user-facing sort toggles.
- **Caching layer** on either fetch path. Premature.
- **Pagination on tag-hits.** ADR-0006 already says tag-hits don't paginate; same here.
