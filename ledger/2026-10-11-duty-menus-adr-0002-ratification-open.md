# ADR duty-menus-and-self-maps/0002 still says words in A1-11 "await the Architect's ratification", and four A1 passages overstate

**Id:** 2026-10-11-duty-menus-adr-0002-ratification-open
**Type:** docs
**Opened:** 2026-10-11 (`duty-menus-and-self-maps` #2, review round 3, non-blocking 25)
**Status:** DONE
**Done:** 2026-10-11 — the owner ratified "unless they are listed on it"; ADR 0002's "After approval" note, A1-4, A1-6, A1-10, A1-12 and the Verification wording corrected as below.

ADR `duty-menus-and-self-maps/0002` marks the words "unless they are listed on it" as added after the owner's
approval. Fix pass 5 of story 2 added them to A1-11's rule and its four restatements. The ADR says so the same way in
three places: the "After approval" paragraph under Revision 4 ("they await the Architect's ratification"), the note
under A1-11's rule, and the implementation notes for A1-9 to A1-12 ("with the words added after approval"). The one
tension is its status line, `**Status:** Accepted; amended by A1 (2026-10-11)`, which does not mention the pending
words. The Duty Menus spec carries the words in a normative SHOULD (`protocols/drafts/duty-menus.md` § 6.2 step 5,
Alternates).

Review round 3 of story 2 accepted the words in the spec as a logged deviation: without them the SHOULD is false once
the observer lists one of K's other Assistants on the new key, and they restate A1-11's approved Why ("They do not,
unless the observer lists them on the new key"). The review cannot ratify the ADR's own text; only the Architect (or
the owner) can.

Fix shape, one Architect touch of ADR 0002 (no spec change):
- a ratification line under "After approval", and drop "they await the Architect's ratification";
- A1-6's Why: "removes every earlier version" becomes "removes the versions up to its own `created_at`" (NIP-09
  `09.md:35`; the spec's § 11 already says so);
- A1-10's "neither K nor the row has the Profiles category" becomes "is limited to", as the spec reads it (the
  "includes" reading contradicts A1-10's own first example);
- A1-12's "as on a relay, which keeps only the latest version" (NIP-01 `01.md:97–103`: relays MUST store the latest,
  MAY discard older ones, and SHOULD return just the latest);
- A1-4's "changes nothing" for `30396:tag::⟨T⟩` under `30396:tag:⟨D⟩` (and the same words in Verification case C):
  true for K's insights only; the key also takes `30396:tag:⟨D′⟩:⟨T⟩` for every other DList from whichever entry held
  it.

**Pointer:** `engineering-team/reviews/done/duty-menus-and-self-maps/2-duty-menus-pre-nip.md` § Round 3 → Findings
(round 3), non-blocking 25; ADR 0002 § Amendment A1 ("After approval", A1-4, A1-6, A1-10, A1-11, A1-12).
