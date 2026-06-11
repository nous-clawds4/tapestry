const DEFAULT_TIMEOUT_MS = 10000;

function phoenixConfig() {
  return {
    url: (process.env.PHOENIXD_URL || '').replace(/\/+$/, ''),
    password: process.env.PHOENIXD_PASSWORD || '',
  };
}

function requirePhoenixConfig(config = phoenixConfig()) {
  if (!config.url) throw new Error('PHOENIXD_URL is not configured');
  if (!config.password) throw new Error('PHOENIXD_PASSWORD is not configured');
  return config;
}

function authHeader(password) {
  return `Basic ${Buffer.from(`:${password}`).toString('base64')}`;
}

async function phoenixFetch(path, { method = 'GET', body = null, timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const config = requirePhoenixConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetchImpl(`${config.url}${path}`, {
      method,
      signal: ctrl.signal,
      headers: {
        Authorization: authHeader(config.password),
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body,
    });
    const text = await resp.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
    if (!resp.ok) {
      const detail = typeof payload === 'string' ? payload : payload?.error || payload?.message;
      throw new Error(`phoenixd ${path} failed (${resp.status})${detail ? `: ${detail}` : ''}`);
    }
    return payload;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('phoenixd request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function getBalance(opts = {}) {
  return phoenixFetch('/getbalance', opts);
}

async function payBolt11(invoice, opts = {}) {
  if (typeof invoice !== 'string' || !invoice.trim()) throw new Error('invoice is required');
  const body = new URLSearchParams({ invoice: invoice.trim() }).toString();
  return phoenixFetch('/payinvoice', { ...opts, method: 'POST', body });
}

module.exports = {
  getBalance,
  payBolt11,
  phoenixConfig,
};
