# PRD Seed: Who may operate an instance — the owner's side, and what everyone else may do

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/admin-action-owner-check/audit.md`
**Anchor:** acceptance frame in `book.md`
**Confidence:** high for the access rules: they are grounded in the frame and in the owner's gate decisions, and they
shipped. The product framing (vision, personas, what people who can't act should see) is `[INFERRED]` scaffolding to
accept or discard.
**Date:** 2026-10-11

> Reverse-engineered baseline in PRD shape, from what shipped. This book was an **access-control sweep**, not product
> discovery. The rules are solid `[FROM FRAME]`. The rest is a strawman the product team validates before it becomes a
> real PRD. It extends `audits/negentropy-sync-access/prd-seed.md`, whose first open question this book answered.

## 1. Product vision
- `[FROM FRAME]` The owner's words: "sweep first, as a story". Every action that changes the instance or starts heavy
  work on it is the owner's, the admins' and the instance's own scripts', unless the owner has opened it to others on
  purpose. The next action someone adds is closed until someone decides otherwise, instead of open until a review
  notices.
- `[INFERRED]` A Brainstorm instance is run by its owner. Anyone can sign in with any nostr key, so being signed in
  means "a known key", not "trusted". What a signed-in person may do on someone else's instance is reading, publishing
  what they signed themselves, and a short list of actions on their own things.
- `[FROM FRAME]` This is about who may operate the instance's machinery (its relay, graph, search index, keys, settings,
  scheduled work and the events it signs as itself), not about whose assertions count for a point of view. Principles
  1–3 still govern that, and anyone may still publish an event they signed (principle 2).
- `[UNKNOWN — product input needed]` Whether open sign-in itself should stay (carried from the earlier seeds).

## 2. Personas
- `[FROM FRAME]` **Owner.** Runs the instance; may take every action.
- `[FROM FRAME]` **Admin.** Appointed by the owner; equal to the owner everywhere except two things: signing arbitrary
  content as the instance's assistant, and changing the admin list. *(Owner's decision at the Architecture gate.)*
- `[FROM FRAME]` **The instance's own scripts** (direct-local callers: loopback scripts, scheduled jobs, the
  firmware-install bridge). Keep every action.
- `[FROM FRAME]` **Signed-in person.** Any nostr key. May read, publish events they signed, run the point-of-view sync,
  and act on their own things: their preferences, their own Assistant (profile, avatar, relay list,
  identification taggings, curated lists, list headers, concept headers), refreshes of the Trusted Lists for their own
  pins, and two legacy kind 10040 flows. Everything else answers 403.
- `[INFERRED]` **Customer.** A signed-in person this instance hosts with their own Assistant. Gets no more than other
  signed-in people, except provisioning their own Assistant's key and three reads that other signed-in people are
  refused (the customer-or-owner quirk). Lost the self-reset of their algorithm preset in this book.
- `[FROM FRAME]` **Visitor.** Not signed in. May read, publish events they signed, run the sign-in handshake, and query
  the read backbone. Everything else answers 401.
- `[INFERRED]` **Anti-persona: a stranger who signs in** to wipe, rewrite, reconfigure or overload an instance they do
  not own, or to make it sign things as itself.

## 3. Scope (as-built)
- `[FROM FRAME]` **In scope, shipped:**
  - Every route the instance serves is sorted as a read, an owner's-side action, or an allowlisted action.
  - Actions outside the allowlist refuse everyone but the owner's side: 401 not signed in, 403 signed in, whatever the
    method or spelling.
  - One allowlist per deployment, each entry saying who and why, approved by the owner entry by entry.
  - Reads unchanged, except two sensitive reads the owner closed (the config peek, the export list and download).
  - A gate test that fails, naming the route, when a route is added unsorted.
  - The bare 403 for people who can't act; no page changed.
  - Shipped on production, `staging` and both sandboxes in one round.
  - `[INFERRED]` Request values no longer reach a shell in the handlers batch 0 fixed.
- `[INFERRED]` **Out of scope (deferred):**
  - Hiding or disabling the controls people can't use (a follow-up story the owner asked for).
  - The customer-or-owner quirk.
  - Case-sensitive routing as a second safeguard.
  - Rate limits on allowlisted actions; open sign-in.
  - Three findings from the sweep, by ledger id only: `2026-10-10-cross-site-request-settings-review`,
    `2026-10-10-public-read-follow-up`, `2026-10-11-sandboxes-lag-staging-safeguards`.

## 4. Domain model
`[INFERRED]` No concept-graph concepts, event kinds or firmware were touched. The entities this book's rules are about:
- **Route**: a method and a path as registered. Each has an **access level** (`public`, `signed-in`, `owner`,
  `owner-only`) and a **kind** (`read` or `action`).
- **Action**: a route that changes anything the instance keeps or starts heavy work, whatever its method. **Read**: one
  that changes nothing and starts no heavy work. Method alone does not decide it: some GETs act, and some POSTs only
  read.
- **Allowlist**: the `public` and `signed-in` actions, each with a `why`. One per deployment, because each serves
  different routes.
- **Role**, as the request carries it: owner; admin; signed-in person (customer or not); visitor; direct-local caller.
- **Refusal**: 401 or 403, with a short error naming who may act.
- **Parameter rule**: a narrower check inside one action's handler (signing as the assistant; the admin list).

## 5. Design rules (as-built)
- `[FROM FRAME]` Not signed in → 401; signed in but not allowed → 403. The error says who may act, for example "Only the
  owner or an admin can do this."
- `[FROM FRAME]` Default-deny: what the table does not open is the owner's side's, and an API path no route serves
  answers a refusal, not a 404.
- `[FROM FRAME]` What people who can't act see is the bare 403 for now. **No rule was ever recorded** for how a page
  should treat a control its viewer can't use. Today these stay visible and answer 403: the DList page's Publish Trusted
  List and sync-to-Neo4j buttons, the legacy self sign-up as a customer, Relay Settings' sync panel and the task
  explorer's Run buttons.

## 6. Carry-forward & open questions
Promoted from the build audit §6:
- what people who can't act should see (the follow-up story);
- the customer-or-owner quirk;
- the gate's blind spot for routes added to the entrypoint file;
- a live confirmation that the instance's own scripts still work;
- small cleanups (a duplicate route registration, a confusingly named check, a missing API reference entry);
- case-sensitive routing;
- three open findings, by ledger id only;
- keeping each sandbox's route table in step with `staging`;
- io-import verification;
- open sign-in and rate limits.

See audit §6 for the linked register.

## 7. What product must validate
- [ ] **Hidden or disabled?** For the controls people can no longer use (listed in §5): hide them, or show them
      disabled with a short explanation? The owner chose the follow-up story; its form is open.
- [ ] **The customer-or-owner quirk.** A signed-in person who is neither the owner's side nor a customer is refused the
      read backbone and the two customer reads, which visitors get. Keep, widen or narrow?
- [ ] **Customers' own things.** Should customers get back the self-reset of their algorithm preset, or other
      self-service, as allowlist entries?
- [ ] **Open self sign-up as a customer.** The legacy pages offer it; it is now the owner's side's. If an owner runs open
      sign-up, it needs an allowlist entry.
- [ ] **The judgment-call entries.** Three allowlisted actions are not strictly "your own thing": two have the instance's
      assistant sign a Trusted List for your pin, and one schedules an instance-wide refresh. Keep them open?
- [ ] **Open sign-in and rate limits.** Should any nostr key keep being able to sign in, and should the allowlisted
      actions and publishing one's own events be rate-limited?
