# The Light profile doesn't say whether a Design note may supersede a ratified ADR's decision

**Id:** 2026-10-11-light-note-supersedes-adr
**Type:** meta
**Opened:** 2026-10-11 (`assistant-shared-categories` #1, Gate B review, harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** Story `assistant-shared-categories` #1 ran under the Light profile with a Design note, no ADR. Its
note retired part of ADR `assistant-trusted-content-status/0001`: sub-decision 2's headline and sub-decision 4's "only
others" row and done row, and it added a field to every answer. The ADR got a `> **Superseded in part (2026-10-11):**`
line that points to the story's Design note.

Every earlier "Superseded in part" line in `engineering-team/decisions/` names a superseding ADR (for example
`treasure-map-edit/0001`, which also cites a book decision). `engineering-team/workflows/light-profile.md`'s list of
irreversibility triggers doesn't say whether reversing a ratified ADR's decision is itself one. J1 and the Gate B
Reviewer both ratified the Design-note classification, because no listed trigger fired. But the profile should say.

**Fix shape:** add one line to `light-profile.md` § Gate A's triggers, either way:
- "Reversing a ratified ADR's decision → full ADR"; or
- "A Design note may supersede a ratified ADR in part, and the ADR's superseded-in-part line points to the story."

It is a harness-definition path, so the change owes a CHANGELOG row.

**Recurred 2026-10-12 (`assistant-coming-soon` #1, Gate B review, harness friction 1).** Its Light Design note narrowed ADR
`assistant-identification-tags/0001` sub-decision 6 ("a placeholder ... is marked and counted in both") and adopted
the Option B that ADR `assistant-duty-cards/0001` had rejected, with no pointer on either ADR. On the owner's Gate B
verdict ("pass with the records note") each ADR gained one line pointing to the story: `> **Amended in part
(2026-10-12):**` and `> **Note (2026-10-12):**`. The two Light stories on this hub now record the same situation in
two ways, which strengthens the case for the one-line rule in the fix shape.

**Pointer:** `engineering-team/reviews/done/assistant-shared-categories/1-done-but-shared.md` § Harness friction 1;
`engineering-team/decisions/done/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md`
(its superseded-in-part line).
