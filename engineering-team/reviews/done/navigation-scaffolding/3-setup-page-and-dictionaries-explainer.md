# Review: Story 3 — Trusted Agents "Set Up" page, and the Dictionaries explainer

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-08
**Diff:** `git diff fded88b2 75f30e2e` (commit `75f30e2e`, branch `feat/navigation-scaffolding`)
**Story:** `engineering-team/stories/navigation-scaffolding/3-setup-page-and-dictionaries-explainer.md`
**Epic:** `engineering-team/epics/navigation-scaffolding.md`
**Book:** `engineering-team/audits/navigation-scaffolding/book.md` (frame amended 2026-09-08 for this story)

> **Abbreviated path.** Story + Implementer + Reviewer, chosen by the operator at intake: no ADR and
> no test plan, by design (recorded under the story's *Linked artifacts*). Their absence is **not** a
> defect below. There is no React component test harness in this repo, so the ACs are verified by
> reading the code that produces the behaviour, plus build/lint gates and a **headless-Chrome render
> of the live stack** at `http://localhost:7778` (script written to the scratchpad, run from the repo
> root for `node_modules` resolution, removed afterwards — working tree confirmed clean).

## Quality gates (run by reviewer, not trusted)

- [x] **`cd ui && npm run build`** — **PASS.** `✓ built in 10.04s`. No new warnings beyond the
      pre-existing chunk-size advisory.
- [x] **`npx eslint` on the touched files, with a `staging` baseline for parity** — **PASS.**
      Per-file, branch vs. `staging` (throwaway detached worktree at `7bebeea5`, `node_modules`
      symlinked, removed after):

      | File | staging | branch |
      |---|---|---|
      | `ui/src/App.jsx` | E0 W0 | E0 W0 |
      | `ui/src/components/Header.jsx` | E0 W0 | E0 W0 |
      | `ui/src/components/Layout.jsx` | **E2 W0** | **E2 W0** |
      | `ui/src/pages/dictionaries/Placeholders.jsx` | E0 W0 | E0 W0 |
      | `ui/src/pages/trusted-agents/Placeholders.jsx` | E0 W0 | E0 W0 |

      `Layout.jsx`'s two errors are `react-hooks/set-state-in-effect` at lines 157 and 203 —
      **identical at the baseline**, and both far from the one line this diff adds (106). Whole-tree
      parity also exact: `npx eslint .` reports **258 problems (210 errors, 48 warnings)** on both
      the branch and `7bebeea5`. Nothing new introduced.
- [x] **`bash scripts/harness-lint.sh`** — **PASS.** `harness-lint: clean (0 violations)`.
- [x] **Live render against the running Docker stack** (`localhost:7778`, freshly built `dist`,
      Playwright + system Chrome — the bundled `chromium_headless_shell-1194` is not installed):
      both new/changed routes return 200, the served bundle and CSS carry the new code, and the
      rendered DOM matches the ACs (details under *Spec adherence*).
- [x] **`npm test`** — **FAIL (pre-existing, environmental; unreachable by this diff).** I ran the
      full suite anyway rather than take the skip on offer, because I would otherwise be asserting a
      gate result I had not seen. `Overall: FAIL`, exit 1, `Total skipped: 45`. Exactly three suites
      fail, all in the `trusted-lists` live-stack lane:

      | Suite | Result | Failing assertions |
      |---|---|---|
      | `tl-membership-method-selector` | 11 passed / **1 failed** | `L0 GUARD publish policy is local-only (AC-6)` |
      | `tl-weighted-sum-method` | 6 passed / **1 failed** / 2 skipped | `L0 GUARD publish policy is local-only` |
      | `tl-certainty-method` | 4 passed / **3 failed** | `L0 GUARD`; `LP prune…` (*"prune failed: publish policy is NOT local-only — refusing to prune (dev-only tool)"*); `LB certainty known-value matrix` (*`["rigor","0.5"]` … got undefined* — the fixture state `LP` exists to establish was never created) |

      All five assertions trace to one cause: `/api/publish-policy` answers
      `{"success":true,"allowExternalPublish":true}`, so the guards refuse to run. That is
      **OPEN.md row 191** exactly, including its "wrong-lever trap" note — the guard reads the policy
      from the **container**, so setting `BRAINSTORM_PUBLISH_LOCAL_ONLY` on the test shell does not
      help, and row 191 explicitly says not to "fix" this by changing the machine's posture.
      Every other suite passes. **This diff is `ui/src/**` + `ui/src/styles.css` + four harness
      markdown files — zero server code** — so it cannot be the cause; none of the three suites
      imports anything it touches, and none of the five assertions is about the UI.
      *Delta worth recording:* review 2 saw `tl-certainty-method` at 4/**2**; this run gives 4/**3**.
      The extra failure is `LB`, the cascade downstream of the `LP` prune that the same guard blocks
      — i.e. variance in how far the live-stack fixtures get before the guard bites, not a new
      defect. Verified by reading each failure line, not by pattern-matching the suite names.
- [x] **`npm run test:playwright`** — **not run** (out of gate for the per-story cycle here; the
      browser suite carries a documented permanent failure, OPEN rows 89/116). Browser evidence for
      this story is the headless render above, which I ran myself.
- [x] Working tree clean after the gates; the temporary worktree and render script are removed.

## Spec adherence

### The verbatim check — the one that mattered

The AC is that `/tapestry/dictionaries` carries the operator's prose **verbatim**, paragraph breaks
excepted. I did not diff the code against the story's Background or the book's frame, because
**neither reproduces the prose** — both paraphrase it (see Non-blocking finding 1). I diffed against
the operator's own message, and I did it twice:

1. **Source-level.** Extracted the three `<p>` blocks from
   `ui/src/pages/dictionaries/Placeholders.jsx:29–52`, collapsed JSX whitespace/newlines, joined
   with single spaces. **Identical.**
2. **Browser-level** (the authoritative one — this is what a reader actually sees). Loaded
   `http://localhost:7778/tapestry/dictionaries` in headless Chrome, took `innerText` of each
   `.page-prose p`, normalised whitespace, joined with single spaces:
   **1489 characters, byte-for-byte identical to the operator's source string.**

No word added, removed, reordered or reworded. Punctuation identical, including the colons in
"And so: Conversely," and "that typically means:", the slashes in "and/or" and "elements / items",
and the two parenthetical asides — "(But that only works for the Tapestry Owner. … on that dlist.)"
and "(or item)" / "(or Concept Header)". Capitalisation identical, including the inconsistent
"Each Dictionary" / "each dictionary", "DList Header" / "that dlist", and "neo4j" lower-case. The
sentence-fragment openings ("Which means that…", "Which means there needs to be…", "But there is a
second way…") are preserved as written. **No discrepancy of any kind.**

The three paragraph breaks fall at sentence boundaries and split nothing:
`…item on that dlist.)` ¶ `The primary criteria…` ¶ after `…no longer valid items.` — i.e. exactly
the model's three beats (what a dictionary is → how entries get in automatically → how they get in
by hand). Permitted by the AC, and a defensible split.

### Acceptance criteria

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 1 | Trusted Agents children in order: Mine, All, **Set Up** | `ui/src/components/Layout.jsx:104–106`; live DOM query of `a[href^="/tapestry/trusted-agents"]` returns `mine \| Mine`, `all \| All`, `setup \| Set Up` in that order (fourth hit is the breadcrumb) | **PASS** |
| 2 | `/tapestry/trusted-agents/setup` renders a placeholder naming Sponsor/Agent pairing | Route at `ui/src/App.jsx:417` with `handle: { crumb: 'Set Up' }`; component `ui/src/pages/trusted-agents/Placeholders.jsx:35–43`. Live: HTTP 200, `h1` = "🕵️ Set Up a Trusted Agent", body = "Placeholder page. This page is where you will pair a **Sponsor** with an **Agent**.", breadcrumb = "Home › Trusted Agents › Set Up" | **PASS** |
| 3 | `/tapestry/dictionaries` carries the explainer verbatim | Two independent diffs above, both exact | **PASS** |
| 4 | Explainer reads as body prose — left-aligned, measure-limited — not centred placeholder-box text | Live computed style on `.page-prose p`: `text-align: start`, container `max-width: 832px` (= 52rem), `line-height: 25.6px`, inter-paragraph `margin-top: 14.4px` on `p + p`. The `.placeholder` box below still computes `text-align: center`, `padding: 40px`, `border-style: dashed` — the two are visually distinct, as the AC intends | **PASS** |
| 5 | The page still marks itself a placeholder | `Placeholders.jsx:54–57`; live `.placeholder` innerText = "Placeholder page. / None of the above is built yet — this page describes the model, it does not run it." | **PASS** |

### The two Story 1–2 reviewer findings folded in

| Item | Verified by | Result |
|---|---|---|
| Delete orphaned `.bs-usermenu-admin-*` (review 2, finding 1) | Five rules removed — `ui/src/styles.css:2972–3016` in the pre-diff file (`fded88b2`), matching review 2's citation exactly. Repo-wide `/usr/bin/grep -rn "bs-usermenu-admin"` (real grep, not the gitignore-honouring shim) returns **zero** hits in the working tree — nothing in `ui/src/**`, nothing in `public/**` (no legacy HTML, no `public/kg/assets/*.css`), nothing in the untracked `dist/**`. The only surviving hits are (a) the unrelated detached-HEAD checkout under `.claude/worktrees/pensive-euclid-ad798d/` at `857481d0`, which is a different commit and not part of this branch, and (b) prose in the story/review markdown. Independently confirmed against the **served** artifact: `curl` of `assets/index-DP7KjK4A.css` → `grep -c bs-usermenu-admin` = **0**. Nothing broke | **PASS** |
| Tooltip off the disabled `<button>` (review 2, finding 2) | `ui/src/components/Header.jsx:29–38`. See analysis below | **PASS** |

## Architecture invariants (CLAUDE.md §1–§4)

- **§1 POV-first.** Nothing is computed, derived or stored. Two static React components and a CSS
  block. No `wot_rank_*` / `wot_followers_*` columns, no trust filtering, no "trusted set".
- **§2 Decentralized-first.** No write path, no author gate, no allow-list. The diff adds no
  classification check anywhere (the pre-existing owner/admin Settings row in `Header.jsx:153` is
  untouched).
- **§3 Filter at view time.** Nothing denormalised or cached; there is no data access at all.
- **§4 Local-first.** No storage, import, rebuild, reconciliation or backup path touched.
- **Nothing the explainer describes got implemented.** Checked explicitly, because the story's
  *Out of scope* forbids it: `git diff --stat` is `ui/src/{App,components/Header,components/Layout,
  pages/dictionaries/Placeholders,pages/trusted-agents/Placeholders}.jsx` + `ui/src/styles.css` +
  four `engineering-team/**.md` files. **Zero** files under `src/`, `bin/`, `setup/`, `test/` or the
  firmware seed. No validity flag, no added-by-hand field, no usage/acceptance measure, no
  DList-header fallback, no `elements`/`items` query. The prose is inert copy, which is what the
  story promised.
- No TA-pubkey hardcode: `git diff | grep -E "[0-9a-f]{40,}"` is empty. (Noted in passing: this
  machine's TA is `11f23fe4…`, not the `82b75e47…` in CLAUDE.md — another reason a literal would
  have been wrong. None is present.)

## Concept-graph integrity

- **No handles in the diff** — no `39998:`, no `kind:pubkey:slug` string, no `naddrEncode`. Nothing
  to malform.
- **No concept definitions changed** → **no firmware reinstall required.** Correctly not claimed.
- **The story's "Concepts touched — named for orientation only" list is accurate.** I checked it
  against the authoritative source rather than the source tree, per the house rule:
  `GET /api/concept-graph/summaries` (62 concepts) contains **`tapestry assistant`**, **`tag`**,
  **`list`** and **`concept header`**. All four exist; none is wired by this diff.
- Note for whoever builds the model later: the explainer's "Concepts" dictionary and the existing
  `trusted dictionary snapshot` concept both appear in that list — they are different things today,
  and the epic's S3b/trusted-dictionary thread is where that gets reconciled. Nothing to do now.

## Things tests can't catch

- **No secrets.** No hex keys, no nsec, no tokens. `grep` for `console.`/`TODO`/`FIXME`/`secret`/
  `password`/`api_key` across the `ui/` diff: **empty**.
- **No leftover debug code, no commented-out code.** The comments added are explanatory and
  accurate — including the one at `ui/src/styles.css:144–146` claiming "the global reset zeroes `<p>`
  margins", which I verified against `ui/src/styles.css:3` (`* { … margin: 0; padding: 0; }`). That
  is why `.page-prose p + p` has to state its own spacing; the comment earns its place.
- **No race conditions / concurrency surface.** No async, no effects, no fetch.
- **No new dependencies, no new tooling.** House rule respected.
- **No scope creep.** Everything in the diff maps to a story bullet: the Set Up page, the explainer,
  the two folded-in findings, the `_intake.md` entry the story says finding 4 would get, and the
  epic/book bookkeeping the amendment requires.

### `Header.jsx` — the disabled-item rewrite, checked line by line

**The enabled path is behaviourally identical.** Before: `disabled={!link.to}` (false),
`title={link.to ? undefined : …}` (undefined), `onClick={() => link.to && onGo(link)}`. After:
no `disabled`, no `title`, `onClick={() => onGo(link)}`. Same rendered attributes, same handler,
same class. Nothing else in the file changed — `go()`, the `external` branch, the Settings row, the
About/Sign Out rows and the outside-click effect are untouched.

**The disabled path.** The tooltip moves to a wrapping `<span className="dropdown-item-wrap"
title={…}>`; the button keeps `disabled` and gains `aria-disabled="true"`. That is the standard,
documented workaround for the Firefox behaviour review 2 flagged, and it is a strict improvement:
previously the `title` sat on the element whose pointer events are suppressed. Redundant
`aria-disabled` alongside native `disabled` is harmless. Keyboard parity with the other two menus is
preserved — `AvatarMenuLink`'s `<span aria-disabled>` is not focusable either, and a native `title`
is mouse-only regardless.

**Does the wrapper break `.user-dropdown`'s selectors?** I enumerated every `.dropdown-item` rule:
`ui/src/styles.css:761, 773, 774, 779, 783` — that is all of them, and `.user-dropdown` itself has
exactly one rule (line 729) with no child or descendant combinators. So:

- `.dropdown-item { display: block; width: 100% }` inside a `display: block` span still fills the
  dropdown's width. Layout unchanged.
- `.dropdown-item:hover:not(:disabled)` still correctly skips the disabled row; the wrapper carries
  no hover style, so the row looks the same as before.
- `.dropdown-item:last-child { border-radius: 0 0 8px 8px }` — this is the one selector whose match
  set changes: the wrapped button is now the *only* child of its span, so it matches where before it
  did not. **Visually inert**: `.dropdown-item` sets `background: none; border: none`, and the
  disabled rule adds only `opacity`/`cursor`, so there is no painted box for the radius to round.
  Meanwhile the row that *should* be rounded — "Sign Out" — is still a direct last child of
  `.user-dropdown` and still matches. No regression. (Noted as non-blocking finding 2 so the next
  person who adds a background to `.dropdown-item` knows to look here.)
- `.dropdown-item-wrap { display: block }` is a new, unique selector: `grep "dropdown-item-wrap"`
  matches only `styles.css:783` and `Header.jsx:34`. No collision.

Honest limit: the disabled branch only renders for a signed-in user with **no** provisioned
assistant key, and the Firefox-specific behaviour cannot be exercised in this environment. I verified
the markup by reading it and confirmed `.dropdown-item-wrap` reaches the served CSS
(`.dropdown-item-wrap{display:block}` present in `assets/index-DP7KjK4A.css`). The tooltip's
*appearance* in Firefox rests on a well-established workaround, not on a test.

### `.page-prose` — collision and interaction check

`grep "prose" ui/src/styles.css` returns only the three new rules (147, 151, 155) — no pre-existing
`.page-prose`, `.prose` or similar to shadow or be shadowed by. It sits between `.page-description`
and `.placeholder` in the Pages block, which is the right neighbourhood.

It does **not** affect the placeholder box: every rule is scoped under `.page-prose`, and the two
`<p>`s inside `.placeholder` are outside that subtree — confirmed live, `.placeholder` still computes
`text-align: center / padding: 40px / border-style: dashed`, identical to its five sibling
placeholder pages. `max-width: 52rem` (832px) is comfortably inside `.main-content`'s 1200px, so no
overflow. `margin-bottom: 24px` matches `.page-description`'s, so the gap above the placeholder box
is consistent with the rest of the app.

### `_intake.md` finding-4 entry — accuracy audit

The story says finding 4 was filed rather than fixed, so I verified the filed text is true.
`engineering-team/stories/_intake.md:2315–2333`:

- ✅ "`bin/control-panel.js:207–266` serves `/legacy` and `/legacy/:filename.html` with no
  authentication or classification check at all" — **accurate.** `serveHtmlFile` is at line **207**,
  `app.get('/legacy', …)` at **259**, `app.get('/legacy/:filename.html', …)` at **262–266**. Neither
  route takes a middleware argument, and `app.use(authMiddleware)` is at line **286** — *after* both,
  so they are never covered.
- ✅ "any unauthenticated visitor could already request those pages directly" — **verified live, not
  inferred.** `curl http://localhost:7778/legacy/sign-in.html` with no session → **200** with the
  full page body; `/legacy` → 301 to the directory index.
- ✅ "Surfaced (not caused) by … Story 2" and "hiding a link is not a security boundary" — correct,
  and consistent with review 2 finding 4, which cited the narrower `259–266`.
- ⚠️ One omission, non-blocking (finding 3 below): the entry misses
  `app.use('/legacy', express.static(path.join(__dirname, '../public')))` at **line 150**, which
  mounts the *entire* `public/` tree under `/legacy/` and is also above the auth middleware. The
  entry's suggested path ("audit what `public/*.html` actually exposes") covers the spirit; adding
  `:150` would give that audit its true starting point.

## House rules check

- [x] Concept Graph API authority respected — I checked concept names against
      `/api/concept-graph/summaries`, and the diff wires no concepts.
- [x] No new lint/typecheck/build tooling. No new dependency; `ui/package.json` untouched.
- [x] No TA-pubkey hardcode; the ADR-0015 `LEGACY_*` constants are not touched (out of scope here).
- [x] Harness bookkeeping done: epic story list extended, epic guardrail amended to carve out the
      Dictionaries index, book frame amended with the two new bullets, `_intake.md` entry filed.
      All consistent with what shipped.

## Findings

### Blocking

None.

### Non-blocking

1. **The verbatim source of truth is not stored anywhere in the repo.** The story's Background
   (`3-setup-page-and-dictionaries-explainer.md:9–23`) and the book's amended frame
   (`audits/navigation-scaffolding/book.md:46–57`) both *paraphrase* the operator's prose; the only
   copy of the exact words in the repository is `ui/src/pages/dictionaries/Placeholders.jsx:29–52`
   itself. That makes the verbatim claim **self-certifying**: I could only verify it because the
   operator's original message was still recoverable from this session's transcript, which is
   outside the repo and not durable. The epic now says in as many words that this prose "is the
   record of the model and later work will be built against it: don't paraphrase, tighten, or 'fix'
   it in passing" (`epics/navigation-scaffolding.md:63–68`) — but there is no in-repo baseline
   against which such a drift could ever be detected. **Suggested (strongly):** paste the operator's
   unbroken source text into the story's Background as a fenced blockquote, so a future reviewer can
   re-run the diff from the repo alone. Not blocking: the AC is met and I verified it.
2. **`ui/src/styles.css:774` — `.dropdown-item:last-child` now also matches the wrapped disabled
   button**, because that button is the only child of its `<span>`. Harmless today (the item paints
   no background or border, so the `border-radius` has nothing to round) and the genuinely-last
   "Sign Out" row still matches as before. Flagged only so that whoever gives `.dropdown-item` a
   background later remembers that a mid-menu row can now pick up bottom corners. **Optional:**
   tighten to `.user-dropdown > .dropdown-item:last-child`.
3. **`engineering-team/stories/_intake.md:2321` — the security entry's line range is
   accurate but incomplete.** It cites `bin/control-panel.js:207–266` (the helper and the two
   `/legacy` routes) and misses `bin/control-panel.js:150`,
   `app.use('/legacy', express.static(path.join(__dirname, '../public')))`, which serves the whole
   `public/` tree — CSS, JS, subdirectories, everything — under `/legacy/`, also before
   `app.use(authMiddleware)` at line 286. Same conclusion, wider blast radius. **Optional:** add
   `:150` to the entry so the eventual audit starts from the real surface.
4. **`ui/src/pages/dictionaries/Placeholders.jsx:23–58` duplicates `PlaceholderPage`'s shell** —
   `<div className="page">` + `<Breadcrumbs />` + `<h1>` + the `.placeholder` box — rather than
   extending the component (e.g. an optional `intro` prop, or `children` above the box). Correct as
   built, and the duplication is four lines with a comment explaining why the page is special; but
   if `PlaceholderPage` gains a wrapper or changes its heading markup, the Dictionaries index will
   silently drift out of line with its five siblings. **Optional:** give `PlaceholderPage` an
   `intro` slot next time it is opened.
5. **Forward-looking, explicitly *not* a request to change the text.** The prose is protected and
   nothing in it is implemented, so it raises no invariant problem today. But when the model *is*
   built, two of its phrases sit where CLAUDE.md §1–§2 bite: "usage and acceptance **by the
   community**" is a POV-relative judgement (there is no global "the community" — it resolves
   through the active POV's WoT columns), and "the **steward** of the dictionary … typically the
   owner … will override community-based criteria" reads as an admin gate unless hand-curation is
   modelled as *anyone's* publishable assertion that a given POV may or may not weigh. Worth naming
   in whatever ADR eventually implements the validity flag and the added-by-hand field, so the
   reflex checks get run then rather than being assumed settled by this page.
6. **Carried forward, unchanged from review 2:** finding 3 (the `external` flag is consumed only by
   `Header.jsx`) is correctly recorded as out of scope in the story; finding 5 (`DevPage.jsx:45` has
   no avatar menu) and finding 6 (`Header.jsx:42` destructures an unused `TA_PUBKEY`) are still open
   and still pre-existing. No action asked here.

### Harness friction

1. **Same as reviews 1 and 2:** the branch carries story, epic, book and implementation in a single
   commit, against the project's "commit at each phase boundary: yes". Noted, not escalated — the
   abbreviated path defines no commit cadence of its own. Third occurrence; if the abbreviated path
   is going to be used routinely it may be worth writing its cadence down.
2. **`npm test` remains red-by-default** for the reason recorded in **OPEN.md row 191**, so a clean
   diff still produces a "FAIL" headline that every reviewer must re-derive as environmental. Third
   consecutive review to spend a full-suite run on it. No new row — 191 already proposes the fix
   (skip-with-reason) — but this is another data point for its priority.
3. **Minor, no row:** the reviewer's browser gate needed `channel: 'chrome'` because Playwright
   1.56.1's pinned `chromium_headless_shell-1194` is not installed in
   `~/Library/Caches/ms-playwright` (1187/1223/1228 are). Anyone reaching for a headless render in
   this repo will hit the same thing; `npx playwright install` or the system-Chrome channel both
   work.

## Verdict

**PASS**

The thing that mattered most is exactly right: the operator's dictionary-model prose renders
**byte-for-byte identical** to the text they supplied — verified twice, once from the JSX source and
once from the live DOM at `localhost:7778` (1489 characters, no difference in a word, a comma, a
capital or a parenthesis), with the only change being three paragraph breaks at sentence boundaries,
which the AC permits. All five acceptance criteria hold under inspection; the Set Up page is third
in the nav, routes, breadcrumbs and names Sponsor/Agent pairing. Both folded-in review-2 findings are
correctly and completely discharged: the `.bs-usermenu-admin-*` deletion breaks nothing anywhere in
the tree, including the non-JSX surfaces, and the tooltip rewrite leaves the enabled path
byte-identical while fixing the disabled one without disturbing a single `.user-dropdown` selector.
The new `.page-prose` collides with nothing and leaves the placeholder box untouched. Clean on all
four architecture invariants, and — the specific risk this story carried — **none of the model the
explainer describes has been implemented anywhere**; the diff does not touch a single file outside
`ui/` and the harness markdown. Build, eslint parity (per-file and whole-tree) and harness-lint are
green; the only `npm test` failures are the documented OPEN-191 environmental guard on suites this
diff cannot reach.

The strongest finding — that the repo holds no independent copy of the "verbatim" text — is a
durable auditability gap worth closing, but it is not a defect in this diff and does not hold the
merge.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place
      (`engineering-team/stories/navigation-scaffolding/3-setup-page-and-dictionaries-explainer.md`).
- [x] Completion detection performed; result reported in chat (not recorded here, per the template).
