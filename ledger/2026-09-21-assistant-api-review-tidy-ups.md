# Three small tidy-ups in the assistant API: an array query answers 500, the name memo neither de-duplicates nor prunes, and two comments overstate NIP-05

**Id:** 2026-09-21-assistant-api-review-tidy-ups
**Type:** cleanup
**Opened:** 2026-09-21 (assistant-profile #3 review, non-blocking 2–4)
**Status:** OPEN
**Done:** —

None of the three has a security or data impact. Each is small enough to fold into the next story that
touches `src/api/assistant/` (assistant-profile #4 or #5).

- **An array-shaped `customerPubkey` answers 500, not 400.**
  - `GET /api/assistant/status?customerPubkey[]=<hex>`: Express parses the value as an array. The new
    64-hex check coerces the array to a string and passes it, and the npub encoder then throws. The
    answer is "500 hex string expected, got object".
  - Reproduced by calling `createAssistantStatusHandler` directly (2026-09-21).
  - The publish handler has the same shape, and did before this story.
  - Fix: add `typeof customerPubkey === 'string'` to both checks (`src/api/assistant/index.js:355` and
    `:183`).
- **The person's-name memo has no in-flight de-duplication and is never pruned.**
  - `src/api/assistant/profileDefaults.js:151-177`.
  - The review measured five concurrent misses for one person producing five relay queries.
  - The memo `Map` only grows. It is bounded by the signed-in callers who can reach the relay step, the
    same property ADR 0001's miss memo has.
  - Fix: memoise the in-flight promise; optionally sweep entries older than `NAME_MEMO_MS`.
- **Two comments still say NIP-05 is always published.**
  - `src/api/assistant/index.js:37-40` says "the publish handler always sets nip05 itself".
  - `ui/src/components/AssistantProfileEditor.jsx:11-13` says the server writes the `nostr.json` entry at
    publish time.
  - Since ADR assistant-profile/0003, both happen on a public instance only.
  - Fix: reword both.

**Pointer:** `engineering-team/reviews/assistant-profile/3-one-default-assistant-profile.md`, non-blocking
findings 2, 3 and 4.
