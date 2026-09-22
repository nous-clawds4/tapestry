const { test, expect } = require('@playwright/test');

/**
 * setup-status-and-alert #3: the Setup Alert, readable, announced as it reads, and current (browser class).
 *
 * Story: engineering-team/stories/setup-status-and-alert/3-setup-alert-polish.md
 * ADR:   engineering-team/decisions/setup-status-and-alert/0003-readable-named-and-current.md
 * Node half: test/setup-alert-polish.test.js (U/C/D/S).
 *
 *   P0 — the served origin runs a build with the decorative arrow.                         [prerequisite]
 *   P1 — "Finish setup" is dark on its amber at ≥ 4.5:1; the pill's other text ≥ 4.5:1.   [AC-1]
 *   P2 — the pill's accessible name is what it shows at 1280 / 800 / 375, the ⚠ and the
 *        arrow are not announced, Chrome's own accessibility tree agrees, and it still
 *        opens /setup from the keyboard.                                                 [AC-2]
 *   P3 — after the app publishes the viewer's kind 3 (Follow) or kind 10040 (the Treasure
 *        Map editor, the Map page's import), the pill and /setup catch up without a reload,
 *        one re-check per publish, never showing the old count while it runs — even when
 *        the outside relays answer before the local write; a kind 10000 (Mute) does not
 *        re-check.                                                                        [AC-3]
 *   P4 — no pill on /setup and its step pages in any letter case.                        [AC-4]
 *
 * AC-5 (nothing else changes) is story 2's and story 1's browser classes, re-run unchanged in intent
 * (tests/brainstorm/setup-alert.spec.js, tests/brainstorm/setup-status.spec.js).
 *
 * Hermetic: an /api/** catch-all is registered FIRST (the :4173 preview proxies /api to the live stack,
 * ledger row 2026-09-21-vite-preview-proxies-live-stack), and every WebSocket is answered in the page
 * (page.routeWebSocket), so no publish reaches a real relay.
 *
 * These FAIL against story 2's build: the chip is white on amber, the name is fixed, nothing
 * re-checks after a publish, and /SETUP shows the pill.
 */

const VIEWER = 'a1'.repeat(32);
const ASSISTANT = 'a2'.repeat(32);
const TARGET = 'b2'.repeat(32);
const FRIEND = 'c3'.repeat(32);
const TA = 'ee'.repeat(32);

const CUSTOMER = { pubkey: VIEWER, classification: 'customer', assistantPubkey: ASSISTANT };
const OWNER = { pubkey: VIEWER, classification: 'owner', assistantPubkey: TA };

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });
const step = (done, pending, extra = {}) => ({ done, pending, finished: true, ...extra });
const answer = (account, follow, activate) => ({ success: true, signedIn: true, steps: { account, follow, activate } });
const DONE = step(true, false);
const OPEN = step(false, true);
const TWO_LEFT = answer(DONE, step(false, true, { followCount: 0, source: null }), step(false, true, { otherProvider: false, source: null }));
const ONE_LEFT = answer(DONE, step(true, false, { followCount: 2, source: 'local' }), step(false, true, { otherProvider: false, source: null }));
const ONE_LEFT_MAP = answer(DONE, step(true, false, { followCount: 2, source: 'local' }), OPEN);
const NONE_LEFT = answer(DONE, step(true, false, { followCount: 2, source: 'local' }), step(true, false, { otherProvider: false, source: 'local' }));
const THREE_LEFT = answer(OPEN, step(false, true, { followCount: 0, source: null }), step(false, true, { otherProvider: false, source: null }));

// Story 3 AC-2's names; `n` counted steps.
const NAME_WIDE = (n) => `Finish setting up your account · ${n === 1 ? '1 step' : `${n} steps`} left Finish setup`;
const NAME_MID = 'Finish setting up your account Finish setup';
const NAME_PHONE = 'Finish setup';

const CONTACTS = { id: 'f0'.repeat(32), pubkey: VIEWER, kind: 3, created_at: 1790000000, tags: [['p', FRIEND]], content: '', sig: '00'.repeat(64) };
// An existing mute list, so Mute publishes straight away (with none, the page first asks to create one).
const MUTES = { id: 'f2'.repeat(32), pubkey: VIEWER, kind: 10000, created_at: 1790000000, tags: [], content: '', sig: '00'.repeat(64) };
const MAP = { id: 'f1'.repeat(32), pubkey: VIEWER, kind: 10040, created_at: 1790000000, tags: [['30382:rank', TA, 'wss://relay.example']], content: '', sig: '00'.repeat(64) };

/**
 * Mock every route, with a fake NIP-07 signer. `answers` are the /api/setup/status answers in order
 * (the last repeats); an entry may be { body, delayMs }. `external` allows external publishing, and
 * the page's WebSockets then accept every EVENT (OK true); otherwise the local-only gate is on.
 * `publishDelayMs` holds the local write back; `answerFor(state)`, when given, answers the status read
 * from what the local relay holds (state.localHasNew turns true when a publish is stored), like the
 * server's local-first check. `mapLocal: false` keeps the viewer's Map off the local relay and serves it
 * from an outside relay the Map page knows, so the page offers "Import to local strfry". `authDelayMs`
 * holds the sign-in answer back, so that page's relay list is in before its one Map search runs (the
 * page searches once, when sign-in resolves, and does not search again: OPEN.md row 260). `localRefusals`
 * refuses that many local writes first (the rest succeed). The outside relays record what they accept
 * (state.relayEvents), and the Map page's outside lookup serves the latest of them.
 */
async function mock(page, { who = CUSTOMER, answers = [TWO_LEFT], external = false, publishDelayMs = 0, answerFor = null, mapLocal = true, authDelayMs = 0, localRefusals = 0 } = {}) {
  const state = { statusCalls: 0, published: [], publishedAt: null, localHasNew: false, localEvent: null, relayEvents: [], refusalsLeft: localRefusals };
  const queue = answers.slice();

  await page.addInitScript((pk) => {
    let n = 0;
    window.__signer = [];
    window.nostr = {
      getPublicKey: async () => { window.__signer.push('getPublicKey'); return pk; },
      signEvent: async (e) => {
        n += 1;
        window.__signer.push(`signEvent:${e.kind}`);
        return { ...e, pubkey: pk, id: n.toString(16).padStart(64, '9'), sig: '0'.repeat(128) };
      },
    };
    // Every committed state of the pill, for "never shows the old count while the new check runs".
    window.__pillLog = [];
    const record = () => {
      const p = document.querySelector('a.bs-setup-alert');
      const text = p ? p.textContent : null;
      const last = window.__pillLog[window.__pillLog.length - 1];
      if (!last || last.text !== text) window.__pillLog.push({ t: Date.now(), text });
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
  }, VIEWER);

  await page.routeWebSocket(/.*/, (ws) => {
    ws.onMessage((message) => {
      let msg;
      try { msg = JSON.parse(String(message)); } catch { return; }
      if (msg[0] === 'EVENT') { state.relayEvents.push(msg[1]); ws.send(JSON.stringify(['OK', msg[1].id, true, ''])); }
      if (msg[0] === 'REQ') ws.send(JSON.stringify(['EOSE', msg[1]]));
    });
  });

  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by setup-alert-polish.spec.js' })));
  await page.route('**/api/neo4j/query', (r) => {
    // The Map page's "general purpose relays" query: one relay, so it can look for the Map outside.
    const cypher = (JSON.parse(r.request().postData() || '{}').cypher || '');
    const data = /general purpose relays/.test(cypher) ? [{ name: 'outside relay', json: JSON.stringify({ nostrRelay: { websocketUrl: 'wss://outside.example' } }) }] : [];
    return r.fulfill(json({ success: true, data }));
  });
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: 'bb'.repeat(32) })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/assistant/roster', (r) => r.fulfill(json({ success: true, assistants: [], viewer: null })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: { [VIEWER]: { name: 'Fixture Viewer' }, [TARGET]: { name: 'Fixture Target' } } })));
  await page.route('**/api/auth/status', async (r) => {
    if (authDelayMs) await new Promise((resolve) => setTimeout(resolve, authDelayMs));
    return r.fulfill(json({ authenticated: true, pubkey: who.pubkey }));
  });
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({ success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey })));
  await page.route('**/api/publish-policy', (r) => r.fulfill(json({ success: true, allowExternalPublish: external })));
  await page.route('**/api/relay/external**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    const kinds = filter.kinds || [];
    const outsideMap = [...state.relayEvents].reverse().find((e) => e.kind === 10040) || MAP;
    return r.fulfill(json({ success: true, events: kinds.includes(3) ? [CONTACTS] : kinds.includes(10000) ? [MUTES] : kinds.includes(10040) && !mapLocal ? [outsideMap] : [] }));
  });
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    const kinds = filter.kinds || [];
    const hasMap = kinds.includes(10040) && (mapLocal || state.localHasNew);
    const localMap = state.localEvent && state.localEvent.kind === 10040 ? state.localEvent : MAP;
    return r.fulfill(json({ success: true, events: hasMap ? [localMap] : [], count: hasMap ? 1 : 0 }));
  });
  await page.route('**/api/strfry/publish', async (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    state.published.push(body.event ? { kind: body.event.kind, pubkey: body.event.pubkey, id: body.event.id } : null);
    if (publishDelayMs) await new Promise((resolve) => setTimeout(resolve, publishDelayMs));
    if (state.refusalsLeft > 0) {
      state.refusalsLeft -= 1;
      return r.fulfill(json({ success: false, error: 'strfry import failed (fixture)' }));
    }
    state.localHasNew = true;
    state.localEvent = body.event || null;
    await r.fulfill(json({ success: true, event: body.event }));
    state.publishedAt = Date.now();
  });
  await page.route('**/api/setup/status**', async (r) => {
    state.statusCalls += 1;
    const next = answerFor ? answerFor(state) : (queue.length > 1 ? queue.shift() : queue[0]);
    const { body, delayMs } = next && next.body ? next : { body: next, delayMs: 0 };
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    return r.fulfill(json(body));
  });
  return state;
}

async function open(page, path) {
  await page.goto(path);
  await page.waitForTimeout(1500);
}

const pill = (page) => page.locator('a.bs-setup-alert[href="/setup"]');

/** Contrast of `el`'s text against what is painted behind it (translucent layers composited). */
async function textContrast(locator) {
  return locator.evaluate((el) => {
    const parse = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s); if (!m) return null; const v = m[1].split(',').map((x) => parseFloat(x)); return [v[0], v[1], v[2], v.length > 3 ? v[3] : 1]; };
    const lum = ([r, g, b]) => { const f = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const over = (top, a, base) => top.map((c, i) => c * a + base[i] * (1 - a));
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    let bg = [15, 15, 26];
    if (layers.length && layers[layers.length - 1][3] >= 1) bg = layers.pop().slice(0, 3);
    for (let i = layers.length - 1; i >= 0; i -= 1) bg = over(layers[i].slice(0, 3), layers[i][3], bg);
    let opacity = 1;
    for (let n = el; n && !n.matches('a.bs-setup-alert'); n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
    const fgRaw = parse(getComputedStyle(el).color);
    const fg = over(fgRaw.slice(0, 3), fgRaw[3] * opacity, bg);
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    return { ratio: (hi + 0.05) / (lo + 0.05), color: getComputedStyle(el).color, text: el.textContent.trim() };
  });
}

/** Does any JS chunk the origin serves contain `needle`? (Same walk as story 2's B0.) */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const html = await index.text();
  const queue = [...html.matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
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

test.describe('The Setup Alert, polished (setup-status-and-alert #3)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  test('P0: the served origin runs a build with the decorative arrow', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'bs-setup-alert-arrow');
    expect(found, `the bundle served by ${baseURL} has no "bs-setup-alert-arrow" (${why}). Rebuild the UI, or story 3 is not implemented.`).toBe(true);
  });

  /* ───────── P1 — the button reads clearly (AC-1) ───────── */
  for (const [width, parts] of [[1280, ['sentence', 'count']], [800, ['sentence']], [375, []]]) {
    test(`P1: at ${width} px "Finish setup" is dark on its amber at 4.5:1 or better, and the pill's other text keeps 4.5:1 (AC-1)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mock(page, { answers: [TWO_LEFT] });
      await open(page, '/tags');
      await expect(pill(page)).toBeVisible();
      const chip = await textContrast(pill(page).locator('.bs-setup-alert-button'));
      expect(chip.color, `the chip's text must be dark (the owner's call); it is ${chip.color}`).toBe('rgb(15, 15, 26)');
      expect(chip.ratio, `"${chip.text}" contrasts ${chip.ratio.toFixed(2)}:1 with its chip`).toBeGreaterThanOrEqual(4.5);
      for (const part of parts) {
        const c = await textContrast(pill(page).locator(`.bs-setup-alert-${part}`));
        expect(c.ratio, `the ${part} "${c.text}" contrasts ${c.ratio.toFixed(2)}:1 with the pill`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  /* ───────── P2 — it is announced as it reads (AC-2) ───────── */
  for (const [width, name] of [[1280, NAME_WIDE(2)], [800, NAME_MID], [375, NAME_PHONE]]) {
    test(`P2: at ${width} px the pill is a link named "${name}", with no aria-label and a decorative ⚠ and arrow (AC-2)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await mock(page, { answers: [TWO_LEFT] });
      await open(page, '/tags');
      await expect(pill(page)).toBeVisible();
      await expect(pill(page)).not.toHaveAttribute('aria-label', /.*/);
      await expect(pill(page)).toHaveAccessibleName(name);
      await expect(page.getByRole('link', { name, exact: true }), 'the same link, found by role and exact name').toHaveCount(1);
      await expect(pill(page).locator('[aria-hidden="true"]').filter({ hasText: '⚠' }), 'the ⚠ is decorative').toHaveCount(1);
      await expect(pill(page).locator('[aria-hidden="true"]').filter({ hasText: '→' }), 'the arrow is decorative').toHaveCount(1);
      await expect(pill(page).locator('.bs-setup-alert-button'), 'the button still reads "Finish setup →" on screen').toHaveText('Finish setup →');
    });
  }

  test('P2: with one step counted the wide name says "· 1 step left" (AC-2)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [ONE_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toHaveAccessibleName(NAME_WIDE(1));
  });

  test('P2: Chrome\'s own accessibility tree names the pill the same way at every width (AC-2)', async ({ page }) => {
    await mock(page, { answers: [THREE_LEFT] });
    const cdp = await page.context().newCDPSession(page);
    for (const [width, name] of [[1280, NAME_WIDE(3)], [800, NAME_MID], [375, NAME_PHONE]]) {
      await page.setViewportSize({ width, height: 800 });
      await open(page, '/tags');
      await expect(pill(page)).toBeVisible();
      const { nodes } = await cdp.send('Accessibility.getFullAXTree');
      const links = nodes.filter((n) => n.role && n.role.value === 'link' && n.name && /Finish setup$/.test(n.name.value || ''));
      expect(links.map((n) => n.name.value), `${width}px: Chrome's link name`).toEqual([name]);
    }
  });

  test('P2: Tab reaches the pill by its new name and Enter opens /setup (AC-2)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mock(page, { answers: [TWO_LEFT] });
    await open(page, '/tags');
    await expect(pill(page)).toBeVisible();
    let focused = false;
    for (let i = 0; i < 30 && !focused; i += 1) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => !!(document.activeElement && document.activeElement.matches('a.bs-setup-alert')));
    }
    expect(focused, 'Tab must reach the pill').toBe(true);
    await expect(page.getByRole('link', { name: NAME_WIDE(2), exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/setup$/);
  });

  /* ───────── P3 — it catches up after an in-app save (AC-3) ───────── */
  test('P3: following someone publishes the viewer\'s kind 3, and the pill counts one step fewer without a reload, never showing the old count while it re-checks (AC-3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { answers: [TWO_LEFT, { body: ONE_LEFT, delayMs: 1500 }] });
    await open(page, `/user/${TARGET}`);
    await expect(pill(page)).toContainText('· 2 steps left');
    await page.evaluate(() => { window.__sameDocument = true; });
    const followBtn = page.getByRole('button', { name: 'Follow', exact: true });
    await expect(followBtn, 'the profile page offers Follow').toBeEnabled();
    await followBtn.click();
    await expect.poll(() => state.published.length, { message: 'the Follow publishes one event' }).toBe(1);
    expect(state.published[0], 'it is the viewer\'s own kind 3').toMatchObject({ kind: 3, pubkey: VIEWER });
    await expect(pill(page), 'the pill counts the new answer, with no reload').toContainText('· 1 step left', { timeout: 8000 });
    expect(await page.evaluate(() => window.__sameDocument === true), 'no reload: the same document').toBe(true);
    expect(state.statusCalls, 'one re-check after the publish').toBe(2);
    const log = await page.evaluate(() => window.__pillLog);
    const stale = log.filter((e) => e.t > state.publishedAt + 300 && e.text && e.text.includes('2 steps left'));
    expect(stale, `the old count was shown as current while the new check ran: ${JSON.stringify(stale)}`).toEqual([]);
    // /setup reads the same, refreshed answer (the pill navigates in-app; no third read).
    await pill(page).click();
    await expect(page).toHaveURL(/\/setup$/);
    await expect(page.locator('main.bs-setup-main')).toContainText('2 of 3 complete');
    expect(state.statusCalls, '/setup shows the refreshed answer without reading again').toBe(2);
  });

  test('P3: when the Follow reaches both the local relay and outside relays, the pill still re-checks once (one event, one re-check) (AC-3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { answers: [TWO_LEFT, ONE_LEFT], external: true });
    await open(page, `/user/${TARGET}`);
    await expect(pill(page)).toContainText('· 2 steps left');
    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(pill(page)).toContainText('· 1 step left', { timeout: 8000 });
    await page.waitForTimeout(1500);
    expect(state.statusCalls, 'one Follow reaching both routes is announced once, so it re-checks once').toBe(2);
  });

  test('P3: when the outside relays answer before the local write, the pill still ends on the new answer — the re-check waits for the local write (AC-3, ADR 0003 Amendment 1)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    // The status read answers from the local relay, as the server's local-first check does: the old
    // follow list until the new one is stored there.
    const state = await mock(page, { external: true, publishDelayMs: 800, answerFor: (st) => (st.localHasNew ? ONE_LEFT : TWO_LEFT) });
    await open(page, `/user/${TARGET}`);
    await expect(pill(page)).toContainText('· 2 steps left');
    await page.getByRole('button', { name: 'Follow', exact: true }).click();
    await expect(pill(page), 'the pill must end on the new answer').toContainText('· 1 step left', { timeout: 8000 });
    await page.waitForTimeout(1500);
    await expect(pill(page), 'and stay there').toContainText('· 1 step left');
    expect(state.statusCalls, 'one re-check, after the local write').toBe(2);
  });

  test('P3: importing the viewer\'s Treasure Map to the local relay from the Map page re-checks too (AC-3, ADR 0003 § 2)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { who: OWNER, mapLocal: false, authDelayMs: 800, answerFor: (st) => (st.localHasNew ? NONE_LEFT : ONE_LEFT_MAP) });
    await open(page, '/tapestry/grapevine/treasure-map');
    await expect(pill(page)).toContainText('· 1 step left');
    await page.evaluate(() => { window.__sameDocument = true; });
    // The import sits in the relay panel, folded by default.
    await page.getByRole('button', { name: /Where this Map lives/ }).click();
    await page.getByRole('button', { name: /Import to local strfry/ }).click();
    await expect.poll(() => state.published.length, { message: 'the import publishes the Map once' }).toBe(1);
    expect(state.published[0], 'it is the viewer\'s own kind 10040').toMatchObject({ kind: 10040, pubkey: VIEWER, id: MAP.id });
    // The read count first: the pill also hides while the re-check runs, so "no pill" alone can pass early.
    await expect.poll(() => state.statusCalls, { message: 'one re-check after the import' }).toBe(2);
    await expect(pill(page), 'nothing is left, so the pill goes').toHaveCount(0, { timeout: 8000 });
    expect(await page.evaluate(() => window.__sameDocument === true), 'no reload: the same document').toBe(true);
  });

  test('P3: a Map edit whose local write fails while the relays accept, then an import of that same event, re-checks each time — the import is not dropped as already heard (AC-3, ADR 0003 Amendment 1)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { who: OWNER, mapLocal: false, external: true, authDelayMs: 800, localRefusals: 1,
      answerFor: (st) => (st.localHasNew ? NONE_LEFT : ONE_LEFT_MAP) });
    await open(page, '/tapestry/grapevine/treasure-map');
    await expect(pill(page)).toContainText('· 1 step left');
    await page.evaluate(() => { window.__sameDocument = true; });
    // 1. The hand editor publishes an edit: the local write is refused, the outside relays accept.
    await page.getByRole('button', { name: /Update your kind 10040 event Treasure Map by hand/ }).click();
    const editor = page.locator('textarea');
    await editor.fill(`${await editor.inputValue()}\n`);
    await page.getByRole('button', { name: /Publish updated event/ }).click();
    await expect.poll(() => state.statusCalls, { message: 'a relay took the edit, so it re-checks once' }).toBe(2);
    const edited = [...state.relayEvents].reverse().find((e) => e.kind === 10040);
    expect(edited, 'the edit reached the outside relays').toBeTruthy();
    await expect(pill(page), 'the local relay still has no Map, so step 3 is still counted').toContainText('· 1 step left');
    // 2. The page now finds the edit outside; import that same event to the local relay.
    await page.getByRole('button', { name: /Where this Map lives/ }).click();
    await page.getByRole('button', { name: /Import to local strfry/ }).click();
    await expect.poll(() => state.statusCalls, { message: 'the import of the same event must re-check again, not be dropped as already heard' }).toBe(3);
    expect(state.published[state.published.length - 1], 'the import published the edited event').toMatchObject({ kind: 10040, pubkey: VIEWER, id: edited.id });
    await expect(pill(page), 'stored locally now, nothing is left: the pill goes').toHaveCount(0, { timeout: 8000 });
    expect(await page.evaluate(() => window.__sameDocument === true), 'no reload: the same document').toBe(true);
  });

  test('P3: muting someone (kind 10000) is not a setup step, so the pill does not re-check (AC-3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { answers: [TWO_LEFT] });
    await open(page, `/user/${TARGET}`);
    await expect(pill(page)).toContainText('· 2 steps left');
    await page.getByRole('button', { name: 'Mute', exact: true }).click();
    await expect.poll(() => state.published.length, { message: 'the Mute publishes one event' }).toBe(1);
    expect(state.published[0]).toMatchObject({ kind: 10000, pubkey: VIEWER });
    await page.waitForTimeout(1500);
    expect(state.statusCalls, 'a kind 10000 publish must not re-check the setup status').toBe(1);
    await expect(pill(page)).toContainText('· 2 steps left');
  });

  test('P3: publishing the viewer\'s Treasure Map (kind 10040) from the Map editor re-checks too, and the pill goes once nothing is left (AC-3)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const state = await mock(page, { who: OWNER, answers: [ONE_LEFT_MAP, NONE_LEFT] });
    await open(page, '/tapestry/grapevine/treasure-map');
    await expect(pill(page)).toContainText('· 1 step left');
    await page.evaluate(() => { window.__sameDocument = true; });
    await page.getByRole('button', { name: /Update your kind 10040 event Treasure Map by hand/ }).click();
    // The editor offers Publish only once its text differs from the Map it loaded: a trailing newline
    // changes the text and still parses to the same event.
    const editor = page.locator('textarea');
    await editor.fill(`${await editor.inputValue()}\n`);
    await page.getByRole('button', { name: /Publish updated event/ }).click();
    await expect.poll(() => state.published.length, { message: 'the editor publishes one event' }).toBe(1);
    expect(state.published[0], 'it is the viewer\'s own kind 10040').toMatchObject({ kind: 10040, pubkey: VIEWER });
    await expect.poll(() => state.statusCalls, { message: 'one re-check after the Map publish' }).toBe(2);
    await expect(pill(page), 'nothing is left, so the pill goes').toHaveCount(0, { timeout: 8000 });
    expect(await page.evaluate(() => window.__sameDocument === true), 'no reload: the same document').toBe(true);
  });

  /* ───────── P4 — hidden on the setup pages whatever the case (AC-4) ───────── */
  for (const path of ['/SETUP', '/Setup/Follow', '/SETUP/ACTIVATE', '/Setup/create-account']) {
    test(`P4: no pill on ${path}, which shows a setup page (AC-4)`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await mock(page, { answers: [TWO_LEFT] });
      await open(page, '/tags');
      await expect(pill(page), 'control: the pill shows on /tags for this viewer').toBeVisible();
      await open(page, path);
      await expect(page.locator('main.bs-setup-main'), `${path} renders a setup page`).toBeVisible();
      await expect(pill(page), `no pill on ${path}`).toHaveCount(0);
    });
  }
});
