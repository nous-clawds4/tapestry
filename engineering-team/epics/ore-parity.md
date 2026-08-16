# Epic: ore-parity

**Created:** 2026-08-15
**Status:** Open
**Book:** `engineering-team/audits/ore-parity/book.md` (acceptance-frame, standard gated mode)
**Provenance:** Operator request 2026-08-15 (in-session): npub.world's provider validation fails
against the R&D instances with `no algorithms registered in the mandatory /rank/pubkeys`; the
NosFabrica instances validate green. Operator chose "conformance + parity" scope. No `_intake.md`
entry — the request went straight into story 1.

## Goal
Make the R&D instances (staging.brainstorm.world, tapestry.brainstorm.world) **validate and work
as Open-Ranking providers in real ORE clients** (npub.world being the reference case), at
endpoint-surface parity with the NosFabrica instances — except `pov: true` personalized variants,
which stay deliberately gated (worksheet W12, ADR open-ranking/0005).

The retired `open-ranking` epic shipped ORE-01 (capability doc), ORE-02 (`/stats/pubkey`), and
ORE-05 (`/search/pubkeys`), scoping the rest out. The upstream spec marks ORE-03 `/rank/pubkeys`
`mandatory`, and the official `open-ranking` JS SDK hard-fails any provider that doesn't register
it — so our provider has never been fully conformant; npub.world is the first client we've pointed
at it that enforces the rule. The ORE-01 honesty rule holds throughout: the capability document
advertises an endpoint only in the same story that implements it.

## Stories
`stories/ore-parity/`:
1. **rank-pubkeys** — **ORE-03 `POST /rank/pubkeys`** (global `graperank` only): batch counterpart
   of ORE-02, registered in the capability document; the SDK's `validateCapabilities()` passes and
   npub.world's Validate flips to success. *(approved — in cycle)*
2. **followers-muters** — **ORE-06 `POST /followers` + ORE-07 `POST /muters`** (global only): the
   top-ranked verified followers/muters of a target pubkey, registered in the capability document.
   Structural twins, one story. *(planned — drafted after story 1 ships)*

## Out of scope (whole epic)
- `pov: true` personalized algorithms anywhere (W12 auth gate; ADR open-ranking/0005).
- ORE-04 `/recommend/pubkeys`, ORE-08 `/compromised/pubkeys`, ORE-A / NWT auth.
- The `202`/`Retry-After` async pattern (we answer synchronously or error).
- Any UI; any change to the NosFabrica codebase.

## Concepts / machinery (referenced, not re-defined)
- **ORE provider module** — `src/api/open-ranking/` (registry-driven capability doc + per-request
  algorithm resolution; ORE-00 conventions in `shared.js`).
- **GrapeRank `influence`** — ORE `rank = round(influence × 100)`; global POV = the instance's
  owner baseline, as served by ORE-02 today.
- **Verified followers / muters** — the graph's verified inbound-edge machinery (counts already
  ride ORE-02 responses); story 2's data source.
