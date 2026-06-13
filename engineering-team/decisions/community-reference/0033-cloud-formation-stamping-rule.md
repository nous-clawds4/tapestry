# ADR 0033: Cloud formation & multi-z stamping rule (W11)

**Status:** Accepted
**Date:** 2026-06-13
**Story:** `engineering-team/stories/community-reference/37-cloud-formation-stamping-rule.md`
**Builds on:** `community-reference` ADR 0029 (the `b` type registry — the multi-`z` position this designs the practice for; and the W1 consensus aggregation the cloud is a read of) and BIBLE §22 (the `grapevine-resolved → firmware-blessed → none` trajectory the cloud selector follows).
**Design source:** [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D1 rev 2, O11, O12) + the 2026-06-13 scope conversation, which settled the two open forks (recorded in the story).
**Citation hygiene:** an unrelated `0033` is cited in BIBLE §27 (the PoV-resolution ADR, a different epic); cite this decision as **community-reference ADR 0033** with the epic-scoped path.

## Context

ADR 0029 ratified the *position* that a deliberately-published list item MAY carry multiple `z` stamps (the personal parent pointer plus stamps naming the shared concepts it joins) — but left the *practice* open, tracked as worksheet W11 / handoff O11 (cloud formation & rotation) and O12 (the stamping rule). Unlike P1–P4, W11 was genuinely unsettled design; it was worked through in a scope conversation (2026-06-13), which resolved the two pivotal forks. This ADR ratifies that **frame** as design.

The motivating constraint is **local-first publication**: most personal headers never reach public relays, so public aggregation cannot depend on them — a published item must be self-contained, which the cloud stamps make it.

Constraints: **design-only, frame-only** — the cloud is a read of the W1 consensus aggregation, which (like the resolver) does not exist and is gated on on-wire `b`-tags behind the three-branch reconciliation (handoff O7); so the cap `k`, the ranking formula, and the firmware cold-start cluster contents are **deferred** (set against real behavior later). The read/stamp convention is `protocols/` (tapestry-concepts) territory — multi-`z` is already permitted by the base NIP, so this adds a *convention*, not a new wire format. Honest target/not-wired framing (§27 / ADR 0030 precedent). No source touched; **no firmware reinstall**.

## Options considered

The design has two axes; each had a rejected alternative settled at the scope gate.

### Cloud-formation axis
**Option A (chosen) — derived top-k of the W1 consensus signal.** The cloud is a *derived* read of the already-ratified aggregation (incoming inherit-typed edges, GrapeRank-weighted from the observer's PoV); membership is consensus rank; mutual pointer-`b` edges are the author's *navigation* to the cloud, not a membership gate; rotation is emergent (nobody governs it); the selector follows the §22 trajectory; organic clouds bootstrap from singletons.
*Pros:* no new mechanism; no-privileged-center (no curator, nothing to govern); reuses the consensus machinery and the §22 trajectory the rest of the book already established.
*Cons:* observer-relative, so author-stamped and consumer-queried clouds can differ — addressed by overlap-tolerance (redundancy + consensus convergence) with curator-side projection (Method 2) as the completeness backstop.

**Option B (rejected) — a published cloud manifest.** An explicit signed "the dogs cloud = [H1…H5]" event.
*Cons (fatal):* reintroduces a curator/authority (who signs it?) and a governable object — the exact no-privileged-center violation the whole design avoids. Rejected at the scope gate.

### Write-time-anchor axis
**Option A (chosen) — affiliation-anchored.** The author stamps the cluster of the community they *declared* affiliation with (navigating via their own pointer-typed `b`), not the concept's global top-k.
*Pros:* honors "I'm publishing to *this* community"; tenet-consistent when rival clusters compete; the item carries the author's *declared* associations.

**Option C (rejected) — concept-global top-k.** Stamp the concept's largest/most-agreed cluster regardless of the author's affiliation.
*Cons:* silently routes items into communities the author never chose — cuts against opt-in centralization exactly when concepts have rival clusters. Rejected at the scope gate.

## Decision

We chose **Option A on both axes**, ratifying the frame with these fixed points:

1. **Cloud formation (O11).** The cloud of headers for a concept is the **derived top-k of the W1 grapevine-resolved consensus signal** — **never a published object/manifest**. Membership is consensus rank; mutual pointer-`b` edges are the author's *navigation* to the cloud, not a membership gate.
2. **Rotation (O11) is emergent.** Nobody governs cloud membership; it changes as the signal changes; there is nothing to "detect" — author and consumer recompute. The selector follows the **§22 trajectory** (`grapevine-resolved top-k → firmware-blessed cluster (cold-start) → none`); **organic (non-firmware) clouds bootstrap from singletons** and thicken as deference accumulates.
3. **Write-time anchor: affiliation-anchored.** An author stamps the cluster of the community they declared affiliation with (via their own pointer-typed `b`), not the concept-global top-k.
4. **Stamping rule (O12).** A deliberately-published item carries the **personal `z`** (required — ≥1 per base-NIP Rule 2, BIBLE §10; may point at a *private* header) **plus up to a cap of cloud handles**. `z`-tag **order is not load-bearing** (a `#z` filter matches any value); highest-consensus-first is informational convention only — **consumers MUST NOT depend on order**.
5. **Re-stamp on rotation (O12): lazy author re-emit** (the ADR 0022 pattern — republish at the same `d`-address for kind-39999). Accepted lossiness, named: foreign-authored items can't be re-stamped (only the author re-signs); inactive authors' items fade as the cloud rotates away; kind-9999 (non-addressable) items can't be re-stamped at all — a reason to prefer 39999.
6. **Containment-only (consistency boundary).** This cloud is for **containment items** (an item joining a concept's list). **Membership assertions** keep the single shared applied-concept handle (the "tag against it" design, already ratified) — two separate, non-overlapping mechanisms. This ADR does not reopen the membership design.
7. **Deferred tuning (NOT ratified).** The exact cap `k` (~5), the exact ranking formula, and the firmware cold-start cluster contents — set against real behavior when the implementation gate clears.
8. **Honest target/not-wired.** The cloud's consensus aggregation, the resolver, the stamping/query code, and on-wire `b`-tags do not exist; implementation is gated on the three-branch reconciliation. The spec text is framed as the convention, marked design/not-yet-wired.

## Consequences

- **Closes worksheet W11** (graduated → tapestry-concepts spec) and resolves handoff O11/O12 — completing the design surface of the b-tag affiliation book (the remaining work is the gated code epic).
- **Constrains:** the future stamping/query code inherits the never-a-manifest rule, the affiliation-anchored navigation, the order-non-binding consumer rule, and the lazy-re-emit lossiness as design givens; the cloud may never become a signed object without a new ADR (it would break no-privileged-center).
- **New debt / follow-ups:** the deferred tuning (cap/formula/cold-start) lands with the implementation; the curator-side projection (Method 2) completeness backstop remains as previously noted in D1 rev 2; all code is gated.
- **Firmware reinstall required?** No — documents only.

## Implementation notes

Docs-mode; `npm test` stays green; no source files. Cite **community-reference ADR 0033** (epic-scoped). Sites:

- **`protocols/drafts/tapestry-concepts.md`** (the "Multi-`z` stamping" paragraph, ~line 53) — expand the current position-only paragraph (which ends "The stamping practice itself … is open, tracked as worksheet W11") into the ratified frame: cloud = derived top-k of the W1 consensus (never a manifest; mutual-`b` = navigation, not a gate); affiliation-anchored stamping; personal `z` required + ≤cap cloud handles; order non-binding (consumers MUST NOT depend on it); rotation emergent + §22 trajectory + organic singletons; lazy author re-emit with the named lossiness; the containment-only consistency note; and the deferred tuning + target/not-wired framing. Keep it a *convention* on top of the base NIP's already-permitted multi-`z`.
- **`protocols/worksheet.md`** (W11) — flip Status `Open` → `Graduated → [tapestry-concepts spec](./drafts/tapestry-concepts.md) · resolved 2026-06-13`; record the resolution (the settled frame + the deferred tuning) and the refs (`community-reference` ADR 0033; the scope conversation; D1 rev 2), matching the W5 graduation format.
- **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — mark O11/O12 resolved (`community-reference` ADR 0033 / story #37; frame ratified, tuning deferred); the §5 plan note may record W11 as the design surface's final piece. No header flip — the doc stays 🔴 OPEN (gated code remains).
- **Checked clean / untouched:** BIBLE (the convention's home is the tapestry-concepts spec; BIBLE §5's multi-`z` pointer already exists and stays accurate); `inherit-from.md` / the membership design (not reopened); ADR 0029 and all prior stories/reviews (immutable); `src/` (no code — verify by diff); `firmware/active/manifest.json`.

## Out of scope

- The **deferred tuning** (cap `k`, ranking formula, firmware cold-start cluster contents).
- **All code** — the W1 consensus aggregation, the cloud computation, the stamping/re-stamp emitters, the read-side query — future engineering stories gated behind the resolver, on-wire `b`-tags, and the three-branch reconciliation.
- The **membership-assertion design** (single shared handle) — referenced only for the consistency boundary; not reopened.
- The curator-side projection (Method 2) backstop; engine-config carriage (W8); the registry-as-DList design.
