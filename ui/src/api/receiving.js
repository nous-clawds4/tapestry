/**
 * Thin client for the receiving-method setup API (LNURL-only).
 *
 *   getOptions()        → WALLET_OPTIONS catalog
 *   probe(value)        → { probe, verdict } — is this address/LNURL tracked?
 *   build({method,value}) → { content, field, value, cleared, replaced }
 *
 * `build` returns the unsigned kind-0 content the server merged into the
 * session user's own profile (REPLACE semantics). The caller signs it with
 * window.nostr and publishes via POST /api/strfry/publish (see publishKind0
 * in ReceivingSetup.jsx).
 */

async function parseJsonOrThrow(resp) {
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || body.success === false) {
    throw new Error(body.error || `HTTP ${resp.status}`);
  }
  return body;
}

export async function getOptions() {
  const resp = await fetch('/api/receiving/options', { credentials: 'include' });
  return (await parseJsonOrThrow(resp)).options ?? [];
}

export async function probe(value) {
  const resp = await fetch('/api/receiving/probe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });
  const body = await parseJsonOrThrow(resp);
  return { probe: body.probe, verdict: body.verdict };
}

export async function build({ method, value }) {
  const resp = await fetch('/api/receiving/build', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ method, value }),
  });
  return parseJsonOrThrow(resp);
}
