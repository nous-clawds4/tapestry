# Story 4: The curation method panel shows my method, a cutoff, and each candidate's verdict

**Status:** Approved
**Created:** 2026-09-12
**Type:** Feature

## Background
My Curated DLists' Curation method panel is a placeholder today. It says only that the method "isn't built
yet". Story 5's Update list will copy the candidates that qualify. Before it exists, I need to see which
candidates qualify, and why.

At kickoff the operator settled how that is decided (the epic, § "Settled at kickoff"):
- the same way Simple Lists' "Generate Trusted List" panel decides it;
- with the Scoring Method and point of view I chose on the Trust Determination page. That is my own
  per-browser choice, not the owner-only TL Membership Method, which governs the server's pinned-tag
  Trusted Lists;
- with a cutoff;
- none of which is written onto the list's header.

**How Simple Lists decides today** (found in the Simple Lists items page; nothing in the test suite pins it):
- **A vote** is a kind-7 reaction on the item's event id. "+", 👍 and 🤙 are upvotes; "-" and 👎 are
  downvotes; anything else counts 0.
- **Each voter weighs** what the Scoring Method gives them from the point of view:
  - Trusted Assertions (the default): rank ÷ 100, from the point of view's Treasure Map;
  - Follow List: 1 or 0;
  - a chosen Trusted List: 1 or 0;
  - Trust Everyone: 1.
- **The author** adds an implicit upvote at the author's own weight. If the author's own first reaction is a
  downvote, the implicit upvote is cancelled to 0, never below.
- **Unknown weights.** A voter whose weight is unknown counts for nothing.
- **Qualifying.** An item qualifies when its score is at least the cutoff, which defaults to 2.
- **Kind-39999 items.** Their votes are matched by the current version's id.

**Guardrails from kickoff:**
- A failed or incomplete read proposes nothing.
- Votes are read where the items are: this instance's strfry and the community relay. Simple Lists reads
  one source at a time, chosen by its "Ratings Source".

## User-facing description
As a user whose assistant curates a community list for me, I want to see which candidates my assistant would
copy and why — judged by the same method I use on Simple Lists — so that I can tune the cutoff and trust what
Update list will do.

## Acceptance criteria
- [ ] **AC-1 (the panel shows my method).** On my own curated list's detail page, the Curation method panel
      (closed on every load, as today) opens to show:
      - the Scoring Method chosen on Trust Determination, naming the chosen list for the Trusted List method;
      - the point of view, by name or short pubkey;
      - a link to Trust Determination to change them;
      - a cutoff field, default 2, that I can edit, remembered for this list in this browser (Planning
        gate, decision 1);
      - a line saying the method, point of view and cutoff apply in this browser and are not written onto
        the list.
- [ ] **AC-2 (each candidate's verdict and reason).** With candidates shown, each candidate carries:
      - a verdict — qualifies, or doesn't;
      - its reason: its score against the cutoff, and the votes that made the score. The votes are who voted,
        up or down, with what weight and what contribution, including the author's implicit upvote and any
        unknown weight.

      A summary says how many candidates qualify, as "N of M". The verdicts appear on each candidate row in
      the items table's candidates view; the panel holds the method, the cutoff and the summary (Planning
      gate, decision 3).
- [ ] **AC-3 (decided exactly as Simple Lists decides).**
      - Given the same item, votes, Scoring Method, point of view and cutoff, a candidate's score and verdict
        equal what Simple Lists' Generate Trusted List panel computes for it.
      - A kind-39999 candidate's votes are those on its current version, as Simple Lists counts them
        (Planning gate, decision 2).
      - Editing the cutoff updates the verdicts at once. A new method or point of view chosen on Trust
        Determination applies the next time the page loads.
- [ ] **AC-4 (a failed read decides nothing).** Votes are read from this instance's strfry and the community
      relay together, each vote once. The affected candidates show "couldn't check", with what couldn't be
      read — never "doesn't qualify" — when any of these fails:
      - either votes read fails;
      - the trust weights can't be read, for example because the point of view's Treasure Map or its rank
        provider is unreachable.

      In that case the summary says the verdicts are incomplete.
- [ ] **AC-5 (nothing else moves).**
      - Simple Lists' items page and its Generate Trusted List panel behave exactly as before: the same scores,
        qualifying items, controls and Ratings Source.
      - Trust Determination is only read.
      - A list curated by another assistant (story 3) shows no method and no verdicts.
      - Nothing is signed, published or written: Update list stays disabled (story 5).

## Concepts touched
The TA pubkey is resolved at runtime per deployment.
- `39998:<TA>:list` — list (the curated list and its candidates)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (whose curation the verdicts are for)
- Votes (kind-7 reactions) and the Trust Determination settings have no concept handles; the Architect
  should confirm.

## Out of scope
- Update list and its preview (story 5), and the carry-forward R2-2 recorded there.
- Writing the method, point of view or cutoff onto the header (a later Trust Determination Methods concept).
- Any change to Simple Lists: its rule, its Ratings Source, its publish.
- The owner-only TL Membership Method.
- A schedule for Update.
- The Trusted List publish endpoint's authorization (found in passing; flagged separately).

## Open questions
None. Resolved at the Planning gate (2026-09-12), each as proposed:
1. **The cutoff** is remembered per curated list in this browser, default 2.
2. **Edited kind-39999 originals:** only the current version's votes count, as on Simple Lists. An edit
   therefore restarts an item's votes on both pages alike.
3. **The verdicts** appear on each candidate row in the items table's candidates view. The panel holds the
   method, the cutoff and the "N of M qualify" summary.

Origin drift at planning: the branch is 13 commits behind `origin/staging` (sandbox-security work, and OPEN.md
rows that collide with this book's), none of them in this story's areas. The merge waits for the staging PR.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0004-curation-method-and-verdicts.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
