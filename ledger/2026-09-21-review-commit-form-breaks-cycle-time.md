# Parenthesized phase-commit forms (`review(<slug>):`, `plan(<slug>):`) are invisible to `harness-stats.sh`, so several books contribute no cycle-time measurement

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

**(c) The same drift exists on the *story* side, added 2026-09-22 (`llms-txt` book close, retro §7).**
`workflows/1-planning.md:32` documents `git commit -m "story: <slug> (<epic> #<n>)"`, and
`scripts/harness-stats.sh:169` computes the story timestamp from `$2 ~ /^story: /` — same shape as
(a)'s review pattern. But the actual Planning-phase precedent already in this repo, going back to
`nip05-ssrf-guard` (`plan(nip05-ssrf-guard): story 1 — one shared pre-fetch address guard`,
`4371c765`) and now `llms-txt` (`plan(llms-txt): story 1 approved — serve llms.txt on the fleet`,
`eb08b102`/`b6ffee98`/`8f6ecb29` across the three branches this book shipped to), uses `plan(<slug>):`
— which does not match `^story: ` at all. Both books' Planning-phase commits are therefore entirely
invisible to the cycle-time series, not merely missing one end of it: `harness-stats.sh`'s own
per-epic count line confirms it (`llms-txt: 4` where 5 phase commits exist — the fifth being one of
the four *non*-plan commits already counted correctly, so the miscount is consistent with the plan
commit dropping out silently, the same signature as (b)). The fix and its "pick one, not equivalent"
tradeoff are identical to (a) and (b) — see below, now widened to cover both prefixes.

**Fix shape — pick one, they are not equivalent:**
- Widen the matchers: `/^review[:(]/` at `:170` and `/^story[:(]/` at `:169`, and the same for the
  count pattern. Cheapest; accepts both forms as legitimate and recovers all affected books
  retroactively — now at least five (three review-form, two story-form, with `nip05-ssrf-guard`
  contributing one of each).
- Or hold the documented form and make the drift visible — have `harness-stats.sh` print
  unmatched phase-commit subjects rather than dropping them, so (a)/(b)/(c) all surface the next
  time they happen, on either side of the pipeline.

The second is the better shape: the first makes the number correct while leaving the *next*
divergent form just as silent. Both touch `scripts/harness-stats.sh`, a harness-definition path, so
the change owes a CHANGELOG row.

**Pointer:** `scripts/harness-stats.sh:40,48,169,170`; `engineering-team/workflows/5-review.md:34`;
`engineering-team/workflows/1-planning.md:32`; the three review commits above; the `plan(...)`
commits at `nip05-ssrf-guard` `4371c765` and `llms-txt` `eb08b102`/`b6ffee98`/`8f6ecb29`. Sibling
rows — all checks that silently measure less than they appear to: OPEN.md row 165 (the `grep` shim
honors `.gitignore`), row 342 (a vacuous negative search under zsh), and
`ledger/2026-09-20-comment-stripper-eats-wildcard-route.md`.
