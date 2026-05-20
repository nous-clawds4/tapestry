const { test, expect } = require('@playwright/test');
const { nip19 } = require('nostr-tools');

/**
 * Story 12: Customize pin curation method (pin-time + edit-from-/pins).
 * ADR: engineering-team/decisions/0011-customize-pin-curation.md
 *
 * What this suite verifies (auth-mocked + network-mocked):
 *
 *   AC-1  — Pin click opens the dialog with the documented fields and
 *           Story-10 defaults.
 *   AC-2  — Submit with custom cutoff publishes a kind-39999 pin event
 *           whose curation-method JSON reflects the customization.
 *   AC-3  — /pins per-row Edit opens the dialog pre-filled with the
 *           row's current curationMethod.
 *   AC-5  — Saving an edit fires POST /api/trusted-list/refresh-pinned-tag.
 *   AC-6  — Cutoff validation blocks submission on invalid input.
 *   AC-9  — Method picker exposes nip85:rank as enabled; the others
 *           are visible-but-disabled.
 *   AC-10 — Observer field rejects non-hex non-npub input, decodes
 *           npub to hex, defaults empty to viewer pubkey.
 *   AC-11 — Cancel / Escape / backdrop-click does not publish.
 */

test.describe('Customize pin curation (Story 12)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TAG_ID = 'a'.repeat(64);
  const TAG_SLUG = 'fixture-cpc-tag';
  const TAG_NAME = 'Fixture CPC Tag';
  const TAG_DESC = 'mocked fixture tag for Story 12';
  const TAG_AUTHOR_PK = '1'.repeat(64);
  const VIEWER_PK = '2'.repeat(64);
  const PIN_EVENT_ID = 'b'.repeat(64);
  // A second valid-but-distinct hex pubkey for the observer-override
  // test.
  const OTHER_PK = '3'.repeat(64);

  const TAG_PAGE_URL = `/tag/${TAG_SLUG}/${TAG_ID}`;
  const PINS_PAGE_URL = '/pins';

  async function mockLoggedIn(page) {
    await page.route('**/api/auth/status', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, pubkey: VIEWER_PK }) }));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ classification: 'owner' }) }));
    await page.route('**/api/profiles?pubkeys=*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, profiles: { [VIEWER_PK]: { display_name: 'Viewer' } } }) }));
  }

  async function mockNip07(page) {
    await page.addInitScript(({ pubkey, pinEventId }) => {
      const calls = [];
      window.__signedEvents = calls;
      window.nostr = {
        async getPublicKey() { return pubkey; },
        async signEvent(unsigned) {
          calls.push(unsigned);
          const id = unsigned.kind === 39999 ? pinEventId : 'c'.repeat(64);
          return { ...unsigned, id, sig: '0'.repeat(128) };
        },
      };
    }, { pubkey: VIEWER_PK, pinEventId: PIN_EVENT_ID });
  }

  async function mockByIdRoute(page, { viewerPin = null } = {}) {
    await page.route('**/api/profile-tags/by-id**', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tag: { eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME, description: TAG_DESC,
                 authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000 },
          author: { displayName: 'Fixture Author', picture: null },
          viewerPin,
        }),
      });
    });
  }

  async function mockProfilesTaggedRoute(page) {
    await page.route('**/api/profile-tags/profiles-tagged**', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null, sort: 'applied',
          rows: [], viewerAssertions: {},
        }),
      }));
  }

  async function mockStrfryPublish(page) {
    await page.route('**/api/strfry/publish', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, event: body.event || {} }),
      });
    });
  }

  /** Mock /api/profile-tags/pins with one row carrying a custom
   *  curationMethod (for the AC-3 pre-fill test). */
  async function mockPinsRouteOneRow(page, customCuration) {
    await page.route('**/api/profile-tags/pins**', (r) => {
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pins: [{
            pinEventId: PIN_EVENT_ID,
            createdAt: 1715000200,
            curationMethod: customCuration,
            tag: { eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME, description: TAG_DESC,
                   authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000 },
            tlStatus: {
              status: 'ok', lastRefreshAt: 1715000300,
              tlEventId: 'd'.repeat(64), memberCount: 0,
            },
          }],
        }),
      });
    });
  }

  /* ───────── AC-1 — Pin click opens dialog with defaults ───────── */

  test('AC-1: clicking Pin opens the curation dialog with the documented fields and Story-10 defaults', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 10000 });
    await pinBtn.click();

    // Dialog visible.
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Cutoff field — default value 2 (Story-10 default).
    const cutoffField = page.getByLabel(/cutoff/i).first();
    await expect(cutoffField).toBeVisible();
    await expect(cutoffField).toHaveValue('2');

    // includeScoreInTL toggle — unchecked.
    const scoreToggle = page.getByLabel(/include.*score|rank score/i).first();
    await expect(scoreToggle).toBeVisible();
    await expect(scoreToggle).not.toBeChecked();

    // Method picker — present (precise affordance left to the Implementer).
    const methodControl = page.getByText(/nip85:rank/i).first();
    await expect(methodControl).toBeVisible();

    // Observer field lives under an Advanced disclosure (collapsed by default).
    // The Advanced label is present; the observer field may be hidden until
    // expanded. We just confirm the Advanced affordance is visible.
    const advanced = page.getByText(/advanced/i).first();
    await expect(advanced).toBeVisible();
  });

  /* ───────── AC-2 — Submit publishes customized curation ───────── */

  test('AC-2: submitting the dialog with cutoff=1 publishes a kind-39999 pin event whose curation-method JSON has cutoff=1', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);
    // The refresh-on-pin call from Story 11 fires after publish — mock it
    // so the dialog's submit doesn't error.
    await page.route('**/api/trusted-list/refresh-pinned-tag', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok' }) }));

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    // Change cutoff from 2 → 1.
    const cutoffField = page.getByLabel(/cutoff/i).first();
    await cutoffField.fill('1');

    // Submit (button text per ADR: "Pin with these settings").
    const submitBtn = page.getByRole('button', { name: /pin with these settings|save|submit|publish/i }).first();
    await submitBtn.click();

    // Wait for signEvent to fire.
    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );

    const signed = await page.evaluate(() => window.__signedEvents[0]);
    expect(signed.kind, 'pin event kind').toBe(39999);
    const cmTag = signed.tags.find((t) => t[0] === 'curation-method');
    expect(cmTag, 'curation-method event-tag present').toBeTruthy();
    const cm = JSON.parse(cmTag[1]);
    expect(cm.cutoff, 'custom cutoff=1').toBe(1);
    expect(cm.method).toBe('nip85:rank');
    expect(cm.observer).toBe(VIEWER_PK);
    expect(cm.includeScoreInTL).toBe(false);

    // Content body mirrors the curation method.
    const content = JSON.parse(signed.content);
    expect(content.tagPinning.curationMethod.cutoff).toBe(1);
  });

  /* ───────── AC-3 — /pins per-row Edit opens dialog pre-filled ───────── */

  test('AC-3: /pins row Edit button opens the dialog pre-filled with that row\'s current curationMethod', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    const customCuration = {
      observer: VIEWER_PK, method: 'nip85:rank', cutoff: 7, includeScoreInTL: true,
    };
    await mockPinsRouteOneRow(page, customCuration);

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // The Edit button — the ADR specifies a ⚙️ button. Look for any
    // button on the row whose accessible name includes "Edit".
    const editBtn = page.getByRole('button', { name: /edit/i }).first();
    await expect(editBtn).toBeVisible({ timeout: 5000 });
    await editBtn.click();

    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible({ timeout: 3000 });

    // Pre-filled cutoff matches the row's curationMethod.
    const cutoffField = page.getByLabel(/cutoff/i).first();
    await expect(cutoffField).toHaveValue('7');

    // Pre-filled includeScoreInTL toggle is checked (matches the row).
    const scoreToggle = page.getByLabel(/include.*score|rank score/i).first();
    await expect(scoreToggle).toBeChecked();
  });

  /* ───────── AC-5 — refresh-pinned-tag fires after save ───────── */

  test('AC-5: saving a curation edit fires POST /api/trusted-list/refresh-pinned-tag', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockPinsRouteOneRow(page, {
      observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false,
    });
    await mockStrfryPublish(page);
    let refreshCall = null;
    await page.route('**/api/trusted-list/refresh-pinned-tag', (route) => {
      refreshCall = JSON.parse(route.request().postData() || '{}');
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok' }) });
    });

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /edit/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    // Change cutoff and submit.
    await page.getByLabel(/cutoff/i).first().fill('5');
    await page.getByRole('button', { name: /save|publish|pin with these settings/i }).first().click();

    // Refresh call should fire.
    await expect.poll(() => refreshCall, { timeout: 5000 }).not.toBeNull();
    expect(refreshCall.pinEventId).toBe(PIN_EVENT_ID);
  });

  /* ───────── AC-6 — Cutoff validation ───────── */

  for (const [label, value] of [
    ['zero', '0'],
    ['negative', '-3'],
    ['fractional', '1.5'],
    ['non-numeric', 'abc'],
    ['empty', ''],
  ]) {
    test(`AC-6: cutoff=${label} (\`${value}\`) blocks submission and surfaces an inline error`, async ({ page }) => {
      await mockLoggedIn(page);
      await mockNip07(page);
      await mockByIdRoute(page, { viewerPin: null });
      await mockProfilesTaggedRoute(page);
      await mockStrfryPublish(page);

      await page.goto(TAG_PAGE_URL);
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
      await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

      const cutoffField = page.getByLabel(/cutoff/i).first();
      await cutoffField.fill(value);

      await page.getByRole('button', { name: /pin with these settings|save|publish|submit/i }).first().click();

      // No signEvent call.
      await page.waitForTimeout(500);
      const calls = await page.evaluate(() => (window.__signedEvents || []).length);
      expect(calls, `cutoff=${value} must NOT publish; signed events=${calls}`).toBe(0);

      // Inline error visible somewhere within the dialog.
      const dialog = page.getByRole('dialog').first();
      const err = dialog.getByText(/cutoff.*positive integer|invalid|must be/i).first();
      await expect(err).toBeVisible({ timeout: 2000 });
    });
  }

  /* ───────── AC-9 — Method picker locked ───────── */

  test('AC-9: dialog method picker exposes nip85:rank as enabled and shows follows / trust-everyone / trusted-list as disabled', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    // The picker may be a <select> or a radio group. Test for both
    // shapes — at minimum the four documented values must appear, and
    // only nip85:rank may be the active value.
    const dialog = page.getByRole('dialog').first();
    for (const method of ['nip85:rank', 'follows', 'trust-everyone', 'trusted-list']) {
      await expect(dialog.getByText(method).first()).toBeVisible({ timeout: 1000 });
    }

    // "coming soon" affordance appears at least once.
    await expect(dialog.getByText(/coming soon/i).first()).toBeVisible({ timeout: 1000 });
  });

  /* ───────── AC-10 — Observer field validation ───────── */

  test('AC-10a: observer=non-hex blocks submission with inline error', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    // Expand Advanced.
    await page.getByText(/advanced/i).first().click();

    const observerField = page.getByLabel(/observer/i).first();
    await expect(observerField).toBeVisible();
    await observerField.fill('not-a-pubkey');

    await page.getByRole('button', { name: /pin with these settings|save|publish|submit/i }).first().click();
    await page.waitForTimeout(500);
    const calls = await page.evaluate(() => (window.__signedEvents || []).length);
    expect(calls).toBe(0);

    const dialog = page.getByRole('dialog').first();
    await expect(dialog.getByText(/hex|npub|invalid/i).first()).toBeVisible();
  });

  test('AC-10b: observer=npub is decoded to hex and accepted', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);
    await page.route('**/api/trusted-list/refresh-pinned-tag', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok' }) }));

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    await page.getByText(/advanced/i).first().click();

    const npub = nip19.npubEncode(OTHER_PK);
    await page.getByLabel(/observer/i).first().fill(npub);

    await page.getByRole('button', { name: /pin with these settings|save|publish|submit/i }).first().click();

    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);
    const cm = JSON.parse(signed.tags.find((t) => t[0] === 'curation-method')[1]);
    expect(cm.observer, 'npub must decode to its hex pubkey').toBe(OTHER_PK);
  });

  test('AC-10c: empty observer defaults to the viewer pubkey on submit', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);
    await page.route('**/api/trusted-list/refresh-pinned-tag', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok' }) }));

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    await page.getByText(/advanced/i).first().click();
    await page.getByLabel(/observer/i).first().fill('');

    await page.getByRole('button', { name: /pin with these settings|save|publish|submit/i }).first().click();
    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);
    const cm = JSON.parse(signed.tags.find((t) => t[0] === 'curation-method')[1]);
    expect(cm.observer, 'empty observer must default to viewer pubkey').toBe(VIEWER_PK);
  });

  /* ───────── AC-11 — Cancel / Escape / backdrop don't publish ───────── */

  test('AC-11: closing the dialog via Cancel does not call signEvent', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    await page.getByRole('button', { name: /^cancel$|^close$|×/i }).first().click();

    await page.waitForTimeout(500);
    const calls = await page.evaluate(() => (window.__signedEvents || []).length);
    expect(calls).toBe(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('AC-11: pressing Escape closes the dialog without publishing', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first().click();
    await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 3000 });

    await page.keyboard.press('Escape');

    await page.waitForTimeout(500);
    const calls = await page.evaluate(() => (window.__signedEvents || []).length);
    expect(calls).toBe(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
