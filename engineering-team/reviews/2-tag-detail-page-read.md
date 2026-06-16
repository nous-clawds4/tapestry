# Review: Story 2 — Tag-detail page (read)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-05-14
**Diff:** `git diff 04878346...HEAD` (impl commit `424e10be`, also reviewed against ADR `73177762` and tests `34dcd4c9`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (37 passed, 1 per-test SKIP). Output:

  ```
  Test Results
  -------------
  Configuration Loading:        PASS
  profile-tags suite:           PASS (13 passed, 0 failed)
  profile-tags-publish suite:   PASS (7 passed, 0 failed)
  tag-detail suite:             PASS (8 passed, 0 failed)
  tag-detail-publish suite:     PASS (9 passed, 0 failed)
  Overall:                      PASS
  ```

  The SKIP is the POV-narrow test (`profiles-tagged drops assertions whose authors are below the POV WoT rank threshold`), gated on `/var/lib/brainstorm/settings.json` being writable from the test process. Per the test plan, this skips on dev boxes where the test process can't share a filesystem with the server, and is transitively covered by Story 1's WoT-search test. Acceptable.

- [ ] `npm run test:playwright` — **NOT RUN by reviewer.** `@playwright/test` is not installed in this dev box's local `node_modules` (same pre-existing constraint Story 1's test plan documented). The Playwright spec at `tests/brainstorm/tag-detail.spec.js` parses cleanly and the routes / UI elements it exercises were manually smoke-tested by the Implementer against the rebuilt container (browser screenshot confirmation from the user: "looks right!"). Manual smoke-test by the reviewer: `curl /tag/<64-hex>` returns 200 with the SPA shell and the bundled CSS reference.

- [ ] _Lint not configured — skipped per house rules._
- [ ] _Typecheck not configured — skipped per house rules._
- [ ] _Build not configured — skipped per house rules._

## Spec adherence

- [x] **Every acceptance criterion has a passing test.** Cross-referenced the test-plan coverage map against the story's 8 ACs:
  - AC-1 (chip → URL) → Playwright `clicking a tag chip on a profile page navigates to the tag-detail page` (best-effort against test-profile data) + chip diff confirms `<Link to={\`/tag/...\`}>` wraps the name.
  - AC-2 (header content) → 3 publish tests on `by-id` (tag fields, Meili-author surfacing, author=null degradation).
  - AC-3 (per-row counts + enrichment + WoT filtering) → grouping/enrichment publish tests + the explicit POV-narrowing test (skipped here but valid).
  - AC-4 (three sort labels + divisive formula) → UI labels test + 3 server sort-order tests + invalid-sort 400 test.
  - AC-5 (default sort = Most applied) → server `sort defaults to applied` + UI `default sort indicator`.
  - AC-6 (in-place sort change) → each sort order verified independently against its own request; UI hook re-fetches on `setSort` (no nav).
  - AC-7 (row → profile) → not new-tested; `/user/:pubkey` covered by Story 1; row href is a deterministic string built from `row.pubkey`.
  - AC-8 (empty state) → server `empty rows` test + Playwright header-renders-when-no-profiles-match.

- [x] **No criterion silently dropped.** Confirmed in the test-plan map.

- [x] **No bonus behavior.** The implementation also added a `shortNpub` fallback for the display name; the user requested this during implementation. Defensible — improves UX and stays inside the spirit of "display name + avatar with shortened-pubkey fallback" (npub IS a shortened-pubkey representation, just bech32-encoded). The ADR didn't pin the fallback format, so this is within scope.

## ADR adherence

- [x] **Files changed match the ADR's Implementation notes:**
  - ✓ New `src/api/_shared/pov.js` with `resolvePov({wotPov, userPubkey})` — exported shape matches ADR.
  - ✓ `handleTagById` and `handleProfilesTagged` added to `src/api/profile-tags/index.js`; routes registered.
  - ✓ Meili proxy switched to importing `resolvePov` from the new shared module; inline `readUserPrefs`, `fs`, `path` requires removed (no behavior change — same `povSuffix`/`filters`/`sort` extracted; downstream URL building untouched).
  - ✓ New `ui/src/pages/Tag.jsx` and `ui/src/hooks/useTagDetail.js`.
  - ✓ `TagChip.jsx` name span now wrapped in `<Link>`; popover Apply/Dispute buttons add `e.preventDefault()` per ADR.
  - ✓ Routes added to `App.jsx`: `/tag/:tagId` and `/tag/:slug/:tagId`.

- [x] **Layering / module boundaries respected.** New shared helper lives in `src/api/_shared/`; profile-tags imports it; meili proxy imports it. Single source of truth for POV resolution.

- [x] **No new dependencies.** Reuses `nostr-tools/nip19` (already in `ui/package.json` per Story 1 imports), `react-router-dom`, existing Meili helpers, existing `strfryScan`, etc.

- [x] **URL convention** matches Option A in the ADR: `/tag/:slug/:tagId` is canonical; `/tag/:tagId` redirects to canonical once `tag.slug` loads.

- [x] **Sort semantics** match ADR exactly: divisive sorter = `min(applications, disputes)` desc, ties → total volume desc, ties → pubkey lex.

- [x] **POV-first invariant** (CLAUDE.md): counts derived per-request from raw assertions; no persistent per-POV aggregate column. Filter applied at view time via `wot_rank_<suffix> >= minRank` Meili lookup.

## Concept-graph integrity

- [x] **No concept changes.** ADR explicitly states "Firmware reinstall required? **No.**" Story 2 reuses the `nostr-user-tag` and `tag` concepts established by ADR-0001.
- [x] **Handles in `kind:pubkey:slug` form.** New code uses the existing `NOSTR_USER_TAG_Z_TAG` constant (`39998:<TA>:nostr-user-tag`) — unchanged from Story 1.
- [x] **No BIBLE.md or firmware-JSON reads in new code.** All lookups go through strfry / Meili / the concept-graph API.

## Things tests can't catch

- [x] **No secrets in committed files.** Scanned diff for tokens, keys, .env values — none.
- [x] **No leftover debug logging.** `grep -E "console\.|TODO|FIXME|debugger"` against the additions returned empty.
- [x] **No commented-out code.** Diff is clean.
- [x] **Error paths handled.** `by-id` 400 / 404 / 500; `profiles-tagged` 400 / 200-with-empty-rows / 500; UI hook captures `headerError` / `rowsError` and surfaces them; Meili-unreachable on `by-id` degrades to `author: null` rather than failing the whole request.
- [x] **Race conditions considered.** `useTagDetail` uses a `cancelled` flag in both effects to drop stale fetch results when deps change. Auth-bootstrap gating (`if (authLoading) return undefined`) prevents the fresh-load POV race the ADR called out.
- [x] **Security: input validation at boundaries.** `tagEventId` validated with `/^[0-9a-f]{64}$/`; `sort` validated against an allowlist; `pubkey` reuses the existing helpers' validation. `strfryScan` filter is composed from validated inputs (no shell-injection vector — `JSON.stringify` then quote-escape, same as the existing pattern).

## House rules check

- [x] **Concept Graph API authority respected.** No new code reads BIBLE.md or firmware JSON.
- [x] **No new lint/typecheck/build tooling.**

## Findings

### Blocking

_None._

### Non-blocking

1. **`src/api/profile-tags/index.js:425`** — `handleProfilesTagged` does `const { resolvePov } = require('../_shared/pov');` inside the function body instead of at top-of-file like the meili proxy does. Node caches require() so there's no perf cost; readability nit only. Optional improvement: hoist to the top of the file alongside the other requires.

2. **`src/api/profile-tags/index.js:478`** — `Number.isFinite(minRank) ? minRank : null` is technically redundant: the helper (`src/api/_shared/pov.js:66-68`) already returns `null` when `minRank` isn't finite, so the ternary will always return `minRank` directly. Defensive and harmless. Optional simplification: `minRank,` (lean on the helper's contract).

3. **`src/api/profile-tags/index.js:351-365`** — `parseTagPayload` is a clean extraction but duplicates a parser already inlined in `findTagsByNameSubstring` (search the same file for `const jsonTag = (ev.tags || []).find((t) => t[0] === 'json')`). Consolidating is a refactor outside Story-2 scope; flagging only so a future cleanup story can pick it up.

4. **`?pov=<8char>` query-param passthrough not wired.** The ADR's bootstrap sequence specified "If `?pov=<8char>` query param is present, treat it as an explicit override and pass through." The implementer's commit message acknowledges skipping this: the existing meili proxy doesn't accept a `povSuffix` override (only `wotPov` + `userPubkey` resolved through prefs), no test exercises the path, and `BrainstormProfile.jsx` reads `?pov=` but doesn't actually consume it server-side either — it's preserved-but-dead UI plumbing today. Wiring the client alone wouldn't actually change which POV the server uses. **Recommendation for the Architect:** amend ADR-0002 (or open a follow-up ADR) to clarify whether `?pov=` is (a) future-feature stub that should be left alone, (b) needs a server-side `povSuffix` override surface, or (c) should be removed from the spec. Not a blocker because there's no functional gap today: a logged-in user gets their POV; an anonymous user gets house POV; both match what the server can actually do.

5. **Known UX bug** (out of scope): tag chips after the first one in a row dismiss the popover before the cursor reaches the Apply/Dispute buttons. Confirmed in this session by the user. Story 6 (`6-tag-ux-polish.md` AC-1) explicitly owns the popover-persistence fix. Not a Story-2 regression.

## Verdict

**PASS**

The implementation matches the story, ADR, and test plan. All quality gates clean (or correctly skipped for documented infra reasons). Architecture invariants honored. Non-blocking findings are stylistic or scoped to follow-up.
