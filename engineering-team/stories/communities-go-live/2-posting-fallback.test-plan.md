# Test Plan: Story 2 — Conversation stays open when the trust source is unreachable

**Story:** `engineering-team/stories/communities-go-live/2-posting-fallback.md`
**ADR:** `engineering-team/decisions/communities-go-live/0032-degraded-posting-fallback.md`
**Date:** 2026-06-06

## Approach
The gate's behavior is already covered by `test/posting-gate.test.js` (Story 47), which is the **single source of truth** for the composer gate: a pure-eval mirror of `canCompose` plus a source-guard (T6) regex-pinning the real gate line. Option B evolves that exact gate, so this story **extends that suite** rather than adding a parallel mirror that could drift. The mirror is updated to Option B; new behavior tests T7–T11 cover the degraded path; T6's source guard is updated to pin the new gate + the degraded note. Per the repo's test style (`node test/test.js`: pure-fn eval + source-regex guard), the **fail-first** signal is the updated source guard — it fails against the current source and passes once the Implementer writes Option B.

## Coverage map
| Criterion (story) | Test | File | Level |
|---|---|---|---|
| AC1 usable composer when unreachable (refined: founder/joined) | T7, T8 | `test/posting-gate.test.js` | unit (mirror) |
| AC2 calm degraded note, no error tone | T6 (source guard: note copy present) | `test/posting-gate.test.js` | source guard |
| AC3 founder in brand-new degraded circle can post | T7 | `test/posting-gate.test.js` | unit (mirror) |
| AC4 healthy-but-empty roster stays gated (no open posting) | T10 | `test/posting-gate.test.js` | unit (mirror) |
| AC5 normal gate resumes on recovery | T11 | `test/posting-gate.test.js` | unit (mirror) |
| AC6 no error-tone copy | T6 (source guard: note copy + absence of error phrasing) | `test/posting-gate.test.js` | source guard |
| (regression) healthy member/non-member unchanged | T1, T2 | `test/posting-gate.test.js` | unit (mirror) |
| (regression) bespoke keeps joined-flag gate | T3 | `test/posting-gate.test.js` | unit (mirror) |
| (Option B) degraded does NOT open to a stranger | T9 | `test/posting-gate.test.js` | unit (mirror) |

## Tests added (T7–T11) + updated mirror/guard
- **Mirror `canCompose`** gains `degraded` and `founder` inputs and the Option B expression.
- **T7** — declaration + degraded + founder (not in members, not joined) → can post. *(AC3)*
- **T8** — declaration + degraded + joined (not member, not founder) → can post. *(AC1)*
- **T9** — declaration + degraded + stranger (signed in; not member/founder/joined) → cannot post. *(Option B: outage does not open the room to everyone.)*
- **T10** — declaration + healthy (degraded false) + empty roster + non-member (incl. a non-rostered founder) → cannot post. *(AC4: healthy-but-empty stays gated.)*
- **T11** — same inputs flip outcome on `degraded` true→false for a founder/joined viewer. *(AC5: self-healing on recovery.)*
- **T6 (updated source guard)** — pins the new gate expression (`viewerIsMember || (rosterDegraded && (joined || isFounder))`), `viewer === c.founder`, `rosterState.degraded`, the degraded note copy ("can…t reach the trust network", "You can still post"), and the absence of "something went wrong" in that note.

## Edge cases
- [x] Degraded vs reachable-but-empty (T9/T10 vs T7/T8) — the crux.
- [x] Founder not yet in the roster during the dark window (T7).
- [x] Recovery transition (T11).
- [ ] Bespoke circles untouched (T3 confirms).

## Test infrastructure
- Runner: `node test/test.js` (CommonJS; each suite `module.exports = { run }`, registered in `test/test.js`). `posting-gate.test.js` is already registered — no registration change.
- No Concept Graph API or firmware preconditions (client gate logic only).

## How to run
```
node test/test.js
```

## Verification
The updated source guard (T6) fails against the current source (which still has the old `canCompose` line and no degraded note) and passes after the Implementer applies ADR-0032. Failing output to be pasted here at the gate.
