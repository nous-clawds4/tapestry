const { test, expect } = require('@playwright/test');
const zlib = require('zlib');

/**
 * assistant-profile #3: One default profile for every assistant — browser half (B-class: what the
 * dashboard and the editor DO).
 *
 * Story: engineering-team/stories/assistant-profile/3-one-default-assistant-profile.md
 * ADR:   engineering-team/decisions/assistant-profile/0003-one-role-free-default-profile.md
 * Node half: test/one-default-assistant-profile.test.js (I/N/D/F/Q/E/W/S/R).
 *
 * Every /api route is mocked, so each test decides exactly what the server answers and asserts only
 * what the page does with it:
 *
 *   B0 — the served bundle contains the code under test.                          [prerequisite]
 *   B1 — the Owner's "Use the default profile" asks publish-profile for the one default — no
 *        content, no kind 0 built in the browser — and the prompt goes away.        [AC5, AC1]
 *   B2 — the dashboard's setup check asks for the setup state only (defaults=0).    [ADR 0003 §4]
 *   B3 — a badged avatar the instance cannot publish is never put into the picture field as a
 *        relative path; the editor says why and offers the branded image.         [AC4]
 *   B4 — "Use the branded image instead" fills the absolute URL the server offers.  [AC4 — guard]
 *   B5 — …and when the server offers none, it never falls back to a relative path.  [AC4]
 *   B6 — the editor offers exactly the seven editable fields; NIP-05 is read-only.  [AC5 — guard]
 *   B7 — on an instance that is not public, the editor says no NIP-05 is published. [AC3, AC5]
 *
 * Prerequisites: BRAINSTORM_SERVER_ACCESSIBLE=true, and BRAINSTORM_BASE_URL pointing at an origin
 * serving the BUILT ui under test. From an isolated worktree that is
 * `cd ui && npm run build && npx vite preview --port 4173 --strictPort`. A source-only edit is
 * INVISIBLE to this class; B0 guards exactly that.
 *
 * B0, B1, B2, B3, B5 and B7 FAIL against the current build: the dashboard's button is "Surprise me"
 * and signs its own kind 0 through /api/strfry/publish, the setup check asks without defaults=0, the
 * editor writes the upload's relative path and the relative /ta-avatar.png into the picture field,
 * and it shows nothing where a non-public instance's NIP-05 would be. B4 and B6 pass before and
 * after — they guard behaviour this story must keep.
 */

// Fixtures, never live keys: the runtime lookups are mocked to return them.
const TA = 'aa'.repeat(32);
const OWNER = 'bb'.repeat(32);
const CUSTOMER = 'dd'.repeat(32);
const CUSTOMER_ASSISTANT = 'd1'.repeat(32);

const OWNER_USER = { pubkey: OWNER, classification: 'owner', assistantPubkey: TA };
const CUSTOMER_USER = { pubkey: CUSTOMER, classification: 'customer', assistantPubkey: CUSTOMER_ASSISTANT };

const USE_DEFAULT = /Use the default profile/;
const PROMPT_BUTTON = /Set up my Assistant.s profile/;
const REFERENCE_AVATAR = 'https://tapestry.brainstorm.world/ta-avatar.png';
const PUBLIC_DOMAIN = 'staging.example.test';
const HOSTED_PATH = '/generated/ta-avatar-deadbeef.png';
const NIP05 = `olivia-tapestry-assistant-aaaaaa@${PUBLIC_DOMAIN}`;
const BADGE_RGB = [0x95, 0x46, 0xed];
const SOURCE_RGB = [255, 255, 255];

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

/** The table's shape for the Owner "Olivia", as the server now offers it. */
function defaultsFor({ isPublic, picture }) {
  return {
    name: "Olivia's Tapestry Assistant",
    display_name: "Olivia's Tapestry Assistant",
    about: 'I am the Tapestry Assistant for Olivia (npub1fixture). You can find my pubkey in my owner\'s kind 10040 event.',
    picture: picture !== undefined ? picture : (isPublic ? `https://${PUBLIC_DOMAIN}/ta-avatar.png` : REFERENCE_AVATAR),
    banner: '',
    website: isPublic ? `https://${PUBLIC_DOMAIN}` : '',
    nip05: '',
    lud16: '',
  };
}

/** The routes every page here needs, signed in as `who`. Catch-all FIRST: later routes win. */
async function mockCommon(page, who) {
  await page.route('**/api/**', (r) => r.fulfill(json({ success: false, error: 'not mocked by assistant-default-profile.spec.js' })));
  await page.route('**/api/neo4j/query', (r) => r.fulfill(json({ success: true, data: [] })));
  await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
  await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
  await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
  await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));
  await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));
  await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: who.pubkey })));
  await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({
    success: true, classification: who.classification, pubkey: who.pubkey, assistantPubkey: who.assistantPubkey,
  })));
}

/** The dashboard for `who`, whose assistant has no profile until something is published. */
async function mockDashboard(page, who) {
  const log = { statusUrls: [], publishBodies: [], strfryBodies: [] };
  let published = false;
  await mockCommon(page, who);
  await page.route('**/api/assistant/status**', (r) => {
    log.statusUrls.push(r.request().url());
    return r.fulfill(json({
      success: true, hasRelayKey: true, assistantPubkey: who.assistantPubkey,
      hasProfile: published, profile: published ? { name: "Olivia's Tapestry Assistant" } : null,
      profileSource: published ? 'local' : null, isPublicInstance: true, isOwner: who.pubkey === OWNER,
    }));
  });
  await page.route('**/api/assistant/publish-profile', (r) => {
    log.publishBodies.push(r.request().postDataJSON());
    published = true;
    return r.fulfill(json({
      success: true, outcome: 'published', localOnly: false, assistantPubkey: who.assistantPubkey,
      relays: { total: 1, success: 1, results: [{ relay: 'wss://nos.lol', status: 'accepted', reason: '' }] },
      message: "The Tapestry Assistant's profile was saved on this instance's relay and accepted by 1 of 1 relays.",
    }));
  });
  await page.route('**/api/strfry/publish', (r) => {
    log.strfryBodies.push(r.request().postDataJSON());
    return r.fulfill(json({ success: true }));
  });
  return log;
}

async function openDashboard(page) {
  await page.goto('/tapestry/');
  await page.locator('.dashboard').first().waitFor({ timeout: 20000 });
  await page.waitForTimeout(2000);
}

/**
 * The Owner's assistant editor. `isPublic` decides the instance; `picture` overrides the offered
 * default picture; `ownerAvatar` is 'ok' (the composite path) or 'missing' (the branded fallback);
 * `uploadUrl` is the publishable URL the upload answers with ('' when the instance is not public).
 */
async function mockEditor(page, { isPublic = true, picture, ownerAvatar = 'ok', uploadUrl = '' } = {}) {
  await mockCommon(page, OWNER_USER);
  // The Settings page around the editor loads the settings first and shows an error instead of its tab
  // if that fails.
  await page.route('**/api/settings', (r) => r.fulfill(json({ success: true, settings: {}, defaults: {}, overrides: {} })));
  await page.route('**/api/assistant/status**', (r) => r.fulfill(json({
    success: true, hasRelayKey: true, hasProfile: false, profile: null, profileSource: null,
    isOwner: true, assistantPubkey: TA, isPublicInstance: isPublic,
    computedNip05: isPublic ? { localPart: NIP05.split('@')[0], domain: PUBLIC_DOMAIN, address: NIP05 } : null,
    defaults: defaultsFor({ isPublic, picture }),
  })));
  await page.route('**/api/assistant/owner-avatar', (r) => (ownerAvatar === 'ok'
    ? r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(256, 256, SOURCE_RGB) })
    : r.fulfill(json({ success: false, error: 'The owner has no profile picture' }, 404))));
  await page.route('**/api/assistant/avatar', (r) => (r.request().method() === 'POST'
    ? r.fulfill(json({ success: true, filename: 'ta-avatar-deadbeef.png', path: HOSTED_PATH, url: uploadUrl }))
    : r.fulfill(json({ success: true }))));
  // The branded image, wherever the page asks for it (the relative preview or the reference copy),
  // so no test ever reaches a real host.
  await page.route('**/ta-avatar.png', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(64, 64, BADGE_RGB) }));
}

async function openEditor(page) {
  await page.goto('/tapestry/settings/assistant');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('.settings-group').first(), 'the Assistant Profile editor must render for a signed-in owner').toBeVisible({ timeout: 20000 });
}

const editor = (page) => page.locator('.settings-group').first();
/** Every value the editor's fields hold. */
const fieldValues = (page) => editor(page).locator('input, textarea').evaluateAll((els) => els.map((e) => e.value));
/** The editor's visible text, runs of whitespace collapsed. */
async function panelText(page) { return (await editor(page).innerText()).replace(/\s+/g, ' '); }

/** Does any JS chunk the origin serves contain `needle`? Follows chunk references one hop at a time. */
async function bundleContains(request, needle) {
  const index = await request.get('/');
  if (!index.ok()) return { found: false, why: `the app shell answered HTTP ${index.status()}` };
  const queue = [...(await index.text()).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
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

test.describe('One default profile for every assistant (assistant-profile #3)', () => {
  test.beforeEach(async () => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin runs a build that contains the code under test', async ({ request, baseURL }) => {
    const { found, why } = await bundleContains(request, 'Use the default profile');
    expect(found,
      `the bundle served by ${baseURL} does not contain "Use the default profile", the label ADR 0003 gives the dashboard's ` +
      `one-default button (${why}). Either the bundle predates your edit — run \`cd ui && npm run build\` — or it is not ` +
      'implemented, in which case B1 says so directly.').toBe(true);
  });

  /* ───────── B1 — AC5: the dashboard's path starts from the one definition ───────── */
  test('B1: the Owner\'s "Use the default profile" asks publish-profile for the one default — no content, no kind 0 of its own — and the prompt goes away', async ({ page }) => {
    const log = await mockDashboard(page, OWNER_USER);
    await openDashboard(page);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }), 'precondition: the Owner\'s assistant has no profile, so the prompt shows').toHaveCount(1);
    const button = page.getByRole('button', { name: USE_DEFAULT });
    await expect(button,
      'ADR 0003 sub-decision 6: the Owner is offered "Use the default profile" — "Surprise me" published its own name and robohash picture, ' +
      'a second definition').toHaveCount(1);
    await button.click();
    await expect.poll(() => log.publishBodies.length, { timeout: 10000, message: 'the button must POST /api/assistant/publish-profile' }).toBe(1);
    expect(log.publishBodies[0],
      'AC5: exactly { customerPubkey } and no content — so the server\'s one definition is what gets signed').toEqual({ customerPubkey: OWNER });
    expect(log.strfryBodies, 'AC5: nothing may be signed through the generic sign-as-assistant endpoint').toEqual([]);
    await expect(page.getByRole('button', { name: PROMPT_BUTTON }),
      'after the publish the setup check is asked again, and the prompt goes away').toHaveCount(0, { timeout: 10000 });
  });

  /* ───────── B2 — the setup check does not pay for the defaults ───────── */
  test('B2: the dashboard\'s setup check asks for the setup state only — every status request it makes carries defaults=0', async ({ page }) => {
    const log = await mockDashboard(page, CUSTOMER_USER);
    await openDashboard(page);
    expect(log.statusUrls.length, 'precondition: a signed-in user with an assistant is asked about').toBeGreaterThan(0);
    const params = log.statusUrls.map((u) => Object.fromEntries(new URL(u).searchParams));
    expect(params,
      'ADR 0003 sub-decision 4: the check runs on every signed-in dashboard load and never reads the defaults, so it must not make the server look up a name')
      .toEqual(params.map(() => ({ customerPubkey: CUSTOMER, defaults: '0' })));
  });

  /* ───────── B3 — AC4: a badged avatar only ever as a publishable URL ───────── */
  test('B3: when the instance cannot publish the badged avatar, "Use this avatar" never puts a relative path into the picture field — it says why and offers the branded image', async ({ page }) => {
    await mockEditor(page, { isPublic: false, ownerAvatar: 'ok', uploadUrl: '' });
    await openEditor(page);
    await page.getByRole('button', { name: /generate badged avatar/i }).click();
    await expect(page.locator('.ta-composite-preview'), 'precondition: the composite preview appears').toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: /use this avatar/i }).click();
    await page.waitForTimeout(1000);
    const values = await fieldValues(page);
    expect(values.filter((v) => v.includes('/generated/') || v.startsWith('/')),
      `AC4: "no value the app itself supplies — … a generated badged avatar — is ever a … relative URL". The upload answered no public url ` +
      `(the instance is not public), so ${HOSTED_PATH} must not reach the picture field`).toEqual([]);
    expect(await panelText(page), 'the editor says why the avatar cannot be used (ADR 0003 sub-decision 7)').toMatch(/public web address[^.]*avatar/i);
    await expect(page.getByRole('button', { name: /use the branded image instead/i }), 'and offers the branded image instead').toBeVisible();
  });

  /* ───────── B4 — AC4's branded image, as the server offers it (guard) ───────── */
  test('B4: "Use the branded image instead" puts the absolute URL the server offers into the picture field', async ({ page }) => {
    await mockEditor(page, { isPublic: false, ownerAvatar: 'missing' });
    await openEditor(page);
    await page.getByRole('button', { name: /generate badged avatar/i }).click();
    const fallback = page.getByRole('button', { name: /use the branded image instead/i });
    await expect(fallback, 'with no owner picture the branded image is offered').toBeVisible({ timeout: 15000 });
    await fallback.click();
    await expect.poll(() => fieldValues(page), { timeout: 5000, message: `the picture field must hold ${REFERENCE_AVATAR}` })
      .toContain(REFERENCE_AVATAR);
  });

  /* ───────── B5 — AC4: no relative fallback, ever ───────── */
  test('B5: when the server offers no picture, "Use the branded image instead" never falls back to the relative /ta-avatar.png', async ({ page }) => {
    await mockEditor(page, { isPublic: false, ownerAvatar: 'missing', picture: '' });
    await openEditor(page);
    await page.getByRole('button', { name: /generate badged avatar/i }).click();
    const fallback = page.getByRole('button', { name: /use the branded image instead/i });
    await expect(fallback).toBeVisible({ timeout: 15000 });
    await fallback.click();
    await page.waitForTimeout(500);
    const values = await fieldValues(page);
    expect(values.filter((v) => v.startsWith('/')),
      'AC4: the branded image the app supplies must be an absolute URL a stranger\'s client can load — "/ta-avatar.png" resolves against THEIR machine')
      .toEqual([]);
  });

  /* ───────── B6 — AC5's editable fields (guard) ───────── */
  test('B6: the editor offers exactly the seven editable fields, and shows the NIP-05 read-only', async ({ page }) => {
    await mockEditor(page, { isPublic: true });
    await openEditor(page);
    const text = await panelText(page);
    for (const label of ['Name', 'Display name', 'About', 'Picture URL', 'Banner URL', 'Website', 'Lightning address']) {
      expect(text, `AC5: the "${label}" field`).toContain(label);
    }
    await expect(editor(page).locator('input, textarea'), 'AC5: seven editable fields, no more').toHaveCount(7);
    expect(text, 'AC5: the assistant\'s NIP-05 is shown').toContain(NIP05);
    expect(await fieldValues(page), 'AC5: …read-only — no field holds it').not.toContain(NIP05);
  });

  /* ───────── B7 — AC3: no NIP-05 off a public instance, and the editor says why ───────── */
  test('B7: on an instance that is not public, the editor says no NIP-05 is published, and why', async ({ page }) => {
    await mockEditor(page, { isPublic: false });
    await openEditor(page);
    const text = await panelText(page);
    expect(text,
      'AC3/AC5: "no assistant profile it publishes carries a NIP-05" — the read-only NIP-05 line must say there is none, and why')
      .toMatch(/NIP-05: none[^.]*public web address/i);
  });
});
