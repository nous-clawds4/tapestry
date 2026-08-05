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
 */
export default function ActiveZTags() {
  const { taPubkey } = useConfig();

  const [rows, setRows] = useState(null); // null = loading
  const [error, setError] = useState(null);

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
        if (targets.size === 0) { setRows([]); return; }

        // 2. Chunked scans: every local event z-pointing at any of them.
        const scan = await chunkedZScan([...targets.keys()]);
        if (cancelled) return;
        const carriers = scan.events;
        if (scan.failedChunks > 0 && scan.failedChunks === scan.totalChunks) {
          throw new Error('the local z-tag scan failed');
        }
        const usage = new Map(); // coord → { events: Set, authors: Set }
        for (const ev of carriers || []) {
          for (const t of ev.tags || []) {
            if (t[0] !== 'z' || !targets.has(t[1])) continue;
            let u = usage.get(t[1]);
            if (!u) { u = { events: new Set(), authors: new Set() }; usage.set(t[1], u); }
            u.events.add(ev.id);
            u.authors.add(ev.pubkey);
          }
        }

        const out = [];
        for (const [coord, u] of usage) {
          const target = targets.get(coord);
          out.push({
            uuid: coord,
            name: target.name,
            author: target.author,
            eventCount: u.events.size,
            authorCount: u.authors.size,
          });
        }
        out.sort((a, b) => b.eventCount - a.eventCount);
        setRows(out);
        setError(null);
      } catch (err) {
        if (!cancelled) { setError(err.message); setRows([]); }
      }
    })();

    return () => { cancelled = true; };
  }, [taPubkey]);

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
      </p>

      {error && <p className="error">Error: {error}</p>}
      {rows === null ? (
        <p>Scanning local z-tag usage…</p>
      ) : (
        <>
          <p className="subtitle">{rows.length} shared concepts in local z-tag use</p>
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
