# Epic: Recognizable TA Avatar

**Status:** Done
**Created:** 2026-08-06
**Book:** `engineering-team/audits/ta-avatar/book.md` (no PRD — acceptance frame confirmed at kickoff)

## What this is

The Tapestry Assistant signs much of what an instance shows — concept-graph nodes, lists, trusted
lists, tapestries — yet it is visually anonymous. In our own UI it renders as an empty grey disc;
on nostr at large its published profile has no picture at all, so third-party clients show a blank
avatar named "Tapestry Assistant" with no visible connection to the instance owner.

This epic gives the TA one recognizable visual identity, built from two ingredients the viewer
already knows: **the owner's avatar** (says *whose* assistant) and **the brain-with-lightning brand
mark** (says *it's the assistant*). The identity appears in three layers, one story each:

1. live, wherever our UI renders the TA as an author;
2. as branded, owner-linked defaults in the TA's published nostr profile;
3. as the full composite — the owner's avatar with the mark stamped on one side, baked into a
   single picture and published as the TA's profile picture for every nostr client to see.

## Stories

`stories/ta-avatar/` — ordered; each is independently shippable, and each builds on the one before
(the badge artwork defined in story 1 is the same mark stamped in stories 2–3; story 3 falls back
to story 2's branded picture when the composite can't be made).

1. **in-app-badged-ta-avatar** — everywhere our UI shows the TA as an author, render the owner's
   avatar with the brand-mark badge on one corner, with honest fallbacks (never a blank disc or a
   broken image).
2. **recognizable-published-ta-profile** — the TA's *default* published profile carries a branded
   picture hosted by the instance and a name that links it to the owner, so third-party clients
   stop showing a blank.
3. **stamped-composite-avatar-on-nostr** — the owner generates, previews, and publishes the actual
   composite (their avatar + the mark) as the TA's profile picture; it survives redeploys and can
   be regenerated at will.

## Decisions ratified at Planning (2026-08-06)

1. **Scope is the full composite, published** — chosen explicitly by the owner from three offered
   scopes (in-app only / in-app + branded published defaults / full composite published). The
   in-app layer and the branded defaults remain in scope as layers 1–2 of the same identity, not as
   alternatives.
2. **The mark is the existing brain-with-lightning-bolt icon** — the one the product already uses.
   No new logo is being designed; derived variants (badge chip, branded picture) must read as the
   same mark.

## Key facts / guardrails

- **The TA pubkey is per-deployment and must never be hardcoded** — every layer resolves it at
  runtime (CLAUDE.md house rule). A literal TA pubkey anywhere in this epic's diffs is a
  review-blocking defect.
- **Degrade honestly.** Owner without an avatar, unreachable picture, instance without a public
  address — each case shows or publishes something branded, or omits the field, but never a blank
  disc, a broken-image glyph, or a dead public link.
- **Publishing stays owner-consented.** Nothing in this epic force-rewrites an already-published
  assistant profile; changes reach nostr only when the owner (re-)publishes.
- **Existing text affordances stay.** The 🤖 labeling in author-filter dropdowns is unchanged by
  this epic — the badge augments surfaces that can render images; it does not remove the text cue
  from those that can't.

## ADRs

`decisions/ta-avatar/` — created per story at Architecture.
