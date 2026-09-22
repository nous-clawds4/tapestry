const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');

/**
 * assistant-identification-tags #2: the Identification Tags page, and your two taggings — the browser class.
 *
 * Story: engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.md
 * ADR:   engineering-team/decisions/assistant-identification-tags/0002-the-page-reads-the-one-answer-and-publishes-through-the-tagging-publisher.md
 * Plan:  engineering-team/stories/assistant-identification-tags/2-the-page-and-your-two-taggings.test-plan.md
 * Node half: test/assistant-identification-tags-page.test.js (C/S/R). Words and answers: test/helpers/identificationTagsFixtures.js.
 *
 *   B0  — the served origin runs a build that contains the page.                                        [prerequisite]
 *   B1  — everything present: the page, its two cards Done, four Present rows, no checkbox.              [AC-1, AC-2, AC-3]
 *   B2  — everything missing: the first card marked, two checked boxes, the button follows them,
 *         unchecking stores nothing (a reload checks them again).                                        [AC-2, AC-3]
 *   B3  — a tag not found: the sentence, a disabled unchecked box; the other row still publishable.      [AC-2, AC-3]
 *   B4  — nothing could be checked: the reason sentences, no boxes, both cards marked.                    [AC-2]
 *   B5  — the fetch fails: "did not answer"; a pending answer: the second card marked, its row Missing
 *         with a checked box and no button (story 3's).                                                   [AC-2, AC-5]
 *   B6  — signed out, no Assistant, and while sign-in resolves.                                           [AC-1]
 *   B7  — the publish: two signatures, two local writes, the kept-local summary and five skipped lines
 *         per tagging, then the rows flip and the hub counts nine.                                         [AC-4]
 *   B8  — the extension declines the second: the first is published, the second says so.                  [AC-4]
 *   B9  — no extension: the line, nothing signed, nothing sent.                                           [AC-4]
 *   B10 — the local write fails: the failed-local line (ADR 0002 sub-decision 5), the rows unchanged.     [AC-4]
 *   B11 — 375 px, a direct load and a reload, and the hub's card leads here.                             [AC-6]
 *   B12 — read-only until a press.                                                                        [AC-7]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every /api route is mocked. /api/setup/status answers "all done". /api/assistant/attention answers a queue: each read
 * takes the next answer, the last one repeats, so a press can be followed by a changed answer. /api/publish-policy answers
 * local-only, so the browser opens no relay socket; /api/strfry/publish is mocked and logged. The signer is an init-script
 * stub whose active account is the mocked viewer's (the publisher checks the two match).
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test (see tests/brainstorm/assistant-management-page.spec.js).
 *
 * These FAIL against the build before this story: the address is a placeholder page.
 */

const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST = 'ee'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };
const PERSON_ROWS = T.REQUIRED.filter((e) => e.signer === 'person');
const ASSISTANT_ROWS = T.REQUIRED.filter((e) => e.signer === 'assistant');

const SETUP_DONE = {
  success: true, signedIn: true, steps: {
    account: { done: true, pending: false, finished: true },
    follow: { done: true, pending: false, finished: true, followCount: 3, source: 'local' },
    activate: { done: true, pending: false, finished: true, otherProvider: false, source: 'local' },
  },
};

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const pathname = (page) => new URL(page.url()).pathname;
const textOf = (locator) => locator.evaluate((el) => el.textContent || '');

/**
 * Mock every route. `attention` is one answer or a queue of answers (an array; the last repeats) or 'error'.
 * `strfryPublish` is the /api/strfry/publish answer. Returns a log of every /api request, every non-GET, the attention
 * reads, and the events posted to /api/strfry/publish.
 */
async function mock(page, { who = CUSTOMER_USER, attention = T.DONE, authDelayMs = 0, strfryPublish = { success: true } } = {}) {
  const log = { api: [], nonGet: [], attentionCalls: 0, published: [] };
  const queue = Array.isArray(attention) ? attention.slice() : [attention];
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}${u.search}`);
    if (req.method() !== 'GET') log.nonGet.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-identification-tags-page.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null }));
  });
  await page.route('**/api/auth/user-classification', async (r) => {
    if (authDelayMs) await wait(authDelayMs);
    return r.fulfill(json(who
      ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });
  await page.route('**/api/setup/status**', (r) => r.fulfill(json(SETUP_DONE)));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json({ success: true, hasRelayKey: true, assistantPubkey: CUSTOMER_ASSISTANT, hasProfile: false })));
  await page.route('**/api/publish-policy', (r) => r.fulfill(json({ success: true, allowExternalPublish: false })));
  await page.route('**/api/strfry/publish', (r) => {
    try { log.published.push(r.request().postDataJSON()); } catch { log.published.push(null); }
    return r.fulfill(json(strfryPublish));
  });
  await page.route('**/api/assistant/attention**', (r) => {
    log.attentionCalls += 1;
    const next = queue.length > 1 ? queue.shift() : queue[0];
    if (next === 'error') return r.fulfill(json({ success: false, error: 'fixture failure' }, 500));
    return r.fulfill(json(next));
  });
  return log;
}

/** A NIP-07 stub whose active account is the mocked viewer's. `mode`: 'ok' | 'decline-second'. */
async function stubSigner(page, mode = 'ok') {
  await page.addInitScript(({ pubkey, mode }) => {
    window.__signed = [];
    window.nostr = {
      getPublicKey: async () => pubkey,
      signEvent: async (e) => {
        if (mode === 'decline-second' && window.__signed.length === 1) throw new Error('User rejected');
        const n = window.__signed.length + 1;
        const signed = { ...e, id: String(n).repeat(64).slice(0, 64), sig: 'b'.repeat(128) };
        window.__signed.push(signed);
        return signed;
      },
    };
  }, { pubkey: CUSTOMER, mode });
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

const cards = (page) => page.locator('.bs-idtags-card');
const personCard = (page) => cards(page).nth(0);
const assistantCard = (page) => cards(page).nth(1);
const rowsOf = (card) => card.locator('.bs-idtags-rows li');
const boxOf = (card, name) => card.getByRole('checkbox', { name, exact: true });
const buttonOf = (card, name) => card.getByRole('button', { name, exact: true });
const STATE_WORDS = /\b(Present|Missing|Checking…|Tag not found|Could not|Not found on this instance)\b/;

test.describe('The Identification Tags page, and your two taggings (assistant-identification-tags #2)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that contains the page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, T.PAGE_COPY.cards.person);
    expect(found, `the bundle served by ${baseURL} does not contain ${JSON.stringify(T.PAGE_COPY.cards.person)} (${why}). Rebuild the UI, or the story is not built yet — B1–B12 say so directly.`).toBe(true);
  });

  test('B1: everything present — the page, its words, two cards Done, four Present rows and no checkbox (AC-1, AC-2, AC-3)', async ({ page }) => {
    await mock(page, { attention: T.DONE });
    const main = await open(page);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
    await expect(main.getByRole('heading', { level: 1 })).toHaveText('Identification Tags');
    await expect(main.getByRole('link', { name: X.COPY.backToHub, exact: true })).toHaveAttribute('href', X.HUB);
    const text = squash(await textOf(main));
    expect(text, 'the owner\'s description').toContain(X.ACTIONS.find((a) => a.path === T.PAGE).text);
    expect(text, 'the Treasure Map sentence').toContain(T.PAGE_COPY.treasureMap);
    expect(text, 'no "Placeholder page." any more').not.toContain(X.COPY.placeholder);
    await expect(cards(page), 'two cards').toHaveCount(2);
    await expect(personCard(page).getByRole('heading', { name: T.PAGE_COPY.cards.person })).toBeVisible();
    await expect(assistantCard(page).getByRole('heading', { name: T.PAGE_COPY.cards.assistant })).toBeVisible();
    for (const [card, rows] of [[personCard(page), PERSON_ROWS], [assistantCard(page), ASSISTANT_ROWS]]) {
      await expect(card, 'a done card').toHaveClass(/is-done/);
      await expect(card.getByText(T.PAGE_COPY.doneBadge, { exact: true }), 'the Done badge').toBeVisible();
      await expect(rowsOf(card)).toHaveCount(2);
      for (const [i, e] of rows.entries()) {
        expect(squash(await textOf(rowsOf(card).nth(i)))).toContain(e.name);
        expect(squash(await textOf(rowsOf(card).nth(i)))).toContain(T.PAGE_COPY.states.present);
      }
      await expect(card.getByRole('checkbox'), 'no checkbox on a present row').toHaveCount(0);
    }
    const button = buttonOf(personCard(page), T.PAGE_COPY.buttons.person);
    if (await button.count()) await expect(button, 'nothing to publish').toBeDisabled();
  });

  test('B2: everything missing — the first card marked, both boxes checked, the button follows the boxes, and a reload checks them again (AC-2, AC-3)', async ({ page }) => {
    await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    const card = personCard(page);
    await expect(card).toHaveClass(/is-marked/);
    await expect(card.getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    for (const e of PERSON_ROWS) {
      expect(squash(await textOf(card))).toContain(T.PAGE_COPY.states.missing);
      await expect(boxOf(card, e.name), `${e.name} checked by default`).toBeChecked();
      await expect(boxOf(card, e.name)).toBeEnabled();
    }
    const button = buttonOf(card, T.PAGE_COPY.buttons.person);
    await expect(button).toBeEnabled();
    await boxOf(card, PERSON_ROWS[0].name).uncheck();
    await expect(card, 'still marked: unchecking is "not this time"').toHaveClass(/is-marked/);
    await expect(button, 'one still checked').toBeEnabled();
    await boxOf(card, PERSON_ROWS[1].name).uncheck();
    await expect(button, 'nothing checked').toBeDisabled();
    await page.reload();
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    for (const e of PERSON_ROWS) await expect(boxOf(personCard(page), e.name), 'nothing stored: checked again').toBeChecked();
  });

  test('B3: a tag not found — the sentence, a disabled unchecked box, and the other row still publishable (AC-2, AC-3)', async ({ page }) => {
    await mock(page, { attention: T.TAG_NOT_FOUND });
    await open(page);
    const card = personCard(page);
    expect(squash(await textOf(card))).toContain(T.PAGE_COPY.tagNotFound('My Agent'));
    await expect(boxOf(card, 'My Agent')).toBeDisabled();
    await expect(boxOf(card, 'My Agent')).not.toBeChecked();
    await expect(boxOf(card, 'My Tapestry Assistant')).toBeChecked();
    await expect(buttonOf(card, T.PAGE_COPY.buttons.person)).toBeEnabled();
    await expect(card).toHaveClass(/is-marked/);
  });

  test('B4: nothing could be checked — the reason on each row, no box, both cards marked (AC-2)', async ({ page }) => {
    await mock(page, { attention: T.UNFINISHED });
    await open(page);
    for (const card of [personCard(page), assistantCard(page)]) {
      await expect(card).toHaveClass(/is-marked/);
      const text = squash(await textOf(card));
      expect(text.split(T.PAGE_COPY.couldNotCheck['no-outside-relays']).length - 1, 'the sentence on each of the two rows').toBe(2);
      await expect(card.getByRole('checkbox')).toHaveCount(0);
    }
    const button = buttonOf(personCard(page), T.PAGE_COPY.buttons.person);
    if (await button.count()) await expect(button).toBeDisabled();
  });

  test('B5: the fetch fails, "did not answer"; a pending answer marks only the second card, whose row has a checked box and no button — that is story 3\'s (AC-2, AC-5)', async ({ page }) => {
    await mock(page, { attention: 'error' });
    await open(page);
    expect(squash(await textOf(personCard(page)))).toContain(T.PAGE_COPY.couldNotCheck['request-failed']);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: T.PENDING });
    await open(page);
    await expect(personCard(page)).toHaveClass(/is-done/);
    await expect(assistantCard(page)).toHaveClass(/is-marked/);
    await expect(boxOf(assistantCard(page), 'My Human')).toBeChecked();
    await expect(assistantCard(page).getByRole('button'), 'no button on the second card until story 3').toHaveCount(0);
  });

  test('B6: signed out, no Assistant, and while sign-in resolves (AC-1)', async ({ page }) => {
    await mock(page, { who: null });
    let main = await open(page);
    await expect(cards(page)).toHaveCount(2);
    expect(squash(await textOf(cards(page).first())), 'rows with no state').not.toMatch(STATE_WORDS);
    await expect(main.getByText(T.PAGE_COPY.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton, exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: GUEST_USER });
    main = await open(page);
    expect(squash(await textOf(cards(page).first()))).not.toMatch(STATE_WORDS);
    await expect(main.getByText(X.COPY.noAssistantLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('link', { name: X.COPY.noAssistantLink, exact: true })).toHaveAttribute('href', '/setup');

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: CUSTOMER_USER, authDelayMs: 2500 });
    await page.goto(T.PAGE);
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(800);
    const early = squash(await textOf(page.locator('main').first()));
    expect(early, 'neither line while sign-in resolves').not.toContain(T.PAGE_COPY.signedOutLine);
    expect(early).not.toContain(X.COPY.noAssistantLine);
  });

  test('B7: the publish — two signatures, two local writes, the kept-local summary with five skipped lines per tagging; then the rows flip and the hub counts nine (AC-4)', async ({ page }) => {
    await stubSigner(page, 'ok');
    const log = await mock(page, { attention: [T.MISSING_ALL, T.DONE] });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(2);
    const signed = await page.evaluate(() => window.__signed);
    expect(signed).toHaveLength(2);
    for (const [i, e] of PERSON_ROWS.entries()) {
      const ev = signed[i];
      expect(ev.kind).toBe(39999);
      expect(ev.pubkey).toBe(CUSTOMER);
      expect(ev.tags.find((t) => t[0] === 'p')[1], 'tags the viewer\'s own Assistant').toBe(CUSTOMER_ASSISTANT);
      expect(ev.tags.find((t) => t[0] === 'a')[1], 'the canonical tag').toBe(T.canonicalTagAddress(e.slug));
      expect(ev.tags.find((t) => t[0] === 'd')[1]).toBe(T.taggingDTag({ slug: e.slug, targetPubkey: CUSTOMER_ASSISTANT, signerPubkey: CUSTOMER }));
      expect(ev.tags.find((t) => t[0] === 'polarity')[1]).toBe('1');
      expect(log.published[i].signAs).toBe('client');
    }
    const results = card.locator('.bs-idtags-results');
    await expect(results).toBeVisible();
    const text = squash(await textOf(results));
    for (const e of PERSON_ROWS) expect(text).toContain(T.PUBLISH_WORDS.keptLocal(e.name));
    expect(text.split(T.PUBLISH_WORDS.relay.skipped).length - 1, 'five relays skipped per tagging').toBe(10);
    await expect.poll(() => log.attentionCalls, 'the answer was re-read after the local writes').toBeGreaterThanOrEqual(2);
    await expect(card, 'the rows flipped').toHaveClass(/is-done/, { timeout: 10000 });
    await page.goto(X.HUB);
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(squash(await textOf(page.locator('main').first()))).toContain(X.countText(9));
  });

  test('B8: the extension declines the second signature — the first is published, the second says so (AC-4)', async ({ page }) => {
    await stubSigner(page, 'decline-second');
    const log = await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(1);
    await page.waitForTimeout(1000);
    const text = squash(await textOf(card.locator('.bs-idtags-results')));
    expect(text).toContain(T.PUBLISH_WORDS.keptLocal(PERSON_ROWS[0].name));
    expect(text).toContain(T.PAGE_COPY.signatureRefused(PERSON_ROWS[1].name, 'User rejected'));
  });

  test('B9: no extension — the line, nothing signed, nothing sent (AC-4)', async ({ page }) => {
    await page.addInitScript(() => { try { delete window.nostr; } catch {} });
    const log = await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await page.waitForTimeout(1200);
    expect(squash(await textOf(card))).toContain(T.PAGE_COPY.noExtension);
    expect(log.nonGet, 'nothing sent').toEqual([]);
  });

  test('B10: the local write fails — the failed-local line, and the rows do not flip (ADR 0002 sub-decision 5)', async ({ page }) => {
    await stubSigner(page, 'ok');
    const log = await mock(page, { attention: T.MISSING_ALL, strfryPublish: { success: false, error: 'fixture: refused' } });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(2);
    await page.waitForTimeout(1000);
    const text = squash(await textOf(card.locator('.bs-idtags-results')));
    for (const e of PERSON_ROWS) expect(text).toContain(T.PUBLISH_WORDS.localFailedKept(e.name, 'fixture: refused'));
    await expect(card, 'still marked').toHaveClass(/is-marked/);
  });

  test('B11: 375 px wide nothing scrolls sideways; a direct load and a reload render; the hub\'s card leads here (AC-6)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    expect(await overflow(), 'missing rows with boxes').toBeLessThanOrEqual(0);
    await page.reload();
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Page not found' })).toHaveCount(0);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: T.DONE });
    await open(page);
    expect(await overflow(), 'present rows').toBeLessThanOrEqual(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    await open(page, X.HUB);
    await page.getByRole('link', { name: /Identification Tags$/ }).click();
    await expect.poll(() => pathname(page)).toBe(T.PAGE);
  });

  test('B12: read-only until a press — nothing but GETs, and no request beyond the answer and the top bar\'s (AC-7)', async ({ page }) => {
    const log = await mock(page, { attention: T.MISSING_ALL });
    const pathsOn = async (address) => { const from = log.api.length; await open(page, address); await page.waitForTimeout(1500); return new Set(log.api.slice(from).map((s) => s.replace(/^GET /, ''))); };
    const baseline = new Set([...(await pathsOn('/setup/follow')), ...(await pathsOn('/setup/follow'))]);
    const extra = [...(await pathsOn(T.PAGE))].filter((p) => !baseline.has(p));
    expect(extra, 'the page asks nothing the top bar (which reads the answer) does not').toEqual([]);
    expect(log.nonGet, 'nothing is published, signed or stored before a press').toEqual([]);
  });
});
