# Review: Story 2 — Turning your Assistant's self-Map on and off

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader (no write access, no `npm test`), whose
findings I reproduced before recording them.
**Date:** 2026-10-13
**Diff:**
- **Implementation:** `git diff 915465e f9003f5`.
- **Tests:** `git diff 66e2382 6e02e7b`.
- **Reviewed at** `8f9087a`, which merges `origin/staging` at `603ee51`: documents only, the
  `assistant-duties-settings` book closing.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`:** PASS. `npm run gate:status`:
  `20261013T001131Z-27221-be26 [s2-review] … on 8f9087a0 — PASS, exit 0, 5930 passed, 0 failed, 582 skipped, 308/308
  suites`.
- [x] **Playwright, chromium.** I built `ui/` at `8f9087a` (`vite build` to a scratch directory) and served it with
  `vite preview` on :4184. Then I ran:
  - `tests/brainstorm/assistant-self-map.spec.js`;
  - the nine other hub specs that share its fixtures (alert, attention, coming-soon, duty-menu, management-page,
    shared-categories, trusted-content, profile-check, duties-settings).

  117 passed and 5 skipped (their own skip conditions).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence

| AC | Tests | Met? |
|---|---|---|
| AC-1: the remembered choice | K1–K5, C1–C4, V1–V2, S4 | **Met.** `src/api/assistant/selfMapChoice.js` writes atomically under a lock. `selfMapOn` rides the answer (`selfMap.js` `checkSelfMap`). |
| AC-2: buttons and report | Q1–Q3, D4, D7, D8, E3–E5, W6, W7, B12, B14–B21 | **Met.** One edge, non-blocking 3: Turn off doesn't show while off if the check did not finish. That matches ADR sub-decision 7. |
| AC-3: whose key, what is signed | P1–P5, H1–H2, E9, S1–S3 | **Met.** |
| AC-4: nothing else is lost | M2–M5, E1, E2, E10, R1–R8, V3–V5, L1–L2 | **Not met in one case** (Blocking 1). "Never blind" fails when this instance holds no version and the lookups that would name the outside relays fail. |
| AC-5: off | E6–E8, V3, B17, B19 | **Met.** No retraction, no deletion. An empty Map stays an empty Map. |
| AC-6: where it goes | W1–W7, C2 | **Met.** |

No behaviour beyond the story.

## ADR adherence

- [x] **Files and functions** match § Implementation notes 1–9:
  - `ownsTag`, `keptTags` and `buildSelfMapEvent` in the library;
  - `gatherSelfMap`, `forWrite`, the `mapHints` filter and `selfMapOn` in `selfMap.js`;
  - the two new server modules;
  - the route and its table entry, the UI helper, the copy helpers and the page;
  - the records.

  `readUpkeep` is untouched (shared line).
- [x] **Layering.** `selfMap.js` and the library still neither sign nor write (story 1 S1 holds). Only
  `selfMapPublish.js` signs and only `selfMapChoice.js` writes the choice file.
- [x] **No new dependencies.**
- [ ] **Sub-decision 3's finish rule is followed to the letter, and the letter has a gap** (Blocking 1).

## Concept-graph integrity

- [x] No concept, handle or firmware change. No reinstall needed.

## Things tests can't catch

- [x] No secrets, no debug leftovers, no commented-out code. The press logs one line per press and one per relay that
      didn't accept, as the Duty Menu route does.
- [x] **Input validation at the boundary.** Only a boolean `on` is read. Extra fields can't steer the key, the entries or
      the relays (P5).
- [x] **SSRF.** Every relay named in an event is DNS-guarded within one budget and capped at 50. Owner-set offer
      relays are sent as such, as in the Duty Menu route.
- [x] **Concurrency.** `withAssistantLock` serializes presses per Assistant and recovers after a rejection (L1, L2). The
      choice store has its own lock (K5).
- [ ] **Error paths.** See Blocking 1 and non-blocking 2.

## House rules check

- [x] Concept Graph API authority respected (not touched).
- [x] No new lint/typecheck/build tooling.

## Findings

### Blocking

1. **`src/api/assistant/selfMap.js:256–270` (`lookupSelfMap`, `forWrite`), with ADR 0002 sub-decision 3.** The press
   can build over nothing while a full version exists outside.

   **The rule:** with `forWrite`, a read with no local version finishes when the outside set is empty ("or there was
   none to ask"). But that set is shrunk silently, in three ways:
   - a relay-list lookup that does not finish becomes `[]`. `assistantWriteRelays` answers `[]` for an unfinished
     lookup, and `attempt(…, [])` hides a throw;
   - a DNS check that throws drops its relay (`attempt(…, null)`);
   - `outsideOnly` removes hints and offer relays that are this instance's own.

   On a deployment like staging, the offer's relays are this instance's own. So the Assistant's write relays are often
   the only outside places to ask.

   **Failure:**
   - strfry holds no copy of the TA's 10040 (a wipe, a rebuild, or an older restore: the case R1 was written for). So
     it holds no copy of the TA's 10002 either.
   - The configured publish relays don't answer the relay-list lookup, or the resolver errors.
   - `lookupSelfMap` answers `{ finished: true, latest: null }`.
   - Turn on signs a version with the self-entries alone and empty content, dated now. Wherever it lands, it replaces
     this instance's own Treasure Map entries and the private content (CLAUDE.md principle 4; AC-4 "Never blind").

   **Reproduced** with the real `lookupSelfMap` and fakes for strfry, relays and DNS
   (`node <scratch>/repro/f1.js <repo>`):
   - `10002 lookup unreachable -> {"finished":true,"latest":null}`;
   - `DNS guard throws -> {"finished":true,"latest":null}`.

   R4 already shows that a finished "none" builds from nothing. The test plan's R3 covers only "relays exist and none
   answered".

   **Asked change.** This is a gap in the ADR's rule, so it goes back through the phases.
   - **Architecture.** Amend sub-decision 3 so that a failed discovery never reads as "nobody to ask". Recommended:
     with `forWrite` and no local version, the read finishes only when all three hold:
     - the Assistant's relay-list lookup itself finished;
     - no DNS check errored, as opposed to answering "not public";
     - when any event-named relay exists (write relays, hints), at least one of them answered. An answer from an
       owner-set offer relay alone should not stand in for the Assistant's write relays, which is where every version
       goes (AC-6).

     Otherwise it is `no-relay-answered`. Correct § Consequences' "a strfry wipe can't make the press build over
     nothing", which is false as written.
   - **Test Design.** New R-tests, at least these three:
     - no local version, and the relay-list lookup unfinished, gives 503 not-read with nothing changed;
     - no local version, and the DNS guard throwing, gives 503;
     - no local version, an owner-set offer relay answering empty and the write relays silent, gives 503 if the
       amendment says so.
   - **Implementation.**

### Non-blocking

1. **`src/api/assistant/selfMapPublish.js:181`. "Already current" can leave an `expiration` beside a self-entry.**
   - `sameSelfEntries(target, found)` compares the self-entries only. A version holding `["39998", A, R]` and an
     `expiration` answers `published: false, unchanged: 'already-current'`, so the claim still expires (§ 9.2, No
     expiration).
   - Owned tags that readers ignore (`39998:`) also stay.
   - Reproduced by reading the code; the second reader reproduced it with `applySelfMap`. Only a version this press did
     not build can carry either.
   - **Optional:** fold it into Blocking 1's amendment. When the target is not empty, publish anyway if the version
     carries an `expiration`, or more owned tags than `found`.
2. **`selfMapPublish.js:176–196` with `ui/src/pages/assistant/AssistantTreasureMap.jsx:168`. A 500 after the choice
   is written.**
   - The choice is remembered before `isLocalOnly()`, the signing and the preservation check. If one of those throws,
     the press answers 500 "nothing was published" with the choice flipped.
   - The page refreshes only on `success: true`, so its state line and buttons stay stale until a reload.
   - The openapi 500 entry doesn't say the choice may have changed.
   - **Optional:** read `isLocalOnly()` before the write, and either refresh after a 500 too or say it in openapi.
3. **`ui/src/pages/assistant/assistantTreasureMapCopy.js:132–160`. Turn off doesn't show while off when the check did
   not finish.**
   - This matches ADR sub-decision 7 ("only when the check finished and found self-entries"), and the Turn off press
     itself needs only the 10040 (R8).
   - So a viewer whose check never finishes, and whose choice reads off (say, after a lost choice file), can't remove
     claims that are still out there. The story's "no claim can be stuck" is met to the letter only.
   - **Optional:** an owner decision for story 3, or the amendment. Show Turn off whenever `selfMapOn !== true` and the
     check did not finish.
4. **`AssistantTreasureMap.jsx:255`. The Owner's note keys on `answer.instanceMap`**, which `SELF_MAP_CHECK_FAILED`
   sets false. After a thrown check the Owner sees Turn on without the note. Optional: read the Owner from the session
   or the check's `isOwner`.
5. **`selfMapPublish.js:111`. A dead seam:** `getConfiguredPublishRelays` is in `defaultDeps` but nothing in the
   module calls it (the Duty Menu route used it for Nous' relays, which this route doesn't read). Optional: drop it.

### Harness friction

1. **Stopping `vite preview` by pid can orphan the server.** The handoff's lesson is "stop it by pid, never with
   `pkill -f`". But `npx vite preview … & echo $!` records npx's pid, and killing it left vite's node process running,
   parented to init. That happened once in Implementation and was found and stopped by its own pid.
   - Also, `ss` is not installed in this container, so an `ss`-based "port free" check proves nothing.
   - Launching with `node ui/node_modules/vite/bin/vite.js preview … &` makes `$!` the server itself, and that worked
     here.
   - Ledger row `2026-10-13-vite-preview-pid-orphans`.

## Verdict

**CHANGES_REQUESTED**

The diff is clean and closely follows the ADR:
- the merge keeps every other tag and the content;
- the route can't be steered;
- every event-named relay is guarded;
- the lock and the choice store hold;
- the gate passes, and every browser spec passes.

But AC-4's "Never blind" fails in one reproducible case. With this instance's relay holding no version, a failed
relay-list lookup or a failing resolver makes the press build over nothing. That replaces this instance's own Treasure
Map entries, which is the loss the ADR's R1 read exists to prevent. The gap is in ADR 0002 sub-decision 3's rule, so
the fix goes back to the Architect, then the Tester, then the Implementer (Blocking 1). Non-blocking 1 can ride the
same amendment.

## On PASS (same commit)

- [ ] Completion detection. *Not applicable this round.*
- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED. The story stays `Approved`,
      and only its `- Review:` link is filled in.*
