# Legacy circle cleanup — staged, ready to execute

**Status:** 🟡 STAGED — enumeration done; execution needs relay/key access (see below).
**Date:** 2026-06-06
**Context:** Q5(a) one-off removal of the 3 legacy test circles (PRD communities-v2 §11 Q5; Story 13 / `communities-caretaking`). Outside the durable "retire a circle" pattern, which is deferred (Q5b).

## What to remove (and what to KEEP)

Enumerated from the live relay `wss://communities.brainstorm.world/relay` (`nak req`). The discover grid unions kind-39998 declarations + kind-39999 bespoke community-records (`z` ending `:brainstorm-communities`).

**KEEP — real circle, do NOT delete:**
- `friends-of-plebchain-radio` — kind-39998 Community Declaration, founder `b83a28b7…`, created 2026-06-06. A genuine circle on the new model.

**REMOVE — the 3 legacy test circles (bespoke, kind-39999).** Each has one record per curator; discovery unions across curators, so *all* records for a slug must go. **7 records total:**

| Circle | Curator (author pubkey) | Event id (kind-39999) |
|---|---|---|
| **brainstorm-developers** ("Brainstorm Developers") | `2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331` | `2a75bc5ee96018bb4be4cbfd2958b95b18232a9cb5f4436fdf1031e79bc16470` |
| | `b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450` | `027e26631f0d2d8aa5a2ebe98b867fe4c77ded3958514bbfbca864e3931506af` |
| | `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f` | `860753c0754bd6f2307c840691e9cb195ae129a9f4a853c3ac2dc96c8e3eb9c3` |
| **friends-of-bitcoin-park** ("Friends of Bitcoin Park") | `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f` | `bb532233fc55d54613732fbb838bab87115739641fe58876c19f5e5c05bea2b3` |
| **tapestry-r-d-team** ("Tapestry R&D Team") | `2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331` | `31f94cdba40f27a2bb778994552cba8a73a0edb09e0454fb724c59ab28f095d1` |
| | `b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450` | `9c0d6fec5380fe59a9d5a4a702708a8f27baa82661ba4f8290f383515634ae47` |
| | `e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f` | `28b2b270a4ddeb466ee7aaa81924dae87434f0ca86d657b3fb49531d94fd3482` |

(Curators: `2efaa715…`, `b83a28b7…`, `e5272de9…`. Confirm which are the team's test keys before deleting.)

## Two execution paths (pick one)

### Option 1 — strfry-side delete on the droplet (easiest; one command, no signing)
Removes the records from the communities relay's strfry (which is what discover reads). Needs droplet SSH + Docker access (ops/David). Confirm exact syntax against the installed strfry version.
```
# SSH to the communities droplet, then:
docker exec tapestry strfry delete --filter '{"ids":[
  "2a75bc5ee96018bb4be4cbfd2958b95b18232a9cb5f4436fdf1031e79bc16470",
  "027e26631f0d2d8aa5a2ebe98b867fe4c77ded3958514bbfbca864e3931506af",
  "860753c0754bd6f2307c840691e9cb195ae129a9f4a853c3ac2dc96c8e3eb9c3",
  "bb532233fc55d54613732fbb838bab87115739641fe58876c19f5e5c05bea2b3",
  "31f94cdba40f27a2bb778994552cba8a73a0edb09e0454fb724c59ab28f095d1",
  "9c0d6fec5380fe59a9d5a4a702708a8f27baa82661ba4f8290f383515634ae47",
  "28b2b270a4ddeb466ee7aaa81924dae87434f0ca86d657b3fb49531d94fd3482"
]}'
```
Caveat: deletes from the communities relay only. If a record was dual-published elsewhere it persists there, but discover reads `DEFAULT_RELAYS` (the communities relay), so the grid clears. These are parameterized-replaceable — a curator re-publishing would resurrect the slug; not a concern for abandoned test circles.

### Option 2 — NIP-09 kind-5 deletion (each author signs their own)
Standard, no relay-admin access, but needs each curator's key (NIP-07). Split by author:
- `2efaa715…` deletes 2 (developers, r&d-team)
- `b83a28b7…` deletes 2 (developers, r&d-team)
- `e5272de9…` deletes 3 (developers, bitcoin-park, r&d-team)

Per author, publish one kind-5 with an `e` tag per their event id above, to `wss://communities.brainstorm.world/relay`.

## Verify after
Re-run the enumeration; the 3 slugs should no longer appear, and the live discover grid should show only real circles:
```
nak req -k 39999 --limit 80 wss://communities.brainstorm.world/relay 2>/dev/null \
  | grep -o '"d","[^"]*"' | sort -u   # confirm the 3 slugs are gone
```

## Notes
- Enumeration method: `nak req -k 39998 -t t=brainstorm-community …` (declarations) and `nak req -k 39999 --limit N …` filtered to `z` ending `:brainstorm-communities` (bespoke). Unbounded `-k 39999` queries hang on this relay (no prompt EOSE) — use `--limit`.
- This is the **one-off** path only. The durable "retire a circle" capability (Story 13) is deferred pending the Q5(b) pattern decision.
