# A full staging promotion carried an open book's stories to production before the staging check its acceptance frame required, and `/cycle-prod` doesn't look at book frames

**Id:** 2026-10-10-promotion-ignores-book-staging-condition
**Type:** meta
**Opened:** 2026-10-10 (book `relay-stream-gaps` close, audit §4 #11 and §7)
**Status:** OPEN
**Done:** —

**What was seen.** Book `relay-stream-gaps`'s acceptance frame ends with "Each of the above is verified on staging before
production." PR #829, a full `staging` → `main` promotion merged at 20:13Z on 2026-10-09 (`deploy-tapestry` run #140),
carried that book's stories 1–2 (#826). At that point their staging check had not happened:
- bullet 1 (stream changes don't interrupt others) had not been checked live;
- bullet 2's gap closure was still at limit 5, which the staging data showed was not enough.

Both were checked about six hours later (2026-10-10, about 02:05–02:33Z), and both held. The PR body was candid: it
listed "Book `relay-stream-gaps` (#826; stories 1–2 reviewed PASS; book still Open)". But it did not say that the
book's frame conditioned production on a staging check, and nothing in `.claude/skills/cycle-prod/SKILL.md` reads open
books' frames. Whether the owner meant to waive the bullet is not recorded.

The outcome was harmless: the reload and the limit patch work, and production's saved limits (5, 0 or none) keep the
refetch small. The same path would ship an unverified change anywhere a frame asks for staging first.

**Fix shape.** When `/cycle-prod` builds the bundle, list each open book whose stories ride it. Quote any frame bullet
that conditions production (for example "verified on staging before production") with its current state. The approval
then covers that bullet explicitly: verified, or waived for this promotion. A selective promotion (`87f8f2b5`, PR #827)
is the existing way to leave such stories behind. This touches a harness-definition path and owes a CHANGELOG row.
Ports to both flows: a Director that runs a promotion meets the same gap.

**Pointer:** `engineering-team/audits/relay-stream-gaps/audit.md` §4 #11; PR #829 (body, "Bundled");
`engineering-team/audits/relay-stream-gaps/book.md` § Acceptance frame and § Staging verification;
`.claude/skills/cycle-prod/SKILL.md`.
