async function parseJsonOrThrow(resp) {
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || body.success === false) {
    throw new Error(body.error || `HTTP ${resp.status}`);
  }
  return body;
}

export async function listBounties({ status = 'open' } = {}) {
  const resp = await fetch(`/api/bounties?status=${encodeURIComponent(status)}`);
  return (await parseJsonOrThrow(resp)).bounties ?? [];
}

export async function getBounty(id) {
  const resp = await fetch(`/api/bounties/${encodeURIComponent(id)}`);
  return parseJsonOrThrow(resp);
}

export async function createBounty({ listCoordinate, amountSats, criteria, expiration }) {
  const resp = await fetch('/api/bounties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ listCoordinate, amountSats, criteria, expiration }),
  });
  return (await parseJsonOrThrow(resp)).bounty;
}

export async function getEligible(viewerPubkeyHex) {
  const resp = await fetch(`/api/bounties/eligible?viewer=${encodeURIComponent(viewerPubkeyHex)}`, {
    credentials: 'include',
  });
  return (await parseJsonOrThrow(resp)).bounties ?? [];
}

export async function getPaymentsDue() {
  const resp = await fetch('/api/bounties/mine/payments-due', { credentials: 'include' });
  return (await parseJsonOrThrow(resp)).items ?? [];
}

export async function getPaymentsToMe() {
  const resp = await fetch('/api/bounties/mine/payments-to-me', { credentials: 'include' });
  const body = await parseJsonOrThrow(resp);
  return {
    pastDue: body.pastDue ?? [],
    pending: body.pending ?? [],
    paid: body.paid ?? [],
    closed: body.closed ?? [],
  };
}
