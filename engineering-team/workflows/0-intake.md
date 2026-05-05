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

4. **Confirm the path with the user.** "This looks like a {type} — under Standard, the path is: {phases}. OK?"
5. **Hand off** to the first applicable phase.

## Output
A note in `engineering-team/stories/_intake.md` recording the request, classification, and chosen phase path.
