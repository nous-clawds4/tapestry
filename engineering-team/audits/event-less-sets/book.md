# Book of Work: Event-less Sets

**Slug:** event-less-sets
**Status:** Closed
**Opened:** 2026-09-12
**Closed:** 2026-09-13
**Strictness:** Standard (project default, proposed at kickoff 2026-09-12; no Light profile).

## Intent anchor

**Acceptance frame (no PRD)** — the operator's ask of 2026-09-12, made while organizing the local-only
`firmware concept` concept into subsets: build a strfry-free way to create a set, then use it for the
remaining subsets, so they live in Neo4j as private thoughts (BIBLE §30) rather than as letters. Restated
at kickoff with the operator's three answers folded in: a new `node-primitives` epic; the new set is
registered as an element of the `set` concept; "done" means production plus one real use.

### Acceptance frame

- [ ] **Create a set without a letter.** A set can be created under an existing superset or set with no
      nostr event signed or stored, and it is registered as an element of the `set` concept.
- [ ] **It behaves like any other set.** It shows in the concept's Organization (Sets) view, holds
      members wired with `add-relationship`, and survives a firmware reinstall.
- [ ] **It stays private.** Publishing the concept to the community sends nothing for it.
- [ ] **Shipped and used.** Shipped local → staging → production like its sibling primitives, then used
      on this Mac Studio to create at least one of the remaining `firmware concept` subsets.

## Epics in this book
- `node-primitives` — strfry-free node-level primitives for the Neo4j reference graph, starting with
  event-less create-set (`node-primitives` #1).

## Known constraints acknowledged at kickoff
- **The local stack is shared.** Another session (branch `feat/curated-dlist-update`) is actively testing
  on this Mac Studio's Docker stack, which is not bind-mounted — code reaches the container by hand sync.
  Live checks, including a firmware reinstall, must not clobber it (precedent for an ephemeral scratch
  container: `scripts/brain-drill.sh`). Using the primitive here for the real subset (frame bullet 4)
  means deploying into that shared container — coordinate with whichever session is using it then.
- **No event-less node exists yet.** Every node in this graph has an event behind it today, and BIBLE §6
  still describes the `NostrEvent` label as "any imported nostr event"; this book adds the first node that
  doesn't. The "locally authored" marking §30 requires is the `self-ontology` epic's open work, and this
  book must not rule it out.
- **The first subset keeps its letters.** `firmware concepts for nostr` was made with the lettered
  `create-set` on 2026-09-12 (a set event plus a relationship descriptor, both in local strfry only); it
  is left as is.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** high — every frame bullet is met. A set is created with no letter and registered under `set` (in production, and used here). It behaves like any other set: Organization (Sets) and the counts were checked in the local UI, and the firmware-reinstall check passed on the scratch instance. It stays private (H8: the publish traversal leaves it out). It shipped local → staging (PR #658) → production (PR #659) and was used on this Mac Studio to create `firmware concepts for tags and tagging` (2026-09-13). The operator chose not to create the other seven subsets for now (audit §4 #8).

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/event-less-sets/audit.md`
- Product feedback: `engineering-team/audits/event-less-sets/prd-seed.md`
