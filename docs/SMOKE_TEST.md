# Smoke Test Procedure

> **Audience:** AI agents (Claude Code, etc.) running the deploy cycles for this repo, plus human operators who want to know what the slash-command-driven verification actually checks.
>
> **Purpose:** A single canonical definition of "smoke-tested clean" so the four `/cycle-*` slash commands don't each carry their own variant. When a new gotcha is discovered, update this file and every cycle inherits.

**Last updated:** 2026-09-19

---

## What the smoke test consists of

The smoke test runs after a deploy completes (or after a local rebuild) to confirm the change shipped correctly and didn't regress something nearby. It's organized in five tiers — earlier tiers always run, later tiers depend on what the change touched.

**Precondition for staging and production:** the deploy run *for the merge commit* was located by SHA and watched to completion (cycle skills step 6). A smoke test started without a watched run tests whatever container is up — usually the previous one — and tiers 1–2 pass against it (OPEN.md row 251, 2026-09-10).

### Tier 1 — Pipeline readiness (always)

For staging and production deploys only — skip for local. The deploy workflow exits as soon as `docker compose up -d --build` returns the container, but the brainstorm Express process inside takes another 5–30 seconds to bind. nginx returns 502 in that window. See [OPERATIONS.md §9.5](../OPERATIONS.md) for the underlying mechanism.

**Recipe:** poll a real upstream API endpoint (not just `/`, which can flicker between cached static-shell 200s and upstream 502s) until 3 consecutive 200s. Then settle 4–5 seconds. (Earlier revisions warned the process "can briefly cycle once more after first appearing stable"; that reading is withdrawn — the post-stability 502s seen on #88 and later were the OPEN.md row 325 crash, now fixed. The Neo4j-readiness gate below is what actually prevented them.)

```bash
H=https://staging.brainstorm.world  # or https://tapestry.brainstorm.world
PK=04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9
streak=0
attempts=0
until [ $streak -ge 3 ] || [ $attempts -ge 90 ]; do
  attempts=$((attempts+1))
  code=$(curl -s -o /dev/null -w '%{http_code}' "$H/api/get-user-counts?pubkey=$PK")
  if [ "$code" = "200" ]; then streak=$((streak+1)); else streak=0; fi
  sleep 2
done
echo "Stable after ${attempts}x2s polls"
sleep 5
```

If any later tier returns a 502, re-run the Tier 1 poll and repeat that tier from the top rather than a single per-request retry (OPEN.md row 251). Historically a 502 window could also open *after* the poll's 3×200 and mid-later-tier (the 2026-09-10 production deploy; #88); that was the row 325 crash — a `get-user-data` call into an unready Neo4j killing the Express process — diagnosed and fixed 2026-09-19. The Neo4j-readiness gate below is what closes that window; the repeat-the-tier rule stays as cheap defence against any other flicker.

**Neo4j-readiness gate — HTTP readiness ≠ Neo4j readiness.** Neo4j inside the container binds slower than the Express upstream (it was answering ~40 s after the container started on the production deploy where it was timed), and the Tier 1 poll endpoint answers `followingCount` from strfry, so it 200s before Neo4j is up. **Do not fire any Cypher-backed call until Neo4j is answering:** poll `get-user-counts` until `verifiedFollowerCount` is non-null on 3 consecutive polls — it returns `null` while Neo4j is down (timeout/`ECONNREFUSED …:7687`) and a number once it is up. This gate is not a nicety: before the row 325 fix, a `get-user-data` call into an unready Neo4j crashed the whole Express process. It stays after the fix because it also prevents false failures on every other Neo4j-backed check.

```bash
# after the 3×200 Tier 1 poll — hold until Neo4j answers
streak=0; attempts=0
until [ $streak -ge 3 ] || [ $attempts -ge 90 ]; do
  attempts=$((attempts+1))
  vfc=$(curl -s -m 20 "$H/api/get-user-counts?pubkey=$PK" | jq -r '.data.verifiedFollowerCount // "null"')
  if [ "$vfc" != "null" ] && [ -n "$vfc" ]; then streak=$((streak+1)); else streak=0; fi
  sleep 2
done
echo "Neo4j-ready after ${attempts}x2s polls (verifiedFollowerCount=$vfc)"
```

### Tier 2 — Sanity reachability (always)

Confirm the basic surface area is up. All should HTTP 200:

- **Pages:** `/`, `/user/<some-pubkey>`, `/tapestry`, `/tapestry/concepts`, `/tapestry/settings`, `/developers`, `/about`.
- **Public APIs:** `/api/get-user-data?pubkey=<pk>`, `/api/get-user-counts?pubkey=<pk>`, `/api/owner/pubkey`, `/api/relays`, `/api/auth/status`.
- **Search regression:** `/api/search/profiles/meili?q=jack&limit=2` → 200 with non-zero hits.

A "known-active" pubkey for the parameter-bearing tests: `04c915daefee38317fa734444acee390a8269fe5810b2241e5e6dd343dfbecc9` (Odell).

**Known gotcha (until story #6 lands):** `/api/get-user-data?pubkey=<large-graph-pk>` is expected to return **HTTP 504 with `{"success":false, "message":"Neo4j query timeout…"}`** in ~16s, not 200. A large-enough follow graph makes the current unbounded Cypher in `src/api/export/users/queries/userdata.js` exceed the per-query `NEO4J_QUERY_TIMEOUT_MS` deadline (story #5 added the deadline; story #6 will rewrite the Cypher to use bounded `size(...)` pattern expressions). This started with Jack; **as of 2026-07-24 the Odell pubkey above is in the same class on both staging and prod** (identical 504-in-~16s, self-describing JSON body) — so a Tier-5 sweep using Odell should expect 504 here, not 200. For these pubkeys on this endpoint, a 504 with a JSON body is the **expected** smoke-test outcome — a hang, a 502, or a bare `000` at a client timeout ≥45s is the real regression to flag (a `000` at a short client timeout like `-m 15` just means you raced the server's ~16s answer — retry with `-m 45`). Other endpoints for these pubkeys (like `/api/get-user-counts`) should still 200 normally.

### Tier 3 — PR-specific (depends on what changed)

These are the checks that prove the actual change shipped, not just that the system is up. The cycle-* skills should pick the appropriate ones based on what's in the diff:

- **New API endpoint?** Hit it; verify response shape (success flag, expected keys).
- **API endpoint behavior changed?** Hit it; verify the new behavior is in effect (e.g., new field present, threshold changed).
- **UI shipped?** Inspect the served JS bundle:
  ```bash
  JS=$(curl -s "$H/" | grep -oE 'index-[A-Za-z0-9_-]+\.js' | head -1)
  curl -s "$H/assets/$JS" | grep -oc 'expected-new-string'  # should match
  curl -s "$H/assets/$JS" | grep -oc 'expected-removed-string'  # should be 0
  ```
  Also assert the bundle **changed**: the `index-<hash>.js` name served before the merge (or by the previous deploy) must differ after it. A UI change served under the pre-merge hash means the old container is still answering — the deploy hasn't landed, or the wrong run was watched (OPEN.md row 251). Docs-only merges rebuild the same bundle; there the hash staying the same is the expected result.
- **Server config changed?** If the change is a Cypher query, env var, or conf file, hit an endpoint that exercises it and verify the value resolved correctly (we've done this for threshold consolidation by checking the description text returned).

### Tier 4 — Chrome visual (whenever a UI page changed)

When the change involves `ui/src/**/*` files, do a visual pass via the `mcp__Claude_in_Chrome__*` tools:

1. `tabs_context_mcp` — get the active tab.
2. `navigate` to a page the PR touches.
3. `read_console_messages` with `onlyErrors: true` and a permissive pattern (`.*`) — should be empty.
4. `get_page_text` — verify expected substrings are present, removed substrings are absent.
5. For auth-gated routes, the page text differs based on the user's signed-in state. Don't assume — read what's there.

If the Chrome extension isn't connected, surface this as a noted gap in the report. Don't block on it.

### Tier 5 — Regression sweep (always, lightweight)

After verifying the change worked, hit one or two endpoints adjacent to the change that you'd expect to be unaffected. Confirm they still 200 and behave normally. Examples:

- Change touched `/api/get-user-data` → also hit `/api/get-user-counts`.
- Change touched `/tapestry/settings` → also hit `/tapestry`.
- Change touched session/auth → call `/api/auth/status` and confirm an existing signed-in session still works.

This catches the easy-to-miss "we broke a neighboring thing" regression class.

---

## Limits / what the smoke test doesn't cover

- **Authenticated-only endpoints** (Settings page contents, owner-only API writes) — tested only when the user has signed in via NIP-07. The MCP browser tool can't trigger NIP-07 sign-in interactively.
- **Throughput / load / soak** — these are correctness smoke tests, not performance.
- **Data-correctness across batch-recomputed properties** — e.g., `verifiedFollowerCount` on `NostrUser` nodes carries the previous threshold's values until the next batch run. Smoke tests confirm code paths, not data freshness.
- **Cross-deploy session persistence** (the SESSION_SECRET / Redis story) — verified by sign-in-then-deploy-then-check-still-signed-in, which requires user action; smoke tests note the current auth state but don't synthesize this loop themselves.

---

## Reporting

After running the tiers above, the cycle command should produce a tight report:

- **Status header:** ✅ clean / ⚠️ regressions / ❌ failed
- **Pipeline timing:** deploy duration, stability poll latency
- **Tier 2 sanity:** one-line confirmation or list of failures
- **Tier 3 PR-specific:** the actual proof the change took effect
- **Tier 4 Chrome:** confirmation of console-clean + visual check, OR a noted gap if Chrome wasn't reachable
- **Tier 5 regression:** one-line confirmation
- **Known limits:** anything the smoke test couldn't cover

Keep reports tight. The user is reading them after a sequence of these in a row.
