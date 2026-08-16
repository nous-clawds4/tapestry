# Story 2: ORE-06 /followers + ORE-07 /muters (global)

**Status:** Approved
**Created:** 2026-08-16
**Type:** Feature

## Background
Story 1 shipped the mandatory ORE-03 `/rank/pubkeys`; both R&D instances now validate green in
npub.world. This story completes the ore-parity book's parity bullet: the NosFabrica instances
also register **ORE-06 `POST /followers`** and **ORE-07 `POST /muters`** — the top-ranked
followers/muters of a target pubkey — and npub.world's provider dialog lists Followers (ORE-06)
as an optional capability it uses (it shows no muters row; ORE-07 is spec + NosFabrica parity).

The upstream spec's framing maps directly onto machinery we already have: "the complete follower
set is unknowable; the top-ranked portion is knowable and useful" is exactly our **verified**
inbound line — the WoT cutoff (`influence > VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`) that the
profile page's verified-followers/muters surfaces and ORE-02's verified inbound counts already
use. Observed sibling behavior (api.brainstorm.world, 2026-08-16): `{ results, total, ttl }`
with raw float ranks and total = full indexed set (158k for Odell vs our verified ~19.5k), and
**200 for unknown pubkeys** despite the spec's optional 404 row. We keep our own house scale and
posture (integer ranks, no `ttl`, no-404) — the spec permits both; consistency within our
provider wins.

## User-facing description
As a nostr client using an R&D Brainstorm instance as my Open-Ranking provider, I want to ask
for the top-ranked followers (or muters) of any pubkey, so that I can show who meaningfully
follows — or has muted — an account, ordered by web-of-trust rank, without crawling kind-3/10000
events myself.

## Acceptance criteria
Testable from outside (anonymous HTTP; routes off the `/api/` prefix, same as existing ORE routes).

- [ ] **Capability doc extended.** `GET /.well-known/open-ranking.json` → 200; now also maps
      **`/followers`** and **`/muters`** each to a non-empty array whose first (default) element
      is the global algorithm (`id: "graperank"`, `pov: false`). Existing entries unchanged; the
      official `open-ranking` SDK's `validateCapabilities()` still accepts the document.
- [ ] **Followers happy path.** `POST /followers` with `{ "pubkey": "<valid hex>" }` → 200 with
      `{ results: [{ pubkey, rank }, …], total }`: `results` are the target's **verified
      followers** (the WoT cutoff line used by the existing verified-followers surfaces), each
      ranked by **their own** global GrapeRank (`round(influence × 100)` — same scale as
      ORE-02/03), sorted descending, at most `limit` entries; `total` is the verified-follower
      cardinality independent of `limit` truncation. No `ttl` (ADR open-ranking/0004).
- [ ] **Muters happy path.** `POST /muters` — the identical contract over the mute graph
      (verified muters of the target).
- [ ] **`limit`.** Optional positive integer with a sensible provider default; zero, negative,
      non-integer → `422`; a value above the provider maximum → `422` (per ORE-06/07 — unlike
      ORE-03's silent clamp). Default and max are advertised in the developers docs and pinned
      by tests (values: Architect's call).
- [ ] **Unknown / empty targets.** A valid-hex pubkey unknown to this instance → 200 with
      `results: []` and `total: 0` — the honest empty answer; we deliberately do not use the
      spec's optional `404` row, consistent with ORE-02/03's no-404 posture and the sibling
      implementation's observed behavior. A known target with no verified followers/muters →
      the same shape.
- [ ] **ORE-00/01 conventions.** Missing or invalid `pubkey` → `422` + `X-Reason`; unsupported
      `algorithm` → `422`; a `pov` supplied to the global algorithm is ignored (200); malformed
      JSON → `400`; every response carries `Content-Type: application/json` +
      `Access-Control-Allow-Origin: *`; `OPTIONS` preflight behaves like the existing ORE routes.
- [ ] **Additive / isolated.** Read-only; no new infrastructure, firmware/schema/pipeline or
      nginx change. Existing ORE endpoints byte-identical apart from the capability-doc growth;
      the ORE-02/03/05 suites stay green unchanged.

## Concepts touched
No new concept-graph concepts. Existing concepts referenced, not modified: `graperank`,
`web-of-trust` (handles per-deployment). Existing machinery (reference, do not re-define):
- **Verified-followers/muters queries** — `src/api/grapevineInteractions/queries/`
  (`followersWithMetrics.js`, `mutersWithMetrics.js`, `cypherQueries.js`): inbound
  `FOLLOWS`/`MUTES` edges filtered by `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (default 0.05,
  `/etc/graperank.conf`), each row carrying the follower's own `influence`.
- **ORE capability registry + conventions** — `src/api/open-ranking/capabilities.js`,
  `shared.js` (single-source registry; hex validation, headers, error triples).
- **ORE-02 verified inbound counts** — the same verification line these lists must agree with
  conceptually (`followers`/`muters` in `/stats/pubkey`).

## Out of scope
- `pov: true` personalized variants (W12 auth gate, ADR open-ranking/0005) — unchanged.
- ORE-04 `/recommend/pubkeys`, ORE-08 `/compromised/pubkeys`; ORE-A/NWT auth; `202`/`Retry-After`.
- Changing ORE-02's zeroed-200 answer for unknown pubkeys (predates the spec's 404 row; any
  alignment is a separate decision — this story only sets the 06/07 posture).
- Cursor/offset pagination beyond `limit`; any UI beyond the developers docs page sections.
- The NosFabrica codebase; npub.world's lack of a muters row (their UI, not ours).

## Open questions
All resolved at the Architecture gate (ADR ore-parity/0002, operator-approved 2026-08-16):
- **`total` source & freshness** — resolved: live count from the same filtered scan as the list
  (self-consistent responses); drift vs `/stats/pubkey`'s batch-written counts documented (ADR
  Option C rejection).
- **Default and max `limit`** — resolved: default 50, max 1000; over max → `422` (ADR decision 2).
- **Cutoff for muters** — resolved: muters have their own `VERIFIED_MUTERS_INFLUENCE_CUTOFF`
  (followers use `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`); each endpoint uses its own (ADR
  decision 4).
- **Tie order** — resolved: `influence DESC, pubkey ASC` (ADR decision 3).

## Linked artifacts
- ADR: `engineering-team/decisions/ore-parity/0002-followers-muters.md` (Accepted)
- Test plan: `engineering-team/stories/ore-parity/2-followers-muters.test-plan.md`
  (`test/open-ranking-followers-muters.test.js`, 16 tests)
- Review: (filled in after Review phase)
