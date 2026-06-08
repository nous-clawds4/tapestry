# Review: Story 34 — Followers list on the primary profile page

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-06
**Diff:** `git diff origin/staging...HEAD` — branch `feat/story-34-profile-followers-list`; impl `1e909eda` (story `085019cd`, adr `aeff8806`, tests `bf2c9620`)
**Story:** `engineering-team/stories/profile/34-profile-followers-list.md`
**ADR:** `engineering-team/decisions/profile/0030-profile-followers-list.md`
**Test plan:** `engineering-team/stories/profile/34-profile-followers-list.test-plan.md`

## Quality gates (run by reviewer, not trusted)
- [x] **Node `profile-followers-list` — PASS 27/27** (standalone).
- [x] **Node `profile-verified-followers-count` — PASS 6/6** (its T5 was inverted plain→link by this story; now green).
- [x] `node --check` — `followersWithMetrics.js` + `index.js` OK.
- [x] **Build** — Vite compiles; deployed to local `:7778`; **browser-verified** — the profile's "Verified Followers" count links and clicking it lands on `/user/<pk>/followers`, which renders (title, back-to-profile, search, Columns, ⓘ, empty state).
- [x] **`npm run test:playwright` — deferred to staging.** Supplementary spec; a pre-existing `tests/global-setup.js` bug blocks local PW; real data is at staging.
- Lint / Typecheck — not configured.
- *(Full `npm test` not used as the signal — concept-graph suites need `:8877`, down by choice; the #34/#33 suites are stack-free and were run standalone.)*

## Spec adherence — every AC has a passing test
Entry point (count→link) → `T11` + #33 `T5` + browser; Return → `T12`; Direct load (owner-PoV verified) → `T1/T2/T6/T8/T9`; Row nav → `T13`; Listing + empty state → `T9` (browser-confirmed); **Verified scope** → `T3`; Default sort verifiedFollowerCount desc → `T20`; Re-sort/Search → `T18`; Pagination (client 50/page) → `T19`; Columns + default visibility → `T14`; Persistence + reset (distinct key) → `T21`; Name/Rank/npub → `T16/T15/T17`; Owner PoV (non-owner→400) → `T5`; Disclosure → `T22`; Parity → `T14/T18/T19/T23`. No criterion dropped; nothing added beyond the story.

## ADR adherence (Option A — mirror, not generalize)
- [x] New isolated endpoint `/api/get-grapevine-followers` ([followersWithMetrics.js:94-95](src/api/grapevineInteractions/queries/followersWithMetrics.js:94)) — **inbound** `(follower)-[:FOLLOWS]->(observee)` + `WHERE follower.influence > VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF` (reused, [:27](src/api/grapevineInteractions/queries/followersWithMetrics.js:27); no new constant); RETURNs the six fields; 504 deadline; non-owner `observer` → 400.
- [x] **No ORDER BY/LIMIT** — whole verified set returned; the page pre-sorts by verifiedFollowerCount desc + paginates client-side 50/page (the user's decision). Confirmed absent in the cypher.
- [x] **Live follows feature UNTOUCHED** — `git diff --name-only origin/staging...HEAD` does **not** include `followsWithMetrics.js` or `BrainstormFollows.jsx`; the `/api/get-grapevine-follows` route is intact (and still returns `success:true` on a live call). This is the entire point of Option A — confirmed (R1–R4 green).
- [x] count→link: [BrainstormProfile.jsx:244](ui/src/pages/BrainstormProfile.jsx:244) — the #33 plain counter is now `<Link … className="bsp-count bsp-count-link">` to `/user/${pubkey}/followers`, value unchanged.
- [x] Distinct localStorage key — `bsp-followers-columns` ([BrainstormFollowers.jsx:22](ui/src/pages/BrainstormFollowers.jsx:22)) vs `bsp-follows-columns` (follows page); no collision.
- [x] No new dependencies / build tooling.

## Concept-graph integrity
- [x] N/A — no concept/schema change (runtime Neo4j node properties surfaced, not redefined). No firmware reinstall. Concept Graph API unreachable this session — non-load-bearing (no concepts touched).

## Things tests can't catch
- [x] No secrets, debug logging, or commented-out code in the diff.
- [x] Edge cases: null influence → "—" rank; empty set → empty state (browser-confirmed); 504 on timeout (mega-account guard).
- [x] **Cross-story consistency** — the #33 T5 inversion is correct and the #33 suite stays self-consistent (6/0). The count→link is the single edit to a #33-shipped file; the Following counter is unchanged (R4).
- [x] Reuses `bsp-follows-*` CSS classes (no new CSS) — intentional, consistent styling.
- [x] Security: no new input boundary beyond the validated `observee` (64-hex + nip19); owner-only.

## House rules check
- [x] Concept Graph authority respected. No new lint/typecheck/build tooling. `dist/` (gitignored) not committed.

## Findings

### Blocking
None.

### Non-blocking
1. **Mega-account scale (staging watch-out).** The whole-set + client-pagination model (the user's "like Follows" decision) means a Jack-sized account fetches ~26k rows + ~530 `/api/profiles` batches up front, and the inbound dense-node traversal can be slow / 504. Documented in ADR 0030; **(b) lazy name-hydration** is the expected first optimization (server-side pagination the larger follow-on). Verify real load at `cycle-staging`.
2. **Local verification was render + navigation only.** Local Neo4j has no FOLLOWS for Jack (count:0 → empty state) and local Meili has no House scores (count anchor "—"); the populated table + the Playwright spec verify at staging. Not a defect.
3. **Duplication (filed follow-up).** `BrainstormFollowers.jsx` ≈ `BrainstormFollows.jsx` and the two endpoints share shape — the deliberate price of Option A's isolation. The "DRY `<GrapevineList>`" refactor is the documented follow-up.

## Verdict
**PASS** — the diff matches story #34, ADR 0030 (Option A, mirror), and the test plan; gates are clean (27/0 + 6/0, run by the reviewer); the live follows feature is provably untouched; scope is tight (deferred items not pulled in). The open items are non-blocking and staging-bound by design.
