# Phase 0: Intake

## Purpose
Triage an incoming request and decide which phases apply.

## Trigger
Any new user request.

## Steps

1. **Capture the raw request.** Don't paraphrase yet — record what the user actually said in `engineering-team/stories/_intake.md` (append-only log).
2. **Classify the request:**
   - Feature (new behavior)
   - Bug (existing behavior is wrong)
   - Refactor (no behavior change)
   - Doc / typo / one-liner
3. **Apply strictness rules.** This project = **Standard**.

   | Type | Strict | Standard | Lite |
   |---|---|---|---|
   | Feature | All phases | All phases | Architecture + Tests + Implement + Review |
   | Bug | All phases | Skip Architecture if obvious | Implementer + Reviewer |
   | Refactor | All phases | Skip Tests if no behavior change | Implementer + Reviewer |
   | Doc / one-liner | Skip Tests + Architecture | Skip Tests + Architecture | Implementer only |

4. **Bracket the book of work (eager anchor).** A *book* is a PRD (or one roadmap phase of one), or — with no PRD — a bounded ask. Decide whether this request starts a new book or joins an open one (`engineering-team/audits/*/book.md` with `Status: Open`):
   - **Joins an open book** → add its epic to that `book.md`. Nothing else to capture.
   - **Starts a new book, PRD-backed** → create `engineering-team/audits/<book-slug>/book.md` from `templates/book.md`, anchor pointing at the PRD §sections it realizes. Completion will be *computed*.
   - **Starts a new book, no PRD** → restate the ask as a short **acceptance frame** (a few bullets — what "done" means, in the user's own terms), confirm it, and save it in `book.md`. This is the durable definition of done: without it, completion can't be detected across sessions and the close drops to low-confidence. The frame doubles as the skeleton for the PRD seed at close.
   - *Doc / typo / one-liner requests don't need a book.*
5. **Confirm the path with the user.** "This looks like a {type} — under Standard, the path is: {phases}. OK?"
6. **Hand off** to the first applicable phase.

## Output
- A note in `engineering-team/stories/_intake.md` recording the request, classification, and chosen phase path.
- For a new book of work: an opened `engineering-team/audits/<book-slug>/book.md` carrying the intent anchor (PRD ref or acceptance frame). This is the open-bracket that the book-close milestone (`workflows/6-book-close.md`) reconciles against.
