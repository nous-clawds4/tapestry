# Story 39: Follows-hops path page + HOPS link activation

**Status:** Done
**Created:** 2026-06-17
**Type:** Feature

## Background
Story #38 added the **HOPS** stat to the profile counts row — the directed FOLLOWS hop distance from the source (logged-in viewer, else the instance Owner) to the viewed profile — but deliberately shipped it as a **non-link** because its destination page didn't exist yet. This story builds that page and activates the link.

The number alone says *how far*; this page shows *the actual route*. Seeing the chain of people that connects you (or the Owner) to someone — "Alice → Charlie → Bob" — makes an abstract distance concrete and explorable. It depends on #38 (the HOPS stat and the live shortest-path computation), which is on `staging`.

## User-facing description
As someone viewing a profile, I want to click the HOPS stat and see the actual shortest follow-path connecting the source (me, or the Owner) to this person — as a vertical chain of profile cards — and be able to re-roll to a different equally-short path, so that I can understand and explore *how* we're connected, not just how far.

## Acceptance criteria
Testable from the outside. Each criterion gets at least one test.

- [ ] **Link activation.** On the profile page, the HOPS stat is now a clickable link to `/user/:pubkey/follows-hops` (it was a non-link `<span>` in #38). It is clickable in **all** states — finite count, 0 (self-view), and ∞.
- [ ] **Count, consistent with #38.** The page shows the hop count from the source (logged-in viewer's pubkey, else the Owner) to the viewed profile, using the same live computation and source rule as #38: a finite N, **∞** when there is no path within the cap, **0** for self-view.
- [ ] **Path as cards.** Given a finite path of length N, the page renders **N+1** profile cards in a single vertical column, **ordered source→target, top to bottom** (e.g. N=2 → Alice / Charlie / Bob). Each card shows the person's **profile picture, name, and Owner-PoV rank** (the Verification Score, always from the Owner's perspective regardless of who the source is).
- [ ] **Path matches the count.** The number of FOLLOWS steps between the shown cards equals the displayed hop count (a length-N path renders exactly N+1 cards).
- [ ] **Cards link to profiles.** Clicking any card navigates to that person's profile (`/user/<pubkey>`).
- [ ] **No-path state.** When there is no path within the cap (∞), the page shows the count as ∞ and a clear *"There is no follow path from &lt;source&gt; to &lt;target&gt;"* message, with **no** path cards and **no** re-roll button.
- [ ] **Self-view.** When source == target (0 hops), the page shows a single card (that person) and **no** re-roll button.
- [ ] **Re-roll.** When more than one shortest path of the minimal length exists, a re-roll button is shown; clicking it replaces the displayed path with a **randomly selected** one of the shortest paths.
- [ ] **Re-roll hidden when nothing to roll.** When only one shortest path exists (or in the self-view / no-path cases), the re-roll button is **not** shown.
- [ ] **Graceful failure.** If the path lookup errors or times out, the page is unaffected structurally and shows a non-misleading unavailable state — it does **not** falsely render a path or ∞.

## Concepts touched
Concept Graph API (`http://localhost:8877`) likely unreachable (stale local stack — OPEN.md #6); named in plain language for the Architect to resolve handles.

- **NostrUser** — each node along the path (source, intermediates, target).
- **FOLLOWS** — the directed edges the path traverses (the only relationship used).
- **rank** — the Owner-PoV Verification Score shown on each card.
- **Owner** — `BRAINSTORM_OWNER_PUBKEY`, the source when logged out, and the PoV for the per-card rank.

## Requester-directed constraints (settled decisions — not PO design)
Decided by the requester this session; the Architect should honor rather than re-open:

- **Adapt the `shortestPath` Cypher to return the path's nodes** (the sequence along `p`) — e.g. the first returned path — instead of `count`/`length`. The displayed count stays consistent with #38.
- **Re-roll uses `allShortestPaths`** (all distinct paths of the minimal length); the button picks a random one. ("one out of the count(p) paths.")
- **Hop cap = 20**, same as #38.
- **Per-card rank is the Owner-PoV rank from Neo4j.**
- **Source selection = same as #38**: logged-in viewer's pubkey, else the Owner. Target = the viewed profile.

## Out of scope
- Changing #38's HOPS stat semantics or its `/api/get-follows-hops` count contract beyond what activation needs.
- Pagination / listing of *all* paths at once — only one path is shown at a time, plus the re-roll.
- Performance tuning of `allShortestPaths` at cap 20 on the prod-scale graph — flagged for the Architect (it can be materially more expensive than `shortestPath`; likely needs a bounded approach / timeout, as #38 did). 
- The two-"Hops" PoV reconciliation (OPEN.md #7).

## Open questions
Resolved during planning:
- **Route:** `/user/:pubkey/follows-hops` (matches the `/follows`, `/followers`, `/reporters` siblings).
- **∞ clickable?** Yes — always clickable; the page shows the no-path state.
- **Cards clickable?** Yes — each links to `/user/<pubkey>`.
- **Re-roll visibility?** Hidden when ≤1 shortest path (and in self-view / no-path).
- **Card order:** source at top, target at bottom.

## Linked artifacts
- ADR: `engineering-team/decisions/profile/0035-profile-hops-path.md`
- Test plan: `engineering-team/stories/profile/39-profile-hops-path.test-plan.md`
- Review: `engineering-team/reviews/profile/39-profile-hops-path.md` — **PASS** (2026-06-17)
- Depends on: `engineering-team/stories/profile/38-profile-follows-hops.md` (HOPS stat + `/api/get-follows-hops`), ADR 0034.
