# Book of Work: The Identification Tags page — the first action with a real "needs attention" answer

**Slug:** assistant-identification-tags
**Status:** Closed
**Opened:** 2026-09-22
**Closed:** 2026-09-22 (on `feat/assistant-identification-tags`, unmerged; shipping to staging is the owner's separate decision)

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-09-22) and settled through a
Discovery conversation scoped to this one page (`product-team/discoveries/assistant-identification-tags.md`,
which carries the nine decisions). Completion is *judged* against the bullets below.

The owner's words for this page, verbatim (from book `assistant-management`, which quotes the whole
ask):

> /assistant/identification-tags
> Title: "Identification Tags"
> Description: Part of the Assistant's identity is its relationship to you. A handful of Tags will be used to broadcast this relationship between you and your Tapestry Assistant to outside clients, applications and services.
> Alert Criteria: if any of the required Taggings are missing. Taggings that you will use on your Assistant include: "My Tapestry Assistant", "My Agent"; Taggings that your Assistant will use on you: "My Tapestry Owner" and "My Owner". More may be added later when we flesh this out in detail.

The session's brief, verbatim (2026-09-22):

> Let's flesh out the Identification Tags page, /assistant/identification-tags: the second action page of the Assistant Management hub, and the first one to get a real "needs attention" answer.

with these bounds: "Out of scope: the other nine action pages, the assistant's DMs, and any change to the
tagging protocol. If the design needs a protocol change, it goes through `protocols/` first."

### Decisions taken at Discovery (2026-09-22)

Recorded in full in the discovery brief. In short:

1. Two cards, one per signer: "Taggings you put on your Assistant" and "Taggings your Assistant puts on you".
2. A checkbox per tagging on each card, checked by default. Leaving one out is "not this time": it still
   counts as missing, and nothing is stored.
3. The Assistant's taggings are published only on the button, never at Assistant creation (for now).
4. The hub's card, its count line and the Assistant Alert switch to this action's real answer now; the
   other nine still count.
5. The owner publishes the four canonical tag definitions with their own key, once. The check stays
   permissionless: a same-named tag by another author still counts as present.
6. "My Owner" becomes "My Human". The four: My Tapestry Assistant, My Agent (you on your Assistant);
   My Tapestry Owner, My Human (your Assistant on you).
7. One required list, the same on every instance, shipped with the app.
8. One Treasure Map sentence on the page, no check: "Your Treasure Map tells apps what your Assistant
   publishes for you; these tags are simply an additional mechanism to associate you and your Assistant."
9. Present = the required signer's latest stance on that tag and target is "apply", read from this
   instance's relay first, then the outside relays the instance reads tags from. Others' disputes do not
   count; the signer's own flip or retraction does. The check is about the viewer's own Assistant only.

### Acceptance frame

*Confirmed 2026-09-22, when the owner approved stories 1–3. The canonical author key is the owner's own
(BIBLE §20, wds4/straycat).*

- [x] **The four required taggings**, the same on every instance: you on your Assistant, "My Tapestry
      Assistant" and "My Agent"; your Assistant on you, "My Tapestry Owner" and "My Human". Their
      definitions are canonical tags the owner publishes once with their own key; the app knows each by
      its name and its canonical address.
- [x] **One real answer.** For a signed-in viewer with an Assistant on this instance, the instance says
      which of the four are present and which are missing, for that viewer's own Assistant only, read
      from this instance's relay first and then the outside relays it reads tags from. A third party's
      dispute changes nothing; the signer's own flip or retraction makes a tagging missing.
- [x] **The hub tells the truth for this action.** The Identification Tags card is marked, and the hub's
      count line and the Assistant Alert count it, only while a required tagging is missing. The other
      nine actions still count as before.
- [x] **The page** at `/assistant/identification-tags` replaces its placeholder: the owner's description,
      the Treasure Map sentence, and two cards, one per signer, each listing its two taggings with their
      state, a checkbox per missing tagging (checked by default) and one publish button. A canonical tag
      that cannot be found is said so, and that tagging cannot be published.
- [x] **Your two taggings** are signed with your nostr extension when you press publish on the first
      card, sent to this instance's relay and the outside relays, and each relay's answer is shown.
- [x] **Your Assistant's two taggings** are signed by this instance with your own Assistant's key when
      you press publish on the second card, for your own Assistant only, written to this instance's
      relay first and then the configured relays, each relay's answer shown. Nothing is published at
      Assistant creation, and nothing else gains the power to sign as an Assistant.
- [x] **Nothing else changes:** no change to the tagging wire format, no other action page, no DMs.

## Epics in this book

- `assistant-identification-tags`: three stories. The one answer and the hub's first real mark (#1);
  the page and your two taggings (#2); your Assistant's two taggings (#3).

## Path

**Standard, all five phases for each story**, as the owner asked at intake (2026-09-22). All three are
features.

## Prerequisite outside the code

The four canonical tag definitions must be published by the owner's own key before the page can apply
them (Decision 5). Story 2 § Copy carries the name, slug and description of each. Until they exist, the
page reports each missing definition as "tag not found".

## Shared lines

Other sessions are working on `/setup` and on the assistant's other surfaces. Before Implementation and
again before Review: `git fetch` and `git merge-tree --write-tree HEAD origin/staging` (ledger
`2026-09-22-parallel-books-no-shared-line-recheck`). The lines this book touches: the hub's attention
answer (`ui/src/pages/assistant/actions.js`), the routes in `ui/src/App.jsx`, the API index, and the
top-bar pill's count.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** high for what the code does (every frame bullet traces to a story; all three passed
  review; each bullet was observed on the local instance, audit §5), medium for the frame as a user will meet it:
  nothing has been seen on staging, and the four canonical definitions are not yet published, so every row reads
  "Tag not found" until the owner publishes them (audit header, §4 #1).

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-identification-tags/audit.md`
- Product feedback: `engineering-team/audits/assistant-identification-tags/prd-seed.md`
