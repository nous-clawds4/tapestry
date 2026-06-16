# ADR 0031: Dual-author headers + Tapestry-Assistant discovery (kind 10040)

**Status:** Accepted
**Date:** 2026-06-13
**Story:** `engineering-team/stories/community-reference/35-dual-author-headers-ta-discovery.md`
**Builds on:** `community-reference` ADR 0029 (the `b` type registry — the inherit-typed delegation path the precedence rule composes with) and ADR 0030 (TA-authored header seeding — the dual-author premise in action).
**Design source:** [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D7, D8) — all three planning-gate items resolved by the protocol author 2026-06-13 (blanket DList-header scope; the companion pre-NIP owns the rule; headers only).
**Citation hygiene:** cite as **community-reference ADR 0031** with the epic-scoped path.

## Context

A concept/DList header for a user may be authored two ways, and both are necessary (handoff D7): the user's **personal key** — preferred, but available only when the user can interactively sign (NIP-07 is never available server-side; BIBLE Key Design Decision 6, §953 Assistant Keys) — and the user's **Tapestry Assistant (TA)**, the server-side key that signs all install-time/automated/batch operations (e.g. the firmware seeds of ADR 0030). The corpus today has no rule for which header governs when both exist, and no nostr-native way to find a *given* user's TA pubkey from their npub.

The deployed kind-10040 event (NIP-85 "Trusted Assertions" / TA Treasure Map) is already exactly the right substrate (verified): it is **user-signed** (NIP-07, signature-verified before publish), one-per-author replaceable (no `d`-tag, no expiry), and its tags are a map of triples `["<kind>:<assertionType>", <providerPubkey>, <relayURL>]` — e.g. `["30382:rank", <TA-pubkey>, <relay>]`. Element 2 *is* the provider/assistant pubkey a reader wants. NIP-85 is an upstream spec (Vitor Pamplona's, not in our `protocols/` index), so a Tapestry convention layered on its event is specced as a **local companion pre-NIP**.

Constraints: **documents only** — no code ships (the merge-preserve fix and any resolver are future engineering stories); honest deployed-vs-target framing (§27 / ADR 0030 precedent); the new wire entry must be backward-compatible and collision-free. **Both verified** (story-35 grounding sweep): a new `["39998:dlist-header", …]` entry is ignored by every existing 10040 consumer (the sole tag-parser exact-matches `'30382:rank'`; all others read only kind/pubkey), and collides with no reserved 10040 structure (`39998` is never a 10040 first-element prefix today). Concept graph: no live concepts touched; **no firmware reinstall**.

## Options considered

### Option A — one companion pre-NIP owning both the 10040 entry and the dual-author rule (chosen)
A new `protocols/drafts/` companion pre-NIP specifies (1) the kind-10040 TA-designation entry and (2) the dual-author lookup-and-precedence rule that consumes it; `tapestry-concepts.md` gets a short pointer; BIBLE §953 gets a pointer; `protocols/README` gets an index row.
*Pros:* one cohesive home — the fallback branch is *inseparable* from TA discovery, so the discovery mechanism and the rule that uses it sit together (O3 gate decision); mirrors the spec/companion structure already in `protocols/`; reuses the deployed, backward-compatible 10040 substrate (no new event kind).
*Cons:* the dual-author *principle* is arguably general header-addressing (tapestry-concepts territory) — mitigated by the pointer there.

### Option B — split: principle in `tapestry-concepts.md`, resolver in the companion
*Pros:* cleanest separation of "general rule" from "concrete TA mechanism."
*Cons:* two homes for one rule → cross-reference burden; the rule is short and the fallback is meaningless without the resolver, so the split fragments a single idea. Rejected at the planning gate.

### Option C — a new dedicated event kind for TA designation (not the 10040)
*Cons:* discards a deployed, user-signed, npub-rooted, backward-compatible substrate that already carries provider-designation triples; invents a new wire kind where an additive entry suffices; loses the free revocation-by-republish. Rejected.

## Decision

We chose **Option A**, with these fixed points:

1. **The companion pre-NIP** (a new `protocols/drafts/` file; status 📝 pre-NIP — its only consumer today is us, and it may stay internal or be proposed upstream to NIP-85 later) specifies both halves below. It is **additive to NIP-85**: it claims the `39998:*` assertion-key family on the kind-10040 tag map; a reader who understands only NIP-85 ignores the entry.
2. **The TA-designation entry (wire form):** `["39998:dlist-header", "<TA-pubkey>", "<relayURL>"]` on the user's kind-10040 event. Semantics, consistent with the deployed grammar: "for my kind-39998 DList-header events, the authoring provider is `<TA-pubkey>`, fetchable at `<relayURL>`." `39998` is the DList-header kind; `dlist-header` is a blanket assertion-type covering all the user's concept/DList-header authorship (the deployment synonym is "concept header"). One entry per user (blanket scope — O2 gate decision); **no expiry** — revoked or re-pointed by republishing the replaceable 10040 (same revocability posture as the `b` tag).
3. **Backward-compatibility (stated as ratified, verified):** existing 10040 consumers either exact-match `'30382:rank'` or read only kind/pubkey, so the new entry is ignored by all; it breaks nothing. The entry collides with no reserved 10040 structure.
4. **The dual-author lookup-and-precedence rule (D7):** for user U and concept slug S — the **personal-authored header** (`39998:<U>:<S>`) is the resolution root if it exists; **else** the **TA-authored header** (TA pubkey discovered via U's 10040 `39998:dlist-header` entry); **else** none. Deterministic, author-controlled, observer-independent — the resolution values [inherit-from](../../../protocols/drafts/inherit-from.md) already names. **Subject: kind-39998 headers only** (O2/items gate decision); item authorship is not redefined.
5. **Recency rejected, composition preferred:** most-recent-wins *across pubkeys* is rejected with prejudice (no cross-signer recency precedent exists; it would let a stale or compromised TA shadow a deliberate personal edit via a forged timestamp). Freshness is expressed by **composition**, not a timestamp race: a personal header may carry `["b", "39998:<TA>:<S>", "inherit"]` to make the TA's header govern through the existing resolution rule — explicit and revocable.
6. **Boundary-rule placement:** the wire form (the 10040 entry) and the resolution rule are **normative in the companion pre-NIP**. `tapestry-concepts.md` (which owns header addressing) gains a short pointer to the rule; BIBLE §953 (Assistant Keys) gains a pointer to the companion (deployment detail + pointer, per the boundary rule). `protocols/README` gains an index row.
7. **Honest deployed-vs-target:** the documents state plainly that the 10040 generators do not yet emit the entry and no resolver is wired — the **merge-preserve** fix (both generators rebuild the full tag literal from config and would clobber a hand-added entry on the next *create*) and any resolver are **future engineering stories**. No source files or generators are touched here.

## Consequences

- **Enables** P4 (a resolved-definition cache needs "which header is *this user's* S" — now ratified) and completes the dual-author premise the affiliation design (and ADR 0030's TA-seeding) rests on; gives independent clients an npub-rooted path to a user's TA without out-of-band deployment knowledge.
- **Constrains:** the companion pre-NIP claims the `39998:*` 10040 assertion-key family — a future Tapestry 10040 use on other DList kinds should extend this family, not collide; the precedence rule is headers-only, so item-level dual authorship remains unspecified (intentionally).
- **New debt / follow-ups:** the **merge-preserve** code story (so the entry survives regeneration) + a **resolver** story (apply the precedence rule), both future; an optional upstream NIP-85 proposal; the deployed-vs-target text in BIBLE/companion is the designated flip site when those land.
- **Firmware reinstall required?** No — documents only.

## Implementation notes

Docs-mode; `npm test` stays green; no source files; no 10040 generators touched (story AC — verify by diff). Cite **community-reference ADR 0031** (epic-scoped). Sites:

- **NEW `protocols/drafts/assistant-designation.md`** — the companion pre-NIP. Metadata header (Status: 📝 pre-NIP / Canonical: not yet published / Sources: handoff D7+D8, ADRs 0029/0030/0031) per the `decentralized-lists-compat.md` pattern, then:
  - *Title + intro:* "Tapestry Assistant Designation & Dual-Author Header Resolution"; a companion to NIP-85 (link it as upstream/Vitor Pamplona) — additive, claims the `39998:*` assertion-key family.
  - *Relationship to NIP-85:* the 10040 event is already a user-signed map of `["<kind>:<assertionType>", <providerPubkey>, <relay>]`; this spec adds the `39998:dlist-header` row; base-NIP-85 readers ignore it (backward-compat statement).
  - *The TA-designation entry:* wire form (fixed point 2), semantics, blanket scope, revocation-by-republish, no-expiry, the collision-free/backward-compat note.
  - *Dual-author lookup-and-precedence rule:* fixed points 4–5 (personal root → TA fallback → none; deterministic/author-controlled/observer-independent; recency rejected with reasons; delegation-by-composition via inherit-typed `b`); headers-only subject.
  - *Deployed-vs-target note:* not yet emitted/consumed; merge-preserve + resolver are future stories.
- **`protocols/README.md`** (spec index, ~line 56) — add a row: `| Tapestry Assistant Designation & Dual-Author Header Resolution (companion) | [drafts/assistant-designation.md](./drafts/assistant-designation.md) | 📝 pre-NIP | Working copy here (BIBLE §953 holds the pointer) | community-reference #35 |`.
- **`BIBLE.md` §953 (Assistant Keys subsection)** — add a short pointer paragraph after the NIP-85-page bullets (~line 975): the user's kind-10040 may carry a `["39998:dlist-header", <TA-pubkey>, <relay>]` entry designating the TA as the authoring provider for the user's DList headers; normative wire form + the dual-author precedence rule live in `protocols/drafts/assistant-designation.md`; **not yet emitted by the generators** (merge-preserve future story).
- **`protocols/drafts/tapestry-concepts.md`** — in/near "The parent pointer (z tag)" / addressing area, add a short pointer: which of a user's candidate headers governs for a concept (personal-authored vs TA-authored) is specified by the dual-author precedence rule in [assistant-designation.md](./assistant-designation.md).
- **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — §5 table: annotate P3 ratified (`community-reference` ADR 0031 / story #35; blanket scope, companion owns the rule, headers only); §4: mark O2/O3 resolved. No status flip — P4 remains; doc stays 🔴 OPEN.
- **Checked clean / untouched:** `src/api/export/nip85/*`, `bin/brainstorm-*kind10040*`, all 10040 consumers (no code); `inherit-from.md` (the inherit-typed `b` delegation path is already normative there — the companion references it, doesn't restate it); worksheet (no entry closes — D7/D8 weren't tracked as a W-entry); ADRs 0029/0030 and all stories/reviews (immutable); `firmware/active/manifest.json`.

## Out of scope

- The **merge-preserve code fix** and any **resolver** — future engineering stories.
- **Item-level** (kind-39999) dual authorship; per-user personal-header **product surface** (UI, interactive-signing key management).
- An **upstream NIP-85 proposal** (optional future act); P4 (resolved-definition cache); W11 (cloud/stamping); engine-config carriage (W8).
