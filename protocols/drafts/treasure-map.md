Treasure Map
=====

This NIP is an auxiliary to NIP-85: Trusted Assertions. It details use of 10040 to assign curation of Trusted Lists and Decentralized List Items to Brainstorm and Tapestry Assistants.

## Trusted Lists

For any given Tag, there may be a Trusted List of items that are Tagged by trusted entities. The details of the curation, which may be referred to as the *trust determination method*, are not recorded in the 10040 event, but are presumed to be known by the Assistant and may be changed dynamically.

### of pubkeys

### generic Tags

```json
  [30392, <assistant_pubkey>, <relay>]
```

The above entry indicates that the Trusted Lists for *all* Tags, unless superseded (below), will be calculated by `<assistant_pubkey>`. The list of "all" Tags is presumed to be known by the Assistant and may be changed dynamically. This list of Tags may be managed, for example, by utilization by the trusted community, by Pinning, or by a combination of both methods.

#### specific Tags

Curation of the Trusted List corresponding to a specific Tag may be provided in the manner below, and is assumed to supersede the assignment of an assistant for generic Tags (above).

```json
  [30392:<a-tag or event id of the Tag>, <assistant_pubkey>, <relay>]
```

### of events

Same as TLs of pubkeys, but of nostr events.

```json
  [30393, <assistant_pubkey>, <relay>]
```

## Decentralized List

The Assistant may manage items of decentralized lists on behalf of the user.

### generic DLists

```json
  [39998, <assistant_pubkey>, <relay>]
```

### specific DLists

```json
  [39998:<d-tag>, <assistant_pubkey>, <relay>]
```

Note that the proposed spec for Trusted Lists is consistent with the original NIP-85 spec for Trusted Assertions in the sense that the events being published by the assistant pubkeys are kind 30382 and 30392 events, as indicated in the tag. However, the proposed spec for Decentralized Lists deviates: it is kind 39999 events that are being published, not 39998. 

