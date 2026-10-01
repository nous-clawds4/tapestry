# Book of Work: My Assistants — `/assistants`, built to the Claude Design blueprint

**Slug:** my-assistants
**Status:** Open
**Opened:** 2026-09-30
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)**: the owner's ask, restated at intake (2026-09-30). Completion is
*judged* against the bullets below.

The ask, verbatim (copied from the session transcript, not retyped):

> On the Claude Design artifact at https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m , there is a My Assistants link in the menu that goes to a page where the logged-un user can see all of his Assistants. I would like to add that link and build that page, the URL of which should be at [http://localhost:7778/](http://localhost:7778/tapestry/shared-concepts/b-tags)assistants or [https://staging.brainstorm.world/](https://staging.brainstorm.world/tapestry/dictionaries/concepts)assistants. Are you able to access the Claude Design artifact and use it as the blueprint for this page?

The owner's three scope answers the same day, verbatim (question → answer):

> "Which tags should decide who counts as "your Assistants" in the first version?"="Both, add My Brainstorm Assistant", "Should the first version include the Duties tab?"="Both tabs, Duties read-only", "Should the Assistants tab let you tag and untag profiles, or just list them?"="Search, tag and remove (Recommended)"

**The blueprint** is the design's "My Assistants" screen and its account-menu entry. The artifact
can change, so the version read at intake (`1790680640-925e`) is kept in `blueprint/` (see its
README).

### Acceptance frame

*Proposed 2026-09-30 with story 1. It's confirmed when the owner approves story 1.*

- [ ] A **My Assistants** item in the avatar menu opens `/assistants`, locally and on staging. The
      page is in the Brainstorm design's styling and follows the blueprint.
- [ ] The **Assistants** tab lists every profile the signed-in person has tagged **My Brainstorm
      Assistant** or **My Tapestry Assistant**, and marks the one hosted on this instance as
      **Local**. The Local one is listed even when the person hasn't tagged it, marked as not
      tagged, with a prompt to tag it.
- [ ] From the page, a person can find a profile and tag it as either kind of Assistant, switch
      which tag it carries, and remove the tag. A **My Brainstorm Assistant** tag definition exists
      for those taggings to point at.
- [ ] Each Assistant shows whether it's on the person's Treasure Map and what its duties there are.
      Assistants that are on the Treasure Map but not tagged are listed separately.
- [ ] The **Duties** tab lists the duties on the person's Treasure Map, read-only, covering the
      entry types the app understands today.
- [ ] The book is shipped to staging. Production only on the owner's explicit go.

## Decisions at intake

1. **Both tags count.** "My Tapestry Assistant" exists (its definition is Nous'). "My Brainstorm
   Assistant" does not exist yet. It needs a definition, and someone has to publish it (story 2).
2. **Duties are read-only.** The Duties tab shows what the Treasure Map says. The design's
   reordering, adding, removing, catch-all and wildcard duties, and "a client that adopts…"
   selector are out. They depend on grammar that is still a draft
   (`protocols/drafts/treasure-maps.md`).
3. **The page can tag.** Search, tag, change tag and remove tag are in, as the design shows.

At story 1's gate, the same day:

4. **Nous authors My Brainstorm Assistant.** Its meaning: an Assistant held by a Brainstorm
   service, such as brainstorm.world. "My Tapestry Assistant" is one held by a Tapestry instance.
   Nous signs the definition himself.
5. **Your own Assistant here is always listed.** When it's untagged, it's marked as not tagged and
   prompts you to tag it. This is a change from the design.
6. **Build all three stories, then ship once.** The page never goes out promising a missing piece.

At story 2's gate, 2026-09-30:

7. **Remove Tag withdraws the tagging.** It's retracted, as if the profile was never tagged. It's not a dispute.
8. **Nous publishes My Brainstorm Assistant before the book ships** (see § Before shipping).
9. **Your own Assistant's untagged row keeps its link to Identification Tags.** That page does both directions of the
   handshake. There's no one-press Tag button on the row.

At story 2's review, 2026-09-30:

10. **Withdrawals must travel between instances** (review 1 blocking 1; ADR 0002 Amendment 1). Each withdrawal also
    goes to dcosl, and every instance gets a tag-deletions router stream (§ Before shipping).

## Before shipping

- [ ] **Nous publishes the My Brainstorm Assistant tag definition.** He uses the tag UI on tapestry.brainstorm.world,
      as he did My Tapestry Assistant on 2026-09-22. The name "My Brainstorm Assistant" gives the slug
      `my-brainstorm-assistant`, which story 1's read is fixed to. Then check that
      `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-brainstorm-assistant` is on the
      production, staging and dcosl relays.
- [ ] **Turn on the `tagDeletions` router stream** (ADR my-assistants/0002 Amendment 1, sub-decision 12) on
      staging, production and tags.brainstorm.world, and on the Mac Studio's local stack. The settings: `both`,
      `{"kinds":[5],"#k":["39999"],"limit":5}`, and the same URLs as that instance's `nostrUserTag` stream.
      Each instance needs the owner's OK at the time. Confirm with `GET /api/strfry/router-status` on each.
- [ ] **Prove a withdrawal travels.** On staging, with a real extension, tag a profile and then Remove it. Then read
      production's and tags.brainstorm.world's relays (`/api/strfry/scan`) for the removed tagging's id: it must
      be gone, or carry its kind 5. Also read `wss://dcosl.brainstorm.world` for the same id.

## Epics in this book
- `my-assistants` — the My Assistants page, its menu link, the tagging actions and the Duties tab.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/my-assistants/audit.md`
- Product feedback: `engineering-team/audits/my-assistants/prd-seed.md`
