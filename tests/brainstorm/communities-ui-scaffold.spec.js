/**
 * Playwright UI checks for story #6: Brainstorm Communities UI scaffold (Slice 0).
 *
 * Targets the new ui-communities/ Vite app. Defaults to the local Vite dev server at
 * COMMUNITIES_BASE_URL=http://localhost:5174, but can be pointed at the deployed
 * communities.brainstorm.world post-deploy for staging smoke.
 *
 * Preconditions:
 *   - For local runs: `cd ui-communities && npm run dev` running on :5174
 *   - For staging runs: deploy-communities.yml has shipped successfully
 *
 * See engineering-team/stories/6-communities-ui-scaffold.test-plan.md
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.COMMUNITIES_BASE_URL || 'http://localhost:5174';

test.use({ baseURL: BASE_URL });

/* ────────────────────────────────────────────────────────────
 * Discover (AC-5)
 * ──────────────────────────────────────────────────────────── */

test('Discover renders hero, search, tag pills, and a grid of community cards', async ({ page }) => {
  await page.goto('/');
  // Hero heading is brand display copy
  await expect(page.getByRole('heading', { name: /find your people/i })).toBeVisible();
  // Search input
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
  // "All" filter pill plus at least one topic
  await expect(page.getByRole('button', { name: /^All$/ })).toBeVisible();
  // At least 3 community cards rendered from mock data
  const cards = page.locator('[data-testid="community-card"]');
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
});

test('typing in the search input narrows the visible cards by name match', async ({ page }) => {
  await page.goto('/');
  const cardsBefore = await page.locator('[data-testid="community-card"]').count();
  await page.getByPlaceholder(/search/i).fill('listening');
  // At least one and at most one card matches "listening" in the mock dataset
  const cardsAfter = page.locator('[data-testid="community-card"]');
  await expect(cardsAfter).toHaveCount(1);
  await expect(cardsAfter.first()).toContainText(/listening room/i);
  expect(cardsBefore).toBeGreaterThan(1);
});

/* ────────────────────────────────────────────────────────────
 * Community detail (AC-6)
 * ──────────────────────────────────────────────────────────── */

test('community detail shows banner, header, People/Conversation/About tabs', async ({ page }) => {
  await page.goto('/community/listening-room');
  await expect(page.getByRole('heading', { name: /listening room/i })).toBeVisible();
  // Three tabs
  await expect(page.getByRole('button', { name: /^People/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Conversation$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /how this works/i })).toBeVisible();
  // "Trusted here" stat (not "Independent hosts" or "mirrors")
  await expect(page.getByText(/trusted here/i)).toBeVisible();
  await expect(page.getByText(/independent hosts|mirrors/i)).toHaveCount(0);
});

test('joined circle surface shows Your view + Leave actions (no Join CTA)', async ({ page }) => {
  // listening-room is in the mock joinedSet
  await page.goto('/community/listening-room');
  await expect(page.getByText(/you belong here/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /your view/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /leave/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^join this circle/i })).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────
 * My Circles (AC-7)
 * ──────────────────────────────────────────────────────────── */

test('MyCircles shows the joined set as a card grid plus a Start a circle CTA', async ({ page }) => {
  await page.goto('/my-circles');
  await expect(page.getByRole('heading', { name: /your circles/i })).toBeVisible();
  const startCta = page.getByRole('button', { name: /start a circle/i });
  await expect(startCta).toBeVisible();
  await startCta.click();
  await expect(page).toHaveURL(/\/create$/);
});

/* ────────────────────────────────────────────────────────────
 * Create wizard (AC-8)
 * ──────────────────────────────────────────────────────────── */

test('Create wizard surfaces five labelled steps and disables Continue on incomplete steps', async ({ page }) => {
  await page.goto('/create');
  // All five step labels visible in the progress bar
  for (const label of ['Name', 'Similar circles', 'Topics', 'Founding voices', 'Review']) {
    await expect(page.getByText(label, { exact: false })).toBeVisible();
  }
  // Continue is disabled with an empty name
  const cont = page.getByRole('button', { name: /^continue/i });
  await expect(cont).toBeDisabled();
  // Type a name; Continue enables
  await page.getByPlaceholder(/sunset hikers|circle called|e\.g\./i).first().fill('Mesh Pioneers Local');
  await expect(cont).toBeEnabled();
});

/* ────────────────────────────────────────────────────────────
 * Edit / "Your view" framing (AC-9)
 * ──────────────────────────────────────────────────────────── */

test('Edit page foregrounds the personal-projection callout and labels fields with "(your view)"', async ({ page }) => {
  await page.goto('/edit/listening-room');
  await expect(page.getByText(/your view of this circle/i)).toBeVisible();
  await expect(page.getByText(/personal to you/i)).toBeVisible();
  // Form fields are labelled with the (your view) suffix
  const labels = await page.getByText(/\(your view\)/i).all();
  expect(labels.length).toBeGreaterThanOrEqual(1);
});

/* ────────────────────────────────────────────────────────────
 * Member drawer (AC-10)
 * ──────────────────────────────────────────────────────────── */

test('clicking a member row opens the drawer with trust, vouchers, and Vouch + Raise-a-concern actions', async ({ page }) => {
  await page.goto('/community/listening-room');
  // People tab is the default
  const firstRow = page.locator('[data-testid="member-row"]').first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();
  // Drawer opens
  await expect(page.locator('[data-testid="member-drawer"]')).toBeVisible();
  await expect(page.getByText(/trusted by/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /^vouch/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /raise a concern/i })).toBeVisible();
  // Overlay click closes
  await page.locator('[data-testid="drawer-overlay"]').click();
  await expect(page.locator('[data-testid="member-drawer"]')).toHaveCount(0);
});

/* ────────────────────────────────────────────────────────────
 * Cross-product nav + NotFound (AC-11, AC-12)
 * ──────────────────────────────────────────────────────────── */

test('header includes a cross-product link to brainstorm.world (target=_blank)', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('a[href="https://brainstorm.world"]');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', /noopener/);
});

test('unknown route renders the styled NotFound with a CTA back to Discover', async ({ page }) => {
  await page.goto('/some-bogus-path');
  await expect(page.getByText(/can'?t find/i)).toBeVisible();
  const cta = page.getByRole('link', { name: /back to discover|explore|home/i });
  await expect(cta.first()).toBeVisible();
});

/* ────────────────────────────────────────────────────────────
 * Responsive (AC-16)
 * ──────────────────────────────────────────────────────────── */

test('Discover holds layout at 375×812 (mobile) without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  // No horizontal overflow
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // tolerance for sub-pixel
  // Hero + search visible
  await expect(page.getByRole('heading', { name: /find your people/i })).toBeVisible();
  await expect(page.getByPlaceholder(/search/i)).toBeVisible();
});

test('CommunityDetail holds layout at 375×812 (mobile) without horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/community/listening-room');
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});
