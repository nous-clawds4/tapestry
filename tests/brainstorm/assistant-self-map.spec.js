const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');
const O = require('../../test/helpers/outboxRelaysFixtures');
const TC = require('../../test/helpers/trustedContentFixtures');
const DC = require('../../test/helpers/dutyCardsFixtures');
const DM = require('../../test/helpers/dutyMenuFixtures');
const SM = require('../../test/helpers/selfMapFixtures');

/**
 * assistant-self-map #1: the hub's Your Assistant's Treasure Map card and its page — the browser class.
 *
 * Story: engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.md
 * ADR:   engineering-team/decisions/assistant-self-map/0001-a-self-map-check-from-what-has-landed.md
 * Plan:  engineering-team/stories/assistant-self-map/1-the-self-map-page-and-its-check.test-plan.md
 * Node halves: test/assistant-self-map-check.test.js, test/assistant-self-map-page.test.js.
 * Words and canned answers: test/helpers/selfMapFixtures.js.
 *
 *   B0  — the served origin runs a build that has the page.                                              [prerequisite]
 *   B1  — the hub card: done shows Done and no mark; pending is marked; it leads to its page.            [AC-5]
 *   B2  — the count line: "Nothing needs attention" when every action is done, the pill gone; one
 *         pending self-Map reads "1 action needs attention".                                             [AC-5]
 *   B3  — signed out: the sign-in line and button; no panels.                                            [AC-6]
 *   B4  — no Assistant here: the no-assistant line and its link to Account Setup; no panels.             [AC-6]
 *   B5  — up to date, the Owner: each duty line (category, key, status, relay or reason), the elsewhere
 *         and not-offered lines, the should-say and published panels, Done, the status line, the links,
 *         the Owner's line with its count, the public line.                                              [AC-6]
 *   B6  — not published yet: live lines say so; the none line; the not-published status line; no
 *         Owner's line.                                                                                  [AC-6]
 *   B7  — out of date: the false-claim line, the not-scheduled reason, the out-of-date line.             [AC-6]
 *   B8  — upkeep stopped: "Not kept up to date: last landed" and a date.                                 [AC-6]
 *   B9  — a customer with nothing to claim: the reason, "Nothing to claim yet.", no Owner's line.       [AC-6]
 *   B10 — no duties: the empty line and its link to /treasure-map.                                       [AC-6]
 *   B11 — the check did not finish, and the instance did not answer: the reason, Needs attention, no
 *         status line; Checking… while the answer is on its way.                                         [AC-6]
 *   B12 — read-only, one request: one GET of the answer per load, nothing but GETs, no button but
 *         sign-in.                                                                                        [AC-7]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/assistant/attention answers per scenario: an object, 'hang' or 'error' (a 500).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: /assistant/treasure-map is the placeholder page, the hub's card is
 * always marked and counted, and the count line has no zero state.
 */

const TA = SM.TA;
const OWNER_USER = { pubkey: SM.OWNER, classification: 'owner', assistantPubkey: TA };
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
const ACTION = DC.CARDS.find((c) => c.key === SM.KEY);

/** Every other checked action done, and the self-Map as given: the counts then move with this card alone. */
function answerWith(selfMap) {
  return {
    success: true, signedIn: true, hasAssistant: true,
    actions: {
      [T.CHECKED_ACTION]: T.DONE.actions[T.CHECKED_ACTION],
      profile: P.PROFILE_DONE,
      [O.KEY]: O.OUTBOX.DONE,
      ...TC.trio((c) => TC.done(c)),
      [DM.KEY]: DM.ANSWERS.DONE,
      [SM.KEY]: selfMap,
    },
  };
}

async function mock(page, { who = OWNER_USER, attention = answerWith(SM.ANSWERS.DONE) } = {}) {
  const log = { api: [], nonGet: [], attentionCalls: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-self-map.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: SM.OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json({ success: true, hasRelayKey: true, assistantPubkey: who ? who.assistantPubkey : null, hasProfile: false })));
  await page.route('**/api/assistant/attention**', (r) => {
    log.attentionCalls.push(r.request().url());
    if (attention === 'hang') return new Promise(() => {});
    if (attention === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    return r.fulfill(json(attention));
  });
  return log;
}

async function open(page, address = SM.PATH, settleMs = 1500) {
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
const panelOf = (page, heading) => panels(page).filter({ hasText: heading }).first();
const dutiesPanel = (page) => panelOf(page, SM.PAGE.dutiesHeading);
const shouldPanel = (page) => panelOf(page, SM.PAGE.shouldHeading);
const publishedPanel = (page) => panelOf(page, SM.PAGE.publishedHeading);
const hubCard = (page) => page.locator('main .bs-assistant-hub-card').filter({ has: page.locator(`a[href="${SM.PATH}"]`) });
const linesIn = async (panel) => (await panel.innerText()).split('\n').map(squash).filter(Boolean);
const keyIn = (key, l) => new RegExp(`(^|[^\\w:])${key.replace(/[*]/g, '\\*')}($|[^\\w:])`).test(l);

/** A duties line: its category name, its key, and every given part (a status word, a relay, a reason) on one line. */
async function expectLine(panel, { category, key, parts }, label) {
  const lines = await linesIn(panel);
  const hit = lines.find((l) => (!category || l.includes(SM.CATEGORY_NAMES[category])) && keyIn(key, l) && parts.every((p) => l.includes(p)));
  expect(hit, `${label}: one line names ${category ? SM.CATEGORY_NAMES[category] + ', ' : ''}${key} and ${JSON.stringify(parts)}; the lines are ${JSON.stringify(lines)}`).toBeTruthy();
}
/** A should-say or published entry: its key and its relay on one line. */
async function expectEntries(panel, entries, label) {
  for (const e of entries) await expectLine(panel, { key: e.key, parts: [e.relay] }, label);
}
async function expectNoStatusLine(page, label) {
  const main = page.locator('main').first();
  for (const line of Object.values(SM.PAGE.status)) await expect(main.getByText(line, { exact: true }), `${label}: no status line`).toHaveCount(0);
}
async function hubCountText(page) {
  const main = await open(page, X.HUB);
  return squash(await main.locator('.bs-assistant-hub-count').first().evaluate((el) => el.textContent));
}

test.describe('Your Assistant\'s Treasure Map card and page (assistant-self-map #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that has the page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, SM.PAGE.dutiesExplainer);
    expect(found, `the bundle served by ${baseURL} does not carry "${SM.PAGE.dutiesExplainer}" (${why}). Rebuild the UI, or the story is not built yet.`).toBe(true);
  });

  test('B1: the hub card — done shows Done and no mark, and a screen reader hears "Done: Your Assistant\'s Treasure Map"; pending is marked; the card leads to its page (AC-5)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    await open(page, X.HUB);
    let card = hubCard(page);
    await expect(card.getByText(TC.DONE_COPY.done, { exact: true }), 'the Done badge').toBeVisible();
    await expect(card.getByText(X.COPY.needsAttention, { exact: true }), 'no mark').toHaveCount(0);
    expect(squash(await card.locator(`a[href="${SM.PATH}"]`).evaluate((el) => el.textContent))).toBe(`${TC.DONE_COPY.doneSrPrefix.trim()} ${ACTION.title}`);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) });
    await open(page, X.HUB);
    card = hubCard(page);
    await expect(card.getByText(X.COPY.needsAttention, { exact: true }), 'not published: marked').toBeVisible();
    await expect(card.getByText(TC.DONE_COPY.done, { exact: true })).toHaveCount(0);
    await card.locator(`a[href="${SM.PATH}"]`).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(SM.PATH);
  });

  test('B2: the count line — every action done reads "Nothing needs attention" and the pill is gone; a pending self-Map reads "1 action needs attention" (AC-5; open question 2)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    expect(await hubCountText(page)).toBe(SM.COUNT_ZERO);
    await open(page, '/about');
    await expect(pillOf(page), 'the pill hides at zero').toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) });
    expect(await hubCountText(page)).toBe('1 action needs attention');
  });

  test('B3: the page, signed out — the title, the description, the sign-in line and button; no panels (AC-6)', async ({ page }) => {
    await mock(page, { who: null });
    const main = await open(page);
    await expect(page.getByRole('heading', { name: 'Page not found' }), `${SM.PATH} is a page`).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText(ACTION.title);
    expect(squash(await main.innerText())).toContain(ACTION.text);
    await expect(main.getByText(X.COPY.placeholder, { exact: true }), 'not the placeholder').toHaveCount(0);
    await expect(main.getByText(SM.PAGE.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton })).toBeVisible();
    for (const h of [SM.PAGE.dutiesHeading, SM.PAGE.shouldHeading, SM.PAGE.publishedHeading]) await expect(main.getByText(h, { exact: true })).toHaveCount(0);
  });

  test('B4: the page, signed in with no Assistant here — the no-assistant line and its link to Account Setup; no panels; nothing asked (AC-6)', async ({ page }) => {
    const log = await mock(page, { who: GUEST_USER });
    const main = await open(page);
    await expect(main.getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: X.COPY.noAssistantLink, exact: true })).toHaveAttribute('href', '/setup');
    for (const h of [SM.PAGE.dutiesHeading, SM.PAGE.shouldHeading, SM.PAGE.publishedHeading]) await expect(main.getByText(h, { exact: true })).toHaveCount(0);
    expect(log.attentionCalls, 'nothing to check for a viewer with no Assistant').toEqual([]);
  });

  test('B5: up to date, the Owner — the duty lines, the should-say and published panels, Done, the status line, both links, the Owner\'s line with its count, and the public line; the back link leads to the hub (AC-6)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const main = await open(page);
    const duties = dutiesPanel(page);
    await expect(duties.getByText(SM.PAGE.dutiesExplainer, { exact: true })).toBeVisible();
    await expectLine(duties, { category: 'scores', key: '30382', parts: [SM.PAGE.statusWords.active, SM.OWN] }, 'Scores');
    await expectLine(duties, { category: 'concepts', key: '39998', parts: [SM.PAGE.statusWords.active, SM.OWN] }, 'Concepts');
    await expectLine(duties, { category: 'concepts', key: '39999', parts: [SM.PAGE.statusWords.offered, SM.PAGE.reasons['not-published-here']] }, '39999');
    await expectLine(duties, { category: 'scores', key: '30382:rank', parts: [SM.PAGE.elsewhere] }, 'given elsewhere');
    await expectLine(duties, { category: 'scores', key: '3038x', parts: [SM.PAGE.statusWords['not-offered']] }, 'not offered');
    await expect(shouldPanel(page).getByText(SM.PAGE.shouldExplainer, { exact: true })).toBeVisible();
    await expectEntries(shouldPanel(page), SM.ANSWERS.DONE.shouldSay, 'should say');
    await expectEntries(publishedPanel(page), SM.ANSWERS.DONE.published.selfEntries, 'published');
    await expect(publishedPanel(page).getByText(TC.DONE_COPY.done, { exact: true }), 'the hub\'s Done mark').toBeVisible();
    await expect(main.getByText(SM.PAGE.status.upToDate, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: SM.PAGE.links.dutyMenu, exact: true })).toHaveAttribute('href', DM.PATH);
    await expect(main.getByRole('link', { name: SM.PAGE.links.treasureMap, exact: true }).first()).toHaveAttribute('href', '/treasure-map');
    expect(squash(await main.innerText())).toContain(SM.PAGE.ownerLine(SM.ANSWERS.DONE.published.otherEntries));
    await expect(main.getByText(SM.PAGE.publicLine, { exact: true })).toBeVisible();
    await main.getByRole('link', { name: X.COPY.backToHub, exact: true }).click();
    await expect.poll(() => new URL(page.url()).pathname).toBe(X.HUB);
  });

  test('B6: not published yet — live lines say the self-Map doesn\'t say so yet; the none line with Needs attention; the not-published status line, once; no Owner\'s line without a published Map (AC-6)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) });
    const main = await open(page);
    await expectLine(dutiesPanel(page), { category: 'scores', key: '30382', parts: [SM.PAGE.statusWords.offered, SM.PAGE.reasons['live-unclaimed']] }, 'Scores');
    await expect(publishedPanel(page).getByText(SM.PAGE.none, { exact: true })).toBeVisible();
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expect(main.getByText(SM.PAGE.status.notPublished, { exact: true }), 'the status line, once').toHaveCount(1);
    expect(squash(await main.innerText())).not.toContain(SM.PAGE.ownerLineLead);
  });

  test('B7: out of date — the false-claim line and the not-scheduled reason on Scores, the out-of-date status line; should-say lists 39998 only (AC-6)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.STALE) });
    const main = await open(page);
    await expectLine(dutiesPanel(page), { category: 'scores', key: '30382', parts: [SM.PAGE.reasons['not-scheduled']] }, 'Scores');
    await expect(dutiesPanel(page).getByText(SM.PAGE.falseClaim, { exact: false }), 'the false claim').toBeVisible();
    await expect(main.getByText(SM.PAGE.status.outOfDate, { exact: true })).toBeVisible();
    await expectEntries(shouldPanel(page), [{ key: '39998', relay: SM.OWN }], 'should say');
    expect((await linesIn(shouldPanel(page))).some((l) => keyIn('30382', l)), 'should-say has no 30382').toBe(false);
  });

  test('B8: upkeep stopped — "Not kept up to date: last landed" and a date, never raw seconds (AC-6)', async ({ page }) => {
    const at = 1_780_870_800;
    const duties = SM.stagingDuties({ scores: 'offered', scoresReason: 'upkeep-stopped', lastLandedAt: at });
    await mock(page, { attention: answerWith(SM.action({ done: false, pending: true, current: false, duties, shouldSay: [{ key: '39998', relay: SM.OWN }], published: SM.published([{ key: '39998', relay: SM.OWN }]) })) });
    await open(page);
    const lines = await linesIn(dutiesPanel(page));
    const hit = lines.find((l) => keyIn('30382', l) && l.includes(SM.PAGE.upkeepStoppedLead));
    expect(hit, `a 30382 line says "${SM.PAGE.upkeepStoppedLead} <date>."; the lines are ${JSON.stringify(lines)}`).toBeTruthy();
    expect(hit.includes(String(at)) || hit.includes('<date>'), `the date is shown as a date: ${hit}`).toBe(false);
  });

  test('B9: a customer with nothing to claim — the not-published-here reason, "Nothing to claim yet.", no Owner\'s line, up to date (AC-6)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, attention: answerWith(SM.ANSWERS.CUSTOMER_NOTHING) });
    const main = await open(page);
    await expectLine(dutiesPanel(page), { category: 'lists', key: '30392', parts: [SM.PAGE.reasons['not-published-here']] }, 'Lists');
    await expect(shouldPanel(page).getByText(SM.PAGE.shouldEmpty, { exact: true })).toBeVisible();
    expect(squash(await main.innerText())).not.toContain(SM.PAGE.ownerLineLead);
    await expect(main.getByText(SM.PAGE.status.upToDate, { exact: true })).toBeVisible();
  });

  test('B10: no duties — "Your Treasure Map gives your Assistant no duties." with its link to /treasure-map (AC-6)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, attention: answerWith(SM.ANSWERS.NO_DUTIES) });
    await open(page);
    const duties = dutiesPanel(page);
    await expect(duties.getByText(SM.PAGE.noDuties, { exact: false })).toBeVisible();
    await expect(duties.getByRole('link', { name: SM.PAGE.yourTreasureMap, exact: true })).toHaveAttribute('href', '/treasure-map');
  });

  test('B11: the check did not finish, or the instance did not answer — the reason, Needs attention, no status line; Checking… while the answer is on its way (AC-6)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.UNFINISHED) });
    await open(page);
    await expect(publishedPanel(page).getByText(SM.PAGE.couldNotCheck['no-relay-answered'], { exact: true })).toBeVisible();
    await expect(publishedPanel(page).getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    await expectNoStatusLine(page, 'unfinished');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith({ ...SM.ANSWERS.UNFINISHED, reason: 'instance-unanswered' }) });
    await open(page);
    await expect(publishedPanel(page).getByText(SM.PAGE.couldNotCheck['request-failed'], { exact: true })).toBeVisible();
    await expectNoStatusLine(page, 'instance-unanswered');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: 'hang' });
    await open(page, SM.PATH, 500);
    await expect(publishedPanel(page).getByText(SM.PAGE.checking, { exact: true })).toBeVisible();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: 'error' });
    await open(page);
    await expect(publishedPanel(page).getByText(SM.PAGE.couldNotCheck['request-failed'], { exact: true })).toBeVisible();
    await expectNoStatusLine(page, 'request failed');
  });

  test('B12: read-only, one request — one GET of the answer per load, nothing but GETs, no button but sign-in (AC-7)', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) });
    const main = await open(page, SM.PATH, 3000);
    // The path under test ran: the page drew its panels from the answer (a "nothing else happened" check needs this).
    await expect(dutiesPanel(page).getByText(SM.PAGE.dutiesHeading, { exact: true }), 'the page drew its duties panel').toBeVisible();
    expect(log.attentionCalls.length, `one GET of the answer, got ${JSON.stringify(log.attentionCalls)}`).toBe(1);
    expect(log.attentionCalls[0]).not.toContain('?');
    expect(log.nonGet, 'nothing but GETs').toEqual([]);
    await expect(main.getByRole('button'), 'no button on the page itself').toHaveCount(0);
  });
});
