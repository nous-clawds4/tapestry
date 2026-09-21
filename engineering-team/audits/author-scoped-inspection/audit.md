# Build Audit: Author-scoped inspection on Active b-tags

**Book:** `engineering-team/audits/author-scoped-inspection/book.md`
**Date:** 2026-09-21
**Branch / commit range:** `43bccb6a..d61c8e80` (`feat/author-scoped-inspection`), merged to `staging` as `a90011c4` (PR #714)
**Provenance:** Acceptance-frame
**Confidence:** high — the anchor was captured eagerly at intake, before any code, and every bullet
was verified against a running deployment rather than against the tests.

## 1. What shipped

- **Active b-tags shows every b-tag event the local relay holds**, whoever signed it — not only the
  instance's own assistant. On staging that is 24 rows where the old query would have shown 10.
  — `stories/done/author-scoped-inspection/2-every-author-on-active-b-tags.md`
- **Every row names the author of the local event carrying the b-tag**, distinct from the existing
  author of the event it points at. — same story
- **A reader can narrow to one person** — the owner, themselves, or any customer — and a person
  carries *both* their own account and the assistant this instance issued them.
  — `stories/done/author-scoped-inspection/3-narrow-by-person-and-by-author-type.md`
- **A reader can narrow by kind of author**, independently: `Anyone` · `Assistants` · `People` ·
  `Everyone else`. On staging the three non-trivial classes partition the set exactly (15 + 1 + 8 = 24).
  — same story
- **The default view is the signed-in reader's own**, falling back to the owner's when signed out;
  a reader with no assistant key keeps "Mine" and is told why. — same story
- **A b-tag pointing at its own event is visibly a self-declaration** — row tint plus an inset left
  rule, and `* self-declaration` beside the copy control in its detail panel.
  — `stories/done/author-scoped-inspection/4-mark-self-declaration-rows.md`
- **The instance can state which assistants it controls and whose account each belongs to** — a new
  read that no surface previously had. — `stories/done/author-scoped-inspection/1-instance-assistant-roster.md`

## 2. Epics & stories rolled up

### Epic: `author-scoped-inspection`

| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 instance-assistant-roster | `GET /api/assistant/roster` (session-shaped) + `getAssistantPubkeyFor` / `listInstanceAssistants`; the private duplicate resolver in `getUserClassification` deleted | Done | `reviews/done/author-scoped-inspection/1-4-author-scoped-inspection.md` (PASS) |
| #2 every-author-on-active-b-tags | Scan drops `authors`; new `author (local)` column | Done | same (PASS) |
| #3 narrow-by-person-and-by-author-type | Two composing selectors, the default + fallback, the no-assistant notice, the explanatory empty state | Done | same (PASS) |
| #4 mark-self-declaration-rows | Row tint + inset rule + panel note; two opt-in shared-component props | Done | same (PASS) |

One review covers all four: they share two ADRs, one page and one fetch, and #2–#4 are indivisible
in the diff.

### ADRs

`decisions/done/author-scoped-inspection/` — `0001` (roster + one main→delegate resolver), `0002`
(author-scoped views). Both Accepted.

## 3. As-built inventory

**User-facing.** `Active b-tags` (`/tapestry/shared-concepts/b-tags`) gains two selectors with
per-control legends, a fourth column (`author (local)`), a row treatment for self-declarations, a
notice for a reader with no assistant key, and an empty state that names both selections. Its page
description no longer claims the list is limited to locally-authored events. **No new route.**

**Endpoints.** One new **public read**, `GET /api/assistant/roster`. It is *session-shaped* rather
than public-or-private: unauthenticated and non-owner callers get the owner plus active customers
(exactly what `GET /api/get-customers` already publishes, joined to assistant pubkeys — no new
disclosure); **admins are returned only to the owner**, matching the existing `requireOwnerOnly`
guard on `GET /api/admin/list`; the caller's own account/assistant pair always rides in `viewer`.
No write path was added or altered.

**Domain.** Concepts read, none changed: `39998:<TA>:concept-header`, `39998:<TA>:shared-concept`.
`39998:<TA>:tapestry-assistant` is referenced as the future home for *externally*-controlled
assistants and is deliberately **not** written. **No firmware reinstall anywhere in this book.**

**Data & contracts.** A roster row is exactly `{accountPubkey, assistantPubkey, role, displayName}`
and nothing else; `assistantPubkey` is `null`, never omitted, when unprovisioned. `role` ∈
`owner | admin | customer`. **No wire-format change**; no event kind touched; the closed b-value
forms and the `b-tag-deferred` sentinel are untouched.

**Libraries.** New pure ESM core `ui/src/utils/authorScope.js` (`classifyAuthor`, `personPubkeys`,
`matchesScope`, `assistantPubkeys`, `accountPubkeys`) — no React, no fetch. New context
`ui/src/context/AssistantRosterContext.jsx`. `src/utils/assistantKeys.js` gains the narrowed
pubkey-only resolver beside the existing key accessor, which is unchanged.

**Shared components.** `DataTable` gains `rowClassName`, `TagDetailPanel` gains `note` — both
strictly opt-in, both pinned byte-identical-when-omitted for the other 24 callers. `Avatar` and
`AuthorCell` widen their assistant test from "is the owner's" to "is one this instance controls";
picture-borrowing deliberately does not widen.

**Tests.** Two new Node suites (`author-scoped-inspection-roster` 15, `-views` 23, both registered
in `test/registry.js`) and a 13-case Playwright spec. No fixtures minted; nothing to tear down.

**Per-deployment discipline.** No 64-hex literal appears in any added source line. Three TA values
were exercised — dev `11f23fe4…`, staging `8e901369…`, and (as *foreign* b-tag authors read from the
relay) production `919ba08a…` and upstream `82b75e47…`.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Story 1 open question: is the roster read public or authenticated? | Neither — **session-shaped** | interpretation | `GET /api/admin/list` is behind `requireOwnerOnly`; a blanket-public roster would defeat that guard as a side effect, and a fully-private one would break story 3's signed-out fallback (ADR 0001 §Decision) | A signed-out visitor still gets a working default view; the admin roster stays as private as it was | — |
| 2 | ADR 0001 §Implementation: append the caller's own row when absent | Pair rides in `viewer`; no row appended | intentional-change | The appended row needs a `role`, and the only role inferable for a caller the roster withholds is a guess (`roster.js` comment) | None — the client reads `viewer` | — |
| 3 | ADR 0002 §Implementation: provider "fetches once on mount" | Fetches on mount **and** on session change | intentional-change | The response is session-shaped; without the re-fetch a reader who logs in keeps a stranger's roster (`AssistantRosterContext.jsx` comment) | Login/logout re-shapes the page correctly | — |
| 4 | Neither ADR | Page withholds selectors and table until the roster answers | added-beyond-scope | Without it the table painted "Everyone" and then snapped to the reader's own scope — a flash of a view they did not ask for; caught by Playwright E4 during implementation | Removes a visible wrong-state flash | — |
| 5 | Story 4 AC-5: "visible in both the light and the dark theme" | Restated as "visible at rest **and** under the pointer" | constraint-discovered | The app is dark-only — `ui/src/styles.css` defines one palette and contains no `prefers-color-scheme` or `data-theme` rule. The hover interaction is the constraint that actually bites (ADR 0002 §Context fact 4) | None; the criterion now tests something real | A light theme, if ever wanted, is unscoped |
| 6 | Story 2 AC-5: "17 rows where it previously listed 13" (Planning said 12 → 16) | Measured 13 → 17 at implementation, re-verified 13 → 17 at review | interpretation | The dev relay gained one owner-assistant b-tag row mid-book. **The delta of four is unchanged** — the AC's substance is the four named external rows | None | Live-relay counts in an AC are inherently perishable — see §6 |
| 7 | Story 1 AC-1: "one entry per account known to the instance in those three roles" | Admins withheld from non-owner callers | interpretation | Deviation #1's disclosure rule, set by the ADR the story's own open question deferred it to | For an admin caller the roster is deliberately incomplete; their own pair still arrives via `viewer` | Read AC-1 as subject to the disclosure rule |
| 8 | Epic §Out of scope: Active z-tags adopts the new props later | Unchanged, as specified | deferred | — | z-tags still shows only one author's view of its data | §6 |

**Undocumented work** — none. Every file in the diff traces to a story or ADR. The one file outside
the book's own tree, `test/registry.js`, is the two-line suite registration the gate's own guard
(`stack-free-npm-test` G5) requires.

## 5. Quality state at close

- **Test gate at close:** run `20260921T005035Z-34468-1bf2` on `d61c8e80+dirty` (the closed tree,
  gate run after the book/epic flip per workflow step 10): **FAIL, exit 1, 3502 passed, 6 failed,
  59 skipped, 213/213 suites**; failed: `tl-membership-method-selector`, `tl-weighted-sum-method`,
  `tl-certainty-method`, `profile-lookup-bounds`, `summaries-element-count`.

  **Five of the six are not this book's.** Four are the pre-existing baseline set, byte-identical to
  the pre-book run (`20260920T060602Z-16829-80d9`) and belonging to the open `tl-weighted-certainty`
  book. The fifth, **`profile-lookup-bounds`, is environmental and was proved so rather than
  assumed**: its E2 is a *live* test against the local container, which was running a stale
  `/api/profiles` handler — it answered the old refusal `{"error":"max 50 pubkeys per request"}`
  with no `limit` field. `docker cp`-ing the repo's current `src/api/profiles/fetchProfiles.js` into
  the container and re-running returned **27/27**. This book's diff touches `src/api/profiles`
  **zero** times (`git diff --name-only 43bccb6a d61c8e80`). That suite arrived on staging with
  PR #708 during this book and its server half was never deployed to this dev stack.

  **Zero regressions attributable to this book**; both of its own suites PASS (15/15, 23/23).
- **Playwright:** `tests/brainstorm/author-scoped-inspection.spec.js` — 13/13 (chromium).
- **CI:** `stack-free` **pass** on PR #714 — the suites are hermetic, not stack-dependent.
- **Deployed:** staging `a90011c4`, deploy run `35548476399` (79s), all five smoke tiers pass. The
  served bundle hash matched the locally-tested build exactly, so staging runs the audited code.
- **Known open issues:** the four pre-existing gate failures (`tl-membership-method-selector`,
  `tl-weighted-sum-method`, `tl-certainty-method`, `summaries-element-count`) are byte-identical to
  the pre-book baseline and belong to the open `tl-weighted-certainty` book. **Zero regressions
  attributable to this book.**
- **Debt logged by the ADRs:** the widened scan is now unbounded over a larger set and still uses
  `queryRelay` rather than `queryRelayBounded` (ADR 0002 §Consequences); controller-face borrowing
  for non-owner assistants is unbuilt (ADR 0002 §Decision); `protocols/worksheet.md` W13 still
  describes the resolver under a different name (ADR 0001 §Consequences).

## 6. Carry-forward register

- [ ] **The widened scan is unbounded and its truncation unreported.** Dropping `authors` removed
      the tightest bound the page had; it passes no `limit` and uses `queryRelay`, not
      `queryRelayBounded`, so a truncated read renders as a complete list. Deferred by the owner
      during this book and recorded in ADR 0002 as the first item to raise here. (§5 debt / review
      "hardest to look at")
- [ ] **The roster's owner-only admin gate is asserted but not demonstrated by the suite.** H3 passes
      vacuously on any instance with no admins configured, and an inverted gate would pass every
      test. The Reviewer verified the four-caller matrix by hand; that verification lives in the
      review, not the suite. (review Non-blocking 1)
- [ ] **Active z-tags has not adopted the two new props**, nor any author scoping. The sibling wire
      inspector still shows one view. (epic §Out of scope)
- [ ] **Assistants this instance does *not* control are unrepresented.** `Everyone else` is a
      residual class, not an identification: the page can say "not one of ours" and nothing more.
      `39998:<TA>:tapestry-assistant` is the named future home. (epic §Out of scope)
- [ ] **A fabricated `role: 'admin'`** for a viewer the roster does not list
      (`ui/src/pages/shared-concepts/ActiveBTags.jsx`) — inert today, false in a shared structure.
      (review Non-blocking 2)
- [ ] **UI/server version skew degrades silently** — a bundle without the server half falls back to
      "Everyone" with no Owner/Mine option and no indication. (review Non-blocking 3)
- [ ] **`getAssistantKeys` routes a `null` pubkey to the owner's key slot** when `brainstorm.conf`
      is absent. This book's resolver guards around it rather than fixing it. (review Non-blocking 4)
- [ ] **Live-relay counts inside an acceptance criterion go stale.** Story 2 AC-5's baseline moved
      twice in one book. Future ACs of this shape should constrain the *delta* and name the
      qualitative set, leaving absolute counts to the smoke step. (§4 #6)
- [ ] **A BIBLE §31 §Scope refresh.** Its multi-tenant direction is marked "not yet built"; the read
      half now is. Doc-lane, deliberately not done from a code story. (epic §Key facts)
- [ ] **Selections do not persist** across loads — deliberate, unlike the POV selector. (story 3
      §Out of scope)

## 7. Process findings (harness)

Retro run on measurement: `bash scripts/harness-stats.sh` at close.

| Finding | Source | Terminal state |
|---|---|---|
| **`review(<slug>):` commits are invisible to cycle-time measurement.** `harness-stats.sh:170` matches `^review: `, but three books now use the parenthesised form (`nip05-ssrf-guard`, `rollup-scanner-fidelity`, this one), so none of them contributes a story→review cycle time. Workflow 5 documents `review: <slug> — <VERDICT>`; the variant drifted in unchallenged. | this book's own commit `d61c8e80`, plus `git log` over `origin/staging` | **OPEN.md row** `2026-09-21-review-commit-form-breaks-cycle-time` |
| **The per-epic phase-commit heuristic is a substring match on the subject**, so `impl: author-scoped inspection …` (space) did not attribute to epic `author-scoped-inspection` (hyphen). 2 of this book's 5 phase commits are unattributed. Self-inflicted, but the heuristic makes a one-character slip silent. | `scripts/harness-stats.sh:48`; this book's `impl:` commit | **OPEN.md row** (same row — one fix surface, `harness-stats.sh` + the commit convention) |
| **A structural suite's comment-stripper read the Express wildcard route `'/api/settings/*'` as an opening block comment** and blanked ~300 lines of `src/api/index.js`, hiding a route that was live and answering. Fixed in this book's two suites with a string-aware scanner; five other suites still carry the naive regex. | implementation; ledger row | **OPEN.md row** `2026-09-20-comment-stripper-eats-wildcard-route` (filed during implementation) |
| **A vacuous negative nearly reached the review.** `git diff \| grep -nE <pat> \| grep '^+'` cannot match — `grep -n` prefixes line numbers — so a secrets sweep reported clean having searched nothing. Caught only by OPEN.md row 342's positive-control rule. | review §Harness friction 1 | **Declined** — no new row. Row 342 already states the rule, and it worked: the control exposed the vacuity. This is its worked example, not a new lesson. |
| **Phase 4 edited test files**, normally forbidden. Operator-authorized in-session, recorded in the implementation commit and the review. The carve-out in `templates/adr.md` covers "the deliverable IS a test change"; this was "a test blocks a correct implementation", which the harness does not name. | implementation; review §Quality gates | **Declined** — the operator's explicit in-session authorization is the harness's existing escape hatch, and inventing a fourth carve-out for a case that arose once would be premature. Revisit if it recurs. |
| **A book's acceptance-frame measurements went stale mid-book** (§4 #6). | §4 #6 | **Declined as a harness change** — recorded as a product-facing carry-forward in §6 instead; it is a story-writing habit, not a process defect. |

**Does it port to the other flow?** The first two findings are flow-agnostic — Direction-mode books
commit under the same conventions and are measured by the same script. The third is likewise
flow-agnostic. Nothing here is specific to human-gated operation.

## 8. Notes

The book's own framing is worth preserving: the ask arrived as a **question** — *"how exactly do we
select which events get listed on this page?"* — and the answer was the problem statement. A page
that under-reports is not merely incomplete; it is a page whose narrowness is invisible to its
reader. That is what the two selectors fix: they do not only narrow, they make the narrowing
*legible*, because a view is now something the reader chose rather than something the code assumed.
