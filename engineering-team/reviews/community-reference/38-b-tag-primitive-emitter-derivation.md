# Review: Story 38 — the shared `b`-tag primitive (emitter + edge derivation + stub retirement)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Diff:** `git diff 529465e7..b4f81ab4` (impl commit `b4f81ab4`; failing-tests commit `529465e7`)
**Branch:** `feat/b-tag-primitive` (epic `community-reference`)
**Scope:** two source files only — `src/api/neo4j/eventSync.js` (buildImportCypher `b` branch) and `src/firmware/install.js` (emitter in `pass_communityReferences` + the stub-retire gate).

## Quality gates (run by reviewer, not trusted)

- [x] `node test/b-tag-primitive.test.js` — **16 passed, 0 failed.** All 11 reds from the red-phase flipped green; all 5 green guards stayed green.
- [x] `node --check src/api/neo4j/eventSync.js` → OK; `node --check src/firmware/install.js` → OK.
- [x] Regression — `node test/test.js` (full aggregator). Suites that exercise this diff all PASS:
  - `b-tag-primitive` → PASS (16/0)
  - `community-reference-nostr-relay-stub` → PASS (4/0)
  - `community-reference-superset-link` → PASS (4/0)
  - `header-conceptgraph-tag` → PASS (2/0)
  - `nostr-user-tag-hybrid-ea-writer` → PASS (10/0), `tag-read-union` → PASS (14/0)
  - Overall aggregator = FAIL, driven by **two server-dependent suites unrelated to this diff** (see below).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

### The two aggregator failures are pre-existing / server-dependent, not regressions

- `tl-publication-from-pins` (Story 11) — 1 fail: `POST /api/trusted-list/refresh-pinned-tag … fetch failed`. This is the known server-dependent flake the brief flagged.
- `most-pinned-tag-index-publish` (Story 13) — 4 fails in the aggregator, but the suite **passes 7/0 standalone** (`node test/most-pinned-tag-index-publish.test.js`). The aggregator failures are server/order-state, not behavioral.

Neither suite is touched by this diff: `grep -niE "trusted-list|trustedList|pinned|most-pinned|refresh-pinned"` over **both** changed files returns **zero matches** (grep exit 1). The two changed files contain no trusted-list / pin / most-pinned code, so they cannot have caused either failure. Confirmed unrelated.

## Spec adherence (ACs)

- [x] **AC-1 (emitter — pointer-`b` seeded, pointer-only):** `install.js:1059` appends exactly `['b', cr.headerATag, 'pointer']`; type is the literal `'pointer'`, never `inherit`. Re-signs via the runtime TA path: `await loadTAKey()` then `signAndFinalize({ kind: 39998, content: localHeader.content || '', tags: newTags })` (`install.js:1060-1061`), imported from `../api/normalize/helpers` (`install.js:31`). **No hardcoded key** anywhere in the diff (`grep -E '82b75e47|[0-9a-f]{64}'` over both files → none). `taPubkey = firmware.getTAPubkey()` (runtime, `install.js:1004`).
- [x] **AC-2 / AC-3 (derivation, type-gated):** `eventSync.js:265` gates on `tag[2] === 'inherit'` (explicit string, never `!== 'pointer'`). `inherit` → `MERGE (child)-[:INHERITS_FROM]->(parent)` with **no** `source` (`:270`). pointer/absent → `MERGE (child)-[r:REFERENCES]->(target) SET r.source = 'b-tag'` (`:276`). Edge is **header-level**: `child = esc(uuid)` (`eventSync.js:179`, the event's own a-tag node), NOT `t${i}` — verified against the tag-level `e`/`a` branches at `:232`/`:241`. The comment at `:259-263` explicitly flags the header-vs-tag distinction. MERGE (not CREATE) for both node and relationship. Direction `child→target`, no flip (wire spec `:46`). Naked target MERGE-creates if absent (matches the `a` branch's `ON CREATE` pattern, per OQ-1).
- [x] **AC-4 (stub retired for `b`-carrying headers):** `install.js:1261` — `if (link.seededB) { …skip stub MERGE… }`. The legacy `MERGE … SET r.source='firmware-community'` (`:1270-1275`) is preserved unchanged in the `else` back-compat path.
- [x] **AC-5 / AC-6 (idempotent + never-clobber):** never-clobber is `localHeader.tags.some(t => t[0] === 'b')` (`install.js:1054`) — keys on `t[0] === 'b'` only, ANY type/ANY target. This doubles as idempotency (a second install sees the `b` it wrote and suppresses). Derivation idempotency = MERGE at `eventSync.js:270/276`.
- [x] **AC-7 (legacy stubs not deleted):** no `DELETE`/`DETACH` introduced anywhere in the diff; the legacy MERGE stays for the non-seeded path. Comment at `:1265` calls this out.
- [x] **AC-8 (no manifest change):** `git diff --stat` shows only the two source files; `firmware/active/manifest.json` is **not** in the diff (byte-unchanged). The stub trap holds.

## ADR adherence (community-reference ADR 0034)

- [x] **Option 1A** — derivation lives in `buildImportCypher` as a third tag branch alongside `e`/`a` (`eventSync.js:258`). Fires on both fresh install and ongoing sync via the single import chokepoint (OQ-2 resolution).
- [x] **Option 2A** — emitter re-signs the *live* local header (scan at `install.js:1043-1046`, additive `newTags` at `:1059`), preserving existing tags; uses only existing helpers (`signAndFinalize`, `/api/strfry/publish`, `buildImportCypher`). No new signing/publish/build machinery.
- [x] **Fixed point 1 (pointer-only):** emitter seeds `'pointer'` only; derivation handles both types.
- [x] **Fixed point 2 (type-gate on explicit `'inherit'`):** `tag[2] === 'inherit'` — confirmed.
- [x] **OQ-1 (seed independent of community fetch):** the seed block (`:1041-1070`) sits **before** the community fetch (`:1072`) and its `!ev`/pin-mismatch `continue`s (`:1078-1085`). A fetch miss does not bypass the seed. Verified by reading control flow — see "Things tests can't catch" below for why the seed-then-fetch-miss path is still correct.
- [x] **OQ-3 (superset untouched):** the superset fetch/materialize (`install.js:1096-1132`) and the `IS_A_SUPERSET_OF` MERGE (`:1282-1298`) are not modified by the diff.

## Concept-graph integrity

- [x] Handles in `kind:pubkey:slug` form — `cr.headerATag` (`39998:919ba08a…:nostr-relay`) and the local-header a-tag (`39998:<taPubkey>:<slug>`) both well-formed; the `82b75e47…` reference in the ADR is the ADR-0015 legacy *coordinate*, never a signing key, and does not appear in the diff.
- [x] No concept *definition* (schema / header `json`) changed — the header gains one wire tag, not a property. Per ADR OQ-4, firmware reinstall is required only **to verify** the emitter (it runs in `pass_communityReferences`), not to refresh schemas. Called out — the authoritative emitter check is the reinstall-then-inspect recipe.
- [x] New code orients via the ADR/wire-spec, not a re-derivation from BIBLE.

## Things tests can't catch (judged)

- **OQ-1 reordering safe.** The seed reads only `taPubkey` (`:1004`), `slug` (`:1012`), and `cr.headerATag` (`:1010`) — all in scope before the fetch. It depends on nothing the community fetch produces. The fetch and superset blocks below it are unchanged and still see the same `cr`/`dTag`/`curatorPk`. No ordering hazard.
- **`seededB` threading correct.** Set in `pass_communityReferences` (`:1041`, `:1056`, `:1064`), attached to the `pending` entry (`:1140`), consumed at the stub gate (`:1261`). One subtlety: on a community-fetch miss the concept `continue`s at `:1080` and is **not** pushed to `pending`, so the stub loop never processes it — but that is the correct outcome (the `b` edge was already derived at `:1063`, and no stub is wired), so AC-4 still holds on that path. No bug.
- **Header-level vs tag-level edge** is correct and explicitly commented (`eventSync.js:259-263`) so a future reader won't assume symmetry with `e`/`a`.
- **No secrets, no debug noise, no dead code.** The added `console.log`s are structured install-progress logs consistent with the surrounding pass (the file already logs each step with the same emoji convention); not stray debugging.
- **Graceful-by-contract preserved.** The seed is wrapped in its own `try/catch` (`:1042/:1068`) that logs and continues; an absent local header logs and skips (`:1047-1048`); nothing throws out of install.

## House rules check

- [x] Concept Graph API authority respected (no re-derivation; TA pubkey via `firmware.getTAPubkey()` runtime).
- [x] No new lint/typecheck/build tooling.
- [x] Per-deployment TA pubkey rule honored — no literal key; signs through `loadTAKey()`/`signAndFinalize()`.

## Findings

### Blocking
None.

### Non-blocking
1. **`eventSync.js:269/275`** — the `b` branch MERGE-creates the `target`/`parent` node without an `ON CREATE SET` for `kind`/`pubkey` (unlike the `a` branch at `:254`). Harmless: it's a naked uuid node that fills in when the target later syncs, and the ADR §2 example omits it too. No change required; noted for the eventual sweep/Story 3 when the foreign node may be materialized.

## Verdict
**PASS** — the diff matches the story (all 8 ACs), the ADR (Options 1A + 2A, fixed points 1–3, OQ-1/2/3), and the wire spec (type-gate on explicit `inherit`, child→target no-flip). Gates run by the reviewer: `b-tag-primitive` 16/0, both files `node --check` clean, and the only aggregator failures (`tl-publication-from-pins`, `most-pinned-tag-index-publish`) are server-dependent and provably untouched by this diff (zero pin/TL references in either changed file). No hardcoded TA key. Implementation is ready; Story 38 should be marked **Done**.
