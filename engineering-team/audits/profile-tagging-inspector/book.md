# Book of Work: Inspect the nostr events behind a profile's tagging

**Slug:** profile-tagging-inspector
**Status:** Closed (2026-07-17)
**Opened:** 2026-07-16 (eagerly at intake, per workflows/0-intake.md step 4)
**Closed:** 2026-07-17 — all 4 frame bullets met (one sub-behavior, `counted:false`, proven analytically not empirically — see audit §4 #1); shipped to staging (PR #375), feat/tags/tags.brainstorm.world (back-merge `b6a7875f`), and main/tapestry.brainstorm.world (PR #377). Range `1a36935e..2831b1e0` (code).

## Close artifacts

- Build audit: `engineering-team/audits/profile-tagging-inspector/audit.md`
- Product feedback: `engineering-team/audits/profile-tagging-inspector/prd-seed.md` (no-PRD → reconstructed baseline)
- Retro dispositions: audit §7 (5 findings — OPEN.md #47/#43/#27-family, 2 declined-with-reason)
- **Confidence:** high on the frame; the `counted:false` marker path is proven by code-read only (audit §4 #1, §6 top item)
- **Epic NOT retired:** `tag-event-inspector` spans this book + the closed `tag-event-inspector` book, and its goal (events behind tag *surfaces*, plural) has legitimately-unbuilt future surfaces (Note rows, tag index, pins). Closing this book ≠ retiring the epic (OPEN.md #47).

## Intent anchor

**Acceptance frame (no PRD)** — the operator's 2026-07-16 ask, captured verbatim below at intake and confirmed in the same conversation. Anchor inputs: the raw ask; the live surface it names (`https://staging.brainstorm.world/tag/bitcoin-physician/3f56516b8377047bc2360fc58b2356bb8eea7752bb69a4c719d928594c1a2084`); the shipped affordance it says to emulate (`tag-event-inspector` book, story #1); and the three scope decisions the operator settled at intake (recorded under "Decisions taken into the frame").

**This is a new book, and the `tag-event-inspector` book stays closed.** That book's four-bullet frame — the tag *definition* event renders, toggles, behind a new `⋯` right of the tag name, with exactly three items — was fully met and remains met. A met frame is not reopened. This book covers a capability that frame never mentioned: the events behind a **tagging**, which is a different object (`nostr-user-tag`, not `tag`), on a different part of the page, with a different cardinality. That book's own opening reasoning set this precedent: *"this is a new capability on the tag detail page, not a continuation of either."* The **epic** `tag-event-inspector` is shared and was reopened for this story — an epic may span books.

**Raw ask (verbatim, 2026-07-16):**

> We just recently added a new feature which is the ability to view the raw nostr event for a Tag on a page like this one: https://staging.brainstorm.world/tag/bitcoin-physician/3f56516b8377047bc2360fc58b2356bb8eea7752bb69a4c719d928594c1a2084 . To do this, the user clicks on the three-dot icon `...` which toggles a modal window to show or hide the raw event for the Tag.
>
> I would like to add a similar feature to this page, but instead of viewing the event for the Tag, I want to see the raw nostr event for the user profile Tagging, the event that applies the Tag to a specific Profile. I would like once again to make use of the three-dot icon to the right of each Profile panel (to the right of the panel with Apply button, the Dispute button, and the score data). Currently, the three-dot icon is visible only when the window is narrow. We can keep it like that. Currently, when the window becomes narrow and the icon is clicked, it toggles a modal that shows the Apply button and Dispute button on the bottom left. I would like to see the "Show Raw Event" (or "Hide Raw Event") button to be to the right of the Dispute button, but for it to be positioned on the bottom right side of the panel (float right, or some other similar css method to keep it to the right). The raw event should be shown (when visible) in a panel below the panel for the user in question.

### The ask's one wrong premise, corrected before the frame was written

The ask says *"the event that applies the Tag to a specific Profile"* — singular. **There is no such single event.** A tagging is an assertion publishable by anyone (`nostr-user-tag`: *"each element links a target pubkey to a tag event ID"*), so a row's `+N −M` is N+M distinct signed events from N+M distinct authors. The ask reads as singular because the page it names hides this: both rows on `bitcoin-physician` happen to be `+1 −0`. Measured across staging at intake, **10 of 49 tags have at least one multi-event row** — `podcaster` (Avi Burra `+4 −0`), `wotathon-participant` (Nathan Day `+4 −0`), `aos-2026-participant` (AJ `+3 −0`), and `verified-human`, whose NY Times NewsBot row reads `+0 −3`: zero applying events, three disputing ones. Any frame built on "the applying event" would be unsatisfiable there. The operator was shown this evidence at intake and chose the "all events behind the counts" reading. **The frame below is written against the corrected premise, not the ask's literal words** — recorded here so the close reconciles against what was meant and confirmed, not against a sentence known to be wrong when it was written.

### Decisions taken into the frame (operator, at intake)

1. **Which events:** all of them — every WoT-filtered assertion behind the row's `+N −M`, applications and disputes alike, each its own JSON block. Rationale: makes the score auditable. Accepted cost: a busy row's panel is long.
2. **Reachability:** the `⋯` becomes reachable at **every** width, overriding the ask's *"we can keep it like that"*. Above 769px its menu carries only the raw-event item. Rationale: the audience for a raw-event viewer (operators debugging federation, developers learning the wire format) is on desktop, and story #1's equivalent is already reachable at every width — narrow-only would be an odd asymmetry.
3. **Surface:** the tag detail page only. The "Tag someone" search modal renders the same row component but its rows usually carry no assertions, so the item would be dead there.

### Acceptance frame

- [ ] **The raw signed events behind a profile's tagging are viewable on the tag's page.** A reader can open a panel for a given profile row and read the assertions themselves — each rendered as the signed event as published (id, pubkey, created_at, kind, tags, content, sig), not a summary.
- [ ] **The panel shows *every* event behind the row's numbers, not one.** For a row reading `+N −M`, the panel holds N+M blocks — the POV's WoT-filtered non-neutral assertions unioned with the viewer's own — and a reader can count the blocks and get back the row's numbers. Each block is identifiable by polarity and author without parsing JSON by eye.
- [ ] **It is hidden by default and toggles**, per row, from the row's `⋯` menu, via a **"Show Raw Event" / "Hide Raw Event"** item whose label reflects current state — sitting to the right of Dispute and pushed to the menu's right edge, with the panel appearing below that row.
- [ ] **The `⋯` is reachable at every viewport width**, not only below 769px — permanently visible when narrow (as today), and without adding permanent visual noise to a long list when wide.

**Done looks like:** story #2 of epic `tag-event-inspector` passes review and ships to `staging`; the operator can open a tag page, hit the `⋯` on a profile row — at desktop width — and read every signed assertion behind that profile's score. Promotion beyond `staging` (to `feat/tags`, where the tag data is richest, or to production) is **the operator's call, not this session's**.

## Epics in this book

- `tag-event-inspector` — story #2 (`stories/tag-event-inspector/2-tagging-raw-event-inspector.md`). Epic shared with the closed `tag-event-inspector` book and **reopened** for this story; its POV and "emulate, don't diverge" guardrails were amended at the reopen, both of which the original wording would have read as forbidding this work.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at open:** **high** for the ask (captured verbatim at intake, not reconstructed) and for the three decisions (put to the operator explicitly, with evidence, and answered). The one place to watch at close: the frame deliberately departs from the ask's literal wording on cardinality — see "The ask's one wrong premise" above. Reconcile against the frame, and treat the departure as intended.

## Carry-forward from the previous book

`audits/tag-event-inspector/prd-seed.md` §7 asked: *"Is 'inspect the event behind this thing' a page feature or a product pattern? It shipped on one page for one object type. Notes, profiles, taggings, and pins all have the same latent need. Decide deliberately — generalizing later is cheap now and expensive after three divergent one-offs."* **This book is the deliberate answer: it is a pattern.** This is instance two. The seed's warning about the third is live and should be weighed at Architecture — but answering the question does not oblige building every instance now (Note rows, the tag index, the Pinned tab, and profile pages all stay out of scope).
