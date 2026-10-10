# Review: Story 2 — A stream's Limit refetches recent events whenever it connects

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-09
**Diff:** `git diff 2bc29837..458b2607` (impl, commit `458b2607`) plus test commit `8d77e6f4`. The
merge `2bc29837` (story 1 + PR #787) is context only and was not reviewed here, except where
story 2 interacts with it.
**Story:** `engineering-team/stories/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0002-honor-stream-limit-on-connect.md` (Accepted)
**Test plan:** `engineering-team/stories/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`: **PASS**. `npm run gate:status -- --label rsg2-review`:
      `20261009T043710Z-1434-7dcc [rsg2-review] started 2026-10-09T04:37:10.084Z on 458b2607+dirty — PASS, exit 0, 5212 passed, 0 failed, 581 skipped, 279/279 suites`.
      `+dirty` is only the worktree's untracked `node_modules` symlink (`git status --short` shows
      nothing else). The totals match the Implementer's run `20261009T043109Z-4057-cc1e`.
- [x] Suites, from that run's record: `router-stream-limit-on-connect` 26/0/0 (also run
      standalone: 26 passed). `router-stream-tag-filters` 21/0/0, with S3 re-aimed.
      `router-config-reload-in-place` 33/0/0, `strfry-router-saved-state` 32/0/0,
      `strfry-router-value-hardening` 14/0/0, `strfry-router-owner-gate` 10/0/0,
      `treasure-maps-router-preset` 5/0/0, `strfry-router-first-boot-config` 3/0/0.
- [x] `cd ui && npm run build`: exit 0 (vite, built in 40.9 s; only the usual chunk-size
      warning). The bundle carries "fetched on connect" and the upload-only hint.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations).
- [ ] `npm run test:playwright`: not applicable. The UI change is wording plus a default, pinned
      at source level, and there is no stack in this session.
- [ ] _Lint not configured; skipped._ _Typecheck not configured; skipped._ _Build: no server build step._

### Patch script, checked against the real strfry 1.1.0 source

All runs were on copies of the pristine clone (`strfry-git`, tag `1.1.0`, `f31a1b9`). The pristine
tree was not touched.

- **Correct.** One line changes, `cmd_router.cpp:164`, 16-space indent kept:
  `filterToSend["limit"] = 0;` → `if (!filterToSend.find("limit")) filterToSend["limit"] = 0;`.
  `git diff` shows only that line.
- **The same bytes that were built and run.** The patched file's md5 is `833b9e4f…`, identical to
  the `cmd_router.cpp` in the ADR's `strfry-build` tree. That tree's `cmd_router.o` postdates the
  edit, and `make` ended with EXIT 0 (`strfry --version` → `strfry 1.1.0`). So the ADR's Verified
  evidence (items 1–4) applies to exactly what this script produces.
- **The C++ resolves as intended.** In the vendored taocpp/json, `find(Key&&)` is the object-key
  overload, which returns `nullptr` when absent. `pointer`'s string constructor is `explicit`
  (`pointer.hpp:212`), so `find("limit")` can't bind to the JSON-pointer overload.
- **Idempotent.** A second run prints "(skipping)", exits 0 and leaves the file byte-identical.
- **Fails loudly.** On drift (the bare line altered) it exits 1 with `ERROR: … Upstream may have
  changed.` on stderr. With `cmd_router.cpp` missing it exits 2 from `sed` under `set -e`, which
  is the Redis script's convention. With no `$1` it defaults to cwd.
- **Safe under `set -e`.** Every `grep` sits in an `if` condition. The post-sed check anchors the
  bare-line test (`^ *filterToSend…`), so the patched line, which contains the bare text as a
  substring, doesn't trip it.
- **Fixture.** `connOpen` in `test/fixtures/strfry-1.1.0-router-connOpen/…/cmd_router.cpp` is
  byte-identical to upstream 1.1.0's block. The test plan noted it hadn't been re-fetched; this
  closes that.

### Dockerfile wiring

- `COPY patches/strfry-router/ /tmp/strfry-router-patches/` sits directly after the Redis `COPY`
  and before `ARG STRFRY_REF` and the build `RUN`.
- `&& bash /tmp/strfry-router-patches/apply-patches.sh /usr/local/src/strfry` comes after the
  Redis apply and before `make setup-golpe`. It is in the same `&&` chain, so a non-zero exit
  fails the build.
- The `STRFRY_REF` comment names both patch directories. `.dockerignore` doesn't exclude
  `patches/`.
- No other image path builds strfry. `nostr-search/Dockerfile` doesn't, and the legacy bare-metal
  `setup/install-strfry.sh` applies neither patch set, as before.

## Spec adherence

- [x] **AC-1** (the limit is fetched on connect):
  - Script-level: P1, plus D1–D3, S3 and F2.
  - strfry-level: ADR § Verified evidence item 1 (5 of 12 fetched, the newest 5, within 3 s).
  - Live staging check: V1, post-deploy (see below).
- [x] **AC-2** (deploy holes close): presets at 500 (S1, S3). The live check, V2, is post-deploy.
  It depends on the operator first raising staging's saved limits (decision 2), which V1 sequences.
- [x] **AC-3** (live delivery unchanged):
  - P1 pins every other byte of `connOpen`.
  - `up` streams never reach that branch (`cmd_router.cpp:162`).
  - Duplicates: strfry's writer drops them, and the Redis push fires only on
    `EventWriteStatus::Written` (the `WriterPipeline.h` patch), so nothing reaches Redis twice.
  - Live: ADR evidence items 3–4 (`added: 7 dups: 7`).
- [x] **AC-4** (the editor says what it does): U1–U7 and S1. The wording matches the ADR verbatim.
  Blank or 0 shows as " (live only: nothing fetched on connect)" on the card and in the hint.
- [x] **AC-5** (no surprise floods): an absent limit sends 0 (P1), the sanitizer adds no default
  (F5), and ADR evidence item 2 shows 0 kind-7 events. A blank editor field saves `limit: 0`
  (`parseInt(...) || 0`), which the patch sends as 0: live only.
- [x] No criterion silently dropped. AC-1 and AC-2 live checks are recorded below as post-deploy
  verification. They are not a blocker: the strfry-level behavior is covered by the ADR's
  Verified evidence, and the shipped script reproduces those exact bytes (above).
- [x] No behavior added beyond the story. The impl diff touches exactly the seven files in the
  ADR's Implementation notes and nothing under `test/`.

**Saved-state edge cases checked:**
- **Limit 0:** sent as 0, live only, as today.
- **Large limit:** sent as-is.
  - strfry relays clamp it to `maxFilterLimit` (500, `strfry.conf:111`; `filters.h:208`).
  - A relay that answers `CLOSED` is logged as `Unexpected message:` (LW, `cmd_router.cpp:394`),
    so the operator can see it. The ADR covers this.
  - Values that JSON prints beyond uint64 already failed config parsing before this change; that
    is unchanged.
- **`up` streams:** no REQ is sent, so the limit is unused. That matches the "Not used" hint, and
  the `trustedAssertions` preset at 500 is harmless.

**Post-deploy verification (operator, staging):** the test plan's V1 (raise `WoT`, the tag streams
and `tagDeletions` to 500, then expect `Connected` followed by `Writer: added` within 10 s; first
confirm the image carries the patch with the plan's `grep`), V2 (minute-by-minute comparison across
the next deploy), and the AC-5 spot check.

## ADR adherence

- [x] Files changed match the Implementation notes: script, Dockerfile, sanitizer (limit only:
  `Number.isInteger(val) && (key !== 'limit' || val >= 0)`), presets, editor and card, OPERATIONS.md
  and BIBLE §14.
- [x] Layering is respected. The fix lives in the strfry patch set; Node changes only ingress and
  copy.
- [x] No new dependencies. No new tooling; the script uses bash, sed and grep, like the Redis one.

## Concept-graph integrity

- [x] No concepts touched. No handles, no firmware reinstall (ADR: "Firmware reinstall required? No").
- [x] N/A: no new code reads domain concepts.

## Things tests can't catch

- [x] No secrets. No debug logging (the script's `echo` lines are build output). No commented-out
  code. `git diff --check` is clean.
- [x] Error paths: covered under "Patch script" above.
- [x] Concurrency: the patch runs at image build time. At runtime, the refetch rides strfry's
  existing writer and dedup path.
- [x] Input validation: negative limits are dropped at ingress (F1). See finding 1 for the
  rationale.

## House rules check

- [x] Concept Graph API authority respected (N/A).
- [x] No new lint, typecheck or build tooling. The image build already patched strfry; this adds a
  second patch directory.
- [x] No TA pubkey literals; `LEGACY_*` constants untouched.

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/strfry/routerConfig.js:62–64` and ADR 0002 line 128: the stated reason for dropping
   a negative limit is wrong.**
   - The comment and the ADR's "a negative limit becomes meaningful, where it was harmless before"
     both assume a negative limit used to be harmless.
   - In fact strfry 1.1.0 already rejects the **whole router config** on a negative limit:
     `configure()` compiles the filter (`cmd_router.cpp:100`), and `jsonGetUnsigned` throws
     (`filters.h:200`).
   - Verified on the ADR's built binary: a config with `"limit":-1` exits 1 with `Failed to parse
     router config: error parsing limit`. The same config with `"limit":5` loads and connects.
   - So the patch can never send a negative limit upstream. Dropping it is still right, and for a
     stronger reason.
   - Corollary: negative `since`/`until`, which are still kept (F3 pins that), fail the config the
     same way (`filters.h:196,198`). OPEN.md row 31(b) understates that.
   - Optional: correct the comment's reason, and add this evidence to row 31(b).
2. **`setup/router-presets.json:6,19`: at 500, the unfiltered `dcosl` and `dcosl2` presets
   refetch junk.**
   - Both are kinds-only `[9998, 9999, 39998, 39999]` streams. Per OPEN.md row 25, the newest
     events of those kinds on the dcosl relays are almost all junk.
   - At 500, enabling either preset pulls up to 500 such events per relay on every connect.
   - `dcosl` is `both`, so whatever is new locally is then re-sent upstream. `outgoingEvent`
     (`cmd_router.cpp:194–216`, called for every stream from `handleDBChange`) sends it to every
     connection of every `up`/`both` stream whose filter matches, the source relay included. The
     ADR's "the stream's other relays" understates the fan-out; its "same as live events, bounded
     by N" still holds.
   - Why this isn't blocking: it is bounded, the presets are default-off, the epic records the
     unfiltered `dcosl` download as off by design, and decision 1 set every preset to 500.
   - Neither the story nor the ADR names this interaction. Optional: note it on OPEN.md row 25.
     That row's plan also says "keep limit:5" for the scoped dcosl stream, which now means 5
     refetched per connect.
3. **`docs/TAG_FEDERATION_OPS.md:119,125`: the runbook is now stale.**
   - The `tagDeletions` recipe still says `"limit": 5`.
   - "A router stream carries only what's published while both ends are connected" is no longer
     true for a stream with a limit.
   - The test plan's V1 raises `tagDeletions` to 500, so the runbook should match.
   - It isn't in the ADR's doc list. The same bullet's "every router config change restarts it" is
     story 1's (round 2 in progress), so coordinate the edit.
   - Optional: an OPEN.md row, or fold it into row 25's runbook correction.
4. **`ui/src/pages/settings/RelaySettings.jsx:161`: a blank Limit field shows a grey "500"
   placeholder**, while blank means live only.
   - Someone skimming could read the grey 500 as the value that applies.
   - The ADR mandates the placeholder, and the hint directly below says "Blank or 0 = live only",
     so AC-4 is met.
   - Optional, for a later UX pass: no placeholder, or a "0" placeholder.
5. **`BIBLE.md:1155`: the Limit sentence is broader than the behavior.** It says "A stream's Limit
   is how many … it refetches on every connect", but upload-only streams refetch nothing. Optional:
   add "(download and both-direction streams)". The rest of the sentence is accurate: upstream
   overrides the limit with 0, and the image's patch honors it.

### Harness friction

1. Recurrence of OPEN.md row 316. Role and workflow 5 say the Reviewer commits the review; this
   brief reserved the commit. I followed the brief: the review and the status flip are uncommitted.
2. Recurrence of OPEN.md row 310. `node test/router-stream-tag-filters.test.js` (likewise
   `treasure-maps-router-preset` and `strfry-router-first-boot-config`) prints nothing and exits 0,
   because those suites have no `require.main` runner. I took their results from the gate record
   instead.

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place, and this review linked in its Linked
      artifacts. Left uncommitted, per the brief.
- [x] Completion detection performed; the result is reported in the hand-off, not here.
