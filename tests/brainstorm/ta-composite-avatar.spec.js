const { test, expect } = require('@playwright/test');
const zlib = require('zlib');

/**
 * ta-avatar #3: The stamped composite avatar — browser half.
 *
 * Story: engineering-team/stories/ta-avatar/3-stamped-composite-avatar-on-nostr.md
 * ADR:   engineering-team/decisions/ta-avatar/0003-owner-composited-avatar-hosted-by-the-instance.md
 * Server half: test/stamped-composite-avatar.test.js (U/S/H).
 *
 * ── What only a browser can settle ───────────────────────────────────────
 * AC1 is "a preview of their picture stamped with the brand mark on one corner
 * appears before anything is published". Every load-bearing word there is about
 * pixels: that the owner's picture is what got drawn, that the mark is ON it, and
 * that it is in a CORNER. A source scan sees a canvas and a drawImage call and
 * cannot tell any of that apart from a blank square — the goal-intent-fields #3
 * kick-back ("green suite, invisible feature") is the standing precedent.
 *
 * So these tests SAMPLE THE RENDERED PIXELS. The mocked owner avatar is solid
 * white; the badge is brand purple (#9546ed). If the composite happened, the
 * middle of the preview is white and its bottom-right corner is purple. Neither
 * is true of a blank canvas, a canvas that drew only the source, or a canvas that
 * drew the badge in the wrong place.
 *
 *   B0 — the served bundle contains the code under test.        [prerequisite]
 *   B1 — Generate produces a preview: owner's picture in the frame,
 *        brand mark in the bottom-right corner.                 [AC1]
 *   B2 — the composite is NOT published until the owner accepts. [AC1 "before"]
 *   B3 — accepting puts the instance-hosted URL into the picture field. [AC2]
 *   B4 — no owner picture: the branded fallback is offered, nothing crashes. [AC5]
 *
 * ── Prerequisites ────────────────────────────────────────────────────────
 *   BRAINSTORM_SERVER_ACCESSIBLE=true, and BRAINSTORM_BASE_URL pointing at an
 *   origin serving the BUILT ui. From an isolated worktree that is
 *   `cd ui && npm run build && npx vite preview --port 4173` — every API call
 *   below is route-mocked, so no stack and no live avatar host is touched.
 *
 * These FAIL against current code: the editor has no generate action, no preview,
 * and no way to reach /api/assistant/owner-avatar.
 */

const OWNER = 'bb'.repeat(32);
const TA = 'aa'.repeat(32);

const BADGE_RGB = [0x95, 0x46, 0xed]; // #9546ed — the brand purple of ta-badge.svg
const SOURCE_RGB = [255, 255, 255];   // the mocked owner avatar: solid white

const HOSTED_PATH = '/generated/ta-avatar-deadbeef.png';
const HOSTED_URL = `https://staging.example.test${HOSTED_PATH}`;
const FALLBACK_PATH = '/ta-avatar.png'; // story 2's branded asset (AC5)

/** A real, solid-colour PNG. Built here so the fixture colours are exact. */
function solidPng(width, height, [r, g, b]) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.concat(Array.from({ length: width }, () => Buffer.from([r, g, b])))]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

test.describe('The stamped composite avatar (ta-avatar #3)', () => {
  test.beforeEach(async ({ page }) => {
    if (process.env.BRAINSTORM_SERVER_ACCESSIBLE !== 'true') {
      test.skip('Brainstorm server not accessible (set BRAINSTORM_SERVER_ACCESSIBLE=true)');
    }
  });

  /** `ownerAvatar: 'ok' | 'missing'` chooses AC1's path or AC5's. */
  async function mock(page, { ownerAvatar = 'ok' } = {}) {
    const json = (body, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

    // Catch-all FIRST: Playwright resolves overlapping routes in reverse
    // registration order, so the specific handlers below win.
    await page.route('**/api/**', (r) => r.fulfill(json({ success: true })));

    await page.route('**/api/assistant/pubkey', (r) => r.fulfill(json({ success: true, pubkey: TA })));
    await page.route('**/api/owner/pubkey', (r) => r.fulfill(json({ success: true, pubkey: OWNER })));
    await page.route('**/api/relays', (r) => r.fulfill(json({ success: true, aRelays: {} })));
    await page.route('**/api/profiles**', (r) => r.fulfill(json({ success: true, profiles: {} })));

    // Signed in AS THE OWNER — the editor renders from user.pubkey.
    await page.route('**/api/auth/status', (r) => r.fulfill(json({ authenticated: true, pubkey: OWNER })));
    await page.route('**/api/auth/user-classification', (r) =>
      r.fulfill(json({ classification: 'owner', pubkey: OWNER, assistantPubkey: TA })));

    await page.route('**/api/assistant/status**', (r) => r.fulfill(json({
      success: true, hasRelayKey: true, hasProfile: false, isOwner: true, assistantPubkey: TA,
      defaults: {
        name: "Owner's Tapestry Assistant", display_name: "Owner's Tapestry Assistant",
        about: 'fixture', picture: '', banner: '', website: 'https://staging.example.test', lud16: '',
      },
    })));

    // The proxy (ADR D2). 'missing' is AC5's trigger and must not read as an error.
    await page.route('**/api/assistant/owner-avatar', (r) => (ownerAvatar === 'ok'
      ? r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(256, 256, SOURCE_RGB) })
      : r.fulfill(json({ success: false, error: 'owner has no picture' }, 404))));

    // The upload. Records that it was called so B2 can assert it was NOT.
    await page.route('**/api/assistant/avatar', (r) => (r.request().method() === 'POST'
      ? r.fulfill(json({ success: true, filename: 'ta-avatar-deadbeef.png', path: HOSTED_PATH, url: HOSTED_URL }))
      : r.fulfill(json({ success: true }))));

    // Story 2's branded asset, so AC5's fallback resolves to real bytes.
    await page.route(`**${FALLBACK_PATH}`, (r) =>
      r.fulfill({ status: 200, contentType: 'image/png', body: solidPng(64, 64, BADGE_RGB) }));
  }

  async function gotoEditor(page) {
    await page.goto('/tapestry/settings/assistant');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.settings-group').first(),
      'the Assistant Profile settings tab must render for a signed-in owner').toBeVisible({ timeout: 20000 });
  }

  /** The Generate control, by accessible name rather than a brittle selector. */
  function generateButton(page) {
    return page.getByRole('button', { name: /generate|badge|stamp/i }).first();
  }

  /**
   * Sample the preview. Handles a <canvas> or an <img>: an img is drawn into an
   * offscreen canvas first, so the assertion does not constrain which the
   * implementation chooses. Returns {w,h,at(x,y)} in fractional coordinates.
   */
  async function samplePreview(page) {
    return page.evaluate(() => {
      const el = document.querySelector('.ta-composite-preview');
      if (!el) return { error: 'no element with class .ta-composite-preview' };
      const w = el.naturalWidth || el.width;
      const h = el.naturalHeight || el.height;
      if (!w || !h) return { error: `preview has no intrinsic size (${w}x${h})` };
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d');
      ctx.drawImage(el, 0, 0, w, h);
      let data;
      try { data = ctx.getImageData(0, 0, w, h).data; }
      catch (e) { return { error: `preview canvas is tainted: ${e.message}` }; }
      const px = (fx, fy) => {
        const x = Math.min(w - 1, Math.max(0, Math.round(fx * (w - 1))));
        const y = Math.min(h - 1, Math.max(0, Math.round(fy * (h - 1))));
        const i = (y * w + x) * 4;
        return [data[i], data[i + 1], data[i + 2], data[i + 3]];
      };
      // Scan the bottom-right eighth for the closest match to the brand purple.
      let best = null;
      for (let y = Math.floor(h * 0.62); y < h; y += 1) {
        for (let x = Math.floor(w * 0.62); x < w; x += 1) {
          const i = (y * w + x) * 4;
          const d = Math.abs(data[i] - 0x95) + Math.abs(data[i + 1] - 0x46) + Math.abs(data[i + 2] - 0xed);
          if (best === null || d < best.d) best = { d, rgb: [data[i], data[i + 1], data[i + 2]] };
        }
      }
      // And the same scan over the TOP-LEFT eighth, to prove the mark is in a corner
      // rather than smeared over the whole image.
      let bestTL = null;
      for (let y = 0; y < Math.floor(h * 0.38); y += 1) {
        for (let x = 0; x < Math.floor(w * 0.38); x += 1) {
          const i = (y * w + x) * 4;
          const d = Math.abs(data[i] - 0x95) + Math.abs(data[i + 1] - 0x46) + Math.abs(data[i + 2] - 0xed);
          if (bestTL === null || d < bestTL.d) bestTL = { d, rgb: [data[i], data[i + 1], data[i + 2]] };
        }
      }
      return { w, h, centre: px(0.5, 0.4), bottomRight: best, topLeft: bestTL };
    });
  }

  /* ───────── B0 — is the code under test the code that is running? ───────── */
  test('B0: the served bundle contains the composite UI', async ({ request, baseURL }) => {
    const index = await request.get('/');
    expect(index.ok(), `${baseURL} did not serve an app shell (HTTP ${index.status()}).`).toBe(true);
    const assets = [...(await index.text()).matchAll(/(?:src|href)="([^"]+\.js)"/g)].map((m) => m[1]);
    expect(assets.length, 'no built JS referenced from the app shell — is this a built UI?').toBeGreaterThan(0);
    let found = false;
    for (const a of assets) {
      const res = await request.get(a);
      if (res.ok() && (await res.text()).includes('ta-composite-preview')) { found = true; break; }
    }
    expect(found,
      'the served bundle does not contain "ta-composite-preview", the class ADR 0003 gives the preview. ' +
      'Either the bundle predates your edit — a source-only change is INVISIBLE to this class, so run ' +
      '`cd ui && npm run build` — or the preview is not implemented, in which case B1 says so directly.')
      .toBe(true);
  });

  /* ───────── B1 — AC1, decided on pixels ───────── */
  test('B1: Generate previews the owner\'s picture with the brand mark stamped in the corner', async ({ page }) => {
    await mock(page);
    await gotoEditor(page);

    const btn = generateButton(page);
    await expect(btn, 'AC1: the editor must offer a way to generate the badged avatar').toBeVisible({ timeout: 15000 });
    await btn.click();

    await expect(page.locator('.ta-composite-preview'),
      'AC1: a preview must appear before anything is published').toBeVisible({ timeout: 20000 });

    const s = await samplePreview(page);
    expect(s.error, `could not read the preview: ${s.error}`).toBeUndefined();

    // The owner's picture is what got drawn.
    const [r, g, b] = s.centre;
    expect(Math.abs(r - 255) + Math.abs(g - 255) + Math.abs(b - 255),
      `AC1: the preview must show the OWNER'S PICTURE. The mocked avatar is solid white, so the middle ` +
      `of the composite should be white; sampled rgb(${r},${g},${b}). A blank or badge-only canvas fails here.`)
      .toBeLessThan(60);

    // The mark is ON it, in the bottom-right.
    expect(s.bottomRight.d,
      `AC1: the brand mark must be stamped on the composite. Scanned the bottom-right eighth for the ` +
      `badge purple #9546ed and the closest pixel was rgb(${s.bottomRight.rgb.join(',')}). A preview that ` +
      'drew only the owner\'s picture fails exactly here.').toBeLessThan(60);

    // …and only there — a mark covering the whole frame is not "on one corner".
    expect(s.topLeft.d,
      `AC1 says the mark sits "on one corner". The top-left eighth should NOT be badge-coloured, but its ` +
      `closest pixel was rgb(${s.topLeft.rgb.join(',')}). A full-bleed mark hides the owner's face, which ` +
      'defeats the point of the composite.').toBeGreaterThan(60);
  });

  /* ───────── B2 — AC1's "before anything is published" ───────── */
  test('B2: generating a preview does not publish or store anything on its own', async ({ page }) => {
    await mock(page);
    const posted = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && /\/api\/assistant\/(avatar|publish-profile)/.test(req.url())) {
        posted.push(req.url());
      }
    });
    await gotoEditor(page);
    await generateButton(page).click();
    await expect(page.locator('.ta-composite-preview')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(600);

    expect(posted,
      `AC1: the preview appears "before anything is published". Generating must not upload or publish ` +
      `by itself — the owner accepts first. Observed POSTs: ${JSON.stringify(posted)}`).toEqual([]);
  });

  /* ───────── B3 — AC2's client half ───────── */
  test('B3: accepting the composite puts the instance-hosted URL into the picture field', async ({ page }) => {
    await mock(page);
    await gotoEditor(page);
    await generateButton(page).click();
    await expect(page.locator('.ta-composite-preview')).toBeVisible({ timeout: 20000 });

    const accept = page.getByRole('button', { name: /use|accept|apply|save/i }).first();
    await expect(accept, 'AC2: the owner must be able to accept the generated composite').toBeVisible({ timeout: 15000 });
    await accept.click();

    // Scan every field rather than indexing one: `about` renders as a textarea,
    // so the picture input's position is not what PROFILE_FIELDS' order suggests,
    // and pinning an index here would break the moment a field is added.
    await expect
      .poll(async () => {
        const values = await page.locator('input').evaluateAll((els) => els.map((e) => e.value));
        return values.some((v) => typeof v === 'string' && v.includes(HOSTED_PATH));
      }, {
        timeout: 15000,
        message:
          `AC2: after accepting, the picture field must carry the URL the instance returned (${HOSTED_URL}). ` +
          'The existing publish flow then signs it unchanged — this story supplies a value for a field ' +
          'that already exists.',
      })
      .toBe(true);
  });

  /* ───────── B4 — AC5 ───────── */
  test('B4: with no owner picture, the branded fallback is offered instead of an error', async ({ page }) => {
    await mock(page, { ownerAvatar: 'missing' });
    await gotoEditor(page);
    await generateButton(page).click();
    await page.waitForTimeout(1200);

    const body = (await page.locator('.settings-group').first().innerText()).replace(/\s+/g, ' ');
    expect(body,
      `AC5: when the owner has no picture the flow must OFFER THE BRANDED FALLBACK, not fail. The editor ` +
      `should say so and make story 2's image available. Panel read: "${body.slice(0, 300)}"`)
      .toMatch(/fallback|branded|instead|no picture|default/i);

    const usedFallback = await page.evaluate((p) => {
      const hit = (s) => typeof s === 'string' && s.includes(p);
      if ([...document.querySelectorAll('img')].some((i) => hit(i.getAttribute('src')))) return true;
      return [...document.querySelectorAll('input')].some((i) => hit(i.value));
    }, FALLBACK_PATH);
    expect(usedFallback,
      `AC5: story 2's ${FALLBACK_PATH} must be what the flow falls back to — it exists precisely to be ` +
      'this fallback. Neither a preview nor the picture field referenced it.').toBe(true);

    await expect(page.locator('.ta-composite-preview'),
      'AC5: a missing owner picture is not an error state — the panel must still be usable.').toHaveCount(0);
  });
});
