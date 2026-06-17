# Review: Story 1 (tag-federation) — opt-in tag read-union over local + configured relays

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-17
**Diff:** `git diff 07efc172..ffff8ffc` (impl `ffff8ffc`; failing tests `07efc172`; ADR `37a20d4a`)
**Files:** `src/api/profile-tags/index.js`, `src/config/defaults.json`, `ui/src/pages/settings/RelaySettings.jsx`, `test/tag-read-union.test.js` (+ ADR/story)

> Note: this whole cycle (Plan → Arch → Test → Impl → Review) was run autonomously at the operator's request; the operator reviews after this Review step.

## Quality gates (run by reviewer, not trusted)

- [x] `node test/tag-read-union.test.js` — **13 passed, 0 failed**.
- [x] **Regression** — `profile-tags` 13/0, `tag-detail` 8/0, `tag-index` 7/0, `profile-tag-polish` 11/0. No regression: the default is local-only, so existing reads are byte-for-byte unchanged for anyone who hasn't opted in.
- [x] **Full gate** (earlier run): the read-union suite PASS; Overall FAIL only from the two **pre-existing** flakes (`most-pinned-tag-index-publish`, `tl-publication-from-pins`) — neither is in this diff.
- [x] **Live (cycle-local):** default endpoint `available-tags` == local strfry (1590, local-only, no remote query); opting in (`aTagFederationRelays=[dcosl]`) federates+dedupes (1591 — the +1-not-+thousands proves replaceable-dedupe collapses the overlap, AC-5); restored to 1590.
- [x] `node --check` + JSON validity — clean.
- _Lint/typecheck/build not configured — skipped._

## Spec adherence

- [x] **AC-1 (read-union)** — `federatedScan` unions local + configured relays; swapped in at the visibility sites (`handleAvailableTags`, `handleTagsForProfile`, `handleWotTags`, `findTagsByNameSubstring`, `aggregateProfilesTagged`). Unit + source-contract + live.
- [x] **AC-2 (remote tags surface)** — federatedScan returns remote-only events (unit); live opt-in showed federation adds events.
- [x] **AC-3 (local still works)** + **AC-4 (graceful)** — local results always present; remote failure swallowed to `[]`; local failure propagates (don't mask a broken local read). Unit-verified.
- [x] **AC-5 (dedupe)** — `dedupeReplaceable` over the union; latest `created_at` wins. Unit + live (+1).
- [x] **AC-6 (POV preserved)** — federatedScan returns the merged event list; the existing POV aggregation consumes it unchanged (the POV tests in `profile-tags`/`tag-index` keep passing).
- [x] **AC-7 (search untouched)** — `computeTagMatches`/meili proxy NOT federated; source-contract guard asserts no `federatedScan` in the meili proxy.
- [x] **AC-8 (opt-in default-OFF)** — `aRelays.aTagFederationRelays` defaults to `[]`; `dlistFetch` short-circuits to `[]` when unconfigured (no SimplePool query). Unit + live (default == local).
- [x] **AC-9 (admin-configurable)** — `RELAY_GROUPS` gains an `aTagFederationRelays` editor; the existing `RelayGroup` component renders add/remove/save via `PUT /api/settings` (owner/admin). Source-contract.

## ADR adherence

- [x] Files match the (revised) ADR exactly. The operator-steered **opt-in / default-empty / admin-UI** revision is recorded in the ADR's Decision with its rationale (live-user safety + the observed junk-pollution + "don't bake dev topology").
- [x] No new dependencies — `SimplePool` reuses the existing `fetchEvents.js` path; the admin UI reuses the existing `RelayGroup` editor.
- [x] Search gate / writer / firmware / manifest untouched — consistent with "Half 1, additive with Half 2."

## Things tests can't catch

- [x] **Topology not baked.** `dcosl` appears in **no** structural code — federation reads `aRelays.aTagFederationRelays` (operator config); the default ships empty. Arbitrary operators and live users get today's behavior until they opt in.
- [x] **Live-user safety.** The clinching reason for opt-in: a live test showed always-on read-union dumped ~1572 `birb-test` junk events from the shared relay into `available-tags`. Default-OFF means no live instance's API changes without an explicit operator action against a relay *they* trust.
- [x] **`federatedScan` race-safety** — local leg unwrapped (its rejection propagates via `Promise.all`); remote leg wrapped in `.catch(()=>[])` so a remote throw can't reject the union or surface unhandled. Correct.
- [x] **No secrets, no debug logging, no dead code.** Comments cite the ADR and explain the opt-in.

## Findings

### Blocking
None.

### Non-blocking
1. **DList content hygiene (not this code).** `dcosl` is polluted with `birb-test-…` load-test events. This is exactly why the opt-in design points operators at *trusted/clean* relays — but if/when we opt our own envs in, we should federate a clean relay (or clean dcosl) so the surfaced tags aren't junk. Ops concern, tracked here.
2. **Read cost.** Each federated read (when opted in) does a live SimplePool round-trip per request. The ADR defers caching to measurement; revisit if it bites at prod scale.
3. **Ops content-federation still required for the end-to-end goal.** Surfacing tags.brainstorm.world's *real* tags on staging needs the router to federate that content onto the relay staging reads — outside this code story (story Open Q2). The code is correct and verified against available content; the full user-facing outcome depends on that router/ops step.

## Verdict

**PASS** — all nine ACs implemented per the (operator-revised) ADR with reviewer-verified passing coverage (13/0 + live opt-in toggle), no regression (default is byte-for-byte today's local-only reads), the dev-env topology kept out of structural code, and the only full-gate red is pre-existing flake in suites this diff does not touch. Half 1 of the dual-z model is complete and additive with Half 2.
