# Build Audit: List Headers disposition, signed only by you or your own Assistant

**Book:** `engineering-team/audits/list-headers-disposition/book.md`
**Date:** 2026-10-02
**Branch / commit range:** `f5fc0020..<close commit>` on `feat/list-headers-disposition`.
- The first book commit is `02c9411a` (story 1). The base is staging at story 1's start.
- The branch's first-parent line excludes one merge of staging (`f57760f3`), which brought in #800, the Dictionary
  entry page. That is another book's work.
- The book shipped to staging in one PR, #801 (merge `02a0d5a0`, deploy run 36959875594). It is not in production.

**Provenance:** Acceptance-frame
**Confidence:** high. The owner confirmed the frame with story 1. Every frame bullet maps to Done stories whose final
reviews passed. The smoke checks ran on the live staging instance after the deploy.

> The Build Audit is the **as-built record**: what the product *is* now, factual and source-linked. The product team
> reads it to scope the next phase; a future engineer reads it to understand what shipped. It does **not** propose
> changes; that's the seed's job (`prd-seed.md`).

## 1. What shipped

- **Me and My Local Tapestry Assistant in the List Headers Author selector.** They sit at the top, for a signed-in
  person, ahead of today's entries.
  - **Me** shows the headers the person's own account signed.
  - **My Local Tapestry Assistant** shows those signed by the Assistant this instance holds for them. It's greyed
    out, and labelled "(none on this instance)", when there isn't one.
  - The choice resets to **All authors** on sign-out, and doesn't come back at the next in-page sign-in.

  `stories/done/list-headers-disposition/1-author-selector-me-and-my-assistant.md`
- **A 🧭 b-disposition column,** read from each header's own tags, the way Concept Headers reads its own:
  - 🔗 wired; 🤝 self-declared; 🔒 kept private; ○ not yet decided;
  - "—" for kind 9998, which can't be re-published.

  It reports every author's headers. It doesn't gate anything.
  `stories/done/list-headers-disposition/2-b-disposition-column.md`
- **A Disposition panel on the person's own Assistant's rows,** opened by a **Disposition…** button on every one of
  those rows, whatever its state.
  - **Submit as a Shared Concept** adds the self-pointing b and drops the keep-private marker, and is sent to the
    community relay.
  - **Keep private** marks an undecided header and is never broadcast.
  - **Next undecided →** walks the Assistant's remaining undecided rows.
  - The person's own Assistant signs, on the server. There is no owner, admin or loopback path.

  `stories/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md`
- **Wire to an external shared concept,** on the same panel and under the same rule.
  - A pick-list shows the community relay's Shared Concepts by name, with their descriptions.
  - Any list-header address is accepted (kind 39998, at most 1024 bytes, no control or format characters) except
    the header's own.
  - A second wiring keeps the first.

  `stories/done/list-headers-disposition/4-wire-on-my-assistant-rows.md`
- **The same panel and all three actions on Me rows,** signed by the person's own browser signer (NIP-07).
  1. The server prepares the new version, and the signer is asked once.
  2. The server accepts only the signed-in account's signature of exactly that change, re-derived from the current
     header.
  3. It saves locally, reads the event back from the relay, then updates the graph.

  The instance never sees the person's key. "Already" answers never prompt. No signer, a declined prompt and a signer
  on another account each say so, and nothing is saved. **Next** walks one kind of row at a time: Me rows or Assistant
  rows, never both. The panel closes if its row stops being the viewer's, for example after an in-page sign-out.
  `stories/done/list-headers-disposition/5-disposition-on-me-rows.md`

## 2. Epics & stories rolled up

### Epic: `list-headers-disposition` (Done)

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 author-selector-me-and-my-assistant | Me / My Local Tapestry Assistant entries; reset on sign-out (ADR 0001 + Amendment 1) | Done | `reviews/done/list-headers-disposition/1-author-selector-me-and-my-assistant.md` (PASS, one round) |
| #2 b-disposition-column | The 🧭 column from each event's own tags (ADR 0002) | Done | `reviews/done/list-headers-disposition/2-b-disposition-column.md` (PASS, one round) |
| #3 disposition-on-my-assistant-rows | The Assistant endpoints and the panel: Submit, Keep private, Next (ADR 0003 + Amendment 1) | Done | `reviews/done/list-headers-disposition/3-disposition-on-my-assistant-rows.md` (three rounds) |
| #4 wire-on-my-assistant-rows | Wire, its pick-list, the bounded target, and the read-back for all three actions (ADR 0004 + Amendment 1) | Done | `reviews/done/list-headers-disposition/4-wire-on-my-assistant-rows.md` (two rounds) |
| #5 disposition-on-me-rows | Prepare / sign / commit for Me rows; the panel's lifecycle (ADR 0005 + Amendment 1) | Done | `reviews/done/list-headers-disposition/5-disposition-on-me-rows.md` (two rounds) |

The epic planned four stories. Story 3 was split at its planning gate, because three actions over every row state
ran well past five acceptance criteria: Wire became #4 and Me rows became #5.

## 3. As-built inventory

**User-facing (`/tapestry/lists`):**
- **Two Author-selector entries:** `@me` and `@my-assistant`, resolved from `useAuth().user` only
  (`ui/src/utils/viewerAuthorScope.js`).
- **The 🧭 column** (`ui/src/utils/listHeaderDisposition.js`, in `ui/src/pages/lists/Index.jsx`).
- **The Disposition… button.** It appears only where `rowSigner(row)` is `'me'` or `'my-assistant'`.
- **The panel and its host** (`ui/src/pages/lists/ListHeaderDispositionPanel.jsx`):
  - Submit, Keep private, the Wire section with its pick-list, and Next / Done;
  - the pick-list is read once per panel session;
  - the panel scrolls itself into view.

**Endpoints:**
- `POST /api/list-headers/my-assistant/:handle/{self-declare,b-defer,b-append}`
  (`src/api/list-headers/myAssistantDisposition.js`). These sign with the caller's own Assistant.
- `POST /api/list-headers/me/:handle/{self-declare,b-defer,b-append}/{prepare,commit}`
  (`src/api/list-headers/meDisposition.js`). These sign nothing; they take back the person's own signature.
- Both are registered in `src/api/index.js`. Every route checks, in order:
  - same host;
  - a verified session (`requireAuth`, never loopback trust);
  - the header's author is the caller's own Assistant, or the caller;
  - the stored header verifies (author, kind, first `d`, signature);
  - the shared rules;
  - then local strfry, a read-back by id, and only then the graph.

**Shared rules:** `src/lib/headerDispositionCompose.js`. It holds `composeSelfDeclare`, `composeKeepPrivate`,
`composeWire` and `nextCreatedAt`. A parity test keeps Concept Headers' inline copies in step until that page's fix.

**Browser helpers:**
- `ui/src/utils/myAssistantDisposition.js`;
- `ui/src/utils/meDisposition.js`, which handles prepare, the signer guard, `signEvent` and commit, and maps signer
  failures to the story's sentences.

**Domain.** Only kind-39998 list headers are re-signed, as new versions at the same address.
- **The b-tag forms used:** the self-pointing `['b', <own address>, 'pointer']`, a pointer to another list header,
  and the keep-private marker `['b', 'b-tag-deferred']`.
- **Concept handles:** `39998:<TA>:list` headers. The pubkey part differs per instance.
- **No concept, schema or firmware change.** No reinstall.

**Data & contracts:**
- **Me prepare answers** `{ result: 'sign', template: { kind, content, tags, created_at, pubkey } }`, or "already"
  with the stored event, or a refusal.
- **Me commit takes** `{ event, target? }`. It refuses another account (403), anything but the exact change (409), a
  bad signature (400) and a header dated more than 600 s ahead (409).
- **The relay read-back** answers 502 "nothing saved" or "couldn't confirm".
- **Answers never carry key material.**

**Tests:**
- **Node suites:** `test/list-headers-{author-options,disposition-column,my-assistant-disposition,me-disposition}.test.js`.
  The last two include live refusals inside the container, through `test/helpers/stackHttp.js`.
- **Playwright specs:** `tests/brainstorm/list-headers-{author-options,disposition-column,my-assistant-disposition}.spec.js`.
  They're hermetic, with a stubbed NIP-07 signer that counts `signEvent` calls.

## 4. Deviations from intent

The anchor is the acceptance frame in `book.md` and its five intake decisions.

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame bullet 3: the panel offers all three actions on rows the person or their Assistant wrote | Delivered over three stories (#3 Assistant rows with Submit and Keep private; #4 Wire; #5 Me rows) instead of one | interpretation | Split at story 3's planning gate (epic file; story 3 Out of scope) | None. All three shipped together, before staging | — |
| 2 | Decision 1: "The server only checks the signature" | The server also re-derives the action's change from the current header, and accepts only that exact change, signed by the session account: prepare → sign → commit | intentional-change (stricter) | ADR 0005 Option A. Story 5 AC 4: "nothing but the person's own change" | Two requests per Me action. A header changed by someone else between prepare and commit gets 409, and the person reopens it | — |
| 3 | Frame bullet 3: "Wire to an external shared concept" | Any list-header address except the header's own. It isn't checked to be a known Shared Concept. Kind 39998 only, ≤1024 UTF-8 bytes, no Cc/Cf characters | constraint-discovered + interpretation | Owner decisions at story 4 (any address; list headers only). The relay's `maxTagValSize = 1024`, and `strfry import` exits 0 when it rejects (ADR 0004 Amendment 1) | A typo'd but well-formed address can be wired. Wiring by a kind-9998 event id isn't offered | Story 4 Out of scope |
| 4 | Not in the frame | The relay is read back by id before the graph is written, for all three actions on both row kinds. A relay refusal is a 502 "nothing was saved" | added-beyond-scope (constraint-discovered) | `strfry import` exits 0 when it rejects an event (ADR 0004 Amendment 1 §4) | The panel never claims a save the relay refused | Ledger row `2026-10-01-list-headers-readback-hardening` |
| 5 | Frame bullet 4: nobody can make someone else's key sign | Also a same-host check, and verification of the stored header before re-signing it or answering "already" | constraint-discovered | Story 3 review round 1, from the independent pass (ADR 0003 Amendment 1) | A cross-site POST is refused, and a forged header in the relay can't be "upgraded" | Meta row `2026-10-01-signing-endpoint-precedent-misses-samehost` |
| 6 | Frame bullet 3 implies one Next | **Next undecided →** walks one kind of row: Me rows from a Me row, Assistant rows from an Assistant row | interpretation | Owner decision at story 5 planning. A Me walk prompts the signer at each step and an Assistant walk never does | — | — |
| 7 | The panel "on rows that … wrote" | The button is on every own row, in any state, not only undecided ones | interpretation | Owner decision at story 3 planning | Already-decided rows can be re-submitted or wired | — |
| 8 | Not in the frame | The panel closes when its row stops being the viewer's (in-page sign-out or account switch) and stays closed | constraint-discovered | Story 5 review round 1, blocking 1 (ADR 0005 Amendment 1 §1) | — | Ledger row `2026-10-01-me-disposition-inflight-signer-prompt` (a request already in flight) |
| 9 | Not in the frame | A Me header dated so far ahead that its next version would pass now + 600 s is refused before anyone signs | constraint-discovered | The relay accepts publishes up to 900 s ahead, and import checks no timestamp (ADR 0005 Amendment 1 §3) | Such a header can't be dispositioned until its date has passed | — |
| 10 | Frame bullet 3's AC 3 sentences | Any failure at the signer's account step reads "Signing was cancelled in your signer — nothing was saved", even when the extension failed rather than the person declining | interpretation | ADR 0005 Amendment 1 §4; the owner accepted it at the amendment gate | The wording can say "cancelled" when nobody cancelled. "Nothing was saved" is always true | — |
| 11 | Frame bullet 4 | An admin or the Owner can act only on their *own* Assistant's rows from this page, so an admin can no longer act on the Owner's Assistant's rows here | intentional-change | ADR 0003 Consequences. This is the frame's rule | Admins who relied on Concept Headers' behaviour won't find it here. Concept Headers still allows it until its fix | Ledger row `2026-10-01-concept-headers-disposition-owner-signer` |
| 12 | — | **Keep private** has a tooltip when it can be chosen, and the 🧭 cell aligns the button with the marks | added-beyond-scope (cosmetic) | Story 3 `## Deviations` | None | — |
| 13 | — | A kind-39998 header with no `d` tag still links to `…:null` and is refused by the server's handle pattern | deferred | ADR 0002 and ADR 0003 Consequences. No such header exists locally or on staging | None today | — |
| 14 | Frame bullet 6: production only on the owner's go | On staging only | deferred | Frame bullet 6 | Not yet on tapestry.brainstorm.world | §6 |

**Undocumented work:** none. Every file in the book's diff (18 code and test files, plus the stories, ADRs, test plans,
reviews, book, epic and ledger rows) traces to a story or ADR. The one merge of staging, `f57760f3`, carried #800,
another book's work, and is excluded from the range.

## 5. Quality state at close

- **Test gate,** network-isolated (the recipe in ledger row `2026-09-30-npm-test-step-leaks-fixtures`; never the full
  `npm test` on the Mac Studio), over the tree this close leaves behind, after the flip and the epic close-out. See
  §5.1.
- **The reviews' gates:**
  - **Stories 1 and 2** ran their touched suites one by one, before the isolated recipe was adopted. CI's
    `stack-free` ran the full registry.
  - **Stories 3–5** ran the isolated full gate. Each final review passed: `20261002T005559Z-19-7f8b` (story 3),
    `20261002T015743Z-20-5116` (story 4), `20261002T031041Z-20-9bd6` (story 5).
  - **The merge commit for staging** passed too: `20261002T031920Z-20-31a1` (`f57760f3`, 4577 passed, 0 failed,
    259/259).
- **Browser specs:** the three List Headers specs passed 255/255 with `--repeat-each=5` on a fresh build of story 5's
  final implementation.
- **On staging after the deploy:**
  - the bundle changed (`index-CiTN_yF9` → `index-C-icYP2O`) and carries the new strings;
  - all nine new routes went from 404 before the merge to the handlers' own 401, in-container;
  - `/tapestry/lists` renders the 🧭 column over 379 rows with a clean console;
  - signed out, no Me entries and no Disposition… buttons, as specified.
- **Not proven live:** a real signed Me commit, and a real Assistant action on staging. They need the owner's key or
  session.
  - A real Submit and a real Wire ran in the local container during stories 3 and 4, on a local-only fixture.
  - Every Me check ran at handler level with real signatures.
  - The independent pass attacked the Me path in two rounds, 45 in-process attacks in the first.
- **Known open issues** (ledger):
  - `2026-10-01-concept-headers-disposition-owner-signer` (bug): Concept Headers still signs as the Owner's
    Assistant, and admins can trigger it;
  - `2026-10-01-new-dlist-assistant-signer` (bug): New DList's "Sign as Assistant" has the same flaw;
  - `2026-10-01-list-headers-readback-hardening` (security): the read-back matches by id only; a lone surrogate
    passes the target check; a narrowed concurrent-request race. Re-scoped to the Me path at story 5's review;
  - `2026-10-01-me-disposition-inflight-signer-prompt` (bug): a request in flight at sign-out can still prompt the
    signer. Nothing is saved;
  - `2026-10-02-author-selector-duplicate-owner-entry` (bug, pre-existing, found in the staging smoke): the Owner
    listed twice where the Owner is the pinned Dave pubkey.
- **Debt from the ADRs' Consequences:**
  - the chip words are duplicated with Concept Headers, guarded by a test (0002);
  - Concept Headers' inline rules are kept in step only by a parity test until its fix (0003);
  - the Wire target isn't checked to be a Shared Concept (0004);
  - two requests per Me action (0005);
  - the same-host check is copied per endpoint until OPEN.md row 326 centralises it (0003 Amendment 1).
- **Earlier audits' §6:** checked. No unticked item in another book's register is resolved by this one.

### 5.1 The gate over the final tree

> `20261002T033606Z-20-842b [lhd-close] started 2026-10-02T03:36:06.484Z on 00cbab67 — PASS, exit 0, 4577 passed, 0 failed, 594 skipped, 259/259 suites`

- **What `00cbab67` is:** a scratch clone's commit of this close's tree. It is HEAD `f57760f3` plus this close's
  staged diff (the moves, the 59 rewritten citations, the flips, both artifacts and the ledger rows). Its index blobs
  were checked identical to the staged close. It isn't the close commit itself, because the close isn't committed
  until the owner has checked it. The only difference from the close commit is this §5.1, written after the run.
- **How it ran:** `npm ci` in `node:22-bookworm` with network, then `npm test` with `--network none` and `CI=true`, in
  a Docker named volume that was removed afterwards.
- **Inside it:**
  - `harness-lint` passed 76/0, which covers L2 (a Closed book means its epics are Done) and L15 (ledger ids);
  - the four List Headers suites passed;
  - the live tests skipped, having no network.

## 6. Carry-forward register

- [ ] **Promote to production** on the owner's go (`/cycle-prod`). PR #801 is on staging only (§4 #14).
- [ ] **Fix Concept Headers' disposition signer** to the same rule. Its panel can point at this book's endpoints
      and drop `selfDeclare.js` / `bDisposition.js`'s inline rules (ADR 0003 Consequences; row
      `2026-10-01-concept-headers-disposition-owner-signer`).
- [ ] **Fix New DList's "Sign as Assistant"** (row `2026-10-01-new-dlist-assistant-signer`).
- [ ] **Read-back hardening:** verify the event found by id, refuse lone surrogates up front, and close the narrowed
      race (row `2026-10-01-list-headers-readback-hardening`).
- [ ] **Re-check the session before and after signing** a Me action (row
      `2026-10-01-me-disposition-inflight-signer-prompt`).
- [ ] **De-duplicate the Owner entry** in the Author selector (row `2026-10-02-author-selector-duplicate-owner-entry`).
- [ ] **Withdrawing a decision:** no action removes a b-tag today (story 3 Out of scope).
- [ ] **Wiring to a kind-9998 header by event id** (stories 4 and 5 Out of scope).
- [ ] **Showing what a wired header points at,** by name or address (story 2 Out of scope).
- [ ] **Remembering the chosen author across visits** (story 1 Out of scope).
- [ ] **One shared disposition component** for List Headers and Concept Headers, folding the duplicated chip words
      (ADR 0002 debt).
- [ ] **Signing several rows with one prompt,** and searching more relays for the Wire pick-list (stories 4 and 5
      Out of scope).

## 7. Process findings (harness)

Inputs: the five reviews' "Harness friction" sections (nine rounds in all), the book's `meta` rows, story 3's
`## Deviations`, and this close and the staging cycle.

`scripts/harness-stats.sh` at close: 256 reviews decided, kick-back rate 0% (CR-final ÷ decided), churn 3. Books:
7 open and 67 closed before this close. Median story cycle time is 0 days. This book ran five stories in two days.
Three of them needed a fix round after a CHANGES_REQUESTED review: story 3 twice, stories 4 and 5 once each. Each time,
the blocking finding came from an independent adversarial pass or a check on real data, not from the test suite. The
session-start digest also shows a standing meta escalation (167 open harness lessons). This retro adds one row to it
and resolves none.

| Finding | Source | Terminal state |
|---|---|---|
| ADR 0003 copied the older of two precedents for "a route that signs with the caller's own key". The older one has no same-host check, and nothing pointed the Architect at OPEN.md row 326 | Review 3, harness friction 1 | OPEN.md row `2026-10-01-signing-endpoint-precedent-misses-samehost` (meta) |
| Test Design's mutants were all changes *to the design*, never attacks it hadn't anticipated, so two security gaps reached Review. An adversarial pass belongs in Test Design for a signing story | Review 3, harness friction 2 | Same row (meta). Applied by hand in stories 4 and 5: a threat list in each plan |
| Unbounded request values weren't on the threat list. `strfry import` exits 0 on an oversize tag | Review 4 round 1 | Same row, update 2026-10-01: "bound every request-supplied value that becomes a tag" |
| A surface that acts as the signed-in person must handle the session changing while it's open. Story 5's panel didn't, and Review found it | Review 5 round 1, blocking 1 | Same row, update 2026-10-02. The remaining in-flight edge is row `2026-10-01-me-disposition-inflight-signer-prompt` |
| The full gate first ran in Review (story 3, round 2) and caught a guard failure that touched-suites runs couldn't see | Review 3 round 2, harness friction 1 | OPEN.md row `2026-09-30-npm-test-step-leaks-fixtures`, update: run the isolated recipe at Test Design and Implementation too. Applied from story 3 on, and every later gate passed |
| A publishing suite (`b-coverage-audit-and-disposition`) was run during story 2's Implementation before it was checked for publish markers. Verified harmless | Review 2, harness friction 1 | OPEN.md row `2026-09-27-test-fixture-taggings-on-prod-relays` (existing). It owns the hazard, and the check-before-run rule is in agent memory |
| A CHANGES_REQUESTED review that kept the template's `## On PASS` section after its verdict parsed as PASS (L1) | Review 5 round 1; this book's 4th occurrence overall | OPEN.md row 28 (meta), 4th occurrence recorded. Its candidate fix, a template line or a lint warning, is the operator's to ratify |
| The smoke test's "hit the new endpoint" can't prove a new POST route shipped on staging or production: the auth middleware answers every no-session outside POST with the same 401 before routing | This close's `/cycle-staging` | New OPEN.md row `2026-10-02-smoke-new-post-routes-masked` (meta), with the in-container before-and-after recipe that worked |
| ADR 0001's first rationale for the selector reset was wrong. Test Design's mutant oracle caught it, and Amendment 1 corrected it | Review 1, harness friction 1 | Declined: that is the process working. No change needed |
| `playwright.config.js` lists Firefox and WebKit, which this machine lacks | Review 1, harness friction 1 | Declined: every plan pins `--project=chromium`, so it costs nothing. A config change is out of this book's scope |
| ADR 0005 prescribed reusing a sentence ("…as your Assistant's, so nothing was signed") that is wrong in the new context. The Implementer flagged it, and Amendment 1 replaced it | Implementation report; review 5 non-blocking 3 | Declined: that is the gate catching it. No harness change would catch copy fit earlier at lower cost |
| A Linked-artifacts note "(round 1 CHANGES_REQUESTED; round 2 PASS)" in the story tripped L14 | Review 5 round 2, before its commit | Declined: the lint caught it before the commit, as designed |
| The owner answered two gate questions while the isolated gate for that phase was still running | Story 5, Test Design round 1 and Implementation | Declined: it's the owner's gate. Both gates were recorded afterwards and matched what the question had stated |
| Moving the epic's folders under `done/` breaks inbound references | This close, step 9 | OPEN.md row `2026-09-20-done-move-breaks-inbound-refs` (existing). This close rewrote its own 59 citations in 25 files and checked that every cited path resolves |

**Does it port to the other flow (Direction ↔ human-gated)?**
- **The signing-endpoint checklist row:** yes. A Direction-mode Architect and gate judge design and judge signing
  endpoints from the same role files.
- **The adversarial pass at Test Design:** yes. It's a Test Design rule.
- **The npm-test and isolated-gate row:** yes. Any flow that runs the gate on this machine has the hazard.
- **The smoke-test row:** yes. Both flows ship through the same cycle skills and `docs/SMOKE_TEST.md`.
- **Row 28:** yes. Both flows write reviews from the same template and lint them with the same rule.
