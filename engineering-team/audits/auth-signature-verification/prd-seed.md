# PRD Seed: Control-panel authentication (verified login)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/auth-signature-verification/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high *(frame-grounded and shipped; product-vision framing is inferred)*
**Date:** 2026-09-11

> Reverse-engineered baseline in PRD shape, from what shipped. This book was a **security fix**, not a product-discovery effort — so the frame-grounded mechanics are solid `[FROM FRAME]`, while the "product vision / persona" framing is `[INFERRED]` scaffolding for the product team to accept or discard.

## 1. Product vision
`[INFERRED]` The control panel's sign-in must prove a visitor controls the key they claim, so operator/owner surfaces can only be reached by their real holder. `[FROM FRAME]` Knowledge of a public key (owner, admin, or any user's) must never, by itself, produce a session. `[UNKNOWN — product input]` whether sign-in should expand beyond NIP-07 (e.g. remote signers / NIP-46, hardware) — out of scope here.

## 2. Personas
- `[INFERRED]` **Operator / owner** — signs in with their NIP-07 extension to reach admin surfaces.
- `[INFERRED]` **Guest / any nostr user** — may sign in with any pubkey (permissionless), obtaining a non-owner session.
- `[FROM FRAME]` **Attacker (anti-persona)** — knows a public key and tries to ride it into a session; must be defeated by requiring a valid signature.

## 3. Scope (as-built)
`[FROM FRAME]` In scope, shipped: signature-verified challenge at both login endpoints; identity established only on a verified login; single-use challenge; `created_at` freshness; session regeneration; no server-side `nsec`; retirement of the nsec paste page. `[INFERRED]` Out of scope (deferred): the other unverified-event/authorization surfaces (F1–F6), sandbox propagation, auth-kind consolidation.

## 4. Domain model
`[INFERRED]` Entities: **auth event** (nostr kind 22242 or 27235, carrying a `challenge` tag, signed by the claimed pubkey); **challenge** (server-issued nonce, single-use, session-bound via a pending claim); **session** (`{authenticated, pubkey}`, regenerated on login, backed by Redis with a persisted secret). No concept-graph concepts; no schema/firmware change.

## 5. Design rules (as-built)
`[INFERRED]` NIP-07 is the sign-in mechanism (browser extension signs the challenge). `[FROM FRAME]` The server never handles a private key — pasting an `nsec` is not a supported flow (page retired). `[INFERRED]` Login failures surface as vendor-neutral coded errors (pre-existing ADR 0021 modal), unchanged here.

## 6. Carry-forward & open questions
Promoted from build audit §6 — F1 (live critical), F2 (mitigated), F3–F6, sandbox propagation, the private advisory, and the deferred consolidations. See audit §6 for the linked register.

## 7. What product must validate
- [ ] Is broadening sign-in beyond NIP-07 (remote signers / NIP-46) a wanted direction, or is NIP-07-only the intended product stance?
- [ ] Should any-pubkey guest login stay permissionless, or should the control panel gate sign-in to owner/admin/customer only? (The permissionless stance is inferred from the code, not a recorded product decision.)
- [ ] Prioritization of the deferred security follow-ups (F1 is a live critical) relative to product roadmap work — an engineering-urgent input, not a product feature.
