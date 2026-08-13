#!/usr/bin/env node
/*
 * magic-carpet-agent — the thin tool surface both Claude Code agents drive.
 *
 *   User agent (runs anywhere, signs locally with MC_NSEC):
 *     auth-login                         verify-user → sign kind-22242 → login-user
 *     discover [--eligible] [--limit N]  list open / eligible bounties
 *     create-list --singular <name> ...  sign+publish a kind-39998/9998 list header
 *     create-bounty --list <coord> ...   POST /api/bounties (needs a prior auth-login)
 *     submit --bounty <id> --content <t> sign+publish a kind-39999 claim (keyless)
 *     negotiate send --bounty <id> ...   publish a kind-1111 negotiation comment
 *     negotiate scan --bounty <id>       read the negotiation thread off the relay
 *
 *   Operator / server-side (needs DB + wallet on the box):
 *     balance                            wallet float
 *     provision-delegate --issuer <pk>   mint + store an issuer delegate key
 *     pay --bounty <id> --claim <id>     pay one payable claim [--dry-run]
 *
 * Output is JSON on stdout (agents parse it); errors are JSON on stderr, exit 1.
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { finalizeEvent, getPublicKey, nip19 } = require('nostr-tools');

const BASE = (process.env.MC_BASE_URL || 'http://localhost:7778').replace(/\/$/, '');
const JAR_PATH = process.env.MC_COOKIE_JAR || path.join(os.homedir(), '.magic-carpet-agent-cookies.json');
const NEGOTIATION_KIND = 1111;
const NEGOTIATION_TOPIC = 'mc-bounty-negotiation';

function nowSec() { return Math.floor(Date.now() / 1000); }

function die(error, extra = {}) {
  console.error(JSON.stringify({ ok: false, error: String(error?.message || error), ...extra }));
  process.exit(1);
}
function emit(obj) { console.log(JSON.stringify(obj, null, 2)); }

function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) out.flags[a.slice(2, eq)] = a.slice(eq + 1);
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) out.flags[a.slice(2)] = argv[++i];
      else out.flags[a.slice(2)] = true;
    } else out._.push(a);
  }
  return out;
}

function loadKey() {
  const raw = (process.env.MC_NSEC || '').trim();
  if (!raw) throw new Error('MC_NSEC is required (nsec or 64-char hex) for signing commands');
  let sk;
  if (raw.startsWith('nsec1')) {
    const dec = nip19.decode(raw);
    if (dec.type !== 'nsec') throw new Error('MC_NSEC must be an nsec or 64-char hex');
    sk = dec.data;
  } else if (/^[0-9a-f]{64}$/i.test(raw)) {
    sk = Uint8Array.from(Buffer.from(raw, 'hex'));
  } else throw new Error('MC_NSEC must be an nsec or 64-char hex');
  return { sk, pk: getPublicKey(sk) };
}

function sign(template, sk) {
  return finalizeEvent({ created_at: nowSec(), content: '', tags: [], ...template }, sk);
}

// ── cookie jar (persists the session across CLI invocations) ──
function loadJar() {
  try { return JSON.parse(fs.readFileSync(JAR_PATH, 'utf8')); } catch { return {}; }
}
function saveJar(jar) {
  fs.writeFileSync(JAR_PATH, JSON.stringify(jar), { mode: 0o600 });
}
function captureCookies(res, jar) {
  const set = res.headers.getSetCookie?.() || (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  for (const c of set) {
    const [pair] = c.split(';');
    const eq = pair.indexOf('=');
    if (eq !== -1) jar[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function request(method, urlPath, { body, useCookie = false } = {}) {
  const jar = useCookie ? loadJar() : {};
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && Object.keys(jar).length) headers.Cookie = cookieHeader(jar);
  const res = await fetch(BASE + urlPath, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (useCookie) { captureCookies(res, jar); saveJar(jar); }
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${urlPath} → ${res.status}: ${json.error || text.slice(0, 200)}`);
  return json;
}

async function publishSigned(event) {
  // The publish endpoint returns HTTP 200 with {success:false} on a strfry
  // import failure, so a status-only check would swallow it — surface it.
  const res = await request('POST', '/api/strfry/publish', { body: { event, signAs: 'client' } });
  if (res && res.success === false) throw new Error(res.error || 'strfry publish failed');
  return res;
}

function relays() {
  return String(process.env.MC_RELAYS || process.env.AUTO_PAY_ZAP_RELAYS || 'wss://localhost:7777')
    .split(',').map(s => s.trim()).filter(Boolean);
}

// Build the kind-1111 negotiation envelope. bountyId rides in a tag (a list
// coordinate can host several bounties, so #a alone is ambiguous); #a/#t are the
// queryable anchors for `negotiate scan`.
function buildNegotiationEvent({ sk, bountyId, listCoordinate, offerKind, scope, deadline, message, ref }) {
  const tags = [
    ['a', listCoordinate],
    ['t', NEGOTIATION_TOPIC],
    ['bountyId', bountyId],
  ];
  if (ref) tags.push(['e', ref]);
  const content = JSON.stringify({ bountyId, offerKind: offerKind || 'offer', scope, deadline, message });
  return sign({ kind: NEGOTIATION_KIND, tags, content }, sk);
}

// Map create-bounty CLI flags to the POST /api/bounties body. Pure, exported
// for tests. A bare `--amount` (no value) becomes boolean true, and
// Number(true)===1 would silently post a 1-sat bounty; require a real integer
// string.
function buildBountyCreateBody(flags) {
  const posInt = (v, name) => {
    if (typeof v !== 'string' || !/^\d+$/.test(v.trim())) throw new Error(`--${name} must be a positive integer`);
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`--${name} must be a positive integer`);
    return n;
  };
  const boolFlag = (v, name) => {
    if (v === true || v === 'true') return true;
    if (v === 'false') return false;
    throw new Error(`--${name} takes no value (or true/false)`);
  };
  const listCoordinate = flags.list || flags.coordinate || flags['list-coordinate'];
  if (!listCoordinate || typeof listCoordinate !== 'string') throw new Error('--list <kind:pubkey:dtag> is required');
  if (flags.amount === undefined) throw new Error('--amount <sats> is required');
  if (!flags.criteria || typeof flags.criteria !== 'string') throw new Error('--criteria <text> is required');
  const body = { listCoordinate, amountSats: posInt(flags.amount, 'amount'), criteria: String(flags.criteria) };
  if (flags.cap !== undefined) body.bountyCapSats = posInt(flags.cap, 'cap');
  if (flags['reward-per-item'] !== undefined && boolFlag(flags['reward-per-item'], 'reward-per-item')) body.rewardPerItem = true;
  if (flags['max-rewards'] !== undefined) body.maxRewardsPerNpub = posInt(flags['max-rewards'], 'max-rewards');
  if (flags.expiration !== undefined) body.expiration = posInt(flags.expiration, 'expiration');
  // Auto-pay: the server enforces authorization (owner/admin/allowlist → 403
  // otherwise), so the CLI passes the intent through instead of hiding it.
  if (flags['auto-pay'] !== undefined && boolFlag(flags['auto-pay'], 'auto-pay')) body.autoPay = true;
  if (flags['min-rank'] !== undefined) {
    if (body.autoPay !== true) throw new Error('--min-rank only applies with --auto-pay');
    body.autoPayMinRank = posInt(flags['min-rank'], 'min-rank');
  }
  return body;
}

function parseNegotiation(event) {
  let body = {};
  try { body = JSON.parse(event.content); } catch { /* opaque */ }
  const bountyId = event.tags.find(t => t[0] === 'bountyId')?.[1] || body.bountyId || null;
  return { eventId: event.id, pubkey: event.pubkey, created_at: event.created_at, bountyId, ...body };
}

// ── subcommands ──
function provisionDelegate(issuerValue) {
  const issuer = String(issuerValue || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(issuer)) throw new Error('--issuer <64-char hex pubkey> is required');
  const { getDelegatePubkey, insertDelegateIfAbsent } = require('../src/db/autoPay');
  const existing = getDelegatePubkey(issuer);
  if (existing) return { ok: true, issuer, delegatePubkey: existing, reused: true };
  const { generateSecretKey, getPublicKey: pub, nip19: n19 } = require('nostr-tools');
  const sk = generateSecretKey();
  const inserted = insertDelegateIfAbsent({
    issuerPubkey: issuer,
    delegatePubkey: pub(sk),
    delegateNsec: n19.nsecEncode(sk),
  });
  return {
    ok: true,
    issuer,
    delegatePubkey: inserted.delegatePubkey,
    reused: !inserted.inserted,
  };
}

// One-shot repair for rows the schema migration could not identify. Old
// auto_payments rows stored only a claim event id, so the migration writes
// `legacy:<event>` and the read path treats a row with no live claim event as a
// block on its bounty. This resolves those rows against the relay. It never
// guesses: a claim event that is gone stays unresolved for a human to decide.
async function repairLegacyPayments(flags) {
  const issuer = flags.issuer ? String(flags.issuer).toLowerCase() : null;
  if (issuer && !/^[0-9a-f]{64}$/.test(issuer)) {
    throw new Error('--issuer must be a 64-char hex pubkey');
  }
  const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';
  const { repairLegacyPayments: repair, stableClaimAddress } = require('../src/db/autoPay');
  const { getBounty } = require('../src/db/bounties');
  const { scanClaimEvent } = require('../src/api/bounties');

  const result = await repair({
    issuerPubkey: issuer,
    dryRun,
    async resolveIdentity(row) {
      const bounty = getBounty(row.bounty_id);
      if (!bounty) return null;
      const event = await scanClaimEvent(row.claim_event_id);
      if (!event) return null;
      const claimAddress = stableClaimAddress(event, bounty.list_coordinate);
      if (!claimAddress) return null;
      return { claimantPubkey: String(event.pubkey).toLowerCase(), claimAddress };
    },
  });
  return { ...result, issuer };
}

async function resetClaim(flags, requestImpl = request) {
  if (!flags.bounty) throw new Error('--bounty <bountyId> is required');
  if (!flags.claim) throw new Error('--claim <claimEventId> is required');
  const force = flags.force === true || flags.force === 'true';
  const response = await requestImpl('POST', '/api/bounties/auto-pay/reset', {
    body: { bountyId: flags.bounty, claimEventId: flags.claim, force },
    useCookie: true,
  });
  return {
    ...response,
    ok: response.success === true && response.reset === true,
  };
}

async function paymentsDue(requestImpl = request) {
  const response = await requestImpl('GET', '/api/bounties/mine/payments-due', { useCookie: true });
  return {
    ...response,
    ok: response.success === true && Array.isArray(response.items),
  };
}

function emitCommandResult(result) {
  emit(result);
  if (!result.ok) process.exitCode = 1;
}


const commands = {
  async 'auth-login'() {
    const { sk, pk } = loadKey();
    const verify = await request('POST', '/api/auth/verify-user', { body: { pubkey: pk }, useCookie: true });
    if (!verify.authorized) throw new Error(`verify-user denied: ${verify.message || 'not authorized'}`);
    const signed = sign({ kind: 22242, tags: [['challenge', verify.challenge]], content: 'Tapestry authentication' }, sk);
    const login = await request('POST', '/api/auth/login-user', { body: { event: signed }, useCookie: true });
    if (!login.success) throw new Error(`login-user failed: ${login.message || 'unknown'}`);
    emit({ ok: true, pubkey: pk, jar: JAR_PATH });
  },

  async discover(flags) {
    if (flags.eligible) {
      const viewer = flags.viewer || loadKey().pk;
      const res = await request('GET', `/api/bounties/eligible?viewer=${viewer}`, { useCookie: true });
      return emit({ ok: true, eligible: true, bounties: res.bounties || [] });
    }
    const limit = Number(flags.limit) || 100;
    const res = await request('GET', `/api/bounties?status=open&limit=${limit}`);
    emit({ ok: true, bounties: res.bounties || [] });
  },

  async submit(flags) {
    if (!flags.bounty) throw new Error('--bounty <id> is required');
    if (!flags.content) throw new Error('--content <text> is required');
    const { sk } = loadKey();
    const { bounty } = await request('GET', `/api/bounties/${flags.bounty}`);
    if (!bounty?.list_coordinate) throw new Error('bounty has no list_coordinate');
    const dTag = String(flags.d || `mc-${nowSec()}-${Math.abs((flags.content || '').length)}`);
    const event = sign({ kind: 39999, tags: [['z', bounty.list_coordinate], ['d', dTag]], content: String(flags.content) }, sk);
    await publishSigned(event);
    emit({ ok: true, claimEventId: event.id, listCoordinate: bounty.list_coordinate, dTag });
  },

  // Publish a DList header (kind-39998 replaceable, or 9998 permanent). Mirrors
  // the NewDList form: ['d',dTag] (replaceable only), ['names',singular,plural],
  // optional ['description',…], and one [requirement,name] tag per item property.
  async 'create-list'(flags) {
    const { sk, pk } = loadKey();
    const singular = String(flags.singular || flags.name || '').trim();
    if (!singular) throw new Error('--singular <item name> is required');
    const plural = String(flags.plural || singular).trim();
    const replaceable = flags.replaceable !== 'false' && flags.replaceable !== false;
    const kind = replaceable ? 39998 : 9998;
    const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48);
    const dTag = String(flags.d || slug(singular) || `list-${nowSec()}`);
    const tags = [];
    if (replaceable) tags.push(['d', dTag]);
    tags.push(['names', singular, plural]);
    if (flags.description) tags.push(['description', String(flags.description)]);
    // --properties "required:name,optional:url,recommended:description"
    const REQS = ['required', 'optional', 'recommended'];
    for (const raw of String(flags.properties || '').split(',').map(s => s.trim()).filter(Boolean)) {
      const idx = raw.indexOf(':');
      const req = (idx === -1 ? 'required' : raw.slice(0, idx)).toLowerCase();
      const name = (idx === -1 ? raw : raw.slice(idx + 1)).trim();
      if (!REQS.includes(req)) throw new Error(`property requirement must be one of ${REQS.join('|')} (got "${req}")`);
      if (name) tags.push([req, name]);
    }
    const event = sign({ kind, tags, content: '' }, sk);
    await publishSigned(event);
    // A bounty target must be a 3-part <kind>:<pubkey>:<dtag>; a non-replaceable
    // (9998) list has no d-tag, so it can't be a bounty coordinate.
    emit({ ok: true, listEventId: event.id, coordinate: replaceable ? `${kind}:${pk}:${dTag}` : null, kind, pubkey: pk, dTag: replaceable ? dTag : null });
  },

  // Post a bounty against a list coordinate. Requires a prior `auth-login` (the
  // server sets issuer = the session pubkey and ignores any issuer in the body).
  // --auto-pay needs owner/admin/allowlist; the server rejects it with 403 otherwise.
  async 'create-bounty'(flags) {
    loadKey(); // fail fast if MC_NSEC is missing — you must auth-login as this key first
    const body = buildBountyCreateBody(flags);
    const res = await request('POST', '/api/bounties', { body, useCookie: true });
    emit({ ok: true, ...res });
  },

  async negotiate(flags, positionals) {
    const sub = positionals[0];
    if (sub !== 'send' && sub !== 'scan') throw new Error('negotiate requires a subcommand: send | scan');
    if (!flags.bounty) throw new Error('--bounty <id> is required');
    const { bounty } = await request('GET', `/api/bounties/${flags.bounty}`);
    if (!bounty?.list_coordinate) throw new Error('bounty has no list_coordinate');

    if (sub === 'send') {
      const { sk } = loadKey();
      const event = buildNegotiationEvent({
        sk,
        bountyId: flags.bounty,
        listCoordinate: bounty.list_coordinate,
        offerKind: flags['offer-kind'],
        scope: flags.scope,
        deadline: flags.deadline,
        message: flags.message,
        ref: flags.ref,
      });
      await publishSigned(event);
      return emit({ ok: true, eventId: event.id });
    }
    if (sub === 'scan') {
      const { collectEvents } = require('../src/lib/relay-read');
      const events = await collectEvents(
        { kinds: [NEGOTIATION_KIND], '#a': [bounty.list_coordinate], '#t': [NEGOTIATION_TOPIC] },
        relays(),
        { timeoutMs: Number(flags.timeout) || 6000 },
      );
      const thread = events
        .map(parseNegotiation)
        .filter(n => n.bountyId === flags.bounty)
        .sort((a, b) => a.created_at - b.created_at);
      return emit({ ok: true, bountyId: flags.bounty, thread });
    }
  },

  async judge(flags) {
    if (!flags.bounty) throw new Error('--bounty <id> is required');
    if (!flags.claim) throw new Error('--claim <claimEventId> is required');
    if (flags.decision !== 'accept' && flags.decision !== 'reject') {
      throw new Error('--decision <accept|reject> is required');
    }
    const { evaluateJudgment } = require('../src/lib/operatorJudgment');
    const { appendAudit } = require('../src/lib/agentAudit');
    const verdict = evaluateJudgment({ decision: flags.decision, confidence: flags.confidence });
    const record = appendAudit({
      kind: 'judgment',
      bountyId: flags.bounty,
      claimEventId: flags.claim,
      decision: verdict.decision,
      confidence: verdict.confidence,
      pay: verdict.pay,
      reason: flags.reason || null,
      prompt: flags.prompt || null,
    });
    emit({ ok: true, ...verdict, recorded: record.at });
  },

  async balance() {
    const { getBalance } = require('../src/lib/wallet');
    emit({ ok: true, ...(await getBalance()) });
  },

  async 'provision-delegate'(flags) {
    emit(provisionDelegate(flags.issuer));
  },

  async reconcile(flags) {
    if (!/^[0-9a-f]{64}$/i.test(String(flags.issuer || ''))) {
      throw new Error('--issuer <64-char hex pubkey> is required');
    }
    const { reconcileIssuerPayments } = require('../src/services/autoPayWatcher');
    const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true';
    const result = await reconcileIssuerPayments({
      issuerPubkey: String(flags.issuer).toLowerCase(),
      dryRun,
    });
    emit(result);
    if (!result.ok) process.exitCode = 1;
  },

  async 'repair-legacy-payments'(flags) {
    emitCommandResult(await repairLegacyPayments(flags));
  },

  async reset(flags) {
    emitCommandResult(await resetClaim(flags));
  },

  async 'payments-due'() {
    emitCommandResult(await paymentsDue());
  },

  async pay(flags) {
    if (!flags.bounty) throw new Error('--bounty <id> is required');
    if (!flags.claim) throw new Error('--claim <claimEventId> is required');
    const { payClaim } = require('../src/services/paymentService');
    const dryRun = flags['dry-run'] === true || flags['dry-run'] === 'true' || process.env.AGENT_DRY_RUN === 'true';
    emit(await payClaim({ bountyId: flags.bounty, claimEventId: flags.claim, dryRun }));
  },
};

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h' || !commands[cmd]) {
    const usage = 'magic-carpet-agent <auth-login|discover|create-list|create-bounty|submit|negotiate send|scan|balance|provision-delegate|reconcile|repair-legacy-payments|reset|payments-due|pay> [flags]';
    if (!cmd || cmd === '--help' || cmd === '-h') { emit({ usage, commands: Object.keys(commands) }); return; }
    throw new Error(`unknown command: ${cmd}. ${usage}`);
  }
  const { _, flags } = parseArgs(argv.slice(1));
  await commands[cmd](flags, _);
}

// Exit explicitly: fetch (undici) and any ws sockets keep the loop alive, so a
// CLI that just lets main() resolve would hang instead of returning.
if (require.main === module) main().then(() => process.exit(process.exitCode || 0)).catch(die);

module.exports = { commands, parseArgs, buildBountyCreateBody, buildNegotiationEvent, parseNegotiation, paymentsDue, provisionDelegate, repairLegacyPayments, resetClaim, NEGOTIATION_TOPIC, NEGOTIATION_KIND };
