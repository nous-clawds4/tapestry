#!/usr/bin/env node
/*
 * phase1-preflight.js — Workstream C (trust setup) preflight checker.
 *
 * For a chosen issuer pubkey and a set of claimant npubs/hex pubkeys, prints for
 * each claimant:
 *   - pubkey (hex)
 *   - kind-0 lud16 / lud06 Lightning address (or MISSING)
 *   - rank(issuer, claimant)  [grapevine trust score, or RANK-UNAVAILABLE]
 *   - PASS / FAIL against --min-rank (default 3)
 *   - a SELF-CLAIM warning when a claimant equals the issuer (the auto-pay
 *     watcher hard-blocks self-claims, so such an npub can never be paid)
 *
 * Exits non-zero if any claimant FAILs (or is a self-claim).
 *
 * Usage:
 *   node scripts/phase1-preflight.js <issuerNpubOrHex> <claimant1> <claimant2> ... [--min-rank N] [--json]
 *
 * Node/native-module note: run the repo's own CLIs (which pull in better-sqlite3)
 * with PATH="/opt/homebrew/opt/node@22/bin:$PATH". This script itself uses no
 * native modules, so any Node 18+ works.
 *
 * rank() reads the grapevine score the issuer's configured rankAuthor published
 * in Trusted Assertions (kind 30382), served by Meilisearch (MEILI_URL) or the
 * strfry scan HTTP endpoint (STRFRY_SCAN_URL). Neither is reachable from a
 * laptop, so rank shows RANK-UNAVAILABLE locally — run this on the droplet (or
 * hit the API there) to get a real trust number. See the runbook.
 */

const path = require('path');

// nip19 (npub<->hex) + SimplePool (relay reads) from the repo's nostr-tools.
const { nip19, SimplePool } = require(path.join(__dirname, '..', 'node_modules', 'nostr-tools'));
// Node has no native WebSocket; SimplePool needs one injected.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = require(path.join(__dirname, '..', 'node_modules', 'ws'));
}

// rank(issuer, claimant) — reused from the app's trust library, so the preflight
// check matches exactly what the auto-pay watcher enforces at payment time.
const { rank, resolveRankAuthor } = require(path.join(__dirname, '..', 'src', 'lib', 'trust-rank'));

const MEILI_URL = process.env.MEILI_URL || 'http://nostr-search-meili:7700';
const STRFRY_SCAN_URL = process.env.STRFRY_SCAN_URL || 'http://localhost:7778';
const PROFILE_RELAYS = (process.env.PROFILE_RELAYS || 'wss://purplepag.es,wss://relay.nostr.band,wss://relay.damus.io')
  .split(',').map(s => s.trim()).filter(Boolean);

const HEX64 = /^[0-9a-f]{64}$/i;

function toHex(input) {
  const raw = String(input || '').trim();
  if (HEX64.test(raw)) return raw.toLowerCase();
  if (raw.startsWith('npub1')) {
    const dec = nip19.decode(raw);
    if (dec.type !== 'npub') throw new Error(`not an npub: ${raw}`);
    return String(dec.data).toLowerCase();
  }
  throw new Error(`unrecognized pubkey (want npub1... or 64-char hex): ${raw}`);
}

function parseArgs(argv) {
  const positionals = [];
  let minRank = 3;
  let json = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--min-rank') { minRank = Number(argv[++i]); }
    else if (a.startsWith('--min-rank=')) { minRank = Number(a.split('=')[1]); }
    else if (a === '--json') { json = true; }
    else positionals.push(a);
  }
  // Allow 0 — the auto-pay watcher permits auto_pay_min_rank=0. Reject only negatives.
  if (!Number.isFinite(minRank) || minRank < 0) throw new Error('--min-rank must be >= 0');
  return { positionals, minRank, json };
}

// Decide whether rank() can produce a trustworthy number here. Two things must
// hold: (1) the issuer resolves a rankAuthor (else rank() returns 0 for every
// subject regardless of trust), and (2) at least one rank backend answers with
// the *expected JSON shape* — a bare HTTP 200 from some unrelated local server
// doesn't count. If either is missing we report RANK-UNAVAILABLE rather than
// silently failing everyone on a meaningless 0.
async function rankVerifiableHere(issuerHex) {
  const rankAuthor = resolveRankAuthor(issuerHex);
  if (!rankAuthor) return { ok: false, reason: 'no rankAuthor resolves for issuer (set OWNER_PUBKEY / user-prefs)' };

  const meiliOk = await (async () => {
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
      const resp = await fetch(`${MEILI_URL}/health`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) return false;
      const body = await resp.json().catch(() => null);
      return !!body && typeof body.status === 'string';
    } catch { return false; }
  })();

  const strfryOk = await (async () => {
    try {
      const filter = encodeURIComponent(JSON.stringify({ kinds: [30382], authors: [rankAuthor], limit: 1 }));
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2000);
      const resp = await fetch(`${STRFRY_SCAN_URL}/api/strfry/scan?filter=${filter}`, { signal: ctrl.signal });
      clearTimeout(t);
      if (!resp.ok) return false;
      const body = await resp.json().catch(() => null);
      // The real endpoint answers {success, events:[...]} (or a bare array).
      return Array.isArray(body) || (body && (Array.isArray(body.events) || typeof body.success === 'boolean'));
    } catch { return false; }
  })();

  if (meiliOk || strfryOk) return { ok: true, rankAuthor };
  return { ok: false, reason: 'no rank backend (Meili/strfry-scan) reachable with a valid response' };
}

// Fetch kind-0 profiles for the given hex pubkeys from public relays.
async function fetchProfiles(hexPubkeys) {
  const pool = new SimplePool();
  const out = new Map();
  try {
    const events = await Promise.race([
      pool.querySync(PROFILE_RELAYS, { kinds: [0], authors: hexPubkeys }),
      new Promise((resolve) => setTimeout(() => resolve([]), 8000)),
    ]);
    for (const ev of (events || [])) {
      if (!ev || ev.kind !== 0) continue;
      const prev = out.get(ev.pubkey);
      if (!prev || ev.created_at > prev.created_at) out.set(ev.pubkey, ev);
    }
  } catch { /* best effort */ } finally {
    try { pool.close(PROFILE_RELAYS); } catch {}
  }
  const profiles = new Map();
  for (const pk of hexPubkeys) {
    const ev = out.get(pk);
    if (!ev) { profiles.set(pk, null); continue; }
    try { profiles.set(pk, JSON.parse(ev.content)); } catch { profiles.set(pk, {}); }
  }
  return profiles;
}

function lightningAddress(profile) {
  if (!profile) return null;
  if (typeof profile.lud16 === 'string' && profile.lud16.trim()) return { kind: 'lud16', value: profile.lud16.trim() };
  if (typeof profile.lud06 === 'string' && profile.lud06.trim()) return { kind: 'lud06', value: profile.lud06.trim() };
  return null;
}

async function main() {
  const { positionals, minRank, json } = parseArgs(process.argv.slice(2));
  if (positionals.length < 2) {
    console.error('usage: node scripts/phase1-preflight.js <issuer> <claimant...> [--min-rank N] [--json]');
    process.exit(2);
  }

  const issuerHex = toHex(positionals[0]);
  const claimantHex = positionals.slice(1).map(toHex);

  const verifiable = await rankVerifiableHere(issuerHex);
  const backendUp = verifiable.ok;
  const profiles = await fetchProfiles([issuerHex, ...claimantHex]);

  const rows = [];
  for (const pk of claimantHex) {
    const la = lightningAddress(profiles.get(pk));
    const selfClaim = pk === issuerHex;

    let rankValue = null;
    let rankDisplay;
    if (!backendUp) {
      rankDisplay = 'RANK-UNAVAILABLE';
    } else {
      rankValue = await rank(issuerHex, pk);
      rankDisplay = String(rankValue);
    }

    // PASS requires: not a self-claim, a Lightning address present, and a
    // known rank >= min. RANK-UNAVAILABLE cannot PASS (unverifiable).
    const rankOk = rankValue !== null && rankValue >= minRank;
    const pass = !selfClaim && !!la && rankOk;

    rows.push({
      pubkey: pk,
      npub: nip19.npubEncode(pk),
      lightning: la ? `${la.value} (${la.kind})` : 'MISSING',
      rank: rankDisplay,
      selfClaim,
      pass,
    });
  }

  if (json) {
    console.log(JSON.stringify({ issuer: issuerHex, minRank, rankBackendReachable: backendUp, claimants: rows }, null, 2));
  } else {
    console.log(`issuer:   ${issuerHex}`);
    console.log(`min-rank: ${minRank}`);
    console.log(`rank verifiable here: ${backendUp ? 'yes' : `NO — ${verifiable.reason} (RANK-UNAVAILABLE; run on droplet/API)`}`);
    console.log('');
    for (const r of rows) {
      const verdict = r.pass ? 'PASS' : 'FAIL';
      console.log(`[${verdict}] ${r.pubkey}`);
      console.log(`         npub:      ${r.npub}`);
      console.log(`         lightning: ${r.lightning}`);
      console.log(`         rank:      ${r.rank}`);
      if (r.selfClaim) console.log('         WARNING:   SELF-CLAIM — equals issuer; the watcher hard-blocks this npub');
      if (!r.pass && !r.selfClaim) {
        const reasons = [];
        if (r.lightning === 'MISSING') reasons.push('no lud16/lud06');
        if (r.rank === 'RANK-UNAVAILABLE') reasons.push('rank unverifiable here');
        else if (Number(r.rank) < minRank) reasons.push(`rank ${r.rank} < min ${minRank}`);
        if (reasons.length) console.log(`         reason:    ${reasons.join('; ')}`);
      }
      console.log('');
    }
  }

  const anyFail = rows.some(r => !r.pass);
  process.exit(anyFail ? 1 : 0);
}

main().catch(err => {
  console.error(`preflight error: ${err.message}`);
  process.exit(2);
});
