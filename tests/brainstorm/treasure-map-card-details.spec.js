const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * treasure-map-card-details #2 — Show details: each card's assignments on /treasure-map, entry by entry. What a viewer
 * sees and does.
 *
 * Story: engineering-team/stories/done/treasure-map-card-details/2-show-details-panel.md (Light profile; the test plan is
 *        the story's Edge cases and AC→handle lines)
 * Node half: test/treasure-map-card-details.test.js (categoryEntries, its agreement with the card, words, wiring).
 *
 * Mocks as tests/brainstorm/treasure-map-save.spec.js, minus Save: the Map read local-first, then the strict relay
 * read; /api/profiles answering names; the person's Assistants; the instance's relay settings. Every WebSocket is
 * closed. Built UI served on :7799, every /api/* mocked.
 *
 * The panel as this spec reads it: a region named "<Title> details" holding a list with one item per key; in each, the
 * key in a <code>, its label when it has one, and a nested list with one item per Assistant row (avatar, name, relay,
 * Backup). Text is read without aria-hidden parts (the avatar letters).
 *
 *   D1 — a "Show details" button on every card; it opens and closes its own panel only; all start closed.      [AC-1]
 *   D2 — what each panel lists: keys in Map order, first spelling; Assistant, relay or "No relay", Backup;
 *        "Individually assigned"; "Everything else"; nothing that doesn't count.                       [AC-2, AC-3]
 *   D3 — no Map: "No entries yet." in each panel.                                                               [AC-4]
 *   D4 — a backup-only Assistant is named (AC-6); with the name lookup failing, the cards still appear and the
 *        backup falls back to its shortened npub (E1).                                                   [AC-6, E1]
 *   D5 — Edit mode: the panels follow the draft — a pick, the backup switch, an override, Concepts gaining 39998 and
 *        39999 — and stay open; leaving Edit shows the published Map again.                       [AC-5, E6, E7]
 *   D6 — the card's Assistants are the panel's distinct first Assistants, in order.                             [AC-7]
 *   D7 — the toggle is a disclosure button worked from the keyboard; the panel a named region; the local
 *        Assistant's avatar wears the card's colour.                                                     [AC-2, AC-8]
 *   D8 — at 375 and 430 px, with every panel open, long keys and relays wrap inside the cards; nothing scrolls
 *        sideways.                                                                                            [AC-8]
 *   D9 — story 1's pill is still there with a panel open; the raw viewer is untouched.                         [AC-9]
 *   D10 — Save: Edit ends, the open panel stays open and lists the signed Map.                                  [AC-5]
 *
 * J2 advisories folded in before implementation: D2 checks the keys are monospace (AC-2); D3 the Map read error (no
 * cards, so no panels); D5 the panel below the picker row in Edit mode (AC-1) and a card's Undo (AC-5); D10 (AC-5).
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const E = 'e1'.repeat(32);
const R = 'wss://relay.example';
const LONG_RELAY = 'wss://relay.with-a-rather-long-hostname-for-wrapping-tests.example.com/and/a/long/path/too';
const LONG_KEY = '30396:tag:NostrDevelopersInNashvilleTennessee:VeganRestaurantsAndFoodTrucksDowntown';
const A_RELAYS = { aTrustedAssertionRelays: ['wss://ta.example'], aTrustedListRelays: ['wss://tl.example'], aDListRelays: ['wss://dl.example'] };

const mapOf = (tags) => ({ id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: '', tags, sig: 'f'.repeat(128) });
const DETAILS_TAGS = [
  ['client', 'some-app'],
  ['30382:rank', A, 'wss://ta.example'],
  ['30382:rank', C, ''],
  ['30382:followers', A, 'wss://ta.example'],
  ['30382:followers', E, ''], // Eve: a backup and nothing else, so only a lookup that covers backups names her
  ['3038x:tag:X1', C, R],
  ['30392', LOCAL, LONG_RELAY],
  [LONG_KEY, D, R],
  ['39998:dlist-header', LOCAL, R],
  ['39998:restaurants', C, R],
  ['*:tag', D, R], // ignored everywhere (treasure-map-edit decision 11)
  ['*', D, R], // reaches Scores and Lists; Concepts' 39998 covers it
  ['99999', A, R], // no category's
];
const DETAILS = mapOf(DETAILS_TAGS);
const PROFILES = {
  [A]: { display_name: 'Ava' },
  [B]: { name: 'Bea' },
  [C]: { display_name: 'Cy' },
  [D]: { display_name: 'Dee' },
  [E]: { display_name: 'Eve' },
  [LOCAL]: { display_name: 'Zed Local' },
};
const MY_ROWS = [{ pubkey: C, local: false, tags: [] }, { pubkey: B, local: false, tags: [] }, { pubkey: LOCAL, local: true, tags: [] }, { pubkey: A, local: false, tags: [] }];
const DESCRIPTIONS = {
  Scores: 'Trust scores for profiles and content, one at a time.',
  Lists: 'Curated lists of profiles and content.',
  Concepts: 'Structured datasets your community organizes together.',
};
const TITLES = Object.keys(DESCRIPTIONS);

// What D2 expects: per panel, [key line, [row lines]].
const PUBLISHED = {
  Scores: [
    ['30382:rank', ['Ava wss://ta.example', 'Cy No relay Backup']],
    ['30382:followers', ['Ava wss://ta.example', 'Eve No relay Backup']],
    ['3038x:tag:X1 Individually assigned', [`Cy ${R}`]],
    ['* Everything else', [`Dee ${R}`]],
  ],
  Lists: [
    ['30392', [`Zed Local ${LONG_RELAY}`]],
    [`${LONG_KEY} Individually assigned`, [`Dee ${R}`]],
    ['* Everything else', [`Dee ${R}`]],
  ],
  Concepts: [
    ['39998:dlist-header', [`Zed Local ${R}`]],
    ['39998:restaurants Individually assigned', [`Cy ${R}`]],
  ],
};

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const npubShort = (pk) => { const n = nip19.npubEncode(pk); return `${n.slice(0, 12)}…${n.slice(-6)}`; };

async function setup(page, { signedIn = true, mapLocal = DETAILS, profilesFail = false, readFail = false } = {}) {
  const state = { session: signedIn, published: [] };
  // Outside relays accept whatever is sent (D10's Save); nothing else is ever sent.
  await page.routeWebSocket(/.*/, (ws) => {
    ws.onMessage((raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (m[0] === 'EVENT') ws.send(JSON.stringify(['OK', m[1].id, true, '']));
    });
  });
  await page.addInitScript((viewer) => {
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => ({ ...u, pubkey: viewer, id: '7'.repeat(64), sig: 'f'.repeat(128) }),
    };
  }, VIEWER);
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      const saved = state.published[state.published.length - 1];
      return json(r, { success: true, events: saved ? [saved] : mapLocal ? [mapLocal] : [] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [{ name: 'relay 0', json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://one.example' } }) }] }));
  await page.route('**/api/relay/external**', (r) => (readFail
    ? json(r, { success: false, error: 'no relay reached' }, 500)
    : json(r, { success: true, events: [] })));
  await page.route('**/api/profiles**', (r) => {
    if (profilesFail) return json(r, { success: false, error: 'lookup failed' }, 500);
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out[k] = PROFILES[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/assistant/my-assistants**', (r) => json(r, state.session
    ? { success: true, signedIn: true, local: LOCAL, rows: MY_ROWS, definitions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/relays', (r) => json(r, { success: true, aRelays: A_RELAYS }));
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: true }));
  await page.route('**/api/strfry/publish', (r) => {
    state.published.push(JSON.parse(r.request().postData() || '{}').event);
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
const toggle = (page, title) => card(page, title).getByRole('button', { name: /^(Show|Hide) details$/ });
const panel = (page, title) => main(page).getByRole('region', { name: `${title} details`, exact: true });
const editButton = (page) => main(page).getByRole('button', { name: /^Edit(ing)?$/ });
const PICKER = /^(Choose an Assistant|Change)$/;
const pickerButton = (page, title) => card(page, title).getByRole('button', { name: PICKER });

async function cardsDrawn(page) {
  for (const title of TITLES) await expect(toggle(page, title)).toBeVisible();
}
async function open(page, title) {
  if ((await toggle(page, title).getAttribute('aria-expanded')) !== 'true') await toggle(page, title).click();
  await expect(panel(page, title)).toBeVisible();
}
/** The panel as [key line, [row lines]], read without aria-hidden parts; or its text when it lists no keys. */
async function model(page, title) {
  return panel(page, title).evaluate((region) => {
    const words = (el, skip) => {
      const out = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (n.parentElement.closest('[aria-hidden="true"]')) continue;
        if (skip && skip.some((s) => s.contains(n))) continue;
        out.push(n.textContent);
      }
      return out.join(' ').replace(/\s+/g, ' ').trim();
    };
    const list = region.querySelector('ul');
    if (!list) return words(region);
    return [...list.children].map((group) => {
      const rows = group.querySelector('ul');
      return [words(group, rows ? [rows] : []), rows ? [...rows.children].map((row) => words(row)) : []];
    });
  });
}
async function startEditing(page) {
  await expect(editButton(page)).toHaveText(/^Edit$/);
  await editButton(page).click();
  await expect(editButton(page)).toHaveAttribute('aria-pressed', 'true');
}
async function pick(page, button, name) {
  await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  const list = page.locator(`[id="${await button.getAttribute('aria-controls')}"]`);
  await list.getByRole('button', { name: new RegExp(`\\b${name}\\b`) }).click();
  await expect(list).toBeHidden();
}
/** The card's Assistants as its screen-reader list (Mixed) or its one name. */
async function cardNames(page, title) {
  const hidden = card(page, title).locator('ul.bs-sr-only > li');
  if (await hidden.count() > 0) return hidden.allTextContents();
  return [(await card(page, title).locator('.bsd-tm-cat-name').first().textContent()).trim()];
}

test.describe('/treasure-map — Show details', () => {
  test('D1: every card has "Show details"; it opens and closes its own panel only; all start closed', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    for (const title of TITLES) {
      await expect(toggle(page, title)).toHaveText('Show details');
      await expect(toggle(page, title)).toHaveAttribute('aria-expanded', 'false');
      await expect(panel(page, title)).toHaveCount(0);
    }
    await toggle(page, 'Scores').click();
    await expect(toggle(page, 'Scores')).toHaveText('Hide details');
    await expect(toggle(page, 'Scores')).toHaveAttribute('aria-expanded', 'true');
    const id = await toggle(page, 'Scores').getAttribute('aria-controls');
    expect(id, 'the button names its panel').toBeTruthy();
    await expect(page.locator(`[id="${id}"]`)).toHaveAttribute('aria-label', 'Scores details');
    await expect(panel(page, 'Scores')).toBeVisible();
    for (const title of ['Lists', 'Concepts']) {
      await expect(toggle(page, title)).toHaveAttribute('aria-expanded', 'false');
      await expect(panel(page, title)).toHaveCount(0);
    }
    const scoresBox = await card(page, 'Scores').boundingBox();
    const panelBox = await panel(page, 'Scores').boundingBox();
    expect(panelBox.y, 'the panel sits below the card\'s content').toBeGreaterThan(scoresBox.y + 40);
    await toggle(page, 'Scores').click();
    await expect(toggle(page, 'Scores')).toHaveText('Show details');
    await expect(panel(page, 'Scores')).toHaveCount(0);
  });

  test('D2: each panel lists its keys in Map order with Assistant, relay or "No relay", Backup, and the labels — nothing that doesn\'t count', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    for (const title of TITLES) {
      await open(page, title);
      await expect(panel(page, title)).toContainText(PUBLISHED[title][0][1][0].split(' ')[0]);
      expect(await model(page, title), title).toEqual(PUBLISHED[title]);
    }
    const fonts = await main(page).getByRole('region', { name: / details$/ }).locator('code')
      .evaluateAll((codes) => codes.map((c) => getComputedStyle(c).fontFamily));
    expect(fonts.length, 'one <code> per key').toBe(9);
    for (const font of fonts) expect(font, 'keys are shown in monospace').toMatch(/mono/i);
    const all = (await main(page).getByRole('region', { name: / details$/ }).allTextContents()).join(' ');
    for (const absent of ['*:tag', '99999', 'client']) expect(all, `${absent} is listed nowhere`).not.toContain(absent);
  });

  test('D3: no Map — each panel says "No entries yet."', async ({ page }) => {
    await setup(page, { mapLocal: null });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    for (const title of TITLES) {
      await open(page, title);
      expect(await model(page, title), title).toBe('No entries yet.');
    }

    // The Map can't be read: no cards, so no buttons and no panels (unchanged).
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { mapLocal: null, readFail: true });
    await page.goto('/treasure-map');
    await expect(section(page).getByText(/Couldn['’]t read your Treasure Map\./)).toBeVisible();
    await expect(section(page).getByRole('button', { name: /^(Show|Hide) details$/ })).toHaveCount(0);
    await expect(main(page).getByRole('region', { name: / details$/ })).toHaveCount(0);
  });

  test('D4: a backup-only Assistant is named (AC-6); with the name lookup failing, the cards still appear and she falls back to her shortened npub (E1)', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await open(page, 'Scores');
    await expect(panel(page, 'Scores')).toContainText('Eve');
    await expect(panel(page, 'Scores')).not.toContainText(npubShort(E));

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await setup(page, { profilesFail: true });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await open(page, 'Scores');
    await expect(panel(page, 'Scores')).toContainText(npubShort(E));
  });

  test('D5: Edit mode — the panels follow the draft and stay open; leaving Edit shows the published Map again', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await open(page, 'Scores');
    await open(page, 'Concepts');
    await startEditing(page);
    await expect(panel(page, 'Scores'), 'still open in Edit mode').toBeVisible();
    expect(await model(page, 'Scores'), 'Edit alone changes nothing').toEqual(PUBLISHED.Scores);
    const pickerBox = await pickerButton(page, 'Scores').boundingBox();
    const panelBox = await panel(page, 'Scores').boundingBox();
    expect(panelBox.y, 'AC-1: in Edit mode the panel sits below the picker row').toBeGreaterThanOrEqual(pickerBox.y + pickerBox.height);

    await pick(page, pickerButton(page, 'Scores'), 'Bea');
    // The own rows move to Bea in place (another Assistant: no relay); 3038x → Bea is added, which covers the `*`.
    await expect.poll(() => model(page, 'Scores')).toEqual([
      ['30382:rank', ['Bea No relay', 'Cy No relay Backup']],
      ['30382:followers', ['Bea No relay', 'Eve No relay Backup']],
      ['3038x:tag:X1 Individually assigned', [`Cy ${R}`]],
      ['3038x', ['Bea No relay']],
    ]);
    await section(page).getByRole('switch', { name: /^Remove \d+ backup Assistants?$/ }).click();
    await expect.poll(() => model(page, 'Scores'), 'E6: the backup switch').toEqual([
      ['30382:rank', ['Bea No relay']],
      ['30382:followers', ['Bea No relay']],
      ['3038x:tag:X1 Individually assigned', [`Cy ${R}`]],
      ['3038x', ['Bea No relay']],
    ]);
    await card(page, 'Scores').getByRole('switch').click();
    await expect.poll(() => model(page, 'Scores'), 'E6: the override').toEqual([
      ['30382:rank', ['Bea No relay']],
      ['30382:followers', ['Bea No relay']],
      ['3038x', ['Bea No relay']],
    ]);

    await pick(page, pickerButton(page, 'Concepts'), 'Bea');
    await expect.poll(() => model(page, 'Concepts'), 'E7: Concepts gains 39999').toEqual([
      ['39998:dlist-header', ['Bea No relay']],
      ['39998:restaurants Individually assigned', [`Cy ${R}`]],
      ['39999', ['Bea No relay']],
    ]);
    await card(page, 'Concepts').getByRole('button', { name: 'Undo', exact: true }).click();
    await expect.poll(() => model(page, 'Concepts'), 'a card\'s Undo').toEqual(PUBLISHED.Concepts);

    await editButton(page).click();
    await expect(editButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(panel(page, 'Scores'), 'still open after Edit').toBeVisible();
    await expect.poll(() => model(page, 'Scores')).toEqual(PUBLISHED.Scores);
    expect(await model(page, 'Concepts')).toEqual(PUBLISHED.Concepts);
    await expect(toggle(page, 'Lists')).toHaveAttribute('aria-expanded', 'false');
  });

  test('D6: the card\'s Assistants are the panel\'s distinct first Assistants, in order', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    const wrong = [];
    for (const title of TITLES) {
      await open(page, title);
      const firsts = [];
      for (const [, rows] of await model(page, title)) {
        const name = rows[0].replace(/ (No relay|wss:\/\/\S+)( Backup)?$/, '');
        if (!firsts.includes(name)) firsts.push(name);
      }
      const names = await cardNames(page, title);
      if (JSON.stringify(names) !== JSON.stringify(firsts)) wrong.push(`${title}: card ${JSON.stringify(names)}, panel ${JSON.stringify(firsts)}`);
    }
    expect(wrong).toEqual([]);
    await expect(card(page, 'Scores')).toContainText('· 3 Assistants');
  });

  test('D7: a disclosure button worked from the keyboard; the panel a named region; the local Assistant\'s avatar wears the card\'s colour', async ({ page }) => {
    await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await expect(toggle(page, 'Lists')).toHaveAttribute('type', 'button');
    // Gate B finding 1: the three buttons share a name, so each says which card it belongs to.
    for (const title of TITLES) await expect(toggle(page, title)).toHaveAccessibleDescription(title);
    await toggle(page, 'Lists').focus();
    await page.keyboard.press('Enter');
    await expect(toggle(page, 'Lists')).toHaveAttribute('aria-expanded', 'true');
    await expect(panel(page, 'Lists')).toBeVisible();
    await expect(toggle(page, 'Lists')).toBeFocused();
    await page.keyboard.press('Space');
    await expect(toggle(page, 'Lists')).toHaveAttribute('aria-expanded', 'false');
    await expect(panel(page, 'Lists')).toHaveCount(0);

    await open(page, 'Lists');
    const colours = await panel(page, 'Lists').evaluate((region) => {
      const rows = [...region.querySelectorAll('ul ul > li')];
      const avatar = (text) => {
        const row = rows.find((r) => r.textContent.includes(text));
        const a = row && row.querySelector('[aria-hidden="true"]');
        return a ? getComputedStyle(a).backgroundColor : null;
      };
      return { local: avatar('Zed Local'), other: avatar('Dee') };
    });
    const cardLocal = await card(page, 'Concepts').locator('[aria-hidden="true"]').first().evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(colours.local, 'the local Assistant\'s avatar in the panel').toBe(cardLocal);
    expect(colours.other).not.toBe(colours.local);
  });

  for (const width of [375, 430]) {
    test(`D8: at ${width} px, with every panel open, long keys and relays wrap inside the cards and nothing scrolls sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await setup(page);
      await page.goto('/treasure-map');
      await cardsDrawn(page);
      for (const title of TITLES) await open(page, title);
      for (const title of TITLES) {
        const c = await card(page, title).boundingBox();
        const p = await panel(page, title).boundingBox();
        expect(p.x >= c.x && p.x + p.width <= c.x + c.width + 0.5, `${title}: the panel lies inside its card`).toBe(true);
      }
      for (const text of [LONG_KEY, LONG_RELAY]) {
        const box = await panel(page, 'Lists').getByText(text, { exact: false }).first().boundingBox();
        const c = await card(page, 'Lists').boundingBox();
        expect(box.x + box.width <= c.x + c.width + 0.5, `${text.slice(0, 24)}… wraps inside the card`).toBe(true);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, 'nothing scrolls sideways').toBeLessThanOrEqual(0);
    });
  }

  test('D10: Save — Edit ends, and the open panel stays open and lists the signed Map', async ({ page }) => {
    const state = await setup(page);
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await open(page, 'Lists');
    await startEditing(page);
    await pick(page, pickerButton(page, 'Lists'), 'Bea');
    await section(page).getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: /^Treasure Map updated$/ })).toBeVisible();
    expect(state.published.length, 'saved once').toBe(1);
    await expect(editButton(page)).toHaveText(/^Edit$/);
    await expect(panel(page, 'Lists'), 'still open after the save').toBeVisible();
    // 30392 moves to Bea; 3039x → Bea is added, which covers the `*`; the individually assigned list stays.
    await expect.poll(() => model(page, 'Lists')).toEqual([
      ['30392', ['Bea No relay']],
      [`${LONG_KEY} Individually assigned`, [`Dee ${R}`]],
      ['3039x', ['Bea No relay']],
    ]);
  });

  test('D9: story 1\'s pill stays with a panel open; the raw viewer still shows the published Map', async ({ page }) => {
    await setup(page, { mapLocal: mapOf([['30382:rank', A, R]]) });
    await page.goto('/treasure-map');
    await cardsDrawn(page);
    await open(page, 'Lists');
    await expect(card(page, 'Lists').getByText('Needs attention', { exact: true })).toBeVisible();
    await main(page).getByRole('button', { name: /^View the raw Treasure Map(?! —)/ }).click();
    const raw = main(page).getByRole('region', { name: 'Raw Treasure Map', exact: true }).first();
    expect(JSON.parse(await raw.innerText()).tags).toEqual([['30382:rank', A, R]]);
  });
});
