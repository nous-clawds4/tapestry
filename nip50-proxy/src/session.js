/**
 * ClientSession — Per-connection WebSocket proxy logic.
 *
 * Each client connection gets a ClientSession that:
 *   1. Opens a parallel WebSocket to strfry for passthrough traffic
 *   2. Tracks which subscriptions are search vs. passthrough
 *   3. Routes messages accordingly
 *
 * Message routing:
 *   REQ with "search"    → Meilisearch pipeline → EVENT + EOSE
 *   REQ without "search" → forward to strfry
 *   CLOSE                → clean up; forward to strfry if passthrough
 *   EVENT (publish)      → forward to strfry
 *   strfry responses     → forward to client verbatim
 */

import WebSocket from 'ws';
import { parseSearchString, executeSearchQuery, hitToNostrEvent } from './search.js';

export class ClientSession {
  /**
   * @param {WebSocket} clientWs - The client's WebSocket connection
   * @param {string} strfryUrl - WebSocket URL for strfry (e.g., ws://127.0.0.1:7777)
   * @param {string} searchApiUrl - HTTP URL for nostr-search-api (e.g., http://127.0.0.1:3069)
   */
  constructor(clientWs, strfryUrl, searchApiUrl) {
    this.clientWs = clientWs;
    this.strfryUrl = strfryUrl;
    this.searchApiUrl = searchApiUrl;
    this.subscriptions = new Map(); // subId → { isSearch: boolean }
    this.strfryWs = null;
    this.strfryReady = false;
    this.pendingMessages = []; // Buffer messages until strfry connection is open
    this.closed = false;

    this._connectStrfry();
    this._bindClient();
  }

  /**
   * Open a WebSocket connection to strfry for passthrough traffic.
   */
  _connectStrfry() {
    this.strfryWs = new WebSocket(this.strfryUrl);

    this.strfryWs.on('open', () => {
      this.strfryReady = true;
      // Flush any buffered messages
      for (const msg of this.pendingMessages) {
        this.strfryWs.send(msg);
      }
      this.pendingMessages = [];
    });

    this.strfryWs.on('message', (data) => {
      // Forward all strfry responses to the client verbatim
      if (this.clientWs.readyState === WebSocket.OPEN) {
        this.clientWs.send(data.toString());
      }
    });

    this.strfryWs.on('close', () => {
      // If strfry disconnects, close the client connection too.
      // The client will auto-reconnect and get a fresh session.
      this._teardown();
    });

    this.strfryWs.on('error', (err) => {
      console.error(`[session] strfry WebSocket error: ${err.message}`);
      this._teardown();
    });
  }

  /**
   * Bind event handlers on the client WebSocket.
   */
  _bindClient() {
    this.clientWs.on('message', (data) => {
      this._handleClientMessage(data.toString());
    });

    this.clientWs.on('close', () => {
      this._teardown();
    });

    this.clientWs.on('error', (err) => {
      console.error(`[session] client WebSocket error: ${err.message}`);
      this._teardown();
    });
  }

  /**
   * Parse and route an incoming client message.
   */
  _handleClientMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      // Not valid JSON — forward to strfry as-is
      this._sendToStrfry(raw);
      return;
    }

    if (!Array.isArray(msg) || msg.length === 0) {
      this._sendToStrfry(raw);
      return;
    }

    switch (msg[0]) {
      case 'REQ':
        this._handleReq(msg, raw);
        break;
      case 'CLOSE':
        this._handleClose(msg, raw);
        break;
      case 'EVENT':
        // Client publishing an event — forward to strfry
        this._sendToStrfry(raw);
        break;
      default:
        // Unknown message type — forward to strfry
        this._sendToStrfry(raw);
        break;
    }
  }

  /**
   * Handle a REQ message.
   * Format: ["REQ", <subId>, <filter1>, <filter2>, ...]
   */
  _handleReq(msg, raw) {
    if (msg.length < 3) {
      this._sendToStrfry(raw);
      return;
    }

    const subId = msg[1];
    const filters = msg.slice(2);

    // Check if any filter has a "search" field
    const searchFilter = filters.find(
      (f) => f && typeof f === 'object' && typeof f.search === 'string'
    );

    if (searchFilter) {
      // This is a NIP-50 search request
      this.subscriptions.set(subId, { isSearch: true });
      this._executeSearch(subId, searchFilter, filters);
    } else {
      // Standard request — forward to strfry
      this.subscriptions.set(subId, { isSearch: false });
      this._sendToStrfry(raw);
    }
  }

  /**
   * Execute a NIP-50 search and send results as EVENT messages.
   */
  async _executeSearch(subId, searchFilter, allFilters) {
    const { query, extensions } = parseSearchString(searchFilter.search);

    // Respect kinds filter — currently we only support kind 0
    if (searchFilter.kinds && !searchFilter.kinds.includes(0)) {
      // Requested kinds don't include 0 — no results
      this._sendToClient(JSON.stringify(['EOSE', subId]));
      return;
    }

    // Determine limit from the filter or default to 100
    const limit = searchFilter.limit || 100;

    try {
      const results = await executeSearchQuery(
        this.searchApiUrl,
        query,
        extensions,
        limit
      );

      // Send each hit as an EVENT message
      const hits = results.hits || [];
      for (const hit of hits) {
        const event = hitToNostrEvent(hit);
        this._sendToClient(JSON.stringify(['EVENT', subId, event]));
      }

      // Check if there are non-search filters that should also be forwarded to strfry
      const nonSearchFilters = allFilters.filter(
        (f) => f && typeof f === 'object' && typeof f.search !== 'string'
      );

      if (nonSearchFilters.length > 0) {
        // Forward the non-search portion to strfry as a separate REQ
        // strfry will send its own EVENTs and EOSE for this sub
        // We track that we need to wait for strfry's EOSE before sending ours
        this.subscriptions.set(subId, { isSearch: true, waitingForStrfryEose: true });
        const strfryReq = ['REQ', subId, ...nonSearchFilters];
        this._sendToStrfry(JSON.stringify(strfryReq));
      } else {
        // Pure search — send EOSE immediately
        this._sendToClient(JSON.stringify(['EOSE', subId]));
      }
    } catch (err) {
      console.error(`[session] Search failed for sub ${subId}: ${err.message}`);
      // Send EOSE even on error so the client knows the subscription is done
      this._sendToClient(JSON.stringify(['EOSE', subId]));
    }
  }

  /**
   * Handle a CLOSE message.
   * Format: ["CLOSE", <subId>]
   */
  _handleClose(msg, raw) {
    const subId = msg[1];
    const sub = this.subscriptions.get(subId);
    this.subscriptions.delete(subId);

    if (sub && !sub.isSearch) {
      // Passthrough subscription — forward CLOSE to strfry
      this._sendToStrfry(raw);
    } else if (sub?.waitingForStrfryEose) {
      // Mixed search — also close the strfry portion
      this._sendToStrfry(raw);
    }
    // Pure search subscriptions don't need to be forwarded
  }

  /**
   * Send a message to strfry, buffering if not yet connected.
   */
  _sendToStrfry(raw) {
    if (this.strfryReady && this.strfryWs?.readyState === WebSocket.OPEN) {
      this.strfryWs.send(raw);
    } else {
      this.pendingMessages.push(raw);
    }
  }

  /**
   * Send a message to the client.
   */
  _sendToClient(raw) {
    if (this.clientWs.readyState === WebSocket.OPEN) {
      this.clientWs.send(raw);
    }
  }

  /**
   * Clean up both WebSocket connections.
   */
  _teardown() {
    if (this.closed) return;
    this.closed = true;

    this.subscriptions.clear();
    this.pendingMessages = [];

    if (this.clientWs.readyState === WebSocket.OPEN) {
      this.clientWs.close();
    }
    if (this.strfryWs?.readyState === WebSocket.OPEN) {
      this.strfryWs.close();
    }
  }
}
