# Epic: Open Ranking (ORE) provider

**Status:** Done (epic retired 2026-07-02 — OPEN.md row 17 disposition, ratified at the harness-self-improvement story-1 Review gate)
**Book:** `engineering-team/audits/open-ranking/book.md` (acceptance-frame, standard gated mode)
**Provenance:** Operator request 2026-06-18 ("implement ORE-01 on staging") + same-day scoping conversation. No `_intake.md` entry — greenfield. ORE has zero prior mention in this repo.

## What this is
A public, read-only **Open-Ranking provider** on the control panel. [Open Ranking](https://github.com/Open-Ranking/protocol) (ORE) is an external, MIT-licensed HTTP/JSON protocol for reputation/ranking/discovery on nostr. This epic implements:

- **ORE-01** — the capability-discovery document at `GET /.well-known/open-ranking.json`, advertising which endpoints/algorithms this instance offers.
- **ORE-02** — `POST /stats/pubkey`, web-of-trust stats for a single pubkey.
- **ORE-05** — `POST /search/pubkeys`, ranked profile search by free-text query.

Both endpoints map **existing Brainstorm data** into ORE's wire shapes: `rank` is the GrapeRank score (`round(influence × 100)`), already computed and already per-POV in the Meilisearch profile index (`wot_<metric>_<suffix>` columns). Each endpoint offers a **global** algorithm (`graperank`, `pov:false`, served from the instance's **house point-of-view** — the array's first/default element) and a **personalized** algorithm (`graperank-personalized`, `pov:true`).

ORE's `pov` concept *is* Brainstorm's POV-first model. The one architectural constraint: per-POV WoT columns are **provisioned**, not computed on demand (owner / configured house / provisioned customers only). So personalized algorithms serve **only provisioned POVs**; an unprovisioned `pov` returns `422` + `X-Reason` rather than a misleading silent house fallback (see worksheet **W12**).

This epic is **additive, read-only, unauthenticated, and unsigned**. Routes live off the `/api/` prefix (auto-public); no writes/signing, no firmware/schema/pipeline edits, no nginx change. With the ORE module unregistered, the rest of the app behaves as before. ORE is positioned as a **complement to the existing NIP-85 (kind 30382/10040) export** — same underlying data, HTTP query surface for a different audience — not a replacement.

## Stories
`stories/open-ranking/`:
1. **ore-provider-and-stats** — the ORE provider module + shared ORE-00/ORE-01 conventions (hex validation, CORS/`OPTIONS`, status+`X-Reason` errors, POV resolution) + the ORE-01 capability document (advertising `/stats/pubkey`) + the **ORE-02 `/stats/pubkey`** endpoint with the global (`graperank`) and provisioned-POV-only personalized (`graperank-personalized`) algorithms. A complete, minimal, conformant ORE provider — the walking skeleton. *(Done — shipped to staging, [apps#318](https://github.com/nous-clawds4/tapestry/pull/318).)*
2. **search-pubkeys-global** — the **ORE-05 `/search/pubkeys`** endpoint, **global only** (`graperank`, ranked by the instance's owner/global POV), backed by the Meilisearch profile index, **extending** the ORE-01 capability document to advertise it. *(this story — drafting now)*
3. **search-personalized** — adds `graperank-personalized` to `/search/pubkeys`, gated on a server-side **main→delegated POV resolver** (owner→TA via config; customer→relay key via `getCustomerRelayKeys`) so ORE `pov` stays the human's main pubkey across both endpoints, with a Meili-column readiness check → `422` for unprovisioned POVs. Resolves the cross-store POV seam (worksheet **W13**). Also authors the BIBLE section for the as-built ORE implementation. *(planned)*

Sequencing rationale: ORE-01 must never advertise an endpoint that doesn't exist, so Story 1 shipped the capability document **and** its first backed endpoint together; Story 2 adds global search and grows the document; Story 3 adds personalized search once the cross-store POV identity is unified (W13). The global/personalized search split was made during Story 2 planning, when personalized search proved to need a new main→delegated resolver that personalized stats did not.

## Out of scope (whole epic)
- ORE-03 `/rank/pubkeys`, ORE-04 `/recommend/pubkeys`, ORE-06 `/followers`, ORE-07 `/muters`, ORE-08 `/compromised/pubkeys`.
- ORE-A / Nostr Web Token (kind 27519) auth.
- A POV-availability probe and any upstream ORE spec PR (worksheet **W12**).
- On-demand POV computation for arbitrary (unprovisioned) POVs.
- Any UI; any change to search/profile pages, the ranking pipeline, firmware, or the NIP-85 export.

## Concepts / machinery (referenced, not re-defined)
- **House point-of-view identity** — the instance's default delegate; resolved by the `pov-resolution` epic / the three-PoV standard. Serves the global `graperank` algorithm. Not re-defined here.
- **GrapeRank `influence`** — the `[0,1]` confidence-weighted reputation score; ORE `rank = round(influence × 100)`. Source: `src/algos/personalizedGrapeRank/`; BIBLE GrapeRank section.
- **Per-POV Meili columns** — `wot_<metric>_<suffix>` where `suffix = delegatedPubkey.slice(0,8)`; the POV→delegate→suffix resolver is `src/api/_shared/pov.js`. Provisioned by the three loaders (`src/algos/nip85/loadScoresIntoMeilisearch.js`, `src/algos/customers/nip85/`).
- **NIP-85 export** (kind 30382/10040) — the existing interoperable WoT publication ORE complements. BIBLE Assistant-Keys / NIP-85 publishing tables.
