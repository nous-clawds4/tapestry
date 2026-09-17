# Review: Story 2 — Treasure-Map tags panel

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-27
**Diff:** `git diff 96ea12d7...HEAD` (story `2b0c7b5f` tests → `0bd4c80a` impl → `80960aa4`
J3-observation fix), branch `feat/tl-treasure-map-panel`

## Quality gates (run by reviewer, not trusted)

- [x] Scoped gate (story's named command, brace-redirect, foreground) — **18/18 PASS, EXIT=0**,
      re-run after the `80960aa4` fix. The J3 judge independently reproduced the same result.
- [x] `cd ui && npm run build` (vite) — **EXIT=0** after the fix. This is the check the S-class
      source scans cannot make (a syntactically broken JSX file would pass them).
- [x] Browser (localhost:7778, served bundle): route loads with **zero console errors**;
      logged-out state renders breadcrumb + NIP-07 prompt. Logged-in visual pass is Gate B's —
      login is a server session behind a NIP-07 challenge and is not automatable headless (the
      plan's not-covered boundary said exactly this).
- [x] `bash scripts/harness-lint.sh` — clean (0 violations) at review commit.
- [ ] Full `npm test` — deferred to book close per workflows/light-profile.md (the scoped gate
      is the reviewer floor; the full registry is the book-close/promotion gate).

## Spec adherence

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 one row per tag, event order | ✅ | U4 (length+order over a mixed list incl. `d`/`alt` rows); S2 (page mounts panel); panel maps `tags` directly |
| AC-2 classification by kind range | ✅ | U1/U2/U3 (`30382:rank`→TA, bare `30392`→TL, edges 30389/30390/30399, `39999`→other). **Interpretation ratified here:** AC-2 governs well-formed delegation entries; AC-6 (the specific provision) governs malformed ones — a 3038x/3039x first element with no valid delegate renders "other" (see `80960aa4`). Flagged for the operator's Gate-B eyes. |
| AC-3 avatar → `/tapestry/users/<pubkey>`, batch profiles | ✅ | S2 (Avatar import + link target), S3 (`/api/profiles?pubkeys=` + catch); Avatar carries the TA badge itself (ta-avatar/0001) |
| AC-4 Local TA vs external, runtime-resolved, no literal | ✅ | S4 (`useConfig().taPubkey`), S5 (truthiness guard — no label until resolved), R3 (no 64-hex literal in the three files) |
| AC-5 relay hint shown | ✅ | U5 (extracted/null); panel renders `row.relay` right-aligned mono |
| AC-6 malformed → "other", no avatar, no crash | ✅ | U6/U7; post-`80960aa4` a delegate-less five-digit kind also demotes to "other" (J3 observation (b), confirmed defect, fixed) |
| AC-7 no-Map path + raw toggle unchanged | ✅ | R1/R2 sentinels green before and after; diff shows the found-event block only |

- [x] No criterion silently dropped; no behavior beyond the story (the TagSummary→panel swap is
      the Design note's one declared page change; the deleted helper was module-private, sole
      call site — J1 verified).

## ADR adherence
- [x] ADR 0001 consumed faithfully: `classifyEntry` implements §1's parse rule (split on `:`,
      all-digits kind); the ADR's suggested module (`ui/src/utils/treasureMap.js`) and consumer
      guidance are followed. The delegate-validity demotion is **display-layer** strictness ADR
      §1 does not speak to — the wire convention is untouched; story 3's writer path still
      emits/replaces exactly the ADR §3 shape.
- [x] Layering: classifier is a pure util (story 3 reuses it); panel is presentational; page
      passes props. No new dependencies (`react-router-dom`, existing Avatar/ConfigContext only).

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall. No new handles.

## Things tests can't catch
- [x] Injection: profile `display_name`/relay strings render as React text nodes (escaped);
      link path is built from the validated lowercase 64-hex only.
- [x] Case coherence end-to-end: rows normalize pubkeys lowercase (U8); the profile fetch is
      issued with those lowercase keys, so the response map keys match `row.pubkey`; `taPubkey`
      comparison uses the same normalized value (and the app-wide convention — Avatar compares
      raw equality against the same context value).
- [x] Effect discipline: `rows` is memoized on `tags`; the profile fetch effect keys on `rows`,
      fires once per event change, ignores failures (`catch → lettered avatar`), and cannot loop
      (setProfiles does not feed the memo).
- [x] `key={i}` on rows: acceptable — the list is a static projection of one event; rows carry
      no per-row input state.

## House rules check
- [x] TA pubkey runtime-resolved everywhere (R3 enforces the absence of literals).
- [x] No new lint/typecheck/build tooling.

## Gate-A classification (ratified)
**Design note, no ADR — correct.** The story is strictly a reader of a wire format ADR 0001
already ratified; J1 walked the irreversibility triggers and none fire. The provisional
classification is hereby ratified per workflows/light-profile.md Gate B.

## Findings

### Blocking
None.

### Non-blocking
1. **test/tl-treasure-map-panel.test.js** — no assertion pins the delegate-less demotion added
   at `80960aa4` (U7 checks `pubkey: null` but not `cls`). Story 3's suite should assert it —
   its salient check (`cls === 'tl'` + pubkey comparison) depends on exactly this rule. Carried
   forward to story 3's plan.
2. **Story file E1 bullet** — the J2-era "(not derivable from any AC)" label was reworded
   mid-story to state the derivation honestly (the loading clause in AC-4 *came from* E1). The
   J3 judge flagged the rewording for Gate-B attention; ratified here as an accuracy fix, not a
   coverage change.

### Harness friction
1. `light-profile.md`'s example scoped-gate syntax (`npm test -- test/<file>`) does not scope in
   this repo — `test/test.js` ignores CLI args. → **OPEN.md row 181** (meta).
2. Session-start digest false-negatived "stack absent" while the stack served 200s. →
   **OPEN.md row 182** (meta).

## Verdict
**PASS**

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection: book `tl-treasure-map` — frame bullet 1 (tags panel) met pending the
      operator's Gate-B visual ratification; bullet 5 met (story 1); bullets 2–4 and 6 remain
      open on story 3. Book not complete; recorded in chat at Gate B.
