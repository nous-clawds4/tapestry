const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * treasure-map-edit #3 — Edit mode on /treasure-map: assign Assistants and preview the result. What a viewer sees and
 * does.
 *
 * Story: engineering-team/stories/treasure-map-edit/3-edit-mode-assign-and-preview.md
 * ADR:   engineering-team/decisions/treasure-map-edit/0003-a-pure-edit-model-beside-the-card-rule.md
 * Plan:  engineering-team/stories/treasure-map-edit/3-edit-mode-assign-and-preview.test-plan.md
 * Node half: test/treasure-map-edit-mode.test.js (the edit model, the words, the wiring).
 *
 * Mocks as the cards spec (tests/brainstorm/manage-treasure-map-cards.spec.js): the Map read local-first, then the
 * strict relay read, /api/profiles answering names; plus GET /api/assistant/my-assistants (the person's Assistants) and
 * /api/relays (the instance's relay settings). Every WebSocket is blocked and counted; window.nostr counts signEvent.
 *
 *   E1 — Edit on: "Editing", pressed, the controls appear; off: they go, and unsaved changes are discarded.  [AC-1]
 *   E2 — no Edit while the Map loads, after it couldn't be read, or signed out.                            [AC-1]
 *   E3 — no Map: Edit still works, and the no-Map warning sits at the top of Edit mode; with a Map, none. [AC-1]
 *   E4 — a card's list: your Assistants, Local first, then by name; Local, Current, the check; detail lines. [AC-2]
 *   E5 — pick another: Unsaved, "Will be assigned to", Undo, Change, the preview; pick the current: cleared. [AC-2, AC-6]
 *   E6 — a card's Undo removes its change.                                                                   [AC-2]
 *   E7 — one list open at a time; the button closes its own list.                                            [AC-2]
 *   E8 — the list's states: loading, can't load with Try again, none (with the My Assistants link, in the
 *        page's status style).                                                                                [AC-2]
 *   E9 — Assign to all: every card pending, "All duties → name"; a card changed after; a card's Undo also
 *        cancels the everything change (book decision 16, re-aimed at story 4); the row's Undo.          [AC-3, AC-4]
 *   E10 — Current in the All duties list only when all three cards name one Assistant; picking it clears.   [AC-3]
 *   E11 — the edited raw viewer: closed at first, "Unsaved draft", the Map exactly as Save would sign it; the raw
 *         viewer still shows the published Map.                                                       [AC-5, AC-6]
 *   E12 — the Assistant here gets the instance's relay for the category; others "".                        [AC-5]
 *   E13 — no Map: the draft holds only the new entry.                                                  [AC-5, AC-6]
 *   E14 — leaving Edit closes the edited viewer and drops the changes; Edit again starts fresh.         [AC-1, AC-6]
 *   E15 — a whole edit session signs nothing, publishes nothing, opens no socket; no Save changes.     [AC-4, AC-6]
 *   E16 — at 375 and 430 px, every open list lies inside the screen, with nothing pending and with a name
 *         pending, and nothing pushes the page sideways.                                                 [AC-2, AC-3]
 *   E17 — after a pick, an Undo or Try again, focus goes back to the list's button.                     [AC-2, AC-3]
 *   E18 — an open list closes on Escape, when focus leaves it and on a click outside it; a closed list's
 *         button never names a missing element.                                                                [AC-2]
 *   E19 — each card's button and Undo say which card they belong to; the All duties Undo says All duties; the
 *         save note is announced.                                                                    [AC-2, AC-3, AC-4]
 *
 * E8's status-style check, E16's bounds and E17–E19 are Amendment 2 (story 3's review, round 1).
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';
const A_RELAYS = { aTrustedAssertionRelays: ['wss://ta.example'], aTrustedListRelays: ['wss://tl.example'], aDListRelays: ['wss://dl.example'] };

const mapOf = (tags) => ({ id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: '', tags, sig: 'f'.repeat(128) });
// Scores: rank and followers → Ava (single). Lists: your own Assistant (single). Concepts: yours, plus Cy curating one
// list (Mixed). `*:tag` → Dee is ignored (story 2) and must stay in the Map untouched.
const MAIN_TAGS = [['30382:rank', A, R], ['30382:followers', A, R], ['30392', LOCAL, R], ['39998:dlist-header', LOCAL, R], ['39998:restaurants', C, R], ['*:tag', D, R]];
const MAIN = mapOf(MAIN_TAGS);
const ALL_AVA = mapOf([['*', A, R]]);
const PROFILES = {
  [A]: { display_name: 'Ava', website: 'ava.example', nip05: 'ava@ava.example' },
  [B]: { name: 'Bea', nip05: 'bea@bea.example' },
  [C]: { display_name: 'Cy' },
  [D]: { display_name: 'Dee' },
  [LOCAL]: { display_name: 'Zed Local' },
};
// Out of order on purpose: the list puts Local first, then sorts by name (Ava, Bea, Cy).
const MY_ROWS = [{ pubkey: C, local: false, tags: [] }, { pubkey: B, local: false, tags: [] }, { pubkey: LOCAL, local: true, tags: [] }, { pubkey: A, local: false, tags: [] }];

const WORDS = {
  descriptions: {
    Scores: 'Trust scores for profiles and content, one at a time.',
    Lists: 'Curated lists of profiles and content.',
    Concepts: 'Structured datasets your community organizes together.',
  },
  allDutiesLine: 'Assign one Assistant to Scores, Lists, Concepts, and everything else.',
  noMap: 'We didn’t find a Treasure Map on your relays, so saving will publish a new one. If you already have one on a relay we couldn’t check, the new one will replace it.',
  loading: 'Loading your Assistants…',
  error: 'Couldn’t load your Assistants.',
  empty: 'You have no Assistants yet. Add one on the My Assistants page.',
};

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }
const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };

async function setup(page, {
  signedIn = true, mapLocal = MAIN, mapHold = null, relayAnswers = [{ success: true, events: [] }], relayList = ['wss://one.example'],
  myRows = MY_ROWS, myHold = null, myFail = false,
} = {}) {
  const state = { ws: 0, writes: [], session: signedIn, myAsks: 0, myRows, myHold, myFail };
  await page.routeWebSocket(/.*/, (ws) => { state.ws++; ws.close(); });
  await page.addInitScript((viewer) => {
    window.__signCalls = 0;
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => { window.__signCalls++; return { ...u, pubkey: viewer, id: '7'.repeat(64), sig: 'f'.repeat(128) }; },
    };
  }, VIEWER);
  page.on('request', (req) => {
    const p = new URL(req.url()).pathname;
    if (!p.startsWith('/api/') || req.method() === 'GET') return;
    if (req.method() === 'POST' && p === '/api/neo4j/query') {
      let cypher = '';
      try { cypher = JSON.parse(req.postData() || '{}').cypher || ''; } catch { /* not JSON */ }
      if (!/\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i.test(cypher)) return;
    }
    state.writes.push(`${req.method()} ${p}`);
  });
  await page.route('**/api/strfry/scan**', async (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      if (mapHold) await mapHold;
      return json(r, { success: true, events: mapLocal ? [mapLocal] : [] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: relayList.map((url, i) => ({ name: `relay ${i}`, json: JSON.stringify({ nostrRelay: { websocketUrl: url } }) })) }));
  let relayAsks = 0;
  await page.route('**/api/relay/external**', (r) => {
    relayAsks++;
    const a = relayAnswers[Math.min(relayAsks - 1, relayAnswers.length - 1)];
    return json(r, a, a.success === false ? 500 : 200);
  });
  await page.route('**/api/profiles**', (r) => {
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out[k] = PROFILES[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/assistant/my-assistants**', async (r) => {
    state.myAsks++;
    if (state.myHold) await state.myHold;
    if (state.myFail) return json(r, { success: false, error: 'Could not load your Assistants' }, 500);
    return json(r, state.session
      ? { success: true, signedIn: true, local: LOCAL, rows: state.myRows, definitions: {} }
      : { success: true, signedIn: false });
  });
  await page.route('**/api/relays', (r) => json(r, { success: true, aRelays: A_RELAYS }));
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: '2'.repeat(64) }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: '1'.repeat(64) }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, state.session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, state.session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, state.session ? { authenticated: true, pubkey: VIEWER } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: state.session ? 'customer' : 'unauthenticated',
    pubkey: state.session ? VIEWER : null,
    assistantPubkey: state.session ? LOCAL : null,
  }));
  return state;
}

const main = (page) => page.locator('main');
const section = (page) => main(page).getByRole('region', { name: 'Assistants by category' });
const editButton = (page) => main(page).getByRole('button', { name: /^Edit(ing)?$/ });
const PICKER = /^(Choose an Assistant|Change)$/;
/** A card in Edit mode: the innermost element holding its description and its picker button. */
const editCard = (page, title) => section(page).locator('*')
  .filter({ hasText: WORDS.descriptions[title] })
  .filter({ has: page.getByRole('button', { name: PICKER }) })
  .last();
const pickerButton = (page, title) => editCard(page, title).getByRole('button', { name: PICKER });
const assignAll = (page) => section(page).getByRole('button', { name: 'Assign to all', exact: true });
/** The list a toggle opens: the element its aria-controls names. */
async function listOf(page, toggle) {
  const id = await toggle.getAttribute('aria-controls');
  expect(id, 'a list toggle names its list with aria-controls (ADR 0003 sub-decision 4)').toBeTruthy();
  return page.locator(`[id="${id}"]`);
}
const rowsOf = (list) => list.getByRole('button');
// A row's name may start with its avatar letter, so the name is matched as a word anywhere in it.
const row = (list, name) => list.getByRole('button', { name: new RegExp(`\\b${name}\\b`) });
async function openList(page, toggle) {
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const list = await listOf(page, toggle);
  await expect(list).toBeVisible();
  return list;
}
async function pick(page, toggle, name) {
  const list = await openList(page, toggle);
  await row(list, name).click();
  await expect(list).toBeHidden();
}
const saveNote = (page, text) => section(page).getByText(text, { exact: true });
/** The All duties row: the innermost element holding its line and its Assign to all button. */
const allRow = (page) => section(page).locator('*').filter({ hasText: WORDS.allDutiesLine })
  .filter({ has: page.getByRole('button', { name: 'Assign to all', exact: true }) }).last();
// The raw viewer's toggle (its name also holds the "kind 10040" chip), never the edited one.
const rawButton = (page) => main(page).getByRole('button', { name: /^(View|Hide) the raw Treasure Map(?! —)/ });
const editedButton = (page) => main(page).getByRole('button', { name: /^(View|Hide) the raw Treasure Map — edited/ });
/** The edited viewer's <pre>: inside the innermost element holding its toggle and a <pre>. A `has` locator is looked
 * for inside each candidate, so it starts from the page, never from <main> (story 3 test plan, Amendment 1). */
const editedPre = (page) => main(page).locator('*')
  .filter({ has: page.getByRole('button', { name: /^(View|Hide) the raw Treasure Map — edited/ }) })
  .filter({ has: page.locator('pre') })
  .last()
  .locator('pre');
async function startEditing(page) {
  await expect(editButton(page)).toHaveText(/^Edit$/);
  await editButton(page).click();
  await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
}
async function safe(page, state) {
  expect(state.ws, 'no WebSocket may be opened').toBe(0);
  expect(state.writes, 'Edit mode only reads').toEqual([]);
  expect(await page.evaluate(() => window.__signCalls), 'nothing is signed').toBe(0);
}

test.describe('/treasure-map — Edit mode: assign and preview', () => {
  test('E1: Edit on shows the controls and reads "Editing"; off hides them and discards unsaved changes', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/treasure-map');
    await expect(editButton(page)).toHaveText(/^Edit$/);
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
    await startEditing(page);
    await expect(editButton(page)).toHaveText(/^Editing$/);
    await expect(section(page).getByText('All duties', { exact: true })).toBeVisible();
    await expect(section(page).getByText(WORDS.allDutiesLine, { exact: true })).toBeVisible();
    await expect(assignAll(page)).toBeVisible();
    await expect(section(page).getByRole('button', { name: 'Choose an Assistant', exact: true })).toHaveCount(3);
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(saveNote(page, '1 unsaved change')).toBeVisible();
    await editButton(page).click();
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(section(page).getByText('All duties', { exact: true })).toHaveCount(0);
    await expect(section(page).getByRole('button', { name: PICKER })).toHaveCount(0);
    await expect(section(page).getByText('Unsaved', { exact: true })).toHaveCount(0);
    await startEditing(page);
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
    await expect(section(page).getByText('Unsaved', { exact: true })).toHaveCount(0);
    await safe(page, state);
  });

  test('E2: no Edit while the Map loads, after it couldn’t be read, or signed out', async ({ page }) => {
    const hold = deferred();
    await setup(page, { mapHold: hold.promise });
    await page.goto('/treasure-map');
    await expect(section(page).getByText('Loading your Treasure Map…')).toBeVisible();
    await expect(editButton(page)).toHaveCount(0);
    hold.resolve();
    await expect(editButton(page)).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'relay down' }] });
    await page.goto('/treasure-map');
    await expect(section(page).getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(editButton(page)).toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { signedIn: false });
    await page.goto('/treasure-map');
    await expect(main(page).getByText('Sign in to see your Treasure Map.')).toBeVisible();
    await expect(editButton(page)).toHaveCount(0);
  });

  test('E3: no Map — Edit works and the no-Map warning sits at the top of Edit mode; a found Map shows no warning', async ({ page }) => {
    await setup(page, { mapLocal: null });
    await page.goto('/treasure-map');
    await startEditing(page);
    const warning = section(page).getByText(WORDS.noMap, { exact: true });
    await expect(warning).toBeVisible();
    const warnY = (await warning.boundingBox()).y;
    const allY = (await section(page).getByText('All duties', { exact: true }).boundingBox()).y;
    expect(warnY, 'the warning is above the All duties row').toBeLessThan(allY);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(section(page).getByText(WORDS.noMap)).toHaveCount(0);
  });

  test('E4: a card’s list — your Assistants, Local first then by name; Local and Current badges; the check; the detail line', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    const list = await openList(page, pickerButton(page, 'Scores'));
    await expect(rowsOf(list)).toHaveCount(4);
    const texts = await rowsOf(list).allInnerTexts();
    const NAMES = ['Zed Local', 'Ava', 'Bea', 'Cy'];
    expect(texts.map((t) => NAMES.find((n) => t.includes(n))), 'Zed Local first, then Ava, Bea, Cy').toEqual(NAMES);
    await expect(row(list, 'Zed Local').getByText('Local', { exact: true })).toBeVisible();
    await expect(row(list, 'Zed Local')).toContainText(npubShort(LOCAL));
    await expect(row(list, 'Ava').getByText('Current', { exact: true })).toBeVisible();
    await expect(row(list, 'Ava')).toContainText('ava.example');
    await expect(row(list, 'Bea')).toContainText('bea@bea.example');
    await expect(row(list, 'Cy')).toContainText(npubShort(C));
    await expect(row(list, 'Ava')).toHaveAttribute('aria-pressed', 'true');
    for (const name of ['Zed Local', 'Bea', 'Cy']) await expect(row(list, name)).toHaveAttribute('aria-pressed', 'false');
    for (const name of ['Zed Local', 'Bea', 'Cy']) await expect(row(list, name).getByText('Current', { exact: true })).toHaveCount(0);
    for (const name of ['Ava', 'Bea', 'Cy']) await expect(row(list, name).getByText('Local', { exact: true })).toHaveCount(0);
    // Concepts is Mixed: no row is Current there.
    await pickerButton(page, 'Scores').click();
    const concepts = await openList(page, pickerButton(page, 'Concepts'));
    for (const name of ['Zed Local', 'Ava', 'Bea', 'Cy']) await expect(row(concepts, name).getByText('Current', { exact: true })).toHaveCount(0);
  });

  test('E5: pick another — Unsaved, "Will be assigned to Bea", Undo, Change, and the card previews Bea; pick the current one — cleared', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const scores = editCard(page, 'Scores');
    await expect(scores.getByText('Unsaved', { exact: true })).toBeVisible();
    await expect(scores.getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
    await expect(scores.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
    await expect(pickerButton(page, 'Scores')).toHaveText(/^Change$/);
    await expect(scores).toContainText('Assigned to');
    await expect(scores).toContainText('Bea');
    await expect(scores).not.toContainText('Ava');
    await expect(saveNote(page, '1 unsaved change')).toBeVisible();
    const list = await openList(page, pickerButton(page, 'Scores'));
    await expect(row(list, 'Bea')).toHaveAttribute('aria-pressed', 'true');
    await expect(row(list, 'Ava').getByText('Current', { exact: true })).toBeVisible();
    await row(list, 'Ava').click();
    await expect(scores.getByText('Unsaved', { exact: true })).toHaveCount(0);
    await expect(pickerButton(page, 'Scores')).toHaveText(/^Choose an Assistant$/);
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
    await expect(scores).toContainText('Ava');
  });

  test('E6: a card’s Undo removes its change, and only its', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await pick(page, pickerButton(page, 'Lists'), 'Cy');
    await expect(saveNote(page, '2 unsaved changes')).toBeVisible();
    await editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(editCard(page, 'Scores').getByText('Unsaved', { exact: true })).toHaveCount(0);
    await expect(editCard(page, 'Lists').getByText('Will be assigned to Cy', { exact: true })).toBeVisible();
    await expect(saveNote(page, '1 unsaved change')).toBeVisible();
  });

  test('E7: one list open at a time, and a list’s own button closes it', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    // An open list drops down over the cards below it, as in the blueprint, so the second toggle each time is one the
    // open list doesn't cover: Assign to all sits above the cards (story 3 test plan, Amendment 1).
    const scores = await openList(page, pickerButton(page, 'Scores'));
    const all = await openList(page, assignAll(page));
    await expect(scores).toBeHidden();
    await expect(pickerButton(page, 'Scores')).toHaveAttribute('aria-expanded', 'false');
    await assignAll(page).click();
    await expect(all).toBeHidden();
    await expect(assignAll(page)).toHaveAttribute('aria-expanded', 'false');
    const lists = await openList(page, pickerButton(page, 'Lists'));
    await pickerButton(page, 'Lists').click();
    await expect(lists).toBeHidden();
    await expect(pickerButton(page, 'Lists')).toHaveAttribute('aria-expanded', 'false');
    const concepts = await openList(page, pickerButton(page, 'Concepts'));
    await openList(page, assignAll(page));
    await expect(concepts).toBeHidden();
    await expect(pickerButton(page, 'Concepts')).toHaveAttribute('aria-expanded', 'false');
  });

  test('E8: the list’s states — loading; can’t load, then Try again; no Assistants, with the My Assistants link', async ({ page }) => {
    const hold = deferred();
    const state = await setup(page, { myHold: hold.promise });
    await page.goto('/treasure-map');
    await startEditing(page);
    let list = await openList(page, pickerButton(page, 'Scores'));
    await expect(list.getByText(WORDS.loading, { exact: true })).toBeVisible();
    hold.resolve();
    await expect(row(list, 'Bea')).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const failing = await setup(page, { myFail: true });
    await page.goto('/treasure-map');
    await startEditing(page);
    list = await openList(page, pickerButton(page, 'Scores'));
    await expect(list.getByText(WORDS.error, { exact: true })).toBeVisible();
    failing.myFail = false;
    await list.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(row(list, 'Bea')).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { myRows: [] });
    await page.goto('/treasure-map');
    await startEditing(page);
    list = await openList(page, pickerButton(page, 'Scores'));
    await expect(list).toContainText(WORDS.empty);
    await expect(list.getByRole('link', { name: 'My Assistants', exact: true })).toHaveAttribute('href', '/assistants');
    // In the page's status style, as the loading and error lines (ADR 0003 sub-decision 4; Amendment 2).
    await expect(list.locator('.bsd-ma-status')).toContainText(WORDS.empty);
    expect(state.myAsks, 'the first page asked for the Assistants once').toBe(1);
  });

  test('E9: Assign to all — every card pending to Bea, "All duties → Bea"; a card changed after (to Cy); a card’s Undo then also cancels the everything change (book decision 16); the row’s Undo', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, assignAll(page), 'Bea');
    for (const title of ['Scores', 'Lists', 'Concepts']) {
      await expect(editCard(page, title).getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
      await expect(editCard(page, title)).toContainText('Bea');
    }
    await expect(saveNote(page, 'All duties → Bea')).toBeVisible();
    const allRow = section(page).locator('*').filter({ hasText: WORDS.allDutiesLine })
      .filter({ has: page.getByRole('button', { name: 'Assign to all', exact: true }) }).last();
    await expect(allRow).toContainText('Bea');
    // Cy, not Ava: Ava is Scores' current Assistant, and picking the current one removes the card's change (AC-2;
    // story 3 test plan, Amendment 1).
    await pick(page, pickerButton(page, 'Scores'), 'Cy');
    await expect(editCard(page, 'Scores').getByText('Will be assigned to Cy', { exact: true })).toBeVisible();
    await expect(editCard(page, 'Lists').getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
    await expect(saveNote(page, '4 unsaved changes')).toBeVisible();
    await editCard(page, 'Lists').getByRole('button', { name: 'Undo', exact: true }).click();
    // Re-aimed at treasure-map-edit #4's Test Design (book decision 16, ADR 0004): after Assign to all, a card's Undo
    // also cancels the everything change, so the row names no one and has no Undo; Scores (Cy) and Concepts (Bea) stay.
    await expect(saveNote(page, '2 unsaved changes')).toBeVisible();
    await expect(editCard(page, 'Concepts').getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
    await expect(allRow).not.toContainText('Bea');
    await expect(allRow.getByRole('button', { name: 'Undo', exact: true })).toHaveCount(0);
    // The row's Undo after a card was changed following Assign to all (story 4 review, non-blocking 4; added at
    // treasure-map-edit #5's Test Design): every change goes, the changed card's included.
    await pick(page, assignAll(page), 'Bea');
    await pick(page, pickerButton(page, 'Scores'), 'Cy');
    await allRow.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
    await expect(section(page).getByText('Unsaved', { exact: true })).toHaveCount(0);
  });

  test('E10: Current in the All duties list only when all three cards name one Assistant; picking it changes nothing', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    let list = await openList(page, assignAll(page));
    for (const name of ['Zed Local', 'Ava', 'Bea', 'Cy']) await expect(row(list, name).getByText('Current', { exact: true })).toHaveCount(0);
    await assignAll(page).click();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: ALL_AVA });
    await page.goto('/treasure-map');
    await startEditing(page);
    list = await openList(page, assignAll(page));
    await expect(row(list, 'Ava').getByText('Current', { exact: true })).toBeVisible();
    await row(list, 'Ava').click();
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
    await expect(section(page).getByText('Unsaved', { exact: true })).toHaveCount(0);
  });

  test('E11: the edited raw viewer — closed at first, "Unsaved draft", the Map exactly as Save would sign it; the raw viewer unchanged', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(editedButton(page)).toHaveText(/View the raw Treasure Map — edited/);
    await expect(editedButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(editedButton(page)).toContainText('Unsaved draft');
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await editedButton(page).click();
    await expect(editedButton(page)).toHaveText(/Hide the raw Treasure Map — edited/);
    const draft = JSON.parse(await editedPre(page).innerText());
    expect(Object.keys(draft).sort(), 'no id, sig or created_at yet').toEqual(['content', 'kind', 'pubkey', 'tags']);
    expect(draft.kind).toBe(10040);
    expect(draft.pubkey).toBe(VIEWER);
    expect(draft.content).toBe('');
    expect(draft.tags, 'rank and followers move to Bea in place; everything else as it was; 3038x → Bea added').toEqual([
      ['30382:rank', B, ''], ['30382:followers', B, ''], ...MAIN_TAGS.slice(2), ['3038x', B, ''],
    ]);
    await rawButton(page).click();
    const raw = main(page).getByRole('region', { name: 'Raw Treasure Map', exact: true }).first();
    expect(JSON.parse(await raw.innerText()), 'the raw viewer still shows the published Map').toEqual(MAIN);
  });

  test('E12: the Assistant here gets the instance’s relay for the category; any other Assistant ""', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Zed Local');
    await pick(page, pickerButton(page, 'Concepts'), 'Bea');
    await editedButton(page).click();
    const draft = JSON.parse(await editedPre(page).innerText());
    expect(draft.tags).toEqual([
      ['30382:rank', LOCAL, 'wss://ta.example'], ['30382:followers', LOCAL, 'wss://ta.example'], ['30392', LOCAL, R],
      ['39998:dlist-header', B, ''], ['39998:restaurants', C, R], ['*:tag', D, R], ['3038x', LOCAL, 'wss://ta.example'],
    ]);
  });

  test('E13: no Map — the draft holds only the new entry', async ({ page }) => {
    await setup(page, { mapLocal: null });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await editedButton(page).click();
    const draft = JSON.parse(await editedPre(page).innerText());
    expect(draft).toEqual({ kind: 10040, pubkey: VIEWER, content: '', tags: [['3038x', B, '']] });
  });

  test('E14: leaving Edit closes the edited viewer and drops the changes; Edit again starts closed and fresh', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await editedButton(page).click();
    await expect(editedPre(page)).toBeVisible();
    await editButton(page).click();
    await expect(editedButton(page)).toHaveCount(0);
    await startEditing(page);
    await expect(editedButton(page)).toHaveAttribute('aria-expanded', 'false');
    await editedButton(page).click();
    expect(JSON.parse(await editedPre(page).innerText()).tags, 'a fresh draft is the published Map').toEqual(MAIN_TAGS);
  });

  // Re-aimed at treasure-map-edit #5's Test Design: Save changes now exists (story 5). An edit session that never
  // presses it still signs, publishes and opens nothing.
  test('E15: a whole edit session, never pressing Save changes, signs nothing, publishes nothing, and opens no socket', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, assignAll(page), 'Bea');
    await pick(page, pickerButton(page, 'Lists'), 'Cy');
    await editedButton(page).click();
    await expect(editedPre(page)).toBeVisible();
    await editButton(page).click();
    await safe(page, state);
  });

  // At phone widths the All duties row wraps, which once left its list hanging off the left edge: "no sideways scroll"
  // can't see that, so each open list's box is checked against the screen (story 3 test plan, Amendment 2).
  for (const width of [375, 430]) {
    test(`E16: at ${width} px, every open list lies inside the screen, with nothing pending and with a name pending`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page);
      await page.goto('/treasure-map');
      await startEditing(page);
      async function inside(toggle, what) {
        const list = await openList(page, toggle);
        const box = await list.boundingBox();
        expect(box, `${what}: the open list has a box`).toBeTruthy();
        expect(box.x, `${what}: the list's left edge is on screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${what}: the list's right edge is on screen`).toBeLessThanOrEqual(width);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${what}: no sideways scroll`).toBeLessThanOrEqual(0);
        return list;
      }
      async function closeWith(toggle, list) {
        await toggle.click();
        await expect(list).toBeHidden();
      }
      for (const title of ['Scores', 'Lists', 'Concepts']) {
        await closeWith(pickerButton(page, title), await inside(pickerButton(page, title), `${title}, nothing pending`));
      }
      const all = await inside(assignAll(page), 'All duties, nothing pending');
      await row(all, 'Bea').click();
      await expect(all).toBeHidden();
      await expect(allRow(page)).toContainText('Bea');
      await closeWith(assignAll(page), await inside(assignAll(page), 'All duties, Bea pending'));
      for (const title of ['Scores', 'Lists', 'Concepts']) {
        await expect(editCard(page, title).getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
        await closeWith(pickerButton(page, title), await inside(pickerButton(page, title), `${title}, Bea pending`));
      }
    });
  }

  test('E17: after a pick, an Undo or Try again, focus goes back to the list’s button', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(pickerButton(page, 'Scores'), 'after a card’s pick').toBeFocused();
    await editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(pickerButton(page, 'Scores'), 'after a card’s Undo').toBeFocused();
    await pick(page, assignAll(page), 'Cy');
    await expect(assignAll(page), 'after Assign to all').toBeFocused();
    await allRow(page).getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(assignAll(page), 'after the All duties Undo').toBeFocused();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const failing = await setup(page, { myFail: true });
    await page.goto('/treasure-map');
    await startEditing(page);
    const list = await openList(page, pickerButton(page, 'Lists'));
    await expect(list.getByText(WORDS.error, { exact: true })).toBeVisible();
    failing.myFail = false;
    await list.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(row(list, 'Bea')).toBeVisible();
    await expect(pickerButton(page, 'Lists'), 'after Try again, with the list still open').toBeFocused();
  });

  test('E18: an open list closes on Escape, when focus leaves it and on a click outside it; a closed list’s button never names a missing element', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    const scores = pickerButton(page, 'Scores');
    let list = await openList(page, scores);
    await row(list, 'Bea').focus();
    await page.keyboard.press('Escape');
    await expect(list, 'Escape closes the list').toBeHidden();
    await expect(scores).toHaveAttribute('aria-expanded', 'false');
    await expect(scores, 'Escape puts focus back on the list’s button').toBeFocused();

    list = await openList(page, scores);
    await row(list, 'Zed Local').focus();
    await page.keyboard.press('Shift+Tab');
    await expect(scores).toBeFocused();
    await expect(list, 'focus moving from a row to its own button keeps the list open').toBeVisible();
    await row(list, 'Cy').focus();
    await page.keyboard.press('Tab');
    await expect(list, 'tabbing past the last row closes the list').toBeHidden();
    await expect(scores).toHaveAttribute('aria-expanded', 'false');
    await expect(pickerButton(page, 'Lists'), 'focus lands on the next card’s button, no longer covered').toBeFocused();

    list = await openList(page, assignAll(page));
    await page.getByRole('heading', { level: 1 }).click();
    await expect(list, 'a click outside closes the list').toBeHidden();
    await expect(assignAll(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(saveNote(page, 'No changes yet'), 'closing a list picks nothing').toBeVisible();

    for (const toggle of [scores, pickerButton(page, 'Lists'), pickerButton(page, 'Concepts'), assignAll(page)]) {
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      const id = await toggle.getAttribute('aria-controls');
      if (id) await expect(page.locator(`[id="${id}"]`), `a closed list’s aria-controls (${id}) names an element`).toHaveCount(1);
    }
  });

  test('E19: each card’s button and Undo say which card they belong to; the All duties Undo says All duties; the save note is announced', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(pickerButton(page, title)).toHaveAccessibleDescription(title);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(pickerButton(page, 'Scores')).toHaveAccessibleDescription('Scores Will be assigned to Bea');
    await expect(editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true })).toHaveAccessibleDescription('Scores');
    await expect(saveNote(page, '1 unsaved change')).toHaveAttribute('aria-live', 'polite');
    await pick(page, assignAll(page), 'Cy');
    await expect(allRow(page).getByRole('button', { name: 'Undo', exact: true })).toHaveAccessibleDescription('All duties');
    await expect(saveNote(page, 'All duties → Cy')).toHaveAttribute('aria-live', 'polite');
  });
});
