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

# Round 3

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader (no write access to the repo, no
`npm test`). Every claim below was re-derived from commands, and I reproduced the reader's findings before recording
them. The optional independent check of the review's own claims (workflow 5, added at `22948d4`) was not applied: this
is not a docs-mode story, and every finding is reproduced by a script.
**Date:** 2026-10-13
**Diff:** `git diff 3a96fba 665b2c2`, attributed commit by commit:
- `8f39695`, `aecb47b`: ADR 0002 Amendment 2, proposed, then accepted; two ledger rows for R2-N3 and R2-N4; the story's
  ADR link. Docs only.
- `c1e94ca`: the Tester's round 3 tests (R14, R15, V13–V16; R10 and V8 extended) and the plan's Round 3 section. It
  touches no `src/` or `ui/`.
- `8fb3161`: a merge of `origin/staging` at `9679668`. Docs, harness and ledger files only
  (`git diff --name-only 8fb3161^1 8fb3161`).
- `665b2c2`: the fix in `attention.js`, `dutyMenu.js` and `selfMap.js`; `openapi.yaml`; BIBLE §11; the book's
  shared-line note. It touches no `test/` or `tests/`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `665b2c2`, clean tree, quiet machine. `npm run gate:status`:

  > `20261013T042903Z-18038-f573 [s2-r3-review] started 2026-10-13T04:29:03.384Z on 665b2c2b — PASS, exit 0, 5954 passed, 0 failed, 582 skipped, 308/308 suites`

  It matches the Implementer's `20261013T042018Z-14349-3160` (PASS, 5954/0). Test Design's red run
  `20261013T035809Z-10560-24b8` exists as the plan records it: FAIL, 4 failed, in the two self-map suites.
- [x] **Playwright, chromium.** `ui/` is unchanged since `1249d7f` (`git diff 1249d7f 665b2c2 -- ui` is empty). I built it
  at `665b2c2` anyway and served it with `vite preview` on :4184, launched through node and stopped by its pid (the port
  then freed, and no preview process was left). `assistant-self-map` and the nine hub specs: **120 passed, 5 skipped**
  (their own skip conditions), 6.1 m.
- [x] `bash scripts/harness-lint.sh`: **clean**.
- [x] **Shared lines.** `origin/staging` is still at `9679668`, merged at `8fb3161`. `attention.js` on staging is
  identical to the branch's before round 3 (`git diff origin/staging 8fb3161 -- src/api/assistant/attention.js` is
  empty).
- [x] _Lint, typecheck, build: not configured — skipped._

## Round 2's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| **R2-B1**, the relay list found nowhere on one answer | `<scratch>/repro/r2-f1.js` and `r2-f1-press.js`, run again unchanged; a scratch worktree at `665b2c2` with the strict read's `everyRelay: true` removed | The strict read now answers `{"finished":false,"reason":"no-relay-answered"}`, and the press `{"refusal":{"status":503,"code":"not-read"}}` with nothing signed. With the flag removed, V13 and R14 fail. The reader's differential of `lookupSelfMap` at `3a96fba` against `665b2c2`, over 3,000 random worlds, found 85 differences. All are `665b2c2` refusing in the class "list found nowhere, one configured outside relay silent"; that class held 97 worlds, and none of them finished. **Fixed as Amendment 2 item 1 words it.** But see R3-B1: the same gap one level down. |
| **R2-N1**, guard before connect | The same worktree, with `readGuarded` reading before the guard | V8 and R10 both fail: "no read of the write relay the DNS guard refused, got [\"wss://a-write.example\"]". The reader's in-memory mutants agree: seven mutants, each caught by at least one round 3 test, and none by `665b2c2`. **Fixed.** |
| **R2-N2**, the records | Reading `openapi.yaml:798–806` and `BIBLE.md:531` against `selfMapPublish.js:181–190` and `attention.js:226–231` | Both now name Amendment 1 item 2's exception and Amendment 2's rule. The YAML still parses. **Fixed**, with two nits (R3-N2, R3-N3). |
| **R2-N3, R2-N4** | `ledger/2026-10-13-self-map-current-ignores-expiration.md`, `ledger/2026-10-13-self-map-send-relooks-write-relays.md` | Both rows exist, **OPEN**, and are named in Amendment 2 item 6. |

**ADR adherence, Amendment 2:**
- Item 1: `lookupNewestReplaceable` takes `everyRelay` (`attention.js:210`, check at `:230`).
  `assistantWriteRelayLookup` passes it through (`dutyMenu.js:122–127`), and only `strictOutsideRound` sets it
  (`selfMap.js:289`). The reader's differential of the old code against the new, over 4,000 worlds, found no change in
  `lookupNewestReplaceable` without the flag or with it false, in `assistantWriteRelayLookup` and `assistantWriteRelays`
  without it, or in `nousWriteRelays`. An oracle written from item 1 agreed with `everyRelay: true` in every world, and
  the flag changed the answer in 670 of them.
- Items 4 and 5: as the table above.
- **No new dependencies.** Layering holds.

## Findings

### Blocking

1. **R3-B1 — `src/api/assistant/selfMap.js:308–309`, under ADR 0002 Amendment 1 items 1.2 and 1.3, unchanged by
   Amendment 2. One write relay that answers stands in for all of them, so the press can still build over nothing
   while the full version sits on a write relay the Assistant's current relay list names.**

   **The gap.** With nothing here, the read finishes when *one* write relay answers (item 1.2), or, with no write
   relays, one hint or offer relay (item 1.3). Amendment 2 item 1 gives the reason a single answer can't stand for a
   silent relay: the answering one "could have been added after …, dropped or refused it, or accept no such events".
   That reason applies word for word to a write relay and the kind 10040. Each version goes to every write relay named
   at publish time, so a write relay added to the list since, or one that refuses or drops kind 10040, answers empty
   while the ones holding the version may be silent.

   **Failure:**
   - strfry holds no copy of the 10040 or the 10002 (a wipe).
   - The current relay list, found on a publish relay, names W_OLD and W_NEW. W_NEW answers and holds no 10040; W_OLD
     holds the full version and is silent.
   - The read finishes with no version, and Turn on signs the self-entry alone, with empty content.

   This is not one of Amendment 2 item 3's two limits: the list here is the current one, not an older one. Item 3's
   guarantee, "It builds from nothing only when those places hold nothing" (ADR line 647), and the comment at
   `selfMap.js:33`, "So the press never builds over nothing", are false here. It is the same loss as round 1's
   Blocking 1 and R2-B1, by a third road. The hints have the same gap: with no list anywhere and every publish relay
   answering, one hint answering empty stands in for a silent hint that holds the version.

   **Reproduced**, first by the reader (`<scratch>/reader3/a-strict-battery.js`, its S9/P9 and S10/P10) and then by me:
   `node <scratch>/repro/r3-f1-f3.js <repo>`, on the real `lookupSelfMap` and `applySelfMap`, gives
   - `F1 strict read: {"finished":true,"latest":null}`;
   - `F1 Turn on: published=true tags=["39998"] content=""`, while the version on `w-old` had `["30382:rank","client","39998"]`
     with private content.

   I re-derived Amendment 1 item 1.2 in round 2 and recorded it as fixed. I didn't challenge "one answer suffices",
   and neither did round 2's reader.

2. **R3-B2 — ADR 0002 Amendment 2, "The cost, accepted" (line 580) and § Consequences (A2) (line 705). The cost the
   owner approved is misstated. It reaches every first Turn on of an Assistant with no published relay list, with no
   wipe involved.**
   - Only `src/api/assistant/relayListPublish.js:126` signs a kind 10002: the Outbox Relays page. So an Assistant
     whose owner never used that page has no relay list anywhere.
   - Before its first press, there is no kind 10040 on this instance either. So the strict read needs every configured
     outside publish relay to answer: six public relays with the shipped settings.
   - With one of them silent, the person's first Turn on is refused with 503 not-read, in the words "Nothing was
     published: your Assistant's current Treasure Map could not be read, and publishing without it could lose its other
     entries." The Assistant has no Treasure Map yet.
   - Amendment 2 scoped the cost to "After a wipe, with no relay list anywhere", and the owner approved it on that
     wording. A cost the owner didn't knowingly accept goes back to the owner.

   **Reproduced**, by the reader (`<scratch>/reader3/g-first-press.js`) and by me (`r3-f1-f3.js`):
   - `F3 first Turn on, 1 of six publish relays silent: refused 503 not-read`;
   - `0 of six silent: published=true`.

**Asked change.** Both are in the ADR's rule and its stated cost, so they go back through the phases.
- **Architecture (Amendment 3).** Three rounds have each found one more place where one answer stands in for a silent
  relay that may hold the version: the relay list, then the write relays, then the hints. I recommend the Architect
  settle the whole class at once rather than this case alone:
  1. Say once what the strict read needs before it may conclude "no version anywhere".
  2. Cost that rule honestly: on first presses, on Assistants without a relay list, and with relays that stay down.
  3. Put the trade-off to the owner: refuse more often, or accept named risks.

  Some directions for the Architect to weigh, not a decision:
  - every member of the set the conclusion rests on must answer: W when W isn't empty, else O;
  - a local record that tells a first press for this Assistant from a press after a wipe. The choice file is written
    before anything is published, but it lives on the same data volume, so it may be lost with strfry;
  - keep "at least one", with the limit named in the guarantee and in the code comment, if the owner accepts the risk.

  Whatever is chosen, correct Amendment 2 item 3's guarantee, its "cost, accepted", § Consequences (A2), and
  `selfMap.js:33` to what the code then does.
- **Test Design and Implementation**, as the amendment decides.

### Non-blocking

1. **R3-N1 — ADR 0002 Amendment 2 item 2 (lines 614–627): "a settings read never throws" is false for one input.** An
   override file that holds the JSON `null` makes `getSettings()` throw: `deepMerge` calls `Object.keys(null)`
   (`src/config/settings.js:77`).
   - `readConfiguredRelays` swallows the throw (`profilePublish.js:75–80`), so the lookup reads `no-outside-relays`,
     and the strict read alone finishes with no version.
   - Both presses are refused only because `resolveOfferInputs` reads the same settings through `readAssistantDuties`
     (`dutyMenu.js:77`) and throws first: a 500, with nothing written. That is the coupling item 2 says no press leans
     on.
   - Every other bad file reads as the shipped defaults: missing, torn, a number, a string or an array. The app never
     writes `null` (`saveOverrides` is given an object), so only a hand edit gets there.

   **Reproduced** by me: `<scratch>/settings-probe` gives `"null" -> THROWS: Cannot convert undefined or null to
   object`, and `TAPESTRY_SETTINGS_PATH=<null file> node <scratch>/repro/r3-null-settings.js <repo>` gives both presses
   "threw (the handler answers 500)", with `choice writes / imports / publishes: []`. The reader got the same with
   `<scratch>/reader3/d-settings.js` and `e-settings-press.js`.

   **Fold into Amendment 3:** correct item 2's text. Hardening `loadOverrides` would be a change to shared settings
   code; the Architect decides.
2. **R3-N2 — "every configured publish relay" should say "every outside configured publish relay".** The code counts
   only the outside ones: `outsideOnly` drops this instance's own, and none outside is `no-outside-relays`, which counts
   as finished. The places are `openapi.yaml:801–802`, `BIBLE.md:531`, `selfMap.js:32` and `:279`, and
   `dutyMenu.js:118`. **Fold into the next push that edits them.**
3. **R3-N3 — `src/api/openapi.yaml:806` is 172 characters,** inside a folded scalar, where the rest of the paragraph wraps
   near 120. It parses, and the description reads as intended. The comment at `selfMap.js:280` was left short by the
   rewrap above it. **Fold into the next push that edits them.**

### Harness friction

None new. This round's gate passed on the first run, on a quiet machine, with the reader started only after it.

## Verdict

**CHANGES_REQUESTED**

Round 3 fixes what round 2 asked for, and each fix holds when re-derived:
- R2-B1's case now refuses;
- the guard-before-connect assertions catch the mutant;
- the records name both rules;
- every other caller of the shared lookup answers as before (4,000 worlds, 0 differences);
- the gate passes (5954 / 0), and the browser specs pass (120 / 0, 5 skipped).

But the strict read still isn't "never blind". One write relay answering empty stands in for a silent one holding the
version, so after a wipe Turn on can sign the self-entry alone over this instance's own Treasure Map (R3-B1). And the
cost Amendment 2 asked the owner to accept is wider than stated: every first Turn on of an Assistant without a relay
list needs all six shipped publish relays (R3-B2). Both are in the ADR's rule and its claims, so the fix goes to the
Architect, who settles the whole class with the owner (Amendment 3), then the Tester, then the Implementer.

## On PASS (same commit)

- [ ] Completion detection. *Not applicable this round.*
- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED. The story stays `Approved`,
      and its `- Review:` link already points here.*

# Round 4

**Reviewer:** Claude (acting as Reviewer), with a second, independent reader (no write access to the repo, no
`npm test`; its scripts used temp store paths only). Every claim below was re-derived from commands, and I reproduced
the reader's findings, by my own scripts or by rerunning its own, before recording them. The optional independent
check of the review's own claims (workflow 5) was not applied: this is not a docs-mode story, and every finding is
reproduced by a script.
**Date:** 2026-10-13
**Diff:** `git diff 888249f c29586a`, attributed commit by commit:
- `ca670b1`, `a615c39`: ADR 0002 Amendment 3, proposed, then accepted; the settings-null ledger row; the story's ADR link.
  Docs only.
- `8003eef`: the Tester's round 4 tests (K6–K9, R16–R20, C7, C8, C10–C12, S6, V17, V18; C1 re-aimed; `pressDeps` fakes
  the copy store) and the plan's Round 4 section. It touches no `src/` or `ui/`.
- `c29586a`: the fix in `selfMapChoice.js`, `selfMap.js` and `selfMapPublish.js`; a comment in `dutyMenu.js`;
  `openapi.yaml`; BIBLE §11 and §15; the story's round 4 Deviations; the book's shared-line note. It touches no `test/`
  or `tests/`.

## Quality gates (run by reviewer, not trusted)

- [x] **`npm test`** on `c29586a`, clean tree, quiet machine. `npm run gate:status`:

  > `20261013T124340Z-5751-1b9c [s2-r4-review] started 2026-10-13T12:43:40.862Z on c29586a7 — PASS, exit 0, 5971 passed, 0 failed, 582 skipped, 308/308 suites`

  It matches the Implementer's `20261013T055714Z-14295-0834` (PASS, 5971/0).
- [x] **Playwright, chromium.** `ui/` is unchanged since `1249d7f`. I built it at `c29586a` and served it with
  `vite preview` on :4184, launched through node and stopped by its pid (the port then freed). `assistant-self-map` and
  the nine hub specs: **120 passed, 5 skipped** (their own skip conditions), 5.7 m.
- [x] `bash scripts/harness-lint.sh`: **clean**.
- [x] **Shared lines.** `origin/staging` is still at `9679668`, merged at `8fb3161`.
- [x] **No test wrote to the data volume:** `/var/lib/brainstorm/assistant-self-map.json` does not exist after the runs.
- [x] _Lint, typecheck, build: not configured — skipped._

## Round 3's findings, each re-derived as a fresh claim

| Finding | Re-derived by | Result |
|---|---|---|
| **R3-B1**, one answering relay standing in for a silent one | `<scratch>/repro/r4-copy.js`, round 3's world on the real press, with and without a copy; R17 | With a copy, the press reads the full version from it and never builds from nothing. In this world the copy already says what should be said, so the press answers "already current" (but see R4-B2). Without a copy (a first press), it still builds from nothing: Amendment 3 item 2's first named limit, which the owner accepted with "Stay strict". **Fixed for every Assistant pressed here before the loss.** |
| **R3-B2**, the first press's cost | Amendment 3 item 3 | Stated in full, and the owner's "Stay strict" is recorded. First presses keep R9–R15, which pass unchanged. **Settled.** |
| **R3-N1**, a settings read that throws | C11 (both presses, with and without a copy); `ledger/2026-10-13-settings-null-override-throws.md` | 500 with nothing written; the row is OPEN. **Pinned.** |
| **R3-N2**, "outside configured" | `openapi.yaml:803`, `BIBLE.md:531`, `selfMap.js:33` and `:284`, `dutyMenu.js:118` | All say "outside configured". **Fixed.** |
| **R3-N3**, the long line | S6; `awk` over the press description | The description wraps. But the strictOutsideRound comment now has a 152-character line, `selfMap.js:287` (R4-N5). |

**ADR adherence, Amendment 3.** The code follows items 1–5 to the letter, in the ADR's order:
1. check the copy;
2. the strict read with `stored`;
3. verify the base;
4. keep the version found;
5. the publish policy and the choice;
6. step 3;
7. sign and check;
8. keep the signed version;
9. import;
10. fan out.

The reader walked the same order. It also found:
- the store writes atomically, mode 0600, under the shared lock;
- `writeSelfMapChoice` is byte-for-byte as before on a file without `lastSigned`;
- the hub's read is unchanged (V18).

My six mutants of the round 4 code:

| Mutant | Caught by |
|---|---|
| no signed-copy write | C7, C10, C12 |
| the found-copy write moved after the choice | C7, C10 |
| `stored` not passed by `gatherSelfMap` | R16, R17, R18 |
| `checkedCopy` without the signature check | **nothing** (R4-N2) |
| `stored` ignored by `lookupSelfMap` | R16, R17, R18, V17 |
| the store without the newer-only rule | K7 |

The two blocking findings below are in Amendment 3's rule, not in a deviation from it.

## Findings

### Blocking

Both have one root. Step 3, "nothing to change" (`selfMapPublish.js:208–210`), compares the target with the base,
wherever the base came from. Since Amendment 3, the base can be the copy (`selfMap.js:262`), which may sit on no relay
at all, or on none of this instance's. Then the press answers "nothing to change" while this instance's relay, and
everyone who reads it, still holds the older version or none. Amendment 3 item 1 step 3 called a copy that a failed
import never stored "harmless" (ADR line 779). It missed this consequence of step 3.

1. **R4-B1 — a failed local import leaves a copy that exists nowhere, and every retry then reports "nothing to do".**
   - **The order:** the signed version is kept as the copy before the import (`selfMapPublish.js:228`, then `:234`).
   - **Press 1:** the import fails, so the press answers `ok: false, stage: local`, as C2 expects. But the copy now holds
     the unstored version.
   - **Every later press with the same target:** the base is the copy, its self-entries equal the target, and the press
     answers `already-current`, or `nothing-claimed` for Turn off, publishing nothing.
   - **What the person sees:**
     - this instance's relay keeps the old version;
     - story 1's check says out of date, with Update now enabled;
     - for Turn off, "the version found still claims duties", with Turn off shown;
     - each press then says it changed nothing.
   - **What it breaks:** AC-2 ("so no claim can be stuck"), AC-3's read-back and AC-5. The only way out is toggling.
   - **Reproduced** by me with `node <scratch>/repro/r4-import-fails.js <repo>`:
     - `press 1 (import fails): {"ok":false,"stage":"local","published":false}`, with the copy holding the self-entry;
     - `press 2 (import works): {"ok":true,"published":false,"unchanged":"already-current"}`;
     - `relay self-entries: []`, and story 1's read `[]`.

     The reader got the same for both presses (`<scratch>/reader4/f1-failed-import-then-retry.js`, rerun by me: Turn
     off answers `nothing-claimed` twice while the relay still claims), and with the real store at a temp path
     (`f1b-failed-import-real-store.js`).
2. **R4-B2 — after a strfry wipe, when the copy's self-entries are already the target, Update now says "already
   current" and puts nothing back on this instance's relay.**
   - This is the case Amendment 3 was written for. Story 1's check finds no self-Map (`published: null`, out of date),
     and every press answers `already-current`.
   - Before round 4, the same world with the outside silent answered an honest 503. The sub-case where an outside relay
     answers with the newest version, the press says already current, and nothing is re-stored here, already existed.
     It has the same root.
   - **Reproduced** by me with `node <scratch>/repro/r4-wipe-same-target.js <repo>`:
     - `story 1's read after the wipe: {"finished":true,"published":null}`;
     - `Update now: {"ok":true,"published":false,"unchanged":"already-current"}`;
     - `this instance's relay holds A's 10040 afterwards: false`.

     The reader got the same (`<scratch>/reader4/f2-wipe-then-same-target.js`), with the outside silent and with it
     answering.

**Asked change.** The rule is the ADR's, so it goes back through the phases.
- **Architecture (Amendment 4).** "Nothing to change" should require that this instance's relay holds the base. For
  example, the base's id is in this instance's scan, which `lookupSelfMap` could report beside `latest`. Otherwise the
  press builds, signs and stores a new version (or re-stores the base as it is) and fans out, so this instance's relay
  and its readers converge.
  - That one rule closes R4-B1 and R4-B2, and the older outside-newer sub-case too.
  - Moving the signed-copy write after the import would close only R4-B1. It would also contradict C7 and Amendment 3
    step 3's clean 500.
  - Correct item 1 step 3's "harmless".
- **Test Design.** At least:
  - a failed import, then a retry, for Turn on and Turn off;
  - a wipe where the copy already says the target;
  - an outside version newer than this instance's, already saying the target.

  Each should end with this instance's relay holding a version whose self-entries are the target (or none, for Turn
  off), and the report saying it was published.
- **Implementation**, as the amendment decides.

### Non-blocking

1. **R4-N1 — a stored copy that fails the press's check is never replaced.**
   - `writeSelfMapCopy` compares a newer event against the raw stored entry (`selfMapChoice.js:170`), but the press
     reads such an entry as no copy.
   - So a stored `{}`, or an entry with a huge `created_at`, silently blocks every later copy write, even after a
     publish. So does a damaged copy of this instance's own version, with the same id and `created_at` but a broken
     signature.
   - The safety net is then off for that Assistant, and a press after a wipe falls back to the first-press rules.
   - It needs disk damage or a hand edit.
   - **Reproduced** with the reader's `<scratch>/reader4/s-store.js`, rerun by me:
     - S3: `stored entry {}: … replaced=false`, and the same for `created_at: 9999999999`;
     - S5: the damaged copy stays, and after a wipe the press answers 503.

   **Fold into Amendment 4:** let a press replace a copy that failed its check.
2. **R4-N2 — R20 doesn't pin the copy's check.**
   - With `checkedCopy`'s signature check removed, every test passes (my mutant M4). The base check refuses a tampered
     base anyway, and `mine` drops another Assistant's copy.
   - A world that tells them apart: a tampered copy newer than a valid version here. The real code builds on this
     instance's version, and the mutant answers 503 on every press. The reader's
     `<scratch>/reader4/m1-checkedcopy-verify-mutant.js`, rerun by me, gives:
     - `real: … 200 published=true`;
     - `mutant: … 503 "not-read"`.

   **Fold into the next Test Design.**
3. **R4-N3 — K9 doesn't pin the shared lock.**
   - The store's work is synchronous inside one `.then`, so a copy write without the lock passes it. The reader's
     `m2-lock-mutant.js`, rerun by me: `lost writes: 0 … (K9 would PASS)`.
   - A nit: the lock is there, and it is read-only reviewable.
4. **R4-N4 — a `lastSigned` that isn't an object is untested.** It makes every press that finds a version answer 500
   before the choice, until the file is fixed. That is the same posture as a choice file that isn't the shape, and the
   story's Deviations record it.
   - Its log line says "the choice file cannot be read" (`selfMapChoice.js:93`), which misleads.
   - **Reproduced** by the reader's `s-store.js` S4, rerun by me.

   **Fold:** a K case, and a log line that names `lastSigned`.
5. **R4-N5 — nits.**
   - `selfMap.js:287` is 152 characters inside a comment wrapped near 120.
   - The copy, folded into `here`, is reported as `published.source: 'local'` (`selfMap.js:318`) even when it sits on no
     relay. That is part of R4-B1's root.
   - The story's round 4 Deviation, "The press goes on under the first-press rules" (line 290), is true only when this
     instance's relay also holds nothing.

### Harness friction

None new. This round's gate passed on the first run.

## Verdict

**CHANGES_REQUESTED**

Round 4 closes round 3's blocking finding as Amendment 3 intended. With a copy, the press never builds from nothing, and
never builds over an older restore. The code follows the amendment to the letter. The gate passes (5971 / 0), and the
browser specs pass (120 / 0, 5 skipped).

But the copy also became a base the press trusts for "nothing to change", and it may sit on no relay. A failed local
import (R4-B1), or a wipe where the copy already says what should be said (R4-B2), leaves the press answering "already
current" or "nothing claimed" on every retry. Meanwhile this instance's relay, story 1's check and every reader keep the
old version, or none. The rule is in Amendment 3 item 1 and step 3, so the fix goes to the Architect (Amendment 4), then
the Tester, then the Implementer. R4-N1, R4-N2 and R4-N4 can ride the same round.

## On PASS (same commit)

- [ ] Completion detection. *Not applicable this round.*
- [ ] Story `**Status:**` flipped to `Done` in place. *Not applicable: CHANGES_REQUESTED. The story stays `Approved`,
      and its `- Review:` link already points here.*
