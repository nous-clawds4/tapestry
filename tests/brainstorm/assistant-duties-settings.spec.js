const { test, expect } = require('@playwright/test');
const AD = require('../../test/helpers/assistantDutiesFixtures');

/**
 * assistant-duties-settings #1: the Assistant Duties tab on the Settings page — the browser class.
 *
 * Story: engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.md
 * ADR:   engineering-team/decisions/assistant-duties-settings/0001-the-offered-duties-live-in-the-instance-settings.md
 * Plan:  engineering-team/stories/assistant-duties-settings/1-the-assistant-duties-tab.test-plan.md
 * Node half: test/assistant-duties-settings.test.js. Words, routes and defaults: test/helpers/assistantDutiesFixtures.js.
 *
 *   B0  — the served origin runs a build that has the tab.                                              [prerequisite]
 *   B1  — the Owner opens /tapestry/settings/assistant-duties: the tab, right after Assistant Profile and selected;
 *         the heading and the intro; the six, in order, each with its key, category and This instance's relay.  [AC-1, AC-2]
 *   B2  — an Admin sees the same; a customer and a visitor see the Settings page's refusal, no list, and nothing is
 *         asked of the duties route.                                                                         [AC-1]
 *   B3  — adding: This instance's relay by default; Another relay with a typed one; one PUT of the whole list with
 *         the new duty last; the server's answer shown, and the Saved line.                                  [AC-3, AC-4]
 *   B4  — a refusal shows its words and leaves the list as it was; a failed request says it could not save.   [AC-3, AC-4]
 *   B5  — removing a duty, and removing them all: the empty line.                                             [AC-4]
 *   B6  — reordering from the keyboard: Move up / Move down, disabled at the ends; one PUT in the new order.   [AC-4]
 *   B7  — reordering by dragging a row's handle onto another row: one PUT in the new order.                   [AC-4]
 *   B8  — changing a duty's relay: Change relay, Another relay, Save → one PUT; Cancel sends nothing.          [AC-4]
 *   B9  — Reset to defaults asks first: dismissed, nothing is sent; accepted, one POST and the six are back.  [AC-4]
 *   B10 — while a change is being saved, the tab's controls are disabled.                                      [AC-4]
 *   B11 — an added kind's category is the Duty Menu page's: 30383 is Scores, 30023 has none.                  [AC-2]
 *
 * Round 2 (ADR Amendment 1; review round 1 non-blocking 1 and 2; B3 and B11 re-aimed to whole kinds):
 *   B12 — an open Change relay belongs to its duty: another row removed or moved meanwhile, Save still writes that
 *         duty's relay and no other; the panel closes when its own duty is removed.                      [AC-4 as amended]
 *   B13 — Change relay with Another relay and the field empty sends the empty relay, and the server's refusal
 *         shows its words; the list stays as it was.                                                   [AC-4 as amended]
 *
 * ── Fixed here (test plan § Points the ADR leaves open) ───────────────────────────────────────────────────────────
 * The duties are one list, each duty one list item (<li>), in order; a row's drag handle carries the label
 * "Drag to reorder"; the relay choice is two radio buttons with the story's labels; the typed relay is a text field
 * with the `wss://` placeholder; the key field is labelled "Treasure Map key".
 *
 * ── Hermetic by construction ─────────────────────────────────────────────────────────────────────────────────────
 * Every /api route is mocked. The catch-all is registered FIRST (so every later route wins) and answers 599
 * { success: false }. The duties routes act as the server would: GET answers the list, PUT stores the list it was
 * sent (or answers a scenario's refusal), POST …/reset brings back the six. App routes (/tapestry/**) are answered
 * with the served app shell, so client routing works on a static server.
 *
 * ── Running it ───────────────────────────────────────────────────────────────────────────────────────────────────
 *   cd ui && npx vite build --outDir ../tmp/ads-dist --emptyOutDir
 *   cd tmp/ads-dist && python3 -m http.server 4175 --bind 127.0.0.1      (background)
 *   BRAINSTORM_SERVER_ACCESSIBLE=true BRAINSTORM_BASE_URL=http://localhost:4175 \
 *     npx playwright test tests/brainstorm/assistant-duties-settings.spec.js --project=chromium
 *
 * These FAIL against the build before this story: /tapestry/settings/assistant-duties redirects to the Relays tab,
 * and there is no Assistant Duties tab.
 */

const OWNER = { pubkey: 'a0'.repeat(32), classification: 'owner', assistantPubkey: 'a1'.repeat(32) };
const ADMIN = { pubkey: 'ad'.repeat(32), classification: 'admin', assistantPubkey: 'a2'.repeat(32) };
const CUSTOMER = { pubkey: 'cc'.repeat(32), classification: 'customer', assistantPubkey: 'c1'.repeat(32) };
const TYPED = 'wss://typed.example';

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const squash = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keys = (list) => list.map((d) => d.key);

/**
 * Mock every route. `duties` is the list the server holds (default the six). `put` is a scenario for the PUT: null
 * (store what was sent and answer it), { status, body } (answer that and store nothing), 'error' (a 502 that is not
 * JSON) or { delayMs } (store and answer, late).
 */
async function mock(page, { who = OWNER, duties = AD.DEFAULT_DUTIES, put = null } = {}) {
  const state = { duties: AD.copyOf(duties) };
  const log = { api: [], gets: 0, puts: [], resets: 0, settingsPuts: 0 };
  page.on('request', (req) => {
    const u = new URL(req.url());
    if (u.pathname.startsWith('/api/')) log.api.push(`${req.method()} ${u.pathname}`);
  });
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-duties-settings.spec.js' }, 599)));
  // The app shell for client routes on a static server.
  await page.route('**/tapestry/**', async (r) => {
    if (r.request().resourceType() !== 'document') return r.fallback();
    const shell = await r.fetch({ url: new URL('/', r.request().url()).href });
    return r.fulfill({ response: shell });
  });
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'aa'.repeat(32) })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER.pubkey })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json(who ? { authenticated: true, pubkey: who.pubkey } : { authenticated: false, pubkey: null })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json(who
    ? { success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey }
    : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null })));
  await page.route('**/api/assistant/attention**', (r) => r.fulfill(json({ success: true, signedIn: Boolean(who), hasAssistant: false, actions: {} })));
  await page.route('**/api/setup/status**', (r) => r.fulfill(json({ success: true, signedIn: Boolean(who), steps: {} })));
  // The Settings page's own read of the generic settings; a write to it would be the wrong route for this tab.
  await page.route('**/api/settings', (r) => {
    if (r.request().method() !== 'GET') { log.settingsPuts += 1; return r.fulfill(json({ success: false, error: 'the tab must not use the generic save' }, 599)); }
    return r.fulfill(json({ success: true, settings: { aRelays: {} }, defaults: { aRelays: {} }, overrides: {}, settingsPath: '/tmp/settings.json' }));
  });
  await page.route(`**${AD.ROUTES.reset}`, (r) => {
    if (r.request().method() !== 'POST') return r.fulfill(json({ success: false }, 405));
    log.resets += 1;
    state.duties = AD.copyOf(AD.DEFAULT_DUTIES);
    return r.fulfill(json({ success: true, duties: state.duties }));
  });
  await page.route(`**${AD.ROUTES.list}`, async (r) => {
    const method = r.request().method();
    if (method === 'GET') { log.gets += 1; return r.fulfill(json({ success: true, duties: state.duties })); }
    if (method !== 'PUT') return r.fulfill(json({ success: false }, 405));
    let body = null;
    try { body = JSON.parse(r.request().postData() || 'null'); } catch { body = null; }
    log.puts.push(body);
    if (put === 'error') return r.fulfill({ status: 502, contentType: 'text/html', body: '<html>bad gateway</html>' });
    if (put && put.status) return r.fulfill(json(put.body, put.status));
    if (put && put.delayMs) await wait(put.delayMs);
    state.duties = AD.copyOf((body && body.duties) || []);
    try { return await r.fulfill(json({ success: true, duties: state.duties })); } catch { return undefined; }
  });
  return { log, state };
}

async function open(page, address = AD.TAB.url, settleMs = 1200) {
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
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI?' };
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

/** The tab's duty rows, in order. */
const rows = (page) => page.locator('main li').filter({ has: page.getByRole('button', { name: AD.COPY.remove, exact: true }) });
const rowOf = (page, key) => rows(page).filter({ has: page.locator('code', { hasText: new RegExp(`^${key.replace(/[*]/g, '\\*')}$`) }) });
async function rowKeys(page) {
  const out = [];
  const n = await rows(page).count();
  for (let i = 0; i < n; i += 1) out.push(squash(await rows(page).nth(i).locator('code').first().innerText()));
  return out;
}
const tabButton = (page) => page.getByRole('button', { name: AD.TAB.label, exact: true });

test.describe('The Assistant Duties tab (assistant-duties-settings #1)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
  });

  test('B0: the served origin runs a build that has the Assistant Duties tab', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, AD.COPY.intro);
    expect(found, `the bundle served by ${baseURL} does not carry the tab's intro (${why}). Rebuild the UI, or the story is not built yet.`).toBe(true);
  });

  test('B1: the Owner opens /tapestry/settings/assistant-duties — the tab, right after Assistant Profile and selected; the heading and intro; the six in order, each with its key, category and This instance\'s relay (AC-1, AC-2)', async ({ page }) => {
    const { log } = await mock(page);
    const main = await open(page);
    expect(new URL(page.url()).pathname, 'not redirected to the Relays tab').toBe(AD.TAB.url);
    await expect(tabButton(page)).toHaveClass(/\bactive\b/);
    const labels = (await page.locator('.tab-bar button').allInnerTexts()).map(squash);
    const i = labels.indexOf(AD.TAB.label);
    expect(i, `the tab bar: ${JSON.stringify(labels)}`).toBeGreaterThan(0);
    expect(labels[i - 1]).toBe('🤖 Assistant Profile');
    await expect(main.getByRole('heading', { name: AD.COPY.heading, exact: true })).toBeVisible();
    await expect(main.getByText(AD.COPY.intro, { exact: true })).toBeVisible();
    expect(await rowKeys(page)).toEqual(keys(AD.DEFAULT_DUTIES));
    for (const d of AD.DEFAULT_DUTIES) {
      const text = squash(await rowOf(page, d.key).innerText());
      expect(text, `${d.key}'s row`).toContain(AD.DEFAULT_CATEGORIES[d.key]);
      expect(text, `${d.key}'s row`).toContain(AD.COPY.thisInstance);
    }
    expect(log.gets, 'the list is read once').toBe(1);
  });

  test('B2: an Admin sees the tab and the list; a customer and a visitor see the Settings page\'s refusal, no list, and the duties route is never asked (AC-1)', async ({ page }) => {
    await mock(page, { who: ADMIN });
    await open(page);
    expect(await rowKeys(page)).toEqual(keys(AD.DEFAULT_DUTIES));
    for (const who of [CUSTOMER, null]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const { log } = await mock(page, { who });
      const main = await open(page);
      await expect(main.getByText('Settings are only available to the owner.', { exact: false })).toBeVisible();
      await expect(rows(page)).toHaveCount(0);
      expect(log.gets, `${who ? who.classification : 'a visitor'}: the duties route is never asked`).toBe(0);
    }
  });

  test('B3: adding — This instance\'s relay is chosen by default; a key with it is added last with no relay; Another relay sends the typed one; each is one PUT of the whole list; the answer is shown with the Saved line (AC-3, AC-4)', async ({ page }) => {
    const { log } = await mock(page);
    const main = await open(page);
    await expect(main.getByRole('radio', { name: AD.COPY.thisInstance, exact: true })).toBeChecked();
    await main.getByLabel(AD.COPY.keyLabel, { exact: true }).fill('30395');
    await main.getByRole('button', { name: AD.COPY.add, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    const first = log.puts[0].duties;
    expect(keys(first)).toEqual([...keys(AD.DEFAULT_DUTIES), '30395']);
    expect(first[first.length - 1].relay || null, 'This instance\'s relay sends no relay').toBeNull();
    await expect(main.getByText(AD.COPY.saved, { exact: true })).toBeVisible();
    expect((await rowKeys(page)).slice(-1)).toEqual(['30395']);

    await main.getByLabel(AD.COPY.keyLabel, { exact: true }).fill('30383');
    await main.getByRole('radio', { name: AD.COPY.anotherRelay, exact: true }).check();
    await main.getByPlaceholder(AD.COPY.relayPlaceholder, { exact: true }).last().fill(TYPED);
    await main.getByRole('button', { name: AD.COPY.add, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(2);
    const second = log.puts[1].duties;
    expect(second[second.length - 1]).toEqual({ key: '30383', relay: TYPED });
    expect(squash(await rowOf(page, '30383').innerText())).toContain(TYPED);
    expect(log.settingsPuts, 'never the generic settings save').toBe(0);
  });

  test('B4: a refusal shows its words and the list stays as it was; a failed request says it could not save (AC-3, AC-4)', async ({ page }) => {
    for (const [code, words] of Object.entries(AD.COPY.refusals)) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      const { log } = await mock(page, { put: { status: 400, body: { success: false, code, index: 6 } } });
      const main = await open(page);
      await main.getByLabel(AD.COPY.keyLabel, { exact: true }).fill('30382');
      await main.getByRole('button', { name: AD.COPY.add, exact: true }).click();
      await expect.poll(() => log.puts.length).toBe(1);
      await expect(main.getByText(words, { exact: true }), `${code}'s words`).toBeVisible();
      await expect(main.getByText(AD.COPY.saved, { exact: true })).toHaveCount(0);
      expect(await rowKeys(page), `${code}: the list as it was`).toEqual(keys(AD.DEFAULT_DUTIES));
    }
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const { log } = await mock(page, { put: 'error' });
    const main = await open(page);
    await rowOf(page, '30393').getByRole('button', { name: AD.COPY.remove, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    await expect(main.getByText(AD.COPY.requestFailed, { exact: true })).toBeVisible();
    expect(await rowKeys(page)).toEqual(keys(AD.DEFAULT_DUTIES));
  });

  test('B5: removing a duty sends the list without it; removing every duty shows the empty line (AC-4)', async ({ page }) => {
    const { log } = await mock(page);
    const main = await open(page);
    await rowOf(page, '30393').getByRole('button', { name: AD.COPY.remove, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    expect(keys(log.puts[0].duties)).toEqual(['30382', '30392', '30394', '39998', '39999']);
    await expect(rowOf(page, '30393')).toHaveCount(0);
    for (let n = 5; n > 0; n -= 1) {
      await rows(page).first().getByRole('button', { name: AD.COPY.remove, exact: true }).click();
      await expect.poll(() => log.puts.length).toBe(7 - n);
      await expect(rows(page)).toHaveCount(n - 1);
    }
    expect(log.puts[log.puts.length - 1].duties).toEqual([]);
    await expect(main.getByText(AD.COPY.empty, { exact: true })).toBeVisible();
  });

  test('B6: reordering from the keyboard — Move up is disabled on the first row and Move down on the last; Enter on Move down sends the new order once (AC-4)', async ({ page }) => {
    const { log } = await mock(page);
    await open(page);
    await expect(rows(page).first().getByRole('button', { name: AD.COPY.moveUp, exact: true })).toBeDisabled();
    await expect(rows(page).last().getByRole('button', { name: AD.COPY.moveDown, exact: true })).toBeDisabled();
    await rows(page).first().getByRole('button', { name: AD.COPY.moveDown, exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => log.puts.length).toBe(1);
    expect(keys(log.puts[0].duties)).toEqual(['30392', '30382', '30393', '30394', '39998', '39999']);
    expect(await rowKeys(page)).toEqual(['30392', '30382', '30393', '30394', '39998', '39999']);
  });

  test('B7: reordering by dragging — the last row\'s handle dropped on the first row sends the new order once (AC-4)', async ({ page }) => {
    const { log } = await mock(page);
    await open(page);
    const handle = rowOf(page, '39999').getByLabel(AD.COPY.dragHandle, { exact: true });
    await handle.dragTo(rowOf(page, '30382'));
    await expect.poll(() => log.puts.length).toBe(1);
    expect(keys(log.puts[0].duties)[0]).toBe('39999');
    expect(keys(log.puts[0].duties).sort()).toEqual(keys(AD.DEFAULT_DUTIES).sort());
  });

  test('B8: changing a relay — Change relay, Another relay, a typed relay, Save sends one PUT with it; Cancel sends nothing; back to This instance\'s relay drops the field (AC-4)', async ({ page }) => {
    const { log } = await mock(page);
    await open(page);
    const row = () => rowOf(page, '30382');
    await row().getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await row().getByRole('button', { name: AD.COPY.cancel, exact: true }).click();
    await page.waitForTimeout(500);
    expect(log.puts.length, 'Cancel sends nothing').toBe(0);
    await row().getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await row().getByRole('radio', { name: AD.COPY.anotherRelay, exact: true }).check();
    await row().getByPlaceholder(AD.COPY.relayPlaceholder, { exact: true }).fill(TYPED);
    await row().getByRole('button', { name: AD.COPY.save, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    expect(log.puts[0].duties[0]).toEqual({ key: '30382', relay: TYPED });
    expect(squash(await row().innerText())).toContain(TYPED);
    await row().getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await row().getByRole('radio', { name: AD.COPY.thisInstance, exact: true }).check();
    await row().getByRole('button', { name: AD.COPY.save, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(2);
    expect(log.puts[1].duties[0].relay || null).toBeNull();
  });

  test('B9: Reset to defaults asks first — dismissed, nothing is sent; accepted, one POST and the six are back (AC-4)', async ({ page }) => {
    const { log } = await mock(page, { duties: [{ key: '39999' }, { key: '30383', relay: TYPED }] });
    const main = await open(page);
    expect(await rowKeys(page)).toEqual(['39999', '30383']);
    const asked = [];
    page.once('dialog', (d) => { asked.push(d.message()); d.dismiss(); });
    await main.getByRole('button', { name: AD.COPY.reset, exact: true }).click();
    await page.waitForTimeout(500);
    expect(asked).toEqual([AD.COPY.resetConfirm]);
    expect(log.resets, 'dismissed: nothing is sent').toBe(0);
    page.once('dialog', (d) => d.accept());
    await main.getByRole('button', { name: AD.COPY.reset, exact: true }).click();
    await expect.poll(() => log.resets).toBe(1);
    await expect.poll(() => rowKeys(page)).toEqual(keys(AD.DEFAULT_DUTIES));
    expect(log.puts.length, 'reset is not a PUT').toBe(0);
  });

  test('B10: while a change is being saved, the tab\'s controls are disabled (AC-4)', async ({ page }) => {
    const { log } = await mock(page, { put: { delayMs: 2500 } });
    const main = await open(page);
    await rowOf(page, '30393').getByRole('button', { name: AD.COPY.remove, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    await expect(main.getByRole('button', { name: AD.COPY.add, exact: true })).toBeDisabled();
    await expect(main.getByRole('button', { name: AD.COPY.reset, exact: true })).toBeDisabled();
    await expect(rows(page).first().getByRole('button', { name: AD.COPY.remove, exact: true })).toBeDisabled();
    await expect(main.getByText(AD.COPY.saved, { exact: true })).toBeVisible({ timeout: 8000 });
    await expect(main.getByRole('button', { name: AD.COPY.add, exact: true })).toBeEnabled();
  });

  test('B11: an added kind\'s category is named as the Duty Menu page names it — 30383 is Scores; 30023 has no category (AC-2; re-aimed to whole kinds by ADR Amendment 1)', async ({ page }) => {
    await mock(page, { duties: [{ key: '30383' }, { key: '30023' }] });
    await open(page);
    expect(squash(await rowOf(page, '30383').innerText())).toContain('Scores');
    const other = squash(await rowOf(page, '30023').innerText());
    for (const name of ['Scores', 'Lists', 'Concepts']) expect(other, '30023 has no category').not.toContain(name);
  });
  test('B12: an open Change relay belongs to its duty — with another row removed and another moved meanwhile, Save writes that duty\'s relay and no other; removing its own duty closes the panel (AC-4 as amended; ADR Amendment 1 item 3)', async ({ page }) => {
    const { log } = await mock(page);
    await open(page);
    const row = () => rowOf(page, '39999');
    await row().getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await expect(row().getByRole('button', { name: AD.COPY.save, exact: true })).toBeVisible();
    await rowOf(page, '30393').getByRole('button', { name: AD.COPY.remove, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    await rowOf(page, '30382').getByRole('button', { name: AD.COPY.moveDown, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(2);
    await expect(row().getByRole('button', { name: AD.COPY.save, exact: true }), 'the panel is still under its own duty').toBeVisible();
    await row().getByRole('radio', { name: AD.COPY.anotherRelay, exact: true }).check();
    await row().getByPlaceholder(AD.COPY.relayPlaceholder, { exact: true }).fill(TYPED);
    await row().getByRole('button', { name: AD.COPY.save, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(3);
    const sent = log.puts[2].duties;
    expect(sent.find((d) => d.key === '39999')).toEqual({ key: '39999', relay: TYPED });
    expect(sent.filter((d) => d.relay).map((d) => d.key), 'no other duty gets the relay').toEqual(['39999']);

    await rowOf(page, '30394').getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await expect(rowOf(page, '30394').getByRole('button', { name: AD.COPY.save, exact: true })).toBeVisible();
    await rowOf(page, '30394').getByRole('button', { name: AD.COPY.remove, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(4);
    await expect(page.locator('main').getByRole('button', { name: AD.COPY.save, exact: true }), 'its duty is gone, so is the panel').toHaveCount(0);
  });

  test('B13: Change relay with Another relay and the field empty sends the empty relay, and the server\'s bad-relay refusal shows its words; the list stays as it was (AC-4 as amended; ADR Amendment 1 item 4)', async ({ page }) => {
    const { log } = await mock(page, { put: { status: 400, body: { success: false, code: 'bad-relay', index: 0 } } });
    const main = await open(page);
    const row = () => rowOf(page, '30382');
    await row().getByRole('button', { name: AD.COPY.changeRelay, exact: true }).click();
    await row().getByRole('radio', { name: AD.COPY.anotherRelay, exact: true }).check();
    await row().getByRole('button', { name: AD.COPY.save, exact: true }).click();
    await expect.poll(() => log.puts.length).toBe(1);
    expect(log.puts[0].duties[0], 'the empty relay is sent, not turned into This instance\'s relay').toEqual({ key: '30382', relay: '' });
    await expect(main.getByText(AD.COPY.refusals['bad-relay'], { exact: true })).toBeVisible();
    await expect(main.getByText(AD.COPY.saved, { exact: true })).toHaveCount(0);
    expect(await rowKeys(page)).toEqual(keys(AD.DEFAULT_DUTIES));
    expect(squash(await row().innerText())).toContain(AD.COPY.thisInstance);
  });
});
