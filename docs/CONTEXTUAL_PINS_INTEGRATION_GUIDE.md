# Contextual Pins — Integration Guide (Read Side)

**Audience:** a developer (or an agent writing code on their behalf) building a Nostr client
that renders a **context-scoped set of tag chips** on an events feed — chips that are exactly
the tags a community has curated, populated dynamically from Nostr.

**What you're integrating:** a read-only view over a small, permissionless Nostr protocol built
on the Tapestry / Brainstorm concept-graph. If you already filter pubkeys, events, and taggings
client-side, this guide is mostly about the **pin / Trusted-List** layer — what a "contextual
pin" is, where the events live, and the exact relay queries to locate and read them.

Everything here is ordinary signed Nostr events on relays. There is no required server API; any
HTTP endpoints mentioned are optional conveniences if you happen to be talking to a Tapestry
instance.

**Placeholders used throughout:**
- `<CTX>` — the context **slug** (a short `[a-z0-9-]` handle for the community/topic scope).
- `<CTX_NS>` — the **namespace pubkey** that qualifies the context coordinate (see §5.0; it is
  the deployment's Tapestry-Assistant pubkey when interoperating, or a key you control when
  standalone).
- `CONTEXT_COORD` = `"39998:<CTX_NS>:<CTX>"` — the context's coordinate; the value you filter on.
- `<TA>` — a deployment's runtime Tapestry-Assistant pubkey. `<LEGACY_TA>` =
  `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833` (a lineage constant used
  only for the base `tag` / `tag-pinning` concept stamps). `<8>` = first 8 hex chars of a pubkey.

**Concrete examples** used throughout for readability (all generic — substitute your own):
the context slug `english-speaking-nostr` (a sibling might be `german-speaking-nostr`); users
**Alice** and **Bob** (as pinners / feed viewers); the tag `bitcoin`. So a fully-worked context
coordinate reads `39998:<TA>:english-speaking-nostr`, and a pinned-tag chip reads `bitcoin`.

---

## 1. The mental model (read this first)

### 1.1 Concepts and elements are "dlists" (kind 39998 / 39999)

Tapestry models knowledge as a graph of **concepts**. Two Nostr kinds carry it:

- **kind 39998 — a concept header** ("dlist header"): the *name/anchor* of a category
  (`tag`, `nostr-user-tag`, `tag-pinning`, and — here — community **contexts**). Addressable.
- **kind 39999 — an element / assertion**: the *members and claims* (an individual tag, a
  tagging of a note, a pin). Addressable. An element declares which concept it belongs to via
  one or more **`z` tags** (see §1.5).

A concept header is addressed by its **coordinate** `39998:<AUTHOR>:<slug>`. For firmware
concepts the author is a deployment's **Tapestry Assistant (TA)** pubkey. So the `tag` concept
is `39998:<TA>:tag`, and a context is `39998:<CTX_NS>:<CTX>`.

### 1.2 Tags and taggings

- A **tag** is a kind-39999 element (`39999:<author>:<slug>`) joining the `tag` concept. Anyone
  can mint one; slugs are per-author (two people can each have a `bitcoin` tag).
- A **tagging** is a kind-39999 assertion applying a tag to a target — a **note** (`e` tag) or
  a **profile** (`p` tag) — with a `polarity` (`1` apply / `-1` dispute) and `z` tags
  classifying it.

Publishing is **permissionless**; all curation happens at **read time**, per point-of-view.

### 1.3 Point-of-view (POV) and Web of Trust (WoT) — trust is a read-time filter

There is **no global "the view."** Every count/ranking/"does this count?" is answered **from a
specific POV**, identified by a delegate pubkey. Mechanically, profile docs carry POV-namespaced
trust columns (`wot_rank_<suffix>`); a tagging **counts** for a POV only if its author clears
that POV's rank threshold. A tag/tagging that exists on the relay can be *invisible* from a
given POV — by design. **You bring your own filter; you decide whose assertions count.**

### 1.4 Pins and Trusted Lists (TLs) — and why they're *per-user*

A **pin** is a user opting a tag into their personal *curated set* ("I vouch for this tag;
materialize its trusted members into a durable list"). A pin is a kind-39999 event (§3.2).

Each pin is periodically **materialized** by a Tapestry instance's TA into **Trusted Lists** —
TA-signed, addressable snapshots of the tag's curated members **under that pinner's POV and
curation knobs**:

- **kind 30392 — profile TL** (`p`-tag members: trusted profiles tagged with the tag).
- **kind 30393 — note TL** (`e`-tag members: trusted notes tagged with the tag).

> **Load-bearing point: pins and TLs are per-observer.** A pin's `curation-method.observer` is
> the pinner, and that observer appears in **every** TL's `d`-tag. So if Alice and Bob both pin
> `bitcoin` into `english-speaking-nostr`, there are **two** pins and **two** note TLs
> (`tl-pin-notes-<Alice8>-…-bitcoin-in-english-speaking-nostr` and `tl-pin-notes-<Bob8>-…`), each
> computed under a **different** POV and each carrying that pinner's own `cutoff` / method. There
> is no single "the context's TL." This is exactly what lets a feed range from *one shared
> curation* to *per-user algorithms* (§7) by changing only **whose pins you read**: read Alice's
> pins and the viewer sees Alice's curation; read Bob's and they see Bob's.

### 1.5 Stamping — how an element joins a concept, and how contexts work

An element declares membership by **stamping** itself with `z` tags naming concept handle(s).
The convention permits **multiple `z`** on one event, so a relay `#z` filter finds "every
element in concept C" in one query. A **context** is just another kind-39998 concept; a pin
**joins a context** by carrying an **additional `z` stamp** naming the context coordinate. That
extra stamp is the entire feature: it turns the relay's `#z` index into a discovery channel for
"pins contributed to this context." (A context is conceptually a lightweight *proto*
Community-Declaration; full communities are a separate, larger spec.)

---

## 2. What "contextual pins" are, precisely

> A **contextual pin** is an ordinary tag-pin that additionally carries a `z` stamp naming a
> context concept. It is **first-class and independent**: a user can hold a *neutral* pin of a
> tag **and** a context pin of the same tag **and** a different-context pin of it, all at once —
> each with its own identity, its own TLs, its own curation. They coexist.

Consequences you'll use:

1. **Discovery is one indexed query:** `{ kinds:[39999], "#z":[CONTEXT_COORD] }`.
2. **The pin points at the context; the context does not enumerate the pins.** The context
   concept is a bare anchor — you never read it to find pins; you scan for pins that *stamp* it.
   Membership is derived on read, never stored, so it can't go stale.
3. **Affiliation is explicit.** A pin is in a context only because its author *chose* to stamp
   it. A neutral pin of the same tag is **not** in the context and won't appear in the scan.

---

## 3. Wire shapes (exact)

### 3.1 The context concept — kind 39998 (rarely fetched; it's just the anchor)
```jsonc
{ "kind": 39998, "pubkey": "<CTX_NS>",
  "tags": [ ["d","<CTX>"], ["names","...","..."], ["description","..."] ] }
```
Coordinate `39998:<CTX_NS>:<CTX>` = `CONTEXT_COORD`. You only need the *coordinate string* to use
as a `#z` filter value; fetch the event only if you want a display name for the header. (It need
not even exist as a published event for the `#z` index to work — §5.0.)

### 3.2 A contextual pin — kind 39999 (the event you scan for)
```jsonc
{
  "kind": 39999,
  "pubkey": "<pinnerPubkey>",
  "tags": [
    ["d", "tag-pin-<slug>-<tagAuthor8>-<pinner8>-in-<CTX>"], // replaceable identity; "-in-<CTX>" = contextual
    ["e", "<tagEventId>"],                                    // provenance
    ["a", "39999:<tagAuthor>:<slug>"],                        // ← THE PINNED TAG. This is your chip.
    ["z", "39998:<LEGACY_TA>:tag-pinning"],                   // base stamp — identifies this as a pin
    ["z", "<CONTEXT_COORD>"],                                 // ← CONTEXT STAMP — your discovery channel
    ["curation-method", "{\"observer\":\"<pinner>\",\"method\":\"nip85:rank\",\"cutoff\":1,\"targetTypes\":[\"profile\",\"note\"],\"noteMethod\":\"notes:net-endorsed\"}"]
  ],
  "content": "{\"tagPinning\":{\"tagEventId\":\"<tagEventId>\",\"curationMethod\":{...}}}"
}
```
- A **neutral** pin is identical but has no context `z` and no `-in-<CTX>` in its `d`.
- kind 39999 is **parameterized-replaceable**: dedupe by `(pubkey, d)`, keep newest
  `created_at`. Unpin = NIP-09 kind-5 deletion targeting the pin's id.
- `curation-method.observer` = the **pinner**, and it drives which TL coordinates exist (§3.3).

### 3.3 The materialized Trusted Lists — kind 30392 (profiles) / 30393 (notes)

Signed by the **TA** (`pubkey = <TA>`), **one per pin per target-type** — i.e. one per
`(observer, tag, context)`.

Note TL (what a *notes* feed wants):
```jsonc
{
  "kind": 30393,
  "pubkey": "<TA>",
  "tags": [
    ["d", "tl-pin-notes-<observer8>-<tagAuthor8>-<slug>-in-<CTX>"],
    ["title", "<slug>"], ["metric", "pinned-tag-notes"],
    ["observer", "<observerPubkey>"],                  // the POV this list was computed under (= the pinner)
    ["a", "39999:<tagAuthor>:<slug>"], ["p", "<observerPubkey>"],
    ["e", "<noteId1>"], ["e", "<noteId2>"], "...",     // ← the curated trusted-tagged notes
    ["truncated", "<trueTotal>"]                       // present ⇒ list bounded; value = real total
  ],
  "content": "{\"notes\":[{\"id\":\"<noteId1>\",\"applications\":3,\"disputes\":0}, ...]}"
}
```
Profile TL (30392): same shape, `metric: "pinned-tag-membership"`, `d` =
`tl-pin-<observer8>-<tagAuthor8>-<slug>-in-<CTX>`, `p`-tag members. A **retracted** TL carries
`["status","retracted"]` with empty membership — treat as absent.

### 3.4 The d-tag scheme (compute coordinates yourself)

All share a **variant suffix**: empty for neutral, `-in-<CTX>` for contextual.

| purpose | kind | `d` pattern |
|---|---|---|
| pin event | 39999 | `tag-pin-<slug>-<tagAuthor8>-<pinner8><variant>` |
| profile TL | 30392 | `tl-pin-<observer8>-<tagAuthor8>-<slug><variant>` |
| note TL | 30393 | `tl-pin-notes-<observer8>-<tagAuthor8>-<slug><variant>` |

---

## 4. How it all fits together (one paragraph)

Anyone mints **tags** and **taggings**. A user **pins** a tag and, to contribute it to a
community, adds a **context stamp**. A Tapestry instance continuously **materializes** each pin
into TA-signed **Trusted Lists** — one per `(pinner, tag, context)` — snapshotting the tag's
trusted members under **that pinner's POV** and curation knobs. To render a context feed you
(a) `#z`-scan the context's pins → the **chip set** (the pinned tags), deciding **whose pins to
honor** (§5.3, §7), and (b) for each chip read either the **note TL** (pre-curated) or the raw
**taggings** (your own filtering). Trust is applied at read time — you choose whose pins and
whose taggings count.

---

## 5. Integration recipe — a context-scoped chip feed

Goal: render **chips = the tags pinned into the context** (by the pinners you honor), and under
each chip the notes tagged with that tag.

### 5.0 One-time setup — resolve `CONTEXT_COORD`

The context coordinate's namespace pubkey (`<CTX_NS>`) is a **choice** — the `#z` filter matches
it as an opaque string; the namespace need not be a running server, and the kind-39998 header
need not even exist for the index to work:

- **Interoperating with a Tapestry deployment** (so its users' pins and its materialization loop
  share your bucket): use **that deployment's TA pubkey** — `GET /api/assistant/pubkey` →
  `CONTEXT_COORD = "39998:<TA>:<CTX>"`.
- **Standalone** (no dependency on any instance): use **a key you control** as `<CTX_NS>`.

Whatever you choose, **writers and readers must use the same coordinate.** Hardcode the result.

### 5.1 Fetch the context's pins (the chip source)

```jsonc
{ "kinds": [39999], "#z": ["<CONTEXT_COORD>"] }
```
Then: **replaceable-dedupe** by `(pubkey, d)`; optionally honor **kind-5 deletions** (live
unpin); and **filter by pinner** per §5.3.

### 5.2 Derive the chip set

For each surviving pin, read its **`a` tag** — `39999:<tagAuthor>:<slug>`; `<slug>` is the chip.
**Dedupe by the `a`-coordinate** (many pinners → one chip). The result is your dynamic,
context-scoped chip set — it grows as honored pinners pin more tags.

### 5.3 Decide **whose pins** define the feed (the key product knob)

Because pins/TLs are per-pinner (§1.4), the chip set — and later the curation — is parameterized
by which pinners you honor. Pick per your product stage (§7):

- **A single curator** — e.g. Alice, the operator: chips = Alice's pinned tags. A fixed,
  editorially-controlled feed everyone sees.
- **A member set** — union the pins of a roster of pubkeys (Alice, Bob, …) → the community's chip
  set. Apply your member/pubkey filter to the pin **authors** here — this is also your spam gate
  (anyone can stamp a pin into a context; only honored pinners should form chips).
- **The logged-in user** — chips = Bob's own pinned tags when Bob is viewing → a personalized
  feed ("Bob's algorithm").

### 5.4 Populate content under a chip (two options)

**Option A — read the note TL (pre-curated, batteries-included).** For a chosen observer
(a pinner), read `{ "kinds":[30393], "authors":["<TA>"],
"#d":["tl-pin-notes-<observer8>-<tagAuthor8>-<slug>-in-<CTX>"] }`; its `e` tags are the curated
note ids. Pros: already curated under that pinner's POV; zero tagging logic. Cons: it's *that
pinner's* POV and *that pinner's* cutoff/method, it's a snapshot (staleness), and it may be a
lossy subset if you re-filter it.

**Option B — query taggings directly (full control; recommended if you already filter).** For
the chip's tag `39999:<tagAuthor>:<slug>`, find the note-taggings and apply **your own**
pubkey/tagging filter. This is live, complete, and under *your* trust model. The context scan
(§5.1–5.3) still supplies the **chips**; you supply the **content**. See §6 for why filtering
clients should prefer this.

### 5.5 Chip display metadata

The pin's `a` gives the slug. For a name/description, fetch the tag element
(`{ "kinds":[39999], "authors":["<tagAuthor>"], "#d":["<slug>"] }` → `content.tag.name`).

### 5.6 Reuse our derivation code — don't reinvent §5.2–5.3

The chip-derivation logic exists as **pure, dependency-free** functions in
`src/lib/event-tagging/` (the `@tapestry/event-tagging` module) — **no imports, no I/O**, so you
can **copy them verbatim** (CommonJS here; ESM/TS is a one-line change). Lifting them guarantees
your logic matches a Tapestry deployment exactly.

| function (`pins.js`) | signature → returns | use |
|---|---|---|
| `contextHandle` | `(nsPubkey, ctxSlug)` → `"39998:<ns>:<slug>"` | build `CONTEXT_COORD` |
| `pinVariantKey` | `({ contextSlug })` → `""` \| `"-in-<slug>"` | compose any pin/TL `d` suffix |
| `contextSlugOfPin` | `(pinEvent, nsPubkey)` → `slug` \| `null` | recover a pin's context (matches a known-slug set) |
| `contextPinsToTags` | `(pinEvents, { trustFilter })` → `[{ aCoord, tagSlug, tagAuthorPubkey }]` | **this IS §5.2–5.3**: dedupe context pins by tag a-coord + apply your injected pinner filter → the chip set |
| `KNOWN_CONTEXTS` | `[{ slug, name }, …]` | the offered context set; edit to yours |

```js
const { contextHandle, contextPinsToTags } = require('@tapestry/event-tagging'); // or your copy
const pins  = replaceableDedupe(REQ({ kinds:[39999], "#z":[ contextHandle(CTX_NS, CTX) ] }));
const chips = contextPinsToTags(pins, { trustFilter: isHonoredPinner });   // ← your pubkey filter, injected
```
`contextPinsToTags` is pure: it dedupes by the pinned tag's a-coordinate, drops authors your
`trustFilter` rejects, and returns `{ aCoord, tagSlug, tagAuthorPubkey }`. All I/O is yours and
injected — which is why it's portable.

> `contextSlugOfPin` only returns slugs in its `KNOWN_CONTEXT_SLUGS` set (from `KNOWN_CONTEXTS`)
> — deliberate, so the legacy base `tag-pinning` `z` is never mistaken for a context. Ensure
> your `KNOWN_CONTEXTS` contains `<CTX>`.

Also liftable if you take Option B: `curateNotes(notes, method, cutoff)` (`taggings.js`) — the
exact note curation the TLs use (`"notes:net-endorsed"` = apps>disputes, `"notes:most-applied"`;
`cutoff` = minimum trusted applications, `apps>=cutoff && apps>disputes`). Run it over your own
trust-filtered tagging counts to reproduce a pin's note list without reading its TL.

---

## 6. POV / trust — what you decide (and how client-side filtering simplifies it)

Two independent trust decisions, both yours: **which pins count** (who forms chips — §5.3) and
**which taggings count** (what shows under a chip — §5.4).

**If your client already filters pubkeys/events/taggings down to members, our POV/WoT is largely
redundant for you** — and reading a pre-curated TL can be *lossy* (its cutoff/POV may drop a
member tagging you'd keep, and you'd re-filter it anyway). So a member-filtering client should
prefer **Option B**: derive chips from the context scan (filter pin **authors** to members) and
content from raw taggings (filter to members). That yields a feed that is **live, spam-free, and
complete**, sidestepping our POV, our TLs, and any server dependency. Reach for the TLs (Option
A) only if you want a **pre-computed cache** (perf) or the **WoT rank *scores*** for ranking.

---

## 7. Recommended adoption path — from a fixed community feed to per-user algorithms

The chip set **and** the curation are parameterized by **whose pins the client reads** (§1.4,
§5.3). That single knob lets you grow the product without changing the protocol:

- **Phase 1 — Fixed community feed (hardcode).** Hardcode `CONTEXT_COORD`
  (`39998:<TA>:english-speaking-nostr`) and a **curation source** — say Alice, the operator, or a
  small seed set of members — whose pins define the chips. Every user sees the same feed. Content
  per chip = taggings filtered by your member roster (Option B) or the curator's TL (Option A).
  Simplest — ship this first.
- **Phase 2 — Per-user "take over your algorithm."** Let a logged-in user (Bob) publish **his
  own pins** into `english-speaking-nostr` (his tag choices + his `cutoff` / `noteMethod`). The
  client then reads **Bob's** pins → chips = Bob's pinned tags; content curated with Bob's knobs.
  **Each user sees a feed shaped by their own choices.** Same mechanism; you only changed which
  observer's pins you read. (Writing pins is user-signed and needs no server — see the write
  guide.)
- **Phase 2.5 — Blend.** Seed Bob from the community set (Alice's pins), let him add/remove/
  override: union the curator's pins with Bob's, Bob's taking precedence. "Based on the community,
  tuned by you."

Why this is nearly free: each pin already encodes its pinner's curation — **which** tags
(the ones they pinned), the **cutoff**, the **method**. So two users' pins yield two feeds with
no new machinery; the per-user TL is the *same* pin/TL system pointed at a different observer.
Users' feeds "differ slightly" precisely along those axes — included tags, curation cutoffs,
apply/dispute method.

---

## 8. Gotchas & invariants

- **Namespace pubkey is a choice, and per-deployment when interoperating — never hardcode a
  literal from another instance.** Resolve `<CTX_NS>` (§5.0). The base `tag-pinning`/`tag` stamps
  keep the `<LEGACY_TA>` lineage constant; only the *context* stamp is your namespace choice.
- **`#z` is the interop floor** — a plain scan returns *directly* stamped pins only; no
  sub-context expansion.
- **Dedupe twice:** pins by `(pubkey, d)`; chips by tag a-coordinate.
- **Per-observer everything.** There is no single "context TL"; each pinner has their own. When
  reading a TL you are choosing an observer. When forming chips you are choosing a set of
  pinners.
- **Neutral vs contextual coexist** — the scan sees only the context pins; don't reconcile.
- **TLs are snapshots, not live.** `["truncated", N]` ⇒ bounded, `N` = true total. Prefer Option
  B for "just now" freshness.
- **Retracted TLs** carry `["status","retracted"]` — treat as absent.
- **Unpin = deletion/replacement.** A tag leaves the chip set when its last honored contextual
  pin is gone; honor kind-5 deletions for live unpin.
- **`z` order is not meaningful** — match by value.

---

## 9. Quick reference

| Thing | Kind | How to find it |
|---|---|---|
| Context anchor | 39998 | coordinate `CONTEXT_COORD` (a `#z` value; rarely fetched) |
| Contextual pins in a context | 39999 | `{ kinds:[39999], "#z":["<CONTEXT_COORD>"] }` |
| The pinned tag (chip) | 39999 | the pin's `a`: `39999:<tagAuthor>:<slug>` |
| Tag display name | 39999 | `{ kinds:[39999], authors:["<tagAuthor>"], "#d":["<slug>"] }` → `content.tag.name` |
| Note TL (per pinner) | 30393 | `{ kinds:[30393], authors:["<TA>"], "#d":["tl-pin-notes-<obs8>-<tagAuthor8>-<slug>-in-<CTX>"] }` |
| Profile TL (per pinner) | 30392 | `{ kinds:[30392], authors:["<TA>"], "#d":["tl-pin-<obs8>-<tagAuthor8>-<slug>-in-<CTX>"] }` |
| Note-taggings for a tag | 39999 | your existing tagging query for `39999:<tagAuthor>:<slug>` |

**Minimum viable chip feed:** resolve `CONTEXT_COORD` → scan `#z:[CONTEXT_COORD]` → dedupe pins →
filter pin authors to your honored set → dedupe their `a`-tags → those are your chips → render
each chip's notes via your existing tagging filter.

---

*Read integration only. Writing pins/taggings, per-user pin generation, and the server boundary
are covered in the write-side companion guide.*
