const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const F = require('../../test/helpers/scoresFixtures');

/**
 * assistant-scores #1: the Scores page — the browser class.
 *
 * Story: engineering-team/stories/assistant-scores/1-the-scores-page.md
 * ADR:   engineering-team/decisions/assistant-scores/0001-a-session-bound-scores-read-and-recalculate-route.md
 * Plan:  engineering-team/stories/assistant-scores/1-the-scores-page.test-plan.md
 * Node halves: test/assistant-scores-route.test.js, test/assistant-scores-page.test.js.
 * Words and canned answers: test/helpers/scoresFixtures.js.
 *
 *   B0 — the served origin runs a build that has the Scores page.                                      [prerequisite]
 *   B1 — signed out: the hub's sign-in line; no status, no button.                                      [AC-5]
 *   B2 — no Assistant here: the hub's no-Assistant line; no status, no button.                          [AC-5]
 *   B3 — idle: the title, the Assistant, last published (date, time, how long ago), the count, the
 *        enabled button and its note; no run line; the back link and the Treasure Map link.             [AC-1, AC-2, AC-6]
 *   B4 — the press: one POST with no body, "Recalculation started.", the read asked again, then queued
 *        and the button off.                                                                             [AC-2, AC-3, AC-4]
 *   B5 — running on load: the running line, the button off.                                              [AC-3]
 *   B6 — no pipeline (an Admin who isn't a Customer, a guest): the status, the reason, no button.       [AC-5]
 *   B7 — none published, and a read that failed: "not yet" with a count of 0; "couldn't be read" with no
 *        count line.                                                                                     [AC-1]
 *   B8 — a refused press: "Couldn't start a recalculation: …".                                           [AC-2, AC-3]
 *   B9 — an unknown run state claims nothing and keeps the button.                                       [§ Open questions]
 *   B10 — read-only on load: one GET of the read, nothing but GETs until the press.                      [AC-2]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. GET /api/assistant/scores answers per scenario (a queue of answers; the last repeats).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test:
 *   `cd ui && npm run build && npx vite preview --port 4173 --strictPort`, then BRAINSTORM_BASE_URL=http://localhost:4173.
 *
 * These FAIL against the build before this story: /assistant/trusted-assertions is the placeholder page.
 */

const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const NO_ASSISTANT_USER = { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null };

const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/**
 * Mock every route. `scores` is the read's answer, or a queue of them (the last repeats); `press` is the POST's
 * { status, body }.
 */
async function mock(page, { who = CUSTOMER_USER, scores = F.ANSWERS.IDLE, press = { status: 202, body: { success: true, run: 'queued' } } } = {}) {
  const log = { api: [], nonGet: [], reads: 0, presses: [] };
  const queue = Array.isArray(scores) ? scores.slice() : [scores];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-scores.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json({ success: true, hasRelayKey: true, assistantPubkey: CUSTOMER_ASSISTANT, hasProfile: false })));
  await page.route('**/api/assistant/attention**', (r) => r.fulfill(json({ success: true, signedIn: !!who, hasAssistant: !!(who && who.assistantPubkey), actions: {} })));
  await page.route(`**${F.ROUTES.status}`, (r) => {
    if (r.request().method() !== 'GET') return r.fulfill(json({ success: false }, 405));
    log.reads += 1;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return r.fulfill(json(next));
  });
  await page.route(`**${F.ROUTES.recalculate}`, (r) => {
    log.presses.push({ method: r.request().method(), body: r.request().postData(), url: r.request().url() });
    return r.fulfill(json(press.body, press.status));
  });
  return log;
}

async function open(page, settleMs = 1500) {
  await page.goto(F.PATH);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(settleMs);
  return page.locator('main').first();
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

const button = (page) => page.getByRole('button', { name: F.COPY.button, exact: true });
/** The page's own words for a time and a count, in the browser's locale (what the page itself formats). */
const localeDate = (page, at) => page.evaluate((s) => new Date(s * 1000).toLocaleString(), at);
const localeCount = (page, n) => page.evaluate((x) => x.toLocaleString(), n);

test.describe('The Scores page (assistant-scores #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that has the Scores page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, F.COPY.button);
    expect(found, `the bundle served by ${baseURL} does not carry "${F.COPY.button}" (${why}). Rebuild the UI, or the story is not built yet.`).toBe(true);
  });

  test("B1: signed out — the hub's sign-in line, no status and no button (AC-5)", async ({ page }) => {
    await mock(page, { who: null, scores: F.ANSWERS.SIGNED_OUT });
    const main = await open(page);
    await expect(main.getByText(X.COPY.signedOutLine, { exact: true })).toBeVisible();
    await expect(button(page)).toHaveCount(0);
    expect(squash(await main.innerText())).not.toContain(F.COPY.lastPublishedPrefix.trim());
  });

  test("B2: no Assistant here — the hub's no-Assistant line, no status and no button (AC-5)", async ({ page }) => {
    await mock(page, { who: NO_ASSISTANT_USER, scores: F.ANSWERS.NO_ASSISTANT });
    const main = await open(page);
    await expect(main.getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    await expect(button(page)).toHaveCount(0);
    expect(squash(await main.innerText())).not.toContain(F.COPY.lastPublishedPrefix.trim());
  });

  test('B3: idle — the Assistant, last published with how long ago, the count, the enabled button and its note; the links stay (AC-1, AC-2, AC-6)', async ({ page }) => {
    await mock(page);
    const main = await open(page);
    await expect(main.getByRole('heading', { level: 1, name: F.COPY.heading, exact: true })).toBeVisible();
    const text = squash(await main.innerText());
    expect(text).toContain(F.COPY.assistantPrefix.trim());
    const date = await localeDate(page, F.LATEST_AT);
    expect(text, 'the date and time the newest Trusted Assertion was signed').toContain(`${F.COPY.lastPublishedPrefix}${date} (`);
    expect(text).toMatch(/ago\)/);
    expect(text).toContain(`${F.COPY.countPrefix}${await localeCount(page, F.COUNT)}`);
    await expect(button(page)).toBeEnabled();
    expect(text).toContain(F.COPY.takesAWhile);
    expect(text).not.toContain(F.COPY.queued);
    expect(text).not.toContain(F.COPY.running);
    expect(text).not.toContain(X.COPY.placeholder);
    await expect(main.getByRole('link', { name: X.COPY.backToHub })).toHaveAttribute('href', X.HUB);
    await expect(main.getByRole('link', { name: F.ACTION_EDIT_LINK_TEXT })).toBeVisible();
  });

  test('B4: the press — one POST with no body, "Recalculation started.", the read asked again, then queued and the button off (AC-2, AC-3, AC-4)', async ({ page }) => {
    const log = await mock(page, { scores: [F.ANSWERS.IDLE, F.ANSWERS.QUEUED] });
    await open(page);
    expect(log.reads).toBe(1);
    await button(page).click();
    await expect(page.getByText(F.COPY.started, { exact: true })).toBeVisible();
    await expect.poll(() => log.reads, { message: 'the read is asked again after the press' }).toBe(2);
    await expect(page.getByText(F.COPY.queued, { exact: true })).toBeVisible();
    await expect(button(page)).toBeDisabled();
    expect(log.presses.length, 'one press, one POST').toBe(1);
    expect(log.presses[0].method).toBe('POST');
    expect(new URL(log.presses[0].url).search, 'the press carries no query').toBe('');
    expect([null, '', '{}']).toContain(log.presses[0].body);
  });

  test('B5: running on load — the running line, the button off (AC-3)', async ({ page }) => {
    await mock(page, { scores: F.ANSWERS.RUNNING });
    await open(page);
    await expect(page.getByText(F.COPY.running, { exact: true })).toBeVisible();
    await expect(button(page)).toBeDisabled();
  });

  test("B6: no pipeline — the status still shows, the reason, and no button (AC-5)", async ({ page }) => {
    await mock(page, { scores: F.ANSWERS.NO_PIPELINE });
    const main = await open(page);
    await expect(main.getByText(F.COPY.noPipeline, { exact: true })).toBeVisible();
    await expect(button(page)).toHaveCount(0);
    expect(squash(await main.innerText())).toContain(`${F.COPY.lastPublishedPrefix}${await localeDate(page, F.LATEST_AT)}`);
  });

  test("B7: none published reads \"not yet\" and a count of 0; a failed read says so and shows no count (AC-1)", async ({ page }) => {
    await mock(page, { scores: F.ANSWERS.NOT_YET });
    let main = await open(page);
    let text = squash(await main.innerText());
    expect(text).toContain(F.COPY.notYet);
    expect(text).toContain(`${F.COPY.countPrefix}0`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { scores: F.ANSWERS.UNREADABLE });
    main = await open(page);
    text = squash(await main.innerText());
    expect(text).toContain(F.COPY.unreadable);
    expect(text).not.toContain(F.COPY.notYet);
    expect(text).not.toContain(F.COPY.countPrefix.trim());
  });

  test('B8: a refused press says "Couldn\'t start a recalculation: …" (AC-2, AC-3)', async ({ page }) => {
    for (const press of [
      { status: 409, body: { success: false, code: F.CODES.already, run: 'running' } },
      { status: 503, body: { success: false, code: F.CODES.queueUnavailable } },
    ]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { press });
      await open(page);
      await button(page).click();
      await expect(page.getByText(F.COPY.couldNotStartPrefix.trim(), { exact: false }), `HTTP ${press.status}`).toBeVisible();
      await expect(page.getByText(F.COPY.started, { exact: true })).toHaveCount(0);
    }
  });

  test('B9: an unknown run state claims nothing and keeps the button (story § Open questions)', async ({ page }) => {
    await mock(page, { scores: F.ANSWERS.UNKNOWN });
    const main = await open(page);
    const text = squash(await main.innerText());
    expect(text).not.toContain(F.COPY.queued);
    expect(text).not.toContain(F.COPY.running);
    await expect(button(page)).toBeEnabled();
  });

  test('B10: read-only on load — one GET of the read, and nothing but GETs until the press (AC-2)', async ({ page }) => {
    const log = await mock(page);
    await open(page, 2500);
    expect(log.reads, 'one read per load').toBe(1);
    expect(log.presses, 'no press on load').toEqual([]);
    expect(log.nonGet, 'nothing but GETs').toEqual([]);
  });
});
