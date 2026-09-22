const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');

/**
 * assistant-identification-tags #3: your Assistant's two taggings — the browser class.
 *
 * Story: engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0003-your-assistant-signs-its-two-taggings-through-one-narrow-route.md
 * Plan:  engineering-team/stories/assistant-identification-tags/3-your-assistants-two-taggings.test-plan.md
 * Node half: test/assistant-taggings-publish.test.js (E/B/C/S/R/H). Words and answers: test/helpers/identificationTagsFixtures.js.
 *
 *   B0 — the served origin runs a build with the second card's button.                                [prerequisite]
 *   B1 — a pending answer: the second card's button, enabled; the first card's stays disabled (done).   [AC-5]
 *   B2 — the press: one POST with the checked keys, the row's summary and relay lines, the rows flip
 *        to Present, the hub counts nine.                                                              [AC-1, AC-4, AC-5]
 *   B3 — a failed local write and a tag not found, each on its own row; the tone rule.                 [AC-4, AC-6]
 *   B4 — a whole-request refusal (no Assistant) shows its words; a request that never answers shows
 *        the notice; nothing else changes.                                                             [AC-2, AC-5]
 *   B5 — during the second card's press the first card's controls stay enabled; nothing is posted
 *        before the press.                                                                             [AC-5, AC-7]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; the publish route answers per scenario and logs its bodies; the attention route answers
 * a queue so the rows can flip after a press. No signer is needed: the Assistant signs on the server, which is mocked.
 *
 * These FAIL against the build before this story: the second card has no button.
 */

const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const ASSISTANT_ROWS = T.REQUIRED.filter((e) => e.signer === 'assistant');
const OWNER_ROW = ASSISTANT_ROWS[0];
const HUMAN_ROW = ASSISTANT_ROWS[1];

const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};
/** Both of the Assistant's taggings missing, the person's present, definitions found. */
const ASSISTANT_MISSING = T.attentionAnswer({
  finished: true, done: false, pending: true,
  rows: T.REQUIRED.map((e) => T.taggingRow(e, e.signer === 'assistant' ? { present: false, source: null } : {})),
});

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const textOf = (locator) => locator.evaluate((el) => el.textContent || '');

/** Mock every route. `publish` is the route's answer, 'hang' (never answers), or a function of the posted keys. */
async function mock(page, { who = CUSTOMER_USER, attention = ASSISTANT_MISSING, publish = null } = {}) {
  const log = { api: [], nonGet: [], attentionCalls: 0, publishBodies: [] };
  const queue = Array.isArray(attention) ? attention.slice() : [attention];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-taggings-publish.spec.js' })));
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
  await page.route('**/api/publish-policy', (r) => r.fulfill(json({ success: true, allowExternalPublish: false })));
  await page.route('**/api/assistant/attention**', (r) => {
    log.attentionCalls += 1;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    return r.fulfill(json(next));
  });
  await page.route(`**${T.PUBLISH_ROUTE}`, async (r) => {
    let body = null; try { body = r.request().postDataJSON(); } catch { body = null; }
    log.publishBodies.push(body);
    if (publish === 'hang') return new Promise(() => {});
    const answer = typeof publish === 'function' ? publish(body) : publish;
    if (!answer) return r.fulfill(json(T.serverAnswer(ASSISTANT_ROWS.map((e) => T.serverPublishedRow(e)))));
    return r.fulfill(json(answer.body || answer, answer.status || 200));
  });
  return log;
}

async function open(page, address = T.PAGE, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(settleMs);
  return page.locator('main').first();
}

async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
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

const cards = (page) => page.locator('.bs-idtags-card');
const personCard = (page) => cards(page).nth(0);
const assistantCard = (page) => cards(page).nth(1);
const boxOf = (card, name) => card.getByRole('checkbox', { name, exact: true });
const buttonOf = (card, name) => card.getByRole('button', { name, exact: true });
const results = (card) => card.locator('.bs-idtags-results');

test.describe("Your Assistant's two taggings (assistant-identification-tags #3)", () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build with the second card\'s button', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, T.PUBLISH_ROUTE);
    expect(found, `the bundle served by ${baseURL} does not call ${T.PUBLISH_ROUTE} (${why}). Rebuild the UI, or the story is not built yet — B1–B5 say so directly.`).toBe(true);
  });

  test("B1: with the Assistant's two taggings missing, the second card offers \"Have your Assistant publish\", enabled, with both boxes checked; the first card is done (AC-5)", async ({ page }) => {
    await mock(page);
    await open(page);
    const card = assistantCard(page);
    await expect(card).toHaveClass(/is-marked/);
    for (const e of ASSISTANT_ROWS) await expect(boxOf(card, e.name)).toBeChecked();
    await expect(buttonOf(card, T.PAGE_COPY.buttons.assistant)).toBeEnabled();
    await expect(personCard(page)).toHaveClass(/is-done/);
    // Story 2 AC-3: a card's button stays rendered and disabled while nothing is checked (its B1 pins the same).
    const personButton = buttonOf(personCard(page), T.PAGE_COPY.buttons.person);
    if (await personButton.count()) await expect(personButton, "the first card's button, nothing to publish").toBeDisabled();
  });

  test('B2: the press — one POST with the checked keys; each row\'s summary and relay lines; then the rows flip and the hub counts nine (AC-1, AC-4, AC-5)', async ({ page }) => {
    const log = await mock(page, { attention: [ASSISTANT_MISSING, T.DONE] });
    await open(page);
    const card = assistantCard(page);
    await boxOf(card, OWNER_ROW.name).uncheck();
    await buttonOf(card, T.PAGE_COPY.buttons.assistant).click();
    await expect.poll(() => log.publishBodies.length, { timeout: 15000 }).toBe(1);
    expect(log.publishBodies[0], 'only the checked key').toEqual({ keys: [HUMAN_ROW.key] });
    await expect(results(card)).toBeVisible();
    const text = squash(await textOf(results(card)));
    const row = T.serverPublishedRow(HUMAN_ROW);
    expect(text).toContain(row.message);
    expect(text).toContain('wss://a.example — accepted');
    expect(text).not.toContain(`"${OWNER_ROW.name}"`);
    await expect.poll(() => log.attentionCalls, 'the answer was re-read').toBeGreaterThanOrEqual(2);
    await expect(card, 'the rows flipped').toHaveClass(/is-done/, { timeout: 10000 });
    await page.goto(X.HUB);
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(squash(await textOf(page.locator('main').first()))).toContain(X.countText(9));
  });

  test('B3: a failed local write and a tag not found — each on its own row, with the error tone; the card stays marked (AC-4, AC-6)', async ({ page }) => {
    await mock(page, { publish: T.serverAnswer([T.serverLocalFailedRow(OWNER_ROW), T.serverTagNotFoundRow(HUMAN_ROW)]) });
    await open(page);
    const card = assistantCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.assistant).click();
    await expect(results(card)).toBeVisible();
    await page.waitForTimeout(1000);
    const text = squash(await textOf(results(card)));
    expect(text).toContain(T.serverLocalFailedRow(OWNER_ROW).message);
    expect(text).toContain(T.PAGE_COPY.tagNotFound(HUMAN_ROW.name));
    await expect(results(card).locator('.bs-idtags-result.is-error')).toHaveCount(2);
    await expect(card).toHaveClass(/is-marked/);
  });

  test('B4: a whole-request refusal shows its words; a request that never answers shows the notice (AC-2, AC-5)', async ({ page }) => {
    await mock(page, { publish: { status: 403, body: T.serverRefusal('no-assistant') } });
    await open(page);
    let card = assistantCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.assistant).click();
    await page.waitForTimeout(1200);
    expect(squash(await textOf(card))).toContain(T.REFUSALS['no-assistant']);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await page.route(`**${T.PUBLISH_ROUTE}`, (r) => r.abort('failed'));
    await mock(page);
    await page.unroute(`**${T.PUBLISH_ROUTE}`);
    await page.route(`**${T.PUBLISH_ROUTE}`, (r) => r.abort('failed'));
    await open(page);
    card = assistantCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.assistant).click();
    await page.waitForTimeout(1500);
    expect(squash(await textOf(card))).toContain(T.REQUEST_FAILED);
    await expect(buttonOf(card, T.PAGE_COPY.buttons.assistant), 'the button is back').toBeEnabled();
  });

  test("B5: during the second card's press the first card's controls stay enabled, and nothing is posted before a press (AC-5, AC-7)", async ({ page }) => {
    const both = T.attentionAnswer({ finished: true, done: false, pending: true, rows: T.REQUIRED.map((e) => T.taggingRow(e, { present: false, source: null })) });
    const log = await mock(page, { attention: both, publish: 'hang' });
    await open(page);
    expect(log.nonGet, 'nothing posted before a press').toEqual([]);
    await buttonOf(assistantCard(page), T.PAGE_COPY.buttons.assistant).click();
    await page.waitForTimeout(800);
    await expect(buttonOf(assistantCard(page), T.PAGE_COPY.publishing)).toBeDisabled();
    await expect(buttonOf(personCard(page), T.PAGE_COPY.buttons.person), "the first card's button").toBeEnabled();
    await expect(boxOf(personCard(page), T.REQUIRED[0].name), "the first card's boxes").toBeEnabled();
    expect(log.publishBodies).toHaveLength(1);
  });
});
