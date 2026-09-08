import Breadcrumbs from './Breadcrumbs';

/**
 * A page that exists in the navigation before its surface is built.
 *
 * Says so plainly rather than rendering an empty shell — the operator asked for
 * the information architecture to be visible and arguable ahead of the pages
 * themselves, so "this is a placeholder" is the content, not an apology for it.
 *
 * `title` is the heading, `children` the one or two sentences describing what
 * will eventually live here.
 */
export default function PlaceholderPage({ title, children }) {
  return (
    <div className="page">
      <Breadcrumbs />
      <h1>{title}</h1>
      <div className="placeholder">
        <p><strong>Placeholder page.</strong></p>
        {children}
      </div>
    </div>
  );
}
