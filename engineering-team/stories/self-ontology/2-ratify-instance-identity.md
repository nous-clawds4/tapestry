# Story 2: Ratify instance identity — the TA is the instance's "me"

**Status:** Approved
**Created:** 2026-08-05
**Type:** Doc
**Epic:** `self-ontology`
**Book:** `shared-concepts-adoption` (F0 — the suite's prerequisite)
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Background

Specs and features keep reaching for a first person — the stamping floor's "personal `z`"
([stamping spec](../../../protocols/drafts/stamping.md) write rule item 1), the
[shared-concepts](../../../protocols/drafts/shared-concepts.md) aggregates' observer, the S-subset
definitions S2a/S3a ("where **I** am the user" — `stories/_intake.md` entry 2026-08-05) — but a
deployment holds several keys (the owner's main pubkey, the TA, multi-tenant customers' relay keys),
and worksheet W13 documents the identity fracture across stores. BIBLE §30 settled which *store*
holds the self; which *key* speaks for it was folklore.

The owner settled it on 2026-08-05 (worksheet W15; scoping captured in
`docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md`, 🔴 OPEN): **the Tapestry instance is its own person; the
TA pubkey is that person's key; the Tapestry Owner is a distinct correspondent** — Tony Stark to the
instance's Jarvis — privileged in trust, not in identity, whose content enters the instance's brain
only by explicit absorption (TA re-mint or TA-authored pointer).

Ratification matters now because: the adoption suite's queries (F1–F5) need `authors:[TA]` as
doctrine rather than folklore; the [assistant-designation
draft](../../../protocols/drafts/assistant-designation.md)'s "TA = the user's delegate" frame needs
the two-layer reconciliation stated canonically (a session reading only that draft would reasonably
"correct" first-person code the wrong way); and tapestries-#7's deferred client-signed-path question
needs its answer discoverable.

**Who is affected:** every future contributor and agent session touching identity, absorption, or
S-subset queries — and the owner, whose letters must never be silently identity-merged.

## User-facing description

As **the owner of a Tapestry instance**, I want the canonical spec to state that **the instance is
its own person whose key is the TA**, with me as a distinct maximally-trusted correspondent, so that
every "which events are mine?" question has one answer (`authors:[TA]`), owner-content absorption is
always an explicit auditable act, and nobody — human or agent — re-frames the TA as merely my second
key.

## Acceptance criteria

Testable from the outside (doc-level inspection).

- [ ] BIBLE gains top-level **§31 "The Self and Its Keys"**, sibling of §30, stating: the instance
      is its own person; the TA pubkey is its key; the Owner is a distinct correspondent privileged
      in trust, not identity; the instance's first-person queries answer `authors:[TA]`.
- [ ] §31 states the **two-layer reconciliation**: assistant-designation governs the external
      question ("what does this *human* think?" — personal-signed wins, TA-designated fallback),
      byte-unchanged; §31 governs the first-person question; the **custody-asymmetry security
      rationale** is stated (the hot server key must never shadow the cold interactive key's
      deliberate statements).
- [ ] §31 records **operator variability** (one human usually holds both nsecs; a paid
      administrator — human or LLM — may hold the TA's) as the proof identity attaches to the
      *instance*, not the key custodian — and that absorption is therefore always an **explicit
      act**.
- [ ] §31 defines the two **absorption modes** — re-mint (first-class owned state the TA can evolve
      and re-sign; restore-brain precedent, second-brain ADR 0008) and pointer (provenance
      preserved, no copy drift) — as vocabulary; states the choice is **per-feature** (made in each
      feature's ADR); and names the provenance-link sub-question as per-feature.
- [ ] §31 states the **tapestries-#7 ruling**: the brain-first hook's owner lane stays near-term
      (eager absorption of a maximally-trusted correspondent's letters); stage-2 letter ingest
      (OPEN.md #136) routes owner letters through the general provenance-carrying lane; **no
      permanent "counts as me" carve-out**.
- [ ] §31 **scope**: normative for the single-owner personal deployment; multi-tenant stated as
      direction in one paragraph (each provisioned persona's instance-side identity = its delegated
      key: owner → TA, customer → relay key; W13's resolver direction).
- [ ] §30 and §31 **cross-reference** each other ("§30 governs stores; §31 governs keys"); the BIBLE
      ToC links §31; anchors resolve; the BIBLE header "Last updated" line and changelog row are
      updated.
- [ ] The **assistant-designation draft** gains a short cross-reference note naming the two-layer
      split; its wire format and precedence rules are byte-unchanged.
- [ ] **Worksheet W15 flips to Graduated → BIBLE §31** (the entry records the handoff per worksheet
      convention); **W16 untouched**.
- [ ] `docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md` flips to **✅ SUPERSEDED** (all of its content
      ratifies — unlike story #1's partial case), annotated with where each piece landed.
- [ ] An **ADR at `decisions/self-ontology/0002`** records the ratification decision, the rejected
      alternatives (owner-as-"me"; key-union / most-recent-wins-across-signers), and precisely what
      stays per-feature.
- [ ] `npm test` stays green and `bash scripts/harness-lint.sh` is clean.

## Concepts touched

None expected — the subject is key identity, not concepts *in* the graph (the stack answers at
`:7778`; the Architect re-checks via the concept-graph orientation if any handle turns out to be
needed). Named in plain language: the TA identity and its runtime resolution
(`src/utils/assistantKeys.js`), BIBLE §30, the assistant-designation / stamping / shared-concepts
drafts, worksheet entries W15 / W13 / W16.

## Out of scope

- **All code changes** — S-subset queries, absorption endpoints, stage-2 ingest,
  `resolveProvisionedDelegate`, and every other consumer of the doctrine. F1–F5 build on it in their
  own stories.
- **Any assistant-designation change beyond the cross-reference note** — wire format and precedence
  are byte-unchanged.
- **W16** (the deliberately-private marker) — F5's question, untouched by F0.
- **Multi-tenant normativity** — direction only, one paragraph.
- **CLAUDE.md** — owner-decided at planning (2026-08-05): untouched. The file sits at its exact
  190-line cap; invariant 4 already routes readers into §30, and §30 cross-links §31. If suite work
  later shows sessions misreading TA identity, a targeted condensation gets its own change.

## Open questions

None blocking. Resolved during planning (owner decisions, 2026-08-05):

- *Book bookkeeping?* The suite is the book — `audits/shared-concepts-adoption/book.md` opened
  eagerly at this story's Planning, anchored on the 2026-08-05 intake entry; `self-ontology` is this
  story's epic; F1–F5 pick epic homes at their own Planning.
- *CLAUDE.md pointer?* No (see Out of scope).

For the Architect: the one judgment call is **how much of the handoff's reasoning belongs in §31
versus the ADR** — the section should be normative and durable, not a transcript of the scoping that
produced it.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: **skipped — docs-mode** (no executable behavior; the Reviewer performs an accuracy and
  cross-reference audit instead, and runs `npm test` to confirm no regression)
- Review: (filled in after Review phase)
