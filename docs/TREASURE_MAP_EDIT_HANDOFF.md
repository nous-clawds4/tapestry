# Treasure Map Edit mode — Session Handoff (2026-10-07)

**Status:** ✅ ADDRESSED 2026-10-08: the book `treasure-map-edit` built Edit mode (stories 1–5), shipped it to staging (PR #821) and closed (`engineering-team/audits/treasure-map-edit/audit.md`, `prd-seed.md`). The body below is kept for history; § 0 says what is true now.

> **Audience:** the session that builds Edit mode.
> **Source session:** the manage-treasure-map book (opened and closed 2026-10-07; on staging, not on main).

## 0. Where things stand

**Now (2026-10-08, at the book's close):**
- **On staging:** `/treasure-map` with Edit mode and Save, plus the card-rule fixes. The owner edited and saved their
  own Map there. Record: `engineering-team/audits/treasure-map-edit/` (`book.md`, `audit.md`, `prd-seed.md`).
- **The close commit is on `feat/treasure-map-edit`.** It reaches `staging` through a docs-only PR (ledger
  `2026-10-08-treasure-map-close-awaits-staging`).
- **Production:** this book and manage-treasure-map go to `main` together, only on the owner's explicit go.
- **What's next:** the audit's § 6 and the seed's § 7. They cover Save's hardening
  (`2026-10-08-treasure-map-save-hardening`), focus after a newer Map (`2026-10-08-treasure-map-focus-after-newer-map`),
  the Advanced page, and whether assignments should also write the NIP-85 keys today's apps read.

**As it stood when this handoff was written (2026-10-07):**

- **Shipped to staging:** `/treasure-map` (Manage your Treasure Map, view-only: introduction, FAQ, the Assistants by
  category cards, the raw Treasure Map viewer, the Advanced management link) and the `/treasure-map/advanced`
  placeholder. The book's record: `engineering-team/audits/manage-treasure-map/` (`book.md`, `audit.md`,
  `prd-seed.md`, `blueprint/`).
- **Production waits for Edit mode.** The owner decided on 2026-10-07 not to promote staging to main until Edit mode
  ships. Both then go to main together, still only on the owner's explicit go.

## 1. The owner's decisions for Edit mode (carry them into the new book's acceptance frame)

1. **Which Assistants can be picked:** only the ones on the My Assistants page (`/assistants`). That list is
   `GET /api/assistant/my-assistants`, answered for the session's viewer (`ui/src/pages/assistants/Index.jsx`).
2. **Backup Assistants:** in Edit mode, show **one switch, off by default**, that clears out any and every backup
   Assistant assignment in the Map. There is no finer control of backups on this page; that belongs to the Advanced
   page, a later book.
   - In the draft grammar (`protocols/drafts/treasure-maps.md` §7), a key listed more than once has a Preferred
     provider (the first entry) and Alternates (the rest). Switched on, Save keeps only the first entry of each key.
   - Taken literally, "any and every … in the Map" includes keys this page doesn't show. Confirm that reading in
     Planning before writing the story.
   - The blueprint has no such switch, so its words are new. Propose them in Planning for the owner to approve.
3. **Still binding from the closed book:**
   - the blueprint's words stay, even where they run ahead of the app (book decision 4);
   - the cards' counting rule (decisions 7–9: "Not assigned yet", broad entries count, a broad entry next to a
     specific one reads Mixed).

## 2. Lane and first steps

1. **Engineering flow, like the closed book.** The blueprint is the design, so the full product discovery isn't
   needed. At intake, open a new book (`engineering-team/audits/<slug>/book.md`, with an acceptance frame the owner
   confirms) and a new epic. A suggested slug is `treasure-map-edit`.
2. **Fix the card rule first:** ledger `2026-10-07-treasure-map-card-rule-edge-cases`. Edit mode's preview reuses
   `categoryAssistants` (`ui/src/pages/treasure-map/manageTreasureMap.js`), so its three draft-grammar edge cases
   should be right before anything is built on it. This is a small bug story at the start of the book.
3. **Then `/plan-feature` for Edit mode.** Planning decides whether it is one story or two (for example, edit controls
   and preview, then Save).

## 3. The design

- `engineering-team/audits/manage-treasure-map/blueprint/treasure-map-screen.html.txt`: the Edit button (line ~30)
  and every `tmbEdit` block (lines ~32, ~95, ~132, ~161), which hold the per-card pickers, the override switches,
  Undo, the save bar and the edited raw viewer.
- `engineering-team/audits/manage-treasure-map/blueprint/treasure-map-logic.js.txt`, lines ~75–125: `tmbEdit`,
  `tmbPending`, `tmbOver`, "All duties → …", "Override N individually assigned duties", Undo, the save note ("No
  changes yet" / "N unsaved changes"), "View the raw Treasure Map — edited", and the toast "Treasure Map updated".
- The live artifact (https://claude.ai/artifact/SiFE8XoAbC3KH5TQbG4Y8m) may have changed since version
  `1791333324-4c16`, the one this folder copies. If the owner says it has, re-read it with the Artifact tool's read
  action.

## 4. Code to reuse

- **Signing and publishing:** `ui/src/pages/grapevine/TreasureMapManualEdit.jsx` signs with `window.nostr.signEvent`
  and publishes with `publishOrThrow` (`ui/src/utils/publishProfileTag.js`). The Map is the person's own kind 10040,
  so their own signer signs it.
- **Changing one entry and keeping the rest:** `ui/src/utils/treasureMap.js` (`upsertGenericTlTag`,
  `upsertDListEntry`, `removeDListEntry`, `composeManualUpdate`, `restamp`).
- **A conflict for Architecture to settle:** `src/lib/treasureMapMerge.js`. The legacy generators (the legacy
  customer page and the NIP-85 control panel) own the `30382:*` rows and replace them as one block when they
  regenerate. If Edit mode writes `30382:*` rows (for example, Scores to another Assistant), a later regenerate from
  those pages would overwrite the person's choice.
- **Reading:** `useTreasureMap(viewer, { strict: true })`, as the page already does. The view model is
  `manageTreasureMap.js` (`categoryAssistants`, `categoryCards`, `COPY`). Assistant names and fields come from
  `ui/src/pages/assistants/myAssistants.js` (`cardFields`, `treasureMapDuties`) and `fetchProfilesChunked`.

## 5. Rules Edit mode must keep

- **Keep everything the edit doesn't change.** Every entry not edited stays byte for byte and in its place, including
  entries this page doesn't show (CLAUDE.md principle 4; the same rule as `treasureMapMerge.js`). The backup switch
  is the one deliberate exception, and only when it is on.
- **Only your own Map.** The Map edited is always the session user's own, never a URL or parameter.
- **Never assume the TA.** The viewer's own local Assistant is `user.assistantPubkey`: never `taPubkey`, never a
  literal (CLAUDE.md, per-deployment TA pubkey).
- **Nothing before the read.** Nothing is claimed before the Map has been read. No Save while the read is loading or
  has failed, and none for a person with no Map yet unless Planning decides that Edit can create one.
- **No key on the raw viewer.** Its open state must survive sign-in settling (ADR manage-treasure-map/0002
  Amendment 2). Don't bring a key back.

## 6. How this book tested (the recipe)

- **Node:** `npm test`, then read the result with `npm run -s gate:status`. New suites are registered in
  `test/registry.js`.
- **Browser specs without the Docker stack:** build the UI (`cd ui && npm run build`, which writes to the repo-root
  `dist/`). Serve it on :7799 with the small server below, then run
  `BRAINSTORM_BASE_URL=http://localhost:7799 npx playwright test tests/brainstorm/<spec> --project=chromium`.
  - Each spec mocks the `/api/*` calls it needs with `page.route`; anything unmocked answers 404 JSON.
  - A container restart kills the server, so start it again.
- **The signer in browser specs:** `tests/brainstorm/manage-treasure-map-cards.spec.js` (line ~81) installs a
  `window.nostr` whose `signEvent` counts calls in `window.__signCalls`, and switches person through
  `window.__pubkey`. Save's specs can build on it.
- **Specs that must stay green:** `tests/brainstorm/manage-treasure-map.spec.js`,
  `manage-treasure-map-cards.spec.js`, `my-assistants.spec.js` and `my-assistants-map.spec.js`.
  - When story 2 added words that story 1's specs already looked for, those specs matched twice. Scope new locators
    to their own section (ledger `2026-10-07-neighbour-suite-duplicate-roles`).
- **Live checks:** `test/manage-treasure-map-page.test.js` § H runs against `BRAINSTORM_BASE_URL`, for example
  `https://staging.brainstorm.world` after a staging deploy.

The server: save it in your scratchpad, not the repo, and run `node <scratchpad>/static-spa.js <repo>/dist 7799 &`.

```js
// Serves a built ui/dist with the control panel's SPA fallback; every /api/* the test didn't mock answers 404 JSON.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(process.argv[2]); const port = Number(process.argv[3] || 7799);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.webp': 'image/webp' };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.startsWith('/api/')) { res.writeHead(404, { 'content-type': 'application/json' }); return res.end('{"success":false,"error":"not mocked"}'); }
  let file = path.join(root, p);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log('serving', root, 'on', port));
```

## 7. Open items near this work

- Ledger `2026-10-07-top-bar-sign-in-while-loading`: the top bar offers Sign in while the session check runs. If
  it's fixed, the raw viewer's comment and ADR 0002 Amendment 2's correction can drop their exception.
- Ledger `2026-10-01-treasure-map-retry-skips-relay-list`: after one failed read of the general-purpose relay list,
  Try again never reads it again until the page reloads.
- `prd-seed.md` §7, the product questions. Decision 2 above settles how backups are edited on this page (one
  clear-all switch; per-entry control goes to Advanced). Whether the cards ever *show* backups is still open.

## 8. Start the next session with

*Done: the book was started and closed.* The next Treasure Map work starts from
`engineering-team/audits/treasure-map-edit/prd-seed.md` § 7 (product questions) or audit § 6 (engineering follow-ups).

> Read `docs/TREASURE_MAP_EDIT_HANDOFF.md` and start the Treasure Map Edit mode book.
