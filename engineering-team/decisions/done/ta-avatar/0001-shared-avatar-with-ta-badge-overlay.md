# ADR 0001: A shared Avatar component that badges the TA with the brand mark

**Status:** Proposed
**Date:** 2026-08-06
**Story:** `engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.md`

## Context

Story 1 asks for one thing with five observable consequences (ACs, paraphrased): TA-authored rows
render the **owner's** picture with the brand mark badged on a corner; hover/AT identifies it as
"Tapestry Assistant of <owner>"; a missing or failing owner picture still shows something branded
and badged; **any** author with a dead picture URL shows a letter rather than a broken-image glyph;
and the TA's own user page header carries the same badged avatar.

### Concept-graph orientation (done first, per AGENTS.md §1–3)

The local stack was reachable. `/api/concept-graph/summaries` returns **48 concepts**; the three-call
pattern was then run on `39998:<TA>:nostr-user` (`/neighbors` → supersets only, no assistant-related
neighbor). **No concept models the assistant identity.** `nostr-user` and `image` exist but neither
is touched: this story renders an existing kind-0 field client-side and defines no new graph
structure. **No concept change, therefore no firmware reinstall.**

*(Handles are cited by slug because the TA pubkey is per-deployment and gets recreated — the live
value on this machine differs from CLAUDE.md's parenthetical and from what OPEN.md rows 44/71/127
recorded on three earlier dates. Nothing in this ADR may carry a literal TA pubkey.)*

### Codebase facts this design rests on (verified on `origin/staging`, 2026-08-06)

- **No shared avatar component exists.** `ui/src/components/AuthorCell.jsx:28-37` renders either
  `<img className="author-avatar">` or an **empty** `<span className="author-avatar-placeholder">`
  (`ui/src/styles.css:1027-1042` — a grey disc, no glyph). There is **no `onError` handler**, which
  is the broken-image gap AC4 names.
- **AuthorCell is the leverage point: 33 call sites across 28 files**, and **no call site passes
  `size`** — so its signature `{ pubkey, profiles, size }` can be preserved exactly while its
  internals change once.
- **No badge-overlay pattern exists anywhere** in `ui/src`; every avatar class is a bare circle with
  no positioned wrapper. This is net-new CSS.
- **`useConfig()` already exposes `taPubkey` and `ownerPubkey`** (`ui/src/context/ConfigContext.jsx:10-11,20-40`),
  fetched once at app start and consumed by 38 files. This is the sanctioned runtime TA lookup.
- **`useProfiles` has a module-level cache but no in-flight dedupe** (`ui/src/hooks/useProfiles.js:4,44-70`):
  N components mounting on the same tick with the same uncached pubkey each fire their own request.
  On a concepts table where most rows are TA-authored, a per-row owner lookup would mean dozens of
  identical `/api/profiles` calls in one paint.
- **Backgrounds differ by context**: table rows sit on `var(--bg-secondary)` (`.data-table-wrapper`,
  `styles.css:286-291`); the user page header sits on `var(--bg)`. Palette is **dark-only** — one
  `:root` block, no `prefers-color-scheme`, no theme toggle.
- **`.author-avatar` carries `margin: -8px 0`** (`styles.css:1033`) so a 40px circle fits a 10px-padded
  row without stretching it. That compensation is context-specific and must not migrate into a
  general-purpose component.
- **`UserDetail.jsx:56` already has a TA-ish check** — `isMyAssistant`, from `user?.assistantPubkey`
  (AuthContext). That is a *different* notion: "the logged-in user's assistant". Rows are authored by
  the **instance** TA regardless of who is logged in (or whether anyone is), so this story keys on
  `useConfig().taPubkey`. Both can coexist on that page.
- **The brand mark is two paths** in `ui/public/brainstorm.svg` (6KB, `viewBox 0 0 375 375`): a
  top-level bolt `<path fill="#ff914d" … fill-rule="evenodd">`, and a brain `<path fill="#9546ed">`
  wrapped in `<g clip-path="url(#36be802866)">` whose clip is only the bounding rect `0 34 → 375 340.73`.
  The rest of the file is vectorizer residue (a filter, a mask, and a ~4.5-unit artifact blob at
  ~(267,318) painted at `fill-opacity="0.01"`).
- **Local-stack caveat, load-bearing for verification:** on this machine the owner's kind-0 has
  **no `picture`** (`{name:"Brainstorm", about, website}`) and the TA's kind-0 is **null** (never
  published). Locally, TA rows therefore exercise the *letter+badge* tier, not the photo tier.

### Constraints

No new npm dependencies, no build-step or lint tooling (CLAUDE.md), plain JSX matching existing
style, styles in `ui/src/styles.css` using that file's unprefixed `.author-*`-family naming, and the
TA pubkey resolved at runtime only.

## Options considered

### Option A — One shared `Avatar` component + a dedicated badge asset; AuthorCell delegates to it

`ui/src/components/Avatar.jsx` owns the whole avatar problem: the picture-candidate chain with
`onError` failover, the letter tier, TA detection, and the badge overlay. `AuthorCell` keeps its
signature and renders `<Avatar>`; `UserDetail`'s header does the same at 64px. A purpose-built
`ui/public/ta-badge.svg` (brand mark on a filled disc) is the badge image.

- **Pros.** One place implements the overlay and the fallbacks, so AC3/AC4 hold identically on every
  surface that adopts it; 33 call sites light up from a single internal change with zero call-site
  churn; the remaining one-off avatar `<img>` sites can migrate later without redesign; the badge
  asset is one small file with no runtime cost.
- **Cons.** Introduces a component and a CSS family the repo does not have yet; two files
  (`AuthorCell`, `UserDetail`) change shape at once; the old `.author-avatar*` rules go inert without
  being deleted (deliberate — see Consequences).

### Option B — Badge inline in `AuthorCell`, no shared component

Wrap the existing `<img>` in a positioned span inside `AuthorCell` and repeat the same block in
`UserDetail`.

- **Pros.** Smallest diff; touches nothing else; no new file.
- **Cons.** The overlay markup, the candidate chain, the letter tier and the TA lookup get duplicated
  at the second site immediately, and again at each of the ~8 remaining avatar sites later — the exact
  duplication that produced seven copies of `authorDisplayName` in this codebase. AC4's onError
  failover would land in `AuthorCell` only, leaving the identical bug live everywhere else.

### Option C — CSS-only badge via `::after` on the existing avatar (rejected on a technical fact)

Add `data-ta` to the existing `<img className="author-avatar">` and paint the badge with an `::after`
pseudo-element.

- **Rejected:** `.author-avatar` *is* an `<img>`, a replaced element, and replaced elements do not
  generate pseudo-element boxes. The badge would not render at all. A wrapper element is not a style
  preference here; it is required.

### Sub-decision — where the owner's picture comes from

- **A1 (chosen): resolve the owner's kind-0 once in `ConfigContext` and expose `ownerProfile`.**
  ConfigContext already fetches the owner pubkey at app start; chaining one `/api/profiles` call
  makes the owner's picture and name available to every Avatar for **one** request app-wide.
- **A2: call `useProfiles([ownerPubkey])` inside each Avatar.** Rejected: `useProfiles` has no
  in-flight dedupe, so a table of TA rows fires one identical request per row on first paint. It also
  spreads instance-identity fetching across N components instead of the one place that already owns
  instance identity.

## Decision

We chose **Option A with sub-decision A1**.

Option A is chosen because the story's ACs are not local to one table: AC4 ("any author with a dead
picture URL") is a property of *avatar rendering*, not of AuthorCell, and AC5 puts the same treatment
on a second page. A shared component is the only shape where those two ACs are satisfied by one
implementation rather than two divergent copies. Option C is not viable at all; Option B is viable but
starts the duplication on day one, in a codebase that already carries seven copies of a display-name
helper for exactly this reason.

A1 is chosen because instance identity (owner pubkey, TA pubkey) is already ConfigContext's job, and
because the alternative's cost is not hypothetical — it is one HTTP request per TA row per paint,
caused by a known dedupe gap in a shared hook that this story should not be rewriting.

**What we trade away:** ConfigContext gains a fifth app-start fetch (one `/api/profiles` call,
server-side cached ~5 min, ~1KB), paid on every page including those with no avatars. We accept that
for a fetch whose result is instance-wide and broadly reusable.

## Consequences

- **Enables:** every current and future avatar surface gets badge support, `onError` failover and a
  letter tier by rendering one component; stories 2 and 3 reuse the same artwork so the in-app badge,
  the branded published picture and the stamped composite are visibly one identity.
- **Constrains:** the badge is bound to `--avatar-ring` for its separation ring, so a surface on an
  unusual background must set that property rather than restyle the badge.
- **Follow-ups / debt created:**
  - `.author-avatar` / `.author-avatar-placeholder` become inert but are **left in place** — other
    rules and source-assertion sentinels may reference them; deleting them is a separate cleanup.
  - `useVerificationInfo` keeps its own uncached owner-profile fetch; it can later read
    `ownerProfile` from config instead. Not this story.
  - The `useProfiles` in-flight dedupe gap is documented here and left unfixed — it is a shared-hook
    change with repo-wide blast radius and belongs in its own story (worth an OPEN.md row).
  - The ~8 remaining one-off avatar `<img>` sites (NoteCard, BrainstormProfile, search, user menu,
    TagChip, PinnedListPanel) still have the old hide-on-error behavior until migrated.
- **Firmware reinstall required?** **No.** No concept definition changes.

## Implementation notes

**New — `ui/public/ta-badge.svg`.** Derived from `ui/public/brainstorm.svg`, self-contained, no
`<defs>`/filters/masks and no artifact path:
- `viewBox="0 0 375 375"`; a full-bleed `<circle cx="187.5" cy="187.5" r="187.5" fill="#9546ed">`;
- the **brain** `d` (the `fill="#9546ed"` path inside `<g clip-path="url(#36be802866)">`) recolored
  `#fff`, and the **bolt** `d` (the top-level `fill="#ff914d"` path) kept `#ff914d`, both with
  `fill-rule="evenodd"`;
- both paths inset inside the disc (≈70–75% scale, centered — e.g. one wrapping
  `<g transform="translate(…) scale(…)">`) so the mark never touches or clips at the disc edge. The
  clip-path `<g>` is dropped: its clip is only the artwork's bounding rect.
- Legibility is checked at the real rendered sizes (≈18px in tables, ≈29px on the user page), not at
  full scale.

**New — `ui/src/components/Avatar.jsx**`:

```jsx
export default function Avatar({ pubkey, profile, size = 40, className })
```
- `const { taPubkey, ownerProfile } = useConfig();` → `const isTA = !!pubkey && !!taPubkey && pubkey === taPubkey;`
  No literal pubkey anywhere in the file.
- **Candidate chain:** `isTA ? [ownerProfile?.picture, profile?.picture] : [profile?.picture]`,
  filtered for truthiness. Track failures **by URL, not by index** — e.g. a `dead` object keyed by
  URL, with `src = candidates.find(u => !dead[u])` and `onError` marking the current `src` dead. (An
  index-based cursor needs reset logic when the candidate list changes and is the easy bug here.)
- **Letter tier** when no candidate survives: first character, uppercased, of the owner's
  `display_name || name` when `isTA` (so a TA row still reads as *the owner's* assistant), otherwise
  the subject's `display_name || name`; `'?'` when nothing is known. Font size ≈ `size * 0.42`.
- **Badge** renders whenever `isTA` — in the photo tier *and* the letter tier:
  `<img className="avatar-ta-badge" src="/ta-badge.svg" alt="" />`.
- **Labelling:** when `isTA`, the wrapper carries `title` and `aria-label` =
  `` `Tapestry Assistant of ${ownerName}` ``, where `ownerName` falls back to `'this instance'`;
  images stay `alt=""` (repo convention — the name is adjacent text).
- Wrapper takes the pixel size via inline style (`{ width: size, height: size }`); children fill it.

**Changed — `ui/src/context/ConfigContext.jsx`:** add `ownerProfile` state; after `/api/owner/pubkey`
resolves, chain `fetch('/api/profiles?pubkeys=' + pubkey)` and store `data.profiles[pubkey] || null`;
add it to the provider value. Failures stay silent, like the four fetches already there.

**Changed — `ui/src/components/AuthorCell.jsx`:** signature unchanged. Replace the img/placeholder
branch (`:30-34`) with `<Avatar pubkey={pubkey} profile={profiles?.[pubkey]} size={size} />`; keep
`.author-cell author-cell-link`, the outer `title={pubkey}`, `handleClick`, and `.author-name`. Add a
TA name fallback: when there is no profile and `pubkey === taPubkey`, show `'Tapestry Assistant'`
instead of the short pubkey (one `useConfig()` call).

**Changed — `ui/src/pages/users/UserDetail.jsx:108-114`:** replace the img/placeholder branch with
`<Avatar pubkey={pubkey} profile={profile} size={64} />`. Leave `isMyAssistant` and its banner alone.
Leave the `.user-detail-avatar*` CSS in place.

**Changed — `ui/src/styles.css`,** new block immediately after `.author-avatar-placeholder`
(`:1042`), unprefixed to match that family:
- `.avatar-wrap { position: relative; display: inline-flex; flex-shrink: 0; --avatar-ring: var(--bg-secondary); }`
  — `--bg-secondary` is the dominant context (table rows); a surface on the page background may
  override `--avatar-ring: var(--bg)`.
- `.avatar-img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; }`
- `.avatar-initial { width: 100%; height: 100%; border-radius: 50%; background: var(--bg-tertiary); color: var(--text-muted); display: flex; align-items: center; justify-content: center; line-height: 1; }`
- `.avatar-ta-badge { position: absolute; right: -2px; bottom: -2px; width: 45%; height: 45%; min-width: 14px; min-height: 14px; border-radius: 50%; border: 2px solid var(--avatar-ring); box-sizing: border-box; background: #9546ed; }`
  — the 14px floor keeps the mark legible at small avatar sizes; the ring separates it from the photo.
- `.author-cell .avatar-wrap { margin: -8px 0; }` — the row-height compensation stays context-local
  rather than moving into the component.

**Verification notes for later phases (not test design — that is Phase 3's lane):** on this machine
the owner has no `picture` and the TA has no kind-0, so the *photo* tier cannot be observed locally
without first giving one of them a picture; expect the letter+badge tier on `/tapestry/concepts`,
`/tapestry/nodes`, `/tapestry/lists`, `/tapestry/tapestries`, the dashboard activity table, and
`/tapestry/users/<taPubkey>` (pubkey from `GET /api/assistant/pubkey`).

## Out of scope

Publishing anything to nostr (stories 2–3); migrating the remaining one-off avatar sites; deleting
the inert `.author-avatar*` rules; centralizing the seven `authorDisplayName` copies (and the 🤖
prefix stays — `<option>` elements cannot render an image); fixing `useProfiles`' in-flight dedupe;
badging customer assistants (`user.assistantPubkey`) — the component's API is principal-agnostic, so
that becomes an internal change, not a call-site change.
