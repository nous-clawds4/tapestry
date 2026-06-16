# Build Audit: protocols-directory — the protocols/ home and the seven-spec migration

**Book:** `engineering-team/audits/protocols-directory/book.md`
**Date:** 2026-06-10
**Branch / commit range:** `e08d4fcb..a3d2b06c` (staging → main, PRs #259/#261/#264/#266/#269/#271/#273; promotions #260/#262/#265/#267/#270/#272/#274)
**Provenance:** Acceptance-frame (eager — the design handoff predates story 1; see `book.md`)
**Confidence:** high

## 1. What shipped

- A repo-root **`protocols/` directory** — index with boundary rule + five-step status ladder, and a self-contained worksheet of open protocol problems (W1–W7 at birth) — `stories/protocols-directory/1-scaffold-protocols-directory.md`
- The **Decentralized Lists base NIP reconciled** (newer local draft adopted; superseded embedded compat section removed; publication-ready with an explicit republish-delta header) plus the **Cross-NIP Compatibility companion** as a publish-ready pre-NIP — `2-decentralized-lists-reconciliation.md`
- **Tapestry Concepts** pre-NIP (kinds, addressing, `z`, kind unification, `json`-tag storage, word-wrapper, 8-core-node scheme, `concept-graph` resolution contract) extracted from BIBLE §5/§8/§9, which became pointer + implementation; the Protocol-Spec workflow charter amended (ratified specs land in `protocols/`) — `3-tapestry-concepts-extraction.md`
- **Class-Thread Membership Tags (`n`,`s`)** pre-NIP with deployment-neutral security considerations (authorship gate / no cross-graph derivation / class-thread-only), extracted from BIBLE §23 — `4-class-thread-tags-extraction.md`
- **Inherit-From & Resolved Definition (`b`)** pre-NIP — wire format, no-flip derived relationship, the full resolution algorithm with pseudocode, trust-coupling — extracted from BIBLE §25/§26 — `5-inherit-from-extraction.md`
- **Communities** pre-NIP — first synthesis: ratified the settled design (no-privileged-center, community-as-concept, membership-from-tags, records coexistence layer, NIP-22/25 layouts, foothold) across four source families with five disagreement findings surfaced — `6-communities-spec.md`
- **Tags & Taggings** pre-NIP — tag definitions, the reconciled a-primary assertion shape with the honest deployed-variant note, polarity, pins/unpinning, the owner-ratified taggings-family direction with planned event-tagging — `7-tags-spec.md`

## 2. Epics & stories rolled up

### Epic: `protocols-directory`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 scaffold-protocols-directory | protocols/ scaffold + CLAUDE.md pointer | Done | `reviews/protocols-directory/1-…` — PASS (1 kickback: W5 citation) |
| #2 decentralized-lists-reconciliation | base NIP + companion, publication-ready | Done | `…/2-…` — PASS (zero findings; machine-diff fidelity) |
| #3 tapestry-concepts-extraction | spec + BIBLE §5/§8/§9 pointers + charter amendment | Done | `…/3-…` — PASS (1 kickback: 4 definitional gaps) |
| #4 class-thread-tags-extraction | spec + BIBLE §23 pointer | Done | `…/4-…` — PASS (1 kickback: stale W5 ref) |
| #5 inherit-from-extraction | spec + BIBLE §25/§26 pointers + cross-spec repoints | Done | `…/5-…` — PASS (1 kickback: 2 definitional gaps) |
| #6 communities-spec | synthesis spec + W8/W9 + capture-doc status | Done | `…/6-…` — PASS (1 kickback: 3 one-liners) |
| #7 tags-spec | synthesis spec + W10 + marker repoints + index completion | Done | `…/7-…` — **PASS first-pass** |

ADRs: `decisions/protocols-directory/0001–0005` (stories 1–2 ran without ADRs per the type-Doc table; 3 full-by-gate-choice, 4–5 thin, 6–7 full). Per-epic ADR numbering per `engineering-team/README.md` § "Epic-scoped docs" (adopted after a 0041 mis-numbering was caught and corrected at the story-3 gate).

## 3. As-built inventory

Derived from the diff (`git diff e08d4fcb..a3d2b06c --stat`, docs-only):

- **New tree:** `protocols/README.md` (boundary rule, ladder, 7-row index — all ✅, preamble "migration complete"), `protocols/worksheet.md` (W1–W10), `protocols/nips/decentralized-lists.md` (🚀 published, update pending), `protocols/drafts/` ×6 (`decentralized-lists-compat` 🧪 publish-ready; `tapestry-concepts`, `class-thread-tags`, `inherit-from`, `communities`, `tags` 📝).
- **BIBLE.md:** §5/§8/§9/§23/§25/§26 rewritten pointer-first (≈250 lines of wire format relocated); section numbers/titles/anchors and TOC unchanged; §22 deliberately untouched (ADR 0004 Option A).
- **Process artifacts:** `engineering-team/workflows/protocol-spec-workflow.md` ratify-phase amendment; `CLAUDE.md` session-start pointer; two handoff docs status-flipped (`PROTOCOLS_DIRECTORY_…` → ✅ ADDRESSED; `COMMUNITIES_PROTOCOL_…` → design-ratified line, §7 still open); 7 stories + 5 ADRs + 7 reviews under `engineering-team/*/protocols-directory/`.
- **User-facing runtime:** none — every deploy verified no-op (Tiers 1/2/5 clean ×7 staging + ×7 production).
- **Domain:** zero concepts touched, zero firmware reinstalls. **Data & contracts:** zero wire changes — the book *documents* existing kinds (9998/9999/39998/39999; NIP-09/22/25 reuse) without altering any.

## 4. Deviations from intent

| # | Specified (anchor) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Handoff §4: `COMMUNITY_ENDORSEMENTS_DLIST.md` listed as story-6 feedstock | Recorded **superseded for membership**; not ratified | constraint-discovered | The 2026-06-05 redesign + the branch's own ADR 0030 both take the tags route (ADR 0004, finding D1) | The spec reflects current design, not stale feedstock | Conversation with Avi if his branch still builds on it |
| 2 | Handoff §4/§8: BIBLE §22 a story-6 source, pointer-first expected for any absorbed kernel | §22 untouched; spec cites the resolution model non-normatively → W1 | intentional-change | §22 marks its own model unratified; a pre-NIP must not ratify what its source declines to (ADR 0004 Option A) | None at runtime; keeps unratified machinery unratified | W1 owns the question |
| 3 | Handoff §8: plain docs-mode story plan (no ADRs mentioned) | ADRs 0001–0005 for stories 3–7; multi-agent adversarial audits for every review | added-beyond-scope (rigor) | Gate decisions (story-3 gate onward); the split tables/skeletons made reviews mechanical | Higher-fidelity specs; 5 kickbacks caught pre-merge | Pattern available for future spec work |
| 4 | Handoff §8 story 3 scope | + `protocol-spec-workflow.md` charter amendment | added-beyond-scope | Story-3 AC ("role descriptions read consistently"); the charter still targeted "BIBLE prose" | Future ratifications land in `protocols/` by default | — |
| 5 | Worksheet seeded W1–W7 | W8–W10 added | added-beyond-scope | Synthesis surfaced them (ADR 0004 D2/D5 residues; story-7 gate guidance) | Open questions tracked instead of lost | Next protocol sessions |
| 6 | Frame: migrate content | + 5 flagged mechanical typo fixes in the DLists base (invalid JSON examples), 1 deliberately-unfixed ambiguity | interpretation | Story-2 fidelity rule (fix unambiguous mechanical defects, flag each) | Publication-ready text | `<id_lists>` placeholder — author's eye before republish |
| 7 | — (not in frame) | Six specs carry explicit "not yet formalized / not yet specified" gap markers | interpretation | The epic's traceability rule: clarify only what sources support; mark the rest | Honest spec surface; gaps visible for the publication pass | Publication pass resolves them |

**Undocumented work** — diff vs. docs reconciliation: clean. Two session-level chores lack story provenance by design (flagged at the time): the git-identity re-author + commit-hash-reference fix (`fd8400af`), and the two handoff status flips (chore commits). The story-6→7 promotion train also co-promoted **PR #263 (Direction-mode harness)** — *not* this book's content; bundled into promotion #265 with the owner's explicit approval, recorded there.

## 5. Quality state at close

- **Test gate:** `npm test` → `Overall: PASS` at close (and at every phase commit throughout).
- **Known open issues:** none introduced (docs-only). Pre-existing, discovered-not-caused: BIBLE §24's nine flat-path ADR links (broken since the #236 epic-folder migration) — fixed separately by the command-wiring chip session (committed, unpushed, outside this book).
- **Debt rolled up (from ADR Consequences):** the DLists republish + companion-publish remain the author's acts; D4's deployed-variant union-read stands until Vinney's confirm + backfill; the in-spec honest gaps (wordTypes constraints; 39999-header `concept-graph` tagging; definition-fields↔payload binding; CD field/`claims` encodings); a glossary-trim candidate (story-5 review note); editorial-relationship descriptor wire formats unspecified (ADR 0001 out-of-scope).

## 6. Carry-forward register

- [ ] **NostrHub republish** of the Decentralized Lists base NIP (the author's keys; delta stated in the spec header; check the `<id_lists>` placeholder first) — then flip its status to 🚀 published.
- [ ] **Companion publication decision** (`decentralized-lists-compat`, 🧪 publish-ready).
- [ ] **D4 closure**: Vinney's one-line confirm + `a`-backfill of deployed assertions (tags spec § Taggings).
- [ ] **Three-branch reconciliation** (org decision: owner + Avi + Vinney; `COMMUNITIES_PROTOCOL_DESIGN_HANDOFF.md` §7) — gates Communities v1 membership.
- [ ] **W1 cross-deployment concept identity** — highest-leverage open problem; W8 (engine-config carriage), W9 (roster-rule reconciliation, no-veto stakes), W10 (taggings family: rename wire-impact, `nostr-event-tag`/`dlist-tag` handles — `dlist-tag` actively desired).
- [ ] **Publication pass** over the pre-NIPs: resolve the marked "not yet formalized" gaps, then ladder decisions per spec.
- [ ] Endorsements-supersession conversation with Avi (deviation #1); glossary-trim pass (debt); editorial-relationship descriptor formats (future spec story).
