import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrainstormUserMenu from '../components/BrainstormUserMenu';
import NoteCard from '../components/NoteCard';
import useEventResolve from '../hooks/useEventResolve';
import { resolveEventParams, classifyEventInput } from '../utils/eventParam';

/**
 * Stories event-page #2 + #3 / ADR event-page/0002: the public single-event view (/event).
 *
 * Front-end only. It decodes the URL params (resolveEventParams, precedence
 * nevent > id > naddr > pubkey > npub > nprofile), fetches id/author targets via the read path
 * (useEventResolve → /api/event, ADR 0001), and renders the kind-1 like /feed (NoteCard) or the
 * precise outcome message. `naddr` is reported as a not-yet-supported kind from its coordinate
 * (no fetch). With no valid param it shows the <EventSearch> field. Body rendering for id/author
 * targets is delegated to the PURE, named-exported renderResolvedEvent.
 */

// Operator-delegated copy (stories #2/#3). Punctuation non-binding; meaning is exact.
export const EVENT_COPY = {
  HEADING: 'Event',
  LOADING: 'Loading…',
  COULDNT_LOAD: "Couldn't load this event right now.",
  unsupportedKind: (k) => `Kind ${k} events are not yet supported.`,
  INVALID_EVENT: 'This event could not be verified — its signature or id does not validate.',
  NOT_FOUND: 'Event not found on the relays we checked.',
  NO_AUTHOR_NOTE: 'No kind-1 note found for this author.',
  invalidParams: (names) => `Ignoring invalid parameter${names.length > 1 ? 's' : ''}: ${names.join(', ')}.`,
  SEARCH_PROMPT: 'Paste an nevent, id, naddr, npub, pubkey, or nprofile.',
  SEARCH_INVALID: 'That isn’t a recognized nevent, id, naddr, npub, pubkey, or nprofile.',
};

const RENDER_STATUSES = ['OK', 'UNSUPPORTED_KIND', 'INVALID_EVENT', 'NOT_FOUND', 'NO_AUTHOR_NOTE'];

export default function BrainstormEvent() {
  const { user, login, logout } = useAuth();
  const [params] = useSearchParams();
  const { target, invalidParams } = resolveEventParams(params);

  // Only id/author targets fetch; naddr / no-target pass an empty arg so the hook no-ops.
  const fetchArg = target && (target.mode === 'id' || target.mode === 'author')
    ? {
        id: target.mode === 'id' ? target.id : undefined,
        author: target.mode === 'author' ? target.author : undefined,
        relays: target.relays,
      }
    : {};
  const { data, loading, error } = useEventResolve(fetchArg);

  let body;
  if (!target) {
    body = <EventSearch />;
  } else if (target.mode === 'naddrUnsupported') {
    body = <div className="bsp-empty">{EVENT_COPY.unsupportedKind(target.kind)}</div>;
  } else {
    body = renderResolvedEvent({ data, loading, error });
  }

  return (
    <div className="bsp-page">
      {/* Top bar */}
      <div className="bsp-top-bar">
        <a href="/" className="bsp-logo">
          <img src="/brainstorm.svg" alt="" className="bsp-logo-img" />
        </a>
        <div className="bsp-auth">
          <BrainstormUserMenu user={user} login={login} logout={logout} />
        </div>
      </div>

      <div className="bsp-content bsp-event-content">
        <h1 className="bsp-event-heading">{EVENT_COPY.HEADING}</h1>
        {invalidParams.length > 0 && (
          <div className="bsp-empty bsp-event-invalid">{EVENT_COPY.invalidParams(invalidParams)}</div>
        )}
        {body}
      </div>
    </div>
  );
}

/**
 * The no-parameter search fallback (story #3): a field that resolves a pasted identifier by
 * navigating to the canonical /event?<type>=<value> (so #2's render path handles it + the result
 * is shareable), or shows the "not recognized" notice.
 */
function EventSearch() {
  const [, setParams] = useSearchParams();
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const c = classifyEventInput(input);
    if (c) { setNotice(''); setParams({ [c.paramName]: c.value }); }
    else { setNotice(EVENT_COPY.SEARCH_INVALID); }
  };

  return (
    <form className="bsp-event-search" onSubmit={submit}>
      <label className="bsp-event-search-label">{EVENT_COPY.SEARCH_PROMPT}</label>
      <div className="bsp-event-search-row">
        <input
          className="bsp-event-search-input"
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="nevent1… · npub1… · 64-hex id"
          aria-label={EVENT_COPY.SEARCH_PROMPT}
        />
        <button className="bsp-event-search-btn" type="submit">Enter</button>
      </div>
      {notice && <div className="bsp-empty bsp-event-search-notice">{notice}</div>}
    </form>
  );
}

/**
 * Pure state→view mapping for an id/author target. A function only of its args — no fetch, no
 * hook, no router, no browser globals — so the outcomes are an isolated, testable unit. Renders
 * the kind-1 via the shared NoteCard on OK; a precise message for each other read-path status;
 * a transient loading line; and a neutral defensive line for transport failures / unknown status.
 */
export function renderResolvedEvent({ data, loading, error }) {
  if (loading && !data) {
    return <div className="bsp-event-loading">{EVENT_COPY.LOADING}</div>;
  }
  const status = data && data.status;
  if (error || !data || !RENDER_STATUSES.includes(status)) {
    return <div className="bsp-empty">{EVENT_COPY.COULDNT_LOAD}</div>;
  }
  if (status === 'OK') {
    return <NoteCard item={data.item} />;
  }
  if (status === 'UNSUPPORTED_KIND') {
    return <div className="bsp-empty">{EVENT_COPY.unsupportedKind(data.kind)}</div>;
  }
  if (status === 'INVALID_EVENT') {
    return <div className="bsp-empty">{EVENT_COPY.INVALID_EVENT}</div>;
  }
  if (status === 'NOT_FOUND') {
    return <div className="bsp-empty">{EVENT_COPY.NOT_FOUND}</div>;
  }
  if (status === 'NO_AUTHOR_NOTE') {
    return <div className="bsp-empty">{EVENT_COPY.NO_AUTHOR_NOTE}</div>;
  }
  return <div className="bsp-empty">{EVENT_COPY.COULDNT_LOAD}</div>;
}
