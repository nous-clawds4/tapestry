# An ADR's universal claim ("nothing else signs …") reached BIBLE and the API document with no phase verifying it

**Id:** 2026-09-22-universal-claim-without-proving-command
**Type:** meta
**Opened:** 2026-09-22 (assistant-identification-tags #3, review round 1 § Harness friction 1)
**Status:** OPEN
**Done:** —

**What was seen.** ADR 0003 sub-decision 11 prescribed a sentence for BIBLE § Assistant Keys — an Assistant's key
signs "its profile and its two identification taggings, and nothing else outside the generic signer's owner-only
path" — and the Implementer carried it into the module header, the route comment, the OpenAPI description and two
BIBLE lines. It was false: `grep -rn 'getAssistantKeys(\|getOwnerAssistantKeys(\|finalizeEvent(' src` shows the
curated-DList header and update routes signing with the person's own Assistant key on request, and the trusted-list
and normalization routes signing with the TA on request. The Architect asserted it without a command, the Implementer
copied it, the Tester pinned only the route's own behaviour, and the Reviewer found it with one grep. The memory note
"verify universal and ordering claims" already says this for records; it did not reach the ADR template or the
review checklist.

**Fix shape.** In `templates/adr.md` § Context or § Decision: a universal claim ("the only", "nothing else", "never",
"every") is written with the command that proves it, or not written. In `templates/review-checklist.md` § Things
tests can't catch: "universal claims in the diff's comments and docs re-run their proving command". Optionally a
lint check for those words in a new ADR without a fenced command nearby.

**Pointer:** review `engineering-team/reviews/done/assistant-identification-tags/3-your-assistants-two-taggings.md`
§ Blocking 1 and § Harness friction 1; ADR 0003 Amendment 1.

**Second sighting (2026-09-22, identification-tags-authorship #1, review § Harness friction).** The ADR wrote its
proving command down but nobody ran it before Review: `grep -rn "CANONICAL_TAG_AUTHOR\|canonicalTagAddress" src
ui/src test tests` prints the two test guards that assert the names are gone, so the ADR's "must print nothing" was
one scope too wide. Writing the command is half the rule; running it and recording its output is the other half.
