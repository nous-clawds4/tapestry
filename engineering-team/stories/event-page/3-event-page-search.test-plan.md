# Test Plan: Story event-page #3 — `/event` page (search fallback)

**Story:** `engineering-team/stories/event-page/3-event-page-search.md`
**ADR:** `engineering-team/decisions/event-page/0002-event-page-ui.md`
**Date:** 2026-06-18
**Test file:** `test/event-page-ui.test.js` (shared with Story #2; wired into `test/test.js`)

## Scope
Covers **Story #3** — the no-parameter search fallback: the `classifyEventInput` core, and the `EventSearch` field that resolves a pasted string by navigating to the canonical URL param (or shows a "not recognized" notice). Shown only when no valid parameter is present.

## Test level
`classifyEventInput` lives in the pure `ui/src/utils/eventParam.js` → **EXECUTED** with nip19-minted fixtures. The `EventSearch` component + the "shown only when no valid param" wiring are **source** sentinels.

## Coverage map
| Criterion | Test | Level |
|---|---|---|
| **classify → canonical param** | `U4` nevent/npub/nprofile/naddr → their paramName; **bare hex → id** (precedence); junk/empty → null | execute |
| **shown only when no valid param** | `U6` page renders `<EventSearch>` only when `resolveEventParams` yields no target | source |
| **submit valid → resolve** | `U8` EventSearch uses classifyEventInput → `setParams`/navigate to the canonical `/event?<type>=<value>` on a match | source |
| **submit invalid → notice** | `U8` non-matching → `EVENT_COPY.SEARCH_INVALID` notice; input present | source |
| **copy** | `U9` EVENT_COPY has the search prompt + not-recognized messages | source |

## Edge cases
- [x] **Hex ambiguity:** a bare 64-hex (valid as both id and pubkey) classifies as **id** by precedence (U4) — the documented search-field rule (paste an npub/nprofile to look up an author by key).
- [x] Empty input → null → notice path (U4).
- [x] Search resolution reuses the param-render path by navigating to the canonical URL (U8) — no duplicate fetch logic.

### Deliberately NOT covered here
- The read path (Story #1) and the param-render branches (Story #2, U1–U3/U5/U7/U10 in the same file).
- NIP-05 / free-text / autocomplete (out of scope).
- Rendered DOM of a search submit — the **staging** capstone.

## Test infrastructure
Same as Story #2's plan — Node runner, `eventParam.js` executed via dynamic import, `EventSearch` source-asserted (sliced from the page source). No live services / JSX transpile / new tooling.

## How to run
```
npm test
# or: node -e "require('./test/event-page-ui.test.js').run().then(r=>console.log(JSON.stringify(r)))"
```

## Verification
Fails with current code — `classifyEventInput` (eventParam.js) and `EventSearch` (BrainstormEvent.jsx) don't exist yet (U4/U8 fail "feature not implemented"). Confirmed 2026-06-18 within the shared UI suite (2 pass / 10 fail). Output in the gate summary.
