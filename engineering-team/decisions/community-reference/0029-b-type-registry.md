# ADR 0029: `b`-tag type registry — `"pointer"` | `"inherit"`, type-gated semantics

**Status:** Accepted
**Date:** 2026-06-12
**Story:** `engineering-team/stories/community-reference/33-b-type-registry.md`
**Amends:** ADR 0027 (the element-3 `default "inherit"` reading and the all-`b`-tags-derive-`INHERITS_FROM` derivation) and ADR 0028 (the ungated resolution walk/closure). Their bodies are immutable; each gains an **Amended by** header pointer.
**Design source:** [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D2, D3, D1 rev 2, H2, §3) — all four planning-gate flags resolved by the protocol author 2026-06-12.
**Citation hygiene:** an unrelated `engineering-team/decisions/profile/0029-*.md` exists; ADR ids are epic-scoped, so cite this decision as **community-reference ADR 0029** with the epic-scoped path.

## Context

ADR 0027 ratified the `b` tag with element 3 as an extensible **type** ("Reserved future types … are not defined here"), defaulting to `"inherit"`; ADR 0028 ratified the resolved-definition walk over *all* `b` tags. The b-tag affiliation design session (handoff doc above) settled that this defaults the wrong way:

- The protocol must never *assume* deference. The communities founding tenet makes centralization "a hard opt-in, expressed in your own declaration"; a firmware-seeded `b` that defaults to live inheritance would subscribe every deployment's definitions to the blessed curator's future edits by default (handoff H2; blocks P2, the `communityReference` seeding story).
- The W1 consensus signal ("everyone who defers to this definition") must measure *deliberate* deference; default-inherit seeds would manufacture the consensus they're supposed to measure.
- A non-deference type is the **chain-breaker** that keeps transitive affiliation safe (no one is affiliated through a judgment-free link) and cheap (the default type terminates closure walks).

Nothing is deployed: zero `b` tags exist on any wire, zero resolver/emitter code exists (`INHERITS_FROM` appears nowhere in `src/`), and the inherit-from spec is an unpublished pre-NIP. The change is documentation-only with no migration. Concept graph: no live concepts are touched; no handles to resolve (story §Concepts touched); **no firmware reinstall**.

Constraints: each wire format normative in exactly one place (`protocols/README.md` boundary rule — the registry lands in [protocols/drafts/inherit-from.md](../../../protocols/drafts/inherit-from.md), BIBLE sections stay pointers); the published base NIP working copy must not be edited; ADR/story bodies are immutable records; BIBLE §22's REFERENCES **collision contract is binding** (`BIBLE.md:1442`).

## Options considered

### Option A — two-value type registry on `b`'s element 3 (chosen)
`"pointer"` (correspondence/locator; no deference, no resolution semantics) and `"inherit"` (live definitional deference; current semantics). Absent element 3 reads as `"pointer"`. All type-dependent semantics — resolution walk, edge derivation, aggregation, transitivity — gate on an **explicit** `"inherit"`.
*Pros:* no new letter (W2); one `#b` index serves discovery of both postures in one filter; fail-safe default (sloppy emitters get the weakest semantics); closes W5 via its option (a); the seed/deliberate distinction is carried on-wire.
*Cons:* element 3 is non-indexed, so relays cannot filter `#b` by type (fetch-then-filter); spec text becomes type-conditional; the explicit `inherit` becomes load-bearing for the Communities affiliation pointer.

### Option B — a dedicated single-char letter for the pointer relationship
What BIBLE §22's deferred list and W2 anticipated (`REFERENCES` as its own future letter).
*Pros:* relay-indexed type separation — pointer vs inherit distinguishable in the filter.
*Cons:* burns a scarce letter (W2's stated conservatism); splits the affiliation map across two indexes, so discovery walks (which want *both* postures) cost two filters instead of one; relay-side separation is rarely needed — consensus is computed locally over materialized edges, discovery wants the union. Rejected.

### Option C — single-type `b` (inherit-only; no pointer type)
Proposed and withdrawn at scoping (handoff D2, "collapse-to-inherit-only reviewed and rejected").
*Cons are fatal:* firmware seeding becomes deference-assumed-by-protocol (tenet inversion); the consensus signal is corrupted by seeds (H2); every link becomes transitive, removing the chain-breaker. Rejected — recorded here so P1's gate isn't re-litigated.

*(Sub-option, rejected at the planning gate: requiring an explicit type on every `b` tag with no default. Stricter wire, but breaks three-element ergonomics for no safety gain over the pointer fail-safe.)*

## Decision

We chose **Option A**, with these fixed points:

1. **Registry:** element-3 values `"pointer"` | `"inherit"`; closed at two values in v1; an **absent element 3 reads as `"pointer"`** (least-commitment fail-safe), superseding ADR 0027's `default "inherit"`. The value `"pointer"` was chosen over the handoff's working name `"reference"` at the planning gate, to avoid colliding with the legacy REFERENCES relationship/edge vocabulary; the spec notes the lineage (this *is* W5 option (a) realized). Future types (e.g. ADR 0027's anticipated divergence marker) require a new ADR.
2. **Resolution gate (filter polarity matters):** the resolution walk, root definition, first-listed-wins order, and deference closure all range over `b` tags carrying an **explicit `type == "inherit"`** — never "not pointer", since absent reads as pointer. A node with only pointer-typed `b` tags is a resolution root.
3. **Derivation gate:** inherit-typed → `(child)-[INHERITS_FROM]->(parent)` (canonical, asserted, no `source` — unchanged). Pointer-typed (including absent) → a concept-level **`REFERENCES` edge with `source: 'b-tag'`**, direction child→target, **no flip** (same rationale as `INHERITS_FROM`: incoming edges enumerate "who points here"). BIBLE §22's collision contract is extended: this is the **third producer class** of `REFERENCES` (after tag-level ingest and firmware-community stubs) and the first *asserted, wire-derived* one; consumers MUST disambiguate by `source` value (`'b-tag'` vs `'firmware-community'` vs unset tag-level), and the contract's endpoint clause is widened, since `b` rides on kinds 39998 *and* 39999.
4. **Aggregation:** the W1 consensus signal counts inherit-typed edges only; pointer-typed edges carry **zero weight in v1** (graded weighting deferred to the future registry ADR, per ADR 0027's existing deferral). **Discovery/correspondence walks include both types.** Because element 3 is non-indexed, `#b` enumeration returns both types — consumers fetch-then-filter; this is named in the spec.
5. **Transitivity (type-split rule):** affiliation-for-aggregation = the target header appears in the **inherit-only deference closure**; a pointer-typed link breaks the chain and affiliates only its own author. Closure membership is a set — multi-`b` order is irrelevant to membership (order matters only for field resolution, over the inherit subset).
6. **Multi-z carve-out (position, ratified here):** deliberately-published list items MAY carry multiple `z` stamps (one event joining multiple concepts) — a Tapestry-layer position diverging from the base NIP's one-`z`-per-event *recommendation* (no spec conflict: the published NIP explicitly permits multi-z; its working copy is not edited). **Normative home: `tapestry-concepts.md`** (the "fundamental link" section), with BIBLE §5 and the §21 z-tag glossary entry restating, and BIBLE §10 Rule 2 clarified to "at least one valid parent pointer." The full practice (cloud formation, stamping rules) is *not* designed here — it graduates to **new worksheet entry W11**.
7. **Worksheet ledger:** W5 → **Graduated → inherit-from spec** (the format's graduation arm fits: the wire form ratified into a spec); W1/W2/W6 get ref + wording updates per the inventory; **W11 added** (cloud formation / multi-z stamping rules, carrying handoff O11/O12).
8. **Titles stay.** BIBLE §25 keeps "The Inherit-From Tag (`b`)" (protocols-directory rule: migrated sections keep number and title; avoids TOC/anchor churn) and `inherit-from.md` keeps its filename/title; both open with the two-type registry framing so the inherit-only impression is corrected in the first paragraph.

## Consequences

- **Enables P2** (firmware seeds pointer-typed `b` without assuming deference) and the honest dev-fiat → registry → grapevine handover (seed vs deliberate is measurable on-wire).
- **W5 closes; W2 stays clean** (a letter saved; `REFERENCES` leaves the candidate-letter list).
- **Constrains:** relay-side type filtering is impossible (fetch-then-filter is the documented cost); the Communities spec must always write the explicit `inherit` type — element 3 becomes load-bearing for affiliation; spec prose is type-conditional everywhere the walk is described.
- **New debt / follow-ups:** W11 (cloud/stamping design); graded pointer weighting (future registry ADR); the §22 contract now has three producer classes — any future `REFERENCES` consumer must filter on `source` (already binding, now with more reason); a possible future "inherit the fields, not the chain" type value if a consumer ever needs definitional inheritance without affiliation transitivity (parked in the handoff).
- **Firmware reinstall required?** No — documentation only; no concept definitions, schemas, or events change.

## Implementation notes

Docs-mode: the Implementer authors spec/BIBLE/worksheet text; `npm test` must stay green; no source files. Work from the edit-site inventory below (sweep-verified line numbers as of `e808ecb4`; re-locate by quote if drifted). Mirror the handoff's settled wording; cite **community-reference ADR 0029** (epic-scoped path — a `profile/0029` exists).

**`protocols/drafts/inherit-from.md`** — the normative home; 12 sites:
- `:4` Sources metadata — add ADR 0029. `:11`/`:15` — widen framing: `b` is a two-type write primitive ("my definition is theirs unless I override" describes only `"inherit"`). `:19–21` tag table — split/annotate rows: inherit → `INHERITS_FROM`; pointer (incl. absent) → `REFERENCES` + `source:'b-tag'`, child→target, no flip. `:23` wire format — the registry, absent = `"pointer"`, add a pointer-typed example. `:29` multi-parent — first-listed-wins over the inherit-typed subset; mixed-type multi-`b` expressible. `:33–35` derived relationship — type-gated derivation; specify the pointer edge's direction + `source`. `:39`/`:41` resolution + closure — walk inherit-typed only; **new transitivity text lands at the closure paragraph** (affiliation = inherit-only closure membership; pointer breaks the chain). `:46–47` — first-listed-wins gloss + root redefinition (no *inherit-typed* `b`). `:58`/`:63` pseudocode — `for parent in node.b-tags where type == "inherit"` (explicit-inherit filter, never not-pointer). `:67–69` Scope (v1) — registry closed at two values; pointer weight zero in aggregation v1. `:73` security — trust-coupling scoped to inherit; fail-safe rationale (absent = pointer ⇒ no accidental deference). `:75–77` aggregation — consensus inherit-only / discovery both / fetch-then-filter. `:81`/`:87`/`:90` family table — REFERENCES is now wire-derivable from pointer-typed `b`; relabel the `b` row as type-`"inherit"`; cover the pointer row; rewrite the W5 sentence (graduated).

**`BIBLE.md`** — pointer sections + glossary + tables; 13 sites:
- `:1513` (§25) — the file's only `default "inherit"`; replace with registry + fail-safe + type-gated derivation. `:1511` — extend the normative enumeration (registry, fail-safe, derivation gate). `:1514` — explicit `inherit` now load-bearing for the Communities affiliation; add the transitivity rule. `:1516` — walk gated to inherit-typed; cite 0027 + 0029. `:1522`/`:1524` (§26) — first-listed-wins over the inherit subset; note the closure Cypher stays valid *because* derivation is type-gated. `:1431` glossary b-tag — rewrite to the registry. `:1409` glossary INHERITS_FROM — "from inherit-typed `b` tags only." `:1414` glossary REFERENCES — add the b-derived producer. `:1442` (§22) collision contract — third producer class, `source:'b-tag'`, endpoint clause widened (39998/39999 origins). `:1448` (§22) — aggregation counts inherit-typed only; discovery both. `:1462` (§22) deferred list — remove `REFERENCES` from future-letter candidates (keep `IS_A_PROPERTY_OF`). `:265–266` (§6 table) — REFERENCES row gains the b-derived producer; INHERITS_FROM row → "encoded as the inherit-typed `b` tag." Multi-z carve-out: `:192` (§5) position bullet; `:1432` glossary z-tag note; `:375` Rule 2 → "at least one valid parent pointer." §25 heading (`:1509`) and TOC (`:38`) unchanged.

**`protocols/drafts/communities.md`** — 9 sites (`:18`, `:19`, `:30`, `:33`, `:47`, `:48`, `:50`, `:56`, `:104`): make every deference mention explicitly inherit-typed (the founding-tenet line, convergence, the `b`=definition-inheritance equation, bootstrap, the CD field table, claims resolution, the `b`-less-CD line — "or with only pointer-typed `b` tags," definition-overlap closure, and the live-`b` lever — noting the new mitigation: downgrade `inherit` → `pointer` keeps the correspondence while severing the lever).

**`protocols/worksheet.md`** — W1 `:19/:21` (aggregation gating + refs); W2 `:27/:29` (b parenthetical, drop REFERENCES from candidate letters, refs); W5 `:47–53` (**Graduated → inherit-from spec**, resolution recorded, refs); W6 `:59/:61` (deferral unchanged by 0029; future algebra operates over the inherit-only closure; refs); **append W11** — Cloud formation / multi-z stamping rules (problem statement from handoff O11/O12; refs: handoff D1 rev 2, this ADR, tapestry-concepts carve-out).

**`protocols/drafts/class-thread-tags.md`** — `:56` candidate letters: remove `REFERENCES` (now rides `b`'s type element); optional `:50` consistency touch.

**`protocols/drafts/tapestry-concepts.md`** — new closing paragraph after `:49` ("fundamental link" section): the multi-z carve-out position (normative home), citing the base NIP's permission + recommendation and this ADR.

**ADR headers (pointer lines only; bodies immutable):** `0027-inherit-from-tag-b.md` after `:7` — `**Amended by:** community-reference ADR 0029 — element-3 becomes a two-value registry (pointer | inherit); absent type reads as pointer, superseding this ADR's default-inherit.` `0028-resolved-definition.md` after `:6` — `**Amended by:** community-reference ADR 0029 — resolution/closure walks only inherit-typed b tags; first-listed-wins applies over the inherit subset.`

**`engineering-team/epics/community-reference.md`** — index refresh: add stories 32/33 and ADRs 0028/0029.

**Checked clean (no edits):** `protocols/nips/decentralized-lists.md` (published working copy; permits multi-z, one-z is recommendation only), `protocols/README.md`, `AGENTS.md`, `docs/PROTOCOLS_DIRECTORY_DESIGN_HANDOFF.md` (historical, ✅-addressed), worksheet W8, class-thread-tags `:54` (uppercase `B` reservation unchanged).

## Out of scope

- P2 (communityReference v2 seeding), P3 (dual-author + 10040), P4 (resolved-definition cache) — later stories per the handoff plan.
- The cloud formation/rotation and stamping-rule design (→ W11), the election surface (W10), the W6 algebra, graded pointer weighting, the on-wire synced-snapshot marking (handoff H1).
- Any resolver/emitter code; republishing any spec; editing the published base NIP working copy.
- The handoff doc itself stays 🔴 OPEN (P2–P4 pending); it is not flipped by this story.
