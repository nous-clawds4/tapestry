# `review(<slug>):` commits are invisible to `harness-stats.sh`, so three books contribute no cycle-time measurement

**Id:** 2026-09-21-review-commit-form-breaks-cycle-time
**Type:** meta
**Opened:** 2026-09-21 (author-scoped-inspection book close, retro §7)
**Status:** OPEN
**Done:** —

Two related gaps in phase-commit attribution, found by running the measurement the retro step
requires rather than by noticing anything.

**(a) The review form.** `workflows/5-review.md:34` documents
`review: <slug> — <VERDICT> (<epic> #<n>)`. A parenthesised variant has drifted in unchallenged and
is now used by three books:

```
review(author-scoped-inspection): stories 1-4 — PASS
review(rollup-scanner-fidelity): story 1 — PASS
review(nip05-ssrf-guard): story 1 — PASS
```

`scripts/harness-stats.sh:170` computes cycle time from `$2 ~ /^review: /`. A `review(...)` subject
does not match, so a book using that form has a story timestamp and **no** review timestamp, and
drops out of the story→review cycle-time series entirely. The count line at `:40` uses a looser
pattern and still counts them, so the loss is silent: the totals look right while the timings
quietly thin out.

**(b) The per-epic heuristic is a substring match.** `:48` attributes a phase commit to an epic when
the *subject contains the epic name*. This book's implementation commit reads
`impl: author-scoped inspection on Active b-tags (#1-#4)` — "author-scoped inspection" with a space,
where the epic is `author-scoped-inspection`. It is therefore attributed to no epic. Combined with
(a), **2 of this book's 5 phase commits are invisible**: the per-epic line reads `3`.

(b) is self-inflicted, and worth recording anyway: a one-character slip in a commit subject silently
removes a commit from the record, with no warning at any point.

**Fix shape — pick one, they are not equivalent:**
- Widen the matcher: `/^review[:(]/` in `:170`, and the same for the count pattern. Cheapest;
  accepts both forms as legitimate and recovers the three existing books retroactively.
- Or hold the documented form and make the drift visible — have `harness-stats.sh` print
  unmatched phase-commit subjects rather than dropping them, so (a) and (b) both surface the
  next time they happen.

The second is the better shape: the first makes the number correct while leaving the *next*
divergent form just as silent. Both touch `scripts/harness-stats.sh`, a harness-definition path, so
the change owes a CHANGELOG row.

**Pointer:** `scripts/harness-stats.sh:40,48,170`; `engineering-team/workflows/5-review.md:34`;
the three review commits above. Sibling rows — all checks that silently measure less than they
appear to: OPEN.md row 165 (the `grep` shim honors `.gitignore`), row 342 (a vacuous negative
search under zsh), and `ledger/2026-09-20-comment-stripper-eats-wildcard-route.md`.
