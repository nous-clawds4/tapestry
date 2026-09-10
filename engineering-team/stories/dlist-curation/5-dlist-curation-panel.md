# Story 5: The DList Curation panel — search a community DList, empower your assistant, revoke

**Status:** Approved
**Created:** 2026-09-10
**Type:** Feature

## Background
The TA Treasure Map page now folds its Trusted Lists panel to a one-line status (story 1), the
per-DList Map entry and the `inherit-items` facet are ratified (stories 2–3), and the server can
author the signed-in user's assistant header for a chosen community DList (story 4,
`POST /api/dlist-curation/header`, returning the signed header, whether it pre-existed, and
per-destination publish outcomes; 409 with the existing `b` when a different pointer stands). What
is missing is the surface the operator asked for at kickoff: a second collapsible panel on the
Treasure Map page, "DList Curation", where a user searches the community's self-declared shared
concepts, adds one at a time — header first, then the Map entry signed with NIP-07 — and revokes per
entry.

Facts the story rests on (all read this session): the community headers come from the same source
the Shared Concepts pages use (`useCommunitySharedConcepts`: rows with coordinate, name, description,
author, created-at, fetched from the community relay); the Map is user-signed and republished whole
(ADR `tl-treasure-map/0001`; `upsertGenericTlTag` is the writer pattern); the delegate is the
signed-in user's assistant, never the instance owner's (OPEN.md row 188); ADR 0002's writer rules
(one entry per kind and d-tag, replace in place or append, everything else verbatim, fresh
`created_at`; revoke = republish without the entry, the header stays); the relay hint is the first
entry of the DList relay group.

## User-facing description
As a signed-in user with a provisioned Tapestry Assistant, on my Treasure Map page I want a folded
"DList Curation" panel that opens to a keyword search over the community's shared DLists, lets me
add one at a time — my assistant authors its header, then I sign the Map entry — shows me which
lists I have already empowered it for, and lets me revoke any of them, so that I can build my own
curation of community lists without ever duplicating their items and without my Map pointing at a
header that does not exist.

## Acceptance criteria
- [ ] **AC-1 (the panel, folded).** Below the Trusted Lists panel, a second panel with the same
      disclosure behavior as story 1: collapsed on every load; the collapsed line reads
      "DList Curation" plus a status label — the number of DLists currently empowered on the Map
      ("3 DLists curated"), or "None yet". Keyboard and mouse toggle; nothing of the body renders
      while folded. A viewer with no provisioned assistant gets no panel (as with the Trusted Lists
      panel).
- [ ] **AC-2 (explains itself).** Expanded, one short paragraph says what empowerment means:
      your assistant authors a header in its own namespace that inherits the community list's
      items, and your Treasure Map records the empowerment — operator copy, to be settled at the
      gate; the proposed text is in Open questions.
- [ ] **AC-3 (search).** A keyword box filters the community's self-declared shared concepts
      (the same source and dedupe as the Shared Concepts pages) by name, description, and d-tag,
      case-insensitively; results show name, description, author, and an Add control. Headers
      authored by the signed-in user or by their assistant never appear. Loading and empty states
      are explicit.
- [ ] **AC-4 (already empowered).** A result whose `39998:<d-tag>` entry is already on the Map
      pointing at **my** assistant is marked "In your Map" with Add disabled. One pointing at a
      **different** assistant pubkey is marked as such (short pubkey shown) and Add reads
      "Replace" — adding replaces that entry in place, leaving the other assistant's header
      untouched.
- [ ] **AC-5 (add: header first).** Add calls the story-4 endpoint for the chosen header and shows
      the outcome inline: created or already existed; local ok; each relay ok / failed / skipped
      with its reason. A 409 shows the existing pointer(s) verbatim with the sentence that the
      header was not re-pointed, and stops. Any other failure is shown inline and stops; the Map is
      untouched.
- [ ] **AC-6 (add: then the Map).** On endpoint success the panel composes the updated Map —
      `["39998:<d-tag>", <my assistant pubkey>, <first DList relay, or empty string>]` replacing
      the existing entry for that kind and d-tag in place or appended, every other tag preserved
      verbatim, fresh `created_at` per the skew rule — offers a preview of the exact unsigned event
      (as the Trusted Lists panel does), and on "Sign & publish" signs it with NIP-07 as the
      signed-in user (drift-guarded) and publishes through the same local-plus-external path the
      Trusted Lists panel uses, inheriting the deployment's publish gate. On success the page
      re-runs its Map search and the result now reads "In your Map".
- [ ] **AC-7 (the list of empowered DLists).** The panel lists every per-DList entry on the Map
      (kind 39998 or 39999) with its d-tag, the assistant it names (mine / another, short pubkey),
      the relay hint, and — when the header can be found in local strfry — its name and a link to
      the DList's page; entries whose header cannot be found locally say so.
- [ ] **AC-8 (revoke).** Each empowered entry has a Revoke control: it composes the Map without
      that entry (everything else verbatim, fresh `created_at`), previews, signs, publishes, and
      re-runs the search — with the copy that the assistant's header stays on relays. Revoking an
      entry that names another assistant is allowed (it is my Map).
- [ ] **AC-9 (honest, never corrupting).** Every failure — endpoint, signer declined or drifted,
      publish — surfaces inline in the panel; the Map on screen stays the found event until a
      publish succeeds; no step runs out of order (never the Map before the header exists).
- [ ] **AC-10 (nothing else moves).** The Trusted Lists panel, relay presence, Map Entries, the
      raw-event toggle, the hand-edit panel, and the no-Map path are unchanged. Map Entries'
      classification and links for these entries are story 6's.

## Concepts touched
- `39998:<TA>:shared-concept` — shared concept (the community headers searched; per-deployment
  TA pubkey, resolved at runtime)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the delegate named on the Map: the
  signed-in user's own)

## Out of scope
- Map Entries' class, labels, and links for per-DList entries (story 6).
- Any change to the endpoint (story 4) or the Map conventions (stories 2–3).
- Curating the list's items (the later curation feature); adding a `pointer` `b` for affiliation.
- Kind-39999 community headers (the endpoint refuses them; the panel lists 39999 entries if the
  Map already carries them, but cannot add them).
- Deleting the assistant's header on revoke.
- Persistence of the panel's open state.

## Open questions
None — settled at the story gate (2026-09-10): the AC-2 copy stands as proposed ("Empower your
Tapestry Assistant to curate a community DList on your behalf. Your assistant authors its own
header for the list — inheriting the community's items, never duplicating them — and your Treasure
Map records that you empowered it."); the AC-1 labels are "N DLists curated" / "None yet" (singular
"1 DList curated"); the add is two-step (Add → outcome and preview → Sign & publish).

## Linked artifacts
- ADR: `engineering-team/decisions/dlist-curation/0005-dlist-curation-panel.md`
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
