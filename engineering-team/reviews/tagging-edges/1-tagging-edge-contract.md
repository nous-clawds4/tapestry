# Review: Story 1 — The tagging edge contract

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-27
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
