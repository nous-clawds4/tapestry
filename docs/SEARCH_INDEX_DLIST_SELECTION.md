# Indexing DLists for search — target state

**Status:** 🟡 DESIGN TARGET — the consumer contract is settled; the pipeline that
produces it is not built. Nothing here is ratified.
**Created:** 2026-09-18 · **Revised:** 2026-09-18 (rev 2, after the design debate)
**Audience:** the Vespa-backed search backend (separate repo), and anyone else who wants to
subscribe to "which Decentralized Lists are worth indexing".
**Related:** [`protocols/worksheet.md`](../protocols/worksheet.md) W17 / W18; ADRs
`dlist-item-tagging/0001`–`0003`; `feat-tags-modernization/0001` and
`contextual-pins/0001` (pin composition);
[`protocols/drafts/trusted-lists.md`](../protocols/drafts/trusted-lists.md);
[`protocols/drafts/event-taggings.md`](../protocols/drafts/event-taggings.md);
BIBLE §22 / §25 (`b` tags, `REFERENCES`).

> **What rev 2 changed.** Rev 1 had the search backend read tagging assertions directly
> with an author filter, and treated the Trusted List as something to graduate to. That was
> wrong: it put a change at the consumer. Rev 2 makes **a Trusted List the sole consumer
> interface, permanently**, and moves every loosening into the pipeline behind it. Rev 1's
> author-filter approach survives only as the fallback if the pipeline work never happens.

---

## The problem

A search engine indexing nostr must decide, out of every Decentralized List in the
universe, which ones it cares about. "GitHub Accounts"
(`39998:b83a28b7…:github-accounts`) becomes a search tab the way `[shopping | images |
videos]` are tabs. On day one there is one such list and one engine.

The obvious answer is a config file listing coordinates. The objection to it is not that it
fails today; it works fine today. It is that it can only ever encode one operator's opinion,
and it has no path to becoming anyone else's.

---

## The consumer contract (settled)

**The search backend reads exactly one thing: a Trusted List. Its members are the DList
header coordinates to index. That never changes.**

Everything about how the set was derived sits behind that interface: whether one pubkey
chose it or a thousand did, whether trust was cryptographic or ranked, whether a filter list
was involved. The consumer cannot tell and must not care.

This is the property that makes the whole design worth the trouble. The backend is written
once. Every subsequent loosening of who gets to influence the index is a change to the
**pipeline that produces the list**, not to the thing that reads it.

```
  ┌──────────────────────────────────────────────┐
  │              anything at all                 │
  │  hand-authored · author == me · author ∈     │
  │  list · self-attested curators · GrapeRank   │
  └───────────────────┬──────────────────────────┘
                      │   (opaque to the consumer)
                      ▼
       ┌──────────────────────────────────┐
       │  kind 30394 Trusted List         │   ← the ONLY integration point
       │  a: 39998:b83a28b7…:github-…     │
       │  a: …                            │
       └───────────────┬──────────────────┘
                       ▼
                 Vespa backend
```

### Day one: hand-author it

Because the production method is opaque, **you can publish the list by hand or by script on
day one** with exactly the members you want. The contract is honest and final; only the
producer is a stub. This unblocks the search integration immediately and puts none of the
pipeline work on the critical path.

### What the backend subscribes to

```json
{ "kinds": [30394], "authors": ["<TA>"], "#d": ["<the published set's address>"] }
```

Then, per member coordinate, fetch the header for its label and schema:

```json
{ "kinds": [39998], "authors": ["b83a28b7…"], "#d": ["github-accounts"] }
```

and the items themselves:

```json
{ "kinds": [39999], "#z": ["39998:b83a28b7…:github-accounts"] }
```

---

## The guard principle

> **Curation strictness should track the consumer's tolerance for surprise.**

Today the engine has hardcoded presentation for one list. If a second person starts
curating and unknown lists enter the set, the engine breaks. So the strictness is not
artificial timidity, it is a **capability-matched guard**: the pipeline must not hand the
engine anything it cannot render.

The mechanism is **one curation field constraining the tagging's author**. Its value type
is the only thing that changes as the guard loosens, which is why rung 2 is not a new
mechanism but a wider value on the field that rung 1 already introduced.

| Rung | `author` constraint | Members | Certainty | Unlocked by |
|---|---|---|---|---|
| 1 | `== observer` (me) | what I tagged | cryptographic — only I sign as me | **today** |
| 2 | `∈ <input list>` | what my curators tagged | cryptographic per member | generic presentation |
| 3 | unconstrained; GrapeRank decides | what the trusted crowd tagged | ranked, not certain | generic presentation + budgets |

Rung 1 needs no self-tagging and no input list. I tag the GitHub Accounts header with
"worth indexing", the pin curates with `author == me`, and the published list contains
exactly what I tagged. One pin, one tag, one signed list.

It is also not a special case. In the code the trust predicate is a function
`isAsserterTrusted(pk)`; "only me" is `pk => pk === observer`, occupying the same slot as
the GrapeRank threshold version, and `alsoTrust` is existing precedent for an identity
predicate in that slot. In the UI it is the zero point of an axis that already exists: a
trust scope of "Only me" sitting below "My web of trust", not a bespoke mode.

**Self-attestation is a different predicate, kept for rung 3.** A pubkey can **self-tag**,
publishing a tagging whose target is itself. Only that pubkey can do so, which makes it
unforgeable *as a claim*, and it is protocol activity rather than code to write. That makes
"everyone who has self-identified as a search curator" an open, permissionless, growing set
that nobody has to grant membership to — the natural input list at rung 3. But it is
worthless as a *credential*, since anyone can self-tag anything, so it only means something
composed with GrapeRank. It is orthogonal to certainty, not a means to it, and conflating
the two is what made an earlier draft of this document reach for `asserter == target ==
observer` when `author == observer` was sufficient and simpler.

**The unlock is generic presentation, and it lives in Part 1b below.** An engine that reads
`names` and the field declarations off a target header can render a list it has never seen.
That is the precondition for accepting strangers' lists. Part 1b is therefore not polish
ahead of the deferred work — it is what buys permission to loosen the guard at all.

---

## Build progression

**The near-term build is one field and one dialog option.** The filter-by-input-list
pipeline is *not* on the critical path — it is rung 2.

**1. An `author` curation constraint on the pin, with the value `== observer`.**
A curation field constraining which taggings count by their author, exposed as an "Only me"
trust scope. Implementation slots into the existing `isAsserterTrusted` seam rather than
adding a stage. This alone produces the certain, pipeline-produced list.

**2. Per-pin curation (not the global dial).**
`resolveMembershipMethod` (`src/api/trustedList/membershipMethods.js`) reads one
instance-wide operator setting, so tightening the indexing list would retune every Trusted
List on the deployment. Curation belongs on the pin, which already carries a
`curationMethod` blob. See the design note below — mostly finishing something rather than
starting it. Step 1's field lives here.

**3. Publish the tag and the taggings.**
Author the `worth-indexing-for-search` tag element and tag the `github-accounts` header. No
code. Naming caveats below.

Once 1 and 2 land, the Brainstorm-curated "Worth Indexing" Trusted List is supplied to the
Vespa backend and GitHub Accounts (its only member) becomes a search tab.

**Deferred to rung 2: the filter-by-input-list pipeline.** The same `author` field taking a
list instead of a pubkey. Input is a NIP-51 list or a Trusted List produced by the self-tag
route. Recompute on a schedule or on demand, which deliberately skips the dependency-graph
problem by converting correctness into latency. Two disciplines keep it that way: decide
explicitly that a dependent list reads **last cycle's** value, and cap chain depth so one
cycle cannot grow unbounded. Cycles then degrade to oscillation rather than deadlock.

### Prerequisites and gaps found while verifying

- **A kind-39998 target already flows through membership.** The tagging classifier passes an
  `a` value through verbatim with no kind restriction (`src/lib/event-tagging/classify.js`
  `targetOf`), and `fullItemMembers` is built from the assertions' address keys with no kind
  filter (`src/api/event-tags/index.js`). So tagging a list *header* needs no protocol change
  and the coordinate reaches the published 30394. **No work required.**
- **But header targets will not resolve for display.** The item-resolution scan is hardcoded
  to `kinds: [39999]` and keys its map as `39999:<pubkey>:<d>`
  (`src/api/event-tags/index.js`). A tagged kind-39998 header therefore renders as an
  unresolved address in the tag UI. Cosmetic for the indexer, real for a human verifying the
  work. Small fix; not a blocker.
- **Decide whose assistant signs the list.** The signer is whichever instance runs the
  refresh, so the backend subscribes to one deployment's output and trusts its pipeline.

---

## Design note: per-pin curation implies multiple pins per tag

Step 2 implies a viewer can hold **more than one pin of the same tag**, each with its own
curation, producing its own Trusted List. That capability already exists, but only in a
community-shaped form.

**Today.** The variant key is `contextSlug`. The address is
`tl-pin-items-<obs8>-<tagAuthor8>-<slug>[-in-<ctx>]`, and the context is recovered by
reading a `z` tag off the pin (`contextSlugOfPin`). So a second pin of the same tag is
possible, but only by asserting it is *about a community*.

**The problem.** "Context" bundles two separate things: a **variant key** that lets pins
coexist and take distinct addresses, and a **semantic claim** that the pin is scoped to a
community. An indexing-curation pin wants the first and not the second.

**The shape to aim at.** Make the variant key an **explicit field on the pin**, with
community context being one thing that can populate it, rather than the only thing that
can. Today the key is *derived* from the context `z`; it should be stored, and the context
`z` stamped only when the variant genuinely is a community.

That inverts the dependency and makes arbitrary named curations natural. Existing contextual
pins remain valid: they are variants whose slug happens to name a community and which
therefore also carry the `z`.

Three things that fall out:

- **Uniqueness.** Two pins sharing a variant slug collide on the address. The publish path
  needs a guard, and the UI needs to refuse or disambiguate.
- **Precedent for the migration.** The pin's `curationMethod` JSON already carries `method`,
  `cutoff`, `observer`, `noteMethod` and `targetTypes`. Adding `membershipMethod` and a
  filter-list reference is additive, and "field absent means fall back to the instance
  default" is exactly how `targetTypes` was added without touching a single existing pin
  (`dlist-item-tagging` #5).
- **The UX is the hard part, and it is a modelling problem before it is a layout problem.**
  A community context is a **place**. An arbitrary curation variant is a **saved recipe**.
  The Pinned tab currently renders contexts as chips in one row, alongside Profiles / Notes
  / Items leaves, an export flow and a curation dialog, on a layout that predates all of it.
  Putting recipes in the same chip row as places is what would make it incomprehensible.
  Worth a deliberate design round before building.

---

## Why the address encodes identity and not method

The `d` tag carries observer, tag author, tag slug and variant. It does **not** carry the
membership method or cutoff, which ride as separate tags on the event.

That split is deliberate and load-bearing. Loosening a threshold, switching the membership
method or adding a filter list all keep the same address, because it is still the same
person's opinion about the same thing. Changing the curator or the defining tag changes the
address, because it is a different opinion. "What Vinney says search indexes" and "what
Claude says search indexes" *should* be different subscriptions that a consumer chooses
between, not the same address quietly changing meaning.

One leak: the tag **slug** is in the address. Renaming `worth-indexing-for-search` to
`worth-indexing` changes the address without changing whose opinion it is. So the naming
decision is load-bearing in a way it otherwise would not be.

### Naming, because this becomes a de facto standard

The per-tag tagging header is keyed by the tag element's author, so **whoever authors the
tag owns the namespace every participant's taggings land in**. If the convention is meant to
be shared, author it under a well-known pubkey and publish the concept; re-parenting later
is an epic. The honored authorities are already a request parameter, which is the federation
seam. `worth-indexing-for-search` is also narrow — an archiver or a mirror wants the same
signal — so something like `worth-indexing` with the human name carrying the nuance may age
better.

## Accepted risks

Both reviewed and accepted by the operator (2026-09-18) rather than designed around:

- **Resource bounds.** A trusted curator can point at a legitimate ten-million-item list.
  GrapeRank says they are not a spammer and the index still falls over. Relaxing past rung 1
  wants a per-list and per-curator budget, which trust scoring does not provide.
- **Tab proliferation.** Forty curators contributing lists gives a search UI with two hundred
  tabs. That is a ranking and selection problem at the presentation layer that no trust
  filter answers, and in practice it is likely to gate relaxation harder than spam does.

## Rejected alternatives

- **A config file of coordinates.** Works today, encodes only one operator's opinion forever,
  and requires a deploy to add a list. Retrofitting trust onto it later means designing the
  wire format under pressure and backfilling.
- **An author allowlist in the curation rule.** "Include only what this pubkey signed" is a
  write-time permission check wearing a read-time costume, and it is the thing that would
  have to be torn out at rung 2.
- **A point of view narrowed to one account, for certainty.** Does not work. The predicate is
  `wot_rank_<suffix> >= minRank`, a threshold on a propagated GrapeRank score, and rank flows
  through the follow graph with attenuation. "Follows one account" is not "trusts one
  account". The only adjacent knob, `alsoTrust`, widens rather than narrows. Certainty comes
  from an `author == observer` constraint instead.
- **Strict curation via the existing membership methods.** `count`, `input` and `certainty`
  are all folds over an already-trust-filtered set; they differ in weighting, never in who
  counts as trusted. None can express an author constraint.
- **Configuration inside the tagging assertion.** A tagging is a bare claim with a polarity
  that dedupes latest-wins per asserter and target. Config there would make every tagger
  implicitly publish configuration, and disputing the claim would take the config with it.

---

# ═══════════════════════════════════════════════════════
# ▼▼▼  DIVISION: everything above is the near-term plan. ▼▼▼
# ▼▼▼  Everything below is a target, not a commitment.   ▼▼▼
# ═══════════════════════════════════════════════════════

Parts 2 and 3 become worth building when a **second independent engine** appears, because
that is the first moment these conventions must be shared rather than merely consistent.

Two exceptions to "defer":

- **Part 1b is not deferred.** Reading the tab label and field schema off the target header
  costs nothing, and it is the unlock for relaxing the guard (see above).
- **Fix the join key now.** Use the DList header coordinate as the identity of a list
  everywhere, so moving configuration into protocol later is a data migration and not a
  redesign.

## Part 1b — NOW. Read presentation off the target header.

The live header already carries everything an indexer needs to stay generic:

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

`names[2]` is the tab label. `required` and `field-type` are the result schema. An indexer
reading these is generic across lists on day one; one that hardcodes them has to be unwound
before the guard can ever be relaxed.

---

# PART 2 — LATER. Extrinsic configuration, joined by `b`.

## Intrinsic vs extrinsic

The split is authorship, not storage:

| | Intrinsic | Extrinsic |
|---|---|---|
| **Describes** | the list itself | one engine's policy about the list |
| **Authored by** | the list's curator | the engine operator |
| **Examples** | display names, field declarations, field types | priority, refresh cadence, cache TTL, ranking boost, tab order |
| **Lives on** | the target header (already does) | a settings list you author |
| **Defer?** | no — see Part 1b | yes — backend config loses nothing |

## The join primitive already exists

A `b` tag is a typed pointer carried on kinds 39998 and 39999:
`['b', '<target a-tag>', '<type>']`, registry `pointer` | `inherit` | `inherit-items`
(absent or unknown reads as `pointer`, fail-safe). Child-claims-parent, and the graph derives
`REFERENCES {source:'b-tag'}` automatically. BIBLE §25.

```
  search-index-settings                      github-accounts
  39998:<engine>:search-index-settings       39998:b83a28b7…:github-accounts
    ['names','Search Index Setting', …]                    ▲
    ['required','priority']                                │
    ['optional','refresh-seconds']                         │ b (pointer)
    ['field-type','priority','integer']                    │
            ▲                                              │
            │ z (membership)                               │
  ┌─────────┴──────────────────────────────────────────────┴───┐
  │  settings item — kind 39999, authored by the engine        │
  │  ['d','github-accounts-settings']                          │
  │  ['z','39998:<engine>:search-index-settings']              │
  │  ['b','39998:b83a28b7…:github-accounts','pointer']  ← JOIN │
  │  ['priority','10']                                         │
  │  ['refresh-seconds','3600']                                │
  └────────────────────────────────────────────────────────────┘
```

Why this shape: the settings **schema** is itself in protocol, so a second engine reads it
rather than your source; `inherit-items` lets a second engine inherit your settings list and
override selectively, which is the multi-engine story already ratified (`dlist-curation`
ADR 0003); and membership stays separable from configuration, so a list can be indexed with
no settings item (defaults apply) and a settings item can outlive its list's membership.

**Caveat.** Firmware-seeded `b` tags are rebuilt on reinstall — never-clobber is within-run
only. Hand-authored settings items are ordinary published events and unaffected, but do not
rely on firmware to maintain them.

---

# PART 3 — LATER. Field types as a DList (W18). Portable actions, not portable rendering.

Shipping HTML snippets or templates over nostr for an engine to render is an **injection
surface**: whoever authors the template controls markup in the viewer's browser, under the
same permissionless publishing model the rest of this design depends on. It also couples
every engine to one markup convention, defeating the interop goal that motivated putting
configuration in protocol at all.

W18 already reached the better answer, and its title is the rule: **portable actions, not
portable rendering**.

```
  field-types                                github-accounts
  39998:<TA>:field-types                     ['field-type','github-username','url']
    ['required','type-name']                                  │
    ['optional','url-template']                               ▼
            ▲                            ┌─────────────────────────────────┐
            │ z                          │ type item: kind 39999           │
            └────────────────────────────│ ['d','url']                     │
                                         │ ['z','39998:<TA>:field-types']  │
                                         │ ['type-name','url']             │
                                         │ ['url-template',                │
                                         │   'https://github.com/{value}'] │
                                         └─────────────────────────────────┘
```

A type an engine does not recognise **degrades to text**, which is what makes the vocabulary
extensible without coordination. Markup, CSS, layout and ranking stay local to each engine:
the meaning travels, the rendering does not.

**Open question W18 tracks.** A url-template may be list-specific rather than type-generic:
`github-username` on `github-accounts` resolves to `https://github.com/{value}`, but a
`url`-typed field elsewhere resolves differently. The type may say "this is a link" while the
list says "here is how to build it". Placement is unsettled.

Part 3 is independent of Part 2 and could land first. It is also the part most likely to need
a real NIP conversation, since `field-type` is a client convention observed in the wild
rather than a specified tag (W17).

---

## Summary

| Part | What | When | Blocked on |
|---|---|---|---|
| Contract | Consumer reads one Trusted List, forever | **Settled** | nothing |
| Day one | Hand-author that list | **Now** | nothing |
| 1 | `author` curation constraint, value `== observer` ("Only me") | **Next** | build |
| 2 | Per-pin curation + explicit pin variants | **Next** | build + UX round |
| 3 | Publish tag, tag the header | **Next** | naming decision |
| 1b | Read tab label + schema off the target header | **Now** | nothing — unlocks relaxation |
| Rung 2 | Same `author` field taking a list; filter-list picker UX | Later | generic presentation |
| Rung 3 | Self-attested curator set + GrapeRank | Later | budgets, tab selection |
| Later 2 | Extrinsic config in a settings DList joined by `b` | Later | a second engine |
| Later 3 | Field types as a DList with url-templates | Later | W17/W18 spec work |

The near-term commitment is small, and the interface is the part that is already final.
