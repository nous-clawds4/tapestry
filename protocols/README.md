# Protocols

The home for every protocol specification this project authors — published Custom NIPs, local pre-NIPs, and the worksheet of unsolved protocol problems. Created by the protocols-directory epic; design record: [docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md](../docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md). Process: specs are ratified through the [Protocol-Spec workflow](../engineering-team/workflows/protocol-spec-workflow.md) (docs-mode).

## The boundary rule (what belongs here vs. the BIBLE)

> **Does it leave the machine as signed nostr events that an independent implementation would need to parse or produce to interoperate?**
> Wire format (kinds, tag names/values, event shapes, resolution algorithms) → **here**.
> How *our* stack stores, computes, ranks, or displays it (Neo4j edges, Meili fields, GrapeRank pipelines, UI, emission sites, trust gates, deployment history) → **[BIBLE.md](../BIBLE.md)**.

Grey-zone guidance:

- **"Is it a feature?" is not the test.** Pinning is a Tapestry feature, but a pin is a published, signed, third-party-readable event — its *event format* is protocol; the pinned-tab UI and Trusted-List pipeline are BIBLE.
- **`drafts/` exists for internal wire formats.** A pre-NIP may document a format whose only consumer today is us, and may stay internal forever without ever publishing. That's a valid end state, not a failure.
- **Deployment history stays out of specs.** Example: the legacy z-tag pubkey exception (`LEGACY_Z_TAG_PUBKEY`, tags-branch ADR 0015) is wire-binding for our deployments but must not be hardcoded into a universal spec. Specs say "the deployment's `tag` concept header"; the literal lives in the ADR/BIBLE. The general question it raises is [worksheet](./worksheet.md) entry W1.
- **Each wire format is normative in exactly one place.** When a spec migrates here, the corresponding BIBLE section is rewritten as a short pointer to it plus the Tapestry-specific implementation detail that was always its real job.

## Layout

```
protocols/
  README.md       # this file — index, boundary rule, status ladder
  worksheet.md    # cross-cutting protocol problems & ideas not yet owned by one spec
  nips/           # published specs (NostrHub Custom NIPs / github NIPs) — working copies
  drafts/         # pre-NIPs: local drafts; may publish later, may stay internal
```

## Status ladder

Every spec's header carries one of:

| Status | Meaning |
|---|---|
| 💭 idea | worksheet-grade; not yet a coherent doc |
| 📝 pre-NIP | local draft in `drafts/`; not published; may stay internal by design |
| 🧪 pre-NIP (publish-ready) | content complete; awaiting the decision/act of publication |
| 🚀 published | live on NostrHub (or github NIPs); the file in `nips/` is the working copy |
| 🚀 published (update pending) | the local working copy has diverged ahead of the published version; republish needed |

Spec headers also record: **canonical external URL** (naddr for NostrHub Custom NIPs), **last-published date**, and **sources** (the ADRs / BIBLE sections the spec was distilled from).

**Publishing is the author's act.** Republishing to NostrHub requires the author's keys (and the hosting relay may require AUTH). Repo work ends at "publish-ready"; after the author publishes, the spec's status and last-published header are updated here.

## Spec index

Migration is in progress — specs land here story by story (see the [design handoff](../docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md) §8 for the plan). Until a spec's migration story has run, **its listed source location remains the source of truth** and the planned file does not exist yet.

| Spec | File | Status | Content lives today | Migration |
|---|---|---|---|---|
| Decentralized Lists (base NIP) | [nips/decentralized-lists.md](./nips/decentralized-lists.md) | 🚀 published (update pending) | **Working copy here.** The [NostrHub](https://nostrhub.io/naddr1qvzqqqrcvypzpef89h53f0fsza2ugwdc3e54nfpun5nxfqclpy79r6w8nxsk5yp0qythwumn8ghj7erpwe5kgtnwdaehgu339e3k7mf0qqfkgetrv4h8gunpd35h5ety94kxjum5wv4px7v6) version (kind 30817, 2026-02-26) is behind until the author republishes | story 2 ✅ |
| DList Cross-NIP Compatibility (companion) | [drafts/decentralized-lists-compat.md](./drafts/decentralized-lists-compat.md) | 🧪 pre-NIP (publish-ready) | **Working copy here** | story 2 ✅ |
| Tapestry Concepts (DList extensions) | [drafts/tapestry-concepts.md](./drafts/tapestry-concepts.md) | 📝 pre-NIP | **Working copy here** (BIBLE §5/§8/§9 hold implementation detail + pointers) | story 3 ✅ |
| Class-Thread Membership Tags (`n`, `s`) | `drafts/class-thread-tags.md` | 📝 pre-NIP | [BIBLE §23](../BIBLE.md#23-class-thread-membership-tags-n-s) + ADR 0011 (community-reference line) | story 4 — pending |
| Inherit-From & Resolved Definition (`b`) | `drafts/inherit-from.md` | 📝 pre-NIP | [BIBLE §25](../BIBLE.md#25-the-inherit-from-tag-b) + [§26](../BIBLE.md#26-resolved-definition), ADRs 0027/0028 | story 5 — pending |
| Communities | `drafts/communities.md` | 📝 pre-NIP | [BIBLE §22](../BIBLE.md#22-community-reference-model), `feat/communities:COMMUNITY_RECORDS_DLIST.md`, `feat/communities:COMMUNITY_ENDORSEMENTS_DLIST.md`, communities ADR line | story 6 — pending |
| Tags & Taggings | `drafts/tags.md` | 📝 pre-NIP | `feat/pubkey-tagging-target` branch: ADRs 0001 (profile-tag architecture), 0009 (pin-a-tag); firmware concepts `tag` / `nostr-user-tag` / `tag-pinning` | story 7 — pending |

Branch-path notation: `branch:path` means the file exists at that path on the named (unmerged) branch — read it with `git show <branch>:<path>`. Migration **copies** content from those branches; it never implies merging them.

Specs describing features still in flight on a branch (Tags, Communities) carry an explicit header note saying so.

## Worksheet

[worksheet.md](./worksheet.md) holds protocol problems and ideas that are unsolved, cross-cutting, or not yet owned by a single spec. Anything 💭 idea-grade starts there; when an entry matures into a coherent design, it graduates to a `drafts/` pre-NIP and the worksheet entry records the handoff.
