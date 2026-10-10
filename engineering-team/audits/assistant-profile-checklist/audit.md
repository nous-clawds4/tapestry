# Build Audit: Your Tapestry Assistant's Profile — the checklist at `/assistant/profile`

**Book:** `engineering-team/audits/assistant-profile-checklist/book.md`
**Date:** 2026-10-10
**Branch / commit range:** `a217d0c4^..1229c154` on `staging` (the shared line); `staging` was at `27623399` at close.
- **Commits.** 24 of the book's own, all straight onto `staging`, no PR and no merge: 5 story, 4 adr (0001–0003, accepted;
  then ADR 0002 Amendments 1 and 2), 9 test, 3 impl, 3 review.
- **Interleaved.** 67 commits from elsewhere sit in the range, among them the parallel book `assistant-outbox-relays`
  (its implementation `fe29db24` landed between this book's Phase-3 tests and its implementation), PR #787 (router
  hardening), PR #826 (`relay-stream-gaps`) and the outbox book's close.
- **The implementation was held locally until review passed** (the owner's choice), then rebased twice onto a moving
  `staging` and pushed as one fast-forward (`0ee7e350..1229c154`).
- **Staging: deployed** (deploy run 547, commit `1229c154`, 2026-10-09).
- **Production: shipped** in the owner's full `staging` → `main` promotion, PR #829, merged 2026-10-09 as `cfcd83c4`
  (deploy run 140), by the coordinating session.

**Provenance:** Acceptance-frame. There is no PRD and no Discovery conversation. The owner's ask is quoted verbatim in
`book.md`. Three decisions were taken at Planning, two open questions were settled at story approval, and the frame was
confirmed when the owner approved stories 1–3 on 2026-10-09.
**Confidence:** **high** for what the code does, **medium** for the frame as a person will meet it.
- **Every frame bullet traces to a story.** Story 1 passed review in round 1. Stories 2 and 3 passed in round 3, after
  two rounds that each found a way for a one-click fix to overwrite the Assistant's real profile (§4 #5).
- **The code was exercised hard, but not live.** Four full gate runs, the browser classes against a built bundle, and
  the reviewers' probes: the real status handler and resolver driven through every branch, and every fix type pressed
  against relay-sourced, missing and null answers.
- **Staging and production, checked anonymously at close** (my own requests): `/assistant/profile` answers 200; an
  anonymous `GET /api/assistant/my-picture` answers 401 `not-signed-in` ("Sign in to make a personalized avatar."); an
  anonymous `POST /api/assistant/avatar` answers 401; the old `/api/assistant/owner-avatar` answers 404 on staging;
  anonymous attention is `{"success":true,"signedIn":false}`. The staging bundle (`index-lfo5KJK1.js`) is
  byte-identical to the build reviewed here, and the production bundle carries round 3's `profileSource` guard.
- **What the record cannot show.** Nobody has used the signed-in flow on any live instance: a real Assistant's seven
  panels, a one-click fix publishing, a person stamping their own picture. No browser session with a nostr signer was
  available. Every browser test mocks the API.

> The Build Audit is the as-built record. It does not propose changes — that is `prd-seed.md`'s job.

## 1. What shipped

- **One real answer for the profile.** `GET /api/assistant/attention` answers `profile` for the signed-in viewer's own
  Assistant only. It checks seven items, the background image listed but not computed and not counted:
  - **a personalized avatar:** the picture is a composite this instance stamped and still holds;
  - **a working NIP-05:** it is on this instance's domain, and this instance's own `/.well-known/nostr.json` resolves it
    to the Assistant;
  - **the website:** it is this instance's URL;
  - **name and About:** both are filled;
  - **the client tag:** the newest profile event carries this instance's `client` tag;
  - **visible to other nostr apps:** at least one outside relay holds a copy at least as new as this instance's.
  The profile is read from this instance's relay first and strictly, so an unreadable local relay is "could not
  check", never "no profile". On an instance with no public address, the avatar, NIP-05, website and client tag read
  **Needs attention**, with that reason — `stories/done/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`
- **The hub tells the truth for this action.** The "Your Tapestry Assistant's Profile" card reads **Done** once every
  counted item is done, and **Needs attention** otherwise; the count line marks it the same way; the Assistant Alert
  counts it only when a finished check found something missing. The hub's **Done** badge was built, word for word to ADR
  0001 sub-decision 7, by the parallel book `assistant-outbox-relays`, and this book's tests pass against it — story 1.
- **The page** at `/assistant/profile` replaces its placeholder. Seven panels in the Identification Tags page's card
  style, each **Done**, **Needs attention** or (the background image) **Coming soon**, with a line saying why in plain
  words; a summary line ("2 items need attention" / "Your Assistant's profile is complete."); a notice with **Publish the
  default profile** when there is no profile; and a link to the Edit Assistant Profile page —
  `stories/done/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`
- **One-click fixes.** Republish to register the NIP-05, **Set website to {url}**, **Fill in the default** name / About
  text, **Republish from {domain}** (client tag), **Publish to outside relays** (visibility). Each reads the published
  profile, changes only its own field, publishes through the one writer (`POST /api/assistant/publish-profile`), shows
  each relay's answer, and re-checks. One fix at a time.
  - **A fix publishes only when its press-time read is this instance's own copy** (ADR 0002 Amendments 1–2). Otherwise
    nothing is posted, the panel says "This instance did not answer; nothing was published.", and the page re-checks —
    story 2, review rounds 2–3.
- **A personalized avatar for every Assistant.** The Owner, an Admin or a Customer presses **Make my personalized
  avatar**: this instance fetches the picture on the person's *own* nostr profile (`GET /api/assistant/my-picture`,
  no URL or person in the request), the browser stamps it with the Tapestry mark, and the person sees it first.
  **Publish this avatar** stores it on this instance and publishes it as their own Assistant's picture; **Not now**
  discards it. The Edit Assistant Profile page offers the same stamping to everyone —
  `stories/done/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`
- **The safety rules, for more people.** Both avatar routes refuse a visitor (401) or a person with no Assistant (403)
  before anything is fetched or stored. Every hop of the picture fetch, a single redirect included, goes through the
  SSRF guard (https, public hosts). A stored file is checked to be a PNG by its bytes, at most 2 MB, named by 32 hex of
  its SHA-256, never deleted, and limited to 20 new files per person per rolling day — story 3.
- **The contracts are written down:** `src/api/openapi.yaml` (the action's shape; `my-picture`; the avatar store),
  BIBLE §11 (the attention row) and §14 (the one writer's second caller).

## 2. Epics & stories rolled up

### Epic: `assistant-profile-checklist` (Done at this close)
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 the-profile-check-and-the-hubs-done-mark | The seven items (shared library), the server's check for the viewer's own Assistant inside the one attention answer, the hub's card, count line and pill | Done | `reviews/done/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md`: PASS, round 1 |
| #2 the-checklist-page-and-its-one-click-fixes | The page, its seven panels and words, the one-click fixes through the one writer | Done | `reviews/done/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md`: CHANGES_REQUESTED in round 1 (a failed local read let a fix publish the default profile) and round 2 (a read that fell back to an older outside copy let a fix republish it); PASS in round 3 |
| #3 a-personalized-avatar-for-every-assistant | Stamping the signed-in person's own picture for their own Assistant, for every role; the avatar panel's fix; the editor's section for everyone | Done | `reviews/done/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md`: CHANGES_REQUESTED in rounds 1–2 (story 2's defect, reached through `set-picture`); PASS in round 3 |

**Epic close-out at this close.** All three stories are Done and the work is on the shared line and on `main`. Step 9
of the close workflow applies as written: the epic reads Done, and its story, ADR and review folders sit under `done/`.

## 3. As-built inventory

Derived from the book's three `impl:` commits (`4850c93f`, `323140e2`, `f3666583`): 15 source and contract files plus
BIBLE, net +1353 −201, checked file by file against the stories, ADRs, amendments, plans and reviews.

- **User-facing.**
  - `/assistant/profile` replaces its placeholder (`ui/src/pages/assistant/ProfileChecklist.jsx`; words and the pure
    rules — `panelState`, `panelLine`, `summaryText`, `fixFor`, `applyProfileFix`, `describeProfilePublish` — in
    `profileChecklistCopy.js`; `.bs-profile-check-*` rules and a neutral badge in `ui/src/styles.css`). It reuses the
    `.bs-idtags-card*` classes and is routed through `ACTION_PAGES` in `ui/src/App.jsx`.
  - The hub (`ui/src/pages/assistant/actions.js`): `profile` joins `CHECKED_ACTIONS` (now six entries, after later books).
  - The stamping flow shared by the page and the editor: `ui/src/utils/stampedAvatar.js` (`stampMyPicture`,
    `storeStampedAvatar`, `reasonOf`). `ui/src/components/AssistantProfileEditor.jsx` uses it and shows the stamped
    section to everyone, with story 3's "no picture" line.
- **Server.**
  - `src/api/assistant/profileChecklist.js`: `checkProfile`, the pure `evaluateProfileItems`, `readVisibility`
    (each outside relay once, 4 s each), with a strict local scan injected into the profile resolver.
  - `src/api/assistant/attention.js`: the profile check runs beside the others under `Promise.allSettled`; a failing
    check answers `check-failed` without failing the rest.
  - `src/api/assistant/avatar.js` (rewritten): `requireOwnAssistant` (401 / 403 / 500; the in-container operator acts
    as the Owner), `getPersonPictureUrl` (local kind 0 first; the profile relays only when the local relay holds none),
    `handleMyPicture` (every hop through `guardedFetch`, one redirect), `handleUploadAvatar` (the daily limit),
    `storeCompositeAvatar` (32-hex names), `hasStoredAvatar`.
  - `src/api/index.js`: `GET /api/assistant/my-picture` and `POST /api/assistant/avatar` behind the gate, the gate
    before multer; `/api/assistant/owner-avatar` removed.
- **Shared library.** `src/lib/assistant-profile-items/index.js`, pure CommonJS with no imports, reached by the UI
  through the Vite alias `@tapestry/assistant-profile-items` (`ui/vite.config.js`): `PROFILE_ITEMS`,
  `COUNTED_PROFILE_ITEM_KEYS`, `PROFILE_CONTENT_FIELDS`, `COMPOSITE_AVATAR_FILE_RE` (8 to 64 hex, so older composites
  still count).
- **Domain.** No concept definition changed; no firmware reinstall. "Whose Assistant" is `user.assistantPubkey`, the
  one main→delegate mapping; this instance's domain is read at runtime (`describeInstance`). No TA pubkey literal was
  added.
- **Data & contracts.**
  - **No new wire format.** The kind 0 is the one writer's, unchanged; a fix posts exactly the seven
    `PROFILE_CONTENT_FIELDS`, and the writer still sets the NIP-05 and the client tag.
  - **The answer.** `actions.profile = { finished, done, pending, hasProfile, reason, instance: { domain, website,
    isPublic }, items: [{ key, counts, finished, done, reason, …detail }] }`; `hasProfile` is `null` when this
    instance's relay could not be read. `check-failed` carries `items: []`.
  - **`GET /api/assistant/my-picture`.** The image bytes with their type, or 401 `not-signed-in`, 403 `no-assistant`,
    500 (the key store), or 404 with a code: `no-picture`, `unfetchable` or `not-stampable`.
  - **`POST /api/assistant/avatar`.** 200 `{ success, filename, path, url }` (`url` empty with no public address);
    429 `too-many`; 400 for no file or anything that is not a PNG of at most 2 MB; the gate's refusals.
- **Tests.**
  - **Unit:** 66 tests in three suites (`assistant-profile-check` 33, `assistant-profile-checklist-page` 14,
    `assistant-stamped-avatar-for-everyone` 19), fixtures in `test/helpers/profileChecklistFixtures.js`,
    `test/registry.js` +3.
  - **Browser:** 28 cases (`assistant-profile-check.spec.js` B1–B5; `assistant-profile-checklist-page.spec.js`
    C1–C16 and AV1–AV7).
  - **Re-aimed:** `assistant-attention`, `stamped-composite-avatar`, `my-assistant-page`, `one-writer-assistant-profile`;
    the specs `assistant-attention`, `assistant-alert`, `assistant-management-page`, `my-assistant-page`,
    `ta-composite-avatar`, `assistant-default-profile`.

## 4. Deviations from intent

Harvested from the stories' § Deviations, § Out of scope and § Open questions, the ADRs' § Consequences and ADR 0002's
Amendments 1–2, and the three reviews' rounds, then reconciled against the diff.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 1: "Each panel is **Done** or **Needs attention**" | Two more visible readings: "Checking…" while the answer is on its way, and "Could not check: …" when a part of the check failed (marked **Needs attention**). The background image reads **Coming soon** | interpretation | ADR 0002 sub-decision 2 (marked until proven done, as the hub) | A panel never claims Done on a check that did not finish | — |
| 2 | Frame bullet 1 (and story 1 open question 1): what a dev box reads | The avatar, NIP-05, website and client tag read **Needs attention**, "this instance has no public web address", with no fix; a dev box's profile never reads Done | intentional-change | settled at story approval, as recommended | Dev boxes always show the profile card as needing attention | — |
| 3 | Frame bullet 2: "the instance says which items are done" | As specified, read local-first and strictly. `hasProfile` is `null` when the local relay cannot be read, so no default is offered then. Worst-case wait for the attention answer is about 10 s on a first load after a profile is found only outside, not ADR 0001's "about 5 s" | constraint-discovered | story 1 Deviation 1; review 1 non-blocking 1 | The hub and pill can wait up to ~10 s in that rare case | §6 #6, #11 |
| 4 | Frame bullet 3: the hub card's Done | As specified. The Done badge was built by the parallel book to this book's ADR 0001 sub-decision 7; the merge kept one copy | interpretation | ADR 0001 sub-decision 7; outbox audit §4 #3 | None | — |
| 5 | Frame bullet 4: a fix "changing only what that item is about" | A fix publishes only when its press-time read came from this instance's own relay; any other read (failed, missing, an outside relay's possibly older copy) posts nothing and says "This instance did not answer; nothing was published." | constraint-discovered | review 2 B1 and R2-1; ADR 0002 Amendments 1–2 | On a flaky local relay a press may need repeating. Without the guard, a press could have replaced the real profile with the default or an older copy, everywhere and irreversibly | §7 |
| 6 | Frame bullet 4: "changing only what that item is about" | A fix posts the seven fields the one writer knows; any other kind 0 field (e.g. one another app added) is dropped, as the editor already does | constraint-discovered (pre-existing) | story 2 § Out of scope; ADR assistant-profile/0005 | A profile edited in another nostr app can lose its extra fields on a fix | §6 #4 |
| 7 | Frame bullet 4: each relay's answer is shown | As specified, reusing the editor's exported words (`relayLine`, `publishTone`); the editor keeps private copies | interpretation | ADR 0002 sub-decision 6; § Consequences | None | §6 #7 |
| 8 | Frame bullet 5: "the Owner, an Admin or a Customer can stamp their own nostr picture" | As specified, with bounds the frame did not name: https public hosts only, so the Owner can no longer stamp an `http://` or private-host picture; 20 new files per person per day, per process; `owner-avatar` removed | constraint-discovered | ADR 0003 sub-decisions 4–8, § What we trade away | A person whose picture is on plain http cannot stamp it | §6 #8 |
| 9 | Frame bullet 5: "publish it as their own Assistant's picture, hosted by this instance" | On a dev box the preview still offers **Publish this avatar**, which stores a file that can never be published (the panel already says why). A refused press (§4 #5) can also leave a stored, unpublished file | interpretation | ADR 0003 sub-decision 9; review 2 non-blocking 2; review 2 round 2 (AV7) | A few dead files on a dev box | §6 #6 |
| 10 | Frame bullet 6: "no other action page is touched … the kind 0 wire format is not changed" | Held. The Edit Assistant Profile page changed as story 3 AC-4 asks (the stamped section for everyone, the shared flow); the one writer gained a caller, not a change | — | story 3 AC-4; ADR 0002 Option A | None | — |
| 11 | Frame bullet 3: the hub "tells the truth" | The Edit Assistant Profile page does not ask for the answer again after a publish; the hub shows the change after the next full page load | deferred | ADR 0001 § Consequences ("a candidate ledger row for the close") | A person who fixes something in the editor sees the hub catch up only on reload | §6 #7 |

**Undocumented work** — none. Every source file in the book's commits is named by a story, an ADR or amendment, a plan
or a review. One documentation claim is wrong: BIBLE's "Last updated" line credits §11 and §14 with the avatar routes,
which neither section's body lists (review 3 non-blocking 6; §6 #6).

## 5. Quality state at close

- **`npm test` at close,** after the book flip and the epic close-out, over the tree this close leaves behind:
  `20261010T032906Z-2901-3101 [book-close-assistant-profile-checklist] started 2026-10-10T03:29:06.572Z on 27623399+dirty — PASS, exit 0, 5528 passed, 0 failed, 582 skipped, 290/290 suites`
  (`+dirty` is this close, uncommitted; the clone was unshallowed at this close). `harness-lint` passes over the closed
  tree, with the epic Done and its folders under `done/` (L2 satisfied).
- **Correction to the review record: the `harness-lint` failure in every gate run of this book was never real.** All
  four runs (`20261009T163208Z-6889-0b67`, `20261009T184301Z-9885-63f0`, `20261009T185827Z-7445-b6b9`,
  `20261009T194027Z-7490-ea43`) read "FAIL … 1 failed: harness-lint", and three reviews and the Implementer called it "the
  pre-existing L10 violation (`commit:695fac48`), another session's harness commit". `695fac48` was this checkout's
  shallow-clone boundary. After `git fetch --unshallow origin` at this close, `bash scripts/harness-lint.sh` reports
  "clean (0 violations)", and story `harness-gate-integrity` #3 (PR #835) has since made L10 say INFO in a shallow
  clone. So every one of those runs was green apart from the clone. PR #829's own run on `1229c154` read 5394 passed,
  0 failed (its description).
- **The book's suites at round 3:** `assistant-profile-check` 33/0, `assistant-profile-checklist-page` 14/0,
  `assistant-stamped-avatar-for-everyone` 19/0; the re-aimed `assistant-attention` 38/0, `my-assistant-page` 31/0,
  `one-writer-assistant-profile` 17/0, `stamped-composite-avatar` 13/0.
- **Browser classes, chromium, against a `vite build` served statically, every `/api` route mocked:** the ten affected
  specs together, 122 passed and 3 skipped (round 1) and 123 passed (round 2's implementation); round 3's reviewer, five
  specs, 59 passed. The 3 skips are `assistant-management-page` B8 for the built action pages.
- **Reviewer probes** (rounds 1–3; nothing sent): the attention handler with both new checks throwing (200, two
  `check-failed`, identification-tags intact); the real status handler and resolver through every branch
  (`profileSource` is `'local'` only after a successful local scan); every fix type against `'relay'`, missing and
  `null` sources (nothing posted) and `'local'` (posted); C16 failing on a scratch build of `b5ce4a2d` and passing on
  HEAD.
- **Staging and production, checked at close:** see the header. **Not exercised: the signed-in flow** (ledger
  `2026-10-10-profile-checklist-signed-in-check`).
- **Known open issues** (pre-existing, reachable by more people now, or found in passing):
  - ledger `2026-10-10-abort-timer-cleared-before-body-read`: the picture fetch (`avatar.js`) and the NIP-05 lookup
    (`nip05.js`) clear their abort timer before reading the body, so a trickling upstream can hold a request open;
  - ledger `2026-10-10-one-writer-same-second-created-at`: the one writer stamps whole seconds with no `prev + 1`, so
    two publishes in one second can lose the later one on this instance's relay.
- **Debt from the ADRs' Consequences and the reviews:**
  - the kind-0 field list in three places (`PROFILE_FIELDS`, the editor's list, `PROFILE_CONTENT_FIELDS`), ADR 0001;
  - the editor's private relay-report helpers duplicating `relayLine` / `publishTone`, ADR 0002;
  - the avatar limit is per process and resets on restart, ADR 0003;
  - the page reuses `.bs-idtags-card*` outside its page (as the outbox page does; outbox audit §5).

## 6. Carry-forward register

- [ ] **1. Exercise the signed-in flow on staging and production:** the seven panels for a real Assistant, one fix
  publishing with its relay report, a stamped avatar published, the hub card turning Done.
  (§5; ledger `2026-10-10-profile-checklist-signed-in-check`)
- [ ] **2. Keep the abort armed through the body read** in the picture fetch and the NIP-05 lookup; serve `/generated`
  with `nosniff`; correct `bin/control-panel.js:159`'s "owner-gated" comment and the SSRF guard's header note.
  (§5; ledger `2026-10-10-abort-timer-cleared-before-body-read`)
- [ ] **3. The one writer's same-second `created_at`.** (§5; ledger `2026-10-10-one-writer-same-second-created-at`)
- [ ] **4. Kind 0 fields beyond the seven are dropped** by every publish from this instance, fixes and the editor alike.
  A product question first: keep unknown fields, or say so. (§4 #6; story 2 § Out of scope)
- [ ] **5. The personalized background image**, the same idea for the banner; its panel is a placeholder that does not
  count. (book acceptance frame; epic § Deferred)
- [ ] **6. Small edges of the page and its record:** "Checking…" forever when an older server sends no profile action;
  the dev-box **Publish this avatar** button; the OpenAPI rows' detail fields and the gate's 500; BIBLE's "Last
  updated" claim; ADR 0001's 5 s figure; ADR 0002 Amendment 2's wording (R3-1, R3-2).
  (§4 #3, #9; ledger `2026-10-10-profile-checklist-small-edges`)
- [ ] **7. Code debt:** the three kind-0 field lists, the editor's duplicate report helpers, and the editor not asking
  for the answer again after a publish. (§4 #7, #11; §5; ledger `2026-10-10-profile-field-list-and-editor-debt`)
- [ ] **8. Composite storage:** the per-process limit (a durable quota if storage use shows a need) and retention of
  old composites (ta-avatar audit §6, still open). (ADR 0003 § Consequences)
- [ ] **9. Automatic re-stamping when a person changes their own picture.** (story 3 § Out of scope; ta-avatar audit §6)
- [ ] **10. More checks:** a lightning address item, and whether the picture actually loads in a stranger's browser.
  (story 1 § Out of scope; epic § Deferred)
- [ ] **11. A short memo for the check's network reads,** only if measured latency hurts the pill. (ADR 0001
  § Consequences; §4 #3)
- [ ] **12. The hub's remaining placeholders:** Bounties, Pins, Tags, Notifications and Alerts, Preferences.
  (`stories/_intake.md` 2026-09-21; assistant-management audit §6 #1–#2)

## 7. Process findings (harness)

**Measured at retro time** (`bash scripts/harness-stats.sh`, 2026-10-10):
- 278 reviews parsed: 276 final PASS, 2 final CHANGES_REQUESTED, 66 with kick-back history, re-review churn 3.
- The headline kick-back rate reads 0% because it counts final verdicts only, so stories 2 and 3's four sent-back
  rounds are invisible there (OPEN.md row 309, already open).
- 23 phase commits matched this epic by name (the 24th, a `story (draft):` commit, has no recognised prefix).

**What held.**
- **Reviewer step 10 ("check every fix as a fresh claim").** Round 2 re-derived the round-1 premise that the amendment
  had copied, and found the second way in. Round 3 drove the real handler through every branch rather than trusting the
  amendment's prose.
- **The shared-line re-check** (book § Shared lines; ledger `2026-09-22-parallel-books-no-shared-line-recheck`) found
  the outbox book's 17 commits before Review. The rebase resolved eight shared files, and both books' suites passed on
  the merged tree. Building the Done badge to one ADR's words let two books build it once.
- **Each round kept ADR, test and implementation in separate commits,** each pin was shown failing before its fix
  (C14, C15, AV7 on round 1's build; C16 on a scratch build of `b5ce4a2d`), and Tester-lane corrections in Phase 4
  went into their own `test:` commits (`ac4ffbc`, `ef81af6`, `eea477f`).

| Finding | Source | Terminal state |
|---|---|---|
| **An irreversible write built from a fallible read was designed, tested and implemented without anyone asking what a failed or stale read produces.** ADR 0002 sub-decision 5 made the default the base when the press-time read said "no profile", the test plan pinned it (P9), and the Implementer built it. Review found the overwrite twice: a failed local scan (round 1), then a fallback to an older outside copy (round 2). Each cost a full round. Ports to Direction mode: yes, the same Architecture and Test Design phases | review 2 B1 and R2-1; review 3 rounds 1–2 | OPEN.md row `2026-10-10-irreversible-write-from-fallible-read` |
| **A failure path's premise ("the relays hold nothing by definition") was written without citing the line that defines it, and the Implementer copied it into ADR 0002 Amendment 1 unchecked.** Round 2 found it false | review 2 round 2 harness friction | declined: reviewer step 10 caught it at the next round as designed, and the round-2 reviewer judged that no new rule is needed; the general lesson is carried by the row above |
| **The shallow-clone L10 artifact was misread again,** by three review rounds and by the Implementer, as "a pre-existing L10 violation, another session's harness commit"; a task was even suggested to add the CHANGELOG row. This was the second book in a row to misread it (after `assistant-outbox-relays`). Ports: yes | reviews 1–3 quality gates; this close's unshallow check | harness commit: PR #835 (story `harness-gate-integrity` #3, merge `a191de3f`), which landed after this book's reviews; ledger `2026-10-07-shallow-clone-trips-lint-l10` DONE |
| **This book's intentionally failing Phase-3 tests sat on `origin/staging` for about 15 hours** (pushed 04:19–04:37, implementation pushed 19:48) and held the promotion PR #829 (opened 16:46 for the outbox book and others) red until the implementation landed. The owner's "hold the implementation until Review passes" choice, made to keep unreviewed code off staging, lengthened the red window, because the failing tests were already there. Ports: yes | book commits; PR #829's hold comment | OPEN.md row `2026-10-07-staging-sessions-push-red-tests` (occurrence appended) |
| **The Phase-3 re-aim list missed four existing pins** (my-assistant-page A1, W16, W20; one-writer W5), found on the first run against the implementation | story 3 Deviation 6; story 2 Deviation 5 | declined: the first run against the implementation is the designed net, it caught all four inside Phase 4, and the corrections went into their own `test:` commit |
| **Two hand-off briefs to reviewer subagents carried errors:** `TEST_GATE_LABEL` for `GATE_LABEL`, and a `dist/` freshness check that could not prove anything (a diff against HEAD itself, plus an mtime from before the commit) | review 1 harness friction 1; review 2 round 3 harness friction | declined: the README states the variable correctly, and both reviewers verified another way (the gate's own label; the bundle's content). One-off brief errors with no doc defect behind them |
| **The environment's stop hook asked to push unpushed commits at the end of nearly every turn while the owner had chosen to hold them until Review passed** | this session | declined: the hook belongs to the cloud environment, not this repo's harness, and the hold was honored each time |
| **After an epic close-out, code and test header comments name the pre-move paths** (`engineering-team/stories/assistant-profile-checklist/…`) | this close | declined: as at the `assistant-outbox-relays` close — the file names are slug-unique and found by name after the move |
| **The headline kick-back rate hides re-review rounds** (four sent-back rounds read as 0%) | `harness-stats.sh` at this retro | OPEN.md row 309 (already open) |
