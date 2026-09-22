# A finished book leaves no trace when its close is offered in chat and not taken, and nothing surfaces it — `site-trust-signals` sat Open for 41 days

**Id:** 2026-09-22-finished-books-have-no-close-surface
**Type:** meta
**Opened:** 2026-09-22 (site-trust-signals book close, retro §7)
**Status:** OPEN
**Done:** —

The book's only story passed review on 2026-08-12, and completion detection ran then. The review's
"On PASS" box reads: "Completion detection performed — result recorded in chat, not here". The book
was not closed that day. It stayed `Open` until 2026-09-22, 41 days later (`harness-stats.sh`:
`site-trust-signals: open, 41d`). By comparison, the 56 closed books have a median of 1 day and a
maximum of 12.

**The rules make an untaken offer invisible.** `templates/review-checklist.md:66` sends the
completion-detection result to "the chat (human-gated) — never in this file". The "Completion
detection" section of `workflows/5-review.md` says a not-yet answer means "leave the book `Open`,
write nothing". Once that session ends, a finished book looks exactly like one still in flight.

**And nothing looks for one.** `/whats-open` lists open books but not which of them are finished
(`scripts/whats-open.sh` has no such check), and the session-start digest only names them. This book
was found by the 2026-09-13 triage, which hand-wrote close packets for it and for
`tl-weighted-certainty`. The triage board titles one of them "Close a finished book nobody closed".

**Fix shape.** Either works; (a) is cheaper and also catches the old cases.
- (a) `/whats-open`, or the session-start digest, flags each open book whose epics have no story left
  that isn't `Done`: "finished — offer /close-book".
- (b) When an offer is declined or deferred, write one line into `book.md`
  (`Close offered <date>; deferred`) instead of nothing.

**Ports to Direction mode:** mostly not. A Direction book closes in the same run, through Stage 3's
completion judge, so the gap belongs to the human-gated flow.

**Pointer:** `engineering-team/audits/site-trust-signals/audit.md` §7; `engineering-team/workflows/5-review.md`
("Completion detection"); `engineering-team/templates/review-checklist.md:66`.
