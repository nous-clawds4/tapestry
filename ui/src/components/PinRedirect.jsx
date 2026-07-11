import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import TopBar from './TopBar';
import useTLDetail from '../hooks/useTLDetail';

/**
 * Story 20 / ADR 0018 — the standalone /pin/:dTag page is retired. Its
 * content now lives in the tag-detail page's "Pinned" tab. This shim
 * resolves the kind-30392 TL's source tag (slug + event id) and
 * redirects to that tag's detail page with the Pinned tab selected.
 * Existing share links / bookmarks therefore land on the Pinned tab
 * instead of 404ing. A TL that can't be resolved falls back to /pins.
 */
export default function PinRedirect() {
  const { dTag } = useParams();
  const { tl, loading, error } = useTLDetail(dTag);

  if (loading) {
    return (
      <div className="bsp-page">
        <TopBar />
        <div className="bsp-content">
          <p className="bs-pindetail-loading">Loading Trusted List…</p>
        </div>
      </div>
    );
  }

  if (error || !tl?.sourceTag?.slug || !tl?.sourceTag?.eventId) {
    return <Navigate to="/pins" replace />;
  }

  const { slug, eventId } = tl.sourceTag;
  return (
    <Navigate
      to={`/tag/${encodeURIComponent(slug)}/${eventId}?tab=pinned`}
      replace
    />
  );
}
