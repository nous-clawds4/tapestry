# Story 34: `communityReference` v2 — seed, not stub

**Status:** Approved
**Created:** 2026-06-13
**Type:** Doc (docs-mode — Protocol-Spec workflow; P2 of the b-tag affiliation design)

## Background

ADR 0029 (story #33, ratified and live) gave the `b` tag its type registry, making a tenet-compatible on-wire affiliation seed possible: a `"pointer"`-typed `b` carries no deference. The b-tag affiliation design ([docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md), D4) settled the consequence: `communityReference` stops being the *expression* of the firmware-blessed affiliation (the Neo4j-only `REFERENCES` stub) and becomes the *seed* of it — the manifest tells install what to publish; the graph derives from published events.

Today BIBLE §22 ratifies the interim form: install materializes a stub edge, live for exactly one concept (`nostr-relay`). Without this story, the corpus presents the stub as the design, the firmware-blessed tier of §22's precedence has no on-wire expression, and P3 and the W11 stamping design would build on an unratified base.

Per the handoff's O7 sequencing constraint: this story ratifies the **target semantics in documents only** (BIBLE §22 + an ADR). The install-pass code change is a separate engineering story gated on the three-branch reconciliation.

## User-facing description

As the **protocol author / a deployment operator**, I want the firmware's community pointer ratified as a *seed* — config that causes the deployment's own signed, revocable, on-wire affiliation — rather than a parallel Neo4j-only mechanism, so that the affiliation map is visible to other deployments (feeding the W1 grapevine exit), operators can re-point it without firmware surgery, and there is exactly one affiliation mechanism instead of two that can drift apart.

## Acceptance criteria

All testable by reading the ratified documents (docs-mode):

- [ ] An **ADR exists** in this epic ratifying seed-not-stub, citing the handoff (D4) and building on ADR 0029.
- [ ] The **retained functions** of `communityReference` are stated: the boundary-rule-sanctioned home for hardcoded handle literals (bootstrap), `relayHints` (fetch), `knownGoodEventId` (install-time pin-verification against curator compromise), and driving the Phase-A superset link.
- [ ] The **target install semantics** are ratified: fetch the community header from `relayHints` → pin-verify (when `knownGoodEventId` is present) → seed `["b", <headerATag>, "pointer"]` onto the TA-authored local header.
- [ ] The **never-clobber rule** is ratified: install seeds only if the local header carries no `b` tag — the published live state outranks the static default (§22's precedence applied at install time).
- [ ] **Stub retirement** is ratified: for `b`-carrying headers, the manifest-materialized `REFERENCES {source:'firmware-community'}` stub is retired; the graph edge derives from the published event (`REFERENCES {source:'b-tag'}`, per ADR 0029).
- [ ] **Coverage widening** is ratified: `communityReference` extends from one concept to **all manifest firmware concepts** — Flaw A consciously widened *as the cold-start tier*, with the binding precedence `grapevine-resolved → firmware-blessed → none` preserved verbatim.
- [ ] The **general principle** is stated once: *the manifest seeds published tags; the graph derives from published events; Neo4j-only stubs were the interim form.*
- [ ] The **ADR 0008 follow-up** is flagged (not designed): superset-link promotion to an on-wire tag, with the inverse-direction caveat recorded (an `s` on the TA's local superset would derive the *inverse* of Phase A's canonical edge; the on-wire form needs a curator-side tag or the reserved uppercase inverse).
- [ ] The documents **distinguish ratified target from deployed-today** (stub mechanism live for `nostr-relay` only; no seeding code exists) — following the BIBLE's existing normative-vs-status-today pattern — so the BIBLE never claims unimplemented behavior is wired.
- [ ] **`firmware/active/manifest.json` is untouched** — verifiable by diff. (Adding entries before the code story would activate current stub behavior for every concept on the next install.)
- [ ] `npm test` remains green.

## Concepts touched

None in the live concept graph — documents only; no events emitted, **no firmware reinstall**. (Concept Graph API was unreachable at planning time; no handles needed for a docs story.)

## Out of scope

- The install-pass **code change** (seeding implementation) — a future engineering story, gated on the three-branch reconciliation (handoff O7).
- **Manifest data changes** — adding `communityReference` entries for the other concepts ships with the code story, not here.
- The superset-link promotion **design** (flag only — ADR 0008 follow-up).
- P3 (dual-author headers + 10040), P4 (resolved-definition cache), W11 (cloud/stamping), the registry-as-DList design, runtime-created-concept blessing (O10 stays open for the runtime case).

## Open questions

None remaining — the three gate items were resolved by the protocol author at the planning gate (2026-06-13):

1. **Seeding scope:** manifest concepts only; runtime-created concepts explicitly deferred (handoff O10 narrowed, open for the runtime case).
2. **Manifest encoding:** per-concept explicit `headerATag` entries — mixed curators possible; O9 (slug determinism) stays dormant.
3. **Pinning posture:** `knownGoodEventId` optional — pin-verify when present, log-and-continue when absent.

**Test Design is skipped** (docs-mode rule — the Reviewer audits accuracy and consistency instead).

## Linked artifacts

- Design source: [docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md](../../../docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md) (D4, D5, §5 P2)
- Builds on: [ADR 0029](../../decisions/community-reference/0029-b-type-registry.md) (story #33, ratified)
- ADR: [engineering-team/decisions/community-reference/0030-communityreference-seed-not-stub.md](../../decisions/community-reference/0030-communityreference-seed-not-stub.md)
- Test plan: skipped (docs-mode)
- Review: (filled in after Review phase)
