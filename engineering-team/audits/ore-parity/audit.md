# Build Audit: ORE Client Parity

**Book:** `engineering-team/audits/ore-parity/book.md`
**Date:** 2026-08-16
**Branch / commit range:** `4da6d53b^..143f3ba9` on staging (story 1: `3cc743c9..ae14fab5` via [PR #554](https://github.com/nous-clawds4/tapestry/pull/554) → staging, [PR #555](https://github.com/nous-clawds4/tapestry/pull/555) → production; story 2: `f5ef9afd..fa8a5d57` via [PR #556](https://github.com/nous-clawds4/tapestry/pull/556) → staging, [PR #557](https://github.com/nous-clawds4/tapestry/pull/557) → production)
**Provenance:** Acceptance-frame
**Confidence:** high

> The Build Audit is the **as-built record** — what the product *is* now, factual and source-linked. It does not propose changes — that's the seed's job.

## 1. What shipped

- **ORE-03 `POST /rank/pubkeys`** — the upstream-mandatory batch-rank endpoint: up to 1000
  pubkeys per request ranked by the instance's global GrapeRank in one Neo4j `UNWIND` round trip;
  duplicates collapse; every requested pubkey ranked (unknown → 0); registered in the ORE-01
  capability document — `stories/done/ore-parity/1-rank-pubkeys.md`.
- **ORE-06 `POST /followers` + ORE-07 `POST /muters`** — the top-ranked **verified**
  followers/muters of a target pubkey (per-edge WoT cutoffs), each ranked by their own global
  GrapeRank, with a live `total`; registered in the capability document —
  `stories/done/ore-parity/2-followers-muters.md`.
- **Real-client validation restored:** npub.world's provider Validate — previously failing with
  `no algorithms registered in the mandatory /rank/pubkeys` — now succeeds against **both** R&D
  instances with the identical checked capability set the NosFabrica instances report
  (✓ ORE-02/03/05/06; ✗ only the unplanned ORE-04/08).
- **The failure class pinned under test:** the hermetic suites run the real `open-ranking@0.1.1`
  SDK's `validateCapabilities()` (npub.world's exact code path) over the served document on every
  `npm test`, gate-off and gate-on — a capability-doc regression of this kind can no longer ship
  silently.
- **Documentation:** BIBLE §28 updated (endpoint table, PoV mapping, conventions, deferred list,
  plus a Deployment-paragraph staleness fix); `/developers/open-ranking` gained the batch-rank
  and followers/muters sections.

## 2. Epics & stories rolled up

### Epic: `ore-parity` (Status: Done, retired 2026-08-16)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 rank-pubkeys | ORE-03 batch rank + registry entry + SDK conformance test + docs | Done | `reviews/done/ore-parity/1-rank-pubkeys.md` |
| #2 followers-muters | ORE-06/07 twin verified-inbound endpoints + registry entries + docs | Done | `reviews/done/ore-parity/2-followers-muters.md` |

## 3. As-built inventory

- **User-facing:** two new public, read-only, unauthenticated HTTP surfaces off the `/api/`
  prefix — `POST /rank/pubkeys` (`{results:[{pubkey,rank}]}`, ≤1000 entries, 413 over cap) and
  `POST /followers` / `POST /muters` (`{results, total}`, limit default 50 / max 1000 → 422 over
  max, unknown target → honest empty 200); the capability document at
  `/.well-known/open-ranking.json` now advertises five endpoints. `/developers/open-ranking`
  documents all of it.
- **Domain:** no concept-graph handles touched; no firmware reinstall anywhere in the book.
- **Data & contracts:** no stored-shape changes; all reads. New code:
  `src/api/open-ranking/rank.js` (UNWIND over `NostrUser.influence`, `neo4j.int()`-pinned LIMIT)
  and `src/api/open-ranking/inbound.js` (twin builders; two bounded parameterized statements per
  request over the `FOLLOWS`/`MUTES` verified cutoffs, `NEO4J_QUERY_TIMEOUT_MS` txConfig);
  registry entries in `capabilities.js`; routes/`ORE_PATHS`/re-exports in the module `index.js`.
  One **dev-only** dependency added, exact-pinned: `open-ranking@0.1.1` (zero transitive deps;
  never installed by the container's `--production` install).
- **Deploys:** story 1 — staging run 31925121763 (2m22s, cold cache from the devDep), production
  run 31925408835 (2m15s); story 2 — staging run 31928719535 (90s), production run 31929087999
  (88s). All four smoke-tested clean; both productions promoted on explicit operator approval.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Story 1 AC-2 as drafted: happy path returns `{results, ttl}` | `ttl` omitted everywhere | intentional-change (operator-approved at the Architecture gate) | ADR open-ranking/0004 "No `ttl` anywhere" — scores recompute on their own cadence; `ttl` optional in ORE-03 (ADR ore-parity/0001 d.1) | None — npub.world's cache falls back to its 5-minute default | — |
| 2 | Frame: endpoint parity with NosFabrica | House semantics kept where the spec leaves room: integer ranks (×100) vs their floats; **verified-set** results + totals vs their full-indexed sets; no `ttl`; unknown target → 200-empty (no 404) | interpretation | Story 2 Background + ADR ore-parity/0002 (sibling behavior observed live 2026-08-16; internal consistency with ORE-02 chosen over cross-provider mimicry) | Clients see differently-scaled ranks and smaller totals than NosFabrica for the same pubkey — both spec-legal | OPEN.md row 179 (whether ORE-02 should ever adopt the spec's later-added 404 row) |
| 3 | ADR 0002: `total` = live count from the same scan | As designed — and the documented drift vs `/stats/pubkey`'s batch-written counts was observed on first staging contact (19,805 live vs 19,470 batch; muters 75 vs 72) | intentional-change | ADR ore-parity/0002 Option C rejection (self-consistency inside one response beats cross-endpoint equality) | Two endpoints can briefly disagree on counts between batch recomputes; documented on the docs page + BIBLE | — |
| 4 | ADR 0001/0002 implementation sketches | Two in-passing corrections logged by the Implementer: BIBLE §28 "Not on production" staleness fixed (production verifiably serves ORE); docs-page section numbering appended rather than spec-reordered | added-beyond-scope (logged) | Story 1 `## Deviations`; review 1 accepted both | Doc accuracy improved; none functional | — |
| 5 | ADR 0002 sketch (no Bolt-type detail) | `LIMIT` parameter pinned with `neo4j.int()` after live Neo4j rejected a plain JS number (22N03 "found 50.0") | constraint-discovered (at cycle-local, pre-commit) | Review 2 §ADR adherence; code comment `inbound.js:47-49` | None — caught before any deploy | OPEN.md row 178 (document the gotcha at `runCypher`) |

**Undocumented work:** none — every hunk in both ranges traces to a story/ADR or a logged deviation.

## 5. Quality state at close

- Test gate at close (final tree, post epic-move): `npm test` — **Overall PASS, exit 0**
  (`open-ranking-rank` 16/16, `open-ranking-followers-muters` 16/16; `stats` 29/29 and `search`
  18/18 unchanged). Recorded from the close-time run.
- Known operational behavior (not a defect): the first `/followers` call against a very large
  account immediately after a production deploy hit the documented post-deploy Neo4j cold-start
  window (SMOKE_TEST.md Tier-1 note) and succeeded on the prescribed retry; warm-path latency for
  the largest account is ~570ms.
- Review non-blocking findings, accepted: `limit: true` coerces to 1 (consistent across all
  three limit-bearing ORE endpoints); a malformed cutoff config value would silently yield empty
  results (shared failure shape with the pre-existing verified-* machinery) → OPEN.md row 180.
- Debt (ADR-logged): the verified-inbound filter is now expressed in three places
  (`cypherQueries.js`, the `*WithMetrics` modules, `inbound.js`) — consolidation deliberately out
  of scope (ADR ore-parity/0002 Consequences). Dev-only supply-chain pin `open-ranking@0.1.1` to
  revisit when upstream tags a release (ADR ore-parity/0001).

## 6. Carry-forward register

- [ ] **W12 auth (the personalized-enumeration oracle)** — unchanged by this book; still the
      blocker before any `pov: true` algorithm can be advertised (worksheet W12, ADR
      open-ranking/0005). The only remaining gap to *full* NosFabrica surface equality.
- [ ] **Personalized search (W13)** — pre-existing deferral (retired open-ranking epic Story 3),
      untouched.
- [ ] **ORE-04 `/recommend/pubkeys` / ORE-08 `/compromised/pubkeys`** — unplanned; NosFabrica
      doesn't serve them either; npub.world lists both as optional (✗ today).
- [ ] **ORE-02 404-row alignment question** — OPEN.md row 179 (from §4 #2).
- [ ] **`runCypher` integer-param documentation** — OPEN.md row 178 (from §4 #5).
- [ ] **Cutoff-config validation guard** — OPEN.md row 180 (from §5).
- [ ] **Upstream wording watch** — [Open-Ranking/protocol#9](https://github.com/Open-Ranking/protocol/pull/9)
      (prior book's proposal) still in upstream review; no interaction with this book's surface.

## 7. Process findings (harness)

Retro inputs: review "Harness friction" sections (none recorded in either review), Implementer
`## Deviations` (product-shaped only), no Direction journal (human-gated book), no prior `meta`
rows from this book. `harness-stats.sh` at retro time: 893 phase commits, 173 reviews decided
(kick-back rate 1%), books 4 open / 36 closed, cycle-time median same-day — this book: 10 phase
commits, 2 reviews, 0 kick-backs, both stories same-day. No anomaly signal.

| Finding | Source | Terminal state |
|---|---|---|
| The Implementer launched the full-suite gate in the background *before* cycle-local completed; a live-caught fix (`neo4j.int`) landed mid-run, leaving ambiguous which tree that run certified. The standing "Reviewer runs the gate themselves" control absorbed it exactly as designed (review 2 records its run as the authoritative one). | Review 2 §Quality gates; session record | **Declined** — the Reviewer-rerun control is the designed defense and demonstrably worked; serializing the Implementer's full run behind cycle-local would cost wall-clock on every story to re-buy a guarantee the next phase already provides. (Ports to Direction mode as-is: the Gate-5 rubric already requires the reviewer-run gate.) |
