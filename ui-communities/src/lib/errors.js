/*
 * Shared error-copy helpers for publish and sign-in flows.
 *
 * Extracted from the four duplicate copies that lived in
 * CommunityDetail.jsx, MemberDrawerContent.jsx, Create.jsx, and
 * Header.jsx (Header used the name `errorCopyFor`). Consolidated
 * here so future surfaces import one source of truth.
 *
 * The `result` argument matches the publish wrapper's failure shape
 * ({ error: 'no-extension' | ... , message: string }); `code` is the
 * `signInWithNip07` failure-result's `error` field.
 */

export function publishErrorCopy(result) {
  switch (result && result.error) {
    case 'no-extension':
      return 'Sign in with a nostr extension to publish.'
    case 'rejected':
      return 'Signing cancelled.'
    case 'timeout':
      return 'The relay took too long to confirm. Try again?'
    case 'rejected-by-relay':
      return 'The relay rejected this event.'
    case 'network':
      return 'We could not reach the relay. Check your connection?'
    default:
      return 'Something went wrong publishing. Try again?'
  }
}

export function signInErrorCopy(code) {
  switch (code) {
    case 'no-extension':
      return 'Brainstorm Communities needs a nostr browser extension to sign in. Try Alby or nos2x.'
    case 'rejected':
      return 'Sign-in cancelled.'
    default:
      return 'Sign-in failed. Try again?'
  }
}
