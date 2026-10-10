# PRD Seed: Who may make an instance sync with other relays and run its tasks

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/negentropy-sync-access/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for the access rules, which are grounded in the frame and shipped. The product framing (vision,
personas, what people who can't act should see) is `[INFERRED]` scaffolding to accept or discard.
**Date:** 2026-10-10

> Reverse-engineered baseline in PRD shape, from what shipped. This book was a run of **access-control fixes**, not
> product discovery. The rules are solid `[FROM FRAME]`. The rest is a strawman the product team validates before it
> becomes a real PRD.

## 1. Product vision
- `[FROM FRAME]` The owner's words: "The negentropy sync should be able to be managed by the owner and by admins."
  People who sign in to use search keep bringing their own point of view's scores to the instance.
- `[INFERRED]` What an instance does with other relays and with its own scheduled work is the owner's to control,
  together with the admins the owner appoints. Signing in is open to any nostr key, so being signed in means "known
  key", not "trusted".
- `[UNKNOWN — product input needed]` What, in general, an ordinary signed-in person may do on someone else's instance
  beyond reading and the POV sync. The admin-action sweep (audit §6 #1) will need that stance.

## 2. Personas
- `[INFERRED]` **Owner.** Runs the instance and manages syncs, presets, tasks and schedules.
- `[INFERRED]` **Admin.** Appointed by the owner. In every surface this book touched, an admin can do what the owner can
  (`isOwner` is the owner-or-admin alias).
- `[FROM FRAME]` **Signed-in person.** Any nostr key. Uses Brainstorm Search, Search Preferences and Brainstorm Settings,
  which download one author's kind 30382 Trusted Assertions so a chosen point of view's scores reach this instance.
- `[FROM FRAME]` **Visitor.** Not signed in. Cannot start, count against or watch a sync, start or schedule a task, or
  read the saved presets. (What a visitor can still reach elsewhere is the sweep's to inventory, audit §6 #1.)
- `[FROM FRAME]` **The instance's own scripts** (direct-local callers). They run syncs and tasks over loopback and must
  keep working.
- `[INFERRED]` **Anti-persona: a stranger who signs in** to point the instance at a relay of their choosing, push its
  events elsewhere, or start and schedule its heavy work.

## 3. Scope (as-built)
- `[FROM FRAME]` **In scope, shipped:**
  - The owner, admins and direct-local callers run any negentropy sync.
  - Other signed-in people run only the POV sync.
  - Everyone else is refused a sync: 401 when not signed in, 403 when signed in.
  - The saved presets, and their list, are the owner's and admins'.
  - The central auth check holds however a path is capitalized and for HEAD as for GET.
  - Starting a registered task and changing the schedule are for the owner, admins and direct-local callers.
- `[INFERRED]` **Out of scope (deferred):**
  - The remaining admin actions with no owner check of their own (the sweep).
  - Which relays the POV sync may name, and how long it may hold the instance's one sync slot.
  - Case-sensitive routing as a second safeguard.
  - What the UI shows to people who can't act.
  - Whether task status and history stay public.

## 4. Domain model
`[INFERRED]` No concept-graph concepts, event kinds or firmware were touched. The entities this book's rules are about:
- **Role**, as the request carries it:
  - owner or admin (a signed-in session whose key the instance's configuration names);
  - signed-in person (any verified key);
  - visitor (no session);
  - direct-local caller (loopback, with no proxy header).
- **Sync request**: relay, direction (`down`, `up`, both) and filter. The **POV sync** is one fixed shape: direction
  `down`, filter exactly one kind (30382) and one author (lowercase hex).
- **Saved preset**: a named sync request with its last results. Owner and admins.
- **Registered task**: one of the instance's named jobs (recomputes, exports, syncs), started on demand or on a
  **schedule**. Owner and admins.
- **The access check**: a central check in front of every API path, plus guards on individual routes. A refusal says
  401 or 403.

## 5. Design rules (as-built)
- `[FROM FRAME]` Not signed in → 401; signed in but not allowed → 403. No route answers an anonymous visitor's request
  to sync.
- `[INFERRED]` Refusals carry a short error. The sync routes' error says who may act ("Only the owner or an admin can
  run this sync.").
- `[INFERRED]` **No rule was ever recorded** for how the UI treats people who can't act. Today:
  - Relay Settings' sync panel and the legacy control panel's sync buttons stay visible and answer 403;
  - the task explorer's Run buttons stay visible and answer 403;
  - the Settings pages check for the owner in the browser.

## 6. Carry-forward & open questions
Promoted from the build audit §6:
- the admin-action sweep, the owner's chosen next story;
- the POV sync's relay scope, slot and answer;
- case-sensitive routing;
- the reviews' open polish and test gaps;
- unguarded future sync routes;
- what people who can't act should see;
- whether task reads stay public.

See audit §6 for the linked register.

## 7. What product must validate
- [ ] **The default for administrative actions.** Is it "owner and admins" everywhere, and which actions, if any, should
      customers or ordinary signed-in people keep? The sweep's Architecture needs this before it classifies routes.
- [ ] **The POV sync's relays.** Any relay, or public relays only? And how much of the instance's one sync slot may one
      person hold (a per-person limit, or a separate slot)? (ledger `2026-10-10-pov-sync-relay-scope`)
- [ ] **What people who can't act should see.** Hidden, disabled with an explanation, or the bare 403: for Relay
      Settings' sync panel and the task explorer's Run buttons.
- [ ] **Task reads.** Should task status, history and schedules stay public, like the other task dashboards?
- [ ] **Is "admin" a role with its own powers, or the owner's equal?** In this book's surfaces admins equal the owner.
      Whether some actions should stay owner-only was never decided (OPEN.md row 269 is one place the two differ on
      paper).
- [ ] **Open sign-in.** Should any nostr key keep being able to sign in? It is the premise that makes "signed in" mean
      "not trusted". The question was carried from the `auth-signature-verification` seed and is still not a recorded
      product decision.
