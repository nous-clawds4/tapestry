const { test, expect } = require('@playwright/test');
const zlib = require('zlib');

/**
 * assistant-profile #4: One place — the My Assistant page. Browser half (B-class: what the page, the
 * menus and every entry point DO).
 *
 * Story: engineering-team/stories/done/assistant-profile/4-my-assistant-page.md
 * ADR:   engineering-team/decisions/done/assistant-profile/0004-my-assistant-page-hosts-the-one-editor.md
 * Node half: test/my-assistant-page.test.js (M/Q/E/A/W — W is this class's CI backstop).
 *
 * Every /api route is mocked, so each test decides exactly what the server answers:
 *
 *   B0  — the served bundle contains the code under test.                              [prerequisite]
 *   B1  — a visitor at /assistant is asked to sign in; no controls, no status request. [AC5]
 *   B2  — the Owner's page: the TA's pubkey, published or not, NIP-05, public link.    [AC1]
 *   B3  — a Customer's page is about THEIR assistant, never the instance TA.           [AC1, POV]
 *   B4  — Brainstorm menus (/about and the landing page): both items → /assistant.     [AC2]
 *   B5  — the Tapestry menu: both items open /assistant.                               [AC2]
 *   B6  — the dashboard's prompt and its checklist item → /assistant.                  [AC2]
 *   B7  — the profile-page banner → /assistant.                                         [AC2]
 *   B8  — the Tapestry Settings "Assistant Profile" tab opens /assistant.               [AC2]
 *   B9  — the old /tapestry/settings/assistant lands on /assistant, for every role.    [AC2]
 *   B10 — /settings has no editor of its own, only a link to /assistant.              [AC2]
 *   B11 — a guest with no assistant: the item disabled with its reason; the page
 *         explains — no editor, no create button, no status request.                   [AC3]
 *   B12 — an Admin with no assistant creates one on the page, reached from the menu,
 *         and the app knows about it at once.                                          [AC3]
 *   B13 — an Owner whose TA key is missing gets the Owner's words, and no create.      [AC3, AC4]
 *   B14 — only the Owner is offered the badged-avatar generator.                        [AC4]
 *   B15 — a refused badged-avatar request says what the server said.                   [AC4]
 *   B16 — a picture host that fails says why, in the server's words.                   [AC4]
 *   B17 — an Owner with genuinely no picture is told so, and offered the branded image. [AC4]
 *
 * Prerequisites: BRAINSTORM_SERVER_ACCESSIBLE=true, and BRAINSTORM_BASE_URL pointing at an origin serving
 * the BUILT ui under test. From an isolated worktree: `cd ui && npx vite build`, then serve its dist with
 * `npx vite preview --outDir <worktree>/dist --port 4173 --strictPort`. A source-only edit is INVISIBLE to
 * this class; B0 guards exactly that.
 *
 * Against the current build every test but part of B11 fails: /assistant renders "Page not found", the
 * menus and the banner point elsewhere, /settings and the Settings tab still hold the editor.
 */

// Fixtures, never live keys: the runtime lookups are mocked to return them.
const TA = 'aa'.repeat(32);
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const ADMIN_ASSISTANT = 'a1'.repeat(32);
const NEW_ADMIN_ASSISTANT = 'a2'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const GUEST = 'ee'.repeat(32);

const OWNER_USER = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA };
const ADMIN_USER = { pubkey: ADMIN, classification: 'admin', assistantPubkey: ADMIN_ASSISTANT };
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };
const GUEST_USER = { pubkey: GUEST, classification: 'guest', assistantPubkey: null };

const MY_ASSISTANT = '/assistant';
const NO_ASSISTANT_REASON = 'No assistant is provisioned for your account yet.';
const DOMAIN = 'staging.example.test';
const NIP05 = `olivia-tapestry-assistant-aaaaaa@${DOMAIN}`;
const MY_ITEM = "My Assistant's Profile";
const MANAGEMENT_ITEM = 'Assistant Management';
const PROMPT_BUTTON = /Set up my Assistant.s profile/;
const CHECKLIST_ACTION = /Set up profile/;
const GENERATE = /generate badged avatar/i;
const CREATE = /create my tapestry assistant key/i;
const FALLBACK = /use the branded image instead/i;

const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

/** A real, solid-colour PNG, so the composite's canvas has something to draw. */
function solidPng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: width }, () => Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const DEFAULTS = {
  name: "Fixture's Tapestry Assistant", display_name: "Fixture's Tapestry Assistant", about: 'fixture',
  picture: `https://${DOMAIN}/ta-avatar.png`, banner: '', website: `https://${DOMAIN}`, nip05: '', lud16: '',
};

/** The status answer for `customerPubkey`, whose assistant is `assistantPubkey` (null: no key). */
function statusAnswer(customerPubkey, assistantPubkey, { hasProfile = false } = {}) {
  const isOwner = customerPubkey === OWNER;
  if (!assistantPubkey) {
    return { success: true, hasRelayKey: false, hasProfile: false, profileSource: null, isPublicInstance: true, isOwner, defaults: DEFAULTS };
  }
  return {
    success: true, hasRelayKey: true, assistantPubkey, assistantNpub: 'npub1fixture',
    hasProfile, profile: hasProfile ? { name: 'Published Fixture', about: 'published' } : null,
    profileSource: hasProfile ? 'local' : null, isOwner, isPublicInstance: true,
    computedNip05: { localPart: NIP05.split('@')[0], domain: DOMAIN, address: NIP05 },
    defaults: DEFAULTS,
  };
}

/**
 * Mock every route. `who` is null (a visitor) or { pubkey, classification, assistantPubkey } — a copy, so a
 * provision can give it a key. `hasProfile` is the status answer's; `ownerAvatar` is 'ok' or
 * { status, body } for the proxy. Returns a live log.
 */
async function mock(page, { who = null, hasProfile = false, ownerAvatar = 'ok' } = {}) {
  const viewer = who ? { ...who } : null;
  const log = { status: [], provisions: 0, classifications: 0 };

  // Catch-all FIRST: Playwright tries the most recently registered matching route first.
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by my-assistant-page.spec.js' })));
  await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
  await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/relay/**', (r) => r.fulfill(json({ success: true, events: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  // The Tapestry Settings page loads the settings before it shows its tabs.
  await page.route('**/api/settings', (r) => r.fulfill(json({ success: true, settings: {}, defaults: {}, overrides: {} })));

  await page.route('**/api/auth/status', (r) => r.fulfill(json(viewer ? { authenticated: true, pubkey: viewer.pubkey } : { authenticated: false })));
  await page.route('**/api/auth/user-classification', (r) => {
    log.classifications++;
    return r.fulfill(json(viewer
      ? { success: true, classification: viewer.classification, pubkey: viewer.pubkey, assistantPubkey: viewer.assistantPubkey }
      : { success: true, classification: 'unauthenticated', pubkey: null, assistantPubkey: null }));
  });

  // The one answer every surface shares, about whoever is asked.
  await page.route('**/api/assistant/status**', (r) => {
    const url = new URL(r.request().url());
    const customerPubkey = url.searchParams.get('customerPubkey');
    log.status.push({ customerPubkey, defaults: url.searchParams.get('defaults') });
    const assistant = viewer && viewer.pubkey === customerPubkey ? viewer.assistantPubkey : null;
    return r.fulfill(json(statusAnswer(customerPubkey, assistant, { hasProfile })));
  });
  await page.route('**/api/assistant/provision-key', (r) => {
    log.provisions++;
    if (viewer) viewer.assistantPubkey = NEW_ADMIN_ASSISTANT;
    return r.fulfill(json({ success: true, pubkey: NEW_ADMIN_ASSISTANT, npub: 'npub1fixture' }));
  });
  await page.route('**/api/assistant/owner-avatar', (r) => (ownerAvatar === 'ok'
    ? r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(64, 64, [255, 255, 255]) })
    : r.fulfill(json(ownerAvatar.body, ownerAvatar.status))));
  await page.route('**/ta-avatar.png', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(64, 64, [0x95, 0x46, 0xed]) }));
  return log;
}

const pathname = (page) => new URL(page.url()).pathname;
const editor = (page) => page.locator('.settings-group').first();
async function editorText(page) { return (await editor(page).innerText()).replace(/\s+/g, ' '); }

/** Open /assistant, and fail plainly if it is not a page yet. */
async function openMyAssistant(page) {
  await page.goto(MY_ASSISTANT);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: 'Page not found' }),
    'ADR 0004: /assistant must be the My Assistant page — today no route serves it and it renders "Page not found"').toHaveCount(0);
  await expect(page.locator('main'), 'the My Assistant page renders its content in <main> (ADR 0004 § Implementation notes)').toHaveCount(1);
}
async function openEditorOnPage(page) {
  await openMyAssistant(page);
  await expect(editor(page), 'the page shows the assistant editor for a signed-in user who has a page').toBeVisible({ timeout: 20000 });
}

/** The Brainstorm avatar menu, opened. */
async function openBrainstormMenu(page) {
  await page.locator('.bs-usermenu-avatar-btn').first().click();
  const menu = page.locator('.bs-usermenu-dropdown').first();
  await expect(menu).toBeVisible();
  return menu;
}
/** A Brainstorm menu row: its tag, href, and disabled state. */
async function brainstormItem(menu, label) {
  const item = menu.locator('.bs-usermenu-link', { hasText: label }).first();
  await expect(item, `the menu has a "${label}" row`).toHaveCount(1);
  return item.evaluate((el) => ({
    href: el.getAttribute('href'),
    disabled: el.getAttribute('aria-disabled') === 'true',
    title: el.getAttribute('title'),
  }));
}

async function openDashboard(page) {
  await page.goto('/tapestry/');
  await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(1500);
}

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const queue = [...(await index.text()).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
  if (queue.length === 0) return { found: false, why: 'no built JS is referenced from the app shell — is this a built UI? Run `cd ui && npx vite build`.' };
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

test.describe('One place — the My Assistant page (assistant-profile #4)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that contains the code under test', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'no-picture');
    expect(found,
      `the bundle served by ${baseURL} does not contain "no-picture", the code the editor keys its "no profile picture" copy on ` +
      `(ADR 0004 sub-decision 5) (${why}). Either the bundle predates your edit — rebuild — or it is not implemented, in which ` +
      'case B15–B17 say so directly.').toBe(true);
  });

  /* ───────── B1 — AC5: no controls for a visitor ───────── */
  test('B1: a visitor who is not signed in is asked to sign in at /assistant, and sees no one\'s assistant controls — no editor, and no status request', async ({ page }) => {
    const log = await mock(page, { who: null });
    await openMyAssistant(page);
    const main = page.locator('main');
    await expect(main, 'AC5: the page asks the visitor to sign in').toContainText(/sign in/i);
    await expect(main.getByRole('button', { name: /sign in/i }), 'AC5: …with a way to do it, on the page itself').toHaveCount(1);
    await expect(page.locator('.settings-group'), 'AC5: "see no one\'s assistant controls" — no editor').toHaveCount(0);
    await expect(page.getByRole('button', { name: /publish profile/i }), 'no publish action for a visitor').toHaveCount(0);
    expect(log.status, 'a visitor has no assistant to ask about, so the page asks about no one').toEqual([]);
  });

  /* ───────── B2 — AC1: the Owner's page ───────── */
  test('B2: the Owner\'s page shows their assistant — the instance TA\'s pubkey, whether its profile is published, its NIP-05, and a link to its public profile at /user/‹TA›', async ({ page }) => {
    const log = await mock(page, { who: OWNER_USER, hasProfile: true });
    await openEditorOnPage(page);
    await expect(page.getByRole('heading', { level: 1 }), 'the page is "My Assistant"').toContainText(/My Assistant/);
    const text = await editorText(page);
    expect(text, 'AC1: the assistant\'s pubkey — the Owner\'s assistant is the instance TA').toContain(TA.slice(0, 12));
    expect(text, 'AC1: whether its profile is published (story 1\'s answer)').toMatch(/Currently published:?\s*✅?\s*Yes/);
    expect(text, 'AC1: its NIP-05, on a public instance').toContain(NIP05);
    await expect(page.getByRole('link', { name: /view public profile/i }),
      'ADR 0004 sub-decision 6: the public profile is the page search results use, /user/‹assistant›').toHaveAttribute('href', `/user/${TA}`);
    expect(log.status.map((s) => s.customerPubkey), 'the page asks about the signed-in Owner, and no one else').toEqual(log.status.map(() => OWNER));
  });

  /* ───────── B3 — AC1 + POV: whose assistant? ───────── */
  test('B3: a Customer\'s page is about the Customer\'s own assistant — every status request asks about them, the pubkey shown is their assistant\'s, never the instance TA\'s', async ({ page }) => {
    const log = await mock(page, { who: CUSTOMER_USER, hasProfile: false });
    await openEditorOnPage(page);
    const text = await editorText(page);
    expect(log.status.length, 'precondition: the page asked about an assistant').toBeGreaterThan(0);
    expect(log.status.map((s) => s.customerPubkey), 'principle 1: the viewer\'s own assistant, never the instance\'s').toEqual(log.status.map(() => CUSTOMER));
    expect(text, 'the Customer\'s assistant\'s pubkey').toContain(CUSTOMER_ASSISTANT.slice(0, 12));
    expect(text, 'never the instance TA').not.toContain(TA.slice(0, 12));
    expect(text, 'AC1: its profile is not published yet').toMatch(/Currently published:?\s*⚠️?\s*Not yet/);
    await expect(page.getByRole('link', { name: /view public profile/i })).toHaveAttribute('href', `/user/${CUSTOMER_ASSISTANT}`);
  });

  /* ───────── B4 — AC2: the Brainstorm menus ───────── */
  test('B4: in the Brainstorm avatar menu — on /about and on the landing page — "My Assistant\'s Profile" and "Assistant Management" both lead to /assistant, for the Owner, an Admin and a Customer', async ({ page }) => {
    for (const who of [OWNER_USER, ADMIN_USER, CUSTOMER_USER]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who });
      for (const where of ['/about', '/']) {
        await page.goto(where);
        await page.waitForLoadState('networkidle');
        const menu = await openBrainstormMenu(page);
        const mine = await brainstormItem(menu, MY_ITEM);
        expect(mine.href, `AC2 (${who.classification}, ${where}): "${MY_ITEM}" opens the My Assistant page, not a profile view`).toBe(MY_ASSISTANT);
        const mgmt = await brainstormItem(menu, MANAGEMENT_ITEM);
        expect(mgmt.href, `(${who.classification}, ${where}): "${MANAGEMENT_ITEM}" leads there too`).toBe(MY_ASSISTANT);
      }
    }
  });

  /* ───────── B5 — AC2: the Tapestry menu ───────── */
  test('B5: in the Tapestry avatar menu, "My Assistant\'s Profile" and "Assistant Management" both open /assistant', async ({ page }) => {
    await mock(page, { who: OWNER_USER, hasProfile: true });
    for (const label of [MY_ITEM, MANAGEMENT_ITEM]) {
      await openDashboard(page);
      await page.locator('.user-button').first().click();
      await page.locator('.user-dropdown').getByRole('button', { name: new RegExp(label.replace(/'/g, '.')) }).click();
      await expect.poll(() => pathname(page), { message: `AC2: "${label}" in the Tapestry menu must open ${MY_ASSISTANT}` }).toBe(MY_ASSISTANT);
    }
  });

  /* ───────── B6 — AC2: the dashboard ───────── */
  test('B6: the dashboard\'s prompt and its checklist item both lead to /assistant — here for a Customer, whom they used to send to /settings', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, hasProfile: false });
    await openDashboard(page);
    await page.getByRole('button', { name: CHECKLIST_ACTION }).click();
    await expect.poll(() => pathname(page), { message: 'AC2: the "Give your Assistant a profile" item leads to the My Assistant page' }).toBe(MY_ASSISTANT);
    await openDashboard(page);
    await page.getByRole('button', { name: PROMPT_BUTTON }).click();
    await expect.poll(() => pathname(page), { message: 'AC2: the prompt leads to the My Assistant page' }).toBe(MY_ASSISTANT);
  });

  /* ───────── B7 — AC2: the banner ───────── */
  test('B7: the "Edit Assistant profile" banner on a Customer\'s assistant\'s profile page leads to /assistant — not to the Owner-only Settings tab', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER });
    await page.goto(`/tapestry/users/${CUSTOMER_ASSISTANT}`);
    await expect(page.getByText('This is your Tapestry Assistant.'), 'precondition: the banner shows on your own assistant\'s page').toBeVisible({ timeout: 20000 });
    await page.getByRole('link', { name: /edit assistant profile/i }).click();
    await expect.poll(() => pathname(page), { message: 'AC2: the banner leads to the My Assistant page' }).toBe(MY_ASSISTANT);
  });

  /* ───────── B8 — AC2: the Tapestry Settings tab ───────── */
  test('B8: the Tapestry Settings "Assistant Profile" tab opens /assistant', async ({ page }) => {
    await mock(page, { who: OWNER_USER, hasProfile: true });
    await page.goto('/tapestry/settings/relays');
    const tab = page.locator('.tab-bar').getByRole('button', { name: /assistant profile/i });
    await expect(tab, 'precondition: the Settings page shows its tabs to the Owner').toBeVisible({ timeout: 20000 });
    await tab.click();
    await expect.poll(() => pathname(page), { message: 'AC2: the tab leads to the My Assistant page — Settings offers no editor of its own' }).toBe(MY_ASSISTANT);
  });

  /* ───────── B9 — AC2: the old address ───────── */
  test('B9: the old address /tapestry/settings/assistant lands on /assistant — for the Owner, and for a Customer whom the Settings page would have turned away', async ({ page }) => {
    for (const who of [OWNER_USER, CUSTOMER_USER]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who, hasProfile: true });
      await page.goto('/tapestry/settings/assistant');
      await expect.poll(() => pathname(page), { message: `ADR 0004 sub-decision 3 (${who.classification}): the old address redirects to the page` }).toBe(MY_ASSISTANT);
    }
  });

  /* ───────── B10 — AC2: /settings ───────── */
  test('B10: the Brainstorm /settings page has no assistant editor of its own — it links to /assistant', async ({ page }) => {
    await mock(page, { who: CUSTOMER_USER, hasProfile: true });
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.bss-page').first(), 'precondition: /settings renders for a signed-in Customer').toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: /publish profile/i }), 'AC2: "neither Settings area offers an editor of its own"').toHaveCount(0);
    await expect(page.getByText(/Currently published/), 'AC2: no assistant status panel either').toHaveCount(0);
    await expect(page.locator(`a[href="${MY_ASSISTANT}"]`).first(), 'AC2: the card that held the editor now leads to the My Assistant page').toBeVisible();
  });

  /* ───────── B11 — AC3: someone who may not create one ───────── */
  test('B11: a signed-in guest with no assistant finds "My Assistant\'s Profile" disabled with its explanation and "Assistant Management" still leading to /assistant — where the page explains, with no editor, no create button and no status request', async ({ page }) => {
    const log = await mock(page, { who: GUEST_USER });
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    const menu = await openBrainstormMenu(page);
    const mine = await brainstormItem(menu, MY_ITEM);
    expect(mine, `AC3: the item stays disabled, with "${NO_ASSISTANT_REASON}"`).toEqual({ href: null, disabled: true, title: NO_ASSISTANT_REASON });
    expect((await brainstormItem(menu, MANAGEMENT_ITEM)).href, '"Assistant Management" stays clickable for everyone (settled with the owner, 2026-09-21)').toBe(MY_ASSISTANT);

    await openMyAssistant(page);
    await expect(page.locator('main'), 'AC3: the page, opened directly, explains rather than failing').toContainText(/no Tapestry Assistant/i);
    await expect(page.locator('.settings-group'), 'no editor for someone with no assistant').toHaveCount(0);
    await expect(page.getByRole('button', { name: CREATE }), 'AC4: no create action that the server would refuse').toHaveCount(0);
    expect(log.status, 'nothing to ask about').toEqual([]);
  });

  /* ───────── B12 — AC3: someone who may create one ───────── */
  test('B12: an Admin with no assistant reaches /assistant from the avatar menu and creates their assistant there — the page never drops back to its sign-in check, and the dashboard knows about the new assistant without a reload', async ({ page }) => {
    const log = await mock(page, { who: { pubkey: ADMIN, classification: 'admin', assistantPubkey: null }, hasProfile: false });
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    const menu = await openBrainstormMenu(page);
    const mine = await brainstormItem(menu, MY_ITEM);
    expect(mine.href, 'AC3: an Admin may create an assistant, so the item leads to the page instead of being disabled').toBe(MY_ASSISTANT);
    await menu.locator('.bs-usermenu-link', { hasText: MY_ITEM }).click();
    await expect.poll(() => pathname(page)).toBe(MY_ASSISTANT);
    await page.waitForLoadState('networkidle');

    const create = page.getByRole('button', { name: CREATE });
    await expect(create, 'AC3: the page offers to create the assistant').toBeVisible({ timeout: 20000 });
    await page.evaluate(() => {
      window.__sawSignInCheck = false;
      new MutationObserver(() => { if (/checking sign-in/i.test(document.body.innerText || '')) window.__sawSignInCheck = true; })
        .observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await create.click();
    await expect.poll(() => log.provisions, { message: 'the button creates the key (POST /api/assistant/provision-key)' }).toBe(1);
    await expect(page.getByRole('button', { name: /publish profile/i }), 'the new assistant is shown, ready to publish').toBeVisible({ timeout: 20000 });
    expect(await page.evaluate(() => window.__sawSignInCheck),
      'ADR 0004 sub-decision 7: learning about the new assistant must not put the page back through its sign-in check').toBe(false);

    // Go to the dashboard the way the app does — no reload — and see that it knows.
    await page.evaluate(() => { window.history.pushState({}, '', '/tapestry/'); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); });
    await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }),
      'ADR 0004 sub-decision 7: the dashboard learned about the new assistant without a reload — its profile is not set up, so it prompts').toBeVisible({ timeout: 10000 });
    expect(log.status.some((s) => s.customerPubkey === ADMIN && s.defaults === '0'), 'the dashboard\'s setup check asked about the Admin').toBe(true);
  });

  /* ───────── B13 — AC3/AC4: the Owner with a missing key ───────── */
  test('B13: an Owner whose Tapestry Assistant key is missing is told so, in the Owner\'s words, and is not offered a key they cannot create', async ({ page }) => {
    await mock(page, { who: { pubkey: OWNER, classification: 'owner', assistantPubkey: null } });
    await openEditorOnPage(page);
    const text = await editorText(page);
    expect(text, 'ADR 0004 sub-decision 4: the instance\'s Tapestry Assistant key is missing').toMatch(/key is missing/i);
    expect(text, 'not the Customer wording').not.toMatch(/Your Tapestry Assistant Profile/);
    await expect(page.getByRole('button', { name: CREATE }),
      'AC4: provisioning cannot restore the instance TA — a new key would go to a slot nothing reads').toHaveCount(0);
  });

  /* ───────── B14 — AC4: the generator is the Owner's ───────── */
  test('B14: only the Owner is offered the badged-avatar generator — not an Admin, whose assistant would wear the Owner\'s face, and not a Customer, whom the server refuses', async ({ page }) => {
    for (const [who, want] of [[OWNER_USER, 1], [ADMIN_USER, 0], [CUSTOMER_USER, 0]]) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await mock(page, { who });
      await openEditorOnPage(page);
      await expect(page.getByRole('button', { name: GENERATE }), `AC4 (${who.classification}): offered ${want ? 'the generator' : 'no generator'}`).toHaveCount(want);
    }
  });

  /* ───────── B15–B17 — AC4: failures say what happened ───────── */
  for (const [id, title, ownerAvatar, expectText, forbid] of [
    ['B15', 'when the instance refuses the badged-avatar request, the page says what the server said — never "you have no profile picture"',
      { status: 403, body: { success: false, error: 'Owner authentication required' } }, 'Owner authentication required', /no profile picture/i],
    ['B16', 'when the Owner\'s picture cannot be fetched, the page says why, in the server\'s words — not "you have no profile picture"',
      { status: 404, body: { success: false, error: 'The owner picture host answered 500' } }, 'The owner picture host answered 500', /no profile picture/i],
    ['B17', 'an Owner who really has no profile picture is told exactly that, and offered the branded image instead',
      { status: 404, body: { success: false, code: 'no-picture', error: 'The owner has no profile picture' } }, null, null],
  ]) {
    test(`${id}: ${title}`, async ({ page }) => {
      await mock(page, { who: OWNER_USER, ownerAvatar });
      await openEditorOnPage(page);
      await page.getByRole('button', { name: GENERATE }).click();
      await expect(page.getByRole('button', { name: FALLBACK }), 'the branded image stays on offer').toBeVisible({ timeout: 15000 });
      const text = await editorText(page);
      if (expectText) expect(text, `AC4: "any failure says what actually happened" — the server said "${expectText}"`).toContain(expectText);
      if (forbid) expect(text, 'AC4: never "you have no profile picture" for this failure').not.toMatch(forbid);
      if (!expectText) expect(text, 'the proxy\'s no-picture answer: the Owner has no picture to stamp').toMatch(/no profile picture/i);
    });
  }
});
