This protocol defines how to tag Nostr events in Tapestry.

## The Problem

When tagging a Nostr user, we use the `p` tag to refer to the subject being tagged and either the `e` or the `a` tag to refer to the event that defines the tag being applied.

When tagging a Nostr event, the naive but flawed approach would be to use the `e` or the `a` tag to refer to the event being tagged. The problem is that this creates ambiguity: we are using the `e` or `a`tag to refer to two different things - the event being tagged and the event that defines the tag being applied.

This problem is most stark when we consider tagging a tag. For tags in general, the `a` tag (rather than the `e` tag) will be the standard point of reference. For example, suppose we have two tags: `Awesome Tag` and `Useful Tag`. Alice wants to tag `Awesome Tag` as a `Useful Tag`, while Bob wants to the reverse: tag `Useful Tag` as an `Awesome Tag`. How do we disambiguate which is the target and which is the descriptor?

## Solution 1: extra a-tag fields (rejected)

One solution would be to use extra fields in the a-tag to disambiguate. For example, we could use a `target` field to refer to the event being tagged and a `descriptor` field to refer to the event that defines the tag being applied. According to this strategy, Alice would create an event like this: 

```json
{
  "kind": 39999,
  "tags": [
    ...
    ["a", "<awesome-tag-id>", "target"],
    ["a", "<useful-tag-id>", "descriptor"]
  ]
}
```

Wheareas Bob would create an event like this:

```json
{
  "kind": 39999,
  "tags": [
    ...
    ["a", "<useful-tag-id>", "target"],
    ["a", "<awesome-tag-id>", "descriptor"]
  ]
}
```

However, this approach adds an extra complication when trying to collect all instances of a particular tag being used. Ideally, we would want a simple filter: 

```json
{"kinds": [39999], "#a": ["<a-tag-of-descriptor>"]}
```

But the above solution would require us to iterate through all events and accept or reject events based on the third field as being "target" versus "descriptor", and this introduces significant performance concerns.

## Solution 2: new tags (rejected)

A second solution would be to introduce new tags to disambiguate. For example, we could use a `target` tag to refer to the event being tagged and a `descriptor` tag to refer to the event that defines the tag being applied. According to this strategy, Alice would create an event like this: 

```json
{
  "kind": 39999,
  "tags": [
    ["e", "<target-event-id>"],
    ["target", "<target-event-id>"],
    ["descriptor", "<descriptor-event-id>"],
    ...
  ]
}
```

However, this has the performance concern that nostr relays do not natively support filtering by custom tags like `target` and `descriptor`, which would require more complex server-side processing.

## The Proposed Solution: Indirect Tagging

We will harness the power of z-tags to disambiguate the event being tagged versus the event that defines the Tag. Essentially, we will continue to use the `e` tag or the `a` tag to refer to the event being tagged, but we will use a z-tag to refer to the event that defines the tag being applied.

A note regarding z-tags: there is no prohibition against using multiple z-tags in a single event. Indeed, it is quite natural to do so. The event for "Rover" belongs on the list of dogs, but also on the list of animals (dogs being a subset of animals). As such, Rover can credibly include two z-tags, one pointing to the "dogs" list and one pointing to the "animals" list.

## Example

As an example, we will consider the case of a Tag: "Good Tag", authored by Charlie, that Alice will tag as an "Awesome Tag" (which was previously defined by Jack).

Here is the Good Tag tag, authored by Charlie:

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "<good-tag-tag-id>",
  "kind": 39999,
  "pubkey": "<pubkey_charlie>",
  "sig": "<sig_charlie>",
  "tags": [
    ["z", "39998:<pubkey_vinney_tapestry_assistant>:tag"],
    ["name", "Good Tag"],
    ["description", "This tag is used to mark tags that people consider to be good."],
    ["d", "good-tag-tag"]
  ]
}
```

Here is the Tag called "Awesome Tag", declared by Jack:

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "<awesome-tag-tag-id>",
  "kind": 39999,
  "pubkey": "<pubkey_jack>",
  "sig": "<sig_jack>",
  "tags": [
    ["z", "39998:<pubkey_vinney_tapestry_assistant>:tag"],
    ["name", "Awesome Tag"],
    ["description", "This tag is used to mark tags that people consider to be awesome."],
    ["d", "awesome-tag-tag"]
  ]
}
```

Here is the DList Header for the list of nostr event Taggings, authored by Vinney's Tapestry Assistant and referenced by firmware:

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "nostr-event-taggings-id",
  "kind": 39998,
  "pubkey": "<pubkey_vinney_tapestry_assistant>",
  "sig": "<sig_vinney_tapestry_assistant>",
  "tags": [
    ["d", "nostr-event-tag"],
    ["names", "nostr event tagging", "nostr event taggings"],
    ["description", "A Nostr Event Tagging is an event that applies a specific Tag to a specific event (e or a)."]
  ]
}
```

Here is the DList Header for the list of Awesome Tag Taggings. It points to the "Awesome Tag" tag declaration using the a-tag, also authored by Jack at the same time that he authored the Awesome Tag Tag. 

Note that this event is _simultaneously_ a DList Header (so it needs names, description, and d-tag; but it's not kind 39998) and a List Item (so it needs a z-tag and is kind 39999). Note that the Decentralized Lists NIP specifically mentions that list headers can be (3)9999 events and are not limited to being (3)9998 events, provided that they meet the criteria for being a list header, such as having names and description tags. The reason this particular DList needs to be a kind 39999 event is that we require it to be an item on another DList, one that indicates that either the `e` tag or the `a` tag must be present, and which defines the interpretation of that tag.

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "awesome-tag-tagging-id",
  "kind": 39999,
  "pubkey": "<pubkey_jack>",
  "sig": "<sig_jack>",
  "tags": [
    ["z", "39998:<pubkey_vinney_tapestry_assistant>:tagging-with-specific-tag"],
    ["names", "Tagging of an event as an Awesome Tag", "Taggings of events as Awesome Tags"],
    ["description", "This is a Tagging that applies the Awesome Tag Tag to an event."],
    ["a", "39999:<pubkey_jack>:awesome-tag-tag"],
    ["d", "tagging:awesome-tag-tagging"]
  ]
}
```

Here is the DList Header for taggings that use a specific tag, which, very significantly, requires an a-tag to point to the Tag Declaration in question, and a description that states as such:

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "tagging-with-specific-tag-id",
  "kind": 39998,
  "pubkey": "<pubkey_vinney_tapestry_assistant>",
  "sig": "<sig_vinney_tapestry_assistant>",
  "tags": [
    ["description", "This is a DList Header for taggings that use a specific Tag. Each item in the list requires either an e-tag or an a-tag to point to the Tag being used, with the a-tag being preferred."],
    ["names", "tagging with specific tag", "taggings with specific tags"],
    ["d", "tagging-with-specific-tag"],
    ["recommended", "a"],
    ["allowed", "e"]
  ]
}
```

Here is the final Tagging event, authored by Alice:

```json
{
  "content": "",
  "created_at": 1678886400,
  "id": "alice-tagging-id",
  "kind": 39999,
  "pubkey": "<pubkey_alice>",
  "sig": "<sig_alice>",
  "tags": [
    ["z", "39998:<pubkey_vinney_tapestry_assistant>:nostr-event-tag"],
    ["z", "39999:<pubkey_jack>:tagging:awesome-tag-tagging"],
    ["a", "39999:<pubkey_charlie>:good-tag-tag"], // the event being tagged
    ["polarity", "1"],
    ["d", "<standardized-d-tag>"] // e.g. `event-tag-<descriptor>-<target8>-<asserter8>`
  ]
}
```

## Indirect Tags: Discovery

### Was addressible event X tagged as an Awesome Tag?

`{"kinds":[39999], "#z":["39999:<pubkey_jack>:tagging:awesome-tag-tagging"], "#a":["<X>"]}`

### To discover all tags of a given event, whether direct or indirect:

Given an event with a-tag: `39999:<pubkey_jack>:awesome-tag-tag`

Run this filter:

`{"kinds":[39999], "#a":["39999:<pubkey_jack>:awesome-tag-tag"]}`

_Indirect tagging_: For any returned result `event_0`, if the z-tag references an `event_0_z_Tag` that is an item on the DList of `39998:<pubkey_vinney_tapestry_assistant>:tagging-with-specific-tag`, then the event `event_0_z_Tag` is a Tagging event that tags the event with the a-tag in `event_0_z_Tag`.

_Direct tagging_: Should not be possible, due to the disambiguation described above.

### To discover all items that were tagged as an `Awesome Tag`:

There are two ways to do this: directly and indirectly.

Indirect tagging:

`{"kinds":[39999], "#z":["39999:<pubkey_jack>:tagging:awesome-tag-tagging"]}`

Direct tagging:

`{"kinds":[39999], "#a":["39999:<pubkey_jack>:awesome-tag-tag"]}`

However, note that `events` should not be tagged directly. Only `pubkeys` or strings (`t` tag) should be tagged directly.
