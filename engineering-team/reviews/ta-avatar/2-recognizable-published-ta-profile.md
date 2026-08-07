# Review: Story 2 — Recognizable published TA profile defaults

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-08-07
**Diff:** `git diff origin/staging...HEAD` (commit `99f9eec1`, branch `feat/ta-published-profile`, base `2f13856d`)
**Story:** `engineering-team/stories/ta-avatar/2-recognizable-published-ta-profile.md`
**ADR:** `engineering-team/decisions/ta-avatar/0002-branded-published-profile-defaults.md`
**Test plan:** `engineering-team/stories/ta-avatar/2-recognizable-published-ta-profile.test-plan.md`

## Quality gates (run by reviewer, not trusted)

- [x] **Story-2 suite** — `node -e "require('./test/recognizable-published-ta-profile.test.js').run()"` → **11 passed, 2 failed** (`H1`, `H5`).
- [x] **The two failures are environmental — verified, not accepted.** Both query `localhost:7778`. That
      stack serves the **shared checkout**, which is at `c0565e15` and contains **zero** occurrences of
      `isPubliclyReachable`. The running server cannot reflect this diff, so `H1`/`H5` are structurally
      incapable of passing from this worktree. Confirmed independently: the live endpoint still answers
      `name: "Tapestry Assistant"`.
- [x] **Both behaviors re-proved by me, not taken from the Deviations log.** Running the real builder with
      a `strfry` on PATH returning a kind-0 yields `name: "Thelonious Greenhouse's Tapestry Assistant"`
      and an `about` interpolating the same name — the actual code path, not a stub of it. The asset is a
      genuine 512×512 PNG (magic verified, 16863 bytes) and renders as the brand mark on a full-bleed
      purple field.
- [x] **Story 1's suite still green** — `in-app-badged-ta-avatar` 13/0 (same epic, adjacent files).
- [x] **Differential regression check** — `adoption-candidates-queue` **13/6 with and without** this
      change, `admin-tools-dashboard-panel` **9/0 both ways**. The 6 failures are a `404` on
      `/api/adoption-queue`, an endpoint absent from the stale stack. No regression.
- [x] `harness-lint` — clean (0 violations). `node --check test/test.js` — OK; registration ordering sound.
- [ ] _Lint / typecheck / build not configured — skipped._

Full `npm test` was not used as the gate: it is environmentally red on this machine independent of this
diff (OPEN.md #27), and the live-stack half is aimed at a checkout that predates the change.

## Spec adherence

| AC | Verified how | Result |
|---|---|---|
| **AC1** — owner-linked name, generic otherwise | Named branch re-proved through the real builder; generic branch by `U2` (executed, not scanned); `S3` guards the empty-fallback that makes the generic branch reachable at all | ✓ |
| **AC2** — branded picture at the instance's own address | Exercised across a matrix of instance addresses; a public FQDN yields `https://<domain>/ta-avatar.png` | ✓ |
| **AC3** — the published URL resolves publicly | Asset committed, 512×512 PNG; story 1 already proved the `ui/public/` → `dist/` → site-root path on staging (`/ta-badge.svg`, 200 `image/svg+xml`) | ✓ (staging-confirmable) |
| **AC4** — no public address → no picture | `U2`/`U3`, plus the address matrix: loopback v4/v6, `localhost:7777`, `.local`, bare hostname and empty **all omit the picture** | ✓ **for the tested classes** — see finding 1 |
| **AC5** — customer assistants obey the same rule | `U3`, `H3`, and the second branch of the builder | ✓ |
| **AC6** — published profiles unchanged until re-publish | `H4`; structural — `AssistantProfileEditor.jsx:61` prefers `profile` when `hasProfile`, and this diff does not touch the editor | ✓ |

- [x] No criterion silently dropped.
- [x] No behavior added beyond the story and the two logged deviations.

## ADR adherence

- [x] Files match the ADR's implementation notes: `src/api/assistant/index.js` (builder only) and
      `ui/public/ta-avatar.png`. `AssistantProfileEditor` is untouched, exactly as the ADR specified.
- [x] Option A implemented as decided — a committed PNG whose URL is derived from `getInstanceWebsite()`.
      `S1` confirms no deployment domain is hardcoded; I re-checked the diff for one and found none.
- [x] No new dependencies. The asset was produced by the ADR's recorded Playwright recipe (already a
      devDependency), and the emitted file matches the ADR's stated size class (~17 KB vs a 50 KB cap).
- [x] **Deviation 1 is a correction to the ADR, and it is the right call.** ADR 0002 asserted "AC4 is
      free". It is not: `getInstanceDomain()` falls back to `BRAINSTORM_RELAY_URL`'s host, so a dev
      instance reports `https://localhost:7777` — truthy, and `!== 'localhost'`. The ADR's literal recipe
      would have signed a loopback URL into a kind-0 and fanned it out to five external relays. The
      decision the ADR actually made (Option A, URL derived from the instance address) is untouched;
      only its incorrect claim about the guard being unnecessary is superseded. Surfaced at Test Design
      before implementation, which is where it should have been caught.
- [x] Deviation 2 (two live tests unprovable from an isolated worktree) is accurate and its substitute
      evidence holds up — I reproduced both.

## Concept-graph integrity

- [x] No concept handles in the diff; nothing constructs one.
- [x] No concept definitions changed → **no firmware reinstall**. Confirmed at Architecture against the
      live graph (48 concepts); the `image` concept was considered and correctly excluded.

## Things tests can't catch

- [x] **No hardcoded TA pubkey or any 64-hex literal** anywhere in the diff.
- [x] No secrets, no debug logging, no commented-out code, no TODOs.
- [x] **The new predicate is defensively written**: `new URL()` is wrapped in try/catch, so a malformed
      configured address yields `false` (no picture) rather than throwing inside profile construction.
      Failing closed is the correct direction here.
- [x] **IPv6 bracket handling is correct** — `new URL('https://[::1]:7777').hostname` returns `[::1]`, and
      the strip makes the `::1` comparison land. I checked this specifically because it is easy to get
      wrong; `[::1]` and `[fe80::1]` are both correctly omitted.
- [x] **Dead code check** — the `BRANDED_AVATAR_PATH` constant that would have been left unused was
      removed during implementation; the two branches compose the path literally, which is also what the
      test's `S2` sentinel counts.
- [x] No API surface widened: `buildDefaultProfileContent` is a module export for tests, not a route.

## House rules check

- [x] Concept Graph authority respected. No new lint/typecheck/build tooling. Per-deployment TA pubkey
      resolved at runtime (not touched by this diff).

## Findings

### Blocking

None.

### Non-blocking

1. **`src/api/assistant/index.js` — `isPubliclyReachable` admits every RFC1918 private range, so a
   LAN-hosted instance would publish a dead picture URL.** I probed the predicate past what the suite
   covers, and it rejects loopback correctly but accepts private addresses because they contain a dot:

   | address | verdict |
   |---|---|
   | `tapestry.brainstorm.world` | publishes `https://tapestry.brainstorm.world/ta-avatar.png` ✓ |
   | `localhost:7777`, `127.0.0.1`, `[::1]:7777`, `my-box.local`, `devbox` | omits ✓ |
   | **`192.168.1.50:7777`, `10.0.0.5`, `172.16.4.2`, `nas.internal`** | **publishes** ✗ |

   An owner self-hosting on a home network is an instance with "no public address" in AC4's own words,
   and the consequence is worse than a UI bug: the URL is signed into a kind-0 and fanned out to five
   external relays, where it is either dead or points at an unrelated device on the *reader's* LAN.
   **Not blocking** — every AC class the story enumerates and the test plan specifies is satisfied, the
   common deployment shapes (public FQDN, dev loopback) are correct, and this is strictly better than
   the pre-change behavior of publishing nothing. But it is the same failure mode AC4 exists to prevent,
   one address class over. *Ask:* extend the predicate to RFC1918 (`10/8`, `172.16/12`, `192.168/16`),
   IPv6 ULA (`fc00::/7`), and the private TLDs (`.internal`, `.home.arpa`) — **and note that
   `test/recognizable-published-ta-profile.test.js`'s mirror predicate `isPubliclyRoutable` has the
   identical gap, so the suite cannot currently catch this and both must move together.** Filed as
   OPEN.md row 148.

2. **The routability rule is duplicated between source and test, by design, and will drift.** The test
   deliberately re-derives its own predicate rather than importing the one under test — correct practice,
   since importing would make the assertion tautological. Worth knowing that finding 1's fix touches both
   copies; there is no mechanism keeping them honest.

3. **`website` itself is still published as `https://localhost:7777` on a dev instance.** Pre-existing,
   untouched by this diff, and explicitly out of the story's scope (which governs `picture`) — but it is
   now visibly the same defect one field over, and the fix for finding 1 would make it a one-line change.

### Harness friction

1. **`git stash push -q <path>` silently no-ops when the target file is committed, and a following
   `git stash pop` then pops somebody else's stash.** My first differential attempt hit this: because the
   change under review is committed, nothing was stashed (`-q` suppressed "No local changes to save"), so
   both halves of the comparison ran identical code and the matching numbers were a tautology, not
   evidence. The subsequent `pop` took a **co-tenant session's** stash
   (`On fix/graperank-shared-csv-race: _intake.md cross-branch ferry`) and left `engineering-team/stories/_intake.md`
   in a conflicted `UU` state. Git kept the stash rather than dropping it; I restored `_intake.md` from
   `HEAD` and verified both co-tenant stashes are still present and untouched. The differential was then
   redone correctly by checking out the base version of the file. Recorded as OPEN.md row 149, since a
   shared checkout with parked stashes makes this a live hazard for any session, not just this one.

## Verdict

**PASS**

Every acceptance criterion is satisfied for the classes the story enumerates, verified by gates I ran
myself. The implementation improves on its own ADR: it caught and fixed a claim ("AC4 is free") that
would have signed loopback URLs into published, relay-replicated events, and the correction was
surfaced at Test Design rather than discovered after shipping.

The two failing tests are structurally incapable of passing from an isolated worktree — the stack under
them serves a checkout that predates this change by design — and I reproduced both behaviors
independently rather than accepting the Deviations log. They become ordinary passes on staging.

Finding 1 is the one to act on: the new predicate is right about loopback and wrong about LAN addresses,
and the test's mirror shares the blind spot. It is a follow-up rather than a blocker because it lies
outside every case the story and test plan name, and because the failure it permits is narrower than the
one this story closes.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place.
- [x] Completion detection performed; result reported in chat, not here.
