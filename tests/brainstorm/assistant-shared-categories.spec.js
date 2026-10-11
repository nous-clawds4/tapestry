const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');
const TC = require('../../test/helpers/trustedContentFixtures');
const O = require('../../test/helpers/outboxRelaysFixtures');
const DM = require('../../test/helpers/dutyMenuFixtures');

/**
 * assistant-shared-categories #1 — Done, but shared: what a viewer SEES on the hub.
 *
 * Story (Design note, Edge cases, AC→handle lines): engineering-team/stories/assistant-shared-categories/1-done-but-shared.md
 * Node half: test/assistant-shared-categories.test.js. The catch-up after a Map save, and the line's link followed in the
 * app, is SV18 in tests/brainstorm/treasure-map-save.spec.js, which owns the save flow's mocks. The three pages' new
 * alert criteria are TC5 in tests/brainstorm/assistant-trusted-content.spec.js (through the shared fixture).
 *
 *   SC1 — the owner's answer: Scores and Lists say Done and Shared, with their lines; Concepts says only Done; the count
 *         line and the pill count none of the three.                                                    [AC-2, AC-3]
 *   SC2 — the look: ✓, then Done, then Shared in the title row; the pill neither green nor amber; the line under the
 *         description, in the muted colour.                                                                     [AC-2]
 *   SC3 — "Move it here →" opens /treasure-map, not the card's page; the card still leads to its page.          [AC-2]
 *   SC4 — a screen reader hears "Done, shared: Lists", "Done, shared: Scores" and "Done: Concepts"; the · mark is
 *         hidden from it, and there is no ◐ mark (dropped at the owner's Gate B verdict).                       [AC-2]
 *   SC5 — (sentinel) while the answer is on its way, and after it fails, the three are marked and nothing is shared. [AC-5]
 *   SC6 — (sentinel) a visitor sees no marks, no Shared pill and no line.                                       [AC-5]
 *   SC7 — at 390 px, "·" and "Move it here →" sit on the same line (the owner's Gate B verdict, 2026-10-11).     [AC-2]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; /api/setup/status always answers "all done", so the Assistant pill has its turn. The
 * Identification Tags action is done in every answer; the profile, Outbox Relays and the Duty Menu are pending, so the
 * counts below are about the three.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test.
 *
 * SC1–SC4 FAIL against the build before this story: no card has a Shared pill, a line or a "Move it here →" link, and
 * a shared card is announced "Done: …". SC5 and SC6 pass before and after.
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
// The actions other than the three and Identification Tags: marked and counted in every answer here.
const OTHERS = TOTAL - 1 - TC.KEYS.length;

/** The owner's Map on staging, as the server answers it (the story's AC-1): Scores partly, Lists entirely, Concepts Done. */
const OWNERS_TRIO = {
  'trusted-assertions': TC.shared('scores', 'partly'),
  'trusted-lists': TC.shared('lists', 'entirely'),
  dlists: TC.done('concepts'),
};
const answerWith = (trio) => ({
  success: true, signedIn: true, hasAssistant: true,
  actions: { 'identification-tags': ID_DONE, profile: P.PROFILE_PENDING, [O.KEY]: O.OUTBOX.PENDING, [DM.KEY]: DM.ANSWERS.NONE, ...trio },
});

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const cardOf = (page, title) => page.locator('.bs-assistant-hub-card').filter({ has: page.locator('.bs-assistant-hub-card-link', { hasText: new RegExp(`${title}$`) }) });
const sharedPill = (card) => card.locator('.bs-assistant-hub-card-head').getByText(TC.SHARED_COPY.pill, { exact: true });
const sharedLine = (card) => card.locator('.bs-assistant-hub-card-shared');

/**
 * Mock every route. `attention` is the answer, or { delayMs, body } to hold it back, or { status } to fail it; `signedIn`
 * false makes a visitor.
 */
async function mock(page, attention, { signedIn = true } = {}) {
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-shared-categories.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/relay/external**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/assistant/my-assistants**', (r) => r.fulfill(json({ success: true, signedIn: true, local: CUSTOMER_USER.assistantPubkey, rows: [], definitions: {} })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(signedIn ? { authenticated: true, pubkey: CUSTOMER_USER.pubkey } : { authenticated: false })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(signedIn ? { success: true, ...CUSTOMER_USER } : { success: false })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(P.statusAnswer())));
  await page.route('**/api/assistant/attention**', async (r) => {
    if (attention && attention.status) return r.fulfill(json({ success: false, error: 'fixture failure' }, attention.status));
    if (attention && attention.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, attention.delayMs));
      return r.fulfill(json(attention.body)).catch(() => {});
    }
    return r.fulfill(json(attention));
  });
}

async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  if (settleMs) await page.waitForTimeout(settleMs);
}

/** A card's state on the hub: which of Needs attention, Done and Shared it shows, and its line's words ('' for none). */
async function cardState(page, title) {
  const card = cardOf(page, title);
  await expect(card, `the ${title} card is on the hub`).toHaveCount(1);
  const has = async (word) => (await card.locator('.bs-assistant-hub-card-head').getByText(word, { exact: true }).count()) > 0;
  const line = (await sharedLine(card).count()) > 0 ? squash(await sharedLine(card).first().textContent()) : '';
  return { marked: await has(X.COPY.needsAttention), done: await has(TC.DONE_COPY.done), shared: await has(TC.SHARED_COPY.pill), line };
}

async function hubCount(page) {
  const text = squash(await page.locator('main').first().evaluate((el) => el.textContent));
  const m = text.match(/(\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

async function pillCount(page) {
  await open(page, '/about');
  await expect(pillOf(page)).toHaveCount(1);
  const words = squash(await pillOf(page).evaluate((el) => el.textContent));
  const m = words.match(/· (\d+) actions? needs? attention/);
  return m ? Number(m[1]) : null;
}

// No ◐ mark: dropped at the owner's Gate B verdict (2026-10-11).
const lineText = (extent) => `${TC.SHARED_COPY.line[extent]} · ${TC.SHARED_COPY.link}`;

test.describe('Done, but shared (assistant-shared-categories #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('SC1: the owner\'s answer — Scores and Lists say Done and Shared, with "Partly handled…" and "Handled…" lines; Concepts says only Done; the count line and the pill count none of the three (AC-2, AC-3)', async ({ page }) => {
    await mock(page, answerWith(OWNERS_TRIO));
    await open(page, X.HUB);
    expect(await cardState(page, 'Scores')).toEqual({ marked: false, done: true, shared: true, line: lineText('partly') });
    expect(await cardState(page, 'Lists')).toEqual({ marked: false, done: true, shared: true, line: lineText('entirely') });
    expect(await cardState(page, 'Concepts')).toEqual({ marked: false, done: true, shared: false, line: '' });
    expect(await hubCount(page), 'the count line leaves the three out').toBe(OTHERS);
    expect(await pillCount(page), 'the pill leaves the three out').toBe(OTHERS);
  });

  test('SC2: the look — a shared card keeps ✓ and Done, with Shared after Done in its title row; the Shared pill is neither the Done green nor the Needs attention amber; the line sits under the description in the muted colour (AC-2)', async ({ page }) => {
    await mock(page, answerWith(OWNERS_TRIO));
    await open(page, X.HUB);
    const lists = cardOf(page, 'Lists');
    await expect(lists.locator('.bs-assistant-hub-card-marker')).toHaveText('✓');
    const badges = await lists.locator('.bs-assistant-hub-card-head .bs-setup-step-badge').evaluateAll((els) => els.map((el) => el.textContent.trim()));
    expect(badges, 'Done, then Shared').toEqual([TC.DONE_COPY.done, TC.SHARED_COPY.pill]);
    const colour = (loc) => loc.evaluate((el) => getComputedStyle(el).color);
    const shared = await colour(sharedPill(lists));
    const done = await colour(lists.locator('.bs-setup-step-badge.is-done'));
    const amber = await colour(cardOf(page, 'Bounties').getByText(X.COPY.needsAttention, { exact: true }));
    expect(shared, 'not the Done green').not.toBe(done);
    expect(shared, 'not the Needs attention amber').not.toBe(amber);
    const order = await lists.locator('.bs-assistant-hub-card-body > *').evaluateAll((els) => els.map((el) => el.className));
    const desc = order.findIndex((c) => /bs-assistant-hub-card-text/.test(c));
    const line = order.findIndex((c) => /bs-assistant-hub-card-shared/.test(c));
    expect(desc >= 0 && line > desc, `the line follows the description: ${JSON.stringify(order)}`).toBe(true);
    expect(await colour(sharedLine(lists))).toBe('rgba(226, 232, 240, 0.6)');
  });

  test('SC3: "Move it here →" opens /treasure-map, not the card\'s page; the card itself still leads to its page (AC-2)', async ({ page }) => {
    await mock(page, answerWith(OWNERS_TRIO));
    await open(page, X.HUB);
    const lists = cardOf(page, 'Lists');
    await expect(lists.locator('.bs-assistant-hub-card-link')).toHaveAttribute('href', TC.CARDS[1].path);
    const move = lists.getByRole('link', { name: TC.SHARED_COPY.link, exact: true });
    await expect(move).toHaveAttribute('href', TC.SHARED_COPY.to);
    await move.click();
    await expect(page).toHaveURL(new RegExp(`${TC.SHARED_COPY.to}$`));
  });

  test('SC4: a screen reader hears "Done, shared: Scores", "Done, shared: Lists" and "Done: Concepts"; there are two "Move it here →" links; the · mark is hidden from it and there is no ◐ (AC-2)', async ({ page }) => {
    await mock(page, answerWith(OWNERS_TRIO));
    await open(page, X.HUB);
    await expect(page.getByRole('link', { name: `${TC.SHARED_COPY.srPrefix}Scores`, exact: true })).toHaveAttribute('href', TC.CARDS[0].path);
    await expect(page.getByRole('link', { name: `${TC.SHARED_COPY.srPrefix}Lists`, exact: true })).toHaveAttribute('href', TC.CARDS[1].path);
    await expect(page.getByRole('link', { name: `${TC.DONE_COPY.doneSrPrefix}Concepts`, exact: true })).toHaveAttribute('href', TC.CARDS[2].path);
    await expect(page.getByRole('link', { name: TC.SHARED_COPY.link, exact: true })).toHaveCount(2);
    const exposed = await page.locator('.bs-assistant-hub-card-shared').evaluateAll((lines) => {
      const out = [];
      for (const line of lines) {
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          if (!/[◐·]/.test(n.textContent)) continue;
          if (!n.parentElement.closest('[aria-hidden="true"]')) out.push(n.textContent);
        }
      }
      return out;
    });
    expect(exposed, 'the · mark is aria-hidden').toEqual([]);
    expect(await page.locator('.bs-assistant-hub-card-shared').count()).toBe(2);
    await expect(page.locator('.bs-assistant-hub-card-shared', { hasText: '◐' }), 'no ◐ mark').toHaveCount(0);
  });

  test('SC5 (sentinel): while the answer is on its way, and after it fails, the three are marked Needs attention and nothing is shared (AC-5)', async ({ page }) => {
    await mock(page, { delayMs: 4000, body: answerWith(OWNERS_TRIO) });
    await open(page, X.HUB, 500);
    for (const title of ['Scores', 'Lists', 'Concepts']) {
      expect(await cardState(page, title), `${title} while checking`).toEqual({ marked: true, done: false, shared: false, line: '' });
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { status: 500 });
    await open(page, X.HUB);
    for (const title of ['Scores', 'Lists', 'Concepts']) {
      expect(await cardState(page, title), `${title} after a failure`).toEqual({ marked: true, done: false, shared: false, line: '' });
    }
  });

  test('SC7: at 390 px, the "·" and "Move it here →" sit on the same line in both shared cards (the owner\'s Gate B verdict; AC-2)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await mock(page, answerWith(OWNERS_TRIO));
    await open(page, X.HUB);
    for (const title of ['Scores', 'Lists']) {
      const line = sharedLine(cardOf(page, title));
      const tops = await line.evaluate((p) => {
        const link = p.querySelector('a');
        const dot = [...p.querySelectorAll('[aria-hidden="true"]')].find((el) => el.textContent.includes('·'));
        if (!link || !dot) return null;
        const range = document.createRange();
        range.selectNodeContents(dot);
        const dotRects = [...range.getClientRects()];
        const linkRects = [...link.getClientRects()];
        return { dot: Math.round(dotRects[dotRects.length - 1].top), link: Math.round(linkRects[0].top), linkLines: linkRects.length };
      });
      expect(tops, `${title}: the line has its · and its link`).not.toBeNull();
      expect(tops.link, `${title}: the link starts on the line its · ends on`).toBe(tops.dot);
      expect(tops.linkLines, `${title}: the link is on one line`).toBe(1);
    }
  });

  test('SC6 (sentinel): a visitor sees no marks, no Shared pill and no line (AC-5)', async ({ page }) => {
    await mock(page, answerWith(OWNERS_TRIO), { signedIn: false });
    await open(page, X.HUB);
    await expect(page.getByText(TC.SHARED_COPY.pill, { exact: true })).toHaveCount(0);
    await expect(page.locator('.bs-assistant-hub-card-shared')).toHaveCount(0);
    await expect(page.locator('.bs-assistant-hub-card.needs-attention, .bs-assistant-hub-card.is-done')).toHaveCount(0);
  });
});
