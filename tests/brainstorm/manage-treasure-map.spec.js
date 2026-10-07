const { test, expect } = require('@playwright/test');

/**
 * manage-treasure-map #1 — the Manage your Treasure Map page, its menu links, and the Advanced placeholder. What a
 * viewer SEES.
 *
 * Story: engineering-team/stories/manage-treasure-map/1-the-manage-your-treasure-map-page.md
 * ADR:   engineering-team/decisions/manage-treasure-map/0001-a-design-page-on-the-shared-strict-map-read.md
 * Plan:  engineering-team/stories/manage-treasure-map/1-the-manage-your-treasure-map-page.test-plan.md
 * Node half: test/manage-treasure-map-page.test.js (the menu targets, the words, the panel's phases, the raw text).
 *
 * The Treasure Map is read as the shared hook reads it (ADR 0001, after ADR my-assistants/0003): local strfry first
 * (/api/strfry/scan, kinds [10040]), then — on a local miss — the general-purpose relays (their list from a read-only
 * POST /api/neo4j/query) through /api/relay/external, which must carry strict=1. Each is mocked per test.
 *
 * SAFETY: every WebSocket is blocked and counted (the count must end at 0); window.nostr is a stub whose signEvent is
 * counted (it must never be called); every non-GET request other than the read-only Cypher POST is recorded (there
 * must be none).
 *
 *   T1 — the page: under the Brainstorm top bar; kicker, heading, introduction; no Edit, no Save changes.   [AC-2]
 *   T2 — the FAQ: closed; four questions in order; one answer at a time; closes again.                       [AC-3]
 *   T3 — found locally: the raw viewer is closed, labelled, with the kind 10040 chip; open, it shows the whole event
 *        as indented JSON; its label flips; it closes again; the read asked for the viewer's 10040 only.  [AC-4]
 *   T4 — none: a local miss and a strict relay read that reached a relay and found nothing.                  [AC-4]
 *   T5 — can't read: a local miss and a strict read that reached no relay → the error line and Try again, never the
 *        none box; Try again reads again and the Map appears.                                                 [AC-4]
 *   T5b — no general-purpose relay to ask, and a local miss: can't read, never none.                         [AC-4]
 *   T6 — still reading: the loading line, never the none box, no JSON; then the Map.                          [AC-4]
 *   T7 — whose Map: a relay answering with someone else's 10040 shows none, never theirs.                     [AC-4]
 *   T8 — signed out: heading, introduction, FAQ, the Advanced line, and the sign-in line and button in place of
 *        the raw viewer; no Treasure Map is read.                                                            [AC-6]
 *   T9 — Advanced management: the line and link; the placeholder (back link, kicker, heading, placeholder line,
 *        the TA Treasure Map link); it reads no Treasure Map; the back link returns.                          [AC-5]
 *   T10 — direct loads and refreshes of both addresses render the pages, never "Page not found".     [AC-2, AC-5]
 *   T11 — the menus: the landing page's and the Brainstorm top bar's My Treasure Map open /treasure-map; the
 *         Tapestry header's still opens the TA Treasure Map page.                                             [AC-1]
 *   T12 — at 375 px, with a long tag line open in the raw viewer, the page doesn't scroll sideways.           [AC-2]
 *   T13 — nothing on either page signs, publishes, or opens a socket.                                         [AC-6]
 */

const VIEWER = 'a1'.repeat(32);
const LOCAL = 'a2'.repeat(32);
const OTHER = 'b9'.repeat(32);
const A = 'c1'.repeat(32);
const B = 'c2'.repeat(32);
const R = 'wss://relay.example';

const NEW_PAGE = '/treasure-map';
const ADVANCED_PAGE = '/treasure-map/advanced';
const TA_PAGE = '/tapestry/grapevine/treasure-map';

const APOS = '[\'’]';
const re = (s) => new RegExp(s.replace(/'/g, APOS));
const WORDS = {
  intro: re("Your Treasure Map tells other apps where to find the insights your Assistant gathers from your trusted community — who to trust, what's worth your attention, and how your community organizes ideas\\. Brainstorm keeps it up to date for you\\."),
  faqs: [
    ['What is a Treasure Map?', 'A public record that points other nostr apps to the insights your Assistant calculates for you, so every app you use can benefit from your trusted community.'],
    ['Do I need to do anything?', 'Not usually. Brainstorm creates your Treasure Map during setup and keeps it current. You only need to sign again when something important changes.'],
    ['Who can see it?', 'Anyone. It’s published to relays like any other nostr event, so any app can read it.'],
    ['What’s on the Advanced page?', 'Every individual entry in your Treasure Map — scores, lists, and concepts — along with which Assistant provides each one. Most people never need it.'],
  ],
  noneTitle: 'No Treasure Map found',
  noneLine: re("We couldn't locate a kind 10040 event for your profile on your relays\\."),
  loading: 'Loading your Treasure Map…',
  error: re("Couldn't read your Treasure Map\\."),
  signedOut: 'Sign in to see your Treasure Map.',
  placeholder: /This page is coming soon\. It will list every entry on your Treasure Map, and which Assistant provides each one\. Until then, the TA Treasure Map page shows every entry\./,
};

const MAP = {
  id: '9'.repeat(64), pubkey: VIEWER, created_at: 1790121600, kind: 10040, content: '',
  tags: [
    ['30382:rank', A, R],
    ['30392', B, R],
    ['39998:dlist-header', A, R],
    ['30382:followers', B, R],
  ],
  sig: 'f'.repeat(128),
};
const SOMEONE_ELSES = { ...MAP, id: '8'.repeat(64), pubkey: OTHER, tags: [['30382:rank', OTHER, R]] };

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

/**
 * Mock everything the pages and their frames ask for.
 *   signedIn     — a signed-in Customer with an Assistant here (default) or a signed-out visitor
 *   mapLocal     — the event local strfry holds for the viewer (or null)
 *   mapHold      — a promise the local read waits on
 *   relayAnswers — /api/relay/external's answers in order (the last repeats)
 *   relayList    — the general-purpose relays' websocket URLs
 */
async function setup(page, { signedIn = true, mapLocal = MAP, mapHold = null, relayAnswers = [{ success: true, events: [] }], relayList = ['wss://one.example'] } = {}) {
  const state = { ws: 0, writes: [], mapFilters: [], relayUrls: [] };
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
    if (p === '/api/auth/login' || p === '/api/auth/verify' || p === '/api/auth/challenge') return;
    state.writes.push(`${req.method()} ${p}`);
  });
  await page.route('**/api/strfry/scan**', async (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.kinds) && filter.kinds.includes(10040)) {
      state.mapFilters.push(filter);
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
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: '2'.repeat(64) }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: '1'.repeat(64) }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, signedIn
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, signedIn
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/auth/status', (r) => json(r, signedIn ? { authenticated: true, pubkey: VIEWER } : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: signedIn ? 'customer' : 'unauthenticated',
    pubkey: signedIn ? VIEWER : null,
    assistantPubkey: signedIn ? LOCAL : null,
  }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/search/profiles/meili**', (r) => json(r, { success: true, hits: [] }));
  return state;
}

const main = (page) => page.locator('main');
const heading = (page) => page.getByRole('heading', { level: 1, name: 'Manage your Treasure Map.' });
const advancedHeading = (page) => page.getByRole('heading', { level: 1, name: 'Advanced Treasure Map management.' });
const faqButton = (page) => main(page).getByRole('button', { name: 'Frequently asked questions' });
const rawButton = (page) => main(page).getByRole('button', { name: /^(View|Hide) the raw Treasure Map/ });
const pre = (page) => main(page).locator('pre');
/**
 * The raw viewer's own box: the innermost element holding its button. Its state lines are scoped here because, since
 * manage-treasure-map #2, the Assistants by category section shows the same loading and error lines (and its own Try
 * again) above it; page-wide queries would match both (re-aimed by manage-treasure-map #2, Implementation).
 */
const rawBox = (page) => main(page).locator('div').filter({ has: page.getByRole('button', { name: /^(View|Hide) the raw Treasure Map/ }) }).last();
async function openRaw(page) {
  await expect(rawButton(page)).toHaveAttribute('aria-expanded', 'false');
  await rawButton(page).click();
  await expect(rawButton(page)).toHaveAttribute('aria-expanded', 'true');
}
async function safe(page, state) {
  expect(state.ws, 'no WebSocket may be opened').toBe(0);
  expect(state.writes, 'the page only reads').toEqual([]);
  expect(await page.evaluate(() => window.__signCalls), 'nothing is signed').toBe(0);
}

test.describe('/treasure-map — Manage your Treasure Map', () => {
  test('T1: under the Brainstorm top bar — kicker, heading, introduction; no Edit, no Save changes', async ({ page }) => {
    const state = await setup(page);
    await page.goto(NEW_PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Brainstorm home' })).toBeVisible();
    await expect(page.locator('.bsd-eyebrow').first()).toHaveText(/^\s*Treasure Map\s*$/);
    await expect(main(page).getByText(WORDS.intro)).toBeVisible();
    await expect(heading(page).locator('.bsd-title-accent')).toHaveText('Treasure Map');
    for (const name of [/^Edit(ing)?$/, /^Save changes$/, /^Assign to all/, /^Choose an Assistant/]) {
      await expect(main(page).getByRole('button', { name })).toHaveCount(0);
    }
    await safe(page, state);
  });

  test('T2: the FAQ is closed at first, lists the four questions in order, shows one answer at a time, and closes again', async ({ page }) => {
    await setup(page);
    await page.goto(NEW_PAGE);
    await expect(faqButton(page)).toHaveAttribute('aria-expanded', 'false');
    for (const [q] of WORDS.faqs) await expect(main(page).getByRole('button', { name: q })).toHaveCount(0);
    await faqButton(page).click();
    await expect(faqButton(page)).toHaveAttribute('aria-expanded', 'true');
    const qs = WORDS.faqs.map(([q]) => main(page).getByRole('button', { name: q, exact: true }));
    for (const q of qs) { await expect(q).toBeVisible(); await expect(q).toHaveAttribute('aria-expanded', 'false'); }
    const tops = [];
    for (const q of qs) tops.push((await q.boundingBox()).y);
    expect(tops, 'the four questions in the story’s order').toEqual([...tops].sort((x, y) => x - y));
    for (const [, a] of WORDS.faqs) await expect(main(page).getByText(a, { exact: true })).toHaveCount(0);

    await qs[0].click();
    await expect(main(page).getByText(WORDS.faqs[0][1], { exact: true })).toBeVisible();
    await qs[1].click();
    await expect(main(page).getByText(WORDS.faqs[1][1], { exact: true })).toBeVisible();
    await expect(main(page).getByText(WORDS.faqs[0][1], { exact: true }), 'one answer at a time').toHaveCount(0);
    await expect(qs[1]).toHaveAttribute('aria-expanded', 'true');
    await expect(qs[0]).toHaveAttribute('aria-expanded', 'false');
    await qs[1].click();
    await expect(main(page).getByText(WORDS.faqs[1][1], { exact: true })).toHaveCount(0);
    await qs[3].click();
    await expect(main(page).getByText(WORDS.faqs[3][1], { exact: true })).toBeVisible();

    await faqButton(page).click();
    await expect(faqButton(page)).toHaveAttribute('aria-expanded', 'false');
    for (const [q] of WORDS.faqs) await expect(main(page).getByRole('button', { name: q, exact: true })).toHaveCount(0);
  });

  test('T3: found — the raw viewer opens on the whole event as indented JSON, its label flips, and it closes; only the viewer’s 10040 is asked for', async ({ page }) => {
    const state = await setup(page);
    await page.goto(NEW_PAGE);
    await expect(rawButton(page)).toHaveAccessibleName(/^View the raw Treasure Map/);
    await expect(rawButton(page)).toContainText('kind 10040');
    await expect(pre(page)).toHaveCount(0);
    await openRaw(page);
    await expect(rawButton(page)).toHaveAccessibleName(/^Hide the raw Treasure Map/);
    await expect(pre(page)).toBeVisible();
    const text = await pre(page).textContent();
    expect(JSON.parse(text), 'the event as found, every field, tags in the Map’s order').toEqual(MAP);
    expect(text, 'indented').toContain('\n  "');
    await expect(main(page).getByText(WORDS.noneTitle)).toHaveCount(0);
    await rawButton(page).click();
    await expect(rawButton(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(pre(page)).toHaveCount(0);
    expect(state.mapFilters.length, 'the Map was read').toBeGreaterThan(0);
    for (const f of state.mapFilters) expect(f.authors, 'only the viewer’s own Treasure Map is asked for').toEqual([VIEWER]);
    await safe(page, state);
  });

  test('T4: none — a local miss and a strict relay read that reached a relay and held nothing', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayAnswers: [{ success: true, events: [] }] });
    await page.goto(NEW_PAGE);
    await openRaw(page);
    await expect(main(page).getByText(WORDS.noneTitle, { exact: true })).toBeVisible();
    await expect(main(page).getByText(WORDS.noneLine)).toBeVisible();
    await expect(pre(page)).toHaveCount(0);
    await expect(main(page).getByText(WORDS.error)).toHaveCount(0);
    expect(state.relayUrls.length, 'the relays were asked').toBeGreaterThan(0);
    for (const u of state.relayUrls) expect(new URL(u).searchParams.get('strict'), 'the relay read is strict').toBe('1');
  });

  test('T5: can’t read — the error line and Try again, never the none box; Try again reads again and the Map appears', async ({ page }) => {
    const state = await setup(page, {
      mapLocal: null,
      relayAnswers: [{ success: false, error: 'no relay reached' }, { success: true, events: [MAP] }],
    });
    await page.goto(NEW_PAGE);
    await openRaw(page);
    await expect(rawBox(page).getByText(WORDS.error)).toBeVisible();
    await expect(rawBox(page).getByRole('alert')).toContainText(WORDS.error);
    await expect(main(page).getByText(WORDS.noneTitle)).toHaveCount(0);
    await expect(pre(page)).toHaveCount(0);
    const asked = state.relayUrls.length;
    await rawBox(page).getByRole('button', { name: 'Try again' }).click();
    await expect(pre(page)).toBeVisible();
    expect(JSON.parse(await pre(page).textContent())).toEqual(MAP);
    expect(state.relayUrls.length, 'Try again read again').toBeGreaterThan(asked);
    await expect(rawBox(page).getByText(WORDS.error)).toHaveCount(0);
  });

  test('T5b: no general-purpose relay to ask and a local miss — can’t read, never none', async ({ page }) => {
    await setup(page, { mapLocal: null, relayList: [] });
    await page.goto(NEW_PAGE);
    await openRaw(page);
    await expect(rawBox(page).getByText(WORDS.error)).toBeVisible();
    await expect(main(page).getByText(WORDS.noneTitle)).toHaveCount(0);
  });

  test('T6: still reading — the loading line, never the none box and no JSON; then the Map', async ({ page }) => {
    const hold = deferred();
    await setup(page, { mapHold: hold.promise });
    await page.goto(NEW_PAGE);
    await openRaw(page);
    await expect(rawBox(page).getByText(WORDS.loading, { exact: true })).toBeVisible();
    await expect(rawBox(page).getByRole('status')).toContainText(WORDS.loading);
    await expect(main(page).getByText(WORDS.noneTitle)).toHaveCount(0);
    await expect(pre(page)).toHaveCount(0);
    hold.resolve();
    await expect(pre(page)).toBeVisible();
    await expect(rawBox(page).getByText(WORDS.loading, { exact: true })).toHaveCount(0);
  });

  test('T7: whose Map — a relay answering with someone else’s 10040 shows none, never theirs', async ({ page }) => {
    await setup(page, { mapLocal: null, relayAnswers: [{ success: true, events: [SOMEONE_ELSES] }] });
    await page.goto(NEW_PAGE);
    await openRaw(page);
    await expect(main(page).getByText(WORDS.noneTitle, { exact: true })).toBeVisible();
    await expect(pre(page)).toHaveCount(0);
    await expect(main(page)).not.toContainText(OTHER);
  });

  test('T8: signed out — the heading, introduction, FAQ and Advanced line, the sign-in line and button in place of the raw viewer; no Map is read', async ({ page }) => {
    const state = await setup(page, { signedIn: false });
    await page.goto(NEW_PAGE);
    await expect(heading(page)).toBeVisible();
    await expect(main(page).getByText(WORDS.intro)).toBeVisible();
    await expect(faqButton(page)).toBeVisible();
    await expect(main(page).getByText(WORDS.signedOut, { exact: true })).toBeVisible();
    await expect(main(page).getByRole('button', { name: 'Sign in with nostr' })).toBeVisible();
    await expect(rawButton(page)).toHaveCount(0);
    await expect(pre(page)).toHaveCount(0);
    await expect(main(page).getByRole('link', { name: /Advanced management/ })).toBeVisible();
    expect(state.mapFilters, 'nobody’s Treasure Map is read for a signed-out visitor').toEqual([]);
    await safe(page, state);
  });

  test('T9: Advanced management opens the placeholder — back link, kicker, heading, placeholder line, the TA Treasure Map link; it reads no Map', async ({ page }) => {
    const state = await setup(page);
    await page.goto(NEW_PAGE);
    await expect(main(page).getByText('Need fine-grained control over every entry?', { exact: true })).toBeVisible();
    const adv = main(page).getByRole('link', { name: /Advanced management/ });
    await expect(adv).toHaveAttribute('href', ADVANCED_PAGE);
    await adv.click();
    await expect(page).toHaveURL(/\/treasure-map\/advanced$/);
    await expect(advancedHeading(page)).toBeVisible();
    await expect(advancedHeading(page).locator('.bsd-title-accent')).toHaveText('Treasure Map');
    await expect(page.locator('.bsd-eyebrow').first()).toHaveText(/^\s*Treasure Map · Advanced\s*$/);
    await expect(main(page)).toContainText(WORDS.placeholder);
    await expect(main(page).getByRole('link', { name: 'TA Treasure Map', exact: true })).toHaveAttribute('href', TA_PAGE);
    const back = main(page).getByRole('link', { name: /Manage your Treasure Map/ });
    await expect(back).toHaveAttribute('href', NEW_PAGE);

    state.mapFilters.length = 0;
    await page.reload();
    await expect(advancedHeading(page)).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(state.mapFilters, 'the placeholder reads no Treasure Map').toEqual([]);

    await main(page).getByRole('link', { name: /Manage your Treasure Map/ }).click();
    await expect(page).toHaveURL(/\/treasure-map$/);
    await expect(heading(page)).toBeVisible();
    await safe(page, state);
  });

  test('T10: typed in or refreshed, both addresses render their pages — never "Page not found"', async ({ page }) => {
    await setup(page);
    for (const [addr, h] of [[NEW_PAGE, heading], [ADVANCED_PAGE, advancedHeading]]) {
      const res = await page.goto(addr);
      expect(res.status(), `${addr} is served`).toBe(200);
      await expect(h(page)).toBeVisible();
      await page.reload();
      await expect(h(page)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
    }
  });

  test('T11a: the landing page’s and the Brainstorm top bar’s My Treasure Map open /treasure-map', async ({ page }) => {
    await setup(page);
    for (const from of ['/', '/assistants', '/dictionary']) {
      await page.goto(from);
      await page.locator('.bs-usermenu-avatar-btn').first().click();
      const item = page.locator('.bs-usermenu-dropdown .bs-usermenu-link').filter({ hasText: /My Treasure Map$/ });
      await expect(item, `${from}: one My Treasure Map item`).toHaveCount(1);
      await expect(item).toHaveAttribute('href', NEW_PAGE);
      await item.click();
      await expect(page).toHaveURL(/\/treasure-map$/);
      await expect(heading(page)).toBeVisible();
    }
  });

  test('T11b: the Tapestry header’s My Treasure Map still opens the TA Treasure Map page', async ({ page }) => {
    await setup(page);
    await page.goto('/tapestry/about');
    await page.locator('.header-user .user-button').click();
    const item = page.locator('.user-dropdown .dropdown-item').filter({ hasText: /My Treasure Map$/ });
    await expect(item).toHaveCount(1);
    await item.click();
    await expect(page).toHaveURL(/\/tapestry\/grapevine\/treasure-map$/);
  });

  test('T12: at 375 px, with a long tag line open in the raw viewer, the page doesn’t scroll sideways', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const long = { ...MAP, tags: [...MAP.tags, [`30396:tag:${'naddr1'.padEnd(120, 'q')}:${'x'.repeat(60)}`, A, `wss://${'r'.repeat(80)}.example`]] };
    await setup(page, { mapLocal: long });
    await page.goto(NEW_PAGE);
    await faqButton(page).click();
    await main(page).getByRole('button', { name: WORDS.faqs[3][0], exact: true }).click();
    await openRaw(page);
    await expect(pre(page)).toBeVisible();
    const m = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(m.scroll, `the page is ${m.scroll}px wide in a ${m.width}px viewport`).toBeLessThanOrEqual(m.width);
    const box = await pre(page).boundingBox();
    expect(box.x + box.width, 'the raw viewer ends inside the viewport (it scrolls in its own box)').toBeLessThanOrEqual(375.5);
    await page.goto(ADVANCED_PAGE);
    await expect(advancedHeading(page)).toBeVisible();
    const n = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, width: window.innerWidth }));
    expect(n.scroll, `the placeholder is ${n.scroll}px wide in a ${n.width}px viewport`).toBeLessThanOrEqual(n.width);
  });

  test('T13: across every state, nothing is signed or published and no socket opens', async ({ page }) => {
    const state = await setup(page, { mapLocal: null, relayAnswers: [{ success: false, error: 'x' }, { success: true, events: [MAP] }] });
    await page.goto(NEW_PAGE);
    await faqButton(page).click();
    await openRaw(page);
    await rawBox(page).getByRole('button', { name: 'Try again' }).click();
    await expect(pre(page)).toBeVisible();
    await main(page).getByRole('link', { name: /Advanced management/ }).click();
    await expect(advancedHeading(page)).toBeVisible();
    await safe(page, state);
  });
});
