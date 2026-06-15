# Review: Story 2 (tag-stack-merge-hardening) — nostr-user-tag hybrid e+a writer

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-14
**Diff:** `git diff 14006dd7..386de538` (impl commit `386de538`; tests at `14006dd7`, ADR at `8506f504`)
**Production files:** `ui/src/utils/publishProfileTag.js`, `ui/src/hooks/useProfileTags.js`, `firmware/versions/v1.0.0/concepts/nostr-user-tag/json-schema.json`

## Quality gates (run by reviewer, not trusted)

- [x] **Story suite** `node test/nostr-user-tag-hybrid-ea-writer.test.js` — **10 passed, 0 failed**.
- [x] **`npm test` (full gate)** — story suite PASS. Overall FAIL on `tl-publication-from-pins` (1) and `most-pinned-tag-index-publish` (4) — the documented cross-suite live-strfry contamination. **Neither is in this diff** (changeset is two UI files + the firmware schema); both pass standalone (confirmed across prior reviews this session). Not a regression.
- [x] **Firmware/concept-graph (AC-6)** — Implementer reinstalled firmware locally; I confirmed the concept-graph node for the `nostr-user-tag-schema` carries `tagAddress` + the `tag-address` property node. Schema parses as valid JSON.
- _Lint / typecheck / build — not configured; skipped per house rules._

## Spec adherence

- [x] **AC-1** — `publishProfileTag.js:69` adds `['a', tagAddress]` (`39999:${tag.authorPubkey}:${tag.slug}`) immediately before the retained `['e', tag.eventId]:70`; `d`/`p`/`z`/`polarity` unchanged.
- [x] **AC-2** — content mirror carries `tagAddress` alongside `taggedPubkey` + `tagEventId` (`:75`).
- [x] **AC-3** — refuse-on-missing guard (`:53`): throws when `tag.authorPubkey` isn't 64-hex (ADR-0002 Option A), before signing. `createTag` returns `authorPubkey: signed.pubkey` (`useProfileTags.js:123`). Both apply surfaces already supply it (`handleAvailableTags` :144/:212, `handleTagById` :676 — all three builders verified).
- [x] **AC-4** — `e` retained (`:70`); read path still scans `#e` (unchanged) → old + new assertions match identically.
- [x] **AC-5** — schema gains optional `tagAddress`; `required` stays `["taggedPubkey","tagEventId"]` — legacy e-only assertions still validate.
- [x] **AC-6** — firmware reinstall performed + concept-graph confirmed (above).

## ADR adherence

- [x] All three files match ADR-0002's implementation notes exactly. Option A (refuse) implemented, not the rejected silent-e-only fallback. `z`-tag literal (`NOSTR_USER_TAG_HANDLE`, ADR-0015-pinned) untouched. No `#a` read support, no lazy re-emit — both correctly out of scope.
- [x] **No ADR-0015 conflict:** the `a` coord uses the tag-element author (`tag.authorPubkey`), not the TA. Confirmed.
- [x] No new dependencies. Schema staged via the real versioned path (the `firmware/active` symlink target) — correct.

## Things tests can't catch

- [x] **Caller audit (critical, since the live browser apply was deferred):** only two writer call sites exist — `useProfileTags.js:72` (`applyTag`/`disputeTag`, tags from `availableTags` or `createTag`) and `Tag.jsx:95/:101` (tag from `useTagDetail`). Both source `authorPubkey`. The refuse-throw will not fire on a normal apply/dispute. Verified statically (see the one exception below).
- [x] **No secrets, no debug logging, no dead code.** Comments are accurate and cite the ADRs.
- [x] **Slug fragility:** `tagAddress` interpolates `tag.slug`, which the guard does not validate — but the pre-existing `dTag` already assumes `tag.slug`, so the `a` coord is no more fragile than the existing path. Not a regression.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/components/ProfileTagsSection.jsx:44` — orphan-stub chips now silently no-op on apply/dispute.** When a chip's tag id is absent from `availableTags`, the component builds a fallback stub `{ eventId, slug: id.slice(0,8), name, description }` with **no `authorPubkey`**. Post-change, applying/disputing such a stub trips the new refuse-throw, which `handleApply`/`handleDispute` swallow (`:78-79`) → a silent no-op. **This is working as designed** (ADR-0002 Option A: never emit a malformed `a` — the stub would have produced `39999:<author?>:<wrong-slug>`), and it does **not** worsen data integrity: pre-change this same path published a *wrong-slug* assertion (the exact orphan-stub bug already tracked as a Tier-3 fast-follow, `_intake.md:952`). So the change trades "publishes garbage" for "silently does nothing" on an already-broken, out-of-scope path. **Ask (for the orphan-stub follow-up, not this story):** when that fast-follow is picked up, the orphan-stub path must either carry the tag's real `authorPubkey` or be removed — and ideally surface an error instead of silently catching. Logged here so it isn't lost.
2. **Browser end-to-end not run** — the source-contract + schema/concept-graph confirm the code and wire shape, and the caller audit confirms `authorPubkey` threads from both real surfaces. A one-minute in-browser apply (confirming the published kind-39999 carries `a`+`e`) remains a nice-to-have before/at deploy.

### Out-of-scope (carried forward)

- `#a` read/group support, lazy self-re-emit, `findTagsByNameSubstring` authorPubkey, ADR-0022 duplicate-path cleanup — all correctly deferred (story Out of scope / `_intake.md` 2026-06-12).
- This is the **last pre-merge blocker** for the epic (Story 1 + Story 2 close the expert review's must-fix set). Tier-3 fast-follows remain post-merge.

## Verdict

**PASS** — all six ACs implemented per ADR-0002 with reviewer-verified passing coverage (10/0 + live firmware/concept-graph). The refuse-throw is correct and, by static caller audit, fires only on the already-broken orphan-stub path (out of scope, tracked, no data-integrity regression). The only full-gate red is the independently-confirmed pre-existing cross-suite flake in suites this diff does not touch.
