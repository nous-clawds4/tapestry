# The older `protocols/drafts/treasure-map.md` specifies the same kind-10040 key grammar as the new `treasure-maps.md`, contradicts it, and neither file mentions the other

**Id:** 2026-09-27-old-treasure-map-draft-overlaps
**Type:** protocol
**Opened:** 2026-09-27 (the Sept 2026 protocol drafts import, PR #760)
**Status:** OPEN
**Done:** —

Two drafts now describe the Treasure Map's kind-10040 entries, under near-identical names:

- **`treasure-map.md`** (singular). Written by the owner in GitHub web edits on 2026-09-21/22 (`7019d769` … `5b9bc048`)
  and not in the `protocols/README.md` Spec index. Its keys are a bare list kind for "all Tags"
  (`[30392, <assistant>, <relay>]`) and `30392:<a-tag or event id of the Tag>` for one Tag, with `39998:<d-tag>` for
  DLists. Several Assistants for one service are "primary" and "fallback".
- **`treasure-maps.md`** (plural). The design-session "Draft 2", added and indexed as 📝 pre-NIP by PR #760. Its keys
  are `<kind>:tag:<category>:<Tag>` with canonical naddrs, scopes and most-specific-wins precedence. Several
  Assistants are "Preferred" and "Alternate".

The two conflict on the wire, which the README's rule forbids: "Each wire format is normative in exactly one place".
The owner chose, at #760, to leave the old file untouched and retire it as a follow-up.

**Fix shape.** After #760 lands, first check whether the old draft says anything the new one does not. The candidate is
its closing "Discussion": how a client tells old-school list kinds (`3038x`/`3039x`) from new-school ones
(`39998`/`39999`). Carry over anything the new draft lacks, or record why not. Then either delete `treasure-map.md`
(history keeps it) or reduce it to a one-line pointer to `treasure-maps.md`.

**Pointer:** `protocols/drafts/treasure-map.md`; `protocols/drafts/treasure-maps.md` § 12 (Migration); PR #760's
description, "Heads-up: overlap with `treasure-map.md`".
