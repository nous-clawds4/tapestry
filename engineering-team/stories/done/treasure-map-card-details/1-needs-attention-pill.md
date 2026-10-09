# Story 1: A Needs attention pill on an unassigned category

**Status:** Done
**Created:** 2026-10-08
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-10-08 by the owner ("Approved for both stories, go ahead"); scoped gate (named at Gate A):
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
      *Superseded in part 2026-10-09 by assistant-trusted-content-status #1 (owner-approved): the count now covers
      Scores, Lists and Concepts, answered by the server from the Treasure Map; the alert files still read nothing of
      the Map themselves (S4, narrowed).*

## Concepts touched
None — page UI only. Reads the kind-10040 Map the page already reads.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** in `ui/src/pages/treasure-map/Index.jsx`, `CategoryCard` wraps its title in a title row and,
  when `card.state === 'none'`, renders `<span className="bs-sr-only">{COPY.needsAttentionSrPrefix}</span>` *before*
  the title span (outside it, so `aria-describedby={titleId(key)}` on the pickers and switches keeps reading only the
  title) and `<span className="bsd-tm-cat-attention" aria-hidden="true">{COPY.needsAttention}</span>` after it.
  `COPY` in `manageTreasureMap.js` gains `needsAttention` and `needsAttentionSrPrefix`, taken from `ASSISTANT_COPY`
  through `import { ASSISTANT_COPY } from '../assistant/actions.js'`. The import keeps its `.js` suffix, as the
  page's suites require of these modules, so Node still loads `manageTreasureMap.js` as it is. `actions.js` is
  already in that module graph through `myAssistants.js`. No new state: Edit mode already draws its cards from the edited draft (`categoryCards({ assistants:
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
  Treasure Map nor `categoryAssistants`. In `ui/src`, `categoryAssistants`/`categoryCards` have no consumer outside
  `Index.jsx`. Four suites import them (`manage-treasure-map-cards`, `treasure-map-card-rule-edges`,
  `treasure-map-star-scopes-ignored`, `treasure-map-edit-mode`), and this story changes neither function. *(J1
  advisory.)*
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
- E6: the names lookup is a second wait before the cards draw (`namesReady`): no pill until it settles (N6d). Its
  failure still draws the cards with fallback names, and so the pill (N6e).
- E7: a failed Save keeps Edit mode and the pick, so the card stays pending and pill-free until Undo (N9).
- **Not covered:** counting unassigned categories into the Assistant top-bar alert (out of scope, AC-7); what the pill
  should *do* when pressed (it's a label, as on `/assistant`, not a control); the other ways a Save can fail (no
  signer, a declined signature, a save gone stale). They end on the same path as N9 (Edit mode and the pick stay, so
  the card is drawn from the draft), and `treasure-map-save.spec.js` covers each of them, unchanged by this story. A
  partial Save (some relays accept) ends Edit mode and shows the signed Map, which is N5's path. If the person's
  Assistants can't be loaded in Edit mode, no pick can be made, so the card stays as published (N1's state).

## AC→handle lines
- AC-1 → N1, N2, N3, R1
- AC-2 → N4, N5 (a Save that goes through), N9 (a Save accepted nowhere)
- AC-3 → N6a (the Map loading), N6b (a read error), N6c (signed out), N6d (the names loading), N6e (the names lookup
  failing: the cards still draw, pill included)
- AC-4 → N7, S2
- AC-5 → N8, S3
- AC-6 → W1, S1
- AC-7 → S4 (negative pin), R2
- E1 → N3, R1 · E2 → N3, R1 · E3 → R1 · E4 → N4 · E5 → N4

N* = `tests/brainstorm/treasure-map-needs-attention.spec.js` (browser, what a viewer sees). W*, S*, R1 =
`test/treasure-map-needs-attention.test.js` (Node: the words, the wiring, the CSS rule, the alert's negative pin; R1 the
card states the pill follows, which pass before and after). R2 = the existing Treasure Map suites in the scoped gate and
the existing browser specs below, unchanged.

**Fails before the work** (checked 2026-10-08 against the pre-story code and build, one result per test): Node W1, S1,
S2, S3 fail; S4 and R1 pass (sentinels). Browser: N6b and N6c pass (sentinels: no pill after a read error, or signed
out). Every other test fails at the missing pill: N1, N2, N3, N4, N5, N7, N8 (×2), and N6e at their first pill check;
N6a and N6d only after their loading legs (which pass); N9 only at its last step, the pill after Undo (its failed-save
legs, the alert and Edit and the pick staying, pass).

**How to run**
- Node (the scoped gate, J3): the command in this file's header.
- Browser (Gate B evidence), against the branch's built UI on :7799 (`vite build`, then `vite preview --port 7799`
  from `ui/`): `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/treasure-map-needs-attention.spec.js tests/brainstorm/treasure-map-save.spec.js tests/brainstorm/treasure-map-switches.spec.js tests/brainstorm/treasure-map-edit.spec.js tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium`
  (this story's spec, and the seven existing Treasure Map / My Assistants specs as regression, R2; story 2's spec
  is story 2's).

## Linked artifacts
- ADR: — (no irreversibility trigger: page markup and one CSS rule)
- Test suite: `test/treasure-map-needs-attention.test.js`, `tests/brainstorm/treasure-map-needs-attention.spec.js`
- Review: `engineering-team/reviews/done/treasure-map-card-details/1-needs-attention-pill.md`

Link by path only — never record verdicts or round history in this file.
