# PRD Seed: tags.brainstorm.world — the tagging sandbox as a product line

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/feat-tags-modernization/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** medium — the *engineering* facts are high-confidence (measured on the branch and
verified live on the deployment); the *product* framing below is inferred from what shipped, because
this book was an integration book with no product brief behind it.
**Date:** 2026-09-23

> A reverse-engineered baseline in the product-team PRD shape, built from what shipped. A strawman for
> the product team, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or
> `[UNKNOWN — product input needed]`.

## 1. Product vision

`[INFERRED]` **tags.brainstorm.world is the place where Tapestry's tagging product is real before it is
general.** It is not a demo and not a staging clone: it is a live deployment carrying the tagging
feature line — pubkey tagging, event/item tagging, pins, Trusted Lists — ahead of the main product, with
real users' real events on it.

`[FROM FRAME]` What this book changed about that: the sandbox had drifted 943 commits behind the main
line, which meant it was simultaneously *ahead* on tagging and *behind* on everything else — security
fixes had to be hand-ported, and ordinary feature work could not land without being reimplemented. The
book made the sandbox a proper upstream line rather than an island: it now carries the whole modern
product **plus** the tagging work in flight.

`[UNKNOWN — product input needed]` Who tags.b.w is *for* as a product. Today it reads as
engineering's proving ground that happens to have users. Whether it should be positioned to those users
as a preview channel, a distinct community instance, or the eventual home of tagging is not recorded
anywhere.

## 2. Personas

`[INFERRED]` from the shipped surfaces — behavior-based, and these are guesses:

- **The curator.** Pins a tag, chooses how its Trusted List is scored, and expects the list to keep
  meaning what they chose. Works across *contexts*: the same tag pinned neutrally and pinned "in LFO"
  are two different curations they hold at once.
- **The community reader.** Wants "who does this community consider X" — arrives through a context, not
  through a person. This persona is the reason contextual pins had to become *discoverable* (the `z`
  stamp) rather than merely *storable* (the `d` suffix).
- **The external client author.** Reads Tapestry's published 30392/30393 lists from another app. Never
  sees our UI; sees only wire shape. The book's whole "context is a queryable stamp, not a parsed
  string" decision exists for this persona.
- **The operator.** Chooses the membership method pipeline-wide, pushes the deploy, and is the one who
  found both the CSS regression and the slow list index by looking at the live site.

## 3. Scope (as-built)

`[FROM FRAME]` The sandbox contains the modern product. Feature parity with staging is the baseline, not
an aspiration; the gap is closed and has a maintenance rule attached.

`[INFERRED]` What a user can do on tags.b.w today, over and above the main product:

- Pin a tag **within a community context** (LFO, "Tapestry & Web of Trust") alongside a neutral pin of
  the same tag; each is first-class with its own curation, Trusted List and export.
- Have each of those lists **scored** by the operator's chosen membership method — in practice
  `certainty` (weighted). Identity and scoring are independent: context decides *which* list, method
  decides *how* its members are ranked.
- Be **found by a third party**: "Trusted Lists about X in LFO" is a relay filter on the context stamp
  plus a local narrowing, not a private convention.
- Refresh the note list from the Pinned tab and get the **assistant-signed** list back — the same
  gesture other apps in the ecosystem are converging on — while keeping the personal bookmark export as
  a separate, deliberate act.
- Tag list items, browse `/lists` (paginated), and use every surface the main line has shipped since July.

**Out of the as-built scope, deliberately:** a single relay filter for "about X *and* in context C"
(deferred — it is a union plus a client predicate today); per-context labelling in the pinned panel;
republishing historical contextual lists (they re-derive on next refresh).

## 4. Domain model

`[INFERRED]` from the shipped concepts and wire shapes:

- **Tag** — the thing being curated. Identified by author + slug.
- **Pin** — a person's declaration that they curate a tag. Optionally carries a **context**. A pin is
  the identity of a curation.
- **Context** — a community, named by a firmware concept handle (`39998:<assistant>:lfo`,
  `…:tapestry-web-of-trust`). Contexts are a **closed, known set** today, not user-minted.
- **Trusted List** — the derived output of a pin: a profile list (30392) and a note list (30393),
  signed by the instance assistant. A contextual list carries its context as a **stamp**, and a
  private replaceability key that no reader is allowed to interpret.
- **Membership method** — how a list's members are scored (`count`, `input`, `certainty`). Operator
  config, pipeline-wide — *not* a per-pin choice, and deliberately not a dimension of context.

The load-bearing product rule, worth keeping in any future PRD: **identity and computation are separate
axes.** Folding "in LFO" into the scoring method was considered and rejected; it would make the method
registry a cross-product no settings UI could represent, and it would mis-site a trust question as a
list-identity question.

## 5. Design rules (as-built)

`[INFERRED]`; none of these was ever written as a product rule, which is itself the finding:

- A neutral pin must behave *exactly* as it did before contexts existed — byte-identical published
  output. Contexts are additive, never a migration.
- A context is shown to the world as a stamp others can filter on, never as a string others must parse.
- "Update the list" means the shared, assistant-signed list; "export" means your own signed copy. Two
  different gestures, two different affordances.
- Styling for a feature travels with the feature. (Learned the hard way: the contextual-pin styles were
  lost in a merge and the feature shipped visually broken until a screenshot caught it.)

## 6. Carry-forward & open questions

Promoted from audit §6:

- Option D — a context-scoped per-tag list header that would make "about X in context C" one relay
  filter. Deferred on usage grounds; revisit when the conjunction is a hot query.
- Contextual-pin hardening: an ignored refresh response, an export row that names an address nothing
  publishes, an unvalidated key (OPEN 299).
- The pinned panel does not tell the user which context they are looking at.
- Historical contextual lists carry no context stamp until they next refresh.

## 7. What product must validate

- [ ] **The pinned-tab information architecture.** A user can now hold N curations of the same tag
      (neutral + one per context), and the panel shows one at a time with no context label. What should
      the user see: a switcher, a list, a merged view? This is the largest unanswered product question
      the book leaves. `[UNKNOWN]`
- [ ] **Which contexts are "known," and who decides.** Contexts are a closed set in firmware today
      (LFO, Tapestry & WoT). Should users mint contexts? Should communities mint their own? The engineering
      shape supports opening this; the product has never been asked. `[UNKNOWN]`
- [ ] **What a context means across instances.** A context stamp is composed from the *instance's*
      assistant key, so a contextual pin mirrored to another deployment does not read as contextual there.
      This is a cross-instance product question — what does "pinned in LFO" mean when LFO is not one
      server's idea? Engineering detail and current behavior: OPEN 316 (opened by the sibling
      `search-index-selection` book — referenced, not duplicated here). `[UNKNOWN]`
- [ ] **Is the branch policy a product-process fact the product team should plan around?** As-built it
      is: tagging features ship to tags.b.w **first**, are exercised by real users there, and graduate to
      the main line by book close — with the main line pulled back in after every promotion. That makes
      tags.b.w a preview channel in practice. Product should decide whether to treat it as one
      deliberately (announce it, set expectations, accept feedback from it) or to keep it unlabelled
      engineering infrastructure. `[FROM FRAME]` for the mechanism, `[UNKNOWN]` for the positioning.
- [ ] **Whether "membership method" should ever be a user-visible choice** rather than operator config.
      Today the curator picks *what* to curate; the operator picks *how* it is scored. `[UNKNOWN]`
