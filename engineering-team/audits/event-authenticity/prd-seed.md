# PRD Seed: Event authenticity at the publish boundary

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/event-authenticity/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high *(frame-grounded and shipped; product-vision framing is inferred)*
**Date:** 2026-09-11

> Reverse-engineered baseline in PRD shape, from what shipped. This was a **security fix**, not product discovery — the frame-grounded mechanics are solid `[FROM FRAME]`; the "product" framing is `[INFERRED]` scaffolding for the product team.

## 1. Product vision
`[INFERRED]` The knowledge graph is only trustworthy if a node attributed to an author was actually signed by that author. `[FROM FRAME]` Events entering the graph through the control panel's publish endpoint must carry a signature valid for their claimed author; a forged event must never reach the relay, Neo4j, or the tapestry store.

## 2. Personas
- `[INFERRED]` **Any nostr user / client** — publishes their own signed events (permissionless).
- `[FROM FRAME]` **Impersonator (anti-persona)** — presents an event claiming to be authored by the instance's assistant/owner but not signed by them; must be rejected by signature verification.
- `[INFERRED]` **The web-of-trust reader** — consumes the graph and relies on attributed authorship being genuine.

## 3. Scope (as-built)
`[FROM FRAME]` In scope, shipped: signature verification on the `POST /api/strfry/publish` client path, before the relay import and the derived graph/store write; permissionless publishing preserved; the destructive `d`-tag-reuse overwrite closed. `[INFERRED]` Out of scope (future): the other unverified-ingest / missing-gate surfaces (F3–F5), sandbox propagation.

## 4. Domain model
`[INFERRED]` Entities: **published event** (nostr event, any kind, signed by its `pubkey`); **the definitive graph** (Neo4j "me") and **tapestry store** (LMDB), into which one class of published event (the instance's own kind-39999 tapestry letters) is learned. The authenticity gate applies to all client-path events uniformly; no concept/schema change.

## 5. Design rules (as-built)
`[FROM FRAME]` Authenticity, not authorization — publishing is not gated by *which* author, only by whether the claimed author signed it. `[INFERRED]` Verification is performed in the application at the publish boundary, not delegated to the relay's own import (which does not signal rejection via exit code). `[INFERRED]` Signed-event verification reuses nostr-tools with a JSON round-trip (no trust of a client-attached cache).

## 6. Carry-forward & open questions
Promoted from build audit §6 — F3 (io-import no-verify + Cypher injection), F4/F5 (authorization gaps, separate track), sandbox propagation, the private advisory update (F1 now fixed), and the deferred publish-reporting honesty issue. See audit §6.

## 7. What product must validate
- [ ] Are F3–F5 (the remaining unverified-ingest / missing-gate surfaces) a single next security phase, or separately prioritized against roadmap work? (Engineering-urgent input, not a product feature.)
- [ ] Is there any product need to accept *unsigned* content on any publish path (there is none today), or is signature-required universal? (Confirms the as-built rule.)
