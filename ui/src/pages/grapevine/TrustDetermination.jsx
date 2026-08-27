import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useTrust, SCORING_METHODS } from '../../context/TrustContext';
import useProfiles from '../../hooks/useProfiles';
import { queryRelay } from '../../api/relay';

function shortPubkey(pk) {
  if (!pk) return '—';
  return pk.slice(0, 12) + '…' + pk.slice(-6);
}

// TL membership-method ladder (ADR trusted-lists/0001). Mirrors the server
// constant in src/api/trustedList/membershipMethods.js — keep in sync.
const TL_MEMBERSHIP_METHODS = [
  { id: 'count', label: 'Count — verified taggers (current)', available: true,
    blurb: 'A member joins when enough gate-passing taggers applied the tag and applies outnumber disputes. Every tagger counts as 1.' },
  { id: 'input', label: 'Input & agreement — trust-weighted taggers', available: false,
    blurb: 'Each tagger counts by their trust weight (WoT rank ÷ 100). "Input" = the sum of those weights. "Agreement" = the weighted vote, applies (+1) vs disputes (−1), divided by input: all applies → 1.0, an even split → 0, mostly disputes → negative.' },
  { id: 'certainty', label: 'Certainty — saturating input × agreement', available: false,
    blurb: 'Input converted to certainty (more total trust weight → closer to 1, with diminishing returns), then multiplied by agreement. The full formula.' },
  { id: 'score', label: 'Score — formalized 0–100 contract', available: false,
    blurb: 'Published integer scores, score ≥ 1 membership predicate, score-ordered lists.' },
];

/**
 * Server-side, pipeline-wide TL membership-method selector (ADR
 * trusted-lists/0001). Persists via the owner-gated /api/settings
 * (settings.json on the persistent volume) — distinct from the viewer-side
 * Scoring Method above, which is per-browser localStorage.
 */
function TLMembershipMethodCard() {
  const [method, setMethod] = useState(null); // null = loading
  const [readOnly, setReadOnly] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/settings');
        if (resp.status === 401 || resp.status === 403) {
          if (!cancelled) { setReadOnly(true); setMethod('count'); }
          return;
        }
        const data = await resp.json();
        if (cancelled) return;
        setMethod(data?.settings?.trustedLists?.membershipMethod || 'count');
      } catch {
        if (!cancelled) { setReadOnly(true); setMethod('count'); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectMethod = useCallback(async (id) => {
    if (readOnly || saving || id === method) return;
    setSaveError(null);
    const prev = method;
    setMethod(id); // optimistic — the pipeline reads settings per refresh, no restart needed
    setSaving(true);
    try {
      const resp = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trustedLists: { membershipMethod: id } }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || data?.success === false) {
        setMethod(prev);
        setSaveError(data?.error || `Save failed (${resp.status})`);
      }
    } catch (err) {
      setMethod(prev);
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }, [readOnly, saving, method]);

  return (
    <div style={{
      padding: '1.25rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>TL Membership Method</h3>
      <p style={{ margin: '0 0 1rem', fontSize: '0.8rem', opacity: 0.6, lineHeight: 1.5 }}>
        How this instance&apos;s refresh pipeline computes <strong>Trusted-List membership</strong> from
        pinned-tag assertions. One setting for the whole pipeline, stored server-side — unlike the
        viewer-side Scoring Method above, which only affects what this browser displays. Published
        TLs record the active method in a <code>membership-method</code> tag.
      </p>
      {method === null ? (
        <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {TL_MEMBERSHIP_METHODS.map((m) => {
            const disabled = !m.available || readOnly;
            return (
              <label
                key={m.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
                  padding: '0.6rem 0.75rem',
                  backgroundColor: 'var(--bg-primary, #0f0f23)',
                  border: `1px solid ${method === m.id ? '#58a6ff' : 'var(--border, #444)'}`,
                  borderRadius: '6px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: m.available ? 1 : 0.45,
                }}
              >
                <input
                  type="radio"
                  name="tl-membership-method"
                  value={m.id}
                  checked={method === m.id}
                  disabled={disabled}
                  onChange={() => selectMethod(m.id)}
                  style={{ marginTop: '0.15rem' }}
                />
                <span>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {m.label}
                    {!m.available && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', opacity: 0.7 }}>
                        (not yet available)
                      </span>
                    )}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginTop: '0.15rem' }}>
                    {m.blurb}
                  </span>
                </span>
              </label>
            );
          })}
          {readOnly && (
            <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
              Sign in as the instance owner to change this setting.
            </div>
          )}
          {saveError && (
            <div style={{ fontSize: '0.8rem', color: '#f85149' }}>{saveError}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TrustDetermination() {
  const {
    povPubkey,
    scoringMethod,
    trustedListId,
    setScoringMethod,
    setTrustedListId,
    resetToOwner,
    isOwnerPov,
  } = useTrust();

  const profiles = useProfiles([povPubkey]);
  const povProfile = profiles[povPubkey];

  // Fetch all kind 30392 Trusted Lists from local strfry
  const [trustedLists, setTrustedLists] = useState([]);
  const [tlLoading, setTlLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchTLs() {
      try {
        const events = await queryRelay({ kinds: [30392], limit: 100 });
        if (cancelled) return;
        // Dedupe by d-tag (keep most recent)
        const byDTag = {};
        for (const ev of events) {
          const dTag = ev.tags?.find(t => t[0] === 'd')?.[1];
          if (!dTag) continue;
          if (!byDTag[dTag] || ev.created_at > byDTag[dTag].created_at) {
            const titleTag = ev.tags?.find(t => t[0] === 'title')?.[1];
            const pCount = ev.tags?.filter(t => t[0] === 'p').length || 0;
            byDTag[dTag] = { dTag, title: titleTag || dTag, pubkey: ev.pubkey, created_at: ev.created_at, pCount };
          }
        }
        setTrustedLists(Object.values(byDTag).sort((a, b) => b.created_at - a.created_at));
      } catch (err) {
        console.warn('Failed to fetch trusted lists:', err);
      } finally {
        if (!cancelled) setTlLoading(false);
      }
    }
    fetchTLs();
    return () => { cancelled = true; };
  }, []);

  const methodLabel = useMemo(() => {
    return SCORING_METHODS.find(m => m.id === scoringMethod)?.label || scoringMethod;
  }, [scoringMethod]);

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🎯 Trust Determination Methods</h1>
      <p className="subtitle">
        Configure whose perspective and which scoring algorithm to use when calculating trusted ratings.
      </p>

      {/* Current method summary */}
      <div style={{
        padding: '1.25rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Current Method</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
        }}>
          {/* PoV Card */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            border: '1px solid var(--border, #444)',
            borderRadius: '6px',
          }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Point of View
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {povProfile?.picture && (
                <img
                  src={povProfile.picture}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: '1rem' }}>
                  {povProfile?.name || povProfile?.display_name || shortPubkey(povPubkey)}
                  {isOwnerPov && (
                    <span style={{
                      fontSize: '0.7rem',
                      marginLeft: '0.5rem',
                      padding: '0.1rem 0.4rem',
                      backgroundColor: 'rgba(88, 166, 255, 0.15)',
                      border: '1px solid #58a6ff',
                      borderRadius: '3px',
                      color: '#58a6ff',
                    }}>
                      OWNER
                    </span>
                  )}
                </div>
                <code style={{ fontSize: '0.7rem', opacity: 0.4 }}>{shortPubkey(povPubkey)}</code>
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <Link
                to={`/tapestry/users/${povPubkey}`}
                className="btn btn-sm"
                style={{ fontSize: '0.75rem' }}
              >
                View Profile →
              </Link>
              {!isOwnerPov && (
                <button
                  className="btn btn-sm"
                  onClick={resetToOwner}
                  style={{ fontSize: '0.75rem' }}
                >
                  ↩ Reset to Owner
                </button>
              )}
            </div>
          </div>

          {/* Scoring Method Card */}
          <div style={{
            padding: '1rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            border: '1px solid var(--border, #444)',
            borderRadius: '6px',
          }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
              Scoring Method
            </div>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.75rem' }}>
              {methodLabel}
            </div>
            <select
              value={scoringMethod}
              onChange={e => setScoringMethod(e.target.value)}
              style={{
                width: '100%',
                padding: '0.4rem 0.6rem',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                color: 'var(--text-primary, #e0e0e0)',
                border: '1px solid var(--border, #444)',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {SCORING_METHODS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Trusted List Selector — only shown when method is trusted-list */}
          {scoringMethod === 'trusted-list' && (
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--bg-primary, #0f0f23)',
              border: '1px solid var(--border, #444)',
              borderRadius: '6px',
            }}>
              <div style={{ fontSize: '0.7rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Trusted List (kind 30392)
              </div>
              {tlLoading ? (
                <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>Loading…</div>
              ) : trustedLists.length === 0 ? (
                <div style={{ opacity: 0.5, fontSize: '0.85rem' }}>No Trusted Lists found in local strfry.</div>
              ) : (
                <>
                  <select
                    value={trustedListId}
                    onChange={e => setTrustedListId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      fontSize: '0.85rem',
                      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
                      color: 'var(--text-primary, #e0e0e0)',
                      border: '1px solid var(--border, #444)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">— Select a Trusted List —</option>
                    {trustedLists.map(tl => (
                      <option key={tl.dTag} value={tl.dTag}>
                        {tl.title} ({tl.pCount} pubkeys)
                      </option>
                    ))}
                  </select>
                  {trustedListId && (() => {
                    const selected = trustedLists.find(tl => tl.dTag === trustedListId);
                    return selected ? (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', opacity: 0.6 }}>
                        d-tag: <code>{selected.dTag}</code> · {selected.pCount} pubkeys · by {selected.pubkey.slice(0, 12)}…
                      </div>
                    ) : null;
                  })()}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Readiness Check */}
      <PovReadinessCheck povPubkey={povPubkey} />

      <TLMembershipMethodCard />

      {/* Explanation */}
      <div style={{
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
        marginBottom: '1.5rem',
      }}>
        <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>How It Works</h3>

        <div style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            <strong>Trust Determination</strong> decides which nostr users are "trusted" from a given
            point of view. When viewing ratings on list items, only reactions from trusted users count
            toward the <em>trusted</em> upvote/downvote columns.
          </p>

          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            borderRadius: '6px',
            marginBottom: '0.75rem',
          }}>
            <strong>Trusted Assertions (rank)</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Uses the kind 30382:rank Trusted Assertions from the PoV user's Treasure Map.
              Each assertion assigns a score to a pubkey. Users with a score above a threshold
              are considered trusted.
            </p>
          </div>

          <div style={{
            padding: '0.75rem',
            backgroundColor: 'var(--bg-primary, #0f0f23)',
            borderRadius: '6px',
          }}>
            <strong>Follow List</strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', opacity: 0.7 }}>
              Uses the PoV user's kind 3 follow list (contact list). Any pubkey on the follow list
              is considered trusted.
            </p>
          </div>
        </div>
      </div>

      {/* How to change PoV */}
      <div style={{
        padding: '1rem',
        border: '1px solid var(--border, #444)',
        borderRadius: '8px',
        backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Changing Point of View</h3>
        <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: 0 }}>
          To view trust from a different user's perspective, navigate to their
          {' '}<Link to="/tapestry/users/search" style={{ color: '#58a6ff' }}>profile page</Link>{' '}
          and click the <strong>"Use as Trust PoV"</strong> button. You can always reset to
          the owner's point of view using the button above.
        </p>
      </div>
    </div>
  );
}

/* ─── PoV Readiness Check ─────────────────────────────────── */

const TA_CHECK_THRESHOLD = 25;

function PovReadinessCheck({ povPubkey }) {
  const [followList, setFollowList] = useState(null);       // null=loading, false=absent, event=present
  const [treasureMap, setTreasureMap] = useState(null);
  const [assertionCount, setAssertionCount] = useState(null); // null=not checked, number=count
  const [assertionLoading, setAssertionLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  // Check local strfry for follow list and treasure map
  useEffect(() => {
    let cancelled = false;
    setFollowList(null);
    setTreasureMap(null);
    setAssertionCount(null);
    setChecked(false);

    async function check() {
      try {
        const [fl, tm] = await Promise.all([
          queryRelay({ kinds: [3], authors: [povPubkey], limit: 1 }),
          queryRelay({ kinds: [10040], authors: [povPubkey], limit: 1 }),
        ]);
        if (!cancelled) {
          setFollowList(fl.length > 0 ? fl[0] : false);
          setTreasureMap(tm.length > 0 ? tm[0] : false);
          setChecked(true);
        }
      } catch {
        if (!cancelled) {
          setFollowList(false);
          setTreasureMap(false);
          setChecked(true);
        }
      }
    }

    check();
    return () => { cancelled = true; };
  }, [povPubkey]);

  // When treasure map is found, check for 30382:rank assertions
  const rankTag = useMemo(() => {
    if (!treasureMap || treasureMap === false) return null;
    return treasureMap.tags?.find(t => t[0] === '30382:rank') || null;
  }, [treasureMap]);

  const checkAssertions = useCallback(async () => {
    if (!rankTag) return;
    const author = rankTag[1];
    const relay = rankTag[2];
    if (!author || !relay) return;

    setAssertionLoading(true);
    try {
      const filter = JSON.stringify({
        kinds: [30382],
        authors: [author],
        limit: TA_CHECK_THRESHOLD,
      });
      const res = await fetch(
        `/api/relay/external?filter=${encodeURIComponent(filter)}&relays=${encodeURIComponent(relay)}`
      );
      const data = await res.json();
      if (data.success) {
        setAssertionCount(data.events?.length || 0);
      } else {
        setAssertionCount(0);
      }
    } catch {
      setAssertionCount(0);
    } finally {
      setAssertionLoading(false);
    }
  }, [rankTag]);

  useEffect(() => {
    if (rankTag && assertionCount === null && !assertionLoading) {
      checkAssertions();
    }
  }, [rankTag]);

  const followCount = followList ? (followList.tags?.filter(t => t[0] === 'p').length || 0) : 0;

  const statusRowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.6rem 0.75rem',
    backgroundColor: 'var(--bg-primary, #0f0f23)',
    border: '1px solid var(--border, #444)',
    borderRadius: '6px',
    marginBottom: '0.5rem',
  };

  return (
    <div style={{
      padding: '1.25rem',
      border: '1px solid var(--border, #444)',
      borderRadius: '8px',
      backgroundColor: 'var(--bg-secondary, #1a1a2e)',
      marginBottom: '1.5rem',
    }}>
      <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>PoV Readiness</h3>
      <p style={{ fontSize: '0.8rem', opacity: 0.6, margin: '0 0 0.75rem' }}>
        Data availability for the current Point of View.
        {' '}<Link to={`/tapestry/users/${povPubkey}`} style={{ color: '#58a6ff' }}>
          Manage on profile page →
        </Link>
      </p>

      {/* Follow List */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>📋</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            Follow List <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 3)</span>
          </div>
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
          {checked && followList === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
              ⚠️ Not found in local strfry
            </div>
          )}
          {checked && followList && (
            <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
              ● Present — {followCount} follows
              {followList.created_at && (
                <span style={{ opacity: 0.5 }}> · {new Date(followList.created_at * 1000).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
        <StatusIcon checked={checked} present={!!followList} />
      </div>

      {/* Treasure Map */}
      <div style={statusRowStyle}>
        <span style={{ fontSize: '1rem' }}>🗺️</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            TA Treasure Map <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 10040)</span>
          </div>
          {!checked && <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>Checking…</div>}
          {checked && treasureMap === false && (
            <div style={{ fontSize: '0.75rem', color: '#f59e0b' }}>
              ⚠️ Not found in local strfry
            </div>
          )}
          {checked && treasureMap && (
            <div style={{ fontSize: '0.75rem', color: '#3fb950' }}>
              ● Present — {treasureMap.tags?.length || 0} tags
              {treasureMap.created_at && (
                <span style={{ opacity: 0.5 }}> · {new Date(treasureMap.created_at * 1000).toLocaleDateString()}</span>
              )}
            </div>
          )}
        </div>
        <StatusIcon checked={checked} present={!!treasureMap} />
      </div>

      {/* Trusted Assertions availability */}
      {checked && treasureMap && (
        <div style={statusRowStyle}>
          <span style={{ fontSize: '1rem' }}>📜</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Trusted Assertions <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 30382:rank)</span>
            </div>
            {assertionLoading && (
              <div style={{ fontSize: '0.75rem', opacity: 0.4 }}>
                ⏳ Querying {rankTag?.[2]}…
              </div>
            )}
            {!assertionLoading && assertionCount !== null && (
              <div style={{ fontSize: '0.75rem', color: assertionCount >= TA_CHECK_THRESHOLD ? '#3fb950' : '#f59e0b' }}>
                {assertionCount >= TA_CHECK_THRESHOLD
                  ? `● ${assertionCount}+ assertions available`
                  : assertionCount > 0
                    ? `⚠️ Only ${assertionCount} assertion${assertionCount !== 1 ? 's' : ''} found (need ≥${TA_CHECK_THRESHOLD})`
                    : `⚠️ No assertions found`
                }
                {rankTag && (
                  <span style={{ opacity: 0.5 }}> · via {rankTag[2]}</span>
                )}
              </div>
            )}
          </div>
          <StatusIcon
            checked={!assertionLoading && assertionCount !== null}
            present={assertionCount >= TA_CHECK_THRESHOLD}
          />
        </div>
      )}

      {checked && treasureMap === false && (
        <div style={{
          ...statusRowStyle,
          opacity: 0.5,
        }}>
          <span style={{ fontSize: '1rem' }}>📜</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Trusted Assertions <span style={{ opacity: 0.5, fontWeight: 400 }}>(kind 30382:rank)</span>
            </div>
            <div style={{ fontSize: '0.75rem' }}>
              Requires TA Treasure Map to be present locally
            </div>
          </div>
          <span style={{ fontSize: '0.9rem', opacity: 0.3 }}>○</span>
        </div>
      )}
    </div>
  );
}

function StatusIcon({ checked, present }) {
  if (!checked) return <span style={{ fontSize: '0.9rem', opacity: 0.3 }}>⏳</span>;
  if (present) return <span style={{ fontSize: '0.9rem', color: '#3fb950' }}>✅</span>;
  return <span style={{ fontSize: '0.9rem', color: '#f59e0b' }}>⚠️</span>;
}
