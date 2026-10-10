# A staging check of router delivery was first read from per-minute counts, and only a per-event timeline against the deploy's container stop and start showed what had been lost

**Id:** 2026-10-10-staging-delivery-check-recipe
**Type:** meta
**Opened:** 2026-10-10 (book `relay-stream-gaps` close, audit §7)
**Status:** OPEN
**Done:** —

**What was seen.** Verifying relay-stream-gaps #2 (a stream's Limit refetched on connect) on staging, the first reading
compared per-minute event counts on `wss://wot.grapevine.network` and staging around deploy #544. It concluded "events
published during downtime were recovered, which confirms the patch works". That was half right. Only a per-event list
of ids lined up against the deploy job's container stop and start times (from the deploy log) showed the real picture:
- at limit 5, each of deploys #544–#546 lost 1–2 WoT events;
- what staging held was exactly "the newest 5 at a moment T", with T 1.5–3.5 minutes after the container started;
- so the refetch worked, but this stream connected minutes late, and 5 did not reach back far enough.

The per-minute count could not show either fact. The lesson ports to both flows: a Director's staging smoke and a
human-gated session's verification read the same data.

**Fix shape.** A short recipe, in OPERATIONS.md next to "What a deploy does" or as a skill, for checking router or relay
delivery across a deploy:
1. Take the container's stop and start times from the deploy job's log.
2. List event ids, not counts, per minute on the upstream relay and on the instance, over a window around them.
3. For each missing id, compare its `created_at` with the stop and start times, and with the newest-N boundary of the
   stream's Limit.
4. Read the router's log (`docker exec tapestry tail /var/log/supervisor/strfry-router-error.log`) for each stream's
   `Connecting` and `Connected` times.

Step 4 is still owed for this book: it is the only way to learn why WoT connected late (OPEN.md row
`2026-10-10-router-boots-with-empty-streams`).

**Pointer:** `engineering-team/audits/relay-stream-gaps/audit.md` §7; `engineering-team/audits/relay-stream-gaps/book.md`
§ Staging verification; OPERATIONS.md "What a deploy does".
