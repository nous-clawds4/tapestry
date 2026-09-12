# Epic: Assistant Profile — one page, one default, an honest setup check

**Status:** Open
**Created:** 2026-09-11
**Book:** `engineering-team/audits/assistant-profile/book.md` (no PRD — acceptance frame)
**Provenance:** the Assistant Profile feature shipped outside the harness on 2026-05-24
(`stories/_intake.md`, "2026-07-02 — Provenance backfill: Assistant Profile feature"); ta-avatar #2–#3
later changed its default picture and name. This epic starts from that record plus the 2026-09-11
survey below.

## What this is

Every Owner, Admin and Customer has an **assistant** — a server-held nostr identity that signs
automated events on their behalf (BIBLE, "Assistant Keys"). The Owner's assistant is the instance's
Tapestry Assistant (TA). Each of them can manage their own assistant's kind 0 profile.

Today that capability is spread over four writers with three different default profiles, and its
"does my assistant need setting up?" check gives false answers: on 2026-09-11, every hard load of the
dashboard on staging and on prod told visitors the assistant "doesn't have a face yet" while its
profile sat on five relays. This epic consolidates the feature — one page, one default, one setup
check — and makes publishing reach the right relays with an honest result for each.

## Stories

`stories/assistant-profile/` — ordered by value and dependency. Phase path: all five phases for each
(Standard; neither bug is an obvious fix).

1. **setup-prompt-tells-the-truth** (Bug) — the "set up your Assistant" prompt appears only when the
   viewer's own assistant truly has no profile, and every surface gives the same answer. First,
   because it is the visible, live defect.
2. **publish-to-the-right-relays** (Bug) — the profile goes to the relays the instance is configured
   for (a set that includes every relay the setup check reads), honors local-only publish mode, and
   reports each relay truthfully.
3. **one-default-assistant-profile** (Feature) — one definition of the default profile for every
   role and every publish path, per the spec ratified below.
4. **my-assistant-page** (Feature) — the single "My Assistant" page that every entry point leads to.
5. **one-writer-for-assistant-profiles** (Feature) — retire every other way to write an assistant's
   kind 0: the dashboard's "Surprise me", the legacy NIP-85 / customer page panels, and the generic
   sign-as-assistant path for kind 0.

Dependencies: #1 stands alone (its check reads the publish relays; until #2 ships that means today's
list). #2 and #3 stand alone. #4 is where #1's prompt lands and where #2's result and #3's defaults
appear. #5 follows #4, because the surfaces it retires point at the page.

## Decisions ratified at Planning (2026-09-11)

1. **One dedicated page.** A new "My Assistant" page for every signed-in role that has an assistant;
   both Settings areas, the dashboard prompt, the assistant profile-page banner and both avatar menus
   link to it. *(Chosen from: a dedicated page / the Brainstorm `/settings` card / the Tapestry
   Settings tab opened to Customers / edit-in-place on the assistant's profile page.)*
2. **The default profile** — specified by the owner; quoted in full in story 3:
   - name and display name: "‹name›'s Tapestry Assistant"; with no name, "npub...‹last 6 characters
     of the npub›'s Tapestry Assistant";
   - about: two paragraphs, verbatim in story 3;
   - picture: the branded Tapestry Assistant avatar, always;
   - website and NIP-05: only when the instance is a public website;
   - a `["client", "‹instance domain›"]` tag on the event, on a public instance.
3. **The setup check: the local relay first, then the publish relays.** Only this instance holds an
   assistant's key, so a genuine profile starts on the local relay; the publish relays cover a wiped
   or restored local relay, and a profile found there is copied home. The prompt appears only when
   neither has one. *(Chosen from: local then publish relays / local only / every configured relay.)*
4. **Everyone manages their own assistant.** The Owner manages the instance TA; Admins and Customers
   manage theirs. Admins therefore lose their only current route to changing the TA's profile (the
   dashboard's "Surprise me"). *Stated at planning as a working assumption; confirmed at story
   approval (2026-09-11).*
5. **Editable fields stay as they are** — name, display name, about, picture, banner, website,
   lightning address; NIP-05 stays server-managed and read-only, because it must match this
   instance's `nostr.json`. *Confirmed at story approval (2026-09-11).*
6. **The stories' open questions, resolved at approval (2026-09-11)** — all taken as proposed:
   - setup check: with an empty local relay and unreachable publish relays, the local relay's answer
     stands and the prompt appears (story 1);
   - publish set: the configured general-purpose, profile and WoT relay lists; the sibling Tapestry
     instance relays are left out (story 2);
   - default picture on a non-public instance: the reference deployment's
     `https://tapestry.brainstorm.world/ta-avatar.png` (story 3);
   - the no-name fallback reads `npub...‹last 6›'s Tapestry Assistant`; the about opens with
     "‹name› (‹npub›)"; the kind 10040 sentence is always included (story 3) — with a known caveat:
     one kind 10040 names one assistant per list across all of a person's instances, so the sentence
     can be false for some of their assistants (OPEN.md #267; on 2026-09-11 the owner's 10040 named
     staging's TA, not production's);
   - "My Assistant's Profile" in both avatar menus opens the My Assistant page, superseding
     navigation-scaffolding #2's destination for that item (story 4).

## Key facts / guardrails

- **"Whose assistant?" is this epic's POV question.** Every surface resolves the *viewer's* assistant
  (`user.assistantPubkey`), never the instance TA by default. Showing the Owner's TA to an Admin or a
  Customer is the defect class of OPEN.md row 188 (fixed for the treasure map by
  treasure-map-user-assistant #1) and the root of story 1's "wrong assistant" finding.
- **The TA pubkey is per-deployment** — resolved at runtime, never hardcoded (CLAUDE.md house rule).
- **Publishing stays user-consented.** Nothing in this epic rewrites an already-published profile;
  changes reach nostr only when the user (re-)publishes. Existing profiles — staging's pre-ta-avatar
  default, prod's hand-customized one — are untouched until then.
- **Local-first (BIBLE §30).** The local relay is the first source for an assistant's profile.
  Copying a validly-signed profile found on a publish relay back to the local relay is a cache repair,
  not a write on anyone's behalf.
- **Degrade honestly** (carried from ta-avatar): nothing dead, loopback, private-network or relative
  is ever published by the app.

## Survey — the feature as built (2026-09-11)

Method: two read-only code sweeps (UI; server + relays), each finding re-checked against the source;
the live `/api/assistant/status`, `/api/profiles` and `/api/relays` endpoints on local, staging and
prod; a read-only `nak` probe of the instance and public relays (with a control profile to tell a dead
relay from a missing event); and a hard load of `/tapestry/` on staging and prod in a browser.

### Writers — everything that can change an assistant's kind 0

| Surface | Reachable by | Assistant written | Route | Relays written | Defaults |
|---|---|---|---|---|---|
| Tapestry Settings → 🤖 Assistant Profile (`/tapestry/settings/assistant`) | Owner, Admin (UI gate, `ui/src/pages/settings/Index.jsx:33`) | Owner: the TA · Admin: their own | `POST /api/assistant/publish-profile` | local (`strfry import`) + 5 hardcoded | server's |
| Brainstorm `/settings` card — the same `AssistantProfileEditor` | any signed-in user (`ui/src/pages/BrainstormSettings.jsx:396`); the only in-app route for Customers | their own | same | same | server's |
| Dashboard "🎲 Surprise me" (`ui/src/pages/Dashboard.jsx:751-779`) | Owner, Admin | always the TA | `POST /api/strfry/publish` with `signAs:'assistant'` | local only | its own literals |
| `/legacy/nip85.html`, `/legacy/customer.html` (served; not linked from the React UI) | anyone who has the URL and a qualifying session | the TA / a customer's | `publish-profile` **with no `content`** | local + 5 | server's — overwriting whatever was last published |

Read-only surfaces: `/tapestry/users/‹assistant›` (a "This is your Tapestry Assistant — Edit Assistant
profile" banner linking to the Owner/Admin-only tab), `/user/‹assistant›`, and "My Assistant's
Profile" in both avatar menus (to those two pages; navigation-scaffolding #2).

### Default definitions

- **Server** — `buildDefaultProfileContent` (`src/api/assistant/index.js:200`), two branches:
  - Owner: "‹owner›'s Tapestry Assistant" (else "Tapestry Assistant"); about "Server-side Tapestry
    Assistant for ‹owner›. Signs firmware events, concept graph nodes, …".
  - Customer **and Admin**: "‹name›'s Tapestry Assistant", falling back to "a customer's Tapestry
    Assistant" (OPEN.md #154); about "I am the Tapestry Assistant for ‹name›. My primary task is to
    publish kind 30382 Trusted Assertions …".
  - Both: the picture is gated on `isPubliclyReachable` (which admits RFC1918 — OPEN.md #148); the
    website and NIP-05 are not gated, so a dev instance's defaults carry `https://localhost:7777` and
    `…@localhost:7777` to five public relays. The person's name is read from the local relay only
    (`getKind0DisplayName`, `:82`), and a Docker instance pulls no kind 0 by default.
- **"Surprise me"** — `name: 'Tapestry Assistant'`, a different about, a robohash picture; no NIP-05,
  no website.
- **Legacy pages** — still call it the "Brainstorm Assistant" in their copy.
- In-app fallbacks for an assistant with no profile ("Tapestry Assistant", "🤖 Assistant (‹short›)")
  are presentation, not the event — out of scope here.

### Setup-state checks

| Where | "Set up" means | Source |
|---|---|---|
| Dashboard welcome card + "Give your Assistant a profile" checklist item (`Dashboard.jsx:25,63,722-728`) | the profile has a `name` or a `picture` | `/api/profiles` → `aProfileRelays` (purplepag.es, profiles.nostr1.com) with a 6 s race; the local relay only for misses, and **not at all if the race times out**; misses cached 5 min (`src/api/profiles/fetchProfiles.js:66-126`) |
| Editor "Currently published", and the legacy pages (`/api/assistant/status`, `src/api/assistant/index.js:411-442`) | any kind 0 exists | the local relay only |

Dashboard defects: (a) **the `pubkeys=null` race** — the check runs in an effect with empty deps that
reads `taPubkey` before `ConfigContext` has resolved it, so a hard load asks about `null` and never
re-asks; reproduced on staging and prod 2026-09-11 (`GET /api/profiles?pubkeys=null` in the network
log; card and unchecked item shown while each TA's profile was live); (b) it always checks the TA,
for every viewer including logged-out visitors — an Admin's "Set up" lands on *their own* assistant's
editor, which can never clear a prompt about the TA, and a Customer's lands on an Owner/Admin-only
page; (c) a relay timeout skips the local fallback; (d) a cached miss outlives the publish that
should clear it (and `useProfiles` caches `null` for the page session).

### Relays

- **Publish** — local + a hardcoded `EXTERNAL_RELAYS` (`src/api/assistant/index.js:26-32`):
  relay.primal.net, relay.damus.io, nos.lol, wot.grapevine.network, purplepag.es. Not read from
  `aRelays`; ignores `BRAINSTORM_PUBLISH_LOCAL_ONLY`; returns `success: true` even at 0/5.
- **Read for the dashboard check** — `aProfileRelays`; only purplepag.es is in both lists.
  profiles.nostr1.com is read from and never written to (it aggregates, which is why profiles appear
  there).
- **Docker's strfry router** has no kind-0 stream enabled by default (the `userProfiles` preset ships
  `defaultEnabled: false`), so the local relay holds what this instance published and nothing else.
- **Observed 2026-09-11** (read-only `nak`): each TA's profile is on its own instance relay, nos.lol,
  purplepag.es, profiles.nostr1.com and wot.grapevine.network; each instance's customer assistant is
  on the same set minus purplepag.es. relay.damus.io and relay.primal.net were inconclusive — they
  returned nothing even for the control profile from the probing host. relay.nostr.band timed out;
  wot.brainstorm.social (a configured WoT relay) serves an expired TLS certificate (OPEN.md #270).
- **Live profiles** — staging TA: "Tapestry Assistant", no picture (2026-07-12, before ta-avatar);
  prod TA: hand-customized; prod's customer assistant publishes a NIP-05 on `@brainstorm.world`,
  which stopped verifying at the domain cutover (NIP-05 is baked in at publish time); local TA: none,
  anywhere — so the local prompt is correct.

### Other defects found (assigned to stories)

- An Admin can rewrite the TA's kind 0 via "Surprise me": the generic endpoint's `isOwner` is
  `isOwnerOrAdmin` (`src/middleware/auth.js:276-293`), though `publish-profile` refuses Admins for the
  TA → story 5 (the wider question → OPEN.md #269).
- A relative picture URL (`/generated/…`, `/ta-avatar.png`) can be published from a non-public
  instance (`ui/src/components/AssistantProfileEditor.jsx:129,140`) → story 3.
- The badged-avatar generator is refused for Customers but reports "no profile picture to stamp";
  for Admins it stamps the Owner's face → story 4.
- An Owner with a missing key sees Customer copy (the status early-return omits `isOwner`,
  `index.js:399-401`); `provision-key` would then store the Owner's new key in a slot
  `getAssistantKeys(owner)` never reads → story 4 (copy); the slot itself is key lifecycle (Deferred).
- The publish message says "Tapestry Assistant profile published" to Customers (`index.js:369`) →
  story 2.

## Deferred / out of scope

- **Key lifecycle** — Admin auto-provisioning, deprovisioning, the Owner slot re-key:
  `stories/_intake.md`, 2026-08-10.
- **The TA ↔ owner two-way handshake** — `stories/_intake.md`, 2026-08-09. Story 3's about text
  points one way ("You can find my pubkey in my owner's kind 10040 event"); the wire-level claim
  stays with that entry.
- **Auto-republishing existing profiles** to adopt the new default.
- **A "needs attention" state** for a published-but-stale profile (for example a NIP-05 on a domain
  that no longer serves it) — a candidate follow-up to story 1.
- **A kind 10002 relay list** for assistants.
- **Unifying in-app display fallbacks** for assistants with no profile.
- **Customer-assistant composites and badging** (ta-avatar carry-forward).
- **Admins minting any TA-signed event** through the generic endpoint → OPEN.md #269.
- **Dead or broken relays in the default relay lists** → OPEN.md #270.
- **One kind 10040, several instances** — which assistant a person's Treasure Map names when they have
  one per instance → OPEN.md #267 (filed by the `my-curated-dlists` book; affects story 3's about
  sentence).

## ADRs

`decisions/assistant-profile/` — created per story at Architecture.
