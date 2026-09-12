# Book of Work: The assistant's profile — one page, one default, an honest setup check

**Slug:** assistant-profile
**Status:** Open
**Opened:** 2026-09-11
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — the owner's ask, restated at planning (2026-09-11). The decisions
taken at planning that shape it are recorded in the epic (`engineering-team/epics/assistant-profile.md`,
"Decisions ratified at Planning"), and the as-built survey that motivated them is in the same file.

> One of the existing features is that the logged-in user, whether Owner, Admin, or Customer, can
> manage the kind 0 profile of the Tapestry Assistant. I would like to do a survey of this feature
> and fix a few problems with it. First of all: there is no single place to do it; there is more
> than one place. It would probably be better to have just one page to perform this function.
> Second: they do not have a uniform definition of the default state of the Assistant's event. We
> should review, first of all, what that default state should be, and secondly, which details we
> want the user to be able to edit. Third: let's make sure that the user is presented with accurate
> information regarding whether the Assistant's profile needs to be set up. I have seen instances
> when I am prompted to set up my Assistant's profile even though I think it's already set up. This
> might be caused by something as simple as we're not checking all of the proper relays. So we will
> want to make sure that when the Assistant's profile is published, it is to the right relays; also,
> we want to make sure that we consider whether we should check all of them, or only check the local
> relay, when ascertaining whether it needs to be set up or not.

### Acceptance frame

*Confirmed 2026-09-11, when the owner approved the stories.*

- [ ] There is one place — a dedicated **My Assistant** page — where a signed-in Owner, Admin or
      Customer manages their own assistant's profile. Every entry point leads there, and nothing
      else can write an assistant's kind 0.
- [ ] Every assistant's default profile comes from one definition (the spec ratified at planning),
      whichever role or path publishes it, and users can edit exactly the agreed fields.
- [ ] The "set up your Assistant" prompt appears only when the viewer's own assistant has no profile
      on the local relay or on the relays its profile is published to — never for a profile that
      exists.
- [ ] Publishing the profile reaches the relays the instance is configured for, and the user sees an
      honest result for each relay.

## Epics in this book

- `assistant-profile` — five ordered stories: a truthful setup prompt, the right publish relays, one
  default profile, the My Assistant page, one writer.

## Provenance

- **Mode:** Acceptance-frame
- **Confidence at close:** —

## Close artifacts *(filled by `/close-book`)*

- Build audit: `engineering-team/audits/assistant-profile/audit.md`
- Product feedback: `engineering-team/audits/assistant-profile/prd-seed.md`
