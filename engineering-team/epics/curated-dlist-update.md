# Epic: curated-dlist-update

**Created:** 2026-09-11
**Status:** Open
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
`stories/curated-dlist-update/`, in dependency order:
1. `1-curation-copy-convention.md` — the copy convention in the protocol: the header's `pointer`
   link, what a copy is and carries, how it points back, how it is removed, one curating assistant per
   list; settles rows 259 and 267. Doc (docs-mode, protocol).
2. `2-pointer-header-and-copy-wording.md` — pointer header and "copy" wording: new headers link with `pointer`; a header with the older
   `inherit-items` link reads as the older form, not a problem; "copy" replaces "inherit" in the panel
   and page text; "already copied" is judged by the back-reference alone. Feature.
3. `3-another-assistants-curation-read-only.md` — another assistant's curation, read-only: lists empowered for an assistant that is not the
   viewer's assistant on this instance open read-only, with Update disabled and "curate here instead".
   Amends `my-curated-dlists` #1 AC-4/AC-5. Feature.
4. **The curation method panel** — the Scoring Method and point of view from Trust Determination, an
   editable cutoff, and each candidate's verdict with its reason; the qualifying rule shared with
   Simple Lists' Generate Trusted List panel, whose behavior does not change. Read-only. Feature.
5. **Update list** — the preview (copy / refresh / delete, and the older header's upgrade), then the
   user's assistant signs and publishes; deletions by NIP-09; the book's guardrails. Feature.
   **Carry-forward from story 3's review, round 2 (R2-2; the operator's call, 2026-09-12):** the
   "curate it here instead" offer is still made for a pointer at a header by the viewer's own assistant
   here (or the viewer's own key), and it dead-ends at the endpoint's "cannot curate your own header". When
   story 5 consolidates the offer's sign-and-publish flow (ADR 0003 Option C), decide the rule. Either add a
   check with its own reason, or let "curate it here" name that self-declared header directly — a product
   question.

Dependencies: 1 first (it ratifies what 2–5 build). 2 and 4 before 5. 3 needs only 1.

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
`decisions/curated-dlist-update/`:
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
