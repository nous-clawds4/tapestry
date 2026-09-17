# PRD Addendum: second-brain — Second Brain MVP (Capture, Decompose, Propose)

**Reconciles:** `product-team/prd/second-brain.md` *(immutable — never edited)*
**Build audit:** `engineering-team/audits/second-brain/audit.md`
**Date:** 2026-07-25
**Authored by:** engineering (Reviewer at book scope)

## 1. Summary

The book set out to make the owner's concept graph the durable substrate for goals, knowledge pointers, and judgment — the PRD's MVP block (§8.1): capture, hygiene, decomposition, pointers, session read loop, proposal loop, priority signals, export + one verified restore drill, three owner-gated views. **All 8 stories shipped with PASS reviews in 3 days**, riding existing graph machinery with zero firmware changes and zero relationship-whitelist changes; the restore drill ran once against a genuinely fresh scratch instance (its own assistant identity — the §5.9 portability proof made real) and is journaled `matched` in the brain itself, so the §10 metric row is countable by inspection. Headline divergences: two §5.1 owner actions (rename, abandon) deferred with no covering story; the Category entity is machinery-without-instances; the export affordance found a home the design guide's screen inventory didn't anticipate; and three sets of owner-facing strings were gate-ratified beyond the style guide's canonical table — the guides should now absorb them (§3 below carries the verbatim bundle).

## 2. Deviations from the PRD

### 2.1 Intentional changes
- **The hygiene story's defect inventory was wrong, and the check guards the real invariant instead** (queue story 2: "stray membership edges … are cleaned"). Direction-aware analysis showed those edges are legitimate incoming data; the actual live drift was primary-property records lagging extended schemas, which was reconciled on both work-item concepts and is what the shipped check catches (ADR 0002, operator-ratified). *Impact: the queue's premise is corrected; the check is more valuable than specified.*
- **The prioritization framing is a fixed v1 constant, deliberately** (§5.6/§7.6). A caller-suppliable framing IS the replacement hatch §7.6 reserves for an owner-ratified mechanism, so it was not built; every signal carries the stamped `solve-one-today` tag and history can never be silently re-labeled (ADR 0007 d8). *Impact: framing replacement needs its Phase-2+ mechanism before any second framing can exist.*
- **Restore refuses collisions wholesale and never merges** (§5.7 mechanics). Restoring the live brain's own export against the live brain refuses on every goal — the anti-clobber protection is structural, not procedural (ADR 0008 d5). *Impact: "restore into a brain that already has content" is a distinct future product question, not a smaller version of this feature.*
- **Drill history is instance-local** — drill records are journaled in the brain but not exported (AC1's five families are the artifact's contract; a safeguard's history protects *this* instance) (ADR 0008 d9). 

### 2.2 Deferred (cut to a later phase)
- **Rename and abandon** (§5.1 owner actions) — deferred at the story-1 planning gate; no queue story covers them. *Assigned home: a small dedicated story at Phase-2 scoping (abandonment is also the missing dated fact behind the `abandoned` standing word, which currently cannot occur).*
- **Category instances and the Goals-view category filter** (§6 Category; design guide) — the chip renders if a goal ever carries a category, but nothing creates categories. *Assigned home: Phase 2, where acceptance tiers are per-category anyway — decide then whether categories arrive with tiers or the filter leaves the design guide.*
- Everything the PRD itself phases (§8.3) is untouched and unchanged — lifecycle/acceptance, review gates, tiers, expiry, queue-age, launch answer, claim/lease, private write mode, engineering-project merge → Phase 2; autonomy/charter/digest/observability → Phase 3; index → Phase 4; and onward.

### 2.3 Added beyond the PRD
- **A sixth stored record family: the Restore Drill journal** (`tapestry-restore-drill` — dated, append-only, born-final records of each drill: which export, restored where, when, by whom, matched or not). The PRD required "the drill's result is journaled" without a surface; the domain model (§6) lists six entities and this is now a seventh stored shape. *Recommend ratifying it into the domain model as a system-safeguard record (or explicitly classifying it as non-domain machinery).*
- **The export affordance and two new owner-facing strings** — the style guide pinned the button label but no confirmation/failure sentences; the design guide's screen inventory had no export surface at all. Shipped: the Goals-view footer placement beside the privacy line (the two lines are the same posture — *your brain is yours, on this machine*), plus the gate-ratified sentences (§3).
- **Goal-detail section headings** (`Resources`, `Record`) beyond the wireframe — plain-language, aids the one-spine read (review 4).
- **`ensureGoalConcept`** — a truly fresh instance lacks even the goal concept (it was never firmware-seeded; an ADR 0001 fact the book's own handoff had wrong); restore now self-provisions all five content concepts, strengthening §5.9's cold-start guarantee.
- **Operator drill tooling** (`scripts/brain-drill.sh`) — reproducible, journals both outcomes, teardown-safe.

### 2.4 Constraints discovered
- **The guide pair disagreed with itself**: the style guide pinned "Export brain." as a button label while the design guide's binding three-view inventory had nowhere to put it. Resolved at an operator gate (Goals footer); the v2 guides should carry the affordance so the inventory and the copy table agree.
- **"Equivalent content" needed a mechanical definition** (queue AC4's load-bearing phrase): ratified as deep-equality of canonically-sorted content with the artifact's own taken-on date outside the comparison — one definition serving both export-idempotence and restore-reproduction. Byte-identity was structurally impossible (and undesirable) because restored elements are re-signed under the target's own identity — which is exactly what §5.9 portability requires.
- **Local co-tenancy has a memory ceiling** (ops): a second full stack beside the live one OOM-starves the live database; the drill tooling works around it (documented, OPEN.md row 95). A product-level consequence only in that "the drill must not risk the thing it protects" now has an operational footnote: run the drill when the machine has headroom.

## 3. Impact on the product model

- **Personas / journeys:** none changed. The traceability guard held — every shipped requirement traces to a Delegating Owner journey; the Second Operator's portability seed is now concrete (an identity-free artifact proven to restore under a different assistant identity).
- **Domain model (§6):** add (or explicitly classify) the **Restore Drill record** (2.3); note that **Category remains uninstantiated**; all six specified entities otherwise shipped with their attribute sets, standings derived-not-stored exactly as specified.
- **Scope / roadmap:** rename/abandon and category-instances need Phase-2 homes (2.2); the §10 MVP metrics window can start now (the block is complete; two of six counters already satisfied: the drill ✓, hygiene green ✓).
- **Design rules / canonical copy — the back-fill bundle.** The guides are product-owned; engineering never edits them. The v2 style/design guides should absorb, verbatim:
  - **Approve confirmation** (ADR 0006 d16, operator-ratified): `Approved — launch it when you're ready.`
  - **Priority-signal set** (ADR 0007 d5): spine type words **`preferred`** / **`passed over`**; spine summaries `chose this over "{other}"` / `"{other}" chosen over this` (optional reason folded after an em-dash, both sides); capture confirmation `Noted — "{prefers}" over "{over}".`; the elicitation prompt stays the PRD's verbatim **"solve one today: which?"**.
  - **Export set** (ADR 0008 d12): button **`Export brain.`** (already pinned) lives in the **Goals-view footer beside the privacy line**; confirmation `Exported — saved to this machine.`; failure `Couldn't export — nothing was saved. Try again.`; the drill completion stays the pinned `Restore drill complete — your brain matches the export.`
  - **Record-type vocabulary** now reads: `proposed / approved / skipped / worked / noted / preferred / passed over`.
  - **Two pattern rulings to record** (both already exercised and PASSed): the guide's error strings are **register patterns, not byte-canonical** (shipped variants like "Couldn't load your goals — Retry" conform); **shell surfaces follow the app's idiom** (emoji-prefixed nav label, lock-line gate) while product-owned content stays emoji-free — the "indistinguishable from the app" grounding principle wins on shell chrome.

## 4. Recommended scope for the next phase

Engineering's read — input, not decision (audit §6 is the full register):

- **Rename/abandon** as an early, small Phase-2 story (audit #1) — it unblocks the `abandoned` standing and completes §5.1.
- **Categories with tiers** (audit #2) — decide jointly, since Phase 2's acceptance model is per-category.
- **Proposal expiry / queue-age** (§8.3) — the P2 gate metric (median open-proposal age) wants these.
- **Hygiene classifiers for the five newer concepts** (audit #3) — cheap trust-floor reinforcement, pattern established.
- **The §10 measurement window** — start counting now; the P2-planning gate feeds off it.
- Small polish items riding along: Proposals retry parity (audit #4), serving-goal rendering (audit #6), locator schemes (audit #7).

## 5. Open questions for product

1. **Restore Drill in the domain model** — ratify as a seventh (system-safeguard) entity, or classify as non-domain machinery the model deliberately omits? Options: ratify with attributes as shipped / omit with a stated rationale.
2. **Category's fate** — create instances in Phase 2 alongside acceptance tiers, or drop the category filter from the design guide until a phase needs it? Options: with-tiers / drop-filter / standalone-story.
3. **Rename/abandon placement** — dedicated pre-Phase-2 story, or folded into Phase 2's lifecycle work? Options: standalone / folded.
4. **Ratify the two pattern rulings and the back-fill bundle** (§3) into the v2 guides — and choose the mechanics: a v2 guide pair, or in-place additions to the current guides? (The canonical-copy table is the product team's file either way.)
5. **Restore-into-populated (merge) semantics** — leave explicitly out of the product model until a phase needs it, or schedule the product question at Phase 2 alongside private write mode? Options: defer-unscheduled / schedule-P2.
