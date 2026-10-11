# Review: Story 2 — The Duty Menus pre-NIP

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-10-11
**Diff:** `git show eb67b78d` (base `029b20cf`, ADR 0002 accepted)
**Mode:** docs-mode (Protocol-Spec workflow). Test Design was skipped, so there is no test plan. This review audits the accuracy and consistency of the new spec prose. The gate is a regression check only.
**Inputs:** story `stories/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` (with its `## Deviations`); ADR `decisions/duty-menus-and-self-maps/0002-the-duty-menus-pre-nip.md` (Accepted, owner confirmations (a)–(c)); book `audits/duty-menus-and-self-maps/book.md`; handoff `docs/DUTY_MENUS_AND_SELF_MAPS_DESIGN_HANDOFF.md`; vocabulary policy `docs/NIP_REORG_DESIGN_HANDOFF.md` § D2; boundary rule `protocols/README.md`.
**Filename note:** the template's docs-mode blockquote (`templates/review-checklist.md:20`) says to drop the number and that there are no ACs. That is the known defect `ledger/2026-10-10-review-template-docs-mode-filename.md`. This is a storied docs-mode story, so it has ACs and uses the numbered filename.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test`, run as `GATE_LABEL=duty-menus-2-review npm test` on a clean tree at `eb67b78d`. `npm run -s gate:status -- --label duty-menus-2-review` reports:
  `20261010T235454Z-5682-05fc [duty-menus-2-review] started 2026-10-10T23:54:54.246Z on eb67b78d — FAIL, exit 1, 5545 passed, 27 failed, 591 skipped, 297/297 suites; failed: default-deny-mutations, dictionary-wired-create, dictionary-edit-concept, dictionary-resync-concept, curated-dlist-update-publish, author-scoped-inspection-roster, task-routes-owner-admin, admin-action-sweep, admin-action-sweep-access, tagging-edges-wiring, tagging-edges-drift-route`
  - **This diff does not cause the red.** I checked that myself:
    - **Per-suite counts against the clean-tree baseline** `20261010T221834Z-4660-bfd0` (`dafbfe50`), read from `tmp/gate-runs/*.json`. All 11 failing suites fail with the same counts as the baseline: default-deny-mutations 2, dictionary-wired-create 1, dictionary-edit-concept 1, dictionary-resync-concept 1, curated-dlist-update-publish 1, author-scoped-inspection-roster 1, task-routes-owner-admin 1, admin-action-sweep 8, admin-action-sweep-access 8, tagging-edges-wiring 2, tagging-edges-drift-route 1. That adds up to 27.
      - The baseline's twelfth suite, `tagging-edges-realtime-wrapper` (the known flake), passed in this run.
      - `information-for-agents` passed in this run. Its 4 failures in the Implementer's run (`20261010T233605Z-13704-b368`) were the live-link 504s, as the Implementer reported.
    - **Static check.** None of the 11 failing suites mentions `duty-menu`, `protocols/README`, `worksheet.md` or `protocols/drafts`. The suites that do read the edited `protocols/README.md` or `protocols/worksheet.md` all passed: `event-tagging-spec`, `open-ranking-stats` and `b-coverage-audit-and-disposition`.
  - With that evidence, a stash-and-rerun comparison was not needed. I stashed no files.
- [x] `npm run test:playwright`: not applicable (no UI).
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`.
- [x] _Lint, typecheck and build are not configured, so they were skipped._
- [x] **Links resolve.** All 9 relative links in `protocols/drafts/duty-menus.md` resolve to existing files. The one external link is NIP-85. Every internal § reference (§§ 1, 3, 5, 5.1, 5.4, 6, 6.1, 6.2, 7, 8.1, 8.2, 9, 10, 11, 13.3, 14) names a heading that exists. Every external § reference names a section that exists: Treasure Maps §§ 1, 3, 4.1, 4.4, 4.5, 4.7, 6, 9, 10.9 and 13 Q8; Inherit-From § "The `b` tag"; Shared Concepts § "Declared affiliation"; Content Categories § 5.1; Tapestry Concepts § "Data storage (json tag)". Two of them misstate what their targets say: B2, and NB1 for § 4.4.
- [x] **Vocabulary (AC5).** `grep -n -i -E "canonical|consensus|\broot\b"` over the spec finds only line 3, the metadata label `**Canonical:** not yet published`.
- [x] **Nous' pubkey** `15f7dafc…c7270` is the same 64-hex string at all 7 places in the spec, and in the worksheet, ADR and handoff (D4).

## Claims adherence (docs-mode)

Line numbers are in `protocols/drafts/duty-menus.md` unless a file is named.

| # | Claim | Where | Evidence | OK |
|---|---|---|---|---|
| 1 | The header's own-coordinate pointer `b` self-declares it | :65, :77 | inherit-from.md:38: a pointer-typed `b` naming the carrier's own a-coordinate self-declares it; only addressable headers (39998 qualifies). | ✓ |
| 2 | `required p` gives subject `p`, and a DList-based list over menus is `30392:dlist:⟨Duty Menu⟩` | :78 | content-categories.md:217–218 (the subject rule; "nostr developers → `30392:dlist`"); treasure-maps.md:426 (§ 10.9). | ✓ |
| 3 | `duty` is recommended, so an empty menu is valid | :79 | decentralized-lists.md:33 (`required` means child items *must* use the tag); `recommended` carries no such force. | ✓ |
| 4 | A person adopts the header with a pointer `b` to it | :80 | shared-concepts.md:35 (Declared affiliation). | ✓ |
| 5 | The menu's `z` is its parent pointer under the base NIP, and so Stamping's personal `z` | :88 | decentralized-lists.md:43; stamping.md:22 (write rule 1). | ✓ |
| 6 | A menu MUST NOT carry a header-declaring `z` | :88 | dlist-header-declaration.md:21, :27–37 (`["z","list"]` or the Concept for Concept Headers handle). | ✓ |
| 7 | The shared handle being complete is a deliberate exception to Stamping's read contract | :94 | stamping.md:48 ("MUST NOT rely on … any single shared handle's `#z` index being complete"). The exception is sound because § 6.1 makes Nous' `z` part of what a menu *is*. | ✓ |
| 8 | An empty-relay `duty` row is invalid, unlike Treasure Maps § 3 | :104 | treasure-maps.md:77 (element 3 "MAY be the empty string"). | ✓ |
| 9 | `3038x` plus `not-offered 30385` offers every Score except Scores about external things | :111 | treasure-maps.md:104 and :353 (`30385` is the Score kind for external things). | ✓ |
| 10 | Keys are normalized per Treasure Maps §§ 4.1, 4.4, 4.5 | :116–119 | treasure-maps.md:85–87 (decode and re-encode into the canonical TLV form), :155 (omitted = empty = any), :162 (`39998:dlist-header` = `39998`). See NB3 on Concept keys. | ✓ |
| 11 | `json` is namespaced `dutyMenu` per Tapestry Concepts § Data storage | :126 | tapestry-concepts.md:67 says "namespaced by concept slug", which would be `duty-menu`. The code keys the namespace by the camelCase key (`src/api/normalize/index.js:392`, `:1329`). ADR 0002's Context settles it as `dutyMenu`, and the spec names it explicitly. See NB6. | ✓ |
| 12 | The validity rule: 39999, `d`, one `p` equal to the author, Nous' `z` | :142–149 | ADR 0002 sub-decision 4, verbatim in substance. | ✓ |
| 13 | A foreign-authored item with `p` = X nominates X under the base NIP | :151 | decentralized-lists.md:13 (community-contributed items) and :45 (item tags). | ✓ |
| 14 | "Covers" is defined by Treasure Maps § 4.4 | :157 | § 4.4 (treasure-maps.md:153–158) covers omitted and empty segments only. Family wildcards are in § 4.2 (:95), and the bare Concept kind is in § 4.5 (:162). § 13.3 rows 1–2 depend on § 4.2. | NB1 |
| 15 | The answering row is the most specific covering row, by Treasure Maps § 6 | :158 | treasure-maps.md:241–246. The winner is unique: covering rows all agree with K wherever they name a value, and § 5.3 removes duplicate keys. | ✓ |
| 16 | NIP-85 requires one key per algorithm, and one per user of a personalized algorithm | :44, :176 | NIP-85 (`nostr-protocol/nips` master `85.md:39`): "Service providers MUST use different service keys for distinct algorithms, including a key per user when the algorithm is personalized". | ✓ |
| 17 | Lookup filter and order (hint, then 10002 write relays, then Nous' relays) | :182–188 | ADR 0002 sub-decision 8; D3. | ✓ |
| 18 | The directory's signals restate Show and Tell's reuse-hazard questions and H3 | :203, :205 | design-philosophies/show-and-tell.md:124–126 (the three questions) and :140 (H3: Tell covers cold start, as a hint). The paraphrase is faithful. | ✓ |
| 19 | "Active" is for the key's own Map to say: see Treasure Maps § 9 | :209 | treasure-maps.md:299–307 has no self-Map text yet. ADR 0002 sub-decision 11 mandates the pointer, and story 3 lands § 9.2 (book.md acceptance frame, bullet 3). This is a planned forward reference. See NB2. | ✓ (fwd) |
| 20 | An empty republish rides the sync and replaces older copies | :215 | ADR 0002 Context (`docs/TAG_FEDERATION_OPS.md` caveat 4; strfry honours `e`, not `a`). | ✓ |
| 21 | The NIP-09 deletion names `a`, `e` and `k`, because some relays apply only `e` | :216 | Mirrors assistant-designation.md:108 (curation-copy removal). See NB5 on `<id>`. | ✓ |
| 22 | A customer's own Map already links them to their key | :220 | D9 (handoff:33); NIP-85 10040 entries are public by default. | ✓ |
| 23 | Principle 5: how an Assistant computes stays off the menu, "as it stays off the Map (Treasure Maps § 1, principle 3)" | :38 | treasure-maps.md:48 counts "no algorithm" as part of "how". § 5.4 (:134) puts an `algorithm` on the menu, "such as the `d` of a `score-algorithm` item": the same identifier that trust-determination-methods.md:87 makes a Method's `algorithm` field. | **✗ B1** |
| 24 | Private duties would be NIP-44-encrypted "the way Treasure Maps carry private entries (Treasure Maps § 13, question 8)" | :283 | treasure-maps.md:527 says the opposite: "Delegation entries in the Map stay public until NIP-85's current private-entry text is checked." The NIP-44 pattern it defines (W22, worksheet.md:267) is for private *items*, published by the owner's Assistant and encrypted *to itself*. | **✗ B2** |
| 25 | Duties come only from the observer's Map | :34 | treasure-maps.md:301 and :305 (§ 9). | ✓ |
| 26 | The Assistant key is element 2 of an entry | :42 | treasure-maps.md:58. | ✓ |

## Spec adherence (acceptance criteria)

- [x] **AC1.** The file exists. Metadata (:1–6): 📝 pre-NIP; Sources names the handoff (linked) and ADR 0002 (named). The README index row is at `protocols/README.md:73`.
- [x] **AC2.**
  - The header is published by Nous, named by pubkey (:50, :54–75).
  - It is self-declared, citing inherit-from's Self-declaration rule (:77).
  - It declares `required p`, `recommended duty`, and allows `not-offered`, `storefront`, `name`, `description` and `json` (:66–72).
  - The AC's "requires … the duty rows" is superseded by the accepted ADR, which makes `duty` `recommended` and lists this among its departures. The ADR rules here.
  - The dictionary path, and the declarations being in place from first publication, are at :80.
- [x] **AC3.**
  - One replaceable item per key at `d` `duty-menu` (:85, :93).
  - Nous' `z` on every menu (:88, :94).
  - Rows are key plus relay, at most one per normalized key (:100–104, :121).
  - Offered, never active (:28, :34, :105).
  - Only the key's own item counts (:35, :142–151).
  - Details are allowed; no price or tier (:38, :126–136, :224).
- [x] **AC4.**
  - The most-specific rule, and no covering row means not offered (:155–165).
  - Lookup by pubkey (§ 8.1), and listing with per-point-of-view filtering (§ 8.2).
  - Storefront versus per-customer: the self-pointing marker, which fails closed; the MAY link; and how rows differ (:171–175).
  - One key per algorithm (:176).
  - The directory is marked non-normative (§ 9).
  - Providers without a storefront are not listed (:200). A per-customer menu cannot pose as a storefront (:171).
- [x] **AC5.**
  - Offered versus active is § 10, and Self-Maps are not defined.
  - The W1 note is at worksheet.md:21.
  - The vocabulary grep is clean.
- [x] **AC6.**
  - Links resolve, harness-lint is clean, and the gate shows no regression.
  - `git show --stat eb67b78d` touches only `protocols/drafts/duty-menus.md`, `protocols/README.md` and `protocols/worksheet.md`, plus the story's Deviations log.

The ACs are met. B1 and B2 are accuracy defects inside the AC-satisfying text, not missing ACs.

## ADR adherence

| Sub-decision | Spec | Verdict |
|---|---|---|
| 1 Header tags, `b`, subject, `duty` recommended, dictionary path | :54–81. The tags match the ADR in order and in their description strings. | ✓ |
| 2 Item: replaceable 39999, reserved `d`, one `p`, Nous' `z`, other `z`, no header-declaring `z`, the Stamping exception, `name`/`description` | :85–94. "MUST carry" is softened to "exactly one" and "required" (:87–88); § 6.1 makes both operative. | ✓ |
| 3 Rows, the empty-relay rule, `not-offered`, normalization, first wins, reserved elements | :98–122 | ✓ |
| 4 What counts as a menu; nomination | :140–151 | ✓ |
| 5 Resolution for any K, partly offered, the entry shape, the worked example | :153–167, :271–279. Deviation 3 is judged below. | ✓ |
| 6 Details: one `json`, `dutyMenu`, `description`/`interval`/`algorithm`, answering row's key, unknown fields ignored | :124–136 | ✓ (but see B1) |
| 7 Storefront marker (fails closed), MAY link (a claim, not proof), row meaning, MUST NOT, one key per algorithm | :169–176 | ✓ (see NB4) |
| 8 Lookup filter, order, publisher SHOULD | :180–188 | ✓ |
| 9 Listing, POV filter, non-normative directory, kind 0 grouped by website, Tell/Show/author signals, no storefront → not listed | :190–205 | ✓ |
| 10 Hint, never a gate | :30, :36 | ✓ |
| 11 Offered versus active, pointing to TM § 9 | :209 | ✓ |
| 12 Republish; empty withdrawal SHOULD; NIP-09 MAY with `a`/`e`/`k` | :211–216. "SHOULD" became an imperative ("Withdraw … by republishing"), which is acceptable. | ✓ |
| 13 Security and privacy (four points) | :218–224 | ✓ |
| 14 Layout and metadata | Metadata :1–6; title, summary, At a glance; §§ 1–14 as listed; § 13 has the three examples; § 14 has the two open questions. | ✓ |
| 15 README row and W1 note | Checked below. | ✓ |
| (a) `not-offered` exceptions | § 5.2 | ✓ |
| (b) MAY link; self-pointing, fail-closed marker | :171–172 | ✓ |
| (c) "Not found" means no storefront, not unfindable | :200, :221 | ✓ |

Nothing in the spec goes beyond the ADR in substance, except the second sentence of principle 5 (:38), which the ADR does not ask for. That sentence is B1. The other additions are drawn from the handoff's § 4 shapes or are plain glosses:
- "a reader that starts from a copy follows the copy's `b`" (:81; handoff § 4.1);
- the examples of a hint in § 8.1;
- the two-Assistant switch in § 10 (handoff § 1).

Neither the metadata `Companion to:` line nor the four extra Terms is scope creep.

## Deviations, judged

1. **§ 9 does not cite Show and Tell. The outcome is accepted, but the stated reason is wrong.** The ADR says § 9 "leans on" H3; it does not require a link, and the spec carries H3 and the three questions faithfully (claim 18). However, the logged reason, that "a protocol spec does not cite repo-internal advisory docs (protocols/README.md, the boundary rule)", is not in the boundary rule, and two drafts do cite the doc: `protocols/drafts/dlist-auxiliary-events.md:101` and `protocols/drafts/opinionated-views.md:218`. A non-normative citation would follow that precedent. It is optional (NB7).
2. **Neutral example names and relays: accepted.** The ADR fixes only the `<A>`/`<S>` placeholders and the full Nous key, and both are honoured. Strictly, the boundary rule does not forbid real relays in examples (treasure-maps.md § 14 uses them), but neutral ones are no worse.
3. **The added § 6.2 step-4 sentence for a narrower `not-offered` row: accepted.** It follows from sub-decision 5 and is what § 13.3 row 3 shows. The log calls it an addition, but it actually *replaces* two pieces of ADR text:
   - the ADR's "and the exceptions their own entries";
   - "(story 3's fallback)", which a spec can't cite.

   The meaning is kept. Dropping the story pointer leaves "read-time resolution" undefined for now (NB2).
4. **"decoded and re-encoded" instead of "canonicalized": accepted.** The § 4.1 citation carries the canonical TLV form, so nothing is lost. D2 targets the social sense of "canonical", so this goes further than D2 requires, but it does no harm.

## § 13.3 against § 6.2, row by row

Menu 13.2 has these rows: `duty 3038x → scores`, `not-offered 30385`, `duty 3039x:tag → lists`, `duty 39998 → concepts`.

| K | Covering rows → answering row | Narrower rows | § 6.2 result | Table says | Match |
|---|---|---|---|---|---|
| `30382:rank` | `3038x` only (`30385` is another kind) → `3038x`, duty | none | offered at scores; entry `[30382:rank, A, scores]` | same | ✓ |
| `30385:rank` | `3038x`, `30385`; exact kind beats family (§ 6) → `30385`, not-offered | none | not offered | "Not offered" | ✓ |
| `3038x` | `3038x` → duty | `30385` not-offered | partly offered; option 2: `[3038x, A, scores]` plus the step-4 notice | same | ✓ |
| `3039x` | none (`3039x:tag` is narrower; `3038x` and `39998` are other kinds) | `3039x:tag` → lists | not offered as a whole; partly offered | "write `[3039x:tag, A, lists]` instead" | ✓ (see NB1) |
| `39998` | `39998` → duty | none | offered at concepts | same | ✓ |

All five rows agree with the rules. Row 4's "instead" is the only place that settles the case with no covering row but narrower `duty` rows. Step 4's "as well" and "answering row's relay" assume there is an answering row (NB1).

## README row and W1 note

- **README** (`protocols/README.md:73`): five columns, like its neighbours. It sits after DList Auxiliary Events (:72) and before Amendments (:74), as Implementation note 2 requires. The name, path, status and "Working copy here…" text match sub-decision 15 verbatim. The origin adds the handoff path in parentheses, which is a harmless addition.
- **W1** (`protocols/worksheet.md:21`): a dated note placed before **Refs** (:23). It carries every element of sub-decision 15: held by Nous' key, a deliberately held community key, a self-declared Shared Concept, adoption by pointer-`b`, and no firmware copy. It adds one clause, "not a per-deployment Tapestry Assistant, which ADR 0015 showed to be fragile", which is accurate. NB8 covers the unqualified ADR number.

## Concept-graph integrity
- [x] The only handle, `39998:15f7dafc…c7270:duty-menu`, is in `kind:pubkey:slug` form and consistent everywhere.
- [x] No concept definitions changed, so no firmware reinstall is needed (ADR: "No").
- [x] There is no new code, so the orient-via-summaries check does not apply. Nous' key is a fixed community key, not the TA, so the TA-hardcode rule does not apply (handoff § 4.1, last bullet). In a spec it is a wire fact, as straycat's key is in dlist-header-declaration.md § 4.

## Things tests can't catch
- [x] No secrets; the only key is a public key. No debug content and no commented-out text.
- [x] Scope: limited to the three `protocols/` files. Self-Maps and the TM § 4.6 reservation are correctly left to story 3.
- [x] Edge cases in prose: mostly covered. The gaps are NB1, NB3, NB4 and NB5.

## House rules check
- [x] Concept Graph API authority respected.
- [x] No new lint, typecheck or build tooling.

## Product-guide adherence
- n/a: no PRD and no UI copy.

## Findings

### Blocking

1. **B1 — protocols/drafts/duty-menus.md:38 contradicts :134 under the spec it cites.**
   - Principle 5 says how an Assistant computes "stays off the menu, as it stays off the Map (Treasure Maps § 1, principle 3)". That principle (treasure-maps.md:48) lists "no algorithm" among what stays off the Map.
   - § 5.4 (:134) then defines a menu `algorithm` field, "such as the `d` of a `score-algorithm` item": exactly the identifier a Trust Determination Method's `algorithm` field holds (trust-determination-methods.md:87).
   - The ADR mandates the field (sub-decision 6), but not this sentence. So the sentence must give way.
   - **Asked change:** reword principle 5's second sentence so that it agrees with § 5.4. For example: a menu may *name* an algorithm (§ 5.4), but its parameters, point of view and cutoffs stay off the menu, as a Trust Determination Method stays off the Map. Or drop the Treasure Maps parallel.
2. **B2 — protocols/drafts/duty-menus.md:283 misstates its cited section.**
   - "NIP-44-encrypted, the way Treasure Maps carry private entries (Treasure Maps § 13, question 8)". But treasure-maps.md:527 says the Map's delegation entries "stay public until NIP-85's current private-entry text is checked".
   - The NIP-44 pattern that section does define (W22, worksheet.md:267) is for private *items*, published by the owner's Assistant and encrypted *to itself*. That is not entries encrypted for an observer.
   - **Asked change:** cite accurately. For example: "NIP-44-encrypted, as NIP-85 allows for a Map's `.content`, which Treasure Maps § 13 Q8 still keeps public pending review", or point at W22's private-item pattern and say how a menu would differ.

### Non-blocking

1. **protocols/drafts/duty-menus.md:157–164**: three gaps in the resolution rule, all inherited from the ADR's wording:
   - (a) "covers" cites only Treasure Maps § 4.4. Family wildcards (`3038x` ⊇ `30382`) are § 4.2, and the bare Concept kind is § 4.5; § 13.3 rows 1–2 rely on § 4.2. Suggest "(Treasure Maps §§ 4.2, 4.4, 4.5)".
   - (b) Step 4 considers only *narrower* rows. A row that overlaps K without being broader or narrower can win part of K by § 6. For example, with answering row `*` and K = `3039x`, a row `*:tag` wins the Tag-based lists. Such a row should also make K partly offered. Suggest "rows that win some insight under K".
   - (c) Step 4's "as well" and "the answering row's relay" assume an answering row exists. Only § 13.3 row 4 ("instead") covers the case where no row covers K. One clause would settle it.

   Worth folding (a) and (c) into the B1/B2 round.
2. **protocols/drafts/duty-menus.md:162 and :209**: these are forward references that story 3 must land.
   - "Read-time resolution" is not defined anywhere yet. It becomes Treasure Maps § 3's read-time fallback in story 3 (book.md, acceptance frame bullet 3).
   - Treasure Maps § 9 (the target of :209) does not yet mention a key's own Map.
   - **Carry-forward for story 3:** its § 3 fallback should cover the "partly offered" option-2 case, and its § 9.2 should be what :209 points to.
3. **protocols/drafts/duty-menus.md:118**: dropping empty trailing segments is wrong for Concept keys. Their `d` is "the rest, verbatim, and may contain colons" (treasure-maps.md:162), so `39998:foo:` would be normalized to `39998:foo`, and `39998:` to the bare kind. Suggest exempting Concept keys from the trailing-segment step. This is an edge case.
4. **protocols/drafts/duty-menus.md:175** (ADR sub-decision 7, verbatim): this needs an owner decision. NIP-85 requires a per-user key only for *personalized* algorithms (`85.md:39`). The provider of a non-personalized algorithm names one key in everyone's Map, and that key is also its main-key menu. If it marks itself a storefront, the MUST NOT (unless "the observer's own Assistant") stops readers from filling Map entries from its rows. If it doesn't, it stays out of the directory. Suggest a § 14 open question, or a clarification that a non-personalized key's storefront rows are its own offer. Please raise it as an OPEN.md row at the next gate.
5. **protocols/drafts/duty-menus.md:216**: two issues with the deletion rule.
   - `["e", "<id>"]` does not say which version. Presumably it is the current (empty) menu, as assistant-designation.md:108 names "the copy's event id".
   - On an `e`-only relay, a deletion that follows the empty republish removes that republish too. An older copy rebroadcast later is then accepted again, which partly undoes the protection the republish gave.

   This is ADR text. Suggest naming the version, and adding a caution that the deletion is optional for that reason.
6. **protocols/drafts/tapestry-concepts.md:67** (outside this diff): "namespaced by concept slug" disagrees with the code, which uses the camelCase key (`src/api/normalize/index.js:392,1329`), and with this spec's `dutyMenu`. The Duty Menus spec is unambiguous because it names the namespace. Tapestry Concepts' wording should say "key" (the Primary Property, tapestry-concepts.md:171). This needs a ledger row, because AC6 rules the file out here.
7. **Story Deviation 1's reason is inaccurate** (see "Deviations, judged"). Optional: add a non-normative Show and Tell citation to § 9, following dlist-auxiliary-events.md:101.
8. **protocols/worksheet.md:21**:
   - "ADR 0015" is unqualified, and three ADRs carry that number. W1's own text says "tags-branch ADR 0015" (worksheet.md:13, :23); suggest the same.
   - "deployments add it to their dictionaries" differs slightly from the spec's "a person adds" (:80). The difference is harmless in a cross-deployment entry.
9. **protocols/drafts/duty-menus.md:215**: "so it reaches the relays the old one reached" is slightly strong. It holds for relays that sync on Nous' `#z` and for places the publisher republishes to (§ 8.1). "Rides the same sync" is the ADR's safer wording.

### Harness friction
1. The template's docs-mode blockquote defect (`templates/review-checklist.md:20`) is already ledgered as `ledger/2026-10-10-review-template-docs-mode-filename.md`. No new row is needed.
2. Two instructions conflict on committing. The Reviewer's standing rules say to commit the review whatever the verdict (`workflows/5-review.md` § Per-phase commits). This run's dispatch said not to commit, so the review is left uncommitted for the orchestrator, as in story 1's review. It is not a new defect, but it is worth a line in the existing ledger entry if it recurs.

## Verdict
**CHANGES_REQUESTED**

Blocking: B1 (`protocols/drafts/duty-menus.md:38` against `:134`) and B2 (`protocols/drafts/duty-menus.md:283`). Both are one-sentence fixes, and the rest of the spec is accurate and conforms to the ADR. On the next round, check each reworded sentence as a fresh claim against treasure-maps.md:48, :527 and trust-determination-methods.md:87, including any wording taken from this review.

## Close-out on a pass (same commit)
- n/a this round: the story stays `Approved`. There is no completion detection, because the book cannot be complete with story 2 open.

## Round 2 (2026-10-11)

**Diff:** `git show c17c945f`. It changes `protocols/drafts/duty-menus.md`, `protocols/worksheet.md`, the story's Deviations, the epic's story-3 bullet, and adds `ledger/2026-10-11-tapestry-concepts-namespace-wording.md`. The unrelated `151e39fb` (security-auth-exposure #8) sits between the rounds and is not reviewed here.
**Owner input since round 1:** record non-personalized providers as open question 3.
**Method:** every changed statement was re-derived from its sources as a fresh claim, including the wording this review suggested in round 1 (reviewer.md step 10). Line numbers are in `protocols/drafts/duty-menus.md` unless a file is named.

### Quality gates (round 2)

- [x] `npm test` was run as `GATE_LABEL=duty-menus-2-review-r2 npm test` on a clean tree at `c17c945f`. `npm run -s gate:status -- --label duty-menus-2-review-r2` reports:
  `20261011T001826Z-819-fd63 [duty-menus-2-review-r2] started 2026-10-11T00:18:26.409Z on c17c945f — PASS, exit 0, 5578 passed, 0 failed, 591 skipped, 298/298 suites`
  - This is better than the 11-suite red baseline the dispatch quoted. `151e39fb` landed between the rounds and turned all 11 suites green. It also added the 298th suite, the route-table walk its commit message names.
  - The Implementer's round-2 run (`20261011T001032Z-30120-f0d6`, 27 failed) was on `d130e0c3+dirty`, before `151e39fb` was in history.
  - The diff touches no code and no test, so the green run means no regression.
- [x] `bash scripts/harness-lint.sh`: `harness-lint: clean (0 violations)`. This was run before this section was appended.
- [x] NIP-85 was fetched from `https://raw.githubusercontent.com/nostr-protocol/nips/master/85.md` with curl through the proxy (166 lines). This Reviewer has no WebFetch (see Harness friction).

### Round-1 blockers, re-derived

| # | New text | Source check | OK |
|---|---|---|---|
| B1 | :38: a Treasure Map "names no algorithm (Treasure Maps § 1, principle 3)" | treasure-maps.md:48: "no algorithm, data sources, point of view, cutoffs". | ✓ |
| B1 | :38: a menu may name the algorithm "the way NIP-85 asks a service key's kind 0 to describe its algorithm" | 85.md:145: providers "SHOULD sign a kind `0` of each service key that explains … what the current version of the algorithm is about". "Asks" fits a SHOULD. NIP-85's own kind-0 example (85.md:154) also describes the point of view and the inputs. The menu stays narrower than the kind 0 by design, and that is consistent. | ✓ |
| B1 | :38 against § 5.4 (:134) | The principle now permits exactly what § 5.4 defines (a name, such as a `score-algorithm` `d`). It keeps parameters, point of view and cutoffs off the menu, which matches the Method fields in treasure-maps.md:313. No contradiction remains. | ✓ |
| B2 | :283: "NIP-85 lets a kind 10040 carry entries encrypted in its `.content`" | 85.md:109: "keep them private by JSON-stringifying and encrypting the tag list within the `.content` field using NIP-44". | ✓ |
| B2 | :283: "Treasure Maps keeps its delegation entries public for now (§ 13, question 8)" | treasure-maps.md:527: "Delegation entries in the Map stay public until NIP-85's current private-entry text is checked." The sentence no longer claims Treasure Maps has a private-entry pattern. | ✓ |

B1 and B2 are fixed.

### § 6.2 resolution, re-derived

To avoid hand-waving, I wrote a small model of Treasure Maps § 4.2/§ 4.4 matching and § 6 precedence for non-Concept keys. It resolves each insight once against the menu's rows and once against the Map entries that option 1 writes, then compares the relays.

| Case | Menu rows | K | Option 1 writes | Result |
|---|---|---|---|---|
| A (the spec's example) | `*`→R0, `*:tag`→R1 | `3039x` | `3039x`→R0, `3039x:tag`→R1 | ✓ for Tag lists, DList lists and profile lists |
| B | `3039x`→R0, `3039x:tag:⟨D⟩`→R2 | `30396:tag` | `30396:tag`→R0, `30396:tag:⟨D⟩`→R2 | ✓ |
| C | `3039x`→R0, `30396:tag::⟨T⟩`→R1 (narrower), `3039x:tag:⟨D⟩`→R2 (overlapping) | `30396` | `30396`→R0, `30396:tag::⟨T⟩`→R1, `30396:tag:⟨D⟩`→R2 | ✗ `30396:tag:⟨D⟩:⟨T⟩`: the menu gives R1 (the exact kind beats the family), the Map gives R2 |
| D | `3039x`→R0, `3039x:tag`→R1, `30396:tag`→R0 | `3039x` | `3039x`→R0, `3039x:tag`→R1 (`30396:tag` answers with K's relay, so it is not "such a row") | ✗ `30396:tag:⟨D⟩:⟨T⟩`: the menu gives R0, the Map gives R1 |
| Concept | any | `39998`, `39998:<d>`, `*` | — | The overlap branch never arises. A Concept key has one verbatim scope, there is no Concept family wildcard, and `*:…` never reaches a Concept (treasure-maps.md:162). Every row is covering, narrower or disjoint. |

The intersection key the dispatch asked about:
- **(a) In the § 4.7 grammar:** yes, in every case tried (`3039x:tag`, `30396:tag:⟨D⟩`, `30396:tag:⟨D⟩:⟨T⟩`, `3038x:rank`). One gap: "whichever value either key names" is undefined for the kind slot, where both keys always name a value. The example implies "the more specific".
- **(b) Narrower than K:** yes. If a row wins part of K without covering it, the segment-wise intersection differs from K in at least one segment, where it is more specific.
- **(c) Wins over K for exactly the insights the row wins:** only for a row taken on its own. The intersection beats K on every insight under both, so case A and case B are exact. Combined with other written parts it can fail. In case C, raising the overlapping row's kind slot to K's removes the left-most difference the menu's § 6 decided on (the effect treasure-maps.md:273 describes). The category then decides the other way.

Case D uses only narrower rows, so it also fails under ADR 0002 sub-decision 5's wording ("If rows narrower than K give a different relay", ADR :164). Round 1 missed it. The round-2 text makes it explicit by writing entries only "for each such row".

**§ 13.3 against § 6.2:** all five rows re-derive the same way as in round 1:
- `30382:rank`: answered by `3038x`.
- `30385:rank`: answered by `30385`, so not offered.
- `3038x`: partly offered through the narrower `not-offered 30385`.
- `3039x`: no covering row; `3039x:tag` is narrower, so "instead" matches the new no-answering-row sentence at :164.
- `39998`: answered by `39998`.

No row of the table uses the overlap branch or depends on the faults above, so the table still agrees with § 6.2.

### Other folded fixes

| Fix | Where | Source check | OK |
|---|---|---|---|
| Concept keys exempt from trailing-segment trimming | :118 | treasure-maps.md:162 ("the rest is the `d` tag, verbatim, and may contain colons"). `39998:foo:` keeps `d` = `foo:`. See NB11 on `39998:`. | ✓ |
| Withdrawal SHOULD | :215 | ADR 0002 sub-decision 12 (:212) says SHOULD. "Travels by the same `#z`-filtered relay sync as the old one" is a true conditional: both versions carry Nous' `z`. | ✓ |
| Deletion `e` names earlier versions, never the empty menu | :216 | `docs/TAG_FEDERATION_OPS.md`:112 (kind 5 has no `z`, so `#z` streams don't carry it) and :129 (dcosl honours `e`, not `a`). Naming the empty menu's id on an `e`-only relay removes the newest version, so an older copy is accepted again. The reasoning holds. The required `k` 39999 is also what Tapestry's `tagDeletions` stream selects (:119). | ✓ |
| Nous' kind 10002 | :186 | Not asked for in round 1. See NB10. | ✓ (scope note) |
| camelCase namespace | :126 | It now says "namespaced by the concept, here under its camelCase key", and no longer attributes camelCase to Tapestry Concepts. `src/api/normalize/index.js:49` (`toCamelCase`) and `:1329` (`names.oKeys.singular`, "e.g. coffeeHouse"). | ✓ |
| Ledger row | `ledger/2026-10-11-…` | tapestry-concepts.md:67 ("namespaced by concept slug") and :171 (Primary Property: "the main property key for this concept's namespace"). The code references resolve. The row's line-free pointers survive drift. | ✓ |
| W1 wording | worksheet.md:21 | "tags-branch ADR 0015" matches W1's own Refs line (:23). "a person adds it to their own dictionary by pointer-`b`" matches the spec at :80. | ✓ |
| Open question 3 | :285 | 85.md:39 requires a per-user key only "when the algorithm is personalized", so one key for a non-personalized algorithm is allowed. § 7's MUST NOT (:175) is quoted accurately. It records the owner's answer. | ✓ |
| Story Deviation 1 corrected | story | `protocols/drafts/dlist-auxiliary-events.md:101` cites Show and Tell. The corrected reason is honest. | ✓ |
| Epic carry-forwards | epic | Bullets 1 and 2 are round 1's NB2. Bullet 3 is ADR 0002's Consequences (:258–260), nearly verbatim. | ✓ |

### Scope and the logged deviation

- Everything in `c17c945f` answers a round-1 finding or the owner's answer, with two exceptions:
  - **The § 6.2 generalization.** It is logged as a deviation that generalizes sub-decision 5.
  - **The Nous kind-10002 locator (NB10).** It is not logged as its own deviation.
- **Judging the deviation:**
  - **Detection is accepted.** Counting any row that wins part of K, overlapping rows included, follows from sub-decision 5's intent and from Treasure Maps § 6. It is what round 1 NB1(b) asked for.
  - **The construction is not accepted as written.** The intersection-key rule and the "for each such row" selection are new mechanism that sub-decision 5 does not contain. They make a claim ("so that the Map's own § 6 gives each insight its relay") that cases C and D falsify (B4).

### Findings (round 2)

#### Blocking

3. **B3 — protocols/drafts/duty-menus.md:157: "covers" misstates Treasure Maps § 4.4 and leaves out `*`.**
   - "an omitted or empty trailing segment covers any value (§ 4.4)". § 4.4 (treasure-maps.md:155–156) covers an omitted *trailing* segment or an empty segment *anywhere*: "An empty segment may sit in the middle: `30396:tag::⟨Vegan⟩`". Read literally, a `30396:tag::⟨T⟩` row (the § 10.7 pattern) does not cover `30396:tag:⟨D⟩:⟨T⟩`, so a broader row answers instead.
   - The list names family wildcards (§ 4.2) but not `*`. § 4.2 lists `*` separately ("every insight", treasure-maps.md:96), and a bare `*` also covers Concepts (:327; only `*:tag` and `*:dlist` never reach one, :162). Step 4's own example, "when `*` answers K" (:160), needs `*` to cover `3039x`.
   - Origin: the enumeration copies ADR 0002's Context paraphrase (:44, "omitted and empty trailing segments"). The ADR's rule itself cites § 4.4 whole ("under § 4.4 scopes", :161). So the round-1 text was correct by reference, and spelling the rule out made it wrong.
   - **Asked change:** either state § 4.4 as written and add `*`, or define "covers" by matching. One possible wording: "every insight K matches, the row's key also matches (Treasure Maps §§ 4.2, 4.4, 4.5)". This suggestion is a claim too, and round 3 should check it as one.
4. **B4 — protocols/drafts/duty-menus.md:160–164: option 1 does not do what it says ("so that the Map's own § 6 gives each insight its relay").**
   - **(i) Swallowed nested rows** (case D). A row that answers with K's relay is not "such a row", so it gets no entry. A broader written part then claims its insights. The same happens to a `duty` row nested inside a `not-offered` row: the client would say insights won't come from the key when they will. This gap was inherited from sub-decision 5 (ADR :164) and is now explicit.
   - **(ii) Order reversal** (case C, new this round). Intersecting with K raises an overlapping row's kind slot. Two written parts can then compare differently in the Map than their rows did in the menu.
   - **(iii) Kind-slot intersection undefined.** "Whichever value either key names" doesn't say which kind wins when both keys name one, which is always.
   - **(iv) Unclear wording.**
     - Option 1 no longer says that K itself is written; the ADR's "as well" was dropped.
     - "An entry for each such row" includes `not-offered` rows, which cannot have one.
   - **Asked change:** make the guarantee true, or narrow the claim and the construction. For example:
     - write K, plus an entry for every `duty` row narrower than K that wins some insight under K, whatever its relay. Then every key compared in the Map is K or one of the menu's own keys, and § 6 keeps its order;
     - leave overlapping rows to the second option (K plus read-time resolution), or give a construction that keeps § 6's order among all written parts.

     Point (i) changes sub-decision 5's rule, so it needs an ADR amendment (Architect) or a logged deviation for round 3 to judge. Round 3 should re-check whatever lands against cases A–D.

#### Non-blocking

10. **protocols/drafts/duty-menus.md:186** — "found through Nous' own kind 10002 write relays" was neither a round-1 ask nor in ADR sub-decision 8 (:191–192). The story's Round 2 block lists it under "Smaller fixes from round 1", which is wrong.
    - It fits D3 (kind 10002 "stays useful as a fallback locator") and gives readers a way to actually find those relays, so the change itself is fine.
    - However, it narrows "where Nous' header is published" to Nous' write relays, while the publisher SHOULD at :188 keeps the broader phrase.
    - Suggest logging it as its own deviation with its reason, and aligning :188.
11. **protocols/drafts/duty-menus.md:118** — I re-derived round 1's NB3, which was my own claim.
    - `39998:foo:` keeping `d` = `foo:` holds, so the exemption is right.
    - My round-1 claim that reading `39998:` as the bare kind would be wrong is not settled by Treasure Maps. § 4.5 makes its `d` the empty string; § 4.4 makes an empty segment "any". The exemption takes § 4.5's reading, but § 6.2 step 1's "empty trailing segment covers any value" takes § 4.4's.
    - Suggest saying which reading the spec uses for `39998:` and `39999:`, or carrying the question to Treasure Maps (story 3).

#### Harness friction

1. **The dispatch's gate baseline is stale.** `151e39fb` turned the 11 red suites green between the rounds, so the next dispatch should quote the green baseline. This is not a defect and needs no row.
2. **The dispatch's tool instruction is wrong for this agent.** It says to load WebFetch via ToolSearch, but this agent's tool list (`.claude/agents/reviewer.md:4`, "Read, Write, Bash, Glob, Grep") has neither. NIP-85 was fetched with curl instead. This needs an OPEN.md `meta` row: either the dispatch template should name curl, or the Reviewer agent should get WebFetch.
3. **Commit instruction conflict.** This run's dispatch again said not to commit, which conflicts with `workflows/5-review.md` § Per-phase commits. This is the same conflict as round 1's friction item 2. The review is left uncommitted for the orchestrator.

### Verdict (round 2)
**CHANGES_REQUESTED**

Blocking: B3 (`protocols/drafts/duty-menus.md:157`) and B4 (`protocols/drafts/duty-menus.md:160–164`). B1 and B2 are fixed, and every other folded fix checks out against its sources. The story stays `Approved`.
