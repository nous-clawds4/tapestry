# Story 2: Show details — each card's assignments, entry by entry

**Status:** Approved
**Created:** 2026-10-08
**Type:** Feature *(Light lane — workflows/light-profile.md; Gate A approved 2026-10-08 by the owner ("Approved for both stories, go ahead"); scoped gate (named at Gate A):
`node -e "Promise.all(['./test/treasure-map-card-details.test.js','./test/manage-treasure-map-cards.test.js','./test/treasure-map-card-rule-edges.test.js','./test/treasure-map-star-scopes-ignored.test.js','./test/manage-treasure-map-page.test.js','./test/treasure-map-edit-mode.test.js','./test/treasure-map-switches.test.js','./test/treasure-map-save.test.js','./test/treasure-map-needs-attention.test.js'].map(p=>require(p).run())).then(rs=>{const f=rs.reduce((s,r)=>s+r.fail,0);console.log('TOTAL_FAIL='+f);process.exit(f?1:0)})"`
— the card-rule suites are in because this story moves the rule into one shared walk; no guard suite: nothing here
signs, publishes or touches strfry)*

## Background
A card on `/treasure-map` sums its category up in one line: "Assigned to Ava", or "Mixed · 3 Assistants". It doesn't
say which Map entries give which Assistant which duty, or which Assistants stand by as backups. That breakdown lives
only in the raw kind-10040 JSON. The owner wants each card to be able to show it.

## User-facing description
As a signed-in person looking at my Treasure Map, I want to open a details panel under any category card and see each
entry behind it, with its Assistant, relay and backups, so that I understand what "Assigned to" or "Mixed" means for
that category, before and while I edit it.

## Acceptance criteria
- [ ] AC-1: Every card has a "Show details" button at its foot. Pressed, it reads "Hide details" and opens the card's
      details panel below the card's content (below the picker row in Edit mode). Each card's button works on its own;
      all three start closed.
- [ ] AC-2: The panel lists the entries that count for the category, by the same rule the card's Assistant line uses:
      one group per key, in the order the Map first names each key, the key shown as the Map first spells it, in
      monospace. Under each key, every tag for it with a valid Assistant, in Map order: avatar and name (the card's name
      rule; the person's own Assistant here in the card's purple), the relay it names (or "No relay"), and "Backup" on
      every tag after the key's first.
- [ ] AC-3: A key that is one of the category's individually assigned duties (a Tag, a Pin, a DList, `contexts`, one
      Concept's list) is marked "Individually assigned". A bare `*` that reaches the category is marked "Everything
      else". Nothing that doesn't count is listed: `*:…` entries, a `*` covered by a family entry, tags without a valid
      Assistant, other categories' entries.
- [ ] AC-4: With nothing counted, the panel says "No entries yet." That includes no Map found.
- [ ] AC-5: In Edit mode the panel describes the edited draft and follows each pick, Undo, override switch and the
      backup switch as it changes. Leaving Edit (or a Save) shows the published Map again. A panel's open or closed
      state stays as it was when Edit mode starts or ends. *(Owner's decision 4: the edited draft.)*
- [ ] AC-6: Every Assistant in a panel is named once the page's names have loaded, backups included.
- [ ] AC-7: The card and its panel never disagree: the card's Assistants (one, or Mixed and its count) are exactly the
      distinct first Assistants of the panel's keys, in the same order.
- [ ] AC-8: The button is a real button (`aria-expanded`, `aria-controls`), operable from the keyboard, and the panel is
      a region named after its card ("Scores details"). At 375 px and 430 px long keys and relay URLs wrap inside the
      card and nothing scrolls sideways.
- [ ] AC-9: Nothing else moves: the cards' lines, Edit mode, the switches, Save, the raw viewers and story 1's pill.

## Concepts touched
None — page UI only. Reads the kind-10040 Map (and in Edit mode the draft) the page already holds.

## Design note *(Light profile — provisional here, ratified at Gate B)*
- **Chosen approach:** one walk of the card rule, shared by the card and its panel. `manageTreasureMap.js` gains a pure
  export `categoryEntries(event)` that does what `categoryAssistants` does today (valid 64-hex delegate,
  `appliesTo`, a covered `*` skipped, keys grouped by `norm`) but keeps everything: per category,
  `[{ key, norm, tags: [{ pubkey, relay }] }]`, keys in first-seen order, each key's valid tags in Map order, `key`
  being the first spelling. `categoryAssistants` is rewritten as a projection of it (each key's first pubkey, without
  repeats), so AC-7 holds by construction. The existing K/X suites pin its behaviour unchanged. In `Index.jsx`,
  `CategoryCard` takes `entries` and holds its own `open` state. The `<li>` is keyed by category and keeps its place
  when Edit starts or ends, so the state survives (AC-5). A new `CategoryDetails` renders the groups and labels a key
  with `entryRole(category, [key, pubkey])` from `editTreasureMap.js` (`'individual'` → "Individually assigned") or
  `norm === '*'` ("Everything else"). The source is `categoryEntries(event)` in view mode and
  `categoryEntries(plan.draft)` in Edit mode. The name lookup (`wantedKey`) widens from the counted Assistants to every
  pubkey in the published `categoryEntries`, so backups get names (AC-6). Words join `COPY`: `showDetails`,
  `hideDetails`, `detailsLabel(title)`, `backup`, `individual`, `everythingElse`, `noRelay`, `noEntries`. New CSS
  `.bsd-tm-cat-details*`.
- **Rejected alternative:** let the panel walk the tags with its own filter. Rejected because two copies of the card
  rule can drift: the card could say "Ava" while the panel lists Cy first, which is exactly what AC-7 forbids. The
  rule has already changed twice in treasure-map-edit (stories 1 and 2). Also rejected:
  putting the breakdown on the Advanced page. The owner asked for it per card, and the Advanced page is still a
  placeholder.
- **Blast radius:** `manageTreasureMap.js` (new export; `categoryAssistants` re-expressed, same answers),
  `ui/src/pages/treasure-map/Index.jsx` (`CategoryCard`, new `CategoryDetails`, the `wantedKey` set, passing entries),
  `ui/src/styles.css` (new rules), new `test/treasure-map-card-details.test.js` (+ `test/registry.js`), new
  `tests/brainstorm/treasure-map-card-details.spec.js`. `editTreasureMap.js` is consumed (`entryRole`), not changed.
  **Test consumers of `categoryAssistants`, all in the scoped gate, none edited:** `test/manage-treasure-map-cards.test.js`
  (K), `test/treasure-map-card-rule-edges.test.js` (X/N/H), `test/treasure-map-star-scopes-ignored.test.js`, and
  `test/treasure-map-edit-mode.test.js`, whose W4 pins the JSDoc sentence "that names anything after the `*`"
  directly above `export function categoryAssistants`. The rewrite keeps that JSDoc where it is. *(J1 advisory.)*
  **Not consumers** (grep-verified 2026-10-08): nothing outside `Index.jsx` imports `categoryAssistants` or
  `categoryCards`.
- **Wire fidelity:** none — nothing is signed, published or read differently.

## Edge cases & not-covered
- **E1 (not derivable from any AC):** widening the name lookup to backups also widens what the cards wait for before
  they first appear (`namesReady`). A Map with a backup Assistant whose profile can't be found must not hold the cards
  back forever: a failed or empty lookup still settles (`fetchProfilesChunked(...).catch(() => ({}))`), and the backup
  falls back to its shortened npub, as a counted Assistant does today.
- E2: one key in two spellings (`30382:rank`, then `30382:rank:`) is one group, shown as `30382:rank`, with the second
  tag marked Backup.
- E3: `39998:dlist-header` and `39998` are one Concepts key (`norm` `39998`), shown in whichever spelling comes first.
- E4: a key whose first tag has no valid Assistant: that tag is left out, and the next valid one is the key's first (no
  Backup mark).
- E5: the same Assistant twice on one key: both are listed, the second marked Backup (it is one, as far as the backup
  switch is concerned).
- E6: Edit mode, the backup switch on: every Backup row leaves the panel at once. An override on: the card's
  Individually assigned groups that name others leave.
- E7: Edit mode, Concepts assigned to B on a Map without them: the panel gains `39998` and `39999` groups naming B (the
  hotfix this book rides with).
- E8: `*` → A reaching all three cards shows as an "Everything else" group in each panel it reaches, and in none whose
  family entry covers it.
- **Not covered:** entries that belong to no category (unknown kinds, `*:…`). They are on no card and so in no panel.
  The raw viewer shows them, and the Advanced page is meant to. Plain-language names for keys (`30382:rank` → "Rank")
  are deferred; the owner picked the key as written.

## AC→handle lines
- AC-1 → D1, S5
- AC-2 → U1, U3, U4, U5, U6, U7, U10, D2, D7
- AC-3 → U8, U9, S4, D2
- AC-4 → U2, D3
- AC-5 → S2, D5
- AC-6 → S3, D4
- AC-7 → A1, S1, D6
- AC-8 → S5, D7, D8
- AC-9 → D9, R
- E1 → D4, S3 · E2 → U4 · E3 → U5 · E4 → U6 (incl. the J1 advisory: a key's first spelling on a tag with no valid
  Assistant) · E5 → U7 · E6 → D5 · E7 → D5 · E8 → U8, D2

U*, A1, W1, S* = `test/treasure-map-card-details.test.js` (Node: `categoryEntries` behaviour, its agreement with
`categoryAssistants` over every Map the card-rule suites use, the words, the wiring). D* =
`tests/brainstorm/treasure-map-card-details.spec.js` (browser). R = the existing Treasure Map suites in the scoped gate
(the card rule's K/X/N/H classes pin `categoryAssistants` unchanged through the rewrite) and the existing browser
specs, unchanged.

**Fails before the work** (checked 2026-10-08 against the pre-story code and build): all 17 Node tests fail; all ten
browser tests fail at the missing toggle.

**How to run**
- Node (the scoped gate, J3): the command in this file's header.
- Browser (Gate B evidence), against the branch's built UI on :7799 (`vite build`, then `vite preview --port 7799`
  from `ui/`): `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/treasure-map-needs-attention.spec.js tests/brainstorm/treasure-map-card-details.spec.js tests/brainstorm/treasure-map-save.spec.js tests/brainstorm/treasure-map-switches.spec.js tests/brainstorm/treasure-map-edit.spec.js tests/brainstorm/manage-treasure-map.spec.js tests/brainstorm/manage-treasure-map-cards.spec.js tests/brainstorm/my-assistants.spec.js tests/brainstorm/my-assistants-map.spec.js --project=chromium`
  (the two new specs, and the seven existing Treasure Map / My Assistants specs as regression, R2).

## Linked artifacts
- ADR: — (no irreversibility trigger: a pure read of tags the page already holds, and markup)
- Test suite: `test/treasure-map-card-details.test.js`, `tests/brainstorm/treasure-map-card-details.spec.js`
- Review: `engineering-team/reviews/treasure-map-card-details/2-show-details-panel.md`

Link by path only — never record verdicts or round history in this file.
