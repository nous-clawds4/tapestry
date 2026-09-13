# Story 6: Update list publishes what I approved

**Status:** Approved
**Created:** 2026-09-13
**Type:** Feature

## Background
Story 5 made Update list show, on my own curated list, what my assistant would do:
- the candidates it would copy;
- the copies it would refresh or delete;
- the copies it keeps, flagged;
- the older header link it would upgrade;
- why each candidate was skipped.

It is built only from reads it could complete, and it signs nothing: "Nothing is signed: publishing isn't built yet."
This story makes it act. When I approve the preview, my assistant signs and publishes exactly what it showed.

The operator settled the convention at kickoff (the epic, § "Settled at kickoff"; ADR 0001):
- **A copy** is my assistant's own item on my curated list. It points back at its original's address and exact version,
  and it carries what the original's author wrote. A repeat Update replaces a copy rather than duplicating it.
- **Removal** is my assistant's deletion request (NIP-09). The original then returns to being a candidate.
- **An edited original** is refreshed at the same address when its new version qualifies; otherwise the copy stays,
  flagged. A copy whose original can't be found stays, flagged.
- **Update** runs only when I press it, with a preview first. The method, point of view and cutoff apply in this browser
  and are not written onto the header.
- **The signer** is the signed-in user's own assistant: the instance's assistant for the owner, and a per-user assistant
  key for everyone else (OPEN.md row 188). Update follows the Simple Lists panel's rule for what qualifies, not its
  signer.
- **A failed or incomplete read proposes nothing, never a deletion.**

Carried into this story (the epic's story 6 entry):
- **Story 2's review** found two things:
  - no rule yet decides how to upgrade a header that carries the "deliberately unaffiliated" marker beside its older
    link;
  - the DList Curation panel's 409 sentence says "pointing elsewhere" for a header that points at the same list with
    another link type.
- **Story 3's review (R2-2):** the "curate it here instead" offer dead-ends for a list whose curating header points at a
  header by my own assistant here, or by my own key.
- **The book's constraint:** check that the places holding copies accept and honor deletion requests, the address form
  included, before Update relies on them.
- **Story 5's review:** re-read my assistant's header before signing its upgrade.

## User-facing description
As a user whose assistant curates a community list for me, I want to approve Update list's preview and have my
assistant publish exactly what it showed — the copies, refreshes, deletions and the header upgrade — and to see what
landed where, so that my curated list matches what I approved.

## Acceptance criteria
- [ ] **AC-1 (one approval publishes the preview).** On a list my assistant here curates, a ready preview that proposes
      something offers one action that publishes all of it.
      - Nothing is signed or published before I press it.
      - A preview that is checking, blocked, or up to date offers nothing to publish, and says why.
      - A list curated by another assistant (story 3) never offers it.
- [ ] **AC-2 (what gets signed is what I approved).** Pressing it first reads everything again, my assistant's header
      included. Only answers it could complete count, as in the preview.
      - If a read fails or comes back incomplete, nothing is signed, and the page says what couldn't be read.
      - If the fresh preview differs from the one I approved, nothing is signed, and the page shows the new preview for
        me to approve.
- [ ] **AC-3 (copies).** Each candidate under "Copy" becomes my assistant's copy on my list, following the settled
      convention.
      - My list then shows it as my assistant's item, and the next preview doesn't propose it again.
      - Approving the same copy twice leaves one copy, not two.
- [ ] **AC-4 (refreshes).** Each copy under "Refresh" is replaced, at the same address, by a copy of its original's new
      version. The next preview doesn't offer that refresh again.
- [ ] **AC-5 (deletions).** Each copy under "Delete" gets my assistant's deletion request.
      - Once the request is honored, my list no longer shows the copy, and its original is a candidate again.
      - Copies under "Keep, flagged", and copies that are unchanged, are never touched.
- [ ] **AC-6 (the header upgrade).** When the preview includes the upgrade, my assistant's header is republished in place
      with the "pointer" link, keeping everything else it says.
      - The header section then no longer says it uses the older link, and the next preview doesn't offer the upgrade.
      - A header that also carries the "deliberately unaffiliated" marker follows open question 2's rule, and the
        preview says so before I approve.
- [ ] **AC-7 (who signs, and who may).** Only I, signed in, can publish Update on a list my assistant here curates.
      - Everything is signed by my own assistant: the instance's assistant if I am the owner, and my own assistant key
        otherwise.
      - Nothing is signed by the Simple Lists panel's signer, and no one else's session can publish for my assistant.
- [ ] **AC-8 (honest results).** After publishing, the page says what happened to each item, per place my list is read
      from (this instance and the community relay): published, or failed with the reason.
      - A partial failure is shown, never hidden.
      - Nothing is retried on its own. Pressing Update list again proposes only what is still missing.
- [ ] **AC-9 (deletions that aren't honored).** If a place still shows a copy after my assistant's deletion request, the
      page says the deletion wasn't honored there. The copy stays flagged on my list until it is gone.
      - Before this story is done, the places holding copies are checked to accept and honor deletion requests, the
        address form included.
- [ ] **AC-10 (safe by default).**
      - Nothing runs on a schedule.
      - The method, point of view and cutoff aren't written onto the header.
      - A failed or incomplete read proposes nothing and publishes nothing.
      - Simple Lists and the DList Curation panel behave as today, apart from AC-11's sentence.
- [ ] **AC-11 (two small fixes carried from earlier reviews).**
      - **The "curate it here instead" offer (R2-2)** follows open question 3's rule when a list's curating header points
        at a header by my own assistant here, or by my own key. It never leads to a refusal.
      - **The DList Curation panel's 409 sentence** names the actual conflict. It no longer says "pointing elsewhere"
        for a header that points at the same list with another link type.

## Concepts touched
The TA pubkey is resolved at runtime per deployment. Both handles exist in this instance's live graph.
- `39998:<TA>:list` — list (my curated list, its copies, and the shared list's items)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (who signs the copies, the deletion requests and the header)
- Deletion requests (kind 5) have no concept handle; the Architect should confirm.

## Out of scope
- A schedule for Update.
- Choosing items one by one (open question 1).
- Writing the method, point of view or cutoff onto the header.
- Undoing a publish, or deleting copies anywhere but where my list is read from.
- The Trusted List being read by d-tag from any author (a separate task).
- A copy's `json`, which is derived from the author's graph.
- The endpoint's other non-strict callers (OPEN.md row 280), and the presence probe's EOSE gap (row 292).

## Open questions
None. Resolved at the Planning gate (2026-09-13), each as proposed:
1. **How I approve.** One action publishes the whole preview as shown. Choosing items one by one can come later.
2. **A header marked "deliberately unaffiliated" that also has the older link** (story 2's review; no live header has
   this shape).
   - Today the endpoint counts the marker as a link, so it calls such a header a conflict. The page lets the real link
     win, and says Update will upgrade it.
   - Update upgrades it to a plain "pointer" header and drops the marker, and the preview says so before I approve.
3. **R2-2, the dead-end offer.** The offer isn't made when the curating header points at a header by my own assistant
   here, or by my own key. The page says why instead.
4. **When publishing partly fails, or a place doesn't honor a deletion.** As AC-8 and AC-9 say:
   - report per item and per place;
   - retry nothing on its own;
   - let the next Update propose what is still missing.

Notes for the Architect:
- ADR 0003 Option C deferred sharing the DList Curation panel's sign-and-publish sequence until Update signs, as a third
  caller. Decide it here.
- Before designing the signing, read staging's auth-hardening follow-ups (staging's OPEN.md row 276) and `SECURITY.md`.
- Story 5's review: throttle the vote chunks if large lists appear (Non-blocking 3).
- Live data:
  - two `dog-breed` headers on the community relay carry the older link: staging's TA `8e901369…` and the customer
    assistant `253d40c4…`;
  - the shared list's two items are only in this Mac Studio's local strfry;
  - the community relay's deletion policy is unchecked, and local strfry has no write policy.

Origin drift at planning: the branch is 40 commits behind `origin/staging`, which holds:
- the sandbox-security, event-less-sets, concept-graph-curation and honest-test-gate work;
- staging's OPEN.md rows 276–291.

The merge before the staging PR renumbers this book's colliding rows (276–279). Rows 280 and 292–294 are clear.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0006-update-publishes.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
