import { useState, useEffect, useCallback } from 'react';
import { queryRelay } from '../../api/relay';
import { composeGraph } from './tapestryGraphModel';

/** Split an addressable uuid "kind:pubkey:d-tag" without breaking on d-tag colons. */
export function parseUuid(uuid) {
  if (!uuid) return null;
  const i1 = uuid.indexOf(':');
  const i2 = uuid.indexOf(':', i1 + 1);
  if (i1 < 0 || i2 < 0) return null;
  return { kind: Number(uuid.slice(0, i1)), pubkey: uuid.slice(i1 + 1, i2), dTag: uuid.slice(i2 + 1) };
}

function jsonTag(ev) {
  try { return JSON.parse(ev?.tags?.find((t) => t[0] === 'json')?.[1] || 'null'); } catch { return null; }
}

/** Read a single addressable event (kind:pubkey:d-tag) from strfry. */
async function readByUuid(uuid) {
  const p = parseUuid(uuid);
  if (!p) return null;
  const events = await queryRelay({ kinds: [p.kind], authors: [p.pubkey], '#d': [p.dTag] });
  return events?.[0] || null;
}

/**
 * Read a tapestry element from strfry by uuid, resolve its graph.imports one level
 * (also from strfry), and compose an as-authored graph model. Per ADR tapestries/0002.
 * Returns { loading, error, tapestry, rawGraph, composed, imports, degraded, notFound,
 * event, reload }. A missing/invalid graph block → degraded; a failed import is skipped,
 * not fatal. `event` is the raw fetched element (the add-a-concept transform's input) and
 * `reload()` re-reads the same coordinate from strfry — post-save visibility is by re-read,
 * not optimism (ADR tapestries/0005 Decision 4).
 */
export default function useTapestryGraph(uuid) {
  const [state, setState] = useState({
    loading: true, error: null, tapestry: null, rawGraph: null,
    composed: null, imports: [], degraded: false, notFound: false, event: null,
  });
  const [reloadCount, setReloadCount] = useState(0);
  const reload = useCallback(() => setReloadCount((c) => c + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));
        const ev = await readByUuid(uuid);
        if (cancelled) return;

        if (!ev) {
          setState({ loading: false, error: null, tapestry: null, rawGraph: null, composed: null, imports: [], degraded: false, notFound: true, event: null });
          return;
        }

        const content = jsonTag(ev) || {};
        const tapestry = content.tapestry || null;
        const graph = content.graph;

        if (!graph || !Array.isArray(graph.nodes)) {
          setState({ loading: false, error: null, tapestry, rawGraph: graph || null, composed: null, imports: [], degraded: true, notFound: false, event: ev });
          return;
        }

        // Resolve imports one level, in parallel, best-effort.
        const importList = Array.isArray(graph.imports) ? graph.imports : [];
        const resolved = await Promise.all(importList.map(async (imp) => {
          try {
            const iev = await readByUuid(imp.uuid);
            const ig = jsonTag(iev)?.graph;
            return ig ? { slug: imp.slug, uuid: imp.uuid, graph: ig } : null;
          } catch { return null; }
        }));
        if (cancelled) return;

        const imports = resolved.filter(Boolean);
        const composed = composeGraph(graph, imports.map((i) => i.graph));
        setState({ loading: false, error: null, tapestry, rawGraph: graph, composed, imports, degraded: false, notFound: false, event: ev });
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, tapestry: null, rawGraph: null, composed: null, imports: [], degraded: false, notFound: false, event: null });
        }
      }
    })();

    return () => { cancelled = true; };
  }, [uuid, reloadCount]);

  return { ...state, reload };
}
