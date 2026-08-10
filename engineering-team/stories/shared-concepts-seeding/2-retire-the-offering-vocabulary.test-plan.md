# Test Plan: Story 2 — Retire "offering"

**Story:** `engineering-team/stories/shared-concepts-seeding/2-retire-the-offering-vocabulary.md`
**ADR:** none — Architecture skipped by design (Refactor; names settled with the owner)
**Date:** 2026-08-10
**Suites:** `test/retire-offering-vocabulary.test.js` (new) and `test/shared-by-me.test.js`
(re-aimed and renamed from `my-offerings.test.js`)

## The division of labour

A rename has two failure modes, and one suite cannot guard both:

- **The words don't change** → the new suite, `retire-offering-vocabulary`, owns what things may be
  *called*.
- **Something quietly breaks while being renamed** → the existing behaviour suite owns that, and it
  is story AC-9's guard.

So the behaviour suite was **re-aimed to discover the names rather than hardcode them**. App.jsx
names the component for the `mine` route; the page names the endpoint it fetches; `index.js` names
the handler on the line that registers it. That means it passes *today*, will pass after the rename,
and fails loudly if the rename changes what the page actually returns. It also keeps the Tester out
of the business of choosing product names — the Implementer picks them, and only the *constraint* is
pinned.

## Coverage map

| Criterion | Test | Suite |
|---|---|---|
| AC-1 — the "mine" page named for sharing | `V1` | vocabulary |
| AC-2 — the "others" page named for sharing; the two pair | `V2` | vocabulary |
| AC-3 — a reached concept reads as shared | `S6` | behaviour |
| AC-4 — a concept that didn't reach reads as a failure with retry | `V3`, `S6` | both |
| AC-5 — unconfirmed survives and stays distinct | `V4` | vocabulary |
| AC-6 — no third noun for the local half | `V5` | vocabulary |
| AC-7 — retired word absent from user-facing surfaces | `V6`, `V6b`, `V7` | vocabulary |
| AC-8 — absent from endpoint, response field, filenames | `V8` | vocabulary |
| AC-9 — **nothing about behavior changes** | the whole behaviour suite, `R1` | both |

**AC-9 is guarded by construction, not by a new assertion.** `shared-by-me`'s `H2` recomputes the
expected row set independently from `/api/strfry/scan`; `H3` grades `published` against the community
relay directly. If the rename alters what the endpoint returns, those fail. `R1` additionally pins
that the tri-state rule in `sharingState.js` is untouched — this story relabels the middle value, it
does not touch how any of the three is computed.

## A test-design decision worth recording

**`V6` scans strings, not comments — deliberately.** The first draft scanned whole lines and
produced **36 hits**, two of which were out of scope:

- `AdoptionQueue.jsx:61` — a comment, "raw wire enumeration offered", about a picker.
- `TrustedDictionary.jsx:15` — a comment about a snapshot being "the dated, TA-signed offering".

Both use the word in ordinary English about other features. A test that forces those to be reworded
would drag scope the story explicitly did not ask for, so `V6` strips comments before matching and
now reports **26 hits**, all genuinely in scope.

**But comments are not exempt from everything.** `V6b` catches the retired *page names*
(`My Offerings`, `Community Offerings`, `MyOfferings`) **everywhere, comments included** — because a
comment naming a page that no longer exists is precisely the rot the previous vocabulary pass had to
sweep twice, once after a review kick-back. The two rules together are the distinction that matters:
*ordinary English in a comment is fine; a dead proper noun is not.*

## Edge cases

- [x] The retired stem must not survive in the **nav or breadcrumbs**, scanned scoped to
      shared-concepts lines so unrelated entries can't false-positive (`V7`).
- [x] The **response field** must be renamed, not just the route (`V8`).
- [x] **Test filenames** are in scope too — this plan renames one (`V8`).
- [x] The three outcome messages must stay **mutually distinct** after rewording — inherited from
      `honest-broadcast-reporting`'s `U5`/`U6`/`U7`, which assert distinctness rather than exact text
      and therefore survive this story untouched.
- [x] `U8` in that suite asserts kept-local carries no failure language and no community-reach claim,
      and that not-delivered offers a retry — all still true of the new wording by construction.
- [ ] **A screenshot-level check that the pages still render** — not covered by either suite;
      belongs to the Implementer's browser verification, as with every previous UI story here.

## Test infrastructure

- **Framework:** the house runner — `node test/test.js`; both suites standalone-runnable.
- **Registration:** five touches each in `test/test.js`; `my-offerings` deregistered as part of its
  rename.
- **Stack:** the behaviour suite's `H*` tests need it and `SKIP` when down; the vocabulary suite is
  entirely static and needs nothing.
- **Fixtures: none minted** in either suite.
- **Firmware:** no reinstall; no concept definitions change.

## How to run

```bash
node test/retire-offering-vocabulary.test.js
```

Full suite — redirect and grep, never pipe through `tail` (OPEN.md row 157):

```bash
npm test
```

## Verification

Confirmed on 2026-08-10 at commit `19c71e88`, stack up at :7778.

**`retire-offering-vocabulary` — 8 failed, 2 passed, 0 skipped.**

```
  ✗ V1   the heading must be named for sharing — got "🤝 My Offerings"
  ✗ V2   the two nav labels must read as a pair … got ["My Offerings","Community Offerings"]
  ✗ V3   the middle state must say it did not REACH the community (story AC-4)
  ✓ V4   the unconfirmed state survives and stays distinct from the failure
  ✗ V5   no outcome message may use the retired vocabulary
  ✗ V6   no user-readable string may use the retired vocabulary — 26 hit(s) …
  ✗ V6b  the retired page names must survive nowhere, comments included …
  ✗ V7   Layout.jsx's shared-concepts entries must not use the retired vocabulary
  ✗ V8   no registered route may carry the retired vocabulary — found ["/api/my-offerings"]
  ✓ R1 (regression) the tri-state itself is untouched
```

**`shared-by-me` (re-aimed) — 13 passed, 1 failed, 0 skipped.** Exactly the intended shape: the
discovery helpers resolve against today's names, so every behaviour test still passes *before* the
rename — which is the point, since they must also pass *after* it. The single failure is `S6`, whose
middle-state pin this phase deliberately re-aimed from `not yet sent` to the new failure wording.

Every failure names the artifact or the string it found, and `V6`/`V6b` list their hits with
`file:line` so the Implementer has a worklist rather than a puzzle.
