const { test, expect } = require('@playwright/test');
const { REQUIRED_TAGGINGS } = require('../../src/lib/identification-tags');

/**
 * my-assistants #4 — is each Assistant's NIP-05 genuine, and a way into each Assistant's profile. What a viewer SEES.
 *
 * Story: engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.md
 * ADR:   engineering-team/decisions/my-assistants/0004-nip05-status-from-the-verify-endpoint-and-plain-profile-links.md
 * Plan:  engineering-team/stories/my-assistants/4-nip05-validity-and-profile-links.test-plan.md
 * Node half: test/my-assistants-nip05.test.js (the server's lookup and status, the view-model).
 *
 * GET /api/nip05/verify is mocked per NIP-05: an answer, an answer held until released, a 500, a network abort, or an
 * older server's answer with no `status`. Every request is recorded.
 *
 * SAFETY (as in the earlier my-assistants specs): /api/publish-policy is local-only, every WebSocket is blocked and
 * counted — on the page AND on any tab a profile link opens (context-level) — /api/strfry/publish is mocked, a profile
 * tab is served a stub page, and window.nostr is a stub with fake signatures.
 *
 * The honest-state rule (story AC-1; ledger 2026-10-01-honest-states-pinned-per-state) is pinned on BOTH surfaces that
 * show a status: the Assistants list and "On your Treasure Map, but not tagged".
 *
 *   N1 — the list: Verified / Not valid / Couldn't check beside each NIP-05, each with its explanation; none without a
 *        NIP-05; one request per NIP-05, for that row's pubkey.
 *   N2 — while a check is held: "Checking…", never a verdict (sampled) — in the list and in the section.
 *   N3 — a failed check (500, network abort, an answer with no status) reads Couldn't check, never Not valid — in the
 *        list and in the section.
 *   N4 — the section: the status beside each NIP-05.
 *   N5 — the search results show no status, and no check is asked for them.
 *   N6 — a refresh after a press, or leaving the tab and coming back, asks no definite answer again.
 *   P1 — an open row's View profile link (the untagged Local row too): /user/<pubkey>, a new tab, its accessible name;
 *        it opens the profile and leaves the row open.
 *   P2 — the section's View profile links.
 *   P3 — an open duty: a link for the Preferred and for every Alternate.
 *   P4 — 375 px: statuses and links don't scroll sideways or cut anything off.
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const C = 'c3'.repeat(32);
const D = 'd1'.repeat(32);
const E = 'd2'.repeat(32);
const X = 'e1'.repeat(32);
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
const BASE_ROWS = [rowOf(LOCAL, [], { local: true }), rowOf(A, ['tapestry']), rowOf(B, ['brainstorm']), rowOf(C, ['tapestry'])];
const PROFILES = {
  [LOCAL]: { display_name: 'Zed Local', nip05: 'zed@ok.example' },
  [A]: { name: 'Ava', nip05: 'ava@bad.example' },
  [B]: { display_name: 'Bea', nip05: 'bea@down.example' },
  [C]: { display_name: 'Cy' },
  [D]: { display_name: 'Dee the Unclaimed', website: 'dee.example', nip05: 'dee@dee.example' },
  [E]: { display_name: 'Eve Elsewhere', nip05: 'eve@eve.example' },
  [X]: { display_name: 'Xavi', nip05: 'xavi@ex.example' },
};
const MAP = {
  kind: 10040, pubkey: VIEWER, created_at: 1000, id: '9'.repeat(64), sig: 'f'.repeat(128), content: '',
  tags: [['30382:rank', A, R], ['30382:rank', B, R], ['30382:rank', D, R], ['30392', E, R]],
};
const VERIFIED = { verified: true, status: 'verified' };
const INVALID = { verified: false, status: 'invalid' };
const UNCHECKED = { verified: false, status: 'unchecked' };
// The answers by NIP-05 unless a test says otherwise.
const NIP05_ANSWERS = {
  'zed@ok.example': VERIFIED,
  'ava@bad.example': INVALID,
  'bea@down.example': UNCHECKED,
  'dee@dee.example': VERIFIED,
  'eve@eve.example': INVALID,
  'xavi@ex.example': VERIFIED,
};
const TITLES = {
  Verified: 'Its domain confirms this NIP-05 belongs to this profile.',
  'Not valid': "Its domain doesn't list this NIP-05 for this profile.",
  "Couldn't check": "Its domain didn't answer, so this NIP-05 couldn't be checked.",
};
const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * nip05: per-NIP-05 overrides of NIP05_ANSWERS. A value is an answer, { hold: promise, then: answer },
 * 'fail' (a 500) or 'abort' (the request fails).
 */
async function setup(page, { answers = [answerOf(BASE_ROWS)], nip05 = {}, search = {} } = {}) {
  const state = { reads: 0, posted: [], ws: 0, checks: [] };
  const ctx = page.context();
  await ctx.routeWebSocket(/.*/, (ws) => { state.ws++; ws.close(); });
  await ctx.route((url) => url.pathname.startsWith('/user/'), (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>profile stub</title><p>profile stub</p>' }));
  await page.addInitScript((viewer) => {
    window.__signed = [];
    window.nostr = {
      getPublicKey: async () => viewer,
      signEvent: async (u) => { const s = { ...u, pubkey: viewer, id: window.__signed.length.toString(16).padStart(64, '7'), sig: 'f'.repeat(128) }; window.__signed.push(s); return s; },
    };
  }, VIEWER);
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/strfry/publish', (r) => { state.posted.push(JSON.parse(r.request().postData() || '{}').event); return json(r, { success: true }); });
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    return json(r, { success: true, events: Array.isArray(filter.kinds) && filter.kinds.includes(10040) ? [MAP] : [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [{ name: 'relay one', json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://one.example' } }) }] }));
  await page.route('**/api/relay/external**', (r) => json(r, { success: true, events: [] }));
  await page.route('**/api/nip05/verify**', async (r) => {
    const u = new URL(r.request().url());
    const id = u.searchParams.get('nip05');
    state.checks.push({ nip05: id, pubkey: u.searchParams.get('pubkey') });
    const a = Object.prototype.hasOwnProperty.call(nip05, id) ? nip05[id] : NIP05_ANSWERS[id];
    if (a === 'abort') return r.abort('failed');
    if (a === 'fail') return json(r, { error: 'boom' }, 500);
    if (a && a.hold) { await a.hold; return json(r, a.then); }
    return json(r, a || UNCHECKED);
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
  await page.route('**/api/search/profiles/meili**', (r) => json(r, { success: true, hits: search[new URL(r.request().url()).searchParams.get('q') || ''] || [] }));
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
const section = (page) => page.getByRole('region', { name: 'On your Treasure Map, but not tagged' });
const sectionItem = (page, name) => section(page).locator('li').filter({ has: page.getByText(name, { exact: true }) });
const tab = (page, name) => page.getByRole('tab', { name });
/** A status element: its whole text is the word, with a leading check mark allowed for Verified. */
const statusIn = (scope, word) => scope.getByText(new RegExp(`^(✓\\s*)?${word.replace(/'/g, APOS)}$`));
// No word boundary: two inline spans render as "Checking…Couldn’t check" with no space between them.
const VERDICT_RE = /Verified|Not valid|Couldn['’]t check/;
async function noSockets(state) { expect(state.ws, 'no WebSocket may be opened').toBe(0); }
async function settled(page, n) { await expect(items(page)).toHaveCount(n); }
async function expectStatus(scope, word) {
  const el = statusIn(scope, word);
  await expect(el).toBeVisible();
  await expect(el).toHaveAttribute('title', re(TITLES[word]));
}

test.describe('/assistants — NIP-05 status and profile links', () => {
  test('N1: the list — Verified, Not valid, Couldn\'t check beside each NIP-05, explained; none without one; one check per NIP-05', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    await expectStatus(rowNamed(page, 'Zed Local'), 'Verified');
    await expectStatus(rowNamed(page, 'Ava'), 'Not valid');
    await expectStatus(rowNamed(page, 'Bea'), "Couldn't check");
    // AC-3: the status is read with its NIP-05.
    await expect(rowNamed(page, 'Ava')).toContainText(/ava@bad\.example\s*Not valid/);
    // No NIP-05: "—" and no status.
    const cy = rowNamed(page, 'Cy');
    await expect(cy).toContainText('—');
    expect(VERDICT_RE.test(await cy.innerText()), 'a row with no NIP-05 shows no status').toBe(false);
    await expect(cy.getByText('Checking…')).toHaveCount(0);
    const asked = state.checks.filter((c) => ['zed@ok.example', 'ava@bad.example', 'bea@down.example'].includes(c.nip05));
    expect(asked.map((c) => [c.nip05, c.pubkey]).sort()).toEqual([['ava@bad.example', A], ['bea@down.example', B], ['zed@ok.example', LOCAL]].sort());
    await noSockets(state);
  });

  test('N2: while a check is held — "Checking…", never a verdict, in the list and in the section', async ({ page }) => {
    const ava = deferred();
    const dee = deferred();
    const state = await setup(page, { nip05: { 'ava@bad.example': { hold: ava.promise, then: INVALID }, 'dee@dee.example': { hold: dee.promise, then: VERIFIED } } });
    await page.goto(PAGE);
    await settled(page, 4);
    await expect(section(page)).toBeVisible();
    const avaRow = rowNamed(page, 'Ava');
    const deeItem = sectionItem(page, 'Dee the Unclaimed');
    await expect(avaRow.getByText('Checking…', { exact: true })).toBeVisible();
    await expect(deeItem.getByText('Checking…', { exact: true })).toBeVisible();
    for (let i = 0; i < 5; i++) {
      expect(VERDICT_RE.test(await avaRow.innerText()), `sample ${i}: the list row claims no verdict while its check is held`).toBe(false);
      expect(VERDICT_RE.test(await deeItem.innerText()), `sample ${i}: the section claims no verdict while its check is held`).toBe(false);
      await page.waitForTimeout(100);
    }
    ava.resolve();
    dee.resolve();
    await expectStatus(avaRow, 'Not valid');
    await expectStatus(deeItem, 'Verified');
    await expect(avaRow.getByText('Checking…')).toHaveCount(0);
    await noSockets(state);
  });

  test('N3: a failed check (500, network abort, no status) reads Couldn\'t check, never Not valid — in the list and in the section', async ({ page }) => {
    const state = await setup(page, { nip05: { 'ava@bad.example': 'fail', 'bea@down.example': 'abort', 'zed@ok.example': { verified: false }, 'eve@eve.example': 'abort', 'dee@dee.example': 'fail' } });
    await page.goto(PAGE);
    await settled(page, 4);
    for (const name of ['Zed Local', 'Ava', 'Bea']) await expectStatus(rowNamed(page, name), "Couldn't check");
    for (const name of ['Dee the Unclaimed', 'Eve Elsewhere']) await expectStatus(sectionItem(page, name), "Couldn't check");
    for (let i = 0; i < 3; i++) {
      await expect(main(page).getByText(/^Not valid$/)).toHaveCount(0);
      await page.waitForTimeout(150);
    }
    await noSockets(state);
  });

  test('N4: the section — the status beside each NIP-05', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    await expectStatus(sectionItem(page, 'Dee the Unclaimed'), 'Verified');
    await expectStatus(sectionItem(page, 'Eve Elsewhere'), 'Not valid');
    await expect(sectionItem(page, 'Dee the Unclaimed')).toContainText(/dee@dee\.example\s*(✓\s*)?Verified/);
    const asked = state.checks.filter((c) => ['dee@dee.example', 'eve@eve.example'].includes(c.nip05)).map((c) => [c.nip05, c.pubkey]).sort();
    expect(asked).toEqual([['dee@dee.example', D], ['eve@eve.example', E]]);
    await noSockets(state);
  });

  test('N5: the search results show no status, and no check is asked for them', async ({ page }) => {
    const state = await setup(page, { search: { xa: [{ pubkey: X, display_name: 'Xavi', nip05: 'xavi@ex.example' }] } });
    await page.goto(PAGE);
    await settled(page, 4);
    await page.getByPlaceholder('Search by name, NIP-05, URL or npub').fill('xa');
    const results = page.getByRole('list', { name: 'Profiles you can tag' });
    await expect(results.getByText('Xavi', { exact: true })).toBeVisible();
    await expect(results).toContainText('xavi@ex.example');
    await page.waitForTimeout(500);
    expect(VERDICT_RE.test(await results.innerText()), 'no status in the search results').toBe(false);
    await expect(results.getByText('Checking…')).toHaveCount(0);
    expect(state.checks.filter((c) => c.nip05 === 'xavi@ex.example')).toEqual([]);
    await noSockets(state);
  });

  test('N6: a refresh after a press, or a tab round trip, asks no definite answer again', async ({ page }) => {
    const state = await setup(page, {
      answers: [answerOf(BASE_ROWS), answerOf([...BASE_ROWS, rowOf(X, ['tapestry'])])],
      search: { xa: [{ pubkey: X, display_name: 'Xavi', nip05: 'xavi@ex.example' }] },
    });
    await page.goto(PAGE);
    await settled(page, 4);
    await expectStatus(rowNamed(page, 'Zed Local'), 'Verified');
    await expectStatus(rowNamed(page, 'Ava'), 'Not valid');
    await page.getByPlaceholder('Search by name, NIP-05, URL or npub').fill('xa');
    await page.getByRole('list', { name: 'Profiles you can tag' }).getByRole('button', { name: 'Tag: My Tapestry Assistant' }).click();
    await settled(page, 5);
    await expectStatus(rowNamed(page, 'Xavi'), 'Verified');
    // Leaving the tab and coming back draws every row and the section again; a definite answer is not asked twice.
    await tab(page, 'Duties').click();
    await tab(page, 'Assistants').click();
    await expectStatus(rowNamed(page, 'Ava'), 'Not valid');
    await expectStatus(sectionItem(page, 'Dee the Unclaimed'), 'Verified');
    for (const id of ['zed@ok.example', 'ava@bad.example', 'dee@dee.example', 'eve@eve.example', 'xavi@ex.example']) {
      expect(state.checks.filter((c) => c.nip05 === id).length, `${id} is checked once`).toBe(1);
    }
    await noSockets(state);
  });

  test('P1: an open row\'s View profile link — /user/<pubkey>, a new tab, its name; it opens the profile and leaves the row open', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    for (const [name, pk] of [['Ava', A], ['Zed Local', LOCAL]]) {
      const row = rowNamed(page, name);
      await toggle(row).click();
      const link = row.getByRole('link', { name: `View profile of ${name} (opens in a new tab)` });
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/^View profile\s*↗?$/);
      await expect(link).toHaveAttribute('href', `/user/${pk}`);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(row.locator('[aria-expanded] a')).toHaveCount(0);
    }
    const ava = rowNamed(page, 'Ava');
    await toggle(ava).click();
    await expect(toggle(ava)).toHaveAttribute('aria-expanded', 'true');
    const [profile] = await Promise.all([
      page.context().waitForEvent('page'),
      ava.getByRole('link', { name: 'View profile of Ava (opens in a new tab)' }).click(),
    ]);
    await profile.waitForLoadState();
    expect(new URL(profile.url()).pathname).toBe(`/user/${A}`);
    await expect(toggle(ava)).toHaveAttribute('aria-expanded', 'true');
    await profile.close();
    await noSockets(state);
  });

  test('P2: the section — a View profile link for each Assistant', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    for (const [name, pk] of [['Dee the Unclaimed', D], ['Eve Elsewhere', E]]) {
      const link = section(page).getByRole('link', { name: `View profile of ${name} (opens in a new tab)` });
      await expect(link).toHaveAttribute('href', `/user/${pk}`);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
    }
    await noSockets(state);
  });

  test('P3: an open duty — a View profile link for the Preferred and for every Alternate', async ({ page }) => {
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    await tab(page, 'Duties').click();
    const duties = page.getByRole('list', { name: 'Duties on your Treasure Map' }).locator(':scope > li, :scope > [role="listitem"]');
    const rank = duties.filter({ hasText: '30382:rank' });
    await rank.locator('[aria-expanded]').first().click();
    for (const [name, pk] of [['Ava', A], ['Bea', B], ['Dee the Unclaimed', D]]) {
      const link = rank.getByRole('link', { name: `View profile of ${name} (opens in a new tab)` });
      await expect(link).toHaveAttribute('href', `/user/${pk}`);
      await expect(link).toHaveAttribute('target', '_blank');
    }
    await expect(rank.locator('[aria-expanded] a')).toHaveCount(0);
    await noSockets(state);
  });

  test('P4: at 375 px, statuses and links don\'t scroll sideways or cut anything off', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const state = await setup(page);
    await page.goto(PAGE);
    await settled(page, 4);
    await expectStatus(rowNamed(page, 'Bea'), "Couldn't check");
    await toggle(rowNamed(page, 'Ava')).click();
    await expect(section(page)).toBeVisible();
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(m.scroll, `the page is ${m.scroll}px wide in ${m.width}px`).toBeLessThanOrEqual(m.width);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('main *')]
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== 'auto')
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}: ${el.scrollWidth} > ${el.clientWidth}`));
    expect(clipped, 'nothing cut off').toEqual([]);
    await noSockets(state);
  });
});
