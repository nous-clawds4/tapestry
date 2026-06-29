# Review: Story 3 — Seed event-tagging DList concepts in firmware

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-29
**Diff:** working tree vs `1760388a` (test-design commit) — new `firmware/versions/v1.0.0/concepts/{nostr-event-tag,tagging-with-specific-tag}/`; edits to `firmware/versions/v1.0.0/manifest.json` + `src/api/normalize/index.js`
**Story:** `engineering-team/stories/event-tagging/3-firmware-seed-event-tagging-concepts.md`
**ADR:** `engineering-team/decisions/event-tagging/0003-firmware-seed-event-tagging-concepts.md`

## Quality gates (run by reviewer, not trusted)

- [x] `node test/event-tagging-firmware-seed.test.js` → **11 passed, 0 failed, 0 skipped** (independent re-run). The 2 live tests are **PASS, not SKIP** — the post-reinstall behavioral proof the plan made Reviewer-required actually ran.
- [x] Regression: `event-tagging-core` 15/15, `event-tagging-spec` 5/5, `global-publish-gate` 8/8, **`header-conceptgraph-tag` 2/2** (the other suite that asserts `handleCreateConcept` header tags — unbroken by the seam change).
- [x] `node --check src/api/normalize/index.js` clean; all five new/edited firmware JSON files parse.
- [x] _Lint / Typecheck / Build not configured — skipped._

## Spec adherence
- [x] Every AC mapped to a passing test (both handles seeded; slugs/names; federation; literal header rule on the wire; existing concepts unaffected). No criterion dropped.
- [x] **Spec-wire fidelity verified on the actual published event:** the `tagging-with-specific-tag` kind-39998 header carries literal `["recommended","a"]` and `["allowed","e"]` (confirmed via `/api/strfry/scan`), exactly as `event-taggings.md` shows.

## ADR adherence
- [x] Files match ADR 0003: two concept dirs mirroring `nostr-user-tag` (3 files each); permissive schemas (`required: []`, Story-1 empty content); `tagging-with-specific-tag` declares `headerTags` under `conceptHeader`.
- [x] Manifest entries: **exact wire-critical slugs** `nostr-event-tag` / `tagging-with-specific-tag`; `communityReference.headerATag` = `39998:82b75e47…:<slug>` (canonical) + `relayHints`. `knownGoodEventId` omitted as designed (install fetched by `authors + #d`; the `["b", …, "pointer"]` federation tag on the published header confirms the bridge applied).
- [x] **Seam extension is minimal + generic** (`src/api/normalize/index.js:1262–1270`): spreads `conceptHeaderOverrides.headerTags` onto the header tags before `signAndFinalize`, guarded (`Array.isArray && length≥2 && typeof tag[0]==='string'`), and excluded from the json-blob merge set (`:1236`) so it isn't double-encoded. Reads `conceptHeaderOverrides.headerTags` (literal, not optional-chained) — matches the source-contract.
- [x] Identity rule honored: concept *files* carry no pubkey; the local concept is seeded under the **runtime TA** (= canonical on dev). The only literal is the `communityReference` canonical pointer — the intentional ADR-0015-extension, paired with the runtime-TA seed.

## Concept-graph integrity
- [x] **Firmware reinstall performed** (AGENTS.md §6); both handles resolve at `:8877` (`/api/concept-graph/node/…:nostr-event-tag` returns the node). `nostr-user-tag` still resolves (live regression).
- [x] Handles in `kind:pubkey:slug` form, composed under the runtime TA.

## Things tests can't catch
- [x] **Manifest diff is purely additive** — no existing entry altered (`git diff` shows no deletions). Blast radius = two new entries + the no-op seam branch.
- [x] **No external publishing during reinstall** — firmware headers publish to local strfry (`publishToStrfry`); the `dcosl.brainstorm.world` relay hint is a read (fetch the canonical header). Consistent with the local-only guard.
- [x] Seam guards malformed declared tags; the `headerTags` branch is a no-op for every other concept (none declare it), so existing 38 concepts are unaffected.
- [x] No secrets, no debug logging, no commented-out code.

## House rules check
- [x] No hardcoded TA in concept files (only the intentional canonical `communityReference` pointer). No new lint/typecheck/build tooling.

## Findings

### Blocking
_None._

### Non-blocking
1. **Live state mutated (informational, not a defect).** Running the reinstall seeded the two concepts into the dev Neo4j/strfry. Expected — it's how the live proof ran — and it means later stories (read API, write path) testing on this stack will find the concepts present. Worth remembering, not fixing.
2. **`nostr-event-tag/json-schema.json` documents a `nostrEventTag` payload** (`target`/`polarity`) that assertions don't currently emit (content is empty, Story 1). It's permissive (`required: []`) and forward-compat per the ADR — harmless. If a reader expects the schema to describe live content, the "Optional / forward-compat" wording covers it. No change.
3. **`communityReference.knownGoodEventId` omitted** — intentional (ADR); install resolved the canonical by `authors + #d`. Backfilling it later is an ADR-noted out-of-scope rollout detail.

## Verdict
**PASS** — files + seam match ADR 0003; firmware reinstalled and the live behavioral proof (handles resolve + literal `recommended/allowed` on the published header + federation `b`-tag) is green, not skipped; no regressions (incl. the sibling `header-conceptgraph-tag` suite). Non-blocking items are informational.
