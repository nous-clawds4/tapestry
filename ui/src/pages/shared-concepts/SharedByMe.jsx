import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import DataTable from '../../components/DataTable';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useCypher } from '../../hooks/useCypher';
import { useConfig } from '../../context/ConfigContext';
import { dispositionOf } from '../../utils/bDisposition';
import { summarizeNotYetShared } from '../../utils/conceptStateFilter';

/**
 * Shared by me — every concept this instance has shared with the community
 * (story shared-concepts-legibility #2, ADR 0002; renamed by seeding #2).
 *
 * The narrower of the pair: Shared with the community shows every instance's
 * shares (this one included), read from the relay. This one is only yours, read
 * from two stores — so it can surface something the relay-only view cannot, a
 * share that never left this machine.
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

// The concept population, for the waiting-count only. Deliberately minimal —
// this page needs no element counts, no schema joins, none of the Concepts
// list's aggregation; just enough to ask the shipped predicate whether each
// header is still waiting (ADR shared-concepts-seeding/0002).
const POPULATION_QUERY = `
  MATCH (h:NostrEvent)
  WHERE (h:ListHeader OR h:ConceptHeader) AND h.kind IN [9998, 39998]
  OPTIONAL MATCH (h)-[:HAS_TAG]->(bt:NostrEventTag {type: 'b'})
  RETURN h.uuid AS uuid, h.pubkey AS author, collect(DISTINCT bt.value) AS bValues
`;

const NOT_YET_SHARED_HREF = '/tapestry/concepts?state=not-yet-shared';

export default function SharedByMe() {
  const navigate = useNavigate();
  const { taPubkey } = useConfig();
  const [data, setData] = useState(null); // null = loading
  const [error, setError] = useState(null);
  const { data: population, error: populationError } = useCypher(POPULATION_QUERY);

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

  // How the route should present itself. The population and the publication map
  // are two separate reads, and either can fail — summarizeNotYetShared owns the
  // rule that a number may only be shown when both are sound, because "0" would
  // tell the owner she has shared everything.
  const waiting = useMemo(() => {
    const rowsKnown = !populationError && Array.isArray(population) && population.length > 0;
    const rows = rowsKnown
      ? population.map((r) => ({ ...r, _disp: dispositionOf(r.bValues, r.uuid) }))
      : null;
    const publishedByCoord = new Map((data?.concepts || []).map((c) => [c.coord, c.published]));
    return summarizeNotYetShared(rows, {
      taPubkey,
      publishedByCoord,
      relayOk: data ? data.relayOk !== false : false,
    });
  }, [population, populationError, data, taPubkey]);

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
          {/* Count what is true: "N shared" over a list that includes a row which
              did NOT reach the community is the same conflation this page exists
              to remove (review, 2026-08-10). */}
          <p className="subtitle">
            {(() => {
              const total = data.concepts.length;
              const landed = data.concepts.filter((c) => c.published === true).length;
              const unknown = data.concepts.filter((c) => c.published === null).length;
              if (total === 0) return '0 shared';
              if (unknown === total) return `${total} to confirm`;
              return landed === total ? `${total} shared` : `${landed} of ${total} shared`;
            })()}
          </p>

          {/* The way out of this page. `clear` is the state the owner is working
              toward, so it reads as done rather than as an errand with nothing
              in it; `unknown` still shows the route but makes no claim about
              how much is left. */}
          <p className="subtitle" style={{ maxWidth: '52rem' }}>
            {waiting.kind === 'clear' ? (
              <>✅ Nothing left to share — every concept here is either out with the community or
              deliberately kept back.</>
            ) : (
              <Link to={NOT_YET_SHARED_HREF}>
                {waiting.kind === 'waiting'
                  ? `Haven't shared these yet — ${waiting.count} waiting →`
                  : "Haven't shared these yet →"}
              </Link>
            )}
          </p>

          <DataTable
            columns={columns}
            data={data.concepts}
            onRowClick={(row) => navigate(`/tapestry/concepts/${encodeURIComponent(row.coord)}`)}
            emptyMessage="You haven't shared anything with the community yet. The link above lists the concepts waiting to go out."
          />
        </>
      )}
    </div>
  );
}
