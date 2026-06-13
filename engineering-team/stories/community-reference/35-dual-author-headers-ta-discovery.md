# Story 35: Dual-author headers + Tapestry-Assistant discovery (kind 10040)

**Status:** Approved
**Created:** 2026-06-13
**Type:** Doc (docs-mode — Protocol-Spec workflow; P3 of the b-tag affiliation design)

## Background

The b-tag affiliation design ([docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md), D7/D8) settled that a concept/DList header for a user may be authored two ways, and both are necessary: the user's **personal key** (preferred, but available only when the user can interactively sign — NIP-07 is never available server-side, per BIBLE Key Design Decision 6) and the user's **Tapestry Assistant** (the server-side key that signs all automated/install-time/batch operations). Today the corpus has no rule for which header governs when both exist, and no nostr-native way for a reader to find a *given* user's TA pubkey from their npub alone.

D7 settled the precedence rule (personal-authored header is the resolution root if it exists; else the TA-authored header; **designation, never recency**; freshness via an explicit inherit-typed `b` delegation, not a timestamp race). D8 settled the discovery mechanism: a new entry on the user's **kind-10040** event (NIP-85 "Trusted Assertions" / TA Treasure Map) designating their TA pubkey for DList-header authorship — extending an already-deployed, user-signed, npub-rooted pattern. Because NIP-85 is an upstream spec (Vitor Pamplona's, not in our `protocols/` index), the Tapestry convention is specced as a **local companion pre-NIP**.

Without this story, P4 and any consumer that resolves "which header is *this user's* `dogs`" has no ratified rule, and the dual-author premise that P3 and the broader affiliation design rest on is unrecorded.

This story ratifies **documents only**. Any code (the merge-preserve fix so the 10040 generators don't clobber a new entry; any resolver) is a separate engineering story.

## User-facing description

As a **reader/implementer resolving a user's concept definition**, I want a ratified rule for which of a user's two possible header authors governs, plus a nostr-native way to discover that user's Tapestry Assistant pubkey from their npub, so that a personal edit always beats an automated default, a compromised or stale assistant can never silently shadow the user, and any independent client can find and apply the right header without out-of-band knowledge of the deployment.

## Acceptance criteria

All testable by reading the ratified documents (docs-mode):

- [ ] A **new companion pre-NIP** exists under `protocols/drafts/` (status 📝 pre-NIP), following the established companion pattern (metadata header: Status / Canonical / Sources), specifying the Tapestry-Assistant-designation entry on kind 10040 and its relationship to upstream NIP-85.
- [ ] The pre-NIP states the **10040 entry's wire form** concretely: the assertion-type string and triple shape (`["<assertion-type>", <TA-pubkey>, <relay>]`), consistent with the deployed 10040 grammar, and the scope it designates (per the O2 gate decision).
- [ ] The pre-NIP states **revocation/replacement**: the entry is revoked or re-pointed by republishing the (replaceable, user-signed) 10040 — no separate expiry; same revocability posture as the `b` tag.
- [ ] **Backward compatibility** is stated: existing 10040 consumers (prefix-filter `"30382:"` / exact-match `"30382:rank"`) ignore the new entry; it breaks nothing.
- [ ] The **dual-author lookup-and-precedence rule** is ratified (D7) in its owning spec (per the O3 gate decision): for user U and concept slug S, the personal-authored header (`39998:<U>:<S>`) is the resolution root if it exists; else the TA-authored header (TA discovered via the 10040 entry); else none. Deterministic, author-controlled, observer-independent.
- [ ] **Most-recent-wins across pubkeys is explicitly rejected**, with the reason (cross-signer recency has no precedent in the corpus and would let a stale/compromised TA shadow a deliberate personal edit), and **delegation-by-composition** is stated: a personal header may carry `["b", "39998:<TA>:<S>", "inherit"]` to make the TA's header govern via the existing resolution rule.
- [ ] **BIBLE's Assistant Keys subsection (§953-area)** gains a pointer to the new companion pre-NIP (normative wire form lives in `protocols/`, BIBLE keeps the implementation/pointer per the boundary rule).
- [ ] The **`protocols/README` spec index** gains a row for the new companion pre-NIP.
- [ ] The documents are **honest about deployed-vs-target** (the 10040 generators don't yet emit the entry; no resolver wired) — no claim that unimplemented behavior is live, following the §27 / ADR 0030 precedent.
- [ ] The **merge-preserve concern is recorded as a future code story**, not implemented here; no source files or 10040 generators are touched (verifiable by diff).
- [ ] **`npm test` remains green.**

## Concepts touched

None in the live concept graph — documents only; no events emitted, **no firmware reinstall**. Names the user's kind-10040 event and the Tapestry Assistant (TA) by role; the Architect can confirm the exact deployed 10040 grammar against `src/api/export/nip85/`. (Concept Graph API was unreachable at planning time.)

## Out of scope

- The **merge-preserve code fix** (10040 generators rebuild the full tag list and would clobber a new entry) and any **resolver code** — future engineering stories.
- **Items vs headers** beyond the gate decision: the dual-author rule's subject is concept/DList *headers* (kind 39998); item authorship is not redefined here unless the gate decision widens it.
- Per-user *personal headers as a deployment feature* (UI, key management for interactive signing) — this story ratifies the *protocol rule*, not the product surface.
- P4 (resolved-definition cache); W11 (cloud/stamping); the registry-as-DList design; any upstream NIP-85 proposal (optional future act).
- Engine-config carriage (W8), which interacts with CD resolution but is its own open entry.

## Open questions

None remaining — the three gate items were resolved by the protocol author at the planning gate (2026-06-13):

1. **O2 — scope/granularity:** one **blanket** "DList-header authorship" entry (one entry, one revocation; assertion-type keyed on the DList-header kind 39998). Sub-decisions: no expiry (revoke via republish); status 📝 pre-NIP internal, upstream NIP-85 proposal optional/deferred.
2. **O3 — rule home:** the **new companion pre-NIP** owns the full lookup-and-precedence rule (the fallback branch is inseparable from TA discovery); `tapestry-concepts.md` gets a short pointer.
3. **Items scope:** **headers only** (kind 39998). Item authorship is not redefined here.

**Test Design is skipped** (docs-mode rule — the Reviewer audits accuracy and consistency).

## Linked artifacts

- Design source: [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D7, D8, O2, O3, §5 P3)
- Builds on: [ADR 0029](../../decisions/community-reference/0029-b-type-registry.md) (the `b` type registry — the inherit-typed delegation path) and [ADR 0030](../../decisions/community-reference/0030-communityreference-seed-not-stub.md) (TA-authored header seeding — the dual-author premise in action)
- ADR: [engineering-team/decisions/community-reference/0031-dual-author-headers-ta-discovery.md](../../decisions/community-reference/0031-dual-author-headers-ta-discovery.md)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
