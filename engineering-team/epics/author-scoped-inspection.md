# Epic: Author-scoped inspection

**Created:** 2026-09-20
**Status:** Done *(epic retired at the book close 2026-09-21; all four stories Done, review PASS, merged to `staging` as `a90011c4` via PR #714 and smoke-verified there. Active z-tags adopting the same treatment is recorded as a carry-forward, not open engineering work — reopen the way `tag-event-inspector` did if a second surface is taken up.)*
**Provenance:** Owner request in session 2026-09-20 (no intake entry — the request went straight
into stories, per workflow `0-intake` step 1). Book anchor at
`engineering-team/audits/author-scoped-inspection/book.md` (acceptance-frame book, opened
2026-09-20).

## Goal

**On the wire inspectors, show every author the relay holds — and let the reader choose whose
events they are looking at.**

The Active b-tags page answers `authors:[<owner TA>]`. That is the *first-person* query BIBLE §31
ratifies, and it is the right query for "what has this instance filed." It is the wrong query for
a page whose stated job is to inspect the wire: the relay holds b-tag events signed by other
instances' assistants and by ordinary accounts, and the page renders none of them. A reader cannot
tell the page is narrow, because nothing on it says whose view it is.

This epic widens the inspectors to every author, makes each row attributable, and gives the reader
two independent ways to narrow: **by person** (the owner, themselves, any customer — each carrying
both that person's own events and their assistant's) and **by kind of author** (assistants this
instance controls, the people who control them, everyone else).

## Why it matters

- **The page under-reports and never says so.** On this dev instance the table shows 13 rows while
  the relay holds 17 b-tag-carrying concept headers. The missing four are signed by an upstream
  firmware author, by production's assistant, and by a peer — exactly the federation evidence an
  operator opens a wire inspector to find.
- **It is the multi-tenant direction, being built.** BIBLE §31 § Scope states the direction — *"each
  provisioned persona's instance-side identity is its delegated key: the owner's is the TA; a
  customer's is their relay key"* — and marks it **not yet built, not yet normative**. This epic
  builds the read half of it. The instance already holds every assistant key it issued; it has
  never been able to answer "which assistants do I control, and for whom?" in one place.
- **Grouping is not conflation.** §31 insists the Owner is *"a correspondent, not an alias"* —
  privileged in trust, never merged in identity. A person filter that shows a human's events beside
  their assistant's does not merge them: every row still names its signer, and the author-type
  filter separates the two on demand. The view groups; the data never conflates. Any design that
  loses the distinction violates §31 and must be rejected.

## Stories

`stories/author-scoped-inspection/`:

1. **instance-assistant-roster** — the instance can answer, in one read, which assistants it
   controls and which account controls each one.
2. **every-author-on-active-b-tags** — the page stops filtering by the owner's assistant and shows
   every b-tag event in the local relay, with a column naming each row's author.
3. **narrow-by-person-and-by-author-type** — the two selectors, their default, and the
   no-assistant-key notice.
4. **mark-self-declaration-rows** — a row whose b-tag points at its own coordinate (a
   **self-declaration**) is visibly distinct and says so in its detail panel.

Stories 2 and 3 are a **shipping pair**: story 2 alone widens the page without giving the reader a
way back to a narrow view. Do not promote 2 beyond staging without 3.

## Concepts touched

- `39998:<TA>:concept-header` — concept header (the kind-39998 event behind every row).
- `39998:<TA>:shared-concept` — shared concept (what a b-tag points at).
- `39998:<TA>:tapestry-assistant` — tapestry assistant (*"nostr profiles that correspond to
  tapestry assistants"*). **Not** written by this epic: it is the future home for assistants this
  instance does **not** control, and it is named here so the Architect does not mistake the roster
  for a substitute. The roster covers instance-controlled assistants only.

The `<TA>` segment is per-deployment and resolved at runtime — CLAUDE.md § "Per-deployment TA
pubkey". On this dev instance it reads
`11f23fe40984a07be717d1628bdd0e87a2b4569f05dd7625923c20b89df93767`; on staging
`8e901369d45081cf05fe17ba802441dd731f73e000149c333daf4880a58e5fb1`. Neither is portable.

## Key facts / guardrails

- **Never hardcode the TA pubkey.** Every assistant pubkey in this epic is resolved at runtime.
  This epic makes the rule sharper, not looser: it introduces a page where *several* assistant
  pubkeys are in play at once, and the correct one for each purpose is always the one the server
  resolved, never a literal.
- **No private key material leaves the server.** The existing accessor for a customer's assistant
  keys returns the private key alongside the public one. The roster is a **public-key** surface;
  a reviewer who sees `privkey` or `nsec` on any response added by this epic must reject.
- **Publishing stays permissionless (invariant #2).** Widening the read must not acquire a
  write-side gate. Foreign-authored b-tag events are displayed, never validated for authorship
  and never rejected for being from an unknown author.
- **Narrowing is a view, applied at read time (invariant #3).** The person and author-type filters
  are applied when the table is rendered. Nothing derived from them is precomputed or stored per
  person.
- **Related open problem: worksheet W13.** Its resolution direction names a server-side singular
  resolver, main pubkey → delegated key (owner-TA / customer relay key / `null`). The roster is
  the plural form of the same question. These must not become two independent mappings — the
  Architect decides whether one grows out of the other, and records the choice.
- **A future BIBLE §31 Scope refresh is a carry-forward, not in-scope.** After this ships, "not yet
  built" is no longer accurate for the read half. Raise it at the book close; do not edit BIBLE
  from a code story.

## Out of scope (epic-level)
- Assistants this instance does **not** control — there is no mechanism yet to learn who controls
  a foreign assistant, and this epic does not invent one.
- Active z-tags. The shared components take opt-in additions so the sibling can adopt later.
- Any write path, any wire-format change, any change to what the b-tag detail (pair) page shows.
- Provisioning or repairing a missing assistant key. Story 3 reports the condition; fixing it is a
  named future surface.
- The unbounded-scan and comment-contradiction findings from the same session — deferred by the
  owner, recorded separately.
