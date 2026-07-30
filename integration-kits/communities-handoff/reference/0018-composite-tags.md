# ADR 0018: Composite tags — symmetric multi-constituent composition + per-constituent rollup channel

**Status:** Proposed
**Date:** 2026-07-09
**Story:** _(none yet — protocol design draft; to be ratified via the protocol-spec workflow into `protocols/drafts/event-taggings.md`)_

## Context

Today a tag is applied to an event by an **assertion** (kind-39999) whose `z` descriptor points, indirectly, at a per-tag `tagging-with-specific-tag` header, which in turn `a`-tags a **tag-element** (kind-39999) that joins the `tag` concept (kind-39998). One tag, one target, one asserter → one addressable stance (`event-tag-<slug>-<target8>-<asserter8>`). See ADR event-tagging/0001 and `protocols/drafts/event-taggings.md`; wire builders at `src/lib/event-tagging/builders.js`, handle composers at `src/lib/event-tagging/handles.js`.

**The gap.** Users want to say "these two tags belong together" — e.g. **`bitcoin` + `lfo`** — as a first-class, browsable thing, *without* collapsing the two tags into one and *without* losing either tag's independent existence. Two motivating reads:

1. **A scoped slice.** The `bitcoin` tag is enormous; the community **LFO** wants "the bitcoin stuff LFO cares about" as its own browsable surface.
2. **A rollup.** Someone browsing the global `bitcoin` tag optionally wants to *also* see notes that were tagged bitcoin **as part of a composite**, distinguished from standalone bitcoin taggings.

Three hard constraints shape the design:

- **A naive intersection is wrong** (not just imprecise). If Steve (a rando) tags note N `bitcoin` and Bob (an LFO member) tags N `lfo`, the set-intersection `bitcoin ∩ lfo` falsely surfaces N as "LFO's bitcoin" even though nobody asserted the *pairing*, and even though LFO's own bitcoin authority (Rachel) may dispute that N is bitcoin at all. The pairing must be an **explicit, single assertion**, not an inferred coincidence.
- **The single-tag lifecycle must survive.** The replaceable-event `d`-tag gives "one live stance per (tag, target, asserter)" with independent apply/dispute/retract. Any composite that smuggles two tags into one assertion whose `d` names only one of them breaks retraction, addressing, and counting (this is the rejected Option B below).
- **Relays cannot traverse.** Per NIP-01, relays index only **single-letter tags** (`z`, `a`, `e`, `p`, `d`…) and a filter can only OR over an **enumerable list of values** for one such tag. There are no joins and no reference-following: a relay cannot answer "find assertions pointing at headers that point at bitcoin." So any set we want to retrieve in **one** query must be reachable by a **directly-carried, indexed tag value**. This is the decisive argument for a denormalized discovery channel (below).

**POV framing (unchanged, invariant #1/#3).** Whether any assertion "counts" is a per-POV, read-time WoT computation (`src/api/event-tags/index.js`, `povResolution` via `src/api/_shared/povStatus.js`). Composite tags change **discoverability**, not trust evaluation — the POV gate runs on composite assertions exactly as on any assertion. Note the shipped gate is a **binary** rank threshold with **flat** apply/dispute counting (rank magnitude discarded; `event-tags/index.js:115-125`, `src/lib/event-tagging/classify.js:119-123`). Composite tags neither need nor provide rank-weighting; that is a separate concern (out of scope).

## Options considered

### Option A — Two independent tags, intersect at read time
Keep `bitcoin` and `lfo` fully separate; compute "LFO's bitcoin" as `bucket(bitcoin) ∩ bucket(lfo)`.
- **Pros:** zero new protocol; tags stay independent.
- **Cons:** (1) surfaces the Steve/Bob coincidence — no one asserted the *pairing*; (2) the relay cannot express the intersection in one query (two `#z` scans + client-side set-intersect); (3) no first-class "bitcoin+lfo" object to browse or dispute. **Rejected** — the pairing is real information that must be *asserted*, not inferred.

### Option B — One assertion carrying two descriptor `z`s ("composite assertion")
A single assertion with `z → tagging:bitcoin-tagging` **and** `z → tagging:lfo-tagging`.
- **Pros:** one event; appears in both plain buckets via `#z`; no new concept.
- **Cons:** its `d` (`event-tag-bitcoin-…`) names one slug while asserting two → **breaks single-stance addressing, retraction (one `polarity` for both), and counting** (a `d`-keyed reader and a `#z`-keyed reader disagree). To fix the `d` you'd give it a composite slug — which *is* Option C's semantics anyway. **Rejected** — the cheap-looking path needs `d`-scheme surgery.

### Option C — Composite **tag-element** (multi-`a`) + per-constituent **rollup channel** _(chosen)_
A composite is a **first-class tag-element** whose identity is its set of constituents (multiple `a`-tags), addressed by the alphabetically-canonical join of constituent slugs. It gets a normal per-tag header and bucket — so it is browsed, applied, and disputed **exactly like any tag**, single-stance lifecycle intact. Separately, a **denormalized discovery channel** (`composite-tagging-components`, a new kind-39998) lets a constituent's global view roll up composite usage in **one indexed query**.
- **Pros:** the pairing is one explicit, atomically-disputable assertion (Steve's standalone bitcoin never enters the composite bucket); the composite *bucket* needs **zero read-path changes** (it's just a tag with a `+` in its slug); the rollup is a single `#z` OR-filter; display suppression of constituents on the target note is automatic.
- **Cons:** more published plumbing per composite (element + header + N component headers); write-side relay-index growth; commits to symmetric (unordered) composites; a new firmware concept ⇒ reinstall.

## Decision

**Option C.** Model a composite as a **tag-element with ≥2 `a`-tags to its constituents**, alphabetically canonicalized, carrying a normal `tagging-with-specific-tag` header and bucket. Add one new firmware concept, **`composite-tagging-components`** (kind-39998), and a per-constituent **component header** channel that composite assertions additively point at, so a constituent's standalone bucket and its composite usage can be unioned in a single relay query.

Rationale: it is the only option that (a) makes the pairing an **explicit single stance** (defeating the Steve/Bob false-positive structurally rather than by trust), (b) **preserves the single-tag lifecycle** (the composite is a tag), and (c) turns the "all bitcoin incl. composites" rollup into a **single indexed query** — the one thing the relay model demands we denormalize for, because it *cannot* traverse.

## Normative wire shapes

Notation: `TA_c` = canonical TA pubkey; `TA_l` = this deployment's runtime TA. Concept `z`-tags are **dual** (`[TA_c, TA_l]`, deduped, order-preserved) exactly as `conceptZTags` already emits (`builders.js:45-57`). Annotations after `//` are illustrative — strip for literal events.

### Canonicalization (symmetric, non-directional)
- Compute each constituent's slug with the existing `slug()` (`src/lib/event-tagging/slug.js`) → constituent slugs are `[a-z0-9-]` only.
- **Composite slug** = `constituentSlugs.sort().join('+')`. The `+` is a **reserved separator**: `slug()` maps every non-alphanumeric to `-` and so never emits `+`, making the split unambiguous. Do **not** run the joined string back through `slug()`.
- **≥2 distinct constituents**; dedupe; a 1-constituent "composite" normalizes to the plain tag.
- Emit the composite element's `a`-tags in the **same sorted order** (determinism).
- The address is order-independent **by construction** ⇒ this scheme encodes *symmetric* "these belong together" only. Directional/typed relationships are explicitly **out of scope** (they would need a different address scheme — see Out of scope).

### 1. New concept — `composite-tagging-components` (kind-39998, TA-authored firmware)
The legitimacy authority for component headers, mirroring how `tagging-with-specific-tag` authorizes per-tag headers.
```
kind: 39998
pubkey: <TA_l>                                  // + a dual-author canonical copy per ADR community-reference/0031
tags:
  ["d", "composite-tagging-components"]
  ["names", "composite tagging component", "composite tagging components"]
  ["description", "Per-constituent header whose bucket collects taggings made via a composite tag that includes this constituent. Lets a constituent's standalone bucket roll up with its composite usage in one query."]
```
Addressable: `39998:<TA>:composite-tagging-components`. (The pre-existing `tag`, `nostr-event-tag`, `tagging-with-specific-tag` concepts are unchanged.)

### 2. Composite tag-element (kind-39999) — the "these belong together" object
```
kind: 39999
pubkey: <composer>
tags:
  ["d", "bitcoin+lfo"]                          // sort("bitcoin","lfo")
  ["z", "39998:<TA_c>:tag"]                     // dual-z: joins the tag concept like any tag
  ["z", "39998:<TA_l>:tag"]
  ["a", "39999:<author-bitcoin>:bitcoin"]       // constituent 1 (sorted order)
  ["a", "39999:<author-lfo>:lfo"]               // constituent 2
  ["z", "tag-for-nostr-event"]                  // applicability hint (existing mechanism)
  ["z", "tag-composite"]                        // NEW pubkey-free hint ⇒ enumerable via one #z filter
content: {"tag":{"slug":"bitcoin+lfo","name":"Bitcoin + LFO","description":"…"}}
```
**Backward-compat property:** to a composite-*unaware* `tag`-concept processor this is an ordinary tag whose slug happens to contain `+`. The composite structure lives entirely in the `a`-tags (wire), not in `content`; composite-aware clients read the `a`-tags. The `≥2 a`-tags are the definition; `tag-composite` is a convenience hint for enumeration.

### 3. Composite per-tag header (kind-39999) — **unchanged shape**, composite slug
This is a plain `buildTaggingHeader({ slug: "bitcoin+lfo", … })`. No new fields.
```
kind: 39999
pubkey: <composer>
tags:
  ["d", "tagging:bitcoin+lfo-tagging"]
  ["names", "bitcoin+lfo tagging", "bitcoin+lfo taggings"]
  ["description", "Notes tagged as Bitcoin + LFO"]
  ["z", "39998:<TA_c>:tagging-with-specific-tag"]
  ["z", "39998:<TA_l>:tagging-with-specific-tag"]
  ["a", "39999:<composer>:bitcoin+lfo"]         // points at the composite element (§2)
content: ""
```
Because `d` matches the existing `DESCRIPTOR_RE = /^39999:[0-9a-f]{64}:tagging:.+-tagging$/` (`event-tags/index.js:54`), **the composite bucket works in the current read path with no changes** — it is "just a tag."

### 4. Component headers (kind-39999) — the rollup channel, **new namespace**
One per constituent, **published at an honored authority** so its coordinate is canonically derivable (see Consequences). Distinct `d` (`component:<slug>`) → no collision with the standalone `tagging:<slug>-tagging` header, and pattern-distinguishable.
```
kind: 39999
pubkey: <TA_l>                                  // honored authority (dual-authored with <TA_c> for federation)
tags:
  ["d", "component:bitcoin"]
  ["names", "bitcoin (as composite constituent)", "bitcoin (as composite constituent)"]
  ["description", "Taggings applied via a composite tag that includes bitcoin."]
  ["z", "39998:<TA_c>:composite-tagging-components"]   // legitimacy: member of the new concept
  ["z", "39998:<TA_l>:composite-tagging-components"]
  ["a", "39999:<author-bitcoin>:bitcoin"]             // points at the standalone bitcoin element
content: ""
```
Addressable: `39999:<TA>:component:bitcoin`. It is per-**constituent** (shared across every composite that includes bitcoin), not per-composite.

### 5. Composite assertion (kind-39999) — one atomic stance, additive discovery `z`s
```
kind: 39999
pubkey: <asserter>
tags:
  ["d", "event-tag-bitcoin+lfo-<target8>-<asserter8>"]  // single stance for the COMPOSITE
  ["e", "<note-id>", "<relay-hint?>"]                    // or ["a", <coord>] for an addressable target
  ["z", "39998:<TA_c>:nostr-event-tag"]                 // dual-z classifying (unchanged)
  ["z", "39998:<TA_l>:nostr-event-tag"]
  ["z", "39999:<composer>:tagging:bitcoin+lfo-tagging"]  // PRIMARY descriptor → composite bucket (§3)
  ["z", "39999:<TA>:component:bitcoin"]                  // ADDITIVE rollup → bitcoin constituent (§4)
  ["z", "39999:<TA>:component:lfo"]                      // ADDITIVE rollup → lfo constituent
  ["polarity", "1"]
content: ""
```
The **primary descriptor** makes this a `bitcoin+lfo` tagging — atomic, disputable as a unit via a `-1` on the same `d`. The **component `z`s** are additive: they matter only to the rollup query (§ Read-path). They match a new `COMPONENT_RE`, **not** `DESCRIPTOR_RE`, so the for-event classifier ignores them for per-note display (§ Read-path) — the note shows only `bitcoin+lfo`.

## Worked example — the whole shebang

Three base tags (**bitcoin**, **gardening**, **lfo**) and two composites (**bitcoin+lfo**, **gardening+lfo** — note `lfo` is shared; both canonicalize alphabetically). Concrete pubkeys:

| Role | Pubkey (64-hex) |
|---|---|
| Canonical TA (`TA_c`) | `82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833` |
| Local TA (`TA_l`, honored authority) | `2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b` |
| Alice (authored `bitcoin`) | `a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1` |
| Bob (authored `lfo`, `gardening`, both composites) | `b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0` |
| Carol (asserter) | `c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0c0` |
| Note N (kind-1 target) | `feed1234feed1234feed1234feed1234feed1234feed1234feed1234feed1234` |

`target8 = feed1234`, Carol's `asserter8 = c0c0c0c0`.

**A. Base tag-elements** (existing shape — 3 events):
```
{kind:39999, pubkey:a1a1…, tags:[["d","bitcoin"],   ["z","39998:82b7…:tag"],["z","39998:2b2b…:tag"],["z","tag-for-nostr-event"]], content:"{\"tag\":{\"slug\":\"bitcoin\",\"name\":\"Bitcoin\"}}"}
{kind:39999, pubkey:b0b0…, tags:[["d","gardening"], ["z","39998:82b7…:tag"],["z","39998:2b2b…:tag"],["z","tag-for-nostr-event"]], content:"{\"tag\":{\"slug\":\"gardening\",\"name\":\"Gardening\"}}"}
{kind:39999, pubkey:b0b0…, tags:[["d","lfo"],       ["z","39998:82b7…:tag"],["z","39998:2b2b…:tag"],["z","tag-for-nostr-event"]], content:"{\"tag\":{\"slug\":\"lfo\",\"name\":\"LFO\"}}"}
```

**B. New firmware concept** (1 event):
```
{kind:39998, pubkey:2b2b…, tags:[["d","composite-tagging-components"],["names","composite tagging component","composite tagging components"],["description","Per-constituent rollup header."]]}
```

**C. Composite tag-elements** (2 events — multi-`a`, sorted):
```
{kind:39999, pubkey:b0b0…, tags:[
   ["d","bitcoin+lfo"],
   ["z","39998:82b7…:tag"],["z","39998:2b2b…:tag"],
   ["a","39999:a1a1…:bitcoin"],["a","39999:b0b0…:lfo"],
   ["z","tag-for-nostr-event"],["z","tag-composite"]],
 content:"{\"tag\":{\"slug\":\"bitcoin+lfo\",\"name\":\"Bitcoin + LFO\"}}"}

{kind:39999, pubkey:b0b0…, tags:[
   ["d","gardening+lfo"],
   ["z","39998:82b7…:tag"],["z","39998:2b2b…:tag"],
   ["a","39999:b0b0…:gardening"],["a","39999:b0b0…:lfo"],
   ["z","tag-for-nostr-event"],["z","tag-composite"]],
 content:"{\"tag\":{\"slug\":\"gardening+lfo\",\"name\":\"Gardening + LFO\"}}"}
```

**D. Composite per-tag headers** (2 events — standard shape, composite slug):
```
{kind:39999, pubkey:b0b0…, tags:[["d","tagging:bitcoin+lfo-tagging"],  ["names","bitcoin+lfo tagging","bitcoin+lfo taggings"],  ["description","Notes tagged as Bitcoin + LFO"],  ["z","39998:82b7…:tagging-with-specific-tag"],["z","39998:2b2b…:tagging-with-specific-tag"],  ["a","39999:b0b0…:bitcoin+lfo"]]}
{kind:39999, pubkey:b0b0…, tags:[["d","tagging:gardening+lfo-tagging"],["names","gardening+lfo tagging","gardening+lfo taggings"],["description","Notes tagged as Gardening + LFO"],["z","39998:82b7…:tagging-with-specific-tag"],["z","39998:2b2b…:tagging-with-specific-tag"],["a","39999:b0b0…:gardening+lfo"]]}
```

**E. Component headers** (3 events — one per distinct constituent: bitcoin, gardening, lfo; `lfo` is shared by both composites):
```
{kind:39999, pubkey:2b2b…, tags:[["d","component:bitcoin"],  ["names","bitcoin (composite constituent)","…"],  ["description","Taggings via a composite that includes bitcoin."],  ["z","39998:82b7…:composite-tagging-components"],["z","39998:2b2b…:composite-tagging-components"],  ["a","39999:a1a1…:bitcoin"]]}
{kind:39999, pubkey:2b2b…, tags:[["d","component:gardening"],["names","gardening (composite constituent)","…"],["description","Taggings via a composite that includes gardening."],["z","39998:82b7…:composite-tagging-components"],["z","39998:2b2b…:composite-tagging-components"],["a","39999:b0b0…:gardening"]]}
{kind:39999, pubkey:2b2b…, tags:[["d","component:lfo"],      ["names","lfo (composite constituent)","…"],     ["description","Taggings via a composite that includes lfo."],     ["z","39998:82b7…:composite-tagging-components"],["z","39998:2b2b…:composite-tagging-components"],     ["a","39999:b0b0…:lfo"]]}
```

**F. Composite assertions** by Carol on Note N (2 events):
```
{kind:39999, pubkey:c0c0…, tags:[
   ["d","event-tag-bitcoin+lfo-feed1234-c0c0c0c0"],
   ["e","feed1234feed1234feed1234feed1234feed1234feed1234feed1234feed1234"],
   ["z","39998:82b7…:nostr-event-tag"],["z","39998:2b2b…:nostr-event-tag"],
   ["z","39999:b0b0…:tagging:bitcoin+lfo-tagging"],     // primary → composite bucket
   ["z","39999:2b2b…:component:bitcoin"],               // rollup → bitcoin
   ["z","39999:2b2b…:component:lfo"],                   // rollup → lfo
   ["polarity","1"]]}

{kind:39999, pubkey:c0c0…, tags:[
   ["d","event-tag-gardening+lfo-feed1234-c0c0c0c0"],
   ["e","feed1234feed1234feed1234feed1234feed1234feed1234feed1234feed1234"],
   ["z","39998:82b7…:nostr-event-tag"],["z","39998:2b2b…:nostr-event-tag"],
   ["z","39999:b0b0…:tagging:gardening+lfo-tagging"],   // primary → composite bucket
   ["z","39999:2b2b…:component:gardening"],             // rollup → gardening
   ["z","39999:2b2b…:component:lfo"],                   // rollup → lfo
   ["polarity","1"]]}
```

**G. The reads these enable** (POV-filtered at read time as always):

1. **"LFO's bitcoin"** = the composite bucket, one query, no rollup channel involved:
   ```
   {kinds:[39999], "#z":["39999:b0b0…:tagging:bitcoin+lfo-tagging"]}
   ```
   Steve's standalone `bitcoin` tagging is **not** here — he never asserted the pairing. Rachel disputes it with a `-1` on `d=event-tag-bitcoin+lfo-<t8>-<rachel8>`.

2. **"All bitcoin, standalone + within composites"** = one batched indexed OR-filter (the relay-indexing payoff):
   ```
   {kinds:[39999], "#z":["39999:<A>:tagging:bitcoin-tagging",   // standalone bucket
                         "39999:2b2b…:component:bitcoin"]}       // + composite usage
   ```
   Both Carol's `bitcoin+lfo` assertion (via `component:bitcoin`) and any standalone bitcoin taggings return in a single round trip.

3. **"Just standalone bitcoin"** = the plain bucket only (`…:tagging:bitcoin-tagging`) — composites excluded.

4. **for-event on Note N** returns two counted tags — `bitcoin+lfo` and `gardening+lfo` — and **not** phantom standalone `bitcoin`/`gardening`/`lfo`, because the component `z`s don't match `DESCRIPTOR_RE`.

## Read-path integration

Concrete seams in `src/api/event-tags/index.js` + `src/lib/event-tagging/classify.js`:

- **Composite bucket: no change.** `tagging:bitcoin+lfo-tagging` matches `DESCRIPTOR_RE`; `handleForEvent`/`for-tag`/`classifyEventTaggings` treat it as an ordinary header. The composite "just works" today.
- **for-event display suppression (new, additive):** add `COMPONENT_RE = /^39999:[0-9a-f]{64}:component:.+$/`. In the descriptor-collection loop (`index.js:159-162`), component `z`s are gathered into a **separate** set, resolved against honored `composite-tagging-components` authorities, and surfaced as **provenance** ("also rolls up under bitcoin, lfo") — never as counted standalone tags. Since the loop already keys counted tags on `DESCRIPTOR_RE`, component `z`s are ignored for the counted set with **no change** to existing logic.
- **for-tag rollup (new, opt-in):** a `?includeComposites=1` mode on the notes-for-tag read unions `39999:<honoredAuthority>:component:<slug>` into the `#z` filter alongside `taggingHeaderAddr(<A>, slug)`. `<honoredAuthority>` comes from the existing `resolveAuthorities(req)` (`index.js:98-107`) — same sovereignty model.
- **Honoring (mirrors the existing gate):** a component membership counts only if the component header is itself a member of an honored `composite-tagging-components` authority (author-agnostic legitimacy-by-membership, exactly like `tagging-with-specific-tag` honoring at `classify.js:84-90`).
- **POV unchanged:** composite and component assertions pass through `buildTrustPredicate`/`trustPredicateFor` identically; `povResolution` disclosure is unaffected.
- **New core builders** (`src/lib/event-tagging/`): `buildCompositeTagElement({ constituents:[{author,slug}], taPubkeys, applicabilityZ })`, `buildComponentHeader({ authorityPubkey, constituent:{author,slug}, taPubkeys })`, and a `components:[…]` option on `buildEventTaggingAssertion` that appends `['z', '39999:<A>:component:<slug>']` per constituent. New handle composers `compositeSlug(slugs)`, `componentHeaderAddr(authority, slug)`, `conceptCompositeTaggingComponents(taPubkey)`.

## Consequences

- **Enables** explicit, first-class "these tags belong together" objects that are browsed/applied/disputed as ordinary tags (single-stance lifecycle preserved), plus single-query constituent rollups. Defeats the Steve/Bob false-intersection **structurally** (the pairing must be asserted), independent of trust weighting.
- **Firmware reinstall required? Yes** — one new concept (`composite-tagging-components`) is seeded (per AGENTS.md §6). The three existing concepts are untouched.
- **Canonical component authorship is required for the single-query rollup.** For a reader to *construct* `39999:<A>:component:bitcoin` without a discovery hop, the component header must live at an honored authority. The write path publishes/refreshes it there idempotently (replaceable event) on first composite creation. If component headers were arbitrarily authored, the rollup would degrade to a discovery hop (`#a` on the constituent element filtered by `composite-tagging-components`) — correct but multi-round-trip. **We accept the honored-authorship constraint** as the price of the one-query rollup.
- **Write-side index growth:** each composite adds an element + header + up to N component headers (shared per constituent, so amortized), and each composite assertion carries N extra indexed `z`s. Bounded; the trade is write-side index for read-side single-query, and reads dominate.
- **Symmetric-only commitment:** alphabetical canonicalization makes the address order-independent, so directional/typed composites are *unrepresentable* in this scheme by design. Chosen deliberately for v1 ("these are together, somehow").
- **Combinatorial discipline (invariant #3):** composites are *minted concepts*. They are justified only when the pairing is itself a thing users browse — **not** as a substitute for two independent taggings. Do not auto-mint a composite for every co-occurrence; that reintroduces the N-choose-K explosion the invariants warn against. The rollup channel, by contrast, is bounded (one component header per constituent).
- **Backward compatible:** composite-unaware `tag`-concept processors see an ordinary tag with a `+` slug; composite-unaware read paths see an ordinary bucket. Only the rollup and per-note provenance are new.

## Out of scope

- **Directional / typed relationships** between tags (e.g. "bitcoin *implies* lfo") — needs a non-symmetric address scheme; separate ADR.
- **Rank-weighted / topical trust** (letting an LFO bitcoin-authority's dispute outweigh casual applies) — orthogonal; the shipped gate is binary + flat (noted in Context). Tracked separately.
- **Product surfaces** — the compose-tags picker, how a composite renders on a note, the "include composites" toggle. This ADR is protocol-only; UI is a downstream story.
- **N-ary ergonomics beyond 2** — the wire supports ≥2 constituents; authoring/rendering affordances for 3+ are deferred.
- **Ratifying into `protocols/drafts/event-taggings.md`** and out of `drafts/` — via the protocol-spec workflow.
