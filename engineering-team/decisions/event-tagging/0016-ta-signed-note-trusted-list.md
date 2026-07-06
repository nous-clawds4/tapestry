# ADR 0016: TA-signed note Trusted List — `runOneNotePin` mirroring the pubkey pin TL (issue #336)

**Status:** Accepted (kind-30393 e-tag note TL, per the NIP-85 TA/TL convention — David 2026-07-06; applicability stays on 30393 by operator decision)
**Date:** 2026-07-06
**Story:** `engineering-team/stories/event-tagging/17-ta-signed-note-trusted-list.md`
**Epic:** `engineering-team/epics/event-tagging.md`
**Relates to:** ADR `event-tagging/0015` (generalized target-typed pinning — deferred this), ADR `pin-a-tag` TL work (kind-30392)

## Context

The instance already publishes, for each pinned tag, a TA-signed **kind-30392** Trusted List of the
**pubkeys** trusted-tagged with it, per the pin's observer POV:

```
refreshAllPinnedTags() → enumeratePinnedTags() → runOnePin(pin):
  parseCurationMethod(pin) → { method, observer, cutoff, includeScoreInTL, targetTypes, noteMethod }
  aggregateProfilesTagged({ tagEventId, povSuffix, minRank })   // profile-tags/index.js
  applyDisputesFunction(byTarget, cutoff)
  buildAndPublishTL({ kind:30392, dTag:`tl-pin-<obs8>-<tagAuthor8>-<slug>`, metric:'pinned-tag-membership',
                      items:p-tags, extraTags:[observer, source-tag, cutoff, min-rank], content })
  + retractStaleTLs(currentDTags)   // scans kind-30392, d startsWith 'tl-pin-', empty-replacement for stale
```

The **note** side of a target-typed pin stops at a **user/client-signed kind-30003** bookmark-set
*export* (`publishNoteBookmarkSetForPin`). There is **no TA-signed, instance-maintained** list of the
notes tagged with a tag — issue #336.

**Everything needed already exists.** `handleForTag` (`event-tags/index.js:208`) computes the note
membership — discover the tag's headers → scan taggings → `core.groupTaggingsByTarget` under the
observer POV → per-note `{ id, applications, disputes, createdAt }`. `curateNotes(notes, method)`
(`taggings.js:125`; v1 `notes:net-endorsed`/`notes:most-applied`) curates it. `buildAndPublishTL`
already supports **`e`-tag members** and empty-membership retraction. This ADR wires them into the
pin-refresh path — the note twin of `runOnePin`.

### Constraints
- **Additive.** The pubkey TL (30392), the kind-30003 export, and `handleForTag`'s observable
  behavior must not change. TA pubkey resolved at runtime; guarded publish; local strfry.
- No new dependency, no firmware.

## Options considered

### Option A — Extract `aggregateNotesTagged`, add `runOneNotePin`, wire into `refreshAllPinnedTags` *(chosen)*

Mirror the pubkey side exactly:
1. **Extract `aggregateNotesTagged({ tagAuthor, slug, authorities, povSuffix, minRank })`** from
   `handleForTag`'s membership computation (steps: `filterTaggingHeadersForTag` scan →
   `filterTaggingsUsingTag` scan → `groupTaggingsByTarget` under the observer predicate → the
   deterministic `[{ id, applications, disputes, createdAt }]`). Export it from `event-tags`; **re-point
   `handleForTag` to use it** (behavior-identical; the `event-tagging-for-tag` suite guards the re-point).
   This mirrors how `aggregateProfilesTagged` is shared by `handleProfilesTagged` + `runOnePin`.
2. **Add `runOneNotePin(pinEvent)`** in `refreshPinnedTags.js`: `parseCurationMethod` → gate on the pin
   targeting notes (`curation.targetTypes` includes `'note'`; **absent ⇒ ADR-0015 default `['profile','note']`**,
   so legacy pins still get a note TL); resolve observer POV (`resolvePov({wotPov:'user', userPubkey:observer})`,
   as `runOnePin` does); `lookupTagEvent`; `aggregateNotesTagged(...)`; `curateNotes(notes, curation.noteMethod || 'notes:net-endorsed')`;
   `buildAndPublishTL({ kind:30393, dTag:`tl-pin-notes-<obs8>-<tagAuthor8>-<slug>`, title:tag.name,
   metric:'pinned-tag-notes', items: curated.map(n=>({tag:'e', value:n.id})), extraTags:[['observer',observer],
   ['source-tag',tag.eventId,tag.authorPubkey,tag.slug],['curation-method',curation.noteMethod||'notes:net-endorsed']],
   content: JSON.stringify({ notes: curated.map(n=>({id:n.id, applications:n.applications, disputes:n.disputes})) }) })`.
   Empty curated set → same call with `items:[]` (empty-membership replacement).
3. **Wire into `refreshAllPinnedTags`**: for each pin, run `runOnePin` (unchanged) **and** `runOneNotePin`;
   collect the note d-tags; retract stale note TLs via a **kind-parameterized** `retractStaleTLs({ kind:30393, dPrefix:'tl-pin-notes-' })`
   (the existing pubkey retraction stays `{kind:30392, dPrefix:'tl-pin-'}` — separated cleanly by kind).

- **Pros:** exact parallel to the proven pubkey path; reuses `groupTaggingsByTarget` + `curateNotes` +
  `buildAndPublishTL`; the note TL is fully additive; DRY (one note-aggregation, shared by the read +
  the TL); the for-tag suite guards the extraction.
- **Cons:** touches the shipped `handleForTag` (the re-point) — mitigated: behavior-identical and
  test-guarded. Inherits the `NOTES_CAP` recency window on the underlying read (out of scope; ADR 0015).

### Option B — Call `handleForTag` over HTTP from the refresh job
- **Cons (decisive):** an Express handler needs `req`/`res`; a loopback self-call to read then re-publish
  is fragile and slow. Extract the pure function instead. Rejected.

### Option C — Keep it client-side (extend the kind-30003 export)
- **Cons (decisive):** #336 is precisely about a **TA-signed, instance-maintained** list; the kind-30003
  export is user-signed and on-demand. Rejected — must be server-side.

### Sub-decisions
- **Kind 30393 — the established "list of events (e-tags)" TL kind (David, 2026-07-06).** The kind is
  set by the *member type*, per the NIP-85-derived Trusted Assertion / Trusted List convention: a
  Trusted Assertion is 3038x, its Trusted List is 3039x (offset +10); the last digit is the member
  type — **pubkeys → 30382 (TA) / 30392 (TL)**, **events → 30383 (TA) / 30393 (TL)**. This is already
  wired in the codebase: `ui/src/pages/lists/DListItems.jsx:835` picks `p → 30392`, else `30393`
  ("e-tags — event IDs"), and `30382` is the NIP-85 kind we already publish. A note is an event, so
  the note TL is **kind-30393 with `e`-tag members** — NOT a new kind. (My earlier 30394 was wrong —
  I didn't know the convention.) **d-tag `tl-pin-notes-<obs8>-<tagAuthor8>-<slug>`**, **metric
  `pinned-tag-notes`**.
- **Coexistence flag — the applicability lists (this session) also sit on kind-30393**, but reference
  their members by **`a`-tag** (tag-element coordinates), whereas the convention ties 30393 to **`e`-tags**
  (event IDs). The two coexist without collision (targeted lookup is by `#d`: `tag-applicability-…`
  vs `tl-pin-notes-…`; retraction scopes to the `tl-pin-notes-` prefix), and one can argue tags are
  addressable events so an a-tag list of tags is still an "event list." **But it's worth a decision**
  (surfaced to the operator): keep applicability on 30393 (event-list, a-tag encoding) or move it,
  since 30393 is conventionally the e-tag kind. **Resolved 2026-07-06 (operator): match the NIP-85
  convention — applicability migrated 30393 → kind-30394** (addressable-member TL, the +10 analog of
  NIP-85's kind-30384 addressable Trusted Assertion; see `protocols/drafts/trusted-lists.md`). The
  note TL (e-tags) keeps 30393; applicability (a-tags) moves to 30394 — the two are now on cleanly
  separate, convention-correct kinds, so the coexistence concern is moot. (Supersedes the earlier
  "stays on 30393" note.)
- **Extract-and-re-point `handleForTag`** over duplicating the aggregation — DRY; guarded by tests.

## Decision

**Option A.** Extract `aggregateNotesTagged` (shared by `handleForTag` and the new `runOneNotePin`), add
`runOneNotePin` mirroring `runOnePin` for note targets (kind-30393, `tl-pin-notes-…`, `e`-tag members,
`curateNotes` by the pin's `noteMethod`, observer POV, empty-retraction), and refresh it alongside the
pubkey TL in `refreshAllPinnedTags` with a kind-parameterized stale retraction. Additive; the pubkey TL
and the kind-30003 export are untouched.

## Consequences
- **Enables:** consumers read "the trusted notes for tag X under this observer's POV" as a maintained
  TA-signed list; a future note-TL reader surface can consume kind-30393.
- **Constrains:** kind-30393 + the `tl-pin-notes-…`/`pinned-tag-notes` shape become the note-TL contract.
- **POV:** per-pin, per-observer (identical to the pubkey TL) — POV-consistent.
- **Debt:** inherits `NOTES_CAP` on the note read (recency-capped membership; ADR 0015 follow-up).
- **Firmware reinstall?** No.

## Implementation notes
- **`src/api/event-tags/index.js`** — extract `async function aggregateNotesTagged({ tagAuthor, slug, authorities, povSuffix, minRank, viewerPubkey, sort })`
  returning **`{ members, mine, candidates, countByTarget, mineByTarget, latestByNote, noteIds, total,
  truncated, povSuffix, minRank }`** — `.members` is the deterministic membership
  `[{ id, applications, disputes, createdAt, mine }]`; the rest is returned so `handleForTag`'s kind-1
  resolution + response body stay **byte-identical** after the extraction (it only replaces the
  membership-computation block with this call). `runOneNotePin` reads only `.members`. Factor
  `trustPredicateFor(povSuffix, minRank, pubkeys)` out of `buildTrustPredicate` (shared predicate).
  Export `aggregateNotesTagged`.
- **`src/api/trustedList/refreshPinnedTags.js`** — add `runOneNotePin(pinEvent)` (import `aggregateNotesTagged`
  from `../event-tags` + `curateNotes` from `@tapestry/event-tagging`; reuse `lookupTagEvent`, `computeTLDTag`-style
  d-tag with a `notes` segment, `buildAndPublishTL`). Add note d-tag collection + a kind-parameterized
  `retractStaleTLs`. In `refreshAllPinnedTags`, call `runOneNotePin` per pin and retract stale kind-30393 TLs.
- **Testability:** `runOneNotePin` with injected deps (a fake tag lookup / `aggregateNotesTagged` / `publishTL`)
  → publishes kind-30393 with `e`-tag members, correct d-tag/metric/observer/source-tag, curated order,
  empty→retraction; a non-note-targeting pin publishes no note TL; `aggregateNotesTagged` counts/POV filtering;
  the `event-tagging-for-tag` suite (unchanged) guards the `handleForTag` re-point.

## Out of scope
- A UI/reader surface for the note TL; curation methods beyond `curateNotes` v1; the `NOTES_CAP` window;
  taggings-on-tags; any change to the pubkey TL, the kind-30003 export, search, ranking, or firmware.
