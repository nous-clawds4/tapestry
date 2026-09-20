const { test, expect } = require('@playwright/test');

/**
 * shared-concepts-row-detail #1: row detail panels on the Active …-tags pages.
 * Story: engineering-team/stories/shared-concepts-row-detail/1-row-detail-panels-on-active-tag-pages.md
 * ADR:   engineering-team/decisions/shared-concepts-row-detail/0001-row-detail-panels-on-active-tag-pages.md
 *
 * Network-mocked browser round-trip. The structural half (DataTable's opt-in branches, the
 * CSS-only muted-text fix) lives in test/shared-concepts-row-detail.test.js; what is pinned HERE is
 * everything only a browser can answer.
 *
 * The community relay is a websocket and is NOT mocked — it simply fails to resolve, so the
 * "name (shared)" column reads "cannot locate event". That is deliberate: every fact these panels
 * show comes from the LOCAL scan, which is exactly the claim AC-8 makes, and letting the remote
 * lookup fail proves the panels do not depend on it.
 *
 *   E1  — b-tags: no b-tag column header; a disclosure control per row; no panel open on load.  [AC-1]
 *   E2  — b-tags: activating the control opens a panel with the LOCAL description + the b-tag;
 *                 activating again closes it.                                             [AC-2, AC-8]
 *   E3  — b-tags: opening one row's panel leaves every other row's panel closed.               [AC-2]
 *   E4  — b-tags: the copy control puts the FULL b-tag on the clipboard and acknowledges.       [AC-3]
 *   E5  — b-tags: a header with no description says so rather than rendering an empty region.   [AC-4]
 *   E6  — b-tags: filtering by a b-tag fragment still matches, though the column is gone.       [AC-5]
 *   E7  — b-tags: filtering by a description fragment matches with the panel CLOSED.            [AC-6]
 *   E8  — b-tags: clicking the row away from the control still navigates to the pair page.      [AC-7]
 *   E9  — b-tags: the reserved b-tag-deferred sentinel reaches no row and no panel.             [AC-9]
 *   E10 — z-tags: no z-tag column; panel opens with the header's description + the coordinate.  [AC-1, AC-2]
 *   E11 — z-tags: filtering by the coordinate and by the description both still match.     [AC-5, AC-6]
 *   E12 — muted text computes to the palette's muted colour, distinct from body text.          [AC-10]
 *
 * TEN of the twelve FAIL against the current build. E6 and E8 PASS today and are regression guards:
 * the b-tag is filterable now only because it is still a column, and the row click already navigates
 * — both must survive the change, which is the point of pinning them. E9 fails only because the page
 * has no panels yet; its sentinel skip already works today and is pinned in the Node suite (R2).
 *
 * Verified failing 2026-09-20 against the current build: E1 reads back the header row
 * "name (local)|b-tag|name (shared)|author (shared)"; E12 computes rgb(230, 237, 243) where the
 * palette says rgb(139, 148, 158); the rest time out waiting for a disclosure control that does not
 * exist yet.
 */

const TA = '1'.repeat(64);
const OTHER = 'a'.repeat(64);

const DESCRIBED_B = `39998:${OTHER}:cat-breed`;
const BARE_B = `39998:${OTHER}:no-description-here`;
const SENTINEL = 'b-tag-deferred';

/** A local kind-39998 DList Header authored by the TA, carrying a b tag. */
function header({ d, name, description, b }) {
  const tags = [['d', d], ['names', name]];
  if (description) tags.push(['description', description]);
  if (b) tags.push(['b', b]);
  return { id: `${d}`.padEnd(64, '0').slice(0, 64), kind: 39998, pubkey: TA, created_at: 1700000000, tags, content: '' };
}

const DESCRIBED_DESC = 'A domesticated feline lineage recognised by a registry.';

const LOCAL_HEADERS = [
  header({ d: 'cat-breed', name: 'cat breed', description: DESCRIBED_DESC, b: DESCRIBED_B }),
  header({ d: 'bare-one', name: 'bare one', b: BARE_B }),
  header({ d: 'deferred-one', name: 'deferred one', description: 'Deliberately kept private.', b: SENTINEL }),
];

/** Foreign-authored concept headers, for the z-tags page. */
const Z_COORD = `39998:${OTHER}:dog-breed`;
const Z_DESC = 'A domesticated canine lineage recognised by a registry.';
const FOREIGN_HEADER = {
  id: 'f'.repeat(64), kind: 39998, pubkey: OTHER, created_at: 1700000000, content: '',
  tags: [['d', 'dog-breed'], ['names', 'dog breed'], ['description', Z_DESC]],
};
/** A local event filing itself under the foreign header via a z tag. */
const Z_CARRIER = {
  id: 'c'.repeat(64), kind: 39999, pubkey: TA, created_at: 1700000001, content: '',
  tags: [['d', 'carrier'], ['z', Z_COORD]],
};

async function mockStack(page, { headers = LOCAL_HEADERS, zMode = false } = {}) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: TA }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/auth/status', (r) => json(r, { authenticated: false, pubkey: null }));
  await page.route('**/api/strfry/scan**', (r) => {
    const url = decodeURIComponent(r.request().url());
    if (zMode) {
      // The header enumeration, then the chunked #z scan.
      if (/"#z"/.test(url)) return json(r, { success: true, events: [Z_CARRIER] });
      return json(r, { success: true, events: [FOREIGN_HEADER] });
    }
    return json(r, { success: true, events: headers });
  });
}

const B_URL = '/tapestry/shared-concepts/b-tags';
const Z_URL = '/tapestry/shared-concepts/z-tags';

/** The row whose visible text contains `text`. */
const rowWith = (page, text) => page.locator('table.data-table tbody tr').filter({ hasText: text }).first();

/** A row's disclosure control: the toggle button inside that row. */
const discloser = (row) => row.locator('button').last();

test.describe('Active b-tags — row detail panels', () => {
  test('E1: no b-tag column, a control per row, nothing open on load', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await expect(page.locator('table.data-table')).toBeVisible();

    const headerTexts = await page.locator('table.data-table thead th').allTextContents();
    expect(headerTexts.join('|').toLowerCase(), 'AC-1: the b-tag column must be gone from the table').not.toMatch(/b-tag/);

    await expect(rowWith(page, 'cat breed')).toBeVisible();
    await expect(discloser(rowWith(page, 'cat breed')), 'AC-1: every row needs a disclosure control').toBeVisible();

    // No panel content anywhere before anything is clicked.
    await expect(page.getByText(DESCRIBED_DESC), 'AC-1: panels are closed by default').toHaveCount(0);
  });

  test('E2: the panel opens with the LOCAL description and the b-tag, and closes again', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    const row = rowWith(page, 'cat breed');

    await discloser(row).click();
    await expect(page.getByText(DESCRIBED_DESC), 'AC-2/AC-8: the local DList Header description').toBeVisible();
    await expect(page.getByText(DESCRIBED_B, { exact: false }), 'AC-2: the b-tag itself').toBeVisible();

    await discloser(row).click();
    await expect(page.getByText(DESCRIBED_DESC), 'AC-2: activating again closes the panel').toHaveCount(0);
  });

  test('E3: opening one panel leaves the others closed', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await discloser(rowWith(page, 'cat breed')).click();
    await expect(page.getByText(DESCRIBED_DESC)).toBeVisible();
    await expect(page.getByText(BARE_B, { exact: false }), "AC-2: another row's panel must stay closed").toHaveCount(0);
  });

  test('E4: the copy control puts the full b-tag on the clipboard', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only here');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await mockStack(page);
    await page.goto(B_URL);
    const row = rowWith(page, 'cat breed');
    await discloser(row).click();

    await page.locator('.bsp-copy-btn').first().click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip, 'AC-3: the FULL b-tag, not a truncated form').toBe(DESCRIBED_B);
    await expect(page.locator('.bsp-copy-btn').first(), 'AC-3: the control acknowledges the copy').toHaveText('✓');
  });

  test('E5: a header with no description says so', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await discloser(rowWith(page, 'bare one')).click();
    await expect(page.getByText(/no description/i), 'AC-4: an explicit absence, not an empty region').toBeVisible();
  });

  test('E6: filtering by a b-tag fragment still matches', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await page.locator('.table-filter').fill('cat-breed');
    await expect(rowWith(page, 'cat breed'), 'AC-5: the b-tag stays filterable though its column is gone').toBeVisible();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(1);
  });

  test('E7: filtering by a description fragment matches with the panel closed', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await page.locator('.table-filter').fill('domesticated feline');
    await expect(rowWith(page, 'cat breed'), 'AC-6: matched on text visible only inside a closed panel').toBeVisible();
    await expect(page.locator('table.data-table tbody tr')).toHaveCount(1);
  });

  test('E8: clicking the row away from the control still navigates', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await rowWith(page, 'cat breed').locator('td').first().click();
    await expect(page, 'AC-7: the existing row-click destination survives').toHaveURL(/shared-concepts\/b-tags\/.+/);
  });

  test('E9: the b-tag-deferred sentinel reaches no row and no panel', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await expect(page.locator('table.data-table tbody tr'), 'AC-9: the sentinel header contributes no row').toHaveCount(2);
    await expect(page.getByText(SENTINEL, { exact: false })).toHaveCount(0);
    for (const name of ['cat breed', 'bare one']) await discloser(rowWith(page, name)).click();
    await expect(page.getByText(SENTINEL, { exact: false }), 'AC-9: and no panel presents it as a tag value').toHaveCount(0);
  });
});

test.describe('Active z-tags — row detail panels', () => {
  test('E10: no z-tag column; the panel carries the description and the coordinate', async ({ page }) => {
    await mockStack(page, { zMode: true });
    await page.goto(Z_URL);
    await expect(page.locator('table.data-table')).toBeVisible();

    const headerTexts = await page.locator('table.data-table thead th').allTextContents();
    expect(headerTexts.join('|').toLowerCase(), 'AC-1: the z-tag column must be gone').not.toMatch(/z-tag/);

    const row = rowWith(page, 'dog breed');
    await expect(page.getByText(Z_DESC), 'AC-1: closed by default').toHaveCount(0);
    await discloser(row).click();
    await expect(page.getByText(Z_DESC), "AC-2: the concept header's description").toBeVisible();
    await expect(page.getByText(Z_COORD, { exact: false }), 'AC-2: the z-tag coordinate').toBeVisible();
  });

  test('E11: the coordinate and the description both stay filterable', async ({ page }) => {
    await mockStack(page, { zMode: true });
    await page.goto(Z_URL);
    await page.locator('.table-filter').fill('dog-breed');
    await expect(rowWith(page, 'dog breed'), 'AC-5: the coordinate stays filterable').toBeVisible();
    await page.locator('.table-filter').fill('domesticated canine');
    await expect(rowWith(page, 'dog breed'), 'AC-6: the description is filterable').toBeVisible();
  });
});

test('E12: muted text renders muted, and differs from ordinary body text', async ({ page }) => {
  await mockStack(page);
  await page.goto(B_URL);
  const probe = page.locator('.text-muted').first();
  await expect(probe).toBeVisible();

  const { muted, body } = await page.evaluate(() => {
    const el = document.querySelector('.text-muted');
    return { muted: getComputedStyle(el).color, body: getComputedStyle(document.body).color };
  });
  // --text-muted is #8b949e; --text is #e6edf3.
  expect(muted, 'AC-10: muted text must resolve to the palette muted colour').toBe('rgb(139, 148, 158)');
  expect(muted, 'AC-10: and must be visibly distinct from ordinary body text').not.toBe(body);
});
