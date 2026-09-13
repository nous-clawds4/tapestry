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

## Deviations

- **Implementation (2026-09-13):** `readRelayEvents` opens its subscription with an `eoseTimeout` longer than its query budget. nostr-tools 2.10.4 fires an EOSE of its own after 4.4 s (`baseEoseTimeout`), inside `QUERY_TIMEOUT_MS` (5 s), which would turn "no EOSE within the budget" (ADR §1) into an `ok` answer. The tests' fake relay ignores the option. `probeRelayForEvent` has the same gap and is left as it is (out of scope).
- **Implementation (2026-09-13):** strict mode bounds each relay's read by `FETCH_TIMEOUT_MS` on its own, in parallel, so a slow relay counts as unreachable ("Timeout") while the others' answers are kept; a reader that throws counts as unreachable too. `strict=true` is accepted as well as `strict=1`, as the presence endpoint accepts `full`.
- **Implementation (2026-09-13):** `lookupItemVotes` sends its chunks in parallel, as `lookupListItems` reads its coordinates. A relay answer's cap, for votes (§3) and items (§4), counts the events the relay returned, before any are filtered out. The source note for a capped relay answer reads "Showing the first 500 <items or candidates> from <relay> — there may be more."
- **Implementation (2026-09-13):** one new util helper, `listReadGaps(record, what)`, words a list read's gaps for both §6 (the panel's `incomplete`, from the shared list's record) and §7 (the planner's list reasons): "<list> on this instance’s strfry", "<list> on the community relay", "every item on <list> (more than one read returns)", with "the shared list" (§6's words) or "your list". The planner drops a duplicate reason, so a partial shared-list read named by both the list read and the verdicts shows once.
- **Implementation (2026-09-13):** `candidateVerdicts`' `incomplete` ignores anything that isn't a non-empty string. With the verdicts decided, the incomplete summary keeps its `qualifying` count. When the votes or weights also failed, the summary's reason stays the failed reads alone, as in story 4.
- **Implementation (2026-09-13):** words the ADR leaves open, completing the preview's "couldn’t check <reasons>." (reasons joined with "; "): the header's states read "your assistant’s header", "your assistant’s header (it wasn’t found)", "the shared list (your assistant’s header names none)" and "the shared list (your assistant’s header is marked deliberately unaffiliated)"; its problems read "your assistant’s header (<the problem>)", after the headers section's sentences.
- **Implementation (2026-09-13):** cases the ADR doesn't name, handled so the planner never proposes from something it couldn't judge. A header state it doesn't know reads as `checking`. A candidate or found original with no decided verdict makes the plan `blocked` ("a verdict for every item on the shared list"); only inputs taken from different reads can cause that. A copy whose `q` names neither an address nor an id is kept, flagged, as not found. A copy's address `q` is its first `q` that parses as a kind-39999 coordinate, and its version `q` its first 64-hex one.
- **Implementation (2026-09-13):** an entry about a copy already on my list is named by the copy's own `name` (what my list shows); a candidate by its shared item's. A not-found entry's `routeId` is the copy's address `q` (else its version `q`), with no score. Each group is sorted by name.
- **Implementation (2026-09-13):** display choices. The preview shows only the groups that have items, each "<Group> (<n>)" with a line per item: its name and its score against the cutoff (≥ for copy and refresh, < for delete and skipped), or a kept copy's reason. `unchanged` is in the plan but not shown (the ADR names six groups). The method, point-of-view and cutoff lines repeat the panel's in `UpdatePreview.jsx`, since sharing a component would have meant refactoring the panel. Update list toggles the preview and carries `aria-expanded`.
- **Implementation (2026-09-13):** while candidates or the preview show, the items section reads the votes on every shared item (§8), so the panel alone now reads the copied originals' votes too; its Verdict column still shows only while candidates are shown. On read-only lists the detail page passes `headerState` as null.
- **Implementation (2026-09-13):** §6 is read as written: the panel's `incomplete` comes from the shared list's record only. So when my own list's read fails, the preview proposes nothing, but the panel can still show "N of M candidates qualify", beside the list's source note. AC-5's second bullet may want that read in the panel's summary too; left for the Reviewer.
- **Authorship.** A separate Implementer agent wrote the code in its own git worktree, from the ADR (with Amendment 1) and the tests (`85fbdddf`). No reference implementation was used; the Test Design sketch was discarded.

## Linked artifacts
- ADR: `engineering-team/decisions/curated-dlist-update/0005-update-preview-and-honest-reads.md`
- Test plan: `engineering-team/stories/curated-dlist-update/5-update-list-preview.test-plan.md`
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
