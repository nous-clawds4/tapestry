const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const CS = require('../../test/helpers/comingSoonFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');
const TC = require('../../test/helpers/trustedContentFixtures');
const O = require('../../test/helpers/outboxRelaysFixtures');
const DM = require('../../test/helpers/dutyMenuFixtures');

/**
 * assistant-coming-soon #1 — Coming soon: what a viewer SEES on the hub and on the five pages.
 *
 * Story (Design note, Edge cases, AC→handle lines): engineering-team/stories/assistant-coming-soon/1-coming-soon-cards.md
 * Node half: test/assistant-coming-soon.test.js. Cards and words: test/helpers/comingSoonFixtures.js.
 *
 *   CS1 — every check done: the five say Coming soon, unmarked and not Done; Your Assistant's Treasure Map is marked;
 *         the count line and the pill say 1.                                                     [AC-1, AC-2, AC-4]
 *   CS2 — the answer fails: the count line says 8, the pill 1; the five are unmarked, with their pill.          [AC-2]
 *   CS3 — a screen reader hears "Coming soon: <title>" for the five, and "Needs attention: …" for the Treasure Map
 *         card; the visible pill is hidden from it.                                                         [AC-1, AC-4]
 *   CS4 — a visitor, and a viewer with no Assistant here, see the five pills, no marks and no count line.  [AC-1, AC-4]
 *   CS5 — while sign-in is still resolving, the five pills already show and nothing is marked.                  [AC-1]
 *   CS6 — the look: the hub's pill is the background image panel's muted pill (same class, same colour), not green and
 *         not amber; the card has no marker; a click on the card still opens its page.                        [AC-1]
 *   CS7 — the five pages say "Coming soon." and not "Placeholder page.", with the rest unchanged; Your Assistant's
 *         Treasure Map page still says "Placeholder page.".                                                [AC-3, AC-4]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked; /api/setup/status always answers "all done", so the Assistant pill has its turn.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test.
 *
 * Every test FAILS against the build before this story: no card says Coming soon, the five are marked and counted (6 and
 * 13 where 1 and 8 are wanted), and every page says "Placeholder page.".
 */

const CUSTOMER_USER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const GUEST_USER = { pubkey: 'ee'.repeat(32), classification: 'guest', assistantPubkey: null };
const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};
const ID_DONE = { finished: true, done: true, pending: false, taggings: [] };
/** Every real check done (story AC-2's first row). */
const ALL_DONE = {
  success: true, signedIn: true, hasAssistant: true,
  actions: {
    'identification-tags': ID_DONE, profile: P.PROFILE_DONE, [O.KEY]: O.OUTBOX.DONE, [DM.KEY]: DM.ANSWERS.DONE,
    ...TC.trio((c) => TC.done(c)),
  },
};
const TREASURE_MAP = X.ACTIONS.find((a) => a.path === `${CS.HUB}/${CS.STILL_PLACEHOLDER}`);

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pillOf = (page) => page.getByRole('link', { name: X.ALERT.name, exact: true });
const cardOf = (page, path) => page.locator('.bs-assistant-hub-card').filter({ has: page.locator(`a.bs-assistant-hub-card-link[href="${path}"]`) });
const head = (card) => card.locator('.bs-assistant-hub-card-head');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock every route. `attention` is the answer, or { status } to fail it; `who` is the signed-in user, or null for a
 * visitor; `authDelayMs` holds sign-in back.
 */
async function mock(page, { attention = ALL_DONE, who = CUSTOMER_USER, authDelayMs = 0 } = {}) {
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-coming-soon.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/relay/external**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/assistant/my-assistants**', (r) => r.fulfill(json({ success: true, signedIn: !!who, local: who && who.assistantPubkey, rows: [], definitions: {} })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false })).catch(() => {});
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { success: true, ...who } : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })).catch(() => {});
  });
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json(P.statusAnswer())));
  await page.route('**/api/assistant/attention**', (r) => {
    if (attention && attention.status) return r.fulfill(json({ success: false, error: 'fixture failure' }, attention.status));
    return r.fulfill(json(attention));
  });
}

async function open(page, address, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  if (settleMs) await page.waitForTimeout(settleMs);
  return page.locator('main').first();
}

/** A card's state on the hub: its marker, and which of Coming soon, Needs attention and Done its title row shows. */
async function cardState(page, path) {
  const card = cardOf(page, path);
  await expect(card, `the ${path} card is on the hub`).toHaveCount(1);
  const has = async (word) => (await head(card).getByText(word, { exact: true }).count()) > 0;
  return {
    marker: squash(await card.locator('.bs-assistant-hub-card-marker').textContent()),
    comingSoon: await has(CS.COPY.pill),
    marked: await has(X.COPY.needsAttention),
    done: await has(TC.DONE_COPY.done),
  };
}
const COMING_SOON = { marker: '', comingSoon: true, marked: false, done: false };

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

test.describe('Coming soon (assistant-coming-soon #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('CS1: every check done — the five say Coming soon, with no mark and no Done; Your Assistant\'s Treasure Map is marked; the count line and the pill say 1 (AC-1, AC-2, AC-4)', async ({ page }) => {
    await mock(page);
    await open(page, X.HUB);
    for (const c of CS.CARDS) expect(await cardState(page, c.path), c.title).toEqual(COMING_SOON);
    expect(await cardState(page, TREASURE_MAP.path), TREASURE_MAP.title).toEqual({ marker: '!', comingSoon: false, marked: true, done: false });
    await expect(page.locator('main').first().getByText(X.COPY.needsAttention, { exact: true }), 'one card is marked: the Treasure Map card').toHaveCount(1);
    expect(await hubCount(page), 'the count line').toBe(1);
    await expect(page.locator('main').first().getByText(X.countText(1), { exact: true })).toBeVisible();
    expect(await pillCount(page), 'the pill').toBe(1);
  });

  test('CS2: the answer fails — the count line says 8 (the seven checked cards and the Treasure Map card), the pill 1; the five are unmarked, with their pill (AC-2)', async ({ page }) => {
    await mock(page, { attention: { status: 500 } });
    await open(page, X.HUB);
    for (const c of CS.CARDS) expect(await cardState(page, c.path), c.title).toEqual(COMING_SOON);
    expect(await hubCount(page), 'the count line').toBe(8);
    await expect(page.locator('main').first().getByText(X.COPY.needsAttention, { exact: true }), 'eight cards are marked').toHaveCount(8);
    expect(await pillCount(page), 'the pill counts the Treasure Map card only').toBe(1);
  });

  test('CS3: a screen reader hears "Coming soon: <title>" for the five and "Needs attention: …" for the Treasure Map card; the visible pill is hidden from it (AC-1, AC-4)', async ({ page }) => {
    await mock(page);
    const main = await open(page, X.HUB);
    for (const c of CS.CARDS) {
      const link = main.locator(`a.bs-assistant-hub-card-link[href="${c.path}"]`);
      expect(squash(await link.textContent()), `${c.title}'s link`).toBe(`${squash(CS.COPY.srPrefix)} ${c.title}`);
      await expect(link, `${c.title}: the link's accessible name`).toHaveAccessibleName(`${squash(CS.COPY.srPrefix)} ${c.title}`);
      const pill = head(cardOf(page, c.path)).getByText(CS.COPY.pill, { exact: true });
      await expect(pill, `${c.title}: the pill is aria-hidden`).toHaveAttribute('aria-hidden', 'true');
    }
    const tm = main.locator(`a.bs-assistant-hub-card-link[href="${TREASURE_MAP.path}"]`);
    expect(squash(await tm.textContent())).toBe(`${X.COPY.needsAttentionSrPrefix} ${TREASURE_MAP.title}`);
  });

  test('CS4: a visitor, and a signed-in viewer with no Assistant here, see the five pills — and no marks and no count line (AC-1, AC-4)', async ({ page }) => {
    for (const [label, who] of [['visitor', null], ['no assistant', GUEST_USER]]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who });
      const main = await open(page, X.HUB);
      for (const c of CS.CARDS) expect(await cardState(page, c.path), `${label}: ${c.title}`).toEqual(COMING_SOON);
      await expect(main.getByText(CS.COPY.pill, { exact: true }), `${label}: five pills`).toHaveCount(CS.CARDS.length);
      await expect(main.getByText(X.COPY.needsAttention, { exact: true }), `${label}: no marks`).toHaveCount(0);
      expect(await hubCount(page), `${label}: no count line`).toBeNull();
    }
  });

  test('CS5: while sign-in is still resolving, the five pills already show and nothing is marked (AC-1)', async ({ page }) => {
    await mock(page, { authDelayMs: 3000 });
    await page.goto(X.HUB);
    let pills = 0;
    let marked = false;
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline) {
      const state = await page.evaluate(([pill, mark]) => {
        const main = document.querySelector('main');
        if (!main) return { pills: 0, marked: false };
        const words = [...main.querySelectorAll('.bs-assistant-hub-card-head .bs-setup-step-badge')].map((el) => el.textContent.trim());
        return { pills: words.filter((w) => w === pill).length, marked: words.includes(mark) };
      }, [CS.COPY.pill, X.COPY.needsAttention]);
      pills = Math.max(pills, state.pills);
      if (state.marked) marked = true;
      await page.waitForTimeout(100);
    }
    expect(pills, 'the five pills show before sign-in resolves').toBe(CS.CARDS.length);
    expect(marked, 'nothing is marked before sign-in resolves').toBe(false);
  });

  test('CS6: the look — the hub\'s pill is the background image panel\'s muted pill (same class, same colour), neither green nor amber; the card has no marker; a click on the card opens its page (AC-1)', async ({ page }) => {
    await mock(page);
    await open(page, P.PAGE);
    const panelPill = page.locator('main').first().getByText(CS.COPY.pill, { exact: true }).first();
    await expect(panelPill, 'the background image panel\'s Coming soon pill').toBeVisible();
    const panelLook = await panelPill.evaluate((el) => ({ cls: el.className, color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));

    await open(page, X.HUB);
    const amber = await head(cardOf(page, TREASURE_MAP.path)).getByText(X.COPY.needsAttention, { exact: true }).evaluate((el) => getComputedStyle(el).color);
    const green = await head(cardOf(page, CS.HUB + '/profile')).getByText(TC.DONE_COPY.done, { exact: true }).evaluate((el) => getComputedStyle(el).color);
    for (const c of CS.CARDS) {
      const pill = head(cardOf(page, c.path)).getByText(CS.COPY.pill, { exact: true });
      await expect(pill, `${c.title}: the Coming soon pill`).toBeVisible({ timeout: 5000 });
      const look = await pill.evaluate((el) => ({ cls: el.className, color: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
      expect(look, `${c.title}: the same pill as the background image panel's`).toEqual(panelLook);
      expect(look.color, `${c.title}: not the Needs attention colour`).not.toBe(amber);
      expect(look.color, `${c.title}: not the Done colour`).not.toBe(green);
    }
    // A click where a person would make it: on the description, by position, as assistant-management-page B5 does
    // (Locator.click() refuses an element the card-wide link covers by design; mouse.click() does not scroll).
    const bounties = CS.CARDS[0];
    const description = cardOf(page, bounties.path).locator('.bs-assistant-hub-card-text');
    await description.scrollIntoViewIfNeeded();
    const box = await description.boundingBox();
    expect(box, 'precondition: the Bounties card shows its description').not.toBeNull();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => new URL(page.url()).pathname, { message: 'a click on the card opens its page' }).toBe(bounties.path);
  });

  test('CS7: the five pages say "Coming soon." and not "Placeholder page.", with the title, description, alert criteria and planning notes unchanged; Your Assistant\'s Treasure Map page still says "Placeholder page." (AC-3, AC-4)', async ({ page }) => {
    await mock(page);
    for (const c of CS.CARDS) {
      const a = X.ACTIONS.find((x) => x.path === c.path);
      const main = await open(page, c.path, 800);
      await expect(main.getByRole('heading', { level: 1 }), `${c.path}: the title`).toHaveText(c.title);
      const bold = main.locator('strong', { hasText: CS.COPY.pageLine });
      await expect(bold, `${c.path}: the bold line`).toHaveText(CS.COPY.pageLine);
      await expect(main.getByText(CS.COPY.placeholder, { exact: true }), `${c.path}: no "Placeholder page."`).toHaveCount(0);
      expect(squash(await main.innerText()), `${c.path}: the description`).toContain(a.text);
      await expect(main.getByText(X.NOT_YET_DEFINED, { exact: true }), `${c.path}: the alert criteria`).toBeVisible();
      if (a.planningNotes) await expect(main.getByText(a.planningNotes, { exact: true }), `${c.path}: the planning notes`).toBeVisible();
    }
    const main = await open(page, TREASURE_MAP.path, 800);
    await expect(main.locator('strong', { hasText: CS.COPY.placeholder }), 'the Treasure Map page is unchanged').toHaveText(CS.COPY.placeholder);
    await expect(main.getByText(CS.COPY.pageLine, { exact: true })).toHaveCount(0);
  });
});
