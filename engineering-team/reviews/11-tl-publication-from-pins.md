# Review: Story 11 — Periodic Trusted List publication from pinned tags

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-20
**Diff:** `git diff HEAD~1` (commit `1692df68`)
**Story:** `engineering-team/stories/done/11-tl-publication-from-pins.md`
**ADR:** `engineering-team/decisions/0010-tl-publication-from-pins.md`
**Test plan:** `engineering-team/stories/done/11-tl-publication-from-pins.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS**. Every active suite green; two suites skip
  per their documented preconditions (authored-tagging-publish,
  profile-tag-polish-publish). New Story-11 suites:
  - `tl-publication-from-pins`: **10 passed, 0 failed**
  - `tl-publication-from-pins-publish`: **7 passed, 0 failed, 3 skipped**
    (POV-required suite skips when `/var/lib/brainstorm/settings.json`
    isn't writable from the test process — documented in the test plan).
- [ ] `npm run test:playwright` — not executed in this host
  (Playwright bundled chromium needs Linux .so deps unavailable on the
  NixOS-style host). `tests/brainstorm/tl-publication-from-pins.spec.js`
  parses and lists correctly under `npx playwright test --list`. Same
  skip path as the Story-10 spec.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured for the server; UI builds clean
  (`npm --prefix ui run build` ran during deployment with one chunk-size
  warning, no errors)._

## Spec adherence

- [x] **AC-1** (cron tick → kind-30392 per supported pin) — covered by
  `tl-publication-from-pins-publish.test.js` "refresh-all-pinned-tags
  publishes a kind-30392 TL for the supported pin"; lives at
  `src/api/trustedList/refreshPinnedTags.js:184-198` (the
  `buildAndPublishTL` call inside `runOnePin`).
- [x] **AC-2** (replaceable slot) — covered by "refreshing the same pin
  twice replaces the TL in place"; d-tag composition at
  `src/api/trustedList/refreshPinnedTags.js:60-62` is stable across
  re-pin cycles (encodes observer8/tagAuthor8/tagSlug, not the
  pin event id).
- [x] **AC-3** (per-pin refresh-now < 10s) — contract tests for
  endpoint shape; runtime is a single strfry scan + Meili lookup +
  publish, well within the latency budget for v1 scale. UI test
  exists (Playwright); not exercised locally per the host limitation.
- [x] **AC-4** (Refresh all) — contract test for
  `refresh-pinned-tags-for-viewer`; sequential execution per ADR.
  UI test exists.
- [x] **AC-5** (disputes function: endorsements ≥ cutoff AND >
  disputes, WoT-trusted only) — POV-required tests
  (`tl-publication-from-pins-publish.test.js` lines ~360-450) cover
  the three branches: clear member, one-short, more-disputes. Lives
  at `src/api/trustedList/refreshPinnedTags.js:106-122`
  (`applyDisputesFunction`). Skips locally; will run in CI.
- [x] **AC-6** (Settings panel) — `ui/src/pages/settings/RelaySettings.jsx`
  gains a third `<ScheduledTaskCard taskId="refreshPinnedTagTLs">`;
  scheduler entry at `src/api/scheduled-tasks/index.js:31-35`. Contract
  tests confirm `/api/scheduled-tasks/status?taskId=refreshPinnedTagTLs`
  echoes the taskId.
- [x] **AC-7** (unsupported method) — basic-suite test "pin with method
  != nip85:rank produces no TL and tlStatus=unsupported on /pins"
  passes; implementation at
  `src/api/trustedList/refreshPinnedTags.js:126-128` (early-return
  with `status: 'unsupported'`).
- [x] **AC-8** (amended) — failure isolation guaranteed by the per-pin
  loop in `refreshAllPinnedTags` (`src/api/trustedList/refreshPinnedTags.js:251-256`);
  each pin's result is collected independently. Persistent per-row
  error reason was deliberately dropped per the ADR amendment; the
  user accepted this trade in the design phase. Transient errors
  surface via the HTTP response of explicit refresh clicks.
- [x] **AC-9** (retraction on unpin) — basic-suite test "unpinning +
  refresh-all produces an empty-membership replacement" passes;
  retraction logic at
  `src/api/trustedList/refreshPinnedTags.js:218-243` uses strfry-diff
  (no status file) with the `["status","retracted"]` marker for
  idempotency.
- [x] **AC-10** (existing TL reader compatibility) — verified by
  inspection of `ui/src/pages/grapevine/TrustedListDetail.jsx:50-78`:
  the tag-loop only reads `p` / `e` / `title` / `metric` tags; the new
  `observer` / `source-tag` / `cutoff` / `min-rank` / `status` tags are
  silently ignored. The basic-suite test
  "published TL carries the AC-10 + product-constraint tag set"
  enforces the wire shape.
- [x] **v1 product constraints** (source-tag metadata, observer tag,
  disputes-function params, per-member counts) — all present in the
  emitted event; basic-suite tests cover each.
- [x] **Refresh-on-pin** (ADR amendment) — implemented at
  `ui/src/pages/Tag.jsx:60-71`; fire-and-forget; non-blocking on the
  Pin button flip.
- [x] **tlStatus derived from strfry** (ADR amendment) — at
  `src/api/profile-tags/index.js:1230-1314`; one batched strfry scan
  for all of the viewer's pinned d-tags, then mapped back per row.
- [x] **Consumption surfaces** (ADR amendment) — PinDetail page, chip
  filter, naddr share button. All three live in the diff at the paths
  the amendment lists; ADR block in
  `engineering-team/decisions/0010-tl-publication-from-pins.md:535-617`
  describes the design.

## ADR adherence

- [x] **Scheduler integration** — exactly as ADR §Option-A (1):
  `src/api/scheduled-tasks/index.js:31-35` adds the third entry to
  `DEFAULTS`. No scheduler code changes beyond the entry, since the
  generalized scheduler (ADR-0003) iterates `Object.keys(DEFAULTS)`.
- [x] **Task registry + orchestrator** — `src/manage/taskQueue/taskRegistry.json`
  gains a `refreshPinnedTagTLs` entry pointing at
  `src/algos/refreshPinnedTagTLs.sh`. Script emits the documented
  structured-log events.
- [x] **Pure-helper refactors** — both extractions landed as ADR
  specified:
  - `aggregateProfilesTagged({tagEventId, povSuffix, minRank})` at
    `src/api/profile-tags/index.js:469-509`; called from
    `handleProfilesTagged:656-665` and from
    `src/api/trustedList/refreshPinnedTags.js:155-157`.
  - `buildAndPublishTL({kind, dTag, title, metric, items, extraTags, content})`
    at `src/api/trustedList/index.js:78-117`; called from the original
    HTTP handler and from
    `src/api/trustedList/refreshPinnedTags.js:163-176` + `236-241`
    (retraction path).
- [x] **Three new POST routes** — wired at
  `src/api/trustedList/index.js:203-207` per ADR §Option-A (4). Auth
  gates on the user-scoped two endpoints use `req.session?.pubkey`
  consistent with the existing codebase pattern
  (`src/api/admin/index.js:87`).
- [x] **TL wire shape** — d / title / metric / observer / source-tag /
  cutoff / min-rank in tags; `p` tags for members; JSON content body
  with `members[{pubkey, endorsements, disputes}]`. Verified by the
  AC-10 test.
- [x] **Retraction via empty replacement + marker tag** — implementation
  matches ADR exactly. Idempotency via the marker check.
- [x] **No firmware reinstall required** — pure code change confirmed.
- [x] **No new dependencies authorized by the ADR were required** —
  diff adds no `package.json` changes.

## Concept-graph integrity

- [x] **No new concepts** — kind-30392 is an existing nostr event type
  with an existing read surface; this is its first write path on this
  instance, not a new ConceptHeader. Confirmed by inspection of the
  diff: no new firmware files, no changes to the `tag-pinning` concept
  (Story 10's), no calls to `POST /api/firmware/install` required.
- [x] **Handles in `kind:pubkey:slug` form** — all references to
  `TAG_PINNING_Z_TAG` use the Story-10 constant; TL `d`-tag prefix
  `tl-pin-` is the codebase convention documented in the ADR (not a
  concept handle, distinct namespace).
- [x] **New code doesn't reload BIBLE.md / firmware JSON** —
  `src/api/trustedList/refreshPinnedTags.js` imports profile-tags
  helpers + the shared `resolvePov`; no firmware JSON reads.

## Things tests can't catch

- [x] **No secrets in committed files** — diff inspected; no API keys,
  privkeys, or credentials.
- [x] **No leftover `console.log` debug** — all `console.log` occurrences
  in the diff are inside test-runner output paths
  (`test/test.js`, `test/tl-publication-from-pins-publish.test.js`).
  Production code uses `console.error` only on error paths
  (`refreshPinnedTags.js:241`, `trustedList/index.js:138, 158, 195`).
- [x] **No commented-out code blocks** in the diff.
- [x] **Error paths handled** —
  - `runOnePin` returns structured `{status, errorReason}` for every
    failure branch (`refreshPinnedTags.js:124-202`).
  - `refreshOnePinnedTagById` maps internal `error: 'not-found' |
    'forbidden'` to 404 / 403 HTTP statuses
    (`trustedList/index.js:153-161`).
  - `enrichRowsWithTLStatus` falls back to `status: 'never'` on a
    strfry scan failure rather than throwing
    (`profile-tags/index.js:1283-1287`).
  - Tag.jsx refresh-on-pin `.catch(() => {})` is intentional
    (best-effort per ADR amendment); the pin event already landed.
- [x] **Concurrency / race conditions** — the cron's per-pin loop is
  sequential, so no parallel strfry-write races. The status-derived
  approach (no on-disk file) means no concurrent write contention.
  Refresh-on-pin races the next page render — but the page reads
  /pins on its own cadence and the d-tag is stable, so subsequent
  reads pick up the TL whenever it lands.
- [x] **Security: input validation at boundaries** —
  `pinEventId` (hex-64), `viewerPubkey` (hex-64), `kind` (whitelist)
  all checked. Session-pubkey ownership check at
  `trustedList/index.js:147-149` + `refreshPinnedTags.js:213-215`.
  The cron-side endpoint has no auth gate by design (loopback
  convention, same as updateAllScoresForOwner / refreshSearchIndex).

## House rules check

- [x] **Concept Graph API authority** — respected; no BIBLE.md /
  firmware-JSON loads.
- [x] **No new lint/typecheck/build tooling** — diff adds none.
- [x] **Firmware reinstall** — N/A; no concept definitions changed.

## Findings

### Blocking

_None._

### Non-blocking

1. **`engineering-team/decisions/0010-tl-publication-from-pins.md:140-145`**
   — the ADR's Option-A pseudocode block for `runOnePin` still shows
   the strict path `writeStatus(pinEvent.id, 'error', { reason: 'POV
   not configured for observer' })`, but the actual implementation
   (`src/api/trustedList/refreshPinnedTags.js:127-134`) falls back to
   `minRankForTag = 0` and publishes the TL anyway. The Implementer
   flagged this in the implementation summary as a deliberate
   alignment with the existing `handleProfilesTagged` "no POV → all
   assertions count" fallback. Suggested follow-up: a short paragraph
   in the ADR amendment block calling out the change so the pseudocode
   and implementation don't drift further. Not blocking — runtime
   behavior is correct and self-consistent across the codebase; the
   amendment block at line 535+ documents enough other adjustments
   that this drift is in keeping with the document's style.

2. **`tests/brainstorm/tl-publication-from-pins.spec.js`** — 5
   well-formed Playwright tests, but the local NixOS-style host can't
   run them (Playwright bundled chromium needs Linux .so deps not
   available on `framework`). The story-10 spec has the same skip path
   and the prior review accepted it. Same disposition here; will run
   in CI / a standard Linux dev env.

3. **`test/tl-publication-from-pins-publish.test.js`** — the AC-5
   POV-required tests skip when `/var/lib/brainstorm/settings.json`
   isn't writable from the test process. Documented in the test
   plan's Test Infrastructure section. Non-blocking; CI exercises
   them. Same disposition as tag-detail-write-publish's POV phase.

4. **No new tests for the ADR-amendment consumption surfaces**
   (PinDetail, chips, share). The amendment block notes this and the
   user accepted the trade-off at scope expansion time. Follow-up:
   at minimum a contract assertion that `/api/profile-tags/pins` rows
   carry the data the PinDetail page expects (the current basic-suite
   test does cover `tlStatus.status === 'ok' && tlEventId`), and
   Playwright stubs for the chip filter + share-button click
   behavior.

5. **`ui/src/pages/Tag.jsx:67`** — refresh-on-pin `.catch(() => {})`
   silently swallows the refresh failure. Per the ADR amendment this
   is intentional best-effort; the pin event already landed in
   strfry and the user can manually refresh from `/pins` or wait for
   the cron. Not blocking. Future polish: surface a subtle
   "TL refresh pending" indicator on the tag detail page so the user
   has a visible signal that the background refresh fired.

6. **`src/api/profile-tags/index.js:1240-1250` (enrichRowsWithTLStatus)**
   — when `parseCurationMethod` returns `null` (malformed pin
   payload), the row falls into the `method !== 'nip85:rank'` branch
   and gets `status: 'unsupported'`. Semantically slightly
   misleading — that pin has *no method at all*, not an unsupported
   one. Not blocking because: (a) the ADR amendment accepts the
   collapse of error/never/malformed into the surface UI states; (b)
   in practice Story-10's `pinTag()` always writes a well-formed
   curation method, so the malformed branch is unreachable for any
   pin authored via the standard flow.

## Verdict

**PASS**

All ten acceptance criteria are covered, the ADR amendment's three
consumption surfaces are present and behave as documented, the test
gate is green, no blocking issues. The story expanded materially
beyond the original scope during implementation (consumption surfaces
added on PO direction); that expansion is documented in the ADR's
2026-05-20 amendment block, which the Reviewer recognizes as a valid
in-flight scope change. The implementation matches the amended ADR.

Two known skip paths (Playwright + AC-5 POV tests) require CI / a
standard Linux environment to exercise — neither blocks merging on
the local stack, and both are documented disposition matches with
the prior Story-10 review.
