Decentralized Lists: Cross-NIP Compatibility
=====

This NIP extends the [Decentralized Lists NIP](DECENTRALIZED_LISTS.md) (the "base NIP") with conventions for incorporating event kinds defined by other NIPs into the Decentralized Lists pattern.

The base NIP defines the pattern — a list header event declares a list, and list item events join that list via a `z` tag pointer back to the header. The base NIP uses kinds `9998`/`39998` for headers and `9999`/`39999` for items. This NIP describes how the same pattern can interoperate with foreign event kinds without modifying their respective NIPs.

NIP-72: Moderated Communities is the worked example below. The conventions generalize to other addressable event kinds.

## Relationship to the base NIP

This NIP is additive. It introduces one new list-header tag (`item-kind`) and codifies one usage pattern (using a foreign-kind event as a list item). It does not change any wire format or behavior defined in the base NIP.

A reader who understands only the base NIP can still parse list events that follow the canonical kinds. Events that participate in the conventions described here either appear as ordinary kind `9999`/`39999` items carrying an `a` tag (Method 2 below) or as foreign-kind events carrying additional `z` tags that base-only readers can ignore (Method 3 below). Both are normal nostr extension patterns.

## The two roles a foreign kind can play

A foreign event kind can play either or both of these roles in a Decentralized List:

- **Foreign kind as list item** — an event of a kind defined by another NIP carries its own native data and additionally functions as a member of a Decentralized List. The most common case, and the focus of this NIP.
- **Foreign kind as list header** — an event of a kind defined by another NIP serves as the parent that items point at via `z` tag. Useful when the foreign event is naturally the "thing being listed against" (e.g. a community whose members are tracked by independent endorsement events). Briefly noted at the end; full treatment is left for a future addendum.

## Declaring accepted item kinds: the `item-kind` tag

By default, a list header expects items to be kind `9999` or `39999` events. A list header can broaden this by declaring one or more `item-kind` tags, each carrying a single kind number:

```json
["item-kind", "39999"],
["item-kind", "34550"]
```

Multiple `item-kind` tags are listed individually, following the same convention as `required` and `allowed` in the base NIP. A list header that omits `item-kind` is taken to accept only the standard kinds (`9999`/`39999`).

The `item-kind` tag tells consumers which event kinds to query for when retrieving items on a list. Schema declarations on the header (`required`, `allowed`, `recommended`, `disallowed`) apply *additively* over whatever requirements the foreign kind already imposes by its own NIP — they do not override the foreign kind's own spec.

## Authorial voice

A foreign-kind event listed on a Decentralized List can be authored by either:

- a **curator** — someone other than the foreign event's author publishes a separate kind `9999`/`39999` list-item event whose `a` tag points at the foreign event; or
- the **foreign event's creator** — the foreign event itself carries one or more `z` tags pointing at list headers (or to lists by their human-readable names), making the foreign event simultaneously a valid event of its native kind and a list item on one or more lists.

These two voices make different statements:

- The curator says: *"I include this on my list."*
- The creator says: *"I claim to be on this list."*

Both forms are valid. Both can coexist for the same foreign event on the same list. This NIP places no preference on one over the other; the choice is up to whoever is making the listing claim. Trust-metric interpreters consuming the list will generally weight curator-authored claims and creator-authored self-claims differently.

## Example: NIP-72 Moderated Communities

NIP-72 defines a kind `34550` community-definition event. Suppose we wish to maintain a list of communities curated by trust-graph methods, drawing on the existing NIP-72 ecosystem rather than starting from scratch. There are three approaches, distinguished primarily by who is authoring the listing claim.

### Method 1: Native, no NIP-72 interop

Standard list-header plus standard list-items, ignoring NIP-72 entirely. Items are kind `39999` events that exist purely as native list constructs and do not reference any kind `34550` event. Use this when the community has no existing NIP-72 representation and cross-compatibility is not a goal.

List header:

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "Communities curated using trust-graph (GrapeRank-style) methods."],
    ["required", "t"],
    ["required", "name"]
  ]
}
```

List item:

```json
{
  "kind": 39999,
  "tags": [
    ["z", "39998:<curator_pubkey>:<d_tag_for_list_of_brainstorm_communities>"],
    ["d", "<d_tag_for_Bitcoin_Army>"],
    ["t", "Bitcoin Army"],
    ["name", "Bitcoin Army"]
  ]
}
```

### Method 2: Curator-authored references to NIP-72 communities

A standard kind `39999` list-item, where the item points by `a` tag at an existing kind `34550` community event. The kind `34550` event itself is unmodified. The list-item event is authored by the curator. **Speaker: "I include this community on my list."**

Use this when:

- You want to include an existing NIP-72 community in a curated list without requiring its creator's cooperation.
- You want each curator's entries to be independent events authored by them, with provenance preserved.

This is the recommended path for absorbing the existing NIP-72 ecosystem and the natural fit for personal-projection list models where each user maintains their own list.

List header:

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "Communities curated using trust-graph methods. Items are pointers to NIP-72 kind 34550 events."],
    ["required", "a"],
    ["item-kind", "39999"]
  ]
}
```

List item (one per (curator, community)):

```json
{
  "kind": 39999,
  "tags": [
    ["z", "39998:<curator_pubkey>:<d_tag_for_list_of_brainstorm_communities>"],
    ["a", "34550:<community_creator_pubkey>:<d_tag_of_community>"],
    ["name", "Bitcoin Army"]
  ]
}
```

The required pointer is `a` (not `e`) because kind `34550` is a replaceable event; the addressable `a` tag is the stable identifier.

### Method 3: Creator-authored self-listing

The kind `34550` community event itself plays the role of list item, by carrying one or more `z` tags pointing at list headers. The community event remains a fully valid NIP-72 event — extra `z` tags are harmless to readers that do not recognize them. The listing claim is authored by the community creator. **Speaker: "I claim to be on this list."**

Use this when:

- The community creator wishes to declare affiliation with one or more curated lists.
- You want to save an event per listing, accepting that listings only exist while the creator continues to publish them (replaceable-event semantics — see below).
- You want a single canonical event that NIP-72 clients see as a normal community and list-aware clients additionally see as a list item.

This method has the advantage of being more economical than Method 2 in the sense that there is one less event required for specification of each listing. The primary disadvantage is that it requires the kind `34550` event author's cooperation: an existing NIP-72 community cannot be brought onto a curated list this way without its creator re-publishing. A secondary disadvantage applies if the foreign NIP is already using the `z` tag for some other purpose; this is unusual but should be checked on a per-NIP basis before adopting Method 3 for that kind.

List header (declaring kind `34550` as an accepted item kind alongside `39999`):

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "Communities curated using trust-graph methods. Accepts kind 39999 pointers (Method 2) and kind 34550 self-listings (Method 3)."],
    ["item-kind", "39999"],
    ["item-kind", "34550"]
  ]
}
```

The kind `34550` tags required by NIP-72 (`name`, `description`, `p moderator`, `relay`, etc.) are imposed by NIP-72 itself and need not be re-declared on this header. Any `required`/`allowed` declarations on the list header apply additively.

List item (a NIP-72 community event with `z` tags added):

```json
{
  "kind": 34550,
  "tags": [
    ["d", "<d_tag_of_community>"],
    ["name", "Bitcoin Army"],
    ["description", "..."],
    ["image", "https://..."],
    ["p", "<moderator_pubkey>", "moderator"],
    ["relay", "wss://..."],
    ["z", "brainstorm-community"],
    ["z", "39998:<curator_X_pubkey>:<X_d_tag>"],
    ["z", "39998:<curator_Y_pubkey>:<Y_d_tag>"]
  ]
}
```

This example shows three `z` tags on the same event, illustrating that one community can claim membership on multiple lists simultaneously: a generic claim by the human-readable name `"brainstorm-community"`, plus specific affiliations with two curator-maintained lists. Multiple `z` tags follow the same multi-list pattern shown in Example 4 of the base NIP. The creator may use any combination — a single generic claim, one or more specific list affiliations, or a mix — according to which lists they wish to associate with.

## Methods 2 and 3 coexist

Methods 2 and 3 are not in conflict and are not interchangeable encodings of the same statement. They are different speakers (curator vs. creator) making different claims about the same artifact. A given community may appear on the same list by both means simultaneously, and both statements are valid.

A list-aware client looking for items on a list whose header declares both `["item-kind", "39999"]` and `["item-kind", "34550"]` should query both forms and merge:

```json
{ "kinds": [39999], "#z": ["39998:<list_pubkey>:<list_d_tag>"] }
```
```json
{ "kinds": [34550], "#z": ["39998:<list_pubkey>:<list_d_tag>", "brainstorm-community"] }
```

De-duplicate on the kind `34550` a-tag where the same community surfaces via both methods. Preserve authorship — the speaker of each entry is part of its meaning, and trust-metric interpreters will generally weight curator-authored claims and creator-authored self-claims differently.

## Replaceability semantics differ across methods

Method 2 entries are independent kind `39999` events authored by curators. Each curator's entry persists or is replaced by that curator on their own schedule.

Method 3 entries live as `z` tags on the creator's replaceable kind `34550` event. When the creator next publishes a new version of their community event, the live `z` tag set is whatever they include in that version. Listings authored by creators can therefore appear or disappear with each republish of the underlying community event; listings authored by curators are independent and accumulate per curator.

This asymmetry is a feature, not a bug — the two methods carry different commitment semantics, and consumers should be aware of which voice each entry comes from.

## Extending to other NIPs

The pattern in this NIP is not specific to NIP-72. Any addressable event kind whose author may wish to participate in community-curated lists, or whose representation may be referenced by curators of such lists, can be incorporated using the same three methods. To extend this NIP to another foreign kind:

1. Determine whether the foreign kind makes sense as a list item, a list header, or both.
2. For foreign-kind-item lists: declare the foreign kind via `item-kind` on the relevant list header. Decide whether your application supports curator-authored references (Method 2), creator self-listings (Method 3), or both.
3. Note any conflicts: if the foreign NIP already uses the `z` tag for some other purpose, Method 3 is unsuitable for that kind, and Method 2 should be used exclusively.

No further protocol-level conventions are required. Application-layer conventions (e.g. trust scoring, member-status determination, content visibility) are outside the scope of this NIP.

## A note on referencing foreign events

The natural and recommended pattern for referencing a foreign-kind event from a Decentralized List is via an `a` tag on a canonical kind `39999` list item (Method 2 above), not via `z` tag with the foreign event as parent. Most foreign event kinds — NIP-72 communities included — are not structured as list parents: they define a thing, not a list of items, and have no schema declarations to govern items pointing at them.

The base NIP's a-tag form for `z` tag values (`<kind>:<pubkey>:<d-tag>`) does not formally constrain the kind to `39998`, so a foreign-kind event *could* in principle be z-tagged at by items. In practice this is rare, schema-poor, and almost always better expressed as: (1) a canonical kind `39998` header for the list of interest, with (2) kind `39999` items carrying `a` tag references to the foreign events they list. That pattern is fully covered by Method 2 above and needs no additional convention.
