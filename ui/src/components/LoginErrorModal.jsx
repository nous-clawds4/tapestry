/**
 * A single, reusable surface for login failures. Rendered once at the
 * AuthProvider level so every login entry point (the search user menu, the
 * Pins / Tag sign-in prompts, the Tapestry dashboard header, …) gets the
 * same explanation without each callsite wiring its own error handling.
 *
 * Receives the coded error AuthContext recorded ({ code, message }) and maps
 * the code to controlled, vendor-neutral copy. We deliberately do not name
 * specific signer software, and never show a raw extension string.
 */
function describe(code, message) {
  switch (code) {
    case 'NO_SIGNER':
      return {
        title: 'No Nostr signer found',
        body: 'Signing in needs a NIP-07 signer — usually a browser extension that holds your Nostr keys. Install one, then try again.',
      };
    case 'SIGNER_DECLINED':
      return {
        title: 'Sign-in cancelled',
        body: 'The request was declined in your signer. Try again when you’re ready.',
      };
    case 'NOT_AUTHORIZED':
      // The server's own message is the meaningful "why" here.
      return {
        title: 'Couldn’t sign in',
        body: message || 'You’re not authorized to sign in here.',
      };
    default:
      return {
        title: 'Couldn’t sign in',
        body: message || 'Something went wrong while signing in. Please try again.',
      };
  }
}

export default function LoginErrorModal({ error, onClose }) {
  if (!error) return null;
  const { code, message } = error;
  const { title, body } = describe(code, message);

  return (
    <div
      className="bs-login-error-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bs-login-error-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label="Sign-in failed"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="bs-login-error-title">{title}</h2>
        <p className="bs-login-error-message">{body}</p>
        <div className="bs-login-error-actions">
          <button className="bs-login-error-btn" onClick={onClose} autoFocus>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
