# Test Plan: Story 3 — Your Assistant's two taggings of you

**Story:** `engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.md`
**ADR:** `engineering-team/decisions/assistant-identification-tags/0003-your-assistant-signs-its-two-taggings-through-one-narrow-route.md`
**Date:** 2026-09-22

Two halves, as the book's other plans: a Node suite that drives the new route's handler through its dependency
seam (the events are really signed with nostr-tools and verified), pins the server-side builder against the browser
builder's layout, and covers the report adapter and the sentinels; and a browser spec for the second card's press
with the route mocked. The fixture `test/helpers/identificationTagsFixtures.js` grows the route's answer shapes
(`serverPublishedRow`, `serverLocalFailedRow`, `serverTagNotFoundRow`, `serverAnswer`, `serverRefusal`), the
refusal words (`REFUSALS`) and the page's request-failed notice, so both halves pin the same approved words.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the second card's publish signs the checked rows with the Assistant's key, in the browser's shape | E4 the happy path (kind, signer, verified signature, p, a, e, d, both z stamps, polarity, content, created_at); E5 the target is the viewer, duplicates once; B1 the builder's tag layout equals the browser builder's; B2 (browser) one POST with the checked keys | `test/assistant-taggings-publish.test.js`; `tests/brainstorm/assistant-taggings-publish.spec.js` | dependency-injected; browser |
| AC-2 whose Assistant; refusals before any key | E1 no session → 401 not-signed-in, no key read; E3 no Assistant → 403 no-assistant, nothing signed; E5 the Owner's mapping; S1 no pubkey taken from the request; B4 a whole-request refusal's words | same | dependency-injected; source; browser |
| AC-3 only the required Assistant-signed taggings; the generic signer unchanged | E2 every bad body → 400 not-an-assistant-tagging, no key read; S2 the generic signer keeps its gates and knows nothing of the route; R1 | same | dependency-injected; source |
| AC-4 local first, each relay reported, local-only skipped | E4 order (local before relays), the rows and words; E7 a failed local write: stage local, no fan-out, the next still tried; E8 local-only: skipped rows, kept-local words, no socket; E9 a partial fan-out's count and words; E4's outside set is the four lists | same | dependency-injected |
| AC-5 the card shows the report, re-checks, refreshes the hub | C1 describeServerPublish for every row kind and a refusal, with the tone rule; C2 the request-failed notice; S3 the page publishes through the util, never fetches, refreshes; B2 the result blocks, the rows flip, the hub counts nine; B3 the error tone per row; B4 the notice when the request never answers | same | ESM in Node; source; browser |
| AC-6 a definition not found refuses that tagging only | E6 not found, not checkable, and a failed local scan → tag-not-found rows, the other published; E11 the lookup by address under the canonical author; B3 the row's sentence | same | dependency-injected; browser |
| AC-7 never at creation | S2 no creation path names the module (the three paths checked by name) | same | source |
| ADR 0003 sub-decisions 1, 5, 9 | S1 the route registered and documented, the z handle imported (no literal); B1 the builder; S3 per-card publishing state; B5 (browser) the first card's controls stay live during the second's press | same | source; browser |
| The live contract | H1 an anonymous POST is refused 401 by the middleware's default deny, and the route is documented (skips when no instance answers, or on a Node without fetch) | same | live |

## Edge cases

- [x] Three malformed sessions and seven malformed bodies, each refused before a key is read (E1, E2).
- [x] Duplicate keys collapse; the answer keeps the required order (E5, E4).
- [x] A definition unfinished (no outside relay) and a failed local scan both read as tag-not-found for that tagging, never a 500 (E6).
- [x] A failed local write on the first tagging does not stop the second (E7).
- [x] No runtime TA: the local z is omitted, the canonical z stays (E9, B1).
- [x] The answer carries no private key, no nsec and no Assistant pubkey (E4).
- [x] A throw outside the loop → 500 with the approved error (E10).
- [x] A press with one row unchecked posts only the other's key (B2); a request that never answers re-enables the button after the notice (B4).
- [ ] Concept Graph API unavailable: not applicable.

## Test infrastructure

- **Framework:** the Node runner and Playwright; Node 22.23.2 from the scratchpad (the host's Node 16 has no `fetch`
  and cannot run Playwright). Runs are read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- **Stack-free by design:** the E-class injects every dependency ADR 0003 names; the fake key store answers a fresh
  nostr-tools key so the events are signed for real and verified with `verifyEvent`; the fake local scan and relay
  answer a filter by `kinds`, `authors` and `#d`; `readConfiguredRelays` answers the tag-relay category and the
  publish set apart. The C-class loads the two ESM modules; the S-class reads source (one `grep -rl` over `src/`,
  `bin/`, `setup/` for the module's name).
- **Browser:** every `/api` route mocked; the publish route answers per scenario ('hang' for a request that never
  answers, a status+body for a refusal, a function of the posted keys) and logs its bodies; the attention route
  answers a queue so the rows can flip after a press. No signer stub: the Assistant signs on the server, which is
  mocked. `BRAINSTORM_BASE_URL` must serve the built UI (B0 guards it).
- **Live:** H1 POSTs the route anonymously; the auth middleware's default deny answers 401 for any `/api/` POST
  (ADR security-auth-exposure/0002), registered or not, so the check also requires the route in `openapi.yaml`.
  A signed-in live publish would write to the local relay; it is left to the Reviewer's judgment with a throwaway
  key, never the owner's.
- **Concept graph / firmware:** none.
- **Fixtures:** `test/helpers/identificationTagsFixtures.js` (extended), `test/helpers/assistantManagementFixtures.js`.

### Re-aims (the Tester's lane, as ADR 0003 § Notes for Test Design asks)

- `tests/brainstorm/assistant-identification-tags-page.spec.js` B5: "no button on the second card until story 3"
  becomes "the second card's button (story 3)", by its approved name. It fails until the button exists.
- `test/registry.js`: `assistant-taggings-publish.test.js` registered after `assistant-identification-tags-page.test.js`.
- Story 2's S6 ("the button renders only with onPublish") holds unchanged: the second card now passes `onPublish`.

## How to run

The Node suite alone, with Node 22 first on the PATH (`hash -r`, then check `node --version`):

```
PATH=<node22>/bin:$PATH node -e "require('./test/assistant-taggings-publish.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

The browser class, after the UI is rebuilt in the container (`docker exec tapestry sh -c 'cd /usr/local/lib/node_modules/brainstorm/ui && npx vite build'`,
which is what `scripts/dev-refresh.sh --ui` does) **and the backend restarted** (the route is new:
`scripts/dev-refresh.sh --server`):

```
BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/assistant-taggings-publish.spec.js --project=chromium
```

After the change, run whole: `assistant-identification-tags-page.spec.js` (B5 re-aimed), `assistant-management-page.spec.js`,
`assistant-attention.spec.js`, `assistant-alert.spec.js`, and `assistant-publish-result.spec.js` (the profile
publish's browser class, whose server module this story imports but does not change).

**The book's gate** is story 2's recipe (its plan § How to run, with the excluded-suites drop) with the pattern widened
by `|identificationTaggings|publishAssistantTaggings|profilePublish|publishEvent|default-deny|profile-tags`, so the
suites that pin the profile publish, the generic signer's gates and the profile-tags module join. Baseline before
changing code (`GATE_LABEL=assistant-identification-tags-3-baseline`), compare suite by suite afterwards.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-22 at `39146251` plus this phase's files (uncommitted
at the time of the run), Node 22.23.2.

**`test/assistant-taggings-publish.test.js`:** 1 passed, 18 failed, 0 skipped. The one pass is the guard R1. Every
failure names what is missing:

```
FAIL  E1–E11, B1   src/api/assistant/identificationTaggings.js does not exist. ADR 0003 § Implementation notes 2 creates it: …
FAIL  C1           taggingPublishReport.js must export describeServerPublish({ name, row })
FAIL  C2           requestFailed: want "This instance did not answer; nothing was published.", got undefined
FAIL  S1           src/api/index.js must register app.post('/api/assistant/identification-tags/publish', …)
FAIL  S2           only the module and the route registration name it; found []
FAIL  S3           no publishAssistantIdentificationTaggings(…) call; the util is not imported from ../../utils/publishAssistantTaggings; …
FAIL  H1           the anonymous POST is refused 401 by the middleware (as it will be), but the route is not yet documented
PASS  R1
```

Story 2's suite stays green with the grown fixture (`assistant-identification-tags-page` 15/0).

**Browser, against the build `localhost:7778` serves today** (story 2's, `index-D7NZovvU.js`), the new spec and story
2's spec together: 12 passed, 7 failed. The seven are exactly the expected set: B0–B5 of
`assistant-taggings-publish.spec.js` (the bundle does not call the route; the second card has no button) and story 2's
re-aimed B5 (the same missing button). Story 2's other twelve pass.
