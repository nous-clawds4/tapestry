/**
 * Open-Ranking (ORE) shared helpers. See ADR open-ranking/0001.
 *
 * ORE-00 conventions live here: 64-hex-lowercase pubkey validation, the
 * Access-Control-Allow-Origin:* / application/json header set, the error-triple
 * shape (status + X-Reason), and the helper that applies a { httpStatus, headers,
 * body } triple to an Express response.
 */


// ORE-00: pubkeys are 64-char lowercase hex; npub/bech32 is rejected.
function isValidHexPubkey(s) {
  return typeof s === 'string' && /^[0-9a-f]{64}$/.test(s);
}

// ORE-00: every response is JSON with Access-Control-Allow-Origin: * (public,
// credential-less). `extra` adds/overrides headers (e.g. X-Reason, Cache-Control).
function oreHeaders(extra) {
  return Object.assign({
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json; charset=utf-8',
  }, extra || {});
}

// ORE-00: error detail rides the X-Reason header; status carries the meaning.
function errorTriple(httpStatus, reason) {
  return { httpStatus, headers: oreHeaders({ 'X-Reason': reason }), body: { error: reason } };
}

// Apply a pure { httpStatus, headers, body } triple to an Express response.
function applyTriple(res, triple) {
  const { httpStatus, headers, body } = triple;
  for (const k of Object.keys(headers || {})) res.set(k, headers[k]);
  res.status(httpStatus).json(body);
}

module.exports = { isValidHexPubkey, oreHeaders, errorTriple, applyTriple };
