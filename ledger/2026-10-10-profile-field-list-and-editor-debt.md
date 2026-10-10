# Profile code debt: three kind-0 field lists, the editor's duplicate report words, no re-check after the editor publishes

**Id:** 2026-10-10-profile-field-list-and-editor-debt
**Type:** cleanup
**Opened:** 2026-10-10 (book `assistant-profile-checklist` close)
**Status:** OPEN
**Done:** —

- **Three copies of the kind-0 field list:** `PROFILE_FIELDS` in `src/api/assistant/index.js`, the editor's labelled
  list in `ui/src/components/AssistantProfileEditor.jsx`, and `PROFILE_CONTENT_FIELDS` in
  `src/lib/assistant-profile-items/index.js`. The server and the editor could import the library's (ADR
  `assistant-profile-checklist/0001` § Consequences).
- **The editor's private `RELAY_WORDS`, `relayOutcomeText` and `publishResultTone`** duplicate `relayLine` and
  `publishTone` in `ui/src/utils/taggingPublishReport.js`, which the checklist page uses (ADR 0002 § Consequences).
- **The editor does not ask for the attention answer again after a publish,** so the hub and the pill catch up only on
  the next full page load. A one-line `refresh()` from `useAssistantAttention()` (ADR 0001 § Consequences).

**Pointer:** `engineering-team/audits/assistant-profile-checklist/audit.md` § 5 and § 6 #7.
