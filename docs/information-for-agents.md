# The Technology Behind Brainstorm

> A briefing for AI agents helping someone build on nostr. It covers what Brainstorm offers, how to use each piece, how mature each piece is, and where its specification lives. Read this file first, then fetch only the specs that fit the project you're helping with.

Last reviewed: 2026-10-05.

## How to use this briefing

1. Read "The one idea to get right" below. Most integration mistakes come from missing it.
2. Match the project to the table in "Where to start".
3. Fetch the linked specs for the pieces that fit. Links ending in `.md` are raw markdown, readable without a browser.
4. Then answer the person: which pieces fit their project, how to integrate them, what to build first, and which pieces are drafts that may still change.

Brainstorm's websites are JavaScript apps, so fetching one of their pages returns an empty shell. Use the APIs, relays, and markdown links in this file instead.

## What Brainstorm is

Brainstorm computes personalized web-of-trust scores for nostr. It reads public nostr events (follows, mutes, and reports), runs an algorithm called GrapeRank from one person's point of view, and publishes the results back to nostr as signed events that any client can read and verify. The same scores are available over an HTTP API. Brainstorm also maintains a family of protocols for lists that a community curates and each reader filters through their own web of trust.

One team runs two sides:

- **Production.** The app is at [brainstorm.world](https://brainstorm.world) and the API is at `https://api.brainstorm.world`, operated by [NosFabrica](https://github.com/NosFabrica). Build against these.
- **R&D ("Tapestry").** The app is at [tapestry.brainstorm.world](https://tapestry.brainstorm.world), with source at [nous-clawds4/tapestry](https://github.com/nous-clawds4/tapestry). New protocols are drafted and piloted here before production adopts them. It's useful for trying drafts, but it isn't a production dependency.

All of it is open source.

## The one idea to get right: there is no global score

Every score is computed from a specific person's point of view, called the **observer**. The same account can rank high for one observer and not appear at all for another, and both answers are correct. Design the integration around this:

- **Decide whose point of view you show.** Best is the signed-in user's own. Otherwise use a default observer that you choose, or let the user pick one. Say whose view a score comes from.
- **A missing score is not distrust.** It means the account is below the publishing threshold, hasn't been computed yet, or is unreachable from the observer.
- **A score is not an endorsement.** Read the rank together with the negative signals (muters and reporters) rather than treating "has a score" as "trusted."
- **Don't compare or average scores across observers or providers.** Their scales mean different things.
- **Don't gate who may publish.** Anyone can publish anything on nostr. Apply trust when reading, per observer.

The full model is in [CONCEPTS.md](https://raw.githubusercontent.com/NosFabrica/protocols/main/CONCEPTS.md).

**Personalized scores need the observer to be set up.** A user's own scores exist only after a provider has computed their web of trust. With Brainstorm, that happens when they activate it at [brainstorm.world](https://brainstorm.world), which also publishes their designation (see NIP-85 below). For other users, fall back to a default observer and say so, or invite them to set up Brainstorm.

## What's on offer

Maturity labels used below:

- **Production:** live in the production stack. Safe to build on.
- **Published:** a spec published on NostrHub. The format is settled, but revisions are possible.
- **Draft:** a pre-NIP spec. It's implemented, but the wire format may still change, so put it behind your own interface.

### 1. Scores as nostr events: NIP-85 Trusted Assertions

*Production. NIP-85 is merged into the nostr NIPs repo. Brainstorm's consumer spec (what each tag means, how deletions work) is a draft that matches production.*

A score is a kind `30382` event about one account (its `d` tag is that account's hex pubkey). Its tags are `rank` (an integer from 0 to 100), the verified counts `followers`, `muters` and `reporters`, and `hops` (follow distance from the observer). The provider signs it with a key dedicated to that one observer, not with the observer's own key.

To find an observer's scores:

1. Fetch the observer's latest kind `10040` event. It names a provider key and a relay for each metric, for example `["30382:rank", "<provider key>", "<relay>"]`.
2. Query that relay for kind `30382` with `authors: [<provider key>]`, and optionally `#d: [<pubkeys you care about>]`.
3. Verify each signature, and check that the author matches the designated key.

Shortcut: `GET https://api.brainstorm.world/setup/<observer hex pubkey>` returns the designation rows Brainstorm serves for that observer. It's convenient, but still verify the events.

Use it when you want scores that are decentralized, verifiable, and cacheable, without calling a Brainstorm API at read time.

Gotchas:

- A missing `hops` tag means no path was found. It doesn't mean `0`, which is the observer themself.
- Removed scores are deleted with a kind `5` event whose `a` tag is `30382:<provider>:<pubkey>`.
- An old `created_at` doesn't mean the score is stale, because providers republish only when values change.
- Ignore tags you don't recognize. The R&D side adds extra diagnostic tags.

Specs: [NIP-85](https://raw.githubusercontent.com/nostr-protocol/nips/master/85.md), [Trusted Assertions consumer spec](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/trusted-assertions.md).

### 2. Scores over HTTP: the Open Ranking API

*Production. [Open Ranking](https://github.com/Open-Ranking/protocol) (ORE) is a multi-provider HTTP standard, so clients can switch providers.*

`https://api.brainstorm.world` implements these endpoints without sign-in. Every request and response is JSON:

| Endpoint | Body | Returns |
|---|---|---|
| `GET /.well-known/open-ranking.json` | — | The endpoints and algorithms on offer |
| `POST /stats/pubkey` | `{"pubkey", "algorithm"?, "pov"?}` | Rank plus follow/mute/report counts for one account |
| `POST /rank/pubkeys` | `{"pubkeys": [...], "algorithm"?, "pov"?, "limit"?}` | Ranks for a batch of accounts |
| `POST /search/pubkeys` | `{"query", "algorithm"?, "pov"?, "limit"?}` | Profile search, ordered by text match × trust |
| `POST /followers` | `{"pubkey", "algorithm"?, "pov"?, "limit"?}` | An account's top-ranked followers |
| `POST /muters` | `{"pubkey", "algorithm"?, "pov"?, "limit"?}` | An account's top-ranked muters |

- **Point of view.** Omit `algorithm` to get the default observer's view. For one person's view, use the personalized algorithm the capability document lists (`graperank-pov`, or `relevance-pov` for search) and pass `"pov": "<observer hex pubkey>"`.
- **Scale.** `rank` here is a decimal from 0 to 1. NIP-85's `rank` tag is an integer from 0 to 100. Convert before you compare them.
- **Caching.** Responses carry a `ttl` in seconds. Cache for that long.

Other public endpoints are listed in the [OpenAPI document](https://api.brainstorm.world/openapi.json) (about 150 KB). For example, `GET /shortestPath?from=<hex>&to=<hex>` shows how two accounts are connected by follows. Endpoints under `/user` and `/admin` need sign-in and serve the Brainstorm app itself.

Use it for quick lookups, ranking or filtering a feed in one batch call, and people search. It's simpler than reading NIP-85 events, but it depends on the provider being up.

Spec: [Open Ranking](https://raw.githubusercontent.com/Open-Ranking/protocol/main/README.md).

### 3. Spam filtering for a relay: whitelists

*Production.*

`GET https://api.brainstorm.world/whitelisted/<observer hex pubkey>?threshold=0.02` returns `{"data": {"observerPubkey", "numPubkeys", "pubkeys": [...]}}`, which lists every account trusted from that observer's point of view. `threshold` is the minimum score (0.02 to 1, default 0.02). A relay can use the list to accept events only from accounts its operator's web of trust vouches for. [Relay Tools](https://relay.tools) relays screen out spam with a Brainstorm whitelist like this one.

### 4. People search over a nostr relay: NIP-50 with web-of-trust extensions

*R&D. The search extensions are Tapestry's own, not a NIP.*

Tapestry hosts run a [NIP-50](https://raw.githubusercontent.com/nostr-protocol/nips/master/50.md) search relay at `wss://tapestry.brainstorm.world/relay`. Search kind `0` profiles and add terms to the `search` string:

- `observer:<hex pubkey>` sets whose point of view to use. If you omit it, the relay's default observer is used.
- `sort:<metric>:<asc|desc>`, for example `sort:followers:desc` or `sort:rank:desc`.
- `filter:<metric>:<op>:<value>`, where `op` is one of `gte`, `lte`, `gt`, `lt`, `eq`. For example, `filter:rank:gte:2`.

```json
["REQ", "s1", {"kinds": [0], "limit": 20, "search": "jack observer:<hex pubkey> sort:followers:desc filter:rank:gte:2"}]
```

The first search with a new `observer` loads that user's scores in the background. Until they load, results use the default view. For production people search, use `POST /search/pubkeys` (section 2).

### 5. Community-curated lists: Decentralized Lists

*Published (NostrHub, kind 30817). A revision is pending republication.*

These are lists that anyone can add to, as an alternative to NIP-51 lists that only their author controls:

- A **list header** is kind `9998`, or `39998` if it's editable. It carries a `names` tag (singular, plural) and `required` / `allowed` tags saying what each item must carry (`p`, `e`, `t` or `a`).
- An **item** is kind `9999`, or `39999` if it's editable. It carries a `z` tag pointing to the header (the header's event id, or `39998:<author pubkey>:<d>`) plus the item tag itself.
- Endorsing or objecting to an item is a NIP-25 reaction (`+` or `-`) on the item event.

Which items count is decided by each reader, for example by keeping items whose authors clear a threshold in the reader's web of trust. Use it for directories and registries that no single person should own. For example: "nostr clients," "bitcoin meetups," "relays for artists."

Specs: [Decentralized Lists](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/nips/decentralized-lists.md), and the [Cross-NIP Compatibility companion](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/drafts/decentralized-lists-compat.md), which covers existing event kinds acting as list items (publish-ready). Mirror relay: `wss://dcosl.brainstorm.world`.

### 6. Curated sets from one point of view: Trusted Lists

*Draft. Implemented on the R&D side.*

Trusted Lists are the list counterpart of NIP-85. Instead of one score per event, one event lists every member computed for an observer, for example "the accounts my web of trust has tagged *developer*." The kind is the matching Trusted Assertion kind plus 10, and its last digit tells you the member type:

| Kind | Members | Member tag |
|---|---|---|
| `30392` | pubkeys | `p` |
| `30393` | events | `e` |
| `30394` | addressable events | `a` |
| `30395` | external identifiers (NIP-73) | `i` |

The observer's kind `10040` advertises a publisher with a bare-kind entry such as `["30392", "<publisher pubkey>", "<relay>"]`. A `["truncated", "<total>"]` tag means the list is incomplete. If that tag is absent, the list is complete.

Spec: [Trusted Lists](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/drafts/trusted-lists.md).

### 7. How the scores are computed: GrapeRank

*Draft spec that matches the production implementation.*

GrapeRank repeats a calculation until the scores settle. Follows count for an account, mutes and reports count against it, and each rating is weighted by the rater's own standing in the observer's web of trust. A confidence model keeps an account with one weak endorsement near zero. The output, **Influence**, runs from 0 to 1, and NIP-85's `rank` is `round(Influence × 100)`. Named parameter presets (default, permissive, restrictive) change the results, so a score also depends on its preset.

Read the spec when you need to explain a score, choose thresholds, or compute scores yourself: [GrapeRank](https://raw.githubusercontent.com/NosFabrica/protocols/main/specs/graperank.md).

### 8. Also in R&D (drafts, for experiments)

The R&D side drafts more protocols on top of Decentralized Lists. They include concepts (structured, shared vocabularies), tags (anyone can tag a profile or a note, and the tags count per point of view), pins, communities, and the full grammar of the kind `10040` designation. All are drafts. The index, with each one's status, is at [protocols/README.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/protocols/README.md).

## Where to start

| If the project is… | Start with | Then consider |
|---|---|---|
| A nostr client (feeds, replies, DMs) | `POST /rank/pubkeys` to rank or filter authors from the user's point of view (§2) | Reading NIP-85 events directly, so you don't depend on the API (§1) |
| People search or discovery | `POST /search/pubkeys` with `pov` (§2) | The NIP-50 relay (§4) |
| A relay | `/whitelisted/<observer>` as a write allow-list (§3) | Filtering at read time with NIP-85 (§1) |
| Spam or moderation tooling | `rank` together with `muters` and `reporters` (§1 or §2) | `/followers` and `/muters` to see who is vouching or objecting (§2) |
| A bot, agent, or backend service | `POST /stats/pubkey` and `POST /rank/pubkeys` (§2) | NIP-85, to verify scores independently (§1) |
| A directory, registry, or marketplace curated by a community | Decentralized Lists, with items filtered by score (§5) | Trusted Lists (§6) |
| Your own scoring service | NIP-85 publishing (§1) and the GrapeRank spec (§7) | Trusted Lists (§6) and implementing Open Ranking (§2) |

## Practical notes

- Pubkeys are 64-character lowercase hex in every event, endpoint, and point-of-view parameter. Convert `npub`s first (NIP-19).
- Always say whose point of view a score comes from, both in the UI and in what you tell the person.
- Questions, interop problems, and spec ambiguities go to the issues on [NosFabrica/protocols](https://github.com/NosFabrica/protocols/issues).

## More

- [Ecosystem map](https://raw.githubusercontent.com/NosFabrica/protocols/main/ECOSYSTEM.md): every repository and host, and each one's role.
- [Protocols repository README](https://raw.githubusercontent.com/NosFabrica/protocols/main/README.md): spec index and maturity model.
- [Tapestry BIBLE.md](https://raw.githubusercontent.com/nous-clawds4/tapestry/main/BIBLE.md): the R&D stack's full architecture reference. It's large, so read its table of contents first.
