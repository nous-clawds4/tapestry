const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');
const TC = require('../../test/helpers/trustedContentFixtures');

/**
 * assistant-trusted-content-status #1 — Scores, Lists and Concepts on the hub: what a viewer SEES.
 *
 * Story: engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.md
 * ADR:   engineering-team/decisions/assistant-trusted-content-status/0001-scores-lists-and-concepts-join-the-one-attention-answer.md
 * Plan:  engineering-team/stories/assistant-trusted-content-status/1-scores-lists-and-concepts-on-the-hub.test-plan.md
 * Node half: test/assistant-trusted-content.test.js. The catch-up after a Map save (AC-6) is SV17 in
 * tests/brainstorm/treasure-map-save.spec.js, which owns the save flow's mocks.
 *
 *   TC1 — the names: Scores, Lists, Concepts open Publication of Trusted Content, in that order; the old names are gone.  [AC-1]
 *   TC2 — all three done: each card says Done, not Needs attention; the count line and the pill leave them out.     [AC-5]
 *   TC3 — one of each: pending (marked and counted), unfinished (marked, not counted), done (Done).               [AC-4, AC-5]
 *   TC4 — a screen reader hears "Done: Scores" and "Needs attention: Lists"; each card still leads to its page.      [AC-5]
 *   TC5 — each card's page: the new title, the rule as alert criteria, and one link to /treasure-map that opens it.   [AC-1]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; /api/setup/status always answers "all done", so the Assistant pill has its turn. The
 * Identification Tags action is done in every answer and the profile pending, so the counts below are about the three.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test.
 *
 * These FAIL against the build before this story: the three cards are titled Trusted Assertions, Trusted Lists and
 * Decentralized Lists, are always marked and counted, never say Done, and their pages have no criteria and no link.
 */

const CUSTOMER_USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};
const ID_DONE = { finished: true, done: true, pending: false, taggings: [] };
const TOTAL = X.ACTIONS.length;
// The actions other than the three and Identification Tags; in every answer here they are marked and counted (the profile
// pending, the rest placeholders), whichever of them a parallel book has made a real check.
const OTHERS = TOTAL - 1 - TC.KEYS.length;

/** An answer: Identification Tags done, the profile pending, and the three as given. */
const answerWith = (trio) => ({
  success: true, signedIn: true, hasAssistant: true,
  actions: { 'identification-tags': ID_DONE, profile: P.PROFILE_PENDING, ...trio },
});

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const trustedContent = (page) => page.getByRole('region', { name: 'Publication of Trusted Content' });
const cardOf = (page, title) => page.locator('.bs-assistant-hub-card').filter({ has: page.locator('.bs-assistant-hub-card-link', { hasText: new RegExp(`${title}$`) }) });

async function mock(page, attention) {
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-trusted-content.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/relay/external**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/assistant/my-assistants**', (r) => r.fulfill(json({ success: true, signedIn: true, local: CUSTOMER_USER.assistantPubkey, rows: [], definitions: {} })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: CUSTOMER_USER.pubkey })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({ success: true, ...CUSTOMER_USER })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(P.statusAnswer())));
  await page.route('**/api/assistant/attention**', (r) => r.fulfill(json(attention)));
}

async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(settleMs);
}

/** A card's state on the hub: 'done' | 'marked' | 'both' | 'none'. */
async function cardState(page, title) {
  const card = cardOf(page, title);
  await expect(card, `the ${title} card is on the hub`).toHaveCount(1);
  const marked = (await card.getByText(X.COPY.needsAttention, { exact: true }).count()) > 0;
  const done = (await card.getByText(TC.DONE_COPY.done, { exact: true }).count()) > 0;
  return marked && done ? 'both' : marked ? 'marked' : done ? 'done' : 'none';
}

async function hubState(page) {
  await open(page, X.HUB);
  const text = squash(await page.locator('main').first().evaluate((el) => el.textContent));
  const m = text.match(/(\d+) actions? needs? attention/);
  const out = { count: m ? Number(m[1]) : null };
  for (const c of TC.CARDS) out[c.title] = await cardState(page, c.title);
  return out;
}

async function pillCount(page) {
  await open(page, '/about');
  await expect(pillOf(page)).toHaveCount(1);
  const words = squash(await pillOf(page).evaluate((el) => el.textContent));
  const m = words.match(/· (\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

test.describe('Scores, Lists and Concepts on the hub (assistant-trusted-content-status #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('TC1: Scores, Lists and Concepts open Publication of Trusted Content, in that order, before Bounties, Pins and Tags; no card is called Trusted Assertions, Trusted Lists or Decentralized Lists (AC-1)', async ({ page }) => {
    await mock(page, answerWith(TC.trio((c) => TC.pending(c))));
    await open(page, X.HUB);
    const links = trustedContent(page).locator('.bs-assistant-hub-card-link');
    const titles = (await links.evaluateAll((els) => els.map((el) => el.textContent)))
      .map((t) => squash(t).replace(/^(Needs attention: |Done: )/, ''));
    expect(titles).toEqual(['Scores', 'Lists', 'Concepts', 'Bounties', 'Pins', 'Tags']);
    for (const old of ['Trusted Assertions', 'Trusted Lists', 'Decentralized Lists']) {
      await expect(page.locator('.bs-assistant-hub-card-link', { hasText: new RegExp(`^(Needs attention: |Done: )?${old}$`) }), `no card titled ${old}`).toHaveCount(0);
    }
  });

  test('TC2: all three done — each card says Done and not Needs attention; the count line and the pill count only the other actions (AC-5)', async ({ page }) => {
    await mock(page, answerWith(TC.trio((c) => TC.done(c))));
    expect(await hubState(page)).toEqual({ count: OTHERS, Scores: 'done', Lists: 'done', Concepts: 'done' });
    expect(await pillCount(page), 'the pill leaves the three out').toBe(OTHERS);
  });

  test('TC3: one of each — Scores pending (only other Assistants) is marked and counted; Lists unfinished is marked but the pill leaves it out; Concepts done says Done (AC-4, AC-5)', async ({ page }) => {
    await mock(page, answerWith({
      'trusted-assertions': TC.pending('scores', 'other-assistants-only', 'local'),
      'trusted-lists': TC.unfinished('lists', 'outside-unreachable'),
      dlists: TC.done('concepts'),
    }));
    expect(await hubState(page)).toEqual({ count: OTHERS + 2, Scores: 'marked', Lists: 'marked', Concepts: 'done' });
    expect(await pillCount(page), 'the pill counts Scores, not the unfinished Lists').toBe(OTHERS + 1);
  });

  test('TC4: a screen reader hears "Done: Scores" and "Needs attention: Lists", and each card still leads to its page (AC-5)', async ({ page }) => {
    await mock(page, answerWith({ 'trusted-assertions': TC.done('scores'), 'trusted-lists': TC.pending('lists', 'not-assigned', 'local'), dlists: TC.done('concepts') }));
    await open(page, X.HUB);
    await expect(page.getByRole('link', { name: `${TC.DONE_COPY.doneSrPrefix}Scores`, exact: true })).toHaveAttribute('href', TC.CARDS[0].path);
    // The shared fixture's prefix is "Needs attention:" (no trailing space); the accessible name reads "Needs attention: Lists".
    await expect(page.getByRole('link', { name: `${X.COPY.needsAttentionSrPrefix} Lists`, exact: true })).toHaveAttribute('href', TC.CARDS[1].path);
    await expect(page.getByRole('link', { name: `${TC.DONE_COPY.doneSrPrefix}Concepts`, exact: true })).toHaveAttribute('href', TC.CARDS[2].path);
  });

  for (const card of TC.CARDS) {
    test(`TC5 ${card.path}: the page is titled ${card.title}, gives the rule as its alert criteria, and its one link, "${TC.MAP_LINK.text}", opens /treasure-map (AC-1)`, async ({ page }) => {
      await mock(page, answerWith(TC.trio((c) => TC.pending(c))));
      await open(page, card.path);
      const main = page.locator('main').first();
      await expect(main.getByRole('heading', { level: 1 })).toHaveText(card.title);
      await expect(main.getByText(card.alertCriteria, { exact: true }), 'the rule, in plain words').toBeVisible();
      const link = main.getByRole('link', { name: TC.MAP_LINK.text, exact: true });
      await expect(link).toHaveAttribute('href', TC.MAP_LINK.to);
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${TC.MAP_LINK.to}$`));
    });
  }
});
