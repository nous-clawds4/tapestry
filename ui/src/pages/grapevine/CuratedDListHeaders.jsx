import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { describeHeaderLookup } from '../../utils/treasureMap';

/*
 * The two headers on a curated DList's detail page (my-curated-dlists #2, ADR 0002): the header the
 * viewer's assistant authored, and the shared header it points to — each as a raw event with a link
 * to its Simple Lists entry, and an import when a header was found only on a relay. The import is
 * the page's ONLY write and lives here alone (ADR 0002 fact 6): it stores the event exactly as its
 * author signed it, in this instance's strfry, and nothing else.
 */

const short = (pk) => `${pk.slice(0, 8)}…${pk.slice(-4)}`;
/** `<kind>:<pubkey>:<d>` → `<kind>:<pk8>…<pk4>:<d>` for display (the d-tag may contain colons). */
function shortCoord(coord) {
  const i = coord.indexOf(':');
  const j = coord.indexOf(':', i + 1);
  if (j < 0) return coord;
  return `${coord.slice(0, i)}:${short(coord.slice(i + 1, j))}:${coord.slice(j + 1)}`;
}
const nameOf = (event) => event?.tags?.find((t) => t[0] === 'names')?.[1] || null;

const muted = { fontSize: '0.85rem', opacity: 0.65 };
const warn = { fontSize: '0.85rem', color: '#f59e0b' };
const line = { fontSize: '0.85rem', marginTop: '0.35rem' };
const sectionBox = {
  padding: '0.9rem 1rem', marginTop: '1rem', border: '1px solid var(--border, #444)',
  borderRadius: '8px', backgroundColor: 'var(--bg-secondary, #1a1a2e)',
};
const sectionTitle = { margin: '0 0 0.5rem', fontSize: '0.95rem' };

// One sentence per pointer problem (ADR 0002 sub-decision 2) — reported, never fixed from this page.
const PROBLEM_SENTENCES = {
  'no-b': () => '⚠️ It has no b tag, so it points at no shared header.',
  'not-a-coordinate': () => '⚠️ One of its b tags is not a list coordinate.',
  'wrong-type': (info) => `⚠️ Its pointer type is “${info.pointer.type}”, not inherit-items.`,
  'multiple': () => '⚠️ It has more than one pointer — this page follows the first.',
};

/** The complete event as formatted JSON, behind a toggle that is closed on every load (never persisted). */
export function RawEventToggle({ event }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} style={{ fontSize: '0.8rem' }}>
        {open ? '▾ Hide raw event' : '▸ Show raw event'}
      </button>
      {open && (
        <pre style={{
          marginTop: '0.6rem', padding: '1rem', backgroundColor: 'var(--bg-primary, #0f0f23)',
          border: '1px solid var(--border, #444)', borderRadius: '6px', fontSize: '0.75rem',
          overflow: 'auto', maxHeight: '400px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        }}>
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </div>
  );
}

/**
 * Import a header found only on a relay into this instance's strfry — the event exactly as received,
 * with its author's signature (ADR 0002 sub-decision 6). On success the section re-checks
 * (`onImported`); `checking` is that re-check, so a header still missing afterwards is said so.
 */
export function ImportToLocalButton({ event, onImported, checking }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [imported, setImported] = useState(false);
  const [sawRecheck, setSawRecheck] = useState(false);

  useEffect(() => { if (imported && checking) setSawRecheck(true); }, [imported, checking]);

  async function handleImport() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/strfry/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, signAs: 'client' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || `request failed (${res.status})`);
      setImported(true); setSawRecheck(false);
      if (onImported) onImported();
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button className="btn btn-sm" onClick={handleImport} disabled={busy}>
        {busy ? '⏳ Importing…' : 'Import to local strfry'}
      </button>
      {imported && (!sawRecheck || checking) && <span style={muted}>✓ Imported — re-checking…</span>}
      {imported && sawRecheck && !checking && (
        <span style={warn}>Imported, but the re-check did not find it in this instance&apos;s strfry.</span>
      )}
      {error && <span style={{ fontSize: '0.8rem', color: '#f85149' }}>Import failed: {error}</span>}
    </span>
  );
}

/** Where a found header lives: this instance (with its Simple Lists link), or a relay (with the import). */
function FoundHeader({ lookup, coord, onImported, checking }) {
  if (lookup.where === 'local') {
    return (
      <div style={line}>
        In this instance&apos;s strfry.{' '}
        <Link to={`/tapestry/lists/${encodeURIComponent(coord)}`} style={{ color: '#58a6ff' }}>Open in Simple Lists →</Link>
      </div>
    );
  }
  return (
    <div style={line}>
      Found on <code>{lookup.checkedRelay}</code> — not in this instance&apos;s strfry.{' '}
      <ImportToLocalButton event={lookup.event} onImported={onImported} checking={checking} />
    </div>
  );
}

/** A header that was not found (says where it looked) or could not be checked (never "not found"). */
function LookupMiss({ lookup }) {
  if (lookup.failed) {
    return <div style={warn}>⚠️ Couldn&apos;t check — looked locally{lookup.checkedRelay ? ` and on ${lookup.checkedRelay}` : ''}.</div>;
  }
  return <div style={warn}>⚠️ {describeHeaderLookup({ relay: lookup.checkedRelay }, null, lookup.checkedRelay).text}.</div>;
}

/** Section 1 — the header the viewer's assistant authored for this list, and the pointer it carries. */
export function AssistantHeaderSection({ row, lookup, info, onImported, checking }) {
  let body;
  if (!lookup) body = <div style={muted}>⏳ checking…</div>;
  else if (!lookup.event) body = <LookupMiss lookup={lookup} />;
  else {
    body = (
      <>
        <FoundHeader lookup={lookup} coord={row.coord} onImported={onImported} checking={checking} />
        <div style={line}>
          {info?.authoredByAssistant
            ? <>Authored by your assistant · <code>{short(lookup.event.pubkey)}</code></>
            : <span style={warn}>⚠️ Not authored by your assistant ({short(lookup.event.pubkey)}).</span>}
        </div>
        {info?.pointer && (
          <div style={line}>Points to <code>{shortCoord(info.pointer.coord)}</code> ({info.pointer.type})</div>
        )}
        {info?.deferred && <div style={{ ...line, opacity: 0.75 }}>It is marked deliberately unaffiliated (b-tag-deferred).</div>}
        {(info?.problems || []).map((p) => (
          <div key={p} style={{ ...warn, marginTop: '0.35rem' }}>{PROBLEM_SENTENCES[p](info)}</div>
        ))}
        <RawEventToggle event={lookup.event} />
      </>
    );
  }
  return (
    <section style={sectionBox}>
      <h3 style={sectionTitle}>Your assistant&apos;s DList header</h3>
      {body}
    </section>
  );
}

/** Section 2 — the shared header the pointer names, looked up here first, then on the community relay. */
export function SharedHeaderSection({ info, lookup, assistantLookup, communityRelay, onImported, checking }) {
  let body;
  if (!assistantLookup) body = <div style={muted}>⏳ checking…</div>;
  else if (!assistantLookup.event) {
    body = (
      <div style={muted}>
        Can&apos;t tell which shared header: your assistant&apos;s header {assistantLookup.failed ? "couldn't be checked" : 'was not found'}.
      </div>
    );
  } else if (!info?.pointer) {
    body = (
      <div style={muted}>
        Can&apos;t tell which shared header: your assistant&apos;s header {info?.deferred ? 'is marked deliberately unaffiliated' : 'names no shared header'}.
      </div>
    );
  } else if (!lookup) {
    body = <div style={muted}>⏳ checking this instance and {communityRelay}…</div>;
  } else if (!lookup.event) {
    body = <LookupMiss lookup={lookup} />;
  } else {
    body = (
      <>
        <div style={line}><strong>{nameOf(lookup.event) || info.pointer.d}</strong> · <code>{shortCoord(info.pointer.coord)}</code></div>
        <FoundHeader lookup={lookup} coord={info.pointer.coord} onImported={onImported} checking={checking} />
        <RawEventToggle event={lookup.event} />
      </>
    );
  }
  return (
    <section style={sectionBox}>
      <h3 style={sectionTitle}>Shared DList header</h3>
      {body}
    </section>
  );
}
