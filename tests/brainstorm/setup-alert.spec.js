const { test, expect } = require('@playwright/test');

/**
 * setup-status-and-alert #2: the Setup Alert — the browser class.
 *
 * Story: engineering-team/stories/setup-status-and-alert/2-the-setup-alert.md
 * ADR:   engineering-team/decisions/setup-status-and-alert/0002-the-setup-alert-pill.md
 * Node half: test/setup-alert.test.js (C/D/S).
 *
 *   B0  — the served origin runs a build that contains the pill.                      [prerequisite]
 *   B1  — the pill sits in the top bar beside the avatar menu on every host.          [AC-1]
 *   B2  — a click, and Tab then Enter, open /setup.                                    [AC-1]
 *   B3  — "· 1 step left" / "· 3 steps left".                                          [AC-1]
 *   B4  — no pill while checking, on failure, with nothing left, with only an
 *         "another provider" step, or with unfinished checks; step 1 open beside two
 *         unfinished checks counts alone.                                              [AC-2]
 *   B5  — no pill signed out, none on /setup and its step pages, and no close button. [AC-3]
 *   B6  — the pill's N is the steps /setup shows as not done, less an "another
 *         provider" step (so never more), and both read one answer.                   [AC-4]
 *   B7  — sentence and count at 1280, the sentence at 800, only ⚠ + button at 375, the
 *         same accessible name, and no top bar wider than the screen, on every host.  [AC-5]
 *   B8  — pages showing the pill only read (GETs; the Dashboard's Cypher reads over POST)
 *         and sign nothing.                                                            [AC-6]
 *   B9  — creating an assistant on /assistant updates the pill without a reload.      [ADR 0002 Decision 5]
 *   B10 — the results view carries the pill too (wide screens).                       [AC-1]
 *   B11 — the phone accommodations apply only while a pill is showing.                [ADR 0002 § 4]
 *   B12 — the control panel header keeps its height and never scrolls with the pill:
 *         its brand yields room instead of wrapping.                                   [ADR 0002 Amendment 1]
 *
 * Hermetic: an /api/** catch-all is registered FIRST (the :4173 preview proxies /api to the live
 * :7778 stack — OPEN.md row 2026-09-21-vite-preview-proxies-live-stack), then per-scenario routes.
 *
 * Prerequisites: BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test
 * (`cd ui && npm run build && npx vite preview --port 4173 --strictPort`).
 *
 * These FAIL against the current build: there is no pill anywhere.
 */

const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TA = 'ee'.repeat(32);
const NAME = 'Finish setting up your account';
const BUTTON = 'Finish setup →';
const OTHER_PROVIDER = 'Your Treasure Map names another provider for your scores.'; // story 1 § Copy
const countText = (n) => (n === 1 ? '· 1 step left' : `· ${n} steps left`);
// The write keywords src/api/neo4j/queryPost.js:17 routes to a write session. The control panel's
// Dashboard reads the graph with POST /api/neo4j/query (Dashboard.jsx:125–138); those are reads.
const WRITE_CYPHER = /\b(CREATE|MERGE|DELETE|SET|REMOVE|DETACH|DROP|CALL\s*\{)\b/i;
const isCypherRead = (r) => r.method === 'POST' && r.path === '/api/neo4j/query' && typeof r.cypher === 'string' && !WRITE_CYPHER.test(r.cypher);

const CUSTOMER = { pubkey: VIEWER, classification: 'customer', assistantPubkey: ASSISTANT };
const OWNER = { pubkey: VIEWER, classification: 'owner', assistantPubkey: TA };
const NO_ASSISTANT = { pubkey: VIEWER, classification: 'customer', assistantPubkey: null };

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const step = (done, pending, extra = {}) => ({ done, pending, finished: true, ...extra });
const answer = (account, follow, activate) => ({ success: true, signedIn: true, steps: { account, follow, activate } });

const THREE_LEFT = answer(step(false, true), step(false, true, { followCount: 0, source: null }), step(false, true, { otherProvider: false, source: null }));
const TWO_LEFT = answer(step(false, true), step(true, false, { followCount: 5, source: 'local' }), step(false, true, { otherProvider: false, source: null }));
const ONE_LEFT = answer(step(true, false), step(true, false, { followCount: 5, source: 'local' }), step(false, true, { otherProvider: false, source: null }));
const NONE_LEFT = answer(step(true, false), step(true, false, { followCount: 5, source: 'local' }), step(true, false, { otherProvider: false, source: 'local' }));
const OTHER_ONLY = answer(step(true, false), step(true, false, { followCount: 5, source: 'local' }), step(false, false, { otherProvider: true, source: 'relay' }));
const UNFINISHED = answer(step(true, false),
  { done: false, pending: false, finished: false, reason: 'outside-unreachable', source: null },
  { done: false, pending: false, finished: false, reason: 'local-unreadable', otherProvider: false, source: null });
const ACCOUNT_AND_OTHER = answer(step(false, true), step(true, false, { followCount: 5, source: 'local' }), step(false, false, { otherProvider: true, source: 'relay' }));
const ACCOUNT_OPEN_REST_UNFINISHED = answer(step(false, true),
  { done: false, pending: false, finished: false, reason: 'outside-unreachable', source: null },
  { done: false, pending: false, finished: false, reason: 'outside-unreachable', otherProvider: false, source: null });

/**
 * Mock every route. `who` is null (signed out) or a user; `answers` are the /api/setup/status answers
 * in order (the last one repeats); an entry may be 'hang' (never answered) or 'error' (a 500).
 * /assistant's create flow is mocked too: POST /api/assistant/provision-key gives the viewer an
 * assistant, which /api/auth/user-classification and /api/assistant/status then report.
 * `signer: true` adds a recording NIP-07 signer (window.__signer). `name` is the viewer's display name.
 */
async function mock(page, { who = CUSTOMER, answers = [TWO_LEFT], signer = false, name = 'Fixture Viewer' } = {}) {
  const state = { assistant: who ? who.assistantPubkey : null, statusCalls: 0, nonGet: [] };
  page.on('request', (req) => {
    if (req.method() === 'GET') return;
    let cypher = null;
    try { cypher = JSON.parse(req.postData() || '{}').cypher || null; } catch { /* not JSON */ }
    state.nonGet.push({ method: req.method(), path: new URL(req.url()).pathname, cypher });
  });
  const queue = answers.slice();
  if (signer) {
    // A NIP-07 signer that records every call, so B8 can show nothing was signed (AC-6).
    await page.addInitScript((pk) => {
      window.__signer = [];
      window.nostr = {
        getPublicKey: async () => { window.__signer.push('getPublicKey'); return pk; },
        signEvent: async (e) => { window.__signer.push(`signEvent:${e.kind}`); return { ...e, id: '0'.repeat(64), sig: '0'.repeat(128) }; },
      };
    }, who ? who.pubkey : VIEWER);
  }

  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by setup-alert.spec.js' })));
  await page.route('**/api/neo4j/query', (r) => r.fulfill(json({ success: true, data: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: { [VIEWER]: { name } } })));
  await page.route('**/api/search/profiles/meili**', (r) => r.fulfill(json({
    success: true, hits: [{ pubkey: 'b2'.repeat(32), name: 'jack', display_name: 'Jack' }], estimatedTotalHits: 1,
  })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who
    ? { authenticated: true, pubkey: who.pubkey }
    : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: state.assistant }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(state.assistant
    ? { success: true, hasRelayKey: true, assistantPubkey: state.assistant, hasProfile: false, profile: null, profileSource: null, isOwner: false, defaults: { name: 'Fixture Assistant', display_name: 'Fixture Assistant', about: '', picture: '', banner: '', website: '', nip05: '', lud16: '' } }
    : { success: true, hasRelayKey: false, assistantPubkey: null, hasProfile: false, profile: null, profileSource: null, isOwner: false, defaults: {} })));
  await page.route('**/api/assistant/provision-key', (r) => {
    state.assistant = ASSISTANT;
    return r.fulfill(json({ success: true, assistantPubkey: ASSISTANT }));
  });
  await page.route('**/api/setup/status**', async (r) => {
    state.statusCalls += 1;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === 'hang') return new Promise(() => {});
    if (next === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    return r.fulfill(json(next));
  });
  return state;
}

async function open(page, path) {
  await page.goto(path);
  await page.waitForTimeout(2000);
}

const pill = (page) => page.getByRole('link', { name: NAME });
const bar = (page) => page.locator('.bsp-top-bar, .app-header, .bs-results-header').first();

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — run `cd ui && npm run build`.' };
  const seen = new Set();
  while (queue.length && seen.size < 400) {
    const asset = queue.shift();
    if (seen.has(asset)) continue;
    seen.add(asset);
    const res = await request.get(asset);
    if (!res.ok()) continue;
    const js = await res.text();
    if (js.includes(needle)) return { found: true };
    for (const m of js.matchAll(/["'(](\.{0,2}\/?(?:assets\/)?[\w.-]+\.js)["')]/g)) {
      const ref = m[1];
      const resolved = ref.startsWith('assets/') ? `/${ref}` : new URL(ref, new URL(asset, 'http://origin')).pathname;
      if (!seen.has(resolved)) queue.push(resolved);
    }
  }
  return { found: false, why: `searched ${seen.size} JS chunks` };
}

// Every host the ADR mounts the pill in: [label, path, who, the avatar locator or null for DevPage].
const HOSTS = [
  ['a TopBar page (/tags)', '/tags', CUSTOMER, '.bs-usermenu-avatar-btn'],
  ['the landing page (/)', '/', CUSTOMER, '.bs-usermenu-avatar-btn'],
  ['an own top bar (/about)', '/about', CUSTOMER, '.bs-usermenu-avatar-btn'],
  ['the developer pages (/developers)', '/developers', CUSTOMER, null],
  ['the control panel (/tapestry/, Owner)', '/tapestry/', OWNER, '.user-button'],
  // Re-aimed by assistant-management #1 (ADR assistant-management/0001): the editor moved from /assistant.
  ['the Edit Assistant Profile page (/assistant/profile/edit)', '/assistant/profile/edit', CUSTOMER, '.bs-usermenu-avatar-btn'],
];

test.describe('The Setup Alert (setup-status-and-alert #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 ───────── */
  test('B0: the served origin runs a build that contains the pill', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'bs-setup-alert');
    expect(found, `the bundle served by ${baseURL} does not contain "bs-setup-alert" (${why}). Rebuild the UI (\`cd ui && npm run build\`) — or the pill is not implemented.`).toBe(true);
  });

  /* ───────── B1 — every host, beside the avatar menu ───────── */
  for (const [label, path, who, avatarSel] of HOSTS) {
    test(`B1: on ${label}, a signed-in viewer with two steps left sees the pill in the top bar beside the avatar menu (AC-1)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { who, answers: [TWO_LEFT] });
      await open(page, path);
      await expect(bar(page), 'the page renders its top bar').toBeVisible();
      if (avatarSel) await expect(bar(page).locator(avatarSel).first(), `the avatar menu (${avatarSel}) renders: the viewer is signed in`).toBeVisible();
      const p = bar(page).getByRole('link', { name: NAME });
      await expect(p, 'the pill must be in the top bar').toBeVisible();
      await expect(p).toContainText('Finish setting up your account');
      await expect(p).toContainText('· 2 steps left');
      await expect(p).toContainText(BUTTON);
      if (avatarSel) {
        const pb = await p.boundingBox();
        const ab = await bar(page).locator(avatarSel).first().boundingBox();
        expect(ab, `the avatar menu (${avatarSel}) must be in the top bar`).not.toBeNull();
        expect(pb.x + pb.width, 'the pill sits beside the avatar menu, before it').toBeLessThanOrEqual(ab.x + 1);
        expect(Math.abs((pb.y + pb.height / 2) - (ab.y + ab.height / 2)), 'the pill and the avatar share the bar\'s line').toBeLessThan(ab.height);
      } else {
        await expect(page.locator('.bsp-top-bar .bsp-auth').getByRole('link', { name: NAME }), 'on the developer pages the pill fills the empty auth slot').toBeVisible();
      }
    });
  }

  /* ───────── B2 — activation ───────── */
  test('B2: clicking the pill opens /setup (AC-1)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toBeVisible();
    await pill(page).click();
    await expect(page).toHaveURL(/\/setup$/);
  });

  test('B2: tabbing to the pill and pressing Enter opens /setup (AC-1)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toBeVisible();
    let focused = false;
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate((name) => document.activeElement && document.activeElement.getAttribute('aria-label') === name, NAME);
    }
    expect(focused, 'the pill must be reachable with Tab').toBe(true);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/setup$/);
  });

  /* ───────── B3 — the count ───────── */
  for (const [ans, text] of [[ONE_LEFT, '· 1 step left'], [THREE_LEFT, '· 3 steps left']]) {
    test(`B3: the pill says "${text}" (AC-1)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { answers: [ans] });
      await open(page, '/tags');
      await expect(pill(page)).toContainText(text);
    });
  }

  /* ───────── B4 — confident steps only ───────── */
  for (const [label, answers] of [
    ['while the check is still running', ['hang']],
    ['when the check failed', ['error']],
    ['when nothing is left', [NONE_LEFT]],
    ['when the only open step is a Map naming another provider', [OTHER_ONLY]],
    ['when the open steps\' checks did not finish', [UNFINISHED]],
  ]) {
    test(`B4: no pill ${label} (AC-2)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { answers });
      await open(page, '/tags');
      await page.waitForTimeout(1000);
      await expect(pill(page)).toHaveCount(0);
    });
  }
  test('B4: with step 1 open and the other two checks unfinished, the pill counts step 1 alone — "· 1 step left" (AC-2)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [ACCOUNT_OPEN_REST_UNFINISHED] });
    await open(page, '/tags');
    await expect(pill(page)).toContainText('· 1 step left');
  });

  /* ───────── B5 — when it hides ───────── */
  for (const [label, path] of HOSTS) {
    test(`B5: signed out, no pill on ${label} (AC-3)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { who: null, answers: [TWO_LEFT] });
      await open(page, path);
      await expect(pill(page)).toHaveCount(0);
    });
  }
  for (const path of ['/setup', '/setup/create-account', '/setup/follow', '/setup/activate']) {
    test(`B5: no pill on ${path}, even with steps left (AC-3)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { answers: [TWO_LEFT] });
      await open(page, path);
      await expect(pill(page)).toHaveCount(0);
    });
  }
  test('B5: the pill has no close button (AC-3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toBeVisible();
    await expect(pill(page).locator('button, [role="button"], [aria-label*="lose" i], [aria-label*="ismiss" i]')).toHaveCount(0);
    await expect(pill(page)).not.toContainText('×');
  });

  /* ───────── B6 — agreement with /setup ───────── */
  for (const [label, ans, n] of [
    ['step 1 open and a Map naming another provider', ACCOUNT_AND_OTHER, 1],
    ['all three steps open', THREE_LEFT, 3],
    ['only step 3 open', ONE_LEFT, 1],
  ]) {
    test(`B6: with ${label}, the pill's N is the steps /setup shows as not done less an "another provider" step, and both read one answer (AC-4)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const state = await mock(page, { answers: [ans] });
      await open(page, '/tags');
      await expect(pill(page)).toContainText(countText(n));
      await pill(page).click();
      await expect(page).toHaveURL(/\/setup$/);
      const main = page.locator('main.bs-setup-main');
      const done = Object.values(ans.steps).filter((st) => st.done).length;
      await expect(main, '/setup shows the same answer').toContainText(`${done} of 3 complete`);
      const notDone = await main.evaluate((el) => (el.textContent || '').split('Not done: ').length - 1);
      const other = await main.getByText(OTHER_PROVIDER, { exact: true }).count();
      expect(n, `/setup shows ${notDone} step(s) not done, ${other} of them a Map naming another provider`).toBe(notDone - other);
      expect(n, 'N never exceeds the steps /setup shows as not done').toBeLessThanOrEqual(notDone);
      expect(state.statusCalls, 'the pill and the page share one answer: one read across the SPA navigation').toBe(1);
    });
  }

  /* ───────── B7 — every width ───────── */
  for (const [label, path, who] of HOSTS) {
    test(`B7: on ${label}, sentence and count at 1280, the sentence at 800, only ⚠ and the button at 375, one accessible name, and no top bar wider than the screen (AC-5)`, async ({ page }) => {
      await mock(page, { who, answers: [TWO_LEFT] });
      // count: true = must show, false = must be hidden, null = either (AC-5: "on narrower screens the count may drop").
      for (const [width, sentence, count] of [[1280, true, true], [800, true, null], [375, false, false]]) {
        await page.setViewportSize({ width, height: 800 });
        await open(page, path);
        const p = pill(page);
        await expect(p, `${width}px: the pill keeps its accessible name "${NAME}"`).toBeVisible();
        const sentenceEl = p.getByText(NAME, { exact: true });
        const countEl = p.getByText('· 2 steps left', { exact: true });
        if (sentence) await expect(sentenceEl, `${width}px: the sentence shows`).toBeVisible();
        else await expect(sentenceEl, `${width}px: the sentence is hidden`).toBeHidden();
        if (count === true) await expect(countEl, `${width}px: the count shows`).toBeVisible();
        if (count === false) await expect(countEl, `${width}px: the count is hidden`).toBeHidden();
        await expect(p.getByText(BUTTON, { exact: true }), `${width}px: the button shows`).toBeVisible();
        await expect(p.getByText('⚠', { exact: true }), `${width}px: the ⚠ mark shows`).toBeVisible();
        // scrollWidth counts content that overflows the bar even where the bar clips it.
        const { barScroll, barWidth } = await page.evaluate(() => {
          const b = document.querySelector('.bsp-top-bar, .app-header, .bs-results-header');
          return { barScroll: b.scrollWidth, barWidth: b.clientWidth };
        });
        expect(barScroll, `${width}px: the top bar's content is ${barScroll}px wide inside ${barWidth}px`).toBeLessThanOrEqual(barWidth + 1);
      }
    });
  }

  /* ───────── B8 — read-only ───────── */
  for (const [label, path, who] of [HOSTS[0], HOSTS[4]]) {
    test(`B8: ${label} with the pill showing only reads — GETs, and the control panel's own Cypher reads — and signs nothing (AC-6)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const state = await mock(page, { who, answers: [TWO_LEFT], signer: true });
      await open(page, path);
      await expect(pill(page)).toBeVisible();
      const notReads = state.nonGet.filter((r) => !isCypherRead(r));
      expect(notReads, `requests that are not reads: ${notReads.map((r) => `${r.method} ${r.path}${r.cypher ? ` (${r.cypher.trim().slice(0, 60)})` : ''}`).join(', ')}`).toHaveLength(0);
      const signed = (await page.evaluate(() => window.__signer || [])).filter((c) => c.startsWith('signEvent'));
      expect(signed, 'nothing is signed on the viewer\'s behalf').toHaveLength(0);
    });
  }

  /* ───────── B9 — freshness after creating an assistant ───────── */
  // Re-aimed by assistant-management #1 (ADR assistant-management/0001): the editor, with its create button, moved from
  // /assistant to /assistant/profile/edit.
  test('B9: creating an assistant on the Edit Assistant Profile page updates the pill without a reload (ADR 0002 Decision 5)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { who: NO_ASSISTANT, answers: [TWO_LEFT, ONE_LEFT] });
    await open(page, '/assistant/profile/edit');
    const create = page.getByRole('button', { name: 'Create my Tapestry Assistant key' });
    await expect(create, 'the page offers to create an assistant: the viewer has none').toBeVisible();
    await expect(pill(page)).toContainText('· 2 steps left');
    await page.evaluate(() => { window.__sameDocument = true; });
    await create.click();
    await expect(pill(page), 'after the assistant exists, the pill counts one step fewer').toContainText('· 1 step left', { timeout: 8000 });
    expect(await page.evaluate(() => window.__sameDocument === true), 'no reload: the same document is still loaded').toBe(true);
    expect(state.statusCalls, 'the provider asked again once the viewer\'s assistant changed').toBe(2);
  });

  /* ───────── B10 — the results view ───────── */
  test('B10: the search results view carries the pill in its header on a wide screen (AC-1)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/?q=jack');
    await expect(page.locator('.bs-results-header .bs-usermenu-avatar-btn'), 'the results view renders, signed in').toBeVisible();
    await expect(page.locator('.bs-results-header').getByRole('link', { name: NAME })).toBeVisible();
  });

  /* ───────── B11 — phone accommodations only while a pill shows ───────── */
  test('B11: at 375 px the TopBar wordmark hides only while the pill shows (ADR 0002 § 4)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toBeVisible();
    await expect(page.locator('.bsp-top-bar .bsp-logo > span'), 'with a pill, the wordmark gives up its room').toBeHidden();
  });
  // Re-aimed by assistant-management #2 (ADR assistant-management/0002 Amendment 1): a viewer with an assistant and no
  // step left now gets the Assistant Alert's pill, which sheds the same text. "No pill" is a viewer with no assistant.
  test('B11: at 375 px the TopBar wordmark stays when there is no pill (ADR 0002 § 4)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { who: NO_ASSISTANT, answers: [NONE_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Manage your Tapestry Assistant', exact: true }), 'and no Assistant pill either').toHaveCount(0);
    await expect(page.locator('.bsp-top-bar .bsp-logo > span'), 'without a pill, nothing changes').toBeVisible();
  });
  test('B11: at 375 px the control panel role badge hides only while the pill shows (ADR 0002 § 4)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { who: OWNER, answers: [TWO_LEFT] });
    await open(page, '/tapestry/');
    await expect(pill(page)).toBeVisible();
    await expect(page.locator('.app-header .user-badge'), 'with a pill, the badge gives up its room').toBeHidden();
  });
  // Re-aimed by assistant-management #2, as above: an Owner whose assistant key is missing.
  test('B11: at 375 px the control panel role badge stays when there is no pill (ADR 0002 § 4)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { who: { ...OWNER, assistantPubkey: null }, answers: [NONE_LEFT] });
    await open(page, '/tapestry/');
    await expect(pill(page)).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Manage your Tapestry Assistant', exact: true }), 'and no Assistant pill either').toHaveCount(0);
    await expect(page.locator('.app-header .user-badge'), 'without a pill, nothing changes').toBeVisible();
  });

  /* ───────── B12 — the control panel's brand yields room (ADR 0002 Amendment 1) ───────── */
  // One width inside each range where the brand used to wrap: phones for every role (375, 390), just
  // above the 440 px badge rule (450), where the sentence appears (650), and where the name appears (780).
  const LONG_NAME = 'A Deliberately Long Display Name For Testing';
  for (const [who, name, width] of [
    [OWNER, 'Fixture Viewer', 375],
    [OWNER, 'Fixture Viewer', 390],
    [CUSTOMER, 'Fixture Viewer', 450],
    [CUSTOMER, 'Fixture Viewer', 650],
    [CUSTOMER, LONG_NAME, 780],
  ]) {
    test(`B12: at ${width} px (${who.classification}${name === LONG_NAME ? ', a long display name' : ''}), the control panel header is as tall with the pill as without it and never scrolls (ADR 0002 Amendment 1)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mock(page, { who, name, answers: [NONE_LEFT, TWO_LEFT] });
      const measure = () => page.evaluate(() => {
        const h = document.querySelector('.app-header');
        const b = document.querySelector('.header-brand-name');
        return { header: Math.round(h.getBoundingClientRect().height), brand: Math.round(b.getBoundingClientRect().height), sw: h.scrollWidth, cw: h.clientWidth };
      });
      await open(page, '/tapestry/');
      await expect(pill(page), 'first load: nothing left, so no pill').toHaveCount(0);
      const without = await measure();
      await open(page, '/tapestry/');
      await expect(pill(page), 'second load: two steps left').toBeVisible();
      const withPill = await measure();
      expect(withPill.brand, `the brand is ${withPill.brand}px tall with the pill, ${without.brand}px without: it wrapped`).toBeLessThanOrEqual(without.brand + 1);
      expect(withPill.header, `the header is ${withPill.header}px tall with the pill, ${without.header}px without`).toBeLessThanOrEqual(without.header + 1);
      expect(withPill.sw, `the header's content is ${withPill.sw}px wide inside ${withPill.cw}px`).toBeLessThanOrEqual(withPill.cw + 1);
    });
  }
});
