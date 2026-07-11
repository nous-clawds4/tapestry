# Epic: Profile

**Status:** Active
**Note:** Retroactive grouping created during the epic-folder migration (2026-06-04). Stories/ADRs keep their original global numbers (they are not renumbered per-epic from 1).

## What this is
The public profile page (`/user/:pubkey`) and its surfaces: the counts row (Following, Verified Followers, Verified Reporters, HOPS), the follows/followers/reporters list tables, the identity drawer, the website-link scheme, and the follows-hops distance + path page.

## Stories
`stories/profile/`:
- 29 — profile-follows-list
- 30 — profile-website-link-scheme
- 33 — profile-verified-followers-count
- 34 — profile-followers-list
- 35 — profile-verified-counts-owner-pov
- 36 — verified-counts-explainer-and-alarm
- 37 — identity-details-popover
- 38 — profile-follows-hops (HOPS stat — live directed-FOLLOWS shortest-path distance)
- 39 — profile-hops-path (follows-hops path page + HOPS link activation)

## ADRs
`decisions/profile/` — 0026, 0029, 0030, 0031, 0032, 0033 (identity-details-popover), 0034 (profile-follows-hops), 0035 (profile-hops-path).

## Deployment note
#37/#38/#39 are on `staging` with **production promotion held** — they co-promote with the in-flight tags feature once it's ready (see `MEMORY` / the prod-hold note; `OPEN.md` #7 tracks the deferred two-"Hops" PoV reconciliation).
