# Story 2: The cards ignore an everything entry that goes beyond `*`

**Status:** Approved
**Created:** 2026-10-07
**Type:** Bug
**Epic:** `treasure-map-edit`
**Book:** `engineering-team/audits/treasure-map-edit/book.md`

## Background

The draft Treasure Maps grammar lets an "everything" entry name more after the `*`: a system word (`*:tag`), a
category, a Tag, a metric (`*:rank`, `*:tag:<category>:<Tag>:confidence`). Story 1 taught the cards to read some of
these, and its review found one more case they read wrong (ledger `2026-10-07-card-rule-star-metric-reaches-lists`).

The owner decided that, for now, the page doesn't support these at all (book decision 11). A `*:…` entry that names
anything after the `*` is treated as broken and ignored. Nothing is lost: a `*:…` entry never reaches Concepts, so the
family keys `3038x:<…>` (all Scores) and `3039x:<…>` (all Lists) together reach exactly what it would. Anyone who wants
something more specific writes those. Support may come later.

Nothing in the app writes a `*:…` key today, and the blueprint's Edit mode writes only a bare `*`. So this story mostly
makes the rule smaller before Edit mode builds on it: Edit mode uses the same rule to preview an assignment and to find
the duties an assignment would override.

The draft grammar is a working copy in this repo, so it also records the question the owner is deciding for the app:
is `*:<scope>` needed at all?

## User-facing description

As a person with a Treasure Map, I want the cards to count only the kinds of entry Brainstorm supports, so that an entry
the page doesn't understand never shows up as an Assistant on a card.

## Acceptance criteria

In the examples, A, B, C and D are Assistants; `<X>` and `<Y>` stand for two different categories; `<T>` stands for a
Tag. "Today" is the rule as story 1 left it.

- [ ] **AC-1: an everything entry that names anything after the `*` counts on no card.** Whatever follows `*:`, a
  system word, a category, a Tag, a metric or an empty slot followed by more, the entry counts for Scores, Lists and
  Concepts alike as if it weren't on the Map.

  | Map entries, in this order | Scores | Lists | Concepts | Today |
  |---|---|---|---|---|
  | `*:tag` → D | Not assigned yet | Not assigned yet | Not assigned yet | D on Scores and Lists |
  | `*:rank` → D | Not assigned yet | Not assigned yet | Not assigned yet | D on Scores |
  | `*:contexts` → D | Not assigned yet | Not assigned yet | Not assigned yet | D on Lists |
  | `*:tag:<X>:<T>:confidence` → D | Not assigned yet | Not assigned yet | Not assigned yet | D on Scores and Lists |
  | `*::rank` → D | Not assigned yet | Not assigned yet | Not assigned yet | D on Scores and Lists |
  | `30382:rank` → A, `*:rank` → D | A | Not assigned yet | Not assigned yet | Scores: Mixed (A, D) |
  | `30392` → A, `*:tag` → D | Not assigned yet | A | Not assigned yet | Scores: D; Lists: Mixed (A, D) |
  | `3038x:tag:<X>` → B, `*:tag` → D | B | Not assigned yet | Not assigned yet | Scores: Mixed (B, D); Lists: D |

- [ ] **AC-2: `*:` alone is still `*`.** `*` followed only by empty slots (`*:`, `*::`) is a plain "everything" entry,
  as story 1 made it.

  | Map entries, in this order | Scores | Lists | Concepts | Today |
  |---|---|---|---|---|
  | `*:` → C | C | C | C | same |
  | `*::` → C | C | C | C | same |
  | `3038x` → B, `*:` → C | B | C | C | same |
  | `*` → C, `*:` → D | C | C | C | same (one key; D is a backup) |

- [ ] **AC-3: an ignored entry changes nothing else on the cards.** It hides no other entry and isn't a backup of a
  plain `*`.

  | Map entries, in this order | Scores | Lists | Concepts | Today |
  |---|---|---|---|---|
  | `*:tag` → D, then `*` → C | C | C | C | Scores and Lists: Mixed (D, C) |
  | `*:tag` → D, `3038x:tag` → B | B | Not assigned yet | Not assigned yet | Lists: D |

- [ ] **AC-4: everything without an entry like that is unchanged.** Every example in story 1's AC-3 table, and every
  example in manage-treasure-map #2 AC-2's table except "`*:tag` → D, nothing else" (now AC-1's first row), gives the
  card it gives today. Story 1's AC-1 and AC-2 tables are replaced by this story where they name a `*:…` entry. The
  cards' words, states, order and look don't change. Nothing on the page signs, publishes or stores anything.
- [ ] **AC-5: the draft grammar records the open question.** `protocols/drafts/treasure-maps.md` § 13 (Open questions)
  gains an entry that asks whether `*:<scope>` is needed at all, says why it may not be (`3038x:<scope>` and
  `3039x:<scope>` together reach the same insights, since `*:…` never reaches Concepts), and says that Brainstorm reads
  only a bare `*` for now and ignores `*:…` entries. The draft's grammar and rules don't otherwise change.

## Concepts touched

The stack wasn't running in this session, so no concept handles were checked. No concept definition changes.

- The Treasure Map (kind 10040): read only. Which of its entries count toward each category.

## Out of scope

- **Removing or rewriting `*:…` entries.** This story only stops counting them. Edit mode (story 3) must keep them as
  they are when it saves, under the epic's "keep everything the edit doesn't change" rule; only the backup switch,
  which reaches every key, can drop their backups (book decisions 8 and 11).
- **Showing ignored entries anywhere,** for example as "not supported here" on the Advanced page (a later book).
- **Changing the draft grammar's rules.** AC-5 adds an open question only; `*:<scope>` stays in the grammar until the
  protocol decides.
- **The app's other readers of Map keys** (the TA Treasure Map page, the My Assistants page's Duties tab): unchanged.

## Open questions

None.

## Resolved at the story gate

Approved as drafted, 2026-10-07, verbatim: "Ready for architecture."

## Linked artifacts
- Book decision: `engineering-team/audits/treasure-map-edit/book.md`, decision 11
- Ledger it settles: `ledger/2026-10-07-card-rule-star-metric-reaches-lists.md`
- Replaces in part: `engineering-team/stories/treasure-map-edit/1-the-card-rule-edge-cases.md` AC-1 and AC-2
- ADR: `engineering-team/decisions/treasure-map-edit/0002-only-a-bare-star-counts.md`
- Test plan: `engineering-team/stories/treasure-map-edit/2-the-cards-ignore-scoped-star-entries.test-plan.md`
- Review: (filled in after Review phase)
