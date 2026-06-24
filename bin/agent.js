#!/usr/bin/env node
/*
 * magic-carpet-agent — the thin tool surface both Claude Code agents drive.
 *
 *   User agent (runs anywhere, signs locally with MC_NSEC):
 *     auth-login                         verify-user → sign kind-22242 → login-user
 *     discover [--eligible] [--limit N]  list open / eligible bounties
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

function publishSigned(event) {
  return request('POST', '/api/strfry/publish', { body: { event, signAs: 'client' } });
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

function parseNegotiation(event) {
  let body = {};
  try { body = JSON.parse(event.content); } catch { /* opaque */ }
  const bountyId = event.tags.find(t => t[0] === 'bountyId')?.[1] || body.bountyId || null;
  return { eventId: event.id, pubkey: event.pubkey, created_at: event.created_at, bountyId, ...body };
}

// ── subcommands ──
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
    if (!/^[0-9a-f]{64}$/i.test(String(flags.issuer || ''))) throw new Error('--issuer <64-char hex pubkey> is required');
    const { generateSecretKey, getPublicKey: pub, nip19: n19 } = require('nostr-tools');
    const { upsertDelegate } = require('../src/db/autoPay');
    const sk = generateSecretKey();
    const delegatePubkey = pub(sk);
    upsertDelegate({ issuerPubkey: String(flags.issuer).toLowerCase(), delegatePubkey, delegateNsec: n19.nsecEncode(sk) });
    emit({ ok: true, issuer: String(flags.issuer).toLowerCase(), delegatePubkey }); // never prints the nsec
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
    const usage = 'magic-carpet-agent <auth-login|discover|submit|negotiate send|scan|balance|provision-delegate|pay> [flags]';
    if (!cmd || cmd === '--help' || cmd === '-h') { emit({ usage, commands: Object.keys(commands) }); return; }
    throw new Error(`unknown command: ${cmd}. ${usage}`);
  }
  const { _, flags } = parseArgs(argv.slice(1));
  await commands[cmd](flags, _);
}

// Exit explicitly: fetch (undici) and any ws sockets keep the loop alive, so a
// CLI that just lets main() resolve would hang instead of returning.
if (require.main === module) main().then(() => process.exit(0)).catch(die);

module.exports = { parseArgs, buildNegotiationEvent, parseNegotiation, NEGOTIATION_TOPIC, NEGOTIATION_KIND };
