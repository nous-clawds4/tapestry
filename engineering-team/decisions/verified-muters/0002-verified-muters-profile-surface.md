# ADR 0002: Verified Muters profile surface (badge + line break + list page)

**Status:** Proposed
**Date:** 2026-06-21
**Story:** `engineering-team/stories/verified-muters/2-verified-muters-profile-surface.md`
**Epic:** `verified-muters`

## Context

The profile page already renders a point-of-view-filtered counts row (`.bsp-counts` in
`ui/src/pages/BrainstormProfile.jsx:256-295`): Following, Verified Followers, Hops, then
Verified Reporters, then a `<VerificationInfo />` trigger. Each metric is a `<Link>` whose
value comes from `useUserCounts(pubkey)` (the owner-PoV `GET /api/get-user-counts` source,
ADR profile/0031) and whose target is its own `/user/:pubkey/<segment>` list page. The
counts row is a single flex container with `flex-wrap: wrap` and `gap: 0.6rem`
(`ui/src/styles.css:3456-3463`).

Story 1 (this epic, ADR 0001 — backend, accepted as proposed) added the read API this
story consumes:

- The count: `GET /api/get-user-counts` now returns `verifiedMuterCount` beside
  `verifiedFollowerCount` and `verifiedReporterCount` (owner/House PoV).
- The list: `GET /api/get-grapevine-muters?observee=<pk>` returns the verified muters as
  six-column rows **identical in shape to the Verified Followers list**
  (`{ pubkey, influence, hops, verifiedFollowerCount, verifiedMuterCount,
  verifiedReporterCount }`) — **no** report-specific fields, owner/House PoV only (a
  non-owner `observer` is refused).

Nothing renders that data yet. This story is the frontend surface: a fifth counts-row
metric (Verified Muters, **after Hops, before Verified Reporters**), a **visual line break**
separating the "good" indicators (Following / Verified Followers / Hops) from the "bad" ones
(Verified Muters / Verified Reporters), and a **list page mirroring the Verified Followers
list page** at its own bookmarkable URL.

### Acceptance criteria (quoted back from the story)

1. "Given a profile with at least one verified muter, when its profile page is viewed, then
   the counts row shows a **Verified Muters** metric rendered **between the Hops metric and
   the Verified Reporters metric**, displaying a count equal to the number of rows on its
   linked list page."
2. "Given the profile page, the **Verified Muters** metric is a clickable link to a list page
   at its own bookmarkable URL — parallel to the existing Verified Followers and Verified
   Reporters profile sub-pages — and the existing Following / Verified Followers / Hops /
   Verified Reporters metrics, their links, and their pages are unchanged."
3. "Given the **Verified Muters** metric, when it is rendered, then it appears **neutrally,
   like Verified Followers** — always a plain clickable link, with no red alarm icon and no
   negative/red styling (it does not adopt any Verified Reporters alarm treatment)."
4. "Given a desktop viewport width at which all five metrics would otherwise fit on one line,
   when the profile page is viewed, then a **visual line break** sits between Hops and
   Verified Muters, so that Following / Verified Followers / Hops render on one line and
   Verified Muters / Verified Reporters wrap to the line below."
5. "Given the Verified Muters list page for a profile, when it is viewed, then it shows the
   **same columns (and the same default sort) as the Verified Followers list page** — with
   **no** report-specific columns (no 'Report Type', no 'Reported' timestamp) — and a profile
   with no verified muters renders a normal empty list page (the same empty-state treatment
   as Verified Followers), not an error."

### Concept Graph orientation (done first, per the three-call pattern)

`/api/concept-graph/summaries` (port 7778, TA pubkey
`e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36`) confirms the story's
named concepts — `web-of-trust`, `graperank`, `nostr-user` — are **abstract concept-graph
class-thread definitions** (schema/superset nodes), not runtime data. The muter edge, the
`verifiedMuterCount` property, and the influence cutoff are runtime Neo4j node/edge
properties surfaced by the Story-1 HTTP read API — not concept-graph nodes. This is a pure
**frontend** story consuming that API. **No concept definition or schema changes.** (Same
finding as ADR 0001 §Context and verified-reporters/0002.)

### Constraints

- JS-without-build: no new lint/typecheck/build tooling; tokens only; Vite build (`npm run
  build` in `ui/`) to reflect.
- The badge styling is **FIXED = neutral, like Verified Followers** (story + acceptance
  frame bullet 5). The Verified Reporters red-alarm treatment (`reporterAlarm`,
  `.bsp-count-value-negative`, `🚩` icon — ADR profile/0032) is **explicitly not ported**.
  This ADR does not re-open that question.
- The list mirrors **Verified Followers**, not Verified Reporters: same columns, same
  default sort, no report-specific columns, **no** Reporters description/PoV/summary lines
  and **no** skeleton/retry deltas (those are reporters-only, verified-reporters/0003).
- Owner/House PoV only in v1, matching the siblings (the `?pov=` param does not alter these
  counts in this book).

## Options considered

### The line break (AC4)

#### Option A — a zero-size `flex-basis: 100%` break element between Hops and Verified Muters *(chosen)*

`.bsp-counts` is already `display: flex; flex-wrap: wrap`. Insert one empty child
(`<span className="bsp-count-break" aria-hidden="true" />`) after the Hops `<Link>` and
before the Verified Muters `<Link>`. Give it `flex-basis: 100%; height: 0; margin: 0;` so it
consumes a full row width with no visible height, forcing every sibling after it onto the
next flex line.

- **Pros:**
  - Smallest possible diff: one element + ~3 lines of CSS; the existing single container,
    its `gap`, `align-items: baseline`, and the loading-dim selectors
    (`.bsp-counts-loading .bsp-count-value`) all keep working untouched. Zero risk to the
    four existing metrics (AC2's "unchanged" clause).
  - **Established in-repo precedent** for exactly this technique: `.bs-tag-row-error`
    (`ui/src/styles.css:5050`) uses `flex-basis: 100%` inside a `flex-wrap` row to force a
    break. The mobile-column comment at `ui/src/styles.css:7094` shows the team is already
    deliberate about `flex-basis` here.
  - Honors AC4 precisely: at a width where all five *would* fit, the break still forces the
    wrap (it is not a "wrap only when crowded" heuristic — it is an unconditional row
    boundary), and at narrow widths the natural `flex-wrap` still applies to each group.
  - The break element is `aria-hidden` and carries no text, so it adds nothing to the
    accessibility tree or to screen-reader output.
- **Cons:**
  - A presentational empty element in the DOM. Acceptable and idiomatic here (it mirrors the
    existing `.bs-tag-row-error` pattern); the `aria-hidden` keeps it out of the a11y tree.

#### Option B — split `.bsp-counts` into two sibling containers ("good" row + "bad" row)

Wrap Following/Verified Followers/Hops in one `.bsp-counts` and Verified Muters/Verified
Reporters/`<VerificationInfo />` in a second `.bsp-counts` (or a `.bsp-counts-bad` variant),
stacking the two as block-level rows.

- **Pros:** the grouping is structural, not a layout trick; arguably more semantic.
- **Cons (why rejected):** it **restructures the existing metric markup**, touching the four
  metrics the story says must stay unchanged (AC2) and raising regression risk on the
  shared `bsp-counts-loading` dim, the `gap`, and `align-items: baseline` (now duplicated /
  must be kept in sync across two containers). It also forces a decision about where
  `<VerificationInfo />` lives. More change, more risk, for a result the one-element break
  achieves with near-zero blast radius. Rejected.

### The list page (AC5)

#### Option A — new `BrainstormMuters.jsx`, mirroring `BrainstormFollowers.jsx`, with a new `useGrapevineMuters.js` hook + a new route *(chosen)*

A near-copy of `ui/src/pages/BrainstormFollowers.jsx` with bounded deltas (below), consuming
a new `ui/src/hooks/useGrapevineMuters.js` (the inbound-mute mirror of
`useGrapevineFollowers.js`, hitting `GET /api/get-grapevine-muters?observee=<pk>`), wired to
a new route `/user/:pubkey/muters`. Columns, `DEFAULT_VISIBLE`, default sort, `DataTable`,
`InfoPopover`, search, `/api/profiles` batching, row→profile nav, and the empty-state
treatment are **identical to Verified Followers**.

- **Pros:**
  - Satisfies AC5 by construction: same `ALL_COLUMNS` / `DEFAULT_VISIBLE` (picture, name,
    rank visible; npub, hops, the three `verified*Count` columns hidden) — **no** Report
    Type / Reported columns; same default sort (`verifiedFollowerCount` desc, the followers'
    sort — explicitly *not* the reporters' `rank`-desc override from verified-reporters/0003
    §IN7); same `.bsp-empty` empty state ("No verified muters found for this account.").
  - Exactly the **ADR 0026/0030/verified-reporters-0003 isolation precedent** — zero
    regression risk to the live follows/followers/reporters pages (AC2's "their pages are
    unchanged"). The new copy lives in one isolated file.
  - Followers, not Reporters, is the correct template: the muters row has no per-edge
    sub-type/timestamp (mirrors ADR 0001's backend choice), so none of the reporters-only
    deltas (description line, PoV line, summary tally, skeleton loader, retry) apply.
- **Cons:**
  - A **fourth** near-duplicate page (follows / followers / reporters / muters). This is the
    standing DRY follow-up — a shared `<GrapevineList>` + cypher builder (ADR profile/0030,
    reinforced by verified-reporters/0003 §Cons) that should later absorb all four. Deferred
    here exactly as each sibling deferred it; not bundled into this story.

#### Option B — reuse/generalize one page over an interaction-type param (followers + muters + reporters)

Collapse the list pages into one parameterized page now (e.g. read the relationship from the
route segment and pick the hook/copy/sort).

- **Pros:** the genuinely DRY end state.
- **Cons (why rejected):** it edits live, shipped pages (followers and reporters are on
  staging/prod-adjacent), reintroducing regression risk on exactly the pages AC2 says must
  not change — the scope creep ADR 0026/0030 and verified-reporters/0003 each explicitly
  rejected for v1. This is the *follow-up* refactor, not this story's job. Rejected for v1,
  for the same reason the three siblings rejected it. Deferred.

### The badge (AC1/AC3)

#### Option A — a new neutral `.bsp-count` `<Link>` in the counts row, reading `verifiedMuterCount` from `useUserCounts` *(chosen)*

Add one new metric to `.bsp-counts`, slotted **after the Hops `<Link>` (and its break
element) and before the Verified Reporters block** (`BrainstormProfile.jsx`, between
`:273` and `:278`). It is an **always-on plain `<Link>`** to `/user/${pubkey}/muters`,
structurally a copy of the Verified Followers `<Link>` (`:263-266`): a `.bsp-count
.bsp-count-link` with a `.bsp-count-value` (the formatted count) and a `.bsp-count-label`
("Verified Muters") — **no** `.bsp-count-value-negative`, **no** alarm icon, **no**
conditional 0-is-not-a-link branch. The value is
`userCounts?.verifiedMuterCount ?? null`, formatted by the existing `fmtCount` (so "—" when
unavailable/loading, a genuine `0` distinct from "not loaded").

- **Pros:**
  - Satisfies AC1 (count from the same owner-PoV `useUserCounts`/`get-user-counts` source the
    siblings read — ADR profile/0031 — so the badge equals the list's row count under the
    same PoV by construction; **not** the Meili `trustScores` grid, which is the Reputation
    section only), AC3 (neutral — a structural twin of Verified Followers, with no alarm path
    reachable), and AC2 (purely additive; the four existing metrics are untouched).
  - Reuses the existing `bsp-count` / `bsp-count-link` / `bsp-count-value` / `bsp-count-label`
    classes and `fmtCount` — **no new CSS for the badge itself** (only the break element
    needs the ~3 new lines).
- **Cons:**
  - Always rendering the metric (even at `0` / "—") differs from the Verified Reporters
    block, which hides the link at `0`. That is **intentional and correct**: the story fixes
    the muters badge to behave **like Verified Followers** (always a plain link), not like
    Verified Reporters. (Note `verifiedMuterCount` already appears in the Reputation
    `TRUST_METRICS` grid at `BrainstormProfile.jsx:48`; that Meili-backed card is unrelated to
    this counts-row badge and is left untouched.)

#### Option B — reuse the Verified Reporters block (conditional link at >0, neutral when 0)

Model the badge on the Reporters block (`:278-293`) but strip the alarm.

- **Pros:** parallels the nearest "bad indicator" sibling.
- **Cons (why rejected):** the story explicitly fixes the badge to mirror **Verified
  Followers** (always a plain link), and conveys "bad" *only* via the line break — never via
  the badge's own treatment. The Reporters block hides the link at `0` and threads the alarm
  branch; copying it risks re-importing exactly the alarm semantics AC3 forbids. The
  Followers `<Link>` is the right, simpler template. Rejected.

## Decision

**Line break — Option A:** one zero-size `flex-basis: 100%` break element (new
`.bsp-count-break` class, ~3 lines of token-free CSS) inserted between the Hops `<Link>` and
the Verified Muters `<Link>` inside the existing single `.bsp-counts` container.

**List page — Option A:** a new isolated `ui/src/pages/BrainstormMuters.jsx` mirroring
`BrainstormFollowers.jsx` (same columns, same `DEFAULT_VISIBLE`, same default sort, same
empty state — **no** report-specific columns, **no** reporters-only deltas), consuming a new
`ui/src/hooks/useGrapevineMuters.js` (mirror of `useGrapevineFollowers.js`), at a new route
`/user/:pubkey/muters`.

**Badge — Option A:** a new always-on neutral `.bsp-count .bsp-count-link` `<Link>` to
`/user/${pubkey}/muters`, a structural twin of the Verified Followers badge, reading
`userCounts?.verifiedMuterCount ?? null` from the existing `useUserCounts(pubkey)` hook,
slotted after Hops (and its break) and before Verified Reporters.

Owner/House PoV only in v1, matching the siblings; the badge count and the list both read the
owner-PoV Story-1 endpoints, so the badge number equals the list row count under the same
PoV (AC1). The DRY `<GrapevineList>` refactor and personalized PoV are deferred, exactly as
the three siblings deferred them.

This ADR **does not contradict** any existing ADR. It is the muter analogue of
verified-reporters/0003 (list page) and ADR profile/0031 (count source), and it deliberately
**does not** adopt the alarm of ADR profile/0032 — the story fixes the badge as neutral. No
ADR is superseded.

## Consequences

- **Completes the feature end to end:** the Story-1 count now renders as a neutral badge that
  links to a real list page backed by `/api/get-grapevine-muters`; the line break visually
  groups the bad indicators without any alarm styling.
- **The badge count equals the list row count under the same owner PoV** (AC1): both read the
  owner-PoV Story-1 endpoints (`get-user-counts` and `get-grapevine-muters`), which share the
  `:MUTES` edge + `VERIFIED_MUTERS_INFLUENCE_CUTOFF` per ADR 0001. As ADR 0001 §Consequences
  notes, this is exact within the read path, not a hard real-time guarantee across distinct
  precomputed sources — tests should assert the badge-vs-list relationship at the read-path
  level (the page's own live row count), not real-time equality against a separately batched
  value (mirrors verified-reporters/0003 §Consequences and ADR profile/0030).
- **Four existing metrics unchanged** (AC2): the badge is purely additive and the line break
  is a single new sibling element; the four `<Link>`s, their targets, and their pages are
  untouched.
- **Fourth near-duplicate list page** → strengthens the standing DRY follow-up (ADR
  profile/0030's `<GrapevineList>` + shared cypher builder, reinforced by
  verified-reporters/0003). Still deferred — not bundled here.
- **Owner/House PoV only in v1.** Personalized/customer muter counts (the `?pov=` path) are
  deferred — the same named follow-up the follower/reporter surfaces already carry.
- **Scale:** verified-muter sets are expected small (being muted by *trusted* users is rare —
  the feature's premise); the list fetches the whole set like Followers, and the Neo4j 504
  guard is inherited from the Story-1 endpoint. No special handling.
- **Build step:** the UI is Vite-built — `npm run build` in `ui/` to reflect the new
  page/route/badge. No new tooling.
- **Firmware reinstall required?** **No.** No concept definitions or schemas change — this is
  a frontend surface over existing runtime reads. (`POST /api/firmware/install` is not
  needed.)

## Implementation notes

The Implementer reads this; specifics below. The list page and hook are near-copies of the
Verified Followers precedent — keep the diff mechanical and reviewable.

**1. Data hook (new) — `ui/src/hooks/useGrapevineMuters.js`:**
- Copy `ui/src/hooks/useGrapevineFollowers.js` verbatim, renaming the export to
  `useGrapevineMuters` and changing the one fetch URL to
  `GET /api/get-grapevine-muters?observee=${observee}`. Same `{ data, loading, error }`
  contract, same `AbortController`, same owner-PoV default (do **not** send an `observer`
  param — the endpoint defaults to the owner). Do **not** add the `refetch`/`reload` retry
  delta (that was a reporters-only addition in verified-reporters/0003 §IN10; followers does
  not have it, and the muters page mirrors followers).

**2. List page (new) — `ui/src/pages/BrainstormMuters.jsx`:**
- Copy `ui/src/pages/BrainstormFollowers.jsx`, then apply exactly these deltas (everything
  else identical — same `ALL_COLUMNS`, `DEFAULT_VISIBLE`, `PAGE_SIZE`, `PROFILE_CHUNK`,
  `DataTable`, `InfoPopover`, search, `/api/profiles` batching, `onRowClick → navigate('/user/'
  + row.pubkey)`, the row count is `rows.length`):
  - **Hook:** import and use `useGrapevineMuters(pubkey)` instead of `useGrapevineFollowers`.
  - **localStorage key:** `STORAGE_KEY = 'bsp-muters-columns'` (distinct, so it does not
    clobber the follows/followers/reporters column prefs).
  - **Title:** `Verified Muters` (the followers title adapted to muters; AC5 delegated-copy).
  - **Empty state:** `No verified muters found for this account.` (the followers empty-state
    sentence adapted to muters; same `.bsp-empty` treatment — AC5).
  - **Loading text:** `Loading muters…` (the followers text loader adapted; do **not** add
    the reporters skeleton — that was a reporters-only improvement).
  - **Default sort: UNCHANGED from followers** — `verifiedFollowerCount` descending
    (`list.sort((a, b) => (b.verifiedFollowerCount ?? -1) - (a.verifiedFollowerCount ?? -1))`).
    AC5 requires the *same* default sort as Verified Followers; do **not** apply the
    reporters' `rank`-desc override.
  - **Columns: UNCHANGED from followers** — the same `ALL_COLUMNS` (picture, name, rank, npub,
    hops, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount) and the same
    `DEFAULT_VISIBLE` (picture/name/rank visible; the rest hidden). **No** Report Type / Reported
    columns (the endpoint does not return them, per ADR 0001). Do **not** add a description
    line, a PoV line, or a summary tally (reporters-only, verified-reporters/0003).

**3. Route (new) — `ui/src/App.jsx`:**
- Add the import next to the sibling list pages (after `BrainstormReporters` at `:70`):
  `import BrainstormMuters from './pages/BrainstormMuters';`.
- Add the route object after the reporters route (after `:127`):
  `{ path: '/user/:pubkey/muters', element: <BrainstormMuters /> }`.

**4. Counts-row badge + line break — `ui/src/pages/BrainstormProfile.jsx`:**
- Read the count alongside the siblings (near `:92-93`):
  `const verifiedMuterCount = userCounts?.verifiedMuterCount ?? null;` (owner-PoV
  `useUserCounts` source, ADR profile/0031 — **not** the Meili `trustScores` grid).
- In the `.bsp-counts` container, **after** the Hops `<Link>` (`:273`) and **before** the
  Verified Reporters block (`:278`), insert in order:
  1. the break element: `<span className="bsp-count-break" aria-hidden="true" />`
  2. the neutral muters badge — a structural twin of the Verified Followers `<Link>`
     (`:263-266`):
     ```jsx
     <Link to={`/user/${pubkey}/muters`} className="bsp-count bsp-count-link">
       <span className="bsp-count-value">{fmtCount(verifiedMuterCount)}</span>
       <span className="bsp-count-label">Verified Muters</span>
     </Link>
     ```
     Always a plain `<Link>` — **no** `.bsp-count-value-negative`, **no** alarm icon, **no**
     conditional 0-is-not-a-link branch (AC3: neutral, like Verified Followers). The
     row-level loading dim (`.bsp-counts-loading .bsp-count-value`) already applies to it via
     the parent class.

**5. CSS — `ui/src/styles.css`:** add the break element near the `.bsp-counts`/`.bsp-count`
block (after `:3487`), token-free:
```css
/* Forces the "bad" indicators (Verified Muters, Verified Reporters) onto the next
   flex line, grouping them visually away from the good ones (verified-muters #2). */
.bsp-count-break {
  flex-basis: 100%;
  height: 0;
  margin: 0;
}
```
(Same `flex-basis: 100%` technique as the existing `.bs-tag-row-error` at `:5050`.)

**Not built here:** any backend change (Story 1 owns `get-user-counts` and
`get-grapevine-muters`); any alarm/threshold styling; any change to the four existing
metrics, their links, or their pages; the DRY `<GrapevineList>` refactor; personalized PoV.

## Out of scope

- The backend — `get-user-counts` (`verifiedMuterCount`) and `get-grapevine-muters`. Done in
  Story 1 (ADR 0001); consumed, not rebuilt.
- Personalized/customer PoV muter counts (the `?pov=` path) — deferred, the same named
  follow-up as the follower/reporter siblings.
- Any muter alarm threshold or red-flag styling — the badge is neutral, like Verified
  Followers; the Verified Reporters alarm (ADR profile/0032) is **not** ported and this ADR
  does not re-open it.
- Report-specific columns / description / PoV / summary / skeleton / retry — reporters-only
  (verified-reporters/0003); the muters page mirrors **followers**.
- The DRY `<GrapevineList>` + shared-cypher-builder refactor (ADR profile/0030's standing
  follow-up) — not bundled here.
- Any change to the existing Following / Verified Followers / Hops / Verified Reporters
  metrics, their links, or their list pages.
- Staging deployment and Tier-4 rendered-UI evidence (acceptance-frame bullet 8) — the
  **book's** final cross-story verification at deploy, not a per-story criterion for this
  story.
