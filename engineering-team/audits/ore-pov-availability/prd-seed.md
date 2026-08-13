# PRD Seed: Honest personalization for Open Ranking consumers

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/ore-pov-availability/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high
**Date:** 2026-08-13

> Reverse-engineered baseline in the product-team PRD shape — a strawman for `/discover`, not a ratified spec. Sections tagged `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A client asking this provider for *personalized* trust scores can always trust the label: results are personalized to the requested POV, or the request fails with an explanation and a usable alternative — never silently answered from someone else's point of view. `[INFERRED]` The wider play: Brainstorm doesn't just implement the Open Ranking protocol, it *shapes* it — the same honesty rule was drafted as an upstream spec change (maintainer-endorsed direction, issue #8), positioning per-POV honesty as a protocol norm rather than a house quirk, and pre-aligning the eventual NosFabrica adoption.

## 2. Personas

- `[FROM FRAME]` **ORE client developer** — integrates the HTTP surface; needs to *know* whether personalization happened, and what to do when it can't (re-request global explicitly; tell their user).
- `[FROM FRAME]` **Protocol contributor (the operator, as wds4)** — needs a submission-ready artifact to carry the rule upstream under their own name.
- `[INFERRED]` **Downstream product on a Brainstorm provider** (the les-femmes-orange class): today gets silently-global results from the NosFabrica deployment; after adoption there, gets the explicit contract — but only if the client is updated *first*.

## 3. Scope (as-built)

`[FROM FRAME]` Informative `422` refusal (gate-open unprovisioned pov) with registry-derived guidance; never-substitute pinned by tests; gate-off default byte-identical (anti-oracle preserved); upstream proposal artifact (ORE-01 subsection + endpoint error-table rows, `Closes #8`); `/developers/open-ranking` contract section; W12/BIBLE/protocols-README alignment. Shipped to production (PRs #549/#550). `[INFERRED]` deliberately **out**: W12 auth, any public gate-open, `202` support on this provider (no "still computing" state exists), reason-code taxonomy, personalized search (W13), NosFabrica changes, the act of submitting the upstream PR.

## 4. Domain model

`[INFERRED]` No new entities. Reuses: **provisioned POV** (owner or customer with WoT metrics on this instance) as the availability test; the **capability-document registry** (first element = default algorithm) as the single source for both advertised algorithms and refusal guidance; the `X-Reason`/`body.error` error convention (ORE-00).

## 5. Design rules (as-built)

- `[FROM FRAME]` **Never substitute a POV**: a personalized request is answered from the requested POV or refused — the CLAUDE.md POV-first invariant expressed as an API contract.
- `[INFERRED]` **Refusals inform**: an error names what the caller can do instead, and the guidance is *derived* (from the registry), never hardcoded prose that can drift.
- `[INFERRED]` **Security posture is orthogonal to honesty**: the informative refusal lives behind the same gate as before; honesty improvements must not widen the enumeration oracle (gate-closed responses stay indistinguishable).

## 6. Carry-forward & open questions

Promoted from audit §6: the wds4 upstream submission (OPEN.md 176) + post-merge phrasing alignment; the ORE-08 gap (maintainer's call); W12 auth as the standing blocker to public personalized stats; **NosFabrica adoption with client-first ordering** (les-femmes-orange handles the error before the provider flips); personalized search (W13).

## 7. What product must validate

- [ ] **NosFabrica rollout sequencing** — who owns the les-femmes-orange client change, and what's the coordination window between client handling and provider flip? (The operator's stated plan: separate session/effort.)
- [ ] **Priority of W12 auth** — the informative refusal is invisible in production until personalized stats can be served publicly; is unlocking that (ORE-A/NWT or self-only auth) worth scheduling now, or does it wait for demand?
- [ ] **Reason codes** — if upstream or client developers ask for machine-branchable causes (beyond the `202` split), does a small enumerated vocabulary become worth proposing as a future ORE?
- [ ] **Upstream relationship** — if the maintainer requests changes on the PR, how much divergence from our shipped `X-Reason` phrasing do we accept before re-aligning the implementation?
