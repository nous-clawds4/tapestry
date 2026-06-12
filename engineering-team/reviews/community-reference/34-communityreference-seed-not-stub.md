# Review: Story 34 — `communityReference` v2: seed, not stub

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-13
**Diff:** `git diff 735b960b~1..735b960b` (implementation commit `735b960b`, branch `docs/communityreference-seed-not-stub`; story `a543f07a`, ADR `ccc7ff59`; base `staging` @ `583fb8ff`)
**Mode:** docs-mode (Protocol-Spec workflow) — Test Design skipped by design; this review audits **accuracy and consistency**, not coverage. ADR: `engineering-team/decisions/community-reference/0030-communityreference-seed-not-stub.md`.

Diff scope: 2 files — `BIBLE.md` (+10/−4 across §21/§22) and `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md` (+3/−3). No source, no protocols/, no manifest.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (run 2026-06-13; all suites green, `Overall: PASS`). Docs-only diff caused no regression.
- [x] `npm run test:playwright` — N/A (no browser/UI change; documents only).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (acceptance criteria, audited against final file states)

- [x] **AC1 — ADR exists in this epic.** `decisions/community-reference/0030-communityreference-seed-not-stub.md`: Accepted; cites the handoff (D4, D5) as design source; "Builds on" names `community-reference` ADR 0029 and ADRs 0005/0008; records all three planning-gate resolutions in the header and Decision.
- [x] **AC2 — retained functions stated.** `BIBLE.md:1438`: all four — boundary-rule-sanctioned literal home (bootstrap), `relayHints` fetch path, optional `knownGoodEventId` install-time pin-verification, Phase-A superset-link driver (ADR 0008). Matches ADR fixed point 1.
- [x] **AC3 — target install semantics ratified.** `BIBLE.md:1440`: fetch from `relayHints` → pin-verify when `knownGoodEventId` present (mismatch → log + skip, never throw) → seed `["b", "<headerATag>", "pointer"]` onto the TA-authored local header, TA-signed, idempotent. Wire form matches `protocols/drafts/inherit-from.md` (element-3 type, `"pointer"` per ADR 0029). Matches ADR fixed point 2.
- [x] **AC4 — never-clobber ratified.** `BIBLE.md:1440`: any existing `b` — any type, seeded or operator-set — suppresses the seed; published live state outranks the static default; explicitly framed as the §22 precedence applied at install time; manual-removal consequence recorded. Matches ADR fixed point 3.
- [x] **AC5 — stub retirement ratified.** `BIBLE.md:1442`: under target semantics no `firmware-community` stub is MERGEd for a `b`-carrying header; the edge derives from the published event (`REFERENCES {source:'b-tag'}`, stated at `:1440`); pre-existing stub edges valid-but-legacy until the code story ships cleanup, harmless under the `source`-filtered collision contract. Matches ADR fixed point 4.
- [x] **AC6 — coverage widening ratified.** `BIBLE.md:1450`: every **manifest** firmware concept MAY carry a `communityReference`; per-concept explicit `headerATag` entries, mixed curators possible; runtime-created concepts deferred; Flaw A consciously widened **as the cold-start tier only**, with zero-consensus-weight note. The binding precedence `grapevine-resolved → firmware-blessed → none` is preserved **verbatim** in the untouched Resolution-model paragraph (`BIBLE.md:1448`) and glossary entry (`:1412`, unchanged per ADR). Matches ADR fixed point 5.
- [x] **AC7 — general principle stated once.** `BIBLE.md:1440` (bolded close of the Target paragraph): "the manifest seeds published tags; the graph derives from published events; Neo4j-only stubs were the interim form." Corpus grep confirms exactly one occurrence in BIBLE.md. (Placement deviates slightly from the ADR's site note — see Non-blocking #3.)
- [x] **AC8 — ADR 0008 follow-up flagged, not designed.** `BIBLE.md:1462`: follow-up appended to the Phase-A paragraph with the inverse-`s` caveat verbatim in substance (child-claims-parent flip → an `s` on the TA's local superset derives the *inverse* of the canonical Phase-A edge; curator-side tag or reserved uppercase inverse needed). Matches ADR fixed point 7. No design content beyond the flag.
- [x] **AC9 — ratified-target vs deployed-today distinguished.** `BIBLE.md:1440` labeled "**Target (ratified — `community-reference` ADR 0030; not yet wired)**"; `:1442` labeled "**Status today (deployed)**" — stub live for exactly one concept (`nostr-relay`), "no seeding code exists," designated flip site marked for the code story. Glossary `:1411` carries the same Target/Today split. Pattern matches the §27 precedent (verified at `BIBLE.md:1538`–`1566`: "The standard / Status today / Target direction"). Nowhere does the BIBLE present the seeding behavior as implemented.
- [x] **AC10 — `firmware/active/manifest.json` untouched.** Verified by diff: `git diff 735b960b~1..735b960b -- firmware/active/manifest.json` and `git diff staging..HEAD -- firmware/active/manifest.json` are both empty (0 lines). The manifest still carries exactly one `communityReference` (slug `nostr-relay`, `manifest.json:225`–`227`) — so the "live for exactly one concept" claim is factually accurate.
- [x] **AC11 — `npm test` green.** Run by reviewer: Overall PASS.
- [x] No criterion silently dropped; no behavior/claims added beyond the story (the handoff-table annotations are within the ADR's site inventory).
- [x] **Planning-gate resolutions reflected accurately:** (1) manifest-only scope + runtime deferred — `BIBLE.md:1450` and handoff O10 annotation (`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:184`); (2) per-concept explicit entries, mixed curators, O9 dormant — `BIBLE.md:1450` + ADR fixed point 5; (3) pinning optional, verify-when-present / log-and-continue — `BIBLE.md:1438`/`:1440` + ADR fixed point 1.

## ADR adherence (site inventory)

All six inventoried sites edited as specified; nothing beyond scope:

- [x] **`BIBLE.md:1438`** (§22 definition) — rewritten as the seed definition; four retained functions; cites `community-reference` ADR 0030 amending ADR 0005's stub design.
- [x] **`BIBLE.md:1440`/`:1442`/`:1444`** (former stub paragraph) — split into Target (ratified) / Status today (deployed) / reframed bookmark paragraph. Verbatim stub mechanics preserved in Status today (`pass_communityReferences`, republish-without-re-signing, `buildImportCypher`/`executeCypher`, `REFERENCES {source:'firmware-community'}` — all names verified against `src/firmware/install.js:1192`–`1227`).
- [x] **`BIBLE.md:1450`** (Flaw A) — coverage-widening + pointer-typed/zero-consensus-weight appended.
- [x] **`BIBLE.md:1462`** (Phase-A superset) — ADR 0008 follow-up flag with inverse-`s` caveat appended.
- [x] **`BIBLE.md:1411`** (§21 glossary `communityReference`) — rewritten with the Target/Today split; `:1412` precedence entry untouched as required.
- [x] **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — §5 table: P1 annotated ✅ shipped (`community-reference` ADR 0029 / story #33, 2026-06-12, `"reference"` → `"pointer"` rename — all three facts verified against ADR 0029 header/Decision-1 and story 33); P2 annotated ✅ ratified (`community-reference` ADR 0030 / story #34, 2026-06-13, the three gate resolutions, code story gated on the three-branch reconciliation — verified against story/ADR). §4: O10 narrowed-note added; runtime case stays open. **No status flip** — doc header remains 🔴 OPEN (P3/P4 remain), as the ADR requires.
- [x] **Checked clean / untouched — verified:** `protocols/` (zero `communityReference` mentions; not in diff), ADRs 0005/0006/0008 and all stories/reviews (immutable — not in diff), `AGENTS.md`/`OPERATIONS.md` (zero mentions), `firmware/active/manifest.json` (empty diff). No stale "resolved at install into a `REFERENCES` placeholder" phrasing survives in any mutable doc — the §21 glossary was the only live site and is updated.
- [x] No new dependencies; no source files; layering respected (deployment-side seeding behavior lands in BIBLE territory, wire form stays normative in `inherit-from.md` per the boundary rule).

## Consistency audit (docs-mode core)

- [x] **Collision contract (`BIBLE.md:1446`) stays coherent.** "Two producers" remains accurate under the new split: both concept-level producers exist in the deployed graph (the stub is live today for `nostr-relay`; `b`-derived is ratified-live per ADR 0029), and even post-cleanup-story, the contract's `source` disambiguation stays load-bearing for legacy edges. The Status-today paragraph explicitly hands off to "the collision contract below" rather than duplicating it. No contradiction with ADR 0029's "third producer class" framing (that count includes tag-level ingest; `:1446` counts concept-level producers and names the tag-level overload separately in the same paragraph).
- [x] **Glossary ↔ §22 agreement.** `:1411` (communityReference: seed/Target/Today) matches §22 `:1438`–`:1442` exactly; `:1414` (REFERENCES concept-level, "two producers," "asserted, wire-derived") remains accurate for the deployed graph and defers to §22.
- [x] **"Bookmark, not agreement" (`BIBLE.md:1444`) is terminology-consistent.** `inherit-from.md:91` says verbatim "a bookmark is not agreement"; its family table (`:104`) calls pointer-typed `b`/concept-level REFERENCES "non-committal correspondence." ADR 0029's "asserted" means *the author published it on-wire* (vs a Neo4j-only stub) — an asserted *pointer*, not asserted agreement — so "stub or `b`-derived — is a bookmark, not agreement" contradicts neither. The widened header correctly covers both producers without claiming the stub is "asserted."
- [x] **Consumer-filter claim (`BIBLE.md:1442`) verified against source:** no bare concept-level `REFERENCES` traversal exists in `src/` (only the install producer, which sets `source`, and tag-level ingest in `eventSync.js`, which never sets it) — the "every consumer filters on `source`" harmlessness claim holds.
- [x] **§27 precedent reference accurate** (`BIBLE.md:1538`–`1566` uses exactly the normative/status-today/target split the ADR cites).
- [x] **Cross-references resolve:** §22, §25, ADR 0005/0008/0029/0030, D4/D5, O10, the three-branch reconciliation pointer — all resolve to real artifacts.

## Concept-graph integrity

- [x] No live concepts touched — documents only; **no firmware reinstall needed** (story + ADR both state this; manifest diff confirms).
- [x] Handles quoted in docs remain `kind:pubkey:slug` form (e.g. `39998:919ba0…:nostr-relay`).
- [x] No new code — orientation rules N/A.

## Things tests can't catch

- [x] No secrets, no debug code, no commented-out content in the diff.
- [x] No scope creep: exactly the ADR's six sites; the immutable records and `protocols/` untouched.
- [x] No unimplemented behavior presented as wired (the AC9 audit above is the docs-mode analogue of this check).

## House rules check

- [x] Concept Graph API authority respected (no concept re-derivation; docs change only).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

None.

### Non-blocking

1. **`BIBLE.md:1440`, `BIBLE.md:1450`** — two new **unqualified** "ADR 0029" citations ("pointer-typed per ADR 0029"; "seeds are `\"pointer\"`-typed (ADR 0029)"), while `profile/0029-profile-verified-followers-count.md` collides and the story-33 review recorded "every new 0029 citation is epic-qualified" as the observed standard. Not blocking because: both sit in paragraphs anchored by a qualified "`community-reference` ADR 0030" citation, §22 *is* the community-reference section, three qualified `community-reference` ADR 0029 citations surround them (`:1446`, `:1452`, `:1468`), and ADR 0030's own Flaw-A site note says "(cite ADR 0029)" unqualified — the Implementer followed the ADR. Optional improvement: qualify both at the next touch of §22 (the designated flip site means this paragraph will be edited again by the code story anyway).
2. **`BIBLE.md:1438`** — "amending the original stub design of ADR 0005" is unqualified and `protocols-directory/0005-tags-spec.md` now collides on the number. Same mitigation: §22 context makes it unambiguous, and §22 already cites 0005/0006/0008 unqualified throughout (pre-existing convention). Optional: qualify on next touch.
3. **Site-allocation deviation (no action):** the ADR's implementation notes placed the general principle (fixed point 6) at the stub-paragraph site; it landed instead at the close of the Target paragraph (`BIBLE.md:1440`). Fixed point 6's actual requirement — "stated once in §22" — is satisfied (exactly one occurrence), and the placement arguably reads better (the principle summarizes the target). Recorded so the deviation is deliberate, not missed.

## Verdict

**PASS**

All eleven acceptance criteria verified against final file states; all six ADR-inventoried sites edited as specified and nothing else; the checked-clean list holds under grep and diff; the Target/Status-today split keeps the BIBLE honest about what is wired; `firmware/active/manifest.json` is byte-identical to staging; `npm test` is green.

*Process note:* per the Review workflow the story's `**Status:**` would flip to Done in this commit; the review was run under an explicit do-not-edit-story-files instruction, so that flip is left to the orchestrator.
