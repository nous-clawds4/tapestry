const { test, expect } = require('@playwright/test');

/**
 * Story 11: Periodic Trusted List publication from pinned tags.
 * ADR: engineering-team/decisions/0010-tl-publication-from-pins.md
 *
 * What this suite verifies (auth-mocked + network-mocked):
 *
 *   AC-3 — /pins row has a Refresh now button that triggers refresh-pinned-tag.
 *   AC-4 — /pins has a Refresh all button that triggers refresh-pinned-tags-for-viewer.
 *   AC-6 — Settings → Scheduled Tasks has a "Pinned-tag Trusted List refresh" panel.
 *   AC-7 — /pins row for an unsupported-method pin shows the hint + a disabled
 *          Refresh now button.
 *   Refresh-on-pin (ADR amendment) — clicking Pin on the tag detail page
 *          fires a fire-and-forget POST /api/trusted-list/refresh-pinned-tag
 *          without blocking the button flip.
 *
 * Approach: mock /api/profile-tags/pins (with tlStatus enriched per ADR 0010),
 * /api/profile-tags/by-id, the auth endpoints, window.nostr, and the new
 * refresh endpoints. Mirrors the conventions of pin-a-tag.spec.js.
 */

test.describe('Pinned-tag TL publication (Story 11)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TAG_ID = 'a'.repeat(64);
  const TAG_SLUG = 'fixture-tl-tag';
  const TAG_NAME = 'Fixture TL Tag';
  const TAG_DESC = 'mocked fixture tag for Story 11';
  const TAG_AUTHOR_PK = '1'.repeat(64);
  const VIEWER_PK = '2'.repeat(64);
  const PIN_EVENT_ID = 'b'.repeat(64);
  const UNSUP_TAG_ID = 'e'.repeat(64);
  const UNSUP_PIN_ID = 'f'.repeat(64);
  const TL_EVENT_ID = 'd'.repeat(64);

  const TAG_PAGE_URL = `/tag/${TAG_SLUG}/${TAG_ID}`;
  const PINS_PAGE_URL = '/pins';
  const SETTINGS_PAGE_URL = '/settings';

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
          tag: {
            eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME, description: TAG_DESC,
            authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000,
          },
          author: { displayName: 'Fixture Author', picture: null },
          viewerPin,
        }),
      });
    });
  }

  async function mockProfilesTaggedRoute(page) {
    await page.route('**/api/profile-tags/profiles-tagged**', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, povSuffix: null, minRank: null, sort: 'applied',
          rows: [], viewerAssertions: {},
        }),
      });
    });
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

  /* ── Mock /api/profile-tags/pins with tlStatus on each row ── */

  /** Two pins: one ok, one unsupported. */
  async function mockPinsRouteMixed(page) {
    await page.route('**/api/profile-tags/pins**', (r) => {
      r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pins: [
            {
              pinEventId: PIN_EVENT_ID,
              createdAt: 1715000200,
              curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
              tag: {
                eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME, description: TAG_DESC,
                authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000,
              },
              tlStatus: {
                status: 'ok', lastRefreshAt: 1715000300,
                tlEventId: TL_EVENT_ID, memberCount: 3,
              },
            },
            {
              pinEventId: UNSUP_PIN_ID,
              createdAt: 1715000100,
              curationMethod: { observer: VIEWER_PK, method: 'trust-everyone', cutoff: 1, includeScoreInTL: false },
              tag: {
                eventId: UNSUP_TAG_ID, slug: 'unsupported-tag', name: 'Unsupported Tag',
                description: 'method != nip85:rank', authorPubkey: TAG_AUTHOR_PK, createdAt: 1714999000,
              },
              tlStatus: {
                status: 'unsupported', lastRefreshAt: null,
                tlEventId: null, memberCount: null,
              },
            },
          ],
        }),
      });
    });
  }

  /* ───────── AC-3 + AC-4: Refresh now / Refresh all on /pins ───────── */

  test('AC-3: clicking Refresh now on a /pins row fires POST /api/trusted-list/refresh-pinned-tag with the pin event id', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockPinsRouteMixed(page);

    let refreshCall = null;
    await page.route('**/api/trusted-list/refresh-pinned-tag', (route) => {
      const body = JSON.parse(route.request().postData() || '{}');
      refreshCall = body;
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok', tlEventId: TL_EVENT_ID }),
      });
    });

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // Find the "Refresh now" button on the OK row (the one whose tag is TAG_NAME).
    const okRow = page.locator('li, div').filter({ hasText: new RegExp(TAG_NAME, 'i') }).first();
    await expect(okRow).toBeVisible({ timeout: 10000 });
    const refreshBtn = okRow.getByRole('button', { name: /refresh now/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 5000 });
    await expect(refreshBtn).toBeEnabled();
    await refreshBtn.click();

    await expect.poll(() => refreshCall, { timeout: 5000 }).not.toBeNull();
    expect(refreshCall.pinEventId).toBe(PIN_EVENT_ID);
  });

  test('AC-4: clicking Refresh all on /pins fires POST /api/trusted-list/refresh-pinned-tags-for-viewer with viewerPubkey', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockPinsRouteMixed(page);

    let refreshAllUrl = null;
    await page.route('**/api/trusted-list/refresh-pinned-tags-for-viewer**', (route) => {
      refreshAllUrl = route.request().url();
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          pins: [
            { pinEventId: PIN_EVENT_ID, status: 'ok', tlEventId: TL_EVENT_ID },
            { pinEventId: UNSUP_PIN_ID, status: 'unsupported' },
          ],
        }),
      });
    });

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const refreshAllBtn = page.getByRole('button', { name: /refresh all/i }).first();
    await expect(refreshAllBtn).toBeVisible({ timeout: 10000 });
    await refreshAllBtn.click();

    await expect.poll(() => refreshAllUrl, { timeout: 5000 }).not.toBeNull();
    expect(refreshAllUrl).toContain(`viewerPubkey=${VIEWER_PK}`);
  });

  /* ───────── AC-6: Settings → Scheduled Tasks panel ───────── */

  test('AC-6: Settings page exposes a Pinned-tag Trusted List refresh scheduled-task panel', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    // Settings page has heavy background fetches; mock the relevant ones.
    await page.route('**/api/strfry/scan**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) }));
    await page.route('**/api/strfry/scan/count**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, count: 0 }) }));
    await page.route('**/api/relay/external**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) }));
    await page.route('**/api/user-prefs**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, preferences: {} }) }));
    await page.route('**/api/scheduled-tasks/status**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true, taskId: 'refreshPinnedTagTLs',
          schedule: { enabled: false, intervalHours: 24, intervalDays: 0, totalIntervalHours: 24 },
          timer: { active: false, nextRunAt: null, lastRunAt: null },
        }) }));
    await page.route('**/api/scheduled-tasks/history**', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, taskId: 'refreshPinnedTagTLs', runs: [] }) }));

    await page.goto(SETTINGS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    // The exact card title is at the Implementer's discretion within the
    // semantic envelope. Accept "Pinned-tag Trusted List refresh" or any
    // text containing "Pinned" + "Trusted List" or "Pinned-tag" + "refresh".
    const panel = page.getByText(/pinned.tag.*trusted list|pinned.tag.*refresh|pinned tag trusted list/i).first();
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-7: unsupported-method row shows hint + disabled button ───────── */

  test('AC-7: /pins row for an unsupported-method pin shows the hint text and a disabled Refresh now button', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockPinsRouteMixed(page);

    await page.goto(PINS_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const unsupRow = page.locator('li, div').filter({ hasText: /Unsupported Tag/i }).first();
    await expect(unsupRow).toBeVisible({ timeout: 10000 });

    // Hint copy — accept "unsupported curation method" or "nip85:rank only"
    // anywhere within the row.
    const hint = unsupRow.getByText(/unsupported curation method|nip85:rank only|unsupported method/i).first();
    await expect(hint).toBeVisible({ timeout: 5000 });

    // Refresh now button on this row exists but is disabled.
    const btn = unsupRow.getByRole('button', { name: /refresh now/i }).first();
    await expect(btn).toBeDisabled();
  });

  /* ───────── Refresh-on-pin (ADR amendment) ───────── */

  test('Refresh-on-pin: clicking Pin on tag detail fires fire-and-forget POST /api/trusted-list/refresh-pinned-tag and does NOT block the button flip', async ({ page }) => {
    await mockLoggedIn(page);
    await mockNip07(page);
    await mockByIdRoute(page, { viewerPin: null });
    await mockProfilesTaggedRoute(page);
    await mockStrfryPublish(page, { ok: true });

    // Intercept the refresh-pinned-tag endpoint; delay the response to
    // confirm the UI does NOT wait for it before flipping the button.
    let refreshCall = null;
    await page.route('**/api/trusted-list/refresh-pinned-tag', async (route) => {
      refreshCall = JSON.parse(route.request().postData() || '{}');
      // Sleep 3s before responding — much longer than the button flip should take.
      await new Promise((r) => setTimeout(r, 3000));
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, status: 'ok', tlEventId: TL_EVENT_ID }),
      });
    });

    // Set up by-id mock to flip viewerPin on second call, so after the user
    // pins + the existing refetchHeader path fires, the Unpin button shows.
    let byIdCalls = 0;
    await page.route('**/api/profile-tags/by-id**', (route) => {
      byIdCalls += 1;
      const viewerPin = byIdCalls === 1 ? null : {
        pinEventId: PIN_EVENT_ID, createdAt: 1715000100,
        curationMethod: { observer: VIEWER_PK, method: 'nip85:rank', cutoff: 2, includeScoreInTL: false },
      };
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          tag: {
            eventId: TAG_ID, slug: TAG_SLUG, name: TAG_NAME, description: TAG_DESC,
            authorPubkey: TAG_AUTHOR_PK, createdAt: 1715000000,
          },
          author: null, viewerPin,
        }),
      });
    });

    await page.goto(TAG_PAGE_URL);
    await page.waitForLoadState('networkidle');

    const pinBtn = page.getByRole('button', { name: /^pin$|^📌 ?pin$/i }).first();
    await expect(pinBtn).toBeVisible({ timeout: 10000 });

    const startedAt = Date.now();
    await pinBtn.click();

    // The button must flip to Unpin well before the 3-second refresh-on-pin
    // response resolves. We give it generous slack (2s) — that's still
    // far below the 3s mock response.
    await expect(page.getByRole('button', { name: /unpin/i }).first())
      .toBeVisible({ timeout: 2000 });
    const elapsed = Date.now() - startedAt;
    expect(elapsed, `button flipped after ${elapsed}ms — must be < 2500ms; cannot block on the refresh-pinned-tag response`)
      .toBeLessThan(2500);

    // The refresh call should have been made (fire-and-forget).
    await expect.poll(() => refreshCall, { timeout: 5000 }).not.toBeNull();
    expect(refreshCall.pinEventId).toBe(PIN_EVENT_ID);
  });
});
