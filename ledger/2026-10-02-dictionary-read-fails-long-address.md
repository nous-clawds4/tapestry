# One Dictionary row whose address or b-target is longer than 255 bytes makes the reader's whole Dictionary unreadable, and Wire still accepts 1,024-byte targets

**Id:** 2026-10-02-dictionary-read-fails-long-address
**Type:** bug
**Opened:** 2026-10-02 (Dictionary: Create New Concept from the finder, wired; its review M1)
**Status:** OPEN
**Done:** —

**What was seen.** strfry looks up tag values of at most 255 bytes (`MAX_INDEXED_TAG_VAL_SIZE`,
`/usr/local/src/strfry/src/constants.h:5` in the container). A filter carrying a longer value fails outright
("filter item too large"): `strfry scan` exits 1. `maxTagValSize = 1024` in `strfry.conf` is a different limit:
whether an event is accepted at all, and only for single-letter tags.

The Dictionary reads put every row's own address and every b-target into one `#z` filter:
- `src/api/adoption/index.js:247` (the trusted dictionary);
- `:373` (`assembleConceptDictionary`);
- `:489` (the entry's Items).

So one value of 256 bytes or more fails the whole read. The page then says "Could not assemble your Dictionary",
and there is no way to recover in the product: Keep private refuses a header with a real `b`, and nothing deletes
an Assistant's header. The Reviewer reproduced it with the real assembly against the real relay, using an
injected row that was never published: a 255-byte target worked, a 256-byte one failed.

**What is already closed.** Create New Concept (`POST /api/dictionaries/concepts/new`) refuses:
- a target over 255 bytes;
- a d-tag over 184 characters, which keeps the header's own address within 255 bytes.

The page and the finder apply the same bounds.

**What is still open:**
- **Wire on My Assistant rows** (`src/api/list-headers/myAssistantDisposition.js:37`, `MAX_TARGET_BYTES = 1024`)
  still signs a target of up to 1,024 bytes, so it can still put a row into this state. So can headers published by
  other paths: an older header, or a NIP-07 one.
- **GUM₂'s chunked `#b`/`#a`/`#e` scans** fail the same way, but safely: the fields are left out.

**Fix shape:**
- Lower Wire's bound to 255.
- Make the three reads drop unlookupable values from the filter, rather than fail. The row stays, with no GUM₁ or
  Items, and a note saying why.
- Pin both with tests at 255 and 256 bytes.

Nobody is affected yet: the community relay's longest self-declared address was 107 bytes on 2026-10-02.

**Pointer:** the review of the wired Create New Concept change, M1 (the PR to `staging` that adds
`src/api/adoption/newConcept.js`).
