# Instance Identity — "Me" Is the TA — Design Handoff

**Status:** 🔴 OPEN
**Created:** 2026-08-05
**Provenance:** Scoped via `/discuss` (Product Expert lens) in direct owner conversation, 2026-08-05 — the session that opened the **Shared-concepts adoption suite** (`engineering-team/stories/_intake.md` entry 2026-08-05; this doctrine is **F0**, the suite's prerequisite). This is the **Capture** step of the Protocol-Spec Workflow (`engineering-team/workflows/protocol-spec-workflow.md`): settled decisions recorded so nothing lives only in the transcript. Ratify into `BIBLE.md` §31 + a `self-ontology` ADR in docs-mode; flip to ✅ SUPERSEDED once they land. Where the ratified §31 and this doc overlap, **§31 is authoritative**; this doc keeps the reasoning that produced it.

---

## 1. Why this exists — the first-person gap (worksheet W15)

Specs and features keep reaching for a first person — the stamping floor's "personal `z`" ([stamping spec](../protocols/drafts/stamping.md) write rule item 1), the [shared-concepts](../protocols/drafts/shared-concepts.md) aggregates' observer, the S-subset definitions S2a/S3a ("where **I** am the user" — intake entry 2026-08-05) — but a deployment holds several keys: the owner's main pubkey, the TA, and (multi-tenant) customers' relay keys. W13 already documents the main-vs-delegated split fracturing POV identity across stores. **Whose pubkey is the instance's "me"?** BIBLE §30 settled which *store* holds the self; this settles which *key* is the self's.

## 2. The doctrine (SETTLED — owner decision, 2026-08-05)

**The Tapestry instance is its own person, and the TA pubkey is that person's key.** The Tapestry Owner is a **distinct correspondent** — privileged in trust, not in identity. Owner-authored events meriting absorption into the instance's brain arrive the way any third party's content would: the TA **re-mints** them or references them with a **TA-authored pointer event** (§4). "Slightly less frugal, but cleaner."

The owner's gloss (proposed for the BIBLE prose; unobjected at scoping): **the Owner is Tony Stark; the TA is Jarvis.** In the default deployment one human holds both nsecs — "the same person" in the everyday sense — but the keys differ in custody (the TA nsec lives hot on the server; the Owner nsec stays cold/interactive) and can differ in operator (a non-technical owner may pay a system administrator — human or LLM — to run the server, in which case the *administrator* handles the TA nsec). The doctrine holds across all of these because it assigns the identity to the **instance**, not to whoever custodies the key.

This is largely **ratification of existing practice, not invention** — the code already converged here: brain writes sign as the TA; the Meili owner columns key on the TA suffix (`src/algos/nip85/loadScoresIntoMeilisearch.js`); `selfDeclare` refuses to touch any header not authored by the TA ("only this instance's own concept headers" — `src/api/concept/selfDeclare.js`); Active z-tags defines "foreign" as `pubkey ≠ taPubkey` (`ui/src/pages/shared-concepts/ActiveZTags.jsx`); restore re-mints under the target's own TA and rejected replaying foreign-signed events (second-brain ADR 0008, Option C).

## 3. Two-layer reconciliation with assistant-designation (SETTLED)

The one apparent tension in the corpus: [assistant-designation](../protocols/drafts/assistant-designation.md) frames the TA as the *user's delegate* (the user's kind-10040 attests "this pubkey authors my headers on my behalf") and its dual-author rule makes a **personal-authored header beat the TA-authored one** for the same slug. Resolution: **the two rules answer different questions, and both stand.**

- **"What does Tony think?"** — a question *about the human*, asked by external readers. The human's own signature is the most authoritative source; the TA is the designated fallback when the human is silent. Assistant-designation governs, **byte-unchanged** (consistent with W13's ORE direction: external callers name humans by main pubkey).
- **"What's in Jarvis's filing system? Which b-tags are *mine*? Which z-filings are *my* usage?"** — the instance's **first-person** questions. This doctrine governs: `authors:[TA]`, full stop.

Personal-wins is ratified as a **security posture, not a courtesy**, grounded in the custody asymmetry: the TA nsec is a hot server key, the Owner nsec is cold and interactive, and a compromised server must not shadow the owner's deliberate personal statements — the same reasoning by which assistant-designation already rejects most-recent-wins across signers ("a stale or compromised assistant"). The sysadmin/LLM-operator scenario (§2) is the proof the TA is not merely "the owner's second key" — it is the strongest argument for the doctrine and belongs in the ADR. It is also why absorption must be an **explicit act** (§4): in the Jarvis-operated-by-a-stranger world, Jarvis absorbing Tony's letters is a deliberate, auditable act of the instance — never a silent identity merge.

## 4. Absorption modes (SETTLED): re-mint and pointer, chosen per-feature

Both modes are legitimate; the doctrine supplies the **vocabulary** and deliberately declines a global default — each absorbing feature's ADR picks:

- **Re-mint** — the TA re-signs the content as its own: first-class owned state the TA can evolve and re-sign later. Precedent: restore-brain (second-brain ADR 0008) re-mints a foreign export verbatim under the target's TA. Cost: duplication.
- **Pointer** — a TA-authored pointer event references the owner's original: provenance preserved, no copy drift. Cost: the referenced letter is not owned state.

Named sub-question, also per-feature: whether a re-mint carries a **provenance link** back to the source event. (ADR 0008 deliberately stripped identity — its artifact is identity-free by design; absorbing a live owner letter is a different act and may want the link.)

## 5. The tapestries-#7 owner lane (SETTLED reading, owner-ratified)

The brain-first publish hook (tapestries ADR 0007, `engineering-team/decisions/done/tapestries/`) imports the instance's *own* tapestry letters where "own" = **TA- or owner-authored**, both runtime-resolved. Under the doctrine the owner-signed half is a correspondent's letter absorbed as self. Ruling: **the hook stays as-is near-term** — an eager absorption of a maximally-trusted correspondent's letters — and **stage-2 letter ingest (OPEN.md #136) inherits the correction**: owner letters route through the general provenance-carrying ingest lane like any correspondent's, with **no permanent "counts as me" carve-out**. The doctrine thereby resolves the client-signed-path question tapestries #7 deferred; F0 itself changes no code.

## 6. Scope (SETTLED): single-owner normative, multi-tenant noted

Like §30, the doctrine is **normative for the single-owner personal deployment**. The multi-tenant generalization is stated as direction only: each provisioned persona's instance-side identity is its **delegated key** — owner → TA, customer → relay key — exactly W13's `resolveProvisionedDelegate` direction. One paragraph, no more; keeps F0's blast radius small.

## 7. Landing plan (SETTLED)

| Artifact | Decision |
|---|---|
| BIBLE statement | **New §31 — "The Self and Its Keys"**, sibling of §30 ("§30 governs stores, this governs keys"). **No `protocols/` draft** — this is self-ontology, not wire format; it defines no tags, kinds, or reader rules. |
| ADR | **`self-ontology` 0002** (epic exists with exactly ADR 0001; this is its second chapter). |
| Worksheet | **W15 → Graduated → BIBLE §31.** W16 stays open (it is F5's question, untouched by F0). |
| assistant-designation draft | Gains a short **cross-reference note** naming the two-layer split (§3), wire format and precedence untouched. |
| Story bookkeeping | Thin docs-mode story via `/plan-feature`; instinct recorded at scoping: **the suite is the book, `self-ontology` is the ADR's epic** — settled at Planning. |

## 8. Payoffs recorded for the suite

- **S2a/S3a simplify to `authors:[TA]`** — every "where I am the user" S-subset query is one author filter, no identity special-cases.
- **Owner NIP-07 activity becomes ordinary evidence**: an owner-signed item z-pointing at a TA-authored header is a z-carrier whose author ≠ header author — textbook S3. The owner using the instance's shared concepts is *usage by a correspondent*, exactly what the adoption queues (F1/F2) want to surface.
- **tapestries-#7's deferred question has a doctrinal answer** (§5), unblocking stage-2 ingest design.

## 9. Pause point

Nothing blocking ratification — all five scoping questions settled 2026-08-05 (this doc *is* the settlement record). Next step: `/plan-feature` for the thin F0 story, then the docs-mode cycle (Architecture → skip Test Design → Implement §31 + spec edits → Review → cycle-staging), owner gate at each phase.

**Refs:** worksheet [W15](../protocols/worksheet.md#w15--instance-identity-is-me-the-ta-the-owner-or-their-union) (the graduating entry), W13, W16; [assistant-designation](../protocols/drafts/assistant-designation.md); [stamping](../protocols/drafts/stamping.md) write rule item 1; [shared-concepts](../protocols/drafts/shared-concepts.md); second-brain ADR 0008; tapestries ADR 0007; BIBLE §30 + self-ontology ADR 0001; `engineering-team/stories/_intake.md` 2026-08-05 entry (F0).
