# Review: Story 2 (tag-federation, Half 2 — Part A) — Seed the pointer-`b` map on the three tag concepts

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Branch:** `feat/b-tag-primitive`
**Diff:** `git diff f28b06b4...HEAD` (Story 2 commits: `367cc22c` tests, `e72c0015` manifest + AC-8 transition, `4012d59c` live-verification docs; ADR at `f28b06b4`)
**Story is data-only** — manifest + tests + docs; no source edits.

## Quality gates (run by reviewer, not trusted)

- [x] **Gate 1 — `node test/b-tag-seeds.test.js`** → **7 passed, 0 failed** (EXIT 0). Matches expected 7/0.
- [x] **Gate 2 — `node test/b-tag-primitive.test.js`** → **16 passed, 0 failed** (EXIT 0). Matches expected 16/0. The two transitioned AC-8 tests now assert the post-Story-2 truth (tag concepts carry a `communityReference`; exactly the four-concept set) and pass.
- [x] **Gate 3 — `node -e "JSON.parse(... 'firmware/active/manifest.json')"`** → `VALID JSON` (EXIT 0). `firmware/active` → `versions/v1.0.0`, so the validated path is the real one.
- [x] **Gate 4 — `node test/test.js`** (full aggregator) → **Overall: FAIL (EXIT 1)**, but the **only** failing suite is `tl-publication-from-pins` (9 passed, **1 failed**): `POST /api/trusted-list/refresh-pinned-tag` → "fetch failed". This is the documented pre-existing server-dependent flake (no running stack on the unit host). `most-pinned-tag-index-publish` did **not** fail this run. The two Story-2 suites (`b-tag-primitive` 16/0, `b-tag-seeds` 7/0) both PASS. Confirmed Story 2's diff touches **no** pin/TL/install/eventSync source (`git diff --name-only` over those paths returns nothing), so the failure is unrelated to this change.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

- [x] **AC-1 (manifest seeds) — VERIFIED EXACT.** `firmware/versions/v1.0.0/manifest.json:308,325,341` each add a `communityReference` with:
  - `headerATag = "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:<slug>"` per slug ✓
  - `relayHints = ["wss://dcosl.brainstorm.world"]` ✓
  - `knownGoodEventId`: tag `6f38f7b7748cbece9f75d131f0c79392cc01fc24cac8a7bdd11a9fc9f24e6fd0`, nostr-user-tag `7df925f78f7f416429b52d558712f1a33d018170a3558706024140199dfe7893`, tag-pinning `69d36397d92c086b5c184840f5af91ad89ab2f7718fcc674418a0b80074c1eef` ✓
  Insertion is clean: only these three concept objects gained a member (comma added after `categories`); no sibling clobbered. Covered by `test/b-tag-seeds.test.js:107-130` (deep-equal per slug).
- [x] **AC-1 scope guard / AC-8-equivalent — VERIFIED.** Exactly four concepts carry a `communityReference`: `nostr-relay` (pre-existing, Story 38) + `tag` / `nostr-user-tag` / `tag-pinning`. Confirmed by `grep` (lines 225/308/325/341) and enforced by `b-tag-seeds.test.js:200-211` AND `b-tag-primitive.test.js`'s transitioned second guard. Nothing crept in.
- [x] **AC-2–AC-6 — LIVE-ONLY, not host-unit-testable; correctly documented, not faked.** The test plan and `b-tag-seeds.test.js` header explicitly mark these as a live reinstall-then-inspect recipe (no fake unit test pretends to cover them). ADR 0002 §"Live verification (2026-06-17)" records they were live-verified on the dev container (all four headers seeded, all four `REFERENCES{source:'b-tag'}` edges derived, stub retired, superset link intact). This is the honest, correct disposition for a story whose behavioral surface needs a running stack.
- [x] **AC-5 (idempotent OUTCOME) — reworded claim matches what was verified.** Rewording narrows the prior "operator re-point survives reinstall" claim to "idempotent outcome (one `b`, one edge per concept)" — which is exactly what the live verification showed. Honest, not overstated. See finding judgment below.
- [ ] **AC-7 (David PR breadcrumb)** — a **PR-description deliverable**, not code. Outstanding for the PR (the user does PR hygiene next). **Not a code-review blocker** per the story and test plan.

## ADR adherence

- [x] Files changed match ADR 0002 §"Implementation notes": `firmware/active/manifest.json` is the **only** source/data file changed. **No** edit to `src/firmware/install.js` or `src/api/neo4j/eventSync.js` (ADR 0034 / Story 38 owns those) — confirmed by `git diff --name-only`.
- [x] Option A (three explicit per-concept blocks with `knownGoodEventId`) implemented exactly as decided. No factoring/slug-derivation (rejected Option C); pins present (rejected Option B).
- [x] No new dependencies. JS-without-build respected. No new lint/typecheck/build tooling.
- [x] Emitter + derivation present on branch (verified): `install.js:1001` `pass_communityReferences`, `:1041/:1140` `seededB`, `:1065` "pointer-b seeded", `:1261-1266` stub-retire; `eventSync.js:258` the `b` branch. So adding the manifest entries is **not** a stub trap.

## Cross-story test transition (judged carefully) — LEGITIMATE

Story 38's two AC-8 guards in `test/b-tag-primitive.test.js` asserted the tag concepts carried **NO** `communityReference` (the correct stub-trap guard while the emitter did not exist). Story 2 flipped them to assert the tag concepts NOW carry one. All three legitimacy conditions hold:

- **(a) emitter genuinely exists on this branch** → adding the manifest entries seeds the pointer-`b`, not the legacy stub. Verified at `install.js:1001` + `eventSync.js:258`. Not a stub trap.
- **(b) the transition is documented** → a detailed comment block at `b-tag-primitive.test.js:330-346` explains the Story 38 → Story 2 transition, AND the commit message (`e72c0015`) calls it out explicitly ("ALSO transitions Story 38's two AC-8 stub-trap guards…").
- **(c) exact-contents assertion moved to `b-tag-seeds.test.js`** → the headerATag/relayHints/knownGoodEventId deep-equals live at `b-tag-seeds.test.js:107-190`. No coverage lost; the new guards delegate ("Exact contents are asserted in test/b-tag-seeds.test.js"). The scope-set guard is *not* weakened — `b-tag-primitive.test.js`'s second test still pins the exact four-concept set, so scope creep is still trapped from that suite too.

Verdict on the transition: a clean, well-documented inversion of a guard whose precondition (no emitter) was deliberately ended by this story. Not a weakening.

## Live-verification finding (judged) — honestly recorded, correctly scoped, disposition reasonable

- **(a) AC-5's reworded claim matches what was verified** — "exactly one `b` and one edge per concept after every install" is the live-observed outcome. The narrowing (never-clobber is within-run-only) is stated, not hidden.
- **(b) honestly recorded, not buried** — it has its own ADR section (§"Live verification (2026-06-17) — and one finding"), an OPEN.md row (#8), and an inline AC-5 note in the story. Three surfaces.
- **(c) correctly scoped as a Story-38 emitter property, not a Story-2 defect** — root cause is firmware `pass1`/`pass2` rebuilding each TA header (b-less) *before* `pass_communityReferences` runs, so the emitter always re-seeds the firmware default. That is emitter/firmware behavior; Story 2's manifest data is unaffected. Correct attribution.
- **(d) disposition (accept + document + follow-up) is reasonable; the follow-up exists** — OPEN.md #8 is present in the diff, tracks the within-run-only scope plus a future "updateable firmware" idea, and notes the map deliverable is unaffected. Accepting "reinstall restores firmware defaults" is defensible.
- **Evidence supports the non-dev claim.** The decisive proof is the `nostr-relay` case on this dev box: because the local TA is `82b75e47…` but `nostr-relay`'s coordinate is `919ba08a…`, that seed is a **genuine cross-pubkey** case whose derived edge spans **two distinct nodes** (`82b75e47…`→`919ba08a…`). That demonstrates the non-degenerate local→canonical machinery works on a distinct-TA deployment; the tag concepts are self-loops only because this box's TA coincidentally equals the canonical coordinate. This is the right way to evidence non-dev behavior without a non-dev deployment.

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form — `39998:82b75e47…:<slug>` for all three `headerATag`s.
- [x] **Firmware reinstall required and called out.** ADR 0002 §Consequences flags this as the first reinstall that activates the primitive on real concepts, and it was live-run on the local stack. No concept *definition* changed (each header gains one wire tag, not a schema/property), so the reinstall is the activation step, not a schema migration.
- [x] No new code re-derives from BIBLE.md; orientation via the Concept Graph API is honored in the ADR's OQ-2 verification.

## Things tests can't catch

- [x] No secrets committed. The three `82b75e47…` literals are **data coordinates** (b-tag values), the **ADR-0015 named exception** — not signing keys. Consumed as `cr.headerATag`, never as an `authors:` filter / signer read / identity check; the emitter resolves the **local** TA at runtime. Consistent with ADR 0015, which names these exact three slugs. `b-tag-seeds.test.js:170-190` is a documentation-as-test guarding against a future "fix" to a runtime lookup.
- [x] No leftover debug logging, no commented-out code, no TODOs introduced in the diff.
- [x] No race conditions / concurrency surface — data-only manifest change.
- [x] Edge cases covered: JSON-corruption + sibling-integrity guard (`b-tag-seeds.test.js:79-99`), scope creep (the scope guard), and the named-exception coordinate (documentation-as-test).

## House rules check

- [x] Concept Graph API authority respected (ADR OQ-2 verified the three headers live via `/api/concept-graph/node`).
- [x] No new lint/typecheck/build tooling.
- [x] Hardcode rule honored via the ADR-0015 named exception (data coordinate, not a signing key).
- [x] test.js registration complete at all four points (`test.js:102` require, `:272` run, `:464` summary, `:543` overallOk).

## Findings

### Blocking
_None._

### Non-blocking
1. **AC-7 (PR deliverable)** — the David breadcrumb (one-`b`-per-header vs his "two b-tags" phrasing, with the manifest field / `buildImportCypher` branch / emitter line to change) must land in the PR description. Tracked as a PR-hygiene item, not a code blocker.
2. **OPEN.md #8 (follow-up)** — the within-run-only never-clobber finding is tracked; ADR 0034 should gain a note about the within-run-only scope (already flagged in OPEN.md #8 and ADR 0002). Carry forward.
3. **Pin freshness (ADR 0002 OQ-1)** — the three `knownGoodEventId`s are point-in-time (2026-06-17). The commit message states they were re-confirmed live on dcosl. A future canonical re-publish is non-fatal (AC-6 graceful-skip): the pointer-`b` still seeds. No action required.

## Verdict

**PASS**

The manifest carries the three `communityReference` blocks with exact, verified values; the data-contract suite is 7/0 and the primitive suite is 16/0; the only aggregator failure is the documented `tl-publication-from-pins` server-dependent flake, untouched by this diff. The cross-story AC-8 transition is a legitimate, fully documented exit from the stub trap with no coverage loss. The live-verification finding (never-clobber is within-run-only) is honestly recorded, correctly scoped as a Story-38 emitter property, accepted by the requester, and tracked in OPEN.md #8; its cross-pubkey `nostr-relay` evidence credibly demonstrates correct non-dev behavior. The three `headerATag` literals are the sanctioned ADR-0015 data-coordinate exception, not a hardcode violation. Story 2 is data-only and touches no source the ADR forbids.

**On PASS:** the story is marked Done. Remaining (non-blocking, outside code review): the AC-7 David breadcrumb in the PR description; the OPEN.md #8 follow-up (incl. the ADR-0034 within-run-scope note); the live AC-2–AC-6 reinstall recipe is the operator's verify step before any onward merge (this branch auto-deploys nowhere until merged).
