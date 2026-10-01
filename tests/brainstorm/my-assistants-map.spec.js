const { test, expect } = require('@playwright/test');
const { REQUIRED_TAGGINGS } = require('../../src/lib/identification-tags');

/**
 * my-assistants #3 — what each Assistant does: your Treasure Map on /assistants. What a viewer SEES.
 *
 * Story: engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.md
 * ADR:   engineering-team/decisions/my-assistants/0003-the-pages-treasure-map-is-the-shared-hook-read-strictly.md
 * Plan:  engineering-team/stories/my-assistants/3-the-treasure-map-on-the-page.test-plan.md
 * Node half: test/my-assistants-map.test.js (the duties, per Assistant, the Duties tab's rows, the hook's option).
 *
 * The Treasure Map is read as the hook reads it (ADR 0003): local strfry first (/api/strfry/scan, kinds [10040]),
 * then — on a local miss — the general-purpose relays (their list from a read-only POST /api/neo4j/query) through
 * /api/relay/external, which must carry strict=1. Each is mocked per test.
 *
 * SAFETY (as in my-assistants-actions.spec.js): /api/publish-policy is local-only, every WebSocket is blocked and
 * counted (the count must end at 0), /api/strfry/publish is mocked, and window.nostr is a stub with fake signatures.
 *
 *   M1 — found locally: each row's status; the "M on your Treasure Map" count; an open row's duties in groups; Manage.
 *   M2 — none published (a local miss; the strict relay read reached a relay and found nothing): every row "Not on
 *        Treasure Map", "0 on your Treasure Map", the Duties tab's none line; the relay read asked with strict=1.
 *   M3 — unreadable (a local miss; the strict read reached no relay): never "Not on Treasure Map"; the error line and
 *        Try again on both tabs, and in an open row's panel; Try again reads again and the statuses appear.
 *   M3b — no general-purpose relay to ask and a local miss: unreadable, never "none" (ADR 0003 Amendment 1).
 *   M4 — while the map loads: rows show with no status and no map count; an open row's panel says it's reading and
 *        claims no duty; the Duties tab's loading line.
 *   M5 — every row opens: the untagged Local row shows its duties (none here) and Manage, with no Change or Remove.
 *   M6 — on the map but not tagged: the section, each Assistant's name, URL · NIP-05 and duty count, and its Tag
 *        buttons (signed as story 2's are, posted, reported, refreshed into the list, out of the section).
 *   M6b — the section's Tag buttons when a tag is unpublished: disabled, with the reason as their description.
 *   M7 — the tab switch: two tabs, Assistants selected; click and arrow keys switch; one panel at a time.
 *   M8 — the Duties tab: count, order, ranks, names, keys, levels, Preferred, Not tagged, Alternates; an open duty's
 *        Preferred / Alternate labels, sentence, raw entries and Manage link; entries the app can't place left out.
 *   M8b — an open duty's labels: "First listed is preferred" and Alternate 1, 2 with two; "Only provider" with one.
 *   M9 — at 375 px the Duties tab and the not-tagged section don't scroll sideways or cut anything off.
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const D = 'd1'.repeat(32);
const R = 'wss://relay.example';
const NOUS = REQUIRED_TAGGINGS.find((e) => e.key === 'my-tapestry-assistant').author;
const BR = { key: 'brainstorm', name: 'My Brainstorm Assistant' };
const TP = { key: 'tapestry', name: 'My Tapestry Assistant' };
const DEF = {
  brainstorm: { address: `39999:${NOUS}:my-brainstorm-assistant`, found: true, eventId: 'b0'.repeat(32) },
  tapestry: { address: `39999:${NOUS}:my-tapestry-assistant`, found: true, eventId: 'e0'.repeat(32) },
};
const APOS = '[\'’]';
const re = (s) => new RegExp(s.replace(/'/g, APOS));
const rowOf = (pubkey, keys, { local = false } = {}) => ({
  pubkey, local, tags: keys.map((k) => (k === 'brainstorm' ? BR : TP)),
  retract: Object.fromEntries(keys.map((k) => [k, { ids: ['f'.repeat(64)], addresses: [`39999:${VIEWER}:x`] }])),
});
const answerOf = (rows) => ({ body: { success: true, signedIn: true, local: LOCAL, rows, definitions: DEF } });
const BASE_ROWS = [rowOf(LOCAL, [], { local: true }), rowOf(A, ['tapestry']), rowOf(B, ['brainstorm'])];
const PROFILES = {
  [LOCAL]: { display_name: 'Zed Local' },
  [A]: { name: 'Ava' },
  [B]: { display_name: 'Bea' },
  [D]: { display_name: 'Dee the Unclaimed', website: 'dee.example', nip05: 'dee@dee.example' },
};
const MAP = {
  kind: 10040, pubkey: VIEWER, created_at: 1000, id: '9'.repeat(64), sig: 'f'.repeat(128), content: '',
  tags: [
    ['30382:rank', A, R],
    ['30382:rank', B, R],
    ['30392', D, R],
    ['39998:dog-breed', A, R],
    ['39998:dlist-header', D, R],
    ['99999', A, R],
  ],
};
// Most generic first: 30392 (Lists, Scope), 39998:dlist-header (Concepts, Scope), 30382:rank (Exact), 39998:dog-breed (Exact).
const DUTY_ORDER = [
  ['All Lists of profiles', '30392', 'Scope'],
  ['All Concept headers', '39998:dlist-header', 'Scope'],
  ['rank', '30382:rank', 'Exact'],
  ['Curated DList: dog-breed', '39998:dog-breed', 'Exact'],
];
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * mapLocal: the event local strfry holds (or null); mapHold: a promise the local read waits on;
 * relayAnswers: /api/relay/external's answers in order (the last repeats).
 */
async function setup(page, { answers = [answerOf(BASE_ROWS)], mapLocal = MAP, mapHold = null, relayAnswers = [{ success: true, events: [] }], relayList = ['wss://one.example'] } = {}) {
  const state = { reads: 0, posted: [], ws: 0, relayUrls: [], mapReads: 0 };
  await page.routeWebSocket(/.*/, (ws) => { state.ws++; ws.close(); });
  await page.addInitScript((viewer) => {
    window.__signed = [];
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => { const s = { ...u, pubkey: viewer, id: window.__signed.length.toString(16).padStart(64, '7'), sig: 'f'.repeat(128) }; window.__signed.push(s); return s; },
    };
  }, VIEWER);
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/strfry/publish', (r) => { state.posted.push(JSON.parse(r.request().postData() || '{}').event); return json(r, { success: true }); });
  await page.route('**/api/strfry/scan**', async (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      state.mapReads++;
      if (mapHold) await mapHold;
      return json(r, { success: true, events: mapLocal ? [mapLocal] : [] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: relayList.map((url, i) => ({ name: `relay ${i}`, json: JSON.stringify({ nostrRelay: { websocketUrl: url } }) })) }));
  await page.route('**/api/relay/external**', (r) => {
    state.relayUrls.push(r.request().url());
    const a = relayAnswers[Math.min(state.relayUrls.length - 1, relayAnswers.length - 1)];
    return json(r, a, a.success === false ? 500 : 200);
  });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: '2'.repeat(64) }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: '1'.repeat(64) }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }));
  await page.route('**/api/assistant/attention**', (r) => json(r, { success: true, signedIn: true, hasAssistant: false, actions: {} }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, { authenticated: true, pubkey: VIEWER }));
  await page.route('**/api/auth/user-classification', (r) => json(r, { success: true, classification: 'customer', pubkey: VIEWER, assistantPubkey: LOCAL }));
  await page.route('**/api/profiles**', (r) => {
    const keys = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
    const out = {};
    for (const k of keys) if (Object.prototype.hasOwnProperty.call(PROFILES, k)) out[k] = PROFILES[k];
    return json(r, { success: true, profiles: out });
  });
  await page.route('**/api/search/profiles/meili**', (r) => json(r, { success: true, hits: [] }));
  await page.route('**/api/assistant/my-assistants**', (r) => {
    const a = answers[Math.min(state.reads, answers.length - 1)];
    state.reads++;
    return json(r, a.body, a.status || 200);
  });
  return state;
}

const PAGE = '/assistants';
const main = (page) => page.locator('main');
const list = (page) => page.getByRole('list', { name: 'Your Assistants' });
const items = (page) => list(page).locator(':scope > li, :scope > [role="listitem"]');
const rowNamed = (page, name) => items(page).filter({ has: page.getByText(name, { exact: true }) });
const toggle = (row) => row.locator('[aria-expanded]').first();
const tagValues = (ev, name) => ev.tags.filter((t) => t[0] === name).map((t) => t[1]);
const tab = (page, name) => page.getByRole('tab', { name });
const STATUS_RE = /^(On|Not on) Treasure Map$/;
async function noSockets(state) { expect(state.ws, 'no WebSocket may be opened').toBe(0); }
async function settled(page, n) { await expect(items(page)).toHaveCount(n); }

test.describe('/assistants — the Treasure Map', () => {
  test('M1: found locally — row statuses, the map count, an open row\'s grouped duties, and Manage', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(main(page).getByText('2 on your Treasure Map', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Ava').getByText('On Treasure Map', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Bea').getByText('On Treasure Map', { exact: true })).toBeVisible();
    await expect(rowNamed(page, 'Zed Local').getByText('Not on Treasure Map', { exact: true })).toBeVisible();
    const ava = rowNamed(page, 'Ava');
    await toggle(ava).click();
    await expect(ava).toContainText('Duties on your Treasure Map');
    await expect(ava).toContainText('2 duties');
    await expect(ava.getByText('Scores', { exact: true })).toBeVisible();
    await expect(ava.getByText('Concepts', { exact: true })).toBeVisible();
    await expect(ava.getByText('Lists', { exact: true })).toHaveCount(0);
    await expect(ava.getByText('rank', { exact: true })).toBeVisible();
    await expect(ava.getByText('Curated DList: dog-breed', { exact: true })).toBeVisible();
    await expect(ava.getByRole('link', { name: 'Manage on Treasure Map' })).toHaveAttribute('href', '/tapestry/grapevine/treasure-map');
    expect(state.relayUrls, 'found locally: no relay read').toEqual([]);
    await noSockets(state);
  });

  test('M2: none published — every row "Not on Treasure Map", the zero count, the Duties tab\'s line; the relay read is strict', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayAnswers: [{ success: true, events: [] }] });
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(main(page).getByText('0 on your Treasure Map', { exact: true })).toBeVisible();
    for (const n of ['Zed Local', 'Ava', 'Bea']) await expect(rowNamed(page, n).getByText('Not on Treasure Map', { exact: true })).toBeVisible();
    expect(state.relayUrls.length, 'one relay read after the local miss').toBe(1);
    expect(new URL(state.relayUrls[0]).searchParams.get('strict'), 'the relay read is strict').toBe('1');
    await tab(page, 'Duties').click();
    await expect(main(page).getByText(re("You haven't published a Treasure Map yet, so no Assistant has duties."))).toBeVisible();
    await noSockets(state);
  });

  test('M3: unreadable — never "Not on Treasure Map"; the error line and Try again on both tabs; Try again reads again', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'no relay could be read' }, { success: true, events: [MAP] }] });
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(main(page).getByText(re("Couldn't read your Treasure Map."))).toBeVisible();
    await expect(main(page).getByText(STATUS_RE)).toHaveCount(0);
    await expect(main(page).getByText(/on your Treasure Map$/)).toHaveCount(0);
    await tab(page, 'Duties').click();
    await expect(main(page).getByText(re("Couldn't read your Treasure Map."))).toBeVisible();
    await expect(main(page).getByText(re("You haven't published a Treasure Map yet"))).toHaveCount(0);
    await tab(page, 'Assistants').click();
    // Review 1, B1: an open row's panel says the Map couldn't be read — never that the Assistant has no duties.
    const ava = rowNamed(page, 'Ava');
    await toggle(ava).click();
    await expect(ava.getByText(re("Couldn't read your Treasure Map."))).toBeVisible();
    await expect(ava.getByText(/No duties/)).toHaveCount(0);
    await expect(ava.getByText(re("isn't listed on your Treasure Map"))).toHaveCount(0);
    await expect(ava.getByText(/^(Scores|Lists|Concepts)$/)).toHaveCount(0);
    await main(page).getByRole('button', { name: 'Try again' }).click();
    await expect(main(page).getByText('2 on your Treasure Map', { exact: true })).toBeVisible();
    await expect(ava.getByText('On Treasure Map', { exact: true })).toBeVisible();
    await expect(ava).toContainText('2 duties');
    await noSockets(state);
  });

  test('M3b: no general-purpose relay to ask and nothing locally — unreadable, never "none" (ADR 0003 Amendment 1)', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayList: [] });
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(main(page).getByText(re("Couldn't read your Treasure Map."))).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Try again' })).toBeVisible();
    await expect(main(page).getByText(STATUS_RE)).toHaveCount(0);
    await expect(main(page).getByText(/on your Treasure Map$/)).toHaveCount(0);
    await tab(page, 'Duties').click();
    await expect(main(page).getByText(re("Couldn't read your Treasure Map."))).toBeVisible();
    await expect(main(page).getByText(re("You haven't published a Treasure Map yet"))).toHaveCount(0);
    expect(state.relayUrls, 'no relay to ask, so no relay read').toEqual([]);
    await noSockets(state);
  });

  test('M4: while the map loads — rows without a status, no map count; the Duties tab\'s loading line', async ({ page }) => {
    const hold = deferred();
    const state = await setup(page, { mapHold: hold.promise });
    await page.goto(PAGE);
    await settled(page, 3);
    for (let i = 0; i < 6; i++) {
      const text = await page.evaluate(() => (document.querySelector('main') || {}).innerText || '');
      expect(/(^|\n)\s*(On|Not on) Treasure Map\s*($|\n)/.test(text), `sample ${i}: no status while the map loads`).toBe(false);
      expect(/\d+ on your Treasure Map/.test(text), `sample ${i}: no map count while the map loads`).toBe(false);
      await page.waitForTimeout(100);
    }
    // Review 1, B1: an open row's panel says the Map is being read — no duty count, no group, no "isn't listed".
    const ava = rowNamed(page, 'Ava');
    await toggle(ava).click();
    await expect(ava.getByText('Reading your Treasure Map…', { exact: true })).toBeVisible();
    for (let i = 0; i < 4; i++) {
      const panel = await ava.innerText();
      expect(/No duties|\d+ dut(y|ies)\b|isn['’]t listed on your Treasure Map|(^|\n)(Scores|Lists|Concepts)\s*(\n|$)/i.test(panel),
        `sample ${i}: the open panel claims nothing while the map loads; got ${JSON.stringify(panel)}`).toBe(false);
      await page.waitForTimeout(100);
    }
    await tab(page, 'Duties').click();
    await expect(main(page).getByText('Reading your Treasure Map…', { exact: true })).toBeVisible();
    hold.resolve();
    await expect(main(page).getByText('4 duties', { exact: true })).toBeVisible();
    await tab(page, 'Assistants').click();
    await expect(ava).toContainText('2 duties');
    await noSockets(state);
  });

  test('M5: every row opens — the untagged Local row shows its (no) duties and Manage, with no Change or Remove', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 3);
    const local = rowNamed(page, 'Zed Local');
    await toggle(local).click();
    await expect(toggle(local)).toHaveAttribute('aria-expanded', 'true');
    await expect(local).toContainText(re("This Assistant isn't listed on your Treasure Map, so clients won't ask it for anything."));
    await expect(local.getByRole('link', { name: 'Manage on Treasure Map' })).toBeVisible();
    await expect(local.getByRole('button', { name: 'Remove Tag' })).toHaveCount(0);
    await expect(local.getByRole('button', { name: /^Change to/ })).toHaveCount(0);
    await noSockets(state);
  });

  test('M6: on the map but not tagged — the section and its Tag buttons, which move the Assistant into the list', async ({ page }) => {
    const state = await setup(page, { answers: [answerOf(BASE_ROWS), answerOf([...BASE_ROWS, rowOf(D, ['tapestry'])])] });
    await page.goto(PAGE);
    await settled(page, 3);
    const section = page.getByRole('region', { name: 'On your Treasure Map, but not tagged' });
    await expect(section).toBeVisible();
    await expect(section).toContainText(re("These Assistants have duties on your Treasure Map, but you haven't tagged them as yours."));
    await expect(section).toContainText('Dee the Unclaimed');
    await expect(section).toContainText('dee.example');
    await expect(section).toContainText('dee@dee.example');
    await expect(section).toContainText('2 duties on your Treasure Map');
    await section.getByRole('button', { name: 'Tag: Tapestry' }).click();
    await settled(page, 4);
    await expect(page.getByRole('region', { name: 'On your Treasure Map, but not tagged' })).toHaveCount(0);
    const evs = await page.evaluate(() => window.__signed);
    expect(evs.length).toBe(1);
    const ev = evs[0];
    expect(ev.kind).toBe(39999);
    expect(tagValues(ev, 'p')).toEqual([D]);
    expect(tagValues(ev, 'a')).toEqual([DEF.tapestry.address]);
    expect(tagValues(ev, 'e')).toEqual([DEF.tapestry.eventId]);
    expect(tagValues(ev, 'polarity')).toEqual(['1']);
    expect(tagValues(ev, 'd')).toEqual([`profile-tag-my-tapestry-assistant-${D.slice(0, 8)}-${VIEWER.slice(0, 8)}`]);
    expect(state.posted.map((e) => e.id)).toEqual([ev.id]);
    await expect(main(page).getByText(/"My Tapestry Assistant" was saved on this instance['’]s relay only/)).toBeVisible();
    await noSockets(state);
  });

  test('M6b: the section\'s Tag buttons — an unpublished tag\'s button is disabled with the reason; the other works', async ({ page }) => {
    const missing = { ...DEF, brainstorm: { ...DEF.brainstorm, found: false, eventId: null } };
    const state = await setup(page, { answers: [{ body: { ...answerOf(BASE_ROWS).body, definitions: missing } }] });
    await page.goto(PAGE);
    await settled(page, 3);
    const section = page.getByRole('region', { name: 'On your Treasure Map, but not tagged' });
    await expect(section.getByRole('button', { name: 'Tag: Brainstorm' })).toBeDisabled();
    await expect(section.getByRole('button', { name: 'Tag: Brainstorm' }))
      .toHaveAccessibleDescription(re("The My Brainstorm Assistant tag hasn't been published yet, so it can't be applied."));
    await expect(section.getByRole('button', { name: 'Tag: Tapestry' })).toBeEnabled();
    expect(await page.evaluate(() => window.__signed)).toEqual([]);
    await noSockets(state);
  });

  test('M7: the tab switch — Assistants by default; click and arrow keys switch; one panel at a time', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(tab(page, 'Assistants')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'Duties')).toHaveAttribute('aria-selected', 'false');
    // Review 1, NB4: a tab's aria-controls, when it has one, names a panel that is in the page.
    const controlsResolve = async (when) => {
      for (const name of ['Assistants', 'Duties']) {
        const id = await tab(page, name).getAttribute('aria-controls');
        if (id) await expect(page.locator(`[id="${id}"]`), `${when}: ${name}'s aria-controls names ${id}`).toHaveCount(1);
      }
    };
    await controlsResolve('Assistants selected');
    await tab(page, 'Duties').click();
    await expect(tab(page, 'Duties')).toHaveAttribute('aria-selected', 'true');
    await controlsResolve('Duties selected');
    await expect(page.getByPlaceholder('Search by name, NIP-05, URL or npub')).toHaveCount(0);
    await expect(list(page)).toHaveCount(0);
    await tab(page, 'Duties').focus();
    await page.keyboard.press('ArrowLeft');
    await expect(tab(page, 'Assistants')).toHaveAttribute('aria-selected', 'true');
    await expect(list(page)).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(tab(page, 'Duties')).toHaveAttribute('aria-selected', 'true');
    await noSockets(state);
  });

  test('M8: the Duties tab — count, order, names, keys, levels, Preferred, Not tagged, Alternates, and an open duty', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 3);
    await tab(page, 'Duties').click();
    await expect(main(page).getByText('4 duties', { exact: true })).toBeVisible();
    await expect(main(page).getByText('Most generic first', { exact: true })).toBeVisible();
    await expect(main(page)).toContainText('Within a duty, the first Assistant listed is preferred; the rest are alternates.');
    const duties = page.getByRole('list', { name: 'Duties on your Treasure Map' }).locator(':scope > li, :scope > [role="listitem"]');
    await expect(duties).toHaveCount(4);
    for (const [i, [title, key, level]] of DUTY_ORDER.entries()) {
      const d = duties.nth(i);
      await expect(d.getByText(String(i + 1), { exact: true }).first()).toBeVisible();
      await expect(d.getByText(title, { exact: true }).first()).toBeVisible();
      await expect(d.getByText(key, { exact: true }).first()).toBeVisible();
      await expect(d.getByText(level, { exact: true })).toBeVisible();
    }
    const lists = duties.nth(0);
    await expect(lists.getByText('Dee the Unclaimed', { exact: true }).first()).toBeVisible();
    await expect(lists.getByText('Not tagged', { exact: true })).toBeVisible();
    const rank = duties.nth(2);
    await expect(rank.getByText('Ava', { exact: true }).first()).toBeVisible();
    await expect(rank.getByText('Not tagged', { exact: true })).toHaveCount(0);
    await expect(rank).toContainText('Alternates: Bea');
    await rank.locator('[aria-expanded]').first().click();
    await expect(rank.getByText('Preferred', { exact: true })).toBeVisible();
    await expect(rank.getByText('Alternate', { exact: true })).toBeVisible();
    await expect(rank).toContainText(re("I entrust Ava to publish and maintain a rank for every profile, as seen from my trusted community. If it can't, ask Bea."));
    await expect(rank).toContainText(A);
    await expect(rank.getByRole('link', { name: /Manage on Treasure Map/ })).toHaveAttribute('href', '/tapestry/grapevine/treasure-map');
    await expect(main(page).getByText('99999', { exact: true }), 'an entry the app cannot place is not a duty').toHaveCount(0);
    await noSockets(state);
  });

  test('M8b: an open duty — "First listed is preferred" and numbered Alternates with two; "Only provider" with one', async ({ page }) => {
    const map = { ...MAP, tags: [['30382:rank', A, R], ['30382:rank', B, R], ['30382:rank', D, R], ['39998:dog-breed', B, R]] };
    const state = await setup(page, { mapLocal: map });
    await page.goto(PAGE);
    await settled(page, 3);
    await tab(page, 'Duties').click();
    const duties = page.getByRole('list', { name: 'Duties on your Treasure Map' }).locator(':scope > li, :scope > [role="listitem"]');
    await expect(duties).toHaveCount(2);
    const rank = duties.nth(0);
    await expect(rank).toContainText('Alternates: Bea, Dee the Unclaimed');
    await rank.locator('[aria-expanded]').first().click();
    await expect(rank).toContainText('First listed is preferred');
    await expect(rank.getByText('Preferred', { exact: true })).toBeVisible();
    await expect(rank.getByText('Alternate 1', { exact: true })).toBeVisible();
    await expect(rank.getByText('Alternate 2', { exact: true })).toBeVisible();
    await expect(rank).toContainText(re("If it can't, ask Bea, then Dee the Unclaimed."));
    const breed = duties.nth(1);
    await breed.locator('[aria-expanded]').first().click();
    await expect(breed).toContainText('Only provider');
    await expect(breed.getByText(/^Alternate/)).toHaveCount(0);
    await noSockets(state);
  });

  test('M9: at 375 px, the Duties tab and the not-tagged section don\'t scroll sideways or cut anything off', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 3);
    await expect(page.getByRole('region', { name: 'On your Treasure Map, but not tagged' })).toBeVisible();
    const check = async (what) => {
      const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
      expect(m.scroll, `${what}: the page is ${m.scroll}px wide in ${m.width}px`).toBeLessThanOrEqual(m.width);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('main *')]
        .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto')
        .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.scrollWidth} > ${el.clientWidth}`));
      expect(clipped, `${what}: nothing cut off`).toEqual([]);
    };
    await check('Assistants tab with the section');
    await tab(page, 'Duties').click();
    const duties = page.getByRole('list', { name: 'Duties on your Treasure Map' }).locator(':scope > li, :scope > [role="listitem"]');
    await duties.nth(2).locator('[aria-expanded]').first().click();
    await check('Duties tab with an open duty');
    await noSockets(state);
  });
});
