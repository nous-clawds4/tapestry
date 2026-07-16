# Phase 0: Intake

## Purpose
Triage an incoming request and decide which phases apply.

## Trigger
Any new user request.

## Steps

1. **Capture the request if it's being queued rather than worked.** `engineering-team/stories/_intake.md` is the optional catalog for **queued-but-unformalized** work (see README § "Epic-scoped docs") — use it when a request is being deferred, or when triage surfaces follow-ups that won't be worked now. A request going straight into a story does not need an intake entry; the story is its record.
   - **Closing marker:** when an intake entry is later promoted or resolved, append a marker line at the top of its block — `**PICKED UP** <date> → <story/book/epic path>` or `**RESOLVED** <date> — <commit/PR/pointer>`. `scripts/whats-open.sh` treats unmarked entries as open; an unmarked-but-done entry is noise for every future session.
2. **Classify the request:**
   - Feature (new behavior)
   - Bug (existing behavior is wrong)
   - Refactor (no behavior change)
   - Doc / typo / one-liner
3. **Apply strictness rules.** This project = **Standard**. **This table is the single normative copy** — CLAUDE.md and roles/product-owner.md link here; don't restate it elsewhere.

   | Type | Strict | Standard | Lite |
   |---|---|---|---|
   | Feature | All phases | All phases | Architecture + Tests + Implement + Review |
   | Bug | All phases | Skip Architecture if obvious | Implementer + Reviewer |
   | Refactor | All phases | Skip Tests if no behavior change | Implementer + Reviewer |
   | Doc / one-liner | Implementer + Reviewer | Implementer + Reviewer | Implementer + Reviewer |

   *(A hotfix shipped outside the cycle entirely — operator present, trivial change — is allowed but must leave a trace: one OPEN.md row or intake line naming the commit.)*

4. **Bracket the book of work (eager anchor).** A *book* is a PRD (or one roadmap phase of one), or — with no PRD — a bounded ask. Decide whether this request starts a new book or joins an open one (`engineering-team/audits/*/book.md` with `Status: Open`):
   - **Joins an open book** → add its epic to that `book.md`. Nothing else to capture.
   - **Starts a new book, PRD-backed** → create `engineering-team/audits/<book-slug>/book.md` from `templates/book.md`, anchor pointing at the PRD §sections it realizes. Completion will be *computed*.
   - **Starts a new book, no PRD** → restate the ask as a short **acceptance frame** (a few bullets — what "done" means, in the user's own terms), confirm it, and save it in `book.md`. This is the durable definition of done: without it, completion can't be detected across sessions and the close drops to low-confidence. The frame doubles as the skeleton for the PRD seed at close.
   - *Doc / typo / one-liner requests don't need a book.*
5. **Confirm the path with the user.** "This looks like a {type} — under Standard, the path is: {phases}. OK?"
6. **Hand off** to the first applicable phase.

## Output
- For queued/deferred work: an entry in `engineering-team/stories/_intake.md` recording the request, classification, and chosen phase path (see step 1 — optional for requests going straight into a story).
- For a new book of work: an opened `engineering-team/audits/<book-slug>/book.md` carrying the intent anchor (PRD ref or acceptance frame). This is the open-bracket that the book-close milestone (`workflows/6-book-close.md`) reconciles against.
