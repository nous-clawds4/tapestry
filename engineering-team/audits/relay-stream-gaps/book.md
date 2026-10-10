# Book of Work: Relay stream gaps

**Slug:** relay-stream-gaps
**Status:** Open
**Opened:** 2026-10-09
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the operator's ask, restated at kickoff (2026-10-09).

The reported symptom: content expected on the local strfry was missing until a manual
negentropy sync, although the router streams on `/tapestry/settings/relays` showed as on.
The diagnosis (epic `relay-stream-gaps` § Why it matters) found the streams working but
live only. Gaps open at every deploy, at every Router Management change, and for every kind
no stream downloads. The operator chose the remedies below.

### Acceptance frame

- [ ] Turning a stream on or off, editing streams, or restoring defaults on the Router
      Management tab no longer interrupts the other streams.
- [ ] The stream editor's Limit setting does what it says: on every (re)connect, a stream
      fetches up to its limit of the newest matching events from each relay, so short gaps
      refill themselves. The operator chose this on 2026-10-09 over removing the field, and
      means to raise the limits from 5.
- [ ] On the Negentropy Sync tab, a sync command can be saved as a preset. Each preset can be
      switched on or off, and the enabled ones run on a schedule as a Scheduled Task. Content
      the router missed (deploy holes, disconnects, kinds no stream covers) then arrives
      without anyone running a sync by hand.
- [ ] Each of the above is verified on staging before production.

Frame confirmed by the operator 2026-10-09; story 1 approved the same day.

## Epics in this book
- `relay-stream-gaps`: close the gaps the live-only router streams leave.

## Staging verification (2026-10-09 → 2026-10-10)

All three stories are Done and on `staging`: PRs #787 and #826 (stories 1–2, deploy #544) and #831 (story 3,
deploy #551). Production has not been promoted; the frame's last bullet asks for staging verification first.

| Frame bullet | Staging status |
|---|---|
| 1. Stream changes don't interrupt other streams | **Not yet checked live.** The owner's toggle check is pending: toggle one stream on the Router Management tab and confirm the router's uptime keeps counting and the message says it reloaded, not restarted. |
| 2. The Limit refetches on (re)connect | **Patch verified; gap not yet closed.** The deploy log shows the router patch applied and strfry rebuilt (deploy #544). At deploys #544–#546 the WoT stream (limit 5) held exactly the newest 5 events as of a moment 1.5–3.5 min after the container started, so the refetch works but 5 was too few: it lost 1–2 events per deploy. At #551 `userProfiles` (no limit) lost all 7 kind-0 events from its ~35 s window. **Pending:** the owner raises the download streams' limits to 500, `userProfiles` included; then re-measure at the next deploy. Root cause of the late reconnect and the empty boot config: OPEN.md row `2026-10-10-router-boots-with-empty-streams`. |
| 3. Saved negentropy presets run on a schedule | **AC-5 met (inferred).** Preset `dcosl headers` (`wss://dcosl.brainstorm.world`, down, kind 39998), scheduled at a 10-minute test interval, ran at 01:32:58 and 01:42:58 UTC on 2026-10-10. Staging had lacked 3 of 392 dcosl concept headers (20:58 UTC on 2026-10-09); afterwards it held all 393, while dcosl kind-9999 items the preset doesn't cover were still missing. The first run's count isn't retained (only the latest run is kept: OPEN.md row `2026-10-10-presets-keep-last-productive-run`). **Pending:** the owner sets the task's interval back to 6 h. |
| 4. Each verified on staging before production | Open until bullets 1 and 2 are checked. |

**To close the book:** the owner raises the limits (bullet 2) and does the toggle check (bullet 1); after the next
staging deploy, re-measure the WoT and kind-0 holes (the scripts are simple REQ comparisons of
`wss://wot.grapevine.network` against `wss://staging.brainstorm.world/relay` per minute); record the results here;
then offer `/close-book`.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/relay-stream-gaps/audit.md`
- Product feedback: `engineering-team/audits/relay-stream-gaps/prd-seed.md`
