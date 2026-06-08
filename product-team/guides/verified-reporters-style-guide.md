# Style Guide: Verified Reporters

**Slug:** verified-reporters
**Date:** 2026-06-07

> Governs all user-facing text in this feature. Binding during engineering review. Built from `product-team/guardrails/language.md` plus this product's voice. Inherits, and never relaxes, the base guardrails.

## Voice

Plain, exact, and trust-aware. This feature deals in reputation and warnings, so the copy is calm and factual — it states what is true and whose view it reflects, and lets the reader judge. It never editorializes about the reported account ("dangerous," "bad actor") and never reassures falsely. It is precise about point of view: every number belongs to someone's web of trust, and the copy says so.

Sounds like a careful colleague stating facts, not a platform issuing verdicts.

## Language rules
Base guardrails apply in full. Emphasized for this feature:

- **Active voice.** "3 verified users reported this account," not "this account was reported."
- **Concrete over vague.** State the number and the point of view. "Relative to your web of trust," not "personalized."
- **No verdicts about the subject.** The copy describes the *signal*, never the *person*. Never "this account is untrustworthy."
- **Whose view, always.** Any surface showing the count or list names the point of view (personal or House) in words.
- **No em-dash sentence joins** as a default connective. Use a period or restructure. (Two copy strings from the design draft were rewritten for this; see canonical copy below.)
- **No marketing tone, no superlatives, no false intimacy, no exclamation marks** in UI copy.

## Iconography ruling (resolves a guardrail tension)

The base guardrail bans "emoji in product copy." This feature reuses the app's existing unicode glyphs — flag (reporter motif), information (ⓘ), and lock (unavailable) — as **iconography**, the app's established visual indicator system, not as copy. They are permitted on that basis (the design guardrail allows "typography, colored shapes, brand marks, or hand-crafted SVG," and the existing Reporters metric already uses the flag glyph). They must never appear *inside a sentence* the user reads. This is open question #3 in the PRD; the recommended resolution is to keep them as iconography. If reversed, replace with hand-crafted SVG — do not substitute different emoji.

## UI copy patterns

- **Labels:** noun phrase, title-less. Count label: "Verified Reporters". Column: "Rank".
- **Point-of-view lines:** state the lens plainly and, for the fallback, what to do about it.
- **Empty states:** say there is nothing and why, in the viewer's terms.
- **Error messages:** what happened and what to do; offer a retry. Never "Something went wrong."
- **Links/navigation:** describe the destination ("Back to profile").

## Canonical copy (use verbatim)

| Surface | Copy |
|---|---|
| Count label | `Verified Reporters` |
| Count accessible name | `{n} verified reporters. View list.` |
| List title | `Verified Reporters` |
| List description | `Verified users who have reported this account.` |
| Point-of-view line (personal) | `Relative to your web of trust.` |
| Point-of-view line (House) | `Relative to the House (default) web of trust. Sign in and build your network to see your own view.` |
| Back link | `Back to profile` |
| Empty state | `No verified reporters. No one in this web of trust has reported this account.` |
| Error state | `Couldn't load reporters. Trust scores may still be computing for this view. Try again in a moment.` |
| Retry button | `Try again` |
| "About this data" popover | `All data on this page is computed locally by this Tapestry instance and is not imported via NIP-85.` / `Counts are personal to each viewer's web of trust. There is no single global number. When you have no calculated web of trust, the House (default) view is shown.` |

> The error and popover strings above are the corrected, guardrail-compliant versions of the design-guide drafts (em-dash joins removed).

## Forbidden phrases
Base list from `product-team/guardrails/language.md`, plus feature-specific:

- Any verdict about the reported account: "untrustworthy," "dangerous," "scammer," "bad actor," "flagged for removal."
- Any framing that implies a global truth: "the number of reporters," "total reports," "globally reported." Always bind to a point of view.
- "Reported by the community" (implies a single undifferentiated public; the signal is point-of-view-relative).
- Superlatives about the signal: "highly reported," "most-reported." State the number.
