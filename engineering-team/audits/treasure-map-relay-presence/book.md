# Book of Work: Treasure Map — Relay Presence

**Slug:** treasure-map-relay-presence
**Status:** Closed
**Opened:** 2026-09-07
**Closed:** 2026-09-07
**Strictness:** Standard — all five phases (operator's choice at intake, 2026-09-07)
**Branch:** `feat/treasure-map-relay-presence` (worktree `.claude/worktrees/relay-presence`, off `staging`)

## Intent anchor

**Acceptance frame (no PRD)** — the operator's request, restated and confirmed (2026-09-07
session): the TA Treasure Map page shows only whether the Map is in the local strfry relay. Show
which relay *or relays* hold the Map being displayed — the local instance, the three Digital Ocean
Tapestry instances (`tapestry`, `staging`, `tags` `.brainstorm.world/relay`), other relays in the
Brainstorm / NosFabrica ecosystem, and general-purpose relays.

### Acceptance frame

- [x] **Coverage:** the page reports presence per location across local strfry, the Tapestry
      instance relays, the trusted-assertion relays, the trusted-list relays, and the
      general-purpose relays — one row each, not one aggregate verdict.
- [x] **Not hardcoded:** every checked relay URL comes from operator-editable configuration
      (Home > Settings > Relays), so a deployment other than this one can point at its own peers.
      No relay literal in page or component source.
- [x] **Version-aware:** because kind 10040 is replaceable, each row distinguishes *holds the
      version displayed* from *holds a different version* (with its timestamp, older or newer).
- [x] **Absent ≠ unreachable:** a relay with no matching event and a relay that times out or
      errors are reported as different states.
- [x] **Non-degrading:** a slow or failing check never delays or blocks the Map itself, the Map
      Entries panel, the TL opt-in card, or the manual editor.
- [x] **Verified against reality:** the shipped panel is checked on the local stack against the
      measured 2026-09-07 baseline (owner's Map present at 6 of 14 locations, absent from 8) — a
      panel that reports all-present would be wrong and must be caught.

## Epics in this book
- `treasure-map-relay-presence` — per-relay presence and version-divergence for the displayed Map.

## Provenance
- **Mode:** Acceptance-frame (no PRD)
- **Origin:** Operator request, in-session 2026-09-07. No `_intake.md` entry — the request went
  straight into story 1; this book is the eager anchor (OPEN.md row 29's known `/plan-feature`
  gap, opened deliberately here rather than backfilled at review).

## Provenance at close
- **Mode:** Acceptance-frame (no PRD)
- **Confidence:** high — all six frame bullets satisfied, and the last one ("verified against
  reality") was met on **production** rather than only the dev stack: all three presence states
  correct against real relays, and production's own TA pubkey (`919ba08a…`) distinct from
  staging's and dev's, confirming no hardcoded identity leaked.
- **In production:** 2026-09-07 via PR #590 → staging, PR #597 → main (`21dc569f`).

## Close artifacts
- Build audit: `engineering-team/audits/treasure-map-relay-presence/audit.md`
- Product feedback: `engineering-team/audits/treasure-map-relay-presence/prd-seed.md`
