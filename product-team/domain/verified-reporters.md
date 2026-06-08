# Domain Model: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07
**Modeler phase:** Domain Modeling (Phase 4)

> Conceptual model only — what the product knows about, not how it stores it. No tables, columns, foreign keys, or indexes.

**Orientation note (concept graph @ `localhost:7778`, TA `e00ed090…df36`):** This feature reuses existing concepts wherever possible. `nostr-user`, `web-of-trust`, `graperank`, `nostr-event`, and `nostr-kind` already exist in the graph. The NIP-56 Report (as a domain noun) and the Point of View lens are application-level concepts not currently represented as concept-graph nodes. "Observer," "observed user," and "verified reporter" are **roles** a `Nostr User` plays, not separate entities.

## Entities

### Nostr User
- **Description:** An account on the network, identified by its public key, that can follow, report, and be observed.
- **Concept mapping:** `39998:e00ed090…df36:nostr-user` (existing)
- **Roles in this feature (not separate entities):** *observed user* (the profile being viewed), *observer* (whoever is viewing, whose PoV the count reflects), *reporter* (a user who has filed a report).
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | public key | text | yes | Stable identity. |
  | display name | text | no | For showing reporters in the list. |
  | (other profile details) | — | — | Out of scope; owned by the existing profile, not this feature. |

### NIP-56 Report
- **Description:** A published flag in which one Nostr User formally reports another, per NIP-56.
- **Concept mapping:** new as a domain noun. *Is a* `nostr-event` (existing) of `nostr-kind` 1984 (existing concept; kind 1984 is the report kind).
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | reporter | ref:Nostr User | yes | The author of the report. |
  | subject | ref:Nostr User | yes | The user being reported (the observed user, in this feature). |
  | report type | text | no | The NIP-56 category (spam, impersonation, illegal, etc.). **Captured but not surfaced or split in the MVP** — all types are counted in one pot. Present so Phase 2 can split without remodeling. |
  | created at | date | yes | When the report was published. |
  | source event | ref:nostr-event | yes | The underlying signed event the report is read from. |

### Point of View (PoV)
- **Description:** The trust lens through which "verified" is judged — whose web of trust is being applied when counting reporters.
- **Concept mapping:** new as an explicit lens; *resolves to* a `web-of-trust` (existing) scored by `graperank` (existing). Not currently a concept-graph node.
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | kind | text | yes | `personal` or `house`. |
  | owner | ref:Nostr User | no | The observer whose WoT this is. Absent when kind is `house`. |
- **Note:** The **House PoV** is the platform's default observer lens, used only when the viewer has no calculated personal WoT available. It is the closest thing to a shared baseline — used sparingly, never presented as a global truth.

### GrapeRank Score
- **Description:** The personalized trust score of one Nostr User as computed within a given PoV; it is what makes a reporter "verified."
- **Concept mapping:** `39998:e00ed090…df36:graperank` (existing)
- **Attributes:**
  | Attribute | Type | Required | Notes |
  |---|---|---|---|
  | subject | ref:Nostr User | yes | The user being scored. |
  | pov | ref:Point of View | yes | Whose lens produced the score. |
  | score value | number | yes | The trust score. |
  | is verified | (derived) boolean | yes | True when the score meets the platform's verification criterion — the **same "verified" threshold already used by Verified Followers**. Not re-derived here. |

## Relationships
Named and directional.

- Nostr User (reporter) **files** NIP-56 Report.
- NIP-56 Report **targets** Nostr User (subject).
- Point of View **belongs to** Nostr User (observer) — or is the House PoV when none is available.
- GrapeRank Score **scores** Nostr User **within** Point of View.
- Nostr User **is verified within** Point of View — derived: the user's GrapeRank Score in that PoV meets the verification criterion.

## Derived view — the feature itself
Not stored; computed on demand. Stated here because it is the heart of the product's world.

- **Verified Reporters of an observed user, relative to a PoV** = the set of Nostr Users who (a) **file** a NIP-56 Report **targeting** that observed user, and (b) **are verified within** that PoV.
- **Verified Reporters count** = the size of that set. By construction, **count = list length** under one PoV.
- This is the exact negative-signal parallel of **Verified Followers** (verified users who *follow* the observed user) — same shape, swapping the "follow" relationship for the "report" relationship.

## States and lifecycle

- **PoV resolution (per observer, per view):** `personal WoT available → use personal PoV` → otherwise → `House PoV fallback`. This single transition is what the Cautious Newcomer experiences and what must be made legible.
- **Verified status is dynamic, not fixed:** a reporter can move `unverified ↔ verified` as the observer's web of trust is recomputed (degrees of separation shift). The count is therefore a function of *both* the report set and the live WoT — not a stored tally.
- **NIP-56 Report:** effectively immutable once published (it is a signed event); conceptually `present` or `absent` (a report may later be deleted/retracted via standard nostr deletion). No richer state machine in the MVP.

## New vs. existing (Tapestry products)
- **Maps to existing concepts:** Nostr User (`nostr-user`), Web of Trust (`web-of-trust`), GrapeRank Score (`graperank`); the NIP-56 Report *is a* Nostr Event (`nostr-event`) of a Nostr Kind (`nostr-kind`, kind 1984).
- **Genuinely new (application-level, not currently concept-graph nodes):** the **NIP-56 Report** as a domain noun, the **Point of View** lens with its House fallback, and the **derived Verified Reporters view** (count + list). Whether any of these become concept-graph nodes is an engineering decision, not a domain one.

## Named-but-not-modeled (deferred per scope)
These are intentionally *not* modeled — named only so later phases know where they live.

- **Report-type breakdown** (the `report type` attribute, split and surfaced) → Phase 2.
- **Reporter quality / pile-on tag** on a Nostr User → Phase 3.
- **Reporter-visibility / privacy controls** (self-view retaliation mitigation) → Phase 4.
- **Inheritor surfaces** (moderator, transactor) → Phase 5.
