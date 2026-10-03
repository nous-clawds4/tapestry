# Re-Sync on a header that is both self-shared and wired, or has several b pointers: owner's call to revisit

**Id:** 2026-10-02-resync-multi-b-and-self-shared
**Type:** feature
**Opened:** 2026-10-02 (Dictionary: Re-Sync, #815; its review N3)
**Status:** OPEN
**Done:** —

**What was decided, and what to revisit.** Re-Sync (`src/lib/conceptHeaderCopy.js` `resyncedHeaderTags`) leaves a
header with exactly one b-tag, at the shared concept it is wired to (the owner's rule, 2026-10-02). It finds that
concept with `wiredTarget`: the first pointer b at another list header. Two consequences the owner hasn't weighed:
- **Self-shared and wired at once.** A header that also points to itself stops being shared after a Re-Sync,
  because its self-b goes.
- **Several b pointers.** Re-Sync uses the first. The entry page's "shared concept" is the best-scoring target
  (`sharedCoord`), which can differ, though the panel names the concept it will copy.

No local header has more than one b-tag today, so neither case has come up.

**Fix shape, if the owner wants a change:**
- keep a self-b on Re-Sync; and/or
- let the reader choose the target when there are several, or use `sharedCoord`.

**Pointer:** `docs/DICTIONARY_PAGE_HANDOFF.md` § "Re-Sync"; the review's N3.
