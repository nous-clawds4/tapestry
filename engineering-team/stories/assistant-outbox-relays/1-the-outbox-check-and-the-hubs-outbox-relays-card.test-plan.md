# Test Plan: Story 1 — The outbox check and the hub's Outbox Relays card

**Story:** `engineering-team/stories/assistant-outbox-relays/1-the-outbox-check-and-the-hubs-outbox-relays-card.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0001-the-outbox-check-joins-the-one-attention-answer.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-outbox-check.test.js` (stack-free); browser suite `tests/brainstorm/assistant-outbox-relays.spec.js`
(B1–B2). Words and canned answers: `test/helpers/outboxRelaysFixtures.js`.

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 the card | C1 eleven actions; Outbox Relays third in persona, after Identification Tags; title, path, description, NIP-65 link, alert criteria | outbox-check | unit (ESM) |
| AC-1 | B1 the third persona card links to `/assistant/outbox-relays` and shows its description | spec | browser |
| AC-2 whose | U1 signed out; U2 no assistant; U12 a query parameter changes nothing, scans by the session's assistant only; U13 no pubkey in the answer | outbox-check | unit (DI) |
| AC-3 which list | U3 local list counts, no outside read; U4 local miss → outside publish relays, own relay dropped, newest wins; U5 newest local wins, tie → lowest id; U10 another author's list or another kind ignored; U14 `lookupNewestReplaceable`'s three shapes | outbox-check | unit (DI) |
| AC-3 finished | U7 the three unfinished reasons; U8 outside = configured publish set even in local-only mode; U9 a hanging relay loses the 8 s budget | outbox-check | unit (DI) |
| AC-3 parsing | L2–L3 `normalizeRelayUrl`; L4–L5 `parseRelayList` (markers, duplicates, non-relay values, 100-tag cap) | outbox-check | unit |
| AC-4 the hub reads it | U6 inbox-only, empty and no list are pending; C2 `CHECKED_ACTIONS`; C3 the two readings (done / pending / unfinished / check-failed / missing); C4 the `done` list and the Done copy | outbox-check | unit |
| AC-4 | D1 the hub draws the Done badge; D2 its CSS rule; B1 done → Done badge, no mark, screen-reader "Done: Outbox Relays"; B2 pending → "Needs attention" | outbox-check, spec | source, browser |
| AC-5 read-only | S1 no write, no signing, no request parameter; S2 `Promise.allSettled`, `OUTBOX_RELAYS`; U11 a throwing outbox check leaves a 200 with Identification Tags answered | outbox-check | source, unit |
| Docs | S3 openapi + BIBLE §11 row name `outbox-relays` | outbox-check | source |
| Library wiring | L1 CommonJS, no imports; D3 Vite alias + CommonJS include; actions.js keeps one import | outbox-check | source |

### Re-aimed suites (Phase 3, the Tester's lane — ADR 0001 § Implementation notes 6)

- `test/helpers/assistantManagementFixtures.js`: the eleventh action and `NIP_LINKS.relayList`.
- `test/assistant-management-page.test.js`: D2 (11 actions), D3 (four links), D7 (count = every action), H1 title.
- `test/assistant-attention.test.js`: `fakes()` injects `checkOutboxRelays` (its identification-tags tests stay off the
  outbox's scan and reads); C2 no longer pins exactly one checked action.
- `test/assistant-identification-tags-page.test.js`: R2 counts the hub fixture's actions.
- `tests/brainstorm/assistant-management-page.spec.js`, `assistant-alert.spec.js`: mock both checked actions pending, so the
  hub and the pill say eleven; the outbox page skips the placeholder test (B8).
- `tests/brainstorm/assistant-attention.spec.js`: its answers carry no outbox key, so the hub marks one more card and the
  pill is unchanged (B1 10/9, B2 11/10, B3 11/9, B4 11/9).

The parallel book `assistant-profile-checklist` re-aims some of the same lines (its profile action stops being a
placeholder). Whichever lands second reconciles those counts.

## Edge cases

- [x] A relay list that names a relay twice, with disagreeing markers (L5).
- [x] More than 100 `r` tags (L5).
- [x] A relay that answers with events it was not asked for (U10).
- [x] A relay that never answers (U9).
- [x] A check that throws (U11).
- [ ] Concept Graph API unavailable — not applicable: no concept is read.

## Test infrastructure

- Node built-in runner via `test/registry.js` (`assistant-outbox-check.test.js` registered after the taggings suite).
- No live stack: every U test injects its dependencies; no H class (the attention route's live contract is
  `test/assistant-attention.test.js` H1).
- Firmware state: none.
- Browser: Playwright against a served build (`cd ui && npm run build && npx vite preview --port 4173`,
  `BRAINSTORM_BASE_URL=http://localhost:4173`), chromium.

## How to run

```
node -e "require('./test/assistant-outbox-check.test.js').run()"
npm test
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/assistant-outbox-relays.spec.js --project=chromium
```

## Verification

See `3-your-assistant-publishes-its-relay-list.test-plan.md` § Verification — one run covers the three stories.
