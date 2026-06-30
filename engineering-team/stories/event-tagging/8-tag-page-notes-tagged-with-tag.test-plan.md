# Test Plan: Story 8 — Tag detail page, notes tagged with this tag

**Story:** `engineering-team/stories/event-tagging/8-tag-page-notes-tagged-with-tag.md`
**ADR:** `engineering-team/decisions/event-tagging/0008-tag-page-notes-tagged-with-tag.md`
**Date:** 2026-06-30

## Approach

One CJS suite — `test/event-tagging-for-tag.test.js` — wired into `test/test.js`, in the same three-layer shape as the Story-4/7 read suites.

**Per the operator, the UI portion (the `Tag.jsx` Notes view) is intentionally NOT auto-tested.** The architecture (ADR 0008, Option A) puts all the risky read logic in a **pure core function** `groupTaggingsByTarget`, so every AC about *what the notes view contains* is proven there — deterministically, with no stack — and the untestable surface (relay I/O, JSX) stays thin. That's exactly what makes skipping the UI tests low-risk.

1. **Core unit tests (the meat).** Drive `groupTaggingsByTarget({ candidates, headers, honoredAuthorities, isAsserterTrusted, viewerPubkey, tag })` with synthetic fixtures. Proves: grouping **by target note** for a fixed tag, per-target apply/dispute counts, the **multi-header union** (Q1), the tag-identity + legitimacy + polarity gates, the POV trust filter, and the **`mine`** channel (AC-3/-4 — the by-tag analogue of Story 7).
2. **Source-contract.** The core exports `groupTaggingsByTarget`; `src/api/index.js` registers `/api/event-tags/for-tag`; `handleForTag` composes the header discovery + per-header taggings scan + grouping + `enrichNotes`, threading `viewerPubkey`.
3. **HTTP smoke (skip-gated).** `for-tag` validates input (`400`) and returns a `notes` array on a well-formed query. **Gated on the existing `for-event` route as the "is the stack up?" probe** — so a `404` on `for-tag` while the stack is up is a real RED (route not wired), not a skip.

## Coverage map

| Criterion (AC) | Test name | Layer |
|---|---|---|
| Notes tagged with the tag are shown (grouped by note) | `group: groups taggings of a fixed tag BY TARGET note` | core |
| …with per-note counts (for curation) | `group: per-target apply/dispute counts (for curation)` | core |
| POV-filtered (counted set is trusted-only) | `group: POV trust filter — an untrusted asserter does not put a note in the counted targets` | core |
| **My own tagged note shows even when the POV wouldn't count me** (AC-3) | `group: my own tagged note appears in mine even when the POV does not trust me` | core |
| **Counted vs. mine stays honest** (AC-4) | (same test — asserts NOTE3 in `mine` but NOT in counted targets) | core |
| Multi-header union (Q1) | `group: unions taggings across MULTIPLE legitimate headers for the same tag` | core |
| Only THIS tag's taggings | `group: excludes a tagging whose header names a DIFFERENT tag` | core |
| Legitimacy gate (honored authority) | `group: legitimacy-gated — a header joining an un-honored authority is excluded` | core |
| Notes shown via the real read path + endpoint wired | `src: …/for-tag` registered + `handleForTag` composes scan + grouping + `enrichNotes` | source-contract |
| Empty state (no error) | `group: empty candidates → empty targets + mine` **+** `http: …returns a notes array` (empty 200) | core + http |
| Clicking a chip lands on a page that shows the note | (endpoint provides the notes; the Tag.jsx Notes view is **manual** — see below) | manual |
| Each note carries the Story-6 affordance | (consequence of rendering via the shared `NoteCard` — **manual**) | manual |

### Edge cases / ADR decisions (additional core tests)

- **Neutral polarity** dropped from both targets and `mine`.
- **Latest-wins per (target, viewer)** in `mine` (flip apply→dispute → dispute).
- **No `viewerPubkey`** → `mine: []`.
- **Addressable (`a`) target** groups by address — the core stays general even though the UI scopes to `e`-targeted kind-1 notes.

## What is deliberately NOT automated (operator decision)

The **`Tag.jsx` Notes view** (the toggle, the `NoteCard` list, the empty state in the browser) is verified **manually** on the local stack, not by an automated suite — consistent with the operator's "skip tests for the UI portions." The two manual ACs:

- **Notes view shows the tagged notes, with the empty state when none** — open a tag's page, switch to Notes.
- **Clicking a tag chip on a note lands on the tag page's Notes view and shows that note** — the loop that motivated the story. (Use the Story-7 durability angle: a note *you* tagged shows even on a non-POV test pubkey, because `mine` flows through `for-tag`.)
- **Each listed note carries the Story-6 affordance** — it renders via the shared `NoteCard`.

The note bodies come from the relay set (external) and the taggings from local strfry, so manual verification uses a **real note** (as in Story-6 testing), with the publish guard ON.

## Test infrastructure

- Runner: `node test/test.js`. No new framework, no build.
- Core + source-contract layers need **no stack**. HTTP smoke targets `:7778`, skip-gated on the `for-event` probe.
- To be created by the Implementer: `groupTaggingsByTarget` in `src/lib/event-tagging/classify.js`; `handleForTag` + the `/api/event-tags/for-tag` route in `src/api/event-tags/index.js` (+ `src/api/index.js`); the `Tag.jsx` Notes view (untested).

## How to run

```
npm test
```

## Verification

The new tests fail with the current code. Confirmed on 2026-06-30 at commit `d97112d6`:

```
--- event-tagging for-tag tests (epic event-tagging, Story 8) ---
  FAIL  group: groups taggings of a fixed tag BY TARGET note (one group per distinct note)
        groupTaggingsByTarget is not implemented/exported in src/lib/event-tagging (the by-target read grouping)
  FAIL  group: per-target apply/dispute counts (for curation)
  FAIL  group: POV trust filter — an untrusted asserter does not put a note in the counted targets
  FAIL  group: my own tagged note appears in `mine` even when the POV does not trust me
  FAIL  group: unions taggings across MULTIPLE legitimate headers for the same tag
  FAIL  group: excludes a tagging whose header names a DIFFERENT tag
  FAIL  group: legitimacy-gated — a header joining an un-honored authority is excluded
  FAIL  group: polarity 0 (neutral) is dropped from both targets and mine
  FAIL  group: mine reflects the current (deduped-latest) stance per target — flip apply→dispute shows dispute
  FAIL  group: empty candidates → empty targets + mine; no viewerPubkey → mine []
  FAIL  group: addressable (a) target groups by address (core stays general; UI scopes to e)
  FAIL  src: the core exports groupTaggingsByTarget
  FAIL  src: src/api/index.js registers /api/event-tags/for-tag
  FAIL  src: handleForTag composes the by-tag scan + grouping + note enrichment, threading viewerPubkey
  FAIL  http: for-tag validates input (400) and returns a notes array on a well-formed query
        for-tag with a malformed tagAuthor must 400 (got 404) — 404 here means the route isn't wired

event-tagging-for-tag: 0 passed, 15 failed, 0 skipped
```

All 15 red for the right reason: `groupTaggingsByTarget`, the `for-tag` route, and `handleForTag` don't exist. The HTTP test **fails rather than skips** — its `for-event` probe confirmed the stack is up, so the `404` on `for-tag` is correctly read as "route not wired" (a real red), not an environmental skip.
