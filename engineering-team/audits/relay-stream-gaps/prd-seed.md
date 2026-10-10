# PRD Seed: Relay completeness — an instance's relay holds what its streams are meant to bring, without hand-run syncs

**Mode:** reconstructed from as-built *(no prior PRD)*
**Build audit:** `engineering-team/audits/relay-stream-gaps/audit.md`
**Anchor:** acceptance frame in `book.md` (four bullets, confirmed by the operator 2026-10-09)
**Confidence:** **medium**. The frame is explicit and every bullet traces to a reviewed story, so the as-built scope is solid. Three things are inferred: the operator's underlying goal beyond the frame, how the feature lands on production, and how much of the remaining gap matters to anyone.
**Date:** 2026-10-10

> This is a **reverse-engineered baseline** in the product-team PRD shape, built from what shipped. It is a *strawman for the product team*, not a ratified spec. Every section is tagged — `[FROM FRAME]` (grounded in the kickoff acceptance frame), `[INFERRED]` (read off the as-built system), or `[UNKNOWN — product input needed]`. The product team adopts this as the starting point for `/discover` on the next phase and validates each section.

## 1. Product vision

`[FROM FRAME]` The operator found content missing from their instance's local relay until they ran a negentropy sync by hand, although every router stream showed as on. The ask: what the streams are meant to bring in actually arrives, and keeping it complete doesn't depend on someone remembering a manual sync.

`[INFERRED]` A Tapestry instance's relay is the raw input to everything the instance computes: follows, mutes and reports for WoT scoring, profiles for search, tags and lists for curation. Silent holes in it skew every point of view computed from it, and nothing on screen says so. So the product goal reads as **"the local relay is as complete as the operator has asked it to be, and the operator can see that it is."**

`[UNKNOWN — product input needed]` How complete is complete enough? Is it a guarantee per stream, best effort, or "no worse than a manual sync"? And should an instance be able to show its completeness to the people who rely on it?

## 2. Personas

`[FROM FRAME]` **Instance operator (owner).** Runs a Tapestry instance and manages its relay streams on Settings → Relays (Router Management and Negentropy Sync tabs). Comfortable with relays, kinds and filters. Notices gaps only when something they expect is missing.

`[INFERRED]` **People who use the instance's outputs.** Searchers, curators, anyone reading a POV's trust scores. They never see the router, but they inherit its holes. No story was written for them; this persona is a guess.

`[UNKNOWN — product input needed]` Is there an operator who runs several instances and wants the same streams and presets everywhere? Story 3 ruled out sharing presets between instances, and each instance's stream state is its own.

## 3. Scope (as-built)

`[FROM FRAME]` In scope now, all on staging (audit §1):
- **Changing streams leaves the others alone.** Toggling, editing and Restore Defaults reload the router's config in place. Only the changed streams reconnect. A change the router rejects is rolled back and reported, never shown as done. *(Frame bullet 1.)*
- **The Limit does what it says.** On every connect, a download stream fetches up to its Limit of each relay's newest matching events, so a hole shorter than the Limit refills by itself. New streams and presets default to 500. *(Frame bullet 2.)*
- **Saved negentropy presets on a schedule.** Named presets, each with an on/off switch, run together by one Scheduled Task. Each run covers the time since that preset's last success less an hour (7 days on a first run). Each preset shows its last result. *(Frame bullet 3.)*
- **Verified on staging.** *(Frame bullet 4.)*

`[INFERRED]` Also in scope, set by the stories' Product decisions and Out of scope (approved at Planning, 2026-10-09) rather than by the frame:
- **Per-instance.** Each instance's streams, limits and presets are its own state, with no sync between instances (story 3 Out of scope).
- **One shared schedule.** All presets run on one schedule, the task's (story 3 Out of scope).
- **A preset must narrow.** It needs kinds, authors or a tag filter, which guards against importing the dcosl junk stream (story 3 decision 3).
- **Saved limits are not migrated.** An instance improves only once its operator raises its streams' limits (story 2 decision 2).

`[FROM FRAME]` Production: stories 1–2 reached it with a full staging promotion (PR #829) before their staging checks finished, and with its saved limits still at 5, 0 or none. Story 3 has not been promoted.

## 4. Domain model

`[INFERRED]` No Tapestry concept changed. The entities are operator configuration, not graph data:
- **Stream** (router): name, direction (down / up / both), filter (kinds, authors, single-letter tag filters, **limit**), relay URLs, optional plugins, enabled. Saved per instance in `router-state.json`.
- **Preset** (negentropy): name (unique), relay, direction, filter (kinds, authors, tag filters; no since/until), enabled, last run (when, ok, in, out, error or skipped), last success. Saved per instance in `negentropy-presets.json`.
- **Scheduled task entry:** one **Sync Negentropy Presets** entry, with its interval and on/off switch.
- **Relay:** each stream's and preset's counterparty. A `nostr-relay` concept exists in the graph (`39998:<this instance's TA>:nostr-relay`), but here relays are plain URL strings.

`[UNKNOWN — product input needed]` Should a stream and a preset be one thing? An operator who wants "keep kind X from relay Y complete" today configures it twice, once per tab. Story 3 ruled out merging them.

## 5. Design rules (as-built)

`[INFERRED]` From the shipped UI and the reviews:
- **Never report a change as done unless it took effect.** The router reports success only after its log confirms the reload, and a scheduled preset reports the relay's own words when it refuses.
- **Say what a setting does where it is set.** The Limit's label is "fetched on connect", with a hint underneath. The preset explainer states the window and how to run a one-off full sync.
- **Operator safety rails over flexibility.** The floor on presets; values strfry would reject are refused on presets (not yet on streams); presets save and run only for the owner.
- **Fail toward the old behaviour.** If the router doesn't confirm a reload, it is restarted, as before the book.

`[UNKNOWN — product input needed]` No rule says how much of this status belongs on screen beyond each preset's last-run line. Should the operator see each stream's health, when it last connected, or the holes found?

## 6. Carry-forward & open questions

Promoted from the build audit §6:
1. **Production** and the per-instance setup it needs: raise its saved limits now (stories 1–2 are there), promote story 3, then add and switch on the presets task and save presets (audit §6 #1).
2. **Visible completeness.** Today a preset's productive run disappears at the next quiet run, and the Scheduled Tasks history shows failures as successes. The operator can't tell "nothing was missing" from "it worked" (audit §6 #5, #6).
3. **Deploy holes.** The router boots with no streams until the control panel starts, and one stream connected minutes late for an unknown reason. Limits of 500 hide the effect at staging's rates (audit §6 #3).
4. **What still slips through:** events backdated before a preset's window, the upload direction after a router restart, and content nothing is configured to carry (audit §6 #11).
5. **One preset model across both tabs,** per-preset schedules, starter presets, and sharing between instances. All four were ruled out of story 3 (audit §6 #12).
6. **Hardening:** values strfry rejects on streams, silent or refusing relays, relay text in the log (audit §6 #4, #7, #8).

## 7. What product must validate

- [ ] `[UNKNOWN]` The completeness goal: guarantee, best effort, or "as good as a manual sync"? It decides whether item 4 above is a bug or an accepted limit.
- [ ] `[UNKNOWN]` Whether completeness should be **visible**: per stream and per preset, to the operator only, or to the instance's users too.
- [ ] `[INFERRED]` That instance operators are the only persona. Check whether people downstream of a POV need to know when its inputs were incomplete.
- [ ] `[INFERRED]` That per-instance configuration is right. Validate against operators running several instances.
- [ ] `[UNKNOWN]` Whether streams and presets should become one "keep this complete" concept for the operator.
- [ ] `[INFERRED]` That 500 is the right default limit, and 6 hours the right cadence. Both were settled at Planning from strfry's 500 cap and the measured event rates; no operating experience stands behind them yet.
