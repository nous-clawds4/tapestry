const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * treasure-map-edit #4 — Edit mode on /treasure-map: the override switches and the backup switch. What a viewer sees
 * and does.
 *
 * Story: engineering-team/stories/treasure-map-edit/4-override-and-backup-switches.md
 * ADR:   engineering-team/decisions/treasure-map-edit/0004-switches-are-part-of-the-one-pending-edit.md
 * Plan:  engineering-team/stories/treasure-map-edit/4-override-and-backup-switches.test-plan.md
 * Node half: test/treasure-map-switches.test.js (the switch rules, the steps, the words, the wiring).
 *
 * Mocks and helpers as story 3's spec (tests/brainstorm/treasure-map-edit.spec.js), copied, plus story 4's Maps.
 *
 *   V1 — a card's override switch: when it shows, its words, off and on, and the preview.          [AC-1, AC-5, AC-6]
 *   V2 — changing the pick keeps it and recounts; Undo and picking the current turn it off.                   [AC-1]
 *   V3 — no switch when nothing is pending, no duties, or duties naming only the pending Assistant.          [AC-1]
 *   V4 — the All duties switch: the sum, turning every card's, and its resets.                               [AC-2]
 *   V5 — after Assign to all, a card's Undo or current Assistant cancels the everything change.              [AC-3]
 *   V6 — the backup switch: its place, words, whole-Map reach, one change; the raw viewer unchanged.  [AC-4, AC-5]
 *   V7 — the backup switch with assignments, overrides, the All duties Undo, and leaving Edit.               [AC-4]
 *   V8 — no backup switch without backups; the singular; hidden and uncounted when none are left.           [AC-4]
 *   V9 — every switch is a switch, turns with Space and Enter, and keeps focus.                              [AC-6]
 *   V10 — focus after a pick or Undo arrives once the button reads its new words.                            [AC-6]
 *   V11 — at 375 and 430 px every switch is inside the screen.                                               [AC-6]
 *   V12 — nothing signs, publishes or opens a socket.                                                        [AC-5]
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
// Story 4's Map. Scores: rank → Ava with Cy as backup; Cy's duty for one Tag; Bea's for another. Lists: yours, and Dee's
// duty for one Tag in one DList. Concepts: yours, and a curator for one list (Cy, then Bea as backup). A `*:…` entry and a
// key this page doesn't read, each with a backup; two `p` tags that aren't Treasure Map entries. Four backups in all.
const SW_TAGS = [
  ['30382:rank', A, R], ['30382:rank', C, R], ['3038x:tag:X1', C, R], ['30382:tag:X2', B, R],
  ['30392', LOCAL, R], ['30396:tag:X1:T1', D, R],
  ['39998:dlist-header', LOCAL, R], ['39998:restaurants', C, R], ['39998:restaurants', B, R],
  ['*:tag', D, R], ['*:tag', A, R], ['31234:foo', A, R], ['31234:foo', C, R], ['p', VIEWER], ['p', VIEWER],
];
const SW_MAP = mapOf(SW_TAGS);
// Scores reads Ava alone (her current Assistant), with one duty of her own that a pick of Bea would count.
const CURRENT_MAP = mapOf([['30382:rank', A, R], ['3038x:tag:X1', A, R]]);
// One backup, on a duty an override removes.
const ONE_BACKUP_MAP = mapOf([['30382:rank', A, R], ['3038x:tag:X1', C, R], ['3038x:tag:X1', A, R]]);
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
  overrideOff: 'Kept as they are; they take priority over this assignment.',
  overrideOn: 'These will be removed from your Treasure Map.',
  backupsOff: 'Kept as they are. Apps use a backup when an entry’s first Assistant can’t be reached.',
  backupsOn: 'Every entry keeps only its first Assistant, including entries not shown on this page.',
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

const cardSwitch = (page, title) => editCard(page, title).getByRole('switch');
const allSwitch = (page) => allRow(page).getByRole('switch');
const backupSwitch = (page) => section(page).getByRole('switch', { name: /^Remove \d+ backup Assistants?$/ });
async function draftTags(page) {
  if ((await editedButton(page).getAttribute('aria-expanded')) !== 'true') await editedButton(page).click();
  return JSON.parse(await editedPre(page).innerText()).tags;
}
async function publishedTags(page) {
  if ((await rawButton(page).getAttribute('aria-expanded')) !== 'true') await rawButton(page).click();
  return JSON.parse(await main(page).getByRole('region', { name: 'Raw Treasure Map', exact: true }).first().innerText()).tags;
}

test.describe('/treasure-map — Edit mode: the override switches and the backup switch', () => {
  test('V1: a card’s override switch — shown with a pending Assistant and duties naming others; off keeps them, on removes them, and the preview follows', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(cardSwitch(page, 'Scores'), 'no switch before an Assistant is picked').toHaveCount(0);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const sw = cardSwitch(page, 'Scores');
    // 3038x:tag:X1 names Cy: counted. 30382:tag:X2 names only Bea: not counted.
    await expect(sw).toHaveAccessibleName('Override 1 individually assigned duty');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    // Re-aimed at treasure-map-edit #5's Test Design (book decision 18): a card's switch is described by its card's
    // title, then its note.
    await expect(sw).toHaveAccessibleDescription(`Scores ${WORDS.overrideOff}`);
    await expect(editCard(page, 'Scores'), 'off: Cy’s duty stays, so the card reads Mixed').toContainText('Mixed');
    expect((await draftTags(page)).some((t) => t[0] === '3038x:tag:X1')).toBe(true);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(sw).toHaveAccessibleDescription(`Scores ${WORDS.overrideOn}`);
    await expect(editCard(page, 'Scores'), 'on: only Bea is left').not.toContainText('Mixed');
    await expect(editCard(page, 'Scores')).toContainText('Bea');
    const tags = await draftTags(page);
    expect(tags.some((t) => t[0] === '3038x:tag:X1'), 'the overridden duty leaves the edited Map').toBe(false);
    expect(tags.filter((t) => t[0] === '30382:tag:X2'), 'the duty naming only Bea stays').toEqual([['30382:tag:X2', B, R]]);
    await expect(saveNote(page, '1 unsaved change'), 'the switch is part of the card’s change').toBeVisible();
    expect((await publishedTags(page)).some((t) => t[0] === '3038x:tag:X1'), 'the raw viewer still shows the published Map').toBe(true);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(editCard(page, 'Scores')).toContainText('Mixed');
  });

  test('V2: changing the pick keeps the switch and recounts; Undo and picking the current Assistant turn it off', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await cardSwitch(page, 'Scores').click();
    await pick(page, pickerButton(page, 'Scores'), 'Cy');
    // Against Cy: 30382:tag:X2 (Bea) is counted; 3038x:tag:X1 (Cy) isn't.
    await expect(cardSwitch(page, 'Scores')).toHaveAttribute('aria-checked', 'true');
    await expect(cardSwitch(page, 'Scores')).toHaveAccessibleName('Override 1 individually assigned duty');
    let tags = await draftTags(page);
    expect(tags.some((t) => t[0] === '30382:tag:X2'), 'Bea’s duty goes').toBe(false);
    expect(tags.filter((t) => t[0] === '3038x:tag:X1'), 'Cy’s own duty stays').toEqual([['3038x:tag:X1', C, R]]);
    await editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(cardSwitch(page, 'Scores')).toHaveCount(0);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(cardSwitch(page, 'Scores'), 'Undo turned it off').toHaveAttribute('aria-checked', 'false');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: CURRENT_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await cardSwitch(page, 'Scores').click();
    await expect(cardSwitch(page, 'Scores')).toHaveAttribute('aria-checked', 'true');
    await pick(page, pickerButton(page, 'Scores'), 'Ava');
    await expect(cardSwitch(page, 'Scores'), 'picking the current Assistant removes the change, switch included').toHaveCount(0);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(cardSwitch(page, 'Scores')).toHaveAttribute('aria-checked', 'false');
    tags = await draftTags(page);
    expect(tags.some((t) => t[0] === '3038x:tag:X1'), 'off again: the duty stays').toBe(true);
  });

  test('V3: no switch when nothing is pending, when the category has no duties, or when its duties name only the pending Assistant', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(section(page).getByRole('switch'), 'the story-3 Map has no backups and nothing pending').toHaveCount(0);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(section(page).getByRole('switch'), 'Scores has no individually assigned duties').toHaveCount(0);
    await pick(page, pickerButton(page, 'Concepts'), 'Cy');
    await expect(section(page).getByRole('switch'), '39998:restaurants names only Cy').toHaveCount(0);
    await pick(page, pickerButton(page, 'Concepts'), 'Bea');
    await expect(cardSwitch(page, 'Concepts')).toHaveAccessibleName('Override 1 individually assigned duty');
    await expect(section(page).getByRole('switch')).toHaveCount(1);
  });

  test('V4: the All duties switch — the sum across categories; it turns every card’s switch; Assign to all and its Undo turn them off', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(allSwitch(page)).toHaveCount(0);
    await pick(page, assignAll(page), 'Bea');
    // Against Bea: Scores 3038x:tag:X1 (Cy), Lists 30396:tag:X1:T1 (Dee), Concepts 39998:restaurants (Cy, then Bea).
    await expect(allSwitch(page)).toHaveAccessibleName('Override 3 individually assigned duties across all categories');
    await expect(allSwitch(page)).toHaveAttribute('aria-checked', 'false');
    await expect(allSwitch(page)).toHaveAccessibleDescription(WORDS.overrideOff);
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(cardSwitch(page, title)).toHaveAttribute('aria-checked', 'false');
    await allSwitch(page).click();
    await expect(allSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await expect(allSwitch(page)).toHaveAccessibleDescription(WORDS.overrideOn);
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(cardSwitch(page, title)).toHaveAttribute('aria-checked', 'true');
    const keys = (await draftTags(page)).map((t) => t[0]);
    for (const gone of ['3038x:tag:X1', '30396:tag:X1:T1', '39998:restaurants']) expect(keys, `${gone} is removed`).not.toContain(gone);
    expect(keys, 'the duty naming only Bea stays').toContain('30382:tag:X2');
    await cardSwitch(page, 'Lists').click();
    await expect(cardSwitch(page, 'Lists')).toHaveAttribute('aria-checked', 'false');
    await expect(allSwitch(page), 'not every category with duties is on').toHaveAttribute('aria-checked', 'false');
    await allSwitch(page).click();
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(cardSwitch(page, title)).toHaveAttribute('aria-checked', 'true');
    await pick(page, assignAll(page), 'Cy');
    await expect(allSwitch(page), 'a new Assign to all turns every override off').toHaveAttribute('aria-checked', 'false');
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(cardSwitch(page, title)).toHaveAttribute('aria-checked', 'false');
    await allSwitch(page).click();
    await allRow(page).getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(allSwitch(page)).toHaveCount(0);
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(cardSwitch(page, title)).toHaveCount(0);
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
  });

  test('V5: after Assign to all, a card’s Undo — or its current Assistant — also cancels the everything change (book decision 16)', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    for (const how of ['Undo', 'current']) {
      await pick(page, assignAll(page), 'Bea');
      await expect(allRow(page)).toContainText('Bea');
      if (how === 'Undo') await editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true }).click();
      else await pick(page, pickerButton(page, 'Scores'), 'Ava');
      await expect(allRow(page), `${how}: the All duties row names no one`).not.toContainText('Bea');
      await expect(allRow(page).getByRole('button', { name: 'Undo', exact: true }), `${how}: and has no Undo`).toHaveCount(0);
      const scores = editCard(page, 'Scores');
      await expect(scores.getByText('Unsaved', { exact: true })).toHaveCount(0);
      await expect(scores, `${how}: Scores reads as before Edit, never Mixed`).not.toContainText('Mixed');
      await expect(scores).toContainText('Ava');
      for (const title of ['Lists', 'Concepts']) await expect(editCard(page, title).getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
      await expect(saveNote(page, '2 unsaved changes')).toBeVisible();
      expect((await draftTags(page)).some((t) => t[0] === '*'), `${how}: no everything entry is added`).toBe(false);
      await editButton(page).click();
      await startEditing(page);
    }
  });

  test('V6: the backup switch — below the cards; "Remove 4 backup Assistants"; on, every key keeps its first entry across the whole Map, and it is one change', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    const sw = backupSwitch(page);
    await expect(sw).toHaveAccessibleName('Remove 4 backup Assistants');
    await expect(sw).toHaveAttribute('aria-checked', 'false');
    await expect(sw).toHaveAccessibleDescription(WORDS.backupsOff);
    const swBox = await sw.boundingBox();
    const lastCard = await editCard(page, 'Concepts').boundingBox();
    const note = await saveNote(page, 'No changes yet').boundingBox();
    expect(swBox.y, 'below the cards').toBeGreaterThanOrEqual(lastCard.y + lastCard.height - 1);
    expect(swBox.y + swBox.height, 'above the save note').toBeLessThanOrEqual(note.y + 1);
    await sw.click();
    await expect(sw).toHaveAttribute('aria-checked', 'true');
    await expect(sw).toHaveAccessibleDescription(WORDS.backupsOn);
    await expect(saveNote(page, '1 unsaved change')).toBeVisible();
    expect(await draftTags(page), 'only the first entry of each key; the p tags untouched').toEqual([
      ['30382:rank', A, R], ['3038x:tag:X1', C, R], ['30382:tag:X2', B, R], ['30392', LOCAL, R], ['30396:tag:X1:T1', D, R],
      ['39998:dlist-header', LOCAL, R], ['39998:restaurants', C, R], ['*:tag', D, R], ['31234:foo', A, R], ['p', VIEWER], ['p', VIEWER],
    ]);
    expect(await publishedTags(page), 'the raw viewer still shows the published Map').toEqual(SW_TAGS);
    await sw.click();
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
  });

  test('V7: the backup switch with assignments — the note counts; an override can lower N; the All duties Undo leaves it; leaving Edit resets it', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await backupSwitch(page).click();
    await pick(page, assignAll(page), 'Bea');
    await expect(saveNote(page, '5 unsaved changes'), 'counted, not "All duties → Bea"').toBeVisible();
    await expect(backupSwitch(page), 'the moved 30382:rank keeps its backup').toHaveAccessibleName('Remove 4 backup Assistants');
    await allSwitch(page).click();
    await expect(backupSwitch(page), '39998:restaurants goes whole, its backup with it').toHaveAccessibleName('Remove 3 backup Assistants');
    await expect(backupSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await allRow(page).getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(backupSwitch(page), 'the All duties Undo leaves the backup switch').toHaveAttribute('aria-checked', 'true');
    await expect(saveNote(page, '1 unsaved change')).toBeVisible();
    await editButton(page).click();
    await startEditing(page);
    await expect(backupSwitch(page), 'off each time Edit turns on').toHaveAttribute('aria-checked', 'false');
    await expect(saveNote(page, 'No changes yet')).toBeVisible();
  });

  test('V8: no backup switch without backups; "Remove 1 backup Assistant"; it goes, and stops counting, when an override removes the last backup', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(backupSwitch(page), 'the story-3 Map has no backups').toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: ONE_BACKUP_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(backupSwitch(page)).toHaveAccessibleName('Remove 1 backup Assistant');
    await backupSwitch(page).click();
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(saveNote(page, '2 unsaved changes')).toBeVisible();
    await cardSwitch(page, 'Scores').click();
    await expect(backupSwitch(page), 'no backup is left to remove').toHaveCount(0);
    await expect(saveNote(page, '1 unsaved change'), 'a backup switch with nothing to remove isn’t a change').toBeVisible();
    expect(await draftTags(page)).toEqual([['30382:rank', B, ''], ['3038x', B, '']]);
  });

  test('V9: each switch is a switch to a screen reader and turns with Space and Enter, keeping focus', async ({ page }) => {
    await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    for (const sw of [cardSwitch(page, 'Scores'), backupSwitch(page)]) {
      await expect(sw).toHaveAttribute('role', 'switch');
      await sw.focus();
      await page.keyboard.press('Space');
      await expect(sw).toHaveAttribute('aria-checked', 'true');
      await expect(sw, 'focus stays on the switch').toBeFocused();
      await page.keyboard.press('Enter');
      await expect(sw).toHaveAttribute('aria-checked', 'false');
      await expect(sw).toBeFocused();
    }
  });

  // Title narrowed at treasure-map-edit #5's Test Design (story 4 review, non-blocking 4): Try again's focus is story 3's E17.
  test('V10: after a pick or an Undo, focus arrives once the button already reads its new words (story 3 review round 2)', async ({ page }) => {
    await page.addInitScript(() => {
      window.__focusLog = [];
      document.addEventListener('focusin', (e) => {
        const el = e.target;
        const ids = (el.getAttribute && el.getAttribute('aria-describedby')) || '';
        window.__focusLog.push({
          text: (el.textContent || '').trim(),
          desc: ids.split(' ').filter(Boolean).map((id) => (document.getElementById(id) || {}).textContent || '').join(' ').trim(),
        });
      }, true);
    });
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    const last = () => page.evaluate(() => window.__focusLog[window.__focusLog.length - 1]);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(pickerButton(page, 'Scores')).toBeFocused();
    expect(await last(), 'the first pick: the button already reads Change').toEqual({ text: 'Change', desc: 'Scores Will be assigned to Bea' });
    await pick(page, pickerButton(page, 'Scores'), 'Cy');
    await expect(pickerButton(page, 'Scores')).toBeFocused();
    expect(await last(), 'moving the card to Cy is heard').toEqual({ text: 'Change', desc: 'Scores Will be assigned to Cy' });
    await editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(pickerButton(page, 'Scores')).toBeFocused();
    expect(await last(), 'after Undo').toEqual({ text: 'Choose an Assistant', desc: 'Scores' });
  });

  for (const width of [375, 430]) {
    test(`V11: at ${width} px, every switch lies inside the screen and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page, { mapLocal: SW_MAP });
      await page.goto('/treasure-map');
      await startEditing(page);
      await pick(page, assignAll(page), 'Bea');
      const switches = section(page).getByRole('switch');
      await expect(switches, 'All duties, three cards, and the backup switch').toHaveCount(5);
      for (let i = 0; i < 5; i++) {
        const sw = switches.nth(i);
        await sw.scrollIntoViewIfNeeded();
        const box = await sw.boundingBox();
        const what = `switch ${i + 1} (${await sw.getAttribute('aria-checked')})`;
        expect(box.x, `${what}: left edge on screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${what}: right edge on screen`).toBeLessThanOrEqual(width);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
    });
  }

  // Re-aimed at treasure-map-edit #5's Test Design: Save changes now exists (story 5). An edit session that never
  // presses it still signs, publishes and opens nothing.
  test('V12: a session with every switch, never pressing Save changes, signs nothing, publishes nothing, and opens no socket', async ({ page }) => {
    const state = await setup(page, { mapLocal: SW_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, assignAll(page), 'Bea');
    await allSwitch(page).click();
    await backupSwitch(page).click();
    await draftTags(page);
    await editButton(page).click();
    await safe(page, state);
  });
});
