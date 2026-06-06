# ADR 0032: Degraded posting fallback for declaration circles

**Status:** Proposed
**Date:** 2026-06-06
**Story:** `engineering-team/stories/communities-go-live/2-posting-fallback.md`

## Context
Declaration circles gate the composer on real roster membership (Story 47):

```
// CommunityDetail.jsx:339-340
const viewerIsMember = isDeclaration && !!viewer && rosterState.members.some(m => m.pubkey === viewer)
const canCompose = isDeclaration ? (signedIn && viewerIsMember) : (signedIn && joined)
```

The roster is read cross-origin from the platform trust engine, which is **not reachable in production yet** (Story 1, cross-team gated). The read layer already degrades gracefully — it never throws and signals reachability:

```
// CommunityDetail.jsx:124-145 — getRoster never throws; returns degraded:true when unreachable
getRoster(community, { wotPov: 'house' })
  .then(r => setRosterState({ status: 'ready', members: r.members, degraded: r.degraded }))
  .catch(() => setRosterState({ status: 'ready', members: [], degraded: true }))
```

So `rosterState.degraded` already distinguishes **unreachable** from **reachable-but-empty** (the People tab uses exactly this at lines 489 vs 492). The defect is only that `canCompose` does not consult `degraded`: when the source is unreachable, `members` is empty, so `viewerIsMember` is false, so the composer is locked — including for a founder in a brand-new circle. This is the live posting-lock.

**Constraints:** JS-without-build (no new tooling, per CLAUDE.md). Bespoke circles keep their existing `signedIn && joined` gate (out of scope). The fix must not open posting on a *healthy-but-empty* roster (story criterion 4) — that would silently make a real empty circle post-to-all. Founder detection is available: for declaration circles the real founder is `c.founder` (the code already insists on the real founder for the a-tag at lines 176-186). The interim local "joined" flag is `joinedSet.has(c.slug)` (line 330).

No concepts change. This is a client gate-logic change only.

## Options considered

### Option A — Degraded falls back to any signed-in viewer
`canCompose = isDeclaration ? (signedIn && (viewerIsMember || rosterState.degraded)) : (signedIn && joined)`
- **Pros:** dead simple; matches a literal reading of story criterion 1 ("a signed-in viewer … a usable composer"); guarantees the founder can post.
- **Cons:** during any trust-source outage, *every* signed-in user can post to *every* declaration circle, regardless of whether they ever belonged. Since the source is currently dark **permanently** (until Story 1), this effectively makes all declaration circles open-to-all-signed-in right now. That betrays the trust posture more than the story intends, even with a disclosing note.

### Option B — Degraded falls back to the interim gate, extended to the founder
```
const isFounder    = isDeclaration && !!viewer && viewer === c.founder
const rosterDegraded = isDeclaration && rosterState.degraded
const canCompose = isDeclaration
  ? (signedIn && (viewerIsMember || (rosterDegraded && (joined || isFounder))))
  : (signedIn && joined)
```
- **Pros:** preserves the trust posture — during an outage, posting is limited to people who founded the circle or locally asserted "I'm in" (`joined`), not arbitrary signed-in users. Guarantees the founder (criterion 3). Honors the handoff's "fall back to the interim `signedIn && joined` gate", adding the founder so a brand-new circle isn't locked to its own creator. A healthy-but-empty roster (`degraded === false`) is untouched, so criterion 4 holds by construction.
- **Cons:** a genuine member who is in the (now-unreachable) roster but never locally "joined" this session is not covered during an outage. Mitigated by `joinedSet` persistence (joining is recorded in the outlet context, not session-only) and by the founder branch; refines story criterion 1 from "any signed-in viewer" to "a signed-in viewer who founded or joined."

## Decision
We chose **Option B**. The product thesis is trust, not free-for-all; opening every circle to every signed-in user for the entire (currently permanent) dark window is the wrong default, even transiently. Option B keeps conversation alive for the people with a real claim to the room — the founder and anyone who said "I'm in" — while a healthy-but-empty roster stays correctly gated. This **refines story criterion 1**: a usable composer is shown to a signed-in viewer **who has founded or joined** the circle when the source is unreachable, not to literally any signed-in viewer. (Flagged for PO confirmation at the gate.)

## Consequences
- **Enables:** founders and joined members keep posting through the dark window and any transient outage; the live posting-lock is resolved without waiting on Story 1.
- **Constrains:** the fallback is deliberately narrow. A roster-only member who never locally joined is not covered during an outage — acceptable because the common cases (founder, "I'm in" clickers) are, and the window is transient once Story 1 lands.
- **Self-healing:** when the source recovers, `degraded` becomes false and the rule reverts to pure `viewerIsMember` with no code change. After Story 1, the founder posts via real membership (founder auto-belongs) and the `isFounder` branch only matters during outages.
- **Follow-up debt:** none. The `isFounder` branch is small and durable.
- **Firmware reinstall required?** No (no concept changes).

## Implementation notes
- File: `ui-communities/src/pages/CommunityDetail.jsx`
  - Near line 339, add `const isFounder = isDeclaration && !!viewer && viewer === c.founder` and `const rosterDegraded = isDeclaration && rosterState.degraded`.
  - Change `canCompose` (line 340) to the Option B expression above.
  - Add a calm degraded note rendered **above the composer form** (inside the `tab === 'conversation'` block, before the `canCompose ?` form at line 525) when `rosterDegraded && canCompose`. Copy (from the Phase 2 style guide, no error tone): **"We can't reach the trust network right now, so we can't confirm membership. You can still post."** Use a non-alarming style consistent with existing `joinPrompt`/note styling in `CommunityDetail.module.css` (reuse a token-based class; no hardcoded colors).
  - Leave `composePrompt` (lines 343-347) unchanged for the non-degraded gated case. When `rosterDegraded` and the viewer is neither founder nor joined, the existing peer-framed prompt still shows (they remain gated) — acceptable.
- No change to `roster.js`, `getRoster`, or the bespoke branch.

## Out of scope
- Turning the trust surface data-live (Story 1).
- Covering a roster-only member who never locally joined, during an outage (declared a non-goal above).
- Any change to the healthy-path trust gate or to bespoke circles.
