# Review: Story 1 — The My Assistants page, its menu link, and the list of your Assistants

**Verdict:** **PASS** (after re-review; see "Re-review, round 2" at the bottom. Round 1 asked for changes over one blocking finding, which is fixed and pinned by new tests; three new non-blocking notes are listed there.)

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-30
**Diff:** `git diff 58abd891..80276b46` on `feat/my-assistants` (base = `staging` at `58abd891`). Commits: `1f5a2caf` (story, book, epic, blueprint), `b4f45bf1` (ADR), `dac84487` (failing tests and test plan), `a63b3ae9` (the implementation, the focus here), `80276b46` (two ledger rows). 24 files, 2866 insertions, 45 deletions.
**Story:** `engineering-team/stories/my-assistants/1-the-my-assistants-page.md` (Approved; owner's gate answers in § Resolved at the story gate; Implementer's § Deviations)
**ADR:** `engineering-team/decisions/my-assistants/0001-one-session-read-lists-your-assistants.md` (Accepted; dated correction on `NOSTR_USER_TAG_Z_TAG`)
**Test plan:** `engineering-team/stories/my-assistants/1-the-my-assistants-page.test-plan.md`
**Book:** `engineering-team/audits/my-assistants/book.md` (acceptance frame, no PRD); epic `engineering-team/epics/my-assistants.md`

**In short:** one blocking defect. The server rule, the endpoint, the frame lift, the menu and every AC-listed state are correct and well tested. But a single listed profile whose kind 0 has a non-string `display_name` or `name` (a number, a boolean, an object) makes the view-model throw. The page then shows "Couldn’t load your Assistants." with no rows, even though the taggings were read fine, and Try again repeats it every time. That breaks AC-4 ("still listed, with those fallbacks") and AC-6 (the error line is for when "the taggings can't be read"). The fix is a type guard of the kind `valueOr` already applies to URL and NIP-05, plus a C-class case.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network during the test run.** The CI job (`.github/workflows/test.yml`: Node 22, `npm ci && npm test`, no stack), in Docker. Full clones of `feat/my-assistants` (HEAD `80276b46`) and of `58abd891`, copied into Docker named volumes. `npm ci` ran with network in a `node:22-bookworm` image; `npm test` ran with `--network none`, so every live suite skipped and nothing could reach a relay. Nothing ran against `localhost:7778` and nothing published. Verdict read with `npm run -s gate:status -- --label …` (exit 0), not from piped output:

  > `20260930T213125Z-20-ca8a [review-my-assistants] started 2026-09-30T21:31:25.814Z on 80276b46 — PASS, exit 0, 4202 passed, 0 failed, 591 skipped, 245/245 suites · /w/tmp/gate-runs/20260930T213125Z-20-ca8a.json`

  The record's fields: `node: v22.23.3`, `git: { commit: 80276b46…, branch: feat/my-assistants, dirty: false }`. `my-assistants-page` is PASS 48/0/2 (the two H-class live cases skip with no network).

  **Against the base**, the same recipe on `58abd891`:

  > `20260930T213125Z-20-1952 [review-my-assistants-base] started 2026-09-30T21:31:25.792Z on 58abd891 — FAIL, exit 1, 4153 passed, 1 failed, 589 skipped, 244/244 suites; failed: tagging-edges-realtime-wrapper · /w/tmp/gate-runs/20260930T213125Z-20-1952.json`

  I compared the two records suite by suite on `verdict/pass/fail/skipped`. Only two suites differ: the new `my-assistants-page` (absent on base) and `tagging-edges-realtime-wrapper`. That one failed RW15 on base only ("the first wrapper's process group still had members 3 s after it was SIGKILLed") and passed 22/0/0 on head. The two gates ran at the same time on one Docker VM, so this looks like a timing flake under load. It isn't this diff's (see Harness friction 2). **No failure is new on head.**
- [x] **The story's suites on the host**, each through its `run()` export, after grepping each for `strfry/publish`, `nak`, `method: 'POST'`, `firmware/install`, `docker exec` (none write; `stack-free-npm-test` G2 runs `tag-detail` live, which only reads). Host Node v24.18.0:
  - `test/my-assistants-page.test.js`: `{"pass":50,"fail":0,"skipped":0}`. The H-class ran: "H-class 2 executed / 0 skipped" (H1: an anonymous GET of `/api/assistant/my-assistants` on `:7778` answers `{"success":true,"signedIn":false}`; R0-2: `/assistants` gets the app shell).
  - `test/dictionary-concepts.test.js`: `{"pass":25,"fail":0,"skipped":0}`. S7–S9 are unchanged by the frame move, as the ADR requires.
  - `test/stack-free-npm-test.test.js`: `{"pass":7,"fail":0}`. The registry entry satisfies G1–G7.
- [x] **Playwright** (`tests/brainstorm/my-assistants.spec.js` and `tests/brainstorm/dictionary-concepts.spec.js`, chromium):
  - Against the local container, `BRAINSTORM_BASE_URL=http://localhost:7778`: **23 passed**. The container's server files match HEAD (`sha1` of `myAssistants.js` and `my-assistant-tags/index.js` equal; its `src/api/index.js` has the new route but lacks staging's tagging-edges routes, drift that predates this diff). But its `dist/` was built at 20:50Z, 9 minutes before `a63b3ae9` was committed. So I also:
  - built HEAD's UI into a scratch `outDir`, served it with `vite preview` on :4174, and ran both specs with `--repeat-each=3`: **69 passed, 0 failed**.
- [x] **D6 flake, checked, not this diff's:** `-g D6 --repeat-each=20` against a base build (`58abd891`, :4175) gave 13 passed / 7 failed. Against the HEAD build it gave 14 passed / 6 failed. The failure signature is the ledger row's (`Expected: "3333…,4444…"`, `Received: undefined`). The row `ledger/2026-09-30-dictionary-d6-reads-before-request.md` is accurate.
- [x] **Mutants spot-checked** (in a scratch clone, never in the repo). Each fails exactly the tests the plan claims:
  - an address deletion must be strictly after (`>=` → `>`): R14 fails;
  - the d fallback ignores the signer segment: R7 fails;
  - no untagged Local row: R18 and U2 fail;
  - a UI build that settles rows before the profiles: A7c fails (13 passed, 1 failed).
- [x] `bash scripts/harness-lint.sh`: clean (0 violations) before writing this file.
- [x] `src/api/openapi.yaml` parses (`js-yaml`): `/api/assistant/my-assistants` has `get` only, responses 200/500, `tags: [Auth]` like its neighbour `/api/assistant/attention`.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence

- [x] Every acceptance criterion has a passing test.
- [ ] No criterion is silently dropped. AC-4 and AC-6 break for a tagged profile with a malformed kind 0 (Blocking 1).
- [x] No behavior added that isn't in the story.

| AC | Tests (all pass) | Notes |
|---|---|---|
| AC-1 menu link | M1, M2 (every role, both profile bases); A8a (`/dictionary` top bar and `/` landing), A8b | The Tapestry header's menu isn't browser-tested. It renders the same `personalLinks` (`ui/src/components/Header.jsx:93`), which M2 pins. |
| AC-2 page | A1, A9, A10, A11; D1, D2; R0-2 live on `:7778` | 375 px checked by eye too (both widths: `scrollWidth` equals viewport width; long values wrap; the untagged Local prompt sits under its row). The "on staging" half can only be proven after the deploy (Non-blocking 3). |
| AC-3 which taggings | R1–R16, R20; U3–U6; T1–T4 | Matches ADR sub-decision 2 point by point (§ ADR adherence). |
| AC-4 each row | C2–C5, C7; A2, A6 | Fallbacks covered for `null`, `PROFILE_LOOKUP_FAILED`, `{}`, empty `display_name`. **Not covered: a non-string or blank name** (Blocking 1). |
| AC-5 Local, order, count | R17–R19; U2, U7; C1, C6, C8; A2, A3 | |
| AC-6 other states | U1, U8, S1, S2; A1, A4, A5, A7a–c, A11; H1 | Loading never shows empty or a count (sampled every 100 ms, three held phases). The error path is right for a failed read. Blocking 1 is an error shown when the read succeeded. |

**Copy:** every string in `ui/src/pages/assistants/myAssistants.js:17-33` and the heading/intro in `Index.jsx:106-110` matches story § Copy word for word, with curly apostrophes (a logged deviation, see below). The intro matches the blueprint's markup too.

**Owner's words:** the book's two verbatim blocks were compared byte for byte with the session transcript (`af0d3103….jsonl`). The ask equals the first user message exactly, "logged-un" included; the scope answers appear verbatim in the transcript.

## ADR adherence

- [x] Files changed match the ADR's implementation notes (plus the logged `openapi.yaml` entry).
- [x] Layering respected: the server rule is pure and Node-tested, and the view-model has no React and loads in Node (C9; the C-class imports it as ESM).
- [x] No new dependencies.

**Sub-decision 2, checked line by line against `src/api/assistant/myAssistants.js`:**
- **Candidates:** `federatedScan({kinds:[39999], authors:[viewer], '#z':[NOSTR_USER_TAG_Z_TAG]})` (`:126`); the constant comes from `profile-tags` via `defaultDeps().zTag` (`:40`), never re-typed. `newestStances` also drops any event not signed by the viewer (`:83`), so a sloppy relay can't inject another signer (U5).
- **Which tag:** the `a` first, when it is `39999:<64-hex>:<slug>` (`:32`, `:52-54`), with any author. Otherwise the publisher's d, whose last segment must equal `viewer.slice(0,8)` (`:33`, `:55-57`). The greedy `(.+)` plus the anchored `-8hex-8hex$` gives `my-tapestry-assistant-v2` its full slug, so it can't match. Unknown slugs and a non-64-hex `p` are dropped (`:84-86`).
- **Latest stance:** newest per (tag key, lower-cased `p`), later `created_at`, then the lowest `id` (`:71-77`). The key is 1:1 with the slug, so this is the ADR's "(slug, p)".
- **Retracted:** a kind 5 by the viewer whose `e` equals the latest's `id`, or whose `a` equals `39999:<viewer>:<its d>` with `created_at` at or after it (`:62-68`). Deletions are read by `#e` and `#a` in parallel, only when there are candidates (`:128-136`). `federatedScan`'s `dedupeReplaceable` keys on `pubkey|d || id`, and kind 5s carry no d, so no deletion collapses into another.
- **Apply only:** `polarityBucket(readPolarity(e)) === 'apply'`, from `src/lib/identification-tags` (`:102`). An absent polarity counts as an apply (R10).
- **Rows:** one per `p`; tags in `MY_ASSISTANT_TAGS` order, Brainstorm then Tapestry (`:111`); `local` marked; Local added with `tags: []` when absent (`:107`).

**The rest:**
- **Sub-decisions 1, 4:** the viewer comes only from `session.authenticated === true` plus a 64-hex `session.pubkey`, lower-cased (`:118-120`). That's stricter than the ADR's wording and pinned by U1. No `req.query` anywhere (S2). A non-64-hex Local answer is `null` (`:125`). A throw becomes the fixed 500 body, and the message is logged server-side only (`:138-141`).
- **Sub-decision 3:** `src/lib/my-assistant-tags/index.js` reads the Tapestry slug from `REQUIRED_TAGGINGS` and fixes `my-brainstorm-assistant`. Its only require is identification-tags (T4).
- **Sub-decisions 5, 7:** see § Things tests can't catch for the phases. Both link targets are read from their owners: `personalLinks`' `my-treasure-map` and `ASSISTANT_ACTIONS`' `identification-tags` (`myAssistants.js:39-43`; D2). The menu entry is directly after `my-treasure-map` (`avatarMenuLinks.js:105-112`). The route sits beside the `/dictionary` routes (`App.jsx:273-278`), and the API route beside `/api/assistant/attention` (`src/api/index.js:579-581`). No middleware or catch-all change.
- **Sub-decision 6 (frame, F1):** `ui/src/components/BrainstormDesignShell.jsx` is the old `DictionaryShell` body plus `wide`. `ui/src/pages/dictionary/DictionaryShell.jsx` is the one-line `export { default, Eyebrow } from …`. `/dictionary` keeps 720 px (A10), and its Node and browser suites pass unchanged. Every CSS variable the new `.bsd-ma-*` block reads is defined under `.bsd-page`. Chip, badge, Local-highlight and amber Not-tagged colours match the blueprint's values.

**The Implementer's deviations (§ Deviations), judged:**
- **Curly apostrophes:** allowed by § Copy ("follow the rest of the app"). They match `/dictionary` and the blueprint, and the tests accept either. Fine.
- **The `openapi.yaml` entry:** documentation of the new read, in the house pattern. Not an ADR deviation that needed escalating.
- **`role="status"` / `role="alert"`:** additive accessibility; nothing visible changes. Fine.
- **No export added:** correct, per the ADR's dated correction.
- **Unlogged and trivial:** `defaultDeps()` has a third dependency, `zTag` (Non-blocking 2).

None of these silently changes a decision the ADR made.

## Concept-graph integrity

- [x] Handles are in `kind:pubkey:slug` form. No handle literal is added in source. The canonical z is `profile-tags`' export on ADR 0015's legacy key (R0-1).
- [x] Firmware reinstall: not needed. No concept definition changed (ADR § Consequences).
- [x] The ADR oriented via `/api/concept-graph/node/…/neighbors`. No new code re-derives concepts.

## Things tests can't catch

- [x] **Secrets:** no secrets, `nsec`, private-key reads or 64-hex literals in the added source (swept with `/usr/bin/grep` over every `+` line under `src/` and `ui/`).
- [x] **Debug code:** no leftover `console.log`, `debugger`, TODO, or commented-out code. The one `console.error` is the handler's intended error log.
- [ ] **Edge cases:** Blocking 1 (malformed kind-0 names); Non-blocking 1 (astral first letter).
- [x] **Concurrency, in `ui/src/pages/assistants/Index.jsx`:**
  - Every `load()` takes a ticket (`latest`, `:75-79`), and a sign-out bumps it (`:97`). A stale answer from before a sign-out, an account switch or a double Try again is dropped.
  - `authLoading` forces the loading line whatever the view holds (`:101`).
  - Profiles are awaited before the one `settle` (`:87-88`), so rows appear once, in order.
  - A non-JSON 5xx makes `res.json()` throw, which lands in the error state. `fetchProfilesChunked` never throws (it marks failures), so a failed profile lookup still lists the rows (A6).
- [x] **Security:**
  - `GET /api/assistant/*` is public at the middleware (`src/middleware/auth.js:496-512`, not in `protectedGetEndpoints`). Without a real session the handler answers `{success:true, signedIn:false}` before any read (U1, and H1 live).
  - With a session it returns only the session holder's own public taggings, their Local pubkey (public anyway) and fixed strings. No parameter picks whose list is read, and the 500 body is a constant.
  - `getAssistantPubkeyFor` only reads key storage (`src/utils/assistantKeys.js:20-39`, `:99-110`). Nothing is written, signed or stored.
- [x] **Architecture invariants (CLAUDE.md):**
  - POV-first: the list is the session viewer's alone, with no parameter.
  - Principle 2: any author's same-named definition counts (R2), and no author gate on read.
  - Principle 3: nothing subjective is stored; the list is re-derived from raw events on every read.
  - No hardcoded TA pubkey. Local comes from `getAssistantPubkeyFor` at runtime (S2).
- [x] **Scope:** nothing from story 2 (no search, no tag, change-tag or remove actions, no signing, rows are `<li>` not buttons) or story 3 (no kind 10040 read, no Duties, no tab switch). The empty line's "Search above…" and the intro's "Open a row…" are the blueprint's words, kept by owner decision 6.

## House rules check

- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence

No PRD. The copy matches story § Copy (checked above). The design follows the blueprint extract, with designed loading, empty, error and signed-out states. The one intended departure is the untagged Local row, the owner's decision 5.

## Findings

### Blocking

1. **`ui/src/pages/assistants/myAssistants.js:72`**: a malformed kind 0 takes down the whole list.
   - **What happens:** `const name = profile.display_name || profile.name || short;` passes through any truthy non-string, and `/api/profiles` returns `JSON.parse(ev.content)` unvalidated (`src/api/profiles/fetchProfiles.js:91`, `:112`). With `display_name` set to a number, a boolean or an object, `name.slice(0, 1)` (`:78`) throws `name.slice is not a function`. An array can also throw in `a.name.localeCompare` (`:88`), depending on sort order. `buildRows` runs inside the page's `try` (`ui/src/pages/assistants/Index.jsx:88`), so the throw becomes `phase: 'error'` (`:89-90`).
   - **Reproduced** on the HEAD build: the read answered two rows, one profile had `{ display_name: 42, name: 'Sloppy bot' }`. The page showed "Couldn’t load your Assistants." with 0 rows. Try again re-read (`reads: 2`) and showed the error again.
   - **Why it matters:** anyone controls their own kind 0, and the list is whatever profiles the viewer tagged (anyone's, per AC-3; story 2's search makes that routine). One such profile hides every other Assistant, misreports the cause as a failed read, and can't be cleared by retrying. It contradicts AC-4 ("a profile whose metadata can't be found is still listed, with those fallbacks") and AC-6 (the error line is for when "the taggings can't be read"). The same function already guards URL and NIP-05 by type (`valueOr`, `:52-54`); the name has no such guard.
   - **Asked change:**
     - take `display_name`, then `name`, only when it is a non-blank string (trimmed, like `valueOr`), else the shortened npub. That also covers a whitespace-only `display_name`, which today renders a blank name and a blank avatar;
     - add a C-class case to `test/my-assistants-page.test.js` (C2, `:456-474`) with, for example, `display_name: 42`, `display_name: true`, `display_name: {}` and `display_name: '   '` plus a `name`. Each should fall through to `name`, or to `npubShort` when `name` is also unusable, and `buildRows` must not throw. The Tester owns that file, so either route it back to Phase 3 for the case or record the Tester's sign-off on the addition.
     - Optional hardening, not required: keep a throw in `buildRows` from reading as a failed read. For example, build the rows outside the `try` that maps a failed fetch to `error`.

### Non-blocking

1. **`ui/src/pages/assistants/myAssistants.js:78`**: `name.slice(0, 1)` splits a surrogate pair. A name starting with an emoji gets a lone `\ud83e` as its avatar letter (probed: `'🦊 fox'` → `"\ud83e"`), which renders as a replacement box. `Array.from(name)[0]` avoids it.
2. **`src/api/assistant/myAssistants.js:40`**: `defaultDeps()` adds `zTag`, a third dependency the ADR's implementation notes don't list (they name `getAssistantPubkeyFor` and `scan`). It's harmless and arguably right: it keeps the constant imported lazily, and U3 pins the value. It isn't in § Deviations; worth one line there.
3. **AC-2's "on staging" half** can't be proven before deploy (test plan § Test infrastructure). Carry it into `/cycle-staging`:
   - `BRAINSTORM_BASE_URL=https://staging.brainstorm.world` for H1 and R0-2 (both GET-only);
   - a direct load of `https://staging.brainstorm.world/assistants`.
4. **The local container isn't a faithful copy of HEAD's UI:** its `dist/` predates `a63b3ae9` by 9 minutes. The Playwright results here don't depend on it (re-run on a fresh HEAD build). Anyone reading the container as "this commit" should re-sync after the fix.

### Harness friction

1. **"Run `npm test`" conflicts, on this machine, with the fixture-leak row, and nothing points from one to the other.** Workflow 4 (Implementer), `roles/reviewer.md` step 1, `workflows/5-review.md` step 1 and this template's first checkbox all say to run `npm test`. On the Mac Studio that sends tag-suite fixtures through the enabled strfry-router streams to `wss://dcosl.brainstorm.world`. It happened in this story's Implementation: six kind 39999 events reached the public relay (`ledger/2026-09-27-test-fixture-taggings-on-prod-relays.md`, update 2026-09-30, which names the conflict). The network-isolated CI reproduction used here gives a real full-gate verdict safely. On this machine it needed two changes:
   - Docker Desktop does not share the session scratchpad (`/private/tmp/claude-501/…`). The bind mount came up empty and `npm ci` failed with `EUSAGE` (no lockfile). Copying the clone into a named volume works, with `COPYFILE_DISABLE=1 tar --no-xattrs`; without it, macOS AppleDouble `._pack-*.idx` files break git inside the volume.
   - `node:22-alpine` cannot `npm ci` on arm64 (`bufferutil`'s node-gyp build finds no Python). `node:22-bookworm` works and is closer to CI's Ubuntu.

   Suggested `meta` row: put a safe gate recipe or script behind the "run `npm test`" step in workflows 4 and 5 and the Reviewer role, or have the gate refuse to run live publishing suites when the router's streams are enabled.
2. **`tagging-edges-realtime-wrapper` RW15 failed once on base** (above), on a timing fixture, while two gate containers ran at once. One observation under load, and no ledger row names RW15. The CI workflow's comment claims a zero-flake record with no retries, so a row is warranted if it recurs.
3. **D6** (existing row `2026-09-30-dictionary-d6-reads-before-request`): confirmed at a comparable rate on base and head (7/20 and 6/20). No new row needed.

## Close-out

Not applicable this round. The story stays `Approved`: no status flip, and no completion detection (the book has two stories still to build). Stories 2 and 3 will extend this endpoint and view-model, so the name guard asked above also protects them.

## Verdict
**CHANGES_REQUESTED**

One blocking issue: Blocking 1 above (`ui/src/pages/assistants/myAssistants.js:72`, `:78`, `:88`; `ui/src/pages/assistants/Index.jsx:88-90`; the missing C-class case at `test/my-assistants-page.test.js:456-474`).

## Re-review, round 2 (2026-09-30)

**Reviewer:** Claude (acting as Reviewer)
**Diff:** `git diff d48cbeed..00c2abfc` on `feat/my-assistants`. Commits:
- `17f8aa70`, the Tester's amendment: C10, C11, A12 and the test plan's "Amendment after review 1";
- `7dd30cb2`, the fix plus two Deviations bullets;
- `abfabddd` and `00c2abfc`, the new `meta` ledger row and its rename to a valid id.

6 files, 132 insertions, 7 deletions. Nothing under `src/` has changed since `a63b3ae9`. The only UI change is `ui/src/pages/assistants/myAssistants.js`.

**In short:** the blocking finding is fixed.
- **No crash left:** `buildRows` no longer throws on any profile value `fetchProfilesChunked` can return. That holds in a 798-row fuzz and in the browser on HEAD's build.
- **Pinned:** C10 and A12 fail on a revert of the name guard, and C11 fails on a revert of the avatar letter. The amendment only adds tests.
- **Gate:** the network-isolated gate passes on HEAD.
- **Three new non-blocking notes:**
  - A12 checks less than its test-plan row says;
  - "whole character" means a whole code point;
  - the new ledger row has two accuracy gaps.

### Quality gates (run by reviewer, not trusted)

- [x] **`npm test`, reproduced as CI, with no network during the run.** This is round 1's recipe (`ledger/2026-09-30-npm-test-step-leaks-fixtures.md`), run on HEAD `00c2abfc`:
  - a full clone, copied into a named volume with `COPYFILE_DISABLE=1 tar --no-xattrs`, then chowned to root (see R2-3);
  - `npm ci` in `node:22-bookworm`, with network;
  - `GATE_LABEL=review-my-assistants-r2 npm test` with `--network none` and `CI=true`, as Actions sets it.

  Nothing ran against `localhost:7778` and nothing published. Verdict read with `npm run -s gate:status -- --label review-my-assistants-r2` (exit 0):

  > `20260930T221058Z-20-1f63 [review-my-assistants-r2] started 2026-09-30T22:10:58.189Z on 00c2abfc — PASS, exit 0, 4204 passed, 0 failed, 591 skipped, 245/245 suites · /w/repo/tmp/gate-runs/20260930T221058Z-20-1f63.json`

  - **The record:** `node: v22.23.3`, `git: { commit: 00c2abfc…, branch: feat/my-assistants, dirty: false }`.
  - **Against round 1** (`20260930T213125Z-20-ca8a`, 4202/0/591): two more passes, C10 and C11.
  - **Per suite:**
    - `my-assistants-page`: PASS 50/0/2. The two H-class live cases skip with no network.
    - `harness-lint`: PASS 76/0/0.
    - `tagging-edges-realtime-wrapper` (round 1's Harness friction 2): PASS 22/0/0.
  - **Cleanup:** the volume has been removed.
- [x] **The story's suites on the host**, each through its `run()` export. I grepped each first for `strfry/publish`, `nak`, `POST`, `firmware/install` and `docker exec`:
  - `my-assistants-page.test.js:616` is a source assertion, not a write;
  - `stack-free-npm-test` G1 points the 12 live suites at a dead port;
  - its G2 runs `tag-detail`, which only reads.

  Results on Node v24.18.0:
  - `test/my-assistants-page.test.js`: `{"pass":52,"fail":0,"skipped":0,"hExecuted":2}`. C10 and C11 are listed as PASS. H1 and R0-2 ran live, as anonymous GETs.
  - `test/dictionary-concepts.test.js`: `{"pass":25,"fail":0,"skipped":0}`.
  - `test/stack-free-npm-test.test.js`: `{"pass":7,"fail":0}`.
- [x] **The container serves HEAD's UI.**
  - **UI:** a fresh build of HEAD's `ui/` into a scratch `outDir` gives `index-BVZq3FiX.js`. All 28 files of that build are byte-identical (sha1) in the container's `/usr/local/lib/node_modules/brainstorm/dist/`, and `GET :7778/assistants` returns the same `index.html` bytes. That `dist/` also holds stale chunks from earlier builds, but the served entry is HEAD's.
  - **Server:** the sha1 of `src/api/assistant/myAssistants.js` and of `src/lib/my-assistant-tags/index.js` equal HEAD's.
- [x] **Playwright against the container.** The command was `BRAINSTORM_BASE_URL=http://localhost:7778 npx playwright test tests/brainstorm/my-assistants.spec.js tests/brainstorm/dictionary-concepts.spec.js --project=chromium`.
  - **Result: 24 passed**, which is round 1's 23 plus A12.
  - D6, the known flake, passed on this run.
  - The global setup only checks that the server answers.
- [x] `bash scripts/harness-lint.sh`: clean (0 violations) before writing this section. After it, the one violation is L1: this review now ends in PASS while the story is still `Approved`. The status change in the review commit clears it.
- [x] **Hygiene sweeps** on the added lines:
  - no `console.log`, `debugger`, TODO, `nsec` or quoted 64-hex literal;
  - no raw control bytes in the six changed files.
- [ ] _Lint, typecheck and build are not configured, so they were skipped._

### Round 1's findings, checked as fresh claims

**Blocking 1 (a malformed kind 0 takes down the list): fixed.**
- **The fix** (`myAssistants.js:56-58`, `:76`):
  - `textOf` keeps a value only when it's a string that isn't blank after `trim()`.
  - The name is `textOf(display_name) || textOf(name) || npubShort`. So `name` is always a non-empty string, and neither `Array.from(name)[0]` (`:82`) nor `a.name.localeCompare` (`:92`) can throw.
  - URL and NIP-05 moved from `valueOr(v)` to `textOf(v) || '—'`, which computes the same thing.
- **What `buildRows` can receive:**
  - `fetchProfilesChunked` hands on `data.profiles[pk]` as it is. Otherwise it gives `null`, or `PROFILE_LOOKUP_FAILED` (`ui/src/utils/profileBatch.js:72-80`).
  - The server fills `data.profiles` from `JSON.parse(ev.content)` without validating it, and uses `{}` when parsing fails (`src/api/profiles/fetchProfiles.js:91`, `:112`).
  - So a profile can be any JSON value.
- **Fuzzed**, with a scratch ESM probe that imports the repo's view-model. It made 798 rows and ran them through one `buildRows` call, so the sort runs over all of them:
  - **`display_name` × `name`**, over the same 28 values each:
    - absent, `0`, `42`, `-1`, `1e21`, `true`, `false`;
    - empty, a single space, a tab-and-newline-only string, `"  Ivy  "`;
    - `[]`, `["x"]`, `[["x"]]`, `{}`, `{"first":"y"}`, `{"toString":"z"}`;
    - emoji, combining marks, a zero-width space, and a string that starts with a lone surrogate.

    Website and NIP-05 cycle through the same values.
  - **The whole profile as one value:** `null`, `0`, `42`, `true`, `false`, `""`, `"str"`, `[]`, `["x"]`, `{}`, `{"__proto__":{"display_name":"P"}}`, `PROFILE_LOOKUP_FAILED`, and a missing key.
  - **Result:** no throw, and 0 problems.
    - Every name is a trimmed, non-empty string, and it's exactly what the rule picks: display_name, then name, then the npub.
    - Every initial is non-empty, URL and NIP-05 are always strings, and Local is first.
    - This covers the shapes round 1 asked about, and the brief's "blank `display_name` with a non-string `name`", which falls back to the npub.
- **In the browser**, on HEAD's build at `:7778`. I appended two probes to a scratch clone's copy of the spec, never the repo's:
  - R2X-1:
    - Local = `{display_name:'   ', name:{first:'y'}}`;
    - A = `42`;
    - B = `{display_name:'🦊 Fox', website:7, nip05:['x']}`;
    - C = `['x']`.
  - R2X-2:
    - Local = `'str'`;
    - A = `{display_name:false, name:'  Ann  '}`;
    - B = `{display_name:null, name:0}`;
    - C = `{display_name:{}, name:[]}`.

  Both show 4 rows, "4 Assistants", and no error line.
  - Every unusable name shows the shortened npub.
  - B's name shows as "🦊 Fox" with the avatar `🦊`, and A's as "Ann", trimmed.
  - Every URL and NIP-05 shows "—".

  A12 itself is round 1's `display_name: 42` repro, and it now passes.

**Do C10, C11 and A12 pin it?** I tested four mutants, each in a scratch clone. Each ran the Node suite, then the whole `my-assistants.spec.js` against its own build, served by `vite preview` on :4174.

| Mutant | Node suite | `my-assistants.spec.js` |
|---|---|---|
| M1: the name line reverted to `profile.display_name \|\| profile.name \|\| short`, `Array.from` kept | C10 fails: `a.name.localeCompare is not a function` | A12 fails: `Expected: 4, Received: 0`. The other 14 pass. |
| M2: the letter reverted to `name.slice(0, 1)`, `textOf` kept | C11 fails: the initial is the lone high surrogate U+D83E | all 15 pass (A12 doesn't test the letter) |
| M3: the name reverted, but coerced: `String(profile.display_name \|\| profile.name \|\| short)` | C10 fails: `name should be "Gil", got "42"` | all 15 pass (see R2-1) |
| M4: `a63b3ae9`'s whole view-model | C10 and C11 fail; 50 passed, 2 failed | A12 fails: `Expected: 4, Received: 0` |

- **M4 re-proves the test plan's claim** (`1-the-my-assistants-page.test-plan.md:178-183`, "Fails on the reviewed implementation"). It gives the same two Node messages and A12's 4 against 0. The UI diff since `a63b3ae9` is that one file, so M4's build stands in for `a63b3ae9`'s.
- **Under M1, the throw comes from the sort, not from `.slice`**, because `Array.from(42)` is `[]`. A12 catches it only through that sort, so it depends on the comparator's call order. C10 catches M1 either way, because it checks the name's value.

**The amendment weakened nothing.**
- `git diff --numstat d48cbeed..HEAD -- test tests` shows 33/0 and 16/0. Those are additions only: C10 and C11 after C9, A12 at the end, and one header comment line.
- The phases stayed separate. `17f8aa70` touches only the two suites and the test plan, and `7dd30cb2` only the view-model and the story.

**Non-blocking 1 (the split-emoji avatar letter): fixed** at `:82`. C11 pins it, as M2 shows. R2-2 says what "whole character" means here.

**Non-blocking 2 (the undocumented `zTag`): addressed.** Checked the story's § Deviations bullet (`1-the-my-assistants-page.md:196-199`):
- `zTag` is at `src/api/assistant/myAssistants.js:40`.
- It requires profile-tags' `NOSTR_USER_TAG_Z_TAG` lazily. The module's only top-level requires are `identification-tags` and `my-assistant-tags` (`:28-29`).
- No test overrides `zTag`: `grep -rn zTag test tests` finds none in this story's suites.

**The second new Deviations bullet** (`:200-201`), checked:
- "A name field counts only when it's non-blank text (`textOf`, which URL and NIP-05 use too)": true (`:76`, `:84-85`).
- "The avatar letter is a whole character (`Array.from`)": a whole code point (R2-2).
- "Both fixes are pinned by C10, C11 and A12": true taken together. C10 and A12 pin the name, though A12 only its no-throw half (R2-1). C11 pins the letter.

**Non-blocking 3 (AC-2's staging half): carried accurately.** It's in test plan `:64-65`, and in the book's unchecked frame box "locally and on staging" (`engineering-team/audits/my-assistants/book.md:29`). It still falls to `/cycle-staging`:
- H1 and R0-2 with `BRAINSTORM_BASE_URL=https://staging.brainstorm.world`;
- a direct load of `https://staging.brainstorm.world/assistants`.

**Non-blocking 4 (the container UI): done.** It's byte-identical to HEAD's build (above).

**Round 1's optional hardening was not taken.** It suggested keeping a throw in `buildRows` from reading as a failed read (`Index.jsx:88-90`). It was optional, and with the guard, no profile value in the fuzz reaches that path.

**Harness friction 1 is now the new `meta` row.** I checked `ledger/2026-09-30-npm-test-step-leaks-fixtures.md` against round 1 and the sources:
- **Form:**
  - It has the template's fields (`engineering-team/templates/open-row.md`). The file is named by its id, and `**Id:**` repeats it.
  - Type is `meta`, Opened has a date and a source, Status is OPEN, Done is —, and there's a Pointer.
  - The id's slug has five words, and the id is 39 characters. The commit was at 22:08Z on 2026-09-30.
  - The rename in `00c2abfc` was allowed: `abfabddd` is not on `origin/staging`, and nothing cites the old id.
  - harness-lint is clean.
- **The five places that say "run `npm test`"** (`:11-15`) are exact:
  - `workflows/4-implementation.md:18` (step 1) and `:31` (step 7);
  - `roles/implementer.md:19`, `:27`;
  - `workflows/5-review.md:15`;
  - `roles/reviewer.md:35`;
  - `templates/review-checklist.md:9`.

  "Nothing in the phase docs points to it" holds. No workflow, role, template, command or agent file names the fixture row, `router-status`, dcosl or `BRAINSTORM_PUBLISH_LOCAL_ONLY`.
- **The facts** (`:17-21`) match the fixture row's 2026-09-29 and 2026-09-30 updates:
  - the tag streams are `both` and enabled;
  - `BRAINSTORM_PUBLISH_LOCAL_ONLY` governs only the browser client;
  - six kind 39999 events reached dcosl.
- **The recipe and its result** match round 1, and the fix shapes include both of round 1's suggestions.
- **Two accuracy gaps:** see R2-3.

### Scope

The fix round adds nothing beyond what was asked.
- **The view-model change** is:
  - the asked guard;
  - round 1's Non-blocking 1 (the avatar letter);
  - renaming `valueOr` to `textOf`, with the same URL and NIP-05 output.
- **The story** gains two Deviations bullets.
- **The tests** are the asked C-class case, plus C11 and A12.
- **The ledger row** is round 1's Harness friction 1.

No server, CSS, route or copy change.

### New findings (round 2)

#### Blocking

None.

#### Non-blocking

1. **R2-1, `tests/brainstorm/my-assistants.spec.js:403`: A12 doesn't check the name it claims to.**
   - `getByText(npubShort(A), { exact: true }).first()` is satisfied by the `.bsd-ma-npub` line, which every row shows (`ui/src/pages/assistants/Index.jsx:44`).
   - So A12 doesn't check "that one named by its npub", which the test plan's A12 row claims (`1-the-my-assistants-page.test-plan.md:176`). M3 shows "42" as the name and still passes A12.
   - C10 pins the name value, so coverage is intact.
   - Optional (the Tester's file): scope the check to `.bsd-ma-name`, or trim the row's claim to "four rows, no error line".
2. **R2-2, `ui/src/pages/assistants/myAssistants.js:82`: `Array.from` gives a whole code point, not a whole grapheme.**
   - Examples, probed: 🇺🇸 gives `🇺`, 👨‍👩‍👧 gives `👨`, 👍🏽 gives `👍`, and "e" plus a combining acute gives `e`.
   - None is a replacement box, so round 1's defect is gone. But "whole character" in the code comment, in C11's title and in the story (`:201`) overstates it.
   - `Array.from` was round 1's own suggestion; `Intl.Segmenter` would give the whole grapheme. No action is needed unless the owner wants flags and families kept whole.
   - Related, and not asked for: `trim()` doesn't strip zero-width or filler characters such as U+200B. A name made only of those is kept and looks blank, but the npub line still identifies the row.
3. **R2-3, `ledger/2026-09-30-npm-test-step-leaks-fixtures.md`: two accuracy gaps in the new row.**
   - **`:42`, "they were enabled on purpose on 2026-07-18":** the only evidence is `ledger/2026-09-27-test-fixture-taggings-on-prod-relays.md:89`. It says `router-state.json` has held the flags since 2026-07-18, and I found no record of why in `ledger/`, `OPEN.md`, `docs/`, `engineering-team/` or session memory. Say "enabled since 2026-07-18" and leave the reason to the owner.
   - **`:32`, step 4, doesn't find the run as written:** `--label` on `gate:status` only selects a run by its label. The label is set at run time, with `GATE_LABEL=<label> npm test` (`engineering-team/README.md:61-62`). My first run had no label, and I restarted it.
   - **Step 2 is missing a chown:** the tar copy keeps the host's uid 501, so git in the root container refuses the tree ("detected dubious ownership"). It works once the tree is chowned to root or marked `safe.directory`, which I did before `npm ci`. The gate record's `git` field and harness-lint's history checks both read git.

   A small follow-up edit to the row, not blocking the story.

#### Harness friction

1. The two recipe gaps in R2-3 are the friction this round. The new row is their home, so there's no new row.

### Close-out

On this verdict, the story's `**Status:**` changes to Done in the review commit. The orchestrating session does that and runs completion detection; neither is recorded here.

### Verdict (round 2)

**PASS**

Blocking 1 is fixed, and C10, C11 and A12 pin it. R2-1 to R2-3 are non-blocking.
