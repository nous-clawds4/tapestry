/**
 * assistant-profile #3: One default profile for every assistant.
 *
 * Story: engineering-team/stories/assistant-profile/3-one-default-assistant-profile.md
 * ADR:   engineering-team/decisions/assistant-profile/0003-one-role-free-default-profile.md
 * Plan:  engineering-team/stories/assistant-profile/3-one-default-assistant-profile.test-plan.md
 * Browser half: tests/brainstorm/assistant-default-profile.spec.js (B-class — what the editor and the
 * dashboard DO).
 *
 * Classes (all stack-free — no strfry, no Neo4j, no relay traffic):
 *   I — the instance: the story's "public instance" rule (isPublicDomain), what describeInstance
 *       makes of the configured domain, and index.js's isPubliclyReachable, which the badged
 *       avatar's publishable URL is gated on (OPEN.md row 148).
 *   N — the person's name: nameFromProfileEvent and resolvePersonName with injected relays. N9 goes
 *       through the real settings module and a temp settings file ("the instance's profile relays").
 *   D — the one definition: buildDefaultProfile, pure, against the story's table and the owner's
 *       verbatim about text; D6 goes through index.js's exported buildDefaultProfileContent.
 *   F — the finishing step every published profile passes through: finalizeAssistantProfile.
 *   Q — the status answer, through its new seam (createAssistantStatusHandler): what an Owner, an
 *       Admin and a Customer are offered, who may make the name lookup reach relays, defaults=0.
 *   E — the publish handler, through ADR 0002's seam (createPublishProfileHandler): the signed kind 0
 *       itself — content and tags — for a default and an edited profile, public and not.
 *   W — the browser code, by source: the CI-enforced backstop for the B-class.
 *   S — server source sentinels for what the others cannot reach.
 *   R — regression guards: pass before and after.
 *
 * Against current code everything FAILS except the R guards: profileDefaults.js does not exist, the
 * status handler has no seam, the publish handler still builds the two-branch default, adds no client
 * tag and always sets a NIP-05, and the dashboard and editor still supply their own values.
 *
 * Re-aimed by assistant-profile #5 (ADR 0005): a publish must now carry content, and only the person an
 * assistant belongs to may publish it. E1, E3, E5 and E6 publish the default the way the page does (the
 * offered table, as content); E7's guard moves to the status seam, where the definition is now offered;
 * E8 expects the Owner to be refused a Customer's assistant; W2 and R1 expect the dashboard and the
 * legacy pages to publish nothing.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { nip19, generateSecretKey, getPublicKey } = require('nostr-tools');

const REPO = path.resolve(__dirname, '..');
const DEFAULTS_MOD = path.join(REPO, 'src/api/assistant/profileDefaults.js');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const PUBLISH_MOD = path.join(REPO, 'src/api/assistant/profilePublish.js');
const SETTINGS_MOD = path.join(REPO, 'src/config/settings.js');
const HOOK = path.join(REPO, 'ui/src/hooks/useAssistantSetupState.js');
const DASHBOARD = path.join(REPO, 'ui/src/pages/Dashboard.jsx');
const EDITOR = path.join(REPO, 'ui/src/components/AssistantProfileEditor.jsx');
const NIP85_PAGE = path.join(REPO, 'public/pages/nip85.html');
const CUSTOMER_PAGE = path.join(REPO, 'public/pages/customers/customer.html');

// Fixture keys — never live ones.
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const STRANGER = 'dd'.repeat(32);
const TA = 'aa'.repeat(32);
const ADMIN_ASSISTANT = 'a1'.repeat(32);
const CUSTOMER_ASSISTANT = 'c1'.repeat(32);
const ASSISTANT_OF = { [OWNER]: TA, [ADMIN]: ADMIN_ASSISTANT, [CUSTOMER]: CUSTOMER_ASSISTANT };
const NAMES = { [OWNER]: 'Olivia', [ADMIN]: 'Adam', [CUSTOMER]: 'Carmen' };

// The story's table, ratified 2026-09-11.
const REFERENCE_AVATAR = 'https://tapestry.brainstorm.world/ta-avatar.png';
const PUBLIC = {
  domain: 'staging.brainstorm.world',
  isPublic: true,
  website: 'https://staging.brainstorm.world',
  avatarUrl: 'https://staging.brainstorm.world/ta-avatar.png',
};
const NOT_PUBLIC = { domain: 'localhost:7777', isPublic: false, website: '', avatarUrl: REFERENCE_AVATAR };

// The owner's about text, verbatim (the story's two quoted paragraphs, each quoted line joined by a space).
const ABOUT_SECOND_PARAGRAPH = 'I use social proof, such as decentralized lists, tags, follows, mutes, reports, and more, '
  + 'to curate data for my owner and publish it in a variety of formats including kind 3038x Trusted Assertions, '
  + 'kind 3039x Trusted Lists, and kind 39999 items on decentralized lists. This means that my owner\'s '
  + 'personalized trust metrics are available to any client that supports NIP-85 and related custom NIPs '
  + 'including Decentralized Lists and Trusted Lists.';

// ADR 0003 (and ADR 0001's relay budget, which it reuses).
const RELAY_BUDGET_MS = 4000;
const BACKSTOP_MS = RELAY_BUDGET_MS + 1000;
const NAME_MEMO_MS = 10 * 60 * 1000;
const SLACK_MS = 1500;

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);

/** JSON with keys sorted, so two objects compare by content whatever their key order. */
function canon(v) {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object') return Object.keys(v).sort().reduce((o, k) => { o[k] = canon(v[k]); return o; }, {});
  return v;
}
const same = (a, b) => j(canon(a)) === j(canon(b));

// ─── What the story's table says, computed from the spec — never from the code under test ───

function npubOf(pubkey) { return nip19.npubEncode(pubkey); }
function aboutFor(name, npub) {
  const whom = name ? `${name} (${npub})` : npub;
  return `I am the Tapestry Assistant for ${whom}. You can find my pubkey in my owner's kind 10040 event.\n\n${ABOUT_SECOND_PARAGRAPH}`;
}
function assistantNameFor(name, npub) { return `${name || `npub...${npub.slice(-6)}`}'s Tapestry Assistant`; }
/** The default as the status endpoint offers it (every editable key present, empty where the table says so). */
function tableFor(personPubkey, name, instance) {
  const npub = npubOf(personPubkey);
  const assistantName = assistantNameFor(name, npub);
  return {
    name: assistantName,
    display_name: assistantName,
    about: aboutFor(name, npub),
    picture: instance.isPublic ? `https://${instance.domain}/ta-avatar.png` : REFERENCE_AVATAR,
    banner: '',
    website: instance.isPublic ? `https://${instance.domain}` : '',
    nip05: '',
    lud16: '',
  };
}
/** The NIP-05 local-part, format unchanged (story, Out of scope) — for the simple ASCII fixture names. */
function localPartFor(name, assistantPubkey) {
  const suffix = assistantPubkey.slice(-6);
  return name ? `${name.toLowerCase()}-tapestry-assistant-${suffix}` : `tapestry-assistant-${suffix}`;
}
/** The default as it is signed: empty fields dropped, NIP-05 only on a public instance. */
function signedDefaultFor(personPubkey, name, assistantPubkey, instance) {
  const out = {};
  for (const [k, v] of Object.entries(tableFor(personPubkey, name, instance))) {
    if (k !== 'nip05' && v !== '') out[k] = v;
  }
  if (instance.isPublic) out.nip05 = `${localPartFor(name, assistantPubkey)}@${instance.domain}`;
  return out;
}

// ─── The modules under test — or a failure that says exactly what is missing ───

function getDefaultsModule() {
  if (!fs.existsSync(DEFAULTS_MOD)) {
    throw new Error('src/api/assistant/profileDefaults.js does not exist. ADR 0003 creates it: the public-instance rule ' +
      '(isPublicDomain, describeInstance), the person\'s name (nameFromProfileEvent, resolvePersonName), the one definition ' +
      '(buildDefaultProfile) and the finishing step every publish passes through (finalizeAssistantProfile).');
  }
  return require(DEFAULTS_MOD);
}
function need(mod, name) {
  if (typeof mod[name] !== 'function') {
    throw new Error(`src/api/assistant/profileDefaults.js does not export ${name}() (ADR 0003 § Implementation notes).`);
  }
  return mod[name];
}
function getIndex() { return require(ASSISTANT_SRC); }
function getStatusFactory() {
  const mod = getIndex();
  if (typeof mod.createAssistantStatusHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createAssistantStatusHandler(deps). ADR 0003 gives the status ' +
      'handler a dependency seam — the way ADR 0002 did the publish handler — so what each role is offered can be checked ' +
      'without a key store, strfry or relays.');
  }
  return mod.createAssistantStatusHandler;
}
function getPublishFactory() {
  const mod = getIndex();
  if (typeof mod.createPublishProfileHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createPublishProfileHandler(deps) (ADR 0002).');
  }
  return mod.createPublishProfileHandler;
}

/** A config reader answering from `values`, else the caller's default — getConfigFromFile's contract. */
const config = (values) => (name, fallback) => (Object.prototype.hasOwnProperty.call(values, name) ? values[name] : fallback);

/** A kind 0 as a relay or strfry would hand it back. */
function kind0(pubkey, createdAt, content, extra = {}) {
  return { id: `${pubkey.slice(0, 8)}-${createdAt}`, pubkey, kind: 0, created_at: createdAt, tags: [], content: typeof content === 'string' ? content : JSON.stringify(content), sig: '0'.repeat(128), ...extra };
}

/** Resolve within `ms`, or report 'HUNG' — clearing the timer either way. */
async function within(promise, ms) {
  let timer;
  const hung = new Promise((resolve) => { timer = setTimeout(() => resolve('HUNG'), ms); });
  try { return await Promise.race([promise, hung]); } finally { clearTimeout(timer); }
}

/** The source of a top-level function, up to the next top-level declaration. */
function functionBody(src, name) {
  const start = src.search(new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`));
  if (start < 0) return '';
  const rest = src.slice(start + 1);
  const next = rest.search(/\n(?:async\s+function|function|const|let|module\.exports)\b/);
  return next < 0 ? src.slice(start) : src.slice(start, start + 1 + next);
}

/** Source with comments removed, leaving `https://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

function jsFilesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') out.push(...jsFilesUnder(p)); } else if (/\.(c|m)?js$/.test(entry.name)) out.push(p);
  }
  return out;
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

/* ───────────────────────── I — the instance ───────────────────────── */

test('I1: the story\'s public examples are public — a real domain, with or without a port, and public IP literals', () => {
  const isPublicDomain = need(getDefaultsModule(), 'isPublicDomain');
  for (const domain of ['staging.brainstorm.world', 'tapestry.brainstorm.world', 'relay.example.com:4443', '8.8.8.8', '[2606:4700:4700::1111]']) {
    assert(isPublicDomain(domain) === true, `"${domain}" is reachable from the public internet, so the instance is public — got ${j(isPublicDomain(domain))}`);
  }
});

test('I2: every class the story excludes is not public — loopback, private-network, IPv6 ULA, .local/.internal/.home.arpa names, a bare hostname — nor is anything empty or unparseable', () => {
  const isPublicDomain = need(getDefaultsModule(), 'isPublicDomain');
  const cases = {
    'loopback': ['localhost', 'localhost:7777', 'dev.localhost', '127.0.0.1', '127.0.0.1:7777', '[::1]', '[::1]:7777'],
    'private network (10/8, 172.16/12, 192.168/16)': ['10.0.0.5', '172.16.4.2', '172.31.255.1', '192.168.1.50', '192.168.1.50:7777'],
    'IPv6 ULA': ['[fd12:3456::1]', '[fc00::1]:7777'],
    'a private name': ['nas.internal', 'box.local', 'router.home.arpa'],
    'a bare hostname': ['myhost', 'myhost:7777'],
    'empty or unparseable': ['', '   ', 'bad host name'],
  };
  const wrong = [];
  for (const [kind, domains] of Object.entries(cases)) {
    for (const domain of domains) if (isPublicDomain(domain) !== false) wrong.push(`${j(domain)} (${kind})`);
  }
  assert(wrong.length === 0, `these must NOT count as a public instance (story, "A public instance"): ${wrong.join(', ')}`);
});

test('I3: addresses no stranger can reach are not public either — link-local (cloud metadata), 0.0.0.0, carrier-grade NAT — one shared notion with the SSRF guard', () => {
  const isPublicDomain = need(getDefaultsModule(), 'isPublicDomain');
  const wrong = ['169.254.169.254', '0.0.0.0', '100.64.1.2', '[fe80::1]'].filter((d) => isPublicDomain(d) !== false);
  assert(wrong.length === 0, `not reachable from the public internet, so not public: ${wrong.join(', ')} (ADR 0003 sub-decision 1 reuses src/utils/ssrfGuard.js)`);
});

test('I4: a public instance is described by its own domain — website https://‹domain›, and its own copy of the branded avatar', () => {
  const describeInstance = need(getDefaultsModule(), 'describeInstance');
  const got = describeInstance({ deps: { getConfigFromFile: config({ STRFRY_DOMAIN: 'staging.brainstorm.world', BRAINSTORM_RELAY_URL: 'wss://staging.brainstorm.world/relay' }) } });
  assert(same(got, PUBLIC), `expected ${j(PUBLIC)}, got ${j(got)}`);
});

test('I5: a dev box (STRFRY_DOMAIN=localhost, relay ws://localhost:7777) is not public — no website, and the reference deployment\'s copy of the avatar', () => {
  const describeInstance = need(getDefaultsModule(), 'describeInstance');
  const got = describeInstance({ deps: { getConfigFromFile: config({ STRFRY_DOMAIN: 'localhost', BRAINSTORM_RELAY_URL: 'ws://localhost:7777' }) } });
  assert(same(got, NOT_PUBLIC),
    `the story's own example: "localhost:7777 is not" public — so no https://localhost:7777 website and no loopback picture. Expected ${j(NOT_PUBLIC)}, got ${j(got)}`);
});

test('I6: the domain is derived as before — STRFRY_DOMAIN, else the relay URL\'s host, else localhost — and a LAN address is not public (OPEN.md row 148)', () => {
  const describeInstance = need(getDefaultsModule(), 'describeInstance');
  const lan = describeInstance({ deps: { getConfigFromFile: config({ STRFRY_DOMAIN: '192.168.1.50', BRAINSTORM_RELAY_URL: '' }) } });
  assert(lan.domain === '192.168.1.50' && lan.isPublic === false && lan.website === '' && lan.avatarUrl === REFERENCE_AVATAR,
    `row 148: a home-network instance must publish neither a website nor its own picture URL — got ${j(lan)}`);
  const fromRelay = describeInstance({ deps: { getConfigFromFile: config({ STRFRY_DOMAIN: '', BRAINSTORM_RELAY_URL: 'wss://tapestry.example.org/relay' }) } });
  assert(fromRelay.domain === 'tapestry.example.org' && fromRelay.isPublic === true && fromRelay.website === 'https://tapestry.example.org',
    `with no STRFRY_DOMAIN the relay URL's host (path dropped) is the domain — got ${j(fromRelay)}`);
  const nothing = describeInstance({ deps: { getConfigFromFile: config({}) } });
  assert(nothing.domain === 'localhost' && nothing.isPublic === false && nothing.avatarUrl === REFERENCE_AVATAR,
    `with nothing configured the domain is localhost, which is not public — got ${j(nothing)}`);
});

test('I7: the badged avatar\'s gate (index.js isPubliclyReachable) follows the same rule — a LAN, .internal or ULA address is not reachable (OPEN.md row 148)', () => {
  const { isPubliclyReachable } = getIndex();
  assert(typeof isPubliclyReachable === 'function', 'src/api/assistant/index.js must keep exporting isPubliclyReachable — ./avatar.js gates the composite URL on it (ADR ta-avatar/0003 D4)');
  const expected = {
    'https://staging.brainstorm.world': true,
    'https://192.168.1.50:7777': false,
    'https://10.0.0.5': false,
    'https://172.16.4.2': false,
    'https://nas.internal': false,
    'https://router.home.arpa': false,
    'https://[fd12:3456::1]': false,
    'https://localhost:7777': false,
    '': false,
  };
  const wrong = Object.entries(expected).filter(([url, want]) => isPubliclyReachable(url) !== want).map(([url, want]) => `${j(url)} → expected ${want}, got ${isPubliclyReachable(url)}`);
  assert(wrong.length === 0, `AC4: "no value the app itself supplies — … a generated badged avatar — is ever a loopback, private-network or relative URL": ${wrong.join('; ')}`);
});

/* ───────────────────────── N — the person's name ───────────────────────── */

test('N1: a person\'s name is their display_name, else their name — whitespace tidied, blanks and non-strings ignored', () => {
  const nameFromProfileEvent = need(getDefaultsModule(), 'nameFromProfileEvent');
  const cases = [
    [kind0(CUSTOMER, 1, { display_name: 'Carmen B', name: 'carmen' }), 'Carmen B'],
    [kind0(CUSTOMER, 1, { display_name: '   ', name: 'carmen' }), 'carmen'],
    [kind0(CUSTOMER, 1, { display_name: '  Carmen \n\t B  ' }), 'Carmen B'],
    [kind0(CUSTOMER, 1, { name: 42, about: 'no name here' }), ''],
    [kind0(CUSTOMER, 1, 'not json'), ''],
    [kind0(CUSTOMER, 1, {}), ''],
    [null, ''],
  ];
  for (const [event, want] of cases) {
    const got = nameFromProfileEvent(event);
    assert(got === want, `for content ${event ? event.content : 'null'} expected ${j(want)}, got ${j(got)}`);
  }
});

test('N2: a name on the local relay is used at once — no relay is asked, even when relays are allowed', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  let asked = 0;
  const r = await resolvePersonName({
    personPubkey: CUSTOMER, allowRelayLookup: true,
    deps: {
      scanLocalKind0: async () => kind0(CUSTOMER, 100, { name: 'Carmen' }),
      queryRelaysKind0: async () => { asked += 1; return []; },
      getProfileRelays: () => ['wss://profiles.example'],
      memo: new Map(), now: () => 0,
    },
  });
  assert(same(r, { name: 'Carmen', source: 'local' }), `AC2 + BIBLE §30 local-first: expected {name:'Carmen', source:'local'}, got ${j(r)}`);
  assert(asked === 0, `a local name needs no relay traffic — the profile relays were asked ${asked}×`);
});

test('N3: with no local profile, the instance\'s profile relays are asked about this person within the relay budget, and the newest valid kind 0 wins', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  const calls = [];
  const r = await resolvePersonName({
    personPubkey: CUSTOMER, allowRelayLookup: true,
    deps: {
      scanLocalKind0: async () => null,
      queryRelaysKind0: async (relays, pubkey, options) => {
        calls.push({ relays, pubkey, options });
        return [
          kind0(CUSTOMER, 100, { name: 'Old Name' }),
          kind0(CUSTOMER, 200, { display_name: 'New Name' }),
          kind0(STRANGER, 300, { name: 'Mallory' }),                   // someone else's profile
          kind0(CUSTOMER, 400, { name: 'A note, not a profile' }, { kind: 1 }),
        ];
      },
      getProfileRelays: () => ['wss://profiles-a.example', 'wss://profiles-b.example'],
      memo: new Map(), now: () => 0,
    },
  });
  assert(same(r, { name: 'New Name', source: 'relay' }), `AC2: expected the newest kind 0 BY THIS PERSON — {name:'New Name', source:'relay'} — got ${j(r)}`);
  assert(calls.length === 1, `the profile relays are asked once, got ${calls.length}`);
  assert(j(calls[0].relays) === j(['wss://profiles-a.example', 'wss://profiles-b.example']) && calls[0].pubkey === CUSTOMER,
    `asked ${j(calls[0].relays)} about ${calls[0].pubkey} — expected the profile relays, about the person`);
  assert(calls[0].options && calls[0].options.maxWait === RELAY_BUDGET_MS, `within ADR 0001's ${RELAY_BUDGET_MS} ms relay budget — got ${j(calls[0].options)}`);
});

test('N4: a local profile without a name sends the lookup to the relays — but the person\'s newest profile decides, so a newer nameless one beats an older copy with a name', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  const deps = (local, remote) => ({
    scanLocalKind0: async () => local,
    queryRelaysKind0: async () => remote,
    getProfileRelays: () => ['wss://profiles.example'],
    memo: new Map(), now: () => 0,
  });
  const older = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true,
    deps: deps(kind0(CUSTOMER, 100, { about: 'no name yet' }), [kind0(CUSTOMER, 200, { name: 'Relay Name' })]) });
  assert(same(older, { name: 'Relay Name', source: 'relay' }), `AC2 ("on the local relay or on the instance's profile relays"): got ${j(older)}`);
  const newer = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true,
    deps: deps(kind0(CUSTOMER, 300, { about: 'I removed my name' }), [kind0(CUSTOMER, 200, { name: 'Stale Name' })]) });
  assert(same(newer, { name: '', source: null }),
    `the person's CURRENT profile (created_at 300, local) has no name, so the default must use the npub forms, not an older copy's name — got ${j(newer)}`);
});

test('N5: an anonymous caller\'s lookup stays on the local relay — no relay is ever asked', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  let asked = 0;
  const base = { queryRelaysKind0: async () => { asked += 1; return [kind0(CUSTOMER, 200, { name: 'Relay Name' })]; }, getProfileRelays: () => ['wss://profiles.example'], memo: new Map(), now: () => 0 };
  const none = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: false, deps: { ...base, scanLocalKind0: async () => null } });
  const local = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: false, deps: { ...base, scanLocalKind0: async () => kind0(CUSTOMER, 100, { name: 'Local Name' }) } });
  assert(same(none, { name: '', source: null }), `nothing local and no relay allowed → no name, got ${j(none)}`);
  assert(same(local, { name: 'Local Name', source: 'local' }), `a local name is still used, got ${j(local)}`);
  assert(asked === 0, `ADR 0003 sub-decision 2: a public GET must not make the server query relays about arbitrary pubkeys — they were asked ${asked}×`);
});

test('N6: a relay answer — found or not — is remembered per person for 10 minutes, then asked again', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  let t = 1_000_000;
  let asked = 0;
  let answer = [kind0(CUSTOMER, 100, { name: 'Carmen' })];
  const memo = new Map();
  const deps = {
    scanLocalKind0: async () => null,
    queryRelaysKind0: async () => { asked += 1; return answer; },
    getProfileRelays: () => ['wss://profiles.example'],
    memo, now: () => t,
  };
  const first = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true, deps });
  t += NAME_MEMO_MS - 1;
  const second = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true, deps });
  assert(first.name === 'Carmen' && second.name === 'Carmen' && asked === 1,
    `within 10 minutes the remembered answer is used — relays asked ${asked}×, answers ${j([first, second])}`);
  t += 2;
  await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true, deps });
  assert(asked === 2, `after 10 minutes the relays are asked again — asked ${asked}×`);
  await resolvePersonName({ personPubkey: ADMIN, allowRelayLookup: true, deps });
  assert(asked === 3, `the memory is per person — another person's name is looked up — asked ${asked}×`);
  answer = [];
  const missMemo = new Map();
  const missDeps = { ...deps, memo: missMemo };
  await resolvePersonName({ personPubkey: STRANGER, allowRelayLookup: true, deps: missDeps });
  const again = await resolvePersonName({ personPubkey: STRANGER, allowRelayLookup: true, deps: missDeps });
  assert(asked === 4 && same(again, { name: '', source: null }), `a "no name" answer is remembered too — asked ${asked}×, got ${j(again)}`);
});

test('N7: when the profile relays fail, the answer is "no name" — the default falls back to the npub forms, never an error', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  let r;
  try {
    r = await resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true, deps: {
      scanLocalKind0: async () => null,
      queryRelaysKind0: async () => { throw new Error('relay pool exploded (fixture)'); },
      getProfileRelays: () => ['wss://profiles.example'],
      memo: new Map(), now: () => 0,
    } });
  } catch (err) {
    throw new Error(`resolvePersonName must not reject when the relays fail — it threw: ${err.message}`);
  }
  assert(same(r, { name: '', source: null }), `expected {name:'', source:null}, got ${j(r)}`);
});

test('N8: a relay helper that never returns cannot hold the lookup — it gives up just after the relay budget', async () => {
  const resolvePersonName = need(getDefaultsModule(), 'resolvePersonName');
  const started = Date.now();
  const r = await within(resolvePersonName({ personPubkey: CUSTOMER, allowRelayLookup: true, deps: {
    scanLocalKind0: async () => null,
    queryRelaysKind0: () => new Promise(() => {}),
    getProfileRelays: () => ['wss://silent.example'],
    memo: new Map(), now: () => 0,
  } }), BACKSTOP_MS + SLACK_MS);
  const took = Date.now() - started;
  assert(r !== 'HUNG', `the lookup was still waiting after ${BACKSTOP_MS + SLACK_MS} ms — the editor and every publish would hang with it (ADR 0001 Amendment 1's backstop)`);
  assert(same(r, { name: '', source: null }), `a silent relay means "no name" — got ${j(r)} after ${took} ms`);
});

test('N9: with no relays injected, the lookup asks exactly the instance\'s profile relays from the relay settings — not the general-purpose or WoT lists', async () => {
  getDefaultsModule();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ap3-settings-'));
  const file = path.join(dir, 'settings.json');
  fs.writeFileSync(file, JSON.stringify({ aRelays: {
    aPopularGeneralPurposeRelays: ['wss://general.example'],
    aProfileRelays: ['wss://profiles-a.example', ' wss://profiles-b.example ', 'https://not-a-relay.example'],
    aWotRelays: ['wss://wot.example'],
  } }));
  const saved = process.env.TAPESTRY_SETTINGS_PATH;
  try {
    process.env.TAPESTRY_SETTINGS_PATH = file;
    for (const mod of [SETTINGS_MOD, PUBLISH_MOD, DEFAULTS_MOD]) { try { delete require.cache[require.resolve(mod)]; } catch { /* absent */ } }
    const fresh = require(DEFAULTS_MOD);
    const asked = [];
    await need(fresh, 'resolvePersonName')({ personPubkey: CUSTOMER, allowRelayLookup: true, deps: {
      scanLocalKind0: async () => null,
      queryRelaysKind0: async (relays) => { asked.push(relays); return []; },
      memo: new Map(), now: () => 0,
    } });
    assert(j(asked) === j([['wss://profiles-a.example', 'wss://profiles-b.example']]),
      `AC2 names "the instance's profile relays" — the settings' aProfileRelays, trimmed, relay URLs only. Asked ${j(asked)}`);
  } finally {
    if (saved === undefined) delete process.env.TAPESTRY_SETTINGS_PATH; else process.env.TAPESTRY_SETTINGS_PATH = saved;
    for (const mod of [SETTINGS_MOD, PUBLISH_MOD, DEFAULTS_MOD]) { try { delete require.cache[require.resolve(mod)]; } catch { /* absent */ } }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/* ───────────────────────── D — the one definition ───────────────────────── */

test('D1: a person with a name, on a public instance — exactly the story\'s table', () => {
  const buildDefaultProfile = need(getDefaultsModule(), 'buildDefaultProfile');
  const got = buildDefaultProfile({ personPubkey: CUSTOMER, personName: 'Carmen', instance: PUBLIC });
  const want = tableFor(CUSTOMER, 'Carmen', PUBLIC);
  assert(same(got, want), `expected\n        ${j(want)}\n        got\n        ${j(got)}`);
});

test('D2: a person with no name — "npub...‹last 6›\'s Tapestry Assistant", and the about names the full npub alone', () => {
  const buildDefaultProfile = need(getDefaultsModule(), 'buildDefaultProfile');
  const npub = npubOf(CUSTOMER);
  const got = buildDefaultProfile({ personPubkey: CUSTOMER, personName: '', instance: PUBLIC });
  assert(got.name === `npub...${npub.slice(-6)}'s Tapestry Assistant` && got.display_name === got.name,
    `story, open question 2: "npub...abc123's Tapestry Assistant" — three dots, no comma. Got name ${j(got.name)}, display_name ${j(got.display_name)}`);
  assert(got.about.startsWith(`I am the Tapestry Assistant for ${npub}. You can find my pubkey`),
    `with no name the first sentence reads "I am the Tapestry Assistant for ‹npub›." — got ${j(got.about.slice(0, 120))}`);
  assert(same(got, tableFor(CUSTOMER, '', PUBLIC)), `the rest of the table holds too — got ${j(got)}`);
});

test('D3: on an instance that is not public — no website, and the reference deployment\'s copy of the branded avatar', () => {
  const buildDefaultProfile = need(getDefaultsModule(), 'buildDefaultProfile');
  const got = buildDefaultProfile({ personPubkey: CUSTOMER, personName: 'Carmen', instance: NOT_PUBLIC });
  assert(got.website === '', `AC3: "given a non-public instance, the default has no website" — got ${j(got.website)}`);
  assert(got.picture === REFERENCE_AVATAR, `AC4 + open question 1: the picture is always the branded avatar — here ${REFERENCE_AVATAR} — got ${j(got.picture)}`);
  assert(same(got, tableFor(CUSTOMER, 'Carmen', NOT_PUBLIC)), `the rest of the table holds too — got ${j(got)}`);
});

test('D4: the about text is the owner\'s, verbatim — two paragraphs, one blank line between them', () => {
  const buildDefaultProfile = need(getDefaultsModule(), 'buildDefaultProfile');
  const npub = npubOf(OWNER);
  const { about } = buildDefaultProfile({ personPubkey: OWNER, personName: 'Olivia', instance: PUBLIC });
  const paragraphs = String(about).split('\n\n');
  assert(paragraphs.length === 2, `expected exactly two paragraphs separated by one blank line, got ${paragraphs.length}: ${j(about)}`);
  assert(paragraphs[0] === `I am the Tapestry Assistant for Olivia (${npub}). You can find my pubkey in my owner's kind 10040 event.`,
    `paragraph 1 — "‹name› (‹npub›)" with the full npub: got ${j(paragraphs[0])}`);
  assert(paragraphs[1] === ABOUT_SECOND_PARAGRAPH, `paragraph 2 must be the owner's words, character for character: got ${j(paragraphs[1])}`);
});

test('D5: nothing the definition supplies is a loopback, private-network or relative URL — on either kind of instance', () => {
  const buildDefaultProfile = need(getDefaultsModule(), 'buildDefaultProfile');
  for (const instance of [PUBLIC, NOT_PUBLIC]) {
    const got = buildDefaultProfile({ personPubkey: ADMIN, personName: 'Adam', instance });
    for (const field of ['picture', 'website', 'banner']) {
      const value = got[field];
      if (value === '') continue;
      let host = '';
      try { const u = new URL(value); assert(u.protocol === 'https:', `${field} ${j(value)} is not https`); host = u.hostname; } catch (err) { throw new Error(`AC4: ${field} ${j(value)} is not an absolute URL (${err.message})`); }
      assert(['staging.brainstorm.world', 'tapestry.brainstorm.world'].includes(host),
        `AC4: ${field} points at ${host} — only the instance's own public domain or the reference deployment may appear`);
    }
    assert(Object.values(got).every((v) => typeof v === 'string'), `every field is a string, got ${j(got)}`);
  }
});

test('D6: index.js\'s exported buildDefaultProfileContent is the same definition — and with no instance config and no relay it is the npub form with the reference avatar and no website', async () => {
  const { buildDefaultProfileContent } = getIndex();
  assert(typeof buildDefaultProfileContent === 'function', 'src/api/assistant/index.js must keep exporting buildDefaultProfileContent (ADR 0003 keeps it as the stack-free entry point)');
  const given = await buildDefaultProfileContent(CUSTOMER, { personName: 'Carmen', instance: PUBLIC });
  assert(same(given, tableFor(CUSTOMER, 'Carmen', PUBLIC)), `with the name and instance given, expected the table — got ${j(given)}`);
  // Hermetic by construction: no /etc/brainstorm.conf and no strfry on PATH, on a dev host and on the CI runner.
  const bare = await buildDefaultProfileContent(OWNER);
  assert(same(bare, tableFor(OWNER, '', NOT_PUBLIC)),
    `with nothing configured the instance is localhost (not public) and no name is found: expected ${j(tableFor(OWNER, '', NOT_PUBLIC))}, got ${j(bare)}`);
});

/* ───────────────────────── F — the finishing step ───────────────────────── */

test('F1: on a public instance every published profile gets the server-managed NIP-05 and ["client", "‹domain›"], and loses its empty fields', () => {
  const finalizeAssistantProfile = need(getDefaultsModule(), 'finalizeAssistantProfile');
  const content = { name: 'Custom', display_name: '', about: 'Mine', picture: 'https://img.example/p.png', banner: '', website: '', nip05: '', lud16: 'me@wallet.example' };
  const got = finalizeAssistantProfile({ content, instance: PUBLIC, nip05LocalPart: 'carmen-tapestry-assistant-c1c1c1' });
  const want = { name: 'Custom', about: 'Mine', picture: 'https://img.example/p.png', lud16: 'me@wallet.example', nip05: 'carmen-tapestry-assistant-c1c1c1@staging.brainstorm.world' };
  assert(same(got && got.content, want), `AC3: expected content ${j(want)}, got ${j(got && got.content)}`);
  assert(j(got.tags) === j([['client', 'staging.brainstorm.world']]), `AC3: expected tags [["client","staging.brainstorm.world"]], got ${j(got.tags)}`);
});

test('F2: on an instance that is not public no published profile carries a NIP-05 or a client tag — whatever it was handed', () => {
  const finalizeAssistantProfile = need(getDefaultsModule(), 'finalizeAssistantProfile');
  const content = { name: 'Custom', about: '', picture: 'https://img.example/p.png', nip05: 'someone@localhost:7777' };
  const got = finalizeAssistantProfile({ content, instance: NOT_PUBLIC, nip05LocalPart: 'carmen-tapestry-assistant-c1c1c1' });
  assert(same(got && got.content, { name: 'Custom', picture: 'https://img.example/p.png' }), `AC3: expected no nip05 and no empty fields, got ${j(got && got.content)}`);
  assert(j(got.tags) === j([]), `AC3: expected no tags at all, got ${j(got.tags)}`);
});

test('F3: a NIP-05 the profile arrived with is never kept — on a public instance the server\'s own replaces it', () => {
  const finalizeAssistantProfile = need(getDefaultsModule(), 'finalizeAssistantProfile');
  const got = finalizeAssistantProfile({ content: { name: 'X', nip05: 'forged@evil.example' }, instance: PUBLIC, nip05LocalPart: 'tapestry-assistant-c1c1c1' });
  assert(got.content.nip05 === 'tapestry-assistant-c1c1c1@staging.brainstorm.world', `NIP-05 is server-managed (story, table) — got ${j(got.content.nip05)}`);
});

/* ───────────────────────── Q — the status answer, through its seam ───────────────────────── */

function statusFakes(opts = {}) {
  const calls = { personName: [], state: [] };
  const names = opts.names || NAMES;
  const deps = {
    getOwnerPubkey: () => OWNER,
    getAdminPubkeys: () => [ADMIN],
    getAssistantKeys: async (pk) => {
      if (opts.noKey) return null;
      const assistant = ASSISTANT_OF[pk];
      return assistant ? { pubkey: assistant, npub: npubOf(assistant) } : null;
    },
    getPersonName: async (pk, options) => { calls.personName.push({ pubkey: pk, options }); return names[pk] || ''; },
    describeInstance: () => opts.instance || PUBLIC,
    resolveAssistantProfileState: async (options) => {
      calls.state.push(options);
      return opts.state || { hasProfile: false, profile: null, event: null, source: null };
    },
    ...(opts.deps || {}),
  };
  return { deps, calls };
}
function statusReq({ customerPubkey, session = null, localTrusted = false, defaults } = {}) {
  const query = { customerPubkey };
  if (defaults !== undefined) query.defaults = defaults;
  return { query, session: session ? { authenticated: true, pubkey: session } : {}, localTrusted };
}
async function askStatus(opts, reqOpts) {
  const factory = getStatusFactory();
  const f = statusFakes(opts);
  const res = fakeRes();
  await factory(f.deps)(statusReq(reqOpts), res);
  return { res, calls: f.calls };
}

test('Q1: an Owner, an Admin and a Customer on one instance are each offered exactly the table for themselves — differing only in name, npub and their assistant\'s own NIP-05', async () => {
  const seen = [];
  for (const person of [OWNER, ADMIN, CUSTOMER]) {
    const { res } = await askStatus({}, { customerPubkey: person, session: person });
    assert(res.statusCode === 200 && res.body && res.body.success === true, `${person.slice(0, 4)}…: got ${res.statusCode} ${j(res.body)}`);
    const want = tableFor(person, NAMES[person], PUBLIC);
    assert(same(res.body.defaults, want), `AC1: the defaults offered to ${NAMES[person]} must follow the table — expected ${j(want)}, got ${j(res.body.defaults)}`);
    const localPart = localPartFor(NAMES[person], ASSISTANT_OF[person]);
    assert(same(res.body.computedNip05, { localPart, domain: 'staging.brainstorm.world', address: `${localPart}@staging.brainstorm.world` }),
      `AC1: each assistant's own NIP-05 — expected ${localPart}@staging.brainstorm.world, got ${j(res.body.computedNip05)}`);
    assert(!/a customer's/i.test(j(res.body.defaults)), `AC1: no default ever reads "a customer's Tapestry Assistant" — got ${j(res.body.defaults)}`);
    seen.push(res.body.defaults);
  }
  const rest = seen.map((d) => j(canon({ ...d, name: undefined, display_name: undefined, about: undefined })));
  assert(rest.every((r) => r === rest[0]), `AC1: apart from name and about, the three defaults must be identical — got ${j(rest)}`);
});

test('Q2: "Reset to defaults" on an assistant that already has a profile still offers the table — and the published profile comes back separately, untouched', async () => {
  const published = { name: 'Hand-written', about: 'my own words', picture: 'https://img.example/mine.png' };
  const { res } = await askStatus({ state: { hasProfile: true, profile: published, event: null, source: 'local' } }, { customerPubkey: OWNER, session: OWNER });
  assert(same(res.body.defaults, tableFor(OWNER, 'Olivia', PUBLIC)), `AC1 (the "Reset to defaults" case): expected the table, got ${j(res.body.defaults)}`);
  assert(res.body.hasProfile === true && same(res.body.profile, published) && res.body.profileSource === 'local',
    `the published profile, hasProfile and profileSource come straight from the setup check (ADR 0001) — got ${j({ hasProfile: res.body.hasProfile, profile: res.body.profile, profileSource: res.body.profileSource })}`);
});

test('Q3: a person with no name is offered the npub forms, and their assistant\'s NIP-05 has no name part', async () => {
  const { res } = await askStatus({ names: {} }, { customerPubkey: CUSTOMER, session: CUSTOMER });
  assert(same(res.body.defaults, tableFor(CUSTOMER, '', PUBLIC)), `AC2 ("given they have none, the npub forms"): got ${j(res.body.defaults)}`);
  assert(res.body.computedNip05 && res.body.computedNip05.localPart === `tapestry-assistant-${CUSTOMER_ASSISTANT.slice(-6)}`,
    `the NIP-05 local-part format is unchanged — no name, no name part. Got ${j(res.body.computedNip05)}`);
});

test('Q4: the name lookup may reach the relays exactly when ADR 0001 lets the setup check reach them — the person, the Owner, an Admin, the in-container operator; never an anonymous caller', async () => {
  const cases = [
    ['the person, signed in', { customerPubkey: CUSTOMER, session: CUSTOMER }, true],
    ['the Owner, about a Customer', { customerPubkey: CUSTOMER, session: OWNER }, true],
    ['an Admin, about a Customer', { customerPubkey: CUSTOMER, session: ADMIN }, true],
    ['the in-container operator', { customerPubkey: CUSTOMER, localTrusted: true }, true],
    ['an anonymous caller', { customerPubkey: CUSTOMER }, false],
    ['another signed-in user', { customerPubkey: CUSTOMER, session: STRANGER }, false],
  ];
  for (const [who, req, want] of cases) {
    const { res, calls } = await askStatus({}, req);
    assert(res.statusCode === 200, `${who}: got ${res.statusCode} ${j(res.body)}`);
    assert(calls.personName.length === 1 && calls.personName[0].pubkey === CUSTOMER,
      `${who}: the name looked up must be the assistant's person's — got ${j(calls.personName)}`);
    const got = calls.personName[0].options && calls.personName[0].options.allowRelayLookup;
    assert(got === want, `${who}: allowRelayLookup must be ${want} — got ${j(got)}`);
    assert(calls.state.length === 1 && calls.state[0].allowRelayFallback === want,
      `${who}: the setup check's relay fallback must follow the same rule — got ${j(calls.state[0] && calls.state[0].allowRelayFallback)}`);
  }
});

test('Q5: on a public instance the status answer says so, offers the website, and shows the assistant\'s NIP-05', async () => {
  const { res } = await askStatus({}, { customerPubkey: CUSTOMER, session: CUSTOMER });
  assert(res.body.isPublicInstance === true, `ADR 0003: the answer reports isPublicInstance — got ${j(res.body.isPublicInstance)}`);
  assert(res.body.defaults && res.body.defaults.website === 'https://staging.brainstorm.world', `AC3: "given a public instance, the default carries the website" — got ${j(res.body.defaults && res.body.defaults.website)}`);
  assert(res.body.computedNip05 && res.body.computedNip05.address === `carmen-tapestry-assistant-${CUSTOMER_ASSISTANT.slice(-6)}@staging.brainstorm.world`,
    `AC5: NIP-05 is shown read-only — the editor reads computedNip05; got ${j(res.body.computedNip05)}`);
});

test('Q6: on an instance that is not public the status answer says so — no website, no NIP-05, and the reference avatar', async () => {
  const { res } = await askStatus({ instance: NOT_PUBLIC }, { customerPubkey: CUSTOMER, session: CUSTOMER });
  assert(res.body.isPublicInstance === false, `expected isPublicInstance false, got ${j(res.body.isPublicInstance)}`);
  assert(same(res.body.defaults, tableFor(CUSTOMER, 'Carmen', NOT_PUBLIC)), `AC3/AC4: expected ${j(tableFor(CUSTOMER, 'Carmen', NOT_PUBLIC))}, got ${j(res.body.defaults)}`);
  assert(res.body.computedNip05 === null, `AC3: no NIP-05 on an instance that is not public — got ${j(res.body.computedNip05)}`);
});

test('Q7: the dashboard\'s check (defaults=0) skips the name lookup — no defaults and no NIP-05 in the answer, the setup state unchanged', async () => {
  const { res, calls } = await askStatus({ state: { hasProfile: true, profile: { name: 'X' }, event: null, source: 'relay' } }, { customerPubkey: CUSTOMER, session: CUSTOMER, defaults: '0' });
  assert(calls.personName.length === 0, `ADR 0003 sub-decision 4: with defaults=0 the name lookup must not run at all — it ran ${calls.personName.length}×`);
  assert(!Object.prototype.hasOwnProperty.call(res.body, 'defaults') && !Object.prototype.hasOwnProperty.call(res.body, 'computedNip05'),
    `with defaults=0 the answer leaves out defaults and computedNip05 — got keys ${j(Object.keys(res.body))}`);
  assert(res.body.hasRelayKey === true && res.body.hasProfile === true && res.body.profileSource === 'relay' && calls.state.length === 1,
    `the setup answer itself is decided exactly as before — got ${j(res.body)}`);
});

test('Q8: a person with no assistant key is told so — and still offered the table, unless the caller said defaults=0', async () => {
  const withDefaults = await askStatus({ noKey: true }, { customerPubkey: CUSTOMER, session: CUSTOMER });
  const b = withDefaults.res.body;
  assert(b && b.success === true && b.hasRelayKey === false && b.hasProfile === false && b.profileSource === null && b.isPublicInstance === true,
    `expected { success, hasRelayKey: false, hasProfile: false, profileSource: null, isPublicInstance: true }, got ${j(b)}`);
  assert(same(b.defaults, tableFor(CUSTOMER, 'Carmen', PUBLIC)), `the no-key answer still offers the table — got ${j(b.defaults)}`);
  assert(withDefaults.calls.state.length === 0, 'with no key there is no assistant to check the relays for');
  const lean = await askStatus({ noKey: true }, { customerPubkey: CUSTOMER, session: CUSTOMER, defaults: '0' });
  assert(!Object.prototype.hasOwnProperty.call(lean.res.body, 'defaults') && lean.calls.personName.length === 0,
    `with defaults=0 the no-key answer has no defaults and no name lookup — got ${j(lean.res.body)}`);
});

test('Q9: a customerPubkey that is not 64 lowercase hex is refused with 400 — the npub the defaults need cannot be made from it', async () => {
  for (const bad of ['not-a-pubkey', 'AB'.repeat(32), 'ab'.repeat(31), '']) {
    const { res, calls } = await askStatus({}, { customerPubkey: bad });
    assert(res.statusCode === 400, `customerPubkey ${j(bad)} → expected 400, got ${res.statusCode} ${j(res.body)}`);
    assert(calls.personName.length === 0 && calls.state.length === 0, `nothing is looked up for ${j(bad)}`);
  }
});

test('Q10: the name lookup and the setup check run at the same time — neither waits for the other to finish', async () => {
  let markNameStarted; const nameStarted = new Promise((r) => { markNameStarted = r; });
  let markStateStarted; const stateStarted = new Promise((r) => { markStateStarted = r; });
  const deps = {
    getPersonName: async () => { markNameStarted(); await stateStarted; return 'Carmen'; },
    resolveAssistantProfileState: async () => { markStateStarted(); await nameStarted; return { hasProfile: false, profile: null, event: null, source: null }; },
  };
  const factory = getStatusFactory();
  const f = statusFakes({ deps });
  const res = fakeRes();
  const r = await within(factory(f.deps)(statusReq({ customerPubkey: CUSTOMER, session: CUSTOMER }), res).then(() => 'DONE'), 3000);
  assert(r === 'DONE',
    'ADR 0003 sub-decision 4: the handler finished one lookup before starting the other, so each would wait for the other ' +
    'forever here — run them together (Promise.all) so the status call\'s worst case does not grow');
  assert(res.body && res.body.defaults && res.body.defaults.name === "Carmen's Tapestry Assistant", `and the answer uses the name — got ${j(res.body)}`);
});

/* ───────────────────────── E — the publish handler, through its seam ───────────────────────── */

function publishFakes(opts = {}) {
  const keys = {};
  for (const person of [OWNER, ADMIN, CUSTOMER]) {
    const sk = generateSecretKey();
    keys[person] = { sk, pubkey: getPublicKey(sk) };
  }
  const calls = { importEvent: [], nip05: [], personName: [] };
  const names = opts.names || NAMES;
  const deps = {
    getAssistantKeys: async (pk) => (keys[pk] ? { pubkey: keys[pk].pubkey, privkey: Buffer.from(keys[pk].sk).toString('hex') } : null),
    getOwnerPubkey: () => OWNER,
    getPersonName: async (pk, options) => { calls.personName.push({ pubkey: pk, options }); return names[pk] || ''; },
    describeInstance: () => opts.instance || PUBLIC,
    importEvent: async (event) => { calls.importEvent.push(event); },
    updateNip05Mapping: (localPart, pubkey) => { calls.nip05.push([localPart, pubkey]); },
    isLocalOnly: () => true,
    getSettings: () => ({ aRelays: {} }),
    publishToRelays: async () => [],
    now: () => 1_700_000_000_000,
    ...(opts.deps || {}),
  };
  return { deps, calls, keys };
}
function publishReq(customerPubkey, sessionPubkey, content) {
  const body = { customerPubkey };
  if (content !== undefined) body.content = content;
  return { body, query: {}, session: { authenticated: true, pubkey: sessionPubkey } };
}
async function publish(opts, customerPubkey, sessionPubkey, content) {
  const factory = getPublishFactory();
  const f = publishFakes(opts);
  const res = fakeRes();
  await factory(f.deps)(publishReq(customerPubkey, sessionPubkey, content), res);
  const event = f.calls.importEvent[0] || null;
  let signed = null;
  try { signed = event ? JSON.parse(event.content) : null; } catch { signed = null; }
  return { res, calls: f.calls, keys: f.keys, event, signed };
}

// E1, E3, E5 and E6 re-aimed by assistant-profile #5 (ADR 0005 sub-decision 2): a publish with no content is now
// refused, so the default reaches a publish the way the page sends it — "Reset to defaults" puts the table the
// status offers into the form, and Publish sends it as content. What is signed does not change.
test('E1: publishing the offered default (what "Reset to defaults" then Publish sends) on a public instance signs exactly the table, the server-managed NIP-05 and ["client", "‹domain›"]', async () => {
  const { res, calls, keys, event, signed } = await publish({}, CUSTOMER, CUSTOMER, tableFor(CUSTOMER, 'Carmen', PUBLIC));
  assert(res.statusCode === 200 && res.body && res.body.success === true && event, `got ${res.statusCode} ${j(res.body)}`);
  const want = signedDefaultFor(CUSTOMER, 'Carmen', keys[CUSTOMER].pubkey, PUBLIC);
  assert(same(signed, want), `AC1 + AC3: the signed content must be the table — expected\n        ${j(want)}\n        got\n        ${j(signed)}`);
  assert(j(event.tags) === j([['client', 'staging.brainstorm.world']]), `AC3: expected tags [["client","staging.brainstorm.world"]], got ${j(event.tags)}`);
  assert(event.kind === 0 && event.pubkey === keys[CUSTOMER].pubkey, 'a kind 0 signed by the person\'s own assistant');
  assert(j(calls.nip05) === j([[localPartFor('Carmen', keys[CUSTOMER].pubkey), keys[CUSTOMER].pubkey]]), `the nostr.json mapping is written once for the published NIP-05 — got ${j(calls.nip05)}`);
  assert(res.body.nip05 && res.body.nip05.address === want.nip05, `the answer names the NIP-05 it published — got ${j(res.body.nip05)}`);
});

test('E2: an edited profile on a public instance keeps the user\'s fields, but its NIP-05 is the server\'s and it carries the client tag', async () => {
  const content = { name: 'Custom Name', display_name: '', about: 'Mine', picture: 'https://img.example/p.png', banner: '', website: '', lud16: 'me@wallet.example', nip05: 'forged@evil.example' };
  const { event, signed, keys } = await publish({}, CUSTOMER, CUSTOMER, content);
  const want = { name: 'Custom Name', about: 'Mine', picture: 'https://img.example/p.png', lud16: 'me@wallet.example', nip05: `${localPartFor('Carmen', keys[CUSTOMER].pubkey)}@staging.brainstorm.world` };
  assert(same(signed, want), `AC3 ("every assistant profile it publishes (default or edited)"): expected ${j(want)}, got ${j(signed)}`);
  assert(j(event.tags) === j([['client', 'staging.brainstorm.world']]), `AC3: an edited profile carries the client tag too — got ${j(event.tags)}`);
});

test('E3: publishing the offered default on an instance that is not public carries no website, no NIP-05 and no client tag — and writes no nostr.json mapping', async () => {
  const { res, calls, keys, event, signed } = await publish({ instance: NOT_PUBLIC }, CUSTOMER, CUSTOMER, tableFor(CUSTOMER, 'Carmen', NOT_PUBLIC));
  const want = signedDefaultFor(CUSTOMER, 'Carmen', keys[CUSTOMER].pubkey, NOT_PUBLIC);
  assert(same(signed, want), `AC3 + AC4: expected ${j(want)}, got ${j(signed)}`);
  assert(event && j(event.tags) === j([]), `AC3: no client tag on an instance that is not public — got ${j(event && event.tags)}`);
  assert(calls.nip05.length === 0, `no NIP-05 is published, so no nostr.json mapping is written — got ${j(calls.nip05)}`);
  assert(res.body && res.body.success === true && res.body.nip05 === null, `the answer's nip05 is null — got ${j(res.body && res.body.nip05)}`);
});

test('E4: an edited profile on an instance that is not public carries no NIP-05 and no client tag, whatever it was sent with', async () => {
  const content = { name: 'Custom Name', about: 'Mine', website: 'https://my.site.example', nip05: 'forged@evil.example' };
  const { event, signed } = await publish({ instance: NOT_PUBLIC }, CUSTOMER, CUSTOMER, content);
  assert(same(signed, { name: 'Custom Name', about: 'Mine', website: 'https://my.site.example' }),
    `AC3: no NIP-05 on a non-public instance (a website the user typed is theirs to keep — URL validation is out of scope). Got ${j(signed)}`);
  assert(event && j(event.tags) === j([]), `AC3: no client tag — got ${j(event && event.tags)}`);
});

test('E5: the Owner, an Admin and a Customer each publishing their own offered default get the same table — differing only in name, npub and NIP-05', async () => {
  const signedBy = {};
  for (const person of [OWNER, ADMIN, CUSTOMER]) {
    const { res, keys, signed } = await publish({}, person, person, tableFor(person, NAMES[person], PUBLIC));
    assert(res.statusCode === 200 && res.body.success === true, `${NAMES[person]}: got ${res.statusCode} ${j(res.body)}`);
    const want = signedDefaultFor(person, NAMES[person], keys[person].pubkey, PUBLIC);
    assert(same(signed, want), `AC1 + AC5: ${NAMES[person]}'s default must be the table — expected ${j(want)}, got ${j(signed)}`);
    assert(!/a customer's/i.test(j(signed)), `AC1: never "a customer's Tapestry Assistant" — got ${j(signed)}`);
    signedBy[person] = signed;
  }
  const rest = Object.values(signedBy).map((s) => j(canon({ ...s, name: undefined, display_name: undefined, about: undefined, nip05: undefined })));
  assert(rest.every((r) => r === rest[0]), `AC1: apart from name, about and NIP-05 the three must be identical — got ${j(rest)}`);
});

test('E6: the person\'s name feeds the NIP-05 local-part too, and the publisher may look it up on the relays', async () => {
  const named = await publish({}, CUSTOMER, CUSTOMER, tableFor(CUSTOMER, 'Carmen', PUBLIC));
  assert(named.signed && named.signed.nip05 === `${localPartFor('Carmen', named.keys[CUSTOMER].pubkey)}@staging.brainstorm.world`,
    `ADR 0003 sub-decision 3: the same ‹name› names the NIP-05 — got ${j(named.signed && named.signed.nip05)}`);
  assert(named.calls.personName.length >= 1 && named.calls.personName.every((c) => c.pubkey === CUSTOMER && c.options && c.options.allowRelayLookup === true),
    `a publish is always signed in (the person or the Owner), so the lookup may reach the profile relays — got ${j(named.calls.personName)}`);
  const unnamed = await publish({ names: {} }, CUSTOMER, CUSTOMER, tableFor(CUSTOMER, '', PUBLIC));
  assert(unnamed.signed && unnamed.signed.nip05 === `tapestry-assistant-${unnamed.keys[CUSTOMER].pubkey.slice(-6)}@staging.brainstorm.world`,
    `no name → no name part (format unchanged) — got ${j(unnamed.signed && unnamed.signed.nip05)}`);
});

// Re-aimed by assistant-profile #5 (ADR 0005 sub-decision 2): the publish handler no longer builds a default, so
// the guard moves to where the one definition is now offered — the status answer's defaults.
test('E7: the one definition cannot be swapped out through a seam — an injected buildDefaultProfileContent or buildDefaultProfile leaves the offered defaults exactly the table', async () => {
  const injected = {
    buildDefaultProfileContent: async () => ({ name: 'Injected', about: 'a second definition' }),
    buildDefaultProfile: () => ({ name: 'Injected', about: 'a second definition' }),
  };
  const { res } = await askStatus({ deps: injected }, { customerPubkey: CUSTOMER, session: CUSTOMER });
  assert(res.statusCode === 200 && res.body && same(res.body.defaults, tableFor(CUSTOMER, 'Carmen', PUBLIC)),
    `AC5 ("every path that publishes an assistant profile starts from this one definition"), ADR 0003 sub-decision 5 — got ${res.statusCode} ${j(res.body && res.body.defaults)}`);
});

// Re-aimed by assistant-profile #5 (ADR 0005 sub-decision 2; epic decision 4): the Owner used to be able to publish a
// Customer's assistant through the API. Everyone now publishes their own, so the Owner is refused.
test('E8: the Owner publishing a Customer\'s assistant is refused — 403 "not-your-assistant" — and nothing is signed, saved, looked up or mapped', async () => {
  const { res, calls, event } = await publish({}, CUSTOMER, OWNER, tableFor(CUSTOMER, 'Carmen', PUBLIC));
  assert(res.statusCode === 403 && res.body && res.body.success === false && res.body.code === 'not-your-assistant',
    `epic decision 4 ("everyone manages their own assistant"), ADR 0005 sub-decision 2 — got ${res.statusCode} ${j(res.body && { ...res.body, event: undefined })}`);
  assert(!event && calls.nip05.length === 0 && calls.personName.length === 0,
    `a refusal writes nothing and looks nothing up — got ${calls.importEvent.length} local write(s), ${calls.nip05.length} NIP-05 mapping(s), ${calls.personName.length} name lookup(s)`);
});

/* ───────────────────────── W — the browser code, by source (CI's backstop for the B-class) ───────────────────────── */

test('W1: the dashboard\'s setup check asks for the setup state only — /api/assistant/status?customerPubkey=‹user.pubkey›&defaults=0', () => {
  const src = safeRead(HOOK);
  assert(src, 'ui/src/hooks/useAssistantSetupState.js not found');
  assert(/\/api\/assistant\/status\?customerPubkey=\$\{[^}]*\buser\??\.pubkey\b[^}]*\}&defaults=0/.test(src),
    'ADR 0003 sub-decision 4: the hook runs on every signed-in dashboard load and never reads the defaults, so it must opt out of the name lookup');
});

// Re-aimed by assistant-profile #5 (ADR 0005 sub-decision 4): the dashboard's "Use the default profile" is gone, so
// the last assertion is inverted — the dashboard publishes no assistant profile at all.
test('W2: the dashboard supplies no assistant profile of its own — no robohash, no kind 0, no sign-as-assistant — and, since assistant-profile #5, publishes none at all', () => {
  const src = codeOnly(safeRead(DASHBOARD));
  assert(src, 'ui/src/pages/Dashboard.jsx not found');
  const found = [];
  if (/robohash/i.test(src)) found.push('a robohash picture');
  if (/signAs\s*:\s*['"]assistant['"]/.test(src)) found.push("signAs: 'assistant'");
  if (/\bkind\s*:\s*0\b/.test(src)) found.push('a kind 0 built in the browser');
  assert(found.length === 0, `AC5 ("every path that publishes an assistant profile starts from this one definition"): Dashboard.jsx still has ${found.join(', ')}`);
  assert(!/['"`]\/api\/assistant\//.test(src),
    'ADR 0005 sub-decision 4: the dashboard posts nothing to /api/assistant/ — its one-click "Use the default profile" is gone; the profile is published on the My Assistant page');
});

test('W3: the editor never puts a relative path into the picture field — not the upload\'s path, not the relative branded image', () => {
  const src = codeOnly(safeRead(EDITOR));
  assert(src, 'ui/src/components/AssistantProfileEditor.jsx not found');
  const found = [];
  if (/updateField\(\s*['"]picture['"][^)]*\bpath\b/.test(src)) found.push("updateField('picture', … path …)");
  if (/updateField\(\s*['"]picture['"][^)]*BRANDED_FALLBACK_SRC/.test(src)) found.push("updateField('picture', … BRANDED_FALLBACK_SRC)");
  assert(found.length === 0, `AC4: no value the app supplies is ever a relative URL — AssistantProfileEditor.jsx still does ${found.join(' and ')}`);
});

/* ───────────────────────── S — server source sentinels ───────────────────────── */

test('S1: no default can read "a customer\'s Tapestry Assistant" — the \'a customer\' fallback is gone from the assistant code (OPEN.md row 154)', () => {
  const dir = path.join(REPO, 'src/api/assistant');
  const offenders = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).filter((f) => /['"`]a customer['"`]/.test(codeOnly(safeRead(path.join(dir, f)))));
  assert(offenders.length === 0, `AC1: still present in ${offenders.join(', ')}`);
});

test('S2: the reference deployment\'s avatar URL is written once — one named constant in profileDefaults.js', () => {
  const needle = 'tapestry.brainstorm.world/ta-avatar.png';
  const hits = [];
  for (const file of jsFilesUnder(path.join(REPO, 'src'))) {
    const count = codeOnly(safeRead(file)).split(needle).length - 1;
    if (count) hits.push([path.relative(REPO, file), count]);
  }
  assert(hits.length === 1 && hits[0][0] === 'src/api/assistant/profileDefaults.js' && hits[0][1] === 1,
    `ADR 0003 sub-decision 8: expected exactly one occurrence, in src/api/assistant/profileDefaults.js — found ${j(hits)}`);
});

test('S3: profileDefaults.js loads in a bare checkout — no top-level require of nostr-tools, ws, the config or settings modules, or the relay helpers', () => {
  const src = safeRead(DEFAULTS_MOD);
  assert(src, 'src/api/assistant/profileDefaults.js does not exist (see I1).');
  const heavy = /nostr-tools|['"]ws['"]|config\/settings|utils\/config|\.\/profileState|\.\/profilePublish/;
  const offenders = src.split('\n').filter((line) => /^(?:const|let|var)\b.*\brequire\s*\(/.test(line) && heavy.test(line));
  assert(offenders.length === 0, `ADR 0003: those are loaded lazily inside the functions that use them. Top-level: ${offenders.join(' | ')}`);
});

test('S4: one notion of "public" — profileDefaults.js uses the SSRF guard\'s classifiers, and index.js\'s isPubliclyReachable keeps no address rules of its own', () => {
  const src = codeOnly(safeRead(DEFAULTS_MOD));
  assert(src, 'src/api/assistant/profileDefaults.js does not exist (see I1).');
  assert(/require\(\s*['"]\.\.\/\.\.\/utils\/ssrfGuard['"]\s*\)/.test(src) && /\bisPublicAddress\b/.test(src) && /\bhasPrivateHostSuffix\b/.test(src),
    'ADR 0003 sub-decision 1 (and ssrfGuard.js:19-21): import isPublicAddress and hasPrivateHostSuffix rather than grow a second, divergent copy');
  const body = codeOnly(functionBody(safeRead(ASSISTANT_SRC), 'isPubliclyReachable'));
  assert(body, 'isPubliclyReachable not found in src/api/assistant/index.js');
  const ownRules = ['localhost', '127.', '::1', '0.0.0.0', '.local'].filter((rule) => body.includes(rule));
  assert(ownRules.length === 0, `OPEN.md row 148: isPubliclyReachable still carries its own address rules (${ownRules.join(', ')}) — delegate to the shared classifier`);
});

/* ───────────────────────── R — regression guards (pass before and after) ───────────────────────── */

// Re-aimed by assistant-profile #5 (ADR 0005 sub-decision 5), as this guard asked: the legacy pages no longer publish,
// so AC5's legacy path is gone — each panel keeps its read-only status and links to the My Assistant page instead.
// Re-aimed again by assistant-management #1 (ADR assistant-management/0001 sub-decision 6): the page each panel links to moved to
// /assistant/profile/edit, as "the Edit Assistant Profile page"; /assistant is now the Assistant Management hub.
test('R1: the legacy pages publish no assistant profile — neither posts publish-profile, and each links to the Edit Assistant Profile page (/assistant/profile/edit)', () => {
  for (const file of [NIP85_PAGE, CUSTOMER_PAGE]) {
    const src = safeRead(file);
    assert(src, `${path.relative(REPO, file)} not found`);
    assert(!src.includes('/api/assistant/publish-profile'),
      `${path.relative(REPO, file)} still posts /api/assistant/publish-profile — ADR 0005 sub-decision 5: the legacy panels publish nothing`);
    assert(/<a\b[^>]*\bhref=["']\/assistant\/profile\/edit["']/.test(src), `${path.relative(REPO, file)} must link to the Edit Assistant Profile page (/assistant/profile/edit)`);
  }
});

test('R2: the editor still offers exactly the seven editable fields, and NIP-05 is not one of them (AC5)', () => {
  const src = safeRead(EDITOR);
  const block = (src.match(/const PROFILE_FIELDS = \[([\s\S]*?)\n\];/) || [])[1] || '';
  const keys = [...block.matchAll(/key:\s*'(\w+)'/g)].map((m) => m[1]);
  assert(j(keys) === j(['name', 'display_name', 'about', 'picture', 'banner', 'website', 'lud16']),
    `AC5: "the user can edit name, display name, about, picture, banner, website and lightning address" — PROFILE_FIELDS keys are ${j(keys)}`);
});

async function run() {
  console.log('\n=== one-default-assistant-profile (assistant-profile #3) ===');
  let pass = 0, fail = 0, skipped = 0;
  const failures = [];
  for (const [name, fn] of tests) {
    try {
      const r = await fn();
      if (r === 'SKIP') { console.log(`  SKIP  ${name}`); skipped++; }
      else { console.log(`  PASS  ${name}`); pass++; }
    } catch (err) {
      console.log(`  FAIL  ${name}\n        ${err.message}`);
      failures.push({ name, message: err.message });
      fail++;
    }
  }
  console.log(`\none-default-assistant-profile: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail === 0 ? 0 : 1));
}
