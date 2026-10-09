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

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/relay-stream-gaps/audit.md`
- Product feedback: `engineering-team/audits/relay-stream-gaps/prd-seed.md`
