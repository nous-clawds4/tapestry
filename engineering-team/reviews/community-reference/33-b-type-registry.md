# Review: Story 33 — `b`-tag type registry and type-gated semantics

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-06-13
**Diff:** `git diff a9d6c9fe~1..a9d6c9fe` (spec commit `a9d6c9fe`; story `4926f9d0` + ADR `ee747047` precede it; base `staging` at `e808ecb4`)
**Mode:** docs-mode (Protocol-Spec workflow) — no test plan by design; this review audits **accuracy and consistency**, not coverage. ADR: `engineering-team/decisions/community-reference/0029-b-type-registry.md`.

## Quality gates (run by reviewer, not trusted)

- [x] `npm test` — **PASS** (exit 0; all 29 suites green, e.g. profile-follows-list 27/27, scheduled-tasks-with-arguments 37/37; `Overall: PASS`). Docs-only change caused no regression.
- [x] `npm run test:playwright` — not applicable (no browser/UI change; documentation only).
- [x] _Lint not configured — skipped._
- [x] _Typecheck not configured — skipped._
- [x] _Build not configured — skipped._

## Spec adherence (acceptance criteria, audited against final file states)

- [ ] **AC1 — type registry incl. the one-question decision rubric: PARTIAL → blocking.** `protocols/drafts/inherit-from.md:24–29` defines the two-value registry (`"pointer"` correspondence/locator, no deference/resolution/trust-coupling; `"inherit"` live deference, must be explicit) and notes the W5-option-(a) lineage (`:29`). **But the one-question decision rubric — "when they edit their list, should the meaning of yours change?" — appears nowhere in the spec** (or in any ratified document; it survives only in `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:84`). The criterion names it explicitly ("including the one-question decision rubric"). See Blocking finding 1.
- [x] **AC2 — fail-safe default.** `inherit-from.md:26`: absent element 3 reads as `"pointer"`, least-commitment, "an underspecified tag never grants live deference." Supersession recorded in ADR 0029 §Decision-1 and the ADR 0027 Amended-by header.
- [x] **AC3 — resolution walks inherit-typed only.** Walk (`inherit-from.md:48`), closure (`:50`), first-listed-wins over the inherit subset (`:55`), root redefinition (`:56`), pseudocode filter `where type == "inherit"` (`:67`), and the explicit-inherit (never "not pointer") polarity stated twice (`:39`, `:73`).
- [x] **AC4 — type-gated edge derivation.** `inherit-from.md:39–42`: inherit → `INHERITS_FROM` (canonical, no `source`); pointer/untyped → `REFERENCES {source:'b-tag'}`, child→target, no flip (`:44`), deferring to BIBLE §22's collision contract. BIBLE §22 (`BIBLE.md:1442`) names the producer class and widens the endpoint clause (39998/39999).
- [x] **AC5 — aggregation scoped.** `inherit-from.md:87–92`: consensus counts inherit-typed only (W1 link), pointer weight zero in v1 (`:79`, `:89`), discovery walks include both types (`:90`); restated at `BIBLE.md:1448`.
- [x] **AC6 — type-split transitivity.** `inherit-from.md:50`: affiliation = membership in the inherit-only deference closure; pointer breaks the chain ("a node carrying only pointer-typed `b` tags has a closure of itself alone"); closure membership is a set, order-independent. Restated at `BIBLE.md:1514` and `protocols/drafts/communities.md:56`.
- [x] **AC7 — query-shape consequence.** Non-indexed type element ⇒ `#b` is fetch-then-filter: `inherit-from.md:29` and `:92`.
- [x] **AC8 — multi-z carve-out in its normative home.** `protocols/drafts/tapestry-concepts.md:51` (the "parent pointer (z tag)" / fundamental-link section, as the ADR designates), with restatements at `BIBLE.md:192` (§5), `BIBLE.md:1432` (glossary z-tag), and `BIBLE.md:375` (Rule 2 → "at least one valid parent pointer"). Verified against the base NIP: `protocols/nips/decentralized-lists.md:49/:51` does permit multi-`z` and only recommends one-`z` — the claim is true and the published working copy is untouched.
- [x] **AC9 — amending ADR exists.** `decisions/community-reference/0029-b-type-registry.md`: Accepted; amends 0027 (default-inherit, ungated derivation) and 0028 (ungated walk/closure); cites the handoff as design source; records all four planning-gate resolutions.
- [x] **AC10 — BIBLE §6/§21/§25/§26 consistent; no survivors.** §6 table (`BIBLE.md:265–266`), glossary (`:1409`, `:1414`, `:1431`, `:1432`), §25 (`:1511–1516`), §26 (`:1522–1524`) all restate the registry. Corpus grep for `default "inherit"` / default-`inherit`: survivors only in immutable/historical records (ADR 0027 body, protocols-directory ADR 0003 body, the design handoff, and story/ADR 0029 quoting the superseded text) — clean. No ungated-walk text ("all `b` tags" / "every `b` tag") survives in any mutable doc.
- [x] **AC11 — communities.md explicit inherit type.** All nine sites updated (`communities.md:18`, `:19`, `:30`, `:33`, `:47`, `:48`, `:50`, `:56`, `:104`); no reliance on the old default remains; the `b`-less/pointer-only CD is a standalone root (`:50`); the downgrade-to-pointer mitigation added (`:104`).
- [x] **AC12 — worksheet updated.** W5 → Graduated → inherit-from spec, resolution recorded as option (a) with the pointer rename rationale (`protocols/worksheet.md:47–55`); W1 (`:19/:21`) and W2 (`:27/:29`) reflect the registry and drop `REFERENCES` from candidate letters; W6 (`:59–63`) notes inherit-only closure + reduced pressure ("inheritance is now opt-in and rarer"); W11 appended (`:97–103`). The "Graduated" status fits the ledger's stated format (`worksheet.md:5`).
- [x] **AC13 — `npm test` green.** Verified above.
- [ ] No criterion is silently dropped — **one is** (AC1's rubric clause; Blocking 1).
- [x] No behavior added that isn't in the story.

## ADR adherence (edit-site inventory vs actual diff)

- [x] **Files changed match the ADR exactly** — the diff touches precisely the 9 files in the inventory, nothing else.
  - `inherit-from.md` — all 12 sites present (Sources `:4`; framing `:11/:15`; table `:19–22`; wire format + pointer example `:24–29`; multi-parent `:35`; derivation `:37–44`; resolution/closure + transitivity-at-closure `:48–50`; gloss/root `:55–56`; pseudocode `:67/:73`; Scope v1 `:79`; security `:83`; aggregation `:87–92`; family table `:96–107`).
  - `BIBLE.md` — all 13 sites + 3 carve-out sites present; §25 heading (`:1509`) and TOC (`:38`) unchanged as required.
  - `communities.md` 9/9; `worksheet.md` W1/W2/W5/W6 + W11; `class-thread-tags.md:56` (the optional `:50` touch not taken — explicitly optional); `tapestry-concepts.md:51`; epic index updated.
- [x] **Immutable records respected.** ADRs 0027/0028 gain exactly one Amended-by header line each (2 added lines total, bodies byte-identical); no story or review files touched by the spec commit.
- [x] **"Checked clean" list verified clean:** `protocols/nips/decentralized-lists.md`, `protocols/README.md`, `AGENTS.md`, worksheet W8, class-thread-tags `:54` uppercase-`B` reservation — all untouched.
- [x] No new dependencies; no new tooling.
- [x] **Citation hygiene honored.** `profile/0029-profile-verified-followers-count.md` exists; every new 0029 citation in the diff is epic-qualified ("`community-reference` ADR 0029"). Bare "ADR 0027"/"0028" references are unambiguous (no other epic has those numbers).

## Cross-reference resolution (docs-mode substitute for test coverage)

- [x] **W11 anchor** `#w11--cloud-formation--multi-z-stamping-rules` matches the heading `## W11 — Cloud formation & multi-z stamping rules` (`worksheet.md:97`) under the file's established anchor convention (verified against W1/W2/W5/W6 anchors, all of which resolve).
- [x] Relative links in the touched files resolve: `../worksheet.md`, `../nips/decentralized-lists.md`, `./tapestry-concepts.md`, `./class-thread-tags.md` from `protocols/drafts/`; `./drafts/...` from `worksheet.md`.
- [x] BIBLE §-references resolve: §5 (`:190`), §6 (`:200`), §21 Glossary (`:1392`), §22 (`:1436`), §25 (`:1509`), §26 (`:1520`); W11's "§ The parent pointer (z tag)" matches `tapestry-concepts.md:39`.

## Internal consistency / wire-format sanity

- [x] Table (`inherit-from.md:19–22`), registry prose (`:24–27`), derivation section (`:39–42`), pseudocode (`:67`), and family table (`:100–105`) agree: inherit → `INHERITS_FROM`; pointer-incl.-absent → `REFERENCES {source:'b-tag'}`.
- [x] Filter polarity (explicit `"inherit"`, never "not pointer") stated at `:39` and `:73`; consistent with absent-reads-as-pointer at `:26`.
- [x] Root definition (`:56`), closure-of-itself-alone (`:50`), and ADR Decision 2 agree. Closure Cypher in BIBLE §26 (`:1524`) correctly noted as staying valid *because* derivation is type-gated.
- [x] Old "`INHERITS_FROM` MAY carry a `type` property (default `inherit`)" restatement removed from BIBLE §25 — coherent (under the registry, the edge only ever derives from explicit-inherit tags).
- [x] ADR claim "zero resolver/emitter code" re-verified: `INHERITS_FROM` absent from `src/`.

## Concept-graph integrity / house rules

- [x] No concept definitions, schemas, handles, or events change; **no firmware reinstall required** — correctly called out in story §Concepts-touched and ADR §Consequences.
- [x] No new lint/typecheck/build tooling.
- [x] Concept Graph API authority not implicated (documentation-only change).
- [x] No secrets, no debug code, no leftover scaffolding (docs-only diff).

## Findings

### Blocking

1. **`protocols/drafts/inherit-from.md:24–29` — the one-question decision rubric is missing.** Story AC1 requires the inherit-from spec's type-registry definition to include the rubric: *"when they edit their list, should the meaning of yours change?"* (yes → `"inherit"`; no, just connected/corresponding → `"pointer"`). It appears nowhere in any ratified document — only in the design handoff (`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:84`), which is slated to flip to SUPERSEDED once P1–P4 land, at which point the rubric would be lost from the living corpus. (Root cause: ADR 0029's edit-site inventory omitted it; the Implementer followed the inventory faithfully — but the story is the acceptance contract, and adding the rubric contradicts nothing in the ADR.) **Asked change:** add the rubric to the registry definition in `inherit-from.md` (the natural seam is the end of the wire-format registry block, around `:27–29`), phrased as author-facing guidance for choosing between the two types — one or two sentences mirroring the handoff's settled wording.

### Non-blocking

1. **`engineering-team/stories/community-reference/33-b-type-registry.md:62`** — the "Review:" linked-artifact line still reads "(filled in after Review phase)". Fill it with this file's path on the fix pass.
2. **`docs/COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md:19–37`** — describes pre-0029 untyped `b` deference. No action: it is a historical session record whose protocol design is marked ratified into `communities.md` (which is updated); recorded here so a future reader doesn't mistake it for drift.
3. **`engineering-team/epics/community-reference.md:10`** — story 33 will need its "— Done" marker when it eventually passes (31/32 carry one).

## Verdict

**CHANGES_REQUESTED** — one blocking issue (Blocking 1). Everything else audited clean: all 9 files conform to the ADR's edit-site inventory, immutable records untouched beyond the two header pointers, every cross-reference and worksheet anchor resolves, no old-semantics survivors in mutable docs, the rewritten spec is internally coherent, and `npm test` is green. The fix is one or two sentences in `inherit-from.md`; re-review should be quick.
