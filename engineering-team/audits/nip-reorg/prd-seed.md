# PRD Seed: the Shared-Concepts protocol stack (NIP suite)

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/nip-reorg/audit.md`
**Anchor:** acceptance frame in `book.md` (eager; sourced from `docs/NIP_REORG_DESIGN_HANDOFF.md`)
**Confidence:** high
**Date:** 2026-07-13

> Reverse-engineered baseline in PRD shape for the protocol-docs product this book built. Strawman for the product team, not a ratified spec. Tags: `[FROM FRAME]`, `[INFERRED]`, `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` A layered, individually-publishable suite of protocol specifications by which **independent deployments and clients converge on shared concepts without a privileged center** — no canonical authority, no global consensus claims; convergence is measured deference, observer-resolved. `[INFERRED]` The suite is also the publication vehicle: each layer can graduate the status ladder (pre-NIP → publish-ready → published) on its own cadence because stability tiers were separated by design.

## 2. Personas

`[INFERRED]` from story "As a…" lines and the S3 framing:

- **The protocol author** — designs the conventions; needs open questions to have citable homes (worksheet + in-spec Open sections) and history preserved verbatim.
- **The independent implementer** — builds a foreign deployment/client; needs one document per layer, each fact normative in exactly one place, and an explicit read contract stating what may be assumed.
- **The consumer-client developer** — `[FROM FRAME/S3]` explicitly split into *smart clients* (expand queries by walking `s`/`b` structure) and *dumb clients* (plain `#z` filters) — the write-time stamping selection sets the interop floor for the latter.
- **The reference-deployment operator** — `[INFERRED]` runs the partially-implemented half (dual-`z` writers, firmware pointer-`b` seeds) ahead of the unimplemented half (resolver, clouds).

## 3. Scope (as-built)

`[FROM FRAME]` The four-NIP organization, live under `protocols/`:

| Layer | Document | Status |
|---|---|---|
| Base kinds + `z` | decentralized-lists (published; update pending) | pre-existing |
| Data model | tapestry-concepts (§ Multi-`z` now a pointer) | pre-existing, slimmed |
| Primitive: `b` | inherit-from (§ Aggregation now a pointer) | pre-existing, slimmed |
| Primitive: `n`/`s` | **class-thread-relationships** (renamed) | this book |
| Policy: convergence | **shared-concepts** (new) | this book |
| Policy: publisher | **stamping** (new; carries open W14) | this book |

Plus: the vocabulary policy in living text (deference/convergence/convention; observer-relative rule), W14 opened, BIBLE §22/§23 aligned, consumer specs (tags, communities) cross-referenced.

## 4. Domain model

`[INFERRED]` from the shipped specs: **concepts** (headers addressed `39998:<pubkey>:<slug>`) joined by **items** via `z` stamps; **affiliation** (pointer-`b`, navigation, zero aggregation weight v1) vs **deference** (inherit-`b`, the aggregable signal); **clouds** (derived top-k of an observer's aggregated deference — never a published object); **structure** (`s`/`n` → derived `IS_A_SUPERSET_OF`/`HAS_ELEMENT`, authorship-gated); **stamps** (personal `z` required + affiliation-anchored cloud handles, capped, lazily re-emitted).

## 5. Design rules (as-built)

`[FROM FRAME]` Single normative home per fact; primitive/policy split by stability tier; no "canonical"/"consensus" in normative text; every aggregate is an observer's view; histories (ADRs, worksheet resolutions) never rewritten — superseded in living docs only. `[INFERRED]` Open questions ship *inside* specs as explicitly non-normative sections cross-linked to worksheet entries; write rules and read contracts co-stated on one page.

## 6. Carry-forward & open questions

Promoted from audit §6: settle **W14** (two-axis layer selection + read contract) via a protocol-spec `/discuss`; specify the **correspondence closure** (same discussion); **pins dual-`z` parity** (implementation); **target-typed tag definitions** (W10 lineage, pushed back but unresolved); **W1** identity trajectory; **publication ladder** decisions per draft; promote #344–#348 to main.

## 7. What product must validate

- [ ] `[UNKNOWN]` **Publication intent and order** — which of the three drafts (shared-concepts, class-thread-relationships, stamping) should pursue publish-ready status, and in what order relative to settling W14 (publishing Stamping with a large open section is legitimate but is a choice).
- [ ] `[UNKNOWN]` **Priority: settle W14 vs build** — does the next phase settle layer-selection on paper, or ship implementation (resolver groundwork, pins dual-`z`) against the already-ratified subset of the write rule?
- [ ] `[UNKNOWN]` **Event-tagging sequencing** — whether `nostr-event-tag` (W10) should land before or after W14 settles, since its items are exactly the stamped-item class the open question governs.
- [ ] `[INFERRED — confirm]` The smart/dumb-client interop-floor framing as the product's actual compatibility target (which clients must work with zero graph-walking capability?).
