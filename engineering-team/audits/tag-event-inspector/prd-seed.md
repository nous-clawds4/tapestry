# PRD Seed: Tag Event Inspector — seeing the events behind the tag surfaces

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/tag-event-inspector/audit.md`
**Anchor:** acceptance frame in `book.md` (verbatim operator ask, captured eagerly at intake)
**Confidence:** medium
**Date:** 2026-07-16

> A **reverse-engineered baseline in PRD shape**, built from what shipped. A strawman for the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Why medium and not high:** the *scope* is high-confidence — the anchor is the operator's verbatim ask and every frame bullet was verified on the running product. The **product reasoning underneath it is not**. Nobody ever wrote down who this is for, what job it does, or whether it generalizes; §1's problem statement and §2's personas are read *backwards* off one feature built for one operator on one page. Treat §3 as near-fact and §1/§2/§7 as hypotheses.

## 1. Product vision

`[INFERRED]` **Tapestry asks people to trust an interpretation of public data — and this book is the first place it shows its work.** A tag like "stoicism" is presented as a name, a description, and a list of profiles. All of that is *derived* from one signed nostr event published by an ordinary user. Until this book, that event was invisible: the product asserted "this tag says X" and the reader had to take its word. Now the reader can open the event and check.

`[INFERRED]` The capability is **verifiability as a product feature**, not a developer console. It is the natural expression of the architecture's own premise — assertions are public signed events anyone can audit — applied to the app's own rendering. It matters most exactly where trust matters: the same person deciding whether a tag is meaningful is the one who wants to know who authored it and what they actually signed.

`[UNKNOWN — product input needed]` **The underlying problem was never stated.** The ask arrived as a solution ("show me the raw event"), not a problem ("I can't tell whether…"). Consequently the *demand* is unmeasured: we do not know whether this is a niche operator/debugging affordance, a trust-building surface for ordinary readers, or the first step toward a general "inspect any object" pattern. §7 turns this into a decision.

## 2. Personas

`[INFERRED]` — all three are read off one story's "As a **someone reading a tag's page**" and the shape of what shipped. **None is validated; all are hypotheses.**

- **The operator / federation debugger.** Wants to answer "did this arrive intact, with both `z` tags?" without leaving the product or hand-hitting a scan endpoint. *Evidence this is real, and the strongest of the three:* the shipped panel immediately surfaces something no other surface does — a tag's **two `z` tags** (the canonical handle and the instance TA), i.e. its federation state at a glance. Confirmed live on tags.brainstorm.world.
- **The protocol-literate reader.** Wants to cite, share, or verify a tag: copy its event id to reference *these exact bytes*, or its `naddr` to point at the tag durably. *Evidence:* the ask requested both identifiers, which are only distinguishable to someone who knows the difference.
- **The curious/skeptical reader.** Wants to know who authored a tag and whether the description is really what they signed. *Weakest of the three* — plausible from the vision, but **nothing in the ask or the build targets them**: the panel is raw JSON behind a `⋯` menu, which is not an affordance a non-technical reader would find or read. If this persona matters, the product is not yet built for them (§7).

`[FROM FRAME]` One thing is settled rather than inferred: **the audience includes signed-out visitors.** Inspection carries no login gate — deliberately, and in contrast to the Pin button beside it. Reading a public signed event is a read.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope — shipped and verified on production:**
- On a tag's detail page, a `⋯` menu beside the tag name, offering exactly three actions: **Copy Note ID (event id)**, **Copy Note Addr**, **Show / Hide Raw Event**.
- A raw-event panel, **hidden by default**, showing the complete signed event as published — id, pubkey, created_at, kind, tags, content, sig — not a summary.
- Placement below the tag header block, above the Profiles|Notes switch; visible from whichever tab the reader is on.
- Available **signed out**; available for a tag authored by **anyone** (tags are permissionless — "stoicism" is authored by an ordinary user, not the assistant).

`[FROM FRAME]` **Vocabulary, settled by the operator at close:** *"note" means a nostr note, synonymous with nostr event* — it is **not** kind-1-specific. "Copy Note ID" on a kind-39999 tag definition is therefore correct and idiomatic, not a mislabel. Recorded because three separate roles independently proposed "correcting" it; the product team should not re-open it.

`[INFERRED]` **Explicitly out of scope this phase** (from the story's own `Out of scope`, all deliberate):
- Editing or republishing a tag definition — inspection is read-only.
- Raw-event inspection **anywhere else**: Note rows, Profile rows, the tag index, the Pinned tab.
- Showing a tag's *other* events — taggings, pins, disputes, the concept header. The definition event only.
- Client-side signature verification. Displaying `sig` is not checking it.
- Syntax highlighting, a collapsible JSON tree, a copy-the-whole-blob button. Plain formatted JSON is the bar.

## 4. Domain model

`[INFERRED]` from the concepts touched and the shipped contracts. **No concept definitions changed** in this book — the entities below already existed; this book made one of them *visible*.

- **Tag definition** — the entity this book exposes. A **kind-39999** tag element: a signed nostr event whose `d` tag is the tag's **slug**, whose `content` carries `{tag: {slug, name, description}}`, and whose `z` tags bind it to the `tag` concept. *(Kind 39998 is the ConceptHeader — the class "tag"; 39999 is the element — the instance "stoicism". They are routinely confused; filtering 39998 returns nothing.)*
- **Author** — an **ordinary pubkey**, not the instance assistant. Anyone may publish a tag definition; the product must never gate on authorship. This is load-bearing, not incidental (§5).
- **Identity, two kinds** — a tag has two legitimate identifiers with *different meanings*, and this book ships both:
  - the **event id**, which pins *this exact version* — if the author edits the name or description and republishes, the id changes;
  - the **naddr** / coordinate `39999:<authorPubkey>:<slug>`, the **durable identity**, always resolving to the latest version.
  The product currently offers both with no explanatory copy. *(Story open question (c): a semantics lecture in a three-item dropdown costs more than it teaches.)*
- **Point of view — deliberately absent.** The *taggings around* a tag are per-POV; the **definition event is not**. It is the signed bytes, identical from every POV. This book applies **no** trust, WoT, POV, or authorship filter to it, and adding one would be a category error.

## 5. Design rules (as-built)

`[INFERRED]` — read off the shipped UI and the review. Where no rule was ever written down, it says so.

- **Emulate, don't invent.** The new menu reuses the existing row menu's glyph (`⋯`, U+22EF), classes, click-outside behavior, and transient in-menu feedback line. There is **no icon library and no toast system** in this product; the house patterns are a bare Unicode glyph and a ~1.6s flash line inside the dropdown.
- **The menu stays open on select**, and the Show/Hide label flips **in place** — so a reader can toggle straight back. Parity with the emulated menu, not oversight.
- **Degradation reports; it does not hide.** A value that can't be produced keeps its item and flashes "‹label› unavailable" on select. One convention for "can't do that", page-wide.
- **A control's *accessible name* names the object; an *item's* label names the operation.** The kebab announces "Tag actions" (not "Note actions") so screen readers hear the real object — while the item labels keep the operator's "Note ID / Note Addr" because those name a copyable identifier idiomatically. `[INFERRED]` — never written as a rule; derived from one reviewed judgment call, and worth ratifying as one.
- **A toggle and the thing it toggles must share a visibility scope.** The panel is page-level because its trigger lives in the always-visible header — placed inside the default tab's panel, it would vanish on a tab switch while the menu still read "Hide Raw Event".
- **No horizontal overflow at 1280px** — an inherited constraint from the closed `event-page` book, now with regression cover. Raw JSON wraps rather than scrolling: unbroken 64-char ids and 128-char sigs have no break opportunity and will overflow without `word-break`.

## 6. Carry-forward & open questions

Promoted from build audit §6:

- **A copied Tag Addr doesn't round-trip through Tapestry's own `/event` page.** The `naddr` is valid and resolves in other nostr clients, but `/event` is kind-1 only and answers a kind-39999 naddr with "kind ‹N› not yet supported" — with no fetch. **The product hands you an identifier its own viewer refuses.** The most product-shaped gap this book leaves.
- **Raw-event inspection on other surfaces** — Note rows, Profile rows, the tag index. The obvious generalization, deliberately not taken.
- **A fourth "Copy Note Link" item** (the page URL), for parity with the row menu. Not asked for; cheap.
- **Escape-to-close on every `⋯` menu.** No menu in the product handles Escape. One story across all menus, not a per-surface fix.
- **`<ActionsMenu>` shell extraction** when a third menu appears — engineering-internal, no product decision needed.
- **OPEN.md #45 — the unified tag index under-reports** (staging 1 vs 39; tags.bw 10 vs 33 against the legacy endpoint). **This is product-relevant and urgent-ish:** it bears on the **open `unified-tagging-ui` book**, whose acceptance frame is "the tag surfaces stop meaning profiles only". A `/tags` directory showing 10 of 33 tags does not meet that frame. Worth triaging *before* that book closes.

## 7. What product must validate

The `[INFERRED]` / `[UNKNOWN]` items needing a human product decision before this seed becomes a real PRD:

- [ ] **Who is this actually for?** Three personas are hypothesized (§2); only the operator/debugger has real evidence. If the *curious reader* matters, raw JSON behind a kebab does not serve them and a different surface is needed. **This is the decision the other items hang off.**
- [ ] **Is "inspect the event behind this thing" a page feature or a product pattern?** It shipped on one page for one object type. Notes, profiles, taggings, and pins all have the same latent need. Decide deliberately — generalizing later is cheap now and expensive after three divergent one-offs.
- [ ] **Should a Tapestry `naddr` resolve in Tapestry?** Today the product emits an identifier its own `/event` page rejects. Either extend `/event` beyond kind-1, or accept that copied addresses are for *other* clients and say so.
- [ ] **Is "show the signed bytes" the right trust affordance, or a proxy for one?** Nobody validated that reading raw JSON is what a skeptical reader wants. The stated need may be better served by rendered provenance ("published by ‹author›, ‹date›, seen on ‹relays›") with raw JSON as the escape hatch. `[UNKNOWN]` — never asked.
- [ ] **Does displaying `sig` without verifying it set a false expectation?** The product shows a signature it does not check. Defensible (the relay checked it) but never stated as a product position.
- [ ] **Should the id-vs-naddr distinction be taught?** Both ship with no explanatory copy, on the assumption that anyone opening a raw-event viewer knows the difference. That assumption is untested and follows directly from the §2 persona decision.
