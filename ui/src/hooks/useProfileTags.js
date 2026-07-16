import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePov } from '../context/PovContext';
import { useConfig } from '../context/ConfigContext';
import { publishProfileTagAssertion, publishOrThrow } from '../utils/publishProfileTag';
import { syncPinnedExportsForTag } from '../utils/publishTagPin';
import { TAG_FOR_NOSTR_PUBKEY_Z } from '@tapestry/event-tagging';
import notifyTagApplicability from '../utils/notifyTagApplicability';

const TA_PUBKEY = '82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833';
const TAG_HANDLE = `39998:${TA_PUBKEY}:tag`;

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function nip07Pubkey() {
  if (!window.nostr) throw new Error('No NIP-07 extension detected. Install one to publish tags.');
  return window.nostr.getPublicKey();
}

export default function useProfileTags(targetPubkey, viewerPubkey) {
  const { user, loading: authLoading } = useAuth();
  const { povParams } = usePov();
  // W11 / tag-federation ADR 0003 — the runtime instance TA for the local z.
  const { taPubkey } = useConfig();
  const [availableTags, setAvailableTags] = useState([]);
  const [applications, setApplications] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [povResolution, setPovResolution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!targetPubkey) return;
    if (authLoading) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);

    // POV-aware fetch per ADR-0006: chip-row counts are now WoT-filtered.
    // Selected-POV read params (ADR pov-selectable-tag-surfaces/0001).
    const tagsForProfileParams = new URLSearchParams({ pubkey: targetPubkey });
    Object.entries(povParams).forEach(([k, v]) => tagsForProfileParams.set(k, v));

    (async () => {
      try {
        const [tagsResp, profileResp] = await Promise.all([
          fetch('/api/profile-tags/available-tags').then((r) => r.json()),
          fetch(`/api/profile-tags/tags-for-profile?${tagsForProfileParams}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        if (!tagsResp.success) throw new Error(tagsResp.error || 'failed to load available tags');
        if (!profileResp.success) throw new Error(profileResp.error || 'failed to load profile tags');
        setAvailableTags(tagsResp.tags || []);
        setApplications(profileResp.applications || []);
        setDisputes(profileResp.disputes || []);
        setPovResolution(profileResp.povResolution || null);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetPubkey, reloadKey, authLoading, user?.pubkey, povParams.wotPov, povParams.userPubkey]);

  const buildAndPublishAssertion = useCallback(
    (tag, polarity) => publishProfileTagAssertion({ tag, targetPubkey, polarity, localTaPubkey: taPubkey }),
    [targetPubkey, taPubkey]
  );

  // Story 21 / ADR 0019 — if the viewer has pinned this tag, keep its
  // exports current after the assertion (recompute kind-30392, re-export
  // the kind-30000 footprint). No-op when the tag isn't pinned (AC-16).
  const reexportAfterAssertion = useCallback((tag) => {
    if (!viewerPubkey) return;
    syncPinnedExportsForTag({ tag, viewerPubkey })
      .catch(() => { /* best-effort */ });
  }, [viewerPubkey]);

  const applyTag = useCallback(
    async (tag) => {
      await buildAndPublishAssertion(tag, 1);
      refetch();
      reexportAfterAssertion(tag);
      notifyTagApplicability(); // first pubkey-use may graduate the tag into the applicability list (ADR 0003)
    },
    [buildAndPublishAssertion, refetch, reexportAfterAssertion]
  );

  const disputeTag = useCallback(
    async (tag) => {
      await buildAndPublishAssertion(tag, -1);
      refetch();
      reexportAfterAssertion(tag);
    },
    [buildAndPublishAssertion, refetch, reexportAfterAssertion]
  );

  const createTag = useCallback(
    async ({ name, description }) => {
      const authorPk = await nip07Pubkey();
      const slug = slugify(name);
      if (!slug) throw new Error('Tag name must contain at least one alphanumeric character.');
      // W11 / tag-federation ADR 0003 — the LOCAL z (runtime instance TA) lands the
      // new tag element in this instance's own concept list; the canonical z stays
      // the ADR-0015 literal. Non-fatal: a missing/malformed local TA omits the
      // local z (canonical still ships) and warns — never blocks the publish.
      const hasLocalTa = /^[0-9a-f]{64}$/.test(taPubkey || '');
      if (!hasLocalTa) {
        console.warn('[useProfileTags.createTag] local TA pubkey missing/malformed — local z omitted (canonical z still published)');
      }
      const unsigned = {
        kind: 39999,
        pubkey: authorPk,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ['d', slug],
          ['z', TAG_HANDLE],                                  // canonical (ADR-0015 literal) — unchanged
          ...(hasLocalTa ? [['z', `39998:${taPubkey}:tag`]] : []), // local (runtime TA) — W11
          // Additive tag-type hint: this new tag is born in the pubkey-tagging flow
          // (tag-applicability Story 1). Pubkey-free, inert to existing readers.
          ['z', TAG_FOR_NOSTR_PUBKEY_Z],
        ],
        content: JSON.stringify({
          tag: { slug, name, description: description || '' },
        }),
      };
      const signed = await window.nostr.signEvent(unsigned);
      await publishOrThrow(signed);
      refetch();
      notifyTagApplicability(); // a new tag with the pubkey hint enters the applicability list (ADR 0003)
      // ADR tag-stack-merge-hardening/0002: a freshly created tag's author is
      // the current user (signed.pubkey). Return it so an immediate apply can
      // build the `a` coordinate (39999:<authorPubkey>:<slug>).
      return { eventId: signed.id, slug, name, description: description || '', authorPubkey: signed.pubkey };
    },
    [refetch, taPubkey]
  );

  const revoke = useCallback(
    async (eventId) => {
      const pubkey = await nip07Pubkey();
      const unsigned = {
        kind: 5,
        pubkey,
        created_at: Math.floor(Date.now() / 1000),
        tags: [['e', eventId]],
        content: 'revoked',
      };
      const signed = await window.nostr.signEvent(unsigned);
      await publishOrThrow(signed);
      refetch();
    },
    [refetch]
  );

  const myApplications = applications.filter((a) => a.authorPubkey === viewerPubkey);
  const myDisputes = disputes.filter((d) => d.authorPubkey === viewerPubkey);

  return {
    availableTags,
    applications,
    disputes,
    povResolution,
    myApplications,
    myDisputes,
    loading,
    error,
    refetch,
    applyTag,
    disputeTag,
    createTag,
    revoke,
  };
}
