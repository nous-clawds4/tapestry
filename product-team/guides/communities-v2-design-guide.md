# Design Guide: Communities (Phase 2)

**Slug:** communities-v2
**Date:** 2026-06-06
**Extends:** `guides/communities-design-guide.md` (V1 — binding, not superseded). All V1 tokens, the visual identity, and the base components (Trust Signal, Circle Card, Circle Definition panel, Composer+Post, Found/Fork stepper) carry forward unchanged. This guide adds only the **net-new Phase 2 surfaces** and the principles that govern them.

> Honors `product-team/guardrails/design.md` and `product-team/guardrails/language.md`. Copy honors `guides/communities-style-guide.md` (peer-not-platform, calm, concrete, no protocol jargon, no scare copy). Wireframes: `guides/communities-v2-wireframes.html`.

## New design principles (Phase 2 — enforceable in review)
Numbered to continue the V1 guide (which ends at 6).

7. **Aliveness serves belonging, never capture.** This is the design encoding of the discovery sovereignty test. Every reach-out is *pulled and configurable*; nothing is scheduled at the user. Banned outright: auto-playing or auto-injecting new content into a view the user is reading, unread-count badges engineered to manufacture urgency, infinite-scroll traps, and any notification a user cannot turn off. New activity is offered (a calm "3 new" affordance the user taps), never forced.
8. **Notifications default quiet.** Every notification category ships **off or conservative by default** and is individually turn-off-able. There is no global "turn on everything" nag, no acquisition prompt, no red dot that exists only to pull the user back.
9. **The founder's fading is shown, not hidden.** Founder standing decays on a legible, human-readable rule, and the founder can see it. The no-owner promise must be inspectable, so this is a real UI surface, not a backend property.
10. **Caretaking reads as a community act, not an owner button.** Retiring a circle, and any handling of a bad actor, is framed and worded as trust-consistent. No copy implies one person's unilateral authority over the circle or its people.
11. **Calm about absence and danger, both.** A dormant circle is described plainly ("Quiet lately. Last post 3 weeks ago"), never shamed or hyped. This continues V1's "calm about danger" into "calm about quiet."

## New component patterns

### Conversation thread (replies + reactions)
- **Visual:** posts stack in the existing Post treatment. A reply nests one level under its parent with a short left rule in `--bg-hover` and a `--space-4` indent. No deeper nesting at launch (one level keeps the room readable on mobile). Reactions sit as a quiet inline row beneath a post: a small pill per reaction symbol with an honest count in `--text-secondary` (e.g. a single up-mark and "3"). The viewer's own reaction pill carries a `--accent` border.
- **Behavior:** tapping "Reply" opens the existing composer inline, scoped to the parent. Reacting is one tap, toggles on/off, optimistic. Counts are exact and small, never inflated or rounded up for effect.
- **Empty / loading / error:** *Empty* — the V1 "No posts yet. Start the conversation." *Loading* — 3 post skeletons (existing). *Reply/reaction error* — inline, per-item, with Retry; the post stays, the action shows as not-yet-sent.

### Live-update affordance ("new" pill)
- **Visual:** when new posts arrive while the user is reading, a single centered pill appears at the top of the conversation: "3 new" in `--accent` text on `--accent-muted`, `--radius-full`. It does not move the content the user is reading.
- **Behavior:** the user taps it to load. New content is never injected automatically (principle 7). The pill is the only "live" surface; the rest updates on the user's action.
- **Empty / loading / error:** no empty state (absent when nothing is new). If the live channel drops, the pill simply stops appearing; a manual pull-to-refresh / reload still works. No error chrome for a silent background channel.

### Notification inbox
- **Visual:** a dedicated calm list, reached from a quiet marker in the nav (a small `--accent` dot when there is something new — **not** a numeric count badge). Each item is one plain sentence with the actor avatar, the occasion, the circle, and a relative time. Example rows: "maya vouched for you in Sunset Hikers · 2h", "New posts in Code & Coffee · 1d".
- **Behavior:** opening the inbox clears the new-marker. Each item links to its source. Nothing auto-marks-urgent; nothing nags.
- **Empty / loading / error:** *Empty* — "Nothing new. When someone vouches for you or a circle you're in gets active, it shows up here." *Loading* — 4 row skeletons. *Error* — "We couldn't load your updates. Retry?"

### Notification preferences (the sovereignty control)
- **Visual:** a short list of occasions, each a labeled toggle on `--bg-input`. Occasions at launch: "Someone vouches for you", "New posts in your circles", "Replies to you". A one-line header states the stance plainly: "Choose what you hear about. Everything here is off until you turn it on, and you can turn any of it off again." A toggle uses `--accent` when on, `--bg-hover` track when off (state is conveyed by position + an on/off text label, never color alone).
- **Behavior:** every toggle is independent. There is no master switch that implies "on is normal". Changes save immediately with a quiet "Saved" confirmation.
- **Empty / loading / error:** no empty state (the list is fixed). *Error on save* — inline "Couldn't save that change. Retry?"; the toggle reverts to its last saved position.

### Foothold invite (founder/member issues)
- **Visual:** a panel reached from a circle's People area: "Invite someone in." Body copy: "Your invite vouches for them. They can join even if no one else here knows them yet." A field to address the invite, and a primary "Create invite" action that yields a shareable link with a plain explanation of what it does.
- **Behavior:** issuing an invite creates a carried vouch that activates when the recipient accepts. Worded as an act of personal trust, not an approval. The issuer is reminded, calmly, that their vouch stands behind this person.
- **Empty / loading / error:** *Empty* (no invites yet) — "You haven't invited anyone yet. An invite is how a new person gets their first foothold." *Loading* — button shows a skeleton label. *Error* — "Couldn't create the invite. Retry?"

### Onboarding accept (the outsider's first foothold)
- **Visual:** the screen an invited outsider lands on. It names who invited them and the circle, in plain prose: "maya invited you into Sunset Hikers. Her vouch is your way in." Then the portable-identity step (reuses the V1 sign-in prompt pattern and copy stance). Intended state survives the identity step.
- **Behavior:** accepting creates the person's portable identity and activates the carried vouch, so they enter through a person's extended trust rather than an admin's approval. The path from "just arrived" to "fully belong" is stated.
- **Empty / loading / error:** *Expired invite* — "This invite has expired. Ask whoever shared it for a new one." (a path, never a dead end). *Error* — specific copy by failure, per V1 (network / signing cancelled), never "something went wrong".

### Founder standing (legible decay)
- **Visual:** a quiet panel the founder sees on their own circle (not shown to others). It states the current reality in concrete terms, with a simple proportion bar in `--accent` over `--bg-hover`. Early: "When you started this circle, your vouch carried it." Later: "14 members now vouch for each other. The circle runs on its own trust, not on you." The bar shows the founder's share of the circle's trust shrinking as the circle grows.
- **Behavior:** read-only and informational. It is reassurance that the no-owner promise is real, made inspectable. No action attached.
- **Empty / loading / error:** *Just founded* — "It's just you so far. As people join and vouch for each other, your head start fades on purpose." *Loading* — bar + line shimmer. *Error* — hide the panel rather than show a broken figure (it is reassurance, not critical data).

### Signs of life (on card + detail)
- **Visual:** a single quiet line, in `--text-muted`, stating the most recent activity in concrete terms. Active: "Active today · 6 posts this week". Quiet: "Quiet lately · last post 3 weeks ago". On the Circle Card it sits under the Trust Signal; on detail it sits near the definition. No flame icons, no "hot" labels, no manufactured-urgency styling.
- **Behavior:** renders read-only, no account needed (it is part of letting a visitor judge a circle before signing in). Honest about quiet (principle 11).
- **Empty / loading / error:** *Brand-new circle* — "New circle · founded today". *Loading* — a short line shimmer. *Error* — omit the line (absence is acceptable; a wrong activity claim is not).

### Retire a circle (caretaking)
- **Visual:** reached from a circle's caretaking area, worded as a community act. Header: "Retire this circle". Body: "Retiring asks the people who vouched here to release it. A retired circle stops appearing in discovery. Its history stays on the network. Nothing is erased." A confirm step restates the outcome plainly.
- **Behavior:** trust-consistent retirement, not a unilateral owner delete. Copy never implies one-person authority. This same surface clears the three legacy test circles. A retired circle moves to the `retired` state and drops out of discovery; direct links still resolve to a clearly-marked retired view.
- **Empty / loading / error:** *Confirm* — "Retire Sunset Hikers? It will stop appearing in discovery. Its posts and history stay on the network." *Error* — "Couldn't retire the circle. Retry?" *Retired view* — "This circle has been retired. Its history is still here."

### Posting-lock degraded state
- **Visual:** when the trust/roster source is unreachable, the composer does not vanish or sit dead. A calm inline note above the composer: "We can't reach the trust network right now, so we can't confirm membership. You can still post." The composer stays usable (the graceful fallback from scope).
- **Behavior:** falls back to a signed-in gate so conversation is never dead, including for a founder in a brand-new circle. When the source recovers, the note disappears and the normal trust-based gate resumes. This degradation is silent-positive: it keeps the room open rather than blocking it.
- **Empty / loading / error:** this *is* the error/degraded state. It never reads as "something went wrong"; it states the situation and what the user can still do.

## Screen inventory (Phase 2 additions)

| Screen | Purpose | Wireframe |
|---|---|---|
| Circle detail — alive | Threaded conversation + reactions + live pill + signs of life + degraded composer | `communities-v2-wireframes.html#alive` |
| Notification inbox | Calm list of pulled updates | `communities-v2-wireframes.html#inbox` |
| Notification preferences | The sovereignty control (off-by-default toggles) | `communities-v2-wireframes.html#prefs` |
| Foothold invite | Founder/member extends a first foothold (carries a vouch) | `communities-v2-wireframes.html#invite` |
| Onboarding accept | The outsider's first foothold + portable identity | `communities-v2-wireframes.html#accept` |
| Founder standing | Legible head-start decay (founder-only) | `communities-v2-wireframes.html#standing` |
| Retire a circle | Trust-consistent caretaking | `communities-v2-wireframes.html#retire` |

## Responsive behavior (additions)
- **Mobile (<640px):** conversation replies indent by `--space-3` only (preserve reading width); reaction pills wrap; the notification inbox is full-width rows; preference toggles are full-width; the founder-standing bar spans full width. The "new" pill stays centered and fixed to the top of the conversation pane.
- **Tablet (640–1024px):** circle detail keeps the V1 two-pane intent where width allows; inbox and preferences are single-column, max 560px.
- **Desktop (>1024px):** founder-standing panel sits in the circle's right rail near People; inbox/preferences centered, max 560px.

## Accessibility baseline (additions)
- **Toggles:** state conveyed by switch position **and** an "On/Off" text label, never color alone (continues V1 color-independence). Each toggle is a real control with a 44×44px target and a visible `--accent` focus ring.
- **Live "new" pill:** announced politely to assistive tech (a non-interrupting live region), consistent with principle 7 — it informs, it does not seize focus.
- **Notification new-marker:** the `--accent` dot has a text equivalent ("new updates") for screen readers; it is never the sole carrier of meaning.
- **Reactions:** each reaction control has an accessible name stating the symbol and count ("3 like reactions, you reacted"). Contrast holds at the V1 ratios (body ≥ 4.5:1, UI ≥ 3:1).
