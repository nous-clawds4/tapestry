# PRD Seed: the Shared-Concepts protocol stack — W14 settlement delta

**Mode:** reconstructed from as-built *(no prior PRD)* — **delta on** [`audits/nip-reorg/prd-seed.md`](../nip-reorg/prd-seed.md), which remains the baseline
**Build audit:** `engineering-team/audits/w14-settlement/audit.md`
**Anchor:** acceptance frame in `book.md` (eager; the 2026-07-13 ratification)
**Confidence:** high
**Date:** 2026-07-13

> One-story book; this seed updates the nip-reorg baseline rather than restating it. Tags as before: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## What changed since the baseline

- **§3 Scope (as-built):** `[FROM FRAME]` the policy layer is now *complete on paper* — no NIP carries an open section. New construct: **Reach** (Shared Concepts § Reach). Stamping's write rule has its optional tier and a finished read contract with a **defined non-expanding-client floor**.
- **§5 Design rules:** `[FROM FRAME]` two rules join the set: *permission-shaped graph semantics* (third-party edges enable, never route) and *publisher-side norms are never reader-side validity gates* (spam control stays observer-weighted trust).
- **§6 Carry-forward:** the "settle W14 vs build" fork from the baseline's §7 is resolved — **build is unblocked**: resolver/reach walk, cloud stamping, cap/formula tuning now have a settled normative target. Unchanged carry-forwards: pins dual-`z`, W1 identity, W10 target-typing, publication ladder.

## What product must validate (updated)

- [ ] `[UNKNOWN]` **Publication order** (unchanged from baseline — now with a stronger case for publishing Stamping, since it no longer carries an open section).
- [ ] `[UNKNOWN]` **Which real clients are assumed non-expanding** — the floor is now defined `[FROM FRAME]`; the product half remains: name the compatibility targets that must work at the floor.
- [ ] `[UNKNOWN]` **Implementation sequencing** — with the spec settled, choose the first build increment: pins dual-`z` parity (small, closes a wire gap) vs. the reach walk / resolver groundwork (larger, unlocks cloud stamping).
- [ ] `[UNKNOWN]` **Event-tagging sequencing** (unchanged from baseline).
