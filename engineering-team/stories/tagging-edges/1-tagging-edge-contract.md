# Story 1: The tagging edge contract

**Status:** Approved
**Created:** 2026-09-26
**Type:** Feature

## Background

The owner wants Neo4j to carry a relationship from Alice's NostrUser to Bob's whenever Alice tags Bob (e.g. as a
Podcaster), kept current the way FOLLOWS / MUTES / REPORTS are (book `tagging-edges`). Before anything writes
such relationships, every later module — the gap-filling pass (story 2), the real-time path (story 3) and the
control panel's counts (story 4) — has to agree on the same answers: which events are taggings, what one
relationship carries, which version of a tagging stands, and what a revoke removes. The follows pipeline shows
what happens without that agreement: its stream and reconcile writers produce REPORTS in two different shapes.
This story settles those answers once, as a single tested conversion that later stories reuse, and writes them
into BIBLE — no relationship is written to Neo4j yet.

**Settled at kickoff (2026-09-26):** one relationship per tagging, named `TAGS`, from the tagger's NostrUser to
the tagged person's NostrUser; the tagging's raw stance is kept, disputes included; no trust score, count, rank,
tag name or "applied" flag rides on it.

**What the relays hold (read-only census, 2026-09-26 — production; staging and tags.brainstorm.world within a
few events of it):**

| | count |
|---|---|
| taggings (kind 39999, `nostr-user-tag` stamp) | 6,972 |
| — test fixtures (slug carries a ms timestamp) / real | 6,377 / 595 |
| names the tag by event id only / by address and id / by address only | 6,739 / 134 / 99 |
| tag reference resolves to a tag element on the relay / unresolvable | 6,966 / 6 |
| stance "1" (apply) / "-1" (dispute) / absent / "0" | 4,938 / 1,759 / 242 / 33 |
| carries only the canonical stamp / canonical + some deployment's own | 6,762 / 210 (production's own: 5) |
| target `p` tags per event | always exactly one, always 64-hex |
| self-taggings (tagger = target) | 62 |
| distinct taggers / targets (real subset) | 2,357 / 3,816 (59 / 349) |

Two ways to un-tag exist in the wild: a **dispute** republishes the same tagging with stance -1, and a **revoke**
is a kind-5 deletion (the UI's revoke names the tagging's event id; other clients may name its address).

## User-facing description

As the owner of a Tapestry instance, I want one agreed definition of the relationship that reflects a tagging —
which events produce one, what it records, which version wins and what a revoke removes, written down in BIBLE —
so that the pipeline stories that follow can build to it and never disagree about what a tagging edge is.

## Acceptance criteria

A tagging is an element of the nostr user tag concept; its content is described by that concept's schema,
`39999:<TA>:nostr-user-tag-schema` (`taggedPubkey` and `tagEventId` required, `tagAddress` optional). This
contract departs from the schema in three named ways, each because signed taggings in the wild do: (1) a
tagging that names its tag by address only — no event id; 99 in the census, content `tagEventId: null` — is
accepted (the schema's stale `required` gets a ledger row; changing the schema is out of scope); (2) the stance
is read from the event's `polarity` tag, per the Tags & Taggings draft protocol, which the schema does not
describe; (3) the target is read from the event's `p` tag, which the schema says `taggedPubkey` mirrors (the
census found no event where they differ).

- [ ] **AC-1 — every deployed tagging shape converts to a record of the same form.** Given a kind-39999 event
      with a `d`, a `nostr-user-tag` concept stamp (the canonical one, this deployment's own, or both), exactly
      one 64-hex `p`, and one tag named by address, by event id, or both, when it is converted, then the result is
      one record with: from = the event's author; to = the `p` pubkey (lower-case); identity = the tagging's
      replaceable address `39999:<author>:<d>`; the event id and `created_at`; the stance exactly as published
      ("1", "-1", "0", …) or *absent*; the tag's event id when the event names one; which of the two stamps the
      event carried; and the tag's address and slug (the slug is the address's last part — an identifier, never
      a display name) whenever the address is known — named by the event, or resolved from a supplied tag
      element whose event id the tagging names. When the tagging names only an id and that tag element is not
      supplied, the record carries the id, no address and no slug, and is marked unresolved; it never takes the
      address of a same-slug tag by another author.
- [ ] **AC-2 — anything else is refused with a reason; nothing is refused for who wrote it.** Given an event
      that is not a tagging — another kind, no `d`, no `nostr-user-tag` stamp, zero or several `p`, a `p` that
      is not 64-hex, no tag named, several different tags named (more than one distinct `a`, or more than one distinct
      `e`), or an `a` not of the form
      `39999:<64-hex>:<slug>` — then there is no record and a named reason, and the conversion never throws.
      Given a tagging from any author (unknown, untrusted, a test fixture), a self-tagging, a dispute, a neutral
      "0", an absent stance, or a tag that is not on this relay, then a record is produced.
- [ ] **AC-3 — one version of a tagging stands.** Given two versions of the same tagging (same identity), then
      the newer `created_at` stands, and on equal `created_at` the lower event id stands (NIP-01), whichever order
      the two arrive in; and when the standing version names a different target from the one it replaced, the
      outcome says so, naming the target that no longer holds this tagging.
- [ ] **AC-4 — a revoke removes only what it names, whenever it arrives.** Given a version of a tagging and a
      kind-5 event, then the revoke applies only if its author is the tagger and it names either that version's
      event id, or the tagging's address with a `created_at` no earlier than the version's. A revoke naming a
      superseded version, a later version, or signed by anyone else does not apply. The answer is the same
      whether the revoke is seen before or after the version it names.
- [ ] **AC-5 — BIBLE says what a tagging edge is.** BIBLE's Neo4j data model lists `TAGS` among the social
      relationships between NostrUser nodes — beside FOLLOWS, MUTES and REPORTS, which are named with their
      direction and source event kind only — giving `TAGS`' direction, source events, what identifies one, what
      it records, that an absent stance counts as apply, and the rules of AC-3 and AC-4; the glossary tells
      `TAGS` apart from the existing tag-array relationships (`HAS_TAG`, `NostrEventTag`); and the docs say
      plainly that no pipeline writes `TAGS` yet.

## Concepts touched

- `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-user-tag` — nostr user tag,
  canonical stamp (the ADR 0015 literal; present locally as a community-reference node). The concept whose
  elements are the taggings this story converts.
- `39998:<TA>:nostr-user-tag` — nostr user tag, this deployment's own stamp (runtime TA; locally
  `39998:8387ec0e9a1796d628688633c759ee5e3fb86587630beb03166e4e333a9a294f:nostr-user-tag`).
- `39999:<TA>:nostr-user-tag-schema` — the nostr user tag concept's JSON schema (the tagging content this
  contract reads; departures listed above the acceptance criteria).
- `39998:<TA>:tag` — tag (the tag elements a tagging applies); canonical stamp
  `39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:tag` alongside.
- `39998:<TA>:nostr-user` — nostr user (the relationship's two ends).
- `39998:<TA>:nostr-event-tag` — nostr event tagging: **not** touched; named so the Architect keeps the contract
  open to a later NostrUser→NostrEvent sibling.

## Out of scope

- **Writing any relationship to Neo4j**, and the database rule that enforces one relationship per tagging —
  story 2, where the first writer lands (the rule must exist before the first write).
- The real-time path (story 3) and the control panel (story 4).
- Event taggings (`nostr-event-tag`, NostrUser→NostrEvent) — a later sibling; this story only keeps the door open.
- Importing tag elements (or taggings) as event nodes — the general letter ingest, OPEN.md #136 stage 2.
- Any reader or feature that uses the relationships ("tagged by people you follow", taggers pages) — a Product
  Team question, with its own point-of-view decisions.
- Any change to follows / mutes / reports ingestion, or fixes to its known defects (ledger rows instead).
- Fixing BIBLE §6's older naming drift (e.g. `AUTHORED` vs the live `AUTHORS`) — a separate doc-lane change.
- Documenting FOLLOWS / MUTES / REPORTS' properties — their stream and reconcile writers disagree on them;
  that gets a ledger row, and AC-5 names those three by direction and source kind only.
- Cleaning the test-fixture taggings off the shared relays.
- Checking event signatures: the relay verifies them before storing an event, and every tagging this contract
  sees comes from the relay.

## Open questions

Settled by the owner at approval (2026-09-26):

1. **Self-taggings are kept** — a self-tagging produces a record (AC-2).
2. **The database rule for "one relationship per tagging" belongs to story 2**, where the first writer lands and
   the rule can exist before the first write.
3. **No `d`-format rule.** Every tagging in the census has a `d` beginning `profile-tag-`, but no current reader
   requires it; this contract does not refuse other `d`s — the identity is the address whatever the `d`.
4. **Code and BIBLE stay in one story**, per the project's practice of documenting in the same change.

Settled by the owner at the Architecture gate (2026-09-27):

- **`a` is the tag's identity.** When a tagging names its tag by address (`a`) and by id (`e`), the address is
  the tag and the id is provenance (ADR `profile/0022`); a mismatch between them is not a refusal. "Several
  different tags named" in AC-2 means more than one distinct `a`, or more than one distinct `e`.

Still open, for later phases:

5. For the Architect: a `relationship-type` concept (`39998:<TA>:relationship-type`) exists in the local graph;
   whether `TAGS` should be registered there is the Architect's call. Whether a relationship's NostrUser ends
   must exist before it is written is a story 2 question — the census could not measure how many taggers and
   targets already have NostrUser nodes on production (no host access from this machine).
6. For Test Design: the census shapes (address and id, address only, id only, dual stamp, neutral "0", absent
   stance, self-tagging) are the cases the tests should cover.

## Linked artifacts

- ADR: `engineering-team/decisions/tagging-edges/0001-tagging-edge-contract.md`
- Test plan: `engineering-team/stories/tagging-edges/1-tagging-edge-contract.test-plan.md`
- Review: (filled in after Review phase)
