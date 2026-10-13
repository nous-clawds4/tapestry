# An independent checker changed a review's verdict-relevant findings, and no workflow asks for one

**Id:** 2026-10-13-review-independent-check-uncodified
**Type:** meta
**Opened:** 2026-10-13 (`duty-menus-and-self-maps` book close, audit §7 P13)
**Status:** DONE
**Done:** 2026-10-13 — operator-ratified harness commit `22948d45` (book `duty-menus-and-self-maps` close, audit §7 P13): `workflows/5-review.md` § Per-phase commits adds the optional independent check, recommended for docs-mode stories, run before the review commits.

From story 2's round 3 on, every review in book `duty-menus-and-self-maps` was checked before commit. Auditor
lenses (five in most rounds: re-derivation, sources, conformance, coherence, intent; four in story 3's round 2)
reported findings, which the Reviewer verified before using them. A separate read-only checker then re-ran the gate, the model scripts and the NIP fetches, and
audited the review's own claims.
- **Story 3, round 1.** The check promoted non-blocking 2 to blocking B2 (an unnamed departure from AC3 under § 9.2
  Ties) and corrected B1's impact (CK-1, CK-2). The owner then named the departure (ADR 0003 A2-4). Without the check,
  the review would have passed an AC it did not meet.
- **The other checks.** Story 2 round 3 (CHK-1, CHK-2), story 3 round 2, story 4 (CHK-1, CHK-2) and story 5 (CK-1 to
  CK-3). Each confirmed the verdict and corrected evidence slips: a false claim about an insisted key, a truncated
  quote, an incomplete gate account, line and commit attributions.
- **The book close.** Three read-only checkers (accuracy, completeness, structure) audited the close before commit.
  All three found that its commit guidance left another book's ticked audit out of the commit, and one found 35
  inbound pointers into the moved folders that the close had left as a convention nothing documents (audit § 5).

Nothing in `engineering-team/workflows/5-review.md`, `engineering-team/roles/reviewer.md` or
`.claude/commands/review-changes.md` asks for this. It was the orchestrator's practice, and it is also why the
dispatches held the review commit (row `2026-10-11-reviewer-dispatch-tools-and-commit`).

Fix shape: an optional step in `workflows/5-review.md`, recommended for docs-mode stories, whose claims are prose and
checked only by reading. Before commit, a read-only checker re-derives the blocking and non-blocking findings and
the gate account, and the Reviewer folds in what holds, then commits. Writing it down also settles that row's commit
question for this case.

Does it port to the other flow? It already exists there in another form: it is the human-gated counterpart of
Direction mode's blinded gate judges. The port is from Direction into the human-gated review.

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/3-self-maps.md` (round 1, § Method and
§ Independent check); the same section in reviews 2 (round 3), 4 and 5; audit
`engineering-team/audits/duty-menus-and-self-maps/audit.md` §7.
