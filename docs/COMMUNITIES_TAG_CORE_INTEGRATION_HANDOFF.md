# Handoff: Communities ↔ nostr-user-tag core integration contract

**Status:** 🟡 LIVE ON STAGING (PR #246 merged + firmware installed 2026-06-05) — **not yet wired into the app**. Build sheet for the live membership wiring (Stories 45 + live 43/44 + 47). Topology decided in ADR 0031 (Option A / dual-publish, house PoV, consume via `VITE_PROFILE_API_BASE`→staging).

**Staging smoke (2026-06-05, verified):** ✅ concepts `tag`/`nostr-user-tag`/`tag-pinning` registered; ✅ `GET /api/profile-tags/available-tags` → `{success:true,tags:[],count:0}`; ✅ `GET /api/profile-tags/index` → `{success:true,povSuffix:"a1420e44",minRank:null,…,rows:[]}`; ✅ `GET /api/profile-tags/profiles-tagged` → 400 "tagEventId is required". ⚠️ **`minRank: null`** → staging's house PoV has a delegated pubkey but no `filters.rank.min`, so the WoT gate currently **bypasses (all assertions count, no trust filter)**. Documented degradation; ops must set `grapevine.searchPreferences.filters.rank.min` for real gating. Not a code blocker.
**Date:** 2026-06-05 (rev. PM — Vinney's Claude confirmed/corrected the contract)
**Source:** Vinney's `chore/carve-nostr-user-tag-core` branch (off `staging`) + its `VERIFY_TAG_CORE.md`. Confirmed against `src/api/profile-tags/index.js`, `src/api/_shared/pov.js`, `src/api/trustedList/refreshPinnedTags.js`. No local Docker bring-up was run (static verify, by decision).
**Related:** ADR 0030 (membership), ADR-0022 (Vinney's hybrid `e`+`a` wire shape), ADR-0015 (legacy z-tag pubkey).

## What the carve provides (read + score only)
- `src/api/profile-tags/index.js` — read/score engine. **Read-only. No publisher, no UI, no writer.**
- `src/api/_shared/pov.js` — `resolvePov({wotPov, userPubkey}) → {delegatedPubkey, povSuffix, minRank, ...}`.
- Firmware concepts `tag` / `nostr-user-tag` / `tag-pinning` (require `POST /api/firmware/install` after deploy or reads return empty).

## Wire shapes (fixed legacy z-pubkey per ADR-0015)
```
LEGACY_Z_TAG_PUBKEY = 82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833
```
| Event | kind | z (#z) | key tags | content |
|---|---|---|---|---|
| **tag-element** | 39999 | `39998:<LEG>:tag` | `d = <slug>` (bare slug) | `{"tag":{"slug","name","description"}}` |
| **assertion** | 39999 | `39998:<LEG>:nostr-user-tag` | `p=<target>`, `e=<tagElementId>`, **`a=39999:<founder>:<slug>`** (emit from day one), `polarity=1\|-1`, `d=profile-tag-<slug>-<target8>-<asserter8>` | `{"nostrUserTag":{"taggedPubkey","tagEventId"}}` |
| tag-pin | 39999 | `39998:<LEG>:tag-pinning` | (out of scope for membership) | |

- The `39998:<LEG>:nostr-user-tag` is the **type header** (`z`), identical for every assertion. It is **not** what a community claims — confirms ADR 0030's PM correction.
- A **tag-element's addressable coord** = `39999:<authorPubkey>:<slug>` — **bare slug, NO `tag-` prefix** (Vinney's correction; elements use `['d', slug]`). This is what a community's `claims` field holds, and our builder default `39999:<founder>:<slug>` is already correct.
- The **assertion `d`-tag's** 4th segment is the **signer's pubkey first-8** (`<asserter8>`), not a literal `x`. It's opaque to reads (dedupe is by `(author, d-tag)`; `p`/`e`/`polarity` come from tags), but emit `<asserter8>` for uniform data.
- **Emit `a` in our assertion writer from day one** → our circle assertions are born hybrid → **Communities needs ZERO backfill** when the server's `#a` read generalization lands.

## The roster primitive we consume
```
GET /api/profile-tags/profiles-tagged?tagEventId=<64hex>&wotPov=house[&userPubkey=&viewerPubkey=&sort=applied|disputed|divisive]
→ { ..., profiles: [ { pubkey, applications, disputes, ... } ] }   (per-target, WoT-gated, server-sorted)
```
`aggregateProfilesTagged()`: scan `#z=NOSTR_USER_TAG_Z_TAG` + `#e=<tagEventId>` → dedupe replaceables → keep asserters with `wot_rank_<povSuffix> ≥ minRank` → bucket polarity → per-target `{applications, disputes}`.

## ⚠️ Three facts that shape our build
1. **Reads scan `#e` (tag-element event id), not `#a`, today.** The `#a` stable-coord consumption + backfill is a *later follow-up* (read path + writer). **Interim:** store `claims` as `a` coords but resolve `a → latest tag-element event id` before calling `profiles-tagged?tagEventId=`. Swap to `#a` when the follow-up lands.
2. **The carve is read-only → the assertion WRITER is ours.** Story 43 builds the kind-39999 assertion event (shape above) in the app and publishes to the relay. Unblocked by spec, not delivered by the carve. Mirror our existing `events/declaration.js` builder discipline; **no hand-rolled crypto** (Applesauce/nostr-tools signing per crypto policy).
3. **Membership model = trusted COUNT + two-part gate (corrected).** The server gates asserters binary at `minRank` then COUNTS (`applications += 1`) — it does **not** sum `wot_rank` (valence-naive by design). The membership rule is **`applyDisputesFunction`** (`src/api/trustedList/refreshPinnedTags.js:102`): **`applications ≥ cutoff AND applications > disputes`** — a two-part gate, **NOT** net-difference (`apps=5,disputes=4,cutoff=2` → member here; `apps−disputes≥2` would reject). Our `lib/membership.js#deriveRoster` was **realigned 2026-06-05 PM** to mirror this exactly (count, binary WoT gate, two-part membership) — it is now a faithful offline oracle. Mapping: our `cutoff` = server `minRank` (WoT gate); our `threshold` = server `cutoff` (min applications). ⚠️ **The community's `influence_cutoff` CD field has no consumer in the carve** — the WoT gate's `minRank` comes from `resolvePov` (house/user prefs), not from the community. Treat `influence_cutoff` as forward-compat/inert in v1 (it activates only if the endpoint later accepts a per-call `minRank` override); `membership_threshold` IS honored (we apply it on the returned counts).

## Degradation note
With no house PoV / no `wot_rank_<suffix>` Meili columns provisioned, the asserter gate is **bypassed (all assertions count)** — graceful degradation, fine for a functional smoke but not real trust-gating. v1 uses the house PoV (always indexed); arbitrary-viewer PoV needs WoT provisioning first.

## When the carve hits staging — wiring checklist
- [ ] `getRoster(circle, {wotPov:'house'})`: for each claimed `a` coord → resolve to latest tag-element event id (`{kinds:[39999], authors:[founder], '#d':[slug]}` → newest) → `GET profiles-tagged?tagEventId=…&wotPov=house` → apply the two-part gate (`applications ≥ threshold AND applications > disputes`) per target → `{members, applicants}`. (`deriveRoster` already encodes this gate for offline/oracle use.)
- [ ] Story 43 writer: publish tag-element (bare-slug `d`, `z=39998:<LEG>:tag`) when claiming own + the assertion (`p`, `e`, **`a` from day one**, `polarity`, `d=profile-tag-<slug>-<target8>-<asserter8>`). Self-apply = applicant; vouch = apply on another's target. No hand-rolled crypto.
- [ ] Default-claim coord stays `39999:<founder>:<slug>` (bare slug — confirmed, no change).
- [ ] Story 45 display reads the same roster; Story 47 swaps the posting gate to membership.
- [ ] Migrate `tagEventId`/`#e` calls to pass `#a` coords directly when the server's `#a` read generalization lands — **no event backfill needed** (we emit `a` from day one).
