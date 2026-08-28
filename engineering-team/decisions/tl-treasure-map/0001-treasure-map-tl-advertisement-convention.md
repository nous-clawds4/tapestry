# ADR 0001: Treasure-Map TL-advertisement convention

**Status:** Accepted
**Date:** 2026-08-27
**Story:** `engineering-team/stories/tl-treasure-map/1-treasure-map-tl-advertisement-convention.md`

## Context

A kind-10040 Treasure Map (upstream NIP-85) is the entry point to a user's Grapevine: each tag
delegates one Trusted-Assertion kind+metric to a publisher, shaped
`["30382:rank", <pubkey>, <relay>]`. Tapestry's Trusted List family
(`protocols/drafts/trusted-lists.md`, 📝 pre-NIP; kinds 30392–30395, the `+10` analog of NIP-85's
3038x) defines the lists themselves but **no Treasure-Map advertisement** — a Map cannot yet say
"my Trusted Lists are published by pubkey P, findable at relay R."

The operator's product model (kickoff 2026-08-27): **one pubkey publishes all of an owner's
pubkey Trusted Lists**, so the advertisement should not enumerate list names. Individual named
lists are dynamic and unbounded (pinned-tag TLs mint one `d` tag per observer×tag), so per-list
enumeration in the Map cannot be complete and would bloat a replaceable event that other tools
(the Brainstorm client at brainstorm.world) also manage.

Constraints: 10040 is a replaceable kind — publishing a new version replaces the old at each
relay, so any update must carry the full tag set and a fresh `created_at`. Existing 10040s in the
wild carry `"<kind>:<metric>"` first elements; whatever we add must be mechanically
distinguishable from those. The TA pubkey and relay lists are per-deployment and must be resolved
at runtime (CLAUDE.md; `settings.aRelays` via `/api/relays`, TA pubkey via
`/api/assistant/pubkey` / `ConfigContext`).

## Options considered

### Option A — generic bare-kind entry (one delegate per TL kind)

`["30392", <pubkey>, <relay>]` — the first element is the decimal TL kind as a string, with no
`:name` suffix. One entry delegates **all** lists of that kind. Stated for the whole family
(`"30393"`, `"30394"`, `"30395"` follow identically); this book exercises only `30392`.

- **Pros:** matches the product model (one publisher for all pubkey TLs); constant-size
  advertisement regardless of how many lists exist; trivially parseable — a first element
  matching `/^\d{5}$/` is a generic TL entry, `"<kind>:<suffix>"` stays NIP-85-shaped; leaves a
  natural upgrade path (named entries later override the generic).
- **Cons:** coarse — a user cannot delegate different lists to different publishers today;
  readers must learn one new rule (bare kind ⇒ generic delegation).

### Option B — named per-list entries

`["30392:<list-id>", <pubkey>, <relay>]`, one per list, mirroring NIP-85's kind:metric shape
exactly.

- **Pros:** maximum granularity; no new parse rule.
- **Cons:** list ids are dynamic and unbounded — the Map can never be complete and must be
  republished as lists appear; bloats a replaceable event co-managed by external tools;
  contradicts the one-publisher product model. Rejected as the *primary* mechanism; reserved as
  the **future override** layer on top of Option A.

### Option C — a separate advertisement event kind

Leave 10040 untouched; publish a dedicated replaceable event ("TL map") advertising TL
publishers.

- **Pros:** no risk to the co-managed 10040.
- **Cons:** fragments discovery — NIP-85-aware consumers already fetch 10040 as *the* entry
  point; a second event doubles the fetch-and-reconcile surface and abandons the colocation that
  makes the Treasure Map a treasure map. Rejected.

## Decision

We chose **Option A** — the generic bare-kind entry, with Option B's shape reserved as the future
named-override layer (recognized, inert today).

Ratified semantics:

1. **Wire shape:** `["<TL-kind>", <pubkey>, <relay>]`; first element the decimal kind as a
   string (`"30392"`). Parse rule: split the first element on `:` — one segment that is all
   digits ⇒ generic TL entry; two segments ⇒ NIP-85 kind:metric (3038x) or a named TL entry
   (3039x, future).
2. **Meaning:** the advertised pubkey publishes the Map owner's Trusted Lists of that kind —
   lists computed under the owner's point of view — discoverable at the relay hint.
3. **Writer semantics:** at most one generic entry per TL kind. An opt-in switch **replaces**
   the existing generic entry for that kind; every other tag is preserved verbatim; the update
   carries a fresh `created_at` (replaceable-event semantics).
4. **Reader semantics:** on duplicate generic entries for one kind, the first occurrence wins.
   A named entry (`"<kind>:<name>"`) will, once specified, override the generic entry for that
   list only; until then readers treat named 3039x entries as unrecognized (they display as
   Trusted List entries but drive no behavior).
5. **Relay hint:** a relay where the advertised publisher's lists of that kind can be found.
   When this Tapestry instance advertises its own TA, the hint is
   `settings.aRelays.aTrustedListRelays[0]` (default `wss://nip85.brainstorm.world`), read at
   runtime via `/api/relays` → `ConfigContext.aRelays`; if the list is unconfigured or empty,
   the entry carries an empty-string hint (shape preserved).

Relay-hint source alternatives considered: a new "self relay URL" setting (rejected — new config
surface duplicating intent `aTrustedListRelays` already expresses, and localhost dev has no
public self-URL); always-empty hint (rejected — wastes the slot NIP-85 gives consumers).

## Consequences

- Stories 2–3 have a ratified shape to render and to write: the salient check is "does a generic
  `30392` entry exist, and is its pubkey this instance's TA (runtime-resolved)?"
- **Cross-repo contract:** the Brainstorm client (brainstorm.world) and federating readers
  should adopt the same parse rule. This ADR + the spec section are the reference; propagating
  it upstream is a named follow-up outside this repo (worksheet-level, not this book).
- The bare-kind string is now load-bearing: tooling that assumed every 10040 first element
  contains `:` must use the parse rule. Grep-verified blast radius — the repo has exactly two
  existing 10040 tag readers, both unaffected because both filter before parsing:
  `ui/src/pages/grapevine/SearchPreferences.jsx` `parseMetrics` (keeps only
  `startsWith('30382:')`) and `src/utils/customerManager.js`
  `extractRelayPubkeyFromKind10040` (exact-match `"30382:rank"`). A bare `"30392"` element
  matches neither predicate and is ignored by both.
- Deferred debt: named-override semantics (activation, precedence details beyond §4) —
  explicitly future work; the section documents the reservation only.
- This ADR does **not** guarantee the TA's TLs actually reach the hinted relay — that belongs to
  the TL-publication pipeline (strfry router / publishers), unchanged here.
- **Firmware reinstall required?** No — no concept definitions change.

## Implementation notes

Docs-mode implementation (this story):

- File: `protocols/drafts/trusted-lists.md` — add a `## Treasure-Map advertisement (kind 10040)`
  section between "Completeness & the partial signal" and "Current members of the family",
  carrying §§1–5 of the Decision verbatim in spec voice, one worked example tag, and the
  named-entry reservation note.
- File: `protocols/README.md` — Trusted Lists row: append "+ Treasure-Map advertisement" to the
  scope phrase if the row's wording would otherwise misdescribe the draft. No status change
  (stays 📝 pre-NIP, working copy here).

Consumer guidance (stories 2–3, not this story): parse helper + tag-upsert live client-side
(suggested `ui/src/utils/treasureMap.js`): `classifyEntry(tag)` →
`{kind, name|null, class: 'ta'|'tl'|'other'}` and `upsertGenericTlTag(event, kind, pubkey,
relay)` returning the updated unsigned event with all other tags preserved. TA pubkey from
`ConfigContext.taPubkey`; relay hint per §5; publish via `window.nostr.signEvent` +
`publishEverywhere` (`ui/src/utils/nostrPublish.js`), subject to the global publish gate.

## Out of scope

- Named-entry override activation and precedence details (future ADR when named TLs ship).
- Any change to TL kinds, `d`-tag conventions, or list content (`trusted-lists.md` §§ above the
  new section are untouched).
- Brainstorm-client adoption and upstream NIP work.
- TL propagation/routing to the hinted relays.
