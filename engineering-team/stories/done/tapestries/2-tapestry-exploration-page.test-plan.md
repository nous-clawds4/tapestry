# Test Plan: Story 2 — Tapestry Exploration page

**Story:** `engineering-team/stories/tapestries/2-tapestry-exploration-page.md`
**ADR:** `engineering-team/decisions/tapestries/0002-exploration-page-as-authored-rendering.md`
**Date:** 2026-07-23

## Coverage map

All tests live in one Playwright spec: `tests/brainstorm/tapestry-exploration.spec.js`.

| Criterion | Test name | Level |
|---|---|---|
| AC-1 (concept sidebar + integration graph + integration tables + JSON viewer; no install/version/constraints) | `AC-1: shows concept sidebar + integration graph + integration tables + JSON viewer, and no install/version/constraints` | e2e (Playwright) |
| AC-2 (authored integrations: enumerates dog.breed; elements irish-setter/golden-retriever; subsets under dog) | `AC-2: the authored integrations render (…)` | e2e |
| AC-3 (imports resolved → composed spine) | `AC-3: resolving the 4 imports composes the IS_THE_CONCEPT_FOR spine — the graph reports more than 5 edges` | e2e |
| AC-4 (graceful degradation on missing/malformed graph) | `AC-4: an element with no graph block degrades gracefully (notice, no crash)` | e2e |
| AC-5 (resolves by uuid / a-tag coordinate) | `AC-5: the page resolves the tapestry by its uuid (a-tag coordinate)` | e2e |

## Edge cases
- [x] **Missing `graph` block** — AC-4 stubs an element with only a `tapestry` block (no `graph`) → the page shows the title + a degradation notice, no crash.
- [x] **Import resolution is real, not author-redundant** — AC-3 relies on the fact that the `IS_THE_CONCEPT_FOR` spine exists **only** in the imported concept-graphs, never in the element's own 5 relationships; so a composed edge count > 5 proves the 4 imports were fetched and merged.
- [x] **uuid identity** — AC-5 asserts the exploration renders for the a-tag-coordinate URL (not a volatile event id), tying uuid-resolution to exploration content (so it fails against the Story-1 title-only placeholder).
- Not asserted (deferred to Story-2 scope / future): transitive import expansion; POV filtering.

## Test infrastructure
- **Framework:** Playwright (`tests/brainstorm/*.spec.js`, `playwright.config.js`, baseURL `http://localhost:7778`). Skip-guard on `BRAINSTORM_SERVER_ACCESSIBLE` (set by `tests/global-setup.js` when the stack is reachable).
- **Network mocks — the whole pipeline is stubbed via `/api/strfry/scan`.** The page reads the element and each `graph.imports` entry by `queryRelay({kinds:[39999], authors:[pubkey], "#d":[dTag]})`. The stub **dispatches by matching the fixture d-tag as a substring of the request URL**, not by parsing the `filter` param — because the encoded `#d` round-trips through the browser as a URL *fragment* and is dropped by `URLSearchParams` (verified during test bring-up; the node round-trip parses fine, but Playwright's `request().url()` surfaces the `#` unencoded). Fixtures: the seed element's full graph block (9 nodes / 3 relTypes / 5 rels / 4 imports) + a small `graph` block per imported concept-graph (header + superset + one `IS_THE_CONCEPT_FOR` edge). Also stubs `/api/assistant/pubkey` + `/api/auth/user-classification` (guest).
- **Why no node unit tests for `tapestryGraphModel.js`:** the ADR specifies pure, React-free model helpers (compose/dedup/normalize/infer). The node runner (`test/test.js`) is **CommonJS**; `ui/` is **ESM** — existing tests only *text-scan* ui source, never execute it, and wiring a new suite requires the shared-runner registration ritual. That logic is instead exercised **end-to-end through the DOM**: the integration tables, the graph edge count, and the sidebar are all computed *from* those helpers, so a bug in compose/normalize/type-inference surfaces as wrong/missing rows or an incorrect edge count. Kept Playwright-only, consistent with Story 1.
- **Preconditions:** stack reachable at `:7778`; `npx playwright install chromium` (done in Story 1); **the app is served from a built `dist/` bundle**, so the Implementer must **rebuild the UI** (`vite build`) after coding for the exploration page to appear — only then do these pass.
- **Firmware / graph state:** none — every data endpoint the assertions depend on is stubbed.

## How to run

```
npx playwright test tests/brainstorm/tapestry-exploration.spec.js --project=chromium
```

## Verification
The new tests fail against the current build (only the Story-1 placeholder `TapestryDetail` exists). Confirmed 2026-07-23 at commit `b6b73c5f` — all 5 fail because the exploration views are absent (the stub correctly serves the element, so the title resolves; the failures are the missing exploration content, not stub/import errors):

```
AC-1 → getByText('dog breed').first()                       not found   (concept sidebar / member concepts absent)
AC-2 → clicking the Elements/Enumerations/Subsets views      no such control (integration tables absent)
AC-3 → getByText(/\d+ edges/i)                               not found   (integration graph absent)
AC-4 → getByText(/no graph|nothing to explore|…/i).first()   not found   (degradation notice absent; title DOES resolve)
AC-5 → getByText('dog breed').first()                        not found   (exploration content absent for the uuid)

5 failed
```
