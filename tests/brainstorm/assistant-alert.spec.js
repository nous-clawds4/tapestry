const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const { PENDING: ATTENTION_PENDING } = require('../../test/helpers/identificationTagsFixtures');

/**
 * assistant-management #2: the Assistant Alert — the browser class.
 *
 * Story: engineering-team/stories/done/assistant-management/2-the-assistant-alert.md
 * ADR:   engineering-team/decisions/done/assistant-management/0002-one-top-bar-alert-slot-setup-first.md
 * Plan:  engineering-team/stories/done/assistant-management/2-the-assistant-alert.test-plan.md
 * Node half: test/assistant-alert.test.js (P/C/W). Expected words: test/helpers/assistantManagementFixtures.js.
 *
 *   B0 — the served origin runs a build that contains the pill.                              [prerequisite]
 *   B1 — the pill beside the avatar menu on both halves of the app and the developer pages:
 *        its words, its count, and where it goes — by click and by keyboard.                [AC-1]
 *   B2 — no pill for a visitor, nor for a signed-in viewer with no assistant.                [AC-2]
 *   B3 — setup first: waits while the setup status is checked; gives way to a counted step;
 *        shows when setup counts nothing or its check failed; never beside a second pill.    [AC-3]
 *   B4 — no pill on /assistant or any page under it, and no way to close it.                 [AC-4]
 *   B5 — the pill's number is the hub's number.                                              [AC-5]
 *   B6 — three widths: all of it; without the count; the mark and the button — and no top
 *        bar scrolls sideways.                                                               [AC-6]
 *   B7 — read-only: GETs only, the setup status once per full load, nothing new asked.       [AC-7]
 *   B8 — the pill is indigo, never the Setup Alert's amber.                                  [story 2 § Copy]
 *   B9 — from 320 to 1280 px, with the pill showing, no top bar scrolls sideways, and the fixed Tapestry header
 *        grows no taller than without the pill (a long user name in it).                     [AC-6; ADR 0002 Amendment 1]
 *
 * Re-aimed after the Setup Alert shipped first as its own component (ADR 0002 Amendment 1): B3 now runs against
 * a build with the real Setup pill, so "a step left" is observed as the Setup pill showing and this one not, and the
 * "at most one pill" sampling has two pills that could collide.
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/setup/status is answered in ADR setup-status-and-alert/0001's shape — or held,
 * delayed or failed — so this class tests the pill; the setup rules are that book's.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: no page shows a pill.
 */

// Fixtures, never live keys.
const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST = 'ee'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };

const step = (done, pending, extra = {}) => ({ done, pending, finished: true, ...extra });
const answerWith = (account, follow, activate) => ({ success: true, signedIn: true, steps: { account, follow, activate } });
// ADR setup-status-and-alert/0001's answers. `pending` is what the Setup Alert counts.
const SETUP_DONE = answerWith(step(true, false), step(true, false, { followCount: 3, source: 'local' }), step(true, false, { otherProvider: false, source: 'local' }));
const SETUP_FOLLOW_LEFT = answerWith(step(true, false), step(false, true, { followCount: 0, source: null }), step(true, false, { otherProvider: false, source: 'local' }));
const SETUP_OTHER_PROVIDER = answerWith(step(true, false), step(true, false, { followCount: 3, source: 'local' }),
  { done: false, pending: false, finished: true, otherProvider: true, source: 'relay' });

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pathname = (page) => new URL(page.url()).pathname;
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
// The Setup pill by its element, not its old fixed name. Re-aimed when setup-status-and-alert #3 merged: its ADR
// (setup-status-and-alert/0003) names the pill by what it shows at each width, which that book's
// tests/brainstorm/setup-alert-polish.spec.js pins exactly.
const setupPillOf = (page) => page.locator('a.bs-setup-alert[href="/setup"]');
const anyPill = (page) => pillOf(page).or(setupPillOf(page));

// The pages the story names (AC-1): Brainstorm's own top bars, TopBar, the landing page, the Tapestry header, a developer page.
const PAGES = [
  { address: '/about', kind: 'brainstorm', what: '/about (its own top bar and BrainstormUserMenu)' },
  { address: '/tags', kind: 'brainstorm', what: '/tags (TopBar)' },
  { address: '/', kind: 'brainstorm', what: 'the landing page (TopBar with its own UserMenu)' },
  { address: '/tapestry/', kind: 'tapestry', what: 'the Tapestry dashboard (the Tapestry header)' },
  { address: '/developers', kind: 'developers', what: 'the developer pages (no avatar menu)' },
];

/**
 * Mock every route. `who` is null (a visitor) or { pubkey, classification, assistantPubkey }. `setup` is the
 * /api/setup/status answer: an object, 'hang', 'error' (a 500), or { delayMs, body }.
 */
async function mock(page, { who = CUSTOMER_USER, setup = SETUP_DONE, longName = false } = {}) {
  const log = { setupCalls: [], api: [], nonGet: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-alert.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: longName && who
    ? { [who.pubkey]: { name: 'Alexandria Thompson-Whitfield', display_name: 'Alexandria Thompson-Whitfield' } } : {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  // assistant-identification-tags #1: the pill and the hub now read one more shared answer. Answered PENDING (a tagging
  // missing, check finished) so that every count this class pins stays ten: a checked action counts only from a finished
  // answer, and the catch-all's failure would read as nine. tests/brainstorm/assistant-attention.spec.js pins the other answers.
  await page.route('**/api/assistant/attention**', (r) => r.fulfill(json(ATTENTION_PENDING)));
  await page.route('**/api/setup/status**', async (r) => {
    log.setupCalls.push(r.request().url());
    if (setup === 'hang') return new Promise(() => {});
    if (setup === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    if (setup && setup.delayMs !== undefined) {
      await wait(setup.delayMs);
      try { return await r.fulfill(json(setup.body)); } catch { return undefined; }
    }
    return r.fulfill(json(setup));
  });
  return log;
}

/** Hard-load a page and let sign-in and the setup status settle. */
async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(settleMs);
}

async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI? Run `cd ui && npm run build`.' };
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

/** Sample the page for `ms`: the most pills of any kind seen at once, and whether each pill ever showed. */
async function watch(page, ms) {
  let most = 0;
  let assistantShown = false;
  let setupShown = false;
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    most = Math.max(most, await anyPill(page).count());
    if (await pillOf(page).count()) assistantShown = true;
    if (await setupPillOf(page).count()) setupShown = true;
    await page.waitForTimeout(100);
  }
  return { most, assistantShown, setupShown };
}

test.describe('The Assistant Alert (assistant-management #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 ───────── */
  test('B0: the served origin runs a build that contains the Assistant Alert', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'Manage your Tapestry Assistant');
    expect(found, `the bundle served by ${baseURL} does not contain "Manage your Tapestry Assistant" (${why}). Rebuild the UI, ` +
      'or the pill is not built yet — B1–B8 say so directly.').toBe(true);
  });

  /* ───────── B1 — where and what ───────── */
  test('B1: beside the avatar menu on every kind of page — or where the menu would be on the developer pages — the pill reads "Manage your Tapestry Assistant · 10 actions need attention" with "Manage Assistant →", and leads to /assistant (AC-1)', async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page);
    for (const p of PAGES) {
      await open(page, p.address);
      const pill = pillOf(page);
      await expect(pill, `${p.what}: one Assistant pill`).toHaveCount(1, { timeout: 10000 });
      await expect(pill, `${p.what}: it leads to the hub`).toHaveAttribute('href', X.HUB);
      const words = squash(await pill.innerText());
      expect(words, `${p.what}: the sentence`).toContain(X.ALERT.sentence);
      expect(words, `${p.what}: the count`).toContain(`· ${X.countText(10)}`);
      expect(words, `${p.what}: the button`).toContain(X.ALERT.button);
      const where = await pill.evaluate((el) => ({
        parent: el.parentElement ? el.parentElement.className : '',
        brainstormMenu: Boolean(el.parentElement && el.parentElement.querySelector('.bs-usermenu-avatar-btn')),
        tapestryMenu: Boolean(el.parentElement && el.parentElement.querySelector('.user-button')),
      }));
      if (p.kind === 'brainstorm') expect(where.brainstormMenu, `${p.what}: the pill sits beside the avatar menu (same row) — got ${JSON.stringify(where)}`).toBe(true);
      if (p.kind === 'tapestry') expect(where.tapestryMenu, `${p.what}: the pill sits beside the Tapestry user menu — got ${JSON.stringify(where)}`).toBe(true);
      if (p.kind === 'developers') expect(where.parent, `${p.what}: the pill sits where the menu would be (.bsp-auth)`).toContain('bsp-auth');
    }
    await open(page, '/about');
    await pillOf(page).click();
    await expect.poll(() => pathname(page), { message: 'clicking the pill opens /assistant' }).toBe(X.HUB);
    await open(page, '/tags');
    await pillOf(page).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => pathname(page), { message: 'Enter on the focused pill opens /assistant' }).toBe(X.HUB);
  });

  /* ───────── B2 — who sees it ───────── */
  test('B2: a signed-out visitor sees no pill anywhere, and neither does a signed-in viewer with no assistant (AC-2)', async ({ page }) => {
    test.setTimeout(90000);
    await mock(page, { who: null });
    for (const p of PAGES) {
      await open(page, p.address);
      await expect(anyPill(page), `signed out, ${p.what}: no pill`).toHaveCount(0);
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    // Setup answered as all done, so that nothing but "no assistant" can explain a missing pill.
    await mock(page, { who: GUEST_USER, setup: SETUP_DONE });
    for (const address of ['/about', '/tapestry/']) {
      await open(page, address);
      await expect(pillOf(page), `a signed-in guest with no assistant, ${address}: no Assistant pill`).toHaveCount(0);
    }
  });

  /* ───────── B3 — setup first ───────── */
  test('B3: while the setup status is being checked no pill shows; a step left shows the Setup pill and not this one; nothing left, another provider, or a failed check shows the Assistant pill — and never two pills at once (AC-3)', async ({ page }) => {
    test.setTimeout(150000);
    // [label, setup answer, the Assistant pill shows, the Setup pill shows]
    const cases = [
      ['the check still running', 'hang', false, false],
      ['a setup step left (the follow list)', SETUP_FOLLOW_LEFT, false, true],
      ['every step done', SETUP_DONE, true, false],
      ['steps 1–2 done, and a Map naming another provider (the Setup Alert does not count it)', SETUP_OTHER_PROVIDER, true, false],
      ['the setup check failed', 'error', true, false],
    ];
    for (const [label, setup, shows, setupShows] of cases) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { setup });
      await page.goto('/about');
      const seen = await watch(page, 3500);
      expect(seen.most, `${label}: at most one pill at any moment`).toBeLessThanOrEqual(1);
      expect(seen.assistantShown, `${label}: the Assistant pill ${shows ? 'shows' : 'stays hidden'}`).toBe(shows);
      expect(seen.setupShown, `${label}: the Setup pill ${setupShows ? 'shows — setup first' : 'stays hidden'}`).toBe(setupShows);
    }
    // The answer arrives late, in both directions: no pill at all until it does, then the right one.
    for (const [body, expected, other] of [[SETUP_DONE, pillOf, setupPillOf], [SETUP_FOLLOW_LEFT, setupPillOf, pillOf]]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { setup: { delayMs: 3000, body } });
      await page.goto('/about');
      const early = await watch(page, 2000);
      expect(early.assistantShown || early.setupShown, 'while the setup answer is on its way, no pill of either kind').toBe(false);
      await expect(expected(page), 'once the answer arrives, its pill shows').toHaveCount(1, { timeout: 8000 });
      await expect(other(page), 'and only that one').toHaveCount(0);
    }
  });

  /* ───────── B4 — where it hides ───────── */
  test('B4: no pill on /assistant or any page under it, and the pill has no close button (AC-4)', async ({ page }) => {
    test.setTimeout(90000);
    await mock(page);
    for (const address of [X.HUB, `${X.HUB}/`, X.PROFILE_PAGE, X.EDITOR, '/assistant/dlists', '/assistant/preferences']) {
      await open(page, address);
      await expect(anyPill(page), `${address}: no pill`).toHaveCount(0);
    }
    await open(page, '/about');
    const pill = pillOf(page);
    await expect(pill).toHaveCount(1);
    await expect(pill.getByRole('button'), 'nothing inside the pill closes it').toHaveCount(0);
    await expect(pill.locator('xpath=..').getByRole('button', { name: /close|dismiss|hide/i }), 'and nothing beside it does').toHaveCount(0);
  });

  /* ───────── B5 — never disagrees with /assistant ───────── */
  test('B5: the number on the pill is the hub\'s count line and its number of marks (AC-5)', async ({ page }) => {
    await mock(page);
    await open(page, '/about');
    await expect(pillOf(page), 'the pill, on /about').toHaveCount(1);
    const words = squash(await pillOf(page).innerText());
    const m = words.match(/· (\d+) actions? needs? attention/);
    expect(m, `the pill states a count — got ${JSON.stringify(words)}`).not.toBeNull();
    const n = Number(m[1]);
    await pillOf(page).click();
    await expect.poll(() => pathname(page)).toBe(X.HUB);
    const main = page.locator('main').first();
    await expect(main.getByText(X.countText(n), { exact: true }), 'the hub says the same number').toBeVisible();
    await expect(main.getByText(X.COPY.needsAttention, { exact: true }), 'and marks that many cards').toHaveCount(n);
    expect(n, 'for now every action needs attention').toBe(10);
  });

  /* ───────── B6 — every width ───────── */
  test('B6: wide, the sentence and the count; narrower, the count drops; at 375 px only the mark and "Manage Assistant →", still named "Manage your Tapestry Assistant" — and no top bar scrolls sideways (AC-6)', async ({ page }) => {
    test.setTimeout(240000);
    await mock(page);
    const expectations = [
      [1280, { sentence: true, count: true }],
      [800, { sentence: true, count: false }],
      [375, { sentence: false, count: false }],
    ];
    for (const [width, show] of expectations) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, '/about');
      const pill = pillOf(page);
      await expect(pill, `${width}px: the pill, by its accessible name`).toHaveCount(1);
      const part = (text) => pill.getByText(text, { exact: true });
      for (const [what, locator, visible] of [
        ['the sentence', part(X.ALERT.sentence), show.sentence],
        ['the count', pill.getByText(new RegExp(`^·\\s*${X.countText(10)}$`)), show.count],
        ['the mark', part(X.ALERT.mark), true],
        ['the button', part(X.ALERT.button), true],
      ]) {
        if (visible) await expect(locator, `${width}px: ${what} shows`).toBeVisible();
        else await expect(locator, `${width}px: ${what} is hidden`).toBeHidden();
      }
      for (const address of ['/', '/tags', '/about', '/settings', '/developers', '/tapestry/']) {
        await open(page, address);
        await expect(pillOf(page), `${width}px, ${address}: precondition — the pill is showing`).toHaveCount(1);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${width}px, ${address}: the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);
      }
    }
  });

  /* ───────── B7 — read-only ───────── */
  test('B7: showing the pill sends nothing but GETs, reads the setup status once per full load with no parameters, and asks again only on a full load (AC-7)', async ({ page }) => {
    const log = await mock(page);
    await open(page, '/about');
    await expect(pillOf(page)).toHaveCount(1);
    expect(log.nonGet, 'nothing is published, signed or stored').toEqual([]);
    expect(log.setupCalls, 'one setup-status read for the load').toHaveLength(1);
    expect(new URL(log.setupCalls[0]).search, 'the server answers for the session; the read carries no parameters').toBe('');
    await pillOf(page).click();
    await expect.poll(() => pathname(page)).toBe(X.HUB);
    await page.goBack();
    await expect(pillOf(page), 'back on /about, the pill again').toHaveCount(1);
    expect(log.setupCalls, 'moving around inside the app asks nothing new').toHaveLength(1);
    expect(log.api.filter((a) => /publish|sign/i.test(a)), 'no publish or sign request').toEqual([]);
  });

  /* ───────── B9 — the bars keep their shape at every width ───────── */
  // The widths are each side of every breakpoint that changes what a bar holds while the pill shows: the pill's own
  // (count ≤ 1023, sentence ≤ 679, TopBar's nav < 360), the Setup Alert's (≤ 639, the edge that was once this pill's),
  // the phone rules (≤ 480), TopBar's padding (≤ 600) and the Tapestry header's (≤ 768; its user name from 769, and a
  // long one to 794), plus 320, 375, 414 and 1280.
  // The height check is the fixed Tapestry header's: it overlays the page, whose content starts at 48px, so growing
  // covers content. A static bar may grow a few px where the pill is taller than the logo (the developer pages), as the
  // Setup Alert's own ADR recorded for its pill; that moves content down and covers nothing.
  test('B9: from 320 to 1280 px, with the Assistant pill showing, no top bar scrolls sideways and the fixed Tapestry header grows no taller than it is without the pill — a long user name included (AC-6; ADR 0002 Amendment 1)', async ({ page }) => {
    test.setTimeout(600000);
    const widths = [320, 359, 360, 375, 414, 480, 481, 600, 601, 639, 640, 679, 680, 768, 769, 794, 1023, 1024, 1280];
    const barOf = () => page.evaluate(() => {
      const bar = document.querySelector('.app-header, .bsp-top-bar, .bss-top-bar');
      return { height: bar ? Math.round(bar.getBoundingClientRect().height) : null,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    const problems = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 700 });
      for (const address of ['/', '/tags', '/about', '/settings', '/developers', '/tapestry/']) {
        let without = null;
        if (address === '/tapestry/') {
          await page.unrouteAll({ behavior: 'ignoreErrors' });
          // Without a pill: the same Customer, name and badge, but with no assistant — and every setup step done, so no
          // Setup pill either.
          await mock(page, { who: { ...CUSTOMER_USER, assistantPubkey: null }, setup: SETUP_DONE, longName: true });
          await open(page, address, 1200);
          without = await barOf();
        }
        await page.unrouteAll({ behavior: 'ignoreErrors' });
        await mock(page, { who: CUSTOMER_USER, setup: SETUP_DONE, longName: true });
        await open(page, address, 1200);
        const shown = await pillOf(page).count();
        const withPill = await barOf();
        if (shown !== 1) problems.push(`${width}px ${address}: no Assistant pill`);
        if (withPill.overflow > 0) problems.push(`${width}px ${address}: scrolls sideways by ${withPill.overflow}px`);
        if (without && withPill.height > without.height) problems.push(`${width}px ${address}: the fixed header grows ${without.height}→${withPill.height}px`);
      }
    }
    expect(problems, `with the pill showing:\n${problems.join('\n')}`).toEqual([]);
  });

  /* ───────── B8 — its colour ───────── */
  test('B8: the pill\'s button is Tapestry\'s indigo, not the Setup Alert\'s amber (story 2 § Copy)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page);
    await open(page, '/about');
    const button = pillOf(page).getByText(X.ALERT.button, { exact: true });
    await expect(button).toBeVisible();
    const rgb = await button.evaluate((el) => {
      for (let n = el; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (m && (m[4] === undefined || Number(m[4]) > 0.5)) return [Number(m[1]), Number(m[2]), Number(m[3])];
      }
      return null;
    });
    expect(rgb, 'the button has a solid background').not.toBeNull();
    const [r, g, b] = rgb;
    expect(b > r + 40 && b > g + 40, `indigo means blue well above red and green — got rgb(${r}, ${g}, ${b})`).toBe(true);
  });
});
