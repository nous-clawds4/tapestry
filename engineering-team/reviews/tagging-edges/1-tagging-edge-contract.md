# Review: Story 1 — The tagging edge contract

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-27
**Verdict:** **PASS** (after re-review; see "Re-review (2026-09-27)" at the bottom. Round 1 was CHANGES_REQUESTED.)
**Diff:** the whole branch is `git diff 72469bde..7e18a404` on `feat/tagging-edges`. It has four commits: `60e33542` story, `03c75544` ADR (plus the one-line 0009 note), `491735fe` failing tests, and `7e18a404` implementation (`src/lib/tagging-edges/{contract,index}.js`, BIBLE §6/§21/§30 + Last updated, story Deviations). 11 files, 2,023 insertions, 2 deletions. The implementation commit touches no test file (`git diff --stat 491735fe..7e18a404`: BIBLE, story, contract.js, index.js). I re-checked the shared line: `git fetch origin staging` leaves `origin/staging` at `72469bde`, so the branch is 0 behind, and `git merge-tree --write-tree 7e18a404 origin/staging` exits 0.
**Story:** `engineering-team/stories/tagging-edges/1-tagging-edge-contract.md` (Approved 2026-09-26; Architecture-gate ruling 2026-09-27)
**ADR:** `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md`, including "Clarifications (Test Design, 2026-09-27)" 1–8
**Test plan:** `engineering-team/stories/tagging-edges/1-tagging-edge-contract.test-plan.md`
**Book:** `engineering-team/audits/tagging-edges/book.md` (acceptance frame, no PRD)

## Quality gates (run by reviewer, not trusted)

Host Node is `v16.17.0`. No Node 22 was available, so the CI-parity gate was not run here. The working tree was clean at `7e18a404` for every run.

- [x] **The story suite through the gate engine** (`node -e "require('./test/helpers/gateRunner').runGate({ suites: [{ file: 'tagging-edge-contract.test.js' }], label: 'review-tagging-edges-1' })"`), read with `npm run gate:status -- --label review-tagging-edges-1`:

  > `20260927T054612Z-87374-111e [review-tagging-edges-1] started 2026-09-27T05:46:12.083Z on 7e18a404 — PASS, exit 0, 76 passed, 0 failed, 0 skipped, 1/1 suites`

- [x] **Full `npm test`** (`GATE_LABEL=review-tagging-edges-1-full npm test`), read with `npm run gate:status -- --label review-tagging-edges-1-full`:

  > `20260927T054616Z-87387-323c [review-tagging-edges-1-full] started 2026-09-27T05:46:16.795Z on 7e18a404 — FAIL, exit 1, 3453 passed, 14 failed, 533 skipped, 227/227 suites; failed: event-less-create-set, honest-publish-reporting, setup-alert-polish`

  The record's fields: `state: finished`, `node: v16.17.0`, `git.dirty: false`, 0 stray errors. I compared suite by suite on `file, verdict, pass, fail, skipped`:
  - Against the baseline `20260927T043752Z-88612-11f0` (`tagging-edges-1-baseline`, on `03c75544+dirty`), exactly one of 227 suites moved: `tagging-edge-contract` went from FAIL 0/76/0 to PASS 76/0/0.
  - Against the Implementer's after-run `20260927T050653Z-21820-74a1` (`tagging-edges-1-after`), 227 of 227 are identical. Note that the after-run was taken on `491735fe+dirty`, before the implementation was committed. This run on the committed `7e18a404` replaces it.
  - The three red suites fail identically in the baseline, the after-run and this run, and the cause is the environment (Node 16):
    - `event-less-create-set` 23/1/1: `fetch is not a function`. Node 16 has no global `fetch`.
    - `honest-publish-reporting` 1/9/0 and `setup-alert-polish` 13/4/0: `require() of ES Module …/nostr-tools/lib/esm/pool.js` (`ERR_REQUIRE_ESM`). Only newer Node can load it.

    No suite this diff touches is involved.
- [ ] `npm run test:playwright`: not applicable. There is no UI or browser surface.
- [x] `bash scripts/harness-lint.sh`: exit 0, "clean (0 violations)".
- [x] `git diff --check 72469bde..7e18a404`: exit 0.
- [ ] _Lint not configured — skipped._
- [ ] _Typecheck not configured — skipped._
- [ ] _Build not configured — skipped._

## Spec adherence
- [x] **Every acceptance criterion has a passing test.** The breakdown is AC-1 22, AC-2 18, AC-3 13, AC-4 12, AC-5 7, plus surface 2, purity 1 and ADR 0015 1, which makes 76/76. It matches the plan's test index. I also ran my own probes (scratchpad `review-final/`):
  - **AC-3:** 20,736 ordered pairs of valid edges built with `taggingToEdge`, covering ties, colliding ids, all three stamp mixes, resolved and unresolved, and two targets. `standingEdge(a,b)` and `standingEdge(b,a)` gave the same standing `eventId`, and so did both fold-from-null orders. 0 violations.
  - **AC-4:** spot checks gave the ADR's answers. Naming the version's id applies. A superseded id does not. An older address delete does not. An equal-`created_at` address delete applies. Another signer does not.
- [ ] **No criterion is silently dropped: AC-5 does not hold as written.** The BIBLE text passes its seven pinned tests, but three of its statements are false (Blocking 1–3). AC-5 asks BIBLE to say "what it records", and §6:302/:318 misstate that.
- [x] **No behavior added that isn't in the story.** The four Deviations in the story (UPPER_SNAKE `REFUSAL` keys, `revokeTargets`' event check and dedupe, `not-named` for a non-object edge, a refusal as `current` treated as nothing) are all inside what the ADR leaves open. I accept them.

## ADR adherence
- [x] **The files changed match the Implementation notes.** The new folder `src/lib/tagging-edges/` has `contract.js` and an `index.js` that re-exports it. BIBLE changes cover §6, the §21 glossary row, the §30 coverage line and Last updated, with no §16 entry. The 0009 "Narrowed" line is in the ADR commit, as specified. `git diff --stat 72469bde..7e18a404` over the "Unchanged" list (`src/api`, `src/pipeline`, `src/lib/event-tagging`, `ui`, `firmware`, `protocols`, `setup`, `lib`, `.github`, `package*.json`) is empty.
- [x] **Layering.** The module is pure CommonJS. Its only `require` is `./contract`. It has no `console`, `process`, `Date`, `Math.random` or I/O (I grepped the added `src` lines). No Cypher writes `TAGS` anywhere (`git grep -E '\[:TAGS|:TAGS\]|-\[r:TAGS' 7e18a404 -- src firmware setup ui` is empty).
- [x] **No new dependencies.** `package.json` is untouched. The test requires only `fs` and `path`.
- [x] **The contract follows ADR steps 1–7 and clarifications 1–8, line for line** (contract.js:111-177). The `standingEdge` outcomes (:196-226) and `revokeApplies` (:250-266) match the ADR's bullets. The ADR's own strfry premise at :97-98 and :307-308 is inaccurate, and the code comment at contract.js:33 repeats it (Non-blocking 1).

## Concept-graph integrity
- [x] **Handles are in `kind:pubkey:slug` form:** `39998:<pubkey>:nostr-user-tag`, `39998:<pubkey>:tag`, and `39999:<pubkey>:<d>` addresses. Both stamp pubkeys are parameters (contract.js:67-69, 126-127, 100).
- [x] **Firmware reinstall:** not needed. No concept definition changes. The `relationship-type` registration was deferred to a ledger row (ADR sub-decision).
- [x] **Orientation:** the module takes no graph input. The ADR (:41-45) records the `/summaries` and `/node/.../neighbors` orientation calls made before source was read.

## Things tests can't catch
- [x] **No secrets.** The branch adds two 64-hex strings:
  - `82b75e47…973833` (×3), the ADR 0015 canonical literal. It appears only in the story and ADR prose that name the canonical stamp.
  - `8387ec0e…294f` (×1), this machine's TA public key, in the story (Nit 10).

  `nsec`, `privkey` and `secret` all get 0 hits in added lines. The suite uses fake keys (`hex('a')`, …).
- [x] **No debug logging, and no commented-out code.** The added `//` lines in `src` are the seven step comments and the strfry note at :33.
- [~] **Error paths and edge cases.** The ADR's never-throw promises hold. Four divergences reproduced (Non-blocking 1–3, Nits 1–4). The one that matters most for story 2 is Non-blocking 3: a missing or empty stamp-pubkey option turns every canonical-only edge into a same-id refusal, and that retires the edge.
- [x] **Concurrency.** The module is pure and has no shared state. The conditional-write Cypher guard and its parity test are bound to story 2 (ADR :191-194).
- [x] **Security.** There is no I/O, shell or network. Both regexes are anchored and linear. The caller's `tagElementsById` lookup runs inside `try`. The module trusts `event.pubkey`/`deletion.pubkey` without checking signatures, which is correct only for relay-stored input (Nit 8).
- [x] **Principles 1–4.**
  - The edge carries only raw assertion fields: no trust, rank, count, name or applied flag (the key set is pinned by AC-1).
  - Nobody is refused for who they are: unknown authors, fixtures and self-taggings are accepted. The stamp filter is the honoured-set rule (tag-federation/0003), not author gating.
  - POV is applied at read time.
  - `TAGS` is classed as event-projection (§30), and deletes are scoped to one relationship.
- [x] **Scope:** stays within the story. The one exception is BIBLE's claim about other edges' `timestamp`, which the story put out of scope (Blocking 2).
- [ ] **Promised TODOs are filed: they are not** (Blocking 4).

## House rules check
- [x] **Concept Graph API authority respected.** The ADR's orientation calls are recorded, and no concept definitions were read from source first.
- [x] **No new lint/typecheck/build tooling.** `package.json` is unchanged, and `test/registry.js` gains one line (`tagging-edge-contract.test.js`).
- [x] **TA-pubkey rule / ADR 0015.** There is no 64-hex literal in `src/lib/tagging-edges/`; the suite's ADR 0015 guard pins that, and my grep of the added `src` lines finds none. No `LEGACY_*` constant was touched.

## Product-guide adherence
- N/A. There is no PRD, because this is an acceptance-frame book.

## Findings

I independently verified every finder item before listing it. Evidence for each is given below, and the probe scripts are in scratchpad `review-final/probe.js` and `fuzz.js`.

### Blocking
1. **BIBLE.md:302, :318** — "Every property comes from the event" and "It records nothing its event does not hold … re-derivable from the relay" are false for id-only taggings (6,739 of 6,972 in the census). For these, `tagAddress`/`tagSlug` come from the supplied tag element (`contract.js:103` builds `39999:${el.pubkey}:${slug}`), so their pubkey appears nowhere in the tagging. Probe C5 confirms this. The statements contradict the table's own `tagAddress` row (:310) and story AC-1, and re-deriving such an edge needs the tag element too.
   **Asked change:** at :302, say "Every property comes from the tagging, or from the tag element its `e` names". At :318, say "re-derivable from the local relay (the tagging plus the tag element it names)" and "no display names (`tagSlug` is an identifier)". Keep "no trust", "read time" and "event-projection", which AC-5 pins.
2. **BIBLE.md:308** — "(not `timestamp`, which other edges use for wall-clock time)" is wrong, and it documents FOLLOWS/MUTES/REPORTS properties, which the story's Out of scope excludes. What the code actually writes:
   - The batch writers and the reconcile queue set `timestamp` to the event's `created_at`: `src/pipeline/batch/kind3EventsToFollows.js:68`, `kind10000EventsToMutes.js:68`, `kind1984EventsToReports.js:72`, `eventsToRelationships.js:110`, and `src/pipeline/reconcile/processReconciliationQueue.js:129,173`.
   - Only the reconciliation calculators write wall-clock time: `src/pipeline/reconciliation/calculateFollowsUpdates.js:119,265`, `calculateMutesUpdates.js:119,265`, `calculateReportsUpdates.js:59`, then `apocCypherCommand1_*:22-23`.
   - `src/pipeline/README.md:108` documents `created_at`.
   - The ADR's own wording at :207 was hedged; the BIBLE drops the hedge.

   **Asked change:** drop the characterization and write "(not `timestamp`)", or say that other edges' writers fill `timestamp` inconsistently. Do not name FOLLOWS/MUTES/REPORTS in this row, so AC-5's "by direction and kind only" test stays green.
3. **BIBLE.md:315** — "the same reading as today's tag surfaces" is false for four values the contract stores verbatim. I checked this with a RETURN-only query on the local Neo4j and with the JS readers' `Number()` plus `isFinite→1` logic (`src/api/profile-tags/index.js:141-146`, `src/lib/event-tagging/taggings.js:24-29`, `classify.js:25-30`, `src/lib/identification-tags/index.js:65-70`):

   | Value | Cypher bucket | JS bucket |
   |---|---|---|
   | `""` | apply | neutral |
   | `" "` | apply | neutral |
   | `"NaN"` | neutral | apply |
   | `"-Infinity"` | dispute | apply |

   ADR :219-220 records the `""` difference; the BIBLE sentence drops it. The census has none of these values ("1", "-1", "0", absent only).
   **Asked change:** qualify the sentence, for example: "for every value on the relays today (`"1"`, `"-1"`, `"0"`, absent); malformed values such as `""`, `"NaN"` or `"-Infinity"` can bucket differently". Keep the `coalesce(...)` expression and "absent … apply".
4. **engineering-team/epics/tagging-edges.md:57 and ADR 0001:277-284** — promised ledger rows do not exist.
   - The epic says the follows-pipeline defect rows were "filed at the end of the kickoff session, 2026-09-26".
   - The ADR lists six follow-up rows "filed at the end of this session".
   - The story (:52, :118) promises rows for the schema's stale `required` and for the FOLLOWS/MUTES/REPORTS properties.

   None of them exists in `OPEN.md` or `ledger/` at `7e18a404` or at a freshly fetched `origin/staging`. I ran `git grep -i -w -E "at-most-once|reconnects?|nostrUserTagMember|stream and reconcile"` plus a broader keyword grep, and every hit was an unrelated row. There are no other local branches, worktrees or stashes. The dated claim is now false (2026-09-27). ADR row 1 tracks a live read-side defect: `/api/tags/index` and applicability drop id-only taggings (97% of the census).
   **Asked change:** before re-review, file the rows as `ledger/` files, after a duplicate search of `OPEN.md`, `ledger/` and `origin/staging`. Alternatively, reword the epic, ADR and story to "to be filed" and add one tracking row.

### Non-blocking
Should-fix items. They conform to the ADR as written, so each one needs an owner decision: fold it into this round through an ADR clarification, or carry it into story 2's ADR as binding.

1. **contract.js:59-64 (and the comment at :33); ADR :97-98, :307-308** — the identity `d` diverges from strfry. strfry indexes only `d` values of ≤255 bytes (`events.cpp:48`, `MAX_INDEXED_TAG_VAL_SIZE = 255`). It appends the virtual `''` after the tag loop (:57-60), and it replaces on the **first indexed** `d` (:282-286). So an event with an over-long first `d` followed by `['d','x']` is filed under `x` and replaces v1 there. The module refuses it as `no-d` with no address, so `standingEdge(v1, r2)` gives `address-mismatch` and v1's edge stays (probe C1). The ADR's "one longer than 255 bytes becomes ''" holds only when no later `d` exists. strfry rejects non-string tag values outright, so this over-long-then-valid case is the only one reachable from the relay. Only the author can trigger it, and the census has 0 such events.
   **Ask:** add an ADR clarification (skip over-long `d`s, as strfry does) plus a Tester case, before story 2's sweep relies on "retirement relies on the relay's replaceable rule". The finder's patched copy still passes 76/76.
2. **contract.js:183** — `standsOver` compares with `!==`. A `createdAt` that is a neo4j `Integer` (its `valueOf` returns a `bigint` in the installed `neo4j-driver` 5.28.1; `src` never sets `disableLosslessIntegers`, and it calls `.toNumber()` in 22 places) or a `BigInt` never ties, so the tie-break is skipped. The result then depends on argument order. With `neo4j.int(1000)` and id 9 against a plain `1000` and id 1, the standing version is id 9 in one order and id 1 in the other (probe C2). Plain numbers give id 1 in both orders. The ADR types `createdAt` as an integer taken from `taggingToEdge`, so this is outside the input contract. But story 2 reads edges back from Neo4j, and the ADR binds a Cypher/JS parity test to `standingEdge`.
   **Ask:** use `>` / `<` / tie-break. This preserves semantics for numbers and could go into this round. Otherwise story 2 must normalize with `toNumber()` and pin that.
3. **contract.js:207-208 with ADR :349-350 and clarification 8** — with `{localPubkey}` only, `{canonicalPubkey:''}` or `{}`, a canonical-only tagging becomes `no-nostr-user-tag-stamp` with its address. `standingEdge(edge, thatRefusal)` then returns `retired-by-non-tagging` with `changed: true` and `droppedTarget` set (probe S1). A same-id refusal can only come from changed options, so a misconfigured story 2 run would retire every canonical-only edge (6,762 of 6,972 on production). The epic's guardrail only covers failed or empty relay reads.
   **Ask:** make it binding in story 2's ADR that writers check both stamp pubkeys are 64-hex at startup and abort otherwise, and that the mass-delete guard counts retirements per run. Changing `standingEdge` itself would need a kick-back to Test Design, because the suite pins the current behavior.

### Nits
1. **contract.js:196** — `standingEdge` takes a refusal whole but an edge only unwrapped. `standingEdge(null, taggingToEdge(ev))` stores the `{ok, edge}` wrapper as the edge (reason `new`), and with a current edge a newer wrapped result gives `address-mismatch` (probe C3). Option: unwrap `{ok:true, edge}`.
2. **contract.js:31-32** — `TAG_ADDRESS_RE`/`ANY_ADDRESS_RE` have no `s` flag. An `a` of `39999:<hex>:foo\nbar` is refused as `bad-tag-address`. A tagger's kind-5 naming `39999:<UPPER>:x\ny` gets `not-named`, while the lower-case form gets `names-address` (probe C4). strfry's `parseATag` (`EventUtils.h:32-50`) takes everything after the second colon and decodes hex case-insensitively. The ADR regex at :321 is copied verbatim, so fix both there (the finder's `s` flag and the sweep's duplicate item are the same thing).
3. **contract.js:96** — the resolved element's `id` is not checked against `tagEventId`. A dishonest `tagElementsById` makes the edge take another author's tag while keeping the named `tagEventId` (probe C5). Option: `el.id !== tagEventId → null`.
4. **contract.js:90-99** — only `map.get` runs inside `try`. An element with a throwing getter escapes to the outer catch and refuses the tagging as `not-an-event` with no address, instead of leaving it unresolved (probe C6).
5. **ADR Consequences** — strfry decodes `id`/`pubkey` case-insensitively and hashes the JSON as received (`events.cpp:12-13`, `:73-86`, `hex.h:53-57`). An author can therefore publish an upper-case-hex version that replaces v1 on the relay, while the module gives it no address (probe C7). This is conformant, but the divergence should be recorded next to "retirement relies on the relay's replaceable rule".
6. **BIBLE.md:300** — "carrying a `nostr-user-tag` stamp" reads as any deployment's stamp. The contract honours only the canonical stamp or this deployment's own (contract.js:130; pinned by AC-2's "another deployment's own only" case).
7. **BIBLE.md:316** — AC-3's target-move rule ("a newer version naming a different person moves the relationship") is not stated. One sentence would fix it.
8. **contract.js:1-12 / ADR "Binding for later stories"** — the precondition "callers pass only relay-verified events" appears only in the story's Out of scope. Story 3 is the most likely caller to break it.
9. **BIBLE.md:300** — `protocols/drafts/tags.md` is written as a code span. Every other drafts citation in BIBLE is a Markdown link (:210, :407, :415, :1626, :1669, :1680).
10. **stories/tagging-edges/1-tagging-edge-contract.md:97** — commits this machine's full TA pubkey (`8387ec0e…294f`). OPEN.md rows 44, 127, 168 and 223 track exactly this kind of stale local-literal-in-docs. Use `<TA>` or elide it as the ADR does (:46).
11. **audits/tagging-edges/book.md** — it lacks the template's `**Confidence at close:**` placeholder and the `## Close artifacts` section (`templates/book.md:61,63`). The previous book carried both from opening.
12. **test-plan.md:168** (the finder cited :170) — "adjusted only for the six ADR clarifications", but the ADR has eight, and commit `491735fe` says eight.

**Refuted:** none. Every finder item reproduced. Two corrections:
- The sweep lens's polarity item is the same as docs Blocking 3, and its regex item is the same as correctness Nit 2. Each is merged into one entry.
- The test-plan item is at line 168, not 170.

### Harness friction
1. None new. One observation: the Implementer's after-gate ran on `491735fe+dirty` rather than the committed tree. The committed-tree run above is identical (227/227), so nothing was hidden this time.

## Verdict
**CHANGES_REQUESTED**

## Re-review (2026-09-27)

**Reviewer:** Claude (acting as Reviewer), round 2
**Diff:** `git diff aff3c1cd..914f59fa`, three commits:
- `e78c1152`: ADR clarifications 9–13, six new tests plus one AC-5 assertion, and a test-plan section.
- `4a9c11ac`: `contract.js`, BIBLE §6, and fixes to the ADR, epic, story and book.
- `914f59fa`: 11 ledger rows.

19 files, 696 insertions, 51 deletions. Nothing on the ADR's Unchanged list moved: `--stat` shows only BIBLE, the book, ADR, epic, story, test plan, `ledger/`, `contract.js` and the test. `git ls-remote origin refs/heads/staging` is still `72469bde`, so the branch is 0 behind.
**Owner rulings at the round-1 gate:**
- Fix: Blocking 1–4, Non-blocking 1–2 (as clarifications 9–10), and nits 2–4 and 6–12.
- Non-blocking 3 becomes binding for story 2.
- Nit 1 is documented in JSDoc only.
- Nit 5 is kept as the NIP-01 rule (clarification 13).

### Quality gates (run by reviewer on the committed, clean tree `914f59fa`)

The host has Node v16.17.0 and no Node 22, so no CI-parity run was made.

- [x] **Story suite through the gate engine** (`runGate({ suites: [{ file: 'tagging-edge-contract.test.js' }], label: 'review2-tagging-edges-1' })`):

  > `20260927T125819Z-69048-69a4 [review2-tagging-edges-1] started 2026-09-27T12:58:19.457Z on 914f59fa — PASS, exit 0, 82 passed, 0 failed, 0 skipped, 1/1 suites`

- [x] **Full gate** (`GATE_LABEL=review2-tagging-edges-1-full npm test`):

  > `20260927T125823Z-69070-ae0d [review2-tagging-edges-1-full] started 2026-09-27T12:58:23.564Z on 914f59fa — FAIL, exit 1, 3459 passed, 14 failed, 533 skipped, 227/227 suites; failed: event-less-create-set, honest-publish-reporting, setup-alert-polish`

  The record shows `state: finished`, `git.dirty: false` with `dirtyCount: 0`, and 0 stray errors. Suite-by-suite comparison on `file, verdict, pass, fail, skipped`:
  - **Against the baseline** `20260927T043752Z-88612-11f0`: 1 of 227 suites moved. `tagging-edge-contract` went from FAIL 0/76/0 to PASS 82/0/0.
  - **Against the Implementer's after-run** `20260927T124211Z-4360-960f`: 0 of 227 moved. That run was taken on `e78c1152+dirty` (`dirtyCount: 17`); this committed-tree run replaces it.
  - **Against my round-1 run** `20260927T054616Z-87387-323c`: 1 moved, `tagging-edge-contract` 76 → 82.
  - **The three red suites are the same as in the baseline, and the cause is the environment (Node 16):**
    - `event-less-create-set` 23/1/1: `fetch is not a function`.
    - `honest-publish-reporting` 1/9/0 and `setup-alert-polish` 13/4/0: `ERR_REQUIRE_ESM` on `nostr-tools/lib/esm`.
- [x] `bash scripts/harness-lint.sh`: exit 0, "clean (0 violations)".
- [~] `git diff --check aff3c1cd..914f59fa`: exit 2, one new blank line at EOF in `test-plan.md:225` (Nit R2-9).
- [ ] `npm run test:playwright`: not applicable, because there is no UI.

### The new tests against clarifications 9–12

- **Mapping.** Each clarification has its tests:
  - Clarification 9 (ADR :435-437): `test:665` and `:672`.
  - Clarification 10 (:438-440): `:680`.
  - Clarification 11 (:441-442): `:694` and `:701`.
  - Clarification 12 (:443-444): `:708`.
  - The target-move rule: the AC-5 assertion at `:799`.

  Each one asserts what its clarification says.
- **Red before the fix.** The Tester's record `20260927T123353Z-66902-577b [tagging-edges-1-round2-red]` ran on `aff3c1cd+dirty`, where `dirtyCount: 3` matches the three files of `e78c1152`. It shows 75 passed and 7 failed, and the seven are exactly the new tests. Each fails on the behavior it pins: `no-d` ×2, the higher id standing, resolution to another author's tag, `not-an-event`, `bad-tag-address`, and the missing BIBLE sentence.
- **I reproduced the red independently** (scratch `rereview-reviewer/red.sh`), running the committed test against three trees:
  - `aff3c1cd`'s module and BIBLE: 75/7, the same seven.
  - `aff3c1cd`'s module with `914f59fa`'s BIBLE: 76/6, so the AC-5 assertion depends on the BIBLE alone.
  - `914f59fa`: 82/0.
- **Mutation check** (`mutate.sh`). I reverted each fix alone in a scratch copy, and each revert fails exactly its own test:
  - `TAG_ADDRESS_RE` without `s`: clarification 12.
  - `ANY_ADDRESS_RE` without `s`: clarification 12.
  - No `el.id` check: clarification 11 (id).
  - `!==` in `standsOver`: clarification 10.
  - First-`d`-only `identityD`: both clarification 9 tests.

  The widened `try` is shown by the red run, where the throwing-element test gave `not-an-event`.
- **Real driver.** The clarification 10 test uses an Integer-like stub, so I also ran the real `neo4j-driver` 5.28.1 (`neo4j.int(n).valueOf()` is a `bigint`). Integer/number, Integer/Integer and BigInt/Integer ties and orderings give the same standing version in both argument orders.
- **One gap.** The test at `:672` is named "retires or replaces", but it asserts only the replace path. The retire path works: I probed a non-tagging v2 with tags `[long d, 'x']`. It is refused at `…:x`, and `standingEdge(v1, it)` gives `retired-by-non-tagging` (Nit R2-10).

### Round-1 findings: disposition and evidence

| # | Ruling | Disposition | Evidence |
|---|---|---|---|
| Blocking 1 | fix | **Fixed** | BIBLE.md:302 now reads "Every property comes from the tagging, except that a tagging naming its tag only by id takes `tagAddress` and `tagSlug` from the tag element its `e` names". :318 reads "re-derivable from the local relay (the tagging, plus the tag element it names) … no display names". Both match contract.js:105, :155 and :172-174. "No trust", "read time" (:293) and "event-projection" are kept, and the AC-5 tests pass. |
| Blocking 2 | fix | **Fixed** | BIBLE.md:308 now says "(not `timestamp`)" and no longer characterizes other edges. ADR :212 now says "which older edges' writers fill inconsistently", which matches round 1's file:line evidence. |
| Blocking 3 | fix | **Fixed** | BIBLE.md:315 is qualified. It says the reading matches for `"1"`, `"-1"`, `"0"` and absent, and that `""`, `"NaN"` and `"-Infinity"` can bucket differently in Cypher and in JS. This agrees with round 1's table. The ADR's own sentence is still stale (Nit R2-7). |
| Blocking 4 | fix | **Fixed** | `914f59fa` adds 11 `ledger/2026-09-27-*.md` rows. Each has `**Id:**` equal to its filename, Type and Status headers, and an id of 47 characters or fewer, and harness-lint exits 0. A scripted check resolves every date+slug id cited in the ADR, epic, story, test plan, book and rows to a file (11/11). ADR follow-up 1 now points at OPEN.md row 45 (OPEN.md:78, the `/api/tags/index` under-count) as its diagnosis, which fits. On `origin/staging` (= remote), `reconnect`, `at-most-once`, `relationship-type` and `revoke` get 0 hits in OPEN.md and `ledger/`. I read the hits for `websocket`, `tagEventId`, `kind 5`, `AUTHORED` and `fixture`, and none is the same item. |
| Non-blocking 1 | fix (clarification 9) | **Fixed** | Code at contract.js:63-69. ADR step 1 at :316-318, the strfry bullet at :97-98, clarification 9, and tests :665 and :672. I probed it against strfry's source in the container (`events.cpp:35`, `:48`, `:59-62`, `:282-286`), and every case agrees with where strfry files the event:<br>- valueless then x → `no-d` (strfry files it under `''`)<br>- empty then x → `no-d` (`''`)<br>- 256 B then x → x<br>- 255 B → kept<br>- 85×€ (255 B) → kept<br>- 86×€ then y → y<br>- long, long, y → y<br>- x then long → x<br>- long, valueless, x → `no-d` (`''`)<br>What remains: F2, F6a, F6b. |
| Non-blocking 2 | fix (clarification 10) | **Fixed for the types it names** | Code at contract.js:191-195, clarification 10, test :680, and the real-driver probe above. What remains: F1, values that cannot be compared. |
| Non-blocking 3 | binding for story 2 | **Done** | ADR "Binding for later stories" :197-199, epic :55-57, and contract.js:13-15. What remains: F4, wording. |
| Nit 1 | JSDoc only | **Done** | contract.js:202-204. |
| Nit 2 | fix | **Fixed** | The `s` flag is on both regexes (contract.js:35-36). ADR step 4's regex (:331), clarification 12 and test :708 are updated, and a mutation on either regex fails the test. |
| Nit 3 | fix | **Fixed** | contract.js:98 (`el.id !== tagEventId`), clarification 11, test :694. |
| Nit 4 | fix | **Fixed** | contract.js:95-108 runs the whole resolution inside `try`; test :701. ADR step 5 is not amended to match (Nit R2-8). |
| Nit 5 | kept as NIP-01 | **Recorded** | Clarification 13 (:445-447). Its "story 2's sweep … removes the edge instead" is not something `standingEdge` does. An upper-case-id v2 is refused with no address, so the result is `address-mismatch` (probe). The claim rests on story 2's "repairs drift" scope (epic :23-24). See F5 and R2-NB3. |
| Nit 6 | fix | **Fixed** | BIBLE.md:300 now reads "the canonical `nostr-user-tag` stamp or this deployment's own", which matches contract.js:131-135. |
| Nit 7 | fix | **Fixed** | BIBLE.md:316 carries the target-move sentence, which matches contract.js:234 (`droppedTarget`). The AC-5 assertion is at test :799. |
| Nit 8 | fix | **Fixed** | contract.js:13-14 and ADR Binding :200-201. |
| Nit 9 | fix | **Fixed** | BIBLE.md:300 uses a Markdown link, and `protocols/drafts/tags.md` exists. |
| Nit 10 | fix | **Fixed** | Story :97-98 now uses `<TA>` plus the runtime lookup. `git grep -i 8387ec0e 914f59fa -- engineering-team/stories/tagging-edges` is empty, and the ADR's elided form (:46) stays, as round 1 accepted. The full literal is still in the history (`60e33542`); it is a public key, not a secret. |
| Nit 11 | fix | **Fixed** | book.md:59 has `**Confidence at close:** —` and :64-66 has `## Close artifacts`, matching `templates/book.md:61-65` (`prd-seed.md`, because this book has no PRD). |
| Nit 12 | fix | **Fixed** | test-plan.md:168 says "eight". |

### Things tests can't catch (round-2 diff)
- [x] **Secrets and debug code.** No added line carries a 64-hex literal (a grep of the `+` lines finds 0). There is no `console`, `debugger`, TODO, FIXME, `nsec`, privkey or secret, and no commented-out code.
- [x] **Regexes.** Both are still anchored and have no nested quantifiers, so they stay linear with `s`.
- [x] **identityD.** It calls `Buffer.byteLength` once per `d` tag, and strfry bounds the tag count. The second length check at :67 can no longer be true, which is harmless.
- [x] **Concurrency.** Unchanged: the module is pure and has no state.
- [x] **Scope.** The diff stays inside the ratified fixes. Two ledger rows were not asked for in round 1 (`bible-s6-relationship-name-drift` and `test-fixture-taggings-on-prod-relays`). They track two items in the story's Out of scope, so they are appropriate.

### House rules
- [x] **No new tooling.** Round 2 does not touch `package.json` or `test/registry.js`.
- [x] **TA pubkey and ADR 0015.** No `LEGACY_*` constant is touched and no local TA literal is added.
- [x] **Concept graph.** No concept definition changed, so no firmware reinstall is needed.

### Round-2 finder: every item checked

Probes are in scratch `rereview-reviewer/probe.js`. They require the real module and `node_modules/neo4j-driver`, and I ran them on Node v16.

- **F1 (should-fix) `standsOver` with values that cannot be compared: reproduced; classed Non-blocking (R2-NB1).** Every result below matches the finder:

  | Case | Round 2 | Round 1 |
  |---|---|---|
  | NaN current (lower id) vs a real newer version | `older-ignored` | `older-ignored` |
  | real current vs NaN incoming (lower id) | `newer` | `older-ignored` |
  | undefined current (higher id) vs 2000 (lower id) | `newer` | `older-ignored` |
  | `{low:2000,high:0}` current (higher id) vs 1999 (lower id) | `newer` (the older version stands) | `older-ignored` |
  | NaN current vs a newer non-tagging refusal | `older-ignored` | `older-ignored` |

  Why this is outside the contract: `taggingToEdge` refuses a `created_at` of NaN, undefined, null, 1.5, -1, `"1000"` or `1000n` as `not-an-event` (probe). Every refusal that carries a `createdAt` has passed the same check. So an `incoming` built by the module is always an integer, and only a caller-built `current` can fail to compare.

  Round 2 changed which wrong answer those inputs get:
  - Round 1 always kept `current`, so a bad current beat every newer version.
  - Round 2 falls to the id. That is right about half the time, but with `{low,high}` it can let an older version replace the current one.

  Neither round is total. Clarification 10's "falls to the event id only on a tie" holds only for comparable values.

  **Not blocking:** the module has no caller until story 2, and every input inside the contract orders correctly.

  **Ask (owner decision; carry into story 2's ADR):** take one of these two options.
  - Take the finder's guard (`a.createdAt >= 0` versus `b.createdAt >= 0` before the `>`/`<` chain) with tests, and qualify clarification 10. I checked the guard: it is true for number, BigInt and driver Integer, and false for NaN, undefined and `{low,high}`. It is also true for `null` (read as 0) and for numeric strings, and its tests should pin both.
  - Or bind story 2 to two rules: pass `createdAt` exactly as the driver returns it, never JSON-round-tripped; and treat a stored `TAGS` edge whose `createdAt` is not an integer as drift to re-derive.
- **F2 (nit) the tag element's first `d`: reproduced; Non-blocking (R2-NB2).**
  - An element with tags `[L×300, 'podcaster']` resolves to a 371-character `tagAddress`.
  - An element whose only `d` is 300 bytes also resolves.
  - The same `d` shapes on a tagging give `…:podcaster` and `no-d`.

  This conforms to ADR step 5 as written ("non-empty first `d`", :339), so it is not a defect against the ADR. It is an inconsistency that clarification 9 left behind. **Carry into story 2:** use `identityD` in `resolveTagElement`, reword step 5, and add a test.
- **F3 (nit) revoke addresses vs strfry: reproduced; pre-existing (round-1 code, not introduced by round 2).**
  - **(a)** A 271-byte address gives `names-address` (probe). strfry skips tag values over 255 bytes at `events.cpp:48`, before the kind-5 loop (:332-360) and the `replaceDeletion` index (`golpe.yaml:65-80`), and both walk `foreachTag`.
  - **(b)** `EventUtils.h:38-39` uses `stoull` and checks `pos == size`, so `039999`, `+39999` and ` 39999` all delete on the relay. The contract gives `not-named` for all three (probe).
  - **(c)** `golpe.yaml:80` hashes the raw `a`, while `events.cpp:313` looks up the lower-case canonical form. The contract gives `names-address` for an upper-case pubkey (probe).

  In (a) and (c) the contract honours the tagger's signed NIP-09 deletion where strfry does not act. In (b) the relay deletes the tagging and the contract ignores the kind-5, so story 2's drift repair must catch it (R2-NB3). **Ask:** record (a)–(c) as known divergences next to ADR :100, as clarification 13 does. Mirroring them in code is optional.
- **F4 (nit) the stamp-pubkey guardrail wording: reproduced.** Probes:
  - Without canonical: canonical-only taggings get `no-nostr-user-tag-stamp`.
  - Without local: local-only taggings get it.
  - Without either: every tagging gets it.
  - An upper-case canonical pubkey: canonical-only taggings are refused.

  Epic :55-57's "without the canonical or local pubkey" can be read either way. The case that motivated the binding, one pubkey missing, is not the case the sentence describes. The ADR's "without them" (:197-199) is accurate. **Ask:** fix the epic sentence and write "lowercase 64-hex" when story 2's ADR adopts the binding.
- **F5 (nit) BIBLE "not a tagging retires it": reproduced at the contract level; refuted as a false BIBLE claim.** Location correction: the sentence is at BIBLE.md:316, not :315.

  The probe confirms the contract behavior: an upper-case-id v2 gives `not-an-event` with no address, so the result is `address-mismatch`. But BIBLE describes the relationship. Clarification 13 hands this case to story 2's drift repair (epic :23-24, "repairs drift"), and an upper-case-hex event is not a NIP-01 event.

  **Carry (R2-NB3):** story 2's ADR must state that its drift repair removes an edge when the current relay version at its address is not an accepted version of that edge. Clarification 13, F3(b) and this sentence all depend on that rule, and neither the Binding list nor the epic's guardrails state it. Citing clarification 13 when story 2 updates BIBLE is optional.
- **F6 (nits) three doc slips: all reproduced.**
  - **(a)** `events.cpp:57` is the tag loop's closing brace; the virtual `''` append is :59-62, with the add at :61. The ":57-60" originated in my round-1 Non-blocking 1 text, and clarification 9 (:436) copied it.
  - **(b)** `events.cpp:35` throws "tag val was not a string", so strfry rejects a non-string value outright. ADR step 1 (:318) says it files the event under `''`. That wording was already in round 1's step 1.
  - **(c)** test-plan.md:205 says "three behaviors", but clarifications 9–12 cover four.
- **Checked-and-clean list:** my own runs agree. I re-ran the `identityD` cases, the driver-Integer orderings, the ledger and cited-row checks, and the gate.

### Findings (round 2)

#### Blocking
None.

#### Non-blocking
Should-fix items for the owner to decide. Carrying them into story 2's ADR is enough, because the module has no caller until story 2.
1. **R2-NB1, contract.js:191-195 and clarification 10**: when `createdAt` cannot be compared, the order falls to the event id (F1). **Ask:** add the guard with tests, or bind story 2's reader as described in F1.
2. **R2-NB2, contract.js:99-101 and ADR step 5 (:339)**: tag elements take their first `d`, not the identity `d` (F2). **Ask:** use `identityD`, reword step 5, and add a test.
3. **R2-NB3, clarification 13 (:445-447)**: this clarification, F3(b) and BIBLE.md:316 depend on story 2's drift repair removing an edge whose address's current relay version is not an accepted version of it, and neither the Binding list nor the epic's guardrails state that rule. **Ask:** make it binding in story 2's ADR, under the mass-delete guard.

#### Nits
4. **R2-4, ADR :100**: record F3's (a)–(c) as known divergences.
5. **R2-5, epics/tagging-edges.md:55-57**: correct the wording, and write "lowercase 64-hex" in the binding (F4).
6. **R2-6, ADR :436 and :318, and test-plan.md:205**: fix F6 (a)–(c).
7. **R2-7, ADR :224-225**: "That matches today's readers: an absent or non-numeric stance counts as apply. One known edge difference …" is now stale against BIBLE.md:315. In Cypher, `"NaN"` buckets as neutral and `"-Infinity"` as dispute.
8. **R2-8, ADR step 5 (:338-340)**: the step still says only "a lookup that throws counts as absent" and lacks the id check. Clarification 11 governs, so amend the step to match.
9. **R2-9, test-plan.md:225**: a trailing blank line at EOF (`git diff --check`).
10. **R2-10, test :672**: the name says "retires or replaces", but only the replace path is asserted. Optionally add the retire assertion, which the probe shows already holds.

#### Harness friction
1. **The Implementer's after-gate ran on a dirty tree again.** Run `20260927T124211Z-4360-960f` was on `e78c1152+dirty` (`dirtyCount: 17`) and finished at 12:47:33Z. `4a9c11ac` and `914f59fa` were committed at 12:47:54Z. This is the second round in a row. My committed-tree run matches it on all 227 suites, so nothing was hidden. I propose no row. If the owner wants the after-gate run on a committed tree, that is a change to workflow 4.

### On PASS
- **Story status not flipped.** This re-review was scoped to the review file only, so the story's `**Status:**` (still `Approved`) was not changed. The caller should set `**Status:** Done` in `engineering-team/stories/tagging-edges/1-tagging-edge-contract.md` in the review commit. Until then, `bash scripts/harness-lint.sh` exits 1 with a single violation, L1 ("review … is PASS-final but story status is 'Approved'").
- **Completion detection** goes in the chat, not in this file.

### Verdict
**PASS**
