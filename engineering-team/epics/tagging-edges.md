# Epic: tagging-edges — NostrUser→NostrUser relationships that reflect Taggings

**Status:** Active
**Created:** 2026-09-26
**Book:** `engineering-team/audits/tagging-edges/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-09-25 ("if Alice Tags Bob as a Podcaster, then I would like there to be
a neo4j relationship from Alice to Bob"), broken into stages at kickoff on 2026-09-26. It sits beside the
FOLLOWS / MUTES / REPORTS social graph and its ETL, and is a narrow, tagging-only relative of the general
strfry→Neo4j letter ingest (OPEN.md #136 stage 2), which it does not attempt.

## Goal

**Neo4j carries one relationship per tagging, from the tagger to the tagged person, kept current in real time
and repaired retroactively, and the owner can manage that pipeline from the control panel.** Today no tagging
reaches Neo4j at all; every tag surface scans the relay per request.

## Stories

`stories/tagging-edges/`. All four are features (Standard: all five phases).

1. `1-tagging-edge-contract.md` — what one relationship is: which events count, what the relationship carries,
   which version of a tagging stands, what a revoke removes; documented in BIBLE. No relationship is written yet.
2. *(planned)* The gap-filling pass and backfill — writes the relationships, enforces one-per-tagging in the
   database, repairs drift, refuses to mass-delete on a failed or empty relay read. Its first run is the
   backfill.
3. *(planned)* The real-time path — reflects new taggings, stance changes and revokes within seconds to
   minutes, from every path an event can reach the relay, independently of the follows pipeline.
4. *(planned)* The control panel — status, counts, relay-vs-graph drift, start / stop, gap-fill on demand;
   owner-only.

Order: 1 → 2 → 3 → 4 (4's page can start once 2's status shape is fixed).

## Key facts / guardrails

- **Taggings are not follows.** A follow list is one event per author and replaces the author's whole set; a
  tagging is one replaceable event per (tagger, target, tag) address. Copying the follows pipeline's
  replace-the-set logic, or its since-window diff, would delete a tagger's other taggings.
- **Two ways to un-tag.** A dispute republishes the same address with polarity -1 (a stance, kept); a revoke is
  a NIP-09 kind-5 deletion, which the relay honours by removing the event. Neither existing ETL leg reads
  kind 5 today.
- **The census (2026-09-26, prod / staging / tags — read-only):** ≈6,970 taggings on each host; ~91% are test
  fixtures (slugs carrying a millisecond timestamp); the real set is 595 taggings by 59 taggers about 349 people
  across 77 tags. 97% name their tag only by event id (e-only); 233 carry the tag's address; all but 6 resolve
  to a tag element present on the relay. Polarity: 4,938 apply / 1,759 dispute / 242 absent / 33 neutral "0".
  Exactly one `p` per event, always 64-hex; 62 self-taggings.
- **POV stays at read time.** The relationship stores a raw assertion — never a trust score, count, rank, tag
  name or "applied" flag (CLAUDE.md principles 1–3). Fixture and unknown-author taggings are accepted like any
  signed event; read-time trust filtering is what excludes them (principle 2).
- **Principle 4.** The relationships are re-derivable projections of relay events (BIBLE §30), but provenance
  marking does not exist yet: every delete must be scoped to this relationship type and a specific tagging, and
  a failed or empty relay read must never be taken as "everything was revoked".
- **The z namespaces.** Taggings carry the canonical `nostr-user-tag` concept stamp (the ADR 0015 literal,
  identical on every deployment) and, since 2026-06-17, also this deployment's own (runtime TA). Any use of the
  TA pubkey other than the ADR 0015 literal resolves it at runtime.
- **A writer refuses to start without both stamp pubkeys** (ADR 0001, review round). A writer started without the
  canonical or local pubkey would read every tagging as a non-tagging and retire every edge; story 2 checks both
  are 64-hex at startup, and its mass-delete guard counts retirements per run.
- **Known defects in the follows pipeline stay out of this epic** (the relay-websocket gap in the strfry patch,
  the Redis client that never reconnects, at-most-once delivery, the stream and reconcile writers disagreeing
  on REPORTS' shape): they have ledger rows and are not copied — OPEN.md rows
  `2026-09-27-strfry-redis-misses-websocket-writes`, `2026-09-27-strfry-redis-never-reconnects`,
  `2026-09-27-stream-consumer-at-most-once` and `2026-09-27-reports-writers-disagree-on-shape`.
