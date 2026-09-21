# Review: Story 5 — One writer: nothing else can change an assistant's profile

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff a31d448c...c19feb89`, 24 files. Commits: `f4f87f2a` (ledger), `dbcc035b` (ADR 0005), `069ca3de`
(test plan and tests), `7cfa666c` (implementation), `c19feb89` (merge of `origin/staging`, HEAD). `a31d448c` is
`origin/staging` and the merge base.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`**, started from the clean worktree before anything was written. Its record, read with
      `npm run gate:status -- --label ap5-review`:

```
20260921T201431Z-84182-4f5d [ap5-review] started 2026-09-21T20:14:31.485Z on c19feb89 — FAIL, exit 1, 3576 passed, 95 failed, 36 skipped, 218/218 suites; failed: profile-tags, profile-tags-publish, tag-detail, tag-detail-publish, tag-detail-write-publish, tag-index-publish, profile-tag-polish, pin-a-tag, tl-publication-from-pins, tl-publication-from-pins-publish, customize-pin-curation-publish, most-pinned-tag-index-publish, deploy-safety-status, event-less-create-set, capture-a-goal-and-see-it, tapestry-per-concept-detail-views, structures-the-brain-can-trust, break-a-goal-into-pieces, attach-the-world, sessions-read-the-brain, the-proposal-loop, teach-it-what-matters, the-brain-survives, return-the-four-on-every-read-surface, show-the-four-on-the-goal-screens-that-already-exist, recognizable-published-ta-profile, brain-first-tapestry-authoring, tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, profile-lookup-bounds, not-yet-shared-filter, concept-count-canonical, summaries-element-count, author-scoped-inspection-roster, setup-status
```

  The record says `dirty: false` and `strayErrors: []`. **The verdict is FAIL, and none of it comes from
  this story.** I compared it, suite by suite, with the branch's Phase 3 run
  (`20260921T190511Z-65250-511b`, `dbcc035b` plus the new tests, before the implementation).

  - Phase 3 failed 38 suites: 35 environmental ones, plus this story's three
    (`one-writer-assistant-profile`, `one-default-assistant-profile` and `assistant-publish-relays`). All three
    now pass: 17/0/0, 52/0/0 and 39/0/0.
  - **33 of the 36 failing suites have the same counts and the same failing test names as in Phase 3.**
  - `teach-it-what-matters` (25/2/0 → 26/1/0) and `the-brain-survives` (29/2/0 → 30/1/0) each fail one live
    test fewer.
  - `setup-status` is new with the merge: it is the unrelated book's suite. It fails only H1, where `:7778`
    answers `/api/setup/status` with a 404. That stack serves the shared checkout at `a55b9631`, which has no
    `src/api/setup/status.js` (checked with `git cat-file`). A `curl` to `:7778` gives the same 404.
  - **Every failure is a live-tier test** (H, I or L class) against `:7778`, or a whole live suite that dies
    on "fetch failed". Four failing suites also read files this story changes: `recognizable-published-ta-profile`,
    `brain-first-tapestry-authoring`, `teach-it-what-matters` and `show-the-four-…`. In each, only the live
    tests fail. The source checks on this story's files pass, including brain-first's S1 on `publishEvent.js`.
  - The implementer's own run on `c19feb89` (`20260921T195902Z-14987-9a96`, label `ap5-phase4-merged`) has the
    same line: the same totals and the same 36 suites.

  The branch is not pushed and has no PR (`gh pr list --head feat/assistant-profile-one-writer` is empty), so
  CI's `stack-free` job, the binding gate, has not run.

- [x] **The nearest thing to CI here: a stack-free run by hand.** In a scratch export of `c19feb89`, with
      `BRAINSTORM_BASE_URL=http://127.0.0.1:9`, `TAPESTRY_PORT=9`, `TAPESTRY_CONTAINER_PORT=9` and a container
      name that does not exist. No test failed:

  | Suite | pass/fail/skip |
  |---|---|
  | `one-writer-assistant-profile` | 17/0/0 |
  | `one-default-assistant-profile` | 52/0/0 |
  | `assistant-publish-relays` | 39/0/0 |
  | `my-assistant-page` | 31/0/0 |
  | `assistant-setup-state` | 26/0/2 |
  | `default-deny-mutations` | 14/0/0 |
  | `publish-event-signature-verification` | 5/0/0 |
  | `create-tapestry` | 22/0 |
  | `add-a-concept-to-a-tapestry` | 23/0 |
  | `recognizable-published-ta-profile` | 8/0/5 |
  | `brain-first-tapestry-authoring` | 11/0/8 |
  | `teach-it-what-matters` | 20/0/7 |
  | `show-the-four-on-the-goal-screens-that-already-exist` | 32/0/5 |

  The skips are their live tiers. `harness-lint` (76/0/0) and `stack-free-npm-test` (6/0/1) pass in the full
  run. `scripts/harness-lint.sh` reports "clean (0 violations)". The diff touches no path in
  `scripts/harness-def-paths.txt`, so it needs no CHANGELOG row.

- [x] **`npm run test:playwright`**: the six specs, run from the worktree against `vite preview` on `:4175`.
      **60 passed, 0 failed, 0 skipped.**
  - The specs: `one-writer` 15, `my-assistant-page` 18, `assistant-setup-prompt` 10, `assistant-default-profile` 8,
    `ta-composite-avatar` 5 and `assistant-publish-result` 4.
  - **The bundle is HEAD's.** The preview process serves `<worktree>/dist`. I rebuilt `ui/` from a
    `git archive HEAD` export, and the fresh build has the same content-hashed chunks as the served one:
    `index-pcqX0yLl.js` and `index-BVrNqsAW.js`.
  - The legacy pages come from the checkout's own `public/`, through `page.route`, byte for byte.
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._ (The UI bundle the browser class ran against was built from this tree,
      and verified as above.)

## Spec adherence

- [x] **Every acceptance criterion has a passing test, and the tests judge.** I planted 29 mutants in a scratch
      export, never in the worktree. Most are single edits; four move one block. I ran the neighbouring Node
      suites against each, then restored the file and checked it against `git show HEAD:`.
      - Two more went to the browser class: the NIP-85 link moved inside the loaded block (the same edit as
        one Node mutant), and a bundle built with the merge base's `Dashboard.jsx`.
      - Every mutant was caught. The tables follow.

| Criterion | Tests | Where the behaviour lives |
|---|---|---|
| **AC1**: the dashboard offers no way to write; its only assistant action leads to the page | W1, W5; story 3's W2 (re-aimed); B0, B1 ×3; `assistant-default-profile` B1 and `assistant-setup-prompt` B5 (re-aimed) | `WelcomeCard({ onSetupProfile })` has one button (`ui/src/pages/Dashboard.jsx:26-50`, `:45`). It is rendered with `navigate(MY_ASSISTANT_PATH)` (`:750`), and the checklist item goes to the same place (`:733-735`). The hook call reads `status` only (`:719`). The dashboard's other POSTs are Neo4j and tapestry-key calls, not the profile |
| **AC2**: the legacy pages publish nothing; the panels show read-only status and a link | W2, W3, W4; story 3's R1 (re-aimed); B2, B3, B4 ×9 | The publish button, its status line, the publish function and the relabel are gone from both pages. The link sits outside every block the loader shows or hides (`public/pages/nip85.html:107`, `public/pages/customers/customer.html:167`). Both status requests send `defaults=0` (`nip85.html:161`, `customer.html:867`), and neither page reads `defaults`. `/assistant` is the SPA route (`ui/src/App.jsx:250`), served by the catch-all in `bin/control-panel.js:346-349` |
| **AC3**: any other request to sign an assistant kind 0 is refused, with an explanation, and nothing is written | G1, G2 (G3–G5 as guards); P2, P4, P5 (P1, P3 as guards); story 2's E5 and E7 and story 3's E8 (re-aimed); W5, W6 | The generic signer refuses `signAs === 'assistant' && event.kind === 0` before the owner gate and before any key is read (`src/api/strfry/commands/publishEvent.js:41-43`). `publish-profile` checks "whose", then "what", before any lookup (`src/api/assistant/index.js:201-209`). A remote caller with no session is stopped earlier, with a 401 from the default-deny middleware (`src/middleware/auth.js:485-488`) |
| **AC4**: no route lets an Admin change the TA's profile; they still manage their own | P6; the Admin rows of G1, P1 and P4 | Both doors above. An Admin passes the generic signer's owner gate (`isOwner` is owner-or-admin), so only the kind-0 refusal stands in the way, and G1 and P6 pin it |
| **AC5**: no existing published profile changes | By construction: no migration, no republish, nothing publishes on load. B1–B4 each assert that no request reaches either writer | The passive check is recorded below |

**Mutants the Node suites caught** (`ow` = the new suite; `s2`, `s3`, `s4` = the story 2, 3 and 4 suites;
`dd` = `default-deny-mutations`):

| Planted defect | Caught by |
|---|---|
| no kind-0 refusal at all | ow G1, G2, P6 |
| refusal after the owner gate | ow G1, G2 |
| refusal after the key read | ow G1, G2, P6 |
| `Object.is(event.kind, 0)` for `=== 0` | ow G2 |
| every assistant kind refused (over-broad) | ow G4 |
| a client-signed kind 0 refused (over-broad) | ow G5 |
| the refusal's words don't point to the page | ow G1, G2, P6 |
| the owner gate answers 401, or a bare 200, instead of 403 | ow G4; dd AC3 (**not** the R3 sentinels; see Non-blocking 1) |
| the Owner may still publish anyone's assistant (the old rule) | ow P4, P5; s3 E8; s2 E5 |
| the session read without `authenticated` | ow P4 |
| "what" checked before "whose" | ow P5 |
| an array accepted as content | ow P2 |
| the content check after the key read | ow P2 |
| an emptied profile `{}` refused (over-broad) | ow P3 |
| `not-your-assistant` words don't point to the page | ow P4, P5, P6 |
| "whose" reduced to "signed in" | ow P4, P5, P6; s3 E8; s2 E5, E8 |
| no content check at all | ow P2; s2 E7 |
| the dashboard keeps a one-click publish | ow W1, W5; s3 W2 |
| the NIP-85 link only inside the loaded block | ow W4 |
| the customer page asks without `defaults=0` | ow W3 |
| the customer page drops its link | ow W4; s3 R1 |
| the NIP-85 page still posts `publish-profile` | ow W2, W5; s3 R1 |
| the editor publishes without content | ow W6 |
| the page ignores `hasMyAssistantPage` (carry-forward) | s4 W18 |
| the page drops its visitor branch (carry-forward) | s4 W17 |
| `onAssistantCreated` is a no-op (carry-forward) | s4 W19 |
| `refreshUser` keeps the old `assistantPubkey` (carry-forward) | s4 W19 |
| `&&` → `\|\|` in the "no picture" condition (carry-forward) | s4 W20 |

**Mutants the browser class caught.**

| Planted defect | Caught by |
|---|---|
| NIP-85 link moved inside `#ownerAssistantContent` (run from the scratch copy, whose `public/` the spec serves) | B4 in exactly the four states that hide that block: loading, no key, request failed, signed out. "Not published" passes, correctly |
| `Dashboard.jsx` reverted to the merge base (its bundle built and served on `:4177`, then stopped) | `one-writer` B0 and B1 (Owner); `assistant-default-profile` B1; `assistant-setup-prompt` B5. The Admin and Customer B1 and story 1's B3 pass, correctly: the old button was Owner-only |

- [x] **No criterion is silently dropped.**
- [x] **No behaviour was added beyond the story and the ADR.** Every changed line traces to ADR 0005's
      implementation notes, a Deviation, or the bookkeeping the ADR names.

## ADR adherence

- [x] **Files match the implementation notes.** Everything under "Unchanged, deliberately" is untouched:
      `profileDefaults.js`, `profileState.js`, `profilePublish.js`, `roster.js`, `avatar.js`, the status handler,
      the setup hook, the editor, the page, the route table, `src/middleware/auth.js` and `public/kg/`.
  - `publish-profile` (`src/api/assistant/index.js:199-209`) is the ADR's snippet line for line. It follows
    the unchanged `customerPubkey` check (`:195-197`). The two messages are module constants next to
    `PROFILE_FIELDS` (`:45-52`), not between the factory and its export.
  - Step 2 is `personName` on a public instance only, then `draft = sanitizeProfileContent(content)`
    (`:244-248`). `hasUserContent` and the default branch are gone.
  - `buildDefaultProfile` stays imported; the status handler still uses it (`:408`, `:436`).
  - The generic signer has the constant (`publishEvent.js:14-15`) and no new `require`. The header comment
    states the rule (`:5-6`).
- [x] **Layering respected; no new dependencies.** `package.json` and the lockfiles are unchanged. The
      suite's JSX reader uses the root `typescript` dependency (`package.json:83`), as story 4's suite does.
- [x] **The owner's settled decisions are honoured.**
  1. `publish-profile` refuses no content (P2) and anyone's assistant but the caller's own, the Owner
     included (P4, story 3's E8, story 2's E5).
  2. The in-container operator gets no route. `req.localTrusted` with no session is refused by "whose"
     (P4's operator row), and `src/api/index.js` adds no route.
  3. The status handler is untouched. Its key-holder disclosure keeps its own row, with the dated note.
  4. The kind-5 gap is left alone and named in the ADR (`0005-….md:333-337`), with OPEN.md #269.
- [x] **Carry-forwards landed as the ADR says.**
  - `ui/src/styles.css:802-805`.
  - The provision handler's `mayCreateAssistant` line (`src/api/assistant/index.js:478-480`). I checked it
    against `ui/src/config/avatarMenuLinks.js:32-42`.
  - W17–W20, and the reworded story 4 test plan line (`4-my-assistant-page.test-plan.md:24-28`).
  - BIBLE: the §11 row (`BIBLE.md:495`), a paragraph in §14 Assistant Keys (`:1072`), and the "Last updated"
    line.
  - The `asserts` change in `test/my-assistant-page.test.js` only adds branches that existing guard lists
    cannot reach. Story 4's 27 cases pass, and the suite gives 31/0/0.
- [x] **Deviations: each one checked against the diff.**
  1. The NIP-85 intro now says "…is the nostr identity…" (`nip85.html:74-75`). This avoids "the Tapestry
     Assistant is the Tapestry Assistant identity". Accurate.
  2. The signed-out line now says "Sign in to see your Tapestry Assistant." (`nip85.html:156`). Accurate.
  3. The panel comments are renamed and say read-only. `_assistantCustomerPubkey` was read only inside the
     removed publish function: on the base, `customer.html:929` and `:936`, both within `:917-948`.
     Accurate. The customer page's "Profile preview (shown after publishing)" comment was reworded too; it
     is the same kind of change.
  4. `nip05` is no longer in `publish-profile`'s doc comment. `PROFILE_FIELDS` never held it (`:43`).
     Accurate.
  5. The refusal sits above the branch. I verified the behaviour: G1 across all four callers, plus the
     two ordering mutants. **The rationale is incomplete.** See Non-blocking 1.
- Two small departures in form, neither blocking:
  - BIBLE's § Assistant Keys addition is a bold-lead paragraph, not a bullet (ADR `:298`).
  - The owner-gate comment inside the branch (`publishEvent.js:48-51`) is unchanged. The rule is stated at
    the refusal's own comment (`:37-40`) instead, which follows from Deviation 5.

## Concept-graph integrity

- [x] No handles are touched. The story says "Concepts touched: None". The ADR oriented through `/summaries`
      (9 concepts locally; none models an assistant).
- [x] Firmware reinstall: not needed. No concept definitions change.
- [x] No new code reads BIBLE to re-derive concepts.

## Things tests can't catch

- [x] **No secrets.** The added lines hold no `nsec`, no 64-hex private key and no live TA pubkey. The
      fixtures are `aa…`, `bb…`, `ad…`, `a1…`, `cc…`, `c1…` and `dd…`, plus keys generated at run time.
- [x] **No debug logging, `debugger` or TODOs** added under `src/`, `ui/` or `public/`.
- [x] **No commented-out code.**
- [x] **Error paths.**
  - A non-object `event` has no `kind`, so it passes the refusal harmlessly.
  - `express.urlencoded({ extended: true })` (`bin/control-panel.js:122`) can deliver `event[kind]=0` as the
    string `"0"`. That is not `=== 0`, but `finalizeEvent` throws on a non-number kind, so nothing is signed
    or written. G3 pins this for `"0"`, `null` and `""`.
  - An old tab of either legacy page, or of the old dashboard, gets the 400 `no-content` text. That text
    points to `/assistant`, and those pages print `data.error`.
  - The April build under `public/kg/` posts `{kind:0, signAs:"assistant"}` to `/api/strfry/publish`. I
    grepped its bundle for this, and that request now meets the refusal.
- [x] **No other signing path reaches kind 0.** I re-checked the ADR's census.
  - `src/` has 67 `finalizeEvent(`/`signAndFinalize(` sites. Only `publish-profile` builds a `kind: 0`.
  - dlist-curation's copies and deletions use fixed kinds (`src/api/dlist-curation/updateEvents.js:71, :96,
    :116`).
  - Two re-signers the ADR does not name work the same way as `bDisposition`. See Non-blocking 2.
- [x] **Concurrency.** Nothing new. The G-class swaps `require.cache` entries and `child_process.exec`, and
      puts them back in `finally`. The run recorded no stray errors, and the suites that run after it behave
      as in Phase 3.
- [x] **Security.**
  - "Whose" reads the authenticated session the way the status handler does (`:201`, cf. `:387`).
  - Both refusals come before any key, lookup, write or settings read (the "touched" checks in P2, P4 and
    P5).
  - The client path is unchanged, so publishing stays permissionless (G5).
  - The cross-site posture is unchanged and named as OPEN.md #326.
- [x] **AC5's passive check, step 1 (read-only, before the staging merge).**
  - `nak req -k 0 -a 8e901369…8e5fb1 wss://staging.brainstorm.world/relay` returned one event.
  - Its `id` is `1c20ca9519743bc0934964da8ba2ab5c1218f8312d30621d4b5f61abc99ab5dd` and its `created_at` is
    `1783819533` (2026-07-12T01:25:33Z): name "Tapestry Assistant", no tags.
  - The TA pubkey came from staging's `/api/assistant/pubkey`.
  - After the deploy, the same query must return the same event (test plan, "Passive post-deploy check").

## House rules check

- [x] Concept Graph API authority respected. No concept work.
- [x] No new lint, typecheck or build tooling.
- [x] No hardcoded TA pubkey. The server resolves keys at run time (`getOwnerAssistantKeys`,
      `getAssistantKeys`), and the tests use fixture pubkeys only.

## Product-guide adherence *(when the story traces to a PRD)*

- [x] Not applicable. The book is a no-PRD acceptance frame.

## The merge (`c19feb89`) and the ledger rows

- **The merge is clean for this story.**
  - Only two of the story's files were also changed by the merged book: `test/registry.js` and
    `ui/src/styles.css`.
  - `git show --cc c19feb89` shows no combined hunk for either, so neither was resolved by hand. Both sides
    survive: `one-writer-assistant-profile` sits at `test/registry.js:243` and `setup-status` at `:251`, and the
    stylesheet has both the comment edit and the merged book's CSS.
  - None of the story's files has a conflict marker.
  - The merged book adds one failing suite locally, `setup-status`: environmental, as above.
- **The ledger rows closed or annotated in this branch are honest.**
  - `2026-09-21-my-assistant-checks-browser-only` → DONE. W17–W20 exist, and each fails against its planted
    defect (the carry-forward rows of the mutant table). Line 24 of story 4's test plan is reworded.
  - `2026-09-21-my-assistant-comment-nits` → DONE. Both items landed.
  - `2026-09-21-status-no-key-relay-gate-unpinned`: the close-out cell's `#730` and `#731` are story 4's merge
    (`47f32791`) and the promotion (`c2d53b8c`).
  - `2026-09-21-status-reveals-assistant-key-holders` stays OPEN. Its dated note is accurate: the panels ask
    only about the signed-in person, with `defaults=0`.
  - `2026-09-21-assistant-api-review-tidy-ups` stays OPEN for item (b), by design: `profileDefaults.js` is
    untouched.
  - `2026-09-21-adr-reaim-list-misses-outcome-asserts` is a new meta row, OPEN. See Non-blocking 1 for a
    correction its third-instance note needs.

## Findings

### Blocking

None.

### Non-blocking

1. **The two R3 window sentinels no longer see the owner gate's `403`, and Deviation 5 reads as if they do.**
   Files: `test/create-tapestry.test.js:291-294`, `test/add-a-concept-to-a-tapestry.test.js:420-424`,
   `src/api/strfry/commands/publishEvent.js:41-54`,
   `engineering-team/stories/assistant-profile/5-one-writer-for-assistant-profiles.md:77-82`.
   - **What R3 checks.** Both suites slice 600 characters from the first `signAs === 'assistant'` and require
     `isOwner(req)`, `localTrusted` and `403` inside that window.
   - **On the base**, the window starts at the branch. Its only `403` is the owner gate's own (408 characters
     in).
   - **On HEAD**, the window starts at the refusal (`:41`):
     - its only `403` is the refusal's own, 70 characters in;
     - `localTrusted` is met in the gate's comment (350 characters in);
     - `isOwner(req)` is at 537 characters;
     - the gate's `403` (`:53`) falls outside the window.
   - **What that means in practice.** Two planted mutants pass both R3s: the gate answering 401, and the gate
     answering a bare 200. They are still caught by `default-deny-mutations` AC3 and by the new G4, so no
     behaviour is left unpinned.
   - **The record problem.** Deviation 5 says the R3s "need the owner gate inside it … here the gate sits 537
     characters in". That is true of the gate's `if`, but not of what R3 asserts. The ledger note at
     `ledger/2026-09-21-adr-reaim-list-misses-outcome-asserts.md:25-31` repeats it.
   - **Why it matters now.** This is the book's last story, and `/close-book` harvests Deviations into the
     build audit (ledger `2026-09-21-deviations-not-revised-on-rework`).
   - **Asks:**
     - In the review commit, add a dated note to that meta row: the R3 windows now pass on the refusal's
       `403`; the gate's own `403` lies outside them; default-deny AC3 and G4 pin the gate's behaviour. So a
       window sentinel can keep passing while measuring a different line, not only fail on a layout change.
     - Correct Deviation 5 to match, if the orchestrator's bookkeeping allows it.
     - Optionally file a cleanup row to re-anchor both R3s at the gate: slice from `isOwner(req)`, or assert
       the gate's own `403` follows it.
2. **The ADR's census of kind-0-capable signers leaves out two re-signers that have the same shape as
   `bDisposition`.**
   - `src/api/concept/selfDeclare.js:79-105` (Owner, Admin or `localTrusted`).
   - normalize add-to-set's n-tag republish (`src/api/normalize/index.js:4408-4431`).
   - **Why the ADR's argument still holds.** Each re-signs an existing TA event whose kind comes from a handle
     or node address, and which carries a matching non-empty `d` tag (`HANDLE_RE` needs `(.+)`). No assistant
     kind 0 carries a `d` tag, and after this story nothing can mint one, so `bDisposition`'s argument
     (`0005-….md:89-91`) covers both.
   - **Ask:** no code change. The book-close audit should name them next to `bDisposition`.
3. **The test plan says "The grep found nothing beyond the ADR's own list"
   (`5-one-writer-for-assistant-profiles.test-plan.md:29`).** The meta row's third-instance note contradicts it:
   the `signAs` grep did list `create-tapestry` and `add-a-concept-to-a-tapestry`, and neither was opened.
   - The truth is recorded in the ledger, so nothing is lost.
   - **Ask:** optionally, a one-line dated correction under the test plan's Verification section, so the
     book-close audit does not quote the original sentence.
4. **OPEN.md row 269 is now partly stale.**
   - It cites the handler's owner-only comment at `publishEvent.js:33-37`. That comment is now at `:48-51`.
   - Its "assistant-profile #5 closes the kind-0 case only" has happened.
   - **Ask:** add a dated note in the bookkeeping commit. The row stays OPEN: its Admin question is untouched,
     by the owner's decision.
5. **AC5's passive check is only half done.** Step 1's baseline is recorded above. Steps 2–3 need the deploy:
   - re-query the staging TA after the merge;
   - query one customer assistant;
   - query production after promotion.
   - **Ask:** leave a ledger row or a note in the handoff so they are not forgotten.

### Harness friction *(anything the process itself got wrong this story — stale doc, wrong port/path, contradictory instruction; each becomes an OPEN.md row, type `meta`)*

1. Nothing new. The brief's environment facts were accurate:
   - `:4175` served this worktree's build, which I verified by content hash;
   - `:7778` serves `a55b9631`;
   - the gate took about 10 minutes.
   Two known costs recurred:
   - the environmental failing set grows with each merged suite that has a live tier (`setup-status` this
     time);
   - the mandated full run leaves `most-pinned-tag-index-publish`'s fixture tags on the shared local stack
     (OPEN.md #293, #294).
   The one process lesson, window sentinels that keep passing while measuring a different line, belongs on
   the existing meta row (Non-blocking 1), not a new one.

## Verdict

**PASS**

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place — applied by the orchestrating session in the review commit,
      with the story's Review link, the Deviation 5 correction, and the ledger asks of non-blocking 1, 4 and 5.
- [x] Completion detection performed; the result and any book arithmetic recorded in the run journal (Direction) or the chat (human-gated) — never in this file. `/close-book` offered if the book looks complete.
