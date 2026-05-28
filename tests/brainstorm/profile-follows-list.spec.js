/**
 * Playwright UI checks for story #29: follows list on the primary profile (v1, owner POV).
 * See engineering-team/stories/29-profile-follows-list.test-plan.md and ADR 0026.
 *
 * Preconditions:
 *   - A reachable Brainstorm instance with the Implementer's changes BUILT into dist/
 *     (the UI is Vite-built: `npm run build` in ui/). Defaults to BRAINSTORM_BASE_URL
 *     or http://localhost:7778.
 *   - First Playwright run on a machine needs `npx playwright install`.
 *
 * These are intentionally FAILING pre-implementation: the /user/:pubkey/follows route,
 * the page, and the profile "Following" link do not exist yet. They use the story's
 * user-facing vocabulary as selectors (Following, Back to profile, Name, Rank,
 * Verified Followers, npub, Hops, NIP-85, Reset) rather than incidental markup.
 *
 * Customer-observer behavior (POV selector, ?observer=<customer>) is DEFERRED and not tested.
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BRAINSTORM_BASE_URL || 'http://localhost:7778';

// A profile known to follow many accounts (used across the populated-list checks).
const POPULATED_PUBKEY = '2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331';
// A pubkey that follows no one → exercises the empty state.
const EMPTY_PUBKEY = '0000000000000000000000000000000000000000000000000000000000000000';

const profileUrl = (pk) => `${BASE_URL}/user/${pk}`;
const followsUrl = (pk) => `${BASE_URL}/user/${pk}/follows`;

test.describe('Story 29 — follows list on the primary profile (v1, owner POV)', () => {
  test('AC Entry point: the "Following" count links (same tab) to /user/:pubkey/follows', async ({ page }) => {
    await page.goto(profileUrl(POPULATED_PUBKEY));

    // The Following count should be a link whose target is the follows sub-path.
    const followingLink = page.getByRole('link', { name: /following/i });
    await expect(followingLink).toBeVisible();
    await expect(followingLink).toHaveAttribute('href', /\/user\/[0-9a-f]{64}\/follows$/);
    // Must NOT open a new tab.
    await expect(followingLink).not.toHaveAttribute('target', '_blank');

    await followingLink.click();
    await expect(page).toHaveURL(new RegExp(`/user/${POPULATED_PUBKEY}/follows`));
  });

  test('AC Direct load + Return: the follows page loads directly and "Back to profile" returns to /user/:pubkey', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));

    // The page rendered (a table is present) — not a 404 / blank SPA fallback.
    await expect(page.locator('table')).toBeVisible();

    const back = page.getByRole('link', { name: /back to profile/i })
      .or(page.getByRole('button', { name: /back to profile/i }));
    await expect(back.first()).toBeVisible();
    await back.first().click();
    await expect(page).toHaveURL(new RegExp(`/user/${POPULATED_PUBKEY}$`));
  });

  test('AC Listing: a populated profile renders at least one follow row', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));
    await expect(page.locator('table tbody tr').first()).toBeVisible();
  });

  test('AC Default visibility: Name and Rank columns show by default; npub / Hops / Verified columns are hidden', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));

    await expect(page.getByRole('columnheader', { name: /^name$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^rank$/i })).toBeVisible();

    await expect(page.getByRole('columnheader', { name: /npub/i })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: /hops/i })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: /verified followers/i })).toHaveCount(0);
  });

  test('AC Toggle + Persistence: enabling a hidden column survives reload, and reset-to-defaults hides it again', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));

    // Open the column controls and enable "Hops".
    await page.getByRole('button', { name: /columns/i }).click();
    await page.getByRole('checkbox', { name: /hops/i })
      .or(page.getByLabel(/hops/i)).first().check();
    await expect(page.getByRole('columnheader', { name: /hops/i })).toBeVisible();

    // Persists across reload (localStorage).
    await page.reload();
    await expect(page.getByRole('columnheader', { name: /hops/i })).toBeVisible();

    // Reset to defaults hides it again.
    await page.getByRole('button', { name: /columns/i }).click();
    await page.getByRole('button', { name: /reset/i }).click();
    await expect(page.getByRole('columnheader', { name: /hops/i })).toHaveCount(0);
  });

  test('AC Search: typing in the in-page search filters the rows', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));
    const before = await page.locator('table tbody tr').count();

    const search = page.getByPlaceholder(/filter|search/i).first();
    await search.fill('zzzzzznomatchexpectedzzzzzz');
    const after = await page.locator('table tbody tr').count();

    expect(after).toBeLessThan(before); // a no-match query must shrink the visible set
  });

  test('AC Row navigation: clicking a row opens that account\'s /user/<pubkey> profile (same tab)', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));
    await page.locator('table tbody tr').first().click();
    await expect(page).toHaveURL(/\/user\/[0-9a-f]{64}$/);
  });

  test('AC Local-data disclosure: tapping the info affordance reveals the "not imported via NIP-85" note', async ({ page }) => {
    await page.goto(followsUrl(POPULATED_PUBKEY));

    // Tappable info affordance (works on touch — opened by click, not hover).
    const info = page.getByRole('button', { name: /info|computed locally|ⓘ|about this data/i }).first();
    await info.click();
    await expect(page.getByText(/NIP-?85/i)).toBeVisible();
    await expect(page.getByText(/comput(e|ed) locally|this Tapestry instance/i)).toBeVisible();
  });

  test('AC Listing (N=0): a profile that follows no one shows an empty-state message', async ({ page }) => {
    await page.goto(followsUrl(EMPTY_PUBKEY));
    await expect(page.getByText(/no follows|follows no one|isn'?t following anyone|nobody|0 follows/i)).toBeVisible();
  });
});
