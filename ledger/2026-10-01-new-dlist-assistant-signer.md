# New DList's "Sign as Assistant" always signs as the Owner's Assistant, and any admin (or a no-session loopback call) can use it

**Id:** 2026-10-01-new-dlist-assistant-signer
**Type:** bug
**Opened:** 2026-10-01 (list-headers-disposition intake, book decision 5)
**Status:** OPEN
**Done:** —

**What was seen.** New DList (`ui/src/pages/lists/NewDList.jsx`) offers to sign the new header as the Assistant. It
sends `signAs: 'assistant'` to `POST /api/strfry/publish`, which signs with the Owner's Assistant key
(`getOwnerAssistantKeys()`) behind `isOwner(req) || req.localTrusted` (`src/api/strfry/commands/publishEvent.js:53`).
`isOwner` admits admins. So an admin's "Sign as Assistant" header is authored by the Owner's Assistant, not their own,
and a customer can't create an Assistant-signed header at all.

This is the flaw OPEN.md row `2026-10-01-concept-headers-disposition-owner-signer` records, on a different surface. The owner
put it out of scope for the List Headers book (decision 5) so the two are fixed together.

**Fix shape.** Sign with the Assistant this instance holds for the signed-in person (the dlist-curation precedent,
`src/api/dlist-curation/index.js:246`), refuse no-session calls, and let customers use it. Check every other
`signAs: 'assistant'` caller before changing the endpoint; it is shared.

**Pointer:** `engineering-team/audits/list-headers-disposition/book.md` § Decisions at intake, decision 5.
