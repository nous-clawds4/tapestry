# Tapestry Trusted Lists — kind family and member-type convention

> **Status:** 📝 pre-NIP (internal wire format; consumed by our own readers + federation today).
> **Sources:** the Trusted List publishers (`src/api/trustedList/`), the pinned-tag TL work
> (`pin-a-tag` ADRs, kind-30392), the tag-applicability lists (`tag-applicability` ADR 0001), the
> note Trusted List (`event-tagging` ADR 0016). Companion to upstream **[NIP-85: Trusted
> Assertions](https://nips.nostr.com/85)** (Vitor Pamplona) — this spec does not modify NIP-85; it
> defines the *list* analog and binds its kinds to NIP-85's subject-type convention.

## What a Trusted List is

A **Trusted List (TL)** is a TA-signed, addressable (parameterized-replaceable) event that publishes
a **curated set of members** computed under a point of view — e.g. "the pubkeys trusted-tagged with
tag X under observer O," "the tags that apply to events," "the notes trusted-tagged with tag X." It
is the *aggregate* analog of a NIP-85 Trusted Assertion: where an assertion states a computed result
**about one subject**, a list enumerates **many members** of one type.

## Kinds — bound to NIP-85's subject-type convention

NIP-85 assigns its Trusted Assertion kinds by **subject type**, encoded in the last digit of the
`3038x` range, with the subject carried in the `d` tag:

| NIP-85 kind | Assertion subject | subject in `d` |
|---|---|---|
| `30382` | a **pubkey** | `<pubkey>` |
| `30383` | an **event** (event id) | `<event_id>` |
| `30384` | an **addressable event** | `<kind:pubkey:d>` (a-coordinate) |
| `30385` | an **external identifier** (NIP-73) | `<i-tag>` |

Tapestry Trusted Lists mirror this by the **`+10` convention**: `TL kind = TA kind + 10`, so the
**last digit denotes the member type** exactly as NIP-85's denotes the subject type. The `d` tag on
a TL identifies the *list* (not a single subject); members are carried as ordinary tags of the type
the kind denotes:

| TL kind | = TA + 10 | Member type | Member tag | Member value |
|---|---|---|---|---|
| `30392` | `30382` | pubkeys | `p` | `<pubkey>` |
| `30393` | `30383` | events | `e` | `<event_id>` |
| **`30394`** | **`30384`** | **addressable events** | **`a`** | **`<kind:pubkey:d>`** (a-coordinate) |
| `30395` | `30385` | external identifiers | `i` | `<i-tag>` (NIP-73) |

### Why bind kind → member type (the rationale)

A reader — ours, a federating instance, or any NIP-85-aware client — should be able to read the
**member type off the kind alone**, without inspecting the tags. NIP-85 already establishes that
`3038x`'s last digit *is* the subject type; anchoring the list kinds to the same digit means one
consistent rule spans both the single-subject assertions and their list aggregates. A list of
addressable events therefore **must** be `30394` (matching NIP-85 `30384`); publishing a-coordinate
members on `30393` (the *event-id* kind) would tell a conformant reader "these are event ids" when
they are addressable coordinates — a category error that breaks kind-keyed dispatch and federation.

## Common wire shape

A Tapestry TL (any kind in the family) carries:

- `["d", "<list-id>"]` — the addressable identity of the list (deterministic per list, so the list
  is replaceable in place). Examples: `tl-pin-<obs8>-<tagAuthor8>-<slug>` (pinned-tag pubkey TL),
  `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>` (pinned-tag note TL), `tag-applicability-nostr-event`
  (applicability list).
- `["title", "<human label>"]`, `["metric", "<metric-id>"]` — provenance/label. `metric` names the
  computation (e.g. `pinned-tag-membership`, `pinned-tag-notes`, `tag-applicability`).
- **member tags** — one per member, of the type the kind denotes (`p` / `e` / `a` / `i`); each may
  carry optional trailing fields (relay hint, author, score) per the publisher.
- optional provenance tags — e.g. `["observer", <pubkey>]`, `["source-tag", <eventId> <author> <slug>]`,
  `["cutoff", <n>]`, `["min-rank", <n>]`.
- optional **relay-filterable discovery tags** — single-letter tags carrying *what the list is about*
  (distinct from the member tags), so consumers can find lists by axis rather than only by exact `d`-tag.
  The pinned-tag note TL (below) carries `["a", "39999:<tagAuthor>:<slug>"]` (find every note TL for a
  tag, across observers: `{kinds:[30393], "#a":[coord]}`) and `["p", <observer>]` (find every note TL for
  an observer: `#p`). These are metadata, **not members** — the note TL's members remain its `e` tags.
- `["status", "retracted"]` on an **empty-membership replacement** — the retraction convention: a
  list that no longer has members (or is being migrated off a kind) is replaced in place by an empty
  event carrying this marker, rather than deleted.
- `content` — optional JSON echo of the members with their computed values.

Signer: the deployment's **Tapestry Assistant**, resolved at runtime (never hardcoded; see CLAUDE.md).

## Completeness & the partial signal

A **published Trusted List an integrator relies on must be complete** — or explicitly signal that it
isn't. A durable list MUST NOT silently truncate to a small fixed number. Where a list cannot carry its
full membership (a single addressable event has a practical size ceiling), the publisher includes an
explicit **`["truncated", "<total>"]`** tag — its presence means "this list is **not** exhaustive" and
its value is the true total member count; its **absence means complete**. The content JSON mirrors this
with `partial: true` + `total` when truncated. (The pinned-tag note TL uses this: it publishes the full
trusted-tagged set up to a high, operator-tunable ceiling, marking `truncated` beyond it or when its
underlying scan was itself bounded — ADR event-tagging/0017. Consumers should treat a missing
`truncated` tag as authoritative-complete and a present one as a cue to reconcile from raw taggings.)

## Current members of the family (Tapestry deployments)

| List | Kind | Members | Publisher |
|---|---|---|---|
| Pinned-tag pubkey TL | `30392` | `p` (pubkeys tagged X) | `refreshPinnedTags.runOnePin` |
| Pinned-tag note TL | `30393` | `e` (notes tagged X) | `refreshPinnedTags.runOneNotePin` (ADR event-tagging/0016) |
| Tag-applicability lists ("Tags for Nostr Events/Pubkeys") | **`30394`** | `a` (tag a-coordinates) | `refreshApplicabilityLists` (ADR tag-applicability/0001; **migrated 30393 → 30394**, see below) |

## Migration note — applicability lists 30393 → 30394

The tag-applicability lists (ADR tag-applicability/0001) originally shipped on `30393` because no
addressable-member kind was yet defined; their members are tag **a-coordinates**
(`39999:<author>:<slug>` — addressable kind-39999 events), so under this convention they belong on
**`30394`**. The publisher now emits `30394` and **retracts the legacy `30393`** applicability lists
in place (empty-membership + `["status","retracted"]` at the same `d` tags) so no stale
wrong-kind list lingers for federating readers. This is a pure re-kinding: `d` tags, membership rule
(HINT ∪ USAGE), and content are unchanged.

## Not yet built (noted)

- The manual TL publisher UI (`ui/src/pages/lists/DListItems.jsx`) offers only `p`/`e`; an `a` option
  (kind `30394`) and an `i` option (kind `30395`) would complete the family in that surface.
- `30395` (external identifiers / NIP-73) has no Tapestry publisher yet.
