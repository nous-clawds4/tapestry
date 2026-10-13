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

# Round 2

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader (no write access, no `npm test`). Every
claim below was re-derived from commands; I reproduced the reader's findings before recording them.
**Date:** 2026-10-13
**Diff:** `git diff 1e1c1e1 1249d7f`, attributed commit by commit:
- `eb166fa`, `6e39924`: ADR 0002 Amendment 1, proposed and then accepted. Docs only.
- `f7aaaa6`: the Tester's round 2 tests (R9–R13, E11–E14, C5–C6, V7–V12, Q3 re-aimed, D9, B22–B24) and the plan's
  Round 2 section. It touches no `src/` or `ui/`.
- `675ff93`, `0d0c848`: merges of `origin/staging`. Documents only (`duty-menus-and-self-maps` story 5 and its book
  closing).
- `1249d7f`: the fix: `dutyMenu.js`, `selfMap.js`, `selfMapPublish.js`, the page and its copy module, `openapi.yaml`,
  BIBLE §11, the story's Deviations, two ledger rows. It touches no `test/` or `tests/`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `1249d7f`, three runs.
  - The first two, `20261013T025711Z-5781-3dae [s2-r2-review]` and `20261013T030407Z-11978-bcf9
    [s2-r2-review-rerun]`, each failed RW7 (`tagging-edges-realtime-wrapper`) alone, at 0.77 s and at 0.73/0.77 s, while
    the independent reader was running beside them. The suite then passed alone, 24/0. Both occurrences are on ledger row
    `2026-10-08-realtime-wrapper-timing-flake-under-load`.
  - The third, on a quiet machine. `npm run gate:status`:

    > `20261013T031322Z-11940-f663 [s2-r2-review-quiet] started 2026-10-13T03:13:22.595Z on 1249d7f8+dirty — PASS, exit 0, 5948 passed, 0 failed, 582 skipped, 308/308 suites`

    The tree was dirty with the ledger row's occurrence note only.
- [x] **Test Design's red run exists as claimed:** `20261013T013927Z-11798-b4f1 [s2-r2-phase3]` on `6e39924`, FAIL, 13
  failed, all in the three self-map suites.
- [x] **Playwright, chromium.** `ui/` at `1249d7f` built to a scratch directory, served by `vite preview` on :4184
  (launched through node, so its pid was the server's; stopped by that pid). `assistant-self-map` (B0–B24) and the nine
  hub specs that share its fixtures (alert, attention, coming-soon, duty-menu, management-page, shared-categories,
  trusted-content, profile-check, duties-settings): **120 passed, 5 skipped** (their own skip conditions), 6.1 m.
- [x] `bash scripts/harness-lint.sh`: **clean**.
- [x] **Shared lines.** `git fetch origin staging` leaves `origin/staging` at `1854b5a`, already merged at `0d0c848`.
- [x] _Lint, typecheck, build: not configured — skipped._

## Round 1's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| **Blocking 1**, the press building over nothing | Round 1's `<scratch>/repro/f1.js`, run again unchanged; then `<scratch>/repro/r2.js`, fifteen cases against the real `lookupSelfMap` | Round 1's two cases now answer `{"finished":false,"reason":"no-relay-answered"}`. So do: the configured relays throwing; `lookupNewestReplaceable` throwing; the sole write relay refused by the guard; the write relay silent while a hint answers; a silent outside offer relay with no list to look on; the list found nowhere while a hint is silent. They finish as Amendment 1 says: a write relay answering empty (none), or holding a version (it); no outside relay at all; a list naming only this instance; a version here with discovery down (best-effort); and the hub's read without `forWrite`, unchanged. **Fixed as Amendment 1 words it**, but see R2-B1: the rule's item 1.1 has a gap of its own. |
| **Non-blocking 1**, a stale "already current" | Reading `selfMapPublish.js:181–190` against `ownsTag` and `readSelfEntries` | `stale` counts owned tags with the same `ownsTag` the merge uses. `parseKey` applies the same kind-slot test, so the self-entries found are always a subset of the owned tags. Owned minus found is exactly the nameless spellings plus exact duplicates. An empty target is unchanged. E11–E14 pin it. **Fixed.** |
| **Non-blocking 2**, a 500 after the choice | `selfMapPublish.js:176` before `:178`; the page's `REFUSALS` against the server's `CODES` | `isLocalOnly()` is read before `writeSelfMapChoice`. The page's four refusal codes are exactly the server's; a 500 sends no code, and a network throw or a non-JSON answer lands in `catch`, so all three refresh. openapi's 500 entry says the choice may have been remembered. **Fixed** (C5, C6, B23). |
| **Non-blocking 3**, Turn off while unfinished | `assistantTreasureMapCopy.js:160–161` | Off or unknown: `turnOff` is `finished !== true` or self-entries found. **Fixed** (Q3, B22), the story's Deviation (A1) recorded. |
| **Non-blocking 4**, the Owner's note | `AssistantTreasureMap.jsx:257` | It reads `user.classification === 'owner'`, inside the `hasAssistant` block, so `user` is always set there. **Fixed** (D9, B24). |
| **Non-blocking 5**, the dead seam | `grep getConfiguredPublishRelays src/api/assistant/selfMapPublish.js` | No match. **Fixed.** |
| **Harness friction 1**, the orphaned preview | This round's preview, launched through node | Its pid was the server's, and stopping it by that pid freed the port. The recipe holds. |

**ADR adherence, Amendment 1:**
- Item 1: `assistantWriteRelayLookup` (`dutyMenu.js:121–129`) and `strictOutsideRound` (`selfMap.js:283–312`) follow
  1.1–1.3 to the letter. The reader's oracle, written from 1.1–1.3, agreed with the code on 4,000 random worlds. Its
  in-memory differential of `0d0c848` against `1249d7f` found no change, over 3,000 worlds, in `lookupSelfMap` without
  `forWrite` or in `assistantWriteRelays`. The round 2 Deviation (a configured-relays throw is not finished) is
  stricter than the ADR, on the safe side.
- Items 2–6: as the table above.
- **No new dependencies.** Layering holds: `selfMap.js` still neither signs nor writes (story 1 S1).

## Findings

### Blocking

1. **R2-B1 — `src/api/assistant/dutyMenu.js:127` with `src/api/assistant/attention.js:225`, under ADR 0002
   Amendment 1 item 1.1. The press can still build over nothing after a strfry wipe while a full version sits on the
   Assistant's write relay.**

   **The gap.** Item 1.1 counts the relay-list lookup as finished whenever `lookupNewestReplaceable` answers
   `finished: true`. That function answers `{ finished: true, event: null }` as soon as *one* outside relay answers
   without the list (`attention.js:223–225`). So "one configured publish relay answered, and it doesn't hold the list"
   reads as "the Assistant has no write relays". W is then empty, rule 1.3 applies, and with the hints and the offer on
   this instance's own relay, O is empty too. Nobody asks the write relays.

   **Failure:**
   - strfry holds no copy of the Assistant's 10040 or 10002 (a wipe).
   - The profile publish relays are PUB1 and PUB2. PUB1 answers but lacks the list: it was added to the settings after
     the list was published, it dropped or refused it, or it is write-restricted. PUB2, which holds the list (write
     relay W1), doesn't answer within the budget.
   - W1 holds the real version: other entries, a `client` tag, private content.
   - Turn on signs a version with the self-entry alone and empty content, dated now, and stores it on this instance's
     relay. That version is newer than the real one, so every later press reads it as the version here (best-effort
     outside, newest wins). Once the list is found again, a press sends a version built on it to W1, and the real one is
     replaced there too.

   That is the loss AC-4 ("Never blind") and CLAUDE.md principle 4 forbid, and Amendment 1's own § Consequences (A1)
   line, "A press after a strfry wipe needs … one of its write relays to answer", is false here: none was asked.

   **Reproduced**, first by the reader and then by me:
   - `node <scratch>/repro/r2-f1.js <repo>`, on the real lookup modules: the relay-list lookup gives
     `{"finished":true,"relays":[]}`; the strict read gives `{"finished":true,"latest":null}`; the relays asked are
     `pub-one k10002` and `pub-two k10002`, and W1 is never asked.
   - `node <scratch>/repro/r2-f1-press.js <repo>`, the real `applySelfMap` over the real strict read: `published: true`,
     "There was no other relay to send it to.", signed tags `[["39998", A]]` with content `""`, while the version on W1
     had `30382:rank`, `client` and `39998`, with private content.

   **Asked change.** The gap is in Amendment 1's rule, so it goes back through the phases, as round 1's did.
   - **Architecture (Amendment 2).** With `forWrite` and nothing here, a relay list found nowhere is a finished answer
     only when every outside configured publish relay answered. Otherwise it is `no-relay-answered`. The reader also
     suggested adding the configured publish relays to O; that alone doesn't close this case, since PUB1 would answer
     the 10040 read empty too. Two neighbouring points for the Architect:
     - A relay-settings read failure is "nothing configured" today: `readConfiguredRelays` (`profilePublish.js:72–80`)
       swallows it into `[]`, so the lookup answers `no-outside-relays`. So the round 2 Deviation's throw branch is
       unreachable with the real reader. The press stays safe only because `resolveOfferInputs` reads the same settings
       through `readAssistantDuties` and throws. Say whether the strict path may lean on that, or must tell a failure
       apart.
     - Correct § Consequences (A1)'s wipe line to what the amended rule guarantees.
   - **Test Design.** At least: nothing here, one publish relay answering without the list and the other silent, gives
     503 not-read with nothing changed (publish suite), and the same directly on `lookupSelfMap` (check suite). Keep a
     finished case: every publish relay answering without the list, with W then empty and O empty, still builds.
   - **Implementation.**

### Non-blocking

1. **R2-N1 — no `forWrite` test pins "guard before connect".** V8 and R10 check only that a write relay the guard
   refuses counts as unanswered. The reader compiled a mutant of `selfMap.js` in memory whose `readGuarded` reads first
   and checks the guard afterwards (an SSRF regression): on V8's world it answered the same, and connected to
   `a-write.example`. I confirmed by reading that neither test inspects the relay reads (`test/assistant-self-map-check.test.js`
   V8 asserts only `got`; `mustRefuseRead` checks the answer and that nothing was done). The hub's read has this check
   (the U-test reading `REFUSED_HINT`); the strict read doesn't. **Fold into R2-B1's Test Design:** assert that no
   refused host appears in the reads.
2. **R2-N2 — `src/api/openapi.yaml:804–805` and the BIBLE §11 row (`BIBLE.md:531`) omit Amendment 1 item 2.** Both say
   the press "publishes nothing when the self-entries found are already the target". Neither says that, for a target
   that is not empty, an `expiration` or another owned tag beside them makes it publish. The module header has it right.
   **Fold into R2-B1's Implementation**, which edits both lines anyway.
3. **R2-N3 — while on, the page can't reach item 2's clean-up.** `selfMapButtons` enables Update now only when
   `current !== true` (`assistantTreasureMapCopy.js:160`), and `current` compares the self-entries alone
   (`src/lib/self-map/index.js:527`). So with matching entries plus an expiration, Update now is disabled and the hub
   shows done; only Turn off, then Turn on, clears it. Only a version this press didn't build can carry either, and an
   expired claim then reads as not published, which re-enables the press. **Optional:** the Architect's call in
   Amendment 2, or story 3's upkeep, which reads `current` too.
4. **R2-N4 — Turn on looks the relay list up twice** (`selfMapPublish.js:222`, after the strict read's own lookup).
   If the second lookup fails, the version isn't sent to W, though the strict read found W a moment earlier. The send
   is best-effort and this predates round 2. **Optional:** carry the strict read's W into the send set.

### Harness friction

None new. RW7 failed in two of this round's three full runs, both beside the reader, and passed alone each time; both
are on its row.

## Verdict

**CHANGES_REQUESTED**

Round 2 fixes everything round 1 asked for, and each fix holds when re-derived:
- Blocking 1's reproduced cases now refuse;
- the stale "already current", the 500 after the choice, Turn off while unfinished, the Owner's note and the dead seam
  are all fixed as Amendment 1 says;
- the gate passes (5948 / 0), and the browser specs pass (120 / 0, 5 skipped).

But the strict read is still not "never blind". Amendment 1 trusts a relay-list lookup that finished on one relay's
empty answer, so after a wipe, with the relays that hold the list silent, Turn on signs the self-entries alone over a
version that exists on the Assistant's write relay. That replaces this instance's own Treasure Map entries and the
private content, which is round 1's Blocking 1 by another road. The gap is in the amendment's rule, so the fix goes to
the Architect (Amendment 2), then the Tester, then the Implementer (R2-B1). R2-N1 and R2-N2 can ride the same round.

## On PASS (same commit)

- [ ] Completion detection. *Not applicable this round.*
- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED. The story stays `Approved`,
      and its `- Review:` link already points here.*
