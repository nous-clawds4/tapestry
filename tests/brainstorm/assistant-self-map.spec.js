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
 *   B13 — round 2 (ADR 0001 Amendment 2 item 4, review B1): a not-offered line the found self-Map claims
 *         says so — "Not offered" and the false-claim sentence on the 3038x line. A guard: the page draws
 *         the sentence on any line that carries falseClaim, so this passes on the round-1 build too.      [AC-6]
 *
 *
 * assistant-self-map #2 (turning the self-Map on and off; story 2 AC-2, § Copy; ADR assistant-self-map/0002
 * sub-decision 7):
 *   B12 — re-aimed: still one GET per load and nothing but GETs until a press; the buttons are the self-Map's.  [AC-2]
 *   B14 — off, nothing found: the off line, Turn on alone, no status line.                                   [AC-2]
 *   B15 — on, up to date: the on line, Update now disabled, Turn off, the status line, the Owner's note.      [AC-2]
 *   B16 — on, out of date: Update now enabled, the out-of-date line.                                          [AC-2]
 *   B17 — off, self-entries still found: the "still claims" line, Turn on and Turn off.                       [AC-2]
 *   B18 — Turn on: one POST { on: true } as JSON; Publishing… with every button disabled while it runs; the
 *         report's summary and relay lines; the answer asked for again.                                     [AC-2, AC-3]
 *   B19 — Turn off: { on: false }; the report adds "now claims no duties"; the answer asked for again.       [AC-2, AC-5]
 *   B20 — nothing published: the instance's line, and the answer asked for again; a refusal: its words, and
 *         no second GET.                                                                                       [AC-2]
 *   B21 — a customer gets no Owner's note; signed out or with no Assistant, no self-Map button.               [AC-2]
 *   Round 2 (ADR 0002 Amendment 1):
 *   B22 — off while the check did not finish: Turn on and Turn off (item 4).                                   [AC-2]
 *   B23 — a 500 shows the failed words and asks for the answer again; it may have changed the choice (item 3).  [AC-2]
 *   B24 — the Owner's note after a check that threw, from the session; still none for a customer (item 5).      [AC-2]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/assistant/attention answers per scenario: an object, 'hang' or 'error' (a 500).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: /assistant/treasure-map is the placeholder page, the hub's card is
 * always marked and counted, and the count line has no zero state. B12 and B14–B21 FAIL against story 1's build: the
 * page has no state line and no buttons.
 *
 * assistant-self-map #3 (one name for your Assistant's Treasure Map; story 3 § Copy, no ADR): the fixtures' words are
 * re-aimed, so every B test that reads a line now reads the new one; N6 walks the page's states and the hub and finds no
 * "self-Map" on screen (AC-1, AC-3). These FAIL against story 2's build.
 *
 * assistant-self-map #4 (show your Assistant's raw Treasure Map; story 4 AC-1 … AC-5, § Copy; ADR assistant-self-map/0003
 * sub-decisions 4–6):
 *   R0 — the served origin runs a build that has the toggle.                                            [prerequisite]
 *   R1 — a found version: the closed toggle in the published panel, named by its words alone; open, the box is the
 *        event as JSON, every field; closed again.                                                          [AC-1, AC-2]
 *   R2 — it shows for a version listing none of the Assistant's duties, one found on another relay, and a
 *        customer's.                                                                                         [AC-1]
 *   R3 — no toggle while checking, when the request fails, when the check did not finish or failed, when nothing
 *        was found, signed out, or with no Assistant here.                                                   [AC-3]
 *   R4 — open, a press's new answer with a newer version shows the newer one; one with none takes the toggle away;
 *        a new visit starts closed.                                                                           [AC-4]
 *   R5 — at phone width the open box wraps: no sideways scroll, in the box or the page; the box takes focus.  [AC-2]
 *   R6 — opening and closing it sends nothing, and the page's other lines and buttons are as before.         [AC-5]
 * N6 is re-aimed: it counts the enabled press buttons only (the toggle is a button too). These FAIL against story 3's
 * build.
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

  test('B12 (AC-7; re-aimed by assistant-self-map #2): one request per load — one GET of the answer, nothing but GETs until a button is pressed, and the page\'s only buttons are the self-Map\'s (here, on and not yet published: Update now and Turn off)', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) });
    const main = await open(page, SM.PATH, 3000);
    // The path under test ran: the page drew its panels from the answer (a "nothing else happened" check needs this).
    await expect(dutiesPanel(page).getByText(SM.PAGE.dutiesHeading, { exact: true }), 'the page drew its duties panel').toBeVisible();
    expect(log.attentionCalls.length, `one GET of the answer, got ${JSON.stringify(log.attentionCalls)}`).toBe(1);
    expect(log.attentionCalls[0]).not.toContain('?');
    expect(log.nonGet, 'nothing but GETs').toEqual([]);
    const names = (await main.getByRole('button').allInnerTexts()).map(squash).sort();
    expect(names, 'the self-Map\'s buttons, and no other').toEqual([SM.PRESS.buttons.turnOff, SM.PRESS.buttons.update].sort());
  });

  test('B13: a not-offered part the found self-Map claims says so — the 3038x line reads Not offered and the false-claim sentence (AC-6; ADR 0001 A2 item 4)', async ({ page }) => {
    const duties = SM.stagingDuties({ scores: 'offered', scoresReason: 'live-unclaimed' });
    duties[1].lines[1].falseClaim = true;
    await mock(page, { attention: answerWith(SM.action({ done: false, pending: true, current: false, duties, published: SM.published([{ key: '3038x', relay: SM.OWN }]) })) });
    await open(page);
    await expectLine(dutiesPanel(page), { category: 'scores', key: '3038x', parts: [SM.PAGE.statusWords['not-offered'], SM.PAGE.falseClaim] }, 'the claimed not-offered line');
    const lines = await linesIn(dutiesPanel(page));
    expect(lines.filter((l) => l.includes(SM.PAGE.falseClaim)).length, `only that line is a false claim; the lines are ${JSON.stringify(lines)}`).toBe(1);
  });
});

/* ───────────────────────── assistant-self-map #2: turning it on and off ───────────────────────── */

const button = (page, name) => page.locator('main').first().getByRole('button', { name, exact: true });
/** The press's answer for a published version (ADR 0002 sub-decision 6 step 9). */
function publishedResult({ on = true, selfEntries = 1, relays = ['wss://a-write.example', 'wss://old-one.example'] } = {}) {
  return {
    success: true,
    result: {
      ok: true, on, published: true, outcome: 'published', localOnly: false, selfEntries,
      message: `${SM.PRESS.subject} was saved on this instance's relay and accepted by ${relays.length} of ${relays.length} relays.`,
      relays: { total: relays.length, success: relays.length, results: relays.map((relay) => ({ relay, status: 'accepted', reason: '' })) },
    },
  };
}
/** Route the press, recording each request; `answer` is a body, or a function of the request that may hold the reply. */
async function routePress(page, answer) {
  const presses = [];
  await page.route(`**${SM.PRESS.route}`, async (r) => {
    const req = r.request();
    presses.push({ method: req.method(), body: req.postData(), contentType: req.headers()['content-type'] || '' });
    const out = typeof answer === 'function' ? await answer(req) : answer;
    return r.fulfill(json(out.body || out, out.status || 200));
  });
  return presses;
}

test.describe('Turning your Assistant\'s self-Map on and off (assistant-self-map #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B14: off, nothing found — the off line; Turn on alone, enabled; no status line (AC-2; § Copy)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.NOT_PUBLISHED)) });
    const main = await open(page);
    await expect(main.getByText(SM.PRESS.state.off, { exact: true }), 'the off line').toBeVisible();
    await expect(button(page, SM.PRESS.buttons.turnOn), 'Turn on').toBeEnabled();
    await expect(button(page, SM.PRESS.buttons.update), 'no Update now while off').toHaveCount(0);
    await expect(button(page, SM.PRESS.buttons.turnOff), 'no Turn off: nothing is claimed').toHaveCount(0);
    await expectNoStatusLine(page, 'off');
  });

  test('B15: on, up to date, the Owner — the on line; Update now shown but disabled; Turn off enabled; the up-to-date line; the Owner\'s note (AC-2; § Copy)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const main = await open(page);
    await expect(main.getByText(SM.PRESS.state.on, { exact: true }), 'the on line').toBeVisible();
    await expect(button(page, SM.PRESS.buttons.update), 'Update now, disabled while up to date').toBeDisabled();
    await expect(button(page, SM.PRESS.buttons.turnOff), 'Turn off').toBeEnabled();
    await expect(button(page, SM.PRESS.buttons.turnOn), 'no Turn on while on').toHaveCount(0);
    await expect(main.getByText(SM.PAGE.status.upToDate, { exact: true }), 'story 1\'s status line while on').toBeVisible();
    await expect(main.getByText(SM.PRESS.ownerNote, { exact: true }), 'the Owner\'s note').toBeVisible();
  });

  test('B16: on, out of date — Update now enabled; the out-of-date line (AC-2)', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.STALE) });
    const main = await open(page);
    await expect(button(page, SM.PRESS.buttons.update), 'Update now, enabled while out of date').toBeEnabled();
    await expect(main.getByText(SM.PAGE.status.outOfDate, { exact: true })).toBeVisible();
  });

  test('B17: off while the version found still claims duties — the "still claims" line; Turn on and Turn off; no status line (AC-2: "so no claim can be stuck")', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.STALE)) });
    const main = await open(page);
    await expect(main.getByText(SM.PRESS.state.offStillClaims, { exact: true })).toBeVisible();
    await expect(button(page, SM.PRESS.buttons.turnOn)).toBeEnabled();
    await expect(button(page, SM.PRESS.buttons.turnOff)).toBeEnabled();
    await expectNoStatusLine(page, 'off, still claiming');
  });

  test('B18: Turn on — one POST of { on: true } as JSON; while it runs, every button is disabled and the pressed one reads Publishing…; then the report\'s summary and one line per relay, and the answer is asked for again (AC-2, AC-3)', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.STALE)) });
    let release;
    const held = new Promise((r) => { release = r; });
    const presses = await routePress(page, async () => { await held; return publishedResult(); });
    const main = await open(page);
    await button(page, SM.PRESS.buttons.turnOn).click();
    await expect(button(page, SM.PRESS.buttons.publishing), 'the pressed button reads Publishing…').toBeDisabled();
    await expect(button(page, SM.PRESS.buttons.turnOff), 'the other button is disabled meanwhile').toBeDisabled();
    release();
    const r = publishedResult().result;
    await expect(main.getByText(r.message), 'the summary').toBeVisible();
    for (const row of r.relays.results) await expect(main.getByText(`${row.relay} — accepted`), `the line for ${row.relay}`).toBeVisible();
    expect(presses.length, 'one press, one request').toBe(1);
    expect(presses[0].method).toBe('POST');
    expect(JSON.parse(presses[0].body)).toEqual({ on: true });
    expect(presses[0].contentType).toMatch(/^application\/json/);
    await expect.poll(() => log.attentionCalls.length, { message: 'the answer is asked for again after the press' }).toBe(2);
  });

  test('B19: Turn off — { on: false }; the report adds "now claims no duties"; the answer is asked for again (AC-2, AC-5)', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const presses = await routePress(page, publishedResult({ on: false, selfEntries: 0 }));
    const main = await open(page);
    await button(page, SM.PRESS.buttons.turnOff).click();
    await expect(main.getByText(SM.PRESS.claimsNone, { exact: true }), 'the "now claims no duties" line').toBeVisible();
    expect(presses.length).toBe(1);
    expect(JSON.parse(presses[0].body)).toEqual({ on: false });
    await expect.poll(() => log.attentionCalls.length, { message: 'the answer is asked for again' }).toBe(2);
  });

  test('B20: a press that published nothing shows the instance\'s line and still asks for the answer again (the choice changed); a refusal shows its words and asks for nothing (AC-2)', async ({ page }) => {
    let log = await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.NO_DUTIES)) });
    const unchanged = SM.PRESS.unchanged['nothing-to-claim'];
    await routePress(page, { success: true, result: { ok: true, on: true, published: false, unchanged: 'nothing-to-claim', message: unchanged, relays: { total: 0, success: 0, results: [] } } });
    let main = await open(page);
    await button(page, SM.PRESS.buttons.turnOn).click();
    await expect(main.getByText(unchanged, { exact: true }), 'the instance\'s line').toBeVisible();
    await expect.poll(() => log.attentionCalls.length, { message: 'asked again: the choice changed' }).toBe(2);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    log = await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.NOT_PUBLISHED)) });
    await routePress(page, { status: 503, body: { success: false, code: SM.PRESS.codes.notRead, error: SM.PRESS.refusals['not-read'] } });
    main = await open(page);
    await button(page, SM.PRESS.buttons.turnOn).click();
    await expect(main.getByText(SM.PRESS.refusals['not-read'], { exact: true }), 'the refusal\'s words').toBeVisible();
    await page.waitForTimeout(800);
    expect(log.attentionCalls.length, 'a refusal changed nothing, so nothing is asked again').toBe(1);
  });

  test('B21: a customer gets no Owner\'s note; signed out, or with no Assistant here, there is no self-Map button (AC-2)', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, attention: answerWith(SM.ANSWERS.CUSTOMER_NOTHING) });
    let main = await open(page);
    await expect(main.getByText(SM.PRESS.state.on, { exact: true }), 'the customer\'s state line').toBeVisible();
    await expect(main.getByText(SM.PRESS.ownerNote, { exact: true }), 'no Owner\'s note for a customer').toHaveCount(0);
    for (const who of [null, GUEST_USER]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who });
      main = await open(page);
      for (const name of Object.values(SM.PRESS.buttons)) await expect(button(page, name), `${who ? 'no Assistant' : 'signed out'}: no "${name}"`).toHaveCount(0);
    }
  });

  test('B22 (A1 item 4): off while the check did not finish — the off line, Turn on, and Turn off, since the self-Map found is unknown (AC-2: "so no claim can be stuck")', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.UNFINISHED)) });
    const main = await open(page);
    await expect(main.getByText(SM.PRESS.state.off, { exact: true }), 'the off line').toBeVisible();
    await expect(button(page, SM.PRESS.buttons.turnOn)).toBeEnabled();
    await expect(button(page, SM.PRESS.buttons.turnOff), 'Turn off, the self-Map found being unknown').toBeEnabled();
  });

  test('B23 (A1 item 3): a press that answers 500 shows "This instance did not answer; nothing was published." and asks for the answer again, since the choice may have changed', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.offOf(SM.ANSWERS.NOT_PUBLISHED)) });
    await routePress(page, { status: 500, body: { success: false, error: SM.PRESS.failed } });
    const main = await open(page);
    await button(page, SM.PRESS.buttons.turnOn).click();
    await expect(main.getByText(SM.PRESS.failed, { exact: true }), 'the failed words').toBeVisible();
    await expect.poll(() => log.attentionCalls.length, { message: 'asked again after a 500' }).toBe(2);
  });

  test('B24 (A1 item 5): after a check that threw, the Owner still sees the Owner\'s note beside Turn on and Turn off; a customer does not', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.CHECK_FAILED) });
    let main = await open(page);
    await expect(button(page, SM.PRESS.buttons.turnOn)).toBeVisible();
    await expect(button(page, SM.PRESS.buttons.turnOff)).toBeVisible();
    await expect(main.getByText(SM.PRESS.ownerNote, { exact: true }), 'the Owner\'s note, from the session').toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: CUSTOMER_USER, attention: answerWith(SM.ANSWERS.CHECK_FAILED) });
    main = await open(page);
    await expect(main.getByText(SM.PRESS.ownerNote, { exact: true }), 'no Owner\'s note for a customer').toHaveCount(0);
  });
});

/* ───────────────────────── assistant-self-map #3: one name for your Assistant's Treasure Map ───────────────────────── */

test.describe('One name for your Assistant\'s Treasure Map (assistant-self-map #3)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  const OLD_NAME = /self-map|self-entr/i;
  const oldIn = (text) => squash(text).split(/(?<=[.!?])\s+/).filter((s) => OLD_NAME.test(s));

  test('N6 (story 3 AC-1, AC-3): no state of the page, and not the hub, shows "self-Map" or "self-entries" — signed out, the check failing or not finishing, nothing found, up to date, out of date, off, off while still listing, a customer, and after a Turn off\'s report', async ({ page }) => {
    const states = [
      ['signed out', { who: null }],
      ['the request fails', { attention: 'error' }],
      ['the check did not finish', { attention: answerWith(SM.ANSWERS.UNFINISHED) }],
      ['the check failed', { attention: answerWith(SM.ANSWERS.CHECK_FAILED) }],
      ['nothing listed yet', { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) }],
      ['up to date (the Owner)', { attention: answerWith(SM.ANSWERS.DONE) }],
      ['out of date', { attention: answerWith(SM.ANSWERS.STALE) }],
      ['off, nothing listed', { attention: answerWith(SM.offOf(SM.ANSWERS.NOT_PUBLISHED)) }],
      ['off, still listing', { attention: answerWith(SM.offOf(SM.ANSWERS.STALE)) }],
      ['a customer with no duties', { who: CUSTOMER_USER, attention: answerWith(SM.ANSWERS.CUSTOMER_NOTHING) }],
    ];
    const found = [];
    for (const [label, opts] of states) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, opts);
      const main = await open(page);
      for (const s of oldIn(await main.innerText())) found.push(`${label}: ${s}`);
    }
    // A Turn off's report: on and up to date, the one enabled button is Turn off (Update now is disabled), pressed by role
    // so the press runs whatever its label says; the server's summary is the route's own words.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const off = publishedResult({ on: false, selfEntries: 0 });
    await routePress(page, off);
    const main = await open(page);
    // Re-aimed by assistant-self-map #4: the raw toggle is a button too, so only the press buttons are counted.
    const enabled = main.locator('.bs-selfmap-actions button:not([disabled])');
    await expect(enabled, 'one enabled press button while on and up to date: Turn off').toHaveCount(1);
    await enabled.click();
    await expect(main.getByText(off.result.message), 'the report after a Turn off').toBeVisible();
    for (const s of oldIn(await main.innerText())) found.push(`after a Turn off: ${s}`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(SM.ANSWERS.STALE) });
    const hub = await open(page, X.HUB);
    for (const s of oldIn(await hub.innerText())) found.push(`the hub: ${s}`);
    expect(found, 'the old name on screen (story 3 § Copy gives each line\'s new words)').toEqual([]);
  });
});

/* ───────────────────────── assistant-self-map #4: show your Assistant's raw Treasure Map ───────────────────────── */

const rawToggle = (page, open = false) => publishedPanel(page).getByRole('button', { name: open ? SM.RAW.hide : SM.RAW.show, exact: true });
const anyRawToggle = (page) => page.locator('main').first().getByRole('button', { name: /raw Treasure Map/ });
const rawBox = (page) => page.locator('main').first().getByRole('region', { name: SM.RAW.boxLabel, exact: true });
/** The open box's text, read back as JSON (null when it is not JSON). */
async function boxEvent(page) {
  const text = await rawBox(page).innerText();
  try { return JSON.parse(text); } catch { return null; }
}
/** A newer version of the canned one, with its own id and date (story 4 AC-4). */
const newerVersion = (base = SM.ANSWERS.STALE) => SM.action({
  ...base,
  done: true, pending: false, current: true,
  published: SM.published(SM.SHOULD_LIVE.slice(), { eventId: 'f'.repeat(64), createdAt: 1_760_009_999 }),
});
/** Answer the attention route with `answers` in turn (the last one repeats), recording each call in `log`. */
async function answerInTurn(page, log, answers) {
  await page.route('**/api/assistant/attention**', (r) => {
    log.attentionCalls.push(r.request().url());
    const a = answers[Math.min(log.attentionCalls.length - 1, answers.length - 1)];
    return r.fulfill(json(answerWith(a)));
  });
}

test.describe('Your Assistant\'s raw Treasure Map (assistant-self-map #4)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('R0: the served origin runs a build that has the raw toggle', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, SM.RAW.show);
    expect(found, `the bundle served by ${baseURL} does not carry "${SM.RAW.show}" (${why}). Rebuild the UI, or story 4 is not built yet.`).toBe(true);
  });

  test('R1 (AC-1, AC-2; § Copy): a found version — the published panel shows the closed toggle, reading "▸ Show your Assistant\'s raw Treasure Map" and named by its words alone, with no box; open, it reads "▾ Hide …", and the box is the found event as JSON, every field; pressed again, it closes', async ({ page }) => {
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    await open(page);
    const closed = rawToggle(page);
    await expect(closed, 'the closed toggle, in the published panel').toBeVisible();
    expect(squash(await closed.innerText()), 'as a sighted reader sees it').toBe(SM.RAW.closedLabel);
    await expect(closed).toHaveAttribute('aria-expanded', 'false');
    await expect(rawBox(page), 'no box while closed').toHaveCount(0);
    await expect(page.locator('main').first().getByText(`"id": "${SM.ANSWERS.DONE.published.eventId}"`), 'no event text while closed').toHaveCount(0);

    await closed.click();
    const opened = rawToggle(page, true);
    await expect(opened, 'the open toggle').toBeVisible();
    expect(squash(await opened.innerText())).toBe(SM.RAW.openLabel);
    await expect(opened).toHaveAttribute('aria-expanded', 'true');
    await expect(rawBox(page), 'the box').toBeVisible();
    const shown = await boxEvent(page);
    expect(shown, 'the box is the found event, every field, as the answer carries it').toEqual(SM.ANSWERS.DONE.published.event);
    expect(shown.id).toBe(SM.ANSWERS.DONE.published.eventId);

    await opened.click();
    await expect(rawBox(page), 'closed again').toHaveCount(0);
    await expect(rawToggle(page)).toBeVisible();
  });

  test('R2 (AC-1): the toggle shows for any found version — one listing none of the Assistant\'s duties (beside the "lists none" line), one found on another relay, and a customer\'s', async ({ page }) => {
    const outside = SM.action({ published: SM.published(SM.SHOULD_LIVE.slice(), { source: 'relay', eventId: 'f'.repeat(64) }) });
    const customers = SM.action({ instanceMap: false, published: SM.published([{ key: '39998', relay: SM.OWN }], { otherEntries: 0, eventId: 'c'.repeat(64) }) });
    customers.published.event = SM.foundEvent({ ...customers.published, author: CUSTOMER_ASSISTANT });
    const cases = [
      ['listing none of its duties', OWNER_USER, SM.ANSWERS.LISTS_NONE],
      ['found on another relay', OWNER_USER, outside],
      ['a customer\'s', CUSTOMER_USER, customers],
    ];
    for (const [label, who, a] of cases) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who, attention: answerWith(a) });
      await open(page);
      if (a === SM.ANSWERS.LISTS_NONE) await expect(publishedPanel(page).getByText(SM.PAGE.none, { exact: true }), `${label}: the none line`).toBeVisible();
      await rawToggle(page).click();
      const shown = await boxEvent(page);
      expect(shown && shown.id, `${label}: the box shows the found version`).toBe(a.published.eventId);
      expect(shown, `${label}: every field`).toEqual(a.published.event);
    }
  });

  test('R3 (AC-3): nothing to toggle without a version — no toggle and no box while checking, when the request fails, when the check did not finish or failed, when nothing was found, with no duties, signed out, or with no Assistant here', async ({ page }) => {
    // The path under test ran: the same page shows the toggle for a found version.
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    await open(page);
    await expect(rawToggle(page), 'control: a found version has the toggle').toBeVisible();
    const states = [
      ['checking', { attention: 'hang' }, SM.PAGE.checking],
      ['the request fails', { attention: 'error' }, SM.PAGE.couldNotCheck['request-failed']],
      ['the check did not finish', { attention: answerWith(SM.ANSWERS.UNFINISHED) }, SM.PAGE.couldNotCheck['no-relay-answered']],
      ['the check failed', { attention: answerWith(SM.ANSWERS.CHECK_FAILED) }, SM.PAGE.couldNotCheck['request-failed']],
      ['nothing found', { attention: answerWith(SM.ANSWERS.NOT_PUBLISHED) }, SM.PAGE.none],
      ['no duties, nothing found', { attention: answerWith(SM.ANSWERS.NO_DUTIES) }, SM.PAGE.none],
      ['signed out', { who: null }, SM.PAGE.signedOutLine],
      ['no Assistant here', { who: GUEST_USER }, X.COPY.noAssistantLine],
    ];
    for (const [label, opts, line] of states) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, opts);
      const main = await open(page);
      await expect(main.getByText(line, { exact: true }).first(), `${label}: the page drew its line`).toBeVisible();
      await expect(anyRawToggle(page), `${label}: no toggle`).toHaveCount(0);
      await expect(rawBox(page), `${label}: no box`).toHaveCount(0);
    }
  });

  test('R4 (AC-4): never a stale version — open, a press whose new answer finds a newer version shows the newer one; one whose answer finds none takes the toggle and box away; a new visit starts closed', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.ANSWERS.STALE) });
    const newer = newerVersion();
    await answerInTurn(page, log, [SM.ANSWERS.STALE, newer]);
    await routePress(page, publishedResult());
    await open(page);
    await rawToggle(page).click();
    expect((await boxEvent(page)).id, 'before the press: the version found').toBe(SM.ANSWERS.STALE.published.eventId);
    await button(page, SM.PRESS.buttons.update).click();
    await expect.poll(() => log.attentionCalls.length, { message: 'the answer is asked for again after the press' }).toBe(2);
    await expect.poll(async () => ((await rawBox(page).count()) ? ((await boxEvent(page)) || {}).id : null), { message: 'the box shows the newer version' }).toBe(newer.published.eventId);
    expect(await boxEvent(page), 'the newer version, every field').toEqual(newer.published.event);

    // A press whose new answer finds no version: the toggle and the box go away.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const log2 = await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const gone = SM.offOf(SM.action({ ...SM.ANSWERS.NOT_PUBLISHED }));
    await answerInTurn(page, log2, [SM.ANSWERS.DONE, gone]);
    await routePress(page, publishedResult({ on: false, selfEntries: 0 }));
    await open(page);
    await rawToggle(page).click();
    await expect(rawBox(page)).toBeVisible();
    await button(page, SM.PRESS.buttons.turnOff).click();
    await expect.poll(() => log2.attentionCalls.length).toBe(2);
    await expect(page.locator('main').first().getByText(SM.PRESS.state.off, { exact: true }), 'the new answer is drawn').toBeVisible();
    await expect(anyRawToggle(page), 'no toggle once no version is found').toHaveCount(0);
    await expect(rawBox(page), 'no box once no version is found').toHaveCount(0);

    // A new visit starts closed.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    await open(page);
    await rawToggle(page).click();
    await expect(rawBox(page)).toBeVisible();
    await open(page);
    await expect(rawToggle(page), 'reloaded: closed').toBeVisible();
    await expect(rawBox(page), 'reloaded: no box').toHaveCount(0);
  });

  test('R5 (AC-2): at phone width (375px) the open box wraps — nothing in it scrolls sideways and neither does the page — and the box takes keyboard focus', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    await open(page);
    await rawToggle(page).click();
    const box = rawBox(page);
    await expect(box).toBeVisible();
    const sizes = await box.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(sizes.scroll, `the box's lines wrap (scrollWidth ${sizes.scroll}, clientWidth ${sizes.client})`).toBeLessThanOrEqual(sizes.client + 1);
    const pageSizes = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: window.innerWidth }));
    expect(pageSizes.scroll, `the page never scrolls sideways (scrollWidth ${pageSizes.scroll}, width ${pageSizes.inner})`).toBeLessThanOrEqual(pageSizes.inner);
    await box.focus();
    expect(await box.evaluate((el) => document.activeElement === el), 'the box takes focus, so a keyboard can scroll it').toBe(true);
  });

  test('R6 (AC-5): opening and closing the box sends nothing, and the page\'s other lines and buttons are as before — the state line, Update now disabled, Turn off enabled, the status line, the Owner\'s note', async ({ page }) => {
    const log = await mock(page, { attention: answerWith(SM.ANSWERS.DONE) });
    const main = await open(page);
    const before = log.api.length;
    await rawToggle(page).click();
    await expect(rawBox(page)).toBeVisible();
    await rawToggle(page, true).click();
    await rawToggle(page).click();
    await page.waitForTimeout(800);
    expect(log.api.slice(before), 'no request from the toggle').toEqual([]);
    expect(log.nonGet, 'nothing but GETs').toEqual([]);
    expect(log.attentionCalls.length, 'the answer asked for once').toBe(1);
    await expect(main.getByText(SM.PRESS.state.on, { exact: true }), 'the on line').toBeVisible();
    await expect(button(page, SM.PRESS.buttons.update), 'Update now, disabled while up to date').toBeDisabled();
    await expect(button(page, SM.PRESS.buttons.turnOff), 'Turn off').toBeEnabled();
    await expect(main.getByText(SM.PAGE.status.upToDate, { exact: true }), 'the status line').toBeVisible();
    await expect(main.getByText(SM.PRESS.ownerNote, { exact: true }), 'the Owner\'s note').toBeVisible();
  });
});
