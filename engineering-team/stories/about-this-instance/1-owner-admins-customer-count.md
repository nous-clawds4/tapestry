# Story 1: About this instance — Owner, Admins, and Customer count on /about

**Status:** Approved
**Created:** 2026-10-13
**Type:** Feature

## Background

A visitor to a Brainstorm instance cannot tell who runs it. The `/about` page describes Brainstorm in general (what it is, that NosFabrica builds it, that it is open source) but says nothing about *this* instance. Each deployment (tapestry, staging, tags, and any other) has its own Owner and Admins and serves its own customers, so the answer differs per instance.

Today only the Owner's identity is publicly readable. Only the Owner can see the Admin list, and only the Owner and signed-in customers can see the customer list. The operator decided on 2026-10-13 to make the Admins and a customer **total** public. Customer identities stay private.

The layout comes from the "About this Brainstorm" screen in the Claude Design artifact *Brainstorm onboarding flow design* (<https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m>): an Owner card, an Admins list with a count beside its heading, and a large Customer count. Each person card opens that person's profile. An earlier idea of a separate `/about-this-instance` page was dropped in favour of a section on the existing `/about` page, since that page already exists and covers the same ground.

## User-facing description

As a visitor to a Brainstorm instance, I want to see who owns and administers it and how many customers it has, so that I know who stands behind the instance before I trust it or sign up.

## Definitions (operator, 2026-10-13)

- **Owner**: the account configured as this instance's owner.
- **Admin**: an account configured as an admin of this instance. An account that is both Owner and Admin is shown only as Owner.
- **Customer**: any account for which this instance holds an Assistant key, **except** the Owner, an Admin, or an account that is itself an Assistant. Active or inactive status is ignored: a customer is a customer. An account on the customer list with no Assistant key is not counted.

## Acceptance criteria

- [ ] **AC1: the section.** Given any visitor, signed in or not, when they open `/about`, then a new section titled **"About this Brainstorm Instance"** appears below the existing content, with the subtitle **"Who runs this instance, and how many customers it serves."** The existing content is unchanged, and opening `/about#this-instance` lands on the section.
- [ ] **AC2: Owner and Admins.** Given an instance with an Owner and N Admins, when the section loads, then it shows one Owner card and N Admin cards, with N shown beside the Admins heading.
  - Each card shows the person's profile name, and their NIP-05 address when they have one. When their profile is not known, it shows a shortened npub instead.
  - Clicking a card opens `/user/<that person's pubkey>`.
  - With zero Admins, the count reads 0 and a short "No admins" note replaces the list.
- [ ] **AC3: Customer count.** Given an instance that holds Assistant keys for the Owner, an Admin, an active customer, an inactive customer, and an account that is itself an Assistant, and that also lists one customer with no Assistant key, when the section loads, then it reads **"2 customers"**.
- [ ] **AC4: public, but only these facts.** Given a visitor who is not signed in, when they open `/about`, then the section's data loads. Nothing the page displays or loads reveals any Customer's pubkey, name, or other identity, or any key material. The only things exposed are the Owner's and Admins' pubkeys and the customer total.
- [ ] **AC5: the link.** Given a visitor on `/about-brainstorm-search`, when they click **"About this Brainstorm Instance"**, then they land on `/about` at the new section.
- [ ] **AC6: failure stays contained.** Given the instance data cannot be loaded, when a visitor opens `/about`, then the rest of the page renders normally and the section shows a short "couldn't load" message instead of being blank or broken.

## Look and wording (operator, 2026-10-13)

- **Layout from the design, colours from `/about`.** The section follows the design's layout: person cards with a chevron, a count beside the Admins heading, and a large customer number. It uses the existing `/about` page's dark styling rather than the design's light palette, so it reads as part of the page.
- **Wording.** Title "About this Brainstorm Instance". Subtitle "Who runs this instance, and how many customers it serves." Count line "**N** customers". The design's subtitle said "how many *people* use it", but the number counts customers, not every visitor.

## Concepts touched

The local stack was not running in this session, so these are named in plain language; the Architect should resolve handles where they exist.

- **Owner, Admin, Customer**: instance roles. Read only; how roles are assigned is unchanged.
- **Assistant**: the delegate key this instance holds for an account. Read only; it defines who counts as a Customer.
- **Nostr profile (kind 0)**: supplies the names and NIP-05 addresses shown on the cards. Read only.

These are facts about the instance, the same for every viewer. Nothing in this story depends on the viewer's point of view.

## Out of scope

- Listing customers individually, or showing any customer's identity.
- Changing how Owner, Admin, or Customer roles are assigned, or how sign-in decides who is a customer. Sign-in keeps using the customer list's active status. The public count deliberately uses the Assistant-key rule above, so it can differ from the customer list on the admin pages.
- A separate `/about-this-instance` page (dropped), and any further reconciliation of `/about` with `/about-brainstorm-search`.
- The design's other screens, including its own user-profile screen: cards open the existing profile page.
- Live-updating numbers. The figures are as of page load.

## Open questions

All resolved by the operator on 2026-10-13:

1. Make the Admin list and the customer total public? **Yes.**
2. Distinguish active from inactive customers? **No**: a customer is a customer.
3. Count an Admin who has an Assistant key as a Customer? **No**: Admins are excluded.
4. Link from `/about-brainstorm-search`? **Yes**, to `/about#this-instance`, labelled "About this Brainstorm Instance".
5. Visual treatment? **Layout from the design, colours from `/about`.**
6. Wording? **As in "Look and wording" above.**

## Linked artifacts

- Book: `engineering-team/audits/about-this-instance/book.md`
- Design: Claude Design artifact *Brainstorm onboarding flow design*, "About" screen (<https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m>)
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
