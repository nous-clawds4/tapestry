# A staging→main promotion PR's bundle description goes stale between open and merge, and nothing re-checks it

**Id:** 2026-09-20-promotion-bundle-body-goes-stale
**Type:** meta
**Opened:** 2026-09-20 (PR #709 promotion; surfaced cross-session by the `rollup-scanner-fidelity` run)
**Status:** OPEN
**Done:** —

`/cycle-prod` step 1 says to read `git log origin/main..origin/staging` and *"state the bundle to the
user in the PR description so it's clear what's shipping."* The description is then written once, at
PR-open. But the PR's head is **`staging`**, a shared long-lived branch that anyone may push to while
the PR sits open — and between open and merge there is a mandatory human approval plus a
safe-to-merge check, so the gap is never zero and is often minutes.

**Measured on PR #709.**

| | time | bundle |
|---|---|---|
| bundle read, body written | ~22:35Z | 16 commits, 3 PRs |
| PR opened | ~22:36Z | |
| `9e87f905` pushed direct to `staging` | **22:38:51Z** | |
| merged | 22:41:24Z | **17 commits** |

The extra commit — "Add `dlists` filter field for REQ messages", 43 lines of
`protocols/drafts/filters-on-dlists.md`, docs-only — shipped to production described by nothing. It
was caught only because a **second session** independently read the bundle at 22:45Z and mentioned
the discrepancy. Nothing in the flow would have caught it.

**Why it is worth a row.** The promotion PR body is the durable record of what went to production —
it is what a future incident review reads to answer "what changed?". A body that is accurate at open
and wrong at merge is worse than a terse one, because it reads as a complete manifest. Two
aggravating details:

1. **Direct-to-staging commits are invisible to the natural reading.** The bundle was summarised from
   `git log --merges`, which is the right way to get a PR-level view and silently omits anything not
   merged via a PR.
2. **The approval is given against the stale body.** The operator in this case approved a 3-PR bundle
   after being shown its contents; a 4th item arrived after that approval and before the merge. Here
   it was innocuous. It need not be.

**Fix shape**, cheapest first:

1. **Re-read the bundle immediately before merging**, in the same breath as the safe-to-merge check
   (which is already specified as "the merge's immediate precursor"), and diff it against what the
   body claims. If it moved, update the body — and if it moved by more than docs, re-surface to the
   operator, since the approval was given against the old contents.
2. **Summarise with `git log`, not `git log --merges`**, or at minimum add a "direct-to-staging
   commits in this bundle" line so non-PR work is never silently dropped.
3. A post-merge note is the fallback, not the fix — it corrects the record but only after the change
   is already in production. Done here as
   https://github.com/nous-clawds4/tapestry/pull/709#issuecomment-5753241782.

**Related, and worth pairing with a fix:** the same promotion's smoke test verified the deploy from
*behaviour* rather than from the served artifact. The `rollup-scanner-fidelity` session supplied a
pre-merge bundle hash (prod `index-Ci4a4Afn.js`, staging `index-C0IIBk2L.js`), which made the check
decisive — prod now serves `index-C0IIBk2L.js`. `/cycle-prod` step 6 already warns that only the
served bundle hash exposes a stale container (`OPEN.md` row 251), but neither it nor
`docs/SMOKE_TEST.md` says to **capture the before-value**, without which the after-value proves
nothing. Both skills should say: record the served hash before merging, compare after.

**Pointer:** `.claude/skills/cycle-prod/SKILL.md` steps 1, 4, 6; `docs/SMOKE_TEST.md`; `OPEN.md` row
251; PR #709 and its post-merge correction comment.
