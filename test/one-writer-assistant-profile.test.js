/**
 * assistant-profile #5: One writer — nothing else can change an assistant's profile.
 *
 * Story: engineering-team/stories/done/assistant-profile/5-one-writer-for-assistant-profiles.md
 * ADR:   engineering-team/decisions/done/assistant-profile/0005-one-writer-for-an-assistants-profile.md
 * Plan:  engineering-team/stories/done/assistant-profile/5-one-writer-for-assistant-profiles.test-plan.md
 * Browser half: tests/brainstorm/one-writer.spec.js (B-class — what the dashboard and the two legacy
 * pages DO).
 *
 * Classes (all stack-free — no strfry, no key store, no relay traffic):
 *   G — the generic signer, POST /api/strfry/publish (handlePublishEvent). Every side effect is stood in
 *       for while a test runs — strfry import (child_process.exec), the brain-write hook, the key store
 *       (a fixture key, never the instance's) and the owner gate (owner-or-admin, as isOwner is) — so a
 *       test sees exactly what the signer WOULD sign and write, and nothing real is ever signed or
 *       written, whatever the code under test does.
 *   P — the one writer that stays, POST /api/assistant/publish-profile, through ADR 0002's seam
 *       (createPublishProfileHandler): it takes exactly the page's publish — a signed-in person, their
 *       own assistant, the form's fields as content — and refuses anything else before touching a key.
 *   W — the dashboard, the legacy pages and the one writer's request, by source: the CI backstop for
 *       the B-class (CI runs no browser).
 *
 * Against current code: G1 and G2 fail (a kind 0 is signed as the TA and handed to strfry, or refused
 * only by the owner gate, with no code), P2, P4, P5 and P6 fail (a publish with no content or for
 * someone else's assistant goes through, or is refused with no code), and W1–W5 fail (the dashboard
 * and both legacy pages still publish). G3, G4, G5, P1, P3 and W6 are guards: they pass before and
 * after, and pin what this story must keep.
 *
 * Re-aimed by assistant-management #1 (ADR assistant-management/0001 sub-decision 6): the one writer's page moved
 * to /assistant/profile/edit and is called "the Edit Assistant Profile page". The refusals must now point there,
 * and the legacy panels must link there; a literal '/assistant' would open the Assistant Management hub. G1, P2,
 * P4, P5 and W4 fail until the refusals and the panels follow the page.
 */

const fs = require('fs');
const path = require('path');
const { generateSecretKey, getPublicKey, finalizeEvent } = require('nostr-tools');

const REPO = path.resolve(__dirname, '..');
const ASSISTANT_SRC = path.join(REPO, 'src/api/assistant/index.js');
const PUBLISH_EVENT = require.resolve(path.join(REPO, 'src/api/strfry/commands/publishEvent.js'));
const AUTH_MOD = require.resolve(path.join(REPO, 'src/middleware/auth.js'));
const KEYS_MOD = require.resolve(path.join(REPO, 'src/utils/assistantKeys.js'));
const BRAIN_MOD = require.resolve(path.join(REPO, 'src/api/strfry/tapestryBrainWrite.js'));
const DASHBOARD = path.join(REPO, 'ui/src/pages/Dashboard.jsx');
const EDITOR = path.join(REPO, 'ui/src/components/AssistantProfileEditor.jsx');
const UI_SRC = path.join(REPO, 'ui/src');
const PUBLIC_DIR = path.join(REPO, 'public');
const LEGACY = {
  'the legacy NIP-85 page (public/pages/nip85.html)': {
    file: path.join(REPO, 'public/pages/nip85.html'),
    // The blocks the panel's loader shows and hides — the link to the page must sit outside all three.
    blocks: ['ownerAssistantLoading', 'ownerAssistantContent', 'ownerAssistantNoKey'],
  },
  'the legacy customer page (public/pages/customers/customer.html)': {
    file: path.join(REPO, 'public/pages/customers/customer.html'),
    blocks: ['assistantLoading', 'assistantContent', 'assistantNoKey'],
  },
};

// Fixture keys — never live ones.
const OWNER = 'bb'.repeat(32);
const ADMIN = 'ad'.repeat(32);
const CUSTOMER = 'cc'.repeat(32);
const STRANGER = 'dd'.repeat(32);
const NAMES = { [OWNER]: 'Olivia', [ADMIN]: 'Adam', [CUSTOMER]: 'Carmen' };
const WHO = { [OWNER]: 'the Owner', [ADMIN]: 'an Admin', [CUSTOMER]: 'a Customer' };

// A fixture key standing in for the instance's Tapestry Assistant: the generic signer is only ever handed
// this one, so even code that signs what it should refuse signs nothing real.
const TA_SK = generateSecretKey();
const TA_KEYS = { pubkey: getPublicKey(TA_SK), privkey: Buffer.from(TA_SK).toString('hex') };

// The ADR's fixed values.
const MY_ASSISTANT = '/assistant/profile/edit';   // the one writer's page since assistant-management #1
const PUBLIC = { domain: 'staging.brainstorm.world', isPublic: true, website: 'https://staging.brainstorm.world', avatarUrl: 'https://staging.brainstorm.world/ta-avatar.png' };
/** What the page's form sends: the seven editable fields, some of them empty (ADR 0003 sub-decision 7). */
const FORM = {
  name: "Fixture's Tapestry Assistant", display_name: "Fixture's Tapestry Assistant", about: 'Edited on the My Assistant page.',
  picture: 'https://img.example/fixture.png', banner: '', website: '', lud16: '',
};

const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
function safeRead(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }
const j = (v) => JSON.stringify(v);
const rel = (p) => path.relative(REPO, p);

/** Source with comments removed, leaving `https://` inside strings intact. */
function codeOnly(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');
}

/**
 * A refusal's explanation must say where profiles are published: the Edit Assistant Profile page, at
 * /assistant/profile/edit (re-aimed by assistant-management #1; it was "the My Assistant page, at /assistant").
 */
function pointsToThePage(error) {
  return typeof error === 'string' && /Edit Assistant Profile page/.test(error) && error.includes(`(${MY_ASSISTANT})`);
}

/** An answer, short enough to read in a failure message. */
function summary(res) {
  const b = res.body || {};
  const shown = { success: b.success, code: b.code, error: b.error, message: b.message };
  if (b.event) shown.event = `‹a signed kind ${j(b.event.kind)} by ${String(b.event.pubkey).slice(0, 8)}…›`;
  return `${res.statusCode} ${j(shown)}`;
}

/** Fail once, listing every case that went wrong — so one failing case never hides the others. */
function assertNoProblems(problems, lead) {
  assert(problems.length === 0, `${lead}\n          - ${problems.join('\n          - ')}`);
}

function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

// ─── G's harness: the generic signer, with every side effect stood in for ─────────────────────────

const cp = require('child_process');

/**
 * Run `body(handle, seen)` against a fresh copy of publishEvent.js whose side effects are stand-ins, in
 * place for the whole call — whether the module binds them when it loads (today's
 * `const { exec } = require('child_process')`) or looks them up when it runs:
 *   - strfry import: child_process.exec records the command and every event written to its stdin, and
 *     answers as a successful import;
 *   - the brain-write hook, counted;
 *   - the key store: getOwnerAssistantKeys counts its reads and returns the fixture TA key;
 *   - the owner gate: isOwner admits an authenticated Owner or Admin session — owner-OR-admin, as
 *     src/middleware/auth.js:276-293 does.
 * Everything is put back afterwards, including any copy of each module that was already loaded.
 */
async function withSigner(body) {
  const seen = { commands: [], imports: [], keyReads: 0, brainWrites: 0 };
  const savedExec = cp.exec;
  const savedModules = new Map();
  const stub = (file, exports) => {
    savedModules.set(file, require.cache[file]);
    require.cache[file] = { id: file, filename: file, loaded: true, exports };
  };
  const signedIn = (req) => (req && req.session && req.session.authenticated ? req.session.pubkey : null);

  cp.exec = (command, options, callback) => {
    const cb = typeof options === 'function' ? options : callback;
    seen.commands.push(String(command));
    let written = '';
    // Enough of a ChildProcess that listening for events on it or its streams is harmless.
    const emitter = (extra = {}) => { const e = { ...extra }; e.on = () => e; e.once = () => e; return e; };
    const child = emitter({
      stdin: emitter({
        write: (chunk) => { written += String(chunk); return true; },
        end: () => {
          for (const line of written.split('\n').filter((l) => l.trim())) {
            try { seen.imports.push(JSON.parse(line)); } catch { seen.imports.push(line); }
          }
          if (typeof cb === 'function') setImmediate(() => cb(null, '', ''));
        },
      }),
      stdout: emitter(),
      stderr: emitter(),
      kill: () => true,
    });
    return child;
  };
  stub(BRAIN_MOD, {
    maybeBrainWriteTapestry: async () => { seen.brainWrites++; return null; },
    isOwnedTapestryEvent: () => false,
  });
  stub(KEYS_MOD, {
    getOwnerAssistantKeys: async () => { seen.keyReads++; return { ...TA_KEYS }; },
    getAssistantKeys: async () => { seen.keyReads++; return { ...TA_KEYS }; },
    getOwnerAssistantPubkey: () => TA_KEYS.pubkey,
  });
  stub(AUTH_MOD, {
    isOwner: (req) => [OWNER, ADMIN].includes(signedIn(req)),
    isOwnerOrAdmin: (req) => [OWNER, ADMIN].includes(signedIn(req)),
  });
  savedModules.set(PUBLISH_EVENT, require.cache[PUBLISH_EVENT]);
  delete require.cache[PUBLISH_EVENT];
  try {
    const { handlePublishEvent } = require(PUBLISH_EVENT);
    assert(typeof handlePublishEvent === 'function', 'src/api/strfry/commands/publishEvent.js no longer exports handlePublishEvent');
    return await body(handlePublishEvent, seen);
  } finally {
    cp.exec = savedExec;
    for (const [file, saved] of savedModules) {
      if (saved) require.cache[file] = saved; else delete require.cache[file];
    }
  }
}

/** A request to the generic signer. `session` is a pubkey (signed in) or null; `localTrusted` is the operator. */
function signerReq({ event, signAs = 'assistant', session = null, localTrusted = false }) {
  const req = { method: 'POST', path: '/api/strfry/publish', headers: {}, body: { event, signAs } };
  req.session = session ? { authenticated: true, pubkey: session } : {};
  if (localTrusted) req.localTrusted = true;
  return req;
}
async function askSigner(handle, reqOpts) {
  const res = fakeRes();
  await handle(signerReq(reqOpts), res);
  return res;
}

// Everyone who can reach the generic signer's assistant branch today, and a visitor who cannot.
const SIGNER_CALLERS = [
  ['a visitor who is not signed in', { session: null }],
  ['the Owner', { session: OWNER }],
  ['an Admin (the owner gate is owner-or-admin)', { session: ADMIN }],
  ['the in-container operator (req.localTrusted)', { localTrusted: true }],
];
const PROFILE = () => ({ kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: j({ name: 'Not from the My Assistant page' }) });

/* ───────────────────────── G — the generic signer ───────────────────────── */

/** What went wrong with one refused kind-0 request, or [] when it was refused as the ADR says. */
function kind0Problems(res, seen, before) {
  const why = [];
  const refused = res.statusCode === 403 && res.body && res.body.success === false && res.body.code === 'one-writer';
  if (!refused) why.push(`answered ${summary(res)}`);
  else if (!pointsToThePage(res.body.error)) why.push(`its error does not point to the Edit Assistant Profile page (/assistant/profile/edit): ${j(res.body.error)}`);
  const wrote = seen.imports.slice(before.imports);
  if (wrote.length) why.push(`handed ${wrote.length} event(s) to strfry import (kind ${wrote.map((e) => j(e.kind)).join(', ')})`);
  if (seen.brainWrites > before.brainWrites) why.push('ran the brain-write hook');
  if (seen.keyReads > before.keyReads) why.push(`read the key store ${seen.keyReads - before.keyReads}×${refused ? ' before refusing' : ''}`);
  return why;
}
const mark = (seen) => ({ imports: seen.imports.length, keyReads: seen.keyReads, brainWrites: seen.brainWrites });

test('G1: asked to sign a kind 0 as the assistant, the generic signer refuses — 403, code "one-writer", an explanation that points to the My Assistant page — and signs, reads and writes nothing, whoever asks', async () => {
  await withSigner(async (handle, seen) => {
    const problems = [];
    for (const [who, reqOpts] of SIGNER_CALLERS) {
      const before = mark(seen);
      const res = await askSigner(handle, { ...reqOpts, event: PROFILE() });
      const why = kind0Problems(res, seen, before);
      if (why.length) problems.push(`${who}: ${why.join('; ')}`);
    }
    assertNoProblems(problems,
      'AC3 ("refused with an explanation, and no event is written anywhere"), ADR 0005 sub-decision 3 — expected 403 { success: false, ' +
      'code: \'one-writer\' } pointing to the Edit Assistant Profile page (/assistant/profile/edit), before any key is read:');
  });
});

test('G2: a kind that is signed as 0 is refused the same way — -0, which a JSON body can carry and which signs as kind 0', async () => {
  await withSigner(async (handle, seen) => {
    const problems = [];
    for (const [who, reqOpts] of SIGNER_CALLERS) {
      const before = mark(seen);
      const res = await askSigner(handle, { ...reqOpts, event: { ...PROFILE(), kind: JSON.parse('-0') } });
      const why = kind0Problems(res, seen, before);
      if (why.length) problems.push(`${who}: ${why.join('; ')}`);
    }
    assertNoProblems(problems, 'ADR 0005 sub-decision 3 ("every number that serializes as 0 is === 0") — kind -0 (JSON writes it as 0) must be refused like 0:');
  });
});

test('G3: a kind that is not a number is never signed as a kind 0 — "0", null, "" — whether it is refused or fails to sign (guard)', async () => {
  await withSigner(async (handle, seen) => {
    for (const kind of ['0', null, '']) {
      for (const [who, reqOpts] of SIGNER_CALLERS) {
        const res = await askSigner(handle, { ...reqOpts, event: { ...PROFILE(), kind } });
        const signed = res.body && res.body.event;
        assert(!(signed && Number(signed.kind) === 0 && signed.kind !== null && signed.kind !== ''),
          `kind ${j(kind)}, ${who}: the signer answered with a signed kind ${j(signed && signed.kind)}`);
      }
    }
    const zeros = seen.imports.filter((e) => e && typeof e === 'object' && e.kind === 0);
    assert(zeros.length === 0, `no kind 0 may reach strfry — got ${j(zeros)}`);
  });
});

test('G4: every other kind goes the old way — a visitor still meets the owner gate (not "one-writer"), and the operator\'s kind 1 is still signed with the assistant\'s key and handed to strfry (guard)', async () => {
  await withSigner(async (handle, seen) => {
    const visitor = await askSigner(handle, { event: { kind: 1, tags: [], content: 'hello' } });
    assert(visitor.statusCode === 403 && visitor.body && visitor.body.code !== 'one-writer',
      `a visitor's kind 1 is refused by the owner gate, as before — got ${visitor.statusCode} ${j(visitor.body)}`);
    assert(seen.imports.length === 0, 'the owner gate writes nothing');

    const operator = await askSigner(handle, { event: { kind: 1, tags: [['t', 'fixture']], content: 'hello' }, localTrusted: true });
    const ev = operator.body && operator.body.event;
    assert(operator.statusCode === 200 && operator.body.success === true && ev && ev.kind === 1 && ev.pubkey === TA_KEYS.pubkey,
      `the refusal is for kind 0 only: the operator's kind 1 is signed as the assistant — got ${operator.statusCode} ${j(operator.body)}`);
    assert(seen.imports.length === 1 && seen.imports[0].id === ev.id && seen.commands.every((c) => /strfry import/.test(c)),
      `…and handed to strfry import, once — got ${j(seen.commands)} with ${seen.imports.length} event(s)`);
  });
});

test('G5: the client path is unchanged — a kind 0 its own author signed is verified and published as before (principle 2: publication stays permissionless) (guard)', async () => {
  await withSigner(async (handle, seen) => {
    const sk = generateSecretKey();
    const own = finalizeEvent({ kind: 0, created_at: Math.floor(Date.now() / 1000), tags: [], content: j({ name: 'Someone\'s own profile' }) }, sk);
    const res = await askSigner(handle, { event: JSON.parse(j(own)), signAs: 'client' });
    assert(res.statusCode === 200 && res.body && res.body.success === true,
      `ADR 0005 sub-decision 3 ("the client path is unchanged"): a self-signed kind 0 still publishes — got ${res.statusCode} ${j(res.body)}`);
    assert(seen.imports.length === 1 && seen.imports[0].id === own.id, `…and reaches strfry import unchanged — got ${seen.imports.length} import(s)`);
    assert(seen.keyReads === 0, 'the client path signs nothing, so it reads no key');
  });
});

/* ───────────────────────── P — publish-profile, through its seam ───────────────────────── */

function getIndex() { return require(ASSISTANT_SRC); }
function getPublishFactory() {
  const mod = getIndex();
  if (typeof mod.createPublishProfileHandler !== 'function') {
    throw new Error('src/api/assistant/index.js does not export createPublishProfileHandler(deps) (ADR assistant-profile/0002).');
  }
  return mod.createPublishProfileHandler;
}

/**
 * The publish seam's dependencies: every role has an assistant, and every call that looks something up,
 * signs, saves or sends is counted. A refusal must leave all of them at zero.
 */
function publishFakes(opts = {}) {
  const keys = {};
  for (const person of [OWNER, ADMIN, CUSTOMER, STRANGER]) {
    const sk = generateSecretKey();
    keys[person] = { sk, pubkey: getPublicKey(sk) };
  }
  const calls = { keys: [], personName: [], importEvent: [], nip05: [], publishToRelays: [], settings: 0 };
  const deps = {
    getAssistantKeys: async (pk) => { calls.keys.push(pk); return keys[pk] ? { pubkey: keys[pk].pubkey, privkey: Buffer.from(keys[pk].sk).toString('hex') } : null; },
    getOwnerPubkey: () => OWNER,
    getPersonName: async (pk, options) => { calls.personName.push({ pubkey: pk, options }); return NAMES[pk] || ''; },
    describeInstance: () => opts.instance || PUBLIC,
    importEvent: async (event) => { calls.importEvent.push(event); },
    updateNip05Mapping: (localPart, pubkey) => { calls.nip05.push([localPart, pubkey]); },
    isLocalOnly: () => false,
    getSettings: () => { calls.settings++; return { aRelays: { aPopularGeneralPurposeRelays: ['wss://relay.example.test'], aProfileRelays: [], aWotRelays: [] } }; },
    publishToRelays: async (event, relays) => {
      calls.publishToRelays.push({ event, relays });
      return relays.map((relay) => ({ relay, status: 'accepted', reason: '' }));
    },
    now: () => 1_700_000_000_000,
  };
  return { deps, calls, keys };
}

/**
 * A publish-profile request. `session` is a pubkey (signed in), null (no session — the in-container
 * operator's case), or { pubkey, authenticated } for a hand-built one. `content` is omitted when undefined.
 */
function publishReq({ customerPubkey, session = null, content, localTrusted = false }) {
  const body = { customerPubkey };
  if (content !== undefined) body.content = content;
  const req = { body, query: {} };
  if (session === null) req.session = {};
  else if (typeof session === 'string') req.session = { authenticated: true, pubkey: session };
  else req.session = session;
  if (localTrusted) req.localTrusted = true;
  return req;
}
async function publish(reqOpts, fakeOpts = {}) {
  const f = publishFakes(fakeOpts);
  const res = fakeRes();
  await getPublishFactory()(f.deps)(publishReq(reqOpts), res);
  return { res, calls: f.calls, keys: f.keys };
}
/** Did the handler look anything up, sign, save, map or send? */
function touched(calls) {
  const out = [];
  if (calls.keys.length) out.push(`read the assistant key ${calls.keys.length}×`);
  if (calls.personName.length) out.push(`looked up a name ${calls.personName.length}×`);
  if (calls.importEvent.length) out.push(`saved ${calls.importEvent.length} event(s) on the local relay`);
  if (calls.nip05.length) out.push(`wrote ${calls.nip05.length} NIP-05 mapping(s)`);
  if (calls.publishToRelays.length) out.push(`sent to relays ${calls.publishToRelays.length}×`);
  if (calls.settings) out.push(`read the relay settings ${calls.settings}×`);
  return out;
}
function signedContent(event) { try { return JSON.parse(event.content); } catch { return null; } }
/** What went wrong with one request publish-profile should refuse, or [] when it was refused as the ADR says. */
function refusalProblems(res, calls, status, code) {
  const why = [];
  if (!(res.statusCode === status && res.body && res.body.success === false && res.body.code === code)) why.push(`answered ${summary(res)}`);
  else if (!pointsToThePage(res.body.error)) why.push(`its error does not point to the Edit Assistant Profile page (/assistant/profile/edit): ${j(res.body.error)}`);
  const did = touched(calls);
  if (did.length) why.push(`the handler ${did.join(', ')}`);
  return why;
}

test('P1: the page\'s own publish goes through — a signed-in Owner, Admin or Customer publishing their own assistant\'s profile from the form: signed by their own assistant, saved here first, sent to the relays (guard)', async () => {
  for (const person of [OWNER, ADMIN, CUSTOMER]) {
    const { res, calls, keys } = await publish({ customerPubkey: person, session: person, content: { ...FORM } });
    assert(res.statusCode === 200 && res.body && res.body.success === true,
      `AC3 / AC4 ("they can still manage their own assistant's"), ${WHO[person]}: expected 200 — got ${res.statusCode} ${j(res.body)}`);
    const ev = calls.importEvent[0];
    assert(calls.importEvent.length === 1 && ev.kind === 0 && ev.pubkey === keys[person].pubkey,
      `${WHO[person]}: one kind 0, signed by THEIR OWN assistant, saved on this instance's relay — got ${j(calls.importEvent.map((e) => ({ kind: e.kind, pubkey: e.pubkey.slice(0, 8) })))}`);
    const content = signedContent(ev);
    assert(content && content.name === FORM.name && content.about === FORM.about && content.picture === FORM.picture,
      `${WHO[person]}: what was signed is the form's fields — got ${j(content)}`);
    assert(calls.publishToRelays.length === 1 && calls.publishToRelays[0].event.id === ev.id,
      `${WHO[person]}: the same event goes to the relays (ADR 0002) — got ${calls.publishToRelays.length} send(s)`);
  }
});

test('P2: a publish that carries no profile is refused — 400, code "no-content", an explanation that points to the My Assistant page — and nothing is looked up, signed, saved or sent', async () => {
  const shapes = [
    ['no content at all (what the legacy pages and "Use the default profile" sent)', undefined],
    ['content: null', null],
    ['content: a string', 'Olivia\'s assistant'],
    ['content: a number', 42],
    ['content: true', true],
    ['content: an empty array', []],
    ['content: an array holding the form', [{ ...FORM }]],
  ];
  const problems = [];
  for (const [what, content] of shapes) {
    const { res, calls } = await publish({ customerPubkey: CUSTOMER, session: CUSTOMER, content });
    const why = refusalProblems(res, calls, 400, 'no-content');
    if (why.length) problems.push(`${what}: ${why.join('; ')}`);
  }
  assertNoProblems(problems,
    'AC3 (ADR 0005 sub-decision 2) — a signed-in Customer publishing their own assistant with no profile: expected 400 { success: false, ' +
    'code: \'no-content\' } pointing to the Edit Assistant Profile page (/assistant/profile/edit), touching no key, no relay and no settings:');
});

test('P3: an emptied profile — content {} — is still the page\'s publish: it is published, and the finishing step still applies (on a public instance, only the server\'s NIP-05 and the client tag) (guard)', async () => {
  const { res, calls, keys } = await publish({ customerPubkey: CUSTOMER, session: CUSTOMER, content: {} });
  assert(res.statusCode === 200 && res.body && res.body.success === true, `ADR 0005 sub-decision 2 ("What accepts an empty object") — got ${res.statusCode} ${j(res.body)}`);
  const ev = calls.importEvent[0];
  const content = ev && signedContent(ev);
  const suffix = keys[CUSTOMER].pubkey.slice(-6);
  assert(content && j(Object.keys(content)) === j(['nip05']) && content.nip05 === `carmen-tapestry-assistant-${suffix}@${PUBLIC.domain}`,
    `the finishing step (ADR 0003) still sets the server-managed NIP-05 and nothing else — got ${j(content)}`);
  assert(j(ev.tags) === j([['client', PUBLIC.domain]]), `…and the client tag — got ${j(ev && ev.tags)}`);
});

test('P4: publishing anyone\'s assistant but your own is refused — 403, code "not-your-assistant", an explanation that points to the My Assistant page — and nothing is looked up, signed, saved or sent', async () => {
  const callers = [
    ['the Owner, publishing a Customer\'s assistant', { customerPubkey: CUSTOMER, session: OWNER }],
    ['an Admin, publishing the instance TA (the Owner\'s assistant)', { customerPubkey: OWNER, session: ADMIN }],
    ['a signed-in stranger, publishing a Customer\'s assistant', { customerPubkey: CUSTOMER, session: STRANGER }],
    ['the in-container operator, with no session', { customerPubkey: OWNER, session: null, localTrusted: true }],
    ['a session that carries the Customer\'s pubkey but is not signed in', { customerPubkey: CUSTOMER, session: { pubkey: CUSTOMER } }],
  ];
  const problems = [];
  for (const [who, reqOpts] of callers) {
    const { res, calls } = await publish({ ...reqOpts, content: { ...FORM } });
    const why = refusalProblems(res, calls, 403, 'not-your-assistant');
    if (why.length) problems.push(`${who}: ${why.join('; ')}`);
  }
  assertNoProblems(problems,
    'AC3 + epic decision 4 (ADR 0005 sub-decision 2) — expected 403 { success: false, code: \'not-your-assistant\' } pointing to ' +
    'the Edit Assistant Profile page (/assistant/profile/edit), touching no key, no relay and no settings:');
});

test('P5: whose comes before what — someone else\'s assistant with no profile is refused as not theirs (403 "not-your-assistant"), not as empty (400)', async () => {
  const problems = [];
  for (const [who, reqOpts] of [
    ['the Owner, for a Customer', { customerPubkey: CUSTOMER, session: OWNER }],
    ['a stranger, for a Customer', { customerPubkey: CUSTOMER, session: STRANGER }],
  ]) {
    const { res, calls } = await publish(reqOpts);
    const why = refusalProblems(res, calls, 403, 'not-your-assistant');
    if (why.length) problems.push(`${who}, with no content: ${why.join('; ')}`);
  }
  assertNoProblems(problems, 'ADR 0005 sub-decision 2 (the "whose" check runs before the "what" check):');
});

test('P6: an Admin has no route to the instance Tapestry Assistant\'s profile — publish-profile refuses them the TA, the generic signer refuses them a kind 0 — and they still publish their own assistant\'s', async () => {
  const problems = [];
  const ta = await publish({ customerPubkey: OWNER, session: ADMIN, content: { ...FORM } });
  const taWhy = refusalProblems(ta.res, ta.calls, 403, 'not-your-assistant');
  if (taWhy.length) problems.push(`publish-profile, for the TA: ${taWhy.join('; ')}`);
  await withSigner(async (handle, seen) => {
    // An Admin passes the generic signer's owner gate (isOwner is owner-or-admin), so only the kind-0
    // refusal stands between them and the TA's profile.
    const before = mark(seen);
    const res = await askSigner(handle, { event: PROFILE(), session: ADMIN });
    const why = kind0Problems(res, seen, before);
    if (why.length) problems.push(`the generic signer, a kind 0 as the TA: ${why.join('; ')}`);
  });
  const own = await publish({ customerPubkey: ADMIN, session: ADMIN, content: { ...FORM } });
  if (!(own.res.statusCode === 200 && own.calls.importEvent.length === 1 && own.calls.importEvent[0].pubkey === own.keys[ADMIN].pubkey)) {
    problems.push(`their own assistant's profile ("they can still manage their own assistant's"): ${summary(own.res)}`);
  }
  assertNoProblems(problems, 'AC4 — no route lets an Admin change the instance Tapestry Assistant\'s profile:');
});

/* ───────────────────────── W — the dashboard, the legacy pages and the one writer's request, by source ───────────────────────── */

// JSX is read with the root `typescript` dependency's parser (package.json), as test/my-assistant-page.test.js
// does — a library call, not a lint or typecheck step.
let tsLib = null;
function ts() {
  if (!tsLib) {
    try { tsLib = require('typescript'); } catch (err) {
      throw new Error(`test/one-writer-assistant-profile.test.js parses JSX with the root "typescript" dependency and could not load it (${err.message}).`);
    }
  }
  return tsLib;
}
function parse(file) {
  const src = safeRead(file);
  return src ? ts().createSourceFile(file, src, ts().ScriptTarget.Latest, true, ts().ScriptKind.JSX) : null;
}
function walk(node, visit) { visit(node); ts().forEachChild(node, (child) => walk(child, visit)); }
const norm = (text) => text.replace(/\?\./g, '.').replace(/\s+/g, '');
/** The function or const component named `name`. */
function declarationOf(sf, name) {
  let found = null;
  if (sf) walk(sf, (n) => {
    if (found) return;
    if (ts().isFunctionDeclaration(n) && n.name && n.name.text === name) found = n;
    else if (ts().isVariableDeclaration(n) && ts().isIdentifier(n.name) && n.name.text === name && n.initializer) found = n.initializer;
  });
  return found;
}
/** Every JSX element (opening or self-closing) under `node` whose tag is `tag`. */
function jsxTags(node, tag) {
  const out = [];
  if (node) walk(node, (n) => { if ((ts().isJsxOpeningElement(n) || ts().isJsxSelfClosingElement(n)) && n.tagName.getText() === tag) out.push(n); });
  return out;
}
const attrs = (el) => el.attributes.properties.filter((p) => ts().isJsxAttribute(p));
const attrValue = (a) => (a.initializer && ts().isJsxExpression(a.initializer) && a.initializer.expression ? norm(a.initializer.expression.getText()) : null);

test('W1: the dashboard\'s welcome card has one action — "Set up my Assistant\'s profile", which leads to the My Assistant page — and the dashboard neither publishes a profile nor offers "Use the default profile"', () => {
  const sf = parse(DASHBOARD);
  assert(sf, 'ui/src/pages/Dashboard.jsx not found');
  const card = declarationOf(sf, 'WelcomeCard');
  assert(card, 'Dashboard.jsx has no WelcomeCard — the prompt the setup check shows');
  const buttons = jsxTags(card, 'button');
  assert(buttons.length === 1,
    `AC1 ("its only assistant action is the link to the My Assistant page"), ADR 0005 sub-decision 4: WelcomeCard renders ${buttons.length} buttons — ` +
    `${buttons.map((b) => b.parent.getText().replace(/\s+/g, ' ').slice(0, 90)).join(' | ')}`);
  const onClick = attrs(buttons[0]).find((a) => a.name.getText() === 'onClick');
  assert(onClick && attrValue(onClick) === 'onSetupProfile', `the one button is wired to onSetupProfile — got ${onClick ? attrValue(onClick) : 'no onClick'}`);
  const uses = jsxTags(sf, 'WelcomeCard');
  assert(uses.length >= 1, 'the dashboard never renders WelcomeCard');
  for (const use of uses) {
    const given = attrs(use).map((a) => a.name.getText());
    assert(j(given) === j(['onSetupProfile']), `WelcomeCard is given only onSetupProfile — got ${j(given)}`);
    const to = attrValue(attrs(use)[0]) || '';
    assert(/navigate\((MY_ASSISTANT_PATH|['"]\/assistant\/profile\/edit['"])\)/.test(to), `onSetupProfile leads to the editor, MY_ASSISTANT_PATH — got ${to}`);
  }
  const src = codeOnly(safeRead(DASHBOARD));
  const found = [];
  if (/Use the default profile/.test(src)) found.push('"Use the default profile"');
  if (/\/api\/assistant\/publish-profile/.test(src)) found.push('a POST to /api/assistant/publish-profile');
  if (/\/api\/strfry\/publish/.test(src)) found.push('a POST to /api/strfry/publish');
  assert(found.length === 0, `AC1: the dashboard offers no way to write the assistant's profile — it still has ${found.join(' and ')}`);
});

test('W2: neither legacy page publishes an assistant profile — no publish-profile call, no sign-as-assistant, no "Publish Kind 0 Profile" button', () => {
  for (const [where, { file }] of Object.entries(LEGACY)) {
    const src = safeRead(file);
    assert(src, `${rel(file)} not found`);
    const found = [];
    if (src.includes('/api/assistant/publish-profile')) found.push('a POST to /api/assistant/publish-profile');
    if (/signAs/.test(src)) found.push('a sign-as request');
    if (/Publish Kind 0 Profile/i.test(src)) found.push('a "Publish Kind 0 Profile" button');
    assert(found.length === 0, `AC2 ("they no longer publish an assistant profile"), ADR 0005 sub-decision 5: ${where} still has ${found.join(', ')}`);
  }
});

test('W3: each legacy panel keeps its read-only status — the assistant\'s pubkey and "Profile Status" — asked about the signed-in person with defaults=0, which it never reads', () => {
  for (const [where, { file }] of Object.entries(LEGACY)) {
    const src = safeRead(file);
    const asks = [...src.matchAll(/fetch\(\s*`\/api\/assistant\/status\?([^`]*)`/g)].map((m) => m[1]);
    assert(asks.length >= 1, `${where}: the panel no longer asks /api/assistant/status — ADR 0005 keeps its read-only status`);
    assert(asks.every((q) => /customerPubkey=\$\{[^}]+\}/.test(q) && /(^|&)defaults=0(&|$)/.test(q)),
      `ADR 0005 sub-decision 5 ("Ask with &defaults=0"), ${where}: every status request must carry defaults=0 — got ${j(asks)}`);
    assert(/Assistant Pubkey:/.test(src) && /Profile Status:/.test(src),
      `ADR 0005 sub-decision 5 ("Keep the read-only status"), ${where}: the pubkey and "Profile Status" rows are gone`);
  }
});

// ─── A balanced-tag reader for the hand-written legacy HTML (no HTML parser is installed, and none is added) ───

/** [start, end) of the element that opens at `openAt`, found by counting its tag's opens and closes. */
function elementSpan(html, openAt) {
  const tag = (html.slice(openAt).match(/^<([a-zA-Z][\w-]*)/) || [])[1];
  if (!tag) return null;
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, 'gi');
  re.lastIndex = openAt;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[0].endsWith('/>')) continue;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [openAt, m.index + m[0].length];
  }
  return null;
}
/** The span of the element carrying id="`id`". */
function spanOfId(html, id) {
  const at = html.search(new RegExp(`<[a-zA-Z][\\w-]*\\b[^>]*\\bid=["']${id}["']`));
  return at < 0 ? null : elementSpan(html, at);
}
/** The span of the innermost element that opens before `span` and closes after it, and contains a heading. */
function panelAround(html, span) {
  const opens = [...html.slice(0, span[0]).matchAll(/<div\b[^>]*>/gi)].map((m) => m.index).reverse();
  for (const at of opens) {
    const s = elementSpan(html, at);
    if (s && s[1] >= span[1] && /<h[1-6]\b/i.test(html.slice(s[0], s[1]))) return s;
  }
  return null;
}

test('W4: each legacy panel links to the My Assistant page in every state — the link sits in the panel, outside the blocks its loader shows and hides', () => {
  for (const [where, { file, blocks }] of Object.entries(LEGACY)) {
    const html = safeRead(file).replace(/<!--[\s\S]*?-->/g, (c) => ' '.repeat(c.length));
    const spans = blocks.map((id) => [id, spanOfId(html, id)]);
    const missing = spans.filter(([, s]) => !s).map(([id]) => id);
    assert(missing.length === 0, `${where}: the panel's state blocks are gone (${missing.join(', ')}) — ADR 0005 keeps the read-only status`);
    const panel = panelAround(html, spans[0][1]);
    assert(panel, `${where}: could not find the assistant panel around #${blocks[0]}`);
    let outside = html.slice(panel[0], panel[1]);
    for (const [, [s, e]] of spans.slice().sort((a, b) => b[1][0] - a[1][0])) {
      if (s >= panel[0] && e <= panel[1]) outside = outside.slice(0, s - panel[0]) + ' '.repeat(e - s) + outside.slice(e - panel[0]);
    }
    const links = [...outside.matchAll(/<a\b[^>]*\bhref=["']([^"']*)["'][^>]*>/gi)].map((m) => m[1]);
    assert(links.includes(MY_ASSISTANT),
      `AC2 ("…and a link to the My Assistant page"), ADR 0005 sub-decision 5 ("a link that shows in every state"), ${where}: ` +
      `no <a href="${MY_ASSISTANT}"> in the panel outside #${blocks.join(', #')} — links there: ${j(links)}`);
  }
});

/** Every file under `dir` whose name matches `re`, skipping node_modules and `skip` (absolute paths). */
function filesUnder(dir, re, skip = []) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (skip.includes(p)) continue;
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') out.push(...filesUnder(p, re, skip)); } else if (re.test(entry.name)) out.push(p);
  }
  return out;
}

test('W5: in the app, one thing posts to /api/assistant/publish-profile — the My Assistant page\'s editor; nothing else under ui/src or public/ does (the April build in public/kg aside: OPEN.md #68, and the server refuses its kind 0)', () => {
  const candidates = [
    ...filesUnder(UI_SRC, /\.(jsx?|mjs)$/),
    ...filesUnder(PUBLIC_DIR, /\.(html?|jsx?|mjs)$/, [path.join(PUBLIC_DIR, 'kg')]),
  ];
  const posters = candidates
    .filter((f) => {
      const src = /\.html?$/.test(f) ? safeRead(f).replace(/<!--[\s\S]*?-->/g, '') : codeOnly(safeRead(f));
      return src.includes('/api/assistant/publish-profile');
    })
    .map(rel)
    .sort();
  assert(j(posters) === j([rel(EDITOR)]),
    `AC1 + AC2 + AC3 — one writer: expected only [${rel(EDITOR)}] to post publish-profile — got ${j(posters)}`);
});

test('W6: the one writer sends what the server now requires — the signed-in person\'s own pubkey, and the form as content (guard)', () => {
  const publishFn = declarationOf(parse(EDITOR), 'publish');
  const body = publishFn ? norm(codeOnly(publishFn.getText())) : '';
  assert(body, 'AssistantProfileEditor.jsx has no publish()');
  assert(body.includes("fetch('/api/assistant/publish-profile'") || body.includes('fetch("/api/assistant/publish-profile"'),
    'publish() posts /api/assistant/publish-profile');
  assert(/JSON\.stringify\(\{customerPubkey,content:form\}\)/.test(body),
    `ADR 0005 sub-decision 1: the page's publish is { customerPubkey, content: form } — a publish without content is now refused (400) — got ${body.slice(0, 400)}`);
});

async function run() {
  console.log('\n=== one-writer-assistant-profile (assistant-profile #5) ===');
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
  console.log(`\none-writer-assistant-profile: ${pass} passed, ${fail} failed, ${skipped} skipped`);
  return { pass, fail, failures, skipped };
}

module.exports = { run };

if (require.main === module) {
  run().then((r) => process.exit(r.fail === 0 ? 0 : 1));
}
