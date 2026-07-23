# Style Guide: Second Brain (display name: "Tapestry Harness")

**Slug:** second-brain
**Date:** 2026-07-21

> Governs all user-facing text in the product. Binding during engineering review. Built from `product-team/guardrails/language.md` plus this product's voice.

## Voice

A capable aide reporting to the person it works for. Calm, brief, concrete, second person. It states what happened and what it needs; it never performs enthusiasm, never apologizes theatrically, never narrates its own machinery. The owner said it best: questions come *"in plain english, not jargon that I don't understand."* If a sentence would sound odd said aloud across a desk, it fails.

## Language rules

Base guardrails apply in full (no LLM tics, no superlative inflation, no passive deflection, no emoji, no exclamation marks in UI copy, active voice, short sentences, concrete over vague). Product-specific rules:

- **No system vocabulary in owner-facing text.** Banned words anywhere the owner reads: *element, kind, schema, event, pubkey, superset, concept header, persona, acceptance criteria, lease, payload, endpoint.* Say the plain thing: "goal," "resource," "recorded."
- **Tell the owner what happened to their world, not what the system did.** "Goal captured." — not "Element created and republished."
- **Comparisons, not decimals.** Relative value is expressed in words and rankings; a numeric score never appears in owner-facing copy in v1.
- **Questions earn their interruption.** At most two per session hand-off; each one answerable in a sentence; each states what the answer unblocks.
- **Standing words are canonical and lowercase:** *captured, viable, achieved, abandoned* (goals); *current, stale, unreachable* (resources); *open, approved, skipped* (proposals). No synonyms, no invented states.

## UI copy patterns

- **Button labels:** verb (+ noun where ambiguous): "Approve," "Skip…," "Cancel," "Export brain." The ellipsis on "Skip…" signals a reason is expected.
- **Empty states:** say what will appear and give the one action. Canonical cold start: *"Your brain is empty — that's the right place to start. Tell your assistant a goal in plain words and it will appear here."*
- **Error messages:** what went wrong, in whose terms, and what to do: *"Couldn't reach this resource at its address — check it moved, or mark it retired."* Never "Something went wrong."
- **Confirmations:** one sentence, the fact, no ceremony: *"Goal captured."* · *"Skipped — noted."* · *"Restore drill complete — your brain matches the export."*
- **The proposal register (canonical skeleton):** *"Next: {goal}."* + why-now in one or two sentences + *"considered instead"* + one line per runner-up. The skip prompt is *"why not this one, in a few words."*
- **The privacy line (indicator, never a toggle):** *"This brain stays on this machine — nothing here is published."*

## Forbidden phrases

Beyond the base list:

- Celebration theater: "Great job," "You're all set," "Awesome."
- Anthropomorphic guilt or eagerness: "Sorry about that," "I'd love to," "Happy to help."
- Progress theater: percentages or precision the system doesn't actually have ("87% complete").
- Urgency theater: "Don't forget," "You still need to," red badges with counts on anything but errors.
- Machine self-narration: "Publishing…", "Syncing state," "Running query."
