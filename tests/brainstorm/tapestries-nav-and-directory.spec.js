const { test, expect } = require('@playwright/test');

/**
 * tapestries #1: Tapestries nav group + View Tapestries directory + Create stub.
 * ADR: engineering-team/decisions/tapestries/0001-nav-directory-and-strfry-element-read.md
 *
 * What this suite verifies (network-mocked; runs against the live SPA at
 * baseURL with only the tapestry-relevant endpoints stubbed):
 *
 *   AC-1 — A "Tapestries" nav group appears directly under "Nostr Users",
 *          expands to "View Tapestries" + "Create New Tapestry", and is
 *          visible to a logged-out (guest) viewer (not owner-gated).
 *   AC-2 — View Tapestries lists every tapestry element, read from strfry via
 *          queryRelay (filter kinds:[39999], #z=[39998:<TA>:tapestry]), showing
 *          title / description / author.
 *   AC-3 — Clicking a directory row navigates to /tapestry/tapestries/<uuid>
 *          where uuid = 39999:<pubkey>:<d-tag>.
 *   AC-4 — With no tapestry elements, the directory shows an empty state
 *          (not an error, not a blank page).
 *   AC-5 — Create New Tapestry is an inert placeholder previewing the planned
 *          fields (title / description / member concepts) with no working submit.
 *   Edge — A tapestry event missing its json tag is handled gracefully (title
 *          falls back to the d-tag; the page still renders, no crash).
 *
 * These tests fail against the current build because the Tapestries nav group,
 * routes, and pages do not exist yet. The Implementer makes them pass.
 */

test.describe('Tapestries nav + directory (tapestries #1)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  const TA_PK = 'e00ed09087b831ecf40442c82768b2114b707008916ac801dabbfbe76ae9df36';
  const AUTHOR_NAME = 'Tapestry Assistant';
  const DTAG = 'tapestry-for-dog-ca3b675e';
  const UUID = `39999:${TA_PK}:${DTAG}`;
  const TITLE = 'Tapestry for Dog';
  const DESCRIPTION = 'The tapestry for dog. It groups dog and dog breed with two breeds.';
  const TAPESTRY_CONCEPT = `39998:${TA_PK}:tapestry`;

  /** Build a kind-39999 tapestry element nostr event as strfry would return it. */
  function tapestryEvent({ dTag = DTAG, title = TITLE, description = DESCRIPTION, withJson = true } = {}) {
    const tags = [
      ['d', dTag],
      ['name', dTag],
      ['z', TAPESTRY_CONCEPT],
    ];
    if (withJson) {
      tags.push(['json', JSON.stringify({
        tapestry: { slug: dTag, title, description },
        graph: { graphType: 'tapestry', nodes: [], relationshipTypes: [], relationships: [], imports: [] },
      })]);
    }
    return {
      id: 'f'.repeat(64),
      pubkey: TA_PK,
      kind: 39999,
      created_at: 1784821324,
      tags,
      content: '',
      sig: '0'.repeat(128),
    };
  }

  /**
   * Stub the strfry scan endpoint the directory reads through (queryRelay →
   * GET /api/strfry/scan?filter=<encoded>). Captures the decoded filter so a
   * test can assert the data-source contract. Returns a getter for it.
   */
  function mockScan(page, events) {
    const state = { filter: null };
    // eslint-disable-next-line no-empty-pattern
    page.route('**/api/strfry/scan**', (route) => {
      try {
        const url = new URL(route.request().url());
        state.filter = JSON.parse(url.searchParams.get('filter') || 'null');
      } catch { /* leave filter null */ }
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, events }),
      });
    });
    return state;
  }

  /** Guest viewer + deterministic TA pubkey + author profile. */
  async function mockGuest(page) {
    await page.route('**/api/auth/status', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ authenticated: false }) }));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ classification: 'unauthenticated', pubkey: null }) }));
    await page.route('**/api/assistant/pubkey', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, pubkey: TA_PK }) }));
    await page.route('**/api/profiles?pubkeys=*', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, profiles: { [TA_PK]: { display_name: AUTHOR_NAME } } }) }));
  }

  /* ───────── AC-1 — nav group under Nostr Users, guest-visible ───────── */

  test('AC-1: a guest sees a "Tapestries" nav group under Nostr Users that expands to View + Create', async ({ page }) => {
    await mockGuest(page);
    await page.goto('/tapestry/');
    await page.waitForLoadState('networkidle');

    const nav = page.locator('.nav-list');
    await expect(nav).toBeVisible({ timeout: 10000 });

    // The group toggle is a <button>; the sublinks are <a>. Both present for a guest.
    const tapestriesToggle = page.getByRole('button', { name: /Tapestries/i });
    await expect(tapestriesToggle, 'Tapestries nav group is visible to a logged-out viewer').toBeVisible();

    // Positioned directly under "Nostr Users" (assert DOM order, before expanding).
    const navText = await nav.innerText();
    expect(
      navText.indexOf('Nostr Users'),
      '"Nostr Users" appears in the nav',
    ).toBeGreaterThanOrEqual(0);
    expect(
      navText.indexOf('Nostr Users') < navText.indexOf('Tapestries'),
      '"Tapestries" appears after "Nostr Users"',
    ).toBe(true);

    // Expand and see both sublinks.
    await tapestriesToggle.click();
    await expect(page.getByRole('link', { name: /View Tapestries/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Create New Tapestry/i })).toBeVisible();
  });

  /* ───────── AC-2 — directory reads strfry + shows title/description/author ───────── */

  test('AC-2: View Tapestries reads strfry (kinds 39999, #z tapestry) and lists title/description/author', async ({ page }) => {
    await mockGuest(page);
    const scan = mockScan(page, [tapestryEvent()]);

    await page.goto('/tapestry/tapestries');
    await page.waitForLoadState('networkidle');

    // Title + description render.
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/groups dog and dog breed/i).first()).toBeVisible();
    // Author column shows the resolved author (display name from the profile stub).
    await expect(page.getByText(AUTHOR_NAME).first()).toBeVisible();

    // Data-source contract: the read went to strfry with the right filter.
    expect(scan.filter, 'the directory queried strfry').not.toBeNull();
    expect(scan.filter.kinds, 'filter targets kind 39999').toContain(39999);
    const zFilter = scan.filter['#z'] || [];
    expect(
      zFilter.some((h) => /^39998:.*:tapestry$/.test(h)),
      'filter #z targets the tapestry concept handle',
    ).toBe(true);
  });

  /* ───────── AC-3 — row click navigates to /tapestry/tapestries/:uuid ───────── */

  test('AC-3: clicking a tapestry row navigates to /tapestry/tapestries/<uuid>', async ({ page }) => {
    await mockGuest(page);
    mockScan(page, [tapestryEvent()]);

    await page.goto('/tapestry/tapestries');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 10000 });

    await page.getByText(TITLE).first().click();

    // uuid (39999:<pk>:<d-tag>) is URL-encoded in the path; the d-tag survives verbatim.
    await expect(page).toHaveURL(new RegExp(`/tapestry/tapestries/.*${DTAG}`));
  });

  /* ───────── AC-4 — empty state ───────── */

  test('AC-4: View Tapestries shows an empty state when there are no tapestries', async ({ page }) => {
    await mockGuest(page);
    mockScan(page, []); // no tapestry elements

    await page.goto('/tapestry/tapestries');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/no tapestries/i).first()).toBeVisible({ timeout: 10000 });
  });

  /* ───────── AC-5 — Create New Tapestry inert placeholder ───────── */

  test('AC-5: Create New Tapestry is an inert placeholder previewing the planned fields', async ({ page }) => {
    await mockGuest(page);

    await page.goto('/tapestry/tapestries/new');
    await page.waitForLoadState('networkidle');

    // Heading + a coming-soon / placeholder cue.
    await expect(page.getByText(/create new tapestry/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/coming soon|not yet|placeholder|future/i).first()).toBeVisible();

    // Previews the planned fields.
    await expect(page.getByText(/title/i).first()).toBeVisible();
    await expect(page.getByText(/description/i).first()).toBeVisible();
    await expect(page.getByText(/member concepts|concepts/i).first()).toBeVisible();

    // No working submit: any create/save/submit control must be disabled (if present at all).
    const submit = page.getByRole('button', { name: /create|save|submit|publish/i });
    const count = await submit.count();
    if (count > 0) {
      await expect(submit.first(), 'submit control is inert in the placeholder').toBeDisabled();
    }
  });

  /* ───────── Edge — malformed element handled gracefully ───────── */

  test('Edge: a tapestry event missing its json tag renders with a d-tag fallback title (no crash)', async ({ page }) => {
    await mockGuest(page);
    mockScan(page, [
      tapestryEvent(), // valid
      tapestryEvent({ dTag: 'tapestry-broken-00000000', withJson: false }), // no json tag
    ]);

    await page.goto('/tapestry/tapestries');
    await page.waitForLoadState('networkidle');

    // The valid one still renders …
    await expect(page.getByText(TITLE).first()).toBeVisible({ timeout: 10000 });
    // … and the malformed one degrades to showing its d-tag rather than crashing the page.
    await expect(page.getByText(/tapestry-broken-00000000/).first()).toBeVisible();
  });
});
