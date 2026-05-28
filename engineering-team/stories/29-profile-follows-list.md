# Story 29: Follows list on the primary profile page

**Status:** Approved
**Created:** 2026-05-28
**Type:** Feature
**Amended:** 2026-05-28 — customer-observer support deferred to a follow-up; **v1 is owner-POV only**. See "Deferred to a follow-up" below and ADR 0026.

## Background
The primary user-facing profile (`/user/<pubkey>`) shows a bare **"Following"** count with no way to act on it. To actually *see and evaluate* who someone follows — ranked by local trust signals, from a chosen point of view — users today must leave for the legacy grapevine-analysis page, which is styled and structured for a different context. This story brings that capability into the primary profile experience as a native, standalone follows page, reusing the trust data this instance already computes locally.

## User-facing description
As someone viewing a profile, I want to open that person's follows as a list ranked by trust signals from a point of view I can choose, so that I can explore and judge who they follow without leaving the primary UI for the legacy interface.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

**Navigation & URL**
- [ ] **Entry point.** Given a profile at `/user/<pubkey>`, when it renders, then the "Following" count is a link that navigates **in the same tab** to `/user/<pubkey>/follows`.
- [ ] **Return.** Given the follows page, when the user activates a "← Back to profile" control (and likewise the browser back button), then they return to `/user/<pubkey>`.
- [ ] **Direct load.** Given `/user/<pubkey>/follows`, when loaded directly, then the page shows `<pubkey>`'s follows computed from the **instance owner's** point of view. *(Honoring `?observer=<customer>` for other points of view is deferred — see below.)*
- [ ] **Row navigation.** Given a row (an account `<pubkey>` follows), when the viewer activates it, then they navigate **in the same tab** to that account's own `/user/<that-pubkey>` profile.

**The list**
- [ ] **Listing.** Given the profile user follows N accounts, when the page loads, then each followed account appears as one row. If N = 0, an empty-state message is shown.
- [ ] **Default sort.** When the page loads, all N rows are ordered by **verified-followers count, descending**, across the whole list (not just a visible page).
- [ ] **Re-sort.** Given the list, when the user sorts by any visible column, then the rows reorder accordingly; the default remains verified-followers descending.
- [ ] **Search.** Given the list, when the user types in an in-page search, then rows are filtered by name / display name or npub.
- [ ] **Pagination.** Given more rows than fit one page, then results are paginated; moving between pages preserves the current sort, search text, selected point of view, and column visibility.

**Columns**
- [ ] **Default visibility.** On first load with no saved preferences, the visible columns are **picture, name, rank**; the hidden columns are **npub, hops, verified followers, verified muters, verified reporters**.
- [ ] **Toggle.** Every column can be shown or hidden by the user.
- [ ] **Persistence.** A user's column show/hide choices persist across reloads and sessions; a "reset to defaults" control restores the default visibility above.
- [ ] **Name fallback.** Each row's name column shows the display name; if absent, the name; if both absent, a shortened npub.
- [ ] **Rank.** The rank column shows an integer **0–100**, equal to `round(influence × 100)` from the selected point of view (not a raw decimal).

**Point of view (v1: owner only)**
- [ ] **Owner point of view.** All metrics (rank, hops, verified counts) are computed from the **instance owner's** point of view, for every viewer (including logged-in customers and logged-out visitors). Per-row values are read directly from the `NostrUser` node.

*(The point-of-view selector, customer-relative metrics, and customer-default-observer behavior are **deferred** — see "Deferred to a follow-up" below.)*

**Disclosure**
- [ ] **Local-data disclosure.** The page provides a **tappable** ⓘ affordance that reveals a note stating all data here is computed **locally by this Tapestry instance and is not imported via NIP-85**; the affordance works by tap on touch devices (not hover-only).

## Deferred to a follow-up (customer observers)
In the original story; deferred per the 2026-05-28 amendment because customer-observer trust scores live on a different node type (`NostrUserWotMetricsCard`) requiring a distinct query path (see ADR 0026). Tracked for a follow-up story:
- **Observer-relative data.** Switching point of view changes rank, hops, and the three verified counts.
- **POV selector.** A selector listing the instance's customers plus a "Global / owner" option; selecting one updates the data and the `observer` URL param.
- **Customer-default observer.** If the logged-in user is a customer, default the point of view to themselves; otherwise the instance owner.
- **`?observer=<customer>` URL support** for non-owner points of view.

## Concepts touched
*(Concept Graph API at `:8877` was unreachable during planning — concepts named in plain language; the Architect should resolve handles via `/api/concept-graph/summaries`.)*

- **Follows** — the kind:3 follow relationship being listed (the legacy API term is "follows"; the profile UI labels the count "Following").
- **GrapeRank influence / rank** — per-account trust score (0–1), displayed scaled to an integer 0–100 ("rank").
- **Hops** — graph distance from the observer.
- **Verified followers / verified muters / verified reporters** — counts of accounts that follow / mute / report the row's account and cross the instance's verification influence cutoff, computed from the observer's point of view.
- **Observer / point of view ("grapevine")** — the pubkey all scores are computed relative to.
- **Customer** and **instance owner** — drive the POV selector contents and the default-observer logic.
- **Profile** — picture / name / display_name used for the picture and name columns.

## Out of scope
- **Other interaction types** (followers, mutes, reports, frens, idols, etc.). The underlying capability generalizes to many interaction types, but this story ships **follows only**; generalizing the page is deferred.
- The makeshift `/tapestry/users/<pubkey>` page and the legacy pages themselves — unchanged.
- Serving or importing these metrics over **NIP-85** — the data is explicitly local-only, and the disclosure says so.

## Open questions
Resolved during planning (recorded for the audit trail):
- **Column-pref persistence?** → **Persist** across reloads/sessions, with a reset-to-defaults control.
- **Large-list handling for v1?** → **Include in-page search + pagination** (legacy parity).
- **Row click behavior?** → **Navigate to that account's `/user/<pubkey>` profile** (same tab).

None open.

## Notes for the Architect
- This is a **large story** (16 criteria spanning the UI plus a trust-data dependency). It's one coherent unit of value — the page is useless without its data — so it was kept whole, but the Architect is free to **propose phasing the implementation** (e.g., the data-availability work before the UI) within a single ADR.
- A key known constraint: the default sort is **verified-followers descending across the entire follow set**, so those counts (and the other observer-relative values) need to be available for ranking the whole list, not fetched lazily per visible row. Prior art for the data + POV selector exists in the legacy grapevine-analysis page; reuse vs. extension of existing endpoints is the Architect's call.
- **Amendment outcome (2026-05-28):** v1 scoped to owner POV; metrics read from the `NostrUser` node (no card join). Customer observers deferred. Disambiguation precedent: a single endpoint branches internally on `observerPubkey === 'owner'` (read `NostrUser`) vs. a customer pubkey (read `NostrUserWotMetricsCard`) — see `src/api/export/users/queries/userdata.js:24,40-54,75-85` and ADR 0026.

## Linked artifacts
- ADR: `engineering-team/decisions/0026-profile-follows-list.md`
- Test plan: `engineering-team/stories/29-profile-follows-list.test-plan.md`
- Review: *(filled in after Review phase)*
