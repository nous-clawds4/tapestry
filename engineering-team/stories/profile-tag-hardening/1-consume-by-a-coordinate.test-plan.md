# Test Plan: profile-tag-hardening Story 1 — consume profile-tags by the a-coordinate

**Story:** `engineering-team/stories/profile-tag-hardening/1-consume-by-a-coordinate.md`
**ADR:** `engineering-team/decisions/profile-tag-hardening/0001-consume-profile-tags-by-a-coordinate.md`
**Date:** 2026-07-07
**Test file:** `test/profile-tag-consume-by-a-coordinate.test.js`

## Test strategy — why this shape

The changed logic lives in `src/api/profile-tags/index.js` handlers that take `(req, res)` and
scan strfry internally (via `federatedScan`/`strfryScan`, which `exec` the `strfry` binary — absent
on the host). So, exactly as the sibling suites in this epic (`tag-read-union.test.js`, the `*-ui`
suites) do, coverage is three-tiered:

- **BEHAVIORAL-UNIT** — the *new* pure canonicalization rule (build a coordinate; resolve an
  assertion to its canonical tag coordinate via `#a`, falling back to `#e`) plus the already-exported
  `dedupeReplaceable`. This proves version-spanning, legacy fallback, and no-double-count
  deterministically, with hand-built events and no strfry. The rule is duplicated across three read
  sites **and** mirrored in the UI grouping, so it MUST be extracted and exported for tests (same
  "exported for tests" convention as prior stories: `federatedScan`, `dedupeReplaceable`, `parseTagPayload`).
- **SOURCE-CONTRACT** — assert the load-bearing *wiring* at each of the four named `#e`-scan sites
  (which union `#a`, which stays `#e`-only) and the two response-shape additions. This is the same
  idiom `tag-read-union.test.js` uses (grep `federatedScan` in named function bodies). Assertions are
  on load-bearing substrings (`'#a'`, `'#e'`, `federatedScan`/`strfryScan`, `tagAddress`), not on
  variable names or markup.
- **MANUAL browser checklist** — the true end-to-end (a *replaced* tag-element renders its name, not a
  truncated id, on a live profile; the pubkey TL republishes spanning versions). Runtime behavior
  source can't prove; run on the local dev stack via `cycle-local`, matching how this epic's prior
  stories were live-proven.

## Coverage map

| Criterion | Test(s) | Level |
|---|---|---|
| **AC-1** A replaced tag-element still resolves (by a-coordinate, surfaces name) | `B1`, `B4`; wiring `S1`,`S5a`; manual `M1` | behavioral + source + manual |
| **AC-2** The pubkey TL (kind-30392) spans tag-element versions | `B1`; wiring `S1` (aggregateProfilesTagged unions `#a`); manual `M2` | behavioral + source + manual |
| **AC-3** Legacy `e`-only assertions still resolve (union, not replace) | `B2`; wiring `S1`,`S2`,`S3` retain `#e` | behavioral + source |
| **AC-4** Un-replaced tags unchanged (strict superset, no double-count) | `B3`, `B5` | behavioral |
| **AC-5** Read/UI associate a tagging to its tag by coordinate | `B1`; wiring `S5a`,`S5b`,`S6a`,`S6b`; manual `M1` | behavioral + source + manual |
| *(boundary)* the one genuine per-version lookup stays `#e` | `S4` (regression sentinel) | source |
| *(boundary)* search stays local (SEARCH-IS-LOCAL preserved) | `S2` | source |

## Behavioral-unit tests (the new pure rule)

Requires the Implementer to export two pure helpers (the shared canonicalization primitive):
- `tagCoordinate({ authorPubkey, slug })` → `"39999:<authorPubkey>:<slug>"`.
- `assertionTagCoordinate(assertionEvent, { tagById })` → the canonical coordinate for an assertion:
  its own `["a", …]` value if present; else resolve its `["e", eventId]` via `tagById` (a
  `Map<eventId, { authorPubkey, slug }>`) to a coordinate; else `null`.

- **B1 — version-spanning (AC-1/AC-2/AC-5).** Two assertions on the *same* `(author, slug)` tag, one
  carrying `["e", "old-event-id"]` and one `["e", "new-event-id"]`, **both** carrying the shared
  `["a", "39999:AUTH:funny"]`, resolve to the **same** coordinate — so they group onto one tag across
  a tag-element replacement.
- **B2 — legacy `e`-only fallback (AC-3).** An assertion with **no** `a` tag, only `["e","evtX"]`,
  resolves via `tagById.get("evtX") → {authorPubkey, slug}` to the correct coordinate — identical to
  today's behavior.
- **B3 — no double-count across the two scan legs (AC-4).** An assertion that carries **both** a
  matching `a` and a matching `e` (so it appears in *both* the `#a` leg and the `#e` leg) collapses to
  **one** survivor under `dedupeReplaceable([...byA, ...byE])` — counts cannot double. (Keyed on
  `pubkey|d-tag`; the assertion's d-tag is stable across legs.)
- **B4 — coordinate construction.** `tagCoordinate({authorPubkey:'AUTH', slug:'funny'})` === `"39999:AUTH:funny"`.
- **B5 — unresolvable → null (superset fallback).** An assertion with neither `a` nor a resolvable
  `e` (unknown event-id) yields `null`, so the caller/UI falls back to the existing per-assertion
  truncated-id render (unchanged behavior; no throw).

## Source-contract tests (wiring at the four sites + response shape)

- **S1 — site 2 `aggregateProfilesTagged` unions `#a` (AC-2, required).** Its body issues a scan
  filter containing **both** `'#a'` and `'#e'`, and still uses `federatedScan` (browse/visibility
  surface — the remote leg must stay). *Fails now* (`#a` absent).
- **S2 — site 1 `computeTagMatches` unions `#a` AND stays local (AC-3 + SEARCH-IS-LOCAL).** Its body
  contains **both** `'#a'` and `'#e'`, uses `strfryScan`, and does **not** use `federatedScan`.
  *Fails now* (`#a` absent).
- **S3 — site 4 `handleAuthoredBy` parent scan unions `#a`.** Its body contains **both** `'#a'` and
  `'#e'`. *Fails now* (`#a` absent from the parent scan).
- **S4 — site 3 `handleTagById` stays `#e`-only (boundary, regression sentinel).** Its body contains
  no `'#a'` scan filter — the viewer-pin check is deliberately per-version. *Passes before AND after*
  (guards the deliberate decision).
- **S5a — `handleTagsForProfile` exposes `tagAddress`.** Body assigns `tagAddress` on each entry.
  *Fails now.*
- **S5b — `handleAvailableTags` exposes `tagAddress`.** Body assigns `tagAddress` (the join key).
  *Fails now.*
- **S6a — `ProfileTagsSection.jsx` groups by coordinate.** References `tagAddress`. *Fails now.*
- **S6b — `AddTagDialog.jsx` joins by coordinate.** References `tagAddress`. *Fails now.*

## Manual browser checklist (runtime-only; run via `cycle-local` on `localhost:7778`)

- **M1 — replaced-tag renders its name.** Apply a tag to a profile; re-mint (edit) that tag-element so
  it gets a new event-id at the same `(author, slug)`; reload the profile → the chip shows the tag's
  **name**, not a truncated id, and Manage/AddTag treat it as already-applied.
- **M2 — pubkey TL spans versions.** With a pubkey tagged both before and after the replacement, run
  `refreshPinnedTagTLs` (or the pin path) → the kind-30392 pubkey TL includes the assertion that
  referenced the *prior* event-id (matched by `#a`).

## Edge cases covered
- [x] Assertion with only `e`, no `a` (legacy) — B2.
- [x] Assertion with both `a` and `e` present in both scan legs — B3 (no double-count).
- [x] Assertion resolving to no known tag — B5 (null, truncated-id fallback preserved).
- [x] Un-replaced tag: `#e` and `#a` return the same set, dedup collapses overlap — B3 + strict-superset argument (ADR §(e)).
- [ ] *(manual)* replaced tag-element end-to-end — M1/M2.

## Test infrastructure
- Framework: Node built-in runner via the project harness (no new framework). Behavioral tests build
  plain event objects; source-contract tests read `src/api/profile-tags/index.js` and the two `.jsx`
  files as text. **No strfry, no live API, no concept-graph** dependency.
- Firmware state: none required (read-path only; `tagAddress` already in the ADR-0022 schema).

## How to run
```
node test/profile-tag-consume-by-a-coordinate.test.js
```
(or the full suite via `npm test`).

## Verification
Confirmed 2026-07-07 (commit `845d8d9d` base): **2 passed, 11 failed** — all failures for the right
reason (helpers not yet exported; `#a`/`tagAddress` wiring absent), not typos/import errors.

```
--- profile-tag consume-by-#a tests (epic profile-tag-hardening, Story 1) ---
  FAIL  B4: tagCoordinate builds the stable 39999:<author>:<slug> coordinate
          tagCoordinate must be exported (the shared coordinate builder …)
  FAIL  B1: an assertion resolves to its tag by a-coordinate — spanning tag-element versions
          assertionTagCoordinate must be exported (the canonicalization rule …)
  FAIL  B2: a legacy e-only assertion (no a tag) still resolves via #e → coordinate
          m.assertionTagCoordinate is not a function
  PASS  B3: an assertion present in BOTH scan legs collapses to one — counts cannot double
  FAIL  B5: an assertion resolvable by neither a nor a known e yields null (superset fallback)
          m.assertionTagCoordinate is not a function
  FAIL  S1: aggregateProfilesTagged unions #a (spans versions) and keeps federatedScan
  FAIL  S2: computeTagMatches unions #a but stays LOCAL — SEARCH-IS-LOCAL preserved
  FAIL  S3: handleAuthoredBy parent scan unions #a
  PASS  S4 (boundary, regression sentinel): handleTagById stays #e-only
  FAIL  S5a: handleTagsForProfile exposes tagAddress on each entry
  FAIL  S5b: handleAvailableTags exposes tagAddress on each tag
  FAIL  S6a: ProfileTagsSection.jsx groups profile tags by coordinate (references tagAddress)
  FAIL  S6b: AddTagDialog.jsx joins already-applied by coordinate (references tagAddress)

profile-tag-consume-by-a-coordinate: 2 passed, 11 failed
```

The 2 passing are intentional: **B3** proves the existing `dedupeReplaceable` already collapses an
assertion appearing in both union legs (the no-double-count invariant the ADR relies on), and **S4** is
the boundary sentinel (`handleTagById` is correctly `#e`-only today and must stay).
