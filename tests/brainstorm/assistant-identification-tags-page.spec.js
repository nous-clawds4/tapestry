const { test, expect } = require('@playwright/test');
const X = require('../../test/helpers/assistantManagementFixtures');
const T = require('../../test/helpers/identificationTagsFixtures');

/**
 * assistant-identification-tags #2: the Identification Tags page, and your taggings — the browser class.
 * Re-aimed 2026-09-22 by identification-tags-authorship #1: each card lists one offered row and one parked row
 * ("Not offered yet", greyed, a disabled unchecked box); the person publishes one tagging, against Nous' definition.
 *
 * Story: engineering-team/stories/done/assistant-identification-tags/2-the-page-and-your-two-taggings.md
 * Re-aim: engineering-team/stories/identification-tags-authorship/1-two-authored-tags-and-two-parked-taggings.md (its ADR 0001, plan)
 * Node half: test/assistant-identification-tags-page.test.js (C/S/R). Words and answers: test/helpers/identificationTagsFixtures.js.
 *
 *   B0  — the served origin runs a build that contains the page.                                        [prerequisite]
 *   B1  — everything present: the page, its two cards Done, one Present and one parked row each.         [AC-1, AC-2, AC-3]
 *   B2  — the offered tagging missing: the first card marked, its box checked, the parked box inert,
 *         the button follows the box, unchecking stores nothing (a reload checks it again).             [AC-2, AC-3]
 *   B3  — a tag not found: the sentence, a disabled unchecked box, nothing publishable.                  [AC-2, AC-3]
 *   B4  — nothing could be checked: the reason sentences, only the parked boxes, both cards marked.       [AC-2]
 *   B5  — the fetch fails: "did not answer"; a pending answer: the second card marked, its offered row
 *         Missing with a checked box and its button.                                                     [AC-2, AC-5]
 *   B6  — signed out, no Assistant, and while sign-in resolves: parked rows say so, offered rows say nothing. [AC-1]
 *   B7  — the publish: one signature against Nous' definition, one local write, the kept-local summary
 *         and five skipped lines, then the row flips and the hub counts nine.                            [AC-4; authorship AC-4]
 *   B8  — the extension declines: nothing published, the refusal line.                                   [AC-4]
 *   B9  — no extension: the line, nothing signed, nothing sent.                                           [AC-4]
 *   B10 — the local write fails: the failed-local line (ADR 0002 sub-decision 5), the row unchanged.       [AC-4]
 *   B11 — 375 px, a direct load and a reload, and the hub's card leads here.                             [AC-6]
 *   B12 — read-only until a press.                                                                        [AC-7]
 *   B13 — the parked rows are greyed and inert on both cards, in every state.                            [authorship AC-3]
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
 * These FAIL against the build before the re-aim: every row has a state, "My Agent" and "My Human" have live boxes, and the
 * first card signs two taggings against the retired single author.
 */

const TA = 'aa'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST = 'ee'.repeat(32);
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };
const PERSON_ROWS = T.REQUIRED.filter((e) => e.signer === 'person');       // [My Tapestry Assistant (offered), My Agent (parked)]
const ASSISTANT_ROWS = T.REQUIRED.filter((e) => e.signer === 'assistant'); // [My Tapestry Owner (offered), My Human (parked)]
const OFFERED_PERSON = PERSON_ROWS.find((e) => e.offered);
const OFFERED_ASSISTANT = ASSISTANT_ROWS.find((e) => e.offered);
const PARKED_PERSON = PERSON_ROWS.find((e) => !e.offered);
const PARKED_ASSISTANT = ASSISTANT_ROWS.find((e) => !e.offered);
const PARKED_WORDS = T.PAGE_COPY.states.parked;

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

/** A NIP-07 stub whose active account is the mocked viewer's. `mode`: 'ok' | 'decline' (every signature refused). */
async function stubSigner(page, mode = 'ok') {
  await page.addInitScript(({ pubkey, mode }) => {
    window.__signed = [];
    window.nostr = {
      getPublicKey: async () => pubkey,
      signEvent: async (e) => {
        if (mode === 'decline') throw new Error('User rejected');
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

/** The parked row on a card: by name, greyed (is-parked, an opacity below 1), its box disabled and unchecked, the words. */
async function expectParked(card, entry) {
  const row = rowsOf(card).filter({ hasText: entry.name }).first();
  await expect(row, `${entry.name} is a parked row`).toHaveClass(/is-parked/);
  expect(squash(await textOf(row)), `${entry.name} says so`).toContain(PARKED_WORDS);
  expect(squash(await textOf(row)), 'and nothing else about its state').not.toMatch(STATE_WORDS);
  const opacity = await row.evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(opacity, `${entry.name} is greyed out`).toBeLessThan(1);
  await expect(boxOf(card, entry.name), `${entry.name}'s box is disabled`).toBeDisabled();
  await expect(boxOf(card, entry.name), `${entry.name}'s box is unchecked`).not.toBeChecked();
}

test.describe('The Identification Tags page, and your taggings (assistant-identification-tags #2, re-aimed by identification-tags-authorship #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that contains the page', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, T.PAGE_COPY.cards.person);
    expect(found, `the bundle served by ${baseURL} does not contain ${JSON.stringify(T.PAGE_COPY.cards.person)} (${why}). Rebuild the UI, or the story is not built yet — B1–B13 say so directly.`).toBe(true);
  });

  test('B1: everything present — the page, its words, two cards Done, one Present row and one parked row each (AC-1, AC-2, AC-3)', async ({ page }) => {
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
    for (const [card, offered, parked] of [[personCard(page), OFFERED_PERSON, PARKED_PERSON], [assistantCard(page), OFFERED_ASSISTANT, PARKED_ASSISTANT]]) {
      await expect(card, 'a done card: the parked row does not hold it back').toHaveClass(/is-done/);
      await expect(card.getByText(T.PAGE_COPY.doneBadge, { exact: true }), 'the Done badge').toBeVisible();
      await expect(rowsOf(card)).toHaveCount(2);
      const first = squash(await textOf(rowsOf(card).nth(0)));
      expect(first, 'the offered row first').toContain(offered.name);
      expect(first).toContain(T.PAGE_COPY.states.present);
      await expectParked(card, parked);
      await expect(card.getByRole('checkbox'), 'the parked row\'s box is the only one').toHaveCount(1);
    }
    const button = buttonOf(personCard(page), T.PAGE_COPY.buttons.person);
    if (await button.count()) await expect(button, 'nothing to publish').toBeDisabled();
  });

  test('B2: the offered tagging missing — the first card marked, its box checked, the parked box inert, the button follows the box, and a reload checks it again (AC-2, AC-3)', async ({ page }) => {
    await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    const card = personCard(page);
    await expect(card).toHaveClass(/is-marked/);
    await expect(card.getByText(X.COPY.needsAttention, { exact: true })).toBeVisible();
    expect(squash(await textOf(card))).toContain(T.PAGE_COPY.states.missing);
    await expect(boxOf(card, OFFERED_PERSON.name), `${OFFERED_PERSON.name} checked by default`).toBeChecked();
    await expect(boxOf(card, OFFERED_PERSON.name)).toBeEnabled();
    await expectParked(card, PARKED_PERSON);
    const button = buttonOf(card, T.PAGE_COPY.buttons.person);
    await expect(button).toBeEnabled();
    await boxOf(card, OFFERED_PERSON.name).uncheck();
    await expect(card, 'still marked: unchecking is "not this time"').toHaveClass(/is-marked/);
    await expect(button, 'nothing checked').toBeDisabled();
    await page.reload();
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    await expect(boxOf(personCard(page), OFFERED_PERSON.name), 'nothing stored: checked again').toBeChecked();
    await expect(boxOf(personCard(page), PARKED_PERSON.name), 'the parked box stays unchecked').not.toBeChecked();
  });

  test('B3: a tag not found — the sentence, a disabled unchecked box, nothing publishable, the card marked (AC-2, AC-3)', async ({ page }) => {
    await mock(page, { attention: T.TAG_NOT_FOUND });
    await open(page);
    const card = personCard(page);
    expect(squash(await textOf(card))).toContain(T.PAGE_COPY.tagNotFound(OFFERED_PERSON.name));
    await expect(boxOf(card, OFFERED_PERSON.name)).toBeDisabled();
    await expect(boxOf(card, OFFERED_PERSON.name)).not.toBeChecked();
    await expectParked(card, PARKED_PERSON);
    const button = buttonOf(card, T.PAGE_COPY.buttons.person);
    if (await button.count()) await expect(button, 'nothing publishable').toBeDisabled();
    await expect(card).toHaveClass(/is-marked/);
    await expect(assistantCard(page), 'the other card is publishable as before').toHaveClass(/is-marked/);
    await expect(boxOf(assistantCard(page), OFFERED_ASSISTANT.name)).toBeChecked();
  });

  test('B4: nothing could be checked — the reason on the offered row, only the parked box, both cards marked (AC-2)', async ({ page }) => {
    await mock(page, { attention: T.UNFINISHED });
    await open(page);
    for (const [card, parked] of [[personCard(page), PARKED_PERSON], [assistantCard(page), PARKED_ASSISTANT]]) {
      await expect(card).toHaveClass(/is-marked/);
      const text = squash(await textOf(card));
      expect(text.split(T.PAGE_COPY.couldNotCheck['no-outside-relays']).length - 1, 'the sentence on the offered row only').toBe(1);
      await expectParked(card, parked);
      await expect(card.getByRole('checkbox'), 'no box but the parked one').toHaveCount(1);
    }
    const button = buttonOf(personCard(page), T.PAGE_COPY.buttons.person);
    if (await button.count()) await expect(button).toBeDisabled();
  });

  test('B5: the fetch fails, "did not answer"; a pending answer marks only the second card, whose offered row has a checked box and the button (AC-2, AC-5)', async ({ page }) => {
    await mock(page, { attention: 'error' });
    await open(page);
    expect(squash(await textOf(personCard(page)))).toContain(T.PAGE_COPY.couldNotCheck['request-failed']);
    await expectParked(personCard(page), PARKED_PERSON);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: T.PENDING });
    await open(page);
    await expect(personCard(page)).toHaveClass(/is-done/);
    await expect(assistantCard(page)).toHaveClass(/is-marked/);
    await expect(boxOf(assistantCard(page), OFFERED_ASSISTANT.name)).toBeChecked();
    await expectParked(assistantCard(page), PARKED_ASSISTANT);
    await expect(assistantCard(page).getByRole('button', { name: T.PAGE_COPY.buttons.assistant, exact: true }), "the second card's button (story 3)").toHaveCount(1);
  });

  test('B6: signed out, no Assistant, and while sign-in resolves — the parked rows say so, the offered rows say nothing (AC-1)', async ({ page }) => {
    await mock(page, { who: null });
    let main = await open(page);
    await expect(cards(page)).toHaveCount(2);
    expect(squash(await textOf(rowsOf(cards(page).first()).nth(0))), 'the offered row has no state').not.toMatch(STATE_WORDS);
    await expectParked(cards(page).first(), PARKED_PERSON);
    await expectParked(cards(page).nth(1), PARKED_ASSISTANT);
    await expect(main.getByText(T.PAGE_COPY.signedOutLine, { exact: true })).toBeVisible();
    await expect(main.getByRole('button', { name: X.COPY.signInButton, exact: true })).toBeVisible();
    await expect(page.getByRole('checkbox'), 'only the two parked boxes').toHaveCount(2);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { who: GUEST_USER });
    main = await open(page);
    expect(squash(await textOf(rowsOf(cards(page).first()).nth(0)))).not.toMatch(STATE_WORDS);
    await expectParked(cards(page).first(), PARKED_PERSON);
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

  test('B7: the publish — one signature against Nous\' definition, one local write, the kept-local summary with five skipped lines; then the row flips and the hub counts nine (AC-4; authorship AC-4)', async ({ page }) => {
    await stubSigner(page, 'ok');
    const log = await mock(page, { attention: [T.MISSING_ALL, T.DONE] });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(1);
    const signed = await page.evaluate(() => window.__signed);
    expect(signed, 'one tagging: the offered one, never the parked one').toHaveLength(1);
    const ev = signed[0];
    expect(ev.kind).toBe(39999);
    expect(ev.pubkey).toBe(CUSTOMER);
    expect(ev.tags.find((t) => t[0] === 'p')[1], 'tags the viewer\'s own Assistant').toBe(CUSTOMER_ASSISTANT);
    expect(ev.tags.find((t) => t[0] === 'a')[1], 'the definition by its own author (Nous)').toBe(T.definitionAddress(OFFERED_PERSON));
    expect(ev.tags.find((t) => t[0] === 'e')[1], 'the definition\'s event id from the answer').toBe(T.taggingRow(OFFERED_PERSON).definition.eventId);
    expect(ev.tags.find((t) => t[0] === 'd')[1]).toBe(T.taggingDTag({ slug: OFFERED_PERSON.slug, targetPubkey: CUSTOMER_ASSISTANT, signerPubkey: CUSTOMER }));
    expect(ev.tags.find((t) => t[0] === 'polarity')[1]).toBe('1');
    expect(log.published[0].signAs).toBe('client');
    const results = card.locator('.bs-idtags-results');
    await expect(results).toBeVisible();
    const text = squash(await textOf(results));
    expect(text).toContain(T.PUBLISH_WORDS.keptLocal(OFFERED_PERSON.name));
    expect(text).not.toContain(`"${PARKED_PERSON.name}"`);
    expect(text.split(T.PUBLISH_WORDS.relay.skipped).length - 1, 'five relays skipped for the one tagging').toBe(5);
    await expect.poll(() => log.attentionCalls, 'the answer was re-read after the local write').toBeGreaterThanOrEqual(2);
    await expect(card, 'the row flipped').toHaveClass(/is-done/, { timeout: 10000 });
    await page.goto(X.HUB);
    await page.locator('main').first().waitFor({ timeout: 20000 });
    await page.waitForTimeout(1500);
    expect(squash(await textOf(page.locator('main').first()))).toContain(X.countText(9));
  });

  test('B8: the extension declines — nothing is published, the refusal line names the tagging (AC-4)', async ({ page }) => {
    await stubSigner(page, 'decline');
    const log = await mock(page, { attention: T.MISSING_ALL });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await page.waitForTimeout(1500);
    expect(log.published, 'nothing reached the relay').toHaveLength(0);
    const text = squash(await textOf(card.locator('.bs-idtags-results')));
    expect(text).toContain(T.PAGE_COPY.signatureRefused(OFFERED_PERSON.name, 'User rejected'));
    await expect(card, 'still marked').toHaveClass(/is-marked/);
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

  test('B10: the local write fails — the failed-local line, and the row does not flip (ADR 0002 sub-decision 5)', async ({ page }) => {
    await stubSigner(page, 'ok');
    const log = await mock(page, { attention: T.MISSING_ALL, strfryPublish: { success: false, error: 'fixture: refused' } });
    await open(page);
    const card = personCard(page);
    await buttonOf(card, T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(1);
    await page.waitForTimeout(1000);
    const text = squash(await textOf(card.locator('.bs-idtags-results')));
    expect(text).toContain(T.PUBLISH_WORDS.localFailedKept(OFFERED_PERSON.name, 'fixture: refused'));
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
    const pathsOn = async (address) => { const from = log.api.length; await open(page, address); await page.waitForTimeout(1500); return new Set(log.api.slice(from).map((s) => s.replace(/^GET /, '').replace(/\?.*$/, ''))); };
    const baseline = new Set([...(await pathsOn('/setup/follow')), ...(await pathsOn('/setup/follow'))]);
    const extra = [...(await pathsOn(T.PAGE))].filter((p) => !baseline.has(p));
    expect(extra, 'the page asks nothing the top bar (which reads the answer) does not').toEqual([]);
    expect(log.nonGet, 'nothing is published, signed or stored before a press').toEqual([]);
  });

  test('B13: the parked rows are greyed and inert on both cards, in every state — a click changes nothing, and a press never names them (identification-tags-authorship #1 AC-3)', async ({ page }) => {
    await stubSigner(page, 'ok');
    const log = await mock(page, { attention: [T.MISSING_ALL, T.MISSING_ALL] });
    await open(page);
    for (const [card, parked] of [[personCard(page), PARKED_PERSON], [assistantCard(page), PARKED_ASSISTANT]]) {
      await expectParked(card, parked);
      await boxOf(card, parked.name).click({ force: true });
      await expect(boxOf(card, parked.name), `${parked.name}: a click changes nothing`).not.toBeChecked();
    }
    await buttonOf(personCard(page), T.PAGE_COPY.buttons.person).click();
    await expect.poll(() => log.published.length, { timeout: 15000 }).toBe(1);
    const signed = await page.evaluate(() => window.__signed);
    expect(signed.map((e) => e.tags.find((t) => t[0] === 'd')[1]), 'only the offered tagging was signed').toEqual([T.taggingDTag({ slug: OFFERED_PERSON.slug, targetPubkey: CUSTOMER_ASSISTANT, signerPubkey: CUSTOMER })]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await mock(page, { attention: T.DONE });
    await open(page);
    for (const [card, parked] of [[personCard(page), PARKED_PERSON], [assistantCard(page), PARKED_ASSISTANT]]) await expectParked(card, parked);
  });
});
