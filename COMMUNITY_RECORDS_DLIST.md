Brainstorm Community Records DList
=====

This document specifies the Brainstorm Community Records DList — a per-user Decentralized List that holds a curator's personal records of the Brainstorm Communities they participate in. Each record is a kind `39999` ListItem carrying community metadata (name, description, topic, image, etc.) and engine config (seed pubkeys, relays, scoring model, threshold).

This is the **community-record layer** of Brainstorm Communities, paired with the global signal layer specified in [COMMUNITY_ENDORSEMENTS_DLIST.md](./COMMUNITY_ENDORSEMENTS_DLIST.md):

- **Community-records are personal.** Each user has their own records — their own copy of the metadata and engine config for every community they curate. The community-as-thing is the convergent overlap of all participants' records.
- **Endorsements are global.** All endorsements live on a single network-wide Endorsements DList; mirrors compute membership by aggregating across the whole network.

This spec covers the personal layer. It builds on:

- The [Decentralized Lists base NIP](DECENTRALIZED_LISTS.md) — the underlying list pattern.
- The [Cross-NIP Compatibility companion NIP](DECENTRALIZED_LISTS_COMPAT.md) — for `a`-tag references to NIP-72 communities.

## The personal-projection model

There is no canonical record of any community anywhere. There are N personal records of Community X — one per user who participates — and the community **is** the convergent overlap of those personal records.

When a user joins a community, they create their own record. They typically copy fields from whoever introduced them, then may edit over time (add a relay, tweak seed pubkeys, change the threshold). Edits have material consequence only when the user actually **uses** their version — runs their own mirror relay, or filters content with their own derived whitelist.

The convergent-overlap model recurses one level: not just *membership* converges across mirror relays; each user's *projection of the community itself* converges across users via the same trust dynamics.

## The `brainstorm-communities` index DList

Each user maintains exactly one `brainstorm-communities` DList. The d-tag is deterministic so that any client can locate a given user's index by author pubkey alone.

### Header (kind 39998)

```json
{
  "kind": 39998,
  "pubkey": "<user_pubkey>",
  "tags": [
    ["d", "brainstorm-communities"],
    ["names", "brainstorm community", "brainstorm communities"],
    ["titles", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "Communities I curate."],

    ["required", "t", "Community slug — DList NIP item-declaration tag"],
    ["required", "name", "Display name of the community"],
    ["required", "description", "What the community is about"],
    ["required", "relay", "URL of a relay serving this community (multiple permitted)"],
    ["required", "seed", "Seed pubkey for the GR Community membership algorithm (multiple permitted)"],
    ["required", "weighting_model", "Identifier of the scoring system used for membership computation"],
    ["required", "endorsement_threshold", "Score threshold in [0, 1] above which a pubkey is considered a member"],

    ["allowed", "image", "Banner image URL"],
    ["allowed", "topic", "Topical tag describing the community (multiple permitted)"],
    ["allowed", "language", "Primary language ISO 639-1 code"],
    ["allowed", "founder", "Pubkey of the original founder — informational only, no algorithmic privilege"],
    ["allowed", "a", "Standard a-tag wrapping a foreign-kind community (e.g., NIP-72 kind 34550) — see companion NIP Method 2"],
    ["allowed", "template-source", "Event id of a community-record this one was copied from"]
  ]
}
```

The third element on each `required` / `allowed` declaration is a brief human-readable description, per the base NIP's optional-third-element convention.

## Community record (kind 39999 ListItem)

Each community a user curates is a kind `39999` event placed on their `brainstorm-communities` DList.

### Tag set

| Tag | Required | Notes |
|---|---|---|
| `d` | ✅ | Community slug — replaceable address per NIP-01. One record per (user, community-slug). |
| `z` | ✅ | Parent pointer: `39998:<user_pubkey>:brainstorm-communities` |
| `t` | ✅ | Community slug — DList NIP item-declaration tag (string-named entity). Same value as `d`. |
| `name` | ✅ | Display name of the community |
| `description` | ✅ | What the community is about |
| `image` | — | Banner image URL |
| `topic` | — | Topical tag (multiple permitted) — custom tag, avoiding overload of `t` |
| `language` | — | ISO 639-1 code |
| `founder` | — | Pubkey of the original founder. Informational only. Records sharing a founder pubkey are clustered as forks of the same root community at the UI layer; the protocol does no fork-tracking itself. |
| `a` | — | A-tag of a wrapped foreign-kind community (e.g., NIP-72 kind 34550). Bare standard a-tag, single wrap per record. Absent for native Brainstorm communities. |
| `template-source` | — | Event id of a community-record this one was copied from. Multiple permitted (records synthesized from multiple sources). Snapshot semantics — points at the specific version the curator copied, not the source's current state. |
| `relay` | ✅ | URL of a relay serving this community (multiple permitted) |
| `seed` | ✅ | Seed pubkey for the GR Community membership algorithm (multiple permitted) |
| `weighting_model` | ✅ | Identifier of the scoring system. Default convention: `gr-community-default-v1`. |
| `endorsement_threshold` | ✅ | Score threshold in [0, 1]. Default convention: `0.5`. |

### Replaceability

Kind 39999 is replaceable. Each user has at most one live record per community-slug; republishing at the same d-tag updates their record. There is no protocol-level "history" of past versions — readers see the latest, and `template-source` snapshots provide point-in-time lineage where wanted.

### NIP-72 wrapping

A community-record can wrap an existing NIP-72 community by carrying a single bare `a` tag pointing at the kind 34550 community-definition event:

```json
["a", "34550:<community_creator_pubkey>:<community_d_tag>"]
```

The kind number embedded in the a-tag value (`34550:`) provides implicit type discrimination — no separate type marker needed. The wrapped NIP-72 event is unmodified by the wrap, and the community-record is otherwise structurally identical to a native record. See the [Cross-NIP Compatibility companion NIP](DECENTRALIZED_LISTS_COMPAT.md), Method 2, for the broader pattern.

### Lineage via `template-source`

When a curator joins a community by copying another curator's record, they SHOULD include one or more `template-source` tags identifying the source event(s):

```json
["template-source", "<source_event_id>"]
```

The value is the event id of the source record (immutable snapshot), not the source's a-tag (which would track the source's latest version). This locks in "what the curator actually saw and copied" — if the source curator later updates their record in objectionable ways, the lineage tag does not retroactively re-target the new version.

Multiple `template-source` tags are permitted when a record is synthesized from multiple sources.

`template-source` is optional. A record with no `template-source` represents either a freshly-founded community or an independently-authored record.

## Examples

### Alice founds a native Brainstorm community

```json
{
  "kind": 39999,
  "pubkey": "<alice_pubkey>",
  "tags": [
    ["d", "coffee-lovers"],
    ["z", "39998:<alice_pubkey>:brainstorm-communities"],
    ["t", "coffee-lovers"],
    ["name", "Coffee Lovers"],
    ["description", "A community for people who love good coffee."],
    ["image", "https://example.com/coffee-lovers-banner.jpg"],
    ["topic", "coffee"],
    ["topic", "food-and-drink"],
    ["language", "en"],
    ["founder", "<alice_pubkey>"],
    ["relay", "wss://relay.coffee-lovers.example"],
    ["seed", "<alice_pubkey>"],
    ["seed", "<bob_pubkey>"],
    ["weighting_model", "gr-community-default-v1"],
    ["endorsement_threshold", "0.5"]
  ]
}
```

### Carol joins Coffee Lovers by copying Bob's record

```json
{
  "kind": 39999,
  "pubkey": "<carol_pubkey>",
  "tags": [
    ["d", "coffee-lovers"],
    ["z", "39998:<carol_pubkey>:brainstorm-communities"],
    ["t", "coffee-lovers"],
    ["template-source", "<bob_record_event_id>"],
    ["name", "Coffee Lovers"],
    ["description", "A community for people who love good coffee."],
    ["topic", "coffee"],
    ["topic", "food-and-drink"],
    ["language", "en"],
    ["founder", "<alice_pubkey>"],
    ["relay", "wss://relay.coffee-lovers.example"],
    ["seed", "<alice_pubkey>"],
    ["seed", "<bob_pubkey>"],
    ["weighting_model", "gr-community-default-v1"],
    ["endorsement_threshold", "0.5"]
  ]
}
```

Carol's record is distinct from Bob's (different author pubkey, separate replaceable address) but carries `template-source` to record where she copied from.

### Alice wraps an existing NIP-72 community

```json
{
  "kind": 39999,
  "pubkey": "<alice_pubkey>",
  "tags": [
    ["d", "bitcoin-army"],
    ["z", "39998:<alice_pubkey>:brainstorm-communities"],
    ["t", "bitcoin-army"],
    ["a", "34550:<original_nip72_creator_pubkey>:bitcoin-army"],
    ["name", "Bitcoin Army"],
    ["description", "..."],
    ["topic", "bitcoin"],
    ["founder", "<original_nip72_creator_pubkey>"],
    ["relay", "wss://relay.example"],
    ["seed", "<alice_pubkey>"],
    ["seed", "<carol_pubkey>"],
    ["weighting_model", "gr-community-default-v1"],
    ["endorsement_threshold", "0.5"]
  ]
}
```

The `a` tag points at the underlying NIP-72 community-definition event. Brainstorm-aware tooling can discover that this record wraps an existing NIP-72 community without any additional convention.

## Personal-projection mechanics

### Joining a community

A user joins a community by publishing their own kind 39999 record on their `brainstorm-communities` DList. There is no "join request" event and no acceptance from anyone else — the act of curating the record IS the join.

A new joiner typically copies fields from whoever introduced them and includes a `template-source` tag pointing at that source record's event id. They may also tweak fields — change the threshold, add a relay, add or remove seed pubkeys — before publishing.

### Editing a record

Editing is just republishing at the same d-tag. Replaceable kind 39999 means the latest publish wins; older versions are not protocol-tracked (relays may or may not retain them; consumers see the latest).

### Withdrawing

A user who no longer wishes to curate a community can:

- **Stop endorsing.** The user's existing endorsement events on the global Endorsements DList remain, but they can publish replacement events with `type=veto` or simply stop maintaining endorsements. The latest stance wins.
- **Delete the record.** Per NIP-09, the user can publish a deletion request for their community-record event. This is best-effort; relays MAY honor it.
- **Leave it alone.** A stale record continues to exist; consumers can identify staleness from event timestamps and from the user's silence on the endorsement layer.

### Fork-clustering

Records sharing a `founder` pubkey are clustered as forks of the same root community at the UI / discovery layer. Records with different `founder` pubkeys (or no founder) are surfaced as independent attempts. The protocol itself does no fork-tracking; this is a UI-level convention.

### Soft canonicalization at create time

When a user attempts to create a record for a community-slug already curated by others in the user's trust network, the UI SHOULD surface 3-5 similar communities (matched on name + topic + trust-graph relevance) and offer three explicit choices: join one of these, fork one with tweaks, or start fresh. The protocol places no constraints here — slugs are scoped per (kind, pubkey) per NIP-01 and never conflict at the data layer. This soft-canonicalization is a UI mechanism for reducing accidental fragmentation, not a protocol guarantee.

## Querying

A discovery client wanting to enumerate the communities curated by a specific user:

```json
{
  "kinds": [39998],
  "authors": ["<user_pubkey>"],
  "#d": ["brainstorm-communities"]
}
```

(returns the index header), and:

```json
{
  "kinds": [39999],
  "authors": ["<user_pubkey>"],
  "#z": ["39998:<user_pubkey>:brainstorm-communities"]
}
```

(returns their records).

A discovery client wanting all curators' records of a specific community-slug across the network:

```json
{
  "kinds": [39999],
  "#t": ["coffee-lovers"]
}
```

A discovery client wanting all records that wrap a specific NIP-72 community:

```json
{
  "kinds": [39999],
  "#a": ["34550:<community_creator_pubkey>:<community_d_tag>"]
}
```

A discovery client wanting all records derived from a specific source record (downstream lineage):

```json
{
  "kinds": [39999],
  "#template-source": ["<source_event_id>"]
}
```

(Note: multi-character tag-name filters depend on relay indexing of multi-letter tags; filter client-side as a fallback.)

## Two-layer representation

Each community-record event carries data in two layers simultaneously:

- **DList layer** (primary) — fields live as native nostr event tags as described above. Any DList-aware client can read or write these without Tapestry-specific tooling.
- **Concept layer** (additional) — the same fields are also expressed as a word-wrapper JSON tag conforming to the firmware's `brainstorm-community` Concept schema. Tapestry-aware tooling uses this for normalization, audit, and graph queries. See BIBLE.md §8 and `firmware/active/concepts/brainstorm-community/`.

Both layers are populated and kept in sync at write time. The DList layer is the primary user-facing representation; the Concept layer is the integration layer with the rest of Tapestry's machinery. The `content` field on every event is left empty, reserved for future use (e.g., encrypted data).

## Out of scope

This document specifies the protocol layer for community-records — the structure of the per-user index DList and individual community-record events. The following are out of scope:

- **GR Community scoring system.** Interpretation of endorsement events into membership decisions is an application-layer concern specified separately. The community-record's `weighting_model` and `endorsement_threshold` fields parameterize the interpretation; the algorithm itself does not live here.
- **Mirror relay tooling.** How a mirror relay is provisioned, configured, and run is operational; the protocol describes only the data it consumes and emits.
- **Soft-canonicalization UX.** The user-facing flow for choosing among similar existing communities at create time is a UI concern; the protocol enables it but does not specify it.
- **Forking flow as a distinct UX.** Forking is supported by the protocol (records with different `founder` pubkeys are independent at the data layer); the UX for explicitly forking with attribution is a UI concern.
- **Cross-community feeds, threads, content moderation, post-approval mechanisms.** These belong to higher application layers built on top of the membership computation enabled by this spec plus the endorsement layer.
