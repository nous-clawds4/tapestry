# Test Plan: Story 4 — Publish-time default stamping

**Story:** `engineering-team/stories/shared-concepts-adoption/4-publish-time-default-stamping.md`
**ADR:** `engineering-team/decisions/shared-concepts-adoption/0004-publish-time-default-stamping.md`
**Date:** 2026-08-06
**Suite:** `test/publish-time-default-stamping.test.js` (registered in `test/test.js`, the standard five-touch)

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| AC-1 pin parity (+ legacy untouched) | `S1` (both sites, runtime-variable templates only — the legacy constant's own definition is excluded by negative lookahead; legacy presence pinned) | structural |
| AC-2 TL parity | `S2` (personal handle beside `TAG_PINNING_Z_TAG`, which stays) | structural |
| AC-3 the resolver | `U1`–`U5` (type gate incl. inherit exclusion; self exclusion; sentinel/malformed/event-id drop; cap 5 exported + enforced; dedupe; empties) | unit |
| AC-4 the central seam | `S4` (create-element consults the selector) + `H2` (wired → BOTH z's — the discriminating row) + `H1`/`H3` (unwired / deferred → single z, regression rows passing pre AND post) | structural + live |
| AC-5 no regressions | `S3` (the profile-tag dual lines byte-unchanged) + `H1`/`H3` + no re-stamping path exists anywhere in the diff (reviewer confirms) | structural + live |
| AC-6 gates | the suite in `npm test`; lint green after registration | — |

## Edge cases

- [x] Inherit-typed b never stamps (`U1` — the affiliation-vs-deference line, ADR 0029 semantics).
- [x] Self-pointing b (self-declared headers) excluded — already the personal stamp (`U2`).
- [x] Sentinel, malformed, and event-id values drop (`U3` — only a-tag targets are stampable concepts).
- [x] Cap + dedupe + empty inputs (`U4`, `U5`).
- [x] Deferred header resolves personal-only end-to-end (`H3`).

## Test infrastructure

- The established idioms: loopback writes, host-fetch reads, `nextStamp` on every fixture header write (OPEN.md #144).
- **Singleton fixtures (bounded residue, documented):** `create-element` mints permanent graph
  elements with no teardown path, so the live rows use ONE clearly-named fixture concept
  (`stamping fixture f4`, created once via the runtime producer; "already exists" tolerated
  thereafter) and THREE fixed-name singleton elements (the dupe check stops growth after run one).
  The fixture header's wiring resets bare each run (`nextStamp` republish); on re-runs the
  singleton elements' historical stamps still prove the seam (created-when-wired ⇒ dual). Visible
  residue: one fixture concept in the concepts list — named to be self-explanatory.
- **Recorded gap:** pin and TL parity are S-level only — both writers are browser-session paths a
  loopback caller cannot operate (pins are NIP-07 client-signed; TLs session-gated). The S pins are
  precise (site-counted with the legacy definition excluded); end-to-end verification lands with
  the staging smoke's bundle check + any owner-performed pin after deploy.
- No firmware precondition; no Playwright row.

## How to run

```
node test/publish-time-default-stamping.test.js
```

Full gate: `npm test`.

## Verification

The suite fails with current code for the right reasons. Confirmed 2026-08-06 at commit `4a5b90fd` (stack up):

```
publish-time-default-stamping: 5 passed, 9 failed, 0 skipped
  — U1–U5 fail: "selectPointerTargets must be exported from src/lib/bValueForms.js (ADR 0004)"
  — S1 fails: "found 0 of 2" (the legacy constant's own definition correctly excluded by lookahead —
     tightened during verification after the naive regex counted it)
  — S2, S4 fail: TL personal handle / selector reference absent
  — H2 fails (THE discriminating row): a wired concept's element carries only
     ["…:stamping-fixture-f4"] — the missing shared handle named exactly
  — Passing by design: U6 (zero-require), S3 (profile-tag dual lines byte-unchanged),
     H1/H3 (unwired/deferred single-z — today's behavior IS the contract), H4 (teardown)
  — The fixture pipeline (concept ensure → wire → create → scan) proved itself live pre-implementation
```
