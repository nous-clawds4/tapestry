# Story 6: Update list publishes what I approved

**Status:** Done
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
- The endpoint's other non-strict callers (OPEN.md row 314), and the presence probe's EOSE gap (row 292).

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

## Deviations
A separate Implementer agent wrote the code from ADR 0006 (with Amendment 1) and the tests at `126f3f8a`, not from the
Tester's sketch. These are the calls it made where the ADR or the tests left room:
1. **The Origin guard compares host names, not host and port** (§1, guard 1). nginx forwards `Host $host`, without the
   port, and the UI's dev proxy rewrites Host (`changeOrigin: true`). A port-sensitive check would refuse every browser
   publish behind nginx on a non-default port. An Origin that doesn't parse, `null` included, is refused.
2. **Guard 4's order.** A malformed body gets 400, then another user's list 403, then more than 50 intents 413. The
   upgrade counts toward the 50; the browser sends it alone anyway. `validateUpdateBody` returns the validated body with
   its 413, so the handler can check the list's owner first.
3. **A header that names no one shared list gets 409 `{ stale }`** (§2 says "refused"). That covers none in either
   place, the marker alone, two real links, and a real link that isn't a kind-39998 coordinate. The browser then shows
   the fresh preview, which names the header's problem.
4. **Two stale checks beside §2's.**
   - A copy whose derived address already holds an item that isn't a copy (no `q`) is stale, as well as one that holds a
     copy of that version. This is Amendment 1's "Update never touches a hand-added item", applied to the copy's address.
   - A refresh whose copy already carries that version's `q` is stale: the refresh is already done (AC-4).
5. **Publishing.**
   - The relays still get an event whose local import failed (the test plan leaves this open); each place is reported
     on its own.
   - A relay gets one connection per call (`Relay.connect`, then `publish`), at most 4 in flight. So a dead relay in
     `aDListRelays` costs one connection attempt, not one per event. *(Corrected after review round 1: that alone doesn't
     keep a call inside nginx's 60 seconds; ADR 0006 Amendment 2 adds the deadline that does.)*
   - The real `scan` rejects on a non-zero exit, where the header endpoint's `scanLocal` ignores it.
6. **Read-back** (§4).
   - A place that took an event but couldn't be read back is `failed`, "sent, but couldn't read it back: <reason>". §4's
     statuses have no word for "unconfirmed".
   - A deletion's copy is re-read once per place, by the deleted copies' d-tags. A version still counts as there if its
     id was named or it is no newer than the request. If that read fails, `copy` is left unset.
7. **Limits.** Only Amendment 1's three reads carry `limit: 500`. The header read (one address) and the by-id
   read-backs carry none.
8. **The re-check waits for fresh reads** (§7, steps 1–2).
   - `useListItems` now reports `loading` until the current key's read is in. Before, it kept the old lists and said
     "not loading" in the render right after a key change.
   - The plan is fed only reads that are in for the current epoch.
   - The detail page's `headerState.state` is `checking` while the header lookup re-reads.

   Without these, the fresh plan could settle on answers read before the press.
9. **The deletion-request read** is a local hook in the items module (note 4 places it there).
   - A failed or capped source shows "⚠️ Couldn't check …" above the table, so a missing flag never reads as "no
     deletion requested". The ADR names no such line.
   - A copy is flagged when a request names its id, or its address with the request's `created_at` at or after the
     copy's (NIP-09). So a copy re-made after an old deletion isn't flagged.
   - The flag's place is "this instance" when any version came from this instance's strfry, else the list's relay.
     `lookupListItems` records only `local`, so a copy that both places still show names this instance.
10. **The browser's words beyond §7's.** A whole call refused other than by 409 reads "⚠️ Publishing stopped: <reason>",
    and a 503 reads "⚠️ Publishing stopped — couldn't check …". The upgrade's result is named "your assistant's header".
    Closing the preview clears a run that isn't sending, so reopening it never sends an old approval.
11. **The panel keeps its second sentence**, "Revoke or hand-edit before adding this one.", after the new 409 sentence
    (§9). AC-10 keeps the panel as it is otherwise.
12. **Not done:** §10's optional scratch-stack check of the local `a` form. The brief ruled out Docker.
13. **Local check (2026-09-13, the orchestrator, ADR note 6).** The three server files and the UI build were deployed to
    the local container. `brainstorm` was restarted after the other local sessions were warned.
    - **The route, live.** From inside the container, past the global middleware:
      - a foreign `Origin` gets 403, "a request from another site is refused";
      - no session gets 401.

      From the host, an unauthenticated POST gets the middleware's 401 first. Nothing was signed.
    - **The UI, through the fetch stub.** Signed in as staging's customer (assistant `253d40c4…`), on `dog-breed`, under
      Trust Everyone at cutoff 1. The stub answered the update endpoint itself.
      - The preview proposes Copy (2) and the upgrade, and offers "Publish these changes". Story 5's closing line is gone.
      - Pressing it sent two calls, references only: the two copies with their version ids, then the upgrade alone
        (`dropsMarker: false`).
      - Each answer rendered as §7 says:
        - published;
        - partial: "failed: connection failure: …" and "sent, but … didn't keep it";
        - stale: "The list changed since you pressed Publish; here is the new preview.";
        - couldn't-check: "⚠️ Publishing stopped — couldn't check the shared list on the community relay."
      - A refused first call stopped the run: the upgrade's call was never sent.
      - Nothing else was posted, and the browser's settings were restored afterwards.
    - **Not checked live:** a real publish. It writes to the public community relay, so it is the operator's call (§10).
14. **Regression (2026-09-13).** Full `npm test` at `24a4c447`.
    - This story's suites pass:
      - publish 50/0;
      - update-preview 34/0;
      - curation-method 24/0;
      - items 23/0;
      - read-only 13/0;
      - the header endpoint 29/0;
      - the DList Curation panel 18/0.
    - What still fails is the known set: OPEN.md row 191's four and `summaries-element-count` L5.
    - `most-pinned-tag-index-publish` passed this time (row 293 is flaky).
    - Publish suites whose preconditions weren't met were skipped, as usual.

For ADR 0006 Amendments 2 and 3, the same separate Implementer agent wrote the code from the amendments and the tests at
`5bc766b1`. These are its calls where they leave room:

15. **With no time left, a read-back isn't started** (Amendment 2 allows skipping it or racing it). The place is "sent,
    but couldn't read it back: out of time".
    - With time left, each read-back read is raced against a timer for the time left when it starts. That covers the
      read by ids and a deletion's copy re-read.
    - A read that loses is abandoned. It runs on to its own timeout, and its answer is dropped.
16. **A deletion's copy re-read that runs out of time** leaves the place as the read by ids found it, `published`, with
    no `copy`. This is Deviation 6's rule for a failed re-read.
17. **Signing.** Every write is still signed before the first send, even when the reads have already used up the time.
    An event that is never sent stays in memory, and the answer carries only its id. So the results keep one row per
    write.
18. **Where the cutoff is checked.** It is checked before each import here and each relay send, when that send's turn
    comes. That includes a send queued behind the 4 in flight.
    - A send starts only while less than 25 000 ms have passed since the handler started.
    - Imports here still run one after another, and the groups keep their order. So once the cutoff passes, every later
      send is "not sent", and the header upgrade never goes out ahead of copies that didn't.
    - Under the local-only policy, the relay rows stay `skipped`.
19. **The narrowed read** is one `#a` read per place, beside the reads of my header and my list. Its addresses are the
    copies', then the refreshes', de-duplicated. Its gap words are unchanged, so a capped answer still reads "every
    deletion request by your assistant (more than one read returns)", although it now counts only the requests for this
    call's copies.
20. **`updateAnswer`.**
    - A body counts as the endpoint's only when it is an object.
    - An `error` that is empty, or isn't a string, gives "the server answered <status>".
    - A 503's `reasons` are its `couldntCheck` as sent.
21. **`publishIntents`.**
    - A body that isn't JSON, or a connection dropped while the body is read, counts as no body. A 200 then reads "the
      answer couldn’t be read".
    - The run stops at the first answer that isn't results, whatever its kind, and keeps the earlier calls' results.
    - The list is read again after every run, as before.
22. **The unknown sentence** follows the other refusal lines, under the heading "What was published" and any results the
    earlier calls returned. "Nothing was published." shows only when no call returned results and the outcome isn't
    unknown.
23. **Local check for Amendments 2 and 3 (2026-09-17, the orchestrator).** `update.js` and the UI build were deployed
    to the local container, and `brainstorm` was restarted; no other local sessions were active.
    - **The route, live.**
      - From the host, an unauthenticated POST gets the auth middleware's
        `401 { error: "Authentication required for this action" }`, with no `success: false`. That is the case
        Amendment 3 covers.
      - From inside the container, past that middleware, a foreign `Origin` still gets 403, and no session gets the
        handler's 401. Nothing was signed.
    - **The UI, through the fetch stub.** Signed in as staging's customer (assistant `253d40c4…`), on `dog-breed`, under
      Trust Everyone at cutoff 1, the preview proposed Copy (2) and the upgrade. The stub answered each update call
      itself:
      - **a 504 on the first call:** "⚠️ Publishing stopped without an answer (the server answered 504); some changes
        may have been published. Your list has been read again, so the preview above proposes only what is still to
        do." There was no "Nothing was published.", and the upgrade's call was never sent;
      - **the copies published, then a 504 on the upgrade's call:** the two copies were listed, then the same sentence,
        with no "Nothing was published.";
      - **a failed fetch:** the same sentence, with "(no answer arrived)";
      - **the middleware's 401:** "Nothing was published." and "⚠️ Publishing stopped: Authentication required for this
        action";
      - **results out of time:** "failed: not sent: out of time" and "failed: sent, but couldn't read it back: out of
        time" at the relay, and the run went on to the upgrade's call;
      - **round 1's published and stale answers** rendered as before.
    - Every call carried references only. Nothing else was posted, and the browser's settings were restored afterwards.
    - **Setup notes.**
      - The detail page's route is the Map entry's `39998:dog-breed`, not the header's coordinate.
      - The page's Map read was answered with the customer's real Map event, fetched from the general-purpose relays
        just before.
24. **Regression (2026-09-17).** Full `npm test` at `f0abfb3c`.
    - **This story's suites pass:** publish 69/0; update-preview 34/0; curation-method 24/0; pointer-switch 12/0;
      read-only 13/0.
    - **So do the neighbouring suites:**
      - the header endpoint 29/0, the DList Curation panel 18/0, map entries 14/0, merge-preserve 16/0, and the TL panel
        19/0;
      - My Curated DLists' page 19/0, headers 16/0 and items 23/0.
    - **What still fails** is the known set, the same as round 1's run: OPEN.md row 191's four, and
      `summaries-element-count` L5.
    - `most-pinned-tag-index-publish` passed (row 293 is flaky). 56 tests were skipped, as in round 1.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0006-update-publishes.md`
- Test plan: `engineering-team/stories/curated-dlist-update/6-update-list-publishes.test-plan.md`
- Review: `engineering-team/reviews/curated-dlist-update/6-update-list-publishes.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
