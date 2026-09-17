import { useState, useEffect, useMemo } from 'react';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import AuthorCell from '../../components/AuthorCell';
import useProfiles from '../../hooks/useProfiles';
import { useConfig } from '../../context/ConfigContext';
import { queryRelay } from '../../api/relay';

/**
 * Scan for z-carriers in bounded chunks: the filter rides the scan API's GET
 * query string, and ~100 coordinates in one filter blows past nginx's URI
 * limit on deployed instances (HTML 414 instead of JSON). Per-chunk failures
 * degrade to partial results rather than killing the page.
 */
async function chunkedZScan(coords, chunkSize = 20) {
  const out = [];
  let failures = 0;
  for (let i = 0; i < coords.length; i += chunkSize) {
    const chunk = coords.slice(i, i + chunkSize);
    try {
      const events = await queryRelay({ '#z': chunk });
      out.push(...(events || []));
    } catch {
      failures += 1;
    }
  }
  return { events: out, failedChunks: failures, totalChunks: Math.ceil(coords.length / chunkSize) };
}

/** The singular name: `names` tag = ["names", singular, plural, …]; falls
 * back to a `name` tag (elements). */
function bestName(ev) {
  const names = ev?.tags?.find((x) => x[0] === 'names');
  if (names && typeof names[1] === 'string' && names[1].trim() !== '') return names[1];
  const name = ev?.tags?.find((x) => x[0] === 'name');
  return name && typeof name[1] === 'string' && name[1].trim() !== '' ? name[1] : null;
}

/**
 * Active z-tags — shared concepts ranked by actual local z-tag usage: the
 * purest form of "using a shared concept" (events in the local strfry filed
 * UNDER it). One row per foreign-authored concept header (pubkey ≠ the
 * local TA) that at least one local event z-points at, with usage counts.
 * z-tags to the instance's OWN concepts are ordinary internal filing and are
 * deliberately out of scope — this page is about shared usage.
 *
 * Self-filed z-tags — carrier authored by the SAME pubkey as the concept
 * header — are likewise internal filing, not shared usage (Alice filing her
 * own items under her own concept), so they are disregarded by default; a
 * toggle includes them. Both tallies are computed in one pass, so the toggle
 * never refetches.
 */
export default function ActiveZTags() {
  const { taPubkey } = useConfig();

  const [data, setData] = useState(null); // per-target rows with both tallies; null = loading
  const [error, setError] = useState(null);
  const [showSelfFiled, setShowSelfFiled] = useState(false);

  useEffect(() => {
    if (!taPubkey) return undefined;
    let cancelled = false;

    (async () => {
      try {
        // 1. Every foreign-authored concept header held locally = the
        //    candidate z-targets (nostr filters cannot express "has a z tag
        //    to a foreign coordinate", so enumerate targets first).
        const headers = await queryRelay({ kinds: [39998] });
        if (cancelled) return;
        const targets = new Map(); // coord → { name, author }
        for (const ev of headers || []) {
          if (ev.pubkey === taPubkey) continue;
          const d = ev.tags?.find((t) => t[0] === 'd')?.[1];
          if (d == null) continue;
          const coord = `${ev.kind}:${ev.pubkey}:${d}`;
          const prev = targets.get(coord);
          if (!prev || ev.created_at > prev.created_at) {
            targets.set(coord, { name: bestName(ev), author: ev.pubkey, created_at: ev.created_at });
          }
        }
        if (targets.size === 0) { setData([]); return; }

        // 2. Chunked scans: every local event z-pointing at any of them.
        const scan = await chunkedZScan([...targets.keys()]);
        if (cancelled) return;
        const carriers = scan.events;
        if (scan.failedChunks > 0 && scan.failedChunks === scan.totalChunks) {
          throw new Error('the local z-tag scan failed');
        }
        // Two tallies per target: everything, and shared-only (carrier
        // author ≠ the concept header's author).
        const usage = new Map(); // coord → { all: {e,a}, shared: {e,a} }
        for (const ev of carriers || []) {
          for (const t of ev.tags || []) {
            if (t[0] !== 'z' || !targets.has(t[1])) continue;
            let u = usage.get(t[1]);
            if (!u) {
              u = {
                allEvents: new Set(), allAuthors: new Set(),
                sharedEvents: new Set(), sharedAuthors: new Set(),
              };
              usage.set(t[1], u);
            }
            u.allEvents.add(ev.id);
            u.allAuthors.add(ev.pubkey);
            if (ev.pubkey !== targets.get(t[1]).author) {
              u.sharedEvents.add(ev.id);
              u.sharedAuthors.add(ev.pubkey);
            }
          }
        }

        const out = [];
        for (const [coord, u] of usage) {
          const target = targets.get(coord);
          out.push({
            uuid: coord,
            name: target.name,
            author: target.author,
            allEvents: u.allEvents.size,
            allAuthors: u.allAuthors.size,
            sharedEvents: u.sharedEvents.size,
            sharedAuthors: u.sharedAuthors.size,
          });
        }
        setData(out);
        setError(null);
      } catch (err) {
        if (!cancelled) { setError(err.message); setData([]); }
      }
    })();

    return () => { cancelled = true; };
  }, [taPubkey]);

  // The toggle re-derives rows from the stored tallies — no refetch.
  const rows = useMemo(() => {
    if (data === null) return null;
    return data
      .map((r) => ({
        ...r,
        eventCount: showSelfFiled ? r.allEvents : r.sharedEvents,
        authorCount: showSelfFiled ? r.allAuthors : r.sharedAuthors,
      }))
      .filter((r) => r.eventCount > 0)
      .sort((a, b) => b.eventCount - a.eventCount);
  }, [data, showSelfFiled]);

  const authors = useMemo(() => (rows || []).map((r) => r.author), [rows]);
  const profiles = useProfiles(authors);

  const columns = [
    {
      key: 'name',
      label: 'name (shared)',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'uuid',
      label: 'z-tag',
      render: (val) => <code style={{ overflowWrap: 'anywhere' }}>{val}</code>,
    },
    {
      key: 'author',
      label: 'author (shared)',
      render: (val) => <AuthorCell pubkey={val} profiles={profiles} />,
    },
    { key: 'eventCount', label: 'local events' },
    { key: 'authorCount', label: 'distinct authors' },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Active z-tags</h1>
      <p className="subtitle">
        Shared concepts — concept headers authored by other instances — ranked by actual local
        usage: events in the local strfry that file themselves under the concept via the z-tag.
        Self-filed z-tags — where the event and the concept header share an author — are internal
        filing, not shared usage, and are disregarded by default.
      </p>

      {error && <p className="error">Error: {error}</p>}
      {rows === null ? (
        <p>Scanning local z-tag usage…</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="subtitle" style={{ margin: 0 }}>
              {rows.length} shared concepts in local z-tag use
              {!showSelfFiled && ' (self-filed disregarded)'}
            </p>
            <button className="btn" type="button" onClick={() => setShowSelfFiled((v) => !v)}>
              {showSelfFiled ? 'Hide self-filed z-tags' : 'Show self-filed z-tags'}
            </button>
          </div>
          <DataTable
            columns={columns}
            data={rows}
            emptyMessage="No local events point at a foreign-authored concept via z-tag yet."
          />
        </>
      )}
    </div>
  );
}
