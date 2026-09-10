# Review: Story 3 — The `inherit-items` facet — item inheritance in the `b` type registry

**Reviewer:** Claude (acting as Reviewer)
**Date:** 2026-09-10
**Diff:** `git diff cf566410..HEAD` (commits `bd3464e2` ADR 0003, `0dc2a74f` spec edits + pointers + intake entry;
docs-mode — numbered form because the story is storied; claims-adherence table per the review template's
docs-mode variant; precedents: `reviews/dlist-curation/2-…`, `reviews/done/tl-treasure-map/1-…`)

## Quality gates (run by reviewer, not trusted)

- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**. L9 is satisfied because BIBLE.md:8 was bumped in
      `0dc2a74f`, the same commit that edits BIBLE.md:1546/:1630 (`git log -1 -- BIBLE.md` = `0dc2a74f`, 2026-09-10 →
      0 days). Remaining output is the pre-existing waivers/INFO. *(Note for the fix round: L9 measures header date vs
      the last commit touching BIBLE.md — a fix commit within 14 days of 2026-09-10 stays clean without another bump.)*
- [x] Links and anchors — every `[..](..)` on an added line resolved mechanically (scratchpad script, GitHub slug
      rule): **16 links, 15 resolve.** BIBLE:1630 → `protocols/drafts/inherit-from.md`; README:57 →
      `./drafts/inherit-from.md`; inherit-from → `./shared-concepts.md` (×3), `./class-thread-relationships.md`,
      `../worksheet.md#w5--references-publishing-semantics`,
      `../worksheet.md#w6--set-valued-override-algebra-for-resolved-definition` (×2; heading at worksheet.md:57);
      shared-concepts → `./inherit-from.md` (×2), `./stamping.md`; assistant-designation → `./inherit-from.md`,
      `./shared-concepts.md`; worksheet:63 → `./drafts/inherit-from.md`. The one that does not resolve is the
      draft-relative `[Inherit-From](./inherit-from.md)` quoted inside the ADR's implementation note 3 (ADR :223) —
      prose destined for the draft, where it does resolve (assistant-designation.md:71). Backticked repo-root paths
      on added lines all exist (`src/api/neo4j/eventSync.js`, `src/lib/bValueForms.js`, the ADR, the story, the
      intake, the handoff, README, worksheet, BIBLE).
- [x] README row ↔ BIBLE pointers ↔ draft ↔ worksheet ↔ handoff ↔ ADR mutually consistent — `protocols/README.md:57`
      (scope phrase "type registry incl. `inherit-items`", story-refs `story 5 ✅ · dlist-curation #3`, status 📝
      pre-NIP unchanged), `BIBLE.md:1546` and `:1630`, draft `:26`/`:118`, worksheet `:59`/`:63`, handoff `:158–167`
      and `:188`, ADR Decision §§1–9: all say three values; absent-or-unknown → `pointer`; additive v1;
      `INHERITS_ITEMS_FROM` as the target; derivation not yet updated; W6 narrowed to removal/replacement.
- [x] Targeted regression suites — the nine suites that read the changed documents, each via
      `node -e "require('./test/<f>.test.js').run()"` (node v24.18.0): `tag-applicability` 19/0 ·
      `event-tagging-spec` 5/0 · `open-ranking-stats` 29/0 · `treasure-maps-router-preset` 5/0 · `b-tag-primitive`
      16/0 · `b-coverage-audit-and-disposition` 26/0 · `task-queue-semaphore-protection-audit` 6/0 ·
      `scheduled-search-and-house-scores-refresh` 12/0 · `harness-lint` 41/0. All green.
- [ ] Full `npm test` — not run: markdown-only diff (no `src/`, `ui/`, or `test/` change); the nine doc-reading suites
      were run individually above; the full run is red-by-default on this machine (OPEN.md row 191).
- [x] Sweeps — `git diff --check cf566410..HEAD` clean; no 64-hex literal on any added line (no hardcoded
      assistant/TA pubkey).
- [x] _Lint / typecheck / build not configured — skipped._

## Claims-adherence table *(docs-mode variant — one row per substantive claim)*

| # | Claim (spec section / ADR / pointers) | Evidence checked |
|---|---|---|
| 1 | The registry really was closed at two values and type-gated on the explicit string | Base `cf566410:protocols/drafts/inherit-from.md:25` "closed two-value registry", `:86` "closed at two values"; `src/api/neo4j/eventSync.js:271` `const isInherit = tag[2] === 'inherit';` — the `else` branch (`:279–283`) derives `REFERENCES {source:'b-tag'}` for absent, `pointer`, and any other string; the definition-walk pseudocode `:77` filters `type == "inherit"` and `:83` says so in prose. Claim true. |
| 2 | The stamping rule skips non-pointer types | `src/lib/bValueForms.js:78` `if (r.type != null && r.type !== 'pointer') continue;` — an `inherit-items` row (non-null, not `pointer`) never stamps. Nuance: an *unknown* type also never stamps there, i.e. the stamp selector is stricter than "unknown reads as `pointer`" (derivation, by contrast, does treat unknown as pointer). The ADR's "reads as pointer everywhere it matters" (Context) is exact for deference/derivation and conservative for stamping; no conflict with the facet's standing, since the spec's required stamp tier is affiliation-anchored and the author selects (`stamping.md:23–25`). |
| 3 | Nothing outside the emitter consumes `INHERITS_FROM`, so the distinct-type decision's consumers are the specs | `git grep INHERITS_FROM` over non-markdown files: `eventSync.js:276` (the emitter), `test/b-tag-primitive.test.js`, `test/b-coverage-audit-and-disposition.test.js` (guards on the emitter's Cypher), and audit logs. No Cypher reader in `src/`, `ui/src`, `bin/`, `scripts/`, `setup/`. `INHERITS_ITEMS_FROM` appears in no code. ADR Context `:34–40` is accurate. |
| 4 | Nothing emits `inherit` today (the registry's first extension since ADR 0029) | Every `b`-tag construction site: `src/api/concept/bDisposition.js:172`, `src/api/concept/selfDeclare.js:97`, `src/firmware/install.js:1059` (all `'pointer'`), `bDisposition.js:199` (the sentinel). The only `'inherit'` string in `src/`+`ui/src` outside CSS values is the gate `eventSync.js:271`; `src/lib/sharingState.js:28` documents "`'pointer'` on the live wire". Nothing emits `inherit-items` either. |
| 5 | The amended `shared-concepts.md` sentences agree with each other | `:35` (inherit-family never affiliates; pointer alongside) ↔ `:55` (zero deference weight for `INHERITS_ITEMS_FROM`) ↔ `:56` (discovery walks: every type) ↔ `:67` (closure: `inherit` only, not `inherit-items`) ↔ `:68` (reach: every type) — consistent among themselves. **Not** consistent with the sentences left standing around them: `:53` ("the two `b` types"), `:58` ("returns both types"), `:70` (reach "of *either* type") — Blocking 1. |
| 6 | `communities.md` is untouched and still accurate | Last commit `7fccbf25` (nip-reorg #4). `:18`, `:30`, `:47`, `:50`, `:56`, `:104` speak of `"inherit"` vs pointer and none claims the registry is exhaustive; "an absent type reads as `"pointer"`" stays true; `:50`'s "a CD with only pointer-typed `b` tags is a standalone definition" is not contradicted (a CD with only `inherit-items` tags is also a definition root, which `:50` does not deny). Member-inheritance of a Community Declaration is left to that protocol (story Out of scope). Correct to leave untouched. |
| 7 | "for every type" in the Direction paragraph and the reach table is correct given three types | `inherit-from.md:52` — the `INHERITS_ITEMS_FROM` edge is child→parent, unflipped (`:49`, ADR Decision §7), so (a) and (b) hold for all three; `shared-concepts.md:68` — reach over every type is Decision §6. Both correct. (Their neighbours `inherit-from.md:60` and `shared-concepts.md:70` still say "both"/"either" — Blocking 1.) |
| 8 | The per-DList Precedence paragraph's 39998 scoping is consistent with the dual-author lookup section | `assistant-designation.md:84` scopes the rule to kind-39998 headers and records 39999-declared-header precedence as not yet defined; `:96–100` is written for `39998:<U>:<S>` and `:102` names kind-39998 headers as the section's subject. One story, one thing (AC-9); review #2's NB-3 is closed by this. Mirrors ADR Sub-decision 3 / Decision §9. |
| 9 | The header contract names the facet; a writer MAY add a pointer `b`; worked example updated | `:71` (`"inherit-items"`, ADR 0003, MAY pointer alongside, "affiliates nothing" → Shared Concepts § Declared affiliation) and `:92` (`"inherit-items"` replaces `<type>`) — exactly ADR note 3. The MAY sits beside the section's existing MUST / MUST NOT / SHOULD (`:72–76`); consistent usage. |
| 10 | The intake entry describes the code gap accurately | `_intake.md:2340–2361`: the `eventSync.js:271` gate → pointer form today (true, row 1); no item-set resolver (true, row 3); the three asks match ADR Consequences and Out of scope (derivation, resolver, ADR 0032 cache question). "Nothing in the book exercises the derivation" rests on the epic's no-Neo4j-write decision (`epics/dlist-curation.md:72–77`): `buildImportCypher` runs only via `/api/neo4j/event-update` (`src/api/index.js:307`), the `io.js:498` import, `pullClassThread.js:239`, and `firmware/install.js:1063/1094/1122` — there is no automatic strfry→Neo4j lane for an arbitrary kind-39998 header, so publishing to local strfry alone derives nothing. True today; see Non-blocking 10 for the story-4 caution. |
| 11 | BIBLE §25's status clause is true | `BIBLE.md:1630` — `buildImportCypher` gates on the literal `inherit` (row 1); an `inherit-items` tag derives the pointer form (`:279–283`); the intake entry is dated 2026-09-10 (`:2340`); no item-set resolver exists (row 3). True. The glossary row `:1546` says the same in short form. |
| 12 | W6's narrowing matches what the new section specifies (additive only) | Spec `:91–96` (union, order-free, visited-set, no subtraction), `:118` (additive specified above; removal/replacement deferred, items-deference closure only) ↔ worksheet `:59` (status) / `:63` (update paragraph: same four points) ↔ handoff `:188`. Consistent. The entry's original paragraph (`:61`) still predicts "§ Scope" and "the inherit-typed deference closure"; the update paragraph supersedes both explicitly — acceptable for an append-style ledger. |
| 13 | The new section mirrors ADR 0003 Decision §§1–9 in spec voice and adds nothing normative | §1 ↔ `:26`, `:34`, `:118`; §2 ↔ `:30`, `:32`; §3 ↔ `:89–110`; §4 ↔ `:112`; §5 ↔ `:56`, `:83` (filter unchanged), `:114`; §6 ↔ `shared-concepts.md:35`, `:55`, `:56`, `:67–68`; §7 ↔ `:23`, `:46`, `:49`, `:140` + BIBLE `:1630` status; §8 ↔ `:122`; §9 ↔ `:38` (kinds unchanged) + `assistant-designation.md:84`. Glosses added — "Not a declared affiliation" (`:30`), "does not feed affiliation" (`:89`), "never launders trust" (`:112`), "(with or without `"inherit"`, per the definition question)" (`:32`) — each restates §§4–6, none adds a rule. Rationale is pointed at the ADR, not duplicated. |
| 14 | RFC keywords are used consistently | The new `inherit-from.md` prose is descriptive ("Must be explicit", "readers gate on", "consumers must never gate"), matching the definition-resolution section's register (`:62–66`, no RFC caps); the only new RFC keyword is the MAY in `assistant-designation.md:71`, beside that section's existing MUSTs. Consistent. |
| 15 | The item-set pseudocode is consistent with the definition walk's conventions | `:98–109` mirrors `:68–80`: same entry/walk split, `visited` keyed on `node.a-tag`, `resolve(parent)`, filter on the explicit string (`type == "inherit-items"`), `∪` where the field walk uses `fill_unset`; the cycle guard returns the empty set. `own_items(node)` is left undefined — Non-blocking 6. |
| 16 | Story AC-8's cross-reference list matches what changed | Diffstat = the eight files ADR notes 1–8 name + the story + the ADR. `assistant-designation.md` ✓, BIBLE `:1546`/`:1630` ✓, README `:57` ✓, handoff D10 (`:158–167`) + §3 W6 row (`:188`) with status still 🔴 OPEN (`:3`) ✓, `communities.md` untouched ✓ (row 6). No scope creep. |
| 17 | The Phase-4 deviations are justified | The Direction paragraph `:52` ("either" → "every") is the one edit beyond the ADR's list; Decision §7 (the new edge is child→parent, not flipped) makes it necessary — accepted. The multi-parent clause (`:42`) is *in* ADR note 1, so the story's "two sentences beyond" is a miscount (Non-blocking 7); the family-table lead-in `:132` ("three types span three rows") is a second undisclosed-but-necessary companion to the new row — correct. The header bump applies the story-2 lesson (OPEN.md row 238); the regression claim is true (re-run above). |
| 18 | No concept / schema change; no firmware reinstall; no literal assistant pubkey | ADR Consequences; the diff touches no `firmware/` or concept files; the hex sweep found nothing; `INHERITS_ITEMS_FROM` is reserved in prose only (no graph change until the intake follow-up). |
| 19 | ADR 0003 is Accepted and its Context claims hold | `:3` Accepted; rows 1–4 re-verify the Context's grep claims; Sub-decisions 1–3 (`:94–127`) are each carried into the spec (rows 8, 9, 13). |

## ADR adherence
- [x] Files changed match ADR implementation notes 1–8 exactly, plus the disclosed Direction sentence and the
      family-table lead-in (`:132`); note 9 (`communities.md` unchanged) honoured.
- [x] No code, no dependencies, no `test/` changes (docs-mode).

## Concept-graph integrity
- [x] No concept definitions changed; no firmware reinstall required (ADR states it; diff confirms).

## Things tests can't catch
- [x] No secrets, no debug output, no commented-out matter.
- [x] Adversarial probes — (a) Can an old reader over-defer on an `inherit-items` tag? No: every reader in the
      corpus gates on the exact string `inherit` (`eventSync.js:271`, pseudocode `:77`, `bValueForms.js:78`), so the
      facet degrades to `pointer` — the fail-safe the spec now states at `:34`. (b) Does the shared `visited` set
      make a diamond (A →items B, A →items C, both →items D) lose items? No: D is visited once and its set is
      unioned into whichever branch reaches it first; union is order-free, so the result is identical. (c) Does
      "unknown type reads as pointer" now make an unknown-typed `b` a declared affiliation? Per the spec's words,
      yes (correspondence); the reference deployment's stamp selector still declines to auto-stamp it (row 2) —
      within the spec's latitude (the author selects; stamping is SHOULD-level).
- [x] Collateral damage outside the diff: the stale two-type sentences (Blocking 1) — a consistency gap, not a
      behavioural one; no code path changes.

## House rules check
- [x] Assistant / TA pubkey never literal; nothing in the diff identifies a deployment.
- [x] No new lint / typecheck / build tooling.

## Findings

### Blocking
1. **Stale two-type enumerations left standing in the documents this diff amends, contradicting the three-value
   registry the same documents now declare.** ADR 0003's own Context says "Whatever form the items edge takes must
   keep those sentences true, or amend them", and Decision §6 says reach and discovery walks "now read 'every
   type'" — but the following sentences still say two:
   - **protocols/drafts/inherit-from.md:12** — "The `b` tag carries one of two **types**: `"pointer"` … and
     `"inherit"` …" — the spec's opening paragraph, versus `:26` "closed three-value registry" and `:118` "closed at
     three values" in the same document. **Asked change:** "one of three **types**: `"pointer"` (correspondence …),
     `"inherit"` (definitional deference …), and `"inherit-items"` (item inheritance — "my list's items are this
     parent's, plus my own"). Only `"inherit"`-typed tags participate in definition resolution; only
     `"inherit-items"`-typed tags in item resolution."
   - **protocols/drafts/inherit-from.md:60** — "*reach*, the closure over both `b` types" → "over every `b` type"
     (matches `shared-concepts.md:68` and Decision §6).
   - **protocols/drafts/inherit-from.md:126** — "a relay-side `#b` filter returns both types" → "returns every
     type" (the mechanical fact is type-blind).
   - **protocols/drafts/shared-concepts.md:53** — "but the two `b` types feed **different questions**" → "but the
     types feed **different questions**" — this is the lead-in to the very bullets (`:55–56`) the diff amended to
     name three types.
   - **protocols/drafts/shared-concepts.md:58** — "the `#b` filter returns both types" → "every type".
   - **protocols/drafts/shared-concepts.md:70** — "through `b` edges of *either* type" → "of *every* type". This is
     the prose definition of reach, two lines under the table row (`:68`) the diff changed to "**every** type"; as
     it stands the section defines reach two different ways.
   - **BIBLE.md:1635** — "discovery walks include both types (ADR 0029)" → "every type (ADR 0029, extended by
     `dlist-curation` ADR 0003)" — same §25 the diff amended at `:1630`.
   Then re-run `bash scripts/harness-lint.sh` (expect 0 violations) and the nine suites above (expect the same
   counts). Optionally fold Non-blocking 1–4 into the same commit.

### Non-blocking
1. **protocols/drafts/inherit-from.md:16** — "selected by its type: correspondence (`"pointer"`) or definitional
   deference (`"inherit"`)" is non-exhaustive now; optional: "…, definitional deference (`"inherit"`), or item
   inheritance (`"inherit-items"`)".
2. **protocols/drafts/inherit-from.md:4** (repo metadata) — the Implementation line lists the two implemented
   derivations and the unimplemented definition walk but not the facet's status; BIBLE `:1630` carries it. Optional
   one clause: "(`inherit-items` → pointer form until the derivation is updated; no item-set resolver)".
3. **protocols/drafts/shared-concepts.md:103** — "absent or pointer types carry zero weight (v1)" — `:55` now says
   `inherit-items` does too; optional: "absent, pointer, or `inherit-items` types".
4. **BIBLE.md:1567** (§22) and **protocols/worksheet.md:19** (W1) — "discovery walks … include both types" —
   outside the amended sections and attributed to ADR 0029, so readable as historical; a one-word fix each keeps
   the corpus saying one thing.
5. **Stamping standing is stated by composition, not by name.** ADR Decision §6's "does not select stamp targets"
   reaches the specs only as "never affiliate" (`shared-concepts.md:35`, `inherit-from.md:30`) plus
   `stamping.md:23`'s affiliation-anchored required tier; handoff D10 `:164` says "does not stamp" outright, while
   reach (`:68`, every type) makes an `inherit-items` target a permissible demand-selected extra (`stamping.md:25`).
   All consistent with the ADR (enters reach; does not select), but story AC-5 asked for the stamping standing
   "stated explicitly". Optional: append "and anchors no stamps" to `shared-concepts.md:35`, or soften D10 to
   "does not anchor stamps".
6. **protocols/drafts/inherit-from.md:106** — `own_items(node)` is undefined. For a kind-39998 header the natural
   reading is the kind-39999 events whose `z` names it (DList NIP); for a kind-39999 carrier (the tag is defined
   for both kinds, `:38`) "its items" has no obvious meaning. The definition walk carries a parallel "not yet
   formalized" note (`:85`); the item section has none. Not decided by the ADR, so not for this story to invent —
   the resolver follow-up (intake 2026-09-10) should settle it; optional one-sentence note mirroring `:85`.
7. **engineering-team/stories/dlist-curation/3-inherit-items-facet.md:105–108** — "Two sentences beyond the
   ADR's edit list" is a miscount (row 17): only the Direction paragraph is beyond the list; the multi-parent
   clause is ADR note 1's second bullet, and `:132` is the undisclosed companion edit. Correct if re-touched.
8. **engineering-team/epics/dlist-curation.md:87** — "Derived edge records the facet (property on
   INHERITS_FROM, least invasive)" is superseded by ADR 0003 Sub-decision 1 (distinct type
   `INHERITS_ITEMS_FROM`); `:82` "closed at two values today" is now dated. Story 4's Implementer reads the epic —
   a one-line carry-forward there (as review #2 did for its NB-4/NB-5) keeps the stale form from being built.
9. **engineering-team/decisions/dlist-curation/0003-inherit-items-facet.md:223** — the quoted
   `[Inherit-From](./inherit-from.md)` is draft-relative and does not resolve from the ADR's folder; it is prose
   destined for the draft (where it resolves, `assistant-designation.md:71`). Cosmetic.
10. **Story-4 caution (from claims row 10).** The intake's "nothing in the book exercises the derivation" holds
    only while the assistant header stays out of every `buildImportCypher` lane (`/api/neo4j/event-update`, the
    `io.js` import, `pullClassThread`, firmware install). Publishing to local strfry alone imports nothing; the
    story-4 Architect should keep the header off those lanes per the epic's no-Neo4j-write decision (`:72–77`).

### Harness friction *(candidate OPEN.md `meta` rows — not edited here)*
1. **Docs-mode has no consistency-sweep step.** The docs-mode Implementer rule is "exactly the spec edits the ADR
   specifies" (`workflows/protocol-spec-workflow.md` → Docs-mode rules), so when an ADR changes an enumeration
   (two → three values) every restatement of the old count survives unless the ADR lists each one — ADR 0003's
   Context flagged "keep those sentences true, or amend them" and its edit list still missed seven. Candidate fix:
   add "grep the corpus for the term/enumeration you are changing; amend or list as out of scope" to the docs-mode
   Implementer rules and to the Architect's implementation-notes checklist.

## Verdict
**CHANGES_REQUESTED** — one blocking item (seven stale two-type sentences across the three documents this diff
amends); the new section, the derived-relationship text, the policy-layer standing, the 39998 scoping, the intake
entry, and every pointer are otherwise accurate and ADR-conformant, and every non-blocking note is optional.

## Close-out
- Story `**Status:**` not flipped and the story's "Review:" line not filled — both happen on the re-review that
  passes. No spec, BIBLE, README, handoff, worksheet, intake, source, or test file was edited by the Reviewer.
- Completion detection deferred to the passing round. For the record: book `dlist-curation`, frame bullets 1–2
  (story 1) and 4 (story 2) are met; bullet 6 (the facet) would be met by this story; bullets 3, 5, 7 stay open
  (stories 5, 4, 6); bullet 8 holds so far; bullet 9 is the operator's call (story 7). The book is not complete.

## Round 2 (2026-09-10)

**Reviewer:** Claude (acting as Reviewer) — re-review of the round-1 fixes. Round 1 above is kept intact; this
section supersedes its verdict.
**Diff:** `git diff f7d07e67..HEAD` — one commit, `3b493213`, markdown-only (`BIBLE.md`,
`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`, `engineering-team/epics/dlist-curation.md`, the story,
`protocols/drafts/inherit-from.md`, `protocols/drafts/shared-concepts.md`, `protocols/worksheet.md`; 35 insertions,
22 deletions). Line numbers below are post-fix: the NB-6 insert at `inherit-from.md:112` shifts everything under it
by two (round 1's `:126` is now `:128`, `:118` → `:120`, `:132` → `:134`).

### Quality gates (re-run by the reviewer on HEAD `3b493213`, not trusted)
- [x] `bash scripts/harness-lint.sh` — **clean (0 violations)**; only the pre-existing waivers/INFO print. L9 holds
      without a second header bump: `BIBLE.md:8` says 2026-09-10 and the last commit touching BIBLE.md is
      `3b493213` (2026-09-10) → 0 days.
- [x] The nine doc-reading suites, each via `node -e "require('./test/<f>.test.js').run()"` (node v24.18.0):
      `tag-applicability` 19/0 · `event-tagging-spec` 5/0 · `open-ranking-stats` 29/0 ·
      `treasure-maps-router-preset` 5/0 · `b-tag-primitive` 16/0 · `b-coverage-audit-and-disposition` 26/0 ·
      `task-queue-semaphore-protection-audit` 6/0 · `scheduled-search-and-house-scores-refresh` 12/0 ·
      `harness-lint` 41/0. All green — the same counts as round 1.
- [x] Links on the fix diff's added lines, resolved mechanically (scratchpad script, same method as round 1):
      **10 links, 10 resolve; no anchors on these lines.** New this round: `inherit-from.md:112` →
      `../nips/decentralized-lists.md` (exists) and `shared-concepts.md:35` → `./stamping.md` (exists); the other
      eight are pre-existing links re-emitted on re-touched lines.
- [x] `git diff --check f7d07e67..HEAD` clean; no 64-hex literal on any added line; no `src/`, `ui/`, or `test/`
      change.
- [ ] Full `npm test` — not run, same reasoning as round 1 (markdown-only diff; OPEN.md row 191).

### Disposition of round-1 findings
| Round-1 item | Disposition | Evidence (new wording quoted from HEAD) |
|---|---|---|
| Blocking 1 — `inherit-from.md:12` | **Fixed.** | "The `b` tag carries one of three **types**: `"pointer"` (correspondence …), `"inherit"` (definitional deference …), and `"inherit-items"` (item inheritance — "my list's items are this parent's, plus my own"). Only `"inherit"`-typed tags participate in definition resolution; only `"inherit-items"`-typed tags in item resolution." — the asked change; agrees with `:26` and `:120`. |
| Blocking 1 — `inherit-from.md:60` | **Fixed.** | "*reach*, the closure over every `b` type" — agrees with `shared-concepts.md:68` and Decision §6. |
| Blocking 1 — `inherit-from.md:128` (was `:126`) | **Fixed.** | "a relay-side `#b` filter returns every type; aggregators fetch, then filter by type locally." |
| Blocking 1 — `shared-concepts.md:53` | **Fixed.** | "but the types feed **different questions**:" — the lead-in now matches the three-type bullets under it (`:55–56`). |
| Blocking 1 — `shared-concepts.md:58` | **Fixed.** | "the `#b` filter returns every type; consumers filter locally". |
| Blocking 1 — `shared-concepts.md:70` | **Fixed.** | "through `b` edges of *every* type, followed transitively" — reach is now defined one way (table row `:68` and prose `:70` agree). |
| Blocking 1 — `BIBLE.md:1635` | **Fixed.** | "discovery walks include every type (ADR 0029, extended by `dlist-curation` ADR 0003)". |
| NB-1 — `inherit-from.md:16` | **Applied.** | "correspondence (`"pointer"`), definitional deference (`"inherit"`), or item inheritance (`"inherit-items"`)". |
| NB-2 — `inherit-from.md:4` | **Applied.** | "The `inherit-items` type (`dlist-curation` ADR 0003) derives the pointer form until the derivation is updated, and no item-set resolver exists (intake entry 2026-09-10)." True against `src/api/neo4j/eventSync.js:271` (`tag[2] === 'inherit'`; the else-branch derives `REFERENCES {source:'b-tag'}`), re-read this round; the same claim as BIBLE `:1630`. |
| NB-3 — `shared-concepts.md:103` | **Applied.** | "absent, pointer, or `inherit-items` types carry zero weight (v1)" — agrees with `:55`. |
| NB-4 — BIBLE §22 `:1567`; worksheet W1 `:19` | **Applied.** | BIBLE: "discovery walks (enumerating correspondents, not deferrers) include every type (`dlist-curation` ADR 0003 added `inherit-items`)"; worksheet: "discovery walks include every type (`inherit-items` too — `dlist-curation` ADR 0003)". |
| NB-5 — stamping standing by name | **Applied; consistent with Stamping's tiers and the ADR.** | `shared-concepts.md:35`: "Inherit-family tags anchor no stamps (the affiliation-anchored tier of [Stamping](./stamping.md) is pointer-only); an `inherit-items` target is reachable, and so at most a demand-selected extra." Checked against `stamping.md:23` (tier 2 is "affiliation-anchored … reached via the author's own pointer-`b`" — pointer-only, so "anchor no stamps" is exact), `:25` (tier 3, "demand-selected extras … within the author's **reach**", author-selected, SHOULD-level) and `shared-concepts.md:74` ("Reach is permission-shaped, never action-shaped"). "At most a demand-selected extra" is a correct upper bound and says what ADR Decision §6's "does not select stamp targets" says: the tag enables reach; the author selects. Handoff D10 `:164` softened from "does not stamp" to "anchors no stamps (reachable, so at most a demand-selected extra)" — the two surfaces agree. |
| NB-6 — `own_items(node)` undefined | **Applied; adds no rule the ADR did not decide.** | `inherit-from.md:112`: the kind-39998 case is a definition by reference to an already-normative binding — `protocols/nips/decentralized-lists.md:43` (an item's `z` is `39998:<header author>:<d-tag>` of its parent header); the kind-39999 case is left "**not yet formalized**", mirroring the definition walk's payload-binding note `:85`, with the resolver follow-up named as the settling place. Reading "own items" as the header's `#z` index (any author) is what `shared-concepts.md:56` and ADR Decision §4 ("the item author's trust") already assume. Nothing normative added. |
| NB-7 — story Deviations miscount | **Corrected; now accurate.** | Story `:105–109`: "One sentence beyond the ADR's edit list, plus one companion edit" — the Direction paragraph (`inherit-from.md:52`, "for every type") and the family-table lead-in (`:134`, "Its three types span three rows of the family") — exactly round 1's row 17. The new "Review round 1 fixes" bullet (`:110–117`) lists the seven lines and the folded NB items correctly against the diff (verified line by line in this table). |
| NB-8 — epic stale form | **Applied.** | Epic `:85` "closed at two values at kickoff, three since ADR 0003"; `:90` "ADR 0003 chose a **distinct relationship `INHERITS_ITEMS_FROM`** over the kickoff lean toward a property on INHERITS_FROM, so a bare `INHERITS_FROM` match keeps meaning definition deference." Story 4's Implementer no longer reads the superseded form. |
| NB-9 — ADR `:223` draft-relative link | **Left, as classified (cosmetic).** | ADR untouched this round; `engineering-team/decisions/dlist-curation/inherit-from.md` does not exist; the quoted text resolves where it lives (`assistant-designation.md:71`). |
| NB-10 — story-4 caution | **Applied.** | Epic `:39–42`: keep the assistant header off every `buildImportCypher` lane (`/api/neo4j/event-update`, the `io.js` import, `pullClassThread`, firmware install) — the four lanes round 1's claims row 10 enumerated. |
| Harness friction 1 — docs-mode has no consistency-sweep step | **Not yet filed; pending at the review commit.** | No OPEN.md change at HEAD (outside the Implementer's and the Reviewer's write scope). The story's Deviations `:116–117` says it "is a ledger row at the review commit" — the session lead's row, added with this review's commit. |

### Corpus sweep for stale enumerations (run by the reviewer)
`/usr/bin/grep -rniE` for `two types`, `both types`, `either type`, `two-value`, `two values`, `two \`b\` types`,
`both \`b\` types`, `either \`b\` type` over all of `protocols/` (every draft — `inherit-from`, `shared-concepts`,
`assistant-designation`, `communities`, `stamping`, `tapestry-concepts`, `tags`, … — plus `nips/`, `README.md`,
`worksheet.md`), `BIBLE.md`, the handoff, and the epic/story/ADR; then a second pass for the named-pair form
(`pointer … inherit` with no count) and a third for `both`/`either` within 40 characters of `type(s)`:
- **`inherit-from.md`, `shared-concepts.md`, `assistant-designation.md`, and BIBLE §25 (all of BIBLE): zero hits.**
  No "two types", "both types", "either type", or "two-value" survives. The only "both" left in `inherit-from.md`
  is `:52` ("deference and correspondence both read naturally child→target") — two verbs, in the sentence that
  says "for every type"; not an enumeration.
- **Every other `protocols/` file: zero hits.** `communities.md` (`:18`, `:19`, `:30`, `:33`, `:47`, `:50`, `:56`,
  `:104`) speaks only of what `inherit` does and never sizes the registry — round 1's row 6 stands (unchanged
  since `7fccbf25`). `tapestry-concepts.md` and `tags.md` name no `b` type at all. Worksheet W1 `:19` is fixed
  (NB-4); W6 `:59`/`:63` were already three-value.
- **Named-pair form: one hit** — `protocols/drafts/stamping.md:49`, "walk the correspondence graph (pointer- and
  inherit-typed `b`, [Shared Concepts] § Aggregated deference)". New NB-1 below.
- **Historical, outside the diff:** `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:49`, `:75`, `:84`, `:92` — all inside
  D1–D3 (dated 2026-06-12, still in the pre-ADR-0029 vocabulary `"reference"`/`"inherit"`); ledger entries
  superseded in the same document by D10 (`:158–167`). New NB-2 below.
- **`engineering-team/` hits are all before-state descriptions:** story `:10` (Background), ADR `:20`/`:38`/`:193`
  (Context; the edit list's "→ three-value"), epic `:85` ("at kickoff, three since ADR 0003"). Correct as written.

### Round-2 walk of the fix diff — new findings
**Blocking: none.**

Non-blocking (none is an ask on this story):
1. **`protocols/drafts/stamping.md:49`** — the read-contract gloss "the correspondence graph (pointer- and
   inherit-typed `b`, …)" under-enumerates now that discovery walks include every type (`shared-concepts.md:56`,
   the very section it points to). Same class as round 1's NB-1 — a non-exhaustive list deferring to a correct
   definition — in a document this story did not amend and its ADR did not list. Optional, when `stamping.md` is
   next touched: "(`b` of every type — [Shared Concepts] § Aggregated deference)".
2. **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:49/:75/:84/:92`** — D1–D3's "both `b` types count for direct
   affiliation", "two-value registry", "Why two types", "both-types inclusion" are dated June-2026 decisions in
   `"reference"` vocabulary that D10 supersedes in-document; the file's own header says "nothing ratified yet".
   Pre-existing (review #2's NB-7 recorded the same handoff drift at `:153`); rewriting them would falsify the
   record. Leave as history, or add a one-line "superseded by ADR 0029 / D10" pointer at D2's head when the
   handoff is next touched.
3. **Pre-existing polysemy, not introduced here — "affiliation" carries two senses in ratified text.**
   `inherit-from.md:58` ("**Affiliation rides the closure** … a deliberate, documented consequence of declaring
   `"inherit"`") and BIBLE `:1633` ("Affiliation = membership in the inherit-only deference closure", ADR 0029)
   use the Communities sense — participant affiliation, inherit-typed, transitive; `shared-concepts.md:35`
   (including the clause this round added) and the reach table `:66` use the `w14-settlement` three-term split
   (worksheet `:144`: *affiliation* = one declared pointer hop). ADR 0003 mirrors the latter (Context: "an
   inherit-typed tag has never implied affiliation") while its Decision §5 acknowledges the former
   ("affiliation-via-closure … unchanged"). Each document is internally consistent, `shared-concepts.md` scopes the
   term under its own "Declared affiliation" heading, and this story's AC-4 leaves affiliation semantics
   unchanged — so it is not this diff's to settle. But the corpus says two things under one word, and the
   sentence added this round makes that more visible. Candidate for a worksheet entry or an intake line (name the
   Communities sense "community affiliation" in `inherit-from.md:58` / BIBLE `:1633`, or the reverse). Not
   blocking.
4. **Cosmetic.** `engineering-team/epics/dlist-curation.md:27–32` still marks stories 2 and 3 "*(planned)*" (story
   2 has been Done since `bf5846ba`); the epic's story list is not per-story bookkeeping (5-review.md updates the
   epic at close-out), so this is a note for whoever next edits the epic, not an ask. The re-touched epic lines
   `:85`/`:90` run past the file's wrap width — style only.

Everything else in the fix diff is a plain-text replacement on the lines round 1 named. No scope creep: the epic
edits are the NB-8/NB-10 carry-forwards the story's Deviations discloses; no code, no dependencies, no `test/`
change.

### Verdict (round 2)
**PASS** — all seven blocking sentences are fixed and verified line by line; no "two types" / "both types" /
"either type" phrasing survives in `inherit-from.md`, `shared-concepts.md`, `assistant-designation.md`, or BIBLE;
every non-blocking note is applied (NB-1–6, NB-8, NB-10), corrected (NB-7), or correctly left (NB-9); all gates
green with round 1's counts; the four new observations are non-blocking and, bar the `stamping.md` gloss,
pre-existing.

### On PASS (round 2, same commit)
- [x] Story `**Status:**` flipped to `Done` in place (`stories/dlist-curation/3-inherit-items-facet.md:3`); the
      story's `Review:` line filled with this file's path (`:126`). No spec, BIBLE, README, handoff, worksheet,
      intake, epic, source, or test file edited by the Reviewer.
- [x] Completion detection performed against `audits/dlist-curation/book.md` — the book is not complete (frame
      bullets 3, 5, 7 open; 9 is the operator's call); the arithmetic is reported in the chat, not here. No
      `/close-book` offer.
- [ ] Harness friction 1 → OPEN.md `meta` row: the session lead's, with this review's commit.
