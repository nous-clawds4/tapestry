# Story 2: The two headers — my assistant's DList header and the shared header it points to

**Status:** Done
**Created:** 2026-09-11
**Type:** Feature

## Background
Story 1 (Done) gave each curated DList a detail page that opens only for lists the signed-in
user's own assistant curates, and already looks up the assistant's header (this instance first,
then the Map entry's relay hint) to name the list. This story fills in the first two things the
operator asked the detail page to show (book frame bullets 3–4,
`engineering-team/audits/my-curated-dlists/book.md`): the assistant's header as a raw event with a
link to its Simple Lists entry, and the shared (community) header that header points to — also raw,
also linked — with a way to bring either header into this instance's strfry when it isn't there.

Facts the story rests on (read this session):
- The DList Curation endpoint (`dlist-curation` #4) writes exactly one
  `["b", <shared header coordinate>, "inherit-items"]` on the assistant's header; nothing prevents a
  hand-made or older header from differing.
- The Simple Lists detail page (`/tapestry/lists/<encoded coordinate>`) reads only this instance's
  strfry: a header that exists only on a relay shows "Event not found" there.
- On staging today both users' `dog-breed` assistant headers are in staging's strfry, but the shared
  header `39998:11f23fe4…:dog-breed` is not — it lives on the community relay
  (wss://dcosl.brainstorm.world). Staging will exercise the import path.
- `b-tag-deferred` is the protocol's reserved "deliberately unaffiliated" value
  (`protocols/drafts/inherit-from.md` § reserved value): consumers render it as its own state, never
  as a failed lookup.
- Importing an event into strfry writes no graph: the live strfry → Neo4j stream ingests only kinds
  3, 10000, and 1984 (book § Known constraints).

## User-facing description
As a signed-in user looking at a DList my assistant curates, I want to see the header my assistant
authored and the shared header it inherits from — each as its raw event, each with a link to its
Simple Lists entry, and with a warning when my assistant's header doesn't point where it should —
so that I can check exactly what my assistant published and what it builds on, and open either
list in Simple Lists.

## Acceptance criteria
- [ ] **AC-1 (my assistant's header).** A "Your assistant's DList header" section says where the
      header was found (this instance, or the relay it was fetched from) and that your assistant
      (short pubkey) authored it, and offers a "Show raw event" toggle — **hidden on every load** —
      that reveals the complete event as formatted JSON. When the header is in this instance's
      strfry, a link opens its Simple Lists entry (`/tapestry/lists/<encoded kind:pubkey:d-tag>`).
- [ ] **AC-2 (the pointer, checked).** The section names the shared header the assistant's header
      points to — its coordinate and pointer type — and says so plainly when it does not point where
      it should: no `b` tag; a `b` tag that is not a list coordinate; a type other than
      `inherit-items`; more than one pointer (and which one the page follows — the first); or the
      reserved `b-tag-deferred`, shown as "marked deliberately unaffiliated", not as an error. Each
      is a sentence on the page; nothing is fixed from here.
- [ ] **AC-3 (the shared header).** A "Shared DList header" section follows the pointer: it looks in
      this instance's strfry first, then on the community relay (the same one the DList Curation
      panel searches), says where it found the header, and offers a raw-event toggle — **closed on
      every load**. When the shared header is in this instance's strfry, a link opens its Simple
      Lists entry.
- [ ] **AC-4 (import to local strfry).** When either header was found only on a relay, its section
      offers "Import to local strfry": it writes that exact event — unmodified, as signed by its
      author — into this instance's strfry, then re-checks. On success the section reads "in this
      instance's strfry" and the Simple Lists link appears; on failure the error is shown in that
      section and nothing else changes. The import signs nothing, publishes to no external relay,
      and writes nothing to the graph.
- [ ] **AC-5 (not found, couldn't check).** If the assistant's header can't be found, its section
      says where it looked and the shared-header section says it can't tell which shared header
      without it; if the shared header can't be found, its section says where it looked. A lookup
      that failed reads "couldn't check", with where it tried — never "not found".
- [ ] **AC-6 (nothing else moves).** Story 1's list page and front door behave as before; the TA
      Treasure Map page and the Simple Lists pages are unchanged. The import in AC-4 is the only
      write this story adds.

## Concepts touched
- `39998:<TA>:list` — list (both headers are DList headers; TA pubkey per deployment, resolved at
  runtime)
- `39998:<TA>:shared-concept` — shared concept (the shared header the pointer names)
- `39998:<TA>:tapestry-assistant` — tapestry assistant (the author of the first header — the
  viewer's own)

## Out of scope
- The items table, the curation-method panel, and Update list (story 3).
- Fixing a header that points elsewhere (re-pointing, revoking, re-adding) — that stays with the TA
  Treasure Map page.
- Importing the shared list's items, or anything beyond the one header event.
- Changing Simple Lists (e.g., teaching it to read relays) — the operator chose the import path at
  kickoff.
- Checking whether the shared header is itself a self-declared shared concept.

## Open questions
None — settled at the story gate (2026-09-11): the import is offered for **both** headers whenever
one is found only on a relay (the frame named the shared header; the assistant's header is normally
local already, so this covers the edge case); the pointer problems AC-2 flags are exactly the five
listed, with `b-tag-deferred` as its own non-error state.

## Deviations
- **The sections take `info` and `checking` instead of `assistantPubkey`.** The page computes
  `describeCurationHeader` once (it needs the pointer for the shared lookup anyway) and passes it
  down; each section also gets its lookup's `loading` as `checking`, which is how the import control
  tells "re-checking…" from "the re-check finished and it is still not local" — ADR sub-decision 6's
  "if the re-check still does not find it locally, the section says so" (ADR note 3's signatures
  otherwise unchanged).
- **The shared section also names the shared header** (its `names[1]`, falling back to the d-tag)
  beside the short coordinate, so "dog breed · 39998:11f23fe4…:dog-breed" reads as a list, not a hash.
- **Live verification via the fetch-stub remount** (local stack, bundle `index-C4lzGt9g.js`): the
  real `dog-breed` detail — your assistant's header found only on dcosl with "Import to local
  strfry", "Authored by your assistant · 253d40c4…6ec0", "Points to 39998:11f23fe4…:dog-breed
  (inherit-items)", no problems; the shared header "dog breed" in this instance's strfry with "Open in
  Simple Lists →", which opened Simple Lists' "a list of dog breeds". Raw toggle: closed on load, opens
  to the full signed event, closes. Import (the publish endpoint stubbed — nothing written): a refusal
  reads "Import failed: stubbed refusal" and nothing else changes; a stubbed success re-checks and,
  since nothing landed, reads "Imported, but the re-check did not find it in this instance's strfry";
  the request carried the event as received (`adcc9abc…`, `signAs: client`). Synthetic headers (stub-
  injected into the local scan): three problems at once in order with the first coordinate followed
  and its shared header shown; `b-tag-deferred` as "deliberately unaffiliated" with "Can't tell which
  shared header: … is marked deliberately unaffiliated"; no `b` → "names no shared header"; a pointer
  to a nonexistent header → "Header not found locally or on wss://dcosl…"; the assistant's header
  missing → "… was not found". Console: only the app shell's `/api/user-prefs` 401s (stub artifact).
  Not done here: a **real** import — left for the reviewer (it would make `dog-breed`'s header local
  and remove the relay-only case from this machine).

## Linked artifacts
- ADR: `engineering-team/decisions/my-curated-dlists/0002-the-two-headers.md`
- Test plan: `engineering-team/stories/my-curated-dlists/2-the-two-headers.test-plan.md` (suite: `test/my-curated-dlists-headers.test.js`)
- Review: `engineering-team/reviews/my-curated-dlists/2-the-two-headers.md`

Link by path only — never record verdicts or round history in this file (bare `KICK_BACK`/`CHANGES_REQUESTED` tokens in gate/round context trip harness-lint L14; backticked mentions are exempt). Outcomes live in the review file and, in Direction mode, the run journal. (ADR harness-gate-integrity/0002.)
