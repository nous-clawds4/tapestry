# Review: Story 4 — Is each Assistant's NIP-05 genuine, and a way into each Assistant's profile

**Verdict:** **PASS** (no blocking findings; three non-blocking, NB1–NB3. NB1 is a three-line fix worth taking before
production.)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-01
**Diff:** `git diff 6e1a3915..d9185db9` on `feat/my-assistants` (base = the book's shipping-record commit). 20 files,
1423 insertions, 37 deletions. Commits:
- `3239e5fe`, the story, book decision 14 and the epic's fourth entry;
- `c864253b`, ADR 0004;
- `851aa76a`, the failing tests, the test plan and the `/api/nip05/verify` mock in the three earlier specs. It touches
  nothing under `ui/` or `src/`;
- `d9185db9`, the implementation, the openapi entry and the story's § Deviations. It touches nothing under `test/` or
  `tests/`.

**Story:** `engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.md` (Approved; § Resolved at the story gate; § Copy as changed at the ADR gate; the Implementer's § Deviations)
**ADR:** `engineering-team/decisions/my-assistants/0004-nip05-status-from-the-verify-endpoint-and-plain-profile-links.md` (Accepted)
**Test plan:** `engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.test-plan.md`
**Book:** `engineering-team/audits/my-assistants/book.md` (acceptance frame, no PRD; decision 14 adds this story)

**In short:** the code does what ADR 0004 says, sub-decision by sub-decision. The copy matches § Copy byte for byte,
including the screen-reader label as changed at the ADR gate. The isolated gate passes, and so do the six host suites
and all 60 browser tests (180/180 with `--repeat-each=3`). Every server mutant I tried is caught, including one that
bypasses the address guard and one that drops the abort signal. The UI mutants are caught too, except the one NB2
names. The SSRF surface is unchanged: the same URL, through the same `guardedFetch`, with the same timeout and
`redirect: 'manual'`. The response gains only the three-way `status`. The profile pages are untouched. Nothing blocks.

The non-blocking findings:
- **NB1:** when a row that's already on screen gets a different NIP-05 on a refresh, it shows the old verdict for one
  render. The old verdict appears beside the new NIP-05, or beside "—" when the NIP-05 was removed. I caught it in a
  painted frame once in three runs.
- **NB2:** the ADR says "one lookup per distinct (profile, NIP-05) per page load" twice, but its sub-decision 4 and
  the code ask again for an unchecked one each time it's redrawn. Nothing pins either reading.
- **NB3:** the DNS-rebinding row says a lookup's result is never returned to the caller. With `status`, part of it is
  now. In practice that adds nothing, but the row should say so.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, by the network-isolated CI reproduction** (`ledger/2026-09-30-npm-test-step-leaks-fixtures.md`).
  Nothing ran against `localhost:7778`, and nothing could reach a relay. The steps:
  - a full clone of `feat/my-assistants` at `d9185db9`, history kept, copied into a Docker named volume with
    `COPYFILE_DISABLE=1 tar --no-xattrs`, and `chown -R root:root` inside it;
  - `npm ci` in `node:22-bookworm`, with network;
  - `GATE_LABEL=review-my-assistants-4 npm test` with `--network none` and `CI=true`. The output went to a host file
    outside the copied tree.

  The verdict, read with `npm run -s gate:status -- --label review-my-assistants-4` (exit 0):

  > `20261001T194333Z-20-c964 [review-my-assistants-4] started 2026-10-01T19:43:33.695Z on d9185db9 — PASS, exit 0, 4467 passed, 0 failed, 591 skipped, 254/254 suites · /w/repo/tmp/gate-runs/20261001T194333Z-20-c964.json`

  - **The record:** `node: v22.23.3`, `git: { commit: d9185db9…, branch: feat/my-assistants, dirty: false }`.
  - **Per suite:** `my-assistants-nip05` 13/0/0, `nip05-ssrf-guard` 21/0/0, `nip05-checkmark-verification` 4/0/0,
    `my-assistants-map` 14/0/0, `my-assistants-actions` 29/0/0, `my-assistants-page` 50/0/2 (the H-class skips with
    no network), `harness-lint` 76/0/0, `stack-free-npm-test` 6/0/1.
  - **Against review 3:** 4454 → 4467 passed and 253 → 254 suites, which is exactly the new suite's 13 tests.
  - **Cleanup:** the volume has been removed.
- [x] **The six suites the brief allows, on the host**, each through its `run()` export (Node v24.18.0):
  - `my-assistants-nip05` `{"pass":13,"fail":0}`;
  - `nip05-ssrf-guard` `{"pass":21,"fail":0}`;
  - `nip05-checkmark-verification` `{"pass":4,"fail":0}`;
  - `my-assistants-map` `{"pass":14,"fail":0}`;
  - `my-assistants-actions` `{"pass":29,"fail":0}`;
  - `my-assistants-page` `{"pass":52,"fail":0,"hExecuted":2}`.
- [x] **The red phase, re-checked** in a `git archive` of `851aa76a` (tests, no implementation): `my-assistants-nip05`
  2 passed, 11 failed. The two that pass are V4 and V5. That matches § Verification.
- [x] **Phase separation:** `851aa76a` changes nothing under `ui/` or `src/`, and `d9185db9` changes nothing under
  `test/` or `tests/`.
- [x] **Playwright** (chromium). HEAD's `ui/` was built into a scratch `outDir` and served by `vite preview` on :4176:
  - `BRAINSTORM_BASE_URL=http://localhost:4176 npx playwright test tests/brainstorm/my-assistants-nip05.spec.js tests/brainstorm/my-assistants-map.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-actions.spec.js --project=chromium`:
    **60 passed** (10 for this story; 50 from stories 1–3, with the added mock);
  - the same with `--repeat-each=3`: **180 passed**;
  - before running, I checked the guards. The new spec mocks `/api/publish-policy` as `allowExternalPublish: false`,
    mocks `/api/strfry/publish`, and stubs `window.nostr`. It blocks and counts WebSockets at the browser-context
    level, so a tab opened by a profile link is covered too. It serves `/user/*` a stub page and mocks
    `/api/nip05/verify`. Every test asserts zero sockets. The three earlier specs each gained only the
    `/api/nip05/verify` mock.
- [x] **Mutants**, in a scratch export of `d9185db9`, never in the repo. Each UI mutant was built separately and
  served on :4177.

  | Mutant | Fails | Reading |
  |---|---|---|
  | S-A: unreachable reads invalid (`nip05.js:186`) | V1 | bites |
  | S-B: `verified` true for anything but invalid (`:182`) | V1, V3; `nip05-ssrf-guard` C3 | bites |
  | S-C: `names` as an array counts as answered (`:155`) | L1, V1 | bites |
  | S-D: `guardedFetch` replaced by plain `fetch` (`:144`) | L1, L2; `nip05-ssrf-guard` C1, C3, D1 | bites: the guard is pinned |
  | S-E: the abort signal dropped (`:146`) | L2; `nip05-ssrf-guard` D1 | bites: the timeout is pinned |
  | S-F: `verifyNip05Identifier` answers `''` when unreachable (`:166`) | V5; `nip05-ssrf-guard` C1, D2 | bites |
  | U-A: a failed request or a non-2xx reads invalid (`Nip05Status.jsx:26`, `:28`) | N3 | bites |
  | U-B: the section shows no status (`MapOnlySection.jsx:34`) | N2, N3, N4, N6 | bites, as the plan says |
  | U-C: the link moved into the row's toggle, after the status (`AssistantRow.jsx:61`, `:123`) | P1 | bites. The plan lists N1 and P1; N1 catches it only for some placements (see Test quality) |
  | U-D: an unchecked answer is cached too (`Nip05Status.jsx:31`) | nothing | **survives:** NB2 |
  | U-E: no `rel` on the link (`ProfileLink.jsx:17`) | P1, P2 | bites |

  Every control run (the restored files) passes.
- [x] **Probes.** These ran as a scratch spec that reuses the story spec's `setup()`, with every guard on and the
  socket count at 0. Its profiles mock could be changed mid-test. It ran against HEAD's build.
  - **R1, unchecked on a tab round trip:** three Duties → Assistants round trips. Bea's `bea@down.example` (answered
    unchecked) was asked **4** times; Zed, Ava and Dee once each (NB2).
  - **R2, a mounted row's NIP-05 changes on a refresh.** Ava starts as `ava@bad.example`, Not valid. Then her kind 0
    says `ava@new.example`, its check is held, and a Tag press refreshes the list. A MutationObserver on her NIP-05
    field recorded `"ava@bad.example Not valid"`, then **`"ava@new.example Not valid"`**, then
    `"ava@new.example Checking…"` (NB1).
  - **R3, a mounted row's NIP-05 is removed on a refresh:** `"ava@bad.example Not valid"`, then **`"— Not valid"`**,
    then `"—"` (NB1).
  - **R5, whether R3's state is painted:** a `requestAnimationFrame` loop recorded the field once per frame, three
    runs. One run recorded a frame with `"— Not valid"`; two went straight to `"—"`.
  - **R4, accessible names.** Each list row's toggle is named with its NIP-05 then its status: `button "Ava … NIP-05
    ava@bad.example Not valid …"`, `"… zed@ok.example Verified …"` (the ✓ hidden), `"… bea@down.example Checking…
    …"`. Cy, with no NIP-05, has `"NIP-05 —"` and nothing after it. The open row has `link "View profile of Ava
    (opens in a new tab)"`, `/url: /user/c1c1…`, between Manage on Treasure Map and Change. The section has one link
    per item, before its Tag buttons.
- [x] **The Deviations' real-domain checks, re-run** from Node with HEAD's `src/api/nip05.js`, reads only:
  - `lookupNip05('matrix_end_178d@brainstorm.world')` → `answered`, `4b7ba0a1…`;
  - the verify handler gives `{"verified":true,"status":"verified"}` for that key and
    `{"verified":false,"status":"invalid"}` for another;
  - an unlisted name on brainstorm.world gives `invalid`, and a `.invalid` domain gives `unchecked`. That's four
    outside requests in all; the last was refused at DNS by the guard.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations; WAIVED lines only) before writing this file.
- [x] **Hygiene sweeps** on every added line under `ui/`, `src/`, `test/` and `tests/`:
  - no `console.log` outside the test runner's report lines, and no `debugger`, TODO, `nsec` or `82b75e47`;
  - no 64-hex literal under `ui/` or `src/`;
  - no raw control bytes in any of the 20 files (perl).
- [x] `src/api/openapi.yaml` parses (js-yaml), and the new path's tag, `Profiles`, is a declared tag.
- [ ] _Lint, typecheck and build are not configured, so they were skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [x] No criterion is silently dropped.
- [x] No behavior added that isn't in the story.

| AC | Tests (all pass) | Notes |
|---|---|---|
| AC-1 three honest states | L1, L2, V1–V5, M1; N1, N2, N3 | The server's classification follows sub-decision 2's table for all 21 cases. A failed request, a non-2xx, or an answer without a known `status` reads Couldn’t check (`nip05StatusOf`, `Nip05Status.jsx:26-28`). "Checking…" until an answer, on both surfaces (N2, sampled). One-render exception: NB1. |
| AC-2 where it shows | M3; N1, N4, N5 | Every list row, the Local one included, and every section item. No NIP-05: "—" and no status, and nothing is asked (`nip05Id` null). The search results get `nip05Id` from `cardFields` but render no status, and nothing is asked for them (N5). |
| AC-3 says what it means | M4; N1, N4; R4 | The states differ by their words; colour only repeats them. Each verdict's `title` is § Copy's explanation. A screen reader hears the status inside the row's toggle name, right after the NIP-05 (R4). |
| AC-4 a link to each profile | M2, S1; P1, P2, P3 | Open rows (the untagged Local row too), each section item, and each Assistant of an open duty, Preferred and Alternates (P3: Ava, Bea, Dee). |
| AC-5 a new tab, named | M4; P1–P3 | `target="_blank"`, `rel="noopener noreferrer"`, `aria-label` "View profile of {name} (opens in a new tab)". P1 opens it and lands on `/user/<pubkey>`. |
| AC-6 nothing else changes | the 50 earlier browser tests; P1, P3, P4 | No link sits inside an `[aria-expanded]` element (P1, P3). Pressing the link leaves the row open (P1). 375 px: no sideways scroll, nothing clipped (P4). |

**Copy:** I compared all nine § Copy rows byte for byte against `COPY` (`ui/src/pages/assistants/myAssistants.js:87-97`).
I parsed the story's table and stripped only the "(with a check mark)" note and the "Changed at the ADR gate" note.
There are no mismatches:
- the apostrophes are U+2019, and the ellipsis in "Checking…" is U+2026;
- "View profile ↗" is `COPY.viewProfile` plus the `aria-hidden` arrow (`ProfileLink.jsx:20`);
- `viewProfileLabel('{name}')` is exactly the changed label, "View profile of {name} (opens in a new tab)".

## ADR adherence

- [x] The files changed match § Implementation notes: `src/api/nip05.js`, `src/api/openapi.yaml`, `myAssistants.js`,
  the two new files, `AssistantRow.jsx`, `MapOnlySection.jsx`, `DutiesTab.jsx` and `styles.css`. `Index.jsx` didn't
  need a change, because the rows and the section's items are both built by `buildRows` → `cardFields`
  (`Index.jsx:115`), so `nip05Id` reaches both.
- [x] Layering is respected. The classification lives on the server beside the guard. The view-model functions are
  pure and Node-loaded (M1–M4). The fetch and its cache live in the component file.
- [x] No new dependencies. Every CSS variable the new rules use (`--bsd-faint`, `--accent`, `--accent-hover`) is
  defined for the design page (`styles.css:9341-9348`).

**Each sub-decision, against the code:**
1. **`lookupNip05`** (`src/api/nip05.js:135-158`):
   - it returns `malformed` for a non-match of the unchanged `NIP05_LOOKUP_RE` (`:137`), with nothing fetched;
   - it returns `unreachable` for a `null` from `guardedFetch`, a non-`ok` response (`:149`), a throw, including the
     abort and a JSON parse error (`:151-152`), and `names` that's missing, not an object, or an array (`:155`);
   - otherwise it returns `answered`, with `names[name] || names[name.toLowerCase()]` when that's a 64-hex string,
     else `null` (`:156-157`).

   The URL, the `guardedFetch` call, the 5 s `AbortController` and the regexes are unchanged. `redirect: 'manual'` is
   still set inside `guardedFetch` (`src/utils/ssrfGuard.js:258-268`), and nothing under `src/utils/` changed. L2
   pins the URL, `redirect` and the signal, and mutants S-D and S-E prove it.

   `verifyNip05Identifier` (`:164-167`) is built on top. It differs from the old one only on listings that NIP-05
   wouldn't accept, and there it's stricter: a `names` array indexed by a numeric name, or a non-string value that
   stringifies to hex, now gives `null`. Its only remaining caller is the SSRF suite (21/21); the endpoint now calls
   `lookupNip05`.
2. **The endpoint** (`:178-192`):
   - one helper, `answer(status)` (`:182`), writes `{ verified: status === 'verified', status }`, so the rule
     `verified === (status === 'verified')` holds by construction;
   - a non-64-hex `pubkey` gives `unchecked` before any lookup (`:183`, V3);
   - `unreachable` gives `unchecked`; `answered` with the same key gives `verified`; everything else gives `invalid`,
     and that's only `malformed` or `answered` (`:186-188`);
   - a throw gives `unchecked` (`:190`), and `no-store` is kept (`:179`, V4).

   The table matches row for row. The comparison's `.toLowerCase()` on the listed key is dead code, because the
   listed key already matched the lowercase-only `HEX_PUBKEY_RE`, but it's harmless. A missing `nip05` now answers
   `invalid` (`malformed`) instead of a bare `{ verified: false }`. Neither makes a request, and the page never sends
   one without a NIP-05.
3. **The view-model** (`myAssistants.js:146`, `:418-430`): `nip05Id` is `textOf(profile.nip05)`, so it's trimmed and
   `null` for anything that isn't text. `nip05StatusOf` passes through the three statuses and turns everything else
   into `unchecked`. `profilePath` is `/user/${pubkey}`.
4. **The page** (`Nip05Status.jsx`): GET only; a non-2xx or a throw is `unchecked` (`:26-28`). The module-level cache
   holds only `verified` and `invalid` (`:31`), and in-flight requests are shared (`:24`, `:34`). The component
   renders nothing for `null`, "Checking…" while checking, and otherwise one `span` with an `is-<state>` class, the
   word, an `aria-hidden` "✓ " for Verified, and the `title` (`:57-68`). Its placement after the value in the row's
   NIP-05 field (`AssistantRow.jsx:61`) and in the section's meta line (`MapOnlySection.jsx:34`) is as the ADR says.
   The hook's contract, "`'checking'` until an answer", breaks for one render when its NIP-05 changes under it: NB1.
5. **The link** (`ProfileLink.jsx`): a plain `<a>` with `href={profilePath(pubkey)}`, `target="_blank"`,
   `rel="noopener noreferrer"` and the label. It sits in the open row's panel actions (`AssistantRow.jsx:123`), first
   in each section item's actions (`MapOnlySection.jsx:39`), and at the end of each `li` of an open duty
   (`DutiesTab.jsx:67`). None of those is inside a toggle `button`.
6. **Styles** (`styles.css:9773-9786`): the base status is `--bsd-faint`, Verified is `#047857` and Not valid is
   `#92400e`, as specified. The link copies `.bsd-ma-duty-link`'s font, weight, colour and hover, plus a focus ring.
   One existing rule is touched: `.bsd-ma-maponly-actions` gains `align-items: center`, which lines the new link up
   with the Tag buttons. P4 passes at 375 px.

## The Implementer's deviations, judged

- **Where the status sits:** the row's NIP-05 field is a flex column (`styles.css:9587`), so the status stacks under
  the value; in the section it follows on the same line. Both are "after the NIP-05 value", as the ADR says. Fine.
- **Where the link sits:** matches R4 and the code. Fine.
- **An array answer reads Couldn’t check:** that's `nip05StatusOf`, and M1 includes `[]`. Fine.
- **openapi:** accurate, see below.
- **The real-domain checks:** reproduced above, all four.

None of these changes an ADR decision.

**`openapi.yaml`** (`:2062-2097`) says:
- it's public and read-only, through the address guard, with non-public hosts refused, no redirects followed and a
  5-second timeout;
- what each status means, in words that match sub-decision 2;
- that `verified` is true exactly when `status` is `verified`;
- that the answer is `no-store`.

All of that is accurate. The schema's enum is the three statuses.

## Honest states, by surface

| The check | List row (inside the toggle) | Not-tagged section | Search results |
|---|---|---|---|
| no NIP-05 | "—", no status, nothing asked (N1) | "—", no status, nothing asked | no status (N5) |
| in flight | "Checking…", no verdict, sampled (N2) | "Checking…", no verdict, sampled (N2) | — |
| verified / invalid / unchecked answer | the word, with its title (N1) | the word, with its title (N4) | — |
| 500, network abort, answer without `status` | Couldn’t check, never Not valid (N3) | Couldn’t check, never Not valid (N3) | — |
| the NIP-05 changes on a refresh, row on screen | the previous verdict for one render, then "Checking…" (R2, R3, R5): **NB1** | same component, same path | — |

## Accessibility

- [x] **The status** is text inside the row's toggle, so it's part of the toggle's name, right after the NIP-05
  (R4). The check mark is `aria-hidden`, so a screen reader hears "Verified". The `title` explains it on hover.
  Nothing new is interactive inside the toggle.
- [x] **The link's name** includes its visible words ("label in name", ADR sub-decision 5), names the Assistant, and
  says it opens a new tab. The arrow is `aria-hidden`. There's a visible focus ring.
- [x] **No nested interactives:** P1 and P3 assert no `a` inside an `[aria-expanded]` element.

## Security and POV

- **SSRF surface: unchanged.** No new fetch path. The URL is built the same way, from the same regex's capture
  groups, and fetched through the same `guardedFetch` with the same 5 s abort (`nip05.js:141-148`); `ssrfGuard.js` is
  untouched. Mutants S-D and S-E show the suites would catch a regression. The page fetches only same-origin
  `/api/nip05/verify`, with both parameters URL-encoded.
- **What the response reveals.** It's exactly `{ verified, status }`: no upstream status code, error text or body.
  The new information is one classification, "the domain served a JSON listing with a `names` object", against
  "it didn't" (or "it couldn't be asked").
  - **For public hosts,** anyone can learn that by fetching the URL themselves.
  - **For the open DNS-rebinding gap,** a rebind to an internal host would now say whether that host served such a
    listing. But the fetch is `https:` and Node validates the certificate against the attacker's hostname, which no
    internal service can present. No `NODE_TLS_REJECT_UNAUTHORIZED` or `rejectUnauthorized` override exists under
    `src/` or `setup/`. So in practice it adds nothing, and the rebinding row's wording should catch up (NB3).
- **Request volume.** In-flight requests are shared per (pubkey, NIP-05), and a definite answer is never asked twice
  in a page's life (N6). An unchecked one is asked again whenever it's redrawn (R1; NB2), at most one at a time per
  key, each bounded by the 5 s abort. The endpoint was already public and unthrottled, so a page view opens nothing
  that `curl` couldn't.
- **Profile pages unaffected.** `useNip05Verification.js`, `BrainstormProfile.jsx` and `users/UserDetail.jsx` aren't
  in the diff. The hook reads only `data?.verified === true` (`useNip05Verification.js:38`), whose meaning is
  unchanged, and `nip05-checkmark-verification` passes 4/4.
- **POV-first and permissionless:** a NIP-05's status is a fact about a domain's listing, not a per-POV judgment,
  and nothing is gated or stored (`no-store`; the client cache lives only as long as the page).
- **Local-first (principle 4):** nothing writes to the graph.
- **The TA-pubkey rule:** no TA pubkey is used, and there's no 64-hex literal under `ui/` or `src/` (S1 checks the two
  new files). The tests take Nous' key from `REQUIRED_TAGGINGS`.

## Test quality

- **Coverage:** see the AC table. Every AC has tests that bite (red at `851aa76a`, green at HEAD, and the mutants).
- **The plan's mutant table:** I re-ran a sample of 11 of its kind. They match, with one wrinkle. The plan says "the
  link inside the row's toggle" fails N1 and P1. My version (the link right after the status) fails only P1. N1's
  `ava@bad.example\s*Not valid` still matches when the link comes after the status, so N1 catches the mutant only
  for some placements. P1 (`[aria-expanded] a` count 0) is the real pin, and it holds.
- **The "unchecked is retried" half of sub-decision 4 is unpinned:** U-D survives (NB2).
- **Transitions aren't pinned:** the honest-state tests hold an answer and sample, which is right for "never a
  verdict while checking". Nothing exercises a NIP-05 changing under a mounted row (NB1). A change log
  (MutationObserver) is the tool that catches a one-render flash; sampling isn't.
- **The earlier specs' re-aim:** each gained one route, answering `unchecked`. Their assertions are unchanged. A
  status inside the toggle doesn't break their row-text checks (all 50 pass).

## Scope

Nothing beyond the story:
- no change to the profile pages or their mark;
- no status in the search results;
- no re-check on demand;
- the Meili and admin copies of the check are untouched;
- no redirect following, rate limiting or server cache.

The one change to an existing style rule (`.bsd-ma-maponly-actions { align-items: center; }`) serves the new link.

## Concept-graph integrity

- [x] No concept, handle or definition is added or changed. NIP-05 isn't a graph concept.
  `39998:<TA>:nostr-user-tag` is only where the linked profile page gets its tags.
- [x] Firmware reinstall: not needed (ADR § Consequences).
- [x] Orientation: nothing re-derives concepts.

## Things tests can't catch

- [x] **Secrets:** none (sweep).
- [x] **Debug code:** none.
- [x] **Commented-out code:** none.
- [ ] **Edge cases:** NB1. Also checked, with no finding:
  - `NIP05_LOOKUP_RE` is byte-identical to nostr-tools' `NIP05_REGEX`
    (`ui/node_modules/nostr-tools/lib/esm/nip05.js:2`). So a Unicode domain or a port reads Not valid here as it
    fails there;
  - a domain listing the key in uppercase hex reads Not valid, as nostr-tools' exact `res.pubkey === pubkey` would;
  - a page-shown NIP-05 is trimmed before it's sent.
- [x] **Concurrency:**
  - the `cancelled` flag drops a stale answer after unmount or a key change (`Nip05Status.jsx:43-46`);
  - in-flight requests are shared, so a quick remount reuses the pending request;
  - the cache is written only when the answer settles.
- [x] **Input at boundaries:** both query parameters are type-checked. `pubkey` is lowercased and must be 64-hex. The
  identifier must match the regex before anything is fetched. Prototype-named keys (`__proto__`, `constructor`) in
  a listing are non-strings, so they give `null`, which reads invalid, as before.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

No PRD. The copy matches § Copy (above). The states are told apart by words. Colours follow the ADR, and the faint
grey for Couldn’t check is the same one the page already uses for "Not on Treasure Map" (`styles.css:9689`).
Placement is per § Deviations, and 375 px passes (P4).

## Findings

### Blocking

None.

### Non-blocking

1. **NB1: a row that's already on screen shows its previous verdict for one render when its NIP-05 changes.**
   `ui/src/pages/assistants/Nip05Status.jsx:39-48`.
   - **Why:** the status lives in `useState` and is reset only by the effect (`:44`). The render with the new
     `nip05Id` happens before the effect runs, so it still returns the old status (`:48`).
   - **Seen:** R2 recorded "ava@new.example Not valid" before "Checking…". R3 recorded "— Not valid", a status beside
     a row with no NIP-05, which AC-2 rules out. R5 caught that state in a painted frame in one run of three.
   - **When:** a profile's kind 0 changes its NIP-05 while the page is open, and then a press refreshes the list
     (`Index.jsx:71` re-reads profiles). The section is the same component on the same path.
   - **Why it doesn't block:** it lasts one render, on a rare path. It isn't in a live region, so nothing is
     announced.
   - **But** it's exactly the claim AC-1 ("never a verdict" while checking) and sub-decision 4 ("`'checking'` until an
     answer") rule out, and the fix is small.
   - **Suggested:**
     - keep the key with the answer, for example `useState({ key, status })`;
     - in render, return `null` when there's no `nip05Id`, and return `known.get(key) || 'checking'` whenever the
       stored key isn't the current one;
     - add a browser case like R2/R3 that records the NIP-05 field's changes with a MutationObserver and fails on
       any verdict next to a NIP-05 it wasn't checked for.

     If the owner prefers to ship as is, file a ledger row instead.
2. **NB2: the ADR says one lookup per distinct (profile, NIP-05) per page load; the code and sub-decision 4 re-ask an
   unchecked one each time it's redrawn, and nothing pins either reading.**
   ADR 0004 `:48-49` (Context) and `:185-187` (Consequences), against `:136-137` (sub-decision 4);
   `Nip05Status.jsx:31`; test plan `:25` (N6).
   - **Seen:** three tab round trips asked `bea@down.example` four times (R1). Mutant U-D, which caches unchecked
     answers too, passes every test.
   - **Not a security issue:** requests are shared while in flight, so there's at most one per key at a time, each
     ≤ 5 s, paced by the viewer's own clicks, on an endpoint anyone can already call.
   - **But** the brief's "no more than once per distinct (pubkey, NIP-05) per page load" isn't true as built, and the
     ADR says both things.
   - **Suggested:** correct the two sentences to "one lookup per distinct (profile, NIP-05) per page load, plus a
     retry each time a Couldn’t check is drawn again". Then either pin the retry (extend N6 to count Bea's asks across
     the round trip), or, if the owner prefers one ask per page load, cache `unchecked` too and pin that instead.
3. **NB3: the DNS-rebinding row says a lookup's result is "never returned to the caller"; `status` now returns a
   classification of it.**
   `ledger/2026-09-20-nip05-guard-leaves-dns-rebinding-open.md:20-22`; ADR 0004 `:46-47`; `src/api/nip05.js:182-188`.
   - The response now says whether the fetched URL served a JSON listing with a `names` object.
   - Through a rebind that would need an internal host presenting a valid certificate for the attacker's hostname
     (see Security), so in practice the posture holds.
   - **Suggested:** one sentence in the row's "What bounds it today", or in ADR 0004's Context bullet: since
     my-assistants #4 the endpoint returns `status`, which distinguishes "served a NIP-05 listing" from "didn't";
     with `https:` and certificate validation, a rebind still learns nothing about an internal service.

### Harness friction

1. **Honest states pinned per state and per surface, but not per transition.** Row
   `2026-10-01-honest-states-pinned-per-state` asks the test plan to list every surface that can show a forbidden
   claim. This story's plan did that: N2 and N3 cover the list and the section. The gap was a third axis, the input
   changing under a surface that's already showing an answer (NB1). Sampling can't see a one-render flash; a change
   log can.
   - **Candidate:** extend that row rather than open a new one. For a "never claim X while…" rule, also pin the
     transition where a mounted surface's input changes, with a change-log assertion. This qualifies the test-design
     note that a held answer plus sampling beats a change log: that's true for held states, not for transitions.
2. **The Reviewer wiring says commit and flip the status; this brief said neither.** OPEN.md row 316 already records
   this. Nothing new.

## Close-out

- **Story status:** for the caller. Per the brief, I edited only this file and committed nothing. So `**Status:**
  Done` on the story belongs in the commit that carries this review (row 316). Until then, harness-lint will report
  that this review is PASS-final while the story is still Approved, and the flip clears it.
- **Completion detection:** reported in the chat, not here (template).

## Verdict
**PASS**

The diff matches the story, ADR 0004 and the test plan:
- the copy is byte for byte;
- the server classification follows sub-decision 2's table, and `verified` stays exactly `status === 'verified'`;
- `verifyNip05Identifier`, `guardedFetch`, the timeout and redirect handling are unchanged and pinned;
- the links meet AC-4 to AC-6.

The isolated gate is PASS on `d9185db9` (`20261001T194333Z-20-c964`). The host suites pass, and so do 60/60 browser
tests (180/180 repeated). Every server mutant and four of the five UI mutants are caught. The SSRF surface didn't
widen, and the profile pages are untouched.

NB1 (a one-render stale verdict) is worth the three-line fix before production. NB2 and NB3 are record corrections.
