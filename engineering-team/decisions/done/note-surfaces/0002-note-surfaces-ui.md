# ADR 0002: The two note surfaces — a shared `useUserNotes` hook, a profile "Content" section, and the `/user/:pubkey/notes` page

**Status:** Accepted
**Date:** 2026-06-18
**Stories:** `engineering-team/stories/note-surfaces/2-profile-content-section.md`, `engineering-team/stories/note-surfaces/3-per-user-notes-page.md`
**Epic:** `engineering-team/epics/note-surfaces.md`
**Depends on:** ADR `note-surfaces/0001` (the `GET /api/user/:pubkey/notes?limit=` contract)

## Context

Two **front-end-only** surfaces render ADR 0001's output. Neither adds read logic — they fetch the contracted endpoint and render the **existing shared `NoteCard`** (`ui/src/components/NoteCard.jsx`, takes one already-enriched `{ item }`).

- **Story #2 — profile "Content" section:** the last section of `/user/:pubkey` (`ui/src/pages/BrainstormProfile.jsx`), showing the single most-recent note (limit 1) or an empty state, plus a link to the notes page.
- **Story #3 — per-user notes page:** a new client route `/user/:pubkey/notes` (sibling of `/user/:pubkey/follows`), rendering up to 50 notes as a `NoteCard` list, with a "whose notes" header and an empty state, no horizontal overflow at 1280px.

### The contract these surfaces consume (ADR 0001)

`GET /api/user/:pubkey/notes?limit=N` → `{ success, status, relaySource?, items? }`:

| `status` | HTTP | Other fields | Surface meaning |
|---|---|---|---|
| `OK` | 200 | `relaySource`, `items:[…]` (newest-first, ≤N) | render the card(s) |
| `EMPTY` | 200 | `relaySource`, `items:[]` | "no kind-1 events could be located" |
| `INVALID` | 400 | `error` | defensive (malformed pubkey in URL) |
| (transport error / 500 / non-`success`) | — | — | defensive |

Each `OK` item is the feed item shape `{ id, pubkey, createdAt, content, author:{displayName,avatar}, mentions }` — exactly what `NoteCard` already renders.

### House patterns to mirror (verified in source)

- **Data hook** → `ui/src/hooks/useFeed.js`: `useState`/`useEffect`/`AbortController`, `fetch().then(r=>r.json())`, pass the whole `success` body through as `data`, else set `error`; abort on unmount. (Ours adds `pubkey`/`limit` args and re-runs on change.)
- **Pubkey-scoped sub-page** → `ui/src/pages/BrainstormFollows.jsx`: `bsp-page` → `bsp-top-bar` (logo + `BrainstormUserMenu`) → `bsp-content` with a `← Back to profile` `<Link to={\`/user/${pubkey}\`}>` + `<h1>` title + loading/error/empty/list states; driven by a `use…(pubkey)` hook (`BrainstormFollows.jsx:76-81,150-229`).
- **Pure state→view + copy constants** → `ui/src/pages/BrainstormFeed.jsx`: a named-exported `renderFeedState({data,loading,error})` (pure: no fetch/auth/router/browser globals) + module-level `FEED_COPY`, so states are unit-/sentinel-testable (`BrainstormFeed.jsx:20-28,62-96`).
- **Card reuse** → `NoteCard` renders the avatar/name (links to `/user/<pubkey>`), the relative timestamp, and `NoteContent` (with mentions). It is surface-neutral (`bsp-note-card-*`) and already used by the feed list.
- **Subject display name** → `BrainstormProfile.jsx:132` fetches `/api/profiles?pubkeys=${pubkey}` → `data.profiles[pubkey]` (`display_name`/`name`); the notes page reuses this to name the user in its header (so it identifies whose notes even when empty).

### Constraints

- **Additive & read-only.** New: one hook, one component, one page, one route line, one section-insertion line, a small CSS block. Edits to shared files are **two single-line insertions** (`App.jsx` route, `BrainstormProfile.jsx` section) + their imports; nothing existing changes behavior. Remove them and the app is as before.
- **Vite-built UI; no new dependency / tooling.** React 19, `react-router-dom` 7, the `bsp-*` styles, and `NoteCard` are all present. `npm run build` in `ui/` → `/dist` is the existing (only) build step.
- **No re-derivation.** Surfaces map `{status, items}` to DOM; they do not re-fetch/re-sort/re-enrich (ADR 0001 owns that). `relaySource` is ignored (not asked for).

## Options considered

### Option A — One shared `useUserNotes(pubkey, limit)` hook; a `ProfileContentSection` component; a `BrainstormUserNotes` page; `NoteCard` reused as-is *(chosen)*

- **Hook** `ui/src/hooks/useUserNotes.js` — `useFeed`-shaped but parameterized by `(pubkey, limit)`, re-running on change; returns `{ data, loading, error }` (whole result object on `success`). One hook, both surfaces (the intake's "one read-path helper parameterized by limit", realized at the hook).
- **Story #2** `ui/src/components/ProfileContentSection.jsx` — `ProfileContentSection({ pubkey })` using `useUserNotes(pubkey, 1)`; a `bsp-section` with `<h3>Content</h3>`, a pure body (loading / one `<NoteCard>` / empty), and an always-present `<Link to={\`/user/${pubkey}/notes\`}>`. Inserted as the **last child** of `BrainstormProfile.jsx`'s content fragment (after the Reputation section, `:406`). A self-contained component keeps the edit to the big shared file a one-line insert + import.
- **Story #3** `ui/src/pages/BrainstormUserNotes.jsx` — modeled on `BrainstormFollows.jsx`'s shell; `useUserNotes(pubkey, 50)`; a back link, a header naming the user (small `/api/profiles?pubkeys=` fetch), a pure `renderUserNotesState` mapping OK→`items.map(<NoteCard>)` / EMPTY→empty copy / defensive→neutral copy. Route added to `ui/src/App.jsx` beside the other `/user/:pubkey/*` routes.
- **`NoteCard`: reused unchanged — no variant prop** (see the dedicated decision below).

- **Pros:** mirrors three established patterns (hook / sub-page / pure-render); one hook serves both surfaces; strictly additive (two one-line edits to shared files); `NoteCard` untouched → the feed carries zero risk; pure render helpers + copy constants make both surfaces sentinel-testable without a browser.
- **Cons:** a `useFeed`/`useUserNotes` near-duplication (the hooks differ only by args) — acceptable and parallel to having two read paths; a future `useNotes` generalization is a trivial later step, not worth coupling now.

### Option B — Fold the Content section's fetch+render inline into `BrainstormProfile.jsx`; no shared hook/component

- **Cons (decisive):** puts feature logic + a fetch effect into the already-large profile page; no reuse with the notes page; the state→view mapping is no longer an importable unit (defeats the sentinel-test pattern). Rejected — same reasoning ADR `live-feed/0002` used to reject inlining into `App.jsx`.

### Option C — Add a compact/`actionsless` **variant** to `NoteCard` for the profile latest-note

`NoteCard`'s header invites this ("layout variants … should arrive as explicit props … the first consumer that needs one should add it here"). The profile Content section is the first non-feed consumer.

- **Cons (decisive *now*):** the operator's intent is simply "show the latest kind-1 note" — **no compact/stripped requirement was stated**. Adding a variant prop **modifies the shared `NoteCard`** (touching the feed's component) for no required behavior, trading the epic's zero-risk additivity for speculative flexibility. The full card (including its actions menu — copy link/id, tag) is coherent on a profile. **Decision: reuse `NoteCard` as-is; add no variant.** When a surface genuinely needs a compact card, the prop is added to `NoteCard` per its own guidance — a deferred, separate change. (Recorded in `engineering-team/follow-ups.md` / the epic.)

## Decision

**Option A**, with **`NoteCard` reused unchanged (no variant — Option C deferred)**. A shared `useUserNotes(pubkey, limit)` hook feeds a self-contained `ProfileContentSection` (limit 1, appended as the last profile section) and a new `BrainstormUserNotes` page at `/user/:pubkey/notes` (limit 50, modeled on `BrainstormFollows`). Both delegate their body to a pure, named-exported render helper with module-level copy constants. The only edits to existing shared files are two single-line insertions (+ imports) in `App.jsx` and `BrainstormProfile.jsx`; `NoteCard.jsx` and the feed are untouched.

## Consequences

- **Enables:** the two user-visible surfaces the epic exists to stand up; the Content section's "View all" links the profile to the page.
- **Constrains:** both surfaces are coupled to ADR 0001's response shape (`status`/items); a change there changes them. `NoteCard` stays the single home for per-note presentation — future per-note improvements land once for the feed and both new surfaces.
- **Build/deploy:** the Vite `/dist` must be rebuilt (`npm run build` in `ui/`) for the route/section to resolve client-side — the existing build step, no new tooling.
- **New debt / follow-up (tracked):** a `NoteCard` layout-variant prop (Option C) when a compact card is first genuinely needed; a `useFeed`/`useUserNotes` generalization if a third notes consumer appears. Both deferred, neither blocking.
- **Defensive vs empty copy:** transport/`INVALID` failures collapse to the same operator-delegated "no kind-1 events could be located" message (the operator's wording is deliberately agnostic between "none exist" and "couldn't load"). A future "couldn't load — retry" distinction is a possible enhancement, out of scope.
- **Firmware reinstall required?** **No.** Renders existing endpoint output; defines no concepts, changes no schema.

## Implementation notes

All UI under `ui/src` (Vite — `npm run build` in `ui/` to reflect changes in `/dist`).

- **New hook: `ui/src/hooks/useUserNotes.js`** — mirror `useFeed.js`; signature `useUserNotes(pubkey, limit)`:
  - `useEffect` deps `[pubkey, limit]`; guard `if (!pubkey) { setLoading(false); return; }`.
  - `fetch(\`/api/user/${pubkey}/notes?limit=${limit}\`, { signal })` → `.then(r=>r.json())`; on `json.success` set `data = json` (whole `{status, relaySource, items}`), else set `error`; `catch` (ignore `AbortError`) sets `error`; abort on unmount.
  - Return `{ data, loading, error }`.
- **New component: `ui/src/components/ProfileContentSection.jsx`** — `export default function ProfileContentSection({ pubkey })`:
  - `const { data, loading, error } = useUserNotes(pubkey, 1);`
  - Module-level `export const CONTENT_COPY = { HEADING:'Content', EMPTY:'No kind-1 events could be located for this user.', VIEW_ALL:'View all notes →', LOADING:'Loading…' };` (punctuation non-binding per the stories).
  - Render `<section className="bsp-section bsp-content-section">` → `<h3>{CONTENT_COPY.HEADING}</h3>` → `renderContentBody({ data, loading, error })` → `<Link className="bsp-content-viewall" to={\`/user/${pubkey}/notes\`}>{CONTENT_COPY.VIEW_ALL}</Link>` (link present in **all** states, per #2 AC).
  - `export function renderContentBody({ data, loading, error })` — **pure** (no fetch/auth/router/browser globals): `loading && !data` → `LOADING` line; `data?.status==='OK' && data.items?.[0]` → `<NoteCard item={data.items[0]} />` (the single latest; never more); else (`EMPTY`/`error`/`INVALID`/unknown) → `<div className="bsp-empty">{CONTENT_COPY.EMPTY}</div>`.
- **Edit: `ui/src/pages/BrainstormProfile.jsx`** — `import ProfileContentSection from '../components/ProfileContentSection';` and insert `<ProfileContentSection pubkey={pubkey} />` as the **last child inside the content fragment** — immediately after the Reputation `</div>` (`:406`), before the fragment closes (`:408`). One line + import; the Reputation/grid data path and every existing section are untouched (#2 "additive/no-regression" AC).
- **New page: `ui/src/pages/BrainstormUserNotes.jsx`** — model the shell on `BrainstormFollows.jsx`:
  - `const { pubkey } = useParams(); const { user, login, logout } = useAuth();`
  - `const { data, loading, error } = useUserNotes(pubkey, 50);`
  - Subject name for the header: small effect fetching `/api/profiles?pubkeys=${pubkey}` → `profiles[pubkey]?.display_name || name`, default `nip19.npubEncode(pubkey).slice(0,12)+'…'` (mirror `BrainstormProfile.jsx:132` + `safeNpub` in `BrainstormFollows.jsx:11`).
  - Module-level `export const NOTES_COPY = { HEADING:'Notes', INDICATOR:'Showing the most recent 50 notes.', EMPTY:'No kind-1 events could be located for this user.', LOADING:'Loading notes…' };`
  - Shell: `bsp-page` → `bsp-top-bar` (logo + `<BrainstormUserMenu user login logout/>`) → `bsp-content` → header `<Link className="bsp-back-link" to={\`/user/${pubkey}\`}>← Back to profile</Link>`, `<h1 className="bsp-follows-title">{NOTES_COPY.HEADING}</h1>`, and the subject name (e.g. a `bsp-notes-subtitle` line) so the page names whose notes (#3 "whose notes" AC).
  - `export function renderUserNotesState({ data, loading, error })` — **pure**, mirroring `renderFeedState`: `loading && !data` → `LOADING`; `error || data==null || !['OK','EMPTY'].includes(data.status)` → `<div className="bsp-empty">{NOTES_COPY.EMPTY}</div>` (defensive collapses to the same message); `data.status==='EMPTY'` → same empty block; `data.status==='OK'` → `<div className="bsp-notes-indicator">{NOTES_COPY.INDICATOR}</div>` + `<div className="bsp-notes-list">{data.items.map(it => <NoteCard key={it.id} item={it} />)}</div>` **in array order** (already newest-first; do not re-sort).
- **Edit: `ui/src/App.jsx`** — `import BrainstormUserNotes from './pages/BrainstormUserNotes';` and add `{ path: '/user/:pubkey/notes', element: <BrainstormUserNotes /> }` to the router array, beside the other `/user/:pubkey/*` routes (after `:128`). Server needs no change — the SPA fallback already 200s any non-`/api/` path (per ADR `live-feed/0002` §"How this app serves front-end pages").
- **Styles: `ui/src/styles.css`** — reuse `bsp-page`/`bsp-top-bar`/`bsp-content`/`bsp-section`/`bsp-empty`/`bsp-back-link`/`bsp-follows-title`/`bsp-note-card*`/`bsp-feed-list`. Add only minimal token-based classes if needed (`bsp-content-section`, `bsp-content-viewall`, `bsp-notes-list`, `bsp-notes-indicator`, `bsp-notes-subtitle`) using existing CSS variables; cap the column width + wrap note text (`overflow-wrap:anywhere`) so the page never exceeds 1280px (#3 no-overflow AC). `NoteCard`'s own `bsp-note-card-*` styling already exists from the feed.
- **No new dependency, no lint/typecheck/build tooling, no concept/firmware change. `NoteCard.jsx` is not edited.**

### Testability

UI is tested by **source-regex sentinels** under the `test/test.js` Node runner (JSX can't transpile in that harness — see `test/live-feed-feed-page.test.js` and the profile sentinel tests). The pure render helpers + module-level copy constants make sentinels precise:
- `ProfileContentSection` / `renderContentBody`: sentinel the `Content` heading, the `CONTENT_COPY.EMPTY` string, the single-`NoteCard` OK branch, and the always-present `to={\`/user/${'${'}pubkey}/notes\`}` link.
- `BrainstormUserNotes` / `renderUserNotesState`: sentinel the back link, the heading + subject-name fetch, the `OK` → `items.map(NoteCard)` branch, the indicator, and the `EMPTY`/defensive copy.
- `BrainstormProfile.jsx`: sentinel that `<ProfileContentSection` is rendered after the Reputation section and that the existing sections/`TRUST_METRICS` path are unchanged.
- `useUserNotes`: sentinel the `\`/api/user/${'${'}pubkey}/notes?limit=${'${'}limit}\`` URL, the `success`→`data` pass-through, and the abort-on-unmount.
- `App.jsx`: sentinel the `/user/:pubkey/notes` route → `<BrainstormUserNotes>`.
- **Rendered-UI confirmation** (the one piece wanting a browser) is gathered on **staging** after deploy (this epic targets staging): an anonymous `/user/<pubkey>/notes` 200 with ≥1 card, and the profile's Content section — a deploy-stage capstone, not a per-story blocker. (Local full-stack verification is intentionally avoided — the shared local Docker stack is in use by the parallel session.)

## Out of scope

- The read/selection logic (ADR 0001).
- A `NoteCard` compact/actionsless **variant** (Option C — deferred until a surface needs it).
- More than one note in the Content section; pagination beyond 50; content kinds other than kind-1; replies/threading/reposts/reactions; tagging notes.
- A PoV/source selector (these are the viewed user's own posts).
- A "couldn't load — retry" state distinct from the empty message (deferred enhancement).
- Any write/publish; any change to the feed, search, ranking, or firmware.
