# PRD Seed: Outbox Relays — where your Assistant says its events can be found

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/assistant-outbox-relays/audit.md`
**Anchor:** the acceptance frame in `book.md`: the owner's ask, quoted verbatim, and seven decisions taken at intake and at story approval. There was no Discovery conversation (book Decision 5).
**Confidence:** **high** for what shipped and why; **medium** for how it reads to a person. It is deployed to `staging.brainstorm.world` and its anonymous surfaces were checked there, but nobody has yet published a list as a real Assistant on any live instance, and it is not on production.
**Date:** 2026-10-09

> This is a reverse-engineered baseline in the product-team PRD shape. It is a **strawman for the product team**, not a ratified spec. Sections are tagged `[FROM FRAME]`, `[INFERRED]`, or `[UNKNOWN — product input needed]`.
>
> **Read the confidence honestly.** The frame is short and was settled in four intake questions and two approval questions, not a Discovery conversation. Two product questions were therefore answered by engineering defaults and should be looked at:
> - what "suggested relays" should mean beyond "where the Assistant already publishes";
> - whether the hub's growing action list needs grouping.

## 1. Product vision

`[FROM FRAME]` A Tapestry Assistant publishes on its person's behalf around the clock. Its NIP-65 relay list (kind 10002) is how other nostr clients and apps learn where to find what it publishes. The hub's "Your Assistant's Public Persona" section gains a third card, **Outbox Relays**. It is complete once the Assistant's relay list names at least one outbox relay, and it leads to a page where the person edits that list and has the Assistant publish it.

`[INFERRED]` With the profile and Identification Tags cards, this rounds out "how the outside world finds and recognizes your Assistant": who it is (kind 0), whose it is (the identification taggings), and where its events live (kind 10002).

`[UNKNOWN — product input needed]` Whether the list should also *drive* where the Assistant publishes. Today the list names relays, but the Assistant's other publishers (trusted assertions, trusted lists, DLists) still follow Relay Settings, not the list (epic § Deferred).

## 2. Personas

`[FROM FRAME]` / `[INFERRED]` from the stories and the page's states:

- **A signed-in person with an Assistant on this instance** (Owner, Admin or Customer):
  - sees the card marked until the list names an outbox relay, then Done;
  - edits the list on the page, from suggestions or by hand;
  - presses one button to have the Assistant publish it, and reads each relay's answer.
- **A signed-in person without an Assistant:** the hub's line and its link to Account Setup.
- **A visitor:** "Sign in to manage your Assistant's outbox relays." with the sign-in button.
- `[INFERRED]` **Other nostr clients and apps** that read the Assistant's kind 10002 to find its events. They read standard NIP-65; nothing Tapestry-specific is on the wire.
- `[INFERRED]` **The instance operator,** whose Relay Settings supply the suggestions and the relays a list is always sent to and read back from.

## 3. Scope (as-built)

`[FROM FRAME]` On `staging` and in production (2026-10-09, PR #829):

- **The card and its answer.** The eleventh hub action, after Identification Tags, with a NIP-65 link.
  - The answer is for the viewer's own Assistant only: the outbox relays its newest kind 10002 names, read from this instance's relay first, then the configured outside relays.
  - Done once the list names at least one outbox relay. The hub's Done badge is shared with every checked action.
- **The page.**
  - The Assistant's outbox relays, a count of inbox-only relays it leaves alone, and an on-screen draft with an "unpublished changes" line.
  - Add by hand, with refusals for non-relays, duplicates, more than 50 relays, and relays plainly not on the public internet.
  - **Suggested relays:** this instance's own relay at its public address, then the General Purpose, Trusted Assertion, Trusted List, DList and Outbox relay settings, minus private ones. One Add each, or Add all.
  - Remove per relay.
- **One publish.** One button has the instance sign the whole list as the person's own Assistant.
  - Relays already in the list keep their markers, added ones are outbox (`write`), inbox-only entries are kept, and removed relays are gone.
  - It is written to this instance's relay first, then sent out, and each relay's answer is shown. An empty outbox may be published (the card then needs attention again).
  - The page and hub re-check after a list is written.
- **Only public relays** (added at review, chosen by the owner). Private addresses are refused where they are typed and by the server. At send time a list relay is resolved within 3 s and never connected to unless every address is public; its line reads "not sent: not a public address".
- `[FROM FRAME]` **Not in scope:**
  - the inbox side and DMs;
  - publishing at Assistant creation or when Relay Settings change;
  - retries;
  - the person's own kind 10002;
  - making the other publishers follow the list.

## 4. Domain model

`[INFERRED]` from the ADRs and stored shapes:

- **Relay list** (NIP-65 kind 10002, replaceable, one per author). It is a list of **entries**, each `{ relay URL, marker: write | read | none }`, where none means both.
  - An **outbox relay** has marker none or `write`; an **inbox-only relay** has `read`.
  - Lists here hold at most 50 relays from the page; at most 100 entries are read from any list.
  - Each relay has one spelling: lower-case scheme and host, no default port, one trailing slash dropped.
- **The Assistant** (`39998:<TA>:nostr-user`): the signed-in person's own delegate, from the one main→delegate mapping (for the Owner, the instance TA). It signs the list; the session decides whose it is, never the request.
- **Relay settings** (`39998:<TA>:nostr-relay`, read from the instance's Relay Settings store): five lists supply suggestions, and three (General Purpose, Profile, WoT) are where a list is always sent and read back from.
- **The attention answer:** per action, `finished`, `done`, `pending`, a reason when unfinished, the outbox relays, the inbox-only count and the suggestions. It is re-derived on every request and never stored.

## 5. Design rules (as-built)

`[INFERRED]` from the shipped page and the reviews:

- **The hub and the page read one answer,** so the card, the page's mark, the count line and the Assistant Alert cannot disagree. The page fetches only to publish.
- **Two readings of an unfinished check:** the card and page stay marked until the check proves done; the pill counts only a finished check that found nothing.
- **An on-screen draft:** nothing is published until the one button. A reload discards edits, and a refresh of the answer rebuilds the draft.
- **Local first, honest reporting:** one summary line and one line per relay in the profile publish's words, with a tone mark. A refusal keeps the draft for another try.
- **The page wears the Identification Tags page's frame and cards** (`bs-idtags-*`). No design-guide rule was recorded for action pages beyond "styled like the hub".

## 6. Carry-forward & open questions

Promoted from audit §6:

- **Ship and see it.** Promote to production (blocked today by the parallel book's red tests on `staging`). Exercise the signed-in flow on staging: publish, read the report, watch the card turn Done and the pill drop.
- **The inbox side:** a page for `read` relays when the Assistant handles DMs.
- **When the list should be published:** at Assistant creation, or when Relay Settings change, rather than only on a press.
- **Whether the list should drive publishing:** the Assistant's other publishers following the relays the list names.
- **Lists made elsewhere:** inbox entries of a list held only on an outside relay can be lost if unreadable at publish time, and an outside-only list is not copied home.
- **Report wording edges:** a summary that blames empty settings when every list relay was "not sent"; a refusal that does not name the relay; a suggestions panel that goes quiet when the answer fails.
- **First-deploy weight:** until each Assistant publishes, every hub load reads the configured outside relays.
- **Security follow-ups owned elsewhere:** connect to the vetted address (closes DNS rebinding), and two IPv6 ranges the shared address guard misses.

## 7. What product must validate

- [ ] **What "suggested relays" should be.** Today: where the Assistant already publishes, from Relay Settings, plus this instance's relay. The intake's alternatives (popular relays; a fixed list) were declined, not tested with people. `[INFERRED]`
- [ ] **Outbox only.** Inbox-only entries are kept but not shown or edited, and "Remove" on a both-ways relay drops its inbox role too (book Decisions 3 and 6). Is that the right mental model for a person who never thinks about inbox and outbox? `[UNKNOWN — product input needed]`
- [ ] **Publishing an empty outbox with no confirmation** (book Decision 7). Is that ever a mistake worth catching? `[UNKNOWN]`
- [ ] **Refusing private relays.** A person running a home relay cannot list it. The rationale is security, and other clients could not reach it anyway; is the refusal's sentence enough explanation? `[INFERRED]`
- [ ] **The hub at eleven actions** and growing: the assistant-management intake asked how the hub groups actions "past ten". It is now past ten. `[UNKNOWN]`
- [ ] **The pill on first deploy** grows by one for almost every viewer, because no Assistant has a list yet. Is that the nudge wanted, or should Outbox Relays count only after something else is done? `[UNKNOWN]`
- [ ] **Should the list drive where the Assistant publishes** (vision § 1)? `[UNKNOWN]`
