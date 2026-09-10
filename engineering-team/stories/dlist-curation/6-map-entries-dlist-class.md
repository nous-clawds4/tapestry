# Story 6: Map Entries — classify, label, verify, and link per-DList curation entries

**Status:** Approved
**Created:** 2026-09-10
**Type:** Feature

## Background
Map Entries (tl-treasure-map #2, `TreasureMapTagsPanel`) renders one row per Treasure Map tag,
classified by `classifyEntry` into Trusted Assertion, Trusted List, or "other", with the
delegate's avatar and the "Your assistant" / "external" badge. Since story 5 a Map can carry
per-DList curation entries — `["39998:<d-tag>", <assistant>, <relay>]` (kind 39998 or 39999) —
and today they render as "other", with no name, no link, and no way to tell whether the header
the entry addresses actually exists. The acceptance frame's last non-optional bullet is exactly
this: DList entries display with the DList's name, the community header they point to, a link to
the DList's page, and a warning when the assistant's header is missing from local strfry and the
hinted relay.

Carried forward from review #5: duplicates of one `<kind>:<d-tag>` resolve first-occurrence-wins
(ADR 0002 §5); the DList detail route parses only `39998:`/`9998:` ids, so a kind-39999 coordinate
would not resolve today; the other assistant's short pubkey should be visible inline, not only in a
tooltip. The blanket designation entry `39998:dlist-header` (assistant-designation draft) is a
different thing from a per-DList entry and must not be mislabeled as one.

## User-facing description
As a signed-in user reading my Treasure Map, I want each DList I have empowered my assistant to
curate to show up in Map Entries as what it is — the list's name, whose assistant holds it, the
community list it inherits from, a link to its page — and to be warned when the header the entry
points at cannot be found where the Map says it should be, so that my Map never silently advertises
a curation that does not exist.

## Acceptance criteria
- [ ] **AC-1 (classification).** A tag whose first element is `<kind>:<d-tag>` with kind 39998 or
      39999, a non-empty d-tag, and a valid 64-hex delegate classifies as a **Curated DList**
      (class `dlist`); `39998:dlist-header` classifies as the **TA designation** (class
      `designation`); a bare `39998` / `39999` (no d-tag), an entry without a valid delegate, and
      every other kind keep today's classification (the story-2 pins hold unchanged).
- [ ] **AC-2 (the row).** A Curated DList row shows the raw first element, the label
      "Curated DList", the d-tag, the delegate's avatar linked to their profile as today, the
      "Your assistant" badge when the delegate is the signed-in user's assistant and otherwise an
      "external" badge **with the short pubkey inline**, and the relay hint. The TA-designation row
      shows the label "TA designation" and the delegate as today.
- [ ] **AC-3 (the header, verified).** For each Curated DList row the panel looks up the header
      `<kind>:<delegate>:<d-tag>`: first in local strfry, then — only when missing locally — on
      the row's relay hint. When found: the header's name (its `names` tag, else the d-tag) and a
      link to the DList's page that resolves for both kinds; and the community header it inherits
      from — the target of its `b` tag — shown as its short coordinate with a link to that list's
      page and the `b` type when present. When found in neither place: a visible warning naming
      where it was looked for ("not found locally or on <relay>"; "not found locally; no relay
      hint" when the hint is empty).
- [ ] **AC-4 (duplicates).** When the Map carries more than one entry for the same `<kind>:<d-tag>`,
      the first is the effective one and every later one is marked "duplicate — ignored" (ADR 0002
      §5, first occurrence wins); the lookup runs once per effective entry.
- [ ] **AC-5 (baseline).** Badges are judged against the signed-in user's assistant, never the
      instance owner's, and no badge renders until that assistant has resolved — the story-2 rule,
      unchanged.
- [ ] **AC-6 (nothing else moves).** Trusted Assertion, Trusted List, and other rows render as
      today; the story-2 suite's assertions hold; the Trusted Lists panel, the DList Curation
      panel, relay presence, the raw toggle, and the hand-edit panel are untouched; if the DList
      detail route is extended to resolve kind-39999 coordinates, its existing 39998/9998 and
      event-id behavior is unchanged.

## Concepts touched
- `39998:<TA>:shared-concept` — shared concept (the community headers the entries inherit from)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the delegate the badge is judged against)

## Out of scope
- Adding, replacing, or revoking entries from Map Entries (the DList Curation panel's job).
- Verifying the *community* header's presence (only the assistant's header is looked up).
- The merge-preserve fix (7); the shared-disclosure chore; the `inherit-items` resolver.
- Any change to what the panel shows for Trusted Assertion / Trusted List rows.

## Open questions
None the PO holds. Decision points for the ADR: whether `classifyEntry` grows the two classes or a
sibling classifier does; how the kind-39999 link resolves (extend the detail route's id parser vs
omit the link for 39999); how the two-step lookup is batched.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
