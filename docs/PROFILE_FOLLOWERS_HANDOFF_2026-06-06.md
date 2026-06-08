# Handoff — Profile "Verified Followers" count + Followers table (2026-06-06)

**Status:** 🔴 OPEN

Session that added the verified-followers **count** to the profile and a verified-followers **table** page. Both are **on staging, not on main** (production deliberately held). This doc is the pick-up-later record: what shipped, what's broken, what's deferred, and the clean-ups.

## What shipped (engineering-team, profile epic)

| Story | What | ADR | Review | To staging |
|---|---|---|---|---|
| **#33** profile-verified-followers-count | A "Verified Followers" count on the profile counter row, beside "Following". Reads the PoV-resolved `trustScores.verifiedFollowerCount` (`?? followers`) from Meili; House PoV default, `?pov=` honored; reuses `VERIFIED_FOLLOWERS_INFLUENCE_CUTOFF`. Pure front-end. | `decisions/profile/0029` | PASS | PR #250 (merge `72f3da87`) |
| **#34** profile-followers-list | `/user/:pubkey/followers` — a verified-followers **table** mirroring the Follows page (#29), + the #33 count is now a **link** to it. New `GET /api/get-grapevine-followers` (inbound `(follower)-[:FOLLOWS]->(observee)`, verified-filtered, owner PoV, 504 deadline); new `BrainstormFollowers.jsx` + `useGrapevineFollowers.js`; whole-set fetch + client 50/page. | `decisions/profile/0030` | PASS | PR #251 (merge `afe6432d`) |

Stories/ADRs/reviews live under `engineering-team/{stories,decisions,reviews}/profile/`. Tests: `test/profile-verified-followers-count.test.js` (6/6), `test/profile-followers-list.test.js` (27/0), Playwright specs under `tests/brainstorm/` (not run — see Problem 5).

**Staging-verified (real data):** the table populates and paginates (jb55 15,221 → 305 pages; fiatjaf 19,443; Jack 22,981 → 460 pages), default sort by verified-followers desc, names hydrate progressively, count→link navigates. Screenshots taken this session.

## Decision still pending

- **Promote to production.** Held this session because Avi's/Vinney's not-for-main work is on staging. When that's sorted, `cycle-prod` promotes `staging → main` (#33 + #34 ride along with everything else on staging — confirm that's intended before promoting).

## Open problems (with recommendations)

1. **Mega-account followers 504.** The inbound traversal for the very largest accounts (~23k+ verified followers) sits right at the 15s Neo4j deadline → **intermittent** 504 (Jack 504'd on one curl at 16.6s, but the browser load succeeded at 22,981). Degrades **gracefully** (clean 504, error state, no crash). **Fix:** raise this endpoint's `NEO4J_QUERY_TIMEOUT_MS`, or add **server-side pagination**, or precompute a queryable verified-followers set. **NOT** lazy name-hydration — that addresses the secondary `/api/profiles` name-storm, not the traversal that times out. (ADR 0030 §Consequences flagged this; staging confirmed it.)
2. **Count-vs-list divergence.** ✅ **RESOLVED (2026-06-08, Story #35 + BIBLE §27).** The profile count (Meili-precomputed, House suffix) read **26,711** for Jack while the live table query returned **22,981** — different effective cutoff + staleness. Fixed by sourcing the profile Verified Followers/Reporters counts from Neo4j (Owner PoV), the same source as the tables, and dropping the broken `?? followers` raw fallback (ADR `profile/0031`); staging-verified badge==table. The underlying cutoff-source inconsistency (#3 below) remains open.
3. **Verified-cutoff inconsistency** (cross-tree): `customers/default/preferences/graperank.conf` live `0.01`; `cypherQueries.js`/`followersWithMetrics.js` in-code fallback `0.05`; BIBLE "threshold consolidation at 0.05"; customer plane `0.01`; the profile UI's TRUST_METRICS text says "Verification Score above a threshold (2 by default)". Pick one source of truth and a clear owner-vs-customer story.
4. **Duplicate "Verified Followers" rows** in `ui/src/pages/BrainstormProfile.jsx` `TRUST_METRICS` — both `followers` (:36) and `verifiedFollowerCount` (:43) render as "Verified Followers" in the Reputation grid. Drop one.
5. **Playwright harness is broken locally/CI-agnostically.** `tests/global-setup.js:16` reads `config.use.baseURL`, but `config.use` is `undefined` in the installed Playwright version → `npm run test:playwright` aborts in global-setup. This blocks **every** e2e spec (#29/#30/#33/#34), which is why none ran this session. Pre-existing; fix is small (read baseURL from `config.projects[0].use` or the env var directly).
6. **Port confusion** — see Clean-ups.

## Deferred feature work (now logged in `engineering-team/stories/_intake.md`)

- **All-followers (unverified) view** — followers table is verified-only in v1 ("verified now, all later").
- **Personalized / customer PoV** for the follows + followers tables — both are owner/House-only v1 (the `NostrUserWotMetricsCard` branch deferred since ADR 0026). Note: the #33 *count* honors `?pov=` but the tables don't yet — a consistency gap.
- **DRY `<GrapevineList>` refactor** — `BrainstormFollowers.jsx` ≈ `BrainstormFollows.jsx` and the two endpoints share shape (the deliberate price of ADR 0030's mirror-not-generalize isolation). Extract a shared component + cypher builder once both are stable.
- **(b) lazy name-hydration** — secondary perf (only the visible page's names) for large tables; distinct from the traversal fix in Problem 1.

## Clean-ups

- **Ports (done this session):** fixed `ui/vite.config.js` dev proxy and the `cycle-local` skill base URL from `:8080` → `:7778`. **Why:** default local `docker compose up` maps host `:80` (nginx) + `:7778` (control panel); **`:8080` only exists after the production remap** (`OPERATIONS.md:251` sed `"80:80"→"127.0.0.1:8080:80"`, applied by CI/CD on the droplets). `:7778` is always mapped locally regardless. CLAUDE.md was already correct. (BIBLE.md:1441's historical changelog entry still says `:8080` — left as-is, historical.)
- **BIBLE (done this session):** added a feature-log entry for #33 + #34.
- **Git identity (operator action):** all commits this session used an auto-derived committer (`clawds4@MacBookPro.home` / `Davids-MacBook-Pro.local`). Set `git config user.name` / `user.email` before further work.
- **Branch pruning (operator action):** `feat/story-33-verified-followers-count` and `feat/story-34-profile-followers-list` are merged to staging and can be deleted (local + origin).
- **BIBLE gap (note):** the #29 follows-list *page* appears undocumented in BIBLE (only the Following count is). Pre-existing.

## Pointers
- PRs: [#250](https://github.com/nous-clawds4/tapestry/pull/250), [#251](https://github.com/nous-clawds4/tapestry/pull/251).
- Key files: `src/api/grapevineInteractions/queries/{follows,followers}WithMetrics.js`; `ui/src/pages/Brainstorm{Follows,Followers,Profile}.jsx`; `ui/src/hooks/useGrapevine{Follows,Followers}.js`.
- Workflow note (this session was the first multi-workflow test): all three harnesses (engineering-team, product-team, protocol-spec) are present after syncing `origin/staging`; the engineering flow ran end-to-end cleanly. One doc nit surfaced: per-epic vs global story numbering is ambiguous between `workflows/1-planning.md` and `epics/profile.md` (we used global; #33/#34).
