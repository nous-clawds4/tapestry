# Bug: Users page calls the removed `run-query` endpoint (Neo4j user list broken)

**Type:** Bug (regression) · **Strictness:** Standard, fast-track (Architecture skipped — obvious) · **Status:** Done
**Opened:** 2026-07-20 · **Origin:** `security-auth-exposure` book prelude (the `run-query` deletion)

## Context

`GET /api/neo4j/run-query` was deleted 2026-07-19 — the security prelude to the `security-auth-exposure` book (it was an unauthenticated RCE + credential leak). The deletion shipped to staging, prod, and `feat/tags`. But the **Users page** (`ui/src/pages/users/Index.jsx`, routed at `/users` — `ui/src/App.jsx:312`) still `fetch`es that endpoint **on mount** to list `NostrUser` pubkeys. Verified live: `GET /api/neo4j/run-query` → **HTTP 404 on staging**. So the page's Neo4j-sourced user list is broken on all three instances. Before the deletion it worked. No other `ui/src` file calls the endpoint (grep-verified).

The prelude deleted the route + server handler but did not grep for **client** callers, and the book's live UI verification checked the concepts pages, not `/users` — so this caller was missed.

## Fix

The replacement `POST /api/neo4j/query` returns `cypherResults` in the **identical CSV shape** (verified live: `{success, data, cypherResults}`), so it is a near-drop-in: swap the GET for a POST with a `{ cypher }` JSON body; the existing `neo4jRes.cypherResults` parse (Index.jsx:40) is unchanged. The query is a read (`MATCH (u:NostrUser) RETURN …`), so no owner/auth gate applies — it works for any viewer.

## Acceptance criteria

1. `ui/src/pages/users/Index.jsx` no longer references `/api/neo4j/run-query`; it POSTs a `{ cypher }` body to `/api/neo4j/query`.
2. **Regression guard (whole class):** no file under `ui/src` references the removed `run-query` endpoint.
3. `npm test` passes (the new guard suite is green; no regressions).
4. Post-deploy: the Users page's Neo4j user list populates on a deployed instance (manual/live check).

## Out of scope

- The stale server-side *comments* in `src/firmware/install.js` that name the old endpoint (reworded opportunistically alongside the fix; no behavior change).
- Any change to the `/api/neo4j/query` endpoint itself.

## Linked artifacts

- Tests: `test/users-page-neo4j-endpoint.test.js`
- Review: `engineering-team/reviews/users-page-run-query-regression.md`
