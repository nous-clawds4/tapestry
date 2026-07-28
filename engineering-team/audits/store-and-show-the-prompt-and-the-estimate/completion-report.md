# Completion report — `store-and-show-the-prompt-and-the-estimate`

**Written:** 2026-07-27
**Branch:** `feat/store-and-show-the-prompt-and-the-estimate` · **merged to `staging`** as `c0565e15` (PR [#473](https://github.com/nous-clawds4/tapestry/pull/473), merged `2026-07-27T23:19:51Z`)
**Deploy:** `deploy-staging.yml` run [30313783862](https://github.com/nous-clawds4/tapestry/actions/runs/30313783862) — success, 1m40s
**Stories:** `goal-intent-fields` #1, #2, #3 — all `Status: Done`, each through all five phases with every judged gate

**Terms check at time of writing:** `eligible: true`, anchor distance 0, and the goal's live `deliverable` and `boundary` are byte-identical to the verbatim blocks recorded in `book.md` at open. **The goal was not edited at any point during the run.**

---

## Bullet-by-bullet against the acceptance frame

The frame is in [`book.md`](./book.md) → `### Acceptance frame`, decomposed at open from the goal's `deliverable` and `boundary` verbatim.

### 1. Each of the four properties can be **set when a goal is captured** — ✅

**Shipped:** `INTENT_FIELDS` + pure `pickIntentFields()` in `src/lib/brain/goals.js`, applied at every constructing capture path in `src/api/normalize/index.js`.

**Evidence — the H-class, not the corpus.** Story #1's live tests capture through the real endpoints and read the record back through the export (H1–H4, H8). Suite green with **H-class 11 executed / 0 skipped** — the live class genuinely ran rather than silently skipping.

> **Corrected after the final audit.** An earlier draft of this report cited the live corpus — 8 of 31 goals carrying values — as *"values that reached storage through the write paths this story built."* **That was false, and it was the report's own leading claim.** Every one of those 8 goals was signed between `2026-07-25T23:13:11Z` and `2026-07-26T16:37:24Z`; story #1's write paths landed at `2026-07-27T00:15:18Z` (`53eaa20d`), and every goal write re-signs with a fresh `created_at`. Those values therefore **predate the implementation** and arrived through the pre-existing *replicating* paths — the class story #1 documents as "already carries all four — no work." [`book.md`](./book.md) said as much at open, recording all four as already observable via the export. The corpus proves the properties are storable; it proves nothing about the paths this story built. **The H-class does, and it is what this bullet rests on.**

**The extent was derived, not recalled.** The story enumerates **ten** ways a goal record is written, split into a *closed* work-bearing class (four construction sites repo-wide, independently re-derived by two different judges) and a *characterized* no-work class. Gate 1 took four rounds to reach that; rounds 3 and 4 each found a write path the previous enumeration had missed. *(An earlier draft said "eight" — miscounted, and contradicted by this paragraph's own next sentence.)*

**Log:** `gate4-green-2026-07-26.log`.

### 2. Each of the four properties can be **set when a goal is updated** — ✅

**Shipped:** the update path accepts the four alongside its existing three fields, via a deliberately **asymmetric** two-list design.

**Evidence.** The asymmetry is the load-bearing part and is protected by an in-code comment, because collapsing the two lists *looks like tidying*: the existing `empty-value` loop rejects any non-string and any empty-after-trim value, so folding the four in would refuse `chanceOfSuccess: 75` **because of what it contains**, and would trim a prompt that must come back byte-identical. The refusal is a **presence** test across both lists, never a content test. Verified in the diff at Gate 4, not taken from the report.

### 3. **All four come back on every surface that shows a goal** — ✅ on local live data; ⚠️ **partially verified on staging**

**Shipped:** `parseGoalRow` extended and `projectIntentFields()` added in `src/lib/brain/goals.js`; five projecting read surfaces carry the four; the three existing goal screens render them.

**Evidence, local live stack:** `GET /api/brain/goals` returns 31 goals with all four in the shape. A goal **with** an estimate returns `50`; one **without** returns **`null`, not a fabricated `0`**. A goal storing `needsHumanInput: false` returns **`false`, not `null`** — the discrimination the whole book turns on, on **5 goals that store `false` explicitly** versus 23 that store none of the four. `GET /api/brain/direction/<slug>` returns `estimate: 75, estimateSource: 'goal'` with the prompt key present.

**Evidence, screens:** the browser class (8 tests) drives the three real screens in a real browser and asserts the **rendered text the owner sees** — including a substring drawn from *beyond* the excerpt bound on the detail screen, which is the only instrument that distinguishes "in full" from "an excerpt".

**Why this bullet's evidence is stronger than a passing suite.** Story #3's first test suite reported **36 passed / 0 failed against an implementation that rendered nothing on screen.** Gate 3 caught it by *building* that counterexample rather than reasoning about it; a second judge later rebuilt it independently and confirmed the fix. The browser class exists because of that finding.

**What "every surface" does *not* include, stated here where the word is being certified.** Three goal-showing payloads deliberately carry **none** of the four, and I verified this live: orient's bounded `roots` slice (`slug, name, standing`), `ancestry` (`slug, name`), and the proposal card's `passedOver` runners-up (`goal, goalName, whyNot`). This is ratified design — ADR 0002 d6 — and the Direction envelope's `chain` and `blindSteps` are excluded for a harder reason: a goal field there would break the boundary judge's blinding contract. **But these are exclusions from "every," and they belong under this bullet rather than filed two bullets later as evidence of non-action.** A reader certifying the word "every" should see them here.

**The honest gap.** On **staging**, this bullet is verified only to the level of *correct gating plus a byte-identical bundle*: all four brain endpoints return `403 Owner access required` (the right gate, not a 500), and the deployed bundle is `index-EZ-5jXBH.js` — **the same hash verified locally**, which the Reviewer confirmed by rebuilding the committed `ui/` tree into a scratch directory and `diff -rq`-ing it against the served `dist/`. The bundle contains the story's new owner-facing strings. **I could not read the brain endpoints' JSON on staging**: they are owner-gated and droplet SSH is outside this run's ceiling. Reading them there requires a signed-in session or in-container access.

**Logs:** `gate4-green-story2-2026-07-27.log`, `gate4-green-story3-node.log`, `gate4-green-story3-browser.log`.

### 4. **Storing and showing only** — no rules about which prompts may run — ✅

**Evidence.** No validation, gating, clamping or rejection was added on any of the four. `pickIntentFields` copies verbatim: **no trim, no coercion, no type check, no range clamp, no default substitution**. Absence is expressed by *not writing the key*. The Reviewer verified this **from module source rather than from the tests that claim to enforce it** — every absence branch is `== null`, the flag test is `=== true`, and the three screens carry **no guard at all** on the four, so the forbidden `{value && …}` shape is absent by construction.

### 5. **Nothing acts on** the estimate or the flags — ✅

**Evidence.** No sorting, filtering, grouping, ranking or eligibility gate keys on any of the four. Explicitly excluded and verified: orient's bounded `roots` slice, `ancestry`, `parentSlug`/`parentName`, the proposal card's `passedOver` runners-up, and the Direction envelope's `chain` and `blindSteps` — the last because a goal field there would break the boundary judge's blinding contract.

**A closed book's contract survived intact.** `operational-direction` **U25** — *"an absent estimate is RECORDED AS ABSENT — never invented"* — is green **unmodified** in every run. The estimate derivation in `src/lib/brain/direction.js` is **byte-unchanged**; the story #2 diff hunk there has **zero deletion lines**. Story #2's first draft would have broken U25 by requiring a fabricated `0`; Gate 1 caught it.

**A narrow supersession, ratified and bounded.** `second-brain` ADR 0006 d13/AC6 forbids numeric scores in owner-facing proposal card content. The owner ratified a supersession scoped to **owner-recorded values only**; the system-generated-ranking prohibition, the runners-up and the spine are untouched. A reciprocal `**Amended by:**` pointer is in `0006` — **+1/−0 lines**, body and `Accepted` status unchanged. The narrowness is demonstrated mechanically: **`the-proposal-loop`'s own pins S11, S13 and H2 pass unmodified**, and a judge re-ran their regexes against every string the ADR pins.

### 6. **No new screen is built** — ✅

**Evidence.** `git diff -- ui/src/App.jsx ui/src/Layout.jsx` is **0 lines** — no route and no nav entry added. The change is one new pure formatter module plus edits to three screens that already existed, and **exactly one** `styles.css` declaration, adding no new design token.

### 7. **Knowingly surrendered — stated, not dropped** — ✅

**Evidence.** `book.md`'s generated section carries the endpoint's own `surrendered` block verbatim: the **baseline commit** and the **pinned governing versions**, each with the reason (*reproducibility traded for operational cost; both retained in armed mode, which is unchanged*). That section is **generated, never typed** — emitted by a generator from the live endpoint response and diffed back out of the assembled file to confirm it is byte-identical to the generator's output. Re-verified after a later edit elsewhere in the file.

---

## What is not claimed

- **Staging JSON for bullet 3.** See above. Verified locally on live data; on staging only to gating + identical bundle.
- **Production.** Nothing was promoted past staging. `origin/main` is unchanged at `f7ff5392`, and `git merge-base --is-ancestor HEAD origin/main` confirms this work is **not** on main.
- **`OPEN.md` row 102 is not closed by this book.** The goal-schema `required` defect was repaired on the **local stack only**; staging and production presumably still carry it. The row must not be closed on the strength of that repair.
- **The four are not exercised end to end on a fresh instance.** Story #1's criterion 4 (a self-provisioning instance declares all four) is covered by three decomposed assertions, all green; the scratch-instance drill that would prove it end to end was deliberately not run, because it journals a durable record into the live brain and boots a second container.
- **`dependsOn` / prerequisites** remains underivable, exactly as the endpoint's `unavailable` block said at open. It is not one of the four and was never in scope.

## The obligation this book set for itself — discharged

[`book.md`](./book.md) → "One thing this book closes about itself" required this close to report on the *other* entry in the eligibility endpoint's `unavailable` block, and Review #2's non-blocking finding #5 repeated the instruction. **Discharged here, having been missed in the first draft of this report:**

`src/lib/brain/direction.js:91` still ships the string *"chanceOfSuccess is read here from the goal's raw record; the goals read API drops it (parseGoalRow)."* **That is now false.** `GET /api/brain/goals` returns `chanceOfSuccess` as of `c7b11d56`, verified live — the parser no longer drops it. The Direction endpoint's raw-record workaround is therefore no longer *necessary*, though it is still *present* and still correct in behaviour.

It was deliberately not fixed in this book: the constant is pinned by `operational-direction` **U28**, and editing a closed book's shipped constant is precisely what kicked this epic back twice. Retiring the workaround and correcting that text is a follow-up, not a defect in what shipped. **The book predicted this outcome at open and asked to be told; this is the telling.**

## Defects found in the run's own record, corrected rather than buried

- **Four commit messages claimed an evidence log was committed when `.gitignore` had silently swallowed it.** All five logs were later force-added.
- **One commit message elevated a review finding I had not verified** — that a Tester artifact contained a vacuous test. It did not; the vacuity was in the Reviewer's own probe. Commit messages are immutable, so [`book.md`](./book.md) carries a **"Record corrections — read before harvesting commit history"** section instructing the close-out audit to treat [`journal.md`](./journal.md) as authoritative where the two disagree.

## On this report's calibration — the final audit's sharpest finding

The final audit was asked whether this report's honesty is *calibrated*, or whether it concedes small things while overclaiming large ones. Its answer, and it was right:

> the declinations are genuinely good, but the asymmetry is real and runs the wrong way. Everything conceded costs nothing (a staging read it cannot reach, a prod it must not touch, a drill it chose to skip, a bug it disclaims), while the one place the report reaches past its evidence is the corpus provenance it leads with.

That is the exact failure mode of a self-written completion report: **performative honesty about what is free to concede, and looseness where a claim actually carries weight.** Four separate declinations cost this report nothing to make. The single sentence that cost something — attributing live data to write paths that did not exist when that data was signed — is the one that went unchecked, and it was the report's leading evidence.

Recorded here rather than quietly fixed, because a completion report that silently absorbs its own audit is worth less than one that shows where it was wrong.
