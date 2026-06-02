#!/usr/bin/env node

/**
 * paycode — render a Lightning payment code as a QR, exactly as the issuer-side
 * UI (ui/src/components/PaymentCode.jsx) shows it. The terminal/PNG/HTML output
 * mirrors that component's label + helper text so a CLI preview is faithful to
 * what a payer would actually see and scan.
 *
 * Accepts a BOLT11 invoice (lnbc…), a BOLT12 offer (lno1…), or a BIP-21/lightning:
 * URI. Classification matches readBolt12()/PaymentCode's bolt12-vs-bolt11 split.
 *
 *   node bin/paycode.js <payload> [--png <path>] [--html <path>] [--no-term] [--json]
 *   echo "<payload>" | node bin/paycode.js --png /tmp/code.png
 */
const fs = require('fs');
const path = require('path');

function loadDep(name) {
  const tries = [name, path.join(__dirname, '..', 'ui', 'node_modules', name), `/usr/local/lib/node_modules/brainstorm/node_modules/${name}`];
  for (const t of tries) { try { return require(t); } catch {} }
  throw new Error(`cannot load '${name}' — is qrcode installed (ui/node_modules)?`);
}
const QRCode = loadDep('qrcode');

// Mirror of PaymentCode.jsx labels.
function classify(payload) {
  const s = String(payload).trim();
  if (/lno1[a-z0-9]{8,}/i.test(s)) {
    return { type: 'bolt12', label: 'BOLT12 offer (static, reusable)', wallet: 'Scan with Phoenix / Zeus / CLN, or paste into a BOLT12-aware wallet — pay any amount.' };
  }
  if (/ln(bc|tb|bcrt)[0-9]/i.test(s)) {
    return { type: 'bolt11', label: 'BOLT11 invoice (one-time)', wallet: 'Scan or paste into your Lightning wallet to pay this exact amount.' };
  }
  return { type: 'unknown', label: 'Payment code', wallet: 'Scan or paste into a Lightning wallet.' };
}

function parseArgs(argv) {
  const pos = []; const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      if (['no-term', 'json'].includes(k)) { flags[k] = true; continue; }
      const n = argv[i + 1];
      if (n === undefined || n.startsWith('--')) flags[k] = true; else { flags[k] = n; i++; }
    } else pos.push(a);
  }
  return { pos, flags };
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8').trim(); } catch { return ''; }
}

function htmlDoc({ payload, info, dataUrl }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Payment code — ${info.label}</title></head>
<body style="font-family:system-ui,sans-serif;background:#0d1117;color:#c9d1d9;max-width:560px;margin:2rem auto;padding:0 1rem">
<header><h1 style="font-size:1.2rem">${info.label}</h1>
<p style="opacity:.75">${info.wallet}</p></header>
<section style="text-align:center">
<img alt="payment QR" src="${dataUrl}" style="width:300px;height:300px;background:#fff;padding:10px;border-radius:8px"/>
</section>
<section><p style="opacity:.7;font-size:.85rem">Raw code (copy/paste if you can't scan):</p>
<pre style="white-space:pre-wrap;word-break:break-all;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:10px;font-size:.7rem">${payload.replace(/[<&]/g, c => ({ '<': '&lt;', '&': '&amp;' }[c]))}</pre></section>
<footer><p style="opacity:.6;font-size:.8rem">Rendered by <code>bin/paycode.js</code> — a faithful CLI mirror of the app's <code>PaymentCode</code> component. ${info.type === 'bolt11' ? 'One-time invoice: pay exactly once.' : info.type === 'bolt12' ? 'Static offer: reusable, payer chooses the amount (BOLT12-aware wallet required).' : ''}</p></footer>
</body></html>`;
}

async function main() {
  const { pos, flags } = parseArgs(process.argv.slice(2));
  const payload = (pos[0] || readStdin() || '').trim();
  if (!payload) {
    console.error('usage: paycode <bolt11|bolt12|lightning:|bitcoin:?lno=> [--png path] [--html path] [--no-term] [--json]');
    process.exit(1);
  }
  const info = classify(payload);

  if (!flags.json) {
    console.log(`\n${info.label}`);
    console.log(`${info.wallet}\n`);
  }
  if (!flags['no-term'] && !flags.json) {
    console.log(await QRCode.toString(payload, { type: 'terminal', small: true }));
  }
  if (flags.png) { await QRCode.toFile(flags.png, payload, { width: 512, margin: 2 }); }
  let dataUrl = null;
  if (flags.html) {
    dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 2 });
    fs.writeFileSync(flags.html, htmlDoc({ payload, info, dataUrl }));
  }

  if (flags.json) {
    console.log(JSON.stringify({ type: info.type, label: info.label, payload, png: flags.png || null, html: flags.html || null }, null, 2));
  } else {
    if (flags.png) console.log(`PNG written: ${flags.png}`);
    if (flags.html) console.log(`HTML written: ${flags.html}`);
    console.log(`\npayload (${info.type}):\n${payload}`);
  }
}

main().catch(e => { console.error('error:', e.message); process.exit(1); });
