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

Resolved at the Test Design gate (2026-09-12), each as recommended:

4. **An unreachable relay.** `/api/relay/external` answers a relay that refuses the connection as an empty
   success, so the page cannot tell it from "no votes" or "nobody is ranked" (OPEN.md row 245's cause).
   - AC-4's "couldn't check" covers every failure the page can see.
   - This one is accepted here, because the page only reads.
   - It is filed as OPEN.md row 280, for story 5 to settle before Update proposes a deletion.
5. **Simple Lists' one change.** A vote whose first `e` tag names an inherited property (such as `constructor`
   or `__proto__`) crashes Simple Lists' items page today. With the shared rule, the vote is ignored instead
   (AC-5).

Origin drift at planning: the branch is 13 commits behind `origin/staging` (sandbox-security work, and OPEN.md
rows that collide with this book's), none of them in this story's areas. The merge waits for the staging PR.

## Deviations

- **Implementation (2026-09-13):** `DListItems.jsx` imports three of the shared functions, not the ADR's four: once its reactions map comes from `reactionsByItem`, `classifyReaction` has no call site there, and an unused import would be dead code.
- **Implementation (2026-09-13):** the shared rule's never-throws guards read a non-string reaction content as "other", a missing or non-array reactions list, tag list or weights as empty, and skip a tag that isn't an array when finding the first `e`. None changes a well-formed input's result (U5's 500 cases pin that); the one behaviour change is the crafted `e` naming an inherited property, now ignored (Open question 5).
- **Implementation (2026-09-13):** "the shared list read cleanly" (ADR §7) is read as the items section's existing test for showing candidates — not failed on both sources — so a partial read, shown with its source note, still judges the candidates it found.
- **Implementation (2026-09-13):** two summary cases the ADR doesn't name: while the shared list is loading the panel says "⏳ Checking…", and when it couldn't be read on either source it says "Verdicts incomplete — couldn’t check the shared list." The "Turn on …" hint would be wrong with the box on.
- **Implementation (2026-09-13):** the trust weights are read once the votes are in, for the candidates' authors and every voter; reading the authors' weights first would mean a second read when the votes arrive. `useItemVotes` returns an answer only for the exact ids it read (null otherwise), so a new candidate is never judged on votes read for other ids.
- **Implementation (2026-09-13):** `lookupItemVotes` with no ids answers `local: 'ok'` and `relay: 'ok'` (`'skipped'` for a non-ws relay) — nothing was asked and nothing failed; the ADR names only the no-read.
- **Implementation (2026-09-13):** the reasons complete "couldn’t check …": "this instance’s strfry", "the community relay", "every vote (there are more votes than one read returns)" and "the trust weights (<error>)", joined with "and". A decided verdict's `reason` is null — its score, the cutoff and the breakdown are the reason.
- **Implementation (2026-09-13):** display choices the ADR leaves open: numbers show at most three decimals; the reason names voters by short pubkey; the Trusted List method with no list chosen reads "no list chosen"; the Verdict column appears only while candidates are being judged.
- **Authorship.** A separate Implementer agent wrote the code in its own git worktree, from the ADR and the story. The tests (`b0fdea2e`) are the Tester's. The Test Design sketch was deleted before Implementation started (story 3's review, Harness friction 1).
- **Local check (cycle-local), 2026-09-13.** This was a UI-only change: the build (`index-B_BqLgJw.js`) was copied into the container, which is not bind-mounted, with no restart. The served bundle carries the panel's new lines and not the placeholder's.

  I signed in through the fetch stub as staging's customer `0f6c8526…`. Their assistant is `253d40c4…`, and their real Map names it for `dog-breed`. The stub let through only the read-only Cypher POST and blocked every other write. None was attempted.
  - **My own list, the default method** (Trusted Assertions (rank), point of view Nous `15f7dafc…7270`):
    - Both local candidates, sheep dog and golden retriever, read "✗ skipped · 0 < 2", and the summary "0 of 2 candidates qualify".
    - A candidate's reason shows the author's implicit upvote with "Trust weight unknown".
    - The votes were read once from each source, local strfry and `wss://dcosl.brainstorm.world`, with one filter carrying both ids and limit 5000. The weights were read for the author.
  - **Cutoff 0:** "✓ qualifies · 0 ≥ 0" and "2 of 2", at once. The value is stored under `tapestry_curation_cutoff:<my header's coordinate>`, and it is still 0 after a reload.
  - **Trust Everyone:** each score is 1. At cutoff 2 both read "✗ skipped · 1 < 2" ("0 of 2"); at cutoff 1, "✓ qualifies · 1 ≥ 1" ("2 of 2").
  - **Simple Lists' items page** for the same list, before and after the build:
    - under the default method, 0.000 both times;
    - under Trust Everyone, 1.000 both times;
    - "Items qualifying: 0 of 2 (score ≥ 2)" both times.
  - **Read-only** (no assistant on this instance): no method panel. With candidates on there is no Verdict column, and no vote or weight read.
  - The browser's Trust Determination setting and the check's cutoff were removed afterwards.
- **Regression (2026-09-13).** The full `npm test` was run from the worktree: 167 suites passed, 4 failed and 4 were skipped.
  - **Five failing tests, none new:**
    - four are exactly OPEN.md row 191's: three L0 GUARD refusals and the refused prune. This machine publishes externally, by the operator's choice;
    - the fifth is `summaries-element-count` L5, already red in the baseline taken before any code change. Its control concept, `firmware concept`, gained a subset from another session on 2026-09-12, and that session is re-aiming the control.
  - **Compared with the baseline,** only three things changed:
    - this story's suite: 22 failing → all 24 passing;
    - two publish-flow suites, `tag-detail-publish` and `tag-index-publish`, were skipped because Meilisearch's task queue was busy when they set up;
    - one more of row 261's LB-matrix tests was skipped.
  - harness-lint is clean.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0004-curation-method-and-verdicts.md`
- Test plan: `engineering-team/stories/curated-dlist-update/4-curation-method-panel.test-plan.md`
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
