const { nip19, finalizeEvent, getPublicKey } = require('nostr-tools');
const { decode, hrpToMillisat } = require('light-bolt11-decoder');
const { checkReceivingTarget, checkUrlTarget } = require('../api/receiving/ssrfGuard');
const { decodeLnurl, isLnurl } = require('./receiving/walletOptions');
const { parseLud16 } = require('./receiving/probe');

const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_RELAYS = ['wss://localhost:7777'];

function normalizePrivateKeyBytes(key) {
  if (key instanceof Uint8Array) return key;
  const raw = String(key || '').trim();
  if (raw.startsWith('nsec1')) {
    const decoded = nip19.decode(raw);
    if (decoded.type !== 'nsec') throw new Error('delegate key must be nsec or 64-char hex');
    return decoded.data;
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Uint8Array.from(Buffer.from(raw, 'hex'));
  throw new Error('delegate key must be nsec or 64-char hex');
}

function invoiceAmountMsats(invoice) {
  const decoded = decode(invoice);
  const amount = decoded.sections.find(section => section.name === 'amount');
  if (!amount?.letters) throw new Error('BOLT11 invoice has no fixed amount');
  return hrpToMillisat(amount.letters, true);
}

function verifyBolt11AmountSats(invoice, expectedSats) {
  const amountSats = Number(expectedSats);
  if (!Number.isInteger(amountSats) || amountSats <= 0) {
    throw new Error('expectedSats must be a positive integer');
  }
  const actualMsats = BigInt(invoiceAmountMsats(invoice));
  const expectedMsats = BigInt(amountSats) * 1000n;
  if (actualMsats !== expectedMsats) {
    throw new Error(`BOLT11 amount mismatch: expected ${expectedMsats} msats, got ${actualMsats} msats`);
  }
  return {
    amountMsats: actualMsats.toString(),
    amountSats,
  };
}

function buildLnurlPayUrl(receiving) {
  if (isLnurl(receiving)) {
    const decoded = decodeLnurl(receiving);
    if (!decoded) throw new Error('malformed LNURL');
    return decoded;
  }
  const parts = parseLud16(receiving);
  if (!parts) throw new Error('malformed Lightning address');
  return `https://${parts.domain}/.well-known/lnurlp/${encodeURIComponent(parts.user)}`;
}

async function fetchJsonNoRedirect(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(url, { signal: ctrl.signal, redirect: 'manual' });
    if (resp.status >= 300 && resp.status < 400) {
      throw new Error(`redirects are not followed for LNURL requests (${resp.status})`);
    }
    if (!resp.ok) throw new Error(`LNURL endpoint returned ${resp.status}`);
    return await resp.json();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('LNURL request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function guardedFetchJson(url, opts = {}) {
  const guard = await checkUrlTarget(url, opts);
  if (!guard.ok) throw new Error(guard.error);
  return fetchJsonNoRedirect(url, opts);
}

async function fetchLnurlPayData(receiving, opts = {}) {
  const targetGuard = await checkReceivingTarget(receiving, opts);
  if (!targetGuard.ok) throw new Error(targetGuard.error);
  const url = buildLnurlPayUrl(receiving);
  const data = await guardedFetchJson(url, { ...opts, kind: 'lnurl-pay' });
  if (data?.allowsNostr !== true) throw new Error("Recipient's LNURL does not support Nostr zaps");
  if (!data.callback) throw new Error('LNURL endpoint did not return a callback URL');
  await checkCallbackUrl(data.callback, opts);
  return data;
}

async function checkCallbackUrl(callbackUrl, opts = {}) {
  const callbackGuard = await checkUrlTarget(callbackUrl, { ...opts, kind: 'lnurl-callback' });
  if (!callbackGuard.ok) throw new Error(`disallowed LNURL callback: ${callbackGuard.error}`);
  return callbackGuard;
}

function buildZapRequest({
  recipientPubkeyHex,
  amountSats,
  claimEventId,
  listCoordinate,
  relays = DEFAULT_RELAYS,
  signerPrivateKey,
  now = Math.floor(Date.now() / 1000),
}) {
  if (!/^[0-9a-f]{64}$/i.test(recipientPubkeyHex)) throw new Error('recipientPubkeyHex must be hex');
  if (!Number.isInteger(amountSats) || amountSats <= 0) throw new Error('amountSats must be a positive integer');
  if (!claimEventId) throw new Error('claimEventId is required');
  const privBytes = normalizePrivateKeyBytes(signerPrivateKey);
  const relayList = Array.isArray(relays) && relays.length ? relays : DEFAULT_RELAYS;
  return finalizeEvent({
    kind: 9734,
    created_at: now,
    content: '',
    tags: [
      ['p', recipientPubkeyHex],
      ['e', claimEventId],
      ...(listCoordinate ? [['a', listCoordinate]] : []),
      ['amount', String(amountSats * 1000)],
      ['relays', ...relayList],
    ],
  }, privBytes);
}

async function mintZapInvoice({
  recipientPubkeyHex,
  receiving,
  amountSats,
  claimEventId,
  listCoordinate,
  signerPrivateKey,
  relays,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl,
  allowPrivate,
}) {
  const lnurlData = await fetchLnurlPayData(receiving, { timeoutMs, fetchImpl, allowPrivate });
  const amountMsats = amountSats * 1000;
  if (lnurlData.minSendable && amountMsats < lnurlData.minSendable) {
    throw new Error(`Amount below recipient minimum (${Math.ceil(lnurlData.minSendable / 1000)} sats)`);
  }
  if (lnurlData.maxSendable && amountMsats > lnurlData.maxSendable) {
    throw new Error(`Amount above recipient maximum (${Math.floor(lnurlData.maxSendable / 1000)} sats)`);
  }

  const signed = buildZapRequest({
    recipientPubkeyHex,
    amountSats,
    claimEventId,
    listCoordinate,
    relays,
    signerPrivateKey,
  });

  const callbackUrl = new URL(lnurlData.callback);
  callbackUrl.searchParams.set('amount', String(amountMsats));
  callbackUrl.searchParams.set('nostr', JSON.stringify(signed));

  const invoiceData = await guardedFetchJson(callbackUrl.toString(), {
    timeoutMs,
    fetchImpl,
    allowPrivate,
    kind: 'lnurl-callback',
  });
  if (!invoiceData?.pr) throw new Error('LNURL callback did not return an invoice');
  verifyBolt11AmountSats(invoiceData.pr, amountSats);
  return { type: 'bolt11', payload: invoiceData.pr, zapRequest: signed };
}

function publicKeyForPrivateKey(key) {
  return getPublicKey(normalizePrivateKeyBytes(key));
}

module.exports = {
  buildLnurlPayUrl,
  buildZapRequest,
  checkCallbackUrl,
  fetchLnurlPayData,
  invoiceAmountMsats,
  mintZapInvoice,
  normalizePrivateKeyBytes,
  publicKeyForPrivateKey,
  verifyBolt11AmountSats,
};
