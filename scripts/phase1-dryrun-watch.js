#!/usr/bin/env node
'use strict';

/*
 * phase1-dryrun-watch.js — Workstream E dry-run watcher
 *
 * Polls the PUBLIC Magic Carpet bounty API every ~10s and prints a timestamped
 * status line on every state change for the watched claim(s):
 *   claim present -> payable -> paid, plus zapReceipt yes/no.
 *
 * Exit semantics:
 *   - Single claimant (0 or 1 --npub, optionally a claimEventId): exits 0 as soon
 *     as ANY watched claim shows paymentStatus "paid" WITH a zap receipt.
 *   - Multiple claimants (--npub given more than once): exits 0 only once EVERY
 *     listed claimant has a paid+receipt claim — so a 4-person demo is not
 *     falsely reported done after the first payout.
 *   - Exits 1 on a 5-minute (default) timeout.
 *
 * Usage:
 *   node scripts/phase1-dryrun-watch.js <bountyId> [claimEventId] [options]
 *
 * Options:
 *   --base <url>        API base (default https://magic-carpet.brainstorm.world)
 *   --interval <sec>    Poll interval seconds (default 10)
 *   --timeout <sec>     Overall timeout seconds (default 300)
 *   --npub <hex|npub>   Only watch claims from this claimant. Accepts a bech32
 *                       npub (decoded to hex via nostr-tools nip19) OR a 64-char
 *                       hex pubkey OR a hex prefix. Repeatable: pass --npub once
 *                       per claimant to require ALL of them paid+receipt.
 *   --cookie <string>   Cookie header value (e.g. from a session file) — the
 *                       public GET /api/bounties/:id needs no auth, so this is
 *                       optional and only used if provided.
 *   --cookie-file <p>   Path to a file whose contents are used as the Cookie
 *                       header (session/cookie jar). Trimmed.
 *
 * The public endpoint used here — GET /api/bounties/:id — requires NO auth
 * (see src/api/bounties.js: register()). If a future endpoint needs a session,
 * pass --cookie / --cookie-file; bin/agent.js and contrib-kit/bin/agent.js
 * show how sessions are established (NIP-98 style signed auth), but this
 * watcher deliberately uses only the public read path.
 *
 * NOTE: written in Node with fetch so the RTK hook does not compress the JSON
 * (a bash `curl` would be rewritten to `rtk curl`). If you must use bash/curl,
 * use `rtk proxy curl` to bypass filtering.
 */

const fs = require('fs');
const path = require('path');

// nip19 (npub<->hex) from the repo's own nostr-tools, so --npub can accept a
// bech32 npub and decode it to the hex pubkey that GET /api/bounties/:id returns.
const { nip19 } = require(path.join(__dirname, '..', 'node_modules', 'nostr-tools'));

const HEX64 = /^[0-9a-f]{64}$/i;

// Decode a claimant identifier to a lowercase hex string usable for matching.
// Accepts a full 64-char hex pubkey, a bech32 npub (decoded), or a shorter hex
// prefix (kept as-is for prefix matching, preserving prior behavior).
function claimantToHex(input) {
  const raw = String(input || '').trim();
  if (HEX64.test(raw)) return raw.toLowerCase();
  if (raw.startsWith('npub1')) {
    const dec = nip19.decode(raw);
    if (dec.type !== 'npub') throw new Error(`not an npub: ${raw}`);
    return String(dec.data).toLowerCase();
  }
  if (/^[0-9a-f]+$/i.test(raw)) return raw.toLowerCase(); // hex prefix
  throw new Error(`unrecognized --npub value (want npub1..., 64-char hex, or hex prefix): ${raw}`);
}

function parseArgs(argv) {
  const opts = {
    base: 'https://magic-carpet.brainstorm.world',
    interval: 10,
    timeout: 300,
    npubs: [],
    cookie: null,
    positional: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--interval') opts.interval = Number(argv[++i]);
    else if (a === '--timeout') opts.timeout = Number(argv[++i]);
    else if (a === '--npub') opts.npubs.push(claimantToHex(argv[++i]));
    else if (a === '--cookie') opts.cookie = argv[++i];
    else if (a === '--cookie-file') opts.cookie = fs.readFileSync(argv[++i], 'utf8').trim();
    else if (a === '-h' || a === '--help') opts.help = true;
    else opts.positional.push(a);
  }
  opts.bountyId = opts.positional[0];
  opts.claimEventId = opts.positional[1] || null;
  return opts;
}

function usage() {
  console.log('Usage: node scripts/phase1-dryrun-watch.js <bountyId> [claimEventId] [--npub <hex|npub> ...] [--base <url>] [--interval 10] [--timeout 300] [--cookie <v> | --cookie-file <path>]');
  console.log('  --npub is repeatable; with more than one, exits 0 only when EVERY listed claimant is paid+receipt.');
}

function ts() {
  return new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function log(msg) {
  console.log(`[${ts()}] ${msg}`);
}

function normalizeKey(k) {
  return String(k || '').toLowerCase();
}

// A claim pubkey matches a wanted (already hex-decoded) claimant if it equals it
// exactly (full 64-char hex or decoded npub) or starts with it (hex prefix).
function pubkeyMatches(pubkey, want) {
  const k = normalizeKey(pubkey);
  return k === want || k.startsWith(want);
}

async function fetchBounty(opts) {
  const url = `${opts.base}/api/bounties/${encodeURIComponent(opts.bountyId)}`;
  const headers = { accept: 'application/json' };
  if (opts.cookie) headers.cookie = opts.cookie;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
  }
  const json = await res.json();
  if (!json.success) throw new Error(`API error: ${JSON.stringify(json).slice(0, 200)}`);
  return json;
}

// Select the claims we are watching.
function selectClaims(claims, opts) {
  let out = claims || [];
  if (opts.claimEventId) out = out.filter(c => c.event?.id === opts.claimEventId);
  if (opts.npubs.length) {
    out = out.filter(c => opts.npubs.some(want => pubkeyMatches(c.event?.pubkey, want)));
  }
  return out;
}

function claimSignature(c) {
  const id = (c.event?.id || '').slice(0, 12);
  const status = c.paymentStatus || 'unknown';
  const receipt = c.zapReceipt ? 'receipt=yes' : 'receipt=no';
  return `${id} status=${status} ${receipt}`;
}

function isPaidWithReceipt(c) {
  return c.paymentStatus === 'paid' && !!c.zapReceipt;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || !opts.bountyId) {
    usage();
    process.exit(opts.help ? 0 : 2);
  }

  log(`Watching bounty ${opts.bountyId} at ${opts.base}`);
  if (opts.claimEventId) log(`Filtering to claim event ${opts.claimEventId}`);
  if (opts.npubs.length === 1) log(`Filtering to claimant ${opts.npubs[0]}`);
  else if (opts.npubs.length > 1) log(`Requiring ALL ${opts.npubs.length} claimants paid+receipt: ${opts.npubs.join(', ')}`);
  log(`Poll every ${opts.interval}s, timeout ${opts.timeout}s`);

  const deadline = Date.now() + opts.timeout * 1000;
  const lastSig = new Map(); // claimId -> signature
  const satisfied = new Set(); // wanted claimant hex -> already reported paid+receipt
  let sawAnyClaim = false;

  while (Date.now() < deadline) {
    let data;
    try {
      data = await fetchBounty(opts);
    } catch (err) {
      log(`WARN fetch failed: ${err.message}`);
      await sleep(opts.interval * 1000);
      continue;
    }

    const bStatus = data.bounty?.derivedStatus || data.bounty?.status;
    const watched = selectClaims(data.claims, opts);

    if (watched.length === 0 && !sawAnyClaim) {
      // Report the "no claim yet" state once per change.
      const sig = `bounty=${bStatus} claims=0`;
      if (lastSig.get('__none__') !== sig) {
        log(`no matching claim yet (bounty ${bStatus}, total claims=${(data.claims || []).length})`);
        lastSig.set('__none__', sig);
      }
    }

    for (const c of watched) {
      sawAnyClaim = true;
      const id = c.event?.id;
      const sig = claimSignature(c);
      if (lastSig.get(id) !== sig) {
        log(`claim ${sig} (bounty ${bStatus})`);
        lastSig.set(id, sig);
      }
    }

    if (opts.npubs.length > 1) {
      // Require ALL listed claimants paid+receipt before success.
      for (const want of opts.npubs) {
        const doneClaim = watched.find(c => pubkeyMatches(c.event?.pubkey, want) && isPaidWithReceipt(c));
        if (doneClaim && !satisfied.has(want)) {
          satisfied.add(want);
          log(`PAID + RECEIPT for claimant ${want} (claim ${doneClaim.event.id}) — ${satisfied.size}/${opts.npubs.length} done`);
        }
      }
      if (satisfied.size === opts.npubs.length) {
        log(`All ${opts.npubs.length} claimants PAID + RECEIPT confirmed`);
        log('SUCCESS: exiting 0');
        process.exit(0);
      }
    } else {
      const done = watched.find(isPaidWithReceipt);
      if (done) {
        log(`PAID + RECEIPT confirmed for claim ${done.event.id} — recipient ${done.event.pubkey}`);
        log('SUCCESS: exiting 0');
        process.exit(0);
      }
    }

    await sleep(opts.interval * 1000);
  }

  log(`TIMEOUT after ${opts.timeout}s — no watched claim reached paid+receipt`);
  log('FAILURE: exiting 1');
  process.exit(1);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

main().catch(err => {
  log(`FATAL ${err.stack || err.message}`);
  process.exit(1);
});
