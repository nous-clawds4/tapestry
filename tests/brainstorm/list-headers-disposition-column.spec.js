const { test, expect } = require('@playwright/test');

/**
 * list-headers-disposition #2 — the 🧭 b-disposition column on List Headers: what a viewer SEES on /tapestry/lists.
 *
 * Story: engineering-team/stories/done/list-headers-disposition/2-b-disposition-column.md
 * ADR:   engineering-team/decisions/done/list-headers-disposition/0002-disposition-column-from-the-events-own-tags.md
 * Plan:  engineering-team/stories/done/list-headers-disposition/2-b-disposition-column.test-plan.md
 * Node half: test/list-headers-disposition-column.test.js (the pure classifier + the drift guard).
 *
 * Network-mocked and hermetic, like story 1's spec: a catch-all answers every /api call these tests don't name;
 * the rows come from GET /api/strfry/scan, each fixture header carrying the b-tags its case needs.
 *
 *   C1 — AC 1: signed out and signed in, a 🧭 column sits right after the two name columns, on every row; its
 *        header's tooltip names wired, self-declared, private and not yet decided.
 *   C2 — AC 2: self-pointing b → 🤝; wired by address or by event id → 🔗; both → 🔗 then 🤝; Concept Headers'
 *        tooltips.
 *   C3 — AC 3: the keep-private marker alone → 🔒; beside a real b the real chip shows and 🔒 doesn't.
 *   C4 — AC 4: no b-tag, or only unreadable b values → a muted ○ "not yet decided", never "—".
 *   C5 — AC 5: kind 9998, with or without b-tags → "—" with the can't-be-re-published tooltip.
 *   C6 — AC 6: nothing in a 🧭 cell is an action; clicking the cell opens the list, exactly as clicking the row.
 *   C7 — ADR 0002: the column's value is a word, so the table's own search box finds rows by state.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const ALICE = 'a1'.repeat(32);
const BOB = 'b1'.repeat(32);
const SOME_EVENT_ID = 'e7'.repeat(32);

const NOW = 1790000000;
let seq = 0;
function header(name, { kind = 39998, pubkey = ALICE, b = [] } = {}) {
  seq++;
  const d = `d-${name.replace(/\s+/g, '-')}`;
  const tags = [['names', name, `${name}s`]];
  if (kind === 39998) tags.unshift(['d', d]);
  for (const v of b) tags.push(v === 'b-tag-deferred' ? ['b', v] : ['b', v, 'pointer']);
  return { id: seq.toString(16).padStart(64, '0'), pubkey, kind, created_at: NOW - seq * 60, tags, content: '', sig: '0'.repeat(128) };
}
const own = (pubkey, name) => `39998:${pubkey}:d-${name.replace(/\s+/g, '-')}`;
const THEIRS = `39998:${BOB}:somebody-elses-concept`;

const HEADERS = [
  header('self list', { b: [own(ALICE, 'self list')] }),
  header('wired by address list', { b: [THEIRS] }),
  header('wired by id list', { pubkey: BOB, b: [SOME_EVENT_ID] }),
  header('both list', { pubkey: BOB, b: [own(BOB, 'both list'), THEIRS] }),
  header('private list', { b: ['b-tag-deferred'] }),
  header('private but wired list', { pubkey: BOB, b: ['b-tag-deferred', THEIRS] }),
  header('undecided list'),
  header('unreadable list', { pubkey: BOB, b: ['not-a-coordinate'] }),
  header('plain 9998 list', { kind: 9998 }),
  header('tagged 9998 list', { kind: 9998, pubkey: BOB, b: [THEIRS] }),
];

const TIPS = {
  '🔗': 'wired to an external shared concept',
  '🤝': 'self-declared shared concept',
  '🔒': 'deliberately private (no shared affiliation)',
  '○': 'not yet decided',
};

const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

async function mockStack(page, { session = null } = {}) {
  let configAnswered;
  const config = new Promise((resolve) => { configAnswered = resolve; });
  let owner = false;
  let ta = false;
  const settle = () => { if (owner && ta) configAnswered(); };

  await page.route('**/api/**', (r) => json(r, { success: false, error: 'not mocked in this spec' }, 404));
  await page.route('**/api/owner/pubkey', (r) => { owner = true; settle(); return json(r, { success: true, pubkey: OWNER }); });
  await page.route('**/api/assistant/pubkey', (r) => { ta = true; settle(); return json(r, { success: true, pubkey: OWNER_TA }); });
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/grapevine/preferences', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/setup/status**', (r) => json(r, session
    ? { success: true, signedIn: true, steps: { account: { done: true }, follow: { done: true }, activate: { done: true } } }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/attention**', (r) => json(r, session
    ? { success: true, signedIn: true, hasAssistant: false, actions: {} }
    : { success: true, signedIn: false }));
  await page.route('**/api/assistant/roster', (r) => json(r, { success: true, assistants: [], viewer: null }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/dlists/item-counts', (r) => json(r, { success: true, counts: {}, totalItems: 0 }));
  await page.route('**/api/neo4j/event-uuids', (r) => json(r, { success: true, uuids: [] }));
  await page.route('**/api/strfry/scan**', async (r) => {
    let filter = {};
    try { filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}'); } catch { /* not JSON */ }
    const kinds = Array.isArray(filter.kinds) ? filter.kinds : [];
    if (!(kinds.includes(39998) || kinds.includes(9998))) return json(r, { success: true, events: [] });
    await config;
    return json(r, { success: true, events: HEADERS });
  });
  await page.route('**/api/auth/status', (r) => json(r, session
    ? { authenticated: true, pubkey: session.pubkey }
    : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
}

const PAGE = '/tapestry/lists';

async function open(page, session = null) {
  await mockStack(page, { session });
  await page.goto(PAGE);
  await expect(page.getByRole('heading', { name: /Simple Lists \(DLists\)/ })).toBeVisible();
  await expect(page.getByText(/^\d+ (of \d+ )?lists$/)).toHaveText(`${HEADERS.length} lists`);
}

const headerTexts = async (page) => (await page.locator('table.data-table thead th').allTextContents()).map((s) => s.trim());

async function compassIndex(page) {
  const i = (await headerTexts(page)).findIndex((t) => t.startsWith('🧭'));
  expect(i, 'story AC 1: the table has a 🧭 column').toBeGreaterThanOrEqual(0);
  return i;
}

/** The 🧭 cell of the row whose first cell is `name`. */
async function cell(page, name) {
  const i = await compassIndex(page);
  const row = page.locator('table.data-table tbody tr').filter({ has: page.locator('td:first-child', { hasText: new RegExp(`^${name}$`) }) });
  await expect(row, `the fixture row "${name}" is listed`).toHaveCount(1);
  return row.locator('td').nth(i);
}

/** What a 🧭 cell shows: each titled mark's glyph, tooltip and whether it is muted. */
async function marks(page, name) {
  const c = await cell(page, name);
  return c.locator('[title]').evaluateAll((els) => els.map((e) => ({
    glyph: e.textContent.trim(),
    title: e.getAttribute('title'),
    muted: e.classList.contains('text-muted'),
  })));
}
const glyphsOf = (ms) => ms.map((m) => m.glyph);

test.describe('List Headers — the 🧭 b-disposition column (list-headers-disposition #2)', () => {
  for (const [who, session] of [['signed out', null], ['signed in', { pubkey: ALICE, assistantPubkey: OWNER_TA, classification: 'customer' }]]) {
    test(`C1 (AC 1, ${who}): a 🧭 column right after the two name columns, on every row, its tooltip naming every state`, async ({ page }) => {
      await open(page, session);
      const heads = await headerTexts(page);
      expect(heads.slice(0, 4), 'story AC 1: Name (singular), Name (plural), then 🧭, then Kind').toEqual(['Name (singular)', 'Name (plural)', '🧭', 'Kind']);
      const tip = await page.locator('table.data-table thead th').nth(2).locator('[title]').first().getAttribute('title');
      for (const word of ['wired', 'self-declared', 'private', 'not yet decided']) {
        expect(tip, `story AC 1: the 🧭 header's tooltip names "${word}"`).toContain(word);
      }
      for (const h of HEADERS) {
        const name = h.tags.find((t) => t[0] === 'names')[1];
        expect((await marks(page, name)).length, `story AC 1: the row "${name}" has a mark in its 🧭 cell`).toBeGreaterThan(0);
      }
    });
  }

  test('C2 (AC 2): 🤝 for a self-pointing b-tag, 🔗 for wired by address or by event id, 🔗 then 🤝 for both — Concept Headers\' tooltips', async ({ page }) => {
    await open(page);
    const cases = [
      ['self list', ['🤝']],
      ['wired by address list', ['🔗']],
      ['wired by id list', ['🔗']],
      ['both list', ['🔗', '🤝']],
    ];
    for (const [name, expected] of cases) {
      const ms = await marks(page, name);
      expect(glyphsOf(ms), `story AC 2: "${name}"`).toEqual(expected);
      for (const m of ms) expect(m.title, `story AC 2: the ${m.glyph} tooltip on "${name}"`).toBe(TIPS[m.glyph]);
    }
  });

  test('C3 (AC 3): the keep-private marker alone shows 🔒; beside a real b-tag only the real chip shows', async ({ page }) => {
    await open(page);
    const alone = await marks(page, 'private list');
    expect(glyphsOf(alone), 'story AC 3: the marker alone').toEqual(['🔒']);
    expect(alone[0].title).toBe(TIPS['🔒']);
    expect(glyphsOf(await marks(page, 'private but wired list')), 'story AC 3: the real b-tag wins').toEqual(['🔗']);
  });

  test('C4 (AC 4): no b-tag, or only an unreadable one, shows a muted ○ "not yet decided" — never "—"', async ({ page }) => {
    await open(page);
    for (const name of ['undecided list', 'unreadable list']) {
      const ms = await marks(page, name);
      expect(glyphsOf(ms), `story AC 4: "${name}" shows ○`).toEqual(['○']);
      expect(ms[0].title, `story AC 4: "${name}"'s tooltip`).toBe(TIPS['○']);
      expect(ms[0].muted, `story AC 4: "${name}"'s ○ is muted`).toBe(true);
      expect(await (await cell(page, name)).textContent(), `story AC 4: "${name}" never shows "—"`).not.toContain('—');
    }
  });

  test('C5 (AC 5): a kind-9998 header shows "—", with or without b-tags, and says why', async ({ page }) => {
    await open(page);
    for (const name of ['plain 9998 list', 'tagged 9998 list']) {
      const ms = await marks(page, name);
      expect(glyphsOf(ms), `story AC 5: "${name}" shows "—" alone`).toEqual(['—']);
      expect(ms[0].title, `story AC 5: "${name}"'s tooltip says kind 9998 headers can't be re-published, so they don't take a disposition`)
        .toMatch(/9998[\s\S]*re-?publish[\s\S]*disposition/i);
    }
  });

  test('C6 (AC 6): a 🧭 cell holds no action, and clicking it opens the list exactly as clicking the row does', async ({ page }) => {
    await open(page);
    const i = await compassIndex(page);
    const cells = page.locator('table.data-table tbody tr').locator(`td:nth-child(${i + 1})`);
    await expect(cells).toHaveCount(HEADERS.length);
    const actions = await cells.locator('button, a, input, select, textarea, [role="button"], [onclick], [tabindex]').count();
    expect(actions, 'story AC 6: nothing in a 🧭 cell is a button, link, field or focusable control').toBe(0);

    const self = HEADERS[0];
    const route = `39998:${self.pubkey}:${self.tags.find((t) => t[0] === 'd')[1]}`;
    await (await cell(page, 'self list')).click();
    await expect(page, 'story AC 6: clicking the 🧭 cell opens that list, as clicking the row does').toHaveURL(new RegExp(`/tapestry/lists/${encodeURIComponent(route)}$`));
  });

  test('C7 (ADR 0002): the table\'s own search box finds rows by their state word', async ({ page }) => {
    await open(page);
    await page.locator('input.table-filter').fill('self-declared');
    await expect.poll(async () => (await page.locator('table.data-table tbody tr td:first-child').allTextContents()).map((s) => s.trim()).sort(), {
      message: 'ADR 0002: the column\'s value is a state word, so "self-declared" finds the self-declared rows (and the one that is both)',
    }).toEqual(['both list', 'self list']);
  });
});
