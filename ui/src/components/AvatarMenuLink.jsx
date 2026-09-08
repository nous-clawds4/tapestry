/**
 * One row in an avatar menu's personal / destinations section
 * (navigation-scaffolding #2). Shared by the Brainstorm-side menus.
 *
 * Renders as an anchor so the link is copyable and middle-clickable, and so a
 * target outside the React router (`/legacy/`) is reached by a full page load
 * without any special casing. A link with no target — the assistant profile,
 * for a caller with no provisioned assistant key — renders disabled rather than
 * vanishing, so the menu reads the same for every signed-in user.
 */
export default function AvatarMenuLink({ link, onNavigate }) {
  if (!link.to) {
    return (
      <span
        className="bs-usermenu-link is-disabled"
        aria-disabled="true"
        title={link.disabledReason}
      >
        <span className="bs-usermenu-link-icon">{link.icon}</span>
        {link.label}
      </span>
    );
  }
  return (
    <a href={link.to} className="bs-usermenu-link" onClick={onNavigate}>
      <span className="bs-usermenu-link-icon">{link.icon}</span>
      {link.label}
    </a>
  );
}
