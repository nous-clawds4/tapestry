# PRD Seed: Note-Tagging Raw Events Inspector — auditing the assertions behind a note's tag chips

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/note-tagging-inspector/audit.md`
**Anchor:** acceptance frame in `book.md` (operator's verbatim ask, captured in-session; two scope decisions put to the operator and answered at Planning)
**Confidence:** **high** on scope and behavior (verbatim frame; verified live on all four deployments, including the operator's own originating page on `tags.brainstorm.world`); **medium** on the product *reasoning* beneath it (audience and job-to-be-done are inferred across three books, never established by discovery).
**Date:** 2026-07-18

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A strawman for the product team, not a ratified spec. Sections tagged `[FROM FRAME]` / `[INFERRED]` / `[UNKNOWN — product input needed]`. The product team adopts this as the `/discover` starting point for the next phase.

## 1. Product vision

`[INFERRED]` Every note surface (feed, `/event`, a tag page's Notes tab, a profile's notes) shows tag chips asserting "Applied by N, Disputed by M — from this point of view." Until now that claim was unauditable in-product. This capability turns the chip into **evidence**: from the chip's hover popover, open the signed events those numbers are derived from and count them back yourself.

`[FROM FRAME]` It is the **third and completing instance** of a deliberate pattern — *verifiability as a product feature* — which now spans all three tag-family object types: the tag's **definition** event (book 1), the assertions behind a **profile's** tagging (book 2), and the assertions behind a **note's** tagging (this book). The operator's ask named it as exactly that: "the feature that allows me to visualize the raw nostr event that applies a tag to a content event" — the one object type the first two books didn't cover.

`[INFERRED]` With the third instance the pattern's shared machinery became explicit and shipped: one "as signed" 7-field projection (`toRawEvent`), one assertion-blocks renderer (`RawTaggingEvents`), one presentation class. The product question this raises is in §7: is the pattern now *complete*, or does it continue onto the remaining latent surfaces?

`[UNKNOWN]` Whether "audit the number" is a mainstream reader need or a power-user/operator one — still never established by discovery (carried unresolved from both prior seeds).

## 2. Personas

`[FROM FRAME]` **The operator** is, for the first time in this pattern, the *documented* requester with a concrete task: the ask cites the real `cool-web-of-trust` taggings on `tags.brainstorm.world` — federation-debugging material — as the events to eyeball. Behavior: opens the panel, reads the `z`/`e` tags and signatures.

`[INFERRED]` from story "As someone reading a note" plus the prior books' audiences:

- **The skeptical reader** — deciding whether a tag on a note is meaningful; counts the blocks, reads the author pubkeys, verifies the chip's numbers instead of trusting the rendering.
- **The developer** — learning the on-the-wire shape of a `nostr-event-tag` (dual `z` tags, `e` target, polarity), previously learnable only from source or a raw relay scan.

`[UNKNOWN]` Relative priority of the three. The design serves all identically (raw JSON, pubkey captions); no persona was optimized for.

## 3. Scope (as-built)

`[FROM FRAME]` **In scope, shipped:**
- A **"Show Raw Tagging Events" / "Hide Raw Tagging Events"** button in every note tag-chip's hover popover, beside Apply/Dispute — enabled signed in or out (inspection has no login gate; Apply/Dispute keep theirs).
- The panel renders **inside the note's card, below the note's content, above the chips row**, captioned with the tag's name; per (note, tag); several chips' panels may stack, in the chips' display order.
- The panel shows **every** event behind the chip's counts — the active POV's WoT-counted assertions unioned with the viewer's own — applications before disputes, each block captioned with polarity + author pubkey, each rendering the complete signed event (7 fields, byte-faithful). A viewer-own-but-uncounted block carries the "not counted under this POV" marker. Count the blocks, get the popover's numbers back.
- **All note surfaces at once** (operator decision: the chips row is one shared affordance; a per-surface split would make the same popover honest on one page and opaque on the next).
- Honest degradation: if a chip's events can't be produced, a visible "unavailable" notice in the popover and **no panel** (nothing that could read as "nobody asserted this").

`[FROM FRAME]` **Deliberately out of scope** (deferred, not forgotten):
- **Profile pages' own tag chips** — the same latent need on a fourth surface, backed by the *profile*-tagging family (operator decision at Planning).
- Copy-identifier actions per block; a close affordance on the panel itself; pagination/capping of large panels; syntax highlighting/JSON trees; client-side signature verification.
- Showing assertions outside the POV's WoT beyond the viewer's own (would break the count-back contract; a different feature).
- The "Note vs Event" vocabulary question — open since book 1, still unresolved (§7).

## 4. Domain model

`[INFERRED]` from concepts read (no definitions changed):

- **nostr-event-tag** (`39998:<TA>:nostr-event-tag`) — *"an event that applies a specific Tag to a specific event (referenced by the e or a tag)… Publishing is permissionless; whether a tagging counts is computed per point-of-view at read time."* The concept whose elements the panel displays; its last sentence is the feature's POV contract verbatim.
- **nostr-event** (`39998:<TA>:nostr-event`) — the 7-field signed object each block renders (id, pubkey, created_at, kind, tags, content, sig).
- **The POV domain fact, now exercised three ways** `[INFERRED]`: *an event's bytes are POV-invariant; which events are "in view" is per-POV when the number they back is per-POV.* Book 1's panel (one definition event) is POV-invariant end-to-end; books 2 and 3 (the evidence behind per-POV counts) have per-POV *sets* with invariant *bytes*, made explicit by a `counted` flag carried beside the bytes, never inside them. This is still captured only as an engineering guardrail (epic file) — worth ratifying as product language (§7, carried from the previous seed).

## 5. Design rules (as-built)

`[INFERRED]` from the shipped UI — the raw-event surface conventions are now consistent across three instances and one shared component:
- Raw events render as **plain formatted JSON** in a monospaced, wrapping block (`.bs-tag-raw-pre`, shared by all three instances). No highlighting, no tree.
- Assertion blocks are captioned **polarity + author pubkey** ("Applied by / Disputed by `<64-hex>`") — never a display name in the pubkey's place; uncounted blocks carry the verbatim **"not counted under this POV"** marker. The renderer is now literally one component (`RawTaggingEvents`), so books 2 and 3 cannot drift apart.
- Panels are **hidden by default** and live **inside the card of the object they explain**, captioned with the tag's name so stacked panels stay attributable.
- **Emulate the control being extended** (epic guardrail, amended in book 2): this is a hover popover with no close-on-select convention, so the button does not close it — unlike book 2's row menu, which closes because it is a bottom sheet. One consequence is documented as correct-by-composition: opening a panel shifts layout, which usually moves the chip out from under the stationary cursor, closing the popover via the unchanged cursor-leave rule (see §6).
- `[UNKNOWN]` No product-level design rule for raw-event surfaces has ever been recorded; with three shipped instances and a shared component, the design-guide entry question (caption format, degraded states, placement) is riper than ever (§7, carried).

## 6. Carry-forward & open questions

Promoted from build audit §6:
- **The pattern now spans all three object types — the remaining latent surfaces are the decision point.** Tag index rows, the Pinned tab, and profile pages' own tag chips all render tag-family data without inspection affordances. Extending is cheap now (the blocks renderer and projection are shared components); the question is whether the pattern is *complete* as a product statement or *continues*.
- **Wire cost: enable gzip for JSON APIs** (OPEN.md #48). `for-event` is now the **second** endpoint shipping eager raw-event payloads uncompressed (~2× per tagged note today; measured worst realistic page +~47 KB). The engineering revisit trigger for this surface: any real note exceeding ~100 total assertions (~+86 KB on that one response, uncompressed). Gzip (~4×) is the cheap broad lever named first by the ADR.
- **The popover-closes-on-layout-shift interaction** — correct-by-composition of two operator-settled decisions (panel placement; cursor-leave closes), but worth a UX pass if operators find it jarring. Any fix (scroll compensation, panel below the chips) changes settled decisions and needs its own story.
- **Empirically exercise the "not counted under this POV" marker** (OPEN.md #49, now spanning both the profile and note surfaces via the shared component) — proven structurally, never runtime-exercised anywhere; one verification on either surface now covers both.
- **"Note vs Event" vocabulary** — the product says "note" in labels while the protocol object is any nostr event; open since book 1, cross-cutting, still undecided.

## 7. What product must validate

- [ ] **Is the inspection pattern complete, or does it continue?** Three object types are covered; three latent surfaces remain (tag index rows, Pinned tab, profile pages' own chips — the last deferred by explicit operator decision this book). If it continues, which surface next, and is it one book per surface (the worked precedent) or one consolidating pass?
- [ ] **Who is this for?** (carried, twice) Raw JSON + pubkeys serves operators/developers; if skeptical *readers* are a real audience, a friendlier layer (names alongside pubkeys, a summary line) is a different product decision. Three books in, this is still inferred.
- [ ] **Is the layout-shift popover close acceptable?** The affordance works (re-hover shows the correct "Hide" state), but the popover usually vanishes after a successful "Show". Ratify as fine, or commission the UX story that revisits the settled placement/close decisions.
- [ ] **"Note vs Event" vocabulary** — decide the product-wide term for kind-agnostic events on note-shaped surfaces (open since book 1; prior guidance: "note" means any nostr event — don't re-litigate per surface, decide once).
- [ ] **Does the raw-event surface warrant a design-guide entry** now that the renderer is one shared component across three instances? (carried)
- [ ] **Ratify the POV domain fact as product language** (§4) — "bytes are POV-invariant; the set behind a per-POV number is per-POV" — it governs every future inspection surface and currently lives only in an engineering guardrail. (carried)
- [ ] **"Who else said this, outside my WoT?"** (carried) — still deferred as a different feature; the panel deliberately shows only the events behind *your* numbers plus your own stance.
