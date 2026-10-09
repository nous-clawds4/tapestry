# Test Plan: Story 3 — Your Assistant publishes its relay list

**Story:** `engineering-team/stories/assistant-outbox-relays/3-your-assistant-publishes-its-relay-list.md`
**ADR:** `engineering-team/decisions/assistant-outbox-relays/0003-the-assistant-signs-its-relay-list-through-one-narrow-route.md`
**Date:** 2026-10-09

## Coverage map

Node suite `test/assistant-relay-list-publish.test.js` (stack-free; events really signed and verified with nostr-tools);
browser suite `tests/brainstorm/assistant-outbox-relays.spec.js` (B7–B9).

| Criterion | Test | File | Level |
|---|---|---|---|
| AC-1 the button and its report | P5 the answer's shape and words, only accepting relays counted; C1 the button, Publishing…, subject and lines; R1 the shipped report util draws the answer shape; S4 the page publishes through its util, draws with `describeServerPublish` / `publishTone` / `relayLine`, refreshes | publish | unit (DI), source |
| AC-1 | B4 nothing to publish when unchanged; B5 enabled once changed; B7 one POST of the draft, the report, the answer asked again, the list rebuilt; B9 a refusal in the route's words, a failed request says nothing was published | spec | browser |
| AC-2 whose key, nothing else | P1 401 before any key; P2 400 for every malformed list before any key; P3 403 no assistant, nothing written; P12 body fields other than `relays` change nothing; L3 `validateRelayListRequest`; S2 one signing helper, no key literal; S3 no creation path, generic signer untouched | publish | unit (DI), source |
| AC-3 the event | L1–L2 `buildRelayListTags` (markers kept, read → both, removed dropped, inbox-only kept, empty draft); P4 the signed event's kind, signer, signature, content and tags from the local newest list; P7 the newest list read local-first, then outside, supplying markers; P8 no list anywhere → all `write`; P6 `created_at` one second after a future list | publish | unit, unit (DI) |
| AC-4 where it goes | P4 local before relays, fan-out = new ∪ previous ∪ profile publish set, own relay out, each once; P9 a failed local write sends nothing, in the approved words; P10 local-only: skipped rows, kept-local words, nothing sent; P5 none accepted → not-delivered words | publish | unit (DI) |
| AC-5 empty outbox | L2 empty draft; P11 the event keeps only inbox-only entries, `outbox: []`; B8 the POST of `[]` and the empty-outbox line | publish, spec | unit, browser |
| Docs | S1 route registered and documented; BIBLE §11 row and §14 sentence | publish | source |
| Live | H1 an anonymous POST answers 401 (skips with no stack) | publish | live |
| Errors | P13 an unexpected throw → 500 with the approved error | publish | unit (DI) |
| AC-6 only public relays (review round 1, ADR 0003 Amendment 1) | A1 the library's `isPlainlyPrivateHost` answers as `ssrfGuard` does without DNS (drift guard); A2 `addRelay` refuses `not-public`; A3 a request naming one → 400 `not-a-public-relay` before any key; A4 send-time lookup of the new and previous lists' relays, non-public ones never sent and reported `not-sent`, configured relays not looked up, the signed list unchanged; A5 a not-sent row is neither tried nor accepted; A6 the words and `relayLine`; A7 the route uses `ssrfGuard`; G5 (page suite) suggestions leave out plainly-private relays; B6b the page refuses a private address where it is typed | publish, page, spec | unit, unit (DI), source, browser |

## Edge cases

- [x] A private, loopback, link-local, CGNAT, unique-local or IPv4-mapped address; `localhost`; a local-network suffix; a bare Docker service name (A1–A3).
- [x] A public-looking name that resolves private (A4, through the injected `isPublicHostname`).

- [x] Duplicate relays in the request, by spelling (P2, L3).
- [x] 51 relays (P2, L3).
- [x] A newest list from the future (P6).
- [x] The newest list only on an outside relay (P7), or nowhere (P8).
- [x] Local-only publish mode (P10).
- [x] A relay that refuses, every relay unreachable (P5).

## Test infrastructure

- Node built-in runner; registered in `test/registry.js`. Requires `nostr-tools` (installed by `npm ci`).
- Browser: as in story 1's plan.
- Firmware state: none.

## How to run

```
node -e "require('./test/assistant-relay-list-publish.test.js').run()"
npm test
cd ui && npx vite build && npx vite preview --port 4173 --strictPort   # then:
BRAINSTORM_BASE_URL=http://localhost:4173 npx playwright test tests/brainstorm/assistant-outbox-relays.spec.js --project=chromium
```

## Verification

The new tests fail with the current code. Confirmed on 2026-10-09 at commit `9dced50` (origin/staging plus this book's
story and ADR commits), for the three stories together.

Node (each suite run alone):

```
assistant-outbox-check:        0 passed, 29 failed  — "src/lib/relay-list/index.js does not exist", "src/api/assistant/outboxRelays.js does not exist",
                                                       "CHECKED_ACTIONS … want both checked, got [identification-tags]", missing Done badge / alias
assistant-outbox-relays-page:  0 passed, 17 failed  — the library, outboxRelays.js, outboxRelaysCopy.js and OutboxRelays.jsx do not exist
assistant-relay-list-publish:  2 passed, 20 failed, 1 skipped — relayListPublish.js and the builders do not exist, no route, no privkeyBytesOf;
                                                       R1 (the shipped report util) and S3 (no creation path names the module) are guards and pass;
                                                       H1 skipped (no stack)
```

Re-aimed Node suites: `assistant-management-page` D2, D3, D4, D10 and `assistant-identification-tags-page` R2 fail (they
expect the eleventh action); `assistant-attention`, `assistant-alert`, `assistant-taggings-publish`, `my-assistants-page`
pass unchanged.

Browser, chromium, against a build of the same commit served by `vite preview`:

```
assistant-outbox-relays.spec.js:     B0–B10 fail (no card, "Page not found", no publish route in the bundle)
assistant-management-page.spec.js:   B1, B2, B4, B5, B6, B11 fail (no eleventh card / address); B8 outbox-relays skipped (built in story 2)
assistant-attention.spec.js:         B1–B4 fail (the hub marks one card fewer than the re-aimed counts)
assistant-alert.spec.js:             B1, B5, B6 fail (the pill says 10, not 11)
24 failed, 2 skipped, 26 passed
```

### Round 2 (review round 1's finding, ADR 0003 Amendment 1), 2026-10-09

Before the fix: A1, A2, A3, A4, A6, A7 fail ("isPlainlyPrivateHost" not exported; a private relay is added, accepted with
200 and sent to); G5 and the page suite's C1 (the new refusal line) fail; A5 passes already (with no guard every relay is
sent and counted, so its count matches either way, and after the fix it pins that not-sent rows are not counted).
`fakes()` now injects `isPublicHostname` (every host public unless listed), so no test reaches real DNS.
