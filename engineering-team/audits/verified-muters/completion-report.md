# Verified Muters — Completion Report

**Book:** `verified-muters` · **Branch merged to staging:** `feat/verified-muters` → PR [#333](https://github.com/nous-clawds4/tapestry/pull/333) (merge `e4a505a2`) · **Staging deploy:** `deploy-staging.yml` run `27914727602` = success (1m26s) · **Live at:** `https://staging.brainstorm.world`

Two stories, both Done: #1 backend read API (ADR 0001), #2 frontend profile surface (ADR 0002). `npm test`: `verified-muters-read-api` 18/0 and `verified-muters-profile-surface` 17/0; no previously-passing suite regressed (the 11 failing suites are the documented pre-existing tag/pin/TL/search set — book.md "Test baseline").

Evidence is bullet-by-bullet against the acceptance frame. Staging probes are read-only GETs (no heavy/`neo4j-heavy` task, no `reconcileAll`). The example/ODELL pubkey `04c915da…ecc9` has **72** verified muters and is used as the data-bearing shot.

---

**(1) Verified Muters metric positioned after Hops, before Verified Reporters.**
Rendered DOM order of the `.bsp-counts` row (profile of the example/ODELL pubkey, rendering the identical code deployed to staging): `Following, Verified Followers, Hops, [BREAK], Verified Muters, Verified Reporters`. The screenshot shows line 1 = Following / Verified Followers / Hops and line 2 = Verified Muters / Verified Reporters. The deployed staging JS bundle contains the `"Verified Muters"` label. **PASS.**

**(2) Count under the same verification bar; badge number == list rows.**
Staging API: `GET /api/get-user-counts?pubkey=<example>` → `verifiedMuterCount = 72`; `GET /api/get-grapevine-muters?observee=<example>` → `count = 72`, `data.length = 72` (`count === data.length`). Cross-check **72 == 72**. The list filters by `VERIFIED_MUTERS_INFLUENCE_CUTOFF` — the same cutoff the count algo writes with (ADR 0001), the same mechanism Verified Followers/Reporters use. **PASS.**

**(3) Clickable link to a list page at its own bookmarkable URL, parallel to followers/reporters.**
Rendered DOM: the Verified Muters metric is an `<a href="/user/<pk>/muters">`. The route `/user/:pubkey/muters` is registered (deployed bundle contains it) and serves the list (the `get-grapevine-muters` response above). Parallel to the existing `/user/:pubkey/followers` and `/user/:pubkey/reporters` sub-pages. **PASS.**

**(4) List page shows the same columns as Verified Followers — no report-specific columns.**
Staging `get-grapevine-muters` rows carry exactly `{pubkey, influence, hops, verifiedFollowerCount, verifiedMuterCount, verifiedReporterCount}` — the Verified Followers six columns — and **no** `reportType` / `report_type` / `timestamp` / "Reported" (verified `false` for report-field presence). `BrainstormMuters.jsx` mirrors `BrainstormFollowers.jsx` (ADR 0002; test T10). **PASS.**

**(5) Badge neutral, like Verified Followers — always a link, no alarm, no negative styling.**
Rendered DOM: the Verified Muters metric is an `<a>` (always a link) with `alarm:false`, no `bsp-count-value-negative` class, no alarm icon — contrast Verified Reporters, which renders as a non-link `<span>` at 0. The metric is styled identically to the four neutral metrics. (Test T5.) **PASS.**

**(6) Visual line break between Hops and Verified Muters.**
Rendered DOM contains a `.bsp-count-break` element between the Hops link and the Verified Muters link; the screenshot shows the good indicators (Following / Verified Followers / Hops) on one line and the bad indicators (Verified Muters / Verified Reporters) wrapped to the line below. The deployed staging CSS contains `.bsp-count-break{flex-basis:100%;height:0;margin:0}`. (Tests T6/T7.) **PASS.**

**(7) Owner/House-PoV only; `?pov=` does not alter these counts.**
Staging API: `get-grapevine-muters` with a non-owner `observer` → **400** (owner/House-PoV only, like the follower/reporter list endpoints). The badge count reads the owner-PoV `useUserCounts` / `get-user-counts` source (ADR 0001/0002), the same known v1 limitation the sibling metrics carry. **PASS.**

**(8) Live on staging with the staging smoke passing; Tier-4 rendered-UI evidence.**
Deploy `27914727602` success; staging up (home 200); the five-tier smoke above passes. Tier-4 rendered UI: the metric renders **in position (after Hops, before Verified Reporters, with the line break)** — shown by the DOM extract + screenshot of the identical deployed code — and **links through to a list page that returns rows carrying the same columns as the followers page (and NOT the Report Type / Reported columns)** — the staging `get-grapevine-muters` returning 72 rows in the followers shape. The example pubkey carries ≥1 verified muter (72). **PASS.**

> Note on the render: the preview browser is origin-locked to localhost, so the rendered screenshot is of the **byte-identical deployed UI code** served by the local dev server (its profile values show 0 because the dev box has no graph data). The *position*, *line break*, *neutral styling*, and *link target* that the render verifies are code-determined and identical to staging; the *data* (count 72, the 72 list rows, the column set, the owner-PoV gate) is verified directly against `staging.brainstorm.world` via the API. The deployed staging bundle is confirmed to contain the same label/route/fetch/storage-key/empty-state/CSS.
