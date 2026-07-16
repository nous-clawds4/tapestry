# ADR 0003: ORE-02 stats field set + algorithm naming (verified inbound counts, `hops`, `graperank` rename)

**Status:** Accepted
**Date:** 2026-06-19
**Story:** `engineering-team/stories/open-ranking/1-ore-provider-and-stats.md` (amends) — raised at the `open-ranking` book-close review.
**Supersedes:** ADR 0001's "ORE-02 field mapping" table + the algorithm-id naming. ADR 0001's module architecture, POV approach, provisioned-POV `422` policy, and CORS handling stand.

## Context

At book-close review the operator made three calls about the `/stats/pubkey` wire shape. Two facts made this cheap and safe to change: (1) `/stats/pubkey` is **staging-only, days old, never on prod, with no known external consumers**, and a repo grep confirms **nothing internal calls the route** — only the *shared* `get-profile-scores` query is reused, and it already returns verified counts + `hops`, so the change is a pure remap in the ORE adapter layer with **zero internal blast radius** (the shared query — and therefore `/api/get-profile-scores` + the UI — is untouched). (2) The earlier discovery analysis established ORE has **no machine-readable response-field manifest**: clients code to the ORE-02 spec's field vocabulary, learn provider specifics via `learn_more`, and generic clients realistically consume `rank`. That bounds expectations for the changes below.

## Decision

1. **Rename algorithm ids** `grapevine`→`graperank`, `grapevine-personalized`→`graperank-personalized` (both endpoints); `name` → "GrapeRank" / "Personalized GrapeRank". The id names the GrapeRank ranking method and matches the kind-30382 metric vocabulary.
2. **Inbound counts are VERIFIED:** `followers`=`verifiedFollowerCount`, `muters`=`verifiedMuterCount`, `reporters`=`verifiedReporterCount` — consistent with what kind-30382 publishes. Rationale (operator): there is **no "total" inbound count we could ever honestly return** — we never hold every kind-3 in existence (some live on relays we can't reach), so "total" is undefined; **verified** is both well-defined and genuinely useful. It's the literally-looser reading of ORE-02's `followers` ("# following this key"), but the right call for a WoT provider, and it makes ORE mirror our own NIP-85 export.
3. **`hops` is included** as an extra numeric field (ORE-02 explicitly permits additional numeric fields; clients MUST ignore unknown ones, so generic clients simply skip it). `999` = unreachable. Accepted that `hops` reaches only ORE clients that specifically support it.
4. **Outbound counts kept exact:** `follows`=`followingCount`, `mutes`=`mutingCount` — the target's own kind-3 / mute-list sizes, which *are* exactly knowable (the "total is unknowable" critique applies only to inbound). *(Operator may later drop these to match an earlier `{rank, hops, followers, muters, reporters}` list — trivial.)*

Final `/stats/pubkey` body: `{ pubkey, rank, hops, followers(verified), muters(verified), reporters(verified), follows(exact), mutes(exact), ttl }`.

## Options considered

### Option A — bundle response: verified inbound + `hops` + `graperank` rename *(chosen)*
One call returns rank + the metric bundle; inbound verified, outbound exact, `hops` added. Self-describing fields; mirrors kind-30382. Con: the metric *list* isn't discoverable from the capability doc (you learn fields from ORE-02 + `learn_more`).

### Option B — metric-as-algorithm (each metric a discoverable algorithm)
Make `rank`/`followers`/`hops` distinct algorithm ids; the value returns in `rank`. Pro: the metric list becomes machine-discoverable via the capability doc (ORE's intended discovery unit). Cons, which sank it for now: the value always returns in the `rank` field (not self-describing); **`hops` is not rank-shaped** — ORE defines `rank` as "higher = better" and `/rank/pubkeys` sorts descending, which `hops` (lower=better, `999`=unreachable) violates; and N metrics = N round-trips. Revisit if discoverability of the full set becomes a requirement.

### Option C — keep raw counts, document the difference
Rejected: leaves our two exports inconsistent under the same names (ORE `followers`=raw vs kind-30382 `followers`=verified).

## Consequences
- ORE now mirrors the kind-30382 metric set (`rank`/`followers`/`hops` align name-and-value) — cross-export consistency.
- `hops` is a non-standard ORE field → invisible to generic clients (accepted; to be documented via `learn_more`).
- Slightly looser than ORE-02's literal `followers` meaning (verified ⊂ "following") — a conscious WoT-provider choice.
- Confined to the ORE adapter layer; `/api/get-profile-scores` + the UI unaffected.
- **Firmware reinstall?** No.

## Implementation notes
- `src/api/open-ranking/capabilities.js` — ids/names/descriptions (both endpoints).
- `src/api/open-ranking/stats.js` `mapScoresToOre` — verified inbound, `hops` (999 sentinel via `Number.isFinite`), exact outbound. **No change to `fetchProfileScores`/`queryProfileScores`.**
- Tests: stats `B2` (verified+hops), `B13` (hops sentinel), `C2` (ids), id refs renamed; search `C2`/`B9` renamed — 21 + 18 green.
- BIBLE §28 updated.

## Out of scope
- The metric-as-algorithm model (Option B) — future, if discoverability of the metric list is demanded.
- A public `learn_more` docs page (the client-facing field documentation).
- Personalized search (Story 3, W13); ORE-A auth; the other ORE endpoints.
