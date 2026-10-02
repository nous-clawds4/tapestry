# List Headers disposition: the relay read-back matches by id only, a lone surrogate passes the Wire target check, and a narrow concurrent-request race remains

**Id:** 2026-10-01-list-headers-readback-hardening
**Type:** security
**Opened:** 2026-10-01 (list-headers-disposition #4, review round 2; the independent adversarial pass)
**Status:** OPEN
**Done:** —

**What was seen.** These are all non-blocking. Each affects only the caller's own header: their Assistant's, and since
story 5 also their account's (see the update below).

1. **The read-back matches by id only.** `isStored(id)` in `src/api/list-headers/myAssistantDisposition.js` asks
   the relay whether an event with that id exists.
   - Submit's and Keep private's ids are predictable: known tags, and `created_at = max(now, prev + 1)`.
   - If an unverified import path let someone plant an event carrying a predicted id, `strfry import` would skip
     ours as a duplicate, and `isStored` would still say yes.
   - **Fix shape:** have `isStored` also verify the event it finds with the same verifier. Don't compare `sig`:
     two identical same-second requests legitimately share an id with different signatures.
2. **A lone surrogate** (for example `\ud800`) passes the Wire target check. The relay most likely rejects the
   event, and the read-back answers 502, so it's harmless. **Fix shape:** add `\p{Cs}` to the character check, or
   require `target.isWellFormed()`, so it's refused up front with the right sentence.
3. **A narrowed race.** If request A's read-back succeeds and a concurrent request B then replaces A in the relay,
   the two graph writes can finish in either order. The graph can end on A while the relay holds B. **Fix shape:**
   import into the graph only if the event is still the newest for its address, or serialise disposition requests
   per address.

**Pointer:** `engineering-team/reviews/done/list-headers-disposition/4-wire-on-my-assistant-rows.md` § Re-review, round 2
§ Findings.

**Update 2026-10-01 (list-headers-disposition #5 review).** Story 5's Me path (`src/api/list-headers/meDisposition.js`)
reuses the same `isStored`, the same Wire target check and the same relay-then-graph tail. So all three items now
apply to headers the person signed in their browser too, not only to Assistant headers. The fix shapes are unchanged;
a fix to `isStored` or the target check in `myAssistantDisposition.js` covers both paths. Pointer:
`engineering-team/reviews/done/list-headers-disposition/5-disposition-on-me-rows.md` § Findings.
