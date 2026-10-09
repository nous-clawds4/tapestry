const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * treasure-map-card-details #1 — a Needs attention pill on an unassigned category card on /treasure-map. What a viewer
 * sees and does.
 *
 * Story: engineering-team/stories/done/treasure-map-card-details/1-needs-attention-pill.md (Light profile; the test plan
 *        is the story's Edge cases and AC→handle lines)
 * Node half: test/treasure-map-needs-attention.test.js (the words, the wiring, the CSS rule, the alert's negative pin).
 *
 * Mocks as tests/brainstorm/treasure-map-save.spec.js: the Map read local-first, then the strict relay read;
 * /api/profiles answering names; the person's Assistants; the instance's relay settings; a signer that signs; this
 * instance's relay and the outside relays accepting. Built UI served on :7799, every /api/* mocked.
 *
 *   N1 — only the unassigned card carries the pill; one Assistant or Mixed, none.                               [AC-1]
 *   N2 — no Map found: all three cards carry it.                                                               [AC-1]
 *   N3 — E1: a Map whose only entry is `*:tag` → Dee: all three carry it; E2: a bare `*` → Dee: none does.  [AC-1, E1, E2]
 *   N4 — Edit: a pick hides the card's pill, its Undo brings it back; Assign to all hides all, one card's Undo brings
 *        back only that card's (E4); the switches never bring one (E5).                                 [AC-2, E4, E5]
 *   N5 — Save: the picked card is assigned and has no pill once the save goes through.                          [AC-2]
 *   N6a–e — no pill while the Map loads (a), after a read error (b), signed out (c), or while the names load (d);
 *        a failed names lookup still draws the cards, pill included (e).                                       [AC-3]
 *   N7 — screen readers: "Needs attention: " is heard before the title, the pill is hidden from them; the Edit
 *        controls' descriptions still read just the category name.                                             [AC-4]
 *   N8 — the light-page amber, a pill; at 375 and 430 px it stays in its card and nothing scrolls sideways.      [AC-5]
 *   N9 — a Save accepted nowhere: Edit and the pick stay, so the card shows no pill; Undo brings it back.        [AC-2]
 *
 * N6 was one test with four legs until J2 (round 1): before the work it stopped at its second step, so its error and
 * signed-out legs never ran. Split into N6a–c, with N6d–e and N9 added for the names lookup and a failed Save.
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
// Scores: rank → Ava (one Assistant). Lists: nobody. Concepts: yours, plus Cy curating one list (Mixed). Scores has a
// backup (Cy) and a duty naming Cy, so the backup switch and the override switch both show in Edit mode.
const NO_LISTS_TAGS = [['30382:rank', A, R], ['30382:rank', C, R], ['3038x:tag:X1', C, R], ['39998:dlist-header', LOCAL, R], ['39998:restaurants', C, R]];
const NO_LISTS = mapOf(NO_LISTS_TAGS);
const PROFILES = {
  [A]: { display_name: 'Ava', website: 'ava.example', nip05: 'ava@ava.example' },
  [B]: { name: 'Bea', nip05: 'bea@bea.example' },
  [C]: { display_name: 'Cy' },
  [D]: { display_name: 'Dee' },
  [LOCAL]: { display_name: 'Zed Local' },
};
const MY_ROWS = [{ pubkey: C, local: false, tags: [] }, { pubkey: B, local: false, tags: [] }, { pubkey: LOCAL, local: true, tags: [] }, { pubkey: A, local: false, tags: [] }];

const DESCRIPTIONS = {
  Scores: 'Trust scores for profiles and content, one at a time.',
  Lists: 'Curated lists of profiles and content.',
  Concepts: 'Structured datasets your community organizes together.',
};
const PILL = 'Needs attention';
const SR_PREFIX = 'Needs attention: ';

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

async function setup(page, {
  signedIn = true, mapLocal = NO_LISTS, mapHold = null, relayAnswers = [{ success: true, events: [] }],
  relayList = ['wss://one.example'], myRows = MY_ROWS, profilesHold = null, profilesFail = false,
  // A Save's two ends: this instance's relay ('ok' | 'fail') and the outside relays ('accept' | 'refuse').
  local = 'ok', relay = 'accept',
} = {}) {
  const state = { session: signedIn, published: [], relayEvents: [] };
  await page.routeWebSocket(/.*/, (ws) => {
    ws.onMessage((raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m[0] !== 'EVENT') return;
      state.relayEvents.push({ url: ws.url(), event: m[1] });
      const ok = relay === 'accept';
      ws.send(JSON.stringify(['OK', m[1].id, ok, ok ? '' : 'blocked: test relay']));
    });
  });
  await page.addInitScript((viewer) => {
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => ({ ...u, pubkey: viewer, id: '7'.repeat(64), sig: 'f'.repeat(128) }),
    };
  }, VIEWER);
  await page.route('**/api/strfry/scan**', async (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      if (mapHold) await mapHold;
      const saved = state.published[state.published.length - 1];
      return json(r, { success: true, events: saved ? [saved] : mapLocal ? [mapLocal] : [] });
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
  await page.route('**/api/profiles**', async (r) => {
    if (profilesHold) await profilesHold;
    if (profilesFail) return json(r, { success: false, error: 'lookup failed' }, 500);
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out[k] = PROFILES[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/assistant/my-assistants**', (r) => json(r, state.session
    ? { success: true, signedIn: true, local: LOCAL, rows: myRows, definitions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/relays', (r) => json(r, { success: true, aRelays: A_RELAYS }));
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: true }));
  await page.route('**/api/strfry/publish', (r) => {
    if (local === 'fail') return json(r, { success: false, error: 'disk full' }, 500);
    const body = JSON.parse(r.request().postData() || '{}');
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
const card = (page, title) => section(page).locator('li').filter({ hasText: DESCRIPTIONS[title] });
const pill = (page, title) => card(page, title).getByText(PILL, { exact: true });
const editButton = (page) => main(page).getByRole('button', { name: /^Edit(ing)?$/ });
const PICKER = /^(Choose an Assistant|Change)$/;
const pickerButton = (page, title) => card(page, title).getByRole('button', { name: PICKER });
const assignAll = (page) => section(page).getByRole('button', { name: 'Assign to all', exact: true });
const saveButton = (page) => section(page).getByRole('button', { name: /^(Save changes|Saving…)$/ });
const toast = (page) => page.getByRole('status').filter({ hasText: /^Treasure Map updated$/ });

async function cardsDrawn(page) {
  for (const title of Object.keys(DESCRIPTIONS)) await expect(card(page, title)).toBeVisible();
}
async function pills(page) {
  const out = [];
  for (const title of Object.keys(DESCRIPTIONS)) if (await pill(page, title).count() > 0) out.push(title);
  return out;
}
async function startEditing(page) {
  await expect(editButton(page)).toHaveText(/^Edit$/);
  await editButton(page).click();
  await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
}
async function pick(page, toggle, name) {
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  const list = page.locator(`[id="${await toggle.getAttribute('aria-controls')}"]`);
  await list.getByRole('button', { name: new RegExp(`\\b${name}\\b`) }).click();
  await expect(list).toBeHidden();
}
const undoOf = (page, title) => card(page, title).getByRole('button', { name: 'Undo', exact: true });

test.describe('/treasure-map — the Needs attention pill', () => {
  test('N1: only the unassigned card carries "Needs attention"; one Assistant or Mixed carries none', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(card(page, 'Lists')).toContainText('Not assigned yet');
    await expect(pill(page, 'Lists')).toBeVisible();
    await expect(card(page, 'Scores')).toContainText('Assigned to');
    await expect(card(page, 'Concepts')).toContainText('Mixed');
    expect(await pills(page)).toEqual(['Lists']);
  });

  test('N2: no Map found — all three cards carry it', async ({ page }) => {
    await setup(page, { mapLocal: null });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    for (const title of Object.keys(DESCRIPTIONS)) await expect(pill(page, title)).toBeVisible();
    expect(await pills(page)).toEqual(['Scores', 'Lists', 'Concepts']);
  });

  test('N3: E1 — only `*:tag` → Dee: all three carry it (the page ignores *:…); E2 — a bare `*` → Dee: none does', async ({ page }) => {
    await setup(page, { mapLocal: mapOf([['*:tag', D, R]]) });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(pill(page, 'Concepts')).toBeVisible();
    expect(await pills(page), 'E1').toEqual(['Scores', 'Lists', 'Concepts']);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: mapOf([['*', D, R]]) });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(card(page, 'Lists')).toContainText('Dee');
    expect(await pills(page), 'E2').toEqual([]);
  });

  test('N4: Edit — a pick hides the pill, Undo brings it back; Assign to all hides all, a card\'s Undo brings back only its own; the switches never bring one', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await startEditing(page);
    await expect(pill(page, 'Lists'), 'Edit mode alone changes nothing').toBeVisible();
    await pick(page, pickerButton(page, 'Lists'), 'Bea');
    await expect(card(page, 'Lists')).toContainText('Will be assigned to Bea');
    await expect(pill(page, 'Lists')).toHaveCount(0);
    await undoOf(page, 'Lists').click();
    await expect(pill(page, 'Lists')).toBeVisible();

    // Each "no pill" check waits for the redraw it follows (an auto-waiting assertion, not a snapshot), so it can't
    // pass before React has drawn the click's result (J3 advisory).
    const allPills = section(page).getByText(PILL, { exact: true });
    await pick(page, assignAll(page), 'Bea');
    await expect(card(page, 'Lists')).toContainText('Will be assigned to Bea');
    await expect(allPills, 'Assign to all').toHaveCount(0);
    await undoOf(page, 'Scores').click();
    await expect(undoOf(page, 'Scores')).toHaveCount(0);
    await expect(allPills, 'Scores was assigned before, so its Undo brings no pill').toHaveCount(0);
    await undoOf(page, 'Lists').click();
    await expect(pill(page, 'Lists')).toBeVisible();
    await expect(allPills, 'only Lists was unassigned').toHaveCount(1);

    // E5: the backup switch and Scores' override switch never make a card unassigned.
    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    const backups = section(page).getByRole('switch', { name: /^Remove \d+ backup Assistants?$/ });
    await backups.click();
    await expect(backups).toHaveAttribute('aria-checked', 'true');
    const override = card(page, 'Scores').getByRole('switch');
    await override.click();
    await expect(override).toHaveAttribute('aria-checked', 'true');
    await expect(allPills, 'E5').toHaveCount(1);
    await expect(pill(page, 'Lists')).toBeVisible();
  });

  test('N5: Save — the picked card is assigned and has no pill once the save goes through', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(pill(page, 'Lists'), 'unassigned before the save').toBeVisible();
    await startEditing(page);
    await pick(page, pickerButton(page, 'Lists'), 'Bea');
    await saveButton(page).click();
    await expect(toast(page)).toBeVisible();
    expect(state.published.length, 'saved to this instance\'s relay').toBe(1);
    await expect(editButton(page)).toHaveText(/^Edit$/);
    await expect(card(page, 'Lists')).toContainText('Bea');
    await expect(card(page, 'Lists')).not.toContainText('Not assigned yet');
    expect(await pills(page)).toEqual([]);
  });

  test('N6a: no pill while the Map loads; once it has loaded, the unassigned card carries one', async ({ page }) => {
    const hold = deferred();
    await setup(page, { mapHold: hold.promise });
    await page.goto('/treasure-map');
    await expect(section(page).getByText('Loading your Treasure Map…')).toBeVisible();
    await expect(main(page).getByText(PILL, { exact: true })).toHaveCount(0);
    hold.resolve();
    await expect(pill(page, 'Lists')).toBeVisible();
  });

  test('N6b: no pill after a read error (sentinel: passes before and after)', async ({ page }) => {
    await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'no relay reached' }] });
    await page.goto('/treasure-map');
    await expect(section(page).getByText(/Couldn['’]t read your Treasure Map\./)).toBeVisible();
    await expect(main(page).getByText(PILL, { exact: true })).toHaveCount(0);
  });

  test('N6c: no pill signed out (sentinel: passes before and after)', async ({ page }) => {
    await setup(page, { signedIn: false });
    await page.goto('/treasure-map');
    await expect(main(page).getByText('Sign in to see your Treasure Map.')).toBeVisible();
    await expect(main(page).getByText(PILL, { exact: true })).toHaveCount(0);
  });

  test('N6d: no pill while the names load (the cards wait for them); once they have, the unassigned card carries one', async ({ page }) => {
    const hold = deferred();
    await setup(page, { profilesHold: hold.promise });
    await page.goto('/treasure-map');
    await expect(section(page).getByText('Loading your Treasure Map…')).toBeVisible();
    await expect(main(page).getByText(PILL, { exact: true })).toHaveCount(0);
    hold.resolve();
    await expect(card(page, 'Scores')).toContainText('Ava');
    await expect(pill(page, 'Lists')).toBeVisible();
  });

  test('N6e: the names lookup fails — the cards still appear, with fallback names, and the unassigned card carries the pill', async ({ page }) => {
    await setup(page, { profilesFail: true });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(card(page, 'Scores')).toContainText(npubShort(A));
    expect(await pills(page)).toEqual(['Lists']);
  });

  test('N7: screen readers hear "Needs attention: " before the title; the pill is hidden from them; the Edit controls still name just the category', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(pill(page, 'Lists')).toHaveAttribute('aria-hidden', 'true');
    const order = await card(page, 'Lists').evaluate((li, prefix) => {
      const all = [...li.querySelectorAll('*')];
      const sr = all.find((el) => el.children.length === 0 && el.textContent === prefix);
      const title = all.find((el) => el.children.length === 0 && el.textContent === 'Lists');
      if (!sr || !title) return { found: false };
      const box = sr.getBoundingClientRect();
      return {
        found: true,
        before: Boolean(sr.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING),
        hidden: box.width <= 1 && box.height <= 1,
        inTitle: title.contains(sr),
      };
    }, SR_PREFIX);
    expect(order, 'a visually hidden "Needs attention: " before the title, outside it').toEqual({ found: true, before: true, hidden: true, inTitle: false });
    expect(await card(page, 'Scores').getByText(SR_PREFIX).count(), 'an assigned card has no prefix').toBe(0);

    await startEditing(page);
    const described = await pickerButton(page, 'Lists').evaluate((btn) => (btn.getAttribute('aria-describedby') || '')
      .split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)?.textContent ?? null));
    expect(described, 'the Lists picker is described by the title alone').toEqual(['Lists']);
  });

  for (const width of [375, 430]) {
    test(`N8: the light-page amber pill — and at ${width} px it stays in its card and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page, { mapLocal: null });
      await page.goto('/treasure-map');
      await cardsDrawn(page);
      const look = await pill(page, 'Concepts').evaluate((el) => {
        const s = getComputedStyle(el);
        return { color: s.color, background: s.backgroundColor, weight: s.fontWeight, radius: parseFloat(s.borderTopLeftRadius) };
      });
      expect(look.color).toBe('rgb(180, 83, 9)');
      expect(look.background).toBe('rgb(255, 251, 235)');
      expect(look.weight).toBe('700');
      expect(look.radius, 'a pill').toBeGreaterThan(100);
      for (const title of Object.keys(DESCRIPTIONS)) {
        const p = await pill(page, title).boundingBox();
        const c = await card(page, title).boundingBox();
        expect(p.x >= c.x && p.x + p.width <= c.x + c.width, `${title}: the pill lies inside its card`).toBe(true);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'nothing scrolls sideways').toBeLessThanOrEqual(0);
    });
  }

  test('N9: a Save accepted nowhere — Edit and the pick stay, so the card shows no pill; Undo brings it back', async ({ page }) => {
    const state = await setup(page, { local: 'fail', relay: 'refuse' });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await startEditing(page);
    await pick(page, pickerButton(page, 'Lists'), 'Bea');
    await saveButton(page).click();
    await expect(section(page).getByRole('alert')).toContainText('could not be saved');
    expect(state.published.length, 'nothing written here').toBe(0);
    await expect(editButton(page), 'Edit mode stays').toHaveAttribute('aria-pressed', 'true');
    await expect(card(page, 'Lists')).toContainText('Will be assigned to Bea');
    await expect(pill(page, 'Lists')).toHaveCount(0);
    await undoOf(page, 'Lists').click();
    await expect(pill(page, 'Lists')).toBeVisible();
  });
});
