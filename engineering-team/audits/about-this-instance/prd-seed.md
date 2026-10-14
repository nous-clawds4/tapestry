# PRD Seed: About this Brainstorm Instance

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/about-this-instance/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for scope and rules (the operator's words were quoted at kickoff and every change is a recorded decision). Low for the "why" beyond the operator's one-line ask, marked `[UNKNOWN]` below.
**Date:** 2026-10-14

> This is a **reverse-engineered baseline** in PRD shape, built from what shipped. It is a strawman for the product team, not a ratified spec. Tags:
> - `[FROM FRAME]`: from the kickoff acceptance frame or the operator's recorded decisions.
> - `[INFERRED]`: read off the as-built system.
> - `[UNKNOWN — product input needed]`: needs a product decision.

## 1. Product vision

- `[FROM FRAME]` A visitor to any Brainstorm instance can see **who stands behind it**: the Owner, the Admins, and how many customers the instance serves. They see it on the instance's own `/about` page, and `/about-brainstorm-search` links to it.
- `[INFERRED]` **Trust and accountability.** Brainstorm is decentralized, and many instances run the same software under different operators. A visitor deciding whether to trust an instance, or sign up on it, benefits from seeing whose instance it is and how established it is.
- `[UNKNOWN — product input needed]`
  - Whether the count is meant as a trust signal ("this instance is established") or a growth or marketing number.
  - Whether instances should be comparable to each other.

## 2. Personas

- `[FROM FRAME]` **The visitor**, signed in or not: anyone landing on an instance's About page.
- `[INFERRED]` **The prospective customer**, deciding whether to sign up on this instance rather than another.
- `[INFERRED]` **The operator**, an Owner or Admin, whose identity is now shown publicly.
- `[UNKNOWN]` Whether operators want any control over being shown, for example opting an Admin out.

## 3. Scope (as-built)

`[FROM FRAME]`:
- The section "About this Brainstorm Instance" at the bottom of `/about`, with the subtitle "Who runs this instance, and how many customers it serves."
- An Owner card, and Admin cards with the count beside the Admins heading.
- Each card shows the name, the NIP-05 address and the picture, or a shortened npub, and opens the person's profile.
- "No admins" when there are none.
- A large customer number, "N customers" or "1 customer".
- The link "About this Brainstorm Instance" on `/about-brainstorm-search`.
- The data is public on purpose.

`[INFERRED]`:
- The states "Loading…", "Couldn't load this instance's details.", "Customer count unavailable" and "No owner configured".
- Each instance shows its own people; nothing changes with the viewer's point of view.

**Out of scope, as decided:**
- listing customers individually;
- changing how roles are assigned;
- merging the two About pages;
- live-updating numbers.

## 4. Domain model

`[INFERRED]` Instance roles, which are not concept-graph concepts:
- **Owner:** configured as `BRAINSTORM_OWNER_PUBKEY`.
- **Admins:** settings `adminPubkeys`, else the config value `BRAINSTORM_ADMIN_PUBKEYS`.
- **Assistant:** a delegate key the instance holds for an account: the TA for the Owner, and one key file per other account.
- **Customer** `[FROM FRAME]`: an account the instance holds an Assistant key for, minus the Owner, the Admins, and any Assistant the instance holds the key for. There is no active/inactive distinction.

`[INFERRED]` This "customer" differs on purpose from the customer *list* that sign-in and the admin pages use, so the two numbers can disagree.

## 5. Design rules (as-built)

- `[FROM FRAME]` The layout comes from the Claude Design "About this Brainstorm" screen: person cards with a chevron, a count chip, and a large number. The colours are `/about`'s existing dark styling.
- `[INFERRED]`
  - Profile data is untrusted: only text fields are shown, and anything else falls back to the shortened npub.
  - A failure in the section never affects the rest of `/about`.
- `[UNKNOWN]` No shared design-guide entry exists for "person card" or "count tile". They were built inline.

## 6. Carry-forward & open questions

Promoted from audit §6. The candidates for the next phase:

1. **Customer identities are already public** (`/api/get-customers`, the roster, and the app shell's roster fetch on every page). Keep that, or narrow it? Queued in `_intake.md` (2026-10-13).
2. **Production.** The feature is on staging only.
3. **Engineering follow-ups on the public read.** Log volume and per-visit cost; directory creation on first use; detecting a rotated master key.
4. **Accessibility.** Section labels as headings, a live region for loading, and whole-grapheme initials.
5. **The two About pages** (`/about`, `/about-brainstorm-search`) still overlap; this book linked them rather than merging them.

## 7. What product must validate

- [ ] **Is the customer count the right public number?** Should it count only active customers, or show customers at all? (The operator chose "a customer is a customer" for simplicity, on 2026-10-13.)
- [ ] **Should Admins be able to opt out of being listed publicly?**
- [ ] **Should customer identities stay public elsewhere?** (§6 item 1.) The answer may change how this page frames "customers".
- [ ] **Should the two About pages be merged**, now that `/about` carries the instance's own details?
- [ ] **Should person cards and count tiles become design-guide patterns** for reuse?
