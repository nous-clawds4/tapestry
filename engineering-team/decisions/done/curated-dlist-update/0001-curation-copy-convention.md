# ADR 0001: The curation copy convention — a `pointer` header, `q`-linked copies, removal by NIP-09

**Status:** Accepted
**Date:** 2026-09-12
**Story:** `engineering-team/stories/done/curated-dlist-update/1-curation-copy-convention.md`
**Supersedes in part:** `dlist-curation` ADR 0002 §3 (the curated header's `b` type) and ADR 0003's
consequence "Enables story 4" (the facet's consumer) — Decision §9.

## Context

A docs-mode story (Test Design skipped, per `workflows/protocol-spec-workflow.md`). The acceptance
criteria, in short:
- **AC-1** the curated header links with `["b", <shared header>, "pointer"]`; its list is exactly the
  items filed under it; an older `inherit-items` header is upgraded in place, visibly;
- **AC-2** a "Curation copies" part defines a copy: kind 39999 by the curating assistant, one `z`, a
  derived `d`, published with the header; it carries `name`/`title`/`slug`/`description`/`comments`
  and the item tags, and drops `json`/`n`/`s`/`b` and the original's `d`/`z`/`q`;
- **AC-3** `q` back-references (the address for 39999 originals, the version's id always); "already
  copied" by `q` alone; merging readers treat a copy and its original as one item;
- **AC-4** removal by NIP-09 (`a`, `e`, `k`); no rejection recorded; the edited / downvoted /
  not-found cases; the method is not the spec's;
- **AC-5** `stamping.md`: a copy is never stamped with the source list's handles;
- **AC-6** one curating assistant per list across instances; another instance MAY show it read-only
  and MAY offer to replace the entry;
- **AC-7** `inherit-items` stays registered with no emitter; a family-table row; the superseded
  decisions say so; the BIBLE, handoff, W6, README and intake pointers follow;
- **AC-8** OPEN.md rows 259 and 267 flip to DONE;
- **AC-9** this ADR.

The settled points are the operator's, from `/discuss` on 2026-09-11 (epic § "Settled at kickoff").
This ADR records their options and decides the four points the story reserved: the copy's `d`
(§5 below), where the copy rules live (§6), how the earlier decisions record the change (§9), and the
family-table row (§10).

**What the specs say today.**
- `protocols/drafts/assistant-designation.md` § "Per-DList curation entries" (`:54–92`): the header
  "carries `["b", "<community header a-tag>", "inherit-items"]` … the header's list is the community
  list's items plus the assistant's own" (`:71`); a writer MAY add a `pointer` `b` for affiliation;
  a writer MUST NOT re-point an existing header's `b` silently. The Map entry's relay element already
  reads "a relay where the assistant-authored header **and its items** can be fetched" — the section
  already covers the curated list's items, which no rule governs yet.
- `protocols/drafts/inherit-from.md` registers `inherit-items` (live, additive; removal and replacement
  undefined — worksheet W6); its status block (`:4`) says an `inherit-items` tag derives the pointer
  form and no item-set resolver exists. The editorial-relationship table (`:130–145`) names `IMPORT`
  "for contrast only": absorb the parent's elements, importer authoritative, snapshot/pull, implies
  `IS_A_SUPERSET_OF`.
- `protocols/drafts/stamping.md` § "The write rule" (`:18–29`): a deliberately-published item carries
  its personal `z` plus cloud handles anchored on its author's own pointer-`b` (`:23`); the read
  contract's query strategy (`:49`) unions correspondents' `#z` indexes for exhaustive discovery.
- `protocols/drafts/shared-concepts.md` § "Declared affiliation": affiliation is pointer-only; the
  inherit family anchors no stamps.
- BIBLE: the glossary `b tag` row (`:1546`) and the §25 pointer (`:1630`) carry the facet's status;
  § Assistant Keys (`:1079`) points at the per-DList entries.
- Decisions: `dlist-curation` ADR 0002 §3 (the header contract, type "per the registry"), as named by
  ADR 0003, whose Consequences say "Enables story 4: the assistant-authored header carries
  `["b", <community a-tag>, "inherit-items"]` exactly".

**Facts from the wire and the code (read this session).**
- Decentralized Lists NIP (`protocols/nips/decentralized-lists.md:39–53`): an item's `p`, `e`, `t` and
  `a` tags *are* its item; the optional tags are `name`, `title`, `slug`, `description`, `comments`; one
  item event may carry several `z` (Example 4, an item on two lists). Approval and disapproval are NIP-25
  kind-7 reactions with an `e` tag at the item (`:55–60`).
- NIP-18: `["q", "<event-id> or <event-address>", "<relay-url>", "<pubkey-if-a-regular-event>"]`,
  relay-indexed. NIP-09: kind 5 with `e` or `a` tags and a `k` per kind; for an `a` tag, relays SHOULD
  delete every version up to the request's `created_at`.
- Nothing in `src/` or `ui/src/` reads or writes a `q` tag; worksheet W2's single-char registry lists
  `z`, `n`, `s`, `b` (with `B` reserved).
- The house already sends NIP-09 retractions: `ui/src/utils/publishTagPin.js:397–418` (`unpinTag`, kind 5
  with `["e", <pin id>]`).
- `src/lib/dtag.js:34–54`: the house's deterministic d-tags use SHA-256 (`hash8`), but `childDTag`
  derives from a *name* (`slug(name)-hash8(parentUuid)`).
- The as-built "already copied" rule (`curatedItemRows` in `ui/src/utils/treasureMap.js`;
  `my-curated-dlists` ADR 0003 sub-decision 2) matches the original's id or 39999 coordinate in any tag
  value of the assistant's items, so `q` values satisfy it unchanged.
- Two headers on the community relay carry the older link: staging's TA `8e901369…` and the customer
  assistant `253d40c4…`, both for `dog-breed` (book § Known constraints).
- Test pins: `inherit-items` is pinned only by code suites (`test/dlist-curation-header-endpoint.test.js`,
  `test/dlist-curation-map-entries.test.js`, `test/my-curated-dlists-headers.test.js`,
  `test/my-curated-dlists-items.test.js` — story 2's). No suite reads `assistant-designation.md` or the
  b-tag handoff; none pins text this story changes.

**Concepts.** `39998:<TA>:list` (neighbors: its superset, schema and graph nodes — orientation only),
`39998:<TA>:shared-concept`, `39998:<TA>:tapestry-assistant`. No concept, schema or property changes.

**POV reflex checks.** *Who is this true for?* A curated list is one point of view's published
statement — its user's, through their assistant — and every reader still filters every item, copies
included, from its own point of view at read time. *Where does trust come from?* The curation method
(instance behavior, outside the spec) reads trust per point of view; the wire records no verdict.
*Could anyone else publish their own version?* Yes: any user's assistant may curate the same shared
list, and different curators' copies coexist at different addresses. *What changes when the point of
view changes?* Nothing stored; the next Update re-derives. Principle 4: copies are letters the
assistant authors; nothing here writes or discards graph state.

## Options considered

### 1. The header's link to the shared list
- **A — `pointer` (chosen; settled).** The registry glosses `pointer` as non-committal correspondence,
  "may pull later" — the copy model. The list is exactly its filed items, and the header affiliates:
  discoverable, with zero aggregation weight.
- **B — keep `inherit-items`.** Any reader implementing the resolved item set unions every shared item
  into the curated list, rejected candidates included, and v1 cannot subtract (W6). It defeats curation.
- **C — a new, non-affiliating type (for example `curates`).** Grows the closed registry for what
  `pointer` already says; an unknown type reads as `pointer` anyway, so older readers would treat it as
  an affiliation regardless.
- **D — `pointer` plus `inherit-items`.** Keeps B's live union.

### 2. The back-reference
- **A — NIP-18 `q` (chosen; settled).** Takes ids and addresses; relay-indexed; not a DList item tag,
  so a copy's item stays unambiguous; unused in the house.
- **B — `e` / `a`.** They *are* a DList item's item tags: in a list of notes or articles, a provenance
  `e` or `a` reads as a second item to every DList reader.
- **C — an item-level `b` pointer.** Element 2 must be an a-tag, so a 9999 original cannot be named; and
  a pointer `b` is a declared affiliation, which drags item-level stamping in.
- **D — a named tag (`copy-of`).** Unambiguous, but not relay-indexed: "who copied this item" becomes a
  scan. Kept as the fallback should `q`'s NIP-18 meaning ever conflict.

### 3. Removal
- **A — a NIP-09 deletion request (chosen; settled).** Standard; the house already sends kind 5; the
  `a` form covers every version up to the request, so an older version synced back through a router
  cannot resurface; a later re-copy at the same address carries a later `created_at` and is legal.
- **B — republish the copy without its `z`.** Works wherever replaceable events do, but leaves an event
  the DList NIP does not count as an item, and needs a new marker to explain it.
- **C — both.** Doubles every removal to cover a relay-support gap that story 5 checks directly.

### 4. What a copy carries
- **A — an allowlist (chosen; settled, plus `content`):** the original's `name`, `title`, `slug`,
  `description`, `comments`, its item tags (`p`/`e`/`t`/`a`) and its `content`; nothing else. `json` is
  derived from the author's graph (out of scope); `n`, `s` and `b` state the original's place in its
  author's graph and would be re-asserted under the assistant's signature; the original's `d`, `z`
  and `q` are replaced by the copy's own. `content` is not a tag and the story's list is silent on it;
  it is carried because it is what the author wrote — the principle behind the list.
- **B — every tag except a denylist.** Carries unknown tags whose meaning the copier cannot vouch for.
- **C — a thin reference (no content; readers fetch the original).** BIBLE §31's "pointer" mode: no
  drift, but the list stops being self-contained — an original's deletion or lost relay empties the
  item. The operator chose copies.

### 5. The copy's `d`
- **A — `copy-` + the SHA-256 digest of (curated header address, original reference) (chosen).**
  Deterministic from two stable inputs: a repeat Update lands on the same address (refresh in place),
  two originals never collide, an original on two lists one assistant curates gets one copy per list
  (the NIP's Example 4), and any implementation can compute it. Opaque — the `q` tags carry the
  readable provenance.
- **B — the house's name-derived `childDTag` (`src/lib/dtag.js:51`).** Two originals with the same name
  collide, and an original its author renames moves to a new address.
- **C — a readable composite (`copy:<original reference>`).** Not per list (Example 4 collides); long;
  inherits the original's d-tag characters (the detail route's `%2F` limit — `my-curated-dlists`
  story 1 review NB-5).
- **D — a random nonce, looked up before writing.** Not deterministic: concurrent Updates duplicate.

### 6. Where the copy rules live
- **A — a subsection of `assistant-designation.md` § "Per-DList curation entries" (chosen).** The
  section already governs the curated header, and its relay element already covers "the header and its
  items": one home for everything a reader needs to read a curated list.
- **B — a new draft (`protocols/drafts/curation-copies.md`).** A cleaner single topic, but it splits one
  curation across two drafts and adds a status row for a convention with one consumer. Revisit if a
  second consumer appears (for example, people copying items by hand).
- **C — the Cross-NIP Compatibility companion.** That companion is about DList encodings in other NIPs,
  and it is publish-ready; curation is not a compatibility concern.

### 7. One assistant per list
- **A — one curating assistant per list across instances, with read-only recognition elsewhere (chosen;
  settled).** No protocol change: ADR 0002 §5 stands.
- **B — one entry per (list, assistant).** Two assistants produce two diverging curated lists for one
  user, and every Map reader needs a new tie-break.
- **C — a portable assistant key.** BIBLE §31: the TA key is the instance's own, hot, server-held key.

### 8. The `inherit-items` facet
- **A — keep it registered, with no emitter (chosen; settled).** Coherent for a list that takes every
  parent item live; no second round of registry edits.
- **B — withdraw it (registry back to two values).** Headers already carrying it would read as `pointer`
  automatically, but it costs a second registry ADR and discards a facet a live-subscription list may
  want.

### 9. Recording the change in the earlier decisions
- **A — annotate the superseded ADRs (chosen):** a Status-line parenthetical and a one-line note under
  the header of `dlist-curation` ADRs 0002 and 0003, pointing here — the house form
  (`community-reference/0010`: "Accepted (mechanism superseded by ADR 0011)"; ADR 0011's "Superseded
  by… note at top" for 0009).
- **B — say it only here.** Readers of 0002 and 0003 would not learn that the header moved; AC-7 requires
  the earlier decisions to say so.
- **C — an Amendment section in each earlier ADR.** The house uses amendments within an epic's own
  lineage (`my-curated-dlists/0003` Amendment 1); a change from another epic belongs to that epic's ADR.

### 10. The family-table row
- **A — a row of its own, "curated copy" (chosen).** `IMPORT` absorbs the parent's elements and implies
  `IS_A_SUPERSET_OF`; a curated list selects items one at a time and is not a superset; `IMPORT`'s wire
  format is unspecified, while the curated copy's is specified.
- **B — extend `IMPORT`'s row.** Merges an unspecified relationship with a specified one of a different
  posture.

## Decision

We chose **Option A** on every axis. Ratified semantics — the specs mirror these, in spec voice:

1. **The curated header links with `pointer`.** It carries `["b", "<shared header a-tag>", "pointer"]`,
   a declared affiliation. The curated list's items are exactly the items filed under the header by
   `z`; nothing is inherited live. A writer still MUST NOT re-point a header's `b` silently. A header
   that carries the earlier `["b", <target>, "inherit-items"]` is upgraded by its assistant republishing
   it with `["b", <same target>, "pointer"]` — the same target, a new type — and the owner is shown the
   change before the assistant signs. Until then, such a header means what its tag says (Inherit-From
   § "Resolution: the resolved item set").
2. **A copy** is a kind-39999 event authored by the curating assistant (the pubkey the Map entry names),
   whatever the original's kind, and published where the header is published — at least on the relay
   the Map entry names. Its tags are exactly: its `d` (§4); one `z`, the curated header's address; its
   `q` tags (§5); and the tags it carries from its original (§3).
3. **What a copy carries from its original:** the `name`, `title`, `slug`, `description` and `comments`
   tags and every item tag (`p`, `e`, `t`, `a`), verbatim, and its `content`. No other tag of the
   original's is carried — in particular not `json` (derived from its author's graph), `n` or `s` (its
   place in its author's class threads), `b`, or the original's own `d`, `z` or `q`.
4. **The copy's `d`** is `copy-` followed by the lowercase hexadecimal SHA-256 digest of the UTF-8
   string formed by the curated header's address, a line feed (U+000A), and the original's reference —
   its address `39999:<author>:<d>` for a kind-39999 original, otherwise its event id. Copying the same
   original into the same list again therefore replaces the copy.
5. **Pointing back.** A copy of a kind-39999 original carries `["q", "39999:<author>:<d>", "<relay>"]`;
   every copy carries `["q", "<id of the version copied>", "<relay>", "<author>"]`. The original's
   author is named in that fourth element, never by an added `p` tag — in a DList item, a `p` names an
   item. An original is **already copied** into a curated list when an item filed under that list's
   header by the header's author carries a `q` whose value is the original's address (kind-39999
   originals) or its event id (other kinds). A reader merging items across related lists — discovery
   walks, stamping's exhaustive query strategy — treats a copy and its original as one item.
   *(Non-normative: because `q` is relay-indexed, "which curated lists hold a copy of this item" is one
   `#q` query.)*
6. **Removal and change.** A copy is removed by a NIP-09 deletion request from its assistant:
   `["a", "39999:<assistant>:<copy d>"]`, `["e", "<copy event id>"]`, `["k", "39999"]`. The original
   becomes a candidate again; no reason for the removal is recorded anywhere, and whether it is copied
   again is decided afresh. When the original is **edited**, the copy is unchanged; its assistant may
   refresh it at the same address (the carried tags and `content` re-copied, a new version `q`). When
   the original is **downvoted or disputed**, the curation method decides again. When the original
   **cannot be found**, the copy stays. Which originals are copied is the curation method's decision;
   this spec does not define the method.
7. **Stamping.** A copy carries only its curated list's `z`. It is never stamped with the handles of the
   list its original came from — the original already occupies them.
8. **One curating assistant per list.** Because the Treasure Map is one replaceable event read by every
   instance, a list has at most one curating assistant across all instances (the one-entry-per-list
   rule, unchanged). An instance whose own assistant is not the one named MAY show that curation
   read-only and MAY offer to replace the entry.
9. **`inherit-items`** stays in the registry, unchanged; the reference deployment no longer emits it.
   `dlist-curation` ADR 0002 §3's header type and ADR 0003's consequence "Enables story 4" are
   superseded by this ADR; ADR 0003's facet otherwise stands.

## Consequences
- **Enables** stories 2–5: a written contract for the header endpoint's type and its handling of the
  older form (2), the read-only view (3), the qualifying rule's output (4), and Update's copy, refresh
  and delete (5).
- **Resolves** OPEN.md rows 259 and 267 (flipped to DONE in Phase 4), and eases W6: removal in a
  curated list is a deletion, not set algebra.
- **Reverses a posture, on purpose.** The b-tag handoff's H1 said a published snapshot is IMPORT's
  quadrant, "not the wanted posture here — the community stays authoritative". For items, the curator
  is now authoritative. H1's hazard — synced definition fields indistinguishable from overrides — does
  not arise: a copy says it is a copy (`q`).
- **Discoverability.** A `pointer` header is a declared affiliation: discovery walks enumerate curated
  headers, and an exhaustive query unions their `#z` indexes — hence the merge rule in §5.
- **Constrains.** `copy-` d-tags under an assistant's key are this convention's namespace. Copies are
  snapshots: an author's edit reaches a copy only through its assistant's refresh.
- **Debt, recorded.** Relay support for kind-5 deletions (including the `a` form) is unverified beyond
  the local stack — story 5 checks it before relying on it. Votes are keyed by event id, so an edited
  39999 original leaves its votes on its old version — a rule story 5 needs (epic guardrails). The
  item-set resolver and the `INHERITS_ITEMS_FROM` derivation stay parked. The two headers already
  carrying `inherit-items` are upgraded visibly (story 5's preview, or story 2's endpoint path), never
  silently.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

Docs-mode. Exactly these edits, mirroring the Decision in spec voice, with rationale pointing here.
`<date>` is the Phase-4 date.

1. **`protocols/drafts/assistant-designation.md`**
   - Metadata `Sources` (`:4`): add "`curated-dlist-update` ADR 0001 (the header's `pointer` link;
     curation copies)".
   - Intro (`:11`): the sentence naming the spec's two conventions also names the **curation copies**
     an empowered assistant files under its header.
   - "**The header contract.**" (`:68`): the `b` bullet (`:71`) becomes Decision §1's first three
     sentences; drop its "A writer MAY add a `"pointer"`-typed `b`…" clause (the header now carries
     one). The MUST paragraph after the bullets gains Decision §1's upgrade sentences.
   - After "**Multiplicity; writer and reader rules.**" (`:78`): a new "**Across instances.**"
     paragraph — Decision §8.
   - "**Worked example.**" (`:86–92`): `"inherit-items"` → `"pointer"`; one added sentence: an item her
     assistant copies is filed under `39998:<alice's assistant pubkey>:dogs` and names its original
     with `q` tags.
   - A new `### Curation copies` subsection after the worked example, before
     "## Dual-author lookup and precedence" (`:94`): Decision §§2–7, in that order, each as a bold-led
     paragraph; §7 as one sentence pointing to [Stamping](./stamping.md). One worked copy event and one
     deletion request as JSON, continuing the `dogs` example.
   - "## Deployment status (not normative)" (`:120`): one sentence — curation copies are specified, not
     yet wired (`curated-dlist-update` stories 2–5); the endpoint still writes `inherit-items` until
     story 2.
2. **`protocols/drafts/inherit-from.md`**
   - Metadata status block (`:4`): replace its last sentence — the `inherit-items` type has no emitter in
     the reference deployment (curated lists link with `pointer` and hold curation copies —
     `curated-dlist-update` ADR 0001); an `inherit-items` tag would still derive the pointer form, and
     the derivation update and item-set resolver are parked (intake entry 2026-09-10, resolved).
   - "**Choosing the type — one question**" (`:32`): add "Only some of their items, by your own choice?
     → carry `"pointer"` and copy the items you choose ([Assistant Designation](./assistant-designation.md)
     § "Curation copies")."
   - § "Place in the editorial-relationship family": the italic note (`:132`) gains "The curated-copy row
     names a convention specified in [Assistant Designation](./assistant-designation.md) § "Curation
     copies"; it is not a `b` type."; the table gains a row after `IMPORT` (`:139`):
     `| **curated copy** (`pointer` `b` on the header + `q`-linked copies) | select the parent's items one at a time; **curator** authoritative | snapshot, refreshed by the curator | — | **no** — a selection, not containment |`.
3. **`protocols/drafts/stamping.md`**
   - § "The write rule": after item 3 (`:25`), before "`z` order" (`:27`), one sentence — Decision §7,
     pointing at [Assistant Designation](./assistant-designation.md) § "Curation copies".
   - § "The read contract", "Query strategy that follows" (`:49`): append "…, collapsing a curated copy
     into its original (by its `q` tag) so that one item is not counted twice."
4. **`BIBLE.md`**
   - Glossary `b tag` row (`:1546`): after the `inherit-items` clause add "no emitter in the reference
     deployment — curated lists link with `"pointer"` and copy items (`curated-dlist-update` ADR 0001)".
   - §25 pointer (`:1630`): replace the "**Status today for the facet:**" sentence with item 2's status
     sentence, in BIBLE voice.
   - § Assistant Keys (`:1079`): after "…that curates a community DList via its `b` tag" add
     "(`pointer`-typed; the assistant's curation copies are specified in the same draft —
     `curated-dlist-update` ADR 0001)".
   - `**Last updated:**` (`:8`): bump with a chained content note in the same commit (L9 is
     commit-dated — OPEN.md row 238).
5. **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — after D10's last bullet, before the `---` at `:169`:
   **D11 — Curated lists copy** (added `<date>`, `curated-dlist-update` ADR 0001): four bullets —
   Decision §1; §§2–4 (what a copy is and carries, its `d`); §§5–6 (`q`, removal); the H1 reversal —
   and the rejected options, one line each. § 3's W6 row (`:188`): append "`<date>`: its first consumer
   withdrew — curated lists copy (`curated-dlist-update` ADR 0001)". Status line (`:3`) unchanged.
6. **`protocols/worksheet.md`** W6 — a new paragraph after the 2026-09-10 update (`:63`), before
   `**Refs:**` (`:65`): "**Update `<date>` (`curated-dlist-update` ADR 0001):** the first consumer
   withdrew — curated lists select items by copying them (Assistant Designation § Curation copies), and
   removal there is a deletion, not set algebra. The additive case stays specified for `inherit-items`;
   removal and replacement of inherited items remain open." The Status line (`:59`) gains
   "· first consumer withdrew `<date>`".
7. **`protocols/README.md`** — row 61's scope phrase "… + per-DList curation entries" becomes
   "… + per-DList curation entries and curation copies"; the last column of rows 57, 61 and 64 gains
   "· `curated-dlist-update` #1".
8. **`engineering-team/decisions/done/dlist-curation/0002-per-dlist-map-entry-convention.md`** — Status:
   "Accepted (§3's header type superseded by `curated-dlist-update` ADR 0001)"; under the Story line:
   "> **Superseded in part (`<date>`):** the curated header's `b` type — now `pointer`, with curation
   copies — `engineering-team/decisions/done/curated-dlist-update/0001-curation-copy-convention.md`."
9. **`engineering-team/decisions/done/dlist-curation/0003-inherit-items-facet.md`** — Status: "Accepted
   (the facet stands; its consumer moved to `pointer` and copies — `curated-dlist-update` ADR 0001)";
   the same one-line note, naming the "Enables story 4" consequence.
10. **`engineering-team/stories/_intake.md`** (`:2340`) — a closing line at the top of the block:
    "**RESOLVED** `<date>` — no consumer: the reference deployment no longer emits `inherit-items`
    (curated lists link with `pointer` and copy items — `curated-dlist-update` ADR 0001). Reopen if a
    list that takes every parent item live is wanted."
11. **`OPEN.md`** rows 259 and 267 — status `DONE`, the resolved date, and a note "Settled by
    `curated-dlist-update` #1 (ADR 0001)": for 259, the copy convention; for 267, one assistant per
    list, with recognition on other instances built in story 3.

Not edited: `protocols/drafts/shared-concepts.md` (its affiliation text stays accurate),
`communities.md`, the Decentralized Lists NIP, `dlist-curation` ADRs 0004–0006 (their code
consequences are story 2's), and the `my-curated-dlists` records.

**Regression (Reviewer).** No `test/` change. Run the suites that read the edited documents —
`test/b-coverage-audit-and-disposition.test.js`, `test/b-tag-primitive.test.js`,
`test/publish-time-default-stamping.test.js`, `test/open-ranking-stats.test.js`,
`test/event-tagging-spec.test.js`, `test/harness-lint.test.js`,
`test/scheduled-search-and-house-scores-refresh.test.js`,
`test/task-queue-semaphore-protection-audit.test.js`, `test/treasure-maps-router-preset.test.js`,
`test/kill-timeout-orphans-by-default.test.js`, `test/note-tagging-raw-events-inspector-ui.test.js`,
`test/tag-actions-menu-ui.test.js`, `test/tag-read-union.test.js` — and harness-lint after the commit.
The OPEN.md edit only changes two rows' status cells; the full `npm test` is optional (its known reds
are rows 191 and 261).

## Out of scope
- All code: the endpoint's type and the older form (story 2), the read-only view (3), the method panel
  (4), and Update (5).
- The curation method, the Trust Determination Methods concept, and a schedule.
- Removal and replacement for `inherit-items` (W6); the item-set resolver and derivation.
- Verifying that relays honor kind-5 deletions (story 5).
- Proposing any of this upstream.

## Amendment 1 — the emitter's timing, and four clarifications (2026-09-12)

**Why.** Review round 1 (`engineering-team/reviews/done/curated-dlist-update/1-curation-copy-convention.md`,
Blocking 1) found that four sentences this ADR prescribed — Decision §9's "the reference deployment no
longer emits it" and Implementation notes 2 (the `inherit-from.md` status block), 4 (BIBLE `:1546`,
`:1630`) and 10 (the intake closing line) — state as present fact what only a later story makes true.
The header endpoint (`src/api/dlist-curation/index.js:24`, `:82`) writes `inherit-items` until story 2
replaces it, and nothing copies items until story 5. Implementation note 1 (Deployment status) had the
timing right, so the drafts contradicted each other. At the review gate the operator also chose to fold
in four of the review's non-blocking findings (2, 3, 4 and 6).

**Change.** The decision is unchanged; its wording and timing are corrected.
1. **Timing.** Wherever this ADR says the reference deployment "no longer emits" `inherit-items`, or
   states as current fact that curated lists hold copies (Decision §9; notes 2, 4 and 10), read: *the
   reference deployment stops emitting it with `curated-dlist-update` story 2 — curated lists then link
   with `pointer` and hold curation copies; until then its header endpoint still writes it.* The same
   qualifier applies to BIBLE's `Last updated` note (note 4), the ADR 0003 annotation (note 9) and
   handoff D11 (note 5). Story 2 drops the qualifier when it ships, together with
   `assistant-designation.md`'s Deployment status. AC-7's "no longer emits" is met by the timed wording:
   the decision is ratified here and takes effect in story 2.
2. **Edited originals (review NB 2).** Decision §6's "edited" case applies to kind-39999 originals: the
   copy's `d` derives from the original's address, which an edit keeps. An original of any other kind is
   referenced by its event id, so an edited version is a new event and, to the curation method, a new
   original.
3. **Who copies (review NB 3).** Note 2's "Choosing the type" sentence ends "…copy the items you choose,
   the way an empowered assistant does (§ "Curation copies")" — the spec defines copies only for an
   empowered assistant (Option 6B still defers a hand-copying consumer).
4. **The endpoint today (review NB 4).** Note 4's § Assistant Keys (`:1079`) edit also says, in that
   paragraph's status sentence, that the endpoint still writes `inherit-items` until story 2 and that
   nothing copies items yet.
5. **The `copy-` namespace (review NB 6).** Decision §4 gains: an assistant's kind-39999 d-tags that
   begin with `copy-` are reserved for curation copies — the Consequences' namespace, stated in the spec.

Not taken: review NB 1 (the line-feed separator in the `d` input is not injective only for two crafted
d-tags — pathological; revisit if the draft is revised).
