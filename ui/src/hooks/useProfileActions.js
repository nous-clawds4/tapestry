/**
 * Custom hook for follow/unfollow, mute/unmute, and NIP-56 report actions.
 *
 * Manages fetching the logged-in user's kind 3, kind 10000, and kind 1984 events
 * from relays, checking relationship status, and publishing updated events.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchFromRelays, publishEverywhere, PUBLISH_RELAYS } from '../utils/nostrPublish';

/**
 * @param {string} targetPubkey - The pubkey of the profile being viewed
 * @param {string|null} loggedInPubkey - The logged-in user's pubkey (null if not logged in)
 * @returns {object} State and action methods for profile interactions
 */
export function useProfileActions(targetPubkey, loggedInPubkey) {
  const [isFollowing, setIsFollowing] = useState(null);
  const [isMuted, setIsMuted] = useState(null);
  const [hasReported, setHasReported] = useState(null);

  const [contactListEvent, setContactListEvent] = useState(null);
  const [muteListEvent, setMuteListEvent] = useState(null);

  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  // Confirmation flow state
  const [needsConfirmation, setNeedsConfirmation] = useState(null);
  const pendingAction = useRef(null);

  // Fetch relationship status on mount
  useEffect(() => {
    if (!targetPubkey || !loggedInPubkey || targetPubkey === loggedInPubkey) return;

    let cancelled = false;

    async function fetchStatus() {
      const [contactEvents, muteEvents, reportEvents] = await Promise.all([
        fetchFromRelays({ kinds: [3], authors: [loggedInPubkey], limit: 1 }, PUBLISH_RELAYS),
        fetchFromRelays({ kinds: [10000], authors: [loggedInPubkey], limit: 1 }, PUBLISH_RELAYS),
        fetchFromRelays({ kinds: [1984], authors: [loggedInPubkey], '#p': [targetPubkey] }, PUBLISH_RELAYS),
      ]);

      if (cancelled) return;

      // Kind 3: find the most recent by created_at
      if (contactEvents.length > 0) {
        const latest = contactEvents.reduce((a, b) => (a.created_at > b.created_at ? a : b));
        setContactListEvent(latest);
        const follows = latest.tags?.some(t => t[0] === 'p' && t[1] === targetPubkey);
        setIsFollowing(!!follows);
      } else {
        setContactListEvent(null);
        setIsFollowing(false);
      }

      // Kind 10000: most recent
      if (muteEvents.length > 0) {
        const latest = muteEvents.reduce((a, b) => (a.created_at > b.created_at ? a : b));
        setMuteListEvent(latest);
        const muted = latest.tags?.some(t => t[0] === 'p' && t[1] === targetPubkey);
        setIsMuted(!!muted);
      } else {
        setMuteListEvent(null);
        setIsMuted(false);
      }

      // Kind 1984: any report means already reported
      setHasReported(reportEvents.length > 0);
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [targetPubkey, loggedInPubkey]);

  // Sign and publish a new event via NIP-07
  const signAndPublish = useCallback(async (unsignedEvent) => {
    if (!window.nostr) {
      throw new Error('No NIP-07 extension found. Please install nos2x, Alby, or similar.');
    }
    const pubkey = await window.nostr.getPublicKey();
    const eventToSign = { ...unsignedEvent, pubkey };
    const signedEvent = await window.nostr.signEvent(eventToSign);
    const result = await publishEverywhere(signedEvent);
    return { signedEvent, result };
  }, []);

  // Build a replacement kind 3 or 10000 event with modified tags
  const buildReplacementEvent = useCallback((existingEvent, newTags) => {
    return {
      kind: existingEvent.kind,
      created_at: Math.floor(Date.now() / 1000),
      tags: newTags,
      content: existingEvent.content || '',
    };
  }, []);

  // ── Follow ──

  const follow = useCallback(async () => {
    if (!loggedInPubkey) return;
    setError(null);

    // If no contact list found, require confirmation
    if (!contactListEvent) {
      setNeedsConfirmation({
        action: 'follow',
        title: 'Create Contact List?',
        message: 'No existing contact list was found on the relays we checked. Creating a new one may overwrite contacts stored on other relays. Do you want to continue?',
      });
      pendingAction.current = () => executeFollow(null);
      return;
    }

    await executeFollow(contactListEvent);
  }, [loggedInPubkey, contactListEvent, targetPubkey]);

  const executeFollow = useCallback(async (existingEvent) => {
    setActionLoading('follow');
    try {
      const existingTags = existingEvent?.tags || [];
      // Don't add duplicate
      if (existingTags.some(t => t[0] === 'p' && t[1] === targetPubkey)) {
        setIsFollowing(true);
        return;
      }
      const newTags = [...existingTags, ['p', targetPubkey]];
      const unsigned = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: existingEvent?.content || '',
      };
      const { signedEvent } = await signAndPublish(unsigned);
      setContactListEvent(signedEvent);
      setIsFollowing(true);
    } catch (err) {
      setError(`Follow failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [targetPubkey, signAndPublish]);

  // ── Unfollow ──

  const unfollow = useCallback(async () => {
    if (!loggedInPubkey) return;
    setError(null);

    if (!contactListEvent) {
      setNeedsConfirmation({
        action: 'unfollow',
        title: 'No Contact List Found',
        message: 'No existing contact list was found on the relays we checked. Creating a new empty list may overwrite contacts stored on other relays. Do you want to continue?',
      });
      pendingAction.current = () => executeUnfollow(null);
      return;
    }

    await executeUnfollow(contactListEvent);
  }, [loggedInPubkey, contactListEvent, targetPubkey]);

  const executeUnfollow = useCallback(async (existingEvent) => {
    setActionLoading('unfollow');
    try {
      const existingTags = existingEvent?.tags || [];
      const newTags = existingTags.filter(t => !(t[0] === 'p' && t[1] === targetPubkey));
      const unsigned = {
        kind: 3,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: existingEvent?.content || '',
      };
      const { signedEvent } = await signAndPublish(unsigned);
      setContactListEvent(signedEvent);
      setIsFollowing(false);
    } catch (err) {
      setError(`Unfollow failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [targetPubkey, signAndPublish]);

  // ── Mute ──

  const mute = useCallback(async () => {
    if (!loggedInPubkey) return;
    setError(null);

    if (!muteListEvent) {
      setNeedsConfirmation({
        action: 'mute',
        title: 'Create Mute List?',
        message: 'No existing mute list was found on the relays we checked. Creating a new one may overwrite a mute list stored on other relays. Do you want to continue?',
      });
      pendingAction.current = () => executeMute(null);
      return;
    }

    await executeMute(muteListEvent);
  }, [loggedInPubkey, muteListEvent, targetPubkey]);

  const executeMute = useCallback(async (existingEvent) => {
    setActionLoading('mute');
    try {
      const existingTags = existingEvent?.tags || [];
      if (existingTags.some(t => t[0] === 'p' && t[1] === targetPubkey)) {
        setIsMuted(true);
        return;
      }
      const newTags = [...existingTags, ['p', targetPubkey]];
      const unsigned = {
        kind: 10000,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: existingEvent?.content || '',
      };
      const { signedEvent } = await signAndPublish(unsigned);
      setMuteListEvent(signedEvent);
      setIsMuted(true);
    } catch (err) {
      setError(`Mute failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [targetPubkey, signAndPublish]);

  // ── Unmute ──

  const unmute = useCallback(async () => {
    if (!loggedInPubkey) return;
    setError(null);

    if (!muteListEvent) {
      setNeedsConfirmation({
        action: 'unmute',
        title: 'No Mute List Found',
        message: 'No existing mute list was found on the relays we checked. Creating a new empty list may overwrite a mute list stored on other relays. Do you want to continue?',
      });
      pendingAction.current = () => executeUnmute(null);
      return;
    }

    await executeUnmute(muteListEvent);
  }, [loggedInPubkey, muteListEvent, targetPubkey]);

  const executeUnmute = useCallback(async (existingEvent) => {
    setActionLoading('unmute');
    try {
      const existingTags = existingEvent?.tags || [];
      const newTags = existingTags.filter(t => !(t[0] === 'p' && t[1] === targetPubkey));
      const unsigned = {
        kind: 10000,
        created_at: Math.floor(Date.now() / 1000),
        tags: newTags,
        content: existingEvent?.content || '',
      };
      const { signedEvent } = await signAndPublish(unsigned);
      setMuteListEvent(signedEvent);
      setIsMuted(false);
    } catch (err) {
      setError(`Unmute failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [targetPubkey, signAndPublish]);

  // ── Report (NIP-56) ──

  const report = useCallback(async (reportType, note = '') => {
    if (!loggedInPubkey) return;
    setError(null);
    setActionLoading('report');

    try {
      const unsigned = {
        kind: 1984,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['p', targetPubkey, reportType]],
        content: note,
      };
      await signAndPublish(unsigned);
      setHasReported(true);
    } catch (err) {
      setError(`Report failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  }, [loggedInPubkey, targetPubkey, signAndPublish]);

  // ── Confirmation flow ──

  const confirmAction = useCallback(async () => {
    setNeedsConfirmation(null);
    if (pendingAction.current) {
      const action = pendingAction.current;
      pendingAction.current = null;
      await action();
    }
  }, []);

  const cancelAction = useCallback(() => {
    setNeedsConfirmation(null);
    pendingAction.current = null;
  }, []);

  return {
    isFollowing,
    isMuted,
    hasReported,
    actionLoading,
    error,
    follow,
    unfollow,
    mute,
    unmute,
    report,
    needsConfirmation,
    confirmAction,
    cancelAction,
  };
}
