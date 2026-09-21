# Review: Story 1 — The /setup page and its three placeholder action pages

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-21
**Diff:** `git diff 6fd8759d..6acc64e9` on branch `feat/setup-page-scaffold`. Three commits: `db1d60fe`
(story, book, epic, intake entry), then `e923eec3` (implementation + the story's `## Deviations`),
then `6acc64e9` (doc-only follow-ups to this review's draft findings). No code changed after
`e923eec3`: `git diff --stat e923eec3..6acc64e9 -- ui/ src/ bin/ docker/ test/ package.json` is empty.
The base `6fd8759d` is the `origin/staging` tip. The branch is 3 ahead and 0 behind it, and
`git merge-tree` reports a clean merge.
**Epic:** `engineering-team/epics/setup-page-scaffold.md`
**Book:** `engineering-team/audits/setup-page-scaffold/book.md`

> **Abbreviated path.** The owner chose Story + Implementer + Reviewer at intake. There is no ADR and
> no test plan, by design; both are recorded as `none (abbreviated path)` under the story's *Linked
> artifacts*, and their absence is **not** treated as a defect below. `ui/` has no React component
> test harness (vite + eslint only; the root `npm test` is a Node server-test runner). So every AC is
> verified against the code that produces it, the gates, and a live render the reviewer ran
> (read-only headless Playwright against `http://localhost:7778`, scripts outside the repo).

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`**: red overall, and none of the red comes from this diff. Every failure predates
      it, has a tracked environmental cause, and sits in a suite with no path to the changed files.
      A full run takes about 53 minutes on this machine, so the **orchestrating session launched it
      on the reviewer's behalf** at the implementation commit, on a clean tree, as
      `GATE_LABEL=review-setup-page-scaffold-1 npm test`. The reviewer did not start it, and ran no
      other suite while it was in flight. The reviewer read the verdict from the run record, via
      `npm run gate:status -- --label review-setup-page-scaffold-1`, not from any notification. The
      record shows `git.commit` `e923eec37caa…`, `dirty: false`, Node `v24.18.0`, argv `test/test.js`,
      finished `04:31:16Z`, `strayErrors: []`. Here is the `gate:status` line, with only the record's
      machine path prefix trimmed to repo-relative:

      `20260921T033649Z-59242-3315 [review-setup-page-scaffold-1] started 2026-09-21T03:36:49.616Z on e923eec3 — FAIL, exit 1, 3551 passed, 5 failed, 49 skipped, 214/214 suites; failed: tl-membership-method-selector, tl-weighted-sum-method, tl-certainty-method, summaries-element-count · tmp/gate-runs/20260921T033649Z-59242-3315.json`

      Attribution, suite by suite, read from the run's log rather than assumed:
      - `tl-membership-method-selector` (11 pass, 1 fail), `tl-weighted-sum-method` (6/1) and
        `tl-certainty-method` (4/2). Each suite's `L0 GUARD publish policy is local-only` refuses
        to run, because the container answers `{"success":true,"allowExternalPublish":true}`. That is
        **OPEN.md row 191** word for word. `tl-certainty-method`'s second failure, `LP prune removes
        all fixture-prefixed events`, is the same guard inside `scripts/tl-prune-fixtures.js`
        ("publish policy is NOT local-only — refusing to prune").
      - `summaries-element-count` (12/1). Its L5 check says "firmware-concept is a control … the
        full count (37), the endpoint's (37) and the direct-only count (28) must all agree". That is
        **OPEN.md row 285** (Mac Studio only).
      - The same four suites fail, and the same three suites skip, in three earlier full runs on
        other commits, two of them on clean trees: `20260920T060602Z-16829-80d9` (`b9efca93`),
        `20260920T233654Z-13297-461a` (`532ecb0f`) and `20260921T005035Z-34468-1bf2` (`d61c8e80`).
        None of the four reads a touched file: none is among the 36 suites that name one, and none
        walks `ui/src`. This diff changes no server code.
      - Every suite that does read the diff passed. That covers all 36 suites that name a touched
        file, and the three `ui/src` walkers the scoped gate missed: `collapse-into-export-concept`
        (28/0), `publish-export-a-concept` (3/0) and `users-page-neo4j-endpoint` (2/0). The
        `harness-lint` suite also passed (76/0). `profile-lookup-bounds`, which was red in the
        previous full run, passed 27/0.
      - The three suites that skipped did so for environmental reasons, the same as in the earlier
        runs. `tag-detail-publish` gave "Meili task … not indexed within 90s". `authored-tagging-publish`
        and `profile-tag-polish-publish` gave "`/var/lib/brainstorm/settings.json` not writable from
        this process".
- [x] **The Implementer's scoped run, checked from its record** rather than taken on trust:
      `20260921T033512Z-57231-7977 [setup-scoped-ui] started 2026-09-21T03:35:12.538Z on e923eec3 — PASS,
      exit 0, 746 passed, 0 failed, 2 skipped, 36/36 suites`. Its driver uses `test/registry` and
      `runGate` with the same two env vars as `test/test.js:14–15`, and every one of the 36 suites ran
      tests. A fresh grep of `test/` for the touched files returns the same 36. That grep misses the
      three suites that walk `ui/src` reading every `.js`/`.jsx` file (see Harness friction 1), and
      the full run above passed them.
- [x] **`npm run test:playwright`**: not run. It is wired into no gate (OPEN.md row 114). The browser
      evidence is instead the reviewer's own headless render, next.
- [x] **Headless render, the reviewer's own (read-only)**: Playwright 1.56.1 launched by default on its
      pinned `chromium_headless_shell-1194`, driving real mouse and keyboard input against
      `http://localhost:7778`. The scripts live in the session scratchpad, not the repo. They stub the
      sign-in responses in the browser, and they **abort and record every non-GET request**; none
      was attempted. There were no console errors, no warnings and no page errors. The results are
      cited per AC below.
- [x] **UI build at HEAD** (`npm --prefix ui run build`, clean tree): **built in 10.81s**, with only the
      existing chunk-size advisory. It emits `assets/index-_zLoQMny.js` and
      `assets/index-CPK-mkJT.css`, which are **SHA-256-identical** to what the container serves
      (`d49ee66c…` and `34eceffd…`). So the local stack serves exactly HEAD's UI. The container has
      no bind mount (OPEN.md row 198); the Implementer deployed `dist/` with `docker cp`.
- [x] **eslint**: `npx eslint src/App.jsx src/pages/setup/` exits 0 with no output. The base
      `App.jsx` (`6fd8759d`) is also clean, so parity holds and the new files add nothing.
- [x] **`bash scripts/harness-lint.sh`**: `harness-lint: clean (0 violations)`, exit 0. It ran on the
      final tree, with this review and the story's `Done` in place, and printed only the existing
      waived L5 lines for `.claude/skills/cycle-local/SKILL.md`.
- [x] The working tree was clean after every gate (`dist/` is gitignored).

## Spec adherence

No test surface exists for these pages, so each AC is checked against the code that produces it and
then against the live render.

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 1 | The page renders under the Brainstorm Search top bar; heading, **0 of 3 complete** over an empty bar, no "all set" | Code: `Index.jsx:20–22` uses the same `bsp-page` → `<TopBar />` → `main.bsp-content` shell as `/tags` (`Tags.jsx:50–52`); kicker `:23`; heading `:24–26`; progress `:28–45`, where `doneCount` is the constant `0` (`:16`) and the fill is `width: 0%`. The file has no all-done branch. Live: logo "Brainstorm" → `/`, "Sign in with nostr" when signed out and the avatar when signed in; `h1` = "Finish setting up your account."; `role=progressbar`, `aria-valuenow=0`, `aria-valuemax=3`, fill 0 px; no "all set" text on any page | ✅ |
| 2 | Exactly three steps, in order, each not done, with its badge and sentence | Code: `steps.js:11–35`, with `SETUP_STEPS` order at `:35`, rendered by `Index.jsx:47–64`. Live: three `ol > li > a`, in order; markers 1–3 (`aria-hidden`); a visually hidden "Not done: " inside each link (`position:absolute; clip:rect(0,0,0,0)`, 1×1 px); badges and sentences exact (see Copy) | ✅ |
| 3 | Each step is a real link to its URL; works by click, and by Tab + Enter; opens in a new tab | Code: `Index.jsx:50` `<Link to={step.path}>` renders an `<a href>`; the paths are at `steps.js:12,20,28`. Live: the three `href`s are exact. Tab 1–3 reach the logo, About and Sign in; **Tab 4 reaches step 1**, with focus ring `solid 2px rgb(165,180,252)` (`styles.css:8535`); Enter opens `/setup/create-account`. Clicking each card soft-navigates and renders its heading in 60–90 ms. Meta-click opens a new tab that renders the step's heading while the first tab stays on `/setup` | ✅ |
| 4 | Three placeholder pages: same top bar, step name as heading, **Placeholder page.**, its sentence, a link back | Code: `Placeholders.jsx:13–27` (TopBar `:16`, back link `:18`, heading `:19` from the same step object, **Placeholder page.** `:21`, sentence `:22`); exports `:29–39`; routes `App.jsx:230–245`. Live: all four elements are present and exact on each page. "← Back to setup" (`href=/setup`) returns to `/setup` by click (×3) and by Enter | ✅ |
| 5 | Direct loads and refreshes render, never "Page not found", locally and on staging | Locally: `curl` on the four URLs returns **200 `text/html` with the SPA shell** at `:7778`, and also through the container's nginx on `:80`. The browser renders each on direct load and after reload, with no "Page not found". Server path: the routes are static top-level routes (`App.jsx:230–245`), which outrank the `*` NotFound (`:483`). `bin/control-panel.js:346–350` sends every non-`/api` GET to `dist/index.html`, after the probe guard at `:337–343`. HEAD's `isBlockedProbePath` returns `false` for all four paths and for `/setup/` (`src/utils/siteTrust.js:166–203`). `docker/nginx.conf:40` `location /` is the only block that matches. Nothing in `public/` or `dist/` shadows `/setup`, and no route elsewhere claims it. **Staging, before deploy:** the four URLs already return **200 with the SPA shell** (`index-mxbUHhXI.js`), so the whole staging server chain passes them unchanged. The client half needs the deploy (see *Staging*, below) | ✅ locally; the staging server chain is proven, the staging render follows deploy |
| 6 | No request of its own; nothing published or saved; body the same signed in or out | Code: the three files import only `Link`, `TopBar` and the step data. There are no hooks, no fetch, no storage calls and no `useAuth` in the page bodies. Live: each page makes 13 requests. Its 9 `/api/*` GETs are **identical** to the static `/about` and `/how-search-works` pages' sets. There are no websockets, no external hosts, and **zero non-GET requests** (the script aborts and records any; none was attempted). With sign-in stubbed as a customer, `<main>` outerHTML is **byte-identical** to signed-out on all four pages, and the `/api` set equals signed-in `/about`'s 12 | ✅ |
| 7 | 375 px: no horizontal scrolling | Live at **375 px** and **320 px**: `documentElement.scrollWidth === clientWidth` on all four pages, and no element's right edge passes the viewport | ✅ |

**Copy (story § Copy).** Checked by script, not by eye. Every cell of both § Copy tables was parsed
from the story and compared exactly with `steps.js` (loaded as a module) and with the literals in
`Index.jsx` and `Placeholders.jsx`: 26 of 26 equal. The rows marked Brainstorm were then checked
against upstream `FinishSetupPage.tsx` at `741be6b6` (confirmed as `origin/main` in
`nosfabrica/Brainstorm-UI`): the kicker (`:112`), the heading, split around a span (`:118`), the
progress template (`:123`), all three labels, both badges (`:161`, `:178`), and step 2's sentence
(`:162`), which matches **character for character**, U+2014 em dash and ASCII apostrophe included.
Step 3's "adapted from" original is quoted verbatim from `:179`. The rendered text matches on every
page. Badges and the kicker compute `text-transform: none`, so the approved sentence case is what shows.

**The owner's words (book § Intent anchor, intake entry).** Checked by script against the session
transcript. It has exactly one `type: "user"` record containing "emulate the Brainstorm" (jsonl
line 4). After stripping the line prefix `> ` and trailing whitespace, and collapsing blank-line
runs, the book's blockquote equals the ask **exactly (1950 = 1950 characters)**. The only difference
is the ask's two double blank lines, which the quote collapses. Surviving intact: the curly
apostrophes (U+2019, including the lowercase "let’s not"), and the typos "kind 1", "llinks" and
"setup your Treasure Map". The intake entry's "Deferred, verbatim" blockquote (`_intake.md` from line
2632) equals the ask's last section exactly.

**Nothing beyond the story.** The code diff is two imports and four routes in `App.jsx`, three new
files, and one appended CSS block, with no server, nginx or dependency change. There are no status
checks, no Setup Alert, and no link to `/setup` from any menu or page. Nothing in `ui/src`, `src`,
`bin` or `public` pointed at `/setup` before this diff either, so no existing link changes behaviour.
The approved § Copy and the ACs are unchanged since the story commit: `e923eec3` and `6acc64e9` touch
the story only inside `## Deviations`. That is the spec-before-code cadence OPEN.md row 212
proposes, and it let this review diff spec against code by commit. Each implementation deviation is
visible and reasonable: numbered markers because there is no icon library, sentence case, and the
scoped Implementer gate.

**The docs' factual claims.** The epic's § "What Brainstorm has" matches `FinishSetupPage.tsx`,
`useFinishSetup.ts` and `FinishSetupBanner.tsx` at `741be6b6`. That includes the activation nuance
as reworded in `6acc64e9`, re-checked below. The story's "Brainstorm sends [signed-out visitors] to
its login page first" is right: `App.tsx:249` wraps `/setup` in `RequireAuth`, which redirects to
`/login?next=…` (`RequireAuth.tsx:23–32`). The epic's § Key facts server claims are all confirmed
(AC 5 above). Every "what exists to build on" pointer in the epic and the intake entry resolves:
`useAssistantSetupState.js`; assistant-profile #1 (Done) and #4 (Approved); the Treasure Map page at
`/tapestry/grapevine/treasure-map` (`App.jsx:372–375`), which finds the viewer's kind 10040 by
`authors: [user.pubkey]` on the local and configured relays (`TrustedAssertions.jsx:54–71`);
`/tapestry/trusted-agents/setup`; and the POV guardrail at `epics/assistant-profile.md:86`.

**`6acc64e9`, re-derived from source rather than recognised as the draft's own wording**
(Reviewer step 10):
- **Epic `:32–34`.** Upstream `useFinishSetup.ts:60` is
  `activateDone = locallyActivated || providerStatus === "brainstorm"`, and `:61–63` is the comment
  that "other" counts as pending even when the local flag says activated. "This browser" is right:
  the flag is `identityHas(pubkey, "nip85Activated")` in account metadata, which upstream persists
  to local or session storage ("Kept on this device", `accounts/metadata.ts:8`;
  `accounts/persist.ts:37,68`). Accurate.
- **`_intake.md:2656–2657`.** The same two facts, stated as "its comment says it does not, but its
  code lets a local flag win". Accurate.
- **Story § Deviations `:145–152`.** It now says the 36 suites were found by filename, and it names
  the three missed walkers correctly; all three passed in the full run. One word is too broad
  (Non-blocking 2), and the ledger id it cites is not filed yet (Non-blocking 3).

**Staging.** AC-5's last sentence, and the book's first frame bullet, can only be observed after
the branch deploys. Everything checkable before that is checked: the staging server chain (above),
and the client code, which is the same source that renders correctly here. Staging builds its own
image, so its bundle is not claimed to be byte-identical. The check after deploy is: open the four
URLs on `https://staging.brainstorm.world` by address and by reload.

## ADR adherence

None to check: abbreviated path, no ADR by design. The story itself records the only design choices,
routes and copy, and they are implemented as written.

## Concept-graph integrity

- [x] **No concept definitions changed.** No firmware reinstall is needed, and none is claimed.
- [x] **No handles in the code.** The story's *Concepts touched* names three for orientation only,
      in `39998:<TA>:<slug>` form with no literal pubkey. All three resolve via
      `/api/concept-graph/summaries` under this instance's TA: `tapestry-assistant`, `nostr-user`,
      `web-of-trust`.
- [x] **No `/summaries` dependency introduced.** The pages make no API calls; that is AC-6.
- [x] **No TA pubkey anywhere** in the diff. There is no 40+ hex run and no `82b75e47`.

## Things tests can't catch

- [x] No secrets. `/usr/bin/grep` over every added line found no 40+ hex run and no `nsec1`, `npub1`,
      `secret`, `private_key`, `password` or `token`.
- [x] No `console.*`, `debugger`, `TODO`/`FIXME` or commented-out code. The only comment hit is the
      CSS section heading `/* The three step pages */`.
- [x] No async code, no state and no user input: these are pure render functions over constant data.
      `Math.round((doneCount / total) * 100)` cannot divide by zero, since `total` is the length of a
      constant three-item array. React keys (`step.path`) are unique.
- [x] Markup is valid. The `<a>` holds only `<span>`s and no nested interactive content. There is
      one `<h1>` per page. The progress bar is labelled by its visible text (`aria-labelledby`,
      unique id).
- [x] No CSS collision. `bs-setup-` appears nowhere in the base stylesheet or in any other file.
      The `:hover` override (`styles.css:8528–8534`) is specific enough (0,2,0) to beat the global
      `a:hover` (0,1,1). Measured: the card's text colour does not change on hover, and only its
      border and background do.
- [x] Not reusing `components/PlaceholderPage.jsx` is justified. That component is the `/tapestry`
      control-panel shape (`.page`, `Breadcrumbs` fed by route `handle.crumb`), which does not fit
      the Brainstorm Search top-bar shell. `SetupStepPlaceholder` reuses its **Placeholder page.**
      markup.
- [x] `steps.js` feeds both the checklist and the step headings, so the two cannot drift. Its header
      sends copy changes back to the story first.

## House rules check

- [x] Concept Graph API authority respected. Nothing is wired; the three orientation handles were
      looked up via the API, not read from source.
- [x] **No new lint, typecheck or build tooling.** No dependency and no config changed.
- [x] Stack rules: no server code changed. The UI deploy to the container was `docker cp` of `dist/`,
      the documented route while there is no bind mount.
- [x] Architecture invariants (CLAUDE.md §1–4). The pages compute no view, store nothing derived,
      gate nothing and touch neither neo4j nor relays. Showing the page to signed-out visitors
      gates less, not more. The epic's guardrail, that every future check is about the *viewer's
      own* follow list, Treasure Map and assistant, is the POV-correct brief for the next session.

## Product-guide adherence *(when the story traces to a PRD)*

Not applicable: no PRD. The book is acceptance-frame, and the story's § Copy is the approved text,
matched exactly above.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/styles.css:8594–8601`**: the back link's hover changes its hue. `.bs-setup-back` is
   indigo (`#a5b4fc`), and its `:hover` rule sets only the underline, so the global
   `a:hover { color: var(--accent-hover) }` (`styles.css:36`) recolours it. Measured:
   `rgb(165, 180, 252)` → `rgb(121, 192, 255)`. This is the existing app-wide pattern, not something
   new here: `.bs-tagindex-link` (`styles.css:5747–5751`) is built the same way and behaves the same.
   So it is not a change to ask of this story. **Follow-up, filed by the orchestrator after this
   commit:** a cross-cutting cleanup row for the `bs-` link hover hue.
2. **Story `:149`** (added in `6acc64e9`) says the three walkers "read every file under `ui/src`".
   They read every `.js`/`.jsx` file (`collapse-into-export-concept.test.js:60`,
   `publish-export-a-concept.test.js:57`, `users-page-neo4j-endpoint.test.js:40`). That covers all
   three new files and `App.jsx`, but not `styles.css`. The substance is right. The precise
   wording matters when the abbreviated-path gate row is written, because a walker's file filter
   decides what a selection rule catches.
3. **Story `:152`** cites ledger row `2026-09-21-abbreviated-path-names-no-gate`. At `6acc64e9` that
   id exists in neither `OPEN.md` nor `ledger/`, because the orchestrator files the row after this
   commit. No lint checks such a citation: L15 checks the form of ledger files, and L8 checks
   markdown links, while this is a code span. Until the row lands, the citation dangles. **Ask of
   the orchestrator:** file it under exactly that id, or amend the citation.
4. **The body renders strings that § Copy does not list**: the visually hidden "Not done: ", the
   numbers 1–3 and the `›` chevron (the last two `aria-hidden`). The markers and "Not done: " are
   recorded under § Deviations. The chevron is Brainstorm's own row design (epic § "What Brainstorm
   has"). None of them carries product meaning, and together they are the accessible way to mark a
   step not done. Noted only so that "§ Copy is the complete on-screen text" isn't later read as
   literally true.

### Harness friction *(each becomes an OPEN.md row, type `meta`)*

The orchestrator verified these and files them after this commit: new rows for 1 and 2, and dated
notes on rows 27, 196 and 213 for 3–5. This review does not edit `OPEN.md` or `ledger/`.

1. **The abbreviated path has no sanctioned Implementer gate, and the improvised one misses suites
   that walk the tree.** Workflow 4, steps 1 and 7, asks for a full `npm test`, which takes about 53
   minutes here and is red by default (rows 191 and 285). So the Implementer scoped the gate, openly
   (story § Deviations), to the suites that name a touched file. That selection missed the three
   `ui/src` walkers named above. It was harmless here, because the full suite ran at review and
   they passed. The Light profile's Gate A scoped gate is the nearest written rule. Proposal: write
   the abbreviated path's gate down (for example "full suite once, at review", or a named scoped
   gate), and make any selection rule include directory walkers and their file filters. *New row;
   the story already cites it as `2026-09-21-abbreviated-path-names-no-gate`.*
2. **`gate:status` names the last finished suite as "current".** `test/helpers/gateRunner.js:171`
   sets `progress.current` in memory when a suite starts, but the record is only written when a
   suite ends (`:191`, plus stray errors at `:115`). So `test/gate-status.js:49` prints
   "current <the previous suite>, last progress Nm ago" for as long as the next suite runs. This
   run showed it twice. At about 03:54Z it said `18/214 suites, current tl-publication-from-pins,
   last progress 8m ago`, when that suite had passed at 03:45:54Z and the log showed
   `tl-publication-from-pins-publish` running. At 04:00Z it named that suite while
   `customize-pin-curation-publish` ran. It reads exactly like a hung suite. Fix shape: write the
   record at suite start too (one `R.updateRecord(h, {})` after `:171`), or word the status "last
   finished". *New row.*
3. **The local container's server code has drifted from the branch, so a review gate's live suites
   test the container, not the diff.** The reviewer compared all 637 tracked files under
   `src/ bin/ setup/`, plus `docker/nginx.conf` and `package.json`. Fifteen differ. Thirteen are
   older versions that HEAD's history has since replaced: `package.json` and 12 files under
   `src/`, from `siteTrust.js` (replaced 09-12) to `assistant/index.js` (replaced by the #717 merge
   on 09-20). The other two are **absent** from the container: `src/utils/ssrfGuard.js`
   (`19ece47a`) and `src/api/assistant/profilePublish.js` (`90f54a09`), both added on 09-20. The
   orchestrator's own check agrees: 12 of 565 tracked `src/bin/lib` `.js/.json/.sh` files differ,
   and 2 are absent. This has no effect on this UI-only diff, because the served bundle is
   byte-identical to HEAD's build, and HEAD's server behaviour for `/setup` is shown by HEAD's own
   module plus staging. For a server diff, though, a review gate means nothing until the container
   is re-synced (`/cycle-local`). *A dated note on row 27, not a new row.*
4. **OPEN row 196 and the Implementer's keyboard claim cannot both be true.** Row 196 records that
   the in-app Browser pane "delivers no keyboard events to the page". The Implementer reports, from
   that same pane, that Tab ×4 reaches step 1 and Enter opens `/setup/create-account`. Either the
   row no longer holds, or the claim wasn't observed as worded. This review doesn't need to decide
   which: AC-3's keyboard clause rests on the reviewer's Playwright run, which drives real key input
   (the fix row 196 itself names), and does not rest on the pane. *A dated note on row 196.*
5. **OPEN row 213 looks stale on this machine.** It says Playwright's pinned
   `chromium_headless_shell-1194` is not installed, so a bare `chromium.launch()` fails. The cache
   now holds `chromium_headless_shell-1194` (and `-1228`), and a bare launch worked for this review.
   Row 232, on the same cause, is already DONE. *A dated note on row 213.*

## Verdict

**PASS**

Every acceptance criterion is met, checked against the code and in the live render. The copy
matches § Copy and upstream exactly, and the owner's words are verbatim. Nothing lands beyond the
story. The UI build, eslint and harness-lint are clean, and the served bundle is exactly HEAD's
build. The full `npm test` is red only on OPEN.md rows 191 and 285, which are pre-existing,
reproduced on clean trees of other commits, and in suites with no path to this diff. Every suite
that reads the diff passed.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place, and its *Linked artifacts* Review line filled
      with this file's path.
- [x] Completion detection performed; the result is reported in the chat, not recorded here, per the
      template.
