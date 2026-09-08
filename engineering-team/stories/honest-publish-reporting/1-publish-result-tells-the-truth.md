# Story 1: The publish result tells the truth about what each relay did

**Status:** Approved
**Created:** 2026-09-07
**Type:** Bug

## Background

`publishToRelays` (`ui/src/utils/nostrPublish.js`) is the shared browser-side primitive for putting a
signed event on external relays. It reports **every** publish as a success, whatever the relay did.

`SimplePool.publish()` returns an **array of promises**, not a promise (`nostr-tools@2.23.3` declares
`publish(...): Promise<string>[]`). The shipped code races that array against a 5-second timeout;
`Promise.race` resolves a non-thenable member immediately, so the race always wins on the first tick,
every relay is pushed onto `successes`, the relay's own answer is never awaited, and the timeout can
never fire. Confirmed at library source level and by runtime repro (race resolves in ~1 ms).

Introduced 2026-04-05 (`d7a232e7`) — about five months in production. First diagnosed 2026-06-12 as a
Tier-3 fast-follow (`_intake.md:990`), lost, and rediscovered 2026-09-07 during
treasure-map-relay-presence #2, which had to route around it.

**Who is affected.** Every user who publishes anything from the browser — eight shipped paths:
profile-tag apply/dispute, tag-detail apply/dispute, tag pinning, TL opt-in, the manual event editor,
shared-concept submit + wire, concept self-declare + export, and follow/unfollow, mute/unmute and
NIP-56 report.

**Why it is more than a wrong boolean.** Three consequences, in severity order:

1. **It silently neutralizes `shared-concepts-seeding` #1.** `src/lib/broadcastOutcome.js` exists to
   stop Tapestry claiming community reach it has not verified — its stated rule is that an unreadable
   result "must fail toward honesty rather than toward the cheerful answer." It classifies from
   `successes`, which is a constant, so it always returns `published` and its entire `not-delivered`
   vocabulary is dead. The honesty layer was built one storey above the hole.
2. **`publishOrThrow` can never throw at all** — not merely on external failure. It throws only when
   local *and* external both fail; with external pinned to success, a **local strfry failure is
   silently swallowed** on any deployment with external publishing on.
3. **Unhandled promise rejections in users' browsers.** `Promise.race` calls `Promise.resolve(array)`
   and does not iterate into it, so no handler is ever attached to the inner promise; a relay
   answering `OK: false` surfaces as an unhandled rejection.

**Why it survived.** There is no behavioral coverage of this path — every test touching it asserts over
source text with regexes. `test/honest-broadcast-reporting.test.js` tests the classifier as a pure
function against a hand-written `{successes: [], failures: [...]}`, **a shape the primitive cannot
actually produce.** Green suite, broken production.

**The consumers are not the problem.** Every caller already reads `successes.length > 0` and already has
a correct failure branch — `ConceptDetail.jsx` even offers "the community relay publish failed — click
again to retry." None was written against the buggy contract. This story is expected to need no consumer
edits: fixing the primitive should wake eight correct-but-unreachable branches at once.

## User-facing description

As someone publishing to the nostr network from Tapestry, I want to be told the truth about whether a
relay took my event, so that I can retry when it didn't instead of believing something reached the
community that never left my browser.

## Acceptance criteria

- [ ] Given a relay that accepts the event, when a user publishes to it, then that relay is reported as
      a success; given a relay that refuses the event, then that relay is reported as a failure and not
      as a success.
- [ ] Given a relay that cannot be connected to, when a user publishes to it, then that relay is reported
      as a **failure**. (Trap: `pool.publish` catches connection errors and *resolves* with a
      `"connection failure: …"` string, so it arrives settled-successfully.)
- [ ] Given a relay that accepts the connection but never answers, when a user publishes to it, then the
      attempt gives up within a bounded time and that relay is reported as a failure. (Today the timeout
      is unreachable.)
- [ ] Given no relay accepted the event, when the user submits or wires a shared concept, then they are
      told it did not reach the community relay and to try again — the `not-delivered` outcome becomes
      reachable. And given the local publish failed with no external relay accepting, publishing a
      profile tag raises the error rather than reporting success.
- [ ] Given the deployment's local-only guard is on, when a user publishes, then behavior is unchanged:
      the result is still marked as kept-local, no external socket is opened, and no relay is reported
      as either a success or a failure.
- [ ] Given a relay refuses the event, when a user publishes to it, then no unhandled promise rejection
      appears in the browser console.

## Concepts touched

None directly — this is a transport primitive, and no concept's meaning changes. The events it carries
belong to concepts the Architect can resolve via `/api/concept-graph/summaries` if needed: the
nostr-user-tag assertion family, tag pinning, and the shared-concept declaration/wiring family.

Note for the Architect: `ui/src/utils/publishProfileTag.js` contains a deliberate literal TA pubkey
under the **ADR 0015 named exception**. It is not in scope here and must not be "cleaned up" — CLAUDE.md
directs reviewers to reject its removal without a re-parenting migration.

## Out of scope

- **OPEN.md row 201** — a relay acks before the event is queryable, so an immediate post-publish re-read
  can report a successful write as a failure. Same family, deliberately deferred to keep this story to
  one subsystem. Any future work that verifies a publish by re-reading needs `confirmSync`'s bounded
  second look.
- **Changing the partial-failure contract.** Local success continues to tolerate external failure
  without throwing; that tolerance is deliberate (the strfry router redistributes later). This story
  makes the signal truthful, not stricter.
- **New user-visible messaging.** Surfaces that already report an outcome will start telling the truth;
  adding failure reporting to surfaces that have none today is separate work.
- **The `skippedByGate` local-only path** (ADR event-tagging/0002) — working as designed, not to be
  disturbed.
- **The server-side publish paths** and `TreasureMapRelayPresence`'s `runSync` workaround. `runSync`
  judges outcomes from what the relay actually serves; whether it can be simplified once the primitive
  is truthful is a follow-up, not a precondition.

## Open questions

- How many of the eight paths were *actually* failing silently in production, and on which relays? The
  blast radius is proven in code; the real-world failure rate is not yet measured. Worth a look during
  Architecture, because it sets expectations for what starts surfacing on deploy — but it does not block
  the fix.

## Linked artifacts
- ADR: `engineering-team/decisions/honest-publish-reporting/0001-per-relay-publish-classification.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
