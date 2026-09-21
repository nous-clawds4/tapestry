# Two comments lag the My Assistant page: a stale disabled-menu example, and a cross-reference ADR 0004 promised

**Id:** 2026-09-21-my-assistant-comment-nits
**Type:** docs
**Opened:** 2026-09-21 (assistant-profile #4 review, non-blocking 3 and 4)
**Status:** DONE
**Done:** 2026-09-21 (assistant-profile #5, ADR 0005 sub-decision 7; PR pending) — both items: the `ui/src/styles.css`
example now reads "for someone with no assistant and no way to create one here", and the provision handler's comment
names `mayCreateAssistant`, so ADR 0004's "each one's comment names the other" holds.

Two comments, no behaviour. Story 5 touches the same area, so it is the natural carrier.

- **`ui/src/styles.css:802-805`.** The comment still gives "My Assistant's Profile with no provisioned
  assistant key" as the example of a disabled menu row. Since assistant-profile #4, an Admin or a Customer
  with no key finds that item enabled. Deviation 1 of that story updated the two component comments and
  missed this one. Fix: "…with no assistant and no way to create one here".
- **ADR assistant-profile/0004, § "What we trade away".** It says of the two "who may create an assistant"
  rules that "each one's comment names the other".
  - `mayCreateAssistant` names `provision-key` (`ui/src/config/avatarMenuLinks.js:32-37`).
  - The provision handler's comment (`src/api/assistant/index.js:453-464`) does not name
    `mayCreateAssistant`, and the ADR's "Unchanged, deliberately" list kept that handler as it was.
  - Fix: add one comment line to the handler, or drop the claim from the ADR.

**Pointer:** `engineering-team/reviews/assistant-profile/4-my-assistant-page.md`, non-blocking findings 3 and 4.
