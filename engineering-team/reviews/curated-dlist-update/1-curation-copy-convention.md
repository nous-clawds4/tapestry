# Review: Story 1 — The curation copy convention — how an assistant copies, points back, and removes

**Reviewer:** Claude (independent reviewer subagent)
**Date:** 2026-09-12
**Diff:** `git diff aa51380d 6a3f031a` (commit `6a3f031a`, 12 files; docs-mode — numbered form because the story is
storied; claims-adherence table per the review template's docs-mode variant. Context commits `2d76dd08` book-open,
`2167573d` story, `aa51380d` ADR 0001 — read, not under review.)

> **Ledger rows renumbered (2026-09-12):** at the merge of `origin/staging`, which had already taken rows 271–275, this story's rows became 276 (was 271), 277 (was 272), 278 (was 273) and 279 (was 274); the citations below use the new numbers.

## Quality gates (run by reviewer, not trusted)

- [x] Doc-reading regression suites — **13/13 green, 243 tests, 0 failures**, each through its exported `run()`
      (node v24.18.0; the ADR's "Regression (Reviewer)" list; OPEN.md row 276's method):
      `b-coverage-audit-and-disposition` 26/0 · `b-tag-primitive` 16/0 · `publish-time-default-stamping` 14/0 ·
      `open-ranking-stats` 29/0 · `event-tagging-spec` 5/0 · `harness-lint` 41/0 ·
      `scheduled-search-and-house-scores-refresh` 12/0 · `task-queue-semaphore-protection-audit` 6/0 ·
      `treasure-maps-router-preset` 5/0 · `kill-timeout-orphans-by-default` 9/0 ·
      `note-tagging-raw-events-inspector-ui` 32/0 · `tag-actions-menu-ui` 30/0 · `tag-read-union` 18/0.
      Matches the Implementer's 243/0.
- [x] `bash scripts/harness-lint.sh` at `6a3f031a` — `harness-lint: clean (0 violations)`; the rest of the output
      is the standing WAIVED/INFO lines. L9 holds: `BIBLE.md:8` is bumped to 2026-09-12 in the same commit that
      edits `:1079`, `:1546` and `:1630`.
- [ ] Full `npm test` — **not run, deliberately.** The diff is 12 markdown files with no `src/`, `ui/` or `test/`
      change, and the full run's live suites publish signed fixtures under this machine's external-publishing
      posture and carry known reds (OPEN.md rows 191 and 261). The 13 suites above are the ones that read the
      edited documents.
- [x] Links and anchors — every `[..](..)` on an added line resolved mechanically (scratchpad script, GitHub slug
      rule): **25 relative links, 0 broken**, plus 3 external (the NIP-85 index, NIP-18, NIP-09; the last two
      fetched). `#curation-copies` (`assistant-designation.md:96`) and `#per-dlist-curation-entries` (`:54`) exist;
      `../worksheet.md#w6--…` and `#w5--…` resolve.
- [x] Tables — all 9 added or changed table rows have their table's column count (OPEN.md rows 259/267/271: 7;
      `inherit-from.md:140`: 5; README `:57`/`:61`/`:64`: 5; BIBLE `:1546` and handoff `:198`: 2).
- [x] Fences and JSON — `assistant-designation.md` has 12 fence lines (balanced); both new `json` blocks parse
      (kind 39999 with tags `d, z, name, t, q, q`; kind 5 with `a, e, k`).
- [x] Secrets — no `nsec`, private-key text, or 64-hex literal on any added line.
- [x] Upstream texts fetched 2026-09-12 from raw.githubusercontent.com: NIP-18, NIP-09, NIP-01.
- [x] _Lint / typecheck / build not configured — skipped._ No new tooling.

## Claims-adherence table (docs-mode variant)

AC-1 … AC-9 first, then the spec-accuracy claims the brief named (S1–S13).

| # | Claim | Evidence checked | Result |
|---|---|---|---|
| AC-1 | Header links with `["b", <shared header>, "pointer"]`, a declared affiliation; the list is exactly the items filed under it by `z`; nothing inherited live; an older `inherit-items` header is upgraded in place (same target, new type), shown before signing; the no-silent-re-point MUST kept; worked example matches | `assistant-designation.md:71` (bullet), `:74` (MUST paragraph + the upgrade sentences + "Until then … means what its tag says"), `:94` (worked example `"pointer"` + the copy sentence); `shared-concepts.md:35` (pointer-typed `b` = declared affiliation) | Met |
| AC-2 | "Curation copies" defines a copy: kind 39999 by the curating assistant whatever the original's kind; one `z` = the curated header; derived `d` (a repeat replaces); published where the header is; carries `name`/`title`/`slug`/`description`/`comments` + `p`/`e`/`t`/`a`; drops `json`/`n`/`s`/`b` and the original's `d`/`z`/`q` | `:96` heading; `:100` ("Its tags are exactly …"); `:102` (carries/drops, plus `content` per ADR Option 4A); `:104` (`d`); worked copy `:116–130` carries only `d`, `z`, `name`, `t`, `q`, `q` | Met |
| AC-3 | NIP-18 `q`: the address + relay hint for 39999 originals; the version id + relay + author always; "already copied" by `q` alone; merging readers treat copy and original as one | `:106`; worked copy `:125–126`; `stamping.md:51` carries the merge rule | Met |
| AC-4 | Removal = NIP-09 by the assistant with `a`, `e`, `k`; the original is a candidate again; no rejection recorded; the edited / downvoted-or-disputed / not-found cases; the method is not the spec's | `:108`, `:110`, `:98` (the method sentence moved to the lead — logged deviation); worked deletion `:134–145` | Met |
| AC-5 | `stamping.md`: a copy carries only its list's `z`, never the source list's handles | `stamping.md:27` (after write-rule item 3, before "`z` order") | Met |
| AC-6 | One curating assistant per list across instances (one-entry-per-list rule unchanged); another instance MAY show read-only and MAY offer to replace | `assistant-designation.md:80` ("Across instances") ↔ `:78` (rule text unchanged); `done/dlist-curation/0002` §5 (first occurrence wins) | Met |
| AC-7 | `inherit-items` stays registered, unchanged; `inherit-from.md` says the reference deployment no longer emits it; a family-table row; ADR 0002 §3 and ADR 0003 "Enables story 4" say so; BIBLE `:1546`/`:1630`; handoff D11 (status unchanged); W6; README rows; the intake closing line | Registry text `inherit-from.md:26–30`, `:120` untouched; family row `:140` + italic note `:132`; ADR 0002 `:3`/`:7`, ADR 0003 `:3`/`:7`; BIBLE `:1546`, `:1630`; handoff D11 `:169–177`, status line `:3` unchanged, W6 row `:198`; worksheet `:59`/`:65`; README `:57`/`:61`/`:64`; `_intake.md:2342` | Every edit present, **but the "no emitter / no longer emits" status claims are false today — Blocking 1** |
| AC-8 | OPEN.md rows 259 and 267 DONE, pointing at ADR 0001 | `OPEN.md:315`, `:323` — Status `DONE`, Done `2026-09-12`, Pointer "Settled by `curated-dlist-update` #1 (ADR `curated-dlist-update/0001`) …"; Item cells unchanged; 7 cells each | Met |
| AC-9 | A full ADR, Accepted, recording the seven named axes | `decisions/curated-dlist-update/0001-curation-copy-convention.md` — Status Accepted; Options 1 (link type, A–D), 2 (`q` / `e`-`a` / item-level `b` / named tag), 3 (deletion / republish / both), 4 (carries and drops), 5 (`d` derivation), 7 (one assistant vs one entry per (list, assistant)), 8 (keep / withdraw the facet) | Met |
| S1 | The NIP-18 `q` form `["q", "<event-id> or <event-address>", "<relay-url>", "<pubkey-if-a-regular-event>"]` | NIP-18 `18.md:29`, verbatim. The address `q` has no 4th element (correct); the version `q` supplies the author — NIP-18 words that element "if a regular event", and supplying it for an id-quoted 39999 version stays within the form and matches NIP-01 `e`-tag practice | Accurate |
| S2 | `q` is relay-indexed; "which curated lists hold a copy" is one `#q` query | NIP-01 `01.md:84` — single-letter tags are expected to be indexed, first value only; both `q` tags put the reference in element 1 | Accurate |
| S3 | NIP-09: kind 5 with `e`/`a` tags and a `k` per kind; for `a`, relays SHOULD delete every version up to the request's `created_at` | NIP-09 `09.md:9` (e/a; SHOULD `k` per kind), `:35` (a-tag, up to `created_at`). The spec's deletion (`:108`, `:134–145`) has `a`, `e`, `k` and empty content, consistent with "no reason recorded" | Accurate |
| S4 | DList NIP item tags `p`/`e`/`t`/`a`; optional `name`/`title`/`slug`/`description`/`comments` | `protocols/nips/decentralized-lists.md:45`, `:47`, `:53` | Accurate |
| S5 | The as-built "already copied" rule would match `q` values | `ui/src/utils/treasureMap.js:557–568` — `referenced` collects every string value at position ≥1 of every tag of the assistant's items; a shared item is skipped when its id or its 39999 coordinate (`itemRouteId`, `:463–470`, `39999:<pubkey>:<d>`) is in that set. Both `q` values of a copy land in the set | True |
| S6 | "Not yet wired": the endpoint still writes `inherit-items`; nothing copies items | `src/api/dlist-curation/index.js:24` (`INHERIT_ITEMS = 'inherit-items'`), `:82` (`contractB`) — identical on origin/main `d826557b` and origin/staging `f8fe02e7`; no `q`-tag reader or writer and no `copy-` d-tag in `src/` or `ui/src`; Update list is a disabled placeholder (`ui/src/pages/grapevine/CuratedDListItems.jsx:60–61`) | True (`assistant-designation.md:173`) |
| S7 | BIBLE §25: `buildImportCypher` gates on the literal `inherit`, so an `inherit-items` tag derives the pointer form | `src/api/neo4j/eventSync.js:271` (`const isInherit = tag[2] === 'inherit';`), else-branch `:279–283` (`REFERENCES {source:'b-tag'}`) | True |
| S8 | The copy `d` is unambiguous and implementable | Computed from the spec text alone (node `crypto`): `copy-` + SHA-256 of `39998:<assistant>:dogs` + U+000A + `39999:<bob>:fido` → a 69-character `d`; the same original under a second curated list gets a distinct `d` (the "one copy in each" sentence, `:104`). One theoretical non-injectivity — Non-blocking 1 | Implementable |
| S9 | Header contract, Curation copies, Deployment status, `stamping.md` and `inherit-from.md` agree | Header contract `:71` ↔ Curation copies `:100` (one `z`) ↔ `stamping.md:27` (only that list's `z`) ↔ `stamping.md:51` (collapse by `q`) ↔ `inherit-from.md:32`/`:132`/`:140` — consistent. **`inherit-from.md:4` contradicts `assistant-designation.md:173`** | Contradiction — Blocking 1 |
| S10 | No stale claim that the curated/assistant header carries `inherit-items` | `grep -rn inherit-items` over `protocols/`, BIBLE.md, the handoff, AGENTS.md, CLAUDE.md, OPERATIONS.md, ROADMAP.md, plus a paraphrase sweep (`curat… inherit`): what remains is generic registry text (`inherit-from.md:12–120`, `shared-concepts.md:35`/`:55–56`/`:67`), dated history (`worksheet.md:63`; handoff D9 `:153`, D10 `:158–167`), or this diff's updated lines | None stale |
| S11 | OPEN.md row 276 is accurate and well-formed | 198 suites; 91 lack an `if (require.main === module)` block (strict regex); the six named suites each exit 0 with 0 bytes of output under `node test/<suite>.test.js` (`scheduled-search…`'s only `require.main` is inside an assertion string, `test/scheduled-search-and-house-scores-refresh.test.js:149`). 7 cells, `meta`, OPEN, pointer to the story's Deviations | Accurate |
| S12 | The intake closing line follows 0-intake step 1's form, and whats-open honors it | `**RESOLVED** 2026-09-12 — …` at the top of the block (`_intake.md:2342`); `workflows/0-intake.md:12`; `scripts/whats-open.sh:94` anchors `^\*\*RESOLVED` | Form correct (content — Blocking 1) |
| S13 | The two superseded-in-part annotations are accurate and in the house form | ADR 0002 §3 is the header contract whose `<type>` story 3 named `inherit-items`; ADR 0003 Consequences `:175–176` is "Enables story 4 … `inherit-items` exactly"; precedent `decisions/community-reference/0010-community-class-thread-pull.md:3` ("Accepted (mechanism superseded by ADR 0011)") and `:7` | Accurate |

## ADR adherence (Implementation notes 1–11)

| Item | File / section | As specified? |
|---|---|---|
| 1 | `assistant-designation.md` — Sources `:4`; intro `:11` (a separate sentence rather than folding the copies into "two conventions on a user's kind-10040 event": more accurate, since copies are not a 10040 convention; unlogged, harmless — Non-blocking 5); bullet `:71` = Decision §1's first sentences with the "MAY add a pointer `b`" clause dropped; upgrade sentences in the MUST paragraph `:74`; "Across instances" `:80` after Multiplicity; worked example `:94`; `### Curation copies` `:96` before "## Dual-author lookup" `:147`, Decision §§2–7 in order as bold-led paragraphs (lead paragraph + §6 split — logged), §7 one sentence pointing to Stamping, one copy and one deletion as JSON; Deployment status `:173` | Yes |
| 2 | `inherit-from.md` — status block `:4` (prescribed text; see Blocking 1); "Choosing the type" `:32`; italic note `:132`; family row `:140` after `IMPORT`, verbatim | Yes, plus the logged `:120` clause |
| 3 | `stamping.md` — "Curated copies" `:27` after item 3, before "`z` order"; query strategy `:51` appended | Yes |
| 4 | BIBLE — glossary `:1546`; §25 status sentence `:1630` (keeps the `eventSync.js` fact); § Assistant Keys `:1079` parenthetical verbatim; `Last updated` `:8` bumped with a chained note | Yes |
| 5 | Handoff — D11 `:169–177` after D10's last bullet, before `---`: four bullets + rejected options (+ one context sentence, logged); W6 row `:198`; Status line `:3` unchanged | Yes |
| 6 | Worksheet W6 — status `:59`; paragraph `:65` before **Refs** | Yes |
| 7 | README `:57`, `:61` (scope phrase + last column), `:64` | Yes |
| 8 | `done/dlist-curation/0002` — Status `:3` + note `:7` | Yes |
| 9 | `done/dlist-curation/0003` — Status `:3` + note `:7` naming "Enables story 4" | Yes |
| 10 | `_intake.md:2342` closing line | Yes |
| 11 | OPEN.md rows 259/267 | Yes |

**Outside the list:** (a) `inherit-from.md:120` "Scope (v1)" clause — logged deviation, and necessary (the sentence
otherwise names a withdrawn consumer as current); accepted. (b) OPEN.md row 276 — named in the story's Deviations and
required by OPEN.md's write discipline for harness defects; accepted. (c) The story's § Deviations — the Implementer's
log. Nothing else changed: `git diff --stat` shows exactly the 12 files, and the ADR's "Not edited" files
(`shared-concepts.md`, `communities.md`, the DList NIP, `dlist-curation` ADRs 0004–0006, the `my-curated-dlists`
records) are untouched. No code, no dependencies.

**Logged deviations judged:** the `:120` clause — accepted (above); the Shape deviation (the Curation-copies lead, §6
as two paragraphs, D11's context sentence) — accepted, it adds no normative content and every Decision §§2–7 sentence
is present; the Regression-scope note — verified (243/0; row 276 accurate).

## Concept-graph integrity
- [x] No concept, schema or property change; no handle introduced. Firmware reinstall not required (ADR
      Consequences; story § Concepts touched). The orientation handles keep `kind:pubkey:slug` form.
- [x] `/summaries` orientation — not applicable (no code).

## Things tests can't catch
- [x] No secrets, debug code, or commented-out code (markdown only; sweep above).
- [x] Markdown integrity — tables, fences and JSON verified mechanically (Quality gates).
- [x] Spoofing: "already copied" is judged only from items by the header's author (`assistant-designation.md:106`), so
      a third party cannot retire a candidate by filing a `q`-bearing item under someone's curated header; deletions
      name only the assistant's own events (NIP-09's same-pubkey rule holds).
- [x] Principles: a curated list is one point of view's published statement; the method (instance behavior) reads
      trust per point of view; no verdict is written to the wire; nothing writes or discards graph state
      (principle 4) — as the ADR's reflex checks say.
- [ ] Meaning-changing inaccuracy — the "no emitter" status claims (Blocking 1).

## House rules check
- [x] Concept Graph API authority respected (no concept claims made or changed).
- [x] No new lint / typecheck / build tooling.
- [x] No hardcoded TA pubkey (no 64-hex literal added; the examples use placeholders).

## Product-guide adherence
Not applicable — no PRD, and no user-facing copy in this diff.

## Findings

### Blocking

1. **`protocols/drafts/inherit-from.md:4`, `BIBLE.md:1630`, `BIBLE.md:1546`, `engineering-team/stories/_intake.md:2342`
   — the "no emitter" status claims are false today and contradict the spec's own Deployment status.** The four
   added sentences state as present fact that the reference deployment emits no `inherit-items` and that curated
   lists already hold curation copies:
   - `inherit-from.md:4` (the "Implementation (reference deployment)" block): "has no emitter in the reference
     deployment: curated lists link with `pointer` and hold curation copies";
   - `BIBLE.md:1630` (§25): "**Status today for the facet:** no emitter — curated lists link with `pointer` and hold
     curation copies";
   - `BIBLE.md:1546` (glossary `b tag` row): "no emitter in the reference deployment — curated lists link with
     `"pointer"` and copy items";
   - `_intake.md:2342`: "the reference deployment no longer emits `inherit-items` (curated lists link with `pointer`
     and copy items …)".

   The deployed code says otherwise. `src/api/dlist-curation/index.js:24`/`:82` compose every curation header with
   `['b', target, 'inherit-items']`, identical on origin/main `d826557b` (production) and origin/staging `f8fe02e7`,
   and nothing copies items yet (no `q` code anywhere; Update list is a disabled placeholder,
   `ui/src/pages/grapevine/CuratedDListItems.jsx:60–61`). The same diff says so correctly at
   `protocols/drafts/assistant-designation.md:173` ("the header endpoint still writes the earlier `inherit-items`
   link, and nothing copies items yet"). So the two drafts now contradict each other, and a reader of
   `inherit-from.md`'s implementation block or BIBLE §25 — a resolver author, a federating client — is told no
   `inherit-items` headers are being produced while production keeps producing them (two are already live on the
   community relay; book § Known constraints). This does not re-litigate the settled point: no emitter is the
   decision, and it takes effect with story 2. The wording comes from ADR 0001 (Decision §9; Implementation notes 2,
   4 and 10) and AC-7, while the ADR's own note 1 has the right timing ("the endpoint still writes `inherit-items`
   until story 2").
   **Asked change:** make the four sentences true at this commit and consistent with `assistant-designation.md:173`
   — for example "has no emitter once `curated-dlist-update` story 2 ships (curated lists then link with `pointer`
   and hold curation copies — ADR 0001); until then the header endpoint still writes it". Carry the same qualifier
   into the restatements that repeat it as present fact: the `Last updated` note (`BIBLE.md:8`), the ADR 0003
   annotation (`engineering-team/decisions/done/dlist-curation/0003-inherit-items-facet.md:7`, "with no emitter"), and
   handoff D11 (`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:173`, which may keep its wording if it reads as the ratified
   decision rather than the current state). The new text departs from the ADR's prescribed wording, so record it —
   an ADR 0001 amendment to Implementation notes 2/4/10 (Architect) or a logged deviation (Implementer), whichever
   route the orchestrator picks. Story 2 then drops the qualifier alongside `assistant-designation.md:173`.

### Non-blocking

1. **`protocols/drafts/assistant-designation.md:104`** — the U+000A separator is not injective when a d-tag contains
   a line feed: header d `x` with original `39999:<bob>:y⏎39999:<bob>:z`, and header d `x⏎39999:<bob>:y` with
   original `39999:<bob>:z`, give the same digest input (constructed in the scratchpad check). Both d-tags are chosen
   by other authors (the curated header's `d` is the community header's, verbatim), so the effect — one copy
   overwriting another under the same assistant — needs two crafted d-tags and is pathological. Optional: a sentence
   that an assistant SHOULD NOT copy into or from lists whose d-tags contain U+000A, or a length-prefixed encoding if
   the draft is ever revised.
2. **`protocols/drafts/assistant-designation.md:110`** — "When the original is edited … refresh it at the same
   address" holds only for kind-39999 originals. The settled decision limits the address form (and so a `d` that
   survives an edit) to 39999, so an edited addressable original of another kind (a nonstandard DList item such as
   kind 30023) gets a new id, a new `d` and a second copy. Moot for the reference deployment, which reads only kinds
   9999/39999 (`ui/src/utils/treasureMap.js:456`); this is a scope note, not a challenge to the settled point.
   Optional: scope the "edited" sentence to kind-39999 originals.
3. **`protocols/drafts/inherit-from.md:32`** — "Only some of their items, by your own choice? Carry `"pointer"` and
   copy the items you choose" offers every author a convention the spec defines only for an empowered assistant
   ("authored by the curating assistant — the pubkey the Map entry names", `assistant-designation.md:100`; ADR
   Option 6B defers a hand-copying consumer). ADR-prescribed text. Optional: "…the way an empowered assistant does
   (§ "Curation copies")".
4. **`BIBLE.md:1079`** — § Assistant Keys now calls the curated header `"pointer"`-typed and, in the same paragraph,
   says per-DList entries are wired via `POST /api/dlist-curation/header`; nothing tells the reader that endpoint
   still writes `inherit-items` until story 2. Accurate as a description of the draft, easy to misread as the
   endpoint's behavior. Optional; it fits Blocking 1's fix.
5. **`protocols/drafts/assistant-designation.md:11`** — ADR note 1 asked that the sentence naming the two conventions
   also name the curation copies; the Implementer added a separate sentence. Better (folding copies into "two
   conventions on a user's kind-10040 event" would be wrong), but not listed in § Deviations. No action.
6. **`protocols/drafts/assistant-designation.md:98`** — ADR 0001's Consequences reserve `copy-` d-tags under an
   assistant's key as this convention's namespace; the spec does not say so, and the instance TA — the owner's
   curating assistant — authors many other kind-39999 events. Optional: one clause in "Its `d`".
7. **`protocols/drafts/assistant-designation.md:56`** *(pre-existing, not this diff)* — cites
   `engineering-team/decisions/dlist-curation/0002-per-dlist-map-entry-convention.md`, which moved to
   `decisions/done/dlist-curation/` when that epic retired. The new citation at `:98` and the two ADR annotations
   (`done/dlist-curation/0002…:7`, `0003…:7`) will break the same way when this epic retires. Harness friction 2.
8. **`engineering-team/epics/curated-dlist-update.md:70`** *(not this diff)* — "## Decisions … none yet" while ADR
   0001 has been Accepted since `aa51380d`; a recurrence of OPEN.md row 234.

### Harness friction *(each becomes an OPEN.md row, type `meta`; the next free row is 272)*

1. **An ADR prescribed present-tense deployment status for a state only a later story creates** — while its own note
   1 had the correct timing. The story's AC-7 ("says the reference deployment no longer emits it"), ADR 0001's
   Implementation notes 2/4/10, and the Implementer's consistency sweep all carried "no emitter" / "no longer emits"
   into a multi-story epic whose story 2 is the one that stops the emitter: nothing asks whether each "status today",
   "implementation" or "no longer" sentence is true at *this* story's merge. Candidate fix: one line in the
   Architect's docs-mode guidance (and the ADR template's Implementation-notes section) — in a multi-story epic, a
   status sentence prescribed for a docs-mode story must be true at that story's commit or carry "until story N".
   Same family as row 240 (no consistency-sweep step in docs-mode). Proposed row 277.
2. **Epic retirement breaks full-path ADR citations made from outside the epic's folder.** Workflow 5's "Epic
   close-out" moves `decisions/<epic>/` under `done/` and notes only that paths *inside* the folder stay intact;
   protocol drafts, other epics' ADRs and supersession notes cite the full path. Live instance:
   `protocols/drafts/assistant-designation.md:56`. This story adds three more that break at this epic's close
   (`assistant-designation.md:98` and the ADR 0002/0003 annotations at `:7`). Candidate fix: cite ADRs in the
   `<epic>/<nnnn>` short form outside `engineering-team/` (OPEN.md already does), or add a close-out step that greps
   for `decisions/<epic-slug>/` outside the folder and rewrites it to `done/`. Proposed row 278.
3. **The review template's docs-mode note conflicts with 0-intake §3 for storied docs-mode reviews.**
   `templates/review-checklist.md` says the docs-mode / doc-lane variant has "no ACs" and files under "the
   non-numbered form (0-intake §3)"; 0-intake §3 reserves the non-numbered form for *doc-lane* reviews with no story,
   and a storied docs-mode review has ACs and must be numbered for L4 (this review, and
   `reviews/done/dlist-curation/3-inherit-items-facet.md`, which had to say "numbered form because the story is
   storied"). Candidate fix: split the note — doc-lane (no story) → non-numbered, no ACs; storied docs-mode →
   numbered, claims table plus the ACs. Related: row 16 (second cause), whose fix added the note. Proposed row 279 (or fold into 277's harness edit).
4. Corroborations, no new row: row 234 (Non-blocking 8); row 276 verified exactly (S11).

## Story bookkeeping
The story's `Review:` line now carries this file's path; its `**Status:**` stays `Approved`, because the verdict is
not a pass. The Reviewer edited nothing else — no fixes. Completion detection does not apply (four stories remain in
the book).

## Verdict
**CHANGES_REQUESTED** — one blocking item: four false present-tense "no emitter" claims that contradict
`assistant-designation.md:173`. Everything else checks out: AC-1…AC-9; the new spec text against NIP-18, NIP-09,
NIP-01 and the DList NIP; links, tables, JSON; the ledger, intake and annotation edits; and the 13-suite regression
(243/0).

## Round 2

**Date:** 2026-09-12
**Diff:** `git diff 9378eca7 3a7fba43` — `ae0d2c7f` (ADR 0001 Amendment 1) and `3a7fba43` (the Implementer, applying it).
Round 1's text above is unchanged (`git log` on this file shows `9378eca7` only). Context, not under review: `9378eca7`
also added OPEN.md rows 277–279 (round 1's harness friction) and the epic's `## Decisions` entry (round 1 NB 8).

### Quality gates (re-run by the reviewer)
- [x] Doc-reading regression suites — 13/13 green, **243 tests, 0 failures**, each through its exported `run()` (node
      v24.18.0); per-suite counts identical to round 1: 26 · 16 · 14 · 29 · 5 · 41 · 12 · 6 · 5 · 9 · 32 · 30 · 18.
- [x] `bash scripts/harness-lint.sh` at `3a7fba43` — `harness-lint: clean (0 violations)` (L9 included).
- [ ] Full `npm test` — not run, same reason as round 1: nothing under `src/`, `ui/` or `test/` has changed since
      `6a3f031a` (`git diff --name-only 6a3f031a HEAD -- src ui test` is empty), and rows 191 and 261 still apply.
- [x] Links, tables, fences, JSON over the round-2 range (round 1's checker, parameterized): 4 relative links on added
      lines, 0 broken; both changed table rows (BIBLE `:1546`, OPEN.md `:315`) keep their column counts;
      `assistant-designation.md` fences balanced and both JSON blocks parse.
- [x] `git diff --check 9378eca7 3a7fba43` clean; no `nsec`, private-key text or 64-hex literal on any added line.

### Blocking 1 — resolved
Every sentence round 1 named now times the change to story 2 and says the endpoint still writes `inherit-items` until
then. Checked against `src/api/dlist-curation/index.js:24`/`:82` at `3a7fba43` (still `inherit-items`) and
`src/api/neo4j/eventSync.js:271`:

| Location | Now reads (substance) | True at `3a7fba43`? |
|---|---|---|
| `protocols/drafts/inherit-from.md:4` | "loses its emitter in the reference deployment with `curated-dlist-update` story 2 … until then the header endpoint (`src/api/dlist-curation/index.js`) still writes it"; "would still derive" became "derives the pointer form (the derivation gates on the literal `inherit`)" | Yes |
| `BIBLE.md:1630` (§25) | "Status today for the facet: the header endpoint (`POST /api/dlist-curation/header`) still writes it until `curated-dlist-update` story 2; from then on …, and the facet has no emitter" | Yes |
| `BIBLE.md:1546` (glossary) | "stops emitting it with `curated-dlist-update` story 2 … until then its header endpoint still writes it" | Yes (citation nit: NB 2 below) |
| `engineering-team/stories/_intake.md:2342` | "ADR 0001 moves curated lists to `pointer` headers and copied items, and the header endpoint stops writing `inherit-items` in that book's story 2"; the `**RESOLVED**` marker form is unchanged | Yes |
| `BIBLE.md:8` (`Last updated`) | "… `"inherit-items"` stays registered, and the header endpoint stops emitting it with curated-dlist-update story 2" | Yes |
| `BIBLE.md:1079` (§ Assistant Keys; round 1 NB 4) | the status sentence ends "that endpoint still writes the earlier `inherit-items` link until `curated-dlist-update` story 2, and nothing copies items yet" | Yes |
| `engineering-team/decisions/done/dlist-curation/0003-inherit-items-facet.md:7` | "the spec's curated header links with `"pointer"` and holds curation copies; the facet itself stands, and the header endpoint stops emitting it in `curated-dlist-update` story 2" | Yes |
| `docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md:173` (D11) | "`"inherit-items"` stays registered; the reference deployment stops emitting it with `curated-dlist-update` story 2" | Yes |
| `OPEN.md:315` (row 259), `engineering-team/epics/curated-dlist-update.md:54–55` | the same qualifier — beyond the Amendment's list, logged | Yes |

A fresh sweep (`no emitter|no longer emit|stops emitting|hold(s) … copies|copy items|moved to copying|withdrew|still
writes`) over `protocols/`, BIBLE, AGENTS.md, the handoff, the intake, `decisions/done/dlist-curation/`, the epic, the
book and OPEN.md finds no sentence stating as present fact that the deployment no longer emits `inherit-items` or that
curated lists already hold copies. What remains is the timed wording above, or spec-level text about the protocol's
consumer — worksheet W6 (`:59`, `:65`), the handoff's W6 row (`:198`), `inherit-from.md:120` — which says what the spec
now prescribes, not what the deployment does. `assistant-designation.md:173` (Deployment status) is unchanged and
agrees with all of it.

### Amendment 1 and its application
- **Sound.** No decision changes. Item 1 re-times Decision §9 and notes 2/4/10 (and the note-4/5/9 restatements) to
  "stops emitting with story 2; until then the endpoint still writes it", and its reading of AC-7 — ratified now,
  effective in story 2 — is reasonable. Items 2–5 are the operator's pick of round 1's NB 2, 3, 4 and 6; NB 1 is
  declined with a reason, which is the operator's call on a non-blocking, pathological case.
- **Applied as written.** Item 2 → `assistant-designation.md:110` (the "edited" case scoped to kind-39999 originals;
  the other-kind sentence matches the Amendment and agrees with "already copied" at `:106`, which matches other kinds
  by event id). Item 3 → `inherit-from.md:32`, verbatim. Item 4 → `BIBLE.md:1079`. Item 5 → `assistant-designation.md:104`
  ("An assistant's kind-`39999` d-tags that begin with `copy-` are reserved for curation copies"). Item 1 → the table
  above.
- **Nothing else changed** beyond the story's § Deviations Round-2 entry, which is accurate: `3a7fba43` touches exactly
  the nine files it accounts for, the story included. The two edits beyond the Amendment's list — OPEN.md row 259's
  note and the epic's "Settled at kickoff" bullet — carry the same claim, keep the operator's decision intact (they now
  say when it takes effect), and are logged; accepted. `assistant-designation.md:173` and every other round-1 file are
  untouched.

### New findings (round 2)

#### Blocking
None.

#### Non-blocking
1. **The timed qualifier dates the copies to story 2; they arrive with story 5.** `protocols/drafts/inherit-from.md:4`
   ("with `curated-dlist-update` story 2 — curated lists then link with `pointer` and hold curation copies"),
   `BIBLE.md:1630` ("from then on curated lists link with `pointer` and hold curation copies") and `BIBLE.md:1546`
   ("then link with `"pointer"` and copy items") follow the wording ADR 0001 Amendment 1 item 1 prescribes — although
   the Amendment's own "Why" says nothing copies items until story 5. The sentences are future-tense, so nothing is
   false at this commit. But the Amendment also says "Story 2 drops the qualifier when it ships"; dropped wholesale,
   these sentences would state copies as present fact from story 2 until story 5 lands. For story 2's Architect and
   Reviewer: when the qualifier goes, keep "hold curation copies" tied to story 5, or phrase it as the model ("their
   items are curation copies").
2. **`BIBLE.md:1546`** — the glossary row's citation shrank from "`curated-dlist-update` ADR 0001" to a bare
   "(ADR 0001)". In BIBLE a bare ADR number reads as the old community-reference series (the same row cites a bare
   "ADR 0027"), and `:1843` cites a different epic's ADR 0001. Optional: restore the epic qualifier.

#### Harness friction (round 2)
- No new row. Non-blocking 1 is a live instance of row 277's class (status wording true only after a later story),
  moved one story out — worth a note on row 277 itself so story 2's cycle picks it up.

### Story bookkeeping (round 2)
- The story's `Status:` line is set to `Done` in place (`stories/curated-dlist-update/1-curation-copy-convention.md:3`);
  its `Review:` line already carries this file's path. No verdict words are written into the story (L14). The Reviewer
  edited nothing else.
- Completion detection performed against `audits/curated-dlist-update/book.md`; the result is reported in the chat, not
  here.

### Verdict (round 2)
**PASS** — Blocking 1 is resolved at every location, and the corrected wording agrees with `assistant-designation.md:173`
and with `src/api/dlist-curation/index.js` as it stands today. Amendment 1 is sound, its items 2–5 are applied as
written, and the two extra edits are logged. Regression: 13/13 suites, 243/0; harness-lint clean. Two non-blocking
notes, both for story 2.
