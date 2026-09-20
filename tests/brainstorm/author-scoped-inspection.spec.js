const { test, expect } = require('@playwright/test');

/**
 * author-scoped-inspection #2–#4: author-scoped views on Active b-tags.
 *
 * Stories: engineering-team/stories/author-scoped-inspection/2-every-author-on-active-b-tags.md
 *          engineering-team/stories/author-scoped-inspection/3-narrow-by-person-and-by-author-type.md
 *          engineering-team/stories/author-scoped-inspection/4-mark-self-declaration-rows.md
 * ADR:     engineering-team/decisions/author-scoped-inspection/0002-author-scoped-views-on-active-b-tags.md
 *
 * Network-mocked browser round-trip. The structural half lives in
 * test/author-scoped-inspection-views.test.js; what is pinned HERE is everything only a browser
 * can answer — which rows a selection actually yields, and whether a colour survives :hover.
 *
 * Signed-in states are reached by mocking /api/auth/status + /api/auth/user-classification, which
 * is all AuthContext reads (ui/src/context/AuthContext.jsx:46,51). No NIP-07 signer is involved,
 * so these cases need no extension and no dev bypass.
 *
 * The community relay is a websocket and is deliberately NOT mocked — it fails to resolve and
 * "name (shared)" reads "cannot locate event". Every fact under test comes from the LOCAL scan.
 *
 *   E1  — signed out: the page defaults to Owner and lists that person's rows only.   [s3 AC-2]
 *   E2  — Everyone: every author in the relay is listed, foreign ones included.       [s2 AC-1]
 *   E3  — each row names the author of the local event that carries the b-tag.        [s2 AC-2]
 *   E4  — signed in with an assistant: defaults to Mine = my account + my assistant.  [s3 AC-1]
 *   E5  — signed in with NO assistant: stays on Mine and says so.                     [s3 AC-3]
 *   E6  — Signed by: Assistants.                                                      [s3 AC-5]
 *   E7  — Signed by: People.                                                          [s3 AC-5]
 *   E8  — Signed by: Everyone else.                                                   [s3 AC-5]
 *   E9  — an impossible combination reports that it matches nothing, and why.         [s3 AC-6]
 *   E10 — a self-declaration row is visually marked; a correspondence row is not.     [s4 AC-1,2]
 *   E11 — the panel note reads "* self-declaration", and only on those rows.          [s4 AC-3,4]
 *   E12 — the mark survives :hover in both directions.                                [s4 AC-5]
 *   E13 — the b-tag-deferred sentinel reaches no row, at any selection.               [s2 AC-3]
 *
 * ALL THIRTEEN FAIL against the current build: the page has no selectors, no author (local)
 * column and no row marking, and it filters to the owner's assistant before anything else runs.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN_NO_TA = '5'.repeat(64);
const STRANGER = '9'.repeat(64);

const FOREIGN = `39998:${'f'.repeat(64)}:shared-thing`;
const SENTINEL = 'b-tag-deferred';

const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Ada' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Baz' },
];

/** A kind-39998 concept header carrying one b tag. */
function header({ d, name, pubkey, b, description }) {
  const tags = [['d', d], ['names', name]];
  if (description) tags.push(['description', description]);
  if (b) tags.push(['b', b]);
  return { id: `${d}`.padEnd(64, '0').slice(0, 64), kind: 39998, pubkey, created_at: 1700000000, tags, content: '' };
}

const SELF_D = 'dog';
const SELF_COORD = `39998:${OWNER_TA}:${SELF_D}`;

const HEADERS = [
  header({ d: 'cat-breed', name: 'cat breed', pubkey: OWNER_TA, b: FOREIGN, description: 'A feline lineage.' }),
  header({ d: SELF_D, name: 'dog', pubkey: OWNER_TA, b: SELF_COORD, description: 'Offered as a shared concept.' }),
  header({ d: 'owner-signed', name: 'owner signed', pubkey: OWNER, b: FOREIGN }),
  header({ d: 'customer-thing', name: 'customer thing', pubkey: CUST_TA, b: FOREIGN }),
  header({ d: 'stranger-thing', name: 'stranger thing', pubkey: STRANGER, b: FOREIGN }),
  header({ d: 'deferred-one', name: 'deferred one', pubkey: OWNER_TA, b: SENTINEL }),
];

/** Every row name the page can ever show, so absence can be asserted positively. */
const ALL_NAMES = ['cat breed', 'dog', 'owner signed', 'customer thing', 'stranger thing'];

async function mockStack(page, { session = null } = {}) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/pubkey', (r) => json(r, { success: true, pubkey: OWNER_TA }));
  await page.route('**/api/owner/pubkey', (r) => json(r, { success: true, pubkey: OWNER }));
  await page.route('**/api/profiles**', (r) => json(r, { success: true, profiles: {} }));
  await page.route('**/api/relays', (r) => json(r, { success: true, relays: [] }));
  await page.route('**/api/status', (r) => json(r, { success: true }));
  await page.route('**/api/user-prefs', (r) => json(r, { success: true, preferences: {} }));
  await page.route('**/api/assistant/roster', (r) => json(r, {
    success: true,
    assistants: ROSTER,
    viewer: session ? { accountPubkey: session.pubkey, assistantPubkey: session.assistantPubkey } : null,
  }));
  await page.route('**/api/auth/status', (r) => json(r, session
    ? { authenticated: true, pubkey: session.pubkey }
    : { authenticated: false, pubkey: null }));
  await page.route('**/api/auth/user-classification', (r) => json(r, {
    success: true,
    classification: session ? session.classification : 'unauthenticated',
    pubkey: session ? session.pubkey : null,
    assistantPubkey: session ? session.assistantPubkey : null,
  }));
  // The stub HONORS an authors filter. That matters in both directions: before the change the
  // page narrows server-side and the stub must reproduce that, and after it the page sends no
  // authors at all. A stub that always returned everything would let an implementation that kept
  // the server-side narrowing AND added client-side filtering pass here while being wrong against
  // a real relay.
  await page.route('**/api/strfry/scan**', (r) => {
    const url = new URL(r.request().url());
    let filter = {};
    try { filter = JSON.parse(url.searchParams.get('filter') || '{}'); } catch { /* fall through */ }
    const authors = Array.isArray(filter.authors) ? filter.authors : null;
    const events = authors ? HEADERS.filter((e) => authors.includes(e.pubkey)) : HEADERS;
    return json(r, { success: true, events });
  });
}

const B_URL = '/tapestry/shared-concepts/b-tags';

const rows = (page) => page.locator('table.data-table tbody tr');
const rowWith = (page, text) => rows(page).filter({ hasText: text }).first();
const discloser = (row) => row.locator('button').last();

/** The visible row names, in table order. Panel rows carry no name cell and drop out. */
async function names(page) {
  await expect(page.locator('table.data-table')).toBeVisible();
  const out = [];
  for (const name of ALL_NAMES) {
    if (await rows(page).filter({ hasText: name }).count() > 0) out.push(name);
  }
  return out;
}

/** Pick an option on the selector whose accessible name / nearby label matches `label`. */
async function choose(page, label, option) {
  const select = page.locator('select').filter({ has: page.locator(`option:text-is("${option}")`) }).first();
  await expect(select, `story 3: a "${label}" selector offering "${option}" must exist`).toBeVisible();
  await select.selectOption({ label: option });
}

test.describe('Active b-tags — author-scoped views', () => {
  test('E1: signed out, the page defaults to Owner', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    expect(await names(page), 'story 3 AC-2: signed out defaults to Owner — the owner\'s own events and the owner\'s assistant\'s, and nobody else\'s')
      .toEqual(['cat breed', 'dog', 'owner signed']);
  });

  test('E2: Everyone lists every author the relay holds', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await choose(page, 'Showing', 'Everyone');
    expect(await names(page), 'story 2 AC-1: every b-tag event in the relay, including authors this instance does not control')
      .toEqual(ALL_NAMES);
  });

  test('E3: each row names the author of the local carrier', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    const headers = (await page.locator('table.data-table thead th').allTextContents()).join('|').toLowerCase();
    expect(headers, 'story 2 AC-2: an author (local) column').toContain('author (local)');
    expect(headers, 'story 2 AC-2: alongside the existing author (shared) column').toContain('author (shared)');
    await choose(page, 'Showing', 'Everyone');
    const row = rowWith(page, 'stranger thing');
    await expect(row.locator(`[title="${STRANGER}"]`), 'story 2 AC-2: the row must name who signed the local event')
      .toHaveCount(1);
  });

  test('E4: signed in with an assistant, the default is Mine — my account and my assistant', async ({ page }) => {
    await mockStack(page, { session: { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' } });
    await page.goto(B_URL);
    expect(await names(page), 'story 3 AC-1: Mine is the default and carries both of that person\'s keys')
      .toEqual(['customer thing']);
  });

  test('E5: signed in with no assistant, Mine stays selected and the page says so', async ({ page }) => {
    await mockStack(page, { session: { pubkey: ADMIN_NO_TA, assistantPubkey: null, classification: 'admin' } });
    await page.goto(B_URL);
    await expect(page.getByText(/no assistant key/i), 'story 3 AC-3: the reader is told they have no assistant key, rather than being silently moved to another person')
      .toBeVisible();
    expect(await names(page), 'story 3 AC-3: no silent fallback to the owner')
      .toEqual([]);
  });

  test('E6: Signed by — Assistants', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await choose(page, 'Showing', 'Everyone');
    await choose(page, 'Signed by', 'Assistants');
    expect(await names(page), 'story 3 AC-5: only assistants this instance controls')
      .toEqual(['cat breed', 'dog', 'customer thing']);
  });

  test('E7: Signed by — People', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await choose(page, 'Showing', 'Everyone');
    await choose(page, 'Signed by', 'People');
    expect(await names(page), 'story 3 AC-5: only the accounts those assistants belong to')
      .toEqual(['owner signed']);
  });

  test('E8: Signed by — Everyone else', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await choose(page, 'Showing', 'Everyone');
    await choose(page, 'Signed by', 'Everyone else');
    expect(await names(page), 'story 3 AC-5: only authors that are neither — the federation evidence')
      .toEqual(['stranger thing']);
  });

  test('E9: an impossible combination says it matches nothing, and why', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await choose(page, 'Signed by', 'Everyone else');
    expect(await names(page), 'story 3 AC-6: Owner + Everyone else selects nothing — it must not silently widen')
      .toEqual([]);
    await expect(page.locator('.empty-row'), 'story 3 AC-6: the table must report the empty combination')
      .toBeVisible();
    const msg = (await page.locator('.empty-row').textContent()) || '';
    expect(msg.toLowerCase(), 'story 3 AC-6: and say WHY — naming both selections')
      .toMatch(/owner[\s\S]*else|else[\s\S]*owner/);
  });

  test('E10: a self-declaration row is marked and a correspondence row is not', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await expect(rowWith(page, 'dog'), 'story 4 AC-1: the row whose b-tag points at its own coordinate is distinguished')
      .toHaveClass(/row-self-declared/);
    await expect(rowWith(page, 'cat breed'), 'story 4 AC-2: a row pointing at another event carries no such mark')
      .not.toHaveClass(/row-self-declared/);
  });

  test('E11: the panel note reads "* self-declaration", on those rows only', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    await discloser(rowWith(page, 'dog')).click();
    await expect(page.getByText('* self-declaration'), 'story 4 AC-3: beside the copy control on a self-declaration row')
      .toBeVisible();

    await discloser(rowWith(page, 'cat breed')).click();
    expect(await page.getByText('* self-declaration').count(), 'story 4 AC-4: a correspondence row\'s panel carries no note')
      .toBe(1);
  });

  test('E12: the mark survives :hover in both directions', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    const self = rowWith(page, 'dog');
    const plain = rowWith(page, 'cat breed');
    const bg = (loc) => loc.evaluate((el) => getComputedStyle(el).backgroundColor);

    const selfRest = await bg(self);
    const plainRest = await bg(plain);
    expect(selfRest, 'story 4 AC-1: at rest, the marked row differs from an unmarked one').not.toBe(plainRest);

    await plain.hover();
    const plainHover = await bg(plain);
    await self.hover();
    const selfHover = await bg(self);
    expect(selfHover, 'story 4 AC-5: under the pointer the mark must still differ from a plain hovered row — the base :hover rule must not swallow it')
      .not.toBe(plainHover);
    expect(selfHover, 'story 4 AC-5: and the row must still respond to hover — the mark must not swallow the hover feedback either')
      .not.toBe(selfRest);
  });

  test('E13: the deferred sentinel reaches no row at any selection', async ({ page }) => {
    await mockStack(page);
    await page.goto(B_URL);
    for (const option of ['Everyone', 'Owner']) {
      await choose(page, 'Showing', option);
      await expect(rows(page).filter({ hasText: 'deferred one' }),
        `story 2 AC-3: the reserved ${SENTINEL} sentinel is a disposition marker, not a correspondence claim — it must reach no row under "${option}"`)
        .toHaveCount(0);
    }
  });
});
