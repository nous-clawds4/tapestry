# Book of Work: Tagging edges — NostrUser→NostrUser relationships that reflect Taggings

**Slug:** tagging-edges
**Status:** Open
**Opened:** 2026-09-26
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask of 2026-09-25, restated at intake and confirmed at kickoff
(2026-09-26: "Story 1 end to end; go ahead with the prod counts; shape looks good.").

The owner's words, verbatim:

> The neo4j database with NostrUser nodes and follow, mute, and report relationships gets pupulated using an
> ETL pipeline. It is rather intricate because it needs to keep up with strfry data in real time, but it also
> needs to retroactively fill in any missing gaps that may have been missed in real time. I would like to
> augment neo4h with relationships between NostrUser nodes that reflect Taggings. For example: if Alice Tags
> Bob as a Podcaster, then I would like there to be a neo4j relationship from Alice to Bob to reflect that
> Tagging.
>
> In this session, I would like to break down this hefty task into stages. First, we will need to design the
> structure of the neo4j relationship, and probably record that update to the neo4j schema in the appropriate
> place in the documentation. Then will will have to design the ETL pipeline, which will require multiple
> modules, as well as front end to manage it. It would probably make sense to review the existing ETL pipeline
> including its front end controls, and emulate what makes sense.

**Settled at kickoff (2026-09-26):** one relationship per tagging, named `TAGS`, from the tagger's NostrUser to
the tagged person's NostrUser, carrying the raw stance (disputes kept, not dropped) and which tag — no trust,
counts or names on the relationship. A read-only census of production, staging and tags.brainstorm.world was
authorized and taken the same day (numbers in story 1's Background).

### Acceptance frame

- [ ] **The relationship exists and is documented.** For each tagging (a kind-39999 `nostr-user-tag`
      assertion) in this instance's relay, Neo4j can hold exactly one relationship from the tagger's NostrUser to
      the tagged person's NostrUser, carrying the tagging's stance and which tag it applies; BIBLE's Neo4j data
      model describes it alongside FOLLOWS / MUTES / REPORTS.
- [ ] **Retroactive fill.** A gap-filling pass brings Neo4j into agreement with the relay for every tagging —
      including history that arrives late (relay sync, router backfill) and revokes that were missed — and never
      mass-deletes relationships on a failed or empty relay read.
- [ ] **Real time.** New taggings, changed stances and revokes show up in Neo4j within seconds to minutes,
      without operator action, from every path an event can reach the relay.
- [ ] **Front-end controls.** The owner can see and manage the tagging pipeline from the control panel — its
      status, counts, the drift between relay and graph, start / stop, and a gap-fill run on demand — in the
      style of the existing Streaming ETL controls. *(Amended 2026-09-30 at story 4's Planning, the owner: admins
      may also see the panel, turn the real-time path on and off, run a pass and stop one; confirming held removals
      stays the owner's. Delivered as story 4, the panel, and story 5, the controls.)* *(Amended 2026-10-01 at story
      5's Planning, the owner: the controls are split by what they act on. Story 5 is the real-time path's switch,
      and story 6 is the pass's run, stop and confirm.)*
- [ ] **Nothing else moves.** Follows / mutes / reports ingestion is unchanged; no trust, point-of-view or
      count is stored on the new relationships (principles 1–3); nothing locally authored in Neo4j is destroyed
      (principle 4, BIBLE §30).

## Epics in this book

- `tagging-edges` — the relationship contract, the gap-filling pass, the real-time path, and the control panel
  (`engineering-team/epics/tagging-edges.md`).

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —
- **Orientation:** a read-only mapping pass on 2026-09-25 (seven area readers, an adversarial fact-check of
  115 load-bearing claims — 98 confirmed, 15 corrected, 2 unverifiable — and a completeness critique) plus the
  2026-09-26 three-host census; findings carried into the epic's "Key facts / guardrails".

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/tagging-edges/audit.md`
- Product feedback: `engineering-team/audits/tagging-edges/prd-seed.md`
