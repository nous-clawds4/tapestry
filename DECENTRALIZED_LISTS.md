Decentralized Lists
=====

This NIP defines lists of things that users can create and that anyone can add to. It provides an alternative to NIP-51 for list management. The distinction is that for any given NIP-51 list, the list author has full control over list items, whereas for this NIP, list items are contributed by the community.

We introduce the following event kinds: `9998` and `39998` for _list header declaration_ (a.k.a. _list declaration_), and `9999` and `39999` for _list item declaration_. Whether to use kind `999x` or kind `3999x` depends on whether the declaration author wishes the list or list item to be editable (kind `3999x`) or not (kind `999x`).

_This NIP is agnostic regarding the choice of method or methods for list curation and spam prevention_. (But see below for a brief discussion.)

_See also: [Decentralized Lists: Cross-NIP Compatibility](DECENTRALIZED_LISTS_COMPAT.md), a companion NIP describing how foreign event kinds can play list-item or list-header roles._

## Declarations of lists and list items

There are two actions: declaration of a list, and declaration of a specific item that belongs to a given list.

### List declaration

Declaration of a list is a kind `9998` (or `39998`) event. It may be referred to as the _list header_.

The list header `must` have the `names` tag. The `names` tag must be followed by two strings: a singular form ("widget") and a plural form ("widgets"), as in the examples below.

Optional tags: `titles`, `slugs`, which also must have a singular form and a plural form, as is the case for the `names` tag.

The list header `should` make use of `required` or `allowed` tags to indicate which child item types are expected. For example: `["required", "p"]` indicates that child item declarations must make use of the `p` tag. Each required or allowed tag must be listed individually, not packed together into a single tag. For example, use `["required", "foo"], ["required", "bar"]` rather than `["required", "foo", "bar"]`.

An optional third element MAY be included on any of the `required`, `allowed`, `recommended`, or `disallowed` tags to provide a brief human-readable description of what the named tag represents. For example: `["required", "p", "Pubkey of the person being endorsed"]`, or `["allowed", "comments", "Optional textual reason"]`. The description is informational only and does not affect validation. Two-element forms remain valid; the third element is purely additive.

If the list header is a kind `39998` replaceable event, it _must_ have a `d` tag as described in [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md).

### Item declaration 

There are two methods to declare an item: the <i>standard</i> method and the <i>nonstandard</i> method. The standard method is recommended for routine use. The nonstandard method may be used for backwards compatibility with other NIPs. The only distinction between these two methods are the event kinds that are used for declaration of an item on a list. Standard declaration of an item on an existing list is a kind `9999` (or `39999`) event. Nonstandard declaration of an item on an existing list is some other kind that is selected for the sake of compatibility with one or more other chosen NIPs. For an example of nonstandard item declaration, see below.

The `z` tag is required by all list item events, whether standard (kind `9999` and `39999`) or nonstandard (some other event kind). It is used as a pointer to the parent list (the list header). If the list header is a kind `9998` event, the `z` tag is the _event id_ of the list header. If the list header is a kind `39998` event, which is a replaceable event and will not have a constant event id, the `z` tag follows the format of an `a` tag: `39998:<list header author pubkey>:<d-tag of the list header>`. Alternatively, if a list header has not been formally declared, the `z` tag value can be replaced with a human readable name of the list, e.g.  `["z", "country"]` and `["t", "Switzerland"]`could be used to add `Switzerland` to the list of countries. However, the _preferred_ practice will be to rely upon formal declaration of the list header.

The list item event `should` have at least one item tag, which is a `p`, `e`, `t`, or `a` tag (others), as indicated by `required` by the parent list declaration.

Optional tags: `name`, `title`, `slug`, `description`, `comments`. Each of these tags is followed by a single string element, as in the examples below.

A single kind `9999` or `39999` event can be used to declare multiple items for a single list (e.g. one z tag and multiple item tags), or a single item that belongs to multiple lists (multiple z tags and a single item tag), or multiple items that all belong to multiple lists (multiple z tags and multiple item tags). However, it is recommended to use a distinct event for each individual item (one z tag, one item tag).

If an item belongs to multiple lists, either multiple list item declaration events can be employed, or there can be a single list item declaration event with multiple `z` tags, one for each list to which it belongs.

The `p`, `e`, `t`, and `a` tags are used in list item declarations when declaring a pubkey, event id, string, or naddr as an item on a list. The parent list declaration event `should` specify which of these tags are expected to be present in their children using the `required`, `allowed`, `recommended` and/or `disallowed` tags.

## Expressions of approval & disapproval of individual list items

Various methods exist for community members to express their approval or disapproval of individual list items. Existing methods include commonly used NIPs such as NIP-25: Reactions, zaps, NIP-56: Reports, etc. This NIP will therefore not introduce any new formalism for this purpose. It is up to personalized trust metric interpreters to decide what these data points mean and how to use them.

As a starting point, it is `recommended` that endorsements or objections to individual list items be handled with existing NIP-25: Reactions. Using this method, endorsement of a list item is a kind 7 event with an `e` tag pointing to the list item declaration and "+" in the content field. Objection is the same but with "-" in the content field.

## Examples

### Example 1: a list of nostr developers

List creation:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "nostr developer", "nostr developers"],
    ["description", "This is a list of developers who build within the nostr ecosystem"],
    ["required", "p"],
    ["required", "name"]
  ],
  "id": "<id_list_of_developers>"
}
```

Add a pubkey as an item on the list of developers:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_list_of_developers>"],
    ["name", "Derek Ross"],
    ["p", "3f770d65d3a764a9c5cb503ae123e62ec7598ad035d836e2a810f3877a745b24"]
  ]
}
```

### Example 2: a list of long form articles on hyperinflation:

List creation:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "long form article on hyperinflation", "long form articles on hyperinflation"],
    ["description", "This is a list of long form content events on the topic of hyperinflation."],
    ["required", "a"],
    ["recommended", "title"]
  ],
  "id": "<id_hyperinflation>"
}
```

Add an naddr address as an item to the above list:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_hyperinflation>"],
    ["a", "naddr1qvzqqqr4gupzq4rqjpyzsnf2z5wgma397sxr382z8mg90l80jf7m3z2k628z9wsrqythwumn8ghj7cnfw33k76twv4ezuum0vd5kzmp0qythwumn8ghj7ct5d3shxtnwdaehgu3wd3skuep0qq3kv6tpwskkxatjwfjkucme946xsefdwd5kcetwwskhg6tdv5khg6rfv4nqnxv6fx"],
    ["title", "Fiat Currency: The Silent Time Thief"]
  ]
}
```

### Example 3: a list of dog names:

List creation:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "dog name", "dog names"],
    ["description", "This is a list of commonly used dog names."],
    ["required", "t"]
  ],
  "id": "<id_dog_names>"
}
```

Add a piece of text as an item to the above list:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_dog_names>"],
    ["t", "Fido"]
  ]
}
```

### Example 4: A single item on multiple lists

Create a list of dogs and a list of animals:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "dog", "dogs"],
    ["description", "This is a list (by name) of individual dogs."],
    ["required", "t"]
  ],
  "id": "<id_dogs>"
}
```

```json
{
  "kind": 9998,
  "tags": [
    ["names", "animal", "animals"],
    ["description", "This is a list (by name) of individual animals."],
    ["required", "t"]
  ],
  "id": "<id_animals>"
}
```

Now add Fido to both of the above lists.

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_dogs>"],
    ["z", "<id_animals>"],
    ["t", "Fido"]
  ]
}
```

It is equally valid to split the above item declaration event into two events, one for each list:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_dogs>"],
    ["t", "Fido"]
  ]
}
```

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_animals>"],
    ["t", "Fido"]
  ]
}
```

An alternate and equivalent way to add Fido to these two lists is to provide each list `name` (singular) in place of the list id. In this case, we replace `<id_dogs>` with `dog`, and `<id_animals>` with `animal`:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "dog"],
    ["z", "animal"],
    ["t", "Fido"]
  ]
}
```

The above can be translated: "Fido is a dog" and "Fido is an animal".

However, it is encouraged to use the list id if an appropriate one is known and available.

### Example 5: A list of lists

Declare a list of movie lists, each one corresponding to a different genre.

```json
{
  "kind": 9998,
  "tags": [
    ["names", "list of good movies in a specific movie genre", "lists of good movies in a specific movie genre"],
    ["description", "This is a list of lists of good movies in specific movie genres. It will be used to make a composite list of good movies of any genre."],
    ["required", "e"]
  ],
  "id": "<id_list_of_lists_of_movies>"
}
```

Now add two items to the above list: a list of comedies and a list of dramas.

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_list_of_lists_of_movies>"],
    ["e", "<id_list_of_comedies>"],
    ["e", "<id_list_of_dramas>"]
  ],
}
```

### Example 6: Objection to an item on a list

```json
{
  "kind": 7,
  "content": "-", // or "+" to upvote
  "tags": [
    ["e", "<id_declaration_of_list_item>"]
  ]
}
```

### Example 7: Declaration of the List Header using kind 39998 Replaceable Event

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_dogs>"],
    ["names", "dog, "dogs"],
    ["required", "t"]
  ],
  "id": "<id_for_list_of_dogs>",
  "author": "<pubkey_for_list_of_dogs>"
}
```

```json
{
  "kind": 9999,
  "tags":[
    ["z", "39998:<pubkey_for_list_of_dogs>:<d_tag_for_list_of_dogs>"],
    ["t", "Fido"]
  ]
}
```

If the list item is also a replaceable event, it must also have a `d` tag:

```json
{
  "kind": 39999,
  "tags":[
    ["z", "39998:<pubkey_for_list_of_dogs>:<d_tag_for_list_of_dogs>"],
    ["d", "<d_tag_for_Fido>"]
    ["t", "Fido"]
  ]
}
```

## Nonstandard methods to declare a list

The standard method to declare a list of widgets uses a kind `(3)9998` event as the list header:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "widget", "widgets"],
    ["description", "Lorem ipsum"],
    ["required", "t"]
  ],
  "id": "<id_lists>"
}
```

The nonstandard method to declare a list is to use a kind `(3)9999` event as the list header.

To see how this works, suppose we declare a list of all known lists:

```json
{
  "kind": 9998,
  "tags": [
    ["names", "list", "lists"],
    ["description", "This is a list of all the lists that exist within any given datastore"],
    ["required", "names"]
  ],
  "id": "<id_lists>"
}
```

From this point forward, we can avoid kind `(3)9998` events in favor of using `<id_lists>` in a kind `(3)9999` event to declare new lists:

```json
{
  "kind": 9999,
  "tags": [
    ["z", "<id_lists>"],
    ["names", "dog", "dogs"],
    ["description", "This is a list (by name) of individual dogs."],
    ["required", "t"]
  ],
  "id": "<id_dogs>"
}
```

Alternatively, we can eschew kind `9998` and `39998` events altogether by replacing `["z", "<id_lists>"]` with `["z", "list"]`, as follows:


```json
{
  "kind": 9999,
  "tags": [
    ["z", "list"],
    ["names", "dog", "dogs"],
    ["description", "This is a list (by name) of individual dogs."],
    ["required", "t"]
  ],
  "id": "<id_dogs>"
}
```

There is a certain elegance in building this NIP entirely around only two event kinds: `9999` and `39999`. However, it is more in line with standard nostr practice to separate list headers from list items by kind. We suggest using `(3)9998` for list header declaration and then experiment with phasing kind `(3)9998` events out entirely if this proves to be a feasible course of action.

## Retrieval of list headers and list items

Retrieval of all canonically-formed lists:

```json
{
  "kinds": [9998, 39998]
}
```

Retrieval of all lists formed using the nonstandard method:

```json
{
  "kinds": [9999, 39999],
  "#z": ["list", "<id1_lists>", "<id2_lists>", "<id3_lists>", ... ]
}
```

Retrieval of all items on the list of dogs:

```json
{
  "since": 0,
  "kinds": [9999, 39999],
  "#z": ["dog", "<id1_dogs>", "<id2_dogs>",  "<id3_dogs>", ...]
}
```

Note that we are searching for multiple `#z` tags to address the possibility of list redundancy, with multiple redundant list declarations used by different communities.

## List curation and spam prevention

List curation refers to questions like the following:
- Which items should be accepted to a given list?
- Which items should be excluded from a given list?
- How can accepted list items be stratified?

A wide variety of methods of varying degrees of sophistication can be imagined. For example, a _personalized trust metric_ could be used to exclude items based on the personalized trust metric of the item contributor. For simplicity, this NIP presumes these methods to be specified elsewhere.

## Backwards Compatibility with Preexisting NIPs

### Example: NIP-72 Moderated Communities

Suppose we wish to create a Decentralized List of Communities. There are three methods we may consider:

1. Incompatible with NIP-72

Standard declaration of the list header for communities using kind `(3)9998`, with standard declaration of specific communities as list items using kind `(3)9999`:

List Header declaration: 

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "This is a list of Communities, members of which will be curated using Brainstorm (GrapeRank-style) methods."],
    ["required", "t"]
  ],
  "id": "<id_brainstorm_communities>"
}
```

List Item declaration: 

```json
{
  "kind": 39999,
  "tags": [
    ["z", "39998:<pubkey_for_list_of_brainstorm_communities>:<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Bitcoin Army", "dogs"],
    ["d", "<d_tag_for_Bitcoin_Army>"]
    ["t", "Bitcoin Army"]
  ]
}
```

2. Compatibility with NIP-72 using standard list item declaration

Using this method, kind `(3)9999` list items are pointers to communities that are defined using kind `34550` events as per NIP-72.

- Communities are created and defined using kind `34550`.
- The kind `(3)9998` List Header for communities specifies the `a` tag as a required tag.
- Each list item on the list of communities is a kind `(3)9999` event with an `a` tag that points to the kind `34550` community definition.

List Header declaration: 

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["description", "This is a list of Communities, members of which will be curated using Brainstorm (GrapeRank-style) methods. It is intended to be compatible with NIP-72: Moderated Communities."],
    ["required", "e"]
  ],
  "id": "<id_brainstorm_communities>"
}
```

List Item declaration: 

to be completed

3. Compatibility with NIP-72 using nonstandard list item declaration

Using this method, the kind 34550 community definition event exists exactly as specified by NIP-72, with the caveat that it contains an additional `z`-tag as per this Decentralized Lists NIP.

This method has the advantage of being more economical than method 2 in the sense that there is one less event required for specification of each list item. The primary disadvantage would happen if the external NIP(s) in question are already using the `z`-tag for some other purpose. However, this is an unusual occurrence. 

List Header declaration: 

```json
{
  "kind": 39998,
  "tags": [
    ["d", "<d_tag_for_list_of_brainstorm_communities>"],
    ["names", "Brainstorm Community", "Brainstorm Communities"],
    ["item-kinds", [34550]], // versus: ["item-kinds", [9999, 39999, 34550]],
    ["description", "This is a list of Communities, members of which will be curated using Brainstorm (GrapeRank-style) methods. It is intended to be compatible with NIP-72: Moderated Communities."],
    // need to indicate required tags, as per NIP-72, as well as additional tags that we add to the NIP-72 spec
  ],
  "id": "<id_brainstorm_communities>"
}
```

still need to complete the above, with NIP-72 required tags. Also need to decide how to specify item-kinds and spell this out in the above spec.

List Item declaration: 

to be completed
