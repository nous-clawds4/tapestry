import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Shared by me — every concept this instance has shared with the community
 * (story shared-concepts-legibility #2, ADR 0002; renamed by seeding #2).
 *
 * Distinct from Shared by others beside it: that page answers "what has the
 * community shared?" from the relay, while this answers "what have I shared?"
 * from two stores — and can therefore surface something the community view
 * cannot, a share that never left this machine.
 *
 * There is no category between shared and not-shared. A concept whose local
 * write succeeded but whose broadcast did not land is a FAILURE to be retried,
 * not a resting state (owner ruling 2026-08-06; seeding #2).
 *
 * `published` is tri-state. `null` means the relay could not be asked and must
 * never render as not-sent.
 */

const STATE = {
  shared: { icon: '🤝', label: 'Shared', title: 'This declaration is live on the community relay.' },
  unsent: { icon: '⚠️', label: "Didn't reach the community — try again", title: 'Saved on this instance, but the community relay does not have it. Open the concept to try again.' },
  unknown: { icon: '⏳', label: 'Unconfirmed', title: 'The community relay could not be reached, so publication could not be confirmed.' },
};

const stateOf = (published) => (published === null ? STATE.unknown : published ? STATE.shared : STATE.unsent);

export default function SharedByMe() {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch('/api/shared-by-me');
        const json = await resp.json().catch(() => null);
        if (cancelled) return;
        // A failed local read is a non-200 by design — surface it as an error,
        // never as an empty list, which would read as "you have shared nothing".
        if (!resp.ok || !json?.success) {
          setError(json?.error || `HTTP ${resp.status}`);
          return;
        }
        setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (val, row) => val || <code style={{ fontSize: '0.8rem' }}>{row.coord.split(':').slice(2).join(':')}</code>,
    },
    {
      key: 'description',
      label: 'Description',
      render: (val) => val || <span className="text-muted">—</span>,
    },
    {
      key: 'published',
      label: 'State',
      render: (val) => {
        const s = stateOf(val);
        return <span title={s.title} style={{ whiteSpace: 'nowrap', cursor: 'help' }}>{s.icon} {s.label}</span>;
      },
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Shared by me</h1>
      <p className="subtitle" style={{ maxWidth: '52rem' }}>
        Every concept this instance has shared with the community — <strong>including any that
        never made it out</strong>. Saving a concept and sending it are two steps, and the second can
        fail, so a share can be recorded here without the community ever seeing it. Open a row to
        try again.
      </p>

      {error && <p className="error">Could not read what you have shared: {error}</p>}
      {!error && data === null && <p>Loading what you have shared…</p>}

      {data && (
        <>
          {/* One page-level statement, not a per-row quirk: when the relay is
              unreachable every row is ⏳ for the same single reason. */}
          {!data.relayOk && (
            <p className="subtitle" style={{ maxWidth: '52rem' }}>
              ⏳ <strong>Publication could not be confirmed.</strong> The community relay
              (<code>{data.relay}</code>) could not be reached{data.relayError ? ` — ${data.relayError}` : ''}, so
              these are your declarations as this instance recorded them. None is known to be unsent.
            </p>
          )}
          <p className="subtitle">{data.concepts.length} shared</p>
          <DataTable
            columns={columns}
            data={data.concepts}
            onRowClick={(row) => navigate(`/tapestry/concepts/${encodeURIComponent(row.coord)}`)}
            emptyMessage="You haven't shared any concepts yet. Submit one from its concept page."
          />
        </>
      )}
    </div>
  );
}
