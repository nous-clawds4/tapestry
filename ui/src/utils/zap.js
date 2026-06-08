/**
 * Client-side zap flow — NIP-57 (LNURL → BOLT11) only.
 *
 * zapContributor({ recipientPubkeyHex, amountSats, claimEventId, listCoordinate })
 *   -> { type: 'bolt11', payload: '<lnbc1...>' }
 *
 * LNURL-only: the recipient's Lightning address (lud16, with lud06 as an alias)
 * is read from their kind-0 profile, its LNURL-pay endpoint is fetched, a NIP-57
 * zap request (kind 9734) is signed, and the callback returns a one-time BOLT11
 * invoice. Throws if no Lightning address is configured so callers can surface a
 * "recipient has no Lightning address" message. (BOLT12 was removed — a legacy
 * offer on a profile is ignored here and cleared on the recipient's next save.)
 */

async function fetchProfileEntry(pubkeyHex) {
  const resp = await fetch(`/api/profiles?pubkeys=${pubkeyHex}`);
  if (!resp.ok) throw new Error(`profile fetch failed (${resp.status})`);
  const payload = await resp.json();
  const profiles = payload?.profiles ?? payload;
  return Array.isArray(profiles) ? profiles[0] : profiles?.[pubkeyHex] ?? null;
}

function readLud16(profileEntry) {
  if (!profileEntry) return null;
  return profileEntry.lud16 ?? profileEntry.lud06 ?? null;
}

async function fetchLnurlPayData(lud16) {
  const [user, domain] = lud16.split('@');
  if (!user || !domain) throw new Error(`Malformed lud16: ${lud16}`);
  const resp = await fetch(`https://${domain}/.well-known/lnurlp/${user}`);
  if (!resp.ok) throw new Error(`LNURL endpoint returned ${resp.status}`);
  const data = await resp.json();
  if (!data?.allowsNostr) throw new Error("Recipient's LNURL does not support Nostr zaps");
  return data;
}

async function fetchRelayList(recipientPubkeyHex) {
  const filter = { kinds: [10002], authors: [recipientPubkeyHex], limit: 1 };
  try {
    const resp = await fetch(`/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`);
    if (!resp.ok) return [];
    const payload = await resp.json();
    const events = payload?.events ?? (Array.isArray(payload) ? payload : []);
    const tags = events[0]?.tags ?? [];
    return tags.filter(t => t[0] === 'r').map(t => t[1]);
  } catch { return []; }
}

export async function zapContributor({ recipientPubkeyHex, amountSats, claimEventId, listCoordinate }) {
  if (!/^[0-9a-f]{64}$/i.test(recipientPubkeyHex)) throw new Error('recipientPubkeyHex must be hex');
  if (!Number.isInteger(amountSats) || amountSats <= 0) throw new Error('amountSats must be a positive integer');

  const profile = await fetchProfileEntry(recipientPubkeyHex);

  const lud16 = readLud16(profile);
  if (!lud16) throw new Error('Recipient has no Lightning address');
  if (!window.nostr) throw new Error('No NIP-07 signer (nos2x / Alby) detected');
  if (!claimEventId) throw new Error('claimEventId is required');

  const lnurlData = await fetchLnurlPayData(lud16);

  const amountMsats = amountSats * 1000;
  if (lnurlData.minSendable && amountMsats < lnurlData.minSendable) {
    throw new Error(`Amount below recipient minimum (${Math.ceil(lnurlData.minSendable / 1000)} sats)`);
  }
  if (lnurlData.maxSendable && amountMsats > lnurlData.maxSendable) {
    throw new Error(`Amount above recipient maximum (${Math.floor(lnurlData.maxSendable / 1000)} sats)`);
  }

  const relays = await fetchRelayList(recipientPubkeyHex);
  const relayTag = ['relays', ...(relays.length > 0 ? relays : ['wss://localhost:7777'])];

  const zapRequest = {
    kind: 9734,
    created_at: Math.floor(Date.now() / 1000),
    content: '',
    tags: [
      ['p', recipientPubkeyHex],
      ['e', claimEventId],
      ...(listCoordinate ? [['a', listCoordinate]] : []),
      ['amount', String(amountMsats)],
      relayTag,
    ],
  };
  const signed = await window.nostr.signEvent(zapRequest);

  const callbackUrl = new URL(lnurlData.callback);
  callbackUrl.searchParams.set('amount', String(amountMsats));
  callbackUrl.searchParams.set('nostr', JSON.stringify(signed));

  const invoiceResp = await fetch(callbackUrl.toString());
  if (!invoiceResp.ok) throw new Error(`LNURL callback returned ${invoiceResp.status}`);
  const invoiceData = await invoiceResp.json();
  if (!invoiceData?.pr) throw new Error('LNURL callback did not return an invoice');
  return { type: 'bolt11', payload: invoiceData.pr };
}
