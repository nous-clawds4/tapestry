const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');
const O = require('../../test/helpers/outboxRelaysFixtures');
const TC = require('../../test/helpers/trustedContentFixtures');
const DC = require('../../test/helpers/dutyCardsFixtures');
const CS = require('../../test/helpers/comingSoonFixtures');
const DM = require('../../test/helpers/dutyMenuFixtures');
const SM = require('../../test/helpers/selfMapFixtures');

/**
 * assistant-duty-menu #1: the hub's Duty Menu card and the Duty Menu page — the browser class.
 *
 * Story: engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.md
 * ADR:   engineering-team/decisions/assistant-duty-menu/0001-a-duty-menu-check-beside-the-others.md
 * Plan:  engineering-team/stories/assistant-duty-menu/1-the-duty-menu-page-and-its-check.test-plan.md
 * Node halves: test/assistant-duty-menu-check.test.js, test/assistant-duty-menu-page.test.js.
 * Words and canned answers: test/helpers/dutyMenuFixtures.js.
 *
 *   B0  — the served origin runs a build that has the Duty Menu page.                                   [prerequisite]
 *   B1  — the hub card: a done answer shows Done, not a mark; a pending one is marked; it links to its page. [AC-4]
 *   B2  — the hub's count line and the pill: done, pending and unfinished, against the placeholders.    [AC-4]
 *   B3  — the page, signed out: the sign-in line and button; no panels.                                 [AC-5]
 *   B4  — the page, no Assistant here: the no-assistant line and its link to Account Setup; no panels.  [AC-5]
 *   B5  — the page, up to date: the offer and the published menu, one line per row (category, key, relay),
 *         the Done mark, the status line and the public line; the back link.                           [AC-5]
 *   B6  — none published: the none line, Needs attention, the not-published status line.               [AC-5]
 *   B7  — out of date: the published rows as found (a not-offered row says so), the out-of-date line.   [AC-5]
 *   B8  — the check did not finish: its reason; the offer still shows; Needs attention; no status line. [AC-5]
 *   B9  — while the answer is on its way: Checking…; when the request fails: the failed line, no status line. [AC-5]
 *   B10 — an empty offer: the panel says so.                                                             [AC-5]
 *   B11 — read-only, one request: one GET of the answer per load, nothing but GETs, no publish.         [AC-6]
 *
 * Story 2 (assistant-duty-menu #2, ADR 0002 sub-decision 8; the POST is mocked):
 *   B12 — the button: enabled when none, out of date, unfinished or the request failed; disabled when up to
 *         date and while checking.                                                                 [#2 AC-1]
 *   B13 — the press: Publishing… (disabled), one POST with no body, the report (summary and one line per
 *         relay, in the Outbox Relays page's words), then the answer asked again and the panel Done.  [#2 AC-1]
 *   B14 — a refusal, a failed request and a failed local write: one line, nothing asked again.     [#2 AC-1]
 *   B15 — local-only (kept-local words, skipped lines) and an empty publish (the "now lists no duties" line).
 *                                                                                                   [#2 AC-1, AC-3]
 *   B16 — a found menu with no rows says "Your Assistant's Duty Menu lists no duties."             [#2 AC-6]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/assistant/attention answers per scenario: an object, 'hang' or 'error' (a 500).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: /assistant/duty-menu is the placeholder page, and the hub's Duty Menu
 * card is always marked and counted.
 */

const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null };

const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const ACTION = DC.CARDS.find((c) => c.key === DM.KEY);

/** Every other checked action done, and the Duty Menu as given: the counts then move with the Duty Menu alone. */
function answerWith(dutyMenu) {
  return {
    success: true, signedIn: true, hasAssistant: true,
    actions: {
      [T.CHECKED_ACTION]: T.DONE.actions[T.CHECKED_ACTION],
      profile: P.PROFILE_DONE,
      [O.KEY]: O.OUTBOX.DONE,
      ...TC.trio((c) => TC.done(c)),
      [DM.KEY]: dutyMenu,
      // Re-aimed by assistant-self-map #1: the Treasure Map card, pending (not published), marked and counted as the
      // placeholder was.
      [SM.KEY]: SM.ANSWERS.NOT_PUBLISHED,
    },
  };
}
/**
 * The placeholders once the Duty Menu is checked (Your Assistant's Treasure Map among them). Re-aimed by assistant-coming-soon #1 (AC-2): the five that say Coming soon are never marked or counted.
 */
// Re-aimed by assistant-self-map #1: no placeholder is left; the one card answerWith always counts is the Treasure Map
// card, pending (SM.ANSWERS.NOT_PUBLISHED), so the counts below keep their numbers.
const PLACEHOLDERS = DC.ALL_KEYS.filter((k) => !DC.CHECKED.includes(k) && !CS.KEYS.includes(k)).length + 1;

/**
 * Mock every route. `attention` is an answer object, 'hang', 'error', or a queue of them (the last repeats); `publish`
 * is the POST's answer: an object { status?, body }, 'error' (a 502 that is not JSON), or { delayMs, body }.
 */
async function mock(page, { who = CUSTOMER_USER, attention = answerWith(DM.ANSWERS.DONE), publish = null } = {}) {
  const log = { api: [], nonGet: [], attentionCalls: [], publishCalls: [] };
  const queue = Array.isArray(attention) ? attention.slice() : [attention];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-duty-menu.spec.js' })));
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
  await page.route('**/api/assistant/attention**', (r) => {
    log.attentionCalls.push(r.request().url());
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === 'hang') return new Promise(() => {});
    if (next === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    return r.fulfill(json(next));
  });
  await page.route(`**${DM.PUBLISH.route}`, async (r) => {
    log.publishCalls.push({ method: r.request().method(), body: r.request().postData() });
    if (publish === 'error') return r.fulfill({ status: 502, contentType: 'text/html', body: '<html>bad gateway</html>' });
    const answer = publish || publishedAnswer();
    if (answer.delayMs) await wait(answer.delayMs);
    try { return await r.fulfill(json(answer.body || answer, answer.status || 200)); } catch { return undefined; }
  });
  return log;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** The route's answer (ADR 0002 sub-decision 5), every relay as given in `rows`. */
function publishedAnswer({ rows = [{ relay: 'wss://a-one.example', status: 'accepted', reason: '' }], duties = 6, localOnly = false, outcome, message } = {}) {
  const accepted = rows.filter((r) => r.status === 'accepted').length;
  const tried = rows.filter((r) => r.status !== 'skipped' && r.status !== 'not-sent').length;
  return {
    success: true,
    result: {
      ok: true,
      outcome: outcome || (localOnly ? 'kept-local' : accepted > 0 ? 'published' : 'not-delivered'),
      message: message || (localOnly ? DM.PUBLISH.localOnly : accepted > 0 ? DM.PUBLISH.published(accepted, tried) : DM.PUBLISH.noneAccepted(tried)),
      localOnly, duties, relays: { total: rows.length, success: accepted, results: rows },
    },
  };
}
const publishButton = (page) => page.getByRole('button', { name: DM.PUBLISH.button, exact: true });

async function open(page, address = DM.PATH, settleMs = 1500) {
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

const panels = (page) => page.locator('main .bs-idtags-card');
const offerPanel = (page) => panels(page).filter({ hasText: DM.PAGE.offerHeading }).first();
const publishedPanel = (page) => panels(page).filter({ hasText: DM.PAGE.publishedHeading }).first();
const hubCard = (page) => page.locator('main .bs-assistant-hub-card').filter({ has: page.locator(`a[href="${DM.PATH}"]`) });
const categoryName = (key) => (/^3038/.test(key) ? DM.CATEGORY_NAMES.scores : /^3039/.test(key) ? DM.CATEGORY_NAMES.lists : DM.CATEGORY_NAMES.concepts);

/** Each row is one line of the panel that names its category, its key and its relay (or "not offered"). */
async function expectRowLines(panel, rows, label) {
  const lines = (await panel.innerText()).split('\n').map(squash).filter(Boolean);
  for (const r of rows) {
    const tail = r.tag === 'duty' ? r.relay : DM.PAGE.notOffered;
    const hit = lines.find((l) => l.includes(categoryName(r.key)) && new RegExp(`(^|[^\\w:])${r.key.replace(/[*]/g, '\\*')}($|[^\\w])`).test(l) && l.includes(tail));
    expect(hit, `${label}: one line names ${categoryName(r.key)}, ${r.key} and ${tail}; the lines are ${JSON.stringify(lines)}`).toBeTruthy();
  }
}

/** No status line at all — the reason line is the only one (ADR 0001 Amendment 1 item 1). */
async function expectNoStatusLine(page, label) {
  const main = page.locator('main').first();
  for (const line of Object.values(DM.PAGE.status)) await expect(main.getByText(line, { exact: true }), `${label}: no status line`).toHaveCount(0);
}

/** The pill's count on /about, as its words say it. */
async function pillCount(page) {
  await open(page, '/about');
  await expect(pillOf(page)).toHaveCount(1);
  const m = squash(await pillOf(page).evaluate((el) => el.textContent)).match(/· (\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}
async function hubCount(page) {
  const main = await open(page, X.HUB);
  const m = squash(await main.evaluate((el) => el.textContent)).match(/(\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

test.describe('The Duty Menu card and page (assistant-duty-menu #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that has the Duty Menu page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, DM.PAGE.offerHeading);
    expect(found, `the bundle served by ${baseURL} does not carry "${DM.PAGE.offerHeading}" (${why}). Rebuild the UI, or the story is not built yet.`).toBe(true);
  });

  test('B1: the hub card — done shows Done and no mark, and a screen reader hears "Done: Duty Menu"; pending is marked "Needs attention"; the card leads to its page (AC-4)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.DONE) });
    await open(page, X.HUB);
    let card = hubCard(page);
    await expect(card.getByText(TC.DONE_COPY.done, { exact: true }), 'the Done badge').toBeVisible();
    await expect(card.getByText(X.COPY.needsAttention, { exact: true }), 'no mark').toHaveCount(0);
    expect(squash(await card.locator(`a[href="${DM.PATH}"]`).evaluate((el) => el.textContent))).toBe(`${TC.DONE_COPY.doneSrPrefix.trim()} ${ACTION.title}`);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(DM.ANSWERS.STALE) });
    await open(page, X.HUB);
    card = hubCard(page);
    await expect(card.getByText(X.COPY.needsAttention, { exact: true }), 'out of date: marked').toBeVisible();
    await expect(card.getByText(TC.DONE_COPY.done, { exact: true })).toHaveCount(0);
    await card.locator(`a[href="${DM.PATH}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(DM.PATH);
  });

  test('B2: the count line and the pill — done leaves the card out of both; pending counts it in both; unfinished marks it on the hub but the pill leaves it out (AC-4)', async ({ page }) => {
    const cases = [
      ['done', DM.ANSWERS.DONE, PLACEHOLDERS, PLACEHOLDERS],
      ['pending', DM.ANSWERS.NONE, PLACEHOLDERS + 1, PLACEHOLDERS + 1],
      ['unfinished', DM.ANSWERS.UNFINISHED, PLACEHOLDERS + 1, PLACEHOLDERS],
    ];
    for (const [label, dutyMenu, hub, pill] of cases) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { attention: answerWith(dutyMenu) });
      expect(await hubCount(page), `${label}: the hub's count line`).toBe(hub);
      expect(await pillCount(page), `${label}: the pill`).toBe(pill);
    }
  });

  test('B3: the page, signed out — the title, the description, the sign-in line and button; no panels (AC-5)', async ({ page }) => {
    await mock(page, { who: null });
    const main = await open(page);
    await expect(page.getByRole('heading', { name: 'Page not found' }), `${DM.PATH} is a page`).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(ACTION.title);
    expect(squash(await main.innerText())).toContain(ACTION.text);
    await expect(main.getByText(X.COPY.placeholder, { exact: true }), 'not the placeholder').toHaveCount(0);
    await expect(main.getByText(DM.PAGE.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton })).toBeVisible();
    await expect(main.getByText(DM.PAGE.offerHeading, { exact: true })).toHaveCount(0);
    await expect(main.getByText(DM.PAGE.publishedHeading, { exact: true })).toHaveCount(0);
  });

  test('B4: the page, signed in with no Assistant here — the hub\'s no-assistant line and its link to Account Setup; no panels (AC-5)', async ({ page }) => {
    const log = await mock(page, { who: GUEST_USER });
    const main = await open(page);
    await expect(main.getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: X.COPY.noAssistantLink, exact: true })).toHaveAttribute('href', '/setup');
    await expect(main.getByText(DM.PAGE.offerHeading, { exact: true })).toHaveCount(0);
    await expect(main.getByText(DM.PAGE.publishedHeading, { exact: true })).toHaveCount(0);
    expect(log.attentionCalls, 'nothing to check for a viewer with no Assistant').toEqual([]);
  });

  test('B5: up to date — the offer panel and the published panel, one line per row, the Done mark, the up-to-date line and the public line; the back link leads to the hub (AC-5)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.DONE) });
    const main = await open(page);
    await expect(offerPanel(page).getByText(DM.PAGE.offerExplainer, { exact: true })).toBeVisible();
    await expectRowLines(offerPanel(page), DM.ANSWERS.DONE.offer, 'the offer');
    await expectRowLines(publishedPanel(page), DM.ANSWERS.DONE.published.rows, 'the published menu');
    await expect(publishedPanel(page).getByText(TC.DONE_COPY.done, { exact: true }), 'the hub\'s Done mark').toBeVisible();
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toHaveCount(0);
    await expect(main.getByText(DM.PAGE.status.upToDate, { exact: true })).toBeVisible();
    await expect(main.getByText(DM.PAGE.status.outOfDate, { exact: true })).toHaveCount(0);
    await expect(main.getByText(DM.PAGE.publicLine, { exact: true })).toBeVisible();
    await main.getByRole('link', { name: X.COPY.backToHub, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(X.HUB);
  });

  // Re-aimed by ADR 0001 Amendment 2 item 3: the panel's none line is its own sentence, no longer the status line's.
  test('B6: none published — the published panel says "No Duty Menu was found for your Assistant." with Needs attention, and the status line is "not published yet", each once (AC-5)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.NONE) });
    const main = await open(page);
    await expect(publishedPanel(page).getByText(DM.PAGE.none, { exact: true })).toBeVisible();
    await expect(main.getByText(DM.PAGE.status.notPublished, { exact: true }), 'the status line, once').toHaveCount(1);
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expect(main.getByText(DM.PAGE.status.upToDate, { exact: true })).toHaveCount(0);
    await expect(main.getByText(DM.PAGE.status.outOfDate, { exact: true })).toHaveCount(0);
    await expectRowLines(offerPanel(page), DM.ANSWERS.NONE.offer, 'the offer still shows');
  });

  test('B7: out of date — the published rows as found, a not-offered row as "not offered", and the out-of-date line (AC-5)', async ({ page }) => {
    const rows = [...DM.STALE_ROWS, { tag: 'not-offered', key: '30385', relay: null }];
    const stale = { ...DM.ANSWERS.STALE, published: { ...DM.ANSWERS.STALE.published, rows } };
    await mock(page, { attention: answerWith(stale) });
    const main = await open(page);
    await expectRowLines(publishedPanel(page), rows, 'the published menu');
    await expect(main.getByText(DM.PAGE.status.outOfDate, { exact: true })).toBeVisible();
    await expect(main.getByText(DM.PAGE.status.upToDate, { exact: true })).toHaveCount(0);
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
  });

  test('B8: the check did not finish — the reason, the offer still shown, Needs attention (AC-5)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.UNFINISHED) });
    await open(page);
    await expect(publishedPanel(page).getByText(DM.PAGE.couldNotCheck['no-relay-answered'], { exact: true })).toBeVisible();
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expectRowLines(offerPanel(page), DM.ANSWERS.UNFINISHED.offer, 'the offer');
    await expectNoStatusLine(page, 'unfinished');
  });

  test('B9: Checking… while the answer is on its way; "Could not check: this instance did not answer." when the request fails (AC-5)', async ({ page }) => {
    await mock(page, { attention: 'hang' });
    await open(page);
    await expect(publishedPanel(page).getByText(DM.PAGE.checking, { exact: true })).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: 'error' });
    await open(page);
    await expect(publishedPanel(page).getByText(DM.PAGE.couldNotCheck['request-failed'], { exact: true })).toBeVisible();
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expectNoStatusLine(page, 'request failed');
  });

  test('B10: an empty offer — the offer panel says this instance publishes no duties yet (AC-5)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.EMPTY_DONE) });
    const main = await open(page);
    await expect(offerPanel(page).getByText(DM.PAGE.offerEmpty, { exact: true })).toBeVisible();
    await expect(main.getByText(DM.PAGE.status.upToDate, { exact: true })).toBeVisible();
  });

  test('B11: read-only, one request — one GET of /api/assistant/attention per full load, with no parameters; nothing but GETs; no publish or sign request (AC-6)', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(DM.ANSWERS.NONE) });
    await open(page, DM.PATH, 2500);
    expect(log.attentionCalls, 'one attention read for the load').toHaveLength(1);
    expect(new URL(log.attentionCalls[0]).search, 'the server answers for the session').toBe('');
    expect(log.nonGet, 'nothing is published, signed or stored').toEqual([]);
    expect(log.api.filter((a) => /publish|sign/i.test(a)), 'no publish or sign request').toEqual([]);
  });
  /* ───────── story 2: the button and its report ───────── */

  test('B12: the button — enabled when no menu was found, when it is out of date, when the check did not finish and when the request failed; disabled when the menu is up to date and while the answer is on its way (#2 AC-1)', async ({ page }) => {
    for (const [label, attention, enabled] of [
      ['none', answerWith(DM.ANSWERS.NONE), true], ['out of date', answerWith(DM.ANSWERS.STALE), true],
      ['unfinished', answerWith(DM.ANSWERS.UNFINISHED), true], ['request failed', 'error', true],
      ['up to date', answerWith(DM.ANSWERS.DONE), false], ['checking', 'hang', false],
    ]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { attention });
      await open(page);
      await expect(publishButton(page), `${label}: the button is there`).toHaveCount(1);
      if (enabled) await expect(publishButton(page), `${label}: enabled`).toBeEnabled();
      else await expect(publishButton(page), `${label}: disabled`).toBeDisabled();
    }
  });

  test('B13: the press — Publishing… and disabled while it runs, one POST with no body, then the report (the summary and one line per relay in the Outbox Relays page\'s words) and the answer asked again, the panel now Done (#2 AC-1)', async ({ page }) => {
    const rows = [
      { relay: 'wss://a-one.example', status: 'accepted', reason: '' },
      { relay: 'wss://a-two.example', status: 'refused', reason: 'blocked: fixture' },
      { relay: 'wss://down.example', status: 'unreachable', reason: 'connection refused' },
      { relay: 'wss://slow.example', status: 'timeout', reason: '5s' },
      { relay: 'wss://private.example', status: 'not-sent', reason: 'not a public address' },
    ];
    const log = await mock(page, { attention: [answerWith(DM.ANSWERS.NONE), answerWith(DM.ANSWERS.DONE)], publish: { delayMs: 1500, body: publishedAnswer({ rows }) } });
    const main = await open(page);
    await publishButton(page).click();
    const busy = page.getByRole('button', { name: DM.PUBLISH.publishing, exact: true });
    await expect(busy, 'Publishing… while the press runs').toBeVisible();
    await expect(busy).toBeDisabled();
    await expect(main.getByText(DM.PUBLISH.published(1, 4), { exact: false }), 'the summary').toBeVisible({ timeout: 10000 });
    const text = squash(await main.innerText());
    for (const [relay, line] of [['wss://a-one.example', 'accepted'], ['wss://a-two.example', 'rejected: blocked: fixture'], ['wss://down.example', 'unreachable: connection refused'], ['wss://slow.example', 'timed out: 5s'], ['wss://private.example', DM.PUBLISH.notSent.line]]) {
      expect(text, `the line for ${relay}`).toContain(relay);
      expect(text, `the line for ${relay}`).toContain(line);
    }
    expect(log.publishCalls.length, 'one POST').toBe(1);
    expect(log.publishCalls[0].method).toBe('POST');
    expect(log.publishCalls[0].body || '', 'the request names nothing').toBe('');
    await expect.poll(() => log.attentionCalls.length, { message: 'the answer is asked again after a written menu' }).toBe(2);
    await expect(publishedPanel(page).getByText(TC.DONE_COPY.done, { exact: true }), 'the panel reflects the new menu').toBeVisible();
    await expect(publishButton(page), 'up to date now: disabled').toBeDisabled();
    expect(squash(await main.innerText()), 'the report stays').toContain(DM.PUBLISH.published(1, 4));
  });

  test('B14: a refusal, a request that fails, and a failed local write each give one line, and nothing is asked again (#2 AC-1)', async ({ page }) => {
    const cases = [
      ['no assistant', { status: 403, body: { success: false, code: DM.PUBLISH.codes.noAssistant, error: DM.PUBLISH.refusals['no-assistant'] } }, DM.PUBLISH.refusals['no-assistant']],
      ['request failed', 'error', DM.PUBLISH.requestFailed],
      ['local write failed', { body: { success: true, result: { ok: false, stage: 'local', outcome: 'not-delivered', message: DM.PUBLISH.localFailed('fixture'), localOnly: false, duties: 6, relays: { total: 0, success: 0, results: [] } } } }, DM.PUBLISH.localFailed('fixture')],
    ];
    for (const [label, publish, line] of cases) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const log = await mock(page, { attention: answerWith(DM.ANSWERS.NONE), publish });
      const main = await open(page);
      await publishButton(page).click();
      await expect(main.getByText(line, { exact: false }), `${label}: the line`).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(800);
      expect(log.attentionCalls.length, `${label}: nothing is asked again`).toBe(1);
    }
  });

  test('B15: local-only — the kept-local sentence and a skipped line per relay; an empty publish adds "Your Assistant\'s Duty Menu now lists no duties." (#2 AC-1, AC-3)', async ({ page }) => {
    const skipped = [{ relay: 'wss://a-one.example', status: 'skipped', reason: 'local-only publish mode' }];
    let log = await mock(page, { attention: answerWith(DM.ANSWERS.NONE), publish: publishedAnswer({ rows: skipped, localOnly: true }) });
    let main = await open(page);
    await publishButton(page).click();
    await expect(main.getByText(DM.PUBLISH.localOnly, { exact: false })).toBeVisible({ timeout: 10000 });
    expect(squash(await main.innerText())).toContain('skipped');
    await expect.poll(() => log.attentionCalls.length, { message: 'a menu was written: asked again' }).toBe(2);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    log = await mock(page, { attention: answerWith(DM.ANSWERS.EMPTY_NONE), publish: publishedAnswer({ duties: 0 }) });
    main = await open(page);
    await publishButton(page).click();
    await expect(main.getByText(DM.PUBLISH.empty, { exact: true }), 'the empty line after the summary').toBeVisible({ timeout: 10000 });
  });

  test('B16: a found menu with no rows says "Your Assistant\'s Duty Menu lists no duties." under its heading and mark (#2 AC-6)', async ({ page }) => {
    await mock(page, { attention: answerWith(DM.ANSWERS.EMPTY_DONE) });
    await open(page);
    await expect(publishedPanel(page).getByText(DM.PUBLISH.emptyMenu, { exact: true })).toBeVisible();
    await expect(publishedPanel(page).getByText(TC.DONE_COPY.done, { exact: true })).toBeVisible();
  });
});
