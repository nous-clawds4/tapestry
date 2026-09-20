Filters on Decentralized Lists
===

This document is a stub

## Background

One way to conceptualize [Decentralized Lists](https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qqfkgetrv4h8gunpd35h5ety94kxjum5wvzg04gg) (DLists) is to view the DList Header as an alternative to a NIP, and the z-tag that points to the Header as an alternative to a nostr event kind. The advantage of z-tags over event kinds is that we will never run out of z-tags, but event kinds are limited all practical purposes. Any human being on the planet can claim any number of z-tags without stepping on anyone's toes; but a user who claims an event kind will be (and historically has been, on occasion) accused of "spamming" the nostr network. From an practical perspective, the only way to get an event kind in usage is to gain a minimum level of credibility within the nostr dev community, a threshold that will never be met by most people on the planet. The view among nostr insiders that this is not a problem should not surprise anyone.

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

