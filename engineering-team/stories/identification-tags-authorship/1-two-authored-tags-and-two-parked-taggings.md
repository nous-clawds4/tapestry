# Story 1: Two authored tags and two parked taggings

**Status:** Approved (gate 2026-09-22)
**Created:** 2026-09-22
**Type:** Feature

## Background

The `assistant-identification-tags` book (closed and shipped 2026-09-22) gave the Identification Tags page four
required taggings whose definitions were all to be authored by one key, the owner's (Discovery decision 5;
`CANONICAL_TAG_AUTHOR` in `src/lib/identification-tags/index.js`). None of those four definitions was ever
published under that key, so every row on every instance reads "Tag not found" today.

The owner has now authored two of the four under two identities, and parked the other two:

| Tagging | Definition (found on the relays 2026-09-22) | Author |
|---|---|---|
| My Tapestry Assistant | `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant` | Nous 🧠 (`npub1zhma4lzxyjc7dvq2klux8hs62wm3je6jspcwclgcxlr6grquwfcq28ccgm`) |
| My Tapestry Owner | `39999:a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528:my-tapestry-owner` | Nous 🧠's Tapestry Assistant (`npub15uaznqrgf946yhva0u6c88jk3r9kp64cn4dt5z24yrtcxk5lj55q2fvc99`) |
| My Agent | parked: undecided | — |
| My Human ("My Owner" in the ask) | parked: undecided | — |

Both definitions were created through tapestry.brainstorm.world (their local z is production's TA) and are on
production's, staging's and tags' relays, nos.lol, primal and dcosl. Nous and that Assistant have already tagged
each other with them through the tag surfaces (`profile-tag-my-tapestry-assistant-a73a2980-15f7dafc` and
`profile-tag-my-tapestry-owner-15f7dafc-a73a2980`, both apply), which is exactly the shape the check reads.

Affected: everyone who opens the page or whose hub reads the answer. Today the two offered taggings cannot be
published from the page; after this story they can, and the two parked ones are visibly out of play.

## User-facing description

As a person with a Tapestry Assistant, I want the Identification Tags page to publish "My Tapestry Assistant"
and "My Tapestry Owner" against the definitions that exist, and to show "My Agent" and "My Human" greyed out,
so that the two-way handshake works now while the other two taggings stay undecided.

## Acceptance criteria

- [ ] **AC-1 — the list carries each definition's author, and whether the tagging is offered.** The shared
      list still has the four entries in order (`my-tapestry-assistant`, `my-agent`, `my-tapestry-owner`,
      `my-human`, with their names, slugs, signers and targets). `my-tapestry-assistant` carries the author
      `15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270` and the address
      `39999:15f7dafc…:my-tapestry-assistant`; `my-tapestry-owner` carries the author
      `a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528` and the address
      `39999:a73a2980…:my-tapestry-owner`. `my-agent` and `my-human` are marked parked and carry no author and no
      address. One list, the same on every instance; the single canonical-author constant is gone.
- [ ] **AC-2 — the answer checks the offered taggings only.** Given a signed-in viewer with an Assistant, when
      `GET /api/assistant/attention` runs, then it looks each offered definition up at its own author's address,
      reports one row per offered tagging (present, finished, reason, definition, as today), carries no row for
      a parked tagging, and its `finished`, `done` and `pending` consider only the offered taggings. Given both
      offered taggings present (as Nous' are on production's relay), then `done` is true and the hub's card,
      count line and the Assistant Alert stop counting this action.
- [ ] **AC-3 — parked rows are greyed, unchecked and inert.** Given the page in any state, then each parked
      tagging shows on its card by name with a checkbox that is unchecked and disabled, a greyed row, and the
      words "Not offered yet"; it never joins the publish set, and the card's mark and Done badge consider only
      the offered rows (a card whose offered tagging is present reads Done).
- [ ] **AC-4 — the two publishers point at the right definitions.** When the first card publishes "My Tapestry
      Assistant", then the tagging's `a` is `39999:15f7dafc…:my-tapestry-assistant` and its `e` is that
      definition's event id; when the second card has the Assistant publish "My Tapestry Owner", then the
      route's tagging carries `a` = `39999:a73a2980…:my-tapestry-owner` and that definition's `e`. Everything
      else about both taggings (d, p, the two z stamps, polarity, content) is unchanged.
- [ ] **AC-5 — a parked key cannot be issued anywhere.** Given a POST to
      `/api/assistant/identification-tags/publish` naming `my-human` (alone or with `my-tapestry-owner`), then
      the request is refused 400 before any key is read, with the words "That is not one of the taggings your
      Assistant publishes." (the existing refusal), and nothing is published for either key.
- [ ] **AC-6 — the documents say what is true.** BIBLE §11 and §14 and the OpenAPI descriptions no longer say
      the Assistant signs "two" identification taggings or that one key authors the canonical definitions; they
      name the offered tagging(s) and say the parked ones are not published.
- [ ] **AC-7 — nothing else changes.** The tagging wire format, the `/tags` surfaces, the other nine actions and
      the reading of "present" (by name, whoever authored the tag) are untouched. The previous book's suites
      still pass, re-aimed only where they pinned the single canonical author or the four-row answer.

## Concepts touched

- `39999:15f7dafc4624b1e6b00ab7f863de1a53b71967528070ec7d1837c7a40c1c7270:my-tapestry-assistant` — My Tapestry
  Assistant (the definition the first card publishes against).
- `39999:a73a298068496ba25d9d7f35839e5688cb60eab89d5aba095520d7835a9f9528:my-tapestry-owner` — My Tapestry
  Owner (the definition the Assistant's route publishes against).
- `39998:<TA>:nostr-user-tag` — nostr user tag (the taggings' local z, runtime TA); the ADR-0015 legacy z
  literal alongside, unchanged.

## Copy

New unless marked **owner**.

| Element | Text | Source |
|---|---|---|
| Parked row state | Not offered yet | new (recommended; the owner decides at the gate) |
| Everything else | unchanged from the previous book's story 2 § Copy | — |

## Out of scope

- Deciding whether "My Agent" and "My Human" are supported, or authoring definitions for them.
- Reading a parked tagging's state (a same-named tag someone applied anyway is not shown).
- The `protocols/` convention note; the other carry-forwards of the previous book.
- Changing how "present" is read, the tag-federation relays, or the browser publish relay list.

## Open questions

*All four settled at the gate, 2026-09-22 (the owner took each recommendation):*

1. **The two authors** are the ones found on the relays (Background): Nous for "My Tapestry Assistant", Nous'
   Tapestry Assistant for "My Tapestry Owner".
2. **The parked taggings do not count** toward "needs attention": the card, the count line and the Assistant Alert
   consider only the two offered taggings (AC-2, AC-3).
3. **A parked row says "Not offered yet"** (AC-3, § Copy).
4. **The fourth tagging keeps the name "My Human"** while parked; renaming later is one word.

## Linked artifacts
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
