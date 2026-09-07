import { useState, useEffect, useMemo, useCallback } from 'react';
import { useConfig } from '../../context/ConfigContext';
import { buildPresenceTargets, compareMapVersions, planRelaySync } from '../../utils/treasureMap';
import { publishToRelays, publishToLocalStrfry, isExternalPublishAllowed } from '../../utils/nostrPublish';

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

export default function TreasureMapRelayPresence({ event, inLocal, onImportLocal, importing, onMapReplaced }) {
  const { aRelays } = useConfig();
  const [rows, setRows] = useState({});
  const [syncing, setSyncing] = useState({});
  const [canPublishOut, setCanPublishOut] = useState(true); // fail-open, matching the helper

  // ConfigContext starts aRelays at null and fills it from /api/relays. Until it lands we know
  // nothing about the relay set — which is NOT the same as knowing it is empty, and saying
  // "none configured" in that window would be a false statement about the operator's config.
  const configLoaded = !!aRelays;

  const targets = useMemo(
    () => buildPresenceTargets(aRelays, PRESENCE_GROUP_KEYS),
    [aRelays]
  );
  const targetsKey = targets.map(t => t.url).join(',');

  // One per-relay probe path, shared by the opening fan-out and by the re-check after a sync.
  // `full` opts into the whole signed event (needed to import a relay's newer copy); the default
  // stays the narrow projection.
  const probeOne = useCallback(async (url, { full = false } = {}) => {
    try {
      const res = await fetch(
        `/api/relay/presence?relay=${encodeURIComponent(url)}`
        + `&pubkey=${encodeURIComponent(event.pubkey)}&kind=${encodeURIComponent(event.kind)}`
        + (full ? '&full=1' : '')
      );
      const data = await res.json();
      return data?.success
        ? { status: data.status, event: data.event, error: data.error }
        : { status: 'unreachable', event: null, error: data?.error || 'request failed' };
    } catch (err) {
      return { status: 'unreachable', event: null, error: err?.message || 'request failed' };
    }
  }, [event?.pubkey, event?.kind]);

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
        const outcome = await probeOne(url);
        if (!cancelled) setRows(prev => ({ ...prev, [url]: outcome }));
      }
    }
    for (let w = 0; w < CONCURRENCY; w++) worker();

    return () => { cancelled = true; };
  }, [event?.id, event?.pubkey, event?.kind, targetsKey, probeOne]);

  // Whether this deployment permits publishing outward at all. Read once and reflected in the
  // affordance, so a suppressed action is visible BEFORE it is pressed rather than after.
  useEffect(() => {
    let cancelled = false;
    isExternalPublishAllowed().then(v => { if (!cancelled) setCanPublishOut(v); });
    return () => { cancelled = true; };
  }, []);

  // What LOCAL holds — not what the page is displaying. When the Map was found on an external
  // relay, local holds nothing, and every row's direction must be judged against that.
  const localEvent = inLocal ? event : null;

  // A relay acknowledges a publish before the event is necessarily queryable, so an immediate
  // re-check can still read the pre-publish state and report a sync that worked as a failure.
  // Measured against tags.brainstorm.world 2026-09-07: the publish landed, the instant re-probe
  // said "Not here", a fresh load said "Has this version". One bounded second look.
  const confirmSync = useCallback(async (url) => {
    const first = await probeOne(url);
    if (first.status === 'present') return first;
    await new Promise(r => setTimeout(r, 1500));
    return probeOne(url);
  }, [probeOne]);

  const runSync = useCallback(async (url, direction) => {
    setSyncing(prev => ({ ...prev, [url]: { busy: true, error: null, note: null } }));
    try {
      if (direction === 'push') {
        const result = await publishToRelays(event, [url]);
        if (result?.skippedByGate) {
          setSyncing(prev => ({ ...prev, [url]: { busy: false, error: null, note: 'kept local — external publishing is off for this instance' } }));
          return;
        }
        // Deliberately NOT trusting result.successes. SimplePool.publish() returns an ARRAY of
        // promises, and publishToRelays races that non-thenable array against its timeout — so
        // the race resolves instantly and every publish is reported as a success, whatever the
        // relay did (OPEN.md row 194). Asking the relay what it now holds is the only honest
        // signal, and the confirmation below is therefore the real check, not a formality.
      } else {
        // Pull: take the event the probe already verified, then import it locally.
        const fresh = await probeOne(url, { full: true });
        if (fresh.status !== 'present' || !fresh.event) {
          throw new Error(fresh.error || 'the relay no longer has a copy to fetch');
        }
        const local = await publishToLocalStrfry(fresh.event);
        if (!local?.success) throw new Error(local?.error || 'local import failed');
        if (onMapReplaced) onMapReplaced();
      }

      const after = await confirmSync(url);
      setRows(prev => ({ ...prev, [url]: after }));
      if (direction === 'push' && after.status !== 'present') {
        // The relay never took it. Reported from what the relay serves, not from the publish
        // call's own (unreliable) verdict.
        throw new Error('the relay did not take it — your browser may not be able to reach it, or it declined the event');
      }
      setSyncing(prev => ({ ...prev, [url]: { busy: false, error: null, note: null } }));
    } catch (err) {
      // Scoped to this row on purpose: one relay's failure must not disturb any other row.
      setSyncing(prev => ({ ...prev, [url]: { busy: false, error: err?.message || 'sync failed', note: null } }));
    }
  }, [event, probeOne, confirmSync, onMapReplaced]);

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
        const busy = syncing[t.url] || {};
        // Only a settled, reachable row can be synced; a pending or unreachable relay has
        // nothing to converge with.
        const settledRow = row && row.status !== 'pending' && row.status !== 'unreachable';
        const plan = settledRow ? planRelaySync(localEvent, row.event) : { direction: null, reason: null };
        const blockedByPolicy = plan.direction === 'push' && !canPublishOut;

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

            {plan.reason === 'divergent' && (
              <span style={{ fontSize: '0.68rem', color: '#f59e0b' }} title="Same timestamp, different event — neither is newer">
                can't be ordered
              </span>
            )}
            {busy.note && (
              <span style={{ fontSize: '0.68rem', opacity: 0.6 }}>{busy.note}</span>
            )}
            {busy.error && (
              <span style={{ fontSize: '0.68rem', color: '#f85149' }} title={busy.error}>sync failed</span>
            )}
            {blockedByPolicy && (
              <span style={{ fontSize: '0.68rem', opacity: 0.5 }} title="This instance is configured to keep publishing local-only">
                external publishing off
              </span>
            )}
            {plan.direction && !blockedByPolicy && (
              <button
                className="btn btn-sm"
                onClick={() => runSync(t.url, plan.direction)}
                disabled={busy.busy}
                style={{ fontSize: '0.68rem' }}
              >
                {busy.busy
                  ? '⏳ Syncing…'
                  : plan.direction === 'push' ? '📤 Send my version' : '📥 Get the newer version'}
              </button>
            )}

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
