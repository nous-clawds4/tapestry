# Story 3: One default profile for every assistant

**Status:** Approved
**Created:** 2026-09-11
**Type:** Feature
**Epic:** `assistant-profile`
**Book:** `engineering-team/audits/assistant-profile/book.md`

## Background

There are three definitions of an assistant's default profile today:

- **The server's** (`buildDefaultProfileContent`, `src/api/assistant/index.js:200`), with separate Owner
  and Customer branches — Admins get the Customer one — two different about texts, and a fallback that
  publishes "a customer's Tapestry Assistant" (OPEN.md #154).
- **The dashboard's "Surprise me" button** (`ui/src/pages/Dashboard.jsx:754`): "Tapestry Assistant", a
  different about text, and a robohash picture.
- **The legacy NIP-85 and customer pages**, which publish the server's defaults with no content,
  overwriting any edits.

The server's version also leaks non-public addresses. The branded picture is only offered when the
instance is publicly reachable, but the website and NIP-05 are not gated, so a dev instance publishes
`https://localhost:7777` and `…@localhost:7777` to public relays — and the reachability test itself
admits private-network addresses (OPEN.md #148). From a non-public instance the editor can even publish
a relative picture URL (`ui/src/components/AssistantProfileEditor.jsx:129,140`). Finally, the person's
name is read only from the local relay, which on a Docker instance holds no kind 0 except the ones this
instance wrote — so a Customer with a perfectly good nostr name often gets the fallback.

The owner specified the new default at planning (2026-09-11). This story makes it the only one.

## User-facing description

As a signed-in Owner, Admin or Customer, I want my assistant's default profile to say plainly whose
assistant it is and what it does — the same way for everyone — so that anyone who meets it on nostr
can place it, and I only have to edit it if I want to.

## The default profile (ratified 2026-09-11)

With ‹name› = the person's name from their nostr profile, ‹npub› = the person's full npub, and
‹domain› = the instance's public domain:

| Field | Default |
|---|---|
| `name`, `display_name` | `‹name›'s Tapestry Assistant` — or, if the person has no name, `npub...‹last 6 characters of ‹npub››'s Tapestry Assistant` |
| `about` | the two paragraphs below |
| `picture` | the branded Tapestry Assistant avatar — always: the instance's own copy (`https://‹domain›/ta-avatar.png`) on a public instance, otherwise the reference deployment's copy (`https://tapestry.brainstorm.world/ta-avatar.png`) |
| `website` | `https://‹domain›` — only on a public instance |
| `nip05` | server-managed, as today — only on a public instance |
| `banner`, `lud16` | empty (omitted) |
| event tag | `["client", "‹domain›"]` — only on a public instance |

The about text, verbatim from the owner:

> I am the Tapestry Assistant for ‹name› (‹npub›). You can find my pubkey in my owner's kind 10040
> event.
>
> I use social proof, such as decentralized lists, tags, follows, mutes, reports, and more, to curate
> data for my owner and publish it in a variety of formats including kind 3038x Trusted Assertions,
> kind 3039x Trusted Lists, and kind 39999 items on decentralized lists. This means that my owner's
> personalized trust metrics are available to any client that supports NIP-85 and related custom NIPs
> including Decentralized Lists and Trusted Lists.

With no name, the first sentence reads "I am the Tapestry Assistant for ‹npub›."

**A public instance** is one whose domain is reachable from the public internet: not `localhost` or
another loopback address, not a private-network address (10/8, 172.16/12, 192.168/16, IPv6 ULA), not a
`.local`, `.internal` or `.home.arpa` name, and not a bare hostname. `staging.brainstorm.world` is
public; `localhost:7777` is not.

## Acceptance criteria

- [ ] Given an Owner, an Admin and a Customer on the same instance, when each views their assistant's
      defaults (a never-published assistant, or "Reset to defaults"), then all three follow the table
      above and differ only in ‹name›, ‹npub› and the assistant's own NIP-05; no default ever reads
      "a customer's Tapestry Assistant".
- [ ] Given the person has a name in their nostr profile — on the local relay or on the instance's
      profile relays — then the default name and about use it; given they have none, the npub forms
      above are used.
- [ ] Given a public instance, then the default carries the website, and every assistant profile it
      publishes (default or edited) carries the server-managed NIP-05 and the
      `["client", "‹domain›"]` tag; given a non-public instance, the default has no website, and no
      assistant profile it publishes carries a NIP-05 or a client tag.
- [ ] Given any instance, public or not, then the default picture is the branded Tapestry Assistant
      avatar at a URL any nostr client can load; and no value the app itself supplies — a default, the
      branded image, a generated badged avatar — is ever a loopback, private-network or relative URL.
- [ ] Given the publish flow, then the user can edit name, display name, about, picture, banner,
      website and lightning address, and NIP-05 is shown read-only; and every path that publishes an
      assistant profile starts from this one definition.

## Concepts touched

None expected — the kind 0 is a nostr event, not a concept-graph node. `39998:<TA>:nostr-user` is the
nearest concept (the assistant and its person are both nostr users). Confirm at Architecture.

## Out of scope

- **Changing already-published profiles.** They stay as they are until their user re-publishes (epic
  guardrail); no backfill.
- **Where the profile is edited** (story 4) and **removing the other writers** (story 5). This story
  defines *what* the default is; story 5 makes it impossible to publish around it.
- **The NIP-05 local-part format** — unchanged (`‹name›-tapestry-assistant-‹6 hex›`).
- **Validating URLs the user types** into picture, banner or website.
- **In-app display fallbacks** for assistants with no profile.

## Open questions

None. Resolved at approval (2026-09-11):

1. **"Picture: always" on a non-public instance** — the reference deployment's copy,
   `https://tapestry.brainstorm.world/ta-avatar.png` (verified serving `200 image/png` on 2026-09-11);
   a public instance uses its own copy. Recorded in the table above.
2. **Name punctuation** — `npub...abc123's Tapestry Assistant`, with no comma.
3. **"‹name› (‹npub›)"** — the name followed by the full npub in parentheses, as drafted.
4. **The kind 10040 sentence** — included always, even before the person has published a kind 10040
   naming this assistant, since it tells readers where to look. **Known caveat (OPEN.md #267):** a
   person's kind 10040 is one event shared by every instance they use, and it names one assistant per
   list, so for someone with assistants on several instances the sentence can be true for only some
   of them. Seen 2026-09-11: the owner's 10040 names staging's TA (for `30392` and `39998:dog-breed`)
   and not production's. Kept as approved; revisit when row 267 is decided.
5. **Editable fields** — all seven (name, display name, about, picture, banner, website, lightning
   address); NIP-05 read-only.

## Linked artifacts

- ADR: (filled in after Architecture phase)
- Test plan: (filled in after Test Design phase)
- Review: (filled in after Review phase)
