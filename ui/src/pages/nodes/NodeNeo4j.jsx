import { useOutletContext } from 'react-router-dom';
import { useState, useEffect } from 'react';
import DListItemNeo4j from '../events/DListItemNeo4j.jsx';

/**
 * Adapter: NodeDetail provides { node, uuid } via outlet context.
 * DListItemNeo4j expects an event object.
 * We fetch the strfry event by uuid, or synthesise a minimal one from node data.
 */
export default function NodeNeo4j() {
  const { node, uuid } = useOutletContext();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    if (!uuid) return;
    const parts = uuid.split(':');
    let filter;
    if (parts.length >= 3 && ['9998','39998','9999','39999'].includes(parts[0])) {
      filter = { kinds: [parseInt(parts[0])], authors: [parts[1]], '#d': [parts.slice(2).join(':')] };
    } else {
      filter = { ids: [uuid] };
    }
    fetch(`/api/strfry/scan?filter=${encodeURIComponent(JSON.stringify(filter))}`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.events?.length) {
          setEvent(data.events[0]);
        } else {
          setEvent(synthesise(node, uuid));
        }
      })
      .catch(() => setEvent(synthesise(node, uuid)));
  }, [uuid, node]);

  if (!event) return <p style={{ color: 'var(--text-muted)' }}>Loading…</p>;

  return <DListItemNeo4j eventOverride={event} />;
}

function synthesise(node, uuid) {
  return {
    id: node?.id || uuid,
    kind: node?.kind ? parseInt(node.kind) : 0,
    pubkey: node?.pubkey || '',
    tags: [],
    created_at: node?.created_at ? parseInt(node.created_at) : 0,
  };
}
