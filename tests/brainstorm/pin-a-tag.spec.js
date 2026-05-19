const { test, expect } = require('@playwright/test');

/**
 * Story 10: Pin a tag (foundational).
 * ADR: engineering-team/decisions/0009-pin-a-tag.md
 *
 * What this suite verifies (auth-mocked + network-mocked):
 *
 *   AC-1  — Tag detail page renders Pin (unpinned) / Unpin (pinned) affordance.
 *   AC-2  — Click Pin → kind-39999 tag-pinning event with correct wire shape.
 *           Default curation-method content. Button flips to Unpin in place.
 *   AC-3  — Click Unpin → kind-5 deletion targeting the prior pin event id.
 *           Button flips to Pin in place.
 *   AC-4  — Logged-in tag detail page renders a link to /pins.
 *   AC-5  — /pins page lists one row per pinned tag with name + description +
 *           link to detail page.
 *   AC-6  — Settings page exposes a link to /pins.
 *   AC-7  — Logged-out tag detail page renders no Pin affordance, no /pins link.
 *   AC-8  — Logged-out /pins shows a sign-in empty state.
 *   AC-9  — Publish failure (pin or unpin) surfaces an inline error.
 *
 * Approach: mock `/api/profile-tags/by-id`, the new `/api/profile-tags/pins`,
 * the auth endpoints, `window.nostr`, and `/api/strfry/publish`. No live
 * data dependency. Mirrors the conventions established in
 * tests/brainstorm/tag-detail-write.spec.js.
 */

test.describe('Pin a tag (Story 10)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  // Deterministic fixture values.
  const TAG_ID = 'a'.repeat(64);
  const TAG_SLUG = 'fixture-pin-tag';
  const TAG_NAME = 'Fixture Pin Tag';
  const TAG_DESC = 'mocked fixture tag for Story 10';
  const TAG_AUTHOR_PK = '1'.repeat(64);
  const VIEWER_PK = '2'.repeat(64);
  const PIN_EVENT_ID = 'b'.repeat(64);

  const TAG_PAGE_URL = `/tag/${TAG_SLUG}/${TAG_ID}`;
  const PINS_PAGE_URL = '/pins';
  const SETTINGS_PAGE_URL = '/settings';

  /** Mock `/api/profile-tags/by-id` with a viewerPin override. */
  async function mockByIdRoute(page, { viewerPin = null } = {}) {
    await page.route('**/api/profile-tags/by-id**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tag: {
            eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME,
            description: TAG_DESC, authorPubkey: TAG_AUTHOR_PK,
            createdAt: 1715000000,
          },
          author: { displayName: 'Fixture Author', picture: null },
          viewerPin,
        }),
      });
    });
  }

  /** Mock profiles-tagged with a benign empty payload. Required so the page
   *  renders the rows section without throwing. */
  async function mockProfilesTaggedRoute(page) {
    await page.route('**/api/profile-tags/profiles-tagged**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null, sort: 'applied',
          rows: [], viewerAssertions: {},
        }),
      });
    });
  }

  /** Mock `/api/profile-tags/pins` with a list of pin rows. */
  async function mockPinsRoute(page, pins = []) {
    await page.route('**/api/profile-tags/pins**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, pins }),
      });
    });
  }

  /** Mock the auth endpoints so the SPA thinks we're logged in as VIEWER_PK. */
  async function mockLoggedIn(page) {
    await page.route('**/api/auth/status', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: true, pubkey: VIEWER_PK }),
      });
    });
    await page.route('**/api/auth/user-classification', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ classification: 'owner' }),
      });
    });
    await page.route('**/api/profiles?pubkeys=*', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, profiles: { [VIEWER_PK]: { display_name: 'Viewer' } } }),
      });
    });
  }

  async function mockLoggedOut(page) {
    await page.route('**/api/auth/status', (route) =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }),
      })
    );
  }

  /** Inject a fake window.nostr that records signEvent calls. */
  async function mockNip07(page, { signFails = false } = {}) {
    await page.addInitScript(({ pubkey, signFails, pinEventId }) => {
      const calls = [];
      window.__signedEvents = calls;
      window.nostr = {
        async getPublicKey() { return pubkey; },
        async signEvent(unsigned) {
          calls.push(unsigned);
          if (signFails) throw new Error('Sign failed (test)');
          // For kind-39999 (Pin), return a stable id so the publish-flow
          // round-trip is observable. Other kinds (5) get a different id.
          const id = unsigned.kind === 39999 ? pinEventId : 'c'.repeat(64);
          return { ...unsigned, id, sig: '0'.repeat(128) };
        },
      };
    }, { pubkey: VIEWER_PK, signFails, pinEventId: PIN_EVENT_ID });
  }

  async function mockStrfryPublish(page, { ok = true } = {}) {
    await page.route('**/api/strfry/publish', (route) => {
      if (ok) {
        const req = route.request();
        const body = JSON.parse(req.postData() || '{}');
        return route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ success: true, event: body.event || {} }),
        });
      }
      return route.fulfill({
        status: 500, contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'simulated local-strfry failure' }),
      });
    });
  }

  /* ───────── AC-7: logged-out tag-detail parity ───────── */

  test('AC-7: logged-out tag detail page renders no Pin affordance and no /pins link', async ({ page }) => {
    await mockLoggedOut(page);
    await mockByIdRoute(page); // viewerPin: null
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Header renders.
    await expect(page.getByRole('heading', { name: TAG_NAME })).toBeVisible({ timeout: 10000 });
    // No Pin / Unpin button.
    await expect(page.getByRole('button', { name: /^pin$|^unpin$|pin.*tag/i })).toHaveCount(0);
    // No link to /pins.
    await expect(page.locator('a[href="/pins"]')).toHaveCount(0);
  });

  /* ───────── AC-1: logged-in unpinned → Pin button ───────── */

  test('AC-1: tag detail page renders Pin button when viewer is unpinned', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: TAG_NAME })).toBeVisible({ timeout: 10000 });
    // A Pin affordance (button) must be visible.
    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 5000 });
  });

  /* ───────── AC-1: logged-in pinned → Unpin button ───────── */

  test('AC-1: tag detail page renders Unpin button when viewer has a pin event', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, {
      viewerPin: {
        pinEventId: PIN_EVENT_ID,
        createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
      },
    });
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Unpin affordance — accept "Unpin" or "📌 Pinned · Unpin" or any text
    // including the word "Unpin".
    const unpinBtn = page.getByRole('button', { name: /unpin/i }).first();
    await expect(unpinBtn).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-2: Pin click → kind-39999 publish with correct wire shape ───────── */

  test('AC-2: clicking Pin publishes a kind-39999 tag-pinning event with the correct wire shape', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: true });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 10000 });
    await pinBtn.click();

    // Wait for the signEvent call to record an unsigned event.
    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);

    expect(signed.kind, `Pin event kind must be 39999; got ${signed.kind}`).toBe(39999);

    const dTag = signed.tags.find((t) => t[0] === 'd');
    expect(dTag && dTag[1], `d-tag must be present`).toBeTruthy();
    expect(
      dTag[1],
      `d-tag must start with tag-pin- and include the tag slug; got ${dTag[1]}`
    ).toMatch(/^tag-pin-/);
    expect(dTag[1]).toContain(TAG_SLUG);

    const eTag = signed.tags.find((t) => t[0] === 'e');
    expect(eTag && eTag[1], `e-tag must reference the tag event id`).toBe(TAG_ID);

    const aTag = signed.tags.find((t) => t[0] === 'a');
    expect(aTag && aTag[1], `a-tag must be present`).toBeTruthy();
    expect(aTag[1]).toMatch(new RegExp(`^39999:${TAG_AUTHOR_PK}:${TAG_SLUG}$`));

    const zTag = signed.tags.find((t) => t[0] === 'z');
    expect(zTag && zTag[1], `z-tag must reference the tag-pinning ConceptHeader`).toMatch(/^39998:.*:tag-pinning$/);

    const cmTag = signed.tags.find((t) => t[0] === 'curation-method');
    expect(cmTag && cmTag[1], `curation-method event-tag must be present`).toBeTruthy();
    const cm = JSON.parse(cmTag[1]);
    expect(cm.observer, `curationMethod.observer`).toBe(VIEWER_PK);
    expect(cm.method, `curationMethod.method`).toBe('nip85:rank');
    expect(cm.cutoff, `curationMethod.cutoff`).toBe(2);
    expect(cm.includeScoreInTL, `curationMethod.includeScoreInTL`).toBe(false);

    // Content body should mirror the curation-method object.
    const content = JSON.parse(signed.content);
    expect(content.tagPinning, `content.tagPinning must be present`).toBeTruthy();
    expect(content.tagPinning.tagEventId).toBe(TAG_ID);
  });

  /* ───────── AC-3: Pin button flips in place after publish ───────── */

  test('AC-3: Pin button text/state flips between Pin and Unpin in place after publish', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: true });

    // First /api/profile-tags/by-id call returns viewerPin: null (unpinned).
    // After the click, the page refetches; the second call returns viewerPin
    // populated (pinned).
    let byIdCallCount = 0;
    await page.route('**/api/profile-tags/by-id**', (route) => {
      byIdCallCount += 1;
      const viewerPin = byIdCallCount === 1 ? null : {
        pinEventId: PIN_EVENT_ID,
        createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
      };
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tag: {
            eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME,
            description: TAG_DESC, authorPubkey: TAG_AUTHOR_PK,
            createdAt: 1715000000,
          },
          author: null, viewerPin,
        }),
      });
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 10000 });
    await pinBtn.click();

    // After publish + refetch, an Unpin affordance is visible (no full page
    // reload — `body` element identity is preserved).
    await expect(page.getByRole('button', { name: /unpin/i }).first()).toBeVisible({ timeout: 5000 });

    // Should NOT have seen a hard navigation away from the tag page.
    expect(page.url()).toContain(TAG_PAGE_URL);
  });

  /* ───────── AC-3: Unpin click → kind-5 deletion ───────── */

  test('AC-3: clicking Unpin publishes a kind-5 deletion targeting the prior pin event id', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, {
      viewerPin: {
        pinEventId: PIN_EVENT_ID,
        createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
      },
    });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: true });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const unpinBtn = page.getByRole('button', { name: /unpin/i }).first();
    await expect(unpinBtn).toBeVisible({ timeout: 10000 });
    await unpinBtn.click();

    await page.waitForFunction(
      () => Array.isArray(window.__signedEvents) && window.__signedEvents.length > 0,
      null,
      { timeout: 5000 }
    );
    const signed = await page.evaluate(() => window.__signedEvents[0]);
    expect(signed.kind, `Unpin event kind must be 5; got ${signed.kind}`).toBe(5);
    const eTag = signed.tags.find((t) => t[0] === 'e');
    expect(eTag && eTag[1], `kind-5 must include an e-tag targeting the pin event id`).toBe(PIN_EVENT_ID);
  });

  /* ───────── AC-4: link to /pins from tag page (logged-in only) ───────── */

  test('AC-4: tag detail page renders a link to /pins when viewer is NIP-07 authenticated', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const link = page.locator('a[href="/pins"]').first();
    await expect(link).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-5: /pins page lists rows ───────── */

  test('AC-5: /pins page lists one row per pinned tag with name, description, and a link to the tag detail page', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    const PINS = [
      {
        pinEventId: 'b'.repeat(64),
        createdAt: 1715000200,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
        tag: {
          eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME,
          description: TAG_DESC, authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000,
        },
      },
      {
        pinEventId: 'c'.repeat(64),
        createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
        tag: {
          eventId: 'd'.repeat(64), slug: 'another-pinned',
          name: 'Another Pinned',
          description: 'Second pinned-tag fixture',
          authorPubkey: TAG_AUTHOR_PK, createdAt: 1714999000,
        },
      },
    ];
    await mockPinsRoute(page, PINS);

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Each pinned tag name appears.
    await expect(page.getByText(TAG_NAME)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Another Pinned')).toBeVisible();
    // Each description appears.
    await expect(page.getByText(TAG_DESC)).toBeVisible();
    await expect(page.getByText('Second pinned-tag fixture')).toBeVisible();
    // Each row links to its tag detail page.
    await expect(page.locator(`a[href*="/tag/"][href*="${TAG_ID}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href*="/tag/"][href*="${'d'.repeat(64)}"]`).first()).toBeVisible();
  });

  /* ───────── AC-6: Settings link to /pins ───────── */

  test('AC-6: Settings page exposes a link to /pins', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    // Settings page makes a number of background fetches we don't care about
    // for this assertion. Let them 404 silently or return empty success.
    await page.route('**/api/strfry/scan**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) }));
    await page.route('**/api/strfry/scan/count**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, count: 0 }) }));
    await page.route('**/api/relay/external**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) }));
    await page.route('**/api/user-prefs**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, preferences: {} }) }));

    await page.goto(SETTINGS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Settings page must surface a link to /pins (either an <a href="/pins">
    // or a react-router <Link> rendering one).
    await expect(page.locator('a[href="/pins"]').first()).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-8: logged-out /pins empty state ───────── */

  test('AC-8: logged-out /pins page renders a sign-in empty state and no pin rows', async ({ page }) => {
    await mockLoggedOut(page);
    // Even when the server would return pin data, the logged-out view must
    // not request it. Serve an empty payload as defence in depth.
    await mockPinsRoute(page, []);

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Some text that signals "you need to sign in" — accept canonical phrasing
    // or any variant containing "sign in" near "pin".
    const signInPrompt = page.getByText(/sign in.*pin|pin.*sign in/i).first();
    await expect(signInPrompt).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-9: Pin publish failure → inline error ───────── */

  test('AC-9: Pin publish failure surfaces an inline error on the tag detail page', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: false });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 10000 });
    await pinBtn.click();

    // An error surface near the affordance: role="alert", a .bs-tag-pin-error,
    // or any visible text matching /failed|error/i (consistent with existing
    // bs-*-error surfaces from prior ADRs).
    const errorSurface = page.locator(
      '[role="alert"], .bs-tag-pin-error, .bs-tag-error'
    ).filter({ hasText: /./ }).first();
    await expect(errorSurface).toBeVisible({ timeout: 5000 });
  });

  /* ───────── AC-9: Unpin publish failure → inline error ───────── */

  test('AC-9: Unpin publish failure surfaces an inline error on the tag detail page', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, {
      viewerPin: {
        pinEventId: PIN_EVENT_ID,
        createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
      },
    });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: false });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const unpinBtn = page.getByRole('button', { name: /unpin/i }).first();
    await expect(unpinBtn).toBeVisible({ timeout: 10000 });
    await unpinBtn.click();

    const errorSurface = page.locator(
      '[role="alert"], .bs-tag-pin-error, .bs-tag-error'
    ).filter({ hasText: /./ }).first();
    await expect(errorSurface).toBeVisible({ timeout: 5000 });
  });
});
