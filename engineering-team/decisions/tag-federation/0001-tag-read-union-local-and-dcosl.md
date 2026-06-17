# ADR 0001: Tag read-union over local strfry + the shared DList relay

**Status:** Accepted
**Date:** 2026-06-17
**Story:** `engineering-team/stories/tag-federation/1-tags-visible-across-environments.md`
**Epic:** tag-federation (Half 1 — Goal A)

## Context

Tag/tagging events already carry a shared **canonical z** (`39998:82b75e47…:<slug>`, ADR-0015), but each instance's tag read paths scan **only local strfry** (`strfryScan` in `src/api/profile-tags/index.js:69` — `exec('strfry scan <filter>')`). So staging/main show empty tag surfaces even though the network's tags exist on tags.brainstorm.world and on the shared DList relay (`wss://dcosl.brainstorm.world`, configured as `aRelays.aDListRelays`).

This story (Half 1 of the dual-z model) makes the visible tag surfaces read the **union of local strfry + the DList relay**, so canonical-z tags surface on every instance — with no wire-shape/firmware change. Team-decided constraints: read-union (not sync-and-hoard); write-local + router-federate is the content path (ops, out of this code story).

Facts:
- `strfryScan(filter)` has ~17 call sites; only the **`#z`-keyed tag-element and assertion scans** drive visibility (`available-tags`, the `/tags` index/aggregation, `tags-for-profile`, `findTagsByNameSubstring`). Id-keyed lookups and the pin/TL/export/owner scans are local-operational and stay local.
- An external SimplePool fetch path already exists (`src/api/relay/fetchEvents.js`, `handleFetchExternalEvents`) — the pattern to reuse for the DList fetch.
- A replaceable-event dedupe helper already exists in the module (`dedupeReplaceable`).
- The search-tag-match path (`computeTagMatches` → meili proxy) is gated **off** on staging/main (search.resultTypes.tags=false), so it is not a visibility surface here.

## Options considered

### Option A — `federatedScan(filter)` helper, swapped at the visibility read sites (chosen)
A new helper unions `strfryScan(filter)` (local) with a DList-relay fetch (SimplePool against `aRelays.aDListRelays`, bounded timeout, `catch → []`), concatenates, and replaceable-dedupes (by event id, then by `(kind,pubkey,d-tag)` keeping latest `created_at`). Swap `strfryScan → federatedScan` at the tag-visibility scan sites only.

- **Pros:** one contained seam; every visibility path gets federation with one change; graceful degradation falls out of `catch → []` (union becomes local-only, AC-4); dedupe centralized (AC-5); POV/WoT logic downstream is unchanged because it operates on the merged event list exactly as before (AC-6); doesn't touch the meili proxy/search gate (AC-7).
- **Cons:** a DList round-trip on each federated read adds latency + an external dependency on every instance (incl. prod). Mitigated by the bounded timeout + graceful degradation; a short cache is a v1-optional follow-up if measurement warrants.

### Option B — sync DList → local strfry via the strfry-router; reads stay local-only
- **Pros:** zero read-path code; existing local reads "just work".
- **Cons:** the **sync-and-hoard** model the team explicitly decided against ("don't rely forever on every event being local"); it's router/ops config, not the code deliverable this story owns; and it couples correctness to a background sync's freshness. Rejected for this story (the router federation is still needed as the *content* path, but for getting content onto the DList relay, not for reads).

### Option C — per-read federation toggle setting
- **Pros:** operators opt in/out.
- **Cons:** new settings surface for no clear v1 need; the goal is "tags visible on *all* environments," i.e. always-on. Deferred — always-on-with-graceful-degradation is simpler and matches intent.

## Decision

**Option A.** Introduce `federatedScan(filter)` = local `strfryScan` ∪ DList-relay fetch, replaceable-deduped, graceful on DList failure; swap it in at the tag-visibility scan sites only. Always-on against the configured DList relay; no new setting.

## Consequences

- Canonical-z tags surface on every instance's `/tags` index and profile chips, reading the shared set without hoarding it locally. **Goal A met** (pending the ops content-federation step — see below).
- **This is purely additive with Half 2.** When the dual-z writer + b-tag map land, `federatedScan` and the read-union are unchanged; local-z events simply also appear in local strfry. No rework.
- Adds one DList round-trip per federated tag read (bounded, graceful). Revisit caching on measurement.
- **Content prerequisite (ops, not this code):** the existing tags.brainstorm.world tag content must reach the DList relay via router federation for the read-union to surface it. The code is testable against whatever is on the DList relay + local; the end-to-end "staging shows tags.bw's 35 tags" depends on that router step. Documented in the story (Open Q2) and epic.
- **Firmware reinstall?** No. No concept/schema/wire change.

## Implementation notes

- **`src/api/profile-tags/index.js`**:
  - Add `dlistFetch(filter)` — SimplePool fetch (reuse the `fetchEvents.js` pattern / its `NOSTR_TOOLS_PATH`) against `getSettings().aRelays?.aDListRelays || []`; bounded timeout (~5s); `catch → []`; returns parsed events. If no DList relay configured, returns `[]` (degrades to local).
  - Add `federatedScan(filter)` — `const [local, remote] = await Promise.all([strfryScan(filter), dlistFetch(filter)])`; concat; `dedupeReplaceable([...local, ...remote])` (and id-dedupe). Local failure still rejects (don't mask a broken local scan); remote failure is swallowed inside `dlistFetch`.
  - Swap `strfryScan → federatedScan` at the **visibility** scan sites only: the tag-element scan in `findTagsByNameSubstring` (`#z:[TAG_Z_TAG]`, ~line 293), the available-tags scan, the index/aggregation assertion scan(s), and the `tags-for-profile` scans (the `#z`/`#p`-keyed tag-element + assertion reads feeding those handlers). **Leave** id-keyed (`ids:[…]`), pin (`tag-pinning` z), TL (`kind:30392`), export, and owner scans on local `strfryScan`.
- **Dedupe contract:** `federatedScan` must apply the same replaceable-dedupe the module already uses, so a replaceable present in both sources counts once (latest `created_at`). POV aggregation consumes the deduped list unchanged.
- **No change** to: the meili search proxy / `computeTagMatches` (search gate untouched — AC-7), the writer, firmware, the manifest, any concept definition.

## Out of scope

- The router federation config that puts tag content on the DList relay (ops prerequisite).
- Half 2: dual-z writer, b-tag primitive, `headerATag` seeds (`docs/B_TAG_HALF_2_HANDOFF.md`).
- Caching of DList reads (revisit on measurement).
- Federating the search-tag-match path (gated off; not a visibility surface).
