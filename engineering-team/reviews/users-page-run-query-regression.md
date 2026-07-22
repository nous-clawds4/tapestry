# Review: Users page calls the removed `run-query` endpoint (regression fix)

**Story:** `engineering-team/stories/users-page-run-query-regression.md`
**Type:** Bug (regression), fast-track (Architecture skipped — obvious). No ADR.
**Diff reviewed:** `ui/src/pages/users/Index.jsx`, `src/firmware/install.js` (comments), `test/users-page-neo4j-endpoint.test.js` (new), `test/test.js` (registration), the story.
**Verdict:** **PASS**

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| 1 — Index.jsx POSTs `{cypher}` to `/api/neo4j/query`, not the GET run-query | ✅ | `Index.jsx:29` now `fetch('/api/neo4j/query', {method:'POST', … body: JSON.stringify({cypher})})`; the `neo4jRes.cypherResults` parse below is unchanged. AC-1 guard green. |
| 2 — no `ui/src` file references the removed endpoint (whole class) | ✅ | AC-2 guard scans all `ui/src/**/*.{js,jsx}`; green. Pre-fix it named `Index.jsx` (sole caller, grep-confirmed); post-fix zero. |
| 3 — `npm test` passes, no regressions | ✅ | Overall **PASS**; the guard is in `test.js`'s **live** `overallOk` chain (`usersPageNeo4jEndpointResult.fail === 0`, before the OPEN.md #43 severed terminator), so PASS entails the guard passed. All other suites 0-failed. |
| 4 — Users page Neo4j list populates on a deployed instance | ⏳ deferred to deploy | Cannot verify pre-deploy; the deploy chain's smoke covers it (Tier-3 PR-specific). |

## Correctness

- **Works unauthenticated (public browsing).** The replacement is a POST, but `/api/neo4j/query` is on the security layer's `PUBLIC_MUTATIONS` allowlist, and the handler only owner-gates *write* Cypher (`WRITE_KEYWORDS`). This query is a read (`MATCH (u:NostrUser) RETURN …`), so it passes for any viewer. Confirmed live 2026-07-20: an unauthenticated POST returned `{success, data, cypherResults}` with the `pubkey\n"…"` CSV.
- **Shape preserved.** The new endpoint returns `cypherResults` in the identical CSV shape the page already parses — verified live — so the swap is behavior-preserving downstream.
- **Deploy takes effect.** `ui/src` is rebuilt by the Dockerfile's `npm run build` on every deploy; `dist/` is gitignored, so no built artifact to update.
- **`install.js` comments** reworded only (no behavior change); they do not trip the security suites' `install.js` source-sentinel (which targets `x-forwarded-for`, not these comments) — full suite PASS confirms.

## Notes

- **Regression class institutionalized.** AC-2 guards *any* future `ui/src` caller of a removed endpoint — the mitigation for the miss recorded in the security book's audit §7.
- No other callers server- or client-side (`src/api/index.js:254` is a removal comment; `openapi.yaml` entry removed in the doc bundle).
