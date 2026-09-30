# Epic: my-assistants — the My Assistants page at `/assistants`

**Status:** Active
**Created:** 2026-09-30
**Book:** `engineering-team/audits/my-assistants/book.md` (no PRD — acceptance frame)
**Blueprint:** the Claude Design artifact's "My Assistants" screen, kept as it stood at intake in
`engineering-team/audits/my-assistants/blueprint/`.

## Goal

**One page where a signed-in person sees every Assistant they've claimed as theirs**, and what
each one does for them according to their Treasure Map. A person can have several Assistants,
across several WoT Service Providers. The page is where they keep track of them, and where they
tag a profile as one of their Assistants (or stop).

## Stories

All three are features, so all take the five phases (Standard). They're built in this order, then
shipped to staging together (book decision 6).

1. `1-the-my-assistants-page.md`: the menu link, the page, and the Assistants list. It reads the
   person's own taggings and the tagged profiles, and publishes nothing.
2. The tagging actions: search for a profile, tag it **My Brainstorm Assistant** or **My Tapestry
   Assistant**, change the tag, remove it. Also the new **My Brainstorm Assistant** definition the
   taggings point at. Depends on #1.
3. The Treasure Map on the page: each Assistant's "on your Treasure Map" status and its duties,
   the "On your Treasure Map, but not tagged" section, and the read-only **Duties** tab. Depends on
   #1; its Tag buttons depend on #2.

## Key facts / guardrails

- **"Whose Assistants?" is this epic's POV question.** The answer is always *the signed-in
  person's*: the taggings they signed, and their own Treasure Map. Nobody else's taggings decide
  what the page lists. A signed-out visitor sees a sign-in prompt, not someone else's list.
- **Publishing is permissionless (principle 2).** A tagging of a same-named tag counts whoever
  authored the definition, as it does on the Identification Tags page. The definition's author
  matters only for what a *new* tagging points at.
- **"Local" means the viewer's own Assistant on this instance.** That is the same answer the
  Assistant Management page uses, resolved at runtime. Never a hardcoded pubkey (CLAUDE.md house
  rule). It's listed even when untagged (book decision 5). That's the one place the page departs
  from the blueprint.
- **The Treasure Map is read, never written, in this epic.** Duties are shown as the Treasure Map
  states them. Editing duties stays on the Treasure Map page.
