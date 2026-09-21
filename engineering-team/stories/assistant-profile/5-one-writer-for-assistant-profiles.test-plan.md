# Test Plan: Story 5 — One writer: nothing else can change an assistant's profile

**Story:** `engineering-team/stories/assistant-profile/5-one-writer-for-assistant-profiles.md`
**ADR:** `engineering-team/decisions/assistant-profile/0005-one-writer-for-an-assistants-profile.md`
**Date:** 2026-09-21

The tests are in two new files, plus re-aims in four existing ones and four carry-forward guards in a fifth.

- **`test/one-writer-assistant-profile.test.js`** — Node runner tests, registered in `test/registry.js` right after
  `my-assistant-page`. All of them are stack-free.
  - **G — the generic signer**, `POST /api/strfry/publish` (`handlePublishEvent`), driven for real. While a test
    runs, its side effects are stood in for:
    - strfry import (`child_process.exec`) records every event it would have imported;
    - the brain-write hook is counted;
    - the key store hands out a fixture key, never the instance's;
    - the owner gate admits an authenticated Owner or Admin, as `isOwner` does (owner-or-admin).
  - So a test sees exactly what the signer *would* sign and write. Nothing real is ever signed or written, even
    against today's code, which signs a kind 0 for the Owner, an Admin and the operator.
  - **P — `publish-profile`**, through ADR 0002's seam (`createPublishProfileHandler`). Every dependency that looks
    something up, signs, saves or sends is counted, so "nothing touched" is checked, not assumed.
  - **W — by source**: the dashboard, the two legacy pages, and the one writer's request. This is the CI-run
    backstop for the B-tests a source check can reach.
- **`tests/brainstorm/one-writer.spec.js`** — the Playwright **B** class: what the dashboard and the two legacy pages
  *do*. It is hermetic: every `/api` route is mocked.
- **Re-aims.** I found them by grepping `test/` and `tests/` for every literal ADR 0005 removes or changes, not only
  the suites of the files it edits (ledger `2026-09-21-adr-reaim-list-misses-outcome-asserts`). The literals were
  "Use the default profile", the dashboard's and the legacy pages' `publish-profile` calls, publishes with no
  content, the Owner publishing a Customer's assistant, and `signAs: 'assistant'` with kind 0.
  **The grep found nothing beyond the ADR's own list.** *(Corrected at review, 2026-09-21: not so. The `signAs`
  grep also listed `test/create-tapestry.test.js` and `test/add-a-concept-to-a-tapestry.test.js`, and neither was
  opened. Their R3 window sentinels were caught by Phase 4's full gate; see the story's Deviations and ledger
  `2026-09-21-adr-reaim-list-misses-outcome-asserts`.)*
  - **`test/one-default-assistant-profile.test.js`** (story 3):
    - **E1, E3, E5 and E6** publish with no content. Each now publishes the table the status offers, as content —
      what "Reset to defaults" then Publish sends. The signed results they assert are unchanged. They pass before
      and after.
    - **E7** ("the one definition cannot be swapped out") moves to the status seam, where the definition is now
      offered. It is a guard: it passes before and after.
    - **E8** (the Owner publishing a Customer's default) now expects 403 `not-your-assistant`.
    - **W2**'s last assertion is inverted: the dashboard posts nothing to `/api/assistant/`.
    - **R1** is inverted, as the guard itself asked: neither legacy page posts `publish-profile`, and each links to
      `/assistant`.
  - **`test/assistant-publish-relays.test.js`** (story 2): **E5**'s owner-for-a-Customer leg and **E7**'s no-content
    publish now expect refusals.
  - **`tests/brainstorm/assistant-default-profile.spec.js`**:
    - **B0**'s bundle marker was the "Use the default profile" label, which leaves the bundle. It is now the
      editor's "no NIP-05 is published", story 3's code, which stays.
    - **B1** now expects no one-click publish, and no request to `publish-profile` or the generic signer.
  - **`tests/brainstorm/assistant-setup-prompt.spec.js`**:
    - **B5** now expects the Owner to be offered no "Use the default profile".
    - **B3** keeps its assertion. Only its message changes: "stays Owner-only" is no longer true.
- **Carry-forward — ledger `2026-09-21-my-assistant-checks-browser-only`.**
  - **W17–W20** are added to `test/my-assistant-page.test.js`. They are the CI-run counterparts of story 4's B1, B11,
    B12 and B16.
  - Line 24 of `4-my-assistant-page.test-plan.md` is reworded: the W-class covers the B-tests a source check can
    reach, not all of them.

**Four choices for you to approve.**

1. **The G-class stands in for the signer's side effects through the require cache.** This follows
   `test/publish-event-signature-verification.test.js`: `child_process.exec` is a core module, so it is swapped on the
   module object.
   - The stand-ins stay in place for the whole call, not just the load. They hold whether the signer binds them when
     it loads (today) or looks them up when it runs.
   - Everything is restored afterwards, including any copy of each module that was already loaded.
2. **The browser class serves the legacy pages from this checkout's own `public/`, through `page.route`.**
   - `vite preview` serves only the built UI.
   - Express serves `/legacy/*` and `/control/*` from `public/` as the files are
     (`bin/control-panel.js:132-150, :207-266`), so this is the file under test, byte for byte.
3. **W4 reads the legacy HTML with a small balanced-tag scanner.** No HTML parser is installed, and none is added.
   The pages are hand-written, well-formed HTML.
4. **`asserts` in `test/my-assistant-page.test.js` learns one thing.** A guard may now be written as a negation or a
   comparison (`'!user'`, `"body.code==='no-picture'"`). Before, it returned false for both, so no existing guard list
   can reach the new branch. Story 4's 27 tests still pass unchanged.

## Coverage map

| Criterion | Test name | Test file | Level |
|---|---|---|---|
| AC1 | `W1: the dashboard's welcome card has one action — "Set up my Assistant's profile", which leads to the My Assistant page — and the dashboard neither publishes a profile nor offers "Use the default profile"` | `test/one-writer-assistant-profile.test.js` | source |
| AC1 | `B1: for the Owner / an Admin / a Customer whose assistant has no profile, the dashboard's welcome card offers one action — "Set up my Assistant's profile", which leads to the My Assistant page — and the dashboard publishes nothing` (three tests) | `tests/brainstorm/one-writer.spec.js` | e2e |
| AC1 | story 3's `W2` (re-aimed: publishes none at all); `assistant-default-profile` `B1` and `assistant-setup-prompt` `B5` (re-aimed: no one-click publish) | story 3 suite / two specs | source / e2e (re-aimed) |
| AC2 | `W2: neither legacy page publishes an assistant profile …`, `W3: each legacy panel keeps its read-only status … asked about the signed-in person with defaults=0`, `W4: each legacy panel links to the My Assistant page in every state — the link sits in the panel, outside the blocks its loader shows and hides` | node | source |
| AC2 | `B2: the legacy NIP-85 page, signed in as the Owner, shows their assistant read-only — its pubkey, "Published" and the published name — links to the My Assistant page, and publishes nothing`, `B3:` the same for the customer page | spec | e2e |
| AC2 | `B4: on ‹the legacy NIP-85 page / the legacy customer page›, the assistant panel links to the My Assistant page ‹while its status is still loading / when the assistant has no key / when the profile is not published / when the status request fails / to a visitor who is not signed in› — and offers nothing that publishes` (nine tests) | spec | e2e |
| AC2 | story 3's `R1` (re-aimed) | story 3 suite | source (re-aimed) |
| AC1–AC3 | `W5: in the app, one thing posts to /api/assistant/publish-profile — the My Assistant page's editor; nothing else under ui/src or public/ does` | node | source |
| AC3 | `G1: asked to sign a kind 0 as the assistant, the generic signer refuses — 403, code "one-writer", an explanation that points to the My Assistant page — and signs, reads and writes nothing, whoever asks` (a visitor, the Owner, an Admin, the in-container operator) | node | unit (real handler, stand-ins) |
| AC3 | `G2: a kind that is signed as 0 is refused the same way — -0, which a JSON body can carry and which signs as kind 0` | node | unit |
| AC3 | `P2: a publish that carries no profile is refused — 400, code "no-content", …` (missing, `null`, a string, a number, `true`, `[]`, `[form]`), `P4: publishing anyone's assistant but your own is refused — 403, code "not-your-assistant", …`, `P5: whose comes before what …` | node | unit (publish seam) |
| AC3 | story 2's `E5` and `E7`, story 3's `E8` (re-aimed: refusals) | story 2 / story 3 suites | unit (re-aimed) |
| AC3 — guards | `G3` (non-number kinds are never signed as 0), `G4` (every other kind goes the old way), `G5` (the client path is unchanged — principle 2), `P1` (the page's own publish goes through, for all three roles), `P3` (an emptied profile `{}` is still the page's publish), `W6` (the one writer sends `{ customerPubkey, content: form }`) | node | unit / source |
| AC4 | `P6: an Admin has no route to the instance Tapestry Assistant's profile — publish-profile refuses them the TA, the generic signer refuses them a kind 0 — and they still publish their own assistant's`; also the Admin rows of G1, P1 and P4 | node | unit (both doors) |
| AC5 | By construction — the story adds no migration and no republish, and nothing publishes on load: every B-test asserts that no request reaches `publish-profile` or `/api/strfry/publish` (B1–B4), and W5 pins the editor as the only in-app publisher. Plus the passive post-deploy check below. | spec / node / manual | e2e / source / live (passive) |
| Prerequisite | `B0: the served origin runs a build of this story — the My Assistant page's code is in it, and neither "Use the default profile" nor "Surprise me" is` | spec | prerequisite |
| Carry-forward | `W17` (the visitor branch: "Sign in with nostr" only when `!user`, the editor only when `user`), `W18` (the editor under `hasMyAssistantPage(user)`), `W19` (`onAssistantCreated={refreshUser}` from `useAuth()`, and `refreshUser` sets `assistantPubkey` from `data`), `W20` (the "no profile picture" copy under both `res.status === 404` and `body.code === 'no-picture'`) — all guards | `test/my-assistant-page.test.js` | source |

A few tests pin fragments of the ADR's fixed values:

- the codes `one-writer`, `not-your-assistant` and `no-content`;
- `/My Assistant page/` together with `/assistant` in every refusal's `error`;
- `href="/assistant"` in each panel.

The panels' copy (the "Tapestry Assistant" rename, the reworded intro) is not pinned.

## Edge cases

- [x] Every caller the generic signer's assistant branch has: a visitor, the Owner, an Admin and the in-container
      operator (G1).
- [x] `-0`, which a JSON body can carry and which serializes as 0 (G2). `"0"`, `null` and `""` are never signed as a
      kind 0, whether refused or failing to sign (G3).
- [x] The refusal is only for kind 0 (G4). The client path still publishes a self-signed kind 0 (G5).
- [x] Every "no profile" shape: missing, `null`, a string, a number, `true`, `[]` and `[form]` (P2). An empty object is
      still a profile (P3).
- [x] Every "not yours" caller: the Owner for a Customer, an Admin for the TA, a signed-in stranger, the in-container
      operator with no session, and a session that carries a pubkey but is not signed in (P4). The last is defence
      in depth: the login flow sets both together (`src/middleware/auth.js:53-54`).
- [x] Order: whose before what (P5). Both refusals come before any key, name lookup, write or settings read (G1, P2,
      P4, and P5's "nothing touched").
- [x] Every state of each legacy panel: loading, no key, not published, the request failing, and signed out on the
      NIP-85 page (B4).
- [x] A legacy page left open from before the deploy. Its no-content publish is refused (P2), and the refusal carries
      an explanation the page prints (story 2's E7).
- [ ] The April build under `public/kg/`. It is not tested directly: the signer's refusal (G1) closes its route, and
      its retirement is OPEN.md #68.
- [ ] A TA-signed kind 5. It is out of scope (ADR 0005 known gap; OPEN.md #269).
- [ ] A replayed assistant letter through the client path. It is a known gap (ADR 0005), deliberately not pinned, so a
      later fix is not constrained.
- [ ] Copy and comments: the panels' rename, `ui/src/styles.css:802-805`, the provision handler's comment and BIBLE.
      None of them is behaviour. The Reviewer checks them.
- [ ] Automated live H-class tests. This suite has none, because the local stack serves the main checkout. AC5's
      live check is the passive, manual one below.

## Test infrastructure

- **Node runner.** `npm test` runs every suite in `test/registry.js` through the gate engine. The new suite is one line
  there. A run's verdict is read with `npm run gate:status`.
- **Hermetic by construction.** There is no `/etc/brainstorm.conf` and no `strfry` on PATH, on this Mac or on the CI
  runner. The G-class also holds inside a container:
  - its key store is a fixture key;
  - its strfry import is a spy;
  - so even code that signs what it should refuse signs nothing real and writes nothing.
- **Browser.** Playwright with chromium, and every `/api` route mocked with a catch-all first.
  - The customer page needs `/api/get-user-data` and `/api/get-customers`, because it checks the signed-in person
    against the customers list before it shows its panels.
  - The "loading" state holds the status request until the test ends.
  - The spec needs an origin serving the **built** UI under test (B0 and B1). B2–B4 follow the panel's link into it.
- **Firmware state:** none. No concept changes.
- **Fixtures.** Fixture pubkeys only (`aa…`, `bb…`, `ad…`, `a1…`, `cc…`, `c1…`, `dd…`), and freshly generated keys for
  signing. No live keys.

## How to run

```
node test/one-writer-assistant-profile.test.js
```

The whole gate is `npm test`, and its verdict is read with `npm run gate:status`. On this machine about 35 suites fail
for environmental reasons (the local stack serves the main checkout), so CI's `stack-free` job is the binding gate.

For the browser class, build the worktree's UI and serve it.

- The main checkout's local, gitignored `.claude/launch.json` has an entry, `ap5-worktree-ui-preview`. It runs
  `vite preview --outDir <worktree>/dist --port 4175` from `ui/`, and `preview_start` starts it.
- Then run the specs from the worktree:

```
cd ui && npx vite build
BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4175 npx playwright test tests/brainstorm/one-writer.spec.js tests/brainstorm/assistant-default-profile.spec.js tests/brainstorm/assistant-setup-prompt.spec.js tests/brainstorm/my-assistant-page.spec.js tests/brainstorm/ta-composite-avatar.spec.js tests/brainstorm/assistant-publish-result.spec.js --project=chromium
```

**Passive post-deploy check (AC5 — "no existing published profile changes").** Read-only, no session.

1. Before the staging merge, note the staging TA's newest kind 0 on its instance relay:
   `nak req -k 0 -a ‹staging TA pubkey› wss://staging.brainstorm.world/relay`. Note its `id` and `created_at`.
2. After the deploy, run the same query. It must return the same event.
3. Repeat for a customer assistant, and on production after promotion.

## Verification

Confirmed on 2026-09-21 in the worktree. The code under test is `dbcc035b` (the ADR commit); the new and re-aimed
tests are uncommitted on top of it.

**New Node suite: 6 passed, 11 failed, 0 skipped.** Every failure names each case, and shows the old behaviour by
value:

```
FAIL  G1   a visitor: answered 403 {"success":false,"error":"Signing as the assistant requires owner authentication"}
           the Owner / an Admin / the in-container operator: answered 200 {"success":true,"event":"‹a signed kind 0 by 3000bb26…›"};
           handed 1 event(s) to strfry import (kind 0); ran the brain-write hook; read the key store 1×
FAIL  G2   (the same four, for kind -0)
FAIL  P2   no content at all / null / a string / a number / true / [] / [form]: answered 200 … the handler read the assistant key 1×,
           looked up a name 1×, saved 1 event(s) on the local relay, wrote 1 NIP-05 mapping(s), sent to relays 1×, read the relay settings 1×
FAIL  P4   the Owner, publishing a Customer's assistant: answered 200 {"…The profile of the Tapestry Assistant for npub…n2pktz was saved…"};
           an Admin for the TA / a stranger / the operator: answered 403 {"success":false,"error":"Not authorized"} (no code, no pointer);
           a session with the Customer's pubkey but not signed in: answered 200
FAIL  P5   the Owner, for a Customer, with no content: answered 200; a stranger: 403 with no code
FAIL  P6   publish-profile, for the TA: 403 "Not authorized" (no code); the generic signer, a kind 0 as the TA: answered 200, handed 1 event to strfry
FAIL  W1   WelcomeCard renders 2 buttons — … 🎨 Set up my Assistant's pro | … ✨ Use the default profile
FAIL  W2   the legacy NIP-85 page still has a POST to /api/assistant/publish-profile, a "Publish Kind 0 Profile" button
FAIL  W3   every status request must carry defaults=0 — got ["customerPubkey=${_ownerPubkey}"]
FAIL  W4   no <a href="/assistant"> in the panel outside #ownerAssistantLoading, #ownerAssistantContent, #ownerAssistantNoKey — links there: []
FAIL  W5   expected only [ui/src/components/AssistantProfileEditor.jsx] — got ["public/pages/customers/customer.html","public/pages/nip85.html",
           "ui/src/components/AssistantProfileEditor.jsx","ui/src/pages/Dashboard.jsx"]
PASS  G3, G4, G5, P1, P3, W6   (guards)
```

**Re-aimed suites.**

- Story 3: 49 passed, 3 failed. E8 answered 200; W2 finds the dashboard's `/api/assistant/` post; R1 finds
  `publish-profile` in the NIP-85 page. E1, E3, E5, E6 and E7 pass: they no longer depend on the no-content path.
- Story 2: 37 passed, 2 failed. E5's third leg answered 200; E7 answered 200.
- Story 4, with W17–W20: 31 passed. The four new cases are guards (see the mutations below).

**Browser class** against this worktree's own build (`vite preview` on :4175; every `/api` route mocked).

- **New spec: 13 failed, 2 passed.**
  - B0: the bundle still contains "Use the default profile".
  - B1, the Owner: the card has two actions, `["🎨 Set up my Assistant's profile","✨ Use the default profile"]`.
  - B2 and B3: each panel still offers a publish button.
  - B4, all nine: there is no link to `/assistant`.
  - B1 for an Admin and a Customer pass. Their card has had one button since story 1.
- **Re-aimed and neighbouring specs: 43 passed, 2 failed** — exactly the two re-aimed tests
  (`assistant-default-profile` B1 and `assistant-setup-prompt` B5). The new B0 marker passes.

**The tests can pass, and they judge.** A test that fails today can still be wrong, if it would also fail against a
correct implementation. To rule that out, the tests were run against a throwaway reference implementation of ADR 0005.
It followed the ADR's implementation notes literally, lived in the session scratchpad outside the repo, and is **not
committed**. The Implementer writes the real one.

- **Node suites against the reference:**
  - new suite: 17 of 17;
  - story 3: 52 of 52;
  - story 2: 39 of 39;
  - story 4: 31 of 31;
  - story 1: 28 of 28;
  - `default-deny-mutations`: 14 of 14;
  - `publish-event-signature-verification`: 5 of 5;
  - `stamped-composite-avatar`: 15 of 15;
  - `stack-free-npm-test`: 7 of 7 (G5 sees the new suite registered);
  - ta-avatar #2's `recognizable-published-ta-profile`: 10 of 13. Its live H1–H3 fail identically (10/3) on the
    untouched worktree: they hit `:7778`, which serves the main checkout.
- **Browser, against the reference build (:4176): 60 of 60.** That is the new spec (15), the two re-aimed specs, and
  story 4's three neighbouring specs.
- **The reference surfaced no inconsistency in ADR 0005.**
- **Mutations.** Each was planted one at a time — in the reference, or, for the carry-forward guards, in a scratch
  copy of the current code — and each was caught.

| Planted defect | Caught by |
|---|---|
| **The generic signer** | |
| the kind-0 refusal comes after the owner gate | G1, G2 |
| the kind-0 refusal comes after the key is read | G1, G2, P6 |
| `Object.is(event.kind, 0)` instead of `=== 0` | G2 |
| the refusal's words don't point to the page | G1, G2, P6 |
| every kind is refused (over-broad) | G4 |
| a client-signed kind 0 is refused too (over-broad) | G5 |
| no refusal at all | G1, G2, P6 |
| **`publish-profile`** | |
| the Owner may still publish anyone's assistant (the old rule) | P4, P5; story 3's E8; story 2's E5 |
| the session is read without `authenticated` | P4 |
| "what" is checked before "whose" | P5 |
| an array is accepted as content | P2 |
| the content check comes after the key is read | P2 |
| no content publishes the default again | P2; story 2's E7 |
| an emptied profile `{}` is refused (over-broad) | P3 |
| the refusals' words don't point to the page | P4, P5, P6 |
| **The dashboard, the legacy pages, the editor** | |
| the dashboard keeps a one-click publish | W1, W5; story 3's W2; B0, B1 ×3, `assistant-default-profile` B1, `assistant-setup-prompt` B3 and B5 (browser) |
| the NIP-85 page still posts `publish-profile` | W2, W5; story 3's R1 |
| the NIP-85 link sits only inside the block shown once loaded | W4; B4 in exactly the four states that hide that block (browser) |
| the customer page drops its link | W4; story 3's R1 |
| the customer page asks without `defaults=0` | W3; B3 (browser) |
| the editor publishes without content | W6 |
| **Carry-forward (story 4's review mutants)** | |
| the page ignores `hasMyAssistantPage` | W18 |
| the page drops its visitor branch | W17 |
| the page passes a no-op as `onAssistantCreated` | W19 |
| `refreshUser` keeps the old `assistantPubkey` | W19 |
| `&&` becomes `\|\|` in the "no picture" condition | W20 |

- **Stability.** The new spec, run three times over at 6 workers against the reference build (`--repeat-each=3`),
  gave 45 of 45, with no flaky tests.

**Full gate.** `npm run gate:status -- --label ap5-phase3-failing`:

```
20260921T190511Z-65250-511b [ap5-phase3-failing] started 2026-09-21T19:05:11.330Z on dbcc035b+dirty — FAIL, exit 1,
3510 passed, 112 failed, 45 skipped, 217/217 suites
```

38 suites failed.

- **Three are this story's own, as intended:**
  - `one-writer-assistant-profile`: the 11 above;
  - `one-default-assistant-profile`: E8, W2 and R1;
  - `assistant-publish-relays`: E5 and E7.
- **The other 35 are this machine's environmental failures, not side effects of these tests.** Each fails only its
  live tier (H- and L-class tests, "fetch failed", concept-graph reads) against the `:7778` stack, which serves the
  main checkout. It is the same count as story 4's Phase 3 run.
  - All suites are loaded before any runs, and this phase touches only test files.
  - The new suite runs 210th of 217, and its G-class swaps modules in the require cache while it runs. The one
    failing suite after it, `author-scoped-inspection-roster`, fails only its live H1–H5, and gives the same
    10 pass / 5 fail run on its own. The other five suites after it all pass, and the run recorded no stray errors.
  - `recognizable-published-ta-profile`'s H1–H3 fail the same way on the untouched worktree (10 pass / 3 fail).
