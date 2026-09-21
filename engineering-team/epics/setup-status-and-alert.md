# Epic: setup-status-and-alert — the /setup page, live

**Status:** Open
**Created:** 2026-09-21
**Book:** `engineering-team/audits/setup-status-and-alert/book.md` (no PRD — acceptance frame)
**Provenance:** items 1 and 2 of the owner's deferred list from book `setup-page-scaffold`
(`stories/_intake.md`, entry "2026-09-20 — The /setup page, the rest of the way…"). Item 3, the
step pages themselves, stays in that entry.

## Goal

**`/setup` tells each signed-in person where they stand, and a persistent pill sends them there while
something is confidently left.** Today the page shows "0 of 3 complete" to everyone, and nothing
points people to it except the avatar menus' "Account Setup" link.

## Stories

`stories/setup-status-and-alert/`. All three take all five phases (Standard). #1 and #2 are
features; #3 fixes #2's review findings, and its same-tab refresh needs a design.

1. `1-setup-shows-where-you-stand.md`: each step on `/setup` shows done or not done for the signed-in
   viewer, by the rules ratified at planning. Signed-out visitors see the steps without marks and a
   prompt to sign in.
2. `2-the-setup-alert.md`: Brainstorm's "Finish setting up your account · N steps left" pill in the
   top bar of both halves of the app. It counts only the steps story 1 is *confident* are not done.
   Depends on #1.
3. `3-setup-alert-polish.md`: story 2's four review findings, fixed by the owner's calls:
   - dark text on the amber button, at 4.5:1 or better;
   - the pill announced exactly as it reads;
   - a re-check after the app publishes the viewer's follow list or Treasure Map;
   - hidden on the setup pages in any letter case.

   Depends on #2.

## What Brainstorm has

Upstream `NosFabrica/Brainstorm-UI` at `cde8f438`, read 2026-09-21. The predecessor epic
(`epics/setup-page-scaffold.md`) summarized `741be6b6`.

- **`client/src/hooks/useFinishSetup.ts`** is the one model behind every setup surface. It has two
  kinds of "not done": `*Done` is optimistic and drives the page, and `*Pending` is relay-verified
  and drives the pill.
  - **The contradiction the owner flagged has moved to line 68 against lines 69–71, unchanged in
    substance.** `activateDone` lets a local "activated" flag win, while the comment says a declared
    other provider should still be pending.
  - **At runtime the comment wins.** When the relay read finds a Map whose rank entry names a
    different assistant, `checkExistingTrustProvider` (`client/src/services/trustAnchor.ts`) clears
    the flag and returns `"other"`, so the step ends up pending and the pill nags.
  - **Brainstorm's bar for "activated":**
    - Strict path: rank and followers entries naming the user's assistant, at Brainstorm's NIP-85
      relay (`declaresTrustProvider`, `client/src/lib/nip85Declaration.ts`).
    - Fallback path: a rank entry naming the assistant, at any relay.
- **`client/src/components/FinishSetupBanner.tsx`** is the pill. Hidden when signed out, when nothing
  is left, and on `/setup*`. The full sentence and count show on desktop, the sentence alone on
  tablet, and "⚠ Finish setup →" alone on phones. The whole pill is one button, labelled "Finish
  setting up your account".
- **`client/src/pages/FinishSetupPage.tsx`**:
  - A done row is a green check, the label, a "Done" chip and one detail line. It is not a link,
    except the follow row's "Edit list".
  - A pending row is a clickable card.
  - When all three are done, a "You're all set!" card links on.

**Where Tapestry departs, by the owner's choice (book § Decisions):**
- Step 1 is "this instance holds an assistant for you", not "you are signed in".
- A Map naming another provider is shown as not done but never counted by the pill.
- Neither which relay a Map entry points to nor any Trusted List update is checked.
- Signed-out visitors keep the page.

## Key facts / guardrails

- **"Whose state?" is this epic's POV question.**
  - Every check is about the signed-in viewer: their pubkey, and the assistant this instance holds
    for them (`user.assistantPubkey`, which sign-in resolves through `getAssistantPubkeyFor`).
  - For the Owner, that assistant *is* the instance TA. For anyone else, a Map naming the instance
    TA names "another provider".
  - The TA pubkey is resolved at runtime, never hardcoded (CLAUDE.md house rule).
- **Read-only.** No check publishes, signs or stores anything. That includes the local relay:
  - no copy of an outside-found event into strfry (contrast assistant-profile ADR 0001's copy-home);
  - no Import button.
- **Two kinds of not done.** The page may show "not done" while a check is loading or has failed.
  The pill counts a step only on a finished answer. Signing-in answers step 1. Steps 2 and 3 are
  answered by an event found, or by none found after at least one outside relay was actually
  reached.
- **One provider per score.** Tapestry and Brainstorm both read the first `30382:rank` entry of a Map.
  The first-occurrence posture is written down for DList entries in
  `protocols/drafts/assistant-designation.md`. So a person signed in on several Tapestry instances
  can activate at most one of them, which is why the pill skips "another provider".

**Facts found at planning:**
- **This Mac Studio's Owner account (`15f7dafc…`)** has a Map, created 2026-09-18 and present on the
  local, staging and production relays.
  - It names NosFabrica's assistant (`4b7ba0a1…`, `wss://nip85.nosfabrica.com`) for rank and
    followers.
  - It names this machine's TA only for two DList entries.
  - So its step 3 is not done on this instance, and the pill will skip it.
- **The local relay holds about 2.37 million kind 3 events.** A local miss for a signed-in user's
  follow list is rare, but possible for someone who just published one elsewhere.

**What exists to build on** (facts for the Architect, not a design):
- **The viewer's Map:**
  - `ui/src/hooks/useTreasureMap.js` finds it: local strfry first, then the concept graph's
    "general purpose relays" set. It waits for that list, and an error is never read as "none".
  - The server-side `src/api/export/nip85/currentMap.js` reads a different set: the NIP-85 home
    relay, the trusted-assertion relays and the general-purpose relays from Relay Settings.
  - The 🍇 TA Treasure Map page runs its own search, which races its relay list (OPEN.md row 260).
- **The viewer's kind 3:**
  - The follow buttons' kind 3 read (`useProfileActions.js`, via `fetchFromRelays` in
    `ui/src/utils/nostrPublish.js`) uses a hard-coded relay list. It returns `[]` on any failure, so
    it cannot tell "no follow list" from "couldn't check".
  - `/api/relay/external?strict=1` answers only from relays proven reachable and reports which were
    not (curated-dlist-update ADR 0005 §1).
- **Relay configuration is split.** Relay Settings (`aRelays`: general-purpose, WoT, profile,
  trusted-assertion lists, and others) and the concept graph's relay sets are separate
  configurations. Which of them "the outside relays this instance is configured to read" means is
  the Architect's call.
- **The pill needs a home in several top bars.** There is no single Brainstorm Search shell:
  - the `TopBar` component, used by eight files, among them the landing page, which passes its own
    `UserMenu`;
  - fourteen pages that build their own top bar around `BrainstormUserMenu`;
  - the developer pages' top bar, whose sign-in slot is empty;
  - the control panel's `Header` (inside `Layout`).
- **Existing setup surfaces stay as they are:**
  - the Dashboard's Getting-Started checklist and its "I don't have a face yet" card (assistant
    profile, assistant-profile #4's territory);
  - Trusted Agents → Set Up;
  - the avatar menus' "Account Setup" link to `/setup`.
