# Small edges of the profile checklist page and its record

**Id:** 2026-10-10-profile-checklist-small-edges
**Type:** cleanup
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close)
**Status:** OPEN
**Done:** —

None blocks; each was noted by a review of the book and left for a later pass.

- `ui/src/pages/assistant/profileChecklistCopy.js:177`: when an answer arrives with no `profile` action (an older
  server), the summary reads "Checking…" for ever while every panel reads could-not-check. Use the could-not-check line
  when the answer is in and there is no action.
- `ui/src/pages/assistant/ProfileChecklist.jsx` (the avatar preview): on an instance with no public address the preview
  still offers **Publish this avatar**, which stores a file that can never be published. Hide it when
  `instance.isPublic === false`.
- `src/api/openapi.yaml`: the profile item rows list only `key/counts/finished/done/reason`, not the detail fields the
  page reads (`picture`, `address`, `value`, `expected`, `hasName`, `hasAbout`, `relaysTotal`, `relaysAnswered`,
  `relaysHolding`); neither avatar route documents the gate's 500.
- `BIBLE.md:8`: the "Last updated" line credits §11 and §14 with the avatar routes, which neither section's body lists.
  Add the two rows to §11, or drop the claim.
- ADR `assistant-profile-checklist/0001`: "up to about 5 s" is about 10 s when the profile is found only outside.
- ADR `assistant-profile-checklist/0002` Amendment 2: "the one the check read" is exact only when the local relay holds
  a kind 0; the cost paragraph has a stray line break and leaves out the case of a copy home that keeps failing (the
  panels offer a fix the press refuses).
- `src/api/assistant/avatar.js` `hasStoredAvatar`: runs `mkdirSync` on every attention request whose picture is a
  composite, a side effect in a check meant to be read-only.

**Pointer:** `engineering-team/audits/assistant-profile-checklist/audit.md` § 6 #6; the book's reviews (non-blocking
notes).
