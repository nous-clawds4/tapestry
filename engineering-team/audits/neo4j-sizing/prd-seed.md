# PRD Seed: Deployment Memory Profiles

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/neo4j-sizing/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-08-28

> Minimal seed: this book is operations infrastructure with **no user-facing product surface**.
> It exists so the return edge stays unbroken, not because a product phase is expected.

## 1. Product vision
`[INFERRED]` Tapestry instances self-size their database sensibly for the machine class they
actually run on — dedicated droplets automatically, shared-VM dev machines by explicit profile —
so operators never meet a resource crash loop.

## 2. Personas
`[INFERRED]` The instance operator (dev machine or droplet). No end-user contact.

## 3. Scope (as-built)
`[FROM FRAME]` Opt-in env override for Neo4j memory; formula default untouched and
regression-pinned; local dev profile in `.env`.

## 4. Domain model
None — no concepts, events, or stored shapes.

## 5. Design rules (as-built)
`[INFERRED]` Infrastructure defaults change only opt-in; "no change" claims are pinned by tests
that execute the real script; healthy deployments are never resized implicitly.

## 6. Carry-forward & open questions
Promoted from audit §6: opportunistic prod check post-deploy; legacy `install-neo4j.sh` cleanup.

## 7. What product must validate
- [ ] Nothing — no product decision is pending. If a future phase productizes deployment
      profiles (e.g., an admin UI for resource config beyond the existing read-only overview),
      it starts from `/discover`, not from this seed.
