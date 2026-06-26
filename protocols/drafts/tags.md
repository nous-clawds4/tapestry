> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **In flight:** describes a feature in flight on the unmerged branch `feat/pubkey-tagging-target` (Vinney), live at tags.brainstorm.world.
> **Sources:** tags-branch ADRs 0001 (profile-tag architecture) and 0009 (pin-a-tag) plus the branch's publishers and firmware concepts `tag`/`nostr-user-tag`/`tag-pinning` (extracted per protocols-directory story 7, `protocols-directory` ADR 0005); `feat/communities` ADR 0030 (the a-primary assertion-shape correction, per ADR 0004 finding D4); epic handoff §6 (the planned event-tagging direction).

---

Tags & Taggings
=====

This NIP defines **tags** (community-creatable categories — "Podcaster is a tag") and **taggings** (assertions that a target belongs to a tag — "Avi is a Podcaster"), plus a personal **pinning** layer for curating tags. All three ride on the kinds and conventions of [Decentralized Lists](../nips/decentralized-lists.md) and [Tapestry Concepts](./tapestry-concepts.md), as kind-39999 items distinguished by which concept their `z` tag references.

## The taggings family

A *tagging* is an assertion that a **target** belongs to a tag. The family is organized by target type:

- **`nostr-user-tag`** — targets are **pubkeys**. The deployed instance, and the only member specified in this document.
- **`nostr-event-tag`** — targets are **events** (kind-1 notes and the addressable kinds 39998/39999, i.e. DList headers and items). Specified in [Event Taggings](./event-taggings.md).
- **`dlist-tag`** *(envisioned)* — a subset of `nostr-event-tag` for DList objects specifically; an actively desired next step.

This family tree is ratified design direction (the protocol author's, recorded in this epic's story 7); only the deployed instance below is normative. Whether the deployed concept should be *renamed* (e.g. `nostr-user-tag` → `nostr-user-tagging`) is open — and **wire-impactful**, since the concept slug is embedded in `z` handles on user-signed history; renames are concept migrations, never documentation edits. The family's naming and expansion are tracked as worksheet [W10](../worksheet.md#w10--taggings-family-naming--expansion).

## Relationship to other specs

Tags and taggings are ordinary kind-39999 DList items per [Tapestry Concepts](./tapestry-concepts.md): each carries a `z` tag naming the deployment's `tag`, `nostr-user-tag`, or `tag-pinning` concept address (how independent deployments agree on those concept identities is worksheet [W1](../worksheet.md#w1--cross-deployment-concept-identity)). The tagging assertion is **consumed by [Communities](./communities.md)** as its membership signal — community declarations claim tag-elements, and rosters derive from the assertions that apply them.

## Tag definitions

A tag is created as a kind `39999` event joining the deployment's `tag` concept:

```json
{
  "kind": 39999,
  "tags": [
    ["d", "<slug>"],
    ["z", "<the deployment's tag concept address>"]
  ],
  "content": "{\"tag\":{\"slug\":\"<slug>\",\"name\":\"<name>\",\"description\":\"<description>\"}}"
}
```

`d` is the tag's slug (e.g. `podcaster`); the content payload mirrors it with the display name and description. The tag event — the **tag-element** — is addressable at `39999:<author>:<slug>` (its *a-coordinate*); anyone may create tags, and tags by different authors with the same slug are distinct elements.

## Taggings (assertions)

A tagging is a kind `39999` event asserting that a pubkey belongs to a tag. **Normative shape** (a-primary, per the 2026-06-05 correction):

```
["d", "profile-tag-<tagSlug>-<targetPubkey[0:8]>-<asserterPubkey[0:8]>"]
["p", "<targetPubkey>"]                    the person being tagged
["a", "39999:<tagAuthorPubkey>:<slug>"]    the tag-element applied — stable identity (consumers claim/scan this)
["e", "<tagEventId>"]                      the tag-element's version at apply-time — provenance only
["z", "<the deployment's nostr-user-tag concept address>"]
["polarity", "1" | "-1"]                   apply / dispute
```

with a content payload mirroring the key tags (`{"nostrUserTag":{"taggedPubkey":…,"tagEventId":…}}`).

**Replaceability — latest wins.** The deterministic `d` tag gives each asserter exactly one live stance per (target, tag slug): republishing at the same address replaces the prior assertion, including flips between apply and dispute.

**Deployed variant (wire-status an implementer needs today).** The live publishers on the deploying branch emit `d/p/e/z/polarity` **without** the `a` tag — the original shape — and the a-primary correction (made on the communities side, where `#a` roster scans depend on it) is recorded there as *pending the tags branch owner's confirmation*, with existing assertions expected to be backfilled with `a`. Until that confirmation and backfill, a reader needing completeness MUST union `#a` lookups with legacy `#e` lookups against the tag-element's event ids. The `e`-vs-`a` reference question in general is worksheet [W4](../worksheet.md#w4--e-vs-a-for-parent-tag-references).

## Polarity

`polarity` is `"1"` (apply) or `"-1"` (dispute); an absent tag means apply. v1 interpretation buckets values: `≥ 0.5` counts as applied, `≤ −0.5` as disputed, and the open interval between is **reserved** for a future graded-valence arc and not counted in v1. The graded semantics are undesigned — worksheet [W3](../worksheet.md#w3--polarity-valence-arc).

## Pins

A pin is a kind `39999` event by which a viewer opts a tag into their personal curated set:

```
["d", "tag-pin-<tagSlug>-<tagAuthorPubkey[0:8]>-<viewerPubkey[0:8]>"]
["e", "<tagEventId>"]                      the tag-element version being pinned
["a", "39999:<tagAuthorPubkey>:<slug>"]    the tag-element's stable address — survives the author's edits
["z", "<the deployment's tag-pinning concept address>"]
["curation-method", "<stringified JSON, see below>"]
```

with a content payload mirroring them (`{"tagPinning":{"tagEventId":…,"curationMethod":…}}`). The **dual reference** is deliberate: `e` pins the specific version seen at pin-time; `a` tracks the tag through its author's later edits (the general `e`-vs-`a` question is [W4](../worksheet.md#w4--e-vs-a-for-parent-tag-references)).

**Curation parameters.** The `curation-method` value is stringified JSON carrying the pin's curation intent:

```json
{ "observer": "<viewerPubkey>", "method": "nip85:rank", "cutoff": 1, "includeScoreInTL": true }
```

— the observing pubkey, a ranking-method identifier, a rank cutoff, and whether derived scores are included in downstream published lists. Further method identifiers may be introduced by convention.

## Unpinning

Unpinning is a standard NIP-09 kind-`5` deletion of the pin event. Reader semantics are existence-based: a live pin event means pinned; its absence (or deletion) means not pinned.

## Event tagging

Tagging **events** — beginning with kind-1 notes and the addressable kinds 39998/39999 (DList headers and items) — is the family's `nostr-event-tag` member. Its wire format is specified in **[Event Taggings](./event-taggings.md)**: the target stays in the `e`/`a` slot and the descriptor is referenced indirectly via a `z`-tag pointing at a per-tag *tagging header*. That spec settles, for event targets, the `e`-vs-`a` reference question this document tracks as [W4](../worksheet.md#w4--e-vs-a-for-parent-tag-references) (`a` preferred, `e` allowed).

## Open questions

1. **Family naming & expansion** — the rename question and the `nostr-event-tag`/`dlist-tag` handles → worksheet [W10](../worksheet.md#w10--taggings-family-naming--expansion).
2. **The deployed-variant reconciliation** — the a-primary correction's pending confirmation and the `a`-backfill of existing assertions (the union-read guidance above stands until then).
3. **Polarity's graded arc** → [W3](../worksheet.md#w3--polarity-valence-arc).
4. **`e` vs. `a` reference precedence** (assertions and pins) → [W4](../worksheet.md#w4--e-vs-a-for-parent-tag-references).
5. **Cross-deployment concept identity** for the `tag`/`nostr-user-tag`/`tag-pinning` handles → [W1](../worksheet.md#w1--cross-deployment-concept-identity).
