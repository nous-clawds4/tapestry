# Indexing DLists for search — target state

**Status:** 🟡 DESIGN TARGET — Part 1 is proximate and buildable on today's protocol;
Parts 2 and 3 are deliberately deferred. Nothing here is ratified.
**Created:** 2026-09-18
**Audience:** the Vespa-backed search backend (separate repo) and anyone else who wants to
subscribe to "which Decentralized Lists are worth indexing".
**Related:** [`protocols/worksheet.md`](../protocols/worksheet.md) W17 (`field-type` in the
wild) and W18 (field types as a DList); ADRs `dlist-item-tagging/0001`–`0003`;
[`protocols/drafts/trusted-lists.md`](../protocols/drafts/trusted-lists.md);
[`protocols/drafts/event-taggings.md`](../protocols/drafts/event-taggings.md);
BIBLE §22 / §25 (`b` tags, `REFERENCES`).

---

## The problem

A search engine indexing nostr needs to decide, out of every Decentralized List in the
universe, which ones it cares about. "GitHub Accounts"
(`39998:b83a28b7…:github-accounts`) becomes a search tab the way `[shopping | images |
videos]` are tabs. On day one there is exactly one such list and one engine.

The design goal is to answer that question **in protocol rather than in backend
configuration**, so that (a) a second engine can adopt the same convention, (b) the answer
can later become point-of-view dependent rather than operator-dependent, and (c) the
artifacts produced are useful to others.

The rejected framing is an allowlist. "Only the special account's picks count" is naturally
expressed as a *point of view whose web of trust contains one pubkey*, not as a curation
rule that filters by author. Same day-one behaviour, but every later loosening is a
configuration change instead of a rewrite. See "Why a POV, not an allowlist" below.

---

## Vocabulary — the pieces that already exist

| Piece | Kind | Shape |
|---|---|---|
| DList header | 39998 | `['d', <slug>]`, `['names', <sing>, <plur>]`, `['required'/'optional', <field>]`, `['field-type', <field>, <type>]` |
| DList item | 39999 | `['d', <slug>]`, `['z', <parent header coord>]`, field tags |
| Tag element | 39999 | `['d', <slug>]`, `['z', '39998:<TA>:tag']`, content carries name/description |
| Per-tag tagging header | 39999 | `['d', 'tagging:<slug>-tagging']`, `['z', '39998:<TA>:tagging-with-specific-tag']`, `['a', '39999:<tagAuthor>:<slug>']` |
| Tagging assertion | 39999 | target + dual `z` + `['polarity', '1'\|'-1']` |
| Trusted List | 30392–30395 | `p` / `e` / `a` / `i` members by kind; TA-signed; per observer |
| `b` tag | on 39998/39999 | `['b', <target a-tag>, 'pointer'\|'inherit'\|'inherit-items']` |

The live `github-accounts` header, verbatim, is the worked example throughout:

```json
{
  "kind": 39998,
  "pubkey": "b83a28b7e4e5d20bd960c5faeb6625f95529166b8bdb045d42634a2f35919450",
  "tags": [
    ["d", "github-accounts"],
    ["names", "GitHub Account", "GitHub Accounts"],
    ["description", "A list of github handles/accounts"],
    ["required", "github-username"],
    ["field-type", "github-username", "text"]
  ]
}
```

Note what is already there and costs nothing to consume: **the tab label**
(`names[2]` = "GitHub Accounts") and **the result schema** (`required github-username`,
typed `text`). An indexer that reads these is generic across lists on day one. An indexer
that hardcodes them has to be unwound later.

---

# ═══════════════════════════════════════════════════════
# PART 1 — NOW. Membership: which lists get indexed.
# Buildable on today's protocol. No new wire format.
# ═══════════════════════════════════════════════════════

## The mechanism

A curator tags **the DList header itself** with a tag meaning "worth indexing for search".
The tagging machinery already accepts any addressable coordinate as a target
(`classify.js` `targetOf` passes the `a` value through verbatim, with no kind restriction),
so tagging a kind-39998 header needs no protocol change.

Aggregating those taggings under a point of view yields a **kind-30394 Trusted List whose
`a` members are DList header coordinates**. That is the artifact the indexer subscribes to:
one replaceable event, fetched once, re-fetched on replacement.

```
  tag element                    per-tag tagging header
  39999:<tagAuthor>:worth-       39999:<TA>:tagging:worth-indexing-for-search-tagging
        indexing-for-search              │
        │                                │ (a → tag element)
        └────────────────────────────────┘
                     ▲
                     │ z  (membership: "this is a tagging with THAT tag")
                     │
          ┌──────────┴───────────┐
          │  tagging assertion   │  kind 39999, authored by the curator
          │  a → 39998:b83a…:github-accounts   ← the TARGET is the list header
          │  polarity 1                        ← disputable: -1 says "no, spam"
          └──────────┬───────────┘
                     │
                     │  aggregate under a POV (count / input / certainty)
                     ▼
          ┌──────────────────────────────────────────┐
          │  kind 30394  Trusted List                │  TA-signed
          │  d: tl-pin-items-<obs8>-<auth8>-worth-…  │
          │  a: 39998:b83a…:github-accounts          │  ← THE INDEX SET
          │  a: 39998:…:<next list>                  │
          │  z: 39998:<TA>:trusted-list              │  ← discovery
          │  z: 39999:<TA>:tl:worth-…-tls            │  ← per-tag discovery
          │  observer / source-tag / curation-method │
          └──────────────────────────────────────────┘
                     │
                     ▼
              search backend
```

## Wire shapes

**The tagging assertion** (kind 39999, authored by the curator):

```json
{
  "kind": 39999,
  "tags": [
    ["d", "event-tag-worth-indexing-for-search-<auth8>-<d16>-<hash8>-<asserter8>"],
    ["a", "39998:b83a28b7…:github-accounts"],
    ["z", "39998:<taPubkey>:nostr-event-tag"],
    ["z", "39999:<headerAuthor>:tagging:worth-indexing-for-search-tagging"],
    ["polarity", "1"]
  ],
  "content": ""
}
```

The `d` is deterministic so a re-assertion replaces rather than duplicates
(ADR `dlist-item-tagging/0001`). `polarity` is `1` to apply, `-1` to dispute.

**The resulting Trusted List** (kind 30394, TA-signed, one per observer):

```json
{
  "kind": 30394,
  "tags": [
    ["d", "tl-pin-items-<obs8>-<tagAuthor8>-worth-indexing-for-search"],
    ["title", "Worth Indexing for Search"],
    ["metric", "pinned-tag-items"],
    ["a", "39998:b83a28b7…:github-accounts"],
    ["observer", "<observer pubkey>"],
    ["source-tag", "<tagEventId>", "<tagAuthor>", "worth-indexing-for-search"],
    ["curation-method", "<method>"],
    ["p", "<observer pubkey>"],
    ["z", "39998:<TA>:trusted-list"],
    ["z", "39999:<TA>:tl:worth-indexing-for-search-tls"]
  ]
}
```

A `truncated` tag appears only when the list is partial; its absence means complete.

## What the indexer subscribes to

Preferred, because it survives a `d`-tag change:

```json
{ "kinds": [30394], "authors": ["<TA>"], "#z": ["39999:<TA>:tl:worth-indexing-for-search-tls"] }
```

Then, for each `a` member, fetch the header to get the tab label and the field schema:

```json
{ "kinds": [39998], "authors": ["b83a28b7…"], "#d": ["github-accounts"] }
```

And for the items themselves:

```json
{ "kinds": [39999], "#z": ["39998:b83a28b7…:github-accounts"] }
```

## Why a POV, not an allowlist

Day one behaviour ("only the special account's picks count") is obtained by running the
aggregation under a point of view whose web of trust contains only that account, with the
existing `count` method at cutoff 1. No bespoke curation code.

Every expansion then becomes configuration, not a rewrite:

- **More contributors** — the special account follows them; the list widens on next refresh.
- **Looser strictness** — raise the cutoff, or switch to `certainty`.
- **Someone brings their own POV** — already free. The list is computed per POV and its
  address is keyed by observer, so a different observer yields a different index set. The
  backend need not expose this to benefit from not having foreclosed it.

## The escape hatch: skip the Trusted List

The Trusted List is a **cache of one POV's answer**, not the mechanism. The mechanism is
taggings plus a trust filter. An engine that wants its own view filters the raw assertions
directly and scores them itself:

```json
{ "kinds": [39999], "#z": ["39999:<TA>:tagging:worth-indexing-for-search-tagging"] }
```

Start by consuming the signed list, because it is one fetch. Moving to a self-computed view
later is not a change of mechanism, only of who does the scoring.

## Naming, because this is the part that becomes a standard

The per-tag tagging header is keyed by the tag element's author, so **whoever authors the
tag owns the namespace every other participant's taggings land in**. If this convention is
meant to be shared, author the tag under a well-known pubkey and publish the concept.
Re-parenting later is an epic; choosing correctly now is a line of config. The honored
authorities are already a request parameter, which is the federation seam.

The slug is wire-visible and permanent once published. `worth-indexing-for-search` is
narrow (an archiver or a mirror wants the same signal); something like `worth-indexing`
with the human name carrying the nuance may age better.

## Open items for Part 1

1. **Verify a kind-39998 target reads cleanly end to end.** The classifier accepts it, but
   the item-facing read paths were built expecting kind-39999 targets, and
   `dlist-item-tagging` #4 edge case E5 explicitly flagged non-item coordinates. Tag a
   header on a dev instance and walk the tag page and the item Trusted List.
2. **Decide whose assistant signs the list.** The signer is the instance that runs the
   refresh, so the indexer subscribes to one deployment's output.
3. **`applicability.js` matches tags to targets with `A_COORD_RE = /^39999:…/`.** Confirm
   whether a 39998 target needs an applicability entry, or whether applicability is
   irrelevant on this path.

---

# ═══════════════════════════════════════════════════════
# ▼▼▼  DIVISION: everything above is buildable now.      ▼▼▼
# ▼▼▼  Everything below is a target, not a commitment.   ▼▼▼
# ═══════════════════════════════════════════════════════

Parts 2 and 3 exist to be aimed at, not built yet. With one search engine they buy nothing
that backend configuration does not already buy. They become worth building when a **second
independent engine** appears, because that is the first moment the conventions have to be
shared rather than merely consistent.

The one thing worth doing early is **fixing the join key as the DList header coordinate**,
so that moving configuration into protocol later is a data migration rather than a redesign.

---

# PART 2 — LATER. Extrinsic configuration, joined by `b`.

## Intrinsic vs extrinsic

The split that makes this tractable is authorship, not storage:

| | Intrinsic | Extrinsic |
|---|---|---|
| **Describes** | the list itself | one engine's policy about the list |
| **Authored by** | the list's curator | the engine operator |
| **Examples** | display names, field declarations, field types | priority, refresh cadence, cache TTL, ranking boost, tab order |
| **Lives on** | the target header (already does) | a settings list you author |
| **Defer?** | no — consume it today, it is free | yes — backend config loses nothing |

Configuration does **not** belong in the tagging assertion. A tagging is a bare claim with
a polarity that dedupes latest-wins per asserter and target. Hanging config off it would
make every tagger implicitly publish configuration, and disputing the claim would take the
configuration with it.

## The join primitive already exists

A `b` tag is a typed pointer carried on kinds 39998 and 39999:
`['b', '<target a-tag>', '<type>']`, with the closed registry `pointer` | `inherit` |
`inherit-items` (absent or unknown reads as `pointer`, fail-safe). It is child-claims-parent,
and the graph derives an edge from it automatically
(`REFERENCES {source:'b-tag'}` for a pointer). BIBLE §25.

That is exactly the "join a DList to a metadata record" primitive, already ratified.

## Shape

```
  search-index-settings                      github-accounts
  39998:<engine>:search-index-settings       39998:b83a28b7…:github-accounts
    ['names','Search Index Setting', …]                    ▲
    ['required','priority']                                │
    ['optional','refresh-seconds']                         │ b (pointer)
    ['optional','tab-order']                               │
    ['field-type','priority','integer']                    │
            ▲                                              │
            │ z (membership)                               │
            │                                              │
  ┌─────────┴──────────────────────────────────────────────┴───┐
  │  settings item — kind 39999, authored by the engine        │
  │  ['d','github-accounts-settings']                          │
  │  ['z','39998:<engine>:search-index-settings']              │
  │  ['b','39998:b83a28b7…:github-accounts','pointer']  ← JOIN │
  │  ['priority','10']                                         │
  │  ['refresh-seconds','3600']                                │
  └────────────────────────────────────────────────────────────┘
```

## Why this shape and not another

- **The settings schema is itself in protocol.** The settings header declares its own
  required and optional fields, so a second engine reads the schema instead of your source.
- **Forking is built in.** `inherit-items` means "my list's items are the parent's, plus my
  own", so a second engine can inherit your settings list and override selectively. That is
  the multi-engine story, already ratified (`dlist-curation` ADR 0003).
- **Membership and configuration stay separable.** A list can be worth indexing with no
  settings item (defaults apply), and a settings item can exist for a list that later falls
  out of the index set. Neither breaks the other.

## Caveat

Firmware-seeded `b` tags are rebuilt on reinstall — never-clobber is within-run only, so a
reinstall restores firmware defaults. Hand-authored settings items are ordinary published
events and are unaffected, but do not rely on firmware to maintain them.

---

# PART 3 — LATER. Field types as a DList (W18). Portable actions, not portable rendering.

## The rejected option, stated plainly

Shipping HTML snippets or templates over nostr for an engine to render is an **injection
surface**: whoever authors the template controls markup in the viewer's browser, and the
trust model is the same permissionless publishing model the rest of this design depends on.
It also couples every engine to one markup and CSS convention, which defeats the interop
goal that motivated putting configuration in protocol at all.

Worksheet W18 already reached the better answer, and its title is the rule: **portable
actions, not portable rendering**.

## The shape

The `field-type` vocabulary becomes a DList in its own right. A type is an item; its
declared fields say what an engine may *do* with a value, not how to draw it.

```
  field-types                                github-accounts
  39998:<TA>:field-types                     ['field-type','github-username','url']
    ['required','type-name']                                  │
    ['optional','url-template']                               │ (type-name lookup)
    ['optional','description']                                ▼
            ▲                            ┌─────────────────────────────────┐
            │ z                          │ type item: kind 39999           │
            └────────────────────────────│ ['d','url']                     │
                                         │ ['z','39998:<TA>:field-types']  │
                                         │ ['type-name','url']             │
                                         │ ['url-template',                │
                                         │   'https://github.com/{value}'] │
                                         └─────────────────────────────────┘
```

A type an engine does not recognize **degrades to text**. That is the property that makes
the vocabulary extensible without coordination.

Note that the url-template belongs with the *field declaration on the list header*, not
with the generic type, when the template is list-specific: `github-username` on
`github-accounts` resolves to `https://github.com/{value}`, but a `url`-typed field on some
other list resolves differently. The type says "this is a link"; the list says "here is how
to build it". Exact placement is the open question W18 tracks.

## What each engine keeps local

Markup, CSS, layout, result-card design, ranking. The meaning travels; the rendering does
not. Two engines reading the same list produce visually different results from identical
protocol data, which is the correct outcome.

## Dependency

Part 3 is independent of Part 2 and could land first. It is also the part most likely to
need a real NIP conversation, since `field-type` is currently a client convention observed
in the wild rather than a specified tag (W17).

---

## Summary of the division

| Part | What | When | Blocked on |
|---|---|---|---|
| 1 | Membership by tagging the header; consume the 30394 | **Now** | nothing — verify the 39998 target read path |
| 1b | Read tab label + schema from the target header | **Now** | nothing |
| 2 | Extrinsic config in a settings DList joined by `b` | Later | a second engine existing |
| 3 | Field types as a DList with url-template affordances | Later | W17/W18 spec work |

The near-term commitment is small: tag one header, aggregate under a one-pubkey POV,
subscribe to one replaceable event, and read the target header for labels and schema.
Everything else is deliberately deferred, and nothing in Part 1 forecloses it.
