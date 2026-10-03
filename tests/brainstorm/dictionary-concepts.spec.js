const { test, expect } = require('@playwright/test');

/**
 * Dictionary › Concepts: whose dictionary the page shows (the owner's correction of 2026-09-29).
 *
 * The rows are the person's own dictionary: exactly what Active b-tags lists under "Mine". The
 * page resolves the person as Active b-tags does and sends their pubkeys to
 * GET /api/dictionaries/concepts as `authors`. What only a browser can answer is pinned here:
 * which `authors` the page actually sends for each kind of reader, and what it then says. The
 * structural and live halves are in test/dictionary-concepts.test.js (its H1 rebuilds the rows
 * from strfry and compares them with the Active b-tags rule on real data).
 *
 * Network-mocked, the author-scoped-inspection.spec.js idiom: signed-in states come from mocking
 * /api/auth/status, /api/auth/user-classification and the roster. The dictionary endpoint is
 * mocked too, and it applies the server's rule to the fixture headers for whichever authors are
 * asked for, so a page that sent the wrong person would show the wrong rows.
 *
 *   D1 — signed out: the owner's pair is asked for, and the page says it is the owner's.
 *   D2 — a signed-in customer: their account and their assistant, "your", and no owner-only note.
 *   D3 — the signed-in owner: the owner's pair, and Add to Dictionary is offered.
 *   D4 — signed in with no assistant: the account alone, and the page says so.
 *
 * /dictionary is the same list in the Brainstorm design's styling (pages/dictionary/). It renders
 * the control panel page's own body, so these ask only what the frame adds:
 *
 *   D5 — signed out: the owner's pair and the same rows, headed "The owner’s Dictionary.", in the
 *        design's type, and each row opens /dictionary/:coord.
 *   D6 — a signed-in customer: their own pair, headed "Your Dictionary.".
 *   D7 — a row's entry opens on /dictionary/:coord, and its back link returns to /dictionary.
 *   D8 — the avatar menu offers Dictionary (/dictionary), right after Dictionaries.
 *   D9 — with a setup step left, the Setup Alert sits centred in the bar and the avatar at its right.
 *
 * The entry page, laid out as the design's Dictionary entry screen (test/dictionary-entry.test.js
 * holds the pure rule and the structural pins):
 *
 *   D10 — the Items table asks once, for the entry's own header, its shared concept and the
 *         person; it pages ten at a time, searches (name and filer) and sorts; the Curation card
 *         names the Assistant the Treasure Map assigns; what has no backend is disabled; the GUM₁
 *         sentence; the header panels open.
 *   D11 — a Treasure Map that cannot be read names no curator and says so.
 *
 * "Managed by" on /dictionary (test/dictionary-managed-by.test.js holds the pure rules):
 *
 *   D12 — a signed-in reader picks another of their Assistants: the URL names it, the list is its
 *         Dictionary (read for that Assistant alone), and the page says it reads this relay.
 *   D13 — "All of my Assistants": one row per shared concept, with "n of m Assistants".
 *   D14 — a link to another Assistant's Dictionary reads only that one; its entry returns to it
 *         and names the Assistant's header.
 *   D15 — signed out it is a label, and an unreadable link says nothing about "your own"; signed in, a
 *         link naming someone else's Assistant falls back, and says so.
 *   D16 — an Assistant's Dictionary that cannot be read is an error with Try again, never "0 concepts".
 *   D17 — when the reader's Assistants cannot be read, the page says so and offers Try again.
 *   D18 — the menu works from the keyboard: focus moves in, arrows move, Escape returns to the trigger.
 *   D19 — focus leaving for nowhere (Safari, pressing an option) leaves the menu open, so a pick lands;
 *         Escape on the trigger closes it.
 *
 * The item page (the design's Dictionary item screen):
 *
 *   D20 — an Items row opens /dictionary/:coord/items/:item: "Item N in <concept>", who filed it, the
 *         raw event; its back link returns to the entry.
 *   D21 — a direct visit works out the number from the Items, and says when an item is filed by
 *         someone the community doesn't trust.
 *   D22 — it says no more than it knows: an event filed elsewhere isn't "untrusted", a failed
 *         Dictionary read is named, and a "%" in a d-tag doesn't crash the page.
 *   D23 — a modified click on a row (new tab) doesn't navigate this tab.
 *
 * Create New Concept (the design's screen; test/dictionary-new-concept.test.js holds the draft rule):
 *
 *   D24 — a signed-in customer creates a concept: the preview is the shared header, their own
 *         Assistant signs it on the server (POST /api/dictionaries/concepts/new), and the page opens
 *         its entry saying what the broadcast did.
 *   D25 — a header this instance's relay holds for the Assistant at that name isn't replaced: the
 *         server refuses, and the page links to it.
 *   D26 — the owner's Assistant signs the same way; an event signed by another key isn't broadcast;
 *         signed out, the form is disabled.
 *   D27 — a broadcast that doesn't land: the form locks, Try again re-broadcasts that event, and the
 *         page opens that event's concept.
 *
 * GUM₂, recognition (test/dictionary-gum2.test.js holds the rule):
 *
 *   D28 — the list sorts by recognition, with each row's GUM₂; the entry strip says "Recognized by N
 *         members of … trusted, extended community (GUM₂ x.xx)" above the filing line.
 *
 * Create New Concept from the finder, wired (test/dictionary-wired-create.test.js holds the endpoint):
 *
 *   D29 — a signed-in customer finds a shared concept, and Add to Dictionary offers Create New Concept
 *         wired to it: /dictionary/new?wire=… starts from its names and description, the preview is a
 *         copy of its header (all but json, concept-graph and the like; its own d, slug and b), the
 *         request names the version copied, and their Assistant creates it. The owner gets the twin picker and the
 *         same link; signed out, the finder says to sign in.
 *   D37 — the copy is never skipped: Create waits for the shared header's read; an unreachable community
 *         relay is said so, with Try again, and no create; a replaced version is read again first.
 *   D30 — signed in with no Assistant here: the page says so, points to Account Setup, and can't create;
 *         the finder's Add says the same rather than "Your Assistant adds…".
 *   D31 — the page says what it can't do: a link that names no address, an address too long for the
 *         relay to look up (255 bytes), a shared header it can't find, a name whose d-tag is too long;
 *         and the finder offers no Add for a concept whose address is too long.
 *
 * Edit a concept (test/dictionary-edit-concept.test.js holds the rule and the endpoint):
 *
 *   D32 — Edit shows beside the title only for a signed-in reader, on a header their own Assistant wrote:
 *         not signed out, not on another Assistant's header (Managed by), not in the control panel.
 *   D33 — the edit page starts from the header; names, description and Item Property Tags change; the
 *         preview keeps the d and b tags; Save sends the version it started from, and the entry says
 *         what the broadcast did.
 *   D34 — a header that changed meanwhile isn't overwritten: the page says so, and starts again from the
 *         latest version only when asked.
 *   D35 — a firmware concept warns that a reinstall undoes the edit, a Dictionary row or not; signed
 *         out, or someone else's header, the page says why it can't edit.
 *   D36 — a concept the server finds by name keeps its singular name; a name another concept has is
 *         refused with a link to it; the graph's and the broadcast's outcomes are each said once.
 */

const OWNER = '1'.repeat(64);
const OWNER_TA = '2'.repeat(64);
const CUST = '3'.repeat(64);
const CUST_TA = '4'.repeat(64);
const ADMIN_NO_TA = '5'.repeat(64);
const REMOTE_TA = '8'.repeat(64); // an Assistant the customer tagged, hosted elsewhere
const FOREIGN = `39998:${'f'.repeat(64)}:shared-thing`;
const SENTINEL = 'b-tag-deferred';

const ROSTER = [
  { accountPubkey: OWNER, assistantPubkey: OWNER_TA, role: 'owner', displayName: 'Ada' },
  { accountPubkey: CUST, assistantPubkey: CUST_TA, role: 'customer', displayName: 'Baz' },
];

/** Fixture headers: [d, name, author, b]. */
const HEADERS = [
  ['cat-breed', 'cat breed', OWNER_TA, FOREIGN],
  ['dog', 'dog', OWNER_TA, `39998:${OWNER_TA}:dog`],
  ['owner-signed', 'owner signed', OWNER, FOREIGN],
  ['customer-thing', 'customer thing', CUST_TA, FOREIGN],
  ['admin-thing', 'admin thing', ADMIN_NO_TA, FOREIGN],
  ['deferred-one', 'deferred one', OWNER_TA, SENTINEL],
  ['remote-thing', 'remote thing', REMOTE_TA, FOREIGN], // the same shared concept as "customer thing"
  ['remote-only', 'remote only', REMOTE_TA, `39998:${'e'.repeat(64)}:elsewhere`],
];
const ALL_NAMES = HEADERS.map((h) => h[1]);
/** GUM₂ by header d-tag, as the server would send it (recognitionByConcept). */
const RECOGNITION = { 'cat-breed': { gum2: 0.75, recognizedBy: 2 }, dog: { gum2: 1.5, recognizedBy: 3 } };

/** The server's rule over the fixtures: the requested authors' headers that carry a real b. */
function dictionaryFor(authors) {
  return HEADERS
    .filter(([, , author, b]) => authors.includes(author) && b !== SENTINEL)
    .map(([d, name, author, b]) => {
      const coord = `39998:${author}:${d}`;
      const selfDeclared = b === coord;
      return {
        coord, name, plural: null, description: null, author,
        targets: selfDeclared ? [] : [b], selfDeclared, isFirmware: false,
        itemCount: 0, sharedCoord: selfDeclared ? coord : b, gum: 0,
        totalAuthorCount: 0, totalEventCount: 0, override: null,
        ...(RECOGNITION[d] || { gum2: 0, recognizedBy: 0 }),
      };
    });
}

async function mockStack(page, { session = null } = {}) {
  const asked = [];
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
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
  await page.route('**/api/dictionaries/concepts**', (r) => {
    const authors = (new URL(r.request().url()).searchParams.get('authors') || '').split(',').filter(Boolean);
    asked.push(authors.join(','));
    return json(r, {
      success: true, metric: 'gum1', authors, entries: dictionaryFor(authors),
      pov: { branch: 'house', observer: null, fellBackToHouse: false, cutoff: 0.01, threshold: 2 },
    });
  });
  return asked;
}

const URL_ = '/tapestry/dictionaries/concepts';
const list = (page) => page.getByRole('list', { name: /Concepts in/ });

/** The row names on the page, in fixture order. */
async function names(page) {
  await expect(list(page)).toBeVisible();
  const out = [];
  for (const name of ALL_NAMES) {
    if (await list(page).locator('.dict-row-name', { hasText: new RegExp(`^${name}$`) }).count() > 0) out.push(name);
  }
  return out;
}


/** The customer's Assistants: their local one and Robin, tagged, with names. Call after mockStack (and mockEntry). */
async function mockAssistants(page) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await page.route('**/api/assistant/my-assistants', (r) => json(r, {
    success: true, signedIn: true, local: CUST_TA,
    rows: [
      { pubkey: CUST_TA, local: true, tags: [{ key: 'tapestry', name: 'My Tapestry Assistant' }] },
      { pubkey: REMOTE_TA, local: false, tags: [{ key: 'brainstorm', name: 'My Brainstorm Assistant' }] },
    ],
  }));
  await page.route('**/api/profiles**', (r) => json(r, {
    success: true,
    profiles: {
      [CUST_TA]: { name: 'Baz’s Assistant', nip05: 'baz-assistant@here.example' },
      [REMOTE_TA]: { name: 'Robin', website: 'robin.example' },
    },
  }));
}

const SHARER = 'ab'.repeat(32);
const SHARED_D = 'taco-truck';
const SHARED_COORD = `39998:${SHARER}:${SHARED_D}`;
/** A concept someone shared (its b-tag points to itself), on the community relay. */
const SHARED_HEADER = {
  id: 'a'.repeat(64), kind: 39998, pubkey: SHARER, created_at: 1700000000, content: '', sig: 'b'.repeat(128),
  tags: [
    ['d', SHARED_D], ['names', 'Taco Truck', 'Taco Trucks'], ['slug', SHARED_D], ['json', '{"word":{"slug":"x"}}'],
    ['concept-graph', `39999:${SHARER}:${SHARED_D}-concept-graph`], ['description', 'Trucks that sell tacos.'],
    ['required', 'url'], ['field-type', 'url', 'url'], ['b', SHARED_COORD, 'pointer'],
  ],
};
const slugOf = (name) => name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Create New Concept's reads and writes: the shared header on the community relay (through the
 * server's /api/relay/external), this relay's scans, the create endpoint signing as `assistant`
 * (`existing` → it refuses with 409; `signer` → it signs as another key), and a local-only publish
 * policy unless `external`, so no socket is opened. Returns the create requests' bodies.
 */
async function mockCreate(page, { assistant, existing = false, external = false, signer = null } = {}) {
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const created = [];
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: external }));
  await page.route('**/api/relay/external**', (r) => json(r, { success: true, events: [SHARED_HEADER] }));
  await page.route('**/api/strfry/scan**', (r) => json(r, { success: true, events: [] }));
  await page.route('**/api/dictionaries/concepts/new', (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    created.push(body);
    const d = slugOf(body.singular || '');
    if (existing) return json(r, { success: false, code: 'exists', coord: `39998:${assistant}:${d}`, error: 'exists' }, 409);
    const pubkey = signer || assistant;
    const tags = [['d', d], ['names', body.singular, body.plural]];
    if (body.description) tags.push(['description', body.description]);
    tags.push(['b', body.target || `39998:${pubkey}:${d}`, 'pointer']);
    const event = { kind: 39998, pubkey, created_at: 1790000000, content: '', tags, id: '4'.repeat(64), sig: '5'.repeat(128) };
    return json(r, { success: true, event, coord: `39998:${pubkey}:${d}` });
  });
  return created;
}

/** The header an edit starts from: the customer's Assistant's "customer thing", wired to FOREIGN. */
const EDIT_D = 'customer-thing';
const EDIT_COORD = `39998:${CUST_TA}:${EDIT_D}`;
const EDIT_BASE = {
  id: '6a'.repeat(32), kind: 39998, pubkey: CUST_TA, created_at: 1700000000, content: '', sig: '7b'.repeat(64),
  tags: [['d', EDIT_D], ['names', 'customer thing', 'customer things'], ['description', 'A thing.'], ['required', 'name'], ['b', FOREIGN, 'pointer']],
};

/**
 * Edit's reads and write, on top of mockStack and mockEntry: the header at EDIT_COORD (`base`), and the edit
 * endpoint, which answers `changed` (a 409 with that newer version) or signs as `assistant`. A local-only
 * publish policy, so no socket is opened. Returns the edit requests' bodies.
 */
async function mockEdit(page, { base = EDIT_BASE, assistant = CUST_TA, changed = null, taken = null, graph = 'none', firmware = false } = {}) {
  const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  const asked = [];
  await page.route('**/api/publish-policy', (r) => json(r, { success: true, allowExternalPublish: false }));
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if ((filter.kinds || []).includes(39998) && (filter['#d'] || [])[0] === base.tags[0][1] && (filter.authors || [])[0] === base.pubkey) {
      return json(r, { success: true, events: [base] });
    }
    return r.fallback();
  });
  await page.route('**/api/dictionaries/concepts/firmware**', (r) => json(r, { success: true, firmware }));
  await page.route('**/api/dictionaries/concepts/edit', (r) => {
    const body = JSON.parse(r.request().postData() || '{}');
    asked.push(body);
    if (changed) return json(r, { success: false, code: 'changed', event: changed, error: 'changed' }, 409);
    if (taken) return json(r, { success: false, code: 'name-taken', coord: taken, error: 'taken' }, 409);
    const tags = [['d', base.tags[0][1]], ['names', body.singular, body.plural]];
    if (body.description) tags.push(['description', body.description]);
    tags.push(...body.properties, ...base.tags.filter((t) => t[0] === 'b'));
    return json(r, { success: true, coord: EDIT_COORD, graph, event: { ...base, id: '8c'.repeat(32), pubkey: assistant, created_at: base.created_at + 1, tags } });
  });
  return asked;
}

const TRUSTED_FILER = '6'.repeat(64);
const UNTRUSTED_FILER = '9'.repeat(64);
const UNTRUSTED_ITEM = 'e'.repeat(64);
const ELSEWHERE_ITEM = 'c'.repeat(64);
const CURATOR = '7'.repeat(64);

/** The entry page's own reads, on top of mockStack: its Items, the two headers, the Treasure Map. */
async function mockEntry(page, { map = 'assigned' } = {}) {
  const json = (r, body) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  const itemsAsked = [];
  const items = Array.from({ length: 22 }, (_, i) => ({
    id: String(i + 1).padStart(64, '0'), address: null, kind: 9999, author: TRUSTED_FILER,
    name: `item ${String(i + 1).padStart(2, '0')}`, createdAt: i + 1,
  }));
  items.push({ id: 'f'.repeat(64), address: null, kind: 9999, author: TRUSTED_FILER, name: 'zebra', createdAt: 99 });
  await page.route('**/api/dictionaries/concepts/items**', (r) => {
    itemsAsked.push(Object.fromEntries(new URL(r.request().url()).searchParams));
    return json(r, { success: true, items, filerCount: 1, totalCount: 25, pov: { branch: 'house', fellBackToHouse: false } });
  });
  await page.route('**/api/strfry/scan**', (r) => {
    const filter = JSON.parse(new URL(r.request().url()).searchParams.get('filter') || '{}');
    if (Array.isArray(filter.ids)) {
      // An item page reads its event by id: a listed item, or one filed by someone untrusted.
      const id = filter.ids[0];
      const listed = items.find((it) => it.id === id);
      const ev = listed
        ? { id, kind: 9999, pubkey: TRUSTED_FILER, created_at: listed.createdAt, content: '', tags: [['z', FOREIGN], ['name', listed.name]] }
        : id === UNTRUSTED_ITEM ? { id, kind: 9999, pubkey: UNTRUSTED_FILER, created_at: 5, content: '', tags: [['z', FOREIGN], ['name', 'mystery']] }
          : id === ELSEWHERE_ITEM ? { id, kind: 9999, pubkey: UNTRUSTED_FILER, created_at: 6, content: '', tags: [['z', `39998:${'d'.repeat(64)}:other`], ['name', 'stray']] }
            : null;
      return json(r, { success: true, events: ev ? [ev] : [] });
    }
    if ((filter.kinds || []).includes(10040)) {
      if (map === 'unreadable') return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'strfry is down' }) });
      // ["39998:cat-breed", OWNER_TA] empowers 39998:<OWNER_TA>:cat-breed, the entry D10 opens.
      return json(r, { success: true, events: [{ id: 'a'.repeat(64), kind: 10040, pubkey: OWNER, created_at: 1, content: '', tags: [['39998:cat-breed', OWNER_TA]] }] });
    }
    if ((filter.kinds || []).includes(39998)) {
      const [author] = filter.authors || [];
      const [d] = filter['#d'] || [];
      return json(r, { success: true, events: [{ id: `${d}`.padEnd(64, '0').slice(0, 64), kind: 39998, pubkey: author, created_at: 1, content: '', tags: [['d', d], ['names', d.replace('-', ' '), `${d}s`], ['b', FOREIGN]] }] });
    }
    return json(r, { success: true, events: [] });
  });
  await page.route('**/api/neo4j/query', (r) => json(r, { success: true, data: [] }));
  await page.route('**/api/profiles**', (r) => json(r, {
    success: true,
    profiles: {
      [CURATOR]: { name: 'Curio', nip05: 'curio@example.com' },
      ['f'.repeat(64)]: { name: 'Fiona', nip05: 'fiona.example' },
      [TRUSTED_FILER]: { name: 'Trusty' },
    },
  }));
  return itemsAsked;
}

test.describe('Dictionary › Concepts — whose dictionary', () => {
  test('D1: signed out, the page shows the owner’s dictionary', async ({ page }) => {
    const asked = await mockStack(page);
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'signed out → the owner and the owner’s assistant' }).toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(page.getByText('You’re signed out, so this is the owner’s Dictionary.')).toBeVisible();
    await expect(list(page).getByText('Shared by the owner')).toBeVisible();
  });

  test('D2: a signed-in customer sees their own dictionary, and no owner-only note', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'a customer → their account and their assistant' }).toBe(`${CUST},${CUST_TA}`);
    expect(await names(page)).toEqual(['customer thing']);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText(/only the owner of this instance can add/)).toHaveCount(0);
    await expect(page.getByText('Sign in to add a concept from here.')).toHaveCount(0);
  });

  test('D3: the signed-in owner sees their dictionary, marked as theirs', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'the owner → the owner and the owner’s assistant' }).toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(list(page).getByText('Shared by you')).toBeVisible();
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(page.getByText(/only the owner of this instance can add/)).toHaveCount(0);
  });

  test('D4: signed in with no assistant, the account alone, and the page says so', async ({ page }) => {
    const asked = await mockStack(page, { session: { pubkey: ADMIN_NO_TA, assistantPubkey: null, classification: 'admin' } });
    await page.goto(URL_);
    await expect(page.getByText(/concepts? in your Dictionary/)).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'no assistant → the account only' }).toBe(ADMIN_NO_TA);
    expect(await names(page)).toEqual(['admin thing']);
    await expect(page.getByText('You have no assistant key on this instance')).toBeVisible();
  });
});


const PAGE = '/dictionary';
const CUSTOMER = { pubkey: CUST, assistantPubkey: CUST_TA, classification: 'customer' };
const coordOf = (author, d) => `39998:${author}:${d}`;

test.describe('/dictionary — the same dictionary in the design’s styling', () => {
  test('D5: signed out, /dictionary shows the owner’s dictionary, and its rows open /dictionary/:coord', async ({ page }) => {
    const asked = await mockStack(page);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'The owner’s Dictionary.' })).toBeVisible();
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'signed out → the owner and the owner’s assistant' }).toBe(`${OWNER},${OWNER_TA}`);
    expect(await names(page)).toEqual(['cat breed', 'dog', 'owner signed']);
    await expect(list(page).getByRole('link', { name: /^cat breed/ }))
      .toHaveAttribute('href', `/dictionary/${encodeURIComponent(coordOf(OWNER_TA, 'cat-breed'))}`);
    await expect(page.locator('.bsd-page')).toHaveCSS('font-family', /^Figtree/);
    await expect(page.getByRole('link', { name: 'Brainstorm home' })).toHaveAttribute('href', '/');
  });

  test('D6: a signed-in customer sees their own dictionary as “Your Dictionary.”', async ({ page }) => {
    // The h1 can read before the request has left, so each test waits for it (OPEN.md row `2026-09-30-dictionary-d6-reads-before-request`).
    const asked = await mockStack(page, { session: CUSTOMER });
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Dictionary.' })).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'a customer → their account and their assistant' }).toBe(`${CUST},${CUST_TA}`);
    expect(await names(page)).toEqual(['customer thing']);
  });

  test('D7: a row opens its entry on /dictionary/:coord, whose back link returns to /dictionary', async ({ page }) => {
    await mockStack(page);
    await page.route('**/api/strfry/scan**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }),
    }));
    await page.goto(PAGE);
    await list(page).getByRole('link', { name: /^dog/ }).click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coordOf(OWNER_TA, 'dog'))}`);
    await expect(page.getByRole('heading', { level: 1, name: 'dog' })).toBeVisible();
    await expect(page.getByText('Shared by the owner')).toBeVisible();
    const back = page.getByRole('link', { name: 'Dictionary', exact: true });
    await expect(back).toHaveAttribute('href', '/dictionary');
    await back.click();
    await expect(page.getByRole('heading', { level: 1, name: 'The owner’s Dictionary.' })).toBeVisible();
  });

  test('D8: the avatar menu offers Dictionary, right after Dictionaries', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await page.goto(PAGE);
    await page.locator('.bs-usermenu-avatar-btn').click();
    const links = page.locator('.bs-usermenu-dropdown .bs-usermenu-link');
    const labels = (await links.allTextContents()).map((t) => t.trim());
    const i = labels.findIndex((l) => /Dictionaries$/.test(l));
    expect(i, 'Dictionaries is still in the menu').toBeGreaterThanOrEqual(0);
    expect(labels[i + 1]).toMatch(/Dictionary$/);
    await expect(links.nth(i + 1)).toHaveAttribute('href', '/dictionary');
  });

  test('D10: the entry page — Items, Curation, disabled controls and the header panels', async ({ page }) => {
    await mockStack(page);
    const itemsAsked = await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);

    const card = page.locator('.dict-items');
    await expect(card.locator('.dict-items-count')).toHaveText('23 items');
    expect(itemsAsked, 'asked once, after the row is known').toHaveLength(1);
    expect(itemsAsked[0], 'the own header, its shared concept, and the owner’s pair').toMatchObject({
      coord, shared: FOREIGN, authors: `${OWNER},${OWNER_TA}`,
    });
    await expect(page.getByRole('table', { name: 'Items' }).getByRole('columnheader')).toHaveText(['#', 'Item', 'Filed by']);
    const rows = card.locator('.dict-items-row:not(.dict-items-row--head)');
    await expect(rows).toHaveCount(10);
    await expect(card.locator('.dict-items-range')).toHaveText('1–10 of 23');
    await expect(rows.first().locator('.dict-items-by')).toHaveAttribute('href', `/user/${TRUSTED_FILER}`);
    await expect(rows.first().locator('.dict-items-by')).toHaveText('Trusty');
    await card.getByRole('button', { name: 'Next' }).click();
    await expect(card.locator('.dict-items-range')).toHaveText('11–20 of 23');
    await card.getByRole('button', { name: 'Next' }).click();
    await expect(rows).toHaveCount(3);
    await expect(card.getByRole('button', { name: 'Next' })).toBeDisabled();

    await card.getByRole('button', { name: /Search & sort/ }).click();
    await card.getByPlaceholder('Search items').fill('zeb');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('.dict-items-n')).toHaveText('23');
    await card.getByPlaceholder('Search items').fill('trusty');
    await expect(rows, 'the keyword matches who filed it too').toHaveCount(10);
    await card.getByPlaceholder('Search items').fill('nothing like it');
    await expect(card.getByText('No items match “nothing like it”.')).toBeVisible();
    await card.getByPlaceholder('Search items').fill('');
    await card.locator('select').selectOption('za');
    await expect(rows.first().locator('.dict-items-item')).toHaveText('zebra');
    await expect(card.getByRole('button', { name: 'Customize' })).toBeDisabled();
    await expect(page.getByText(/2 more filed by people below the verified cutoff are not shown\./)).toBeVisible();

    await page.getByRole('button', { name: /^Curation/ }).click();
    const curation = page.locator('.dict-curation');
    await expect(curation.locator('.dict-strip-name')).toContainText('The owner’s Assistant');
    await expect(curation.getByText('Assigned to this Concept on the owner’s Treasure Map')).toBeVisible();
    const switches = curation.getByRole('switch');
    await expect(switches).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(switches.nth(i)).toBeDisabled();
      await expect(switches.nth(i)).toHaveAttribute('aria-checked', 'false');
    }

    const strip = page.locator('.dict-author-strip');
    await expect(strip).toContainText('A Shared Community Concept, authored by Fiona');
    await expect(strip).toContainText('0 members of the owner’s trusted, extended community file items under it.');
    await expect(strip.getByRole('button', { name: 'Veto' })).toBeDisabled();

    await page.getByRole('button', { name: 'Community Concept header' }).click();
    await expect(page.locator('#dict-community-header')).toContainText(FOREIGN);
    await expect(page.locator('#dict-community-header .dict-json')).toContainText('["d","shared-thing"]');
    await page.getByRole('button', { name: 'The owner’s Assistant’s header' }).click();
    await expect(page.locator('#dict-own-header')).toContainText(coord);
    await expect(page.locator('#dict-own-header').getByRole('link', { name: 'Open the concept →' })).toBeVisible();
  });

  test('D11: a Treasure Map that cannot be read names no curator, and says so', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page, { map: 'unreadable' });
    await page.goto(`${PAGE}/${encodeURIComponent(coordOf(OWNER_TA, 'cat-breed'))}`);
    const curation = page.locator('.dict-curation');
    await expect(curation.locator('.dict-items-count')).toHaveText('Could not read the Treasure Map');
    await page.getByRole('button', { name: /^Curation/ }).click();
    await expect(curation.getByText(/^Could not read the owner’s Treasure Map: /)).toBeVisible();
    await expect(curation.getByText('Curated by')).toHaveCount(0);
  });

  test('D12: a signed-in reader picks another of their Assistants, and the list is its Dictionary', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    await expect(page.getByRole('heading', { level: 1, name: 'Your Dictionary.' })).toBeVisible();
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await expect(trigger).toBeVisible();
    await trigger.click();
    const menu = page.getByRole('menu', { name: 'Whose Dictionary to show' });
    await expect(menu.getByRole('menuitemradio')).toHaveText([/Baz’s Assistant\s*Local/, /Robin/, /All of my Assistants/]);
    await expect(menu.getByRole('menuitemradio', { name: /Baz’s Assistant/ })).toHaveAttribute('aria-checked', 'true');
    await menu.getByRole('menuitemradio', { name: /Robin/ }).click();
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    await expect.poll(() => asked.at(-1), { message: 'Robin’s Dictionary is read for Robin alone' }).toBe(REMOTE_TA);
    expect(await names(page)).toEqual(['remote thing', 'remote only']);
    await expect(page.getByText('Read from this instance’s relay: Robin may keep more of its Dictionary on its own instance.')).toBeVisible();
    await page.getByRole('button', { name: /^Managed by Robin/ }).click();
    await page.getByRole('menuitemradio', { name: /Baz’s Assistant/ }).click();
    await expect(page).toHaveURL(/\/dictionary$/);
    await expect(page.getByText('1 concept in your Dictionary')).toBeVisible();
  });

  test('D13: All of my Assistants — one row per shared concept, with its support', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(`${PAGE}?managedBy=all`);
    await expect(page.getByText('2 concepts across your 2 Assistants')).toBeVisible();
    expect(await names(page)).toEqual(['customer thing', 'remote only']);
    const row = (name) => list(page).locator('.dict-row', { has: page.locator('.dict-row-name', { hasText: new RegExp(`^${name}$`) }) });
    await expect(row('customer thing').locator('.dict-support')).toHaveText('2 of 2 Assistants');
    await expect(row('remote only').locator('.dict-support')).toHaveText('1 of 2 Assistants');
    await expect(page.getByRole('button', { name: /^Managed by All of my Assistants/ })).toBeVisible();
    await expect(page.getByText(/^Read from this instance’s relay: your other Assistants may keep more/)).toBeVisible();
  });

  test('D14: a link to another Assistant’s Dictionary reads only that one, and its entry comes back to it', async ({ page }) => {
    const asked = await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    await mockAssistants(page);
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    expect(asked, 'never the reader’s own Dictionary first').toEqual([REMOTE_TA]);
    await list(page).getByRole('link', { name: /^remote thing/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'remote thing' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dictionary', exact: true })).toHaveAttribute('href', `/dictionary?managedBy=${REMOTE_TA}`);
    await expect(page.getByRole('button', { name: 'Robin’s header' })).toBeVisible();
  });

  test('D15: signed out it is a label; a link naming someone else’s Assistant falls back, and says so', async ({ page }) => {
    await mockStack(page);
    await page.goto(PAGE);
    await expect(page.locator('.bsd-managed')).toHaveText('Managed by The owner’s Assistant');
    await expect(page.getByRole('button', { name: /^Managed by/ })).toHaveCount(0);
    await page.goto(`${PAGE}?managedBy=nprofile1notavalidkey`);
    await expect(page.getByText(/concepts? in the owner’s Dictionary/)).toBeVisible();
    await expect(page.getByText(/so this is your own/)).toHaveCount(0);

    const page2 = await page.context().newPage();
    const asked = await mockStack(page2, { session: CUSTOMER });
    await mockAssistants(page2);
    await page2.goto(`${PAGE}?managedBy=${'9'.repeat(64)}`);
    await expect(page2.getByText('The link named a Dictionary that isn’t one of your Assistants’, so this is your own.')).toBeVisible();
    await expect(page2.getByText('1 concept in your Dictionary')).toBeVisible();
    expect(asked.at(-1)).toBe(`${CUST},${CUST_TA}`);
  });

  test('D16: an Assistant’s Dictionary that cannot be read is an error, never an empty Dictionary', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    let fail = true;
    await page.route('**/api/dictionaries/concepts?**', (r) => {
      const authors = new URL(r.request().url()).searchParams.get('authors');
      if (fail && authors === REMOTE_TA) return r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) });
      return r.fallback();
    });
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('Could not assemble Robin’s Dictionary: boom')).toBeVisible();
    await expect(page.getByText(/concepts? in Robin’s Dictionary/)).toHaveCount(0);
    await expect(page.getByText(/holds no concept headers from Robin/)).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
  });

  test('D17: when the reader’s Assistants cannot be read, the page says so, and Try again reads them', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    let fail = true;
    await page.route('**/api/assistant/my-assistants', (r) => (fail
      ? r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'down' }) })
      : r.fallback()));
    await page.goto(`${PAGE}?managedBy=${REMOTE_TA}`);
    await expect(page.getByText('Couldn’t load your Assistants, so this is your own Dictionary, not the one the link named.')).toBeVisible();
    await expect(page.getByText('1 concept in your Dictionary')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByText('2 concepts in Robin’s Dictionary')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Managed by Robin/ })).toBeVisible();
  });

  test('D18: the menu works from the keyboard', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const items = page.getByRole('menuitemradio');
    await expect(items.nth(0), 'focus moves to the chosen option').toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(items.nth(2)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(items.nth(0), 'wraps to the top').toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(trigger, 'Escape returns focus to the trigger').toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    await expect(page.getByRole('button', { name: /^Managed by Robin/ }), 'a pick returns focus to the trigger').toBeFocused();
  });

  test('D19: focus leaving for nowhere keeps the menu open, so a mouse pick lands; Escape on the trigger closes it', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockAssistants(page);
    await page.goto(PAGE);
    const trigger = page.getByRole('button', { name: /^Managed by Baz’s Assistant/ });
    await trigger.click();
    await expect(page.getByRole('menu')).toBeVisible();
    // Safari blurs a pressed button without focusing it: focus goes nowhere before the click lands.
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await expect(page.getByRole('menu'), 'still open').toBeVisible();
    await page.getByRole('menuitemradio', { name: /Robin/ }).click();
    await expect(page).toHaveURL(/\?managedBy=npub1/);
    const robin = page.getByRole('button', { name: /^Managed by Robin/ });
    await robin.click();
    await robin.focus();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu'), 'Escape on the trigger closes it').toHaveCount(0);
  });

  test('D20: an Items row opens its item page, which says where it is and who filed it', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);
    const card = page.locator('.dict-items');
    await expect(card.locator('.dict-items-count')).toHaveText('23 items');
    const link = card.getByRole('link', { name: 'item 03' });
    const id = String(3).padStart(64, '0');
    await expect(link).toHaveAttribute('href', `/dictionary/${encodeURIComponent(coord)}/items/${id}`);
    await card.locator('.dict-items-row', { has: page.getByRole('link', { name: 'item 04' }) }).locator('.dict-items-n').click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 04' }), 'a click anywhere on the row opens it').toBeVisible();
    await page.goBack();
    await link.click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 03' })).toBeVisible();
    await expect(page.getByText('Item 3 in cat breed')).toBeVisible();
    await expect(page.getByText('item 03 is one of the items the owner’s trusted community has filed under cat breed.')).toBeVisible();
    await expect(page.locator('.dict-filed-by-name')).toHaveText('Trusty');
    await expect(page.getByRole('link', { name: /View Nostr profile/ })).toHaveAttribute('href', `/user/${TRUSTED_FILER}`);
    await page.getByRole('button', { name: 'Raw Nostr event' }).click();
    await expect(page.locator('#dict-item-raw .dict-json')).toContainText('["name","item 03"]');
    const back = page.getByRole('link', { name: 'cat breed', exact: true });
    await expect(back).toHaveAttribute('href', `/dictionary/${encodeURIComponent(coord)}`);
    await back.click();
    await expect(page.getByRole('heading', { level: 1, name: 'cat breed' })).toBeVisible();
    await expect(page.locator('.dict-items .dict-items-count')).toHaveText('23 items');
  });

  test('D21: a direct visit works out the item’s number, and says when it isn’t in the trusted Items', async ({ page }) => {
    await mockStack(page);
    const itemsAsked = await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    const id5 = String(5).padStart(64, '0');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${id5}`);
    await expect(page.getByText('Item 5 in cat breed')).toBeVisible();
    expect(itemsAsked, 'the Items are read once, for the entry and its shared concept').toHaveLength(1);
    expect(itemsAsked[0]).toMatchObject({ coord, shared: FOREIGN });

    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${UNTRUSTED_ITEM}`);
    await expect(page.getByRole('heading', { level: 1, name: 'mystery' })).toBeVisible();
    await expect(page.locator('.dict-entry-sub')).toHaveText('Filed under cat breed');
    await expect(page.getByText('mystery is filed under cat breed, but not by anyone the owner’s community trusts, so it isn’t in the entry’s Items.')).toBeVisible();
  });

  test('D22: the item page says no more than it knows', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    // Filed under another concept: not "untrusted", and not "in" this one.
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${ELSEWHERE_ITEM}`);
    await expect(page.getByText('stray isn’t filed under cat breed.')).toBeVisible();
    await expect(page.getByText(/not by anyone/)).toHaveCount(0);
    await expect(page.getByText(/Filed under cat breed|Item \d+ in/)).toHaveCount(0);

    // A "%" in a d-tag: the router has decoded it once; the page must not decode it again and crash.
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${encodeURIComponent(`39999:${TRUSTED_FILER}:50%off`)}`);
    await expect(page.getByRole('heading', { level: 1, name: `39999:${TRUSTED_FILER}:50%off` })).toBeVisible();
    await expect(page.getByText('No event found for this item on this relay.').first()).toBeVisible();
    await expect(page.getByText(/Unexpected Application Error|URI malformed/)).toHaveCount(0);

    // The person's Dictionary can't be read: say so, and nothing about trust.
    const page2 = await page.context().newPage();
    await mockStack(page2);
    await mockEntry(page2);
    await page2.route('**/api/dictionaries/concepts?**', (r) => r.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'boom' }) }));
    await page2.goto(`${PAGE}/${encodeURIComponent(coord)}/items/${UNTRUSTED_ITEM}`);
    await expect(page2.getByText(/^Couldn’t read the owner’s Dictionary \(boom\)/)).toBeVisible();
    await expect(page2.getByText(/not by anyone/)).toHaveCount(0);
  });

  test('D23: a modified click on an Items row is left to the browser', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    const coord = coordOf(OWNER_TA, 'cat-breed');
    await page.goto(`${PAGE}/${encodeURIComponent(coord)}`);
    const row = page.locator('.dict-items .dict-items-row', { has: page.getByRole('link', { name: 'item 02' }) });
    await row.locator('.dict-items-n').click({ modifiers: ['ControlOrMeta'] });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(coord)}$`));
    await row.locator('.dict-items-n').click();
    await expect(page.getByRole('heading', { level: 1, name: 'item 02' })).toBeVisible();
  });

  test('D24: a signed-in customer creates a shared concept, signed by their own Assistant', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA });
    await page.goto(PAGE);
    await page.getByRole('link', { name: 'Create New Concept' }).click();
    await expect(page).toHaveURL(/\/dictionary\/new$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Create New Concept' })).toBeVisible();
    const create = page.getByRole('button', { name: 'Create concept' });
    await expect(create, 'both names first').toBeDisabled();
    await page.getByLabel('Singular name').fill('Taco Truck in Nashville');
    await page.getByLabel('Plural name').fill('Taco Trucks in Nashville');
    await page.getByLabel('Description').fill('Trucks that sell tacos.');
    const coord = `39998:${CUST_TA}:taco-truck-in-nashville`;
    await expect(page.locator('.dict-new-preview')).toContainText(`["b","${coord}","pointer"]`);
    await expect(page.getByText('Header your Assistant publishes (shared: its b-tag points to itself)')).toBeVisible();
    await expect(page.getByText(/Your Assistant publishes the header, marked as shared, so others can find it and adopt it\./)).toBeVisible();
    await expect(page.getByText(/Private/)).toHaveCount(0);
    await create.click();
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coord)}`);
    await expect(page.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward.')).toBeVisible();
    expect(created, 'one request, with the fields and no target').toEqual([
      { singular: 'Taco Truck in Nashville', plural: 'Taco Trucks in Nashville', description: 'Trucks that sell tacos.' },
    ]);
  });

  test('D25: a header this instance’s relay holds for the Assistant at that name isn’t replaced', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA, existing: true });
    await page.goto(`${PAGE}/new`);
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await page.getByRole('button', { name: 'Create concept' }).click();
    await expect(page.getByRole('alert')).toContainText('This instance’s relay already holds your Assistant’s concept header at this name');
    await expect(page.getByRole('link', { name: 'open the existing one' })).toHaveAttribute('href', `/dictionary/${encodeURIComponent(`39998:${CUST_TA}:bird`)}`);
    expect(created, 'the server was asked once, and refused').toHaveLength(1);
  });

  test('D26: the owner’s Assistant signs the same way; another key’s event isn’t broadcast; signed out it is disabled', async ({ page }) => {
    await mockStack(page, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    const created = await mockCreate(page, { assistant: OWNER_TA });
    await page.goto(`${PAGE}/new`);
    await expect(page.getByText('Header your Assistant publishes (shared: its b-tag points to itself)')).toBeVisible();
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await page.getByRole('button', { name: 'Create concept' }).click();
    await expect(page).toHaveURL(new RegExp(`/dictionary/${encodeURIComponent(`39998:${OWNER_TA}:bird`)}$`));
    expect(created).toEqual([{ singular: 'Bird', plural: 'Birds', description: '' }]);

    const page2 = await page.context().newPage();
    await mockStack(page2, { session: CUSTOMER });
    await mockCreate(page2, { assistant: CUST_TA, signer: 'f'.repeat(64) });
    await page2.goto(`${PAGE}/new`);
    await page2.getByLabel('Singular name').fill('Bird');
    await page2.getByLabel('Plural name').fill('Birds');
    await page2.getByRole('button', { name: 'Create concept' }).click();
    await expect(page2.getByRole('alert')).toContainText('The server signed with a different key from your Assistant’s.');
    await expect(page2).toHaveURL(/\/dictionary\/new$/);

    const page3 = await page.context().newPage();
    await mockStack(page3);
    await page3.goto(`${PAGE}/new`);
    await expect(page3.getByText('Sign in to create a concept.')).toBeVisible();
    await expect(page3.getByLabel('Singular name')).toBeDisabled();
    await expect(page3.getByRole('button', { name: 'Create concept' })).toBeDisabled();
  });

  test('D27: a broadcast that doesn’t land locks the form; Try again re-broadcasts it and opens its concept', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA, external: true });
    // A stand-in relay: refuses while window.__relayOk is false, then accepts. No real socket is opened.
    await page.addInitScript(() => {
      window.__relayOk = false;
      window.WebSocket = class {
        constructor(url) {
          this.url = url; this.readyState = 0;
          setTimeout(() => {
            if (window.__relayOk) { this.readyState = 1; this.onopen?.({}); }
            else { this.readyState = 3; this.onerror?.({}); this.onclose?.({ code: 1006, reason: '' }); }
          }, 5);
        }
        send(raw) {
          const msg = JSON.parse(raw);
          if (msg[0] === 'EVENT') setTimeout(() => this.onmessage?.({ data: JSON.stringify(['OK', msg[1].id, true, '']) }), 5);
        }
        close() { this.readyState = 3; }
        addEventListener(type, fn) { this[`on${type}`] = fn; }
        removeEventListener() {}
      };
      window.WebSocket.CONNECTING = 0; window.WebSocket.OPEN = 1; window.WebSocket.CLOSING = 2; window.WebSocket.CLOSED = 3;
    });
    await page.goto(`${PAGE}/new`);
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await page.getByRole('button', { name: 'Create concept' }).click();
    const status = page.getByRole('status').filter({ hasText: 'Created on this instance.' });
    await expect(status).toContainText("didn't reach the community relay"); // broadcastOutcome's own wording
    await expect(page.getByLabel('Singular name'), 'the form is locked once the header exists').toBeDisabled();
    await expect(page.getByRole('button', { name: 'Create concept' })).toBeDisabled();
    expect(created).toHaveLength(1);
    await page.evaluate(() => { window.__relayOk = true; });
    await status.getByRole('button', { name: 'Try again' }).click();
    const coord = `39998:${CUST_TA}:bird`;
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coord)}`);
    await expect(page.getByText('Submitted as a shared concept — published to the community relay.')).toBeVisible();
    expect(created, 'Try again re-broadcasts; it does not create again').toHaveLength(1);
    await page.reload();
    await expect(page.getByText('Submitted as a shared concept')).toHaveCount(0);
  });

  test('D28: GUM₂ — the list sorts by recognition, and the entry strip says who recognizes it', async ({ page }) => {
    await mockStack(page);
    await mockEntry(page);
    await page.goto(PAGE);
    await page.getByRole('button', { name: 'Search and sort' }).click();
    await page.getByLabel('Order by').selectOption({ label: 'General Usage Metric: recognition (highest first)' });
    expect(await list(page).locator('.dict-row-name').allTextContents()).toEqual(['dog', 'cat breed', 'owner signed']);
    expect(await list(page).locator('.dict-row-gum').allTextContents()).toEqual(['1.50', '0.75', '0.00']);
    await expect(page.getByText(/General Usage Metric, recognition \(GUM₂\):/)).toBeVisible();

    await list(page).getByRole('link', { name: /^cat breed/ }).click();
    const strip = page.locator('.dict-author-strip');
    await expect(strip).toContainText('Recognized by 2 members of the owner’s trusted, extended community (GUM₂ 0.75).');
    await expect(strip).toContainText('0 members of the owner’s trusted, extended community file items under it.');
  });

  test('D29: from the finder, Create New Concept is wired to the shared concept, and the reader’s Assistant creates it', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA });
    await page.goto(PAGE);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await page.getByRole('searchbox').fill('taco');
    await page.getByRole('button', { name: 'Add to Dictionary' }).click();
    await expect(page.getByText(/Your Assistant adds Taco Truck by publishing a concept of your own, wired to it/)).toBeVisible();
    await expect(page.getByLabel('Your twin concept'), 'the twin picker is the owner’s').toHaveCount(0);
    const link = page.locator('.dict-add').getByRole('link', { name: 'Create New Concept' });
    await expect(link).toHaveAttribute('href', `/dictionary/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    await link.click();

    await expect(page).toHaveURL(new RegExp(`/dictionary/new\\?wire=${encodeURIComponent(SHARED_COORD)}$`));
    await expect(page.getByLabel('Singular name'), 'it starts from the shared concept').toHaveValue('Taco Truck');
    await expect(page.getByLabel('Plural name')).toHaveValue('Taco Trucks');
    await expect(page.getByLabel('Description')).toHaveValue('Trucks that sell tacos.');
    await expect(page.locator('.dict-new-wired')).toContainText('Taco Truck');
    await expect(page.getByText('Header your Assistant publishes (wired: its b-tag points to the shared concept)')).toBeVisible();
    await expect(page.locator('.dict-new-preview')).toContainText(`["b","${SHARED_COORD}","pointer"]`);
    await page.getByLabel('Singular name').fill('Taco Truck in Nashville');
    // A copy of the shared header: its tags, but the copy's own d, slug, names and b, and no json or concept-graph.
    const preview = page.locator('.dict-new-preview');
    await expect(preview).toContainText('["d","taco-truck-in-nashville"]');
    await expect(preview).toContainText('["slug","taco-truck-in-nashville"]');
    await expect(preview).toContainText('["required","url"]');
    await expect(preview).toContainText('["field-type","url","url"]');
    await expect(preview).not.toContainText('"json"');
    await expect(preview).not.toContainText('concept-graph');
    await page.getByLabel('Plural name').fill('Taco Trucks in Nashville');
    await page.getByRole('button', { name: 'Create concept' }).click();
    const coord = `39998:${CUST_TA}:taco-truck-in-nashville`;
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(coord)}`);
    await expect(page.getByText('Wired here. External publishing is off for this deployment, so it was not sent onward.')).toBeVisible();
    expect(created).toEqual([{
      singular: 'Taco Truck in Nashville', plural: 'Taco Trucks in Nashville', description: 'Trucks that sell tacos.', target: SHARED_COORD,
      copyFrom: SHARED_HEADER.id,
    }]);

    // The owner: the twin picker, and the same link under it.
    const owner = await page.context().newPage();
    await mockStack(owner, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    await mockCreate(owner, { assistant: OWNER_TA });
    await owner.route('**/api/adoption-twins', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, twins: [] }) }));
    await owner.goto(PAGE);
    await owner.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await owner.getByRole('searchbox').fill('taco');
    await owner.getByRole('button', { name: 'Add to Dictionary' }).click();
    await expect(owner.getByLabel('Your twin concept')).toBeVisible();
    await expect(owner.locator('.dict-add-foot')).toContainText('No matching concept of your own? Create New Concept, wired to this one.');
    await expect(owner.locator('.dict-add').getByRole('link', { name: 'Create New Concept' }))
      .toHaveAttribute('href', `/dictionary/new?wire=${encodeURIComponent(SHARED_COORD)}`);

    // Signed out: no Add, and the finder says to sign in.
    const out = await page.context().newPage();
    await mockStack(out);
    await mockCreate(out, { assistant: OWNER_TA });
    await out.goto(PAGE);
    await out.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await expect(out.getByText('Sign in to add a concept from here.')).toBeVisible();
    await out.getByRole('searchbox').fill('taco');
    await expect(out.locator('.dict-find-name', { hasText: 'Taco Truck' })).toBeVisible();
    await expect(out.getByRole('button', { name: 'Add to Dictionary' })).toHaveCount(0);
  });

  test('D37: Create never skips the copy: it waits for the read, refuses an unreachable relay, and re-reads a replaced version', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA });
    const json = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    // A slow community read: Create waits for it.
    let release;
    const gate = new Promise((ok) => { release = ok; });
    let reads = 0;
    await page.route('**/api/relay/external**', async (r) => {
      reads += 1;
      if (reads === 1) await gate;
      return json(r, { success: true, events: [SHARED_HEADER] });
    });
    await page.goto(`${PAGE}/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    await page.getByLabel('Singular name').fill('Taco Truck');
    await page.getByLabel('Plural name').fill('Taco Trucks');
    await expect(page.getByRole('button', { name: 'Create concept' }), 'not while the shared header is being read').toBeDisabled();
    release();
    await expect(page.locator('.dict-new-preview')).toContainText('["required","url"]');
    await expect(page.getByRole('button', { name: 'Create concept' })).toBeEnabled();
    expect(new URL(page.url()).searchParams.get('wire')).toBe(SHARED_COORD);

    // The community relay unreachable (and this instance's relay without the header): said so, and no create.
    const down = await page.context().newPage();
    await mockStack(down, { session: CUSTOMER });
    await mockCreate(down, { assistant: CUST_TA });
    let up = false;
    await down.route('**/api/relay/external**', (r) => (up
      ? json(r, { success: true, events: [SHARED_HEADER] })
      : json(r, { success: false, events: [], error: 'Could not read wss://dcosl.brainstorm.world', unreachable: ['wss://dcosl.brainstorm.world'] })));
    await down.goto(`${PAGE}/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    const alert = down.getByRole('alert').filter({ hasText: 'Couldn’t reach the community relay' });
    await expect(alert).toContainText('so its tags can’t be copied now');
    await expect(down.getByText('Its header wasn’t found')).toHaveCount(0);
    await down.getByLabel('Singular name').fill('Taco Truck');
    await down.getByLabel('Plural name').fill('Taco Trucks');
    await expect(down.getByRole('button', { name: 'Create concept' })).toBeDisabled();
    up = true;
    await alert.getByRole('button', { name: 'Try again' }).click();
    await expect(down.locator('.dict-new-preview')).toContainText('["field-type","url","url"]');
    await expect(down.getByRole('button', { name: 'Create concept' })).toBeEnabled();

    // A replaced version: the server says so, the page reads the header again before Create is offered again.
    const stale = await page.context().newPage();
    await mockStack(stale, { session: CUSTOMER });
    const asked = await mockCreate(stale, { assistant: CUST_TA });
    let staleReads = 0;
    let hold;
    await stale.route('**/api/relay/external**', async (r) => {
      staleReads += 1;
      if (staleReads === 2) await new Promise((ok) => { hold = ok; });
      return json(r, { success: true, events: [SHARED_HEADER] });
    });
    await stale.route('**/api/dictionaries/concepts/new', (r) => {
      asked.push(JSON.parse(r.request().postData() || '{}'));
      return json(r, { success: false, code: 'source-missing', error: 'gone' }, 409);
    });
    await stale.goto(`${PAGE}/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    await expect(stale.locator('.dict-new-preview')).toContainText('["required","url"]');
    await stale.getByRole('button', { name: 'Create concept' }).click();
    await expect(stale.getByRole('alert').filter({ hasText: 'changed after this page read it' })).toBeVisible();
    await expect(stale.getByRole('button', { name: 'Create concept' }), 'not until it has been read again').toBeDisabled();
    await expect.poll(() => staleReads).toBe(2);
    hold();
    await expect(stale.getByRole('button', { name: 'Create concept' })).toBeEnabled();
    expect(asked.every((b) => b.copyFrom === SHARED_HEADER.id), 'every request names the version it copies').toBe(true);
    expect(created).toHaveLength(0);
  });

  test('D30: signed in with no Assistant here, the page says so, points to Account Setup, and can’t create', async ({ page }) => {
    await mockStack(page, { session: { pubkey: ADMIN_NO_TA, assistantPubkey: null, classification: 'admin' } });
    const created = await mockCreate(page, { assistant: null });
    await page.goto(`${PAGE}/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    await expect(page.getByText('You don\'t have a Tapestry Assistant on this instance yet.', { exact: false })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to Account Setup →' })).toHaveAttribute('href', '/setup');
    await expect(page.getByLabel('Singular name')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Create concept' })).toBeDisabled();
    expect(created).toHaveLength(0);

    await page.goto(PAGE);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await page.getByRole('searchbox').fill('taco');
    await page.getByRole('button', { name: 'Add to Dictionary' }).click();
    await expect(page.locator('.dict-add')).toContainText('You don\'t have a Tapestry Assistant on this instance yet.');
    await expect(page.locator('.dict-add')).not.toContainText('Your Assistant adds');
  });

  test('D32: Edit sits beside the title only for the reader’s own Assistant’s header', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    await mockEdit(page);
    await page.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}`);
    const edit = page.locator('.dict-entry-titlerow').getByRole('link', { name: 'Edit' });
    await expect(edit).toBeVisible();
    await expect(edit).toHaveAttribute('href', `/dictionary/${encodeURIComponent(EDIT_COORD)}/edit`);
    await expect(edit).toHaveClass(/dict-pill-btn--quiet/);

    // Signed out, on the owner's Assistant's header: no Edit.
    const out = await page.context().newPage();
    await mockStack(out);
    await mockEntry(out);
    await out.goto(`${PAGE}/${encodeURIComponent(coordOf(OWNER_TA, 'cat-breed'))}`);
    await expect(out.locator('.dict-entry-title')).toHaveText('cat breed');
    await expect(out.getByRole('link', { name: 'Edit' })).toHaveCount(0);

    // Signed in, on another Assistant's header (from Managed by): no Edit.
    const other = await page.context().newPage();
    await mockStack(other, { session: CUSTOMER });
    await mockEntry(other);
    await other.goto(`${PAGE}/${encodeURIComponent(coordOf(REMOTE_TA, 'remote-thing'))}`);
    await expect(other.locator('.dict-entry-title')).toBeVisible();
    await expect(other.getByRole('link', { name: 'Edit' })).toHaveCount(0);

    // The control panel's entry page: no Edit, even for the reader's own Assistant's header.
    const panel = await page.context().newPage();
    await mockStack(panel, { session: CUSTOMER });
    await mockEntry(panel);
    await panel.goto(`/tapestry/dictionaries/concepts/${encodeURIComponent(EDIT_COORD)}`);
    await expect(panel.locator('.dict-entry-title')).toBeVisible();
    await expect(panel.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  });

  test('D33: the edit page changes names, description and Item Property Tags, and keeps the rest', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    const asked = await mockEdit(page);
    await page.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}`);
    await page.locator('.dict-entry-titlerow').getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Edit concept' })).toBeVisible();
    await expect(page.getByLabel('Singular name')).toHaveValue('customer thing');
    await expect(page.getByLabel('Plural name')).toHaveValue('customer things');
    await expect(page.getByLabel('Description')).toHaveValue('A thing.');
    const props = page.getByRole('list', { name: 'Item Property Tags' });
    await expect(props.getByRole('listitem')).toHaveCount(1);
    const save = page.getByRole('button', { name: 'Save changes' });
    await expect(save, 'nothing changed yet').toBeDisabled();

    await page.getByLabel('Singular name').fill('Customer Thing');
    await page.getByLabel('Plural name').fill('Customer Things');
    await page.getByLabel('Description').fill('A better thing.');
    await props.getByRole('button', { name: 'Remove required name' }).click();
    await page.getByLabel('Requirement').selectOption('optional');
    await page.getByLabel('New Item Property Tag').fill('url');
    await page.getByLabel('New Item Property Tag').press('Enter');
    await expect(props.getByRole('listitem')).toHaveCount(1);
    await expect(props).toContainText('optional');
    const preview = page.locator('.dict-new-preview');
    await expect(preview).toContainText(`["d","${EDIT_D}"]`);
    await expect(preview).toContainText('["names","Customer Thing","Customer Things"]');
    await expect(preview).toContainText('["optional","url"]');
    await expect(preview).toContainText(`["b","${FOREIGN}","pointer"]`);
    await expect(preview).not.toContainText('["required","name"]');
    await save.click();

    await expect(page).toHaveURL(`${new URL(page.url()).origin}/dictionary/${encodeURIComponent(EDIT_COORD)}`);
    await expect(page.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward.')).toBeVisible();
    expect(asked).toEqual([{
      coord: EDIT_COORD, basedOn: EDIT_BASE.id, singular: 'Customer Thing', plural: 'Customer Things', description: 'A better thing.',
      properties: [['optional', 'url']],
    }]);
  });

  test('D34: a header that changed meanwhile isn’t overwritten, and starting again is the reader’s choice', async ({ page }) => {
    const newer = { ...EDIT_BASE, id: '9d'.repeat(32), created_at: EDIT_BASE.created_at + 9, tags: [['d', EDIT_D], ['names', 'renamed thing', 'renamed things'], ['b', FOREIGN, 'pointer']] };
    await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    const asked = await mockEdit(page, { changed: newer });
    await page.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await page.getByLabel('Description').fill('Mine.');
    await page.getByRole('button', { name: 'Save changes' }).click();
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('This concept changed after this page loaded it, so nothing was saved.');
    await expect(page.getByLabel('Description'), 'the reader’s text is still there until they choose').toHaveValue('Mine.');
    await expect(page.getByLabel('Description')).toBeDisabled();
    await alert.getByRole('button', { name: 'Start again from the latest version' }).click();
    await expect(page.getByLabel('Singular name')).toHaveValue('renamed thing');
    await expect(page.getByLabel('Description')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(asked).toHaveLength(1);
  });

  test('D35: a firmware concept warns; signed out or someone else’s header, the page says why it can’t edit', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    await mockEdit(page);
    // The Dictionary read says the row's own header is a firmware one (the server's firmwareHeader).
    await page.route('**/api/dictionaries/concepts**', (r) => {
      const url = new URL(r.request().url());
      if (url.pathname !== '/api/dictionaries/concepts') return r.fallback();
      const authors = (url.searchParams.get('authors') || '').split(',').filter(Boolean);
      const entries = dictionaryFor(authors).map((e) => (e.coord === EDIT_COORD ? { ...e, isFirmware: true, firmwareHeader: true } : e));
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, metric: 'gum1', authors, entries, pov: { branch: 'house' } }) });
    });
    await page.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await expect(page.getByRole('note')).toContainText('This is a firmware concept. A firmware reinstall rebuilds its header from the built-in definition, which will undo these edits.');

    // A firmware header that isn't a Dictionary row (no real b): the server says so from its address.
    const loose = await page.context().newPage();
    await mockStack(loose, { session: CUSTOMER });
    await mockEntry(loose);
    const set = { ...EDIT_BASE, tags: [['d', 'set'], ['names', 'set', 'sets']] };
    await mockEdit(loose, { base: set, firmware: true });
    await loose.goto(`${PAGE}/${encodeURIComponent(`39998:${CUST_TA}:set`)}/edit`);
    await expect(loose.getByRole('note').filter({ hasText: 'This is a firmware concept.' })).toBeVisible();

    const out = await page.context().newPage();
    await mockStack(out);
    await mockEntry(out);
    await mockEdit(out);
    await out.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await expect(out.getByText('Sign in to edit this concept.')).toBeVisible();
    await expect(out.getByLabel('Singular name')).toBeDisabled();
    await expect(out.getByRole('button', { name: 'Save changes' })).toBeDisabled();

    const owner = await page.context().newPage();
    await mockStack(owner, { session: { pubkey: OWNER, assistantPubkey: OWNER_TA, classification: 'owner' } });
    await mockEntry(owner);
    await mockEdit(owner);
    await owner.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await expect(owner.getByText('This concept’s header was published by someone other than your Assistant, so your Assistant can’t edit it.')).toBeVisible();
    await expect(owner.getByLabel('Singular name')).toBeDisabled();
  });

  test('D36: name-keyed and taken names, and the graph’s and broadcast’s outcomes said once', async ({ page }) => {
    // A concept the server finds by name: its singular name stays, the rest can change.
    await mockStack(page, { session: CUSTOMER });
    await mockEntry(page);
    const keyed = { ...EDIT_BASE, tags: [['d', 'shared-concept'], ['names', 'shared concept', 'shared concepts'], ['b', FOREIGN, 'pointer']] };
    await mockEdit(page, { base: keyed });
    await page.goto(`${PAGE}/${encodeURIComponent(`39998:${CUST_TA}:shared-concept`)}/edit`);
    await expect(page.getByLabel('Singular name')).toHaveAttribute('readonly', '');
    await expect(page.getByRole('note').filter({ hasText: 'finds “shared concept” by its name' })).toBeVisible();
    await expect(page.getByLabel('Plural name')).toBeEditable();

    // Created without a description, so its json holds a default one: opening it changes nothing.
    const plain = await page.context().newPage();
    await mockStack(plain, { session: CUSTOMER });
    await mockEntry(plain);
    const json = JSON.stringify({ conceptHeader: { description: 'Customer Thing is a concept.', oNames: { singular: 'customer thing', plural: 'customer things' } } });
    await mockEdit(plain, { base: { ...EDIT_BASE, tags: [['d', EDIT_D], ['names', 'customer thing', 'customer things'], ['json', json], ['b', FOREIGN, 'pointer']] } });
    await plain.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await expect(plain.getByLabel('Singular name')).toHaveValue('customer thing');
    await expect(plain.getByRole('button', { name: 'Save changes' }), 'nothing to save until something changes').toBeDisabled();

    // A name another concept has: refused, with a link to it.
    const other = coordOf(CUST_TA, 'cat');
    const t = await page.context().newPage();
    await mockStack(t, { session: CUSTOMER });
    await mockEntry(t);
    await mockEdit(t, { taken: other });
    await t.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await t.getByLabel('Singular name').fill('cat');
    await t.getByRole('button', { name: 'Save changes' }).click();
    await expect(t.getByRole('alert')).toContainText('Your Assistant already has a concept named “cat”');
    await expect(t.getByRole('link', { name: 'open that concept' })).toHaveAttribute('href', `/dictionary/${encodeURIComponent(other)}`);

    // The graph didn't follow: the entry says so, after the broadcast's outcome.
    const g = await page.context().newPage();
    await mockStack(g, { session: CUSTOMER });
    await mockEntry(g);
    await mockEdit(g, { graph: 'failed' });
    await g.goto(`${PAGE}/${encodeURIComponent(EDIT_COORD)}/edit`);
    await g.getByLabel('Description').fill('Changed.');
    await g.getByRole('button', { name: 'Save changes' }).click();
    await expect(g.getByText('Saved here. External publishing is off for this deployment, so it was not sent onward. This instance’s graph wasn’t fully updated, so the control panel may show the old version, or an incomplete one.')).toBeVisible();
  });

  test('D31: the page and the finder say what they can’t do', async ({ page }) => {
    await mockStack(page, { session: CUSTOMER });
    const created = await mockCreate(page, { assistant: CUST_TA });
    await page.goto(`${PAGE}/new?wire=taco`);
    await expect(page.getByText('This link doesn’t name a shared concept (a list header’s address), so this creates a concept of its own.')).toBeVisible();
    await expect(page.locator('.dict-new-wired')).toHaveCount(0);

    const head = `39998:${SHARER}:`;
    const long = head + 'x'.repeat(256 - head.length);
    await page.goto(`${PAGE}/new?wire=${encodeURIComponent(long)}`);
    await expect(page.getByText(/This shared concept’s address is longer than this instance’s relay can look up \(255 bytes\)/)).toBeVisible();
    await page.getByLabel('Singular name').fill('Bird');
    await page.getByLabel('Plural name').fill('Birds');
    await expect(page.locator('.dict-new-preview'), 'a concept of its own').toContainText(`["b","39998:${CUST_TA}:bird","pointer"]`);

    await page.getByLabel('Singular name').fill('a'.repeat(185));
    await expect(page.getByText('The singular name is too long: its d-tag would be 185 characters, and this instance’s relay can look up at most 184.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create concept' })).toBeDisabled();

    await page.route('**/api/relay/external**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [] }) }));
    await page.goto(`${PAGE}/new?wire=${encodeURIComponent(SHARED_COORD)}`);
    await expect(page.getByText('Its header wasn’t found on this instance’s relay or the community relay, so fill in the names yourself.')).toBeVisible();
    await expect(page.getByLabel('Singular name')).toHaveValue('');
    expect(created).toHaveLength(0);

    // The finder: a concept whose address is too long is listed, without Add.
    const longHeader = { ...SHARED_HEADER, id: 'c'.repeat(64), tags: [['d', long.slice(head.length)], ['names', 'Taco Stand', 'Taco Stands'], ['b', long, 'pointer']] };
    await page.route('**/api/relay/external**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, events: [longHeader] }) }));
    await page.goto(PAGE);
    await page.getByRole('button', { name: /Don’t see what you’re looking for\?/ }).click();
    await page.getByRole('searchbox').fill('taco');
    await expect(page.locator('.dict-find-name', { hasText: 'Taco Stand' })).toBeVisible();
    await expect(page.getByText('Its address is too long for this instance’s relay to look up, so it can’t be added.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add to Dictionary' })).toHaveCount(0);
  });

  test('D9: with a setup step left, the Setup Alert is centred in the bar and the avatar sits at its right', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockStack(page, { session: CUSTOMER });
    await page.route('**/api/setup/status**', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({
        success: true, signedIn: true,
        steps: { account: { done: true }, follow: { done: false, pending: true }, activate: { done: false, pending: true } },
      }),
    }));
    await page.goto(PAGE);
    const alert = page.locator('.bsd-nav .bs-setup-alert');
    await expect(alert).toBeVisible();
    const bar = await page.locator('.bsd-nav').boundingBox();
    const pill = await alert.boundingBox();
    const avatar = await page.locator('.bsd-nav .bs-usermenu').boundingBox();
    expect(Math.abs((pill.x + pill.width / 2) - (bar.x + bar.width / 2)), 'the pill is centred').toBeLessThan(4);
    expect(avatar.x, 'the avatar is right of the pill').toBeGreaterThan(pill.x + pill.width);
    expect(bar.x + bar.width - (avatar.x + avatar.width), 'and near the right edge').toBeLessThan(40);
  });
});
