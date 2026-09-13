# Build Audit: Event-less Sets

**Book:** `engineering-team/audits/event-less-sets/book.md`
**Date:** 2026-09-13
**Branch / commit range:** `51012d43..00bd91e7` on `chore/concept-graph-curation` (book and epic, story, ADR, tests, two implementation rounds, two reviews), merged to `staging` in PR #658 (`f5015a5f`) and promoted to `main` in PR #659 (`10850752`). The real use is graph data on this Mac Studio (2026-09-13) and has no commit. This close lands on `docs/open-row-summaries-l5`.
**Provenance:** Acceptance-frame (no PRD; frame restated and confirmed at kickoff, 2026-09-12)
**Confidence:** high

> As-built record. What the product *is* now, source-linked. Does not propose changes — that's the seed's job.

## 1. What shipped

- **An owner or trusted local operator can create a set with no nostr event behind it.** `POST /api/normalize/add-subset` writes a Set under an existing superset or set in Neo4j only and registers it as an element of the `set` concept. It signs and stores nothing. — `stories/done/node-primitives/1-event-less-create-set.md`
- **Repeating a create is safe.** The same name under the same parent (any case or padding, event-less or lettered) answers `already-existed` and creates nothing. A different node already holding the address answers 409. — same story
- **A credential-free probe shows where it is deployed.** `GET /api/normalize/node-primitives` answers `{"success":true,"surface":"node-primitives","operations":["add-subset"]}`. Production answered 404 before PR #659 and 200 after. — same story, ADR decision 1
- **A throwaway instance for live tests.** `scripts/scratch-stack.sh up|down` boots an ephemeral copy of the stack running this checkout's `src/`, so live checks never touch the shared local stack. — same story
- **Used for real.** On 2026-09-13 the operator's second `firmware concept` subset, `firmware concepts for tags and tagging`, was created event-less on this Mac Studio with five members. Organization (Sets) shows it beside the lettered `firmware concepts for nostr`.

## 2. Epics & stories rolled up

### Epic: `node-primitives`
| Story | Delivered | Status | Review |
|---|---|---|---|
| #1 event-less-create-set | `POST /api/normalize/add-subset` (event-less Set, registered under `set`, idempotent by name under its parent), the `node-primitives` probe, `scripts/scratch-stack.sh`, BIBLE §6/§11 | Done | `reviews/done/node-primitives/1-event-less-create-set.md` (round 1 CHANGES_REQUESTED on B1; round 2 PASS) |

ADR: `decisions/done/node-primitives/0001-event-less-add-subset-primitive.md`. It chose Option A: an event-shaped node minus the event (event-form uuid, `NostrEvent:ListItem:Set`, would-be tags stored, no `id`), in a dedicated strfry-free module whose import surface is test-pinned.

The epic is **Done** at this close: its only story is Done and its branch merged to `staging` and `main`. Its folders moved under `done/`.

## 3. As-built inventory

Derived from `git diff f5015a5f^1 f5015a5f` (14 files, +2459/−3):

- **User-facing (API only; no UI change):**
  - `POST /api/normalize/add-subset` `{parentUuid, name, description?}` — `src/api/normalize/nodes.js` (new). Its answers:
    - 200 `created`, with the `set` registration, the parent, and a durability `note`;
    - 200 `already-existed`, with `hasEvent`, `registeredUnder` only when true, and no `note`;
    - 400 for a bad field, or a parent that is neither Superset nor Set;
    - 403 when the caller is neither the owner nor local-trusted;
    - 404 for a missing parent;
    - 409 when another node holds the address;
    - 500 when a firmware precondition is missing, or when the graph changed between the checks and the write.

    An unauthenticated remote caller gets 401 from the default-deny middleware first.
  - `GET /api/normalize/node-primitives` — `src/api/normalize/nodePrimitivesProbe.js` (new, zero requires).
  - Route registration — `src/api/normalize/index.js` (+11, beside the relationship primitives).
- **Domain:**
  - Concepts touched: `39998:<TA>:set` (new sets become its elements), `39998:<TA>:superset`, `39998:<TA>:class-thread`, and the local-only `39998:<TA>:firmware-concept` (the first consumer).
  - No concept definition changed, so no firmware reinstall.
- **Data & contracts:**
  - **The first event-less node shape.**
    - Labels `NostrEvent:ListItem:Set`.
    - `uuid` is the would-be a-tag address `39999:<TA>:<slug(name)>-<hash8(parentUuid)>`, create-set's d-tag rule.
    - Properties `uuid, name, kind, pubkey, created_at`, and **no `id`**.
    - The would-be tags `d, name, z, s` (and `description`) are stored as `NostrEventTag` nodes with `importEventDirect`'s tag-uuid formula, so a later letter lands on identical nodes.
  - **Edges.** `(parent)-[:IS_A_SUPERSET_OF]->(set)` and `(set superset)-[:HAS_ELEMENT]->(set)` are written in one idempotent statement. Members are wired separately with `add-relationship`.
  - **BIBLE.** §6: `NostrEvent` also marks an event-less node (an event-form address with no `id`), explicitly not §30's provenance marking. §11: the two routes.
  - **No events.** No event kinds and no strfry writes. S1 pins the import surface: `crypto`, the Neo4j driver, the firmware alias layer, auth, and the d-tag helper.
- **Dev tooling:** `scripts/scratch-stack.sh` (new) runs `tapestry-scratch` plus a redis and a network.
  - This checkout's `src/` is mounted `:ro`.
  - Neo4j is sized via `BRAINSTORM_NEO4J_*`, and `BRAINSTORM_PUBLISH_LOCAL_ONLY=true` is set.
  - Firmware is installed and strfry-router is stopped.
  - The instance is removed on ERR, INT or TERM.
- **Tests:** `test/event-less-create-set.test.js` (U1–U10, S1–S4, H0–H10), registered in `test/test.js`.
- **Local graph and container state after the real use (Mac Studio, not in the diff):**
  - The event-less set `39999:<TA>:firmware-concepts-for-tags-and-tagging-31a7463e` holds tag, nostr user tag, nostr event tagging, tag pinning, and tagging with specific tag.
  - Their direct edges from the firmware-concept superset were removed (the pruned normal form), leaving 28 direct elements and 37 in total.
  - To serve the route there, main's `nodes.js`, `nodePrimitivesProbe.js` and `index.js` were hand-copied into the shared `tapestry` container, which is not bind-mounted. The earlier `index.js` is backed up at the container's `/tmp/normalize-index.pre-node-primitives.js`.

## 4. Deviations from intent

| # | Specified (frame / story / ADR) | Built | Type | Rationale (source) | Product impact | Carry-forward |
|---|---|---|---|---|---|---|
| 1 | Frame: "a set can be created … with no nostr event signed or stored" | An event-shaped node minus the event: event-form `uuid`, `NostrEvent` label kept, would-be tags stored, no `id` | interpretation | ADR 0001 Option A; BIBLE §6 amended. It keeps a later letter possible without re-creating the node, and every read path that anchors on `NostrEvent` keeps working | None visible; "no `id`" is the working marker of an event-less node | §30's "locally authored" marking stays with `self-ontology` (§6) |
| 2 | Frame: "Shipped local → staging → production" | Also a credential-free probe route as deployment evidence | added-beyond-scope (by design) | ADR 0001 decision 1 (the relationship-primitives pattern) | One public read route | The probe's `operations` list grows with the family (ADR debt) |
| 3 | ADR Implementation notes: live checks on a scratch copy with `src/` copied in and a restart | `scratch-stack.sh` mounts `src/` read-only, adds `BRAINSTORM_PUBLISH_LOCAL_ONLY=true`, and sizes Neo4j with `BRAINSTORM_NEO4J_*` | constraint-discovered | Story `## Deviations` 1, 2 and 5. A first boot at the entrypoint's whole-VM sizing never came up beside the shared stack | None (dev tooling) | `brain-drill.sh` still uses the shrink-after-boot recipe, and the two scripts duplicate the boot block (OPEN.md row 287) |
| 4 | ADR decision 9: `already-existed` has `created`'s shape, plus `hasEvent` and without `note` | Round 1 answered a narrower shape on the common path; round 2 conforms, after the Tester pinned the shape in H2/H4 | intentional-change (resolved) | Review round 1 B1, cleared in round 2; the operator's gate choice was "conform; Tester pins first" | None at ship | — |
| 5 | ADR sketch: a pre-MERGE `OPTIONAL MATCH` learns whether the write created the node | A same-statement ON CREATE marker instead. Tags are written only on create, and a non-Set node at the address yields zero rows (500) | intentional-change | Story `## Deviations` (round 2); review NB2 | Two concurrent identical calls can't both answer `created`, and 6b's "never silently re-linked" holds in the race window | — |
| 6 | Test plan: test files change only in Phase 3 | H10's fixture was amended in Phase 4 (`8b77d448`) to bring its own two members | constraint-discovered (process) | Story `## Deviations`. The operator approved the kick-back in session on 2026-09-12 ("Amend H10, re-run now"), which answers the review's N4 | None | Harness: OPEN.md row 283 (§7) |
| 7 | Frame: "survives a firmware reinstall" | Verified on the scratch instance only (H10, 24/0/1). A set nested under another Set was never taken through a reinstall, and there was no reinstall on the shared stack, by design | interpretation | Review NB6 (parity with lettered nested sets by construction); book § Known constraints | None expected | — |
| 8 | Frame: "used … to create at least one of the remaining `firmware concept` subsets" | One: `firmware concepts for tags and tagging`, the operator's rename of the proposed "tagging" set. The operator chose not to create the other seven proposed subsets for now | interpretation (operator decision, 2026-09-13) | This close's conversation | None | The seven remaining subsets are the operator's call (seed §6) |
| 9 | Book § Known constraints: "using the primitive here … means deploying into that shared container — coordinate" | Main's three `normalize` files were hand-copied into the shared container after a coordinated hold (the other session's full `npm test` finished first). `brainstorm` restarted, and the live class passed there 24/0/1 with H7 live | constraint-discovered | Book § Known constraints; OPEN.md rows 198/226 (the container is not bind-mounted) | The shared container runs main's `normalize` modules over `feat/curated-dlist-update`'s code until that branch's next `src/` sync. The branch will merge `main` before its staging PR | — |
| 10 | (not specified) a side effect of the curation | The pruned normal form under `firmware concept` turned `summaries-element-count` L5 red on this Mac Studio, because L5 used the concept as a direct-only control | constraint-discovered | Flagged by the curated-dlist-update session's baseline `npm test`, 2026-09-13 | A red live test on this machine. L5 also fails on any stack without this local-only concept | OPEN.md row 285 (the operator deferred the test fix) |

**Undocumented work:** none. Every hunk in `f5015a5f^1..f5015a5f` traces to one of these:
- the ADR's Implementation notes;
- the test plan;
- a journaled deviation;
- the review-sourced OPEN.md rows 281–284.

## 5. Quality state at close

- **Test gate.**
  - **Live class on the shared `tapestry` container** after the deploy there (2026-09-13): 24 passed, 0 failed, 1 skipped (H10, scratch-only by design).
    - H7 ran live for the first time: an unauthenticated host-side POST gets 401.
    - A read-only query afterwards found no fixture nodes left.
  - **Scratch instance** (round 2): 24/0/1, including H10's firmware reinstall.
  - **Smoke tests.** Staging passed 17/17 (PR #658). Production passed 18/18 (PR #659): the probe went from 404 to 200 with the exact body, and an unauthenticated POST gets 401.
  - **At close, on this tree:** harness-lint is clean, and the event-less suite's stack-free classes passed 14/0/11 (the H class skipped by pointing it at a non-existent container).
  - **The full `npm test` was not run locally.** At least 20 live suites name the shared stack directly (`:7778` or `docker exec tapestry`), several of them publish, and another session is live on that stack. The full suite runs stack-free in CI (`test / stack-free`) on the close-out PR. The sandbox-security close did the same.
- **Known open issues:**
  - OPEN.md row 281: no backup for event-less nodes, which now hold real curation.
  - Row 282: non-ASCII names share one address per parent.
  - Row 285: the L5 control.
  - Row 286: `/api/neo4j/query` classes `:Set` reads as writes.
  - Row 287: `brain-drill.sh` sizing and the duplicated boot block.
- **Optional review items not taken** (operator, 2026-09-13): N1 and N2 (two one-line test pins), and N3 (a Verification note for the round-2 failing confirmation).
- **Debt (ADR Consequences):**
  - `scratch-stack.sh` repeats `brain-drill.sh`'s boot block.
  - `importEventDirect`'s float `kind`/`created_at` quirk is mirrored, not fixed.
  - Letters that point at an event-less node dangle on the wire until it gets a letter. This is documented, not guarded.
  - The probe's `operations` list grows with the family.

## 6. Carry-forward register

- [ ] **Backup coverage for event-less nodes** (OPEN.md row 281). The operator's first event-less set is unbacked by default (BIBLE §30: "mortal and box-bound").
- [ ] **A letter-minting primitive**, to publish an event-less set later without re-creating it (story Out of scope; ADR Consequences). The stored would-be tags are its input.
- [ ] **More node-level primitives:** `delete-subset`, rename, and event-less creation of other node kinds such as elements, concepts and properties (story and ADR Out of scope).
- [ ] **§30's "locally authored" marking** is the `self-ontology` epic's open decision. `id IS NULL` finds today's event-less nodes for a later migration (ADR Consequences).
- [ ] **UI:** "+ New Set" still writes letters. Whether the UI should offer event-less creation, or show that a set is private, is open.
- [ ] **Dangling letters.** A lettered `add-to-set` or `create-set` beneath an event-less set would emit tags naming a node that has no event. Documented, not guarded (ADR Consequences).
- [ ] **Non-ASCII set names** share one address per parent (OPEN.md row 282).
- [ ] **The remaining seven `firmware concept` subsets** were proposed on 2026-09-12 and not created; they are the operator's call.
- [ ] **`summaries-element-count` L5 control** (OPEN.md row 285).
- [ ] **`/api/neo4j/query` treats `:Set` reads as writes** (OPEN.md row 286; review round 2 N5; pre-existing).
- [ ] **`brain-drill.sh` sizing and the shared boot block** (OPEN.md row 287).
- [ ] **Admins vs owner** on reference-graph edits. This open question is inherited from the `relationship-primitives` prd-seed §7; the same gate applies here.

## 7. Process findings (harness)

| Finding | Source | Terminal state |
|---|---|---|
| A live test class whose environment is built in Phase 4 can't be validated in Phase 3. H10's fixture failed on first contact and was amended in Phase 4. It recurred in round 2 as N3, when the implementing session ran the failing confirmation. Ports to Direction mode: yes. | Review round 1 Harness friction 1; round 2 N3 | OPEN.md row 283 (meta), two occurrences in this book |
| The Reviewer can't "run the gate yourself" for a scratch-only live class under the shared-stack and Docker-memory limits, so both review rounds weighed Implementer output. A close-time variant recurred: the full `npm test` couldn't run locally beside a live session (§5). Ports: yes, since a Direction-mode judge has the same limits. | Review round 1 Harness friction 2; round 2; this close | OPEN.md row 284 (meta), three occurrences |
| The tests didn't pin ADR decision 9's answer shape, so a shape divergence passed every test (B1). | Review round 1 B1 | declined: the per-story review caught it, and the "Tester pins first" kick-back cleared it in one round. The harness worked as designed |
| An operator approval given in chat (the Phase-4 H10 kick-back) left no trace in the repo, so the reviewer couldn't verify the Deviations line's "operator-approved" (N4). | Review round 2 N4 | declined: the approval is on record in the session (the operator's gate answer, 2026-09-12) and is confirmed in audit §4 #6. A one-off; no harness change proposed |
| Data curation outside the per-story cycle broke another epic's live-test control: `summaries-element-count` L5 used `firmware concept` as a direct-only control. | The curated-dlist-update session's baseline run, 2026-09-13 | declined as a harness change: curation is not a harness phase. The pre-flight "grep `test/` for the concept's slug before reshaping it" is in agent memory (`concept-graph-write-paths`), and the test fix is OPEN.md row 285 (bug) |
| The real use needed a hand-copy into the shared, non-bind-mounted container, and a cross-session hold while another session's full `npm test` ran. Cross-session messaging (a request, a "done", an idle notice) coordinated it cleanly. | Book § Known constraints; this close | existing OPEN.md rows 198/226 (meta: CLAUDE.md's bind-mount claim). This book is another occurrence; no new row |
| The worktree-isolation guard refused compound shell forms: heredoc Cypher, `bash -c 'source …'`, docker `for` loops, and `git show` inside process substitution. Worked around with single commands, Node scripts and the `/api/neo4j/query` loopback. | This session | declined: environmental (the session tool's worktree guard, not a harness definition). The workarounds are in agent memory (`concept-graph-write-paths`) |
| With about 1 GB of Docker VM headroom, the scratch instance needed the operator's approval to pause two NosFabrica containers. | This session (Implementation) | declined: environmental (this Mac Studio's Docker VM size), recorded in agent memory (`scratch-stack-and-docker-headroom`). The review-side consequence is row 284 |

Measurement (`scripts/harness-stats.sh` at close): `node-primitives` has 9 phase commits (1 story, 1 ADR, 3 test, 2 impl, 2 review). Its one story took one CHANGES_REQUESTED round before its PASS. Repo-wide, 212 reviews parse, 210 end in PASS, and 39 carry kick-back history.
