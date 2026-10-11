# Nobody recorded that the instance's own scripts still work through the route table on a deployed site

**Id:** 2026-10-11-instance-scripts-live-check-unrecorded
**Type:** cleanup
**Opened:** 2026-10-11 (book `admin-action-owner-check` close, audit §4 #5)
**Status:** OPEN
**Done:** —

Story `security-auth-exposure` #8 AC-3 asks that the firmware-install bridge and the loopback scheduled jobs still do
their work, "shown end to end". Its test plan put that check at deploy (§ Live / manual), and the review's "Before
shipping" list asked for it. The code path did not change: direct-local callers are trusted before the route table is
consulted, and the review's behaviour diff showed a direct-local caller lost nothing. But story 8 § Shipped and ledger
`2026-10-11-route-table-release` record only the visitor probes and the smoke tiers, and the smoke tiers cover neither.

Confirm it on one deployed instance (`staging` is enough): a firmware install through the bridge succeeds, and one
loopback scheduled job completes. Record the evidence here and close the row.

**2026-10-11 (loopback job, done):** on production, the scheduled search-index refresh, which calls the instance's
own API over loopback, ran at 01:09:39 UTC, after deploy 147 finished at 00:17:37, and reported `success` (the public
task-history read for `legacy:refreshSearchIndex`). **Still open:** a firmware install through the bridge; it is an
owner action with real effects, so it waits for the owner's next install.

**Pointer:** `engineering-team/stories/security-auth-exposure/8-admin-action-sweep.test-plan.md` § Live / manual;
`engineering-team/reviews/security-auth-exposure/8-admin-action-sweep.md` § Before shipping.
