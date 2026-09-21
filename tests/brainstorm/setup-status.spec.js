const { test, expect } = require('@playwright/test');

/**
 * setup-status-and-alert #1: /setup shows where you stand — the browser class.
 *
 * Story: engineering-team/stories/setup-status-and-alert/1-setup-shows-where-you-stand.md
 * ADR:   engineering-team/decisions/setup-status-and-alert/0001-one-setup-status-answer.md
 * Node half: test/setup-status.test.js (U/X/C/S/D/R/H).
 *
 * ── Why this file carries the page's acceptance criteria ────────────────
 * AC-1 and AC-4 are about what a viewer SEES on /setup: which steps are marked, which are links,
 * the progress line, the sign-in line. A source scan can only say a token is in a file, so they
 * are settled here, against the built UI, with every /api route mocked.
 *
 *   B0 — the served origin runs a build that contains the code under test.         [prerequisite]
 *   B1 — signed out: the three steps as links, no marks, no progress, a sign-in line. [AC-1]
 *   B2 — signed in: the sign-in line never flashes while sign-in resolves.            [AC-1]
 *   B3 — all three done: done cards (not links), badges, sentences, 3 of 3, all set.  [AC-2, AC-4]
 *   B4 — mixed, and a Map naming another provider.                                   [AC-2, AC-4]
 *   B5 — the check still running, or failed: every step not done, 0 of 3.            [AC-4]
 *   B6 — a viewer with no assistant: steps 1 and 3 not done.                         [AC-2]
 *   B7 — 375 px wide: no horizontal scroll, signed in and signed out.                [AC-4]
 *   B8 — the page only reads: no request other than GET, one status read per load.   [AC-5]
 *   B9 — an expired session (the server says signed out): nothing breaks.            [edge]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. A catch-all answers `success: false`, and the routes that matter
 * answer per scenario. /api/setup/status is answered with the ADR's response shape directly, so
 * this class tests the PAGE; the server's rules are the Node suite's.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then
 *   BRAINSTORM_BASE_URL=http://localhost:4173. A source-only edit is INVISIBLE to this class; B0
 *   guards exactly that. tests/global-setup.js sets BRAINSTORM_SERVER_ACCESSIBLE=true when the
 *   base URL answers.
 *
 * These FAIL against the current build: it shows "0 of 3 complete" and three not-done links to
 * everyone, has no sign-in line, and never asks /api/setup/status.
 */

// Fixtures, never live keys.
const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TA = 'ee'.repeat(32);

const OWNER_USER = { pubkey: VIEWER, classification: 'owner', assistantPubkey: TA };
const CUSTOMER_USER = { pubkey: VIEWER, classification: 'customer', assistantPubkey: ASSISTANT };
const NO_ASSISTANT_USER = { pubkey: VIEWER, classification: 'guest', assistantPubkey: null };

const STEPS = [
  { href: '/setup/create-account', label: 'Create your account', badge: 'Start here',
    text: 'Your account comes with your own Tapestry Assistant' },
  { href: '/setup/follow', label: 'Create your follow list', badge: 'Required for scoring',
    text: 'Your trust scores are built from who you follow' },
  { href: '/setup/activate', label: 'Activate your Brainstorm account', badge: 'Required for other apps',
    text: 'One signature publishes your Treasure Map' },
];

// Story 1 § Copy.
const SIGNED_OUT_LINE = "Sign in to see which steps you've done.";
const SIGN_IN_BUTTON = 'Sign in with nostr';
const ACCOUNT_DONE = 'This instance holds your Tapestry Assistant.';
const ACTIVATE_DONE = 'Your Treasure Map names your Tapestry Assistant for your rank and followers scores.';
const OTHER_PROVIDER = 'Your Treasure Map names another provider for your scores.';
const ALL_SET = "You're all set!";

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// /api/setup/status answers, in ADR 0001's shape.
const answerWith = (steps) => ({ success: true, signedIn: true, steps });
const ALL_DONE = answerWith({
  account: { done: true, pending: false, finished: true },
  follow: { done: true, pending: false, finished: true, followCount: 27, source: 'local' },
  activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
});
const MIXED = answerWith({
  account: { done: true, pending: false, finished: true },
  follow: { done: false, pending: true, finished: true, followCount: 0, source: null },
  activate: { done: false, pending: false, finished: true, otherProvider: true, source: 'relay' },
});
const NO_ASSISTANT = answerWith({
  account: { done: false, pending: true, finished: true },
  follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
  activate: { done: false, pending: true, finished: true, otherProvider: false, source: null },
});

/**
 * Mock every route. `who` is null (a visitor) or { pubkey, classification, assistantPubkey }.
 * `status` is the /api/setup/status answer: an object, 'hang' (never answered), or 'error' (a 500).
 * Returns a live log of the status reads and of every request that was not a GET.
 */
async function mock(page, { who = null, status = ALL_DONE, authDelayMs = 0 } = {}) {
  const log = { statusCalls: [], nonGet: [] };
  page.on('request', (req) => { if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${req.url()}`); });

  // Catch-all FIRST: Playwright tries the most recently registered matching route first.
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by setup-status.spec.js' })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null }));
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who
      ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });
  await page.route('**/api/setup/status**', async (r) => {
    log.statusCalls.push(r.request().url());
    if (status === 'hang') return new Promise(() => {});
    if (status === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    return r.fulfill(json(status));
  });
  return log;
}

/** Hard-load /setup and let sign-in and the status read settle before judging the page. */
async function openSetup(page) {
  await page.goto('/setup');
  await page.locator('main.bs-setup-main').waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
  return page.locator('main.bs-setup-main');
}

/** Text as a screen reader gets it, visually hidden prefixes included. */
const textOf = (locator) => locator.evaluate((el) => el.textContent || '');
const count = (haystack, needle) => haystack.split(needle).length - 1;

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
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

test.describe('/setup shows where you stand (setup-status-and-alert #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that reads /api/setup/status', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, '/api/setup/status');
    expect(found,
      `the bundle served by ${baseURL} does not contain "/api/setup/status", the one read ADR 0001 adds (${why}). ` +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run build` — ' +
      'or the status read is not implemented, in which case B1–B9 say so directly.').toBe(true);
  });

  /* ───────── B1 — signed out ───────── */
  test('B1: a signed-out visitor sees the three steps as links with no marks and no progress, and a line asking them to sign in (AC-1)', async ({ page }) => {
    const log = await mock(page, { who: null });
    const main = await openSetup(page);
    for (const s of STEPS) {
      const link = main.locator(`a[href="${s.href}"]`);
      await expect(link, `${s.label} must still be a link to ${s.href}`).toHaveCount(1);
      await expect(link).toContainText(s.label);
      await expect(link).toContainText(s.badge);
      await expect(link).toContainText(s.text);
    }
    const text = await textOf(main);
    expect(text, 'no step may be marked for a visitor: a screen reader must hear no "Not done:"').not.toContain('Not done:');
    expect(text, 'no step may be marked for a visitor: a screen reader must hear no "Done:"').not.toContain('Done:');
    await expect(main.getByRole('progressbar'), 'no progress bar for a visitor').toHaveCount(0);
    expect(text, 'no progress line for a visitor').not.toMatch(/of 3 complete/);
    await expect(main.getByText(SIGNED_OUT_LINE, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: SIGN_IN_BUTTON })).toBeVisible();
    expect(log.statusCalls, 'a visitor has no session: nothing to read, so no /api/setup/status request').toHaveLength(0);
  });

  /* ───────── B2 — the signed-out line never flashes for a signed-in viewer ───────── */
  test('B2: a signed-in viewer never sees the sign-in line, not even while sign-in resolves (AC-1)', async ({ page }) => {
    await mock(page, { who: OWNER_USER, status: ALL_DONE, authDelayMs: 1500 });
    await page.goto('/setup');
    const flashes = [];
    const deadline = Date.now() + 4500;
    while (Date.now() < deadline) {
      const body = await page.evaluate(() => (document.body ? document.body.textContent : ''));
      if (body.includes(SIGNED_OUT_LINE)) flashes.push(Date.now());
      await page.waitForTimeout(100);
    }
    expect(flashes, 'the signed-out line appeared for a signed-in viewer while sign-in was resolving').toHaveLength(0);
    await expect(page.locator('main.bs-setup-main')).toContainText('3 of 3 complete');
  });

  /* ───────── B3 — all three done ───────── */
  test('B3: when all three steps are done, each shows a check, "Done" and its sentence, none is a link, and the page says 3 of 3 and "You\'re all set!" (AC-2, AC-4)', async ({ page }) => {
    const log = await mock(page, { who: OWNER_USER, status: ALL_DONE });
    const main = await openSetup(page);
    await expect(main).toContainText('3 of 3 complete');
    await expect(main.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3');
    await expect(main.locator('a[href^="/setup/"]'), 'a done step is not a link').toHaveCount(0);
    for (const s of STEPS) await expect(main).toContainText(s.label);
    for (const sentence of [ACCOUNT_DONE, '27 accounts followed.', ACTIVATE_DONE]) await expect(main).toContainText(sentence);
    await expect(main.getByText('Done', { exact: true }), 'one "Done" badge per step').toHaveCount(3);
    await expect(main).toContainText(ALL_SET);
    const text = await textOf(main);
    expect(count(text, 'Done: '), 'each done step is announced "Done:" to screen readers').toBe(3);
    expect(text).not.toContain('Not done:');
    expect(log.statusCalls, 'one status read per page load').toHaveLength(1);
    expect(new URL(log.statusCalls[0]).search, 'the status read takes no parameters: the server answers for the session').toBe('');
  });

  /* ───────── B4 — mixed, with another provider ───────── */
  test('B4: a mix — a done step is not a link; a not-done step links as before; a Map naming another provider says so (AC-2, AC-4)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, status: MIXED });
    const main = await openSetup(page);
    await expect(main).toContainText('1 of 3 complete');
    await expect(main.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    await expect(main.locator('a[href="/setup/create-account"]'), 'step 1 is done, so it is not a link').toHaveCount(0);
    await expect(main).toContainText(ACCOUNT_DONE);
    const follow = main.locator('a[href="/setup/follow"]');
    await expect(follow).toHaveCount(1);
    await expect(follow).toContainText(STEPS[1].text);
    await expect(follow).toContainText(STEPS[1].badge);
    const activate = main.locator('a[href="/setup/activate"]');
    await expect(activate).toHaveCount(1);
    await expect(activate).toContainText(OTHER_PROVIDER);
    await expect(activate, 'the another-provider sentence replaces step 3\'s usual one').not.toContainText(STEPS[2].text);
    await expect(activate, 'the badge stays').toContainText(STEPS[2].badge);
    await expect(main).not.toContainText(ALL_SET);
    const text = await textOf(main);
    expect(count(text, 'Done: ')).toBe(1);
    expect(count(text, 'Not done: ')).toBe(2);
  });

  /* ───────── B5 — still checking, or the check failed ───────── */
  for (const [label, status] of [['still running', 'hang'], ['failed', 'error']]) {
    test(`B5: while the check is ${label}, every step shows as not done, as today, with 0 of 3 (AC-4)`, async ({ page }) => {
      await mock(page, { who: OWNER_USER, status });
      const main = await openSetup(page);
      await expect(main).toContainText('0 of 3 complete');
      for (const s of STEPS) await expect(main.locator(`a[href="${s.href}"]`)).toHaveCount(1);
      const text = await textOf(main);
      expect(count(text, 'Not done: ')).toBe(3);
      expect(text).not.toContain(SIGNED_OUT_LINE);
      await expect(main).not.toContainText(ALL_SET);
    });
  }

  /* ───────── B6 — no assistant ───────── */
  test('B6: a signed-in viewer with no assistant sees steps 1 and 3 not done, and their follow list counted (AC-2)', async ({ page }) => {
    await mock(page, { who: NO_ASSISTANT_USER, status: NO_ASSISTANT });
    const main = await openSetup(page);
    await expect(main).toContainText('1 of 3 complete');
    await expect(main.locator('a[href="/setup/create-account"]')).toHaveCount(1);
    await expect(main.locator('a[href="/setup/activate"]')).toHaveCount(1);
    await expect(main.locator('a[href="/setup/follow"]'), 'step 2 is done, so it is not a link').toHaveCount(0);
    await expect(main).toContainText('3 accounts followed.');
  });

  /* ───────── B7 — phone width ───────── */
  for (const [label, who, status] of [['signed in, mixed', CUSTOMER_USER, MIXED], ['signed in, all done', OWNER_USER, ALL_DONE], ['signed out', null, ALL_DONE]]) {
    test(`B7: at 375 px wide, /setup reads without horizontal scrolling (${label}) (AC-4)`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await mock(page, { who, status });
      await openSetup(page);
      const { scroll, client } = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth,
      }));
      expect(scroll, `the page is ${scroll}px wide in a ${client}px viewport`).toBeLessThanOrEqual(client);
    });
  }

  /* ───────── B8 — read-only ───────── */
  for (const [label, who, status] of [['signed in', CUSTOMER_USER, MIXED], ['signed out', null, ALL_DONE]]) {
    test(`B8: opening /setup only reads — every request is a GET (${label}) (AC-5)`, async ({ page }) => {
      const log = await mock(page, { who, status });
      await openSetup(page);
      expect(log.nonGet, `requests that are not reads: ${log.nonGet.join(', ')}`).toHaveLength(0);
    });
  }

  /* ───────── B9 — an expired session ───────── */
  test('B9: when the server says the session has expired, the page shows every step not done and keeps working', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await mock(page, { who: OWNER_USER, status: { success: true, signedIn: false } });
    const main = await openSetup(page);
    await expect(main).toContainText('0 of 3 complete');
    for (const s of STEPS) await expect(main.locator(`a[href="${s.href}"]`)).toHaveCount(1);
    expect(errors, `page errors: ${errors.join(' | ')}`).toHaveLength(0);
  });
});
