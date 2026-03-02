import { useOutletContext } from 'react-router-dom';

export default function DListRaw() {
  const { event } = useOutletContext();

  return (
    <div className="dlist-raw">
      <h2>Raw Nostr Event</h2>
      <pre className="json-block">
        {JSON.stringify(event, null, 2)}
      </pre>
    </div>
  );
}
