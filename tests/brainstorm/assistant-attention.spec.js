const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');

/**
 * assistant-identification-tags #1: the one answer, and the hub's first real mark — the browser class.
 *
 * Story: engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0001-one-assistant-attention-answer.md
 * Plan:  engineering-team/stories/assistant-identification-tags/1-the-one-answer-and-the-hubs-first-real-mark.test-plan.md
 * Node half: test/assistant-attention.test.js (L/U/C/S/D/R/H). Canned answers: test/helpers/identificationTagsFixtures.js.
 *
 *   B0 — the served origin runs a build that asks /api/assistant/attention.                        [prerequisite]
 *   B1 — a done answer: nine cards marked, the Identification Tags card not, "9 actions need
 *        attention" on the hub, and 9 in the pill.                                                  [AC-5]
 *   B2 — a pending answer: ten marks, "10 actions", 10 in the pill.                                 [AC-5]
 *   B3 — an unfinished answer: the hub marks ten and says "10 actions"; the pill says 9.            [AC-5]
 *   B4 — the fetch fails: the hub marks ten; the pill says 9.                                       [AC-5]
 *   B5 — while the answer is on its way, no pill (setup done); the pill then shows with the
 *        answer's count, never a count that changes under the viewer.                               [AC-5]
 *   B6 — read-only: one GET of /api/assistant/attention per full load, with no parameters, and
 *        nothing but GETs; moving inside the app asks nothing new.                                  [AC-7]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/setup/status always answers "all done", so the Assistant pill has its turn;
 * /api/assistant/attention answers per scenario: an object, 'hang', 'error' (a 500), or { delayMs, body }.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: nothing asks /api/assistant/attention, every card is marked and the
 * pill says ten whatever the answer.
 */

const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };

const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pathname = (page) => new URL(page.url()).pathname;
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const setupPillOf = (page) => page.locator('a.bs-setup-alert[href="/setup"]');
const cardOf = (page, title) => page.locator('.bs-assistant-hub-card').filter({ has: page.getByRole('link', { name: new RegExp(`${title}$`) }) });

/** Mock every route. `attention` is the /api/assistant/attention answer: an object, 'hang', 'error', or { delayMs, body }. */
async function mock(page, { who = CUSTOMER_USER, attention = T.PENDING } = {}) {
  const log = { attentionCalls: [], api: [], nonGet: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-attention.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
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
  await page.route('**/api/assistant/attention**', async (r) => {
    log.attentionCalls.push(r.request().url());
    if (attention === 'hang') return new Promise(() => {});
    if (attention === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    if (attention && attention.delayMs !== undefined) {
      await wait(attention.delayMs);
      try { return await r.fulfill(json(attention.body)); } catch { return undefined; }
    }
    return r.fulfill(json(attention));
  });
  return log;
}

async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
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

/** The pill's count on /about, as its words say it. */
async function pillCount(page) {
  await open(page, '/about');
  await expect(pillOf(page)).toHaveCount(1);
  const words = squash(await pillOf(page).evaluate((el) => el.textContent));
  const m = words.match(/· (\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

/** What the hub shows: the marks, the count line, and whether the Identification Tags card is marked. */
async function hubState(page) {
  await open(page, X.HUB);
  const main = page.locator('main').first();
  const marks = await main.getByText(X.COPY.needsAttention, { exact: true }).count();
  const text = squash(await main.evaluate((el) => el.textContent));
  const m = text.match(/(\d+) actions? needs? attention/);
  const card = cardOf(page, 'Identification Tags');
  await expect(card, 'the Identification Tags card is on the hub').toHaveCount(1);
  const idMarked = (await card.getByText(X.COPY.needsAttention, { exact: true }).count()) > 0;
  return { marks, count: m ? Number(m[1]) : null, idMarked };
}

test.describe('The one answer, and the hub\'s first real mark (assistant-identification-tags #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that asks /api/assistant/attention', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, '/api/assistant/attention');
    expect(found, `the bundle served by ${baseURL} does not ask /api/assistant/attention (${why}). Rebuild the UI, or the story is not built yet — B1–B6 say so directly.`).toBe(true);
  });

  test('B1: a done answer — nine cards marked, the Identification Tags card not, "9 actions need attention", and 9 in the pill (AC-5)', async ({ page }) => {
    await mock(page, { attention: T.DONE });
    const hub = await hubState(page);
    expect(hub, 'the hub with the check done').toEqual({ marks: 9, count: 9, idMarked: false });
    expect(await pillCount(page), 'the pill counts nine').toBe(9);
  });

  test('B2: a pending answer — ten marks, "10 actions need attention", and 10 in the pill (AC-5)', async ({ page }) => {
    await mock(page, { attention: T.PENDING });
    const hub = await hubState(page);
    expect(hub).toEqual({ marks: 10, count: 10, idMarked: true });
    expect(await pillCount(page)).toBe(10);
  });

  test('B3: an unfinished answer — the hub marks ten and says "10 actions"; the pill counts only the confident nine (AC-5)', async ({ page }) => {
    await mock(page, { attention: T.UNFINISHED });
    const hub = await hubState(page);
    expect(hub, 'the page marks until proven done').toEqual({ marks: 10, count: 10, idMarked: true });
    expect(await pillCount(page), 'the pill counts a checked action only from a finished, missing answer').toBe(9);
  });

  test('B4: the fetch fails — the hub marks ten; the pill says 9 (AC-5)', async ({ page }) => {
    await mock(page, { attention: 'error' });
    const hub = await hubState(page);
    expect(hub).toEqual({ marks: 10, count: 10, idMarked: true });
    expect(await pillCount(page)).toBe(9);
  });

  test('B5: while the answer is on its way no pill shows (setup done); it then shows with the answer\'s count, which never changes under the viewer (ADR 0001 sub-decision 8)', async ({ page }) => {
    await mock(page, { attention: 'hang' });
    await open(page, '/about', 2000);
    await expect(pillOf(page), 'no Assistant pill while the attention answer is on its way').toHaveCount(0);
    await expect(setupPillOf(page), 'and no Setup pill: setup is done').toHaveCount(0);

    await mock(page, { attention: { delayMs: 1500, body: T.DONE } });
    await page.goto('/about');
    await page.waitForLoadState('domcontentloaded');
    const seen = new Set();
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      if (await pillOf(page).count()) {
        const words = squash(await pillOf(page).evaluate((el) => el.textContent));
        const m = words.match(/· (\d+) actions? needs? attention/);
        if (m) seen.add(Number(m[1]));
      }
      await page.waitForTimeout(100);
    }
    expect([...seen], 'the pill showed only the answered count').toEqual([9]);
  });

  test('B6: read-only — one GET of /api/assistant/attention per full load with no parameters, nothing but GETs, and nothing new when moving inside the app (AC-7)', async ({ page }) => {
    const log = await mock(page, { attention: T.DONE });
    await open(page, '/about');
    await expect(pillOf(page)).toHaveCount(1);
    expect(log.nonGet, 'nothing is published, signed or stored').toEqual([]);
    expect(log.attentionCalls, 'one attention read for the load').toHaveLength(1);
    expect(new URL(log.attentionCalls[0]).search, 'the server answers for the session; the read carries no parameters').toBe('');
    await pillOf(page).click();
    await expect.poll(() => pathname(page)).toBe(X.HUB);
    await page.waitForTimeout(800);
    expect(log.attentionCalls, 'the hub reads the same answer the pill already fetched').toHaveLength(1);
    expect(log.api.filter((a) => /publish|sign/i.test(a)), 'no publish or sign request').toEqual([]);
  });
});
