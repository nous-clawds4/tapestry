import { COPY, profilePath } from './myAssistants';

/**
 * View profile: an Assistant's Brainstorm profile page, where the tags on it are shown (my-assistants #4, ADR
 * my-assistants/0004 sub-decision 5). It opens in a new tab, so /assistants stays where it was, and its accessible
 * name says whose profile it is and that it opens a new tab (AC-5). A plain link: a new tab gains nothing from
 * client-side routing. Callers place it outside every toggle button, so pressing it never opens or closes a row.
 *
 * Props: pubkey; name (as the page shows it).
 */
export default function ProfileLink({ pubkey, name }) {
  return (
    <a
      className="bsd-ma-profile-link"
      href={profilePath(pubkey)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={COPY.viewProfileLabel(name)}
    >
      {COPY.viewProfile} <span aria-hidden="true">↗</span>
    </a>
  );
}
