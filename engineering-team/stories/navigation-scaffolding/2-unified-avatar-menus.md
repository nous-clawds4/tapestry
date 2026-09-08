# Story 2: Both avatar menus carry the same destinations, for every logged-in user

**Status:** Done
**Created:** 2026-09-08
**Type:** Feature

## Background

The app has two shells with two independently-grown avatar dropdowns:

- **Main** — `ui/src/components/BrainstormUserMenu.jsx`, mounted by ~14 Brainstorm pages
  (landing, search, profile, feed, settings, …). Today: POV switch, Your pins, Settings, Sign
  out, plus an owner/admin-only panel holding Tapestry Dashboard and Legacy Dashboard.
- **Tapestry** — `ui/src/components/Header.jsx`, the control-panel header. Today: My Profile,
  My Assistant's Profile (only when `assistantPubkey` is non-null), Settings (owner/admin only),
  About, Sign Out.

The result is that where you click to reach your own profile depends on which half of the app you
are standing in, and several links are owner-gated for no reason a user can see.

## User-facing description

As a signed-in user, I want the same personal destinations in whichever avatar menu is in front of
me, so that I do not have to know which half of the app I am in to get to my own things.

## Acceptance criteria

**Both menus**

- [ ] Given a signed-in user on any page carrying either avatar menu, when the menu is opened,
      then a personal section offers all five of: **My Profile**, **My Assistant's Profile**,
      **My Treasure Map**, **My Trusted Agents**, **Dictionaries**.
- [ ] Given the same, then a **visually separate** section offers all three of:
      **Brainstorm Landing Page**, **Tapestry Dashboard**, **Legacy Dashboard**.
- [ ] Given a signed-in user whose classification is `customer` or `guest`, when either menu is
      opened, then every one of those eight items is present — none is owner/admin-gated.
- [ ] Given a signed-in user with no provisioned assistant key (`user.assistantPubkey` is null),
      when either menu is opened, then **My Assistant's Profile** is still present but disabled,
      and carries a tooltip explaining that no assistant is provisioned yet.
- [ ] Given a signed-out visitor, when the menu area renders, then behavior is unchanged from
      today (Main: "Sign in with nostr"; Tapestry: "Sign in with Nostr").
- [ ] Given the **Legacy Dashboard** item, when it is activated, then the browser performs a full
      page load of `/legacy/` — not an SPA navigation, which would 404 into `NotFound`.

**Per-menu targets**

- [ ] Given the **Main** menu, then My Profile → `/user/<my pubkey>` and My Assistant's Profile →
      `/user/<assistant pubkey>` — the same profile page search results link to.
- [ ] Given the **Tapestry** menu, then My Profile → `/tapestry/users/<my pubkey>` and My
      Assistant's Profile → `/tapestry/users/<assistant pubkey>` — unchanged from today.
- [ ] Given either menu, then My Treasure Map → `/tapestry/grapevine/trusted-assertions`,
      My Trusted Agents → `/tapestry/trusted-agents/mine`, and Dictionaries →
      `/tapestry/dictionaries`.

**Preserved**

- [ ] Given the Main menu, then the existing POV switch, Your pins, Settings and Sign out remain,
      and the POV switch behaves exactly as before.
- [ ] Given the Tapestry menu, then About and Sign Out remain.
- [ ] Given any Legacy page, then its navigation is untouched.

## Concepts touched

None.

## Out of scope

- Legacy page navigation — explicitly excluded by the operator.
- Changing what `/tapestry/*` shows to non-owners. The Tapestry Dashboard already renders a
  degraded view for them; making that view good is separate work.
- The owner/admin gate on **Settings** in the Tapestry menu. The operator's list did not include
  Settings, and un-gating a settings surface is a different decision from un-gating navigation.
- Any change to the POV switch.

## Open questions

None. The no-assistant-key case was settled at intake (show, disabled, tooltip).

## Linked artifacts
- ADR: none (abbreviated path)
- Test plan: none (abbreviated path)
- Review: `engineering-team/reviews/navigation-scaffolding/2-unified-avatar-menus.md`
