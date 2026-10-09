# Story 1: A Needs attention pill on an unassigned category

**Status:** Draft
**Created:** 2026-10-08
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A pending; scoped gate (proposed at Gate A):
`node -e "Promise.all(['./test/treasure-map-needs-attention.test.js','./test/manage-treasure-map-cards.test.js','./test/manage-treasure-map-page.test.js','./test/treasure-map-edit-mode.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`
— no guard suite: nothing here signs, publishes or touches strfry)*

## Background
On `/treasure-map` each of the three category cards (Scores, Lists, Concepts) says who the person's Treasure Map gives
that category to. When nobody is assigned, the card says "Not assigned yet" in grey, which is easy to read past. The
Assistant Management page (`/assistant`) already has a way to ask for action: a small amber "Needs attention" pill beside
a card's title. The owner wants the same pill on a Treasure Map card that has no Assistant.

## User-facing description
As a signed-in person looking at my Treasure Map, I want a category that has no Assistant to be marked "Needs
attention", so that I notice the gap and assign one.

## Acceptance criteria
- [ ] AC-1: Given the Map has been read and the cards are drawn, a card whose Assistant line reads "Not assigned yet"
      shows a "Needs attention" pill beside its title. A card with one Assistant, or Mixed, shows none. With no Map
      found, all three cards show it.
- [ ] AC-2: In Edit mode the pill follows the card as drawn: picking an Assistant for an unassigned card hides its pill
      (the card reads "Will be assigned to …"); that card's Undo brings it back; after a successful Save the card is
      assigned and has no pill. *(Owner's decision 2: hide while a pick is pending.)*
- [ ] AC-3: No pill while the Map or the names are loading, after a read error, or when signed out (no cards are drawn
      in those states; regression).
- [ ] AC-4: A screen reader hears "Needs attention: " before the card's title, as on `/assistant`; the visible pill is
      hidden from it. The Edit controls' descriptions, which name the card by its title's id, still read just the
      category name.
- [ ] AC-5: The pill is the `/assistant` badge's shape (a rounded pill with a thin border, small bold text) in an amber
      that reads on this page's white cards with a contrast of at least 4.5:1. At 375 px and 430 px wide the pill stays
      inside its card and nothing scrolls sideways.
- [ ] AC-6: The words are `/assistant`'s: this page takes "Needs attention" and its screen-reader prefix from
      `ASSISTANT_COPY`, so the two can't drift apart.
- [ ] AC-7: Nothing else moves: the cards' Assistant lines and Mixed line, Edit mode and Save; `/assistant`, the
      Assistant top-bar alert and its count are untouched (the count doesn't learn about the Treasure Map).

## Concepts touched
None — page UI only. Reads the kind-10040 Map the page already reads.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** in `ui/src/pages/treasure-map/Index.jsx`, `CategoryCard` wraps its title in a title row and,
  when `card.state === 'none'`, renders `<span className="bs-sr-only">{COPY.needsAttentionSrPrefix}</span>` *before*
  the title span (outside it, so `aria-describedby={titleId(key)}` on the pickers and switches keeps reading only the
  title) and `<span className="bsd-tm-cat-attention" aria-hidden="true">{COPY.needsAttention}</span>` after it.
  `COPY` in `manageTreasureMap.js` gains `needsAttention` and `needsAttentionSrPrefix`, taken from `ASSISTANT_COPY`
  (`ui/src/pages/assistant/actions.js`, a pure `.js` module, so the Node suites still load `manageTreasureMap.js` as
  they are). No new state: Edit mode already draws its cards from the edited draft (`categoryCards({ assistants:
  draftAssistants })`), so a pending pick makes the card `single` and the pill goes, and Undo brings it back. That
  is decision 2, with nothing extra to keep in sync. New CSS rule `.bsd-tm-cat-attention` copies
  `.bs-setup-step-badge`'s shape (padding `0.1rem 0.55rem`, radius 999px, 1px border, 0.72rem, weight 700) with the
  light-page amber this design already uses for `.bsd-page .bs-usermenu-role-badge`: text `#b45309` on `#fffbeb`,
  border `rgba(217, 119, 6, 0.35)`.
- **Rejected alternative:** reuse `.bs-setup-step-badge` itself. Rejected because its colours are for the dark pages:
  `#e3b341` on white is 1.95:1, well under the 4.5:1 AC-5 asks for (the chosen `#b45309` on `#fffbeb` is 4.84:1). Also rejected: a pill driven by the
  *published* card in Edit mode, which would need a second "is a pick pending" check to satisfy decision 2.
- **Blast radius:** `ui/src/pages/treasure-map/Index.jsx` (`CategoryCard` only), `manageTreasureMap.js` (`COPY` +
  one import), `ui/src/styles.css` (one new rule, plus a title-row rule), new `test/treasure-map-needs-attention.test.js`
  (+ `test/registry.js`), new `tests/brainstorm/treasure-map-needs-attention.spec.js`. **Not consumers** (grep-verified
  2026-10-08): `ui/src/utils/topBarAlert.js` and `ui/src/context/AssistantAttentionContext.jsx` reference neither the
  Treasure Map nor `categoryAssistants`; `categoryAssistants`/`categoryCards` have no consumer outside `Index.jsx`.
- **Wire fidelity:** none — nothing is signed, published or read differently.

## Edge cases & not-covered
- **E1 (not derivable from any AC):** a Map whose only entry touching a category is a scoped everything entry (`*:tag`
  → D) still gets the pill. The raw Map "mentions" the category, but the page ignores `*:…` entries (treasure-map-edit
  book decision 11), so the card reads "Not assigned yet". The pill follows the card, not the raw tags.
- E2: a bare `*` → A that reaches the category (no family entry covers it) counts as an assignment: the card reads A, no
  pill. The same `*` covered by `3038x` → B gives Scores B, still no pill.
- E3: a family entry with no valid Assistant (`3038x` → not-a-key) is no assignment: pill, unless a `*` reaches the card.
- E4: Assign to all, then one card's Undo: that card's pill comes back only if it was unassigned before; the other two
  cards, still pending, show none.
- E5: the backup switch and the override switches never change whether a card is assigned (the first Assistant of an own
  key always stays), so they never make a pill appear.
- **Not covered:** counting unassigned categories into the Assistant top-bar alert (out of scope, AC-7); what the pill
  should *do* when pressed (it's a label, as on `/assistant`, not a control).

## AC→handle lines
*(Tester fills at J2. U* = behavioural, S* = source sentinels, B* = browser spec, R* = regression.)*

## Linked artifacts
- ADR: — (no irreversibility trigger: page markup and one CSS rule)
- Test suite: `test/treasure-map-needs-attention.test.js`, `tests/brainstorm/treasure-map-needs-attention.spec.js`
- Review: `engineering-team/reviews/treasure-map-card-details/1-needs-attention-pill.md`

Link by path only — never record verdicts or round history in this file.
