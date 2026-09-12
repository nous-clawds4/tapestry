# Story 2: Curated headers link with `pointer`, and the curation screens say "copy"

**Status:** Done
**Created:** 2026-09-12
**Type:** Feature

## Background
Story 1 ratified the curation copy convention (ADR `curated-dlist-update/0001`, with Amendment 1): the
assistant's curated header links to the shared list with `["b", <shared header>, "pointer"]`, and the
assistant *copies* the community items its curation method accepts. The shipped code still follows the
old facet:
- the header endpoint writes `["b", <shared header>, "inherit-items"]` on every new curated header, and
  refuses any other existing `b` as a conflict;
- My Curated DLists' detail page warns about any header whose link is not `inherit-items`;
- six user-facing strings on the curation screens say "inherit" — the DList Curation panel's
  description (which also promises "never duplicating them"), the "candidates to inherit" option, the
  Curation method panel's text, the empty-view sentence, the header warning, and the Treasure Map
  page's "inherits from" on each curated entry;
- the items table counts a shared item as already copied when *any* tag of one of the assistant's items
  mentions it; the convention says only a copy's `q` tags do;
- the protocol drafts and BIBLE say the header endpoint "still writes `inherit-items` until story 2" —
  this story makes that false, so the same change updates them (story 1 review, round 2).

Two headers already on the community relay carry the older link (staging's TA `8e901369…` and the
customer assistant `253d40c4…`, both for `dog-breed`). Upgrading them, visibly, belongs to story 5's
Update preview; this story only stops treating them as broken.

## User-facing description
As a user whose Tapestry Assistant curates a community DList for me, I want my assistant's header to
follow the new convention and every curation screen to talk about copying, so that what I read matches
what my assistant will do, and a header made before the change is recognized rather than reported as
broken.

## Acceptance criteria
- [ ] **AC-1 (a new header links with `pointer`).** Given my assistant has no header for a community
      list, when I Add that list in the DList Curation panel, then my assistant's new header carries
      exactly one `b` tag, `["b", "<community header a-tag>", "pointer"]`. Everything else about Add —
      the header's other tags, where it is published, the Map entry offered for signing — is unchanged.
- [ ] **AC-2 (an existing header is never re-pointed).** Given my assistant already has a header for
      that list, when I Add the list again: a header linking to the same community header with
      `pointer` **or** with the older `inherit-items` is reported as already existing — no conflict
      error — and is left exactly as it is; a header with no `b` gains the `pointer` link; any other
      `b` (another target, another type, more than one `b`) is still refused, as today.
- [ ] **AC-3 (the detail page reads both forms).** On My Curated DLists' detail page, my assistant's
      header section shows no warning for a `pointer` link to the shared header. For the older
      `inherit-items` link it shows a plain note — not a warning — that the header uses the older link
      and that Update will upgrade it. Any other link type still shows a warning, which now names
      `pointer` as the expected type. The shared header is found and shown the same way for both forms.
- [ ] **AC-4 (the words say "copy").** The DList Curation panel's description reads exactly: "Empower
      your Tapestry Assistant to curate a community DList on your behalf. Your assistant authors its
      own version of the list and copies in the community items its curation method accepts, adding and
      removing them each time you press Update list. Your Treasure Map records that you empowered it."
      On My Curated DLists the option reads "Also show candidates to copy", the Curation method panel
      says it will decide which candidates to copy, and the empty-view sentence says the shared list
      offers no candidates to copy. The Treasure Map page describes a curated entry as copying from its
      shared list. No user-facing text on these screens says "inherit" (raw event JSON excepted).
- [ ] **AC-5 ("already copied" means a `q` names it).** In the items table, a shared item is a candidate
      unless one of my assistant's items filed under my list carries a `q` tag naming it — its address
      for a kind-39999 item, otherwise its event id. A mention in any other tag (`e`, `a`, `p`, …) no
      longer makes an item "already copied".
- [ ] **AC-6 (the docs say what the code now does).** Every sentence that says the header endpoint
      still writes `inherit-items` — `protocols/drafts/inherit-from.md`'s status block, BIBLE's
      § Assistant Keys, glossary `b tag` row and §25 status, and `assistant-designation.md`'s
      Deployment status — now says new curated headers link with `pointer` and older ones are upgraded
      by Update (story 5), while still saying items are copied only from story 5. BIBLE's glossary cites
      `curated-dlist-update` ADR 0001 by name, and BIBLE's `Last updated` records the change.
- [ ] **AC-7 (nothing else moves).** The Map entry and its revoke, the import action, the items table's
      three views and their states (apart from AC-5's rule), the Simple Lists pages, and the Update
      button — still disabled — behave as before.

## Concepts touched
None changed. Orientation: `39998:<TA>:list` (DList headers and items), `39998:<TA>:shared-concept`
(community headers), `39998:<TA>:tapestry-assistant`.

## Out of scope
- Upgrading headers that carry the older `inherit-items` link — story 5 shows the upgrade in Update's
  preview and the assistant signs it there.
- Update itself and copying items (story 5); the curation method's controls (story 4); lists curated
  by another assistant (story 3).
- The Trust Determination Methods concept; a schedule for Update.
- Any change to the Map entry or to the Simple Lists pages.

## Open questions
None. Resolved at the Planning gate (2026-09-12): `origin/staging` was merged into the branch first
(`22fe7f28`; this book's OPEN.md rows became 276–279), and the older-link headers are recognized here
and upgraded in story 5's Update preview, as the epic planned (option A).

Known constraint: the panel's new description mentions "Update list", which works from story 5. That is
fine while the branch ships as one book; if it ships sooner, that sentence needs a placeholder.

## Deviations
- **Beyond the ADR's edit lists — a comment and bookkeeping.** `TreasureMapTagsPanel.jsx`'s file
  comment said the panel shows "the community header it inherits from"; it now says "copies from",
  like the line it describes (Decision §6, "comments follow the code" — its list does not name this
  comment). The epic's § Decisions gains the ADR 0002 bullet.
- **BIBLE §25 keeps its link.** Implementation note 7's replacement for the "**Status today for the
  facet:**" sentence drops the existing link to `assistant-designation.md` § "Curation copies"; the
  new sentence keeps it, after "curation copies". The words are otherwise the ADR's.
- **Carry-forwards checked and left as they are.** Handoff D11, the `dlist-curation` ADR 0003
  annotation, the intake closing line, OPEN.md row 259's note and the epic's settled bullet say the
  endpoint stops emitting `inherit-items` in (or with) story 2 — true at this commit.
- **Local check (cycle-local).** The local container was behind the branch — seven server files
  older and two missing, all from the `origin/staging` merge — so all of `src/` was synced to the
  branch (the container's copies backed up first) along with the new UI build; drift afterwards: none.
  Signed-in pages were checked through the fetch stub, as staging's customer whose assistant is
  `253d40c4…`; the Treasure Map page found that user's real Map on a general-purpose relay.
  - The Map entry reads "copies from 39998:11f23fe4…3767:dog-breed (older link)".
  - The DList Curation panel shows the new description verbatim.
  - The detail page shows "Points to … (older link)" and the plain note, with no warning.
  - The method panel and the option say "candidates to copy"; the candidates view lists the shared
    list's two local items.
  - On dcosl, the two older-link headers (`253d40c4…`, `8e901369…`) classify as `older` with no
    problems and the `older-link` note; the community header's self-declaration classifies as `exact`.
  - Not exercised: a real Add (the endpoint needs a genuine NIP-07 session); H15 covers the older
    path.
  - The served bundle's only "inherits from" strings are in the TypeScript editor worker
    (`ts.worker-*.js`), not app text.
- **Regression.** The six suites this story touches: 112 passed, 0 failed, through their `run()`
  exports; harness-lint clean. Full `npm test` against the synced container: 168 suites green, 3 red
  with 4 failing tests — exactly OPEN.md row 191's (three L0 GUARD refusals and the refused prune;
  this machine publishes externally by the operator's choice). Row 261's two LB matrices were skipped
  this run (Meili did not settle), not failed.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0002-pointer-switch-and-copy-wording.md`
- Test plan: `engineering-team/stories/curated-dlist-update/2-pointer-header-and-copy-wording.test-plan.md`
- Review: `engineering-team/reviews/curated-dlist-update/2-pointer-header-and-copy-wording.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
