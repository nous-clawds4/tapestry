# Epic: honest-publish-reporting

**Created:** 2026-09-07
**Status:** Open
**Provenance:** OPEN.md row 200, filed at the treasure-map-relay-presence book close (2026-09-07)
and enriched by a full blast-radius investigation the same day. First diagnosed 2026-06-12 as a
Tier-3 fast-follow (`_intake.md:990`) and lost for ~3 months before rediscovery.

## Goal

**When Tapestry tells a user their event reached a relay, that has to be true.**

The browser-side publish primitive, `publishToRelays`, reports every external publish as a success
regardless of what the relay did. Eight shipped publish paths branch on its verdict. This epic
makes the verdict real, so that the failure handling those paths *already contain* starts working.

## Why it matters

Publishing to a relay is how a Tapestry user's assertions — tags, pins, follows, mutes, reports,
shared-concept declarations, their Treasure Map — leave the instance and become visible to the rest
of the network. It is the moment the local-first graph (BIBLE §30) meets the communication axis.

A publish path that cannot fail is worse than one that fails loudly. The user is told their tag
reached the community, closes the tab, and it never did. Worse, the codebase has *already* invested
in honesty here and been silently defeated: `src/lib/broadcastOutcome.js` exists specifically to stop
Tapestry claiming community reach it had not verified, and its whole "not-delivered" vocabulary is
unreachable because the signal beneath it is a constant.

## Stories

1. `stories/honest-publish-reporting/1-publish-result-tells-the-truth.md` — `publishToRelays`
   classifies each relay from what that relay actually did, so the eight consumers' existing
   failure branches become reachable. **Approved.**

## Key facts / guardrails

- **`SimplePool.publish()` returns `Promise<string>[]` — an array of promises, not a promise.**
  (`nostr-tools@2.23.3`, `abstract-pool.d.ts:52-56`.) Racing that array against a timeout resolves
  instantly on the non-thenable. This is the defect.
- **A relay that cannot be connected to does NOT reject.** `pool.publish` catches connection errors
  and *resolves* with the string `"connection failure: <err>"` (`nostr-tools/lib/esm/index.js:1324-1327`).
  A fix that classifies on settled *status* alone will still report unreachable relays as successes.
  Classify on the fulfilled **value**.
- **Every consumer is already written correctly.** No caller was built against the buggy contract;
  each has a correct failure branch that is merely unreachable. Fixing the primitive is expected to
  need no consumer edits — verify rather than assume.
- **The partial-failure tolerance is deliberate and stays.** `publishOrThrow` throws only when local
  *and* external both fail; local success tolerating external failure is by design (the strfry router
  redistributes later). This epic makes the signal truthful, not stricter.
- **The local-only gate (`skippedByGate`, ADR event-tagging/0002) is a separate, working path.**
  Do not disturb it. `test/global-publish-gate.test.js:126` asserts the guard precedes any socket via
  a literal `indexOf('pool.publish')` — keep that substring intact.
- **Expect previously-silent failures to surface** across all eight paths at once. That is the point,
  but it means the tag/TL publish suites move in the same change.

## Related

- **OPEN.md row 201** (same family, deliberately separate): a relay acks a publish before the event
  is queryable, so an immediate re-read can report a successful write as a failure. Handled locally in
  treasure-map-relay-presence #2 via `confirmSync`'s bounded second look; latent anywhere the codebase
  publishes and immediately re-reads.
- **`shared-concepts-seeding` #1** (`1-honest-broadcast-reporting.md`) — the story this defect
  neutralized. Its `broadcastOutcome.js` core is correct; it was built one storey above the hole.
