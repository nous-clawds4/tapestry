# Review: Story 2 — Tapestry Exploration page

**Reviewer:** Claude (acting as Reviewer) + independent reviewer subagent (per OPEN.md #80(b), main session implemented)
**Date:** 2026-07-23
**Diff:** `git diff origin/staging...HEAD` (impl commit `7257c137`)

## Quality gates (run by reviewer, not trusted)

- [x] `npm run test:playwright` — **5/5 PASS** (19.1s), reviewer-run: `npx playwright test tests/brainstorm/tapestry-exploration.spec.js --project=chromium`. Covers AC-1..5.
- [~] `npm test` (node `test/test.js`) — **not run as a gate.** The diff is UI-only (React pages/hook/model under `ui/src/pages/tapestries/`); it exercises none of the CJS node suite, which is also environmentally-failing locally (OPEN.md #27/#69). No regression surface from this diff.
- [x] _Lint / typecheck / build not configured — skipped as gates._ (`vite build` succeeds; `dist/` gitignored, rebuilt in CI.)

## Spec adherence
- [x] Every AC has a passing test: AC-1 `spec.js:145`, AC-2 `:171`, AC-3 `:193`, AC-4 `:210`, AC-5 `:223`.
- [x] No criterion dropped; no behavior beyond the story (see Scope).

## ADR adherence (tapestries/0002)
- [x] **Imports resolved via strfry `queryRelay`**, not the Neo4j concept-graph API — `useTapestryGraph.js:19-24` (`readByUuid`), imports at `:62-69`. Grep confirms **zero** `/api/concept-graph` / `neo4j` usage in `ui/src/pages/tapestries/`.
- [x] Element read is strfry (same path). **No hardcoded TA pubkey** — pubkey derives from the uuid via `parseUuid` (`useTapestryGraph.js:6-12`); imports use `imp.uuid`. No 64-hex literal in source (the spec literal is a fixture).
- [x] **Node type inferred** (`tapestryGraphModel.js:32-38`), consumed at `TapestryIntegrationGraph.jsx:41` / `TapestryDetail.jsx:118`. **Rel types normalized to aliases** (`toAlias` + `CANONICAL_RELS`, `:20-25,8-12`).
- [x] **Labels from `node.name`** (`TapestryIntegrationGraph.jsx:40`) — the "dog-breedss" plural bug is not reproduced.
- [x] **Cleanup uses the outer effect return only** (`TapestryIntegrationGraph.jsx:122-125`), guarded by a `destroyed` flag — the Firmware Explorer's dead inner-return is not reproduced.
- [x] **One-level resolution** (no recursion into nested imports). **`ConceptMembersView` correctly not reused.** **No new dependencies** (`package.json` unchanged; vis-network already bundled).
- [x] `composeGraph` dedup (nodes by slug; rels by `from|alias|to`; relTypes unioned) and `groupRelationships` bucketing verified correct, including the 0-imports and degraded cases.

## Concept-graph integrity
- [x] Handles constructed at runtime from the uuid; no concept definitions changed → **no firmware reinstall required**.
- [x] Reads events from strfry via `queryRelay`; does not re-derive from BIBLE.md or depend on Neo4j.

## Things tests can't catch
- [x] Async cancellation correct — `cancelled` checked after both awaits and in the catch (`useTapestryGraph.js:45,70,76`); no setState-after-unmount (StrictMode-safe).
- [x] Failed/absent imports skipped, not fatal (`:64-72`). `degraded` on valid-event-but-missing-graph (`:56`); `notFound` on absent element (`:47`); malformed JSON caught (`jsonTag`, `:15`); `parseUuid` preserves d-tag colons (`:9-11`).
- [x] No secrets / `console.log` / dead code in the new source (grep clean). Scope confined to `ui/src/pages/tapestries/` + the spec.

## House rules check
- [x] Concept Graph API authority respected (read-only; strfry source). No new lint/typecheck/build tooling.

## Product-guide adherence
- N/A — no PRD.

## Findings

### Blocking
None.

### Non-blocking
1. **`tests/brainstorm/tapestry-exploration.spec.js:178-179,187-188`** — AC-2's Elements/Subsets assertions (`/irish setter/i`, `/golden retriever/i`) are not scoped to the content table, so they can be satisfied by the sidebar member-concept buttons that render the same names. The AC is still genuinely covered (the Enumerations check on `dog.breed` is table-specific — that node isn't in the sidebar — and AC-3's edge count independently proves composition), so this is a redundancy gap, not an uncovered AC. Suggestion: scope those locators to `.data-table` on next touch. (Swept to OPEN.md.)
2. **`tapestryGraphModel.js:20-25`** — `toAlias` prefers a declared `alias`, then the canonical table, then pass-through. If a future imported graph declared a `relationshipTypes` entry keyed by an alias-form slug with a *different* alias, the declared value would win. Benign for current fixtures/seed; consistent with the ADR. No change needed.
3. **`useTapestryGraph.js:43`** — the leading `setState((s) => ({ ...s, loading: true }))` is redundant with the initial `loading:true` on first mount (only meaningful on uuid change). Harmless. No change needed.

### Harness friction
None (the `tapestries` book anchor was opened at the Story-1 review).

## Verdict
**PASS** — the diff matches the story, conforms to ADR 0002, all acceptance criteria pass, and the quality gates are clean. Non-blocking findings only.

## On PASS (same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/tapestries/2-tapestry-exploration-page.md`).
- [x] Completion detection: both `tapestries` stories are now **Done** → the book (read-only browse + explore skeleton) **looks complete**. `/close-book` **offered** to the operator (not auto-run).
