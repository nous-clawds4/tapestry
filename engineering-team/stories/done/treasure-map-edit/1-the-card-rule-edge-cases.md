# Story 1: The cards' counting rule follows the draft grammar in three edge cases

**Status:** Done
**Created:** 2026-10-07
**Type:** Bug
**Epic:** `treasure-map-edit`
**Book:** `engineering-team/audits/treasure-map-edit/book.md`

> **Replaced in part (2026-10-07):** the rows of AC-1 and AC-2 that name a `*:…` entry. By book decision 11 such an entry
> counts on no card; see story 2, `2-the-cards-ignore-scoped-star-entries.md`.

## Background

The **Assistants by category** cards on `/treasure-map` (manage-treasure-map #2) list every Assistant a person's
Treasure Map would ask for some insight in Scores, Lists or Concepts. A broad entry counts unless a more specific entry
covers it completely (that book's decision 9). Story 2's review found three cases where the cards' rule disagrees with
the draft Treasure Maps grammar (`protocols/drafts/treasure-maps.md` § 4.4, § 4.5, § 4.7, § 6), so a card can read
**Mixed** when the Map gives the category to one Assistant (ledger `2026-10-07-treasure-map-card-rule-edge-cases`):

1. **A broad entry hidden by a shorter one.** The rule hides a `*:<rest>` entry only behind an entry with the same
   rest (`3038x:<rest>`), not behind a shorter one that already covers it (`3038x:tag` covers `*:tag:<X>`), nor
   behind the same entry written with an empty last segment (`3038x:tag:`).
2. **System words by family.** `*:rank` names a Score metric, so it reaches only Scores, but it also counts on Lists.
   `*:contexts` is Lists-only, but it also counts on Scores.
3. **Two spellings of one key.** `39998` and `39998:dlist-header` are one key, as are `*` and `*:`. The rule counts
   each spelling's first Assistant, so a backup Assistant shows as a second one.

No Map the app writes today has these keys, so nobody sees a wrong card yet. This book's Edit mode will show what an
assignment changes through the same rule. Every case it gets wrong would then also show on the cards while someone is
editing, so the rule is fixed first (book decision 6).

## User-facing description

As a person with a Treasure Map, I want each category card to name exactly the Assistants other apps would ask for
something in that category, so that a card reads Mixed only when the Map really splits the category.

## Acceptance criteria

In the examples, A, B, C and D are Assistants; `<X>` and `<Y>` stand for two different categories (a DList's naddr,
say); `<T>` stands for a Tag. Each row names the Scores card unless it says otherwise. "Today" is the rule before
this story.

- [ ] **AC-1: a broad entry counts only where nothing more specific covers it.** A `*:…` entry doesn't count for
  Scores when a `3038x…` entry reaches every Score the `*` entry could reach: every segment the `3038x` entry names is
  named the same in the `*` entry. A segment left empty, or left off the end, means "any", as in the draft's § 4.4.
  Likewise for Lists with `3039x…`. A single kind (`30382:rank`) never covers a whole family, so it never hides a `*`
  entry.

  | Map entries | Card | Today |
  |---|---|---|
  | `3038x:tag` → B, `*:tag:<X>` → D | B | Mixed (B, D) |
  | `3038x:tag:` → B, `*:tag:<X>` → D | B | Mixed (B, D) |
  | `3038x:tag::<T>` → B, `*:tag:<X>:<T>` → D | B | Mixed (B, D) |
  | Lists: `3039x:dlist` → B, `*:dlist:<X>` → D | B | Mixed (B, D) |
  | `3038x:tag` → B, `*:tag` → D | B | B |
  | `3038x:tag:<X>` → B, `*:tag` → D | Mixed (B, D): D still reaches tag-based Scores outside `<X>` | same |
  | `3038x:tag:<X>` → B, `*:tag:<Y>` → D | Mixed (B, D) | same |
  | `30382:rank` → A, `*:rank` → D | Mixed (A, D): `*:rank` also reaches other Score kinds' `rank` | same |

- [ ] **AC-2: a `*:` entry reaches only the families its system word allows** (the draft's § 4.3 and § 4.7). The word
  after `*:` decides:
  - `tag`, `pin` or `dlist`: Scores and Lists;
  - `contexts`: Lists only;
  - any other word is a metric (`rank`, `followers`, …): Scores only.

  A `*:…` entry still never counts for Concepts, and a bare `*` still counts for all three.

  | Map entries | Scores | Lists | Concepts | Today |
  |---|---|---|---|---|
  | `*:rank` → D | D | Not assigned yet | Not assigned yet | D on Scores and Lists |
  | `*:contexts` → D | Not assigned yet | D | Not assigned yet | D on Scores and Lists |
  | `*:pin` → D | D | D | Not assigned yet | same |
  | `30392` → A, `*:rank` → D | D | A | Not assigned yet | Lists: Mixed (A, D) |
  | `3038x` → B, `*:contexts` → D | B | D | Not assigned yet | same |

- [ ] **AC-3: two spellings of one key count as one key.** Two entries with the same key, however it's spelled, have
  one Preferred Assistant, the first listed, and the rest are backups that don't show (as for any repeated key
  today). The same key, spelled two ways:
  - `39998` and `39998:dlist-header` (the draft's § 4.5, the legacy spelling);
  - for every key except a Concept's, the key with empty segments added at the end, or taken off it: `*` and `*:`,
    `3038x:tag` and `3038x:tag:`, `30396:tag` and `30396:tag::`.

  A Concept key keeps its `d` tag exactly as written (the draft's § 4.5), so `39998:dog-breed` and `39998:dog-breed:`
  are two Concepts.

  | Map entries, in this order | Card | Today |
  |---|---|---|
  | Concepts: `39998` → A, `39998:dlist-header` → B | A | Mixed (A, B) |
  | Concepts: `39998:dlist-header` → B, `39998` → A | B | Mixed (B, A) |
  | `*` → C, `*:` → D | C, on all three cards | Mixed (C, D) on all three |
  | `3038x:tag` → B, `3038x:tag:` → D | B | Mixed (B, D) |
  | Concepts: `39998:dog-breed` → A, `39998:dog-breed:` → B | Mixed (A, B) | same |

- [ ] **AC-4: everything else is unchanged.** Every example in manage-treasure-map #2 AC-2's table gives the card it
  gives today. The cards' words, states, order and look don't change. The loading, error and no-Map states don't
  change. Nothing on the page signs, publishes or stores anything.

## Concepts touched

The stack wasn't running in this session, so no concept handles were checked. No concept definition changes.

- The Treasure Map (kind 10040): read only. Which of its entries count toward each category.

## Out of scope

- **Other spellings the draft treats as one:** naddrs or nevents that encode one coordinate in different ways (the
  draft's § 4.1 canonical forms), and percent-encoded categories. Nothing writes naddr keys today. They belong in the
  single key parser ADR manage-treasure-map/0002 expects once the draft grammar is ratified.
- **Keys the draft grammar doesn't allow** (an empty system slot such as `*::rank`; a metric on a List kind such as
  `3039x:rank`): counted as they are today.
- **The app's other reader of Map keys** (the TA Treasure Map page, the My Assistants page's Duties tab): unchanged.
- **Showing backup Assistants on the cards:** still not shown (manage-treasure-map's `prd-seed.md` § 7).
- **Edit mode:** this book's later stories.

## Open questions

None.

## Resolved at the story gate

Approved as drafted, 2026-10-07, verbatim: "Ready for Architecture."

## Linked artifacts
- Ledger: `ledger/2026-10-07-treasure-map-card-rule-edge-cases.md`
- Found in: `engineering-team/reviews/done/manage-treasure-map/2-the-assistants-by-category-cards.md` § Findings,
  non-blocking 1–3
- ADR: `engineering-team/decisions/done/treasure-map-edit/0001-the-card-rule-compares-keys-segment-by-segment.md`
- Test plan: `engineering-team/stories/done/treasure-map-edit/1-the-card-rule-edge-cases.test-plan.md`
- Review: `engineering-team/reviews/done/treasure-map-edit/1-the-card-rule-edge-cases.md`
