# PRD Seed: The Tapestry Assistant's face

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/ta-avatar/audit.md`
**Anchor:** acceptance frame in `book.md` — confirmed with the owner at kickoff, 2026-08-06
**Confidence:** **medium-high** for scope and behavior *(grounded in a real frame and verified on a
deployed instance)*; **low** for anything about users beyond the instance owner — this book never
asked who else looks at an assistant avatar, and the seed does not pretend otherwise.
**Date:** 2026-08-07

> A reverse-engineered baseline in PRD shape, built from what shipped. A strawman for the product
> team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.

## 1. Product vision

`[FROM FRAME]` Every Tapestry instance has a **Tapestry Assistant** — a real nostr identity that
signs the instance's automated work. Until this book it was visually anonymous: an empty grey disc
inside Tapestry, and a blank avatar with an unattached name in every other nostr client. The product
goal was stated by the owner in one sentence: seeing the avatar should tell you **who the
corresponding nostr user is** and **that it is an assistant**.

`[INFERRED]` The solution treats the assistant as a *delegate identity* and gives it a compound face:
the principal's picture (whose) plus a brand mark (what). This is the same visual grammar the wider
software world uses for bot and app accounts, arrived at independently here.

`[UNKNOWN — product input needed]` Why this mattered *now* was never recorded. Whether it was
trust ("is this thing legitimate?"), navigation ("which rows are automated?"), or brand presence on
nostr, would change what the next phase optimizes for.

## 2. Personas

`[INFERRED]` Two, both read off the stories' "As a…" lines:

- **The instance owner** — the only actor with agency here. They generate, preview, accept and
  publish the assistant's avatar. Every write path in this book is gated to them.
- **Anyone browsing a Tapestry instance** — sees badged assistant rows in tables and on user pages.
  Purely a viewer; no capability was added for them.

`[UNKNOWN — product input needed]` A third population is implied but was never modelled: **users of
other nostr clients** who encounter the assistant in Damus, Amethyst, Primal or njump. The whole
second half of this book exists to serve them, yet nothing records what they need beyond "not a
blank". They are the natural subject of the next discovery conversation.

## 3. Scope (as-built)

`[FROM FRAME]` In scope and shipped:
- The assistant renders as the owner's avatar wearing the mark, everywhere Tapestry shows it as an author.
- Its published nostr profile carries an owner-linked name and a branded picture hosted by the instance.
- The owner can bake their own picture and the mark into one image and publish that.
- Every missing ingredient degrades to something branded and honest — never a blank disc, a broken
  image, or a dead link.

`[INFERRED]` Deliberately out of scope, with reasons recorded in the stories:
- Automatic upkeep — regeneration is a manual owner action.
- Customer assistants (non-owner delegates) — badged nowhere, composited never.
- Avatar surfaces outside author tables and the user page.
- Hosting the image anywhere but the instance itself.

## 4. Domain model

`[INFERRED]` **No new domain concepts were created, and none were touched.** This is worth stating
plainly because it is unusual for this codebase: the whole book operates on identity and presentation,
not on the knowledge graph. Confirmed against the live concept graph at all three Architecture phases;
no firmware reinstall was needed.

The entities in play already existed:
- **Instance owner** — a nostr user; the principal.
- **Tapestry Assistant** — a nostr user created per deployment; the delegate. Its pubkey is
  per-instance and resolved at runtime, never hardcoded.
- **Profile (kind-0)** — the nostr metadata event whose `picture` and `name` this book changed the
  *values* of, never the shape.
- **Composite avatar** — new, but a *file*, not a modelled entity: content-addressed
  `ta-avatar-<hash8>.png` on the instance's persisted volume. An `image` concept exists in the graph
  and was explicitly judged inapplicable (it models images as graph nodes).

## 5. Design rules (as-built)

`[INFERRED]` No design guide existed; these rules were established by the ADRs and are worth
ratifying or overriding:
- The mark sits **bottom-right**, at ~45% of the avatar for the in-app overlay and ~34% for the baked
  composite, with a separation ring so it reads against any photo.
- The mark is **white brain + orange bolt on a purple field** — a derived asset, because the product
  logo's transparent background and purple brain disappear against dark rows at badge size.
- Published images are **512×512 PNG**. SVG is refused: native nostr clients don't decode it.
- **Fallback ladder**, applied consistently: owner's picture → the assistant's own → a letter from the
  owner's name → (published) a branded image → (no public address) publish nothing at all.
- The badge **always** appears on the assistant, in every tier — it is attached to the frame, not to
  the picture.

`[UNKNOWN — product input needed]` Nothing records whether the assistant should be visually
distinguishable from a *customer's* assistant, which currently renders unbadged.

## 6. Carry-forward & open questions

Promoted from build audit §6:
- The **users directory** shows the assistant unbadged (OPEN.md #147) — the most visible inconsistency
  left, since clicking through *is* badged.
- **`isPubliclyReachable` admits RFC1918** (OPEN.md #148) — a LAN-hosted instance would publish a dead
  avatar URL into a signed, replicated event.
- **Retention** for accumulated composites; **automatic regeneration** when the owner's avatar changes.
- **Customer-assistant** badging and composites.
- The **remaining one-off avatar sites** still use bespoke markup.
- **Nothing is on production** — all three stories are staging-only.

## 7. What product must validate

- [ ] **Who is the audience for the published avatar?** The frame says "every nostr client"; nobody
      recorded what those users actually need. This is the biggest `[UNKNOWN]` and it shapes everything
      downstream.
- [ ] **Should customer assistants be badged too?** Today they are not, and on a multi-customer
      instance an unbadged delegate sits beside a badged one. This shipped as a scope decision, not a
      product one.
- [ ] **Is staleness acceptable?** A composite keeps the owner's old face until they regenerate and
      re-publish. Automating it is real work; confirm it is wanted before it is built.
- [ ] **Does the assistant need a visual identity of its own** when the instance has no owner picture,
      beyond a lettered placeholder and the branded fallback?
- [ ] **Promotion to production** — the whole book is verified on staging only.
- [ ] **Was the underlying goal trust, navigation, or brand?** (§1.) The answer changes whether the
      next phase invests in stronger signalling, in coverage across more surfaces, or in nostr-side
      polish.
