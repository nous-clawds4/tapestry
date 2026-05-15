/*
 * Viewer auth — NIP-07 sign-in, localStorage persistence, npub formatters.
 *
 * This is the single chokepoint for `window.nostr` access. Other modules
 * that need to sign events do so via the publish wrapper, which calls
 * window.nostr.signEvent on its own — but every other touchpoint
 * (sign-in, public-key resolution) routes through here.
 */

import { nip19 } from 'nostr-tools'

const STORAGE_KEY = 'brainstormCommunitiesViewerPubkey'

const HEX_PUBKEY = /^[0-9a-f]{64}$/i

/** @returns {string | null} */
export function getStoredViewerPubkey() {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    if (typeof value !== 'string') return null
    if (!HEX_PUBKEY.test(value)) {
      // Malformed value — clear so it doesn't keep tripping. Avoids a
      // permanently-broken session if the user manually edits localStorage.
      window.localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return value.toLowerCase()
  } catch {
    return null
  }
}

export function storeViewerPubkey(pubkey) {
  if (typeof pubkey !== 'string' || !HEX_PUBKEY.test(pubkey)) return
  try {
    window.localStorage.setItem(STORAGE_KEY, pubkey.toLowerCase())
  } catch {
    // Browser storage quota or private mode — silently ignore.
  }
}

export function clearStoredViewerPubkey() {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Prompt the user's NIP-07 extension for their public key.
 * Resolves to a typed result so callers can switch on the error code.
 */
export async function signInWithNip07() {
  if (typeof window === 'undefined' || !window.nostr || typeof window.nostr.getPublicKey !== 'function') {
    return { ok: false, error: 'no-extension', message: 'No NIP-07 extension found.' }
  }
  try {
    const pubkey = await window.nostr.getPublicKey()
    if (typeof pubkey !== 'string' || !HEX_PUBKEY.test(pubkey)) {
      return { ok: false, error: 'unknown', message: 'Extension returned an unexpected public-key shape.' }
    }
    return { ok: true, pubkey: pubkey.toLowerCase() }
  } catch (err) {
    // Some extensions throw a plain Error on rejection; others reject the
    // promise with an object. Treat anything thrown as "user rejected" by
    // default — operators reading logs see the underlying message.
    const message = (err && err.message) || 'Sign-in request rejected.'
    return { ok: false, error: 'rejected', message }
  }
}

/**
 * Sign an unsigned nostr event via the NIP-07 extension.
 * Returns the signed event ({ ...unsigned, id, sig }) on success,
 * or { error, message } on failure (no-extension / rejected / unknown).
 *
 * This is the only signing entry point in the codebase — publish.js and
 * any future signing-needing module route through here so the NIP-07
 * surface stays centralized in one chokepoint.
 */
export async function signEventViaNip07(unsigned) {
  if (typeof window === 'undefined' || !window.nostr || typeof window.nostr.signEvent !== 'function') {
    return { error: 'no-extension', message: 'No NIP-07 extension found.' }
  }
  try {
    const signed = await window.nostr.signEvent(unsigned)
    return signed
  } catch (err) {
    return {
      error: 'rejected',
      message: (err && err.message) || 'Signing request rejected.',
    }
  }
}

/**
 * Truncated npub for chip / dropdown display.
 * Example output: "npub1n0e...l9rk23".
 */
export function npubShort(hex) {
  const full = npubFull(hex)
  if (!full) return ''
  if (full.length <= 16) return full
  return `${full.slice(0, 10)}...${full.slice(-6)}`
}

/** Full npub for clipboard / accessibility / data attributes. */
export function npubFull(hex) {
  if (typeof hex !== 'string' || !HEX_PUBKEY.test(hex)) return ''
  try {
    return nip19.npubEncode(hex.toLowerCase())
  } catch {
    return ''
  }
}
