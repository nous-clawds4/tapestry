/*
 * Publish wrapper — sign via NIP-07, then log (mock) or send (real).
 *
 * Mode toggle: same VITE_USE_MOCK_DATA env flag as the Slice 3 API client.
 * Mock-data and mock-publish are paired states: dev tooling stays self-
 * contained, prod hits the relay set.
 *
 * The strict `=== 'true'` comparison is intentional — Vite exposes env
 * vars as strings, so a `!!` check would treat the literal "false" as
 * truthy and accidentally enable mock-publish in production.
 */

import { Relay } from 'nostr-tools/relay'
import { signEventViaNip07 } from '../auth/viewer.js'

const USE_MOCK = import.meta.env.VITE_USE_MOCK_DATA === 'true'

// The communities droplet exposes strfry at the /relay path (host nginx
// proxies / to the React app, /relay to the strfry websocket). A bare
// host URL connects to the HTTP root and never upgrades to a websocket.
export const DEFAULT_RELAYS = ['wss://communities.brainstorm.world/relay']

// Membership writes — tag-elements + assertions — must also reach the host that
// runs the read+score engine (ADR 0031, A1 dual-publish), so its strfry sees
// them and the roster resolves. The extra target is env-driven (VITE_TAG_RELAY)
// rather than hardcoded; unset → communities relay only (a relay mirror, A2,
// can cover the gap instead). CDs and conversation events do NOT fan out here.
const TAG_RELAY = (import.meta.env.VITE_TAG_RELAY || '').trim()
export const MEMBERSHIP_WRITE_RELAYS = TAG_RELAY
  ? [...DEFAULT_RELAYS, TAG_RELAY]
  : DEFAULT_RELAYS

const DEFAULT_TIMEOUT_MS = 10000

/**
 * Sign + (log | send) an unsigned nostr event.
 *
 * @param {object} unsigned   Unsigned event from src/events/build.js
 * @param {object} [options]
 * @param {string[]} [options.relays=DEFAULT_RELAYS]  Relay set to publish to.
 * @param {number} [options.timeout=10000]            Per-relay timeout in ms.
 * @returns {Promise<PublishResult>}
 *
 * PublishResult is either:
 *   { ok: true, eventId, signed, relaysAccepted }
 *   { ok: false, error: 'no-extension' | 'rejected' | 'network' |
 *                      'rejected-by-relay' | 'timeout' | 'unknown',
 *     message }
 */
export async function publishEvent(unsigned, options = {}) {
  // All NIP-07 access routes through auth/viewer.js — that module owns
  // the single chokepoint for the browser signer surface.
  const signed = await signEventViaNip07(unsigned)
  if (signed && signed.error) {
    return { ok: false, error: signed.error, message: signed.message }
  }

  // Mock-mode: log the signed event and resolve as if it went out.
  if (USE_MOCK) {
    console.log('[publish/mock]', signed)
    return {
      ok: true,
      eventId: signed.id,
      signed,
      relaysAccepted: [],
    }
  }

  // Real-mode: publish to each relay in parallel, collect the OKs.
  const relays = Array.isArray(options.relays) && options.relays.length > 0
    ? options.relays
    : DEFAULT_RELAYS
  const timeoutMs = typeof options.timeout === 'number' ? options.timeout : DEFAULT_TIMEOUT_MS

  const results = await Promise.allSettled(
    relays.map(url => publishToRelay(url, signed, timeoutMs)),
  )

  const accepted = []
  let lastError = null
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'fulfilled' && r.value && r.value.ok) {
      accepted.push(relays[i])
    } else if (r.status === 'fulfilled') {
      lastError = r.value
    } else {
      lastError = { error: 'network', message: (r.reason && r.reason.message) || 'Network error' }
    }
  }

  if (accepted.length === 0) {
    return {
      ok: false,
      error: (lastError && lastError.error) || 'rejected-by-relay',
      message: (lastError && lastError.message) || 'No relays accepted the event.',
    }
  }

  return {
    ok: true,
    eventId: signed.id,
    signed,
    relaysAccepted: accepted,
  }
}

async function publishToRelay(url, signed, timeoutMs) {
  let relay
  try {
    relay = await Relay.connect(url)
  } catch (err) {
    return { ok: false, error: 'network', message: (err && err.message) || `Connect to ${url} failed.` }
  }
  try {
    await Promise.race([
      relay.publish(signed),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Publish to ${url} timed out`)), timeoutMs),
      ),
    ])
    return { ok: true }
  } catch (err) {
    const message = (err && err.message) || `Publish to ${url} failed.`
    const isTimeout = /timed out/i.test(message)
    return {
      ok: false,
      error: isTimeout ? 'timeout' : 'rejected-by-relay',
      message,
    }
  } finally {
    try { relay.close() } catch { /* ignore */ }
  }
}

export const IS_MOCK_PUBLISH = USE_MOCK
