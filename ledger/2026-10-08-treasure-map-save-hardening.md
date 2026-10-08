# Save on /treasure-map: five hardening points left out of story 5

**Id:** 2026-10-08-treasure-map-save-hardening
**Type:** bug
**Opened:** 2026-10-08 (treasure-map-edit #5 review, round 1, non-blocking 1, 3, 4, 7 and 8)
**Status:** OPEN
**Done:** —

Story 5's review found these. ADR 0005 Amendment 1 left them out of the fix round, and none is a blocker.

1. **A signer prompt that never answers** leaves "Saving…" up and every control off, with no timeout. Fix shape: a
   timeout (or a Cancel) that ends the save as not sent.
2. **Refusing the signer's account prompt reads as "no Nostr signer was found".** `getActiveSignerOrThrow` throws the
   same way for both. Fix shape: tell a refusal from a missing extension, with words the owner approves.
3. **A signer that alters the event** gets its version published and shown: only the pubkey is checked. Fix shape:
   compare kind, created_at, content and tags with what was asked, and refuse otherwise. It needs approved words.
4. **A Map stamped more than 900 s in the future** can't be replaced until that time (strfry's limit, `stampFor`).
   This is inherent to replaceable events; worth a line in the refusal if it ever bites.
5. **A save that finishes after the page is left** starts a toast timer that nothing clears. It's harmless today (no
   console errors). Fix shape: skip the timer when unmounted.

**Pointer:** `engineering-team/reviews/done/treasure-map-edit/5-save-the-edited-map.md` § Findings, Non-blocking 1, 3, 4,
7 and 8, and § Round 2; ADR `engineering-team/decisions/done/treasure-map-edit/0005-save-is-one-pure-sequence-with-injected-effects.md`
Amendment 1, "Not taken this round".
