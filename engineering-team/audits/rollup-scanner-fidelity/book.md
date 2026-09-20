# Book of Work: rollup-scanner-fidelity

**Slug:** rollup-scanner-fidelity
**Status:** Open
**Opened:** 2026-09-20
**Closed:** —

## Intent anchor

**Acceptance frame (no PRD)** — work packet `h-rollup-scanner` from the operator's 2026-09-13
`/whats-open` triage: *"Make /whats-open's scanners see what's really there."* Restated and
confirmed with the operator at intake on 2026-09-20, together with the three dispositions the
packet left open (row 208's fix shape, the `###`/extra-marker question, the carry-forward
section's future).

### Acceptance frame

- [ ] No line the roll-up or the session digest prints is invalid UTF-8, on macOS and on Linux,
      with or without a UTF-8 locale.
- [ ] Open books print their real age. Today none does: `whats-open.sh` asks GNU `date -d`, which
      macOS `date` rejects outright.
- [ ] The two readers of `_intake.md` — `scripts/whats-open.sh` and `scripts/lib/collect-meta.sh`
      — agree about which entries are retired. Today they disagree about 6 of 33.
- [ ] An intake entry whose own marker says work remains (`**PICKED UP** (partial)`, `(Part A)`,
      `(in progress)`) stays visible. Five do today and none is listed; `_intake.md:611` says
      "**Part B still OPEN**" and has been invisible since 2026-07-02.
- [ ] `**DONE**` and `**REASSIGNED**` retire an entry, as `**PICKED UP**` and `**RESOLVED**` do.
- [ ] A retired entry that still carries `###` sub-headings is flagged rather than silently
      swallowed — the class that hid a security note under its parent for a day.
- [ ] The closed-book carry-forward section prints a bounded, current list and says what it
      suppressed; `6-book-close.md` tells a closer to tick §6 when an item is resolved elsewhere.
- [ ] Every fix is pinned by a fixture-driven test that fails before it.
- [ ] `OPEN.md` rows 290 and 208 are DONE; every other defect in the packet has a ledger row,
      flipped DONE in the same PR.

## Epics in this book
- `rollup-scanner-fidelity` — the roll-up's and the digest's scanners report what the repo holds.

## Provenance
- **Mode:** Acceptance-frame
- **Confidence at close:** *(filled at close)*

## Close artifacts *(filled by `/close-book`)*
- Build audit: `engineering-team/audits/rollup-scanner-fidelity/audit.md`
- Product feedback: `engineering-team/audits/rollup-scanner-fidelity/prd-seed.md`
