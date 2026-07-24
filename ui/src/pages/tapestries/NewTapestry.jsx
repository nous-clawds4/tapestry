import Breadcrumbs from '../../components/Breadcrumbs';

/**
 * Placeholder for tapestry authoring. Inert by design: it previews the planned
 * fields (title / description / member concepts) but has no working submit.
 * Creating a tapestry is a future story (tapestries epic).
 */
export default function NewTapestry() {
  return (
    <div className="page">
      <Breadcrumbs />
      <h1>🧵 Create New Tapestry</h1>
      <p className="placeholder">
        Coming soon — authoring a tapestry isn&apos;t available yet. Below is a preview of the
        planned form.
      </p>

      <form className="tapestry-new-preview" onSubmit={(e) => e.preventDefault()} aria-disabled="true">
        <label className="form-field">
          <span>Title</span>
          <input type="text" placeholder="e.g. Tapestry for Dog" disabled />
        </label>
        <label className="form-field">
          <span>Description</span>
          <textarea placeholder="What this tapestry groups together…" disabled />
        </label>
        <label className="form-field">
          <span>Member concepts</span>
          <input type="text" placeholder="Concepts to include (e.g. dog, dog breed)…" disabled />
        </label>
        <button type="submit" className="btn btn-primary" disabled>
          Create Tapestry
        </button>
      </form>
    </div>
  );
}
