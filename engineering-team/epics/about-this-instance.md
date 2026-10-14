# Epic: about-this-instance — who runs this Brainstorm instance, on /about

**Created:** 2026-10-13
**Status:** Active
**Book:** `engineering-team/audits/about-this-instance/book.md` (no PRD — acceptance frame)
**Provenance:** the operator's ask of 2026-10-13, quoted in the book and settled through two rounds of questions at planning.

## Goal

**Tell a visitor who stands behind the instance they are on.** The `/about` page gains a section, "About this Brainstorm Instance", showing the Owner, the Admins (with a count), and the number of Customers. Each person links to their profile. `/about-brainstorm-search` links to the section. The Admin list and the customer total become public on purpose. This feature adds no customer identity to what is public.

## Stories

`stories/about-this-instance/`:

1. `1-owner-admins-customer-count.md` — the `/about` section, the public read behind it, and the link from `/about-brainstorm-search`. Approved 2026-10-13; ADR `decisions/about-this-instance/0001` accepted 2026-10-13; **Done** 2026-10-14 (review PASS in round 2; live on staging).

## Key facts / guardrails

- **Customer, as the operator defined it (2026-10-13):** an account this instance holds an Assistant key for, minus the Owner, the Admins, and any account that is itself an Assistant. No active/inactive distinction. This differs on purpose from the customer list that sign-in and the admin pages use.
- **This feature's disclosure ceiling.** It exposes the Owner's and Admins' pubkeys and one number, and never any customer's pubkey, name or directory, or any key material; counting never decrypts a private key (ADR 0001). Customer pubkeys and names are already public through `GET /api/get-customers` and `GET /api/assistant/roster` (ADR `author-scoped-inspection/0001`); whether they should stay so is queued in `_intake.md` (2026-10-13), outside this epic.
- **Per instance, not per viewer.** Each deployment shows its own people and count. Nothing here depends on the viewer's point of view.
- **The auth layer is default-deny for actions** (`security-auth-exposure` #8, ADR 0005). The new data is a public read, so it needs an explicit place in that route table rather than a gap in it.
- **Not a reconciliation of the About pages.** `/about` and `/about-brainstorm-search` both stay. The overlap was deferred by the `about-brainstorm-search` book and is still deferred.
