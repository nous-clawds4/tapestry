# Updating a review in place to PASS erases the only trace the kick-back instrument reads

**Id:** 2026-09-20-inplace-pass-erases-kickback-history
**Type:** meta
**Opened:** 2026-09-20 (book close `profile-lookup-bounds`, retro finding R3)
**Status:** OPEN
**Done:** —

`scripts/harness-stats.sh` reports two different things, and the second exists precisely because the
first goes to zero once work finishes:

```
  kick-back rate: 0% (CR-final ÷ decided)
  reviews with kick-back history (any CHANGES_REQUESTED mention): 43
```

`CR-final` counts reviews whose *final* verdict is `CHANGES_REQUESTED`, so a healthy repo trends to
0% by construction — every kick-back that got fixed stops counting. `KB_HIST` is the recovery
mechanism: grep every review file for a mention of the token and you can still see that rework
happened.

**Nothing keeps the token alive.** Workflow 5 says each review ends with *exactly one* of PASS or
CHANGES_REQUESTED, and the natural way to satisfy that after a kick-back is resolved is to rewrite
the verdict line in place. Do that and the word disappears from the file.

Measured on this book. Review `reviews/done/profile-lookup-bounds/1-resolve-author-names-at-any-scale.md`
went through a genuine round 1 — one blocking finding (a user-visible regression: the Tapestry
Assistant lost its name on the failed-lookup path), a kick-back to Phase 4, a fix commit
(`5b3af3b9`), then round 2 PASS. The file still narrates all of it under "Round 1 — Blocking (now
resolved)". But:

```
$ grep -c "CHANGES_REQUESTED" engineering-team/reviews/done/profile-lookup-bounds/1-*.md
0
```

So this book contributes **0** to `CR_N` (correct) and **0** to `KB_HIST` (wrong — a kick-back
happened). The 43 reviews that do count appear to have kept the token by accident of phrasing, not
by any rule.

**Why it is worth a row:** workflow 6 step 7 requires the retro to cite `harness-stats.sh` "so the
retro runs on measurement rather than anecdote." The measurement it cites for review rework is
silently lossy, and lossy in the flattering direction — rework disappears, so the harness looks
cleaner than it is. A retro reading `kick-back rate: 0%` alongside an under-counted `KB_HIST` will
conclude the review phase catches nothing worth recording, when this book's round 1 caught a real
regression that shipped-as-written would have degraded 31 pages' author cells.

**Fix shape**, cheapest first:

1. **A fixed, greppable rounds line** in the review template — e.g. `**Rounds:** 1 CHANGES_REQUESTED
   → 2 PASS` — directly under the verdict. One line, survives in-place updates, and `KB_HIST`'s
   existing grep finds it with no script change.
2. **Or** make round 2 a separate review file, which is what `re-review churn (story numbers with >1
   review file)` already measures — at the cost of splitting one story's audit trail across files.
3. Either way, say so in `workflows/5-review.md` where the one-verdict rule is stated, since that
   rule is what invites the erasure.

Note this is **not** the same gap as `2026-09-20-human-gated-approvals-leave-no-record`, which is
about *approvals* having nowhere to live. Here the record exists and is well written; it is the
machine-readable token inside it that gets dropped.

**Pointer:** `scripts/harness-stats.sh:85-96`; `engineering-team/workflows/5-review.md` (verdict
rule); `engineering-team/templates/review-checklist.md`; audit
`engineering-team/audits/profile-lookup-bounds/audit.md` §7.
