# Story 38: Build the shared b-tag primitive — emitter + edge derivation + stub retirement

**Status:** Approved
**Created:** 2026-06-17
**Type:** Feature

## Background

ADRs 0027 / 0029 / 0030 (epic `community-reference`) ratified, **on paper only**, a redesign of how firmware-blessed affiliations are expressed: instead of materializing an invisible Neo4j-only `REFERENCES {source:'firmware-community'}` stub at install time, firmware should **publish the affiliation as the TA's own signed, revocable `b` tag** on the concept header, and let the graph derive the edge from that published event — the same way every other tag-derived relationship is built.

This is **design-only everywhere today** — verified across origin branches: no `b` emitter, no `b`→edge derivation, `INHERITS_FROM` in zero `src/` files. `src/firmware/install.js` → `pass_communityReferences` (~line 998) still MERGEs the legacy stub (~line 1224, `SET r.source = 'firmware-community'`). So this is a **build, not a port**.

It is the **foundation of Half 2** of the tag-federation epic (see `docs/B_TAG_HALF_2_HANDOFF.md`). Half 1 (opt-in tag read-union) shipped the cross-instance *visibility*. Half 2 makes the concept-graph *correct* (the dual-z model). This story builds the generic `b` primitive; a later story (Story 3 / W11) applies it to the real tag concepts. **This story touches no manifest entries** (the stub trap — see Out of scope).

Who's affected: operators installing/reinstalling firmware, and the concept-graph correctness that Story 3 depends on. No end-user-visible surface changes in this story.

## User-facing description

As an **operator installing firmware on an instance**, I want a firmware-blessed affiliation to be **published as the TA's own signed, revocable `b` tag** on the concept header — with the graph edge derived from that published event — instead of being materialized as an invisible, off-wire, Neo4j-only stub, so that the affiliation is **on-wire, visible to other deployments, and revocable by re-pointing the header** rather than trapped in one machine's database.

The primitive is **generic** over any manifest concept carrying a `communityReference`. It is exercised and proven on the throwaway dev-ground concept `nostr-relay` (the only concept carrying a `communityReference` today) — **not** on any production concept.

## Acceptance criteria

Testable from the outside. "A concept carrying a `communityReference`" means `nostr-relay` for this story (the dev-ground pilot); no other concept's manifest entry is added or changed.

- [ ] **AC-1 (emitter — pointer-`b` seeded on the header):** Given a manifest concept carrying a `communityReference` whose TA-authored local header carries **no** `b` tag, when firmware install runs `pass_communityReferences`, then the TA-authored local header is **republished, TA-signed, with `["b", "<headerATag>", "pointer"]` appended** (the `headerATag` taken from the concept's `communityReference`).
- [ ] **AC-2 (edge derived from the published event — pointer → REFERENCES{source:'b-tag'}):** Given a header that carries a `["b", "<target>", "pointer"]` tag (or a `b` tag with the type element **absent**), when the b-tag→edge derivation runs, then a `(child)-[:REFERENCES {source:'b-tag'}]->(target)` edge exists in Neo4j.
- [ ] **AC-3 (edge derived — `inherit` → INHERITS_FROM):** Given a header that carries a `["b", "<target>", "inherit"]` tag, when the derivation runs, then a `(child)-[:INHERITS_FROM]->(parent)` edge exists (no `source` property). The type-gate keys on the explicit string `"inherit"`; any other/absent type derives the `pointer` form (never gate on "not pointer").
- [ ] **AC-4 (stub retired for b-carrying headers):** Given a header that now carries a `b` tag, when install completes, then **no** `REFERENCES {source:'firmware-community'}` stub edge is MERGEd for that header — the only `REFERENCES` edge present derives from the published event (`source:'b-tag'`).
- [ ] **AC-5 (idempotent):** Given firmware install is run twice in succession on the same concept, when the second run executes, then the header is **not** re-published a second time and exactly one `b` tag (and one derived edge) exists — no duplicate `b` tags, no duplicate edges.
- [ ] **AC-6 (never-clobber):** Given a header that **already** carries a `b` tag of any type and any target (operator-set or previously seeded), when firmware install runs, then the existing `b` is **left untouched** — the seed is suppressed (the published live state outranks the static firmware default).
- [ ] **AC-7 (pre-existing legacy stubs stay harmless):** Given a `REFERENCES {source:'firmware-community'}` edge that existed before this change, when install runs under the new behavior, then that pre-existing edge is **not required to be removed** by this story and existing `source`-filtering consumers continue to behave correctly (the binding-collision contract: consumers filter on `source`).
- [ ] **AC-8 (no manifest change; no other concept affected):** Given the firmware manifest, when this story's diff is inspected, then `firmware/active/manifest.json` is **unchanged** and no production concept (`tag` / `nostr-user-tag` / `tag-pinning` / Communities concepts) gains a `communityReference`.

## Concepts touched

- `39998:919ba08a…:nostr-relay` — **nostr-relay** (the dev-ground pilot: the only concept carrying a `communityReference` today; its affiliation expression moves from the `firmware-community` stub to a published pointer-`b` → `source:'b-tag'` edge). No production concept is touched.
- The `b` tag primitive itself (wire spec `protocols/drafts/inherit-from.md`; type registry ADR 0029) — newly given a working emitter + derivation.

_(Architect: orient via `http://localhost:8877/api/concept-graph/summaries` to confirm the `nostr-relay` header handle and its current stub edge before designing.)_

## Out of scope

- **Manifest entries for the real tag concepts** (`tag` / `nostr-user-tag` / `tag-pinning`) and the **dual-z writer (W11)** — that is **Story 3**, and it depends on this primitive landing first. **⚠️ The stub trap:** adding `communityReference` manifest entries against pre-primitive install code deploys the *stub*, not the `b` — so manifest edits are deferred to Story 3, after this emitter exists. (Handoff §3.)
- **The resolved-definition READ primitive** — the live inherit-resolution merge/closure walk (ADRs 0028/0032). Pointer-typed tags don't participate in resolution, so the read-walk isn't needed for the firmware-pointer-seed use. This story is the `b` **write** primitive + **edge derivation** only.
- **Cleanup/migration of pre-existing `firmware-community` stub edges** (AC-7 keeps them legacy-but-harmless; a sweep is future work).
- **The ADR-0008 Phase-A superset-link promotion** (flagged in ADR 0030 fixed-point 7; design-only, not this story — the `nostr-relay` superset link should be *unaffected*, AC-implied).
- **Securing/burning the canonical `82b75e47…` key** (deferred decision, not Half 2).

## Open questions

1. **For the Architect — fetch-failure behavior.** ADR 0030 fixed-point 2 says: fetch the community header from `relayHints` → pin-verify if `knownGoodEventId` present (mismatch → log + skip, never throw). But the `headerATag` literal is in the manifest regardless of whether the remote fetch succeeds. **Does a fetch failure (no pin available) block the seed, or proceed to seed from the manifest literal?** (Lean: the seed needs only the `headerATag` literal, which is local; the fetch/pin is a verification anti-lever, so a fetch failure should *log-and-continue* per §22's graceful-install principle — but confirm against the pin-verify intent.)
2. **For the Architect — where the `b`→edge derivation lives.** Relative to the existing Pass-3 / eventSync header-processing, where does the derivation hook in so it runs on both fresh install and ongoing sync? (Handoff §4 Story-2 open question.)
3. **For the Architect — nostr-relay's ADR-0008 superset link.** Confirm it is unaffected (only the `REFERENCES` *expression* changes from stub to derived `b`-tag edge; the `IS_A_SUPERSET_OF` link should be untouched).
4. **For the Architect — does this need a firmware reinstall to verify locally?** (Likely yes — the emitter runs in `pass_communityReferences`; verification is "reinstall firmware on a concept carrying a `communityReference`, then inspect the header event + Neo4j edge.")

## Linked artifacts

- Epic: `engineering-team/epics/tag-federation.md` (Half 2). Handoff: `docs/B_TAG_HALF_2_HANDOFF.md` (§4 Story 2 is this story).
- Governing ADRs: `engineering-team/decisions/community-reference/0027-inherit-from-tag-b.md`, `…/0029-b-type-registry.md`, `…/0030-communityreference-seed-not-stub.md`.
- Wire spec: `protocols/drafts/inherit-from.md`.
- Predecessor (the stub being retired): `engineering-team/stories/community-reference/8-community-reference-nostr-relay-stub.md` + ADR 0005.
- ADR: `engineering-team/decisions/community-reference/0034-b-tag-primitive-emitter-derivation.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
