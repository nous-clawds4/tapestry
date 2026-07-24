import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { queryRelay } from '../../api/relay';

/**
 * Placeholder detail page for a single tapestry. THIS story ships only a stub
 * (title + "exploration coming soon"); the full Tapestry Exploration page
 * replaces this component in tapestries #2.
 */

/** Split an addressable uuid "kind:pubkey:d-tag" without breaking on d-tag colons. */
function parseUuid(uuid) {
  const i1 = uuid.indexOf(':');
  const i2 = uuid.indexOf(':', i1 + 1);
  if (i1 < 0 || i2 < 0) return null;
  return {
    kind: Number(uuid.slice(0, i1)),
    pubkey: uuid.slice(i1 + 1, i2),
    dTag: uuid.slice(i2 + 1),
  };
}

export default function TapestryDetail() {
  const { uuid } = useParams();
  const [title, setTitle] = useState(null);

  useEffect(() => {
    const parsed = uuid && parseUuid(uuid);
    if (!parsed) return;
    let cancelled = false;

    (async () => {
      try {
        const events = await queryRelay({
          kinds: [parsed.kind],
          authors: [parsed.pubkey],
          '#d': [parsed.dTag],
        });
        if (cancelled) return;
        const ev = events?.[0];
        let t = parsed.dTag;
        try {
          const raw = ev?.tags?.find((x) => x[0] === 'json')?.[1];
          t = JSON.parse(raw || '{}').tapestry?.title || parsed.dTag;
        } catch {
          t = parsed.dTag;
        }
        setTitle(t);
      } catch {
        if (!cancelled) setTitle(parsed.dTag);
      }
    })();

    return () => { cancelled = true; };
  }, [uuid]);

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧵 {title || 'Tapestry'}</h1>
      <p className="placeholder">
        Exploration coming soon — the tapestry explorer ships in the next story.
      </p>
      <p className="text-muted"><code>{uuid}</code></p>
    </div>
  );
}
