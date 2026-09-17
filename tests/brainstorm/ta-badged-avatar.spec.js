const { test, expect } = require('@playwright/test');

/**
 * ta-avatar #1: In-app badged TA avatar — the browser class.
 *
 * Story: engineering-team/stories/ta-avatar/1-in-app-badged-ta-avatar.md
 * ADR:   engineering-team/decisions/ta-avatar/0001-shared-avatar-with-ta-badge-overlay.md
 * Source half: test/in-app-badged-ta-avatar.test.js (S/R).
 *
 * ── Why this file carries the acceptance criteria ────────────────────────
 * Every AC in this story is a statement about what a viewer SEES: the owner's
 * picture under a badge, a hover that names the owner, a letter where a dead URL
 * used to show a broken-image glyph. A source scan can only say a token is in a
 * file — the goal-intent-fields #3 Gate-3 kick-back ("green suite, invisible
 * feature", 2026-07-27) is the standing precedent. So the ACs are settled here.
 *
 *   B0 — the served bundle contains the code under test, and the asset ships. [prerequisite]
 *   B1 — a TA row shows the OWNER'S picture, badged; the owner's own row shows the
 *        same picture UNBADGED.                                    [AC1, both halves]
 *   B2 — the TA avatar identifies itself as the assistant OF THE OWNER, by name. [AC2]
 *   B3 — owner with no picture: a lettered placeholder, still badged.           [AC3]
 *   B4 — owner picture 404s: it does not stay broken, and the badge survives.   [AC3]
 *   B5 — a NON-TA author with a dead picture URL falls to a letter.             [AC4]
 *   B6 — the TA's own user page header carries the same badged avatar.          [AC5]
 *
 * ── Hermetic by construction ─────────────────────────────────────────────
 * Every endpoint these pages touch is route-mocked, including the two avatar
 * images themselves (one fulfilled as a real PNG, one as a 404). Nothing depends
 * on what the local graph happens to contain — which matters, because on this
 * machine the owner's kind-0 carries no picture and the TA has no kind-0 at all,
 * so the photo tier is unobservable against live data.
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true      (the tests/brainstorm/ gate)
 *   BRAINSTORM_BASE_URL → an origin serving the BUILT UI under test. Either the
 *   local control panel (when it serves the checkout under test), or, from an
 *   isolated worktree, `cd ui && npm run build && npm run preview -- --port 4173`.
 *   A source-only edit is INVISIBLE to this class. B0 guards exactly that.
 *
 * These FAIL against the current build: no Avatar component, no badge, no letter
 * tier, and no onError failover anywhere in AuthorCell.
 */

const TAPESTRY_KIND = 39999;

// Deliberately not the live pubkeys: these are fixtures, and the runtime lookup
// (/api/assistant/pubkey, /api/owner/pubkey) is mocked to return them. A build
// that hardcodes a real TA pubkey fails B1 rather than passing by coincidence.
const TA = 'aa'.repeat(32);
const OWNER = 'bb'.repeat(32);
const STRANGER = 'cc'.repeat(32);

const OWNER_NAME = 'Thelonious Greenhouse';
const GOOD_PIC = '/__fixture__/owner-avatar.png';
const DEAD_PIC = '/__fixture__/missing-avatar.png';

// A real 1×1 PNG, so a "loaded" image genuinely decodes.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const ROWS = [
  { d: 'owner-authored', title: 'Kitchen Garden', author: OWNER },
  { d: 'ta-authored', title: 'Signed By The Assistant', author: TA },
  { d: 'stranger-authored', title: 'Someone Elses Weaving', author: STRANGER },
];

function tapestryEvent({ d, title, author }) {
  return {
    id: `${d}-id`,
    pubkey: author,
    kind: TAPESTRY_KIND,
    created_at: 1750000000,
    tags: [
      ['d', d],
      ['json', JSON.stringify({ tapestry: { title, description: 'fixture' } })],
    ],
    content: '',
  };
}

test.describe('In-app badged TA avatar (ta-avatar #1)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /**
   * Install every route these pages touch. `ownerPicture` is the knob the AC3
   * variants turn; `strangerPicture` is AC4's.
   */
  async function mock(page, { ownerPicture = GOOD_PIC, strangerPicture = DEAD_PIC } = {}) {
    const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

    // The two fixture images: one that really decodes, one that really 404s.
    await page.route(`**${GOOD_PIC}`, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG_1x1 }));
    await page.route(`**${DEAD_PIC}`, (r) => r.fulfill({ status: 404, contentType: 'text/plain', body: 'gone' }));

    // ConfigContext plumbing — including the runtime TA/owner lookups the badge keys on.
    await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
    await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
    await page.route('**/api/status', (r) => r.fulfill(json({ success: true })));
    await page.route('**/api/owner-info', (r) => r.fulfill(json({ success: true, ownerPubkey: OWNER, domainName: 'localhost' })));

    // AuthContext — anonymous is fine for these read surfaces.
    await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: false })));
    await page.route('**/api/auth/user-classification', (r) => r.fulfill(json({ classification: 'public' })));

    // The kind-0 store. Serves whichever subset of pubkeys is asked for, so the
    // page's row authors and ConfigContext's owner lookup both resolve correctly.
    const store = {
      [OWNER]: { name: 'brainstorm', display_name: OWNER_NAME, ...(ownerPicture ? { picture: ownerPicture } : {}) },
      [STRANGER]: { name: 'stranger', display_name: 'Wilhelmina Stranger', ...(strangerPicture ? { picture: strangerPicture } : {}) },
      [TA]: null, // the TA has published no kind-0 — the common case on a fresh instance
    };
    await page.route('**/api/profiles**', (r) => {
      const asked = (new URL(r.request().url()).searchParams.get('pubkeys') || '').split(',').filter(Boolean);
      const profiles = {};
      for (const pk of asked) profiles[pk] = Object.prototype.hasOwnProperty.call(store, pk) ? store[pk] : null;
      return r.fulfill(json({ success: true, profiles }));
    });

    // The tapestries directory reads its rows from one strfry scan.
    await page.route('**/api/strfry/scan**', (r) => r.fulfill(json({ success: true, events: ROWS.map(tapestryEvent) })));

    // Anything else the user page reaches for: answer emptily rather than hang.
    await page.route('**/api/neo4j/**', (r) => r.fulfill(json({ success: true, data: [], records: [] })));
    await page.route('**/api/relay/**', (r) => r.fulfill(json({ success: true, events: [] })));
  }

  /** The one table row carrying `title`, asserted unique before use. */
  async function row(page, title) {
    const rows = page.locator('table.data-table tbody tr', { hasText: title });
    await expect(rows, `exactly one row must carry the title "${title}"`).toHaveCount(1, { timeout: 20000 });
    return rows.first();
  }

  /** The avatar of the author cell inside `scope`. */
  function avatar(scope) {
    return scope.locator('.avatar-wrap').first();
  }

  async function gotoTapestries(page) {
    await page.goto('/tapestry/tapestries');
    await page.waitForLoadState('networkidle');
  }

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served origin is running a build that contains the badge, and serves the badge asset', async ({ page, request, baseURL }) => {
    const index = await request.get('/');
    expect(index.ok(), `${baseURL} did not serve an app shell (HTTP ${index.status()}).`).toBe(true);
    const html = await index.text();

    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
    expect(assets.length,
      `no built js/css assets referenced from the app shell at ${baseURL} — is this a built UI? ` +
      'Run `cd ui && npm run build`.').toBeGreaterThan(0);

    let found = false;
    for (const a of assets) {
      const res = await request.get(a);
      if (res.ok() && (await res.text()).includes('avatar-ta-badge')) { found = true; break; }
    }
    expect(found,
      'the served bundle does not contain "avatar-ta-badge", the class ADR 0001 names for the overlay. Either the ' +
      'bundle predates your edit — a source-only change is INVISIBLE to this class, so run `cd ui && npm run ' +
      'build` — or the badge is not implemented, in which case B1-B6 say so directly.').toBe(true);

    // Status alone proves nothing here: both the control panel and `vite preview`
    // are SPA servers that answer an unknown path with index.html and a 200. The
    // BODY is the only honest test of whether the asset actually shipped.
    const svg = await request.get('/ta-badge.svg');
    const svgBody = svg.ok() ? await svg.text() : '';
    expect(svgBody.includes('<svg'),
      `/ta-badge.svg did not serve an SVG document (HTTP ${svg.status()}; body began ` +
      `${JSON.stringify(svgBody.slice(0, 60))}). Assets in ui/public/ are copied into dist/ by vite build and ` +
      'served at the site root — a missing one comes back as the SPA fallback page, and every badge on every ' +
      'surface renders as a broken image.').toBe(true);
  });

  /* ───────── B1 — the whole point of the story ───────── */
  test('B1: the assistant\'s row shows the OWNER\'S picture wearing the badge, and the owner\'s own row shows the same picture without one', async ({ page }) => {
    await mock(page);
    await gotoTapestries(page);

    const taAvatar = avatar(await row(page, 'Signed By The Assistant'));
    const ownerAvatar = avatar(await row(page, 'Kitchen Garden'));

    await expect(taAvatar, 'the assistant row must render an avatar at all').toBeVisible({ timeout: 20000 });

    // AC1, first half: the picture under the badge is the OWNER'S.
    const taImg = taAvatar.locator('.avatar-img');
    await expect(taImg,
      'AC1: the assistant\'s avatar must be an image — the owner\'s picture. Nothing rendered, so either the TA ' +
      'was not recognised (it is compared against useConfig().taPubkey) or the owner\'s profile never reached the ' +
      'component (ADR sub-decision A1: ConfigContext.ownerProfile).').toHaveCount(1);
    await expect(taImg, 'AC1: the assistant shows the OWNER\'S picture — that is what says whose assistant it is.')
      .toHaveAttribute('src', GOOD_PIC);
    await expect(taImg, 'the fixture picture must actually decode, or later tiers cannot be told apart from this one')
      .toHaveJSProperty('naturalWidth', 1);

    // AC1, the badge itself.
    await expect(taAvatar.locator('.avatar-ta-badge'),
      'AC1: the assistant\'s avatar must carry the brand-mark badge. Without it the row is indistinguishable ' +
      'from the owner posting under their own key.').toHaveCount(1);
    await expect(taAvatar.locator('.avatar-ta-badge'), 'the badge must be visible, not merely present in the DOM')
      .toBeVisible();

    // AC1, second half: "visibly distinct from the owner's own unbadged avatar."
    // Same picture, so the badge is provably the only difference.
    await expect(ownerAvatar.locator('.avatar-img'), 'the owner\'s own row must render their picture')
      .toHaveAttribute('src', GOOD_PIC);
    await expect(ownerAvatar.locator('.avatar-ta-badge'),
      'AC1: the owner posting under their OWN key must NOT be badged — otherwise the badge means nothing. The two ' +
      'rows in this fixture carry the identical picture, so the badge is the only thing that can tell them apart.')
      .toHaveCount(0);

    // And the badge must be big enough to see: the ADR sets a floor because a
    // percentage-sized mark stops being legible on a small avatar.
    const box = await taAvatar.locator('.avatar-ta-badge').boundingBox();
    expect(box, 'the badge must have a layout box').not.toBeNull();
    expect(box.width,
      `the badge rendered ${Math.round(box.width)}px wide; ADR 0001 sets a 14px floor so the mark stays legible.`)
      .toBeGreaterThanOrEqual(14);
  });

  /* ───────── B2 — who is this the assistant of? ───────── */
  test('B2: the badged avatar identifies itself as the Tapestry Assistant of the owner, by the owner\'s name', async ({ page }) => {
    await mock(page);
    await gotoTapestries(page);

    const taAvatar = avatar(await row(page, 'Signed By The Assistant'));
    const title = (await taAvatar.getAttribute('title')) || '';
    const aria = (await taAvatar.getAttribute('aria-label')) || '';
    const label = `${title} ${aria}`;

    expect(label,
      `AC2: the avatar must identify itself as the Tapestry Assistant on hover and to assistive technology. ` +
      `Read title="${title}" aria-label="${aria}".`).toMatch(/Tapestry Assistant/i);
    expect(label,
      `AC2: "using the owner's display name when one is known" — the owner's kind-0 in this fixture is ` +
      `"${OWNER_NAME}", so a label that names no owner does not satisfy it. Read title="${title}" aria-label="${aria}".`)
      .toContain(OWNER_NAME);

    // ADR-mandated, alongside the badge: an assistant with no kind-0 of its own —
    // the state of every fresh instance, and of this fixture — currently renders
    // as a bare short pubkey ("aaaaaaaa…"), which names nothing to a viewer.
    const rowText = (await (await row(page, 'Signed By The Assistant')).textContent()) || '';
    expect(rowText,
      'ADR 0001 §Implementation notes: when the TA has published no profile, AuthorCell shows "Tapestry ' +
      `Assistant" rather than a truncated pubkey. Row read: "${rowText.replace(/\s+/g, ' ').trim()}"`)
      .toMatch(/Tapestry Assistant/i);
  });

  /* ───────── B3 — AC3: the owner has no picture at all ───────── */
  test('B3: when the owner has no picture the assistant still shows a lettered placeholder wearing the badge, never an empty disc', async ({ page }) => {
    await mock(page, { ownerPicture: null });
    await gotoTapestries(page);

    const taAvatar = avatar(await row(page, 'Signed By The Assistant'));
    await expect(taAvatar, 'the assistant row must still render an avatar').toBeVisible({ timeout: 20000 });

    const letter = taAvatar.locator('.avatar-initial');
    await expect(letter,
      'AC3: with no owner picture the avatar falls to the lettered tier. The empty grey disc it replaces ' +
      '(.author-avatar-placeholder) is exactly what this criterion forbids.').toHaveCount(1);
    const text = ((await letter.textContent()) || '').trim();
    expect(text.length,
      `AC3: the placeholder must actually carry a letter — an empty disc is the old behavior. Read "${text}".`)
      .toBeGreaterThan(0);
    expect(text,
      `AC3: the letter should come from the owner, so the avatar still says WHOSE assistant this is. ` +
      `Owner display name "${OWNER_NAME}". Read "${text}".`).toBe(OWNER_NAME[0].toUpperCase());

    await expect(taAvatar.locator('.avatar-ta-badge'),
      'AC3: "a branded placeholder still carries the badge" — the badge is not conditional on there being a photo.')
      .toHaveCount(1);
  });

  /* ───────── B4 — AC3: the owner's picture exists but 404s ───────── */
  test('B4: when the owner\'s picture fails to load the assistant does not stay broken, and keeps its badge', async ({ page }) => {
    await mock(page, { ownerPicture: DEAD_PIC });
    await gotoTapestries(page);

    const taAvatar = avatar(await row(page, 'Signed By The Assistant'));
    await expect(taAvatar, 'the assistant row must still render an avatar').toBeVisible({ timeout: 20000 });

    // The failing image must be gone from the DOM, not merely hidden behind a
    // browser glyph. AuthorCell has never had an onError handler; this is the gap.
    await expect(taAvatar.locator(`.avatar-img[src="${DEAD_PIC}"]`),
      'AC3: a picture URL that 404s must not be left rendered — that is the broken-image glyph the story names. ' +
      'The candidate chain must fail over (ADR: track failures by URL, and advance).').toHaveCount(0, { timeout: 15000 });

    await expect(taAvatar.locator('.avatar-initial'),
      'AC3: with no usable picture anywhere in the chain the avatar shows the lettered placeholder.')
      .toHaveCount(1, { timeout: 15000 });
    await expect(taAvatar.locator('.avatar-ta-badge'),
      'AC3: the badge survives a failed picture load — it is not attached to the image.').toHaveCount(1);
  });

  /* ───────── B5 — AC4: the bug this story also fixes, for everyone ───────── */
  test('B5: a non-assistant author whose picture URL is dead shows a letter instead of a broken image, and is not badged', async ({ page }) => {
    await mock(page);
    await gotoTapestries(page);

    const strangerAvatar = avatar(await row(page, 'Someone Elses Weaving'));
    await expect(strangerAvatar, 'the stranger\'s row must render an avatar').toBeVisible({ timeout: 20000 });

    await expect(strangerAvatar.locator(`.avatar-img[src="${DEAD_PIC}"]`),
      'AC4: this is the pre-existing bug — AuthorCell renders picture URLs with no onError handler, so a dead one ' +
      'shows the browser\'s broken-image glyph. It must fail over like any other.').toHaveCount(0, { timeout: 15000 });

    const letter = strangerAvatar.locator('.avatar-initial');
    await expect(letter, 'AC4: "a lettered placeholder (from their display name) appears"').toHaveCount(1, { timeout: 15000 });
    expect(((await letter.textContent()) || '').trim(),
      'AC4: the letter comes from the author\'s own display name — "Wilhelmina Stranger".').toBe('W');

    await expect(strangerAvatar.locator('.avatar-ta-badge'),
      'only the assistant is badged — a fallback must not turn an ordinary author into one.').toHaveCount(0);
  });

  /* ───────── B6 — AC5: the click-through destination ───────── */
  test('B6: the assistant\'s own user page carries the same badged avatar in its header', async ({ page }) => {
    await mock(page);
    await page.goto(`/tapestry/users/${TA}`);
    await page.waitForLoadState('networkidle');

    const header = page.locator('.user-detail-header .avatar-wrap').first();
    await expect(header,
      'AC5: /tapestry/users/<taPubkey> is where every AuthorCell click lands, so it must render the same ' +
      'component rather than its own avatar markup.').toBeVisible({ timeout: 20000 });

    await expect(header.locator('.avatar-img'), 'AC5: the header shows the owner\'s picture, as the rows do')
      .toHaveAttribute('src', GOOD_PIC);
    await expect(header.locator('.avatar-ta-badge'), 'AC5: badged here too').toHaveCount(1);

    const box = await header.locator('.avatar-wrap, .avatar-img').first().boundingBox();
    expect(box, 'the header avatar must have a layout box').not.toBeNull();
    expect(box.width,
      `the header avatar rendered ${Math.round(box.width)}px wide; the page's header size is 64px ` +
      '(styles.css .user-detail-avatar), and the ADR renders Avatar at that size.').toBeGreaterThanOrEqual(48);
  });
});
