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

**Option A**, with a **Revision (2026-06-17, operator-steering)**: make the read-union **opt-in and default-OFF**, configured per-operator via an **admin UI**.

Introduce `federatedScan(filter)` = local `strfryScan` ∪ federation-relay fetch, replaceable-deduped, graceful on remote failure; swap it in at the tag-visibility scan sites only.

**Why opt-in (supersedes the original "always-on, no new setting"):** federation strategy is an *operator* decision in the final product (this software is run by anyone; some hoard via the strfry-router, some read-union live), and the dev-env relay topology (`dcosl`) must not be baked into structural code. You cannot "always-on" against nothing — always-on means shipping a *default* relay list, and pre-pointing every deployment's default at our dev relay (`dcosl`) is exactly the dev-topology bake-in we're avoiding. Default-empty is the only honest default for a run-by-anyone product.

Relay content can also be junk — junk pollution is real and trivial: this dev box's local strfry currently holds ~138 `birb-test-…` events under `TAG_Z_TAG` (artifacts of automated test runs on this machine, already in the local 1590 baseline). That makes "federate only relays you trust" the correct posture and reinforces opt-in. **Correction (2026-06-17):** an earlier draft of this ADR cited "always-on read-union dumps ~1572 `birb-test` junk events from `dcosl`" as the *decisive* reason. That was a misattribution — verified live, `dcosl` is **clean** (2 events under `TAG_Z_TAG`, 0 birb; opting in adds 1 after dedupe, 1590→1591). The ~1572 figure was a *local* count mistaken for dcosl federation. dcosl never dumped junk; the birb junk is local. The opt-in decision stands on the operator-choice / don't-bake-topology rationale above, not on any dcosl-pollution scare. So:
- A dedicated, **default-empty** relay list `aRelays.aTagFederationRelays`. Empty ⇒ `dlistFetch` short-circuits to `[]` ⇒ no remote query at all ⇒ behavior **identical to today's local-only** for everyone who hasn't opted in.
- An **admin UI** (a relay-group on the Relay Settings page) lets the operator list the trusted relays to federate over. Our environments opt in explicitly, against a clean relay; arbitrary operators get local-only until they choose otherwise. The strfry-router remains the other (hoard) lever — operators pick.

## Consequences

- Canonical-z tags surface on every instance's `/tags` index and profile chips, reading the shared set without hoarding it locally. **Goal A met** (pending the ops content-federation step — see below).
- **This is purely additive with Half 2.** When the dual-z writer + b-tag map land, `federatedScan` and the read-union are unchanged; local-z events simply also appear in local strfry. No rework.
- Adds one DList round-trip per federated tag read (bounded, graceful). Revisit caching on measurement.
- **Content prerequisite (ops, not this code):** the existing tags.brainstorm.world tag content must reach the DList relay via router federation for the read-union to surface it. The code is testable against whatever is on the DList relay + local; the end-to-end "staging shows tags.bw's 35 tags" depends on that router step. Documented in the story (Open Q2) and epic.
- **Firmware reinstall?** No. No concept/schema/wire change.

## Implementation notes

- **`src/config/defaults.json`**: add `aRelays.aTagFederationRelays: []` (default-empty — federation off).
- **`ui/src/pages/settings/RelaySettings.jsx`**: add an `aTagFederationRelays` entry to `RELAY_GROUPS` — the existing generic `RelayGroup` editor renders the add/remove/save card (saves via `onSave({ aRelays: { aTagFederationRelays: urls } })` → `PUT /api/settings`, owner/admin). One-line admin UI.
- **`src/api/profile-tags/index.js`**:
  - `getTagFederationRelays()` — reads `getSettings().aRelays?.aTagFederationRelays`, returns `[]` on absence (opt-in default).
  - `dlistFetch(filter, opts)` — SimplePool fetch (reuse `fetchEvents.js` `NOSTR_TOOLS_PATH`/`querySync`) against `opts.relays ?? getTagFederationRelays()`; **`if (relays.length === 0) return []`** (opt-in short-circuit — no remote query when unconfigured); bounded timeout (~5s); `catch → []`.
  - `federatedScan(filter, opts)` — `Promise.all([localScan(filter), <remote wrapped in .catch(()=>[]) >])`; concat; `dedupeReplaceable`. Injectable `localScan`/`remoteScan` for tests. Local failure rejects (don't mask a broken local scan); remote failure swallowed.
  - Swap `strfryScan → federatedScan` at the **visibility** scan sites only: the tag-element scan in `findTagsByNameSubstring` (`#z:[TAG_Z_TAG]`, ~line 293), the available-tags scan, the index/aggregation assertion scan(s), and the `tags-for-profile` scans (the `#z`/`#p`-keyed tag-element + assertion reads feeding those handlers). **Leave** id-keyed (`ids:[…]`), pin (`tag-pinning` z), TL (`kind:30392`), export, and owner scans on local `strfryScan`.
- **Dedupe contract:** `federatedScan` must apply the same replaceable-dedupe the module already uses, so a replaceable present in both sources counts once (latest `created_at`). POV aggregation consumes the deduped list unchanged.
- **No change** to: the meili search proxy / `computeTagMatches` (search gate untouched — AC-7), the writer, firmware, the manifest, any concept definition.

## Out of scope

- The router federation config that puts tag content on the DList relay (ops prerequisite).
- Half 2: dual-z writer, b-tag primitive, `headerATag` seeds (`docs/B_TAG_HALF_2_HANDOFF.md`).
- Caching of DList reads (revisit on measurement).
- Federating the search-tag-match path (gated off; not a visibility surface). **Ratified principle (2026-06-17): search is always local-only — for tags and everything else.** Meili is a local index; it can only rank what's been indexed into local strfry. Read-union is a live-visibility lever and structurally cannot feed a ranked index. An operator who wants federated tags to be *searchable* must hoard the events into local strfry via the router (the normal pipeline then indexes them). We do **not** federate the search path and add **no** "Meili federation" setting — the two existing levers (`aTagFederationRelays` for live visibility × the router for searchable/indexed content) cover it. **Enforced (2026-06-17):** `findTagsByNameSubstring` — whose only callers are the search path (`computeTagMatches` / `/api/profile-tags/match` and the meili search proxy) — was reverted from `federatedScan` to local `strfryScan`, so the entire search/match path is local and symmetric (both the tag-name lookup and the assertion lookup are local). This removes the earlier name/assertion asymmetry **before** an operator flips `search.resultTypes.tags=true`: with this fix, turning tag-search on never puts a live remote round-trip on the hot search path and never surfaces federated-only tags with local-only/absent targets. The browse/visibility surfaces (`handleAvailableTags`, `aggregateProfilesTagged`, `handleTagsForProfile`, `handleWotTags`) keep federating via `federatedScan`. Test: `SEARCH-IS-LOCAL` in `test/tag-read-union.test.js`.
