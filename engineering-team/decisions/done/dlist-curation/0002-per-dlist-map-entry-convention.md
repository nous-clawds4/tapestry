# ADR 0002: Per-DList curation entries on the Treasure Map — shape, home, and reader/writer rules

**Status:** Accepted
**Date:** 2026-09-10
**Story:** `engineering-team/stories/dlist-curation/2-per-dlist-map-entry-convention.md`

## Context

A docs-mode story: the deliverable is spec prose plus pointers, not code. The story's acceptance
criteria, quoted back in short: **AC-1** the entry `["<kind>:<d-tag>", <assistant>, <relay>]`
(kind 39998 or 39999) and the reconstruction rule `<kind>:<assistant>:<d-tag>`; **AC-2** the
header contract (assistant-authored, same d-tag, `b` to the community header typed per the
registry, names/description/schema copied at creation, header-before-entry, never silently
re-pointed); **AC-3** reader rules (first-colon split, `dlist-header` reserved, one entry per
(kind, d-tag), first occurrence wins, unknown to NIP-85 readers); **AC-4** writer rules (append or
replace in place, everything else verbatim, fresh `created_at`); **AC-5** relay hint from
`settings.aRelays.aDListRelays[0]`; **AC-6** revocation by removal, header remains; **AC-7**
dual-author precedence untouched; **AC-8** this ADR; **AC-9** the pointers (BIBLE § Assistant
Keys, `protocols/README.md` row, the trusted-lists parse-rule cross-reference, handoff D9).

**What exists on the wire today.** Kind-10040 first elements are `"<kind>:<metric>"` (NIP-85,
`30382:*`), the bare-kind generic TL entry `"30392"` (ADR `tl-treasure-map/0001`, whose ratified
parse rule reads: split on `:` — one all-digits segment is a generic TL entry; two segments are
kind:metric or a named TL entry), and the specified-not-wired blanket designation
`"39998:dlist-header"` (`community-reference` ADR 0031, `protocols/drafts/assistant-designation.md`).
That draft's "Blanket scope" bullet says there is no per-concept entry and that "a future revision
could add finer-grained `39998:<…>` keys within this family without colliding" — this is that
revision, and the collision it must avoid is a DList whose d-tag is literally `dlist-header`.

**In-repo readers of 10040 first elements** (grep-verified this session): `ui/src/utils/treasureMap.js`
`classifyEntry` (regex `^(\d{5})(?::(.+))?$` — kind, then *everything after the first colon* as
the name; kinds outside 3038x/3039x classify `other`), `ui/src/pages/grapevine/SearchPreferences.jsx`
`parseMetrics` (`startsWith('30382:')`), `src/utils/customerManager.js`
`extractRelayPubkeyFromKind10040` (exact `"30382:rank"`). A `"39998:<d-tag>"` entry is already
tolerated by all three: displayed as `other` by the first, ignored by the other two. Story 6 gives
it a class; nothing breaks meanwhile.

**Where d-tags come from.** The community headers the panel will offer are kind-39998 self-declared
shared concepts fetched from the community relay (`ui/src/hooks/useCommunitySharedConcepts.js`);
their d-tags are slugs, but the codebase already tolerates colons in d-tags
(`ui/src/pages/shared-concepts/Detail.jsx:106` rejoins `parts.slice(2)`), so the parse rule must
split at the first colon only.

**The two known costs, carried from D8 of the handoff.** (a) The NIP-85 export generator
(`src/api/export/nip85/commands/create-unsigned-kind10040.js:71`) rebuilds the whole tag list from
config and would drop these entries along with the existing `30392` one — the merge-preserve fix is
the book's optional story 7 (book.md, last frame bullet). (b) NIP-85 is upstream; the entry stays a
local companion pre-NIP, optionally proposed upstream later.

**Concept orientation.** No concept, schema, or property changes; the story names none. The
assistant pubkey in the entry is the *signed-in user's* assistant (per-user, server-minted), never
the instance owner's TA and never a literal (CLAUDE.md § per-deployment TA pubkey; OPEN.md row 188).

## Options considered

### Option A — Section in `assistant-designation.md`; `["<kind>:<d-tag>", <assistant>, <relay>]`; reserve `dlist-header`

The per-DList entry lives in the draft that already owns the `39998:*` family on the Map, as the
second convention of that companion pre-NIP. First element `<kind>:<d-tag>` (two segments; the
header address is reconstructed as `<kind>:<assistant>:<d-tag>`); the blanket entry keeps its
literal by reserving `dlist-header` as a d-tag no per-DList entry may use. `trusted-lists.md`'s
parse-rule bullet gains one cross-reference sentence so its "two segments" wording no longer reads
as the whole grammar.

- **Pros.** Fits the ratified parse rule with no amendment — the entry *is* the "two segments"
  form; readers split at the first colon, which is also what `classifyEntry` already does. The
  pubkey appears once. The draft foresaw exactly this and said where it would go. NIP-85-shaped:
  kind, then an assertion-type string, then provider and relay. One home for everything a reader
  needs to resolve a user's assistant-authored headers (blanket and per-DList), next to the
  precedence rule they must apply afterwards.
- **Cons.** Reserving a word is a rule readers must know; a DList genuinely named `dlist-header`
  cannot be curated under this convention (accepted — the name is a protocol keyword now).

### Option B — `["39999:<a-tag of the community header>", <assistant>, <relay>]` (the kickoff's first shape)

- **Pros.** Names the community header directly in the Map, so a reader learns the target without
  fetching the assistant's header.
- **Cons.** Four colon-separated segments in the first element, breaking the ratified two-segment
  rule; the assistant pubkey appears twice (element 2 and inside the reconstruction) and the
  *community* pubkey appears where NIP-85 puts a metric name; and it fixes the target on the Map,
  whereas the target is a property of the header (its `b`), which the assistant may re-point under
  its own signature. Rejected at kickoff; recorded here so it is not re-litigated.

### Option C — Blanket entry only; per-DList empowerment carried elsewhere (e.g. a list on the assistant's side)

- **Pros.** No new Map grammar.
- **Cons.** The empowerment is the *user's* statement and must be user-signed; the Map is the one
  user-signed, npub-rooted, replaceable surface the stack already reads for exactly this kind of
  delegation. A separate user-signed event fragments discovery (the same reason ADR
  `tl-treasure-map/0001` rejected a separate TL-map event). Rejected.

### Option D — Home the section in `trusted-lists.md`'s Treasure-Map section

- **Pros.** That section owns the parse rule and the writer/reader idiom this entry reuses.
- **Cons.** The entry is not a Trusted List; a reader resolving DList headers would have to find
  the rule in a spec about 3039x lists, then jump to the designation draft for the precedence rule
  anyway. The cross-reference goes the other way. Rejected.

## Decision

We chose **Option A**. Ratified semantics — the spec section mirrors these, in spec voice:

1. **Wire shape.** `["<kind>:<d-tag>", "<assistant pubkey>", "<relay>"]`, kind `39998` or
   `39999` (the DList NIP keeps 39999-declared headers open); the curated header's address is
   `<kind>:<assistant pubkey>:<d-tag>`. Readers split the first element at the **first** colon;
   the remainder is the d-tag verbatim.
2. **Meaning.** The Map's owner empowers the named assistant to author and maintain that header on
   their behalf; the header is the owner's curation of the community DList its `b` tag names.
   Authorization is read from the Map; composition is read from the header.
3. **Header contract.** The addressed header is authored by the assistant; its `d` equals the
   community header's d-tag; it carries `["b", "<community header a-tag>", "<type>"]` with `<type>`
   per the inherit-from registry (the item-inheritance facet used by this deployment is ratified
   separately — `dlist-curation` story 3 amends this sentence to name it); names, description, and
   schema SHOULD be copied from the community header at creation. A writer MUST publish the header
   before the Map entry that addresses it, and MUST NOT re-point an existing header's `b` silently
   — an existing header with a different `b` is surfaced to the owner.
4. **Reserved word.** `dlist-header` is reserved for the blanket designation entry; a per-DList
   entry MUST NOT use it and readers MUST read `39998:dlist-header` as the blanket entry.
5. **Multiplicity, writer and reader rules.** Any number of per-DList entries may coexist, at most
   one per (kind, d-tag). Adding replaces the existing entry for that (kind, d-tag) in place or
   appends when none exists; every other tag is preserved verbatim; the update carries a fresh
   `created_at` (replaceable-event semantics). On duplicates, the first occurrence wins. Readers
   unaware of the convention ignore the entries.
6. **Relay hint.** A relay where the assistant-authored header and its items can be fetched. A
   Tapestry instance writing the entry fills it from `settings.aRelays.aDListRelays[0]`
   (runtime-resolved via `/api/relays`; default `wss://dcosl.brainstorm.world`), the empty string
   when unconfigured — the three-element shape is preserved.
7. **Revocation.** Republishing the Map without the entry revokes the empowerment. The header and
   its `b` remain on relays; no expiry field.
8. **Precedence.** The dual-author precedence rule is unchanged: a personally-signed
   `<kind>:<owner>:<d-tag>` governs over the assistant's; the per-DList entry names which assistant
   header stands in when the owner has none.

## Consequences

- **Enables** stories 4–6: the endpoint has a header contract to author against (§3), the panel has
  writer rules to compose by (§5, §6, §7), and Map Entries has a family to classify (§1, §4).
- **Constrains.** `dlist-header` is a keyword now. The blanket entry and the per-DList entries are
  distinguished by that word alone, so any future key in the 39998 family must also avoid it.
- **Cross-repo contract.** Federating readers and the Brainstorm client should adopt the same
  parse rule; the draft + this ADR are the reference, upstream propagation is worksheet-level and
  outside this book (as ADR `tl-treasure-map/0001` recorded for the TL entry).
- **Debt carried, not created.** The export generator's rebuild-from-config clobbers every non-30382
  entry (book.md's last frame bullet; handoff D8 cost (a)) — the more entries the Map carries, the
  more the fix matters. Story 3 will amend §3's type sentence; until then it names the registry only.
- **Firmware reinstall required?** **No.** No concept definitions change.

## Implementation notes

Docs-mode. The Implementer authors prose; "smallest change consistent with the ADR" = exactly
these edits, mirroring the Decision in spec voice and pointing at this ADR for rationale.

1. **`protocols/drafts/assistant-designation.md`**
   - Intro paragraph: "It adds one convention" → two conventions (the blanket designation entry and
     per-DList curation entries) plus the dual-author rule; "claims the `39998:*` assertion-key
     family" → claims the `39998:*` and `39999:*` families.
   - "The Tapestry Assistant designation entry" § "Blanket scope" bullet: replace the parenthetical
     "(A future revision could add finer-grained …)" with a pointer to the new section and the
     reserved-word rule.
   - New section **"Per-DList curation entries"** between "The Tapestry Assistant designation entry"
     and "Dual-author lookup and precedence": a field table (assertion key `<kind>:<d-tag>`, kind
     39998 or 39999; provider = the assistant; relay), the reconstruction rule, meaning (§2), the
     header contract (§3, with the registry-typed `b` sentence and the two MUSTs), the reserved word
     (§4), multiplicity + writer/reader rules (§5), relay hint (§6), revocation (§7), precedence
     pointer (§8), and one worked example: `["39998:dogs", "<assistant>", "wss://dcosl.brainstorm.world"]`
     → header `39998:<assistant>:dogs` carrying `["b", "39998:<community>:dogs", "<type>"]`.
   - "Deployment status (not normative)": add that per-DList entries are being wired by
     `dlist-curation` stories 4–6 (endpoint, panel, Map Entries) and that the blanket entry's
     status is unchanged.
2. **`protocols/drafts/trusted-lists.md`** — Treasure-Map advertisement § "Shape" bullet: append
   one sentence: the `39998`/`39999` families (blanket designation, per-DList curation entries) are
   specified in the assistant-designation draft; readers split the first element at the first
   colon and treat the remainder as opaque.
3. **`BIBLE.md` § Assistant Keys (`:1079`)** — amend the "TA designation on kind 10040" paragraph in
   place: after the blanket-entry sentence add "Per-DList curation entries `["<kind>:<d-tag>",
   <assistant>, <relay>]` (this book, `dlist-curation` ADR 0002) live in the same draft"; extend
   the **Status today** sentence: the blanket entry remains unwired; per-DList entries are wired by
   `dlist-curation` stories 4–6.
4. **`protocols/README.md:61`** — row scope phrase: "Tapestry Assistant Designation & Dual-Author
   Header Resolution (companion to NIP-85) + per-DList curation entries"; last column adds
   "`dlist-curation` #2"; status cell unchanged.
5. **`docs/B_TAG_AFFILIATION_DESIGN_HANDOFF.md`** — § 1 after D8: **D9 — Per-DList curation entries
   on the 10040** (the decision in three or four bullets, pointing here); § 4 O2's resolution note
   gains "per-DList entries added by `dlist-curation` ADR 0002, reserving `dlist-header`". Status
   line stays 🔴 OPEN.
6. **`protocols/drafts/tapestry-concepts.md:49`** — unchanged (the precedence pointer stays accurate).
7. **Story file** — link this ADR under Linked artifacts (done at the Architecture commit).

No `test/` changes: docs-mode, Test Design skipped; the Reviewer runs `npm test` as a regression
check only and audits accuracy and cross-references (claims-adherence table).

## Out of scope

- The `b` type for the header's pointer (story 3 — `inherit-items`).
- Any code (stories 4–7), including the merge-preserve fix.
- Upstream NIP-85 proposal; Brainstorm-client adoption.
- Semantics of 39999-declared headers beyond the reconstruction rule.
