# ADR 0030: `communityReference` v2 — seed, not stub

**Status:** Accepted
**Date:** 2026-06-13
**Story:** `engineering-team/stories/community-reference/34-communityreference-seed-not-stub.md`
**Builds on:** `community-reference` ADR 0029 (the `b` type registry — the `"pointer"` type is what makes a tenet-compatible seed possible) and ADR 0005/0008 (the deployed stub + Phase-A superset link this ADR ratifies the successor of).
**Design source:** [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D4, D5) — all three planning-gate items resolved by the protocol author 2026-06-13 (manifest-only scope; per-concept explicit entries; pinning optional).
**Citation hygiene:** an unrelated `0030` exists on the unmerged `feat/communities` branch; cite this decision as **community-reference ADR 0030** with the epic-scoped path.

## Context

ADR 0029 ratified the `b` type registry; the firmware-blessed affiliation can now be expressed on-wire as a `"pointer"`-typed `b` — a bookmark, not deference — without violating the founding tenet or corrupting the W1 consensus signal. What remains is the mechanism that *produces* it. Today (BIBLE §22, `BIBLE.md:1438`) `communityReference` is the **expression** of the affiliation: install materializes a Neo4j-only `REFERENCES {source:'firmware-community'}` stub, live for exactly one concept (`nostr-relay`). The handoff's D4 settled the redesign: the manifest field becomes the **seed** — install publishes the affiliation as the TA's own signed, revocable `b` tag, and the graph derives from the published event like every other tag-derived relationship.

Constraints: **documents only** — the install-pass code change is a separate engineering story gated on the three-branch reconciliation (handoff O7), and `firmware/active/manifest.json` must be untouched (adding entries now would activate *current stub behavior* for every concept at the next install). Therefore BIBLE §22 — which by charter describes how this codebase implements things — must **distinguish ratified target from deployed-today**, following the existing §27 precedent ("The standard … Status today … Target direction"). Immutable records (ADRs 0005/0006/0008, stories, reviews) are untouched. Concept graph: no live concepts change; **no firmware reinstall**.

## Options considered

### Option A — `communityReference` narrowed to seed; stub retired by ratification (chosen)
The manifest field keeps its four irreplaceable functions (literal home, fetch hints, pinning, superset-link driver) and loses its expression role: target install semantics seed a `"pointer"`-typed `b` onto the TA-authored header; the graph edge derives from the published event; the stub is documented as the deployed interim form.
*Pros:* one affiliation mechanism, on-wire and visible to other deployments (the W1 substrate); operator re-pointing without firmware surgery; no stub↔tag divergence channel; the seed/deliberate distinction rides ADR 0029's type registry.
*Cons:* §22 carries dual-state (target + status-today) text until the code story lands and must be flipped then; a stub-cleanup migration becomes future work.

### Option B — dual mechanism: keep the stub permanently alongside the seeded `b`
*Pros:* no migration; install keeps working unchanged.
*Cons:* two representations of one affiliation that can diverge by construction (re-point the header's `b`, the stub still points at the old target); the Neo4j-only half is invisible off-machine, contributing nothing to W1; exactly the redundancy D4 identified. Rejected.

### Option C — retire `communityReference` entirely now that `b` exists
*Cons are fatal* (settled at scoping, recorded so it isn't re-litigated): bootstrap circularity (a fresh install has published nothing; the literal needs a code-side home, and the boundary rule sanctions the manifest); the `b` tag has no relay-hint slot (element 3 is the type); `knownGoodEventId` pinning is the install-time anti-lever to live-deference risk and has no on-wire equivalent; the same pass drives the Phase-A superset link. Rejected.

## Decision

We chose **Option A**, with these fixed points:

1. **Retained functions (ratified):** `communityReference` `{ headerATag, relayHints[], knownGoodEventId? }` remains (a) the boundary-rule-sanctioned home for hardcoded handle literals, (b) the fetch path (`relayHints`, relay invariant unchanged), (c) optional install-time pin-verification (`knownGoodEventId`: verify when present, log-and-continue when absent — §22's graceful-install principle), and (d) the driver of the Phase-A superset link (ADR 0008, unchanged here).
2. **Target install semantics (ratified; not yet wired):** for each manifest concept carrying a `communityReference`: fetch the community header from `relayHints` → pin-verify if `knownGoodEventId` present (mismatch → log + skip the seed, never throw) → **if the TA-authored local header carries no `b` tag of any type**, republish it with `["b", "<headerATag>", "pointer"]` appended (TA-signed — the TA authored the header and is the only key that can re-sign it). Idempotent.
3. **Never-clobber (ratified):** any existing `b` tag — any type, any target, seeded or operator-set — suppresses the seed. The published live state outranks the static default; this is §22's precedence (`grapevine-resolved → firmware-blessed → none`, preserved verbatim) applied at install time.
4. **Stub retirement (ratified):** under target semantics, no `REFERENCES {source:'firmware-community'}` stub is MERGEd for a `b`-carrying header — the edge derives from the published event as `REFERENCES {source:'b-tag'}` (ADR 0029). Pre-existing stub edges remain valid-but-legacy until the code story includes cleanup; they stay harmless meanwhile because every concept-level `REFERENCES` consumer already filters on `source` (the binding collision contract).
5. **Coverage (ratified):** every **manifest** firmware concept MAY carry a `communityReference` — per-concept explicit `headerATag` entries (mixed curators per concept possible; no slug-derivation dependency, O9 stays dormant). Runtime-created concepts are deferred (no blessing path; handoff O10 narrowed, open for the runtime case). Flaw A is thereby consciously widened **as the cold-start tier only**; seeds are `"pointer"`-typed, so they carry zero consensus weight (ADR 0029) — the grapevine tier's ability to supersede the firmware tier is unimpaired and measurable.
6. **The general principle (stated once in §22):** *the manifest seeds published tags; the graph derives from published events; Neo4j-only stubs were the interim form.*
7. **ADR 0008 follow-up (flagged, not designed):** the same promotion direction applies in spirit to the Phase-A superset link, with the wire caveat that must be resolved there: the `s` tag is child-claims-parent with a flipped derived edge, so an `s` on the TA's local superset would derive the *inverse* of Phase A's canonical `(localSup)-[IS_A_SUPERSET_OF]->(communitySup)`; the on-wire form needs either a curator-side tag (not ours to publish) or the reserved-unassigned uppercase inverse.
8. **Document mechanics:** the §22 `communityReference` paragraphs adopt explicit **Target (ratified)** / **Status today** labels per the §27 precedent, so the BIBLE never presents unwired behavior as implemented. The status-today text is the designated flip site for the future code story.

## Consequences

- **Enables** P3 (dual-author headers — the TA-seeding flow it composes with is now ratified) and the W11 stamping design (the cloud's `b`-graph substrate has a defined producer); the affiliation map becomes on-wire and cross-deployment-visible, feeding the W1 exit trajectory (D5).
- **Constrains:** §22 carries target-vs-status dual text until the code story lands — that story MUST flip the status paragraphs or the BIBLE drifts; the never-clobber rule means a deployment that re-points and later wants the default back must remove its `b` manually (re-seeding is suppressed by design).
- **New debt / follow-ups:** the install-pass engineering story (gated on the three-branch reconciliation) including stub cleanup; the editorial task of authoring ~34 per-concept manifest entries (choosing each concept's blessed curator handle) — ships with the code story; the ADR 0008 superset-link follow-up.
- **Firmware reinstall required?** No — documents only.

## Implementation notes

Docs-mode; `npm test` stays green; no source files; `firmware/active/manifest.json` untouched (story AC — verify by diff). Sites (current line numbers as of `a543f07a`; re-locate by quote if drifted):

- **`BIBLE.md:1438`** (§22, definition paragraph) — rewrite as the seed definition with the **Target (ratified — ADR 0030)** / **Status today** split: target = fixed points 2–4 (fetch → optional pin-verify → never-clobber seed → derive-from-event); status today = the deployed stub behavior, verbatim mechanics preserved (`pass_communityReferences`, republish-without-re-signing, `buildImportCypher`/`executeCypher`, `REFERENCES {source:'firmware-community'}`), live for `nostr-relay` only; seeding not yet wired.
- **`BIBLE.md:1440`** (stub paragraph) — reframe: the stub is the **deployed interim form**, retired by ratification for `b`-carrying headers; pre-existing stub edges legacy-but-harmless under the `source`-filtered collision contract; the general principle (fixed point 6) lands here.
- **`BIBLE.md:1446`** (Flaw A paragraph) — append the coverage-widening ratification (all manifest concepts, per-concept explicit entries, runtime deferred) and the pointer-typed-seed/zero-consensus-weight note (cite ADR 0029).
- **`BIBLE.md:1458`** (Phase-A superset paragraph) — append the ADR 0008 follow-up flag with the inverse-`s` caveat (fixed point 7).
- **`BIBLE.md:1411`** (§21 glossary, `communityReference`) — rewrite: "Resolved at install into a `REFERENCES` placeholder" → the seed definition (target: seeds a `"pointer"`-typed `b` on the TA header; today: stub placeholder, one concept). Keep `:1412` (precedence entry) unchanged.
- **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** (living capture doc) — §5 table: annotate P1 with `community-reference` ADR 0029 (shipped) and P2 with this ADR; §4: note O10 narrowed (manifest-only ratified; runtime case open). No status flip — P3/P4 remain.
- **Checked clean / untouched:** `protocols/` (the seeded tag's wire form is already normative in `inherit-from.md` per ADR 0029; seeding behavior is deployment-side = BIBLE territory per the boundary rule); ADRs 0005/0006/0008 and all stories/reviews (immutable); `AGENTS.md`, `OPERATIONS.md` (no `communityReference` mentions); `firmware/active/manifest.json`.

## Out of scope

- The install-pass **code change** and **manifest entries** (the engineering story, gated on the three-branch reconciliation; includes stub cleanup and the status-today flip in §22).
- The superset-link promotion **design** (ADR 0008 follow-up — flagged only).
- Runtime-created-concept blessing (O10's open remainder); P3, P4, W11; the registry-as-DList design.
