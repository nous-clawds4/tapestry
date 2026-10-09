const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * treasure-map-edit #5 — Edit mode on /treasure-map: Save signs and publishes the edited Map. What a viewer sees and
 * does.
 *
 * Story: engineering-team/stories/done/treasure-map-edit/5-save-the-edited-map.md
 * ADR:   engineering-team/decisions/done/treasure-map-edit/0005-save-is-one-pure-sequence-with-injected-effects.md
 * Plan:  engineering-team/stories/done/treasure-map-edit/5-save-the-edited-map.test-plan.md
 * Node half: test/treasure-map-save.test.js (the save sequence, every refusal and outcome, the words, the wiring).
 *
 * Mocks and helpers as story 4's spec (tests/brainstorm/treasure-map-switches.spec.js), copied, plus:
 * - a signer stub (`window.nostr`) that records what it signs and can be missing, on another account, or decline;
 * - POST /api/strfry/publish (this instance's relay) answering ok, failing, or held;
 * - a mock relay on every WebSocket answering OK true or false per relay (the precedent of
 *   tests/brainstorm/list-headers-my-assistant-disposition.spec.js);
 * - /api/publish-policy external or local-only;
 * - a newer Map staged for the next /api/strfry/scan.
 *
 *   SV1 — Save changes beside the note; off with nothing to save or an unchanged Map; on for a change.        [AC-1]
 *   SV2 — accepted everywhere: what is signed and sent; Edit ends; "Treasure Map updated"; the page shows
 *         the signed Map; focus on Edit.                                                  [AC-2, AC-3, AC-6, AC-10]
 *   SV3 — while saving: "Saving…" and every Edit control off.                                                 [AC-4]
 *   SV4 — a newer Map: nothing signed; the words; Edit stays; focus on Save.                         [AC-5, AC-10]
 *   SV5 — kept local by the publish policy: Edit ends; the report until Edit turns on again.                  [AC-6]
 *   SV6 — one relay refuses: the report counts and lists the relays.                                          [AC-6]
 *   SV7 — accepted nowhere: Edit stays; the report as an alert; Save works again.                     [AC-6, AC-10]
 *   SV8 — no signer, another account, declined: nothing published; the reason.                                [AC-7]
 *   SV9 — no Map: a new Map with only the edit's entries; the warning goes.                                   [AC-8]
 *   SV10 — book decision 18: a card switch described by its card; All turns on only cards with duties.         [AC-9]
 *   SV11 — at 375 and 430 px, Save changes, the alert and the confirmation fit.                              [AC-10]
 *
 * Amendment 1 (review round 1; book decision 19; ADR 0005 Amendment 1): SV4 re-aimed, and
 *   SV12 — an outside relay holds a newer Map than this instance's: the newer Map is shown, the changes kept on top,
 *          and the next Save goes through.                                                               [AC-5]
 *   SV13 — a save only the outside relays took, then a reload: no dead end.                                  [AC-5]
 *   SV14 — signing out while the signer prompt is open: nothing signed or published.                        [AC-2]
 *   SV15 — "Saving…" is in a live region while saving.                                                      [AC-10]
 *   SV16 — two clicks in one go sign once.                                                                  [AC-4]
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
// Scores has Cy's duty; Concepts' only duty names Bea (story 5, book decision 18).
const DUTIES_MAP = mapOf([['30382:rank', A, R], ['3038x:tag:X1', C, R], ['39998:dlist-header', LOCAL, R], ['39998:d1', B, R]]);
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
  changedSince: 'Your Treasure Map changed since this page read it. The page now shows the new one, with your changes on top; check them and save again.',
  noSigner: 'Couldn’t save: no Nostr signer was found in this browser.',
  declined: 'Couldn’t save: the signature was declined.',
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
  // Story 5: the signer ('viewer' | 'none' | 'other' | 'decline' | 'hold'), this instance's relay ('ok' | 'fail' |
  // 'hold'), the outside relays ('accept' | 'refuse' | 'drop' | { url: mode }), and the publish policy ('external' |
  // 'local-only'). Amendment 1: `relayHolds` is a Map the general-purpose relays answer with; `relayHoldsSent` makes
  // them answer with the newest event the outside relays accepted.
  signer = 'viewer', local = 'ok', relay = 'drop', policy = 'local-only', relayHolds = null, relayHoldsSent = false,
} = {}) {
  let releaseLocal;
  const localHeld = new Promise((r) => { releaseLocal = r; });
  const state = {
    ws: 0, writes: [], session: signedIn, myAsks: 0, myRows, myHold, myFail,
    local, relay, newer: null, published: [], relayEvents: [], releaseLocal, relayHolds, relayHoldsSent,
  };
  const modeFor = (url) => (typeof state.relay === 'object' ? (state.relay[url.replace(/\/$/, '')] || 'accept') : state.relay);
  await page.routeWebSocket(/.*/, (ws) => {
    state.ws++;
    if (modeFor(ws.url()) === 'drop') { ws.close(); return; }
    ws.onMessage((raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m[0] !== 'EVENT') return;
      state.relayEvents.push({ url: ws.url(), event: m[1] });
      const ok = modeFor(ws.url()) === 'accept';
      ws.send(JSON.stringify(['OK', m[1].id, ok, ok ? '' : 'blocked: test relay']));
    });
  });
  await page.addInitScript(({ viewer, other, signer }) => {
    window.__signCalls = 0;
    window.__signed = [];
    window.__decline = signer === 'decline';
    if (signer === 'none') return;
    const who = signer === 'other' ? other : viewer;
    window.__keyHeld = signer === 'hold' ? new Promise((resolve) => { window.__releaseKey = resolve; }) : null;
    window.nostr = {
      getPublicKey: async () => { if (window.__keyHeld) await window.__keyHeld; return who; },
      signEvent: async (u) => {
        window.__signCalls++;
        if (window.__decline) throw new Error('User rejected the request');
        window.__signed.push(JSON.parse(JSON.stringify(u)));
        return { ...u, pubkey: who, id: window.__signed.length.toString(16).padStart(64, '7'), sig: 'f'.repeat(128) };
      },
    };
  }, { viewer: VIEWER, other: 'e1'.repeat(32), signer });
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
      if (state.newer) return json(r, { success: true, events: [state.newer] });
      const saved = state.published[state.published.length - 1];
      return json(r, { success: true, events: saved ? [saved] : mapLocal ? [mapLocal] : [] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: relayList.map((url, i) => ({ name: `relay ${i}`, json: JSON.stringify({ nostrRelay: { websocketUrl: url } }) })) }));
  let relayAsks = 0;
  await page.route('**/api/relay/external**', (r) => {
    const accepted = state.relayEvents.filter((e) => modeFor(e.url) === 'accept').map((e) => e.event);
    if (state.relayHoldsSent && accepted.length > 0) return json(r, { success: true, events: [accepted[accepted.length - 1]] });
    if (state.relayHolds) return json(r, { success: true, events: [state.relayHolds] });
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
  await page.route('**/api/auth/logout', (r) => { state.session = false; return json(r, { success: true }); });
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: policy === 'external' }));
  await page.route('**/api/strfry/publish', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    if (state.local === 'hold') await localHeld;
    if (state.local === 'fail') return json(r, { success: false, error: 'disk full' }, 500);
    state.published.push(body.event);
    return json(r, { success: true });
  });
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

const saveButton = (page) => section(page).getByRole('button', { name: /^(Save changes|Saving…)$/ });
const toast = (page) => page.getByRole('status').filter({ hasText: /^Treasure Map updated$/ });
const report = (page) => section(page).getByRole('status').filter({ hasText: /^Your Treasure Map/ });
const alertLine = (page) => section(page).getByRole('alert');
const signed = (page) => page.evaluate(() => window.__signed);
const PUBLISH_RELAYS = ['wss://purplepag.es', 'wss://wot.grapevine.network', 'wss://relay.primal.net', 'wss://nos.lol', 'wss://relay.damus.io'];

test.describe('/treasure-map — Edit mode: Save', () => {
  test('SV1: Save changes beside the note — off with nothing to save, and for a pick that leaves the Map unchanged; on for a real change', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(saveButton(page)).toHaveText('Save changes');
    await expect(saveButton(page)).toBeDisabled();
    // Concepts reads Mixed (Zed Local, Cy); its own entry already names Zed Local and 39998 is there: nothing changes.
    await pick(page, pickerButton(page, 'Concepts'), 'Zed Local');
    await expect(saveNote(page, 'No changes yet'), 'a pick that changes nothing (story 3 review, non-blocking 4)').toBeVisible();
    await expect(saveButton(page)).toBeDisabled();
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    // The Concepts pick still counts once the Map really changes (the note counts the pending changes, ADR 0005).
    await expect(saveNote(page, '2 unsaved changes')).toBeVisible();
    await expect(saveButton(page)).toBeEnabled();
    const noteBox = await saveNote(page, '2 unsaved changes').boundingBox();
    const btnBox = await saveButton(page).boundingBox();
    expect(Math.abs((noteBox.y + noteBox.height / 2) - (btnBox.y + btnBox.height / 2)), 'Save changes sits beside the note').toBeLessThan(40);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: null });
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(saveButton(page), 'no Map, nothing yet').toBeDisabled();
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await expect(saveButton(page), 'no Map, one change: a new Map').toBeEnabled();
  });

  test('SV2: accepted everywhere — signs exactly the edited Map, newer than the published one; publishes it; Edit ends; "Treasure Map updated"; the page shows the signed Map; focus on Edit', async ({ page }) => {
    const state = await setup(page, { policy: 'external', relay: 'accept' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const edited = await draftTags(page);
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    const s = await signed(page);
    expect(s.length, 'signed once').toBe(1);
    expect(s[0].kind).toBe(10040);
    expect(s[0].pubkey).toBe(VIEWER);
    expect(s[0].content).toBe(MAIN.content);
    expect(s[0].tags, 'exactly the edited raw viewer\'s tags').toEqual(edited);
    expect(s[0].created_at, 'newer than the published Map').toBeGreaterThan(MAIN.created_at);
    expect(state.published.length, 'written once to this instance\'s relay').toBe(1);
    expect(state.published[0].tags).toEqual(edited);
    expect([...new Set(state.relayEvents.map((e) => e.url.replace(/\/$/, '')))].sort(), 'sent to every outside relay').toEqual([...PUBLISH_RELAYS].sort());
    await expect(editButton(page)).toHaveText(/^Edit$/);
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(editButton(page), 'focus goes to Edit once Edit mode ends').toBeFocused();
    await expect(section(page).getByRole('button', { name: PICKER })).toHaveCount(0);
    await expect(section(page).locator('li').filter({ hasText: WORDS.descriptions.Scores })).toContainText('Bea');
    expect((await publishedTags(page)), 'the raw Treasure Map is the signed Map').toEqual(edited);
    expect(await report(page).count(), 'no report on a clean save').toBe(0);
  });

  test('SV3: while saving — "Saving…", and every Edit control off until it ends', async ({ page }) => {
    const state = await setup(page, { local: 'hold', policy: 'local-only' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saving…');
    await expect(saveButton(page)).toBeDisabled();
    await expect(editButton(page)).toBeDisabled();
    for (const title of ['Scores', 'Lists', 'Concepts']) await expect(pickerButton(page, title)).toBeDisabled();
    await expect(assignAll(page)).toBeDisabled();
    await expect(editCard(page, 'Scores').getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
    state.releaseLocal();
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
  });

  // Re-aimed at Amendment 1 (book decision 19): a newer Map is shown with the changes on top, and the next Save goes
  // through; it used to stop with a reload message.
  test('SV4: a newer Map since the page read it — nothing signed yet; the newer Map shown with the changes on top; the words; the next Save saves on top of it', async ({ page }) => {
    const state = await setup(page, { policy: 'external', relay: 'accept' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const NEWER = { ...MAIN, id: '8'.repeat(64), created_at: MAIN.created_at + 60, tags: [...MAIN_TAGS, ['31234:new', C, R]] };
    state.newer = NEWER;
    await saveButton(page).click();
    await expect(alertLine(page)).toContainText(WORDS.changedSince);
    await expect(saveButton(page), 'focus stays on Save changes (checked before the viewers are opened)').toBeFocused();
    expect(await signed(page), 'nothing signed').toEqual([]);
    expect(state.published, 'nothing published').toEqual([]);
    expect(state.relayEvents, 'nothing sent').toEqual([]);
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(editCard(page, 'Scores').getByText('Will be assigned to Bea', { exact: true }), 'the change is kept').toBeVisible();
    expect(await publishedTags(page), 'the raw viewer shows the newer Map').toEqual(NEWER.tags);
    expect((await draftTags(page)).filter((t) => t[0] === '31234:new'), 'the edited Map is built on the newer one').toEqual([['31234:new', C, R]]);
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    const s = await signed(page);
    expect(s.length, 'signed once, on the second press').toBe(1);
    expect(s[0].created_at, 'newer than the newer Map').toBeGreaterThan(NEWER.created_at);
    expect(s[0].tags.filter((t) => t[0] === '31234:new' || t[0] === '30382:rank'), 'Scores → Bea, and the newer Map\'s own entry kept').toEqual([['30382:rank', B, ''], ['31234:new', C, R]]);
  });

  test('SV5: kept on this instance\'s relay by the publish policy — Edit ends, no "Treasure Map updated", the report says where it went until Edit turns on again', async ({ page }) => {
    await setup(page, { policy: 'local-only' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(report(page)).toContainText('Your Treasure Map was saved on this instance');
    await expect(report(page)).toContainText('local-only publish mode');
    await expect(toast(page)).toHaveCount(0);
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(editButton(page)).toBeFocused();
    await expect(section(page).locator('li').filter({ hasText: WORDS.descriptions.Scores })).toContainText('Bea');
    await startEditing(page);
    await expect(report(page), 'the report goes when Edit turns on again').toHaveCount(0);
  });

  test('SV6: one outside relay refuses — partial: Edit ends, the report counts 4 of 5 and lists each relay', async ({ page }) => {
    await setup(page, { policy: 'external', relay: { 'wss://nos.lol': 'refuse' } });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(report(page)).toContainText('accepted by 4 of 5 relays');
    for (const relay of PUBLISH_RELAYS) await expect(report(page)).toContainText(relay);
    await expect(report(page)).toContainText('rejected');
    await expect(toast(page)).toHaveCount(0);
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('SV7: accepted nowhere — Edit and the changes stay, the report says so as an alert, focus stays on Save, and Save works again', async ({ page }) => {
    const state = await setup(page, { policy: 'external', relay: 'refuse', local: 'fail' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(alertLine(page)).toContainText('Your Treasure Map could not be saved on this instance');
    await expect(alertLine(page)).toContainText('none of the 5 relays accepted it');
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(editCard(page, 'Scores').getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
    await expect(saveButton(page)).toBeEnabled();
    await expect(saveButton(page)).toBeFocused();
    state.local = 'ok';
    state.relay = 'accept';
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    expect((await signed(page)).length, 'signed again on the second press').toBe(2);
  });

  for (const [signer, words, label] of [
    ['none', 'noSigner', 'no signer extension'],
    ['other', null, 'the signer on another account'],
    ['decline', 'declined', 'the person declines to sign'],
  ]) {
    test(`SV8 (${label}): nothing published; the reason by Save changes; Edit and the changes stay`, async ({ page }) => {
      const state = await setup(page, { signer, policy: 'external', relay: 'accept' });
      await page.goto('/treasure-map');
      await startEditing(page);
      await pick(page, pickerButton(page, 'Scores'), 'Bea');
      await saveButton(page).click();
      if (words) await expect(alertLine(page)).toContainText(WORDS[words]);
      else await expect(alertLine(page)).toContainText('Your signer is on a different account');
      expect(state.published, 'nothing published').toEqual([]);
      expect(state.relayEvents, 'nothing sent').toEqual([]);
      if (signer !== 'decline') expect(await page.evaluate(() => (window.__signed || []).length), 'nothing signed').toBe(0);
      await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
      await expect(editCard(page, 'Scores').getByText('Will be assigned to Bea', { exact: true })).toBeVisible();
    });
  }

  test('SV9: no Map found — Save publishes a new Map with only the edit\'s entries; the warning goes; the page shows it', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, policy: 'external', relay: 'accept' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await expect(section(page).getByText(WORDS.noMap, { exact: true })).toBeVisible();
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    const s = await signed(page);
    expect(s[0].tags).toEqual([['3038x', B, '']]);
    expect(s[0].content).toBe('');
    expect(state.published.length).toBe(1);
    await expect(section(page).locator('li').filter({ hasText: WORDS.descriptions.Scores })).toContainText('Bea');
    await startEditing(page);
    await expect(section(page).getByText(WORDS.noMap, { exact: true }), 'a Map now exists: no warning in Edit mode').toHaveCount(0);
  });

  test('SV10: book decision 18 — a card switch is described by its card; the All duties switch turns on only the cards with duties', async ({ page }) => {
    await setup(page, { mapLocal: DUTIES_MAP });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, assignAll(page), 'Bea');
    // Against Bea: Scores has Cy's duty; Concepts' only duty names Bea, so it has none.
    await expect(cardSwitch(page, 'Scores')).toHaveAccessibleDescription(`Scores ${WORDS.overrideOff}`);
    await expect(allSwitch(page)).toHaveAccessibleName('Override 1 individually assigned duty across all categories');
    await allSwitch(page).click();
    await expect(allSwitch(page)).toHaveAttribute('aria-checked', 'true');
    await pick(page, pickerButton(page, 'Concepts'), 'Cy');
    // Against Cy, Concepts' duty (Bea's) now counts: its switch shows, and it was never turned on.
    await expect(cardSwitch(page, 'Concepts')).toHaveAccessibleName('Override 1 individually assigned duty');
    await expect(cardSwitch(page, 'Concepts'), 'the All switch didn\'t turn on a card that had no duties').toHaveAttribute('aria-checked', 'false');
    expect((await draftTags(page)).some((t) => t[0] === '39998:d1'), 'Concepts\' duty stays').toBe(true);
  });

  for (const width of [375, 430]) {
    test(`SV11: at ${width} px, Save changes, the alert and "Treasure Map updated" lie inside the screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const state = await setup(page, { policy: 'external', relay: 'accept', signer: 'decline' });
      await page.goto('/treasure-map');
      await startEditing(page);
      await pick(page, pickerButton(page, 'Scores'), 'Bea');
      const inside = async (loc, what) => {
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        expect(box, `${what} has a box`).toBeTruthy();
        expect(box.x, `${what}: left edge on screen`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${what}: right edge on screen`).toBeLessThanOrEqual(width);
      };
      await inside(saveButton(page), 'Save changes');
      await saveButton(page).click();
      await inside(alertLine(page), 'the alert');
      await page.evaluate(() => { window.__decline = false; });
      await saveButton(page).click();
      await inside(toast(page), '"Treasure Map updated"');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no sideways scroll').toBeLessThanOrEqual(0);
      expect(state.published.length).toBe(1);
    });
  }

  test('SV12: an outside relay holds a newer Map than this instance\'s relay — it is shown with the changes on top, and the next Save goes through (review H3)', async ({ page }) => {
    const NEWER = { ...MAIN, id: '8'.repeat(64), created_at: MAIN.created_at + 60, tags: [...MAIN_TAGS, ['30385:new', C, R]] };
    const state = await setup(page, { policy: 'external', relay: 'accept', relayHolds: NEWER });
    await page.goto('/treasure-map');
    await startEditing(page);
    expect(await publishedTags(page), 'the page reads this instance\'s relay first').toEqual(MAIN_TAGS);
    await pick(page, pickerButton(page, 'Lists'), 'Cy');
    await saveButton(page).click();
    await expect(alertLine(page)).toContainText(WORDS.changedSince);
    expect(await publishedTags(page), 'the newer Map is shown').toEqual(NEWER.tags);
    await expect(editCard(page, 'Lists').getByText('Will be assigned to Cy', { exact: true })).toBeVisible();
    await saveButton(page).click();
    await expect(toast(page), 'no dead end: the second Save goes through').toBeVisible();
    expect(state.published.length).toBe(1);
    expect(state.published[0].tags.some((t) => t[0] === '30385:new'), 'saved on top of the newer Map').toBe(true);
  });

  test('SV13: a save only the outside relays took, then a reload and another edit — the newer Map is shown once, then the save goes through (review H4)', async ({ page }) => {
    const state = await setup(page, { policy: 'external', relay: 'accept', local: 'fail', relayHoldsSent: true });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(report(page)).toContainText('could not be saved on this instance');
    state.local = 'ok';
    await page.reload();
    await startEditing(page);
    expect(await publishedTags(page), 'after the reload, this instance\'s relay still has the old Map').toEqual(MAIN_TAGS);
    await pick(page, pickerButton(page, 'Lists'), 'Cy');
    await saveButton(page).click();
    await expect(alertLine(page)).toContainText(WORDS.changedSince);
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    const tags = state.published[state.published.length - 1].tags;
    expect(tags.find((t) => t[0] === '30382:rank'), 'the earlier save\'s Scores → Bea is kept').toEqual(['30382:rank', B, '']);
    expect(tags.some((t) => t[0] === '3039x' && t[1] === C), 'and Lists → Cy is added on top').toBe(true);
  });

  test('SV14: signing out while the signer prompt is open — nothing is signed or published when it answers (review H5)', async ({ page }) => {
    const state = await setup(page, { signer: 'hold', policy: 'external', relay: 'accept' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).click();
    await expect(saveButton(page)).toHaveText('Saving…');
    await page.locator('.bs-usermenu-avatar-btn').click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(main(page).getByText(/sign in/i).first()).toBeVisible();
    await page.evaluate(() => window.__releaseKey());
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__signCalls), 'nothing signed').toBe(0);
    expect(state.published, 'nothing published').toEqual([]);
    expect(state.relayEvents, 'nothing sent').toEqual([]);
  });

  test('SV15: "Saving…" is announced — a live region that is there before the save says it while saving', async ({ page }) => {
    const state = await setup(page, { local: 'hold', policy: 'local-only' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const region = section(page).locator('[aria-live="polite"]').filter({ hasText: /^Saving…$/ });
    await expect(region, 'not saying it before the save').toHaveCount(0);
    await saveButton(page).click();
    await expect(region).toHaveCount(1);
    state.releaseLocal();
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
  });

  test('SV16: two clicks in one go sign and publish once (review H1)', async ({ page }) => {
    const state = await setup(page, { policy: 'external', relay: 'accept' });
    await page.goto('/treasure-map');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    await saveButton(page).evaluate((button) => { button.click(); button.click(); });
    await expect(toast(page)).toBeVisible();
    await page.waitForTimeout(500);
    expect((await signed(page)).length, 'signed once').toBe(1);
    expect(state.published.length, 'published once').toBe(1);
  });
});
