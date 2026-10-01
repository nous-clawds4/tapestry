# Epic: tagging-edges — NostrUser→NostrUser relationships that reflect Taggings

**Status:** Active
**Created:** 2026-09-26
**Book:** `engineering-team/audits/tagging-edges/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-09-25 ("if Alice Tags Bob as a Podcaster, then I would like there to be
a neo4j relationship from Alice to Bob"), broken into stages at kickoff on 2026-09-26. It sits beside the
FOLLOWS / MUTES / REPORTS social graph and its ETL, and is a narrow, tagging-only relative of the general
strfry→Neo4j letter ingest (OPEN.md #136 stage 2), which it does not attempt.

## Goal

**Neo4j carries one relationship per tagging, from the tagger to the tagged person, kept current in real time
and repaired retroactively, and the owner can manage that pipeline from the control panel.** Before story 2 no
tagging reached Neo4j at all; every tag surface still scans the relay per request. *(Amended 2026-09-30 at story 4's
Planning: admins may also see the panel and use every control but confirming held removals; see item 5.)*

## Stories

`stories/tagging-edges/`. All five are features (Standard: all five phases).

1. `1-tagging-edge-contract.md` — what one relationship is: which events count, what the relationship carries,
   which version of a tagging stands, what a revoke removes; documented in BIBLE. No relationship is written yet.
2. `2-gap-filling-pass-and-backfill.md` — the gap-filling pass and backfill: writes the relationships, enforces
   one-per-tagging in the database, repairs drift, refuses to mass-delete on a failed or empty relay read. Its first
   run is the backfill. **Done**; on production since 2026-09-28 (PRs #780 / #781).
   **Carry-forwards from story 1's review** (owner-ratified 2026-09-27; `reviews/tagging-edges/1-tagging-edge-contract.md`
   § "Re-review", R2-NB1–3 and R2-4–10) — each becomes an acceptance criterion or a docs task of story 2:
   - *R2-NB1:* a `createdAt` that cannot be compared (NaN, undefined, a JSON-round-tripped Neo4j Integer) makes
     `standingEdge` fall to the event-id tie-break. Guard it in the contract (with tests), or normalize every
     `createdAt` read back from Neo4j before calling it — and pin whichever with a test.
   - *R2-NB2:* `resolveTagElement` takes the tag element's first `d`, not the `d` strfry indexes (clarification 9
     applied to elements): use the element's identity `d`.
   - *R2-NB3:* the drift repair must remove an edge whose tagging the relay no longer holds at all — ADR 0001's
     clarification 13 and BIBLE §6's retirement sentence rely on it. Make it binding in story 2's ADR.
   - *Doc nits R2-4–10:* record strfry's remaining a-deletion divergences beside ADR 0001's strfry bullet; fix the
     epic's stamp-pubkey guardrail wording ("either" vs "both") and say "lowercase 64-hex" in the binding; the
     clarification-9 line numbers and non-string-`d` wording; ADR 0001's stale "One known edge difference"
     sentence and step 5 (clarification 11); the test plan's trailing blank line; a retire-path case for the
     clarification-9 test.
3. `3-real-time-path.md` — the real-time path: reflects new taggings, stance changes and revokes within a minute,
   from every way an event can reach the relay, independently of the follows pipeline; catches up by itself after
   downtime and never backfills. It ships turned off and carries the owner-only on/off control and its own status
   (approved 2026-09-28). Story 2's review carry-forwards (six wording nits) are its docs tasks CF-1–CF-6.
   **Done**; on production since 2026-09-30 (PRs #785 / #786), and the owner turned it on on both hosts that day.
4. `4-tagging-pipeline-panel.md` — the panel: a Relays sub-tab beside Streaming ETL, seen by the owner and admins,
   showing the pass (status, history, held removals, the backstop schedule), the real-time path, and the drift
   between relay and graph, explained. It changes nothing. *(Split from the planned control panel at Planning,
   2026-09-30; the owner's decisions are in the story.)* **Done** (review PASS 2026-10-01, round 2); on production
   since 2026-10-01 (PRs #791 / #792). Its evidence is complete (2026-10-01): the owner and an admin saw the panel,
   Recount was pressed on production, and a user who is neither was refused Settings on staging.
   **Carry-forwards from story 3's review** (placed by the owner 2026-09-30; `reviews/tagging-edges/3-real-time-path.md`
   § "Re-review, round 3", C1–C9). Each open one becomes a docs or test task of story 4. Repo line numbers were read
   at `origin/staging` `58abd891` (prefer the named sections if they have drifted); strfry's are from strfry 1.1.0 in
   the container.
   - *C1 (docs):* **done 2026-09-30 on story 4's branch, shipped with it** (ADR 0003 at `88af7df3`, the other places at
     `a2f38940`). strfry's skip mark is per index-key value, not per subscription (`ActiveMonitors.h:93-98, :167-195`).
     A write is skipped at or below the last event sent to that subscription, the last event visited carrying the
     write's own index-key value, or the relay's newest event when it subscribed. For the path, a stamped tagging is
     also hidden by the last event carrying its stamp; a kind-5 only by the other two. Reword ADR 0003 clarification
     24's "Who misses" bullet, ledger `2026-09-29-strfry-delete-hides-next-write` (its "Who misses" bullet and §
     Impact), OPERATIONS §12.9's safety-diff bullet and story 3 § Evidence.
   - *C2 (docs):* **done 2026-09-30** in the ledger row's debounce bullet (the cursor falls only to the largest id
     present at the wake, which already includes the write). Align ADR 0003 clarification 24's debounce bullet with it
     under C3.
   - *C3 (docs):* **done 2026-09-30 on story 4's branch, shipped with it** (ADR 0003 at `88af7df3`, the other places at
     `a2f38940`). The debounce race's exact condition is a write stored after the delete and before its monitor thread
     next wakes (normally about 100 ms after the first change, which may precede the delete). Name all three other wakes
     (a REQ at its EOSE, a CLOSE, a closed connection); one helps only when it falls between the delete and the write,
     and only for that thread's subscriptions (strfry runs three). Fix ADR 0003 clarification 24, story 3 § Evidence,
     OPERATIONS §12.9's safety-diff bullet ("within 100 ms") and the ledger row's debounce bullet.
   - *C4 (docs):* **done 2026-09-30 on story 4's branch, shipped with it** (OPERATIONS §12.9 and story 3 at `a2f38940`,
     the test plan at `e6f124ea`). "At least one per event deleted" should read "per *newest* event deleted" (OPERATIONS
     §12.9, story 3 § Evidence), as the ADR and the ledger row say. Story 3's test plan takes clarification 24's wipe
     wording in place of "a wipe that deafens live delivery until a reconnect", and says it is the fakes that lose the
     write to every subscription.
   - *C5 (docs; Architect):* **done 2026-09-30 on story 4's branch, shipped with it** (ADR 0003 at `88af7df3`;
     OPERATIONS §12.9 and the `realtime/index.js` comment at `a2f38940`). Clarification 26 adopts `bringsNew`'s effect
     reading,
     already in story 3 § Deviations: a found revoke is held when the parked entry keeps one for its (by, target) at
     least as late, so a back-dated kind-5 found by a catch-up waits for the timer, though live it lifts the park at
     once. And "the same refused version, found again, costs no write" (ADR clarification 26, OPERATIONS §12.9's
     refusal-park bullet, the comment in `realtime/index.js` beside it) is bounded instead: when the parked entry lacks
     the refused id, the first catch-up that finds it lifts the park once, for one write attempt. Docs, not code (the
     owner's placement). *(That bound has two exceptions, found at story 4's Architecture; the true bound is in ADR 0004
     § Amendments to ADR 0003, C5.)*
   - *C6 (test; Tester):* **done 2026-09-30 on story 4's branch, shipped with it** (RX29 and RX30, and story 3's test
     plan, at `e6f124ea`). Pin clarification 26's two unpinned halves after RX28 in
     `test/tagging-edges-realtime-resilience.test.js`: a refused removal's kind-5, found again at a safety diff, merges
     (no write before the 5-minute timer); and a version arriving, notice lost, at a park for a refused removal lifts it
     at the catch-up that finds it, and is written within a minute of that catch-up's start. Update story 3's test plan
     (its resilience index and a review-round-3 block).
   - *C7 (docs; Architect):* **the owner accepted the widening on 2026-09-30**, and it is **done 2026-09-30 on story 4's
     branch, shipped with it** (ADR 0003 at `88af7df3`, OPERATIONS §12.9 and story 3's amendment note at `a2f38940`).
     While journal appends keep failing (a full data volume), a crash, an off or a SIGTERM loses every line not yet
     written, not only the last ≤ 250 ms that owner decision 5's second corner names; and once the volume is out of
     space `status.json` cannot be written either, so the status goes `stale` rather than showing `lastError` (which
     names `journal`, or `record` after a failed compaction, while it can still be written). The same spell also adds
     occasions for decision 11's lost-notice removal (a journal line lost); it is not a new kind of removal, and the
     next pass would make the same one. Reword ADR 0003 § Failure handling's journal bullet and its crash bullet ("so an
     off or a deploy never opens that window" holds only while appends succeed), decision 5 and A1's rewording of it,
     decision 11's journal trigger, § Replay's journal-fault bullet and A1-16's "only a crash's last flush interval and
     a damaged line remain"; OPERATIONS §12.9 (the off paragraph, "What a deploy does" ("it flushes its journal first"),
     "What waits for a pass", the lost-notice-removal bullet, the journal bullet); and add an amendment note to story 3.
   - *C8:* **done 2026-09-30.** SL19 passed inside the local container (story 3 § Evidence, "SL19, the relay smoke
     test"). Nothing left for story 4.
   - *C9 (test; Tester):* **done 2026-09-30 on story 4's branch, shipped with it** (`e6f124ea`). Add
     `src/lib/strfryScanStrict.js` to the `FORGET` list in `test/tagging-edges-realtime-routes.test.js`. Without it,
     SS36 (`test/strfry-scan-strict.test.js`) and RP5 (`test/tagging-edges-realtime-plan.test.js`) fail when run after
     the routes suite in one process; the registry's order hides it. Done when strict, routes, strict, then plan all
     pass in one process, and `npm test`'s counts are unchanged.

5. *(planned)* The controls, on story 4's panel: turn the real-time path on and off, run a pass now (never a second
   while one is queued or running), and stop a pass, queued or running (a running one stops between batches); the
   owner **or an admin** may do each, enforced by the server. Confirming held removals stays **owner only**. A
   confirm prompt comes before turning the path off, stopping a pass, and confirming held removals. This widens story
   3's owner-only switch route to admins (the Architect amends ADR 0003), and gives the pass run and stop controls
   for the owner or an admin, where today it runs through the generic `/api/run-task` (open to any signed-in
   session) and has no stop control (the Architect amends ADR 0002). Story 2's confirm route stays owner only.
   *Proposed, not yet decided:* story 5 folds ledger `2026-09-28-confirm-route-joins-finishing-job`. *(The owner's
   decisions at story 4's Planning, 2026-09-30, apart from that proposal.)*
   **Carry-forwards from story 4's review** (placed by the owner 2026-10-01; `reviews/tagging-edges/4-tagging-pipeline-panel.md`
   § "Re-review, round 2", R2-1 to R2-14). Each becomes a docs, copy or test task of story 5. Line numbers are at
   `77ae0da4`; the review gives each one's evidence and ask in full.
   - *R2-1 (copy, ADR):* explain the Neo4j driver's own codes, `N/A` (an error with no code, such as a connection
     that opens but never answers) and `ProtocolError`, under `failureCode` and `countCode`, and name them in T12.
     Reword `no-status`: an error that did not come from the driver.
   - *R2-2 (copy):* `passOutcome.refused`, `passReason.read` and `passReason.plan` say "changed no relationship or
     person", not "changed nothing", since a schema step may create the one-per-tagging rule.
   - *R2-3 (copy, test):* a pass that never recorded its end (the pessimistic `stopped` record) shows its confirmed
     removals as a lower bound from its last save, not "applied none / N". Add a browser case beside B44.
   - *R2-4 (copy):* under `countsPredatePass`, drop "The explained part does not include them" from the path line
     (`DriftSection.jsx:81-85`).
   - *R2-5 (copy):* `passReason.stopped` puts the data-volume check first, and says the `TASK_ERROR` line may be
     missing on a full disk.
   - *R2-6 (panel, copy):* show `failure.message` and `failure.stderrTail` (already redacted) under "Where it failed",
     and stop pointing pass failures at "the task log" or `strfry-error.log`.
   - *R2-7 (docs, ADR):* the no-cors wording (`OPERATIONS.md:727`, ADR 0004 § Server) must not claim at most one count
     at a time: `inflight` clears when an answer settles, and an abandoned graph count can run beside the next.
   - *R2-8 (docs, ADR):* ADR 0002 decision 14 ("Until story 4"), the handoff's "Recommended shape for story 4", and
     ADR 0003:917's note ("two public routes") still describe story 4 as owning work now story 5's, or read wrongly.
   - *R2-9 (ADR):* T12's list of `error` fallbacks adds `fsFailure` (`reconcileTaggingEdges.js:102`).
   - *R2-10 (test):* browser case B50 for the held list's 404 restart when the status answer is overtaken.
   - *R2-11 (ADR, test):* ratify, or revert, T12's `ERR_` exclusion and the "`Security.Forbidden` is a permission"
     reading. Bring ADR 0004 § UI's FAMILIES line into step with T12, and pin both under both kinds.
   - *R2-12 (test plan):* add round 1's two unlisted readings (B47's opening read; B46's label only after a failure),
     and fix TV48's title (five flags).
   - *R2-13 (test):* the T12 guard's literal extraction notes, or checks, shapes it cannot see (`code: x || '…'`,
     inline ternaries).
   - *R2-14 (docs):* story 4 § Deviations' `CANONICAL_Z_RE` line cites row `2026-10-01-drift-copies-canonical-z-pattern`.

Order: 1 → 2 → 3 → 4 → 5 (4's page can start once 2's status shape is fixed; 5 builds on 4's panel).

## Key facts / guardrails

- **Taggings are not follows.** A follow list is one event per author and replaces the author's whole set; a
  tagging is one replaceable event per (tagger, target, tag) address. Copying the follows pipeline's
  replace-the-set logic, or its since-window diff, would delete a tagger's other taggings.
- **Two ways to un-tag.** A dispute republishes the same address with polarity -1 (a stance, kept); a revoke is
  a NIP-09 kind-5 deletion, which the relay honours by removing the event. Neither existing ETL leg reads
  kind 5 today.
- **The census (2026-09-26, prod / staging / tags — read-only):** ≈6,970 taggings on each host; ~91% are test
  fixtures (slugs carrying a millisecond timestamp); the real set is 595 taggings by 59 taggers about 349 people
  across 77 tags. 97% name their tag only by event id (e-only); 233 carry the tag's address; all but 6 resolve
  to a tag element present on the relay. Polarity: 4,938 apply / 1,759 dispute / 242 absent / 33 neutral "0".
  Exactly one `p` per event, always 64-hex; 62 self-taggings.
- **POV stays at read time.** The relationship stores a raw assertion — never a trust score, count, rank, tag
  name or "applied" flag (CLAUDE.md principles 1–3). Fixture and unknown-author taggings are accepted like any
  signed event; read-time trust filtering is what excludes them (principle 2).
- **Principle 4.** The relationships are re-derivable projections of relay events (BIBLE §30), but provenance
  marking does not exist yet: every delete must be scoped to this relationship type and a specific tagging, and
  a failed or empty relay read must never be taken as "everything was revoked".
- **The z namespaces.** Taggings carry the canonical `nostr-user-tag` concept stamp (the ADR 0015 literal,
  identical on every deployment) and, since 2026-06-17, also this deployment's own (runtime TA). Any use of the
  TA pubkey other than the ADR 0015 literal resolves it at runtime.
- **A writer refuses to start without both stamp pubkeys** (ADR 0001, review round). A writer started without one
  of the two stamp pubkeys would read every tagging that carries only the missing stamp as a non-tagging and retire
  its edge (without both, every edge); the writer refuses if *either* identity is missing or malformed — each must
  be lowercase 64-hex (story 2 checks both at startup, ADR `tagging-edges/0002`; story 3's real-time path waits in
  `waiting-setup`, writing nothing, ADR `tagging-edges/0003`). The mass-delete limit is the gap-filling pass's: it
  counts every removal per run. The real-time path's removals have no count limit (story 3's settled decision 4);
  each answers a revoke by the tagging's author (or, for a refused version, a version stored at the address) and a
  later successful relay read (ADR `tagging-edges/0003`, amending ADR 0001's R2-NB3 bullet).
- **Known defects in the follows pipeline stay out of this epic** (the relay-websocket gap in the strfry patch,
  the Redis client that never reconnects, at-most-once delivery, the stream and reconcile writers disagreeing
  on REPORTS' shape): they have ledger rows and are not copied — OPEN.md rows
  `2026-09-27-strfry-redis-misses-websocket-writes`, `2026-09-27-strfry-redis-never-reconnects`,
  `2026-09-27-stream-consumer-at-most-once` and `2026-09-27-reports-writers-disagree-on-shape`.
