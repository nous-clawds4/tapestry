/**
 * Receiving-method catalog and pure validators.
 *
 * Framework-free (CommonJS, no I/O) so it can be driven from the CLI
 * (bin/receiving.js) today and imported by the web UI later. The only
 * dependency is nostr-tools' nip19 codec for npub.cash derivation, which is
 * pure bech32 — no network.
 *
 * A kind-0 profile can carry receiving identifiers under several historical
 * field names. We group them into two mutually-exclusive *families*:
 *
 *   BOLT12 family: bolt12 / lud12 / lightning_offer   (static offer, untracked)
 *   LUD16  family: lud16  / lud06                      (Lightning address, tracked)
 *
 * "Replace semantics" (rev. 2, Finding 2): setting a method writes exactly one
 * field and clears every other receiving field across BOTH families, so a
 * stale BOLT12 can never shadow a freshly-set Lightning address (zap.js reads
 * bolt12 before lud16).
 */

// Tolerant nostr-tools loader: plain require resolves from the repo's
// node_modules locally; the absolute path is the Docker install location used
// elsewhere in the server (see fetchProfiles.js).
function loadNostrTools() {
  try {
    return require('nostr-tools');
  } catch {
    return require('/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools');
  }
}

// @scure/base is a transitive dep of nostr-tools (present at the repo root and in
// the Docker install). We only need its bech32 codec to decode an LNURL string.
function loadBech32() {
  const tries = [
    '@scure/base',
    '/usr/local/lib/node_modules/brainstorm/node_modules/@scure/base',
    '/usr/local/lib/node_modules/brainstorm/node_modules/nostr-tools/node_modules/@scure/base',
  ];
  for (const t of tries) {
    try { return require(t).bech32; } catch {}
  }
  throw new Error("cannot load '@scure/base' bech32 — needed to decode LNURL codes");
}

const BOLT12_FIELDS = ['bolt12', 'lud12', 'lightning_offer'];
// lud16 (Lightning address) and lud06 (LNURL-pay code) share the "address-ish"
// family. lud06 conventionally carries a bech32 lnurl1… code; lud16 carries
// name@domain. We disambiguate by value, not by field name (see resolveMethod).
const LUD16_FIELDS = ['lud16', 'lud06'];
const ALL_RECEIVING_FIELDS = [...BOLT12_FIELDS, ...LUD16_FIELDS];

const BOLT12_RE = /lno1[a-z0-9]{8,}/i;
// name@domain.tld — no whitespace, exactly one @, a dotted domain.
const LUD16_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// A bech32 lnurl1… code, optionally lightning:-prefixed. Charset is permissive
// here — bech32.decode() does the real validation (checksum + charset).
const LNURL_RE = /^lnurl1[0-9a-z]+$/;
// LNURLs routinely exceed the 90-char bech32 default; pass a generous cap so the
// checksum still guards integrity without rejecting long codes.
const LNURL_BECH32_LIMIT = 2000;

/**
 * Accept bare offers, `lightning:` prefixes, and BIP-21 unified URIs
 * (`bitcoin:?lno=lno1...`, as Phoenix exports). Returns the *original* trimmed
 * string when it contains a valid offer so the QR/profile stores whatever form
 * the user pasted (the unified URI is recognized by the broadest wallet set).
 * Mirrors readBolt12() in ui/src/utils/zap.js.
 */
function extractBolt12(value) {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!BOLT12_RE.test(trimmed)) return null;
  return trimmed;
}

function isBolt12(value) {
  return extractBolt12(value) !== null;
}

/**
 * Canonicalize an LNURL-pay input to a bare lowercase `lnurl1…` string, or null
 * if it isn't shaped like one. Accepts a `lightning:` scheme prefix and any
 * letter case (bech32 is case-insensitive but must be uniform; we store lower).
 * This is a *shape* check only — decodeLnurl() verifies the bech32 checksum.
 */
function normalizeLnurl(value) {
  if (!value || typeof value !== 'string') return null;
  const s = value.trim().replace(/^lightning:/i, '').trim().toLowerCase();
  return LNURL_RE.test(s) ? s : null;
}

/**
 * Decode an LNURL-pay code to its underlying https URL, or null if it is not a
 * valid `lnurl1…` wrapping an http(s) URL. Pure (bech32 only, no network).
 */
function decodeLnurl(value) {
  const ln = normalizeLnurl(value);
  if (!ln) return null;
  try {
    const bech32 = loadBech32();
    const { prefix, words } = bech32.decode(ln, LNURL_BECH32_LIMIT);
    if (prefix !== 'lnurl') return null;
    const url = new TextDecoder().decode(bech32.fromWords(words));
    return /^https?:\/\//i.test(url) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Validate + canonicalize an LNURL-pay code. Returns the bare lowercase
 * `lnurl1…` to store in lud06 when the code decodes to an http(s) URL, else
 * null. Mirrors extractBolt12()'s "return the storable form or null" contract.
 */
function extractLnurl(value) {
  return decodeLnurl(value) ? normalizeLnurl(value) : null;
}

function isLnurl(value) {
  return extractLnurl(value) !== null;
}

/**
 * Validate a Lightning address (lud16). Returns { valid, value?, error? }.
 */
function validateLud16(value) {
  if (!value || typeof value !== 'string') {
    return { valid: false, error: 'Lightning address is required' };
  }
  const trimmed = value.trim();
  if (!LUD16_RE.test(trimmed)) {
    return { valid: false, error: `Not a Lightning address (expected name@domain): ${trimmed}` };
  }
  return { valid: true, value: trimmed };
}

/**
 * Derive a deterministic npub.cash Lightning address from a pubkey.
 * Accepts hex or an npub1… string. npub.cash addresses are `<npub>@npub.cash`.
 */
function npubCashAddress(pubkeyHexOrNpub) {
  if (!pubkeyHexOrNpub || typeof pubkeyHexOrNpub !== 'string') {
    throw new Error('npubCashAddress: pubkey required');
  }
  let npub = pubkeyHexOrNpub.trim();
  if (/^[0-9a-f]{64}$/i.test(npub)) {
    const { nip19 } = loadNostrTools();
    npub = nip19.npubEncode(npub.toLowerCase());
  } else if (!npub.startsWith('npub1')) {
    throw new Error(`npubCashAddress: expected hex pubkey or npub1…, got: ${npub.slice(0, 12)}…`);
  }
  return `${npub}@npub.cash`;
}

/**
 * Curated option catalog (revised copy from the plan). `field` is the kind-0
 * field a chosen option writes. `tracked` reflects whether payments yield a
 * NIP-57 zap receipt (kind 9735) — BOLT12 static offers do not, so a
 * cap-tracked bounty won't auto-mark them paid (rev. 2, Finding 3).
 *
 * The CLI exposes three set-methods directly (npub-cash, address, bolt12);
 * `wos` and `fedimint` are address sources documented here for the UI.
 */
const WALLET_OPTIONS = [
  {
    id: 'npub-cash',
    label: 'npub.cash',
    field: 'lud16',
    tracked: true,
    isDefault: true,
    derivesFromPubkey: true,
    needsValue: false,
    note: 'Deterministic from your npub, no signup. External Cashu mint — not custody by us, but a mint trust model.',
  },
  {
    id: 'address',
    label: 'Lightning address',
    field: 'lud16',
    tracked: true,
    needsValue: true,
    note: 'Any name@domain whose LNURL allows Nostr zaps.',
  },
  {
    id: 'wos',
    label: 'Wallet of Satoshi',
    field: 'lud16',
    tracked: true,
    needsValue: true,
    note: 'Non-U.S. / existing users only (exited U.S. 2023). Custodial, not by us.',
  },
  {
    id: 'bolt12',
    label: 'BOLT12 offer (untracked)',
    field: 'bolt12',
    tracked: false,
    needsValue: true,
    note: 'Static lno1… offer. Self-custodial. No zap receipt — manual / untracked, won\'t auto-free a cap slot.',
  },
  {
    id: 'lnurl',
    label: 'LNURL-pay code',
    field: 'lud06',
    // 'depends': a static lnurl1… is tracked only if its LNURL endpoint advertises
    // allowsNostr — verified by the probe, not assumable from the code alone.
    tracked: 'depends',
    needsValue: true,
    note: 'Static lnurl1… pay code (e.g. a Fedimint paycode). Tracked only if its LNURL allows Nostr zaps (verify with --probe); otherwise manual / untracked.',
  },
  {
    id: 'fedimint',
    label: 'Fedimint federation address',
    field: 'lud16',
    tracked: true,
    needsValue: true,
    note: 'Paste a federation-backed Lightning address (Fedi app / self-hosted gateway). Not a fed11… invite code.',
  },
];

function getOption(id) {
  return WALLET_OPTIONS.find(o => o.id === id) || null;
}

module.exports = {
  BOLT12_FIELDS,
  LUD16_FIELDS,
  ALL_RECEIVING_FIELDS,
  extractBolt12,
  isBolt12,
  normalizeLnurl,
  decodeLnurl,
  extractLnurl,
  isLnurl,
  validateLud16,
  npubCashAddress,
  WALLET_OPTIONS,
  getOption,
};
