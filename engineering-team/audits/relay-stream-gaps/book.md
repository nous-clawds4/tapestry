# Book of Work: Relay stream gaps

**Slug:** relay-stream-gaps
**Status:** Closed
**Opened:** 2026-10-09
**Closed:** 2026-10-10 (on staging via PRs #826, #831 and #834; stories 1–2 also on production via PR #829, story 3 on production 2026-10-10: PR #838 merged as `94cb6d3e`, deploy run 142)

## Intent anchor

**Acceptance frame (no PRD)**: the operator's ask, restated at kickoff (2026-10-09).

The reported symptom: content expected on the local strfry was missing until a manual
negentropy sync, although the router streams on `/tapestry/settings/relays` showed as on.
The diagnosis (epic `relay-stream-gaps` § Why it matters) found the streams working but
live only. Gaps open at every deploy, at every Router Management change, and for every kind
no stream downloads. The operator chose the remedies below.

### Acceptance frame

- [x] Turning a stream on or off, editing streams, or restoring defaults on the Router
      Management tab no longer interrupts the other streams.
- [x] The stream editor's Limit setting does what it says: on every (re)connect, a stream
      fetches up to its limit of the newest matching events from each relay, so short gaps
      refill themselves. The operator chose this on 2026-10-09 over removing the field, and
      means to raise the limits from 5.
- [x] On the Negentropy Sync tab, a sync command can be saved as a preset. Each preset can be
      switched on or off, and the enabled ones run on a schedule as a Scheduled Task. Content
      the router missed (deploy holes, disconnects, kinds no stream covers) then arrives
      without anyone running a sync by hand.
- [x] Each of the above is verified on staging before production. *(Verified on staging for all three. Stories 1–2 reached production via PR #829 on 2026-10-09, before their staging checks; story 3 reached production 2026-10-10 via PR #838, after its staging checks. Audit §4 #11.)*

Frame confirmed by the operator 2026-10-09; story 1 approved the same day.

## Epics in this book
- `relay-stream-gaps`: close the gaps the live-only router streams leave.

## Staging verification (2026-10-09 → 2026-10-10)

All three stories are Done and on `staging`:
- PR #787, the router hardening the book built on, at deploy #543;
- PR #826, stories 1–2, at deploy #544;
- PR #831, story 3, at deploy #551.

Stories 1–2 also reached production through PR #829 (staging → `main`, 20:13Z on 2026-10-09), before the checks below; story 3 had not been promoted (it reached production 2026-10-10 via PR #838). Final state, read up to 02:42Z on 2026-10-10. The measurement method was per-event lists of `wss://wot.grapevine.network` against `wss://staging.brainstorm.world/relay`, lined up with each deploy job's container stop and start times.

| Frame bullet | Staging status |
|---|---|
| 1. Stream changes don't interrupt other streams | **Verified.** The router restarted at 02:18:42Z (deploy #555, another session's docs push). It then ran without a break through the owner's limit edits on `userProfiles` and `treasureMaps` (after about 02:22Z) and the owner's toggle check: uptime 0:24:08 at 02:42:50Z. That the *other* streams stayed connected is inferred from the uptime and ADR 0001's sandbox evidence; no per-stream log was read. |
| 2. The Limit refetches on (re)connect | **Verified.** **At limit 5** (#544–#546): the deploy log shows the patch applied (#544), and WoT kept exactly the newest 5 as of a moment 1.5–3.5 minutes after container start, losing 1–2 events per deploy. **At limit 500** (the owner raised it, 2026-10-10): WoT lost nothing at #553 (its in-outage event, 02:05:13Z, came back), #554 or #555. `userProfiles`, with no limit until about 02:22Z, lost 2 events at #553 and 1 at #554. All three (02:05:02Z, 02:05:13Z, 02:15:17Z) are now on staging, refetched when the stream reconnected with limit 500 after the owner's in-place edit, with no router restart. All 13 streams are at limit 500. The late WoT connect's cause is unknown: OPEN.md row `2026-10-10-router-boots-with-empty-streams`. |
| 3. Saved negentropy presets run on a schedule | **AC-5 met (inferred).** Preset `dcosl headers` (`wss://dcosl.brainstorm.world`, down, kind 39998) ran on a 10-minute test interval from 01:32:58Z to 02:02:58Z. Staging had lacked 3 of 392 dcosl concept headers (20:58Z on 2026-10-09); afterwards it held all 393. The dcosl kind-9999 items the preset doesn't cover (4 from the last week) were still missing. The productive run's count isn't retained: OPEN.md row `2026-10-10-presets-keep-last-productive-run`. At 02:42Z the task's entry read **switched off, still at 10 minutes**; set it to 6 hours before switching it on again (OPEN.md row `2026-10-10-ten-minute-schedule-blocks-merges`). |
| 4. Each verified on staging before production | **Met for staging** by 1–3, **but not in order for stories 1–2**: PR #829 had already promoted them, about six hours before these checks. Production's saved limits are 5, 0 or none, so its patched router refetches at most 5 per connect. Story 3 was not promoted then; it reached production 2026-10-10 via PR #838 (audit §4 #11, §6 #1). |

The record before these final checks is in `44d98cef`'s version of this file.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high for the code (three reviewed stories, sandbox runs against real strfry 1.1.0, full gate green); medium for the frame on staging (bullets 1–2 observed, bullet 3 inferred, the late reconnect's cause unknown); none for production, where stories 1–2 run unverified and story 3 was not deployed (audit header); story 3 deployed 2026-10-10 via PR #838, smoke-tested anonymously

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/relay-stream-gaps/audit.md`
- Product feedback: `engineering-team/audits/relay-stream-gaps/prd-seed.md`
