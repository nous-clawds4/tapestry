const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const P = require('../../test/helpers/profileChecklistFixtures');

/**
 * assistant-profile-checklist #2 and #3: the checklist page at /assistant/profile, its one-click fixes, and the avatar
 * panel's fix — the browser class.
 *
 * Stories: engineering-team/stories/assistant-profile-checklist/2-the-checklist-page-and-its-one-click-fixes.md
 *          engineering-team/stories/assistant-profile-checklist/3-a-personalized-avatar-for-every-assistant.md
 * ADRs:    engineering-team/decisions/assistant-profile-checklist/0002-…md, 0003-…md
 * Plans:   the two stories' .test-plan.md files.
 * Node halves: test/assistant-profile-checklist-page.test.js, test/assistant-stamped-avatar-for-everyone.test.js.
 *
 *   C1  — the page: back link, title, description, the seven panels in order, the editor link; no placeholder.  [#2 AC-1]
 *   C2  — a visitor and a viewer with no Assistant: panels, no states, no fixes.                                [#2 AC-2]
 *   C3  — states and words: Done and its line, Needs attention and its line, Coming soon; the summary line.     [#2 AC-3]
 *   C4  — all done: "Your Assistant's profile is complete."                                                     [#2 AC-3]
 *   C5  — while the answer is on its way: Checking…, and no fix.                                                [#2 AC-3]
 *   C6  — Set website: one status read, one publish whose content differs from the published fields only in
 *         the website, the relays' answers shown, the answer asked again.                                       [#2 AC-4 … AC-6]
 *   C7  — Fill in the default About text: only the empty ones are filled.                                      [#2 AC-4]
 *   C8  — Republish (NIP-05, client tag, visibility): the published fields as they are.                         [#2 AC-4]
 *   C9  — one at a time: while a fix publishes, every fix button is disabled and "Publishing…" shows.           [#2 AC-5]
 *   C10 — no profile: the notice and "Publish the default profile", which posts the default; no panel fixes.    [#2 AC-4]
 *   C11 — a dev box: no NIP-05 / website / client-tag fix, and the no-public-address line.                      [#2 AC-4]
 *   C12 — a refused local write: the writer's own words, nothing reads as success; the answer asked again.     [#2 AC-5, AC-6]
 *   C13 — 375 px: no sideways scroll.                                                                           [#2 AC-1]
 *   C14 — the press-time read finds no profile: Set website posts nothing, says so, and asks again.            [#2 AC-4; ADR 0002 Amendment 1]
 *   C15 — the press-time read finds a profile: Publish the default profile posts nothing, says so, asks again. [#2 AC-4; ADR 0002 Amendment 1]
 *   AV1 — Make my personalized avatar: the person's picture stamped and previewed; nothing stored or published. [#3 AC-2]
 *   AV2 — Publish this avatar: stored, then the profile republished with only the picture changed.              [#3 AC-3]
 *   AV3 — Not now: the preview goes; nothing sent.                                                              [#3 AC-2]
 *   AV4 — no picture / can't fetch / not stampable: story 3's words, no publish.                                [#3 AC-5]
 *   AV5 — a dev box: the preview, but no publish — the no-public-address line.                                  [#3 AC-6]
 *   AV6 — the editor shows the stamped-avatar section to a Customer.                                            [#3 AC-4]
 *   AV7 — Publish this avatar when the press-time read finds no profile: no profile is published.               [#3 AC-3; ADR 0002 Amendment 1]
 *
 * Panels are found as regions named by their titles (a <section> labelled by its heading, as the Identification
 * Tags page's cards are).
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. The publish, the store and the picture answer per scenario; every POST is recorded.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true and BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test.
 *
 * These FAIL against the build before these stories: /assistant/profile is the placeholder, and the editor's
 * stamped-avatar section is the Owner's only.
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
// A valid 1×1 PNG: the browser must be able to decode and stamp it.
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const STORED_URL = `${P.PUBLIC_INSTANCE.website}/generated/ta-avatar-${'cd'.repeat(16)}.png`;

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const panelOf = (page, key) => page.getByRole('region', { name: P.PANELS[key].title, exact: true });
const PUBLISHED_FIELDS = P.PROFILE_CONTENT_FIELDS.reduce((o, k) => { o[k] = typeof P.PUBLISHED[k] === 'string' ? P.PUBLISHED[k] : ''; return o; }, {});

/**
 * Mock every route. `attention` is the answer (or 'hang'); `publish` the one writer's answer, { delayMs, body, status };
 * `picture` the proxy's: 'png' or { status, body }; `store` the store's answer. Returns a log of what was sent.
 */
async function mock(page, { who = CUSTOMER_USER, attention = P.withProfile(P.PROFILE_ALL_FIXABLE, ID_DONE), publish = {}, picture = 'png', store, status } = {}) {
  const log = { attention: 0, status: [], publish: [], store: 0, picture: 0, nonGet: [] };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (req.method() !== 'GET' && u.pathname.startsWith('/api/')) log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-profile-checklist-page.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, ...who }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => { log.status.push(r.request().url()); return r.fulfill(json(status || P.statusAnswer())); });
  await page.route('**/api/assistant/attention**', (r) => {
    log.attention += 1;
    if (attention === 'hang') return new Promise(() => {});
    return r.fulfill(json(attention));
  });
  await page.route('**/api/assistant/publish-profile', async (r) => {
    log.publish.push(r.request().postDataJSON());
    if (publish.delayMs) await wait(publish.delayMs);
    try { return await r.fulfill(json(publish.body || P.publishAnswer(), publish.status || 200)); } catch { return undefined; }
  });
  await page.route('**/api/assistant/my-picture', (r) => {
    log.picture += 1;
    if (picture === 'png') return r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1X1 });
    return r.fulfill(json(picture.body, picture.status));
  });
  await page.route('**/api/assistant/avatar', (r) => {
    log.store += 1;
    return r.fulfill(json(store || { success: true, filename: STORED_URL.split('/').pop(), path: `/generated/${STORED_URL.split('/').pop()}`, url: STORED_URL }));
  });
  return log;
}

async function open(page, address = P.PAGE, settleMs = 1500) {
  await page.goto(address);
  await page.locator('main, h1').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(settleMs);
}
const mainText = async (page) => squash(await page.locator('main').first().evaluate((el) => el.textContent));
const fixButtons = (page) => page.locator('main').getByRole('button').filter({ hasNotText: /^Sign in/ });

test.describe('The checklist page and its one-click fixes (assistant-profile-checklist #2, #3)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('C1: the page — back link, title, description, the seven panels in order, the editor link, and no placeholder (#2 AC-1)', async ({ page }) => {
    await mock(page);
    await open(page);
    const main = page.locator('main').first();
    await expect(main.getByRole('link', { name: P.PAGE_COPY.backLink, exact: true })).toHaveAttribute('href', X.HUB);
    await expect(main.getByRole('heading', { level: 1, name: P.PAGE_COPY.title })).toBeVisible();
    await expect(main.getByText(P.PAGE_COPY.description, { exact: true })).toBeVisible();
    const tops = [];
    for (const { key } of P.ITEMS) {
      await expect(panelOf(page, key), `the ${key} panel, a region named "${P.PANELS[key].title}"`).toHaveCount(1);
      tops.push((await panelOf(page, key).boundingBox()).y);
    }
    expect(tops.every((y, n) => n === 0 || y > tops[n - 1]), `the panels top to bottom in the items' order: ${JSON.stringify(P.ITEMS.map((i) => i.key))}`).toBe(true);
    await expect(main.getByRole('link', { name: P.PAGE_COPY.editorLink, exact: true })).toHaveAttribute('href', P.EDITOR);
    await expect(main.getByText(X.COPY.placeholder, { exact: true }), 'not the placeholder').toHaveCount(0);
  });

  test('C2: a visitor and a viewer with no Assistant see the panels with no states and no fixes, and the line for them (#2 AC-2)', async ({ page }) => {
    await mock(page, { who: null });
    await open(page);
    await expect(page.locator('main').getByText(P.PAGE_COPY.signedOut, { exact: true })).toBeVisible();
    for (const word of [P.PAGE_COPY.needsAttention, P.PAGE_COPY.done]) await expect(page.locator('main').getByText(word, { exact: true }), `no "${word}"`).toHaveCount(0);
    await expect(fixButtons(page), 'no fix for a visitor').toHaveCount(0);
    await expect(panelOf(page, 'website')).toHaveCount(1);

    await mock(page, { who: GUEST_USER });
    await open(page);
    await expect(page.locator('main').getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    for (const word of [P.PAGE_COPY.needsAttention, P.PAGE_COPY.done]) await expect(page.locator('main').getByText(word, { exact: true }), `no "${word}"`).toHaveCount(0);
    await expect(fixButtons(page), 'no fix without an Assistant').toHaveCount(0);
  });

  test('C3: each panel\'s state and words — Done with its line, Needs attention with its reason\'s line, the banner Coming soon — and "2 items need attention" (#2 AC-3)', async ({ page }) => {
    await mock(page, { attention: P.withProfile(P.PROFILE_PENDING, ID_DONE) });
    await open(page);
    const I = P.instanceBlock(P.PUBLIC_INSTANCE);
    const fill = { domain: I.domain, url: I.website, address: P.row('nip05').address, value: 'https://alice.example', n: 2, m: 3 };
    const expectations = [
      ['avatar', P.PAGE_COPY.needsAttention, P.PANELS.avatar.lines['standard-image'](fill)],
      ['nip05', P.PAGE_COPY.done, P.PANELS.nip05.done(fill)],
      ['website', P.PAGE_COPY.needsAttention, P.PANELS.website.lines.other(fill)],
      ['name-and-about', P.PAGE_COPY.done, P.PANELS['name-and-about'].done(fill)],
      ['client-tag', P.PAGE_COPY.done, P.PANELS['client-tag'].done(fill)],
      ['visible', P.PAGE_COPY.done, P.PANELS.visible.done(fill)],
      ['banner', P.PAGE_COPY.comingSoon, P.PANELS.banner.line],
    ];
    for (const [key, badge, line] of expectations) {
      const panel = panelOf(page, key);
      await expect(panel.getByText(badge, { exact: true }), `${key}: the "${badge}" badge`).toHaveCount(1);
      await expect(panel.getByText(line, { exact: true }), `${key}: its line`).toBeVisible();
    }
    expect(await mainText(page)).toContain(P.PAGE_COPY.summaryCount(2));
  });

  test('C4: every counted item done — "Your Assistant\'s profile is complete." and no fix offered (#2 AC-3)', async ({ page }) => {
    await mock(page, { attention: P.withProfile(P.PROFILE_DONE, ID_DONE) });
    await open(page);
    expect(await mainText(page)).toContain(P.PAGE_COPY.summaryDone);
    await expect(page.locator('main').getByText(P.PAGE_COPY.needsAttention, { exact: true })).toHaveCount(0);
    await expect(fixButtons(page)).toHaveCount(0);
  });

  test('C5: while the answer is on its way, the panels say Checking… and offer no fix (#2 AC-3)', async ({ page }) => {
    await mock(page, { attention: 'hang' });
    await open(page);
    await expect(panelOf(page, 'website').getByText(P.PAGE_COPY.checking, { exact: true })).toBeVisible();
    await expect(fixButtons(page)).toHaveCount(0);
  });

  test('C6: Set website — one status read, one publish whose content is the published fields with only the website changed, each relay\'s answer shown, and the answer asked again (#2 AC-4 … AC-6)', async ({ page }) => {
    const log = await mock(page, { publish: { body: P.publishAnswer({ accepted: 1 }) } });
    await open(page);
    const before = log.attention;
    await panelOf(page, 'website').getByRole('button', { name: P.PANELS.website.fix({ url: P.PUBLIC_INSTANCE.website }), exact: true }).click();
    await expect.poll(() => log.publish.length, { timeout: 10000 }).toBe(1);
    expect(log.status.some((u) => u.includes(`customerPubkey=${CUSTOMER_USER.pubkey}`)), `the status read is for the viewer: ${JSON.stringify(log.status)}`).toBe(true);
    expect(log.publish[0]).toEqual({ customerPubkey: CUSTOMER_USER.pubkey, content: { ...PUBLISHED_FIELDS, website: P.PUBLIC_INSTANCE.website } });
    const panel = panelOf(page, 'website');
    await expect(panel.getByText('wss://a.example', { exact: false })).toBeVisible();
    await expect(panel.getByText(/rejected: blocked/)).toBeVisible();
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
  });

  test('C7: Fill in the default About text — the empty display name and About text get the default; the name stays (#2 AC-4)', async ({ page }) => {
    const log = await mock(page);
    await open(page);
    await panelOf(page, 'name-and-about').getByRole('button', { name: P.PANELS['name-and-about'].fixByReason['no-about'], exact: true }).click();
    await expect.poll(() => log.publish.length, { timeout: 10000 }).toBe(1);
    expect(log.publish[0].content).toEqual({ ...PUBLISHED_FIELDS, display_name: P.DEFAULTS.display_name, about: P.DEFAULTS.about });
  });

  test('C8: the republish fixes — NIP-05, client tag, visibility — post the published fields as they are (#2 AC-4)', async ({ page }) => {
    const I = P.PUBLIC_INSTANCE;
    for (const [key, label] of [['nip05', P.PANELS.nip05.fix()], ['client-tag', P.PANELS['client-tag'].fix({ domain: I.domain })], ['visible', P.PANELS.visible.fix()]]) {
      const log = await mock(page);
      await open(page);
      await panelOf(page, key).getByRole('button', { name: label, exact: true }).click();
      await expect.poll(() => log.publish.length, { timeout: 10000 }).toBe(1);
      expect(log.publish[0].content, `${key}: nothing changes in the fields`).toEqual(PUBLISHED_FIELDS);
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });

  test('C9: one fix at a time — while one publishes, every fix button is disabled and "Publishing…" shows (#2 AC-5)', async ({ page }) => {
    const log = await mock(page, { publish: { delayMs: 3000 } });
    await open(page);
    await panelOf(page, 'website').getByRole('button', { name: P.PANELS.website.fix({ url: P.PUBLIC_INSTANCE.website }), exact: true }).click();
    await expect(page.locator('main').getByText(P.PAGE_COPY.publishing, { exact: false }).first()).toBeVisible();
    const buttons = page.locator('main').getByRole('button');
    const n = await buttons.count();
    for (let i = 0; i < n; i += 1) {
      const name = squash(await buttons.nth(i).textContent());
      if (/^Sign in/.test(name)) continue;
      await expect(buttons.nth(i), `"${name}" is disabled while a fix publishes`).toBeDisabled();
    }
    await expect.poll(() => log.publish.length).toBe(1);
  });

  test('C10: no profile — the notice offers "Publish the default profile", which posts the default; no panel offers a fix (#2 AC-4)', async ({ page }) => {
    const log = await mock(page, { attention: P.withProfile(P.PROFILE_NONE, ID_DONE), status: P.statusAnswer({ hasProfile: false }) });
    await open(page);
    await expect(page.locator('main').getByText(P.PAGE_COPY.noProfileNotice, { exact: true })).toBeVisible();
    for (const { key } of P.ITEMS) await expect(panelOf(page, key).getByRole('button'), `${key}: no panel fix`).toHaveCount(0);
    await page.locator('main').getByRole('button', { name: P.PAGE_COPY.noProfileFix, exact: true }).click();
    await expect.poll(() => log.publish.length, { timeout: 10000 }).toBe(1);
    const defaults = P.PROFILE_CONTENT_FIELDS.reduce((o, k) => { o[k] = typeof P.DEFAULTS[k] === 'string' ? P.DEFAULTS[k] : ''; return o; }, {});
    expect(log.publish[0].content).toEqual(defaults);
  });

  test('C11: an instance with no public address — no NIP-05, website or client-tag fix, and the no-public-address line on each (#2 AC-4)', async ({ page }) => {
    await mock(page, { attention: P.withProfile(P.PROFILE_DEV, ID_DONE) });
    await open(page);
    for (const key of ['nip05', 'website', 'client-tag']) {
      await expect(panelOf(page, key).getByRole('button'), `${key}: no fix`).toHaveCount(0);
      await expect(panelOf(page, key).getByText(P.PAGE_COPY.noPublicAddress, { exact: true })).toBeVisible();
    }
  });

  test('C12: a refused local write — the writer\'s own words, nothing reads as success, and the answer is asked again (#2 AC-5, AC-6)', async ({ page }) => {
    const log = await mock(page, { publish: { status: 500, body: P.PUBLISH_LOCAL_FAILED } });
    await open(page);
    const before = log.attention;
    await panelOf(page, 'client-tag').getByRole('button', { name: P.PANELS['client-tag'].fix({ domain: P.PUBLIC_INSTANCE.domain }), exact: true }).click();
    await expect(panelOf(page, 'client-tag').getByText(P.PUBLISH_LOCAL_FAILED.error, { exact: false })).toBeVisible();
    await expect(panelOf(page, 'client-tag').getByText('✅')).toHaveCount(0);
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
  });

  test('C13: 375 px wide, nothing scrolls sideways (#2 AC-1)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mock(page);
    await open(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
  });

  test('AV1: Make my personalized avatar — the person\'s own picture is stamped and previewed with "Publish this avatar" and "Not now"; nothing is stored or published (#3 AC-2)', async ({ page }) => {
    const log = await mock(page);
    await open(page);
    const panel = panelOf(page, 'avatar');
    await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
    await expect(panel.locator('img[src^="data:"], img[src^="blob:"]').first(), 'the stamped preview').toBeVisible({ timeout: 10000 });
    await expect(panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true })).toBeVisible();
    await expect(panel.getByRole('button', { name: P.AVATAR_COPY.discard, exact: true })).toBeVisible();
    expect(log.picture, 'the picture was asked for once').toBe(1);
    expect({ store: log.store, publish: log.publish.length }, 'nothing stored or published before the press').toEqual({ store: 0, publish: 0 });
  });

  test('AV2: Publish this avatar — stored on this instance, then the profile republished with only the picture changed, and the answer asked again (#3 AC-3)', async ({ page }) => {
    const log = await mock(page);
    await open(page);
    const before = log.attention;
    const panel = panelOf(page, 'avatar');
    await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
    await panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true }).click();
    await expect.poll(() => log.publish.length, { timeout: 10000 }).toBe(1);
    expect(log.store).toBe(1);
    expect(log.publish[0]).toEqual({ customerPubkey: CUSTOMER_USER.pubkey, content: { ...PUBLISHED_FIELDS, picture: STORED_URL } });
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
  });

  test('AV3: Not now — the preview goes, and nothing is sent (#3 AC-2)', async ({ page }) => {
    const log = await mock(page);
    await open(page);
    const panel = panelOf(page, 'avatar');
    await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
    await panel.getByRole('button', { name: P.AVATAR_COPY.discard, exact: true }).click();
    await expect(panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true })).toHaveCount(0);
    expect({ store: log.store, publish: log.publish.length }).toEqual({ store: 0, publish: 0 });
  });

  test('AV4: no picture, a picture that cannot be fetched, one that cannot be stamped — story 3\'s words, and no publish (#3 AC-5)', async ({ page }) => {
    for (const code of ['no-picture', 'unfetchable', 'not-stampable']) {
      const log = await mock(page, { picture: { status: 404, body: { success: false, code, error: `fixture ${code}` } } });
      await open(page);
      const panel = panelOf(page, 'avatar');
      await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
      await expect(panel.getByText(P.AVATAR_COPY[code], { exact: true }), `${code}: its line`).toBeVisible();
      await expect(panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true }), `${code}: no publish`).toHaveCount(0);
      expect({ store: log.store, publish: log.publish.length }).toEqual({ store: 0, publish: 0 });
      await page.unrouteAll({ behavior: 'ignoreErrors' });
    }
  });

  test('AV5: an instance with no public address — the avatar is previewed and stored, but not published: the no-public-address line instead (#3 AC-6)', async ({ page }) => {
    const log = await mock(page, { attention: P.withProfile(P.PROFILE_DEV, ID_DONE), store: { success: true, filename: 'ta-avatar-x.png', path: '/generated/ta-avatar-x.png', url: '' } });
    await open(page);
    const panel = panelOf(page, 'avatar');
    await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
    await panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true }).click();
    await expect(panel.getByText(P.PAGE_COPY.noPublicAddress, { exact: true })).toBeVisible();
    expect(log.publish.length, 'no profile publish without a public address').toBe(0);
  });

  test('AV6: the Edit Assistant Profile page offers the stamped avatar to a Customer, not only to the Owner (#3 AC-4)', async ({ page }) => {
    await mock(page);
    await open(page, P.EDITOR);
    await expect(page.locator('main').getByRole('button', { name: /Generate badged avatar/ })).toBeVisible();
  });

  // ── Review round 1 (story 2 B1, story 3 B1; ADR 0002 Amendment 1) ──
  // The press-time status read uses the non-strict local scan, so a failed scan reads as "no profile". A press must
  // publish only when that read agrees with what the page offered; otherwise nothing is posted and the page re-asks.

  test('C14: Set website when the press-time read finds no profile — nothing is published, the panel says so, and the answer is asked again (#2 AC-4; ADR 0002 Amendment 1)', async ({ page }) => {
    const log = await mock(page, { status: P.statusAnswer({ hasProfile: false }) });
    await open(page);
    const before = log.attention;
    const panel = panelOf(page, 'website');
    await panel.getByRole('button', { name: P.PANELS.website.fix({ url: P.PUBLIC_INSTANCE.website }), exact: true }).click();
    await expect(panel.getByText(P.PAGE_COPY.requestFailed, { exact: false })).toBeVisible();
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
    expect(log.status.length, 'the press read the status').toBeGreaterThan(0);
    expect(log.publish, 'no profile was published over the real one').toEqual([]);
  });

  test('C15: Publish the default profile when the press-time read finds a profile — nothing is published, the notice says so, and the answer is asked again (#2 AC-4; ADR 0002 Amendment 1)', async ({ page }) => {
    const log = await mock(page, { attention: P.withProfile(P.PROFILE_NONE, ID_DONE), status: P.statusAnswer({ hasProfile: true }) });
    await open(page);
    const before = log.attention;
    const notice = page.locator('main .bs-profile-check-notice');
    await notice.getByRole('button', { name: P.PAGE_COPY.noProfileFix, exact: true }).click();
    await expect(notice.getByText(P.PAGE_COPY.requestFailed, { exact: false })).toBeVisible();
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
    expect(log.publish, 'the default was not published over a profile the read found').toEqual([]);
  });

  test('AV7: Publish this avatar when the press-time read finds no profile — no profile is published, and the panel says so (#3 AC-3; ADR 0002 Amendment 1)', async ({ page }) => {
    const log = await mock(page, { status: P.statusAnswer({ hasProfile: false }) });
    await open(page);
    const before = log.attention;
    const panel = panelOf(page, 'avatar');
    await panel.getByRole('button', { name: P.AVATAR_COPY.fix, exact: true }).click();
    await panel.getByRole('button', { name: P.AVATAR_COPY.accept, exact: true }).click();
    await expect(panel.getByText(P.PAGE_COPY.requestFailed, { exact: false })).toBeVisible();
    await expect.poll(() => log.attention, { timeout: 10000 }).toBeGreaterThan(before);
    expect(log.publish, 'no profile was published over the real one').toEqual([]);
  });
});
