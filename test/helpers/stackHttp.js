'use strict';
/**
 * One honest way for live suites to call the stack over the container loopback —
 * honest-test-gate #1, ADR honest-test-gate/0001 §6.
 *
 * loopbackRequest() runs `docker exec <container> curl …` and asks curl for the real HTTP
 * status. It never derives a status from the response body. When the stack gives no
 * response — empty output (an interrupted call, a stopped container), a missing status
 * marker, or curl's 000 (a refused connection) — it returns { status: null,
 * noResponse: true }, and describeResponse() says so. Synchronous, like the helpers it
 * replaces. The suites that used to parse (or invent) statuses themselves go through
 * here (OPEN.md row 263; guarded by test/gate-result-record.test.js C7–C10).
 */

const cp = require('child_process');

const MARKER = '\n__STATUS__';

function loopbackRequest({ container = process.env.TAPESTRY_CONTAINER || 'tapestry', method = 'GET', url, body, timeoutS = 30 } = {}) {
  const args = ['exec', container, 'curl', '-s', '-m', String(timeoutS), '-X', method, url];
  if (body !== undefined) args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  args.push('-w', `${MARKER}%{http_code}`);
  let out = '';
  try {
    out = cp.execFileSync('docker', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: (timeoutS + 15) * 1000,
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (e) {
    // curl exits non-zero on a refused connection (still printing its 000 marker);
    // docker exits non-zero when the container is gone (printing nothing).
    out = e && typeof e.stdout === 'string' ? e.stdout : '';
  }
  const at = out.lastIndexOf(MARKER);
  const code = at === -1 ? '' : out.slice(at + MARKER.length).trim();
  const raw = at === -1 ? out : out.slice(0, at);
  let json = null;
  try { json = JSON.parse(raw); } catch { /* not JSON */ }
  const noResponse = !/^[1-5]\d\d$/.test(code);
  return { status: noResponse ? null : Number(code), json, raw, noResponse };
}

function describeResponse(r) {
  if (!r || r.noResponse || r.status === null || r.status === undefined) {
    return 'no response from the stack (empty output, no HTTP status, or a refused connection — an interrupted run, a stopped container, or a dead server)';
  }
  return `HTTP ${r.status}`;
}

module.exports = { loopbackRequest, describeResponse };
