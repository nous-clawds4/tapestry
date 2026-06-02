/**
 * Minimal in-process nostr relay for CLI end-to-end tests.
 *
 * Speaks just enough NIP-01 to exercise bin/receiving.js over a real
 * WebSocket: it accepts EVENT (verifying the signature — so "accepted" proves
 * the CLI signed correctly), answers REQ with matching stored events + EOSE,
 * and handles CLOSE. It is deliberately *store-all* (NOT replaceable-event
 * collapsing) so a test can seed a stale kind-0 and a fresh one for the same
 * pubkey and confirm the CLI's newest-wins resolution picks the fresh one.
 */

const { WebSocketServer } = require('ws');
const { verifyEvent } = require('nostr-tools');

function matches(filter, ev) {
  if (filter.kinds && !filter.kinds.includes(ev.kind)) return false;
  if (filter.authors && !filter.authors.includes(ev.pubkey)) return false;
  if (filter.ids && !filter.ids.includes(ev.id)) return false;
  return true;
}

/**
 * @param {object} [opts]
 * @param {object[]} [opts.seedEvents] signed events to pre-store
 * @returns {Promise<{url:string, port:number, events:object[], close:()=>Promise<void>}>}
 */
function startMockRelay({ seedEvents = [] } = {}) {
  return new Promise((resolve) => {
    const events = [...seedEvents];
    const wss = new WebSocketServer({ host: '127.0.0.1', port: 0 }, () => {
      const port = wss.address().port;
      resolve({
        url: `ws://127.0.0.1:${port}`,
        port,
        events,
        close: () => new Promise(r => wss.close(r)),
      });
    });

    wss.on('connection', (ws) => {
      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        const [type] = msg;

        if (type === 'EVENT') {
          const ev = msg[1];
          const ok = (() => { try { return verifyEvent(ev); } catch { return false; } })();
          if (ok) events.push(ev);
          ws.send(JSON.stringify(['OK', ev?.id, ok, ok ? '' : 'invalid: signature verification failed']));
          return;
        }

        if (type === 'REQ') {
          const subId = msg[1];
          const filters = msg.slice(2);
          for (const ev of events) {
            if (filters.some(f => matches(f, ev))) {
              ws.send(JSON.stringify(['EVENT', subId, ev]));
            }
          }
          ws.send(JSON.stringify(['EOSE', subId]));
          return;
        }

        if (type === 'CLOSE') {
          ws.send(JSON.stringify(['CLOSED', msg[1], '']));
        }
      });
    });
  });
}

module.exports = { startMockRelay };
