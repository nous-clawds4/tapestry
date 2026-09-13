# Story 5: Update list shows what my assistant would do, built only from reads it could complete

**Status:** Approved
**Created:** 2026-09-13
**Type:** Feature

## Background
My Curated DLists' Update list button is still a disabled placeholder: "Update list isn't built yet". Story 4 made the
Curation method panel show which candidates qualify, and why. This story makes Update list show what my assistant would
do with those verdicts, before anything is signed. In story 6, my assistant carries out what I approve.

The operator settled the convention at kickoff (the epic, § "Settled at kickoff"):
- **A copy** is my assistant's own item on my curated list, pointing back at its original.
- **Removal** is my assistant's deletion request.
- **When the original changes:**
  - edited → the copy stays, and Update offers a refresh;
  - downvoted or disputed → the method decides again;
  - not found → the copy stays, flagged.
- **Update** runs only when I press it, and shows a preview first. It uses the method, point of view and cutoff that the
  Curation method panel shows, and none of them is written onto the header.
- **A failed or incomplete read proposes nothing, never a deletion.**

**Reads that come back incomplete today without saying so.** Story 4's page only reads, so these were accepted there and
carried here (the epic's story 5 entry):
- an unreachable relay answers as "nothing there" (OPEN.md row 280), which reads as "no votes" or "nobody ranked";
- a shared list read from only one of its two sources still gives an "N of M" that looks complete;
- with the Follow List method, a point of view with no follow list on this instance reads as "follows nobody";
- a relay answer cut off at the read limit isn't reported as cut off;
- a list with more than about 110 candidates can't be checked at all.

My assistant's header may still use the older link type. Story 2's note promises that Update will upgrade it to
"pointer".

## User-facing description
As a user whose assistant curates a community list for me, I want Update list to show me exactly what my assistant would
copy, refresh, delete and upgrade, and why, built only from reads it could complete, so that I can trust what I approve.
My assistant signs and publishes it in story 6.

## Acceptance criteria
- [ ] **AC-1 (Update list opens a preview on my own list).** On a list my assistant here curates, Update list is enabled.
      - Pressing it shows the preview on the page.
      - Opening, closing or reloading the preview signs, publishes and writes nothing.
      - On a list curated by another assistant (story 3), Update stays disabled, as today.
- [ ] **AC-2 (what the preview is based on).** At the top, the preview names:
      - the Scoring Method, with the chosen Trusted List when that method is chosen;
      - the point of view;
      - the cutoff.

      These are the ones the Curation method panel shows. The preview says they apply in this browser and are not written
      onto the list.
- [ ] **AC-3 (what it proposes).** Grouped, with each item named:
      - **copy:** each candidate that qualifies and that my assistant hasn't copied;
      - **refresh:** each copy whose original was edited since it was copied, when the new version qualifies;
      - **delete:** each copy whose original no longer qualifies;
      - **keep, flagged:**
        - each copy whose original can't be found;
        - each copy whose original was edited, when the new version doesn't qualify. The copy stays as it is;
      - **upgrade:** when my assistant's header uses the older link, a line saying Update will switch it to "pointer";
      - **skipped:** each candidate that doesn't qualify, with its score against the cutoff.

      When there is nothing to do, it says the list is up to date.
- [ ] **AC-4 (a failed or incomplete read proposes nothing).** If any read the preview depends on failed or came back
      incomplete, the preview proposes nothing — no copy, refresh, deletion or upgrade — and says what couldn't be read.
      This includes:
      - this instance's strfry or the community relay failing, or refusing the connection;
      - the shared list read from only one source, or cut off;
      - my list's own items and copies, read the same way;
      - the votes, including an answer cut off at the read limit;
      - the trust weights, including:
        - a Follow List point of view with no follow list here;
        - a rank provider that can't be reached;
      - a list with hundreds of candidates: the preview covers them all, or proposes nothing.
- [ ] **AC-5 (the same verdicts as the panel).**
      - Each candidate's verdict in the preview equals the Curation method panel's for the same list, method, point of
        view and cutoff.
      - Where the preview proposes nothing because a read failed, the panel shows the same "couldn't check".
- [ ] **AC-6 (nothing else moves).**
      - Nothing runs on a schedule.
      - The method, point of view and cutoff aren't written onto the header.
      - Simple Lists keeps its scores, qualifying items and controls. Where its trust weights couldn't be read, it may now
        also say so.
      - Nothing is signed or published; that is story 6.

## Concepts touched
The TA pubkey is resolved at runtime per deployment.
- `39998:<TA>:list` — list (my curated list, its copies, and the shared list's candidates)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (whose copies and header the preview plans for)
- Votes (kind 7) and deletion requests (kind 5) have no concept handles; the Architect should confirm.

## Out of scope
- Signing and publishing what the preview shows — the copies, refreshes, deletion requests and the header upgrade (story
  6).
- Story 6's other carry-forwards:
  - the "curate it here instead" rule (R2-2);
  - the DList Curation panel's 409 sentence;
  - checking that the relays holding copies honor deletion requests.
- The Trusted List being read by d-tag from any author (a separate task).
- A schedule for Update.
- Writing the method, point of view or cutoff onto the header.
- A copy's `json`, which is derived from the author's graph.

## Open questions
None. Resolved at the Planning gate (2026-09-13), each as proposed:
1. **The epic's story 5 is split in two.** This story is the preview, together with the read fixes its proposals depend
   on. Story 6 carries it out: my assistant signs and publishes what I approved, deletion requests included, along with
   the carry-forwards listed under Out of scope.
2. **"Proposes nothing" means nothing at all.** With any read incomplete, the preview makes no proposal of any kind, not
   even a copy, and says what to retry.
3. **An edited original is judged on its new version.** Its votes restart with the edit (story 4, decision 2).
   - If the new version qualifies, Update offers a refresh.
   - If it doesn't yet, the copy stays as it is, flagged.
   - A copy is never deleted because its original was edited.

Origin drift at planning: the branch is 28 commits behind `origin/staging` (the sandbox-security and event-less-sets
books), and none of them touches this story's areas. OPEN.md rows 276–279 and 281–287 collide with this book's rows; the
merge before the staging PR renumbers them. Before designing story 6's signing, the Architect should read staging's
auth-hardening follow-ups (its OPEN.md row 276) and `SECURITY.md`.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0005-update-preview-and-honest-reads.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
