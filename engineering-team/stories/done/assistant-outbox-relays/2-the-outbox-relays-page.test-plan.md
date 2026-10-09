# Test Plan: Story 2 — The Outbox Relays page

**Story:** `engineering-team/stories/assistant-outbox-relays/2-the-outbox-relays-page.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0002-the-outbox-relays-page-reads-the-one-answer.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-outbox-relays-page.test.js` (stack-free); browser suite
`tests/brainstorm/assistant-outbox-relays.spec.js` (B3–B6, B10).

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 the page and its states | C2 `checkLine` (Checking…, reasons, request-failed, check-failed); C3 `inboxLine`; D1 reads only the shared answers, never fetches, stores nothing; D5 the hub frame and cards, the new CSS rules | page | unit (ESM), source |
| AC-1 | B3 signed out: sign-in line and button, no panels; B4 done: NIP-65 link in a new tab, the list, the Done mark, the inbox line; B10 375 px, no sideways scroll | spec | browser |
| AC-2 the draft | L5 `sameRelayList`; D2 rebuilt from each answer, edited through the library; B4 nothing to publish when unchanged; B5 the unpublished line appears and goes | page, spec | unit, source, browser |
| AC-3 add by hand | L1 `addRelay` (one spelling, trims, not-a-relay, already-listed, too-many, no mutation); D3 a labelled field in a form; B6 the two refusals, the added relay in its one spelling, the field cleared, Enter adds | page, spec | unit, source, browser |
| AC-4 suggestions | G1 order: own public relay, then the five lists, each once, never Profile or WoT; G2 own relay only at a public address; G3 non-relay entries skipped, 50 cap, none at all; G4 carried in the answer even unfinished, unfiltered; L3 `visibleSuggestions`; L4 `addAll`; B5 one at a time, back on Remove, Add all, the all-listed line | page, spec | unit (DI), browser |
| AC-5 remove | L2 `removeRelay`; D3 screen-reader names on Add and Remove; B5 Remove returns a suggestion | page, spec | unit, source, browser |
| Copy | C1 the approved words (and the 50-relay line approved at the Architecture gate) | page | unit |
| Route | D4 `ACTION_PAGES['outbox-relays']` | page | source |

## Edge cases

- [x] A spelling that differs only in host case or one trailing slash (L1, L2, L3, L5, B6).
- [x] A draft at 50 relays (L1, L4).
- [x] An instance with no public address (G2) and no relays at all (G3).
- [x] An unfinished or failed check: the list starts empty, the suggestions still show (G4, C2).

## Test infrastructure

- Node built-in runner; registered in `test/registry.js`.
- Browser: as in story 1's plan.
- Firmware state: none.

## How to run

```
node -e "require('./test/assistant-outbox-relays-page.test.js').run()"
```

## Verification

See `3-your-assistant-publishes-its-relay-list.test-plan.md` § Verification.
