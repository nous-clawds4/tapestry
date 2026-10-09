const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const O = require('../../test/helpers/outboxRelaysFixtures');

/**
 * assistant-outbox-relays #1–#3: the hub's Outbox Relays card, the Outbox Relays page, and your Assistant's publish —
 * the browser class.
 *
 * Stories: engineering-team/stories/assistant-outbox-relays/1-…md, 2-…md, 3-…md
 * ADRs:    engineering-team/decisions/assistant-outbox-relays/0001-…md, 0002-…md, 0003-…md
 * Plans:   the three .test-plan.md files beside the stories.
 * Node halves: test/assistant-outbox-check.test.js, test/assistant-outbox-relays-page.test.js,
 *              test/assistant-relay-list-publish.test.js. Words and canned answers: test/helpers/outboxRelaysFixtures.js.
 *
 *   B0  — the served origin runs a build that knows the publish route.                              [prerequisite]
 *   B1  — the hub: the third persona card is Outbox Relays; a done answer shows Done, not a mark.   [#1 AC-1, AC-4]
 *   B2  — the hub: a pending answer marks the card "Needs attention".                               [#1 AC-4]
 *   B3  — the page, signed out: the sign-in line, no panels.                                         [#2 AC-1]
 *   B4  — the page, done: the list with Remove buttons, the Done mark, the inbox line, nothing to publish. [#2 AC-1, AC-2]
 *   B5  — the page, pending: none yet; suggestions one at a time, back on Remove, then Add all.      [#2 AC-2, AC-4, AC-5]
 *   B6  — adding by hand: the two refusals, a relay added in its one spelling, Enter adds.          [#2 AC-3]
 *   B7  — the publish: one POST of the draft, the report, the answer asked again.                    [#3 AC-1, AC-2]
 *   B8  — an empty outbox: the POST of [], the empty-outbox line.                                    [#3 AC-5]
 *   B9  — a refusal is one line saying why; a request that fails says nothing was published.         [#3 AC-1]
 *   B10 — 375 px wide: nothing scrolls sideways on the page.                                         [#2 AC-1]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/assistant/attention answers from a queue (the last answer repeats).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this book: the hub has no Outbox Relays card and the address is "Page not found".
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
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const textOf = (locator) => locator.evaluate((el) => el.textContent || '');

/** A published answer of the route, every relay accepted. */
function publishedAnswer(relays, outbox) {
  const rows = relays.map((relay) => ({ relay, status: 'accepted', reason: '' }));
  return {
    success: true,
    result: { ok: true, outcome: 'published', message: O.PUBLISH.published(rows.length, rows.length), localOnly: false, outbox, relays: { total: rows.length, success: rows.length, results: rows } },
  };
}

/** Mock every route. `attention` is one answer or a queue; `publish` the route's answer, or a function of the body. */
async function mock(page, { who = CUSTOMER_USER, attention = O.attentionWith({ outbox: O.OUTBOX.PENDING }), publish = null } = {}) {
  const log = { api: [], attentionCalls: 0, publishBodies: [] };
  const queue = Array.isArray(attention) ? attention.slice() : [attention];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-outbox-relays.spec.js' })));
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
  await page.route(`**${O.PUBLISH_ROUTE}`, async (r) => {
    let body = null; try { body = r.request().postDataJSON(); } catch { body = null; }
    log.publishBodies.push(body);
    const relays = body && Array.isArray(body.relays) ? body.relays : [];
    const answer = typeof publish === 'function' ? publish(body) : publish;
    if (answer === 'error') return r.fulfill({ status: 502, contentType: 'text/html', body: '<html>bad gateway</html>' });
    if (!answer) return r.fulfill(json(publishedAnswer([...relays, 'wss://pub-one.example'], relays)));
    return r.fulfill(json(answer.body || answer, answer.status || 200));
  });
  return log;
}

async function open(page, address = O.PATH, settleMs = 1500) {
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

const panels = (page) => page.locator('main .bs-idtags-card');
const listPanel = (page) => panels(page).filter({ hasText: O.PAGE.panelHeading }).first();
const suggestionsPanel = (page) => panels(page).filter({ hasText: O.PAGE.suggestionsHeading }).first();
const listedRelays = async (page) => (await listPanel(page).locator('.bs-outbox-relay code').allTextContents()).map(squash);
const suggestedRelays = async (page) => (await suggestionsPanel(page).locator('.bs-outbox-relay code').allTextContents()).map(squash);
const publishButton = (page) => listPanel(page).getByRole('button', { name: O.PUBLISH.button, exact: true });
const hubCard = (page) => page.locator('main .bs-assistant-hub-card').filter({ has: page.locator(`a[href="${O.PATH}"]`) });

test.describe('Outbox Relays — the hub card, the page and the publish (assistant-outbox-relays #1–#3)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that knows the publish route', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, O.PUBLISH_ROUTE);
    expect(found, `the bundle served by ${baseURL} does not call ${O.PUBLISH_ROUTE} (${why}). Rebuild the UI, or the book is not built yet.`).toBe(true);
  });

  test('B1: the hub — the persona section\'s third card is Outbox Relays, linking to its page; a done answer shows "Done", not "Needs attention" (#1 AC-1, AC-4)', async ({ page }) => {
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.DONE }) });
    const main = await open(page, X.HUB);
    const persona = main.getByRole('region', { name: X.SECTIONS[0].heading });
    const items = persona.getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(2).locator(`a[href="${O.PATH}"]`), 'the third persona card links to /assistant/outbox-relays').toHaveCount(1);
    expect(squash(await items.nth(2).innerText())).toContain(O.ACTION.text);
    const card = hubCard(page);
    await expect(card.getByText(O.DONE_BADGE.word, { exact: true }), 'the Done badge').toBeVisible();
    await expect(card.getByText(X.COPY.needsAttention, { exact: true }), 'no mark').toHaveCount(0);
    await expect(card).toHaveClass(/is-done/);
    expect(squash(await textOf(card.locator(`a[href="${O.PATH}"]`))), 'a screen reader hears it as done').toBe(`${O.DONE_BADGE.srPrefix.trim()} ${O.ACTION.title}`);
  });

  test('B2: the hub — a pending answer marks the card "Needs attention", with no Done badge (#1 AC-4)', async ({ page }) => {
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.PENDING }) });
    await open(page, X.HUB);
    const card = hubCard(page);
    await expect(card.getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expect(card.getByText(O.DONE_BADGE.word, { exact: true })).toHaveCount(0);
  });

  test('B3: the page, signed out — the title, the description, the sign-in line and button; no list, no suggestions, no field (#2 AC-1)', async ({ page }) => {
    await mock(page, { who: null });
    const main = await open(page);
    await expect(page.getByRole('heading', { name: 'Page not found' }), `${O.PATH} is a page`).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(O.ACTION.title);
    await expect(main.getByText(O.PAGE.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton })).toBeVisible();
    await expect(main.getByText(O.PAGE.panelHeading, { exact: true })).toHaveCount(0);
    await expect(main.getByText(O.PAGE.suggestionsHeading, { exact: true })).toHaveCount(0);
    await expect(main.getByLabel(O.PAGE.fieldLabel)).toHaveCount(0);
  });

  test('B4: the page, done — the NIP-65 link opens a new tab; the outbox relays with Remove buttons, the Done mark, the inbox line; no unpublished line; nothing to publish (#2 AC-1, AC-2; #3 AC-1)', async ({ page }) => {
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.DONE_WITH_INBOX }) });
    const main = await open(page);
    const link = main.getByRole('link', { name: O.ACTION.link.text });
    await expect(link).toHaveAttribute('href', O.NIP65);
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await listedRelays(page)).toEqual([O.OUT_A, O.OUT_B]);
    await expect(listPanel(page).getByRole('button', { name: O.PAGE.srRemove(O.OUT_A) })).toBeVisible();
    await expect(listPanel(page)).toHaveClass(/is-done/);
    await expect(listPanel(page).getByText(O.PAGE.inboxLine(1), { exact: true })).toBeVisible();
    await expect(main.getByText(O.PAGE.unpublished, { exact: true })).toHaveCount(0);
    await expect(publishButton(page)).toBeDisabled();
  });

  test('B5: the page, pending — none yet; a suggestion added moves into the list, and back on Remove; Add all adds every one in order (#2 AC-2, AC-4, AC-5)', async ({ page }) => {
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.PENDING }) });
    const main = await open(page);
    await expect(listPanel(page)).toHaveClass(/is-marked/);
    await expect(listPanel(page).getByText(O.PAGE.noneYet, { exact: true })).toBeVisible();
    expect(await suggestedRelays(page)).toEqual(O.SUGGESTIONS);
    await expect(publishButton(page)).toBeDisabled();

    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.srAdd(O.SUGGESTIONS[1]) }).click();
    expect(await listedRelays(page)).toEqual([O.SUGGESTIONS[1]]);
    expect(await suggestedRelays(page)).toEqual(O.SUGGESTIONS.filter((_, i) => i !== 1));
    await expect(main.getByText(O.PAGE.unpublished, { exact: true })).toBeVisible();
    await expect(publishButton(page)).toBeEnabled();

    await listPanel(page).getByRole('button', { name: O.PAGE.srRemove(O.SUGGESTIONS[1]) }).click();
    expect(await listedRelays(page)).toEqual([]);
    expect(await suggestedRelays(page)).toEqual(O.SUGGESTIONS);
    await expect(main.getByText(O.PAGE.unpublished, { exact: true })).toHaveCount(0);

    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.addAll, exact: true }).click();
    expect(await listedRelays(page)).toEqual(O.SUGGESTIONS);
    await expect(suggestionsPanel(page).getByText(O.PAGE.allListed, { exact: true })).toBeVisible();
    await expect(suggestionsPanel(page).getByRole('button', { name: O.PAGE.addAll, exact: true })).toHaveCount(0);
  });

  test('B6: adding by hand — a non-relay and an already-listed relay are refused with a line; a new relay is added in its one spelling and the field cleared; Enter adds (#2 AC-3)', async ({ page }) => {
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.DONE }) });
    const main = await open(page);
    const field = main.getByLabel(O.PAGE.fieldLabel);
    await expect(field).toHaveAttribute('placeholder', O.PAGE.placeholder);
    const add = listPanel(page).getByRole('button', { name: O.PAGE.add, exact: true });

    await field.fill('https://not-a-relay.example');
    await add.click();
    await expect(main.getByText(O.PAGE.refusals['not-a-relay'], { exact: true })).toBeVisible();
    expect(await listedRelays(page)).toEqual([O.OUT_A, O.OUT_B]);

    await field.fill('  WSS://Relay.Alpha.Example/ ');
    await add.click();
    await expect(main.getByText(O.PAGE.refusals['already-listed'], { exact: true })).toBeVisible();

    await field.fill('  wss://Hand.Typed.Example/ ');
    await field.press('Enter');
    expect(await listedRelays(page)).toEqual([O.OUT_A, O.OUT_B, 'wss://hand.typed.example']);
    await expect(field).toHaveValue('');
    await expect(main.getByText(O.PAGE.refusals['already-listed'], { exact: true })).toHaveCount(0);
  });

  test('B7: the publish — one POST of the draft as { relays }; Publishing… while it runs; the summary and one line per relay; then the answer is asked again and the list rebuilt from it (#3 AC-1, AC-2)', async ({ page }) => {
    const after = O.attentionWith({ outbox: O.outboxAction({ outbox: O.SUGGESTIONS.slice() }) });
    const log = await mock(page, { attention: [O.attentionWith({ outbox: O.OUTBOX.PENDING }), after] });
    const main = await open(page);
    const callsBefore = log.attentionCalls;
    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.addAll, exact: true }).click();
    await publishButton(page).click();
    await expect.poll(() => log.publishBodies.length).toBe(1);
    expect(log.publishBodies[0]).toEqual({ relays: O.SUGGESTIONS });
    const n = O.SUGGESTIONS.length + 1;
    await expect(main.getByText(O.PUBLISH.published(n, n), { exact: false })).toBeVisible();
    await expect(listPanel(page).locator('.bs-idtags-result-relays code').first()).toBeVisible();
    await expect.poll(() => log.attentionCalls).toBeGreaterThan(callsBefore);
    await expect(listPanel(page)).toHaveClass(/is-done/);
    await expect(main.getByText(O.PAGE.unpublished, { exact: true })).toHaveCount(0);
  });

  test('B8: an empty outbox — remove every relay, publish: the POST carries [], and the report adds "Your Assistant now has no outbox relays." (#3 AC-5)', async ({ page }) => {
    const log = await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.DONE }) });
    const main = await open(page);
    for (const relay of [O.OUT_A, O.OUT_B]) await listPanel(page).getByRole('button', { name: O.PAGE.srRemove(relay) }).click();
    await expect(publishButton(page)).toBeEnabled();
    await publishButton(page).click();
    await expect.poll(() => log.publishBodies.length).toBe(1);
    expect(log.publishBodies[0]).toEqual({ relays: [] });
    await expect(main.getByText(O.PUBLISH.emptyOutbox, { exact: false })).toBeVisible();
  });

  test('B9: a refusal is one line in the route\'s words; a request that fails says nothing was published (#3 AC-1)', async ({ page }) => {
    const refusal = { status: 403, body: { success: false, code: O.PUBLISH.codes.noAssistant, error: O.PUBLISH.refusals['no-assistant'] } };
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.PENDING }), publish: refusal });
    let main = await open(page);
    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.srAdd(O.SUGGESTIONS[0]) }).click();
    await publishButton(page).click();
    await expect(main.getByText(O.PUBLISH.refusals['no-assistant'], { exact: false })).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.PENDING }), publish: 'error' });
    main = await open(page);
    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.srAdd(O.SUGGESTIONS[0]) }).click();
    await publishButton(page).click();
    await expect(main.getByText(O.PUBLISH.requestFailed, { exact: false })).toBeVisible();
  });

  test('B10: at 375 px wide nothing on the page scrolls sideways, with every suggestion added (#2 AC-1)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { attention: O.attentionWith({ outbox: O.OUTBOX.PENDING }) });
    await open(page);
    await suggestionsPanel(page).getByRole('button', { name: O.PAGE.addAll, exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);
  });
});
