# Epic: identification-tags-authorship — two authored definitions, two parked taggings

**Status:** Active
**Created:** 2026-09-22
**Book:** `engineering-team/audits/identification-tags-authorship/book.md` (no PRD — acceptance frame)
**Provenance:** the owner's ask of 2026-09-22, the same day the `assistant-identification-tags` book (now under
`done/`) reached production. That book assumed one canonical author, the owner's key, for four definitions
(its Discovery decision 5). The owner has since authored two of the four under two identities and parked the
other two.

## Goal

**The Identification Tags page publishes against the two definitions that exist, and parks the two that are
undecided.** "My Tapestry Assistant" is Nous' tag; "My Tapestry Owner" is the tag of Nous' Tapestry Assistant.
"My Agent" and "My Human" stay visible, greyed out, unchecked and uneditable until the owner's team decides.

## Stories

`stories/identification-tags-authorship/`. One feature, all five phases (Standard).

1. `1-two-authored-tags-and-two-parked-taggings.md`: per-entry definition authors in the shared list, the two
   parked entries, the answer and the page reading them, the two publishers pointing at the right definitions.

## Key facts / guardrails

- **The definition authors are constants of the list, not of the deployment.** Two specific keys
  (`15f7dafc…`, `a73a2980…`) author the two offered definitions on every instance. The second is a key a
  Tapestry instance holds (a Customer's Assistant on production), but it is still a literal in the list, never
  the runtime TA. The ADR-0015 legacy z literal and the runtime local z are unchanged.
- **"Present" stays by name.** Anyone may author a same-named tag; the signer's newest stance on
  `profile-tag-<slug>-<target>-<signer>` decides; the definition's author matters only for publishing (the `a`
  and `e` of the new tagging).
- **Parked means inert, not hidden.** The rows render with their names, greyed; nothing reads, counts or
  publishes them. Unparking is adding the author back to the entry.
- **Shared lines:** the previous book's modules (`src/lib/identification-tags`, `src/api/assistant/*`, the page
  and its copy module, the three suites and three specs, the hub's re-aimed suites).

## Deferred / out of scope

- Deciding "My Agent" and "My Human", or publishing definitions for them.
- The `protocols/` convention note on well-known tags (carried forward from the previous book).
- Anything else in the previous book's carry-forward register.

## ADRs

`decisions/identification-tags-authorship/`, created at Architecture.
