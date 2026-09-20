# PRD Seed: Knowing who authored what

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/profile-lookup-bounds/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — the frame is real and was confirmed at kickoff, so §3 is well grounded. §1
and §2 are read off one bug-lane book and have never been stated by anyone; treat them as a strawman.
**Date:** 2026-09-20

> A **reverse-engineered baseline** in PRD shape, built from what shipped. A strawman for the product
> team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` The control panel is an instrument for reading a knowledge graph that many people write
to. Nearly every surface in it answers some version of *who said this?* — who authored a list, who
filed a concept, who asserted a tag. A pubkey answers that question formally and not at all
practically: `2f1b310f…` names nobody. The product's job on every one of those surfaces is to turn an
identity into a **person a reader recognises**.

`[UNKNOWN — product input needed]` Nobody has ever written down who the control panel is *for*, or
whether author attribution is a diagnostic detail for an operator debugging their instance or a
first-class social signal for someone evaluating whether to trust what they are reading. The answer
changes §6's open questions materially.

## 2. Personas

`[INFERRED]` from the story's "As a…" line — one persona, thinly evidenced:

- **The operator reading their own instance.** Opens control-panel pages to see what the graph holds
  and who put it there. Recognises some authors by name, does not recognise any by pubkey. Cannot
  distinguish "this person published nothing about themselves" from "we failed to look" unless the
  page says so.

`[UNKNOWN]` Whether a non-operator ever reads these pages. Every design call in this book assumed not.

## 3. Scope (as-built)

`[FROM FRAME]` The frame's five bullets, with what is actually true at close:

| # | Frame bullet | State |
|---|---|---|
| 1 | Every author cell shows a real display name where the author has a published profile | **Met, with a caveat worth reading** — see below |
| 2 | The lookup keeps working as the number of distinct authors grows, rather than working to a threshold then silently degrading | **Met.** Verified at prod scale: 9 requests, all 200, largest 50 pubkeys / 3,303 bytes against a 16,422-byte ceiling |
| 3 | When a lookup genuinely fails the page says so, including when the failure carries no readable body | **Met.** A failed cell renders distinctly from an unnamed one |
| 4 | The endpoint still refuses an abusive single request, interpretably | **Met.** The over-cap 400 now names the limit, the count, and the remedy |
| 5 | Pages that work today keep working, with the same names | **Met.** Regression sentinels green before and after |

**The caveat on bullet 1, because it is the finding product should actually act on.** The bullet named
`/tapestry/lists/items` as its confirmation surface, on the evidence that the page showed 288
truncated author cells. The assumption underneath — *those cells are truncated because the lookup is
broken; fix the lookup and they become names* — turned out to be only half right. The lookup **was**
broken and is now fixed. But on `staging.brainstorm.world` that page's cells are *still* truncated,
for an unrelated reason: those authors have published no profile that the instance can find. The
relay holds 4.5 million profile records and none of them belong to these authors. Separately sampled
authors who *do* have profiles resolve to real names in under a second.

So the page looks about the same and is now correct. Two different problems were wearing one coat.

`[INFERRED]` In scope as built: profile-name resolution on every control-panel surface that shows an
author. Out of scope as built: which authors a page shows, what a profile contains, and where profile
records come from.

## 4. Domain model

`[INFERRED]` No concept in the knowledge graph was touched — this book is about *fetching* a nostr
primitive, not about modelling anything. The entities in play:

- **Author** — a pubkey appearing on some record. Always known.
- **Profile** — the self-published metadata a pubkey may or may not have (name, display name,
  picture). Optional, authored by the person themselves, and **not** guaranteed to exist or to be
  reachable from any given instance.
- **The relationship between them has three states, and the product now distinguishes all three:**
  *resolved* (a profile exists and we read it) · *absent* (we looked; they have published nothing) ·
  *unknown* (we could not look). Before this book the last two were indistinguishable.

## 5. Design rules (as-built)

`[INFERRED]`, and worth ratifying because they were decided in engineering gates:

1. **A degraded view never presents itself as complete.** Inherited from the sibling
   `relay-scan-bounds` book and applied here to individual cells.
2. **A known identity keeps its name even when a lookup fails.** The instance's own assistant is
   identified from configuration, not from the lookup, so a failed lookup is not allowed to reduce it
   to a pubkey. (This was caught as a regression at review, not designed in — see audit §4.)
3. **The fallback ladder is: display name → name → a known local identity → truncated pubkey.**
4. `[UNKNOWN]` No rule has ever been recorded for what a truncated pubkey is *for*, or whether it is
   an acceptable terminal state on a surface a person reads. §6 asks it directly.

## 6. Carry-forward & open questions

Promoted from audit §6:

- Retire five hand-rolled copies of the chunking loop onto the shared module.
- Decide what an author with no discoverable profile should look like.
- Add a behavioural test for the author-naming rule.
- `OPEN.md` row 273 — profile lookups skip their local-relay fallback on a timeout; owned by the
  `assistant-profile` book, and the reason cold lookups on staging returned nulls that then cached.

## 7. What product must validate

- [ ] **Is a truncated pubkey an acceptable thing to show a reader?** It is currently the terminal
      state for every author with no discoverable profile — the majority of authors on
      `/tapestry/lists/items` on staging. Options nobody has weighed: show a shortened npub instead,
      show nothing, group them, or leave it. (§3, §5.4)
- [ ] **Who are these pages for?** Operator diagnostics or a surface a non-operator reads? The
      sibling `relay-scan-bounds` seed asks the same question about the same pages and calls it *the*
      load-bearing one; both books now wait on it. (§1)
- [ ] **Should the instance try harder to find a profile it does not hold** — querying wider relays,
      backfilling on demand — or is "we don't know this person" an honest and acceptable answer? This
      is the product question sitting underneath `OPEN.md` row 273. (§4)
- [ ] **Is author attribution a trust signal or a detail?** If a reader is meant to weigh *who* said
      something, an unrecognisable author is a product failure rather than a cosmetic one, and the
      first bullet becomes urgent. (§1, §2)
