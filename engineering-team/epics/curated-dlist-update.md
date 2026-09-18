# Epic: curated-dlist-update

**Created:** 2026-09-11
**Status:** Done
**Retired:** 2026-09-18 — after PR #668 merged `feat/curated-dlist-update` into `staging`; folders under `done/curated-dlist-update/` (book closed 2026-09-17; the five suites' docs-test paths were repointed in the same commit).
**Book:** `engineering-team/audits/curated-dlist-update/book.md` (acceptance-frame)
**Provenance:** Operator request, 2026-09-11 in-session — the book after `my-curated-dlists` (closed
and in production 2026-09-11), whose Update list button is a placeholder. The protocol half was
settled in `/discuss` the same day (OPEN.md rows 259 and 267; the carry-forward in
`engineering-team/audits/my-curated-dlists/prd-seed.md` §6–7). No `_intake.md` entry: the request
went straight into the book and story 1.

## Goal
Make My Curated DLists' Update list button work. The signed-in user's assistant copies the community
items its curation method accepts into the user's curated list, refreshes copies whose originals
changed, and deletes copies it no longer accepts — after a preview the user approves. The protocol
states the copy convention first; the shipped surfaces then follow it.

## Stories (planned at kickoff)
`stories/done/curated-dlist-update/`, in dependency order:
1. `1-curation-copy-convention.md` — the copy convention in the protocol: the header's `pointer`
   link, what a copy is and carries, how it points back, how it is removed, one curating assistant per
   list; settles rows 259 and 267. Doc (docs-mode, protocol).
2. `2-pointer-header-and-copy-wording.md` — pointer header and "copy" wording: new headers link with `pointer`; a header with the older
   `inherit-items` link reads as the older form, not a problem; "copy" replaces "inherit" in the panel
   and page text; "already copied" is judged by the back-reference alone. Feature.
3. `3-another-assistants-curation-read-only.md` — another assistant's curation, read-only: lists empowered for an assistant that is not the
   viewer's assistant on this instance open read-only, with Update disabled and "curate here instead".
   Amends `my-curated-dlists` #1 AC-4/AC-5. Feature.
4. `4-curation-method-panel.md` — the curation method panel: the Scoring Method and point of view from Trust Determination, an
   editable cutoff, and each candidate's verdict with its reason; the qualifying rule shared with
   Simple Lists' Generate Trusted List panel, whose behavior does not change. Read-only. Feature.
5. `5-update-list-preview.md` — Update list's preview, built only from reads it could complete: what my
   assistant would copy, refresh, delete and upgrade, and why each candidate was skipped. Any failed or incomplete
   read proposes nothing, and nothing is signed. Feature. (The planned "Update list" was split in two at story 5's
   Planning gate, 2026-09-13.)
   **Carry-forward from story 4's Test Design gate (the operator's call, 2026-09-12):** `/api/relay/external`
   answers a relay that refuses the connection as an empty success (OPEN.md row 314; the cause is row 245's).
   So an unreachable community relay reads as "no votes", and an unreachable rank provider as "nobody is
   ranked". The verdicts then say "skipped", not "couldn't check". Story 4 accepted this because its page only
   reads. Settle it before Update proposes a deletion: the book's guardrail says a failed read proposes nothing.
   **Carry-forward from story 4's review (Non-blocking 1–4, 2026-09-13):** four more ways a read can come back
   incomplete without saying so. Each is harmless on story 4's read-only page; settle each before Update acts on
   its verdicts:
   - a partly read shared list (one source failed, or the local read capped) still gives an "N of M" that looks
     complete;
   - Follow List with no kind 3 for the point of view on this instance reads as "follows nobody": every weight 0,
     and no error;
   - the Trusted List is read by d-tag from any author, so anyone's newer kind 30392 with that d-tag replaces the
     trusted set. Simple Lists shares this, so it went out as a separate task;
   - a relay answer holding `VOTES_LIMIT` votes is not reported as capped (the community relay advertises
     `max_limit` 10000);
   - every candidate id goes into one GET, so past about 110 candidates (nginx's 8 KB request line) every read
     fails, honestly, as "couldn't check". Batch the ids, or record the ceiling.

6. `6-update-list-publishes.md` — Update list publishes what I approved. After I approve the preview, my assistant
   signs and publishes what it showed: the copies, the refreshes, NIP-09 deletion requests and the older header's
   upgrade. It then reports what landed where. The book's guardrails apply. Feature.
   Settled at the Planning gate, 2026-09-13:
   - one approval covers the whole preview;
   - a header with the sentinel beside its older link becomes a plain pointer, and the preview says so;
   - no dead-end "curate it here" offer;
   - honest results per item and per place.
   **Carry-forward from story 3's review, round 2 (R2-2; the operator's call, 2026-09-12):** the
   "curate it here instead" offer is still made for a pointer at a header by the viewer's own assistant
   here (or the viewer's own key), and it dead-ends at the endpoint's "cannot curate your own header". When
   story 6 consolidates the offer's sign-and-publish flow (ADR 0003 Option C), decide the rule. Either add a
   check with its own reason, or let "curate it here" name that self-declared header directly — a product
   question.
   **Carry-forward from story 2's review:**
   - decide which rule gates the older-link upgrade. The header endpoint counts the `b-tag-deferred` sentinel as
     a `b` (a conflict, answered 409), while the page lets a real `b` beat it. Also say whether the upgrade keeps
     the sentinel; no live header has this shape;
   - reword the DList Curation panel's 409 sentence: "pointing elsewhere" is wrong for a same-list header with
     another link type.

   **Before Update relies on deletions:** check that the relays holding copies accept and honor kind-5 deletion
   requests, the `a` form included (the book's known constraints).
   **The signer** is the signed-in user's own assistant (OPEN.md row 188), not the Simple Lists panel's signer.
   **Carry-forward from story 5's review (Non-blocking 3–4, 2026-09-13):**
   - read my assistant's header strictly, or re-read it, before signing the upgrade. The preview's header state
     comes from the non-strict `useCurationHeaders` read: safe for a preview, not for a signature;
   - on a large list the preview fans out, to about 13 connections at once at 500 items. If large lists appear,
     send the vote chunks two or three at a time.

   **For the book's audit** (story 5's review, Non-blocking 1–2; not story 6 work):
   - a rank provider slower than 5 seconds now reads as failed, so Simple Lists shows the warning, with every
     weight null, where before it took a silently partial answer. ADR 0005 §5's "scores don't move" holds only for
     its two named cases;
   - the weights warnings now also reach Simple Lists' `DListRatings.jsx` and `DListItemRatings.jsx`.

Dependencies: 1 first (it ratifies what 2–6 build). 2 and 4 before 5; 5 before 6. 3 needs only 1.

## Settled at kickoff (2026-09-11)
Operator decisions in `/discuss` and at the Planning gate:
- **The header links with `pointer`**, not `inherit-items`: the curated list is exactly the items
  filed under it; curated lists become discoverable through declared affiliation (zero aggregation
  weight).
- **A copy** is the assistant's own kind-39999 item (whatever the original's kind) with exactly one
  `z` — the curated header, never the shared list's — and a `d` derived from (curated list, original),
  so a repeat Update replaces rather than duplicates. It carries what the original's author wrote
  (`name`, `title`, `slug`, `description`, `comments`, and the item tag `p`/`e`/`t`/`a`), and not
  `json` (derived from the author's graph — out of scope), `n`, `s` or `b`.
- **The back-reference** is NIP-18 `q`: the address for a 39999 original, plus the exact version's
  event id for every original. "Already copied" is judged by `q` alone.
- **Removal** is a NIP-09 deletion request by the assistant (`a`, `e`, `k`); the original returns to
  the candidates; no rejection is stored.
- **When the original changes:** edited → the copy stays and Update offers a refresh; downvoted or
  disputed → the method decides again; not found → the copy stays, flagged. Readers merging lists
  collapse a copy into its original by `q`; copies are never stamped into the source list.
- **`inherit-items` stays registered**; this deployment stops emitting it when story 2 switches the
  header endpoint to `pointer`.
- **Row 267:** one curating assistant per list, network-wide — no protocol change; other instances
  show the curation read-only and offer to curate it here instead.
- **"Copy", not "inherit",** in everything user-facing.
- **Update:** manual only (a schedule later); a preview before the assistant signs; the method is the
  Trust Determination page's Scoring Method and point of view (not the owner-only TL Membership
  Method), with a cutoff; score = the author's implicit upvote plus trust-weighted upvotes minus
  downvotes, qualifying at score ≥ cutoff — as in Simple Lists' Generate Trusted List panel. The
  method, point of view and cutoff are not written onto the header (a later Trust Determination
  Methods concept will be pointed at instead).
- **Guardrails for Update** (from `/discuss`): a failed or incomplete read proposes nothing, never a
  deletion; votes are read where the items are (local strfry and the community relay); the signer is
  the user's own assistant; an edited 39999 original needs a rule for its votes (they are keyed by
  event id).

## Decisions
`decisions/done/curated-dlist-update/`:
- `0001-curation-copy-convention.md` — story 1: the curation copy convention — a `pointer` header,
  assistant-authored kind-39999 copies with one `z`, a `copy-` d-tag and NIP-18 `q` back-references,
  removal by NIP-09, one curating assistant per list; `inherit-items` stays registered, and the header
  endpoint stops emitting it in story 2 (Option A on every axis).
- `0002-pointer-switch-and-copy-wording.md` — story 2: the endpoint writes `pointer` and accepts the
  older `inherit-items` link as existing ("older"); `describeCurationHeader` gains `notes`; one
  `linkTypeLabel` for both raw-type displays; "already copied" by `q`; "copy" in the curation screens'
  words (Option A).
- `0003-read-only-curation-and-curate-here.md` — story 3: a read-only mode of the same detail page,
  seen through the curator's pubkey (`curatedDListAccess` → `read-only`, retiring `no-assistant` and
  `other-pubkey`); a read-only list's items read at the Map entry's relay hint; an inline "curate it
  here instead" offer, words first, reusing the panel's endpoint call and signing helpers; the panel's
  Replace confirmation says "replaces" (Option A).
- `0004-curation-method-and-verdicts.md` — story 4: Simple Lists' scoring rule moved verbatim into one
  shared pure module (`dlistScore.js`) that both pages call; candidates' votes read from this instance's
  strfry and the community relay, merged by id; a weights-readiness rule so a failed read is "couldn't
  check"; verdicts on the candidate rows; the cutoff remembered per list in this browser; the summary in
  the panel (Option A).
- `0005-update-preview-and-honest-reads.md` — story 5: an opt-in strict mode for `/api/relay/external`, backed by a
  connect-observing reader, used by the curation reads and the rank read; vote reads batched, and capped answers
  reported; weights that fail instead of reading as "nobody"; a pure `updatePlan` over the panel's verdicts; the
  preview shares the items section's reads (Option A).
- `0006-update-publishes.md` — story 6: the browser re-reads on Publish and sends the approved plan as references
  only; `POST /api/dlist-curation/update` checks Origin, the session and the caller's own assistant key, re-reads
  strictly, refuses anything stale, builds every event from its own reads (ADR 0001), publishes here and to the
  DList relays, reads each place back, and reports per item and per place (Option A). Amendment 1: a delete's or
  refresh's target must be one of my assistant's copies, and every server read carries a limit. Amendment 2: each
  call answers within a deadline, what wasn't sent says so, an unknown outcome is never reported as "nothing", and
  the deletion-request read covers only the call's own copies. Amendment 3: any 4xx is a refusal made before
  anything is signed.
