Filters on Decentralized Lists
===

This document is a stub

## Background

One way to conceptualize [Decentralized Lists](https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg) (DLists) is to view the DList Header as an alternative to a NIP, and the z-tag that points to the Header as an alternative to a nostr event kind. This gives us two ways to define "categories" of content, referenced by the event kind or the z-tag, respectively.

Given the strong analogy between event kinds and z-tags, it makes sense to augment the filters defined in [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) with a "dlists" top-level property that lives alongside "authors", "kinds", etc, and that functions in much the same way as the "kinds" property. We are following in the footsteps of NIP-50, which added "search" to filters.

## `dlists` filter field

A new `dlists` field is introduced for REQ messages from clients:

```json
{
  // other fields on filter object: ids, authors, kinds, etc
  "dlists": <a list of dlist pointers: human readable strings, a-tags, or event ids, each of which points to a DList Header, as described in the DLists NIP>,
}
```

## Example

This filter should return the most recent 20 items on the DList for Dog Breeds:

```json
{
  "dlists": ["dog-breed", "39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:dog-breed"],
  "limit": 20
}
```

For personalized WoT filtering, use the `observer` extension to NIP-50 as described at [Brainstorm](https://brainstorm.world/developers/nip-50) 

```json
{
  "dlists": ["dog-breed", "39998:11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767:dog-breed"],
  "search": "observer:<alice's pubkey> sort:followers:desc filter:rank:gte:2",
  "limit": 20
}
```

