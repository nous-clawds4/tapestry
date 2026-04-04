/**
 * NIP-50 Relay Proxy — Entry Point
 *
 * HTTP server that:
 *   1. Handles NIP-11 requests (Accept: application/nostr+json)
 *   2. Upgrades WebSocket connections and creates ClientSession instances
 *
 * Sits between nginx and strfry, intercepting NIP-50 search REQs
 * and routing them through the Meilisearch + WoT pipeline.
 */

import http from 'http';
import { WebSocketServer } from 'ws';
import { ClientSession } from './session.js';
import { getNip11Info } from './nip11.js';

const LISTEN_PORT = parseInt(process.env.NIP50_PORT || '7780');
const LISTEN_HOST = process.env.NIP50_HOST || '127.0.0.1';
const STRFRY_URL = process.env.STRFRY_URL || 'ws://127.0.0.1:7777';
const SEARCH_API_URL = process.env.SEARCH_API_URL || 'http://127.0.0.1:3069';

// Track active sessions for stats
let activeSessions = 0;
let totalSessions = 0;

/**
 * HTTP server handles NIP-11 info requests and serves as the
 * base for WebSocket upgrades.
 */
const server = http.createServer(async (req, res) => {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // NIP-11: Relay Information Document
  if (req.headers.accept?.includes('application/nostr+json')) {
    try {
      const info = await getNip11Info();
      res.writeHead(200, { 'Content-Type': 'application/nostr+json' });
      res.end(JSON.stringify(info));
    } catch (err) {
      console.error(`[nip11] Failed to build relay info: ${err.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal error' }));
    }
    return;
  }

  // Health check / status endpoint
  if (req.url === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'nip50-proxy',
      status: 'ok',
      activeSessions,
      totalSessions,
      uptime: process.uptime(),
    }));
    return;
  }

  // Default: plain text landing page
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Tapestry NIP-50 Relay Proxy — connect via WebSocket');
});

/**
 * WebSocket server for nostr client connections.
 */
const wss = new WebSocketServer({ server });

wss.on('connection', (clientWs, req) => {
  activeSessions++;
  totalSessions++;

  const remoteAddr = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[nip50-proxy] Client connected from ${remoteAddr} (active: ${activeSessions})`);

  const session = new ClientSession(clientWs, STRFRY_URL, SEARCH_API_URL);

  clientWs.on('close', () => {
    activeSessions--;
    console.log(`[nip50-proxy] Client disconnected (active: ${activeSessions})`);
  });
});

/**
 * Start listening.
 */
server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(`[nip50-proxy] NIP-50 Relay Proxy listening on ${LISTEN_HOST}:${LISTEN_PORT}`);
  console.log(`[nip50-proxy] Proxying to strfry at ${STRFRY_URL}`);
  console.log(`[nip50-proxy] Search API at ${SEARCH_API_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[nip50-proxy] SIGTERM received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[nip50-proxy] SIGINT received, shutting down...');
  wss.close();
  server.close();
  process.exit(0);
});
