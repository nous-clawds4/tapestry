# Test Plan: Story 1 — The profile check and the hub's Done mark

**Story:** `engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`
**ADR:** `engineering-team/decisions/assistant-profile-checklist/0001-the-profile-check-joins-the-one-attention-answer.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-profile-check.test.js` (registered in `test/registry.js`); browser suite
`tests/brainstorm/assistant-profile-check.spec.js`. Shared words and canned answers:
`test/helpers/profileChecklistFixtures.js`.

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the item list | L1 the library is dependency-free CommonJS · L2 the seven items in order, the banner not counted · L3 `PROFILE_CONTENT_FIELDS` equals the one writer's `PROFILE_FIELDS` · L4 `COMPOSITE_AVATAR_FILE_RE` (8–64 hex, nothing else) | `test/assistant-profile-check.test.js` | unit |
| AC-2 the viewer's own Assistant only | U1 a complete profile · U16 no pubkey in the answer · A1 the profile action joins the answer for the session's Assistant, request parameters ignored · A3 a visitor / no Assistant get no profile check | same | unit (DI) |
| AC-3 which profile; no profile | U11 no profile → every counted item `no-profile` · U14 the resolver is asked with the relay fallback; a failed strict local scan is `profile-unreadable`, not "no profile"; the newest local kind 0 is the profile | same | unit (DI) |
| AC-4 each item's rule | U2 avatar (composite stored / missing file / standard image ×2 / elsewhere / another instance / query / http / traversal / none) · U3 only bare composite names reach the file check · U4 NIP-05 (listed, case, someone else, no one, unreachable, other domain without a fetch, not an identifier, none) · U5 website (exact, slash, case; http, path, query, port, no scheme, user; none) · U6 name and About · U7 client tag · U8 visible (n of m, older copy and another author not counted, own relay never read, the filter) · U9 visible (only-here, local-only-mode, no-relays, unreachable) · U12 a dev box → `no-public-address` for the four instance-bound items, no lookup, no file check · F1 `hasStoredAvatar` | same | unit (DI, temp dir) |
| AC-5 finished | U4 / U9 unfinished rows · U10 a hanging relay costs only its own answer (within 4 s + margin), `PROFILE_RELAY_BUDGET_MS` = 4000 · U13 the resolver rejects → unfinished `profile-unreadable` · U15 flags from counted rows only; pending while another row is unfinished | same | unit (DI) |
| AC-6 the hub reads it | C1 `CHECKED_ACTIONS` includes the profile · C2 the two readings (no answer, checking, failed, unfinished, check-failed: marked, not counted; pending and no-profile: marked and counted; done: neither) · C3 `done` lists checked actions that are done, never a placeholder or a marked one, nothing for visitors · C4 `ASSISTANT_COPY.done` / `doneSrPrefix`, one import · D1 the hub card's done marks · D2 the CSS rule · B1–B5 (browser) Done badges on both checked cards, the count line and the pill, the screen-reader name | `test/…check.test.js`, `tests/brainstorm/assistant-profile-check.spec.js` | unit (ESM) · source · browser |
| AC-7 read-only, one request | S1 the check never writes and reads no request parameter; strict relay reads; `lookupNip05` · A2 a throwing profile check does not take Identification Tags with it (`check-failed`) · D3 the Vite alias · S2 openapi + BIBLE §11 | same | source · unit |

## Edge cases

- [x] A relay that never answers (U10), one that throws (U9), all unreachable (U9).
- [x] This instance's own relay among the publish relays — never read, never counted (U8, U9 `no-relays`).
- [x] A picture URL that resolves outside `/generated/` (`..`), carries a query, uses http, or names another instance (U2, U3).
- [x] A NIP-05 domain in capitals; a value that is not an identifier (U4).
- [x] A website with a trailing slash, capitals, a port, a user, a path or a query (U5).
- [x] Non-string profile fields (U6).
- [x] A placeholder whose answer happens to say done (C3).
- [x] A profile check that throws (A2).

## Test infrastructure

- Node's runner through the gate (`npm test`; registry entry added). Every server rule is driven through the
  dependencies ADR 0001 names: `describeInstance`, `resolveAssistantProfileState`, `scanLocalStrict`, `lookupNip05`,
  `readRelay`, `getConfiguredPublishRelays`, `isLocalOnly`, `hasStoredAvatar`, `getConfigFromFile`; the attention handler
  takes `checkProfile`. Stack-free: no strfry, no relay, no network.
- **Seams this plan pins where the ADR left a name open:** `checkProfile({ assistantPubkey }, deps)` merges its
  dependencies over the real ones (the `attention.js` idiom); `hasStoredAvatar(file, { baseDir })`.
- Browser: Playwright against a served **built** UI with every `/api` route mocked
  (`BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=<origin>`). Verified here against `dist/` served by a
  static SPA server (no stack).
- Concept Graph: not used (no concept touched; stack absent in this session).
- Firmware state: none.
- Fixtures: `test/helpers/profileChecklistFixtures.js`.

### Re-aimed existing tests (this story changes them on purpose)

- `test/assistant-attention.test.js` — `fakes()` stubs `checkProfile`, so that suite stays about Identification Tags;
  C2 asks that `CHECKED_ACTIONS` *include* `identification-tags` (not equal it); C3 computes the pill's placeholder count
  from `CHECKED_ACTIONS`. All pass before and after.
- `tests/brainstorm/assistant-attention.spec.js` — every mocked answer also carries a pending profile action, so the
  counts it pins for Identification Tags stay; B4 (the fetch fails) now expects 8 in the pill: the profile is checked, so a
  failed fetch no longer counts it.
- `tests/brainstorm/assistant-alert.spec.js`, `tests/brainstorm/assistant-management-page.spec.js` — their "every action
  pending" answer gains a pending profile action, so every count stays ten.
- Counts are computed from the action list where they can be. A parallel book (`assistant-outbox-relays`) is adding a
  checked action; whichever lands second re-checks these lines.

## How to run

```
npm test
node test/assistant-profile-check.test.js          # this suite alone
```

For browser/e2e (a built UI served at an origin; every /api route is mocked by the spec):
```
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:7799 \
  npx playwright test tests/brainstorm/assistant-profile-check.spec.js --project=chromium
```

## Verification

The new tests fail with the current code, each for the missing feature (no import or syntax failures).
Confirmed on 2026-10-09 against the working tree on `a5ee992`:

```
assistant-profile-check: 0 passed, 33 failed
  L1–L4  src/lib/assistant-profile-items/index.js does not exist …
  U1–U16 src/api/assistant/profileChecklist.js does not exist …
  A1     attention.js must export PROFILE = 'profile'; got undefined
  A2     actions.profile: want {"finished":false,"done":false,"pending":false,"reason":"check-failed","items":[]}, got undefined
  A3     src/api/assistant/attention.js has no checkProfile dependency
  F1     src/api/assistant/avatar.js must export hasStoredAvatar()
  C1     CHECKED_ACTIONS must include "profile" and "identification-tags"; got ["identification-tags"]
  C2     done: profile marked want false, got true; pending: alertCount want 9 placeholders + the profile = 10, got 9; …
  C3     assistantAttention(user, attention) must answer a fourth field, done: string[] …
  C4     ASSISTANT_COPY.done: want "Done", got undefined; …
  D1–D3, S1, S2  (the hub's done marks, the CSS rule, the Vite alias, the module, the documents) absent

assistant-profile-check.spec.js (chromium, built UI, all /api mocked): 5 failed
  B1–B4  the profile card is the placeholder's: always marked and always counted
  B5     no "Done: Your Tapestry Assistant's Profile" link
```

The re-aimed suites on the current code: `assistant-attention` 38 passed, 0 failed, 1 skipped (live);
`assistant-alert` 15/0; `assistant-management-page` 23/0 (1 skipped); the re-aimed browser specs pass except
`assistant-attention.spec.js` B4 (expects 8 in the pill; today's build says 9, as it should before this story).
The gate's run record for the whole suite is quoted in the Phase 3 hand-off.
