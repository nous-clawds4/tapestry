# Test plan — author-scoped-inspection #4: mark self-declaration rows

**Story:** `engineering-team/stories/author-scoped-inspection/4-mark-self-declaration-rows.md`
**ADR:** `engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md`
**Suites:** `test/author-scoped-inspection-views.test.js` · `tests/brainstorm/author-scoped-inspection.spec.js`

## Levels and why

This story is almost entirely appearance, and appearance is the one thing source-reading cannot
confirm — so the centre of gravity is **E**, with computed styles read from a real browser. **S**
carries the two things a screenshot cannot prove: that the new component branches are **strictly
opt-in** for the other 24 `DataTable` callers, and that the CSS rules sit after the hover rule by
decision rather than by accident.

## Coverage

| Test | Asserts | AC |
|---|---|---|
| S3 | self-declaration is decided by `dispositionOf`, not a re-derived inline `===` | AC-1 |
| S6 | `DataTable` gains `rowClassName`, guarded so omitting it leaves output byte-identical, and documented | AC-1 |
| S7 | `TagDetailPanel` gains `note`, rendered **after** `<CopyButton>` in the same row | AC-3 |
| S8 | the vars exist; `.row-self-declared` and its `:hover` both come after the base hover rule; an inset rule on the first cell | AC-1, AC-5 |
| S10 | the note reads `* self-declaration`, and `self-referencing` appears in none of the four touched files | AC-3 |
| E10 | a self-declaration row carries the mark; a correspondence row does not | AC-1, AC-2 |
| E11 | the note appears on a self-declaration panel and **not** on a correspondence panel | AC-3, AC-4 |
| E12 | at rest the marked row differs from a plain row; **under the pointer** it differs from a plain hovered row, **and** from its own resting state | AC-5 |

## On AC-5

The criterion was amended at the Architecture gate. The app is dark-only —
`ui/src/styles.css` defines one palette and contains no `prefers-color-scheme` or `data-theme`
rule — so "light and dark" described a theme that does not exist. E12 tests the constraint that
does bite, and it tests it **in both directions**: the base `:hover` rule must not swallow the
mark, and the mark must not swallow the hover feedback. A single-direction test would pass on an
implementation that pinned the row's background and silently removed its hover response.

## Expected before implementation

All **FAIL**. E10 fails against `<tr class="clickable">` — the row exists, the class does not.

## Prerequisites

None.
