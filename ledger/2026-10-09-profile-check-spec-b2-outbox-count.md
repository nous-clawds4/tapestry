# assistant-profile-check.spec.js B2 cannot pass as written, even after assistant-profile-checklist #1 lands

**Id:** 2026-10-09-profile-check-spec-b2-outbox-count
**Type:** bug
**Opened:** 2026-10-09 (assistant-trusted-content-status #1, review)
**Status:** OPEN
**Done:** —

`tests/brainstorm/assistant-profile-check.spec.js` B2 expects the pill at `PLACEHOLDERS + 1`, with `PLACEHOLDERS =
X.ACTIONS.length − 2`. Its mocked attention answers carry no `outbox-relays` key. Outbox Relays has been a checked
action since assistant-outbox-relays #1, and a checked action with no answer is never counted. So the pill reads 9
against 10: on staging today, on feat/assistant-trusted-content-status, and also once the profile book's check lands.
The outbox merge re-aimed the other shared specs but not this one. Not caused by assistant-trusted-content-status #1:
its `TC.withTrio` wrapper is count-neutral there, and the staging build fails the same way.

Fix shape (the profile book's Implementer, or its Tester lane): give `mock()` an Outbox Relays answer, e.g. wrap it as
`tests/brainstorm/assistant-alert.spec.js` does with `O.attentionWith(...)`, or derive `CHECKED` from the actions.

**Pointer:** `engineering-team/reviews/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md` § Harness friction 2
