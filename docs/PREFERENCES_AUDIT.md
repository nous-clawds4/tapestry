# Preferences Audit

> **Audience:** Tapestry maintainers planning a consolidation of how preferences are stored and resolved.
>
> **Purpose:** Inventory every preference-shaped value in the codebase as of the date below, name the patterns of fragmentation we observed, and propose a sequencing for cleanup. **This document does not propose a new architecture** — it surveys current state so the architecture decision can be made with a complete picture.
>
> **Companion docs:** [BIBLE.md](../BIBLE.md) §11 / §13 / §14 for the conceptual model; [CONFIGURATION.md](./CONFIGURATION.md) for the operator-facing how-to. (Note: `CONFIGURATION.md` currently references `src/concept-graph/parameters/defaults.json`, which doesn't exist — the live path is `src/config/defaults.json`. Out of scope for this audit; flagged for a follow-up cleanup.)

**Last updated:** 2026-05-03

---

## Table of Contents

1. [TL;DR](#1-tldr)
2. [The Five Preference Planes](#2-the-five-preference-planes)
3. [Detailed Inventory](#3-detailed-inventory)
   1. [Plane A — Two-layer settings (the canonical pref system)](#31-plane-a--two-layer-settings)
   2. [Plane B — Per-user preferences](#32-plane-b--per-user-preferences)
   3. [Plane C — Customer-side `.conf` files](#33-plane-c--customer-side-conf-files)
   4. [Plane D — Browser localStorage](#34-plane-d--browser-localstorage)
   5. [Plane E — Hardcoded inline](#35-plane-e--hardcoded-inline)
4. [Fragmentation Patterns](#4-fragmentation-patterns)
5. [Other Smells](#5-other-smells)
6. [Recommended Sequencing](#6-recommended-sequencing)
7. [Open Question](#7-open-question)

---

## 1. TL;DR

The verification-threshold problem (`influence > 0.1` vs `0.05` vs `0.01` scattered across ~25 sites) is one of **five recurring fragmentation patterns**, not a one-off. Five distinct preference systems coexist in the codebase, and the same conceptual value frequently appears in multiple of them with different magnitudes.

Most production-affecting issues:

- **Owner-side and customer-side run different math** for the same conceptual count. `verifiedFollowerCount` is `influence > 0.1` for the owner pipeline and `influence > 0.01` (configurable) for the customer pipeline. Same name, different number.
- **`OWNER_PUBKEY` is hardcoded into the React UI** at [`ui/src/config/pubkeys.js:4`](../ui/src/config/pubkeys.js). Imported by `TrustContext`, `Neo4jOverview`, `lists/Index`. Any non-NosFabrica deployment is broken until this is fixed. (The TA pubkey was already moved to dynamic fetch via `ConfigContext`; the owner pubkey wasn't.)
- **A new customer's GrapeRank parameters silently diverge from owner's tweaks.** When `personalizedGrapeRank.sh` seeds a customer's `graperank.conf`, it copies the customer template — never `/etc/graperank.conf`. Owner-set RIGOR / ATTENUATION_FACTOR / etc. don't propagate.

The next architectural decision (e.g., concept-graph migration, settings consolidation, or anything else) should not be made until at least the worst of these are resolved — otherwise the migration starts with broken assumptions baked in.

---

## 2. The Five Preference Planes

| Plane | Where | Examples |
|---|---|---|
| **A. Two-layer settings** (canonical) | [`src/config/defaults.json`](../src/config/defaults.json) + `/var/lib/brainstorm/settings.json` | `aRelays`, `adminPubkeys`, `grapevine.searchPreferences`, `nip05` |
| **B. Per-user JSON files** | `/var/lib/brainstorm/user-prefs/<pubkey>.json` via `/api/user-prefs` | `pov`, `rankAuthor`, `rankRelay`, `filters`, `sortConfig`, `selectedMetrics` |
| **C. Customer-side `.conf` files** (parallel to owner's `/etc/*.conf`) | `customers/<name>/preferences/{graperank,whitelist,blacklist}.conf` + `observer.json` | `RIGOR`, `ATTENUATION_FACTOR`, `INFLUENCE_CUTOFF`, three preset profiles each |
| **D. Browser localStorage** | `bs_pov_<pubkey>`, `tapestry_trust_method` | Per-user, neither round-trips reliably to the server |
| **E. Hardcoded inline** | Cypher strings, shell heredocs, JSX consts | The 0.05 / 0.1 / 0.01 cutoffs; relay arrays; `OWNER_PUBKEY` |

Each plane has its own access pattern, its own write story, its own consistency model. None of them know about the others.

---

## 3. Detailed Inventory

### 3.1 Plane A — Two-layer settings

Owner-only. Read via `getSettings()` ([`src/config/settings.js`](../src/config/settings.js)). Write via `PUT /api/settings`. `defaults.json` ships with code; `settings.json` overrides on the persistent volume; arrays are replaced, objects deep-merged.

| Key | Storage | Read consumers | Write |
|---|---|---|---|
| `aRelays.{aPopularGeneralPurposeRelays, aDListRelays, aTrustedAssertionRelays, aTrustedListRelays, aWotRelays, aProfileRelays, aOutboxRelays, safeModeRelays}` | [`defaults.json:5-37`](../src/config/defaults.json) + settings.json | server-side `getSettings()` consumers | `PUT /api/settings` ([`settingsApi.js:90-123`](../src/api/settings/settingsApi.js)) |
| `adminPubkeys` | `defaults.json:2` (empty default) + settings.json | `getAdminPubkeys()` in [`src/utils/config.js:94-107`](../src/utils/config.js) | `PUT /api/settings` |
| `neo4jCypherQueryUrl` | `defaults.json:3` | **No readers found in `src/`** — appears dead. | `PUT /api/settings` (changes nothing) |
| `trustScoreCutoff` | `defaults.json:4` (value `10`) | **No readers found in `src/`** — appears dead. UI exposes for editing at [`SystemSettings.jsx:12-17`](../ui/src/pages/settings/SystemSettings.jsx). | `PUT /api/settings` (changes nothing) |
| `grapevine.searchPreferences.{povPubkey, metrics, delegatedPubkey, nip85Relay, filters, sort}` | `defaults.json:38-45` + settings.json | Meili proxy [`src/api/search/profiles/meili/index.js:124-157`](../src/api/search/profiles/meili/index.js); NIP-50 proxy [`nip50-proxy/src/settings.js:86-110`](../nip50-proxy/src/settings.js) | `PUT /api/grapevine/preferences` (owner/admin-only) |
| `nip05.{names, relays}` | `defaults.json:46-49` + settings.json | `getSettings()` for `/.well-known/nostr.json` | `PUT /api/settings` (validated) |

**Smells:** `trustScoreCutoff` is an orphan (UI lets you edit a value nothing reads). `neo4jCypherQueryUrl` is also an orphan.

### 3.2 Plane B — Per-user preferences

Stored as one JSON file per signed-in user at `/var/lib/brainstorm/user-prefs/<pubkey>.json`. Read/write via `GET /api/user-prefs` and `PUT /api/user-prefs` ([`src/api/settings/userPrefsApi.js`](../src/api/settings/userPrefsApi.js)).

| Field | Type | Consumed by | Notes |
|---|---|---|---|
| `pov` | `'user'` \| `'nosfabrica'` | UI restoration; backend POV resolution | Mirrored to `localStorage["bs_pov_<pubkey>"]` ([`BrainstormSearch.jsx:122-158`](../ui/src/pages/BrainstormSearch.jsx)) |
| `rankAuthor` | hex pubkey | Meili proxy POV resolution ([`meili/index.js:140-146`](../src/api/search/profiles/meili/index.js)) | Determines `povSuffix` |
| `rankRelay` | wss URL | Negentropy sync of TAs | |
| `filters` | `{<metric>: {enabled, cutoff}}` | Meili proxy ([`meili/index.js:144,168`](../src/api/search/profiles/meili/index.js)) | |
| `sortConfig` | `{metric, direction}` | Meili proxy ([`meili/index.js:145,187`](../src/api/search/profiles/meili/index.js)) | Three valid intents per [BIBLE.md §14](../BIBLE.md#14-configuration) |
| `selectedMetrics` | `string[]` | UI only | |

**Other per-user storage that doesn't go through `/api/user-prefs`:**

- `localStorage["tapestry_trust_method"]` = `{povPubkey, scoringMethod, trustedListId}` — managed entirely client-side by [`TrustContext.jsx:19-39`](../ui/src/context/TrustContext.jsx), never round-trips. Conceptually overlaps with `rankAuthor` and `pov` from `/api/user-prefs` but is a separate plane on a separate page (Tapestry Dashboard vs. Brainstorm Search).

### 3.3 Plane C — Customer-side `.conf` files

Bash-source format. One template at `customers/default/preferences/<file>.conf`, copied to `customers/<name>/preferences/<file>.conf` when a new customer is provisioned. Owner has its own files at `/etc/{graperank,whitelist,blacklist}.conf` — **a parallel set, not a template-of relationship.** See [§4 Pattern B](#4-fragmentation-patterns).

#### 3.3.1 `graperank.conf`

| Key | Customer template line | Default | Read | Write |
|---|---|---|---|---|
| `RIGOR` | 75 | `0.5` | `execSync('source ... && echo $RIGOR,...')` in [`calculateGrapeRank.js:69`](../src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js) (customer) and [`calculateGrapeRank.js:54`](../src/algos/personalizedGrapeRank/calculateGrapeRank.js) (owner) | manual file edit; legacy `whitelist-control-panel.html` |
| `ATTENUATION_FACTOR` | 76 | `0.85` | same | same |
| `FOLLOW_RATING`, `FOLLOW_CONFIDENCE`, `MUTE_RATING`, `MUTE_CONFIDENCE`, `REPORT_RATING`, `REPORT_CONFIDENCE`, `FOLLOW_CONFIDENCE_OF_OBSERVER` | 77-83 | various | [`interpretRatings.js:39`](../src/algos/customers/personalizedGrapeRank/interpretRatings.js) (customer); [`personalizedGrapeRank/initializeRatings.js:32`](../src/algos/personalizedGrapeRank/initializeRatings.js) (owner) | manual |
| `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`, `VERIFIED_MUTERS_INFLUENCE_CUTOFF`, `VERIFIED_REPORTERS_INFLUENCE_CUTOFF` | 84-86 | `0.01` | [`customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh:30-35`](../src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh) (sources customer conf, fallback `0.01`) | manual |
| Three presets: `_permissive`, `_default`, `_restrictive` | 28-70 | — | listed in `PARAMETER_LIST` / `PRESET_LIST` (lines 25-26) | manual |
| `WHEN_LAST_CALCULATED`, `WHEN_IMPORTED_LAST_CALCULATED` | 88-92 | `0` | timestamp marker | written by algo |

#### 3.3.2 `whitelist.conf`

Customer template at `customers/default/preferences/whitelist.conf`; owner at `/etc/whitelist.conf` (sourced by [`exportWhitelist.sh:6`](../src/algos/exportWhitelist.sh)). Surfaced in [`src/api/export/whitelist/queries/config.js`](../src/api/export/whitelist/queries/config.js) (reads `/etc/whitelist.conf` directly).

| Key | Line | Default | Notes |
|---|---|---|---|
| `INFLUENCE_CUTOFF` | 42 | `0.6` | Used by `exportWhitelist.sh:54-56` and `calculateVerifiedFollowerCounts.sh` (customer) |
| `COMBINATION_LOGIC` | 43 | `OR` | `AND` or `OR` |
| `HOPS_CUTOFF` | 44 | `1` | |
| `INCORPORATE_BLACKLIST` | 45 | `true` | Boolean |
| Presets `_permissive` / `_default` / `_restrictive` | 22-37 | — | Mirrors graperank preset structure |

#### 3.3.3 `blacklist.conf`

Customer template `customers/default/preferences/blacklist.conf`; owner at `/etc/blacklist.conf`. Surfaced in [`src/api/export/blacklist/queries/config.js`](../src/api/export/blacklist/queries/config.js). UI at legacy [`public/pages/blacklist-control-panel.html`](../public/pages/blacklist-control-panel.html).

| Key | Line | Default |
|---|---|---|
| `WEIGHT_FOLLOWED`, `WEIGHT_MUTED`, `WEIGHT_REPORTED` | 46-48 | `1` / `1` / `1` |
| `BLACKLIST_ABSOLUTE_CUTOFF` | 49 | `3` |
| `BLACKLIST_RELATIVE_CUTOFF` | 50 | `20` |
| Three presets | 22-41 | — |

#### 3.3.4 `observer.json`

`customers/default/preferences/observer.json`. Per-customer JSON (not bash-source). Read/written via [`src/utils/customerManager.js`](../src/utils/customerManager.js).

Pref-shaped fields: `subscription.update_interval` (default `604800` s = 1 week).

### 3.4 Plane D — Browser localStorage

| Key | Owner | Round-trip? | Notes |
|---|---|---|---|
| `bs_pov_<pubkey>` | [`BrainstormSearch.jsx:122-158`](../ui/src/pages/BrainstormSearch.jsx) | Yes — also written to server via `PUT /api/user-prefs` | Cache layer over Plane B `pov` |
| `tapestry_trust_method` | [`TrustContext.jsx:19-39`](../ui/src/context/TrustContext.jsx) | **No.** Pure client-side state. | Conceptually overlaps Plane B but never syncs |

### 3.5 Plane E — Hardcoded inline

Values that are conceptually preferences but live as literals in code. The most painful entries:

#### Verification threshold (the smoking gun)

Same conceptual cutoff for "GrapeRank-verified user," **three magnitudes, ~25 sites, no central definition.** See [§4 Pattern A](#4-fragmentation-patterns) for the full breakdown.

#### Owner pubkey hardcoded in UI

[`ui/src/config/pubkeys.js:4`](../ui/src/config/pubkeys.js) — literal string `'15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270'` exported as `OWNER_PUBKEY`. Imported by:

- [`TrustContext.jsx:2,14,81,87`](../ui/src/context/TrustContext.jsx) — defaults `povPubkey: OWNER_PUBKEY` for every install
- `Neo4jOverview.jsx:4`
- `lists/Index.jsx:8`

The TA pubkey was already migrated to dynamic fetch via `GET /api/assistant/pubkey` and `ConfigContext`. The owner pubkey wasn't.

#### Relay lists hardcoded in UI

External-relay arrays for client-side lookups appear as literals in three UI files, ignoring the canonical `aRelays.aPopularGeneralPurposeRelays` from settings:

- [`ui/src/pages/BrainstormSearch.jsx:82`](../ui/src/pages/BrainstormSearch.jsx) — `['wss://relay.primal.net', 'wss://relay.damus.io', 'wss://nos.lol']`
- [`ui/src/pages/BrainstormSettings.jsx:7`](../ui/src/pages/BrainstormSettings.jsx) — same three
- [`ui/src/pages/grapevine/SearchPreferences.jsx:15-20`](../ui/src/pages/grapevine/SearchPreferences.jsx) — `RELAY_SEARCH_LIST`, four-relay variant adding `purplepag.es`

#### Hardcoded WoT / scoring tunables

| Name | Site | Value |
|---|---|---|
| Hops sentinel ("unreachable") | [`networkStatus.js:123`](../src/api/network/networkStatus.js); [`addSetsOfMetricsCards.sh:24`](../src/cns/addSetsOfMetricsCards.sh); nip85 publish queries | `n.hops < 100` |
| BFS max hops | [`calculateHopsFrontier.sh:22`](../src/algos/calculateHopsFrontier.sh); [`calculateHops.sh:22,147`](../src/algos/calculateHops.sh) | `12` |
| GrapeRank max iterations / convergence | [`personalizedGrapeRank/calculateGrapeRank.js:39-40`](../src/algos/personalizedGrapeRank/calculateGrapeRank.js); same in [`customers/personalizedGrapeRank/calculateGrapeRank.js:54-55`](../src/algos/customers/personalizedGrapeRank/calculateGrapeRank.js) | `MAX_ITERATIONS = 60`, `CONVERGENCE_THRESHOLD = 0.001` |
| Warm-start owner reachability | [`customers/personalizedGrapeRank/initializeScorecards.js:33`](../src/algos/customers/personalizedGrapeRank/initializeScorecards.js) | `OWNER_SEED_MAX_HOPS = 3` |
| PageRank damping factor | [`calculatePersonalizedPageRank.sh:49`](../src/algos/calculatePersonalizedPageRank.sh); [`personalizedPageRankForApi.sh:39`](../src/algos/personalizedPageRankForApi.sh); [`customers/personalizedPageRank.sh:63`](../src/algos/customers/personalizedPageRank.sh) and ~6 more sites | `dampingFactor: 0.85` |
| Whitelist seed PageRank floor | [`exportWhitelist.sh:45`](../src/algos/exportWhitelist.sh) | `n.personalizedPageRank > 0.000001` |
| Whitelist precompute TTL | [`whitelistPrecompute.js:12`](../src/api/search/profiles/whitelistPrecompute.js) | `PRECOMPUTE_TTL_MS = 10*60*1000` |
| NIP-85 publish row limit | [`nip85/publish_kind30382.js:22`](../src/algos/nip85/publish_kind30382.js); [`customers/nip85/publish_kind30382.js:28`](../src/algos/customers/nip85/publish_kind30382.js) | `getConfigFromFile('BRAINSTORM_30382_LIMIT', '250000')` — env-baked at build, [`docker/entrypoint.sh:72`](../docker/entrypoint.sh) |
| Settings cache TTL (NIP-50 proxy only) | [`nip50-proxy/src/settings.js:70`](../nip50-proxy/src/settings.js) | `CACHE_TTL_MS = 30_000` (main API has no cache) |

#### Operational env vars that look pref-like

- `nostr-search` env: `MEILI_URL`, `RELAY_URL`, `TAPESTRY_URL`, `PORT`, `SYNC_ON_START`, `REINGEST_INTERVAL_HOURS`
- `nip50-proxy` env: `NIP50_PORT`, `NIP50_HOST`, `STRFRY_URL`, `SEARCH_API_URL`, `BRAINSTORM_API`, `MEILI_INDEX`

These configure separate Docker services and don't go through `settings.json`. They're a third configuration plane (env vars) that's mostly disjoint from the others.

---

## 4. Fragmentation Patterns

The audit surfaced five recurring patterns. Each pattern repeats across multiple preferences; each is worth naming so the cleanup discussion can address the *pattern* rather than each instance.

### Pattern A — Same conceptual value, divergent magnitudes

The textbook example. The "is this user verified?" cutoff appears at three magnitudes across ~25 call sites with no central definition.

**0.01** (customer-side default + several read paths):

- [`customers/default/preferences/graperank.conf:84-86`](../customers/default/preferences/graperank.conf) — customer default
- [`src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh:34,68,76,85`](../src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh) (and `…ReporterCounts.sh:34`, `…MuterCounts.sh:34`) — sourced from customer conf, hardcoded fallback `0.01`
- [`src/algos/customers/calculateVerifiedFollowerCounts.sh:41`](../src/algos/customers/calculateVerifiedFollowerCounts.sh) (and Reporter / Muter counterparts) — *non-configurable* hardcoded `> 0.01`
- [`src/algos/customers/nip85/publish_kind30382.js:53`](../src/algos/customers/nip85/publish_kind30382.js); `publish_kind30382_backup_nsecFromConfig.js:101` — `u.influence > 0.01 OR u.muterInput > 0.1 OR u.reporterInput > 0.1`
- [`src/algos/nip85/publish_kind30382.js:49`](../src/algos/nip85/publish_kind30382.js) — owner-side same triple
- [`src/api/search/profiles/whitelistPrecompute.js:41,49`](../src/api/search/profiles/whitelistPrecompute.js) — owner+customer Cypher
- [`src/api/search/profiles/keyword/handler.js:131-132`](../src/api/search/profiles/keyword/handler.js); `handler-works-but-slow.js:160-161`
- [`src/api/export/whitelist/queries/getWhitelist.js:8,59,67`](../src/api/export/whitelist/queries/getWhitelist.js)

**0.05** (UI / display side):

- [`src/api/grapevineInteractions/queries/cypherQueries.js:18,22,39,43,70,74,101,105`](../src/api/grapevineInteractions/queries/cypherQueries.js) — eight inline filters; matching descriptions hardcoded `🍇-Rank > 0.05`
- [`src/api/ranking/rankingStatus.js:45,53`](../src/api/ranking/rankingStatus.js) — counts "verified users" with `n.influence >= 0.05`
- `src/api/export/users/queries/userdata_backup.js:78`, `userdata_backup2.js:78`, `userdata_beforeRewrite.js:89,102,115,203,218,233`, `userData_depr.js:94,107` — many copies in stale backup files

**0.1** (owner-side legacy):

- [`src/algos/follows-mutes-reports/calculateVerifiedFollowerCounts.sh:13,22`](../src/algos/follows-mutes-reports/calculateVerifiedFollowerCounts.sh); `calculateVerifiedMuterCounts.sh:13,22`; `calculateVerifiedReporterCounts.sh:13,22` — owner-side, hardcoded
- [`src/algos/reports/calculateReportScores.sh:89`](../src/algos/reports/calculateReportScores.sh) — `WHERE a.influence > 0.1`
- `src/algos/reports/{calculateReportScores-deprecated, calculateVerifiedReportCounts-deprecated}.sh:18,57`

### Pattern B — Owner ↔ customer parallel planes

The same conceptual parameter set exists at two unrelated locations with two unrelated authoring stories:

| Parameter | Owner storage | Customer storage |
|---|---|---|
| `RIGOR`, `ATTENUATION_FACTOR`, GrapeRank ratings/confidences, verified cutoffs | `/etc/graperank.conf` | `customers/<name>/preferences/graperank.conf` |
| `INFLUENCE_CUTOFF`, `COMBINATION_LOGIC`, `HOPS_CUTOFF`, `INCORPORATE_BLACKLIST` | `/etc/whitelist.conf` | `customers/<name>/preferences/whitelist.conf` |
| `WEIGHT_FOLLOWED/MUTED/REPORTED`, blacklist cutoffs | `/etc/blacklist.conf` | `customers/<name>/preferences/blacklist.conf` |

**Why this is fragile:** when [`personalizedGrapeRank.sh:46-57`](../src/algos/personalizedGrapeRank/personalizedGrapeRank.sh) creates a missing customer `graperank.conf`, it copies the **customer template** (`customers/default/preferences/graperank.conf`) — never the owner's `/etc/graperank.conf`. So owner-tweaked GrapeRank parameters silently don't propagate to new customers.

Worse: the owner-side `src/algos/follows-mutes-reports/*.sh` files (the `0.1` cutoff sites in Pattern A) **don't read `/etc/graperank.conf` at all** — they're hardcoded. So even within Pattern B, the owner side has its own internal fragmentation.

### Pattern C — Same data in multiple layers without sync

`pov` (and friends) for a given user lives in three places:

- Server JSON: `/var/lib/brainstorm/user-prefs/<pubkey>.json`
- localStorage: `bs_pov_<pubkey>`
- localStorage: `tapestry_trust_method.povPubkey` ([`TrustContext.jsx`](../ui/src/context/TrustContext.jsx))

The first two are kept in sync by [`BrainstormSearch.jsx:122-158`](../ui/src/pages/BrainstormSearch.jsx) — localStorage acts as cache for the server JSON. The third is wholly disjoint: TrustContext on the Tapestry Dashboard never reads or writes the server JSON. Two clients (BrainstormSearch and TrustContext) restoring "pov" can disagree.

### Pattern D — UI hardcodes what should come from settings

The clearest production-affecting case is `OWNER_PUBKEY` (see [§3.5](#35-plane-e--hardcoded-inline)). Same shape applies to relay lists: three UI files carry hardcoded relay arrays that ignore `settings.aRelays.aPopularGeneralPurposeRelays`.

This pattern is reversible — `ConfigContext` already exists and already serves the TA pubkey. Same plumbing handles owner pubkey and relay lists.

### Pattern E — Owner pipeline ≠ customer pipeline for the same conceptual count

The same database column `verifiedFollowerCount` is computed by two different scripts with two different cutoffs:

- Owner: [`src/algos/follows-mutes-reports/calculateVerifiedFollowerCounts.sh`](../src/algos/follows-mutes-reports/calculateVerifiedFollowerCounts.sh), hardcoded `> 0.1`, writes to `NostrUser.verifiedFollowerCount`
- Customer: [`src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh`](../src/algos/customers/follows-mutes-reports/calculateVerifiedFollowerCounts.sh), reads customer `.conf` (default `0.01`), writes to `NostrUserWotMetricsCard.verifiedFollowerCount`

Same field name; different numbers; no comment in either file warning the reader. This is what made the Following count work on staging look fine while a careful operator would notice the same user has a different verified-follower count from the owner POV vs. their own POV.

---

## 5. Other Smells

Things that aren't preferences per se but are tangled up with the preference picture:

- **Settings-cache divergence between API and NIP-50 proxy.** [`nip50-proxy/src/settings.js`](../nip50-proxy/src/settings.js) reimplements `deepMerge` + `loadSettings` and adds a 30 s in-process cache. The main API ([`src/config/settings.js:76-78`](../src/config/settings.js)) has no cache. After an owner edits `settings.json`, the main API reflects immediately; the NIP-50 proxy lags up to 30 s. Two readers, two implementations of the same logic.
- **`BRAINSTORM_OWNER_PUBKEY` resolution paths.** Read at least four ways across the server: `getConfigFromFile()` in [`src/utils/config.js:18`](../src/utils/config.js); raw `fs.readFileSync('/etc/brainstorm.conf')` in [`src/middleware/auth.js:25,211`](../src/middleware/auth.js) and [`src/utils/customerRelayKeys.js:42`](../src/utils/customerRelayKeys.js); `execSync('source /etc/brainstorm.conf && echo $...')` in [`initializeScorecards.js:39-42`](../src/algos/customers/personalizedGrapeRank/initializeScorecards.js); plus the UI hardcode. Each adds a slightly different fallback chain.
- **Stale backup files.** [`src/api/export/users/queries/`](../src/api/export/users/queries/) contains `userdata_backup.js`, `userdata_backup2.js`, `userdata_beforeRewrite.js`, `userData_depr.js`. Each carries its own copy of the `0.05` cutoff. Future cutoff edits must touch all of them or risk re-introducing fragmentation. Same shape at `customers/personalizedGrapeRank/calculateGrapeRank_*` and `processAllActiveCustomers_{copy,deprecated}.js`.
- **Orphaned defaults.** [`src/concept-graph/deprecated-parameters/defaults.json`](../src/concept-graph/deprecated-parameters/defaults.json) is a near-duplicate of [`src/config/defaults.json`](../src/config/defaults.json) (with `conceptUUIDs` / `relationshipTypeUUIDs` added, `grapevine` and `nip05` missing). Loaded by no module. Sitting in the tree.
- **`docs/CONFIGURATION.md` cites a nonexistent path.** It says defaults live at `src/concept-graph/parameters/defaults.json`. Live path is `src/config/defaults.json`. Likely written before a refactor and never updated.

---

## 6. Recommended Sequencing

The patterns suggest a natural order from most-painful-to-others toward most-painful-to-implement.

### 6.1 Quick wins (low risk, high payoff)

1. **Move `OWNER_PUBKEY` from [`ui/src/config/pubkeys.js`](../ui/src/config/pubkeys.js) to `ConfigContext`.** Mirror what was already done for the TA pubkey: serve via `GET /api/owner/pubkey` (or include in the existing assistant endpoint), fetch on app mount, propagate via context. Removes a real bug for non-NosFabrica forks.
2. **Replace UI relay-list hardcodes with `settings.aRelays`.** Affects three files. Same pattern as #1 — fetch via `ConfigContext` or a small `useRelays()` hook.
3. **Delete dead `defaults.json` keys** (`trustScoreCutoff`, `neo4jCypherQueryUrl`) and remove the [`SystemSettings.jsx`](../ui/src/pages/settings/SystemSettings.jsx) field for `trustScoreCutoff`. After confirming no readers.
4. **Delete the orphan [`src/concept-graph/deprecated-parameters/defaults.json`](../src/concept-graph/deprecated-parameters/defaults.json).**
5. **Fix the path reference in [`docs/CONFIGURATION.md`](./CONFIGURATION.md).**
6. **Delete the `_backup`, `_backup2`, `_beforeRewrite`, `_depr` userdata copies.** They're not in the runtime but make every future cutoff edit a hazard.

Each of #1–#6 is small, isolated, reversible. Could ship as a single `chore/` PR or as a sequence; the audit is the gate to start.

### 6.2 Consolidate the verification threshold

**Status: partially closed.** When digging into the specifics we found the 17 affected sites split into three semantic buckets, not one:

- **Bucket A — verified counts** (6 sites): owner-side `calculate{Follower,Muter,Reporter}Counts.sh` at `0.1`, customer-side at `0.01` (configurable). Writes the `verified*Count` properties on `NostrUser` / `NostrUserWotMetricsCard`.
- **Bucket B — legacy verified-* listings** (4 sites): `src/api/grapevineInteractions/queries/cypherQueries.js` at `0.05`. The verifiedFollowers/etc. lists that the legacy `/legacy/grapevine-analysis.html` page uses.
- **Bucket C — general "include this user" filters** (7 sites): search keyword endpoint, whitelist export, NIP-85 publish. All at `0.01`. Conceptually distinct from the verified-count idea — these answer "is this user real enough to surface" rather than "is this user verified".

Buckets A and B share semantics: a listing OF a count should match the count's threshold. The `0.1`/`0.05` mismatch was the original fragmentation we noticed (a count of 100 verified followers click-through to a list showing 150). **PR (this work) consolidates A + B at `0.05`** by:
- Adding `VERIFIED_{FOLLOWERS,MUTERS,REPORTERS}_INFLUENCE_CUTOFF` to the owner-side `config/graperank.conf.template` (defaulting to `0.05`).
- Making owner-side `calculateVerified*Counts.sh` read these from `/etc/graperank.conf` (with `0.05` fallback if unset).
- Making `cypherQueries.js` read the same params via `getConfigFromFile` (also defaulting to `0.05`).

Bucket C is **deferred** — distinct purpose, may legitimately want different values.

Owner-side and customer-side still maintain their own conf files (`/etc/graperank.conf` vs. `customers/<n>/preferences/graperank.conf`); the §6.3 question of unifying those planes is separate.

Existing `verifiedFollowerCount` properties on Neo4j nodes carry the OLD `0.1`-based values until the next batch run. Operators wanting the new values immediately can manually trigger the relevant scripts.

### 6.3 Decide on owner ↔ customer parallel planes (the big one)

Three options for Pattern B:

- **(a) Make owner-side scripts read from `/etc/*.conf`** — i.e., parameterize the owner pipeline the same way the customer pipeline already is. Smallest change. Doesn't address the template-divergence smell.
- **(b) Collapse `/etc/*.conf` into `settings.json`** and have customer prefs override that. Bigger change, but cleanly unifies Plane A and Plane C. Customer template defaults *become* the owner's settings.
- **(c) Keep the parallel planes but require owner→customer template sync.** Smallest behavioral change but adds operational complexity (a sync script).

**This is the architectural decision.** It determines what comes next.

### 6.4 De-fragment per-user `pov`

After Pattern B is settled, single source of truth for `pov` becomes feasible. Server JSON is the obvious choice; localStorage stays as a cache. `TrustContext` reads from the same data plane as `/api/user-prefs`.

### 6.5 Then — concept-graph migration (or whatever architecture is chosen)

By the time §6.1–§6.4 are done, the remaining preference surface is small, well-understood, and consistent. Whatever architectural move the team decides on (concepts, NIP-78, something else) becomes a clean exercise rather than a forest fire.

---

## 7. Open Question

The core decision the team needs to make before any non-trivial work proceeds is **§6.3 — the owner-vs-customer plane question.** Everything in §6.1 / §6.2 is mechanical cleanup. §6.3 changes the shape of the data model.

A useful framing: *should "the owner" be modeled as "customer #0" with its preferences in the same shape as every other customer, or as a separate first-class concept?* The codebase currently does the latter (separate `/etc/*.conf` files, separate algo scripts, separate database columns). The "TA-authored elements" idea floated in conversation is a version of the former. The two models lead to very different consolidation strategies.

This document does not answer that question. It surveys the cost of the current state so the answer can be reached deliberately.

---

*Maintained alongside [BIBLE.md](../BIBLE.md) and [OPERATIONS.md](../OPERATIONS.md). When the preference architecture changes, update or retire this audit.*
