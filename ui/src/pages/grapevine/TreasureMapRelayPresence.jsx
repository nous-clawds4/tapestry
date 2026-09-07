import { useState, useEffect, useMemo } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { buildPresenceTargets, compareMapVersions } from '../../utils/treasureMap';

/**
 * Where does this Treasure Map actually live? — ADR treasure-map-relay-presence/0001.
 *
 * The Map exists to be found by OTHER people's clients, which never read this instance's local
 * relay. So the useful answer is per-relay, and — because kind 10040 is replaceable — it is not
 * a boolean: a relay may hold a different version, and a stale copy silently advertises a
 * delegation the user has already changed.
 *
 * Every row owns its own state and its own request, so a dead relay stalls its own row rather
 * than the panel, and a total failure of the check cannot affect the rest of the page.
 */

// Which GROUPS are worth checking for a Map. Policy lives here; the URLs inside each group are
// configuration the operator edits at Home > Settings > Relays.
const PRESENCE_GROUP_KEYS = [
  'aTapestryInstanceRelays',
  'aTrustedAssertionRelays',
  'aTrustedListRelays',
  'aPopularGeneralPurposeRelays',
];

const GROUP_LABELS = {
  aTapestryInstanceRelays: 'Tapestry',
  aTrustedAssertionRelays: 'Trusted Assertion',
  aTrustedListRelays: 'Trusted List',
  aPopularGeneralPurposeRelays: 'General',
};

// Enough parallelism to fill the panel promptly without starving the page's other requests.
const CONCURRENCY = 4;

function relayLabel(url) {
  return url.replace(/^wss?:\/\//i, '');
}

function whenText(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString();
}

/** How one row reads: [symbol, color, text, detail]. */
function describe(row, displayed) {
  if (!row || row.status === 'pending') return ['⏳', 'inherit', 'Checking…', ''];
  if (row.status === 'unreachable') {
    // Connect failure is flaky in the wild, so this says what WE could not do, not that the
    // relay is down.
    return ['⛔', '#f85149', "Couldn't reach", row.error || ''];
  }
  if (row.status !== 'present') return ['○', 'inherit', 'Not here', ''];

  switch (compareMapVersions(displayed, row.event)) {
    case 'same':
      return ['●', '#3fb950', 'Has this version', ''];
    case 'older':
      return ['⚠️', '#f59e0b', 'Older version', whenText(row.event?.created_at)];
    case 'newer':
      return ['⚠️', '#f59e0b', 'Newer version', whenText(row.event?.created_at)];
    case 'divergent':
      return ['⚠️', '#f59e0b', 'Different version', 'same timestamp'];
    default:
      return ['●', '#3fb950', 'Has a Map', ''];
  }
}

export default function TreasureMapRelayPresence({ event, inLocal, onImportLocal, importing }) {
  const { aRelays } = useConfig();
  const [rows, setRows] = useState({});

  // ConfigContext starts aRelays at null and fills it from /api/relays. Until it lands we know
  // nothing about the relay set — which is NOT the same as knowing it is empty, and saying
  // "none configured" in that window would be a false statement about the operator's config.
  const configLoaded = !!aRelays;

  const targets = useMemo(
    () => buildPresenceTargets(aRelays, PRESENCE_GROUP_KEYS),
    [aRelays]
  );
  const targetsKey = targets.map(t => t.url).join(',');

  useEffect(() => {
    if (!event?.pubkey || targets.length === 0) return;
    let cancelled = false;

    setRows(Object.fromEntries(targets.map(t => [t.url, { status: 'pending' }])));

    // Bounded fan-out: workers pull from a shared cursor and commit each result on its own, so
    // rows land as they resolve. Deliberately NOT a settled batch — that is precisely "the whole
    // panel waiting on the slowest relay".
    let cursor = 0;
    async function worker() {
      while (!cancelled) {
        const i = cursor++;
        if (i >= targets.length) return;
        const { url } = targets[i];
        let outcome;
        try {
          const res = await fetch(
            `/api/relay/presence?relay=${encodeURIComponent(url)}`
            + `&pubkey=${encodeURIComponent(event.pubkey)}&kind=${encodeURIComponent(event.kind)}`
          );
          const data = await res.json();
          outcome = data?.success
            ? { status: data.status, event: data.event, error: data.error }
            : { status: 'unreachable', event: null, error: data?.error || 'request failed' };
        } catch (err) {
          outcome = { status: 'unreachable', event: null, error: err?.message || 'request failed' };
        }
        if (!cancelled) setRows(prev => ({ ...prev, [url]: outcome }));
      }
    }
    for (let w = 0; w < CONCURRENCY; w++) worker();

    return () => { cancelled = true; };
  }, [event?.id, event?.pubkey, event?.kind, targetsKey]);

  const settled = targets.filter(t => rows[t.url] && rows[t.url].status !== 'pending');
  const holding = settled.filter(t => rows[t.url].status === 'present').length;
  const done = settled.length === targets.length && targets.length > 0;

  return (
    <div style={{
      padding: '0.75rem 1rem',
      backgroundColor: 'var(--bg-primary, #0f0f23)',
      border: '1px solid var(--border, #444)',
      borderRadius: '6px',
      marginBottom: '1rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Where this Map lives</h4>
        {targets.length > 0 && (
          <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>
            {done
              ? `${holding + (inLocal ? 1 : 0)} of ${targets.length + 1} hold a copy`
              : `checking ${targets.length} relays…`}
          </span>
        )}
      </div>

      {/* Local strfry — known already from the page's own lookup, so it needs no request. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.6rem',
        padding: '0.35rem 0', fontSize: '0.8rem',
        borderBottom: '1px solid var(--border, #333)',
      }}>
        <span style={{ width: '1.2rem', textAlign: 'center', color: inLocal ? '#3fb950' : 'inherit' }}>
          {inLocal ? '●' : '○'}
        </span>
        <span style={{ flex: 1, fontWeight: 600 }}>Local Strfry</span>
        {inLocal ? (
          <span style={{ color: '#3fb950', fontSize: '0.78rem' }}>Has this version</span>
        ) : (
          <>
            <span style={{ opacity: 0.6, fontSize: '0.78rem' }}>Not here</span>
            <button
              className="btn btn-sm btn-primary"
              onClick={onImportLocal}
              disabled={importing}
              style={{ fontSize: '0.72rem', marginLeft: '0.4rem' }}
            >
              {importing ? '⏳ Importing…' : '📥 Import to local strfry'}
            </button>
          </>
        )}
      </div>

      {targets.length === 0 && (
        <div style={{ fontSize: '0.78rem', opacity: 0.6, padding: '0.5rem 0' }}>
          {configLoaded
            ? <>No relays configured to check. Add them at Home &gt; Settings &gt; Relays.</>
            : <>⏳ Loading the relay list…</>}
        </div>
      )}

      {targets.map((t, idx) => {
        const row = rows[t.url];
        const [symbol, color, text, detail] = describe(row, event);
        return (
          <div
            key={t.url}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.6rem',
              padding: '0.35rem 0', fontSize: '0.8rem',
              borderBottom: idx < targets.length - 1 ? '1px solid var(--border, #333)' : 'none',
            }}
          >
            <span style={{ width: '1.2rem', textAlign: 'center', color }}>{symbol}</span>
            <code style={{ flex: 1, fontSize: '0.75rem' }}>{relayLabel(t.url)}</code>
            <span style={{ fontSize: '0.68rem', opacity: 0.4 }}>
              {t.groups.map(g => GROUP_LABELS[g] || g).join(' · ')}
            </span>
            <span style={{ color, fontSize: '0.78rem', minWidth: '9rem', textAlign: 'right' }} title={detail}>
              {text}
            </span>
          </div>
        );
      })}

      {done && holding === 0 && !inLocal && (
        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.5rem' }}>
          No relay checked is serving this Map — other people's clients will not find it.
        </div>
      )}
    </div>
  );
}
