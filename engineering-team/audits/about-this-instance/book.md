# Book of Work: About this Brainstorm Instance — Owner, Admins, and Customer count on /about

**Slug:** about-this-instance
**Status:** Open
**Opened:** 2026-10-13
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the operator's ask, restated at planning (2026-10-13) and settled through two rounds of questions. Completion is *judged* against the bullets below.

The ask, verbatim, in the order it was given:

> I would like to create a new page modeled after the About page in the artifact by Claude Design. It will link to the user profiles of the accounts of the Owner and each Admin, and show the number of Customers. To get to this page, there will be a link entitled: "About this Brainstorm Instance" that is on the https://staging.brainstorm.world/about-brainstorm-search page and that takes us to https://staging.brainstorm.world/about-this-instance. Does this make sense?

> I just realized we have two about pages, including the /about one. Let's change the plan slightly. Let's modify the /about page and add the new data as a new section at the bottom of this page.
>
> Yes, the intention is to make this data public.
>
> To keep things simple, let's not distinguish between active customers and inactive customers. A customer is a customer. If an npub has an Assistant nsec, it is a customer, unless it is the Owner or an Assistant.

> Exclude admins, yes add the link, start /plan-feature

> Yes to both, save the story

### Decisions taken at planning (2026-10-13)

1. **A section on `/about`, not a new page.** The separate `/about-this-instance` route was dropped once the operator noticed `/about` already exists.
2. **Public on purpose.** The Admin list and the customer total become public. Customer identities do not.
3. **Customer = holds an Assistant key**, minus the Owner, the Admins, and any account that is itself an Assistant. No active/inactive distinction. *(Admins excluded: chosen over counting an Admin with a key as a Customer too.)*
4. **The link stays**, retargeted to `/about#this-instance`.
5. **Layout from the Claude Design artifact, colours from `/about`'s existing dark styling.** *(Chosen over importing the design's light palette.)*
6. **Wording:** title "About this Brainstorm Instance"; subtitle "Who runs this instance, and how many customers it serves."; count line "**N** customers". *(Chosen over the design's "how many people use it", since the number counts customers, not visitors.)*

### Acceptance frame

- [ ] `/about` ends with an "About this Brainstorm Instance" section showing the Owner, the Admins with their count, and the Customer count. The Owner and Admin cards open their profiles.
- [ ] The Customer count follows decision 3.
- [ ] The section's data is public, and nothing on the page or behind it reveals a customer's identity or any key material.
- [ ] `/about-brainstorm-search` carries an "About this Brainstorm Instance" link that lands on the section.
- [ ] Live and verified on `staging.brainstorm.world`.

## Epics in this book

- `about-this-instance` — story 1 (the `/about` section, its public read, and the link).

## Strictness

**Standard, all five phases.** Unlike the `about-brainstorm-search` book (static pages, built without an ADR or tests), this book adds a public data read and a disclosure decision, so it gets an ADR and failing tests.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/about-this-instance/audit.md`
- Product feedback: `engineering-team/audits/about-this-instance/prd-seed.md`
