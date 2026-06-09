# Protocols Directory — Design Handoff

**Status:** 🔴 OPEN
**Date:** 2026-06-09
**Origin:** Planning session with the project owner (author of the Decentralized Lists Custom NIP). Scoped via `/discuss`-style conversation; execution is Protocol-Spec docs-mode work (see `engineering-team/workflows/protocol-spec-workflow.md`).
**Owner sign-offs so far:** repo-root location ✅ · directory structure ✅ · the migration map below reviewed in conversation ✅ (final ratification happens per-story).

---

## 1. Why this exists

Protocol-level material — wire formats that an independent, non-Tapestry implementation would need in order to interoperate — is currently scattered:

- **BIBLE.md** carries most of it, interleaved with Tapestry implementation detail (§5 The Tapestry Protocol, §8 Word-Wrapper JSON, §22 Community-Reference Model, §23 `n`/`s` tags, §25 `b` tag, §26 Resolved Definition).
- The **Decentralized Lists** Custom NIP is published on NostrHub, but a *newer* draft sits at the root of the unmerged `feat/communities` branch, alongside a complete-but-unpublished companion NIP and two community DList specs.
- The **Tags** feature's wire formats exist only as ADRs and firmware concepts on the unmerged `feat/pubkey-tagging-target` branch.

The confirmed diagnosis: the BIBLE is doing double duty as both *protocol spec* and *implementation bible*, and the NIP-shaped artifacts have no home, no status tracking, and no reconciliation against their published versions. This handoff defines a dedicated `protocols/` directory and the migration plan.

## 2. The boundary rule (BIBLE vs. protocols/)

> **Does it leave the machine as signed nostr events that an independent implementation would need to parse or produce to interoperate?**
> Wire format (kinds, tag names/values, event shapes, resolution algorithms) → `protocols/`.
> How *our* stack stores, computes, ranks, or displays it (Neo4j edges, Meili fields, GrapeRank pipelines, UI, emission sites, trust gates, deployment history) → **BIBLE**.

Notes on the grey zone:

- **"Is it a feature?" is not the test.** Pinning is a Tapestry feature, but a pin is a published, signed, third-party-readable event — its *event format* is protocol; the pinned-tab UI and Trusted-List pipeline are BIBLE.
- The `drafts/` tier exists precisely for wire formats whose only consumer today is us. A pre-NIP may stay internal forever and never graduate to publication; that's fine.
- **Deployment history stays out of NIPs.** Example: the legacy z-tag pubkey exception (`LEGACY_Z_TAG_PUBKEY = 82b75e47…`, ADR 0015 on the tags branch) is wire-binding for *our* deployments but must not be hardcoded into a universal spec. The spec says "the deployment's `tag` concept header"; the literal lives in the ADR/BIBLE. The general question it raises goes on the worksheet (entry W1).
- After migration, the BIBLE keeps each affected section but rewritten as: a short normative pointer to the `protocols/` doc + the Tapestry-specific implementation detail that was always its real job. **Each wire format is normative in exactly one place.**

## 3. Directory layout & status ladder

```
protocols/                      # repo root (decided)
  README.md                     # index of all specs + status, the boundary rule, the ladder
  worksheet.md                  # cross-cutting protocol problems & ideas not yet owned by one spec
  nips/                         # published (NostrHub Custom NIPs or github NIPs) — the public face
    decentralized-lists.md
  drafts/                       # pre-NIPs: local drafts; may publish later, may stay internal
    decentralized-lists-compat.md
    tapestry-concepts.md
    class-thread-tags.md
    inherit-from.md
    communities.md
    tags.md
```

**Status ladder** (every spec's header carries one):

| Status | Meaning |
|---|---|
| 💭 idea | worksheet-grade; not yet a coherent doc |
| 📝 pre-NIP | local draft in `drafts/`; not published; may stay internal by design |
| 🧪 pre-NIP (publish-ready) | content complete; awaiting decision/act of publication |
| 🚀 published | live on NostrHub (or github NIPs); file in `nips/` is the working copy |
| 🚀 published (update pending) | local working copy has diverged ahead of the published version; republish needed |

Each spec header also records: **canonical external URL** (naddr for NostrHub), **last-published date**, and **sources** (ADRs/BIBLE sections it was distilled from).

## 4. Migration map

| # | Spec | Target file | Status at creation | Sources |
|---|---|---|---|---|
| 1 | **Decentralized Lists** (base NIP) | `nips/decentralized-lists.md` | 🚀 published (update pending) | `feat/communities:DECENTRALIZED_LISTS.md` (newer than published — see §5); published naddr `…decentralized-lists` (kind 30817, author npub1u5njm…, published 2026-02-26, relay `wss://david.nostr1.com`) |
| 2 | **DList Cross-NIP Compatibility** (companion) | `drafts/decentralized-lists-compat.md` | 🧪 pre-NIP (publish-ready) | `feat/communities:DECENTRALIZED_LISTS_COMPAT.md` — complete: `item-kind` tag, Methods 1/2/3, authorial voice (curator vs. creator), replaceability semantics |
| 3 | **Tapestry Concepts** (DList extensions) | `drafts/tapestry-concepts.md` | 📝 pre-NIP | BIBLE §5 (kind unification, a-tag addressing, `z` semantics as we extend them, `concept-graph` header tag, JSON storage) + §8 (word-wrapper JSON format) + §9 core-nodes wire shapes |
| 4 | **Class-Thread Membership Tags** (`n`, `s`) | `drafts/class-thread-tags.md` | 📝 pre-NIP | BIBLE §23 + ADR 0011 (community-reference line). Includes the lowercase/uppercase direction principle and the single-char namespace discipline |
| 5 | **Inherit-From & Resolved Definition** (`b`) | `drafts/inherit-from.md` | 📝 pre-NIP | BIBLE §25 + §26, ADRs 0027/0028. Wire format, `INHERITS_FROM` direction (no flip), live read-time resolution algorithm, first-listed-wins multi-parent rule |
| 6 | **Communities** | `drafts/communities.md` | 📝 pre-NIP | BIBLE §22 (community-reference model, export, grapevine resolution) + `feat/communities:COMMUNITY_RECORDS_DLIST.md` + `feat/communities:COMMUNITY_ENDORSEMENTS_DLIST.md` + the communities ADR line (0034, 0040, …) |
| 7 | **Tags & Taggings** | `drafts/tags.md` | 📝 pre-NIP | `feat/pubkey-tagging-target`: ADR 0001 (profile-tag architecture), ADR 0009 (pin-a-tag), firmware concepts `tag` / `nostr-user-tag` / `tag-pinning` — see §6 below |

BIBLE §27 (PoV Resolution) was evaluated and **stays in the BIBLE**: PoV selection/fallback is how our deployment computes and presents trust metrics, not a wire format. (Kind-30382 Trusted Assertions are someone else's NIP — NIP-85-adjacent — which we consume, not author.)

## 5. Decentralized Lists reconciliation (investigated 2026-06-09)

**Finding: the local draft is strictly newer than the published version.**

- **Published** (NostrHub kind 30817, `d=decentralized-lists`, 2026-02-26): base spec only — header/item declarations, `names`/`required`/`allowed`, the `z` pointer, NIP-25 reactions, 7 examples, nonstandard declaration, retrieval filters. Ends at "List curation and spam prevention." No `item-kind`, no NIP-72 material, no three-element descriptions, no companion reference.
- **Local** (`feat/communities` root, last edited 2026-05-10): everything published **plus** (a) the three-element human-readable-description convention on `required`/`allowed`/`recommended`/`disallowed`; (b) a cross-reference to the companion compat NIP; (c) an **unfinished** "Backwards Compatibility with Preexisting NIPs" section (NIP-72 / kind 34550) containing two "to be completed" placeholders.
- The owner's recollection ("we were adding features later spun off into an auxiliary NIP, never got around to it") is confirmed — except the spin-off *did* happen: `DECENTRALIZED_LISTS_COMPAT.md` is that auxiliary NIP, and it is complete. What never happened was the cleanup of the base draft.

**Reconciliation plan (Story 2 below):** take the local draft as the new working copy; **delete** the embedded Backwards-Compat section (superseded by the companion); **keep** the three-element convention and the companion cross-ref; land as `nips/decentralized-lists.md` with status 🚀 published (update pending). Republishing to NostrHub is the **owner's act** (author keys; the relay `david.nostr1.com` requires AUTH) — the repo work ends at "ready to republish."

## 6. Tags & Taggings wire formats (surveyed from `feat/pubkey-tagging-target`)

Three event shapes, all kind-39999 DList items distinguished by the concept their `z` tag points at:

| Event | Key tags | Statement |
|---|---|---|
| **Tag definition** (`z`→`tag` concept) | `d`=slug; content `{tag:{slug,name,description}}` | "Podcaster is a tag" |
| **Tagging** (`z`→`nostr-user-tag`) | `p`=target pubkey, `e`=tag event id, `polarity` (`"1"` apply / `"-1"` dispute; absent ⇒ apply) | "Avi is a Podcaster" |
| **Pin** (`z`→`tag-pinning`) | `e`+`a`→the tag (id pins a version; `a` survives edits), `curation-method` JSON (`observer`, `method` e.g. `nip85:rank`, `cutoff`, `includeScoreInTL`) | "I pin Podcaster into my curated set" |

Plus NIP-09 kind-5 deletion for unpinning. Two new non-indexed tag names enter the namespace: `polarity`, `curation-method`. Polarity semantics v1: `>= 0.5` applied, `<= -0.5` disputed, the open interval reserved for a future graded-valence arc.

In-spec vs. out-of-spec for `drafts/tags.md`:

- **In:** all three wire formats, polarity semantics, the pin event format, kind-5 unpinning, and a *planned* section on tagging events (targets of kinds 39998/39999 are next, per the owner).
- **Out (BIBLE/ADR):** the legacy z-tag pubkey exception (ADR 0015), pinned-tab UI, Trusted-List (kind 30392) publication pipeline, "most pinned" aggregation, PoV-aware read filtering.

Naming note for the spec author: `nostr-user-tag` is pubkey-specific, but event-tagging is imminent — the draft should either define a target-typed family or name the planned generalization explicitly, so the concept handle question doesn't bind the spec to pubkeys.

## 7. Worksheet seed entries

`protocols/worksheet.md` opens with:

- **W1 — Cross-deployment concept identity.** A spec can't say "z-tag points to `39998:<dev-literal>:tag`". How do independent deployments agree on which concept header is canonical? Related: BIBLE §22's accepted Flaw A (firmware-blessed pointer) and its registry-as-DList exit; the `b`-edge grapevine aggregation as candidate mechanism (ADR 0027).
- **W2 — Single-char tag namespace registry.** `z`, `n`, `s`, `b` assigned; uppercase forms reserved for parent-claims-child inverses (`B` explicitly reserved); candidate letters for `IS_A_PROPERTY_OF` / `REFERENCES` TBD (BIBLE §23). One table to prevent collisions across all our specs.
- **W3 — Polarity valence arc.** The reserved `(-0.5, 0.5)` interval and a future graded `[-1, +1]` weighting (tags branch follow-ups).
- **W4 — `e` vs. `a` for parent-tag references.** Flagged in the tags branch's own follow-ups; interacts with replaceability semantics.
- **W5 — `REFERENCES` publishing semantics.** Consumer-owned tag on the consumer's Header vs. a separate reference-manifest event (BIBLE §23 open question).
- **W6 — Set-valued override algebra** for Resolved Definition (deferred by ADRs 0027/0028 to the first consumer that needs it).
- **W7 — `item-kind` interplay with concept headers.** The compat companion's `item-kind` mechanism vs. Tapestry's concept-header conventions — do they compose or compete?

## 8. Execution plan (per-story, docs-mode)

Run each as a Protocol-Spec docs-mode story (Test Design skipped; Implementer authors prose; Reviewer audits accuracy against sources). Order respects dependencies:

1. **Scaffold** — create `protocols/` with `README.md` (boundary rule, ladder, index) and `worksheet.md` (W1–W7).
2. **DLists reconciliation** — base NIP per §5 plan + compat companion moved in. Ends "ready to republish"; owner republishes to NostrHub out-of-band, then status flips to 🚀 published and the naddr/last-published header updates.
3. **Tapestry Concepts** — extract from BIBLE §5/§8/§9; rewrite those BIBLE sections as pointer + implementation detail.
4. **Class-thread tags** — extract from BIBLE §23; same BIBLE rewrite pattern.
5. **Inherit-From & Resolved Definition** — extract from BIBLE §25/§26; same pattern.
6. **Communities** — distill §22 + the two `feat/communities` DList specs.
7. **Tags & Taggings** — distill from tags-branch ADRs + firmware per §6.

Stories 3–5 are pure extractions (low risk, mechanical + editorial). Stories 6–7 are syntheses (more Reviewer attention). 2 unblocks the owner's publishing intent and should go early.

### Logistics

- **Branch copying, not merging.** Sources for stories 2, 6, 7 live on unmerged branches (`feat/communities`, `feat/pubkey-tagging-target`). The work *copies content* from those branches into `staging` (`git show <branch>:<file>`); no code merge is implied or required. The branch-root `DECENTRALIZED_LISTS*.md` / `COMMUNITY_*_DLIST.md` files should be deleted from `feat/communities` when that branch is next touched (note left here; not this work's job).
- **Specs describing unmerged features** (tags, communities) carry an explicit header note: "describes a feature in flight on branch X; not yet on main."
- **No firmware or code changes** anywhere in this plan. CLAUDE.md "Also check at session start" list gains a pointer to `protocols/README.md` once the scaffold lands (story 1).

## 9. Open questions for ratification

1. Exact spec filenames/slugs above are proposals — confirm at each story's gate.
2. Should `nips/` mirror the *published* text verbatim with deltas tracked separately, or be the working copy (current plan: working copy + status ladder marks divergence)?
3. Does the Tags spec (story 7) wait for the tags branch to merge, or proceed now with the in-flight header note (current plan: proceed now)?
4. Naming for the generalized tagging concept (see §6 naming note) — needs the owner's call during story 7.
