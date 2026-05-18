# ADR 0008: Search-results URL routing

**Status:** Proposed
**Date:** 2026-05-18
**Story:** `engineering-team/stories/9-search-results-url.md`

## Context

Story 9 makes the search-results view addressable: a stable URL the user can share, bookmark, refresh, and navigate via browser back/forward. Today the search UI lives at `/` and is rendered by `ui/src/pages/BrainstormSearch.jsx` (`ui/src/App.jsx:78-80`). The landing view and the Enter-results view are the same component differentiated only by React-internal state (`query`, `results`, etc.) — none of it surfaces in the URL.

### Concept-graph orientation

`/api/concept-graph/summaries` returns 38 concepts; the three relevant to this story (`nostr-user`, `tag`, `nostr-user-tag`) are unchanged. **No schema or concept-definition changes — no firmware reinstall.**

### Current state of `BrainstormSearch.jsx`

- Single mounted route at `/` (`ui/src/App.jsx:77-80`).
- Component state: `query`, `results`, `meta`, `pov`, `popupTagHits`, `resultsTagHits`, etc. — all useState, no router involvement.
- Submit pathway: `doSearch()` (line 821 in `BrainstormSearch.jsx`) sets `results` and `meta` in component state; no URL update.
- POV pathway: `setPov(...)` (line 1156, 1185, 1264, 1291) updates component state + writes to user-prefs (`UserMenu` effect at lines 149–162); no URL update.
- Mount pathway: nothing reads the URL on mount.

**Verified:** zero React Router hooks (`useSearchParams`, `useNavigate`, `useLocation`, `useParams`) are imported into the file. Adding them is the bulk of this change.

### Existing primitives we reuse

- `react-router-dom` v7 (per `ui/package.json:17`). Provides `useSearchParams`, `useNavigate`, `useLocation`. Already the routing library — no new dependency.
- The existing `wotPov` + `userPubkey` query-param contract on the server proxy (`src/api/search/profiles/meili/index.js` — line 109 forwards them via `resolvePov`). The same shape works on the URL: the URL is read on the client, those params get passed to the existing server contract unchanged.
- `BrainstormSearch.jsx`'s existing `doSearch` and `fetchSuggestions` already accept a `q` argument; no signature changes needed.

### Constraints (CLAUDE.md)

- **POV-first.** A shared URL must capture the POV the sender was viewing, otherwise "what I see" loses meaning to the recipient. PO leaned toward POV-in-URL for exactly this reason.
- **Decentralized-first.** URLs are public artifacts; including a sender's pubkey in the URL is consistent with Nostr's pseudonymous public-by-design model. (Nothing leaks that isn't already public.)
- **Filter at view time.** URL state is a view-time projection of POV. No persistent denormalization.

Project rules: no new lint/typecheck/build tooling. JS-without-build front end.

### Existing ADRs reviewed; none contradicted

ADRs 0001–0007 still hold. ADR-0007 settled popup ↔ Enter-results parity at the React-state level; this ADR moves the same state into URL search params so it's addressable and survives navigation.

## Options considered

### Option A — Single root route, URL search params drive view; POV in URL via existing `wotPov` + `userPubkey` params

**URL shape:**

- Landing: `/` (no query parameters; `?q=` absent)
- Results: `/?q=<encoded-query>[&wotPov=<user|house>][&userPubkey=<hex>]`
- Special characters: handled by `URLSearchParams` automatically — `useSearchParams` encodes/decodes losslessly.

Examples:
- House POV, query "alice": `/?q=alice` (POV omitted; recipient resolves to their own house POV).
- House POV, query "alice & friends": `/?q=alice+%26+friends`
- Sender's user POV, query "homesteader": `/?q=homesteader&wotPov=user&userPubkey=abc...def`

**Why on the same root route:** the search IS the root experience for Brainstorm; landing vs results is the same component in different modes. Adding a separate route like `/search` would duplicate registration without semantic benefit. The `q` param's presence/absence is the natural mode discriminator (matches how `hasResults` works today, just URL-driven instead of state-driven).

**State flow (the key change in this ADR):**

The component switches from "React-internal state is the source of truth" to "URL is the source of truth; component state is a derived view." Concretely:

- On mount AND on every URL change: read `q`, `wotPov`, `userPubkey` from `useSearchParams()`. If `q` is non-empty, trigger `doSearch(q)`. If empty, stay in landing mode.
- The input field gets a separate "local input value" state (distinct from the URL's `q`) — the user types freely without the URL updating per keystroke.
- On Enter (or submit): `setSearchParams({ q: localInput, ...pov-params })`. This pushes a new entry onto the browser history and triggers the URL-driven fetch in the same render cycle.
- On POV change while a query is active: `setSearchParams(prev => ({ ...prev, wotPov, userPubkey }))`. This pushes a new history entry (POV change is a meaningful state transition).
- On POV change while no query is active: `setPov(...)` updates local state only; nothing to push to URL (it would just be `/?wotPov=user&userPubkey=hex` with no query — pollution).
- On "clear the input + nothing else": the URL doesn't change immediately. If the user then types and submits, the new URL replaces.
- On explicit "clear / return to landing" (e.g., clicking the Brainstorm logo, or programmatic): `navigate('/')` — bare root.

**Browser back/forward semantics:**

- `useSearchParams.setSearchParams` defaults to `push` (creates a new history entry). That's correct for Enter-submits and POV-changes.
- `useSearchParams.setSearchParams(..., { replace: true })` is used for transitions that should NOT create history (debounce-driven URL-sync we don't want to spam). Avoided for v1 — we only push on user-intent actions.

**POV-in-URL behavior with the existing wire shape:**

The URL params `wotPov` and `userPubkey` are the same shape the server proxy accepts (`src/api/search/profiles/meili/index.js:109` consumes them via `resolvePov`). So:

1. Sender on user POV, query "alice": URL is `/?q=alice&wotPov=user&userPubkey=<sender-hex>`.
2. Recipient pastes URL: the BrainstormSearch component reads `wotPov=user&userPubkey=<sender-hex>` from URL, sends those to the server. Server's `resolvePov` looks up the sender's user-prefs (if present on this instance) and resolves to sender's POV.
3. If sender's user-prefs aren't present on the recipient's instance: server falls back to house POV (existing `resolvePov` behavior — see `src/api/_shared/pov.js`). Recipient sees house results; URL is still valid; sender's POV just wasn't reproducible on this instance.

**Behavior when URL params conflict with recipient's prefs:**

URL wins. The component's POV state is *derived from* URL, not from user-prefs on URL-driven navigation. If the recipient has user-prefs that say "always show me user POV" but the URL says `wotPov=house`, the URL is the active view. If the recipient then changes POV via the selector, that's a new user action → new URL push → new view.

The existing user-prefs effect (lines 127-145 of `BrainstormSearch.jsx`'s inner `UserMenu`) loads user prefs into local POV state on mount when there's no URL POV. The new behavior layers on top: if the URL has POV params, they take precedence on mount.

**History granularity (per Open Question 5):**

- Enter-submit: push (new history entry).
- POV-change while query active: push.
- POV-change with no query: no URL update (no push) — local-state only.
- Typing into input: no push.
- Debounced fetchSuggestions (popup): no push (popup is ephemeral; doesn't survive page refresh).

**Empty-query URL (per Open Question 3):** the landing URL is bare `/`. No `?q=` when the query is empty. Typing into the input without submitting doesn't add `?q=`.

**Clear-query behavior (per Open Question 4):** if the user is on `/?q=alice` and clears the input box (no submit), the URL stays `/?q=alice`. Their cleared input is component-local; the URL state remains until they actively submit (new push) or navigate away. *Rationale:* the URL represents "the search I last committed to," not "what's currently in the input box." Browser back from `/?q=alice` then takes them to `/` (landing) naturally.

If the user wants to revert to landing without searching, clicking the Brainstorm logo (or pressing back) does it. We don't add a "clear → navigate" coupling — the logo is the affordance.

**Pros**

- Minimal route surface: one existing route still owns search, just URL-driven instead of state-driven.
- POV in URL is "free" — the shape already matches the server contract. No new server work.
- React Router v7's `useSearchParams` is purpose-built for this; no new dependency, no new abstraction.
- Backwards-compatible: the existing `/` route still renders the landing view (no `q` → landing). Existing bookmarks of `/` continue to work.
- Mount-side hydration is one new effect that reads `searchParams` and triggers `doSearch` when `q` is present.
- POV-in-URL leverages Nostr's pseudonymous-public model; including a pubkey in a URL is consistent with how Nostr already publishes identities.

**Cons**

- The component's state model becomes hybrid: URL is the truth for query+POV, but the input box's "in-flight typing" remains React-internal. The Implementer needs to be careful about which state lives where — there's a real bug class of "did the URL just get updated when I didn't mean it?" mitigated by only `push`ing on Enter-submit and POV-change.
- Sender's pubkey in URL is technically public-but-discoverable. A user sharing a URL might not realize their pubkey is in it. Acceptable per Nostr's design, but worth surfacing in UX (e.g., a "copy link" button could show a "this URL includes your pubkey" hint — out of scope for v1; flagged as a follow-up).
- Recipient instance might not have the sender's user-prefs, so the POV doesn't reproduce. The fallback to house is graceful but the URL is *less* deterministic than a self-contained "pov=<8charsuffix>" form would be. Considered Option B below; punted for v1 to avoid wire-shape change.
- Multiple effects can race during URL transitions (e.g., URL changes → `doSearch` fires → updates `meta.query`, which we then watch). Implementer must guard against effect-loops with `prevQueryRef` (same pattern as the existing `prevPovRef`).

### Option B — `/search?q=...` separate route; POV via opaque `pov=<8charsuffix>` URL param; new server-side wire shape for "raw POV suffix"

**URL shape:**

- Landing: `/`
- Results: `/search?q=<query>[&pov=<8charsuffix>]`

POV in URL is the resolved 8-char suffix (e.g., `pov=abc12345`). Server accepts a new query param `povOverride=<suffix>` that bypasses `resolvePov`'s user-prefs lookup and just uses that suffix directly. Recipient's prefs are irrelevant; the URL is self-contained.

**Pros**

- URLs reproduce identically across instances regardless of whose user-prefs are present.
- `/search` route is semantically clear ("you're on the search page").
- No sender-pubkey leak in the URL.

**Cons**

- Requires a server change (new `povOverride` param + a new branch in `resolvePov`). Out of scope for Story 9's "URL routing" framing.
- 8-char suffix is opaque — recipient looking at the URL can't tell whose POV it is. The pubkey-in-URL of Option A is at least readable.
- Two routes means duplicating the BrainstormSearch component's mount, or registering it twice. Minor.
- We'd have to encode pov-suffix-to-pubkey mapping somewhere so the recipient can display "you're viewing house's POV" or whoever — that mapping doesn't exist in the URL.

### Option C — Component refactor: extract `BrainstormSearchResults` into its own component on a separate route

Two components: `BrainstormSearch` (landing) and `BrainstormSearchResults` (results). React Router renders one or the other. State per-component.

**Pros**

- Clean separation: landing has zero results state; results page has zero "type to search" state.
- Each component is smaller and easier to reason about.

**Cons**

- Big refactor. The current single-component model has many shared concerns (POV selector, NIP-05 detection, user menu) that would need to either duplicate or extract to shared sub-components.
- Story 9 is about URL routing, not component decomposition. The user-visible value of this option is the same as Option A; the refactor cost is much higher.
- Story 8 just finished aligning the two views as a single component's two modes. Re-splitting them now would partially undo that work.

## Decision

**Option A.** Single root route (`/`), URL search params drive view (`?q=` present → results view; absent → landing). POV in URL via the existing `wotPov` + `userPubkey` params — no server wire change. URL is updated on Enter-submit (push) and on POV-change while a query is active (push); typing alone, popup-debounced suggestions, and POV changes with no active query do NOT touch the URL. Clear-input does not touch the URL (logo-click is the affordance for returning to landing).

Why: it's the option that closes Story 9's user-facing intent with the smallest possible change (no new route, no new server contract, no component refactor). The pubkey-in-URL concern is real but consistent with Nostr's public-key model; if it becomes an issue later, Option B's opaque-suffix shape is the upgrade path. Option C is the right *eventual* answer if the search component grows much larger; for now, the URL-driven single component is the natural extension of where Story 8 landed.

## Consequences

**Enables:**

- Shareable search URLs: `/?q=alice` works in any browser, paste/refresh/share semantics all "just work."
- Browser back/forward correctly cycles through search states without the user feeling history is "skipped."
- POV is captured in the URL when active, so shared links reproduce the sender's view (subject to recipient's instance having the sender's user-prefs locally — graceful fallback to house).
- Mount-side hydration: a recipient landing on `/?q=...` directly sees the results without any user-typing needed.
- Foundation for future shareable-state work (filter/sort in URL, POV deep-linking) — once URL-driven, those are additive params.

**Constrains / makes harder:**

- Component state is now split between URL-driven (query, POV) and React-internal (input box, results, meta, suggestions). The Implementer must be deliberate about which is which; mistakes here cause URL-thrash or stale-state bugs.
- Sender's pubkey is in shared URLs when on user POV. Documented; not a security regression (npub is public by design), but a UX consideration if a future "share link" affordance lands.
- Recipient instances without the sender's user-prefs see a degraded view (house POV fallback). Graceful but not always faithful to the sender's intent. Captured in the test plan + reviewer's eyeball.

**Follow-ups / debt:**

- **Filter / sort state in URL** — future story when filter/sort UX lands on the results page.
- **Pagination state in URL** (`offset` or `page` param) — useful for deep-linking to "page 3 of results" but defer until needed; the current scroll-pagination model isn't naturally deep-linkable anyway.
- **Opaque POV suffix in URL** (Option B's shape) — future ADR if the pubkey-in-URL or cross-instance reproducibility becomes a real problem.
- **Component split into landing + results** (Option C) — future ADR if BrainstormSearch grows further or if URL-driven hydration becomes too complex in a single component.
- **"Copy link" affordance with a "this URL includes your pubkey" hint** — UX polish if/when we add a share button.

**Firmware reinstall required?** **No.** No concept-graph or schema changes.

## Implementation notes

### Client (`ui/src/pages/BrainstormSearch.jsx`)

The route registration in `ui/src/App.jsx:77-80` does NOT change — we keep the single root route. All changes are inside `BrainstormSearch.jsx`.

**1. Add Router hooks.** At the top of the component:

```js
import { useSearchParams, useNavigate } from 'react-router-dom';

// inside BrainstormSearch:
const [searchParams, setSearchParams] = useSearchParams();
const navigate = useNavigate();
```

**2. Derive URL-driven state.** Replace state ownership for `query`-when-submitted and `pov`:

- The existing `const [query, setQuery] = useState('')` becomes the **input box's** local value — purely UI. Rename internally to `inputValue` (or keep as `query` but recognize its narrower meaning).
- A new derived value `const urlQuery = searchParams.get('q') || ''` is the "committed search query" the URL reflects.
- The existing `const [pov, setPov] = useState('nosfabrica')` stays as the local POV state but is initialized from URL: `const urlWotPov = searchParams.get('wotPov')`. On mount/URL change, sync URL → local state when URL has explicit POV.
- The view-mode discriminator changes from `hasResults` (state-derived) to `Boolean(urlQuery)` (URL-derived). The existing `hasResults` variable can stay as an alias but should be redefined to read from URL.

**3. Mount-side hydration.** New `useEffect` that, when `urlQuery` is non-empty AND differs from the last-fetched query, triggers `doSearch(urlQuery)`. Guard with a `prevQueryRef` to prevent loops:

```js
const prevQueryRef = useRef('');
useEffect(() => {
  if (urlQuery && urlQuery !== prevQueryRef.current) {
    doSearch(urlQuery);
    prevQueryRef.current = urlQuery;
    setInputValue(urlQuery); // sync the input box to the committed query
  }
  if (!urlQuery && prevQueryRef.current) {
    // URL went from results back to landing (e.g., back button)
    setResults(null);
    setMeta(null);
    prevQueryRef.current = '';
  }
}, [urlQuery]);
```

**4. Enter-submit handler.** Replace any place that previously called `doSearch(query)` from a user-submit path with a `setSearchParams` push:

```js
function submitSearch(q) {
  const params = new URLSearchParams();
  params.set('q', q);
  if (pov === 'user' && user?.pubkey) {
    params.set('wotPov', 'user');
    params.set('userPubkey', user.pubkey);
  }
  setSearchParams(params);
}
```

The mount-hydration effect (step 3) picks up the new URL and triggers `doSearch`.

**5. POV-change handler.** The existing POV-picker click handlers (lines 1156, 1185, 1264, 1291 — all four wrapped with `setPovSwitching(true)` per Story 8) get an additional URL-push step *when* a query is active:

```js
onClick={() => {
  if (pov !== 'user') setPovSwitching(true);
  setPov('user');
  setShowPovPicker(false);
  // Story 9 / ADR-0008: if a query is active, push the POV change to URL.
  if (urlQuery) {
    const params = new URLSearchParams(searchParams);
    params.set('wotPov', 'user');
    if (user?.pubkey) params.set('userPubkey', user.pubkey);
    setSearchParams(params);
  }
}}
```

Similarly for the house POV handler (sets `wotPov=house`, removes `userPubkey`).

**6. Story-8 POV-change effects** (the existing `prevPovRef` and new `prevPovPopupRef` effects at lines 982-1003) — these stay. They handle the case where POV changes drive a re-fetch. With URL-driven POV, the effects now key on `urlQuery` + URL POV transitions rather than React-internal POV alone, but the pattern is the same.

**7. `doSearch` itself.** Largely unchanged. It already accepts a `q` argument and reads `pov` from local state. With URL-driven POV, `pov` is synced to URL on mount, so `doSearch`'s reads from local state still produce the right query params for the server.

**8. NIP-05 / pubkey-lookup edge cases.** Existing logic in `buildSearchUrl` (line 790) decodes npub/hex pubkey/nprofile from the query and uses `pubkeyLookup`. With URL-driven query, this still works — the URL's `q` value is the same string the user typed. Round-trip via URL-encode is lossless for these formats.

**9. Empty-query / clear-input behavior.** When the input box is cleared by the user:
- `inputValue` becomes empty.
- The URL is NOT touched.
- The popup-suggestions handler (existing) clears its state when `inputValue.trim().length < 2`.
- If the user wants to navigate back to landing, they click the Brainstorm logo (existing affordance) which navigates to `/`. The URL-pop triggers the hydration effect's "URL went from results back to landing" branch and clears results state.

### Server

**No server changes.** The proxy already accepts `q`, `wotPov`, `userPubkey` from request-side query params; the URL state uses the same shape. Verified at `src/api/search/profiles/meili/index.js:75, 109`.

### Tests (Tester writes; this is what the Implementer should expect)

Most of Story 9 is UI behavior. Expected coverage:

- **Source-pattern assertions** on `BrainstormSearch.jsx`:
  - `useSearchParams` and `useNavigate` are imported from `react-router-dom`.
  - There's an effect keyed on the URL query that calls `doSearch` (mount-side hydration).
  - The Enter-submit pathway calls `setSearchParams` (URL push).
  - The POV-picker click handlers, when a query is active, call `setSearchParams` (URL push for POV change).
- **Playwright structural assertions** (data-dependent assertions remain limited per the existing infra):
  - Press Enter on a query → URL contains `?q=<query>`.
  - Visit `/?q=<query>` directly → page loads in results view.
  - Browser back from results URL → landing URL.
  - Special-character round-trip: `/?q=alice%20%26%20bob` loads with the query value `alice & bob` in the input.
  - POV-change while on a results URL → URL gains `wotPov` and (when applicable) `userPubkey` params.
- **No new test framework.** Source-pattern tests on `BrainstormSearch.jsx` (same approach as Story 8) + a `tests/brainstorm/search-results-url.spec.js` for the Playwright bits.

## Out of scope

- **Filter / sort state in the URL.** No filter/sort UX on the results page today; deferred.
- **Pagination state in the URL.** Current pagination is scroll-driven, not deep-linkable; deferred.
- **Opaque POV suffix shape** (Option B). Future ADR if pubkey-in-URL becomes a real problem.
- **Component split** (Option C). Future refactor if the file grows further.
- **Server-side rendering of results.** No SSR change.
- **Cross-app POV deep-linking** (profile/tag/tags pages also accepting `pov=` in URL). Out of scope; ties to the existing cross-page POV invalidation follow-up.
- **"Copy link" UX affordance.** Optional polish; not blocking.
- **Migration / redirect** from any pre-existing URL shape. Search has only ever lived at `/`; nothing to migrate.
