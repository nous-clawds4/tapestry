#!/usr/bin/env node

/**
 * receiving — prove the pick-a-wallet → kind 0 loop from the terminal.
 *
 * Subcommands:
 *   set <method> [value]   set your receiving method on your own kind 0
 *                          methods: npub-cash | address <lud16> | wos <lud16> | fedimint <lud16> | lnurl <lnurl1…>
 *   show <pubkey>          resolve the ACTIVE method (lud16 → lnurl precedence),
 *                          newest across local strfry + profile relays
 *   resolve <pubkey>       run the issuer-side payout decision headlessly:
 *                          BOLT11-via-LNURL (tracked iff the LNURL allows Nostr zaps)
 *
 * Signing key (set only): --nsec <nsec1…|hex>, else $NOSTR_NSEC. The key is the
 * user's own, supplied by them, used locally — never logged or persisted.
 *
 * Flags:
 *   --nsec <key>      signing key for `set` (or $NOSTR_NSEC)
 *   --pubkey <hex>    expected signer pubkey; `set` rejects a mismatch (Finding 6)
 *   --relays a,b,c    override PROFILE_RELAYS (defaults to settings)
 *   --no-local        skip local strfry import (set) / skip local scan (show/resolve)
 *   --no-external     skip external relays (show/resolve)
 *   --amount <sats>   informational, for `resolve`
 *   --json            machine-readable output
 *
 * Examples:
 *   node bin/receiving.js set npub-cash --nsec nsec1...
 *   node bin/receiving.js set address alice@walletofsatoshi.com --nsec nsec1...
 *   node bin/receiving.js set lnurl lnurl1dp68... --nsec nsec1...
 *   node bin/receiving.js show <pubkey-hex>
 *   node bin/receiving.js resolve <pubkey-hex> --amount 1000
 */

function loadDep(name) {
  try { return require(name); }
  catch { return require(`/usr/local/lib/node_modules/brainstorm/node_modules/${name}`); }
}

const { nip19, getPublicKey, finalizeEvent } = loadDep('nostr-tools');

const { buildReceivingContent } = require('../src/lib/receiving/mergeKind0');
const { resolveReceivingMethod, resolvePayment } = require('../src/lib/receiving/resolveMethod');
const { resolveProfile } = require('../src/lib/receiving/resolveProfile');
const { publishProfileEvent, getProfileRelays } = require('../src/lib/receiving/publish');
const { WALLET_OPTIONS } = require('../src/lib/receiving/walletOptions');
const { probeReceiving, trackedVerdict } = require('../src/lib/receiving/probe');

// ---- arg parsing -----------------------------------------------------------

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const boolFlags = ['no-local', 'no-external', 'json', 'help', 'probe', 'no-probe'];
      if (boolFlags.includes(key)) { flags[key] = true; continue; }
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { flags[key] = true; }
      else { flags[key] = next; i++; }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function die(msg, code = 1) {
  console.error(`error: ${msg}`);
  process.exit(code);
}

function out(flags, human, obj) {
  if (flags.json) console.log(JSON.stringify(obj, null, 2));
  else console.log(human);
}

function shortPk(hex) { return hex ? `${hex.slice(0, 8)}…${hex.slice(-4)}` : '—'; }

function nowSeconds() { return Math.floor(Date.now() / 1000); }

function relaysFrom(flags) {
  if (flags.relays) return String(flags.relays).split(',').map(s => s.trim()).filter(Boolean);
  return getProfileRelays();
}

// ---- key handling (never log the raw key) ----------------------------------

function loadSigningKey(flags) {
  const raw = flags.nsec || process.env.NOSTR_NSEC;
  if (!raw) die('no signing key — pass --nsec <nsec1…|hex> or set $NOSTR_NSEC');

  let hex;
  if (typeof raw === 'string' && raw.startsWith('nsec1')) {
    let decoded;
    try { decoded = nip19.decode(raw); }
    catch { return die('--nsec is not a valid nsec1… key'); }
    if (decoded.type !== 'nsec') die(`--nsec decoded to ${decoded.type}, expected nsec`);
    hex = Buffer.from(decoded.data).toString('hex');
  } else if (typeof raw === 'string' && /^[0-9a-f]{64}$/i.test(raw)) {
    hex = raw.toLowerCase();
  } else {
    return die('--nsec must be an nsec1… key or 64-char hex');
  }

  const privBytes = Uint8Array.from(Buffer.from(hex, 'hex'));
  const pubkey = getPublicKey(privBytes);
  return { privBytes, pubkey };
}

// ---- subcommands -----------------------------------------------------------

async function cmdSet(positionals, flags) {
  const method = positionals[0];
  const value = positionals[1];
  if (!method) {
    die('usage: receiving set <npub-cash|address|wos|fedimint|lnurl> [value] --nsec <key>');
  }

  const { privBytes, pubkey } = loadSigningKey(flags);

  // Signer-mismatch guard (Finding 6): the key must match the expected target.
  if (flags.pubkey && flags.pubkey.toLowerCase() !== pubkey) {
    die(`signer mismatch: --nsec is ${shortPk(pubkey)} but --pubkey expects ${shortPk(String(flags.pubkey).toLowerCase())}`);
  }

  // Merge into the user's CURRENT profile so we don't drop name/about/etc.
  if (flags['no-local'] && flags['no-external']) {
    console.error('warning: --no-local and --no-external both set — merging into an EMPTY profile; any existing name/about/picture will be dropped from the new kind 0.');
  }
  let current = null;
  try {
    const resolved = await resolveProfile(pubkey, {
      relays: relaysFrom(flags),
      includeLocal: !flags['no-local'],
      includeExternal: !flags['no-external'],
    });
    current = resolved.profile;
  } catch (err) {
    console.error(`warning: could not read current profile (${err.message}); merging into empty profile`);
  }

  let built;
  try {
    built = buildReceivingContent({ profile: current, method, value, pubkeyHex: pubkey });
  } catch (err) {
    return die(err.message);
  }

  // For LNURL-backed methods (lud16 address or lud06 lnurl1… code), probe the
  // LNURL so we can tell the user *now* whether it actually works for tracked
  // zaps (fedimint gateways / static paycodes often don't). Non-fatal: we still
  // publish — the user may know what they're doing. Skip with --no-probe.
  let probe = null, verdict = null;
  if ((built.field === 'lud16' || built.field === 'lud06') && !flags['no-probe']) {
    probe = await probeReceiving(built.value);
    verdict = trackedVerdict(probe);
    if (verdict.tracked !== true) {
      console.error(`warning: ${built.value}: ${verdict.note}`);
    }
  }

  const template = {
    kind: 0,
    created_at: nowSeconds(),
    tags: [],
    content: JSON.stringify(built.content),
  };
  const signed = finalizeEvent(template, privBytes);

  const pub = await publishProfileEvent(signed, {
    relays: relaysFrom(flags),
    includeLocal: !flags['no-local'],
  });

  const relayOk = pub.relays.filter(r => r.success).length;
  const human = [
    `set ${built.field} = ${built.value}`,
    built.cleared.length ? `cleared conflicting fields: ${built.cleared.join(', ')}` : 'no conflicting fields to clear',
    verdict ? `tracked: ${verdict.tracked === true ? 'yes' : 'no'} — ${verdict.note}` : 'tracked: not probed (--no-probe)',
    `signer: ${shortPk(pubkey)}  event: ${signed.id.slice(0, 16)}…`,
    `local strfry: ${pub.local.success ? 'imported' : (pub.local.skipped ? 'skipped' : 'FAILED')} ${pub.local.message ? `(${pub.local.message})` : ''}`,
    `profile relays: ${relayOk}/${pub.relays.length} accepted`,
    ...pub.relays.map(r => `  - ${r.relay}: ${r.success ? 'ok' : r.message}`),
  ].join('\n');

  out(flags, human, {
    ok: true,
    method, field: built.field, value: built.value,
    cleared: built.cleared, replaced: built.replaced,
    tracked: verdict ? verdict.tracked : null, probe,
    pubkey, eventId: signed.id,
    local: pub.local, relays: pub.relays,
  });
}

async function cmdShow(positionals, flags) {
  const pubkey = (positionals[0] || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) die('usage: receiving show <pubkey-hex>');

  const resolved = await resolveProfile(pubkey, {
    relays: relaysFrom(flags),
    includeLocal: !flags['no-local'],
    includeExternal: !flags['no-external'],
  });
  const method = resolveReceivingMethod(resolved.profile);

  // With --probe, verify the real tracked-ness of an LNURL-backed method (a
  // lud16 address or a static lnurl1… code) via its LNURL allowsNostr.
  let probe = null;
  const trackedWord = (t) => (t === true ? 'yes' : t === false ? 'no' : 'unknown');
  let trackedLine = method ? `tracked: ${trackedWord(method.tracked)} — ${method.trackedReason}` : null;
  if (method && (method.method === 'lud16' || method.method === 'lnurl') && flags.probe) {
    probe = await probeReceiving(method.value);
    const v = trackedVerdict(probe);
    method.tracked = v.tracked;
    trackedLine = `tracked: ${trackedWord(v.tracked)} — ${v.note} [probed]`;
  }

  const human = method
    ? [
        `active method: ${method.method} (${method.field})`,
        `value: ${method.value}`,
        trackedLine,
        `profile source: ${resolved.source || 'none'} (local ${resolved.sources.local} / external ${resolved.sources.external} kind-0 seen)`,
        `created_at: ${resolved.createdAt || '—'}`,
      ].join('\n')
    : `no receiving method set (local ${resolved.sources.local} / external ${resolved.sources.external} kind-0 seen)`;

  out(flags, human, {
    ok: true, pubkey,
    method, probe, source: resolved.source, createdAt: resolved.createdAt, sources: resolved.sources,
  });
}

async function cmdResolve(positionals, flags) {
  const pubkey = (positionals[0] || '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(pubkey)) die('usage: receiving resolve <pubkey-hex> [--amount <sats>]');

  const resolved = await resolveProfile(pubkey, {
    relays: relaysFrom(flags),
    includeLocal: !flags['no-local'],
    includeExternal: !flags['no-external'],
  });
  const payment = resolvePayment(resolved.profile);
  const amount = flags.amount ? Number(flags.amount) : null;

  // With --probe, confirm the LNURL is actually payable (reachable + allowsNostr).
  // The target is a lud16 address or a static lnurl1… code (in payment.source).
  let probe = null;
  const payTarget = payment.lud16 || payment.source;
  if (payment.type === 'bolt11' && payTarget && flags.probe) {
    probe = await probeReceiving(payTarget);
    const v = trackedVerdict(probe);
    payment.tracked = v.tracked;
    payment.probeNote = v.note;
    if (v.tracked !== true) payment.payable = false;
  }

  let human;
  if (payment.type === 'none') {
    human = `no payout possible: ${payment.error}`;
  } else {
    const viaLnurl = payment.via === 'lnurl';
    let status;
    if (payment.tracked === true) status = 'TRACKED';
    else if (probe) status = 'NOT PAYABLE / UNTRACKED';
    else if (viaLnurl) status = 'UNKNOWN — run --probe (a static LNURL is tracked only if it allows Nostr zaps)';
    else status = 'TRACKED (assumed; use --probe to verify)';
    human = [
      `payout: BOLT11 via LNURL — ${status}`,
      `${viaLnurl ? 'lnurl' : 'lud16'}: ${payTarget}`,
      probe ? `probe: ${payment.probeNote}` : `note: issuer UI signs a kind-9734 and fetches a BOLT11; payment yields a kind-9735 receipt — IF the LNURL allows Nostr zaps (run with --probe to confirm).`,
      amount ? `amount: ${amount} sats` : null,
    ].filter(Boolean).join('\n');
  }

  out(flags, human, { ok: true, pubkey, amount, payment, probe, source: resolved.source });
}

// Catalog `tracked` is tri-state: true (zap receipt), false (never), or
// 'depends' (an LNURL — only if it allows Nostr; verify with --probe).
function trackedTag(tracked) {
  if (tracked === true) return '[tracked]  ';
  if (tracked === false) return '[untracked]';
  return '[depends]  ';
}

function printHelp() {
  console.log(`receiving — pick-a-wallet → kind 0 (CLI)

usage:
  receiving set <method> [value] --nsec <nsec1…|hex>
  receiving show <pubkey-hex>
  receiving resolve <pubkey-hex> [--amount <sats>]

set methods:
  npub-cash              derive <npub>@npub.cash (tracked)            → lud16
  address <lud16>        a name@domain Lightning address              → lud16
  wos <lud16>            Wallet of Satoshi address (non-U.S./existing) → lud16
  fedimint <lud16>       a federation-backed Lightning address        → lud16  (NOT a fed11… invite code)
  lnurl <lnurl1…>        a static LNURL-pay code (e.g. a paycode)      → lud06  (tracked only if it allows Nostr; --probe)

flags:
  --nsec <key>     signing key for set (or $NOSTR_NSEC); never logged
  --pubkey <hex>   expected signer pubkey; set rejects a mismatch
  --relays a,b     override profile relays (default: settings PROFILE_RELAYS)
  --no-local       skip local strfry
  --no-external    skip external relays
  --probe          show/resolve: verify real tracked-ness (lud16 or lnurl) via its LNURL allowsNostr
  --no-probe       set: skip the default LNURL allowsNostr check
  --amount <sats>  informational for resolve
  --json           machine-readable output

curated options:
${WALLET_OPTIONS.map(o => `  ${o.id.padEnd(10)} ${trackedTag(o.tracked)} ${o.note}`).join('\n')}
`);
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const cmd = positionals[0];
  const rest = positionals.slice(1);

  if (!cmd || flags.help || cmd === 'help') { printHelp(); process.exit(cmd ? 0 : 1); }

  switch (cmd) {
    case 'set': return cmdSet(rest, flags);
    case 'show': return cmdShow(rest, flags);
    case 'resolve': return cmdResolve(rest, flags);
    default: die(`unknown command: ${cmd} (use set | show | resolve)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(`error: ${err.message}`); process.exit(1); });
