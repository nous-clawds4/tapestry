# Test Plan: Story 1 — Two authored tags and two parked taggings

**Story:** `engineering-team/stories/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md`
**ADR:** `engineering-team/decisions/identification-tags-authorship/0001-each-definition-has-its-author-and-two-taggings-are-parked.md`
**Date:** 2026-09-22

The previous book's three suites and three specs pin the single canonical author and the four-row answer in
many places, so this plan is mostly re-aims of those, with new cases for what the story adds. Every expected
word and shape comes from `test/helpers/identificationTagsFixtures.js`, rewritten here: `AUTHORS` (the two
definition authors, npub and hex), `REQUIRED` with `offered` / `author` / `address` per entry, `OFFERED`,
`PARKED`, `definitionAddress(entry)`, canned answers with the two offered rows only, and the parked words.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC-1 the list carries each definition's author and whether it is offered; the single author is gone | L1 (exports; no `CANONICAL_TAG_AUTHOR`, no `canonicalTagAddress`), L2 (each offered entry's author, decoded from the fixture npub, and address; parked entries null), L3 (the four in order with the new fields; `OFFERED_TAGGINGS` frozen) | `test/assistant-attention.test.js` | unit |
| AC-2 the answer checks the offered taggings only, at each author's address; `done`/`pending` over them | U3 (two rows; scans by the two signers and the two definition authors; the definition's address is its author's), U9 (two unfinished rows), U12 (found at its own author's address; a same-named tag by another author is not it), U13 (flags over two entries; never a parked row), U14 (the two definition authors are the only other scans), U18 (nothing names a parked slug or d; no parked row; parked taggings neither hold back nor push forward) | `test/assistant-attention.test.js` | unit |
| AC-2 the hub and the pill read the two-row answer | C3 (done / pending / unfinished with the two-row answers), B1–B4 of the attention spec (unchanged cases, two-row answers) | `test/assistant-attention.test.js`, `tests/brainstorm/assistant-attention.spec.js` | unit, browser |
| AC-3 parked rows greyed, unchecked, disabled, "Not offered yet", out of the count | C1 (the parked words), C4 (`cardState` ignores parked rows), C8 (`rowState` is `parked` in every phase, for any row), S5 (`.bs-idtags-row.is-parked`) | `test/assistant-identification-tags-page.test.js` | unit |
| AC-3 as a viewer sees it | B1 (one Present row and one parked row per card, Done), B2 (the offered box checked, the parked box inert), B4, B6 (signed out and guest: the parked rows say so), B13 (greyed: an opacity below 1; a click changes nothing; a press never names them) | `tests/brainstorm/assistant-identification-tags-page.spec.js` | browser |
| AC-4 the first card's tagging points at Nous' definition | S2 (`authorPubkey: entry.author`), B7 (the signed event's `a` is `definitionAddress(My Tapestry Assistant)`, its `e` the answer's eventId) | `test/assistant-identification-tags-page.test.js`, page spec | unit, browser |
| AC-4 the Assistant's tagging points at its author's definition | E4 (`a` = `definitionAddress(My Tapestry Owner)`), E11 (the definition scan is under `a73a2980…`; the retired author is never asked), B1 (the builder's `authorPubkey` is the entry's), B2 of the publish spec (one POST, one key) | `test/assistant-taggings-publish.test.js`, `tests/brainstorm/assistant-taggings-publish.spec.js` | unit, browser |
| AC-5 a parked key cannot be issued | E2 (a parked key alone or beside the offered one: 400 before any key is read), E12 (the same with a same-named definition present; the other parked key), B6 of the publish spec (the parked box cannot be checked; the POST names the offered key only), B13 of the page spec (nothing signed for a parked row) | publish suite and specs | unit, browser |
| AC-6 the documents say what is true | S5 (BIBLE and OpenAPI: no "two identification taggings", no single key's "canonical definitions", no "My Human" beside "My Tapestry Owner" as published; the pair named as parked) | `test/assistant-attention.test.js` | source |
| AC-7 nothing else changes | R1/R2 of the three suites (the publisher's callers, actions.js, the profile seam, the generic signer's gates); S2/S3 of the publish suite (no creation path names the module; the page still publishes through the util); the attention spec whole; `dual-z-writer`, `default-deny-mutations`, `assistant-publish-relays`, `assistant-management-page`, `assistant-alert` unchanged | existing suites | regression |

## Edge cases

- [ ] A same-named "My Tapestry Assistant" tag by another author on the relay: present still counts (U7), the
      definition does not (U12, E6).
- [ ] A parked tagging someone applied anyway, and a parked definition on the relay: neither is read, counted or
      shown (U18; C8; B13).
- [ ] Both parked keys, alone and mixed with the offered one, with and without a same-named definition (E2, E12).
- [ ] A card whose only offered row is present reads Done beside its parked row (C4; B1); a card of parked rows only
      would read unknown (C4).
- [ ] Signed out, guest, and while sign-in resolves: the parked rows carry their words, the offered rows nothing;
      only the parked boxes exist, disabled (B6).
- [ ] The definitions of the two offered entries are by two different authors, so the check runs two definition
      lookups; a local miss reads each tag relay at most four times (U3, U11).
- [ ] The two hub specs' `PENDING` mock still has "My Tapestry Owner" missing, so their counts are unchanged.

## Test infrastructure

- Test framework: the Node runner (`npm test`, one suite via its `run()` export) and Playwright for the browser
  class. A run's result is read per [Running and reading the test gate](../../README.md#running-and-reading-the-test-gate).
- Concept Graph API: not needed. The Node suites are stack-free except each suite's one live H-class request
  (`BRAINSTORM_BASE_URL`, else `localhost:7778`; skipped with no stack or on a Node without `fetch`).
- Firmware state: none required.
- Fixtures: `test/helpers/identificationTagsFixtures.js` (rewritten), `test/helpers/assistantManagementFixtures.js`.
- Node: 22.x first on the PATH (`hash -r`, then check `node --version`); the host's Node 16 has no `fetch` and
  Playwright refuses it.

## How to run

One Node suite, through its `run()` export:

```
node -e "require('./test/assistant-attention.test.js').run().then((r) => process.exit(r.fail ? 1 : 0))"
```

(likewise `assistant-identification-tags-page` and `assistant-taggings-publish`).

The browser class, against the built UI the local stack serves (`scripts/dev-refresh.sh --ui` rebuilds it in the
container; `--server` restarts the backend, which this story needs for the two routes):

```
BRAINSTORM_BASE_URL=http://localhost:7778 BRAINSTORM_SERVER_ACCESSIBLE=true npx playwright test \
  tests/brainstorm/assistant-identification-tags-page.spec.js tests/brainstorm/assistant-taggings-publish.spec.js \
  tests/brainstorm/assistant-attention.spec.js tests/brainstorm/assistant-alert.spec.js \
  tests/brainstorm/assistant-management-page.spec.js tests/brainstorm/assistant-publish-result.spec.js --project=chromium
```

**The book's gate**, written out here so no plan has to be chased for it (ledger
`2026-09-22-gate-recipe-relative-require`): from the repo root, with Node 22 on the PATH, the suites whose file
name matches the pattern, minus the registry's `excluded` suites, through the runner that stamps the record:

```
GATE_LABEL=identification-tags-authorship-1-after node -e '
const path = require("path"); const root = process.cwd();
const { runGate } = require(path.join(root, "test/helpers/gateRunner"));
const { suites, excluded } = require(path.join(root, "test/registry"));
const pattern = /assistant|identification|tagging|dual-z|profile-tag|default-deny|publish|harness-lint|session-start|Tag\.jsx/i;
const out = new Set(excluded.map((e) => e.file));
const want = suites.filter((s) => pattern.test(s.file) && !out.has(s.file));
runGate({ suites: want, label: process.env.GATE_LABEL });
'
```

`runGate` exits the process with the verdict; read it with `npm run gate:status -- --label identification-tags-authorship-1-after`.

**Baseline.** The code at this story's start is the code the previous book's close gate ran on (the branch is
staging plus docs commits): `20260922T130828Z-49331-2d67 [book-close-assistant-identification-tags]` on
`a2923f9b+dirty`, all 226 suites, red on this host's fourteen known live suites only. The after-run is compared
against it suite by suite; a second baseline is not needed.

## Verification

The new and re-aimed tests fail with the current code. Confirmed on 2026-09-22 at `47fc2cd0` plus this phase's
files (uncommitted at the time of the run), Node 22.23.2, the local stack up (the H-class executed).

**`test/assistant-attention.test.js`:** 28 passed, 11 failed, 0 skipped. Every failure names what is missing:

```
FAIL  L1   the single canonical author is gone: no CANONICAL_TAG_AUTHOR, no canonicalTagAddress
FAIL  L2   my-tapestry-assistant: author want 15f7dafc… (Nous), got undefined; address want 39999:15f7dafc…:my-tapestry-assistant, got 39999:e5272de9…; …
FAIL  L3   REQUIRED_TAGGINGS: want [{…offered, author, address…}], got [{…address: 39999:e5272de9…}]
FAIL  U3   rows: want the two offered rows, got four
FAIL  U4   the action is done once the relay supplied the last one: done false (the parked two still count)
FAIL  U9   a failed local scan: every row unfinished … (four rows, not two)
FAIL  U10  the answering relay decides: done false (the parked two still count)
FAIL  U12  my-tapestry-assistant's definition: found locally with its id; got found false (looked up under the retired author)
FAIL  U14  local scans by the owner, the TA and the two definition authors only; got the retired author
FAIL  U18  rows for the offered taggings only, in order; got four
FAIL  S5   BIBLE.md still says /two identification taggings/i, /the canonical definitions/i, …; openapi.yaml still says …
```

**`test/assistant-identification-tags-page.test.js`:** 10 passed, 6 failed:

```
FAIL  C1   states: want {…, parked: "Not offered yet"}, got {present, missing, checking}
FAIL  C4   ["present","parked"]: want done, got marked; …
FAIL  C8   idle, no row: want {state: "parked", …}, got {state: "unknown", …}
FAIL  S1   uses the retired single canonical author (each entry carries its own: entry.author)
FAIL  S2   no authorPubkey: entry.author (the definition's own author)
FAIL  S5   no .bs-idtags-row.is-parked
```

**`test/assistant-taggings-publish.test.js`:** 12 passed, 8 failed:

```
FAIL  E2   a parked tagging alone: 200 …; a parked tagging beside the offered one: 200 …
FAIL  E4   one row, the offered assistant tagging: got ["my-tapestry-owner","my-human"]
FAIL  E5   duplicates collapse: … (two rows)
FAIL  E7   one row; got ["my-tapestry-owner","my-human"]
FAIL  E8   still written locally (two writes)
FAIL  E9   partial: … (the parked row published too)
FAIL  E11  one local scan for the slug under the definition's author a73a2980…; got the retired author
FAIL  E12  alone: 200 …; beside the offered one: 200 …; the other parked one: 200 …
```

**Browser, against the build `localhost:7778` serves today** (`index-DUEUUBue.js`, the previous book's, whose UI
tree this branch still carries): 10 passed, 11 failed (54.7 s).
The page spec: B0 and B8–B12 pass; B1–B7 and B13 fail, each on the parked row that does not exist yet (`is-parked`,
"Not offered yet", a disabled box) or, in B7, on the tagging's `a`, which the old build points at the retired author.
The publish spec: B0 and B3–B5 pass; B1, B2 and B6 fail on the parked row and on the POST, which the old build sends
with two keys. The passing cases pass on both builds by construction (B8–B10 never touch the parked row; the old
page shows "My Agent" as could-not-check, so it signs one tagging there too).

### After implementation (2026-09-22, `1ea0e9cc`; tests at `c61c3794`)

Recorded by the Tester for the Reviewer, who re-runs everything (nothing here is trusted on its own). Node 22.23.2
throughout, the local stack up.

- **One Tester-lane correction after the suite's first run against the implementation,** its own `test:` commit
  (`c61c3794`): S5 read the whole of BIBLE.md, whose "Last updated" changelog line carries the historical phrase
  "its two identification taggings" in a "prior:" entry; S5 now reads the body and leaves the changelog its history.
- **The three suites:** `assistant-attention` 39/0 (H1 executed live), `assistant-identification-tags-page` 16/0,
  `assistant-taggings-publish` 20/0 (H1 executed live). The neighbours unchanged: `dual-z-writer` 14/0,
  `assistant-management-page` 24/0, `assistant-alert` 15/0, `default-deny-mutations` 14/0,
  `assistant-publish-relays` 39/0.
- **The book's gate** (§ How to run's recipe, 53 suites, on the committed tree), read with
  `npm run gate:status -- --label identification-tags-authorship-1-after`:
  `20260922T220123Z-58022-a4f8 [identification-tags-authorship-1-after] started 2026-09-22T22:01:23.241Z on 1ea0e9cc — PASS, exit 0, 794 passed, 0 failed, 114 skipped, 53/53 suites`.
  **Against the baseline** (the close gate `20260922T130828Z-49331-2d67`, compared suite by suite over the 53):
  50 unchanged; the only three that moved are this story's, each by its new cases — `assistant-attention`
  37/0 → 39/0, `assistant-identification-tags-page` 15/0 → 16/0, `assistant-taggings-publish` 19/0 → 20/0. None
  of this host's known red live suites is in the pattern set.
- **Browser, against the rebuilt UI on `localhost:7778`** (`scripts/dev-refresh.sh`: bundle `index-r3Y8NShy.js`,
  backend restarted 22:00:36 container time), the six classes run together: **64 passed, 1 skipped** (the hub
  spec's identification-tags placeholder case, skipped by design since the previous book), exit 0, 3.1 min —
  `assistant-identification-tags-page` 14/14, `assistant-taggings-publish` 7/7, `assistant-attention` 7/7,
  `assistant-alert` 10/10, `assistant-management-page` 22/22 + 1 skipped, `assistant-publish-result` 4/4.
- **Signed out, the real page** (the built-in browser): both cards render, each with its offered row and its
  parked row greyed, "Not offered yet", a disabled unchecked box; no console errors.
- **A genuine signed-in probe of the route** (a scratchpad script; the local owner's key from the Keychain signs
  the kind 22242 challenge; the key never leaves the process): anonymous POST → 401 from the middleware; the parked
  key `my-human` → 400 `not-an-assistant-tagging` with the approved words; `my-tapestry-owner` → 200 in 49 ms with
  one `tag-not-found` row (no definition by `a73a2980…` is reachable on this stack: nothing local, no tag-federation
  relay), and the local relay holds no tagging of the viewer afterwards. Nothing was signed or written.
- `bash scripts/harness-lint.sh`: clean.
