const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');

/**
 * assistant-profile-checklist #1: the profile check and the hub's Done mark — the browser class.
 *
 * Story: engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.md
 * ADR:   engineering-team/decisions/assistant-profile-checklist/0001-the-profile-check-joins-the-one-attention-answer.md
 * Plan:  engineering-team/stories/assistant-profile-checklist/1-the-profile-check-and-the-hubs-done-mark.test-plan.md
 * Node half: test/assistant-profile-check.test.js. Canned answers: test/helpers/profileChecklistFixtures.js.
 *
 *   B1 — every check done: the profile and Identification Tags cards show Done (and not Needs attention), the count
 *        line and the pill count only the placeholders.                                                    [AC-6]
 *   B2 — the profile pending: its card is marked, and the count line and the pill count it.                [AC-6]
 *   B3 — the profile unfinished: its card is marked; the pill does not count it.                           [AC-6]
 *   B4 — an answer with no profile action (a server that predates the check): marked; not in the pill.     [AC-6]
 *   B5 — the Done card's link reads "Done: <title>" to a screen reader.                                    [§ Copy]
 *
 * PLACEHOLDERS is every action without a check (assistant-management #1's ten and assistant-outbox-relays' eleventh,
 * less the three that are checked: this book's, assistant-identification-tags' and assistant-outbox-relays'). Every
 * mocked answer says the other checked actions are done, so the counts here move with the profile alone. A book that
 * checks another action adds it to CHECKED and to OTHERS_DONE.
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; /api/setup/status always answers "all done", so the Assistant pill has its turn.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test.
 *
 * These FAIL against the build before this story: the profile is a placeholder (always marked and counted), and no
 * card ever shows Done.
 */

const CHECKED = ['profile', 'identification-tags', 'outbox-relays'];
const OTHERS_DONE = { 'outbox-relays': { finished: true, done: true, pending: false } };
const PLACEHOLDERS = X.ACTIONS.length - CHECKED.length;
const PROFILE_TITLE = "Your Tapestry Assistant's Profile";
const ID_TITLE = 'Identification Tags';

const CUSTOMER_USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};
const ID_DONE = { finished: true, done: true, pending: false, taggings: [] };

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const cardOf = (page, title) => page.locator('.bs-assistant-hub-card').filter({ has: page.getByRole('link', { name: new RegExp(`${title}$`) }) });

async function mock(page, attention) {
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-profile-check.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: CUSTOMER_USER.pubkey })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({ success: true, ...CUSTOMER_USER })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(P.statusAnswer())));
  await page.route('**/api/assistant/attention**', (r) => r.fulfill(json({ ...attention, actions: { ...OTHERS_DONE, ...attention.actions } })));
}

async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(settleMs);
}

async function hubState(page) {
  await open(page, X.HUB);
  const main = page.locator('main').first();
  const text = squash(await main.evaluate((el) => el.textContent));
  const m = text.match(/(\d+) actions? needs? attention/);
  const state = async (title) => {
    const card = cardOf(page, title);
    await expect(card, `the ${title} card is on the hub`).toHaveCount(1);
    const marked = (await card.getByText(X.COPY.needsAttention, { exact: true }).count()) > 0;
    const done = (await card.getByText(P.HUB_COPY.done, { exact: true }).count()) > 0;
    return marked && done ? 'both' : marked ? 'marked' : done ? 'done' : 'none';
  };
  return { count: m ? Number(m[1]) : null, profile: await state(PROFILE_TITLE), idTags: await state(ID_TITLE) };
}

async function pillCount(page) {
  await open(page, '/about');
  await expect(pillOf(page)).toHaveCount(1);
  const words = squash(await pillOf(page).evaluate((el) => el.textContent));
  const m = words.match(/· (\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

test.describe('The profile check and the hub\'s Done mark (assistant-profile-checklist #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B1: every check done — the profile and Identification Tags cards say Done, not Needs attention; the count line and the pill count only the placeholders (AC-6)', async ({ page }) => {
    await mock(page, P.withProfile(P.PROFILE_DONE, ID_DONE));
    expect(await hubState(page)).toEqual({ count: PLACEHOLDERS, profile: 'done', idTags: 'done' });
    expect(await pillCount(page), 'the pill counts the placeholders only').toBe(PLACEHOLDERS);
  });

  test('B2: the profile pending — its card is marked, and the count line and the pill count it (AC-6)', async ({ page }) => {
    await mock(page, P.withProfile(P.PROFILE_PENDING, ID_DONE));
    expect(await hubState(page)).toEqual({ count: PLACEHOLDERS + 1, profile: 'marked', idTags: 'done' });
    expect(await pillCount(page)).toBe(PLACEHOLDERS + 1);
  });

  test('B3: the profile unfinished — its card is marked and the count line counts it, but the pill does not (AC-5, AC-6)', async ({ page }) => {
    await mock(page, P.withProfile(P.PROFILE_UNFINISHED, ID_DONE));
    expect(await hubState(page)).toEqual({ count: PLACEHOLDERS + 1, profile: 'marked', idTags: 'done' });
    expect(await pillCount(page), 'the pill counts a checked action only from a finished answer that found something').toBe(PLACEHOLDERS);
  });

  test('B4: an answer with no profile action — the card is marked until it knows, and the pill does not count it (AC-6)', async ({ page }) => {
    await mock(page, P.withProfile(null, ID_DONE));
    expect(await hubState(page)).toEqual({ count: PLACEHOLDERS + 1, profile: 'marked', idTags: 'done' });
    expect(await pillCount(page)).toBe(PLACEHOLDERS);
  });

  test('B5: a Done card\'s link reads "Done: <title>" to a screen reader, and still leads to the profile page (story 1 § Copy)', async ({ page }) => {
    await mock(page, P.withProfile(P.PROFILE_DONE, ID_DONE));
    await open(page, X.HUB);
    const link = page.getByRole('link', { name: `${P.HUB_COPY.doneSrPrefix}${PROFILE_TITLE}`, exact: true });
    await expect(link).toHaveCount(1);
    await expect(link).toHaveAttribute('href', P.PAGE);
  });
});
