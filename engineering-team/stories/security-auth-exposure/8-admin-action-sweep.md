# Story 8: Every admin action checks who is asking — the sweep

**Status:** Approved
**Created:** 2026-10-10
**Type:** Bug (security / access control)
**Epic:** `security-auth-exposure`
**Book:** `audits/admin-action-owner-check/`

## Background

**The class.** Default-deny (story 2, ADR `security-auth-exposure/0002`) refuses visitors who are not signed in when
they send a mutation method (POST, PUT, PATCH, DELETE). A signed-in session, though, passes the central access check
for any route unless that check's lists name the route, a guard is mounted on it, or its handler checks the caller
itself. Sign-in is open to any nostr key, so being signed in means "a known key", not "trusted". The result is two
groups of exposed routes, both still open on production:

- **admin actions without an owner check of their own** — they run for any signed-in person;
- **GET routes that act or start heavy work** — the owner-only list matches POST only (story 7, Out of scope), and a
  GET is not a mutation by method.

ADR 0002 recorded the first group as out of its scope (its Consequences, item b). The July intake entry scoped the
class after one member was found and closed by hand. Its later addenda added more members and the GET half.

**Why a sweep, and why a guard against regressions.** On 2026-10-10 three stories in one book each found a hole the
hand-kept lists had missed: capitalized paths skipped the central check (story 5); any signed-in session could start or
schedule any registered task (story 6); HEAD skipped the GET checks (story 7). Each was fixed where it was found.
The owner decided to sweep the rest of the class at once, as its own story, rather than keep hotfixing members as they
turn up (book `negentropy-sync-access` decisions 10–11). A list nobody is forced to update will keep missing things,
so this story also asks for a check that fails when a new action is added without a guard.

**Already closed, and must stay closed:** the negentropy-sync routes (story 4), the task-control routes and the saved
presets list (story 6), and the two bypasses of the central check (stories 5 and 7).

**Carried into this story** from the last book's register (`audits/negentropy-sync-access/audit.md` §6):
- #1, the sweep itself, which also covers the POST-only owner list and a prefix overlap between two entries of the
  central check's lists (review 5, non-blocking 3; harmless today because the handler checks the caller itself);
- #5, a new sync route must remember its guard (ADR 0004 Consequences): the regression check (AC-6) covers it;
- the debt noted in §5: the owner and admin pass is shown today only through stand-ins, not against the real check.

OPEN.md row 276 (F4/F5) points at the same class.

**What this story is not about.** This is about who may operate the instance's machinery: its relay, graph, search
index, keys, settings, scheduled work and the events it signs as itself. It is not about whose assertions count for a
point of view; principles 1–3 govern that, and this story doesn't touch it. Anyone may still publish an event they
signed themselves (principle 2). Nothing locally authored in the graph may be lost to the fix (principle 4).

**Disclosure.** The repo is public, and members of this class are still open. This story, its test plan, its ADR and
its review name no still-open route, file, line or handler. The inventory with names is the Architecture's working
material, committed only together with the fixes it lists, or after they ship (book ground rule 1).

### Words used here

- **Action:** a route that changes anything the instance keeps (graph, relay, search index, keys, settings, files,
  schedules, events signed as the instance) or starts heavy work (a recompute, an import or export, a sync, a long scan,
  starting or stopping a service), whatever HTTP method serves it.
- **Read:** a route that changes nothing and starts no heavy work.
- **The owner's side:** the owner, admins (but see question e) and direct-local callers: the instance's own loopback
  scripts, its scheduled jobs and the firmware-install bridge.
- **Allowlist:** the explicit list of actions open to ordinary signed-in people, and within it the smaller list open to
  visitors who are not signed in. Each entry says who may use it and why.

## User-facing description

As the owner of a Brainstorm instance, I want every action that changes my instance or starts heavy work on it to be
mine, my admins' and my instance's own scripts', unless I have opened it to others on purpose. That way a stranger who
signs in with any nostr key, or doesn't sign in at all, can't wipe, rewrite, reconfigure or overload my instance, and
the next action someone adds is closed until someone decides otherwise, instead of open until a review notices.

## Acceptance criteria

- [ ] **AC-1 Signed-in people outside the owner's side are refused.** Given a signed-in person who is not the owner or
      an admin, when they call any action that is not on the allowlist, then they get 403 and the action does not
      happen: nothing changes and no work starts. This holds whatever method reaches the route (GET and HEAD included,
      not only POST, PUT, PATCH and DELETE) and however the path is spelled (capitalization included).
- [ ] **AC-2 Visitors are refused.** Given a visitor who is not signed in, when they call any action that is not on the
      visitors' part of the allowlist, then they get 401 and the action does not happen, under the same methods and
      spellings as AC-1.
- [ ] **AC-3 The owner's side loses nothing.** Given the owner, an admin or a direct-local caller, when they call any
      action, then it behaves as before. For the owner and an admin this is shown against the real access check, not
      only through a stand-in. For the instance's own scripts it is shown end to end: the firmware-install bridge and
      the loopback scheduled jobs still do their work.
- [ ] **AC-4 One explicit allowlist, approved by the owner.** Every action open to ordinary signed-in people or to
      visitors is on one allowlist, each entry naming who may use it and why. The owner approved the list before
      Implementation. Each entry still works for the people it names, including at least publishing an event the person
      signed themselves (principle 2) and the point-of-view sync (book `negentropy-sync-access` decision 2). No action
      outside the list is open to them.
- [ ] **AC-5 Reads are unchanged.** Every read answers as before to everyone it answered before, including the public
      reads the deploy procedure relies on. The only exceptions are reads the owner decides to close (question c).
- [ ] **AC-6 No route goes unsorted, now or later.** The inventory covers every route the instance serves, under every
      method and inside or outside the API prefix, and classes each one as a read, an owner's-side action or an
      allowlisted action. An automated check in the normal test gate fails, naming the route, when an action has
      neither an owner's-side guard nor an allowlist entry. This is shown by adding an unguarded action, once as a POST
      and once as a GET that acts: the check fails each time, and passes once the action is guarded or listed. The
      Reviewer re-derives the inventory from the code, not from the list.
- [ ] **AC-7 Refusals say who may act.** Each refusal is 401 (not signed in) or 403 (signed in, not allowed) with a
      short error that says who may take the action. Every API reference entry for an action guarded here states the
      rule and both answers, including the task-control entry story 6 left without one (audit §4 #8).
- [ ] **AC-8 What people who can't act see** is as the owner decides in question b, and every page that offers an
      action to someone who can't take it shows it the same way. *(If the owner chooses the bare 403, this criterion
      reads: no page changes.)*
- [ ] **AC-9 Shipped wherever it is live, without naming open routes first.** The fixes reach production, `staging`
      and both long-lived sandboxes (`feat/tags`, `feature-magic-carpet`) in the same round (ledger
      `2026-10-10-sandboxes-got-security-fixes`). After each deploy, a live check shows a visitor refused with 401 on
      at least one fixed action under a mutation method and at least one fixed GET that acts. No route is named in
      public before its fix is in production (question d decides whether that happens once or in batches).

## Concepts touched

None. No concept-graph concepts, event kinds or firmware change; no reinstall expected.

## Out of scope

- **Which relays the point-of-view sync may name**, and how long it may hold the instance's one sync slot (ledger
  `2026-10-10-pov-sync-relay-scope`).
- **Case-sensitive routing as a second safeguard**, and removing the central check's now-redundant sync entries
  (ledger `2026-10-10-case-sensitive-routing`), unless the Architecture finds the sweep needs them.
- **What an action does once the right caller reaches it.** Defects of that kind (for example OPEN.md row 276, F3)
  are separate.
- **Whether any nostr key may keep signing in** (`audits/negentropy-sync-access/prd-seed.md` §7, last question). This
  story takes open sign-in as given.
- **Rate limits** on allowlisted actions and on publishing one's own signed events.
- **Whose assertions count for a point of view** (principles 1–3). Not touched.
- **Operator-side companions** (the Neo4j password and ports), tracked in book `security-auth-exposure`.

## Open questions

Answered by the owner at the Planning gate (2026-10-10); each answer follows its question.

- **(a) What should ordinary signed-in people keep?** Two things are already decided: anyone may publish an event they
  signed themselves, and signed-in people may run the point-of-view sync. Beyond those, should a signed-in person keep
  any other action, for example actions on their own things (their own assistant, their curated lists) or starting a
  computation of their own point of view? Should customers (people this instance hosts with their own assistant) keep
  more than other signed-in people? And should visitors who are not signed in keep anything beyond what they have
  today? *Suggestion: owner's side by default everywhere. The Architecture proposes keeping only what pages already
  offer ordinary signed-in people and customers for their own things, and the owner approves each entry.*
  **Decided:** the owner's side by default everywhere; the Architecture proposes allowlist entries and the owner
  approves each one.
- **(b) What should people who can't act see?** On pages that offer an action to someone who can't take it (today, for
  example, Relay Settings' sync panel and the task explorer's Run buttons), should the control be hidden, disabled
  with a short explanation, or left as is so a click gets the bare 403? *Suggestion: the bare 403 in this story,
  which keeps the fix server-side and the release smaller, with a follow-up story to hide or disable the controls
  everywhere at once.*
  **Decided:** the bare 403 in this story; a follow-up story handles the controls. AC-8 therefore changes no page.
- **(c) Should task status, history and schedules stay public reads?** They are public today, like the other task
  dashboards, and story 6 left them so. They show what the instance runs, when it runs it, and how runs went.
  *Suggestion: no suggestion; this is a product call about how much of the instance's running state strangers may
  see.*
  **Decided:** keep them public. AC-5's exception list is empty.
- **(d) One release, or batches?** One release keeps every open route unnamed until all of them are fixed, but the worst
  ones wait for the slowest. Batches, most serious first, close the worst sooner, but each batch names its own routes
  when it ships, which tells readers that the rest of the class is still open. *Suggestion: batches by seriousness,
  each recorded in the commit that fixes it, if the inventory turns out large; one release if it is small. The
  Architecture reports the size first.*
  **Decided:** as suggested: the Architecture reports the inventory's size first; batches by seriousness if it is
  large, one release if small.
- **(e) Is "admin" the owner's equal for all of these?** Wherever the earlier stories decided, admins can do what the
  owner can. One place where the record says owner-only while admins can act is OPEN.md row 269: signing any event as
  the instance's assistant. Should some actions stay owner-only, for example the most destructive ones, or those
  that act with the instance's own identity? *Suggestion: admins equal the owner by default; the
  Architecture flags each action where that is doubtful, and the owner decides those one by one. Row 269 is settled in
  the same decision.*
  **Decided:** as suggested: admins equal the owner by default; the Architect flags doubtful actions (the most
  destructive, or those acting with the instance's own identity) for the owner to decide one by one, settling row 269.

## Linked artifacts

- Book: `engineering-team/audits/admin-action-owner-check/book.md`
- Intake: `engineering-team/stories/_intake.md`, entry 2026-07-21 (security-auth-exposure phase 2) and its addenda
- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
