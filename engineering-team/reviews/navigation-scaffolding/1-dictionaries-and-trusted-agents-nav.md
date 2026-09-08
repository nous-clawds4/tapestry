# Review: Story 1 — Dictionaries and Trusted Agents sections on the Tapestry sidebar

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-08
**Diff:** `git diff staging...0a4aad99` (commit `0a4aad99`, branch `feat/navigation-scaffolding`)
**Epic:** `engineering-team/epics/navigation-scaffolding.md`
**Book:** `engineering-team/audits/navigation-scaffolding/book.md`

> **Abbreviated path.** The operator chose Story + Implementer + Reviewer at intake: no ADR, no
> test plan, by design. Both are recorded as `none (abbreviated path)` under the story's *Linked
> artifacts*. Their absence is **not** treated as a defect below. There is also no React component
> test harness in this repo (`ui/` carries vite + eslint only; the root `npm test` is a Node
> server-test runner), so the ACs are verified by reading the code that produces the behaviour,
> plus build/lint gates and the Implementer's live-browser pass.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** — **FAIL (pre-existing, environmental; unrelated to this diff).**
      Full run, 4579 lines of output. Every suite PASS except three:
      `tl-membership-method-selector` (11/1), `tl-weighted-sum-method` (6/1), `tl-certainty-method`
      (4/2). All four failures are the same assertion —
      `L0 GUARD publish policy is local-only … refusing to run: BRAINSTORM_PUBLIC_LOCAL_ONLY must be
      active (got {"success":true,"allowExternalPublish":true})`. This is **OPEN.md row 191**
      verbatim: those suites hard-FAIL on the product-default publish posture, red-by-default on any
      machine that has not opted into local-only. `Total skipped: 34`. **This diff touches zero
      server-side code** (`ui/src/**` only), so it cannot be the cause. Everything that *does* read
      the touched files passed — including the grep-sentinel suites
      `pov-state-unification` (S4 pins `BrainstormUserMenu`'s POV switcher),
      `tag-detail-curated-view-and-pin-polish`, `note-surfaces-ui`,
      `login-failure-and-tag-collapse`, `admin-tools-dashboard-panel`, `search-result-parity`.
- [x] **`npm run test:playwright`** — **not run.** Out of gate for this repo's per-story cycle
      (OPEN.md rows 89/116 record a permanent pre-existing failure in the browser suite); the
      browser evidence for this story is the Implementer's live pass against
      `http://localhost:7778`.
- [x] **`cd ui && npm run build`** — **PASS.** `✓ built in 10.21s`, no errors. Only the pre-existing
      chunk-size advisory.
- [x] **`npx eslint` on the touched files, with a staging baseline for parity** — **PASS.**
      Per-file counts, branch vs. `staging` (built in a throwaway worktree at `7bebeea5`):

      | File | staging | branch |
      |---|---|---|
      | `ui/src/App.jsx` | E0 W0 | E0 W0 |
      | `ui/src/components/Layout.jsx` | E2 W0 | E2 W0 |
      | `ui/src/components/PlaceholderPage.jsx` | *(new)* | **E0 W0** |
      | `ui/src/pages/dictionaries/Placeholders.jsx` | *(new)* | **E0 W0** |
      | `ui/src/pages/trusted-agents/Placeholders.jsx` | *(new)* | **E0 W0** |

      Parity holds exactly; the three new files are clean. The Implementer's claim verified.
- [x] **`bash scripts/harness-lint.sh`** — **PASS.** `harness-lint: clean (0 violations)`
      (existing waivers unchanged).
- [x] Working tree clean after the gates (`dist/` is gitignored, so the build left no residue).

## Spec adherence

No test surface exists, so each AC is verified against the code that produces it.

| # | Acceptance criterion | Verified by | Result |
|---|---|---|---|
| 1 | Two new top-level groups **below** Shared Concepts, order 📖 Dictionaries then 🕵️ Trusted Agents | `ui/src/components/Layout.jsx:90–107` — appended immediately after the Shared Concepts group (`:73–86`), which was the last entry in `mainNavItems`; order is array order | ✅ |
| 2 | Header click toggles open/closed like the existing groups (reuses `NavGroup`) | Both entries carry `children`, so `Layout.jsx:233–234` dispatches them to `<NavGroup>` — the same component and the same `open`/chevron state machine (`:149–192`) as every other group. No bespoke toggle | ✅ |
| 3 | Dictionaries children in order: Dictionaries, Tags, DLists, Concepts | `Layout.jsx:94–97` | ✅ |
| 4 | Trusted Agents children in order: Mine, All | `Layout.jsx:104–105` | ✅ |
| 5 | Each of the six links renders a page that says in plain words it is a placeholder | `ui/src/components/PlaceholderPage.jsx:18–20` renders `<div class="placeholder"><p><strong>Placeholder page.</strong></p>` plus per-page prose; six exports across `pages/dictionaries/Placeholders.jsx` (4) and `pages/trusted-agents/Placeholders.jsx` (2). `.placeholder` is the established dashed-border callout at `styles.css:144` | ✅ |
| 6 | Signed-in non-owner sees both groups (not owner-gated, matching Shared Concepts) | Neither entry sets `ownerOnly`; the filter is `Layout.jsx:232` `navItems.filter(item => !item.ownerOnly \|\| isOwner)`. Contrast the deliberately gated 🧠 Goals (`:19`) and 🗳️ Proposals (`:29`) | ✅ |
| 7 | Breadcrumbs resolve to readable names, no raw path segments | `Breadcrumbs.jsx:5–10` reads `handle.crumb` off `useMatches()`. Every new level supplies one: `App.jsx:400` `Dictionaries`, `:403–405` `Tags`/`DLists`/`Concepts`; `:410` `Trusted Agents`, `:414–415` `Mine`/`All`; the `/tapestry` root contributes `Home` | ✅ |

**Routes table** (story § Routes) matches `App.jsx:398–417` one-for-one, including the documented
`/tapestry/trusted-agents` → `.../mine` redirect (`App.jsx:413`, `<Navigate … replace />`, the same
idiom already used at `manage/audit`). No loop: the target matches the sibling `mine` route.

**Nothing added beyond the story.** The diff's story-1 surface is exactly: two nav entries, two
route groups, three new files. No data access, no POV filtering, no trust scoring on the new
pages — matching the story's *Out of scope*.

## ADR adherence

None to check — abbreviated path, no ADR by design. The one design decision the story reserved to
itself (route naming + the bare-prefix redirect, story § Routes) is implemented as written and
carries an in-code comment stating the reason (`App.jsx:412`).

## Concept-graph integrity

- [x] **No concept definitions changed** → no firmware reinstall required, and none is claimed.
- [x] **No handles in the diff.** The concepts the story names for orientation (`tag`, `list`,
      `concept header`, `trusted dictionary snapshot`, `tapestry assistant`) appear only as English
      prose in the file-level docstrings and page copy — no `kind:pubkey:slug` strings, no
      `39998:` coordinates, no naddr encoding. Nothing to get wrong.
- [x] **No `/summaries` dependency introduced** — the placeholder pages make zero API calls, which
      is the point of them.
- [x] **No TA pubkey anywhere.** Grepped all touched files for 40+ hex runs, `nsec`, `npub1`,
      `SECRET`, `PRIVATE_KEY` — clean.

## Things tests can't catch

- [x] No secrets. Sweep above run with `/usr/bin/grep` (the shell `grep` here is a ugrep shim that
      skips gitignored files — memory note *grep shim honors .gitignore*).
- [x] No `console.log`, no `debugger`, no `TODO`/`FIXME`, no commented-out code in the new files.
- [x] No race conditions or async at all — these are pure render functions.
- [x] No input validation surface (no user input, no fetch).
- [x] No dead code introduced by this story. (Story 2 leaves some — see that review.)
- [x] `PlaceholderPage` is a genuine shared abstraction, not copy-paste: six call sites, one
      component. The two `Placeholders.jsx` files each carry a docstring saying "replace an export
      with a real page file when its surface is built" — the right breadcrumb for the next author.

## House rules check

- [x] Concept Graph API authority respected — not consulted because nothing is wired; the story
      says so explicitly and the code matches.
- [x] **No new lint/typecheck/build tooling.** No dependency added, no config touched;
      `ui/package.json` unchanged.
- [x] Docker/stack rules N/A (no server code).
- [x] Architecture invariants (CLAUDE.md §1–4): nothing here computes a view, stores a derived
      answer, gates a write, or touches neo4j. The one nav-visibility decision (ungated) moves
      *toward* invariant 2, not away from it.

## Findings

### Blocking

None.

### Non-blocking

1. **`ui/src/App.jsx:401`** — the `dictionaries` index route is the only new route with no
   `handle.crumb` of its own, so `/tapestry/dictionaries` breadcrumbs as `Home › Dictionaries`
   while the sibling group it was modelled on breadcrumbs as
   `Home › Shared Concepts › Shared Concepts Registry` (`:386`). AC-7 is satisfied either way
   (the name is readable, no raw segment), and arguably the shorter trail is better for a
   self-named index. Flagged only so the inconsistency is a choice rather than an oversight.
2. **`ui/src/components/Layout.jsx:104`** — the Trusted Agents group has no `end: true` child
   because it has no index link, which is correct; but it also means the group header is the only
   way to reach the bare prefix, and the bare prefix redirects. Fine as built. Worth remembering
   when `/tapestry/trusted-agents` grows a real index page: the redirect at `App.jsx:413` must be
   replaced, not layered under.
3. **Sidebar/menu label drift, pre-existing.** `Layout.jsx:49` labels
   `/tapestry/grapevine/trusted-assertions` as "TA Treasure Map" while Story 2's avatar menus call
   the same route "My Treasure Map". Both are defensible ("TA" reads as *Trusted Assertions*
   there), and the page genuinely is per-viewer (`pages/grapevine/TrustedAssertions.jsx:54,70`
   filters `authors: [user.pubkey]`), so nothing is wrong — but two names for one destination in
   two navs is exactly the drift this epic exists to remove. Candidate for a one-line follow-up.

### Harness friction

1. The whole branch is a single commit (`0a4aad99`) carrying the epic file, the book, both stories
   **and** the implementation, whereas project settings say "Commit at each phase boundary: yes."
   A natural consequence of running Story + Implementer in one abbreviated session; it costs the
   reviewer the ability to diff spec-vs-code by commit. Noted, not escalated — no OPEN row, since
   the abbreviated path doesn't define its own commit cadence.

## Verdict

**PASS**

Every acceptance criterion is satisfied by code I read; placement, order, labels, gating, routes
and breadcrumbs all match the story verbatim; build, eslint parity and harness-lint are clean; the
only `npm test` failures are the documented pre-existing OPEN-191 environmental guard, on suites
this diff cannot reach.

## On PASS (same commit)

- [x] Story `**Status:**` flipped to `Done` in place (`engineering-team/stories/navigation-scaffolding/1-dictionaries-and-trusted-agents-nav.md`).
- [x] Completion detection performed; result reported in chat (not recorded here, per the template).
