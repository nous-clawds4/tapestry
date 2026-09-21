import TopBar from '../../components/TopBar';
import AssistantProfileEditor from '../../components/AssistantProfileEditor';
import { useAuth } from '../../context/AuthContext';
import { hasMyAssistantPage, mayCreateAssistant } from '../../config/avatarMenuLinks';

/**
 * /assistant — the My Assistant page (assistant-profile #4, ADR 0004): the one place a signed-in Owner,
 * Admin or Customer sees their own assistant and edits and publishes its profile. Every entry point —
 * both avatar menus, the dashboard's prompt, the assistant's profile-page banner, both Settings areas —
 * leads here, and nothing else hosts the editor.
 *
 * It is always about the viewer's OWN assistant: the editor asks /api/assistant/status about
 * user.pubkey, which the server resolves to that person's assistant (the Owner's is the instance
 * Tapestry Assistant). The page never reads the instance TA itself.
 *
 * Whether there is anything to show comes from the same predicate that enables the avatar menu's
 * "My Assistant's Profile", so the menu and the page cannot disagree.
 */
export default function MyAssistantPage() {
  const { user, loading, login, refreshUser } = useAuth();

  let body;
  if (loading) {
    body = <p className="bs-assistant-note">Checking sign-in…</p>;
  } else if (!user) {
    // AC5: a visitor sees no one's assistant controls.
    body = (
      <div className="bss-card">
        <p className="bs-assistant-note">Sign in to see and manage your Tapestry Assistant.</p>
        {/* Failures are reported by the shared sign-in modal. */}
        <button type="button" className="bss-link-btn" onClick={() => login().catch(() => {})}>
          Sign in with nostr
        </button>
      </div>
    );
  } else if (!hasMyAssistantPage(user)) {
    // AC3: someone who has no assistant and may not create one is told why, not shown a broken editor.
    body = (
      <div className="bss-card">
        <p className="bs-assistant-note">
          Your account has no Tapestry Assistant on this instance. An assistant is a nostr identity this
          instance holds for you, to sign and publish on your behalf. This instance sets one up for its
          owner, its admins and its customers.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="bss-card">
        <AssistantProfileEditor
          customerPubkey={user.pubkey}
          canCreateAssistant={mayCreateAssistant(user)}
          onAssistantCreated={refreshUser}
        />
      </div>
    );
  }

  return (
    <div className="bsp-page">
      <TopBar />
      <main className="bsp-content bs-assistant-main">
        <h1 className="bs-assistant-title">🤖 My Assistant</h1>
        {body}
      </main>
    </div>
  );
}
