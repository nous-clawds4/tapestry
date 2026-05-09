Brainstorm Community Endorsements DList
=====

This document specifies the Brainstorm Community Endorsements DList — a single, globally-scoped Decentralized List collecting member-issued endorsement and veto signals about pubkey membership in Brainstorm Communities.

This is an application-layer specification built on:

- The [Decentralized Lists base NIP](DECENTRALIZED_LISTS.md) — the underlying list pattern.
- The [Cross-NIP Compatibility companion NIP](DECENTRALIZED_LISTS_COMPAT.md) — for referencing NIP-72 communities by `a` tag.

The Endorsements DList is the *signal layer* of Brainstorm Communities. The *community-record layer* (each user's personal projection of which communities they curate) is a separate primitive specified elsewhere.

## Why a single global DList

Brainstorm Communities determine membership by a convergent algorithm computed independently by any number of mirror relays. For convergence to work across mirrors with different starting points, all mirrors must be able to subscribe to the same global stream of endorsement signals.

A single global Endorsements DList achieves this directly: any mirror computing membership for any community runs one filter and receives every relevant signal across the entire network. No per-curator or per-community DList enumeration is required.

The personal-projection model that defines Brainstorm Communities — every user has their own record of every community — applies at the community-record layer, not here. **Endorsements are global; community-records are personal.** Two layers, two scoping rules.

## Addressing the Endorsements DList

The Endorsements DList is addressable in two equivalent forms, both supported. Items SHOULD z-tag at the canonical-header form where the canonical pubkey is known, and MAY use the human-readable form otherwise.

### Canonical header (preferred)

A kind `39998` list-header event is published by a well-known pubkey:

```json
{
  "kind": 39998,
  "pubkey": "<canonical_pubkey>",
  "tags": [
    ["d", "brainstorm-community-endorsements"],
    ["names", "Brainstorm Community Endorsement", "Brainstorm Community Endorsements"],
    ["description", "Member-issued endorsements and vetoes of pubkey membership in Brainstorm Communities."],
    ["required", "p"],
    ["required", "a"],
    ["recommended", "type"],
    ["recommended", "role"],
    ["allowed", "comments"]
  ]
}
```

The well-known pubkey for the reference deployment is the firmware-publishing pubkey (the tapestry-assistant pubkey for brainstorm.world). Other deployments may publish their own canonical headers, in which case the deployment documents the pubkey and items reference it via the corresponding a-tag form.

Items reference this header via:

```json
["z", "39998:<canonical_pubkey>:brainstorm-community-endorsements"]
```

### Human-readable name (fallback)

The base NIP permits informal list addressing by human-readable name. Items MAY reference the Endorsements DList without a formal header by:

```json
["z", "brainstorm-community-endorsements"]
```

Mirrors querying the list SHOULD subscribe to both forms and merge:

```json
{
  "kinds": [39999],
  "#z": [
    "39998:<canonical_pubkey>:brainstorm-community-endorsements",
    "brainstorm-community-endorsements"
  ]
}
```

## Endorsement items

Each endorsement is a kind `39999` (replaceable) event. Each event addresses exactly one (target, community, role) combination — separate combinations require separate events.

### Tag set

| Tag | Status | Notes |
|---|---|---|
| `d` | required (per NIP-01) | Deterministic; see formula below |
| `z` | required | Points at the Endorsements DList (canonical and/or human-readable form) |
| `p` | required | Target pubkey — the person being endorsed or vetoed |
| `a` | required | Community a-tag (kind `34550` for NIP-72 communities; kind `39999` for native Brainstorm community-records) |
| `type` | recommended | `endorse` (default) or `veto` |
| `role` | recommended | `member` (default) or `moderator`. Other values permitted by convention. |
| `comments` | allowed | Optional textual reason |

The `type` and `role` tags are recommended (not required) because both have sensible defaults. An item with neither is interpreted as `type=endorse, role=member`. Additional role values may be introduced by convention without requiring a header revision.

### Deterministic d-tag

Each endorsement event has a d-tag computed deterministically from its (target, community, role) tuple. This guarantees that any later endorsement event by the same author for the same (target, community, role) replaces the earlier one — "latest wins" semantics over Alice's stance on Bob's membership in Bitcoin Army as a member.

Formula:

```
d = "endorsement/" + sha256(target_pubkey + ":" + community_a_tag + ":" + role).slice(0, 16)
```

Where:

- `target_pubkey` is the lowercase hex value of the `p` tag (no prefix).
- `community_a_tag` is the value of the `a` tag (e.g. `34550:abc...:bitcoin-army`).
- `role` is the value of the `role` tag, or `member` if absent.
- The first 16 hex characters of the SHA-256 hash are appended.

D-tag uniqueness is per-(kind, pubkey), so a 16-character truncation gives ample collision resistance at this scope.

The `type` value is intentionally **not** part of the d-tag. Switching from `endorse` to `veto` (or vice versa) for the same (target, community, role) reuses the same d-tag and replaces the prior event — this is exactly the desired "I changed my mind about Bob" semantics. Changing the `role` value, by contrast, produces a different d-tag and is therefore an additive signal (Alice can endorse Dave as both `member` and `moderator` simultaneously).

## Examples

### Alice endorses Bob as a member of Bitcoin Army (a NIP-72 community)

```json
{
  "kind": 39999,
  "pubkey": "<alice_pubkey>",
  "tags": [
    ["d", "endorsement/<sha256('<bob_pubkey>:34550:<creator>:bitcoin-army:member')[:16]>"],
    ["z", "39998:<canonical_pubkey>:brainstorm-community-endorsements"],
    ["p", "<bob_pubkey>"],
    ["a", "34550:<community_creator_pubkey>:bitcoin-army"],
    ["type", "endorse"],
    ["role", "member"]
  ]
}
```

### Carol vetoes Bob as a member of Bitcoin Army

```json
{
  "kind": 39999,
  "pubkey": "<carol_pubkey>",
  "tags": [
    ["d", "endorsement/<sha256('<bob_pubkey>:34550:<creator>:bitcoin-army:member')[:16]>"],
    ["z", "39998:<canonical_pubkey>:brainstorm-community-endorsements"],
    ["p", "<bob_pubkey>"],
    ["a", "34550:<community_creator_pubkey>:bitcoin-army"],
    ["type", "veto"],
    ["role", "member"],
    ["comments", "Bob is a known impersonator."]
  ]
}
```

Carol's d-tag uses the same formula and produces the same value as Alice's, because the (target, community, role) tuple is identical. D-tags are per-(kind, pubkey), however, so Alice's and Carol's events do not conflict. Each author has at most one live signal per tuple.

### Alice endorses Dave as a moderator of Bitcoin Army

```json
{
  "kind": 39999,
  "pubkey": "<alice_pubkey>",
  "tags": [
    ["d", "endorsement/<sha256('<dave_pubkey>:34550:<creator>:bitcoin-army:moderator')[:16]>"],
    ["z", "39998:<canonical_pubkey>:brainstorm-community-endorsements"],
    ["p", "<dave_pubkey>"],
    ["a", "34550:<community_creator_pubkey>:bitcoin-army"],
    ["type", "endorse"],
    ["role", "moderator"]
  ]
}
```

Independent of any endorsement Alice may have published for Dave as a `member` — different `role`, different d-tag, additive signal.

### Endorsement of a native Brainstorm Community

When the community is a native Brainstorm community-record (kind `39999` ListItem on a curator's `brainstorm-communities` index DList), the `a` tag references the kind `39999` record directly:

```json
{
  "kind": 39999,
  "pubkey": "<alice_pubkey>",
  "tags": [
    ["d", "endorsement/<hash>"],
    ["z", "39998:<canonical_pubkey>:brainstorm-community-endorsements"],
    ["p", "<bob_pubkey>"],
    ["a", "39999:<curator_pubkey>:<community_d_tag>"],
    ["type", "endorse"],
    ["role", "member"]
  ]
}
```

The mechanics are otherwise identical.

## Querying

A mirror computing membership for a single community subscribes to:

```json
{
  "kinds": [39999],
  "#z": [
    "39998:<canonical_pubkey>:brainstorm-community-endorsements",
    "brainstorm-community-endorsements"
  ],
  "#a": ["34550:<community_creator_pubkey>:<community_d_tag>"]
}
```

This returns every endorsement event across the network targeting that community, by every author, for every role.

Common refinements:

- **By role.** Add `"#role": ["member"]` (or `"moderator"`). Note that not every relay indexes multi-letter tag names; filter client-side as a fallback.
- **By target pubkey.** Add `"#p": ["<target>"]`.
- **By author.** Add `"authors": [...]` — useful when restricting to a trust set.

For discovery — enumerating which communities anyone in a given trust set has endorsed for — the same filter without `#a` returns every endorsement by those authors, and consumers aggregate by `a` tag.

## Replaceability and semantics

Each (author, target, community, role) tuple has at most one live endorsement event at any time. Republishing at the same deterministic d-tag produces a new authoritative signal that replaces the prior one. Authors can therefore:

- **Switch stance.** Change `endorse` ↔ `veto` by republishing at the same d-tag with the new `type` value.
- **Withdraw.** NIP-09 deletion requests MAY be used; absent honored deletion, the most recent event at the d-tag remains canonical until replaced.
- **Add scope.** Publish additional events with different `role` values (e.g. endorse Dave for both `member` and `moderator`) — different d-tags, additive.

The current state of "the network's view of Bob's membership in Bitcoin Army as a member" is the set of latest events from each author at the corresponding d-tag, weighted and aggregated by an interpretation layer (e.g. GR Community scoring).

## Out of scope

This document specifies the protocol layer — the structure of endorsement events and how to query them. Interpretation of these events into membership decisions (the GR Community scoring system, threshold tuning, two-gate confidence weighting, mirror-relay convergence guarantees) is an application-layer concern specified separately.

The community-record layer (each user's personal `brainstorm-communities` index DList of communities they curate, the soft-canonicalization flow at create-time, the personal projection of community metadata) is also out of scope here and specified in the Brainstorm Communities feature plan.
