# Completion report — note-tagging-inspector

**Date:** 2026-07-18
**Branch → staging:** PR [#381](https://github.com/nous-clawds4/tapestry/pull/381), merged 2026-07-18T04:50:13Z, merge commit `8cccfd333a49ad1a774a2144d0798c27d5e3e983`
**Deploy:** `deploy-staging.yml` run [29631215949](https://github.com/nous-clawds4/tapestry/actions/runs/29631215949) — ✓ success, 1m28s, on the merge SHA
**CI gate on the PR:** `stack-free` — ✓ pass, 36s ([run 29631185053](https://github.com/nous-clawds4/tapestry/actions/runs/29631185053))
**Story:** `engineering-team/stories/tag-event-inspector/3-note-tagging-raw-events-inspector.md` — **Status: Done** (review PASS at `0d052919`)
**Review:** `engineering-team/reviews/tag-event-inspector/3-note-tagging-raw-events-inspector.md` — PASS
**ADR:** `engineering-team/decisions/tag-event-inspector/0003-note-tagging-raw-events-inspector.md`

Evidence below is bullet-by-bullet against the acceptance frame in `book.md` § "Acceptance frame". Two capture caveats, stated once: the in-app browser pane's screenshot function returned black frames on this machine throughout (content was captured as accessibility-tree reads and page text instead — quoted verbatim below), and on the staging page two interactions (the Notes-tab switch, the popover button press) did not register via synthetic pointer events and were driven by DOM-dispatched clicks on the real elements (both interactions worked pointer-driven on the local stack; the staging drive remained read-only throughout).

## Bullet 1 — raw signed events viewable in-product ✓

**Staging, real data, signed out** (`https://staging.brainstorm.world/tag/cool-web-of-trust/92aa94e7433e2e1e4277c44d493de4a03b0c7ab9f2fec76cac8f94d585cf8918`, Notes tab): toggling the chip popover's button on david's "Teamwork! 🤝 🫂" note opened the region **"Raw tagging events — Cool Web of Trust"** containing one block captioned `Applied by 2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331` (vinney) and the complete signed event as published, byte-faithful, all seven fields:

```json
{
  "id": "cbc88e9c0126dc577f471d53f77e4b8e123c41a23de2b0637fe8188b96659f32",
  "pubkey": "2efaa715bbb46dd5be6b7da8d7700266d11674b913b8178addb5c2e63d987331",
  "created_at": 1784260881,
  "kind": 39999,
  "tags": [
    ["d", "event-tag-cool-web-of-trust-a868c39f-2efaa715"],
    ["e", "a868c39f7539337da93e968a239ca7a13e8f92659da735ead38fca900444cd8c"],
    ["z", "39998:82b75e474dda005e912bcbb910391c60c2b89cc7faf5d3c30b7c59a324973833:nostr-event-tag"],
    ["z", "39998:a68dbf561cfe3da1b76f1e65c7d4d9cc116f79921b38a815fd75cb5460b4b599:nostr-event-tag"],
    ["z", "39999:e5272de914bd301755c439b88e6959a43c9d2664831f093c51e9c799a16a102f:tagging:cool-web-of-trust-tagging"],
    ["polarity", "1"]
  ],
  "content": "",
  "sig": "f8418f3f979a90610633ad567dde76356f37426f7478ae4546fd1a157de14414f2964672c4b98938be8c0a405de715d68472806c0e167e23882a7c83d029c100"
}
```

(The `e` tag is the tagged note's id; the event was extracted from the rendered panel's `<pre>` via the page DOM.) Console errors during the staging drive: **zero**.

## Bullet 2 — every event behind the counts, count-back exact ✓

- **API contract, staging, real data:** `GET /api/event-tags/for-event?eventId=a868c39f…` → `tags: [cool-web-of-trust, 1 application, 0 disputes]`, `rawEvents` holding **exactly** the 1 referenced id (exact set match), 7-field value, kind 39999.
- **API contract, local, hot-note case:** fixture note `a1b777b4…` → `tags: [rvw3-alpha…, 10 applications, 1 dispute]`, `rawEvents` = **exactly the 11 referenced ids** (exact set match), each 7-field, 128-char sig.
- **DOM count-back, local, signed out:** popover read "Applied by 10 / Disputed by 1"; the panel rendered **11 blocks — ten "Applied by \<full 64-hex pubkey\>" then one "Disputed by"** (applications before disputes), each with its full signed JSON. Accessibility-tree extract in the run journal (2026-07-18T06:35 entry).
- **Ordering/dedupe/uncounted-marker mechanics:** pinned by the automated suites (below) — `note-tagging-raw-events-inspector-ui` 32/0, `-http` 9/0 live including the dispute-only and cross-channel-dedupe cases; the uncounted-marker rendering is byte-identical to the shipped Story-2 component (shared `RawTaggingEvents`) and covered by its suite (25/0) plus source assertions; the review records the mine-only runtime case as unproducible on an unfiltered local POV and covered structurally (review § gaps).

## Bullet 3 — hidden by default, popover toggle, signed out ✓

Both drives ran **signed out**. Fresh loads showed no panel (local and staging). The popover carried **"Show Raw Tagging Events"** beside Apply/Dispute — Apply/Dispute disabled with the NIP-07 hint, the raw button **enabled**. After toggling: panel present **inside the note card, below the note body, above the chips row** (DOM position verified in the accessibility tree on both environments), captioned with the tag's name; the button read **"Hide Raw Tagging Events"** (label-state truth re-verified on re-hover on both). Per-(note, tag) toggle, stacking in chip order, and per-note isolation: driven in the review's 34/34 headless pass and pinned by suite tests U10–U13.

## Bullet 4 — uniform across note surfaces, nothing regressed ✓

- **Uniformity:** the affordance ships inside the shared `NoteCard → NoteTags → TagChip` unit (source-pinned by suite R8: exactly two `TagChip` importers, wiring in `NoteTags` only). The review drove it on **two surfaces** (tag-page Notes tab + a profile's tagged-notes section, 34/34 checks); this run's drives add the staging tag-page Notes tab.
- **Non-regression:** Story-2's suite (re-aimed, assertions unchanged) **25/0**; Story-1's menu suite **30/0**; profile chips receive no raw props (source-pinned, R5) and rendered unchanged; full-suite differential on the final commit — the only failing suites are the 11 known environmental tag/pin/TL suites with per-suite failed counts identical to the recorded pre-story baseline (journal, 2026-07-18T00:26 entry; re-verified independently at Gate 4 and by the Reviewer); staging Tier-5 sweep: story-2 `profiles-tagged`, tags index, story-1 tag page, `/api/feed` all 200.

## Bullet 5 — live on staging, five-tier smoke passing ✓ (upgrade clause exercised)

- **Tier 1:** stable at 3×2s polls, then settle.
- **Tier 2:** all 7 pages + 4 APIs 200; Meili search 200 with hits.
- **Tier 3:** served bundle `index-CAOBtkUk.js` contains `Show Raw Tagging Events` (×1) and zero `TagRowRawEvents` references; `for-event` on a nonexistent id returns `rawEvents` present and `{}` (the always-assign contract — honest emptiness, not an error).
- **Tier 4:** the frame's **upgrade clause fired**: staging's read-union now surfaces the two real `cool-web-of-trust` note-taggings (`for-tag` → `total: 2`; it measured 0 at book-open), so the pre-registered honest-empty probe was **replaced by the read-only populated drive** recorded under Bullet 1 — performed without any staging mutation.
- **Tier 5:** adjacent-surface sweep all 200 (list under Bullet 4).

## Automated gates on the shipped commit range

- Stack-free CI (`test.yml`) on PR #381: ✓ 36s.
- Story suites: `note-tagging-raw-events-inspector-ui` **32/0**; `note-tagging-raw-events-inspector-http` **9/0, 0 skipped** (live local stack; fixtures self-seeded under a disposable authority); re-aimed `tagging-raw-event-inspector-ui` **25/0**; `tag-actions-menu-ui` **30/0**.
- Full-suite differential (three independent runs — Director at Gate 4, Reviewer, Implementer): identical to the recorded environmental baseline; no new failing suite; `test/` diff from the failing-tests commit (`b221139e`) to the implementation commit: **empty**.

## Out-of-scope confirmations

Profile pages' own tag chips gained no affordance (deferred at Planning); no TA pubkey literal was introduced (the `CANONICAL_AUTHORITY` and ADR-0015 `LEGACY_*` literals are untouched); no firmware/concept changes (no reinstall); no new dependencies or tooling. Promotion beyond `staging` — `feat/tags`/`tags.brainstorm.world` (where this data lives natively) or production — is deliberately not performed and remains the operator's decision.
