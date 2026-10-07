# The Brainstorm top bar offers "Sign in with nostr" while the page-load session check is still running

**Id:** 2026-10-07-top-bar-sign-in-while-loading
**Type:** bug
**Opened:** 2026-10-07 (manage-treasure-map #2 review 1, round 3, non-blocking 1)
**Status:** OPEN
**Done:** —

`BrainstormUserMenu` (`ui/src/components/BrainstormUserMenu.jsx`, `if (!user) return <button …>Sign in with nostr`)
renders its sign-in button whenever there is no session user, including while `AuthContext`'s page-load `checkStatus`
is still reading an existing session (`loading` true). A person with session X whose signer now holds Y can click it in
that window: the load check sets X, then the sign-in finishes and sets Y, so the page changes person without ever
rendering signed-out. On `/treasure-map` this leaves an open raw Treasure Map viewer open on Y's own Map (round 3's
probe P4); nothing is lost, signed or published. Other pages that assume "the person only changes through signed-out"
can be affected the same way.

**Fix shape.** Show nothing (or a neutral placeholder) in the top bar's sign-in slot while `useAuth().loading` is true,
as `Header.jsx` already does with its `…` while loading. A browser case: hold `/api/auth/status`, check no Sign in is
offered, release, check the avatar. Then `/treasure-map`'s comment and ADR manage-treasure-map/0002 Amendment 2's
correction can drop the exception.

**Pointer:** `engineering-team/reviews/done/manage-treasure-map/2-the-assistants-by-category-cards.md` § Re-review, round 3;
ADR manage-treasure-map/0002 Amendment 2, Correction.
