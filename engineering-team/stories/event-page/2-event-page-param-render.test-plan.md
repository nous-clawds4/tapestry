# Test Plan: Story event-page #2 — `/event` page (param render)

**Story:** `engineering-team/stories/event-page/2-event-page-param-render.md`
**ADR:** `engineering-team/decisions/event-page/0002-event-page-ui.md`
**Date:** 2026-06-18
**Test file:** `test/event-page-ui.test.js` (shared with Story #3; wired into `test/test.js`)

## Scope
Covers **Story #2** — the URL-parameter path of the `/event` page: precedence parsing, invalid-vs-unsupported, `naddr`-as-unsupported-kind, and rendering the resolved event/outcome. The shared decode core (`eventParam.js`) and the hook are tested here; the search fallback is Story #3 (same file).

## Test level
The **decode/precedence/classify core is a pure `ui/src/utils/eventParam.js`** — plain JS + `nip19`, so it is **EXECUTED** in the Node runner via dynamic import (the pattern `nostrEntities` uses in `live-feed-feed-page.test.js` T20–T23), with **nip19-minted, self-validating fixtures**. The React page/hook are asserted at **source** level (no JSX transpile), anchored on the pure exported `renderResolvedEvent` + module-level `EVENT_COPY`. Rendered confirmation is the **staging** capstone.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| **precedence** | `U1` multiple valid → first by ORDER (nevent>id) | execute |
| **invalid vs unsupported** | `U2` malformed supported → flagged; unknown name → ignored; first valid still wins | execute |
| **decode 6 formats** | `U3` nevent/id/pubkey/npub/nprofile → fetch targets; naddr → naddrUnsupported+kind | execute |
| **render + statuses** | `U5` page renders kind-1 via `<NoteCard>`; branches OK/UNSUPPORTED_KIND/INVALID_EVENT/NOT_FOUND/NO_AUTHOR_NOTE | source |
| **naddr + no-target** | `U6` naddr → unsupported-kind branch; no target → `<EventSearch>`; uses resolveEventParams + useEventResolve | source |
| **testability** | `U7` `renderResolvedEvent` named-exported + pure | source |
| **copy** | `U9` EVENT_COPY has the outcome messages | source |
| **hook** | `U10` `useEventResolve` fetches /api/event, returns {data,loading,error}, aborts, gates on success | source |
| regression | `R1` /event route still → BrainstormEvent; `R2` NoteCard reused as-is | regression |

## Edge cases
- [x] Higher-precedence malformed + lower-precedence valid → valid wins, malformed flagged (U2).
- [x] `naddr` resolved with no network (kind from the coordinate) (U3/U6).
- [x] Every read-path status has a render branch (U5); the pure helper has no fetch/hook/router/globals (U7).

### Deliberately NOT covered here
- The read/fetch/verify/relay logic (Story #1).
- The search field's submit/notice flow (Story #3, U4/U8 in the same file).
- Rendered DOM — the **staging** capstone (the reference `nevent`, an author lookup, an `naddr`).

## Test infrastructure
Node runner; `eventParam.js` dynamically imported (ESM + `nip19`); React files source-asserted (`safeRead` + a `helperBody` slicer). No live services, no JSX transpile, no new tooling.

## How to run
```
npm test
# or: node -e "require('./test/event-page-ui.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification
Fails with current code — `eventParam.js`, `useEventResolve.js`, and the reworked `BrainstormEvent.jsx` don't exist yet (U-tests fail "feature not implemented"); R1/R2 PASS (the /event route + NoteCard are present, unmodified). Confirmed 2026-06-18 (isolated run: 2 pass / 10 fail across the shared UI file). Output in the gate summary.
