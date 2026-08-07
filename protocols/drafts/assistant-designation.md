> **Repo metadata — not part of the spec text.**
> **Status:** 📝 pre-NIP
> **Canonical:** not yet published
> **Sources:** `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (D7, D8); `community-reference` ADRs 0029 (the `b` type registry — the inherit-typed delegation path), 0030 (TA-authored header seeding), 0031 (this spec). Companion to upstream **NIP-85** (Trusted Assertions, kind 10040 — Vitor Pamplona), which this spec does not modify.

---

Tapestry Assistant Designation & Dual-Author Header Resolution
=====

This NIP is a companion to [NIP-85: Trusted Assertions](https://github.com/nostr-protocol/nips) (kind `10040`). It adds one convention — a **Tapestry Assistant designation entry** on a user's kind-10040 event — and the **dual-author resolution rule** that consumes it: how a reader decides which of a user's two possible concept/DList-header authors (the user's own key, or their server-side **Tapestry Assistant**) governs.

It is **additive**: it claims the `39998:*` assertion-key family on the kind-10040 tag map and changes no NIP-85 wire format or behavior. A reader who understands only NIP-85 ignores the entry.

## Why two authors

A Tapestry concept/DList header (kind `39998`) for a user may be signed by either of two keys, and both are necessary:

- **The user's personal key** — preferred, but available only when the user can sign interactively (e.g. a NIP-07 extension or an external signer). It is never available to server-side, automated, or long-running operations.
- **The user's Tapestry Assistant (TA)** — a server-side key that signs the user's automated and install-time header operations (for example the firmware-seeded affiliation pointers of `community-reference` ADR 0030). It is always available server-side and never requires interactive signing.

Because the two keys serve disjoint situations, a user may end up with both a personally-signed and a TA-signed header for the same concept. A reader needs (a) a way to find a given user's TA pubkey from their npub, and (b) a rule for which header governs.

## Relationship to NIP-85

NIP-85's kind `10040` is a **user-signed, replaceable** event (one per author pubkey; no `d` tag) whose tags form a map of triples:

```
["<kind>:<assertionType>", "<providerPubkey>", "<relayURL>"]
```

Each triple delegates: "for events of `<kind>` and assertion-type `<assertionType>`, the provider I designate is `<providerPubkey>`, found at `<relayURL>`." The deployed Tapestry use carries `30382:*` rows (kind-30382 Trust Assertions — rank, followers, and so on). This spec adds a row in the `39998` (DList-header) kind:

```
["39998:dlist-header", "<TA-pubkey>", "<relayURL>"]
```

— "for my kind-39998 DList headers, the authoring provider is `<TA-pubkey>`, fetchable at `<relayURL>`." The provider pubkey (element 2) **is** the user's Tapestry Assistant pubkey; reading it is how an independent client discovers a user's TA from their npub alone, with no out-of-band deployment knowledge.

A reader who understands only NIP-85 (or only the deployed `30382:*` rows) ignores a `39998:*` row; it breaks nothing.

## The Tapestry Assistant designation entry

| Field | Value |
|---|---|
| assertion key (element 1) | `39998:dlist-header` — kind `39998` (DList header; the deployment synonym is "concept header"), blanket assertion-type for all the user's DList-header authorship |
| provider (element 2) | the user's **Tapestry Assistant pubkey** |
| relay (element 3) | a relay URL where the user's TA-authored headers can be fetched |

- **Blanket scope.** One entry designates the TA for *all* the user's concept/DList-header authorship; there is no per-concept entry. (A future revision could add finer-grained `39998:<…>` keys within this family without colliding.)
- **Revocation and replacement.** The entry is revoked or re-pointed by republishing the (replaceable, user-signed) kind-10040 event — the same revocability posture as the `b` tag. There is **no expiry field**.
- **Authorship.** The 10040 event is signed by the **user**, so the designation is a user-authorized delegation: the user attests "this pubkey authors my headers on my behalf." A TA cannot designate itself.

## Dual-author lookup and precedence

For a user `U` and concept slug `S`, a reader resolves *which header governs* as follows:

1. **Personal-authored header wins.** If `39998:<U>:<S>` exists (signed by `U`'s own key), it is the resolution root.
2. **Else the TA-authored header.** Otherwise, discover `U`'s Tapestry Assistant pubkey `TA` from `U`'s kind-10040 `39998:dlist-header` entry, and use `39998:<TA>:<S>`.
3. **Else none.** If neither exists, there is no header for `U`'s `S`.

This precedence is **deterministic, author-controlled, and observer-independent** — the resolution values of [Inherit-From & Resolved Definition](./inherit-from.md). Its subject is kind-`39998` **headers**; this spec does not redefine item (kind-`39999`) authorship.

**Most-recent-wins across pubkeys is rejected.** Selection between a personal-signed and a TA-signed header is never by timestamp. Cross-signer recency has no precedent in the protocol (every recency rule elsewhere is same-author NIP-01 replaceability), and it would let a stale or compromised assistant shadow a deliberate personal edit with a forged `created_at`. The corpus's grain is uniformly personal-preferred-with-designated-fallback.

**Freshness by composition, not recency.** If a user *wants* their actively-maintained TA header to govern even while a personal header exists, they express it through deference, not a timestamp race: the personal header carries

```
["b", "39998:<TA>:<S>", "inherit"]
```

— an inherit-typed `b` tag (per [Inherit-From](./inherit-from.md), `community-reference` ADR 0029) deferring to the TA header. The precedence question then collapses into the ordinary resolution rule, and the deference is explicit and revocable.

## Relationship to instance identity (BIBLE §31)

This specification is the **external layer**: it tells a reader resolving a *human's* concept/DList headers which of the two possible authors governs. It does not define the instance's own first person. Per BIBLE §31 ("The Self and Its Keys"), the Tapestry instance is its own person whose key is the TA; the "authors my headers on my behalf" framing above is the external view of that arrangement — from the instance's own vantage the TA is not a delegate but the instance's identity, and the human user is a distinct correspondent. The dual-author precedence is unchanged by §31: personal-signed wins remains correct for the external question, and §31 ratifies it as a **security posture** grounded in custody asymmetry (the TA key is hot and server-resident; the personal key is cold and interactive). Wire format and behavior above are byte-unchanged.

## Deployment status (not normative)

As of ratification this is **specified, not yet wired**: the deployment's kind-10040 generators do not yet emit the `39998:dlist-header` entry, and no resolver applies the precedence rule. Two follow-on engineering changes are required and tracked separately: a **merge-preserve** fix (the generators rebuild the full 10040 tag list from config, so the entry must be merged in rather than clobbered on regeneration) and a **resolver** that applies the precedence rule. See BIBLE §953 (Assistant Keys) for the deployment-side pointer.
