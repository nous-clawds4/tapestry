import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumbs from '../../components/Breadcrumbs';
import { useAuth } from '../../context/AuthContext';
import { hasAdminAccess } from '../../utils/auth';

/**
 * Create a Shared Concept — an element of the `shared concept` concept,
 * authored through the standard element machinery (create-element signs as
 * the TA, publishes to local strfry, imports, wires HAS_ELEMENT).
 *
 * Required: name, slug (auto-derived from the name until hand-edited),
 * description, and at least one identifier (a-tag and/or event-id). The
 * stored identifiers object always carries both keys — '' means unset, the
 * shape the directory/detail pages already read.
 */

/** Kebab-case a name the same way the server derives element slugs. */
function kebab(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const A_TAG_RE = /^\d+:[0-9a-f]{64}:.+$/;
const EVENT_ID_RE = /^[0-9a-f]{64}$/;
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export default function NewSharedConcept() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isOwner = hasAdminAccess(user);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [aTag, setATag] = useState('');
  const [eventId, setEventId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [validation, setValidation] = useState(null);
  const [error, setError] = useState(null);

  // Owner gate: non-owner visitors get an explanation, never a working form.
  if (!isOwner) {
    return (
      <div className="page">
        <Breadcrumbs />
        <h1>🤝 Add to Registry</h1>
        <p className="placeholder">
          Adding to the registry is owner-only. Sign in as the instance owner to record one.
        </p>
      </div>
    );
  }

  function onNameChange(value) {
    setName(value);
    if (!slugTouched) setSlug(kebab(value));
  }

  function onSlugChange(value) {
    setSlugTouched(true);
    setSlug(value);
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submitting) return; // re-entry guard — defense beyond the disabled button
    setValidation(null);
    setError(null);

    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    const trimmedDescription = description.trim();
    const trimmedATag = aTag.trim();
    const trimmedEventId = eventId.trim();

    if (!trimmedName) { setValidation('Please enter a name.'); return; }
    if (!trimmedSlug) { setValidation('Please enter a slug.'); return; }
    if (!SLUG_RE.test(trimmedSlug)) {
      setValidation('The slug may only contain lowercase letters, digits, and single hyphens.');
      return;
    }
    if (!trimmedDescription) { setValidation('Please enter a description.'); return; }
    if (!trimmedATag && !trimmedEventId) {
      setValidation('Please provide at least one identifier — an a-tag, an event-id, or both.');
      return;
    }
    if (trimmedATag && !A_TAG_RE.test(trimmedATag)) {
      setValidation('The a-tag must look like kind:pubkey:d-tag (e.g. 39998:<64-hex>:some-slug).');
      return;
    }
    if (trimmedEventId && !EVENT_ID_RE.test(trimmedEventId)) {
      setValidation('The event-id must be a 64-character lowercase hex string.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch('/api/normalize/create-element', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          concept: 'shared concept',
          name: trimmedName,
          json: {
            sharedConcept: {
              name: trimmedName,
              slug: trimmedSlug,
              description: trimmedDescription,
              identifiers: {
                'a-tag': trimmedATag,
                'event-id': trimmedEventId,
              },
            },
          },
        }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || `Create failed: status ${resp.status}`);
      }
      navigate(`/tapestry/shared-concepts/${encodeURIComponent(data.element.uuid)}`);
    } catch (err) {
      setError(err.message || 'Failed to create the shared concept.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🤝 Add to Registry</h1>
      <p className="subtitle">
        Record a concept <em>someone else</em> has shared, by its identifiers, so this instance keeps
        track of it. This catalogues an existing shared concept — it does not create or share one.
        To share a concept of your own, submit it from its concept page.
      </p>

      <form className="tapestry-new-form" onSubmit={onSubmit}>
        <label className="form-field">
          <span>Name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. nostr event tag"
          />
        </label>

        <label className="form-field">
          <span>Slug</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            placeholder="auto-derived from the name"
          />
        </label>

        <label className="form-field">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this shared concept is…"
          />
        </label>

        <label className="form-field">
          <span>a-tag</span>
          <input
            type="text"
            value={aTag}
            onChange={(e) => setATag(e.target.value)}
            placeholder="kind:pubkey:d-tag of the shared concept's header (optional if event-id given)"
          />
        </label>

        <label className="form-field">
          <span>event-id</span>
          <input
            type="text"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder="64-hex event id (optional if a-tag given)"
          />
        </label>

        {validation && <p className="error">{validation}</p>}
        {error && <p className="error">Error: {error}</p>}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create Shared Concept'}
        </button>
      </form>
    </div>
  );
}
