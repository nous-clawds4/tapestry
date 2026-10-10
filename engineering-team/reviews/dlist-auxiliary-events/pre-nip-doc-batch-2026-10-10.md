# Review: docs lane — DList Auxiliary Events pre-NIP (`o` tag) and its cross-doc batch

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-10
**Diff:** uncommitted working tree on `staging` at `17243cdf`: 9 modified files (`protocols/worksheet.md`, `protocols/README.md`, `protocols/drafts/{tapestry-concepts,opinionated-views,class-thread-relationships,pins}.md`, `design-philosophies/show-and-tell.md`, `engineering-team/stories/_intake.md`, `ledger/2026-10-09-lint-l10-misfires-on-shallow-clones.md`) and 2 new files (`protocols/drafts/dlist-auxiliary-events.md`, `ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md`).
**Lane:** doc / one-liner (0-intake §3: Implementer + Reviewer). There is no story; this is the non-numbered review form. Docs-mode audit per `workflows/protocol-spec-workflow.md`.
**Inputs checked against:** the owner's agreed design of 2026-10-09 (ten decisions, the acceptance frame for the draft), worksheet W25/W2, the specs the draft cites, `nostr-protocol/nips` at `a79e21d`, the reference implementation where the batch makes code claims, and the four-lens adversarial review's 28 confirmed findings (21 after removing duplicates).

## Owner decision recorded

**`z` and `o` may name the same list: resolved by the owner, 2026-10-10.** The ten-decision frame said an event never names the same list in both. The adversarial review found this contradicts decision 1 for self-serving firmware concepts: the `json-schema` concept's own JSON Schema core node has both `z` and `o` → `39998:<TA>:json-schema`, and so does every core node of `word`. The owner chose to allow both. I have this decision as relayed by the coordinating session; I did not see the owner's statement myself. The record is consistent: draft § 3 (`dlist-auxiliary-events.md:59`) allows both, and W25's Resolution (`worksheet.md:355`) records "(owner, 2026-10-10)". No stale "pending" or "MUST NOT name the same list" wording remains anywhere under `protocols/`, in the intake entry, in Show and Tell, or in the ledger rows (grep).

## Quality gates (run by reviewer, not trusted)

- [x] **Regression check (`node test/test.js`, docs-mode).** `node_modules` is not installed in this container, so the gate can't be green (OPEN.md row 13). I compared the run against the clean-tree baseline instead.
  `20261010T015551Z-29012-5375 started 2026-10-10T01:55:51.538Z on 17243cdf+dirty — FAIL, exit 1, 4523 passed, 600 failed, 585 skipped, 290/290 suites`
  Baseline `20261010T011851Z-32063-aa0c`: same commit, `dirty: false`, 4523 / 600 / 585. My run's `dirtyCount: 11` is exactly this batch. The 74 failed suites are **identical** to the baseline set (`diff` of the sorted lists is empty), so the batch adds no failing suite.
- [x] **Doc-pinning suites pass:** `event-tagging-spec` PASS (5/0/0), `b-coverage-audit-and-disposition` PASS (18/0/8), `curated-dlist-update-pointer-switch` PASS (12/0/0).
- [x] **`bash scripts/harness-lint.sh`:** exit 1 with exactly one violation, `L10 commit:695fac4`. This is the known false positive and pre-exists this batch. I reproduced its cause: `.git/shallow` lists 695fac4 and it has no parent in the clone; `git show --name-only --format=` gives 3,816 paths / 209,255 bytes with the CHANGELOG on line 172 and 203,952 bytes after it; under `pipefail` the pipeline exits 141 with `grep -qx` and 0 with `grep -x >/dev/null`. The new review file is non-numbered, so it adds only an INFO line.
- [x] **Links and anchors.** I ran a relative-link and anchor checker over all 11 files. It reports 5 hits, all on lines this batch doesn't touch and all present at `HEAD`: `opinionated-views.md:259` (a regex inside code), `show-and-tell.md:6, :18` (`bibliography.md#show-and-tell`), and `_intake.md:189, :417`. Every link added by the batch resolves, including the worksheet anchors `#w1`, `#w2`, `#w7`, `#w18`, `#w21`, `#w22`, `#w25`.
- [x] **Prose § references.** I grepped every named section the draft cites; all exist: Tapestry Concepts § Core nodes of a concept; Opinionated Views § 7, 7.1, 7.2, 7.3, open questions 5 and 7; Class Thread Relationships § Security considerations and § Direction principle; Inherit-From § The `b` tag; DList Header Declaration § 1; Shared Concepts § Reach and § Clouds; Assistant Designation § Curation copies and § Dual-author lookup and precedence; Pins § 3 and § 9; DList Cross-NIP Compatibility Method 2; Stamping § The write rule; Show and Tell E15.
- [x] **Index row.** `protocols/README.md:72` is in place, in the table's format, and status `pre-NIP`.
- [ ] _Playwright, lint, typecheck and build: not applicable or not configured._

## Claims adherence (docs-mode)

### Fidelity to the ten agreed decisions

| # | Decision | Result | Where |
|---|---|---|---|
| 1 | The header author's core nodes carry `o` (SHOULD, new events); readers fall back to `coreMemberOf` / `d` | Holds | `tapestry-concepts.md:181` (SHOULD, a-tag only), `:184` (fallback order; MUST accept nodes without `o`), `:20` ("each new one") |
| 2 | Auxiliary = 7 core-node roles + view briefs; not items, sets, properties, assertions or Trusted Lists | Holds | draft `:20` (excludes the Concept Header), `:23`, § 8 `:113-118` |
| 3 | Open vocabulary, starting table of 8, unknown/absent role = role unspecified | Holds | § 4 `:66-80`. Same fail-safe as Inherit-From's explicit-string gating (`inherit-from.md:34`) |
| 4 | Any of the three `z` forms incl. bare names; role specs may narrow | Holds | § 2 `:31-36`, § 4 `:69`. W25 `:352` now says `9998` and `9999` |
| 5 | Kinds `39999` (preferred) or `9999`; item of its role's list by its own `z`; headers don't carry `o` | Holds | § 3 `:57-58`, `:61`. The Superset core node carries `z` → `superset`/`set`/`word`, never `list`/`concept-header` (`normalize/index.js:1314-1316`), so it is not a declared header and the `superset` role doesn't collide with `:61` |
| 6 | Several `o` per event; no stamping; (`z`+`o` same list: now allowed by the owner) | Holds | § 3 `:59-62` |
| 7 | No new precedence; dual-author rule finds the governing header; others are candidates per POV; third-party `o` derives no wiring | Holds | § 6 `:98-103`. Matches `assistant-designation.md:147-157` and the authorship gate at `class-thread-relationships.md:48` |
| 8 | Inheritance left open | Holds | § 7 `:108`, open question 3 |
| 9 | Element 3 is the role, never a relay hint; alternatives `a`+marker, NIP-32, new `b` type, `Z` | Holds | § 2 `:37`, § 10 `:130-134` (also covers `y`/`q`) |
| 10 | Private auxiliaries keep `o` encrypted | Holds | § 7 `:109`. Matches W22 (`worksheet.md:265`) and Pins § 9 (only `d` and `z` in the clear) |

### Factual claims spot-checked

| Claim | Result | Evidence |
|---|---|---|
| DList NIP: `z` required on items; three value forms; no rule for telling them apart; multi-value `#z` for redundant headers | Holds | `nips/decentralized-lists.md:43`, `:390-404` |
| Opinionated Views header `d` = `opinionated-view`; `category` takes coordinate or event id; § 7.3 ranks every brief per POV and calls building from one "a strong signal" | Holds | `opinionated-views.md:184`, `:199`, `:216-218` |
| Pins § 2's `allowed` now names `context`, which § 3 defines | Holds | `pins.md:61`, `:99`; the rejection is W18 (`worksheet.md:214-216`) |
| A pointer-typed `b` is declared affiliation (§ 10's argument against a new `b` type) | Holds | `shared-concepts.md:35`; `inherit-from.md:34` (unknown type reads as `pointer`) |
| Curation copies have a closed tag list; `q` forms | Holds | `assistant-designation.md:100-106` |
| Upstream at `a79e21d`: no NIP uses `o`/`O`/`b`/`B`/`j`/`v`/`w`; `n` = NIP-66/87/CC; `s`/`z`/`y` = NIP-69; NIP-18 `q` on "any event"; NIP-01 `a` element 3 relay; NIP-32 self-labels refer to the carrier | Holds | `grep -l '["<L>",'` over the clone; `18.md:24-29`; `01.md:81`; `32.md:53` |
| Firmware ships the seven core-node concepts with `d` = slug | Holds | `firmware/versions/v1.0.0/concepts/`; `install.js:175` (`dTag: slug`) |
| Tapestry Concepts: constituents example names 7 of 8; create-concept writes `properties`; other paths omit it | Holds | `normalize/index.js:1613` (create-concept) vs `:611-619`, `:992-1000` |
| Intake: emit sites, `coreNodeTypeToRel` exceptions (`superset` → `IS_THE_CONCEPT_FOR`, header→superset; `IS_THE_CORE_GRAPH_FOR`), `:221` `LIMIT 1` without author or `ORDER BY`, `CORE_NODES_CYPHER` `:17-49`, OPEN.md row 230 | Holds | `install.js:171-176`, `:272-281`; `normalize/index.js:210`, `:221-229`, `:1702-1710`; `conceptCoreNodes.js:17-49`; `OPEN.md:263` |
| Ledger bug row: d-tag divergence conditions and examples; live `nostr-event-tag` case; two Superset readers; BIBLE §5 "deferred materialization stream" | Holds | node reproduces `dog-s-breed`/`dog's-breed`, `cafe`/`café`, `snake-case`/`snake_case`; `concept-header.json:10-11` with `oSlugs` excluded from overrides (`normalize/index.js:1238`); `install.js:1107-1112`; `pullClassThread.js:116`; `BIBLE.md:214` |
| Ledger L10 row: lines 52, 264-267; the 141/0 reproduction | Holds | see Quality gates. Precision nit N2 below |
| Show and Tell E15 status `designed`; the reuse hazard's three questions | Holds | `design-philosophies/README.md:38`; `show-and-tell.md` § The reuse hazard |
| Draft § 8: "Trusted Lists **and Scores** are found by their `d` key (worksheet W18)" | **Wrong for Scores** | Blocking B1 |

### Adversarial-review findings: were they applied?

All 21 unique confirmed findings are applied. I checked each one against the current text:

- **Draft (12):**
  - `z`/`o` collision (`:59`)
  - role-token sentence and scoped check (`:68`)
  - § 8 superset carve-out and `IS_A_PROPERTY_OF` wording (`:114`)
  - "only says which list" (`:58`)
  - Concept Header excluded (`:20`)
  - `#a` kinds (`:130`)
  - § 6 "own" deferred to the role spec (`:100`)
  - view-brief exception (`:120`)
  - NIP-32 self-label (`:131`)
  - `#q` without "copies" (`:134`)
- **Worksheet:** `:352` (9998/9999), `:358`, `:330`.
- **Tapestry Concepts:** `:20`.
- **Intake (4):** role-edge exceptions, `:17-49`, emit sites, the author gate keyed on the header the `o` names.
- **E15:** status set to `designed`.
- **Ledgers:** L10 condition (`:11`, `:24-25`); bug row conditions (`:18-23`) and in-deployment readers (`:30-35`).

One part of a corrected fix was not carried over. The corrected fix for the bug row asked it to note that tapestries story 3 already worked around the mismatch for the Concept Graph. That omission matters for the row's fix shape; see S1.

**Consistency.** The draft, W25/W2, Tapestry Concepts, Opinionated Views, Class Thread Relationships and the intake entry agree with each other on every point I checked. The draft stores no trust, POV or count. It rejects write-time gating (§ 6 `:98`) and widens at query time rather than stamping (§ 3 `:62`), consistent with principles 1–3. Principle 4 isn't touched.

## ADR adherence / Concept-graph integrity / House rules

These are mostly not applicable to a docs batch. There is no code, no concept-definition change and no firmware reinstall, and no tooling is added. The intake entry correctly calls out a reinstall for the eventual build. All handles in examples use placeholders (`<TA>`, `<deployment key>`, `<alice>`), and the diff contains no literal 64-hex pubkey.

## Things tests can't catch

- [x] No secrets, hosts or keys.
- [x] Scope: every edit serves the graduation of W25 or fixes a defect it surfaced: the pins example tied to W18, the two ledger rows, the intake entry, and E15.
- [x] Normative additions beyond the ten decisions are listed in N4, for the owner's gate.

## Findings

### Blocking

1. **protocols/drafts/dlist-auxiliary-events.md:116**: this claim is false for Scores, and it miscites W18. A Score is a value tag inside a subject-addressed NIP-85 assertion event, found by the tag's name (`treasure-maps.md:42`, § 5.2 `:208-210`). W18 (`worksheet.md:214-215`) covers only Trusted Lists, which are found by exact `d` key. Asked change: replace line 116 with
   `- **Discovery hints.** Trusted Lists are found by their exact \`d\` key (worksheet [W18](../worksheet.md#w18--descriptor-tag-letters-k--z--t)), and Scores by the name of their value tag ([Treasure Maps](./treasure-maps.md) § 5.2).`

### Should-fix (not blocking on their own)

- **S1, ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md:30-41.** The row misses a third in-deployment reader, which assumes the *current* name-slug convention. `ui/src/pages/tapestries/useConceptOptions.js:37` sets `conceptGraphSlug` from `oSlugs.singular`, and `tapestryDraft.mjs:72, :122` build each member's `<conceptGraphSlug>-concept-graph` import from it. This is tapestries story 3's workaround for `nostr-event-tag` (`reviews/done/tapestries/3-create-tapestry.md:78-84`). Fix-shape option 1 would make those imports miss for new concepts whose header `d` differs from the name slug. After "…`nostr-event-tag` included." add:
  `A third reader assumes the opposite, the current name-slug convention: the tapestries create flow builds each member's Concept Graph import from \`oSlugs.singular\` (\`ui/src/pages/tapestries/useConceptOptions.js:37\`, \`tapestryDraft.mjs:72\`, \`:122\`), the workaround tapestries story 3 added for \`nostr-event-tag\`.`
  In the Fix shape, after "…also fixes the two Superset readers", add `, but it moves new concepts' Concept Graphs away from where that create flow looks, so the flow must switch to the \`concept-graph\` tag or the header's d-tag in the same change`. Add `ui/src/pages/tapestries/useConceptOptions.js` to the Pointer.
- **S2, protocols/drafts/dlist-auxiliary-events.md:69 vs tapestry-concepts.md:184.** § 4 says a role's own spec "says how to choose among several candidates for that role". Tapestry Concepts separates the header author's events from everyone else's, but it never says which of the author's *own* events fills a role when two of them name the header with the same role. `CORE_NODES_CYPHER`'s `LIMIT 1` with no `ORDER BY` (intake hazard) is where that would bite. Don't decide it here. Record it: add open question 6 to the draft's § 11, for example `6. **Several own events for one role.** Tapestry Concepts doesn't say which of a header author's own events fills a core-node role when more than one names the header with that role.`

### Nits

- **N1, protocols/drafts/dlist-auxiliary-events.md:125.** "the Core Nodes Graph's `constituents` name core nodes from the header's side": the Core Nodes Graph is itself a core node, not the header. Suggest "…the header's `concept-graph` tag and the Core Nodes Graph's `constituents` already point from the concept to its core nodes."
- **N2, ledger/2026-10-09-lint-l10-misfires-on-shallow-clones.md:11, :24-25.** Above roughly 64 KiB after the match, the misfire is timing-dependent, not certain. A single-writer probe (`cat` of a file into `grep -qx`, under `pipefail`) gave exits `0 0 141` with 70,000 bytes after the match and `0 0 0` with 120,000. `git show`'s 3-of-3 reproduction on 695fac4 stands. Suggest "can misfire" for "misfires the same way".
- **N3, ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md:12.** `:1193` reads `names.oSlugs.singular`; the `toSlugName` call is at `:1176` (`deriveAllNames`). Cite `:1176` alongside `:1193`.
- **N4, owner visibility, not a defect.** These normative sentences go beyond the ten agreed decisions. None contradicts them, and W25's Resolution doesn't list them:
  - draft `:58` "(one per role, if the event has several)";
  - `:66` "A new role needs no ADR" (the `b` types need one; `inherit-from.md:34`);
  - `:68` the MAY role-token check with SHOULD-treat-as-unknown;
  - `:103` publishers MUST keep `o` in agreement with older links;
  - `:107` curation copies never carry `o`, and an Assistant's copy of an auxiliary event SHOULD carry `q`;
  - `:130` SHOULD NOT also carry a plain `a`;
  - `opinionated-views.md:212` MUST agree, `category` governs;
  - `tapestry-concepts.md:182`, which narrows the old "deterministic d-tags" statement to the Concept Graph only.

  Worth a line in the owner's next gate summary.

### Harness friction

1. The docs-mode rule "`npm test` stays green" can't be met in a bare cloud checkout (no `node_modules`). This review substituted an identical-failure-set comparison against a clean-tree baseline at the same commit. That is already covered by OPEN.md row 13, so no new row is needed.

## Verdict
**CHANGES_REQUESTED**

---

## Round 2 (2026-10-10)

**Diff:** the same working tree, with the round-1 fixes applied to `protocols/drafts/dlist-auxiliary-events.md` and the two ledger rows. Per reviewer rule 10, I re-derived every changed statement as a fresh claim, including the wording I suggested.

### Gates

- [x] `bash scripts/harness-lint.sh`: unchanged. There is one violation, the known L10 on 695fac4, plus this file's INFO line.
- [x] **Ledger-reading suites.** I ran only the two suites that read `ledger/` through the gate runner, since round 2 edited two ledger rows:
  `20261010T020817Z-32211-4511 [review-round2-ledger-suites] — PASS, 38 passed, 0 failed, 0 skipped, 2/2 suites` (`session-start` 32/0/0, `ledger-row-ids` 6/0/0).
  The full suite was not re-run. No test reads the draft, and the round-1 run already covers every other file.

### Fixes re-checked

| Item | Result | Evidence |
|---|---|---|
| B1, draft `:116` | **Resolved** | W18 `worksheet.md:215` says Lists are found by exact `d` key. A Score is read from the value tag named by its scope (`treasure-maps.md:42`, § 5.2 `:208-210`, `:485`). The link to `./treasure-maps.md` resolves. |
| S1, bug row `:35-38`, Pointer `:50` | **Partly resolved; new blocking issue (B2)** | The third-reader sentence holds: `useConceptOptions.js:37`, `tapestryDraft.mjs:72`, `:122`, and review `tapestries/3-create-tapestry.md:117-120` (round 2 of story 3 added `conceptGraphSlug`). The fix-shape clause at `:41-43`, which is my round-1 wording, is wrong; see B2. |
| S2, draft § 11 `:143` | Resolved | `tapestry-concepts.md:184` still gives no rule for several own events per role, so the open question is true. |
| N1, draft `:125` | Resolved | Read together, the `concept-graph` tag and the Core Nodes Graph's `constituents` do point from the concept to its core nodes. |
| N2, L10 row `:11-12`, `:25` | Resolved | "can still be writing" and "can misfire" match the evidence. "near that size it depends on timing" is narrower than my probe, which also varied at 70,000 bytes after the match and was 0/3 at 120,000 with `cat`, so the writer's write size matters too. It is hedged, so I ask no change. |
| N3, bug row `:12` | Resolved | `:1176` (`deriveAllNames` → `toSlugName`) is cited. |
| N4 | Handled outside the files | Goes to the owner in the session summary, as intended. |

### Findings

#### Blocking

2. **ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md:41-43**: the clause I suggested in round 1, "so the flow must switch to the `concept-graph` tag or the header's d-tag in the same change", is wrong. Option 1 keeps existing core nodes at their addresses. The header's d-tag therefore never finds an older diverging concept's Concept Graph: `nostr-event-tag`'s stays at `nostr-event-tagging-concept-graph`, the exact case the workaround exists for. The `concept-graph` tag finds it only after that header is re-emitted with a correct tag. A fixer who followed the clause would break the tapestries import for `nostr-event-tag` again. The flow reads headers from the relay only (`useConceptOptions.js:58`, `queryRelay` kinds `[39998]`), so it has no other source to fall back on today. This is my error, not the Implementer's.
   Asked change: replace
   `so the flow must switch to the \`concept-graph\` tag or the header's d-tag in the same` + newline + `change)`
   with
   `and the flow can't simply switch: the header's d-tag never finds an older diverging concept's Concept Graph (\`nostr-event-tag\`'s stays at \`nostr-event-tagging-concept-graph\`), and the \`concept-graph\` tag finds it only once that header is re-emitted with a correct tag. The same change must keep the flow finding both older and newer concepts)`

#### Non-blocking

- **ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md:43-44**: the line wrap is ragged ("or write the tag from the" / "Concept Graph's actual address. Existing headers whose tag is wrong need"). The rendered output is unaffected. Reflow it if you're editing the paragraph anyway.

#### Harness friction

1. None new. This round is an example of the case reviewer rule 10 describes: a suggested sentence adopted verbatim carried a reviewer error into the record, and the fresh re-check caught it.

### Verdict (round 2)
**CHANGES_REQUESTED**

---

## Round 3 (2026-10-10)

**Diff:** the same working tree. Only the Fix shape of `ledger/2026-10-10-core-node-dtags-ignore-header-dtag.md` changed (`:40-51`).

### Gates

- [x] `bash scripts/harness-lint.sh`: unchanged, with one violation, the known L10 on 695fac4.
- [x] Ledger-reading suites through the gate runner: `20261010T021002Z-17011-e868 [review-round2-ledger-suites] — PASS, 38 passed, 0 failed, 0 skipped, 2/2 suites`. The record reuses round 2's label because I re-ran the same two-suite script.

### B2 re-checked (fresh claims)

- **Lead sentence `:40-41`.** It names both options, which matches the row's two causes: core-node d-tags versus the published tag.
- **Option 1 `:43-48`.** It carries the round-2 replacement. Each part holds:
  - Existing core nodes keep their addresses, so the header's d-tag never finds an older diverging Concept Graph. `nostr-event-tag`'s is at `nostr-event-tagging-concept-graph` (`reviews/done/tapestries/3-create-tapestry.md:117-120`).
  - The published tag names `nostr-event-tag-concept-graph` until the header is re-emitted (`:28`).
  - "The only option that also fixes the two Superset readers" holds within the bullet's "new concepts only" scope. Option 2 changes only the tag, and both readers compute `<header d-tag>-superset`.
- **"Either way" `:49-51`.** It holds under both options: neither repairs an existing header's wrong tag. The `o` caveat is unchanged.
- **The ragged wrap is fixed.** No other line of the row changed.

**B2: resolved.** No new findings.

### Verdict (round 3)
**PASS**
