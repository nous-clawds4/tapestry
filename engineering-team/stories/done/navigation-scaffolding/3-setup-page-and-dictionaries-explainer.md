# Story 3: Trusted Agents "Set Up" page, and the Dictionaries explainer

**Status:** Done
**Created:** 2026-09-08
**Type:** Feature

## Background

Two additions the operator raised after Stories 1 and 2 shipped:

1. **A seventh placeholder page.** Trusted Agents needs a third sub-item, **Set Up** — where a
   user pairs a *Sponsor* with an *Agent*. Neither term exists in the concept graph yet; the page
   stays a placeholder like its siblings.
2. **Real copy on the Dictionaries index.** Unlike the other five placeholders, this page's
   content is already known — the operator supplied it verbatim. It sets out what a dictionary is
   (a concept whose elements are its entries, or a DList header whose items are, for users
   without their own neo4j), how entries get in (community usage and acceptance, measured
   differently per dictionary and evolving over time), and the two consequences that follow:
   automatic add/remove needs a validity flag on the header, and hand-curation by the dictionary's
   steward needs an added-by-hand field so scripts don't undo it.

The second is the more load-bearing of the two: it is the first written statement of the
dictionary data model, and later work will be built against it.

### The explainer text — durable baseline

This is the operator's message, exactly as sent (2026-09-08). It is reproduced here because the
only other copy in the repository is the JSX itself, which would make "it is verbatim" a
self-certifying claim: a future paraphrase would have nothing to be caught against. Diff the
rendered prose of `ui/src/pages/dictionaries/Placeholders.jsx` against this block, not against any
summary of it. 1489 characters, three paragraphs on the page, sentence-boundary breaks only.

```text
There are currently three dictionaries: Tags, DLists, and Concepts. More will be added later. Each Dictionary is a concept, and each dictionary entry is an element of its corresponding concept. (But that only works for the Tapestry Owner. And so: Conversely, for users who do not have their own neo4j: each dictionary may be a DList Header, and each dictionary entry may be an item on that dlist.) The primary criteria to be an element (or item) of any given dictionary is usage and acceptance by the community. There may be more than one way to measure usage and acceptance, and the precise criteria for any given dictionary may evolve over time. This is exemplified by Tags: criteria may be based on direct usage, on b-tags, and/or on pins. These criteria can be used to keep track of dictionary entries dynamically and automatically. Which means that dictionary entries can be added and removed automatically. Which means there needs to be a property specified by the DList header (or Concept Header) to flag elements / items that are considered no longer valid items. But there is a second way to gain entry into a dictionary, and that is to be added by hand by the steward of the dictionary. For Tapestry, that typically means: the owner of the Tapestry instance. Being added by hand will override community-based criteria. Therefore, each dictionary concept needs to have a field to keep track of whether it is added by hand, lest it be removed from the concept by automated scripts.
```

*(Added after the Story-3 review, which could only verify the text against a session transcript —
see that review's finding on the missing baseline.)*

## User-facing description

As the operator, I want a Set Up page under Trusted Agents and the dictionary model written out on
the Dictionaries page, so that the pairing flow has a home in the navigation and the dictionary
design is recorded where the feature lives rather than only in chat.

## Acceptance criteria

- [ ] Given the Trusted Agents group is open, then its children are, in order: **Mine**, **All**,
      **Set Up**.
- [ ] Given the Set Up nav link, when it is followed, then `/tapestry/trusted-agents/setup` renders
      a placeholder page that names what it will do — pair a Sponsor with an Agent.
- [ ] Given `/tapestry/dictionaries`, when it renders, then it carries the operator's explainer
      text **verbatim** — no words added, removed, or reworded. Paragraph breaks for readability
      are allowed.
- [ ] Given that page, then the explainer reads as body prose (left-aligned, measure-limited),
      not as centered placeholder-box text.
- [ ] Given that page, then it still marks itself a placeholder — the copy describes the model,
      it does not mean the surface is built.

## Also in this commit — Reviewer findings from Stories 1–2

Both non-blocking, both raised in `reviews/navigation-scaffolding/2-unified-avatar-menus.md`:

- [ ] `.bs-usermenu-admin-*` in `ui/src/styles.css` is orphaned by Story 2 (the last references
      went with the admin panel). Deleted here, while the provenance is still obvious.
- [ ] `Header.jsx` renders the disabled assistant item as `<button disabled title=…>`. Firefox
      suppresses pointer events on disabled form controls, so that tooltip can silently fail —
      the exact case Story 2's AC-4 exists for. Brought into line with the other two menus.

## Concepts touched

None wired. Named for orientation only:

- `tapestry assistant` — nearest existing concept to the "Agent" half of Sponsor/Agent pairing
- `tag`, `list`, `concept header` — the three dictionaries the explainer names

## Out of scope

- Building the pairing flow, or defining what a Sponsor is.
- Implementing anything the explainer describes: the validity flag, the added-by-hand field, the
  usage/acceptance measures, or the DList-header fallback for users without neo4j. The text is a
  statement of intent on a placeholder page, not a spec being built to.
- Reviewer finding 3 (the `external` flag is only consumed by `Header.jsx`) — a future-proofing
  note, no defect today.
- Reviewer finding 4 (`/legacy/*.html` has no auth check) — pre-existing, unrelated to this diff;
  filed to `_intake.md` instead.

## Open questions

None.

## Linked artifacts
- ADR: none (abbreviated path)
- Test plan: none (abbreviated path)
- Review: `engineering-team/reviews/navigation-scaffolding/3-setup-page-and-dictionaries-explainer.md`
