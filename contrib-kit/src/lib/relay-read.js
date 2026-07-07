const WebSocket = require('ws');

// Generic relay read: open a REQ on each relay, collect EVENTs until EOSE from
// all of them (or timeout), return events deduped by id. Used by the user agent
// (which has no `strfry scan` CLI) to read negotiation/claim events over ws.
function collectEvents(filter, relays, { timeoutMs = 5000, wsFactory = (url) => new WebSocket(url) } = {}) {
  const urls = (relays || []).filter(Boolean);
  if (!urls.length) return Promise.resolve([]);

  return new Promise((resolve) => {
    const byId = new Map();
    const sockets = [];
    let eosed = 0;
    let settled = false;
    const subId = `mc-${Math.abs(JSON.stringify(filter).length)}-${urls.length}`;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      for (const ws of sockets) { try { ws.close(); } catch { /* ignore */ } }
      resolve([...byId.values()]);
    };
    const timer = setTimeout(finish, timeoutMs);

    for (const url of urls) {
      let ws;
      try { ws = wsFactory(url); } catch { eosed += 1; continue; }
      sockets.push(ws);
      ws.on('open', () => {
        try { ws.send(JSON.stringify(['REQ', subId, filter])); } catch { /* ignore */ }
      });
      ws.on('message', (data) => {
        let msg;
        try { msg = JSON.parse(data.toString()); } catch { return; }
        if (msg[0] === 'EVENT' && msg[1] === subId && msg[2]?.id) byId.set(msg[2].id, msg[2]);
        else if (msg[0] === 'EOSE' && msg[1] === subId) { eosed += 1; if (eosed >= urls.length) finish(); }
      });
      ws.on('error', () => { eosed += 1; if (eosed >= urls.length) finish(); });
    }
  });
}

module.exports = { collectEvents };
