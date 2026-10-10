# Test Plan: Story 2 — A stream's Limit refetches recent events whenever it connects

**Story:** `engineering-team/stories/relay-stream-gaps/2-stream-limit-refetches-on-reconnect.md`
**ADR:** `engineering-team/decisions/relay-stream-gaps/0002-honor-stream-limit-on-connect.md`
**Date:** 2026-10-09

All new tests are in one stack-free suite, `test/router-stream-limit-on-connect.test.js`
(26 tests: 19 fail now, 7 guards pass before and after). It is registered in `test/registry.js`
right after `router-config-reload-in-place`. One fixture is new:
`test/fixtures/strfry-1.1.0-router-connOpen/src/apps/mesh/cmd_router.cpp`.

One existing test is re-aimed: **S3 in `test/router-stream-tag-filters.test.js`**. It found the
Limit block with `editor.indexOf('>Limit<')`. Any form of the ADR's new label
(`Limit (fetched on connect)`, or `Limit <span>(fetched on connect)</span>`) removes that exact
string, so S3 would fail with "Event Kinds / Limit blocks vanished". It now uses
`editor.search(/>\s*Limit\b/)`, which matches the old and the new label. S3 passes before and
after. R2 and R3 in that suite need no change: R2 uses its own `limit: 5` stream, not the
presets, and R3 only forbids tag keys in presets.

## Coverage map

Levels: **script** = the real shell script run with `bash` against a temp copy of the fixture
tree; **unit** = a pure function executed via `require`; **composition** = presets through
`generateConfig`; **source** = a source-text sentinel (Dockerfile, JSX, docs; the house style,
since there is no JSX transpile here); **manual** = a post-deploy check, not part of `npm test`.

| Criterion | Test (abridged; full names in the suite) | Test file | Level |
|---|---|---|---|
| AC-1 | P1: on strfry 1.1.0's `connOpen`, the patch exits 0 and turns the one `filterToSend["limit"] = 0;` line into `if (!filterToSend.find("limit")) filterToSend["limit"] = 0;`, 16-space indent kept, every other byte unchanged; no bare line remains | `test/router-stream-limit-on-connect.test.js` | script |
| AC-1 | D1: the Dockerfile `COPY`s `patches/strfry-router/` before the strfry build `RUN` | same | source |
| AC-1 | D2: the strfry `RUN` chain runs `&& bash <copied dir>/apply-patches.sh /usr/local/src/strfry` after the Redis patches and before `make` | same | source |
| AC-1, AC-2 | S3: every preset, enabled, reaches the router config with `"limit":500` in its filter line next to its kinds | same | composition |
| AC-1, AC-5 | F2 (guard): `sanitizeStreamFilter` keeps limit 0, 5, 500 and 5000 unchanged, key order included; no upper clamp (the relay caps) | same | unit |
| AC-1 (live) | V1: raising a stream's limit refetches at once (manual, below) | — | manual |
| AC-2 | S1: every preset ships `filter.limit` 500, `treasureMaps` included (the busy streams' default) | same | source |
| AC-2 (live) | V2: the minute-by-minute comparison across a staging deploy shows no missing events (manual, below) | — | manual |
| AC-3 | P1: the rest of `connOpen` is byte-identical, so the live subscription and the up direction are untouched | same | script |
| AC-3 | F6 (guard): `generateConfig` emits the same bytes before and after sanitization for limits 0, 5, 500 and none, and writes `"limit":500` inline | same | unit |
| AC-3 (live) | Live delivery, upload unchanged, nothing stored twice: ADR § Verified evidence 3–4 (real strfry 1.1.0 build) and V1 | — | manual |
| AC-4 | S1, U1, U2: `const DEFAULT_STREAM_LIMIT = 500;` at module scope; `emptyStream()` uses `limit: DEFAULT_STREAM_LIMIT`, not 5; presets at 500 | same | source |
| AC-4 | U3: the Limit field's label reads "Limit (fetched on connect)"; its placeholder comes from `DEFAULT_STREAM_LIMIT`, not `"5"` | same | source |
| AC-4, AC-5 | U4: the download hint, the four ADR sentences ("Each time this stream connects, …", "Downloads only.", "Blank or 0 = live only (nothing fetched on connect).", "strfry relays send at most 500.") | same | source |
| AC-4 | U5: on `form.dir === 'up'` the hint is "Not used: upload-only streams send new local events as they arrive." | same | source |
| AC-4, AC-5 | U6: the card's Filter line shows ` (fetches up to ${…limit} on connect)` and ` (live only: nothing fetched on connect)`, checks `stream.dir` against `'up'`; `(limit: ` is gone from the file | same | source |
| AC-4 | U7 (guard): the card's Filter line keeps its existing show-condition | same | source |
| AC-5 | P1: the patched line keeps `filterToSend["limit"] = 0` when the filter has no limit | same | script |
| AC-5 | F5 (guard): a filter with no limit stays without one after sanitizing (no default injected), and its config line has no limit | same | unit |
| AC-5 | F1: a negative limit is dropped at ingress, other keys kept in order; the config then has no limit (live only) | same | unit |
| ADR § Consequences (fail loud) | P2: a second run is a no-op that exits 0; the check appears once | same | script |
| ADR § Consequences (fail loud) | P3: a tree whose `connOpen` lacks the bare line → non-zero exit and an `ERROR…` line on stderr | same | script |
| ADR § Consequences (fail loud) | P4: a tree without `src/apps/mesh/cmd_router.cpp` → non-zero exit | same | script |
| ADR § Implementation notes | P5: the script's header names strfry 1.1.0 and ADR relay-stream-gaps/0002 | same | source |
| ADR § Implementation notes | D3: the comment above `ARG STRFRY_REF` names `patches/strfry-redis/` and `patches/strfry-router/` | same | source |
| ADR scope | S2 (guard): presets keep names, order, directions and kinds; filters are kinds + limit only, no tag keys (R3's guardrail) | same | source |
| ADR scope | F3 (guard): `since`/`until` unchanged: any integer kept (negatives and 0 included), non-integers dropped | same | unit |
| ADR scope | F4 (guard): a non-integer limit (1.5, "500", null, NaN, Infinity, true) is still dropped | same | unit |
| ADR § Implementation notes (OPERATIONS.md) | O1: "What a deploy does" drops "brings nothing published upstream while it was down" and mentions refetch, newest, Limit, blank or 0, live only, negentropy sync | same | source |
| ADR § Implementation notes (BIBLE §14) | B1: the "Presets are opt-in cross-instance mirroring" paragraph mentions Limit, (re)fetch, connect, newest, patched, upstream, blank or 0, live only | same | source |
| AC-4 (label change) | S3 (re-aimed): the Tag Filters block still sits between Event Kinds and Limit | `test/router-stream-tag-filters.test.js` | source |

### Live verification (manual; not `npm test`)

AC-1 and AC-2 need a running router and real upstream relays. The strfry side of the change was
built and run against a real strfry 1.1.0 in the ADR's § Verified evidence: the limit was honored
on connect (item 1), a stream with no limit stayed live only (2), live delivery was unchanged (3),
and raising the limit refetched with `Writer: added: 7 dups: 7`, so nothing was stored twice (4).
After the deploy that ships this, the ADR's "Verification after deploy" steps are the acceptance
checks:

- **V1 (AC-1, AC-3).** In the editor, raise staging's busy download streams (`WoT`, the tag
  streams, `tagDeletions`) to 500. Under ADR 0001 each raise reconnects that stream, which
  refetches at once. Within 10 s,
  `docker exec tapestry tail -n 40 /var/log/supervisor/strfry-router-error.log` should show
  `<stream>: Connected to …` followed by `Writer: added: N dups: M` lines. Before relying on it,
  confirm the image carries the patch:
  `docker exec tapestry grep -n 'filterToSend.find("limit")' /usr/local/src/strfry/src/apps/mesh/cmd_router.cpp`.
- **V2 (AC-2).** On the next staging deploy, re-run the 2026-10-09 minute-by-minute comparison
  (`wot.grapevine.network` kinds 0/3/1984/10000 against staging) across the deploy minute.
  Expect no missing events for the raised streams.
- **AC-5 spot check.** A stream with a blank or 0 limit logs no `Writer: added` burst on reconnect.

## Edge cases

- [x] Limit 0, set explicitly: kept (F2); the patch sends it as is, so the stream stays live only.
- [x] No limit: stays absent through sanitizing and config (F5); the patch sends 0 (P1).
- [x] Negative limit: dropped at ingress (F1). Non-integer limit: dropped (F4).
- [x] A limit above the relay's maximum (5000): kept, not clamped (F2). The relay caps it.
- [x] Upload-only streams: the editor hint says "Not used…" (U5); the card shows no limit wording
  (U6). The upload-only preset `trustedAssertions` also moves to 500 (S1). This is harmless,
  because the router never REQs for `up`.
- [x] Patch script: run twice (P2); upstream changed (P3); target file missing (P4); run from an
  unrelated cwd with the strfry dir as `$1` (every P test).
- [x] Saved streams aren't migrated (product decision 2). Nothing in this suite reads or writes
  `router-state.json`, and the ADR adds no migration.
- [ ] A hand-edited state file with a negative limit bypasses ingress and still reaches strfry via
  `initRouter`/toggle/Restore Defaults. This is out of scope: the ADR sanitizes at the client-JSON
  ingress only, and `router-stream-tag-filters` S5 pins that those paths don't sanitize.
- [ ] A relay that rejects a high limit outright can't be tested stack-free. The operator lowers
  that stream's limit (ADR § Consequences).
- [ ] Concept Graph API unavailable / concept handle not found: not applicable, no concepts change.

## Choices the ADR left open (the Implementer should know)

1. **Script interface.** `patches/strfry-router/apply-patches.sh` is run as
   `bash <script> <strfry-dir>` from an unrelated working directory, so it must read the tree
   from `$1` (the ADR's `STRFRY_DIR="${1:-.}"`), not from cwd. It needs GNU `sed -i` (no suffix),
   like the Redis script.
2. **Exactly one line changes.** P1 compares the whole patched file with the original plus the
   one-line replacement. Don't add a marker comment to `cmd_router.cpp`.
3. **Anchor the "no bare line remains" check.** The patched line contains
   `filterToSend["limit"] = 0;` as a substring, so an unanchored `grep` fails the build on a good
   tree. Use `^ *filterToSend\["limit"\] = 0;`. A mutation check confirmed P1 and P2 catch this.
4. **Messages.** P3 needs a stderr line that starts with `ERROR` (e.g.
   `ERROR: … upstream may have changed`). The re-run's "(skipping)" message isn't pinned; P2 checks
   only exit 0 and a byte-identical file.
5. **Script header.** It must contain `strfry 1.1.0` and `relay-stream-gaps/0002` (P5).
6. **Dockerfile.** The COPY destination is your choice. The strfry `RUN` must then call
   `bash <that dir>/apply-patches.sh /usr/local/src/strfry`, chained with `&&`, after the Redis
   `apply-patches.sh` and before the first `make` (D2). The comment lines directly above
   `ARG STRFRY_REF` must contain `patches/strfry-router` and keep `patches/strfry-redis` (D3).
7. **Presets.** S2 pins names, their order, directions and kinds, and allows only `kinds` and
   `limit` in each filter. Key order inside a filter is free (S3 parses the JSON).
8. **Sanitizer.** The `>= 0` rule is for `limit` only. F3 pins that negative `since`/`until` are
   still kept. Don't clamp large limits (F2), and don't add a default when the limit is missing
   (F5).
9. **UI wording is matched on visible text.** JSX tags are removed, `{' '}` counts as a space and
   whitespace is collapsed, so `Limit <span>(fetched on connect)</span>`, line breaks and inline
   `<strong>` all pass. The words and punctuation must match the ADR exactly, including the literal
   `500` in "strfry relays send at most 500." (strfry's cap, not `DEFAULT_STREAM_LIMIT`). Both hints
   must be inside `StreamEditor`, and the upload-only hint must come after a
   `form.dir === 'up'` check (written with `===`).
10. **Placeholder and default.** The Limit input's placeholder must be an expression using
    `DEFAULT_STREAM_LIMIT` (e.g. `placeholder={String(DEFAULT_STREAM_LIMIT)}`). `emptyStream()` must
    use the identifier: `limit: DEFAULT_STREAM_LIMIT`.
11. **Card summary location.** It stays inline on RouterStatus's `Filter:` line, between `Filter:`
    and that div's closing `</div>`, as at `:626`. That span must contain
    `(fetches up to ${…limit…} on connect)` (template literal or JSX `{…}`), the literal
    `(live only: nothing fetched on connect)`, and a `stream.dir` comparison with `'up'`. A helper
    defined outside RouterStatus wouldn't be seen. The text `(limit: ` must not appear anywhere in
    RelaySettings.jsx. Keep the show-condition exactly as it is (U7).
12. **Docs.** O1 reads the `**What a deploy does.**` paragraph up to the next blank line. B1 reads
    BIBLE §14 from `#### Presets are opt-in cross-instance mirroring` up to the presets table
    (`| Preset |`), the same paragraph story 1's D1 reads. The two sentences coexist there in
    either landing order. O1 needs `Limit` with a capital L.
13. **S3 re-aim.** The Limit label inside `StreamEditor` must still start with `>`, optional
    whitespace, then `Limit`, after the "Tag Filters" block.

## Test infrastructure

- Test framework: Node built-in runner (`npm test` → `test/test.js` → `test/registry.js`). Read a
  run's result per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
  No new dependencies or infrastructure.
- `bash`, GNU `sed` and `grep` on the test host (CI's Ubuntu image has them, and the Docker build
  uses the same tools).
- Concept Graph API: not used. No live-API suites; the live checks above are manual.
- Firmware state: none required.
- Fixture: `test/fixtures/strfry-1.1.0-router-connOpen/src/apps/mesh/cmd_router.cpp` holds strfry
  1.1.0's `StreamGroup::connOpen` as given in the ADR's sources (verified there against a real
  1.1.0 checkout; it wasn't re-fetched this session, since this session has no GitHub access). It
  has a provenance comment at the top, and indentation is 8/12/16 spaces as upstream. The suite
  copies the tree into a temp dir per test and never modifies the fixture.
- Temp dirs live under `os.tmpdir()` and are removed when the suite ends.
- **Reachability check (done once, not committed).** The ADR's changes were applied literally to a
  throwaway copy of the tree outside the repo. There the new suite passed 26/26, and
  `router-stream-tag-filters` (with the re-aimed S3), `treasure-maps-router-preset`,
  `strfry-router-value-hardening`, `strfry-router-owner-gate` and
  `strfry-router-first-boot-config` kept their results. The copy used the `<span>` label style and
  a multi-line hint with `<strong>`, to confirm formatting doesn't matter. Mutations caught: an
  unanchored bare-line grep (P1, P2), no post-sed verification (P3), using cwd instead of `$1`
  (P1–P3), `>= 0` applied to `since`/`until` (F3), the card ignoring upload-only streams (U6), and
  `treasureMaps` left without a limit (S1, S3).

## How to run

```
npm test
node test/router-stream-limit-on-connect.test.js        # just this suite
```

No browser/e2e tests: the UI changes are wording and a default, pinned at source level.

## Verification

The new tests fail with the current code. Confirmed on 2026-10-09 at commit `df3cf7c`, with the
test changes uncommitted (Node v22.22.0, no stack). Every failure is a missing file or a contract
assertion; none is a load error. `node test/router-stream-limit-on-connect.test.js`:

```
--- router stream limit on connect tests (relay-stream-gaps #2) ---
  FAIL  P1: on a copy of strfry 1.1.0's connOpen, the router patch exits 0 and turns the one `filterToSend["limit"] = 0;` line into `if (!filterToSend.find("limit")) filterToSend["limit"] = 0;`, indentation kept, every other byte unchanged (AC-1, AC-3, AC-5)
        patches/strfry-router/apply-patches.sh must exist: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  P2: running the router patch a second time is a no-op that exits 0; the line is not wrapped twice (idempotent)
        patches/strfry-router/apply-patches.sh must exist: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  P3: a strfry tree whose connOpen no longer has the bare limit line fails loudly: non-zero exit and an ERROR line on stderr (a STRFRY_REF bump can't silently drop the patch)
        patches/strfry-router/apply-patches.sh must exist: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  P4: a strfry tree without src/apps/mesh/cmd_router.cpp fails with a non-zero exit
        patches/strfry-router/apply-patches.sh must exist: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  P5: the patch script's header cites strfry 1.1.0 and ADR relay-stream-gaps/0002 (what a STRFRY_REF bump must re-verify)
        patches/strfry-router/apply-patches.sh must exist: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  D1: the Dockerfile copies patches/strfry-router/ into the image before the RUN that builds strfry
        the Dockerfile must `COPY patches/strfry-router/ <dir>/`: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  D2: the strfry build RUN applies the router patch to /usr/local/src/strfry with `&& bash …/apply-patches.sh`, after the Redis patches and before make
        the Dockerfile must COPY patches/strfry-router/ before the strfry RUN can apply it: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  D3: the comment above ARG STRFRY_REF names both patch directories, patches/strfry-redis/ and patches/strfry-router/ (a bump re-verifies both)
        the STRFRY_REF comment must also name patches/strfry-router/: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  S1: every preset ships with filter.limit 500, treasureMaps included (AC-4; product decision 1)
        every preset's filter.limit must be 500; these are not: not implemented yet (ADR relay-stream-gaps/0002).
        expected: []
        actual:   ["dcosl: 5","dcosl2: 5","userProfiles: 5","trustedLists: 5","WoT: 5","trustedAssertions: 5","treasureMaps: (none)"]
  PASS  S2 (guard): presets keep their names, directions and kinds; each filter is kinds plus limit only, with no tag filters (R3's guardrail)
  FAIL  S3: every preset, enabled, reaches the router config with "limit":500 in its filter line next to its kinds, so the limit gets to strfry (AC-1, AC-2)
        each preset's config filter must carry "limit":500; these do not: not implemented yet (ADR relay-stream-gaps/0002).
        expected: []
        actual:   ["dcosl: {\"kinds\":[9998,9999,39998,39999],\"limit\":5}","dcosl2: {\"kinds\":[9998,9999,39998,39999],\"limit\":5}","userProfiles: {\"kinds\":[0],\"limit\":5}","trustedLists: {\"kinds\":[30392,30393,30394,30395],\"limit\":5}","WoT: {\"kinds\":[3,1984,10000],\"limit\":5}","trustedAssertions: {\"kinds\":[30382],\"limit\":5}","treasureMaps: {\"kinds\":[10040]}"]
  FAIL  F1: sanitizeStreamFilter drops a negative limit and keeps the other keys in order, so the router config gets no limit and the stream is live only
        a negative limit must be dropped at ingress (it now reaches strfry's REQ): not implemented yet (ADR relay-stream-gaps/0002).
        expected: {"kinds":[0],"#t":["x"]}
        actual:   {"kinds":[0],"limit":-1,"#t":["x"]}
  PASS  F2 (guard): sanitizeStreamFilter keeps limit 0 and any positive integer as-is, in place, with no upper clamp (the relay caps) (AC-1, AC-5)
  PASS  F3 (guard): since and until are unchanged: integers kept, negatives and 0 included; non-integers dropped (the ADR touches limit only)
  PASS  F4 (guard): a limit that is not an integer is still dropped (1.5, "500", null, NaN, Infinity, true)
  PASS  F5 (guard): a stream with no limit stays without one: no default is added on save, and its config line has no limit (AC-5: live only unless a limit is set)
  PASS  F6 (guard): generateConfig emits the same bytes before and after sanitization for limits 0, 5, 500 and none, and writes "limit":500 inline (R2's baseline holds; AC-3)
  FAIL  U1: RelaySettings.jsx declares `const DEFAULT_STREAM_LIMIT = 500;` at module scope (AC-4; product decision 1)
        RelaySettings.jsx must declare `const DEFAULT_STREAM_LIMIT = 500;` at module scope: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  U2: a new stream starts at the default limit: emptyStream() uses DEFAULT_STREAM_LIMIT, not 5 (AC-4)
        emptyStream() must no longer start new streams at limit 5: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  U3: the editor's Limit field is labelled "Limit (fetched on connect)" and its placeholder is DEFAULT_STREAM_LIMIT (AC-4)
        the Limit field's label must read "Limit (fetched on connect)"; labels now: ["Name","Direction","Event Kinds","Tag Filters (optional — single-letter tag names, e.g. #z)","Limit","Relay URLs","Plugin (Download)","Plugin (Upload)"]: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  U4: the hint under the Limit field says each relay re-sends up to that many newest matching events on every connect, downloads only, blank or 0 = live only, strfry caps at 500 (AC-4, AC-5)
        the StreamEditor must show the download hint (ADR wording); missing sentences: not implemented yet (ADR relay-stream-gaps/0002).
        expected: []
        actual:   ["Each time this stream connects, every relay re-sends up to this many of its newest matching events, then streams live.","Downloads only.","Blank or 0 = live only (nothing fetched on connect).","strfry relays send at most 500."]
  FAIL  U5: for an upload-only stream (form.dir === 'up') the hint instead says "Not used: upload-only streams send new local events as they arrive." (AC-4)
        the StreamEditor must pick the Limit hint on `form.dir === 'up'`: not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  U6: the stream card's Filter line says " (fetches up to N on connect)" for limit > 0, " (live only: nothing fetched on connect)" for blank or 0, and nothing for upload-only streams; "(limit: N)" is gone (AC-4, AC-5)
        the old "(limit: N)" card wording must be gone: not implemented yet (ADR relay-stream-gaps/0002).
  PASS  U7 (guard): the stream card still shows its Filter line under the existing condition (kinds or tag filters present)
  FAIL  O1: OPERATIONS.md "What a deploy does" says a router stream refetches its newest events up to its Limit on reconnect (live only when blank or 0), and that anything beyond that needs a negentropy sync
        the paragraph must drop "a router stream brings nothing published upstream while it was down": not implemented yet (ADR relay-stream-gaps/0002).
  FAIL  B1: BIBLE §14 "Presets are opt-in cross-instance mirroring" says a stream's Limit is how many newest events each relay re-sends on every connect, honored by the image's patched strfry router (upstream ignores it), blank or 0 = live only
        BIBLE §14 must gain the Limit sentence; it does not mention: not implemented yet (ADR relay-stream-gaps/0002).
        expected: []
        actual:   ["Limit","fetch/refetch","connect","newest","the patched strfry router","upstream strfry ignoring it","blank or 0","live only"]
router-stream-limit-on-connect: 7 passed, 19 failed, 0 skipped
```

Full gate, before and after the test changes, read with `npm run gate:status`:

```
20261009T035327Z-29653-e958 [rsg2-baseline] started 2026-10-09T03:53:27.649Z on df3cf7cb+dirty — FAIL, exit 1, 5114 passed, 31 failed, 590 skipped, 277/277 suites; failed: router-stream-tag-filters, router-config-reload-in-place · tmp/gate-runs/20261009T035327Z-29653-e958.json
20261009T040159Z-17685-a175 [rsg2-tests] started 2026-10-09T04:01:59.644Z on df3cf7cb+dirty — FAIL, exit 1, 5121 passed, 50 failed, 590 skipped, 278/278 suites; failed: router-stream-tag-filters, router-config-reload-in-place, router-stream-limit-on-connect · tmp/gate-runs/20261009T040159Z-17685-a175.json
```

The first run is the baseline, the second has the new suite. The only per-suite difference is the
new `router-stream-limit-on-connect: FAIL (7 passed, 19 failed, 0 skipped)`. All 277 pre-existing
suites have the same verdict and counts. The two that already failed are story 1's
intentionally failing tests (`router-config-reload-in-place` 3/30, and R1 in
`router-stream-tag-filters` 20/1, unchanged with S3 re-aimed). `+dirty` on the baseline is only
the worktree's untracked `node_modules` symlink. On the second run it also covers the
uncommitted test changes.
