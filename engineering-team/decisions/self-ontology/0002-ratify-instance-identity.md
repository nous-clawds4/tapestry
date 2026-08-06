# ADR 0002: Ratify instance identity — a sibling §31 "The Self and Its Keys"

**Status:** Accepted
**Date:** 2026-08-05
**Story:** `engineering-team/stories/self-ontology/2-ratify-instance-identity.md`
**Mode:** Docs-mode (Protocol-Spec Workflow phase 3 — Test Design skipped)

## Context

The owner settled the instance-identity question on 2026-08-05 (worksheet W15; scoping captured in
`docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md`, 🔴 OPEN at the time of this ADR): **the Tapestry
instance is its own person; the TA pubkey is that person's key; the Tapestry Owner is a distinct
correspondent** whose content enters the brain only by explicit absorption (re-mint or pointer).
This ADR decides **how to ratify** that into the canonical spec. No code, no concept/schema change,
no wire format.

**Why it matters:** the adoption suite's S-subset queries (F1–F5, `stories/_intake.md` 2026-08-05)
need `authors:[TA]` as doctrine rather than folklore; the
[assistant-designation draft](../../../protocols/drafts/assistant-designation.md) frames the TA as
the *user's delegate* ("authors my headers on my behalf," personal-signed wins) — a session reading
only that draft would reasonably "correct" first-person code the wrong way; and tapestries-#7's
deferred client-signed-path question needs its doctrinal answer discoverable.

**The ADR-0033 constraint, inherited via ADR 0001: the section must not present unbuilt behavior as
present.** The material sits at three confidence levels:

1. **True by decision, effective on ratification** — the doctrine itself, the first-person rule,
   the two-layer reconciliation, the absorption vocabulary (both modes have *shipped* precedents:
   restore-brain re-mint, second-brain ADR 0008; letter-projection, tapestries ADR 0007).
2. **Rulings binding future work, not yet built** — the stage-2 ingest routing for owner letters
   (stage-2 does not exist; OPEN.md #136); the multi-tenant delegate direction (W13's resolver is
   planned, not built). Also: assistant-designation itself is *specified, not yet wired* (its own
   Deployment-status section says so) — §31 must not imply the 10040 resolution runs anywhere.
3. **Deliberately per-feature / open** — re-mint vs pointer per absorbing feature; the
   provenance-link sub-question; multi-tenant normativity.

**Existing-ADR consistency check:** no conflicts. Community-reference ADR 0030's TA-seeded
affiliation headers *are the instance's own headers* under the doctrine — compatible, gloss only.
ADR 0015's `LEGACY_*` exception, the security-auth-exposure gates, and §27's three-PoV standard are
untouched. §30 (self-ontology ADR 0001) is *extended by a sibling*, not amended.

**Constraints:** CLAUDE.md untouched (owner-decided at planning; file at its exact 190-line cap).
BIBLE/protocols/docs are **not** harness def paths (`scripts/harness-def-paths.txt` lists records
out deliberately) — **no L10 CHANGELOG row required**, unlike story #1, which touched CLAUDE.md.
Concept-graph orientation done (stack up at `:7778`, TA `11f23fe4…93767` runtime-resolved): no
domain-concept schema changes; **firmware reinstall: no**.

## Options considered

### Option A — Sibling `## 31. The Self and Its Keys`, five-block structure, minimal-diff satellites

New top-level §31 between §30 and the footer, mirroring §30's register (bold thesis, one table,
normative prose, ADR pointer at close). Five blocks:

1. **The doctrine (ratified)** — persons-and-keys table (TA = the instance's "me," hot,
   server-resident; Owner main pubkey = the principal correspondent, cold, interactive; customer
   relay keys = direction only), the first-person rule (the instance's own queries answer
   `authors:[TA]`), the Tony Stark / Jarvis gloss (one parenthetical sentence), and operator
   variability — one human usually holds both nsecs, but a paid administrator (human or LLM) may
   hold the TA's; identity attaches to the **instance**, not the key custodian.
2. **The external layer (unchanged)** — the two-questions split ("what does this *human* think?" vs
   the instance's first person); assistant-designation byte-unchanged; the custody-asymmetry
   security rationale (the hot server key must never shadow the cold interactive key's deliberate
   statements).
3. **Absorption** — an explicit act, never a silent identity merge; re-mint / pointer vocabulary
   with the shipped precedents; per-feature choice + the named provenance-link sub-question; the
   tapestries-#7 ruling with the stage-2 routing explicitly marked *a ruling about future work*.
4. **Scope** — normative for the single-owner personal deployment; multi-tenant one-paragraph
   direction (persona → delegated key; W13), marked not-built.
5. **Close** — ADR 0002 + handoff pointer.

Satellites: ToC row; one cross-ref sentence closing §30's intro ("which *key* speaks for the self
is §31's subject"); §16 ✅ row; header freshness line; a short
`## Relationship to instance identity (BIBLE §31)` section in assistant-designation (placed before
its Deployment-status section); W15 → Graduated with a Resolution paragraph (the W5/W11/W14 format,
heading byte-unchanged so anchors survive); handoff → ✅ SUPERSEDED with a landing map.

- **Pros:** matches W15's own framing ("§30 governs stores, this governs keys") and §30's clean
  store-scoped ADR trail; the confidence-level boundary lives in the *structure* (the 0001/0033
  principle) — rulings-about-future-work are visually distinct from ratified doctrine; every
  satellite is minimal-diff; anchors stay stable everywhere.
- **Cons:** one more top-level section in an already-long BIBLE; two sections now share the "self"
  topic (mitigated by mutual cross-refs).

### Option B — Fold into §30 as a "The self and its keys" subsection

- **Cons (dispositive):** §30's changelog trail, "Last updated" provenance, and ADR 0001's
  implementation notes all describe a store-scoped section; a key-doctrine graft muddies that
  record and forces either retitling §30 or shipping a section whose title no longer covers its
  content. The worksheet's own graduation target says sibling. **Rejected.**

### Option C — Land the doctrine in `protocols/` (extend assistant-designation)

- **Cons (dispositive):** protocols/ is for *wire formats* (protocols-directory ADR 0001); this
  doctrine defines no tags, kinds, or reader rules — it is self-ontology, exactly §30's genus.
  Burying the instance's first-person doctrine in a reader-resolution companion spec would
  *recreate* the confusion the story exists to close. **Rejected** — assistant-designation gets
  only the cross-reference note.

## Decision

**Option A.** On the story's flagged judgment call (handoff reasoning vs §31 prose), ADR 0001's
rule of thumb holds verbatim: **BIBLE gets definitions and rules; the handoff keeps derivations.**
Concretely: §31 gets the doctrine, the first-person rule, the two-layer split, the custody
rationale (one sentence — a *rule justification*, load-bearing for future key decisions), the
absorption vocabulary, the rulings, and the scope. It does **not** get the scoping dialogue, the
S-subset payoff analysis (the suite's business, cited from the book), or the "mostly ratification
of existing practice" code inventory (ADR/handoff material). The Jarvis gloss ships as one
parenthetical sentence in block 1 — memorable, owner-approved, and precedented by §30's literary
register ("a letter is derivable from me; a letter is not me").

## Consequences

- **Enables:** F1–F5 cite §31 for every first-person query (`authors:[TA]`); the
  assistant-designation tension is closed canonically; stage-2 ingest design (OPEN.md #136)
  inherits its owner-letter ruling; W15 graduates.
- **Constrains:** future identity-model changes must amend §31 (and keep §30/§31 sibling
  coherence); the stage-2 ruling binds that future story's design.
- **Debt:** the `tapestry-assistant` graph concept's description ("profiles that correspond to
  tapestry assistants") could someday absorb the doctrine — cosmetic, out of scope, no firmware
  change now.
- **Firmware reinstall required? No.**

## Implementation notes

Docs-mode — seven files, all prose. Locate by quoted content (line numbers are current-state
anchors).

1. **`BIBLE.md`** — insert `## 31. The Self and Its Keys` after §30's close (~line 1824, before
   the footer `*This document is maintained…*`); ToC row `31.` after the §30 row; one cross-ref
   sentence at the end of §30's intro paragraph (~1767); §16 ✅ row appended after the brain-first
   row (~1407); `**Last updated:**` line (~8) prepended per convention.
2. **`protocols/drafts/assistant-designation.md`** — new short section
   `## Relationship to instance identity (BIBLE §31)` immediately before
   `## Deployment status (not normative)`: this spec is the external layer (readers resolving a
   *human's* headers); the instance's first person is the TA per §31; the "on my behalf" framing is
   the external view; wire format and precedence byte-unchanged.
3. **`protocols/worksheet.md`** — W15 status →
   `Graduated → BIBLE §31 · raised 2026-08-05 · resolved 2026-08-05`; append a **Resolution**
   paragraph (doctrine one-liner + the two-layer split + per-feature absorption + refs gaining
   ADR 0002/§31); heading byte-unchanged (anchor stability). W16 untouched.
4. **`docs/INSTANCE_IDENTITY_DESIGN_HANDOFF.md`** — status → `✅ SUPERSEDED` with a landing map
   (handoff §§1–8 → §31 blocks / ADR 0002); body kept for history.
5. **`engineering-team/stories/self-ontology/2-ratify-instance-identity.md`** — Linked artifacts:
   ADR path.
6. **`engineering-team/epics/self-ontology.md`** — ADRs line: "0002 lands with story 2" →
   "0002 (story 2; instance identity)".
7. **Gates:** `npm test` green; `bash scripts/harness-lint.sh` clean; anchor check on
   `#31-the-self-and-its-keys`; **no** `engineering-team/CHANGELOG.md` row (no def path touched);
   **no** `scripts/` edits.

## Out of scope

All code (S-subset queries, absorption endpoints, stage-2 ingest, `resolveProvisionedDelegate`);
any assistant-designation change beyond the note; W16; multi-tenant normativity; the
`tapestry-assistant` concept-description refresh; CLAUDE.md.
