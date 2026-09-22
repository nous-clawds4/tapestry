# Test Plan: Story 2 — The Identification Tags page, and your two taggings of your Assistant

**Story:** `engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.md`
**ADR:** `engineering-team/decisions/assistant-identification-tags/0002-the-page-reads-the-one-answer-and-publishes-through-the-tagging-publisher.md`
**Date:** 2026-09-22

Two halves, as story 1's plan: a Node suite for the pure modules and the source sentinels, and a browser spec for what
a viewer sees and what a press does. The page's words, the publish summaries and two more canned answers join the
shared fixture `test/helpers/identificationTagsFixtures.js` (`PAGE_COPY`, `PUBLISH_WORDS`, `MISSING_ALL`,
`TAG_NOT_FOUND`), so both halves pin the same approved words — the story's § Copy as amended by ADR 0002
sub-decision 5 (the failed-local-write lines).

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the page and its three pre-answer states | B1 the words, the two cards and rows; B6 signed out, no Assistant, sign-in resolving; S1 the page reads only the shared answers | `tests/brainstorm/assistant-identification-tags-page.spec.js`; `test/assistant-identification-tags-page.test.js` | browser; source |
| AC-2 each row's state and the card's mark | C2 the phases before an answer; C3 present, missing, tag-not-found, could-not-check; C4 cardState; B1 Present and Done; B2 Missing and marked; B3 tag not found; B4 could-not-check with the reason; B5 the fetch failed | same | ESM in Node; browser |
| AC-3 the checkboxes | C3 definitionKnown; B2 checked by default, the button follows the boxes, a reload checks them again; B3 a disabled unchecked box; B1 none on a present row; B4 none on a could-not-check row; S6 the button's disabled rule | same | browser; source |
| AC-4 your publish | C5 the per-relay rows from the chokepoint's answers; C6 outcome, ok and every summary line; C7 the tone rule and the relay words; S2 the page publishes through the report-returning variant with the canonical tag, the viewer's own Assistant, an apply, and refreshes; S4 the publisher's variant and wrapper; B7 two signatures, two local writes, the kept-local summary, five skipped lines, the rows flip, the hub counts nine; B8 the extension declines the second; B9 no extension; B10 the local write fails | same | ESM in Node; source; browser |
| AC-5 the second card before story 3 | B5 its row Missing with a checked box and no button; S6 the button renders only with onPublish | same | browser; source |
| AC-6 direct loads, phone width, the hub's link, the other nine unchanged | B11 375 px, a direct load and a reload, the hub's card leads here; S3 the override map routes this one action and the other nine to the placeholder; the re-aimed hub W1 and B8 (below) | same; `test/assistant-management-page.test.js`; `tests/brainstorm/assistant-management-page.spec.js` | browser; source |
| AC-7 read-only until a press | B12 nothing but GETs and no request beyond the answer and the top bar's; S1 no fetch in the page | same | browser; source |
| ADR sub-decisions 1–7 | S3 the route map; S4 the publisher; S5 the styles block and its phone rule; C1 the two pure modules import nothing | same | source |
| Guards that pass before and after | R1 the publisher's callers keep their contract; R2 `actions.js` unchanged (the description comes from the entry; ten actions) | same | regression |

## Edge cases

- [x] An answered answer with no row for an entry (C2: could-not-check, request-failed).
- [x] A tag not found while the tagging is present (C3: tag-not-found wins, AC-2 "whatever the check found").
- [x] A missing row whose definition check did not finish (C3: missing, not publishable).
- [x] A relay missing from the chokepoint's details (C5: unreachable, "no publish result"); no relays given (C6).
- [x] A failed local write with, without and beside kept-local (C6, B10), and a local failure without a reason (C6).
- [x] A partial acceptance never reads as a clean success (C7).
- [x] Unchecking both boxes disables the button; a reload restores the defaults (B2).
- [x] The extension declining mid-press keeps the first result (B8); no extension publishes nothing (B9).
- [x] Sign-in still resolving shows neither line (B6).
- [ ] Concept Graph API unavailable: not applicable.

## Test infrastructure

- **Framework:** the Node runner (every suite exports `run()`) and Playwright, read per
  [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate). Node 22.23.2 from the
  scratchpad throughout (memory `host-gate-at-ci-parity`; the host's Node 16 cannot run Playwright).
- **Stack-free by design:** the C-class loads the two pure modules as ESM; the S-class reads source. The publisher's
  variant is pinned by source only: `nostrPublish.js` imports `nostr-tools/pool`, and loading it in Node is the
  version-gated question `test/honest-publish-reporting.test.js` owns.
- **Browser:** every `/api` route mocked; `/api/assistant/attention` answers a queue (each read takes the next
  answer, the last repeats), so a press can be followed by a changed answer; `/api/publish-policy` answers
  local-only, so no relay socket opens; `/api/strfry/publish` is mocked and its posted events logged; the signer
  is an init-script stub whose active account is the mocked viewer's (`getActiveSignerOrThrow` checks the two
  match), with a declining variant.
- **Concept graph / firmware:** none.
- **Fixtures:** `test/helpers/identificationTagsFixtures.js` (extended) and `test/helpers/assistantManagementFixtures.js`
  (the hub's words, the action's description).

### Re-aims (the Tester's lane, as ADR 0002 § Consequences asks)

- `test/assistant-management-page.test.js` W1: the route regex now accepts `element: ACTION_PAGES[a.key] ?? <AssistantActionPage action={a} />`
  as well as the placeholder alone. It passes before and after (24/24 on this tree).
- `tests/brainstorm/assistant-management-page.spec.js` B8: the identification-tags case skips with a reason; this
  story's spec pins that page. B11 (twelve addresses) and B12/B13 (`/assistant/preferences`) are unchanged.
- `test/registry.js`: `assistant-identification-tags-page.test.js` registered after `assistant-attention.test.js`.

## How to run

The Node suite alone, with Node 22 first on the PATH (`hash -r`, then check `node --version`):

```
PATH=<node22>/bin:$PATH node -e "require('./test/assistant-identification-tags-page.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

The browser class, after `scripts/dev-refresh.sh --ui` (a source edit is invisible to it):

```
BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/assistant-identification-tags-page.spec.js --project=chromium
```

After the change, run whole: `assistant-management-page.spec.js` (B8 skips one case; B11–B13 touch the routes),
`assistant-attention.spec.js` and `assistant-alert.spec.js` (the hub's count after a publish), and the specs that
share the publisher — `pin-a-tag.spec.js` and `tag-detail-curated-view-and-pin-polish.spec.js` if they exercise
`publishProfileTagAssertion` (grep before running).

**The book's gate** is story 1's recipe (its plan § How to run; pipe it into `node -` from the repo root, never save
it elsewhere — ledger `2026-09-22-gate-recipe-relative-require`) with the pattern widened by
`|IdentificationTags|identificationTags|taggingPublishReport|publishProfileTag|useProfileTags|Tag\\.jsx`, so the
suites that pin the publisher and its callers join. The Implementer runs a labelled baseline before changing code
(`GATE_LABEL=assistant-identification-tags-2-baseline`) and compares suite by suite afterwards.

## Verification

The new tests fail with the current code. Confirmed on 2026-09-22 at `6bd084b9` plus this phase's files
(uncommitted at the time of the run), Node 22.23.2.

**`test/assistant-identification-tags-page.test.js`:** 2 passed, 13 failed, 0 skipped. The two passes are the guards
R1 and R2. Every failure names what is missing:

```
FAIL  C1–C4        ui/src/pages/assistant/identificationTags.js does not exist. ADR 0002 sub-decision 2 creates it: …
FAIL  C5–C7        ui/src/utils/taggingPublishReport.js does not exist. ADR 0002 sub-decision 4 creates it: …
FAIL  S1, S2, S6   ui/src/pages/assistant/IdentificationTags.jsx does not exist …
FAIL  S3           no default import from ./pages/assistant/IdentificationTags; no ACTION_PAGES map …
FAIL  S4           no export async function publishProfileTagAssertionWithReport(; no export function assertPublished( …
FAIL  S5           no .bs-idtags-card; no .bs-idtags-card.is-marked; … no phone-width rule
PASS  R1, R2
```

The re-aimed hub suite passes before the change: `assistant-management-page` 24/24, W1 included.

**`tests/brainstorm/assistant-identification-tags-page.spec.js`** against the build `localhost:7778` serves today
(story 1's, which predates this story): 2 passed, 11 failed. B0 fails because the bundle
does not contain the first card's title; B1 fails on the Treasure Map sentence; the rest time out looking for the
cards, boxes and buttons the placeholder page does not have.
